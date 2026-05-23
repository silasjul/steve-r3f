'use client'

import { SimpleCubeBlock, type BlockProps } from './_block'

export default function Dirt(props: BlockProps) {
  return <SimpleCubeBlock texturePath="/textures/dirt.png" {...props} />
}
