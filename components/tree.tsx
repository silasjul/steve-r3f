"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Mesh, type Object3D } from "three";
import type { ThreeElements } from "@react-three/fiber";

useGLTF.preload("/models/tree.glb");

export default function Tree(props: ThreeElements["group"]) {
  const { scene } = useGLTF("/models/tree.glb");

  // Each mounted <Tree /> needs its own scene graph copy so multiple trees
  // can sit in different positions. Geometries/materials are still shared
  // by reference, so the cost is just per-mesh Object3D nodes.
  const model = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((obj: Object3D) => {
      if ((obj as Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return cloned;
  }, [scene]);

  return (
    <group {...props}>
      <primitive object={model} />
    </group>
  );
}
