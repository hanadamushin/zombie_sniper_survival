// 無人駅 (07d-2e): one platform beside a single track, and a small wooden waiting shed that is also
// the way in from the road. A diesel railcar (one or two cars) has stopped at the platform with its
// doors open. Low fences, a name board, a vending machine, weeds between the sleepers.
//
//   z = d  road ................................................
//          |      [shed]D                                    |   D: the shed's door from the road
//          ======|      |==================================== fence
//          |  platform (one room)                             |
//          =====[  railcar ]=================================  track
//   z = 0

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { twoPass, type Fit } from '../office/common.ts';
import { EDGE, fence, nameBoard, paint, platform, track, train, trainLength } from './common.ts';

export const TRANSPORT_STATION_MUJIN: BuildingDef = {
  id: 'transport.station_mujin',
  category: 'transport',
  variant: 'station_mujin',
  kind: 'shed',
  size: { w: [36, 50], d: [12, 16] },
  storeys: 1,
  storeyHeight: 3.0,
  plinth: 0.5,
  roof: 'flat',
  roofRise: 1.0,
  lootable: true,
  generate(rng, params) {
    return twoPass(TRANSPORT_STATION_MUJIN, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const fy = k.levelY(0);
  const zt = 2.4;
  const z0 = zt + EDGE;
  const z1 = z0 + 3.0 + (d - 12) * 0.25;
  const xa = 2;
  const xb = w - 2;
  track(k, zt, 0, w);
  // Weeds between the rails.
  for (let i = 0; i < 3; i++) {
    const x = k.range(1, w - 3);
    paint(k, x, zt - 0.5, x + k.range(0.8, 2.5), zt + 0.5, 0, 'plant', 0.25);
  }
  const plat = platform(k, xa, xb, z0, z1, { edges: ['z-'], tint: 0.2, maxLen: 60 });
  const main = plat[0]!.id;

  // The waiting shed on the road side of the platform.
  const sw = 4.6;
  const sd = 2.6;
  const sx0 = xa + (xb - xa - sw) * k.range(0.15, 0.6);
  const sx1 = sx0 + sw;
  const sz1 = z1 + sd;
  const t = 0.12;
  const tint = k.rand();
  k.box(-1, sx0, -0.3, z1, sx1, fy, sz1, 'concrete', { layer: 'shell', tint: 0.2 });
  const wo = { mat: 'wood' as const, tint, y1: fy + 2.5, exterior: true, layer: 'shell' as const };
  k.wall(0, sx0, sz1 - t, sx1, sz1, [k.door(sw / 2, 'open', ARCH.door.width)], wo);
  k.wall(0, sx0, z1, sx0 + t, sz1 - t, [k.window(sd / 2, 1.0, { broken: k.rand() < 0.5 })], wo);
  k.wall(0, sx1 - t, z1, sx1, sz1 - t, [], wo);
  k.part({ shape: 'wedge', x0: sx0 - 0.3, x1: sx1 + 0.3, z0: z1 - 0.6, z1: sz1 + 0.3, y0: fy + 2.5, y1: fy + 2.9, mat: 'metalRoof', tint: k.rand(), slope: 'z-' });
  const shed = k.room(0, sx0 + t, z1, sx1 - t, sz1 - t, 'lobby');
  k.join(main, shed);
  f.row(shed, 'x+', 2.0, 0.45, 0.45, 'wood', { tint: 0.3, kind: 'crate', table: 'lobby', max: 1 });
  f.row(shed, 'x-', 0.4, 0.3, 1.6, 'sign', { tint: 0.1, max: 1 }); // the timetable board
  f.ensure(shed, 'crate', 'lobby');
  if (f.chance(0.4)) f.stain(shed);

  // Fences along the road side and the ends, the name board, the vending machine, benches.
  fence(k, xa, z1 + 0.06, sx0, z1 + 0.06, fy + 1.1, 'wood', 0.7);
  fence(k, sx1, z1 + 0.06, xb, z1 + 0.06, fy + 1.1, 'wood', 0.7);
  fence(k, xa + 0.06, z0 + 1.0, xa + 0.06, z1, fy + 1.1, 'wood', 0.7);
  fence(k, xb - 0.06, z0 + 1.0, xb - 0.06, z1, fy + 1.1, 'wood', 0.7);
  nameBoard(k, sx0 > xa + 8 ? xa + 4 : xb - 4, z1 - 0.4, 0.05);
  f.row(main, 'z+', 0.9, 0.7, 1.85, 'appliance', { kind: 'fridge', table: 'grocery', max: 1, from: sx1 + 0.5, tint: f.rand() });
  f.row(main, 'z+', 1.8, 0.45, 0.45, 'wood', { max: 2, gap: 4, from: xa + 1, to: sx0 - 0.5, tint: 0.3 });
  f.ensure(main, 'crate', 'platform');

  // The railcar.
  const cars = xb - xa >= trainLength(2, 20) + 1 && k.rand() < 0.6 ? 2 : 1;
  const len = trainLength(cars, 20);
  const x0 = xa + 0.5 + (xb - xa - 1 - len) * k.rand();
  train(k, f, x0, cars, 20, zt, { side: 'z+', doors: 2, tint: k.rand(), open: true, mat: 'steel' });
  // Bicycles left by the road.
  for (let i = 0; i < 3; i++) {
    const x = sx1 + 1 + i * 0.7;
    if (x + 0.1 < w - 0.5 && sz1 + 1.9 < d) k.box(-1, x, 0, sz1 + 0.3, x + 0.08, 1.0, sz1 + 1.9, 'steel', { layer: 'shell', tint: k.rand(), solid: false });
  }
}
