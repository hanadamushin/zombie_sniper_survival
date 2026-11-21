// 小さな事務所ビル (07d-2c): a three-storey concrete box for one small firm. The stair runs up a strip
// along the left wall (the hall in front of it is the entrance on the ground floor); the rest of each
// floor is the firm's: the counter and desks downstairs, the workroom on the first floor, the
// president's room and the meeting room at the top. Ribbon windows across the front, the firm's
// sign on a steel frame on the roof.
//
//   +------+---------------------+
//   |stair |                     |      top floor: president | meeting
//   |      |  office             |
//   +--  --+                     |
//   | hall D                     |
//   |      |                     |
//   +-[D]--+=====ribbon window===+

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { barricade, flightDepth, LANE, meeting, officeDesks, P, ringRooms, roofPlant, SW, toppled, twoPass, type Fit } from './common.ts';

export const OFFICE_SMALL: BuildingDef = {
  id: 'office.small',
  category: 'office',
  variant: 'small',
  kind: 'office',
  size: { w: [9, 12], d: [10, 13] },
  storeys: 3,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 3.4,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_SMALL, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = ARCH.wall.concrete;
  k.thick = t;
  const tint = k.rand();
  const brand = k.rand();
  const L = flightDepth(k.def.storeyHeight);
  const xs = t + SW; // stair strip | office
  const xp = xs + P;
  const zs = t + L;
  const zDoor = zs + 1.2;
  const zm = Math.max(zs + 1.4, d * 0.5); // top floor: president | meeting
  const top = k.storeys - 1;

  for (let level = 0; level < k.storeys; level++) {
    const ground = level === 0;
    const ow = w - t - xp - P;
    k.outerWalls(level, {
      mat: 'concrete', tint, parapet: level === top ? ARCH.rail.parapet : 0,
      front: [
        ground ? k.door(t + SW / 2, 'open', 1.0) : k.window(t + SW / 2, 0.9, { sill: 1.1 }),
        k.window(xp + P + ow / 2, ow - 0.8, { sill: ground ? 0.8 : 0.9, head: 2.3, broken: k.rand() < 0.25 }),
      ],
      back: [k.window(xp + P + ow / 2, Math.min(2.4, ow - 1.0), { sill: 1.2 })],
      right: k.evenly(t + 0.6, d - t - 0.6, 2).map((z) => k.window(z, 1.4, { broken: k.rand() < 0.15 })),
    });
    k.floor(level, ground ? 'tileFloor' : 'vinyl');
    k.stairs({ level, start: [t + LANE / 2, zs], dir: 'z-', width: LANE, kind: 'switchback', turn: 'right', mat: 'concrete', tint });
    const hall = k.room(level, t, zs, xs, d - t, ground ? 'lobby' : 'hall');
    if (level < top) {
      k.partition(level, xp, t, xp, d - t, [k.door(zDoor - t)]);
      const office = k.room(level, xp + P, t, w - t, d - t, 'office');
      officeDesks(f, office, { tint: brand });
      if (ground) {
        // The reception counter across the front of the office, open at the hall side.
        f.put(office, [xp + P + 2.0, d - t - 2.4, w - t - 0.6, d - t - 1.8], 1.0, 'counter', { tint: brand, search: { kind: 'counter', face: 'z-', table: 'office' } });
        f.row(hall, 'x-', 0.6, 0.3, 1.4, 'steel', { max: 1, tint: 0.3 }); // mail boxes
      } else {
        toppled(f, office);
        if (f.chance(0.5)) f.stain(office);
        barricade(f, hall, t + SW / 2, d - t - 0.6, 'x');
      }
      f.ensure(office, 'desk', 'office');
    } else {
      k.partition(level, xp, t, xp, d - t, [k.door((zs + zm) / 2 - t), k.door((zm + d - t) / 2 - t)]);
      k.partition(level, xp + P, zm, w - t, zm);
      const pres = k.room(level, xp + P, t, w - t, zm - P, 'office');
      const meet = k.room(level, xp + P, zm + P, w - t, d - t, 'office');
      // The president's desk, a safe, a sofa.
      f.put(pres, [w - t - 2.4, t + 0.6, w - t - 0.6, t + 1.5], 0.76, 'woodDark', { search: { kind: 'desk', face: 'z+', table: 'office' } });
      f.row(pres, 'x+', 0.7, 0.6, 1.0, 'steel', { kind: 'cabinet', table: 'weapons', max: 1, tint: 0.1, from: t + 2.2 });
      f.row(pres, 'x-', 2.0, 0.8, 0.8, 'fabric', { max: 1, tint: 0.2 });
      f.ensure(pres, 'desk', 'office');
      meeting(f, meet);
      f.ensure(meet, 'cabinet', 'office');
      if (f.chance(0.6)) f.stain(meet);
    }
    if (f.chance(0.3)) f.stain(hall, 'debris', 1.0);
  }

  // Roof: the stair house over the strip, the plant, the sign frame along the front.
  k.roofFlat({ mat: 'concrete', tint });
  const e = k.eaves;
  const R = k.storeys;
  const zh = zs + 2.0;
  const opts = { mat: 'concrete' as const, tint, y0: e, y1: e + 2.7, layer: 'shell' as const };
  k.wall(R, 0, zh - t, xs + t, zh, [k.door(t + SW / 2)], opts);
  k.wall(R, xs, t, xs + t, zh - t, [], opts);
  k.box(-1, 0, e + ARCH.rail.parapet, 0, xs + t, e + 2.7, t, 'concrete', { layer: 'shell', tint });
  k.box(-1, 0, e + ARCH.rail.parapet, t, t, e + 2.7, zh - t, 'concrete', { layer: 'shell', tint });
  k.box(-1, 0, e + 2.7, 0, xs + t, e + 2.9, zh, 'concrete', { layer: 'shell', tint });
  k.room(R, t, zs, xs, zh - t, 'stairs');
  const roof = ringRooms(k, R, [t, t, w - t, d - t], [0, 0, xs + t, zh], 'roof');
  roofPlant(f, roof.all, { units: 2 });
  // The sign: two posts at the front edge and the board between them (drawn only above the parapet).
  const sx0 = xs + t + 1.0;
  const sx1 = w - 0.6;
  for (const x of [sx0, sx1 - 0.15]) k.box(-1, x, e, d - 0.22, x + 0.15, e + 3.3, d - 0.07, 'steel', { layer: 'shell' });
  k.box(-1, sx0 - 0.2, e + 1.6, d - 0.07, sx1 + 0.2, e + 3.3, d + 0.03, 'sign', { layer: 'shell', tint: brand, solid: false });
}
