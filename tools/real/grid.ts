// R0: the static strategic map (public/data/grid.json) from real open data. Replaces the
// synthetic tools/build-grid.ts (kept for reference / offline fallback: `npm run data -- --synthetic`).
//
// Cells, their numbering and the projection are unchanged (10 km squares over an equirectangular
// grid, tools/build-grid.ts). What fills them is now measured:
//   - land / sea and elevation   GSI elevation tiles (DEM10B, zoom 10, about 125 m pixels)
//   - population (pop0)          e-Stat, 2020 census, 1 km mesh
//   - prefecture, municipality   KSJ N03 administrative areas (2024-01-01)
//   - town grade, place names    N03 (city / town / village, ordinance-designated cities, capitals) and P05 (town halls)
//   - stations                   KSJ S12 passengers per station (grade from the daily passengers)
//   - airports                   KSJ C28
//   - schools, hospitals         KSJ P29 (2023), P04 (2020)
//   - police, fire               estimated from population here; the region builds (tools/real/region.ts)
//                                count them from the GSI map annotations and the game reads those
//   - hubs                       the hub table (tools/data/hubs.ts) snapped to the real Shinkansen
//                                stations (N02) and airports (C28)
//
// All downloads go through tools/real/lib/fetch.ts (tmp/realdata/ cache, 5 requests / s at most).

import { fileURLToPath } from 'node:url';
import type { GridFile } from '../../src/sim/world/grid.ts';
import { PREF_NAMES, REGION_NAMES } from '../data/cities.ts';
import { HUBS, HUB_LINKS } from '../data/hubs.ts';
import { SEA_LINKS } from '../data/sealinks.ts';
import { LAKES } from '../data/terrain.ts';
import { countryRings } from '../lib/topo.ts';
import { demAt, demTile } from './lib/dem.ts';
import { mapLimit } from './lib/fetch.ts';
import { estatPopulation, ksjZip, mesh3Center, shpLayer } from './lib/ksj.ts';
import { PREF_CAPITALS, regionOfPref } from './lib/regions.ts';
import { lonToX, latToY } from './lib/tiles.ts';
import { readZip } from './lib/zip.ts';
import { REAL_GRID } from '../../src/data/realmap.ts';

const CELL_KM = 10;
const LON0 = 127.5;
const LON1 = 146.0;
const LAT_BOTTOM = 26.0;
const LAT_TOP = 45.6;
const KM_PER_LAT = 110.95;
const KM_PER_LON = Math.round(111.32 * Math.cos((36 * Math.PI) / 180) * 100) / 100;
/** Sub-cells per cell edge for boundaries (1 km). */
const SUBN = 10;
const DEM_Z = 10;

export interface RealGridBuild {
  file: GridFile;
  elev: Float32Array;
  log: string[];
}

export async function buildRealGrid(): Promise<RealGridBuild> {
  const log: string[] = [];
  const say = (s: string): void => {
    log.push(s);
    console.log(`[grid] ${s}`);
  };
  const W = Math.ceil(((LON1 - LON0) * KM_PER_LON) / CELL_KM);
  const H = Math.ceil(((LAT_TOP - LAT_BOTTOM) * KM_PER_LAT) / CELL_KM);
  const N = W * H;
  const lonOf = (xKm: number): number => LON0 + xKm / KM_PER_LON;
  const latOf = (yKm: number): number => LAT_TOP - yKm / KM_PER_LAT;
  const xKm = (lon: number): number => (lon - LON0) * KM_PER_LON;
  const yKm = (lat: number): number => (LAT_TOP - lat) * KM_PER_LAT;
  const cellAt = (lat: number, lon: number): number => {
    const gx = Math.floor(xKm(lon) / CELL_KM);
    const gy = Math.floor(yKm(lat) / CELL_KM);
    return gx < 0 || gy < 0 || gx >= W || gy >= H ? -1 : gy * W + gx;
  };
  const subAt = (lat: number, lon: number): number => {
    const sx = Math.floor((xKm(lon) / CELL_KM) * SUBN);
    const sy = Math.floor((yKm(lat) / CELL_KM) * SUBN);
    return sx < 0 || sy < 0 || sx >= W * SUBN || sy >= H * SUBN ? -1 : sy * W * SUBN + sx;
  };

  // ---- candidate cells: anything the coarse Natural Earth outline touches, grown by one ----
  const rings = countryRings(fileURLToPath(import.meta.resolve('world-atlas/countries-10m.json')), '392');
  const near = new Uint8Array(N);
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      const c = cellAt(lat, lon);
      if (c >= 0) near[c] = 1;
    }
  }
  // fill interiors by scanline at the cell centres
  for (let gy = 0; gy < H; gy++) {
    const y = gy + 0.5;
    const xs: number[] = [];
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const y1 = yKm(ring[i]![1]) / CELL_KM;
        const y2 = yKm(ring[j]![1]) / CELL_KM;
        if (y1 > y !== y2 > y) {
          const x1 = xKm(ring[i]![0]) / CELL_KM;
          const x2 = xKm(ring[j]![0]) / CELL_KM;
          xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let gx = Math.max(0, Math.ceil(xs[k]! - 0.5)); gx <= Math.min(W - 1, Math.floor(xs[k + 1]! - 0.5)); gx++) near[gy * W + gx] = 1;
  }
  const cand = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!near[i]) continue;
    const x = i % W;
    const y = Math.floor(i / W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) cand[ny * W + nx] = 1;
    }
  }
  const candIds = [...cand.keys()].filter((i) => cand[i]);
  say(`candidate cells ${candIds.length}`);

  // ---- elevation tiles over the candidates ----
  const tileSet = new Set<string>();
  const S = REAL_GRID.elevSamples;
  for (const i of candIds) {
    const gx = i % W;
    const gy = Math.floor(i / W);
    for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]] as const) {
      const lon = lonOf((gx + fx) * CELL_KM);
      const lat = latOf((gy + fy) * CELL_KM);
      tileSet.add(`${Math.floor(lonToX(lon, DEM_Z))}/${Math.floor(latToY(lat, DEM_Z))}`);
    }
  }
  const tiles = [...tileSet].sort();
  say(`elevation tiles (z${DEM_Z}) ${tiles.length}`);
  await mapLimit(tiles, async (t) => {
    const [x, y] = t.split('/').map(Number) as [number, number];
    await demTile('dem', DEM_Z, x, y);
  });

  const landFrac = new Float32Array(N);
  const elev = new Float32Array(N);
  const elevP90 = new Float32Array(N);
  const elevStd = new Float32Array(N);
  const vals: number[] = [];
  for (const i of candIds) {
    const gx = i % W;
    const gy = Math.floor(i / W);
    vals.length = 0;
    let land = 0;
    for (let sy = 0; sy < S; sy++) {
      for (let sx = 0; sx < S; sx++) {
        const lon = lonOf((gx + (sx + 0.5) / S) * CELL_KM);
        const lat = latOf((gy + (sy + 0.5) / S) * CELL_KM);
        const e = demAt('dem', DEM_Z, lat, lon);
        if (Number.isFinite(e)) {
          land++;
          vals.push(Math.max(0, e));
        }
      }
    }
    landFrac[i] = land / (S * S);
    if (vals.length) {
      vals.sort((a, b) => a - b);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      elev[i] = mean;
      elevP90[i] = vals[Math.floor(vals.length * 0.9)]!;
      elevStd[i] = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    }
  }

  // ---- population: 1 km meshes of the 2020 census ----
  const mesh1 = new Set<number>();
  for (const i of candIds) {
    const gx = i % W;
    const gy = Math.floor(i / W);
    for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const lon = lonOf((gx + fx) * CELL_KM);
      const lat = latOf((gy + fy) * CELL_KM);
      mesh1.add(Math.floor(lat * 1.5) * 100 + Math.floor(lon - 100));
    }
  }
  const meshes = [...mesh1].sort((a, b) => a - b);
  say(`population: ${meshes.length} first-level meshes`);
  const popMeshes: [number, number][] = [];
  const loaded = await mapLimit(meshes, (m) => estatPopulation(m));
  for (const m of loaded) for (const [code, pop] of m) popMeshes.push([code, pop]);
  popMeshes.sort((a, b) => a[0] - b[0]);
  say(`population meshes ${popMeshes.length}, total ${popMeshes.reduce((s, [, p]) => s + p, 0)}`);

  // ---- land mask ----
  const popRaw = new Float64Array(N);
  for (const [code, pop] of popMeshes) {
    const [lat, lon] = mesh3Center(code);
    const c = cellAt(lat, lon);
    if (c >= 0) popRaw[c]! += pop;
  }
  const isLand = new Uint8Array(N);
  for (const i of candIds) {
    const f = landFrac[i]!;
    if (f >= REAL_GRID.landMin || (f >= REAL_GRID.landMinPopulated && popRaw[i]! >= REAL_GRID.populated)) isLand[i] = 1;
  }
  for (const [lat, lon, rNS, rEW] of LAKES) {
    for (const i of candIds) {
      const dx = ((i % W) + 0.5) * CELL_KM - xKm(lon);
      const dy = (Math.floor(i / W) + 0.5) * CELL_KM - yKm(lat);
      if ((dx / rEW) ** 2 + (dy / rNS) ** 2 <= 1) isLand[i] = 0;
    }
  }
  const landIds: number[] = [];
  for (let i = 0; i < N; i++) if (isLand[i]) landIds.push(i);
  const nearestLand = (lat: number, lon: number, maxKm = Infinity): number => {
    const c = cellAt(lat, lon);
    if (c >= 0 && isLand[c]) return c;
    let best = -1;
    let bestD = maxKm * maxKm;
    const px = xKm(lon);
    const py = yKm(lat);
    for (const i of landIds) {
      const d = (((i % W) + 0.5) * CELL_KM - px) ** 2 + ((Math.floor(i / W) + 0.5) * CELL_KM - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };
  // Population of meshes that fell on sea / lake cells goes to the nearest land cell.
  const pop = new Float64Array(N);
  let lost = 0;
  for (const i of candIds) {
    if (!popRaw[i]) continue;
    if (isLand[i]) pop[i]! += popRaw[i]!;
    else {
      const c = nearestLand(latOf((Math.floor(i / W) + 0.5) * CELL_KM), lonOf(((i % W) + 0.5) * CELL_KM), 40);
      if (c >= 0) pop[c]! += popRaw[i]!;
      else lost += popRaw[i]!;
    }
  }
  say(`land cells ${landIds.length}; population on no land cell within 40 km: ${lost}`);

  // ---- administrative areas (N03): 1 km sub-grid of municipality indices ----
  const subW = W * SUBN;
  const subH = H * SUBN;
  const subMuni = new Int32Array(subW * subH).fill(-1);
  const muniCodes: string[] = [];
  const muniNames: string[] = [];
  const muniPref: number[] = [];
  const muniGrade: number[] = [];
  const muniIndex = new Map<string, number>();
  const prefs = Array.from({ length: 47 }, (_, k) => k + 1);
  const n03 = await mapLimit(prefs, (p) => ksjZip(`N03/N03-2024/N03-20240101_${String(p).padStart(2, '0')}_GML.zip`), 4);
  for (let k = 0; k < prefs.length; k++) {
    const zip = n03[k];
    if (!zip) throw new Error(`N03 for prefecture ${prefs[k]} missing`);
    const layer = shpLayer(zip, /N03.*\.(shp|dbf|cpg)$/);
    if (!layer) throw new Error(`N03 layer for prefecture ${prefs[k]}`);
    layer.shapes.forEach((shape, s) => {
      const a = layer.attrs[s]!;
      const code = a.N03_007 ?? '';
      if (!code) return; // 所属未定地
      let idx = muniIndex.get(code);
      if (idx === undefined) {
        idx = muniCodes.length;
        muniIndex.set(code, idx);
        muniCodes.push(code);
        // N03 (2024): N03_004 the municipality, N03_005 the ward of an ordinance-designated city.
        const city = a.N03_004 ?? '';
        const ward = a.N03_005 ?? '';
        const designated = /市$/.test(city) && /区$/.test(ward);
        const name = city || ward;
        muniNames.push(name);
        const pref = Number(code.slice(0, 2));
        muniPref.push(pref);
        const grade = designated ? 5 : PREF_CAPITALS[pref] === name ? 4 : /市$/.test(name) ? 3 : /区$/.test(name) ? 3 : /町$/.test(name) ? 2 : /村$/.test(name) ? 1 : 2;
        muniGrade.push(grade);
      }
      // Scanline fill at sub-cell centres (even-odd over the parts of this shape).
      const rows = new Map<number, number[]>();
      for (const ring of shape.parts) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const ya = (yKm(ring[i]![1]) / CELL_KM) * SUBN - 0.5;
          const yb = (yKm(ring[j]![1]) / CELL_KM) * SUBN - 0.5;
          const lo = Math.ceil(Math.min(ya, yb));
          const hi = Math.floor(Math.max(ya, yb) - 1e-9);
          if (hi < lo) continue;
          const xa = (xKm(ring[i]![0]) / CELL_KM) * SUBN - 0.5;
          const xb = (xKm(ring[j]![0]) / CELL_KM) * SUBN - 0.5;
          for (let y = Math.max(0, lo); y <= Math.min(subH - 1, hi); y++) {
            const x = xa + ((y - ya) / (yb - ya)) * (xb - xa);
            let list = rows.get(y);
            if (!list) rows.set(y, (list = []));
            list.push(x);
          }
        }
      }
      for (const [y, xs] of rows) {
        xs.sort((p, q) => p - q);
        for (let t = 0; t + 1 < xs.length; t += 2) {
          for (let x = Math.max(0, Math.ceil(xs[t]!)); x <= Math.min(subW - 1, Math.floor(xs[t + 1]!)); x++) subMuni[y * subW + x] = idx;
        }
      }
    });
  }
  say(`municipalities ${muniCodes.length}`);
  /** Municipality at a point: the sub-cell, else the nearest named sub-cell within 3 km (small islands, coast). */
  const muniAt = (lat: number, lon: number): number => {
    const s = subAt(lat, lon);
    if (s < 0) return -1;
    if (subMuni[s]! >= 0) return subMuni[s]!;
    const sx = s % subW;
    const sy = Math.floor(s / subW);
    for (let r = 1; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = sx + dx;
        const y = sy + dy;
        if (x < 0 || y < 0 || x >= subW || y >= subH) continue;
        const m = subMuni[y * subW + x]!;
        if (m >= 0) return m;
      }
    }
    return -1;
  };

  // Per cell: population by municipality.
  const cellMuniPop = new Map<number, Map<number, number>>();
  const muniPopTotal = new Float64Array(muniCodes.length);
  const muniBestCell = new Int32Array(muniCodes.length).fill(-1);
  const muniBestPop = new Float64Array(muniCodes.length);
  for (const [code, p] of popMeshes) {
    const [lat, lon] = mesh3Center(code);
    let c = cellAt(lat, lon);
    if (c < 0 || !isLand[c]) c = nearestLand(lat, lon, 40);
    if (c < 0) continue;
    const m = muniAt(lat, lon);
    if (m < 0) continue;
    let mp = cellMuniPop.get(c);
    if (!mp) cellMuniPop.set(c, (mp = new Map()));
    mp.set(m, (mp.get(m) ?? 0) + p);
    muniPopTotal[m]! += p;
  }
  for (const [c, mp] of cellMuniPop) {
    for (const [m, p] of mp) {
      if (p > muniBestPop[m]!) {
        muniBestPop[m] = p;
        muniBestCell[m] = c;
      }
    }
  }
  const cellMuni = new Int32Array(N).fill(-1);
  const prefOf = new Int16Array(N);
  for (const i of landIds) {
    const mp = cellMuniPop.get(i);
    let best = -1;
    let bestP = 0;
    const prefPop = new Map<number, number>();
    if (mp) for (const [m, p] of mp) {
      if (p > bestP) {
        bestP = p;
        best = m;
      }
      prefPop.set(muniPref[m]!, (prefPop.get(muniPref[m]!) ?? 0) + p);
    }
    // Unpopulated (or barely): by area of the sub-cells.
    if (best < 0 || bestP < 50) {
      const count = new Map<number, number>();
      const gx = i % W;
      const gy = Math.floor(i / W);
      for (let sy = 0; sy < SUBN; sy++) for (let sx = 0; sx < SUBN; sx++) {
        const m = subMuni[(gy * SUBN + sy) * subW + gx * SUBN + sx]!;
        if (m >= 0) count.set(m, (count.get(m) ?? 0) + 1);
      }
      let n = 0;
      for (const [m, c] of count) if (c > n) {
        n = c;
        best = m;
      }
      if (best < 0) best = muniAt(latOf((gy + 0.5) * CELL_KM), lonOf((gx + 0.5) * CELL_KM));
      prefPop.clear();
      for (const [m, c] of count) prefPop.set(muniPref[m]!, (prefPop.get(muniPref[m]!) ?? 0) + c);
    }
    cellMuni[i] = best;
    let pref = best >= 0 ? muniPref[best]! : 0;
    let pp = -1;
    for (const [p, v] of prefPop) if (v > pp) {
      pp = v;
      pref = p;
    }
    prefOf[i] = pref;
  }
  // Cells with no municipality at all (rocks off the coast): the nearest cell's.
  for (const i of landIds) {
    if (prefOf[i]) continue;
    let best = -1;
    let bestD = Infinity;
    for (const j of landIds) {
      if (!prefOf[j]) continue;
      const d = ((i % W) - (j % W)) ** 2 + (Math.floor(i / W) - Math.floor(j / W)) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    prefOf[i] = prefOf[best]!;
    cellMuni[i] = cellMuni[best]!;
  }

  // ---- town halls (P05): the seat of each municipality ----
  const seatCell = new Int32Array(muniCodes.length).fill(-1);
  const cityHall = new Map<string, number>();
  const p05 = await ksjZip('P05/P05-22/P05-22_GML.zip');
  if (p05) {
    for (const inner of readZip(p05)) {
      if (!inner.name.endsWith('.zip')) continue;
      const layer = shpLayer(inner.read(), /P05/);
      if (!layer) continue;
      layer.shapes.forEach((shape, s) => {
        const a = layer.attrs[s]!;
        if (a.P05_002 !== '1') return; // 1: 本庁
        let m = muniIndex.get(a.P05_001 ?? '');
        const [lon, lat] = shape.parts[0]![0]!;
        const c = nearestLand(lat, lon, 15);
        // Ordinance-designated cities: P05 names the city (e.g. 34100), N03 the wards — the city hall.
        if (m === undefined) {
          m = muniAt(lat, lon);
          if (m < 0) return;
          if (c >= 0) cityHall.set(`${muniPref[m]}:${muniNames[m]}`, c);
          return;
        }
        // R3: P05 (2022) codes the city hall of an ordinance-designated city with the code of the ward
        // it stands in (さいたま市役所 11107 浦和区, 横浜市役所 14104 中区): without this the label went to
        // the first ward's office (横浜市 at 鶴見区, where it also hid 川崎市).
        if (c >= 0 && muniGrade[m] === 5 && a.P05_003 === `${muniNames[m]}役所`) cityHall.set(`${muniPref[m]}:${muniNames[m]}`, c);
        if (c >= 0) seatCell[m] = c;
      });
    }
  }
  // Places: one label per municipality (designated cities once), at its town hall or most populated cell.
  const placeByName = new Map<string, { cell: number; pop: number; grade: number }>();
  for (let m = 0; m < muniCodes.length; m++) {
    const cell = seatCell[m]! >= 0 ? seatCell[m]! : muniBestCell[m]!;
    if (cell < 0) continue;
    const key = `${muniPref[m]}:${muniNames[m]}`;
    const prev = placeByName.get(key);
    const p = muniPopTotal[m]!;
    if (prev) {
      prev.pop += p;
      continue;
    }
    placeByName.set(key, { cell: cityHall.get(key) ?? cell, pop: p, grade: muniGrade[m]! });
  }
  // One place per cell: the most important.
  const placeOfCell = new Map<number, { name: string; pop: number; grade: number }>();
  for (const [key, p] of placeByName) {
    const name = key.split(':')[1]!;
    const prev = placeOfCell.get(p.cell);
    if (!prev || p.grade > prev.grade || (p.grade === prev.grade && p.pop > prev.pop)) placeOfCell.set(p.cell, { name, pop: p.pop, grade: p.grade });
  }

  // ---- stations (S12) ----
  const s12 = await ksjZip('S12/S12-24/S12-24_GML.zip');
  const stationOfCell = new Map<number, { name: string; pax: number }>();
  if (s12) {
    const layer = shpLayer(s12, 'NumberOfPassengers');
    const byKey = new Map<string, { cell: number; name: string; pax: number }>();
    layer?.shapes.forEach((shape, s) => {
      const a = layer.attrs[s]!;
      let pax = 0;
      for (let k = 9; ; k += 4) {
        const f = a[`S12_${String(k).padStart(3, '0')}`];
        if (f === undefined) break;
        const v = Number(f);
        if (Number.isFinite(v) && v > 0) pax = v; // the latest year with data
      }
      const pts = shape.parts[0] ?? [];
      if (!pts.length) return;
      const [lon, lat] = pts[Math.floor(pts.length / 2)]!;
      const cell = cellAt(lat, lon);
      if (cell < 0 || !isLand[cell]) return;
      const name = a.S12_001 ?? '';
      const key = `${cell}:${name}`;
      const prev = byKey.get(key);
      if (prev) prev.pax += pax;
      else byKey.set(key, { cell, name, pax });
    });
    for (const st of byKey.values()) {
      const prev = stationOfCell.get(st.cell);
      if (!prev || st.pax > prev.pax) stationOfCell.set(st.cell, { name: st.name, pax: st.pax });
    }
    say(`stations: ${byKey.size} (cells with a station ${stationOfCell.size})`);
  }
  const stationGrade = (pax: number): number => {
    const G = REAL_GRID.stationPax;
    return pax >= G[3] ? 4 : pax >= G[2] ? 3 : pax >= G[1] ? 2 : pax >= G[0] ? 1 : 0;
  };

  // ---- airports (C28) ----
  const airports: { cell: number; name: string; size: number; lat: number; lon: number }[] = [];
  const c28 = await ksjZip('C28/C28-21/C28-21_GML.zip');
  if (c28) {
    const ap = shpLayer(c28, /C28-21_Airport\./);
    const ref = shpLayer(c28, 'AirportReferencePoint');
    const refPos = new Map<string, [number, number]>();
    ref?.shapes.forEach((sh, s) => refPos.set(ref.attrs[s]!.C28_000 ?? '', sh.parts[0]![0]!));
    ap?.shapes.forEach((sh, s) => {
      const a = ap.attrs[s]!;
      if (a.C28_004 && a.C28_004 !== '供用中') return;
      const pos = refPos.get((a.C28_101 ?? '').replace('#', '')) ?? sh.parts[0]?.[0];
      if (!pos) return;
      const [lon, lat] = pos;
      const cell = nearestLand(lat, lon, 15);
      if (cell < 0) return;
      const runway = Math.max(0, ...(a.C28_012 ?? '').split(',').map((v) => Number(v) || 0));
      const A = REAL_GRID.airportRunway;
      const size = runway >= A[1] ? 3 : runway >= A[0] ? 2 : 1;
      const name = a.C28_005 ?? '';
      const prev = airports.find((o) => o.name === name);
      if (prev) {
        prev.size = Math.max(prev.size, size); // one record per runway / area: the longest runway counts
        return;
      }
      airports.push({ cell, name, size, lat, lon });
    });
    say(`airports ${airports.length}`);
  }

  // ---- schools (P29) and hospitals (P04) ----
  const schools = new Float64Array(N);
  const hospitals = new Float64Array(N);
  const p29 = await ksjZip('P29/P29-23/P29-23_GML.zip');
  if (p29) {
    const layer = shpLayer(p29, /P29/);
    layer?.shapes.forEach((sh, s) => {
      const a = layer.attrs[s]!;
      const type = a.P29_003 ?? '';
      if (type === '16011' || type === '16012') return; // kindergartens, nursery schools
      if (a.P29_007 && a.P29_007 !== '0') return; // closed
      const [lon, lat] = sh.parts[0]![0]!;
      const c = cellAt(lat, lon);
      if (c >= 0 && isLand[c]) schools[c]!++;
    });
  }
  const p04 = await mapLimit(prefs, (p) => ksjZip(`P04/P04-20/P04-20_${String(p).padStart(2, '0')}_GML.zip`), 4);
  for (const zip of p04) {
    if (!zip) continue;
    const layer = shpLayer(zip, /P04/);
    layer?.shapes.forEach((sh, s) => {
      if (layer.attrs[s]!.P04_001 !== '1') return; // 1: hospital
      const [lon, lat] = sh.parts[0]![0]!;
      const c = cellAt(lat, lon);
      if (c >= 0 && isLand[c]) hospitals[c]!++;
    });
  }

  // ---- hubs: the table, moved onto the real stations and airports ----
  const n02 = await ksjZip('N02/N02-24/N02-24_GML.zip');
  const shinkansen = new Map<string, [number, number]>();
  const jr = new Map<string, [number, number]>();
  if (n02) {
    const st = shpLayer(n02, /N02-24_Station/);
    st?.shapes.forEach((sh, s) => {
      const a = st.attrs[s]!;
      if (a.N02_002 === '2' && /旅客鉄道/.test(a.N02_004 ?? '') && !jr.has(a.N02_005 ?? '')) {
        const pts = sh.parts[0]!;
        const [lon, lat] = pts[Math.floor(pts.length / 2)]!;
        jr.set(a.N02_005 ?? '', [lat, lon]); // mini-Shinkansen and future stations: the JR station
      }
      if (a.N02_002 !== '1') return; // 1: Shinkansen
      const pts = sh.parts[0]!;
      const [lon, lat] = pts[Math.floor(pts.length / 2)]!;
      shinkansen.set(a.N02_005 ?? '', [lat, lon]);
    });
  }
  const AIRPORT_NAMES: Record<string, string> = REAL_GRID.airportNames;
  let snapped = 0;
  const hubDefs = HUBS.map((h) => {
    const sk = shinkansen.get(h.name) ?? jr.get(h.name);
    if (sk) {
      snapped++;
      return { ...h, lat: sk[0], lon: sk[1] };
    }
    const apName = AIRPORT_NAMES[h.name] ?? h.name;
    const ap = airports.find((a) => a.name === apName);
    if (ap) {
      snapped++;
      return { ...h, lat: ap.lat, lon: ap.lon };
    }
    say(`hub ${h.name}: kept the table position (no real match)`);
    return h;
  });
  say(`hubs snapped to real positions: ${snapped}/${HUBS.length}`);
  const hubCells: number[] = [];
  const hubs: GridFile['hubs'] = [];
  const hubIndexByName = new Map<string, number>();
  for (const def of hubDefs) {
    const cell = nearestLand(def.lat, def.lon);
    let idx = hubCells.indexOf(cell);
    if (idx < 0) {
      idx = hubs.length;
      hubCells.push(cell);
      hubs.push({ name: def.name, cell });
    } else if (!hubs[idx]!.name.includes(def.name)) hubs[idx]!.name += `・${def.name}`;
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
  const sea: GridFile['sea'] = SEA_LINKS.map((l) => [l.name, nearestLand(l.a[0], l.a[1]), nearestLand(l.b[0], l.b[1]), l.minutes]);

  // ---- assemble ----
  const popInt = landIds.map((i) => Math.round(pop[i]!));
  const R = REAL_GRID.density;
  const land = landIds.map((i, k) => {
    const density = popInt[k]! / (CELL_KM * CELL_KM * Math.max(0.25, landFrac[i]!));
    if (density >= R.urban) return 0;
    if (density >= R.suburb) return 1;
    if (density >= R.rural) return 2;
    const M = REAL_GRID.mountain;
    return elev[i]! >= M.mean || (elev[i]! >= M.meanRugged && elevStd[i]! >= M.std) || elevP90[i]! >= M.p90 ? 4 : 3;
  });
  const coast = landIds.map((i) => {
    const x = i % W;
    const y = Math.floor(i / W);
    const seaAt = (nx: number, ny: number): boolean => nx < 0 || ny < 0 || nx >= W || ny >= H || !isLand[ny * W + nx];
    return seaAt(x - 1, y) || seaAt(x + 1, y) || seaAt(x, y - 1) || seaAt(x, y + 1) || landFrac[i]! < 0.97 ? 1 : 0;
  });
  // Police / fire until a region build has counted them (tools/real/region.ts): from population.
  const F = REAL_GRID.facilityPerPop;
  const usedMuni = [...new Set(landIds.map((i) => cellMuni[i]!).filter((m) => m >= 0))].sort((a, b) => a - b);
  const muniRemap = new Map(usedMuni.map((m, k) => [m, k]));
  const places = [...placeOfCell.entries()].filter(([c]) => isLand[c]).sort((a, b) => a[0] - b[0]);
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
    sea,
    places: places.map(([cell, p]) => [p.name, cell]),
    placeGrade: places.map(([, p]) => p.grade),
    elev: landIds.map((i) => Math.round(elev[i]!)),
    relief: landIds.map((i) => Math.round(elevStd[i]!)),
    muniNames: usedMuni.map((m) => muniNames[m]!),
    muni: landIds.map((i) => (cellMuni[i]! >= 0 ? muniRemap.get(cellMuni[i]!)! : -1)),
    town: landIds.map((i) => (cellMuni[i]! >= 0 ? muniGrade[cellMuni[i]!]! : 0)).join(''),
    fac: landIds.flatMap((i, k) => [schools[i]!, hospitals[i]!, Math.round(popInt[k]! / F.police), Math.round(popInt[k]! / F.fire)]),
    stations: [...stationOfCell.entries()].filter(([c]) => isLand[c]).sort((a, b) => a[0] - b[0]).map(([cell, s]) => [cell, s.name, stationGrade(s.pax), s.pax]),
    airports: airports.sort((a, b) => a.cell - b.cell).map((a) => [a.cell, a.name, a.size]),
  };
  say(`population total ${popInt.reduce((s, v) => s + v, 0)}`);
  return { file, elev, log };
}
