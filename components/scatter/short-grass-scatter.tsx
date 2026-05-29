'use client'

import { useMemo } from 'react'
import { useControls, folder } from 'leva'
import { DoubleSide, MeshStandardMaterial } from 'three'
import {
  getOrCreateMaterial,
  usePixelTexture,
} from '@/components/blocks/_block'
import { GRASS_TINT } from '@/components/blocks/grass-block'
import { MAX_TILE_COUNT, getTileCount } from '@/components/environments/_ground'
import { getCrossPlaneGeometry } from './_cross-plane-geometry'
import { poolControlsSchema } from './_use-pool-controls'
import { useScatterPool } from './_use-scatter-pool'
import { useScatterWorld } from './_scatter-context'
import { applyWindShader } from '@/components/wind'
import { useScatterDefaults, useEnvLabel } from '@/components/environments/_env-config'

const POOL_NAME = 'short-grass'
const MAX_DENSITY = 2
const CAPACITY = MAX_TILE_COUNT * MAX_DENSITY

export default function ShortGrassScatter() {
  const tex = usePixelTexture('/textures/short_grass.png')
  const material = useMemo(() => {
    const m = getOrCreateMaterial(
      'short-grass-scatter',
      () =>
        new MeshStandardMaterial({
          map: tex,
          color: GRASS_TINT,
          transparent: true,
          alphaTest: 0.5,
          side: DoubleSide,
        })
    )
    applyWindShader(m)
    return m
  }, [tex])
  const geometry = useMemo(() => getCrossPlaneGeometry(), [])
  const { radius } = useScatterWorld()
  const defaults = useScatterDefaults('shortGrass')
  const envLabel = useEnvLabel()

  const { density, scaleMin, scaleMax, rotateRandom, avoidWalkCorridor, footprint } =
    useControls(envLabel, {
      Tiles: folder(
        { 'Short Grass': folder(poolControlsSchema(defaults.pool), { collapsed: true }) },
        { collapsed: true }
      ),
    })

  const targetCount = Math.min(CAPACITY, Math.floor((density as number) * getTileCount(radius)))

  const pool = useScatterPool({
    name: POOL_NAME,
    capacity: CAPACITY,
    targetCount,
    footprint: footprint as number,
    blockedBy: ['trees', 'rocks'],
    avoidWalkCorridor: avoidWalkCorridor as boolean,
    scaleMin: scaleMin as number,
    scaleMax: scaleMax as number,
    rotateRandom: rotateRandom as boolean,
    meshCount: 1,
    variantCount: 1,
  })

  return (
    <instancedMesh
      ref={pool.meshRefs[0]}
      args={[geometry, material, CAPACITY]}
      castShadow
      receiveShadow
      frustumCulled={false}
      dispose={null}
    />
  )
}
