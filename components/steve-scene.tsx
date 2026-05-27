'use client'

import { Canvas } from '@react-three/fiber'
import { StatsGl } from '@react-three/drei'
import { Leva, useControls, folder } from 'leva'
import { useEffect, useState } from 'react'
import Steve from './steve'
import SceneControls from './scene-controls'
import Environment from './environment'
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
      <Canvas shadows camera={{ position: [0, 0, 5], fov: 60 }} onPointerMissed={cycleWorld}>
        {showPerf && <StatsGl className="fixed! top-0! left-0! z-50!" />}
        <Environment />
        <Steve />
        <SceneControls />
      </Canvas>
    </div>
  )
}
