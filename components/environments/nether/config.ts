import type { EnvConfig } from "../_env-config";

/**
 * All starting values for the Nether scene.
 *
 * Every number/color/boolean a Leva slider opens with comes from here. Edit a
 * field and reload the page (or cycle the world) to see the new default — once
 * you've tweaked a slider in the panel, Leva keeps that runtime value until
 * the env unmounts.
 */
export const netherConfig: EnvConfig = {
  label: "Nether",

  scene: {
    bg: "#2d0a00",
    walkCorridorWidth: 2.5,
    floorRadius: 25,
    lighting: {
      ambient: 0.6,
      sunInt: 0.0,
      sunColor: "#ff4400",
      lightDist: 10,
    },
    fog: {
      enabled: true,
      mode: "linear",
      color: "#6b1500",
      near: 10,
      far: 80,
      density: 0.06,
    },
    bloom: { intensity: 1.5, threshold: 0.1 },
    roof: { height: 12, tint: "#aa3322", radius: 50 },
  },

  scatter: {
    lava: {
      pool: {
        density: 0.2,
        scaleMin: 1,
        scaleMax: 1,
        rotateRandom: false,
        avoidWalkCorridor: true,
        footprint: 1.0,
      },
      cluster: 1,
    },

    netherOres: {
      pool: {
        density: 0.06,
        scaleMin: 1,
        scaleMax: 1,
        rotateRandom: false,
        avoidWalkCorridor: false,
        footprint: 1.0,
      },
      goldWeight: 0.25,
      cluster: 0.7,
    },

    netherCeilingQuartz: {
      pool: {
        density: 0.04,
        scaleMin: 1,
        scaleMax: 1,
        rotateRandom: false,
        avoidWalkCorridor: false,
        footprint: 1.0,
      },
      cluster: 0,
    },

    glowstone: {
      pool: {
        density: 0.04,
        scaleMin: 1,
        scaleMax: 1,
        rotateRandom: false,
        avoidWalkCorridor: false,
        footprint: 1.0,
      },
      cluster: 0.9,
      verticalSpread: 5,
      light: {
        count: 6,
        intensity: 8,
        distance: 18,
        color: "#ffcc55",
      },
    },

    zombiePigmen: {
      pool: {
        density: 0.01,
        scaleMin: 0.95,
        scaleMax: 1.05,
        rotateRandom: true,
        avoidWalkCorridor: true,
        footprint: 1.0,
      },
      model: { oy: 1.28, s: 0.08, scaleMax: 5 },
    },
  },
};
