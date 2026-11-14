// `npm run data` — regenerates public/data/**: the static grid and the precomputed infection
// scenarios. Deterministic and offline (see tools/build-grid.ts). Runs on plain Node (>= 22.18,
// built-in TypeScript type stripping). `node tools/preview.ts <dir>` writes PNG maps for checking.
import { mkdirSync, writeFileSync } from 'node:fs';
import { BALANCE } from '../src/data/balance.ts';
import { parseGrid } from '../src/sim/world/grid.ts';
import { buildGrid } from './build-grid.ts';
import { buildScenarioFile } from './run-infection.ts';

const OUT = new URL('../public/data/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const { file } = buildGrid();
const json = JSON.stringify(file);
writeFileSync(new URL('grid.json', OUT), json);
const grid = parseGrid(file);
console.log(`[data] grid.json: ${grid.gridW}x${grid.gridH}, ${grid.landIds.length} land cells, ${grid.hubs.length} hubs, ${(json.length / 1024).toFixed(0)} KB`);

BALANCE.infection.scenarioSeeds.forEach((_, n) => {
  const bytes = buildScenarioFile(grid, n);
  writeFileSync(new URL(`infection_${n}.bin`, OUT), bytes);
  console.log(`[data] infection_${n}.bin: ${(bytes.length / 1024).toFixed(0)} KB`);
});
