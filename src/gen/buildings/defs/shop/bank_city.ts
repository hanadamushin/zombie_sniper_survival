// 都市銀行の大型支店 (07d-2b): three storeys of stone and glass. A switchback stair in the back-left
// corner opens onto a staff hall that runs across the back of every floor; the dead lift, the toilets
// and the back rooms (the vault downstairs — locked, steel door) are behind it. Ground floor: the
// public lobby behind the glass front, the teller counter (a low wall with a gate), the office behind
// it, and the ATM corner with its own door. First floor: the loan office and a meeting room. Second
// floor: the staff canteen and the branch manager's office.
//
//   every floor (back)                          ground (front)
//   +------+------+-----------+-----+           +-------------------------------+
//   |stair | lift |  vault /  | WC  |           |  office: desks, cabinets      |
//   |      |  (x) |  store    |     |           +==== counter (low) ======g+-----+
//   +  =   +--DL--+----D------+--D--+           |  lobby: benches          S ATM |
//   |  staff hall                   D back door |                          |     |
//   +-------D-----------------D-----+           +=====glass====[door]======+[D]--+

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Hole } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { clearOfWays, facade, P, sign, table, toppled } from './common.ts';

const LANE = ARCH.stair.wideWidth;

export const SHOP_BANK_CITY: BuildingDef = {
  id: 'shop.bank_city',
  category: 'shop',
  variant: 'bank_city',
  kind: 'office',
  size: { w: [22, 28], d: [18, 22] },
  storeys: 3,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.4,
  roof: 'flat',
  roofRise: 2.2,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_BANK_CITY, params, rng);
    const { w, d } = k;
    const t = 0.3;
    k.thick = t;
    const stone = k.rand();
    const brand = k.rand();
    const n = Math.ceil(k.def.storeyHeight / 2 / ARCH.stair.maxRise - 1e-6);
    const zh = t + n * ARCH.stair.going + ARCH.stair.landing; // stairwell front = staff hall's back
    const zh1 = zh + 1.8; // staff hall | front rooms
    const xc = t + 2.7; // stair column | back rooms
    const xw = w - t - 2.6; // back rooms | toilets
    const shaft: [number, number, number, number] = [xc + 0.2, zh - P - 2.0, xc + 2.2, zh - P];
    k.shaft(shaft, 0, k.storeys - 1);
    const top = k.storeys - 1;
    const parapet = ARCH.rail.parapet;
    const yTop = k.eaves + parapet;
    const y1 = k.levelY(1);

    // ---- Outside: the stone front (glass at the ground, a pilaster facade above), plain sides and back.
    const xA = w - t - 3.6; // lobby | ATM corner
    const zC = d - t - 6.0; // office | lobby (the counter)
    const mainDoor = (t + xA) / 2;
    const ext = { mat: 'concrete' as const, tint: stone, exterior: true, layer: 'shell' as const };
    k.wall(0, 0, d - t, w, d, [
      k.window((t + mainDoor - 1.0) / 2 + 0.1, mainDoor - 1.0 - t - 0.6, { sill: 0.2, head: 3.0, broken: k.rand() < 0.4 }),
      { ...k.door(mainDoor, 'open', ARCH.door.wide), head: 2.6 },
      k.window((mainDoor + 1.0 + xA) / 2, xA - mainDoor - 1.6, { sill: 0.2, head: 3.0, broken: k.rand() < 0.3 }),
      k.door((xA + w - t) / 2, 'open', ARCH.door.wide),
    ], { ...ext, y1 });
    const piers = Array.from({ length: Math.round(w / 3.2) + 1 }, (_, i) => 0.3 + ((w - 0.6) * i) / Math.round(w / 3.2));
    facade(k, { axis: 'x', u0: 0, u1: w, t0: d - t, t1: d, from: 1, to: k.storeys, y0: y1, y1: yTop, piers, pier: 0.55, sill: 0.7, head: 2.9, mat: 'concrete', tint: stone, pierMat: 'slate', broken: 0.08 });
    for (let level = 0; level < k.storeys; level++) {
      const o = { ...ext, y1: level === top ? yTop : k.levelY(level + 1) };
      k.wall(level, 0, 0, w, t, [k.window((xc + xw) / 2, 1.6, { sill: 1.2 })], o);
      k.wall(level, 0, t, t, d - t, [k.window((zh1 + d) / 2 - t, 2.4, { sill: 0.9 })], o);
      const right: Hole[] = [k.window((zh1 + d) / 2 - t, 2.4, { sill: 0.9 })];
      if (level === 0) right.unshift(Object.assign(k.door((zh + zh1) / 2 - t, k.rand() < 0.4 ? 'open' : 'locked'), { leaf: 'doorSteel' as const }));
      k.wall(level, w - t, t, w, d - t, right, o);
    }
    k.roofFlat({ mat: 'concrete', tint: stone });
    // The bank's name over the ground floor and on the parapet, the canopy over the door.
    sign(k, 0.6, y1 - 0.75, d, w - 0.6, y1 - 0.1, d + 0.15, brand);
    sign(k, w * 0.25, k.eaves + 0.2, d - 0.3, w * 0.75, k.eaves + 2.1, d - 0.15, brand);
    k.box(-1, mainDoor - 2.0, k.levelY(0) + 2.9, d, mainDoor + 2.0, k.levelY(0) + 3.05, d + 0.6, 'slate', { layer: 'shell', solid: false });

    // ---- Every floor: stair, staff hall, lift, back rooms, toilet.
    for (let level = 0; level < k.storeys; level++) {
      const y = k.levelY(level);
      k.floor(level, level === 0 ? 'tileFloor' : 'carpet');
      if (level < top) k.stairs({ level, start: [t + 0.05 + LANE / 2, zh], dir: 'z-', width: LANE, kind: 'switchback', turn: 'right', mat: 'concrete', tint: stone });
      else k.box(level, t + 0.05, y, zh - 0.06, t + 0.05 + LANE, y + ARCH.rail.height, zh, 'steel', { role: 'furniture' });
      k.partition(level, xc, t, xc, zh - P);
      k.partition(level, xc + 2.4, t, xc + 2.4, zh - P);
      k.partition(level, xw, t, xw, zh - P);
      const lift = Object.assign(k.door(xc + 1.2 - xc, 'locked'), { leaf: 'doorSteel' as const });
      const midUse = level === 0 ? 'storage' : level === 1 ? 'storage' : 'closet';
      const midLocked = level === 0;
      const mid = k.door((xc + 2.4 + xw) / 2 - xc, midLocked ? 'locked' : 'open');
      if (midLocked) mid.leaf = 'doorSteel';
      k.partition(level, xc, zh, w - t, zh, [lift, mid, k.door(xw + 1.0 - xc)]);
      k.room(level, xc + 2.4 + P, t, xw - P, zh - P, midUse, { locked: midLocked });
      if (midLocked) k.furniture(level, xc + 2.6, t, xw - 0.2, t + 0.5, 2.0, 'steel', { tint: 0.9 });
      else {
        k.furniture(level, xc + 2.4 + P, t, xw - 1.0, t + 0.55, 1.9, level === 1 ? 'shelf' : 'steel', { tint: 0.6, search: { kind: level === 1 ? 'shelf' : 'locker', face: 'z+', table: level === 1 ? 'office' : 'closet' } });
      }
      k.room(level, xw + P, t, w - t, zh - P, 'toilet');
      k.furniture(level, w - t - 0.5, t + 0.2, w - t, t + 0.9, 0.85, 'appliance', { search: { kind: 'cabinet', face: 'x-', table: 'toilet' } });
      k.room(level, t, zh + P, w - t, zh1 - P, 'hall');
      if (k.rand() < 0.4) k.stain(level, xc + 1.0, zh + 0.3, xc + 2.6, zh1 - 0.3);
    }

    // ---- Ground: office, counter, lobby, ATM corner.
    const gateX = xA - 0.7;
    k.partition(0, t, zh1, w - t, zh1, [k.door(gateX - t), k.door(t + 1.4 - t)]);
    k.room(0, t, zh1 + P, w - t, zC - P, 'office');
    const ow: [number, number][] = [[gateX, zh1 + 0.61], [gateX, zC - 0.61], [t + 1.4, zh1 + 0.61]];
    let firstDesk = true;
    for (let x = t + 2.2; x + 1.4 < w - t - 1.6; x += 2.2) {
      for (let z = zh1 + 1.6; z + 0.8 < zC - 1.0; z += 2.0) {
        const r: [number, number, number, number] = [x, z, x + 1.4, z + 0.8];
        if (!clearOfWays(ow, [r[0] - 0.55, r[1] - 0.55, r[2] + 0.55, r[3] + 0.55], 0.3)) continue;
        k.furniture(0, r[0], r[1], r[2], r[3], 0.72, 'wood', { tint: 0.55, search: firstDesk ? { kind: 'desk', face: 'z-', table: 'office' } : undefined });
        firstDesk = false;
      }
    }
    k.furniture(0, w - t - 0.5, zh1 + 0.5, w - t, zC - 0.5, 1.9, 'steel', { tint: 0.8, search: { kind: 'cabinet', face: 'x-', table: 'office' } });
    k.partition(0, t, zC, xA, zC, [k.door(gateX - t)], { mat: 'counter', tint: brand, y1: k.levelY(0) + 1.05 });
    k.partition(0, xA, zC, w - t, zC);
    k.partition(0, xA, zC + P, xA, d - t, [k.door((d - t - zC) / 2, 'shutter', 1.6)]);
    k.room(0, t, zC + P, xA - P, d - t, 'lobby');
    const lw: [number, number][] = [[mainDoor, d - t - 0.7], [gateX, zC + 0.61]];
    for (const [cx, cz] of [[t + 2.6, zC + 2.0], [t + 2.6, zC + 3.6], [xA - 3.2, zC + 3.4]] as const) {
      const r: [number, number, number, number] = [cx - 1.4, cz - 0.3, cx + 1.4, cz + 0.3];
      if (clearOfWays(lw, r, 0.4)) k.furniture(0, r[0], r[1], r[2], r[3], 0.45, 'fabric', { tint: brand });
    }
    k.furniture(0, t, zC + 0.6, t + 0.45, zC + 2.0, 1.5, 'shelf', { search: { kind: 'shelf', face: 'x+', table: 'lobby' } });
    k.search(0, (t + gateX) / 2, zC + 0.75, 'counter', 'lobby');
    k.stain(0, mainDoor - 1.2, d - t - 1.8, mainDoor + 1.2, d - t - 0.5, 'debris');
    if (k.rand() < 0.7) k.stain(0, gateX - 2.0, zC - 1.4, gateX - 0.6, zC - 0.4);
    k.room(0, xA + P, zC + P, w - t, d - t, 'lobby');
    for (const x of k.evenly(xA + P + 0.1, w - t - 0.1, 2)) k.furniture(0, x - 0.5, zC + P, x + 0.5, zC + 0.8, 1.55, 'appliance', { tint: 0.1 });
    k.search(0, (xA + w - t) / 2, zC + 1.3, 'cabinet', 'office');

    // ---- First floor: loan office and meeting room.
    const xq = t + (w - 2 * t) * 0.6;
    k.partition(1, t, zh1, w - t, zh1, [k.door(1.4), k.door(xq + 1.4 - t)]);
    k.partition(1, xq, zh1 + P, xq, d - t);
    k.room(1, t, zh1 + P, xq - P, d - t, 'office');
    for (let x = t + 2.4; x + 1.4 < xq - 0.6; x += 2.4) {
      for (let z = zh1 + 2.0; z + 0.8 < d - t - 0.8; z += 2.2) {
        const first = x === t + 2.4 && z === zh1 + 2.0;
        k.furniture(1, x, z, x + 1.4, z + 0.8, 0.72, 'wood', { tint: 0.5, search: first ? { kind: 'desk', face: 'z-', table: 'office' } : undefined });
      }
    }
    k.furniture(1, t, zh1 + 2.0, t + 0.5, d - t - 1.0, 1.9, 'steel', { tint: 0.8, search: { kind: 'cabinet', face: 'x+', table: 'office' } });
    k.room(1, xq + P, zh1 + P, w - t, d - t, 'office');
    table(k, 1, (xq + w - t) / 2 + 0.3, (zh1 + d) / 2 + 0.8, Math.min(1.4, w - t - xq - 3.2), Math.max(2.0, d - zh1 - 6.0), { chairs: ['x+', 'x-'], tint: 0.2 });
    k.search(1, (xq + w - t) / 2 + 0.3, d - t - 0.8, 'table', 'office');
    if (k.rand() < 0.6) toppled(k, 1, xq + 0.6, d - t - 1.4, xq + 2.2, d - t - 0.8, 'wood');

    // ---- Second floor: canteen and the manager's office.
    k.partition(2, t, zh1, w - t, zh1, [k.door(1.4), k.door(xq + 1.4 - t)]);
    k.partition(2, xq, zh1 + P, xq, d - t);
    k.room(2, t, zh1 + P, xq - P, d - t, 'canteen');
    k.furniture(2, t, zh1 + 1.6, t + 0.7, d - t - 2.0, 0.9, 'counter', { tint: 0.4, search: { kind: 'counter', face: 'x+', table: 'kitchen' } });
    for (let x = t + 3.0; x + 0.7 < xq - 0.8; x += 2.6) {
      for (let z = zh1 + 2.2; z + 0.5 < d - t - 0.8; z += 2.4) table(k, 2, x, z, 1.4, 0.8, { chairs: ['z+', 'z-'], tint: 0.6 });
    }
    k.room(2, xq + P, zh1 + P, w - t, d - t, 'office');
    k.furniture(2, w - t - 2.6, d - t - 2.4, w - t - 0.8, d - t - 1.6, 0.75, 'woodDark', { search: { kind: 'desk', face: 'z-', table: 'office' } });
    k.furniture(2, w - t - 0.6, zh1 + 0.8, w - t, zh1 + 2.0, 1.4, 'steel', { tint: 0.2, search: { kind: 'cabinet', face: 'x-', table: 'office' } });
    k.furniture(2, xq + 0.6, (zh1 + d) / 2 - 0.9, xq + 1.3, (zh1 + d) / 2 + 0.9, 0.8, 'fabric', { tint: brand });
    k.stain(2, xq + 1.6, (zh1 + d) / 2 - 0.8, xq + 3.2, (zh1 + d) / 2 + 0.6);
    return k.finish();
  },
};
