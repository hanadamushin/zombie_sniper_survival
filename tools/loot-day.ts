// What a day of searching brings in (07e × 07d-3): the expected resources of searching every search
// point of an area (the most a player gets out of one area in a day), for the start cells of new
// games over 10 days (the home area, then the nearest land cell not yet searched, one a day):
//   node tools/loot-day.ts [--root <checkout>] [--seeds 12,3]
// Expected values at the cell's loot factor 1 (data/colony.ts tables; the game multiplies by the
// cell's loot and draws around them). --root runs another checkout's code (before/after).
import { readFileSync } from 'node:fs';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const root = (arg('--root') ?? new URL('..', import.meta.url).pathname).replace(/\/?$/, '/');
const seeds = (arg('--seeds') ?? '12,3').split(',').map(Number);

const { createInitialState } = await import(`${root}src/core/types.ts`);
const { stream } = await import(`${root}src/core/rng.ts`);
const { decodeScenario, initWorld } = await import(`${root}src/sim/world/scenario.ts`);
const { findStartCandidates } = await import(`${root}src/sim/world/start.ts`);
const { areaParams } = await import(`${root}src/sim/tactical/area.ts`);
const { generateTacticalMap } = await import(`${root}src/gen/index.ts`);
const { lootYield } = await import(`${root}src/sim/colony/loot.ts`);
const { COLONY } = await import(`${root}src/data/colony.ts`);
const { loadGrid, loadRealIndexes, provideAround } = await import(`${root}tools/real/lib/game.ts`);

const grid = loadGrid();
loadRealIndexes(grid);
const buf = readFileSync(new URL('public/data/infection_0.bin', `file://${root}`));
const scenario = decodeScenario(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

type Spot = { table?: string; building: number };
function day(state: unknown, cell: number, home: boolean): { spots: number; buildings: number; res: Record<string, number> } {
  provideAround(grid, cell);
  const params = areaParams(state, grid, cell);
  if (!params) return { spots: 0, buildings: 0, res: {} };
  params.isHome = home;
  const map = generateTacticalMap(params);
  const res: Record<string, number> = {};
  for (const s of map.lootSpots as Spot[]) {
    for (const [r, v] of lootYield(s.table ? { table: s.table, land: map.params.land } : map.params.land, COLONY.search.points) as [string, number][]) res[r] = (res[r] ?? 0) + v;
  }
  return { spots: map.lootSpots.length, buildings: new Set((map.lootSpots as Spot[]).map((s) => s.building)).size, res };
}

const totals: Record<string, number> = {};
let days = 0;
let spots = 0;
let buildings = 0;
for (const seed of seeds) {
  const state = createInitialState(seed, 1);
  initWorld(state, grid, scenario);
  const cands = findStartCandidates(state.world.cells, grid, stream(state, 'world.start'));
  for (const cand of cands) {
    state.world.homeCell = cand.cell;
    const w = grid.gridW;
    // Ten days: the home area, then the nearest land cells (the 8 around it, then the next ring).
    const ring: [number, number][] = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx || dy) ring.push([dx, dy]);
    ring.sort((a, c) => Math.hypot(a[0], a[1]) - Math.hypot(c[0], c[1]));
    const cells = [cand.cell, ...ring.map(([dx, dy]) => cand.cell + dy * w + dx)].filter((c) => grid.cells[c]).slice(0, 10);
    const line: string[] = [];
    for (const c of cells) {
      const d = day(state, c, c === cand.cell);
      days++;
      spots += d.spots;
      buildings += d.buildings;
      for (const [r, v] of Object.entries(d.res)) totals[r] = (totals[r] ?? 0) + v;
      line.push(`${d.spots}/${d.buildings}`);
    }
    console.log(`seed ${seed} start ${cand.cell}: spots/buildings per day ${line.join(' ')}`);
  }
}
console.log(`\n${days} area-days: ${(spots / days).toFixed(1)} search points in ${(buildings / days).toFixed(1)} buildings a day`);
console.log(`resources a day (expected, loot 1): ${Object.entries(totals).map(([r, v]) => `${r} ${(v / days).toFixed(1)}`).join(', ')}`);
