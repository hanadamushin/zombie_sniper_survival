// Overland travel between cells: path finding (8-connected land, mountains cost more) and the
// per-minute progress of a journey. docs/02_systems_spec.md §1.

import type { CellId, GameState, StaticGrid } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { cellsWithin } from './grid.ts';

const T = BALANCE.world.travel;

export interface Route {
  /** Cells from start to destination, both included. */
  path: CellId[];
  /** Total game minutes. */
  minutes: number;
}

/** Game minutes to walk from `from` into the adjacent cell `to`. */
export function legMinutes(grid: StaticGrid, from: CellId, to: CellId, fast = false): number {
  const w = grid.gridW;
  const f = fast ? T.fastMinutesPerCell / T.minutesPerCell : 1;
  if (Math.abs((from % w) - (to % w)) > 1 || Math.abs(Math.floor(from / w) - Math.floor(to / w)) > 1) {
    // Not neighbours: a sea crossing (06).
    const link = grid.seaLinks?.find((l) => (l.a === from && l.b === to) || (l.a === to && l.b === from));
    return (link?.minutes ?? T.minutesPerCell * 4) * f;
  }
  if (fast) return T.fastMinutesPerCell;
  const diagonal = from % w !== to % w && Math.floor(from / w) !== Math.floor(to / w);
  const mountain = grid.cells[to]?.land === 'mountain';
  return T.minutesPerCell * (diagonal ? T.diagonalFactor : 1) * (mountain ? T.mountainFactor : 1);
}

/** Cheapest route over land and the fixed sea crossings, or null when the destination cannot be reached. `fast`: between outposts (06). */
export function findRoute(grid: StaticGrid, from: CellId, to: CellId, fast = false): Route | null {
  if (!grid.cells[from] || !grid.cells[to]) return null;
  if (from === to) return { path: [from], minutes: 0 };
  const { gridW: w, gridH: h } = grid;
  const cost = new Float64Array(w * h).fill(Infinity);
  const prev = new Int32Array(w * h).fill(-1);
  // Binary heap of [cost, cell].
  const heapCost: number[] = [];
  const heapCell: number[] = [];
  const push = (c: number, cell: number): void => {
    let i = heapCost.length;
    heapCost.push(c);
    heapCell.push(cell);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapCost[p]! <= c) break;
      heapCost[i] = heapCost[p]!;
      heapCell[i] = heapCell[p]!;
      i = p;
    }
    heapCost[i] = c;
    heapCell[i] = cell;
  };
  const pop = (): number => {
    const top = heapCell[0]!;
    const c = heapCost.pop()!;
    const cell = heapCell.pop()!;
    const n = heapCost.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= n) break;
        if (child + 1 < n && heapCost[child + 1]! < heapCost[child]!) child++;
        if (heapCost[child]! >= c) break;
        heapCost[i] = heapCost[child]!;
        heapCell[i] = heapCell[child]!;
        i = child;
      }
      heapCost[i] = c;
      heapCell[i] = cell;
    }
    return top;
  };
  const tx = to % w;
  const ty = Math.floor(to / w);
  // Sea crossings jump across the map, so the straight-line estimate is only admissible without them.
  const links = grid.seaLinks ?? [];
  const perCell = fast ? T.fastMinutesPerCell : T.minutesPerCell;
  const heuristic = (cell: number): number => (links.length > 0 ? 0 : Math.max(Math.abs((cell % w) - tx), Math.abs(Math.floor(cell / w) - ty)) * perCell);

  cost[from] = 0;
  push(heuristic(from), from);
  while (heapCost.length > 0) {
    const cell = pop();
    if (cell === to) break;
    const base = cost[cell]!;
    const cx = cell % w;
    const cy = Math.floor(cell / w);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const next = y * w + x;
        if (!grid.cells[next]) continue;
        const c = base + legMinutes(grid, cell, next, fast);
        if (c < cost[next]!) {
          cost[next] = c;
          prev[next] = cell;
          push(c + heuristic(next), next);
        }
      }
    }
    for (const l of links) {
      const next = l.a === cell ? l.b : l.b === cell ? l.a : -1;
      if (next < 0) continue;
      const c = base + legMinutes(grid, cell, next, fast);
      if (c < cost[next]!) {
        cost[next] = c;
        prev[next] = cell;
        push(c + heuristic(next), next);
      }
    }
  }
  if (cost[to] === Infinity) return null;
  const path: CellId[] = [];
  for (let c = to; c !== -1; c = prev[c]!) path.push(c);
  path.reverse();
  return { path, minutes: Math.round(cost[to]!) };
}

/** Mark a cell as visited (detailed intel) and its surroundings as roughly known. */
export function reveal(state: GameState, grid: StaticGrid, cell: CellId, radius = 1): void {
  const cells = state.world.cells;
  for (const id of cellsWithin(grid, cell, radius)) if ((cells.intel[id] ?? 0) < 1) cells.intel[id] = 1;
  cells.visited[cell] = true;
  cells.intel[cell] = 2;
}

/**
 * Advance the current journey by one game minute. Returns the cells entered during this minute
 * (usually none) and whether the destination was reached.
 */
export function advanceTravel(state: GameState, grid: StaticGrid): { entered: CellId[]; arrived: boolean } {
  const travel = state.world.travel;
  const entered: CellId[] = [];
  if (!travel) return { entered, arrived: false };
  const last = travel.path.length - 1;
  let budget = 1; // minutes
  while (budget > 0 && travel.progress < last) {
    const leg = Math.floor(travel.progress);
    const minutes = legMinutes(grid, travel.path[leg]!, travel.path[leg + 1]!, travel.fast === true);
    const remaining = (leg + 1 - travel.progress) * minutes;
    if (remaining <= budget + 1e-9) {
      budget -= remaining;
      travel.progress = leg + 1;
      const cell = travel.path[leg + 1]!;
      state.player.cell = cell;
      reveal(state, grid, cell);
      entered.push(cell);
    } else {
      travel.progress += budget / minutes;
      budget = 0;
    }
  }
  const arrived = travel.progress >= last;
  if (arrived) state.world.travel = null;
  return { entered, arrived };
}

/** Minutes left on the current journey. */
export function travelMinutesLeft(state: GameState, grid: StaticGrid): number {
  const travel = state.world.travel;
  if (!travel) return 0;
  let total = 0;
  for (let leg = Math.floor(travel.progress); leg < travel.path.length - 1; leg++) {
    const frac = leg === Math.floor(travel.progress) ? 1 - (travel.progress - leg) : 1;
    total += frac * legMinutes(grid, travel.path[leg]!, travel.path[leg + 1]!, travel.fast === true);
  }
  return total;
}
