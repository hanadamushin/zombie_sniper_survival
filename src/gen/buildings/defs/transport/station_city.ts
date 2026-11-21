// 市の駅 (07d-2e): a three-storey station building on the street with the ticket gates on the first
// floor, a bridge concourse (橋上駅) over two island platforms (four tracks) with a stair down onto
// each, trains at some of them, and a bus and taxi rotary (ロータリー) in front. Ground floor: the
// entrance hall, the kiosk, the toilets; first floor: the concourse, the ticket office, the shop
// (売店), the gates; second floor: a restaurant and offices. The roof can be reached.

import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { car as parkedCar } from '../shop/common.ts';
import { twoPass, type Fit } from '../office/common.ts';
import { bus, flightLength, paint, pave, shelter } from './common.ts';
import { islands, islandsDepth, stationHouse, type WingRoom } from './parts.ts';

export const TRANSPORT_STATION_CITY: BuildingDef = {
  id: 'transport.station_city',
  category: 'transport',
  variant: 'station_city',
  kind: 'office',
  size: { w: [110, 130], d: [70, 85] },
  storeys: 3,
  storeyHeight: 4.2,
  plinth: 0.5,
  roof: 'flat',
  roofRise: 3.4,
  lootable: true,
  generate(rng, params) {
    return twoPass(TRANSPORT_STATION_CITY, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const tint = k.rand();
  const roofTint = k.rand();
  const zTop = islandsDepth(2, 8.5);
  const hd = 16 + (d - 70) * 0.13;
  const hw = 44 + (w - 110) * 0.3;
  const hx0 = Math.round((w - hw) * k.range(0.35, 0.6) * 10) / 10;
  const zf = zTop + hd;
  const officeOpen = k.rand() < 0.6;
  const cafe = k.rand() < 0.5;
  const wings = (level: number, side: 'left' | 'right'): WingRoom[] => {
    if (level === 0) return side === 'left'
      ? [{ use: 'storage', state: 'locked' }, { use: 'sales', state: 'open', street: 'shutter' }]
      : [{ use: 'toilet' }, { use: 'canteen', state: 'shutter', street: 'shutter' }];
    if (level === 1) return side === 'left'
      ? [{ use: 'office', state: officeOpen ? 'open' : 'locked' }, { use: 'office' }]
      : [{ use: 'toilet' }, { use: 'sales' }];
    return side === 'left'
      ? [{ use: 'kitchen' }, { use: 'canteen', state: cafe ? 'open' : 'shutter' }]
      : [{ use: 'office', state: k.rand() < 0.5 ? 'open' : 'locked' }, { use: 'storage', state: 'locked' }];
  };
  const house = stationHouse(k, f, { rect: [hx0, zTop, hx0 + hw, zf], centre: 18, wings, mat: 'concrete', tint, doors: 3, gates: true });
  const L = flightLength(k);
  const cx0 = house.gate[0] - 1.0;
  const cx1 = Math.max(house.gate[1] + 1.0, cx0 + L + 4.2);
  islands(k, f, { zTop, x0: 4, x1: w - 4, n: 2, width: 8.5, bridge: [cx0, cx1], tint, roofTint, cars: 5 });

  // ---- The rotary: asphalt, the island in the middle, bus stops, buses and taxis.
  pave(k, 0, zf, w, d);
  const cx = hx0 + hw / 2;
  const zr = (zf + d) / 2 + 1;
  const rr = Math.min(7, (d - zf) / 2 - 6);
  k.box(-1, cx - rr * 1.6, 0, zr - rr, cx + rr * 1.6, 0.2, zr + rr, 'concrete', { layer: 'shell', tint: 0.4 });
  k.box(-1, cx - rr * 1.6 + 0.5, 0.2, zr - rr + 0.5, cx + rr * 1.6 - 0.5, 0.9, zr + rr - 0.5, 'plant', { layer: 'shell', solid: false });
  k.box(-1, cx - 0.15, 0.2, zr - 0.15, cx + 0.15, 4.5, zr + 0.15, 'steel', { layer: 'shell' });
  k.box(-1, cx - 0.5, 3.8, zr - 0.5, cx + 0.5, 4.8, zr + 0.5, 'appliance', { layer: 'shell', tint: 0.1, solid: false });
  for (let i = 0; i < 3; i++) {
    const x = hx0 + 2 + i * 14;
    if (x + 6 < w - 1) shelter(k, x, zf + 2.2, x + 6, zf + 3.6, 'z-', roofTint);
  }
  for (let i = 0; i < 2; i++) if (k.rand() < 0.7) bus(k, hx0 + 6 + i * 16, zf + 6, 'x', k.rand());
  for (let i = 0; i < 4; i++) if (k.rand() < 0.6) parkedCar(k, cx + rr * 1.6 + 4 + i * 5, d - 5, 'z', 0.95);
  for (let x = 2; x < w - 2; x += 10) paint(k, x, d - 8, x + 0.12, d - 2);
}
