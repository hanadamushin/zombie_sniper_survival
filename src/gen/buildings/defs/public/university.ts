// Universities (07d-2d): a campus of several buildings round a plaza, the gate in the front fence.
//
//   univ_rural   low and spread out: a 3 階 lecture building (big lecture rooms both sides of a
//                middle corridor) at the back, a 2 階 laboratory building on the right, the
//                cafeteria (one tall hall, its kitchen counter and tables) in front on the left,
//                a lawn plaza with trees and benches, the bicycle racks
//   univ_city    compact: an 8 階 research tower (labs and offices, the roof can be reached) on the
//                right, a 3 階 lecture building on the left, the cafeteria in front, a paved plaza
//
// Shared pieces: common.ts (wing, hall, furnishers), school_parts.ts (shoe hall, walkway).

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { hall, lab, mesh, nurse, office, shelves, toilets, wing, yardTree, type Bay, type Fit } from './common.ts';
import { genkan, walkway } from './school_parts.ts';

const H = ARCH.storey.concrete;

/** 講義室: a low platform and lectern at the front wall, long desks in rows. */
const lecture: Fit = (k, level, r, ctx) => {
  const [x0, z0, x1, z1] = r;
  const y = k.levelY(level);
  const za = ctx.corr === 'z+' ? z0 + 0.5 : z0 + 1.9;
  const zb = ctx.corr === 'z+' ? z1 - 1.9 : z1 - 0.5;
  if (zb - za < 2 || x1 - x0 < 6) return;
  k.box(level, x0, y, za - 0.3, x0 + 1.6, y + 0.2, zb + 0.3, 'wood', { tint: 0.3, role: 'furniture' });
  k.furniture(level, x0 + 0.6, (za + zb) / 2 - 0.4, x0 + 1.2, (za + zb) / 2 + 0.4, 1.1, 'woodDark', { search: { kind: 'desk', face: 'x+', table: 'classroom' } });
  k.box(level, x0, y + 1.0, (za + zb) / 2 - 2.5, x0 + 0.04, y + 2.4, (za + zb) / 2 + 2.5, 'appliance', { tint: 0.1, solid: false }); // screen
  const mid = (za + zb) / 2;
  for (let x = x0 + 3.0; x + 0.45 < x1 - 0.8; x += 1.1) {
    k.furniture(level, x, za, x + 0.45, mid - 0.5, 0.72, 'wood', { tint: 0.6 });
    k.furniture(level, x, mid + 0.5, x + 0.45, zb, 0.72, 'wood', { tint: 0.6 });
  }
  k.search(level, x1 - 0.5, mid, 'table', 'classroom');
  if (k.rand() < 0.3) k.stain(level, x0 + 2.0, mid - 0.4, x0 + 2.8, mid + 0.6);
};

/** The cafeteria: a tall hall, kitchen counter along the back, tables in rows, vending machines. */
function cafeteria(k: Kit, r: [number, number, number, number], tint: number, levels: number): void {
  const [x0, , x1] = r;
  const g = hall(k, {
    rect: r, levels, mat: 'concrete', tint, use: 'canteen', floorMat: 'tileFloor',
    doors: [{ side: 'z+', at: x0 + 3, width: ARCH.door.wide }, { side: 'z+', at: x1 - 3, width: ARCH.door.wide }],
    low: { sides: ['z+', 'x-', 'x+'], n: 4, width: 2.4 }, high: levels > 1 ? { sides: ['z-', 'z+'], n: 4, width: 2.4 } : undefined,
    roof: 'flat', roofTint: tint, broken: 0.35,
  });
  const [ix0, iz0, ix1, iz1] = g.inner;
  k.furniture(0, ix0 + 1.0, iz0, ix1 - 3.0, iz0 + 0.8, 0.95, 'counter', { tint: 0.1, search: { kind: 'counter', face: 'z+', table: 'kitchen' } });
  k.furniture(0, ix1 - 2.6, iz0, ix1 - 0.6, iz0 + 0.8, 1.9, 'appliance', { tint: 0.2, search: { kind: 'fridge', face: 'z+', table: 'grocery' } });
  for (let x = ix0 + 2.0; x + 1.0 < ix1 - 1.5; x += 3.0) {
    for (let z = iz0 + 3.0; z + 0.9 < iz1 - 3.0; z += 2.6) {
      if (k.rand() < 0.2) continue; // knocked over
      k.furniture(0, x, z, x + 1.8, z + 0.9, 0.72, 'wood', { tint: 0.5 });
    }
  }
  k.stain(0, (ix0 + ix1) / 2 - 1, iz1 - 2.4, (ix0 + ix1) / 2 + 0.6, iz1 - 1.6);
}

/** Benches and trees on the plaza; lines of paving. */
function plaza(k: Kit, r: [number, number, number, number], o: { lawn: boolean; keep: [number, number, number, number] }): void {
  const [x0, z0, x1, z1] = r;
  const ok = (x: number, z: number): boolean => x < o.keep[0] - 1.5 || x > o.keep[2] + 1.5 || z < o.keep[1] - 1.5 || z > o.keep[3] + 1.5;
  for (const x of k.evenly(x0 + 2, x1 - 2, Math.max(2, Math.floor((x1 - x0) / 10)))) {
    for (const z of [z0 + 2, z1 - 2]) {
      if (!ok(x, z)) continue;
      yardTree(k, x, z, o.lawn ? 3.2 : 2.4);
      k.box(-1, x + 1.4, -0.5, z - 0.3, x + 3.2, 0.45, z + 0.3, 'wood', { layer: 'shell', tint: 0.4 });
    }
  }
  if (o.lawn) k.box(-1, x0 + 3, 0, z0 + 3.5, x1 - 3, 0.03, z1 - 3.5, 'plant', { layer: 'shell', solid: false });
  else k.box(-1, x0 + 1, 0, z0 + 1, x1 - 1, 0.02, z1 - 1, 'concrete', { layer: 'shell', solid: false, tint: 0.95 });
}

function def(variant: string, o: Pick<BuildingDef, 'size' | 'storeys' | 'roofRise'>, gen: (k: Kit) => void): BuildingDef {
  const d: BuildingDef = {
    id: `public.${variant}`, category: 'public', variant, kind: 'office', plinth: 0.3, lootable: true, storeyHeight: H, roof: 'flat', ...o,
    generate(rng, params) {
      const k = createKit(d, params, rng);
      k.thick = 0.25;
      gen(k);
      return k.finish();
    },
  };
  return d;
}

const lectureBays = (k: Kit, n: number): Bay[] => Array.from({ length: n }, () => ({ use: 'classroom' as const, len: k.pick([11, 13, 15]), fit: lecture }));
const labBays = (k: Kit, n: number): Bay[] => Array.from({ length: n }, (_, i) => (i % 3 === 2 ? { use: 'office' as const, len: 6, fit: office } : { use: 'lab' as const, len: k.pick([7, 8, 9]), fit: lab }));

export const PUBLIC_UNIV_RURAL = def('univ_rural', { size: { w: [88, 100], d: [70, 80] }, storeys: 3, roofRise: 3.4 }, (k) => {
  const { w, d } = k;
  const tint = k.rand();
  // Lecture building at the back.
  const lx1 = w - 40;
  const lec = wing(k, {
    rect: [2, 2, lx1, 2 + 15.4], levels: 3, corridor: 'mid', cw: 3.0,
    left: { rooms: ['toilet', 'storage'] }, right: { rooms: ['storage', 'toilet'] }, roofAccess: 'left',
    mat: 'concrete', tint, pierMat: 'concrete',
    bays: (level, side) => (level === 0 && side === 'z+'
      ? [...lectureBays(k, 1), { use: 'genkan', len: 5, open: true, outer: { width: ARCH.door.wide * 1.5 }, fit: genkan }, ...lectureBays(k, 1), { use: 'office', len: 6, fit: office }]
      : lectureBays(k, 3)),
    roof: 'flat', broken: 0.12,
  });
  // Laboratory building on the right, its corridor towards the plaza.
  const bx0 = w - 34;
  wing(k, {
    rect: [bx0, 2, w - 2, 2 + 11.6], levels: 2, corridor: 'z+', cw: 2.4,
    left: { rooms: ['toilet', 'storage'] }, right: false,
    mat: 'brick', tint: k.rand(),
    bays: (level) => (level === 0 ? [...labBays(k, 2), { use: 'storage', len: 5, fit: shelves('lab', 'cabinet', 'steel') }] : labBays(k, 3)),
    entrances: [{ side: 'z+', at: w - 8, width: ARCH.door.wide }, { side: 'x+', at: 2 + 11.6 - 1.4, width: 0.9 }],
    roof: 'flat', broken: 0.2,
  });
  // Cafeteria in front on the right.
  const cz0 = d - 22;
  cafeteria(k, [w - 32, cz0, w - 4, cz0 + 14], k.rand(), 2);
  // Library pavilion in front on the left: one storey, shelves.
  const lib = hall(k, {
    rect: [2, cz0 + 2, 18, cz0 + 14], levels: 1, mat: 'brick', tint: k.rand(), use: 'classroom', floorMat: 'carpet',
    doors: [{ side: 'z+', at: 12, width: ARCH.door.wide }], low: { sides: ['x-', 'x+', 'z-'], n: 3, width: 2.0 }, roof: 'flat', broken: 0.2,
  });
  const [lx0, lz0, lxx, lzz] = lib.inner;
  for (let x = lx0 + 0.8; x + 0.5 < lxx - 0.8; x += 2.2) {
    if (Math.abs(x + 0.25 - 12) < 2.2) continue;
    k.furniture(0, x, lz0 + 0.6, x + 0.5, lzz - 2.2, 1.9, 'shelf', { tint: 0.3, search: x < lx0 + 1 ? { kind: 'shelf', face: 'x+', table: 'office' } : undefined });
  }
  const gate = genkanXOf(lec.rooms);
  plaza(k, [2, 2 + 15.4 + 2, w - 2, cz0 - 2], { lawn: true, keep: [gate - 3, 0, gate + 3, d] });
  walkway(k, gate - 2, gate + 2, 2 + 15.4, 2 + 15.4 + 10, 3.0);
  fenceGate(k, gate);
  // Bicycle racks along the left fence.
  for (let z = 22; z < cz0 - 3; z += 0.7) k.box(-1, 0.8, 0, z, 2.4, 0.95, z + 0.07, 'steel', { layer: 'shell', solid: false, tint: k.rand() });
});

export const PUBLIC_UNIV_CITY = def('univ_city', { size: { w: [72, 82], d: [56, 64] }, storeys: 8, roofRise: 3.6 }, (k) => {
  const { w, d } = k;
  const tint = k.rand();
  // Research tower on the right, 8 storeys, labs both sides of a middle corridor.
  const tx0 = w - 34;
  const tower = wing(k, {
    rect: [tx0, 2, w - 2, 2 + 16], levels: 8, corridor: 'mid', cw: 2.4,
    left: { rooms: ['toilet', 'storage'] }, right: { rooms: ['storage', 'toilet'] }, roofAccess: 'right',
    mat: 'concrete', tint, pierMat: 'glass',
    floorMat: (l) => (l === 0 ? 'tileFloor' : 'vinyl'),
    bays: (level, side) => {
      if (level === 0) return side === 'z+' ? [{ use: 'lobby', len: 8, open: true, outer: { width: ARCH.door.wide * 1.5 } }, { use: 'office', len: 8, fit: office }] : [{ use: 'clinic', len: 6, fit: nurse }, { use: 'storage', len: 5 }, { use: 'office', len: 6 }];
      return side === 'z+' ? labBays(k, 2) : [{ use: 'office', len: 5, fit: office }, { use: 'lab', len: 8, fit: lab }, { use: 'storage', len: 3, locked: level % 3 === 1 }];
    },
    roof: 'flat', broken: 0.08, sill: 0.8, head: 2.6,
  });
  void tower;
  // Lecture building on the left, 3 storeys.
  const lx1 = tx0 - 6;
  wing(k, {
    rect: [2, 2, lx1, 2 + 14.4], levels: 3, corridor: 'mid', cw: 2.8,
    left: { rooms: ['toilet', 'storage'] }, right: false,
    mat: 'concrete', tint: k.rand(), pierMat: 'concrete',
    bays: (level, side) => (level === 0 && side === 'z+'
      ? [{ use: 'genkan', len: 4.5, open: true, outer: { width: ARCH.door.wide }, fit: genkan }, ...lectureBays(k, 1), { use: 'toilet', len: 3, fit: toilets }]
      : lectureBays(k, 2)),
    entrances: [{ side: 'x+', at: 2 + 7.2, width: 0.9 }],
    roof: 'flat', broken: 0.12,
  });
  walkway(k, lx1, tx0, 6, 12, k.levelY(1) - 0.5);
  // Cafeteria in front of the lecture building, one storey.
  const cz0 = d - 20;
  cafeteria(k, [2, cz0, 26, cz0 + 13], k.rand(), 1);
  // Stores / co-op kiosk by the gate.
  const gate = (w + 26) / 2;
  plaza(k, [28, 2 + 16 + 2, w - 2, d - 3], { lawn: false, keep: [gate - 3, 0, gate + 3, d] });
  fenceGate(k, gate);
  // Sculpture on the plaza.
  k.box(-1, gate + 6, -0.5, d - 14, gate + 7.5, 0.8, d - 12.5, 'concrete', { layer: 'shell', tint: 0.2 });
  k.box(-1, gate + 6.4, 0.8, d - 13.6, gate + 7.1, 3.4, d - 12.9, 'steel', { layer: 'shell', tint: 0.8 });
});

function genkanXOf(rooms: { bay: Bay; rect: [number, number, number, number] }[]): number {
  const g = rooms.find((r) => r.bay.use === 'genkan');
  return g ? (g.rect[0] + g.rect[2]) / 2 : 10;
}

/** Fence along the front with a wide gate and a name plate; the sides and back open on to the neighbours (hedges drawn). */
function fenceGate(k: Kit, gate: number): void {
  const { w, d } = k;
  mesh(k, 0.3, d - 0.3, w - 0.3, d - 0.3, [[gate - 4, gate + 4]], 1.5);
  mesh(k, 0.3, 0.3, w - 0.3, 0.3, [], 1.8);
  k.box(-1, gate - 4.6, -0.5, d - 0.7, gate - 4, 2.4, d - 0.1, 'brick', { layer: 'shell', tint: 0.4 });
  k.box(-1, gate + 4, -0.5, d - 0.7, gate + 4.6, 2.4, d - 0.1, 'brick', { layer: 'shell', tint: 0.4 });
  k.box(-1, gate - 4.55, 1.6, d - 0.12, gate - 4.05, 2.2, d - 0.06, 'sign', { layer: 'shell', tint: 0.4, solid: false });
}

export const UNIVERSITIES: readonly BuildingDef[] = [PUBLIC_UNIV_RURAL, PUBLIC_UNIV_CITY];
