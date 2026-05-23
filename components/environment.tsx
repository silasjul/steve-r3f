'use client'

import { useWorldStore, type World } from '@/store/world-store'
import OverworldDay from './environments/overworld-day'
import OverworldNight from './environments/overworld-night'
import Nether from './environments/nether'
import End from './environments/end'
import OverworldFloor from './environments/overworld-floor'

const MAP = {
  'overworld-day': OverworldDay,
  'overworld-night': OverworldNight,
  nether: Nether,
  end: End,
} as const

const OVERWORLDS: ReadonlySet<World> = new Set(['overworld-day', 'overworld-night'])

export default function Environment() {
  const world = useWorldStore((s) => s.world)
  const World = MAP[world]
  return (
    <>
      {OVERWORLDS.has(world) && <OverworldFloor />}
      <World />
    </>
  )
}
