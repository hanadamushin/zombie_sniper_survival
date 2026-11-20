// One flat (住戸) inside an apartment block (07d-2a): the rooms, the partitions between them and
// the furniture, written once in the flat's own frame and turned to fit wherever the block puts it.
// The block builds the wall the flat is entered from (with the door at `door`) and its outer walls
// (windows at `rooms`), so the same flat serves outer corridors, inner corridors and stair halls.
//
// Flat frame: u runs along the entry wall, v goes in from it (u ∈ [0, U], v ∈ [0, V], inside faces).
//
//   v = V  +------------+------------+     far wall (windows)
//          | room 1     | room 2     |     two rooms when U >= 5.7, else one
//          |            |            |
//   v = 2.3+--D---------+------D-----+
//          | bath D  kitchen   [cntr]|
//   v = 0  +------[door]-------------+     entry wall: door at u = 2.4
//          u = 0                     u = U

import type { Dir, Kit } from '../../kit.ts';
import { P } from '../house/common.ts';

export interface UnitSpec {
  level: number;
  /** Inside corner (local x, z) at u = 0, v = 0, and the directions u and v run in. */
  origin: [number, number];
  eu: Dir;
  ev: Dir;
  U: number;
  V: number;
  locked?: boolean;
  tatami?: boolean;
}

export interface UnitPlan {
  /** Centre of the entry door on the entry wall's inside face (local x, z). */
  door: [number, number];
  /** Centres of the rooms on the far wall's inside face. */
  rooms: [number, number][];
  /** Centre of the far wall (for one wide window). */
  far: [number, number];
}

const VEC: Record<Dir, [number, number]> = { 'x+': [1, 0], 'x-': [-1, 0], 'z+': [0, 1], 'z-': [0, -1] };
const STRIP = 2.3;
const BATH = 1.7;
export const UNIT_DOOR = 2.4;
/** Narrowest flat that takes two rooms. */
export const UNIT_TWO_ROOMS = 5.7;

function dirOf(x: number, z: number): Dir {
  if (Math.abs(x) > Math.abs(z)) return x > 0 ? 'x+' : 'x-';
  return z > 0 ? 'z+' : 'z-';
}

export function unit(k: Kit, s: UnitSpec): UnitPlan {
  const [ux, uz] = VEC[s.eu];
  const [vx, vz] = VEC[s.ev];
  const L = s.level;
  const at = (u: number, v: number): [number, number] => [s.origin[0] + ux * u + vx * v, s.origin[1] + uz * u + vz * v];
  const rect = (u0: number, v0: number, u1: number, v1: number): [number, number, number, number] => {
    const a = at(u0, v0);
    const b = at(u1, v1);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  };
  const face = (du: number, dv: number): Dir => dirOf(ux * du + vx * dv, uz * du + vz * dv);
  const { U, V } = s;
  const two = U >= UNIT_TWO_ROOMS;
  const um = U / 2;
  const plan: UnitPlan = {
    door: at(UNIT_DOOR, 0),
    rooms: two ? [at(um / 2, V), at((um + U) / 2, V)] : [at(U / 2, V)],
    far: at(U / 2, V),
  };
  if (s.locked) {
    const r = rect(0, 0, U, V);
    k.room(L, r[0], r[1], r[2], r[3], 'bedroom', { locked: true });
    return plan;
  }
  /** A partition from (u0, v0) to (u1, v1) with doors at the given points along it. */
  const wall = (u0: number, v0: number, u1: number, v1: number, doors: { u: number; v: number; width?: number }[]): void => {
    const a = at(u0, v0);
    const b = at(u1, v1);
    const alongX = Math.abs(a[1] - b[1]) < 1e-6;
    const lo = alongX ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]);
    // kit.partition wants its ends in increasing order.
    k.partition(L, Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), doors.map((d) => {
      const p = at(d.u, d.v);
      return k.door((alongX ? p[0] : p[1]) - lo, 'open', d.width ?? 0.9);
    }));
  };
  const room = (u0: number, v0: number, u1: number, v1: number, use: Parameters<Kit['room']>[5]): void => {
    const r = rect(u0, v0, u1, v1);
    k.room(L, r[0], r[1], r[2], r[3], use);
  };
  const box = (u0: number, v0: number, u1: number, v1: number, h: number, mat: Parameters<Kit['furniture']>[6], search?: { kind: Parameters<Kit['search']>[3]; du: number; dv: number; table?: Parameters<Kit['search']>[4] }, tint?: number): void => {
    const r = rect(u0, v0, u1, v1);
    k.furniture(L, r[0], r[1], r[2], r[3], h, mat, { tint, search: search ? { kind: search.kind, face: face(search.du, search.dv), table: search.table } : undefined });
  };
  const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

  // Partitions: bath | kitchen, kitchen strip | rooms, room | room.
  wall(BATH, 0, BATH, STRIP, [{ u: BATH, v: STRIP / 2, width: 0.8 }]);
  const kLo = BATH + P + 0.5;
  const kHi = U - 1.35;
  const doors = two
    ? [{ u: clamp(um / 2, kLo + 0.3, um - P - 0.5), v: STRIP }, { u: clamp((um + U) / 2, um + P + 0.5, kHi), v: STRIP }]
    : [{ u: clamp(U / 2, kLo + 0.3, kHi), v: STRIP }];
  wall(0, STRIP, U, STRIP, doors);
  if (two) wall(um, STRIP, um, V, []);
  room(0, 0, BATH - P, STRIP - P, 'bath');
  room(BATH + P, 0, U, STRIP - P, 'kitchen');
  const r1 = two ? um - P : U;
  room(0, STRIP + P, r1, V, s.tatami ? 'tatami' : 'bedroom');
  if (two) room(um + P, STRIP + P, U, V, 'bedroom');

  // Furniture: tub, washbasin (search), kitchen counter at the far end of the strip.
  box(0, 0, 0.7, STRIP - P, 0.55, 'tileFloor');
  k.search(L, ...at(1.15, 0.45), 'cabinet', 'bath');
  box(U - 0.6, 0.25, U, STRIP - P - 0.25, 0.9, 'counter', { kind: 'cabinet', du: -1, dv: 0, table: 'kitchen' });
  if (k.rand() < 0.5) {
    const [x0, z0, x1, z1] = rect(BATH + 1.0, 0.4, BATH + 2.2, 1.6);
    k.stain(L, x0, z0, x1, z1);
  }
  // Rooms: a bed against the outer side, a wardrobe or a desk by the partition.
  box(0, V - 2.0, 1.0, V, 0.45, 'fabric', { kind: 'bed', du: 1, dv: 0, table: 'bedroom' }, k.rand());
  if (two) {
    box(um - P - 0.6, V - 1.4, um - P, V, 1.8, 'wood', { kind: 'closet', du: -1, dv: 0, table: 'closet' }, k.rand());
    box(U - 1.0, V - 2.0, U, V, 0.45, 'fabric', { kind: 'bed', du: -1, dv: 0, table: 'bedroom' }, k.rand());
    box(um + P, V - 0.55, um + 1.0, V, 0.75, 'wood', { kind: 'desk', du: 0, dv: -1, table: 'bedroom' }, 0.8);
  } else {
    box(U - 0.6, V - 1.4, U, V, 1.8, 'wood', { kind: 'closet', du: -1, dv: 0, table: 'closet' }, k.rand());
  }
  if (s.tatami) {
    const r = rect(0, STRIP + P, r1, V);
    k.stain(L, r[0], r[1], r[2], r[3], 'tatami');
  }
  return plan;
}
