"use client";

import { useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { useControls, folder } from "leva";
import { InstancedMesh, MeshStandardMaterial } from "three";
import {
  PLANE_GEOMETRY,
  getOrCreateMaterial,
  useAnimatedFrameTexture,
} from "@/components/blocks/_block";
import { getTileCountRect } from "@/components/environments/_ground";
import { poolControlsSchema, spawnZoneControlsSchema } from "./_use-pool-controls";
import { useScatterPool } from "./_use-scatter-pool";
import {
  useScatterDefaults,
  useEnvLabel,
} from "@/components/environments/_env-config";

useTexture.preload("/textures/lava_still.png");

const POOL_NAME = "lava";
const MAX_DENSITY = 0.25;
const ZONE_DEFAULTS = { width: 40, forwardDepth: 25, backDepth: 25 };
const CAPACITY = Math.max(64, Math.ceil(getTileCountRect(ZONE_DEFAULTS.width, ZONE_DEFAULTS.forwardDepth, ZONE_DEFAULTS.backDepth) * MAX_DENSITY));

const FLOOR_GEOMETRY = PLANE_GEOMETRY.clone().rotateX(-Math.PI / 2);

export default function LavaScatter() {
  const defaults = useScatterDefaults("lava");
  const envLabel = useEnvLabel();

  const tex = useAnimatedFrameTexture("/textures/lava_still.png");
  const material = useMemo(
    () =>
      getOrCreateMaterial(
        "lava:scatter",
        () =>
          new MeshStandardMaterial({
            map: tex,
            emissive: "#ff5500",
            emissiveMap: tex,
            emissiveIntensity: 1.2,
          }),
      ),
    [tex],
  );

  const controlValues = useControls(envLabel, {
    Tiles: folder(
      {
        Lava: folder(
          {
            ...poolControlsSchema(defaults.pool),
            cluster: {
              value: defaults.cluster,
              min: 0,
              max: 1,
              step: 0.01,
              label: "Cluster",
            },
            'Spawn Zone': folder(spawnZoneControlsSchema(ZONE_DEFAULTS), { collapsed: true }),
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
    ),
  }) as Record<string, number | boolean>;

  const model = useMemo(
    () => ({
      offsetX: 0,
      offsetY: 0.002,
      offsetZ: 0,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      scale: 1,
    }),
    [],
  );

  const spawnWidth = controlValues.spawnWidth as number;
  const spawnForward = controlValues.spawnForward as number;
  const spawnBack = controlValues.spawnBack as number;

  const targetCount = Math.min(
    CAPACITY,
    Math.floor((controlValues.density as number) * getTileCountRect(spawnWidth, spawnForward, spawnBack)),
  );

  const meshesRef = useRef<(InstancedMesh | null)[]>([])

  useScatterPool({
    name: POOL_NAME,
    capacity: CAPACITY,
    targetCount,
    footprint: controlValues.footprint as number,
    blockedBy: [],
    avoidWalkCorridor: controlValues.avoidWalkCorridor as boolean,
    scaleMin: controlValues.scaleMin as number,
    scaleMax: controlValues.scaleMax as number,
    rotateRandom: controlValues.rotateRandom as boolean,
    meshCount: 1,
    variantCount: 1,
    selfAvoidFactor: 0,
    snapToGrid: true,
    clusterBias: controlValues.cluster as number,
    clusterSize: 16,
    registerAsOccupier: true,
    meshesRef,
    spawnZone: { width: spawnWidth, forwardDepth: spawnForward, backDepth: spawnBack },
    model,
  });

  return (
    <instancedMesh
      ref={(node) => { meshesRef.current[0] = node }}
      args={[FLOOR_GEOMETRY, material, CAPACITY]}
      castShadow={false}
      receiveShadow
      frustumCulled={false}
      dispose={null}
    />
  );
}
