// R0: `npm run data:region -- <region> [--cells 1234,1235] [--estimate]`
//
// Builds the operation-area data of every land cell of one region from real open data:
//   public/data/areas/<region>/<cell>.bin   (format: src/gen/real/format.ts)
//   public/data/areas/<region>/index.json   (cells, sizes, police / fire counts, SDF sites)
//
// Sources per cell (the cell's real 10 km square, shrunk 1/10 into the 1024 m area):
//   elevation      GSI DEM10B tiles, zoom 12 (about 32 m), bilinear at 129 × 129 points
//   land use       KSJ L03-b 100 m mesh, 128 × 128 texels (78 m of the real ground each)
//   water areas    GSI vector tiles zoom 13 `waterarea`, drawn over the land use
//   durable bldgs  GSI vector tiles zoom 13 `building` (堅ろう建物 blocks) -> 64 × 64 cover share
//   population     e-Stat 2020 census 1 km mesh
//   roads, rails   GSI vector tiles zoom 13 `road` (motorways, national / prefectural roads, 13 m+;
//                  in sparse cells also 5.5 m+) and `railway`
//   facilities     GSI vector tiles zoom 14 `label` (annotations) in the tiles that hold a town
//                  (L03-b building land) or a large "other" area: stations, town halls, hospitals,
//                  schools, police, fire, SDF, airports...
// Downloads are cached in tmp/realdata/ (tools/real/lib/fetch.ts): a rerun is offline.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { parseGrid, type GridFile } from '../../src/sim/world/grid.ts';
import type { StaticGrid } from '../../src/core/types.ts';
import { REAL_AREA } from '../../src/data/realmap.ts';
import {
  DUR_N, ELEV_N, encodeRealArea, LINE, LINE_BRIDGE, LINE_TUNNEL, LU, LU_N, POI, POP_N, quantElev,
  type LineKind, type PoiKind, type RealArea, type RealLine, type RealPoi,
} from '../../src/gen/real/format.ts';
import { demBilinear, demAt, demTile } from './lib/dem.ts';
import { fetchCached, mapLimit, stats } from './lib/fetch.ts';
import { estatPopulation, mesh3Center } from './lib/ksj.ts';
import { l03b, l03bAt, mesh1Of } from './lib/l03b.ts';
import { decodeMvt, type MvtLayer } from './lib/mvt.ts';
import { REGIONS, type RegionKey } from './lib/regions.ts';
import { latToY, lonToX, tilesFor, xToLon, yToLat } from './lib/tiles.ts';
import type { RegionOverrides } from '../data/real/overrides/types.ts';

const SIZE = 1024;
const SC = SIZE / 10; // game metres per real km
const A = REAL_AREA.build;

// ---------------------------------------------------------------------------------------------
// Geometry helpers (global game coordinates: x east, z south, origin at the grid's north-west)
// ---------------------------------------------------------------------------------------------

interface Ctx {
  grid: StaticGrid;
  gX: (lon: number) => number;
  gZ: (lat: number) => number;
  lonOfX: (x: number) => number;
  latOfZ: (z: number) => number;
}

function context(grid: StaticGrid): Ctx {
  const { lon0, latTop, kmPerLon, kmPerLat } = grid.proj;
  return {
    grid,
    gX: (lon) => (lon - lon0) * kmPerLon * SC,
    gZ: (lat) => (latTop - lat) * kmPerLat * SC,
    lonOfX: (x) => lon0 + x / SC / kmPerLon,
    latOfZ: (z) => latTop - z / SC / kmPerLat,
  };
}

type P = [number, number];

/** Douglas–Peucker. */
function simplify(pts: P[], tol: number): P[] {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, az] = pts[a]!;
    const [bx, bz] = pts[b]!;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1e-9;
    let best = -1;
    let bestD = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i]![0] - ax) * dz - (pts[i]![1] - az) * dx) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Crossing of segment a-b with x = X, computed the same way whichever way the segment runs. */
function atX(a: P, b: P, X: number): P {
  const [p, q] = a[0] <= b[0] ? [a, b] : [b, a];
  return [X, p[1] + ((X - p[0]) / (q[0] - p[0])) * (q[1] - p[1])];
}
function atZ(a: P, b: P, Z: number): P {
  const [p, q] = a[1] <= b[1] ? [a, b] : [b, a];
  return [p[0] + ((Z - p[1]) / (q[1] - p[1])) * (q[0] - p[0]), Z];
}

/** Clip a polyline to a rectangle: the pieces inside. Crossing points are exact on the edges. */
function clipLine(pts: P[], x0: number, z0: number, x1: number, z1: number): P[][] {
  // Split every segment at the rectangle's edge lines, then keep the runs whose midpoints are inside.
  const split: P[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const cuts: P[] = [];
    for (const X of [x0, x1]) if ((a[0] - X) * (b[0] - X) < 0) cuts.push(atX(a, b, X));
    for (const Z of [z0, z1]) if ((a[1] - Z) * (b[1] - Z) < 0) cuts.push(atZ(a, b, Z));
    cuts.sort((p, q) => Math.hypot(p[0] - a[0], p[1] - a[1]) - Math.hypot(q[0] - a[0], q[1] - a[1]));
    split.push(...cuts, b);
  }
  const inside = (p: P): boolean => p[0] >= x0 - 1e-6 && p[0] <= x1 + 1e-6 && p[1] >= z0 - 1e-6 && p[1] <= z1 + 1e-6;
  const out: P[][] = [];
  let cur: P[] = [];
  for (let i = 0; i + 1 < split.length; i++) {
    const a = split[i]!;
    const b = split[i + 1]!;
    if (inside([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) {
      if (!cur.length) cur.push(a);
      cur.push(b);
    } else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out.filter((l) => l.length >= 2);
}

/** Even-odd point in polygon. */
function inPoly(rings: P[][], x: number, z: number): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, z1] = ring[i]!;
      const [x2, z2] = ring[j]!;
      if (z1 > z !== z2 > z && x < x1 + ((z - z1) / (z2 - z1)) * (x2 - x1)) inside = !inside;
    }
  }
  return inside;
}

/** 3rd-level (1 km) mesh code of a point. */
function mesh3Code(lat: number, lon: number): number {
  const p = Math.floor(lat * 1.5);
  const u = Math.floor(lon - 100);
  const q = Math.floor((lat * 1.5 - p) * 8);
  const v = Math.floor((lon - 100 - u) * 8);
  const r = Math.floor((lat * 1.5 * 8 - p * 8 - q) * 10);
  const w = Math.floor(((lon - 100 - u) * 8 - v) * 10);
  return p * 1000000 + u * 10000 + q * 1000 + v * 100 + r * 10 + w;
}

// ---------------------------------------------------------------------------------------------
// Vector tiles
// ---------------------------------------------------------------------------------------------

const bvmapMemo = new Map<string, MvtLayer[] | null>();
async function bvmap(z: number, x: number, y: number): Promise<MvtLayer[] | null> {
  const key = `${z}/${x}/${y}`;
  if (bvmapMemo.has(key)) return bvmapMemo.get(key)!;
  const buf = await fetchCached(`https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/${key}.pbf`, `gsi/bvmap/${key}.pbf`);
  const layers = buf ? decodeMvt(buf) : null;
  if (bvmapMemo.size > 4000) bvmapMemo.clear();
  bvmapMemo.set(key, layers);
  return layers;
}

/** Tile pixel -> global game coordinates. */
function tileToGlobal(ctx: Ctx, z: number, tx: number, ty: number, extent: number): (p: P) => P {
  return ([px, py]) => [ctx.gX(xToLon(tx + px / extent, z)), ctx.gZ(yToLat(ty + py / extent, z))];
}

/** The tile's own square in global coordinates (features reach a little past it: clip to it). */
function tileBox(ctx: Ctx, z: number, tx: number, ty: number): [number, number, number, number] {
  return [ctx.gX(xToLon(tx, z)), ctx.gZ(yToLat(ty, z)), ctx.gX(xToLon(tx + 1, z)), ctx.gZ(yToLat(ty + 1, z))];
}

// ---------------------------------------------------------------------------------------------
// Labels -> facilities
// ---------------------------------------------------------------------------------------------

interface Facility {
  kind: PoiKind;
  grade: number;
  x: number; // global
  z: number;
  name: string;
}

function classifyLabel(ctg: number, name: string): { kind: PoiKind; grade: number } | null {
  if (/自衛隊/.test(name) || ctg === 615) {
    if (/陸上自衛隊/.test(name) && /(駐屯地|分屯地|演習場)/.test(name)) return { kind: POI.gsdf, grade: /分屯地/.test(name) ? 1 : /演習場/.test(name) ? 3 : 2 };
    if (/海上自衛隊/.test(name) && /(基地|航空基地|地方総監部)/.test(name)) return { kind: POI.msdf, grade: /地方総監部/.test(name) ? 3 : 2 };
    if (/航空自衛隊/.test(name) && /(基地|分屯基地)/.test(name)) return { kind: POI.asdf, grade: /分屯基地/.test(name) ? 1 : 2 };
    if (/(師団|旅団|方面総監部)/.test(name)) return { kind: POI.gsdf, grade: 3 };
    return null;
  }
  switch (ctg) {
    case 422: return { kind: POI.station, grade: 0 };
    case 441: return { kind: POI.airport, grade: 0 };
    case 532: return /城/.test(name) ? { kind: POI.castle, grade: 0 } : null;
    case 621: return /県庁|都庁|道庁|府庁/.test(name) ? { kind: POI.prefOffice, grade: 0 } : null;
    case 881:
      if (/(県|都|道|府)庁/.test(name)) return { kind: POI.prefOffice, grade: 0 };
      if (/市役所|区役所/.test(name)) return { kind: POI.cityHall, grade: 0 };
      if (/(町|村)役場/.test(name)) return { kind: POI.townHall, grade: 0 };
      return null;
    case 883: return /警察署$|警察本部$/.test(name) ? { kind: POI.police, grade: /本部/.test(name) ? 2 : 1 } : null;
    case 884: return /(消防署|消防局|分署|出張所)$/.test(name) ? { kind: POI.fire, grade: /局$/.test(name) ? 2 : 1 } : null;
    case 885:
      if (/大学/.test(name)) return { kind: POI.university, grade: 0 };
      if (/高等学校|高校|中等教育学校|高等専門学校/.test(name)) return { kind: POI.school, grade: 3 };
      if (/中学校/.test(name)) return { kind: POI.school, grade: 2 };
      if (/小学校|義務教育学校/.test(name)) return { kind: POI.school, grade: 1 };
      if (/特別支援学校/.test(name)) return { kind: POI.school, grade: 1 };
      return null;
    case 631: return { kind: POI.university, grade: 0 };
    case 886: return /病院/.test(name) ? { kind: POI.hospital, grade: /(県立|市立|赤十字|大学|医療センター|国立)/.test(name) ? 2 : 1 } : null;
    case 887: return /郵便局$/.test(name) && !/簡易/.test(name) ? { kind: POI.post, grade: 0 } : null;
    case 534: return { kind: POI.park, grade: 0 };
    case 661: return { kind: POI.shrine, grade: 0 };
    case 662: return { kind: POI.temple, grade: 0 };
    default: return null;
  }
}

// ---------------------------------------------------------------------------------------------
// One cell
// ---------------------------------------------------------------------------------------------

interface CellResult {
  area: RealArea;
  police: number;
  fire: number;
  sdf: { kind: string; name: string }[];
}

async function buildCell(ctx: Ctx, cell: number, ov: RegionOverrides): Promise<CellResult> {
  const { grid } = ctx;
  const gx = cell % grid.gridW;
  const gy = Math.floor(cell / grid.gridW);
  const ox = gx * SIZE;
  const oz = gy * SIZE;
  const cov = ov.cells?.[cell] ?? {};
  const info = grid.cells[cell]!;
  const lonW = ctx.lonOfX(ox);
  const lonE = ctx.lonOfX(ox + SIZE);
  const latN = ctx.latOfZ(oz);
  const latS = ctx.latOfZ(oz + SIZE);

  // ---- elevation ----
  const DZ = A.demZoom;
  const margin = 0.002;
  await mapLimit(tilesFor(lonW - margin, latS - margin, lonE + margin, latN + margin, DZ), ([x, y]) => demTile('dem', DZ, x, y));
  const elev = new Float32Array(ELEV_N * ELEV_N);
  for (let j = 0; j < ELEV_N; j++) {
    for (let i = 0; i < ELEV_N; i++) {
      // From the global sample index, so that neighbouring cells get the very same edge values.
      const lon = ctx.lonOfX(((gx * (ELEV_N - 1) + i) * SIZE) / (ELEV_N - 1));
      const lat = ctx.latOfZ(((gy * (ELEV_N - 1) + j) * SIZE) / (ELEV_N - 1));
      let e = demAt('dem', DZ, lat, lon);
      if (Number.isFinite(e)) {
        const b = demBilinear('dem', DZ, lat, lon);
        if (Number.isFinite(b)) e = b;
        e = quantElev(Math.max(-20, e)) / 2;
      }
      elev[j * ELEV_N + i] = e;
    }
  }

  // ---- land use ----
  const meshes = new Set<number>();
  for (const [la, lo] of [[latN, lonW], [latN, lonE], [latS, lonW], [latS, lonE]] as const) {
    for (const d of [-0.02, 0, 0.02]) {
      meshes.add(mesh1Of(la + d, lo + d));
      meshes.add(mesh1Of(la - d, lo + d));
    }
  }
  for (const m of meshes) await l03b(m);
  const landuse = new Uint8Array(LU_N * LU_N);
  const texel = SIZE / (LU_N - 1);
  for (let j = 0; j < LU_N; j++) {
    for (let i = 0; i < LU_N; i++) {
      // Lattice points from the global index (like the elevation): edges equal the neighbour's.
      const lat = ctx.latOfZ(((gy * (LU_N - 1) + j) * SIZE) / (LU_N - 1));
      const lon = ctx.lonOfX(((gx * (LU_N - 1) + i) * SIZE) / (LU_N - 1));
      let c = l03bAt(lat, lon);
      const e = demAt('dem', DZ, lat, lon);
      if (!Number.isFinite(e)) c = LU.sea;
      else if (c === LU.sea || c === LU.none) c = LU.beach;
      landuse[j * LU_N + i] = c;
    }
  }

  // ---- vector tiles (zoom 13): roads, railways, water areas, durable buildings ----
  const VZ = 13;
  const tiles = tilesFor(lonW - margin, latS - margin, lonE + margin, latN + margin, VZ);
  await mapLimit(tiles, ([tx, ty]) => bvmap(VZ, tx, ty)); // in parallel (the rate limit still holds)
  const durCover = new Float32Array(DUR_N * DUR_N);
  const rawLines: { kind: LineKind; flags: number; width: number; pts: P[] }[] = [];
  // Local roads where few people live: decided per tile piece from the 1 km census mesh under its
  // middle, so that both cells sharing a road decide the same way.
  const meshPopEarly = new Map<number, number>();
  for (const m of meshes) for (const [code, p] of await estatPopulation(m)) meshPopEarly.set(code, p);
  const sparseAt = (pts: P[]): boolean => {
    const [x, z] = pts[Math.floor(pts.length / 2)]!;
    return (meshPopEarly.get(mesh3Code(ctx.latOfZ(z), ctx.lonOfX(x))) ?? 0) < A.denseLocalRoads;
  };
  for (const [tx, ty] of tiles) {
    const layers = await bvmap(VZ, tx, ty);
    if (!layers) continue;
    const box = tileBox(ctx, VZ, tx, ty);
    for (const layer of layers) {
      const toG = tileToGlobal(ctx, VZ, tx, ty, layer.extent);
      if (layer.name === 'road') {
        for (const f of layer.features) {
          const p = f.props;
          const ctg = Number(p.rdCtg ?? -1);
          const rank = Number(p.rnkWidth ?? -1);
          const motorway = Number(p.motorway ?? 0) === 1 || ctg === 3;
          let kind: LineKind;
          let width: number;
          if (motorway) [kind, width] = [LINE.motorway, A.width.motorway];
          else if (ctg === 0) [kind, width] = [LINE.national, rank === 3 ? A.width.wide : A.width.national];
          else if (ctg === 1) [kind, width] = [LINE.prefectural, rank === 3 ? A.width.wide : A.width.prefectural];
          else if (rank === 3) [kind, width] = [LINE.wide, A.width.wide];
          else if (rank === 2 && !cov.dropLocalRoads) [kind, width] = [LINE.local, A.width.local];
          else continue;
          const ft = Number(p.ftCode ?? 0);
          let flags = 0;
          // GSI road codes: 27x1 ordinary, 27x3 bridge / viaduct, 27x4 tunnel (checked on the
          // Kurushima-Kaikyo bridge and the mountain tunnels of the Kochi expressway).
          if (ft === 2704 || ft === 2714 || ft === 2724) flags |= LINE_TUNNEL;
          if (ft === 2703 || ft === 2713 || ft === 2723 || Number(p.lvOrder ?? 0) > 0) flags |= LINE_BRIDGE;
          for (const part of f.geom) {
            for (const piece of clipLine(part.map(toG), ...box)) {
              if (kind === LINE.local && !sparseAt(piece)) continue;
              rawLines.push({ kind, flags, width, pts: piece });
            }
          }
        }
      } else if (layer.name === 'railway') {
        for (const f of layer.features) {
          const p = f.props;
          // railState: 0 ordinary, 100 bridge / viaduct, 200 tunnel, 300 underground, 400 on the street (trams: no bed of their own).
          const state = Number(p.railState ?? 0);
          if (state === 400) continue;
          let flags = 0;
          if (state === 200 || state === 300) flags |= LINE_TUNNEL;
          if (state === 100 || Number(p.lvOrder ?? 0) > 0) flags |= LINE_BRIDGE;
          const width = Number(p.snglDbl ?? 1) >= 2 ? A.width.railDouble : A.width.rail;
          for (const part of f.geom) for (const piece of clipLine(part.map(toG), ...box)) rawLines.push({ kind: LINE.rail, flags, width, pts: piece });
        }
      } else if (layer.name === 'waterarea') {
        for (const f of layer.features) {
          if (f.type !== 3) continue;
          const rings = f.geom.map((r) => r.map(toG));
          let x0 = Infinity;
          let z0 = Infinity;
          let x1 = -Infinity;
          let z1 = -Infinity;
          for (const r of rings) for (const [x, z] of r) {
            x0 = Math.min(x0, x);
            z0 = Math.min(z0, z);
            x1 = Math.max(x1, x);
            z1 = Math.max(z1, z);
          }
          const i0 = Math.max(0, Math.ceil((Math.max(x0, box[0]) - ox) / texel));
          const i1 = Math.min(LU_N - 1, Math.floor((Math.min(x1, box[2]) - ox) / texel));
          const j0 = Math.max(0, Math.ceil((Math.max(z0, box[1]) - oz) / texel));
          const j1 = Math.min(LU_N - 1, Math.floor((Math.min(z1, box[3]) - oz) / texel));
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const x = ((gx * (LU_N - 1) + i) * SIZE) / (LU_N - 1);
            const z = ((gy * (LU_N - 1) + j) * SIZE) / (LU_N - 1);
            if (x < box[0] || x >= box[2] || z < box[1] || z >= box[3]) continue;
            const k = j * LU_N + i;
            if (landuse[k] !== LU.sea && inPoly(rings, x, z)) landuse[k] = LU.water;
          }
        }
      } else if (layer.name === 'building') {
        const dt = SIZE / DUR_N;
        for (const f of layer.features) {
          if (f.type !== 3) continue;
          const rings = f.geom.map((r) => r.map(toG));
          let x0 = Infinity;
          let z0 = Infinity;
          let x1 = -Infinity;
          let z1 = -Infinity;
          for (const r of rings) for (const [x, z] of r) {
            x0 = Math.min(x0, x);
            z0 = Math.min(z0, z);
            x1 = Math.max(x1, x);
            z1 = Math.max(z1, z);
          }
          // 4 × 4 samples per texel.
          const s0 = Math.max(0, Math.floor(((Math.max(x0, box[0]) - ox) / dt) * 4));
          const s1 = Math.min(DUR_N * 4 - 1, Math.floor(((Math.min(x1, box[2]) - ox) / dt) * 4));
          const r0 = Math.max(0, Math.floor(((Math.max(z0, box[1]) - oz) / dt) * 4));
          const r1 = Math.min(DUR_N * 4 - 1, Math.floor(((Math.min(z1, box[3]) - oz) / dt) * 4));
          for (let r = r0; r <= r1; r++) for (let s = s0; s <= s1; s++) {
            const x = ox + ((s + 0.5) * dt) / 4;
            const z = oz + ((r + 0.5) * dt) / 4;
            if (x < box[0] || x >= box[2] || z < box[1] || z >= box[3]) continue;
            if (inPoly(rings, x, z)) durCover[(r >> 2) * DUR_N + (s >> 2)]! += 1 / 16;
          }
        }
      }
    }
  }
  const durable = new Uint8Array(DUR_N * DUR_N);
  const dMul = cov.durableMul ?? 1;
  for (let i = 0; i < durable.length; i++) durable[i] = Math.min(15, Math.round(durCover[i]! * 15 * dMul));

  // Lines: join the per-tile pieces that continue each other, simplify, clip to the cell.
  const joined = joinPieces(rawLines);
  const lines: RealLine[] = [];
  for (const l of joined) {
    // Clip the raw line first: the crossing of an edge then comes from the same raw segment in both
    // cells (simplifying first would move it by the other cell's share of the line).
    for (const raw of clipLine(l.pts, ox, oz, ox + SIZE, oz + SIZE)) {
      const piece = simplify(raw, A.simplify);
      const q = piece.map(([x, z]): P => [Math.round(x * 2) / 2 - ox, Math.round(z * 2) / 2 - oz]);
      let len = 0;
      for (let i = 1; i < q.length; i++) len += Math.hypot(q[i]![0] - q[i - 1]![0], q[i]![1] - q[i - 1]![1]);
      const touchesEdge = q.some(([x, z]) => x <= 0 || z <= 0 || x >= SIZE || z >= SIZE);
      if ((len < 1 && !touchesEdge) || len < 0.01 || (len < A.minLine && !touchesEdge)) continue;
      lines.push({ kind: l.kind, flags: l.flags, width: l.width, pts: Float32Array.from(q.flat()) });
    }
  }

  // ---- population ----
  const pop = new Uint16Array(POP_N * POP_N);
  const meshPop = new Map<number, number>();
  for (const m of meshes) for (const [code, p] of await estatPopulation(m)) meshPop.set(code, p);
  for (let j = 0; j < POP_N; j++) for (let i = 0; i < POP_N; i++) {
    const lat = ctx.latOfZ(oz + ((j + 0.5) * SIZE) / POP_N);
    const lon = ctx.lonOfX(ox + ((i + 0.5) * SIZE) / POP_N);
    pop[j * POP_N + i] = Math.min(65535, meshPop.get(mesh3Code(lat, lon)) ?? 0);
  }
  void mesh3Center;

  // ---- facilities: zoom-14 annotations where there is a town or a large "other" area ----
  const LZ = 14;
  const facilities: Facility[] = [];
  const labelTiles = tilesFor(lonW, latS, lonE, latN, LZ).filter(([tx, ty]) => {
    let town = 0;
    let other = 0;
    for (let sj = 0; sj < 8; sj++) for (let si = 0; si < 8; si++) {
      const c = l03bAt(yToLat(ty + (sj + 0.5) / 8, LZ), xToLon(tx + (si + 0.5) / 8, LZ));
      if (c === LU.building) town++;
      else if (c === LU.other) other++;
    }
    return town >= A.labelTileTown || other >= A.labelTileOther;
  });
  await mapLimit(labelTiles, ([tx, ty]) => bvmap(LZ, tx, ty));
  for (const [tx, ty] of tilesFor(lonW, latS, lonE, latN, LZ)) {
    // How much of this tile is town / facility ground (L03-b samples)?
    let town = 0;
    let other = 0;
    for (let sj = 0; sj < 8; sj++) for (let si = 0; si < 8; si++) {
      const c = l03bAt(yToLat(ty + (sj + 0.5) / 8, LZ), xToLon(tx + (si + 0.5) / 8, LZ));
      if (c === LU.building) town++;
      else if (c === LU.other) other++;
    }
    if (town < A.labelTileTown && other < A.labelTileOther) continue;
    const layers = await bvmap(LZ, tx, ty);
    const label = layers?.find((l) => l.name === 'label');
    if (!label) continue;
    const toG = tileToGlobal(ctx, LZ, tx, ty, label.extent);
    const box = tileBox(ctx, LZ, tx, ty);
    for (const f of label.features) {
      const name = String(f.props.knj ?? '');
      const cls = classifyLabel(Number(f.props.annoCtg ?? 0), name);
      if (!cls || !f.geom[0]?.[0]) continue;
      const [x, z] = toG(f.geom[0][0]);
      if (x < box[0] || x >= box[2] || z < box[1] || z >= box[3]) continue;
      if (x < ox || z < oz || x >= ox + SIZE || z >= oz + SIZE) continue;
      facilities.push({ ...cls, x, z, name });
    }
  }
  // One per name and kind (annotations repeat across zoom levels / tiles).
  const pois: RealPoi[] = [];
  for (const f of facilities) {
    if (pois.some((p) => p.kind === f.kind && p.name === f.name && Math.hypot(p.x - (f.x - ox), p.z - (f.z - oz)) < 30)) continue;
    if (cov.dropPois?.some((s) => f.name.includes(s))) continue;
    pois.push({ kind: f.kind, grade: f.grade, x: Math.round((f.x - ox) * 2) / 2, z: Math.round((f.z - oz) * 2) / 2, name: cov.renamePois?.[f.name] ?? f.name });
  }
  // Stations: grade from the strategic grid's passengers (the busiest one of the cell), others by size of name match.
  const st = info.real?.station;
  for (const p of pois) if (p.kind === POI.station && st && p.name.replace(/駅$/, '') === st.name) p.grade = st.grade;
  for (const p of cov.addPois ?? []) pois.push(p);
  pois.sort((a, b) => a.kind - b.kind || a.z - b.z || a.x - b.x);

  const area: RealArea = { cell, elev, landuse, durable, pop, lines, pois };
  const sdfKind = (p: RealPoi): string => (p.kind === POI.msdf ? 'msdf' : p.kind === POI.asdf ? 'asdf' : p.grade >= 3 ? 'gsdf_l' : p.grade === 1 ? 'gsdf_s' : 'gsdf_m');
  return {
    area,
    police: pois.filter((p) => p.kind === POI.police).length,
    fire: pois.filter((p) => p.kind === POI.fire).length,
    sdf: pois.filter((p) => p.kind === POI.gsdf || p.kind === POI.msdf || p.kind === POI.asdf).map((p) => ({ kind: sdfKind(p), name: p.name })),
  };
}

/**
 * Join line pieces of the same kind whose ends meet (the vector tiles cut every line at the tile
 * borders; the two halves end within a metre of each other). Longest chains first.
 */
function joinPieces(pieces: { kind: LineKind; flags: number; width: number; pts: P[] }[]): typeof pieces {
  const SNAP = 1.5;
  const out: typeof pieces = [];
  const groups = new Map<string, typeof pieces>();
  for (const p of pieces) {
    const g = `${p.kind}:${p.flags}:${p.width}`;
    const list = groups.get(g) ?? [];
    list.push(p);
    groups.set(g, list);
  }
  const cellKey = (x: number, z: number): string => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  for (const list of groups.values()) {
    // Ends in a 4 m hash: [piece, which end (0 start, 1 end)].
    const hash = new Map<string, [number, number][]>();
    list.forEach((p, i) => {
      for (const [k, e] of [[0, p.pts[0]!], [1, p.pts[p.pts.length - 1]!]] as const) {
        const key = cellKey(e[0], e[1]);
        const l = hash.get(key) ?? [];
        l.push([i, k]);
        hash.set(key, l);
      }
    });
    const used = new Uint8Array(list.length);
    const partner = (pt: P): [number, number] | null => {
      const cx = Math.floor(pt[0] / 4);
      const cz = Math.floor(pt[1] / 4);
      let best: [number, number] | null = null;
      let bestD = SNAP;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        for (const [i, k] of hash.get(`${cx + dx},${cz + dz}`) ?? []) {
          if (used[i]) continue;
          const q = k === 0 ? list[i]!.pts[0]! : list[i]!.pts[list[i]!.pts.length - 1]!;
          const d = Math.hypot(q[0] - pt[0], q[1] - pt[1]);
          if (d < bestD) {
            bestD = d;
            best = [i, k];
          }
        }
      }
      return best;
    };
    for (let i = 0; i < list.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      let pts = list[i]!.pts.slice();
      for (let grow = 0; grow < 2; grow++) {
        for (;;) {
          const end = pts[pts.length - 1]!;
          const next = partner(end);
          if (!next) break;
          used[next[0]] = 1;
          const q = list[next[0]]!.pts;
          pts = next[1] === 0 ? pts.concat(q.slice(1)) : pts.concat(q.slice(0, -1).reverse());
        }
        pts.reverse();
      }
      out.push({ ...list[i]!, pts });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Region
// ---------------------------------------------------------------------------------------------

export function regionCells(grid: StaticGrid, region: RegionKey): number[] {
  const r = REGIONS.indexOf(region);
  return grid.landIds.filter((id) => grid.cells[id]!.region === r);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const region = args.find((a) => (REGIONS as readonly string[]).includes(a)) as RegionKey | undefined;
  if (!region) throw new Error(`usage: npm run data:region -- <${REGIONS.join('|')}> [--cells id,id] [--estimate]`);
  const gridFile = JSON.parse(readFileSync(new URL('../../public/data/grid.json', import.meta.url), 'utf8')) as GridFile;
  const grid = parseGrid(gridFile);
  const ctx = context(grid);
  let cells = regionCells(grid, region);
  const only = args.indexOf('--cells');
  if (only >= 0) cells = args[only + 1]!.split(',').map(Number).filter((c) => cells.includes(c));
  const { OVERRIDES } = (await import(`../data/real/overrides/${region}.ts`)) as { OVERRIDES: RegionOverrides };

  if (args.includes('--estimate')) {
    const { estimateTiles } = await import('./estimate.ts');
    estimateTiles(grid, cells, region);
    return;
  }
  const outDir = new URL(`../../public/data/areas/${region}/`, import.meta.url);
  mkdirSync(outDir, { recursive: true });
  const indexUrl = new URL('index.json', outDir);
  let index: RegionIndex = { region, version: 1, cells: {} };
  try {
    index = JSON.parse(readFileSync(indexUrl, 'utf8')) as RegionIndex;
  } catch {
    // first run
  }
  const t0 = Date.now();
  let done = 0;
  let total = 0;
  for (const cell of cells) {
    const r = await buildCell(ctx, cell, OVERRIDES);
    r.area.heightMul = (OVERRIDES.heightMul ?? 1) * (OVERRIDES.cells?.[cell]?.heightMul ?? 1);
    const raw = encodeRealArea(r.area);
    const gz = gzipSync(raw, { level: 9 });
    writeFileSync(new URL(`${cell}.bin`, outDir), gz);
    index.cells[cell] = { bytes: gz.length, police: r.police, fire: r.fire, sdf: r.sdf };
    total += gz.length;
    done++;
    if (done % 10 === 0 || done === cells.length) {
      console.log(`[region ${region}] ${done}/${cells.length} cells, ${(total / 1024 / done).toFixed(1)} KB avg, downloads ${stats.downloaded} (${(stats.bytes / 1e6).toFixed(0)} MB), cached ${stats.cached}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  }
  index.cells = Object.fromEntries(Object.entries(index.cells).sort((a, b) => Number(a[0]) - Number(b[0])));
  writeFileSync(indexUrl, `${JSON.stringify(index)}\n`);
  const sizes = Object.values(index.cells).map((c) => c.bytes);
  console.log(`[region ${region}] ${sizes.length} areas, total ${(sizes.reduce((s, v) => s + v, 0) / 1e6).toFixed(2)} MB, avg ${(sizes.reduce((s, v) => s + v, 0) / sizes.length / 1024).toFixed(1)} KB, max ${(Math.max(...sizes) / 1024).toFixed(1)} KB`);
}

export interface RegionIndex {
  region: string;
  version: number;
  cells: Record<string, { bytes: number; police: number; fire: number; sdf: { kind: string; name: string }[] }>;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
void latToY;
void lonToX;
