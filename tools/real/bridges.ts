// L10: the ordinary bridges of the real areas (docs/realmap_guide.md §7, L10):
//   node tools/real/bridges.ts [--count] [--cells id,id]
// Reads every area file (public/data/areas/), joins the bridge stretches of the roads (LINE_BRIDGE)
// and the railways (all of them: their bridges are often unmarked) across the cells' edges, and keeps those that cross water at least
// REAL_BRIDGES.minWater wide (the narrowest chord of the water through the crossing's middle). Each
// becomes a girder bridge from bank to bank: its line in latitude / longitude, the ground's height at
// both ends and the water's surface — written to src/data/bridges/ordinary.ts, which the area
// generator reads (gen/real/bridges.ts). Both areas of a bridge on a cell's edge read the same row, so
// they build the same deck. Run it again after the area data are rebuilt (tests/bridges.test.ts checks
// that the table still matches the area files).
import { writeFileSync } from 'node:fs';
import { LANDMARK_GRID, LANDMARKS } from '../../src/data/landmarks/index.ts';
import { REAL_BRIDGES } from '../../src/data/realmap.ts';
import { LINE, LINE_BRIDGE, LINE_TUNNEL, type RealArea } from '../../src/gen/real/format.ts';
import { realTerrain, realWaterLevels } from '../../src/gen/real/layout.ts';
import { N, SIZE, TILE } from '../../src/gen/builder.ts';
import { loadGrid, loadRealIndexes, readRealArea } from './lib/game.ts';
import { realRegionOf } from '../../src/sim/world/realAreas.ts';
import { LINE_KIND_RAIL } from '../../src/data/bridges/types.ts';

const G = LANDMARK_GRID;
const W = G.gridW;
const B = REAL_BRIDGES;

type P = [number, number];
interface Piece {
  kind: number;
  width: number;
  pts: P[];
}

/** Global plan point (m of the shrunk map from the grid's north-west corner) → latitude, longitude. */
export function globalToReal(X: number, Z: number): [number, number] {
  const lat = G.latTop - ((Z / SIZE) * G.cellKm) / G.kmPerLat;
  const lon = G.lon0 + ((X / SIZE) * G.cellKm) / G.kmPerLon;
  return [Math.round(lat * 1e6) / 1e6, Math.round(lon * 1e6) / 1e6];
}
export function realToGlobal(lat: number, lon: number): P {
  return [(((lon - G.lon0) * G.kmPerLon) / G.cellKm) * SIZE, (((G.latTop - lat) * G.kmPerLat) / G.cellKm) * SIZE];
}

const grid = loadGrid();
loadRealIndexes(grid);

/** Wet vertices of every cell (a bit per height vertex), and the areas decoded (kept for the ends). */
const wet = new Map<number, Uint8Array>();
const areaCache = new Map<number, RealArea>();
function areaOf(cell: number): RealArea | null {
  let a = areaCache.get(cell);
  if (!a) {
    const r = readRealArea(cell);
    if (!r) return null;
    a = r;
    areaCache.set(cell, a);
    if (areaCache.size > 64) areaCache.delete(areaCache.keys().next().value!);
  }
  return a;
}
const levels = new Map<number, Float32Array>();
function levelsOf(cell: number): Float32Array | null {
  let l = levels.get(cell);
  if (!l) {
    const a = areaOf(cell);
    if (!a) return null;
    l = realWaterLevels(a, false);
    levels.set(cell, l);
    if (levels.size > 64) levels.delete(levels.keys().next().value!);
  }
  return l;
}

/** True where the nearest height vertex of the cell under (X, Z) is water. */
function wetAt(X: number, Z: number): boolean {
  const gx = Math.floor(X / SIZE);
  const gy = Math.floor(Z / SIZE);
  const w = wet.get(gy * W + gx);
  if (!w) return false;
  const ix = Math.min(N - 1, Math.max(0, Math.round((X - gx * SIZE) / TILE)));
  const iz = Math.min(N - 1, Math.max(0, Math.round((Z - gy * SIZE) / TILE)));
  const k = iz * N + ix;
  return (w[k >> 3]! & (1 << (k & 7))) !== 0;
}
function levelAt(X: number, Z: number): number {
  const gx = Math.floor(X / SIZE);
  const gy = Math.floor(Z / SIZE);
  const l = levelsOf(gy * W + gx);
  if (!l) return NaN;
  const ix = Math.min(N - 1, Math.max(0, Math.round((X - gx * SIZE) / TILE)));
  const iz = Math.min(N - 1, Math.max(0, Math.round((Z - gy * SIZE) / TILE)));
  return l[iz * N + ix]!;
}
/** The ground's height (the lattice and its little noise; seed-independent part only) at a point. */
const terrains = new Map<number, (x: number, z: number) => number>();
function groundAt(X: number, Z: number): number {
  const gx = Math.min(W - 1, Math.floor(X / SIZE));
  const gy = Math.floor(Z / SIZE);
  const cell = gy * W + gx;
  let t = terrains.get(cell);
  if (!t) {
    const a = areaOf(cell);
    if (!a) return NaN;
    t = realTerrain({ mapSeed: 0, land: 'urban', isHome: false, lootSpots: 0 } as never, a, null);
    terrains.set(cell, t);
    if (terrains.size > 64) terrains.delete(terrains.keys().next().value!);
  }
  return t(X - gx * SIZE, Z - gy * SIZE);
}

function collect(cells: number[]): Piece[] {
  const pieces: Piece[] = [];
  for (const cell of cells) {
    const a = readRealArea(cell);
    if (!a) continue;
    const lv = realWaterLevels(a, false);
    const bits = new Uint8Array(Math.ceil((N * N) / 8));
    for (let k = 0; k < N * N; k++) if (Number.isFinite(lv[k]!)) bits[k >> 3]! |= 1 << (k & 7);
    wet.set(cell, bits);
    const ox = (cell % W) * SIZE;
    const oz = Math.floor(cell / W) * SIZE;
    for (const line of a.lines) {
      // A road's bridge stretches; a railway whole (its bridges are often not marked at zoom 13 — the
      // Kiso, the Tone at Toride —, and a railway never crosses 30 m of water on an embankment).
      const rail = line.kind === LINE.rail || line.kind === LINE.shinkansen;
      if ((!(line.flags & LINE_BRIDGE) && !rail) || line.flags & LINE_TUNNEL || line.kind === LINE.river) continue;
      const pts: P[] = [];
      for (let k = 0; k < line.pts.length; k += 2) pts.push([line.pts[k]! + ox, line.pts[k + 1]! + oz]);
      if (pts.length >= 2) pieces.push({ kind: line.kind === LINE.shinkansen ? LINE.rail : line.kind, width: line.width, pts });
    }
  }
  return pieces;
}

/** Join pieces of the same kind and width that meet end to end (across the cells' edges). */
function join(pieces: Piece[]): Piece[] {
  const key = (p: P, q: Piece): string => `${q.kind}:${q.width}:${Math.round(p[0] * 2)}:${Math.round(p[1] * 2)}`;
  const ends = new Map<string, number[]>();
  pieces.forEach((q, i) => {
    for (const p of [q.pts[0]!, q.pts[q.pts.length - 1]!]) {
      const k = key(p, q);
      const l = ends.get(k);
      if (l) l.push(i);
      else ends.set(k, [i]);
    }
  });
  const used = new Uint8Array(pieces.length);
  const out: Piece[] = [];
  const other = (k: string, i: number): number => (ends.get(k) ?? []).find((j) => j !== i && !used[j]) ?? -1;
  pieces.forEach((q, i) => {
    if (used[i]) return;
    used[i] = 1;
    const pts = [...q.pts];
    // Grow at the end, then at the start.
    for (const atEnd of [true, false]) {
      for (;;) {
        const p = atEnd ? pts[pts.length - 1]! : pts[0]!;
        const j = other(key(p, q), -1);
        if (j < 0) break;
        used[j] = 1;
        const r = pieces[j]!.pts;
        const startsHere = Math.hypot(r[0]![0] - p[0], r[0]![1] - p[1]) < 0.6;
        if (atEnd) pts.push(...(startsHere ? r : [...r].reverse()).slice(1));
        else pts.unshift(...(startsHere ? [...r].reverse() : r).slice(0, -1));
      }
    }
    out.push({ kind: q.kind, width: q.width, pts });
  });
  return out;
}

export interface Crossing {
  kind: number;
  width: number;
  /** The water's narrowest chord through the middle (m) and the run along the line (m). */
  chord: number;
  run: number;
  /** Dense points of the line (1 m apart) and the water's run on them. */
  dense: P[];
  a: number;
  b: number;
}

/** Narrowest chord of the water through (X, Z) over 12 directions (m, capped at `cap`). */
function chordAt(X: number, Z: number, cap: number): number {
  let best = Infinity;
  for (let k = 0; k < 12; k++) {
    const t = (k * Math.PI) / 12;
    const dx = Math.cos(t);
    const dz = Math.sin(t);
    let len = 0;
    for (const dir of [-1, 1]) {
      let s = 1;
      while (s < cap && wetAt(X + dx * dir * s, Z + dz * dir * s)) s += 1;
      len += s;
    }
    best = Math.min(best, len);
  }
  return best;
}

function crossingsOf(line: Piece): Crossing[] {
  const dense: P[] = [];
  for (let k = 0; k + 1 < line.pts.length; k++) {
    const [ax, az] = line.pts[k]!;
    const [bx, bz] = line.pts[k + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len));
    for (let i = 0; i < n; i++) dense.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
  }
  dense.push(line.pts[line.pts.length - 1]!);
  const wetS = dense.map((p) => wetAt(p[0], p[1]));
  // Runs of water, joined over short dry gaps (a sandbar, a pier's island).
  const runs: [number, number][] = [];
  let i = 0;
  while (i < dense.length) {
    if (!wetS[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < dense.length && wetS[j + 1]) j++;
    const last = runs[runs.length - 1];
    if (last && i - last[1] <= B.joinGap) last[1] = j;
    else runs.push([i, j]);
    i = j + 1;
  }
  const out: Crossing[] = [];
  for (const [a, b] of runs) {
    const run = b - a;
    if (run < B.minWater) continue;
    const m = dense[Math.floor((a + b) / 2)]!;
    const chord = chordAt(m[0], m[1], 400);
    if (chord < B.minWater) continue;
    out.push({ kind: line.kind, width: line.width, chord, run, dense, a, b });
  }
  return out;
}

/** Douglas–Peucker. */
function simplify(pts: P[], tol: number): P[] {
  if (pts.length <= 2) return pts;
  const [ax, az] = pts[0]!;
  const [bx, bz] = pts[pts.length - 1]!;
  const len = Math.hypot(bx - ax, bz - az) || 1;
  let worst = 0;
  let wi = 0;
  for (let i = 1; i + 1 < pts.length; i++) {
    const d = Math.abs((pts[i]![0] - ax) * (bz - az) - (pts[i]![1] - az) * (bx - ax)) / len;
    if (d > worst) {
      worst = d;
      wi = i;
    }
  }
  if (worst <= tol) return [pts[0]!, pts[pts.length - 1]!];
  return [...simplify(pts.slice(0, wi + 1), tol).slice(0, -1), ...simplify(pts.slice(wi), tol)];
}

export interface Planned {
  kind: number;
  width: number;
  /** Half-width of the band where the area's lines along the deck are cut. */
  cut: number;
  rails: number[];
  ends: [number, number];
  water: number;
  path: P[];
  chord: number;
  run: number;
}

/**
 * The bridge from bank to bank: the water's run on the line, run on over the land on both sides until
 * the deck's ramp (REAL_BRIDGES.slope) reaches `clear` over the water from the ground there.
 */
function plan(c: Crossing): Planned | null {
  const { dense, a, b } = c;
  let water = -Infinity;
  for (let i = a; i <= b; i++) {
    const l = levelAt(dense[i]![0], dense[i]![1]);
    if (Number.isFinite(l)) water = Math.max(water, l);
  }
  if (!Number.isFinite(water)) return null;
  const top = water + B.clear;
  // A point `e` m out beyond an end of the run (along the line, then straight on).
  const out = (end: number, dir: 1 | -1, e: number): P => {
    const k = end + dir * e;
    if (k >= 0 && k < dense.length) return dense[k]!;
    const last = dir > 0 ? dense.length - 1 : 0;
    const prev = dense[Math.min(dense.length - 1, Math.max(0, last - dir * 3))]!;
    const p = dense[last]!;
    const len = Math.hypot(p[0] - prev[0], p[1] - prev[1]) || 1;
    const over = Math.abs(k - last);
    return [p[0] + ((p[0] - prev[0]) / len) * over, p[1] + ((p[1] - prev[1]) / len) * over];
  };
  const reach = (end: number, dir: 1 | -1): { e: number; h: number } | null => {
    let lastDry: { e: number; h: number } | null = null;
    for (let e = 3; e <= B.rampMax; e++) {
      const p = out(end, dir, e);
      if (wetAt(p[0], p[1])) {
        if (lastDry) return lastDry; // water again: end on the dry strip before it
        continue;
      }
      const h = groundAt(p[0], p[1]);
      if (!Number.isFinite(h)) return lastDry;
      lastDry = { e, h };
      if (e >= 4 && h + B.slope * (e - 2) >= top) return lastDry;
    }
    return lastDry;
  };
  const r0 = reach(a, -1);
  const r1 = reach(b, 1);
  if (!r0 || !r1) return null;
  const pts: P[] = [];
  for (let e = r0.e; e >= 1; e--) pts.push(out(a, -1, e));
  for (let i = a; i <= b; i++) pts.push(dense[i]!);
  for (let e = 1; e <= r1.e; e++) pts.push(out(b, 1, e));
  const path = simplify(pts, 0.4).map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10] as P);
  const rail = c.kind === LINE.rail;
  const width = rail ? c.width + 1 : c.width + 1.2;
  const rails = rail ? (c.width >= 8 ? [-1.9, 1.9] : [0]) : [];
  return { kind: rail ? LINE_KIND_RAIL : 0, width, cut: width / 2 + 3, rails, ends: [round2(Math.max(r0.h, water + 0.3)), round2(Math.max(r1.h, water + 0.3))], water: round2(water), path, chord: c.chord, run: c.run };
}
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Distance from (x, z) to a polyline, the tangent there. */
function near(path: P[], x: number, z: number): { d: number; tx: number; tz: number; off: number } {
  let best = { d: Infinity, tx: 1, tz: 0, off: 0 };
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, az] = path[i]!;
    const [bx, bz] = path[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const tx = (bx - ax) / len;
    const tz = (bz - az) / len;
    const u = Math.min(len, Math.max(0, (x - ax) * tx + (z - az) * tz));
    const d = Math.hypot(x - ax - tx * u, z - az - tz * u);
    if (d < best.d) best = { d, tx, tz, off: (x - ax) * tz - (z - az) * tx };
  }
  return best;
}

/**
 * The bridges kept: widest first; one that runs alongside a kept one closer than both decks' half
 * widths is carried on the kept deck (its band is cut, a railway's tracks are laid on the deck);
 * one that crosses a kept one or a bridge landmark is left an embankment.
 */
function choose(all: Planned[], landmarks: P[][]): Planned[] {
  const order = [...all].sort((p, q) => q.width - p.width || p.kind - q.kind || q.run - p.run);
  const kept: Planned[] = [];
  for (const c of order) {
    // Samples over the middle 60 % of the bridge.
    const f = pathLen(c.path);
    const samples: { x: number; z: number; tx: number; tz: number }[] = [];
    for (let u = 0.2; u <= 0.8001; u += 0.05) samples.push(pointAt(c.path, f * u));
    // Nowhere near a bridge landmark (its ramps neither: they would change the ground at its ends).
    const whole: { x: number; z: number }[] = [];
    for (let u = 0; u <= 1.0001; u += 0.05) whole.push(pointAt(c.path, f * Math.min(1, u)));
    if (landmarks.some((l) => whole.some((p) => near(l, p.x, p.z).d < 40))) continue;
    let absorbed = false;
    let crossed = false;
    for (const k of kept) {
      const hits = samples.map((p) => ({ p, q: near(k.path, p.x, p.z) })).filter(({ q }) => q.d < k.width / 2 + c.width / 2 + 1);
      if (hits.length === 0) continue;
      const parallel = hits.every(({ p, q }) => Math.abs(p.tx * q.tx + p.tz * q.tz) > 0.8);
      if (parallel && hits.length >= samples.length * 0.5) {
        const off = hits.reduce((s, h) => s + h.q.off, 0) / hits.length;
        const hw = Math.max(k.width / 2, Math.abs(off) + c.width / 2);
        k.cut = Math.max(k.cut, Math.abs(off) + c.width / 2 + 3);
        // Widened (both sides: the deck stays on its line) only where it overlaps no other kept bridge.
        const kf = pathLen(k.path);
        const ks: { x: number; z: number }[] = [];
        for (let u = 0.1; u <= 0.9001; u += 0.05) ks.push(pointAt(k.path, kf * u));
        const clear = kept.every((o) => o === k || ks.every((p) => near(o.path, p.x, p.z).d >= hw + o.width / 2 + 0.5));
        if (hw <= k.width / 2 + B.widenMax && clear) k.width = Math.round(2 * hw * 10) / 10;
        if (c.kind === LINE_KIND_RAIL) {
          for (const r of c.rails) {
            const o = Math.round((-off + r) * 10) / 10;
            // On the deck, and not on top of a track already there (the same railway drawn twice).
            if (Math.abs(o) + 1.5 <= k.width / 2 && k.rails.every((q) => Math.abs(q - o) >= 3)) k.rails.push(o);
          }
        }
        absorbed = true;
      } else crossed = true;
      break;
    }
    if (!absorbed && !crossed) kept.push(c);
  }
  return kept;
}
function pathLen(path: P[]): number {
  let s = 0;
  for (let i = 0; i + 1 < path.length; i++) s += Math.hypot(path[i + 1]![0] - path[i]![0], path[i + 1]![1] - path[i]![1]);
  return s;
}
function pointAt(path: P[], s: number): { x: number; z: number; tx: number; tz: number } {
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, az] = path[i]!;
    const [bx, bz] = path[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    if (s <= len || i + 2 === path.length) {
      const u = Math.min(len, s);
      return { x: ax + ((bx - ax) * u) / len, z: az + ((bz - az) * u) / len, tx: (bx - ax) / len, tz: (bz - az) / len };
    }
    s -= len;
  }
  return { x: path[0]![0], z: path[0]![1], tx: 1, tz: 0 };
}

/** Cells (with area data) a path runs through. */
function cellsOf(path: P[]): number[] {
  const out = new Set<number>();
  const f = pathLen(path);
  for (let s = 0; s <= f + 0.01; s += 4) {
    const p = pointAt(path, Math.min(s, f));
    out.add(Math.floor(p.z / SIZE) * W + Math.floor(p.x / SIZE));
  }
  return [...out].filter((c) => realRegionOf(c));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name: string): string | undefined => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const all = grid.landIds.filter((id) => realRegionOf(id));
  const cells = arg('--cells')?.split(',').map(Number) ?? all;
  const t0 = performance.now();
  const pieces = collect(cells);
  const lines = join(pieces);
  console.log(`${cells.length} cells, ${pieces.length} bridge pieces, ${lines.length} joined lines (${Math.round(performance.now() - t0)} ms)`);
  const xs = lines.flatMap(crossingsOf);
  const planned = xs.map(plan).filter((p): p is Planned => p !== null);
  const landmarks = LANDMARKS.filter((s) => s.bridge).map((s) => s.bridge!.path.map(([la, lo]) => realToGlobal(la, lo)));
  const kept = choose(planned, landmarks);
  kept.sort((p, q) => p.path[0]![1] - q.path[0]![1] || p.path[0]![0] - q.path[0]![0]);
  const perCell = new Map<number, number>();
  let edge = 0;
  for (const k of kept) {
    const cs = cellsOf(k.path);
    if (cs.length > 1) edge++;
    for (const c of cs) perCell.set(c, (perCell.get(c) ?? 0) + 1);
  }
  const lens = kept.map((k) => pathLen(k.path)).sort((p, q) => p - q);
  console.log(`crossings over ${B.minWater} m: ${xs.length}, planned ${planned.length}, kept ${kept.length} (roads ${kept.filter((k) => k.kind === 0).length}, railways ${kept.filter((k) => k.kind === LINE_KIND_RAIL).length}), on an edge ${edge}`);
  console.log(`length m: median ${lens[Math.floor(lens.length / 2)]!.toFixed(0)}, p90 ${lens[Math.floor(lens.length * 0.9)]!.toFixed(0)}, max ${lens[lens.length - 1]!.toFixed(0)}; total ${(lens.reduce((p, q) => p + q, 0) / 1000).toFixed(1)} km`);
  console.log('cells with most', [...perCell].sort((p, q) => q[1] - p[1]).slice(0, 12));
  if (!process.argv.includes('--count')) {
    const rows = kept.map((k) => {
      const flat = k.path.flatMap((p) => p);
      const r = k.rails.length ? `, r: [${k.rails.join(', ')}]` : '';
      return `  { k: ${k.kind}, w: ${k.width}, c: ${Math.round(k.cut * 10) / 10}, e: [${k.ends[0]}, ${k.ends[1]}], l: ${k.water}${r}, p: [${flat.join(', ')}] },`;
    });
    const src = `// L10: GENERATED by tools/real/bridges.ts from the area files (public/data/areas/) — do not edit.
// The ordinary bridges of the real areas: the bridge stretches of the roads and railways over water at
// least REAL_BRIDGES.minWater wide. k: 0 road / 1 railway, w: deck width, c: half-width of the band
// where the area's lines along it are cut, e: the deck's height at both ends (the ground there), l: the
// water's surface, r: rail tracks (offsets), p: the line from bank to bank (x, z pairs: shrunk metres
// from the strategic grid's north-west corner, cell = floor(z / 1024) × 167 + floor(x / 1024)).
import type { OrdinaryBridgeRow } from './types.ts';

export const ORDINARY_BRIDGES: readonly OrdinaryBridgeRow[] = [
${rows.join('\n')}
];
`;
    writeFileSync(new URL('../../src/data/bridges/ordinary.ts', import.meta.url), src);
    console.log(`wrote ${kept.length} rows`);
  }
}
