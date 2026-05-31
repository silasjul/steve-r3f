import type { EnvConfig } from "../_env-config";

export const desertConfig: EnvConfig = {
  label: "Desert",

  scene: {
    bg: "#d4c49a",
    walkCorridorWidth: 4,
    sky: { elev: 45, azimuth: 180, turb: 2.5, rayl: 0.15 },
    lighting: {
      ambient: 0.45,
      sunInt: 3.0,
      sunColor: "#fff3d0",
      lightDist: 10,
    },
    fog: {
      enabled: false,
      mode: "linear",
      color: "#d4c49a",
      near: 12,
      far: 25,
      density: 0.04,
    },
    bloom: { intensity: 0.05, threshold: 0.9 },
  },

  scatter: {
    temples: {
      pool: {
        density: 0.0005,
        scaleMin: 1,
        scaleMax: 1,
        rotateRandom: true,
        avoidWalkCorridor: true,
        // Side length of the square no-spawn / collision zone around a temple.
        // Now actually applied (the footprint slider used to clamp this to 4).
        // Bump up if grass still pokes through the temple — with random rotation
        // the corners swing out, so keep this >= ~1.4× the visible width.
        footprint: 22,
      },
      model: { oy: -3.65, s: 14.5, scaleMax: 16 },
      // Center sits >= corridorHalf(3) + clearance from the path. With a 30-wide
      // temple (half = 15), 16 keeps the building ~1 unit clear of the corridor.
      corridorClearance: 16,
      // 1.6 × footprint(30) = 48-unit minimum gap between temple centers.
      gap: 1.6,
    },

    cacti: {
      pool: {
        density: 0.025,
        scaleMin: 0.85,
        scaleMax: 1.15,
        rotateRandom: false,
        avoidWalkCorridor: true,
        footprint: 0.8,
      },
    },

    dryGrass: {
      short: {
        density: 0.13,
        scaleMin: 0.7,
        scaleMax: 1.1,
        rotateRandom: true,
        avoidWalkCorridor: false,
        footprint: 0.3,
      },
      tall: {
        density: 0.03,
        scaleMin: 0.8,
        scaleMax: 1.1,
        rotateRandom: true,
        avoidWalkCorridor: false,
        footprint: 0.3,
      },
    },

    deadBushes: {
      pool: {
        density: 0.01,
        scaleMin: 0.85,
        scaleMax: 1.15,
        rotateRandom: true,
        avoidWalkCorridor: false,
        footprint: 0.5,
      },
    },

    wanderingTraders: {
      pool: {
        density: 0.003,
        scaleMin: 0.9,
        scaleMax: 1.1,
        rotateRandom: true,
        avoidWalkCorridor: true,
        footprint: 3,
      },
      model: { oy: -0.01, s: 0.35, scaleMax: 5 },
    },

    camels: {
      pool: {
        density: 0.002,
        scaleMin: 0.9,
        scaleMax: 1.1,
        rotateRandom: true,
        avoidWalkCorridor: true,
        footprint: 4,
      },
      model: { oy: 0, s: 1, scaleMax: 5 },
    },
  },
};
