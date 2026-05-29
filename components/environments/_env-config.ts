'use client'

import { createContext, useContext } from 'react'
import type { PoolControlDefaults } from '@/components/scatter/_use-pool-controls'
import type { ModelControlDefaults } from '@/components/scatter/_use-model-controls'

/**
 * Shared default-value shapes for each environment scene.
 *
 * Each environment under `components/environments/<name>/config.ts` exports a
 * concrete `EnvConfig`. The env's scene wraps its children in
 * `<EnvConfigProvider value={config}>` and every scatter pulls its slice via
 * `useEnvConfig().<key>`. All defaults live in the env's config file — there
 * are no hidden defaults inside the scatter components.
 */

export interface SkyDefaults {
  elev: number
  azimuth: number
  turb: number
  rayl: number
}

export interface LightingDefaults {
  ambient: number
  sunInt: number
  sunColor: string
  lightDist: number
}

export interface FogDefaults {
  enabled: boolean
  mode: 'linear' | 'exp2'
  color: string
  near: number
  far: number
  density: number
}

export interface BloomDefaults {
  intensity: number
  threshold: number
}

export interface StarsDefaults {
  count: number
  saturation: number
  /** Optional second layer of brighter, larger stars for size variation. */
  bright?: {
    count: number
    factor: number
  }
}

export interface SceneDefaults {
  bg: string
  walkCorridorWidth: number
  sky: SkyDefaults
  lighting: LightingDefaults
  fog: FogDefaults
  bloom: BloomDefaults
  /** Optional — only night-style scenes need this. */
  stars?: StarsDefaults
}

export interface PoolWithModel {
  pool: PoolControlDefaults
  model: ModelControlDefaults
}

export interface FlowerWeights {
  poppy: number
  oxeye_daisy: number
  white_tulip: number
  orange_tulip: number
  pink_tulip: number
  red_tulip: number
}

export interface FlowerConfig {
  pool: PoolControlDefaults
  weights: FlowerWeights
}

export interface RockConfig {
  pool: PoolControlDefaults
  coalWeight: number
  /** 0..1 probability that a rock spawns adjacent to an existing one — higher
   *  values produce tighter Minecraft-style stone/ore patches. */
  cluster: number
}

/**
 * Every scatter slice is optional — an env only needs to populate the ones it
 * actually renders. Each scatter component asserts its slice is present and
 * throws a clear error if you place it inside an env that didn't configure it.
 */
export interface ScatterDefaults {
  trees?: PoolWithModel
  shortGrass?: { pool: PoolControlDefaults }
  flowers?: FlowerConfig
  pigs?: PoolWithModel
  rocks?: RockConfig
  creepers?: PoolWithModel
  endermen?: PoolWithModel
  zombies?: PoolWithModel
  chickenJockeys?: PoolWithModel
}

export interface EnvConfig {
  /** Leva folder label for the env's scene-level controls. */
  label: string
  scene: SceneDefaults
  scatter: ScatterDefaults
}

const EnvConfigContext = createContext<EnvConfig | null>(null)

export const EnvConfigProvider = EnvConfigContext.Provider

export function useEnvConfig(): EnvConfig {
  const ctx = useContext(EnvConfigContext)
  if (!ctx) throw new Error('useEnvConfig must be used inside <EnvConfigProvider>')
  return ctx
}

export function useScatterDefaults<K extends keyof ScatterDefaults>(
  key: K
): NonNullable<ScatterDefaults[K]> {
  const cfg = useEnvConfig()
  const slice = cfg.scatter[key]
  if (!slice) {
    throw new Error(
      `Env "${cfg.label}" rendered a scatter that needs scatter.${String(key)} config, but none was provided.`
    )
  }
  return slice as NonNullable<ScatterDefaults[K]>
}

/**
 * Returns the env's Leva root folder name. Scatter components nest their
 * Tiles/Models sub-folders under this so day and night don't share the same
 * Leva input path (leva caches values per path across mount/unmount). Without
 * this, switching envs would carry over the other env's slider values.
 */
export function useEnvLabel(): string {
  return useEnvConfig().label
}
