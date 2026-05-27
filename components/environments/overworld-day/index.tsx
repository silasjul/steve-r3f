"use client";

import { useMemo, useRef } from "react";
import { Sky, useTexture } from "@react-three/drei";
import { DirectionalLight, MathUtils } from "three";
import { useControls, folder } from "leva";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import Ground, { MAX_RADIUS } from "../_ground";
import { useGrassTopMaterial } from "@/components/blocks/grass-block";
import { ScatterWorld } from "@/components/scatter/_scatter-context";
import ShortGrassScatter from "@/components/scatter/short-grass-scatter";
import FlowerScatter from "@/components/scatter/flower-scatter";
import TreeScatter from "@/components/scatter/tree-scatter";

useTexture.preload("/textures/grass_block_top.png");
useTexture.preload("/textures/short_grass.png");
useTexture.preload("/textures/poppy.png");
useTexture.preload("/textures/oxeye_daisy.png");
useTexture.preload("/textures/white_tulip.png");
useTexture.preload("/textures/orange_tulip.png");
useTexture.preload("/textures/pink_tulip.png");
useTexture.preload("/textures/red_tulip.png");

export default function OverworldDay() {
  const sunRef = useRef<DirectionalLight>(null);
  const material = useGrassTopMaterial();

  const {
    bg,
    fogColor,
    fogNear,
    fogFar,
    skyElev,
    skyAzimuth,
    skyTurb,
    skyRayl,
    ambientInt,
    sunInt,
    sunColor,
    lightDist,
    bloom,
    bloomThreshold,
    walkSpeed,
    radius,
    walkCorridorWidth,
  } = useControls({
    "Overworld Day": folder(
      {
        bg: { value: "#87ceeb", label: "Background" },
        Sky: folder(
          {
            skyElev: {
              value: 45.5,
              min: -10,
              max: 90,
              step: 0.5,
              label: "Elevation",
            },
            skyAzimuth: {
              value: 140,
              min: 0,
              max: 360,
              step: 1,
              label: "Azimuth",
            },
            skyTurb: {
              value: 20,
              min: 0,
              max: 20,
              step: 0.1,
              label: "Turbidity",
            },
            skyRayl: {
              value: 0.55,
              min: 0,
              max: 6,
              step: 0.01,
              label: "Rayleigh",
            },
          },
          { collapsed: true },
        ),
        Lighting: folder(
          {
            ambientInt: {
              value: 0.4,
              min: 0,
              max: 2,
              step: 0.01,
              label: "Ambient",
            },
            sunInt: {
              value: 1.8,
              min: 0,
              max: 5,
              step: 0.05,
              label: "Sun Intensity",
            },
            sunColor: { value: "#fff5e0", label: "Sun Color" },
            lightDist: {
              value: 10,
              min: 1,
              max: 200,
              step: 1,
              label: "Distance",
            },
          },
          { collapsed: true },
        ),
        Fog: folder(
          {
            fogColor: { value: "#c9dff5", label: "Color" },
            fogNear: { value: 60, min: 0, max: 200, step: 1, label: "Near" },
            fogFar: { value: 500, min: 10, max: 1000, step: 1, label: "Far" },
          },
          { collapsed: true },
        ),
        Bloom: folder(
          {
            bloom: { value: 0, min: 0, max: 3, step: 0.01, label: "Intensity" },
            bloomThreshold: {
              value: 0.9,
              min: 0,
              max: 1,
              step: 0.01,
              label: "Threshold",
            },
          },
          { collapsed: true },
        ),
        Movement: folder(
          {
            walkSpeed: {
              value: -1,
              min: -3,
              max: 3,
              step: 0.1,
              label: "Walk Speed",
            },
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
    ),
    Tiles: folder(
      {
        radius: {
          value: 16,
          min: 4,
          max: MAX_RADIUS,
          step: 1,
          label: "Radius",
        },
        walkCorridorWidth: {
          value: 6,
          min: 0,
          max: 12,
          step: 0.1,
          label: "Walk Corridor",
        },
      },
      { collapsed: true },
    ),
  });

  const sunDir = useMemo<[number, number, number]>(() => {
    const phi = MathUtils.degToRad(90 - skyElev);
    const theta = MathUtils.degToRad(skyAzimuth);
    return [
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    ];
  }, [skyElev, skyAzimuth]);

  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

      <ambientLight intensity={ambientInt} />
      <directionalLight
        ref={sunRef}
        position={[
          sunDir[0] * lightDist,
          sunDir[1] * lightDist,
          sunDir[2] * lightDist,
        ]}
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

      <Sky
        distance={450000}
        sunPosition={sunDir}
        turbidity={skyTurb}
        rayleigh={skyRayl}
      />

      <Ground material={material} radius={radius} speed={walkSpeed} />

      <ScatterWorld
        speed={walkSpeed}
        radius={radius}
        walkCorridorWidth={walkCorridorWidth}
      >
        <TreeScatter />
        <ShortGrassScatter />
        <FlowerScatter />
      </ScatterWorld>

      <EffectComposer>
        <Bloom
          intensity={bloom}
          luminanceThreshold={bloomThreshold}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}
