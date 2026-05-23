'use client'

import { SimpleCubeBlock, type BlockProps } from './_block'

export default function Stone(props: BlockProps) {
  return <SimpleCubeBlock texturePath="/textures/stone.png" {...props} />
}
