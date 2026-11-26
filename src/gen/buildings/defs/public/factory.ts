// Factories (07d-2d). The big halls keep a clear aisle along their door wall (the doors, the foot of
// the gallery stair and the store's door all open onto it); the machines stand behind it.
//
//   machi_koba    町工場: a 2 階 shed. The workshop below (a shutter and a door on the street, lathes
//                 and the press along the wall, the bench, a rack of steel stock), a straight stair
//                 to the office and the family's tatami room upstairs
//   factory_food  食品工場: the production hall (conveyor lines, mixers, packing tables, a cold store
//                 in the corner, a steel gallery along the front wall under the high windows), the
//                 2 階 office block with the staff canteen, trucks at the loading doors
//   factory_metal 金属加工工場: a sawtooth-roofed hall with the overhead crane, presses and lathes, racks
//                 and piles of steel (the `stock` table — much material), a gallery; the office block
//   factory_chem  化学工場: the tank yard inside its dike (four tanks, a pipe-rack gallery to shoot from,
//                 the stack), the drum warehouse (`fuel`), the 3 階 control building whose roof can be reached

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Kit, type Rect } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { rust } from '../shop/common.ts';
import { catwalk, hall, kitchen, lab, mesh, office, P, shelves, truck, wing, type Bay } from './common.ts';

const H = ARCH.storey.shop;

/** Aisle depth kept clear along the door wall of a hall. */
const AISLE = 7.2;

// ---------------------------------------------------------------------------------------------

export const PUBLIC_MACHI_KOBA: BuildingDef = {
  id: 'public.machi_koba',
  category: 'public',
  variant: 'machi_koba',
  kind: 'warehouse',
  size: { w: [10, 13], d: [12, 16] },
  storeys: 2,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.1,
  roof: 'gable',
  roofRise: 1.8,
  lootable: true,
  generate(rng, params) {
    const k = createKit(PUBLIC_MACHI_KOBA, params, rng);
    const { w, d } = k;
    const t = 0.2;
    k.thick = t;
    const tint = k.rand();
    const xs = t + 1.0;
    const n = Math.ceil(k.def.storeyHeight / ARCH.stair.maxRise - 1e-6);
    const xe = xs + n * ARCH.stair.going;
    const zs1 = t + 1.05;
    const zm = d * 0.55;
    const open = k.rand() < 0.5;
    k.outerWalls(0, {
      mat: 'siding', tint,
      front: [k.door(t + 2.4, open ? 'open' : 'shutter', 3.4), k.window(t + 5.2, 1.4, { sill: 1.0, broken: k.rand() < 0.5 }), k.door(w - t - 1.2)],
      back: [k.window(w - 2.4, 1.6, { sill: 1.2, broken: k.rand() < 0.4 })],
      right: [k.window(d * 0.3, 1.6, { sill: 1.2 }), k.window(d * 0.65, 1.6, { sill: 1.2, broken: k.rand() < 0.3 })],
    });
    k.outerWalls(1, {
      mat: 'siding', tint,
      front: [k.window(w * 0.3, 1.6), k.window(w * 0.7, 1.6, { broken: k.rand() < 0.3 })],
      back: [k.window(w * 0.6, 1.2)],
      left: [k.window(d * 0.4, 1.2)],
    });
    k.floor(0, 'concrete');
    k.floor(1, 'flooring');
    k.stairs({ level: 0, start: [xs, t + 0.55], dir: 'x+', width: ARCH.stair.width, kind: 'straight', rails: ['right', 'end'], mat: 'steel' });
    // The workshop: machines along the right wall at the back, the bench on the left at the front.
    k.room(0, t, t, w - t, d - t, 'workshop');
    const y = k.levelY(0);
    k.furniture(0, w - t - 1.2, t + 1.6, w - t, t + 3.2, 1.3, 'steel', { tint: 0.3, search: { kind: 'cabinet', face: 'x-', table: 'workshop' } }); // lathe
    k.furniture(0, w - t - 1.4, t + 3.8, w - t, t + 5.0, 2.4, 'steel', { tint: 0.1 }); // press
    k.furniture(0, w - t - 0.6, t + 5.4, w - t, zm - 0.4, 2.0, 'shelf', { tint: 0.5, search: { kind: 'shelf', face: 'x-', table: 'stock' } });
    k.furniture(0, t, d / 2 + 0.6, t + 0.7, d - 2.4, 0.9, 'wood', { tint: 0.7, search: { kind: 'counter', face: 'x+', table: 'tools' } });
    k.box(0, t, y + 1.2, d / 2 + 0.6, t + 0.04, y + 2.0, d - 2.4, 'steel', { solid: false, tint: 0.5 }); // tool board
    k.stain(0, w / 2 - 1, d / 2 - 1, w / 2 + 0.6, d / 2 + 0.2, 'debris');
    // Upstairs: the landing beside the stairwell, the tatami room behind, the office in front.
    k.partition(1, t, zm, w - t, zm, [k.door(w - 2 * t - 1.0)]);
    const land = k.room(1, xe, t, w - t, zs1 + 0.06, 'hall');
    const back = k.room(1, t, zs1 + 0.06, w - t, zm - P, 'tatami');
    k.join(land, back);
    k.room(1, t, zm + P, w - t, d - t, 'office');
    k.furniture(1, t, zs1 + 0.6, t + 0.7, zm - 0.6, 1.9, 'wood', { tint: 0.6, search: { kind: 'closet', face: 'x+', table: 'closet' } });
    k.furniture(1, t + 0.6, d - t - 1.6, t + 2.2, d - t - 0.9, 0.72, 'steel', { tint: 0.6, search: { kind: 'desk', face: 'z-', table: 'office' } });
    k.furniture(1, w - t - 0.45, zm + 0.6, w - t, d - t - 0.6, 1.8, 'steel', { tint: 0.7, search: { kind: 'cabinet', face: 'x-', table: 'office' } });
    k.roofGable({ mat: 'metalRoof', tint: k.rand(), axis: 'x' });
    // The sign over the shutter, rust on the front.
    k.box(-1, t, k.levelY(1) - 0.6, d, w - t, k.levelY(1) - 0.05, d + 0.06, 'sign', { layer: 'shell', tint: k.rand(), solid: false });
    rust(k, 0.5, w - 0.5, d + 0.01, 0.5, k.levelY(1) - 0.7);
    return k.finish();
  },
};

// ---------------------------------------------------------------------------------------------

function def(variant: string, o: Pick<BuildingDef, 'size' | 'storeys' | 'roofRise' | 'roof'>, gen: (k: Kit) => void): BuildingDef {
  const d: BuildingDef = {
    id: `public.${variant}`, category: 'public', variant, kind: 'warehouse', plinth: 0.15, lootable: true, storeyHeight: H, ...o,
    generate(rng, params) {
      const k = createKit(d, params, rng);
      k.thick = 0.25;
      gen(k);
      return k.finish();
    },
  };
  return d;
}

/** The office block in front of a hall: lobby, offices, canteen / lab upstairs. */
function officeBlock(k: Kit, r: Rect, levels: number, side: 'left' | 'right', o: { roofAccess?: boolean; tint: number; upper?: Bay[][] }): void {
  wing(k, {
    rect: r, levels, corridor: 'z-', cw: 2.0,
    left: side === 'left' ? { rooms: ['toilet', 'storage'] } : false, right: side === 'right' ? { rooms: ['toilet', 'storage'] } : false,
    roofAccess: o.roofAccess ? side : undefined,
    mat: 'concrete', tint: o.tint, pierMat: 'plaster',
    bays: (level) => (level === 0
      ? [{ use: 'lobby', len: 4, open: true, outer: { width: 1.2 } }, { use: 'office', len: 7, fit: office }, { use: 'canteen', len: 7, fit: kitchen }]
      : o.upper?.[level - 1] ?? [{ use: 'office', len: 7, fit: office }, { use: 'lab', len: 6, fit: lab }, { use: 'storage', len: 4, fit: shelves('storage', 'locker', 'steel') }]),
    roof: 'flat', broken: 0.2,
  });
}

/** A rack of shelving facing the aisle (z+), with its search point. */
function rack(k: Kit, x0: number, x1: number, z1: number, table: 'stock' | 'storage' | 'grocery' | 'fuel' | 'tools', h = 2.2): void {
  k.furniture(0, x0, z1 - 0.8, x1, z1, h, 'shelf', { tint: k.rand(), search: { kind: 'shelf', face: 'z+', table } });
}

export const PUBLIC_FACTORY_FOOD = def('factory_food', { size: { w: [44, 52], d: [36, 42] }, storeys: 2, roof: 'gable', roofRise: 2.6 }, (k) => {
  const { w, d } = k;
  const tint = k.rand();
  const hz1 = d - 14;
  const g = hall(k, {
    rect: [1, 1, w - 1, hz1], levels: 2, mat: 'siding', tint, use: 'workshop', floorMat: 'tileFloor',
    doors: [{ side: 'z+', at: 17, width: 0.9 }, { side: 'z+', at: w - 7, width: 3.6, head: 3.3 }, { side: 'z+', at: w - 12, width: 3.6, head: 3.3, state: 'shutter' }],
    low: { sides: ['x-', 'x+'], n: 3 }, high: { sides: ['z+', 'z-', 'x-', 'x+'], n: 6 },
    roof: 'gable', roofMat: 'metalRoof', roofTint: k.rand(), rise: 2.4, axis: 'x', broken: 0.3,
  });
  const [ix0, iz0, ix1, iz1] = g.inner;
  // Cold store in the front left corner, its door on the aisle.
  k.partition(0, ix0, iz1 - 6, ix0 + 6, iz1 - 6);
  k.partition(0, ix0 + 6, iz1 - 6, ix0 + 6, iz1, [k.door(3, 'open', 1.2)], { mat: 'appliance', tint: 0.1 });
  k.room(0, ix0, iz1 - 6 + P, ix0 + 6 - P, iz1, 'storage');
  k.furniture(0, ix0, iz1 - 5.8, ix0 + 0.7, iz1 - 0.4, 2.0, 'shelf', { tint: 0.2, search: { kind: 'fridge', face: 'x+', table: 'grocery' } });
  k.furniture(0, ix0 + 2.4, iz1 - 5.8, ix0 + 5.6, iz1 - 5.1, 1.8, 'shelf', { tint: 0.2, search: { kind: 'shelf', face: 'z+', table: 'grocery' } });
  // Gallery along the front wall (high windows), its stair against the right wall.
  const c = catwalk(k, 1, ix0 + 6.5, ix1 - 0.05, iz1, { stairAt: ix1 - 0.6, side: 'z+', tint: 0.4, use: 'machine' });
  k.search(1, (c.rect[0] + c.rect[2]) / 2, (c.rect[1] + c.rect[3]) / 2, 'locker', 'storage');
  // Production: conveyor lines along x, mixers at their heads, packing tables at the aisle.
  const zb = iz1 - AISLE;
  const lines = Math.max(2, Math.floor((zb - iz0 - 2) / 4.2));
  for (let i = 0; i < lines; i++) {
    const z = iz0 + 2.0 + i * 4.2;
    k.furniture(0, ix0 + 6, z, ix1 - 6, z + 1.0, 0.9, 'steel', { tint: 0.8 });
    k.furniture(0, ix0 + 2, z - 0.6, ix0 + 4.6, z + 1.6, 2.6, 'appliance', { tint: 0.1, search: i === 0 ? { kind: 'cabinet', face: 'x+', table: 'machine' } : undefined });
  }
  rack(k, ix0 + 8, ix0 + 13, zb, 'grocery', 1.0);
  rack(k, ix1 - 14, ix1 - 8, zb, 'storage');
  rack(k, ix0 + 18, ix0 + 22, zb, 'grocery', 1.0);
  k.stain(0, ix0 + 14, zb + 1.2, ix0 + 15.6, zb + 2.4);
  // Office block in front on the left, trucks at the loading doors.
  officeBlock(k, [1, d - 11.4, 24, d - 1], 2, 'left', { tint: k.rand() });
  truck(k, w - 12, d - 5, 'z', 7, k.rand(), -1);
  mesh(k, w - 0.3, hz1 + 1, w - 0.3, d - 0.3, [[d - 8, d - 2]]);
});

export const PUBLIC_FACTORY_METAL = def('factory_metal', { size: { w: [46, 56], d: [36, 44] }, storeys: 2, roof: 'flat', roofRise: 2.4 }, (k) => {
  const { w, d } = k;
  const tint = k.rand();
  const hz1 = d - 12;
  const g = hall(k, {
    rect: [1, 1, w - 1, hz1], levels: 2, mat: 'metalRoof', tint, use: 'workshop', floorMat: 'concrete',
    doors: [{ side: 'z+', at: 7, width: 3.6, head: 3.4 }, { side: 'z+', at: 12.5, width: 3.6, head: 3.4, state: k.rand() < 0.5 ? 'open' : 'shutter' }, { side: 'z+', at: w - 26, width: 0.9 }],
    low: { sides: ['x-', 'x+'], n: 3 }, high: { sides: ['z+', 'x-', 'x+'], n: 6 },
    roof: 'saw', roofMat: 'metalRoof', roofTint: k.rand(), rise: 2.2, broken: 0.35,
  });
  const [ix0, iz0, ix1, iz1] = g.inner;
  // Gallery along the front wall, its stair at the left wall.
  const c = catwalk(k, 1, ix0 + 0.05, ix1 - 12, iz1, { stairAt: ix0 + 0.6, side: 'z+', tint: 0.6, use: 'machine' });
  k.search(1, (c.rect[0] + c.rect[2]) / 2, (c.rect[1] + c.rect[3]) / 2, 'locker', 'tools');
  // Overhead crane: rails on the side walls and the bridge (drawn high up, out of reach).
  const y = k.levelY(0);
  const cy = k.levelY(2) - 1.0;
  for (const x of [ix0, ix1 - 0.4]) k.box(0, x, cy, iz0, x + 0.4, cy + 0.4, iz1, 'steel', { tint: 0.2, solid: false });
  const bx = ix0 + 10 + k.rand() * (ix1 - ix0 - 20);
  k.box(0, bx, cy + 0.1, iz0, bx + 0.8, cy + 0.7, iz1, 'sign', { tint: 0.8, solid: false });
  k.box(0, bx + 0.2, y + 3.2, (iz0 + iz1) / 2 - 0.2, bx + 0.6, cy, (iz0 + iz1) / 2 + 0.2, 'steel', { solid: false, tint: 0.1 });
  // Behind the aisle: presses, lathes, racks of steel stock facing the aisle; piles of plate.
  const zb = iz1 - AISLE;
  for (let x = ix0 + 2; x + 2.2 < ix1 - 2; x += 5.5) {
    k.furniture(0, x, iz0 + 1.0, x + 2.2, iz0 + 3.4, k.rand() < 0.5 ? 3.0 : 1.4, 'steel', { tint: k.rand() });
  }
  rack(k, ix0 + 2, ix0 + 8, zb, 'stock');
  rack(k, ix0 + 10, ix0 + 16, zb, 'stock');
  rack(k, ix1 - 16, ix1 - 10, zb, 'stock');
  rack(k, ix1 - 8, ix1 - 2, zb, 'tools', 1.0);
  for (let x = ix0 + 19; x + 3 < ix1 - 18; x += 4) k.furniture(0, x, zb - 3.2, x + 3, zb - 1.6, 0.6 + k.rand() * 0.6, 'rust');
  k.stain(0, ix0 + 6, zb + 1.5, ix0 + 7.5, zb + 3.0);
  // Office block in front on the right; steel beams piled in the yard.
  officeBlock(k, [w - 22, d - 10.4, w - 1, d - 1], 2, 'right', { tint: k.rand(), upper: [[{ use: 'office', len: 7, fit: office }, { use: 'storage', len: 6, fit: shelves('tools', 'shelf', 'shelf') }]] });
  for (let i = 0; i < 3; i++) k.box(-1, 15, -0.2, hz1 + 2.5 + i * 1.4, 24, 0.3 + i * 0.25, hz1 + 3.3 + i * 1.4, 'rust', { layer: 'shell', role: 'furniture' });
  truck(k, 6, d - 4.2, 'z', 7, k.rand());
});

export const PUBLIC_FACTORY_CHEM = def('factory_chem', { size: { w: [52, 60], d: [42, 50] }, storeys: 3, roof: 'flat', roofRise: 9 }, (k) => {
  const { w, d } = k;
  const tint = k.rand();
  // Control building (3 storeys, roof reached) in front on the left.
  officeBlock(k, [1, d - 11.4, 26, d - 1], 3, 'left', {
    tint, roofAccess: true,
    upper: [
      [{ use: 'lab', len: 7, fit: lab }, { use: 'lab', len: 7, fit: lab }, { use: 'office', len: 5, fit: office }],
      [{ use: 'command', len: 9, fit: office }, { use: 'storage', len: 5, fit: shelves('storage', 'locker', 'steel') }, { use: 'canteen', len: 5, fit: kitchen }],
    ],
  });
  // Drum warehouse in front on the right.
  const wx0 = w - 22;
  const wz0 = d - 20;
  const g = hall(k, {
    rect: [wx0, wz0, w - 1, d - 1], levels: 2, mat: 'siding', tint: k.rand(), use: 'storage', floorMat: 'concrete',
    doors: [{ side: 'z+', at: wx0 + 5, width: 3.6, head: 3.4 }, { side: 'z+', at: w - 6, width: 3.6, head: 3.4, state: 'shutter' }],
    high: { sides: ['x-', 'x+'], n: 4 }, roof: 'flat', roofTint: tint,
  });
  const [gx0, gz0, gx1, gz1] = g.inner;
  const zb = gz1 - AISLE;
  for (let x = gx0 + 0.5; x + 2.4 < gx1 - 0.5; x += 3.2) {
    for (let z = gz0 + 0.5; z + 1.2 < zb; z += 2.0) k.furniture(0, x, z, x + 2.4, z + 1.2, 1.1, 'rust', { tint: k.rand() });
  }
  rack(k, gx0 + 0.5, gx0 + 6, zb + 0.9, 'fuel', 1.1);
  rack(k, gx1 - 8, gx1 - 0.5, zb + 0.9, 'fuel', 1.1);
  k.furniture(0, gx0 + 9, zb + 2, gx0 + 10.2, zb + 4.2, 1.4, 'sign', { tint: 0.9 }); // forklift
  // Tank yard behind, inside its dike: the tanks, the pipe-rack gallery with its stair, the stack.
  const dz1 = wz0 - 2;
  const dr: Rect = [1, 1, w - 1, dz1];
  const t = 0.3;
  const yd = k.levelY(0) + 1.0;
  const xs = w / 2;
  const o = { mat: 'concrete' as const, tint: 0.3, y1: yd, exterior: true, layer: 'shell' as const };
  k.wall(0, dr[0], dr[3] - t, dr[2], dr[3], [k.door(xs - dr[0], 'open', ARCH.door.wide)], o);
  k.wall(0, dr[0], dr[1], dr[2], dr[1] + t, [], o);
  k.wall(0, dr[0], dr[1] + t, dr[0] + t, dr[3] - t, [], o);
  k.wall(0, dr[2] - t, dr[1] + t, dr[2], dr[3] - t, [], o);
  const yr: Rect = [dr[0] + t, dr[1] + t, dr[2] - t, dr[3] - t];
  k.floor(0, 'concrete', yr);
  k.room(0, yr[0], yr[1], yr[2], yr[3], 'machine');
  const cw = catwalk(k, 1, yr[0] + 0.05, yr[2] - 0.05, yr[1], { stairAt: xs, side: 'z-', tint: 0.5, use: 'machine' });
  k.search(1, xs + 3, (cw.rect[1] + cw.rect[3]) / 2, 'cabinet', 'fuel');
  // Gallery posts down to the ground (drawn), pipes along it.
  for (let x = yr[0] + 3; x < yr[2] - 1; x += 6) k.box(0, x, 0, yr[1] + 1.2, x + 0.15, k.levelY(1), yr[1] + 1.35, 'steel', { solid: false });
  k.box(-1, yr[0], k.levelY(1) + 1.6, yr[1] + 0.2, yr[2], k.levelY(1) + 1.9, yr[1] + 0.5, 'steel', { layer: 'shell', solid: false, tint: 0.8 });
  k.box(-1, yr[0], k.levelY(1) + 2.1, yr[1] + 0.6, yr[2], k.levelY(1) + 2.35, yr[1] + 0.85, 'rust', { layer: 'shell', solid: false });
  // Tanks either side of the stair's line; a cross section of two boxes and a cap.
  const tz0 = yr[1] + 2.2;
  const ts = Math.min(8, dz1 - tz0 - 3);
  const slots = [xs - 4 - ts, xs - 8 - 2 * ts, xs + 4, xs + 8 + ts].filter((x) => x > yr[0] + 0.5 && x + ts < yr[2] - 0.5);
  const top = k.levelY(2) + 0.6;
  slots.forEach((x0, i) => {
    const c4 = ts * 0.15;
    k.box(-1, x0 + c4, -0.5, tz0, x0 + ts - c4, top, tz0 + ts, 'appliance', { layer: 'shell', tint: i % 2 ? 0.1 : 0.3, role: 'furniture' });
    k.box(-1, x0, -0.5, tz0 + c4, x0 + ts, top, tz0 + ts - c4, 'appliance', { layer: 'shell', tint: i % 2 ? 0.1 : 0.3, role: 'furniture' });
    k.part({ shape: 'hip', x0, x1: x0 + ts, z0: tz0, z1: tz0 + ts, y0: top, y1: top + 1.0, mat: 'appliance', tint: 0.3 });
    if (i === 0) k.search(0, x0 + ts / 2, tz0 + ts + 0.6, 'crate', 'fuel');
  });
  // The stack in the back right corner of the yard.
  k.box(-1, yr[2] - 2.4, -0.5, yr[3] - 2.4, yr[2] - 0.6, k.eaves + 8.6, yr[3] - 0.6, 'concrete', { layer: 'shell', tint: 0.9 });
  k.box(-1, yr[2] - 2.45, k.eaves + 7.6, yr[3] - 2.45, yr[2] - 0.55, k.eaves + 8.2, yr[3] - 0.55, 'sign', { layer: 'shell', tint: 0.6, solid: false });
  // Pipe bridge from the yard to the warehouse (drawn, high).
  k.box(-1, wx0 + 3, k.levelY(1) + 1.5, dz1 - 0.5, wx0 + 3.4, k.levelY(1) + 1.9, wz0 + 0.5, 'steel', { layer: 'shell', solid: false });
  // 09b: the gap reaches past the control building's door (x 8.7): the fence stood 0.6 m in front of it, too close for anyone to pass.
  mesh(k, 0.3, d - 0.3, wx0 - 1, d - 0.3, [[7.4, 20]], 1.8);
});

export const FACTORIES: readonly BuildingDef[] = [PUBLIC_MACHI_KOBA, PUBLIC_FACTORY_FOOD, PUBLIC_FACTORY_METAL, PUBLIC_FACTORY_CHEM];
