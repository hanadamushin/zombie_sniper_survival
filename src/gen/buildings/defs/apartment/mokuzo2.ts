// 木造 2 階の外廊下アパート (07d-2a). A timber block of one-room flats in a row under a gable, the
// upper flats off an open corridor along the front. An outdoor steel stair runs along the front of
// the corridor: its foot is behind a low wall with a gate on the street, its top a landing at the
// left end. The ground-floor flats open straight onto the strip under the corridor. About half the
// flats are locked. Bicycles and a garbage cage in front.
//
//   upper floor                                     ground floor
//   +--------+--------+--------+                    +--------+--------+--------+
//   | room   | room   | room   |                    | room   | room   | room   |
//   +-D------+------D-+-D------+                    +-D------+------D-+-D------+
//   |bath|kit|kit|bath|bath|kit|                    |bath|kit|kit|bath|bath|kit|
//   +----D---+---D----+----D---+                    +----D---+---D----+----D---+
//   |  corridor (railing)       |                      (open, under the corridor)
//   |land|<<< stair <<<|                                ====stair====|foot|  bikes  trash
//                                                     low wall ------gate-

import { createKit } from '../../kit.ts';
import type { BuildingDef, OpeningState } from '../../types.ts';
import type { Hole } from '../../kit.ts';
import { P, pitched, ring } from '../house/common.ts';
import { unit, type UnitPlan } from './unit.ts';

export const APARTMENT_MOKUZO2: BuildingDef = {
  id: 'apartment.mokuzo2',
  category: 'apartment',
  variant: 'mokuzo2',
  kind: 'apartment',
  size: { w: [14, 19], d: [9, 10.5] },
  storeys: 2,
  storeyHeight: 2.85,
  plinth: 0.3,
  roof: 'gable',
  roofRise: 1.8,
  lootable: true,
  generate(rng, params) {
    const k = createKit(APARTMENT_MOKUZO2, params, rng);
    const { w, d } = k;
    const t = 0.15;
    k.thick = t;
    const Dz = d - 2.6; // the block's front; the corridor and the street strip in front
    const zl = Dz + 1.2; // corridor | the stair, which runs along the front of it
    const lz = zl + 0.48; // stair centre line
    const xl = 1.3; // upstairs landing (left end) | the stair
    const xf = xl + 3.75; // foot of the stair
    const n = Math.max(2, Math.min(4, Math.floor((w - 2 * t) / 4.2)));
    const cell = (w - 2 * t) / n;
    const tint = k.rand();
    const wallMat = k.pick(['siding', 'mortar'] as const);

    let corridor = -1;
    for (let level = 0; level < 2; level++) {
      const fy = k.levelY(level);
      const front: Hole[] = [];
      const back: Hole[] = [];
      for (let i = 0; i < n; i++) {
        const xa = i === 0 ? t : t + i * cell + P;
        const xb = i === n - 1 ? w - t : t + (i + 1) * cell - P;
        const mirror = i % 2 === 1;
        const keepOpen = (level === 0 && i === 0) || (level === 1 && i === n - 1);
        const locked = !keepOpen && k.rand() < 0.5;
        const plan: UnitPlan = unit(k, { level, origin: [mirror ? xb : xa, Dz - t], eu: mirror ? 'x-' : 'x+', ev: 'z-', U: xb - xa, V: Dz - 2 * t, locked });
        const state: OpeningState = locked ? 'locked' : 'open';
        front.push(k.door(plan.door[0], state));
        front.push(k.window(mirror ? xa + 0.45 : xb - 0.45, 0.5, { sill: 1.1, head: 1.8 }));
        back.push(k.window(plan.far[0], 1.6, { broken: k.rand() < 0.25 }));
        if (i > 0) k.partition(level, t + i * cell, t, t + i * cell, Dz - t, [], { mat: 'plaster' });
      }
      k.floor(level, 'flooring', [t, t, w - t, Dz - t]);
      ring(k, level, [0, 0, w, Dz], { mat: wallMat, tint, front, back, right: [k.window(Dz / 2, 0.6, { sill: 1.2 })], frontInside: level === 1 });
      if (level === 1) {
        // The open corridor: its slab, the railing, the posts under it.
        k.floor(1, 'concrete', [0, Dz, w, Dz + 1.2], { tint: 0.5 });
        corridor = k.room(1, 0.06, Dz, w - 0.06, Dz + 1.14, 'hall');
        k.box(1, xl, fy, Dz + 1.14, w, fy + 1.0, Dz + 1.2, 'steel', { layer: 'shell', tint: 0.4 });
        k.box(1, w - 0.06, fy, Dz, w, fy + 1.0, Dz + 1.14, 'steel', { layer: 'shell', tint: 0.4 });
        k.box(1, 0, fy, Dz, 0.06, fy + 1.0, Dz + 1.14, 'steel', { layer: 'shell', tint: 0.4 });
        for (const x of [0, w / 2, w - 0.12]) k.box(-1, x, -0.5, Dz + 1.0, x + 0.12, fy - 0.2, Dz + 1.12, 'steel', { layer: 'shell', tint: 0.4 });
      }
    }

    // The outdoor stair along the front of the corridor: its foot behind a low wall with a gate on the
    // street, a landing at the left end upstairs.
    const y0 = k.levelY(0);
    const y1 = k.levelY(1);
    const low = { mat: 'concrete' as const, tint: 0.66, exterior: true, layer: 'shell' as const, y1: y0 + 1.0 };
    const xr = xf + 1.6; // the foot's right side
    k.floor(0, 'concrete', [xf, zl, xr, d - 0.12], { tint: 0.5 });
    k.wall(0, xl, d - 0.12, xr + 0.12, d, [k.door((xf + xr) / 2 - xl, 'open')], low);
    k.wall(0, xr, zl, xr + 0.12, d - 0.12, [], low);
    k.room(0, xf, zl, xr, d - 0.12, 'stairs');
    k.stairs({ level: 0, start: [xf, lz], dir: 'x-', width: 0.9, rails: [], mat: 'steel', tint: 0.4 });
    k.box(-1, xl, y1 - 0.04, d - 0.42, xf, y1 + 1.0, d - 0.38, 'steel', { layer: 'shell', solid: false }); // hand rail
    k.floor(1, 'concrete', [0, zl, xl, zl + 1.0], { tint: 0.5 });
    const landing = k.room(1, 0.06, zl - 0.06, xl, zl + 0.94, 'hall');
    k.join(corridor, landing);
    k.box(1, 0, y1, zl + 0.94, xl, y1 + 1.0, zl + 1.0, 'steel', { layer: 'shell', tint: 0.4 });
    k.box(1, 0, y1, zl - 0.06, 0.06, y1 + 1.0, zl + 0.94, 'steel', { layer: 'shell', tint: 0.4 });

    // Roof, and a canopy over the corridor.
    pitched(k, [0, 0, w, Dz], { mat: k.pick(['metalRoof', 'slate'] as const), tint: k.rand(), axis: 'x' });
    k.box(-1, 0, k.eaves - 0.1, Dz + 0.4, w, k.eaves, Dz + 1.3, 'metalRoof', { layer: 'shell', solid: false, tint: 0.5 });

    // Street strip: a row of bicycles under a roof, the garbage cage.
    const bikes = Math.max(0, Math.min(5, Math.floor((w - xr - 3.2) / 0.7)));
    for (let i = 0; i < bikes; i++) {
      const x = w - 0.6 - i * 0.7;
      k.box(-1, x - 0.03, 0, d - 1.3, x + 0.03, 1.0, d - 0.2, 'steel', { layer: 'shell', tint: k.rand(), role: 'furniture' });
    }
    k.box(-1, w - 0.4 - bikes * 0.7, 2.1, d - 1.4, w - 0.2, 2.16, d - 0.1, 'metalRoof', { layer: 'shell', solid: false, tint: 0.66 });
    k.box(-1, xr + 0.5, 0, d - 1.1, xr + 2.2, 1.2, d - 0.1, 'steel', { layer: 'shell', tint: 0.66 });
    k.box(-1, xr + 0.6, 1.2, d - 1.0, xr + 2.1, 1.5, d - 0.2, 'fabric', { layer: 'shell', solid: false, tint: 0.9 });
    return k.finish();
  },
};
