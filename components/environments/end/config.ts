import type { EnvConfig } from "../_env-config";

export const endConfig: EnvConfig = {
  label: "End",

  scene: {
    bg: "#0d001a",
    walkCorridorWidth: 1,
    lighting: {
      ambient: 0.2,
      sunInt: 0.4,
      sunColor: "#cc88ff",
      lightDist: 10,
    },
    fog: {
      enabled: true,
      mode: "linear",
      color: "#1a0033",
      near: 30,
      far: 180,
      density: 0,
    },
    bloom: { intensity: 1.2, threshold: 0.2 },
    stars: { count: 10000, saturation: 1 },
  },

  scatter: {
    endermen: {
      pool: {
        density: 1,
        scaleMin: 0.95,
        scaleMax: 1.05,
        rotateRandom: true,
        avoidWalkCorridor: true,
        footprint: 0,
      },
      model: { ry: 180,oy: 0.267, s: 1.1, scaleMax: 5 },
    },

    obsidianTowers: {
      pool: {
        density: 1,
        scaleMin: 1,
        scaleMax: 1,
        rotateRandom: false,
        avoidWalkCorridor: true,
        footprint: 5,
      },
      glow: { color: "#ff7733", intensity: 50, distance: 24 },
    },
  },
};
