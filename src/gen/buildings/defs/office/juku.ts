// 塾の入ったビル (07d-2c): a four-storey cram-school building. The stair strip runs up the right wall;
// on the left, the reception and the parents' waiting area on the ground floor (behind it the
// self-study room with its booths), two classrooms on each of the first and second floors, a
// classroom and the teachers' room at the top. Banners with exam slogans hang down the front,
// the school's name stands on the roof.
//
//   +----------------+-----+
//   | classroom      |stair|
//   |                |     |
//   +----------------+  - -+
//   | classroom      D hall|
//   |                |     |
//   +================+-[D]-+

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { classroom, flightDepth, meeting, officeDesks, P, roofPlant, stripRoof, stripStair, SW, twoPass, waiting, type Fit } from './common.ts';

export const OFFICE_JUKU: BuildingDef = {
  id: 'office.juku',
  category: 'office',
  variant: 'juku',
  kind: 'office',
  size: { w: [10, 13], d: [14, 17] },
  storeys: 4,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 3.6,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_JUKU, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = ARCH.wall.concrete;
  k.thick = t;
  const tint = k.rand();
  const brand = k.rand();
  const L = flightDepth(k.def.storeyHeight);
  const xs = w - t - SW;
  const xp = xs - P;
  const zs = t + L;
  const zm = Math.max(zs + 1.8, d * 0.5);
  const top = k.storeys - 1;

  for (let level = 0; level < k.storeys; level++) {
    const ground = level === 0;
    const rw = xp - P - t;
    k.outerWalls(level, {
      mat: 'concrete', tint, parapet: level === top ? ARCH.rail.parapet : 0,
      front: ground
        ? [k.window(t + rw / 2, rw - 1.2, { sill: 0.3, head: 2.6, broken: k.rand() < 0.3 }), k.door(xs + SW / 2, 'open', 1.6)]
        : [...k.evenly(t, xp - P, 2).map((x) => k.window(x, rw / 2 - 0.7, { broken: k.rand() < 0.2 })), k.window(xs + SW / 2, 1.0, { sill: 1.1 })],
      back: k.evenly(t, xp - P, 2).map((x) => k.window(x, rw / 2 - 0.9)),
      left: [k.window(zm / 2 - t, 1.8), k.window((zm + d) / 2 - t, 1.8)],
    });
    k.floor(level, ground ? 'tileFloor' : 'vinyl');
    stripStair(k, level, 'right', t, zs, { tint });
    const hall = k.room(level, xs, zs, w - t, d - t, ground ? 'lobby' : 'hall');
    const lockB = level > 0 && k.rand() < 0.25;
    k.partition(level, xp, t, xp, d - t, [k.door(zs + 0.8 - t, lockB ? 'locked' : 'open'), k.door((zm + d - t) / 2 - t, 'open', ground ? 1.6 : 0.9)]);
    k.partition(level, t, zm, xp - P, zm);
    const back = k.room(level, t, t, xp - P, zm - P, ground ? 'classroom' : level === top ? 'office' : 'classroom', { locked: lockB });
    const front = k.room(level, t, zm + P, xp - P, d - t, ground ? 'office' : 'classroom');
    if (ground) {
      // Reception counter and the parents' benches; the self-study booths behind.
      f.row(front, 'z-', 3.0, 0.6, 1.05, 'counter', { kind: 'counter', table: 'office', max: 1, tint: brand });
      waiting(f, front, 'office');
      f.grid(back, 0.9, 0.7, 0.25, 1.2, (r) => {
        const ok = f.put(back, r, 0.75, 'wood', { tint: 0.6, search: f.has(back) ? undefined : { kind: 'desk', face: 'z+', table: 'classroom' } });
        if (ok) f.deco(back, [r[0] - 0.04, r[1], r[0], r[3]], 1.3, 'wood', 0.6); // booth side panel
        return ok;
      });
      f.ensure(back, 'desk', 'classroom');
    } else {
      classroom(f, front, 'x-');
      if (!lockB) {
        if (level === top) {
          officeDesks(f, back, { tint: 0.3, dense: true });
          meeting(f, back);
          f.ensure(back, 'desk', 'office');
        } else classroom(f, back, 'x-');
      }
    }
    if (f.chance(0.35)) f.stain(hall);
  }

  // Roof: the stair house, the school's name on a frame, the plant; banners down the front.
  const roof = stripRoof(k, 'right', t, xs, zs, zs + 2.0, { tint });
  roofPlant(f, roof.all, { units: 2, tank: false });
  for (const r of roof.all) f.ensure(r, 'crate', 'roof');
  const e = k.eaves;
  for (const x of [t + 0.5, xp - 1.0]) k.box(-1, x, e, d - 0.22, x + 0.15, e + 3.5, d - 0.07, 'steel', { layer: 'shell' });
  k.box(-1, t + 0.2, e + 2.0, d - 0.07, xp - 0.6, e + 3.5, d + 0.03, 'sign', { layer: 'shell', tint: brand, solid: false });
  for (const x of [0.6, (xp - P) / 2 + 0.3]) {
    k.box(-1, x, k.levelY(1) + 0.2, d, x + 0.9, k.eaves - 0.3, d + 0.05, 'paper', { layer: 'shell', solid: false });
    k.box(-1, x + 0.1, k.eaves - 1.6, d + 0.05, x + 0.8, k.eaves - 0.5, d + 0.07, 'sign', { layer: 'shell', tint: 0.6, solid: false });
  }
}
