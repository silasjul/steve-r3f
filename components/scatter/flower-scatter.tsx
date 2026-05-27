'use client'

import { useMemo } from 'react'
import { useControls, folder } from 'leva'
import { DoubleSide, MeshStandardMaterial } from 'three'
import {
  getOrCreateMaterial,
  usePixelTexture,
} from '@/components/blocks/_block'
import { MAX_TILE_COUNT, getTileCount } from '@/components/environments/_ground'
import { getCrossPlaneGeometry } from './_cross-plane-geometry'
import { poolControlsSchema } from './_use-pool-controls'
import { useScatterPool } from './_use-scatter-pool'
import { useScatterWorld } from './_scatter-context'

const POOL_NAME = 'flowers'
const MAX_DENSITY = 2
const CAPACITY = MAX_TILE_COUNT * MAX_DENSITY

const FLOWER_VARIANTS = [
  { key: 'poppy', label: 'Poppy', texture: '/textures/poppy.png' },
  { key: 'oxeye_daisy', label: 'Oxeye Daisy', texture: '/textures/oxeye_daisy.png' },
  { key: 'white_tulip', label: 'White Tulip', texture: '/textures/white_tulip.png' },
  { key: 'orange_tulip', label: 'Orange Tulip', texture: '/textures/orange_tulip.png' },
  { key: 'pink_tulip', label: 'Pink Tulip', texture: '/textures/pink_tulip.png' },
  { key: 'red_tulip', label: 'Red Tulip', texture: '/textures/red_tulip.png' },
] as const

function useFlowerMaterial(path: string, key: string): MeshStandardMaterial {
  const tex = usePixelTexture(path)
  return useMemo(
    () =>
      getOrCreateMaterial(
        `flower:${key}`,
        () =>
          new MeshStandardMaterial({
            map: tex,
            transparent: true,
            alphaTest: 0.5,
            side: DoubleSide,
          })
      ),
    [tex, key]
  )
}

export default function FlowerScatter() {
  const geometry = useMemo(() => getCrossPlaneGeometry(), [])
  const { radius } = useScatterWorld()

  const materials = [
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
          acc[`w_${v.key}`] = { value: 1, min: 0, max: 5, step: 0.1, label: v.label }
          return acc
        },
        {}
      ),
    []
  )

  const controlValues = useControls('Tiles', {
    Flowers: folder(
      {
        ...poolControlsSchema({
          density: 0.1,
          scaleMin: 1.0,
          scaleMax: 1.0,
          rotateRandom: false,
          avoidWalkCorridor: false,
          footprint: 0.4,
        }),
        ...weightExtras,
      },
      { collapsed: true }
    ),
  }) as Record<string, number | boolean>

  const variantWeights = useMemo(
    () => FLOWER_VARIANTS.map((v) => Number(controlValues[`w_${v.key}`] ?? 1)),
    [controlValues]
  )

  const targetCount = Math.min(
    CAPACITY,
    Math.floor((controlValues.density as number) * getTileCount(radius))
  )

  const pool = useScatterPool({
    name: POOL_NAME,
    capacity: CAPACITY,
    targetCount,
    footprint: controlValues.footprint as number,
    blockedBy: ['trees'],
    avoidWalkCorridor: controlValues.avoidWalkCorridor as boolean,
    scaleMin: controlValues.scaleMin as number,
    scaleMax: controlValues.scaleMax as number,
    rotateRandom: controlValues.rotateRandom as boolean,
    variantCount: FLOWER_VARIANTS.length,
    variantWeights,
  })

  return (
    <>
      {FLOWER_VARIANTS.map((v, i) => (
        <instancedMesh
          key={v.key}
          ref={pool.meshRefs[i]}
          args={[geometry, materials[i], CAPACITY]}
          castShadow
          receiveShadow={false}
          frustumCulled={false}
          dispose={null}
        />
      ))}
    </>
  )
}
