'use client'

import { useEffect } from 'react'
import { useControls, folder } from 'leva'
import { useEnvStore } from '@/store/env-store'
import { MAX_RADIUS } from './_ground'

export default function SharedEnvControls() {
  const [, set] = useControls(() => ({
    Tiles: folder(
      {
        radius: {
          value: useEnvStore.getState().radius,
          min: 4,
          max: MAX_RADIUS,
          step: 1,
          label: 'Radius',
          onChange: (v: number) => useEnvStore.setState({ radius: v }),
        },
      },
      { collapsed: true }
    ),
    Movement: folder(
      {
        walkSpeed: {
          value: useEnvStore.getState().walkSpeed,
          min: -3,
          max: 3,
          step: 0.1,
          label: 'Walk Speed',
          onChange: (v: number) => {
            if (v !== useEnvStore.getState().walkSpeed) {
              useEnvStore.setState({ walkSpeed: v })
            }
          },
        },
      },
      { collapsed: true }
    ),
  }))

  // Swapping a Steve animation writes the clip's walkSpeed into the store; mirror
  // that (and any other external edit) into this slider so it never goes stale.
  useEffect(() => {
    const setWalk = set as (v: { walkSpeed: number }) => void
    return useEnvStore.subscribe((s, p) => {
      if (s.walkSpeed !== p.walkSpeed) setWalk({ walkSpeed: s.walkSpeed })
    })
  }, [set])

  return null
}
