'use client'

import { useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { DirectionalLight } from 'three'
import { useControls, folder } from 'leva'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import Ground, { MAX_RADIUS } from '../_ground'
import { useSharedPixelMaterial } from '@/components/blocks/_block'

useTexture.preload('/textures/netherrack.png')

export default function Nether() {
  const sunRef = useRef<DirectionalLight>(null)
  const material = useSharedPixelMaterial('/textures/netherrack.png')

  const {
    bg,
    fogColor, fogNear, fogFar,
    ambientInt, sunInt, sunColor,
    bloom, bloomThreshold,
    walkSpeed, radius,
  } = useControls({
    Nether: folder(
      {
        bg: { value: '#2d0a00', label: 'Background' },
        Lighting: folder(
          {
            ambientInt: { value: 0.6, min: 0, max: 2, step: 0.01, label: 'Ambient' },
            sunInt: { value: 0.0, min: 0, max: 5, step: 0.05, label: 'Glow Intensity' },
            sunColor: { value: '#ff4400', label: 'Glow Color' },
          },
          { collapsed: true }
        ),
        Fog: folder(
          {
            fogColor: { value: '#6b1500', label: 'Color' },
            fogNear: { value: 10, min: 0, max: 200, step: 1, label: 'Near' },
            fogFar: { value: 80, min: 10, max: 1000, step: 1, label: 'Far' },
          },
          { collapsed: true }
        ),
        Bloom: folder(
          {
            bloom: { value: 1.5, min: 0, max: 3, step: 0.01, label: 'Intensity' },
            bloomThreshold: { value: 0.1, min: 0, max: 1, step: 0.01, label: 'Threshold' },
          },
          { collapsed: true }
        ),
        Movement: folder(
          {
            walkSpeed: { value: -1, min: -3, max: 3, step: 0.1, label: 'Walk Speed' },
          },
          { collapsed: true }
        ),
      },
      { collapsed: true }
    ),
    Tiles: folder(
      {
        radius: { value: 10, min: 4, max: MAX_RADIUS, step: 1, label: 'Radius' },
      },
      { collapsed: true }
    ),
  })

  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

      <ambientLight intensity={ambientInt} color={sunColor} />
      <directionalLight
        ref={sunRef}
        position={[0, 10, 0]}
        intensity={sunInt}
        color={sunColor}
      />

      <Ground material={material} radius={radius} speed={walkSpeed} />

      <EffectComposer>
        <Bloom intensity={bloom} luminanceThreshold={bloomThreshold} mipmapBlur />
      </EffectComposer>
    </>
  )
}
