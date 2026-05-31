'use client'

import { useMemo, useRef } from 'react'
import { useControls, folder } from 'leva'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
} from 'three'
import { usePixelTexture, getOrCreateMaterial } from '@/components/blocks/_block'
import { getTileCountRect } from '@/components/environments/_ground'
import { poolControlsSchema, spawnZoneControlsSchema } from './_use-pool-controls'
import { useScatterPool } from './_use-scatter-pool'
import { applyWindShaderUVBend, createWindDepthMaterialUVBend } from '@/components/wind'
import { useScatterDefaults, useEnvLabel } from '@/components/environments/_env-config'

const POOL_NAME = 'cacti'
const MAX_DENSITY = 0.3
const ZONE_DEFAULTS = { width: 60, forwardDepth: 30, backDepth: 30 }
const CAPACITY = Math.max(8, Math.ceil(getTileCountRect(ZONE_DEFAULTS.width, ZONE_DEFAULTS.forwardDepth, ZONE_DEFAULTS.backDepth) * MAX_DENSITY))

// 6 visual variants: heights 1/2/3 × no-flower/flower
// Weights: 2 for no-flower (2/3 chance), 1 for flower (1/3 chance)
const VARIANT_WEIGHTS = [2, 2, 2, 1, 1, 1] as const

// meshGroups: variant → [sidesMeshIdx, topMeshIdx, (flowerMeshIdx)?]
const MESH_GROUPS: readonly (readonly number[])[] = [
  [0, 3],     // h1, no flower
  [1, 4],     // h2, no flower
  [2, 5],     // h3, no flower
  [0, 3, 6],  // h1, with flower
  [1, 4, 7],  // h2, with flower
  [2, 5, 8],  // h3, with flower
]

// Total: 9 InstancedMeshes (0-2: sides, 3-5: tops, 6-8: flowers)
const MESH_COUNT = 9

// ─── Geometry builders ────────────────────────────────────────────────────────

function buildCactusSidesGeometry(height: number): BufferGeometry {
  const segs = height
  const totalVerts = segs * 4 * 4  // 4 faces × 4 verts each
  const totalIdx = segs * 4 * 6    // 4 faces × 6 indices each

  const pos = new Float32Array(totalVerts * 3)
  const nrm = new Float32Array(totalVerts * 3)
  const uv = new Float32Array(totalVerts * 2)
  const idx = new Uint16Array(totalIdx)
  let vi = 0
  let ii = 0

  function face(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    nx: number, ny: number, nz: number,
  ) {
    const base = vi
    pos.set([ax, ay, az], vi * 3); uv.set([0, 0], vi * 2); nrm.set([nx, ny, nz], vi * 3); vi++
    pos.set([bx, by, bz], vi * 3); uv.set([1, 0], vi * 2); nrm.set([nx, ny, nz], vi * 3); vi++
    pos.set([cx, cy, cz], vi * 3); uv.set([0, 1], vi * 2); nrm.set([nx, ny, nz], vi * 3); vi++
    pos.set([dx, dy, dz], vi * 3); uv.set([1, 1], vi * 2); nrm.set([nx, ny, nz], vi * 3); vi++
    idx[ii++] = base; idx[ii++] = base + 1; idx[ii++] = base + 2
    idx[ii++] = base + 1; idx[ii++] = base + 3; idx[ii++] = base + 2
  }

  const H = 0.5, I = 0.5 - 1 / 16  // faces inset 1/16 from edge like Minecraft
  for (let s = 0; s < segs; s++) {
    const y0 = s, y1 = s + 1
    face(-H, y0, I,   H, y0, I,  -H, y1, I,  H, y1, I,   0, 0, 1)
    face( H, y0,-I,  -H, y0,-I,   H, y1,-I, -H, y1,-I,   0, 0,-1)
    face( I, y0, H,   I, y0,-H,   I, y1, H,  I, y1,-H,   1, 0, 0)
    face(-I, y0,-H,  -I, y0, H,  -I, y1,-H,  -I, y1, H,  -1, 0, 0)
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('normal', new BufferAttribute(nrm, 3))
  geo.setAttribute('uv', new BufferAttribute(uv, 2))
  geo.setIndex(new BufferAttribute(idx, 1))
  return geo
}

function buildCactusTopGeometry(height: number): BufferGeometry {
  const h = height
  const pos = new Float32Array([
    -0.5, h, -0.5,
     0.5, h, -0.5,
    -0.5, h,  0.5,
     0.5, h,  0.5,
  ])
  const nrm = new Float32Array([0,1,0, 0,1,0, 0,1,0, 0,1,0])
  const uv = new Float32Array([0,1, 1,1, 0,0, 1,0])
  const idx = new Uint16Array([0, 2, 1, 2, 3, 1])
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('normal', new BufferAttribute(nrm, 3))
  geo.setAttribute('uv', new BufferAttribute(uv, 2))
  geo.setIndex(new BufferAttribute(idx, 1))
  return geo
}

// Cross-plane (two ±45° quads) positioned at base y=height, 0.75 units tall.
// Width 0.875 matches the short-grass cross-plane for consistent look.
function buildCactusFlowerGeometry(height: number): BufferGeometry {
  const W = 0.875
  const H = 0.75
  const d = (W / 2) * Math.SQRT1_2  // half-diagonal for 45° rotation
  const yb = height
  const yt = height + H

  // 8 vertices total (4 per plane)
  const pos = new Float32Array([
    // Plane A (+45°)
    -d, yb, -d,   d, yb,  d,  -d, yt, -d,   d, yt,  d,
    // Plane B (-45°)
     d, yb, -d,  -d, yb,  d,   d, yt, -d,  -d, yt,  d,
  ])
  const n45 = Math.SQRT1_2
  const nrm = new Float32Array([
    // Plane A
     n45,0,-n45,  n45,0,-n45,  n45,0,-n45,  n45,0,-n45,
    // Plane B
    -n45,0,-n45, -n45,0,-n45, -n45,0,-n45, -n45,0,-n45,
  ])
  // Crop UVs to skip the opaque 1px top row (and side columns) of the flower
  // texture, same as getCrossPlaneGeometry — otherwise a "+" of intersecting
  // plane edges shows from low angles.
  const PX = 1 / 16
  const uMin = PX, uMax = 1 - PX, vMax = 1 - PX
  const uv = new Float32Array([
    // Plane A
    uMin,0, uMax,0, uMin,vMax, uMax,vMax,
    // Plane B
    uMin,0, uMax,0, uMin,vMax, uMax,vMax,
  ])
  const idx = new Uint16Array([
    0,1,2, 1,3,2,   // Plane A
    4,5,6, 5,7,6,   // Plane B
  ])
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('normal', new BufferAttribute(nrm, 3))
  geo.setAttribute('uv', new BufferAttribute(uv, 2))
  geo.setIndex(new BufferAttribute(idx, 1))
  return geo
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CactusScatter() {
  const sideTex = usePixelTexture('/textures/cactus_side.png')
  const topTex = usePixelTexture('/textures/cactus_top.png')
  const flowerTex = usePixelTexture('/textures/cactus_flower.png')

  const sideMat = useMemo(
    () => getOrCreateMaterial('cactus-side', () => new MeshStandardMaterial({ map: sideTex, alphaTest: 0.5 })),
    [sideTex],
  )
  const topMat = useMemo(
    () => getOrCreateMaterial('cactus-top', () => new MeshStandardMaterial({ map: topTex, alphaTest: 0.5 })),
    [topTex],
  )
  const flowerMat = useMemo(() => {
    const m = getOrCreateMaterial(
      'cactus-flower',
      () => new MeshStandardMaterial({ map: flowerTex, transparent: true, alphaTest: 0.5, side: DoubleSide }),
    )
    applyWindShaderUVBend(m)
    return m
  }, [flowerTex])
  const flowerDepthMat = useMemo(() => createWindDepthMaterialUVBend(flowerTex), [flowerTex])

  // One geometry per mesh slot
  const geoSidesH1 = useMemo(() => buildCactusSidesGeometry(1), [])
  const geoSidesH2 = useMemo(() => buildCactusSidesGeometry(2), [])
  const geoSidesH3 = useMemo(() => buildCactusSidesGeometry(3), [])
  const geoTopH1   = useMemo(() => buildCactusTopGeometry(1), [])
  const geoTopH2   = useMemo(() => buildCactusTopGeometry(2), [])
  const geoTopH3   = useMemo(() => buildCactusTopGeometry(3), [])
  const geoFlowerH1 = useMemo(() => buildCactusFlowerGeometry(1), [])
  const geoFlowerH2 = useMemo(() => buildCactusFlowerGeometry(2), [])
  const geoFlowerH3 = useMemo(() => buildCactusFlowerGeometry(3), [])

  const defaults = useScatterDefaults('cacti')
  const envLabel = useEnvLabel()

  const controls = useControls(envLabel, {
    Tiles: folder(
      {
        Cacti: folder(
          {
            ...poolControlsSchema(defaults.pool),
            'Spawn Zone': folder(spawnZoneControlsSchema(ZONE_DEFAULTS), { collapsed: true }),
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
    ),
  })

  const targetCount = Math.min(
    CAPACITY,
    Math.floor((controls.density as number) * getTileCountRect(controls.spawnWidth as number, controls.spawnForward as number, controls.spawnBack as number)),
  )

  const meshesRef = useRef<(InstancedMesh | null)[]>([])

  useScatterPool({
    name: POOL_NAME,
    capacity: CAPACITY,
    targetCount,
    footprint: controls.footprint as number,
    blockedBy: ['temples'],
    avoidWalkCorridor: controls.avoidWalkCorridor as boolean,
    scaleMin: controls.scaleMin as number,
    scaleMax: controls.scaleMax as number,
    rotateRandom: controls.rotateRandom as boolean,
    meshCount: MESH_COUNT,
    variantCount: 6,
    variantWeights: VARIANT_WEIGHTS,
    meshGroups: MESH_GROUPS,
    selfAvoidFactor: 1.5,
    registerAsOccupier: true,
    meshesRef,
    spawnZone: { width: controls.spawnWidth as number, forwardDepth: controls.spawnForward as number, backDepth: controls.spawnBack as number },
  })

  return (
    <>
      {/* Sides: mesh 0-2 */}
      <instancedMesh ref={(n) => { meshesRef.current[0] = n }} args={[geoSidesH1, sideMat, CAPACITY]} castShadow receiveShadow frustumCulled={false} dispose={null} />
      <instancedMesh ref={(n) => { meshesRef.current[1] = n }} args={[geoSidesH2, sideMat, CAPACITY]} castShadow receiveShadow frustumCulled={false} dispose={null} />
      <instancedMesh ref={(n) => { meshesRef.current[2] = n }} args={[geoSidesH3, sideMat, CAPACITY]} castShadow receiveShadow frustumCulled={false} dispose={null} />
      {/* Tops: mesh 3-5 */}
      <instancedMesh ref={(n) => { meshesRef.current[3] = n }} args={[geoTopH1, topMat, CAPACITY]} castShadow receiveShadow frustumCulled={false} dispose={null} />
      <instancedMesh ref={(n) => { meshesRef.current[4] = n }} args={[geoTopH2, topMat, CAPACITY]} castShadow receiveShadow frustumCulled={false} dispose={null} />
      <instancedMesh ref={(n) => { meshesRef.current[5] = n }} args={[geoTopH3, topMat, CAPACITY]} castShadow receiveShadow frustumCulled={false} dispose={null} />
      {/* Flowers: mesh 6-8 */}
      <instancedMesh ref={(n) => { meshesRef.current[6] = n }} args={[geoFlowerH1, flowerMat, CAPACITY]} customDepthMaterial={flowerDepthMat} castShadow receiveShadow frustumCulled={false} dispose={null} />
      <instancedMesh ref={(n) => { meshesRef.current[7] = n }} args={[geoFlowerH2, flowerMat, CAPACITY]} customDepthMaterial={flowerDepthMat} castShadow receiveShadow frustumCulled={false} dispose={null} />
      <instancedMesh ref={(n) => { meshesRef.current[8] = n }} args={[geoFlowerH3, flowerMat, CAPACITY]} customDepthMaterial={flowerDepthMat} castShadow receiveShadow frustumCulled={false} dispose={null} />
    </>
  )
}
