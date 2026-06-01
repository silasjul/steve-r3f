'use client'

import { ComponentProps, ComponentRef, useLayoutEffect, useRef } from 'react'
import { Sky } from '@react-three/drei'
import { ShaderMaterial } from 'three'
import { curveUniforms } from '../world-curve'

/**
 * drei's <Sky> with the World Curve baked in.
 *
 * The sky never curved with the world because its shader is fully custom and
 * doesn't use the chunks <WorldCurve> patches. And its geometry is an 8-vertex
 * box scaled to 450k units, so bending the vertices is hopeless. Instead we
 * bend the *view direction* per-pixel in the fragment shader using the same
 * live curve uniforms: near the horizon the sampled direction tilts upward by
 * the same amount the ground droops, so the bright horizon haze sinks below
 * the curved horizon line (no more white band peeking over the curved ground).
 *
 * `refRadius` should match the world disc radius — at that radius the bend
 * lines up with the ground's curved edge. `curve` is the bend strength
 * (the sky's own coefficient, independent of the World Curve sliders); set it
 * equal to the World Curve strength to match the ground exactly.
 */

// Live, module-shared so the patched (shared) Sky material reads current values.
const skyRadius = { value: 25 }
const skyCurve = { value: 0.02 }

function patchSkyMaterial(mat: ShaderMaterial) {
  if ((mat as unknown as { __curvePatched?: boolean }).__curvePatched) return
  ;(mat as unknown as { __curvePatched?: boolean }).__curvePatched = true

  mat.onBeforeCompile = (shader) => {
    // Reuse the World Curve's falloff shape (uCurvePower) but drive the
    // strength from our own uSkyCurve, so the sky's curvature is configurable
    // independently of the ground.
    shader.uniforms.uCurvePower = curveUniforms.uCurvePower
    shader.uniforms.uSkyRadius = skyRadius
    shader.uniforms.uSkyCurve = skyCurve

    shader.fragmentShader = shader.fragmentShader
      .replace(
        'const vec3 cameraPos = vec3( 0.0, 0.0, 0.0 );',
        /* glsl */ `const vec3 cameraPos = vec3( 0.0, 0.0, 0.0 );
        uniform float uCurvePower;
        uniform float uSkyRadius;
        uniform float uSkyCurve;`,
      )
      .replace(
        'vec3 direction = normalize( vWorldPosition - cameraPos );',
        /* glsl */ `vec3 direction = normalize( vWorldPosition - cameraPos );
        {
          vec3 cp = direction * uSkyRadius;
          float drop = uSkyCurve * ( pow(abs(cp.x), uCurvePower)
                                   + pow(abs(cp.z), uCurvePower) );
          direction = normalize(vec3(cp.x, cp.y + drop, cp.z));
        }`,
      )
  }
  mat.needsUpdate = true
}

/**
 * Bend a sun direction by the same World Curve the sky applies, so a directional
 * light lines up with where the sun *visually* sits in the curved sky.
 *
 * The sky shader tilts the sampled view direction UP near the horizon
 * (`cp.y + drop`), which makes the sun disc render LOWER on screen than its raw
 * `sunPosition`. To match, we tilt the light direction DOWN by the same amount —
 * mirroring the fragment-shader maths (`drop = curve * (|cp.x|^p + |cp.z|^p)`,
 * `cp = dir * refRadius`) back in unit-direction space.
 *
 * Pass the same `refRadius`/`curve` you hand to <CurvedSky>.
 */
export function curveSunDir(
  sunDir: readonly [number, number, number],
  refRadius: number,
  curve: number,
): [number, number, number] {
  const p = curveUniforms.uCurvePower.value
  const dropUnit =
    curve *
    Math.pow(refRadius, p - 1) *
    (Math.pow(Math.abs(sunDir[0]), p) + Math.pow(Math.abs(sunDir[2]), p))

  const x = sunDir[0]
  const y = sunDir[1] - dropUnit
  const z = sunDir[2]
  const len = Math.hypot(x, y, z) || 1
  return [x / len, y / len, z / len]
}

type Props = ComponentProps<typeof Sky> & {
  /** Horizontal radius the bend is keyed to — match the world disc radius. */
  refRadius?: number
  /** Bend strength; set equal to the World Curve strength to match the ground. */
  curve?: number
}

export default function CurvedSky({ refRadius = 25, curve = 0.02, ...props }: Props) {
  const ref = useRef<ComponentRef<typeof Sky>>(null)

  useLayoutEffect(() => {
    skyRadius.value = refRadius
    skyCurve.value = curve
    const mesh = ref.current
    if (mesh) patchSkyMaterial(mesh.material)
  }, [refRadius, curve])

  return <Sky ref={ref} {...props} />
}
