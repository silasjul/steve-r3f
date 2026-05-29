import { Material, MeshStandardMaterial } from 'three'

/**
 * Sketchfab mob GLBs often export with alphaMode BLEND, which disables depth
 * write and makes instanced copies show through each other. Match working mobs
 * (eg. zombie.glb uses MASK): cutout alpha + depth write.
 */
export function normalizeGltfMobMaterial(mat: Material): Material {
  const out = mat.clone()
  out.opacity = 1
  out.depthWrite = true
  out.depthTest = true

  const std = out as MeshStandardMaterial
  if (std.isMeshStandardMaterial && std.map) {
    std.transparent = false
    std.alphaTest = 0.5
  } else {
    out.transparent = false
    if ('alphaTest' in out) (out as MeshStandardMaterial).alphaTest = 0
  }

  out.needsUpdate = true
  return out
}
