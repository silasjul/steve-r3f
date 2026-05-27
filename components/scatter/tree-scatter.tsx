"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useControls, folder } from "leva";
import {
  BufferGeometry,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  type Material,
  MathUtils,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import {
  MAX_TILE_COUNT,
  getTileCount,
} from "@/components/environments/_ground";
import { poolControlsSchema } from "./_use-pool-controls";
import { useScatterWorld } from "./_scatter-context";

useGLTF.preload("/models/tree.glb");

const POOL_NAME = "trees";
const MAX_DENSITY = 0.1;
const CAPACITY = Math.max(8, Math.ceil(MAX_TILE_COUNT * MAX_DENSITY));
const MAX_DT = 1 / 30;

const dummy = new Object3D();
const modelMatrix = new Matrix4();
const finalMatrix = new Matrix4();
const modelEuler = new Euler();
const modelQuat = new Quaternion();
const modelOffset = new Vector3();
const modelScaleVec = new Vector3();

interface SubMesh {
  geometry: BufferGeometry;
  material: Material;
}

function useTreeSubMeshes(): SubMesh[] {
  const { scene } = useGLTF("/models/tree.glb");
  return useMemo(() => {
    const out: SubMesh[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((obj: Object3D) => {
      const m = obj as Mesh;
      if (!m.isMesh) return;
      // Bake the source mesh's world transform into the cloned geometry so
      // each InstancedMesh sits at the origin and we drive placement purely
      // through the per-instance dummy matrix.
      const geom = m.geometry.clone();
      geom.applyMatrix4(m.matrixWorld);
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      out.push({ geometry: geom, material: mat });
    });
    return out;
  }, [scene]);
}

export default function TreeScatter() {
  const subMeshes = useTreeSubMeshes();
  const { speed, radius, occupancy } = useScatterWorld();

  const {
    density,
    scaleMin,
    scaleMax,
    rotateRandom,
    avoidWalkCorridor,
    footprint,
  } = useControls("Tiles", {
    Trees: folder(
      poolControlsSchema({
        density: 0.008,
        scaleMin: 1,
        scaleMax: 1,
        rotateRandom: false,
        avoidWalkCorridor: true,
        footprint: 3.0,
      }),
      { collapsed: true },
    ),
  });

  const {
    treeOffsetX,
    treeOffsetY,
    treeOffsetZ,
    treeRotX,
    treeRotY,
    treeRotZ,
    treeScale,
  } = useControls("Models", {
    Tree: folder(
      {
        treeOffsetX: {
          value: 0,
          min: -5,
          max: 5,
          step: 0.01,
          label: "Offset X",
        },
        treeOffsetY: {
          value: -3,
          min: -5,
          max: 5,
          step: 0.01,
          label: "Offset Y",
        },
        treeOffsetZ: {
          value: 0,
          min: -5,
          max: 5,
          step: 0.01,
          label: "Offset Z",
        },
        treeRotX: { value: 0, min: -180, max: 180, step: 1, label: "Rot X" },
        treeRotY: { value: 0, min: -180, max: 180, step: 1, label: "Rot Y" },
        treeRotZ: { value: 0, min: -180, max: 180, step: 1, label: "Rot Z" },
        treeScale: { value: 7, min: 0.05, max: 20, step: 0.05, label: "Scale" },
      },
      { collapsed: true },
    ),
  });

  const targetCount = Math.min(
    CAPACITY,
    Math.floor((density as number) * getTileCount(radius)),
  );

  const state = useMemo(
    () => ({
      positions: new Float32Array(CAPACITY * 2),
      scales: new Float32Array(CAPACITY),
      rotations: new Float32Array(CAPACITY),
      initialized: new Uint8Array(CAPACITY),
    }),
    [],
  );

  const cfgRef = useRef({
    speed,
    radius,
    occupancy,
    avoidWalkCorridor: avoidWalkCorridor as boolean,
    footprint: footprint as number,
    scaleMin: scaleMin as number,
    scaleMax: scaleMax as number,
    rotateRandom: rotateRandom as boolean,
    targetCount,
    model: {
      ox: treeOffsetX as number,
      oy: treeOffsetY as number,
      oz: treeOffsetZ as number,
      rx: treeRotX as number,
      ry: treeRotY as number,
      rz: treeRotZ as number,
      s: treeScale as number,
    },
  });
  cfgRef.current = {
    speed,
    radius,
    occupancy,
    avoidWalkCorridor: avoidWalkCorridor as boolean,
    footprint: footprint as number,
    scaleMin: scaleMin as number,
    scaleMax: scaleMax as number,
    rotateRandom: rotateRandom as boolean,
    targetCount,
    model: {
      ox: treeOffsetX as number,
      oy: treeOffsetY as number,
      oz: treeOffsetZ as number,
      rx: treeRotX as number,
      ry: treeRotY as number,
      rz: treeRotZ as number,
      s: treeScale as number,
    },
  };

  // Expose a "trees" occupancy producer so grass/flower pools can list us in
  // blockedBy and stay out of the canopy footprint. Reads live state buffers
  // so the answer reflects the current frame's placements.
  useEffect(() => {
    const query = (qx: number, qz: number) => {
      const positions = state.positions;
      const initialized = state.initialized;
      const scales = state.scales;
      const fp = cfgRef.current.footprint;
      for (let i = 0; i < CAPACITY; i++) {
        if (!initialized[i]) continue;
        const dx = positions[i * 2] - qx;
        const dz = positions[i * 2 + 1] - qz;
        const r = fp * scales[i] * 0.5;
        if (dx * dx + dz * dz < r * r) return true;
      }
      return false;
    };
    return occupancy.register(POOL_NAME, query);
  }, [occupancy, state]);

  // Re-roll every slot when radius changes — see comment in _use-scatter-pool.
  useEffect(() => {
    state.initialized.fill(0);
    state.positions.fill(0);
  }, [radius, state]);

  // One InstancedMesh per sub-mesh of the GLB. We fan the same per-instance
  // matrix out to all of them so trunk + leaves move together.
  const meshRefs = useMemo(
    () => subMeshes.map(() => ({ current: null as InstancedMesh | null })),
    [subMeshes],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, MAX_DT);
    const cfg = cfgRef.current;
    const spd = cfg.speed;
    const r = cfg.radius;
    const target = Math.min(cfg.targetCount, CAPACITY);
    const r2 = r * r;
    const positions = state.positions;
    const scales = state.scales;
    const rotations = state.rotations;
    const initialized = state.initialized;
    const spawnSign = spd === 0 ? 1 : -Math.sign(spd);
    const edgeBand = 1.5;

    // Model-level fix-up (offset/rotation/scale) applied "inside" the
    // per-instance transform so all trees share the same correction.
    const mdl = cfg.model;
    modelEuler.set(
      MathUtils.degToRad(mdl.rx),
      MathUtils.degToRad(mdl.ry),
      MathUtils.degToRad(mdl.rz),
      "XYZ",
    );
    modelQuat.setFromEuler(modelEuler);
    modelOffset.set(mdl.ox, mdl.oy, mdl.oz);
    modelScaleVec.setScalar(mdl.s);
    modelMatrix.compose(modelOffset, modelQuat, modelScaleVec);

    let writeIdx = 0;

    for (let i = 0; i < target; i++) {
      let x = positions[i * 2];
      let z = positions[i * 2 + 1];
      let needSpawn = !initialized[i];

      if (!needSpawn) {
        z += spd * dt;
        if (x * x + z * z > r2) needSpawn = true;
      }

      if (needSpawn) {
        const isFresh = !initialized[i];
        // Hide this slot from the self-avoid check so a recycling tree
        // doesn't reject every nearby position because of its own ghost.
        initialized[i] = 0;
        let placed = false;
        for (let tries = 0; tries < 16; tries++) {
          let cx: number, cz: number;
          if (isFresh) {
            // First appearance — pick uniformly inside the disc.
            const t = Math.random() * Math.PI * 2;
            const rr = Math.sqrt(Math.random()) * r;
            cx = Math.cos(t) * rr;
            cz = Math.sin(t) * rr;
          } else {
            // Recycled — re-enter from the far edge in the spawn direction.
            const halfX = r - 0.1;
            cx = (Math.random() * 2 - 1) * halfX;
            const zMax = Math.sqrt(Math.max(0, r2 - cx * cx));
            cz = spawnSign * (zMax - Math.random() * edgeBand);
          }
          if (cfg.occupancy.isBlocked(cx, cz, [], cfg.avoidWalkCorridor))
            continue;
          // Self-avoid: keep canopies from intersecting.
          const minD = cfg.footprint * 1.2;
          const minD2 = minD * minD;
          let tooClose = false;
          for (let j = 0; j < target; j++) {
            if (j === i || !initialized[j]) continue;
            const dx = positions[j * 2] - cx;
            const dz = positions[j * 2 + 1] - cz;
            if (dx * dx + dz * dz < minD2) {
              tooClose = true;
              break;
            }
          }
          if (tooClose) continue;
          x = cx;
          z = cz;
          placed = true;
          break;
        }
        if (!placed) continue;
        positions[i * 2] = x;
        positions[i * 2 + 1] = z;
        scales[i] =
          cfg.scaleMin +
          Math.random() * Math.max(0, cfg.scaleMax - cfg.scaleMin);
        rotations[i] = cfg.rotateRandom ? Math.random() * Math.PI * 2 : 0;
        initialized[i] = 1;
      } else {
        positions[i * 2 + 1] = z;
      }

      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, rotations[i], 0);
      dummy.scale.setScalar(scales[i]);
      dummy.updateMatrix();
      finalMatrix.multiplyMatrices(dummy.matrix, modelMatrix);
      for (let k = 0; k < meshRefs.length; k++) {
        const mesh = meshRefs[k].current;
        if (mesh) mesh.setMatrixAt(writeIdx, finalMatrix);
      }
      writeIdx++;
    }

    for (let k = 0; k < meshRefs.length; k++) {
      const mesh = meshRefs[k].current;
      if (!mesh) continue;
      mesh.count = writeIdx;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {subMeshes.map((sm, i) => (
        <instancedMesh
          key={i}
          ref={(m) => {
            meshRefs[i].current = m;
            if (m) m.instanceMatrix.setUsage(DynamicDrawUsage);
          }}
          args={[sm.geometry, sm.material, CAPACITY]}
          castShadow
          receiveShadow
          frustumCulled={false}
          dispose={null}
        />
      ))}
    </>
  );
}
