// Helpers shared by the transport types (07d-2e: stations and airports). They only call the kit, so
// the blueprints stay plain data. Local frame as in the kit: x across the front, z towards the front
// (z = d), y up. Stations put their tracks along x at the back of the site (low z) and the station
// building and its plaza at the front; airports put the runway at the back and the terminal at the front.
//
//   track / wire / mast      a railway track (ballast and rails, drawn only — the ground is walkable),
//                            the overhead wire and its masts
//   car / train              railway cars standing at a platform: the open ones are rooms entered by
//                            the doors on the platform side (seats, a bag left behind); the others are
//                            closed shells
//   platform                 a platform (the storey-0 floor, `plinth` above the rails' ground) cut into
//                            rectangle rooms round what stands on it (stairs, columns): the strips beside
//                            an obstacle are joined to the full-width parts before and after it
//   flight                   a straight stair climbing along x with walls and a roof on both sides
//                            (the stairs up to a footbridge from a platform)
//   bus / plane / fence / canopy / nameBoard / paint    the rest of a site
//
// Floors above `def.storeys` (control towers, hotel towers, department stores): rooms are found by
// their height, so a building may rise past its storeys inside `roofRise`; the far box (eaves) then
// stays low over a site that is mostly tracks, aprons and runway.

import { ARCH } from '../../../../data/architecture.ts';
import type { Dir, Hole, Kit, Rect } from '../../kit.ts';
import type { MaterialId, RoomUse } from '../../types.ts';
import type { Fit } from '../office/common.ts';

export const P = ARCH.wall.partition / 2;
/** Track gauge (m), half a car body's width, track centre to the platform's edge. */
export const GAUGE = 1.067;
export const CAR_HALF = 1.45;
export const EDGE = 1.5;
/** Track spacing between two tracks with no platform between them. */
export const SPACING = 4.2;
/** Gap between two coupled cars. */
const COUPLE = 0.6;

// ---------------------------------------------------------------------------------------------
// Railway
// ---------------------------------------------------------------------------------------------

/** A track along x at z from x0 to x1: the ballast bed and two rails (drawn only). */
export function track(k: Kit, z: number, x0: number, x1: number): void {
  k.box(-1, x0, 0, z - 1.4, x1, 0.1, z + 1.4, 'debris', { layer: 'shell', solid: false, tint: 0.7 });
  for (const s of [-1, 1]) k.box(-1, x0, 0.1, z + (s * GAUGE) / 2 - 0.04, x1, 0.24, z + (s * GAUGE) / 2 + 0.04, 'steel', { layer: 'shell', solid: false, tint: 0.4 });
}

/** The overhead contact wire of a track (drawn only). */
export function wire(k: Kit, z: number, x0: number, x1: number, y = 5.3): void {
  k.box(-1, x0, y, z - 0.03, x1, y + 0.05, z + 0.03, 'steel', { layer: 'shell', solid: false, tint: 0.2 });
}

/** A catenary mast at (x, z) with its arm reaching across z from `a0` to `a1` at the wire's height. */
export function mast(k: Kit, x: number, z: number, a0: number, a1: number, y = 5.3): void {
  k.box(-1, x - 0.12, 0, z - 0.12, x + 0.12, y + 0.8, z + 0.12, 'steel', { layer: 'shell', tint: 0.5 });
  if (a1 - a0 > 3) k.box(-1, x - 0.05, y + 0.4, Math.min(a0, a1), x + 0.05, y + 0.55, Math.max(a0, a1), 'steel', { layer: 'shell', solid: false, tint: 0.5 });
}

export interface CarSpec {
  /** Side the platform is on (the doors that open). */
  side: 'z+' | 'z-';
  /** Doors per side. */
  doors: number;
  tint: number;
  /** A room one can walk into (its platform-side doors are open). */
  open: boolean;
  /** Cab windows at the low-x / high-x end (the ends of a train). */
  cab?: ('x-' | 'x+')[];
  /** Body colour material. */
  mat?: MaterialId;
}

/**
 * One railway car along x from x0 to x1 on the track at zc, its floor level with the platform
 * (storey 0). Returns its room (-1 for a closed car). Its seats and the bag are placed by `f`.
 */
export function car(k: Kit, f: Fit, x0: number, x1: number, zc: number, s: CarSpec): number {
  const fy = k.levelY(0);
  const tw = 0.08;
  const top = fy + 3.1;
  const mat = s.mat ?? 'steel';
  const shell = { layer: 'shell' as const };
  const sg = s.side === 'z+' ? 1 : -1;
  const [b0, b1] = [zc - CAR_HALF, zc + CAR_HALF];
  for (const end of s.cab ?? []) {
    const xe = end === 'x-' ? x0 - 0.02 : x1 - 0.03;
    k.box(-1, xe, fy + 1.0, b0 + 0.25, xe + 0.05, fy + 2.3, b1 - 0.25, 'glass', shell);
  }
  if (!s.open) {
    k.box(-1, x0, 0.3, b0, x1, top + 0.25, b1, mat, { ...shell, tint: s.tint });
    k.box(-1, x0 + 0.4, fy + 0.95, b0 - 0.02, x1 - 0.4, fy + 1.95, b1 + 0.02, 'glass', shell);
    return -1;
  }
  // Underframe (and the floor), the roof.
  k.box(-1, x0 + 0.3, 0.3, b0 + 0.1, x1 - 0.3, fy, b1 - 0.1, 'steel', { ...shell, tint: 0.95 });
  k.box(-1, x0 + 0.1, top, b0 + 0.08, x1 - 0.1, top + 0.25, b1 - 0.08, mat, { ...shell, tint: 0.3 });
  // Ends.
  k.box(-1, x0, fy - 0.15, b0, x0 + tw, top, b1, mat, { ...shell, tint: s.tint });
  k.box(-1, x1 - tw, fy - 0.15, b0, x1, top, b1, mat, { ...shell, tint: s.tint });
  const ix0 = x0 + tw;
  const ix1 = x1 - tw;
  // The far side: a panel, the windows, the band above them.
  const [f0, f1] = sg > 0 ? [b0, b0 + tw] : [b1 - tw, b1];
  k.box(-1, ix0, fy - 0.15, f0, ix1, fy + 0.95, f1, mat, { ...shell, tint: s.tint });
  k.box(-1, ix0, fy + 0.95, (f0 + f1) / 2 - 0.015, ix1, fy + 1.95, (f0 + f1) / 2 + 0.015, 'glass', { ...shell, hidden: k.rand() < 0.2 });
  k.box(-1, ix0, fy + 1.95, f0, ix1, top, f1, mat, { ...shell, tint: s.tint });
  // The platform side: the doors (open) through the panel, the windows between them, the band above.
  const [p0, p1] = sg > 0 ? [b1 - tw, b1] : [b0, b0 + tw];
  const dw = 1.3;
  const at = k.evenly(0, ix1 - ix0, s.doors);
  k.wall(0, ix0, p0, ix1, p1, at.map((a) => k.door(a, 'open', dw)), { mat, tint: s.tint, y0: fy, y1: fy + 0.95, layer: 'shell' });
  let u = ix0;
  for (const a of [...at.map((q) => ix0 + q), ix1 + dw / 2]) {
    const e = Math.min(ix1, a - dw / 2);
    if (e - u > 0.05) k.box(-1, u, fy + 0.95, (p0 + p1) / 2 - 0.015, e, fy + 1.95, (p0 + p1) / 2 + 0.015, 'glass', { ...shell, hidden: k.rand() < 0.15 });
    u = a + dw / 2;
  }
  k.box(-1, ix0, fy + 1.95, p0, ix1, top, p1, mat, { ...shell, tint: s.tint });
  const room = k.room(0, ix0, b0 + tw, ix1, b1 - tw, 'train');
  // Long seats against the far side between the doors, a bag left behind, blood now and then.
  const far: Dir = sg > 0 ? 'z-' : 'z+';
  f.row(room, far, Math.min(5, (ix1 - ix0) / (s.doors + 1)), 0.5, 0.45, 'fabric', { tint: 0.1 + 0.3 * s.tint, max: s.doors + 1, gap: 0.6 });
  f.ensure(room, 'crate', 'train');
  if (f.chance(0.3)) f.stain(room);
  return room;
}

/** A train of `n` cars of length `len` from x0 along the track at zc; returns the rooms of the open cars. */
export function train(k: Kit, f: Fit, x0: number, n: number, len: number, zc: number, s: Omit<CarSpec, 'cab' | 'open'> & { open: boolean | ((i: number) => boolean) }): number[] {
  const rooms: number[] = [];
  const isOpen = (i: number): boolean => (typeof s.open === 'function' ? s.open(i) : s.open);
  const at = (i: number): number => x0 + i * (len + COUPLE);
  for (let i = 0; i < n; ) {
    if (isOpen(i)) {
      const cab: ('x-' | 'x+')[] = [];
      if (i === 0) cab.push('x-');
      if (i === n - 1) cab.push('x+');
      rooms.push(car(k, f, at(i), at(i) + len, zc, { ...s, open: true, cab }));
      i++;
      continue;
    }
    // A run of shut cars is one body (the couplings do not show from the platform's distance).
    let j = i;
    while (j + 1 < n && !isOpen(j + 1)) j++;
    const cab: ('x-' | 'x+')[] = [];
    if (i === 0) cab.push('x-');
    if (j === n - 1) cab.push('x+');
    car(k, f, at(i), at(j) + len, zc, { ...s, open: false, cab });
    i = j + 1;
  }
  return rooms;
}

/** Length of a train of n cars. */
export function trainLength(n: number, len: number): number {
  return n * len + (n - 1) * COUPLE;
}

// ---------------------------------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------------------------------

export interface PlatformRoom {
  id: number;
  rect: Rect;
}

/**
 * A platform from x0 to x1 between z0 and z1 (its edges; the tracks' sides are `edges`), its top at
 * the storey-0 floor. Its walkable area is cut into rooms round `obstacles` (plan rectangles of the
 * stairs and columns standing on it, which must not reach across it): the part before, between and
 * after them full width, the strips beside them joined to both.
 */
export function platform(k: Kit, x0: number, x1: number, z0: number, z1: number, o: { edges: ('z-' | 'z+')[]; obstacles?: Rect[]; use?: RoomUse; tint?: number; maxLen?: number }): PlatformRoom[] {
  const fy = k.levelY(0);
  k.box(-1, x0, -0.3, z0, x1, fy, z1, 'concrete', { layer: 'shell', tint: o.tint ?? 0.3 });
  for (const e of o.edges) {
    const [a, b] = e === 'z-' ? [z0 + 0.25, z0 + 0.55] : [z1 - 0.55, z1 - 0.25];
    k.box(-1, x0 + 0.3, fy, a, x1 - 0.3, fy + 0.012, b, 'sign', { layer: 'shell', solid: false, tint: 0.95 });
  }
  return splitRooms(k, 0, [x0, z0, x1, z1], o.obstacles ?? [], o.use ?? 'platform', 'x', o.maxLen);
}

/**
 * Cover rectangle r of storey `level` with rooms round the obstacles (sorted along x, each spanning
 * part of the depth): full-depth parts between them, strips beside them, joined.
 */
export function splitRooms(k: Kit, level: number, r: Rect, obstacles: Rect[], use: RoomUse, axis: 'x' | 'z' = 'x', maxLen = 60): PlatformRoom[] {
  // Along z: the same with x and z swapped.
  const sw = (q: Rect): Rect => (axis === 'x' ? q : [q[1], q[0], q[3], q[2]]);
  const [x0, z0, x1, z1] = sw(r);
  const obs = obstacles.map(sw).map((q): Rect => [Math.max(x0, q[0]), Math.max(z0, q[1]), Math.min(x1, q[2]), Math.min(z1, q[3])]).filter((q) => q[2] > q[0] && q[3] > q[1]).sort((a, b) => a[0] - b[0]);
  const out: PlatformRoom[] = [];
  const add = (q: Rect): number => {
    const rr = sw(q);
    const id = k.room(level, rr[0], rr[1], rr[2], rr[3], use);
    out.push({ id, rect: rr });
    return id;
  };
  /** A full-depth part, in pieces of at most maxLen joined end to end (fewer ways per room); returns [first, last]. */
  const full = (a: number, b: number): [number, number] => {
    const n = Math.max(1, Math.ceil((b - a) / maxLen - 1e-6));
    let first = -1;
    let prev = -1;
    for (let i = 0; i < n; i++) {
      const id = add([a + ((b - a) * i) / n, z0, a + ((b - a) * (i + 1)) / n, z1]);
      if (prev >= 0) k.join(prev, id);
      else first = id;
      prev = id;
    }
    return [first, prev];
  };
  const span = (id: number): [number, number] => {
    const rm = k.roomById(id);
    return axis === 'x' ? [rm.z0, rm.z1] : [rm.x0, rm.x1];
  };
  const link = (a: number, b: number): void => {
    const [a0, a1] = span(a);
    const [b0, b1] = span(b);
    if (Math.min(a1, b1) - Math.max(a0, b0) >= 0.9) k.join(a, b);
  };
  // Rooms the next part is joined to: the last full-depth part, or the strips beside the last obstacle.
  let before: number[] = [];
  let cur = x0;
  for (const q of obs) {
    if (q[0] < cur - 1e-6) throw new Error(`${k.def.id}: obstacles on storey ${level} overlap at ${q[0].toFixed(2)}`);
    if (q[1] - z0 < 0.9 && z1 - q[3] < 0.9) throw new Error(`${k.def.id}: an obstacle at ${q[0].toFixed(2)} on storey ${level} cuts the floor in two`);
    let from = cur;
    if (q[0] - cur > 0.3) {
      const [a, b] = full(cur, q[0]);
      for (const p of before) link(p, a);
      before = [b];
      from = q[0];
    }
    const strips: number[] = [];
    for (const [a, b] of [[z0, q[1]], [q[3], z1]] as const) {
      if (b - a < 0.9) continue;
      const s = add([from, a, q[2], b]);
      for (const p of before) link(p, s);
      strips.push(s);
    }
    before = strips;
    cur = q[2];
  }
  if (x1 - cur > 0.3) {
    const [a] = full(cur, x1);
    for (const p of before) link(p, a);
  } else if (before.length && x1 > cur) {
    // Stretch the last strips to the end.
    for (const id of before) {
      const rm = k.roomById(id);
      const o = out.find((q) => q.id === id)!;
      if (axis === 'x') rm.x1 = o.rect[2] = x1;
      else rm.z1 = o.rect[3] = x1;
    }
  }
  return out;
}

/** The room of `rooms` that contains (x, z) (the smallest), or -1. */
export function roomAt(rooms: PlatformRoom[], x: number, z: number): number {
  let best = -1;
  let area = Infinity;
  for (const r of rooms) {
    const q = r.rect;
    if (x < q[0] || x > q[2] || z < q[1] || z > q[3]) continue;
    const a = (q[2] - q[0]) * (q[3] - q[1]);
    if (a < area) {
      area = a;
      best = r.id;
    }
  }
  return best;
}

/** A platform canopy: a roof slab on a row of thin posts (drawn only) along x at zc. */
export function canopy(k: Kit, x0: number, x1: number, z0: number, z1: number, y: number, tint = 0.5): void {
  const fy = k.levelY(0);
  k.box(-1, x0, y, z0, x1, y + 0.2, z1, 'metalRoof', { layer: 'shell', tint });
  const zc = (z0 + z1) / 2;
  const n = Math.max(1, Math.round((x1 - x0) / 30));
  for (let i = 0; i <= n; i++) {
    const x = x0 + 0.3 + ((x1 - x0 - 0.6) * i) / n;
    k.box(-1, x - 0.09, fy, zc - 0.09, x + 0.09, y, zc + 0.09, 'steel', { layer: 'shell', solid: false, tint: 0.6 });
  }
}

/** A station name board on two thin posts (drawn only), facing z. */
export function nameBoard(k: Kit, x: number, z: number, tint: number): void {
  const fy = k.levelY(0);
  for (const s of [-0.9, 0.9]) k.box(-1, x + s - 0.04, fy, z - 0.04, x + s + 0.04, fy + 1.9, z + 0.04, 'steel', { layer: 'shell', solid: false });
  k.box(-1, x - 1.1, fy + 1.3, z - 0.05, x + 1.1, fy + 2.0, z + 0.05, 'paper', { layer: 'shell', solid: false });
  k.box(-1, x - 1.1, fy + 1.25, z - 0.06, x + 1.1, fy + 1.35, z + 0.06, 'sign', { layer: 'shell', solid: false, tint });
}

/**
 * A straight stair along x climbing from storey `level` to `to`, with full-height side walls and a
 * roof: its foot at (xFoot, zc) climbing towards `dir`. Returns its plan rectangle (walls included).
 */
export function flight(k: Kit, level: number, to: number, xFoot: number, zc: number, dir: 'x+' | 'x-', o: { width?: number; walls?: boolean; tint?: number; rails?: ('left' | 'right' | 'end')[]; wallTop?: number; roof?: boolean } = {}): { rect: Rect; top: number } {
  const width = o.width ?? ARCH.stair.wideWidth;
  const st = k.stairs({ level, start: [xFoot, zc], dir, width, kind: 'straight', rails: o.rails ?? [], mat: 'concrete', tint: o.tint, to });
  const [a, b] = [st.rect[0], st.rect[2]];
  const hw = width / 2;
  const y0 = k.levelY(level);
  const y1 = k.levelY(to);
  if (o.walls !== false) {
    const top = o.wallTop ?? y1 + 2.6;
    for (const s of [-1, 1]) k.box(-1, a, y0, zc + s * hw, b, top, zc + s * (hw + 0.1), 'concrete', { layer: 'shell', tint: o.tint });
    if (o.roof !== false) k.box(-1, a, top, zc - hw - 0.1, b, top + 0.2, zc + hw + 0.1, 'metalRoof', { layer: 'shell', tint: o.tint });
  }
  return { rect: [a, zc - hw - 0.1, b, zc + hw + 0.1], top: dir === 'x-' ? a : b };
}

/** Steps of a straight flight of storey height h (count × going). */
export function flightLength(k: Kit, levels = 1): number {
  const n = Math.max(2, Math.ceil((levels * k.def.storeyHeight) / ARCH.stair.maxRise - 1e-6));
  return n * ARCH.stair.going;
}

// ---------------------------------------------------------------------------------------------
// The rest of a site
// ---------------------------------------------------------------------------------------------

/** A low wall / fence along a line from (x0, z0) to (x1, z1) (axis-aligned), `h` high, solid. */
export function fence(k: Kit, x0: number, z0: number, x1: number, z1: number, h = 1.2, mat: MaterialId = 'steel', tint = 0.5): void {
  const t = 0.06;
  if (Math.abs(z1 - z0) < 1e-6) k.box(-1, Math.min(x0, x1), 0, z0 - t, Math.max(x0, x1), h, z0 + t, mat, { layer: 'shell', tint });
  else k.box(-1, x0 - t, 0, Math.min(z0, z1), x0 + t, h, Math.max(z0, z1), mat, { layer: 'shell', tint });
}

/** Paint on the ground (lines, markings), drawn only. */
export function paint(k: Kit, x0: number, z0: number, x1: number, z1: number, tint = 0, mat: MaterialId = 'paper', y = 0.02): void {
  k.box(-1, Math.min(x0, x1), 0, Math.min(z0, z1), Math.max(x0, x1), y, Math.max(z0, z1), mat, { layer: 'shell', solid: false, tint });
}

/** A paved area (asphalt slab at the ground, walkable). */
export function pave(k: Kit, x0: number, z0: number, x1: number, z1: number, mat: MaterialId = 'asphalt', tint = 0): void {
  k.box(-1, Math.min(x0, x1), -0.2, Math.min(z0, z1), Math.max(x0, x1), 0.03, Math.max(z0, z1), mat, { layer: 'shell', tint, solid: false });
}

/** A bus (closed) centred at (cx, cz), along x or z. */
export function bus(k: Kit, cx: number, cz: number, along: 'x' | 'z', tint: number): void {
  const [hl, hw] = [5.5, 1.25];
  const [ax, az] = along === 'x' ? [hl, hw] : [hw, hl];
  k.box(-1, cx - ax, 0.3, cz - az, cx + ax, 3.1, cz + az, 'appliance', { layer: 'shell', tint, role: 'furniture' });
  k.box(-1, cx - ax + (along === 'x' ? 0.3 : -0.02), 1.4, cz - az + (along === 'z' ? 0.3 : -0.02), cx + ax - (along === 'x' ? 0.3 : -0.02), 2.4, cz + az - (along === 'z' ? 0.3 : -0.02), 'glass', { layer: 'shell', role: 'furniture' });
}

/** A shelter (roof on posts at its back corners, a bench), drawn and solid at the posts. */
export function shelter(k: Kit, x0: number, z0: number, x1: number, z1: number, back: 'z-' | 'z+', tint = 0.5): void {
  const zb = back === 'z-' ? z0 : z1 - 0.1;
  k.box(-1, x0, 0, zb, x0 + 0.1, 2.6, zb + 0.1, 'steel', { layer: 'shell', tint });
  k.box(-1, x1 - 0.1, 0, zb, x1, 2.6, zb + 0.1, 'steel', { layer: 'shell', tint });
  k.box(-1, x0, 0.9, zb, x1, 2.3, zb + 0.05, 'glass', { layer: 'shell' });
  k.box(-1, x0, 2.6, z0, x1, 2.75, z1, 'metalRoof', { layer: 'shell', tint, solid: false });
}

/**
 * An aircraft parked with its nose towards `nose` (z+ / z-), centred at (cx, cz): fuselage, wings,
 * engines, tailplane and fin. `len` is its length (span ≈ length). Solid where it is low.
 */
export function plane(k: Kit, cx: number, cz: number, len: number, nose: 'z+' | 'z-', tint: number, o: { props?: boolean; engines?: 2 | 4 } = {}): void {
  const s = nose === 'z+' ? 1 : -1;
  const r = Math.max(1.2, len * 0.055);
  const y0 = len > 30 ? 1.6 : 0.9;
  const span = len * 0.95;
  const at = (a: number): number => cz + s * a; // a: along from the middle towards the nose
  const sh = { layer: 'shell' as const };
  const zz = (a: number, b: number): [number, number] => [Math.min(at(a), at(b)), Math.max(at(a), at(b))];
  // Fuselage (a little nose cone), its window line.
  const [f0, f1] = zz(-len / 2 + 2, len / 2 - 1.5);
  k.box(-1, cx - r, y0, f0, cx + r, y0 + 2 * r, f1, 'appliance', { ...sh, tint: 0.05 });
  const [n0, n1] = zz(len / 2 - 1.5, len / 2);
  k.box(-1, cx - r * 0.7, y0 + 0.3 * r, n0, cx + r * 0.7, y0 + 1.6 * r, n1, 'appliance', { ...sh, tint: 0.05 });
  const [t0, t1] = zz(-len / 2, -len / 2 + 2);
  k.box(-1, cx - r * 0.5, y0 + r, t0, cx + r * 0.5, y0 + 2 * r, t1, 'appliance', { ...sh, tint: 0.05 });
  k.box(-1, cx - r - 0.01, y0 + 1.15 * r, f0 + 2, cx + r + 0.01, y0 + 1.35 * r, f1 - 2, 'sign', { ...sh, tint, solid: false });
  // Wings (a little behind the middle), the tailplane, the fin.
  const wy = y0 + 0.5 * r;
  const [w0, w1] = zz(-len * 0.12, len * 0.06);
  k.box(-1, cx - span / 2, wy, w0, cx + span / 2, wy + 0.35, w1, 'appliance', { ...sh, tint: 0.4 });
  const [h0, h1] = zz(-len / 2 + 0.5, -len / 2 + 3.5);
  k.box(-1, cx - span * 0.18, y0 + 1.7 * r, h0, cx + span * 0.18, y0 + 1.7 * r + 0.25, h1, 'appliance', { ...sh, tint: 0.4 });
  k.box(-1, cx - 0.2, y0 + 2 * r, h0, cx + 0.2, y0 + 2 * r + len * 0.16, h1, 'sign', { ...sh, tint });
  // Engines (or propellers) under / on the wings.
  const engines = o.engines ?? 2;
  const offs = engines === 4 ? [-0.36, -0.2, 0.2, 0.36] : [-0.28, 0.28];
  const [e0, e1] = zz(-len * 0.06, len * 0.1);
  for (const q of offs) {
    const ex = cx + q * span;
    const er = o.props ? 0.6 : Math.max(0.7, r * 0.45);
    k.box(-1, ex - er, wy - 2 * er + (o.props ? 2 * er : 0), e0, ex + er, wy + (o.props ? 2 * er : 0), e1, 'steel', { ...sh, tint: 0.7 });
  }
  // Wheels (low and solid).
  const [g0, g1] = zz(len * 0.38, len * 0.42);
  k.box(-1, cx - 0.3, 0, g0, cx + 0.3, y0, g1, 'steel', { ...sh, tint: 0.95 });
  const [m0, m1] = zz(-len * 0.1, -len * 0.04);
  k.box(-1, cx - r - 0.5, 0, m0, cx + r + 0.5, y0, m1, 'steel', { ...sh, tint: 0.95 });
}

/** Holes in a wall from door specs (helper for walls built by hand). */
export function doors(k: Kit, list: { at: number; state?: 'open' | 'locked' | 'shutter'; width?: number }[]): Hole[] {
  return list.map((d) => k.door(d.at, d.state ?? 'open', d.width ?? ARCH.door.width));
}
