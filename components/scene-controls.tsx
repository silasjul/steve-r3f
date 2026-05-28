"use client";

import { useEffect, useRef } from "react";
import { PerspectiveCamera, OrbitControls } from "@react-three/drei";
import { useControls, folder } from "leva";
import { PerspectiveCamera as ThreePerspectiveCamera } from "three";

export default function SceneControls() {
  const cameraRef = useRef<ThreePerspectiveCamera>(null);

  const { posX, posY, posZ, fov, orbitEnabled } = useControls({
    Camera: folder(
      {
        posX: { value: 0, min: -20, max: 20, step: 0.1, label: "X" },
        posY: { value: 5, min: -20, max: 20, step: 0.1, label: "Y" },
        posZ: { value: 10, min: 0.5, max: 30, step: 0.1, label: "Z" },
        fov: { value: 60, min: 10, max: 120, step: 1, label: "FOV" },
        orbitEnabled: { value: true, label: "Orbit Controls" },
      },
      { collapsed: true },
    ),
  });

  useEffect(() => {
    if (!cameraRef.current) return;
    if (!orbitEnabled) {
      cameraRef.current.position.set(posX, posY, posZ);
    }
    cameraRef.current.fov = fov;
    cameraRef.current.updateProjectionMatrix();
  }, [posX, posY, posZ, fov, orbitEnabled]);

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={[0, 1.25, 3.75]}
        fov={60}
      />
      <OrbitControls enabled={orbitEnabled} target={[0, 1.25, 0]} />
    </>
  );
}
