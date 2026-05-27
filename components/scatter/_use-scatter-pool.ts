'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DynamicDrawUsage, InstancedMesh, Object3D } from 'three'
import { useScatterWorld } from './_scatter-context'
import type {
  MeshRefCallback,
  ScatterPoolConfig,
  ScatterPoolHandle,
} from './_scatter-types'

const dummy = new Object3D()

// Browsers throttle rAF on blur/visibility change; the resumed frame's delta
// can be seconds. Clamping avoids ground overshoot + simultaneous mass-recycle.
const MAX_DT = 1 / 30

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
  const { speed, radius, occupancy } = useScatterWorld()

  // Latest config visible to the frame loop without re-binding refs.
  const configRef = useRef(config)
  configRef.current = config
  const worldRef = useRef({ speed, radius })
  worldRef.current = { speed, radius }
  const occupancyRef = useRef(occupancy)
  occupancyRef.current = occupancy

  // Per-instance buffers. Reallocated only when capacity/variantCount change.
  const state = useMemo(() => {
    const cap = config.capacity
    const vc = Math.max(1, config.variantCount)
    return {
      positions: new Float32Array(cap * 2),
      scales: new Float32Array(cap),
      rotations: new Float32Array(cap),
      variants: new Uint8Array(cap),
      initialized: new Uint8Array(cap),
      meshes: new Array<InstancedMesh | null>(vc).fill(null),
      counters: new Uint32Array(vc),
    }
  }, [config.capacity, config.variantCount])

  // Stable ref callbacks per variant. Setting usage to dynamic avoids three's
  // re-upload warning since matrices change every frame.
  const meshRefs = useMemo<MeshRefCallback[]>(() => {
    return Array.from({ length: Math.max(1, config.variantCount) }, (_, v) => (
      mesh: InstancedMesh | null
    ) => {
      state.meshes[v] = mesh
      if (mesh) mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    })
  }, [config.variantCount, state])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, MAX_DT)
    const cfg = configRef.current
    const { speed: spd, radius: r } = worldRef.current
    const occ = occupancyRef.current
    const target = Math.min(cfg.targetCount, cfg.capacity)
    const r2 = r * r
    const positions = state.positions
    const scales = state.scales
    const rotations = state.rotations
    const variants = state.variants
    const initialized = state.initialized
    const counters = state.counters
    const meshes = state.meshes
    counters.fill(0)
    const spawnSign = spd === 0 ? 1 : -Math.sign(spd)
    const edgeBand = 1.5

    for (let i = 0; i < target; i++) {
      let x = positions[i * 2]
      let z = positions[i * 2 + 1]
      let needSpawn = !initialized[i]

      if (!needSpawn) {
        z += spd * dt
        if (x * x + z * z > r2) needSpawn = true
      }

      if (needSpawn) {
        let placed = false
        for (let tries = 0; tries < 6; tries++) {
          let cx: number, cz: number
          if (initialized[i]) {
            const halfX = r - 0.1
            cx = (Math.random() * 2 - 1) * halfX
            const zMax = Math.sqrt(Math.max(0, r2 - cx * cx))
            cz = spawnSign * (zMax - Math.random() * edgeBand)
          } else {
            const t = Math.random() * Math.PI * 2
            const rr = Math.sqrt(Math.random()) * r
            cx = Math.cos(t) * rr
            cz = Math.sin(t) * rr
          }
          if (occ.isBlocked(cx, cz, cfg.blockedBy, cfg.avoidWalkCorridor)) continue
          x = cx
          z = cz
          placed = true
          break
        }
        if (!placed) continue
        positions[i * 2] = x
        positions[i * 2 + 1] = z
        const s = cfg.scaleMin + Math.random() * Math.max(0, cfg.scaleMax - cfg.scaleMin)
        scales[i] = s
        rotations[i] = cfg.rotateRandom ? Math.random() * Math.PI * 2 : 0
        const vc = Math.max(1, cfg.variantCount)
        variants[i] = cfg.variantWeights && cfg.variantWeights.length === vc
          ? pickWeighted(cfg.variantWeights)
          : Math.floor(Math.random() * vc)
        initialized[i] = 1
      } else {
        positions[i * 2 + 1] = z
      }

      const v = variants[i]
      const mesh = meshes[v]
      if (!mesh) continue
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, rotations[i], 0)
      dummy.scale.setScalar(scales[i])
      dummy.updateMatrix()
      const slot = counters[v]
      mesh.setMatrixAt(slot, dummy.matrix)
      counters[v] = slot + 1
    }

    for (let v = 0; v < meshes.length; v++) {
      const mesh = meshes[v]
      if (!mesh) continue
      mesh.count = counters[v]
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return useMemo<ScatterPoolHandle>(() => ({ meshRefs }), [meshRefs])
}
