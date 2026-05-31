'use client'

import { useRef } from 'react'
import { Stars, useTexture } from '@react-three/drei'
import { DirectionalLight } from 'three'
import { useControls, folder } from 'leva'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import Ground from '../_ground'
import { EnvConfigProvider } from '../_env-config'
import { endConfig as C } from './config'
import { useSharedPixelMaterial } from '@/components/blocks/_block'
import { ScatterWorld } from '@/components/scatter/_scatter-context'
import EndermanScatter from '@/components/scatter/enderman-scatter'
import ObsidianTowerScatter from '@/components/scatter/obsidian-tower-scatter'
import { useEnvStore } from '@/store/env-store'

useTexture.preload('/textures/end_stone.png')
useTexture.preload('/textures/obsidian.png')

export default function End() {
  const sunRef = useRef<DirectionalLight>(null)
  const material = useSharedPixelMaterial('/textures/end_stone.png')
  const radius = useEnvStore((s) => s.radius)
  const walkSpeed = useEnvStore((s) => s.walkSpeed)

  const stars = C.scene.stars!

  const {
    bg,
    fogColor, fogNear, fogFar,
    ambientInt, sunInt, sunColor,
    starCount, starSaturation,
    bloom, bloomThreshold,
    vignetteOffset, vignetteDarkness,
    walkCorridorWidth,
  } = useControls({
    [C.label]: folder(
      {
        bg: { value: C.scene.bg, label: 'Background' },
        Lighting: folder(
          {
            ambientInt: { value: C.scene.lighting.ambient, min: 0, max: 2, step: 0.01, label: 'Ambient' },
            sunInt: { value: C.scene.lighting.sunInt, min: 0, max: 5, step: 0.05, label: 'Light Intensity' },
            sunColor: { value: C.scene.lighting.sunColor, label: 'Light Color' },
          },
          { collapsed: true },
        ),
        Fog: folder(
          {
            fogColor: { value: C.scene.fog.color, label: 'Color' },
            fogNear: { value: C.scene.fog.near, min: 0, max: 200, step: 1, label: 'Near' },
            fogFar: { value: C.scene.fog.far, min: 5, max: 500, step: 1, label: 'Far' },
          },
          { collapsed: true },
        ),
        Stars: folder(
          {
            starCount: { value: stars.count, min: 100, max: 15000, step: 100, label: 'Count' },
            starSaturation: { value: stars.saturation, min: 0, max: 1, step: 0.01, label: 'Saturation' },
          },
          { collapsed: true },
        ),
        Bloom: folder(
          {
            bloom: { value: C.scene.bloom.intensity, min: 0, max: 3, step: 0.01, label: 'Intensity' },
            bloomThreshold: { value: C.scene.bloom.threshold, min: 0, max: 1, step: 0.01, label: 'Threshold' },
          },
          { collapsed: true },
        ),
        Vignette: folder(
          {
            vignetteOffset: { value: C.scene.vignette!.offset, min: 0, max: 1, step: 0.01, label: 'Offset' },
            vignetteDarkness: { value: C.scene.vignette!.darkness, min: 0, max: 1, step: 0.01, label: 'Darkness' },
          },
          { collapsed: true },
        ),
        Scatter: folder(
          {
            walkCorridorWidth: {
              value: C.scene.walkCorridorWidth,
              min: 0,
              max: 12,
              step: 0.1,
              label: 'Walk Corridor',
            },
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
    ),
  })

  return (
    <EnvConfigProvider value={C}>
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

      <ScatterWorld speed={walkSpeed} radius={radius} walkCorridorWidth={walkCorridorWidth}>
        <ObsidianTowerScatter />
        <EndermanScatter faceSteve />
      </ScatterWorld>

      <EffectComposer>
        <Bloom intensity={bloom} luminanceThreshold={bloomThreshold} mipmapBlur />
        <Vignette offset={vignetteOffset} darkness={vignetteDarkness} />
      </EffectComposer>
    </EnvConfigProvider>
  )
}
