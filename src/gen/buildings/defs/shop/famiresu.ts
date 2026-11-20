// ファミレス (07d-2b). One storey with a glass front: the waiting lobby with the register and the drink
// bar, a long aisle along the back of the dining room that every door opens onto, booths along the
// front and the side windows and four-seat tables in between. The kitchen (pass window to the aisle,
// a walk-in fridge) and the two toilets are behind the aisle.
//
//   +------------------------+------+------+
//   | kitchen      [pass]  D |toilet|toilet|   back door locked
//   +-----------------------D+---D--+---D--+
//   |            aisle                       |
//   | lobby |  tables    tables              |
//   | drink |                        booths  |
//   +--D----+==booths==booths==booths========+  z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, sign } from './common.ts';

export const SHOP_FAMIRESU: BuildingDef = {
  id: 'shop.famiresu',
  category: 'shop',
  variant: 'famiresu',
  kind: 'shop',
  size: { w: [18, 24], d: [14, 18] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 2.0,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_FAMIRESU, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const y = k.levelY(0);
    const zk = t + 4.5; // kitchen and toilets | aisle
    const zs = zk + P + 1.6; // aisle | dining room
    const xv = t + 3.2; // lobby | dining room
    const xk = w - t - 5.0; // kitchen | toilets
    const xm = xk + 2.5; // toilet | toilet
    const tint = k.rand();
    const colour = k.rand();
    const doorX = (t + xv) / 2;
    const broken = (): boolean => k.rand() < 0.3;

    k.floor(0, 'vinyl', undefined, { tint: colour });
    const panes = k.evenly(xv + 0.2, w - 0.3, Math.max(3, Math.round((w - xv) / 3.2)));
    const pw = (w - 0.5 - xv) / panes.length - 0.3;
    k.outerWalls(0, {
      mat: 'plaster', tint,
      front: [k.door(doorX, 'open', 1.6), ...panes.map((x) => k.window(x, pw, { sill: 0.7, head: 2.7, broken: broken() }))],
      back: [k.door(t + 1.4, 'locked'), k.window((xk + xm) / 2, 0.6, { sill: 1.6 }), k.window((xm + w - t) / 2, 0.6, { sill: 1.6 })],
      left: [k.window((zs + d) / 2, 1.6, { sill: 0.7, head: 2.7 })],
      right: k.evenly(zs + 0.2, d - 0.3, 2).map((z) => k.window(z, (d - zs) / 2 - 0.6, { sill: 0.7, head: 2.7, broken: broken() })),
    });
    k.roofFlat({ mat: 'concrete', parapet: 0.8, tint });
    sign(k, 0.3, w * 0.55, k.eaves - 0.6, k.eaves + 0.75, colour);
    // The tall sign on the roof's corner.
    k.box(-1, w - 1.6, k.eaves, d - 1.6, w - 1.3, k.eaves + 1.2, d - 1.3, 'steel', { layer: 'shell' });
    k.box(-1, w - 3.2, k.eaves + 0.9, d - 1.3, w - 0.3, k.eaves + 2.0, d - 1.15, 'sign', { layer: 'shell', tint: colour, solid: false });

    // --- kitchen and toilets ---
    k.partition(0, t, zk, w - t, zk, [k.window((t + xk) / 2 - t, 1.8, { sill: 1.0, head: 1.9, broken: true }), k.door(xk - 1.0 - t), k.door((xk + xm) / 2 - t), k.door((xm + w - t) / 2 - t)]);
    k.partition(0, xk, t, xk, zk - P);
    k.partition(0, xm, t, xm, zk - P);
    k.room(0, t, t, xk - P, zk - P, 'kitchen');
    k.room(0, xk + P, t, xm - P, zk - P, 'toilet');
    k.room(0, xm + P, t, w - t, zk - P, 'toilet');
    k.furniture(0, t + 2.4, t, xk - 2.2, t + 0.7, 0.9, 'steel', { tint: 0.8, search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } }); // range
    k.furniture(0, t + 2.4, t + 1.9, xk - 2.6, t + 2.7, 0.9, 'steel', { tint: 0.85 }); // prep island
    k.furniture(0, xk - 1.6, t, xk - P, t + 1.6, 2.2, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'grocery' } }); // walk-in fridge
    k.furniture(0, t, t + 2.4, t + 0.7, zk - P - 0.2, 1.8, 'shelf', { search: { kind: 'shelf', face: 'x+', table: 'kitchen' } });
    for (const [, x1] of [[xk + P, xm - P], [xm + P, w - t]] as const) k.furniture(0, x1 - 0.5, t + 0.2, x1, t + 0.7, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x-', table: 'toilet' } });

    // --- the aisle, the lobby, the dining room ---
    const aisle = k.room(0, t, zk + P, w - t, zs, 'canteen');
    const lobby = k.room(0, t, zs, xv - P, d - t, 'lobby');
    const dining = k.room(0, xv + P, zs, w - t, d - t, 'canteen');
    k.join(aisle, lobby);
    k.join(aisle, dining);
    k.partition(0, xv, zs + 0.6, xv, d - t, [], { mat: 'wood', y1: y + 1.2 }); // low divider with planters
    k.furniture(0, t, zs + 0.5, t + 0.6, d - t - 1.8, 1.0, 'counter', { tint: colour, search: { kind: 'counter', face: 'x+', table: 'canteen' } }); // drink bar
    k.furniture(0, xv - 0.75, zs + 0.3, xv - P, zs + 1.4, 1.0, 'counter', { tint: 0.2, search: { kind: 'counter', face: 'x-', table: 'sales' } }); // register
    // Booths: bench, table, bench against the front wall and the right wall.
    const booth = (x0: number, z0: number, x1: number, z1: number, along: 'x' | 'z', search: boolean): void => {
      const s = 0.55;
      const bt = k.rand();
      if (along === 'x') {
        k.furniture(0, x0, z0, x0 + s, z1, 1.05, 'fabric', { tint: bt });
        k.furniture(0, x0 + s, z0, x1 - s, z1, 0.72, 'wood', { tint: 0.5, search: search ? { kind: 'table', face: 'z-', table: 'canteen' } : undefined });
        k.furniture(0, x1 - s, z0, x1, z1, 1.05, 'fabric', { tint: bt });
      } else {
        k.furniture(0, x0, z0, x1, z0 + s, 1.05, 'fabric', { tint: bt });
        k.furniture(0, x0, z0 + s, x1, z1 - s, 0.72, 'wood', { tint: 0.5, search: search ? { kind: 'table', face: 'x-', table: 'canteen' } : undefined });
        k.furniture(0, x0, z1 - s, x1, z1, 1.05, 'fabric', { tint: bt });
      }
    };
    const bx1 = w - t - 1.6;
    const nf = Math.floor((bx1 - xv - 0.3) / 1.9);
    for (let i = 0; i < nf; i++) booth(xv + 0.3 + i * 1.9, d - t - 1.4, xv + 0.3 + i * 1.9 + 1.85, d - t, 'x', i % 2 === 0);
    const nr = Math.floor((d - t - zs - 1.4) / 1.9);
    for (let i = 0; i < nr; i++) booth(w - t - 1.4, zs + 1.2 + i * 1.9, w - t, zs + 1.2 + i * 1.9 + 1.85, 'z', i === 0);
    // Four-seat tables in between, clear of the way in from the aisle.
    const joinX = (xv + P + w - t) / 2;
    for (let x = xv + 1.4; x + 0.9 < w - t - 2.2; x += 2.4) {
      if (Math.abs(x + 0.45 - joinX) < 1.3) continue;
      for (let z = zs + 1.5; z + 0.9 < d - t - 2.4; z += 2.2) {
        k.furniture(0, x, z, x + 0.9, z + 0.9, 0.72, 'wood', { tint: 0.5 });
        for (const [cx, cz] of [[x - 0.45, z + 0.25], [x + 0.95, z + 0.25]] as const) k.furniture(0, cx, cz, cx + 0.4, cz + 0.4, 0.45, 'fabric', { tint: colour, solid: false });
      }
    }
    // A table on its side, blood by a booth.
    k.box(0, xv + 0.6, y, zs + 0.2, xv + 1.5, y + 0.72, zs + 0.3, 'wood', { tint: 0.5, role: 'furniture', solid: false });
    if (k.rand() < 0.8) k.stain(0, joinX + 1.6, d - t - 2.6, joinX + 2.8, d - t - 1.5);
    return k.finish();
  },
};
