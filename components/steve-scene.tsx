'use client'

import { Canvas } from '@react-three/fiber'
import Light from './light'
import Steve from './steve'
import SceneControls from './scene-controls'
import Environment from './environment'

export default function SteveScene() {
  return (
    <div className='h-screen w-screen'>
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
        <Environment />
        <Light />
        <Steve />
        <SceneControls />
      </Canvas>
    </div>
  )
}
