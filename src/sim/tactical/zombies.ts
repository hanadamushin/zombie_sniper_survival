// Zombies: spawning from the cell's Z, perception, the wander -> alert -> chase -> attack -> down
// state machine, movement (straight at the goal with wall sliding, side-stepping when stuck, outside
// stairs as waypoints), hit shapes and damage. Per-kind numbers: data/zombies.ts, behaviour numbers:
// BALANCE.zombie.
//
// Rules worth knowing:
//  - The cell's Z is NOT reduced here: killing emits `zombieKilled`, the world system subtracts.
//  - Gunshots are silent. Zombies react to what they see: the player, or a fellow going down.
//  - Outside stairs are climbed (same step-up rules as the player); ladders and towers are not —
//    chasers gather underneath.

import { rand, randInt, randRange, stream, type RngState } from '../../core/rng.ts';
import { addMinutes, isNight } from '../../core/time.ts';
import type { GameState, StaticGrid, TacticalState, Zombie, ZombieKind } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { RESEARCH } from '../../data/techs.ts';
import { KILL, ZOMBIES, type ZombieDef } from '../../data/zombies.ts';
import { getMod } from '../research/modifiers.ts';
import type { TacticalMap } from '../../gen/index.ts';
import type { SimContext } from '../system.ts';
import { BUILD } from '../../data/buildings.ts';
import { chaseField, raidField, tileOf, type FlowField } from '../build/flowfield.ts';
import { bodyDistance, damageStructure, defOf, GATE_THICK, moatFilled, overlayOf, structureAtTile, TILE, TILES, type Overlay } from '../build/structures.ts';
import { cellTactical } from '../world/derive.ts';
import type { TacticalArea } from './area.ts';
import { heightAt, isWalkable, pushOut, segmentHitsStatic, supportAt, type Vec3 } from './collision.ts';
import { hurtPlayer, isDead } from './health.ts';
import { RANGE_SPOTS } from './range.ts';
import { segmentCapsule, segmentSphere } from './shapes.ts';

const Z = BALANCE.zombie;
const PRONE = ZOMBIES.crawler;

// ---------------------------------------------------------------------------------------------
// Bookkeeping that is not part of GameState (rebuilt on demand)
// ---------------------------------------------------------------------------------------------

interface Runtime {
  byId: Map<number, Zombie>;
  stairs: Map<number, Vec3[] | null>;
}
const runtimes = new WeakMap<TacticalState, Runtime>();

function runtimeOf(t: TacticalState): Runtime {
  let rt = runtimes.get(t);
  if (!rt) runtimes.set(t, (rt = { byId: new Map(), stairs: new Map() }));
  if (rt.byId.size !== t.zombies.length) {
    rt.byId.clear();
    for (const z of t.zombies) rt.byId.set(z.id, z);
  }
  return rt;
}

export function zombieById(t: TacticalState, id: number): Zombie | undefined {
  return runtimeOf(t).byId.get(id);
}

export const isProne = (z: Zombie): boolean => z.crippled || ZOMBIES[z.kind].prone;
/** Zombies that count against the cell's population (not yet dead). */
export const aliveCount = (t: TacticalState): number => t.zombies.reduce((n, z) => n + (z.state === 'down' ? 0 : 1), 0);

export function makeZombie(state: GameState, kind: ZombieKind, x: number, y: number, z: number, yaw: number): Zombie {
  return {
    id: state.nextId++, kind, pos: [x, y, z], yaw, hp: ZOMBIES[kind].hp, state: 'wander', target: null, crippled: false, t: 0,
    vy: 0, goal: [x, z], lost: 0, cd: 0, flinch: 0, detourT: 0, detourSide: 1, stuck: 0, stair: -1, stairAt: 0,
    detours: 0, free: 0, corpseSeen: state.nextId, corpseId: 0, headshot: false, walk: 0, pace: 1,
  };
}

/** Add a zombie to the area (also used by tests and the debug API). */
export function addZombie(state: GameState, area: TacticalArea, kind: ZombieKind, x: number, z: number, yaw = 0): Zombie | null {
  const t = state.tactical;
  if (!t || t.zombies.length >= Z.max) return null;
  const zombie = makeZombie(state, kind, x, supportAt(area.map, x, z, heightAt(area.map, x, z)), z, yaw);
  zombie.pace = 0.85 + 0.3 * rand(stream(state, 'tactical.zombie'));
  t.zombies.push(zombie);
  runtimeOf(t).byId.set(zombie.id, zombie);
  area.dynamic.set(zombie.id, x, z);
  return zombie;
}

function removeAt(t: TacticalState, area: TacticalArea, index: number): void {
  const z = t.zombies[index]!;
  area.dynamic.remove(z.id);
  runtimeOf(t).byId.delete(z.id);
  t.zombies[index] = t.zombies[t.zombies.length - 1]!;
  t.zombies.pop();
}

/** Remove every zombie within `radius` of (x, z) without killing them (revival, debug). */
export function clearZombiesNear(state: GameState, area: TacticalArea, x: number, z: number, radius: number): void {
  const t = state.tactical;
  if (!t) return;
  for (let i = t.zombies.length - 1; i >= 0; i--) {
    const zb = t.zombies[i]!;
    if (Math.hypot(zb.pos[0] - x, zb.pos[2] - z) < radius) removeAt(t, area, i);
  }
}

// ---------------------------------------------------------------------------------------------
// Hit shapes
// ---------------------------------------------------------------------------------------------

export interface HitShapes {
  head: Vec3;
  headR: number;
  torsoA: Vec3;
  torsoB: Vec3;
  torsoR: number;
  legsA: Vec3;
  legsB: Vec3;
  legsR: number;
}

const shared: HitShapes = { head: [0, 0, 0], headR: 0, torsoA: [0, 0, 0], torsoB: [0, 0, 0], torsoR: 0, legsA: [0, 0, 0], legsB: [0, 0, 0], legsR: 0 };

/** Forward lean of the upper body (radians): full when hunting, slight when shambling about. */
export function leanOf(z: Zombie): number {
  const lean = ZOMBIES[z.kind].lean;
  return z.state === 'chase' || z.state === 'attack' ? lean : lean * 0.4;
}

/**
 * Head sphere, torso capsule and legs capsule of a zombie in world space. The renderer draws its
 * boxes around the same points, so what you see is what you hit.
 */
export function hitShapes(z: Zombie, out: HitShapes = shared): HitShapes {
  const def = ZOMBIES[z.kind];
  const [x, y, zz] = z.pos;
  const fx = -Math.sin(z.yaw);
  const fz = -Math.cos(z.yaw);
  const set = (v: Vec3, forward: number, up: number): void => {
    v[0] = x + fx * forward;
    v[1] = y + up;
    v[2] = zz + fz * forward;
  };
  if (isProne(z)) {
    set(out.head, 0.8, 0.25);
    set(out.torsoA, -0.02, 0.2);
    set(out.torsoB, 0.5, 0.22);
    set(out.legsA, -0.9, 0.14);
    set(out.legsB, -0.25, 0.16);
    out.headR = def.headR;
    out.torsoR = PRONE.torsoR;
    out.legsR = PRONE.legR;
    return out;
  }
  const H = def.height;
  const hip = H * 0.5;
  // The upper body is tilted forward about the hips by the lean (the renderer does the same).
  const lean = leanOf(z);
  const sin = Math.sin(lean);
  const cos = Math.cos(lean);
  const chestLo = def.torsoR * 0.6;
  const chestHi = hip - def.headR * 2 - 0.02 - def.torsoR;
  const headY = hip - def.headR;
  set(out.legsA, 0, def.legR);
  set(out.legsB, 0, hip);
  set(out.torsoA, chestLo * sin, hip + chestLo * cos);
  set(out.torsoB, chestHi * sin, hip + chestHi * cos);
  set(out.head, headY * sin, hip + headY * cos);
  out.headR = def.headR;
  out.torsoR = def.torsoR;
  out.legsR = def.legR + 0.045;
  return out;
}

/** First hit of a segment (origin o, unit direction d, length len) on a zombie, or null. */
export function hitZombie(z: Zombie, o: Readonly<Vec3>, d: Readonly<Vec3>, len: number): { t: number; part: 'head' | 'torso' | 'legs' } | null {
  const s = hitShapes(z);
  let t = segmentSphere(o, d, len, s.head[0], s.head[1], s.head[2], s.headR);
  let part: 'head' | 'torso' | 'legs' = 'head';
  const tt = segmentCapsule(o, d, len, s.torsoA, s.torsoB, s.torsoR);
  if (tt >= 0 && (t < 0 || tt < t)) {
    t = tt;
    part = 'torso';
  }
  const tl = segmentCapsule(o, d, len, s.legsA, s.legsB, s.legsR);
  if (tl >= 0 && (t < 0 || tl < t)) {
    t = tl;
    part = 'legs';
  }
  return t >= 0 ? { t, part } : null;
}

// ---------------------------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------------------------

function alert(z: Zombie, gx: number, gz: number, seconds: number): void {
  if (z.state !== 'wander' && z.state !== 'alert') return;
  if (z.dummy || z.raid) return; // raiders keep coming
  z.state = 'alert';
  z.t = seconds;
  z.goal[0] = gx;
  z.goal[1] = gz;
  z.stuck = 0;
}

const near: number[] = [];

/** Put a zombie down. `by`: the player, or the id of the defender / structure that did it (06). */
export function killZombie(state: GameState, area: TacticalArea, ctx: Pick<SimContext, 'emit'>, z: Zombie, headshot: boolean, knife: boolean, by: number | 'player' = 'player'): void {
  const t = state.tactical!;
  z.state = 'down';
  z.t = 0;
  z.hp = 0;
  z.headshot = headshot;
  z.target = null;
  z.corpseId = state.nextId++;
  area.dynamic.remove(z.id);
  if (by === 'player') {
    state.player.stats.kills += 1;
    if (headshot) state.player.stats.headshots += 1;
  }
  ctx.emit({ type: 'zombieKilled', id: z.id, kind: z.kind, by, headshot, pos: [z.pos[0], z.pos[1], z.pos[2]], knife });
  // Those who see it fall start searching.
  near.length = 0;
  area.dynamic.query(z.pos[0], z.pos[2], Z.corpseDist, near);
  for (const id of near) {
    const other = runtimeOf(t).byId.get(id);
    if (!other || other.state !== 'wander' || other.dummy) continue;
    if (Math.hypot(other.pos[0] - z.pos[0], other.pos[2] - z.pos[2]) > Z.corpseDist) continue;
    if (segmentHitsStatic(area.map, [other.pos[0], other.pos[1] + 1.5, other.pos[2]], [z.pos[0], z.pos[1] + 0.6, z.pos[2]])) continue;
    alert(other, z.pos[0], z.pos[2], Z.alertSeconds);
    other.corpseSeen = z.corpseId;
  }
}

/**
 * Apply one hit. `mul` scales the damage table (pierced bullets, weapon). Returns true when it killed.
 * `amount` overrides the table (knife).
 */
export function damageZombie(state: GameState, area: TacticalArea, ctx: SimContext, z: Zombie, part: 'head' | 'torso' | 'legs', mul: number, _dir?: Readonly<Vec3>, amount?: number, torsoMul = 1): boolean {
  if (z.state === 'down') return false;
  const def = ZOMBIES[z.kind];
  const base = amount ?? def[part];
  z.hp -= base >= KILL ? KILL : base * mul * (part === 'torso' ? torsoMul : 1);
  if (z.hp <= 0) {
    killZombie(state, area, ctx, z, part === 'head' && amount === undefined, amount !== undefined);
    return true;
  }
  z.flinch = z.kind === 'brute' ? Z.flinchSeconds * 0.4 : Z.flinchSeconds;
  if (part === 'legs' && def.topples && !z.crippled) {
    z.crippled = true;
    z.stair = -1;
  }
  // Hurt but standing: it does not know where the shot came from, it only starts looking around.
  if (z.state === 'wander') alert(z, z.pos[0], z.pos[2], Z.alertSeconds);
  return false;
}

/** Knife: kills outright from behind an unaware zombie, otherwise fixed damage. */
export function knifeZombie(state: GameState, area: TacticalArea, ctx: SimContext, z: Zombie, backstab: boolean): boolean {
  return damageZombie(state, area, ctx, z, 'torso', 1, undefined, backstab ? KILL : getMod(state, 'knife.damage', BALANCE.combat.knife.damage));
}

// ---------------------------------------------------------------------------------------------
// Perception
// ---------------------------------------------------------------------------------------------

/** Tree canopies above the straight line a -> b (they dim what is under them; trunks block for real). */
export function canopyCount(map: TacticalMap, ax: number, az: number, bx: number, bz: number): number {
  const hash = map.hash;
  const cs = hash.cell;
  const clamp = (v: number): number => Math.min(hash.n - 1, Math.max(0, Math.floor(v / cs)));
  const cx0 = clamp(Math.min(ax, bx) - 4);
  const cx1 = clamp(Math.max(ax, bx) + 4);
  const cz0 = clamp(Math.min(az, bz) - 4);
  const cz1 = clamp(Math.max(az, bz) + 4);
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  const trees = map.trees;
  let n = 0;
  for (let cz = cz0; cz <= cz1; cz++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      for (const ti of hash.trees[cz * hash.n + cx]!) {
        const px = trees.x[ti]! - ax;
        const pz = trees.z[ti]! - az;
        const u = Math.min(1, Math.max(0, (px * dx + pz * dz) / len2));
        const r = trees.r[ti]! * 0.9;
        if ((px - dx * u) ** 2 + (pz - dz * u) ** 2 < r * r) n++;
      }
    }
  }
  return n;
}

const eyeA: Vec3 = [0, 0, 0];
const eyeB: Vec3 = [0, 0, 0];

/** Can this zombie see the player right now? */
export function seesPlayer(state: GameState, map: TacticalMap, z: Zombie): boolean {
  const p = state.player;
  if (isDead(state)) return false;
  const dx = p.pos[0] - z.pos[0];
  const dz = p.pos[2] - z.pos[2];
  const dist = Math.hypot(dx, dz);
  if (dist > Z.senseDist) {
    const aware = z.state !== 'wander';
    let range = Z.viewDist * (isNight(state.time.minute) ? Z.nightView : 1) * (aware ? Z.alertView : 1) * Z.stanceView[p.stance];
    if (dist > range) return false;
    const cos = (-Math.sin(z.yaw) * dx - Math.cos(z.yaw) * dz) / dist;
    if (cos < Math.cos(aware ? Z.alertHalfFov : Z.halfFov)) return false;
    range *= Math.max(Z.canopyMin, 1 - Z.canopyCut * canopyCount(map, z.pos[0], z.pos[2], p.pos[0], p.pos[2]));
    if (dist > range) return false;
  }
  eyeA[0] = z.pos[0];
  eyeA[1] = z.pos[1] + (isProne(z) ? 0.3 : ZOMBIES[z.kind].height * 0.92);
  eyeA[2] = z.pos[2];
  eyeB[0] = p.pos[0];
  eyeB[1] = p.pos[1] + p.eye;
  eyeB[2] = p.pos[2];
  return !segmentHitsStatic(map, eyeA, eyeB);
}

function startChase(state: GameState, area: TacticalArea, ctx: SimContext, z: Zombie): void {
  const t = state.tactical!;
  const p = state.player;
  z.state = 'chase';
  z.target = 'player';
  z.lost = 0;
  z.goal[0] = p.pos[0];
  z.goal[1] = p.pos[2];
  z.detourT = 0;
  ctx.emit({ type: 'zombieAlerted', id: z.id, chase: true });
  // Its snarling draws the ones nearby to the spot.
  near.length = 0;
  area.dynamic.query(z.pos[0], z.pos[2], Z.callDist, near);
  for (const id of near) {
    const other = runtimeOf(t).byId.get(id);
    if (!other || other === z || Math.hypot(other.pos[0] - z.pos[0], other.pos[2] - z.pos[2]) > Z.callDist) continue;
    alert(other, p.pos[0], p.pos[2], Z.alertSeconds);
  }
}

// ---------------------------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------------------------

const xz: [number, number] = [0, 0];

function speedOf(z: Zombie, def: ZombieDef, night: boolean): number {
  const base = isProne(z) ? Math.min(def.speed, PRONE.speed) : def.speed;
  return base * z.pace * (night ? Z.nightSpeed : 1);
}

/** Walk towards (tx, tz) at `speed`; handles walls, steps, falling and getting stuck. Returns the distance left. */
function moveToward(state: GameState, area: TacticalArea, z: Zombie, tx: number, tz: number, speed: number, dt: number, separate: boolean): number {
  const map = area.map;
  const def = ZOMBIES[z.kind];
  const pos = z.pos;
  let dx = tx - pos[0];
  let dz = tz - pos[2];
  const dist = Math.hypot(dx, dz);
  if (dist > 1e-4) {
    dx /= dist;
    dz /= dist;
    // Face where it is going (turn rate limited).
    const want = Math.atan2(-dx, -dz);
    let diff = want - z.yaw;
    diff -= Math.round(diff / (Math.PI * 2)) * Math.PI * 2;
    const turn = Z.turnRate * dt * (z.kind === 'runner' ? 1.6 : 1);
    z.yaw += Math.abs(diff) <= turn ? diff : Math.sign(diff) * turn;
  }
  const here = overlay ? tileOf(pos[0], pos[2]) : 0;
  let step = Math.min(dist, speed * dt * (overlay && overlay.wire[here] ? BUILD.wireSlow : overlay && overlay.slow[here] ? RESEARCH.moatSlow : 1));
  if (z.flinch > 0) step = 0;
  if (step > 0) {
    if (z.detourT > 0) {
      // Side-step around whatever is in the way.
      z.detourT -= dt;
      const a = 1.25 * z.detourSide;
      const c = Math.cos(a);
      const s = Math.sin(a);
      [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
    }
    const fromX = pos[0];
    const fromZ = pos[2];
    xz[0] = pos[0] + dx * step;
    xz[1] = pos[2] + dz * step;
    const height = isProne(z) ? 0.5 : def.height;
    pushOut(map, xz, def.radius, pos[1], height, Z.stepUp);
    if (overlay) barrierPush(overlay, xz, def.radius);
    if (separate) {
      near.length = 0;
      area.dynamic.query(xz[0], xz[1], 1.2, near);
      const byId = runtimeOf(state.tactical!).byId;
      for (const id of near) {
        if (id === z.id) continue;
        const o = byId.get(id);
        if (!o || Math.abs(o.pos[1] - pos[1]) > 1.5) continue;
        const ox = xz[0] - o.pos[0];
        const oz = xz[1] - o.pos[2];
        const d = Math.hypot(ox, oz);
        const min = def.radius + ZOMBIES[o.kind].radius;
        if (d < min && d > 1e-4) {
          xz[0] += (ox / d) * (min - d) * 0.5;
          xz[1] += (oz / d) * (min - d) * 0.5;
        }
      }
      // Do not walk through the player either.
      const p = state.player;
      const px = xz[0] - p.pos[0];
      const pz = xz[1] - p.pos[2];
      const pd = Math.hypot(px, pz);
      const minP = def.radius + 0.35;
      if (pd < minP && pd > 1e-4 && Math.abs(p.pos[1] - pos[1]) < 1.5) {
        xz[0] += (px / pd) * (minP - pd);
        xz[1] += (pz / pd) * (minP - pd);
      }
    }
    pos[0] = Math.min(map.size - 1, Math.max(1, xz[0]));
    pos[2] = Math.min(map.size - 1, Math.max(1, xz[1]));
    const moved = Math.hypot(pos[0] - fromX, pos[2] - fromZ);
    z.walk += moved;
    // Stuck test: little progress for a while -> follow the obstacle sideways. The side is kept
    // (and the detour gets longer) until the way is clear; it flips only when that side is blocked too.
    const blocked = moved < step * 0.35 && dist > 1.5; // (standing at the goal is not being stuck)
    if (blocked) {
      z.stuck += dt;
      z.free = 0;
    } else {
      z.stuck = Math.max(0, z.stuck - dt * 0.5);
      z.free += dt;
      if (z.free > 3 && z.detourT <= 0) z.detours = 0;
    }
    if (z.stuck > 0.3) {
      if (z.detourT > 0) z.detourSide = -z.detourSide; // even the way round is shut
      else if (z.detours === 0) z.detourSide = rand(stream(state, 'tactical.zombie')) < 0.5 ? -1 : 1;
      z.detours += 1;
      z.detourT = Math.min(Z.detourSeconds[1], Z.detourSeconds[0] * z.detours) / Math.max(0.6, speed);
      z.stuck = 0;
    }
  }
  settle(map, z, dt);
  return dist - step;
}

/** The structure overlay of the home map for the step being simulated (null elsewhere). */
let overlay: Overlay | null = null;
/** Zombies working on each structure during this step (structure id -> count). */
const attackers = new Map<number, number>();

/** Keep a zombie out of the barriers that have no collision box: moats, gates, the space under towers. */
function barrierPush(ov: Overlay, pos: [number, number], radius: number): void {
  const tx0 = Math.floor((pos[0] - radius) / TILE), tx1 = Math.floor((pos[0] + radius) / TILE);
  const ty0 = Math.floor((pos[1] - radius) / TILE), ty1 = Math.floor((pos[1] + radius) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx >= TILES || ty >= TILES) continue;
      const code = ov.zblock[ty * TILES + tx]!;
      if (!code) continue;
      let x0 = tx * TILE, z0 = ty * TILE, x1 = x0 + TILE, z1 = z0 + TILE;
      if (code === 2) {
        z0 += TILE / 2 - GATE_THICK / 2;
        z1 = z0 + GATE_THICK;
      } else if (code === 3) {
        x0 += TILE / 2 - GATE_THICK / 2;
        x1 = x0 + GATE_THICK;
      }
      const qx = Math.min(x1, Math.max(x0, pos[0]));
      const qz = Math.min(z1, Math.max(z0, pos[1]));
      const dx = pos[0] - qx, dz = pos[1] - qz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        pos[0] = qx + (dx / d) * radius;
        pos[1] = qz + (dz / d) * radius;
      } else {
        const l = pos[0] - x0, r = x1 - pos[0], t = pos[1] - z0, b = z1 - pos[1];
        const m = Math.min(l, r, t, b);
        if (m === l) pos[0] = x0 - radius;
        else if (m === r) pos[0] = x1 + radius;
        else if (m === t) pos[1] = z0 - radius;
        else pos[1] = z1 + radius;
      }
    }
  }
}

/** Stable per-zombie number in [0, 1). */
function hash01(id: number, salt: number): number {
  const v = Math.sin(id * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** Is the straight line from the zombie to (bx, bz) cut by a barrier, a wall or unwalkable ground? (first 60 m) */
function lineBlocked(map: TacticalMap, ov: Overlay | null, ax: number, az: number, bx: number, bz: number): boolean {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.min(30, Math.ceil(d / 2));
  for (let i = 1; i < n; i++) {
    const t = tileOf(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n);
    if (!map.walk[t] || (ov && (ov.zblock[t] || ov.sidx[t]) && !ov.wire[t])) return true;
  }
  return false;
}

/**
 * Walk along a flow field: to the next tile, or — when a structure stands there — up to it and
 * through it (walls, gates and buildings are broken down, moats are filled with bodies).
 * Returns false when the field has nothing to say here (the caller walks straight instead).
 */
function followField(state: GameState, area: TacticalArea, ctx: SimContext, z: Zombie, field: FlowField, speed: number, dt: number, separate: boolean, goalTile: number): boolean {
  const tile = tileOf(z.pos[0], z.pos[2]);
  const next = field.next[tile]!;
  if (next < 0) return false;
  const def = ZOMBIES[z.kind];
  const nx = next % TILES;
  const ny = (next - nx) / TILES;
  const cx = (nx + 0.5) * TILE;
  const cz = (ny + 0.5) * TILE;
  const ov = overlay;
  const st = ov && next !== goalTile ? structureAtTile(state, ov, next) : undefined;
  if (ov && st && !ov.wire[next]) {
    const reach = bodyDistance(ov, st, next, z.pos[0], z.pos[2]);
    if (reach > def.radius + 0.5) {
      z.target = null;
      moveToward(state, area, z, cx, cz, speed, dt, separate);
      return true;
    }
    // At it.
    z.target = st.id;
    z.yaw = Math.atan2(-(cx - z.pos[0]), -(cz - z.pos[2]));
    z.walk += dt * 0.6; // (arms keep flailing)
    settle(area.map, z, dt);
    const sdef = defOf(st);
    if (sdef.kind === 'moat' || (sdef.kind === 'bridge' && sdef.hp <= 0)) {
      if (sdef.unfillable || moatFilled(st)) return true;
      z.moatT = (z.moatT ?? 0) + dt;
      if (z.moatT > BUILD.raid.moatFallSeconds * (0.5 + hash01(z.id, 3))) {
        // Pushed over the edge by the ones behind: one more body in the ditch.
        st.corpsesInMoat = (st.corpsesInMoat ?? 0) + 1;
        z.pos[0] = cx + (hash01(z.id, 5) - 0.5) * 2;
        z.pos[2] = cz + (hash01(z.id, 6) - 0.5) * 2;
        killZombie(state, area, ctx, z, false, false, st.id);
        z.corpseId = -1; // lies in the ditch: no body to pick clean
        if (moatFilled(st)) {
          state.build.gridRev++;
          ctx.emit({ type: 'moatBridged', id: st.id });
        }
      }
      return true;
    }
    // Only so many can get at one stretch of wall at a time.
    const busy = attackers.get(st.id) ?? 0;
    if (z.flinch <= 0 && busy < BUILD.raid.attackersPerTile) {
      attackers.set(st.id, busy + 1);
      damageStructure(state, ctx.emit, st, def.wallDps * dt * (sdef.kind === 'building' ? BUILD.raid.buildingDamage : 1));
    }
    return true;
  }
  z.target = z.state === 'chase' ? 'player' : null;
  z.moatT = 0;
  // Spread out a little across the tile so that a column is not a single file.
  const off = (hash01(z.id, 1) - 0.5) * 2.2;
  const horizontal = ny === Math.floor(z.pos[2] / TILE);
  moveToward(state, area, z, cx + (horizontal ? 0 : off), cz + (horizontal ? off : 0), speed, dt, separate);
  return true;
}

/** Vertical: follow the ground and steps, fall off ledges. */
function settle(map: TacticalMap, z: Zombie, dt: number): void {
  const pos = z.pos;
  const support = supportAt(map, pos[0], pos[2], pos[1], Z.stepUp);
  if (z.vy === 0 && support >= pos[1] - Z.stepUp) pos[1] = support;
  else {
    z.vy -= Z.gravity * dt;
    pos[1] += z.vy * dt;
    if (pos[1] <= support) {
      pos[1] = support;
      z.vy = 0;
    }
  }
}

/** Waypoints up the outside staircase of a building: the foot of the stairs, then every step and landing. */
function stairPath(t: TacticalState, map: TacticalMap, building: number): Vec3[] | null {
  const rt = runtimeOf(t);
  let path = rt.stairs.get(building);
  if (path !== undefined) return path;
  const pts: Vec3[] = [];
  for (const s of map.solids) if (s.kind === 'stair' && s.ref === building) pts.push([(s.x0 + s.x1) / 2, s.y1, (s.z0 + s.z1) / 2]);
  if (pts.length < 2) path = null;
  else {
    const dx = pts[1]![0] - pts[0]![0];
    const dz = pts[1]![2] - pts[0]![2];
    const d = Math.hypot(dx, dz) || 1;
    const ex = pts[0]![0] - (dx / d) * 1.4;
    const ez = pts[0]![2] - (dz / d) * 1.4;
    path = [[ex, heightAt(map, ex, ez), ez], ...pts];
  }
  rt.stairs.set(building, path);
  return path;
}

/** The building whose outside stairs lead to where the player stands (roof or the stairs themselves), or -1. */
export function perchOf(state: GameState, map: TacticalMap): number {
  const p = state.player;
  const [x, y, z] = p.pos;
  if (y - heightAt(map, x, z) < 1.2) return -1;
  const hash = map.hash;
  const cx = Math.min(hash.n - 1, Math.max(0, Math.floor(x / hash.cell)));
  const cz = Math.min(hash.n - 1, Math.max(0, Math.floor(z / hash.cell)));
  for (const si of hash.solids[cz * hash.n + cx]!) {
    const s = map.solids[si]!;
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1 || Math.abs(s.y1 - y) > 0.2) continue;
    return s.ref >= 0 && map.buildings[s.ref]?.access === 'stairs' ? s.ref : -1;
  }
  return -1;
}

// ---------------------------------------------------------------------------------------------
// Behaviour
// ---------------------------------------------------------------------------------------------

function pickWanderGoal(map: TacticalMap, z: Zombie, rng: RngState, radius: number): void {
  for (let i = 0; i < 6; i++) {
    const a = rand(rng) * Math.PI * 2;
    const r = radius * (0.3 + 0.7 * rand(rng));
    const x = z.pos[0] + Math.cos(a) * r;
    const zz = z.pos[2] + Math.sin(a) * r;
    if (isWalkable(map, Math.floor(x / map.tile), Math.floor(zz / map.tile))) {
      z.goal[0] = x;
      z.goal[1] = zz;
      return;
    }
  }
}

function toCorpse(state: GameState, z: Zombie): void {
  const t = state.tactical!;
  if (z.corpseId < 0) return; // fell into a moat
  const C = BALANCE.combat;
  const until = addMinutes({ day: state.time.day, minute: state.time.minute }, C.corpse.hours * 60);
  t.corpses.push({
    id: z.corpseId, pos: [z.pos[0], z.pos[1], z.pos[2]], ears: C.ears.perCorpse, expiresDay: until.day, expiresMinute: until.minute,
    kind: z.kind, yaw: z.yaw, headshot: z.headshot, crippled: isProne(z),
  });
  if (t.corpses.length > C.corpse.max) t.corpses.splice(0, t.corpses.length - C.corpse.max);
}

function updateOne(state: GameState, area: TacticalArea, ctx: SimContext, z: Zombie, dt: number, sense: boolean, night: boolean, perch: number, near1: boolean): void {
  const map = area.map;
  const def = ZOMBIES[z.kind];
  const p = state.player;
  const rng = stream(state, 'tactical.zombie');
  if (z.flinch > 0) z.flinch = Math.max(0, z.flinch - dt);
  if (z.cd > 0) z.cd = Math.max(0, z.cd - dt);

  if (z.dummy) {
    if (z.dummy === 2) {
      const spot = RANGE_SPOTS[z.spot ?? 0]!;
      if (moveToward(state, area, z, z.goal[0], z.goal[1], def.speed, dt, false) < 0.2) z.goal[0] = z.goal[0] === spot.x1 ? spot.x0 : spot.x1;
    } else settle(map, z, dt);
    return;
  }

  if (overlay && overlay.wire[tileOf(z.pos[0], z.pos[2])]) {
    // Barbed wire tears at whatever wades through it, and wears out doing so.
    const wire = structureAtTile(state, overlay, tileOf(z.pos[0], z.pos[2]));
    if (wire) damageStructure(state, ctx.emit, wire, BUILD.wireWear * dt);
    z.hp -= BUILD.wireDps * dt;
    if (z.hp <= 0) return killZombie(state, area, ctx, z, false, false, wire?.id ?? 0);
  }
  const sees = sense ? seesPlayer(state, map, z) : false;
  const pdx = p.pos[0] - z.pos[0];
  const pdz = p.pos[2] - z.pos[2];
  const pdist = Math.hypot(pdx, pdz);
  const pdy = Math.abs(p.pos[1] - z.pos[1]);

  switch (z.state) {
    case 'wander': {
      if (sees) return startChase(state, area, ctx, z);
      if (sense) {
        // Coming across a body puts it on guard.
        const corpses = state.tactical!.corpses;
        for (let i = corpses.length - 1; i >= 0 && corpses[i]!.id > z.corpseSeen; i--) {
          const c = corpses[i]!;
          if (Math.hypot(c.pos[0] - z.pos[0], c.pos[2] - z.pos[2]) > Z.corpseDist) continue;
          if (segmentHitsStatic(map, [z.pos[0], z.pos[1] + 1.5, z.pos[2]], [c.pos[0], c.pos[1] + 0.5, c.pos[2]])) continue;
          z.corpseSeen = c.id;
          return alert(z, c.pos[0], c.pos[2], Z.alertSeconds);
        }
      }
      if (z.raid) {
        // Raider: follow the field to the base; where it gives no direction, walk at the base centre.
        if (!followField(state, area, ctx, z, raidField(state, map), speedOf(z, def, night), dt, near1, -1)) {
          const [gx, gz] = map.spawn.home;
          if (Math.hypot(gx - z.pos[0], gz - z.pos[2]) > 6) moveToward(state, area, z, gx, gz, speedOf(z, def, night), dt, near1);
          else settle(map, z, dt);
        }
        return;
      }
      if (z.t > 0) {
        z.t -= dt;
        settle(map, z, dt);
        return;
      }
      const left = moveToward(state, area, z, z.goal[0], z.goal[1], Math.min(def.speed, 1.3) * Z.wanderSpeed * z.pace, dt, near1);
      if (left < 0.8 || z.detourT > 0) {
        if (left < 0.8) z.t = randRange(rng, Z.wanderPause[0], Z.wanderPause[1]);
        z.detourT = 0;
        pickWanderGoal(map, z, rng, Z.wanderRadius);
      }
      return;
    }
    case 'alert': {
      if (sees) return startChase(state, area, ctx, z);
      z.t -= dt;
      if (z.t <= 0) {
        z.state = 'wander';
        z.t = 0;
        pickWanderGoal(map, z, rng, Z.wanderRadius);
        return;
      }
      const left = moveToward(state, area, z, z.goal[0], z.goal[1], Math.min(speedOf(z, def, night), 1.6), dt, near1);
      // At the spot: turn on the spot, looking around.
      if (left < 2.5) z.yaw += 1.4 * dt * z.detourSide;
      return;
    }
    case 'chase': {
      if (isDead(state)) {
        z.state = 'wander';
        z.target = null;
        return;
      }
      if (sees) {
        z.lost = 0;
        z.goal[0] = p.pos[0];
        z.goal[1] = p.pos[2];
      } else {
        z.lost += dt;
        if (z.lost > Z.loseSeconds) {
          z.state = 'wander';
          z.target = null;
          return alert(z, z.goal[0], z.goal[1], Z.alertSeconds);
        }
      }
      if (pdist < Z.attackRange + def.radius && pdy < Z.attackHeight && z.cd <= 0 && z.flinch <= 0) {
        z.state = 'attack';
        z.t = Z.attackWindup;
        return;
      }
      let tx = z.goal[0];
      let tz = z.goal[1];
      // The player is up a building with outside stairs: go by the stairs.
      const path = perch >= 0 && !isProne(z) && (z.stair === perch || p.pos[1] - z.pos[1] > 1) ? stairPath(state.tactical!, map, perch) : null;
      if (path) {
        if (z.stair !== perch) {
          z.stair = perch;
          z.stairAt = 0;
          // Already somewhere on these stairs? Continue from the nearest step.
          let best = 1.6;
          for (let i = 0; i < path.length; i++) {
            const w = path[i]!;
            const d = Math.hypot(w[0] - z.pos[0], w[2] - z.pos[2]);
            if (Math.abs(w[1] - z.pos[1]) < 0.7 && d < best) {
              best = d;
              z.stairAt = i;
            }
          }
        }
        const w = path[Math.min(z.stairAt, path.length - 1)]!;
        if (Math.hypot(w[0] - z.pos[0], w[2] - z.pos[2]) < 0.35 && Math.abs(w[1] - z.pos[1]) < 0.8) z.stairAt += 1;
        if (z.stairAt >= path.length) z.stair = -1;
        else {
          const n = path[z.stairAt]!;
          tx = n[0];
          tz = n[2];
        }
      } else {
        z.stair = -1;
        // No straight way (walls, moats, a dead end between buildings): go by the field towards the player.
        if ((z.detours > 0 || overlay !== null) && pdist > 3 && lineBlocked(map, overlay, z.pos[0], z.pos[2], tx, tz)) {
          if (followField(state, area, ctx, z, chaseField(state, map), speedOf(z, def, night), dt, near1, tileOf(p.pos[0], p.pos[2]))) return;
        }
      }
      moveToward(state, area, z, tx, tz, speedOf(z, def, night), dt, near1);
      return;
    }
    case 'attack': {
      z.t -= dt;
      if (pdist > 1e-3) z.yaw = Math.atan2(-pdx, -pdz);
      settle(map, z, dt);
      if (z.t > 0) return;
      if (pdist < Z.attackReach + def.radius && pdy < Z.attackHeight) hurtPlayer(state, ctx, def.attack, 'bite');
      z.cd = Z.attackCooldown;
      z.state = 'chase';
      return;
    }
    default:
      return;
  }
}

// ---------------------------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------------------------

function pickKind(rng: RngState, mix: Record<ZombieKind, number>): ZombieKind {
  let r = rand(rng);
  for (const kind of ['walker', 'runner', 'crawler', 'brute'] as const) {
    r -= mix[kind];
    if (r < 0) return kind;
  }
  return 'walker';
}

function walkableAt(map: TacticalMap, x: number, z: number): boolean {
  return x > 4 && z > 4 && x < map.size - 4 && z < map.size - 4 && isWalkable(map, Math.floor(x / map.tile), Math.floor(z / map.tile));
}

/** A place for a new group: on a road half of the time (where there are any), away from the player and the base. */
function pickAnchor(state: GameState, map: TacticalMap, rng: RngState): [number, number] | null {
  const p = state.player;
  const mid = map.size / 2;
  for (let i = 0; i < 40; i++) {
    let x: number;
    let z: number;
    if (map.roads.length > 0 && rand(rng) < 0.5) {
      const road = map.roads[randInt(rng, 0, map.roads.length - 1)]!;
      const pt = road.pts[randInt(rng, 0, road.pts.length - 1)]!;
      x = pt[0] + randRange(rng, -6, 6);
      z = pt[1] + randRange(rng, -6, 6);
    } else {
      x = randRange(rng, 8, map.size - 8);
      z = randRange(rng, 8, map.size - 8);
    }
    if (!walkableAt(map, x, z)) continue;
    if (Math.hypot(x - p.pos[0], z - p.pos[2]) < Z.spawnMinDist) continue;
    if (map.params.isHome && Math.hypot(x - mid, z - mid) < Z.homeKeepOut) continue;
    return [x, z];
  }
  return null;
}

function pickEdge(state: GameState, map: TacticalMap, rng: RngState): [number, number] | null {
  const p = state.player;
  for (let i = 0; i < 30; i++) {
    const along = randRange(rng, 8, map.size - 8);
    const depth = randRange(rng, 6, 14);
    const side = randInt(rng, 0, 3);
    const x = side === 0 ? depth : side === 1 ? map.size - depth : along;
    const z = side === 2 ? depth : side === 3 ? map.size - depth : along;
    if (walkableAt(map, x, z) && Math.hypot(x - p.pos[0], z - p.pos[2]) >= Z.edgeMinDist) return [x, z];
  }
  return null;
}

/** Keep the area stocked: min(active cap, cell Z) zombies; the first lot all over the map, later ones from the edge. */
function spawn(state: GameState, area: TacticalArea, grid: StaticGrid, dt: number): void {
  const t = state.tactical!;
  const info = cellTactical(state, grid, t.cell);
  if (!info) return;
  const map = area.map;
  const rng = stream(state, 'tactical.spawn');
  const target = Math.min(info.active, info.z, Z.max);
  let alive = aliveCount(t);
  t.reserve = Math.max(0, info.z - alive);
  if (!t.populated) {
    t.populated = true;
    t.spawnT = info.respawnSeconds;
    if (state.difficulty === 2 || state.flags.wind === true) {
      const a = rand(rng) * Math.PI * 2;
      const s = rand(rng) * BALANCE.combat.windMax;
      t.wind = [Math.cos(a) * s, Math.sin(a) * s];
    }
    for (let guard = 0; alive < target && guard < 400; guard++) {
      const anchor = pickAnchor(state, map, rng);
      if (!anchor) break;
      const size = Math.min(target - alive, randInt(rng, Z.cluster[0], Z.cluster[1]));
      for (let k = 0; k < size; k++) {
        const x = anchor[0] + (k === 0 ? 0 : randRange(rng, -Z.clusterSpread, Z.clusterSpread));
        const z = anchor[1] + (k === 0 ? 0 : randRange(rng, -Z.clusterSpread, Z.clusterSpread));
        if (!walkableAt(map, x, z)) continue;
        const zb = addZombie(state, area, pickKind(rng, info.kinds), x, z, rand(rng) * Math.PI * 2);
        if (!zb) break;
        zb.t = rand(rng) * Z.wanderPause[1];
        alive++;
      }
    }
    return;
  }
  if (alive >= target) {
    t.spawnT = info.respawnSeconds;
    return;
  }
  t.spawnT = (t.spawnT ?? info.respawnSeconds) - dt;
  if (t.spawnT > 0) return;
  t.spawnT = info.respawnSeconds;
  const edge = pickEdge(state, map, rng);
  if (!edge) return;
  const zb = addZombie(state, area, pickKind(rng, info.kinds), edge[0], edge[1], 0);
  if (!zb) return;
  // Newcomers drift a good way into the map.
  const mid = map.size / 2;
  const f = randRange(rng, 0.25, 0.7);
  zb.goal = [edge[0] + (mid - edge[0]) * f + randRange(rng, -60, 60), edge[1] + (mid - edge[1]) * f + randRange(rng, -60, 60)];
  zb.yaw = Math.atan2(-(zb.goal[0] - edge[0]), -(zb.goal[1] - edge[1]));
}

/** Firing range: every lane gets its target back a few seconds after it went down. */
function spawnRange(state: GameState, area: TacticalArea, dt: number): void {
  const t = state.tactical!;
  const timers = (t.rangeT ??= RANGE_SPOTS.map(() => BALANCE.range.respawnSeconds));
  const present = new Set<number>();
  for (const z of t.zombies) if (z.spot !== undefined) present.add(z.spot);
  RANGE_SPOTS.forEach((spot, i) => {
    if (present.has(i)) {
      timers[i] = 0;
      return;
    }
    timers[i] = (timers[i] ?? 0) + dt;
    if (timers[i]! < BALANCE.range.respawnSeconds) return;
    const zb = addZombie(state, area, spot.kind, spot.x, spot.z, Math.PI); // facing the firing line (south)
    if (!zb) return;
    zb.dummy = spot.dummy;
    zb.spot = i;
    zb.pace = 1;
    if (spot.dummy === 2) zb.goal = [spot.x1, spot.z];
  });
}

// ---------------------------------------------------------------------------------------------
// Per-step entry point
// ---------------------------------------------------------------------------------------------

export function updateZombies(state: GameState, area: TacticalArea, ctx: SimContext): void {
  const t = state.tactical;
  if (!t) return;
  const dt = ctx.dt;
  const step = (t.step = (t.step ?? 0) + 1);
  if (state.flags.range) spawnRange(state, area, dt);
  else if (ctx.grid) spawn(state, area, ctx.grid, dt);

  const p = state.player;
  const night = isNight(state.time.minute);
  const perch = perchOf(state, area.map);
  overlay = area.map.params.isHome && !state.flags.range ? overlayOf(state, area.map.walk) : null;
  attackers.clear();
  const zombies = t.zombies;
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i]!;
    if (z.state === 'down') {
      z.t += dt;
      if (z.vy !== 0 || z.pos[1] > supportAt(area.map, z.pos[0], z.pos[2], z.pos[1], Z.stepUp) + 0.01) settle(area.map, z, dt);
      if (z.t >= Z.downSeconds) {
        toCorpse(state, z);
        removeAt(t, area, i);
      }
      continue;
    }
    const dist = Math.hypot(z.pos[0] - p.pos[0], z.pos[2] - p.pos[2]);
    // LOD: far zombies think and move less often, with a proportionally longer step.
    const lod = z.dummy || z.state === 'chase' || z.state === 'attack' || dist < Z.lodMid ? 1 : dist < Z.lodFar ? 2 : 4;
    if ((step + z.id) % lod !== 0) continue;
    const sense = (step + z.id * 7) % Z.senseEvery < lod && dist < Z.viewDist * Z.nightView * Z.alertView + 5;
    updateOne(state, area, ctx, z, dt * lod, sense, night, perch, lod === 1);
    area.dynamic.set(z.id, z.pos[0], z.pos[2]);
  }
}

/** Corpses rot away after BALANCE.combat.corpse.hours (their ears with them). Called once a game minute. */
export function expireCorpses(state: GameState): void {
  const t = state.tactical;
  if (!t || t.corpses.length === 0) return;
  const now = state.time.day * BALANCE.time.minutesPerDay + state.time.minute;
  t.corpses = t.corpses.filter((c) => c.expiresDay * BALANCE.time.minutesPerDay + c.expiresMinute > now);
}
