'use client'

import { useFrame } from '@react-three/fiber'
import { useControls, folder } from 'leva'
import {
  DoubleSide,
  MathUtils,
  MeshDepthMaterial,
  RGBADepthPacking,
  Vector2,
  type Material,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three'

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
const PATCHED_SCALED = new WeakSet<Material>()

function injectWindVertex(shader: WebGLProgramParametersWithUniforms): void {
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
       uniform float uGust;
       ${WIND_BEND_HELPER}`,
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
       vec4 _wp = wcWindBend(modelMatrix * mvPosition, position.y);
       mvPosition = viewMatrix * _wp;
       gl_Position = projectionMatrix * mvPosition;`,
    )
    // worldpos_vertex feeds the `worldPosition` varying used by the shadow
    // sampler. world-curve.tsx already patches the chunk to apply wcBend on
    // the rest pose; we override again so it picks up the wind sway too,
    // otherwise shadow lookups land at the un-swayed position and the blade
    // appears lit where its shadow should fall.
    .replace(
      '#include <worldpos_vertex>',
      `#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
       vec4 worldPosition = vec4(transformed, 1.0);
       #ifdef USE_BATCHING
         worldPosition = batchingMatrix * worldPosition;
       #endif
       #ifdef USE_INSTANCING
         worldPosition = instanceMatrix * worldPosition;
       #endif
       worldPosition = wcWindBend(modelMatrix * worldPosition, position.y);
       #endif`,
    )
}

// Shared helper appended once to ShaderChunk.common so both injections agree.
// Defined inline here as a string we prepend during patch.
const WIND_BEND_HELPER = `
vec4 wcWindBend(vec4 wp, float localY) {
  float _phase = (wp.x * uWindFreq + wp.z * uWindFreq * 0.7) + uTime * uWindSpeed;
  float _sway  = sin(_phase) + uGust * sin(_phase * 2.3 + 1.3);
  float _bend  = max(localY, 0.0) * uWindStrength;
  wp.x += uWindDir.x * _sway * _bend;
  wp.z += uWindDir.y * _sway * _bend;
  return wcBend(wp);
}
`

const WIND_BEND_SCALED_HELPER = `
vec4 wcWindBendScaled(vec4 wp, float localY, float windScale) {
  float _phase = (wp.x * uWindFreq + wp.z * uWindFreq * 0.7) + uTime * uWindSpeed;
  float _sway  = sin(_phase) + uGust * sin(_phase * 2.3 + 1.3);
  float _bend  = max(localY, 0.0) * uWindStrength * windScale;
  wp.x += uWindDir.x * _sway * _bend;
  wp.z += uWindDir.y * _sway * _bend;
  return wcBend(wp);
}
`

function injectWindVertexScaled(
  shader: WebGLProgramParametersWithUniforms,
  scaleUniform: { value: number },
): void {
  shader.uniforms.uTime = windUniforms.uTime
  shader.uniforms.uWindStrength = windUniforms.uWindStrength
  shader.uniforms.uWindSpeed = windUniforms.uWindSpeed
  shader.uniforms.uWindFreq = windUniforms.uWindFreq
  shader.uniforms.uWindDir = windUniforms.uWindDir
  shader.uniforms.uGust = windUniforms.uGust
  shader.uniforms.uWindScale = scaleUniform

  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
       uniform float uTime;
       uniform float uWindStrength;
       uniform float uWindSpeed;
       uniform float uWindFreq;
       uniform vec2  uWindDir;
       uniform float uGust;
       uniform float uWindScale;
       ${WIND_BEND_SCALED_HELPER}`,
    )
    .replace(
      '#include <project_vertex>',
      `vec4 mvPosition = vec4(transformed, 1.0);
       #ifdef USE_BATCHING
         mvPosition = batchingMatrix * mvPosition;
       #endif
       #ifdef USE_INSTANCING
         mvPosition = instanceMatrix * mvPosition;
       #endif
       vec4 _wp = wcWindBendScaled(modelMatrix * mvPosition, position.y, uWindScale);
       mvPosition = viewMatrix * _wp;
       gl_Position = projectionMatrix * mvPosition;`,
    )
    .replace(
      '#include <worldpos_vertex>',
      `#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
       vec4 worldPosition = vec4(transformed, 1.0);
       #ifdef USE_BATCHING
         worldPosition = batchingMatrix * worldPosition;
       #endif
       #ifdef USE_INSTANCING
         worldPosition = instanceMatrix * worldPosition;
       #endif
       worldPosition = wcWindBendScaled(modelMatrix * worldPosition, position.y, uWindScale);
       #endif`,
    )
}

export function applyWindShaderScaled(
  material: Material,
  scaleUniform: { value: number },
): void {
  if (PATCHED_SCALED.has(material)) return
  PATCHED_SCALED.add(material)

  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)
    injectWindVertexScaled(shader, scaleUniform)
  }
  material.needsUpdate = true
}

export function createWindDepthMaterialScaled(
  map: Texture,
  scaleUniform: { value: number },
  alphaTest = 0.5,
): MeshDepthMaterial {
  const m = new MeshDepthMaterial({
    depthPacking: RGBADepthPacking,
    map,
    alphaTest,
    side: DoubleSide,
  })
  applyWindShaderScaled(m, scaleUniform)
  return m
}

const PATCHED_UV = new WeakSet<Material>()

const WIND_BEND_UV_HELPER = `
vec4 wcWindBendUV(vec4 wp, float uvY) {
  float _phase = (wp.x * uWindFreq + wp.z * uWindFreq * 0.7) + uTime * uWindSpeed;
  float _sway  = sin(_phase) + uGust * sin(_phase * 2.3 + 1.3);
  float _bend  = uvY * uWindStrength;
  wp.x += uWindDir.x * _sway * _bend;
  wp.z += uWindDir.y * _sway * _bend;
  return wcBend(wp);
}
`

function injectWindVertexUV(shader: WebGLProgramParametersWithUniforms): void {
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
       uniform float uGust;
       ${WIND_BEND_UV_HELPER}`,
    )
    .replace(
      '#include <project_vertex>',
      `vec4 mvPosition = vec4(transformed, 1.0);
       #ifdef USE_BATCHING
         mvPosition = batchingMatrix * mvPosition;
       #endif
       #ifdef USE_INSTANCING
         mvPosition = instanceMatrix * mvPosition;
       #endif
       vec4 _wp = wcWindBendUV(modelMatrix * mvPosition, uv.y);
       mvPosition = viewMatrix * _wp;
       gl_Position = projectionMatrix * mvPosition;`,
    )
    .replace(
      '#include <worldpos_vertex>',
      `#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
       vec4 worldPosition = vec4(transformed, 1.0);
       #ifdef USE_BATCHING
         worldPosition = batchingMatrix * worldPosition;
       #endif
       #ifdef USE_INSTANCING
         worldPosition = instanceMatrix * worldPosition;
       #endif
       worldPosition = wcWindBendUV(modelMatrix * worldPosition, uv.y);
       #endif`,
    )
}

export function applyWindShaderUVBend(material: Material): void {
  if (PATCHED_UV.has(material)) return
  PATCHED_UV.add(material)

  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)
    injectWindVertexUV(shader)
  }
  material.needsUpdate = true
}

export function createWindDepthMaterialUVBend(
  map: Texture,
  alphaTest = 0.5,
): MeshDepthMaterial {
  const m = new MeshDepthMaterial({
    depthPacking: RGBADepthPacking,
    map,
    alphaTest,
    side: DoubleSide,
  })
  applyWindShaderUVBend(m)
  return m
}

export function applyWindShader(material: Material): void {
  if (PATCHED.has(material)) return
  PATCHED.add(material)

  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)
    injectWindVertex(shader)
  }
  material.needsUpdate = true
}

/**
 * Depth material matching the wind displacement. Assign to a mesh's
 * `customDepthMaterial` so the shadow map records the swaying geometry
 * instead of the rest pose — otherwise the visible blade leans away from
 * its own shadow and the base appears lit.
 */
export function createWindDepthMaterial(
  map: Texture,
  alphaTest = 0.5,
): MeshDepthMaterial {
  const m = new MeshDepthMaterial({
    depthPacking: RGBADepthPacking,
    map,
    alphaTest,
    side: DoubleSide,
  })
  applyWindShader(m)
  return m
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
