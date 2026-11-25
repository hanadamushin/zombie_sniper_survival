// L9: bridge landmarks built from bank to bank (docs/realmap_guide.md §7, L9). A bridge is drawn
// along its deck's axis — a path of plan points — instead of in a box: in an area the path is the
// area's own road over the water (gen/real/bridges.ts replaces the road's embankment by the bridge),
// in the landmark yard and the catalog tests it is a straight line along local x over a channel dug
// from the lot.
//
// One design per bridge (its spans, towers, cables, deck), everything else here:
//   bridgeDef(design)         the building type (category landmark, exterior only)
//   bridgeLayout(...)         where the anchorages, towers, piers and arches stand on the path and the
//                             deck's height along it — the same numbers carry the deck in the area
//                             (gen/real/bridges.ts raises the ground under it to that height)
// Kinds of the main structure: 'suspension' (anchorages, two towers, main cables and hangers), 'stayed'
// (towers and fans of stay cables), 'arch' (a row of arches the deck climbs over: the wooden Kintai
// Bridge), 'girder' (piers only: an ordinary bridge — L9 proposes it for the areas' embankments).
//
// Scale: an area is the real 10 km square shrunk 1/10 in plan, so the spans are 1/10 of the real ones
// (`scale`) and the bridge is as long as the area's water is wide. Heights are the design's own game
// metres (PROGRESS.md L9: about 1/5 of the real ones, the deck no higher than its ramps can reach).
// People, deck widths and rails keep their real size.

import type { PaintName } from '../../../../data/render.ts';
import type { BridgeSpan, BuildingDef, MaterialId } from '../../types.ts';
import { landmarkDef, type Lm } from './common.ts';

export type P2 = [number, number];

export interface TowerDesign {
  /**
   * 'portal' two legs outside the deck with struts (a suspension bridge's towers), 'pole' one column
   * in the deck's middle above it and two legs under it (a single plane of stays: the Aomori Bay
   * Bridge's inverted Y), 'aFrame' two legs leaning together over the deck.
   */
  shape: 'portal' | 'pole' | 'aFrame';
  /** Top above the water (game m). */
  top: number;
  /** Leg thickness at the foot and at the top (m, square section). */
  leg: [number, number];
  /** Struts between the legs: heights as shares of the top above the water (portal / aFrame). */
  struts?: number[];
  paint: PaintName;
  /** A cap on each leg's top (a finial), m high. */
  cap?: number;
}

export interface BridgeDesign {
  variant: string;
  /** Real spans of the main structure (m), in order along the path. */
  spans: number[];
  /** Plan scale of the spans (default 0.1: the area's shrinking). */
  scale?: number;
  /**
   * In an area, what carries the walkers: 'ground' (the area's ground is raised to the deck over the
   * water, hidden boxes carry it over the land), 'boxes' (default since L10: hidden boxes of the
   * bridge's own over its whole length — the ground and the water stay under the deck, so bullets and
   * eyes pass under it) or 'water' (L10, an ordinary bridge: hidden boxes over the water, its ramps on
   * the land are earth — the ground is raised to the deck there).
   */
  carry?: 'ground' | 'boxes' | 'water';
  /** Fit the main structure to the path, `fit` m short of each end (the scale is then the path's). */
  fit?: number;
  /** Where the main structure starts on the path (m from its start); default: centred. */
  at?: number;
  main: 'suspension' | 'stayed' | 'arch' | 'girder';
  deck: {
    width: number;
    /** Slab thickness under the deck's top. */
    thick: number;
    top: PaintName;
    side: PaintName;
    /** Height and paint of the parapets (rails) on both edges. */
    parapet: number;
    parapetPaint: PaintName;
    /** Wooden deck: the slab and rails in a wood material instead of paint. */
    wood?: MaterialId;
    /** Lateral offsets of rail tracks laid on the deck (a railway carried by the bridge). */
    rails?: number[];
    /** Lane lines (lateral offsets) painted on the deck. */
    lines?: number[];
    /** Longest piece of a curved stretch of the deck (default 12 m; 1.6 m for the arches). */
    piece?: number;
  };
  /** The deck's top: at most `clear` over the water, rising at most `slope` per m from its ends. */
  profile: { clear: number; slope?: number; crest?: number; rise?: number };
  /** A second deck `gap` m above the walking one (a double-decked truss: the Rainbow Bridge). */
  upper?: { gap: number; top: PaintName; parapet: PaintName };
  /** Side trusses of the main structure, from `y0` to `y1` above the deck's top (y0 negative: under it). */
  truss?: { y0: number; y1: number; panel: number; paint: PaintName; posts?: boolean; steps?: number };
  tower?: TowerDesign;
  /** Suspension: the main cables' lowest point above the deck's top; hanger spacing; anchorage block. */
  cable?: { sag: number; hangers: number; paint: PaintName; thick: number; anchorage: { length: number; height: number; paint: PaintName } };
  /** Stays: per side of each tower, fan from `top` share of the tower down; one plane in the middle or two at the edges. */
  stays?: { n: number; plane: 'one' | 'two'; paint: PaintName; from: number; /** L10: height of each step of a stay's staircase (default 0.9 m; more for tall towers, fewer triangles). */ step?: number };
  /** Piers under the approach spans every `every` m (and at the main structure's ends). */
  piers: { every: number; paint: PaintName; columns: number; size: number };
  /** Arch kind: which spans are arches (the rest are level beams on piers), the arches' timber. */
  arches?: { which: number[]; paint: PaintName; pier: PaintName; pierSize: number };
  /** The yard's version: the bridge's length (m, along local x), the lot's depth, the water dug under it. */
  yard: { length: number; depth: number; water: [number, number] };
  /** Triangle limit (a big bridge: up to 8,000). */
  shell?: number;
  /** The highest point in the yard when `extra` adds something taller than the bridge (trees, a gate). */
  top?: number;
  /** Things of this bridge only (gates, torii, the fall's props), drawn after the bridge. */
  extra?(L: Lm, B: BridgeFrame): void;
}

// ---------------------------------------------------------------------------------------------
// The path
// ---------------------------------------------------------------------------------------------

export interface PathFrame {
  length: number;
  /** Point, unit tangent and left normal at s (m from the first point). */
  at(s: number): { x: number; z: number; tx: number; tz: number; nx: number; nz: number };
  /** s of the path's corners. */
  corners: number[];
  /** Nearest point of the path to (x, z): its s and the signed offset (left of the tangent positive). */
  project(x: number, z: number): { s: number; off: number; dist: number };
}

export function pathFrame(path: readonly (readonly [number, number])[]): PathFrame {
  const acc: number[] = [0];
  for (let i = 1; i < path.length; i++) acc.push(acc[i - 1]! + Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]));
  const length = acc[acc.length - 1]!;
  const seg = (s: number): number => {
    let i = 0;
    while (i < path.length - 2 && acc[i + 1]! < s) i++;
    return i;
  };
  return {
    length,
    corners: acc.slice(1, -1),
    at(s) {
      const i = seg(s);
      const [ax, az] = path[i]!;
      const [bx, bz] = path[i + 1]!;
      const len = Math.max(1e-9, acc[i + 1]! - acc[i]!);
      const tx = (bx - ax) / len;
      const tz = (bz - az) / len;
      const u = s - acc[i]!;
      return { x: ax + tx * u, z: az + tz * u, tx, tz, nx: tz, nz: -tx };
    },
    project(x, z) {
      let best = { s: 0, off: 0, dist: Infinity };
      for (let i = 0; i + 1 < path.length; i++) {
        const [ax, az] = path[i]!;
        const [bx, bz] = path[i + 1]!;
        const len = Math.max(1e-9, acc[i + 1]! - acc[i]!);
        const tx = (bx - ax) / len;
        const tz = (bz - az) / len;
        const u = (x - ax) * tx + (z - az) * tz;
        const uc = Math.min(len, Math.max(0, u));
        const px = ax + tx * uc;
        const pz = az + tz * uc;
        const dist = Math.hypot(x - px, z - pz);
        if (dist < best.dist) best = { s: acc[i]! + uc, off: (x - ax) * tz - (z - az) * tx, dist };
      }
      return best;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The layout: where everything stands on the path, and the deck's height
// ---------------------------------------------------------------------------------------------

export interface BridgeLayout {
  length: number;
  /** Ends of the main structure (s) and the boundaries of its spans (first = start, last = end). */
  bounds: number[];
  /** The deck's top at s (above the placement's base, as `ends` and `water`). */
  deck(s: number): number;
  /** s where the deck's slope changes (pieces of the deck are cut there). */
  kinks: number[];
  water: number;
}

export function bridgeLayout(D: BridgeDesign, length: number, ends: readonly [number, number], water: number): BridgeLayout {
  const real = D.spans.reduce((a, b) => a + b, 0);
  const scale = D.fit !== undefined ? Math.max(1, length - 2 * D.fit) / real : D.scale ?? 0.1;
  const total = real * scale;
  const start = D.at !== undefined ? D.at : (length - total) / 2;
  const bounds = [start];
  for (const sp of D.spans) bounds.push(bounds[bounds.length - 1]! + sp * scale);
  const g = D.profile.slope ?? 0.07;
  const [ya, yb] = ends;
  const top0 = water + D.profile.clear;
  const mid = (bounds[0]! + bounds[bounds.length - 1]!) / 2;
  const half = Math.max(1, (bounds[bounds.length - 1]! - bounds[0]!) / 2);
  const crest = D.profile.crest ?? 0;
  const archRise = D.profile.rise ?? 0;
  const arches = new Set(D.arches?.which ?? []);
  // The deck's top: the crest of the main structure (a slight arch of a long suspension bridge, the
  // humps of a wooden arch bridge), never steeper than `slope` up from either end.
  const top = (s: number): number => {
    let y = top0;
    if (crest > 0) {
      const u = (s - mid) / half;
      y += crest * Math.max(0, 1 - u * u);
    }
    if (archRise > 0) {
      for (let k = 0; k + 1 < bounds.length; k++) {
        if (!arches.has(k) || s <= bounds[k]! || s >= bounds[k + 1]!) continue;
        const u = (s - bounds[k]!) / (bounds[k + 1]! - bounds[k]!);
        y += archRise * Math.sin(Math.PI * u);
      }
    }
    return y;
  };
  // Never under the straight line between the ends (a bridge from a high bank to a low one).
  const deck = (s: number): number => Math.min(ya + g * Math.max(0, s), yb + g * Math.max(0, length - s), Math.max(top(s), ya + ((yb - ya) * s) / Math.max(1e-6, length)));
  // Kinks: where a ramp meets the crest (searched on a 1 m grid), the spans' boundaries.
  const kinks: number[] = [];
  let prev = -1;
  for (let s = 0; s <= length; s += 1) {
    const which = ya + g * s <= deck(s) + 1e-6 ? 0 : yb + g * (length - s) <= deck(s) + 1e-6 ? 2 : 1;
    if (prev >= 0 && which !== prev) kinks.push(s);
    prev = which;
  }
  return { length, bounds, deck, kinks: [...kinks, ...bounds].filter((s) => s > 0 && s < length).sort((a, b) => a - b), water };
}

/** What a bridge's `extra` gets: the frame, the layout and the stretch this lot builds. */
export interface BridgeFrame {
  f: PathFrame;
  lay: BridgeLayout;
  from: number;
  to: number;
  /** True in an area (the ground carries the deck), false in the yard (the deck's own boxes do). */
  area: boolean;
  /** Where the feet of the piers and towers end (under the water's bed in an area; above the lot's foundation in the yard). */
  foot: number;
}

// ---------------------------------------------------------------------------------------------
// The registry: a bridge landmark's design by its building type
// ---------------------------------------------------------------------------------------------

const DESIGNS = new Map<string, BridgeDesign>();
export function bridgeDesign(id: string): BridgeDesign | undefined {
  return DESIGNS.get(id);
}
/** Half the deck's width plus whatever stands beside it (tower legs, anchorages, stays), m. */
export function bridgeReach(D: BridgeDesign): number {
  const legs = D.tower && D.tower.shape !== 'pole' ? D.tower.leg[0] + 2.5 : 0;
  const anch = D.cable ? 3 : 0;
  return D.deck.width / 2 + Math.max(legs, anch, 1) + 2;
}

/** The yard's straight path (local x along the lot's middle) and its ends: the ground of the lot. */
const YARD_END = 10;
function yardSpan(D: BridgeDesign, w: number, d: number): BridgeSpan {
  return { path: [[YARD_END, d / 2], [w - YARD_END, d / 2]], ends: [0, 0], water: -0.8, from: 0, to: w - 2 * YARD_END };
}

/** A bridge landmark's building type. */
export function bridgeDef(D: BridgeDesign): BuildingDef {
  const w = D.yard.length + 2 * YARD_END;
  const d = D.yard.depth;
  let top = (D.tower?.top ?? 0) + (D.tower?.cap ?? 0);
  top = Math.max(top, D.top ?? 0, D.profile.clear + (D.profile.crest ?? 0) + (D.profile.rise ?? 0) + (D.upper?.gap ?? 0) + (D.truss?.y1 ?? 0) + D.deck.parapet + 1);
  const def = landmarkDef({
    variant: D.variant,
    size: { w: [w, w], d: [d, d] },
    eaves: Math.min(top, D.profile.clear + D.deck.parapet + (D.upper?.gap ?? 0)),
    top,
    kind: 'shed',
    shell: D.shell,
    build(L) {
      buildBridge(L, D);
    },
  });
  DESIGNS.set(def.id, D);
  return def;
}

// ---------------------------------------------------------------------------------------------
// Building it
// ---------------------------------------------------------------------------------------------

/** L10: a design with an area's own deck (an ordinary bridge's width and tracks). */
export function withDeck(D: BridgeDesign, deck: BridgeSpan['deck']): BridgeDesign {
  if (!deck) return D;
  const hw = deck.width / 2;
  return { ...D, deck: { ...D.deck, width: deck.width, rails: deck.rails ?? D.deck.rails, lines: D.deck.lines?.filter((o) => Math.abs(o) < hw - 1) } };
}

/** The carry of a design in an area (L10: boxes unless it says otherwise). */
export function carryOf(D: BridgeDesign): 'ground' | 'boxes' | 'water' {
  return D.carry ?? 'boxes';
}

function buildBridge(L: Lm, D0: BridgeDesign): void {
  const area = L.span !== undefined;
  const D = withDeck(D0, L.span?.deck);
  const span = L.span ?? yardSpan(D, L.w, L.d);
  const f = pathFrame(span.path);
  const lay = bridgeLayout(D, f.length, span.ends, span.water);
  const { from, to } = span;
  const B: BridgeFrame = { f, lay, from, to, area, foot: area ? lay.water - 6 : -2.9 };
  if (!area) {
    // The yard: the channel under the bridge, the banks paved where the deck lands.
    const [w0, w1] = D.yard.water;
    L.ground('water', [[YARD_END + w0, 0], [YARD_END + w1, 0], [YARD_END + w1, L.d], [YARD_END + w0, L.d]], 3, 0.8);
  }
  const mine = (s: number): boolean => s >= from - 1e-6 && s < to - 1e-6 || (to >= lay.length - 1e-6 && Math.abs(s - to) < 1e-6);
  const hw = D.deck.width / 2;
  const deckSolid = !area;

  const [m0, m1] = [lay.bounds[0]!, lay.bounds[lay.bounds.length - 1]!];
  const inMain = (s: number): boolean => s >= m0 - 0.01 && s <= m1 + 0.01;

  // --- the deck, in pieces cut at the path's corners, the slope's kinks, the spans and every few m ---
  const cuts = new Set<number>([from, to, ...f.corners, ...lay.kinks].filter((s) => s >= from && s <= to));
  const maxLen = D.deck.piece ?? (D.main === 'arch' ? 1.6 : 12);
  const sorted = [...cuts].sort((a, b) => a - b);
  const pieces: [number, number][] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (b - a < 0.05) continue;
    // Sloped stretches in pieces that rise at most 0.8 m (the parapet's colliding box keeps its height).
    const rise = Math.abs(lay.deck(b) - lay.deck(a));
    const curved = Math.abs(lay.deck((a + b) / 2) - (lay.deck(a) + lay.deck(b)) / 2) > 0.05;
    const n = Math.max(1, Math.ceil(rise / 0.8), curved ? Math.ceil((b - a) / maxLen) : 1, Math.ceil((b - a) / 60));
    for (let k = 0; k < n; k++) pieces.push([a + ((b - a) * k) / n, a + ((b - a) * (k + 1)) / n]);
  }
  const wood = D.deck.wood;
  const mat = (p: PaintName): { m: MaterialId; o: { paint?: PaintName } } => (wood ? { m: wood, o: {} } : { m: 'paint', o: { paint: p } });
  // At a corner of the path the pieces on both sides run on by hw·tan(turn / 2): the outside of the turn closes.
  const turnAt = (s: number): { ext: number; inner: number } => {
    if (!f.corners.some((c) => Math.abs(c - s) < 1e-6)) return { ext: 0, inner: 0 };
    const p = f.at(s - 0.01);
    const q = f.at(s + 0.01);
    const turn = Math.acos(Math.min(1, Math.max(-1, p.tx * q.tx + p.tz * q.tz)));
    // The side the path turns towards (+1: its left normal's) is the inside of the turn.
    const inner = q.tx * p.nx + q.tz * p.nz > 0 ? 1 : -1;
    return { ext: Math.min(hw, (hw + 0.5) * Math.tan(turn / 2)), inner };
  };
  for (const [a, b] of pieces) {
    const ya = lay.deck(a);
    const yb = lay.deck(b);
    const ta = turnAt(a);
    const tb = turnAt(b);
    const ext: [number, number] = [ta.ext, tb.ext];
    const top = mat(D.deck.top);
    // In an area the ground under the deck is at the deck's top: the slab is drawn a hair above it.
    const lift = area ? 0.06 : 0;
    ramp(L, f, a, b, 0, ya + lift, yb + lift, D.deck.width, D.deck.thick, top.m, { ...top.o, solid: deckSolid }, ext);
    // Parapets on both edges (they collide: nobody walks off the deck). At a corner the outer one runs
    // on to close the turn, the inner one stops short of it (it would cross the deck).
    const pp = mat(D.deck.parapetPaint);
    for (const side of [-1, 1]) {
      const e = (t: { ext: number; inner: number }): number => (t.ext === 0 ? 0 : t.inner === side ? -t.ext * ((hw - 0.2) / (hw + 0.5)) : t.ext);
      ramp(L, f, a, b, side * (hw - 0.2), ya + D.deck.parapet, yb + D.deck.parapet, 0.4, D.deck.parapet + 0.25, pp.m, { ...pp.o, solid: true }, [e(ta), e(tb)]);
    }
    // Rail tracks (a bed and two rails) and lane lines: thin strips on the deck's top.
    for (const off of D.deck.rails ?? []) {
      ramp(L, f, a, b, off, ya + 0.12, yb + 0.12, 2.6, 0.06, 'paint', { paint: 'brown', solid: false });
      for (const r of [-0.75, 0.75]) ramp(L, f, a, b, off + r, ya + 0.24, yb + 0.24, 0.14, 0.12, 'paint', { paint: 'silver', solid: false });
    }
    for (const off of D.deck.lines ?? []) ramp(L, f, a, b, off, ya + 0.09, yb + 0.09, 0.2, 0.03, 'paint', { paint: 'white', solid: false });
    if (D.upper && inMain((a + b) / 2)) {
      const g = D.upper.gap;
      ramp(L, f, a, b, 0, ya + g, yb + g, D.deck.width + 1, 1.2, 'paint', { paint: D.upper.top, solid: deckSolid }, ext);
      for (const side of [-1, 1]) ramp(L, f, a, b, side * (hw + 0.3), ya + g + 1, yb + g + 1, 0.4, 1.1, 'paint', { paint: D.upper.parapet, solid: false }, ext);
    }
  }

  // --- over dry land (an area): hidden boxes carry the deck (the ground keeps its height under it) ---
  if (area) {
    const runs = carryOf(D) === 'boxes' ? [[from, to] as [number, number]] : span.land ?? [];
    for (const [sa, sb] of runs) landDeck(L, f, lay, Math.max(sa, from), Math.min(sb, to), hw - 0.25);
  }

  // --- side trusses along the main structure ---
  if (D.truss) {
    const T = D.truss;
    const n = Math.max(1, Math.round((m1 - m0) / T.panel));
    for (let k = 0; k < n; k++) {
      const a = m0 + ((m1 - m0) * k) / n;
      const b = m0 + ((m1 - m0) * (k + 1)) / n;
      if (!mine((a + b) / 2)) continue;
      for (const side of [-1, 1]) {
        const off = side * (hw + 0.35);
        const ya = lay.deck(a);
        const yb = lay.deck(b);
        ramp(L, f, a, b, off, ya + T.y0 + 0.6, yb + T.y0 + 0.6, 0.6, 0.6, 'paint', { paint: T.paint, solid: false });
        ramp(L, f, a, b, off, ya + T.y1, yb + T.y1, 0.6, 0.6, 'paint', { paint: T.paint, solid: false });
        const pa = f.at(a);
        const pb = f.at(b);
        if (T.posts !== false) post(L, pa.x + pa.nx * off, pa.z + pa.nz * off, ya + T.y0, ya + T.y1, 0.45, T.paint, false);
        const [lo, hi] = [ya + T.y0 + 0.3, yb + T.y1 - 0.3];
        line3(L, [pa.x + pa.nx * off, k % 2 ? hi : lo, pa.z + pa.nz * off], [pb.x + pb.nx * off, k % 2 ? lo : hi, pb.z + pb.nz * off], T.steps ?? 3, 0.4, T.paint);
      }
    }
  }

  // --- piers under the approach spans (and the main structure's ends) ---
  const P = D.piers;
  // L10: an ordinary bridge's piers stand in the water only (its ramps on the land are earth).
  const wetRuns = area && carryOf(D) === 'water' ? span.land ?? [] : null;
  const pierAt = (s: number, size: number, paint: PaintName): void => {
    const y = lay.deck(s) - D.deck.thick;
    if (y - lay.water < 0.8) return;
    if (wetRuns && !wetRuns.some(([a, b]) => s > a + 4 && s < b - 4)) return;
    const p = f.at(s);
    const n = P.columns;
    for (let c = 0; c < n; c++) {
      const off = n === 1 ? 0 : -hw * 0.65 + (1.3 * hw * c) / (n - 1);
      post(L, p.x + p.nx * off, p.z + p.nz * off, B.foot, y, size, paint, true, f.at(s));
    }
    if (n > 1) ramp(L, f, s - size / 2, s + size / 2, 0, y, y, D.deck.width * 0.9, Math.min(1.2, size), 'paint', { paint, solid: true });
  };
  if (P.every > 0) {
    const stops: number[] = [];
    for (let s = m0 - P.every; s > 2; s -= P.every) stops.push(s);
    for (let s = m1 + P.every; s < lay.length - 2; s += P.every) stops.push(s);
    if (D.main === 'girder') for (let s = P.every; s < lay.length - 2; s += P.every) stops.push(s);
    for (const s of stops) if (mine(s)) pierAt(s, P.size, P.paint);
  }
  // (L10: a girder bridge of several spans — the Yoshima truss — stands on a pier at every span's end.)
  if (D.main === 'stayed' || D.main === 'girder') for (const s of D.main === 'girder' ? lay.bounds : [m0, m1]) if (mine(s) && s > 1 && s < lay.length - 1) pierAt(s, P.size, P.paint);

  // --- the main structure ---
  if (D.main === 'suspension') suspension(L, D, B, mine);
  else if (D.main === 'stayed') stayed(L, D, B, mine);
  else if (D.main === 'arch') archesOf(L, D, B, mine);

  D.extra?.(L, B);
}

/**
 * The deck's walking surface over dry land, s from a to b: hidden level boxes on a 2 m grid (the
 * lot's frame is never turned), each at the deck's height over its middle. Steps between them stay
 * a few centimetres (the deck rises 7.5 % at most).
 */
function landDeck(L: Lm, f: PathFrame, lay: BridgeLayout, a: number, b: number, half: number): void {
  if (b - a < 0.5) return;
  // Cells small enough that the steepest stretch rises under 0.4 m from one to the next.
  let steep = 0;
  for (let s = a; s < b; s += 0.5) steep = Math.max(steep, Math.abs(lay.deck(Math.min(b, s + 0.5)) - lay.deck(s)) / 0.5);
  const C = Math.min(2, Math.max(0.5, 0.4 / Math.max(1e-6, steep)));
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let s = a; s <= b + 1e-6; s += 1) {
    const p = f.at(Math.min(s, b));
    x0 = Math.min(x0, p.x - half);
    x1 = Math.max(x1, p.x + half);
    z0 = Math.min(z0, p.z - half);
    z1 = Math.max(z1, p.z + half);
  }
  for (let z = Math.floor(z0 / C) * C; z < z1; z += C) {
    // Runs of cells along x at the same height (to 2 cm) are merged into one box.
    let run: { x: number; y: number } | null = null;
    const flush = (xe: number): void => {
      if (run) L.box(run.x, run.y - 0.6, z, xe, run.y, z + C, 'paint', { paint: 'gray', hidden: true });
      run = null;
    };
    for (let x = Math.floor(x0 / C) * C; x < x1; x += C) {
      const q = f.project(x + C / 2, z + C / 2);
      // On the line between a and b, or up to 2.5 m past an end of the bridge (onto the ground there).
      const over = Math.sqrt(Math.max(0, q.dist * q.dist - q.off * q.off));
      const pastEnd = (q.s < 1e-6 && a < 1e-6) || (q.s > f.length - 1e-6 && b > f.length - 1e-6);
      // (Round the outside of a corner of the path the nearest point is the corner itself: within half the width.)
      const inside = q.s >= a && q.s <= b && (over < 0.01 ? Math.abs(q.off) <= half : pastEnd ? over <= 2.5 && Math.abs(q.off) <= half : q.dist <= half);
      if (!inside) {
        flush(x);
        continue;
      }
      const y = Math.round(lay.deck(q.s) * 50) / 50;
      if (run && Math.abs((run as { y: number }).y - y) > 0.021) flush(x);
      run ??= { x, y };
    }
    flush(Math.floor(x1 / C) * C + C);
  }
}

/** A tower at s: its legs from below the water to the top, struts, caps. */
function towerAt(L: Lm, D: BridgeDesign, B: BridgeFrame, s: number): void {
  const T = D.tower!;
  const p = B.f.at(s);
  const hw = D.deck.width / 2;
  const deckY = B.lay.deck(s);
  const foot = B.foot;
  const topY = B.lay.water + T.top;
  const steps = 4;
  const leg = (off: number, offTop: number, y0: number, y1: number, size0: number, size1: number): void => {
    for (let k = 0; k < steps; k++) {
      const t0 = k / steps;
      const t1 = (k + 1) / steps;
      const o = off + (offTop - off) * (t0 + t1) / 2;
      const size = size0 + (size1 - size0) * (t0 + t1) / 2;
      post(L, p.x + p.nx * o, p.z + p.nz * o, y0 + (y1 - y0) * t0, y0 + (y1 - y0) * t1 + 0.05, size, T.paint, true, p);
    }
  };
  // The footing in the water.
  post(L, p.x, p.z, foot, B.lay.water + 1.2, Math.max(T.leg[0] * 2.2, 4), 'stone', true, p, D.deck.width + 2 * T.leg[0] + 5);
  if (T.shape === 'pole') {
    // Under the deck: two legs; above it: one column in the middle (a single plane of stays).
    for (const side of [-1, 1]) leg(side * hw * 0.55, side * hw * 0.2, B.lay.water + 1.2, deckY - D.deck.thick, T.leg[0], T.leg[0]);
    post(L, p.x, p.z, deckY - D.deck.thick - 1, deckY - D.deck.thick + 0.2, T.leg[0], T.paint, true, p, D.deck.width * 0.8);
    leg(0, 0, deckY, topY, T.leg[0] * 1.3, T.leg[1]);
  } else {
    const out = hw + T.leg[0] / 2 + 0.6;
    const outTop = T.shape === 'aFrame' ? T.leg[1] : out - (T.leg[0] - T.leg[1]) / 2;
    for (const side of [-1, 1]) leg(side * out, side * outTop, B.lay.water + 1.2, topY, T.leg[0], T.leg[1]);
    for (const share of T.struts ?? []) {
      const y = B.lay.water + T.top * share;
      if (Math.abs(y - deckY) < 3) continue;
      const half = out + ((outTop - out) * (y - B.lay.water)) / T.top;
      post(L, p.x, p.z, y - 1.4, y + 0.2, 1.6, T.paint, true, p, 2 * half + T.leg[1]);
    }
    // A strut under the deck carries it.
    post(L, p.x, p.z, deckY - D.deck.thick - 1.2, deckY - D.deck.thick, 1.6, T.paint, true, p, 2 * out);
  }
  if (T.cap) {
    const offs = T.shape === 'pole' ? [0] : [-1, 1].map((sd) => sd * (T.shape === 'aFrame' ? 0 : hw + T.leg[0] / 2 + 0.6 - (T.leg[0] - T.leg[1]) / 2));
    for (const o of offs) L.column(p.x + p.nx * o, p.z + p.nz * o, T.leg[1] * 0.45, topY, topY + T.cap, 'paint', { paint: T.paint, taper: 0.3, solid: false });
  }
}

function suspension(L: Lm, D: BridgeDesign, B: BridgeFrame, mine: (s: number) => boolean): void {
  const { f, lay } = B;
  const C = D.cable!;
  const T = D.tower!;
  const b = lay.bounds;
  const [a0, t1, t2, a1] = [b[0]!, b[1]!, b[b.length - 2]!, b[b.length - 1]!];
  const hw = D.deck.width / 2;
  const deckTop = (s: number): number => lay.deck(s) + Math.max(D.upper?.gap ?? 0, D.truss?.y1 ?? 0);
  const topY = lay.water + T.top - 0.5;
  // The anchorages: a block astride the deck at each end of the main structure (the deck runs through).
  for (const s of [a0, a1]) {
    if (!mine(s)) continue;
    const A = C.anchorage;
    const y = lay.deck(s);
    const p = f.at(s);
    const dir = s === a0 ? -1 : 1;
    const sc = s + (dir * A.length) / 2;
    for (const side of [-1, 1]) post(L, p.x + p.nx * side * (hw + 2) + p.tx * dir * A.length / 2, p.z + p.nz * side * (hw + 2) + p.tz * dir * A.length / 2, B.foot, y + A.height, A.length, A.paint, true, p, 3.6);
    // Over the upper deck (or the truss), and never lower than head height over the walking deck.
    const top = Math.max(deckTop(sc) + 0.6, lay.deck(sc) + 5);
    ramp(L, f, sc - A.length / 2, sc + A.length / 2, 0, top + 2, top + 2, D.deck.width + 7.2, 2.2, 'paint', { paint: A.paint, solid: true });
  }
  for (const s of [t1, t2]) if (mine(s)) towerAt(L, D, B, s);
  // The main cables: a parabola between the towers, a shallower one down to each anchorage.
  const low = (s: number): number => deckTop(s) + C.sag;
  const cableY = (s: number): number => {
    if (s <= t1) {
      const u = (t1 - s) / Math.max(1, t1 - a0);
      const yA = lay.deck(a0) + C.anchorage.height;
      return topY + (yA - topY) * (u * 0.75 + u * u * 0.25);
    }
    if (s >= t2) {
      const u = (s - t2) / Math.max(1, a1 - t2);
      const yA = lay.deck(a1) + C.anchorage.height;
      return topY + (yA - topY) * (u * 0.75 + u * u * 0.25);
    }
    const m = (t1 + t2) / 2;
    const u = (s - m) / ((t2 - t1) / 2);
    return low(m) + (topY - low(m)) * u * u;
  };
  const knots: number[] = [];
  const add = (x0: number, x1: number, n: number): void => {
    for (let k = 0; k < n; k++) knots.push(x0 + ((x1 - x0) * k) / n);
  };
  add(a0, t1, Math.max(2, Math.round((t1 - a0) / 30)));
  add(t1, t2, Math.max(8, Math.round((t2 - t1) / 20)));
  add(t2, a1, Math.max(2, Math.round((a1 - t2) / 30)));
  knots.push(a1);
  const off = hw + 0.6;
  for (const side of [-1, 1]) {
    for (let k = 0; k + 1 < knots.length; k++) {
      const sa = knots[k]!;
      const sb = knots[k + 1]!;
      if (!mine((sa + sb) / 2)) continue;
      const pa = f.at(sa);
      const pb = f.at(sb);
      const steps = Math.max(1, Math.ceil(Math.abs(cableY(sb) - cableY(sa)) / (C.thick * 1.6)));
      line3(L, [pa.x + pa.nx * side * off, cableY(sa), pa.z + pa.nz * side * off], [pb.x + pb.nx * side * off, cableY(sb), pb.z + pb.nz * side * off], steps, C.thick, C.paint);
    }
    // Hangers from the cable to the deck's edge (the truss's top).
    for (let s = t1 + C.hangers / 2; s < t2; s += C.hangers) {
      if (!mine(s)) continue;
      const p = f.at(s);
      post(L, p.x + p.nx * side * off, p.z + p.nz * side * off, deckTop(s), cableY(s), 0.12, 'gray', false);
    }
    for (const [x0, x1] of [[a0, t1], [t2, a1]] as const) {
      for (let s = x0 + C.hangers / 2; s < x1 - 1; s += C.hangers) {
        if (!mine(s) || cableY(s) - deckTop(s) < 1) continue;
        const p = f.at(s);
        post(L, p.x + p.nx * side * off, p.z + p.nz * side * off, deckTop(s), cableY(s), 0.12, 'gray', false);
      }
    }
  }
}

function stayed(L: Lm, D: BridgeDesign, B: BridgeFrame, mine: (s: number) => boolean): void {
  const { f, lay } = B;
  const S = D.stays!;
  const T = D.tower!;
  const b = lay.bounds;
  const towers = b.slice(1, -1);
  const hw = D.deck.width / 2;
  towers.forEach((ts, i) => {
    if (mine(ts)) towerAt(L, D, B, ts);
    // Reach of the fans: to the main structure's end on the outside, to mid-span on the inside.
    const back = ts - (i === 0 ? b[0]! : (towers[i - 1]! + ts) / 2);
    const fwd = (i === towers.length - 1 ? b[b.length - 1]! : (towers[i + 1]! + ts) / 2) - ts;
    const topY = lay.water + T.top;
    const lowY = lay.deck(ts) + (topY - lay.deck(ts)) * S.from;
    const planes = S.plane === 'one' ? [0] : [-(hw + 0.3), hw + 0.3];
    for (const off of planes) {
      for (const [dir, reach] of [[-1, back], [1, fwd]] as const) {
        for (let k = 0; k < S.n; k++) {
          const u = (k + 1) / S.n;
          const sd = ts + dir * reach * (0.12 + 0.86 * u);
          const yTop = topY - 0.6 - (topY - 0.6 - lowY) * (1 - u) * 0.9;
          if (!mine((ts + sd) / 2)) continue;
          const pt = f.at(ts);
          const pd = f.at(sd);
          const yd = lay.deck(sd) + 0.8;
          line3(L, [pt.x + pt.nx * off, yTop, pt.z + pt.nz * off], [pd.x + pd.nx * off, yd, pd.z + pd.nz * off], Math.max(2, Math.ceil((yTop - yd) / (S.step ?? 0.9))), 0.25, S.paint);
        }
      }
    }
  });
}

function archesOf(L: Lm, D: BridgeDesign, B: BridgeFrame, mine: (s: number) => boolean): void {
  const { f, lay } = B;
  const A = D.arches!;
  const b = lay.bounds;
  const hw = D.deck.width / 2;
  // Stone piers between the spans (pointed noses against the current are left out).
  for (let k = 1; k + 1 < b.length; k++) {
    const s = b[k]!;
    if (!mine(s)) continue;
    const p = f.at(s);
    post(L, p.x, p.z, Math.max(B.foot, lay.water - 3), lay.deck(s) - 0.6, A.pierSize, A.pier, true, p, D.deck.width + 1.2);
  }
  // Under each arch: the timber arch rib (a band that follows the deck 0.5–1.2 m under it).
  for (const k of A.which) {
    const s0 = b[k]!;
    const s1 = b[k + 1]!;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = s0 + ((s1 - s0) * i) / n;
      const c = s0 + ((s1 - s0) * (i + 1)) / n;
      if (!mine((a + c) / 2)) continue;
      ramp(L, f, a, c, 0, lay.deck(a) - 0.4, lay.deck(c) - 0.4, D.deck.width - 0.6, 0.9, 'paint', { paint: A.paint, solid: false });
    }
  }
  // Under the level spans: wooden trestles.
  for (let k = 0; k + 1 < b.length; k++) {
    if (A.which.includes(k)) continue;
    for (const u of [1 / 3, 2 / 3]) {
      const s = b[k]! + (b[k + 1]! - b[k]!) * u;
      if (!mine(s)) continue;
      const p = f.at(s);
      for (const side of [-1, 1]) post(L, p.x + p.nx * side * (hw - 0.5), p.z + p.nz * side * (hw - 0.5), Math.max(B.foot, lay.water - 1), lay.deck(s) - 0.3, 0.35, A.paint, true, p);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Shapes along the path
// ---------------------------------------------------------------------------------------------

/**
 * A slab along the path from s = a to b at lateral offset `off`: its top from ya to yb (a box under
 * the lower end and a wedge over it when it slopes), `width` across, `thick` deep under the top.
 */
function ramp(L: Lm, f: PathFrame, a: number, b: number, off: number, ya: number, yb: number, width: number, thick: number, mat: MaterialId, o: { paint?: PaintName; solid?: boolean }, ext: readonly [number, number] = [0, 0]): void {
  // Pieces never cross a corner of the path: the middle's tangent is the piece's direction.
  const m = f.at((a + b) / 2);
  // Lengthened at a corner of the path (ext: m before a and after b) so that the outside of the turn is closed.
  const shift = (ext[1] - ext[0]) / 2;
  const cx = m.x + m.nx * off + m.tx * shift;
  const cz = m.z + m.nz * off + m.tz * shift;
  const len = b - a + ext[0] + ext[1];
  const ax = cx - (m.tx * len) / 2;
  const az = cz - (m.tz * len) / 2;
  const bx = cx + (m.tx * len) / 2;
  const bz = cz + (m.tz * len) / 2;
  const lo = Math.min(ya, yb);
  const hi = Math.max(ya, yb);
  const yaw = Math.atan2(-(bz - az), bx - ax);
  const turn = Math.abs(yaw) < 1e-9 ? undefined : yaw;
  const opts = { ...o, yaw: turn };
  L.box(cx - len / 2, lo - thick, cz - width / 2, cx + len / 2, lo, cz + width / 2, mat, opts);
  if (hi - lo > 0.02) L.shape('wedge', cx - len / 2, lo, cz - width / 2, cx + len / 2, hi, cz + width / 2, mat, { ...opts, slope: yb > ya ? 'x+' : 'x-' });
}

/** A square post (column) at (x, z) from y0 to y1, `size` across along the path and `across` sideways. */
function post(L: Lm, x: number, z: number, y0: number, y1: number, size: number, paint: PaintName, solid: boolean, p?: { tx: number; tz: number }, across = size): void {
  if (y1 - y0 < 0.05) return;
  if (!p || Math.abs(p.tz) < 1e-9) {
    const [hx, hz] = p ? [size / 2, across / 2] : [size / 2, across / 2];
    L.box(x - hx, y0, z - hz, x + hx, y1, z + hz, 'paint', { paint, solid });
    return;
  }
  const yaw = Math.atan2(-p.tz, p.tx);
  L.box(x - size / 2, y0, z - across / 2, x + size / 2, y1, z + across / 2, 'paint', { paint, solid, yaw });
}

/** A straight member from a to b (x, y, z) that leans, as `n` short level bars in a staircase. */
function line3(L: Lm, a: readonly [number, number, number], b: readonly [number, number, number], n: number, thick: number, paint: PaintName): void {
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const ax = a[0] + (b[0] - a[0]) * t0;
    const az = a[2] + (b[2] - a[2]) * t0;
    const bx = a[0] + (b[0] - a[0]) * t1;
    const bz = a[2] + (b[2] - a[2]) * t1;
    const y0 = a[1] + (b[1] - a[1]) * t0;
    const y1 = a[1] + (b[1] - a[1]) * t1;
    const lo = Math.min(y0, y1);
    const hi = Math.max(lo + thick, Math.max(y0, y1) + 0.02);
    const len = Math.hypot(bx - ax, bz - az);
    if (len < thick) {
      L.box((ax + bx) / 2 - thick / 2, lo, (az + bz) / 2 - thick / 2, (ax + bx) / 2 + thick / 2, hi, (az + bz) / 2 + thick / 2, 'paint', { paint, solid: false });
      continue;
    }
    const ex = ((bx - ax) / len) * (thick / 2);
    const ez = ((bz - az) / len) * (thick / 2);
    L.bar(ax - ex, az - ez, bx + ex, bz + ez, lo, hi, thick, 'paint', { paint, solid: false });
  }
}

export type { P2 as BridgePoint };
