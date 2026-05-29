"use client";

import { useMemo } from "react";
import { DoubleSide, MeshStandardMaterial } from "three";
import type { ThreeElements } from "@react-three/fiber";
import { PLANE_GEOMETRY, getOrCreateMaterial, usePixelTexture } from "./_block";
import { GRASS_TINT } from "./grass-block";

export default function ShortGrass(props: ThreeElements["group"]) {
  const tex = usePixelTexture("/textures/short_grass.png");
  const material = useMemo(
    () =>
      getOrCreateMaterial(
        "short-grass",
        () =>
          new MeshStandardMaterial({
            map: tex,
            color: GRASS_TINT,
            transparent: true,
            alphaTest: 0.5,
            side: DoubleSide,
          }),
      ),
    [tex],
  );
  return (
    <group {...props}>
      <mesh
        rotation={[0, Math.PI / 4, 0]}
        geometry={PLANE_GEOMETRY}
        material={material}
        castShadow
      />
      <mesh
        rotation={[0, -Math.PI / 4, 0]}
        geometry={PLANE_GEOMETRY}
        material={material}
        castShadow
      />
    </group>
  );
}
