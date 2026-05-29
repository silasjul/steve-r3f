import type { EnvConfig } from '../_env-config'

/**
 * All starting values for the Overworld Day scene.
 *
 * Every number/color/boolean a Leva slider opens with comes from here. Edit a
 * field and reload the page (or cycle the world) to see the new default — once
 * you've tweaked a slider in the panel, Leva keeps that runtime value until
 * the env unmounts.
 */
export const overworldDayConfig: EnvConfig = {
  label: 'Overworld Day',

  scene: {
    bg: '#87ceeb',
    walkCorridorWidth: 6,
    sky: { elev: 45.5, azimuth: 140, turb: 4, rayl: 2 },
    lighting: { ambient: 0.35, sunInt: 2.2, sunColor: '#ffe0b0', lightDist: 10 },
    fog: {
      enabled: false,
      mode: 'linear',
      color: '#b6cb9b',
      near: 8,
      far: 18,
      density: 0.06,
    },
    bloom: { intensity: 0.2, threshold: 0.85 },
  },

  scatter: {
    trees: {
      pool: {
        density: 0.008,
        scaleMin: 1,
        scaleMax: 1,
        rotateRandom: false,
        avoidWalkCorridor: true,
        footprint: 5.0,
      },
      model: { oy: -3, s: 7, scaleMax: 20 },
    },

    shortGrass: {
      pool: {
        density: 0.5,
        scaleMin: 0.6,
        scaleMax: 1.0,
        rotateRandom: true,
        avoidWalkCorridor: false,
        footprint: 0.3,
      },
    },

    flowers: {
      pool: {
        density: 0.1,
        scaleMin: 1.0,
        scaleMax: 1.0,
        rotateRandom: false,
        avoidWalkCorridor: false,
        footprint: 0.4,
      },
      weights: {
        poppy: 1,
        oxeye_daisy: 1,
        white_tulip: 1,
        orange_tulip: 1,
        pink_tulip: 1,
        red_tulip: 1,
      },
    },

    pigs: {
      pool: {
        density: 0.006,
        scaleMin: 0.9,
        scaleMax: 1.1,
        rotateRandom: true,
        avoidWalkCorridor: true,
        footprint: 1.2,
      },
      model: { oy: 0.64, s: 0.08, scaleMax: 5 },
    },
  },
}
