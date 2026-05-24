'use client'

import { useSharedPixelMaterial } from '@/components/blocks/_block'
import FloorChunk from '../_floor-chunk'

export const END_TILE_WIDTH = 15
export const END_TILE_LENGTH = 20

export default function EndTile() {
  const material = useSharedPixelMaterial('/textures/end_stone.png')
  return (
    <FloorChunk
      material={material}
      width={END_TILE_WIDTH}
      length={END_TILE_LENGTH}
    />
  )
}
