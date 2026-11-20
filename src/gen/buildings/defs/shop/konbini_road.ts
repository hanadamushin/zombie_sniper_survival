// コンビニ・路面店 (07d-2b). Unlike the sample (shop.konbini: backroom across the back, aisles running
// front to back, counter on the right) this roadside store stands behind its own car park, has the
// counter on the LEFT by the door, aisles running ACROSS the shop, the walk-in coolers along the
// back, the stock room and the customers' toilet in a column on the right and an eat-in counter
// along the front glass.
//
//   +--------+=====coolers=========+-------+
//   |backroom|  B (back aisle)     D stock |
//   +---D----+C1+~~~gondola~~~~~+C2+       |
//   | staff [c]  | aisle        |  |-------+
//   |       [c]  +~~~gondola~~~~+  |       |
//   +-  -  -  -  F (front aisle)   D  WC   |
//   +==glass==[door]==glass(eat-in)=+-----+
//   |   car park: bays, car stops, an abandoned car, the pole sign   |

import { ARCH } from '../../../../data/architecture.ts';
import { ring } from '../house/common.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { awning, car, P, poleSign, sign, stools, toppled } from './common.ts';

export const SHOP_KONBINI_ROAD: BuildingDef = {
  id: 'shop.konbini_road',
  category: 'shop',
  variant: 'konbini_road',
  kind: 'shop',
  size: { w: [14, 18], d: [17, 21] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 2.4,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_KONBINI_ROAD, params, rng);
    const { w, d } = k;
    const t = 0.25;
    k.thick = t;
    const y = k.levelY(0);
    const brand = k.rand();
    const park = 6.5;
    const zF = d - park; // front wall's outer face
    const zf = zF - t; // its inner face
    const xb = t + 3.0; // staff / backroom column | shop
    const xR = w - t - 2.6; // shop | stock and toilet column
    const zS = t + 3.0; // backroom | staff area
    const zT = zf - 2.4; // stock | toilet
    const zFa = zf - 2.2; // front aisle's back edge
    const zBa = t + 0.8; // coolers | back aisle
    const zBb = zBa + 1.5; // back aisle | gondolas
    const doorX = xb + 0.7;

    // Walls, floor, roof and parapet over the shop part of the lot.
    k.floor(0, 'tileFloor', [t, t, w - t, zf]);
    ring(k, 0, [0, 0, w, zF], {
      mat: 'plaster', tint: brand,
      front: [
        k.window((0.3 + doorX - 1.05) / 2, doorX - 1.05 - 0.3 - 0.1, { sill: 0.1, head: 2.7, broken: k.rand() < 0.4 }),
        k.door(doorX, 'open', ARCH.door.wide),
        ...k.evenly(doorX + 1.0, w - 0.3, 2).map((x) => k.window(x, (w - 0.3 - doorX - 1.0) / 2 - 0.2, { sill: 0.1, head: 2.7, broken: k.rand() < 0.3 })),
      ],
      back: [k.door(t + 1.8, 'locked')],
      right: [k.window(zf - 1.2, 0.6, { sill: 1.6 })],
    });
    k.floor(1, 'concrete', [t, t, w - t, zf]);
    const e = k.eaves;
    for (const [x0, z0, x1, z1] of [[0, zF - t, w, zF], [0, 0, w, t], [0, t, t, zF - t], [w - t, t, w, zF - t]] as const) k.box(-1, x0, e, z0, x1, e + 0.8, z1, 'plaster', { layer: 'shell', tint: brand });
    sign(k, 0.3, e - 0.6, zF, w - 0.3, e + 0.75, zF + 0.12, brand);
    awning(k, doorX - 1.4, doorX + 1.4, zF, 1.1, y + 2.55, 1 - brand);

    // Back of house: backroom (back door locked) and the staff area behind the counter.
    k.partition(0, t, zS, xb, zS, [k.door(1.2)]);
    k.partition(0, xb, t, xb, zS);
    k.room(0, t, t, xb - P, zS - P, 'backroom');
    k.furniture(0, xb - 0.5 - P, t + 0.4, xb - P, zS - 0.3, 2.0, 'shelf', { search: { kind: 'shelf', face: 'x-', table: 'storage' } });
    k.furniture(0, t, t + 1.4, t + 0.8, t + 2.4, 1.0, 'wood', { tint: 0.4, search: { kind: 'crate', face: 'x+', table: 'grocery' } });
    const staff = k.room(0, t, zS + P, xb, zFa, 'sales');
    k.furniture(0, xb - 0.7, zS + 0.4, xb, zFa - 0.9, 1.0, 'counter', { tint: brand, search: { kind: 'counter', face: 'x-', table: 'sales' } });
    k.furniture(0, t, zS + 0.6, t + 0.45, zFa - 0.9, 1.8, 'shelf', { search: { kind: 'shelf', face: 'x+', table: 'pharmacy' } });

    // Sales floor: back aisle along the coolers, two cross aisles, the aisles between the gondolas, the front aisle.
    const F = k.room(0, t, zFa, xR - P, zf, 'sales');
    k.join(staff, F);
    const B = k.room(0, xb, zBa, xR - P, zBb, 'sales');
    const C1 = k.room(0, xb, zBb, xb + 1.4, zFa, 'sales');
    const C2 = k.room(0, xR - P - 1.4, zBb, xR - P, zFa, 'sales');
    k.join(B, C1);
    k.join(C1, F);
    k.join(B, C2);
    k.join(C2, F);
    k.furniture(0, xb + 0.2, t, xR - P - 0.2, zBa, 2.0, 'appliance', { tint: 0.1, search: { kind: 'fridge', face: 'z+', table: 'grocery' } });
    const L = zFa - zBb;
    const n = Math.max(1, Math.floor((L + 1.2) / 2.1));
    const aisle = n > 1 ? (L - n * 0.9) / (n - 1) : 0;
    const gx0 = xb + 1.4;
    const gx1 = xR - P - 1.4;
    for (let i = 0; i < n; i++) {
      const z0 = n > 1 ? zBb + i * (0.9 + aisle) : zBb + (L - 0.9) / 2;
      k.furniture(0, gx0, z0, gx1, z0 + 0.9, 1.4, 'shelf', { tint: brand, search: { kind: 'shelf', face: i === n - 1 ? 'z+' : 'z-', table: i % 2 ? 'sales' : 'grocery' } });
      if (i + 1 < n) {
        const a = k.room(0, gx0, z0 + 0.9, gx1, z0 + 0.9 + aisle, 'sales');
        k.join(C1, a);
        k.join(a, C2);
      }
    }
    // Eat-in counter along the front glass, stools drawn only.
    const ex0 = xb + 5.0;
    const ex1 = xR - P - 1.0;
    if (ex1 - ex0 > 1.2) {
      k.furniture(0, ex0, zf - 0.45, ex1, zf, 1.0, 'counter', { tint: 0.6 });
      stools(k, 0, 'x', ex0, ex1, zf - 0.7);
    }
    if (k.rand() < 0.8) k.stain(0, doorX - 0.6, zFa + 0.3, doorX + 1.6, zFa + 1.4);
    k.stain(0, doorX - 0.8, zf - 1.0, doorX + 0.8, zf - 0.2, 'debris');

    // Right column: stock room (off the back aisle) and the customers' toilet (off the front aisle).
    k.partition(0, xR, t, xR, zf, [k.door((zBa + zBb) / 2 - t), k.door(zf - 1.1 - t)]);
    k.partition(0, xR + P, zT, w - t, zT);
    k.room(0, xR + P, t, w - t, zT - P, 'storage');
    k.furniture(0, w - t - 0.6, t + 0.3, w - t, zT - 0.4, 2.0, 'shelf', { search: { kind: 'shelf', face: 'x-', table: 'grocery' } });
    toppled(k, 0, xR + 0.4, zT - 1.4, xR + 1.4, zT - 0.5, 'wood');
    k.room(0, xR + P, zT + P, w - t, zf, 'toilet');
    k.furniture(0, w - t - 0.55, zT + 0.3, w - t, zT + 1.0, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x-', table: 'toilet' } });

    // The car park: lines, car stops, a bin station by the wall, the pole sign, often a car.
    k.box(-1, 0, 0, zF, w, 0.02, d, 'asphalt', { layer: 'shell', solid: false });
    const bays = Math.floor((w - 1.0) / 2.6);
    for (let i = 0; i <= bays; i++) k.box(-1, 0.5 + i * 2.6 - 0.05, 0.02, zF + 0.8, 0.5 + i * 2.6 + 0.05, 0.03, zF + 5.6, 'paper', { layer: 'shell', solid: false });
    for (let i = 0; i < bays; i++) {
      const cx = 0.5 + (i + 0.5) * 2.6;
      if (Math.abs(cx - doorX) < 1.6) continue;
      k.box(-1, cx - 0.8, 0, zF + 1.0, cx + 0.8, 0.12, zF + 1.2, 'concrete', { layer: 'shell', tint: 0.9 });
    }
    k.box(-1, w - 2.6, 0, zF, w - 0.6, 1.0, zF + 0.55, 'appliance', { layer: 'shell', tint: 0.4, role: 'furniture' });
    poleSign(k, w - 0.5, d - 0.5, k.eaves + 2.3, 2.0, brand);
    if (k.rand() < 0.7) {
      const i = k.pick([0, bays - 1]);
      car(k, 0.5 + (i + 0.5) * 2.6, zF + 3.4, 'z');
    }
    return k.finish();
  },
};
