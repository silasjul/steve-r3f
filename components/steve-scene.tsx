'use client'

import { Canvas } from '@react-three/fiber'
import { PerfReader } from './perf-hud'
import { Leva, useControls, folder } from 'leva'
import { useEffect, useRef, useState } from 'react'
import Steve from './steve'
import SceneControls from './scene-controls'
import Environment from './environment'
import { AnimatedTextureTicker } from '@/components/blocks/_block'
import { useWorldStore } from '@/store/world-store'

export default function SteveScene() {
  const cycleWorld = useWorldStore((s) => s.cycleWorld)
  const { showPerf } = useControls({
    Debug: folder(
      {
        showPerf: { value: false, label: 'Show Perf' },
      },
      { collapsed: true }
    ),
  })
  const [levaHidden, setLevaHidden] = useState(true)
  const hudRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') setLevaHidden((h) => !h)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className='h-screen w-screen'>
      <Leva hidden={levaHidden} />
      {showPerf && (
        <div
          ref={hudRef}
          className="fixed top-0 left-0 z-50 m-2 whitespace-pre rounded bg-black/60 p-2 font-mono text-xs leading-tight text-lime-400"
        />
      )}
      <Canvas shadows="soft" camera={{ position: [0, 0, 5], fov: 60 }} onPointerMissed={cycleWorld}>
        {showPerf && <PerfReader targetRef={hudRef} />}
        <AnimatedTextureTicker />
        <Environment />
        <Steve />
        <SceneControls />
      </Canvas>
    </div>
  )
}
