// RC 8 階のマンション・内廊下 (07d-2a). An eight-storey concrete block with an inner corridor: the
// stair in a core at the west end folds back on itself from the corridor, the lift beside it is an
// empty shaft behind a jammed steel door, two flats along the back and three along the front (the
// middle one on the ground floor is the entrance lobby). Balconies along the front. About half the
// flats are locked.
//
//   plan (every floor)
//   +-----+----+-------------+-------------+
//   |stair|lift|  flat       |  flat       |   back (z = 0)
//   | ↕   |[X] |             |             |
//   +     +-X--+------D------+------D------+
//   |  corridor                            |
//   +-----D-------+-----D-------+-----D-----+
//   |  flat       | flat / lobby|  flat     |
//   +-------------+------D------+-----------+   front: balconies; the entrance (ground)

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Hole } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { hedge, P, ring } from '../house/common.ts';
import { unit } from './unit.ts';

export const APARTMENT_MANSION8: BuildingDef = {
  id: 'apartment.mansion8',
  category: 'apartment',
  variant: 'mansion8',
  kind: 'apartment',
  size: { w: [18, 22], d: [16, 19] },
  storeys: 8,
  storeyHeight: 3.0,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 2.4,
  lootable: true,
  generate(rng, params) {
    const k = createKit(APARTMENT_MANSION8, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const D = d - 1.3; // block | balconies
    const zc0 = t + 6.0; // back flats | corridor (centre line)
    const zc1 = zc0 + 1.72; // corridor | front flats
    const xs = t + 2.1 + P; // stair core | lift shaft
    const xl = xs + 2.0; // lift shaft | back flats
    const xbm = (xl + w - t) / 2; // between the back flats
    const cellF = (w - 2 * t) / 3;
    const tint = k.rand();
    const top = k.storeys - 1;
    const laneA = t + 0.525;
    const steel = { layer: 'shell' as const, tint: 0.4 };

    k.shaft([xs + P, zc0 - 2.2 + P, xl - P, zc0 - P], 0, top);
    for (let level = 0; level < k.storeys; level++) {
      const fy = k.levelY(level);
      const ground = level === 0;
      const front: Hole[] = [];
      const back: Hole[] = [];
      const backDoors: Hole[] = [];
      const frontDoors: Hole[] = [];
      const lift = k.door(1.0, 'locked');
      lift.leaf = 'doorSteel';
      backDoors.push(lift);
      // Back flats.
      for (const i of [0, 1]) {
        const xa = i === 0 ? xl + P : xbm + P;
        const xb = i === 0 ? xbm - P : w - t;
        const mirror = i === 0;
        const locked = k.rand() < 0.5;
        const plan = unit(k, { level, origin: [mirror ? xb : xa, zc0 - P], eu: mirror ? 'x-' : 'x+', ev: 'z-', U: xb - xa, V: zc0 - P - t, locked, tatami: k.rand() < 0.3 });
        backDoors.push(k.door(plan.door[0] - xs, locked ? 'locked' : 'open'));
        back.push(k.window(plan.far[0], xb - xa - 1.2, { sill: 0.8, broken: k.rand() < 0.2 }));
      }
      // Front flats (the middle one on the ground floor is the lobby).
      for (const i of [0, 1, 2]) {
        const xa = t + i * cellF + (i > 0 ? P : 0);
        const xb = t + (i + 1) * cellF - (i < 2 ? P : 0);
        if (ground && i === 1) {
          k.room(0, xa, zc1 + P, xb, D - t, 'lobby');
          frontDoors.push(k.door((xa + xb) / 2 - t, 'open', ARCH.door.wide));
          front.push(k.door((xa + xb) / 2, 'open', ARCH.door.wide));
          k.furniture(0, xb - 0.4, zc1 + 1.2, xb, D - t - 1.6, 1.4, 'steel', { tint: 0.4, search: { kind: 'locker', face: 'x-', table: 'lobby' } }); // mailboxes
          continue;
        }
        const mirror = i === 2;
        const locked = k.rand() < 0.5;
        const plan = unit(k, { level, origin: [mirror ? xb : xa, zc1 + P], eu: mirror ? 'x-' : 'x+', ev: 'z+', U: xb - xa, V: D - t - zc1 - P, locked });
        frontDoors.push(k.door(plan.door[0] - t, locked ? 'locked' : 'open'));
        front.push(k.window(plan.far[0], xb - xa - 1.2, { sill: 0.1, head: 2.1, broken: k.rand() < 0.25 }));
      }
      k.floor(level, ground ? 'tileFloor' : 'vinyl', [t, t, w - t, D - t]);
      ring(k, level, [0, 0, w, D], { mat: 'concrete', tint, front, back, right: ground ? [k.window((zc0 + zc1) / 2, 1.0, { sill: 1.0 })] : [], y1: level === top ? k.eaves + ARCH.rail.parapet : undefined });
      const pc = { mat: 'concrete' as const, tint };
      k.partition(level, xs, zc0, w - t, zc0, backDoors, pc);
      k.partition(level, t, zc1, w - t, zc1, frontDoors, pc);
      k.partition(level, xs, t, xs, zc0, [], pc);
      k.partition(level, xl, t, xl, zc0, [], pc);
      k.partition(level, xs, zc0 - 2.2, xl, zc0 - 2.2, [], pc);
      k.partition(level, xbm, t, xbm, zc0, [], pc);
      for (const i of [1, 2]) k.partition(level, t + i * cellF, zc1, t + i * cellF, D - t, [], pc);
      k.room(level, t, zc0 + P, w - t, zc1 - P, ground ? 'lobby' : 'hall');
      if (level < top) k.stairs({ level, start: [laneA, zc0], dir: 'z-', width: 0.9, kind: 'switchback', turn: 'right', mat: 'concrete', tint });
      if (!ground) {
        k.box(-1, 0.1, fy - 0.2, D, w - 0.1, fy, d - 0.05, 'concrete', { layer: 'shell', tint });
        k.box(-1, 0.1, fy, d - 0.17, w - 0.1, fy + 1.1, d - 0.05, 'glass', { layer: 'shell' });
      }
      if (k.rand() < 0.3) k.stain(level, xl + 0.5, zc0 + 0.3, xl + 1.8, zc1 - 0.3);
    }
    k.box(top, t, k.levelY(top), zc0 - 0.06, t + 1.0, k.levelY(top) + ARCH.rail.height, zc0, 'steel', steel);

    // Roof: slab, the lift's machine room over the shaft.
    const e = k.eaves;
    k.floor(k.storeys, 'concrete', [t, t, w - t, D - t], { tint: 0.5 });
    k.box(-1, xs - 0.2, e, zc0 - 2.6, xl + 0.2, e + 2.3, zc0, 'concrete', { layer: 'shell', tint });
    // Entrance canopy, planting along the front.
    const cx = w / 2;
    k.part({ shape: 'wedge', x0: cx - 2.0, x1: cx + 2.0, z0: D, z1: D + 1.2, y0: k.levelY(1) - 0.6, y1: k.levelY(1) - 0.35, slope: 'z-', mat: 'concrete', tint, solid: false });
    hedge(k, 0.3, D + 0.3, cx - 1.6, d - 0.2, 0.7);
    hedge(k, cx + 1.6, D + 0.3, w - 0.3, d - 0.2, 0.7);
    return k.finish();
  },
};
