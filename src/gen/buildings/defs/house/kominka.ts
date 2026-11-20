// 古民家 (07d-2a). An old farmhouse under a tall hipped roof (tin over the old thatch): a 土間 the
// height of the house on the left, with the hearth (かまど), the sink and the big sliding door; the
// four rooms of the 田の字 plan raised 0.38 m above it; a 縁側 along the front behind sliding glass.
//
//   +----------+-------------+-------------+
//   |  土間     | 板の間 (囲炉裏) =D= 奥座敷 (床の間) |
//   |  (doma)  open  ||D       ||D           |
//   |  かまど   +------D------+------D------+
//   |  水甕     | 茶の間       =D= 座敷        |
//   |          open           |              |
//   |  薪       +----D--------+------D------+
//   |          | 縁側 (engawa) ------------- D side door
//   +--[大戸]--+=====glass======glass========+
//      front (z = d); a well in the yard

import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { boards, fence, lowerRoom, P, pitched, ring, tree } from './common.ts';

const DOMA_Y = 0.12;

export const HOUSE_KOMINKA: BuildingDef = {
  id: 'house.kominka',
  category: 'house',
  variant: 'kominka',
  kind: 'house',
  size: { w: [14, 17], d: [11, 13] },
  storeys: 1,
  storeyHeight: 3.0,
  plinth: 0.5,
  roof: 'hip',
  roofRise: 4.2,
  lootable: true,
  generate(rng, params) {
    const k = createKit(HOUSE_KOMINKA, params, rng);
    const { w, d } = k;
    const t = 0.18;
    k.thick = t;
    const D = d - 1.6;
    const xd = t + 4.2; // doma | raised floor
    const xm = (xd + w - t) / 2; // left | right rooms
    const ze = D - t - 1.2; // rooms | engawa
    const zA = (t + ze) / 2; // back | middle rooms
    const fy = k.levelY(0);
    const drop = DOMA_Y - fy; // the doma's doors start at its floor
    const doorX = (t + xd) / 2;
    const xBack = xd - 1.0;
    const tint = k.rand();
    const boarded = k.rand() < 0.4;

    // Floors: the raised rooms, and the doma's beaten earth well below them.
    k.floor(0, 'flooring', [xd, t, w - t, D - t]);
    k.box(0, t, -3, t, xd, DOMA_Y, D - t, 'mortar', { tint: 0.66 });
    const big = { ...k.door(doorX, 'open', 1.8), sill: drop, head: 2.2 - drop };
    const back = { ...k.door(xBack, k.rand() < 0.5 ? 'open' : 'locked'), sill: drop, head: 2.0 - drop };
    const engawaWin = k.evenly(xd + 0.3, w - t - 0.3, 3).map((x) => k.window(x, (w - xd) / 3 - 0.7, { sill: 0.05, head: 1.9, broken: k.rand() < 0.35 }));
    ring(k, 0, [0, 0, w, D], {
      mat: 'plaster', tint,
      front: [big, k.window(xd - 0.45, 0.5, { sill: 0.6, head: 1.6 }), ...engawaWin],
      back: [k.window(t + 1.0, 0.9, { sill: 1.2 }), back, k.window((xd + xm) / 2, 1.2, { sill: 0.9 }), k.window((xm + w - t) / 2, 1.6, { sill: 0.9 })],
      left: [k.window(D / 2, 0.9, { sill: 1.4, head: 2.2 })],
      right: [k.window((t + zA) / 2, 1.2, { sill: 0.9 }), k.window((zA + ze) / 2, 1.2, { sill: 0.9, broken: true }), k.door((ze + D - t) / 2, k.rand() < 0.3 ? 'locked' : 'open')],
    });
    if (boarded) boards(k, 0, xd + 0.3, D - t - 0.07, w - t - 0.3, D - t - 0.03, 0.2, 1.8);

    // Fusuma and shoji: the 田の字 rooms open into each other through wide openings.
    const fus = { mat: 'wood' as const, tint: 0.95 };
    k.partition(0, xd, zA, w - t, zA, [k.door((xd + xm) / 2 - xd, 'open', 1.8), k.door((xm + w - t) / 2 - xd, 'open', 1.8)], fus);
    k.partition(0, xm, t, xm, ze, [k.door((t + zA) / 2 - t, 'open', 1.8), k.door((zA + ze) / 2 - t, 'open', 1.8)], fus);
    k.partition(0, xd, ze, w - t, ze, [k.door((xd + xm) / 2 - xd, 'open', 1.8), k.door((xm + w - t) / 2 - xd, 'open', 1.8)], fus);
    k.partition(0, xd, ze, xd, D - t, [], { mat: 'plaster', tint, y0: DOMA_Y });

    const doma = k.room(0, t, t, xd, D - t, 'kitchen');
    const itanoma = k.room(0, xd, t, xm - P, zA - P, 'living');
    k.room(0, xm + P, t, w - t, zA - P, 'tatami');
    const chanoma = k.room(0, xd, zA + P, xm - P, ze - P, 'living');
    k.room(0, xm + P, zA + P, w - t, ze - P, 'tatami');
    k.room(0, xd + P, ze + P, w - t, D - t, 'hall'); // engawa
    k.join(doma, itanoma);
    k.join(doma, chanoma);

    // 土間: the sink, the hearth, the water jar, firewood.
    const dy = DOMA_Y;
    k.box(0, t, dy, t, t + 1.8, dy + 0.85, t + 0.6, 'concrete', { tint: 0.33, role: 'furniture' }); // 流し
    k.search(0, t + 1.3, t + 1.1, 'counter', 'kitchen');
    k.box(0, t, dy, t + 1.3, t + 0.9, dy + 0.8, t + 3.0, 'mortar', { tint: 0.9, role: 'furniture' }); // かまど
    k.search(0, t + 1.4, t + 2.15, 'counter', 'grocery');
    k.box(0, t, dy, t + 3.4, t + 0.6, dy + 0.7, t + 4.0, 'woodDark', { role: 'furniture' }); // 水甕
    k.box(0, t, dy, D - t - 2.2, t + 0.8, dy + 1.1, D - t - 0.4, 'wood', { tint: 0.2, role: 'furniture' }); // firewood
    k.search(0, t + 1.3, D - t - 1.3, 'crate', 'storage');

    // Raised rooms.
    k.furniture(0, (xd + xm) / 2 - 0.5, (t + zA) / 2 + 0.3, (xd + xm) / 2 + 0.5, (t + zA) / 2 + 1.3, 0.15, 'woodDark', { solid: false }); // 囲炉裏
    k.stain(0, (xd + xm) / 2 - 0.35, (t + zA) / 2 + 0.45, (xd + xm) / 2 + 0.35, (t + zA) / 2 + 1.15, 'debris');
    k.furniture(0, xm - P - 1.5, t, xm - P - 0.2, t + 0.5, 1.2, 'woodDark', { search: { kind: 'cabinet', face: 'z+', table: 'living' } }); // 水屋箪笥
    k.stain(0, xm + P, t, w - t, zA - P, 'tatami');
    k.furniture(0, w - t - 1.8, t, w - t, t + 0.8, 0.2, 'woodDark'); // 床の間
    k.furniture(0, w - t - 0.6, t + 1.2, w - t, t + 2.2, 1.6, 'woodDark', { search: { kind: 'cabinet', face: 'x-', table: 'tatami' } }); // 仏壇
    k.furniture(0, xm - P - 1.0, ze - 0.55, xm - P, ze - P, 1.4, 'wood', { tint: 0.7, search: { kind: 'closet', face: 'z-', table: 'closet' } }); // 箪笥
    k.furniture(0, (xd + xm) / 2 - 0.45, (zA + ze) / 2 - 0.1, (xd + xm) / 2 + 0.45, (zA + ze) / 2 + 0.6, 0.35, 'wood', { tint: 0.5 }); // ちゃぶ台
    k.stain(0, xm + P, zA + P, w - t, ze - P, 'tatami');
    k.furniture(0, w - t - 0.6, ze - 1.4, w - t, ze - P, 1.0, 'wood', { tint: 0.3, search: { kind: 'cabinet', face: 'x-', table: 'tatami' } });
    if (k.rand() < 0.7) k.stain(0, xd + 1.0, ze + 0.2, xd + 2.6, D - t - 0.2);
    k.stain(0, t + 1.2, D - t - 2.6, t + 2.4, D - t - 1.4);

    pitched(k, [0, 0, w, D], { mat: 'metalRoof', tint: 0.9, hip: true, axis: 'x', overhang: 0.55 });

    // Yard: a well with its little roof, a persimmon tree, a low hedge of stones.
    const wx = w - 1.7;
    const wz = D + 0.25;
    k.box(-1, wx, -0.5, wz, wx + 1.0, 0.7, wz + 1.0, 'concrete', { layer: 'shell', tint: 0.66 });
    for (const x of [wx, wx + 0.9]) k.box(-1, x, 0.7, wz + 0.45, x + 0.1, 2.0, wz + 0.55, 'woodDark', { layer: 'shell' });
    k.box(-1, wx - 0.1, 2.0, wz + 0.1, wx + 1.1, 2.1, wz + 0.9, 'wood', { layer: 'shell', solid: false });
    tree(k, xm, D + 0.9, 1.8);
    fence(k, 0, d - 0.3, doorX - 1.5 > 0.3 ? doorX - 1.5 : 0.3, d, 0.5, 'concrete', 0.33);
    fence(k, doorX + 1.6, d - 0.3, wx - 0.3, d, 0.5, 'concrete', 0.33);
    return lowerRoom(k.finish(), doma, DOMA_Y);
  },
};
