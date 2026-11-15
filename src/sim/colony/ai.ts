// Where the survivors are and walk inside the base: a small state machine per person
// (schedule -> activity -> place -> walk there). This is presentation only — work results are
// computed per game minute in jobs.ts whether or not anyone moves — so it runs only while the
// player is in the home cell and its map exists. Away from home the positions simply freeze.

import type { GameState, Survivor, TacticalState } from '../../core/types.ts';
import { COLONY } from '../../data/colony.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { areaOf } from '../tactical/area.ts';
import { isWalkable } from '../tactical/collision.ts';
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

/** The spot (absolute map coordinates) where a survivor belongs for an activity at this minute. */
export function placeFor(state: GameState, map: TacticalMap, s: Survivor, index: number, activity: Activity, minute: number): [number, number] {
  const [hx, hz] = map.spawn.home;
  const at = (o: readonly [number, number] | readonly number[], spread = 0, salt = 0): [number, number] => [
    hx + o[0]! + (hash(s.id, salt + 1) - 0.5) * 2 * spread,
    hz + o[1]! + (hash(s.id, salt + 2) - 0.5) * 2 * spread,
  ];
  const slot = Math.floor(minute / C.shuffleMinutes);
  switch (activity) {
    case 'sleep':
      return [hx + C.beds.origin[0] + (index % C.beds.cols) * C.beds.dx, hz + C.beds.origin[1] + Math.floor(index / C.beds.cols) * C.beds.dz];
    case 'rest':
      return at(C.clinic, 3);
    case 'eat':
      return ring(hx + C.fire[0], hz + C.fire[1], 2.2 + hash(s.id, 3) * 2.5, hash(s.id, 4) * Math.PI * 2);
    case 'free':
      return ring(hx + C.fire[0], hz + C.fire[1], 4 + hash(s.id, slot) * 7, hash(s.id, slot + 9) * Math.PI * 2);
    case 'work':
      switch (s.job) {
        case 'farming':
          return [hx + C.field.centre[0] + (hash(s.id, slot) - 0.5) * 2 * (C.field.half - 1), hz + C.field.centre[1] + (hash(s.id, slot + 5) - 0.5) * 2 * (C.field.half - 1)];
        case 'defense':
          return ring(hx, hz, C.guardRadius, ((s.id % C.posts) / C.posts) * Math.PI * 2 + (slot % 2) * 0.12);
        case 'scavenging':
          return ring(hx, hz, C.forage[0] + hash(s.id, slot) * (C.forage[1] - C.forage[0]), hash(s.id, slot + 7) * Math.PI * 2);
        case 'construction': {
          const site = state.build.structures.filter((b) => b.progress < 1).sort((a, b) => b.priority - a.priority || a.id - b.id)[0];
          if (site) return [site.tx * map.tile + map.tile / 2 + (hash(s.id, 6) - 0.5) * 3, site.ty * map.tile + map.tile + 1.5];
          return at(C.yard, 3, slot);
        }
        case 'research': return at(C.desk, 2);
        case 'crafting': return at(C.bench, 2);
        case 'medical': return at(C.clinic, 2.5, 20);
        default: return at(C.fire, 5);
      }
  }
}

// --- routing: a straight line when it is clear, otherwise a breadth-first path over the 4 m tiles ---

function lineClear(map: TacticalMap, ax: number, az: number, bx: number, bz: number): boolean {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(d / (map.tile / 2)));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!isWalkable(map, Math.floor((ax + (bx - ax) * t) / map.tile), Math.floor((az + (bz - az) * t) / map.tile))) return false;
  }
  return true;
}

const MARGIN = 14;
/** Waypoints from a to b around blocked tiles (searching only a window around both), or null. */
export function findPath(map: TacticalMap, ax: number, az: number, bx: number, bz: number): [number, number][] | null {
  const T = map.tile;
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
  for (let i = 0; i < list.length; i++) {
    const s = list[i]!;
    if (!isHome(s)) continue;
    // Alarm (06 raises it during a horde): guards to their posts, everyone else into the headquarters.
    const alarm = state.flags.colonyAlarm === true && s.status === 'ok';
    const activity = alarm ? (s.job === 'defense' ? 'work' : 'free') : activityAt(s, minute);
    const goal: [number, number] = alarm && s.job !== 'defense'
      ? [map.spawn.home[0] + C.hq[0] + (hash(s.id, 31) - 0.5) * 6, map.spawn.home[1] + C.hq[1] + (hash(s.id, 32) - 0.5) * 3]
      : placeFor(state, map, s, i, activity, minute);
    if (fresh) {
      // The player has just arrived (or loaded): everyone is already where they should be.
      s.pos = [goal[0], goal[1]];
      s.task = { kind: activity, target: null, t: 0 };
      continue;
    }
    if (!s.task) {
      s.pos = arrivalPos(state); // hired or back from an expedition: walks in from the edge of the camp
      s.task = { kind: 'walk', target: null, t: 0 };
    }
    const dx = goal[0] - s.pos[0], dz = goal[1] - s.pos[1];
    if (dx * dx + dz * dz < 0.36) {
      if (s.task.kind !== activity) s.task = { kind: activity, target: null, t: 0 };
      else s.task.t += dt;
      walks.delete(s.id);
      continue;
    }
    let walk = walks.get(s.id);
    if (!walk || walk.goal[0] !== goal[0] || walk.goal[1] !== goal[1]) {
      const path = lineClear(map, s.pos[0], s.pos[1], goal[0], goal[1]) ? [goal] : (findPath(map, s.pos[0], s.pos[1], goal[0], goal[1]) ?? [goal]);
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
