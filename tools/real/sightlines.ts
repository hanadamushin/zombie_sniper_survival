// R1: the two sight-line rules for real areas (prompts R1..R8, "見通しの目安の扱い"), cell by cell:
//   node tools/real/sightlines.ts <region> [--cells id,id] [--suggest]
//   (1) firing positions: at least 3 elevated vantages (as tools/real/check.ts counts them) from which
//       a standing shooter sees a target 300 m away (ground + 1 m) in at least one of 16 directions,
//       unless the area is mostly sea (> 60 %, as check.ts)
//   (2) home: in rural / forest cells (the home candidates), generated as the home cell, from the 120 m
//       clearing (its middle and 8 points 60 m out) a standing shooter sees a target 150 m away in at
//       least 2 of 16 directions
// Prints a line per cell and the cells that fail; exit code 1 on failures. --suggest: for a cell short
// of far-seeing vantages, the best free spots for a lookout tower (an override's addPois of POI.tower).
import { readFileSync } from 'node:fs';
import type { StaticGrid } from '../../src/core/types.ts';
import { TACTICAL } from '../../src/data/tactical.ts';
import type { TacticalMap } from '../../src/gen/index.ts';
import { heightAt, isWalkable, sightBlocked } from '../../src/sim/tactical/collision.ts';
import { GROUND } from '../../src/gen/index.ts';
import { mapFor, walkStats } from './check.ts';
import { loadGrid, loadRealIndexes } from './lib/game.ts';
import { REGIONS, type RegionKey } from './lib/regions.ts';

const DIRS = 16;
const EYE = TACTICAL.player.eyeHeight.stand;

/** Directions (bit i of 16) in which a target `dist` away (inside the area) is seen from eye height over (x, y, z). */
function clearMask(map: TacticalMap, x: number, y: number, z: number, dist: number, beyond = 0): number {
  let m = 0;
  for (let i = 0; i < DIRS; i++) {
    const a = (i / DIRS) * Math.PI * 2;
    const bx = x + Math.cos(a) * dist;
    const bz = z + Math.sin(a) * dist;
    if (bx < 8 || bz < 8 || bx > map.size - 8 || bz > map.size - 8) continue;
    if (Math.hypot(bx - 512, bz - 512) < beyond) continue;
    if (!sightBlocked(map, [x, y + EYE, z], [bx, heightAt(map, bx, bz) + 1, bz])) m |= 1 << i;
  }
  return m;
}
const bits = (m: number): number => {
  let n = 0;
  for (; m; m &= m - 1) n++;
  return n;
};

/** Number of directions (of 16) in which a target `dist` away is seen from eye height over (x, y, z). */
export function clearDirections(map: TacticalMap, x: number, y: number, z: number, dist: number): number {
  return bits(clearMask(map, x, y, z, dist));
}

/** Directions with a clear 150 m line from the home clearing (its middle and 8 points 60 m out) to a target outside it. */
export function homeDirections(map: TacticalMap): number {
  let m = 0;
  for (let k = -1; k < 8; k++) {
    const x = k < 0 ? 512 : 512 + Math.cos((k / 8) * Math.PI * 2) * 60;
    const z = k < 0 ? 512 : 512 + Math.sin((k / 8) * Math.PI * 2) * 60;
    m |= clearMask(map, x, heightAt(map, x, z), z, 150, 120);
  }
  return bits(m);
}

export interface SightRow {
  cell: number;
  land: string;
  /** Elevated vantages, and those that see 300 m. */
  high: number;
  far: number;
  /** Home rule: clear 150 m directions from the clearing's middle (-1: not a home candidate). */
  home: number;
  problems: string[];
}

export function sightCell(grid: StaticGrid, cell: number): SightRow {
  const map = mapFor(grid, cell);
  const high = map.vantages.filter((v) => v.pos[1] >= heightAt(map, v.pos[0], v.pos[2]) + 4 || v.kind === 'hill');
  const far = high.filter((v) => clearDirections(map, v.pos[0], v.pos[1], v.pos[2], 300) > 0).length;
  const land = map.params.land;
  let home = -1;
  if (land === 'rural' || land === 'forest') {
    const hm = mapFor(grid, cell, true);
    home = homeDirections(hm);
  }
  const problems: string[] = [];
  if (far < 3 && walkStats(map).water < 0.6) problems.push(`vantages seeing 300 m: ${far}`);
  if (home >= 0 && home < 2) problems.push(`home 150 m lines: ${home}`);
  return { cell, land, high: high.length, far, home, problems };
}

/** Deck height (m) of the lookout towers the overrides add (POI.tower, its grade = the deck). */
export const TOWER_DECK = 20;

/** Free, level, dry spots (not near the vantages, not in the middle) where a TOWER_DECK tower sees 300 m in the most directions. */
export function suggestTowers(map: TacticalMap, n: number): { x: number; z: number; dirs: number }[] {
  const out: { x: number; z: number; dirs: number }[] = [];
  const cand: { x: number; z: number; dirs: number }[] = [];
  for (let z = 40; z <= map.size - 40; z += 32) for (let x = 40; x <= map.size - 40; x += 32) {
    const tx = Math.floor(x / map.tile);
    const tz = Math.floor(z / map.tile);
    let ok = true;
    for (let dz = -4; dz <= 4 && ok; dz++) for (let dx = -4; dx <= 4 && ok; dx++) {
      const i = (tz + dz) * map.tiles + tx + dx;
      if (!isWalkable(map, tx + dx, tz + dz) || map.ground[i] === GROUND.road || map.ground[i] === GROUND.water) ok = false;
    }
    if (!ok || Math.hypot(x - 512, z - 512) < 180) continue;
    let lo = Infinity;
    let hi = -Infinity;
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3], [0, 0]]) {
      const h = heightAt(map, x + dx!, z + dz!);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    if (hi - lo > 2.5) continue;
    if (map.vantages.some((v) => Math.hypot(v.pos[0] - x, v.pos[2] - z) < 150)) continue;
    cand.push({ x, z, dirs: clearDirections(map, x, hi + TOWER_DECK, z, 300) });
  }
  cand.sort((a, b) => b.dirs - a.dirs);
  for (const c of cand) {
    if (out.length >= n || c.dirs === 0) break;
    if (out.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < 200)) continue;
    out.push(c);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const region = args.find((a) => (REGIONS as readonly string[]).includes(a)) as RegionKey | undefined;
  if (!region) throw new Error(`usage: node tools/real/sightlines.ts <${REGIONS.join('|')}> [--cells id,id]`);
  const grid = loadGrid();
  loadRealIndexes(grid);
  const index = JSON.parse(readFileSync(new URL(`../../public/data/areas/${region}/index.json`, import.meta.url), 'utf8')) as { cells: Record<string, unknown> };
  let cells = Object.keys(index.cells).map(Number);
  const ci = args.indexOf('--cells');
  if (ci >= 0) cells = args[ci + 1]!.split(',').map(Number);
  const rows: SightRow[] = [];
  for (const cell of cells) {
    const r = sightCell(grid, cell);
    rows.push(r);
    if (args.includes('--suggest') && r.problems.some((p) => p.startsWith('vantages'))) {
      for (const t of suggestTowers(mapFor(grid, cell), 3 - r.far)) console.log(`      ${cell}: { addPois: [{ kind: POI.tower, grade: ${TOWER_DECK}, x: ${t.x}, z: ${t.z}, name: '物見櫓' }] } // ${t.dirs}/16 directions`);
    }
    console.log(`${String(cell).padStart(6)} ${r.land.padEnd(8)} vantages ${r.high} seeing 300 m ${r.far} home 150 m lines ${r.home < 0 ? '-' : `${r.home}/16`} ${r.problems.length ? `<< ${r.problems.join(', ')}` : ''}`);
  }
  const bad = rows.filter((r) => r.problems.length);
  const homes = rows.filter((r) => r.home >= 0);
  console.log(`[sightlines ${region}] ${rows.length} cells, ${bad.length} with problems; vantages seeing 300 m: mean ${(rows.reduce((s, r) => s + r.far, 0) / rows.length).toFixed(1)}, min ${Math.min(...rows.map((r) => r.far))}; home candidates ${homes.length}, 150 m lines mean ${(homes.reduce((s, r) => s + r.home, 0) / Math.max(1, homes.length)).toFixed(1)}/16, min ${Math.min(...homes.map((r) => r.home))}`);
  if (bad.length) process.exitCode = 1;
}
