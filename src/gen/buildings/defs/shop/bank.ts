// 地方銀行の支店 (07d-2b). One storey, flat roof with the bank's sign on the parapet.
//
//   +-----------+----------------+------+
//   | vault (L) | staff room  [Dx]| WC   |    vault door locked (steel); the back door is seeded open / locked
//   +---DL------+-----------D----+--D---+
//   |  office: desks, cabinets          |
//   |       teller desks                |
//   +--------+=====counter (low)====[g] |    the teller counter is a low wall with a gate at its right end
//   | ATM    S   lobby: benches, rack   |    S: the ATM corner's shutter to the lobby is down
//   | corner |                          |
//   +--[D]---+=glass=====glass====[D]===+    front: ATM corner door, main automatic door (stuck open)

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, sign, toppled } from './common.ts';

export const SHOP_BANK: BuildingDef = {
  id: 'shop.bank',
  category: 'shop',
  variant: 'bank',
  kind: 'shop',
  size: { w: [16, 20], d: [14, 17] },
  storeys: 1,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 1.4,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_BANK, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const y = k.levelY(0);
    const brand = k.rand();
    const stone = k.rand();
    const zC = d - t - k.range(4.8, 5.4); // counter line
    const zB = t + 3.6; // office | back rooms
    const xA = t + 3.4; // ATM corner | lobby
    const xV = t + 4.4; // vault | staff room
    const xW = w - t - 2.4; // staff room | toilet
    const mainX = w - t - 2.4;
    const gateX = w - t - 0.7;
    const staffDoor = w - t - 3.2;
    const backDoor = w - t - 4.4;

    k.floor(0, 'tileFloor');
    const lobbyWins = k.evenly(xA + 0.3, mainX - 1.1, Math.max(2, Math.round((mainX - xA - 1.4) / 2.6)));
    const pane = (mainX - 1.1 - xA - 0.3) / lobbyWins.length - 0.3;
    k.outerWalls(0, {
      mat: 'concrete', tint: stone, parapet: 0.8,
      front: [
        k.door((t + xA) / 2, 'open', ARCH.door.wide),
        ...lobbyWins.map((x) => k.window(x, pane, { sill: 0.1, head: 2.7, broken: k.rand() < 0.35 })),
        k.door(mainX, 'open', ARCH.door.wide),
      ],
      back: [k.window(t + 2.2, 0.6, { sill: 1.8, head: 2.3 }), k.door(backDoor, k.rand() < 0.4 ? 'open' : 'locked'), k.window((xW + w - t) / 2, 0.6, { sill: 1.6 })],
      left: [k.window((zB + zC) / 2, 1.6, { sill: 1.2 }), k.window((zC + d - t) / 2, 0.9, { sill: 1.6 })],
      right: [k.window((zB + zC) / 2 - 1.0, 1.4, { sill: 1.2 }), k.window((zB + zC) / 2 + 1.0, 1.4, { sill: 1.2, broken: k.rand() < 0.5 })],
    });
    k.roofFlat({ mat: 'concrete', parapet: 0.8, parapetMat: 'concrete', tint: stone });
    // The bank's name along the parapet and the ATM sign by its door.
    sign(k, 1.0, k.eaves - 0.2, d, w - 1.0, k.eaves + 0.65, d + 0.12, brand);
    sign(k, t + 0.4, y + 2.25, d, xA - 0.4, y + 2.75, d + 0.1, 1 - brand);
    // Night safe slot beside the main door.
    k.box(-1, mainX + 1.05, y + 0.9, d - 0.02, mainX + 1.45, y + 1.3, d + 0.05, 'steel', { layer: 'shell', solid: false });

    // ATM corner (its own door; the shutter to the lobby is down).
    k.partition(0, t, zC, xA, zC);
    k.partition(0, xA, zC + P, xA, d - t, [k.door((d - t - zC) / 2, 'shutter', 1.6)]);
    k.room(0, t, zC + P, xA - P, d - t, 'lobby');
    for (const x of k.evenly(t + 0.15, xA - P - 0.15, 3)) {
      k.furniture(0, x - 0.45, zC + P, x + 0.45, zC + P + 0.7, 1.55, 'appliance', { tint: 0.1, search: x < t + 1.5 ? { kind: 'cabinet', face: 'z+', table: 'office' } : undefined });
    }
    k.stain(0, t + 0.6, d - t - 2.6, t + 1.8, d - t - 1.7);

    // Lobby: benches, a rack of leaflets, the ticket machine by the gate.
    k.partition(0, xA + P, zC, w - t, zC, [k.door(gateX - xA - P, 'open')], { mat: 'counter', tint: brand, y1: y + 1.05 });
    k.room(0, xA + P, zC + P, w - t, d - t, 'lobby');
    const benchX1 = Math.min(mainX - 2.0, xA + 6.5);
    for (const z of [zC + 1.6, zC + 3.0]) k.furniture(0, xA + 1.2, z, benchX1, z + 0.55, 0.45, 'fabric', { tint: 0.4 });
    k.furniture(0, xA + P, zC + 0.6, xA + 0.5, zC + 1.5, 1.6, 'shelf', { search: { kind: 'shelf', face: 'x+', table: 'lobby' } });
    k.furniture(0, gateX - 1.2, zC + 0.3, gateX - 0.75, zC + 0.7, 1.3, 'appliance', { tint: 0.5 });
    if (k.rand() < 0.6) toppled(k, 0, xA + 1.2, zC + 3.9, benchX1, zC + 4.4, 'fabric');
    k.stain(0, mainX - 0.8, d - t - 1.6, mainX + 0.8, d - t - 0.5, 'debris');

    // Office behind the counter.
    const vaultDoor = k.door(2.2, 'locked');
    vaultDoor.leaf = 'doorSteel';
    k.partition(0, t, zB, w - t, zB, [vaultDoor, k.door(staffDoor - t, 'open'), k.door((xW + w - t) / 2 - t, 'open')]);
    k.room(0, t, zB + P, w - t, zC - P, 'office');
    const deskX1 = w - t - 4.6;
    for (let x = xA + 0.6; x + 1.2 <= deskX1; x += 1.5) {
      k.furniture(0, x, zC - 1.45, x + 1.2, zC - 0.75, 0.72, 'wood', { tint: 0.55, search: x === xA + 0.6 ? { kind: 'desk', face: 'z-', table: 'office' } : undefined });
    }
    for (let x = t + 1.8; x + 1.4 <= deskX1; x += 2.6) k.furniture(0, x, zB + 0.9, x + 1.4, zB + 1.7, 0.72, 'wood', { tint: 0.5 });
    k.furniture(0, t, zB + 0.5, t + 0.5, zC - 0.5, 1.8, 'steel', { tint: 0.8, search: { kind: 'cabinet', face: 'x+', table: 'office' } });
    k.stain(0, t + 2.0, zB + 1.9, t + 3.6, zB + 2.6, 'paper');
    if (k.rand() < 0.7) k.stain(0, xA + 1.0, zC - 0.7, xA + 2.2, zC - 0.2);

    // Back: the vault (locked steel door), the staff room, the toilet.
    k.partition(0, xV, t, xV, zB - P);
    k.partition(0, xW, t, xW, zB - P);
    k.room(0, t, t, xV - P, zB - P, 'storage', { locked: true });
    k.furniture(0, t, t, xV - P, t + 0.5, 2.0, 'steel', { tint: 0.9 });
    k.room(0, xV + P, t, xW - P, zB - P, 'backroom');
    k.furniture(0, xV + P, t + 0.3, xV + 0.6, zB - 0.6, 1.8, 'steel', { tint: 0.6, search: { kind: 'locker', face: 'x+', table: 'closet' } });
    k.furniture(0, xV + 1.6, t + 1.0, xV + 3.0, t + 2.0, 0.72, 'wood', { tint: 0.3 });
    k.furniture(0, xV + 3.4, t, xV + 4.1, t + 0.7, 1.7, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'kitchen' } });
    k.room(0, xW + P, t, w - t, zB - P, 'toilet');
    k.furniture(0, w - t - 0.5, t + 0.2, w - t, t + 0.9, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x-', table: 'toilet' } });
    return k.finish();
  },
};
