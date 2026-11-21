// 陸上自衛隊の駐屯地 (07d-2f): small, middle and large garrisons. A fence round the site, the main
// gate with its guard hut on the front (z = d), the parade ground and the HQ (本部: the commander's
// safe holds the area's key; the HQ armory and the earth-covered ammunition depots open with it),
// barracks (隊舎), motor pools (車両整備場), the training ground (訓練場).
//
//   jgsdf_s  小: one barracks, the motor pool, two depots, a small training ground
//   jgsdf_m  中: two barracks (one open: the canteen and an armory; one locked), the mess hall and the
//            gym, two motor pools and the vehicle park, three depots with a watchtower, the
//            training ground, the rifle range and a helipad
//   jgsdf_l  大 (most of an area): a barracks district (two barracks open, two locked), the mess
//            hall and the gym, three motor pools and the tank park, a depot compound with four
//            magazines and two watchtowers, a large training area, the rifle range, two helipads

import type { Kit } from '../../kit.ts';
import type { Fit } from '../office/common.ts';
import { heli, helipadH, watchtower } from '../military/parts.ts';
import { mesh } from '../public/common.ts';
import {
  barracks, depot, gym, hq, lockedBlock, mainGate, messHall, motorPool, parade, perimeter, rifleRange, sdfDef, training, vehicleRow, type KeyRect,
} from './sdf_parts.ts';

/** A fenced compound of magazines along x from x0 (doors to +z), its gate at the front; a watchtower on the right if asked. */
function depots(k: Kit, f: Fit, x0: number, z0: number, n: number, tower: boolean): KeyRect[] {
  const keys: KeyRect[] = [];
  const mw = 9;
  const md = 12;
  for (let i = 0; i < n; i++) keys.push(depot(k, [x0 + 4 + i * (mw + 5), z0 + 4, x0 + 4 + i * (mw + 5) + mw, z0 + 4 + md]));
  const x1 = x0 + 8 + n * (mw + 5) + (tower ? 6 : 0);
  const z1 = z0 + md + 12;
  const gx = x0 + 4 + mw / 2;
  mesh(k, x0, z1, x1, z1, [[gx - 2.5, gx + 2.5]], 2.2);
  mesh(k, x0, z0 + 0.6, x0, z1, [], 2.2);
  mesh(k, x1, z0 + 0.6, x1, z1, [], 2.2);
  if (tower) {
    const top = watchtower(k, x1 - 5, z0 + 4, { mat: 'steel', tint: 0.4 });
    for (const r of top) f.ensure(r, 'crate', 'field');
  }
  return keys;
}

export const BASE_JGSDF_S = sdfDef('jgsdf_s', { size: { w: [150, 180], d: [90, 100] }, roofRise: 11, limits: { shell: 4000, interior: 5000 } }, (k, f) => {
  const { w, d } = k;
  const tint = k.rand();
  const gx = w / 2;
  perimeter(k, [mainGate(k, f, gx, d - 30, tint)]);
  parade(k, [gx - 20, d - 44, gx + 20, d - 30], [gx - 14, d - 37]);
  const keys = hq(k, [gx - 22, d - 60, gx + 22, d - 46], 2, tint);
  keys.push(...barracks(k, [8, 8, 52, 22], 3, k.rand()));
  motorPool(k, f, [w - 58, 6, w - 8, 26], k.rand());
  vehicleRow(k, w - 50, 34, 6, 7, ['truck', 'truck', 'jeep']);
  keys.push(...depots(k, f, 57, 3, 2, false));
  training(k, [6, d - 26, gx - 26, d - 6]);
  return keys;
});

export const BASE_JGSDF_M = sdfDef('jgsdf_m', { size: { w: [270, 320], d: [170, 210] }, roofRise: 11, limits: { shell: 8000, interior: 8000 } }, (k, f) => {
  const { w, d } = k;
  const tint = k.rand();
  const gx = w / 2;
  perimeter(k, [mainGate(k, f, gx, d - 40, tint)]);
  parade(k, [gx - 30, d - 56, gx + 30, d - 40], [gx - 22, d - 48]);
  const keys = hq(k, [gx - 26, d - 74, gx + 26, d - 58], 2, tint);
  const bt = k.rand();
  keys.push(...barracks(k, [10, d - 36, 62, d - 21], 3, bt, { canteen: true, armory: true }));
  lockedBlock(k, [10, d - 72, 62, d - 57], 4, bt);
  messHall(k, f, [w - 62, d - 34, w - 30, d - 18], k.rand());
  gym(k, f, [w - 64, d - 76, w - 24, d - 50], k.rand());
  motorPool(k, f, [10, 8, 70, 30], k.rand());
  motorPool(k, f, [80, 8, 140, 30], k.rand());
  vehicleRow(k, 16, 40, 16, 7.5, ['truck', 'truck', 'apc', 'jeep']);
  keys.push(...depots(k, f, w - 70, 4, 3, true));
  training(k, [70, 52, w - 80, d - 86]);
  rifleRange(k, [w - 72, 46, w - 8, 72]);
  helipadH(k, w - 40, d - 100, 18);
  if (k.rand() < 0.5) heli(k, w - 40, d - 100, 'x', { crashed: k.rand() < 0.4 });
  return keys;
});

export const BASE_JGSDF_L = sdfDef('jgsdf_l', { size: { w: [700, 800], d: [460, 540] }, roofRise: 12, limits: { shell: 12000, interior: 9000 } }, (k, f) => {
  const { w, d } = k;
  const tint = k.rand();
  const gx = w / 2;
  perimeter(k, [mainGate(k, f, gx, d - 60, tint)]);
  parade(k, [gx - 40, d - 82, gx + 40, d - 60], [gx - 30, d - 71]);
  const keys = hq(k, [gx - 30, d - 100, gx + 30, d - 84], 3, tint);
  // The barracks district (front left).
  const bt = k.rand();
  keys.push(...barracks(k, [20, d - 40, 80, d - 25], 2, bt, { canteen: true, armory: true }));
  lockedBlock(k, [100, d - 40, 160, d - 25], 4, bt);
  lockedBlock(k, [20, d - 80, 80, d - 64], 4, bt);
  lockedBlock(k, [100, d - 80, 160, d - 64], 4, bt);
  messHall(k, f, [180, d - 42, 220, d - 24], k.rand());
  gym(k, f, [180, d - 90, 232, d - 60], k.rand());
  // Motor pools and the vehicle parks (front right).
  for (let i = 0; i < 3; i++) motorPool(k, f, [w - 250 + i * 80, d - 70, w - 190 + i * 80, d - 46], k.rand(), { tanks: i === 2 });
  vehicleRow(k, w - 245, d - 30, 14, 15, ['truck', 'truck', 'apc', 'jeep']);
  vehicleRow(k, w - 245, d - 100, 10, 20, ['tank', 'apc', 'tank']);
  // The depot compound (back right) and the training area (back left).
  keys.push(...depots(k, f, w - 140, 6, 4, true));
  training(k, [30, 30, gx - 40, 120]);
  training(k, [30, 140, gx - 40, 220]);
  rifleRange(k, [gx + 20, 20, gx + 150, 60]);
  helipadH(k, w - 120, 160, 20);
  helipadH(k, w - 80, 160, 20);
  if (k.rand() < 0.6) heli(k, w - 120, 160, 'x', { big: true, crashed: k.rand() < 0.4 });
  const top = watchtower(k, gx - 60, 250, { mat: 'steel', tint: 0.4 });
  for (const r of top) f.ensure(r, 'crate', 'field');
  return keys;
});

export const BASE_JGSDF: typeof BASE_JGSDF_S[] = [BASE_JGSDF_S, BASE_JGSDF_M, BASE_JGSDF_L];
