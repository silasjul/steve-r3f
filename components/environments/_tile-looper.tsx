'use client'

import { useEffect, useRef, type ComponentType } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'

type Props = {
  Tile: ComponentType
  tileLength: number
  speed: number
  count?: number
}

/**
 * Renders `count` (default 2) identical tiles end-to-end along Z and slides
 * them with `speed`. Tiles are never created or destroyed — the back one is
 * snapped to the front of the train when Steve (origin) reaches the center
 * of the front tile (and symmetrically for backward motion).
 *
 * Initial layout for count=2: tile 0 centered on Steve (z=0), tile 1 in
 * front of Steve (z=-tileLength).
 */
export default function TileLooper({ Tile, tileLength, speed, count = 2 }: Props) {
  const groupsRef = useRef<(Group | null)[]>([])
  const positionsRef = useRef<number[]>([])

  useEffect(() => {
    positionsRef.current = Array.from({ length: count }, (_, i) => -i * tileLength)
    for (let i = 0; i < count; i++) {
      const g = groupsRef.current[i]
      if (g) g.position.z = positionsRef.current[i]
    }
  }, [count, tileLength])

  useFrame((_, delta) => {
    const positions = positionsRef.current
    if (positions.length !== count) return

    const advance = speed * delta

    // Pass 1: advance every tile so snap decisions use fresh neighbour values
    // (otherwise the snapped tile is offset by exactly `advance`, leaving a
    // one-frame-wide gap at the seam in one of the alternating orderings).
    for (let i = 0; i < count; i++) {
      positions[i] += advance
    }

    // Pass 2: any tile that crossed a recycle threshold gets snapped to the
    // opposite end of the train, exactly `tileLength` from its new neighbour.
    for (let i = 0; i < count; i++) {
      if (positions[i] >= tileLength) {
        let minZ = Infinity
        for (let j = 0; j < count; j++) {
          if (j !== i && positions[j] < minZ) minZ = positions[j]
        }
        positions[i] = minZ - tileLength
      } else if (positions[i] < -tileLength) {
        let maxZ = -Infinity
        for (let j = 0; j < count; j++) {
          if (j !== i && positions[j] > maxZ) maxZ = positions[j]
        }
        positions[i] = maxZ + tileLength
      }
    }

    for (let i = 0; i < count; i++) {
      const g = groupsRef.current[i]
      if (g) g.position.z = positions[i]
    }
  })

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            groupsRef.current[i] = el
          }}
        >
          <Tile />
        </group>
      ))}
    </>
  )
}
