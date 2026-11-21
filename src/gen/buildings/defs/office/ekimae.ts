// 駅前ビル (07d-2c): a five-storey block of tenants in front of a station. The core (stair, a dead
// lift, the toilets) sits in the middle of the back wall; in front of it each floor has a small
// lift hall, with a tenant on either side. Ground floor: the entrance hall through to the core, a
// shuttered shop on one side and a beef-bowl shop on the other (its own door from the street).
// First floor: a loan office and an English school. Second and third: karaoke — a corridor down
// each side and the boxes off it. Top floor: an izakaya (kitchen and dining room). Big vertical
// signs on both front corners, a billboard on the roof.
//
//   +-------+---------+-------+
//   |       |  core   |       |     karaoke floors:  +--+---------+--+
//   | left  +---D-----+ right |                      |  |c        |  |  boxes | corridor
//   |       |  hall   |       |                      |  |o  hall   |  |
//   |       D         D       |                      |  |r         |  |
//   +=======+--[D]----+=======+                      +--+---------+--+

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit, Rect } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { canteen, classroom, coreAt, coreLevel, coreRoof, curtain, karaoke, kitchen, officeDesks, P, ringRooms, roofPlant, SW, spaced, storeRoom, twoPass, type Fit } from './common.ts';

export const OFFICE_EKIMAE: BuildingDef = {
  id: 'office.ekimae',
  category: 'office',
  variant: 'ekimae',
  kind: 'office',
  size: { w: [16, 20], d: [14, 18] },
  storeys: 5,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 4.6,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_EKIMAE, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = ARCH.wall.concrete;
  k.thick = t;
  const tint = k.rand();
  const coreW = SW + 2.0 + 1.8 + 6 * 2 * P;
  const c = coreAt(k, (w - coreW) / 2, t + P, { shafts: 1, wc: true, hall: 2.0 });
  const xl = c.x0; // left tenant | hall
  const xr = c.x1; // hall | right tenant
  const zh = (c.z1 + d - t) / 2; // the doors off the hall
  const y1 = k.levelY(1);
  const signs = [k.rand(), k.rand()];

  // ---- Outside: the ground floor's walls, the curtain of the upper floors, the blank back.
  k.outerWalls(0, {
    mat: 'concrete', tint, y1,
    front: [
      k.window((t + xl) / 2, xl - t - 1.2, { sill: 0.3, head: 2.9, broken: k.rand() < 0.4 }),
      k.door((xl + xr) / 2, 'open', ARCH.door.wide),
      k.door(xr + 1.2, 'open', 1.0),
      k.window((xr + 2.0 + w - t) / 2, w - t - xr - 2.6, { sill: 0.3, head: 2.9, broken: k.rand() < 0.3 }),
    ],
    back: [k.door(c.x1 + 1.6, 'locked')],
  });
  const yTop = k.eaves + ARCH.rail.parapet;
  curtain(k, { side: 'front', from: 1, to: k.storeys, y1: yTop, t, mat: 'concrete', tint, sill: 0.9, drop: 0.5, piers: [0.3, xl, xr, w - 0.3], pier: 0.6, broken: [[1 + Math.floor(k.rand() * 4), xl, xr]] });
  for (const side of ['left', 'right'] as const) curtain(k, { side, from: 1, to: k.storeys, y1: yTop, t, mat: 'concrete', tint, sill: 1.0, drop: 0.7, piers: spaced(t + 1.0, d - t - 1.0, 2.2), pier: 1.0 });
  k.box(-1, 0, y1, 0, w, yTop, t, 'concrete', { layer: 'shell', tint });
  // The vertical signs on the front corners (drawn only), the shop's awning.
  for (const [x, s] of [[0.05, signs[0]!], [w - 0.45, signs[1]!]] as const) k.box(-1, x, y1, d, x + 0.4, k.eaves - 0.5, d + 0.55, 'sign', { layer: 'shell', tint: s, solid: false });
  k.box(-1, xr + 0.2, k.levelY(0) + 2.7, d, w - 0.5, k.levelY(0) + 3.2, d + 0.6, 'sign', { layer: 'shell', tint: 0.6, solid: false });

  for (let level = 0; level < k.storeys; level++) {
    const ground = level === 0;
    k.floor(level, ground ? 'tileFloor' : level === 2 || level === 3 ? 'carpet' : 'vinyl');
    const { wc } = coreLevel(k, level, c, { front: [{ x: (c.x0 + c.x1) / 2, state: 'open', width: ground ? 1.6 : 1.2 }], tint, wcOpen: true });
    if (wc >= 0) {
      f.row(wc, 'z-', 0.6, 0.5, 0.85, 'appliance', { kind: 'cabinet', table: 'toilet', max: 1, tint: 0.9 });
      f.ensure(wc, 'cabinet', 'toilet');
    }
    const hall = k.room(level, xl + P, c.z1 + P, xr - P, d - t, ground ? 'lobby' : 'hall');
    if (ground) f.row(hall, 'x-', 0.6, 0.3, 1.4, 'steel', { kind: 'cabinet', table: 'lobby', max: 1, tint: 0.3 });
    if (f.chance(0.4)) f.stain(hall);
    const left: Rect = [t, t, xl - P, d - t];
    const right: Rect = [xr + P, t, w - t, d - t];
    if (level === 2 || level === 3) {
      boxes(k, f, level, left, 'left', zh);
      boxes(k, f, level, right, 'right', zh);
      continue;
    }
    const lockL = ground || (level > 1 && k.rand() < 0.25);
    k.partition(level, xl, t, xl, d - t, [k.door(zh - t, lockL ? 'locked' : 'open')]);
    k.partition(level, xr, t, xr, d - t, [k.door(zh - t, ground ? 'locked' : 'open')]);
    if (ground) {
      k.room(0, ...left, 'sales', { locked: true });
      // The beef-bowl shop: the counter, the kitchen at the back.
      const zk = t + 3.2;
      k.partition(0, right[0], zk, right[2], zk, [k.door(1.0)]);
      const kit = k.room(0, right[0], t, right[2], zk - P, 'kitchen');
      const shop = k.room(0, right[0], zk + P, right[2], d - t, 'canteen');
      kitchen(f, kit);
      canteen(f, shop, { tint: 0.95 });
      continue;
    }
    if (level === 1) {
      const loan = k.room(1, ...left, 'office', { locked: lockL });
      const school = k.room(1, ...right, 'classroom');
      if (!lockL) {
        officeDesks(f, loan, { tint: 0.2 });
        f.row(loan, 'z+', 2.4, 0.6, 1.05, 'counter', { kind: 'counter', table: 'office', max: 1 });
        f.ensure(loan, 'desk', 'office');
      }
      classroom(f, school, 'z-');
      continue;
    }
    // Top floor: the izakaya — dining on the left, its kitchen and store on the right.
    const dining = k.room(level, ...left, 'canteen', { locked: lockL });
    if (!lockL) {
      canteen(f, dining, { tint: 0.3, counter: false });
      f.stain(dining);
    }
    const zk = (t + d - t) / 2;
    k.partition(level, right[0], zk, right[2], zk, [k.door((right[2] - right[0]) / 2)]);
    const store = k.room(level, right[0], t, right[2], zk - P, 'storage');
    const kit = k.room(level, right[0], zk + P, right[2], d - t, 'kitchen');
    storeRoom(f, store, 'grocery');
    kitchen(f, kit);
  }

  // ---- Roof: the core's stair house, the billboard, the plant.
  k.roofFlat({ mat: 'concrete', tint });
  coreRoof(k, c, { tint });
  const roof = ringRooms(k, k.storeys, [t, t, w - t, d - t], [c.x0 - 0.1, c.z0 - 0.1, c.x1 + 0.1, c.z1 + 0.1], 'roof');
  roofPlant(f, roof.all, { units: 3 });
  for (const r of roof.all) f.ensure(r, 'crate', 'roof');
  const e = k.eaves;
  for (const x of [1.0, w / 2 - 0.1, w - 1.2]) k.box(-1, x, e, d - 0.22, x + 0.2, e + 4.5, d - 0.07, 'steel', { layer: 'shell' });
  k.box(-1, 0.6, e + 1.8, d - 0.07, w - 0.6, e + 4.5, d + 0.05, 'sign', { layer: 'shell', tint: k.rand(), solid: false });
}

/** A karaoke floor's side: a corridor along the hall's wall, the boxes off it. */
function boxes(k: Kit, f: Fit, level: number, r: Rect, side: 'left' | 'right', zh: number): void {
  const cw = 1.3;
  const t = r[1];
  const xc = side === 'left' ? r[2] - cw - P : r[0] + cw + P; // corridor's partition
  if (side === 'left') k.room(level, xc + P, r[1], r[2], r[3], 'hall');
  else k.room(level, r[0], r[1], xc - P, r[3], 'hall');
  const xw = side === 'left' ? r[2] + P : r[0] - P; // the hall's wall
  k.partition(level, xw, t, xw, r[3], [k.door(zh - t)]);
  const n = Math.max(2, Math.floor((r[3] - r[1]) / 2.8));
  const step = (r[3] - r[1]) / n;
  const doors = [];
  for (let i = 0; i < n; i++) {
    const z0 = r[1] + i * step;
    const z1 = z0 + step;
    const locked = k.rand() < 0.35;
    doors.push(k.door(z0 + step / 2 - t, locked ? 'locked' : 'open'));
    if (i > 0 && side === 'left') k.partition(level, r[0], z0, xc - P, z0);
    else if (i > 0) k.partition(level, xc + P, z0, r[2], z0);
    const room = side === 'left'
      ? k.room(level, r[0], z0 + (i > 0 ? P : 0), xc - P, z1 - (i < n - 1 ? P : 0), 'bar', { locked })
      : k.room(level, xc + P, z0 + (i > 0 ? P : 0), r[2], z1 - (i < n - 1 ? P : 0), 'bar', { locked });
    if (!locked) {
      karaoke(f, room);
      if (f.chance(0.25)) f.stain(room);
    }
  }
  k.partition(level, xc, t, xc, r[3], doors);
}
