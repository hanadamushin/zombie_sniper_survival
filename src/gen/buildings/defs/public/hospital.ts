// Hospitals (07d-2d). Medicine everywhere: the pharmacy, the nurse stations, the wards (`ward`), the
// treatment rooms (`clinic`, cabinets on the `pharmacy` table).
//
//   clinic         診療所 (small): a 2 階 box — waiting room, the dispensary behind the counter,
//                  two consulting / treatment rooms; upstairs four beds, the doctor's office and the
//                  store; green cross on the front
//   hospital_mid   総合病院 (middle): a 6 階 ward block at the back (every ward storey the same: wards
//                  both sides of the corridor, the nurse station open to it, the linen room), a 4 階
//                  outpatient block in front with the main entrance under a canopy, the car park
//   hospital_large 大病院: an 8 階 ward tower with the helipad on its roof, a 3 階 outpatient block with
//                  the main entrance, a 2 階 emergency block whose wide door opens under the ambulance
//                  canopy (ambulances left there), the big car park

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { car } from '../shop/common.ts';
import { lab, nurse, stripe, office, shelves, truck, ward, wing, zone, type Bay, type Fit } from './common.ts';
import { walkway } from './school_parts.ts';

const H = ARCH.storey.concrete;

/** 待合: benches along the side walls, the reception counter by the corridor side. */
const waiting: Fit = (k, level, r) => {
  const [x0, z0, x1, z1] = r;
  if (x1 - x0 < 4) return;
  k.furniture(level, x0 + 0.1, z0 + 1.6, x0 + 0.6, z1 - 1.6, 0.45, 'fabric', { tint: 0.2 });
  k.furniture(level, x1 - 0.6, z0 + 1.6, x1 - 0.1, z1 - 1.6, 0.45, 'fabric', { tint: 0.2, search: { kind: 'table', face: 'x-', table: 'lobby' } });
  if (k.rand() < 0.7) k.stain(level, (x0 + x1) / 2 - 0.8, (z0 + z1) / 2 - 0.4, (x0 + x1) / 2 + 0.5, (z0 + z1) / 2 + 0.7);
};

/** ナースステーション (open to the corridor): a counter across the back, the medicine cabinet. */
const station: Fit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx, 1.6);
  const [x0, , x1] = r;
  if (x1 - x0 < 2.5) return;
  const [a, b] = face === 'z+' ? [z[1], z[1] + 0.45] : [z[3] - 0.45, z[3]];
  k.furniture(level, x0 + 0.2, a, x1 - 0.2, b, 1.9, 'appliance', { tint: 0.1, search: { kind: 'cabinet', face, table: 'pharmacy' } });
  const [c, e] = face === 'z+' ? [b + 1.0, b + 1.6] : [a - 1.6, a - 1.0];
  if (Math.abs(e - c) > 0.3 && (face === 'z+' ? e < z[3] : c > z[1])) k.furniture(level, x0 + 0.5, c, x1 - 0.5, e, 1.0, 'counter', { tint: 0.1, search: { kind: 'counter', face: face === 'z+' ? 'z+' : 'z-', table: 'clinic' } });
};

/** 手術室: the table in the middle, the lamp over it (drawn), cabinets on the side wall. */
const surgery: Fit = (k, level, r, ctx) => {
  const { z } = zone(r, ctx);
  const [x0, , x1] = r;
  const cx = (x0 + x1) / 2;
  const cz = (z[1] + z[3]) / 2;
  if (x1 - x0 < 3.5) return;
  k.furniture(level, cx - 0.35, cz - 1.0, cx + 0.35, cz + 1.0, 0.9, 'appliance', { tint: 0.1 });
  const y = k.levelY(level);
  k.box(level, cx - 0.5, y + 2.2, cz - 0.5, cx + 0.5, y + 2.35, cz + 0.5, 'appliance', { solid: false, tint: 0.3 });
  k.furniture(level, x1 - 0.5, z[1] + 0.2, x1, z[3] - 0.2, 1.8, 'steel', { tint: 0.9, search: { kind: 'cabinet', face: 'x-', table: 'clinic' } });
  k.stain(level, cx - 0.8, cz + 0.6, cx + 0.4, cz + 1.6);
};

const pharmacy = shelves('pharmacy', 'shelf', 'shelf');

/** The ward storey (the same on every floor). */
function wardBays(side: 'z-' | 'z+', n: number): Bay[] {
  const out: Bay[] = [];
  for (let i = 0; i < n; i++) {
    if (side === 'z+' && i === Math.floor(n / 2)) out.push({ use: 'clinic', len: 4.5, open: true, fit: station });
    else if (side === 'z-' && i === Math.floor(n / 2)) out.push({ use: 'storage', len: 3, fit: shelves('ward', 'shelf') });
    else out.push({ use: 'ward', len: 4.8, fit: ward });
  }
  return out;
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

/** Green cross on a face at z (facing +z), centred at (x, y). */
function cross(k: Kit, x: number, y: number, z: number, s: number): void {
  k.box(-1, x - s / 2, y - s / 6, z, x + s / 2, y + s / 6, z + 0.08, 'sign', { layer: 'shell', tint: 0.1, solid: false });
  k.box(-1, x - s / 6, y - s / 2, z, x + s / 6, y + s / 2, z + 0.08, 'sign', { layer: 'shell', tint: 0.1, solid: false });
}

// ---------------------------------------------------------------------------------------------

export const PUBLIC_CLINIC = def('clinic', { size: { w: [14, 17], d: [15, 18] }, storeys: 2, roofRise: 3.4 }, (k) => {
  const { w, d } = k;
  const tint = k.rand();
  wing(k, {
    rect: [0.5, 0.5, w - 0.5, d - 1.5], levels: 2, corridor: 'mid', cw: 2.0,
    left: { rooms: ['toilet', 'storage'] }, right: false, roofAccess: 'left',
    mat: 'plaster', tint, pierMat: 'plaster',
    floorMat: () => 'vinyl',
    bays: (level, side) => {
      if (level === 0) return side === 'z+' ? [{ use: 'lobby', len: 5.5, open: true, outer: { width: ARCH.door.wide }, fit: waiting }, { use: 'clinic', len: 4, fit: pharmacy }] : [{ use: 'clinic', len: 4.5, fit: nurse }, { use: 'clinic', len: 4.5, fit: nurse }];
      return side === 'z+' ? [{ use: 'ward', len: 5, fit: ward }, { use: 'ward', len: 4.5, fit: ward }] : [{ use: 'office', len: 4.5, fit: office }, { use: 'storage', len: 4.5, fit: pharmacy }];
    },
    entrances: [{ side: 'x+', at: d / 2 - 0.5, width: 0.9 }],
    roof: 'flat', broken: 0.2,
  });
  cross(k, w - 3, k.levelY(1) + 1.2, d - 1.5, 1.4);
  k.box(-1, 2, k.levelY(1) - 0.2, d - 1.5, w - 5, k.levelY(1) + 0.5, d - 1.42, 'sign', { layer: 'shell', tint: 0.9, solid: false });
  // A planter and the bicycle in front.
  k.box(-1, 0.6, -0.5, d - 1.2, 3.0, 0.5, d - 0.6, 'concrete', { layer: 'shell', tint: 0.3 });
  k.box(-1, 0.7, 0.5, d - 1.1, 2.9, 1.0, d - 0.7, 'plant', { layer: 'shell', solid: false });
});

export const PUBLIC_HOSPITAL_MID = def('hospital_mid', { size: { w: [40, 48], d: [34, 40] }, storeys: 6, roofRise: 3.4 }, (k) => {
  const { w, d } = k;
  const tint = k.rand();
  // Ward block at the back.
  const back = wing(k, {
    rect: [1, 1, w - 1, 1 + 15.4], levels: 6, corridor: 'mid', cw: 2.4,
    left: { rooms: ['toilet', 'storage'] }, right: { rooms: ['storage', 'toilet'] }, roofAccess: 'left',
    mat: 'plaster', tint, pierMat: 'concrete',
    floorMat: (l) => (l === 0 ? 'tileFloor' : 'vinyl'),
    bays: (level, side) => {
      if (level === 0) {
        return side === 'z+'
          ? [{ use: 'lobby', len: 6, open: true, outer: { width: ARCH.door.wide } }, { use: 'clinic', len: 6, fit: pharmacy }, { use: 'lab', len: 6, fit: lab }, { use: 'clinic', len: 5, fit: nurse }]
          : [{ use: 'kitchen', len: 7, outer: { width: 0.9, at: 1.2 }, doorAt: [1.2] }, { use: 'lab', len: 6, fit: lab }, { use: 'storage', len: 5, locked: true }, { use: 'office', len: 6, fit: office }];
      }
      return wardBays(side, 5);
    },
    roof: 'flat', broken: 0.1,
  });
  // Outpatient block in front on the left, 4 storeys, the main entrance on its front; a walkway from its back door to the ward block's lobby.
  const bl = back.rooms.find((r) => r.level === 0 && r.bay.use === 'lobby')!;
  const bx = (bl.rect[0] + bl.rect[2]) / 2;
  const fz0 = 1 + 15.4 + 4;
  const fx1 = Math.round(w * 0.62);
  const front = wing(k, {
    rect: [1, fz0, fx1, fz0 + 11], levels: 4, corridor: 'z-', cw: 2.4,
    left: false, right: { rooms: ['toilet', 'storage'] },
    mat: 'plaster', tint: k.rand(), pierMat: 'glass',
    floorMat: () => 'vinyl',
    bays: (level) => {
      if (level === 0) return [{ use: 'lobby', len: 7, open: true, outer: { width: ARCH.door.wide }, fit: waiting }, { use: 'clinic', len: 5, fit: pharmacy }, { use: 'clinic', len: 4, fit: nurse }];
      if (level === 1) return [{ use: 'clinic', len: 4, fit: nurse }, { use: 'clinic', len: 4, fit: nurse }, { use: 'lab', len: 6, fit: lab }];
      if (level === 2) return [{ use: 'clinic', len: 7, fit: surgery }, { use: 'clinic', len: 7, fit: surgery }];
      return [{ use: 'office', len: 8, fit: office }, { use: 'storage', len: 5, fit: shelves('office', 'cabinet', 'steel') }];
    },
    entrances: [{ side: 'z-', at: bx, width: ARCH.door.wide }],
    roof: 'flat', broken: 0.12,
  });
  walkway(k, bx - 2, bx + 2, 1 + 15.4, fz0, k.levelY(1) - 0.4);
  // Canopy over the main entrance, the car park on the right.
  const lobby = front.rooms.find((r) => r.level === 0 && r.bay.use === 'lobby')!;
  const lx = (lobby.rect[0] + lobby.rect[2]) / 2;
  const cz = fz0 + 11;
  k.box(-1, lx - 3, 3.2, cz, lx + 3, 3.45, Math.min(d - 0.6, cz + 4.5), 'concrete', { layer: 'shell', tint });
  for (const px of [lx - 2.8, lx + 2.6]) k.box(-1, px, -0.5, Math.min(d - 0.8, cz + 4.2), px + 0.2, 3.2, Math.min(d - 0.6, cz + 4.4), 'steel', { layer: 'shell' });
  cross(k, fx1 - 2.5, k.levelY(4) - 1.5, cz, 2.0);
  const px0 = fx1 + 3;
  for (let x = px0; x + 2.5 < w - 1; x += 2.6) {
    stripe(k, x, fz0, x + 0.1, fz0 + 5.5);
    if (k.rand() < 0.5) car(k, x + 1.3, fz0 + 2.8, 'z');
  }
  truck(k, w - 4, d - 4, 'x', 5.5, 0.05);
  k.stain(0, lobby.rect[0] + 0.5, lobby.rect[3] - 2, lobby.rect[0] + 2, lobby.rect[3] - 1);
});

export const PUBLIC_HOSPITAL_LARGE = def('hospital_large', { size: { w: [76, 86], d: [56, 64] }, storeys: 8, roofRise: 3.4 }, (k) => {
  const { w, d } = k;
  const tint = k.rand();
  // Ward tower: 8 storeys, helipad on top.
  const tower = wing(k, {
    rect: [2, 2, 54, 2 + 16.4], levels: 8, corridor: 'mid', cw: 2.6,
    left: { rooms: ['toilet', 'storage'] }, right: { rooms: ['storage', 'toilet'] }, roofAccess: 'left',
    mat: 'plaster', tint, pierMat: 'glass',
    floorMat: (l) => (l === 0 ? 'tileFloor' : 'vinyl'),
    bays: (level, side) => {
      if (level === 0) {
        return side === 'z+'
          ? [{ use: 'lobby', len: 7, open: true, outer: { width: ARCH.door.wide } }, { use: 'lab', len: 8, fit: lab }, { use: 'lab', len: 7, fit: lab }, { use: 'clinic', len: 8, fit: pharmacy }, { use: 'office', len: 7, fit: office }]
          : [{ use: 'kitchen', len: 9, outer: { width: 0.9, at: 1.2 }, doorAt: [1.2] }, { use: 'canteen', len: 9 }, { use: 'storage', len: 6, locked: true }, { use: 'storage', len: 6, fit: shelves('pharmacy') }, { use: 'office', len: 7, fit: office }];
      }
      return wardBays(side, 8);
    },
    roof: 'flat', broken: 0.08,
  });
  // Helipad: a square of lines and the H.
  const [ix0, iz0, ix1, iz1] = tower.inner;
  const hx = (ix0 + ix1) / 2 + 4;
  const hz = (iz0 + iz1) / 2;
  const e = k.eaves;
  const pad = (x0: number, z0: number, x1: number, z1: number): void => {
    k.box(-1, x0, e, z0, x1, e + 0.02, z1, 'paper', { layer: 'shell', solid: false });
  };
  pad(hx - 6, hz - 6, hx + 6, hz - 5.8);
  pad(hx - 6, hz + 5.8, hx + 6, hz + 6);
  pad(hx - 6, hz - 5.8, hx - 5.8, hz + 5.8);
  pad(hx + 5.8, hz - 5.8, hx + 6, hz + 5.8);
  pad(hx - 1.5, hz - 2, hx - 1.1, hz + 2);
  pad(hx + 1.1, hz - 2, hx + 1.5, hz + 2);
  pad(hx - 1.1, hz - 0.2, hx + 1.1, hz + 0.2);
  // Outpatient block in front, 3 storeys, the main entrance; a walkway to the tower's lobby.
  const tl = tower.rooms.find((r) => r.level === 0 && r.bay.use === 'lobby')!;
  const tx = (tl.rect[0] + tl.rect[2]) / 2;
  const oz0 = 2 + 16.4 + 6;
  const out = wing(k, {
    rect: [2, oz0, 46, oz0 + 13], levels: 3, corridor: 'z-', cw: 2.8,
    left: { rooms: ['toilet', 'storage'] }, right: { rooms: ['storage', 'toilet'] },
    mat: 'plaster', tint: k.rand(), pierMat: 'glass',
    floorMat: () => 'vinyl',
    bays: (level) => {
      if (level === 0) return [{ use: 'clinic', len: 4.5, fit: nurse }, { use: 'clinic', len: 4.5, fit: nurse }, { use: 'lobby', len: 8, open: true, outer: { width: ARCH.door.wide * 1.5 }, fit: waiting }, { use: 'clinic', len: 7, fit: pharmacy }, { use: 'clinic', len: 4.5, fit: nurse }];
      if (level === 1) return [{ use: 'clinic', len: 4.5, fit: nurse }, { use: 'clinic', len: 4.5, fit: nurse }, { use: 'lab', len: 7, fit: lab }, { use: 'clinic', len: 4.5, fit: nurse }, { use: 'clinic', len: 4.5, fit: nurse }];
      return [{ use: 'clinic', len: 7, fit: surgery }, { use: 'clinic', len: 7, fit: surgery }, { use: 'clinic', len: 7, fit: surgery }, { use: 'office', len: 6, fit: office }];
    },
    entrances: [{ side: 'z-', at: tx, width: ARCH.door.wide }],
    roof: 'flat', broken: 0.12,
  });
  walkway(k, tx - 2, tx + 2, 2 + 16.4, oz0, k.levelY(1) - 0.4);
  const lobby = out.rooms.find((r) => r.level === 0 && r.bay.use === 'lobby')!;
  const lx = (lobby.rect[0] + lobby.rect[2]) / 2;
  const fz = oz0 + 13;
  k.box(-1, lx - 4, 3.2, fz, lx + 4, 3.45, fz + 5, 'concrete', { layer: 'shell', tint });
  for (const px of [lx - 3.8, lx + 3.6]) k.box(-1, px, -0.5, fz + 4.7, px + 0.2, 3.2, fz + 4.9, 'steel', { layer: 'shell' });
  cross(k, 40, k.levelY(3) - 1.2, fz, 2.2);
  // Emergency block on the right, 2 storeys, its wide door under the ambulance canopy.
  const ex0 = 58;
  const er = wing(k, {
    rect: [ex0, 4, w - 2, 4 + 14], levels: 2, corridor: 'z-', cw: 2.8,
    left: { rooms: ['toilet', 'storage'] }, right: false,
    mat: 'plaster', tint, pierMat: 'concrete',
    floorMat: () => 'vinyl',
    bays: (level) => (level === 0
      ? [{ use: 'clinic', len: 8, open: true, outer: { width: ARCH.door.wide * 1.5 }, fit: waiting }, { use: 'clinic', len: 6, fit: nurse }, { use: 'clinic', len: 5, fit: pharmacy }]
      : [{ use: 'ward', len: 5, fit: ward }, { use: 'ward', len: 5, fit: ward }, { use: 'clinic', len: 6, fit: surgery }]),
    roof: 'flat', broken: 0.15,
  });
  const erDoor = er.rooms.find((r) => r.level === 0 && r.bay.open)!;
  const ex = (erDoor.rect[0] + erDoor.rect[2]) / 2;
  k.box(-1, ex - 5, 3.6, 18, ex + 5, 3.85, 26, 'concrete', { layer: 'shell', tint: 0.2 });
  for (const [px, pz] of [[ex - 4.8, 25.6], [ex + 4.6, 25.6]] as const) k.box(-1, px, -0.5, pz, px + 0.2, 3.6, pz + 0.2, 'steel', { layer: 'shell' });
  k.box(-1, ex - 2, 3.0, 18, ex + 2, 3.6, 18.1, 'sign', { layer: 'shell', tint: 0.6, solid: false });
  truck(k, ex - 2.2, 23.5, 'z', 5.5, 0.05, -1);
  if (k.rand() < 0.6) truck(k, ex + 2.4, 23.5, 'z', 5.5, 0.05, -1);
  // The car park in front on the right.
  for (let x = 52; x + 2.5 < w - 2; x += 2.6) {
    for (const z0 of [32, 44]) {
      if (z0 + 5.5 > d - 2) continue;
      stripe(k, x, z0, x + 0.1, z0 + 5.5);
      if (k.rand() < 0.45) car(k, x + 1.3, z0 + 2.8, 'z');
    }
  }
});

export const HOSPITALS: readonly BuildingDef[] = [PUBLIC_CLINIC, PUBLIC_HOSPITAL_MID, PUBLIC_HOSPITAL_LARGE];
