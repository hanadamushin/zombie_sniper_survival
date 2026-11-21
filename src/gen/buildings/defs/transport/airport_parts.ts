// Airport pieces (07d-2e), shared by airport_s, airport_m and airport_l. The runway runs along x at the
// back of the site (low z), then the taxiway, the apron with the parked aircraft, the terminal, and
// the landside road and car park at the front (z = d).
//
//   runway        asphalt, edge and centre lines, threshold bars where an end lies on the site
//   terminal      a two-storey terminal (stationHouse): check-in and baggage claim below, gate lounges,
//                 the duty free and the restaurant upstairs, doors onto the apron, the roof deck (送迎デッキ)
//   controlTower  the tower (tower): a stair shaft up to the glazed cab (管制室, a sniper's perch)
//   hangar        a tall hall with a shuttered door onto the apron, a small door, a light aircraft inside
//   jetway        a boarding bridge from a first-floor door out over the apron (its far end shut)

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit, Rect } from '../../kit.ts';
import type { RoomUse } from '../../types.ts';
import { car as parkedCar } from '../shop/common.ts';
import { ringRooms, type Fit } from '../office/common.ts';
import { hall, truck } from '../public/common.ts';
import { paint, pave, plane } from './common.ts';
import { stationHouse, tower, type WingRoom } from './parts.ts';

/** The runway along x at zc, `width` wide, from x0 to x1; threshold bars at the ends that are on the site. */
export function runway(k: Kit, x0: number, x1: number, zc: number, width: number, ends: boolean): void {
  const hw = width / 2;
  pave(k, x0, zc - hw, x1, zc + hw, 'asphalt', 0);
  paint(k, x0, zc - hw + 0.8, x1, zc - hw + 1.6, 0, 'paper', 0.05);
  paint(k, x0, zc + hw - 1.6, x1, zc + hw - 0.8, 0, 'paper', 0.05);
  const from = ends ? x0 + 70 : x0 + 10;
  const to = ends ? x1 - 70 : x1 - 10;
  for (let x = from; x + 30 < to; x += 60) paint(k, x, zc - 0.5, x + 30, zc + 0.5, 0, 'paper', 0.05);
  if (ends) {
    for (const xe of [x0 + 8, x1 - 38]) {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const z = zc - hw + 3 + ((width - 6) * (i + 0.5)) / n;
        paint(k, xe, z - width / 30, xe + 30, z + width / 30, 0, 'paper', 0.05);
      }
    }
    // Aiming points.
    for (const xa of [x0 + 160, x1 - 205]) if (xa > x0 + 100 && xa + 45 < x1 - 100) for (const s of [-1, 1]) paint(k, xa, zc + s * hw * 0.45 - 2, xa + 45, zc + s * hw * 0.45 + 2, 0, 'paper', 0.05);
  }
}

/** A taxiway along x at zc with its yellow centre line. */
export function taxiway(k: Kit, x0: number, x1: number, zc: number, width: number): void {
  pave(k, x0, zc - width / 2, x1, zc + width / 2, 'asphalt', 0);
  paint(k, x0, zc - 0.15, x1, zc + 0.15, 0.95, 'sign', 0.05);
}

/** A windsock: a mast and the cone (drawn only above the foot). */
export function windsock(k: Kit, x: number, z: number): void {
  k.box(-1, x - 0.1, 0, z - 0.1, x + 0.1, 6, z + 0.1, 'steel', { layer: 'shell', tint: 0.5 });
  k.box(-1, x + 0.1, 5.2, z - 0.4, x + 3.6, 5.9, z + 0.4, 'sign', { layer: 'shell', tint: 0.6, solid: false });
}

export interface TerminalSpec {
  rect: Rect;
  centre: number;
  tint: number;
  /** First-floor doors (x) for boarding bridges. */
  jetways?: number[];
  /** Big terminal: more rooms per wing. */
  big?: boolean;
}

/** A two-storey terminal (docs on top). Returns the roof rooms (the deck) and the wing x ranges. */
export function terminal(k: Kit, f: Fit, s: TerminalSpec): { roof: number[]; xa: number; xb: number } {
  const [x0, , x1] = s.rect;
  const cm = (x0 + x1) / 2;
  const xa = cm - s.centre / 2;
  const xb = cm + s.centre / 2;
  const shop = (): 'open' | 'shutter' => (k.rand() < 0.5 ? 'open' : 'shutter');
  const wings = (level: number, side: 'left' | 'right'): WingRoom[] => {
    const big = s.big ?? false;
    if (level === 0) return side === 'left'
      ? [{ use: 'baggage' }, ...(big ? [{ use: 'office' as RoomUse, state: 'locked' as const }] : []), { use: 'office', state: k.rand() < 0.6 ? 'open' : 'locked' }, { use: 'sales', state: shop(), street: 'shutter' }]
      : [{ use: 'baggage' }, ...(big ? [{ use: 'storage' as RoomUse }] : []), { use: 'toilet' }, { use: 'canteen', state: shop(), street: 'shutter' }];
    return side === 'left'
      ? [{ use: 'lobby' }, { use: 'sales' }, ...(big ? [{ use: 'sales' as RoomUse, state: shop() }] : []), { use: 'toilet' }]
      : [{ use: 'lobby' }, { use: 'canteen' }, ...(big ? [{ use: 'kitchen' as RoomUse }] : []), { use: 'office', state: k.rand() < 0.5 ? 'open' : 'locked' }];
  };
  const wl = (xa + x0) / 2;
  const wr = (xb + x1) / 2;
  const res = stationHouse(k, f, {
    rect: s.rect, centre: s.centre, wings, mat: k.pick(['concrete', 'plaster', 'mortar'] as const), tint: s.tint, doors: s.big ? 4 : 3, gates: false,
    back0: [wl, wr], back1: s.jetways,
  });
  return { roof: res.roof, xa, xb };
}

/** Light aircraft and service vehicles on the apron, cars on the landside. */
export function landside(k: Kit, x0: number, x1: number, z0: number, z1: number): void {
  pave(k, x0, z0, x1, z1);
  for (let x = x0 + 3; x < x1 - 3; x += 12) paint(k, x, z1 - 9, x + 0.12, z1 - 3);
  for (let i = 0; i < 10; i++) if (k.rand() < 0.5) parkedCar(k, x0 + 6 + i * 6 * ((x1 - x0 - 12) / 60), z1 - 6, 'z');
}

/** Service vehicles near (x, z): a fuel truck, a tug, a row of baggage carts. */
export function apronClutter(k: Kit, x: number, z: number): void {
  truck(k, x, z, 'x', 8, 0.9);
  k.box(-1, x + 7, 0, z - 1, x + 9.5, 1.3, z + 1, 'appliance', { layer: 'shell', tint: 0.9, role: 'furniture' });
  for (let i = 0; i < 3; i++) k.box(-1, x + 11 + i * 3, 0.3, z - 0.8, x + 13.4 + i * 3, 1.2, z + 0.8, 'steel', { layer: 'shell', tint: 0.6, role: 'furniture' });
}

/** The control tower on rect (its door at the front, z1): the cab on its top storey. */
export function controlTower(k: Kit, f: Fit, rect: Rect, levels: number, tint: number): void {
  const m = (rect[0] + rect[2]) / 2;
  tower(k, f, {
    rect, levels, stairsTo: levels - 1, open: (l) => l === 0 || l === levels - 1, mat: 'concrete', tint, sheet: 'concrete', entrance: [m],
    plate: (l, inner, core) => {
      const ring = ringRooms(k, l, inner, core, l === 0 ? 'lobby' : 'tower');
      if (l === 0) {
        for (const r of ring.all) f.ensure(r, 'locker', 'tower');
        return;
      }
      // The cab: consoles round the glass, a radio rack.
      for (const r of ring.all) {
        f.row(r, 'z+', 2.4, 0.7, 0.9, 'counter', { kind: 'desk', table: 'tower', max: 2, tint: 0.2 });
        f.row(r, 'x+', 2.4, 0.7, 0.9, 'counter', { kind: 'desk', table: 'tower', max: 1, tint: 0.2 });
        f.ensure(r, 'cabinet', 'tower');
      }
    },
  });
  // The cab's glass band stands out a little, an antenna on top.
  const yc = k.levelY(levels - 1);
  k.box(-1, rect[0] - 0.4, yc + 0.9, rect[1] - 0.4, rect[2] + 0.4, yc + 1.0, rect[3] + 0.4, 'concrete', { layer: 'shell', tint, solid: false });
  k.box(-1, rect[0] - 0.4, yc + k.def.storeyHeight - 0.3, rect[1] - 0.4, rect[2] + 0.4, yc + k.def.storeyHeight + 0.3, rect[3] + 0.4, 'concrete', { layer: 'shell', tint, solid: false });
  k.box(-1, m - 0.1, k.levelY(levels) + 2.6, (rect[1] + rect[3]) / 2 - 0.1, m + 0.1, k.levelY(levels) + 6, (rect[1] + rect[3]) / 2 + 0.1, 'steel', { layer: 'shell', solid: false });
}

/** A hangar on rect: the big shuttered door on its back (z0, the apron), a small door at the front, a light aircraft inside, shelves. */
export function hangar(k: Kit, f: Fit, rect: Rect, tint: number): void {
  const [x0, z0, x1, z1] = rect;
  const m = (x0 + x1) / 2;
  const h = hall(k, {
    rect, levels: 2, mat: 'metalRoof', tint, use: 'garage', roof: 'gable', roofMat: 'metalRoof', roofTint: tint, rise: 3, axis: 'z',
    doors: [{ side: 'z-', at: m, width: Math.min(30, x1 - x0 - 8), state: 'shutter', head: 2 * k.def.storeyHeight - 1.5 }, { side: 'z+', at: x0 + 4, width: ARCH.door.width }],
    high: { sides: ['x-', 'x+'], n: 3 },
  });
  const [ix0, iz0, ix1] = h.inner;
  // The aircraft, nose to the door, in the middle; shelves and a workbench along the side walls.
  plane(k, m + 2, (iz0 + z1) / 2 - 2, Math.min(14, z1 - z0 - 12), 'z-', k.rand(), { props: true });
  f.row(h.id, 'x+', 2.0, 0.6, 2.0, 'shelf', { kind: 'shelf', table: 'tools', max: 3, tint: 0.5 });
  f.row(h.id, 'x-', 2.0, 0.8, 0.9, 'counter', { kind: 'counter', table: 'garage', max: 2, from: iz0 + 2, to: z1 - 6, tint: 0.3 });
  f.row(h.id, 'z+', 1.0, 1.0, 1.0, 'rust', { kind: 'crate', table: 'fuel', max: 2, from: x0 + 8, tint: 0.5 });
  f.ensure(h.id, 'crate', 'garage');
  void ix0;
  void ix1;
}

/**
 * A boarding bridge from a first-floor door at x in the back wall (z0) out `len` metres over the
 * apron: a glazed corridor on a column, its far end shut where the aircraft's door would be. Returns its room.
 */
export function jetway(k: Kit, f: Fit, x: number, z0: number, len: number, tint: number): number {
  const y1 = k.levelY(1);
  const hw = 1.3;
  const za = z0 - len;
  const sh = { layer: 'shell' as const, tint };
  k.box(-1, x - hw - 0.1, y1 - 0.35, za, x + hw + 0.1, y1, z0, 'steel', sh);
  for (const s of [-1, 1]) {
    k.box(-1, x + s * hw, y1, za, x + s * (hw + 0.1), y1 + 0.9, z0, 'steel', sh);
    k.box(-1, x + s * (hw + 0.05) - 0.015, y1 + 0.9, za, x + s * (hw + 0.05) + 0.015, y1 + 2.2, z0, 'glass', { layer: 'shell' });
  }
  k.box(-1, x - hw - 0.1, y1 + 2.2, za, x + hw + 0.1, y1 + 2.5, z0, 'steel', sh);
  k.box(-1, x - hw - 0.1, y1, za - 0.1, x + hw + 0.1, y1 + 2.2, za, 'doorSteel', sh);
  k.box(-1, x - 0.4, 0, za + 2.0, x + 0.4, y1 - 0.35, za + 2.8, 'steel', sh);
  k.box(-1, x - 1.2, 0, za + 1.6, x + 1.2, 0.8, za + 3.2, 'steel', { ...sh, role: 'furniture' });
  const id = k.room(1, x - hw, za, x + hw, z0, 'hall');
  f.row(id, 'z-', 1.0, 0.8, 0.9, 'wood', { kind: 'crate', table: 'baggage', max: 1, tint: 0.4 });
  f.ensure(id, 'crate', 'baggage');
  if (f.chance(0.4)) f.stain(id);
  return id;
}
