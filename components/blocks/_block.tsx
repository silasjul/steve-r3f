'use client'

import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import {
  BoxGeometry,
  MeshStandardMaterial,
  NearestFilter,
  NearestMipmapLinearFilter,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three'
import type { ThreeElements } from '@react-three/fiber'

export type BlockProps = ThreeElements['mesh']

export const BOX_GEOMETRY = new BoxGeometry(1, 1, 1)
export const PLANE_GEOMETRY = new PlaneGeometry(1, 1)

const MATERIAL_CACHE = new Map<string, MeshStandardMaterial>()
const CONFIGURED_TEXTURES = new WeakSet<Texture>()

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

export function usePixelTexture(path: string): Texture {
  const tex = useTexture(path)
  useEffect(() => {
    applyPixelSettings(tex)
  }, [tex])
  return tex
}

export function useAnimatedFrameTexture(path: string, frameSize = 16): Texture {
  const tex = useTexture(path)
  useEffect(() => {
    applyPixelSettings(tex)
    const img = tex.image as HTMLImageElement | undefined
    if (img && img.height > frameSize) {
      const repeatY = frameSize / img.height
      tex.repeat.set(1, repeatY)
      tex.offset.set(0, 1 - repeatY)
    }
  }, [tex, frameSize])
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

interface SimpleCubeBlockProps extends BlockProps, PixelMaterialOptions {
  texturePath: string
}

export function SimpleCubeBlock({
  texturePath,
  tint,
  emissive,
  emissiveIntensity,
  transparent,
  opacity,
  ...meshProps
}: SimpleCubeBlockProps) {
  const material = useSharedPixelMaterial(texturePath, {
    tint,
    emissive,
    emissiveIntensity,
    transparent,
    opacity,
  })
  return (
    <mesh
      {...meshProps}
      geometry={BOX_GEOMETRY}
      material={material}
      castShadow
      receiveShadow
    />
  )
}
