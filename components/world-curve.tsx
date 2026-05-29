"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useControls, folder } from "leva";
import { Material, ShaderChunk, Vector3 } from "three";

const uniforms = {
  uCurveX: { value: 0 },
  uCurveZ: { value: 0 },
  uCurvePower: { value: 2 },
  uCurveCenter: { value: new Vector3() },
};

// Patch Three.js shader chunks + Material prototype once at module load.
// Any material created/compiled after this runs picks up the curve automatically.
let installed = false;
function install() {
  if (installed) return;
  installed = true;

  ShaderChunk.common =
    ShaderChunk.common +
    `
uniform float uCurveX;
uniform float uCurveZ;
uniform float uCurvePower;
uniform vec3 uCurveCenter;
vec4 wcBend(vec4 wp) {
  vec2 d = wp.xz - uCurveCenter.xz;
  wp.y -= uCurveX * pow(abs(d.x), uCurvePower);
  wp.y -= uCurveZ * pow(abs(d.y), uCurvePower);
  return wp;
}
`;

  ShaderChunk.project_vertex = `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 wcWorld = modelMatrix * mvPosition;
wcWorld = wcBend(wcWorld);
mvPosition = viewMatrix * wcWorld;
gl_Position = projectionMatrix * mvPosition;
`;

  // Keep worldPosition (used by shadow + envmap chunks) in sync with the bend
  // so shadows project onto the curved geometry.
  ShaderChunk.worldpos_vertex = `
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
vec4 worldPosition = vec4(transformed, 1.0);
#ifdef USE_BATCHING
  worldPosition = batchingMatrix * worldPosition;
#endif
#ifdef USE_INSTANCING
  worldPosition = instanceMatrix * worldPosition;
#endif
worldPosition = modelMatrix * worldPosition;
worldPosition = wcBend(worldPosition);
#endif
`;

  const orig = Material.prototype.onBeforeCompile;
  Material.prototype.onBeforeCompile = function (shader, renderer) {
    shader.uniforms.uCurveX = uniforms.uCurveX;
    shader.uniforms.uCurveZ = uniforms.uCurveZ;
    shader.uniforms.uCurvePower = uniforms.uCurvePower;
    shader.uniforms.uCurveCenter = uniforms.uCurveCenter;
    if (orig) orig.call(this, shader, renderer);
  };
}

install();

export default function WorldCurve() {
  const {
    enabled,
    strengthX,
    strengthZ,
    power,
    followCamera,
    centerX,
    centerZ,
  } = useControls({
    "World Curve": folder(
      {
        enabled: { value: true, label: "Enabled" },
        strengthZ: {
          value: 0.02,
          min: 0,
          max: 0.2,
          step: 0.001,
          label: "Strength Z",
        },
        strengthX: {
          value: 0.02,
          min: 0,
          max: 0.2,
          step: 0.001,
          label: "Strength X",
        },
        power: { value: 2, min: 1, max: 4, step: 0.05, label: "Power" },
        followCamera: { value: true, label: "Follow Camera" },
        centerX: {
          value: 0,
          min: -50,
          max: 50,
          step: 0.1,
          label: "Center X",
          render: (get) => !get("World Curve.followCamera"),
        },
        centerZ: {
          value: 0,
          min: -50,
          max: 50,
          step: 0.1,
          label: "Center Z",
          render: (get) => !get("World Curve.followCamera"),
        },
      },
      { collapsed: true },
    ),
  });

  useEffect(() => {
    return () => {
      uniforms.uCurveX.value = 0;
      uniforms.uCurveZ.value = 0;
    };
  }, []);

  useFrame(({ camera }) => {
    if (enabled) {
      uniforms.uCurveX.value = strengthX;
      uniforms.uCurveZ.value = strengthZ;
      uniforms.uCurvePower.value = power;
    } else {
      uniforms.uCurveX.value = 0;
      uniforms.uCurveZ.value = 0;
    }
    if (followCamera) {
      uniforms.uCurveCenter.value.set(camera.position.x, 0, camera.position.z);
    } else {
      uniforms.uCurveCenter.value.set(centerX, 0, centerZ);
    }
  });

  return null;
}
