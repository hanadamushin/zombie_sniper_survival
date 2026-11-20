// 回転寿司 (07d-2b). One storey: two conveyor islands run out from the kitchen towards the front,
// booths stand end-on against both sides of each island, and three aisles (along the side walls and
// down the middle) lead from the front strip (entrance, waiting benches, the register) to them. The
// kitchen behind the islands is entered from the middle aisle; the toilet from the right aisle.
//
//   +------------------------------+-----+
//   | kitchen                    D | toil|   back door locked
//   +--------------+--D--+------------D--+
//   |A0|bbb|=isl=|bbb|A1|bbb|=isl=|bbb|A2|   booths end-on against the islands (b),
//   |  |bbb|=isl=|bbb|  |bbb|=isl=|bbb|  |   aisles A0..A2 between them
//   | front strip: benches, register      |
//   +=====glass======[auto]=====glass=====+   z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, sign } from './common.ts';

const AISLE = 1.4;
const ISLAND = 2.4;
const BOOTH = 1.8;

export const SHOP_KAITENZUSHI: BuildingDef = {
  id: 'shop.kaitenzushi',
  category: 'shop',
  variant: 'kaitenzushi',
  kind: 'shop',
  size: { w: [16, 19], d: [15, 19] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.2,
  roof: 'flat',
  roofRise: 2.2,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_KAITENZUSHI, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const y = k.levelY(0);
    const zk = t + 4.0; // kitchen | dining
    const zf = d - t - 3.0; // dining | front strip
    const bl = (w - 2 * t - 3 * AISLE - 2 * ISLAND) / 4; // booth length (aisle to island)
    const xt = w - t - 2.4; // kitchen | toilet
    const tint = k.rand();
    const colour = k.rand();
    const doorX = w / 2;

    k.floor(0, 'flooring', undefined, { tint: 0.6 });
    k.outerWalls(0, {
      mat: 'siding', tint,
      front: [
        k.window((0.4 + doorX - 1.0) / 2, doorX - 1.0 - 0.4 - 0.4, { sill: 0.6, head: 2.8, broken: k.rand() < 0.3 }),
        k.door(doorX, 'open', ARCH.door.wide),
        k.window((doorX + 1.0 + w - 0.4) / 2, w - 0.4 - doorX - 1.0 - 0.4, { sill: 0.6, head: 2.8 }),
      ],
      back: [k.door(t + 1.4, 'locked'), k.window((xt + w - t) / 2, 0.6, { sill: 1.6 })],
      left: k.evenly(zk + 0.3, zf - 0.3, 2).map((z) => k.window(z, 1.6, { sill: 1.0 })),
      right: k.evenly(zk + 0.3, zf - 0.3, 2).map((z) => k.window(z, 1.6, { sill: 1.0, broken: k.rand() < 0.4 })),
    });
    k.roofFlat({ mat: 'concrete', parapet: 0.9, tint });
    sign(k, 1.0, w - 1.0, k.eaves - 0.7, k.eaves + 0.85, colour);
    // A fish on the roof, facing the street.
    k.box(-1, doorX - 2.4, k.eaves, d - 2.0, doorX + 2.4, k.eaves + 0.3, d - 1.4, 'steel', { layer: 'shell', tint: 0.3 });
    k.part({ shape: 'hip', x0: doorX - 2.2, x1: doorX + 2.2, z0: d - 1.95, z1: d - 1.45, y0: k.eaves + 0.3, y1: k.eaves + 2.1, axis: 'x', mat: 'sign', tint: colour, solid: false });

    // --- kitchen and toilet ---
    const cols: number[] = []; // x of each aisle's left edge
    let x = t;
    for (let i = 0; i < 3; i++) {
      cols.push(x);
      x += AISLE + (i < 2 ? 2 * bl + ISLAND : 0);
    }
    k.partition(0, t, zk, w - t, zk, [k.door(cols[1]! + AISLE / 2 - t), k.door(w - t - AISLE / 2 - t)]);
    k.partition(0, xt, t, xt, zk - P);
    k.room(0, t, t, xt - P, zk - P, 'kitchen');
    k.room(0, xt + P, t, w - t, zk - P, 'toilet');
    k.furniture(0, t + 2.4, t, xt - 1.6, t + 0.7, 0.9, 'steel', { tint: 0.85, search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } });
    k.furniture(0, t, t + 1.2, t + 0.8, zk - P - 0.4, 2.0, 'appliance', { search: { kind: 'fridge', face: 'x+', table: 'grocery' } });
    k.furniture(0, xt - 1.4, t, xt - P, t + 1.0, 1.0, 'steel', { tint: 0.6 }); // rice cookers
    k.furniture(0, w - t - 0.5, t + 0.2, w - t, t + 0.7, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x-', table: 'toilet' } });

    // --- dining: aisles, islands, booths ---
    const F = k.room(0, t, zf, w - t, d - t, 'canteen');
    const nb = Math.floor((zf - zk - P) / BOOTH);
    cols.forEach((ax, i) => {
      const a = k.room(0, ax, zk + P, ax + AISLE, zf, 'canteen');
      k.join(a, F);
      if (i === 2) return;
      // Booths left of the island (their aisle on the left), the island, booths right of it.
      const b0 = ax + AISLE;
      const i0 = b0 + bl;
      const b1 = i0 + ISLAND;
      k.furniture(0, i0, zk + P, b1, zf, 0.95, 'counter', { tint: 0.15 });
      k.box(0, i0 - 0.05, y + 0.95, zk + P, b1 + 0.05, y + 1.0, zf, 'steel', { tint: 0.9, solid: false }); // the belt
      for (let j = 0; j < nb; j++) {
        const z0 = zk + P + j * BOOTH;
        for (const [x0, x1, face] of [[b0, i0, 'x-'], [b1, b1 + bl, 'x+']] as const) {
          const bt = k.rand();
          k.furniture(0, x0, z0, x1, z0 + 0.5, 1.05, 'fabric', { tint: bt });
          k.furniture(0, x0, z0 + 0.5, x1, z0 + BOOTH - 0.5, 0.72, 'wood', { tint: 0.55, search: j % 2 === 0 && face === 'x-' ? { kind: 'table', face, table: 'canteen' } : undefined });
          k.furniture(0, x0, z0 + BOOTH - 0.5, x1, z0 + BOOTH, 1.05, 'fabric', { tint: bt });
        }
      }
      // Planters fill what is left at the front end of each booth row.
      const zr = zk + P + nb * BOOTH;
      if (zf - zr > 0.05) for (const [x0, x1] of [[b0, i0], [b1, b1 + bl]] as const) k.furniture(0, x0, zr, x1, zf, 0.8, 'plant', { solid: true });
    });
    // Front strip: waiting benches by the windows, the register.
    for (const [x0, x1] of [[t + 0.6, doorX - 1.7], [doorX + 1.7, w - t - 2.4]] as const) if (x1 - x0 > 0.8) k.furniture(0, x0, d - t - 0.45, x1, d - t, 0.45, 'fabric', { tint: colour });
    k.furniture(0, w - t - 1.6, d - t - 0.6, w - t, d - t, 1.0, 'counter', { tint: colour, search: { kind: 'counter', face: 'z-', table: 'sales' } });
    k.stain(0, cols[1]! + 0.2, zf - 2.2, cols[1]! + 1.2, zf - 0.8, 'debris'); // plates
    if (k.rand() < 0.75) k.stain(0, cols[0]! + 0.2, zk + 2.0, cols[0]! + 1.2, zk + 3.2);
    return k.finish();
  },
};
