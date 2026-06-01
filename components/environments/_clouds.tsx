'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { useControls, folder } from 'leva'
import { useEnvLabel } from './_env-config'
import { spawnZoneControlsSchema } from '@/components/scatter/_use-pool-controls'

type CloudMap = { data: Uint8Array; n: number }

/** Sampled cloud map value (0–255) at an integer world cell, tiling the map. */
function sampleMap(map: CloudMap, x: number, z: number): number {
  const n = map.n
  const ix = ((x % n) + n) % n
  const iz = ((z % n) + n) % n
  return map.data[iz * n + ix]
}

/**
 * Deterministic per-cell hash in [0, 1). Stable for a given world cell so a
 * cloud block doesn't flicker in/out as the layer scrolls — used to thin the
 * (often binary) cloud map down to the requested coverage fraction.
 */
function hash2(x: number, z: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967296
}

type BuildParams = {
  size: number
  spawnWidth: number
  spawnForward: number
  spawnBack: number
  coverage: number
  /** Shifts where the (tiling) cloud map is sampled, so different scenes can
   *  reuse the same map yet show a different pattern. Geometry stays centered. */
  mapOffsetX: number
  mapOffsetZ: number
}

type Vec3 = readonly [number, number, number]
/**
 * The six cube faces. `u`/`v` are the in-plane axes with `u × v = n` so the quad
 * winds CCW outward (front-facing). Side faces carry the neighbour direction
 * (`di`,`dj`) and are skipped when that neighbour is filled, so adjacent blocks
 * merge into one shell with no internal walls. Top/bottom are always emitted
 * (the layer is one block high).
 */
const FACES: { n: Vec3; u: Vec3; v: Vec3; di: number; dj: number; vertical: boolean }[] = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], di: 1, dj: 0, vertical: false },
  { n: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, -1], di: -1, dj: 0, vertical: false },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], di: 0, dj: 1, vertical: false },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], di: 0, dj: -1, vertical: false },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], di: 0, dj: 0, vertical: true },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], di: 0, dj: 0, vertical: true },
]
const CORNERS: readonly [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
]

function fillKey(i: number, j: number): number {
  return (i + 4096) * 1_000_000 + (j + 4096)
}

/**
 * Build a single merged geometry for the window at the given block offset. Each
 * filled cell contributes a one-block-high cube, but faces shared with a filled
 * neighbour are culled — so every connected clump of cells reads as one solid
 * cloud instead of a pile of separate blocks (obvious once opacity drops below 1).
 */
function buildGeometry(map: CloudMap, cellOffset: number, p: BuildParams): BufferGeometry {
  const { size, spawnWidth, spawnForward, spawnBack, coverage, mapOffsetX, mapOffsetZ } = p
  const half = size / 2
  const iMax = Math.ceil(spawnWidth / 2 / size)
  const jForward = Math.ceil(spawnForward / size)
  const jBack = Math.ceil(spawnBack / size)

  const filled = new Set<number>()
  const cells: [number, number][] = []
  for (let i = -iMax; i <= iMax; i++) {
    for (let j = -jBack; j <= jForward; j++) {
      const wz = j + cellOffset
      if (sampleMap(map, i + mapOffsetX, wz + mapOffsetZ) <= 128) continue
      if (hash2(i + mapOffsetX, wz + mapOffsetZ) >= coverage) continue
      filled.add(fillKey(i, j))
      cells.push([i, j])
    }
  }

  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  let vbase = 0
  for (const [i, j] of cells) {
    const cx = i * size
    const cz = j * size
    for (const f of FACES) {
      if (!f.vertical && filled.has(fillKey(i + f.di, j + f.dj))) continue
      const [nx, ny, nz] = f.n
      const fx = cx + nx * half
      const fy = ny * half
      const fz = cz + nz * half
      const [ux, uy, uz] = f.u
      const [vx, vy, vz] = f.v
      for (const [su, sv] of CORNERS) {
        positions.push(
          fx + (ux * su + vx * sv) * half,
          fy + (uy * su + vy * sv) * half,
          fz + (uz * su + vz * sv) * half
        )
        normals.push(nx, ny, nz)
      }
      indices.push(vbase, vbase + 1, vbase + 2, vbase, vbase + 2, vbase + 3)
      vbase += 4
    }
  }

  const geom = new BufferGeometry()
  geom.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geom.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geom.setIndex(indices)
  return geom
}

type Props = {
  /** World scroll speed — same value <Ground> gets. */
  speed: number
  /** Altitude of the cloud layer. */
  height?: number
  /** Edge length of one cloud block (world units). */
  size?: number
  /** Fraction of cloud-map cells that actually spawn a block (0–1). */
  coverage?: number
  color?: string
  opacity?: number
  /** Drift speed relative to the ground (clouds are far, so they lag). */
  parallax?: number
  /** Default spawn window — Width / Forward Depth / Back Depth, like a scatterer. */
  zone?: { width: number; forwardDepth: number; backDepth: number }
  /** Shift (in cloud cells) into the shared map, so scenes reusing the same
   *  map show different cloud patterns. */
  mapOffset?: { x: number; z: number }
}

/**
 * Minecraft-style voxel clouds generated from `clouds.png` (a 256×256 cloud
 * map). The map is read once into a value grid and tiled across the world; each
 * filled cell becomes a one-block-high cube, and adjacent cubes are merged into
 * a single face-culled shell so a clump reads as one cloud (not scattered
 * blocks) even with the opacity turned down.
 *
 * The window behaves like the scatterers — Width / Forward Depth / Back Depth
 * govern where clouds appear ahead and disappear behind. The layer drifts
 * smoothly (sub-cell) and only rebuilds its geometry when it crosses a block
 * boundary, so it's cheap. The <WorldCurve> bend is applied automatically at the
 * shader-chunk level, so the layer droops at the horizon like the ground.
 */
export default function Clouds({
  speed,
  height = 15,
  size = 0.7,
  coverage = 1,
  color = '#ffffff',
  opacity = 0.35,
  parallax = 0.25,
  zone = { width: 65, forwardDepth: 48, backDepth: 48 },
  mapOffset = { x: 0, z: 0 },
}: Props) {
  const groupRef = useRef<Group>(null)
  const meshRef = useRef<Mesh>(null)
  const depthRef = useRef<Mesh>(null)
  const tex = useTexture('/textures/clouds.png')

  const envLabel = useEnvLabel()
  const c = useControls(envLabel, {
    Clouds: folder(
      {
        enabled: { value: true, label: 'Enabled' },
        height: { value: height, min: 5, max: 80, step: 0.5, label: 'Height' },
        size: { value: size, min: 0.5, max: 8, step: 0.1, label: 'Block Size' },
        coverage: { value: coverage, min: 0, max: 1, step: 0.01, label: 'Coverage' },
        color: { value: color, label: 'Color' },
        opacity: { value: opacity, min: 0, max: 1, step: 0.01, label: 'Opacity' },
        parallax: { value: parallax, min: 0, max: 2, step: 0.01, label: 'Drift Speed' },
        'Spawn Zone': folder(spawnZoneControlsSchema(zone), { collapsed: true }),
      },
      { collapsed: true }
    ),
  })
  const enabled = c.enabled as boolean
  const cHeight = c.height as number
  const cSize = c.size as number
  const cCoverage = c.coverage as number
  const cColor = c.color as string
  const cOpacity = c.opacity as number
  const cParallax = c.parallax as number
  const spawnWidth = c.spawnWidth as number
  const spawnForward = c.spawnForward as number
  const spawnBack = c.spawnBack as number

  // Read the cloud map once: draw it to a canvas and keep a value grid. Prefer
  // the alpha channel (clouds.png is white shapes on transparent); if the image
  // is fully opaque, fall back to luminance.
  const cloudMap = useMemo<CloudMap | null>(() => {
    const img = tex.image as (CanvasImageSource & { width?: number; height?: number }) | undefined
    if (!img || !img.width || !img.height) return null
    const n = img.width
    const h = img.height
    const canvas = document.createElement('canvas')
    canvas.width = n
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, n, h)
    const count = n * h
    let hasAlpha = false
    for (let p = 0; p < count; p++) {
      if (data[p * 4 + 3] < 250) {
        hasAlpha = true
        break
      }
    }
    const raw = new Uint8Array(count)
    for (let p = 0; p < count; p++) {
      raw[p] = hasAlpha
        ? data[p * 4 + 3]
        : (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3
    }
    // Rotate the map 90° clockwise: out[r][cc] = raw[n-1-cc][r] (square map).
    const out = new Uint8Array(count)
    for (let r = 0; r < h; r++) {
      for (let cc = 0; cc < n; cc++) {
        out[r * n + cc] = raw[(h - 1 - cc) * n + r]
      }
    }
    return { data: out, n }
  }, [tex, tex.image])

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: cColor,
        transparent: cOpacity < 1,
        opacity: cOpacity,
        // Depth is laid down by the prepass; this pass only writes color so each
        // pixel blends exactly one (nearest) surface — overlapping clouds never
        // stack their alpha and darken.
        depthWrite: false,
        // Clouds are a far overhead layer; scene fog (heavy in the night scene)
        // would otherwise tint them toward the fog color.
        fog: false,
      }),
    [cColor, cOpacity]
  )
  // Depth-only prepass: a MeshStandardMaterial (same vertex path → identical
  // depth, no z-fighting) that writes depth but no colour.
  const depthMaterial = useMemo(() => new MeshStandardMaterial({ colorWrite: false }), [])
  useEffect(
    () => () => {
      material.dispose()
      depthMaterial.dispose()
    },
    [material, depthMaterial]
  )

  // A stable starter geometry, shared by both passes; replaced (and disposed) on
  // each rebuild.
  const initialGeom = useMemo(() => new BufferGeometry(), [])
  const geomRef = useRef<BufferGeometry>(initialGeom)
  useEffect(() => () => geomRef.current.dispose(), [])

  const offsetRef = useRef(0)
  const lastCellRef = useRef(Number.NaN)
  const sigRef = useRef('')
  const mapRef = useRef<CloudMap | null>(null)

  useFrame((_, rawDt) => {
    const group = groupRef.current
    const mesh = meshRef.current
    if (!group || !mesh) return
    group.visible = enabled
    if (!enabled || !cloudMap) return

    group.position.set(0, cHeight, group.position.z)

    const dt = Math.min(rawDt, 1 / 30)
    offsetRef.current += speed * cParallax * dt
    const cellOffset = Math.floor(offsetRef.current / cSize)
    const frac = offsetRef.current - cellOffset * cSize
    group.position.z = -frac

    const sig = `${cSize}|${spawnWidth}|${spawnForward}|${spawnBack}|${cCoverage}|${mapOffset.x}|${mapOffset.z}`
    if (cellOffset !== lastCellRef.current || sig !== sigRef.current || cloudMap !== mapRef.current) {
      const geom = buildGeometry(cloudMap, cellOffset, {
        size: cSize,
        spawnWidth,
        spawnForward,
        spawnBack,
        coverage: cCoverage,
        mapOffsetX: mapOffset.x,
        mapOffsetZ: mapOffset.z,
      })
      geomRef.current.dispose()
      geomRef.current = geom
      mesh.geometry = geom
      if (depthRef.current) depthRef.current.geometry = geom
      lastCellRef.current = cellOffset
      sigRef.current = sig
      mapRef.current = cloudMap
    }
  })

  return (
    <group ref={groupRef} position={[0, cHeight, 0]}>
      {/* Depth prepass — after the sky (so its colour is already in the buffer),
          before the colour pass; writes depth only. */}
      <mesh
        ref={depthRef}
        geometry={initialGeom}
        material={depthMaterial}
        renderOrder={1}
        frustumCulled={false}
      />
      <mesh
        ref={meshRef}
        geometry={initialGeom}
        material={material}
        renderOrder={2}
        castShadow={false}
        receiveShadow={false}
        frustumCulled={false}
      />
    </group>
  )
}
