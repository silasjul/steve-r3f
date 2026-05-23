'use client'

import { useEffect, useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useControls, folder } from 'leva'
import { Group } from 'three'

useGLTF.preload('/models/steve.glb')

export default function Steve() {
  const group = useRef<Group>(null)
  const { scene, animations } = useGLTF('/models/steve.glb')
  const { actions, names } = useAnimations(animations, group)
  const activeAction = useRef(actions[names[0]] ?? null)
  const speedRef = useRef(1)

  const animationOptions = names.length > 0 ? names : ['none']

  const { animation, speed, freeze } = useControls({
    Animation: folder(
      {
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

  return <primitive ref={group} object={scene} />
}
