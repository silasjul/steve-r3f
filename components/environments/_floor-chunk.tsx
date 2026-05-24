'use client'

import { useEffect, useRef } from 'react'
import { InstancedMesh, MeshStandardMaterial, Object3D } from 'three'
import { PLANE_GEOMETRY } from '@/components/blocks/_block'

const tempObject = new Object3D()

type Props = {
  material: MeshStandardMaterial
  width: number
  length: number
}

/**
 * A flat instanced grid of 1x1 plane "blocks" centered on its parent group.
 * The grid spans `width` along X and `length` along Z.
 */
export default function FloorChunk({ material, width, length }: Props) {
  const meshRef = useRef<InstancedMesh>(null)
  const count = width * length

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.count = count
    tempObject.rotation.set(-Math.PI / 2, 0, 0)
    const halfW = (width - 1) / 2
    const halfL = (length - 1) / 2
    let i = 0
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < length; z++) {
        tempObject.position.set(x - halfW, 0, z - halfL)
        tempObject.updateMatrix()
        mesh.setMatrixAt(i++, tempObject.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [width, length, count])

  return (
    <instancedMesh
      ref={meshRef}
      args={[PLANE_GEOMETRY, material, count]}
      dispose={null}
      castShadow
      receiveShadow
    />
  )
}
