'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three'
import { curveUniforms } from './world-curve'
import { dragonState } from './dragon-state'

// Unit tube, open-ended, plenty of height segments so the world-curve bend
// reads as a smooth arc rather than a few straight facets. Translated so the
// origin sits at one cap (the crystal end) and it grows along +Y toward the
// dragon — the mesh's scale.y then becomes the beam length in world units.
const BEAM_GEOMETRY = new CylinderGeometry(1, 1, 1, 8, 28, true)
BEAM_GEOMETRY.translate(0, 0.5, 0)

const UP = /* @__PURE__ */ new Vector3(0, 1, 0)

const vertexShader = /* glsl */ `
uniform float uCurveX;
uniform float uCurveZ;
uniform float uCurvePower;
uniform vec3 uCurveCenter;

varying vec2 vUv;
varying float vFacing;

void main() {
  vUv = uv;

  // Same bend the world applies to everything else, so the beam stays glued to
  // the (also-bent) crystal and dragon instead of floating off them.
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vec2 d = worldPos.xz - uCurveCenter.xz;
  worldPos.y -= uCurveX * pow(abs(d.x), uCurvePower);
  worldPos.y -= uCurveZ * pow(abs(d.y), uCurvePower);

  vec4 viewPos = viewMatrix * worldPos;

  // How squarely this bit of tube faces the camera: ~1 down the silhouette
  // centre, ~0 at the grazing edges. Drives the soft round-beam falloff.
  vec3 n = normalize(normalMatrix * normal);
  vec3 viewDir = normalize(-viewPos.xyz);
  vFacing = abs(dot(n, viewDir));

  gl_Position = projectionMatrix * viewPos;
}
`

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uFlowSpeed;
uniform float uIntensity;
uniform float uLength;
uniform vec3 uColor;
uniform vec3 uCrystalColor;

varying vec2 vUv;
varying float vFacing;

void main() {
  // Soft glowing core across the tube cross-section.
  float core = pow(vFacing, 1.5);

  // Energy packets streaming toward the dragon (vUv.y = 1 end). Roughly two
  // bands per world unit so longer beams show more travelling segments.
  float bands = max(uLength * 2.0, 1.0);
  float f = fract(vUv.y * bands - uTime * uFlowSpeed);
  // Sharp leading edge, soft trailing tail = a comet-like packet.
  float pulse = smoothstep(0.0, 0.15, f) * smoothstep(1.0, 0.35, f);

  // Brighten slightly toward the dragon so the energy looks like it's arriving.
  float arrive = mix(0.85, 1.3, vUv.y);

  float glow = core * (0.45 + pulse * 1.35) * arrive;

  // Gradient along the beam: the crystal's colour at its base (vUv.y = 0)
  // shifting to the beam colour as it reaches the dragon (vUv.y = 1).
  vec3 tint = mix(uCrystalColor, uColor, vUv.y);

  // Linear HDR output (no tone mapping on raw ShaderMaterial) so the bloom pass
  // haloes it like the enderman eyes / tower crystals.
  vec3 col = tint * glow * uIntensity;
  gl_FragColor = vec4(col, clamp(glow * uIntensity, 0.0, 1.0));
}
`

interface Props {
  /** Local Y of the crystal within the parent tower group. */
  anchorY: number
  /** Hex colour of this tower's crystal — the gradient's base (crystal) end. */
  crystalColor: string
}

/**
 * A single end-crystal → dragon healing beam. Mounted inside an obsidian tower
 * group at the crystal's local position; it reads the shared dragon position
 * each frame, and when the dragon is within range it orients/stretches a glowing
 * tube from this crystal to the dragon with energy flowing along it.
 */
export default function CrystalBeam({ anchorY, crystalColor }: Props) {
  const groupRef = useRef<Group>(null)
  const meshRef = useRef<Mesh>(null)

  // Own uniforms per beam (length/intensity/colour differ), but share the live
  // world-curve uniform objects so the bend tracks the world for free.
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uFlowSpeed: { value: 1.6 },
          uIntensity: { value: 0 },
          uLength: { value: 1 },
          uColor: { value: new Color('#c850ff') },
          uCrystalColor: { value: new Color('#ff7733') },
          uCurveX: curveUniforms.uCurveX,
          uCurveZ: curveUniforms.uCurveZ,
          uCurvePower: curveUniforms.uCurvePower,
          uCurveCenter: curveUniforms.uCurveCenter,
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        toneMapped: false,
      }),
    [],
  )

  // The tower's crystal colour, parsed once per change, fed to the gradient base.
  const crystalColorObj = useMemo(() => new Color(crystalColor), [crystalColor])

  const crystalWorld = useMemo(() => new Vector3(), [])
  const localTarget = useMemo(() => new Vector3(), [])

  useFrame((state) => {
    const g = groupRef.current
    const m = meshRef.current
    if (!g || !m) return

    const cfg = dragonState.beam
    if (!dragonState.active || !cfg.enabled) {
      g.visible = false
      return
    }

    g.getWorldPosition(crystalWorld)
    const dist = crystalWorld.distanceTo(dragonState.position)
    if (dist > cfg.range) {
      g.visible = false
      return
    }

    // Direction + length to the dragon, expressed in this beam's local frame so
    // the mesh transform (not its parent's) does the aiming.
    localTarget.copy(dragonState.position)
    g.worldToLocal(localTarget)
    const len = localTarget.length()
    if (len < 1e-3) {
      g.visible = false
      return
    }
    g.visible = true

    localTarget.divideScalar(len)
    m.quaternion.setFromUnitVectors(UP, localTarget)
    m.scale.set(cfg.thickness, len, cfg.thickness)

    // Ease the beam off as the dragon nears the edge of range. Reach the
    // uniforms through the mesh ref so we're mutating a ref-held object.
    const fade = 1 - MathUtils.smoothstep(dist, cfg.range * 0.75, cfg.range)
    const u = (m.material as ShaderMaterial).uniforms
    u.uIntensity.value = cfg.intensity * fade
    u.uLength.value = len
    u.uFlowSpeed.value = cfg.flowSpeed
    u.uTime.value = state.clock.elapsedTime
    ;(u.uColor.value as Color).copy(cfg.color)
    ;(u.uCrystalColor.value as Color).copy(crystalColorObj)
  })

  return (
    <group ref={groupRef} position={[0, anchorY, 0]}>
      {/* Bounding sphere is from the unit geometry, not the stretched/bent beam,
          so let it always render rather than be wrongly frustum-culled. */}
      <mesh ref={meshRef} geometry={BEAM_GEOMETRY} material={material} frustumCulled={false} />
    </group>
  )
}
