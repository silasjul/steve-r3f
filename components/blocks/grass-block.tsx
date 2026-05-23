'use client'

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { CanvasTexture, MeshStandardMaterial } from 'three'
import {
  BOX_GEOMETRY,
  applyPixelSettings,
  getOrCreateMaterial,
  usePixelTexture,
  type BlockProps,
} from './_block'

export const GRASS_TINT = '#7CBD6B'

export function useGrassBlockMaterials(): MeshStandardMaterial[] {
  const topTex = usePixelTexture('/textures/grass_block_top.png')
  const dirtTex = usePixelTexture('/textures/dirt.png')
  const overlayTex = usePixelTexture('/textures/grass_block_side_overlay.png')

  const sideTex = useMemo(() => {
    // useTexture suspends, so both images are guaranteed loaded here
    const dirtImg = dirtTex.image as HTMLImageElement
    const size = dirtImg.naturalWidth || 16
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    // Dirt base
    ctx.drawImage(dirtImg, 0, 0, size, size)

    // Tinted overlay on top
    const overlayImg = overlayTex.image as HTMLImageElement
    const oc = document.createElement('canvas')
    oc.width = size
    oc.height = size
    const octx = oc.getContext('2d')!
    octx.imageSmoothingEnabled = false
    octx.drawImage(overlayImg, 0, 0, size, size)
    octx.globalCompositeOperation = 'multiply'
    octx.fillStyle = GRASS_TINT
    octx.fillRect(0, 0, size, size)
    octx.globalCompositeOperation = 'destination-in'
    octx.drawImage(overlayImg, 0, 0, size, size)
    ctx.drawImage(oc, 0, 0)

    const tex = new CanvasTexture(canvas)
    applyPixelSettings(tex)
    return tex
  }, [dirtTex, overlayTex])

  return useMemo(() => {
    const top = getOrCreateMaterial(
      'grass:top',
      () => new MeshStandardMaterial({ map: topTex, color: GRASS_TINT })
    )
    const bottom = getOrCreateMaterial(
      'grass:bottom',
      () => new MeshStandardMaterial({ map: dirtTex })
    )
    const side = new MeshStandardMaterial({ map: sideTex })
    return [side, side, top, bottom, side, side]
  }, [topTex, dirtTex, sideTex])
}

export default function GrassBlock(props: BlockProps) {
  const materials = useGrassBlockMaterials()
  return (
    <mesh
      {...props}
      geometry={BOX_GEOMETRY}
      material={materials}
      castShadow
      receiveShadow
    />
  )
}

useTexture.preload('/textures/dirt.png')
useTexture.preload('/textures/grass_block_top.png')
useTexture.preload('/textures/grass_block_side_overlay.png')
