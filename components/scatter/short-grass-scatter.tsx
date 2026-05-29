"use client";

import { useMemo, useRef } from "react";
import { useControls, folder } from "leva";
import { DoubleSide, InstancedMesh, MeshStandardMaterial } from "three";
import {
  getOrCreateMaterial,
  usePixelTexture,
} from "@/components/blocks/_block";
import { GRASS_TINT } from "@/components/blocks/grass-block";
import { getTileCountRect } from "@/components/environments/_ground";
import { getCrossPlaneGeometry } from "./_cross-plane-geometry";
import { poolControlsSchema, spawnZoneControlsSchema } from "./_use-pool-controls";
import { useScatterPool } from "./_use-scatter-pool";
import { applyWindShader, createWindDepthMaterial } from "@/components/wind";
import {
  useScatterDefaults,
  useEnvLabel,
} from "@/components/environments/_env-config";

const POOL_NAME = "short-grass";
const MAX_DENSITY = 2;
const ZONE_DEFAULTS = { width: 43, forwardDepth: 28, backDepth: 28 };
const CAPACITY = Math.ceil(getTileCountRect(ZONE_DEFAULTS.width, ZONE_DEFAULTS.forwardDepth, ZONE_DEFAULTS.backDepth) * MAX_DENSITY);
/** Sink the cross-plane base slightly into the grass block top. */
const GRASS_Y_OFFSET = -0.01;

export default function ShortGrassScatter() {
  const tex = usePixelTexture("/textures/short_grass.png");
  const material = useMemo(() => {
    const m = getOrCreateMaterial(
      "short-grass-scatter",
      () =>
        new MeshStandardMaterial({
          map: tex,
          color: GRASS_TINT,
          transparent: true,
          alphaTest: 0.5,
          side: DoubleSide,
        }),
    );
    applyWindShader(m);
    return m;
  }, [tex]);
  const depthMaterial = useMemo(() => createWindDepthMaterial(tex), [tex]);
  const geometry = useMemo(() => getCrossPlaneGeometry(), []);
  const defaults = useScatterDefaults("shortGrass");
  const envLabel = useEnvLabel();

  const controls = useControls(envLabel, {
    Tiles: folder(
      {
        "Short Grass": folder(
          {
            ...poolControlsSchema(defaults.pool),
            "Spawn Zone": folder(spawnZoneControlsSchema(ZONE_DEFAULTS), { collapsed: true }),
          },
          { collapsed: true },
        ),
      },
      { collapsed: true },
    ),
  });

  const density = controls.density as number;
  const scaleMin = controls.scaleMin as number;
  const scaleMax = controls.scaleMax as number;
  const rotateRandom = controls.rotateRandom as boolean;
  const avoidWalkCorridor = controls.avoidWalkCorridor as boolean;
  const footprint = controls.footprint as number;
  const spawnWidth = controls.spawnWidth as number;
  const spawnForward = controls.spawnForward as number;
  const spawnBack = controls.spawnBack as number;

  const targetCount = Math.min(
    CAPACITY,
    Math.floor(density * getTileCountRect(spawnWidth, spawnForward, spawnBack)),
  );

  const model = useMemo(
    () => ({
      offsetX: 0,
      offsetY: GRASS_Y_OFFSET,
      offsetZ: 0,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      scale: 1,
    }),
    [],
  );

  const meshesRef = useRef<(InstancedMesh | null)[]>([]);

  useScatterPool({
    name: POOL_NAME,
    capacity: CAPACITY,
    targetCount,
    footprint,
    blockedBy: ["trees", "rocks"],
    avoidWalkCorridor,
    scaleMin,
    scaleMax,
    rotateRandom,
    meshCount: 1,
    variantCount: 1,
    meshesRef,
    spawnZone: { width: spawnWidth, forwardDepth: spawnForward, backDepth: spawnBack },
    model,
  });

  return (
    <instancedMesh
      ref={(node) => { meshesRef.current[0] = node }}
      args={[geometry, material, CAPACITY]}
      customDepthMaterial={depthMaterial}
      castShadow
      receiveShadow
      frustumCulled={false}
      dispose={null}
    />
  );
}
