'use client'

import { useMemo, useRef } from 'react'
import { Sky, Stars, useTexture } from '@react-three/drei'
import { DirectionalLight, MathUtils } from 'three'
import { useControls, folder } from 'leva'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import Ground from '../_ground'
import { useGrassTopMaterial } from '@/components/blocks/grass-block'
import { useEnvStore } from '@/store/env-store'

useTexture.preload('/textures/grass_block_top.png')

export default function OverworldNight() {
  const sunRef = useRef<DirectionalLight>(null)
  const material = useGrassTopMaterial()
  const radius = useEnvStore((s) => s.radius)
  const walkSpeed = useEnvStore((s) => s.walkSpeed)

  const {
    bg,
    fogColor, fogNear, fogFar,
    skyElev, skyAzimuth, skyTurb, skyRayl,
    ambientInt, sunInt, sunColor, lightDist,
    starCount, starSaturation,
    bloom, bloomThreshold,
  } = useControls({
    'Overworld Night': folder(
      {
        bg: { value: '#050510', label: 'Background' },
        Sky: folder(
          {
            skyElev: { value: 15.5, min: -10, max: 90, step: 0.5, label: 'Elevation' },
            skyAzimuth: { value: 253, min: 0, max: 360, step: 1, label: 'Azimuth' },
            skyTurb: { value: 0, min: 0, max: 20, step: 0.1, label: 'Turbidity' },
            skyRayl: { value: 0.07, min: 0, max: 6, step: 0.01, label: 'Rayleigh' },
          },
          { collapsed: true }
        ),
        Lighting: folder(
          {
            ambientInt: { value: 0.53, min: 0, max: 2, step: 0.01, label: 'Ambient' },
            sunInt: { value: 2.55, min: 0, max: 5, step: 0.05, label: 'Moon Intensity' },
            sunColor: { value: '#8585ce', label: 'Moon Color' },
            lightDist: { value: 10, min: 1, max: 200, step: 1, label: 'Distance' },
          },
          { collapsed: true }
        ),
        Fog: folder(
          {
            fogColor: { value: '#1391f8', label: 'Color' },
            fogNear: { value: 45, min: 0, max: 200, step: 1, label: 'Near' },
            fogFar: { value: 337, min: 10, max: 1000, step: 1, label: 'Far' },
          },
          { collapsed: true }
        ),
        Stars: folder(
          {
            starCount: { value: 8000, min: 100, max: 15000, step: 100, label: 'Count' },
            starSaturation: { value: 0, min: 0, max: 1, step: 0.01, label: 'Saturation' },
          },
          { collapsed: true }
        ),
        Bloom: folder(
          {
            bloom: { value: 0.08, min: 0, max: 3, step: 0.01, label: 'Intensity' },
            bloomThreshold: { value: 0.9, min: 0, max: 1, step: 0.01, label: 'Threshold' },
          },
          { collapsed: true }
        ),
      },
      { collapsed: true }
    ),
  })

  const sunDir = useMemo<[number, number, number]>(() => {
    const phi = MathUtils.degToRad(90 - skyElev)
    const theta = MathUtils.degToRad(skyAzimuth)
    return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)]
  }, [skyElev, skyAzimuth])

  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

      <ambientLight intensity={ambientInt} />
      <directionalLight
        ref={sunRef}
        position={[sunDir[0] * lightDist, sunDir[1] * lightDist, sunDir[2] * lightDist]}
        intensity={sunInt}
        color={sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-bias={-0.0005}
      />

      <Sky distance={450000} sunPosition={sunDir} turbidity={skyTurb} rayleigh={skyRayl} />
      <Stars radius={100} depth={50} count={starCount} factor={4} saturation={starSaturation} fade />

      <Ground material={material} radius={radius} speed={walkSpeed} />

      <EffectComposer>
        <Bloom intensity={bloom} luminanceThreshold={bloomThreshold} mipmapBlur />
      </EffectComposer>
    </>
  )
}
