// 鉄骨の店舗併用住宅 (07d-2a). A three-storey steel-framed town house with a small shop on the
// ground floor (its shutter rolled down; the family got in and out by the side door) and the home
// above. A folding stair in a core at the back left serves every floor.
//
//   ground                     1st                       2nd
//   +-----+--------+           +-----+--------+          +-----+--------+
//   |stair| store  |           |stair| bath   |          |stair| child  |
//   | ↕   |        |           | ↕   |        |          | ↕   |        |
//   D hall D       |           | hall D       |          | hall D       |
//   +--D--+--------+           +--D--+--------+          +--D--+--------+
//   | shop (shelves, counter)  | LDK                     | bedroom       |
//   +=====shutter=============+                          +---------------+   front (z = d), sign above
//
// The shop sells one of: everyday goods, medicine, hardware (seeded).

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef, LootTableId } from '../../types.ts';
import { P } from './common.ts';

export const HOUSE_TENPO: BuildingDef = {
  id: 'house.tenpo',
  category: 'house',
  variant: 'tenpo',
  kind: 'shop',
  size: { w: [7, 9], d: [10, 13] },
  storeys: 3,
  storeyHeight: 3.0,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 1.2,
  lootable: true,
  generate(rng, params) {
    const k = createKit(HOUSE_TENPO, params, rng);
    const { w, d } = k;
    const t = 0.2;
    k.thick = t;
    const xc = t + 2.0 + P; // core | store / bath / child's room (centre line)
    const zs = t + 3.3; // the line the stair starts from
    const zh = zs + 1.6; // hall | front room (centre line)
    const hallX = (t + xc - P) / 2;
    const tint = k.rand();
    const wallMat = k.pick(['mortar', 'siding', 'plaster'] as const);
    const goods = k.pick(['sales', 'pharmacy', 'tools'] as const) as LootTableId;
    const top = k.storeys - 1;

    for (let level = 0; level < k.storeys; level++) {
      const ground = level === 0;
      k.floor(level, ground ? 'tileFloor' : 'flooring');
      k.outerWalls(level, {
        mat: wallMat, tint, parapet: level === top ? ARCH.rail.parapet : 0,
        front: ground
          ? [k.door(w / 2, 'shutter', w - 2 * t - 0.8)]
          : k.evenly(t + 0.3, w - t - 0.3, 2).map((x) => k.window(x, (w - 2 * t) / 2 - 0.9, { sill: level === 1 ? 0.6 : 0.9, broken: k.rand() < 0.3 })),
        back: [k.window((xc + w - t) / 2, 1.0, { sill: 1.2 })],
        left: ground ? [k.door((zs + zh) / 2)] : [k.window((zh + d) / 2, 0.9, { sill: 1.0 })],
        right: level > 0 ? [k.window((zh + d) / 2, 0.9, { sill: 1.0 })] : [],
      });
      k.partition(level, xc, t, xc, zh, [k.door((zs + zh) / 2 - t)], { mat: 'plaster' });
      k.partition(level, t, zh, w - t, zh, [k.door(hallX - t)], { mat: 'plaster' });
      k.room(level, t, zs, xc - P, zh - P, 'hall');
      if (level < top) k.stairs({ level, start: [t + 0.47, zs], dir: 'z-', width: 0.9, kind: 'switchback', turn: 'right', mat: 'steel' });
    }

    // Top floor: a railing where the stairwell would go on up.
    k.box(top, t, k.levelY(top), zs - ARCH.rail.thick, t + 0.95, k.levelY(top) + ARCH.rail.height, zs, 'steel', { role: 'furniture' });

    // Ground: the shop and its store room.
    const shopZ0 = zh + P;
    k.room(0, xc + P, t, w - t, zh - P, 'storage');
    k.room(0, t, shopZ0, w - t, d - t, 'sales');
    const shelves = Math.max(1, Math.floor((w - 2 * t - 1.6) / 1.9));
    for (let i = 0; i < shelves; i++) {
      const x = t + 1.4 + i * 1.9;
      k.furniture(0, x, shopZ0 + 1.6, x + 0.6, d - t - 1.6, 1.5, 'shelf', { tint, search: i % 2 === 0 ? { kind: 'shelf', face: 'x+', table: goods } : undefined });
    }
    k.furniture(0, w - t - 0.6, shopZ0 + 0.3, w - t, shopZ0 + 2.0, 1.0, 'counter', { tint, search: { kind: 'counter', face: 'x-', table: 'sales' } });
    k.furniture(0, t, d - t - 2.6, t + 0.5, d - t - 0.4, 1.8, 'appliance', { search: { kind: 'fridge', face: 'x+', table: 'grocery' } });
    k.furniture(0, w - t - 0.6, t, w - t, zs, 2.0, 'shelf', { search: { kind: 'shelf', face: 'x-', table: 'storage' } });
    k.furniture(0, xc + P + 0.2, t + 0.2, xc + 1.2, t + 1.2, 0.8, 'wood', { tint: 0.4, search: { kind: 'crate', face: 'z+', table: goods } });
    k.stain(0, t + 1.0, d - t - 1.4, w - t - 1.0, d - t - 0.4, 'debris');

    // 1st: the family's LDK and bath.
    k.room(1, xc + P, t, w - t, zh - P, 'bath');
    k.room(1, t, shopZ0, w - t, d - t, 'living');
    k.furniture(1, w - t - 0.75, t, w - t, t + 1.6, 0.6, 'tileFloor');
    k.furniture(1, xc + P, t, xc + 0.9, t + 0.5, 0.85, 'counter', { search: { kind: 'cabinet', face: 'z+', table: 'bath' } });
    k.furniture(1, w - t - 0.65, shopZ0 + 0.2, w - t, shopZ0 + 2.6, 0.9, 'counter', { search: { kind: 'cabinet', face: 'x-', table: 'kitchen' } });
    k.furniture(1, w - t - 0.7, shopZ0 + 2.7, w - t, shopZ0 + 3.4, 1.8, 'appliance', { search: { kind: 'fridge', face: 'x-', table: 'kitchen' } });
    k.furniture(1, t + 1.2, d - t - 2.6, t + 2.6, d - t - 1.6, 0.72, 'wood', { tint: 0.6 });
    k.furniture(1, t, d - t - 0.5, t + 1.6, d - t, 0.5, 'woodDark', { search: { kind: 'cabinet', face: 'z-', table: 'living' } });
    if (k.rand() < 0.7) k.stain(1, hallX - 0.5, zh + 0.6, hallX + 0.8, zh + 1.8);

    // 2nd: bedrooms.
    k.room(2, xc + P, t, w - t, zh - P, 'bedroom');
    k.room(2, t, shopZ0, w - t, d - t, 'bedroom');
    k.furniture(2, w - t - 1.0, t, w - t, t + 2.0, 0.45, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x-', table: 'bedroom' } });
    k.furniture(2, w - t - 1.6, d - t - 2.1, w - t, d - t, 0.5, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x-', table: 'bedroom' } });
    k.furniture(2, t, d - t - 0.6, t + 1.8, d - t, 1.9, 'wood', { search: { kind: 'closet', face: 'z-', table: 'bedroom' } });
    k.box(2, t + 0.4, k.levelY(2), shopZ0 + 1.6, t + 2.2, k.levelY(2) + 0.5, shopZ0 + 2.2, 'wood', { tint: 0.3, role: 'furniture' }); // toppled bookcase

    // Roof, sign board, awning over the shutter.
    k.roofFlat({ mat: 'concrete', tint: 0.5 });
    const y1 = k.levelY(1);
    k.part({ shape: 'box', x0: 0.2, x1: w - 0.2, z0: d, z1: d + 0.15, y0: y1 - 0.15, y1: y1 + 0.7, mat: 'sign', tint: k.rand(), solid: false });
    k.part({ shape: 'wedge', x0: 0.1, x1: w - 0.1, z0: d, z1: d + 0.55, y0: y1 - 0.55, y1: y1 - 0.25, slope: 'z-', mat: 'fabric', tint: k.rand(), solid: false });
    return k.finish();
  },
};
