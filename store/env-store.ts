'use client'

import { create } from 'zustand'

interface EnvState {
  radius: number
  walkSpeed: number
  setRadius: (r: number) => void
  setWalkSpeed: (s: number) => void
}

export const useEnvStore = create<EnvState>((set) => ({
  radius: 25,
  walkSpeed: -1,
  setRadius: (radius) => set({ radius }),
  setWalkSpeed: (walkSpeed) => set({ walkSpeed }),
}))
