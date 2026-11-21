// Pieces of the Self-Defense Force garrisons and bases (07d-2f): the fence and the main gate, the HQ
// (its commander's safe holds the area's key, its armory opens with it), barracks, motor pools,
// earth-covered ammunition depots (locked, opened by the key), the canteen and the gym, the training
// ground. Built from the public helpers (wing / hall, public/common.ts) and the camp pieces
// (military/parts.ts). Local frame as in the kit: x across the front, z towards the front (z = d).

import { ARCH } from '../../../../data/architecture.ts';
import type { Dir, Kit, Rect, SearchSpec } from '../../kit.ts';
import type { BuildingDef, MaterialId } from '../../types.ts';
import { canteen, twoPass, type Fit } from '../office/common.ts';
import { hall, mesh, wing, zone, type Bay, type Fit as RoomFit } from '../public/common.ts';
import { pave, paint } from '../transport/common.ts';
import { apc, barrier, DARK, flagPole, jeep, keyDoors, mtruck, OD, tank } from '../military/parts.ts';

/** A rectangle of storey `level` whose locked doors open with the area's key (military/parts.ts keyDoors). */
export type KeyRect = [number, Rect];

// ---------------------------------------------------------------------------------------------
// Furnishers for wing rooms (public-style: they fill the part of the room clear of the corridor)
// ---------------------------------------------------------------------------------------------

function put(k: Kit, level: number, r: Rect, h: number, mat: MaterialId, tint: number, search?: SearchSpec): void {
  if (r[2] - r[0] < 0.2 || r[3] - r[1] < 0.2) return;
  k.furniture(level, r[0], r[1], r[2], r[3], h, mat, { tint, search });
}

/** The commander's office: the desk, and the safe (the area's key) in the far corner. */
export const commander: RoomFit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx);
  const [x0, , x1] = r;
  if (z[3] - z[1] < 3 || x1 - x0 < 3) return;
  const far = face === 'z+' ? z[1] : z[3];
  const sg = face === 'z+' ? 1 : -1;
  const a = (u: number, v: number): [number, number] => [Math.min(far + sg * u, far + sg * v), Math.max(far + sg * u, far + sg * v)];
  const [s0, s1] = a(0, 0.65);
  put(k, level, [x1 - 1.0, s0, x1 - 0.2, s1], 1.2, 'steel', 0.9, { kind: 'cabinet', face, table: 'safe' });
  const cx = (x0 + x1) / 2 - 0.4;
  const [d0, d1] = a(1.5, 2.3);
  put(k, level, [cx - 0.9, d0, cx + 0.9, d1], 0.75, 'woodDark', 0.5, { kind: 'desk', face, table: 'command' });
  put(k, level, [x0 + 0.2, s0, x0 + 1.6, s1], 1.9, 'wood', 0.3);
  k.box(level, x0 + 0.02, k.levelY(level) + 1.2, (z[1] + z[3]) / 2 - 0.6, x0 + 0.05, k.levelY(level) + 2.0, (z[1] + z[3]) / 2 + 0.6, 'sign', { tint: 0, solid: false }); // the flag
};

/** 隊員の居室: bunks against the far wall, lockers on the side wall. */
export const bunks: RoomFit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx);
  const [x0, , x1] = r;
  if (z[3] - z[1] < 2.6 || x1 - x0 < 2.4) return;
  const far = face === 'z+' ? z[1] : z[3];
  const sg = face === 'z+' ? 1 : -1;
  const [b0, b1] = [Math.min(far, far + sg * 2.0), Math.max(far, far + sg * 2.0)];
  // The bunks stand side by side along the far wall: one block (the first one searched).
  put(k, level, [x0 + 0.25, b0, x0 + 1.15, b1], 1.55, 'steel', 0.3, { kind: 'bed', face, table: 'barracks' });
  if (x1 - 0.8 - (x0 + 1.4) > 0.9) put(k, level, [x0 + 1.4, b0, x1 - 0.8, b1], 1.55, 'steel', 0.3);
  const [l0, l1] = face === 'z+' ? [b1 + 0.3, z[3] - 0.2] : [z[1] + 0.2, b0 - 0.3];
  if (l1 - l0 > 0.6) put(k, level, [x1 - 0.5, l0, x1, l1], 1.8, 'steel', 0.7, { kind: 'locker', face: 'x-', table: 'barracks' });
  if (k.rand() < 0.2) k.stain(level, x0 + 0.4, l0, x0 + 1.4, l0 + 0.8);
};

/** Offices of the HQ: desks in a row, a cabinet. */
export const desks: RoomFit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx);
  const [x0, , x1] = r;
  if (z[3] - z[1] < 2 || x1 - x0 < 3) return;
  const far = face === 'z+' ? z[1] : z[3];
  const sg = face === 'z+' ? 1 : -1;
  const [c0, c1] = [Math.min(far, far + sg * 0.45), Math.max(far, far + sg * 0.45)];
  put(k, level, [x0 + 0.3, c0, Math.min(x1 - 0.3, x0 + 2.4), c1], 1.8, 'steel', 0.7, { kind: 'cabinet', face, table: 'office' });
  const [d0, d1] = [Math.min(far + sg * 1.4, far + sg * 2.2), Math.max(far + sg * 1.4, far + sg * 2.2)];
  put(k, level, [x0 + 0.6, d0, x0 + 2.0, d1], 0.72, 'steel', 0.55, { kind: 'desk', face, table: 'command' });
  if (x1 - 0.6 - (x0 + 2.2) > 1.4) put(k, level, [x0 + 2.2, d0, x1 - 0.6, d1], 0.72, 'steel', 0.55);
};

/** Shelves of arms and ammunition boxes in a locked room (nobody walks there until the key is found). */
function armoryShelves(k: Kit, level: number, r: Rect, corr: 'z+' | 'z-'): void {
  const [x0, z0, x1, z1] = r;
  const face: Dir = corr;
  const [a, b] = corr === 'z+' ? [z0, z0 + 0.6] : [z1 - 0.6, z1];
  k.furniture(level, x0 + 0.2, a, x1 - 0.2, b, 1.9, 'steel', { tint: 0.4, search: { kind: 'shelf', face, table: 'weapons' } });
  const [c, e] = corr === 'z+' ? [z0 + 1.4, z1 - 1.2] : [z0 + 1.2, z1 - 1.4];
  if (e - c > 0.8 && x1 - x0 > 2) k.furniture(level, x0 + 0.2, c, x0 + 0.8, e, 1.0, 'olive', { tint: OD, search: { kind: 'crate', face: 'x+', table: 'armory' } });
}

// ---------------------------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------------------------

export interface WingOpts {
  tint: number;
  /** Rooms of each storey and side, before scaling to the wing's length. */
  bays: (level: number, side: 'z-' | 'z+') => Bay[];
  roofAccess?: boolean;
  mat?: 'concrete' | 'plaster' | 'mortar';
}

/** A wing (corridor in the middle) whose ground front has the entrance; returns the key rects of its armories. */
function sdfWing(k: Kit, r: Rect, levels: number, o: WingOpts): KeyRect[] {
  const res = wing(k, {
    rect: r, levels, corridor: 'mid', cw: 2.2,
    left: { rooms: ['toilet', 'storage'] }, right: { rooms: ['toilet', 'storage'] }, roofAccess: o.roofAccess ? 'right' : undefined,
    mat: o.mat ?? 'concrete', tint: o.tint, pierMat: 'plaster', bays: o.bays, roof: 'flat', broken: 0.25,
  });
  const keys: KeyRect[] = [];
  for (const room of res.rooms) {
    if (room.bay.use !== 'armory' || !room.bay.locked) continue;
    armoryShelves(k, room.level, room.rect, room.side === 'z-' ? 'z+' : 'z-');
    keys.push([room.level, room.rect]);
  }
  return keys;
}

/** 本部庁舎: lobby and offices below, the commander's office (the safe) and the operations room above, the armory (locked). */
export function hq(k: Kit, r: Rect, levels: number, tint: number): KeyRect[] {
  return sdfWing(k, r, levels, {
    tint, roofAccess: true,
    bays: (level, side) => {
      if (level === 0) return side === 'z+'
        ? [{ use: 'office', len: 6, fit: desks }, { use: 'lobby', len: 6, open: true, outer: { width: ARCH.door.wide } }, { use: 'office', len: 6, fit: desks }]
        : [{ use: 'storage', len: 4 }, { use: 'armory', len: 5, locked: true, blind: true }, { use: 'office', len: 6, fit: desks }, { use: 'clinic', len: 5 }];
      if (level === 1) return side === 'z+'
        ? [{ use: 'command', len: 7, fit: commander }, { use: 'office', len: 6, fit: desks }, { use: 'office', len: 5, fit: desks }]
        : [{ use: 'command', len: 8, fit: desks }, { use: 'classroom', len: 6 }, { use: 'storage', len: 4 }];
      return side === 'z+'
        ? [{ use: 'office', len: 6, fit: desks }, { use: 'office', len: 6, fit: desks }, { use: 'office', len: 6, fit: desks }]
        : [{ use: 'classroom', len: 7 }, { use: 'office', len: 6, fit: desks }, { use: 'storage', len: 5 }];
    },
  });
}

/** 隊舎: rooms of bunks off the corridor, the entrance hall, washrooms; a canteen on the ground floor if asked. */
export function barracks(k: Kit, r: Rect, levels: number, tint: number, o: { canteen?: boolean; armory?: boolean } = {}): KeyRect[] {
  const room = (): Bay => ({ use: 'barracks', len: 6.5, fit: bunks });
  return sdfWing(k, r, levels, {
    tint, roofAccess: true, mat: 'plaster',
    bays: (level, side) => {
      if (level === 0 && side === 'z+') return [room(), { use: 'lobby', len: 5, open: true, outer: { width: ARCH.door.wide } }, o.canteen ? { use: 'canteen', len: 13 } : room(), room()];
      if (level === 0) return [room(), o.armory ? { use: 'armory', len: 4, locked: true, blind: true } : { use: 'bath', len: 4 }, room(), room()];
      return [room(), room(), { use: 'bath', len: 4 }, room(), room()];
    },
  });
}

/** A block nobody can get into (doors locked): plain walls with a band of dark windows per storey. */
export function lockedBlock(k: Kit, r: Rect, levels: number, tint: number): void {
  const [x0, z0, x1, z1] = r;
  const t = 0.25;
  const top = k.levelY(levels) + 0.8;
  const m = (x0 + x1) / 2;
  k.wall(0, x0, z1 - t, x1, z1, [k.door(m - x0, 'locked', ARCH.door.wide)], { mat: 'plaster', tint, y1: top, exterior: true, layer: 'shell' });
  k.box(-1, x0, -ARCH.foundation, z0, x1, top, z0 + t, 'plaster', { layer: 'shell', tint });
  k.box(-1, x0, -ARCH.foundation, z0 + t, x0 + t, top, z1 - t, 'plaster', { layer: 'shell', tint });
  k.box(-1, x1 - t, -ARCH.foundation, z0 + t, x1, top, z1 - t, 'plaster', { layer: 'shell', tint });
  k.box(-1, x0 + t, top - 0.25, z0 + t, x1 - t, top, z1 - t, 'concrete', { layer: 'shell', tint });
  for (let l = 0; l < levels; l++) {
    const y = k.levelY(l);
    for (const [za, zb] of [[z1, z1 + 0.03], [z0 - 0.03, z0]] as const) {
      if (l === 0 && za === z1) {
        k.box(-1, x0 + 1, y + 0.9, za, m - 2, y + 2.2, zb, 'glass', { layer: 'shell', solid: false });
        k.box(-1, m + 2, y + 0.9, za, x1 - 1, y + 2.2, zb, 'glass', { layer: 'shell', solid: false });
      } else k.box(-1, x0 + 1, y + 0.9, za, x1 - 1, y + 2.2, zb, 'glass', { layer: 'shell', solid: false });
    }
  }
}

/** 車両整備場: a tall shed with shutters on the front (some open), trucks at the back, tools along the walls. */
export function motorPool(k: Kit, f: Fit, r: Rect, tint: number, o: { tanks?: boolean } = {}): number {
  const [x0, , x1] = r;
  const bays = Math.max(2, Math.floor((x1 - x0 - 6) / 7));
  const doors = [];
  let open = false;
  for (let i = 0; i < bays; i++) {
    const st = k.rand() < 0.45 || (!open && i === bays - 1) ? 'open' as const : 'shutter' as const;
    if (st === 'open') open = true;
    doors.push({ side: 'z+' as const, at: x0 + 6 + (i + 0.5) * ((x1 - x0 - 6) / bays), width: 4.5, head: 4.5, state: st });
  }
  doors.push({ side: 'z+' as const, at: x0 + 2.5, width: ARCH.door.width, head: 2.0, state: 'open' as const });
  const h = hall(k, {
    rect: r, levels: 2, mat: 'siding', tint, use: 'garage', floorMat: 'tileFloor', doors,
    high: { sides: ['z-', 'x-', 'x+'], n: 4, width: 9 }, roof: 'gable', roofMat: 'metalRoof', roofTint: k.rand(), rise: 2.2, axis: 'x', broken: 0.4,
  });
  const [ix0, iz0, ix1] = h.inner;
  const n = Math.floor((ix1 - ix0 - 4) / 7);
  for (let i = 0; i < n; i++) {
    const cx = ix0 + 5 + i * 7;
    if (k.rand() < 0.25) continue;
    if (o.tanks && i % 2 === 0) tank(k, cx, iz0 + 5, 'z', { dir: 1 });
    else if (k.rand() < 0.3) apc(k, cx, iz0 + 4.5, 'z', { dir: 1 });
    else mtruck(k, cx, iz0 + 4.5, 'z', { dir: 1, open: k.rand() < 0.5 });
  }
  f.row(h.id, 'x-', 2.0, 0.7, 2.0, 'shelf', { kind: 'shelf', table: 'tools', max: 2, to: iz0 + 9, tint: 0.5 });
  f.row(h.id, 'x+', 2.0, 0.8, 0.9, 'counter', { kind: 'counter', table: 'garage', max: 2, to: iz0 + 9, tint: 0.3 });
  f.ensure(h.id, 'crate', 'fuel');
  if (f.chance(0.6)) f.stain(h.id, 'debris', 3);
  return h.id;
}

/** 食堂: tables, the serving counter, the kitchen shelves. */
export function messHall(k: Kit, f: Fit, r: Rect, tint: number): void {
  const [x0, , x1] = r;
  const h = hall(k, {
    rect: r, levels: 1, mat: 'plaster', tint, use: 'canteen', floorMat: 'tileFloor',
    doors: [{ side: 'z+', at: (x0 + x1) / 2, width: ARCH.door.wide }, { side: 'z-', at: x1 - 3 }],
    low: { sides: ['z+', 'x-', 'x+'], n: 4, width: 6 }, roof: 'flat', broken: 0.3,
  });
  canteen(f, h.id, { counter: true, max: 10 });
  f.ensure(h.id, 'crate', 'grocery');
}

/** 体育館: one tall hall, mats and boxes. */
export function gym(k: Kit, f: Fit, r: Rect, tint: number): void {
  const [x0, , x1] = r;
  const h = hall(k, {
    rect: r, levels: 2, mat: 'siding', tint, use: 'hall', floorMat: 'flooring',
    doors: [{ side: 'z+', at: (x0 + x1) / 2, width: ARCH.door.wide }, { side: 'z-', at: x0 + 3 }],
    high: { sides: ['x-', 'x+', 'z+', 'z-'], n: 5, width: 9 }, roof: 'gable', roofMat: 'metalRoof', roofTint: k.rand(), rise: 2, broken: 0.3,
  });
  f.row(h.id, 'z-', 2.0, 1.0, 0.5, 'fabric', { kind: 'crate', table: 'storage', max: 2, tint: 0.2 });
  f.ensure(h.id, 'crate', 'storage');
  if (f.chance(0.5)) f.stain(h.id, 'blood', 2);
}

/**
 * 弾薬庫: an earth-covered concrete magazine with a steel door on its front (z+), locked — the
 * area's key opens it. Shelves of arms and boxes of ammunition inside. Returns its key rect.
 */
export function depot(k: Kit, r: Rect): KeyRect {
  const [x0, z0, x1, z1] = r;
  const t = 0.4;
  const top = k.levelY(1) - 0.3;
  const m = (x1 - x0) / 2;
  const door = { ...k.door(m, 'locked', ARCH.door.wide), leaf: 'doorSteel' as const };
  const wo = { mat: 'concrete' as const, tint: 0.6, y1: top, exterior: true, layer: 'shell' as const };
  k.wall(0, x0, z1 - t, x1, z1, [door], wo);
  k.wall(0, x0, z0, x1, z0 + t, [], wo);
  k.wall(0, x0, z0 + t, x0 + t, z1 - t, [], wo);
  k.wall(0, x1 - t, z0 + t, x1, z1 - t, [], wo);
  const inner: Rect = [x0 + t, z0 + t, x1 - t, z1 - t];
  k.floor(0, 'concrete', inner);
  k.box(-1, x0, top, z0, x1, top + 0.3, z1, 'concrete', { layer: 'shell', tint: 0.6 });
  // The earth over it (drawn only), the lightning rod, the warning board.
  k.part({ shape: 'gable', x0: x0 - 0.3, x1: x1 + 0.3, z0: z0 - 0.3, z1: z1 - 0.6, y0: top + 0.3, y1: top + 2.2, mat: 'olive', tint: DARK, axis: 'z', solid: false });
  k.box(-1, x0 + 0.3, 0, z0 + 0.3, x0 + 0.45, top + 5, z0 + 0.45, 'steel', { layer: 'shell', tint: 0.5 });
  k.box(-1, x0 + m + 1.2, 1.4, z1, x0 + m + 2.4, 2.2, z1 + 0.03, 'sign', { layer: 'shell', tint: 0.6, solid: false });
  const id = k.room(0, inner[0], inner[1], inner[2], inner[3], 'armory', { locked: true });
  armoryShelves(k, 0, inner, 'z+');
  void id;
  return [0, r];
}

/** 衛兵所 at the gate: a small hut with its door to the road (side `door`) and a window. */
export function guardHut(k: Kit, f: Fit, r: Rect, door: 'x-' | 'x+', tint: number): void {
  const [, z0, , z1] = r;
  const h = hall(k, {
    rect: r, levels: 1, mat: 'concrete', tint, use: 'command', floorMat: 'vinyl',
    doors: [{ side: door, at: (z0 + z1) / 2 }],
    low: { sides: ['z+', door === 'x-' ? 'x+' : 'x-'], n: 1, width: 1.4 }, roof: 'flat', parapet: 0.3, broken: 0.5,
  });
  f.row(h.id, 'z+', 1.4, 0.6, 0.75, 'steel', { kind: 'desk', table: 'command', max: 1, tint: 0.3 });
  f.ensure(h.id, 'locker', 'field');
}

/**
 * The main gate in the front fence at x = gx: the road in, two pillars with the name board, the
 * barrier, the guard hut on its right. Returns the gap in the fence.
 */
export function mainGate(k: Kit, f: Fit, gx: number, roadTo: number, tint: number): [number, number] {
  const { d } = k;
  pave(k, gx - 4, roadTo, gx + 4, d);
  paint(k, gx - 0.08, roadTo, gx + 0.08, d, 0, 'paper', 0.05);
  for (const sx of [-1, 1]) k.box(-1, gx + sx * 5 - 0.5, 0, d - 1.5, gx + sx * 5 + 0.5, 2.6, d - 0.5, 'concrete', { layer: 'shell', tint: 0.8 });
  k.box(-1, gx - 7.5, 1.0, d - 0.48, gx - 5.5, 2.4, d - 0.45, 'wood', { layer: 'shell', tint: 0.9, solid: false });
  barrier(k, gx - 4, gx + 3.5, d - 6, k.rand() < 0.5);
  guardHut(k, f, [gx + 6, d - 9, gx + 11, d - 3.5], 'x-', tint);
  return [gx - 4.5, gx + 4.5];
}

/** The fence round the site (just inside its edges), gaps in the front fence. */
export function perimeter(k: Kit, gaps: [number, number][], o: { back?: boolean } = {}): void {
  const { w, d } = k;
  const e = 0.6;
  mesh(k, e, d - e, w - e, d - e, gaps, 2.2);
  if (o.back !== false) mesh(k, e, e, w - e, e, [], 2.2);
  mesh(k, e, e, e, d - e, [], 2.2);
  mesh(k, w - e, e, w - e, d - e, [], 2.2);
}

/** 訓練場: the course (low walls, the climbing wall, a balance beam), lines on the ground. */
export function training(k: Kit, r: Rect): void {
  const [x0, z0, x1, z1] = r;
  paint(k, x0, z0, x1, z0 + 0.15, 0, 'paper', 0.04);
  paint(k, x0, z1 - 0.15, x1, z1, 0, 'paper', 0.04);
  paint(k, x0, z0, x0 + 0.15, z1, 0, 'paper', 0.04);
  paint(k, x1 - 0.15, z0, x1, z1, 0, 'paper', 0.04);
  const zc = (z0 + z1) / 2;
  for (let x = x0 + 6; x < x1 - 6; x += 9) {
    const i = Math.round((x - x0) / 9) % 3;
    if (i === 0) k.box(-1, x, -0.2, zc - 2, x + 0.3, 1.0, zc + 2, 'concrete', { layer: 'shell', tint: 0.5 });
    else if (i === 1) k.box(-1, x, -0.2, zc - 1.5, x + 0.4, 2.6, zc + 1.5, 'wood', { layer: 'shell', tint: 0.4 });
    else k.box(-1, x, 0.8, zc - 0.1, x + 6, 0.95, zc + 0.1, 'wood', { layer: 'shell', tint: 0.4, solid: false });
  }
}

/** 射撃場: a berm at the back (z0 side) and the targets in front of it. */
export function rifleRange(k: Kit, r: Rect): void {
  const [x0, z0, x1, z1] = r;
  k.part({ shape: 'gable', x0, x1, z0, z1: z0 + 6, y0: 0, y1: 4, mat: 'olive', tint: DARK, axis: 'x' });
  for (let x = x0 + 3; x < x1 - 3; x += 5) k.box(-1, x, 0, z0 + 7, x + 1.2, 1.8, z0 + 7.05, 'paper', { layer: 'shell', tint: 0 });
  for (let x = x0 + 3; x < x1 - 3; x += 5) paint(k, x - 1, z1 - 3, x + 2, z1 - 1, 0.5, 'olive', 0.04);
}

/** A parked row of vehicles along x from x0 (spacing `step`), fronts towards +z. */
export function vehicleRow(k: Kit, x0: number, z: number, n: number, step: number, kinds: ('truck' | 'jeep' | 'apc' | 'tank')[]): void {
  for (let i = 0; i < n; i++) {
    if (k.rand() < 0.2) continue;
    const kind = kinds[Math.floor(k.rand() * kinds.length)]!;
    const burnt = k.rand() < 0.15;
    const x = x0 + i * step;
    if (kind === 'truck') mtruck(k, x, z, 'z', { burnt });
    else if (kind === 'jeep') jeep(k, x, z, 'z', { burnt });
    else if (kind === 'apc') apc(k, x, z, 'z', { burnt });
    else tank(k, x, z, 'z', { burnt });
  }
}

/** The parade ground in front of the HQ with the flag pole. */
export function parade(k: Kit, r: Rect, flag: [number, number]): void {
  pave(k, r[0], r[1], r[2], r[3], 'asphalt', 0);
  flagPole(k, flag[0], flag[1], 12);
}


// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

/**
 * A base type: one flat site (storeys 1 at RC height, the buildings rise past it within
 * `roofRise`), built in two passes (furniture by Fit), its key doors marked at the end.
 */
export function sdfDef(variant: string, o: { size: BuildingDef['size']; roofRise: number; limits?: BuildingDef['limits'] }, build: (k: Kit, f: Fit) => KeyRect[]): BuildingDef {
  const def: BuildingDef = {
    id: `base.${variant}`, category: 'base', variant, kind: 'office', size: o.size, storeys: 1, storeyHeight: ARCH.storey.concrete, plinth: 0.2,
    roof: 'flat', roofRise: o.roofRise, lootable: true, ...(o.limits ? { limits: o.limits } : {}),
    generate(rng, params) {
      let keys: KeyRect[] = [];
      const bp = twoPass(def, rng, params, (k, f) => {
        keys = build(k, f);
      });
      return keyDoors(bp, keys);
    },
  };
  return def;
}
