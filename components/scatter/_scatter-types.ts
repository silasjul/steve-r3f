import type { InstancedMesh } from 'three'

export type OccupancyQuery = (x: number, z: number) => boolean

export interface OccupancyAPI {
  register: (name: string, query: OccupancyQuery) => () => void
  isBlocked: (
    x: number,
    z: number,
    blockedBy: readonly string[],
    avoidWalkCorridor: boolean
  ) => boolean
}

export interface ScatterWorldState {
  speed: number
  radius: number
  walkCorridorWidth: number
  occupancy: OccupancyAPI
  /** Current z offset of the ground group (range −0.5..+0.5). Snap-to-grid
   *  pools must align spawns to `integer + offset` so tiles stay seated on
   *  ground cells regardless of how long the world has been scrolling. */
  getGroundOffsetZ: () => number
}

/** Per-instance fix-up applied "inside" the slot transform — same shape leva
 *  produces from modelControlsSchema(). All zeros + scale 1 = identity. */
export interface ModelTransform {
  offsetX: number
  offsetY: number
  offsetZ: number
  rotX: number  // degrees
  rotY: number
  rotZ: number
  scale: number
}

export interface ScatterPoolConfig {
  name: string
  capacity: number
  targetCount: number
  footprint: number
  blockedBy: readonly string[]
  avoidWalkCorridor: boolean
  scaleMin: number
  scaleMax: number
  rotateRandom: boolean
  /** Number of <instancedMesh> elements the consumer renders. */
  meshCount: number
  /** Number of distinct variants picked per slot. Defaults to meshCount.
   *  For fan mode (multi-submesh GLB) this is typically 1. */
  variantCount?: number
  variantWeights?: readonly number[]
  /** If true, every slot's matrix is written to ALL meshes — for multi-submesh
   *  GLBs where head/body/legs share a transform. Default false. */
  fanAllMeshes?: boolean
  /** Minimum spacing factor between slots in this pool — set to e.g. 1.2 to
   *  keep tree canopies from intersecting. Default 0 (no self-avoid). */
  selfAvoidFactor?: number
  /** If true, the pool registers itself with ScatterWorld occupancy under
   *  `name` so other pools can list us in `blockedBy`. Default false. */
  registerAsOccupier?: boolean
  /** If true, candidate (x, z) positions are rounded to integers at placement
   *  time so instances align with the ground's 1×1 tile grid. Per-frame z drift
   *  matches the ground group's scroll, so alignment is preserved continuously.
   *  Default false. */
  snapToGrid?: boolean
  /** 0..1 probability that a newly-spawned instance is placed adjacent to an
   *  already-placed sibling instead of at an independent random position. With
   *  snapToGrid this produces Minecraft-style tile clusters (rock patches,
   *  ore veins). For recycled instances only sibling seeds near the leading
   *  edge are eligible so new ones don't pop in mid-disc. Default 0. */
  clusterBias?: number
  /** Optional per-instance offset/rotation/scale fix-up for the source model. */
  model?: ModelTransform
}

export type MeshRefCallback = (mesh: InstancedMesh | null) => void

export interface ScatterPoolHandle {
  meshRefs: readonly MeshRefCallback[]
}
