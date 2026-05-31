import type { RefObject } from "react";
import type { InstancedMesh } from "three";

export type OccupancyQuery = (
  x: number,
  z: number,
  /** Half-extent of the *querying* object — the occupier expands its own
   *  blocked area by this so two finite-size objects can't overlap, not just
   *  their center points. */
  queryRadius: number,
) => boolean;

export interface SpawnZone {
  /** Left/right extent (X axis), symmetric about center. */
  width: number;
  /** How far ahead of Steve instances can exist (positive Z). */
  forwardDepth: number;
  /** How far behind Steve before instances are recycled. */
  backDepth: number;
}

export interface OccupancyAPI {
  register: (name: string, query: OccupancyQuery) => () => void;
  isBlocked: (
    x: number,
    z: number,
    blockedBy: readonly string[],
    avoidWalkCorridor: boolean,
    walkCorridorClearance?: number,
    /** Half-extent of the object being placed; forwarded to each occupier
     *  query so its blocked area grows by this amount. Default 0. */
    queryRadius?: number,
  ) => boolean;
}

export interface ScatterWorldState {
  speed: number;
  /** Floor scatter / placement disc radius. */
  radius: number;
  /** Ceiling scatter disc radius — equals {@link radius} when not set on the provider. */
  ceilingRadius: number;
  walkCorridorWidth: number;
  occupancy: OccupancyAPI;
  /** Current z offset of the ground group (range −0.5..+0.5). Snap-to-grid
   *  pools must align spawns to `integer + offset` so tiles stay seated on
   *  ground cells regardless of how long the world has been scrolling. */
  getGroundOffsetZ: () => number;
}

/** Per-instance fix-up applied "inside" the slot transform — same shape leva
 *  produces from modelControlsSchema(). All zeros + scale 1 = identity. */
export interface ModelTransform {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rotX: number; // degrees
  rotY: number;
  rotZ: number;
  scale: number;
}

export interface ScatterPoolConfig {
  name: string;
  capacity: number;
  targetCount: number;
  footprint: number;
  blockedBy: readonly string[];
  avoidWalkCorridor: boolean;
  /** Extra radial padding added to the corridor half-width when checking
   *  avoidance. Use for wide objects (e.g. obsidian towers) whose body extends
   *  out from the placement cell so the geometry stays clear of Steve. */
  walkCorridorClearance?: number;
  scaleMin: number;
  scaleMax: number;
  rotateRandom: boolean;
  /** Number of <instancedMesh> elements the consumer renders. */
  meshCount: number;
  /** Number of distinct variants picked per slot. Defaults to meshCount.
   *  For fan mode (multi-submesh GLB) this is typically 1. */
  variantCount?: number;
  variantWeights?: readonly number[];
  /** If true, every slot's matrix is written to ALL meshes — for multi-submesh
   *  GLBs where head/body/legs share a transform. Default false. */
  fanAllMeshes?: boolean;
  /** Minimum spacing factor between slots in this pool — set to e.g. 1.2 to
   *  keep tree canopies from intersecting. Default 0 (no self-avoid). */
  selfAvoidFactor?: number;
  /** If true, the pool registers itself with ScatterWorld occupancy under
   *  `name` so other pools can list us in `blockedBy`. Default false. */
  registerAsOccupier?: boolean;
  /** If true, this occupier blocks a SQUARE area of half-extent
   *  `footprint * scale * 0.5` rather than an inscribed circle — use for
   *  rectangular structures (e.g. temples) so grass doesn't poke through the
   *  corners a circle leaves uncovered. Has no effect unless
   *  registerAsOccupier is set. Default false. */
  squareFootprint?: boolean;
  /** If true, candidate (x, z) positions are rounded to integers at placement
   *  time so instances align with the ground's 1×1 tile grid. Per-frame z drift
   *  matches the ground group's scroll, so alignment is preserved continuously.
   *  Default false. */
  snapToGrid?: boolean;
  /** 0..1 probability that a newly-spawned instance is placed adjacent to an
   *  already-placed sibling instead of at an independent random position. With
   *  snapToGrid this produces Minecraft-style tile clusters (rock patches,
   *  ore veins). For recycled instances only sibling seeds near the leading
   *  edge are eligible so new ones don't pop in mid-disc. Default 0. */
  clusterBias?: number;
  /** If > 0, the pool buffers recycle spawns until at least this many slots
   *  are pending, then places them all in one frame so a fresh cluster appears
   *  intact on the leading edge instead of dribbling in block-by-block. Initial
   *  fill still spawns all slots at once. Pair with clusterBias > 0. Default 0
   *  (legacy per-slot recycle). */
  clusterSize?: number;
  /** Spawn/recycle disc radius. Defaults to the scatter world's floor radius.
   *  Ignored when {@link spawnZone} is set. */
  placementRadius?: number;
  /** Rectangular spawn zone. When set, supersedes {@link placementRadius} for
   *  all despawn, anchor-placement, and cluster-validity checks. */
  spawnZone?: SpawnZone;
  /** Per-variant mesh index lists. When set, overrides fanAllMeshes and variant
   *  mode: each slot's variant v writes the instance matrix to every mesh index
   *  listed in meshGroups[v]. Enables mixed groups (e.g. cactus body + flower)
   *  where some variants include extra meshes that others don't. */
  meshGroups?: readonly (readonly number[])[]
  /** If true, each instance's Y rotation is overridden every frame to face the
   *  world origin (Steve sits at 0,0,0). Combine with model.rotY to flip the
   *  facing if the source GLB's forward axis is not +Z. Default false. */
  faceOrigin?: boolean;
  /** When set, each instance gets an integer Y offset in [-verticalSpread, 0]
   *  added before the model fix-up — used for ceiling formations (glowstone
   *  stalactites). Clustered spawns step from a seed in 26-neighbour space. */
  verticalSpread?: number;
  /** Skip writing instance matrices — consumer renders via onAfterFrame instead. */
  suppressMeshOutput?: boolean;
  /** Refs to the InstancedMesh elements rendered by the consumer. The hook
   *  reads these inside useFrame (never during render) to write matrices and
   *  update counts. Required when suppressMeshOutput is false. */
  meshesRef?: RefObject<(InstancedMesh | null)[]>;
  /** Optional per-instance offset/rotation/scale fix-up for the source model. */
  model?: ModelTransform;
  /** Read-only frame callback fired at the end of the pool's useFrame. Used by
   *  glowstone to drive a pooled set of <pointLight>s from the current set of
   *  initialized tile positions without reaching into pool internals. */
  onAfterFrame?: (state: ScatterPoolFrameState) => void;
}

/** Snapshot passed to onAfterFrame consumers. Buffers are owned by the pool
 *  and reused next frame — copy values out before yielding to React. */
export interface ScatterPoolFrameState {
  positions: Float32Array;
  scales: Float32Array;
  /** Per-instance integer Y offset when verticalSpread is enabled. */
  heights: Float32Array;
  initialized: Uint8Array;
  capacity: number;
}

