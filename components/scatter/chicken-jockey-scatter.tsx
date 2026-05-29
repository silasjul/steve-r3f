'use client'

import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useControls, folder } from 'leva'
import { BufferGeometry, InstancedMesh, type Material, Mesh, Object3D } from 'three'
import { getTileCountRect } from '@/components/environments/_ground'
import { poolControlsSchema, spawnZoneControlsSchema } from './_use-pool-controls'
import { modelControlsSchema } from './_use-model-controls'
import { useScatterPool } from './_use-scatter-pool'
import { useScatterDefaults, useEnvLabel } from '@/components/environments/_env-config'

useGLTF.preload('/models/chicken_jockey.glb')

const POOL_NAME = 'chicken_jockeys'
const MAX_DENSITY = 0.03
const ZONE_DEFAULTS = { width: 18, forwardDepth: 28, backDepth: 18 }
const CAPACITY = Math.max(8, Math.ceil(getTileCountRect(ZONE_DEFAULTS.width, ZONE_DEFAULTS.forwardDepth, ZONE_DEFAULTS.backDepth) * MAX_DENSITY))

interface SubMesh {
  geometry: BufferGeometry
  material: Material
}

function useChickenJockeySubMeshes(): SubMesh[] {
  const { scene } = useGLTF('/models/chicken_jockey.glb')
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

export default function ChickenJockeyScatter() {
  const subMeshes = useChickenJockeySubMeshes()
  const defaults = useScatterDefaults('chickenJockeys')
  const envLabel = useEnvLabel()

  const pool = useControls(envLabel, {
    Tiles: folder(
      {
        ChickenJockeys: folder(
          {
            ...poolControlsSchema(defaults.pool),
            'Spawn Zone': folder(spawnZoneControlsSchema(ZONE_DEFAULTS), { collapsed: true }),
          },
          { collapsed: true }
        ),
      },
      { collapsed: true }
    ),
  })

  const model = useControls(envLabel, {
    Models: folder(
      { ChickenJockey: folder(modelControlsSchema(defaults.model), { collapsed: true }) },
      { collapsed: true }
    ),
  })

  const targetCount = Math.min(
    CAPACITY,
    Math.floor((pool.density as number) * getTileCountRect(pool.spawnWidth as number, pool.spawnForward as number, pool.spawnBack as number))
  )

  const meshesRef = useRef<(InstancedMesh | null)[]>([])

  useScatterPool({
    name: POOL_NAME,
    capacity: CAPACITY,
    targetCount,
    footprint: pool.footprint as number,
    blockedBy: ['trees', 'rocks'],
    avoidWalkCorridor: pool.avoidWalkCorridor as boolean,
    scaleMin: pool.scaleMin as number,
    scaleMax: pool.scaleMax as number,
    rotateRandom: pool.rotateRandom as boolean,
    meshCount: subMeshes.length,
    variantCount: 1,
    fanAllMeshes: true,
    selfAvoidFactor: 1.5,
    meshesRef,
    spawnZone: { width: pool.spawnWidth as number, forwardDepth: pool.spawnForward as number, backDepth: pool.spawnBack as number },
    model,
  })

  return (
    <>
      {subMeshes.map((sm, i) => (
        <instancedMesh
          key={i}
          ref={(node) => { meshesRef.current[i] = node }}
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
