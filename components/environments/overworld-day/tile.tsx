'use client'

import { useGrassTopMaterial } from '@/components/blocks/grass-block'
import FloorChunk from '../_floor-chunk'

export const OVERWORLD_DAY_TILE_WIDTH = 15
export const OVERWORLD_DAY_TILE_LENGTH = 20

export default function OverworldDayTile() {
  const material = useGrassTopMaterial()
  return (
    <FloorChunk
      material={material}
      width={OVERWORLD_DAY_TILE_WIDTH}
      length={OVERWORLD_DAY_TILE_LENGTH}
    />
  )
}
