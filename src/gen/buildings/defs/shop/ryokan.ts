// 温泉旅館 (07d-2b): two storeys under a big tiled hipped roof. Downstairs a corridor runs across the
// whole house behind the front rooms: the entrance (genkan with shoe lockers, the front desk behind a
// low counter), the banquet hall (大広間), the souvenir shop; behind the corridor the kitchen, the
// stair, the toilets and the two big baths — each a changing room with lockers and the tiled bath
// with its big tub. Upstairs the same corridor with tatami guest rooms either side.
//
//   ground                                                     upper
//   +---------+-----+----+-----------+-----------+             +------+--+--+------+------+------+
//   | kitchen |linen| WC |  男湯 bath | 女湯 bath  |             | room |st|WC| room | room | room |
//   |    [Dx] |stair|    +--D--------+--D--------+             |      |ai|  |      |      |      |
//   |         |     |    | changing  | changing  |             +--D---+  +-D+--D---+--D---+--D---+
//   +---D-----+  =  +--D-+-----D-----+-----D-----+             |          corridor              |
//   |                    corridor                |             +--D----+--D----+--D----+--D----+
//   +----D-------+------J------+--g----+----D----+             | room  | room  | room  | room  |
//   | 大広間      |   genkan    | desk  |  shop   |             |       |       |       |       |
//   +------------+---[door]----+-------+---------+             +-------+-------+-------+-------+

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { guestRoom, P, sign, table } from './common.ts';

const LANE = ARCH.stair.wideWidth;

export const SHOP_RYOKAN: BuildingDef = {
  id: 'shop.ryokan',
  category: 'shop',
  variant: 'ryokan',
  kind: 'house',
  size: { w: [26, 32], d: [18, 21] },
  storeys: 2,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.3,
  roof: 'hip',
  roofRise: 3.4,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_RYOKAN, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const y0 = k.levelY(0);
    const wood = k.rand();
    const zf = d - t - 6.0; // corridor | front rooms
    const zc0 = zf - 1.8; // back rooms | corridor
    const n = Math.ceil(k.def.storeyHeight / 2 / ARCH.stair.maxRise - 1e-6);
    const zs0 = zc0 - (n * ARCH.stair.going + ARCH.stair.landing);
    const x1 = t + 6.0; // kitchen | stair column
    const x2 = x1 + 2.7; // stair column | toilets
    const x3 = x2 + 2.2; // toilets | baths
    const x4 = (x3 + w - t) / 2; // men's | women's bath
    const xg0 = w / 2 - 2.5; // genkan
    const xg1 = w / 2 + 2.5;
    const xo = xg1 + 3.0; // front desk | shop
    const zd = zc0 - 3.0; // changing room | bath

    // ---- Outside.
    const frontMods = Math.max(5, Math.floor((w - 2 * t) / 4.2));
    const FU = (w - 2 * t) / frontMods;
    const fronts = Array.from({ length: frontMods + 1 }, (_, i) => t + i * FU);
    k.outerWalls(0, {
      mat: 'plaster', tint: wood,
      front: [
        ...k.evenly(t + 0.4, xg0 - 0.4, 2).map((x) => k.window(x, (xg0 - t - 0.8) / 2 - 0.6, { broken: k.rand() < 0.3 })),
        k.door(w / 2, 'open', ARCH.door.wide),
        k.window((xo + w - t) / 2, w - t - xo - 1.2),
      ],
      back: [k.door(x1 - 1.0, k.rand() < 0.4 ? 'open' : 'locked'), k.window((x3 + x4) / 2, x4 - x3 - 2.0, { sill: 1.4, head: 2.6, broken: k.rand() < 0.4 }), k.window((x4 + w - t) / 2, w - t - x4 - 2.0, { sill: 1.4, head: 2.6 })],
      left: [k.window((t + zc0) / 2, 1.6), k.window((zf + d) / 2, 2.0)],
      right: [k.window((zd + zc0) / 2, 0.8, { sill: 1.5 }), k.window((zf + d) / 2, 1.6)],
    });
    k.outerWalls(1, {
      mat: 'woodDark', tint: wood,
      front: fronts.slice(0, -1).map((x) => k.window(x + FU / 2, FU - 1.6, { broken: k.rand() < 0.2 })),
      back: [k.window((t + x1) / 2, 2.4), k.window((x2 + x3) / 2, 0.6, { sill: 1.5 }), ...k.evenly(x3 + 0.4, w - t - 0.4, 3).map((x) => k.window(x, 2.0, { broken: k.rand() < 0.2 }))],
      left: [k.window((zf + d) / 2, 1.6)],
      right: [k.window((zf + d) / 2, 1.6)],
    });
    k.roofHip({ mat: 'tile', tint: k.rand(), axis: 'x', overhang: 0.6 });
    // Porch roof over the door, the inn's name board, noren, stone lanterns.
    k.part({ shape: 'gable', x0: w / 2 - 2.0, x1: w / 2 + 2.0, z0: d - 0.4, z1: d + 0.6, y0: y0 + 2.7, y1: y0 + 3.5, mat: 'tile', axis: 'z', tint: 0.5, solid: false });
    sign(k, w / 2 - 1.3, y0 + 2.2, d, w / 2 + 1.3, y0 + 2.65, d + 0.1, 0.3, 'wood');
    k.box(-1, w / 2 - 0.85, y0 + 1.4, d + 0.02, w / 2 + 0.85, y0 + 2.1, d + 0.05, 'fabric', { layer: 'shell', tint: 0.3, solid: false });
    for (const x of [w / 2 - 3.2, w / 2 + 3.2]) k.box(-1, x - 0.25, -0.3, d + 0.1, x + 0.25, 1.4, d + 0.55, 'concrete', { layer: 'shell', tint: 0.5, solid: false });

    for (let level = 0; level < 2; level++) {
      const ground = level === 0;
      k.floor(level, ground ? 'flooring' : 'tatami');
      // The stair column: switchback up from the corridor, the linen store behind it.
      if (ground) k.stairs({ level: 0, start: [x1 + 0.05 + LANE / 2, zc0], dir: 'z-', width: LANE, kind: 'switchback', turn: 'right', mat: 'woodDark', tint: wood });
      else k.box(1, x1 + 0.05, k.levelY(1), zc0 - 0.06, x1 + 0.05 + LANE, k.levelY(1) + ARCH.rail.height, zc0, 'wood', { role: 'furniture', tint: wood });
      k.partition(level, x1, t, x1, zc0 - P);
      k.partition(level, x2, t, x2, zc0 - P);
      k.partition(level, x1 + P, zs0, x2 - P, zs0);
      k.room(level, x1 + P, t, x2 - P, zs0 - P, 'storage', { locked: true });
      // Toilets between the stair and the baths.
      k.room(level, x2 + P, t, x3 - P, zc0 - P, 'toilet');
      k.furniture(level, x3 - P - 0.5, t + 0.3, x3 - P, t + 1.0, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x-', table: 'toilet' } });
      k.partition(level, x3, t, x3, zc0 - P);
      const C = k.room(level, t, zc0 + P, w - t, zf - P, 'hall');
      const backDoors = [k.door((x2 + x3) / 2 - t)];
      if (ground) {
        // Kitchen (door from the corridor, the back door in line with it).
        k.room(0, t, t, x1 - P, zc0 - P, 'kitchen');
        backDoors.push(k.door(x1 - 1.0 - t));
        k.furniture(0, t, t + 1.0, t + 0.75, zc0 - 1.0, 0.9, 'steel', { tint: 0.5, search: { kind: 'counter', face: 'x+', table: 'kitchen' } });
        k.furniture(0, t + 1.8, t + 2.0, x1 - 2.2, zc0 - 2.2, 0.9, 'steel', { tint: 0.3 });
        k.furniture(0, t + 1.0, zc0 - 0.8, t + 2.6, zc0 - P, 1.9, 'appliance', { search: { kind: 'fridge', face: 'z-', table: 'kitchen' } });
        k.furniture(0, t + 1.0, t, x1 - 2.0, t + 0.5, 1.9, 'shelf', { search: { kind: 'shelf', face: 'z+', table: 'grocery' } });
        // The two baths: changing room (lockers) at the corridor, the bath behind with its tub.
        for (const [bx0, bx1, tint] of [[x3, x4, 0.3], [x4, w - t, 0.55]] as const) {
          const cx = bx0 + 1.2;
          if (bx0 > x3) k.partition(0, bx0, t, bx0, zc0 - P);
          k.partition(0, bx0 + P, zd, bx1 - (bx1 === w - t ? 0 : P), zd, [k.door(cx - bx0 - P)]);
          backDoors.push(k.door(cx - t));
          k.room(0, bx0 + P, zd + P, bx1 - (bx1 === w - t ? 0 : P), zc0 - P, 'closet');
          k.furniture(0, bx1 - (bx1 === w - t ? 0 : P) - 0.5, zd + 0.3, bx1 - (bx1 === w - t ? 0 : P), zc0 - 0.4, 1.8, 'wood', { tint: 0.6, search: { kind: 'locker', face: 'x-', table: 'closet' } });
          k.room(0, bx0 + P, t, bx1 - (bx1 === w - t ? 0 : P), zd - P, 'bath');
          k.stain(0, bx0 + P, t, bx1 - P, zd - P, 'debris');
          // The tub (low wall, steaming water drawn only), the wash places along the far side wall.
          const tx0 = bx0 + 2.4;
          const tx1 = bx1 - 1.4;
          const tz0 = t + 0.8;
          const tz1 = zd - 1.6;
          if (tx1 - tx0 > 1.5 && tz1 - tz0 > 1.5) {
            for (const r of [[tx0, tz0, tx1, tz0 + 0.25], [tx0, tz1 - 0.25, tx1, tz1], [tx0, tz0, tx0 + 0.25, tz1], [tx1 - 0.25, tz0, tx1, tz1]] as const) k.furniture(0, r[0], r[1], r[2], r[3], 0.55, 'tile', { tint });
            k.box(0, tx0 + 0.25, y0, tz0 + 0.25, tx1 - 0.25, y0 + 0.4, tz1 - 0.25, 'glass', { solid: false });
          }
          k.furniture(0, bx0 + P, t + 0.6, bx0 + 0.55, zd - 1.6, 0.6, 'tile', { tint: 0.9, search: { kind: 'shelf', face: 'x+', table: 'bath' } });
        }
        // Front rooms: banquet hall, genkan, the desk, the shop.
        const fz = zf + P;
        k.partition(0, t, zf, xg0, zf, [k.door(xg0 - 1.2 - t, 'open', ARCH.door.wide)]);
        k.partition(0, xg1, zf, w - t, zf, [k.door((xo + w - t) / 2 - xg1)]);
        k.partition(0, xg0, fz, xg0, d - t);
        k.partition(0, xg1, fz, xg1, d - t, [k.door(1.0)], { mat: 'counter', tint: wood, y1: y0 + 1.1 });
        k.partition(0, xo, fz, xo, d - t);
        k.room(0, t, fz, xg0 - P, d - t, 'canteen');
        const hx0 = t + 0.9;
        const hx1 = xg0 - 1.0;
        for (const z of [fz + 1.9, fz + 3.9]) table(k, 0, (hx0 + hx1) / 2, z, hx1 - hx0, 0.7, { low: true, chairs: ['z+', 'z-'], tint: 0.25 });
        k.search(0, hx0 + 0.3, d - t - 0.6, 'table', 'canteen');
        k.stain(0, hx0, fz + 0.9, hx1, d - t - 0.3, 'tatami');
        const G = k.room(0, xg0 + P, fz, xg1 - P, d - t, 'genkan');
        k.join(C, G);
        k.furniture(0, xg0 + P, fz + 1.4, xg0 + 0.5, d - t - 1.2, 1.4, 'wood', { tint: 0.7, search: { kind: 'shelf', face: 'x+', table: 'genkan' } });
        k.stain(0, w / 2 - 1.5, d - t - 1.6, w / 2 + 1.5, d - t - 0.4, 'debris');
        k.room(0, xg1 + P, fz, xo - P, d - t, 'office');
        k.furniture(0, xo - P - 0.5, fz + 0.4, xo - P, d - t - 0.4, 1.8, 'wood', { tint: 0.5, search: { kind: 'cabinet', face: 'x-', table: 'office' } });
        k.room(0, xo + P, fz, w - t, d - t, 'sales');
        k.furniture(0, xo + 1.4, fz + 2.0, w - t - 1.4, fz + 2.8, 1.0, 'counter', { tint: wood, search: { kind: 'counter', face: 'z+', table: 'grocery' } });
        k.furniture(0, w - t - 0.5, fz + 3.4, w - t, d - t - 0.3, 1.6, 'shelf', { search: { kind: 'shelf', face: 'x-', table: 'sales' } });
      } else {
        // Upper storey: tatami rooms behind (over the kitchen and the baths) and in front.
        const backSegs: [number, number][] = [[t, x1], [x3, w - t]];
        for (const [s0, s1] of backSegs) {
          const mods = Math.max(1, Math.floor((s1 - s0) / 4.2));
          const BU = (s1 - s0) / mods;
          for (let i = 0; i < mods; i++) {
            const a = s0 + i * BU;
            const b = a + BU;
            if (i > 0) k.partition(1, a, t, a, zc0 - P);
            const at = i % 2 === 0 ? a + 0.8 : b - 0.8;
            const locked = k.rand() < 0.4;
            guestRoom(k, 1, [a + (a > t ? P : 0), t, b - (b < w - t ? P : 0), zc0 - P], 'z+', at, { locked, washitsu: true });
            backDoors.push(k.door(at - t, locked ? 'locked' : 'open'));
          }
        }
        const frontDoors = [];
        for (let i = 0; i < frontMods; i++) {
          const a = fronts[i]!;
          const b = fronts[i + 1]!;
          if (i > 0) k.partition(1, a, zf + P, a, d - t);
          const at = i % 2 === 0 ? a + 0.8 : b - 0.8;
          const locked = k.rand() < 0.4 && i !== 0;
          guestRoom(k, 1, [a + (i > 0 ? P : 0), zf + P, b - (i < frontMods - 1 ? P : 0), d - t], 'z-', at, { locked, washitsu: true });
          frontDoors.push(k.door(at - t, locked ? 'locked' : 'open'));
        }
        k.partition(1, t, zf, w - t, zf, frontDoors);
        if (k.rand() < 0.6) k.stain(1, w / 2, zc0 + 0.3, w / 2 + 1.8, zf - 0.3);
      }
      // The corridor's back wall: everything behind opens off it except the stair (open).
      const bd = backDoors.sort((p, q) => p.at - q.at);
      k.partition(level, t, zc0, x1, zc0, bd.filter((h) => h.at < x1 - t));
      k.partition(level, x2, zc0, w - t, zc0, bd.filter((h) => h.at > x2 - t).map((h) => ({ ...h, at: h.at - (x2 - t) })));
    }
    return k.finish();
  },
};
