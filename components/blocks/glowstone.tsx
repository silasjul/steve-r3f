'use client'

import { SimpleCubeBlock, type BlockProps } from './_block'

export default function Glowstone(props: BlockProps) {
  return (
    <SimpleCubeBlock
      texturePath="/textures/glowstone.png"
      emissive="#ffcc55"
      emissiveIntensity={1.5}
      {...props}
    />
  )
}
