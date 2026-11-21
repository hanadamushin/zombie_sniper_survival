// Node helpers for tools and tests: the built grid and the real-map areas from public/data, and a
// game state to generate operation areas the way the game does (sim/tactical/area.ts areaParams).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createInitialState, type GameState, type StaticGrid } from '../../../src/core/types.ts';
import { decodeRealArea, type RealArea } from '../../../src/gen/real/format.ts';
import { parseGrid, type GridFile } from '../../../src/sim/world/grid.ts';
import { addRealRegion, provideRealArea, realRegionOf, type RegionIndexFile } from '../../../src/sim/world/realAreas.ts';
import { decodeScenario, initWorld } from '../../../src/sim/world/scenario.ts';

const DATA = new URL('../../../public/data/', import.meta.url);

export function loadGrid(): StaticGrid {
  return parseGrid(JSON.parse(readFileSync(new URL('grid.json', DATA), 'utf8')) as GridFile);
}

/** Register every built region (public/data/areas/<region>/index.json). Returns the regions found. */
export function loadRealIndexes(grid: StaticGrid): string[] {
  const dir = new URL('areas/', DATA);
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const region of readdirSync(dir)) {
    const file = new URL(`${region}/index.json`, dir);
    if (!existsSync(file)) continue;
    addRealRegion(JSON.parse(readFileSync(file, 'utf8')) as RegionIndexFile, grid);
    found.push(region);
  }
  return found;
}

/** Decode a cell's area file. */
export function readRealArea(cell: number): RealArea | null {
  const region = realRegionOf(cell);
  if (!region) return null;
  return decodeRealArea(gunzipSync(readFileSync(new URL(`areas/${region}/${cell}.bin`, DATA))));
}

/** Load (into the registry) the areas of a cell and its 8 neighbours. */
export function provideAround(grid: StaticGrid, cell: number): void {
  const w = grid.gridW;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const a = readRealArea(cell + dy * w + dx);
    if (a) provideRealArea(a);
  }
}

/** A game after the bundled scenario 0 (seed `seed`), home at `home`. */
export function gameState(grid: StaticGrid, seed = 12, home: number | null = null): GameState {
  const buf = readFileSync(new URL('infection_0.bin', DATA));
  const scenario = decodeScenario(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  const state = createInitialState(seed, 1);
  initWorld(state, grid, scenario);
  if (home !== null) state.world.homeCell = home;
  return state;
}
