// RC 5 階の団地・階段室型 (07d-2a). A five-storey concrete block of the public-housing kind: one
// stair hall in the middle entered from the front, two flats on every landing (doors facing each
// other across the hall), balconies along the back, a water tank on the roof, a bicycle shed and the
// garbage cage in front. About half the flats are locked.
//
//   plan (every floor)
//   +--------------+------+--------------+   back: balconies (z = 0)
//   | back room    |  ↕   |   back room  |
//   +-D------------+ stair+------------D-+
//   | DK  (strip)  |  ↕   |  (strip)  DK |
//   |              | hall |              |
//   +-D-------+--- D      D ---+-------D-+
//   | front rm|bath|      |bath| front rm|
//   +---------+----+--D---+----+---------+   front (z = d): the entrance (ground), windows above

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Hole } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { hedge, P, ring } from '../house/common.ts';
import { unit } from './unit.ts';

export const APARTMENT_DANCHI5: BuildingDef = {
  id: 'apartment.danchi5',
  category: 'apartment',
  variant: 'danchi5',
  kind: 'apartment',
  size: { w: [14.5, 17], d: [11, 13] },
  storeys: 5,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 2.3,
  lootable: true,
  generate(rng, params) {
    const k = createKit(APARTMENT_DANCHI5, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const zb = 1.2; // balconies | block
    const D = d - 1.6; // block | front yard
    const cx = w / 2;
    const xc0 = cx - 1.05 - P; // west flat | stair hall (centre line)
    const xc1 = cx + 1.05 + P;
    const zs = D - t - 3.2; // the line the stair starts from
    const U = D - t - (zb + t);
    const doorZ = D - t - 2.4;
    const tint = k.rand();
    const top = k.storeys - 1;
    const steel = { layer: 'shell' as const, tint: 0.4 };

    for (let level = 0; level < k.storeys; level++) {
      const fy = k.levelY(level);
      const ground = level === 0;
      const front: Hole[] = [ground ? k.door(cx, 'open', 1.2) : k.window(cx, 1.0, { sill: 1.0 })];
      const back: Hole[] = [];
      for (const side of [0, 1] as const) {
        const V = side === 0 ? xc0 - P - t : w - t - xc1 - P;
        const ox = side === 0 ? xc0 - P : xc1 + P;
        const sign = side === 0 ? -1 : 1;
        const locked = !(ground && side === 0) && !(level === top && side === 1) && k.rand() < 0.5;
        unit(k, { level, origin: [ox, D - t], eu: 'z-', ev: side === 0 ? 'x-' : 'x+', U, V, locked, tatami: k.rand() < 0.5 });
        const room = ox + sign * (2.3 + V) / 2;
        front.push(k.window(room, Math.min(2.4, V - 2.8), { sill: 0.8, broken: k.rand() < 0.25 }));
        back.push(k.window(room, Math.min(2.4, V - 2.8), { sill: 0.1, head: 2.1, broken: k.rand() < 0.25 }));
        back.push(k.window(ox + sign * 1.15, 1.0, { sill: 1.0 }));
        k.partition(level, side === 0 ? xc0 : xc1, zb + t, side === 0 ? xc0 : xc1, D - t, [k.door(doorZ - (zb + t), locked ? 'locked' : 'open')], { mat: 'concrete', tint });
      }
      k.floor(level, ground ? 'concrete' : 'vinyl', [t, zb + t, w - t, D - t]);
      ring(k, level, [0, zb, w, D], { mat: 'concrete', tint, front, back, y1: level === top ? k.eaves + 0.8 : undefined });
      k.room(level, cx - 1.05, zs, cx + 1.05, D - t, ground ? 'lobby' : 'hall');
      if (level < top) k.stairs({ level, start: [cx - 0.525, zs], dir: 'z-', width: 0.9, kind: 'switchback', turn: 'right', mat: 'concrete', tint });
      if (!ground) {
        k.box(-1, 0.1, fy - 0.2, 0, w - 0.1, fy, zb, 'concrete', { layer: 'shell', tint });
        k.box(-1, 0.1, fy, 0, w - 0.1, fy + 1.0, 0.12, 'concrete', { layer: 'shell', tint });
      }
      if (k.rand() < 0.3) k.stain(level, cx - 0.8, zs + 0.8, cx + 0.4, zs + 1.8);
    }
    k.box(top, cx - 1.05, k.levelY(top), zs - 0.06, cx, k.levelY(top) + ARCH.rail.height, zs, 'steel', steel);

    // Roof: slab, a water tank on legs over the stair hall.
    const e = k.eaves;
    k.floor(k.storeys, 'concrete', [t, zb + t, w - t, D - t], { tint: 0.5 });
    for (const [x, z] of [[cx - 1.2, zs - 2.5], [cx + 1.0, zs - 2.5], [cx - 1.2, zs - 0.7], [cx + 1.0, zs - 0.7]] as const) k.box(-1, x, e, z, x + 0.2, e + 0.9, z + 0.2, 'steel', steel);
    k.box(-1, cx - 1.4, e + 0.9, zs - 2.7, cx + 1.4, e + 2.2, zs - 0.3, 'concrete', { layer: 'shell', tint: 0.9 });

    // Front yard: mailboxes by the entrance, a bicycle shed, the garbage cage; a hedge behind.
    k.box(-1, cx + 0.8, 0.6, D, cx + 1.8, 1.5, D + 0.3, 'steel', steel);
    const shed1 = Math.max(1.5, xc0 - 1.2);
    for (const x of [0.4, shed1 - 0.1]) k.box(-1, x, -0.5, D + 0.3, x + 0.1, 2.2, D + 0.4, 'steel', steel);
    k.box(-1, 0.3, 2.2, D + 0.2, shed1, 2.26, d - 0.1, 'metalRoof', { layer: 'shell', solid: false, tint: 0.66 });
    for (let x = 0.8; x < shed1 - 0.4; x += 0.7) k.box(-1, x, 0, D + 0.5, x + 0.06, 1.0, d - 0.2, 'steel', { layer: 'shell', tint: k.rand(), role: 'furniture' });
    k.box(-1, xc1 + 1.0, 0, D + 0.3, Math.min(w - 0.3, xc1 + 2.8), 1.2, d - 0.1, 'steel', { layer: 'shell', tint: 0.66 });
    hedge(k, 0.3, 0.2, w - 0.3, 0.8, 0.6);
    return k.finish();
  },
};
