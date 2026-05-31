'use client'

import { useMemo, useRef } from 'react'
import { useControls, folder } from 'leva'
import { DoubleSide, InstancedMesh, MeshStandardMaterial } from 'three'
import { getOrCreateMaterial, usePixelTexture } from '@/components/blocks/_block'
import { getTileCountRect } from '@/components/environments/_ground'
import { getCrossPlaneGeometry } from './_cross-plane-geometry'
import { spawnZoneControlsSchema } from './_use-pool-controls'
import { useScatterPool } from './_use-scatter-pool'
import { applyWindShader, createWindDepthMaterial } from '@/components/wind'
import { useScatterDefaults, useEnvLabel } from '@/components/environments/_env-config'

const MAX_DENSITY = 2
const ZONE_DEFAULTS = { width: 43, forwardDepth: 28, backDepth: 28 }
const CAPACITY = Math.ceil(
  getTileCountRect(ZONE_DEFAULTS.width, ZONE_DEFAULTS.forwardDepth, ZONE_DEFAULTS.backDepth) * MAX_DENSITY,
)

const SHORT_Y_OFFSET = -0.01
const TALL_Y_OFFSET = -0.01

export default function DryGrassScatter() {
  const shortTex = usePixelTexture('/textures/short_dry_grass.png')
  const tallTex = usePixelTexture('/textures/tall_dry_grass.png')
  const geometry = useMemo(() => getCrossPlaneGeometry(), [])

  const shortMat = useMemo(() => {
    const m = getOrCreateMaterial(
      'dry-grass-short',
      () => new MeshStandardMaterial({ map: shortTex, transparent: true, alphaTest: 0.5, side: DoubleSide }),
    )
    applyWindShader(m)
    return m
  }, [shortTex])
  const shortDepthMat = useMemo(() => createWindDepthMaterial(shortTex), [shortTex])

  const tallMat = useMemo(() => {
    const m = getOrCreateMaterial(
      'dry-grass-tall',
      () => new MeshStandardMaterial({ map: tallTex, transparent: true, alphaTest: 0.5, side: DoubleSide }),
    )
    applyWindShader(m)
    return m
  }, [tallTex])
  const tallDepthMat = useMemo(() => createWindDepthMaterial(tallTex), [tallTex])

  const defaults = useScatterDefaults('dryGrass')
  const envLabel = useEnvLabel()

  const controls = useControls(envLabel, {
    Tiles: folder(
      {
        'Dry Grass': folder(
          {
            shortDensity: { value: defaults.short.density, min: 0, max: 2, step: 0.001, label: 'Short Density' },
            shortScaleMin: { value: defaults.short.scaleMin, min: 0.05, max: 3, step: 0.01, label: 'Short Scale Min' },
            shortScaleMax: { value: defaults.short.scaleMax, min: 0.05, max: 3, step: 0.01, label: 'Short Scale Max' },
            tallDensity: { value: defaults.tall.density, min: 0, max: 2, step: 0.001, label: 'Tall Density' },
            tallScaleMin: { value: defaults.tall.scaleMin, min: 0.05, max: 3, step: 0.01, label: 'Tall Scale Min' },
            tallScaleMax: { value: defaults.tall.scaleMax, min: 0.05, max: 3, step: 0.01, label: 'Tall Scale Max' },
            avoidWalkCorridor: { value: defaults.short.avoidWalkCorridor, label: 'Avoid Corridor' },
            footprint: { value: defaults.short.footprint, min: 0, max: 4, step: 0.05, label: 'Footprint' },
            'Spawn Zone': folder(spawnZoneControlsSchema(ZONE_DEFAULTS), { collapsed: true }),
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
    ),
  })

  const spawnWidth = controls.spawnWidth as number
  const spawnForward = controls.spawnForward as number
  const spawnBack = controls.spawnBack as number
  const avoidWalkCorridor = controls.avoidWalkCorridor as boolean
  const footprint = controls.footprint as number
  const tileCount = getTileCountRect(spawnWidth, spawnForward, spawnBack)

  const shortTargetCount = Math.min(CAPACITY, Math.floor((controls.shortDensity as number) * tileCount))
  const tallTargetCount = Math.min(CAPACITY, Math.floor((controls.tallDensity as number) * tileCount))

  const shortModel = useMemo(() => ({ offsetX: 0, offsetY: SHORT_Y_OFFSET, offsetZ: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 }), [])
  const tallModel = useMemo(() => ({ offsetX: 0, offsetY: TALL_Y_OFFSET, offsetZ: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 }), [])

  const shortMeshesRef = useRef<(InstancedMesh | null)[]>([])
  const tallMeshesRef = useRef<(InstancedMesh | null)[]>([])

  useScatterPool({
    name: 'dry-grass-short',
    capacity: CAPACITY,
    targetCount: shortTargetCount,
    footprint,
    blockedBy: ['temples', 'cacti'],
    avoidWalkCorridor,
    scaleMin: controls.shortScaleMin as number,
    scaleMax: controls.shortScaleMax as number,
    rotateRandom: true,
    meshCount: 1,
    variantCount: 1,
    meshesRef: shortMeshesRef,
    spawnZone: { width: spawnWidth, forwardDepth: spawnForward, backDepth: spawnBack },
    model: shortModel,
  })

  useScatterPool({
    name: 'dry-grass-tall',
    capacity: CAPACITY,
    targetCount: tallTargetCount,
    footprint,
    blockedBy: ['temples', 'cacti'],
    avoidWalkCorridor,
    scaleMin: controls.tallScaleMin as number,
    scaleMax: controls.tallScaleMax as number,
    rotateRandom: true,
    meshCount: 1,
    variantCount: 1,
    meshesRef: tallMeshesRef,
    spawnZone: { width: spawnWidth, forwardDepth: spawnForward, backDepth: spawnBack },
    model: tallModel,
  })

  return (
    <>
      <instancedMesh
        ref={(n) => { shortMeshesRef.current[0] = n }}
        args={[geometry, shortMat, CAPACITY]}
        customDepthMaterial={shortDepthMat}
        castShadow
        receiveShadow
        frustumCulled={false}
        dispose={null}
      />
      <instancedMesh
        ref={(n) => { tallMeshesRef.current[0] = n }}
        args={[geometry, tallMat, CAPACITY]}
        customDepthMaterial={tallDepthMat}
        castShadow
        receiveShadow
        frustumCulled={false}
        dispose={null}
      />
    </>
  )
}
