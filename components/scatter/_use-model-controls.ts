'use client'

export interface ModelControlDefaults {
  ox?: number
  oy?: number
  oz?: number
  rx?: number
  ry?: number
  rz?: number
  s?: number
  /** Override the scale slider range — trees want up to 20, mobs up to 5. */
  scaleMax?: number
}

/**
 * Shared leva schema for per-model fix-up (offset / euler / scale). Output
 * field names match the {@link ModelTransform} shape so the values object can
 * be passed straight through to useScatterPool({ model }).
 */
export function modelControlsSchema(defaults: ModelControlDefaults = {}) {
  const scaleMax = defaults.scaleMax ?? 5
  return {
    offsetX: { value: defaults.ox ?? 0, min: -5, max: 5, step: 0.01, label: 'Offset X' },
    offsetY: { value: defaults.oy ?? 0, min: -5, max: 5, step: 0.01, label: 'Offset Y' },
    offsetZ: { value: defaults.oz ?? 0, min: -5, max: 5, step: 0.01, label: 'Offset Z' },
    rotX: { value: defaults.rx ?? 0, min: -180, max: 180, step: 1, label: 'Rot X' },
    rotY: { value: defaults.ry ?? 0, min: -180, max: 180, step: 1, label: 'Rot Y' },
    rotZ: { value: defaults.rz ?? 0, min: -180, max: 180, step: 1, label: 'Rot Z' },
    scale: { value: defaults.s ?? 1, min: 0.05, max: scaleMax, step: 0.05, label: 'Scale' },
  }
}
