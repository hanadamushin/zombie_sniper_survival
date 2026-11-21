// Verification images: `node tools/preview.ts [outDir]` writes PNG maps (land class, population,
// zombie density per scenario and day) so that the result of the simulation can be checked by eye.
// Reads the freshly built grid in memory (does not depend on public/data).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedRng } from '../src/core/rng.ts';
import type { StaticGrid } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { parseGrid } from '../src/sim/world/grid.ts';
import { runScenario } from '../src/sim/world/infection.ts';
import { readFileSync } from 'node:fs';
import type { GridFile } from '../src/sim/world/grid.ts';
import { encodePng } from './lib/png.ts';

const SCALE = 4;
type Rgb = [number, number, number];
const SEA: Rgb = [14, 22, 34];

export function renderMap(grid: StaticGrid, color: (cell: number) => Rgb): Buffer {
  const w = grid.gridW * SCALE;
  const h = grid.gridH * SCALE;
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const id = Math.floor(y / SCALE) * grid.gridW + Math.floor(x / SCALE);
      const c = grid.cells[id] ? color(id) : SEA;
      rgb.set(c, (y * w + x) * 3);
    }
  }
  return encodePng(w, h, rgb);
}

/** Black -> red -> yellow -> white over log10(value) in [0, max]. */
export function heat(value: number, maxLog: number): Rgb {
  if (value <= 0) return [36, 48, 40];
  const t = Math.min(1, Math.log10(1 + value) / maxLog);
  return [Math.round(60 + 195 * Math.min(1, t * 1.6)), Math.round(255 * Math.max(0, Math.min(1, t * 2 - 0.7))), Math.round(255 * Math.max(0, t * 3 - 2))];
}

const LAND_COLORS: Record<string, Rgb> = { urban: [230, 70, 60], suburb: [235, 170, 70], rural: [150, 190, 90], forest: [40, 110, 60], mountain: [120, 120, 130] };

if (import.meta.main) {
  const out = process.argv[2] ?? 'tmp/preview';
  mkdirSync(out, { recursive: true });
  // R0: the built grid (public/data/grid.json, real data).
  const grid = parseGrid(JSON.parse(readFileSync(new URL('../public/data/grid.json', import.meta.url), 'utf8')) as GridFile);
  writeFileSync(join(out, 'land.png'), renderMap(grid, (id) => LAND_COLORS[grid.cells[id]!.land]!));
  // Prefectures: a colour per prefecture, darker on cells whose neighbour is in another prefecture.
  const prefColor = (p: number): Rgb => [80 + ((p * 97) % 160), 80 + ((p * 57) % 160), 80 + ((p * 151) % 160)];
  writeFileSync(join(out, 'pref.png'), renderMap(grid, (id) => {
    const c = grid.cells[id]!;
    const w = grid.gridW;
    const border = [id - 1, id + 1, id - w, id + w].some((n) => grid.cells[n] && grid.cells[n]!.pref !== c.pref);
    const col = prefColor(c.pref);
    return border ? [col[0] * 0.55, col[1] * 0.55, col[2] * 0.55] as Rgb : col;
  }));
  writeFileSync(join(out, 'elev.png'), renderMap(grid, (id) => {
    const e = grid.cells[id]!.real?.elev ?? 0;
    const t = Math.min(1, e / 1500);
    return [Math.round(60 + 170 * t), Math.round(110 + 120 * t * t), Math.round(60 + 160 * t * t)];
  }));
  writeFileSync(join(out, 'facilities.png'), renderMap(grid, (id) => {
    const r = grid.cells[id]!.real;
    if (r?.airports) return [80, 200, 255];
    if (r?.station && r.station.grade >= 3) return [255, 230, 80];
    if (r?.station) return [200, 140, 60];
    return [40, 50, 44];
  }));
  writeFileSync(join(out, 'pop.png'), renderMap(grid, (id) => heat(grid.cells[id]!.pop0, 6.2)));
  const days = BALANCE.infection.precomputeDays;
  BALANCE.infection.scenarioSeeds.forEach((seed, n) => {
    runScenario(grid, seedRng(seed), days, (day, cells) => {
      if (day % 30 === 0 && day > 0) writeFileSync(join(out, `z_${n}_day${day}.png`), renderMap(grid, (id) => heat(cells.Z[id]!, 6)));
      if (day === days) writeFileSync(join(out, `h_${n}.png`), renderMap(grid, (id) => heat(cells.H[id]!, 4.5)));
    });
  });
  console.log(`[preview] wrote PNGs to ${out}`);
}
