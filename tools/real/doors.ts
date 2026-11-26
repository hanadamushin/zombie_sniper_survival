// 09b: the sills of the outside doors of every enterable building in every real area of Japan (all
// cells, generated as the game does with seed 12), in parallel worker threads:
//   node tools/real/doors.ts [--cells id,id] [--workers n] [--list n] [--before] [--bad file]
// (--before: without the door steps of gen/doorsteps.ts, what the areas were like before 09b.)
// For every usable way in from outside (a door or an open front; ladders and bridges left out):
//   sill   the door's floor minus the ground a walker stands on just outside it (the terrain, or the
//          top of the door steps when the placement has them)
//   climb  the highest single step on the walk from the ground outside to the floor inside, taken with
//          the game's own collision (supportAt / pushOut, the walkers' radius and step-up)
// Prints the counts over 0.5 m (the walkers' step-up), their share and the largest, per building type.
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { TACTICAL } from '../../src/data/tactical.ts';
import { buildingDef, detailOf, type BuildingDetail } from '../../src/gen/buildings/index.ts';
import { setDoorSteps } from '../../src/gen/doorsteps.ts';
import type { TacticalMap } from '../../src/gen/index.ts';
import { heightAt, pushOut, supportAt } from '../../src/sim/tactical/collision.ts';
import { mapFor } from './check.ts';
import { loadGrid, loadRealIndexes } from './lib/game.ts';

export interface DoorCheck {
  enter: number;
  def: string;
  link: number;
  /** World position of the door's outside point. */
  x: number;
  z: number;
  /** Floor minus the support just outside the door (m; negative: the ground is above the floor). */
  sill: number;
  /** Highest single rise on the walk in (m); Infinity when the walker is stopped by something. */
  climb: number;
  /** The walker arrived inside at floor height. */
  ok: boolean;
  /** What stopped the walk. */
  by?: 'own' | 'other' | 'tree';
}

const STEP = TACTICAL.player.stepUp;
/** Doors that cannot be walked into for a reason other than a step (found by the count of all areas, 09b). */
const KNOWN = [
  { cell: 20765, def: 'house.hiraya', why: 'a 3.1 m drop into a walled yard of 2.4 x 3.3 m: no flight fits (the house has two other doors with steps)' },
  { cell: 15145, def: 'public.fire', why: 'the walk arrives, but the ground of the ungraded band at the area edge rises through the floor behind the door' },
];
const RADIUS = 0.32;

/** Walk a polyline with the game's collision; returns the highest single rise, or Infinity when stopped. */
export function walkIn(map: TacticalMap, pts: readonly (readonly [number, number, number])[], floor: number): { climb: number; y: number; by?: 'own' | 'other' | 'tree' } {
  let x = pts[0]![0];
  let z = pts[0]![2];
  let y = supportAt(map, x, z, heightAt(map, x, z), STEP);
  let climb = 0;
  const xz: [number, number] = [x, z];
  // A start within a walker's radius of a fence or a wall: from where the walker can stand.
  pushOut(map, xz, RADIUS, y, 1.7, STEP);
  if (Math.hypot(xz[0] - x, xz[1] - z) < 0.5) {
    x = xz[0];
    z = xz[1];
    y = supportAt(map, x, z, y, STEP);
  }
  for (let i = 1; i < pts.length; i++) {
    const [tx, , tz] = pts[i]!;
    const len = Math.hypot(tx - x, tz - z);
    const n = Math.max(1, Math.ceil(len / 0.05));
    const sx = x;
    const sz = z;
    for (let k = 1; k <= n; k++) {
      const nx = sx + ((tx - sx) * k) / n;
      const nz = sz + ((tz - sz) * k) / n;
      // What is in front, up to the floor the walk leads to (to report the rise when it is too high).
      const need = supportAt(map, nx, nz, floor + 0.01, 0) - y;
      xz[0] = nx;
      xz[1] = nz;
      pushOut(map, xz, RADIUS, y, 1.7, STEP);
      if (Math.hypot(xz[0] - nx, xz[1] - nz) > 0.25) {
        // Stopped: by a rise over the step-up (report it), or by a wall (Infinity).
        if (need > STEP) return { climb: Math.max(climb, need), y };
        // What stands there: something of the map (a neighbour, a prop, a rock), a tree, or the building's own boxes.
        const other = map.solids.some((s) => s.enter === undefined && nx > s.x0 - RADIUS && nx < s.x1 + RADIUS && nz > s.z0 - RADIUS && nz < s.z1 + RADIUS && s.y1 > y + STEP && s.y0 < y + 1.7);
        let tree = false;
        for (let i = 0; i < map.trees.n; i++) if (Math.hypot(map.trees.x[i]! - nx, map.trees.z[i]! - nz) < RADIUS + 0.6) tree = true;
        return { climb: Infinity, y, by: other ? 'other' : tree ? 'tree' : 'own' };
      }
      const s = supportAt(map, nx, nz, y, STEP);
      if (s > y) climb = Math.max(climb, s - y);
      y = s;
      x = nx;
      z = nz;
    }
  }
  return { climb, y };
}

/** The outside doors of a placement: its links to the outside (-1), ladders left out. */
export function outsideDoors(map: TacticalMap, enter: number, det: BuildingDetail = detailOf(map.placements[enter]!)): DoorCheck[] {
  const p = det.place;
  const out: DoorCheck[] = [];
  det.links.forEach((l, li) => {
    if ((l.a !== -1 && l.b !== -1) || l.kind === 'ladder') return;
    const pts = l.a === -1 ? l.wpts : [...l.wpts].reverse();
    // The waypoint on the sill and the one before it: the last two (door steps lead up to them).
    const inside = pts[pts.length - 1]!;
    const door = pts[pts.length - 2]!;
    const floor = inside[1];
    if (floor - p.base > 2) return; // a door of an upper floor (an outside gallery)
    const ground = supportAt(map, door[0], door[2], heightAt(map, door[0], door[2]), 0.05);
    // From the ground at the foot of the door steps; without steps from the door's own
    // outside point (it may stand in a fenced yard or an open gallery inside the footprint).
    const a = pts[0]!;
    const b = pts[1]!;
    const d = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
    const back = 0;
    const start: [number, number, number] = [a[0] - ((b[0] - a[0]) / d) * back, 0, a[2] - ((b[2] - a[2]) / d) * back];
    const w = walkIn(map, [start, ...pts], floor);
    const c: DoorCheck = { enter, def: p.def, link: li, x: door[0], z: door[2], sill: floor - ground, climb: w.climb, ok: Number.isFinite(w.climb) && Math.abs(w.y - inside[1]) < 0.3 };
    if (w.by) c.by = w.by;
    out.push(c);
  });
  return out;
}

/** Every outside door of a map. */
export function doorsOf(map: TacticalMap): DoorCheck[] {
  const out: DoorCheck[] = [];
  map.placements.forEach((p, i) => {
    if (p.span || buildingDef(p.def).exteriorOnly) return;
    out.push(...outsideDoors(map, i));
  });
  return out;
}

interface CellDoors {
  cell: number;
  buildings: number;
  doors: number;
  /** Placements with door steps, flights, and their boxes. */
  stepped: number;
  flights: number;
  boxes: number;
  /** [def, sill, climb, ok, x, z] of the doors with a sill or a climb over the step-up, or a failed walk. */
  bad: [string, number, number, boolean, number, number, string][];
  /** Sills in 0.1 m bins from -1 to 4 m (51 bins, clamped). */
  hist: number[];
  byDef: Record<string, [number, number]>;
}

function cellDoors(grid: ReturnType<typeof loadGrid>, cell: number): CellDoors {
  const map = mapFor(grid, cell);
  const doors = doorsOf(map);
  const hist = new Array<number>(51).fill(0);
  const byDef: Record<string, [number, number]> = {};
  const bad: CellDoors['bad'] = [];
  for (const d of doors) {
    hist[Math.min(50, Math.max(0, Math.round((d.sill + 1) * 10)))]!++;
    const e = (byDef[d.def] ??= [0, 0]);
    e[0]++;
    if (Math.abs(d.sill) > STEP + 1e-6 || d.climb > STEP + 1e-6 || !d.ok) {
      if (Math.abs(d.sill) > STEP + 1e-6) e[1]++;
      bad.push([d.def, d.sill, d.climb, d.ok, d.x, d.z, d.by ?? '']);
    }
  }
  const stepped = map.placements.filter((p) => p.steps).length;
  const flights = map.placements.reduce((a, p) => a + (p.steps?.length ?? 0), 0);
  const boxes = map.solids.filter((s) => s.kind === 'stair' && map.buildings[s.ref]?.enter !== undefined).length;
  return { cell, buildings: map.placements.length, doors: doors.length, stepped, flights, boxes, bad, hist, byDef };
}

if (!isMainThread && (workerData as { doors?: boolean } | null)?.doors) {
  if (workerData.before) setDoorSteps(false);
  const grid = loadGrid();
  loadRealIndexes(grid);
  const out: CellDoors[] = [];
  for (const cell of workerData.cells as number[]) out.push(cellDoors(grid, cell));
  parentPort!.postMessage(out);
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const grid = loadGrid();
  loadRealIndexes(grid);
  const arg = (name: string): string | undefined => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const cells = arg('--cells')?.split(',').map(Number) ?? grid.landIds.filter((id) => grid.cells[id]?.real?.area);
  const workers = Math.min(cells.length, Number(arg('--workers') ?? Math.max(1, availableParallelism())));
  const list = Number(arg('--list') ?? 15);
  const t0 = performance.now();
  const parts: number[][] = Array.from({ length: workers }, () => []);
  cells.forEach((c, i) => parts[i % workers]!.push(c));
  const rows = (await Promise.all(parts.map((p) => new Promise<CellDoors[]>((resolve, reject) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { doors: true, cells: p, before: process.argv.includes('--before') } });
    w.once('message', resolve);
    w.once('error', reject);
  })))).flat().sort((a, b) => a.cell - b.cell);

  const doors = rows.reduce((a, r) => a + r.doors, 0);
  const all = rows.flatMap((r) => r.bad.map((b) => ({ cell: r.cell, def: b[0], sill: b[1], climb: b[2], ok: b[3], x: b[4], z: b[5], by: b[6] })));
  const high = all.filter((b) => b.sill > STEP + 1e-6);
  const low = all.filter((b) => b.sill < -STEP - 1e-6);
  const climb = all.filter((b) => Number.isFinite(b.climb) && b.climb > STEP + 1e-6);
  const stopped = all.filter((b) => !Number.isFinite(b.climb));
  const failed = all.filter((b) => !b.ok);
  const max = (list: number[]): number => list.reduce((a, v) => Math.max(a, v), 0);
  const pct = (n: number): string => `${((100 * n) / Math.max(1, doors)).toFixed(2)}%`;
  console.log(`${rows.length} cells, ${rows.reduce((a, r) => a + r.buildings, 0)} enterable buildings, ${doors} outside doors in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  console.log(`sill over ${STEP} m (floor above the ground outside): ${high.length} (${pct(high.length)}), largest ${max(high.map((b) => b.sill)).toFixed(2)} m`);
  console.log(`ground over ${STEP} m above the floor:                ${low.length} (${pct(low.length)}), largest ${max(low.map((b) => -b.sill)).toFixed(2)} m`);
  console.log(`walk in: a single rise over ${STEP} m: ${climb.length} (${pct(climb.length)}), largest ${max(climb.map((b) => b.climb)).toFixed(2)} m; stopped by something else: ${stopped.length} (${pct(stopped.length)}); did not arrive: ${failed.length} (${pct(failed.length)})`);
  console.log(`placements with door steps: ${rows.reduce((a, r) => a + r.stepped, 0)}, flights ${rows.reduce((a, r) => a + r.flights, 0)}, step boxes ${rows.reduce((a, r) => a + r.boxes, 0)} (most in a cell: ${max(rows.map((r) => r.boxes))})`);
  console.log(`cells with a sill over ${STEP} m: ${new Set(high.map((b) => b.cell)).size}`);
  const hist = new Array<number>(51).fill(0);
  for (const r of rows) r.hist.forEach((v, i) => (hist[i]! += v));
  const band = (a: number, b: number): number => hist.reduce((s, v, i) => s + (i >= a && i <= b ? v : 0), 0);
  console.log('\n| sill (m) | doors | share |\n|---|---|---|');
  for (const [name, a, b] of [['under -0.5', 0, 4], ['-0.5 to -0.1', 5, 9], ['-0.1 to 0.3', 10, 13], ['0.3 to 0.5', 14, 15], ['0.5 to 1', 16, 20], ['1 to 2', 21, 30], ['over 2', 31, 50]] as const) {
    console.log(`| ${name} | ${band(a, b)} | ${pct(band(a, b))} |`);
  }
  const byDef: Record<string, [number, number]> = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.byDef)) {
    const e = (byDef[k] ??= [0, 0]);
    e[0] += v[0];
    e[1] += v[1];
  }
  console.log('\n| type | doors | sill over the step | share |\n|---|---|---|---|');
  for (const [k, v] of Object.entries(byDef).sort((a, b) => b[1][1] - a[1][1]).slice(0, list)) console.log(`| ${k} | ${v[0]} | ${v[1]} | ${((100 * v[1]) / v[0]).toFixed(1)}% |`);
  console.log('\nworst:');
  for (const b of [...all].sort((p, q) => Math.abs(q.sill) - Math.abs(p.sill)).slice(0, list)) console.log(`  cell ${b.cell} ${b.def} at (${b.x.toFixed(1)}, ${b.z.toFixed(1)}): sill ${b.sill.toFixed(2)} climb ${Number.isFinite(b.climb) ? b.climb.toFixed(2) : 'stopped'} ${b.ok ? '' : 'not in'}`);
  for (const why of ['own', 'other', 'tree']) {
    const list = stopped.filter((b) => b.by === why);
    const defs: Record<string, number> = {};
    for (const b of list) defs[b.def] = (defs[b.def] ?? 0) + 1;
    console.log(`stopped by ${why}: ${list.length}  ${Object.entries(defs).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
  if (stopped.length) {
    console.log('\nstopped (sample):');
    for (const b of stopped.slice(0, list)) console.log(`  cell ${b.cell} ${b.def} at (${b.x.toFixed(1)}, ${b.z.toFixed(1)}): sill ${b.sill.toFixed(2)} by ${b.by}`);
  }
  // --bad: the cells with doors that cannot be walked into, to look at them again (--cells).
  const badFile = arg('--bad');
  if (badFile) writeFileSync(badFile, `${[...new Set([...failed, ...climb].map((b) => b.cell))].join(',')}\n`);
  // The sills are what the ground is like; the walk in is what counts. Two doors are known not to be
  // walked into for other reasons than a step (PROGRESS.md 09b): anything else is a failure.
  const fresh = failed.filter((b) => !KNOWN.some((k) => k.cell === b.cell && k.def === b.def));
  console.log(`\nnot walked into: ${failed.length} (${KNOWN.length} known: ${KNOWN.map((k) => `${k.cell} ${k.def} — ${k.why}`).join('; ')})${fresh.length ? `; NEW: ${fresh.map((b) => `${b.cell} ${b.def} (${b.x.toFixed(0)}, ${b.z.toFixed(0)})`).slice(0, 20).join(', ')}` : ''}`);
  if (!process.argv.includes('--before') && fresh.length + climb.length > 0) process.exitCode = 1;
}
