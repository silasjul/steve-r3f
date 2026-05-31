'use client'

import { useWorldStore } from '@/store/world-store'
import OverworldDay from './environments/overworld-day'
import OverworldNight from './environments/overworld-night'
import Nether from './environments/nether'
import End from './environments/end'
import Desert from './environments/desert'
import SharedEnvControls from './environments/_shared-controls'
import WorldCurve from './world-curve'

const MAP = {
  'overworld-day': OverworldDay,
  desert: Desert,
  'overworld-night': OverworldNight,
  nether: Nether,
  end: End,
} as const

export default function Environment() {
  const world = useWorldStore((s) => s.world)
  const World = MAP[world]
  return (
    <>
      <WorldCurve />
      <SharedEnvControls />
      <World />
    </>
  )
}
