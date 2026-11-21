// Police and fire (07d-2d).
//
//   koban    交番: a small two-storey box with the red lamp over the door. The office at the front
//            (desk, the cabinet), the rest room behind it with the kitchenette and a straight stair,
//            a tatami room upstairs
//   police   警察署: a 4 階 block. Ground: the lobby with the counters of the traffic and community
//            sections, the duty room (door to the car park), the cells (locked). 1F detectives and
//            interview rooms, 2F the armoury (a steel door — usually locked; in some seeds it was
//            forced and the racks can be searched: guns and ammunition), 3F the dojo, the meeting
//            room and the canteen. Patrol cars in the car park behind, a radio mast on the roof
//   fire     消防署: a 2 階 block whose ground floor is the engine bay (tall doors, the first open and
//            empty, the others shuttered with an engine behind), the office and the lobby; dorms
//            and the kitchen upstairs. Behind it the hose tower (望楼): a narrow stair tower of five
//            storeys with a roofed lookout on top — a firing point over the town

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { car } from '../shop/common.ts';
import { kitchen, mesh, office, P, shelves, toilets, wing, zone, type Fit } from './common.ts';

// ---------------------------------------------------------------------------------------------

export const PUBLIC_KOBAN: BuildingDef = {
  id: 'public.koban',
  category: 'public',
  variant: 'koban',
  kind: 'office',
  size: { w: [7, 8.5], d: [7.5, 9] },
  storeys: 2,
  storeyHeight: ARCH.storey.house,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 1.4,
  lootable: true,
  generate(rng, params) {
    const k = createKit(PUBLIC_KOBAN, params, rng);
    const { w, d } = k;
    const t = 0.2;
    k.thick = t;
    const tint = k.rand();
    const zm = d * 0.45;
    const xs = t + 1.0;
    const n = Math.ceil(k.def.storeyHeight / ARCH.stair.maxRise - 1e-6);
    const xe = xs + n * ARCH.stair.going;
    const zs1 = t + 1.05; // the stair's room-side edge
    const top = k.storeys - 1;
    for (let level = 0; level < k.storeys; level++) {
      k.outerWalls(level, {
        mat: 'plaster', tint, parapet: level === top ? 0.5 : 0,
        front: level === 0
          ? [k.window(t + 1.0, 1.2, { sill: 0.4, head: 2.1, broken: k.rand() < 0.4 }), k.door(w / 2, 'open', 1.2), k.window(w - t - 1.0, 1.2, { sill: 0.4, head: 2.1 })]
          : [k.window(w / 2, 2.0, { broken: k.rand() < 0.3 })],
        right: [k.window(level === 0 ? (zm + d) / 2 : d * 0.6, 1.0)],
        back: level === 1 ? [k.window(w - 1.4, 0.8, { sill: 1.2 })] : [],
      });
      k.floor(level, level === 0 ? 'tileFloor' : 'tatami');
    }
    k.stairs({ level: 0, start: [xs, t + 0.55], dir: 'x+', width: ARCH.stair.width, kind: 'straight', rails: ['right', 'end'], mat: 'wood' });
    // Ground: the office in front, the rest room behind.
    k.partition(0, t, zm, w - t, zm, [k.door(0.8)]);
    k.room(0, t, zm + P, w - t, d - t, 'command');
    k.room(0, t, t, w - t, zm - P, 'living');
    k.furniture(0, w - t - 1.6, zm + 0.4, w - t - 0.3, zm + 1.1, 0.72, 'steel', { tint: 0.6, search: { kind: 'desk', face: 'z+', table: 'command' } });
    k.furniture(0, w - t - 0.45, zm + 1.6, w - t, d - t - 1.6, 1.8, 'steel', { tint: 0.7, search: { kind: 'locker', face: 'x-', table: 'office' } });
    k.box(0, t, k.levelY(0) + 1.0, zm + 0.6, t + 0.03, k.levelY(0) + 2.0, zm + 2.0, 'paper', { solid: false }); // wanted posters / the map
    k.furniture(0, w - t - 0.6, zs1 + 0.3, w - t, zm - 0.3, 0.9, 'counter', { tint: 0.2, search: { kind: 'counter', face: 'x-', table: 'kitchen' } });
    if (k.rand() < 0.6) k.stain(0, w / 2 - 0.6, d - t - 1.6, w / 2 + 0.6, d - t - 0.6);
    // Upstairs: the tatami room (not over the stairwell) and the landing beside it.
    const main = k.room(1, t, zs1 + 0.06, w - t, d - t, 'tatami');
    const land = k.room(1, xe, t, w - t, zs1 + 0.06, 'hall');
    k.join(land, main);
    k.furniture(1, w / 2 - 0.5, d * 0.6 - 0.4, w / 2 + 0.5, d * 0.6 + 0.4, 0.33, 'wood', { tint: 0.3, search: { kind: 'table', face: 'x-', table: 'tatami' } });
    k.furniture(1, t, d - t - 2.2, t + 0.7, d - t - 0.4, 1.9, 'wood', { tint: 0.6, search: { kind: 'closet', face: 'x+', table: 'closet' } });
    k.roofFlat({ mat: 'concrete', tint });
    // The red lamp over the door and the name board on the parapet (drawn only, they stick out).
    const y1 = k.levelY(1);
    k.box(-1, w / 2 - 0.18, y1 - 0.55, d, w / 2 + 0.18, y1 - 0.2, d + 0.3, 'sign', { layer: 'shell', tint: 0.6, solid: false });
    k.box(-1, w / 2 - 1.5, k.eaves - 0.1, d, w / 2 + 1.5, k.eaves + 0.45, d + 0.06, 'sign', { layer: 'shell', tint: 0.3, solid: false });
    k.box(-1, w / 2 - 1.0, y1 - 0.1, d, w / 2 + 1.0, y1 + 0.05, d + 0.5, 'concrete', { layer: 'shell', solid: false, tint });
    return k.finish();
  },
};

// ---------------------------------------------------------------------------------------------

/** 武器庫: gun cabinets along the far wall, ammunition boxes; a forced door left debris. */
const armory: Fit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx);
  const [x0, , x1] = r;
  const [a, b] = face === 'z+' ? [z[1], z[1] + 0.5] : [z[3] - 0.5, z[3]];
  k.furniture(level, x0 + 0.2, a, x1 - 0.2, b, 1.9, 'steel', { tint: 0.2, search: { kind: 'locker', face, table: 'weapons' } });
  const c = (z[1] + z[3]) / 2;
  k.furniture(level, x0 + 0.3, c - 0.4, x0 + 1.1, c + 0.4, 0.6, 'woodDark', { search: { kind: 'crate', face: 'x+', table: 'weapons' } });
  k.stain(level, (x0 + x1) / 2 - 0.8, ctx.corr === 'z+' ? r[3] - 1.2 : r[1] + 0.2, (x0 + x1) / 2 + 0.8, ctx.corr === 'z+' ? r[3] - 0.2 : r[1] + 1.2, 'debris');
};

/** 当直室: the door to the car park and the corridor door line up on the left; desk and lockers on the right. */
const duty: Fit = (k, level, r) => {
  const [x0, z0, x1, z1] = r;
  if (x1 - x0 < 4) return;
  k.furniture(level, x1 - 2.4, (z0 + z1) / 2 - 0.7, x1 - 1.7, (z0 + z1) / 2 + 0.7, 0.72, 'steel', { tint: 0.6, search: { kind: 'desk', face: 'x-', table: 'command' } });
  k.furniture(level, x1 - 0.5, z0 + 0.3, x1, z0 + 2.3, 1.8, 'steel', { tint: 0.3, search: { kind: 'locker', face: 'x-', table: 'command' } });
  void x0;
};

/** 道場: mats (drawn), a rack of practice gear. */
const dojo: Fit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx);
  const [x0, , x1] = r;
  k.box(level, x0 + 0.5, k.levelY(level), z[1] + 0.3, x1 - 0.5, k.levelY(level) + 0.05, z[3] - 0.3, 'tatami', { solid: false });
  const [a, b] = face === 'z+' ? [z[1], z[1] + 0.45] : [z[3] - 0.45, z[3]];
  k.furniture(level, x1 - 3.2, a, x1 - 0.4, b, 1.4, 'wood', { tint: 0.4, search: { kind: 'shelf', face, table: 'storage' } });
};

export const PUBLIC_POLICE: BuildingDef = {
  id: 'public.police',
  category: 'public',
  variant: 'police',
  kind: 'office',
  size: { w: [30, 36], d: [26, 32] },
  storeys: 4,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 6,
  lootable: true,
  generate(rng, params) {
    const k = createKit(PUBLIC_POLICE, params, rng);
    const { w, d } = k;
    k.thick = 0.25;
    const tint = k.rand();
    const forced = k.rand() < 0.4;
    const z0 = d - 17;
    const res = wing(k, {
      rect: [1, z0, w - 1, d - 1], levels: 4, corridor: 'mid', cw: 2.4,
      left: { rooms: ['toilet', 'storage'] }, right: { rooms: ['storage', 'toilet'] }, roofAccess: 'right',
      mat: 'concrete', tint, pierMat: 'plaster',
      bays: (level, side) => {
        if (level === 0) {
          return side === 'z+'
            ? [{ use: 'office', len: 8, fit: office }, { use: 'lobby', len: 6, open: true, outer: { width: ARCH.door.wide } }, { use: 'office', len: 8, fit: office }]
            : [{ use: 'storage', len: 7, locked: true }, { use: 'command', len: 6, outer: { width: 0.9, at: 1.2 }, doorAt: [1.2], fit: duty }, { use: 'toilet', len: 3, fit: toilets }];
        }
        if (level === 1) return side === 'z+' ? [{ use: 'office', len: 11, fit: office }, { use: 'office', len: 9, fit: office }] : [{ use: 'office', len: 3.5 }, { use: 'office', len: 3.5 }, { use: 'storage', len: 5, fit: shelves('office', 'cabinet', 'steel') }, { use: 'office', len: 8, fit: office }];
        if (level === 2) return side === 'z+' ? [{ use: 'office', len: 9, fit: office }, { use: 'armory', len: 5, locked: !forced, fit: armory }, { use: 'office', len: 8, fit: office }] : [{ use: 'barracks', len: 8, fit: shelves('barracks', 'locker', 'steel') }, { use: 'office', len: 10, fit: office }];
        return side === 'z+' ? [{ use: 'hall', len: 16, fit: dojo }, { use: 'office', len: 6 }] : [{ use: 'office', len: 9, fit: office }, { use: 'canteen', len: 8, fit: kitchen }];
      },
      roof: 'flat', broken: 0.08,
    });
    // Radio mast and the antenna on the roof, the name board over the entrance.
    const [ix0, iz0, ix1] = res.inner;
    const e = k.eaves;
    const mx = ix0 + 3;
    k.box(-1, mx - 0.25, e, iz0 + 1.0, mx + 0.25, e + 5.8, iz0 + 1.5, 'steel', { layer: 'shell', tint: 0.4 });
    k.box(-1, mx - 1.2, e + 4.6, iz0 + 1.15, mx + 1.2, e + 4.7, iz0 + 1.35, 'steel', { layer: 'shell', solid: false });
    const lobby = res.rooms.find((r) => r.level === 0 && r.bay.use === 'lobby')!;
    const lx = (lobby.rect[0] + lobby.rect[2]) / 2;
    k.box(-1, lx - 3, k.levelY(1) - 0.3, d, lx + 3, k.levelY(1) + 0.4, d + 0.08, 'sign', { layer: 'shell', tint: 0.4, solid: false });
    k.box(-1, lx - 2.5, k.levelY(1) - 0.5, d - 0.2, lx + 2.5, k.levelY(1) - 0.3, d + 0.55, 'concrete', { layer: 'shell', solid: false, tint });
    // Car park behind: patrol cars, a van, the fence.
    const nCars = 2 + Math.floor(k.rand() * 3);
    for (let i = 0; i < nCars; i++) car(k, 4 + i * 3.4, z0 - 4.5, 'z', i === 0 ? 0.1 : k.rand() < 0.6 ? 0.95 : k.rand());
    if (z0 > 9) car(k, ix1 - 4, 4, 'x', 0.9);
    mesh(k, 0.3, 0.3, w - 0.3, 0.3);
    mesh(k, 0.3, 0.3, 0.3, z0, [[2, 7]]);
    mesh(k, w - 0.3, 0.3, w - 0.3, z0, [[z0 - 6, z0 - 1]]);
    if (forced) k.stain(2, ix1 - 6, (res.corrBand[0] + res.corrBand[1]) / 2 - 0.5, ix1 - 4.5, (res.corrBand[0] + res.corrBand[1]) / 2 + 0.6);
    return k.finish();
  },
};

// ---------------------------------------------------------------------------------------------

/** 仮眠室: beds along the far wall, lockers by the side wall. */
const dorm: Fit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx);
  const [x0, , x1] = r;
  const [a, b] = face === 'z+' ? [z[1], z[1] + 2.0] : [z[3] - 2.0, z[3]];
  for (let x = x0 + 0.2; x + 0.9 < x1 - 0.7; x += 1.4) k.furniture(level, x, a, x + 0.9, b, 0.5, 'fabric', { tint: k.rand() });
  k.furniture(level, x1 - 0.5, z[1] + 0.2, x1, z[3] - 0.2, 1.8, 'steel', { tint: 0.5, search: { kind: 'locker', face: 'x-', table: 'bedroom' } });
};

export const PUBLIC_FIRE: BuildingDef = {
  id: 'public.fire',
  category: 'public',
  variant: 'fire',
  kind: 'office',
  size: { w: [26, 32], d: [22, 28] },
  storeys: 5,
  storeyHeight: ARCH.storey.shop,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 3.0,
  lootable: true,
  generate(rng, params) {
    const k = createKit(PUBLIC_FIRE, params, rng);
    const { w, d } = k;
    const T = 0.25;
    k.thick = T;
    const tint = k.rand();
    const z0 = d - 13;
    const stairLen = Math.ceil(k.def.storeyHeight / 2 / ARCH.stair.maxRise - 1e-6) * ARCH.stair.going + ARCH.stair.landing;
    const avail = w - 2 - 2 * T - stairLen - 1.8;
    const garage = avail - 9;
    const nDoors = Math.max(2, Math.min(3, Math.floor(garage / 4.6)));
    const doorAt = Array.from({ length: nDoors }, (_, i) => 2.4 + i * 4.6);
    const states = doorAt.map((_, i) => (i === 0 ? 'open' as const : 'shutter' as const));
    const engine: Fit = (kk, level, r) => {
      const [x0, z0r, , z1] = r;
      doorAt.forEach((at, i) => {
        if (i === 0) return;
        const cx = x0 + at;
        kk.furniture(level, cx - 1.2, z1 - 1.4 - 7.2, cx + 1.2, z1 - 1.4, 3.0, 'sign', { tint: 0.7 });
      });
      kk.furniture(level, x0, z0r + 1.6, x0 + 0.5, z1 - 1.6, 1.9, 'shelf', { tint: 0.3, search: { kind: 'shelf', face: 'x+', table: 'garage' } });
      kk.stain(level, x0 + 1.4, z1 - 4, x0 + 3.2, z1 - 2.6, 'debris');
    };
    wing(k, {
      rect: [1, z0, w - 1, d - 1], levels: 2, corridor: 'z-', cw: 2.0,
      left: false, right: { rooms: ['storage', 'toilet'] },
      mat: 'concrete', tint, pierMat: 'concrete',
      floorMat: (l) => (l === 0 ? 'concrete' : 'vinyl'),
      bays: (level) => (level === 0
        ? [
            { use: 'garage', len: garage, outer: doorAt.map((at, i) => ({ at, width: 3.4, head: 3.3, state: states[i]! })), doorAt: [doorAt[0]!], fit: engine },
            { use: 'lobby', len: 4, open: true, outer: { width: 0.9 } },
            { use: 'command', len: 5, fit: office },
          ]
        : [{ use: 'bedroom', len: 5, fit: dorm }, { use: 'bedroom', len: 5, fit: dorm }, { use: 'kitchen', len: 5, fit: kitchen }, { use: 'office', len: 4, fit: office }]),
      entrances: [{ side: 'z-', at: w / 2, width: 0.9 }],
      roof: 'flat', broken: 0.1,
    });
    // Red band and the name board on the front.
    k.box(-1, 1, k.levelY(1) - 0.25, d - 1, w - 1, k.levelY(1) + 0.05, d - 0.94, 'sign', { layer: 'shell', tint: 0.6, solid: false });
    k.box(-1, w / 2 - 3, k.levelY(2) - 0.2, d - 1, w / 2 + 3, k.levelY(2) + 0.6, d - 0.92, 'sign', { layer: 'shell', tint: 0.6, solid: false });
    tower(k, [1.5, 1.5, 1.5 + 5.6, 1.5 + 3.05], tint);
    // Hose drying rack and the training wall in the yard, the fence.
    k.box(-1, 10, -0.5, 3, 10.15, 6.5, 3.15, 'steel', { layer: 'shell' });
    k.box(-1, 14, -0.5, 3, 14.15, 6.5, 3.15, 'steel', { layer: 'shell' });
    k.box(-1, 10, 6.3, 3, 14.15, 6.45, 3.15, 'steel', { layer: 'shell' });
    k.box(-1, 10.3, 2.0, 3.0, 13.8, 6.3, 3.05, 'fabric', { layer: 'shell', solid: false, tint: 0.9 });
    mesh(k, 0.3, 0.3, w - 0.3, 0.3);
    mesh(k, w - 0.3, 0.3, w - 0.3, z0, [[z0 - 5, z0 - 1]]);
    mesh(k, 0.3, 1.5 + 3.05, 0.3, z0);
    return k.finish();
  },
};

/** The hose tower: a switchback stair in a narrow shaft to a roofed lookout on top (level = storeys). */
function tower(k: Kit, r: [number, number, number, number], tint: number): void {
  const [x0, z0, x1, z1] = r;
  const t = 0.25;
  const ix0 = x0 + t;
  const iz0 = z0 + t;
  const ix1 = x1 - t;
  const iz1 = z1 - t;
  const stairLen = Math.ceil(k.def.storeyHeight / 2 / ARCH.stair.maxRise - 1e-6) * ARCH.stair.going + ARCH.stair.landing;
  const xs1 = ix0 + stairLen;
  const zA = iz1 - ARCH.stair.wideWidth / 2;
  const top = k.storeys;
  for (let level = 0; level < top; level++) {
    const o = { mat: 'concrete' as const, tint, exterior: true, layer: 'shell' as const, y1: level === top - 1 ? k.levelY(top) + 1.1 : k.levelY(level + 1) };
    k.wall(level, x0, z1 - t, x1, z1, level > 0 ? [k.window((xs1 + ix1) / 2 - x0, 0.8, { sill: 1.0 })] : [], o);
    k.wall(level, x0, z0, x1, z0 + t, [], o);
    k.wall(level, x0, iz0, x0 + t, iz1, [], o);
    k.wall(level, x1 - t, iz0, x1, iz1, level === 0 ? [k.door((iz1 - iz0) / 2, 'open', 0.9)] : [k.window((iz1 - iz0) / 2, 0.6, { sill: 1.2, broken: k.rand() < 0.3 })], o);
    k.floor(level, 'concrete', [ix0, iz0, ix1, iz1]);
    k.stairs({ level, start: [xs1, zA], dir: 'x-', width: ARCH.stair.wideWidth, kind: 'switchback', turn: 'right', mat: 'concrete', tint, to: level + 1 });
    k.room(level, xs1, iz0, ix1, iz1, 'stairs');
  }
  k.floor(top, 'concrete', [ix0, iz0, ix1, iz1]);
  k.room(top, xs1, iz0, ix1, iz1, 'roof');
  k.search(top, (xs1 + ix1) / 2 + 0.2, (iz0 + iz1) / 2, 'crate', 'roof'); // the lookout's signal kit
  // The lookout's roof on four posts, and the alarm bell.
  const y = k.levelY(top);
  for (const [px, pz] of [[x0, z0], [x1 - 0.15, z0], [x0, z1 - 0.15], [x1 - 0.15, z1 - 0.15]] as const) k.box(-1, px, y + 1.1, pz, px + 0.15, y + 2.6, pz + 0.15, 'steel', { layer: 'shell' });
  k.box(-1, x0 - 0.3, y + 2.6, z0 - 0.3, x1 + 0.3, y + 2.8, z1 + 0.3, 'metalRoof', { layer: 'shell', tint: 0.2 });
  k.box(-1, (x0 + x1) / 2 - 0.25, y + 2.1, (z0 + z1) / 2 - 0.25, (x0 + x1) / 2 + 0.25, y + 2.6, (z0 + z1) / 2 + 0.25, 'rust', { layer: 'shell', solid: false });
}

export const SAFETY: readonly BuildingDef[] = [PUBLIC_KOBAN, PUBLIC_POLICE, PUBLIC_FIRE];
