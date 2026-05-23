'use client'

import { create } from 'zustand'

export const SHADOW_MAP_SIZES = [512, 1024, 2048, 4096] as const
export type ShadowMapSize = (typeof SHADOW_MAP_SIZES)[number]

interface ShadowState {
  shadowMapSize: ShadowMapSize
  setShadowMapSize: (size: ShadowMapSize) => void
}

export const useShadowStore = create<ShadowState>((set) => ({
  shadowMapSize: 2048,
  setShadowMapSize: (shadowMapSize) => set({ shadowMapSize }),
}))
