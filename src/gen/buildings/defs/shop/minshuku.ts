// 民宿 (07d-2b): a big two-storey family house that took guests. Downstairs the family lived and fed
// everyone: the genkan with the stair up from it, a corridor down the left, the shared bath at its
// end, the dining room with the long table, the kitchen and the owners' room. Upstairs a corridor
// across the house and the tatami guest rooms, front and back, with the guests' toilet. Fishing
// floats and a net hang by the door; the 民宿 board stands beside it.
//
//   ground                               upper
//   +------+-----------+-------+         +---------+------+-------+
//   | bath |  kitchen  | owners|         | room    | room |  WC   |
//   +--D---+-----D-----+---D---+         +---D-----+--D---+--D----+
//   |st| C D           D       |         |     corridor           |
//   |ai| C |  dining  [table]   |         |st+------D-----+---D-----+
//   |r | C D                   |         |ai|  room      |  room   |
//   +--+---+                   |         |r |            |         |
//   |genkan|                   |         |  |            |         |
//   +-[D]--+=====window========+         +--+------------+---------+

import { ARCH } from '../../../../data/architecture.ts';
import { boards } from '../house/common.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { clearOfWays, guestRoom, P, sign, table } from './common.ts';

export const SHOP_MINSHUKU: BuildingDef = {
  id: 'shop.minshuku',
  category: 'shop',
  variant: 'minshuku',
  kind: 'house',
  size: { w: [11, 14], d: [11, 13] },
  storeys: 2,
  storeyHeight: ARCH.storey.house,
  plinth: 0.4,
  roof: 'gable',
  roofRise: 2.3,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_MINSHUKU, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.exterior;
    k.thick = t;
    const y0 = k.levelY(0);
    const siding = k.rand();
    const xs = t + 1.0; // stair | corridor
    const xg = t + 2.6; // left column | the rest
    const zg = d - t - 2.0; // genkan's back edge = the foot of the stair
    const st = k.stairs({ level: 0, start: [t + 0.5, zg], dir: 'z-', width: ARCH.stair.width, rails: ['right', 'end'], mat: 'wood' });
    const sb = st.rect[1]; // back of the stairwell
    const zb1 = t + 2.2; // bath | corridor
    const zm = Math.min(sb, (d - t + t) / 2); // kitchen and owners' room | dining
    const xo = xg + (w - t - xg) * 0.55; // kitchen | owners' room

    // ---- Ground.
    k.floor(0, 'flooring');
    k.outerWalls(0, {
      mat: 'siding', tint: siding,
      front: [k.door((t + xg) / 2, 'open', 1.2), k.window((xg + w) / 2, w - xg - 1.6, { broken: k.rand() < 0.3 })],
      back: [k.window((t + xg) / 2, 0.8, { sill: 1.4 }), k.window((xg + xo) / 2, 1.2), k.door(xo - 0.8, k.rand() < 0.4 ? 'open' : 'locked'), k.window((xo + w) / 2, 1.4)],
      right: [k.window((zm + d) / 2, 1.6), k.window((t + zm) / 2, 1.2)],
    });
    const G = k.room(0, t, zg, xg, d - t, 'genkan');
    k.furniture(0, xg - 0.45, d - t - 1.3, xg, d - t - 0.2, 1.1, 'wood', { tint: 0.6, search: { kind: 'shelf', face: 'x-', table: 'genkan' } });
    k.partition(0, xs, sb, xs, zg, [], { mat: 'wood' });
    const C = k.room(0, xs + P, zb1 + P, xg, zg, 'hall');
    k.join(G, C);
    // Bath at the end of the corridor.
    k.partition(0, t, zb1, xg, zb1, [k.door(xs + 0.7 - t)]);
    k.room(0, t, t, xg - P, zb1 - P, 'bath');
    k.furniture(0, t, t, t + 1.4, t + 0.9, 0.6, 'tile', { tint: 0.4 });
    k.furniture(0, xg - P - 0.7, t, xg - P, t + 0.5, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'z+', table: 'bath' } });
    // The rest: dining in front, kitchen and the owners' room behind.
    const dDoor = (zm + zg) / 2;
    const kDoor = (zb1 + zm) / 2;
    k.partition(0, xg, t, xg, d - t, [k.door(kDoor - t), k.door(dDoor - t)]);
    k.partition(0, xg + P, zm, w - t, zm, [k.door(xo - 1.0 - xg - P), k.door(xo + 1.0 - xg - P)]);
    k.partition(0, xo, t, xo, zm - P);
    k.room(0, xg + P, zm + P, w - t, d - t, 'canteen');
    const ways: [number, number][] = [[xg + 0.61, dDoor], [xo - 1.0, zm + 0.61], [xo + 1.0, zm + 0.61]];
    const tbl: [number, number, number, number] = [xg + 1.4, zm + 1.8, w - t - 1.0, zm + 2.6];
    if (clearOfWays(ways, [tbl[0] - 0.5, tbl[1] - 0.5, tbl[2] + 0.5, tbl[3] + 0.5], 0.3)) {
      table(k, 0, (tbl[0] + tbl[2]) / 2, (tbl[1] + tbl[3]) / 2, tbl[2] - tbl[0], tbl[3] - tbl[1], { low: true, chairs: ['z+', 'z-'], tint: 0.3 });
    }
    k.search(0, w - t - 0.8, d - t - 0.8, 'table', 'canteen');
    k.furniture(0, w - t - 0.45, zm + 0.4, w - t, zm + 1.6, 1.8, 'wood', { tint: 0.4 });
    k.room(0, xg + P, t, xo - P, zm - P, 'kitchen');
    k.furniture(0, xg + P, t, xo - 1.4, t + 0.65, 0.9, 'steel', { tint: 0.5, search: { kind: 'counter', face: 'z+', table: 'kitchen' } });
    k.furniture(0, xg + P, kDoor + 0.6, xg + 0.75, zm - 0.3, 1.8, 'appliance', { search: { kind: 'fridge', face: 'x+', table: 'kitchen' } });
    k.room(0, xo + P, t, w - t, zm - P, 'living');
    k.stain(0, xo + 0.4, t + 0.6, w - t - 0.4, zm - 1.2, 'tatami');
    k.furniture(0, w - t - 0.5, t + 0.3, w - t, zm - 1.6, 1.8, 'wood', { tint: 0.2, search: { kind: 'closet', face: 'x-', table: 'living' } });
    if (k.rand() < 0.7) k.stain(0, xs + 0.3, zb1 + 0.6, xg - 0.3, zb1 + 1.8);

    // ---- Upper: corridor across behind the stair; rooms front and back.
    const zu0 = sb - 1.4;
    k.floor(1, 'tatami');
    k.outerWalls(1, {
      mat: 'siding', tint: siding,
      front: k.evenly(xs + 0.4, w - 0.4, 2).map((x) => k.window(x, 1.8, { broken: k.rand() < 0.3 })),
      back: k.evenly(0.4, w - 0.4, 3).map((x) => k.window(x, 1.2)),
      left: [k.window((sb + d) / 2, 0.8, { sill: 1.2 })],
      right: [k.window((zu0 + sb) / 2, 0.8, { sill: 1.2 })],
    });
    k.room(1, t, zu0 + P, w - t, sb, 'hall');
    k.partition(1, xs, sb, xs, d - t, [], { mat: 'plaster' });
    const xf = (xs + w - t) / 2;
    const fd = [xs + 0.9, w - t - 0.9];
    k.partition(1, xs + P, sb, w - t, sb, fd.map((x) => k.door(x - xs - P)));
    k.partition(1, xf, sb + P, xf, d - t);
    guestRoom(k, 1, [xs + P, sb + P, xf - P, d - t], 'z-', fd[0]!, { washitsu: true });
    guestRoom(k, 1, [xf + P, sb + P, w - t, d - t], 'z-', fd[1]!, { washitsu: true, locked: k.rand() < 0.4 });
    const xw = w - t - 2.0; // back room | toilet
    const xb = (t + xw) / 2;
    const bd = [t + 0.9, xw - 0.9, xw + 1.0];
    k.partition(1, t, zu0, w - t, zu0, bd.map((x) => k.door(x - t)));
    k.partition(1, xb, t, xb, zu0 - P);
    k.partition(1, xw, t, xw, zu0 - P);
    guestRoom(k, 1, [t, t, xb - P, zu0 - P], 'z+', bd[0]!, { washitsu: true, locked: k.rand() < 0.4 });
    guestRoom(k, 1, [xb + P, t, xw - P, zu0 - P], 'z+', bd[1]!, { washitsu: true });
    k.room(1, xw + P, t, w - t, zu0 - P, 'toilet');
    k.furniture(1, w - t - 0.5, t + 0.2, w - t, t + 0.9, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x-', table: 'toilet' } });
    if (k.rand() < 0.5) boards(k, 1, xs + 0.4, d - t - 0.06, xs + 2.3, d - t - 0.01, 0.9, 2.0);

    k.roofGable({ mat: k.pick(['tile', 'metalRoof'] as const), tint: k.rand(), axis: 'x' });
    // The 民宿 board by the door, floats and a net on the wall, a bicycle.
    sign(k, xg + 0.1, y0, d + 0.1, xg + 0.35, y0 + 2.2, d + 0.5, 0.3, 'wood');
    for (let i = 0; i < 5; i++) {
      const x = xg + 0.8 + i * 0.45;
      k.box(-1, x, y0 + 1.6 - (i % 2) * 0.4, d + 0.02, x + 0.3, y0 + 1.9 - (i % 2) * 0.4, d + 0.3, 'glass', { layer: 'shell', solid: false });
    }
    k.box(-1, xg + 0.6, y0 + 0.4, d + 0.01, xg + 3.2, y0 + 2.2, d + 0.03, 'fabric', { layer: 'shell', tint: 0.6, solid: false });
    k.box(-1, w - 1.6, 0, d + 0.1, w - 0.2, 1.0, d + 0.25, 'steel', { layer: 'shell', tint: 0.2, solid: false });
    return k.finish();
  },
};
