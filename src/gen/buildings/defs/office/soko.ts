// 倉庫兼事務所 (07d-2c): a steel-roofed warehouse with a two-storey office block in its front left
// corner. The warehouse is one double-height hall (racks in rows, pallets, a forklift) behind two
// loading bays on the street — one shutter down, one wide open (a brute fits through it). The
// office block: the counter and the locker room downstairs, the office and the break room upstairs
// with a window over the hall; a switchback stair in its back right corner. A gable roof of
// corrugated steel over everything.
//
//   +----------------------------------+
//   |  back hall (W2) |                |
//   |                 |                |
//   +-----+--stair----+   warehouse    |
//   |lockr|  |        |    (W1)        |
//   +--D--+  +        D                |
//   |  office (counter)               |
//   +==[D]============+=[shutter]=[open]+

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { canteen, flightDepth, LANE, officeDesks, P, SW, toppled, twoPass, type Fit } from './common.ts';

export const OFFICE_SOKO: BuildingDef = {
  id: 'office.soko',
  category: 'office',
  variant: 'soko',
  kind: 'warehouse',
  size: { w: [18, 24], d: [16, 22] },
  storeys: 2,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.2,
  roof: 'gable',
  roofRise: 1.8,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_SOKO, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = 0.2;
  k.thick = t;
  const tint = k.rand();
  const L = flightDepth(k.def.storeyHeight);
  const xo = t + Math.min(8.0, w * 0.36); // office block | warehouse (partition centre)
  const zo = d - t - 7.6; // back of the office block (partition centre)
  const zs = zo + P + L; // the stair's front (stairwell in the block's back right corner)
  const sx0 = xo - P - SW; // stairwell's left edge
  const e = k.eaves;

  // ---- Walls: the whole outside is one storey high to the eaves.
  const bay1 = xo + (w - xo) * 0.35;
  const bay2 = xo + (w - xo) * 0.75;
  k.outerWalls(0, {
    mat: 'metalRoof', tint, y1: e,
    front: [
      k.door((t + xo) / 2 - 0.8, 'open', 1.0),
      k.window((t + xo) / 2 + 1.4, 2.4, { sill: 0.9, head: 2.4, broken: k.rand() < 0.3 }),
      k.window((t + (t + xo) / 2 - 1.4) / 2, (xo - t) / 2 - 1.8, { sill: 4.5, head: 6.0, broken: k.rand() < 0.3 }),
      { ...k.door(bay1, 'shutter', 3.6), head: 4.2 },
      { ...k.door(bay2, 'open', 3.0), head: 4.2 },
    ],
    back: [k.door(w - 3.0, 'locked'), ...k.evenly(t + 2, w - 5, 3).map((x) => k.window(x, 2.0, { sill: 5.0, head: 6.2 }))],
    left: [k.window((zo + d) / 2, 1.6), k.window(d * 0.3, 2.0, { sill: 5.0, head: 6.2 })],
    right: k.evenly(t + 1.0, d - t - 1.0, 3).map((z) => k.window(z, 2.0, { sill: 5.0, head: 6.2, broken: k.rand() < 0.2 })),
  });
  k.roofGable({ mat: 'metalRoof', tint, axis: 'x' });

  // ---- Floors: the hall's slab, the office block's two floors.
  k.floor(0, 'concrete');
  k.floor(1, 'vinyl', [t, zo + P, xo - P, d - t]);
  k.stairs({ level: 0, start: [sx0 + LANE / 2, zs], dir: 'z-', width: LANE, kind: 'switchback', turn: 'right', mat: 'steel', tint: 0.4 });

  // ---- The office block's walls (both storeys) and rooms.
  const lockerX = sx0 - P; // locker / break room | stair
  for (const level of [0, 1]) {
    const y0 = k.levelY(level);
    const y1 = level === 0 ? k.levelY(1) - ARCH.slab : e;
    const opts = { y0, y1 };
    const ground = level === 0;
    // Towards the warehouse: a door downstairs, a window over the hall upstairs.
    k.partition(level, xo, zo, xo, d - t, ground ? [k.door(d - t - 1.6 - zo, 'open', 1.2)] : [k.window((d - t - zo) / 2 + 0.6, 2.4, { sill: 0.9, head: 2.0 })], opts);
    k.partition(level, t, zo, xo, zo, ground ? [k.door((lockerX - t) / 2, 'locked')] : [], opts);
    // The small room behind, beside the stair.
    k.partition(level, lockerX, zo + P, lockerX, zs, [], opts);
    k.partition(level, t, zs, lockerX, zs, [k.door((lockerX - t) / 2)], opts);
    const small = k.room(level, t, zo + P, lockerX - P, zs - P, ground ? 'storage' : 'canteen');
    const office = k.room(level, t, zs + P, xo - P, d - t, 'office');
    // The strip in front of the stair belongs to the office.
    if (ground) {
      f.row(small, 'z-', 0.45, 0.5, 1.8, 'steel', { kind: 'locker', table: 'storage', every: 3, max: 6, gap: 0.02 });
      f.ensure(small, 'locker', 'storage');
      f.row(office, 'z+', 2.6, 0.6, 1.0, 'counter', { kind: 'counter', table: 'office', max: 1, tint });
    } else {
      canteen(f, small, { counter: true });
      if (f.chance(0.5)) f.stain(small);
    }
    officeDesks(f, office, { tint: 0.5, dense: true });
    f.ensure(office, 'desk', 'office');
  }

  // ---- The warehouse: the main hall and the part behind the office block.
  const W1 = k.room(0, xo + P, t, w - t, d - t, 'storage');
  const W2 = k.room(0, t, t, xo + P, zo - P, 'storage');
  k.join(W1, W2);
  // Racks: long rows across the hall (search points on some), pallets, the forklift.
  let i = 0;
  f.row(W1, 'z-', 3.0, 1.0, 2.6, 'shelf', { kind: 'shelf', table: 'tools', every: 2, tint: 0.7, gap: 0.3 });
  f.row(W1, 'x+', 3.0, 1.0, 2.6, 'shelf', { kind: 'shelf', table: 'storage', every: 2, tint: 0.7, gap: 0.3 });
  f.grid(W1, 1.1, 4.0, 1.8, 1.8, (r) => {
    const table = (['storage', 'tools', 'grocery'] as const)[i % 3]!;
    const ok = f.put(W1, r, 2.6, 'shelf', { tint: 0.7, search: i % 2 === 0 ? { kind: 'shelf', face: 'x+', table } : undefined }) || f.put(W1, r, 2.6, 'shelf', { tint: 0.7 });
    if (ok) i++;
    return ok;
  }, [xo + P + 1.3, t + 1.0, w - t - 1.0, d - t - 5.5]);
  f.row(W2, 'z-', 2.4, 1.0, 2.6, 'shelf', { kind: 'shelf', table: 'storage', every: 2, max: 3, tint: 0.7 });
  f.grid(W1, 1.2, 1.2, 1.6, 1.6, (r) => f.chance(0.25) && f.put(W1, r, 0.9, 'wood', { tint: 0.4, search: { kind: 'crate', face: 'z+', table: 'storage' } }), [xo + P, d - t - 5.0, w - t, d - t]);
  // Forklift: body and mast (solid), its fork on the floor (low).
  const fx = xo + P + 1.5;
  if (f.put(W1, [fx, d - t - 4.2, fx + 1.2, d - t - 2.0], 1.3, 'sign', { tint: 0.9 })) {
    f.k.box(0, fx + 0.1, k.levelY(0) + 1.3, d - t - 3.0, fx + 1.1, k.levelY(0) + 2.2, d - t - 2.9, 'steel', { solid: false });
  }
  f.ensure(W1, 'crate', 'tools');
  f.ensure(W2, 'shelf', 'storage');
  toppled(f, W1, 'wood');
  if (f.chance(0.6)) f.stain(W1);
  f.stain(W1, 'debris', 2.0); // oil on the floor
}
