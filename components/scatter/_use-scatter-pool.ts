"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import { useScatterWorld } from "./_scatter-context";
import type {
  MeshRefCallback,
  ScatterPoolConfig,
  ScatterPoolHandle,
} from "./_scatter-types";

// Browsers throttle rAF on blur/visibility change; the resumed frame's delta
// can be seconds. Clamping avoids ground overshoot + simultaneous mass-recycle.
const MAX_DT = 1 / 30;

// 8-neighbour offsets used when clusterBias > 0. Module scope so the array
// isn't reallocated per spawn attempt.
const CLUSTER_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

// 26-neighbour offsets for 3D ceiling clusters (direct + diagonal connectivity).
const CLUSTER_DIRS_3D: ReadonlyArray<readonly [number, number, number]> =
  (() => {
    const dirs: Array<[number, number, number]> = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          dirs.push([dx, dy, dz]);
        }
      }
    }
    return dirs;
  })();

function hasClusterNeighbor3D(
  target: number,
  skip: number,
  cx: number,
  cy: number,
  cz: number,
  positions: Float32Array,
  heights: Float32Array,
  initialized: Uint8Array,
): boolean {
  for (let j = 0; j < target; j++) {
    if (j === skip || !initialized[j]) continue;
    const dx = positions[j * 2] - cx;
    const dy = heights[j] - cy;
    const dz = positions[j * 2 + 1] - cz;
    if (dx >= -1 && dx <= 1 && dy >= -1 && dy <= 1 && dz >= -1 && dz <= 1) {
      if (dx !== 0 || dy !== 0 || dz !== 0) return true;
    }
  }
  return false;
}

// Frame-local scratch objects — module scope avoids per-frame allocation and
// these are written-then-read in a single synchronous loop body.
const dummy = new Object3D();
const modelMatrix = new Matrix4();
const finalMatrix = new Matrix4();
const modelEuler = new Euler();
const modelQuat = new Quaternion();
const modelOffset = new Vector3();
const modelScaleVec = new Vector3();

// Indices of slots placed into the current cluster — used by atomic-cluster
// mode so each cluster grows from its own anchor and doesn't chain into the
// previous batch's blocks. Module-scope; cleared at the start of every spawn
// pass that uses it.
const currentClusterIdx: number[] = [];

interface PoolState {
  positions: Float32Array;
  scales: Float32Array;
  rotations: Float32Array;
  heights: Float32Array;
  variants: Uint8Array;
  initialized: Uint8Array;
}

function createState(capacity: number): PoolState {
  return {
    positions: new Float32Array(capacity * 2),
    scales: new Float32Array(capacity),
    rotations: new Float32Array(capacity),
    heights: new Float32Array(capacity),
    variants: new Uint8Array(capacity),
    initialized: new Uint8Array(capacity),
  };
}

function pickWeighted(weights: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += Math.max(0, weights[i]);
  if (total <= 0) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

export function useScatterPool(config: ScatterPoolConfig): ScatterPoolHandle {
  const { speed, radius, occupancy, getGroundOffsetZ } = useScatterWorld();
  const placementRadius = config.placementRadius ?? radius;
  const meshCount = Math.max(1, config.meshCount);

  // Latest props mirrored into refs — assignment happens in useEffect (post
  // commit), never during render, so React Compiler's "no ref writes during
  // render" rule is satisfied.
  const configRef = useRef(config);
  const worldRef = useRef({ speed, radius, occupancy, getGroundOffsetZ });
  useEffect(() => {
    configRef.current = config;
    worldRef.current = { speed, radius, occupancy, getGroundOffsetZ };
  });

  // Mutable buffers. Allocated lazily inside useFrame the first time it runs;
  // never read or written during render so the compiler treats them as inert
  // ref containers (which is what useRef is for).
  const stateRef = useRef<PoolState | null>(null);
  const meshesRef = useRef<(InstancedMesh | null)[]>([]);
  const countersRef = useRef<Uint32Array | null>(null);

  // Reset every slot when the spatial domain changes — without this, growing
  // the radius leaves the old cluster centered and the new ring stays empty.
  useEffect(() => {
    const s = stateRef.current;
    if (s) {
      s.initialized.fill(0);
      s.positions.fill(0);
    }
  }, [placementRadius]);

  // Optional self-registration as an occupier so other pools can blockedBy us.
  useEffect(() => {
    if (!config.registerAsOccupier) return;
    return occupancy.register(config.name, (qx, qz) => {
      const s = stateRef.current;
      if (!s) return false;
      const cfg = configRef.current;
      const square = cfg.snapToGrid === true;
      for (let i = 0; i < cfg.capacity; i++) {
        if (!s.initialized[i]) continue;
        const dx = s.positions[i * 2] - qx;
        const dz = s.positions[i * 2 + 1] - qz;
        const r = cfg.footprint * s.scales[i] * 0.5;
        // Grid-snapped occupiers (eg. unit-tile rocks) block a square area so
        // the footprint slider matches the visible tile extent rather than an
        // inscribed circle that leaves tile corners unblocked.
        if (square) {
          if (Math.abs(dx) < r && Math.abs(dz) < r) return true;
        } else if (dx * dx + dz * dz < r * r) return true;
      }
      return false;
    });
  }, [occupancy, config.name, config.registerAsOccupier]);

  // Stable per-mesh ref callbacks. The useMemo return is itself read-only;
  // the callbacks route writes through meshesRef (a useRef), which is the
  // documented mutable container — so React Compiler's immutability rule
  // doesn't tie this array to downstream `mesh.count = ...` mutations.
  const meshRefs = useMemo<MeshRefCallback[]>(
    () =>
      Array.from(
        { length: meshCount },
        (_, k) => (mesh: InstancedMesh | null) => {
          meshesRef.current[k] = mesh;
          if (mesh) mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        },
      ),
    [meshCount],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, MAX_DT);
    const cfg = configRef.current;
    const {
      speed: spd,
      radius: worldR,
      occupancy: occ,
      getGroundOffsetZ: getGz,
    } = worldRef.current;
    const r = cfg.placementRadius ?? worldR;
    const variantCount = Math.max(1, cfg.variantCount ?? meshCount);

    // Lazy buffer allocation. capacity is constant in every consumer, so this
    // runs exactly once per pool instance.
    if (stateRef.current === null) stateRef.current = createState(cfg.capacity);
    if (
      countersRef.current === null ||
      countersRef.current.length !== meshCount
    ) {
      countersRef.current = new Uint32Array(meshCount);
    }
    const state = stateRef.current;
    const counters = countersRef.current;
    const meshes = meshesRef.current;

    const target = Math.min(cfg.targetCount, cfg.capacity);
    const r2 = r * r;
    const { positions, scales, rotations, heights, variants, initialized } =
      state;
    const spawnSign = spd === 0 ? 1 : -Math.sign(spd);
    const edgeBand = 1.5;
    const selfAvoidFactor = cfg.selfAvoidFactor ?? 0;
    const fanAll = cfg.fanAllMeshes === true;
    const clusterBias = cfg.clusterBias ?? 0;
    const clusterSize = cfg.clusterSize ?? 0;
    const verticalSpread = cfg.verticalSpread ?? 0;

    // Pre-compose the model fix-up matrix once per frame.
    const mdl = cfg.model;
    if (mdl) {
      modelEuler.set(
        MathUtils.degToRad(mdl.rotX),
        MathUtils.degToRad(mdl.rotY),
        MathUtils.degToRad(mdl.rotZ),
        "XYZ",
      );
      modelQuat.setFromEuler(modelEuler);
      modelOffset.set(mdl.offsetX, mdl.offsetY, mdl.offsetZ);
      modelScaleVec.setScalar(mdl.scale);
      modelMatrix.compose(modelOffset, modelQuat, modelScaleVec);
    }

    // Pass 1: advance live slots, despawn those past the trailing edge in the
    // scroll direction. Lateral (x) overflow is tolerated so atomic cluster
    // spawns can extend slightly past the leading edge without immediately
    // recycling. A generous radial safety net still catches stale state after
    // a radius shrink.
    const safetyR = r + 4;
    const safetyR2 = safetyR * safetyR;
    const exitMargin = 1.5;
    for (let i = 0; i < target; i++) {
      if (!initialized[i]) continue;
      const x = positions[i * 2];
      const z = positions[i * 2 + 1] + spd * dt;
      let off = false;
      if (spd > 0) off = z > r + exitMargin;
      else if (spd < 0) off = z < -r - exitMargin;
      if (!off && x * x + z * z > safetyR2) off = true;
      if (off) initialized[i] = 0;
      else positions[i * 2 + 1] = z;
    }

    // Atomic-cluster batching: when clusterSize > 0, defer recycle spawns
    // until enough slots are pending so the next cluster lands intact on the
    // leading edge instead of dribbling in block-by-block. Initial fill (no
    // live slots yet) still spawns the whole pool in one frame so the world
    // load looks identical to before.
    let pending = 0;
    for (let i = 0; i < target; i++) if (!initialized[i]) pending++;
    const alive = target - pending;
    const isInitial = alive === 0 && pending > 0;
    const effectiveCluster = Math.min(clusterSize, target);
    let spawnBudget: number;
    if (clusterSize <= 0 || isInitial) spawnBudget = pending;
    else if (pending >= effectiveCluster) spawnBudget = effectiveCluster;
    else spawnBudget = 0;

    // Pass 2: place pending slots (budget-limited) and emit matrices for every
    // live slot — fused into one loop so initialized slots written this frame
    // immediately serve as cluster seeds for later iterations.
    counters.fill(0);
    let writeIdx = 0;
    // Atomic-cluster bookkeeping. The first slot of each cluster places at a
    // fresh anchor (random in-disc for initial fill, leading-edge band for
    // recycles). Every subsequent slot grows ONLY from currentClusterIdx so
    // clusters don't chain into prior batches and stay visually distinct.
    currentClusterIdx.length = 0;
    const batchMode = clusterSize > 0;

    for (let i = 0; i < target; i++) {
      if (!initialized[i]) {
        if (spawnBudget <= 0) continue;
        const isAnchor = batchMode && currentClusterIdx.length === 0;
        let placed = false;
        let placedX = 0;
        let placedZ = 0;
        let placedY = 0;
        const triesMax =
          verticalSpread > 0 ? 24 : selfAvoidFactor > 0 ? 16 : 6;
        for (let tries = 0; tries < triesMax; tries++) {
          let cx = 0;
          let cz = 0;
          let cy = 0;
          let clustered = false;
          // Pick a cluster seed. In batch mode, the seed pool is the current
          // cluster only — guarantees compact patches that don't merge across
          // batches. In legacy mode (clusterSize=0), seed from any initialized
          // sibling with the original edge-proximity filter for recycles.
          const wantCluster = batchMode
            ? !isAnchor
            : clusterBias > 0 && Math.random() < clusterBias;
          if (wantCluster) {
            if (batchMode) {
              for (let a = 0; a < 12; a++) {
                const j =
                  currentClusterIdx[
                    (Math.random() * currentClusterIdx.length) | 0
                  ];
                const sx = positions[j * 2];
                const sz = positions[j * 2 + 1];
                const sh = heights[j];
                if (verticalSpread > 0) {
                  const d = CLUSTER_DIRS_3D[(Math.random() * 26) | 0];
                  cx = sx + d[0];
                  cy = sh + d[1];
                  cz = sz + d[2];
                  if (cy > 0 || cy < -verticalSpread) continue;
                } else {
                  const d = CLUSTER_DIRS[(Math.random() * 8) | 0];
                  cx = sx + d[0];
                  cz = sz + d[1];
                }
                if (cx * cx + cz * cz > safetyR2) continue;
                clustered = true;
                break;
              }
            } else {
              for (let a = 0; a < 12; a++) {
                const j = (Math.random() * target) | 0;
                if (j === i || !initialized[j]) continue;
                const sz = positions[j * 2 + 1];
                if (!isInitial && spawnSign * sz < r - 4) continue;
                const sx = positions[j * 2];
                const sh = heights[j];
                if (verticalSpread > 0) {
                  const d = CLUSTER_DIRS_3D[(Math.random() * 26) | 0];
                  cx = sx + d[0];
                  cy = sh + d[1];
                  cz = sz + d[2];
                  if (cy > 0 || cy < -verticalSpread) continue;
                } else {
                  const d = CLUSTER_DIRS[(Math.random() * 8) | 0];
                  cx = sx + d[0];
                  cz = sz + d[1];
                }
                if (cx * cx + cz * cz > safetyR2) continue;
                clustered = true;
                break;
              }
            }
          }
          if (!clustered) {
            // Anchor placement. Initial-fill anchors spread across the disc
            // so we get many clusters at world load; otherwise drop the
            // anchor on the leading edge so the cluster appears where Steve
            // is walking toward.
            if (isInitial) {
              const t = Math.random() * Math.PI * 2;
              const rr = Math.sqrt(Math.random()) * r;
              cx = Math.cos(t) * rr;
              cz = Math.sin(t) * rr;
            } else {
              const halfX = r - 0.1;
              cx = (Math.random() * 2 - 1) * halfX;
              const zMax = Math.sqrt(Math.max(0, r2 - cx * cx));
              cz = spawnSign * (zMax - Math.random() * edgeBand);
            }
            // New cluster roots attach to the ceiling underside.
            cy = 0;
          }
          if (cfg.snapToGrid) {
            const gz = getGz();
            cx = Math.round(cx);
            cz = Math.round(cz - gz) + gz;
          }
          if (occ.isBlocked(cx, cz, cfg.blockedBy, cfg.avoidWalkCorridor))
            continue;
          if (verticalSpread > 0) {
            let cellTaken = false;
            for (let j = 0; j < target; j++) {
              if (j === i || !initialized[j]) continue;
              if (
                positions[j * 2] === cx &&
                positions[j * 2 + 1] === cz &&
                heights[j] === cy
              ) {
                cellTaken = true;
                break;
              }
            }
            if (cellTaken) continue;
            // Below-ceiling blocks must connect to an existing neighbour.
            if (
              cy < 0 &&
              !hasClusterNeighbor3D(
                target,
                i,
                cx,
                cy,
                cz,
                positions,
                heights,
                initialized,
              )
            ) {
              continue;
            }
          }
          if (selfAvoidFactor > 0) {
            const minD = cfg.footprint * selfAvoidFactor;
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
          }
          placedX = cx;
          placedZ = cz;
          placedY = cy;
          placed = true;
          break;
        }
        if (!placed) continue;
        positions[i * 2] = placedX;
        positions[i * 2 + 1] = placedZ;
        heights[i] = placedY;
        scales[i] =
          cfg.scaleMin +
          Math.random() * Math.max(0, cfg.scaleMax - cfg.scaleMin);
        rotations[i] = cfg.rotateRandom ? Math.random() * Math.PI * 2 : 0;
        variants[i] =
          cfg.variantWeights && cfg.variantWeights.length === variantCount
            ? pickWeighted(cfg.variantWeights)
            : Math.floor(Math.random() * variantCount);
        initialized[i] = 1;
        spawnBudget--;
        if (batchMode) {
          currentClusterIdx.push(i);
          if (currentClusterIdx.length >= effectiveCluster) {
            // Cluster is full — next placement starts a fresh anchor. This is
            // how initial fill scatters many clusters across the disc rather
            // than packing everything into one mega-blob.
            currentClusterIdx.length = 0;
          }
        }
      }

      const x = positions[i * 2];
      const z = positions[i * 2 + 1];
      const y = heights[i];
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rotations[i], 0);
      dummy.scale.setScalar(scales[i]);
      dummy.updateMatrix();
      if (cfg.suppressMeshOutput) continue;

      const outMatrix = mdl
        ? finalMatrix.multiplyMatrices(dummy.matrix, modelMatrix)
        : dummy.matrix;

      if (fanAll) {
        for (let k = 0; k < meshCount; k++) {
          const mesh = meshes[k];
          if (mesh) mesh.setMatrixAt(writeIdx, outMatrix);
        }
        writeIdx++;
      } else {
        const v = variants[i];
        const mesh = meshes[v];
        if (!mesh) continue;
        const slot = counters[v];
        mesh.setMatrixAt(slot, outMatrix);
        counters[v] = slot + 1;
      }
    }

    if (!cfg.suppressMeshOutput) {
      for (let k = 0; k < meshCount; k++) {
        const mesh = meshes[k];
        if (!mesh) continue;
        mesh.count = fanAll ? writeIdx : counters[k];
        mesh.instanceMatrix.needsUpdate = true;
      }
    }

    if (cfg.onAfterFrame) {
      cfg.onAfterFrame({
        positions,
        scales,
        heights,
        initialized,
        capacity: cfg.capacity,
      });
    }
  });

  return { meshRefs };
}
