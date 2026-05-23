'use client'

import { SimpleCubeBlock, type BlockProps } from './_block'

export default function EndStone(props: BlockProps) {
  return <SimpleCubeBlock texturePath="/textures/end_stone.png" {...props} />
}
