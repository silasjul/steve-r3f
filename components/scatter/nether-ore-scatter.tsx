'use client'

import { useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { useControls, folder } from 'leva'
import { InstancedMesh } from 'three'
import { PLANE_GEOMETRY, useSharedPixelMaterial } from '@/components/blocks/_block'
import { getTileCountRect } from '@/components/environments/_ground'
import { poolControlsSchema, spawnZoneControlsSchema } from './_use-pool-controls'
import { useScatterPool } from './_use-scatter-pool'
import { useScatterDefaults, useEnvLabel } from '@/components/environments/_env-config'

useTexture.preload('/textures/nether_quartz_ore.png')
useTexture.preload('/textures/nether_gold_ore.png')

const POOL_NAME = 'netherOres'
const MAX_DENSITY = 0.25
const ZONE_DEFAULTS = { width: 40, forwardDepth: 25, backDepth: 25 }
const CAPACITY = Math.max(64, Math.ceil(getTileCountRect(ZONE_DEFAULTS.width, ZONE_DEFAULTS.forwardDepth, ZONE_DEFAULTS.backDepth) * MAX_DENSITY))

const FLOOR_GEOMETRY = PLANE_GEOMETRY.clone().rotateX(-Math.PI / 2)

export default function NetherOreScatter() {
  const defaults = useScatterDefaults('netherOres')
  const envLabel = useEnvLabel()

  const quartzMaterial = useSharedPixelMaterial('/textures/nether_quartz_ore.png')
  const goldMaterial = useSharedPixelMaterial('/textures/nether_gold_ore.png')

  const controlValues = useControls(envLabel, {
    Tiles: folder(
      {
        NetherOres: folder(
          {
            ...poolControlsSchema(defaults.pool),
            goldWeight: { value: defaults.goldWeight, min: 0, max: 1, step: 0.01, label: 'Gold Share' },
            cluster: { value: defaults.cluster, min: 0, max: 1, step: 0.01, label: 'Cluster' },
            'Spawn Zone': folder(spawnZoneControlsSchema(ZONE_DEFAULTS), { collapsed: true }),
          },
          { collapsed: true }
        ),
      },
      { collapsed: true }
    ),
  }) as Record<string, number | boolean>

  const goldWeight = controlValues.goldWeight as number
  const variantWeights = useMemo(
    () => [1 - goldWeight, goldWeight],
    [goldWeight]
  )

  const model = useMemo(
    () => ({
      offsetX: 0,
      offsetY: 0.001,
      offsetZ: 0,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      scale: 1,
    }),
    []
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
    blockedBy: ['lava'],
    avoidWalkCorridor: controlValues.avoidWalkCorridor as boolean,
    scaleMin: controlValues.scaleMin as number,
    scaleMax: controlValues.scaleMax as number,
    rotateRandom: controlValues.rotateRandom as boolean,
    meshCount: 2,
    variantCount: 2,
    variantWeights,
    selfAvoidFactor: 1.0,
    snapToGrid: true,
    clusterBias: controlValues.cluster as number,
    clusterSize: 8,
    registerAsOccupier: true,
    meshesRef,
    spawnZone: { width: spawnWidth, forwardDepth: spawnForward, backDepth: spawnBack },
    model,
  })

  return (
    <>
      <instancedMesh
        ref={(node) => { meshesRef.current[0] = node }}
        args={[FLOOR_GEOMETRY, quartzMaterial, CAPACITY]}
        castShadow={false}
        receiveShadow
        frustumCulled={false}
        dispose={null}
      />
      <instancedMesh
        ref={(node) => { meshesRef.current[1] = node }}
        args={[FLOOR_GEOMETRY, goldMaterial, CAPACITY]}
        castShadow={false}
        receiveShadow
        frustumCulled={false}
        dispose={null}
      />
    </>
  )
}
