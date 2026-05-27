'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, InstancedMesh, MeshStandardMaterial, Object3D } from 'three'
import { PLANE_GEOMETRY } from '@/components/blocks/_block'

export const MAX_RADIUS = 25
const MAX_COUNT = (MAX_RADIUS * 2 + 1) ** 2
const tempObject = new Object3D()

type Props = {
  material: MeshStandardMaterial
  radius: number
  speed: number
}

/**
 * Disc of 1×1 floor planes wrapped in a group. The group slides with `speed`
 * and snaps back by one tile width whenever it has drifted half a tile from
 * origin — invisible because the uniform grid aligns the same way at every
 * integer offset, so no per-instance updates after init.
 */
export default function Ground({ material, radius, speed }: Props) {
  const groupRef = useRef<Group>(null)
  const meshRef = useRef<InstancedMesh>(null)

  const tiles = useMemo(() => {
    const out: { x: number; z: number }[] = []
    // Shrink radius² slightly so the four cardinal tiles get clipped —
    // otherwise they stick out as isolated single-tile spikes.
    const r2 = radius * radius - 0.5
    for (let x = -radius; x <= radius; x++) {
      const rem = r2 - x * x
      if (rem < 0) continue
      const halfH = Math.floor(Math.sqrt(rem))
      for (let z = -halfH; z <= halfH; z++) out.push({ x, z })
    }
    return out
  }, [radius])

  useEffect(() => {
    const mesh = meshRef.current
    const group = groupRef.current
    if (!mesh || !group) return
    mesh.count = tiles.length
    group.position.set(0, 0, 0)
    tempObject.rotation.set(-Math.PI / 2, 0, 0)
    for (let i = 0; i < tiles.length; i++) {
      tempObject.position.set(tiles[i].x, 0, tiles[i].z)
      tempObject.updateMatrix()
      mesh.setMatrixAt(i, tempObject.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [tiles])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    group.position.z += speed * delta
    if (group.position.z > 0.5) group.position.z -= 1
    else if (group.position.z < -0.5) group.position.z += 1
  })

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        args={[PLANE_GEOMETRY, material, MAX_COUNT]}
        dispose={null}
        castShadow
        receiveShadow
      />
    </group>
  )
}
