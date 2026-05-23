'use client'

import { Canvas } from '@react-three/fiber'
import Steve from './steve'
import SceneControls from './scene-controls'
import Environment from './environment'
import { useWorldStore } from '@/store/world-store'

export default function SteveScene() {
  const cycleWorld = useWorldStore((s) => s.cycleWorld)
  return (
    <div className='h-screen w-screen'>
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }} onPointerMissed={cycleWorld}>
        <Environment />
        <Steve />
        <SceneControls />
      </Canvas>
    </div>
  )
}
