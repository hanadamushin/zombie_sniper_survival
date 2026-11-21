// `npm run data` — regenerates public/data/**: the static grid and the precomputed infection
// scenarios. Runs on plain Node (>= 22.18, built-in TypeScript type stripping).
//
// R0: the grid comes from real open data (tools/real/grid.ts; downloads are cached in tmp/realdata/,
// so a second run is offline). `npm run data -- --synthetic` builds the old synthetic grid
// (tools/build-grid.ts) without any download. `node tools/preview.ts <dir>` writes PNG maps.
import { mkdirSync, writeFileSync } from 'node:fs';
import { BALANCE } from '../src/data/balance.ts';
import { parseGrid } from '../src/sim/world/grid.ts';
import { buildGrid } from './build-grid.ts';
import { buildRealGrid } from './real/grid.ts';
import { buildScenarioFile } from './run-infection.ts';

const OUT = new URL('../public/data/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const synthetic = process.argv.includes('--synthetic');
const { file } = synthetic ? buildGrid() : await buildRealGrid();
const json = JSON.stringify(file);
writeFileSync(new URL('grid.json', OUT), json);
const grid = parseGrid(file);
console.log(`[data] grid.json: ${grid.gridW}x${grid.gridH}, ${grid.landIds.length} land cells, ${grid.hubs.length} hubs, ${(json.length / 1024).toFixed(0)} KB`);

BALANCE.infection.scenarioSeeds.forEach((_, n) => {
  const bytes = buildScenarioFile(grid, n);
  writeFileSync(new URL(`infection_${n}.bin`, OUT), bytes);
  console.log(`[data] infection_${n}.bin: ${(bytes.length / 1024).toFixed(0)} KB`);
});
