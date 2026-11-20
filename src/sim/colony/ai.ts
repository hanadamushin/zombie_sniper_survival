// Where the survivors are and walk inside the base: a small state machine per person
// (schedule -> activity -> place -> walk there). This is presentation only — work results are
// computed per game minute in jobs.ts whether or not anyone moves — so it runs only while the
// player is in the home cell and its map exists. Away from home the positions simply freeze.

import type { GameState, Structure, Survivor, TacticalState } from '../../core/types.ts';
import { footprint } from '../../data/buildings.ts';
import { guardPosts, type GuardPost } from '../build/defense.ts';
import { centreOf, defOf, hqOf, isBuilt, overlayOf, type Overlay } from '../build/structures.ts';
import { COLONY } from '../../data/colony.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { detailOf, type RoomUse } from '../../gen/buildings/index.ts';
import { areaOf } from '../tactical/area.ts';
import { heightAt, isWalkable, supportAt } from '../tactical/collision.ts';
import { indoorPath, whereIs } from '../tactical/indoor.ts';
import { activityAt, type Activity } from './jobs.ts';
import { arrivalPos, isHome } from './survivors.ts';

const C = COLONY.camp;

/** Stable pseudo-random number in [0, 1) from two integers (no state, no stream: looks only). */
function hash(a: number, b: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function ring(cx: number, cz: number, r: number, angle: number): [number, number] {
  return [cx + Math.cos(angle) * r, cz + Math.sin(angle) * r];
}

/** The buildings people go to, looked up once per revision of the structures (06). */
interface Sites {
  build: GameState['build'];
  rev: number;
  /** Centre of the headquarters (the map centre while there is none). */
  hq: [number, number];
  /** Dwellings with their beds, in the order they fill up (07d: and the structure, whose rooms they sleep in). */
  housing: { pos: [number, number]; beds: number; st: Structure }[];
  fields: Structure[];
  byJob: Partial<Record<'research' | 'crafting' | 'medical', [number, number]>>;
  /** 07d: the structure behind each of byJob / canteen / the headquarters. */
  jobSt: Partial<Record<'research' | 'crafting' | 'medical', Structure>>;
  canteen: [number, number] | null;
  canteenSt: Structure | null;
  hqSt: Structure | null;
  posts: GuardPost[];
}
let sites: Sites | null = null;

function sitesOf(state: GameState, map: TacticalMap): Sites {
  const build = state.build;
  if (sites && sites.build === build && sites.rev === build.gridRev) return sites;
  const hq = hqOf(state);
  const next: Sites = { build, rev: build.gridRev, hq: hq ? centreOf(hq) : [map.spawn.home[0], map.spawn.home[1]], housing: [], fields: [], byJob: {}, jobSt: {}, canteen: null, canteenSt: null, hqSt: hq ?? null, posts: guardPosts(state) };
  let best: Partial<Record<string, number>> = {};
  for (const st of build.structures) {
    if (!isBuilt(st)) continue;
    const def = defOf(st);
    if (def.beds) next.housing.push({ pos: centreOf(st), beds: def.beds, st });
    if (def.plots) next.fields.push(st);
    if (def.foodSaving) {
      next.canteen = centreOf(st);
      next.canteenSt = st;
    }
    for (const job of ['research', 'crafting', 'medical'] as const) {
      const f = def.job?.[job];
      if (f !== undefined && f > (best[job] ?? -1)) {
        best = { ...best, [job]: f };
        next.byJob[job] = centreOf(st);
        next.jobSt[job] = st;
      }
    }
  }
  sites = next;
  return next;
}

/**
 * 07d: a spot inside one of a base building's rooms (preferring the given uses), or null when the
 * structure has no blueprint (or its map is not synced). `n` spreads people over the rooms.
 */
export function indoorSpot(map: TacticalMap, st: Structure, uses: readonly RoomUse[], id: number, n = id): [number, number] | null {
  const p = map.placements.find((q) => q.structure === st.id);
  if (!p) return null;
  const det = detailOf(p);
  const rooms = det.rooms.filter((r) => uses.includes(r.use));
  const pool = rooms.length > 0 ? rooms : det.rooms.filter((r) => !r.locked);
  const r = pool[Math.abs(n) % pool.length];
  if (!r) return null;
  const m = 0.6;
  const fx = hash(id, 41);
  const fz = hash(id, 42);
  return [r.wx0 + m + (r.wx1 - r.wx0 - 2 * m) * fx, r.wz0 + m + (r.wz1 - r.wz0 - 2 * m) * fz];
}

/** Set by placeFor: the structure the place belongs to (a tower for a guard), or null. */
let placeTarget: number | null = null;

/**
 * The spot (absolute map coordinates) where a survivor belongs for an activity at this minute.
 * `index` is their place on the roll (bed order), `guard` their number among the defenders.
 */
export function placeFor(state: GameState, map: TacticalMap, s: Survivor, index: number, activity: Activity, minute: number, guard = 0): [number, number] {
  const S = sitesOf(state, map);
  const [hx, hz] = S.hq;
  placeTarget = null;
  const at = (o: readonly [number, number] | readonly number[], spread = 0, salt = 0): [number, number] => [
    hx + o[0]! + (hash(s.id, salt + 1) - 0.5) * 2 * spread,
    hz + o[1]! + (hash(s.id, salt + 2) - 0.5) * 2 * spread,
  ];
  const slot = Math.floor(minute / C.shuffleMinutes);
  const fire = (lo: number, hi: number, salt: number): [number, number] => ring(hx + C.fire[0], hz + C.fire[1], lo + hash(s.id, salt) * (hi - lo), hash(s.id, salt + 9) * Math.PI * 2);
  switch (activity) {
    case 'sleep': {
      // Indoors while there are beds; the rest lie down around the fire.
      let left = index;
      for (const h of S.housing) {
        if (left < h.beds) return indoorSpot(map, h.st, ['bedroom', 'barracks'], s.id, left) ?? [h.pos[0] + (hash(s.id, 11) - 0.5) * 1.5, h.pos[1] + (hash(s.id, 12) - 0.5) * 1.5];
        left -= h.beds;
      }
      return fire(2.5, 6, 3);
    }
    case 'rest':
      return (S.jobSt.medical && indoorSpot(map, S.jobSt.medical, ['bedroom', 'clinic'], s.id)) || S.byJob.medical || [hx + (hash(s.id, 13) - 0.5) * 4, hz + (hash(s.id, 14) - 0.5) * 4];
    case 'eat':
      return (S.canteenSt && indoorSpot(map, S.canteenSt, ['canteen'], s.id)) || S.canteen || fire(2.2, 4.7, 3);
    case 'free':
      return fire(4, 11, slot);
    case 'work':
      switch (s.job) {
        case 'farming': {
          const f = S.fields[s.id % Math.max(1, S.fields.length)];
          if (!f) return at(C.yard, 4, slot);
          const def = defOf(f);
          const [w, d] = footprint(def, f.rot);
          const [cx, cz] = centreOf(f);
          if (def.kind !== 'field') return [cx, cz];
          return [cx + (hash(s.id, slot) - 0.5) * (w * map.tile - 2), cz + (hash(s.id, slot + 5) - 0.5) * (d * map.tile - 2)];
        }
        case 'defense': {
          const post = S.posts[guard % S.posts.length]!;
          placeTarget = post.tower;
          return post.pos;
        }
        case 'scavenging':
          return ring(hx, hz, C.forage[0] + hash(s.id, slot) * (C.forage[1] - C.forage[0]), hash(s.id, slot + 7) * Math.PI * 2);
        case 'construction': {
          const site = state.build.structures.filter((b) => b.progress < 1).sort((a, b) => b.priority - a.priority || a.id - b.id)[0];
          if (site) return [site.tx * map.tile + map.tile / 2 + (hash(s.id, 6) - 0.5) * 3, site.ty * map.tile + map.tile + 1.5];
          return at(C.yard, 3, slot);
        }
        // 07d: inside the building, in the room that is for the job.
        case 'research': return (S.jobSt.research && indoorSpot(map, S.jobSt.research, ['lab'], s.id)) || S.byJob.research || at(C.desk, 2);
        case 'crafting': return (S.jobSt.crafting && indoorSpot(map, S.jobSt.crafting, ['workshop'], s.id)) || S.byJob.crafting || at(C.bench, 2);
        case 'medical': return (S.jobSt.medical && indoorSpot(map, S.jobSt.medical, ['clinic'], s.id)) || S.byJob.medical || at(C.clinic, 2.5, 20);
        default: return at(C.fire, 5);
      }
  }
}

// --- routing: a straight line when it is clear, otherwise a breadth-first path over the 4 m tiles ---

/** Can a person stand on the tile? Not on unwalkable ground, not inside walls, moats or buildings (gates are fine). */
function open(map: TacticalMap, ov: Overlay | null, tx: number, ty: number): boolean {
  return isWalkable(map, tx, ty) && !(ov && ov.sblock[ty * map.tiles + tx]);
}

function lineClear(map: TacticalMap, ov: Overlay | null, ax: number, az: number, bx: number, bz: number): boolean {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(d / (map.tile / 2)));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!open(map, ov, Math.floor((ax + (bx - ax) * t) / map.tile), Math.floor((az + (bz - az) * t) / map.tile))) return false;
  }
  return true;
}

const MARGIN = 14;
/**
 * Waypoints from a to b around blocked tiles (searching only a window around both), or null.
 * `ov` (06) adds the structures: walls, moats and buildings block, gates do not; the building the
 * goal lies in can be entered.
 */
export function findPath(map: TacticalMap, ax: number, az: number, bx: number, bz: number, ov: Overlay | null = null): [number, number][] | null {
  const T = map.tile;
  const isWalkable = (_m: TacticalMap, tx: number, ty: number): boolean => open(map, ov, tx, ty) || (inside > 0 && ov!.occ[ty * map.tiles + tx] === inside);
  const inside = ov ? ov.occ[Math.floor(bz / T) * map.tiles + Math.floor(bx / T)]! : 0;
  const sx = Math.floor(ax / T), sz = Math.floor(az / T), gx = Math.floor(bx / T), gz = Math.floor(bz / T);
  const x0 = Math.max(0, Math.min(sx, gx) - MARGIN), x1 = Math.min(map.tiles - 1, Math.max(sx, gx) + MARGIN);
  const z0 = Math.max(0, Math.min(sz, gz) - MARGIN), z1 = Math.min(map.tiles - 1, Math.max(sz, gz) + MARGIN);
  const w = x1 - x0 + 1, h = z1 - z0 + 1;
  const prev = new Int32Array(w * h).fill(-2);
  const queue = new Int32Array(w * h);
  const start = (sz - z0) * w + (sx - x0), goal = (gz - z0) * w + (gx - x0);
  let head = 0, tail = 0;
  queue[tail++] = start;
  prev[start] = -1;
  while (head < tail) {
    const cur = queue[head++]!;
    if (cur === goal) break;
    const cx = cur % w, cz = (cur - cx) / w;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        const next = nz * w + nx;
        if (prev[next] !== -2) continue;
        if (next !== goal && !isWalkable(map, nx + x0, nz + z0)) continue;
        // No cutting corners between two blocked tiles.
        if (dx && dz && (!isWalkable(map, cx + dx + x0, cz + z0) || !isWalkable(map, cx + x0, cz + dz + z0))) continue;
        prev[next] = cur;
        queue[tail++] = next;
      }
    }
  }
  if (prev[goal] === -2) return null;
  const path: [number, number][] = [[bx, bz]];
  for (let c = prev[goal]!; c !== -1 && c !== start; c = prev[c]!) path.push([((c % w) + x0 + 0.5) * T, (Math.floor(c / w) + z0 + 0.5) * T]);
  return path.reverse();
}

/** Feet height of someone standing at (x, z) in the base: the floor of a building, or the ground. */
function feetAt(map: TacticalMap, x: number, z: number): number {
  return supportAt(map, x, z, heightAt(map, x, z) + 0.6);
}

/** Over open ground: a straight line or the 4 m grid path. */
function outdoors(map: TacticalMap, ov: Overlay | null, a: readonly [number, number], b: [number, number]): [number, number][] {
  return lineClear(map, ov, a[0], a[1], b[0], b[1]) ? [b] : (findPath(map, a[0], a[1], b[0], b[1], ov) ?? [b]);
}

/**
 * 07d: the way from a to b in the base: out of the building one is in through its door, across the
 * base, in through the door of the building the other is in, through the rooms.
 */
export function routeTo(map: TacticalMap, ov: Overlay | null, a: readonly [number, number], b: [number, number]): [number, number][] {
  if (map.placements.length === 0) return outdoors(map, ov, a, b);
  const from: [number, number, number] = [a[0], feetAt(map, a[0], a[1]), a[1]];
  const to: [number, number, number] = [b[0], feetAt(map, b[0], b[1]), b[1]];
  const way = whereIs(map, from[0], from[1], from[2]) || whereIs(map, to[0], to[1], to[2]) ? indoorPath(map, from, to, COLONY.walkRadius) : null;
  if (!way) return outdoors(map, ov, a, b);
  // Legs between two points outside go round the walls on the grid.
  const out: [number, number][] = [];
  let prev: readonly [number, number] = a;
  let prevOutside = !whereIs(map, from[0], from[1], from[2]);
  for (const p of way) {
    const outside = !whereIs(map, p[0], p[1], p[2]);
    const q: [number, number] = [p[0], p[2]];
    if (prevOutside && outside) out.push(...outdoors(map, ov, prev, q));
    else out.push(q);
    prev = q;
    prevOutside = outside;
  }
  return out;
}

interface Walk {
  goal: [number, number];
  path: [number, number][];
}
/** Per-area scratch data (not saved): current paths and whether everyone has been put in place. */
const scratch = new WeakMap<TacticalState, Map<number, Walk>>();

/** 06: call during a horde. Guards go to their posts, the others shelter in the headquarters (movement only). */
export function setAlarm(state: GameState, on: boolean): void {
  if (on) state.flags.colonyAlarm = true;
  else delete state.flags.colonyAlarm;
}

/** Move the survivors at home towards where their schedule wants them. Call every fixed step. */
export function updateSurvivorMotion(state: GameState, dt: number): void {
  const area = areaOf(state);
  const t = state.tactical;
  if (!area || !t || !area.map.params.isHome || state.flags.range) return;
  const map = area.map;
  let walks = scratch.get(t);
  const fresh = !walks;
  if (!walks) scratch.set(t, (walks = new Map()));
  const minute = state.time.minute;
  const list = state.colony.survivors;
  const ov = overlayOf(state, map.walk);
  let guards = 0;
  for (let i = 0; i < list.length; i++) {
    const s = list[i]!;
    if (!isHome(s)) continue;
    // Alarm (06 raises it during a horde): guards to their posts, everyone else into the headquarters.
    const alarm = state.flags.colonyAlarm === true && s.status === 'ok';
    const activity = alarm ? (s.job === 'defense' ? 'work' : 'free') : activityAt(s, minute);
    const guard = s.job === 'defense' ? guards++ : 0;
    const hq = sitesOf(state, map).hq;
    const sites = sitesOf(state, map);
    const goal: [number, number] = alarm && s.job !== 'defense'
      ? (sites.hqSt && indoorSpot(map, sites.hqSt, ['command', 'bedroom', 'storage'], s.id)) || [hq[0] + (hash(s.id, 31) - 0.5) * 6, hq[1] + (hash(s.id, 32) - 0.5) * 6]
      : placeFor(state, map, s, i, activity, minute, guard);
    const target = alarm && s.job !== 'defense' ? null : placeTarget;
    if (fresh) {
      // The player has just arrived (or loaded): everyone is already where they should be.
      s.pos = [goal[0], goal[1]];
      s.task = { kind: activity, target, t: 0 };
      continue;
    }
    if (!s.task) {
      s.pos = arrivalPos(state); // hired or back from an expedition: walks in from the edge of the camp
      s.task = { kind: 'walk', target: null, t: 0 };
    }
    const dx = goal[0] - s.pos[0], dz = goal[1] - s.pos[1];
    if (dx * dx + dz * dz < 0.36) {
      if (s.task.kind !== activity || s.task.target !== target) s.task = { kind: activity, target, t: 0 };
      else s.task.t += dt;
      walks.delete(s.id);
      continue;
    }
    let walk = walks.get(s.id);
    if (!walk || walk.goal[0] !== goal[0] || walk.goal[1] !== goal[1]) {
      const path = routeTo(map, ov, s.pos, goal);
      walk = { goal, path };
      walks.set(s.id, walk);
    }
    if (s.task.kind !== 'walk') s.task = { kind: 'walk', target: null, t: 0 };
    s.task.t += dt;
    let left = C.walkSpeed * dt;
    while (left > 0 && walk.path.length > 0) {
      const [wx, wz] = walk.path[0]!;
      const d = Math.hypot(wx - s.pos[0], wz - s.pos[1]);
      if (d <= left) {
        s.pos = [wx, wz];
        left -= d;
        walk.path.shift();
      } else {
        s.pos = [s.pos[0] + ((wx - s.pos[0]) / d) * left, s.pos[1] + ((wz - s.pos[1]) / d) * left];
        left = 0;
      }
    }
  }
}
