'use client'

import { useMemo, useRef } from 'react'
import { Sky, Stars, useTexture } from '@react-three/drei'
import { DirectionalLight, MathUtils } from 'three'
import { useControls, folder } from 'leva'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import Ground from '../_ground'
import { EnvConfigProvider } from '../_env-config'
import { overworldNightConfig as C } from './config'
import { useGrassTopMaterial } from '@/components/blocks/grass-block'
import { ScatterWorld } from '@/components/scatter/_scatter-context'
import ShortGrassScatter from '@/components/scatter/short-grass-scatter'
import FlowerScatter from '@/components/scatter/flower-scatter'
import TreeScatter from '@/components/scatter/tree-scatter'
import PigScatter from '@/components/scatter/pig-scatter'
import RockScatter from '@/components/scatter/rock-scatter'
import CreeperScatter from '@/components/scatter/creeper-scatter'
import EndermanScatter from '@/components/scatter/enderman-scatter'
import ZombieScatter from '@/components/scatter/zombie-scatter'
import ChickenJockeyScatter from '@/components/scatter/chicken-jockey-scatter'
import WorldCurve from '@/components/world-curve'
import { useEnvStore } from '@/store/env-store'
import { WindClock, useWindControls } from '@/components/wind'

useTexture.preload('/textures/grass_block_top.png')
useTexture.preload('/textures/short_grass.png')
useTexture.preload('/textures/poppy.png')
useTexture.preload('/textures/oxeye_daisy.png')
useTexture.preload('/textures/white_tulip.png')
useTexture.preload('/textures/orange_tulip.png')
useTexture.preload('/textures/pink_tulip.png')
useTexture.preload('/textures/red_tulip.png')
useTexture.preload('/textures/stone.png')
useTexture.preload('/textures/coal_ore.png')

export default function OverworldNight() {
  const sunRef = useRef<DirectionalLight>(null)
  const material = useGrassTopMaterial()
  const radius = useEnvStore((s) => s.radius)
  const walkSpeed = useEnvStore((s) => s.walkSpeed)

  const stars = C.scene.stars!  // night always has stars
  const brightStars = stars.bright!

  const {
    bg,
    fogColor, fogNear, fogFar,
    skyElev, skyAzimuth, skyTurb, skyRayl,
    ambientInt, sunInt, sunColor, lightDist,
    starCount, starSaturation, brightStarCount, brightStarFactor,
    bloom, bloomThreshold,
    walkCorridorWidth,
  } = useControls({
    [C.label]: folder(
      {
        bg: { value: C.scene.bg, label: 'Background' },
        Sky: folder(
          {
            skyElev: { value: C.scene.sky!.elev, min: -10, max: 90, step: 0.5, label: 'Elevation' },
            skyAzimuth: { value: C.scene.sky!.azimuth, min: 0, max: 360, step: 1, label: 'Azimuth' },
            skyTurb: { value: C.scene.sky!.turb, min: 0, max: 20, step: 0.1, label: 'Turbidity' },
            skyRayl: { value: C.scene.sky!.rayl, min: 0, max: 6, step: 0.01, label: 'Rayleigh' },
          },
          { collapsed: true }
        ),
        Lighting: folder(
          {
            ambientInt: { value: C.scene.lighting.ambient, min: 0, max: 2, step: 0.01, label: 'Ambient' },
            sunInt: { value: C.scene.lighting.sunInt, min: 0, max: 5, step: 0.05, label: 'Moon Intensity' },
            sunColor: { value: C.scene.lighting.sunColor, label: 'Moon Color' },
            lightDist: { value: C.scene.lighting.lightDist, min: 1, max: 200, step: 1, label: 'Distance' },
          },
          { collapsed: true }
        ),
        Fog: folder(
          {
            fogColor: { value: C.scene.fog.color, label: 'Color' },
            fogNear: { value: C.scene.fog.near, min: 0, max: 200, step: 1, label: 'Near' },
            fogFar: { value: C.scene.fog.far, min: 10, max: 1000, step: 1, label: 'Far' },
          },
          { collapsed: true }
        ),
        Stars: folder(
          {
            starCount: { value: stars.count, min: 100, max: 15000, step: 100, label: 'Count' },
            starSaturation: { value: stars.saturation, min: 0, max: 1, step: 0.01, label: 'Saturation' },
            brightStarCount: { value: brightStars.count, min: 0, max: 2000, step: 10, label: 'Bright Count' },
            brightStarFactor: { value: brightStars.factor, min: 1, max: 30, step: 0.5, label: 'Bright Size' },
          },
          { collapsed: true }
        ),
        Bloom: folder(
          {
            bloom: { value: C.scene.bloom.intensity, min: 0, max: 3, step: 0.01, label: 'Intensity' },
            bloomThreshold: { value: C.scene.bloom.threshold, min: 0, max: 1, step: 0.01, label: 'Threshold' },
          },
          { collapsed: true }
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
          { collapsed: true }
        ),
      },
      { collapsed: true }
    ),
  })

  useWindControls()

  const sunDir = useMemo<[number, number, number]>(() => {
    const phi = MathUtils.degToRad(90 - skyElev)
    const theta = MathUtils.degToRad(skyAzimuth)
    return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)]
  }, [skyElev, skyAzimuth])

  return (
    <EnvConfigProvider value={C}>
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
        shadow-bias={0.00004}
        shadow-normalBias={0.01}
      />
      <Sky distance={450000} sunPosition={sunDir} turbidity={skyTurb} rayleigh={skyRayl} />
      <Stars radius={100} depth={50} count={starCount} factor={4} saturation={starSaturation} fade />
      <Stars radius={120} depth={40} count={brightStarCount} factor={brightStarFactor} saturation={starSaturation} fade />

      <WorldCurve />
      <WindClock />

      <Ground material={material} radius={radius} speed={walkSpeed} />

      <ScatterWorld speed={walkSpeed} radius={radius} walkCorridorWidth={walkCorridorWidth}>
        <TreeScatter />
        <RockScatter />
        <ShortGrassScatter />
        <FlowerScatter />
        <CreeperScatter />
        <EndermanScatter />
        <ZombieScatter />
        <ChickenJockeyScatter />
      </ScatterWorld>

      <EffectComposer>
        <Bloom intensity={bloom} luminanceThreshold={bloomThreshold} mipmapBlur />
      </EffectComposer>
    </EnvConfigProvider>
  )
}
