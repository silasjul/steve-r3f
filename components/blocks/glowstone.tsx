'use client'

import { SimplePlaneBlock, type BlockProps } from './_block'

export default function Glowstone(props: BlockProps) {
  return (
    <SimplePlaneBlock
      texturePath="/textures/glowstone.png"
      emissive="#ffcc55"
      emissiveIntensity={1.5}
      {...props}
    />
  )
}
