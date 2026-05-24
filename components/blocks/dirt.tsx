'use client'

import { SimplePlaneBlock, type BlockProps } from './_block'

export default function Dirt(props: BlockProps) {
  return <SimplePlaneBlock texturePath="/textures/dirt.png" {...props} />
}
