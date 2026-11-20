// 回転寿司 (07d-2b). A roadside box: the kitchen across the back, the conveyor lanes running out of it
// towards the front, each lane with a row of booths on either side, the aisles between them, and a
// wide front hall with the waiting benches and the register. The toilet and the store are in the
// back band beside the kitchen.
//
//   +-----+-------------------------+-------+
//   | WC  |  kitchen     [prep]     | store |   back door from the store (seeded)
//   +--D--+--h-------h-------D--h---+-------+   h: hatches the lanes ran out of
//   |  a  [b]=[b]  a  [b]=[b]  a  [b]=[b] a |   a: aisles (rooms), [b]=[b]: booths either side of a lane
//   |     [b]=[b]     [b]=[b]     [b]=[b]   |
//   |              F (front hall)            |
//   +[bench]=glass====[door]====glass[reg.]+

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { booth, P, sign } from './common.ts';

const BLOCK = 3.45; // booth 1.5 + lane 0.45 + booth 1.5

export const SHOP_KAITENZUSHI: BuildingDef = {
  id: 'shop.kaitenzushi',
  category: 'shop',
  variant: 'kaitenzushi',
  kind: 'shop',
  size: { w: [18, 24], d: [16, 20] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 2.3,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_KAITENZUSHI, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const y = k.levelY(0);
    const brand = k.pick([0.3, 0.55, 0.85]);
    const wall = k.rand();
    const zk = t + 4.0; // kitchen band | lanes
    const zf = d - t - 3.0; // lanes | front hall
    const xT = t + 2.2;
    const xS = w - t - 3.0;
    const W = w - 2 * t;
    const n = Math.max(1, Math.floor((W - 1.3) / (BLOCK + 1.3)));
    const aisle = (W - n * BLOCK) / (n + 1);
    const aisleX = (i: number): number => t + i * (aisle + BLOCK);
    // The kitchen door opens off the aisle that lies in front of the kitchen, furthest right.
    let ka = 1;
    for (let i = 0; i <= n; i++) {
      const c = aisleX(i) + aisle / 2;
      if (c > xT + 0.9 && c < xS - 0.9) ka = i;
    }

    k.floor(0, 'tileFloor');
    const side = (from: number, to: number, m: number) => k.evenly(from, to, m).map((z) => k.window(z, (to - from) / m - 0.6, { sill: 1.0, head: 2.4, broken: k.rand() < 0.25 }));
    k.outerWalls(0, {
      mat: 'plaster', tint: wall, parapet: 0.8,
      front: [...k.evenly(0.6, w / 2 - 1.2, 2).map((x) => k.window(x, (w / 2 - 1.8) / 2 - 0.3, { sill: 0.3, head: 2.6, broken: k.rand() < 0.3 })), k.door(w / 2, 'open', ARCH.door.wide), ...k.evenly(w / 2 + 1.2, w - 0.6, 2).map((x) => k.window(x, (w / 2 - 1.8) / 2 - 0.3, { sill: 0.3, head: 2.6, broken: k.rand() < 0.3 }))],
      back: [k.window((xT + xS) / 2, 1.6, { sill: 1.4 }), k.door(w - t - 1.2, k.rand() < 0.4 ? 'open' : 'locked')],
      left: side(zk + 0.5, d - 0.6, 3),
      right: side(zk + 0.5, d - 0.6, 3),
    });
    k.roofFlat({ mat: 'concrete', parapet: 0.8, parapetMat: 'plaster', tint: wall });
    // The big sign standing on the roof, the name band, lanterns by the door.
    sign(k, w / 2 - 4.0, k.eaves + 0.3, d - 1.2, w / 2 + 4.0, k.eaves + 2.2, d - 0.9, brand);
    k.box(-1, w / 2 - 3.8, k.eaves, d - 1.1, w / 2 + 3.8, k.eaves + 0.3, d - 1.0, 'steel', { layer: 'shell', solid: false });
    sign(k, 0.6, y + 2.75, d, w - 0.6, k.eaves - 0.2, d + 0.12, 1 - brand);
    for (const x of [w / 2 - 1.4, w / 2 + 1.4]) k.box(-1, x - 0.22, y + 1.8, d + 0.05, x + 0.22, y + 2.5, d + 0.5, 'sign', { layer: 'shell', tint: 0.55, solid: false });

    // Front hall: waiting benches by the glass, the register at the right.
    const F = k.room(0, t, zf, w - t, d - t, 'canteen');
    k.furniture(0, t + 0.4, d - t - 0.55, t + 2.6, d - t, 0.45, 'fabric', { tint: 0.3 });
    k.furniture(0, w - t - 2.6, d - t - 0.55, w - t - 0.4, d - t, 1.05, 'counter', { tint: brand, search: { kind: 'counter', face: 'z-', table: 'sales' } });
    k.stain(0, w / 2 - 0.9, d - t - 1.5, w / 2 + 0.9, d - t - 0.4, 'debris');

    // Lanes and aisles.
    const holes = [k.door(t + aisle / 2 - t), k.door(aisleX(ka) + aisle / 2 - t)];
    const L = zf - 0.1 - (zk + P + 0.1);
    const nb = Math.max(1, Math.floor((L + 0.1) / 2.05));
    for (let i = 0; i <= n; i++) {
      const a = k.room(0, aisleX(i), zk + P, aisleX(i) + aisle, zf, 'canteen');
      k.join(a, F);
      if (i === n) break;
      const bx = aisleX(i) + aisle;
      const lx = bx + 1.5;
      holes.push(k.window(lx + 0.225 - t, 0.7, { sill: 0.8, head: 1.4, broken: true }));
      k.furniture(0, lx, zk + P, lx + 0.45, zf - 0.9, 0.95, 'steel', { tint: 0.6 });
      for (let j = 0; j < nb; j++) {
        const a0 = zk + P + 0.1 + j * 2.05;
        const s = j === 0 && i % 2 === 0;
        booth(k, 0, 'z', a0, a0 + 1.95, bx, bx + 1.5, brand, s ? { kind: 'table', face: 'x-' } : undefined);
        booth(k, 0, 'z', a0, a0 + 1.95, lx + 0.45, lx + 1.95, brand, j === nb - 1 && i % 2 === 1 ? { kind: 'table', face: 'x+' } : undefined);
      }
    }
    if (k.rand() < 0.8) k.stain(0, aisleX(ka) + 0.2, (zk + zf) / 2, aisleX(ka) + aisle - 0.2, (zk + zf) / 2 + 1.6);

    // The back band: toilet, kitchen, store.
    k.partition(0, t, zk, w - t, zk, holes);
    k.partition(0, xT, t, xT, zk - P);
    k.partition(0, xS, t, xS, zk - P, [k.door((t + zk) / 2 - t)]);
    k.room(0, t, t, xT - P, zk - P, 'toilet');
    k.furniture(0, t, t + 0.3, t + 0.5, t + 1.0, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x+', table: 'toilet' } });
    k.room(0, xT + P, t, xS - P, zk - P, 'kitchen');
    k.furniture(0, xT + 0.5, t, xS - 1.5, t + 0.7, 0.9, 'steel', { tint: 0.5, search: { kind: 'counter', face: 'z+', table: 'kitchen' } });
    k.furniture(0, xS - 0.8, t + 0.3, xS - P, t + 1.0, 1.8, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'kitchen' } });
    const ax = aisleX(ka) + aisle / 2;
    if (ax - 1.0 - (xT + 1.0) > 1.0) k.furniture(0, xT + 1.0, t + 1.8, ax - 1.0, zk - 1.0, 0.9, 'steel', { tint: 0.3 });
    k.room(0, xS + P, t, w - t, zk - P, 'storage');
    k.furniture(0, xS + P, zk - 0.6, w - t - 1.0, zk - P, 1.9, 'shelf', { search: { kind: 'shelf', face: 'z-', table: 'grocery' } });
    k.furniture(0, w - t - 0.9, zk - 1.6, w - t, zk - 0.7, 0.9, 'wood', { tint: 0.4, search: { kind: 'crate', face: 'x-', table: 'storage' } });
    return k.finish();
  },
};
