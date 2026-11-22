// 07d-3: what stands in every real area of Japan (all 4,108 cells, generated as the game does with
// seed 12), in parallel worker threads:
//   node tools/real/census.ts [--cells id,id] [--workers n] [--out tests/data/census.json]
// Prints the count of every building type (and the types that never appear), the facilities built
// per point kind (cells that hold the kind / cells where one is built / points built), the garrisons
// and their distance from the annotation, generation times; writes the summary the test
// tests/census.test.ts reads (per type counts, per cell placement count and a hash of its types).
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { BUILDING_DEFS } from '../../src/gen/buildings/index.ts';
import { POI } from '../../src/gen/real/format.ts';
import { mapFor } from './check.ts';
import { loadGrid, loadRealIndexes } from './lib/game.ts';

export interface CellCensus {
  cell: number;
  land: string;
  ms: number;
  placements: number;
  boxes: number;
  vantages: number;
  loot: number;
  /** Placements per type. */
  types: Record<string, number>;
  /** Per point kind: [points, built]. */
  pois: Record<number, [number, number]>;
  /** Garrisons / bases: name, type, distance (m) of the site's centre from the annotation (-1: not built). */
  sdf: [string, string, number][];
}

/** A stable hash of the types of a cell (the test compares regenerated cells with it). */
export function typesHash(types: Record<string, number>): number {
  let h = 2166136261;
  for (const k of Object.keys(types).sort()) {
    const s = `${k}=${types[k]};`;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

const grid = loadGrid();
loadRealIndexes(grid);

export function censusCell(cell: number): CellCensus {
  const t0 = performance.now();
  const map = mapFor(grid, cell);
  const ms = performance.now() - t0;
  const types: Record<string, number> = {};
  for (const p of map.placements) types[p.def] = (types[p.def] ?? 0) + 1;
  const pois: Record<number, [number, number]> = {};
  const sdf: [string, string, number][] = [];
  for (const p of map.pois ?? []) {
    const e = (pois[p.kind] ??= [0, 0]);
    e[0]++;
    if (p.building !== undefined) e[1]++;
    if (p.kind === POI.gsdf || p.kind === POI.msdf || p.kind === POI.asdf || p.kind === POI.airport) {
      const bd = p.building !== undefined ? map.buildings[p.building] : undefined;
      const def = bd?.enter !== undefined ? map.placements[bd.enter]!.def : '';
      sdf.push([p.name, def, bd ? Math.round(Math.hypot((bd.x0 + bd.x1) / 2 - p.x, (bd.z0 + bd.z1) / 2 - p.z)) : -1]);
    }
  }
  return {
    cell, land: map.params.land, ms: Math.round(ms), placements: map.placements.length,
    boxes: map.buildings.filter((b) => b.enter === undefined && b.kind !== 'tower').length,
    vantages: map.vantages.length, loot: map.lootSpots.length, types, pois, sdf,
  };
}

if (!isMainThread && (workerData as { census?: boolean } | null)?.census) {
  const out: CellCensus[] = [];
  for (const cell of workerData.cells as number[]) out.push(censusCell(cell));
  parentPort!.postMessage(out);
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name: string): string | undefined => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const cells = arg('--cells')?.split(',').map(Number) ?? grid.landIds.filter((id) => grid.cells[id]?.real?.area);
  const workers = Number(arg('--workers') ?? Math.max(1, availableParallelism()));
  const outFile = arg('--out');
  const t0 = performance.now();
  const parts: number[][] = Array.from({ length: workers }, () => []);
  cells.forEach((c, i) => parts[i % workers]!.push(c));
  const rows = (await Promise.all(parts.map((p) => new Promise<CellCensus[]>((resolve, reject) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { census: true, cells: p } });
    w.once('message', resolve);
    w.once('error', reject);
  })))).flat().sort((a, b) => a.cell - b.cell);
  const secs = (performance.now() - t0) / 1000;

  const total: Record<string, number> = {};
  const cellsWith: Record<string, number> = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.types)) {
    total[k] = (total[k] ?? 0) + v;
    cellsWith[k] = (cellsWith[k] ?? 0) + 1;
  }
  console.log(`${rows.length} cells in ${secs.toFixed(0)} s`);
  console.log('\n| type | placements | cells |\n|---|---|---|');
  for (const def of BUILDING_DEFS) console.log(`| ${def.id} | ${total[def.id] ?? 0} | ${cellsWith[def.id] ?? 0} |`);
  const missing = BUILDING_DEFS.filter((d) => !total[d.id]).map((d) => d.id);
  console.log(`\nnever placed (${missing.length}): ${missing.join(' ')}`);

  const KIND: Record<number, string> = Object.fromEntries(Object.entries(POI).map(([k, v]) => [v, k]));
  console.log('\n| point kind | points | built | cells with points | cells with one built |\n|---|---|---|---|---|');
  for (const kind of Object.values(POI)) {
    let pts = 0;
    let built = 0;
    let cellsP = 0;
    let cellsB = 0;
    for (const r of rows) {
      const e = r.pois[kind];
      if (!e) continue;
      pts += e[0];
      built += e[1];
      cellsP++;
      if (e[1] > 0) cellsB++;
    }
    if (pts > 0) console.log(`| ${KIND[kind]} | ${pts} | ${built} | ${cellsP} | ${cellsB} |`);
  }
  console.log('\nSDF / airports (name, type, distance m; -1 not built):');
  for (const r of rows) for (const [name, def, dist] of r.sdf) console.log(`  ${r.cell} ${name} ${def || '-'} ${dist}`);

  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  const pl = rows.map((r) => r.placements).sort((a, b) => a - b);
  console.log(`\ngeneration ms: mean ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(0)} median ${ms[ms.length >> 1]} p99 ${ms[Math.floor(ms.length * 0.99)]} max ${ms[ms.length - 1]}`);
  console.log(`placements per area: mean ${(pl.reduce((a, b) => a + b, 0) / pl.length).toFixed(0)} max ${pl[pl.length - 1]} (cell ${rows.find((r) => r.placements === pl[pl.length - 1])!.cell}); boxes ${rows.reduce((a, r) => a + r.boxes, 0)}`);
  const fewV = rows.filter((r) => r.vantages < 3).map((r) => r.cell);
  console.log(`areas with fewer than 3 vantages: ${fewV.length} ${fewV.slice(0, 20).join(' ')}`);
  if (outFile) {
    const summary = {
      seed: 12,
      cells: rows.length,
      types: total,
      perCell: Object.fromEntries(rows.map((r) => [r.cell, [r.placements, typesHash(r.types)]])),
    };
    writeFileSync(outFile, `${JSON.stringify(summary)}\n`);
    console.log(`wrote ${outFile}`);
  }
}
