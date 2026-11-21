// 商店街の 3 階建て (07d-2c): a narrow shop-house on a shopping street. The shop on the ground floor
// is shuttered (nobody gets in); the family's door is the narrow one on the right, opening onto
// the strip that runs back to a narrow switchback stair. Upstairs: the shop's office and stock room
// on the first floor, the family's living room and tatami bedroom on the second, the drying deck
// on the roof. The front is 看板建築: a flat panel that stands up past the roof with the shop's name,
// and an arcade canopy over the pavement.
//
//   +-----------+-----+
//   | (store L) |stair|      first floor: office | stock     second: living | tatami
//   |           |     |
//   |   shop    +-  --+
//   |  (L)      |strip|
//   |           |     |
//   +==shutter==+-[D]-+

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { flightDepth, kitchen, officeDesks, P, ringRooms, storeRoom, toppled, twoPass, type Fit } from './common.ts';

const LN = ARCH.stair.width;
const SWN = 2 * LN + 0.15;

export const OFFICE_SHOTENGAI3: BuildingDef = {
  id: 'office.shotengai3',
  category: 'office',
  variant: 'shotengai3',
  kind: 'shop',
  size: { w: [5.5, 7.5], d: [11, 14] },
  storeys: 3,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 2.9,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_SHOTENGAI3, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = ARCH.wall.concrete;
  k.thick = t;
  const tint = k.rand();
  const brand = k.rand();
  const L = flightDepth(k.def.storeyHeight);
  const xs = w - t - SWN; // strip's inside left edge
  const xp = xs - P; // partition between the rooms and the strip
  const zs = t + L;
  const xa = w - t - LN / 2; // first flight (the second turns left, towards the rooms)
  const zm = Math.max(zs + 1.6, d * 0.45);

  for (let level = 0; level < k.storeys; level++) {
    const ground = level === 0;
    const rw = xp - P - t; // width of the rooms left of the strip
    k.outerWalls(level, {
      mat: 'mortar', tint,
      front: ground
        ? [k.door(t + rw / 2, 'shutter', Math.min(3.6, rw - 0.6)), k.door(xs + SWN / 2, 'open')]
        : [k.window(t + rw / 2, Math.min(2.4, rw - 0.8), { broken: k.rand() < 0.25 }), k.window(xs + SWN / 2, 0.7, { sill: 1.2 })],
      back: [k.window(t + rw / 2, 1.2, { sill: 1.1 })],
      left: ground ? [] : [k.window(d * 0.5 - t, 0.9, { sill: 1.2 })],
    });
    k.floor(level, ground ? 'concrete' : level === 2 ? 'flooring' : 'vinyl');
    k.stairs({ level, start: [xa, zs], dir: 'z-', width: LN, kind: 'switchback', turn: 'left', mat: 'wood', tint: 0.3 });
    const strip = k.room(level, xs, zs, w - t, d - t, ground ? 'genkan' : 'hall');
    if (ground) {
      // The shop and its store behind a locked door: shut.
      k.partition(0, xp, t, xp, d - t, [k.door(zs + 1.0 - t, 'locked')]);
      k.partition(0, t, zm, xp - P, zm, [k.door(rw / 2, 'locked')]);
      k.room(0, t, t, xp - P, zm - P, 'storage', { locked: true });
      k.room(0, t, zm + P, xp - P, d - t, 'sales', { locked: true });
      f.row(strip, 'x+', 0.9, 0.35, 1.0, 'wood', { kind: 'closet', table: 'genkan', max: 1, tint: 0.4 }); // shoe cupboard
      f.ensure(strip, 'closet', 'genkan');
      continue;
    }
    // Upper floors: two rooms off the strip, front and back.
    k.partition(level, xp, t, xp, d - t, [k.door(zs + 0.7 - t), k.door((zm + d - t) / 2 - t)]);
    k.partition(level, t, zm, xp - P, zm);
    if (level === 1) {
      const back = k.room(1, t, t, xp - P, zm - P, 'storage');
      const front = k.room(1, t, zm + P, xp - P, d - t, 'office');
      storeRoom(f, back, f.pick(['grocery', 'tools', 'storage'] as const));
      officeDesks(f, front, { tint: brand, dense: true });
      f.row(front, 'x-', 0.9, 0.45, 1.8, 'steel', { kind: 'cabinet', table: 'office', max: 2 });
      f.ensure(front, 'desk', 'office');
      if (f.chance(0.5)) toppled(f, back, 'shelf');
    } else {
      const back = k.room(2, t, t, xp - P, zm - P, 'tatami');
      const front = k.room(2, t, zm + P, xp - P, d - t, 'living');
      if (f.live) {
        const b = f.roomRect(back);
        k.stain(2, b[0], b[1], b[2], b[3], 'tatami');
      }
      f.row(back, 'z-', 1.7, 0.75, 1.9, 'wood', { kind: 'closet', table: 'closet', max: 1, tint: 0.6 }); // 押入
      f.row(back, 'x-', 2.0, 1.0, 0.3, 'fabric', { kind: 'bed', table: 'bedroom', max: 1, tint: 0.85 }); // futon
      f.ensure(back, 'bed', 'bedroom');
      kitchen(f, front);
      f.row(front, 'x-', 1.8, 0.9, 0.8, 'fabric', { max: 1, tint: f.rand() });
      if (f.chance(0.6)) f.stain(front);
    }
  }

  // Roof: the slab, the stair house over the strip's back, the drying deck; the front panel.
  k.roofFlat({ mat: 'concrete', tint });
  const e = k.eaves;
  const R = k.storeys;
  const zh = zs + 1.8;
  const ph = ARCH.rail.parapet;
  const opts = { mat: 'mortar' as const, tint, y0: e, y1: e + 2.6, layer: 'shell' as const };
  // Parapet on the back and left (the front is the tall panel, the right the stair house and a low wall).
  k.box(-1, 0, e, 0, xs - t, e + ph, t, 'mortar', { layer: 'shell', tint });
  k.box(-1, 0, e, t, t, e + ph, d - t, 'mortar', { layer: 'shell', tint });
  k.box(-1, w - t, e, zh, w, e + ph, d - t, 'mortar', { layer: 'shell', tint });
  k.wall(R, xs - t, zh - t, w, zh, [k.door(t + SWN / 2)], opts);
  k.wall(R, xs - t, 0, xs, zh - t, [], opts);
  k.box(-1, xs, e, 0, w, e + 2.6, t, 'mortar', { layer: 'shell', tint });
  k.box(-1, w - t, e, t, w, e + 2.6, zh - t, 'mortar', { layer: 'shell', tint });
  k.box(-1, xs - t, e + 2.6, 0, w, e + 2.75, zh, 'concrete', { layer: 'shell', tint });
  k.room(R, xs, zs, w - t, zh - t, 'stairs');
  const roof = ringRooms(k, R, [t, t, w - t, d - t], [xs - t, 0, w, zh], 'roof');
  // Drying poles (drawn only) and a water tank.
  if (roof.front !== undefined && f.live) {
    const r = f.roomRect(roof.front);
    for (const z of [r[1] + 1.2, r[3] - 0.6]) k.box(R, r[0] + 0.4, e, z, r[0] + 0.5, e + 1.8, z + 0.1, 'steel', { solid: false });
    k.box(R, r[0] + 0.45, e + 1.7, r[1] + 1.2, r[0] + 0.5, e + 1.75, r[3] - 0.5, 'steel', { solid: false });
  }
  for (const r of roof.all) f.row(r, 'z-', 1.2, 1.0, 1.3, 'rust', { kind: 'crate', table: 'roof', max: 1 });
  for (const r of roof.all) f.ensure(r, 'crate', 'roof');
  // 看板建築: the front wall goes on up as a flat panel past the roof, the shop's name on it, the arcade.
  k.box(-1, 0, e, d - t, w, e + 2.8, d, 'rust', { layer: 'shell', tint: brand });
  k.box(-1, 0.4, e + 0.6, d - 0.02, w - 0.4, e + 2.2, d + 0.05, 'sign', { layer: 'shell', tint: brand, solid: false });
  k.box(-1, 0, k.levelY(1) - 0.3, d, w, k.levelY(1) - 0.15, d + 0.6, 'steel', { layer: 'shell', solid: false, tint: 0.4 });
  k.box(-1, 0.3, k.levelY(0) + 2.4, d - 0.02, w - 0.3, k.levelY(0) + 2.9, d + 0.06, 'sign', { layer: 'shell', tint: k.rand(), solid: false });
}
