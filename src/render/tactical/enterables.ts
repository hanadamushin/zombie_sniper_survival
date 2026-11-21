// Enterable buildings (07d): drawn in three stages by distance (RENDER.enterables), from the same
// blueprint parts the collision is made of (gen/buildings).
//
//   far    one box per building up to the eaves (window pattern in the shader) + its roof shape —
//          straight from the placement, no blueprint needed. Always there unless a closer stage is.
//   mid    the outside: every `shell` part (walls with real openings, glass, doors, roof).
//   near   the inside as well (`interior` parts: floors, partitions, stairs, furniture).
//
// Draw calls do not grow with the number of buildings: every part of every building shares one
// InstancedMesh per shape (box, gable, hip, wedge) plus one for glass, per map. Each building holds
// ranges of slots in those pools; dropping a stage zeroes its slots and frees them. Going up a stage
// (generating the blueprint and writing its instances) happens for at most RENDER.enterables.perFrame
// buildings a frame, nearest first, so that walking into a town never stalls a frame.

import * as THREE from 'three';
import { RENDER } from '../../data/render.ts';
import { ARCH } from '../../data/architecture.ts';
import { blueprintOf, dirToWorld, placementKey, rectToWorld, type BuildingPlacement, type MaterialId, type Part, type PartShape } from '../../gen/buildings/index.ts';
import { MATERIALS } from '../../gen/buildings/materials.ts';
import { hash01 } from '../../gen/noise.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { boxMaterial, gableGeometry, STYLE } from './buildings.ts';
import type { Built } from './terrain.ts';

const E = RENDER.enterables;
type Stage = 0 | 1 | 2;
type PoolId = PartShape | 'glass';

/** Unit hipped roof: footprint [-0.5, 0.5]², eaves at y = 0, ridge along x at y = 1; the ridge ends move in by the per-instance `aHip`. */
function hipGeometry(): THREE.BufferGeometry {
  const a = [-0.5, 0, -0.5], b = [0.5, 0, -0.5], c = [0.5, 0, 0.5], d = [-0.5, 0, 0.5], e = [-0.5, 1, 0], f = [0.5, 1, 0];
  const tris = [a, e, f, a, f, b, d, c, f, d, f, e, a, d, e, b, f, c, a, b, c, a, c, d];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  geo.computeVertexNormals();
  return geo;
}
/** Unit wedge: footprint [-0.5, 0.5]², rising from y = 0 at x = -0.5 to y = 1 at x = 0.5. */
function wedgeGeometry(): THREE.BufferGeometry {
  const a = [-0.5, 0, -0.5], b = [0.5, 0, -0.5], c = [0.5, 0, 0.5], d = [-0.5, 0, 0.5], e = [0.5, 1, -0.5], f = [0.5, 1, 0.5];
  const tris = [a, f, e, a, d, f, b, e, f, b, f, c, a, e, b, d, c, f, a, b, c, a, c, d];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  geo.computeVertexNormals();
  return geo;
}

function hipMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aHip;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nif ( position.y > 0.5 ) transformed.x = sign( position.x ) * ( 0.5 - aHip );');
  };
  return m;
}

/** A pool of instances of one shape, growing when full. Slots are handed out in ranges. */
class Pool {
  mesh: THREE.InstancedMesh;
  high = 0;
  free: [number, number][] = [];
  hip: THREE.InstancedBufferAttribute | null = null;
  readonly id: PoolId;
  readonly group: THREE.Group;
  constructor(id: PoolId, group: THREE.Group, capacity: number) {
    this.id = id;
    this.group = group;
    this.mesh = this.make(capacity);
  }
  private geometry(): THREE.BufferGeometry {
    if (this.id === 'gable') return gableGeometry();
    if (this.id === 'hip') return hipGeometry();
    if (this.id === 'wedge') return wedgeGeometry();
    return new THREE.BoxGeometry(1, 1, 1);
  }
  private make(capacity: number): THREE.InstancedMesh {
    const geo = this.geometry();
    let material: THREE.Material;
    if (this.id === 'glass') material = new THREE.MeshLambertMaterial({ transparent: true, opacity: E.glassOpacity, depthWrite: false, side: THREE.DoubleSide });
    else if (this.id === 'hip') material = hipMaterial();
    else material = new THREE.MeshLambertMaterial({ side: this.id === 'box' ? THREE.FrontSide : THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, new THREE.Color(0));
    mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    if (this.id === 'hip') {
      this.hip = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      geo.setAttribute('aHip', this.hip);
    }
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.name = `enterable-${this.id}`;
    if (this.id === 'glass') mesh.renderOrder = 2;
    this.group.add(mesh);
    return mesh;
  }
  get capacity(): number {
    return this.mesh.instanceMatrix.count;
  }
  alloc(n: number): number {
    for (let i = 0; i < this.free.length; i++) {
      const [s, c] = this.free[i]!;
      if (c < n) continue;
      if (c === n) this.free.splice(i, 1);
      else this.free[i] = [s + n, c - n];
      return s;
    }
    if (this.high + n > this.capacity) this.grow(this.high + n);
    const s = this.high;
    this.high += n;
    this.mesh.count = this.high;
    return s;
  }
  release(start: number, n: number): void {
    const arr = this.mesh.instanceMatrix.array as Float32Array;
    arr.fill(0, start * 16, (start + n) * 16);
    this.touch(start, n);
    this.free.push([start, n]);
    // Merge neighbouring free ranges; give the top back.
    this.free.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const r of this.free) {
      const last = merged[merged.length - 1];
      if (last && last[0] + last[1] === r[0]) last[1] += r[1];
      else merged.push([r[0], r[1]]);
    }
    const top = merged[merged.length - 1];
    if (top && top[0] + top[1] === this.high) {
      this.high = top[0];
      merged.pop();
      this.mesh.count = this.high;
    }
    this.free = merged;
  }
  touch(start: number, n: number): void {
    this.mesh.instanceMatrix.addUpdateRange(start * 16, n * 16);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.addUpdateRange(start * 3, n * 3);
    this.mesh.instanceColor!.needsUpdate = true;
    if (this.hip) {
      this.hip.addUpdateRange(start, n);
      this.hip.needsUpdate = true;
    }
  }
  private grow(need: number): void {
    let cap = this.capacity;
    while (cap < need) cap *= 2;
    const old = this.mesh;
    const oldHip = this.hip;
    this.mesh = this.make(cap);
    (this.mesh.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
    (this.mesh.instanceColor!.array as Float32Array).set(old.instanceColor!.array as Float32Array);
    if (oldHip && this.hip) (this.hip.array as Float32Array).set(oldHip.array as Float32Array);
    this.mesh.count = this.high;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    if (this.hip) this.hip.needsUpdate = true;
    old.removeFromParent();
    old.geometry.dispose();
    (old.material as THREE.Material).dispose();
    old.dispose();
  }
  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}

interface Held {
  pool: PoolId;
  start: number;
  count: number;
}
interface Building {
  place: BuildingPlacement;
  stage: Stage;
  shell: Held[];
  inside: Held[];
}

const m4 = new THREE.Matrix4();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const quat = new THREE.Quaternion();
const yAxis = new THREE.Vector3(0, 1, 0);
const col = new THREE.Color();

function colourOf(mat: MaterialId, tint: number | undefined, seed: number, salt: number): number {
  const list = (RENDER.materials as Record<MaterialId, readonly number[]>)[mat];
  const t = tint ?? hash01(seed, salt, 13);
  return list[Math.min(list.length - 1, Math.floor(t * list.length))]!;
}

/** Instance transform of a part in the map frame (gen/buildings/place.ts turns the local frame). */
function partMatrix(p: BuildingPlacement, part: Part): void {
  const r = rectToWorld(p, part.x0, part.z0, part.x1, part.z1);
  const y0 = p.base + part.y0;
  const y1 = p.base + part.y1;
  const wx = r[2] - r[0];
  const wz = r[3] - r[1];
  const h = y1 - y0;
  const cx = (r[0] + r[2]) / 2;
  const cz = (r[1] + r[3]) / 2;
  if (part.shape === 'box') {
    m4.compose(pos.set(cx, (y0 + y1) / 2, cz), quat.identity(), scl.set(wx, h, wz));
    return;
  }
  if (part.shape === 'wedge') {
    // Unit wedge rises towards +x; turn it to the part's slope in the world.
    const [sx, sz] = (({ 'x+': [1, 0], 'x-': [-1, 0], 'z+': [0, 1], 'z-': [0, -1] }) as const)[part.slope ?? 'x+'];
    const [dx, dz] = dirToWorld(p.rot, sx, sz);
    const angle = Math.atan2(-dz, dx);
    const along = Math.abs(dx) > 0.5 ? wx : wz;
    const across = Math.abs(dx) > 0.5 ? wz : wx;
    m4.compose(pos.set(cx, y0, cz), quat.setFromAxisAngle(yAxis, angle), scl.set(along, h, across));
    return;
  }
  // Gable / hip: ridge along the unit x.
  const localAlongX = (part.axis ?? 'x') === 'x';
  const worldAlongX = localAlongX === (p.rot % 2 === 0);
  if (worldAlongX) m4.compose(pos.set(cx, y0, cz), quat.identity(), scl.set(wx, h, wz));
  else m4.compose(pos.set(cx, y0, cz), quat.setFromAxisAngle(yAxis, Math.PI / 2), scl.set(wz, h, wx));
}

export interface EnterablePart extends Built {
  /** Camera position in the map's frame; `budget` = stage upgrades still allowed this frame (returns what is left). */
  update(cx: number, cy: number, cz: number, budget: number): number;
  /** Buildings waiting to go up a stage. */
  pending(): number;
  /** How many buildings are at each stage (far, mid, near). */
  stages(): [number, number, number];
}

let slowest = 0;
/** Longest single stage upgrade so far (ms) — the e2e records it as the worst switching hitch. */
export function enterableUpgradeMaxMs(reset = false): number {
  const v = slowest;
  if (reset) slowest = 0;
  return v;
}

const byMap = new WeakMap<TacticalMap, (i: number) => Stage>();
/** The stage a map's i-th placement is drawn at now (debug / e2e), or -1 when the map is not drawn. */
export function enterableStageOf(map: TacticalMap, i: number): number {
  return byMap.get(map)?.(i) ?? -1;
}

export function buildEnterables(map: TacticalMap): EnterablePart {
  const group = new THREE.Group();
  group.name = 'enterables';
  const list: Building[] = [];
  const seenKeys = new Map<string, Building>();
  // --- far outlines: one box and one roof per building (rebuilt when the placements change) ---
  let farBox: THREE.InstancedMesh | null = null;
  let farRoof: THREE.InstancedMesh | null = null;
  let farFor: BuildingPlacement[] = [];
  const farIndex = new Map<BuildingPlacement, { box: number; roof: number }>();
  const pools = new Map<PoolId, Pool>();
  const pool = (id: PoolId): Pool => {
    let p = pools.get(id);
    if (!p) pools.set(id, (p = new Pool(id, group, id === 'box' ? E.capacity : Math.max(64, E.capacity / 16))));
    return p;
  };

  const SUNK = ARCH.foundation;
  const rebuildFar = (): void => {
    farBox?.removeFromParent();
    farBox?.geometry.dispose();
    (farBox?.material as THREE.Material | undefined)?.dispose();
    farBox?.dispose();
    farRoof?.removeFromParent();
    farRoof?.geometry.dispose();
    (farRoof?.material as THREE.Material | undefined)?.dispose();
    farRoof?.dispose();
    farBox = farRoof = null;
    farIndex.clear();
    farFor = map.placements.slice();
    const n = farFor.length;
    if (n === 0) return;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const style = new Float32Array(n);
    farBox = new THREE.InstancedMesh(geo, boxMaterial(), n);
    farBox.name = 'enterable-far';
    const pitched = farFor.filter((p) => p.roof !== 'flat').length;
    if (pitched > 0) {
      farRoof = new THREE.InstancedMesh(gableGeometry(), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), pitched);
      farRoof.name = 'enterable-far-roof';
    }
    let r = 0;
    farFor.forEach((p, i) => {
      const b = map.buildings[p.building];
      style[i] = STYLE[b?.kind ?? 'house'];
      const roof = p.roof !== 'flat' ? r++ : -1;
      farIndex.set(p, { box: i, roof });
      writeFar(p, true);
    });
    geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(style, 1));
    farBox.computeBoundingSphere();
    group.add(farBox);
    if (farRoof) {
      farRoof.computeBoundingSphere();
      group.add(farRoof);
    }
  };
  const writeFar = (p: BuildingPlacement, show: boolean): void => {
    const at = farIndex.get(p);
    if (!at || !farBox) return;
    const wx = p.x1 - p.x0;
    const wz = p.z1 - p.z0;
    const seed = p.seed;
    if (show) {
      m4.compose(pos.set((p.x0 + p.x1) / 2, p.base - SUNK + (p.eaves + SUNK) / 2, (p.z0 + p.z1) / 2), quat.identity(), scl.set(wx, p.eaves + SUNK, wz));
      farBox.setColorAt(at.box, col.setHex(colourOf(p.roof === 'flat' ? 'concrete' : 'siding', undefined, seed, 1)));
    } else m4.makeScale(0, 0, 0);
    farBox.setMatrixAt(at.box, m4);
    farBox.instanceMatrix.needsUpdate = true;
    if (farBox.instanceColor) farBox.instanceColor.needsUpdate = true;
    if (farRoof && at.roof >= 0) {
      if (show) {
        const alongX = wx >= wz;
        const ov = ARCH.overhang * 2;
        const rise = p.height - p.eaves;
        if (alongX) m4.compose(pos.set((p.x0 + p.x1) / 2, p.base + p.eaves, (p.z0 + p.z1) / 2), quat.identity(), scl.set(wx + ov, rise, wz + ov));
        else m4.compose(pos.set((p.x0 + p.x1) / 2, p.base + p.eaves, (p.z0 + p.z1) / 2), quat.setFromAxisAngle(yAxis, Math.PI / 2), scl.set(wz + ov, rise, wx + ov));
        farRoof.setColorAt(at.roof, col.setHex(colourOf('tile', undefined, seed, 2)));
      } else m4.makeScale(0, 0, 0);
      farRoof.setMatrixAt(at.roof, m4);
      farRoof.instanceMatrix.needsUpdate = true;
      if (farRoof.instanceColor) farRoof.instanceColor.needsUpdate = true;
    }
  };

  /** Write a building's parts of one layer into the pools. */
  const add = (b: Building, layer: 'shell' | 'interior'): Held[] => {
    const p = b.place;
    const bp = blueprintOf(p);
    const counts = new Map<PoolId, number>();
    const which = (part: Part): PoolId => (MATERIALS[part.mat].glass ? 'glass' : part.shape);
    const mine = bp.parts.filter((part) => part.layer === layer && !part.hidden && !(part.key && p.open)); // 07d-2f: an opened key door has no leaf
    for (const part of mine) counts.set(which(part), (counts.get(which(part)) ?? 0) + 1);
    const held: Held[] = [];
    const cursor = new Map<PoolId, number>();
    for (const [id, n] of counts) {
      const start = pool(id).alloc(n);
      held.push({ pool: id, start, count: n });
      cursor.set(id, start);
    }
    const shade = layer === 'interior' ? E.interiorShade : 1;
    mine.forEach((part, i) => {
      const id = which(part);
      const pl = pool(id);
      const slot = cursor.get(id)!;
      cursor.set(id, slot + 1);
      partMatrix(p, part);
      pl.mesh.setMatrixAt(slot, m4);
      pl.mesh.setColorAt(slot, col.setHex(colourOf(part.mat, part.tint, p.seed, i)).multiplyScalar(shade));
      if (pl.hip) {
        // The ridge ends move in by half the short span (in units of the long side).
        const along = (part.axis ?? 'x') === 'x' ? part.x1 - part.x0 : part.z1 - part.z0;
        const across = (part.axis ?? 'x') === 'x' ? part.z1 - part.z0 : part.x1 - part.x0;
        pl.hip.setX(slot, Math.min(0.5, across / 2 / Math.max(1e-6, along)));
      }
    });
    for (const h of held) pool(h.pool).touch(h.start, h.count);
    return held;
  };
  const drop = (held: Held[]): void => {
    for (const h of held) pool(h.pool).release(h.start, h.count);
    held.length = 0;
  };
  const setStage = (b: Building, stage: Stage): void => {
    const t0 = performance.now();
    if (stage >= 1 && b.shell.length === 0 && b.stage < 1) b.shell = add(b, 'shell');
    if (stage >= 2 && b.inside.length === 0) b.inside = add(b, 'interior');
    if (stage < 2) drop(b.inside);
    if (stage < 1) drop(b.shell);
    if ((stage >= 1) !== (b.stage >= 1)) writeFar(b.place, stage === 0);
    b.stage = stage;
    const ms = performance.now() - t0;
    if (ms > slowest) slowest = ms;
  };

  const sync = (): void => {
    // The home map's list changes when the base is built on (06 structures): match by placement.
    if (farFor.length === map.placements.length && farFor.every((p, i) => p === map.placements[i])) return;
    // Same placement (by value) = same building: keep what is drawn of it.
    const keep = new Set(map.placements.map(placementKey));
    for (const [key, b] of seenKeys) if (!keep.has(key)) {
      drop(b.inside);
      drop(b.shell);
      seenKeys.delete(key);
    }
    list.length = 0;
    for (const p of map.placements) {
      const key = placementKey(p);
      let b = seenKeys.get(key);
      if (b) b.place = p;
      else seenKeys.set(key, (b = { place: p, stage: 0, shell: [], inside: [] }));
      list.push(b);
    }
    rebuildFar();
    for (const b of list) if (b.stage > 0) writeFar(b.place, false);
  };
  sync();

  byMap.set(map, (i) => (map.placements[i] ? (seenKeys.get(placementKey(map.placements[i]!))?.stage ?? 0) : 0));
  let waiting = 0;
  const wanted: { b: Building; stage: Stage; dist: number }[] = [];
  return {
    object: group,
    update(cx, cy, cz, budget) {
      sync();
      wanted.length = 0;
      for (const b of list) {
        const p = b.place;
        const dist = Math.hypot(Math.max(p.x0 - cx, 0, cx - p.x1), Math.max(p.z0 - cz, 0, cz - p.z1));
        const inside = dist === 0 && cy > p.base - 1 && cy < p.base + p.height + 1;
        const hy = (s: Stage): number => (b.stage >= s ? E.hysteresis : 0);
        const stage: Stage = inside || dist < E.near + hy(2) ? 2 : dist < E.mid + hy(1) ? 1 : 0;
        if (stage < b.stage) setStage(b, stage); // going down is cheap: do it now
        else if (stage > b.stage) wanted.push({ b, stage, dist });
      }
      wanted.sort((a, c) => a.dist - c.dist);
      let left = budget;
      for (const w of wanted) {
        if (left <= 0) break;
        // One step at a time: a far building first gets its outside, the next frame its inside.
        setStage(w.b, (w.b.stage + 1) as Stage);
        left--;
      }
      waiting = wanted.length - (budget - left);
      return left;
    },
    pending: () => waiting,
    stages() {
      const n: [number, number, number] = [0, 0, 0];
      for (const b of list) n[b.stage]++;
      return n;
    },
    dispose() {
      for (const p of pools.values()) p.dispose();
      pools.clear();
      farBox?.geometry.dispose();
      (farBox?.material as THREE.Material | undefined)?.dispose();
      farBox?.dispose();
      farRoof?.geometry.dispose();
      (farRoof?.material as THREE.Material | undefined)?.dispose();
      farRoof?.dispose();
    },
  };
}
