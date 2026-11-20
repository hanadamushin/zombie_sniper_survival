// 社宅 (07d-2a). A four-storey concrete company-housing block: three family flats a floor along
// open corridors at the front, a concrete stair tower standing out in the middle of the front (the
// stair folds back inside it), balconies at the back. On the ground floor the middle flat is the
// meeting room (集会所). Bicycles and the garbage cage beside the tower. About half the flats are locked.
//
//   plan (every floor)
//   +-----------+-----------+-----------+   balconies (z = 0)
//   | 2 rooms   | 2 rooms / | 2 rooms   |
//   |           | 集会所     |           |
//   | bath|kit  |           |  kit|bath |
//   +-----D-----+-----D-----+-----D-----+
//   ====corridor=====+ ↕ ↕ +=============   railing (upper floors) / low wall + gates (ground)
//                    |tower|
//                    +-----+                front (z = d)

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Hole } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, ring } from '../house/common.ts';
import { unit } from './unit.ts';

export const APARTMENT_SHATAKU: BuildingDef = {
  id: 'apartment.shataku',
  category: 'apartment',
  variant: 'shataku',
  kind: 'apartment',
  size: { w: [20, 25], d: [13, 14.5] },
  storeys: 4,
  storeyHeight: 3.0,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 1.2,
  lootable: true,
  generate(rng, params) {
    const k = createKit(APARTMENT_SHATAKU, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const zb = 1.0; // balconies | block
    const Dz = d - 4.9; // block | corridor
    const zc = Dz + 1.24; // the corridor's front edge
    const zt = Dz + 1.3; // corridor | stair tower
    const cx = w / 2;
    const tx0 = cx - 1.3;
    const tx1 = cx + 1.3;
    const cell = (w - 2 * t) / 3;
    const tint = k.rand();
    const top = k.storeys - 1;
    const steel = { layer: 'shell' as const, tint: 0.4 };
    const concrete = { layer: 'shell' as const, tint };

    for (let level = 0; level < k.storeys; level++) {
      const fy = k.levelY(level);
      const ground = level === 0;
      const front: Hole[] = [];
      const back: Hole[] = [];
      for (let i = 0; i < 3; i++) {
        const xa = t + i * cell + (i > 0 ? P : 0);
        const xb = t + (i + 1) * cell - (i < 2 ? P : 0);
        if (ground && i === 1) {
          // 集会所: folding tables, stacked chairs, a cupboard.
          k.room(0, xa, zb + t, xb, Dz - t, 'office');
          front.push(k.door((xa + xb) / 2, 'open', 1.6), k.window(xb - 1.0, 1.2, { sill: 0.9 }));
          back.push(k.window((xa + xb) / 2, xb - xa - 1.6, { sill: 0.9 }));
          k.furniture(0, xa + 1.0, zb + 1.6, xb - 1.0, zb + 2.4, 0.72, 'wood', { tint: 0.9, search: { kind: 'table', face: 'z-', table: 'office' } });
          k.furniture(0, xa, zb + t, xa + 0.6, zb + 2.0, 1.8, 'wood', { tint: 0.5, search: { kind: 'cabinet', face: 'x+', table: 'office' } });
          k.furniture(0, xb - 1.0, zb + t, xb, zb + 0.8, 1.2, 'steel', { tint: 0.4, solid: true });
        } else {
          const mirror = i === 2;
          const locked = !(level === top && i === 0) && !(ground && i === 0) && k.rand() < 0.5;
          const plan = unit(k, { level, origin: [mirror ? xb : xa, Dz - t], eu: mirror ? 'x-' : 'x+', ev: 'z-', U: xb - xa, V: Dz - zb - 2 * t, locked, tatami: k.rand() < 0.5 });
          front.push(k.door(plan.door[0], locked ? 'locked' : 'open'));
          front.push(k.window(mirror ? xa + 0.6 : xb - 0.6, 0.8, { sill: 1.1, head: 1.8 }));
          back.push(k.window(plan.far[0], xb - xa - 1.2, { sill: 0.1, head: 2.1, broken: k.rand() < 0.25 }));
        }
        if (i > 0) k.partition(level, t + i * cell, zb + t, t + i * cell, Dz - t, [], { mat: 'concrete', tint });
      }
      k.floor(level, 'vinyl', [t, zb + t, w - t, Dz - t]);
      ring(k, level, [0, zb, w, Dz], { mat: 'concrete', tint, front, back, frontInside: true, y1: level === top ? k.eaves + 1.0 : undefined });
      // Corridor, the stair tower's front wall (with a window), balconies.
      k.floor(level, 'concrete', [0, Dz, w, zt], { tint: 0.5 });
      k.room(level, 0.1, Dz, w - 0.1, zc, ground ? 'lobby' : 'hall');
      k.wall(level, tx0, d - t, tx1, d, [k.window(cx - tx0, 0.8, { sill: 1.4, head: 2.2 })], { mat: 'concrete', tint, exterior: true, layer: 'shell', y1: level === top ? k.eaves + 1.0 : undefined });
      if (ground) {
        const low = { mat: 'concrete' as const, tint: 0.66, exterior: true, layer: 'shell' as const, y1: fy + 0.9 };
        k.wall(0, 0, zc, tx0, zc + 0.12, [k.door(tx0 / 2, 'open', 1.2)], low);
        k.wall(0, tx1, zc, w, zc + 0.12, [k.door((w - tx1) / 2, 'open', 1.2)], low);
        k.wall(0, 0, Dz, 0.1, zc, [], low);
        k.wall(0, w - 0.1, Dz, w, zc, [], low);
        k.floor(0, 'concrete', [tx0 + t, zt, tx1 - t, d - t], { tint: 0.5 });
      } else {
        for (const [x0, x1] of [[0, cx - 1.05], [cx + 1.05, w]] as const) k.box(level, x0, fy, zc, x1, fy + ARCH.rail.height, zt, 'steel', steel);
        k.box(level, 0, fy, Dz, 0.06, fy + ARCH.rail.height, zc, 'steel', steel);
        k.box(level, w - 0.06, fy, Dz, w, fy + ARCH.rail.height, zc, 'steel', steel);
        k.box(-1, 0.1, fy - 0.2, 0.05, w - 0.1, fy, zb, 'concrete', concrete);
        k.box(-1, 0.1, fy, 0.05, w - 0.1, fy + 1.0, 0.15, 'concrete', concrete);
      }
      if (level < top) k.stairs({ level, start: [cx - 0.525, zt], dir: 'z+', width: 0.9, kind: 'switchback', turn: 'left', mat: 'concrete', tint });
      else k.box(level, cx - 1.05, fy, zc, cx, fy + ARCH.rail.height, zt, 'steel', steel);
    }
    // The tower's side walls, full height; its roof. The block's roof.
    const e = k.eaves;
    k.box(-1, tx0, -ARCH.foundation, zt, tx0 + t, e + 1.0, d - t, 'concrete', concrete);
    k.box(-1, tx1 - t, -ARCH.foundation, zt, tx1, e + 1.0, d - t, 'concrete', concrete);
    k.box(-1, tx0, e + 0.8, zt, tx1, e + 1.0, d - t, 'concrete', concrete);
    k.floor(k.storeys, 'concrete', [t, zb + t, w - t, Dz - t], { tint: 0.5 });
    k.box(-1, 0, e - 0.15, Dz, w, e, zt, 'concrete', concrete);

    // Beside the tower: bicycles under a roof on the left, the garbage cage on the right.
    for (let x = 0.6; x < tx0 - 1.0; x += 0.7) k.box(-1, x, 0, zt + 1.3, x + 0.06, 1.0, d - 0.2, 'steel', { layer: 'shell', tint: k.rand(), role: 'furniture' });
    k.box(-1, 0.3, 2.2, zt + 1.1, tx0 - 0.6, 2.26, d - 0.1, 'metalRoof', { layer: 'shell', solid: false, tint: 0.66 });
    k.box(-1, tx1 + 1.5, 0, zt + 1.0, tx1 + 3.5, 1.2, d - 0.4, 'steel', steel);
    k.box(-1, tx1 + 1.6, 1.2, zt + 1.1, tx1 + 3.4, 1.4, d - 0.5, 'fabric', { layer: 'shell', solid: false, tint: 0.9 });
    return k.finish();
  },
};
