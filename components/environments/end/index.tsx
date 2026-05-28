'use client'

import { useRef } from 'react'
import { Stars, useTexture } from '@react-three/drei'
import { DirectionalLight } from 'three'
import { useControls, folder } from 'leva'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import Ground from '../_ground'
import { useSharedPixelMaterial } from '@/components/blocks/_block'
import { useEnvStore } from '@/store/env-store'

useTexture.preload('/textures/end_stone.png')

export default function End() {
  const sunRef = useRef<DirectionalLight>(null)
  const material = useSharedPixelMaterial('/textures/end_stone.png')
  const radius = useEnvStore((s) => s.radius)
  const walkSpeed = useEnvStore((s) => s.walkSpeed)

  const {
    bg,
    fogColor, fogNear, fogFar,
    ambientInt, sunInt, sunColor,
    starCount, starSaturation,
    bloom, bloomThreshold,
  } = useControls({
    End: folder(
      {
        bg: { value: '#0d001a', label: 'Background' },
        Lighting: folder(
          {
            ambientInt: { value: 0.2, min: 0, max: 2, step: 0.01, label: 'Ambient' },
            sunInt: { value: 0.4, min: 0, max: 5, step: 0.05, label: 'Light Intensity' },
            sunColor: { value: '#cc88ff', label: 'Light Color' },
          },
          { collapsed: true }
        ),
        Fog: folder(
          {
            fogColor: { value: '#1a0033', label: 'Color' },
            fogNear: { value: 30, min: 0, max: 30, step: 1, label: 'Near' },
            fogFar: { value: 180, min: 5, max: 100, step: 1, label: 'Far' },
          },
          { collapsed: true }
        ),
        Stars: folder(
          {
            starCount: { value: 10000, min: 100, max: 15000, step: 100, label: 'Count' },
            starSaturation: { value: 1, min: 0, max: 1, step: 0.01, label: 'Saturation' },
          },
          { collapsed: true }
        ),
        Bloom: folder(
          {
            bloom: { value: 1.2, min: 0, max: 3, step: 0.01, label: 'Intensity' },
            bloomThreshold: { value: 0.2, min: 0, max: 1, step: 0.01, label: 'Threshold' },
          },
          { collapsed: true }
        ),
      },
      { collapsed: true }
    ),
  })

  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

      <ambientLight intensity={ambientInt} />
      <directionalLight
        ref={sunRef}
        position={[0, 10, 0]}
        intensity={sunInt}
        color={sunColor}
      />

      <Stars radius={100} depth={50} count={starCount} factor={4} saturation={starSaturation} fade />

      <Ground material={material} radius={radius} speed={walkSpeed} />

      <EffectComposer>
        <Bloom intensity={bloom} luminanceThreshold={bloomThreshold} mipmapBlur />
      </EffectComposer>
    </>
  )
}
