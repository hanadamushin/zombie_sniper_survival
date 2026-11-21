// Helpers shared by the public buildings (07d-2d: schools, police, fire, hospitals, factories).
// They only call the kit, so the blueprints stay plain data. Local frame as in the kit: x across the
// front, z towards the front (z = d), y up.
//
//   wing(k, spec)        a block of one or more storeys along x: a corridor (front, back or middle),
//                        rooms off it in bays, switchback stair cores at the ends, the outer walls
//                        (ground storey with doors and windows, the upper storeys as one facade),
//                        a flat roof (with a stair house when it can be reached) or a pitched one
//   hall(k, spec)        a tall single room (gym, workshop, factory floor) with doors, low and high
//                        windows, a gable / flat / sawtooth roof
//   catwalk(k, ...)      a steel gallery along a wall of a hall, reached by a straight stair
//   slab / roofBox       floor and roof slabs on any rectangle (holes cut), on the shell or inside
//   mesh                 a wire fence (low curb + see-through mesh: bullets and sight pass)
//   furnishers           classroom, lab, office, nurse, ward, ... (fill a room, keeping the corridor side clear)

import { ARCH } from '../../../../data/architecture.ts';
import { subtractRects, type Dir, type Hole, type Kit, type Rect } from '../../kit.ts';
import type { FurnitureKind, LootTableId, MaterialId, OpeningState, PartLayer, RoomUse } from '../../types.ts';
import { facade } from '../shop/common.ts';

export const T = ARCH.wall.concrete;
export const P = ARCH.wall.partition / 2;
export const LANE = ARCH.stair.wideWidth;
/** Depth of the hall in front of a stair core (along the wing). */
const HALL = 1.8;
/** Depth of the stair house on the roof past the stairwell. */
const HOUSE = 1.6;

export type Side = 'z+' | 'z-';

/** Normalised rectangle. */
export function R(x0: number, z0: number, x1: number, z1: number): Rect {
  return [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)];
}

/** A slab whose top is at storey `level`'s floor, cut round `holes` (shell by default: roofs). */
export function slab(k: Kit, level: number, r: Rect, mat: MaterialId, o: { holes?: Rect[]; layer?: PartLayer; tint?: number; thick?: number } = {}): void {
  const top = k.levelY(level);
  const th = o.thick ?? ARCH.slab;
  for (const q of subtractRects(r, o.holes ?? [])) k.box(level, q[0], top - th, q[1], q[2], top, q[3], mat, { layer: o.layer ?? 'shell', tint: o.tint });
}

/** Parapet (shell) round the outside of rect r (outer faces) from y0 to y1, `t` thick. */
export function parapet(k: Kit, r: Rect, y0: number, y1: number, mat: MaterialId, tint?: number, t = T): void {
  const [x0, z0, x1, z1] = r;
  k.box(-1, x0, y0, z0, x1, y1, z0 + t, mat, { layer: 'shell', tint });
  k.box(-1, x0, y0, z1 - t, x1, y1, z1, mat, { layer: 'shell', tint });
  k.box(-1, x0, y0, z0 + t, x0 + t, y1, z1 - t, mat, { layer: 'shell', tint });
  k.box(-1, x1 - t, y0, z0 + t, x1, y1, z1 - t, mat, { layer: 'shell', tint });
}

/** Wire fence along a line (x0 === x1 or z0 === z1): a low curb and a see-through mesh, with gaps [from, to] along it. */
export function mesh(k: Kit, x0: number, z0: number, x1: number, z1: number, gaps: [number, number][] = [], h = 1.8): void {
  const alongX = Math.abs(z1 - z0) < 1e-6;
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1);
  const a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const c = alongX ? z0 : x0;
  const runs: [number, number][] = [];
  let cur = a0;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g0 > cur) runs.push([cur, Math.min(g0, a1)]);
    cur = Math.max(cur, g1);
  }
  if (cur < a1) runs.push([cur, a1]);
  for (const [u0, u1] of runs) {
    if (u1 - u0 < 0.05) continue;
    const box = (y0: number, y1: number, th: number, mat: MaterialId, tint?: number): void => {
      if (alongX) k.box(-1, u0, y0, c - th, u1, y1, c + th, mat, { layer: 'shell', tint });
      else k.box(-1, c - th, y0, u0, c + th, y1, u1, mat, { layer: 'shell', tint });
    };
    box(-0.5, 0.3, 0.1, 'concrete');
    box(0.3, h, 0.015, 'glass', 1);
  }
}

/** Tree in a yard: a trunk (solid) and a crown (drawn only). */
export function yardTree(k: Kit, x: number, z: number, size: number): void {
  k.box(-1, x - 0.15, -0.5, z - 0.15, x + 0.15, size * 0.8, z + 0.15, 'woodDark', { layer: 'shell' });
  k.box(-1, x - size / 2, size * 0.6, z - size / 2, x + size / 2, size * 1.5, z + size / 2, 'plant', { layer: 'shell', solid: false });
}

/** White lines on the ground (a track, a court): a rectangle outline, drawn only. */
export function lines(k: Kit, r: Rect, w = 0.12): void {
  const [x0, z0, x1, z1] = r;
  const y = 0.02;
  const b = (a: number, b0: number, c: number, d0: number): void => {
    k.box(-1, a, 0, b0, c, y, d0, 'paper', { layer: 'shell', solid: false });
  };
  b(x0, z0, x1, z0 + w);
  b(x0, z1 - w, x1, z1);
  b(x0, z0 + w, x0 + w, z1 - w);
  b(x1 - w, z0 + w, x1, z1 - w);
}

/** One painted stripe on the ground (car park bays), drawn only. */
export function stripe(k: Kit, x0: number, z0: number, x1: number, z1: number): void {
  k.box(-1, x0, 0, z0, x1, 0.02, z1, 'paper', { layer: 'shell', solid: false });
}

/** A truck (cab and box) at (cx, cz), along x or z (shell, solid). */
export function truck(k: Kit, cx: number, cz: number, along: 'x' | 'z', len = 7, tint = k.rand(), dir = 1): void {
  const hw = 1.2;
  const cab = 1.8;
  const half = len / 2;
  const rect = (a0: number, a1: number): Rect => (along === 'x' ? R(cx + dir * a0, cz - hw, cx + dir * a1, cz + hw) : R(cx - hw, cz + dir * a0, cx + hw, cz + dir * a1));
  const c = rect(half - cab, half);
  k.box(-1, c[0], 0.4, c[1], c[2], 2.6, c[3], 'steel', { layer: 'shell', tint, role: 'furniture' });
  const bx = rect(-half, half - cab - 0.1);
  k.box(-1, bx[0], 0.5, bx[1], bx[2], 3.3, bx[3], 'appliance', { layer: 'shell', tint: k.rand(), role: 'furniture' });
}

// ---------------------------------------------------------------------------------------------
// Wings
// ---------------------------------------------------------------------------------------------

/** What a room off the corridor is for and how to fill it. */
export interface FitCtx {
  /** Side of the room the corridor is on. */
  corr: Side;
  /** Door centres (x) on the corridor wall. */
  doors: number[];
  level: number;
}
export type Fit = (k: Kit, level: number, r: Rect, ctx: FitCtx) => void;

export interface Bay {
  use: RoomUse;
  /** Length along the wing (m), between partition centre lines (scaled to fill the wing). */
  len: number;
  /** Doors into the corridor (0..2). Default 1, 2 when len >= 6. */
  doors?: number;
  locked?: boolean;
  /** No wall to the corridor: the room is joined to it (entrance halls, waiting areas). */
  open?: boolean;
  /** Doors in the outer wall (ground storey) into this room: at its middle, or `at` metres from the bay's start. */
  outer?: OuterDoor | OuterDoor[];
  /** Where the corridor doors are (metres from the bay's start), instead of the default. */
  doorAt?: number[];
  /** No window in the outer wall. */
  blind?: boolean;
  fit?: Fit;
}

export interface OuterDoor {
  at?: number;
  width?: number;
  state?: OpeningState;
  head?: number;
}

export interface Entrance {
  side: Dir;
  /** Centre: x for the z sides, z for the x sides (local, absolute). */
  at: number;
  width?: number;
  state?: OpeningState;
  head?: number;
}

export interface WingSpec {
  /** Outer faces. */
  rect: Rect;
  /** Storeys from the ground. */
  levels: number;
  corridor: Side | 'mid';
  /** Corridor width (inside). */
  cw?: number;
  /** Stair cores at the left (x0) and right (x1) ends: the two rooms beside the stairwell. */
  left?: { rooms?: [RoomUse, RoomUse] } | false;
  right?: { rooms?: [RoomUse, RoomUse] } | false;
  /** Which core's stair goes on to the roof (flat roof only). */
  roofAccess?: 'left' | 'right';
  mat: MaterialId;
  tint: number;
  pierMat?: MaterialId;
  floorMat?: (level: number) => MaterialId;
  bays: (level: number, side: Side) => Bay[];
  entrances?: Entrance[];
  roof: 'flat' | 'gable' | 'hip';
  roofMat?: MaterialId;
  roofTint?: number;
  rise?: number;
  parapet?: number;
  /** Share of broken panes on the upper storeys / chance a ground window is broken. */
  broken?: number;
  sill?: number;
  head?: number;
  stairMat?: MaterialId;
}

export interface WingRoom {
  id: number;
  level: number;
  side: Side;
  rect: Rect;
  bay: Bay;
}

export interface WingResult {
  /** Corridor room per storey (its first segment) and all the segments. */
  corridor: number[];
  segments: number[][];
  /** Hall rooms in front of the stair cores, per storey. */
  leftHall: number[];
  rightHall: number[];
  rooms: WingRoom[];
  /** Inside faces and the corridor band. */
  inner: Rect;
  corrBand: [number, number];
  /** Where the bays start and end (x). */
  span: [number, number];
  /** Roof rooms (when the roof can be reached). */
  roof: number[];
  /** Top of the walls (roof level, local y). */
  top: number;
}

/** A block of `levels` storeys along x (docs on top of the file). */
export function wing(k: Kit, s: WingSpec): WingResult {
  const [x0, z0, x1, z1] = s.rect;
  const ix0 = x0 + T;
  const ix1 = x1 - T;
  const iz0 = z0 + T;
  const iz1 = z1 - T;
  const L = s.levels;
  const cw = s.cw ?? 2.4;
  const top = k.levelY(L);
  const par = s.roof === 'flat' ? (s.parapet ?? ARCH.rail.parapet) : 0;
  const n = Math.ceil(k.def.storeyHeight / 2 / ARCH.stair.maxRise - 1e-6);
  const stairLen = n * ARCH.stair.going + ARCH.stair.landing;
  const res: WingResult = { corridor: [], segments: [], leftHall: [], rightHall: [], rooms: [], inner: [ix0, iz0, ix1, iz1], corrBand: [0, 0], span: [0, 0], roof: [], top };

  // Corridor band.
  let cz0: number;
  let cz1: number;
  if (s.corridor === 'z+') [cz0, cz1] = [iz1 - cw, iz1];
  else if (s.corridor === 'z-') [cz0, cz1] = [iz0, iz0 + cw];
  else [cz0, cz1] = [(iz0 + iz1) / 2 - cw / 2, (iz0 + iz1) / 2 + cw / 2];
  res.corrBand = [cz0, cz1];
  // Stairwell band across z: centred on the corridor, inside the walls.
  const band = 2 * LANE + 0.15;
  let sz0 = Math.max(iz0, Math.min(iz1 - band, (cz0 + cz1) / 2 - band / 2));
  if (sz0 - iz0 < 1.6 && sz0 - iz0 > 0) sz0 = iz0;
  if (iz1 - (sz0 + band) < 1.6 && iz1 - (sz0 + band) > 0) sz0 = iz1 - band;
  const sz1 = sz0 + band;
  const zA = sz1 - LANE / 2; // first flight's lane (the second is towards -z)

  const cores: { s: 1 | -1; xs1: number; xh: number; rooms: [RoomUse, RoomUse]; halls: number[] }[] = [];
  if (s.left) cores.push({ s: 1, xs1: ix0 + stairLen, xh: ix0 + stairLen + HALL, rooms: s.left.rooms ?? ['toilet', 'storage'], halls: res.leftHall });
  if (s.right) cores.push({ s: -1, xs1: ix1 - stairLen, xh: ix1 - stairLen - HALL, rooms: s.right.rooms ?? ['toilet', 'storage'], halls: res.rightHall });
  const xa = s.left ? cores[0]!.xh : ix0;
  const xb = s.right ? cores[cores.length - 1]!.xh : ix1;
  res.span = [xa, xb];

  // Bays per storey and side, scaled to fill [xa, xb].
  const sides: Side[] = s.corridor === 'mid' ? ['z-', 'z+'] : [s.corridor === 'z+' ? 'z-' : 'z+'];
  const memo = new Map<string, { bay: Bay; b0: number; b1: number }[]>();
  const layout = (level: number, side: Side): { bay: Bay; b0: number; b1: number }[] => {
    const key = `${level}${side}`;
    const got = memo.get(key);
    if (got) return got;
    const bays = s.bays(level, side);
    const sum = bays.reduce((a, b) => a + b.len, 0);
    const f = (xb - xa) / sum;
    let x = xa;
    const out = bays.map((bay) => {
      const b0 = x;
      x += bay.len * f;
      return { bay, b0, b1: x };
    });
    memo.set(key, out);
    return out;
  };
  const roomBand = (side: Side): [number, number] => (side === 'z-' ? [iz0, cz0 - P] : [cz1 + P, iz1]);
  const wallOf = (side: Side): number => (side === 'z-' ? cz0 : cz1);

  // ---- Outer walls: the ground storey with its openings, the upper storeys as a facade.
  const ground0 = layout(0, sides[0]!);
  const groundSides = new Map<Side, { bay: Bay; b0: number; b1: number }[]>();
  for (const side of sides) groundSides.set(side, side === sides[0] ? ground0 : layout(0, side));
  const holes: Record<Dir, Hole[]> = { 'z+': [], 'z-': [], 'x+': [], 'x-': [] };
  for (const e of s.entrances ?? []) {
    const h = k.door(e.at - (e.side[0] === 'z' ? x0 : iz0), e.state ?? 'open', e.width ?? ARCH.door.width);
    holes[e.side].push(e.head ? { ...h, head: e.head } : h);
  }
  const sill = s.sill ?? 0.9;
  const head = Math.min(s.head ?? 2.4, k.def.storeyHeight - 0.5);
  // Doors in the outer walls of rooms (bay.outer), then ribbon windows: one pane per run between
  // doors and blind bays, with piers at the bay lines (far fewer parts than a window per bay).
  const piersAt: number[] = [...cores.map((c) => c.xh)];
  for (const side of sides) {
    for (const r of groundSides.get(side)!) {
      for (const o of r.bay.outer ? [r.bay.outer].flat() : []) {
        const h = k.door((o.at !== undefined ? r.b0 + o.at : (r.b0 + r.b1) / 2) - x0, o.state ?? 'open', o.width ?? ARCH.door.wide);
        holes[side].push(o.head ? { ...h, head: o.head } : h);
      }
    }
  }
  for (const r of ground0) {
    if (r.b0 > xa + 0.5) piersAt.push(r.b0);
  }
  for (const side of (['z-', 'z+'] as const)) {
    const blocked: [number, number][] = holes[side].map((h) => [x0 + h.at - h.width / 2 - 0.45, x0 + h.at + h.width / 2 + 0.45]);
    for (const r of groundSides.get(side) ?? []) if (r.bay.blind) blocked.push([r.b0, r.b1]);
    blocked.sort((p, q) => p[0] - q[0]);
    let u = x0 + 0.8;
    const runs: [number, number][] = [];
    for (const [b0, b1] of [...blocked, [x1 - 0.8, x1 - 0.8] as [number, number]]) {
      if (b0 - u >= 1.2) runs.push([u, b0]);
      u = Math.max(u, b1);
    }
    const [t0, t1] = side === 'z+' ? [z1 - T, z1] : [z0, z0 + T];
    const fy = k.levelY(0);
    for (const [a, b] of runs) {
      holes[side].push(k.window((a + b) / 2 - x0, b - a, { sill, head, broken: k.rand() < (s.broken ?? 0.15) }));
      for (const px of piersAt) if (px > a + 0.4 && px < b - 0.4) k.box(-1, px - 0.15, fy + sill, t0, px + 0.15, fy + head, t1, s.mat, { layer: 'shell', tint: s.tint });
    }
  }
  const y1g = L === 1 ? top + par : k.levelY(1);
  const wo = { mat: s.mat, tint: s.tint, y1: y1g, exterior: true, layer: 'shell' as const };
  k.wall(0, x0, z1 - T, x1, z1, holes['z+'], wo);
  k.wall(0, x0, z0, x1, z0 + T, holes['z-'], wo);
  k.wall(0, x0, iz0, x0 + T, iz1, holes['x-'], wo);
  k.wall(0, x1 - T, iz0, x1, iz1, holes['x+'], wo);
  if (L > 1) {
    const piers = [x0 + 0.2, x1 - 0.2, ...cores.map((c) => c.xh), ...ground0.slice(1).map((r) => r.b0)];
    const f = { axis: 'x' as const, u0: x0, u1: x1, from: 1, to: L, y0: k.levelY(1), y1: top + par, piers, pier: 0.4, sill, head: Math.min(head, k.def.storeyHeight - 0.5), mat: s.mat, tint: s.tint, pierMat: s.pierMat };
    facade(k, { ...f, t0: z1 - T, t1: z1, broken: s.broken ?? 0.1 });
    facade(k, { ...f, t0: z0, t1: z0 + T, broken: (s.broken ?? 0.1) / 2 });
    k.box(-1, x0, k.levelY(1), iz0, x0 + T, top + par, iz1, s.mat, { layer: 'shell', tint: s.tint });
    k.box(-1, x1 - T, k.levelY(1), iz0, x1, top + par, iz1, s.mat, { layer: 'shell', tint: s.tint });
  }

  // ---- Storeys.
  const roofHoles: Rect[] = [];
  for (let level = 0; level < L; level++) {
    k.floor(level, s.floorMat?.(level) ?? (level === 0 ? 'tileFloor' : 'vinyl'), [ix0, iz0, ix1, iz1]);
    // Stair cores.
    for (const c of cores) {
      const lastFlight = level === L - 1;
      const toRoof = lastFlight && s.roof === 'flat' && s.roofAccess === (c.s > 0 ? 'left' : 'right');
      if (!lastFlight || toRoof) {
        const st = k.stairs({ level, start: [c.xs1, zA], dir: c.s > 0 ? 'x-' : 'x+', width: LANE, kind: 'switchback', turn: c.s > 0 ? 'right' : 'left', mat: s.stairMat ?? 'concrete', tint: s.tint, to: level + 1 });
        if (toRoof) roofHoles.push(st.rect);
      }
      const ie = c.s > 0 ? ix0 : ix1;
      // Walls between the stairwell and the rooms beside it, the rooms' walls to the hall.
      const beside: [number, number, RoomUse][] = [];
      if (sz0 - iz0 > 0.01) beside.push([iz0, sz0, c.rooms[0]]);
      if (iz1 - sz1 > 0.01) beside.push([sz1, iz1, c.rooms[1]]);
      for (const [a, b, use] of beside) {
        const zEdge = a === iz0 ? sz0 : sz1;
        k.partition(level, Math.min(ie, c.xs1), zEdge, Math.max(ie, c.xs1), zEdge);
        const room = b - a >= 1.5;
        k.partition(level, c.xs1, a, c.xs1, b, room ? [k.door((b - a) / 2)] : []);
        if (room) {
          const r = R(ie, a + (a === iz0 ? 0 : P), c.xs1 - c.s * P, b - (b === iz1 ? 0 : P));
          k.room(level, r[0], r[1], r[2], r[3], use);
          endFit(k, level, use, r, c.s > 0 ? 'x+' : 'x-');
        }
      }
      // The hall in front of the stairwell; its wall to the bays (not across the corridor).
      const hr = R(c.xs1, iz0, c.xh, iz1);
      c.halls.push(k.room(level, hr[0], hr[1], hr[2], hr[3], level === 0 ? 'lobby' : 'hall'));
      if (cz0 - iz0 > 0.01) k.partition(level, c.xh, iz0, c.xh, cz0);
      if (iz1 - cz1 > 0.01) k.partition(level, c.xh, cz1, c.xh, iz1);
    }
    // Corridor, in segments at the bay lines (each joined to the next): fewer ways per room.
    const cza = s.corridor === 'z-' ? iz0 : cz0 + P;
    const czb = s.corridor === 'z+' ? iz1 : cz1 - P;
    const cuts = [xa];
    for (const x of sides.flatMap((sd) => layout(level, sd).slice(1).map((r) => r.b0)).sort((p, q) => p - q)) if (x > cuts[cuts.length - 1]! + 2.5 && x < xb - 2.5) cuts.push(x);
    cuts.push(xb);
    const segs: number[] = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      segs.push(k.room(level, cuts[i]!, cza, cuts[i + 1]!, czb, level === 0 ? 'lobby' : 'hall'));
      if (i > 0) k.join(segs[i - 1]!, segs[i]!);
    }
    res.corridor.push(segs[0]!);
    res.segments.push(segs);
    const segAt = (x: number): number => segs[Math.max(0, cuts.findIndex((c, i) => i + 1 < cuts.length && x >= c && x <= cuts[i + 1]!))]!;
    for (const c of cores) k.join(c.halls[c.halls.length - 1]!, c.s > 0 ? segs[0]! : segs[segs.length - 1]!);
    // Bays.
    for (const side of sides) {
      const rows = layout(level, side);
      const [ra, rb] = roomBand(side);
      const wz = wallOf(side);
      rows.forEach(({ bay, b0, b1 }, i) => {
        if (i > 0) k.partition(level, b0, ra - (side === 'z-' ? 0 : P), b0, rb + (side === 'z-' ? P : 0));
        const nd = bay.open ? 0 : (bay.doors ?? (b1 - b0 >= 6 ? 2 : 1));
        const len = b1 - b0;
        const at = bay.open ? [] : bay.doorAt ?? (nd === 2 ? [Math.min(1.1, len / 4), len - Math.min(1.1, len / 4)] : nd === 1 ? [len / 2] : []);
        if (!bay.open) k.partition(level, b0, wz, b1, wz, at.map((a) => k.door(a, bay.locked ? 'locked' : 'open')));
        const r = R(b0 + (b0 <= ix0 + 1e-6 ? 0 : P), ra, b1 - (b1 >= ix1 - 1e-6 ? 0 : P), rb);
        const id = k.room(level, r[0], r[1], r[2], r[3], bay.use, { locked: bay.locked });
        if (bay.open) k.join(segAt((b0 + b1) / 2), id);
        res.rooms.push({ id, level, side, rect: r, bay });
        if (!bay.locked) {
          const ctx: FitCtx = { corr: side === 'z-' ? 'z+' : 'z-', doors: at.map((a) => b0 + a), level };
          if (bay.fit) bay.fit(k, level, r, ctx);
          else if (bay.outer && level === 0) sideFit(k, level, bay.use, r, ctx);
          else fill(k, level, bay.use, r, ctx);
        }
      });
    }
  }

  // ---- Roof.
  const inside: Rect = [ix0, iz0, ix1, iz1];
  if (s.roof === 'flat') {
    if (L === k.storeys) k.floor(L, s.roofMat ?? 'concrete', inside, { tint: s.roofTint });
    else slab(k, L, inside, s.roofMat ?? 'concrete', { holes: roofHoles, tint: s.roofTint });
    const core = cores.find((c) => s.roofAccess === (c.s > 0 ? 'left' : 'right'));
    if (core) {
      const e = top;
      const ph = 2.7;
      const ie = core.s > 0 ? ix0 : ix1;
      const oe = core.s > 0 ? x0 : x1;
      const xe = core.xs1 + core.s * HOUSE;
      const wopt = { mat: s.mat, tint: s.tint, y0: e, y1: e + ph, layer: 'shell' as const };
      const a = R(oe, sz0 - T, xe + core.s * T, sz0);
      k.wall(L, a[0], a[1], a[2], a[3], [], wopt);
      const b = R(oe, sz1, xe + core.s * T, sz1 + T);
      k.wall(L, b[0], b[1], b[2], b[3], [], wopt);
      const c = R(xe, sz0, xe + core.s * T, sz1);
      k.wall(L, c[0], c[1], c[2], c[3], [k.door((sz1 - sz0) / 2)], wopt);
      const endw = R(oe, sz0, ie, sz1);
      k.box(-1, endw[0], e + par, endw[1], endw[2], e + ph, endw[3], s.mat, { layer: 'shell', tint: s.tint });
      const cap = R(oe, sz0 - T, xe + core.s * T, sz1 + T);
      k.box(-1, cap[0], e + ph, cap[1], cap[2], e + ph + 0.2, cap[3], s.mat, { layer: 'shell', tint: s.tint });
      const sr = R(core.xs1, sz0, xe, sz1);
      k.room(L, sr[0], sr[1], sr[2], sr[3], 'stairs');
      const main = R(xe + core.s * T, iz0, core.s > 0 ? ix1 : ix0, iz1);
      const M = k.room(L, main[0], main[1], main[2], main[3], 'roof');
      res.roof.push(M);
      for (const [za, zb] of [[iz0, sz0 - T], [sz1 + T, iz1]] as const) {
        if (zb - za < 1.0) continue;
        const q = R(ie, za, xe + core.s * T, zb);
        const id = k.room(L, q[0], q[1], q[2], q[3], 'roof');
        k.join(id, M);
        res.roof.push(id);
      }
      k.furniture(L, (main[0] + main[2]) / 2 - 1.0, main[1] + 0.4, (main[0] + main[2]) / 2 + 1.0, main[1] + 1.4, 1.3, 'steel', { tint: 0.6 }); // condensers
    }
  } else {
    slab(k, L, inside, 'wood', { layer: 'interior' });
    const ov = 0.45;
    k.part({ shape: s.roof === 'hip' ? 'hip' : 'gable', x0: x0 - ov, x1: x1 + ov, z0: z0 - ov, z1: z1 + ov, y0: top, y1: top + (s.rise ?? 2.5), mat: s.roofMat ?? 'tile', tint: s.roofTint, axis: 'x' });
  }
  return res;
}

// ---------------------------------------------------------------------------------------------
// Halls
// ---------------------------------------------------------------------------------------------

export interface HallSpec {
  /** Outer faces. */
  rect: Rect;
  /** Height in storeys (the walls rise to levelY(levels)). */
  levels: number;
  mat: MaterialId;
  tint: number;
  thick?: number;
  floorMat?: MaterialId;
  use: RoomUse;
  doors?: Entrance[];
  /** Windows: low ones on the long sides (ground storey) and high ones (top storey), per side. */
  low?: { sides: Dir[]; n: number; width?: number };
  high?: { sides: Dir[]; n: number; width?: number };
  roof: 'gable' | 'flat' | 'saw' | 'none';
  roofMat?: MaterialId;
  roofTint?: number;
  rise?: number;
  axis?: 'x' | 'z';
  parapet?: number;
  broken?: number;
}

/** A tall single room: returns its room id (level 0) and the inside rectangle. */
export function hall(k: Kit, s: HallSpec): { id: number; inner: Rect; top: number } {
  const [x0, z0, x1, z1] = s.rect;
  const t = s.thick ?? T;
  const top = k.levelY(s.levels);
  const par = s.roof === 'flat' ? (s.parapet ?? 0.6) : 0;
  for (let level = 0; level < s.levels; level++) {
    const hs: Record<Dir, Hole[]> = { 'z+': [], 'z-': [], 'x+': [], 'x-': [] };
    if (level === 0) for (const e of s.doors ?? []) {
      const h = k.door(e.at - (e.side[0] === 'z' ? x0 : z0 + t), e.state ?? 'open', e.width ?? ARCH.door.width);
      hs[e.side].push(e.head ? { ...h, head: e.head } : h);
    }
    const win = level === 0 ? s.low : level === s.levels - 1 ? s.high : undefined;
    if (win) {
      // Ribbon windows: one pane per run between the doors, piers every few metres.
      const fy = k.levelY(level);
      const [sill, head] = level === 0 ? [1.2, 2.4] : [0.8, k.def.storeyHeight - 0.5];
      for (const side of win.sides) {
        const alongX = side[0] === 'z';
        const base = alongX ? x0 : z0 + t;
        const blocked = hs[side].map((h) => [base + h.at - h.width / 2 - 0.5, base + h.at + h.width / 2 + 0.5] as [number, number]).sort((p, q) => p[0] - q[0]);
        let u = (alongX ? x0 : z0 + t) + 0.8;
        const end = (alongX ? x1 : z1 - t) - 0.8;
        const runs: [number, number][] = [];
        for (const [b0, b1] of [...blocked, [end, end] as [number, number]]) {
          if (b0 - u >= 1.2) runs.push([u, b0]);
          u = Math.max(u, b1);
        }
        const [c0, c1] = side === 'z+' ? [z1 - t, z1] : side === 'z-' ? [z0, z0 + t] : side === 'x-' ? [x0, x0 + t] : [x1 - t, x1];
        const gap = win.width ? win.width + 0.8 : 3.5;
        for (const [a, b] of runs) {
          hs[side].push(k.window((a + b) / 2 - base, b - a, { sill, head, broken: k.rand() < (s.broken ?? 0.2) }));
          const np = Math.floor((b - a) / gap);
          for (let i = 1; i <= np; i++) {
            const pc = a + ((b - a) * i) / (np + 1);
            if (alongX) k.box(-1, pc - 0.15, fy + sill, c0, pc + 0.15, fy + head, c1, s.mat, { layer: 'shell', tint: s.tint });
            else k.box(-1, c0, fy + sill, pc - 0.15, c1, fy + head, pc + 0.15, s.mat, { layer: 'shell', tint: s.tint });
          }
        }
      }
    }
    const y1 = level === s.levels - 1 ? top + par : k.levelY(level + 1);
    const wo = { mat: s.mat, tint: s.tint, y1, exterior: true, layer: 'shell' as const };
    k.wall(level, x0, z1 - t, x1, z1, hs['z+'], wo);
    k.wall(level, x0, z0, x1, z0 + t, hs['z-'], wo);
    k.wall(level, x0, z0 + t, x0 + t, z1 - t, hs['x-'], wo);
    k.wall(level, x1 - t, z0 + t, x1, z1 - t, hs['x+'], wo);
  }
  const inner: Rect = [x0 + t, z0 + t, x1 - t, z1 - t];
  k.floor(0, s.floorMat ?? 'flooring', inner);
  const id = k.room(0, inner[0], inner[1], inner[2], inner[3], s.use);
  const axis = s.axis ?? (x1 - x0 >= z1 - z0 ? 'x' : 'z');
  const ov = 0.45;
  if (s.roof === 'gable') {
    k.part({ shape: 'gable', x0: x0 - ov, x1: x1 + ov, z0: z0 - ov, z1: z1 + ov, y0: top, y1: top + (s.rise ?? 2), mat: s.roofMat ?? 'metalRoof', tint: s.roofTint, axis });
  } else if (s.roof === 'flat') {
    slab(k, s.levels, inner, s.roofMat ?? 'concrete', { tint: s.roofTint, layer: 'shell' });
  } else if (s.roof === 'saw') {
    // Sawtooth: ramps rising towards -z with a glazed north face, along x.
    const rise = s.rise ?? 2;
    const bays = Math.max(2, Math.round((z1 - z0) / 6));
    const step = (z1 - z0) / bays;
    for (let i = 0; i < bays; i++) {
      const za = z0 + i * step;
      k.part({ shape: 'wedge', x0, x1, z0: za, z1: za + step, y0: top, y1: top + rise, mat: s.roofMat ?? 'metalRoof', tint: s.roofTint, slope: 'z-' });
      k.box(-1, x0, top, za, x1, top + rise, za + 0.04, 'glass', { layer: 'shell' });
    }
  }
  return { id, inner, top };
}

/**
 * A steel gallery 1.3 m wide along a wall of a hall at storey `level` (1 = one storey up), from x = xa
 * to xb. `side` is the wall it hangs on: 'z-' the wall whose inside face is at z = zw (low z), 'z+'
 * the high-z wall. It is reached by a straight stair at x = `stairAt` climbing towards the wall
 * (its foot out in the hall). Returns the gallery's room.
 */
export function catwalk(k: Kit, level: number, xa: number, xb: number, zw: number, o: { stairAt: number; side?: Side; tint?: number; use?: RoomUse }): { id: number; rect: Rect; foot: [number, number] } {
  const sg = (o.side ?? 'z-') === 'z-' ? 1 : -1;
  const wdt = 1.3;
  const n = Math.ceil(k.def.storeyHeight / ARCH.stair.maxRise - 1e-6);
  const len = n * ARCH.stair.going;
  const edge = zw + sg * wdt;
  const xs = o.stairAt;
  k.stairs({ level: level - 1, start: [xs, edge + sg * len], dir: sg > 0 ? 'z-' : 'z+', width: ARCH.stair.width, kind: 'straight', rails: [], mat: 'steel', tint: o.tint, to: level });
  const rect = R(xa, zw, xb, edge);
  slab(k, level, rect, 'steel', { layer: 'interior', tint: o.tint, thick: 0.12 });
  // Railing along the open edge (a gap where the stair arrives) and across both ends.
  const y = k.levelY(level);
  const rail = (x0: number, z0: number, x1: number, z1: number): void => {
    const q = R(x0, z0, x1, z1);
    if (q[2] - q[0] > 0.05 && q[3] - q[1] > 0.05) k.box(level, q[0], y, q[1], q[2], y + ARCH.rail.height, q[3], 'steel', { role: 'furniture', tint: o.tint });
  };
  const rz = edge + sg * 0.06;
  rail(xa, edge, xs - ARCH.stair.width / 2 - 0.05, rz);
  rail(xs + ARCH.stair.width / 2 + 0.05, edge, xb, rz);
  rail(xa, zw, xa + 0.06, edge);
  rail(xb - 0.06, zw, xb, edge);
  const id = k.room(level, rect[0], rect[1], rect[2], rect[3], o.use ?? 'machine');
  return { id, rect, foot: [xs, edge + sg * (len + 0.6)] };
}

// ---------------------------------------------------------------------------------------------
// Furnishing
// ---------------------------------------------------------------------------------------------

/** The part of room r clear of the corridor side (1.4 m kept free inside its doors) and the side facing the corridor. */
export function zone(r: Rect, ctx: FitCtx, keep = 1.4): { z: Rect; face: Dir; far: Dir } {
  const [x0, z0, x1, z1] = r;
  return ctx.corr === 'z+'
    ? { z: [x0, z0, x1, Math.max(z0 + 0.5, z1 - keep)], face: 'z+', far: 'z-' }
    : { z: [x0, Math.min(z1 - 0.5, z0 + keep), x1, z1], face: 'z-', far: 'z+' };
}

function fz(face: Dir, z: Rect, depth: number): [number, number] {
  // A strip of `depth` against the far wall (opposite to `face`).
  return face === 'z+' ? [z[1], z[1] + depth] : [z[3] - depth, z[3]];
}

function put(k: Kit, level: number, x0: number, z0: number, x1: number, z1: number, h: number, mat: MaterialId, tint?: number, search?: { kind: FurnitureKind; face: Dir; table?: LootTableId }): void {
  if (x1 - x0 < 0.2 || z1 - z0 < 0.2) return;
  k.furniture(level, x0, z0, x1, z1, h, mat, { tint, search });
}

/** 教室: blackboard, teacher's desk, rows of pupils' desks with an aisle, lockers at the back. */
export const classroom: Fit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx);
  const [x0, , x1] = r;
  const [za, zb] = [z[1] + 0.5, z[3] - 0.2];
  if (zb - za < 1.5 || x1 - x0 < 4) return;
  k.box(level, x0, k.levelY(level) + 0.9, (za + zb) / 2 - 1.8, x0 + 0.04, k.levelY(level) + 2.0, (za + zb) / 2 + 1.8, 'sign', { tint: 0, solid: false });
  put(k, level, x0 + 1.0, (za + zb) / 2 - 0.7, x0 + 1.7, (za + zb) / 2 + 0.7, 0.75, 'wood', 0.4, { kind: 'desk', face: 'x+', table: 'classroom' });
  const mid = (za + zb) / 2;
  for (let x = x0 + 2.8; x + 0.5 < x1 - 1.4; x += 1.05) {
    if (k.rand() < 0.08) continue; // a desk pushed aside
    put(k, level, x, za, x + 0.5, mid - 0.35, 0.68, 'wood', 0.6);
    put(k, level, x, mid + 0.35, x + 0.5, zb, 0.68, 'wood', 0.6);
  }
  put(k, level, x1 - 0.45, za, x1, zb, 1.1, 'wood', 0.2, { kind: 'locker', face: 'x-', table: 'classroom' });
  if (k.rand() < 0.15) k.stain(level, x0 + 1.9, za, x0 + 2.6, za + 1.0);
  void face;
};

/** 理科室 / laboratory: big benches, a chemicals cabinet. */
export const lab: Fit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx);
  const [x0, , x1] = r;
  const [za, zb] = [z[1] + 0.5, z[3] - 0.5];
  if (x1 - x0 < 3) return;
  if (zb - za < 2 || x1 - x0 < 4) {
    // A shallow room: one bench along the far wall.
    const [a, b] = fz(face, z, 0.7);
    put(k, level, x0 + 0.4, a, x1 - 0.4, b, 0.9, 'counter', 0.9, { kind: 'counter', face, table: 'lab' });
    return;
  }
  let first = true;
  for (let x = x0 + 1.0; x + 1.2 < x1 - 1.6; x += 2.4) {
    put(k, level, x, za, x + 1.2, zb, 0.9, 'counter', 0.9, first ? { kind: 'counter', face: 'x+', table: 'lab' } : undefined);
    first = false;
  }
  put(k, level, x1 - 0.5, za, x1, Math.min(zb, za + 2.2), 1.9, 'steel', 0.9, { kind: 'cabinet', face: 'x-', table: 'lab' });
};

/** 職員室 / office: islands of desks, cabinets along the far wall. */
export const office: Fit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx);
  const [x0, , x1] = r;
  const [za, zb] = [z[1] + 0.4, z[3] - 0.4];
  if (zb - za < 1.5 || x1 - x0 < 3) return;
  const [ca, cb] = fz(face, [x0, za, x1, zb], 0.45);
  put(k, level, x0 + 0.6, ca, Math.min(x1 - 0.6, x0 + 4.0), cb, 1.8, 'steel', 0.7, { kind: 'cabinet', face, table: 'office' });
  const dz0 = face === 'z+' ? cb + 0.9 : za;
  const dz1 = face === 'z+' ? zb : ca - 0.9;
  let first = true;
  for (let x = x0 + 1.0; x + 1.6 < x1 - 0.8 && dz1 - dz0 > 0.8; x += 3.2) {
    put(k, level, x, dz0, x + 1.6, dz1, 0.72, 'wood', 0.55, first ? { kind: 'desk', face: 'x-', table: 'office' } : undefined);
    first = false;
  }
  if (k.rand() < 0.3) k.stain(level, x0 + 0.5, za, x0 + 1.5, za + 1.0, 'paper');
};

/** 保健室 / treatment room: beds, a medicine cabinet. */
export const nurse: Fit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx);
  const [x0, , x1] = r;
  const [za, zb] = [z[1] + 0.2, z[3] - 0.2];
  if (zb - za < 2 || x1 - x0 < 3) {
    // Too small for beds: the medicine cabinet against the far wall.
    const [a, b] = fz(face, z, 0.45);
    put(k, level, x0 + 0.2, a, Math.min(x1 - 0.2, x0 + 1.6), b, 1.8, 'steel', 0.9, { kind: 'cabinet', face, table: 'pharmacy' });
    return;
  }
  const [ba, bb] = fz(face, [x0, za, x1, zb], 2.0);
  for (let x = x0 + 0.4; x + 0.9 < x1 - 1.6; x += 1.5) put(k, level, x, ba, x + 0.9, bb, 0.6, 'fabric', 0.9);
  put(k, level, x1 - 0.5, za, x1, Math.min(zb, za + 2.0), 1.8, 'steel', 0.9, { kind: 'cabinet', face: 'x-', table: 'pharmacy' });
  if (k.rand() < 0.5) k.stain(level, x0 + 0.5, za + 0.2, x0 + 1.6, za + 1.2);
};

/** 病室: four beds (two each side of the room's middle), lockers, one bed searched. */
export const ward: Fit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx, 1.2);
  const [x0, , x1] = r;
  const [za, zb] = [z[1] + 0.1, z[3] - 0.1];
  if (zb - za < 2 || x1 - x0 < 2.6) return;
  const [ba, bb] = fz(face, [x0, za, x1, zb], 2.0);
  const beds = x1 - x0 > 5 ? [x0 + 0.1, x1 - 1.0] : [x0 + 0.1];
  beds.forEach((bx, i) => put(k, level, bx, ba, bx + 0.9, bb, 0.6, 'fabric', 0.9, i === 0 ? { kind: 'bed', face: 'x+', table: 'ward' } : undefined));
  const cx = (x0 + x1) / 2;
  const [ca, cb] = face === 'z+' ? [ba, ba + 0.45] : [bb - 0.45, bb];
  put(k, level, cx - 0.25, ca, cx + 0.25, cb, 0.9, 'appliance', 0.1, { kind: 'cabinet', face, table: 'ward' });
  if (k.rand() < 0.35) k.stain(level, cx - 0.6, za + 0.3, cx + 0.6, za + 1.4);
};

/** Shelves along the far wall (storage, pharmacy store, library). */
export function shelves(table: LootTableId, kind: FurnitureKind = 'shelf', mat: MaterialId = 'shelf'): Fit {
  return (k, level, r, ctx) => {
    const { z, face } = zone(r, ctx);
    const [x0, , x1] = r;
    if (z[3] - z[1] < 0.8 || x1 - x0 < 1.5) return;
    const [a, b] = fz(face, z, 0.5);
    put(k, level, x0 + 0.2, a, x1 - 0.2, b, 2.0, mat, undefined, { kind, face, table });
    if (z[3] - z[1] > 3.0 && x1 - x0 > 3) {
      const m = (z[1] + z[3]) / 2;
      put(k, level, x0 + 0.8, m - 0.3, x1 - 0.8, m + 0.3, 1.6, mat);
    }
  };
}

/** Toilets: stalls along the far wall. */
export const toilets: Fit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx, 1.0);
  const [x0, , x1] = r;
  if (z[3] - z[1] < 1.0) return;
  const [a, b] = fz(face, z, 1.0);
  for (let x = x0 + 0.9; x < x1 - 0.2; x += 0.95) put(k, level, x, a, x + 0.05, b, 1.8, 'plaster', 0.8);
  k.search(level, (x0 + Math.min(x1, x0 + 0.9)) / 2, (z[1] + z[3]) / 2, 'cabinet', 'toilet');
};

/** Kitchen / canteen: worktops and a fridge against the far wall. */
export const kitchen: Fit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx);
  const [x0, , x1] = r;
  if (z[3] - z[1] < 1.2 || x1 - x0 < 2.5) return;
  const [a, b] = fz(face, z, 0.65);
  put(k, level, x0 + 0.2, a, x1 - 1.2, b, 0.9, 'counter', 0.1, { kind: 'counter', face, table: 'kitchen' });
  put(k, level, x1 - 1.0, a, x1 - 0.2, b, 1.9, 'appliance', 0.1, { kind: 'fridge', face, table: 'grocery' });
};

/** A room beside a stairwell (its door on the x side `face` looks at): one piece against the end wall. */
function endFit(k: Kit, level: number, use: RoomUse, r: Rect, face: Dir): void {
  const [x0, z0, x1, z1] = r;
  if (z1 - z0 < 1.4 || x1 - x0 < 2.2) return;
  const [a, b] = face === 'x+' ? [x0, x0 + 0.5] : [x1 - 0.5, x1];
  if (use === 'toilet') {
    for (let z = z0 + 0.95; z < z1 - 0.2; z += 0.95) put(k, level, face === 'x+' ? x0 : x1 - 1.0, z, face === 'x+' ? x0 + 1.0 : x1, z + 0.05, 1.8, 'plaster', 0.8);
    k.search(level, face === 'x+' ? x0 + 0.5 : x1 - 0.5, z0 + 0.45, 'cabinet', 'toilet');
    return;
  }
  const table: LootTableId = use === 'clinic' ? 'pharmacy' : use === 'kitchen' ? 'kitchen' : use === 'office' ? 'office' : 'storage';
  put(k, level, a, z0 + 0.2, b, z1 - 0.2, 1.9, use === 'office' ? 'steel' : 'shelf', 0.6, { kind: 'shelf', face, table });
}

/** A room with a door in the outer wall and doors to the corridor: furniture only along its two side walls. */
function sideFit(k: Kit, level: number, use: RoomUse, r: Rect, ctx: FitCtx): void {
  const [x0, z0, x1, z1] = r;
  const [za, zb] = ctx.corr === 'z+' ? [z0 + 1.6, z1 - 1.6] : [z0 + 1.6, z1 - 1.6];
  if (zb - za < 0.5 || x1 - x0 < 2.6) return;
  const table: LootTableId = use === 'canteen' || use === 'kitchen' ? 'kitchen' : use === 'clinic' ? 'pharmacy' : use;
  put(k, level, x0, za, x0 + 0.6, zb, 0.9, 'counter', 0.1, { kind: 'counter', face: 'x+', table });
  if (x1 - x0 >= 4.2) put(k, level, x1 - 0.6, za, x1, zb, 1.9, 'shelf', 0.5, { kind: 'shelf', face: 'x-', table: use === 'canteen' || use === 'kitchen' ? 'grocery' : 'storage' });
}

/** Pick a furnisher for a room use. */
export function fill(k: Kit, level: number, use: RoomUse, r: Rect, ctx: FitCtx): void {
  switch (use) {
    case 'classroom': return classroom(k, level, r, ctx);
    case 'lab': return lab(k, level, r, ctx);
    case 'office': case 'command': return office(k, level, r, ctx);
    case 'clinic': return nurse(k, level, r, ctx);
    case 'ward': return ward(k, level, r, ctx);
    case 'storage': return shelves('storage')(k, level, r, ctx);
    case 'toilet': return toilets(k, level, r, ctx);
    case 'kitchen': case 'canteen': return kitchen(k, level, r, ctx);
    default:
  }
}
