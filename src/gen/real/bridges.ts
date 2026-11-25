// L9: bridge landmarks laid from bank to bank in the real areas (docs/realmap_guide.md §7, L9).
//
// R0 carries every road over the water on an embankment (layout.ts causeway). A bridge landmark of
// the table (src/data/landmarks/, `bridge`) replaces that embankment along its line: in each area the
// line crosses,
//   1. the area's roads and railways that run along the line are cut where the bridge is (cutByBridges)
//      — the deck carries them (their lanes and tracks are drawn on it);
//   2. the ground under the deck is raised to the deck's height (bridge.ts bridgeLayout: the same
//      numbers as the drawing), the water stays under it, and those tiles are not drawn as terrain
//      (TacticalMap.decks): people, the dead and the survivors walk the deck as ground, the walk grid
//      lets them through, and the water and the piers show under it;
//   3. the bridge itself is one placement of its building type (never turned, `span` = the line in the
//      lot's frame), with collision boxes for its towers, anchorages and parapets.
// The bridge's deck heights come from the table (`ends`) and the design, never from one area's ground,
// so that two areas sharing a bridge (the Akashi Kaikyō) raise the same ground on their common edge.
//
// Pure (no DOM).

import { LANDMARKS, LANDMARK_GRID, type LandmarkSpot } from '../../data/landmarks/index.ts';
import { bridgeDesign, bridgeLayout, bridgeReach, pathFrame, type BridgeDesign, type BridgeLayout, type PathFrame } from '../buildings/defs/landmark/bridge.ts';
import { blueprintOf, localColliders, makePlacement } from '../buildings/index.ts';
import { addRoad, N, SIZE, TILE, TILES, type Builder } from '../builder.ts';
import { GROUND } from '../types.ts';

export interface BridgeAt {
  spot: LandmarkSpot;
  design: BridgeDesign;
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
}

/** A real point in a cell's area frame (m from its north-west corner; outside the square when the point is in another cell). */
export function realInCell(cell: number, lat: number, lon: number): [number, number] {
  const G = LANDMARK_GRID;
  const fy = ((G.latTop - lat) * G.kmPerLat) / G.cellKm;
  const fx = ((lon - G.lon0) * G.kmPerLon) / G.cellKm;
  return [(fx - (cell % G.gridW)) * SIZE, (fy - Math.floor(cell / G.gridW)) * SIZE];
}

/** The table's bridges whose line runs through a cell's area, with their geometry there. */
export function bridgesIn(cell: number): BridgeAt[] {
  const out: BridgeAt[] = [];
  for (const spot of LANDMARKS) {
    if (!spot.bridge) continue;
    const design = bridgeDesign(spot.id);
    if (!design) continue;
    const path = spot.bridge.path.map(([lat, lon]) => realInCell(cell, lat, lon));
    const f = pathFrame(path);
    // The stretch inside the square: each segment clipped to it (Liang–Barsky), exactly, so that two
    // areas sharing the line meet at the same s.
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
    if (!(to > from)) continue;
    const lay = bridgeLayout(design, f.length, spot.bridge.ends, spot.bridge.water ?? 0);
    out.push({ spot, design, path, f, lay, from, to, hw: design.deck.width / 2, reach: bridgeReach(design) });
  }
  return out;
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
    const r = b.reach + 10;
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
  if (!a || Math.abs(a.off) > b.hw + 3 || a.s <= 0.5 || a.s >= b.f.length - 0.5) return false;
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
  const ends = br.spot.bridge!.ends;
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const x = ix * TILE;
      const z = iz * TILE;
      const i = iz * N + ix;
      const a = across(br, x, z);
      if (a && Math.abs(a.off) <= band && a.s > 0.01 && a.s < br.f.length - 0.01) {
        // Over the water the ground rises to the deck; on land it stays (the bridge's hidden boxes carry
        // the deck there — and everywhere on a bridge that carries itself).
        if (Number.isFinite(water[i]!) && br.design.carry !== 'boxes') {
          b.height[i] = br.lay.deck(a.s);
          raised[(iz - iz0) * W + ix - ix0] = 1;
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
  for (const c of br.spot.id) seed = Math.imul(seed ^ c.charCodeAt(0), 0x01000193) >>> 0;
  const place = makePlacement(br.spot.id, seed, 0, x1 - x0, z1 - z0, x0, z0, 0, -1);
  place.span = {
    path: br.path.map(([x, z]) => [x - x0, z - z0] as [number, number]),
    ends: [br.spot.bridge!.ends[0], br.spot.bridge!.ends[1]],
    water: br.lay.water,
    from: br.from,
    to: br.to,
    land: landStretches(br, water),
  };
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
