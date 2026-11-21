// The cells around the player (07c): which maps exist, where they sit relative to the current
// cell, and making the missing ones in the background.
//
//   setRenderGrid(grid)          main.ts hands over the static grid once it is loaded
//   cellOffset(state, cell)      [x, z] of that cell's map origin in the current map's frame (null if not adjacent)
//   neighbourMap(state, cell)    its generated map if it is ready — otherwise asks the worker and returns null
//   groundPixelsOf(map)          the ground colours the worker built with it (if any)

import type { CellId, GameState, StaticGrid } from '../../core/types.ts';
import type { GenParams, TacticalMap } from '../../gen/index.ts';
import { areaParams, cachedMap, provideMap } from '../../sim/tactical/area.ts';
import { realPending } from '../../sim/world/realAreas.ts';

let grid: StaticGrid | null = null;
export function setRenderGrid(g: StaticGrid | null): void {
  grid = g;
}
export function renderGrid(): StaticGrid | null {
  return grid;
}

/** Offset of a cell's map origin from the current cell's (m), or null when it is not one of the 8 neighbours (or itself). */
export function cellOffset(state: GameState, cell: CellId, size: number): [number, number] | null {
  const w = state.world.gridW;
  if (!w) return null;
  const here = state.player.cell;
  const dx = (cell % w) - (here % w);
  const dz = Math.floor(cell / w) - Math.floor(here / w);
  if (Math.abs(dx) > 1 || Math.abs(dz) > 1) return null;
  return [dx * size, dz * size];
}

const pixels = new WeakMap<TacticalMap, Uint8Array>();
export function groundPixelsOf(map: TacticalMap): Uint8Array | undefined {
  return pixels.get(map);
}

let worker: Worker | null | undefined;
const pending = new Map<string, number>();
let nextId = 1;
const keyOf = (p: GenParams): string => `${p.mapSeed}:${p.land}:${p.isHome ? 1 : 0}:${p.lootSpots}${p.real ? ':r' : ''}`;

function startWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./mapWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; map: TacticalMap; pixels: Uint8Array }>) => {
      const { map, pixels: px } = e.data;
      const key = keyOf(map.params);
      pending.delete(key);
      provideMap(map.params, map);
      // The cache may already have had one (made on the main thread meanwhile): keep the pixels for whichever is there.
      const cached = cachedMap(map.params);
      if (cached) pixels.set(cached, px);
    };
    worker.onerror = () => {
      worker = null; // fall back to building on the main thread
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** Ask for a map in the background. Returns false when there is no worker (the caller may build it itself). */
export function requestMap(params: GenParams): boolean {
  const w = startWorker();
  if (!w) return false;
  const key = keyOf(params);
  if (pending.has(key)) return true;
  const id = nextId++;
  pending.set(key, id);
  w.postMessage({ id, params });
  return true;
}

/** Generation parameters of a cell (null for the sea / without a grid). */
export function paramsOf(state: GameState, cell: CellId): GenParams | null {
  // R0: not before the cell's real-map data have arrived (the random map would be another place).
  if (!grid || realPending(cell)) return null;
  return areaParams(state, grid, cell);
}

/** A neighbour's map if it is ready; otherwise it is requested and null is returned. */
export function neighbourMap(state: GameState, cell: CellId): TacticalMap | null {
  const params = paramsOf(state, cell);
  if (!params) return null;
  const map = cachedMap(params);
  if (map) return map;
  requestMap(params);
  return null;
}

/** The 8 neighbours and the cell itself, row by row from the north-west (null: sea / off the grid). */
export function around(state: GameState): (CellId | null)[] {
  const out: (CellId | null)[] = [];
  const g = grid;
  const here = state.player.cell;
  if (!g) return out;
  const w = g.gridW;
  const gx = here % w;
  const gy = Math.floor(here / w);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = gx + dx;
      const y = gy + dy;
      const id = y * w + x;
      out.push(x >= 0 && y >= 0 && x < w && y < g.gridH && g.cells[id] ? id : null);
    }
  }
  return out;
}
