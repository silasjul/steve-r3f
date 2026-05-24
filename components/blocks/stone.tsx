'use client'

import { SimplePlaneBlock, type BlockProps } from './_block'

export default function Stone(props: BlockProps) {
  return <SimplePlaneBlock texturePath="/textures/stone.png" {...props} />
}
