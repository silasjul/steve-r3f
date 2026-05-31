'use client'

import { useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { DirectionalLight, MathUtils, MeshStandardMaterial } from 'three'
import { useControls, folder } from 'leva'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import Ground from '../_ground'
import CurvedSky from '../_curved-sky'
import { EnvConfigProvider } from '../_env-config'
import { desertConfig as C } from './config'
import { getOrCreateMaterial, usePixelTexture } from '@/components/blocks/_block'
import { ScatterWorld } from '@/components/scatter/_scatter-context'
import TempleScatter from '@/components/scatter/temple-scatter'
import CactusScatter from '@/components/scatter/cactus-scatter'
import DryGrassScatter from '@/components/scatter/dry-grass-scatter'
import DeadBushScatter from '@/components/scatter/dead-bush-scatter'
import WanderingTraderScatter from '@/components/scatter/wandering-trader-scatter'
import CamelScatter from '@/components/scatter/camel-scatter'
import { useEnvStore } from '@/store/env-store'
import { WindClock, useWindControls } from '@/components/wind'

useTexture.preload('/textures/sand.png')
useTexture.preload('/textures/short_dry_grass.png')
useTexture.preload('/textures/tall_dry_grass.png')
useTexture.preload('/textures/dead_bush.png')
useTexture.preload('/textures/cactus_side.png')
useTexture.preload('/textures/cactus_top.png')
useTexture.preload('/textures/cactus_flower.png')

function useSandMaterial(): MeshStandardMaterial {
  const tex = usePixelTexture('/textures/sand.png')
  return useMemo(
    () => getOrCreateMaterial('sand:ground', () => new MeshStandardMaterial({ map: tex })),
    [tex],
  )
}

export default function Desert() {
  const sunRef = useRef<DirectionalLight>(null)
  const material = useSandMaterial()
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
            skyCurve: { value: 0.01, min: 0, max: 0.1, step: 0.001, label: 'Sky Curve' },
          },
          { collapsed: true },
        ),
        Lighting: folder(
          {
            ambientInt: { value: C.scene.lighting.ambient, min: 0, max: 2, step: 0.01, label: 'Ambient' },
            sunInt: { value: C.scene.lighting.sunInt, min: 0, max: 5, step: 0.05, label: 'Sun Intensity' },
            sunColor: { value: C.scene.lighting.sunColor, label: 'Sun Color' },
            lightDist: { value: C.scene.lighting.lightDist, min: 1, max: 200, step: 1, label: 'Distance' },
          },
          { collapsed: true },
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
          { collapsed: true },
        ),
        Bloom: folder(
          {
            bloom: { value: C.scene.bloom.intensity, min: 0, max: 3, step: 0.01, label: 'Intensity' },
            bloomThreshold: { value: C.scene.bloom.threshold, min: 0, max: 1, step: 0.01, label: 'Threshold' },
          },
          { collapsed: true },
        ),
        Scatter: folder(
          {
            walkCorridorWidth: { value: C.scene.walkCorridorWidth, min: 0, max: 12, step: 0.1, label: 'Walk Corridor' },
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
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
        position={[sunDir[0] * lightDist, sunDir[1] * lightDist, sunDir[2] * lightDist]}
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
        shadow-bias={0.0001}
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

      <ScatterWorld speed={walkSpeed} radius={radius} walkCorridorWidth={walkCorridorWidth}>
        <TempleScatter />
        <CactusScatter />
        <DryGrassScatter />
        <DeadBushScatter />
        <WanderingTraderScatter />
        <CamelScatter />
      </ScatterWorld>

      <EffectComposer>
        <Bloom intensity={bloom} luminanceThreshold={bloomThreshold} mipmapBlur />
      </EffectComposer>
    </EnvConfigProvider>
  )
}
