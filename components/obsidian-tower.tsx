'use client'

import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OctahedronGeometry,
} from 'three'
import { PLANE_GEOMETRY, useSharedPixelMaterial } from './blocks/_block'

useTexture.preload('/textures/obsidian.png')

interface Props {
  /** Circle radius in world units (= blocks). Voxelized to a unit-block ring. */
  radius?: number
  /** Tower height in blocks (rounded to int). */
  height?: number
  /** Position of the tower base (y is the ground plane). */
  position?: [number, number, number]
  glowColor?: string
  glowIntensity?: number
  glowDistance?: number
}

const scratchObj = new Object3D()

// Outward-facing neighbour offsets + the matching face transform for each.
// PLANE_GEOMETRY's normal is +Z so rotations align that normal with the
// neighbour direction; offset places the quad on the cell's outer wall.
const FACE_DIRS: ReadonlyArray<{
  dx: number
  dz: number
  rotY: number
  ox: number
  oz: number
}> = [
    { dx: 1, dz: 0, rotY: Math.PI / 2, ox: 0.5, oz: 0 },
    { dx: -1, dz: 0, rotY: -Math.PI / 2, ox: -0.5, oz: 0 },
    { dx: 0, dz: 1, rotY: 0, ox: 0, oz: 0.5 },
    { dx: 0, dz: -1, rotY: Math.PI, ox: 0, oz: -0.5 },
  ]

// Shared geometry for the glowing crystal that sits atop every tower —
// rotated, it reads as an end-crystal-style gem.
const CRYSTAL_GEOMETRY = new OctahedronGeometry(0.7, 0)

function buildWallMatrices(radius: number, h: number): Matrix4[] {
  const r2 = radius * radius
  const R = Math.ceil(radius)
  // Mark every integer cell whose center falls inside the circle. Using cell
  // centers (not corners) gives a Minecraft-style voxel approximation that
  // stays radially symmetric for half-integer radii.
  const inside = (i: number, j: number): boolean => {
    const cx = i + 0.5
    const cz = j + 0.5
    return cx * cx + cz * cz <= r2
  }

  const ringCells: Array<readonly [number, number]> = []
  for (let i = -R; i < R; i++) {
    for (let j = -R; j < R; j++) {
      if (!inside(i, j)) continue
      // Only blocks with at least one exposed side-neighbour belong on the
      // outer wall — interior cells contribute nothing visible.
      let exposed = false
      for (const d of FACE_DIRS) {
        if (!inside(i + d.dx, j + d.dz)) {
          exposed = true
          break
        }
      }
      if (exposed) ringCells.push([i, j] as const)
    }
  }

  const out: Matrix4[] = []
  for (const [i, j] of ringCells) {
    const cx = i + 0.5
    const cz = j + 0.5
    for (let y = 0; y < h; y++) {
      const cy = y + 0.5
      for (const d of FACE_DIRS) {
        if (inside(i + d.dx, j + d.dz)) continue
        scratchObj.position.set(cx + d.ox, cy, cz + d.oz)
        scratchObj.rotation.set(0, d.rotY, 0)
        scratchObj.updateMatrix()
        out.push(scratchObj.matrix.clone())
      }
    }
  }
  return out
}

const ObsidianTower = forwardRef<Group, Props>(function ObsidianTower(
  {
    radius = 2,
    height = 20,
    position = [0, 0, 0],
    glowColor = '#ff7733',
    glowIntensity = 14,
    glowDistance = 22,
  },
  ref,
) {
  const material = useSharedPixelMaterial('/textures/obsidian.png')

  const h = Math.max(1, Math.round(height))

  const matrices = useMemo(() => buildWallMatrices(radius, h), [radius, h])

  // Push the bloom-emitting crystal's base color above 1.0 (and disable tone
  // mapping) so the EffectComposer's Bloom pass treats it as an HDR source and
  // produces a visible glow halo instead of a flat-coloured shape.
  const crystalMaterial = useMemo(() => {
    const c = new Color(glowColor).multiplyScalar(
      Math.max(1, glowIntensity * 0.4),
    )
    return new MeshBasicMaterial({
      color: c,
      toneMapped: false,
      // Fog would blend the HDR color back toward the dark fog color at
      // distance, dropping it below the bloom threshold and killing the glow.
      fog: false,
    })
  }, [glowColor, glowIntensity])

  const meshRef = useRef<InstancedMesh>(null)
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i])
    mesh.count = matrices.length
    mesh.instanceMatrix.needsUpdate = true
  }, [matrices])

  const crystalRef = useRef<Mesh>(null)
  useFrame((state, delta) => {
    const c = crystalRef.current
    if (!c) return
    c.rotation.y += delta * 0.6
    const baseY = h + 1.1
    c.position.y = baseY + Math.sin(state.clock.elapsedTime * 2) * 0.3
  })

  return (
    <group ref={ref} position={position}>
      <instancedMesh
        ref={meshRef}
        args={[PLANE_GEOMETRY, material, matrices.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
        dispose={null}
      />
      <mesh
        ref={crystalRef}
        geometry={CRYSTAL_GEOMETRY}
        material={crystalMaterial}
        position={[0, h + 1.1, 0]}
        // Without this, when the camera tilts so the crystal's bounding sphere
        // falls just outside the frustum the mesh is skipped — no bright
        // pixels render, so bloom can't halo into the visible area.
        frustumCulled={false}
      />
      <pointLight
        position={[0, h + 1.1, 0]}
        color={glowColor}
        intensity={glowIntensity}
        distance={glowDistance}
        decay={2}
        castShadow={false}
      />
    </group>
  )
})

export default ObsidianTower
