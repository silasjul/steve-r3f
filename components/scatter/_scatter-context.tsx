'use client'

import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import type { OccupancyAPI, OccupancyQuery, ScatterWorldState } from './_scatter-types'

const ScatterWorldContext = createContext<ScatterWorldState | null>(null)

interface ScatterWorldProps {
  speed: number
  radius: number
  walkCorridorWidth: number
  children: ReactNode
}

export function ScatterWorld({ speed, radius, walkCorridorWidth, children }: ScatterWorldProps) {
  const producersRef = useRef(new Map<string, OccupancyQuery>())
  // Read fresh on every isBlocked call so memoized occupancy stays stable
  // across leva tweaks of the corridor width.
  const corridorHalfRef = useRef(walkCorridorWidth / 2)
  corridorHalfRef.current = walkCorridorWidth / 2

  const occupancy = useMemo<OccupancyAPI>(
    () => ({
      register(name, query) {
        producersRef.current.set(name, query)
        return () => {
          producersRef.current.delete(name)
        }
      },
      isBlocked(x, _z, blockedBy, avoidWalkCorridor) {
        if (avoidWalkCorridor && Math.abs(x) <= corridorHalfRef.current) return true
        if (blockedBy.length === 0) return false
        const map = producersRef.current
        for (const name of blockedBy) {
          const q = map.get(name)
          if (q && q(x, _z)) return true
        }
        return false
      },
    }),
    []
  )

  const value = useMemo<ScatterWorldState>(
    () => ({ speed, radius, walkCorridorWidth, occupancy }),
    [speed, radius, walkCorridorWidth, occupancy]
  )

  return <ScatterWorldContext.Provider value={value}>{children}</ScatterWorldContext.Provider>
}

export function useScatterWorld(): ScatterWorldState {
  const ctx = useContext(ScatterWorldContext)
  if (!ctx) throw new Error('useScatterWorld must be used inside <ScatterWorld>')
  return ctx
}
