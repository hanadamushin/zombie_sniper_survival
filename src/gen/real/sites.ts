// 07d-3: the sites of the facilities at their real place (map.pois), planned before the roads are laid.
//
// A facility is one 07d-2 building type standing on its own site (a school with its playground, a
// garrison, an airport with its runway, a station with its tracks). The site is looked for around the
// annotation (shrunk 1/10) on dry, level enough ground, clear of the area edge (07c seams), the other
// sites, the landmarks and the roads that stay. Some data roads may cross a site: the minor ones
// stop at its fence (data/placement.ts CUTS: a garrison is one compound, a station holds its own
// tracks, an airport its own runway). Then the ground under the site is levelled, the roads are laid
// (cut where a site took them) and the buildings are placed (layout.ts).
//
// Stations sit on their railway: their tracks (along the type's local x) over the real line, the
// station house (front) on the side of the annotation. Airports and air bases sit on the open
// "other" land around their point. The navy's base turns its back (local z < 42 m, painted water)
// to the sea.

import { chance, rand, type RngState } from '../../core/rng.ts';
import type { CellFacts } from '../../core/types.ts';
import { AIRPORTS, AIRPORT_TERMINAL, CAMPS, CUTS, FACILITY_CAP, GARRISONS, GARRISON_LARGE, NAVY, SITES, STATION_FRONT, STATIONS } from '../../data/placement.ts';
import { buildingDef, generateBlueprint, type Rot } from '../buildings/index.ts';
import { forTiles, hAt, homeDist, SIZE, TILE, TILES, type Builder } from '../builder.ts';
import { TACTICAL } from '../../data/tactical.ts';
import { editFade } from '../world.ts';
import { GROUND, type MapPoi } from '../types.ts';
import { LINE, LINE_TUNNEL, LU, LU_N, POI, type RealArea } from './format.ts';

const STEP = SIZE / (LU_N - 1);

export interface Site {
  /** Index of the point it stands for in the area's pois (-1: a field camp). */
  poi: number;
  def: string;
  /** Local frontage / depth and the side the front faces. */
  w: number;
  d: number;
  rot: Rot;
  /** World footprint. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Line kinds (format.ts LINE) that stop at the site's fence. */
  cut: readonly number[];
  big: boolean;
  /** Ground level the site was levelled to (NaN: not levelled). */
  level: number;
  /** Navy base: the back strip that stays sea (the rest is drained like any site). */
  sea?: Rect;
  /** A car park / square in front (hospitals, halls, universities). */
  forecourt?: boolean;
  /** What it is, for the census: the facility class of data/placement.ts FACILITY_CAP or 'station', 'camp'. */
  what: string;
}

// ---------------------------------------------------------------------------------------------
// Line geometry (the roads before they are laid)
// ---------------------------------------------------------------------------------------------

interface Seg {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** Half the line's width. */
  hw: number;
  kind: number;
  line: number;
}

const CELL = 32;
const CELLS = SIZE / CELL;

export class LineIndex {
  segs: Seg[] = [];
  cells: number[][] = Array.from({ length: CELLS * CELLS }, () => []);
  constructor(real: RealArea) {
    real.lines.forEach((line, li) => {
      if (line.flags & LINE_TUNNEL || line.kind === LINE.river) return;
      for (let k = 0; k + 3 < line.pts.length; k += 2) {
        const s: Seg = { ax: line.pts[k]!, az: line.pts[k + 1]!, bx: line.pts[k + 2]!, bz: line.pts[k + 3]!, hw: line.width / 2, kind: line.kind, line: li };
        const id = this.segs.length;
        this.segs.push(s);
        const pad = s.hw + 2;
        const cx0 = clampCell(Math.floor((Math.min(s.ax, s.bx) - pad) / CELL));
        const cx1 = clampCell(Math.floor((Math.max(s.ax, s.bx) + pad) / CELL));
        const cz0 = clampCell(Math.floor((Math.min(s.az, s.bz) - pad) / CELL));
        const cz1 = clampCell(Math.floor((Math.max(s.az, s.bz) + pad) / CELL));
        for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) this.cells[cz * CELLS + cx]!.push(id);
      }
    });
  }
  /** Segments whose cells overlap the rectangle (each once). */
  near(x0: number, z0: number, x1: number, z1: number, out: Set<number>): Set<number> {
    out.clear();
    const cx0 = clampCell(Math.floor(x0 / CELL));
    const cx1 = clampCell(Math.floor(x1 / CELL));
    const cz0 = clampCell(Math.floor(z0 / CELL));
    const cz1 = clampCell(Math.floor(z1 / CELL));
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) for (const s of this.cells[cz * CELLS + cx]!) out.add(s);
    return out;
  }
}
const clampCell = (c: number): number => Math.min(CELLS - 1, Math.max(0, c));

/** Length of the segment inside the rectangle (Liang–Barsky), 0 when it misses. */
export function clipLength(ax: number, az: number, bx: number, bz: number, x0: number, z0: number, x1: number, z1: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  let t0 = 0;
  let t1 = 1;
  const edge = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (!edge(-dx, ax - x0) || !edge(dx, x1 - ax) || !edge(-dz, az - z0) || !edge(dz, z1 - az)) return 0;
  return Math.max(0, t1 - t0) * Math.hypot(dx, dz);
}

/** Distance from a point to a segment. */
function segDist(s: Seg, x: number, z: number): number {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz;
  const u = l2 > 0 ? Math.min(1, Math.max(0, ((x - s.ax) * dx + (z - s.az) * dz) / l2)) : 0;
  return Math.hypot(x - s.ax - dx * u, z - s.az - dz * u);
}

// ---------------------------------------------------------------------------------------------
// The planner
// ---------------------------------------------------------------------------------------------

type Rect = [number, number, number, number];

export interface Planner {
  b: Builder;
  real: RealArea;
  lines: LineIndex;
  sites: Site[];
  /** Rectangles nothing else may take (sites, landmarks, towers). */
  taken: Rect[];
  /** Summed-area table of the water tiles. */
  wet: Int32Array;
  rng: RngState;
  scratch: Set<number>;
}

export function createPlanner(b: Builder, real: RealArea, rng: RngState): Planner {
  const wet = new Int32Array((TILES + 1) * (TILES + 1));
  for (let ty = 0; ty < TILES; ty++) {
    let row = 0;
    for (let tx = 0; tx < TILES; tx++) {
      row += b.ground[ty * TILES + tx] === GROUND.water ? 1 : 0;
      wet[(ty + 1) * (TILES + 1) + tx + 1] = wet[ty * (TILES + 1) + tx + 1]! + row;
    }
  }
  return { b, real, lines: new LineIndex(real), sites: [], taken: [], wet, rng, scratch: new Set() };
}

function wetTiles(P: Planner, x0: number, z0: number, x1: number, z1: number): number {
  const tx0 = Math.max(0, Math.floor(x0 / TILE));
  const tz0 = Math.max(0, Math.floor(z0 / TILE));
  const tx1 = Math.min(TILES, Math.ceil(x1 / TILE));
  const tz1 = Math.min(TILES, Math.ceil(z1 / TILE));
  if (tx1 <= tx0 || tz1 <= tz0) return 0;
  const W = TILES + 1;
  return P.wet[tz1 * W + tx1]! - P.wet[tz0 * W + tx1]! - P.wet[tz1 * W + tx0]! + P.wet[tz0 * W + tx0]!;
}

/** Share 0..1 of the land-use lattice points in a rectangle that pass the test. */
function luShare(real: RealArea, x0: number, z0: number, x1: number, z1: number, test: (c: number) => boolean): number {
  const i0 = Math.max(0, Math.ceil(x0 / STEP));
  const i1 = Math.min(LU_N - 1, Math.floor(x1 / STEP));
  const j0 = Math.max(0, Math.ceil(z0 / STEP));
  const j1 = Math.min(LU_N - 1, Math.floor(z1 / STEP));
  let n = 0;
  let y = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    n++;
    if (test(real.landuse[j * LU_N + i]!)) y++;
  }
  return n ? y / n : 0;
}

/** Height range under a rectangle, sampled every `step` metres. */
function rangeOf(b: Builder, x0: number, z0: number, x1: number, z1: number, step: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  const nx = Math.max(1, Math.ceil((x1 - x0) / step));
  const nz = Math.max(1, Math.ceil((z1 - z0) / step));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const h = hAt(b, x0 + ((x1 - x0) * i) / nx, z0 + ((z1 - z0) * j) / nz);
    if (h < lo) lo = h;
    if (h > hi) hi = h;
  }
  return [lo, hi];
}

interface Check {
  /** Data lines cut (m inside the site). */
  cut: number;
}

/**
 * Can a site take this rectangle? Inside the area (edge margin), out of the home clearing, clear of
 * the other sites and of the lines that stay, no water (unless `wetOk`). Returns the cut length or null.
 */
function check(P: Planner, r: Rect, cut: readonly number[], big: boolean, wetOk = false, nearEdge = false): Check | null {
  const [x0, z0, x1, z1] = r;
  const e = big && !nearEdge ? SITES.edge.big : SITES.edge.small;
  if (x0 < e || z0 < e || x1 > SIZE - e || z1 > SIZE - e) return null;
  if (P.b.params.isHome) {
    const cx = Math.min(x1, Math.max(x0, SIZE / 2));
    const cz = Math.min(z1, Math.max(z0, SIZE / 2));
    if (homeDist(cx, cz) < TACTICAL.homeFlatRadius + 12) return null;
  }
  const g = SITES.gap;
  for (const t of P.taken) if (t[0] < x1 + g && t[2] > x0 - g && t[1] < z1 + g && t[3] > z0 - g) return null;
  // A big site may cover a pond or a ditch (drained under it): a few wet tiles, never at the area edge.
  const wet = wetOk ? 0 : wetTiles(P, x0, z0, x1, z1);
  if (wet > 0) {
    const share = Math.max(x1 - x0, z1 - z0) >= SITES.huge ? SITES.drainHuge : SITES.drain;
    if (!big || wet > ((x1 - x0) * (z1 - z0)) / (TILE * TILE) * share) return null;
    if (x0 < 2 * TILE || z0 < 2 * TILE || x1 > SIZE - 2 * TILE || z1 > SIZE - 2 * TILE) return null;
  }
  let length = wet * 30;
  for (const si of P.lines.near(x0 - 12, z0 - 12, x1 + 12, z1 + 12, P.scratch)) {
    const s = P.lines.segs[si]!;
    const pad = s.hw + (cut.includes(s.kind) ? 0 : g);
    const l = clipLength(s.ax, s.az, s.bx, s.bz, x0 - pad, z0 - pad, x1 + pad, z1 + pad);
    if (l <= 0) continue;
    if (!cut.includes(s.kind)) return null;
    // A main road cut weighs more than a back street.
    length += s.kind === LINE.rail ? l * 8 : s.kind <= LINE.national ? l * 4 : s.kind === LINE.prefectural ? l * 2 : l;
  }
  return { cut: length };
}

/** Tools (tools/real/census.ts --why) can see why a site was not found. */
export const siteDebug: { log?: (msg: string) => void } = {};

/** Why check() refuses a rectangle (siteDebug only). */
function whyNot(P: Planner, r: Rect, cut: readonly number[], big: boolean, wetOk: boolean): string {
  const [x0, z0, x1, z1] = r;
  const e = big ? SITES.edge.big : SITES.edge.small;
  if (x0 < e || z0 < e || x1 > SIZE - e || z1 > SIZE - e) return 'edge';
  const g = SITES.gap;
  for (const t of P.taken) if (t[0] < x1 + g && t[2] > x0 - g && t[1] < z1 + g && t[3] > z0 - g) return 'taken';
  const wet = wetOk ? 0 : wetTiles(P, x0, z0, x1, z1);
  const share = Math.max(x1 - x0, z1 - z0) >= SITES.huge ? SITES.drainHuge : SITES.drain;
  if (wet > 0 && (!big || wet > ((x1 - x0) * (z1 - z0)) / (TILE * TILE) * share)) return 'water';
  for (const si of P.lines.near(x0 - 12, z0 - 12, x1 + 12, z1 + 12, P.scratch)) {
    const s = P.lines.segs[si]!;
    const pad = s.hw + (cut.includes(s.kind) ? 0 : g);
    if (!cut.includes(s.kind) && clipLength(s.ax, s.az, s.bx, s.bz, x0 - pad, z0 - pad, x1 + pad, z1 + pad) > 0) return `line${s.kind}`;
  }
  return 'home';
}

/** The side (as a rotation) whose middle is nearest a line that stays (the street the front gate opens to). */
function frontToRoad(P: Planner, r: Rect, cut: readonly number[], fallback: Rot): Rot {
  const [x0, z0, x1, z1] = r;
  const mids: [number, number][] = [[(x0 + x1) / 2, z1], [x1, (z0 + z1) / 2], [(x0 + x1) / 2, z0], [x0, (z0 + z1) / 2]];
  let best = fallback;
  let dist = 70;
  for (const si of P.lines.near(x0 - 70, z0 - 70, x1 + 70, z1 + 70, P.scratch)) {
    const s = P.lines.segs[si]!;
    if (cut.includes(s.kind) && s.kind !== LINE.local) continue;
    mids.forEach(([mx, mz], k) => {
      // The footprint is fixed: only the two sides of its turn (the front along its frontage).
      if (k % 2 !== fallback % 2) return;
      const d = segDist(s, mx, mz) - s.hw;
      if (d < dist) {
        dist = d;
        best = k as Rot;
      }
    });
  }
  return best;
}

function rectOf(cx: number, cz: number, w: number, d: number, rot: Rot): Rect {
  const [ww, wd] = rot % 2 === 0 ? [w, d] : [d, w];
  return [cx - ww / 2, cz - wd / 2, cx + ww / 2, cz + wd / 2];
}

interface FindOptions {
  /** How far (m) the centre may move from the anchor. */
  shift: number;
  cut: readonly number[];
  /** Score added per candidate (lower is better), e.g. preferring open land. */
  bonus?: (r: Rect) => number;
  /** Navy base: the back strip on the sea (returns the rotation, or null). */
  seaSide?: (r: Rect) => [Rot, Rect] | null;
  /** Size: 'min' (default), 'mid' or 'random'. */
  size?: 'min' | 'mid' | 'random';
  /**
   * The site must come within this distance (m) of the anchor (the annotation inside it or close by);
   * the centre may then move up to `near` plus half the site. Replaces `shift`'s limit on the centre.
   */
  near?: number;
}

/** The best site of a type around an anchor, or null. */
function find(P: Planner, id: string, ax: number, az: number, o: FindOptions): Omit<Site, 'poi' | 'what'> | null {
  const def = buildingDef(id);
  const t = o.size === 'mid' ? 0.5 : o.size === 'random' ? rand(P.rng) * 0.6 : 0;
  const w = def.size.w[0] + (def.size.w[1] - def.size.w[0]) * t;
  const d = def.size.d[0] + (def.size.d[1] - def.size.d[0]) * t;
  const big = Math.max(w, d) >= SITES.big;
  const huge = Math.max(w, d) >= SITES.huge;
  const reach = o.near !== undefined ? o.near + Math.max(w, d) / 2 : o.shift;
  const step = huge ? 32 : big ? Math.max(SITES.step, 24) : reach <= 60 ? 8 : SITES.step;
  const cands: { r: Rect; rot: Rot; back?: Rect; score: number }[] = [];
  const tried: Record<string, number> = {};
  for (let dz = -reach; dz <= reach; dz += step) {
    for (let dx = -reach; dx <= reach; dx += step) {
      let dist = Math.hypot(dx, dz);
      if (dist > reach) continue;
      for (const odd of [0, 1] as const) {
        const r = rectOf(ax + dx, az + dz, w, d, odd as Rot);
        if (o.near !== undefined) {
          dist = Math.hypot(Math.max(r[0] - ax, 0, ax - r[2]), Math.max(r[1] - az, 0, az - r[3]));
          if (dist > o.near) continue;
        }
        let rot: Rot = odd as Rot;
        let back: Rect | undefined;
        if (o.seaSide) {
          const s = o.seaSide(r);
          if (s === null || s[0] % 2 !== odd) continue;
          rot = s[0];
          back = s[1];
        }
        const c = check(P, r, o.cut, big, o.seaSide !== undefined);
        if (siteDebug.log) {
          const k = c ? 'ok' : whyNot(P, r, o.cut, big, o.seaSide !== undefined);
          tried[k] = (tried[k] ?? 0) + 1;
        }
        if (!c) continue;
        cands.push({ r, rot, back, score: dist + c.cut * 0.6 + (o.bonus?.(r) ?? 0) });
      }
    }
  }
  cands.sort((a, c) => a.score - c.score);
  siteDebug.log?.(`${id} at ${ax.toFixed(0)},${az.toFixed(0)}: ${JSON.stringify(tried)}`);
  const limit = huge ? SITES.levelRange.huge : big ? SITES.levelRange.big : SITES.levelRange.small;
  for (const c of cands.slice(0, 60)) {
    const [lo, hi] = rangeOf(P.b, c.r[0], c.r[1], c.r[2], c.r[3], big ? 8 : 4);
    if (!o.seaSide && hi - lo > limit) {
      siteDebug.log?.(`  ${id} too steep: ${(hi - lo).toFixed(1)} m`);
      continue;
    }
    const rot = o.seaSide ? c.rot : frontToRoad(P, c.r, o.cut, c.rot);
    return { def: id, w, d, rot, x0: c.r[0], z0: c.r[1], x1: c.r[2], z1: c.r[3], cut: o.cut, big, level: NaN, sea: c.back };
  }
  return null;
}

function take(P: Planner, s: Omit<Site, 'poi' | 'what'>, poi: number, what: string, forecourt = false): Site {
  const site: Site = { ...s, poi, what, forecourt };
  P.sites.push(site);
  P.taken.push([site.x0, site.z0, site.x1, site.z1]);
  return site;
}

// ---------------------------------------------------------------------------------------------
// Stations on their railway
// ---------------------------------------------------------------------------------------------

/** Track band (local z centre, half depth) of a station type at a size: from its blueprint's ballast beds. */
const bands = new Map<string, [number, number]>();
export function trackBand(id: string, w: number, d: number, mat: 'debris' | 'asphalt' = 'debris'): [number, number] | null {
  const key = `${id}:${w.toFixed(2)}:${d.toFixed(2)}:${mat}`;
  let v = bands.get(key);
  if (v) return v;
  const bp = generateBlueprint(buildingDef(id), w, d, 1);
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const p of bp.parts) {
    if (p.mat !== mat || p.x0 > 0.05 || p.x1 < w - 0.05 || p.y1 > 0.3) continue;
    if (mat === 'debris' && p.z1 - p.z0 > 3) continue;
    z0 = Math.min(z0, p.z0);
    z1 = Math.max(z1, p.z1);
  }
  if (!Number.isFinite(z0)) return null;
  v = [(z0 + z1) / 2, (z1 - z0) / 2];
  bands.set(key, v);
  return v;
}

/** Nearest segment of the given kinds within `reach` of a point, with the projected point. */
function nearestSeg(P: Planner, x: number, z: number, reach: number, kinds: readonly number[]): { s: Seg; px: number; pz: number; dist: number } | null {
  let best: { s: Seg; px: number; pz: number; dist: number } | null = null;
  for (const si of P.lines.near(x - reach, z - reach, x + reach, z + reach, P.scratch)) {
    const s = P.lines.segs[si]!;
    if (!kinds.includes(s.kind)) continue;
    const dx = s.bx - s.ax;
    const dz = s.bz - s.az;
    const l2 = dx * dx + dz * dz;
    const u = l2 > 0 ? Math.min(1, Math.max(0, ((x - s.ax) * dx + (z - s.az) * dz) / l2)) : 0;
    const px = s.ax + dx * u;
    const pz = s.az + dz * u;
    const dist = Math.hypot(x - px, z - pz);
    if (dist <= reach && (!best || dist < best.dist)) best = { s, px, pz, dist };
  }
  return best;
}

/**
 * A site for a type whose local x runs along a line (station tracks, the checkpoint's road), the
 * band's centre on the line through (px, pz). Moves along the line to find room. `side` > 0: the
 * front towards +z (axis x) / +x (axis z).
 */
function alongLine(P: Planner, id: string, seg: Seg, px: number, pz: number, side: number, cut: readonly number[], mat: 'debris' | 'asphalt', anySkew = false): Omit<Site, 'poi' | 'what'> | null {
  const def = buildingDef(id);
  const w = def.size.w[0];
  const d = def.size.d[0];
  const band = trackBand(id, w, d, mat);
  if (!band) return null;
  const zc = band[0];
  const ddx = seg.bx - seg.ax;
  const ddz = seg.bz - seg.az;
  const len = Math.hypot(ddx, ddz) || 1;
  const ux = ddx / len;
  const uz = ddz / len;
  const axisX = Math.abs(ux) >= Math.abs(uz);
  // How far the line strays from the type's own band at the ends of the site.
  const skew = (w / 2) * (axisX ? Math.abs(uz / ux) : Math.abs(ux / uz));
  if (skew > STATIONS.maxSkew + band[1] && !anySkew) return null;
  const rot: Rot = axisX ? (side >= 0 ? 0 : 2) : side >= 0 ? 1 : 3;
  const big = Math.max(w, d) >= SITES.big;
  let best: { r: Rect; cost: number } | null = null;
  for (const shift of [0, 16, -16, 32, -32, 48, -48, 64, -64]) {
    const cx = px + ux * shift;
    const cz = pz + uz * shift;
    // The local point (w/2, zc) on (cx, cz) — place.ts: rot 0 (x0 + lx, z0 + lz), 2 (x0 + w - lx, z0 + d - lz),
    // 1 (x0 + lz, z0 + w - lx), 3 (x0 + d - lz, z0 + lx).
    let x0: number;
    let z0: number;
    if (rot === 0) [x0, z0] = [cx - w / 2, cz - zc];
    else if (rot === 2) [x0, z0] = [cx - w / 2, cz - (d - zc)];
    else if (rot === 1) [x0, z0] = [cx - zc, cz - w / 2];
    else [x0, z0] = [cx - (d - zc), cz - w / 2];
    const [ww, wd] = rot % 2 === 0 ? [w, d] : [d, w];
    const r: Rect = [x0, z0, x0 + ww, z0 + wd];
    // Stations follow their railway to the area edge (the line crosses it anyway).
    const c = check(P, r, cut, big, false, true);
    if (!c) continue;
    const cost = c.cut + Math.abs(shift) * 2;
    if (best && cost >= best.cost) continue;
    const [lo, hi] = rangeOf(P.b, r[0], r[1], r[2], r[3], big ? 8 : 4);
    if (hi - lo > (big ? SITES.levelRange.big : SITES.levelRange.small)) continue;
    best = { r, cost };
  }
  if (!best) return null;
  const r = best.r;
  return { def: id, w, d, rot, x0: r[0], z0: r[1], x1: r[2], z1: r[3], cut, big, level: NaN };
}

// ---------------------------------------------------------------------------------------------
// What stands for each point
// ---------------------------------------------------------------------------------------------

const isOther = (c: number): boolean => c === LU.other;

/** Centroid of the "other" land (airfields) within `r` of a point, or the point. */
function otherCentroid(real: RealArea, x: number, z: number, r: number): [number, number] {
  let sx = 0;
  let sz = 0;
  let n = 0;
  for (let j = Math.max(0, Math.floor((z - r) / STEP)); j <= Math.min(LU_N - 1, Math.ceil((z + r) / STEP)); j++) {
    for (let i = Math.max(0, Math.floor((x - r) / STEP)); i <= Math.min(LU_N - 1, Math.ceil((x + r) / STEP)); i++) {
      if (Math.hypot(i * STEP - x, j * STEP - z) > r || !isOther(real.landuse[j * LU_N + i]!)) continue;
      sx += i * STEP;
      sz += j * STEP;
      n++;
    }
  }
  return n >= 20 ? [sx / n, sz / n] : [x, z];
}

/** Airport size (1 small .. 3 large) from the cell's facts, matched by name. */
function airportSize(facts: CellFacts | undefined, name: string): number {
  const list = facts?.airports ?? [];
  const core = (s: string): string => s.replace(/[（(].*[）)]/g, '').replace(/(国際)?(空港|飛行場)$/, '');
  for (const a of list) if (core(a.name) && (name.includes(core(a.name)) || core(name).includes(core(a.name)))) return a.size;
  return list.length === 1 ? list[0]!.size : 2;
}

export interface PlanInput {
  pois: MapPoi[];
  facts?: CellFacts;
  townGradeAt: (x: number, z: number) => number;
  /** Cells around (07c world context): an urban neighbour brings a field camp now and then. */
  nearCity: boolean;
}

/** Facility class of a point for the caps (data/placement.ts FACILITY_CAP), or null when no type stands for it. */
function facilityTypes(p: MapPoi, I: PlanInput, firstBigHospital: boolean): { what: keyof typeof FACILITY_CAP; ids: string[]; forecourt?: boolean } | null {
  const town = I.facts?.town ?? 3;
  const g = I.townGradeAt(p.x, p.z);
  const city = g >= 2;
  switch (p.kind) {
    case POI.prefOffice: return { what: 'prefOffice', ids: ['office.chosha', 'office.mid'], forecourt: true };
    case POI.cityHall: return { what: 'cityHall', ids: town >= 4 ? ['office.chosha', 'office.mid', 'office.rc_old'] : ['office.mid', 'office.rc_old', 'office.small'], forecourt: true };
    case POI.townHall: return { what: 'townHall', ids: ['office.rc_old', 'office.small'] };
    case POI.hospital:
      if (p.grade >= 2 && firstBigHospital) return { what: 'hospitalLarge', ids: ['public.hospital_large', 'public.hospital_mid'], forecourt: true };
      if (p.grade >= 2 || g >= 3) return { what: 'hospitalMid', ids: ['public.hospital_mid', 'public.clinic'] };
      return { what: 'clinic', ids: ['public.clinic'] };
    case POI.university: return { what: 'university', ids: g >= 3 ? ['public.univ_city', 'public.univ_rural'] : ['public.univ_rural', 'public.univ_city'], forecourt: true };
    case POI.school: {
      const lvl = p.grade === 3 ? 'high' : p.grade === 2 ? 'junior' : 'elem';
      const ids = city ? [`public.${lvl}_city`, `public.${lvl}_rural`] : [`public.${lvl}_rural`, `public.${lvl}_city`];
      return { what: lvl, ids };
    }
    case POI.police: return { what: 'police', ids: ['public.police', 'public.koban'] };
    case POI.fire: return { what: 'fire', ids: ['public.fire'] };
    default: return null;
  }
}

/** Plan every facility site of a real area (in order of size and rank). */
export function planSites(P: Planner, I: PlanInput): void {
  const { pois } = I;
  const done = new Map<string, number>();
  const count = (k: string): number => done.get(k) ?? 0;
  const add = (k: string): void => {
    done.set(k, count(k) + 1);
  };
  const usable = (p: MapPoi): boolean => p.x >= 14 && p.z >= 14 && p.x <= SIZE - 14 && p.z <= SIZE - 14;
  const idx = (kind: number): number[] => pois.map((_, i) => i).filter((i) => pois[i]!.kind === kind && usable(pois[i]!));

  // --- Airports: on the open "other" land around their point; off-shore ones keep the terminal by the bridge.
  for (const i of idx(POI.airport).sort((a, c) => airportSize(I.facts, pois[c]!.name) - airportSize(I.facts, pois[a]!.name))) {
    if (count('airport') >= FACILITY_CAP.airport) break;
    const p = pois[i]!;
    const [ax, az] = otherCentroid(P.real, p.x, p.z, 380);
    let placed = false;
    for (const id of AIRPORTS[airportSize(I.facts, p.name)] ?? AIRPORTS[1]!) {
      const s = find(P, id, ax, az, { shift: SITES.shift.airport!, cut: CUTS.airport!, bonus: (r) => -260 * luShare(P.real, r[0], r[1], r[2], r[3], isOther) });
      if (s) {
        take(P, s, i, 'airport');
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Kansai, Chubu, Tokushima: the airport island is off the area — the terminal by the bridge.
      const s = find(P, AIRPORT_TERMINAL, p.x, p.z, { shift: SITES.shift.facility!, cut: CUTS.facility! });
      if (s) take(P, s, i, 'airport', true);
      else continue;
    }
    add('airport');
  }

  // --- Air bases (shared airfields: not next to an airport already placed).
  for (const i of idx(POI.asdf)) {
    const p = pois[i]!;
    if (p.grade >= 2) {
      if (count('asdf') >= FACILITY_CAP.asdf) continue;
      if (P.sites.some((s) => s.what === 'airport' && Math.hypot((s.x0 + s.x1) / 2 - p.x, (s.z0 + s.z1) / 2 - p.z) < 500)) continue;
      const [ax, az] = otherCentroid(P.real, p.x, p.z, 380);
      const s = find(P, 'base.jasdf', ax, az, { shift: SITES.shift.asdf!, cut: CUTS.airport!, bonus: (r) => -200 * luShare(P.real, r[0], r[1], r[2], r[3], isOther) });
      if (s) {
        take(P, s, i, 'asdf');
        add('asdf');
        continue;
      }
    }
    // A radar or a sub-base on a hill: an antenna camp.
    for (const id of ['military.camp_signal', 'military.camp_watch']) {
      const s = find(P, id, p.x, p.z, { shift: SITES.shift.facility!, cut: CUTS.big! });
      if (s) {
        take(P, s, i, 'asdf');
        break;
      }
    }
  }

  // --- Navy: the back strip on the sea (air stations: an air base).
  for (const i of idx(POI.msdf)) {
    if (count('msdf') >= FACILITY_CAP.msdf) break;
    const p = pois[i]!;
    if (/航空/.test(p.name)) {
      const [ax, az] = otherCentroid(P.real, p.x, p.z, 380);
      const s = find(P, 'base.jasdf', ax, az, { shift: SITES.shift.asdf!, cut: CUTS.airport!, bonus: (r) => -200 * luShare(P.real, r[0], r[1], r[2], r[3], isOther) });
      if (s) {
        take(P, s, i, 'msdf');
        add('msdf');
      }
      continue;
    }
    const seaSide = (r: Rect): [Rot, Rect] | null => {
      const [x0, z0, x1, z1] = r;
      const back = NAVY.back;
      // Back strip of each rotation (front faces rot; back is the opposite side).
      const strips: [Rot, Rect, Rect][] = [
        [0, [x0, z0, x1, z0 + back], [x0, z0 + back, x1, z1]],
        [2, [x0, z1 - back, x1, z1], [x0, z0, x1, z1 - back]],
        [1, [x0, z0, x0 + back, z1], [x0 + back, z0, x1, z1]],
        [3, [x1 - back, z0, x1, z1], [x0, z0, x1 - back, z1]],
      ];
      for (const [rot, strip, rest] of strips) {
        if (luShare(P.real, strip[0], strip[1], strip[2], strip[3], (c) => c === LU.sea || c === LU.water) < NAVY.seaBack) continue;
        if (wetTiles(P, rest[0], rest[1], rest[2], rest[3]) > ((rest[2] - rest[0]) * (rest[3] - rest[1])) / (TILE * TILE) * NAVY.wetRest) continue;
        return [rot, strip];
      }
      return null;
    };
    const s = find(P, 'base.jmsdf', p.x, p.z, { shift: SITES.shift.msdf!, cut: CUTS.navy!, seaSide });
    if (s) {
      take(P, s, i, 'msdf');
      add('msdf');
    }
  }

  // --- Garrisons: one compound at the annotation (a division's headquarters annotation merges with its post).
  const gs = idx(POI.gsdf).sort((a, c) => pois[c]!.grade - pois[a]!.grade);
  const gsDone: [number, number][] = [];
  for (const i of gs) {
    if (count('gsdf') >= FACILITY_CAP.gsdf) break;
    const p = pois[i]!;
    if (gsDone.some(([x, z]) => Math.hypot(x - p.x, z - p.z) < 400)) continue;
    // A division's post out in the open (little town within 500 m) may be the large one, its training grounds around it.
    // So may a garrison deep in the countryside (rural or forest cell, hardly any town around: 上富良野, 玖珠...).
    const town500 = luShare(P.real, p.x - 500, p.z - 500, p.x + 500, p.z + 500, (c) => c === LU.building);
    const land = P.b.params.land;
    const large = (p.grade >= 3 && town500 < SITES.sparseTown && land !== 'urban') || (p.grade === 2 && town500 < SITES.wildTown && (land === 'rural' || land === 'forest'));
    const ids = large ? GARRISON_LARGE : GARRISONS[p.grade] ?? GARRISONS[2]!;
    for (const id of ids) {
      // 07d-3 prompt: the compound stays within 150 m of its annotation.
      const s = find(P, id, p.x, p.z, { shift: 0, near: SITES.shift.gsdf!, cut: CUTS.base! });
      if (s) {
        take(P, s, i, 'gsdf');
        add('gsdf');
        gsDone.push([p.x, p.z]);
        break;
      }
    }
  }

  // --- Stations on their railway: the busiest takes its grade, the next ones a smaller type.
  const st = idx(POI.station).sort((a, c) => pois[c]!.grade - pois[a]!.grade);
  let nth = 0;
  const town = I.facts?.town ?? 3;
  for (const i of st) {
    if (count('station') >= STATIONS.max) break;
    const p = pois[i]!;
    let grade = p.grade;
    if (grade >= 4 && town < 4) grade = 3;
    if (nth === 1) grade = Math.min(grade, STATIONS.second);
    else if (nth >= 2) grade = Math.min(grade, STATIONS.others);
    const rail = nearestSeg(P, p.x, p.z, STATIONS.railReach, [LINE.rail, LINE.shinkansen]);
    let site: Omit<Site, 'poi' | 'what'> | null = null;
    if (rail) {
      const s = rail.s;
      // Front (station house) on the annotation's side of the line.
      const axisX = Math.abs(s.bx - s.ax) >= Math.abs(s.bz - s.az);
      const off = axisX ? p.z - rail.pz : p.x - rail.px;
      const side = Math.abs(off) < 3 ? 1 : Math.sign(off);
      for (let g = grade; g >= 0 && !site; g--) site = alongLine(P, STATIONS.types[g]!, s, rail.px, rail.pz, side, CUTS.station!, 'debris');
      // A line running at a slant: the small station on it all the same, and for a busy station its
      // station-front building by the annotation.
      if (!site) {
        site = alongLine(P, STATIONS.types[0]!, s, rail.px, rail.pz, side, CUTS.station!, 'debris', true);
        if (site && grade >= 1) {
          take(P, site, i, 'station');
          site = find(P, STATIONS.underground, p.x, p.z, { shift: SITES.shift.facility!, cut: CUTS.facility! });
          if (!site) {
            add('station');
            nth++;
            continue;
          }
        }
      }
    } else {
      // Underground (subway, a line in a tunnel): the station-front building over it.
      site = find(P, STATIONS.underground, p.x, p.z, { shift: SITES.shift.station!, cut: CUTS.facility! });
    }
    if (!site) continue;
    take(P, site, i, 'station', !rail);
    add('station');
    nth++;
  }

  // --- In front of the main station of a city: a department store and a tower or two (駅前).
  const main = P.sites.find((st) => st.what === 'station' && /station_(city|pref|seirei)$/.test(st.def));
  if (main && town >= 3) {
    const [fx, fz] = frontOf(main, STATION_FRONT.reach);
    for (const id of STATION_FRONT.types[Math.min(5, town)] ?? []) {
      const s = find(P, id, fx, fz, { shift: STATION_FRONT.shift, cut: CUTS.facility! });
      if (s) take(P, s, -1, 'front');
    }
  }

  // --- The other facilities, the rarer and larger first; per-area caps; at least one of each kind present.
  const order = [POI.prefOffice, POI.cityHall, POI.hospital, POI.university, POI.police, POI.fire, POI.school, POI.townHall];
  let bigHospital = true;
  for (const kind of order) {
    const list = idx(kind);
    if (kind === POI.hospital) list.sort((a, c) => pois[c]!.grade - pois[a]!.grade);
    else if (kind === POI.school) list.sort((a, c) => pois[c]!.grade - pois[a]!.grade || hashOf(a) - hashOf(c));
    else if (kind === POI.police || kind === POI.fire) list.sort((a, c) => pois[a]!.grade - pois[c]!.grade);
    const tried = new Map<string, number>();
    for (const i of list) {
      const p = pois[i]!;
      const f = facilityTypes(p, I, bigHospital);
      if (!f) continue;
      if (count(f.what) >= FACILITY_CAP[f.what]) continue;
      const n = tried.get(f.what) ?? 0;
      if (n >= FACILITY_CAP[f.what] * 4) continue;
      tried.set(f.what, n + 1);
      const big = Math.max(...f.ids.map((id) => buildingDef(id).size.w[0])) >= 60;
      let s: Omit<Site, 'poi' | 'what'> | null = null;
      for (const id of f.ids) {
        s = find(P, id, p.x, p.z, { shift: SITES.shift.facility!, cut: big ? CUTS.big! : CUTS.facility!, size: 'random' });
        if (s) break;
      }
      if (!s) continue;
      if (f.what === 'hospitalLarge') bigHospital = false;
      take(P, s, i, f.what, f.forecourt);
      add(f.what);
    }
    // One of each kind the area holds (07d-3: "セルに 1 つだけの施設は必ず 1 つ"): a wider search and more cuts.
    if (list.length > 0 && !list.some((i) => P.sites.some((s) => s.poi === i))) {
      for (const i of list.slice(0, 3)) {
        const p = pois[i]!;
        const f = facilityTypes(p, I, bigHospital);
        if (!f) continue;
        let s: Omit<Site, 'poi' | 'what'> | null = null;
        for (const id of [...f.ids].reverse()) {
          s = find(P, id, p.x, p.z, { shift: SITES.shift.facility! * 2, cut: CUTS.base! });
          if (s) break;
        }
        if (s) {
          take(P, s, i, f.what, f.forecourt);
          add(f.what);
          break;
        }
      }
    }
  }

  // --- A field camp of the army around the cities (07d-2f ruins), on open ground by a main road.
  const town2 = I.facts?.town ?? 0;
  const campChance = I.nearCity && CAMPS.lands.includes(P.b.params.land) ? CAMPS.chance : town2 >= 3 && CAMPS.lands.includes(P.b.params.land) ? CAMPS.cityChance : 0;
  if (campChance > 0 && chance(P.rng, campChance)) {
    const id = CAMPS.types[Math.floor(rand(P.rng) * CAMPS.types.length)]!;
    for (let k = 0; k < 12; k++) {
      // A point of a main road away from the middle.
      const mains = P.lines.segs.filter((s) => s.kind === LINE.national || s.kind === LINE.prefectural);
      if (mains.length === 0) break;
      const s = mains[Math.floor(rand(P.rng) * mains.length)]!;
      const u = rand(P.rng);
      const px = s.ax + (s.bx - s.ax) * u;
      const pz = s.az + (s.bz - s.az) * u;
      const off = 40 + rand(P.rng) * 60;
      const a = rand(P.rng) * Math.PI * 2;
      const site = id === 'military.camp_checkpoint'
        ? alongLine(P, id, s, px, pz, rand(P.rng) < 0.5 ? 1 : -1, [s.kind, LINE.local, LINE.wide], 'asphalt')
        : find(P, id, px + Math.cos(a) * off, pz + Math.sin(a) * off, { shift: 48, cut: CUTS.facility!, bonus: (r) => 120 * luShare(P.real, r[0], r[1], r[2], r[3], (c) => c === LU.building) });
      if (site) {
        take(P, site, -1, 'camp');
        break;
      }
    }
  }
}

/** A point `out` metres in front of a site (the side its front faces), at the middle of that side. */
function frontOf(s: Site, out: number): [number, number] {
  const cx = (s.x0 + s.x1) / 2;
  const cz = (s.z0 + s.z1) / 2;
  if (s.rot === 0) return [cx, s.z1 + out];
  if (s.rot === 2) return [cx, s.z0 - out];
  if (s.rot === 1) return [s.x1 + out, cz];
  return [s.x0 - out, cz];
}

const hashOf = (i: number): number => {
  let h = Math.imul(i + 0x9e37, 0x85ebca6b);
  h ^= h >>> 13;
  return (Math.imul(h, 0xc2b2ae35) >>> 0) / 2 ** 32;
};

/**
 * L1: a landmark's site (docs/realmap_guide.md §7), planned before the facilities so that they, the
 * town streets and the minor roads (`cut`: they stop at its fence) keep out of it. Its front faces
 * `rot` (the table's); the centre moves at most `reach` m from the shrunk real point, then twice and
 * three times as far, onto dry ground clear of the roads that stay. The footprint is the type's
 * largest. Null when nothing fits (the census and the tests report it).
 */
export function planLandmark(P: Planner, id: string, x: number, z: number, rot: Rot, reach: number, poi: number, opts: { level?: number; drain?: number; cutRoads?: boolean } = {}): Site | null {
  const def = buildingDef(id);
  const w = def.size.w[1];
  const d = def.size.d[1];
  const big = Math.max(w, d) >= SITES.big;
  // L3a: `cutRoads` lets the lot stop the expressways and national roads too (central Tokyo).
  const cut = opts.cutRoads ? CUTS.landmarkRoads! : CUTS.landmark!;
  // L2: a landmark may ask for more slope (`level`, m: a temple on a mountainside, its terrace cut
  // into the hill) or to stand over a share of water (`drain`: a castle over the remains of its own
  // moat in the area data; the water under the lot is filled, the blueprint digs its own).
  const range = opts.level ?? (big ? SITES.levelRange.big : SITES.levelRange.small);
  const drain = opts.drain ?? 0;
  for (const far of [reach, reach * 2, reach * 3]) {
    const step = far <= 60 ? 4 : 8;
    let best: { r: Rect; score: number } | null = null;
    for (let dz = -far; dz <= far; dz += step) {
      for (let dx = -far; dx <= far; dx += step) {
        const dist = Math.hypot(dx, dz);
        if (dist > far || (best && dist > best.score)) continue;
        const r = rectOf(x + dx, z + dz, w, d, rot);
        const c = check(P, r, cut, big, drain > 0, true);
        if (!c) continue;
        if (drain > 0 && wetTiles(P, r[0], r[1], r[2], r[3]) > ((r[2] - r[0]) * (r[3] - r[1]) * drain) / (TILE * TILE)) continue;
        const [lo, hi] = rangeOf(P.b, r[0], r[1], r[2], r[3], big ? 8 : 4);
        if (hi - lo > range) continue;
        const score = dist + c.cut * 0.3;
        if (!best || score < best.score) best = { r, score };
      }
    }
    if (best) return take(P, { def: id, w, d, rot, x0: best.r[0], z0: best.r[1], x1: best.r[2], z1: best.r[3], cut, big, level: NaN }, poi, 'landmark');
  }
  return null;
}

/** Mark the landmarks and lookout towers of the area as taken before the sites are planned. */
export function reserve(P: Planner, x: number, z: number, half: number): void {
  P.taken.push([x - half, z - half, x + half, z + half]);
}

// ---------------------------------------------------------------------------------------------
// Levelling and road cuts
// ---------------------------------------------------------------------------------------------

/** Level the ground under each site (and blend it into the ground around). Water vertices stay. */
export function levelSites(b: Builder, sites: Site[], water: Float32Array): void {
  const N = TILES + 1;
  for (const s of sites) {
    // Level to the median of the dry ground under it.
    const hs: number[] = [];
    for (let z = s.z0; z <= s.z1; z += 6) for (let x = s.x0; x <= s.x1; x += 6) {
      const i = Math.round(z / TILE) * N + Math.round(x / TILE);
      if (!Number.isFinite(water[i]!) && !inRect(s.sea, x, z)) hs.push(hAt(b, x, z));
    }
    if (hs.length === 0) continue;
    hs.sort((a, c) => a - c);
    const level = hs[Math.floor(hs.length / 2)]!;
    s.level = level;
    forTiles(s.x0, s.z0, s.x1, s.z1, (t, tx, ty) => {
      if (b.ground[t] === GROUND.water && !inRect(s.sea, (tx + 0.5) * TILE, (ty + 0.5) * TILE)) b.ground[t] = GROUND.grass;
    });
    const blend = Math.max(s.x1 - s.x0, s.z1 - s.z0) >= SITES.huge ? SITES.blendHuge : SITES.blend;
    const ix0 = Math.max(0, Math.floor((s.x0 - blend) / TILE));
    const ix1 = Math.min(N - 1, Math.ceil((s.x1 + blend) / TILE));
    const iz0 = Math.max(0, Math.floor((s.z0 - blend) / TILE));
    const iz1 = Math.min(N - 1, Math.ceil((s.z1 + blend) / TILE));
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const i = iz * N + ix;
      const x = ix * TILE;
      const z = iz * TILE;
      if (Number.isFinite(water[i]!)) {
        // A pond, a ditch or the shore under a site (not the navy's sea strip): drained and filled.
        if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1 || inRect(s.sea, x, z)) continue;
        water[i] = NaN;
      }
      if (inRect(s.sea, x, z)) continue;
      const out = Math.hypot(Math.max(s.x0 - x, 0, x - s.x1), Math.max(s.z0 - z, 0, z - s.z1));
      if (out >= blend) continue;
      const w = (1 - smooth(out / blend)) * editFade(x, z);
      b.height[i] = b.height[i]! + (level - b.height[i]!) * w;
    }
  }
}
const smooth = (t: number): number => t * t * (3 - 2 * t);
const inRect = (r: Rect | undefined, x: number, z: number): boolean => r !== undefined && x >= r[0] - 4 && x <= r[2] + 4 && z >= r[1] - 4 && z <= r[3] + 4;

/**
 * The pieces of a line that stay: the parts inside a site that cuts its kind are left out (the
 * road stops a little outside the fence). Lines no site touches come back as they are.
 */
export function cutLine(pts: [number, number][], kind: number, width: number, sites: readonly Site[]): [number, number][][] {
  const hit = sites.filter((s) => s.cut.includes(kind) && pts.some(([x, z], k) => {
    if (k === 0) return false;
    const [px, pz] = pts[k - 1]!;
    return clipLength(px, pz, x, z, s.x0 - width / 2 - 2, s.z0 - width / 2 - 2, s.x1 + width / 2 + 2, s.z1 + width / 2 + 2) > 0;
  }));
  if (hit.length === 0) return [pts];
  const inside = (x: number, z: number): boolean => hit.some((s) => x > s.x0 - width / 2 - 2 && x < s.x1 + width / 2 + 2 && z > s.z0 - width / 2 - 2 && z < s.z1 + width / 2 + 2);
  const out: [number, number][][] = [];
  let run: [number, number][] = [];
  const flush = (): void => {
    if (run.length >= 2 && run.some((p, k) => k > 0 && Math.hypot(p[0] - run[k - 1]![0], p[1] - run[k - 1]![1]) > 0)) {
      let len = 0;
      for (let k = 1; k < run.length; k++) len += Math.hypot(run[k]![0] - run[k - 1]![0], run[k]![1] - run[k - 1]![1]);
      const atEdge = (p: [number, number]): boolean => Math.min(p[0], p[1], SIZE - p[0], SIZE - p[1]) < 0.5;
      if (len >= 6 || atEdge(run[0]!) || atEdge(run[run.length - 1]!)) out.push(run);
    }
    run = [];
  };
  for (let k = 0; k < pts.length; k++) {
    const [x, z] = pts[k]!;
    if (k > 0) {
      // Walk the segment in 2 m steps: where it enters a site the run ends, where it leaves one starts.
      const [px, pz] = pts[k - 1]!;
      const n = Math.max(1, Math.ceil(Math.hypot(x - px, z - pz) / 2));
      for (let j = 1; j < n; j++) {
        const qx = px + ((x - px) * j) / n;
        const qz = pz + ((z - pz) * j) / n;
        const inQ = inside(qx, qz);
        if (inQ && run.length > 0) {
          run.push([qx, qz]);
          flush();
        } else if (!inQ && run.length === 0) run.push([qx, qz]);
      }
    }
    if (inside(x, z)) {
      // The road reaches into the cut zone at this vertex: it ends there (a step past the fence's margin).
      if (run.length > 0) run.push([x, z]);
      flush();
    } else run.push([x, z]);
  }
  flush();
  return out;
}
