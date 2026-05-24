'use client'

import { useSharedPixelMaterial } from '@/components/blocks/_block'
import FloorChunk from '../_floor-chunk'

export const NETHER_TILE_WIDTH = 15
export const NETHER_TILE_LENGTH = 20

export default function NetherTile() {
  const material = useSharedPixelMaterial('/textures/netherrack.png')
  return (
    <FloorChunk
      material={material}
      width={NETHER_TILE_WIDTH}
      length={NETHER_TILE_LENGTH}
    />
  )
}
