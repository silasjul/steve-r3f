'use client'

import { SimpleCubeBlock, type BlockProps } from './_block'

export default function Netherrack(props: BlockProps) {
  return <SimpleCubeBlock texturePath="/textures/netherrack.png" {...props} />
}
