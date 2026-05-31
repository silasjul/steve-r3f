"use client";

import { create } from "zustand";

export const WORLDS = [
  "overworld-day",
  "overworld-night",
  "desert",
  "nether",
  "end",
] as const;
export type World = (typeof WORLDS)[number];

interface WorldState {
  world: World;
  setWorld: (w: World) => void;
  cycleWorld: () => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  world: "overworld-day",
  setWorld: (world) => set({ world }),
  cycleWorld: () =>
    set((s) => ({
      world: WORLDS[(WORLDS.indexOf(s.world) + 1) % WORLDS.length],
    })),
}));
