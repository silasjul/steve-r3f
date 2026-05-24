'use client'

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { CanvasTexture, MeshStandardMaterial } from 'three'
import {
  PLANE_GEOMETRY,
  applyPixelSettings,
  getOrCreateMaterial,
  usePixelTexture,
  type BlockProps,
} from './_block'

export const GRASS_TINT = '#7CBD6B'

export function useGrassTopMaterial(): MeshStandardMaterial {
  const topTex = usePixelTexture('/textures/grass_block_top.png')
  return useMemo(
    () =>
      getOrCreateMaterial(
        'grass:top',
        () => new MeshStandardMaterial({ map: topTex, color: GRASS_TINT })
      ),
    [topTex]
  )
}

export function useGrassBottomMaterial(): MeshStandardMaterial {
  const dirtTex = usePixelTexture('/textures/dirt.png')
  return useMemo(
    () =>
      getOrCreateMaterial(
        'grass:bottom',
        () => new MeshStandardMaterial({ map: dirtTex })
      ),
    [dirtTex]
  )
}

export function useGrassSideMaterial(): MeshStandardMaterial {
  const dirtTex = usePixelTexture('/textures/dirt.png')
  const overlayTex = usePixelTexture('/textures/grass_block_side_overlay.png')

  const sideTex = useMemo(() => {
    const dirtImg = dirtTex.image as HTMLImageElement
    const size = dirtImg.naturalWidth || 16
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    ctx.drawImage(dirtImg, 0, 0, size, size)

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

  return useMemo(
    () => new MeshStandardMaterial({ map: sideTex }),
    [sideTex]
  )
}

export default function GrassBlock(props: BlockProps) {
  const material = useGrassTopMaterial()
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      {...props}
      geometry={PLANE_GEOMETRY}
      material={material}
      castShadow
      receiveShadow
    />
  )
}

useTexture.preload('/textures/dirt.png')
useTexture.preload('/textures/grass_block_top.png')
useTexture.preload('/textures/grass_block_side_overlay.png')
