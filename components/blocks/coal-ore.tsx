'use client'

import { SimpleCubeBlock, type BlockProps } from './_block'

export default function CoalOre(props: BlockProps) {
  return <SimpleCubeBlock texturePath="/textures/coal_ore.png" {...props} />
}
