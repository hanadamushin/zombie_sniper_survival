// 古い RC の事務所 (07d-2c): a long, shallow three-storey concrete office of the 1960s. A corridor the
// full width of the building, the switchback stair at its left end, the service rooms behind it
// (toilet, tea room, the archive) and a row of offices facing the street — the middle one on the
// ground floor is the entrance hall. Mortar streaked with rust, steel sash windows in a row, some
// of them boarded up; cabinets lying on the floor and papers everywhere. An elevated water tank on
// a steel frame stands on the roof beside the stair house.
//
//   +-------+-----+-----+----------+
//   | stair | WC  | tea | archive  |
//   +-     -+--D--+--D--+----D-----+
//   |   corridor                   |
//   +---D------+---D---+-----D-----+
//   | office   | hall  |  office   |
//   +==========+-[D]---+===========+

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { flightDepth, kitchen, LANE, officeDesks, P, ringRooms, storeRoom, SW, twoPass, type Fit } from './common.ts';
import { rust } from '../shop/common.ts';

export const OFFICE_RC_OLD: BuildingDef = {
  id: 'office.rc_old',
  category: 'office',
  variant: 'rc_old',
  kind: 'office',
  size: { w: [15, 19], d: [10.5, 12.5] },
  storeys: 3,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 4.6,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_RC_OLD, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = ARCH.wall.concrete;
  k.thick = t;
  const tint = k.rand();
  const L = flightDepth(k.def.storeyHeight);
  const zs = t + L; // back of the corridor
  const zc = zs + 1.6; // front of the corridor
  const xb = t + SW + P; // stairwell | service rooms
  // Service rooms behind the corridor, offices in front.
  const svc = [xb, xb + 2.0, xb + 4.0, w - t].map((x, i) => (i === 0 || i === 3 ? x : x + P));
  const bays = 3;
  const bw = (w - 2 * t) / bays;
  const fx = Array.from({ length: bays + 1 }, (_, i) => t + i * bw);
  const top = k.storeys - 1;
  const boarded = new Set<string>();

  for (let level = 0; level < k.storeys; level++) {
    const ground = level === 0;
    const winsFront = fx.slice(0, -1).flatMap((x, i) => (ground && i === 1 ? [] : k.evenly(x + 0.3, x + bw - 0.3, 2).map((c) => {
      const broken = k.rand() < 0.3;
      if (level === top && k.rand() < 0.4) boarded.add(`${c}`);
      return k.window(c, Math.min(1.6, bw / 2 - 0.5), { sill: 0.85, head: 2.2, broken });
    })));
    k.outerWalls(level, {
      mat: 'mortar', tint, parapet: level === top ? 0.6 : 0,
      front: ground ? [...winsFront, k.door(t + 1.5 * bw, 'open', 1.6)] : winsFront,
      back: [k.window(t + SW / 2, 0.9, { sill: 1.5, head: 2.3 }), ...svc.slice(0, -1).map((x, i) => k.window((x + svc[i + 1]!) / 2, i === 2 ? 1.6 : 0.7, { sill: i === 2 ? 0.9 : 1.5 }))],
      left: [k.window((zc + d - t) / 2, 1.2, { broken: k.rand() < 0.3 })],
      right: [k.window((zc + d - t) / 2, 1.2), k.window((zs + zc) / 2, 0.8, { sill: 1.2 })],
    });
    k.floor(level, ground ? 'tileFloor' : 'vinyl');
    k.stairs({ level, start: [t + LANE / 2, zs], dir: 'z-', width: LANE, kind: 'switchback', turn: 'right', mat: 'concrete', tint });
    const corridor = k.room(level, t, zs, w - t, zc - P, 'hall');
    // Service rooms.
    k.partition(level, xb, t, xb, zs);
    k.partition(level, svc[1]! - P, t, svc[1]! - P, zs);
    k.partition(level, svc[2]! - P, t, svc[2]! - P, zs);
    const lockArchive = k.rand() < 0.35;
    k.partition(level, xb, zs, w - t, zs, [k.door((svc[0]! + svc[1]!) / 2 - xb), k.door((svc[1]! + svc[2]!) / 2 - xb), k.door((svc[2]! + w - t) / 2 - xb, lockArchive ? 'locked' : 'open')]);
    const wc = k.room(level, svc[0]! + P, t, svc[1]! - 2 * P, zs - P, 'toilet');
    const tea = k.room(level, svc[1]!, t, svc[2]! - 2 * P, zs - P, 'kitchen');
    const archive = k.room(level, svc[2]!, t, w - t, zs - P, 'storage', { locked: lockArchive });
    f.row(wc, 'z-', 0.6, 0.5, 0.85, 'appliance', { kind: 'cabinet', table: 'toilet', max: 1, tint: 0.9 });
    f.ensure(wc, 'cabinet', 'toilet');
    kitchen(f, tea);
    if (!lockArchive) storeRoom(f, archive, 'office');
    // The offices in front (the middle one on the ground floor is the entrance hall).
    const doors = fx.slice(0, -1).map((x, i) => {
      const locked = !ground && i !== 1 && k.rand() < 0.3;
      return { at: x + bw / 2 - t, locked, wide: ground && i === 1 };
    });
    k.partition(level, t, zc, w - t, zc, doors.map((q) => k.door(q.at, q.locked ? 'locked' : 'open', q.wide ? 1.6 : 0.9)));
    for (let i = 0; i < bays; i++) {
      if (i > 0) k.partition(level, fx[i]!, zc + P, fx[i]!, d - t);
      const x0 = fx[i]! + (i > 0 ? P : 0);
      const x1 = fx[i + 1]! - (i < bays - 1 ? P : 0);
      if (ground && i === 1) {
        const hall = k.room(0, x0, zc + P, x1, d - t, 'lobby');
        f.row(hall, 'x-', 0.5, 0.3, 1.5, 'steel', { kind: 'cabinet', table: 'lobby', max: 1, tint: 0.2 });
        f.ensure(hall, 'cabinet', 'lobby');
        continue;
      }
      const r = k.room(level, x0, zc + P, x1, d - t, 'office', { locked: doors[i]!.locked });
      if (doors[i]!.locked) continue;
      officeDesks(f, r, { tint: 0.45 });
      // Cabinets lying on the floor, papers.
      if (f.chance(0.6)) f.grid(r, 1.8, 0.5, 1.0, 1.0, (q) => f.chance(0.12) && f.put(r, q, 0.45, 'steel', { tint: 0.5, margin: 0.45 }));
      for (let n = 0; n < 2; n++) f.stain(r, 'debris', 0.8);
      f.ensure(r, 'desk', 'office');
    }
    if (f.chance(0.5)) f.stain(corridor);
  }

  // Outside: rust streaks under the windows, boards over some top-floor windows.
  rust(k, 0.5, w - 0.5, d + 0.005, k.levelY(1) - 1.0, k.levelY(1) + 0.2);
  rust(k, 0.5, w - 0.5, d + 0.005, k.eaves - 1.0, k.eaves + 0.4);
  const yb = k.levelY(top);
  for (const c of boarded) {
    const x = Number(c);
    for (let i = 0; i < 3; i++) k.box(-1, x - 0.75, yb + 1.0 + i * 0.4, d, x + 0.75, yb + 1.22 + i * 0.4, d + 0.04, 'wood', { layer: 'shell', tint: 0.3, solid: false });
  }

  // Roof: the stair house over the stair and the corridor's end, the water tank on its frame.
  k.roofFlat({ mat: 'concrete', tint });
  const e = k.eaves;
  const R = k.storeys;
  const hx = xb + P; // the house's right wall (outside face)
  const opts = { mat: 'mortar' as const, tint, y0: e, y1: e + 2.6, layer: 'shell' as const };
  k.wall(R, 0, zc, hx + t, zc + t, [k.door(t + SW / 2)], opts);
  k.wall(R, hx, 0, hx + t, zc, [], opts);
  k.box(-1, 0, e + 0.6, 0, hx, e + 2.6, t, 'mortar', { layer: 'shell', tint });
  k.box(-1, 0, e + 0.6, t, t, e + 2.6, zc, 'mortar', { layer: 'shell', tint });
  k.box(-1, 0, e + 2.6, 0, hx + t, e + 2.8, zc + t, 'concrete', { layer: 'shell', tint });
  k.room(R, t, zs, hx, zc, 'stairs');
  const roof = ringRooms(k, R, [t, t, w - t, d - t], [0, 0, hx + t, zc + t], 'roof');
  // The tank on four legs in the back right corner of the roof.
  const tx1 = w - t - 0.3;
  const tx0 = tx1 - 2.4;
  const tz0 = t + 0.3;
  const tz1 = tz0 + 2.0;
  for (const [x, z] of [[tx0, tz0], [tx1 - 0.12, tz0], [tx0, tz1 - 0.12], [tx1 - 0.12, tz1 - 0.12]] as const) k.box(-1, x, e, z, x + 0.12, e + 2.0, z + 0.12, 'steel', { layer: 'shell', tint: 0.5 });
  k.box(-1, tx0, e + 2.0, tz0, tx1, e + 4.4, tz1, 'rust', { layer: 'shell', tint: 0.2 });
  if (roof.right !== undefined) f.reserve(roof.right, [tx0, tz0, tx1, tz1]);
  if (roof.back !== undefined) f.reserve(roof.back, [tx0, tz0, tx1, tz1]);
  for (const r of roof.all) {
    f.row(r, 'z+', 1.0, 0.7, 0.9, 'appliance', { max: 1, tint: 0.7 });
    f.ensure(r, 'crate', 'roof');
  }
}
