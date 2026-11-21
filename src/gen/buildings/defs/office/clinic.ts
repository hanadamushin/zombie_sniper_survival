// 診療所ビル (07d-2c): a four-storey clinic building. The stair strip runs up the left wall (its hall
// is the entrance on the ground floor); on the right, one practice per floor: the dispensing
// pharmacy on the ground floor (shop in front with its own door, dispensary behind), the GP on the
// first (waiting room in front, two consulting rooms behind), the dentist on the second (waiting
// room, the surgery with its chairs in a row), rehabilitation and tests on the top floor. A green
// cross on the roof and a column of practice signs down the front.
//
//   +-----+---------+---------+
//   |stair| exam 1  | exam 2  |     ground floor: dispensary | pharmacy (street door)
//   |     +----D----+----D----+
//   +-  --+                   |
//   |hall D   waiting room    |
//   |     |                   |
//   +-[D]-+===================+

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { clinicRoom, flightDepth, P, roofPlant, salesFloor, storeRoom, stripRoof, stripStair, SW, twoPass, waiting, type Fit } from './common.ts';

export const OFFICE_CLINIC: BuildingDef = {
  id: 'office.clinic',
  category: 'office',
  variant: 'clinic',
  kind: 'office',
  size: { w: [11, 14], d: [13, 16] },
  storeys: 4,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 4.0,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_CLINIC, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = ARCH.wall.concrete;
  k.thick = t;
  const tint = k.rand();
  const L = flightDepth(k.def.storeyHeight);
  const xs = t + SW;
  const xp = xs + P;
  const zs = t + L;
  const zm = Math.max(zs + 1.6, d * 0.42); // back rooms | front room
  const xe = (xp + P + w - t) / 2; // exam 1 | exam 2
  const top = k.storeys - 1;

  for (let level = 0; level < k.storeys; level++) {
    const ground = level === 0;
    const rw = w - t - xp - P;
    k.outerWalls(level, {
      mat: 'plaster', tint: 0.1, parapet: level === top ? ARCH.rail.parapet : 0,
      front: ground
        ? [k.door(t + SW / 2, 'open', 1.6), k.door(xp + P + 1.0, 'open', 1.0), k.window(xp + P + 1.6 + (rw - 1.6) / 2, rw - 2.4, { sill: 0.4, head: 2.6, broken: k.rand() < 0.3 })]
        : [k.window(t + SW / 2, 1.0, { sill: 1.1 }), ...k.evenly(xp + P, w - t, 2).map((x) => k.window(x, rw / 2 - 0.8, { broken: k.rand() < 0.15 }))],
      back: [k.window((xp + P + xe) / 2, 1.2, { sill: 1.2 }), k.window((xe + w - t) / 2, 1.2, { sill: 1.2 })],
      right: [k.window((zm + d - t) / 2 - t, 1.6)],
    });
    k.floor(level, ground ? 'tileFloor' : 'vinyl');
    stripStair(k, level, 'left', t, zs, { tint });
    const hall = k.room(level, t, zs, xs, d - t, ground ? 'lobby' : 'hall');
    k.partition(level, xp, t, xp, d - t, [k.door(zs + 0.8 - t, ground ? 'locked' : 'open'), k.door((zm + d - t) / 2 - t, 'open', 1.2)]);
    k.partition(level, xp + P, zm, w - t, zm, level === 1 ? [k.door((xp + P + xe) / 2 - xp - P), k.door((xe + w - t) / 2 - xp - P)] : [k.door(1.0)]);
    const front = k.room(level, xp + P, zm + P, w - t, d - t, ground ? 'sales' : 'clinic');
    if (ground) {
      // Dispensing pharmacy: shelves, the counter in front of the dispensary.
      salesFloor(f, front, { tables: ['pharmacy', 'sales'], tint: 0.4, along: 'z' });
      const disp = k.room(0, xp + P, t, w - t, zm - P, 'storage');
      storeRoom(f, disp, 'pharmacy');
      f.row(hall, 'x-', 0.5, 0.3, 1.4, 'steel', { kind: 'cabinet', table: 'lobby', max: 1, tint: 0.3 });
      continue;
    }
    waiting(f, front, 'clinic');
    f.row(front, 'z-', 2.4, 0.6, 1.05, 'counter', { kind: 'counter', table: 'pharmacy', max: 1, tint: 0.9 });
    if (level === 1) {
      k.partition(1, xe, t, xe, zm - P);
      for (const r of [k.room(1, xp + P, t, xe - P, zm - P, 'clinic'), k.room(1, xe + P, t, w - t, zm - P, 'clinic')]) clinicRoom(f, r);
    } else if (level === 2) {
      // The dentist's surgery: chairs in a row along the back wall, a lamp over each.
      const r = k.room(2, xp + P, t, w - t, zm - P, 'clinic');
      f.row(r, 'z-', 0.8, 1.9, 0.6, 'fabric', { kind: 'bed', table: 'clinic', every: 2, max: 3, gap: 1.2, tint: 0.3 });
      f.row(r, 'x+', 0.9, 0.45, 1.8, 'steel', { kind: 'cabinet', table: 'pharmacy', max: 1, tint: 0.95 });
      f.ensure(r, 'cabinet', 'clinic');
    } else {
      const r = k.room(level, xp + P, t, w - t, zm - P, 'lab', { locked: k.rand() < 0.3 });
      if (!k.roomById(r).locked) {
        clinicRoom(f, r);
        f.ensure(r, 'cabinet', 'lab');
      }
    }
    if (f.chance(0.5)) f.stain(front);
  }

  // Roof: stair house, plant, the green cross on a frame; the practice signs down the front.
  const roof = stripRoof(k, 'left', t, xs, zs, zs + 2.0, { tint: 0.1, mat: 'plaster' });
  roofPlant(f, roof.all, { units: 2 });
  for (const r of roof.all) f.ensure(r, 'crate', 'roof');
  const e = k.eaves;
  const cx = w - 2.0;
  k.box(-1, cx - 0.1, e, d - 0.25, cx + 0.1, e + 2.0, d - 0.1, 'steel', { layer: 'shell' });
  k.box(-1, cx - 1.0, e + 2.3, d - 0.12, cx + 1.0, e + 2.9, d, 'sign', { layer: 'shell', tint: 0.1, solid: false });
  k.box(-1, cx - 0.3, e + 1.6, d - 0.12, cx + 0.3, e + 3.6, d, 'sign', { layer: 'shell', tint: 0.1, solid: false });
  for (let level = 1; level < k.storeys; level++) {
    const y = k.levelY(level);
    k.box(-1, w - 0.4, y + 0.4, d, w - 0.05, y + 2.8, d + 0.5, 'sign', { layer: 'shell', tint: level / k.storeys, solid: false });
  }
}
