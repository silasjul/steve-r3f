'use client'

import { useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import {
  BOX_GEOMETRY,
  getOrCreateMaterial,
  useAnimatedFrameTexture,
  type BlockProps,
} from './_block'

export default function Lava(props: BlockProps) {
  const tex = useAnimatedFrameTexture('/textures/lava_still.png')
  const material = useMemo(
    () =>
      getOrCreateMaterial(
        'lava:still',
        () =>
          new MeshStandardMaterial({
            map: tex,
            emissive: '#ff5500',
            emissiveMap: tex,
            emissiveIntensity: 1.2,
          })
      ),
    [tex]
  )
  return (
    <mesh
      {...props}
      geometry={BOX_GEOMETRY}
      material={material}
      castShadow
      receiveShadow
    />
  )
}
