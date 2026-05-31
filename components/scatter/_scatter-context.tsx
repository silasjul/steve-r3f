"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useFrame } from "@react-three/fiber";
import type {
  OccupancyAPI,
  OccupancyQuery,
  ScatterWorldState,
} from "./_scatter-types";

const ScatterWorldContext = createContext<ScatterWorldState | null>(null);

interface ScatterWorldProps {
  speed: number;
  radius: number;
  /** Ceiling disc radius for roof scatter pools — defaults to `radius`. */
  ceilingRadius?: number;
  walkCorridorWidth: number;
  children: ReactNode;
}

export function ScatterWorld({
  speed,
  radius,
  ceilingRadius: ceilingRadiusProp,
  walkCorridorWidth,
  children,
}: ScatterWorldProps) {
  const ceilingRadius = ceilingRadiusProp ?? radius;
  const producersRef = useRef(new Map<string, OccupancyQuery>());
  // Read fresh on every isBlocked call so memoized occupancy stays stable
  // across leva tweaks of the corridor width.
  const corridorHalfRef = useRef(walkCorridorWidth / 2);
  corridorHalfRef.current = walkCorridorWidth / 2;

  // Mirrors <Ground>'s `group.position.z`: same accumulation, same wrap, same
  // dt clamp — so reading this in a scatter spawn aligns the rock with the
  // tile under it without coupling to the Ground component.
  const groundOffsetZRef = useRef(0);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    let z = groundOffsetZRef.current + speed * dt;
    if (z > 0.5) z -= 1;
    else if (z < -0.5) z += 1;
    groundOffsetZRef.current = z;
  });
  const getGroundOffsetZ = useCallback(() => groundOffsetZRef.current, []);
  // <Ground> resets group.position to zero when radius changes; mirror that so
  // the two accumulators stay in lockstep across world resizes.
  useEffect(() => {
    groundOffsetZRef.current = 0;
  }, [radius, ceilingRadius]);

  const occupancy = useMemo<OccupancyAPI>(
    () => ({
      register(name, query) {
        producersRef.current.set(name, query);
        return () => {
          producersRef.current.delete(name);
        };
      },
      isBlocked(
        x,
        _z,
        blockedBy,
        avoidWalkCorridor,
        walkCorridorClearance,
        queryRadius,
      ) {
        // Corridor clearance is an explicit per-pool knob, so it is NOT widened
        // by queryRadius (that would double-count for pools like temples whose
        // clearance is already tuned to their half-width).
        if (
          avoidWalkCorridor &&
          Math.abs(x) <= corridorHalfRef.current + (walkCorridorClearance ?? 0)
        )
          return true;
        if (blockedBy.length === 0) return false;
        const map = producersRef.current;
        for (const name of blockedBy) {
          const q = map.get(name);
          if (q && q(x, _z, queryRadius ?? 0)) return true;
        }
        return false;
      },
    }),
    [],
  );

  const value = useMemo<ScatterWorldState>(
    () => ({ speed, radius, ceilingRadius, walkCorridorWidth, occupancy, getGroundOffsetZ }),
    [speed, radius, ceilingRadius, walkCorridorWidth, occupancy, getGroundOffsetZ],
  );

  return (
    <ScatterWorldContext.Provider value={value}>
      {children}
    </ScatterWorldContext.Provider>
  );
}

export function useScatterWorld(): ScatterWorldState {
  const ctx = useContext(ScatterWorldContext);
  if (!ctx)
    throw new Error("useScatterWorld must be used inside <ScatterWorld>");
  return ctx;
}
