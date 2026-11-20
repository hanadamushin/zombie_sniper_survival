// 鉄骨 3 階建てのアパート (07d-2a). A steel-framed block under a flat roof: flats in a row on three
// floors, open corridors along the front on every floor (the ground one behind a low wall with a
// gate), an outdoor steel stair folding back on itself in a bay at the right end, steel balconies
// at the back, bicycle racks and the garbage cage in a strip at the left end.
//
//   plan (every floor)
//   +----+-------+-------+--+---+
//   |bike| flat  | flat  |  |   |      balconies along the back (z = 0)
//   |    |       |       |  | ↕ |      stair bay: flights go back from the corridor and return
//   |trash  D       D    |  |   |
//   +====+=======corridor=====+=+      railing (upper floors) / low wall + gate (ground)

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Hole } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, ring } from '../house/common.ts';
import { unit } from './unit.ts';

export const APARTMENT_TEKKOTSU3: BuildingDef = {
  id: 'apartment.tekkotsu3',
  category: 'apartment',
  variant: 'tekkotsu3',
  kind: 'apartment',
  size: { w: [15, 20], d: [9.5, 11] },
  storeys: 3,
  storeyHeight: 3.0,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 1.2,
  lootable: true,
  generate(rng, params) {
    const k = createKit(APARTMENT_TEKKOTSU3, params, rng);
    const { w, d } = k;
    const t = 0.2;
    k.thick = t;
    const bx = 1.6; // bicycle strip | block
    const Wb = w - 2.4; // block | stair bay
    const zb = 1.0; // balconies | block
    const Dz = d - 2.0; // block | corridor
    const zc = Dz + 1.24; // corridor's front edge (inside the railing)
    const n = Math.max(2, Math.floor((Wb - bx - 2 * t) / 4.8));
    const cell = (Wb - bx - 2 * t) / n;
    const tint = k.rand();
    const wallMat = k.pick(['mortar', 'siding', 'plaster'] as const);
    const top = k.storeys - 1;
    const laneA = Wb + 0.6;
    const steel = { layer: 'shell' as const, tint: 0.4 };

    for (let level = 0; level < k.storeys; level++) {
      const fy = k.levelY(level);
      const front: Hole[] = [];
      const back: Hole[] = [];
      for (let i = 0; i < n; i++) {
        const xa = i === 0 ? bx + t : bx + t + i * cell + P;
        const xb = i === n - 1 ? Wb - t : bx + t + (i + 1) * cell - P;
        const mirror = i % 2 === 1;
        const locked = !(level === 0 && i === 0) && !(i === n - 1 && level > 0) && k.rand() < 0.5;
        const plan = unit(k, { level, origin: [mirror ? xb : xa, Dz - t], eu: mirror ? 'x-' : 'x+', ev: 'z-', U: xb - xa, V: Dz - zb - 2 * t, locked });
        front.push(k.door(plan.door[0], locked ? 'locked' : 'open'));
        front.push(k.window(mirror ? xa + 0.45 : xb - 0.45, 0.5, { sill: 1.1, head: 1.8 }));
        back.push(k.window(plan.far[0], Math.min(2.6, xb - xa - 1.2), { sill: 0.1, head: 2.1, broken: k.rand() < 0.25 }));
        if (i > 0) k.partition(level, bx + t + i * cell, zb + t, bx + t + i * cell, Dz - t, [], { mat: 'plaster' });
      }
      k.floor(level, 'vinyl', [bx + t, zb + t, Wb - t, Dz - t]);
      ring(k, level, [bx, zb, Wb, Dz], { mat: wallMat, tint, front, back, frontInside: true, y1: level === top ? k.eaves + 1.0 : undefined });
      // Corridor on every floor.
      k.floor(level, 'concrete', [0, Dz, w, Dz + 1.3], { tint: 0.5 });
      k.room(level, 0.1, Dz, w - 0.1, zc, level === 0 ? 'lobby' : 'hall');
      if (level > 0) {
        k.box(level, 0, fy, zc, w, fy + ARCH.rail.height, Dz + 1.3, 'steel', steel);
        k.box(level, w - 0.06, fy, Dz, w, fy + ARCH.rail.height, zc, 'steel', steel);
        k.box(level, 0, fy, Dz, 0.06, fy + ARCH.rail.height, zc, 'steel', steel);
        // Balcony along the back.
        k.box(-1, bx, fy - 0.2, 0.05, Wb, fy, zb, 'concrete', { layer: 'shell', tint: 0.5 });
        k.box(-1, bx, fy, 0.05, Wb, fy + 1.0, 0.12, 'steel', steel);
      }
      if (level < top) k.stairs({ level, start: [laneA, Dz], dir: 'z-', width: 0.9, kind: 'switchback', turn: 'right', mat: 'steel', tint: 0.4 });
    }
    // Ground: low wall with two gates in front of the corridor, the slab of the stair bay.
    const y0 = k.levelY(0);
    const low = { mat: 'concrete' as const, tint: 0.66, exterior: true, layer: 'shell' as const, y1: y0 + 0.9 };
    k.wall(0, 0, zc, w, zc + 0.12, [k.door(bx + 2.0, 'open', 1.2), k.door(w / 2 + 1.0, 'open', 1.2)], low);
    k.wall(0, 0, Dz, 0.1, zc, [], low);
    k.wall(0, w - 0.1, Dz, w, zc, [], low);
    k.floor(0, 'concrete', [Wb, Dz - 3.4, w, Dz], { tint: 0.5 });
    // Top floor: a rail where the next flight would start.
    k.box(top, Wb + 0.1, k.levelY(top), Dz - 0.06, Wb + 1.1, k.levelY(top) + ARCH.rail.height, Dz, 'steel', steel);
    // Bay posts, and the roofs over the bay and the corridor.
    for (const [x, z] of [[Wb, Dz - 3.4], [w - 0.12, Dz - 3.4]] as const) k.box(-1, x, -0.5, z, x + 0.12, k.eaves, z + 0.12, 'steel', steel);
    k.box(-1, Wb, k.eaves - 0.15, Dz - 3.4, w, k.eaves, Dz, 'steel', { layer: 'shell', tint: 0.4 });
    k.box(-1, 0, k.eaves - 0.15, Dz, w, k.eaves, Dz + 1.3, 'concrete', { layer: 'shell', tint: 0.5 });
    k.floor(k.storeys, 'concrete', [bx + t, zb + t, Wb - t, Dz - t], { tint: 0.5 });

    // Bicycle strip at the left end: racks, bicycles, a roof; the garbage cage at its front.
    for (let z = zb + 0.4; z < Dz - 2.2; z += 0.7) k.box(-1, 0.3, 0, z, 1.4, 1.0, z + 0.06, 'steel', { layer: 'shell', tint: k.rand(), role: 'furniture' });
    k.box(-1, 0.1, 2.2, zb, bx - 0.1, 2.26, Dz - 1.8, 'metalRoof', { layer: 'shell', solid: false, tint: 0.66 });
    k.box(-1, 0.2, 0, Dz - 1.7, bx - 0.1, 1.2, Dz - 0.3, 'steel', { layer: 'shell', tint: 0.66 });
    k.box(-1, 0.3, 1.2, Dz - 1.6, bx - 0.2, 1.4, Dz - 0.4, 'fabric', { layer: 'shell', solid: false, tint: 0.9 });
    return k.finish();
  },
};
