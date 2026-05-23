'use client'

import { SimpleCubeBlock, type BlockProps } from './_block'

export default function IronOre(props: BlockProps) {
  return <SimpleCubeBlock texturePath="/textures/iron_ore.png" {...props} />
}
