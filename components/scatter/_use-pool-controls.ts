'use client'

export interface PoolControlDefaults {
  density: number
  scaleMin: number
  scaleMax: number
  rotateRandom: boolean
  avoidWalkCorridor: boolean
  footprint: number
}

/**
 * Common per-pool leva schema. `density` is plants-per-tile — the pool's
 * effective count = floor(density * tileCount(radius)) so it scales with the
 * ground disc. Caller wraps in folder() and merges pool-specific extras.
 */
export function poolControlsSchema(defaults: PoolControlDefaults) {
  return {
    density: {
      value: defaults.density,
      min: 0,
      max: 2,
      step: 0.001,
      label: 'Density',
    },
    scaleMin: { value: defaults.scaleMin, min: 0.05, max: 3, step: 0.01, label: 'Scale Min' },
    scaleMax: { value: defaults.scaleMax, min: 0.05, max: 3, step: 0.01, label: 'Scale Max' },
    rotateRandom: { value: defaults.rotateRandom, label: 'Random Rotation' },
    avoidWalkCorridor: { value: defaults.avoidWalkCorridor, label: 'Avoid Corridor' },
    footprint: { value: defaults.footprint, min: 0, max: 4, step: 0.05, label: 'Footprint' },
  }
}
