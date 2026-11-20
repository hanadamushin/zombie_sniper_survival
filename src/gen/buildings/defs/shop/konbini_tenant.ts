// コンビニ・テナント型 (07d-2b): the ground floor of a concrete building. Only the ground storey is
// drawn here — the slab on top is the building's first floor, so an office / apartment block (07d-2c)
// can stand its upper storeys on it (they start at levelY(1) = plinth + ARCH.storey.concrete). The
// building's own entrance is the narrow lobby on the left (mail boxes); the steel door at its end
// leads to the building's stair core, which is locked here.
//
//   +------+---------------------+
//   | core |  backroom     | WC  |
//   | (L)  +--D-------------+--D-+
//   |      |  B                  |
//   +--DL--+ s|c| a |g| a |cool  |    s staff strip, c counter (on the LEFT, by the door), g gondolas
//   |lobby |  F                  |
//   +-[D]--+===[door]===glass====+

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, sign } from './common.ts';

export const SHOP_KONBINI_TENANT: BuildingDef = {
  id: 'shop.konbini_tenant',
  category: 'shop',
  variant: 'konbini_tenant',
  kind: 'shop',
  size: { w: [9, 12], d: [14, 19] },
  storeys: 1,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 0.3,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_KONBINI_TENANT, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const y = k.levelY(0);
    const brand = k.rand();
    const concrete = k.rand();
    const xl = t + 1.8; // lobby | shop (partition centre)
    const xs = xl + P; // shop's left inside face
    const zL = d - t - k.range(4.5, 5.5); // lobby | stair core
    const zb = t + 3.0; // backroom | shop
    const zBb = zb + P + 1.5;
    const zFa = d - t - 1.8;
    const xc = xs + 0.9; // staff strip | counter
    const xa = xc + 0.7; // counter | first aisle
    const xr = w - t - 0.75; // coolers on the right wall
    const span = xr - xa;
    const n = Math.max(1, Math.floor((span - 1.2) / 2.1));
    const aisle = (span - n * 0.9) / (n + 1);
    const doorX = xa + aisle / 2 + 0.2;

    k.floor(0, 'tileFloor');
    const glass = k.evenly(doorX + 1.0, w - 0.4, 2).map((x) => k.window(x, (w - 0.4 - doorX - 1.0) / 2 - 0.25, { sill: 0.15, head: 2.75, broken: k.rand() < 0.3 }));
    k.outerWalls(0, {
      mat: 'concrete', tint: concrete,
      front: [k.door((t + xl) / 2, 'open', 1.2), k.door(doorX, 'open', ARCH.door.wide), ...glass],
      back: [k.door(xl + 1.4, 'locked')],
      left: [k.window((zL + d) / 2, 0.8, { sill: 1.4 })],
    });
    // The building's first-floor slab is this shop's roof (nothing stands on it here but a curb).
    k.roofFlat({ mat: 'concrete', tint: concrete, parapet: 0.25 });
    // Pillars stand proud of the front (drawn only past the footprint), the fascia sign over the shop, the building's name plate.
    for (const x of [0, xl - 0.25, w - 0.5]) k.box(-1, x, -0.3, d, x + 0.5, k.eaves, d + 0.25, 'concrete', { layer: 'shell', tint: concrete, solid: false });
    sign(k, xl + 0.3, y + 2.85, d + 0.02, w - 0.55, y + 3.25, d + 0.14, brand);
    k.box(-1, t + 0.2, y + 2.3, d, xl - 0.3, y + 2.6, d + 0.06, 'steel', { layer: 'shell', solid: false });

    // Lobby of the building and its (locked) stair core.
    k.partition(0, xl, t, xl, d - t);
    const core = k.door(0.9, 'locked');
    core.leaf = 'doorSteel';
    k.partition(0, t, zL, xl - P, zL, [core]);
    k.room(0, t, t, xl - P, zL - P, 'stairs', { locked: true });
    k.room(0, t, zL + P, xl - P, d - t, 'lobby');
    k.furniture(0, t, zL + 0.5, t + 0.35, zL + 2.3, 1.5, 'steel', { tint: 0.3, search: { kind: 'cabinet', face: 'x+', table: 'lobby' } });
    k.stain(0, t + 0.5, d - t - 2.2, xl - 0.4, d - t - 1.2);

    // Backroom and a toilet across the back.
    const xw = w - t - 1.6;
    k.partition(0, xs, zb, w - t, zb, [k.door(1.2), k.door(xw + 0.8 - xs)]);
    k.partition(0, xw, t, xw, zb - P);
    k.room(0, xs, t, xw - P, zb - P, 'backroom');
    k.furniture(0, xs + 2.0, t, xw - P - 0.3, t + 0.55, 2.0, 'shelf', { search: { kind: 'shelf', face: 'z+', table: 'storage' } });
    k.furniture(0, xs, t + 0.3, xs + 0.9, t + 1.2, 1.0, 'wood', { tint: 0.45, search: { kind: 'crate', face: 'x+', table: 'grocery' } });
    k.room(0, xw + P, t, w - t, zb - P, 'toilet');
    k.furniture(0, w - t - 0.5, t + 0.2, w - t, t + 0.8, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x-', table: 'toilet' } });

    // Sales floor: back aisle, front aisle, the staff strip behind the counter, aisles between the gondolas.
    const B = k.room(0, xs, zb + P, w - t, zBb, 'sales');
    const F = k.room(0, xs, zFa, w - t, d - t, 'sales');
    const staff = k.room(0, xs, zBb, xc, zFa, 'sales');
    k.join(B, staff);
    k.join(staff, F);
    k.furniture(0, xc, zBb + 0.6, xa, zFa - 0.4, 1.0, 'counter', { tint: brand, search: { kind: 'counter', face: 'x-', table: 'sales' } });
    k.furniture(0, xr, zBb, w - t, zFa, 2.0, 'appliance', { tint: 0.15, search: { kind: 'fridge', face: 'x-', table: 'grocery' } });
    for (let i = 0; i <= n; i++) {
      const ax = xa + i * (aisle + 0.9);
      const a = k.room(0, ax, zBb, ax + aisle, zFa, 'sales');
      k.join(B, a);
      k.join(a, F);
      if (i < n) k.furniture(0, ax + aisle, zBb + 0.2, ax + aisle + 0.9, zFa - 0.2, 1.5, 'shelf', { tint: brand, search: i === 0 ? { kind: 'shelf', face: 'x-', table: 'grocery' } : { kind: 'shelf', face: 'x+', table: i % 2 ? 'sales' : 'pharmacy' } });
    }
    // Magazine rack under the front glass, broken glass and blood by the door.
    k.furniture(0, w - t - 2.6, d - t - 0.4, w - t - 0.3, d - t, 1.1, 'shelf', { tint: 0.5 });
    k.stain(0, doorX - 0.7, d - t - 1.4, doorX + 0.8, d - t - 0.4, 'debris');
    if (k.rand() < 0.7) k.stain(0, xs + 0.1, zFa - 2.0, xc - 0.1, zFa - 0.3);
    return k.finish();
  },
};
