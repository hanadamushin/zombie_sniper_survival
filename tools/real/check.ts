// R0: automatic inspection of a region's real-map areas (docs/realmap_guide.md §4):
//   node tools/real/check.ts <region> [--cells id,id] [--quick]
// For every cell (as the game generates it): generation time, walkable share of the dry land,
// elevated firing positions, the home clearing (generated again as a home cell), open 200 m sight
// lines, buildings on roads / water, and with its east and south neighbours: heights, water and
// roads along the shared edge. Prints a table and the cells that fail, exit code 1 on failures.
import type { StaticGrid } from '../../src/core/types.ts';
import { REAL_CHECK } from '../../src/data/realmap.ts';
import { generateTacticalMap, GROUND, type TacticalMap } from '../../src/gen/index.ts';
import { areaParams } from '../../src/sim/tactical/area.ts';
import { heightAt } from '../../src/sim/tactical/collision.ts';
import { openSightShare } from '../../src/sim/tactical/sight.ts';
import { gameState, loadGrid, loadRealIndexes, provideAround } from './lib/game.ts';
import { REGIONS, type RegionKey } from './lib/regions.ts';
import { readFileSync, statSync } from 'node:fs';

export interface CellCheck {
  cell: number;
  land: string;
  ms: number;
  walkable: number;
  water: number;
  vantages: number;
  homeClear: boolean;
  sight: number;
  overlaps: number;
  seamHeight: number;
  seamWater: number;
  seamRoads: number;
  bytes: number;
  problems: string[];
}

export function mapFor(grid: StaticGrid, cell: number, home = false): TacticalMap {
  provideAround(grid, cell);
  const state = gameState(grid, 12, home ? cell : null);
  return generateTacticalMap(areaParams(state, grid, cell)!);
}

/** Shares of dry tiles that are walkable, and of tiles under water. */
export function walkStats(map: TacticalMap): { walkable: number; water: number } {
  let dry = 0;
  let walk = 0;
  let wet = 0;
  for (let i = 0; i < map.ground.length; i++) {
    if (map.ground[i] === GROUND.water) {
      wet++;
      continue;
    }
    dry++;
    if (map.walk[i]) walk++;
  }
  return { walkable: dry ? walk / dry : 0, water: wet / map.ground.length };
}

/** Buildings standing on a road or on water tiles (should be none). */
export function overlaps(map: TacticalMap): number {
  let n = 0;
  for (const b of map.buildings) {
    if (b.kind === 'tower') continue;
    const tx = Math.floor((b.x0 + b.x1) / 2 / map.tile);
    const tz = Math.floor((b.z0 + b.z1) / 2 / map.tile);
    const g = map.ground[tz * map.tiles + tx];
    if (g === GROUND.road || g === GROUND.water) n++;
  }
  return n;
}

/** Largest height difference along the shared edge, water mismatches, unmatched road ends. */
export function seam(a: TacticalMap, b: TacticalMap, east: boolean): { height: number; water: number; roads: number } {
  const S = a.size;
  let height = 0;
  let water = 0;
  for (let t = 0; t <= S; t += a.tile) {
    const [ax, az, bx, bz] = east ? [S, t, 0, t] : [t, S, t, 0];
    height = Math.max(height, Math.abs(heightAt(a, ax, az) - heightAt(b, bx, bz)));
    const i = Math.round(az / a.tile) * a.n + Math.round(ax / a.tile);
    const j = Math.round(bz / b.tile) * b.n + Math.round(bx / b.tile);
    if (Number.isFinite(a.water?.[i] ?? NaN) !== Number.isFinite(b.water?.[j] ?? NaN)) water++;
  }
  const ends = (m: TacticalMap, onEdge: (p: [number, number]) => number | null): number[] => {
    const out: number[] = [];
    for (const r of m.roads) for (const p of [r.pts[0]!, r.pts[r.pts.length - 1]!]) {
      const v = onEdge(p);
      if (v !== null) out.push(v);
    }
    return out;
  };
  const onA = (p: [number, number]): number | null => (east ? (Math.abs(p[0] - S) < 0.01 ? p[1] : null) : Math.abs(p[1] - S) < 0.01 ? p[0] : null);
  const onB = (p: [number, number]): number | null => (east ? (Math.abs(p[0]) < 0.01 ? p[1] : null) : Math.abs(p[1]) < 0.01 ? p[0] : null);
  const ea = ends(a, onA);
  const eb = ends(b, onB);
  // A road may go into a tunnel right at the edge (tunnels are not drawn): the tunnel's end is its partner.
  const tunnels = (m: TacticalMap, on: (p: [number, number]) => number | null): number[] => {
    const out: number[] = [];
    for (const l of m.params.real?.lines ?? []) {
      if (!(l.flags & 1)) continue;
      for (const k of [0, l.pts.length - 2]) {
        const v = on([l.pts[k]!, l.pts[k + 1]!]);
        if (v !== null) out.push(v);
      }
    }
    return out;
  };
  const pa = [...ea, ...tunnels(a, onA)];
  const pb = [...eb, ...tunnels(b, onB)];
  // A road through the very corner continues in the diagonal cell: not a mismatch of this edge.
  const corner = (v: number): boolean => v < 1 || v > S - 1;
  let roads = 0;
  for (const v of ea.filter((x) => !corner(x))) if (!pb.some((w) => Math.abs(w - v) < 2.5)) roads++;
  for (const v of eb.filter((x) => !corner(x))) if (!pa.some((w) => Math.abs(w - v) < 2.5)) roads++;
  return { height, water, roads };
}

export function checkCell(grid: StaticGrid, region: string, cell: number, quick = false): CellCheck {
  const C = REAL_CHECK;
  const t0 = performance.now();
  const map = mapFor(grid, cell);
  let ms = performance.now() - t0;
  // One slow run under load (parallel tests, a census in the background) must not fail a cell:
  // over the limit, time it once more and keep the faster run (the cost of the work itself).
  if (ms > REAL_CHECK.maxMs) {
    const t1 = performance.now();
    mapFor(grid, cell);
    ms = Math.min(ms, performance.now() - t1);
  }
  const { walkable, water } = walkStats(map);
  const high = map.vantages.filter((v) => v.pos[1] >= heightAt(map, v.pos[0], v.pos[2]) + 4 || v.kind === 'hill').length;
  const home = quick ? null : mapFor(grid, cell, true);
  const homeClear = !home || home.buildings.every((b) => b.kind === 'tower' || Math.hypot(Math.max(b.x0 - 512, 0, 512 - b.x1), Math.max(b.z0 - 512, 0, 512 - b.z1)) >= 120);
  const sight = quick ? NaN : openSightShare(map, 200, 300, cell);
  const w = grid.gridW;
  let seamHeight = 0;
  let seamWater = 0;
  let seamRoads = 0;
  for (const [n, east] of [[cell + 1, true], [cell + w, false]] as const) {
    if (!grid.cells[n]?.real?.area) continue;
    const nm = mapFor(grid, n);
    if (process.env.SEAM_DEBUG) console.log("seam", cell, n, Boolean(map.params.real), Boolean(nm.params.real));
    const s = seam(map, nm, east);
    seamHeight = Math.max(seamHeight, s.height);
    seamWater += s.water;
    seamRoads += s.roads;
  }
  let bytes = 0;
  try {
    bytes = statSync(new URL(`../../public/data/areas/${region}/${cell}.bin`, import.meta.url)).size;
  } catch {
    // no file
  }
  const problems: string[] = [];
  if (walkable < C.walkable && water < 0.9) problems.push(`walkable ${(walkable * 100).toFixed(0)}%`);
  if (high < C.vantages && water < 0.6) problems.push(`vantages ${high}`);
  if (!homeClear) problems.push('home not clear');
  if (seamHeight > C.seamHeight) problems.push(`seam height ${seamHeight.toFixed(2)} m`);
  if (seamWater > C.seamWater) problems.push(`seam water ${seamWater}`);
  if (seamRoads > C.seamRoads) problems.push(`seam roads ${seamRoads}`);
  if (overlaps(map) > C.overlaps) problems.push(`overlaps ${overlaps(map)}`);
  if (bytes > C.maxBytes) problems.push(`file ${(bytes / 1024).toFixed(0)} KB`);
  if (ms > C.maxMs) problems.push(`generation ${ms.toFixed(0)} ms`);
  return { cell, land: map.params.land, ms, walkable, water, vantages: high, homeClear, sight, overlaps: overlaps(map), seamHeight, seamWater, seamRoads, bytes, problems };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const region = args.find((a) => (REGIONS as readonly string[]).includes(a)) as RegionKey | undefined;
  if (!region) throw new Error(`usage: node tools/real/check.ts <${REGIONS.join('|')}> [--cells id,id] [--quick]`);
  const grid = loadGrid();
  loadRealIndexes(grid);
  const index = JSON.parse(readFileSync(new URL(`../../public/data/areas/${region}/index.json`, import.meta.url), 'utf8')) as { cells: Record<string, unknown> };
  let cells = Object.keys(index.cells).map(Number);
  const ci = args.indexOf('--cells');
  if (ci >= 0) cells = args[ci + 1]!.split(',').map(Number);
  const quick = args.includes('--quick');
  const rows: CellCheck[] = [];
  for (const cell of cells) {
    const r = checkCell(grid, region, cell, quick);
    rows.push(r);
    console.log(`${String(cell).padStart(6)} ${r.land.padEnd(8)} ${r.ms.toFixed(0).padStart(4)}ms walk ${(r.walkable * 100).toFixed(0).padStart(3)}% water ${(r.water * 100).toFixed(0).padStart(3)}% vant ${r.vantages} sight ${Number.isNaN(r.sight) ? '  -' : (r.sight * 100).toFixed(0).padStart(3)}% seam ${r.seamHeight.toFixed(3)}m/${r.seamWater}/${r.seamRoads} ${(r.bytes / 1024).toFixed(1)}KB ${r.problems.length ? `<< ${r.problems.join(', ')}` : ''}`);
  }
  const bad = rows.filter((r) => r.problems.length);
  const sum = (f: (r: CellCheck) => number): number => rows.reduce((s, r) => s + f(r), 0);
  console.log(`[check ${region}] ${rows.length} cells, ${bad.length} with problems; generation mean ${(sum((r) => r.ms) / rows.length).toFixed(0)} ms max ${Math.max(...rows.map((r) => r.ms)).toFixed(0)} ms; files ${(sum((r) => r.bytes) / 1e6).toFixed(2)} MB avg ${(sum((r) => r.bytes) / rows.length / 1024).toFixed(1)} KB max ${(Math.max(...rows.map((r) => r.bytes)) / 1024).toFixed(1)} KB`);
  for (const land of ['urban', 'suburb', 'rural', 'forest', 'mountain']) {
    const s = rows.filter((r) => r.land === land && !Number.isNaN(r.sight));
    if (s.length) console.log(`  ${land.padEnd(8)} ${s.length} cells, open 200 m sight lines ${((s.reduce((a, r) => a + r.sight, 0) / s.length) * 100).toFixed(0)}%`);
  }
  if (bad.length) process.exitCode = 1;
}
