// ビジネスホテル (07d-2b). Nine storeys of the same floor, one over the other: a corridor across the
// middle with the stair core at its left end (a switchback climbing along the corridor) and the dead
// lift at its right end; single rooms on both sides, all the same (door, unit bath by the corridor,
// bed and desk by the window), half of them locked. The ground floor has the lobby with the
// reception, the office and the breakfast room. The outside is a curtain of piers and spandrels with
// one window per room (facade(), a fraction of the triangles of real openings).
//
//   floors 2-9                                 ground
//   +-------+----+----+----+---+               +-------+-------------------+---+
//   | linen | rm | rm | rm |   |               | office| breakfast room    |   |
//   +--D----+-D--+-D--+-D--+---+               +--D----+--D----------------+---+
//   |stairs >  corridor     |lift|             |stairs >  corridor      |lift|
//   +--D----+-D--+-D--+-D--+---+               +-----------D---------------+---+
//   | linen | rm | rm | rm |   |               | lobby  [reception]          |
//   +-------+----+----+----+---+               +=========[auto]==============+  z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Kit } from '../../kit.ts';
import type { BuildingDef, RoomUse } from '../../types.ts';
import { coreSize, facade, LANE, P, sign } from './common.ts';

/**
 * A hotel room between x0 and x1 entered from the corridor wall at z = near, its window wall at
 * z = far: the door near x0, the unit bath beside it, the bed(s) along the x0 wall and the desk by
 * the window. Twin rooms (wide ones) get two beds side by side.
 */
export function hotelRoom(k: Kit, level: number, x0: number, x1: number, near: number, far: number, o: { twin?: boolean; locked?: boolean; use?: RoomUse; tint?: number } = {}): void {
  const s = far > near ? 1 : -1;
  const z = (a: number): number => near + s * a;
  const box = (xa: number, a0: number, xb: number, a1: number, h: number, mat: Parameters<Kit['furniture']>[6], search?: { kind: Parameters<Kit['search']>[3]; face: 'x+' | 'x-' | 'near' | 'far'; table: Parameters<Kit['search']>[4] }, tint?: number, solid?: boolean): void => {
    const face = search ? (search.face === 'near' ? (s > 0 ? 'z-' : 'z+') : search.face === 'far' ? (s > 0 ? 'z+' : 'z-') : search.face) : undefined;
    k.furniture(level, xa, Math.min(z(a0), z(a1)), xb, Math.max(z(a0), z(a1)), h, mat, { tint, solid, search: search && face ? { kind: search.kind, face, table: search.table } : undefined });
  };
  const depth = Math.abs(far - near);
  k.room(level, x0, Math.min(near, far), x1, Math.max(near, far), o.use ?? 'bedroom', { locked: o.locked });
  if (o.locked) return;
  // Unit bath: a closed box by the corridor wall on the far side from the door.
  box(x1 - 1.5, 0, x1, 1.7, 2.3, 'plaster', undefined, 0.95);
  if (o.twin) {
    const m = depth / 2 + 0.4;
    box(x0, m - 1.3, x0 + 2.0, m - 0.3, 0.5, 'fabric', { kind: 'bed', face: 'x+', table: 'bedroom' }, o.tint);
    box(x0, m + 0.3, x0 + 2.0, m + 1.3, 0.5, 'fabric', undefined, o.tint);
    box(x1 - 0.55, depth - 1.8, x1, depth - 0.3, 0.75, 'wood', { kind: 'desk', face: 'x-', table: 'bedroom' }, 0.6);
    box(x0 + 0.4, depth - 0.9, x0 + 1.4, depth - 0.3, 0.4, 'fabric', undefined, 0.2, false); // sofa by the window
  } else {
    box(x0, depth - 2.1, x0 + 1.0, depth - 0.1, 0.5, 'fabric', { kind: 'bed', face: 'x+', table: 'bedroom' }, o.tint);
    box(x1 - 0.5, depth - 1.6, x1, depth - 0.3, 0.75, 'wood', { kind: 'desk', face: 'x-', table: 'bedroom' }, 0.6);
  }
  if (k.rand() < 0.15) {
    const [za, zb] = [z(depth - 1.4), z(depth - 0.6)];
    k.stain(level, x0 + 1.1, Math.min(za, zb), x0 + 2.0, Math.max(za, zb));
  }
}

export const SHOP_HOTEL_BIZ: BuildingDef = {
  id: 'shop.hotel_biz',
  category: 'shop',
  variant: 'hotel_biz',
  kind: 'office',
  size: { w: [15, 19], d: [13, 16] },
  storeys: 9,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 3.4,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_HOTEL_BIZ, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const { cw, depth } = coreSize(k);
    const zc0 = Math.round(((d - cw) / 2) * 10) / 10; // corridor band (the core's width)
    const zc1 = zc0 + cw;
    const xcor = t + depth; // the corridor starts at the top of the core
    const xA = xcor + 1.3; // first column (linen) | rooms
    const n = Math.max(2, Math.floor((w - t - xA) / 2.8));
    const cols: [number, number][] = [[t, xA - P]];
    for (let i = 0; i < n; i++) cols.push([xA + ((w - t - xA) * i) / n + P, xA + ((w - t - xA) * (i + 1)) / n - (i === n - 1 ? 0 : P)]);
    const xsh = cols[n]![0] + 1.3; // corridor | lift shaft (centre line), clear of the last room's door
    const stone = k.rand();
    const colour = k.rand();
    const top = k.storeys - 1;
    const doorAt = (c: number): number => (c === 0 ? cols[0]![1] - 0.7 : cols[c]![0] + 0.7);

    for (let level = 0; level < k.storeys; level++) {
      const ground = level === 0;
      k.floor(level, ground ? 'tileFloor' : 'carpet', undefined, { tint: ground ? stone : colour });
      // Stairs: along the corridor band, climbing towards the left wall and back.
      if (level < top) k.stairs({ level, start: [xcor, zc0 + LANE / 2], dir: 'x-', width: LANE, kind: 'switchback', turn: 'left', mat: 'concrete', tint: stone });
      else k.box(level, xcor - ARCH.rail.thick, k.levelY(level), zc0, xcor, k.levelY(level) + ARCH.rail.height, zc0 + LANE, 'steel', { role: 'furniture' });
      // Corridor, the lift shaft's door (the shaft itself is cut once below).
      k.room(level, xcor, zc0 + P, xsh - P, zc1 - P, ground ? 'lobby' : 'hall');
      k.partition(level, xsh, zc0 + P, xsh, zc1 - P, [{ ...k.door(cw / 2 - P, 'locked', 1.0), leaf: 'doorSteel' }], { mat: 'concrete' });
      const backDoors = ground ? [doorAt(0), (xA + xsh) / 2] : cols.map((_, c) => doorAt(c));
      const frontDoors = ground ? [(xcor + xsh) / 2] : cols.map((_, c) => doorAt(c));
      k.partition(level, t, zc0, w - t, zc0, backDoors.map((x) => k.door(x - t, 'open', ground && x !== doorAt(0) ? 1.6 : 0.9)), { mat: 'concrete' });
      k.partition(level, t, zc1, w - t, zc1, frontDoors.map((x) => k.door(x - t, 'open', ground ? ARCH.door.wide : 0.9)), { mat: 'concrete' });
      if (ground) {
        // Back: the office behind the reception, the breakfast room.
        k.partition(0, xA, t, xA, zc0 - P);
        k.room(0, t, t, xA - P, zc0 - P, 'office');
        k.room(0, xA + P, t, w - t, zc0 - P, 'canteen');
        k.furniture(0, t, t + 0.4, t + 0.6, zc0 - P - 1.6, 1.8, 'steel', { tint: 0.6, search: { kind: 'locker', face: 'x+', table: 'office' } });
        k.furniture(0, t + 1.4, t, t + 2.8, t + 0.7, 0.75, 'wood', { tint: 0.5, search: { kind: 'desk', face: 'z+', table: 'office' } });
        k.furniture(0, w - t - 3.6, t, w - t, t + 0.7, 0.9, 'counter', { tint: colour, search: { kind: 'counter', face: 'z+', table: 'canteen' } }); // buffet
        for (let x = xA + 1.0; x + 1.2 < w - t - 0.6; x += 2.4) k.furniture(0, x, t + 1.8, x + 1.2, t + 2.6, 0.72, 'wood', { tint: 0.5 });
        k.stain(0, xA + 1.2, zc0 - 1.4, xA + 2.6, zc0 - 0.6, 'debris');
        // Front: the lobby with the reception counter and a few chairs.
        k.room(0, t, zc1 + P, w - t, d - t, 'lobby');
        k.furniture(0, t + 0.6, zc1 + P + 0.9, t + 3.6, zc1 + P + 1.5, 1.05, 'counter', { tint: colour, search: { kind: 'counter', face: 'z+', table: 'office' } });
        for (let x = w - t - 4.2; x < w - t - 0.8; x += 1.3) k.furniture(0, x, d - t - 1.6, x + 0.8, d - t - 0.8, 0.45, 'fabric', { tint: colour });
        k.stain(0, (w - 1) / 2, zc1 + 1.4, (w + 1.4) / 2, zc1 + 2.3);
      } else {
        // Guest floors: the same rooms on both sides, the linen rooms at the left.
        cols.forEach(([x0, x1], c) => {
          if (c > 0) {
            k.partition(level, x0 - P, t, x0 - P, zc0 - P);
            k.partition(level, x0 - P, zc1 + P, x0 - P, d - t);
          }
          for (const [near, far] of [[zc0 - P, t], [zc1 + P, d - t]] as const) {
            if (c === 0) {
              k.room(level, x0, Math.min(near, far), x1, Math.max(near, far), 'storage');
              const zs = far > near ? far - 0.5 : far;
              k.furniture(level, x0, zs, x1 - 1.4, zs + 0.5, 2.0, 'shelf', { tint: 0.9, search: { kind: 'shelf', face: far > near ? 'z-' : 'z+', table: 'closet' } });
            } else hotelRoom(k, level, x0, x1, near, far, { locked: k.rand() < 0.5, tint: colour });
          }
        });
      }
    }
    k.shaft([xsh + P, zc0 + P, w - t, zc1 - P], 0, top);

    // --- outside ---
    const doorX = (xcor + xsh) / 2;
    k.outerWalls(0, {
      mat: 'concrete', tint: stone,
      front: [k.window((0.4 + doorX - 1.1) / 2, doorX - 1.1 - 0.4 - 0.2, { sill: 0.3, head: 2.8 }), { ...k.door(doorX, 'open', ARCH.door.wide), head: 2.4 }, k.window((doorX + 1.1 + w - 0.4) / 2, w - 0.4 - doorX - 1.1 - 0.2, { sill: 0.3, head: 2.8, broken: k.rand() < 0.4 })],
      back: [k.window((xA + w - t) / 2, w - t - xA - 1.2, { sill: 0.9, head: 2.4 }), k.window((t + xA) / 2, 1.0, { sill: 1.2 })],
      left: [k.window((zc1 + d) / 2, 1.6)],
      right: [k.window((t + zc0) / 2, 1.6), k.window((zc1 + d) / 2, 1.6)],
    });
    const centres = cols.map(([x0, x1]) => (x0 + x1) / 2);
    const pane = { mat: 'concrete' as const, tint: stone, win: 1.1, sill: 0.8, head: 2.3, parapet: 1.1 };
    facade(k, 'front', 1, centres, { ...pane, broken: k.rand() < 0.6 ? [Math.floor(k.rand() * centres.length)] : [] });
    facade(k, 'back', 1, centres, pane);
    facade(k, 'left', 1, [(t + zc0) / 2, (zc1 + d - t) / 2], pane);
    facade(k, 'right', 1, [(t + zc0) / 2, (zc1 + d - t) / 2], pane);
    k.roofFlat({ mat: 'concrete', tint: stone });
    // Lift machine room over the shaft, the hotel's name on the roof, a canopy over the door.
    const e = k.eaves;
    k.box(-1, xsh - 0.3, e, zc0 - 0.4, w - t, e + 2.6, zc1 + 0.4, 'concrete', { layer: 'shell', tint: stone });
    k.box(-1, 1.0, e + 1.1, d - 0.9, w - 2.4, e + 3.3, d - 0.75, 'sign', { layer: 'shell', tint: colour });
    for (const x of [1.4, w - 2.8]) k.box(-1, x, e, d - 0.9, x + 0.15, e + 1.1, d - 0.75, 'steel', { layer: 'shell' });
    sign(k, doorX - 2.0, doorX + 2.0, k.levelY(0) + 2.6, k.levelY(0) + 2.9, colour, { z: d - t, depth: 0.6 + t, mat: 'concrete' });
    return k.finish();
  },
};
