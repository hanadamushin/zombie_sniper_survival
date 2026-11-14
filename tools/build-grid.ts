// Builds the static map (public/data/grid.json): ~10 km square cells over Japan with synthetic
// pre-collapse population, land class, prefecture and transport hubs.
//
// Inputs: the Natural Earth land polygon of Japan (npm `world-atlas`) and the hand-written tables in
// tools/data/ (cities, mountain ranges, hubs). Nothing is downloaded, so the result is reproducible offline.

import { fileURLToPath } from 'node:url';
import type { GridFile } from '../src/sim/world/grid.ts';
import { CITIES, PREF_NAMES, REGION_NAMES, regionOfPref } from './data/cities.ts';
import { HUBS, HUB_LINKS } from './data/hubs.ts';
import { LAKES, RIDGES } from './data/terrain.ts';
import { countryRings } from './lib/topo.ts';

const CELL_KM = 10;
const LON0 = 127.5;
const LON1 = 146.0;
const LAT_BOTTOM = 26.0;
const LAT_TOP = 45.6;
const KM_PER_LAT = 110.95;
const KM_PER_LON = Math.round(111.32 * Math.cos((36 * Math.PI) / 180) * 100) / 100;
const TOTAL_POP = 125_000_000;

/** Sub-samples per cell edge for the land test, and how many of them must be land. */
const SUB = 4;
const LAND_MIN_SAMPLES = 7;

/** Density thresholds, persons / km² (docs/02_systems_spec.md §2.1). */
const URBAN = 2000;
const SUBURB = 300;
const RURAL = 20;
/** Sparse cells above this pseudo-elevation (m) are impassable high mountains. */
const MOUNTAIN_ELEV = 1050;

export interface GridBuild {
  file: GridFile;
  /** Pseudo-elevation per grid cell (debug / preview only). */
  elev: Float32Array;
}

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise in [0, 1). */
function noise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
/** Mass of a unit 1-D Gaussian (mean m, sd s) inside [a, b]. */
const gaussMass = (a: number, b: number, m: number, s: number): number =>
  0.5 * (erf((b - m) / (s * Math.SQRT2)) - erf((a - m) / (s * Math.SQRT2)));

export function buildGrid(): GridBuild {
  const W = Math.ceil(((LON1 - LON0) * KM_PER_LON) / CELL_KM);
  const H = Math.ceil(((LAT_TOP - LAT_BOTTOM) * KM_PER_LAT) / CELL_KM);
  const N = W * H;
  const xKm = (lon: number): number => (lon - LON0) * KM_PER_LON;
  const yKm = (lat: number): number => (LAT_TOP - lat) * KM_PER_LAT;
  const cellAt = (lat: number, lon: number): number => {
    const gx = Math.floor(xKm(lon) / CELL_KM);
    const gy = Math.floor(yKm(lat) / CELL_KM);
    return gx < 0 || gy < 0 || gx >= W || gy >= H ? -1 : gy * W + gx;
  };

  // ---- land mask: scanline rasterisation of the Japan polygon at SUB x SUB samples per cell ----
  const rings = countryRings(fileURLToPath(import.meta.resolve('world-atlas/countries-10m.json')), '392')
    .map((ring) => ring.map(([lon, lat]): [number, number] => [xKm(lon) / CELL_KM, yKm(lat) / CELL_KM]));
  const samples = new Uint8Array(N);
  const xs: number[] = [];
  for (let sy = 0; sy < H * SUB; sy++) {
    const y = (sy + 0.5) / SUB;
    xs.length = 0;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[i]!;
        const [x2, y2] = ring[j]!;
        if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil(xs[k]! * SUB - 0.5));
      const to = Math.min(W * SUB - 1, Math.floor(xs[k + 1]! * SUB - 0.5));
      for (let sx = from; sx <= to; sx++) samples[Math.floor(sy / SUB) * W + Math.floor(sx / SUB)]!++;
    }
  }
  const isLand = new Uint8Array(N);
  for (let i = 0; i < N; i++) isLand[i] = samples[i]! >= LAND_MIN_SAMPLES ? 1 : 0;
  for (const [lat, lon, rNS, rEW] of LAKES) {
    for (let i = 0; i < N; i++) {
      const dx = ((i % W) + 0.5) * CELL_KM - xKm(lon);
      const dy = (Math.floor(i / W) + 0.5) * CELL_KM - yKm(lat);
      if ((dx / rEW) ** 2 + (dy / rNS) ** 2 <= 1) isLand[i] = 0;
    }
  }

  // ---- distance to the sea (km), chamfer transform ----
  const dCoast = new Float32Array(N).fill(1e6);
  for (let i = 0; i < N; i++) if (!isLand[i]) dCoast[i] = 0;
  const relax = (i: number, x: number, y: number, dx: number, dy: number): void => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
    const d = dCoast[ny * W + nx]! + (dx && dy ? 14.14 : 10);
    if (d < dCoast[i]!) dCoast[i] = d;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; relax(i, x, y, -1, 0); relax(i, x, y, 0, -1); relax(i, x, y, -1, -1); relax(i, x, y, 1, -1); }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; relax(i, x, y, 1, 0); relax(i, x, y, 0, 1); relax(i, x, y, 1, 1); relax(i, x, y, -1, 1); }

  // ---- pseudo-elevation ----
  const cities = CITIES.map((c) => ({ ...c, x: xKm(c.lon), y: yKm(c.lat) }));
  const ridges = RIDGES.map((r) => ({ ...r, p: r.pts.map(([lat, lon]): [number, number] => [xKm(lon), yKm(lat)]) }));
  const segDist = (px: number, py: number, a: [number, number], b: [number, number]): number => {
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const len2 = vx * vx + vy * vy || 1e-9;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / len2));
    return Math.hypot(px - a[0] - t * vx, py - a[1] - t * vy);
  };
  const elev = new Float32Array(N);
  /** 0..1: how much a cell is "valley floor next to a town". */
  const cityFlat = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (!isLand[i]) continue;
    const px = ((i % W) + 0.5) * CELL_KM;
    const py = (Math.floor(i / W) + 0.5) * CELL_KM;
    let flat = 0;
    for (const c of cities) {
      const r = 5 + 5 * Math.log10(c.pop / 1e4 + 1);
      const d2 = (px - c.x) ** 2 + (py - c.y) ** 2;
      if (d2 < r * r * 9) flat = Math.max(flat, Math.exp(-d2 / (2 * r * r)));
    }
    cityFlat[i] = flat;
    let ridge = 0;
    for (const r of ridges) {
      let d = Infinity;
      for (let k = 0; k + 1 < r.p.length; k++) d = Math.min(d, segDist(px, py, r.p[k]!, r.p[k + 1]!));
      ridge = Math.max(ridge, r.h * Math.exp(-(d * d) / (2 * r.w * r.w)));
    }
    const n = noise(px / 45, py / 45, 11) * 0.65 + noise(px / 17, py / 17, 23) * 0.35;
    const base = Math.min(650, 14 * dCoast[i]!) * (0.55 + 0.9 * n);
    elev[i] = Math.max(ridge * (0.8 + 0.4 * n), base) * (1 - 0.8 * flat);
  }

  // ---- population ----
  const pop = new Float64Array(N);
  const spread = (c: (typeof cities)[number], amount: number, sigma: number): void => {
    const reach = Math.ceil((sigma * 3.5) / CELL_KM) + 1;
    const cx = Math.floor(c.x / CELL_KM);
    const cy = Math.floor(c.y / CELL_KM);
    const targets: [number, number][] = [];
    let total = 0;
    for (let gy = cy - reach; gy <= cy + reach; gy++) {
      for (let gx = cx - reach; gx <= cx + reach; gx++) {
        if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue;
        const i = gy * W + gx;
        if (!isLand[i]) continue;
        const m = gaussMass(gx * CELL_KM, (gx + 1) * CELL_KM, c.x, sigma) * gaussMass(gy * CELL_KM, (gy + 1) * CELL_KM, c.y, sigma);
        const w = m * Math.exp(-elev[i]! / 500) * (samples[i]! / (SUB * SUB));
        if (w > 0) { targets.push([i, w]); total += w; }
      }
    }
    if (total <= 0) {
      // A town on an islet too small for the land mask: drop it onto the nearest land cell.
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < N; i++) {
        if (!isLand[i]) continue;
        const d = (((i % W) + 0.5) * CELL_KM - c.x) ** 2 + ((Math.floor(i / W) + 0.5) * CELL_KM - c.y) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      pop[best]! += amount;
      return;
    }
    for (const [i, w] of targets) pop[i]! += (amount * w) / total;
  };
  let cityTotal = 0;
  for (const c of cities) {
    const sigma = Math.max(1.5, 0.9 * (c.pop / 1e4) ** 0.35);
    spread(c, c.pop * 0.65, sigma);
    spread(c, c.pop * 0.35, sigma * 3 + 3);
    cityTotal += c.pop;
  }
  // The rest of the country lives thinly on low ground, denser around towns.
  const ruralW = new Float64Array(N);
  let ruralTotal = 0;
  for (let i = 0; i < N; i++) {
    if (!isLand[i]) continue;
    const px = ((i % W) + 0.5) * CELL_KM;
    const py = (Math.floor(i / W) + 0.5) * CELL_KM;
    let near = 0;
    for (const c of cities) {
      const d2 = (px - c.x) ** 2 + (py - c.y) ** 2;
      if (d2 < 70 * 70) near += Math.sqrt(c.pop / 1e5) * Math.exp(-d2 / (2 * 20 * 20));
    }
    const lat = LAT_TOP - py / KM_PER_LAT;
    const w = Math.exp(-elev[i]! / 220) * (0.2 + Math.min(3, near)) * (lat > 41.4 ? 0.45 : 1) * (samples[i]! / (SUB * SUB));
    ruralW[i] = w;
    ruralTotal += w;
  }
  const rest = Math.max(0, TOTAL_POP - cityTotal);
  for (let i = 0; i < N; i++) if (isLand[i]) pop[i]! += (rest * ruralW[i]!) / ruralTotal;

  // ---- assemble land cells ----
  const landIds: number[] = [];
  for (let i = 0; i < N; i++) if (isLand[i]) landIds.push(i);
  // Largest-remainder rounding keeps the national total exact.
  const scale = TOTAL_POP / landIds.reduce((s, i) => s + pop[i]!, 0);
  const popInt = landIds.map((i) => Math.floor(pop[i]! * scale));
  const order = landIds.map((i, k) => [pop[i]! * scale - popInt[k]!, k] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0, missing = TOTAL_POP - popInt.reduce((s, v) => s + v, 0); k < missing; k++) popInt[order[k]![1]]!++;

  const land = landIds.map((i, k) => {
    const density = popInt[k]! / (CELL_KM * CELL_KM);
    if (density >= URBAN) return 0;
    if (density >= SUBURB) return 1;
    if (density >= RURAL) return 2;
    return elev[i]! >= MOUNTAIN_ELEV ? 4 : 3;
  });
  const coast = landIds.map((i) => {
    const x = i % W;
    const y = Math.floor(i / W);
    const sea = (nx: number, ny: number): boolean => nx < 0 || ny < 0 || nx >= W || ny >= H || !isLand[ny * W + nx];
    return sea(x - 1, y) || sea(x + 1, y) || sea(x, y - 1) || sea(x, y + 1) ? 1 : 0;
  });

  // ---- prefectures: grow outwards over land from every town (islands without a town: nearest town) ----
  const prefOf = new Int16Array(N);
  const dist = new Float32Array(N).fill(Infinity);
  const queue: number[] = [];
  const placeOf = new Map<number, { name: string; pop: number }>();
  for (const c of cities) {
    let cell = cellAt(c.lat, c.lon);
    if (cell < 0 || !isLand[cell]) {
      let bestD = Infinity;
      for (const i of landIds) {
        const d = (((i % W) + 0.5) * CELL_KM - c.x) ** 2 + ((Math.floor(i / W) + 0.5) * CELL_KM - c.y) ** 2;
        if (d < bestD) { bestD = d; cell = i; }
      }
      if (bestD > 30 * 30) continue;
    }
    const prev = placeOf.get(cell);
    if (!prev || prev.pop < c.pop) placeOf.set(cell, { name: c.name, pop: c.pop });
    if (dist[cell] === Infinity) queue.push(cell);
    if (!prev || prev.pop < c.pop) prefOf[cell] = c.pref;
    dist[cell] = 0;
  }
  // Dijkstra with a simple array heap substitute (grid is small): repeated relaxation sweeps.
  for (let changed = true; changed; ) {
    changed = false;
    for (const pass of [0, 1]) {
      for (let k = 0; k < landIds.length; k++) {
        const i = landIds[pass ? landIds.length - 1 - k : k]!;
        const x = i % W;
        const y = Math.floor(i / W);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = ny * W + nx;
            if (!isLand[j] || dist[j] === Infinity) continue;
            const d = dist[j]! + (dx && dy ? 1.414 : 1) * (1 + elev[i]! / 600);
            if (d < dist[i]! - 1e-6) { dist[i] = d; prefOf[i] = prefOf[j]!; changed = true; }
          }
        }
      }
    }
  }
  for (const i of landIds) {
    if (prefOf[i]) continue;
    let bestD = Infinity;
    for (const c of cities) {
      const d = (((i % W) + 0.5) * CELL_KM - c.x) ** 2 + ((Math.floor(i / W) + 0.5) * CELL_KM - c.y) ** 2;
      if (d < bestD) { bestD = d; prefOf[i] = c.pref; }
    }
  }
  // Hokkaido is an island of its own.
  for (const i of landIds) {
    const lat = LAT_TOP - ((Math.floor(i / W) + 0.5) * CELL_KM) / KM_PER_LAT;
    if (lat > 41.35 && prefOf[i] !== 1) prefOf[i] = 1;
  }

  // ---- hubs ----
  const hubCells: number[] = [];
  const hubs: GridFile['hubs'] = [];
  const hubIndexByName = new Map<string, number>();
  for (const def of HUBS) {
    let cell = cellAt(def.lat, def.lon);
    if (cell < 0 || !isLand[cell]) {
      let bestD = Infinity;
      for (const i of landIds) {
        const d = (((i % W) + 0.5) * CELL_KM - xKm(def.lon)) ** 2 + ((Math.floor(i / W) + 0.5) * CELL_KM - yKm(def.lat)) ** 2;
        if (d < bestD) { bestD = d; cell = i; }
      }
    }
    let idx = hubCells.indexOf(cell);
    if (idx < 0) {
      idx = hubs.length;
      hubCells.push(cell);
      hubs.push({ name: def.name, cell });
    } else if (!hubs[idx]!.name.includes(def.name)) {
      hubs[idx]!.name += `・${def.name}`;
    }
    if (def.intl) hubs[idx]!.intl = def.intl;
    hubIndexByName.set(def.name, idx);
  }
  const linkKeys = new Set<string>();
  const links: [number, number][] = [];
  for (const [a, b] of HUB_LINKS) {
    const ia = hubIndexByName.get(a);
    const ib = hubIndexByName.get(b);
    if (ia === undefined || ib === undefined) throw new Error(`unknown hub in link ${a} - ${b}`);
    if (ia === ib) continue;
    const key = ia < ib ? `${ia}-${ib}` : `${ib}-${ia}`;
    if (linkKeys.has(key)) continue;
    linkKeys.add(key);
    links.push(ia < ib ? [ia, ib] : [ib, ia]);
  }

  const file: GridFile = {
    v: 1,
    w: W,
    h: H,
    cellKm: CELL_KM,
    proj: { lon0: LON0, latTop: LAT_TOP, kmPerLon: KM_PER_LON, kmPerLat: KM_PER_LAT },
    ids: landIds.map((id, k) => (k === 0 ? id : id - landIds[k - 1]!)),
    pop: popInt,
    land: land.join(''),
    coast: coast.join(''),
    pref: landIds.map((i) => prefOf[i]!),
    prefNames: PREF_NAMES,
    regionNames: REGION_NAMES,
    prefRegion: PREF_NAMES.map((_, p) => regionOfPref(p)),
    hubs,
    links,
    places: [...placeOf.entries()].sort((a, b) => a[0] - b[0]).map(([cell, p]) => [p.name, cell]),
  };
  return { file, elev };
}
