'use client'

import { useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import {
  PLANE_GEOMETRY,
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
      rotation-x={-Math.PI / 2}
      {...props}
      geometry={PLANE_GEOMETRY}
      material={material}
      castShadow
      receiveShadow
    />
  )
}
