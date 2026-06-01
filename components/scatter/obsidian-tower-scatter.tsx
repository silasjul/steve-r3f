'use client'

import { useCallback, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { useControls, folder } from 'leva'
import { Group } from 'three'
import { getTileCountRect } from '@/components/environments/_ground'
import { poolControlsSchema, spawnZoneControlsSchema } from './_use-pool-controls'
import { useScatterPool } from './_use-scatter-pool'
import { useScatterDefaults, useEnvLabel } from '@/components/environments/_env-config'
import type { ScatterPoolFrameState } from './_scatter-types'
import ObsidianTower from '@/components/obsidian-tower'

useTexture.preload('/textures/obsidian.png')

const POOL_NAME = 'obsidianTowers'
const ZONE_DEFAULTS = { width: 50, forwardDepth: 40, backDepth: 40 }

// Fixed pool of preset tower sizes. Each slot keeps its baked-in geometry as
// it scrolls and recycles, so the scene shows a stable mix of small/tall
// towers without rebuilding meshes on the fly.
// Radii below ~3 collapse into a chunky cross instead of a recognisable
// circle, so the variants stay in the 3–3.5 range.
const TOWER_VARIANTS: ReadonlyArray<{ radius: number; height: number }> = [
  { radius: 2.1, height: 11 },
  { radius: 2.1, height: 7 },
  { radius: 2.1, height: 8 },
  { radius: 2.1, height: 12.1 },
  { radius: 2.1, height: 12 },
  { radius: 2.1, height: 7 },
  { radius: 2.1, height: 15 },
  { radius: 2.8, height: 14 },
]
const CAPACITY = TOWER_VARIANTS.length
// Corridor avoidance compares the candidate cell center to the corridor's
// half-width — a tower extends out by its radius from that center, so we
// pad the check by the largest tower in the pool to guarantee no slot ever
// pokes into Steve's path.
const MAX_TOWER_RADIUS = TOWER_VARIANTS.reduce(
  (m, v) => Math.max(m, v.radius),
  0,
)

export default function ObsidianTowerScatter() {
  const defaults = useScatterDefaults('obsidianTowers')
  const envLabel = useEnvLabel()

  const pool = useControls(envLabel, {
    Tiles: folder(
      {
        ObsidianTowers: folder(
          {
            ...poolControlsSchema(defaults.pool),
            'Spawn Zone': folder(spawnZoneControlsSchema(ZONE_DEFAULTS), { collapsed: true }),
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
    ),
  }) as Record<string, number | boolean>

  const glow = useControls(envLabel, {
    Lighting: folder(
      {
        towerGlowColor: { value: defaults.glow.color, label: 'Tower Glow Color' },
        towerGlowIntensity: {
          value: defaults.glow.intensity,
          min: 0,
          max: 100,
          step: 0.5,
          label: 'Tower Glow',
        },
        towerGlowDistance: {
          value: defaults.glow.distance,
          min: 1,
          max: 100,
          step: 1,
          label: 'Tower Glow Distance',
        },
      },
      { collapsed: true },
    ),
  }) as Record<string, number | string>

  const spawnWidth = pool.spawnWidth as number
  const spawnForward = pool.spawnForward as number
  const spawnBack = pool.spawnBack as number

  const targetCount = Math.min(
    CAPACITY,
    Math.floor((pool.density as number) * getTileCountRect(spawnWidth, spawnForward, spawnBack)),
  )

  const groupRefs = useRef<(Group | null)[]>([])

  const onAfterFrame = useCallback((state: ScatterPoolFrameState) => {
    const { positions, initialized, capacity } = state
    for (let i = 0; i < capacity; i++) {
      const g = groupRefs.current[i]
      if (!g) continue
      if (initialized[i]) {
        g.visible = true
        g.position.set(positions[i * 2], 0, positions[i * 2 + 1])
      } else {
        g.visible = false
      }
    }
  }, [])

  useScatterPool({
    name: POOL_NAME,
    capacity: CAPACITY,
    targetCount,
    footprint: pool.footprint as number,
    blockedBy: [],
    avoidWalkCorridor: pool.avoidWalkCorridor as boolean,
    walkCorridorClearance: MAX_TOWER_RADIUS,
    scaleMin: 1,
    scaleMax: 1,
    rotateRandom: false,
    meshCount: 1,
    variantCount: 1,
    selfAvoidFactor: 2.0,
    snapToGrid: true,
    registerAsOccupier: true,
    suppressMeshOutput: true,
    spawnZone: { width: spawnWidth, forwardDepth: spawnForward, backDepth: spawnBack },
    onAfterFrame,
  })

  return (
    <>
      {TOWER_VARIANTS.map((v, i) => (
        <ObsidianTower
          key={i}
          ref={(node) => {
            groupRefs.current[i] = node
            // Hide until the scatter pool's first frame places this slot,
            // otherwise all towers flash stacked at the origin on mount.
            if (node) node.visible = false
          }}
          radius={v.radius}
          height={v.height}
          glowColor={glow.towerGlowColor as string}
          glowIntensity={glow.towerGlowIntensity as number}
          glowDistance={glow.towerGlowDistance as number}
          healBeam
        />
      ))}
    </>
  )
}
