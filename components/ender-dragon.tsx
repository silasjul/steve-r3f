'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useControls, folder, button } from 'leva'
import { dragonState } from './dragon-state'
import {
  AnimationAction,
  AnimationClip,
  Box3,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  NearestMipmapLinearFilter,
  Object3D,
  Texture,
  Vector3,
} from 'three'

const MODEL_PATH = '/models/ender_dragon.glb'
useGLTF.preload(MODEL_PATH)

// Normalise the model so its longest dimension is this many blocks before the
// Leva scale multiplier is applied. The exported dragon's units are unknown, so
// we measure and rescale rather than hard-coding a scale.
const TARGET_SIZE_BLOCKS = 9

const Y_AXIS = /* @__PURE__ */ new Vector3(0, 1, 0)

/**
 * Per-pattern randomness for the flight path. Steve stays at the world origin,
 * so the dragon orbits (0,0) in X/Z while its angle, radius and height are each
 * modulated by sine waves at *incommensurate* frequencies. Because the
 * frequencies never share a common period the path never exactly repeats, which
 * reads as endlessly varied "random" swooping rather than a fixed loop.
 */
interface FlightParams {
  /** Orbit direction: +1 clockwise, -1 counter-clockwise. */
  dir: number
  radiusFreq: number
  radiusPhase: number
  heightFreq: number
  heightPhase: number
  heightFreq2: number
  heightPhase2: number
  /** Extra swooshing added to the orbit angle so passes aren't evenly spaced. */
  wobbleAmp: number
  wobbleFreq: number
  wobblePhase: number
}

function randomFlight(): FlightParams {
  const rand = (min: number, max: number) => min + Math.random() * (max - min)
  const tau = Math.PI * 2
  return {
    dir: Math.random() < 0.5 ? -1 : 1,
    radiusFreq: rand(0.25, 0.6),
    radiusPhase: rand(0, tau),
    heightFreq: rand(0.2, 0.45),
    heightPhase: rand(0, tau),
    heightFreq2: rand(0.5, 0.9),
    heightPhase2: rand(0, tau),
    wobbleAmp: rand(0.15, 0.5),
    wobbleFreq: rand(0.6, 1.3),
    wobblePhase: rand(0, tau),
  }
}

interface FlightTune {
  /** Mean orbit radius around Steve, in blocks. */
  radius: number
  /** Mean flight height above the ground, in blocks. */
  height: number
  /** Peak radius/height deviation, in blocks — how dramatically it swoops. */
  swoop: number
}

/**
 * Writes the flight position at parameter `t` into `out`. `t` is an abstract
 * clock (advanced by the Speed control), not seconds. The orbit angle, radius
 * and height are independent sine layers so the dragon spirals in and out while
 * climbing and diving — all from continuous trig, so it's seam-free forever.
 */
function flightPosition(
  out: Vector3,
  t: number,
  p: FlightParams,
  tune: FlightTune,
): Vector3 {
  const theta = p.dir * t + p.wobbleAmp * Math.sin(t * p.wobbleFreq + p.wobblePhase)
  const r = tune.radius + tune.swoop * Math.sin(t * p.radiusFreq + p.radiusPhase)
  const y =
    tune.height +
    tune.swoop * Math.sin(t * p.heightFreq + p.heightPhase) +
    tune.swoop * 0.5 * Math.sin(t * p.heightFreq2 + p.heightPhase2)
  out.set(Math.cos(theta) * r, y, Math.sin(theta) * r)
  return out
}

/**
 * Returns a clone of `clip` whose loop wraps `frames` frames earlier. The mixer
 * uses `clip.duration` for the LoopRepeat wrap, so shortening the duration drops
 * the trailing frames (which often don't quite return to the start pose, causing
 * the hitch) without touching keyframe data. fps is derived from keyframe spacing.
 * Same approach Steve uses for its walk loops.
 */
function trimClip(clip: AnimationClip, frames: number): AnimationClip {
  const times = clip.tracks[0]?.times
  if (frames <= 0 || !times || times.length < 2) return clip
  const fps = (times.length - 1) / clip.duration
  const trimmed = clip.clone()
  trimmed.duration = Math.max(1 / fps, clip.duration - frames / fps)
  return trimmed
}

export default function EnderDragon() {
  const group = useRef<Group>(null)
  const { scene, animations } = useGLTF(MODEL_PATH)
  // useAnimations creates the mixer (and updates it every frame); we build our
  // own action from a trimmed clip on that mixer, like Steve does.
  const { mixer } = useAnimations(animations, group)
  const action = useRef<AnimationAction | null>(null)
  const flapRef = useRef(1)

  // Randomised flight shape. The "New Pattern" button swaps it; useFrame
  // re-subscribes every render so the next frame flies the fresh pattern.
  const [flightParams, setFlightParams] = useState<FlightParams>(randomFlight)

  const {
    scaleMultiplier, speed, radius, height, swoop, bank, flap, loopTrim, modelYaw,
    beamEnabled, beamRange, beamIntensity, beamFlow, beamThickness, beamColor,
    beamOffsetX, beamOffsetY, beamOffsetZ,
  } = useControls({
    'Ender Dragon': folder(
      {
        scaleMultiplier: { value: 1, min: 0.2, max: 3, step: 0.05, label: 'Scale' },
        speed: { value: 0.5, min: 0.05, max: 2, step: 0.01, label: 'Speed' },
        radius: { value: 10, min: 3, max: 25, step: 0.5, label: 'Orbit Radius' },
        height: { value: 9, min: 1, max: 25, step: 0.5, label: 'Orbit Height' },
        swoop: { value: 4, min: 0, max: 12, step: 0.5, label: 'Swoop' },
        bank: { value: 0.6, min: 0, max: 2, step: 0.05, label: 'Banking' },
        flap: { value: 1, min: 0, max: 3, step: 0.05, label: 'Flap Speed' },
        loopTrim: { value: 0, min: 0, max: 30, step: 1, label: 'Loop Trim (frames)' },
        modelYaw: { value: 0, min: -Math.PI, max: Math.PI, step: 0.01, label: 'Model Yaw' },
        'New Pattern': button(() => {
          setFlightParams(randomFlight())
        }),
        'Heal Beam': folder(
          {
            beamEnabled: { value: true, label: 'Enabled' },
            beamColor: { value: '#fbb488', label: 'Color' },
            beamRange: { value: 20, min: 4, max: 40, step: 0.5, label: 'Range' },
            beamIntensity: { value: 1.7, min: 0, max: 10, step: 0.1, label: 'Glow' },
            beamFlow: { value: 5, min: 0, max: 6, step: 0.1, label: 'Flow Speed' },
            beamThickness: { value: 0.06, min: 0.02, max: 0.5, step: 0.01, label: 'Thickness' },
            beamOffsetX: { value: 0, min: -5, max: 5, step: 0.05, label: 'Target X' },
            beamOffsetY: { value: -1.50, min: -5, max: 5, step: 0.05, label: 'Target Y' },
            beamOffsetZ: { value: 1.25, min: -5, max: 5, step: 0.05, label: 'Target Z' },
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
    ),
  })

  // Normalise size from the model's bounding box (units are unknown), and grab
  // its centre (in model-local space) — the GLB pivot sits at the dragon's feet,
  // so the box centre is what the heal-beams should actually aim at.
  const { autoScale, modelCenter } = useMemo(() => {
    const box = new Box3().setFromObject(scene)
    const size = new Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const center = new Vector3()
    box.getCenter(center)
    return { autoScale: maxDim > 0 ? TARGET_SIZE_BLOCKS / maxDim : 1, modelCenter: center }
  }, [scene])

  const finalScale = autoScale * scaleMultiplier

  // Pixel-art texture filtering + shadow casting, matching Steve's treatment.
  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      const mats = Array.isArray(mesh.material)
        ? (mesh.material as MeshStandardMaterial[])
        : [mesh.material as MeshStandardMaterial]
      for (const mat of mats) {
        for (const key of Object.keys(mat) as (keyof MeshStandardMaterial)[]) {
          const val = mat[key]
          if (val instanceof Texture) {
            val.magFilter = NearestFilter
            val.minFilter = NearestMipmapLinearFilter
            val.needsUpdate = true
          }
        }
      }
    })
  }, [scene])

  // Loop the wing-flap clip, trimmed by Loop Trim frames to clean up the seam.
  // Re-runs when the trim changes so tuning the slider updates the loop live.
  useEffect(() => {
    const root = group.current
    const src = animations[0]
    if (!root || !src) return
    const clip = trimClip(src, loopTrim)
    const a = mixer.clipAction(clip, root)
    a.reset().fadeIn(0.4).play()
    a.timeScale = flapRef.current
    action.current = a
    return () => {
      a.fadeOut(0.2)
      a.stop()
      if (clip !== src) mixer.uncacheClip(clip)
      action.current = null
    }
  }, [animations, mixer, loopTrim])

  useEffect(() => {
    flapRef.current = flap
    if (action.current) action.current.timeScale = flap
  }, [flap])

  // Announce to the crystal heal-beams that a dragon exists; hide them when this
  // unmounts (e.g. switching away from the End).
  useEffect(() => {
    dragonState.active = true
    return () => {
      dragonState.active = false
    }
  }, [])

  // Push beam tuning into the shared state the towers read each frame.
  useEffect(() => {
    const b = dragonState.beam
    b.enabled = beamEnabled
    b.range = beamRange
    b.intensity = beamIntensity
    b.flowSpeed = beamFlow
    b.thickness = beamThickness
    b.color.set(beamColor)
  }, [beamEnabled, beamRange, beamIntensity, beamFlow, beamThickness, beamColor])

  // Reused scratch objects so the per-frame path math allocates nothing.
  const tmp = useMemo(() => new Object3D(), [])
  const cur = useMemo(() => new Vector3(), [])
  const ahead = useMemo(() => new Vector3(), [])
  const beamTarget = useMemo(() => new Vector3(), [])
  const beamOffset = useMemo(() => new Vector3(), [])
  const clock = useRef(0)
  const heading = useRef(0)
  const roll = useRef(0)
  const initialised = useRef(false)

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    // Clamp delta so a stalled tab (or breakpoint) doesn't teleport the dragon
    // across half the sky on the next frame.
    const dt = Math.min(delta, 0.05)
    clock.current += dt * speed
    const t = clock.current
    const tune: FlightTune = { radius, height, swoop }

    flightPosition(cur, t, flightParams, tune)
    // Sample slightly ahead on the path to get the travel direction. The offset
    // is in path-time (not scaled by speed) so heading stays defined even when
    // Speed is dialled to near zero.
    flightPosition(ahead, t + 0.08, flightParams, tune)

    g.position.copy(cur)

    // Face along the direction of travel. Object3D.lookAt points local +Z at the
    // target, so the model's nose is aligned to +Z via the Model Yaw wrapper.
    tmp.position.copy(cur)
    tmp.up.set(0, 1, 0)
    tmp.lookAt(ahead)

    // Bank into horizontal turns: roll about the forward (+Z) axis by an amount
    // proportional to how fast the heading is changing.
    const h = Math.atan2(ahead.x - cur.x, ahead.z - cur.z)
    let dh = h - heading.current
    while (dh > Math.PI) dh -= Math.PI * 2
    while (dh < -Math.PI) dh += Math.PI * 2
    heading.current = h
    const turnRate = dh / dt
    const targetRoll = MathUtils.clamp(-turnRate * bank, -0.7, 0.7)
    roll.current = MathUtils.lerp(roll.current, targetRoll, 1 - Math.exp(-dt * 3))
    tmp.rotateZ(roll.current)

    if (!initialised.current) {
      // Snap on the first frame so it doesn't whip around from identity.
      g.quaternion.copy(tmp.quaternion)
      initialised.current = true
    } else {
      // Damp toward the target orientation for buttery turns.
      g.quaternion.slerp(tmp.quaternion, 1 - Math.exp(-dt * 5))
    }

    // Publish the dragon's body centre (not the feet-level pivot) so in-range
    // crystals beam to the middle of the model. The box centre AND the user
    // fine-tune offset are both taken in the model's own frame — added before
    // the flight orientation is applied — so the attach point stays glued to the
    // same spot on the body instead of sliding around as the dragon banks and
    // turns. (A world-space offset would drift across the body as it flies.)
    beamOffset.set(beamOffsetX, beamOffsetY, beamOffsetZ)
    beamTarget
      .copy(modelCenter)
      .applyAxisAngle(Y_AXIS, modelYaw)
      .multiplyScalar(finalScale)
      .add(beamOffset)
      .applyQuaternion(g.quaternion)
      .add(cur)
    dragonState.position.copy(beamTarget)
  })

  return (
    <group ref={group}>
      {/* Inner wrapper corrects the model's authored facing to +Z (the travel
          axis) and applies scale, so the outer group can be steered purely by
          the flight math. */}
      <group rotation={[0, modelYaw, 0]} scale={finalScale}>
        <primitive object={scene} />
      </group>
    </group>
  )
}
