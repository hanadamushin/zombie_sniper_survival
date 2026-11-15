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
const DX = [-1, 1, 0, 0, -1, 1, -1, 1];
const DY = [0, 0, -1, 1, -1, -1, 1, 1];

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
  let entries = 0;
  let pending = 0;
  const push = (tile: number, d: number): void => {
    const b = d & MASK;
    entryTile[entries] = tile;
    entryNext[entries] = heads[b]!;
    heads[b] = entries++;
    pending++;
  };
  let lo = UNREACHED;
  for (const g of goals) {
    if (g.tile < 0 || g.tile >= N) continue;
    const d = Math.round(g.bias * 10);
    if (d < dist[g.tile]!) {
      dist[g.tile] = d;
      goalMark[g.tile] = 1;
      push(g.tile, d);
      if (d < lo) lo = d;
    }
  }
  for (let d = lo; pending > 0; d++) {
    const b = d & MASK;
    let e = heads[b]!;
    if (e < 0) continue;
    heads[b] = -1;
    while (e >= 0) {
      const cur = entryTile[e]!;
      e = entryNext[e]!;
      pending--;
      if (dist[cur] !== d) continue; // stale entry
      const enter = goalMark[cur] ? 10 : stepCost[cur]!;
      const cx = cur % TILES;
      const cy = (cur - cx) / TILES;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k]!;
        const ny = cy + DY[k]!;
        if (nx < 0 || ny < 0 || nx >= TILES || ny >= TILES) continue;
        const n = ny * TILES + nx;
        if (stepCost[n]! < 0 && !goalMark[n]) continue; // nobody can stand there, so nobody starts from there
        let nd: number;
        if (k < 4) nd = d + enter;
        else {
          // Diagonal: only across open ground on all four tiles involved.
          if (enter !== 10 || stepCost[n] !== 10 || stepCost[cy * TILES + nx] !== 10 || stepCost[ny * TILES + cx] !== 10) continue;
          nd = d + 14;
        }
        if (nd < dist[n]!) {
          dist[n] = nd;
          next[n] = cur;
          push(n, nd);
        }
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
