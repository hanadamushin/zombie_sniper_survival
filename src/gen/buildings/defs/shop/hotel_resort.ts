// リゾートホテル (07d-2b): long and low — three storeys under one big hipped roof, every room facing
// the garden at the back with its own balcony, a corridor along the street side and a switchback
// stair at each end. The middle of the ground floor is the lobby (glass doors front and back, out to
// the terrace), with the front desk (office behind a low counter) and the gift shop on one side,
// the restaurant (garden windows) and its kitchen on the other.
//
//   ground (back = garden at the top)
//   balcony / terrace  ...............................................................
//   +-----+------+------+------+---D---+------+------+------+------+-----+
//   |linen| room | shop |office|  lobby        restaurant   |kitchen|room |linen|
//   |stair|      |      |  g   |               |            D       |     |stair|
//   +  =  +--D---+--D---+------+               +--------D---+---D---+--D--+  =  +
//   |        corridor          J      lobby    J        corridor               |
//   +==========================+----[door]-----+================================+

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { clearOfWays, facade, guestRoom, P, sign, table } from './common.ts';

const B = 1.6; // balcony depth at the back
const LANE = ARCH.stair.wideWidth;
const CORE = 2.7; // stair column width

export const SHOP_HOTEL_RESORT: BuildingDef = {
  id: 'shop.hotel_resort',
  category: 'shop',
  variant: 'hotel_resort',
  kind: 'apartment',
  size: { w: [40, 50], d: [13.5, 15.5] },
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
    const wall = k.rand();
    const accent = k.rand();
    const zb = B + t; // inside face of the back wall
    const zc0 = d - t - 1.8; // rooms | corridor
    const n = Math.ceil(k.def.storeyHeight / 2 / ARCH.stair.maxRise - 1e-6);
    const zs0 = zc0 - (n * ARCH.stair.going + ARCH.stair.landing); // back of the stairwells
    const xa = t + CORE;
    const xb = w - t - CORE;
    const m = Math.max(7, Math.floor((xb - xa) / 4.0));
    const U = (xb - xa) / m;
    const edges = Array.from({ length: m + 1 }, (_, i) => xa + i * U);
    const c = Math.floor(m / 2) - 1; // the lobby takes modules c and c + 1
    const xl0 = edges[c]!;
    const xl1 = edges[c + 2]!;
    const xk = edges[c + 4]!; // restaurant | kitchen
    const xk1 = edges[c + 5]!;
    const top = k.storeys - 1;
    const y1 = k.levelY(1);
    const e = k.eaves;

    // ---- Outside.
    const piers = [0.2, ...edges, w - 0.2];
    const segs: [number, number][] = [[0, xl0], [xl1, w]];
    for (const [u0, u1] of segs) {
      facade(k, { axis: 'x', u0, u1, t0: B, t1: zb, from: 0, to: k.storeys, y0: -ARCH.foundation, y1: e, piers, pier: 0.35, sill: 0.15, head: 2.4, mat: 'plaster', tint: wall, broken: 0.06 });
      facade(k, { axis: 'x', u0, u1, t0: d - t, t1: d, from: 0, to: 1, y0: -ARCH.foundation, y1, piers: piers.filter((_, i) => i % 2 === 0), pier: 0.35, sill: 1.0, head: 2.3, mat: 'plaster', tint: wall });
    }
    facade(k, { axis: 'x', u0: xl0, u1: xl1, t0: B, t1: zb, from: 1, to: k.storeys, y0: y1, y1: e, piers, pier: 0.35, sill: 0.15, head: 2.4, mat: 'plaster', tint: wall });
    facade(k, { axis: 'x', u0: 0, u1: w, t0: d - t, t1: d, from: 1, to: k.storeys, y0: y1, y1: e, piers: piers.filter((_, i) => i % 2 === 0), pier: 0.35, sill: 1.0, head: 2.3, mat: 'plaster', tint: wall });
    const ext = { mat: 'plaster' as const, tint: wall, exterior: true, layer: 'shell' as const, y1 };
    const lw = xl1 - xl0;
    k.wall(0, xl0, B, xl1, zb, [k.window(lw * 0.2, lw * 0.3, { sill: 0.1, head: 2.6 }), k.door(lw / 2, 'open', ARCH.door.wide), k.window(lw * 0.8, lw * 0.3, { sill: 0.1, head: 2.6, broken: k.rand() < 0.5 })], ext);
    k.wall(0, xl0, d - t, xl1, d, [k.window(lw * 0.2, lw * 0.3, { sill: 0.3, head: 2.6 }), k.door(lw / 2, 'open', ARCH.door.wide), k.window(lw * 0.8, lw * 0.3, { sill: 0.3, head: 2.6 })], ext);
    for (const x of [0, w - t]) k.box(-1, x, -ARCH.foundation, B, x + t, e, d, 'plaster', { layer: 'shell', tint: wall });
    k.roofHip({ mat: 'tile', tint: k.rand(), axis: 'x' });
    // Balconies (slab, rail, dividers) and the garden terrace.
    for (let level = 1; level < k.storeys; level++) {
      const y = k.levelY(level);
      k.box(-1, 0.3, y - 0.2, 0.1, w - 0.3, y, B, 'concrete', { layer: 'shell', tint: wall });
      k.box(-1, 0.3, y, 0.1, w - 0.3, y + 1.0, 0.16, 'steel', { layer: 'shell', tint: 0.3 });
    }
    for (const x of edges) k.box(-1, x - 0.05, y1 - 0.2, 0.1, x + 0.05, e, B, 'plaster', { layer: 'shell', tint: wall });
    k.box(-1, 0.3, -0.3, 0, w - 0.3, 0.12, B, 'wood', { layer: 'shell', tint: 0.4 });
    // The porch roof over the front doors and the name on it.
    k.box(-1, (xl0 + xl1) / 2 - 3.0, y1 - 0.6, d, (xl0 + xl1) / 2 + 3.0, y1 - 0.4, d + 0.6, 'concrete', { layer: 'shell', tint: wall, solid: false });
    sign(k, (xl0 + xl1) / 2 - 2.5, y1 - 0.4, d + 0.4, (xl0 + xl1) / 2 + 2.5, y1 + 0.3, d + 0.55, accent);

    // ---- Every storey: the two stairs, the corridor, the rooms.
    for (let level = 0; level < k.storeys; level++) {
      k.floor(level, level === 0 ? 'tileFloor' : 'carpet', [t, zb, w - t, d - t]);
      const to = level + 1;
      if (level < top) {
        k.stairs({ level, start: [t + 0.05 + LANE / 2, zc0], dir: 'z-', width: LANE, kind: 'switchback', turn: 'right', mat: 'concrete', tint: wall, to });
        k.stairs({ level, start: [w - t - 0.05 - LANE / 2, zc0], dir: 'z-', width: LANE, kind: 'switchback', turn: 'left', mat: 'concrete', tint: wall, to });
      }
      for (const [x0, x1, xw] of [[t, xa - P, xa], [xb + P, w - t, xb]] as const) {
        k.partition(level, xw, zb, xw, zc0 - P);
        k.partition(level, x0, zs0, x1, zs0);
        k.room(level, x0, zb, x1, zs0 - P, 'storage', { locked: true });
      }
      if (level === top) {
        // No stair goes on up: rails round the top of each stairwell.
        // (Only across the first flight's lane: the second one is the way up.)
        for (const [x0, x1] of [[t + 0.05, t + 0.05 + LANE], [w - t - 0.05 - LANE, w - t - 0.05]] as const) k.box(level, x0, k.levelY(level), zc0 - 0.06, x1, k.levelY(level) + ARCH.rail.height, zc0, 'steel', { role: 'furniture' });
      }
      const ground = level === 0;
      const doors: ReturnType<typeof k.door>[] = [];
      const corridor: number[] = [];
      if (ground) {
        corridor.push(k.room(0, t, zc0 + P, xl0 - P, d - t, 'hall'), k.room(0, xl1 + P, zc0 + P, w - t, d - t, 'hall'));
      } else corridor.push(k.room(level, t, zc0 + P, w - t, d - t, 'hall'));
      for (let i = 0; i < m; i++) {
        const x0 = edges[i]!;
        const x1 = edges[i + 1]!;
        if (i > 0 && !(ground && i >= c && i <= c + 4)) k.partition(level, x0, zb, x0, zc0 - P);
        if (ground && i >= c - 1 && i <= c + 4) continue; // office, lobby, restaurant, kitchen: below
        const at = i % 2 === 0 ? x0 + 0.8 : x1 - 0.8;
        const r: [number, number, number, number] = [x0 + P, zb, x1 - P, zc0 - P];
        if (ground && i === c - 2) {
          // Gift shop: shelves along both side walls.
          k.room(0, r[0], r[1], r[2], r[3], 'sales');
          k.furniture(0, r[0], r[1] + 0.6, r[0] + 0.5, r[3] - 1.6, 1.6, 'shelf', { tint: accent, search: { kind: 'shelf', face: 'x+', table: 'grocery' } });
          k.furniture(0, r[2] - 0.5, r[1] + 0.6, r[2], r[3] - 1.6, 1.6, 'shelf', { tint: accent, search: { kind: 'shelf', face: 'x-', table: 'sales' } });
          doors.push(k.door((x0 + x1) / 2, 'open', 1.2));
          continue;
        }
        const locked = k.rand() < 0.5 && !(i === 0 && level === top);
        guestRoom(k, level, r, 'z+', at, { locked, twin: k.rand() < 0.6, tint: accent });
        doors.push(k.door(at, locked ? 'locked' : 'open'));
      }
      if (ground) {
        // Lobby, front desk (office behind a low counter), restaurant and kitchen.
        const L = k.room(0, xl0 + P, zb, xl1 - P, d - t, 'lobby');
        k.join(corridor[0]!, L);
        k.join(L, corridor[1]!);
        const xo0 = edges[c - 1]!;
        k.partition(0, xl0, zb, xl0, zc0 - P, [k.door(zc0 - 1.0 - zb)], { mat: 'counter', tint: accent, y1: k.levelY(0) + 1.1 });
        k.room(0, xo0 + P, zb, xl0 - P, zc0 - P, 'office');
        k.furniture(0, xo0 + P, zb + 0.3, xo0 + 0.6, zc0 - 1.0, 1.8, 'steel', { tint: 0.7, search: { kind: 'cabinet', face: 'x+', table: 'office' } });
        k.furniture(0, xo0 + 1.4, zb, xl0 - 1.2, zb + 0.75, 0.72, 'wood', { tint: 0.5, search: { kind: 'desk', face: 'z+', table: 'office' } });
        const lways: [number, number][] = [[xl0 + P + 0.5, (zc0 + d - t) / 2], [xl1 - P - 0.5, (zc0 + d - t) / 2], [(xl0 + xl1) / 2, d - t - 0.65], [(xl0 + xl1) / 2, zb + 0.65], [xl0 + 0.61, zc0 - 1.0], [xl1 - 0.61, (zb + zc0) / 2]];
        for (const [cx, cz] of [[xl0 + 1.8, zb + 2.6], [xl1 - 1.8, zb + 2.6], [xl0 + 1.8, zc0 - 3.2], [xl1 - 1.8, zc0 - 3.2]] as const) {
          if (!clearOfWays(lways, [cx - 1.2, cz - 0.9, cx + 1.2, cz + 0.9], 0.35)) continue;
          k.furniture(0, cx - 0.8, cz - 0.35, cx + 0.8, cz + 0.35, 0.42, 'wood', { tint: 0.3 });
          k.furniture(0, cx - 1.1, cz + 0.5, cx + 1.1, cz + 0.9, 0.8, 'fabric', { tint: accent });
        }
        k.search(0, xl0 + 0.75, zb + 1.2, 'counter', 'lobby');
        k.stain(0, (xl0 + xl1) / 2 - 1.0, d - t - 1.6, (xl0 + xl1) / 2 + 1.0, d - t - 0.5, 'debris');
        // Restaurant (two modules) with the garden windows; doors to the lobby, the corridor and the kitchen.
        k.partition(0, xl1, zb, xl1, zc0 - P, [k.door((zc0 - zb) / 2, 'open', ARCH.door.wide)]);
        k.partition(0, xk, zb, xk, zc0 - P, [k.door(1.4)]);
        k.room(0, xl1 + P, zb, xk - P, zc0 - P, 'canteen');
        const rdoor = xk - 1.0;
        doors.push(k.door(rdoor));
        const rways: [number, number][] = [[xl1 + 0.61, (zb + zc0) / 2], [rdoor, zc0 - 0.61], [xk - 0.61, zb + 1.4]];
        let first = true;
        for (let x = xl1 + 1.6; x + 0.6 < xk - 0.4; x += 2.2) {
          for (let z = zb + 1.3; z + 0.5 < zc0 - 0.5; z += 2.1) {
            if (!clearOfWays(rways, [x - 0.7, z - 0.85, x + 0.7, z + 0.85], 0.35)) continue;
            table(k, 0, x, z, 1.0, 0.8, { chairs: ['z+', 'z-'], tint: 0.6 });
            if (first) k.search(0, x + 0.8, z, 'table', 'canteen');
            first = false;
          }
        }
        k.room(0, xk + P, zb, xk1 - P, zc0 - P, 'kitchen');
        doors.push(k.door(xk1 - 0.8));
        k.furniture(0, xk1 - P - 0.75, zb + 0.4, xk1 - P, zc0 - 2.6, 0.9, 'steel', { tint: 0.5, search: { kind: 'counter', face: 'x-', table: 'kitchen' } });
        k.furniture(0, xk + P, zc0 - 1.6, xk + 0.85, zc0 - 0.8, 1.9, 'appliance', { search: { kind: 'fridge', face: 'x+', table: 'kitchen' } });
        k.furniture(0, xk + P + 1.1, zb, xk1 - 1.2, zb + 0.5, 1.9, 'shelf', { search: { kind: 'shelf', face: 'z+', table: 'grocery' } });
        k.partition(0, xa, zc0, xl0, zc0, doors.filter((h) => h.at < xl0).map((h) => ({ ...h, at: h.at - xa })));
        k.partition(0, xl1, zc0, xb, zc0, doors.filter((h) => h.at > xl1).map((h) => ({ ...h, at: h.at - xl1 })));
      } else {
        k.partition(level, xa, zc0, xb, zc0, doors.map((h) => ({ ...h, at: h.at - xa })));
        if (k.rand() < 0.5) {
          const sx = xa + k.rand() * (xb - xa - 2);
          k.stain(level, sx, zc0 + 0.3, sx + 1.6, d - t - 0.3);
        }
      }
    }
    return k.finish();
  },
};
