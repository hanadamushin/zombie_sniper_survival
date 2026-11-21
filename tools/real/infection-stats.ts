// Day-90 distribution of the bundled infection scenarios (R0: before / after the real grid).
//   node tools/real/infection-stats.ts  -> JSON on stdout
import { readFileSync } from 'node:fs';
import { parseGrid, type GridFile } from '../../src/sim/world/grid.ts';
import { decodeScenario } from '../../src/sim/world/scenario.ts';
import { BALANCE } from '../../src/data/balance.ts';

const dir = new URL('../../public/data/', import.meta.url);
const grid = parseGrid(JSON.parse(readFileSync(new URL('grid.json', dir), 'utf8')) as GridFile);
const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};
const out: Record<string, unknown> = { landCells: grid.landIds.length, pop: grid.landIds.reduce((s, id) => s + grid.cells[id]!.pop0, 0) };
const counts: Record<string, number> = {};
for (const id of grid.landIds) counts[grid.cells[id]!.land] = (counts[grid.cells[id]!.land] ?? 0) + 1;
out.lands = counts;
BALANCE.infection.scenarioSeeds.forEach((_, n) => {
  const data = decodeScenario(new Uint8Array(readFileSync(new URL(`infection_${n}.bin`, dir))).slice().buffer);
  const byLand: Record<string, number[]> = {};
  let total = 0;
  grid.landIds.forEach((id, i) => {
    const land = grid.cells[id]!.land;
    const z = data.Z[i]!;
    total += z;
    (byLand[land] ??= []).push(z);
  });
  out[`scenario${n}`] = { totalZ: total, median: Object.fromEntries(Object.entries(byLand).map(([k, v]) => [k, median(v)])) };
});
console.log(JSON.stringify(out, null, 1));
