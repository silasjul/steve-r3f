'use client'

import { SimplePlaneBlock, type BlockProps } from './_block'

export default function Obsidian(props: BlockProps) {
  return <SimplePlaneBlock texturePath="/textures/obsidian.png" {...props} />
}
