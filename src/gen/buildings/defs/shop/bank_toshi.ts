// 都市銀行の大型支店 (07d-2b). Three storeys of stone and glass. Ground floor: the lobby, the long
// teller counter, the back office and the vault (locked); the ATM corner has its own door. A staff
// hall behind the counter holds the stair core, which serves the floors above: consultation rooms
// and archives on 2F, the manager's office, the staff room and the locker room on 3F.
//
//   ground                                   2F / 3F
//   +-----+-----------------+--------+       +-----+---------------------+
//   |stair| office          | vault  |       |stair| back room           |
//   |core |                 |(locked)|       |core +--D------------------+
//   +-----+                 |        |       |hall D mid room             |
//   |hall D                 |        |       |     +---------------------+
//   +--D--+==teller windows=+--------+       |     D front room          |
//   | lobby          benches | ATM   |       +-----+---------------------+
//   +======glass====[auto]===+--D----+   z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Kit } from '../../kit.ts';
import type { BuildingDef, RoomUse } from '../../types.ts';
import { capRail, core, coreSize, facade, P, sign } from './common.ts';

/** Furnish an upper-floor room entered at its left wall (x = r.x0) at z = doorZ. */
function furnish(k: Kit, level: number, x0: number, z0: number, x1: number, z1: number, use: RoomUse, kind: string, tint: number): void {
  const keep = x0 + 1.5;
  switch (kind) {
    case 'booths': {
      // Consultation booths: low partitions along the far wall, a desk in each.
      const n = Math.max(2, Math.floor((z1 - z0) / 2.2));
      for (let i = 0; i < n; i++) {
        const za = z0 + ((z1 - z0) * i) / n;
        k.furniture(level, x1 - 1.6, za + 0.3, x1, za + 1.1, 0.72, 'wood', { tint, search: i === 0 ? { kind: 'desk', face: 'x-', table: use } : undefined });
        if (i > 0) k.furniture(level, x1 - 2.2, za - 0.05, x1, za + 0.05, 1.4, 'frame', { tint: 0.8 });
      }
      return;
    }
    case 'meeting': {
      k.furniture(level, keep + 0.8, z0 + 1.2, x1 - 1.2, z1 - 1.2, 0.72, 'woodDark', { search: { kind: 'table', face: 'z-', table: use } });
      return;
    }
    case 'archive': {
      for (let x = keep; x + 0.6 < x1 - 0.8; x += 1.6) k.furniture(level, x, z0 + 0.8, x + 0.6, z1 - 0.8, 2.1, 'steel', { tint: 0.6, search: x === keep ? { kind: 'shelf', face: 'x-', table: 'office' } : undefined });
      return;
    }
    case 'manager': {
      k.furniture(level, x1 - 2.6, z0 + 0.9, x1 - 1.0, z0 + 1.7, 0.75, 'woodDark', { search: { kind: 'desk', face: 'z+', table: 'office' } });
      k.furniture(level, x1 - 0.5, z0 + 0.3, x1, z1 - 0.3, 2.0, 'woodDark', { tint: 0.3 });
      k.furniture(level, keep + 0.6, z1 - 1.6, keep + 2.6, z1 - 0.8, 0.42, 'fabric', { tint: 0.1 });
      return;
    }
    case 'staff': {
      k.furniture(level, keep + 0.6, z0 + 1.0, x1 - 1.4, z0 + 2.0, 0.72, 'wood', { tint: 0.7 });
      k.furniture(level, x1 - 0.7, z0, x1, z0 + 0.8, 1.8, 'appliance', { search: { kind: 'fridge', face: 'x-', table: 'kitchen' } });
      k.furniture(level, x1 - 2.0, z1 - 0.6, x1 - 0.8, z1, 0.9, 'counter', { search: { kind: 'cabinet', face: 'z-', table: use } });
      return;
    }
    default: {
      // Lockers.
      for (let x = keep; x + 1.8 < x1 - 0.2; x += 2.4) k.furniture(level, x, z0, x + 1.8, z0 + 0.5, 1.8, 'steel', { tint, search: x === keep ? { kind: 'locker', face: 'z+', table: 'barracks' } : undefined });
    }
  }
}

export const SHOP_BANK_TOSHI: BuildingDef = {
  id: 'shop.bank_toshi',
  category: 'shop',
  variant: 'bank_toshi',
  kind: 'office',
  size: { w: [20, 26], d: [16, 20] },
  storeys: 3,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.4,
  roof: 'flat',
  roofRise: 1.6,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_BANK_TOSHI, params, rng);
    const { w, d } = k;
    const t = 0.3;
    k.thick = t;
    const y = k.levelY(0);
    const { cw, depth } = coreSize(k);
    const xh = t + cw; // hall | rooms (centre line)
    const zh = t + depth; // core | hall
    const zc = d - t - 6.0; // counter line
    const xa = w - t - 3.5; // lobby | ATM corner
    const xv = w - t - 4.2; // office | vault
    const z1 = zh + 2.5; // upper floors: back | mid room
    const z2 = (z1 + d - t) / 2; // mid | front room
    const stone = k.rand();
    const colour = k.rand();
    const doorX = (xh + xa) / 2;

    // --- ground floor ---
    k.floor(0, 'tileFloor');
    k.outerWalls(0, {
      mat: 'concrete', tint: stone,
      front: [
        k.window((t + doorX - 1.0) / 2, doorX - 1.0 - t - 0.6, { sill: 0.3, head: 3.0, broken: k.rand() < 0.3 }),
        k.door(doorX, 'open', ARCH.door.wide),
        k.window((doorX + 1.0 + xa) / 2, xa - doorX - 1.0 - 0.6, { sill: 0.3, head: 3.0 }),
        k.door((xa + w - t) / 2, 'open', 1.2),
      ],
      back: [k.window(xh + 2.0, 1.2, { sill: 1.6 })],
      left: [k.window((zh + zc) / 2, 0.8, { sill: 1.4 })],
      right: [k.window((zc + d) / 2, 1.6, { sill: 0.6, head: 2.8 })],
    });
    core(k, 0, t, zh);
    k.partition(0, xh, t, xh, zc - P, [k.door((zh + zc) / 2 - t)], { mat: 'concrete' });
    k.room(0, t, zh, xh - P, zc - P, 'hall');
    k.room(0, xh + P, t, xv - P, zc - P, 'office');
    k.partition(0, xv, t, xv, zc - P, [{ ...k.door((t + zc) / 2 - t, 'locked', 1.0), leaf: 'doorSteel' }], { mat: 'concrete' });
    k.room(0, xv + P, t, w - t, zc - P, 'storage', { locked: true });
    k.furniture(0, w - t - 0.6, t + 0.5, w - t, zc - P - 0.5, 2.2, 'steel', { tint: 0.4, search: { kind: 'locker', face: 'x-', table: 'office' } });
    // Teller counter: windows over it and the staff door at the left end into the hall.
    const tellers = k.evenly(xh + 0.8, xv - 0.6, Math.max(2, Math.floor((xv - xh - 1.4) / 2.6)));
    k.partition(0, t, zc, w - t, zc, [k.door(t + cw / 2 - t), ...tellers.map((x) => k.window(x - t, 1.8, { sill: 1.05, head: 2.4, broken: true }))]);
    tellers.forEach((x, i) => k.furniture(0, x - 1.0, zc - P - 1.3, x + 1.0, zc - P - 0.6, 0.72, 'wood', { tint: 0.55, search: i % 2 === 0 ? { kind: 'desk', face: 'z-', table: 'office' } : undefined }));
    for (let x = xh + 1.6; x + 1.4 < xv - 1.0; x += 2.4) k.furniture(0, x, t + 0.9, x + 1.4, t + 1.6, 0.72, 'wood', { tint: 0.55 });
    k.stain(0, xh + 2.0, zc - 3.2, xh + 4.2, zc - 2.4, 'paper');
    // Lobby: the customers' side of the counter, benches, the ATM corner behind its shutter.
    k.partition(0, xa, zc + P, xa, d - t, [k.door((zc + P + d - t) / 2 - zc - P, 'shutter', 1.6)], { mat: 'concrete' });
    k.room(0, t, zc + P, xa - P, d - t, 'lobby');
    k.room(0, xa + P, zc + P, w - t, d - t, 'lobby');
    k.furniture(0, xh + 0.6, zc + P, xa - 0.4, zc + P + 0.5, 1.05, 'counter', { tint: colour, search: { kind: 'counter', face: 'z+', table: 'office' } });
    for (let x = doorX + 1.4; x + 1.6 < xa - 0.6; x += 2.2) k.furniture(0, x, zc + 2.0, x + 1.6, zc + 2.6, 0.45, 'fabric', { tint: colour });
    k.box(0, t + 0.4, y, zc + 2.4, t + 2.0, y + 0.45, zc + 3.0, 'fabric', { tint: colour, role: 'furniture' }); // a bench thrown over
    k.furniture(0, w - t - 0.7, zc + P + 0.4, w - t, d - t - 1.8, 1.6, 'appliance', { tint: 0.85, search: { kind: 'counter', face: 'x-', table: 'office' } });
    if (k.rand() < 0.8) k.stain(0, doorX - 0.8, zc + 1.6, doorX + 0.6, zc + 2.6);

    // --- upper floors ---
    const plans: [string, string, string][] = [['booths', 'meeting', 'archive'], ['manager', 'staff', 'lockers']];
    const uses: Record<string, RoomUse> = { booths: 'office', meeting: 'office', archive: 'storage', manager: 'office', staff: 'canteen', lockers: 'office' };
    for (let level = 1; level < k.storeys; level++) {
      k.floor(level, 'carpet', undefined, { tint: colour });
      if (level < k.storeys - 1) core(k, level, t, zh);
      else capRail(k, level, t, zh);
      k.partition(level, xh, t, xh, d - t, [k.door((zh + z1) / 2 - t), k.door((z1 + z2) / 2 - t), k.door((z2 + d - t) / 2 - t)], { mat: 'concrete' });
      k.partition(level, xh + P, z1, w - t, z1);
      k.partition(level, xh + P, z2, w - t, z2);
      k.room(level, t, zh, xh - P, d - t, 'hall');
      const plan = plans[level - 1]!;
      const spans: [number, number][] = [[t, z1 - P], [z1 + P, z2 - P], [z2 + P, d - t]];
      plan.forEach((kind, i) => {
        const [za, zz] = spans[i]!;
        const locked = kind === 'archive' && k.rand() < 0.5;
        k.room(level, xh + P, za, w - t, zz, uses[kind]!, { locked });
        if (!locked) furnish(k, level, xh + P, za, w - t, zz, uses[kind]!, kind, colour);
      });
      if (k.rand() < 0.5) k.stain(level, t + 0.4, d - t - 2.6, t + 1.6, d - t - 1.4);
    }
    const pane = { mat: 'concrete' as const, tint: stone, win: 1.6, sill: 0.8, head: 2.8, parapet: 1.1 };
    facade(k, 'front', 1, [t + cw / 2, ...k.evenly(xh + 0.4, w - t - 0.4, 3)], { ...pane, broken: k.rand() < 0.5 ? [2] : [] });
    facade(k, 'back', 1, k.evenly(xh + 0.4, w - t - 0.4, 2), pane);
    facade(k, 'left', 1, [(zh + d - t) / 2], { ...pane, win: 1.0 });
    facade(k, 'right', 1, [(t + z1) / 2, (z1 + z2) / 2, (z2 + d - t) / 2], pane);
    k.roofFlat({ mat: 'concrete', tint: stone });
    // The bank's name along the top of the front, condenser units on the roof.
    sign(k, xh, w - 0.6, k.eaves + 0.15, k.eaves + 1.0, colour, { z: d - 0.05 });
    k.box(-1, xh + 1.0, k.eaves, t + 0.6, xh + 3.4, k.eaves + 1.3, t + 1.6, 'steel', { layer: 'shell', tint: 0.6 });
    return k.finish();
  },
};
