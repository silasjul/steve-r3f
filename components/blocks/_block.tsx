'use client'

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import {
  MeshStandardMaterial,
  NearestFilter,
  NearestMipmapLinearFilter,
  PlaneGeometry,
  ClampToEdgeWrapping,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three'
import type { ThreeElements } from '@react-three/fiber'

export type BlockProps = ThreeElements['mesh']

export const PLANE_GEOMETRY = new PlaneGeometry(1, 1)

const MATERIAL_CACHE = new Map<string, MeshStandardMaterial>()
const CONFIGURED_TEXTURES = new WeakSet<Texture>()
const CONFIGURED_ANIMATED_TEXTURES = new WeakSet<Texture>()

export function getOrCreateMaterial(
  key: string,
  factory: () => MeshStandardMaterial
): MeshStandardMaterial {
  let m = MATERIAL_CACHE.get(key)
  if (!m) {
    m = factory()
    MATERIAL_CACHE.set(key, m)
  }
  return m
}

export function applyPixelSettings(tex: Texture) {
  if (CONFIGURED_TEXTURES.has(tex)) return
  tex.magFilter = NearestFilter
  tex.minFilter = NearestMipmapLinearFilter
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  tex.generateMipmaps = true
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.needsUpdate = true
  CONFIGURED_TEXTURES.add(tex)
}

function applyAnimatedPixelSettings(tex: Texture) {
  if (CONFIGURED_ANIMATED_TEXTURES.has(tex)) return
  tex.magFilter = NearestFilter
  tex.minFilter = NearestFilter
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 1
  tex.generateMipmaps = false
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
  tex.needsUpdate = true
  CONFIGURED_ANIMATED_TEXTURES.add(tex)
}

export function usePixelTexture(path: string): Texture {
  const tex = useTexture(path)
  useEffect(() => {
    applyPixelSettings(tex)
  }, [tex])
  return tex
}

interface AnimatedTextureEntry {
  tex: Texture
  frameCount: number
  repeatY: number
  frameIndex: number
  direction: 1 | -1
  elapsed: number
  frameTime: number
}

const ANIMATED_TEXTURES = new Map<string, AnimatedTextureEntry>()

function setAnimatedFrame(entry: AnimatedTextureEntry) {
  // PNG frames are stacked top-to-bottom; with Three.js flipY (default for
  // loaded images) row 0 sits at v=0, so frame 0 is offset 0 and we step up.
  entry.tex.offset.set(0, entry.frameIndex * entry.repeatY)
}

function advanceAnimatedFrame(entry: AnimatedTextureEntry) {
  entry.frameIndex += entry.direction

  if (entry.frameIndex >= entry.frameCount - 1) {
    entry.frameIndex = entry.frameCount - 1
    entry.direction = -1
  } else if (entry.frameIndex <= 0) {
    entry.frameIndex = 0
    entry.direction = 1
  }

  setAnimatedFrame(entry)
}

function registerAnimatedTexture(
  path: string,
  tex: Texture,
  frameSize: number,
  frameTime: number
): boolean {
  const img = tex.image as { height?: number } | undefined
  if (!img?.height || img.height <= frameSize) return false

  applyAnimatedPixelSettings(tex)
  const repeatY = frameSize / img.height
  const frameCount = Math.floor(img.height / frameSize)
  tex.repeat.set(1, repeatY)

  const entry: AnimatedTextureEntry = {
    tex,
    frameCount,
    repeatY,
    frameIndex: 0,
    direction: 1,
    elapsed: 0,
    frameTime,
  }
  setAnimatedFrame(entry)
  ANIMATED_TEXTURES.set(path, entry)
  return true
}

function tickAnimatedTextures(dt: number) {
  for (const entry of ANIMATED_TEXTURES.values()) {
    if (entry.frameCount <= 1) continue

    entry.elapsed += dt
    while (entry.elapsed >= entry.frameTime) {
      entry.elapsed -= entry.frameTime
      advanceAnimatedFrame(entry)
    }
  }
}

export function AnimatedTextureTicker() {
  useFrame((_, dt) => {
    if (ANIMATED_TEXTURES.size === 0) return
    tickAnimatedTextures(dt)
  })
  return null
}

export function useAnimatedFrameTexture(
  path: string,
  frameSize = 16,
  frameTime = 0.15
): Texture {
  const tex = useTexture(path)

  useEffect(() => {
    registerAnimatedTexture(path, tex, frameSize, frameTime)
    return () => {
      ANIMATED_TEXTURES.delete(path)
    }
  }, [tex, path, frameSize, frameTime])

  useFrame(() => {
    if (ANIMATED_TEXTURES.has(path)) return
    registerAnimatedTexture(path, tex, frameSize, frameTime)
  })

  return tex
}

export interface PixelMaterialOptions {
  tint?: string
  emissive?: string
  emissiveIntensity?: number
  transparent?: boolean
  opacity?: number
}

export function useSharedPixelMaterial(
  path: string,
  options: PixelMaterialOptions = {}
): MeshStandardMaterial {
  const tex = usePixelTexture(path)
  const { tint, emissive, emissiveIntensity, transparent, opacity } = options
  return useMemo(() => {
    const key = `${path}|${tint ?? ''}|${emissive ?? ''}|${emissiveIntensity ?? ''}|${transparent ?? ''}|${opacity ?? ''}`
    return getOrCreateMaterial(
      key,
      () =>
        new MeshStandardMaterial({
          map: tex,
          color: tint,
          emissive,
          emissiveMap: emissive ? tex : undefined,
          emissiveIntensity,
          transparent,
          opacity,
        })
    )
  }, [tex, path, tint, emissive, emissiveIntensity, transparent, opacity])
}

interface SimplePlaneBlockProps extends BlockProps, PixelMaterialOptions {
  texturePath: string
}

export function SimplePlaneBlock({
  texturePath,
  tint,
  emissive,
  emissiveIntensity,
  transparent,
  opacity,
  ...meshProps
}: SimplePlaneBlockProps) {
  const material = useSharedPixelMaterial(texturePath, {
    tint,
    emissive,
    emissiveIntensity,
    transparent,
    opacity,
  })
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      {...meshProps}
      geometry={PLANE_GEOMETRY}
      material={material}
      castShadow
      receiveShadow
    />
  )
}
