"use client";

import { useRef } from "react";
import { useTexture } from "@react-three/drei";
import { DirectionalLight } from "three";
import { useControls, folder } from "leva";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import Ground, { MAX_RADIUS } from "../_ground";
import { EnvConfigProvider } from "../_env-config";
import { netherConfig as C } from "./config";
import { useSharedPixelMaterial } from "@/components/blocks/_block";
import { ScatterWorld } from "@/components/scatter/_scatter-context";
import LavaScatter from "@/components/scatter/lava-scatter";
import NetherOreScatter from "@/components/scatter/nether-ore-scatter";
import GlowstoneScatter from "@/components/scatter/glowstone-scatter";
import ZombiePigmanScatter from "@/components/scatter/zombie-pigman-scatter";
import { useEnvStore } from "@/store/env-store";

useTexture.preload("/textures/netherrack.png");
useTexture.preload("/textures/glowstone.png");
useTexture.preload("/textures/lava_still.png");
useTexture.preload("/textures/nether_quartz_ore.png");
useTexture.preload("/textures/nether_gold_ore.png");

export default function Nether() {
  const sunRef = useRef<DirectionalLight>(null);
  const walkSpeed = useEnvStore((s) => s.walkSpeed);

  const roof = C.scene.roof!;

  const {
    bg,
    fogColor,
    fogNear,
    fogFar,
    ambientInt,
    sunInt,
    sunColor,
    floorRadius,
    roofHeight,
    roofTint,
    roofRadius,
    bloom,
    bloomThreshold,
    walkCorridorWidth,
  } = useControls({
    [C.label]: folder(
      {
        bg: { value: C.scene.bg, label: "Background" },
        Lighting: folder(
          {
            ambientInt: {
              value: C.scene.lighting.ambient,
              min: 0,
              max: 2,
              step: 0.01,
              label: "Ambient",
            },
            sunInt: {
              value: C.scene.lighting.sunInt,
              min: 0,
              max: 5,
              step: 0.05,
              label: "Glow Intensity",
            },
            sunColor: { value: C.scene.lighting.sunColor, label: "Glow Color" },
          },
          { collapsed: true },
        ),
        Fog: folder(
          {
            fogColor: { value: C.scene.fog.color, label: "Color" },
            fogNear: {
              value: C.scene.fog.near,
              min: 0,
              max: 200,
              step: 1,
              label: "Near",
            },
            fogFar: {
              value: C.scene.fog.far,
              min: 10,
              max: 1000,
              step: 1,
              label: "Far",
            },
          },
          { collapsed: true },
        ),
        Ground: folder(
          {
            floorRadius: {
              value: C.scene.floorRadius ?? 28,
              min: 4,
              max: MAX_RADIUS,
              step: 1,
              label: "Floor Radius",
            },
          },
          { collapsed: true },
        ),
        Roof: folder(
          {
            roofHeight: {
              value: roof.height,
              min: 4,
              max: 40,
              step: 0.5,
              label: "Height",
            },
            roofTint: { value: roof.tint, label: "Tint" },
            roofRadius: {
              value: roof.radius,
              min: 4,
              max: MAX_RADIUS,
              step: 1,
              label: "Ceiling Radius",
            },
          },
          { collapsed: true },
        ),
        Bloom: folder(
          {
            bloom: {
              value: C.scene.bloom.intensity,
              min: 0,
              max: 3,
              step: 0.01,
              label: "Intensity",
            },
            bloomThreshold: {
              value: C.scene.bloom.threshold,
              min: 0,
              max: 1,
              step: 0.01,
              label: "Threshold",
            },
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
              label: "Walk Corridor",
            },
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
    ),
  });

  const floorMaterial = useSharedPixelMaterial("/textures/netherrack.png");
  const roofMaterial = useSharedPixelMaterial("/textures/netherrack.png", {
    tint: roofTint,
  });

  return (
    <EnvConfigProvider value={C}>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

      <ambientLight intensity={ambientInt} color={sunColor} />
      <directionalLight
        ref={sunRef}
        position={[0, 10, 0]}
        intensity={sunInt}
        color={sunColor}
      />

      <Ground material={floorMaterial} radius={floorRadius} speed={walkSpeed} />
      <Ground
        material={roofMaterial}
        radius={roofRadius}
        speed={walkSpeed}
        height={roofHeight}
        flip
      />

      <ScatterWorld
        speed={walkSpeed}
        radius={floorRadius}
        ceilingRadius={roofRadius}
        walkCorridorWidth={walkCorridorWidth}
      >
        <LavaScatter />
        <NetherOreScatter />
        <ZombiePigmanScatter />
        <GlowstoneScatter />
      </ScatterWorld>

      <EffectComposer>
        <Bloom
          intensity={bloom}
          luminanceThreshold={bloomThreshold}
          mipmapBlur
        />
      </EffectComposer>
    </EnvConfigProvider>
  );
}
