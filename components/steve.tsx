'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useControls, folder } from 'leva'
import { Box3, Group, Mesh, MeshStandardMaterial, NearestFilter, NearestMipmapLinearFilter, Texture } from 'three'

useGLTF.preload('/models/steve.glb')

const TARGET_HEIGHT_BLOCKS = 1.8

export default function Steve() {
  const group = useRef<Group>(null)
  const { scene, animations } = useGLTF('/models/steve.glb')
  const { actions, names } = useAnimations(animations, group)
  const activeAction = useRef(actions[names[0]] ?? null)
  const speedRef = useRef(1)

  const animationOptions = names.length > 0 ? names : ['none']

  const { animation, speed, freeze, scaleMultiplier } = useControls({
    Steve: folder(
      {
        scaleMultiplier: { value: 1.5, min: 1.3, max: 1.8, step: 0.01, label: 'Scale' },
        freeze: { value: false, label: 'Freeze' },
        animation: {
          value: animationOptions[1],
          options: animationOptions,
        },
        speed: { value: 0.85, min: 0.1, max: 3, step: 0.01, label: 'Speed' },
      },
      { collapsed: true }
    ),
  })

  const { autoScale, footOffset } = useMemo(() => {
    const box = new Box3().setFromObject(scene)
    const height = box.max.y - box.min.y
    const auto = height > 0 ? TARGET_HEIGHT_BLOCKS / height : 1
    return { autoScale: auto, footOffset: -box.min.y * auto }
  }, [scene])

  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as Mesh).isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
        const mats = Array.isArray((obj as Mesh).material)
          ? ((obj as Mesh).material as MeshStandardMaterial[])
          : [(obj as Mesh).material as MeshStandardMaterial]
        for (const mat of mats) {
          for (const key of Object.keys(mat) as (keyof MeshStandardMaterial)[]) {
            const val = mat[key]
            if (val instanceof Texture) {
              val.magFilter = NearestFilter
              val.minFilter = NearestMipmapLinearFilter
              val.needsUpdate = true
            }
          }
        }
      }
    })
  }, [scene])

  const finalScale = autoScale * scaleMultiplier
  const finalY = footOffset * scaleMultiplier

  useEffect(() => {
    Object.values(actions).forEach((a) => a?.stop())
    if (!freeze && animation !== 'none') {
      const action = actions[animation]?.reset().fadeIn(0.2).play()
      if (action) {
        action.timeScale = speedRef.current
        activeAction.current = action
      }
    }
  }, [animation, actions, freeze])

  useEffect(() => {
    speedRef.current = speed
    if (activeAction.current) {
      activeAction.current.timeScale = speed
    }
  }, [speed])

  return <primitive ref={group} object={scene} scale={finalScale} position={[0, finalY, 0]} />
}
