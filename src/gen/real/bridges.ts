// L9: bridge landmarks laid from bank to bank in the real areas (docs/realmap_guide.md §7, L9).
// L10: and the ordinary bridges (src/data/bridges/ordinary.ts): every road and railway over water
// 30 m wide or more.
//
// R0 carries every road over the water on an embankment (layout.ts causeway). A bridge replaces that
// embankment along its line: in each area the line crosses,
//   1. the area's roads and railways that run along the line are cut where the bridge is (cutByBridges)
//      — the deck carries them (their lanes and tracks are drawn on it);
//   2. the walkers are carried by the bridge's hidden boxes over the water (L10: the water and its bed
//      stay under the deck, so bullets and eyes pass under it) — or, for 'ground' (L9's way), the
//      ground under the deck is raised to the deck's height and its tiles are not drawn as terrain
//      (TacticalMap.decks). An ordinary bridge's ramps on the land are earth (the ground is raised to
//      the deck there); a landmark's run over the land on its hidden boxes (roads pass under them);
//   3. the bridge itself is one placement of its building type (never turned, `span` = the line in the
//      lot's frame), with collision boxes for its towers, anchorages, parapets and deck.
// The bridge's deck heights come from the table (`ends`) and the design, never from one area's ground,
// so that two areas sharing a bridge (the Akashi Kaikyō, the ordinary bridges on a cell's edge) raise
// the same ground on their common edge.
//
// Pure (no DOM).

import { ORDINARY_BRIDGES } from '../../data/bridges/ordinary.ts';
import { LINE_KIND_RAIL, type OrdinaryBridgeRow } from '../../data/bridges/types.ts';
import { LANDMARKS, LANDMARK_GRID, type LandmarkSpot } from '../../data/landmarks/index.ts';
import { TACTICAL } from '../../data/tactical.ts';
import { bridgeDesign, bridgeLayout, bridgeReach, carryOf, pathFrame, withDeck, type BridgeDesign, type BridgeLayout, type PathFrame } from '../buildings/defs/landmark/bridge.ts';
import { ORDINARY_BRIDGE_RAIL, ORDINARY_BRIDGE_ROAD } from '../buildings/defs/landmark/ordinary_bridge.ts';
import { blueprintOf, localColliders, makePlacement } from '../buildings/index.ts';
import type { BridgeSpan } from '../buildings/types.ts';
import { addRoad, homeDist, N, SIZE, TILE, TILES, type Builder } from '../builder.ts';
import { GROUND } from '../types.ts';

export interface BridgeAt {
  /** The building type. */
  id: string;
  /** Seeds the placement (the landmark's id, an ordinary bridge's row). */
  key: string;
  /** The table's landmark row (absent for an ordinary bridge). */
  spot?: LandmarkSpot;
  /** L10: the row of an ordinary bridge. */
  row?: number;
  design: BridgeDesign;
  /** L10: the deck of an ordinary bridge (its width and tracks). */
  deck?: BridgeSpan['deck'];
  ends: [number, number];
  /** The whole line in this area's frame (it may run outside the square). */
  path: [number, number][];
  f: PathFrame;
  lay: BridgeLayout;
  /** The stretch of the line inside this area (m along it). */
  from: number;
  to: number;
  /** Half the deck's width, and of everything beside it. */
  hw: number;
  reach: number;
  /** Half-width of the band where the area's lines along the deck are cut. */
  cut: number;
}

/** A real point in a cell's area frame (m from its north-west corner; outside the square when the point is in another cell). */
export function realInCell(cell: number, lat: number, lon: number): [number, number] {
  const G = LANDMARK_GRID;
  const fy = ((G.latTop - lat) * G.kmPerLat) / G.cellKm;
  const fx = ((lon - G.lon0) * G.kmPerLon) / G.cellKm;
  return [(fx - (cell % G.gridW)) * SIZE, (fy - Math.floor(cell / G.gridW)) * SIZE];
}

/** The stretch of a path inside the area's square (each segment clipped, exactly: two areas sharing it meet at the same s). */
function inside(path: [number, number][]): [number, number] | null {
  let from = Infinity;
  let to = -Infinity;
  let acc = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, az] = path[i]!;
    const [bx, bz] = path[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    let t0 = 0;
    let t1 = 1;
    const clip = (p: number, q: number): boolean => {
      if (Math.abs(p) < 1e-12) return q >= 0;
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      return true;
    };
    const dx = bx - ax;
    const dz = bz - az;
    if (clip(-dx, ax) && clip(dx, SIZE - ax) && clip(-dz, az) && clip(dz, SIZE - az) && t0 < t1) {
      from = Math.min(from, acc + t0 * len);
      to = Math.max(to, acc + t1 * len);
    }
    acc += len;
  }
  return to > from ? [from, to] : null;
}

/** L10: the ordinary bridges' rows by the cells their line runs through (built on first use). */
let byCell: Map<number, number[]> | null = null;
function ordinaryRows(cell: number): number[] {
  if (!byCell) {
    byCell = new Map();
    const W = LANDMARK_GRID.gridW;
    ORDINARY_BRIDGES.forEach((r, i) => {
      const cells = new Set<number>();
      for (let k = 0; k + 3 < r.p.length; k += 2) {
        const [ax, az, bx, bz] = [r.p[k]!, r.p[k + 1]!, r.p[k + 2]!, r.p[k + 3]!];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 4));
        for (let j = 0; j <= n; j++) cells.add(Math.floor((az + ((bz - az) * j) / n) / SIZE) * W + Math.floor((ax + ((bx - ax) * j) / n) / SIZE));
      }
      for (const c of cells) {
        const l = byCell!.get(c);
        if (l) l.push(i);
        else byCell!.set(c, [i]);
      }
    });
  }
  return byCell.get(cell) ?? [];
}

/** L10: an ordinary bridge's row in a cell's frame. */
function ordinaryAt(cell: number, i: number, r: OrdinaryBridgeRow): BridgeAt | null {
  const W = LANDMARK_GRID.gridW;
  const ox = (cell % W) * SIZE;
  const oz = Math.floor(cell / W) * SIZE;
  const path: [number, number][] = [];
  for (let k = 0; k + 1 < r.p.length; k += 2) path.push([r.p[k]! - ox, r.p[k + 1]! - oz]);
  const st = inside(path);
  if (!st) return null;
  const def = r.k === LINE_KIND_RAIL ? ORDINARY_BRIDGE_RAIL : ORDINARY_BRIDGE_ROAD;
  const deck = { width: r.w, rails: r.r ? [...r.r] : r.k === LINE_KIND_RAIL ? undefined : [] };
  const design = withDeck(bridgeDesign(def.id)!, deck);
  const f = pathFrame(path);
  const ends: [number, number] = [r.e[0], r.e[1]];
  const lay = bridgeLayout(design, f.length, ends, r.l);
  return { id: def.id, key: `ordinary.${i}`, row: i, design, deck, ends, path, f, lay, from: st[0], to: st[1], hw: r.w / 2, reach: bridgeReach(design), cut: r.c };
}

/**
 * The bridges whose line runs through a cell's area, with their geometry there: the table's bridge
 * landmarks, then (L10) the ordinary bridges — none of those in the home clearing of the home area.
 */
export function bridgesIn(cell: number, isHome = false): BridgeAt[] {
  const out: BridgeAt[] = [];
  for (const spot of LANDMARKS) {
    if (!spot.bridge) continue;
    const design = bridgeDesign(spot.id);
    if (!design) continue;
    const path = spot.bridge.path.map(([lat, lon]) => realInCell(cell, lat, lon));
    const st = inside(path);
    if (!st) continue;
    const f = pathFrame(path);
    const ends: [number, number] = [spot.bridge.ends[0], spot.bridge.ends[1]];
    const lay = bridgeLayout(design, f.length, ends, spot.bridge.water ?? 0);
    out.push({ id: spot.id, key: spot.id, spot, design, ends, path, f, lay, from: st[0], to: st[1], hw: design.deck.width / 2, reach: bridgeReach(design), cut: design.deck.width / 2 + 3 });
  }
  for (const i of ordinaryRows(cell)) {
    const b = ordinaryAt(cell, i, ORDINARY_BRIDGES[i]!);
    if (!b) continue;
    if (isHome && b.path.some((_, k) => k + 1 < b.path.length && nearHome(b.path[k]!, b.path[k + 1]!))) continue;
    out.push(b);
  }
  return out;
}

/** A segment within the home's blended ground (the base's clearing). */
function nearHome(a: [number, number], b: [number, number]): boolean {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let s = 0; s <= len; s += 4) {
    const t = len > 0 ? s / len : 0;
    if (homeDist(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) < TACTICAL.homeBlendRadius + 30) return true;
  }
  return false;
}

/**
 * Where (x, z) lies along a bridge: s along the line and the offset across it, for points that are
 * level with the line (0 ≤ s ≤ length, not beyond its ends). Null beyond the ends.
 */
function across(b: BridgeAt, x: number, z: number): { s: number; off: number } | null {
  let best: { s: number; off: number } | null = null;
  let acc = 0;
  for (let i = 0; i + 1 < b.path.length; i++) {
    const [ax, az] = b.path[i]!;
    const [bx, bz] = b.path[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const tx = (bx - ax) / len;
    const tz = (bz - az) / len;
    const u = (x - ax) * tx + (z - az) * tz;
    const inner = i > 0 ? -2 : 0;
    const outer = i + 2 < b.path.length ? len + 2 : len;
    if (u >= inner && u <= outer) {
      const off = (x - ax) * tz - (z - az) * tx;
      if (!best || Math.abs(off) < Math.abs(best.off)) best = { s: acc + Math.min(len, Math.max(0, u)), off };
    }
    acc += len;
  }
  return best;
}

/**
 * Cut a road or railway (area polyline) where it runs along a bridge's deck (within the deck's width
 * plus 3 m, in the line's direction ±45°): the pieces outside. Lines that only cross under or over the
 * bridge are kept.
 */
export function cutByBridges(pts: [number, number][], bridges: readonly BridgeAt[]): [number, number][][] {
  if (bridges.length === 0 || pts.length < 2) return [pts];
  const near = bridges.filter((b) => {
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    const r = Math.max(b.reach, b.cut) + 10;
    return Math.min(...xs) < Math.max(...b.path.map((p) => p[0])) + r && Math.max(...xs) > Math.min(...b.path.map((p) => p[0])) - r && Math.min(...zs) < Math.max(...b.path.map((p) => p[1])) + r && Math.max(...zs) > Math.min(...b.path.map((p) => p[1])) - r;
  });
  if (near.length === 0) return [pts];
  // Dense points (every 2 m), each marked inside or outside a deck.
  const dense: { p: [number, number]; inside: boolean }[] = [];
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, az] = pts[k]!;
    const [bx, bz] = pts[k + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / 2));
    const dx = (bx - ax) / Math.max(1e-9, len);
    const dz = (bz - az) / Math.max(1e-9, len);
    for (let i = 0; i < n; i++) {
      const x = ax + ((bx - ax) * i) / n;
      const z = az + ((bz - az) * i) / n;
      dense.push({ p: [x, z], inside: near.some((b) => insideDeck(b, x, z, dx, dz)) });
    }
  }
  const last = pts[pts.length - 1]!;
  const lk = pts.length - 2;
  const ldx = last[0] - pts[lk]![0];
  const ldz = last[1] - pts[lk]![1];
  const ll = Math.hypot(ldx, ldz) || 1;
  dense.push({ p: [last[0], last[1]], inside: near.some((b) => insideDeck(b, last[0], last[1], ldx / ll, ldz / ll)) });
  const out: [number, number][][] = [];
  let run: [number, number][] = [];
  for (const d of dense) {
    if (d.inside) {
      if (run.length >= 2) out.push(run);
      run = [];
    } else run.push(d.p);
  }
  if (run.length >= 2) out.push(run);
  return out;
}

function insideDeck(b: BridgeAt, x: number, z: number, dx: number, dz: number): boolean {
  const a = across(b, x, z);
  if (!a || Math.abs(a.off) > b.cut || a.s <= 0.5 || a.s >= b.f.length - 0.5) return false;
  const t = b.f.at(a.s);
  return Math.abs(dx * t.tx + dz * t.tz) > 0.7;
}

/**
 * Lay the bridges of an area (after its roads): roads to the ends where none meets them, the ground
 * under the deck raised (TacticalMap.decks), the placement and its collision boxes.
 */
export function layBridges(b: Builder, bridges: readonly BridgeAt[], water: Float32Array): void {
  for (const br of bridges) {
    connectEnds(b, br);
    keepClear(b, br);
    place(b, br, water);
  }
}

/**
 * The ground under the decks, once the area is built (the town's streets grade the ground they run
 * on: done before, they would undo the ends' blend).
 */
export function finishBridges(b: Builder, bridges: readonly BridgeAt[], water: Float32Array): void {
  if (bridges.length === 0) return;
  const decks = (b.decks ??= new Uint8Array(TILES * TILES));
  for (const br of bridges) raiseDeck(b, br, water, decks);
}

/** The tiles under the deck and round its ends are taken (no house, field or tree there). */
function keepClear(b: Builder, br: BridgeAt): void {
  const r = br.hw + 1;
  for (let s = Math.max(-17, br.from - 17); s <= Math.min(br.f.length + 17, br.to + 17); s += 1) {
    const p = br.f.at(Math.min(br.f.length, Math.max(0, s)));
    const u = s < 0 ? s : s > br.f.length ? s - br.f.length : 0;
    const x = p.x + p.tx * u;
    const z = p.z + p.tz * u;
    for (let o = -r; o <= r; o += 2) {
      const tx = Math.floor((x + p.nx * o) / TILE);
      const tz = Math.floor((z + p.nz * o) / TILE);
      if (tx >= 0 && tz >= 0 && tx < TILES && tz < TILES) b.occupied[tz * TILES + tx] = 1;
    }
  }
}

/** A short road from each end of the bridge inside the area to the nearest road, when none meets it. */
function connectEnds(b: Builder, br: BridgeAt): void {
  for (const s of [0, br.f.length]) {
    if (s < br.from - 0.5 || s > br.to + 0.5) continue;
    const p = br.f.at(s);
    if (p.x < 8 || p.z < 8 || p.x > SIZE - 8 || p.z > SIZE - 8) continue;
    let best: [number, number] | null = null;
    let bd = Infinity;
    let meets = false;
    for (const r of b.roads) {
      for (const q of r.pts) {
        const d = Math.hypot(q[0] - p.x, q[1] - p.z);
        if (d < br.hw + 6) meets = true;
        // Not back along the bridge: the road must lie out beyond its end.
        const dir = s === 0 ? -1 : 1;
        if (((q[0] - p.x) * p.tx + (q[1] - p.z) * p.tz) * dir < 4) continue;
        if (d < bd) {
          bd = d;
          best = [q[0], q[1]];
        }
      }
    }
    if (meets || !best || bd > 80) continue;
    // Out of the end along the bridge first, then to the road.
    const dir = s === 0 ? -1 : 1;
    const out: [number, number] = [p.x + p.tx * dir * 6, p.z + p.tz * dir * 6];
    addRoad(b, 'street', 8, [[p.x, p.z], out, best], true);
  }
}

/** The ground under the deck at the deck's height (water kept), blended into the land beyond the ends. */
function raiseDeck(b: Builder, br: BridgeAt, water: Float32Array, decks: Uint8Array): void {
  const band = br.hw + 1;
  const xs = br.path.map((p) => p[0]);
  const zs = br.path.map((p) => p[1]);
  const R = br.reach + 16;
  const ix0 = Math.max(0, Math.floor((Math.min(...xs) - R) / TILE));
  const ix1 = Math.min(N - 1, Math.ceil((Math.max(...xs) + R) / TILE));
  const iz0 = Math.max(0, Math.floor((Math.min(...zs) - R) / TILE));
  const iz1 = Math.min(N - 1, Math.ceil((Math.max(...zs) + R) / TILE));
  if (ix0 > ix1 || iz0 > iz1) return;
  const W = ix1 - ix0 + 1;
  // 1 = raised over water, 2 = raised on land (or the blend beyond an end).
  const raised = new Uint8Array(W * (iz1 - iz0 + 1));
  const BLEND = 14;
  const ends = br.ends;
  const carry = carryOf(br.design);
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const x = ix * TILE;
      const z = iz * TILE;
      const i = iz * N + ix;
      const a = across(br, x, z);
      if (a && Math.abs(a.off) <= band && a.s > 0.01 && a.s < br.f.length - 0.01) {
        const wet = Number.isFinite(water[i]!);
        if (wet && carry === 'ground') {
          // L9's way: over the water the ground rises to the deck (and its tiles are not drawn).
          b.height[i] = br.lay.deck(a.s);
          raised[(iz - iz0) * W + ix - ix0] = 1;
        } else if (!wet && carry === 'water') {
          // L10, an ordinary bridge: its ramps on the land are earth, up to the deck.
          b.height[i] = br.lay.deck(a.s);
          raised[(iz - iz0) * W + ix - ix0] = 2;
        } else if (wet) {
          // L10: the water and its bed stay under the deck (the bridge's hidden boxes carry it).
        } else {
          // The abutments: the last 4 m at each end are the deck's height (the ground meets it flush).
          if (a.s < 4 || a.s > br.f.length - 4) b.height[i] = br.lay.deck(a.s);
          // A hill higher than the deck is cut down to it (the road runs in a cutting, not buried).
          else b.height[i] = Math.min(b.height[i]!, br.lay.deck(a.s) - 0.05);
          raised[(iz - iz0) * W + ix - ix0] = 2;
        }
        continue;
      }
      // Beyond an end: the ground eases to the deck's end over BLEND m (where the road comes in).
      for (const [k, s] of [[0, 0], [1, br.f.length]] as const) {
        const p = br.f.at(s);
        const dir = k === 0 ? -1 : 1;
        const u = ((x - p.x) * p.tx + (z - p.z) * p.tz) * dir;
        const off = Math.abs((x - p.x) * p.tz - (z - p.z) * p.tx);
        // Level with the deck's end over the first 3 m (the bridge's boxes run 2.5 m out onto it), then easing.
        if (u < 0 || u > BLEND + 3 || off > band) continue;
        const w = 1 - Math.max(0, u - 3) / BLEND;
        const e = w * w * (3 - 2 * w);
        // (A shore under the end is raised too: the water stays, the ground comes up out of it.)
        b.height[i] = b.height[i]! + (ends[k]! - b.height[i]!) * e;
      }
    }
  }
  // The tiles whose middle is on the deck (1 m in from its parapets) are walked.
  const walkMask = (b.deckWalk ??= new Uint8Array(TILES * TILES));
  for (let ty = Math.max(0, iz0 - 1); ty < Math.min(TILES, iz1 + 1); ty++) {
    for (let tx = Math.max(0, ix0 - 1); tx < Math.min(TILES, ix1 + 1); tx++) {
      const a = across(br, (tx + 0.5) * TILE, (ty + 0.5) * TILE);
      if (a && Math.abs(a.off) <= Math.max(br.hw - 1.2, 2.1) && a.s > 1 && a.s < br.f.length - 1) walkMask[ty * TILES + tx] = 1;
    }
  }
  for (let ty = iz0; ty < iz1; ty++) {
    for (let tx = ix0; tx < ix1; tx++) {
      const c = [raised[(ty - iz0) * W + tx - ix0]!, raised[(ty - iz0) * W + tx + 1 - ix0]!, raised[(ty + 1 - iz0) * W + tx - ix0]!, raised[(ty + 1 - iz0) * W + tx + 1 - ix0]!];
      if (!c.some((v) => v > 0)) continue;
      const t = ty * TILES + tx;
      // Raised over the water: the terrain is not drawn where the water's surface is (the deck and the
      // water under it are), and it is walked where all its corners are the deck.
      const wet = [ty * N + tx, ty * N + tx + 1, (ty + 1) * N + tx, (ty + 1) * N + tx + 1].filter((k) => Number.isFinite(water[k]!)).length;
      if (c.some((v) => v === 1) && wet >= 2) decks[t] = 1;
      if (c.every((v) => v === 1)) b.ground[t] = GROUND.road;
    }
  }
}

/**
 * The stretches of the line (inside this area) over dry land, each run on 6 m into the water on both
 * sides (where the raised ground and the bridge's boxes overlap at the same height).
 */
/**
 * L10: the stretches of the line (inside this area) where any of the deck's width is over water, each
 * run on 6 m onto the land on both sides (an ordinary bridge's hidden boxes; its earth ramps meet them
 * at the same height).
 */
function wetStretches(br: BridgeAt, water: Float32Array): [number, number][] {
  const out: [number, number][] = [];
  const RUN = 6;
  const anyWet = (s: number): boolean => {
    const p = br.f.at(s);
    for (let o = -br.hw - 1; o <= br.hw + 1; o += 1) {
      const fx = (p.x + p.nx * o) / TILE;
      const fz = (p.z + p.nz * o) / TILE;
      for (const ix of [Math.floor(fx), Math.ceil(fx)]) {
        for (const iz of [Math.floor(fz), Math.ceil(fz)]) {
          if (ix < 0 || iz < 0 || ix >= N || iz >= N) continue;
          if (Number.isFinite(water[iz * N + ix]!)) return true;
        }
      }
    }
    return false;
  };
  let start = -1;
  const end = Math.floor(br.to);
  for (let s = Math.ceil(br.from); s <= end + 1; s++) {
    const w = s <= end && anyWet(s);
    if (w && start < 0) start = s;
    if (!w && start >= 0) {
      out.push([Math.max(br.from, start - RUN), Math.min(br.to, s - 1 + RUN)]);
      start = -1;
    }
  }
  // Runs closer than twice the run-on are one.
  const merged: [number, number][] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = r[1];
    else merged.push([r[0], r[1]]);
  }
  return merged.map(([a, b]) => [Math.round(a * 100) / 100, Math.round(b * 100) / 100]);
}

function landStretches(br: BridgeAt, water: Float32Array): [number, number][] {
  const out: [number, number][] = [];
  const RUN = 6;
  let start = -1;
  // Wet: every height sample round the deck's width at s is water (a dry one anywhere across it — a
  // rock, the shore at a slant — makes the stretch land: there the bridge's boxes carry the deck).
  const wet = (s: number): boolean => {
    const p = br.f.at(s);
    for (let o = -br.hw - 1; o <= br.hw + 1; o += 1) {
      const fx = (p.x + p.nx * o) / TILE;
      const fz = (p.z + p.nz * o) / TILE;
      for (const ix of [Math.floor(fx), Math.ceil(fx)]) {
        for (const iz of [Math.floor(fz), Math.ceil(fz)]) {
          if (ix < 0 || iz < 0 || ix >= N || iz >= N) continue;
          if (!Number.isFinite(water[iz * N + ix]!)) return false;
        }
      }
    }
    return true;
  };
  const end = Math.floor(br.to);
  for (let s = Math.ceil(br.from); s <= end + 1; s++) {
    const dry = s <= end && !wet(s);
    if (dry && start < 0) start = s;
    if (!dry && start >= 0) {
      out.push([Math.max(br.from, start - RUN), Math.min(br.to, s - 1 + RUN)]);
      start = -1;
    }
  }
  return out.map(([a, b]) => [Math.round(a * 100) / 100, Math.round(b * 100) / 100]);
}

/** The bridge's placement in this area and its collision envelopes (one per 16 m of the line). */
function place(b: Builder, br: BridgeAt, water: Float32Array): void {
  const pts: [number, number][] = [];
  for (let s = br.from; s <= br.to + 1e-6; s += 2) pts.push([br.f.at(Math.min(s, br.to)).x, br.f.at(Math.min(s, br.to)).z]);
  const end = br.f.at(br.to);
  pts.push([end.x, end.z]);
  const r = br.reach + (br.design.cable?.anchorage.length ?? 0);
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0])) - r);
  const z0 = Math.floor(Math.min(...pts.map((p) => p[1])) - r);
  const x1 = Math.ceil(Math.max(...pts.map((p) => p[0])) + r);
  const z1 = Math.ceil(Math.max(...pts.map((p) => p[1])) + r);
  const enter = b.placements.length;
  let seed = 0x9e37;
  for (const c of br.key) seed = Math.imul(seed ^ c.charCodeAt(0), 0x01000193) >>> 0;
  const place = makePlacement(br.id, seed, 0, x1 - x0, z1 - z0, x0, z0, 0, -1);
  place.span = {
    path: br.path.map(([x, z]) => [x - x0, z - z0] as [number, number]),
    ends: [br.ends[0], br.ends[1]],
    water: br.lay.water,
    from: br.from,
    to: br.to,
    land: carryOf(br.design) === 'water' ? wetStretches(br, water) : carryOf(br.design) === 'ground' ? landStretches(br, water) : [],
  };
  if (br.deck) place.span.deck = br.deck;
  b.placements.push(place);
  // Collision envelopes: the bridge's boxes grouped by 16 m of the line (each envelope routes the
  // collision queries to the boxes inside it — gen/buildings detailOf).
  const groups = new Map<number, [number, number, number, number, number, number]>();
  for (const c of localColliders(blueprintOf(place))) {
    const cx = (c.x0 + c.x1) / 2 + x0;
    const cz = (c.z0 + c.z1) / 2 + z0;
    const k = Math.floor((across(br, cx, cz)?.s ?? br.f.project(cx, cz).s) / 16);
    const g = groups.get(k);
    const box: [number, number, number, number, number, number] = [c.x0 + x0, c.y0, c.z0 + z0, c.x1 + x0, c.y1, c.z1 + z0];
    if (!g) groups.set(k, box);
    else for (let j = 0; j < 6; j++) g[j] = j < 3 ? Math.min(g[j]!, box[j]!) : Math.max(g[j]!, box[j]!);
  }
  for (const g of groups.values()) b.solids.push({ x0: g[0] - 0.1, y0: g[1] - 0.1, z0: g[2] - 0.1, x1: g[3] + 0.1, y1: g[4] + 0.1, z1: g[5] + 0.1, kind: 'building', ref: -1, enter });
}
