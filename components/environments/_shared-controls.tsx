'use client'

import { useControls, folder } from 'leva'
import { useEnvStore } from '@/store/env-store'
import { MAX_RADIUS } from './_ground'

export default function SharedEnvControls() {
  useControls({
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
          onChange: (v: number) => useEnvStore.setState({ walkSpeed: v }),
        },
      },
      { collapsed: true }
    ),
  })
  return null
}
