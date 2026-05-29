'use client'

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useControls, folder } from 'leva'
import { BufferGeometry, type Material, Mesh, Object3D } from 'three'
import { MAX_TILE_COUNT, getTileCount } from '@/components/environments/_ground'
import { poolControlsSchema } from './_use-pool-controls'
import { modelControlsSchema } from './_use-model-controls'
import { useScatterPool } from './_use-scatter-pool'
import { useScatterWorld } from './_scatter-context'
import { useScatterDefaults, useEnvLabel } from '@/components/environments/_env-config'

useGLTF.preload('/models/pig.glb')

const POOL_NAME = 'pigs'
const MAX_DENSITY = 0.05
const CAPACITY = Math.max(8, Math.ceil(MAX_TILE_COUNT * MAX_DENSITY))

interface SubMesh {
  geometry: BufferGeometry
  material: Material
}

function usePigSubMeshes(): SubMesh[] {
  const { scene } = useGLTF('/models/pig.glb')
  return useMemo(() => {
    const out: SubMesh[] = []
    scene.updateMatrixWorld(true)
    scene.traverse((obj: Object3D) => {
      const m = obj as Mesh
      if (!m.isMesh) return
      const geom = m.geometry.clone()
      geom.applyMatrix4(m.matrixWorld)
      const mat = Array.isArray(m.material) ? m.material[0] : m.material
      out.push({ geometry: geom, material: mat })
    })
    return out
  }, [scene])
}

export default function PigScatter() {
  const subMeshes = usePigSubMeshes()
  const { radius } = useScatterWorld()
  const defaults = useScatterDefaults('pigs')
  const envLabel = useEnvLabel()

  const pool = useControls(envLabel, {
    Tiles: folder(
      { Pigs: folder(poolControlsSchema(defaults.pool), { collapsed: true }) },
      { collapsed: true }
    ),
  })

  const model = useControls(envLabel, {
    Models: folder(
      { Pig: folder(modelControlsSchema(defaults.model), { collapsed: true }) },
      { collapsed: true }
    ),
  })

  const targetCount = Math.min(
    CAPACITY,
    Math.floor((pool.density as number) * getTileCount(radius))
  )

  const handle = useScatterPool({
    name: POOL_NAME,
    capacity: CAPACITY,
    targetCount,
    footprint: pool.footprint as number,
    // Trees: block. Grass / flowers: pigs are allowed on top of them.
    blockedBy: ['trees'],
    avoidWalkCorridor: pool.avoidWalkCorridor as boolean,
    scaleMin: pool.scaleMin as number,
    scaleMax: pool.scaleMax as number,
    rotateRandom: pool.rotateRandom as boolean,
    meshCount: subMeshes.length,
    variantCount: 1,
    fanAllMeshes: true,
    selfAvoidFactor: 1.2,
    model,
  })

  return (
    <>
      {subMeshes.map((sm, i) => (
        <instancedMesh
          key={i}
          ref={handle.meshRefs[i]}
          args={[sm.geometry, sm.material, CAPACITY]}
          castShadow
          receiveShadow
          frustumCulled={false}
          dispose={null}
        />
      ))}
    </>
  )
}
