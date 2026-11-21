// 庁舎風ビル (07d-2c): a twelve-storey office block built like a town hall (a private company's HQ or a
// rented "government" annex — not 07d-2d's public buildings). Symmetrical: a stair core at each
// end of the back, a corridor the full width in front of them, offices along the front and
// between the cores. Pale stone grid of tall windows; on the ground floor, the counter hall the
// whole width of the front — a long counter with numbered windows, benches for the queue, the
// staff's desks behind — entered through a columned porch. The second, seventh (the assembly
// room) and top (the president's) floors can be entered too; the rest are locked at both stairs.
// On the roof: two stair houses, the helipad, the antenna, the flag pole.
//
//   +------+--------+--------+------+
//   | core | office | store  | core |
//   +--D---+---D----+---D----+--D---+
//   |            corridor           |
//   +----D-----+-----D-----+-----D--+
//   | office   |  office   | office |      ground floor: one counter hall
//   +==========+===[D]=====+========+

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef, RoomUse } from '../../types.ts';
import {
  canteen, coreAt, coreLevel, coreRoof, curtain, guardRail, helipad, mast, meeting, officeDesks, P, roofPlant, SW, spaced, storeRoom, twoPass, waiting,
  type Fit,
} from './common.ts';

export const OFFICE_CHOSHA: BuildingDef = {
  id: 'office.chosha',
  category: 'office',
  variant: 'chosha',
  kind: 'office',
  size: { w: [30, 36], d: [18, 22] },
  storeys: 12,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.45,
  roof: 'flat',
  roofRise: 8.0,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_CHOSHA, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = 0.35;
  k.thick = t;
  const stone = k.rand();
  const y1 = k.levelY(1);
  const top = k.eaves + ARCH.rail.parapet;
  const coreW = 2 * P + SW + (2 * P + 2.0) + (2 * P + 1.8);
  const L = coreAt(k, t + P, t + P, { shafts: 1, wc: true, hall: 2.0 });
  const R = coreAt(k, w - t - P - coreW, t + P, { shafts: 1, wc: true, hall: 2.0 });
  const zc0 = L.z1 + P; // corridor's back
  const zc = zc0 + 2.2; // corridor's front wall (centre)
  const xm = (L.x1 + R.x0) / 2; // between the cores: office | store
  const fronts = 3;
  const fw = (w - 2 * t) / fronts;
  const fx = Array.from({ length: fronts + 1 }, (_, i) => t + i * fw);
  const open = new Set([0, 1, 6, k.storeys - 1]);

  // ---- Outside: the porch, the ground floor, the stone grid above.
  k.outerWalls(0, {
    mat: 'plaster', tint: stone, y1,
    front: [k.window(w * 0.2, w * 0.22, { sill: 0.4, head: 3.0, broken: k.rand() < 0.4 }), k.door(w / 2, 'open', ARCH.door.wide), k.window(w * 0.8, w * 0.22, { sill: 0.4, head: 3.0 })],
    back: [k.door(xm, 'locked'), k.window(xm - 4, 2.4, { sill: 1.2 }), k.window(xm + 4, 2.4, { sill: 1.2 })],
    left: [k.window(d * 0.7, 2.4)],
    right: [k.window(d * 0.7, 2.4)],
  });
  for (const x of [w / 2 - 4.5, w / 2 - 1.8, w / 2 + 1.8, w / 2 + 4.5]) k.box(-1, x - 0.3, -0.3, d, x + 0.3, y1 - 0.2, d + 0.55, 'plaster', { layer: 'shell', tint: stone, solid: false });
  k.box(-1, w / 2 - 5.2, y1 - 0.5, d - 0.3, w / 2 + 5.2, y1, d + 0.6, 'plaster', { layer: 'shell', tint: stone, solid: false });
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    const long = side === 'front' || side === 'back';
    const along = long ? w : d - 2 * t;
    const lo = long ? 0 : t;
    curtain(k, { side, from: 1, to: k.storeys, y1: top, t, mat: 'plaster', tint: stone, sill: 0.8, drop: 0.7, piers: spaced(lo + 0.6, lo + along - 0.6, long ? 2.2 : 3.0), pier: 1.0, broken: k.rand() < 0.6 ? [[1 + Math.floor(k.rand() * 10), lo + along * 0.6, lo + along * 0.7]] : [] });
  }

  for (let level = 0; level < k.storeys; level++) {
    const ground = level === 0;
    const isOpen = open.has(level);
    k.floor(level, ground ? 'tileFloor' : 'carpet');
    for (const c of [L, R]) {
      const { wc } = coreLevel(k, level, c, { front: [{ x: (c.hall[0] + c.hall[2]) / 2, state: isOpen ? 'open' : 'locked', width: 1.2, steel: !isOpen }], tint: stone, wcOpen: isOpen });
      if (wc >= 0) f.ensure(wc, 'cabinet', 'toilet');
    }
    if (!isOpen) {
      // Locked storey: the desks seen through the windows (drawn only).
      const y = k.levelY(level);
      for (let i = 0; i < fronts; i++) k.box(level, fx[i]! + 1.5, y, zc + 2.5, fx[i + 1]! - 1.5, y + 0.75, zc + 3.9, 'wood', { solid: false, tint: 0.5 });
      continue;
    }
    // Corridor, the rooms behind it between the cores, the rooms in front.
    const corridor = k.room(level, t, zc0, w - t, zc - P, 'hall');
    const lockStore = level !== 0 && k.rand() < 0.5;
    k.partition(level, L.x1, L.z1, R.x0, L.z1, [k.door((L.x1 + xm) / 2 - L.x1), k.door((xm + R.x0) / 2 - L.x1, lockStore ? 'locked' : 'open')]);
    k.partition(level, xm, t, xm, L.z1 - P);
    const backUses: RoomUse[] = level === k.storeys - 1 ? ['canteen', 'storage'] : ['office', 'storage'];
    const b1 = k.room(level, L.x1 + P, t, xm - P, L.z1 - P, backUses[0]!);
    const b2 = k.room(level, xm + P, t, R.x0 - P, L.z1 - P, backUses[1]!, { locked: lockStore });
    if (backUses[0] === 'canteen') canteen(f, b1);
    else officeDesks(f, b1, { tint: 0.4 });
    if (!lockStore) storeRoom(f, b2, 'office');
    f.ensure(b1, 'desk', backUses[0]);
    if (f.chance(0.4)) f.stain(corridor);
    if (ground) {
      // The counter hall: the counter in segments with gaps, the staff's desks behind, benches in front.
      k.partition(0, t, zc, w - t, zc, fx.slice(0, -1).map((x) => k.door(x + fw / 2 - t)));
      const hall = k.room(0, t, zc + P, w - t, d - t, 'lobby');
      const zq = zc + P + 2.4;
      for (let x = t + 1.0; x + 3.0 < w - t - 0.8; x += 3.6) f.put(hall, [x, zq, x + 3.0, zq + 0.6], 1.0, 'counter', { tint: stone, search: { kind: 'counter', face: 'z-', table: 'office' } });
      f.grid(hall, 2.4, 1.4, 1.5, 1.2, (r) => f.put(hall, r, 0.72, 'wood', { tint: 0.5 }), [t, zc + P, w - t, zq], 10);
      waiting(f, hall, 'lobby');
      for (let i = 0; i < 2; i++) f.stain(hall, i === 0 ? 'blood' : 'debris', 1.6);
      continue;
    }
    const locks = fx.slice(0, -1).map((_, i) => i !== 1 && k.rand() < 0.3);
    k.partition(level, t, zc, w - t, zc, fx.slice(0, -1).map((x, i) => k.door(x + fw / 2 - t, locks[i] ? 'locked' : 'open')));
    for (let i = 0; i < fronts; i++) {
      if (i > 0) k.partition(level, fx[i]!, zc + P, fx[i]!, d - t);
      const r = k.room(level, fx[i]! + (i > 0 ? P : 0), zc + P, fx[i + 1]! - (i < fronts - 1 ? P : 0), d - t, 'office', { locked: locks[i] });
      if (locks[i]) continue;
      if (level === 6 && i === 1) {
        // The assembly room: one long table.
        meeting(f, r);
        f.grid(r, 1.2, 0.6, 0.9, 1.0, (q) => f.put(r, q, 0.72, 'wood', { tint: 0.2 }), undefined, 12);
      } else if (level === k.storeys - 1 && i === 1) {
        f.put(r, [(fx[1]! + fx[2]!) / 2 - 1.2, d - t - 2.4, (fx[1]! + fx[2]!) / 2 + 1.2, d - t - 1.4], 0.76, 'woodDark', { search: { kind: 'desk', face: 'z-', table: 'office' } });
        f.row(r, 'x-', 2.2, 0.9, 0.8, 'fabric', { max: 2, tint: 0.1 });
      } else officeDesks(f, r, { tint: 0.5 });
      f.ensure(r, 'desk', 'office');
    }
  }

  // ---- Roof: two stair houses, the helipad in front, the antenna between the houses, the flag pole.
  k.roofFlat({ mat: 'concrete', tint: stone });
  const RL = k.storeys;
  for (const c of [L, R]) coreRoof(k, c, { tint: stone });
  const front = k.room(RL, t, L.z1 + 0.1, w - t, d - t, 'roof');
  const back = k.room(RL, L.x1 + 0.1, t, R.x0 - 0.1, L.z1 + 0.1, 'roof');
  k.join(back, front);
  const rd = d - t - (L.z1 + 0.1);
  if (rd > 7) helipad(k, w / 2, L.z1 + 0.1 + rd / 2, Math.min(rd - 1.2, 14));
  guardRail(k, t, top);
  mast(k, xm, t + 1.0, k.eaves + 7.8);
  f.reserve(back, [xm - 0.5, t, xm + 0.5, t + 1.5]);
  roofPlant(f, [back], { units: 4 });
  f.ensure(front, 'crate', 'roof');
  f.ensure(back, 'crate', 'roof');
  // Flag pole on the front parapet's middle (thin, solid).
  k.box(-1, w / 2 - 0.06, top, d - t / 2 - 0.06, w / 2 + 0.06, k.eaves + 7.5, d - t / 2 + 0.06, 'steel', { layer: 'shell' });
  k.box(-1, w / 2 + 0.06, k.eaves + 6.0, d - t / 2 - 0.02, w / 2 + 1.6, k.eaves + 7.0, d - t / 2 + 0.02, 'paper', { layer: 'shell', solid: false });
}

