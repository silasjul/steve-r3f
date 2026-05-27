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
  variantCount: number
  variantWeights?: readonly number[]
}

export type MeshRefCallback = (mesh: InstancedMesh | null) => void

export interface ScatterPoolHandle {
  meshRefs: readonly MeshRefCallback[]
}
