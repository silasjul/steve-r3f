import { Color, Vector3 } from 'three'

/**
 * Live, shared handle on the ender dragon, mutated each frame by <EnderDragon>
 * and read each frame by the crystal heal-beams. Using a module singleton (the
 * same trick as `curveUniforms`) lets the scattered tower crystals follow the
 * flying dragon without threading refs/props through the scatter system or
 * triggering React re-renders.
 */
export interface BeamConfig {
  enabled: boolean
  /** Max world distance from a crystal to the dragon for its beam to fire. */
  range: number
  /** HDR brightness multiplier — pushes color past the bloom threshold. */
  intensity: number
  /** How fast the energy pulses stream toward the dragon. */
  flowSpeed: number
  /** Beam radius in world units. */
  thickness: number
  color: Color
}

export const dragonState = {
  /** True while an <EnderDragon> is mounted; beams hide when it's gone. */
  active: false,
  /** Dragon body centre in world space, before the world-curve bend. */
  position: new Vector3(),
  beam: {
    enabled: true,
    range: 16,
    intensity: 3,
    flowSpeed: 1.6,
    thickness: 0.12,
    color: new Color('#c850ff'),
  } as BeamConfig,
}
