'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'

/**
 * Reads draw calls / triangles / GPU resource counts off the renderer each
 * frame and writes them straight to a DOM node (no per-frame React re-render).
 * Must live inside <Canvas>; point `targetRef` at a div rendered outside it.
 *
 * gl.info auto-resets on *every* render call, so with postprocessing the last
 * value would only reflect the final fullscreen pass. We disable auto-reset and
 * reset once per frame ourselves, so the numbers cover the whole frame.
 */
export function PerfReader({
  targetRef,
}: {
  targetRef: RefObject<HTMLDivElement | null>
}) {
  // grab the store accessor rather than `gl` directly so mutating
  // renderer.info isn't flagged as mutating a hook return value
  const get = useThree((s) => s.get)
  const last = useRef(0)
  const fps = useRef(60)

  useEffect(() => {
    const info = get().gl.info
    info.autoReset = false
    return () => {
      info.autoReset = true
      info.reset()
    }
  }, [get])

  useFrame((state, delta) => {
    // exponential moving average so the fps number doesn't jitter
    fps.current += (1 / Math.max(delta, 0.0001) - fps.current) * 0.1

    const t = state.clock.elapsedTime
    if (t - last.current >= 0.2) {
      last.current = t
      const el = targetRef.current
      if (el) {
        const { render, memory, programs } = state.gl.info
        el.textContent =
          `fps   ${fps.current.toFixed(0)}\n` +
          `calls ${render.calls}\n` +
          `tris  ${render.triangles.toLocaleString()}\n` +
          `geo   ${memory.geometries}\n` +
          `tex   ${memory.textures}\n` +
          `prog  ${programs?.length ?? 0}`
      }
    }

    // reset after reading so next frame accumulates from zero across all passes
    state.gl.info.reset()
  })

  return null
}
