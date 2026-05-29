'use client'

import { useCallback, useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { useControls, folder } from 'leva'
import {
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  Object3D,
  type PointLight,
} from 'three'
import { PLANE_GEOMETRY, useSharedPixelMaterial } from '@/components/blocks/_block'
import { getTileCountRect } from '@/components/environments/_ground'
import { poolControlsSchema, spawnZoneControlsSchema } from './_use-pool-controls'
import { useScatterPool } from './_use-scatter-pool'
import {
  useEnvConfig,
  useScatterDefaults,
  useEnvLabel,
} from '@/components/environments/_env-config'
import type { ScatterPoolFrameState } from './_scatter-types'

useTexture.preload('/textures/glowstone.png')

const POOL_NAME = 'glowstone'
const MAX_DENSITY = 0.08
const ZONE_DEFAULTS = { width: 80, forwardDepth: 35, backDepth: 35 }
const CAPACITY = Math.max(64, Math.ceil(getTileCountRect(ZONE_DEFAULTS.width, ZONE_DEFAULTS.forwardDepth, ZONE_DEFAULTS.backDepth) * MAX_DENSITY))
const MAX_LIGHTS = 16
const FACE_COUNT = 6
const MAX_FACE_INSTANCES = CAPACITY * FACE_COUNT

/** Face-adjacent neighbour offsets for culling internal quads. */
const FACE_NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
]

/** Local transform for each exposed face quad (centered on block origin). */
const FACE_TRANSFORMS: ReadonlyArray<{
  ox: number
  oy: number
  oz: number
  rotX: number
  rotY: number
  rotZ: number
}> = [
    { ox: 0, oy: 0.5, oz: 0, rotX: -Math.PI / 2, rotY: 0, rotZ: 0 },
    { ox: 0, oy: -0.5, oz: 0, rotX: Math.PI / 2, rotY: 0, rotZ: 0 },
    { ox: 0.5, oy: 0, oz: 0, rotX: 0, rotY: Math.PI / 2, rotZ: 0 },
    { ox: -0.5, oy: 0, oz: 0, rotX: 0, rotY: -Math.PI / 2, rotZ: 0 },
    { ox: 0, oy: 0, oz: 0.5, rotX: 0, rotY: 0, rotZ: 0 },
    { ox: 0, oy: 0, oz: -0.5, rotX: 0, rotY: Math.PI, rotZ: 0 },
  ]

const faceDummy = new Object3D()
const faceEuler = new Euler()

function cellKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`
}

export default function GlowstoneScatter() {
  const defaults = useScatterDefaults('glowstone')
  const envLabel = useEnvLabel()
  const envConfig = useEnvConfig()
  const roofHeight = envConfig.scene.roof?.height ?? 12

  const material = useSharedPixelMaterial('/textures/glowstone.png', {
    emissive: '#ffcc55',
    emissiveIntensity: 1.5,
  })

  const controlValues = useControls(envLabel, {
    Tiles: folder(
      {
        Glowstone: folder(
          {
            ...poolControlsSchema(defaults.pool),
            cluster: { value: defaults.cluster, min: 0, max: 1, step: 0.01, label: 'Cluster' },
            verticalSpread: {
              value: defaults.verticalSpread,
              min: 0,
              max: 8,
              step: 1,
              label: 'Hang Depth',
            },
            'Spawn Zone': folder(spawnZoneControlsSchema(ZONE_DEFAULTS), { collapsed: true }),
          },
          { collapsed: true }
        ),
      },
      { collapsed: true }
    ),
    Lighting: folder(
      {
        glowstoneLightCount: {
          value: defaults.light.count,
          min: 0,
          max: MAX_LIGHTS,
          step: 1,
          label: 'Glowstone Lights',
        },
        glowstoneLightIntensity: {
          value: defaults.light.intensity,
          min: 0,
          max: 50,
          step: 0.1,
          label: 'Glow Intensity',
        },
        glowstoneLightDistance: {
          value: defaults.light.distance,
          min: 1,
          max: 60,
          step: 0.5,
          label: 'Glow Distance',
        },
        glowstoneLightColor: {
          value: defaults.light.color,
          label: 'Glow Color',
        },
      },
      { collapsed: true }
    ),
  }) as Record<string, number | boolean | string>

  const lightCount = Math.min(MAX_LIGHTS, controlValues.glowstoneLightCount as number)
  const lightIntensity = controlValues.glowstoneLightIntensity as number
  const lightDistance = controlValues.glowstoneLightDistance as number
  const lightColor = controlValues.glowstoneLightColor as string
  const verticalSpread = controlValues.verticalSpread as number

  const model = useMemo(
    () => ({
      offsetX: 0,
      offsetY: roofHeight - 0.5,
      offsetZ: 0,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      scale: 1,
    }),
    [roofHeight]
  )

  const spawnWidth = controlValues.spawnWidth as number
  const spawnForward = controlValues.spawnForward as number
  const spawnBack = controlValues.spawnBack as number

  const targetCount = Math.min(
    CAPACITY,
    Math.floor((controlValues.density as number) * getTileCountRect(spawnWidth, spawnForward, spawnBack))
  )

  const lightRefs = useRef<(PointLight | null)[]>([])
  const faceMeshRefs = useRef<(InstancedMesh | null)[]>([])
  const nearestIdx = useRef<Int32Array>(new Int32Array(MAX_LIGHTS))
  const nearestDist = useRef<Float32Array>(new Float32Array(MAX_LIGHTS))
  const occupiedScratch = useRef<Set<string>>(new Set())

  const onAfterFrame = useCallback(
    (state: ScatterPoolFrameState) => {
      const { positions, heights, initialized, capacity } = state
      const baseY = roofHeight - 0.5
      const occupied = occupiedScratch.current
      occupied.clear()

      for (let i = 0; i < capacity; i++) {
        if (!initialized[i]) continue
        occupied.add(cellKey(positions[i * 2], heights[i], positions[i * 2 + 1]))
      }

      const faceCounts = new Array<number>(FACE_COUNT).fill(0)

      for (let i = 0; i < capacity; i++) {
        if (!initialized[i]) continue
        const bx = positions[i * 2]
        const by = heights[i]
        const bz = positions[i * 2 + 1]

        for (let f = 0; f < FACE_COUNT; f++) {
          const [dx, dy, dz] = FACE_NEIGHBORS[f]
          if (occupied.has(cellKey(bx + dx, by + dy, bz + dz))) continue
          // Top face sits flush against the netherrack ceiling — never visible.
          if (by === 0 && dy === 1) continue

          const t = FACE_TRANSFORMS[f]
          faceEuler.set(t.rotX, t.rotY, t.rotZ)
          faceDummy.position.set(bx + t.ox, baseY + by + t.oy, bz + t.oz)
          faceDummy.rotation.copy(faceEuler)
          faceDummy.scale.setScalar(1)
          faceDummy.updateMatrix()

          const mesh = faceMeshRefs.current[f]
          if (!mesh) continue
          mesh.setMatrixAt(faceCounts[f], faceDummy.matrix)
          faceCounts[f]++
        }
      }

      for (let f = 0; f < FACE_COUNT; f++) {
        const mesh = faceMeshRefs.current[f]
        if (!mesh) continue
        mesh.count = faceCounts[f]
        mesh.instanceMatrix.needsUpdate = true
      }

      const lights = lightRefs.current
      const idx = nearestIdx.current
      const dist = nearestDist.current
      const want = Math.min(lightCount, lights.length)

      let filled = 0
      for (let i = 0; i < capacity; i++) {
        if (!initialized[i]) continue
        const x = positions[i * 2]
        const z = positions[i * 2 + 1]
        const d2 = x * x + z * z
        if (filled < want) {
          idx[filled] = i
          dist[filled] = d2
          filled++
          continue
        }
        let worst = 0
        for (let k = 1; k < want; k++) if (dist[k] > dist[worst]) worst = k
        if (d2 < dist[worst]) {
          idx[worst] = i
          dist[worst] = d2
        }
      }

      for (let k = 0; k < want; k++) {
        const light = lights[k]
        if (!light) continue
        if (k < filled) {
          const i = idx[k]
          light.position.set(
            positions[i * 2],
            baseY + heights[i],
            positions[i * 2 + 1]
          )
          light.visible = true
        } else {
          light.visible = false
        }
      }
      for (let k = want; k < lights.length; k++) {
        const light = lights[k]
        if (light) light.visible = false
      }
    },
    [lightCount, roofHeight]
  )

  useScatterPool({
    name: POOL_NAME,
    capacity: CAPACITY,
    targetCount,
    footprint: controlValues.footprint as number,
    blockedBy: [],
    avoidWalkCorridor: false,
    scaleMin: controlValues.scaleMin as number,
    scaleMax: controlValues.scaleMax as number,
    rotateRandom: controlValues.rotateRandom as boolean,
    meshCount: 1,
    variantCount: 1,
    selfAvoidFactor: 0,
    snapToGrid: true,
    clusterBias: controlValues.cluster as number,
    // Glowstone formations are mostly stalactite chunks of ~6-10 blocks. Wait
    // for a full chunk's worth of recycles before placing so each new cluster
    // appears at the leading edge intact rather than as drifting singletons.
    clusterSize: 8,
    verticalSpread,
    suppressMeshOutput: true,
    registerAsOccupier: false,
    spawnZone: { width: spawnWidth, forwardDepth: spawnForward, backDepth: spawnBack },
    model,
    onAfterFrame,
  })

  return (
    <>
      {Array.from({ length: FACE_COUNT }, (_, f) => (
        <instancedMesh
          key={f}
          ref={(node) => {
            faceMeshRefs.current[f] = node
            if (node) node.instanceMatrix.setUsage(DynamicDrawUsage)
          }}
          args={[PLANE_GEOMETRY, material, MAX_FACE_INSTANCES]}
          castShadow
          receiveShadow={false}
          frustumCulled={false}
          dispose={null}
        />
      ))}
      {Array.from({ length: MAX_LIGHTS }, (_, k) => (
        <pointLight
          key={k}
          ref={(node) => {
            lightRefs.current[k] = node
          }}
          color={lightColor}
          intensity={k < lightCount ? lightIntensity : 0}
          distance={lightDistance}
          decay={2}
          castShadow={false}
        />
      ))}
    </>
  )
}
