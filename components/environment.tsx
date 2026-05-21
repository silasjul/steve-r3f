'use client'

import { useEffect, useMemo } from 'react'
import { Sky, Stars } from '@react-three/drei'
import { useControls, folder } from 'leva'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { MathUtils } from 'three'

type World = 'overworld-day' | 'overworld-night' | 'nether' | 'end'

const PRESETS: Record<World, {
  bg: string
  fogColor: string; fogNear: number; fogFar: number
  skyElev: number; skyAzimuth: number; skyTurb: number; skyRayl: number
  stars: boolean; starCount: number; starSaturation: number
  bloom: number; bloomThreshold: number
}> = {
  'overworld-day': {
    bg: '#87ceeb',
    fogColor: '#c9dff5', fogNear: 60, fogFar: 500,
    skyElev: 45, skyAzimuth: 180, skyTurb: 10, skyRayl: 3,
    stars: false, starCount: 1000, starSaturation: 0,
    bloom: 0.2, bloomThreshold: 0.9,
  },
  'overworld-night': {
    bg: '#050510',
    fogColor: '#1391f8', fogNear: 45, fogFar: 337,
    skyElev: 15.5, skyAzimuth: 253, skyTurb: 0, skyRayl: 0.07,
    stars: true, starCount: 12000, starSaturation: 0,
    bloom: 0.08, bloomThreshold: 0.9,
  },
  nether: {
    bg: '#2d0a00',
    fogColor: '#6b1500', fogNear: 10, fogFar: 80,
    skyElev: 0, skyAzimuth: 0, skyTurb: 0, skyRayl: 0,
    stars: false, starCount: 0, starSaturation: 0,
    bloom: 1.5, bloomThreshold: 0.1,
  },
  end: {
    bg: '#0d001a',
    fogColor: '#1a0033', fogNear: 30, fogFar: 180,
    skyElev: 0, skyAzimuth: 0, skyTurb: 0, skyRayl: 0,
    stars: true, starCount: 10000, starSaturation: 1,
    bloom: 1.2, bloomThreshold: 0.2,
  },
}

export default function Environment() {
  const [
    { world, fogColor, fogNear, fogFar, skyElev, skyAzimuth, skyTurb, skyRayl, stars, starCount, starSaturation, bloom, bloomThreshold },
    set,
  ] = useControls(() => ({
    Environment: folder(
      {
        world: { value: 'overworld-night' as World, options: ['overworld-day', 'overworld-night', 'nether', 'end'] as World[], label: 'World' },
        Sky: folder({
          skyElev: { value: 15.5, min: -10, max: 90, step: 0.5, label: 'Elevation' },
          skyAzimuth: { value: 270, min: 0, max: 360, step: 1, label: 'Azimuth' },
          skyTurb: { value: 0, min: 0, max: 20, step: 0.1, label: 'Turbidity' },
          skyRayl: { value: 0.07, min: 0, max: 6, step: 0.01, label: 'Rayleigh' },
        }),
        Fog: folder({
          fogColor: { value: '#1391f8', label: 'Color' },
          fogNear: { value: 45, min: 0, max: 200, step: 1, label: 'Near' },
          fogFar: { value: 337, min: 10, max: 1000, step: 1, label: 'Far' },
        }),
        Stars: folder({
          stars: { value: true, label: 'Enabled' },
          starCount: { value: 12000, min: 100, max: 15000, step: 100, label: 'Count' },
          starSaturation: { value: 0, min: 0, max: 1, step: 0.01, label: 'Saturation' },
        }),
        Bloom: folder({
          bloom: { value: 0.08, min: 0, max: 3, step: 0.01, label: 'Intensity' },
          bloomThreshold: { value: 0.9, min: 0, max: 1, step: 0.01, label: 'Threshold' },
        }),
      },
      { collapsed: true }
    ),
  }))

  useEffect(() => {
    const p = PRESETS[world as World]
    set({
      fogColor: p.fogColor, fogNear: p.fogNear, fogFar: p.fogFar,
      skyElev: p.skyElev, skyAzimuth: p.skyAzimuth, skyTurb: p.skyTurb, skyRayl: p.skyRayl,
      stars: p.stars, starCount: p.starCount, starSaturation: p.starSaturation,
      bloom: p.bloom, bloomThreshold: p.bloomThreshold,
    })
  }, [world, set])

  const sunPosition = useMemo<[number, number, number]>(() => {
    const phi = MathUtils.degToRad(90 - skyElev)
    const theta = MathUtils.degToRad(skyAzimuth)
    return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)]
  }, [skyElev, skyAzimuth])

  const showSky = world === 'overworld-day' || world === 'overworld-night'

  return (
    <>
      <color attach="background" args={[PRESETS[world as World].bg]} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

      {showSky && (
        <Sky distance={450000} sunPosition={sunPosition} turbidity={skyTurb} rayleigh={skyRayl} />
      )}

      {stars && (
        <Stars radius={100} depth={50} count={starCount} factor={4} saturation={starSaturation} fade />
      )}

      <EffectComposer>
        <Bloom intensity={bloom} luminanceThreshold={bloomThreshold} mipmapBlur />
      </EffectComposer>
    </>
  )
}
