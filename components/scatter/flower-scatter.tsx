'use client'

import { useMemo, useRef } from 'react'
import { useControls, folder } from 'leva'
import { DoubleSide, InstancedMesh, MeshStandardMaterial, type MeshDepthMaterial } from 'three'
import {
  getOrCreateMaterial,
  usePixelTexture,
} from '@/components/blocks/_block'
import { getTileCountRect } from '@/components/environments/_ground'
import { getCrossPlaneGeometry } from './_cross-plane-geometry'
import { poolControlsSchema, spawnZoneControlsSchema } from './_use-pool-controls'
import { useScatterPool } from './_use-scatter-pool'
import { applyWindShader, createWindDepthMaterial } from '@/components/wind'
import { useScatterDefaults, useEnvLabel } from '@/components/environments/_env-config'

const POOL_NAME = 'flowers'
const MAX_DENSITY = 2
const ZONE_DEFAULTS = { width: 40, forwardDepth: 25, backDepth: 25 }
const CAPACITY = Math.ceil(getTileCountRect(ZONE_DEFAULTS.width, ZONE_DEFAULTS.forwardDepth, ZONE_DEFAULTS.backDepth) * MAX_DENSITY)

const FLOWER_VARIANTS = [
  { key: 'poppy', label: 'Poppy', texture: '/textures/poppy.png' },
  { key: 'oxeye_daisy', label: 'Oxeye Daisy', texture: '/textures/oxeye_daisy.png' },
  { key: 'white_tulip', label: 'White Tulip', texture: '/textures/white_tulip.png' },
  { key: 'orange_tulip', label: 'Orange Tulip', texture: '/textures/orange_tulip.png' },
  { key: 'pink_tulip', label: 'Pink Tulip', texture: '/textures/pink_tulip.png' },
  { key: 'red_tulip', label: 'Red Tulip', texture: '/textures/red_tulip.png' },
] as const

function useFlowerMaterial(
  path: string,
  key: string,
): { material: MeshStandardMaterial; depthMaterial: MeshDepthMaterial } {
  const tex = usePixelTexture(path)
  return useMemo(() => {
    const m = getOrCreateMaterial(
      `flower:${key}`,
      () =>
        new MeshStandardMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.5,
          side: DoubleSide,
        })
    )
    applyWindShader(m)
    return { material: m, depthMaterial: createWindDepthMaterial(tex) }
  }, [tex, key])
}

export default function FlowerScatter() {
  const geometry = useMemo(() => getCrossPlaneGeometry(), [])
  const defaults = useScatterDefaults('flowers')
  const envLabel = useEnvLabel()

  const flowerMaterials = [
    useFlowerMaterial(FLOWER_VARIANTS[0].texture, FLOWER_VARIANTS[0].key),
    useFlowerMaterial(FLOWER_VARIANTS[1].texture, FLOWER_VARIANTS[1].key),
    useFlowerMaterial(FLOWER_VARIANTS[2].texture, FLOWER_VARIANTS[2].key),
    useFlowerMaterial(FLOWER_VARIANTS[3].texture, FLOWER_VARIANTS[3].key),
    useFlowerMaterial(FLOWER_VARIANTS[4].texture, FLOWER_VARIANTS[4].key),
    useFlowerMaterial(FLOWER_VARIANTS[5].texture, FLOWER_VARIANTS[5].key),
  ]

  const weightExtras = useMemo(
    () =>
      FLOWER_VARIANTS.reduce<Record<string, { value: number; min: number; max: number; step: number; label: string }>>(
        (acc, v) => {
          acc[`w_${v.key}`] = {
            value: defaults.weights[v.key],
            min: 0,
            max: 5,
            step: 0.1,
            label: v.label,
          }
          return acc
        },
        {}
      ),
    [defaults.weights]
  )

  const controlValues = useControls(envLabel, {
    Tiles: folder(
      {
        Flowers: folder(
          {
            ...poolControlsSchema(defaults.pool),
            ...weightExtras,
            'Spawn Zone': folder(spawnZoneControlsSchema(ZONE_DEFAULTS), { collapsed: true }),
          },
          { collapsed: true }
        ),
      },
      { collapsed: true }
    ),
  }) as Record<string, number | boolean>

  const variantWeights = useMemo(
    () => FLOWER_VARIANTS.map((v) => Number(controlValues[`w_${v.key}`] ?? 1)),
    [controlValues]
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
    blockedBy: ['trees', 'rocks'],
    avoidWalkCorridor: controlValues.avoidWalkCorridor as boolean,
    scaleMin: controlValues.scaleMin as number,
    scaleMax: controlValues.scaleMax as number,
    rotateRandom: controlValues.rotateRandom as boolean,
    meshCount: FLOWER_VARIANTS.length,
    variantCount: FLOWER_VARIANTS.length,
    variantWeights,
    meshesRef,
    spawnZone: { width: spawnWidth, forwardDepth: spawnForward, backDepth: spawnBack },
  })

  return (
    <>
      {FLOWER_VARIANTS.map((v, i) => (
        <instancedMesh
          key={v.key}
          ref={(node) => { meshesRef.current[i] = node }}
          args={[geometry, flowerMaterials[i].material, CAPACITY]}
          customDepthMaterial={flowerMaterials[i].depthMaterial}
          castShadow
          receiveShadow
          frustumCulled={false}
          dispose={null}
        />
      ))}
    </>
  )
}
