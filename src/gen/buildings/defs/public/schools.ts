// Schools (07d-2d): elementary, junior high and high schools, rural and urban — six types. Each is a
// whole school site: the classroom block(s), the gym, the schoolyard and the fence round it. The
// front (z = d) is the street with the gate; the yard lies between the gate and the buildings.
//
//   elem_rural    木造 2 階の校舎 (wooden, gable roof), a small wooden gym, a wide yard with a track,
//                 the bars, a sandbox and the statue; the shoe hall (昇降口) opens to the yard
//   elem_city     RC 4 階, a pool on the roof (the stair goes up there), the gym beside the block,
//                 a small yard
//   junior_rural  RC 3 階 with a back corridor, a big gym with a gallery, a 武道場, a wide yard with
//                 a track and the bicycle shed
//   junior_city   two blocks (classrooms 4 階 at the back, special rooms 3 階 in front) joined by an
//                 open covered walkway, the gym, a narrow yard
//   high_rural    a 3 階 classroom block and a 2 階 special block in front, a walkway, a gym with a gallery, a big yard with the
//                 baseball backstop
//   high_city     RC 6 階 tower block (the roof can be reached, fenced), the gym in front, a court
//
// Shared pieces: school_parts.ts (gym, yard, pool, walkway); common.ts (wing, hall, furnishers).

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { hall, kitchen, lab, mesh, nurse, office, shelves, wing, type Bay } from './common.ts';
import { classes, genkan, gym, library, music, pool, walkway, yard } from './school_parts.ts';

const H = ARCH.storey.concrete;

/** The ground storey of a school block: staff room, shoe hall (open to the corridor, door outside), nurse, classrooms. */
function groundBays(k: Kit, nClass: number, o: { genkanOuter?: boolean } = {}): Bay[] {
  const bays: Bay[] = [
    { use: 'office', len: 8.5, fit: office },
    { use: 'genkan', len: 4.5, open: true, outer: o.genkanOuter === false ? undefined : { width: ARCH.door.wide * 1.5 }, fit: genkan },
    { use: 'clinic', len: 5, fit: nurse },
    ...classes(nClass),
  ];
  if (k.rand() < 0.5) bays.push({ use: 'kitchen', len: 6, fit: kitchen });
  return bays;
}

/** Special rooms of an upper storey. */
function specialBays(k: Kit, n: number): Bay[] {
  const pool: Bay[] = [
    { use: 'lab', len: 9, fit: lab },
    { use: 'classroom', len: 9, fit: library },
    { use: 'classroom', len: 7.5, fit: music },
    { use: 'storage', len: 4, fit: shelves('storage') },
    { use: 'lab', len: 8, fit: lab },
    { use: 'office', len: 6, fit: office },
  ];
  const out: Bay[] = [];
  const start = Math.floor(k.rand() * pool.length);
  for (let i = 0; i < n; i++) out.push(pool[(start + i) % pool.length]!);
  return out;
}

/** Fence round the site with a gate (gap) in the front at `gate` (x) and a small side gate. */
function siteFence(k: Kit, gate: number, gw = 6): void {
  const { w, d } = k;
  const e = 0.3;
  mesh(k, e, e, w - e, e);
  mesh(k, e, e, e, d - e, [[d * 0.5 - 1, d * 0.5 + 1]]);
  mesh(k, w - e, e, w - e, d - e);
  mesh(k, e, d - e, w - e, d - e, [[gate - gw / 2, gate + gw / 2]]);
  // Gate posts and the school's name plate (drawn).
  k.box(-1, gate - gw / 2 - 0.5, -0.5, d - 0.6, gate - gw / 2, 1.8, d - 0.1, 'concrete', { layer: 'shell', tint: 0.2 });
  k.box(-1, gate + gw / 2, -0.5, d - 0.6, gate + gw / 2 + 0.5, 1.8, d - 0.1, 'concrete', { layer: 'shell', tint: 0.2 });
}

/** Where a wing's `genkan` bay is (x centre) once laid out. */
function genkanX(rooms: { bay: Bay; rect: [number, number, number, number] }[]): number {
  const g = rooms.find((r) => r.bay.use === 'genkan');
  return g ? (g.rect[0] + g.rect[2]) / 2 : 0;
}

function def(variant: string, o: Omit<BuildingDef, 'id' | 'category' | 'variant' | 'kind' | 'plinth' | 'lootable' | 'generate'>, gen: (k: Kit) => void): BuildingDef {
  const d: BuildingDef = {
    id: `public.${variant}`, category: 'public', variant, kind: 'office', plinth: 0.3, lootable: true, ...o,
    generate(rng, params) {
      const k = createKit(d, params, rng);
      k.thick = 0.25;
      gen(k);
      return k.finish();
    },
  };
  return d;
}

// ---------------------------------------------------------------------------------------------

export const PUBLIC_ELEM_RURAL = def('elem_rural', { size: { w: [62, 72], d: [50, 58] }, storeys: 2, storeyHeight: H, roof: 'gable', roofRise: 3.0 }, (k) => {
  const { w } = k;
  const wood = k.rand();
  const gw = 15;
  const wx1 = w - gw - 4;
  const wz0 = 2;
  const res = wing(k, {
    rect: [2, wz0, wx1, wz0 + 10.2], levels: 2, corridor: 'z-', cw: 2.4,
    left: { rooms: ['storage', 'toilet'] }, right: { rooms: ['storage', 'toilet'] },
    mat: 'wood', tint: wood, floorMat: () => 'flooring',
    bays: (level) => (level === 0 ? groundBays(k, 2) : [...classes(3), ...specialBays(k, 2)]),
    entrances: [{ side: 'z-', at: wx1 / 2 + 3, width: 0.9 }],
    roof: 'gable', roofMat: 'tile', roofTint: k.rand(), rise: 2.8, broken: 0.3,
  });
  gym(k, [w - gw - 2, 2, w - 2, 2 + 24], { mat: 'wood', tint: wood, roof: 'gable', roofMat: 'metalRoof', doors: [w - gw + 1, w - 5] });
  const gate = genkanX(res.rooms);
  yard(k, [2, 28, w - 2, k.d - 1.5], { track: true, bars: true, statue: true, keep: [[gate - 4, k.d - 4, gate + 4, k.d]] });
  siteFence(k, gate);
  // A 百葉箱 and a rabbit hutch by the gym.
  k.box(-1, w - 7, -0.5, 28.5, w - 6.4, 1.6, 29.1, 'appliance', { layer: 'shell', tint: 0.1 });
  k.box(-1, w - 12, -0.5, 27.6, w - 9.6, 1.2, 28.8, 'wood', { layer: 'shell', tint: 0.8 });
});

export const PUBLIC_ELEM_CITY = def('elem_city', { size: { w: [46, 54], d: [40, 46] }, storeys: 4, storeyHeight: H, roof: 'flat', roofRise: 3.4 }, (k) => {
  const { w } = k;
  const tint = k.rand();
  const gw = 16;
  const wx1 = w - gw - 3;
  const res = wing(k, {
    rect: [1.5, 1.5, wx1, 1.5 + 10.2], levels: 4, corridor: 'z-', cw: 2.4,
    left: { rooms: ['storage', 'toilet'] }, right: { rooms: ['storage', 'toilet'] }, roofAccess: 'right',
    mat: 'concrete', tint, pierMat: 'plaster',
    bays: (level) => (level === 0 ? groundBays(k, 0) : level === 3 ? specialBays(k, 3) : classes(3)),
    entrances: [{ side: 'z-', at: 6, width: 0.9 }],
    roof: 'flat', broken: 0.12,
  });
  // The pool on the roof, fenced, left of the stair house.
  const top = 4;
  const [ix0, iz0, , iz1] = res.inner;
  pool(k, top, [ix0 + 1.0, iz0 + 1.5, ix0 + 1.0 + Math.min(15, (wx1 - ix0) * 0.5), iz1 - 1.2]);
  gym(k, [w - gw - 1.5, 1.5, w - 1.5, 1.5 + 22], { mat: 'concrete', tint, roof: 'flat' });
  const gate = genkanX(res.rooms);
  yard(k, [1.5, 25, w - 1.5, k.d - 1.5], { track: false, bars: true, trees: 3, keep: [[gate - 4, k.d - 4, gate + 4, k.d]] });
  k.box(-1, 6, 0, 28, w - 6, 0.02, 28.12, 'paper', { layer: 'shell', solid: false });
  siteFence(k, gate, 5);
});

export const PUBLIC_JUNIOR_RURAL = def('junior_rural', { size: { w: [72, 82], d: [60, 68] }, storeys: 3, storeyHeight: H, roof: 'flat', roofRise: 3.4 }, (k) => {
  const { w, d } = k;
  const tint = k.rand();
  const gw = 20;
  const wx1 = w - gw - 4;
  const res = wing(k, {
    rect: [2, 2, wx1, 2 + 10.4], levels: 3, corridor: 'z-', cw: 2.6,
    left: { rooms: ['storage', 'toilet'] }, right: { rooms: ['storage', 'toilet'] }, roofAccess: 'left',
    mat: 'concrete', tint, pierMat: 'concrete',
    bays: (level) => (level === 0 ? groundBays(k, 3) : level === 1 ? classes(6) : [...classes(3), ...specialBays(k, 3)]),
    entrances: [{ side: 'z-', at: wx1 - 9, width: 0.9 }],
    roof: 'flat', broken: 0.15,
  });
  gym(k, [w - gw - 2, 2, w - 2, 2 + 28], { mat: 'concrete', tint: k.rand(), roof: 'gable', gallery: true });
  // 武道場 (budo hall): a low hall beside the block, entered from the yard.
  const bx0 = 2;
  const bz0 = 2 + 10.4 + 6;
  budo(k, [bx0, bz0, bx0 + 14, bz0 + 9], tint);
  const gate = genkanX(res.rooms);
  yard(k, [bx0 + 16, 33, w - 2, d - 1.5], { track: true, bars: true, keep: [[gate - 4, d - 4, gate + 4, d]] });
  bikeShed(k, [2, bz0 + 12, 9, bz0 + 22]);
  siteFence(k, gate);
});

export const PUBLIC_JUNIOR_CITY = def('junior_city', { size: { w: [56, 64], d: [46, 54] }, storeys: 4, storeyHeight: H, roof: 'flat', roofRise: 3.4 }, (k) => {
  const { w, d } = k;
  const tint = k.rand();
  const accent = k.rand();
  // Back block: classrooms, 4 storeys, the full width; its shoe hall opens onto the walkway.
  const back = wing(k, {
    rect: [1.5, 1.5, w - 1.5, 1.5 + 10.2], levels: 4, corridor: 'z-', cw: 2.4,
    left: { rooms: ['storage', 'toilet'] }, right: { rooms: ['storage', 'toilet'] }, roofAccess: 'left',
    mat: 'concrete', tint, pierMat: 'plaster',
    bays: (level) => (level === 0 ? groundBays(k, 3) : classes(level === 3 ? 4 : 5)),
    entrances: [{ side: 'z-', at: w - 12, width: 0.9 }],
    roof: 'flat', broken: 0.12,
  });
  // Front block: special rooms, 3 storeys, on the left, 12 m in front; a covered walkway between the doors.
  const gx = genkanX(back.rooms);
  const fz0 = 1.5 + 10.2 + 12;
  const fx1 = Math.max(gx + 6, Math.min(w * 0.5, 30));
  wing(k, {
    rect: [1.5, fz0, fx1, fz0 + 9.4], levels: 3, corridor: 'z-', cw: 2.2,
    left: { rooms: ['toilet', 'storage'] }, right: false,
    mat: 'concrete', tint: accent, pierMat: 'concrete',
    bays: (level) => (level === 0 ? [{ use: 'genkan', len: 4, open: true, outer: { width: ARCH.door.wide }, fit: genkan }, { use: 'kitchen', len: 8, fit: kitchen }, { use: 'lab', len: 8, fit: lab }] : specialBays(k, 2)),
    entrances: [{ side: 'z-', at: gx, width: ARCH.door.wide }, { side: 'x+', at: fz0 + 1.5, width: 0.9 }],
    roof: 'flat', broken: 0.1,
  });
  walkway(k, gx - 2, gx + 2, 1.5 + 10.2, fz0, k.levelY(1) - 0.6);
  // Gym on the right, in front of the back block; the yard in front of everything.
  const gx0 = fx1 + 4;
  gym(k, [gx0, fz0 - 1, w - 1.5, fz0 + 17], { mat: 'concrete', tint: accent, roof: 'flat', doors: [gx0 + 3, w - 5] });
  const gate = (w + 1.5) / 2 - 2;
  yard(k, [1.5, fz0 + 18, w - 1.5, d - 1.5], { track: false, trees: 4, keep: [[gate - 4, d - 4, gate + 4, d]] });
  siteFence(k, gate, 5);
});

export const PUBLIC_HIGH_RURAL = def('high_rural', { size: { w: [84, 94], d: [70, 80] }, storeys: 3, storeyHeight: H, roof: 'flat', roofRise: 3.4 }, (k) => {
  const { w, d } = k;
  const tint = k.rand();
  const wx1 = Math.min(62, w - 26);
  // Classroom block at the back, special block 14 m in front, a walkway between the shoe hall and the front block.
  const back = wing(k, {
    rect: [2, 2, wx1, 2 + 10.4], levels: 3, corridor: 'z-', cw: 2.6,
    left: { rooms: ['storage', 'toilet'] }, right: { rooms: ['storage', 'toilet'] }, roofAccess: 'right',
    mat: 'concrete', tint, pierMat: 'plaster',
    bays: (level) => (level === 0 ? groundBays(k, 3) : classes(6, 9)),
    entrances: [{ side: 'z-', at: wx1 / 2, width: 0.9 }],
    roof: 'flat', broken: 0.15,
  });
  const gx = genkanX(back.rooms);
  const fz0 = 2 + 10.4 + 14;
  const front = wing(k, {
    rect: [2, fz0, wx1, fz0 + 9.6], levels: 2, corridor: 'z-', cw: 2.4,
    left: { rooms: ['toilet', 'storage'] }, right: { rooms: ['toilet', 'storage'] },
    mat: 'concrete', tint: k.rand(), pierMat: 'concrete',
    bays: (level) => (level === 0 ? [{ use: 'genkan', len: 5, open: true, outer: { width: ARCH.door.wide * 1.5 }, fit: genkan }, { use: 'office', len: 9, fit: office }, { use: 'clinic', len: 6, fit: nurse }, { use: 'canteen', len: 12, fit: kitchen }] : specialBays(k, 4)),
    entrances: [{ side: 'z-', at: gx, width: ARCH.door.wide }],
    roof: 'flat', broken: 0.15,
  });
  walkway(k, gx - 2, gx + 2, 2 + 10.4, fz0, k.levelY(1) - 0.6);
  gym(k, [w - 22, 2, w - 2, 2 + 30], { mat: 'concrete', tint: k.rand(), roof: 'gable', gallery: true });
  budo(k, [w - 22, 36, w - 8, 45], tint);
  const gate = genkanX(front.rooms);
  yard(k, [2, fz0 + 11.6, w - 24, d - 1.5], { track: true, backstop: true, keep: [[gate - 4, d - 4, gate + 4, d]] });
  bikeShed(k, [w - 22, 48, w - 12, 54]);
  siteFence(k, gate);
});

export const PUBLIC_HIGH_CITY = def('high_city', { size: { w: [52, 60], d: [42, 48] }, storeys: 6, storeyHeight: H, roof: 'flat', roofRise: 3.4 }, (k) => {
  const { w, d } = k;
  const tint = k.rand();
  const res = wing(k, {
    rect: [1.5, 1.5, w - 1.5, 1.5 + 11.2], levels: 6, corridor: 'mid', cw: 2.4,
    left: { rooms: ['toilet', 'storage'] }, right: { rooms: ['storage', 'toilet'] }, roofAccess: 'left',
    mat: 'concrete', tint, pierMat: 'plaster',
    bays: (level, side) => {
      if (level === 0) return side === 'z+' ? [{ use: 'genkan', len: 5, open: true, outer: { width: ARCH.door.wide * 1.5 }, fit: genkan }, { use: 'office', len: 9, fit: office }, { use: 'clinic', len: 6, fit: nurse }, { use: 'storage', len: 4 }] : [{ use: 'canteen', len: 12, outer: { width: 0.9 } }, { use: 'classroom', len: 10, fit: library }];
      if (level >= 4) return side === 'z+' ? specialBays(k, 3) : classes(2, 9);
      return classes(4);
    },
    roof: 'flat', broken: 0.1,
  });
  // Fence on the roof (anti-fall mesh) along the parapet.
  const [ix0, iz0, ix1, iz1] = res.inner;
  const ry = k.levelY(6);
  for (const z of [iz0 + 0.05, iz1 - 0.05]) k.box(-1, ix0, ry + 1.1, z - 0.01, ix1, ry + 3.0, z + 0.01, 'glass', { layer: 'shell', solid: false, tint: 1 });
  gym(k, [w - 20, 16, w - 1.5, 34], { mat: 'concrete', tint: k.rand(), roof: 'flat', gallery: true, levels: 2 });
  const gate = genkanX(res.rooms);
  yard(k, [1.5, 16, w - 22, d - 1.5], { track: false, trees: 3, keep: [[gate - 4, d - 4, gate + 4, d]] });
  k.box(-1, 5, 0, 20, w - 26, 0.02, 20.12, 'paper', { layer: 'shell', solid: false });
  siteFence(k, gate, 5);
});

/** 武道場: a low hall (gable roof) with tatami on one half, two doors facing z+, the lockers. */
function budo(k: Kit, r: [number, number, number, number], tint: number): void {
  const [x0, z0, x1, z1] = r;
  hall(k, {
    rect: r, levels: 1, mat: 'wood', tint, use: 'hall', floorMat: 'flooring',
    doors: [x0 + 2.5, x1 - 2.5].map((at) => ({ side: 'z+' as const, at, width: ARCH.door.wide })),
    low: { sides: ['x-', 'x+', 'z-'], n: 2, width: 1.6 }, roof: 'gable', roofMat: 'tile', rise: 2.0, axis: 'x',
  });
  const y = k.levelY(0);
  k.box(0, x0 + 0.3, y, z0 + 0.3, (x0 + x1) / 2, y + 0.06, z1 - 2.0, 'tatami', { solid: false });
  k.furniture(0, x1 - 0.8, z0 + 0.3, x1 - 0.3, z0 + 3.0, 1.8, 'wood', { tint: 0.3, search: { kind: 'locker', face: 'x-', table: 'storage' } });
}

/** 駐輪場: a roof on posts and rows of bicycles (drawn). */
function bikeShed(k: Kit, r: [number, number, number, number]): void {
  const [x0, z0, x1, z1] = r;
  k.box(-1, x0, 2.3, z0, x1, 2.45, z1, 'metalRoof', { layer: 'shell', tint: 0.5 });
  for (const z of [z0 + 0.2, z1 - 0.3]) k.box(-1, x0 + 0.2, -0.5, z, x0 + 0.3, 2.3, z + 0.1, 'steel', { layer: 'shell' });
  for (let z = z0 + 0.8; z < z1 - 0.6; z += 0.7) k.box(-1, x1 - 1.9, 0, z, x1 - 0.2, 1.0, z + 0.08, 'steel', { layer: 'shell', solid: false, tint: k.rand() });
}

export const SCHOOLS: readonly BuildingDef[] = [PUBLIC_ELEM_RURAL, PUBLIC_ELEM_CITY, PUBLIC_JUNIOR_RURAL, PUBLIC_JUNIOR_CITY, PUBLIC_HIGH_RURAL, PUBLIC_HIGH_CITY];
