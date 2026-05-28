'use client'

import { useFrame } from '@react-three/fiber'
import { useControls, folder } from 'leva'
import { MathUtils, Vector2, type Material } from 'three'

// Shared uniforms — every patched material references the same objects, so
// updating .value here animates them all without re-compiling shaders.
export const windUniforms = {
  uTime: { value: 0 },
  uWindStrength: { value: 0.17 },
  uWindSpeed: { value: 1.4 },
  uWindFreq: { value: 0.9 },
  uWindDir: { value: new Vector2(1, 0) },
  uGust: { value: 0.45 },
}

const PATCHED = new WeakSet<Material>()

export function applyWindShader(material: Material): void {
  if (PATCHED.has(material)) return
  PATCHED.add(material)

  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)

    shader.uniforms.uTime = windUniforms.uTime
    shader.uniforms.uWindStrength = windUniforms.uWindStrength
    shader.uniforms.uWindSpeed = windUniforms.uWindSpeed
    shader.uniforms.uWindFreq = windUniforms.uWindFreq
    shader.uniforms.uWindDir = windUniforms.uWindDir
    shader.uniforms.uGust = windUniforms.uGust

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uWindStrength;
         uniform float uWindSpeed;
         uniform float uWindFreq;
         uniform vec2  uWindDir;
         uniform float uGust;`,
      )
      // Replace project_vertex so we can displace in world space (so all
      // instances bend together regardless of their per-instance Y rotation),
      // while still using local position.y as the bend mask (base stays put).
      // wcBend() is injected globally by world-curve.tsx via ShaderChunk.common
      // — we call it here so the curve still applies on top of the wind sway.
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4(transformed, 1.0);
         #ifdef USE_BATCHING
           mvPosition = batchingMatrix * mvPosition;
         #endif
         #ifdef USE_INSTANCING
           mvPosition = instanceMatrix * mvPosition;
         #endif
         vec4 _wp = modelMatrix * mvPosition;
         float _phase = (_wp.x * uWindFreq + _wp.z * uWindFreq * 0.7) + uTime * uWindSpeed;
         float _sway  = sin(_phase) + uGust * sin(_phase * 2.3 + 1.3);
         float _bend  = max(position.y, 0.0) * uWindStrength;
         _wp.x += uWindDir.x * _sway * _bend;
         _wp.z += uWindDir.y * _sway * _bend;
         _wp = wcBend(_wp);
         mvPosition = viewMatrix * _wp;
         gl_Position = projectionMatrix * mvPosition;`,
      )
  }
  material.needsUpdate = true
}

export function WindClock() {
  useFrame((_, dt) => {
    // Clamp like the scatter pool — avoids a huge jump after a tab resumes.
    windUniforms.uTime.value += Math.min(dt, 1 / 30)
  })
  return null
}

export function useWindControls() {
  useControls({
    Wind: folder(
      {
        strength: {
          value: windUniforms.uWindStrength.value,
          min: 0,
          max: 0.6,
          step: 0.01,
          label: 'Strength',
          onChange: (v: number) => {
            windUniforms.uWindStrength.value = v
          },
        },
        speed: {
          value: windUniforms.uWindSpeed.value,
          min: 0,
          max: 6,
          step: 0.05,
          label: 'Speed',
          onChange: (v: number) => {
            windUniforms.uWindSpeed.value = v
          },
        },
        freq: {
          value: windUniforms.uWindFreq.value,
          min: 0,
          max: 3,
          step: 0.01,
          label: 'Frequency',
          onChange: (v: number) => {
            windUniforms.uWindFreq.value = v
          },
        },
        gust: {
          value: windUniforms.uGust.value,
          min: 0,
          max: 1.5,
          step: 0.01,
          label: 'Gustiness',
          onChange: (v: number) => {
            windUniforms.uGust.value = v
          },
        },
        direction: {
          value: 0,
          min: 0,
          max: 360,
          step: 1,
          label: 'Direction °',
          onChange: (deg: number) => {
            const r = MathUtils.degToRad(deg)
            windUniforms.uWindDir.value.set(Math.cos(r), Math.sin(r))
          },
        },
      },
      { collapsed: true },
    ),
  })
}
