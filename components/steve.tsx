'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useControls, folder } from 'leva'
import {
  AnimationClip,
  Box3,
  Group,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  NearestMipmapLinearFilter,
  Texture,
} from 'three'
import { useEnvStore } from '@/store/env-store'

useGLTF.preload('/models/steve.glb')

const TARGET_HEIGHT_BLOCKS = 1.8

/**
 * Per-animation configuration. Swapping to an animation applies its own
 * playback rate (`timeScale`) and pushes its `walkSpeed` into the env store so
 * the whole world (ground + scatter) scrolls at a speed matching that clip.
 * `trimFrames` shortens the loop by that many frames off the end — useful when
 * an exported clip has a frame or two too many and the loop stutters.
 */
interface SteveAnimation {
  /** Clip name as authored in steve.glb. */
  name: string
  /** Steve's animation playback multiplier. */
  timeScale: number
  /** World scroll speed while this clip plays (negative = forward). */
  walkSpeed: number
  /** Frames trimmed off the end of the clip to clean up the loop. */
  trimFrames: number
}

const STEVE_ANIMATIONS: SteveAnimation[] = [
  { name: 'aura_walk', timeScale: 0.85, walkSpeed: -1, trimFrames: 1 },
  { name: 'regular_walk', timeScale: 0.74, walkSpeed: -1.5, trimFrames: 0 },
  { name: 'buff_walk', timeScale: 0.85, walkSpeed: -1.15, trimFrames: 0 },
  { name: 'feminin_walk', timeScale: 1.16, walkSpeed: -1.7, trimFrames: 0 },
  { name: 'latspread_walk', timeScale: 0.85, walkSpeed: -1.6, trimFrames: 0 },
  { name: 'armswing_dance', timeScale: 0.85, walkSpeed: -0.4, trimFrames: 0 },
  { name: 'getting_freaky', timeScale: 0.85, walkSpeed: 0, trimFrames: 0 },
  { name: 'hip_hop_shit', timeScale: 0.85, walkSpeed: -0.4, trimFrames: 0 },
]

const DEFAULT_ANIM: Omit<SteveAnimation, 'name'> = {
  timeScale: 0.85,
  walkSpeed: -1,
  trimFrames: 0,
}

/**
 * Returns a clone of `clip` whose loop wraps `frames` frames earlier. The mixer
 * uses `clip.duration` for the LoopRepeat wrap, so shortening the duration drops
 * the trailing frames without touching keyframe data. fps is derived from the
 * baked keyframe spacing.
 */
function trimClip(clip: AnimationClip, frames: number): AnimationClip {
  const times = clip.tracks[0]?.times
  if (frames <= 0 || !times || times.length < 2) return clip
  const fps = (times.length - 1) / clip.duration
  const trimmed = clip.clone()
  trimmed.duration = Math.max(1 / fps, clip.duration - frames / fps)
  return trimmed
}

export default function Steve() {
  const group = useRef<Group>(null)
  const { scene, animations } = useGLTF('/models/steve.glb')
  const { names, mixer } = useAnimations(animations, group)
  const activeAction = useRef<ReturnType<typeof mixer.clipAction> | null>(null)
  const timeScaleRef = useRef(DEFAULT_ANIM.timeScale)

  const byName = useMemo(
    () => new Map(STEVE_ANIMATIONS.map((a) => [a.name, a])),
    []
  )

  // Dropdown lists the configured clips that actually exist in the glb; falls
  // back to whatever the glb provides if the config and model drift apart.
  const animationOptions = useMemo(() => {
    const present = STEVE_ANIMATIONS.map((a) => a.name).filter((n) =>
      names.includes(n)
    )
    if (present.length) return present
    return names.length > 0 ? names : ['none']
  }, [names])

  const animIndexRef = useRef(0)

  const [{ animation, timeScale, walkSpeed, endTrim, freeze, scaleMultiplier }, set] =
    useControls(() => ({
      Steve: folder(
        {
          scaleMultiplier: { value: 1.5, min: 1.3, max: 1.8, step: 0.01, label: 'Scale' },
          freeze: { value: false, label: 'Freeze' },
          animation: {
            value: animationOptions[0],
            options: animationOptions,
          },
          timeScale: { value: DEFAULT_ANIM.timeScale, min: 0.1, max: 3, step: 0.01, label: 'Anim Speed' },
          walkSpeed: { value: DEFAULT_ANIM.walkSpeed, min: -3, max: 3, step: 0.1, label: 'World Speed' },
          endTrim: { value: DEFAULT_ANIM.trimFrames, min: 0, max: 30, step: 1, label: 'End Trim (frames)' },
        },
        { collapsed: true }
      ),
    }))

  // On animation swap, load that clip's configured speeds + trim into the leva
  // fields so each animation carries its own tuning. Manual tweaks live until
  // the next swap, which is what makes per-animation tuning practical.
  useEffect(() => {
    const cfg = byName.get(animation) ?? DEFAULT_ANIM
    set({ timeScale: cfg.timeScale, walkSpeed: cfg.walkSpeed, endTrim: cfg.trimFrames })
  }, [animation, byName, set])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        animIndexRef.current = (animIndexRef.current + 1) % animationOptions.length
        set({ animation: animationOptions[animIndexRef.current] })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [animationOptions, set])

  const { autoScale, footOffset } = useMemo(() => {
    const box = new Box3().setFromObject(scene)
    const height = box.max.y - box.min.y
    const auto = height > 0 ? TARGET_HEIGHT_BLOCKS / height : 1
    return { autoScale: auto, footOffset: -box.min.y * auto }
  }, [scene])

  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as Mesh).isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
        const mats = Array.isArray((obj as Mesh).material)
          ? ((obj as Mesh).material as MeshStandardMaterial[])
          : [(obj as Mesh).material as MeshStandardMaterial]
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
      }
    })
  }, [scene])

  const finalScale = autoScale * scaleMultiplier
  const finalY = footOffset * scaleMultiplier

  // Drive the whole world's scroll speed from the active animation's setting.
  useEffect(() => {
    if (walkSpeed !== useEnvStore.getState().walkSpeed) {
      useEnvStore.setState({ walkSpeed })
    }
  }, [walkSpeed])

  // Mirror external edits (e.g. the Movement folder's Walk Speed slider) back
  // into this control so the two views of the same store value stay in step.
  useEffect(() => {
    return useEnvStore.subscribe((s, p) => {
      if (s.walkSpeed !== p.walkSpeed) set({ walkSpeed: s.walkSpeed })
    })
  }, [set])

  // Play the (optionally trimmed) clip. Re-runs when the trim changes so tuning
  // the frame count updates the loop live.
  useEffect(() => {
    const root = group.current
    mixer.stopAllAction()
    if (freeze || animation === 'none' || !root) {
      activeAction.current = null
      return
    }
    const src = animations.find((c) => c.name === animation)
    if (!src) return
    const clip = trimClip(src, endTrim)
    const action = mixer.clipAction(clip, root)
    action.reset().fadeIn(0.2).play()
    action.timeScale = timeScaleRef.current
    activeAction.current = action
    return () => {
      action.stop()
      if (clip !== src) mixer.uncacheClip(clip)
    }
  }, [animation, endTrim, freeze, mixer, animations])

  useEffect(() => {
    timeScaleRef.current = timeScale
    if (activeAction.current) {
      activeAction.current.timeScale = timeScale
    }
  }, [timeScale])

  return <primitive ref={group} object={scene} scale={finalScale} position={[0, finalY, 0]} />
}
