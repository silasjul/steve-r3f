'use client'

import { useMemo, useRef } from 'react'
import { Sky } from '@react-three/drei'
import { DirectionalLight, MathUtils } from 'three'
import { useControls, folder } from 'leva'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

export default function OverworldDay() {
  const sunRef = useRef<DirectionalLight>(null)

  const {
    bg,
    fogColor, fogNear, fogFar,
    skyElev, skyAzimuth, skyTurb, skyRayl,
    ambientInt, sunInt, sunColor, lightDist,
    bloom, bloomThreshold,
  } = useControls({
    'Overworld Day': folder(
      {
        bg: { value: '#87ceeb', label: 'Background' },
        Sky: folder(
          {
            skyElev: { value: 45, min: -10, max: 90, step: 0.5, label: 'Elevation' },
            skyAzimuth: { value: 180, min: 0, max: 360, step: 1, label: 'Azimuth' },
            skyTurb: { value: 10, min: 0, max: 20, step: 0.1, label: 'Turbidity' },
            skyRayl: { value: 3, min: 0, max: 6, step: 0.01, label: 'Rayleigh' },
          },
          { collapsed: true }
        ),
        Lighting: folder(
          {
            ambientInt: { value: 0.4, min: 0, max: 2, step: 0.01, label: 'Ambient' },
            sunInt: { value: 1.8, min: 0, max: 5, step: 0.05, label: 'Sun Intensity' },
            sunColor: { value: '#fff5e0', label: 'Sun Color' },
            lightDist: { value: 10, min: 1, max: 200, step: 1, label: 'Distance' },
          },
          { collapsed: true }
        ),
        Fog: folder(
          {
            fogColor: { value: '#c9dff5', label: 'Color' },
            fogNear: { value: 60, min: 0, max: 200, step: 1, label: 'Near' },
            fogFar: { value: 500, min: 10, max: 1000, step: 1, label: 'Far' },
          },
          { collapsed: true }
        ),
        Bloom: folder(
          {
            bloom: { value: 0, min: 0, max: 3, step: 0.01, label: 'Intensity' },
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

      <EffectComposer>
        <Bloom intensity={bloom} luminanceThreshold={bloomThreshold} mipmapBlur />
      </EffectComposer>
    </>
  )
}
