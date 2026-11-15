// Flow fields over the 4 m grid (256 x 256): for every tile, which neighbour leads to the goal
// along the cheapest way. One Dijkstra from the goals outwards.
//
//   raid field   goal = the headquarters (and, a little "further away", other buildings people
//                shelter in). Costs come from the structure overlay: walls and gates can be
//                walked "through" at 1 + hp / 20 (= broken down), moats only by filling them.
//                Recomputed only when build.gridRev changes.
//   chase field  goal = the player's tile, for zombies that cannot walk straight at the player
//                (any cell). Rebuilt when the player has moved 8 m, at most once a second.
//
// Costs are integers (x10 per tile, x14 diagonally) so that the queue can be an array of buckets
// (Dial's algorithm): about 2 ms for the whole map.

import type { GameState, TacticalState } from '../../core/types.ts';
import { BUILD } from '../../data/buildings.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { forTiles, hqOf, isBuilt, defOf, overlayOf, TILE, TILES, type Overlay } from './structures.ts';

const N = TILES * TILES;
const RING = 8192; // > the largest single step (moat 241 x 14)
const MASK = RING - 1;
const UNREACHED = 0x7fffffff;

export interface FlowField {
  /** Cost to the goal in tenths of a plain tile step; UNREACHED where there is no way. */
  dist: Int32Array;
  /** Tile to walk to next, -1 at a goal or where there is no way. */
  next: Int32Array;
}

export const FIELD_UNREACHED = UNREACHED;

// Scratch memory shared by all computations (the sim is single-threaded).
const heads = new Int32Array(RING);
const entryTile = new Int32Array(N * 9);
const entryNext = new Int32Array(N * 9);
const stepCost = new Int32Array(N);
const goalMark = new Uint8Array(N);

/**
 * Dijkstra from `goals` outwards. `cost[t]` is the price of entering tile t in plain steps
 * (Infinity = impassable); entering a goal tile is always a plain step. Diagonal moves are only
 * allowed between two plain (cost 1) tiles, so nothing squeezes between wall corners.
 */
export function computeField(cost: Float32Array, goals: readonly { tile: number; bias: number }[], out?: FlowField): FlowField {
  const field = out ?? { dist: new Int32Array(N), next: new Int32Array(N) };
  const { dist, next } = field;
  dist.fill(UNREACHED);
  next.fill(-1);
  heads.fill(-1);
  goalMark.fill(0);
  for (let i = 0; i < N; i++) {
    const c = cost[i]!;
    stepCost[i] = c === Infinity ? -1 : Math.max(1, Math.round(c * 10));
  }
  // Dial's algorithm: buckets[d & MASK] is a linked list of tiles whose tentative distance is d.
  const H = heads, ET = entryTile, EN = entryNext, SC = stepCost, GM = goalMark;
  let entries = 0;
  let pending = 0;
  let lo = -1;
  for (const g of goals) {
    if (g.tile < 0 || g.tile >= N) continue;
    const d = Math.max(0, Math.round(g.bias * 10)) | 0;
    if (d < dist[g.tile]!) {
      dist[g.tile] = d;
      GM[g.tile] = 1;
      const b = d & MASK;
      ET[entries] = g.tile;
      EN[entries] = H[b]!;
      H[b] = entries++;
      pending++;
      if (lo < 0 || d < lo) lo = d;
    }
  }
  const W = TILES;
  for (let d = lo | 0; pending > 0; d = (d + 1) | 0) {
    const b = d & MASK;
    let e = H[b]!;
    if (e < 0) continue;
    H[b] = -1;
    while (e >= 0) {
      const cur = ET[e]!;
      e = EN[e]!;
      pending--;
      if (dist[cur] !== d) continue; // stale entry
      const enter = GM[cur] ? 10 : SC[cur]!;
      const cx = cur % W;
      const cy = (cur - cx) / W;
      const nd = (d + enter) | 0;
      // Orthogonal neighbours.
      for (let k = 0; k < 4; k++) {
        const n = k === 0 ? (cx > 0 ? cur - 1 : -1) : k === 1 ? (cx < W - 1 ? cur + 1 : -1) : k === 2 ? (cy > 0 ? cur - W : -1) : cy < W - 1 ? cur + W : -1;
        if (n < 0 || nd >= dist[n]!) continue;
        if (SC[n]! < 0 && !GM[n]) continue; // nobody can stand there, so nobody starts from there
        dist[n] = nd;
        next[n] = cur;
        const nb = nd & MASK;
        ET[entries] = n;
        EN[entries] = H[nb]!;
        H[nb] = entries++;
        pending++;
      }
      // Diagonal: only across open ground on all four tiles involved.
      if (enter !== 10) continue;
      const dd = (d + 14) | 0;
      for (let k = 0; k < 4; k++) {
        const sx = k & 1 ? 1 : -1;
        const sy = k & 2 ? W : -W;
        if ((sx < 0 ? cx === 0 : cx === W - 1) || (sy < 0 ? cy === 0 : cy === W - 1)) continue;
        const n = cur + sx + sy;
        if (dd >= dist[n]! || SC[n] !== 10 || SC[cur + sx] !== 10 || SC[cur + sy] !== 10) continue;
        dist[n] = dd;
        next[n] = cur;
        const nb = dd & MASK;
        ET[entries] = n;
        EN[entries] = H[nb]!;
        H[nb] = entries++;
        pending++;
      }
    }
  }
  return field;
}

// ---------------------------------------------------------------------------------------------
// Raid field
// ---------------------------------------------------------------------------------------------

const raidFields = new WeakMap<GameState['build'], { ov: Overlay; rev: number; field: FlowField }>();
let lastMs = 0;
/** Milliseconds the last field computation took is not measured here (no clock in the sim); tests time it. */
export const fieldStats = { computed: 0, get lastMs() { return lastMs; }, set lastMs(v: number) { lastMs = v; } };

/** Tiles the raiders head for: the headquarters, then the other buildings with beds. */
export function raidGoals(state: GameState): { tile: number; bias: number }[] {
  const goals: { tile: number; bias: number }[] = [];
  const hq = hqOf(state);
  for (const st of state.build.structures) {
    if (!isBuilt(st)) continue;
    const def = defOf(st);
    const main = st === hq;
    if (!main && !(def.kind === 'building' && (def.beds ?? 0) > 0)) continue;
    forTiles(st, (tile) => goals.push({ tile, bias: main ? 0 : BUILD.flow.shelterBias }));
  }
  if (goals.length === 0) goals.push({ tile: (TILES / 2) * TILES + TILES / 2, bias: 0 });
  return goals;
}

/** The field raiders follow. `map` null: the base is treated as open ground (player away). */
export function raidField(state: GameState, map: TacticalMap | null): FlowField {
  const ov = overlayOf(state, map ? map.walk : null);
  const cached = raidFields.get(state.build);
  if (cached && cached.ov === ov && cached.rev === ov.rev) return cached.field;
  const field = computeField(ov.cost, raidGoals(state), cached?.field);
  fieldStats.computed++;
  raidFields.set(state.build, { ov, rev: ov.rev, field });
  return field;
}

// ---------------------------------------------------------------------------------------------
// Chase field
// ---------------------------------------------------------------------------------------------

interface Chase {
  field: FlowField;
  x: number;
  z: number;
  step: number;
  rev: number;
}
const chases = new WeakMap<TacticalState, Chase>();

/**
 * The field towards the player for the current area, refreshed at most once a second and only
 * when the player has moved (or the structures changed). Call only when some zombie needs it.
 */
export function chaseField(state: GameState, map: TacticalMap): FlowField {
  const t = state.tactical!;
  const p = state.player;
  const home = map.params.isHome;
  const rev = home ? state.build.gridRev : -1;
  const step = t.step ?? 0;
  let c = chases.get(t);
  const stepsPerSecond = 60;
  if (c && (c.rev !== rev || (step - c.step >= BUILD.flow.chaseInterval * stepsPerSecond && Math.hypot(p.pos[0] - c.x, p.pos[2] - c.z) >= BUILD.flow.chaseMove))) {
    // stale: fall through and recompute into the same arrays
  } else if (c) return c.field;
  const cost = home ? overlayOf(state, map.walk).cost : staticCost(map);
  const tile = Math.min(TILES - 1, Math.max(0, Math.floor(p.pos[2] / TILE))) * TILES + Math.min(TILES - 1, Math.max(0, Math.floor(p.pos[0] / TILE)));
  const field = computeField(cost, [{ tile, bias: 0 }], c?.field);
  fieldStats.computed++;
  c = { field, x: p.pos[0], z: p.pos[2], step, rev };
  chases.set(t, c);
  return field;
}

const staticCosts = new WeakMap<TacticalMap, Float32Array>();
function staticCost(map: TacticalMap): Float32Array {
  let cost = staticCosts.get(map);
  if (!cost) {
    cost = new Float32Array(N);
    for (let i = 0; i < N; i++) cost[i] = map.walk[i] ? 1 : Infinity;
    staticCosts.set(map, cost);
  }
  return cost;
}

export function tileOf(x: number, z: number): number {
  return Math.min(TILES - 1, Math.max(0, Math.floor(z / TILE))) * TILES + Math.min(TILES - 1, Math.max(0, Math.floor(x / TILE)));
}
