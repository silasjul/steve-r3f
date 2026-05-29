'use client'

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useControls, folder } from 'leva'
import { PLANE_GEOMETRY, useSharedPixelMaterial } from '@/components/blocks/_block'
import { MAX_TILE_COUNT, getTileCount } from '@/components/environments/_ground'
import { poolControlsSchema } from './_use-pool-controls'
import { useScatterPool } from './_use-scatter-pool'
import { useScatterWorld } from './_scatter-context'
import { useScatterDefaults, useEnvLabel } from '@/components/environments/_env-config'

useTexture.preload('/textures/stone.png')
useTexture.preload('/textures/coal_ore.png')

const POOL_NAME = 'rocks'
const MAX_DENSITY = 0.25
const CAPACITY = Math.max(64, Math.ceil(MAX_TILE_COUNT * MAX_DENSITY))

// Bake the floor rotation into the geometry once so per-instance matrices only
// need a Y rotation (matching how the scatter pool composes transforms).
const FLOOR_GEOMETRY = PLANE_GEOMETRY.clone().rotateX(-Math.PI / 2)

export default function RockScatter() {
  const { radius } = useScatterWorld()
  const defaults = useScatterDefaults('rocks')
  const envLabel = useEnvLabel()

  const stoneMaterial = useSharedPixelMaterial('/textures/stone.png')
  const coalMaterial = useSharedPixelMaterial('/textures/coal_ore.png')

  const controlValues = useControls(envLabel, {
    Tiles: folder(
      {
        Rocks: folder(
          {
            ...poolControlsSchema(defaults.pool),
            coalWeight: { value: defaults.coalWeight, min: 0, max: 1, step: 0.01, label: 'Coal Share' },
            cluster: { value: defaults.cluster, min: 0, max: 1, step: 0.01, label: 'Cluster' },
          },
          { collapsed: true }
        ),
      },
      { collapsed: true }
    ),
  }) as Record<string, number | boolean>

  const coalWeight = controlValues.coalWeight as number
  const variantWeights = useMemo(
    () => [1 - coalWeight, coalWeight],
    [coalWeight]
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

  const targetCount = Math.min(
    CAPACITY,
    Math.floor((controlValues.density as number) * getTileCount(radius))
  )

  const handle = useScatterPool({
    name: POOL_NAME,
    capacity: CAPACITY,
    targetCount,
    footprint: controlValues.footprint as number,
    blockedBy: ['trees'],
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
    // Stone+coal patches read as small tile clumps — batch recycles so a fresh
    // patch lands at the leading edge as one unit instead of trickling in.
    clusterSize: 12,
    registerAsOccupier: true,
    model,
  })

  return (
    <>
      <instancedMesh
        ref={handle.meshRefs[0]}
        args={[FLOOR_GEOMETRY, stoneMaterial, CAPACITY]}
        castShadow={false}
        receiveShadow
        frustumCulled={false}
        dispose={null}
      />
      <instancedMesh
        ref={handle.meshRefs[1]}
        args={[FLOOR_GEOMETRY, coalMaterial, CAPACITY]}
        castShadow={false}
        receiveShadow
        frustumCulled={false}
        dispose={null}
      />
    </>
  )
}
