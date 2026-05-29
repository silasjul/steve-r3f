import type { EnvConfig } from "../_env-config";

/**
 * All starting values for the Overworld Night scene.
 *
 * Every number/color/boolean a Leva slider opens with comes from here. Edit a
 * field and reload the page (or cycle the world) to see the new default — once
 * you've tweaked a slider in the panel, Leva keeps that runtime value until
 * the env unmounts.
 */
export const overworldNightConfig: EnvConfig = {
  label: "Overworld Night",

  scene: {
    bg: "#050510",
    walkCorridorWidth: 6,
    sky: { elev: 15.5, azimuth: 238, turb: 0, rayl: 0.07 },
    lighting: {
      ambient: 0.15,
      sunInt: 2.5,
      sunColor: "#8585ce",
      lightDist: 10,
    },
    fog: {
      enabled: true,
      mode: "linear",
      color: "#4d85b3",
      near: 5,
      far: 20,
      density: 0.06,
    },
    bloom: { intensity: 0.1, threshold: 1 },
    stars: {
      count: 8000,
      saturation: 0,
      bright: { count: 400, factor: 8.5 },
    },
  },

  scatter: {
    trees: {
      pool: {
        density: 0.005,
        scaleMin: 1,
        scaleMax: 1,
        rotateRandom: false,
        avoidWalkCorridor: true,
        footprint: 3.0,
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
        density: 0.01,
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
        density: 0,
        scaleMin: 1,
        scaleMax: 1,
        rotateRandom: true,
        avoidWalkCorridor: true,
        footprint: 1.5,
      },
      model: { oy: 0.64, s: 0.08, scaleMax: 5 },
    },

    rocks: {
      pool: {
        density: 0.1,
        scaleMin: 1,
        scaleMax: 1,
        rotateRandom: false,
        avoidWalkCorridor: false,
        footprint: 1.0,
      },
      coalWeight: 0.05,
      cluster: 0.95,
    },
    creepers: {
      pool: {
        density: 0.003,
        scaleMin: 0.95,
        scaleMax: 1.05,
        rotateRandom: true,
        avoidWalkCorridor: true,
        footprint: 1.0,
      },
      model: { oy: 0, s: 0.09, scaleMax: 5 },
    },

    endermen: {
      pool: {
        density: 0.001,
        scaleMin: 0.95,
        scaleMax: 1.05,
        rotateRandom: true,
        avoidWalkCorridor: true,
        footprint: 1.4,
      },
      model: { oy: 0.267, s: 1.1, scaleMax: 5 },
    },

    zombies: {
      pool: {
        density: 0.003,
        scaleMin: 0.95,
        scaleMax: 1.05,
        rotateRandom: true,
        avoidWalkCorridor: true,
        footprint: 1.0,
      },
      model: { oy: -0.01, s: 0.76, scaleMax: 5 },
    },

    chickenJockeys: {
      pool: {
        density: 0.003,
        scaleMin: 0.95,
        scaleMax: 1.05,
        rotateRandom: true,
        avoidWalkCorridor: true,
        footprint: 1.0,
      },
      model: { rx: 180, oy: 0.18, s: 2.17, scaleMax: 5 },
    },
  },
};
