'use client'

import { useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import {
  PLANE_GEOMETRY,
  getOrCreateMaterial,
  useAnimatedFrameTexture,
  type BlockProps,
} from './_block'

export default function Water(props: BlockProps) {
  const tex = useAnimatedFrameTexture('/textures/water_still.png')
  const material = useMemo(
    () =>
      getOrCreateMaterial(
        'water:still',
        () =>
          new MeshStandardMaterial({
            map: tex,
            color: '#3f76e4',
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
          })
      ),
    [tex]
  )
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      {...props}
      geometry={PLANE_GEOMETRY}
      material={material}
    />
  )
}
