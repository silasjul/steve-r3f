'use client'

import { SimpleCubeBlock, type BlockProps } from './_block'

export default function Obsidian(props: BlockProps) {
  return <SimpleCubeBlock texturePath="/textures/obsidian.png" {...props} />
}
