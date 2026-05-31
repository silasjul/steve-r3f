'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useControls, folder } from 'leva'
import { DoubleSide, InstancedMesh, MeshStandardMaterial } from 'three'
import { getOrCreateMaterial, usePixelTexture } from '@/components/blocks/_block'
import { getTileCountRect } from '@/components/environments/_ground'
import { getCrossPlaneGeometry } from './_cross-plane-geometry'
import { poolControlsSchema, spawnZoneControlsSchema } from './_use-pool-controls'
import { useScatterPool } from './_use-scatter-pool'
import { applyWindShaderScaled, createWindDepthMaterialScaled } from '@/components/wind'
import { useScatterDefaults, useEnvLabel } from '@/components/environments/_env-config'

const POOL_NAME = 'deadBushes'
const MAX_DENSITY = 2
const ZONE_DEFAULTS = { width: 43, forwardDepth: 28, backDepth: 28 }
const CAPACITY = Math.ceil(
  getTileCountRect(ZONE_DEFAULTS.width, ZONE_DEFAULTS.forwardDepth, ZONE_DEFAULTS.backDepth) * MAX_DENSITY,
)

// Wind-scale uniform for the dead-bush material — lets it wave less than normal
// grass. Module-scoped because the material it patches is itself a global
// singleton (getOrCreateMaterial cache), so one shared uniform is correct. The
// leva slider writes through it from an effect (see below).
const windScaleUniform = { value: 0.3 }

export default function DeadBushScatter() {
  const tex = usePixelTexture('/textures/dead_bush.png')
  const geometry = useMemo(() => getCrossPlaneGeometry(), [])

  const material = useMemo(() => {
    const m = getOrCreateMaterial(
      'dead-bush-scatter',
      () => new MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: DoubleSide }),
    )
    applyWindShaderScaled(m, windScaleUniform)
    return m
  }, [tex])
  const depthMaterial = useMemo(() => createWindDepthMaterialScaled(tex, windScaleUniform), [tex])

  const defaults = useScatterDefaults('deadBushes')
  const envLabel = useEnvLabel()

  const controls = useControls(envLabel, {
    Tiles: folder(
      {
        'Dead Bushes': folder(
          {
            ...poolControlsSchema(defaults.pool),
            windScale: { value: 0.3, min: 0, max: 1, step: 0.01, label: 'Wind Scale' },
            'Spawn Zone': folder(spawnZoneControlsSchema(ZONE_DEFAULTS), { collapsed: true }),
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
    ),
  })

  // Push the leva wind-scale into the live shader uniform after commit.
  useEffect(() => {
    windScaleUniform.value = controls.windScale as number
  }, [controls.windScale])

  const targetCount = Math.min(
    CAPACITY,
    Math.floor((controls.density as number) * getTileCountRect(controls.spawnWidth as number, controls.spawnForward as number, controls.spawnBack as number)),
  )

  const model = useMemo(() => ({ offsetX: 0, offsetY: -0.01, offsetZ: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 }), [])
  const meshesRef = useRef<(InstancedMesh | null)[]>([])

  useScatterPool({
    name: POOL_NAME,
    capacity: CAPACITY,
    targetCount,
    footprint: controls.footprint as number,
    blockedBy: ['temples', 'cacti'],
    avoidWalkCorridor: controls.avoidWalkCorridor as boolean,
    scaleMin: controls.scaleMin as number,
    scaleMax: controls.scaleMax as number,
    rotateRandom: controls.rotateRandom as boolean,
    meshCount: 1,
    variantCount: 1,
    meshesRef,
    spawnZone: { width: controls.spawnWidth as number, forwardDepth: controls.spawnForward as number, backDepth: controls.spawnBack as number },
    model,
  })

  return (
    <instancedMesh
      ref={(n) => { meshesRef.current[0] = n }}
      args={[geometry, material, CAPACITY]}
      customDepthMaterial={depthMaterial}
      castShadow
      receiveShadow
      frustumCulled={false}
      dispose={null}
    />
  )
}
