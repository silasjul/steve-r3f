'use client'

import { useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { useControls, folder } from 'leva'
import { InstancedMesh } from 'three'
import { PLANE_GEOMETRY, useSharedPixelMaterial } from '@/components/blocks/_block'
import { getTileCountRect } from '@/components/environments/_ground'
import { poolControlsSchema, spawnZoneControlsSchema } from './_use-pool-controls'
import { useScatterPool } from './_use-scatter-pool'
import { useScatterDefaults, useEnvLabel, useEnvConfig } from '@/components/environments/_env-config'

useTexture.preload('/textures/nether_quartz_ore.png')

const POOL_NAME = 'netherCeilingQuartz'
const MAX_DENSITY = 0.25
const ZONE_DEFAULTS = { width: 80, forwardDepth: 60, backDepth: 60 }
const CAPACITY = Math.max(64, Math.ceil(getTileCountRect(ZONE_DEFAULTS.width, ZONE_DEFAULTS.forwardDepth, ZONE_DEFAULTS.backDepth) * MAX_DENSITY))

// Face-down plane — visible from below, flush against the ceiling underside.
const CEILING_GEOMETRY = PLANE_GEOMETRY.clone().rotateX(Math.PI / 2)

export default function NetherCeilingQuartzScatter() {
  const defaults = useScatterDefaults('netherCeilingQuartz')
  const envLabel = useEnvLabel()
  const envConfig = useEnvConfig()
  const roofHeight = envConfig.scene.roof?.height ?? 12
  const roofTint = envConfig.scene.roof?.tint

  const material = useSharedPixelMaterial('/textures/nether_quartz_ore.png', { tint: roofTint })

  const controlValues = useControls(envLabel, {
    Tiles: folder(
      {
        CeilingQuartz: folder(
          {
            ...poolControlsSchema(defaults.pool),
            cluster: { value: defaults.cluster, min: 0, max: 1, step: 0.01, label: 'Cluster' },
            'Spawn Zone': folder(spawnZoneControlsSchema(ZONE_DEFAULTS), { collapsed: true }),
          },
          { collapsed: true }
        ),
      },
      { collapsed: true }
    ),
  }) as Record<string, number | boolean>

  const model = useMemo(
    () => ({
      offsetX: 0,
      offsetY: roofHeight - 0.001,
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

  const meshesRef = useRef<(InstancedMesh | null)[]>([])

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
    selfAvoidFactor: 1.0,
    snapToGrid: true,
    clusterBias: controlValues.cluster as number,
    clusterSize: 5,
    registerAsOccupier: false,
    meshesRef,
    spawnZone: { width: spawnWidth, forwardDepth: spawnForward, backDepth: spawnBack },
    model,
  })

  return (
    <instancedMesh
      ref={(node) => { meshesRef.current[0] = node }}
      args={[CEILING_GEOMETRY, material, CAPACITY]}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
      dispose={null}
    />
  )
}
