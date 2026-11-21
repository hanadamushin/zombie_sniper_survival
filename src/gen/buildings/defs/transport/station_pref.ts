// 県庁所在地の駅 (07d-2e): a big four-storey station building, three island platforms (six tracks)
// and a freight track behind them under a long bridge concourse, a bus terminal (バスターミナル)
// in front with its bays, shelters and buses, and the stairs down to the underground passage
// (地下通路) — rolled-down shutters, sealed. Inside: the entrance hall with the shuttered passage
// stair and shops, the concourse and the gates on the first floor, a restaurant floor and offices
// above, the roof.

import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { car as parkedCar } from '../shop/common.ts';
import { twoPass, type Fit } from '../office/common.ts';
import { bus, flightLength, paint, pave, shelter } from './common.ts';
import { islands, islandsDepth, stationHouse, type WingRoom } from './parts.ts';

export const TRANSPORT_STATION_PREF: BuildingDef = {
  id: 'transport.station_pref',
  category: 'transport',
  variant: 'station_pref',
  kind: 'office',
  size: { w: [160, 190], d: [95, 115] },
  storeys: 4,
  storeyHeight: 4.2,
  plinth: 0.5,
  roof: 'flat',
  roofRise: 3.4,
  lootable: true,
  // A site of several structures (the building, seven tracks of trains, the bus terminal): a little more outside.
  limits: { shell: 5000, interior: 4000 },
  generate(rng, params) {
    return twoPass(TRANSPORT_STATION_PREF, rng, params, build);
  },
};

/** The stairs down to the underground passage, behind a shutter facing `face` (z+ / z-), at (x, z). */
export function passage(k: Kit, x: number, z: number, face: 'z+' | 'z-', tint: number): void {
  const [hw, dp] = [2.2, 5.5];
  const s = face === 'z+' ? 1 : -1;
  const zf = z + (s * dp) / 2;
  const zb = z - (s * dp) / 2;
  const opts = { mat: 'concrete' as const, tint, y1: 2.8, exterior: true, layer: 'shell' as const };
  const [fa, fb] = s > 0 ? [zf - 0.2, zf] : [zf, zf + 0.2];
  k.wall(0, x - hw, fa, x + hw, fb, [k.door(hw, 'shutter', 2.6)], opts);
  k.box(-1, x - hw, 0, Math.min(zb, zf), x - hw + 0.2, 2.8, Math.max(zb, zf), 'concrete', { layer: 'shell', tint });
  k.box(-1, x + hw - 0.2, 0, Math.min(zb, zf), x + hw, 2.8, Math.max(zb, zf), 'concrete', { layer: 'shell', tint });
  const [ba, bb] = s > 0 ? [zb, zb + 0.2] : [zb - 0.2, zb];
  k.box(-1, x - hw, 0, ba, x + hw, 2.8, bb, 'concrete', { layer: 'shell', tint });
  k.box(-1, x - hw - 0.2, 2.8, Math.min(zb, zf) - 0.2, x + hw + 0.2, 3.0, Math.max(zb, zf) + 0.2, 'glass', { layer: 'shell' });
  k.box(-1, x - hw + 0.3, 2.2, zf + s * 0.01, x + hw - 0.3, 2.6, zf + s * 0.06, 'sign', { layer: 'shell', tint: 0.4, solid: false });
}

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const tint = k.rand();
  const roofTint = k.rand();
  const zTop = islandsDepth(3, 9, true);
  const hd = 20 + (d - 95) * 0.2;
  const hw = 64 + (w - 160) * 0.4;
  const hx0 = Math.round((w - hw) * k.range(0.35, 0.6) * 10) / 10;
  const zf = zTop + hd;
  const wings = (level: number, side: 'left' | 'right'): WingRoom[] => {
    if (level === 0) return side === 'left'
      ? [{ use: 'storage', state: 'locked' }, { use: 'sales', state: 'shutter', street: 'shutter' }, { use: 'sales', state: 'open', street: 'shutter' }]
      : [{ use: 'toilet' }, { use: 'hall', state: 'shutter' }, { use: 'canteen', state: 'shutter', street: 'shutter' }];
    if (level === 1) return side === 'left'
      ? [{ use: 'office', state: k.rand() < 0.6 ? 'open' : 'locked' }, { use: 'office' }, { use: 'lobby' }]
      : [{ use: 'toilet' }, { use: 'sales' }, { use: 'sales', state: 'shutter' }];
    if (level === 2) return side === 'left'
      ? [{ use: 'kitchen' }, { use: 'canteen' }, { use: 'canteen', state: 'shutter' }]
      : [{ use: 'storage' }, { use: 'canteen', state: 'shutter' }, { use: 'bar', state: k.rand() < 0.5 ? 'open' : 'shutter' }];
    return side === 'left'
      ? [{ use: 'office', state: 'locked' }, { use: 'office', state: k.rand() < 0.5 ? 'open' : 'locked' }]
      : [{ use: 'storage', state: 'locked' }, { use: 'office' }];
  };
  const house = stationHouse(k, f, { rect: [hx0, zTop, hx0 + hw, zf], centre: 22, wings, mat: k.pick(['concrete', 'mortar', 'brick'] as const), tint, doors: 4, gates: true });
  const L = flightLength(k);
  const cx0 = house.gate[0] - 1.5;
  const cx1 = Math.max(house.gate[1] + 1.5, cx0 + L + 4.5);
  islands(k, f, { zTop, x0: 5, x1: w - 5, n: 3, width: 9, bridge: [cx0, cx1], through: true, tint, roofTint, cars: 6 });

  // ---- The bus terminal: bays along islands with shelters, buses, the passage stairs, taxis.
  pave(k, 0, zf, w, d);
  const bays = Math.max(1, Math.floor((d - zf - 8) / 9));
  for (let i = 0; i < bays; i++) {
    const zi = zf + 6 + i * 9;
    k.box(-1, 6, 0, zi, w * 0.62, 0.15, zi + 2.4, 'concrete', { layer: 'shell', tint: 0.5 });
    k.box(-1, 8, 2.8, zi + 0.2, w * 0.62 - 2, 3.0, zi + 2.2, 'metalRoof', { layer: 'shell', tint: roofTint, solid: false });
    for (let x = 12; x < w * 0.62 - 4; x += 36) k.box(-1, x - 0.1, 0.15, zi + 1.1, x + 0.1, 2.8, zi + 1.3, 'steel', { layer: 'shell', tint: 0.5 });
    for (let x = 14; x < w * 0.62 - 10; x += 16) if (k.rand() < 0.55) bus(k, x, zi + 4.3, 'x', k.rand());
  }
  for (let i = 0; i < 2; i++) shelter(k, hx0 + 4 + i * 10, zf + 1.0, hx0 + 10 + i * 10, zf + 2.4, 'z-', roofTint);
  passage(k, w * 0.62 + 8, d - 6, 'z-', tint);
  passage(k, house.xb + 8, zf + 5.5, 'z+', tint);
  for (let i = 0; i < 5; i++) if (k.rand() < 0.6) parkedCar(k, w * 0.62 + 16 + i * 5, d - 6, 'z', 0.95);
  for (let x = w * 0.62 + 13.5; x < w - 2; x += 5) paint(k, x, d - 9, x + 0.12, d - 3);
}
