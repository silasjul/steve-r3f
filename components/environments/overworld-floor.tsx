'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls, folder } from 'leva'
import { InstancedMesh, Object3D } from 'three'
import { BOX_GEOMETRY } from '@/components/blocks/_block'
import { useGrassBlockMaterials } from '@/components/blocks/grass-block'

const MAX_RADIUS = 25
const MAX_COUNT = (MAX_RADIUS * 2 + 1) ** 2
const tempObject = new Object3D()

export default function OverworldFloor() {
  const { speed, radius } = useControls({
    'Overworld Floor': folder(
      {
        speed: { value: -1, min: -3, max: 3, step: 0.1, label: 'Walk Speed' },
        radius: { value: 10, min: 4, max: MAX_RADIUS, step: 1, label: 'Radius' },
      },
      { collapsed: true }
    ),
  })

  const materials = useGrassBlockMaterials()

  const positions = useMemo(() => {
    const out: [number, number][] = []
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        out.push([x, z])
      }
    }
    return out
  }, [radius])

  const meshRef = useRef<InstancedMesh>(null)
  const offsets = useRef<number[]>([])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.count = positions.length
    offsets.current = new Array(positions.length).fill(0)
    for (let i = 0; i < positions.length; i++) {
      tempObject.position.set(positions[i][0], -0.5, positions[i][1])
      tempObject.updateMatrix()
      mesh.setMatrixAt(i, tempObject.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [positions])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    if (offsets.current.length !== positions.length) return
    const advance = speed * delta
    const span = radius * 2 + 1
    const limit = radius + 0.5
    for (let i = 0; i < positions.length; i++) {
      let o = offsets.current[i] + advance
      const baseZ = positions[i][1]
      while (baseZ + o > limit) o -= span
      while (baseZ + o < -limit) o += span
      offsets.current[i] = o
      tempObject.position.set(positions[i][0], -0.5, baseZ + o)
      tempObject.updateMatrix()
      mesh.setMatrixAt(i, tempObject.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[BOX_GEOMETRY, materials, MAX_COUNT]}
      dispose={null}
      castShadow
      receiveShadow
    />
  )
}
