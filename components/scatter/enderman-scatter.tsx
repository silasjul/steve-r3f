'use client'

import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useControls, folder } from 'leva'
import { BufferGeometry, Color, InstancedMesh, type Material, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { getTileCountRect } from '@/components/environments/_ground'
import { poolControlsSchema, spawnZoneControlsSchema } from './_use-pool-controls'
import { modelControlsSchema } from './_use-model-controls'
import { useScatterPool } from './_use-scatter-pool'
import { useScatterDefaults, useEnvLabel } from '@/components/environments/_env-config'

useGLTF.preload('/models/enderman.glb')

const POOL_NAME = 'endermen'
const MAX_DENSITY = 0.03
const ZONE_DEFAULTS = { width: 40, forwardDepth: 40, backDepth: 40 }
const CAPACITY = Math.max(8, Math.ceil(getTileCountRect(ZONE_DEFAULTS.width, ZONE_DEFAULTS.forwardDepth, ZONE_DEFAULTS.backDepth) * MAX_DENSITY))

interface SubMesh {
  geometry: BufferGeometry
  material: Material
}

// The enderman is a single textured mesh: a near-black body with bright eye
// pixels baked into the colour map. Reusing that map as an emissiveMap makes
// only the bright pixels self-illuminate (the black body emits ~nothing), and
// toneMapped=false keeps the eye pixels above the scene's Bloom threshold so the
// EffectComposer lights them up. Bump this to make the glow stronger.
const EYE_GLOW_INTENSITY = 0.6

function withGlowingEyes(mat: Material): Material {
  const std = mat as MeshStandardMaterial
  if (!std.isMeshStandardMaterial || !std.map) return mat
  const out = std.clone()
  out.emissiveMap = std.map
  out.emissive = new Color(0xffffff)
  out.emissiveIntensity = EYE_GLOW_INTENSITY
  out.toneMapped = false
  out.needsUpdate = true
  return out
}

function useEndermanSubMeshes(): SubMesh[] {
  const { scene } = useGLTF('/models/enderman.glb')
  return useMemo(() => {
    const out: SubMesh[] = []
    scene.updateMatrixWorld(true)
    scene.traverse((obj: Object3D) => {
      const m = obj as Mesh
      if (!m.isMesh) return
      const geom = m.geometry.clone()
      geom.applyMatrix4(m.matrixWorld)
      const mat = Array.isArray(m.material) ? m.material[0] : m.material
      out.push({ geometry: geom, material: withGlowingEyes(mat) })
    })
    return out
  }, [scene])
}

interface EndermanScatterProps {
  /** When true, every enderman's yaw is locked onto Steve at the origin. */
  faceSteve?: boolean
}

export default function EndermanScatter({ faceSteve = false }: EndermanScatterProps = {}) {
  const subMeshes = useEndermanSubMeshes()
  const defaults = useScatterDefaults('endermen')
  const envLabel = useEnvLabel()

  const pool = useControls(envLabel, {
    Tiles: folder(
      {
        Endermen: folder(
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
      { Enderman: folder(modelControlsSchema(defaults.model), { collapsed: true }) },
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
    blockedBy: ['trees', 'rocks', 'obsidianTowers'],
    avoidWalkCorridor: pool.avoidWalkCorridor as boolean,
    scaleMin: pool.scaleMin as number,
    scaleMax: pool.scaleMax as number,
    rotateRandom: pool.rotateRandom as boolean,
    faceOrigin: faceSteve,
    meshCount: subMeshes.length,
    variantCount: 1,
    fanAllMeshes: true,
    selfAvoidFactor: 1.8,
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
