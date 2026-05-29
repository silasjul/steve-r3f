'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
} from 'three'
import { useScatterWorld } from './_scatter-context'
import type {
  MeshRefCallback,
  ScatterPoolConfig,
  ScatterPoolHandle,
} from './_scatter-types'

// Browsers throttle rAF on blur/visibility change; the resumed frame's delta
// can be seconds. Clamping avoids ground overshoot + simultaneous mass-recycle.
const MAX_DT = 1 / 30

// 8-neighbour offsets used when clusterBias > 0. Module scope so the array
// isn't reallocated per spawn attempt.
const CLUSTER_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
]

// Frame-local scratch objects — module scope avoids per-frame allocation and
// these are written-then-read in a single synchronous loop body.
const dummy = new Object3D()
const modelMatrix = new Matrix4()
const finalMatrix = new Matrix4()
const modelEuler = new Euler()
const modelQuat = new Quaternion()
const modelOffset = new Vector3()
const modelScaleVec = new Vector3()

interface PoolState {
  positions: Float32Array
  scales: Float32Array
  rotations: Float32Array
  variants: Uint8Array
  initialized: Uint8Array
}

function createState(capacity: number): PoolState {
  return {
    positions: new Float32Array(capacity * 2),
    scales: new Float32Array(capacity),
    rotations: new Float32Array(capacity),
    variants: new Uint8Array(capacity),
    initialized: new Uint8Array(capacity),
  }
}

function pickWeighted(weights: readonly number[]): number {
  let total = 0
  for (let i = 0; i < weights.length; i++) total += Math.max(0, weights[i])
  if (total <= 0) return 0
  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i])
    if (r <= 0) return i
  }
  return weights.length - 1
}

export function useScatterPool(config: ScatterPoolConfig): ScatterPoolHandle {
  const { speed, radius, occupancy, getGroundOffsetZ } = useScatterWorld()
  const meshCount = Math.max(1, config.meshCount)

  // Latest props mirrored into refs — assignment happens in useEffect (post
  // commit), never during render, so React Compiler's "no ref writes during
  // render" rule is satisfied.
  const configRef = useRef(config)
  const worldRef = useRef({ speed, radius, occupancy, getGroundOffsetZ })
  useEffect(() => {
    configRef.current = config
    worldRef.current = { speed, radius, occupancy, getGroundOffsetZ }
  })

  // Mutable buffers. Allocated lazily inside useFrame the first time it runs;
  // never read or written during render so the compiler treats them as inert
  // ref containers (which is what useRef is for).
  const stateRef = useRef<PoolState | null>(null)
  const meshesRef = useRef<(InstancedMesh | null)[]>([])
  const countersRef = useRef<Uint32Array | null>(null)

  // Reset every slot when the spatial domain changes — without this, growing
  // the radius leaves the old cluster centered and the new ring stays empty.
  useEffect(() => {
    const s = stateRef.current
    if (s) {
      s.initialized.fill(0)
      s.positions.fill(0)
    }
  }, [radius])

  // Optional self-registration as an occupier so other pools can blockedBy us.
  useEffect(() => {
    if (!config.registerAsOccupier) return
    return occupancy.register(config.name, (qx, qz) => {
      const s = stateRef.current
      if (!s) return false
      const cfg = configRef.current
      const square = cfg.snapToGrid === true
      for (let i = 0; i < cfg.capacity; i++) {
        if (!s.initialized[i]) continue
        const dx = s.positions[i * 2] - qx
        const dz = s.positions[i * 2 + 1] - qz
        const r = cfg.footprint * s.scales[i] * 0.5
        // Grid-snapped occupiers (eg. unit-tile rocks) block a square area so
        // the footprint slider matches the visible tile extent rather than an
        // inscribed circle that leaves tile corners unblocked.
        if (square) {
          if (Math.abs(dx) < r && Math.abs(dz) < r) return true
        } else if (dx * dx + dz * dz < r * r) return true
      }
      return false
    })
  }, [occupancy, config.name, config.registerAsOccupier])

  // Stable per-mesh ref callbacks. The useMemo return is itself read-only;
  // the callbacks route writes through meshesRef (a useRef), which is the
  // documented mutable container — so React Compiler's immutability rule
  // doesn't tie this array to downstream `mesh.count = ...` mutations.
  const meshRefs = useMemo<MeshRefCallback[]>(
    () =>
      Array.from({ length: meshCount }, (_, k) => (mesh: InstancedMesh | null) => {
        meshesRef.current[k] = mesh
        if (mesh) mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      }),
    [meshCount]
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, MAX_DT)
    const cfg = configRef.current
    const { speed: spd, radius: r, occupancy: occ, getGroundOffsetZ: getGz } = worldRef.current
    const variantCount = Math.max(1, cfg.variantCount ?? meshCount)

    // Lazy buffer allocation. capacity is constant in every consumer, so this
    // runs exactly once per pool instance.
    if (stateRef.current === null) stateRef.current = createState(cfg.capacity)
    if (countersRef.current === null || countersRef.current.length !== meshCount) {
      countersRef.current = new Uint32Array(meshCount)
    }
    const state = stateRef.current
    const counters = countersRef.current
    const meshes = meshesRef.current

    const target = Math.min(cfg.targetCount, cfg.capacity)
    const r2 = r * r
    const { positions, scales, rotations, variants, initialized } = state
    counters.fill(0)
    const spawnSign = spd === 0 ? 1 : -Math.sign(spd)
    const edgeBand = 1.5
    const selfAvoidFactor = cfg.selfAvoidFactor ?? 0
    const fanAll = cfg.fanAllMeshes === true

    // Pre-compose the model fix-up matrix once per frame.
    const mdl = cfg.model
    if (mdl) {
      modelEuler.set(
        MathUtils.degToRad(mdl.rotX),
        MathUtils.degToRad(mdl.rotY),
        MathUtils.degToRad(mdl.rotZ),
        'XYZ'
      )
      modelQuat.setFromEuler(modelEuler)
      modelOffset.set(mdl.offsetX, mdl.offsetY, mdl.offsetZ)
      modelScaleVec.setScalar(mdl.scale)
      modelMatrix.compose(modelOffset, modelQuat, modelScaleVec)
    }

    let writeIdx = 0  // only used in fan mode

    for (let i = 0; i < target; i++) {
      let x = positions[i * 2]
      let z = positions[i * 2 + 1]
      let needSpawn = !initialized[i]

      if (!needSpawn) {
        z += spd * dt
        if (x * x + z * z > r2) needSpawn = true
      }

      if (needSpawn) {
        const isFresh = !initialized[i]
        // Hide this slot from self-avoid so a recycling instance doesn't
        // reject every nearby position because of its own outgoing ghost.
        initialized[i] = 0
        let placed = false
        const triesMax = selfAvoidFactor > 0 ? 16 : 6
        const clusterBias = cfg.clusterBias ?? 0
        for (let tries = 0; tries < triesMax; tries++) {
          let cx = 0
          let cz = 0
          let clustered = false
          if (clusterBias > 0 && Math.random() < clusterBias) {
            // Pick a random already-placed sibling as a cluster seed and
            // offset by one tile in a random 8-neighbour direction.
            for (let a = 0; a < 8; a++) {
              const j = (Math.random() * target) | 0
              if (j === i || !initialized[j]) continue
              const sz = positions[j * 2 + 1]
              // For recycles, restrict seeds to rocks near the leading edge so
              // adjacent placements don't appear mid-disc.
              if (!isFresh && spawnSign * sz < r - 4) continue
              const sx = positions[j * 2]
              const d = CLUSTER_DIRS[(Math.random() * 8) | 0]
              cx = sx + d[0]
              cz = sz + d[1]
              if (cx * cx + cz * cz > r2) continue
              clustered = true
              break
            }
          }
          if (!clustered) {
            if (isFresh) {
              const t = Math.random() * Math.PI * 2
              const rr = Math.sqrt(Math.random()) * r
              cx = Math.cos(t) * rr
              cz = Math.sin(t) * rr
            } else {
              const halfX = r - 0.1
              cx = (Math.random() * 2 - 1) * halfX
              const zMax = Math.sqrt(Math.max(0, r2 - cx * cx))
              cz = spawnSign * (zMax - Math.random() * edgeBand)
            }
          }
          if (cfg.snapToGrid) {
            // Ground tiles sit at integer + groundOffsetZ — snap to the same
            // lattice so instances stay seated on tiles after the world has
            // been scrolling for a while.
            const gz = getGz()
            cx = Math.round(cx)
            cz = Math.round(cz - gz) + gz
          }
          if (occ.isBlocked(cx, cz, cfg.blockedBy, cfg.avoidWalkCorridor)) continue
          if (selfAvoidFactor > 0) {
            const minD = cfg.footprint * selfAvoidFactor
            const minD2 = minD * minD
            let tooClose = false
            for (let j = 0; j < target; j++) {
              if (j === i || !initialized[j]) continue
              const dx = positions[j * 2] - cx
              const dz = positions[j * 2 + 1] - cz
              if (dx * dx + dz * dz < minD2) { tooClose = true; break }
            }
            if (tooClose) continue
          }
          x = cx; z = cz; placed = true; break
        }
        if (!placed) continue
        positions[i * 2] = x
        positions[i * 2 + 1] = z
        scales[i] = cfg.scaleMin + Math.random() * Math.max(0, cfg.scaleMax - cfg.scaleMin)
        rotations[i] = cfg.rotateRandom ? Math.random() * Math.PI * 2 : 0
        variants[i] = cfg.variantWeights && cfg.variantWeights.length === variantCount
          ? pickWeighted(cfg.variantWeights)
          : Math.floor(Math.random() * variantCount)
        initialized[i] = 1
      } else {
        positions[i * 2 + 1] = z
      }

      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, rotations[i], 0)
      dummy.scale.setScalar(scales[i])
      dummy.updateMatrix()
      const outMatrix = mdl ? finalMatrix.multiplyMatrices(dummy.matrix, modelMatrix) : dummy.matrix

      if (fanAll) {
        for (let k = 0; k < meshCount; k++) {
          const mesh = meshes[k]
          if (mesh) mesh.setMatrixAt(writeIdx, outMatrix)
        }
        writeIdx++
      } else {
        const v = variants[i]
        const mesh = meshes[v]
        if (!mesh) continue
        const slot = counters[v]
        mesh.setMatrixAt(slot, outMatrix)
        counters[v] = slot + 1
      }
    }

    for (let k = 0; k < meshCount; k++) {
      const mesh = meshes[k]
      if (!mesh) continue
      mesh.count = fanAll ? writeIdx : counters[k]
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return { meshRefs }
}
