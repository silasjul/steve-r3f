'use client'

import { SimplePlaneBlock, type BlockProps } from './_block'

export default function Netherrack(props: BlockProps) {
  return <SimplePlaneBlock texturePath="/textures/netherrack.png" {...props} />
}
