// The operation area the game makes from a cell's real data, seen from above (1 px = 1 m), with
// generation time and counts:   node tools/real/area-map.ts <cell> [cell...] [--home] [--out dir]
// Water is blue, beaches sand-coloured, buildings by height (see tools/tactical-preview.ts legend).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateTacticalMap } from '../../src/gen/index.ts';
import { areaParams } from '../../src/sim/tactical/area.ts';
import { renderTacticalMap } from '../tactical-preview.ts';
import { gameState, loadGrid, loadRealIndexes, provideAround } from './lib/game.ts';

const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const out = oi >= 0 ? args[oi + 1]! : 'tmp/realmap';
const home = args.includes('--home');
const cells = args.filter((a, i) => /^\d+$/.test(a) && (oi < 0 || i !== oi + 1)).map(Number);
mkdirSync(out, { recursive: true });
const grid = loadGrid();
loadRealIndexes(grid);
for (const cell of cells) {
  provideAround(grid, cell);
  const state = gameState(grid, 12, home ? cell : null);
  const params = areaParams(state, grid, cell)!;
  const t0 = performance.now();
  const map = generateTacticalMap(params);
  const ms = performance.now() - t0;
  writeFileSync(join(out, `${cell}${home ? '_home' : ''}.png`), renderTacticalMap(map));
  let walk = 0;
  for (const v of map.walk) walk += v;
  const hs = [...map.height];
  console.log(`${cell} (${grid.cells[cell]!.land}${params.real ? ', real' : ', random'}): ${ms.toFixed(0)} ms, buildings ${map.buildings.length} (enterable ${map.placements.length}), roads ${map.roads.length}, trees ${map.trees.n}, vantages ${map.vantages.length}, walkable ${((walk / map.walk.length) * 100).toFixed(0)}%, height ${Math.min(...hs).toFixed(1)}..${Math.max(...hs).toFixed(1)} m, pois ${map.pois?.length ?? 0}`);
}
