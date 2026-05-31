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

type Props = ComponentProps<typeof Sky> & {
  /** Horizontal radius the bend is keyed to — match the world disc radius. */
  refRadius?: number
  /** Bend strength; set equal to the World Curve strength to match the ground. */
  curve?: number
}

export default function CurvedSky({ refRadius = 25, curve = 0.02, ...props }: Props) {
  const ref = useRef<ComponentRef<typeof Sky>>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (mesh) patchSkyMaterial(mesh.material)
  }, [])

  skyRadius.value = refRadius
  skyCurve.value = curve

  return <Sky ref={ref} {...props} />
}
