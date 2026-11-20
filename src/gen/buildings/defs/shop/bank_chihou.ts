// 地方銀行の支店 (07d-2b). One storey: the customers' lobby behind the glass front, the teller counter
// (windows over it, broken), the back office, and along the back wall the vault (locked, a steel
// door), the staff room and the toilet. The ATM corner has its own door from the street; its
// shutter to the lobby is down.
//
//   +--------+-----------+-----+
//   | vault  | staff (D) |toilt|   back door locked
//   |(locked)D(steel)  D |  D  |
//   +--------+-----------+-----+
//   | office: desks, lockers   |
//   +ATM wall+=teller windows=D+   counter line (staff door at the right end)
//   | ATM    S lobby  benches  |
//   +--D-----+=====[auto]=glass+   z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, sign } from './common.ts';

export const SHOP_BANK_CHIHOU: BuildingDef = {
  id: 'shop.bank_chihou',
  category: 'shop',
  variant: 'bank_chihou',
  kind: 'shop',
  size: { w: [16, 20], d: [14, 17] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 1.0,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_BANK_CHIHOU, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const y = k.levelY(0);
    const zb = t + 3.6; // back rooms | office
    const zc = zb + P + 4.6; // office | lobby (the counter line)
    const xa = t + 3.0; // ATM corner | lobby
    const xv = t + 4.5; // vault | staff room
    const xt = w - t - 2.0; // staff room | toilet
    const doorX = xa + 2.6;
    const tint = k.rand();
    const colour = k.rand();

    k.floor(0, 'tileFloor');
    const glassFrom = doorX + 1.1;
    k.outerWalls(0, {
      mat: 'concrete', tint,
      front: [k.door((t + xa) / 2, 'open', 1.2), k.door(doorX, 'open', ARCH.door.wide), k.window((glassFrom + w - 0.4) / 2, w - 0.4 - glassFrom, { sill: 0.4, head: 2.8, broken: k.rand() < 0.35 })],
      back: [k.door((xv + xt) / 2, 'locked'), k.window((xt + w - t) / 2, 0.6, { sill: 1.6 })],
      left: [k.window((zb + zc) / 2, 1.4, { sill: 1.2 })],
      right: [k.window((zb + zc) / 2, 1.4, { sill: 1.2 }), k.window((zc + d) / 2, 1.8, { sill: 0.6, head: 2.6 })],
    });
    k.roofFlat({ mat: 'concrete', parapet: 0.9, tint });
    sign(k, xa + 0.4, w - 0.4, k.eaves - 0.75, k.eaves + 0.8, colour);
    sign(k, t + 0.4, xa - 0.4, 2.6, 3.2, colour, { mat: 'paper' }); // ATM

    // --- back rooms ---
    k.partition(0, t, zb, w - t, zb, [{ ...k.door((t + xv) / 2 - t, 'locked', 1.0), leaf: 'doorSteel' }, k.door(xt - 0.9 - t), k.door((xt + w - t) / 2 - t)]);
    k.partition(0, xv, t, xv, zb - P, [], { mat: 'concrete' });
    k.partition(0, xt, t, xt, zb - P);
    k.room(0, t, t, xv - P, zb - P, 'storage', { locked: true });
    k.room(0, xv + P, t, xt - P, zb - P, 'kitchen');
    k.room(0, xt + P, t, w - t, zb - P, 'toilet');
    k.furniture(0, t, t, xv - P, t + 0.6, 2.2, 'steel', { tint: 0.4, search: { kind: 'locker', face: 'z+', table: 'office' } }); // safe-deposit boxes
    k.furniture(0, xv + P, t, xv + 1.6, t + 0.6, 0.9, 'counter', { search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } });
    k.furniture(0, xv + 1.7, t, xv + 2.4, t + 0.7, 1.8, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'kitchen' } });
    k.furniture(0, w - t - 0.5, t + 0.2, w - t, t + 0.7, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x-', table: 'toilet' } });

    // --- office ---
    k.room(0, t, zb + P, w - t, zc - P, 'office');
    const tellers = k.evenly(xa + 0.4, w - t - 2.2, Math.max(2, Math.floor((w - t - 2.2 - xa - 0.4) / 2.6)));
    k.partition(0, t, zc, w - t, zc, [...tellers.map((x) => k.window(x - t, 1.7, { sill: 1.05, head: 2.3, broken: true })), k.door(w - t - 1.0 - t)]);
    tellers.forEach((x, i) => {
      k.furniture(0, x - 1.0, zc - P - 1.3, x + 1.0, zc - P - 0.6, 0.72, 'wood', { tint: 0.6, search: i === 0 ? { kind: 'desk', face: 'z-', table: 'office' } : undefined });
    });
    const backDesks = Math.max(1, Math.floor((w * 0.55 - t - 1.0) / 2.0));
    for (let i = 0; i < backDesks; i++) {
      const x = t + 1.0 + i * 2.0;
      k.furniture(0, x, zb + P + 0.9, x + 1.4, zb + P + 1.6, 0.72, 'wood', { tint: 0.6, search: i === backDesks - 1 ? { kind: 'desk', face: 'z+', table: 'office' } : undefined });
    }
    k.furniture(0, t, zb + P + 1.9, t + 0.5, zc - P - 1.6, 1.8, 'steel', { tint: 0.7, search: { kind: 'locker', face: 'x+', table: 'office' } });
    // Papers all over the floor, a chair thrown down.
    k.stain(0, xa + 1.0, zb + 2.2, xa + 3.4, zb + 3.0, 'paper');
    k.box(0, t + 3.0, y, zc - P - 2.3, t + 3.6, y + 0.45, zc - P - 1.7, 'fabric', { tint: 0.2, role: 'furniture' });

    // --- lobby and the ATM corner ---
    k.partition(0, xa, zc + P, xa, d - t, [k.door((zc + P + d - t) / 2 - zc - P, 'shutter', 1.6)], { mat: 'concrete' });
    k.room(0, xa + P, zc + P, w - t, d - t, 'lobby');
    k.room(0, t, zc + P, xa - P, d - t, 'lobby');
    k.furniture(0, xa + 0.4, zc + P, w - t - 2.2, zc + P + 0.5, 1.05, 'counter', { tint: colour, search: { kind: 'counter', face: 'z+', table: 'office' } });
    for (let z = zc + 1.4; z + 0.6 < d - t - 1.4; z += 1.4) k.furniture(0, xa + P + 0.25, z, xa + P + 1.0, z + 0.6, 0.45, 'fabric', { tint: colour });
    k.furniture(0, t, zc + P + 0.4, t + 0.7, d - t - 1.6, 1.6, 'appliance', { tint: 0.85, search: { kind: 'counter', face: 'x+', table: 'office' } }); // ATMs
    if (k.rand() < 0.75) k.stain(0, doorX + 0.6, zc + 1.4, doorX + 1.8, zc + 2.4);
    return k.finish();
  },
};
