// リゾートホテル (07d-2b). Low and long: three storeys under a tiled hip roof, a corridor along the
// back with a stair core at each end, the rooms all facing the garden in front (twin rooms behind a
// glass front and a long balcony). The ground floor has the shop, the lobby (entrance under a
// canopy), the restaurant (its own door to the terrace), the kitchen and the stores. In the
// garden: the pool, deck chairs and palms.
//
//   +--------------------------------------------------------+
//   |stair>            corridor (back windows)          <stair|
//   +-D----+--D---+---D-----------+---D----------+--D--+---D-+
//   |office| shop |    lobby      |  restaurant  |kitch|store|   upper floors: twin rooms
//   +------+------+=====[door]====+=====D========+-----+-----+   z = D (balconies above)
//     palms        [   pool   ]   deck chairs                   z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef, RoomUse } from '../../types.ts';
import { pitched, ring, tree } from '../house/common.ts';
import { coreSize, facade, LANE, P, sign } from './common.ts';
import { hotelRoom } from './hotel_biz.ts';

export const SHOP_HOTEL_RESORT: BuildingDef = {
  id: 'shop.hotel_resort',
  category: 'shop',
  variant: 'hotel_resort',
  kind: 'apartment',
  size: { w: [36, 44], d: [18, 22] },
  storeys: 3,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.3,
  roof: 'hip',
  roofRise: 3.2,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_HOTEL_RESORT, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const D = 10.5; // depth of the building; the garden in front
    const { cw, depth } = coreSize(k);
    const zc = t + cw; // corridor | rooms
    const xl = t + depth; // left core | corridor
    const xr = w - t - depth; // corridor | right core
    const xA = xl + 1.3;
    const xB = xr - 1.3;
    const n = Math.max(4, Math.floor((xB - xA) / 4.0));
    const cols: [number, number][] = [[t, xA - P]];
    for (let i = 0; i < n; i++) cols.push([xA + ((xB - xA) * i) / n + P, xA + ((xB - xA) * (i + 1)) / n - P]);
    cols.push([xB + P, w - t]);
    const last = cols.length - 1;
    const doorAt = (c: number): number => (c === 0 ? cols[0]![1] - 0.7 : c === last ? cols[c]![0] + 0.7 : (cols[c]![0] + cols[c]![1]) / 2 - 1.0);
    const wall = k.rand();
    const colour = k.rand();
    const top = k.storeys - 1;
    // Ground floor: what each column (or run of columns) is.
    const lobby: [number, number] = [Math.floor(n / 2), Math.floor(n / 2) + 1];
    const ground: { c0: number; c1: number; use: RoomUse }[] = [
      { c0: 0, c1: 0, use: 'office' },
      { c0: 1, c1: lobby[0] - 1, use: 'sales' },
      { c0: lobby[0], c1: lobby[0], use: 'lobby' },
      { c0: lobby[1], c1: n - 1, use: 'canteen' },
      { c0: n, c1: n, use: 'kitchen' },
      { c0: last, c1: last, use: 'storage' },
    ];

    for (let level = 0; level < k.storeys; level++) {
      k.floor(level, level === 0 ? 'tileFloor' : 'carpet', [t, t, w - t, D - t], { tint: level === 0 ? wall : colour });
      if (level < top) {
        k.stairs({ level, start: [xl, t + LANE / 2], dir: 'x-', width: LANE, kind: 'switchback', turn: 'left', mat: 'concrete', tint: wall });
        k.stairs({ level, start: [xr, t + LANE / 2], dir: 'x+', width: LANE, kind: 'switchback', turn: 'right', mat: 'concrete', tint: wall });
      } else {
        const y = k.levelY(level);
        k.box(level, xl - ARCH.rail.thick, y, t, xl, y + ARCH.rail.height, t + LANE, 'steel', { role: 'furniture' });
        k.box(level, xr, y, t, xr + ARCH.rail.thick, y + ARCH.rail.height, t + LANE, 'steel', { role: 'furniture' });
      }
      k.room(level, xl, t, xr, zc - P, 'hall');
      if (level === 0) {
        const doors = ground.map((g) => (g.use === 'lobby' || g.use === 'canteen' ? { x: (cols[g.c0]![0] + cols[g.c1]![1]) / 2, wd: g.use === 'lobby' ? ARCH.door.wide : 1.2 } : { x: g.c0 === last ? doorAt(last) : g.c0 === 0 ? doorAt(0) : cols[g.c0]![0] + 0.9, wd: 0.9 }));
        k.partition(0, t, zc, w - t, zc, doors.map((q) => k.door(q.x - t, 'open', q.wd)), { mat: 'concrete' });
        ground.forEach((g, i) => {
          const x0 = cols[g.c0]![0];
          const x1 = cols[g.c1]![1];
          if (i > 0) k.partition(0, x0 - P, zc + P, x0 - P, D - t);
          k.room(0, x0, zc + P, x1, D - t, g.use);
          const keep = zc + P + 1.5;
          switch (g.use) {
            case 'office':
              k.furniture(0, x0, D - t - 0.7, x0 + 1.6, D - t, 0.75, 'wood', { tint: 0.5, search: { kind: 'desk', face: 'z-', table: 'office' } });
              k.furniture(0, x0, keep, x0 + 0.5, D - t - 1.4, 1.8, 'steel', { tint: 0.6, search: { kind: 'locker', face: 'x+', table: 'office' } });
              break;
            case 'sales':
              for (let x = x0 + 1.8; x + 0.8 < x1 - 0.6; x += 2.2) k.furniture(0, x, keep, x + 0.8, D - t - 1.4, 1.4, 'shelf', { tint: colour, search: x === x0 + 1.8 ? { kind: 'shelf', face: 'x-', table: 'grocery' } : undefined });
              break;
            case 'lobby':
              k.furniture(0, x0 + 0.6, keep, x0 + 1.2, D - t - 1.6, 1.05, 'counter', { tint: colour, search: { kind: 'counter', face: 'x+', table: 'office' } });
              for (let z = keep; z + 0.8 < D - t - 1.2; z += 1.6) k.furniture(0, x1 - 1.2, z, x1 - 0.3, z + 0.8, 0.45, 'fabric', { tint: colour });
              break;
            case 'canteen': {
              const doorX = (x0 + x1) / 2;
              for (let x = x0 + 0.8; x + 1.0 < x1 - 0.6; x += 2.4) {
                if (Math.abs(x + 0.5 - doorX) < 1.5) continue;
                k.furniture(0, x, keep + 0.4, x + 1.0, keep + 1.4, 0.72, 'wood', { tint: 0.5, search: x < x0 + 4 ? { kind: 'table', face: 'z-', table: 'canteen' } : undefined });
                if (keep + 3.4 < D - t - 0.8) k.furniture(0, x, keep + 2.6, x + 1.0, keep + 3.4, 0.72, 'wood', { tint: 0.5 });
              }
              break;
            }
            case 'kitchen':
              k.furniture(0, x0 + 2.0, D - t - 0.7, x1, D - t, 0.9, 'steel', { tint: 0.8, search: { kind: 'cabinet', face: 'z-', table: 'kitchen' } });
              k.furniture(0, x1 - 0.8, keep, x1, D - t - 1.9, 2.0, 'appliance', { search: { kind: 'fridge', face: 'x-', table: 'grocery' } });
              break;
            default:
              k.furniture(0, x1 - 0.6, keep, x1, D - t - 0.3, 2.0, 'shelf', { search: { kind: 'shelf', face: 'x-', table: 'storage' } });
          }
        });
        k.stain(0, cols[lobby[0]]![0] + 2.0, zc + 1.6, cols[lobby[0]]![0] + 3.2, zc + 2.6);
      } else {
        k.partition(level, t, zc, w - t, zc, cols.map((_, c) => k.door(doorAt(c) - t)), { mat: 'concrete' });
        cols.forEach(([x0, x1], c) => {
          if (c > 0) k.partition(level, x0 - P, zc + P, x0 - P, D - t);
          if (c === 0 || c === last) {
            k.room(level, x0, zc + P, x1, D - t, 'storage');
            k.furniture(level, c === 0 ? x0 : x1 - 0.5, zc + 1.6, c === 0 ? x0 + 0.5 : x1, D - t - 0.4, 2.0, 'shelf', { tint: 0.9, search: { kind: 'shelf', face: c === 0 ? 'x+' : 'x-', table: 'closet' } });
          } else hotelRoom(k, level, x0, x1, zc + P, D - t, { twin: true, locked: k.rand() < 0.45, tint: colour });
        });
      }
    }

    // --- outside ---
    const lx0 = cols[lobby[0]]![0];
    const lx1 = cols[lobby[0]]![1];
    const rx = (cols[lobby[1]]![0] + cols[n - 1]![1]) / 2;
    const glass = (a: number, b: number): ReturnType<typeof k.window> => k.window((a + b) / 2, b - a, { sill: 0.4, head: 2.7, broken: k.rand() < 0.3 });
    ring(k, 0, [0, 0, w, D], {
      mat: 'plaster', tint: wall,
      front: [
        glass(cols[1]![0] + 0.3, cols[lobby[0] - 1]![1] - 0.3),
        glass(lx0 + 0.3, (lx0 + lx1) / 2 - 1.1),
        k.door((lx0 + lx1) / 2, 'open', ARCH.door.wide),
        glass((lx0 + lx1) / 2 + 1.1, lx1 - 0.3),
        glass(cols[lobby[1]]![0] + 0.3, rx - 0.7),
        k.door(rx, 'open', 1.0),
        glass(rx + 0.7, cols[n - 1]![1] - 0.3),
      ],
      back: [...k.evenly(xl + 1.0, xr - 1.0, Math.max(3, Math.floor((xr - xl) / 6))).map((x) => k.window(x, 1.4, { sill: 1.0 })), k.door(cols[last]![0] + 2.0, 'locked')],
      left: [k.window((zc + D) / 2, 1.2)],
      right: [k.window((zc + D) / 2, 1.2)],
    });
    const centres = cols.map(([a, b]) => (a + b) / 2);
    facade(k, 'front', 1, centres.slice(1, -1), { mat: 'plaster', tint: wall, rect: [0, 0, w, D], win: (xB - xA) / n - 0.9, sill: 0.1, head: 2.6, broken: k.rand() < 0.5 ? [1] : [] });
    facade(k, 'back', 1, k.evenly(xl + 1.0, xr - 1.0, Math.max(3, Math.floor((xr - xl) / 6))), { mat: 'plaster', tint: wall, rect: [0, 0, w, D], win: 1.4, sill: 1.0, head: 2.4 });
    facade(k, 'left', 1, [(zc + D) / 2], { mat: 'plaster', tint: wall, rect: [0, 0, w, D], win: 1.2, sill: 0.9, head: 2.2 });
    facade(k, 'right', 1, [(zc + D) / 2], { mat: 'plaster', tint: wall, rect: [0, 0, w, D], win: 1.2, sill: 0.9, head: 2.2 });
    // Balconies along the front of the upper floors.
    for (let level = 1; level < k.storeys; level++) {
      const y = k.levelY(level);
      k.box(-1, xA, y - 0.25, D, xB, y, D + 1.3, 'concrete', { layer: 'shell', tint: wall });
      k.box(-1, xA, y, D + 1.25, xB, y + 1.0, D + 1.3, 'glass', { layer: 'shell' });
    }
    pitched(k, [0, 0, w, D], { mat: 'tile', tint: k.rand(), hip: true, axis: 'x' });
    // Entrance canopy and the hotel's name.
    k.box(-1, lx0 + 0.5, k.levelY(0) + 2.8, D, lx1 - 0.5, k.levelY(0) + 3.05, D + 2.6, 'concrete', { layer: 'shell', tint: wall, solid: false });
    for (const x of [lx0 + 0.6, lx1 - 0.85]) k.box(-1, x, -0.3, D + 2.3, x + 0.25, k.levelY(0) + 2.8, D + 2.55, 'concrete', { layer: 'shell', tint: wall });
    sign(k, lx0 + 0.6, lx1 - 0.6, k.levelY(0) + 3.05, k.levelY(0) + 3.5, colour, { z: D + 2.45 });

    // --- garden: the pool, deck chairs, palms ---
    const px0 = w * 0.35;
    const px1 = Math.min(w * 0.75, px0 + 14);
    const pz0 = D + 3.2;
    const pz1 = d - 1.6;
    k.box(-1, px0 - 1.5, -0.3, pz0 - 1.0, px1 + 1.5, 0.03, pz1 + 1.0, 'tileFloor', { layer: 'shell', tint: 0.9, solid: false });
    k.box(-1, px0, -0.3, pz0, px1, 0.45, pz0 + 0.25, 'concrete', { layer: 'shell', tint: 0.95 });
    k.box(-1, px0, -0.3, pz1 - 0.25, px1, 0.45, pz1, 'concrete', { layer: 'shell', tint: 0.95 });
    k.box(-1, px0, -0.3, pz0 + 0.25, px0 + 0.25, 0.45, pz1 - 0.25, 'concrete', { layer: 'shell', tint: 0.95 });
    k.box(-1, px1 - 0.25, -0.3, pz0 + 0.25, px1, 0.45, pz1 - 0.25, 'concrete', { layer: 'shell', tint: 0.95 });
    k.box(-1, px0 + 0.25, 0.2, pz0 + 0.25, px1 - 0.25, 0.3, pz1 - 0.25, 'glass', { layer: 'shell', tint: 0.4, solid: false });
    k.box(-1, px0 + 2, 0.3, pz0 + 1.0, px0 + 4, 0.32, pz0 + 2.2, 'debris', { layer: 'shell', solid: false }); // leaves on the water
    for (let x = px0; x + 0.7 < px1; x += 1.6) k.box(-1, x, 0, pz0 - 0.95, x + 0.7, 0.4, pz0 - 0.2 - (k.rand() < 0.3 ? 0.5 : 0), 'fabric', { layer: 'shell', tint: colour, solid: false });
    for (const [x, z] of [[2.5, d - 2.5], [px0 - 3.0, d - 3.0], [px1 + 3.0, D + 3.0], [w - 2.5, d - 2.5]] as const) tree(k, x, z, 2.2);
    return k.finish();
  },
};
