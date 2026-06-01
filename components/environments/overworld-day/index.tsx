'use client'

import { useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { DirectionalLight, MathUtils } from 'three'
import { useControls, folder } from 'leva'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import Ground from '../_ground'
import CurvedSky, { curveSunDir } from '../_curved-sky'
import Clouds from '../_clouds'
import { EnvConfigProvider } from '../_env-config'
import { overworldDayConfig as C } from './config'
import { useGrassTopMaterial } from '@/components/blocks/grass-block'
import { ScatterWorld } from '@/components/scatter/_scatter-context'
import ShortGrassScatter from '@/components/scatter/short-grass-scatter'
import FlowerScatter from '@/components/scatter/flower-scatter'
import TreeScatter from '@/components/scatter/tree-scatter'
import PigScatter from '@/components/scatter/pig-scatter'
import { useEnvStore } from '@/store/env-store'
import { WindClock, useWindControls } from '@/components/wind'

useTexture.preload('/textures/clouds.png')
useTexture.preload('/textures/grass_block_top.png')
useTexture.preload('/textures/short_grass.png')
useTexture.preload('/textures/poppy.png')
useTexture.preload('/textures/oxeye_daisy.png')
useTexture.preload('/textures/white_tulip.png')
useTexture.preload('/textures/orange_tulip.png')
useTexture.preload('/textures/pink_tulip.png')
useTexture.preload('/textures/red_tulip.png')

export default function OverworldDay() {
  const sunRef = useRef<DirectionalLight>(null)
  const material = useGrassTopMaterial()
  const radius = useEnvStore((s) => s.radius)
  const walkSpeed = useEnvStore((s) => s.walkSpeed)

  const {
    bg,
    fogEnabled,
    fogMode,
    fogColor,
    fogNear,
    fogFar,
    fogDensity,
    skyElev,
    skyAzimuth,
    skyTurb,
    skyRayl,
    skyCurve,
    ambientInt,
    sunInt,
    sunColor,
    lightDist,
    bloom,
    bloomThreshold,
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
            skyCurve: { value: 0.03, min: 0, max: 0.1, step: 0.001, label: 'Sky Curve' },
          },
          { collapsed: true }
        ),
        Lighting: folder(
          {
            ambientInt: { value: C.scene.lighting.ambient, min: 0, max: 2, step: 0.01, label: 'Ambient' },
            sunInt: { value: C.scene.lighting.sunInt, min: 0, max: 5, step: 0.05, label: 'Sun Intensity' },
            sunColor: { value: C.scene.lighting.sunColor, label: 'Sun Color' },
            lightDist: { value: C.scene.lighting.lightDist, min: 1, max: 200, step: 1, label: 'Distance' },
          },
          { collapsed: true }
        ),
        Fog: folder(
          {
            fogEnabled: { value: C.scene.fog.enabled, label: 'Enabled' },
            fogMode: {
              value: C.scene.fog.mode,
              options: { Linear: 'linear', Exponential: 'exp2' },
              label: 'Mode',
            },
            fogColor: { value: C.scene.fog.color, label: 'Color' },
            fogDensity: { value: C.scene.fog.density, min: 0, max: 0.2, step: 0.001, label: 'Density (exp2)' },
            fogNear: { value: C.scene.fog.near, min: 0, max: 40, step: 0.01, label: 'Near' },
            fogFar: { value: C.scene.fog.far, min: 5, max: 40, step: 0.01, label: 'Far' },
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
    return [
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    ]
  }, [skyElev, skyAzimuth])

  // Light direction bent to match where the sun visually sits in the curved sky.
  const lightDir = useMemo(
    () => curveSunDir(sunDir, radius, skyCurve),
    [sunDir, radius, skyCurve],
  )

  return (
    <EnvConfigProvider value={C}>
      <color attach="background" args={[bg]} />
      {fogEnabled &&
        (fogMode === 'exp2' ? (
          <fogExp2 attach="fog" args={[fogColor, fogDensity]} />
        ) : (
          <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
        ))}

      <ambientLight intensity={ambientInt} />
      <directionalLight
        ref={sunRef}
        position={[lightDir[0] * lightDist, lightDir[1] * lightDist, lightDir[2] * lightDist]}
        intensity={sunInt}
        color={sunColor}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={0.5}
        shadow-camera-far={250}
        shadow-bias={-0.00002}
        shadow-normalBias={0.05}
        shadow-radius={1}
      />

      <CurvedSky
        distance={450000}
        sunPosition={sunDir}
        turbidity={skyTurb}
        rayleigh={skyRayl}
        refRadius={radius}
        curve={skyCurve}
      />

      <WindClock />

      <Ground material={material} radius={radius} speed={walkSpeed} />
      <Clouds speed={walkSpeed} />

      <ScatterWorld speed={walkSpeed} radius={radius} walkCorridorWidth={walkCorridorWidth}>
        <TreeScatter />
        <ShortGrassScatter />
        <FlowerScatter />
        <PigScatter />
      </ScatterWorld>

      <EffectComposer>
        <Bloom intensity={bloom} luminanceThreshold={bloomThreshold} mipmapBlur />
      </EffectComposer>
    </EnvConfigProvider>
  )
}
