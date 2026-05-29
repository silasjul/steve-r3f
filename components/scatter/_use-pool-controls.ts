'use client'

export interface SpawnZoneDefaults {
  width: number
  forwardDepth: number
  backDepth: number
}

export function spawnZoneControlsSchema(defaults: SpawnZoneDefaults) {
  return {
    spawnWidth: { value: defaults.width, min: 2, max: 120, step: 1, label: 'Width' },
    spawnForward: { value: defaults.forwardDepth, min: 2, max: 120, step: 1, label: 'Forward Depth' },
    spawnBack: { value: defaults.backDepth, min: 2, max: 120, step: 1, label: 'Back Depth' },
  }
}

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
