// 雑居ビル・ペンシル型 (07d-2c): a narrow five-storey block of small night-time tenants, one per floor.
// The core runs across the back (the stair on the left, a toilet and tea room on the right, a small
// hall in front of both); each upper floor is one tenant behind a door off the hall — a snack bar,
// a mahjong parlour, a loan office, a massage room or a store, some of them locked. On the ground
// floor a narrow passage runs from the street to the hall beside the ground tenant (a standing bar
// or a shuttered shop). A stack of the tenants' signs sticks out of the front corner; a billboard
// frame stands on the roof.
//
//   +-------+--------+
//   | stair |  WC    |
//   |       |        |
//   +-hall--D--------+
//   |pas-|   bar     |      upper floors: one tenant the full width
//   |sage|           |
//   +-[D]+==[door]===+

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef, RoomUse } from '../../types.ts';
import { barricade, barRoom, canteen, clinicRoom, coreAt, coreLevel, coreRoof, officeDesks, P, ringRooms, roofPlant, storeRoom, SW, twoPass, type Fit } from './common.ts';

export const OFFICE_ZAKKYO_NARROW: BuildingDef = {
  id: 'office.zakkyo_narrow',
  category: 'office',
  variant: 'zakkyo_narrow',
  kind: 'office',
  size: { w: [7, 9], d: [15, 19] },
  storeys: 5,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 4.2,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_ZAKKYO_NARROW, rng, params, build);
  },
};

type Tenant = 'snack' | 'mahjong' | 'loan' | 'massage' | 'store';
const USE: Record<Tenant, RoomUse> = { snack: 'bar', mahjong: 'bar', loan: 'office', massage: 'clinic', store: 'storage' };

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = ARCH.wall.concrete;
  k.thick = t;
  const tint = k.rand();
  const x0 = t + P;
  const wcW = w - 2 * t - 6 * P - SW;
  const c = coreAt(k, x0, t + P, { wc: true, wcW, hall: 2.0 });
  const xp = t + 1.3 + P; // ground floor: passage | bar
  const top = k.storeys - 1;
  const tenants: Tenant[] = ['snack', 'mahjong', 'loan', 'massage', 'store'];
  const signs: number[] = [];

  for (let level = 0; level < k.storeys; level++) {
    const ground = level === 0;
    const tenant: Tenant = ground ? 'snack' : k.pick(tenants);
    const shut = ground && k.rand() < 0.45;
    const locked = !ground && level !== top && k.rand() < 0.3;
    signs.push(k.rand());
    const tw = w - 2 * t;
    k.outerWalls(level, {
      mat: 'concrete', tint, parapet: level === top ? ARCH.rail.parapet : 0,
      front: ground
        ? [k.door(t + 0.65, 'open', 1.0), shut ? k.door((xp + P + w - t) / 2, 'shutter', Math.min(3.0, w - t - xp - 0.8)) : k.door(xp + P + 1.0, 'open', 1.0), ...(shut ? [] : [k.window((xp + P + 1.6 + w - t) / 2, w - t - xp - 2.4, { sill: 0.8, broken: k.rand() < 0.3 })])]
        : [k.window(t + tw / 2, tw - 1.4, { sill: 0.9, head: 2.4, broken: k.rand() < 0.2 })],
      back: [k.window((c.wc![0] + c.wc![2]) / 2, 0.6, { sill: 1.5 })],
      left: [k.window((c.z1 + d - t) / 2, 1.6, { broken: k.rand() < 0.2 })],
    });
    k.floor(level, ground ? 'tileFloor' : 'vinyl');
    const door = { x: ground ? t + 0.65 : (c.x0 + c.x1) / 2, state: locked ? ('locked' as const) : ('open' as const) };
    const { hall, wc } = coreLevel(k, level, c, { front: [door], tint, wcOpen: k.rand() < 0.6 });
    if (wc >= 0) {
      f.row(wc, 'z-', 0.6, 0.5, 0.85, 'appliance', { kind: 'cabinet', table: 'toilet', max: 1, tint: 0.9 });
      f.ensure(wc, 'cabinet', 'toilet');
    }
    if (ground) {
      // The passage from the street to the hall, the bar (or the shuttered shop) beside it.
      k.partition(0, xp, c.z1 + P, xp, d - t, [k.door(c.z1 + 1.2 - (c.z1 + P), 'locked')]);
      const pass = k.room(0, t, c.z1 + P, xp - P, d - t, 'lobby');
      f.row(pass, 'x-', 0.6, 0.3, 1.4, 'steel', { kind: 'cabinet', table: 'lobby', max: 1, tint: 0.3 });
      const bar = k.room(0, xp + P, c.z1 + P, w - t, d - t, shut ? 'sales' : 'bar', { locked: shut });
      if (!shut) {
        barRoom(f, bar, tint);
        f.stain(bar);
      }
      if (f.chance(0.5)) f.stain(pass, 'debris', 0.8);
    } else {
      const r = k.room(level, t, c.z1 + P, w - t, d - t, USE[tenant], { locked });
      if (!locked) {
        if (tenant === 'snack') barRoom(f, r, signs[level]);
        else if (tenant === 'mahjong') canteen(f, r, { tint: 0.3, counter: false });
        else if (tenant === 'loan') {
          officeDesks(f, r, { tint: 0.5 });
          f.row(r, 'z-', 2.2, 0.6, 1.05, 'counter', { kind: 'counter', table: 'office', max: 1 });
        } else if (tenant === 'massage') clinicRoom(f, r);
        else storeRoom(f, r);
        f.ensure(r, 'cabinet', USE[tenant]);
        if (f.chance(0.4)) f.stain(r);
      } else barricade(f, hall, (c.hall[0] + c.hall[2]) / 2 + 0.6, c.hall[3] - 0.45, 'x');
    }
  }

  // The tenants' sign stack on the front corner (drawn only past the wall), the roof.
  const e = k.eaves;
  for (let level = 1; level < k.storeys; level++) {
    const y = k.levelY(level);
    k.box(-1, w - 0.25, y + 0.3, d - 0.1, w + 0.05, y + 2.9, d + 0.55, 'sign', { layer: 'shell', tint: signs[level], solid: false });
  }
  k.box(-1, w - 0.2, k.levelY(1), d - 0.1, w - 0.05, e, d + 0.5, 'steel', { layer: 'shell', solid: false });
  k.roofFlat({ mat: 'concrete', tint });
  coreRoof(k, c, { tint, doorX: (c.hall[0] + c.hall[2]) / 2 });
  const roof = ringRooms(k, k.storeys, [t, t, w - t, d - t], [c.x0 - 0.1, c.z0 - 0.1, c.x1 + 0.1, c.z1 + 0.1], 'roof');
  roofPlant(f, roof.all, { tank: false, units: 2 });
  for (const r of roof.all) f.ensure(r, 'crate', 'roof');
  // The billboard: two posts at the front edge, the board over the parapet (drawn only).
  for (const x of [t + 0.4, w - t - 0.55]) k.box(-1, x, e, d - 0.22, x + 0.15, e + 4.1, d - 0.07, 'steel', { layer: 'shell' });
  k.box(-1, t + 0.2, e + 1.6, d - 0.07, w - t - 0.2, e + 4.1, d + 0.03, 'sign', { layer: 'shell', tint: k.rand(), solid: false });
}
