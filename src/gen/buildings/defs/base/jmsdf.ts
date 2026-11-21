// 海上自衛隊の基地 (07d-2f). Only for an area on the coast: the back of the site (z < QUAY) is the
// harbour water, the quay runs along x at z = QUAY, and the front (z = d) is the landward gate.
//
//   the water      painted, kept off by a hidden barrier along the quay edge (bullets and sight pass)
//   the ships      a destroyer (護衛艦) and a minesweeper (掃海艇) moored along the quay; a gangway
//                  (舷梯, a straight stair from a railed foot on the quay) to each deck; the deck
//                  round the superstructure, the gun, the funnel, the helicopter deck; inside the
//                  superstructure the mess and the armory (locked: the area's key) on the deck
//                  level, the crew's berths and the sick bay above, the bridge on top (a perch)
//   the quay       bollards, a crane, crates and containers
//   ashore         two warehouses (倉庫), the HQ (司令部庁舎: the commander's safe holds the key),
//                  a barracks (locked up), two ammunition depots, the fence and the main gate

import { ARCH } from '../../../../data/architecture.ts';
import type { Hole, Kit, Rect } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import type { Fit } from '../office/common.ts';
import { hall, mesh } from '../public/common.ts';
import { paint, pave, splitRooms } from '../transport/common.ts';
import { command, container, cots, crates, DARK, medical, OD, supplies } from '../military/parts.ts';
import { depot, hq, lockedBlock, mainGate, parade, sdfDef, type KeyRect } from './sdf_parts.ts';

/** z of the quay edge (the water is behind it). */
const QUAY = 42;
const P = ARCH.wall.partition / 2;

interface ShipSpec {
  x0: number;
  len: number;
  beam: number;
  /** Superstructure: where it starts (along the ship from the stern), its length, its tiers (the bridge on the top one). */
  house: [number, number];
  tiers: number;
  /** Gangway position (x). */
  gangway: number;
  tint: number;
  gun?: boolean;
}

/** A ship moored along the quay (its starboard side at QUAY - 1). Returns the key rects of its armory. */
function ship(k: Kit, f: Fit, s: ShipSpec): KeyRect[] {
  const deck = k.levelY(1);
  const z1 = QUAY - 1;
  const z0 = z1 - s.beam;
  const zc = (z0 + z1) / 2;
  const bow = Math.min(12, s.len * 0.15);
  const xb = s.x0 + s.len - bow; // the end of the square deck
  const sh = { layer: 'shell' as const, tint: s.tint };
  // Hull (to just under the deck), the stepped bow, the boot top.
  k.box(-1, s.x0, -1.5, z0, xb, deck - 0.2, z1, 'steel', sh);
  const steps: [number, number, number][] = [[0, 0.5, 0.72], [0.5, 0.85, 0.42], [0.85, 1, 0.14]];
  for (const [a, b, wf] of steps) k.box(-1, xb + bow * a, -1.5, zc - (s.beam * wf) / 2, xb + bow * b, deck, zc + (s.beam * wf) / 2, 'steel', sh);
  k.box(-1, s.x0, -0.3, z0 - 0.02, s.x0 + s.len - 2, 0.3, z1 + 0.02, 'steel', { layer: 'shell', tint: 0.95, solid: false });
  k.floor(1, 'concrete', [s.x0, z0, xb, z1], { tint: 0.85 });
  // The hull number (drawn only), the railings (a gap at the gangway).
  k.box(-1, xb - 10, deck - 2.2, z1, xb - 6, deck - 0.6, z1 + 0.02, 'paper', { layer: 'shell', solid: false });
  const y = deck;
  const rail = (a: number, b: number, za: number, zb: number): void => {
    if (b - a > 0.05) k.box(1, a, y, za, b, y + 1.0, zb, 'steel', { layer: 'shell', tint: 0.95, role: 'furniture' });
  };
  rail(s.x0, s.gangway - 0.8, z1 - 0.06, z1);
  rail(s.gangway + 0.8, xb, z1 - 0.06, z1);
  rail(s.x0, xb, z0, z0 + 0.06);
  rail(s.x0, s.x0 + 0.06, z0 + 0.06, z1 - 0.06);
  // Superstructure.
  const t = 0.15;
  const hx0 = s.x0 + s.house[0];
  const hx1 = hx0 + s.house[1];
  const hz0 = z0 + 2.4;
  const hz1 = z1 - 2.4;
  const ix0 = hx0 + t;
  const ix1 = hx1 - t;
  const iz0 = hz0 + t;
  const iz1 = hz1 - t;
  const lane = ARCH.stair.width;
  const n = Math.ceil(k.def.storeyHeight / 2 / ARCH.stair.maxRise - 1e-6);
  const well = n * ARCH.stair.going + ARCH.stair.landing;
  const xh = ix0 + 1.6; // the stair hall, then the stairwell along x against the z- wall
  const xw = xh + well;
  const zw = iz0 + 2 * lane + 0.15;
  const xm = xw + P + (ix1 - xw) * 0.6;
  const keys: KeyRect[] = [];
  const top = s.tiers; // the bridge's level
  for (let l = 1; l <= top; l++) {
    const fy = k.levelY(l);
    const bridge = l === top;
    const wo = { mat: 'steel' as const, tint: 0.9, y0: fy, y1: k.levelY(l + 1), layer: 'shell' as const };
    const win = (at: number, wdt: number): Hole => k.window(at, wdt, { sill: bridge ? 1.0 : 1.3, head: bridge ? 2.4 : 1.8, broken: k.rand() < 0.4 });
    const side = (len: number): Hole[] => (bridge ? [win(len * 0.75, len * 0.4)] : [win(len * 0.7, 0.6), win(len * 0.85, 0.6)]);
    const doors = l === 1 ? [k.door(1.0, 'open')] : [];
    k.wall(l, hx0, hz1 - t, hx1, hz1, [...doors, ...side(hx1 - hx0)], wo);
    k.wall(l, hx0, hz0, hx1, hz0 + t, l === 1 ? [k.door(1.0, 'open')] : [], wo);
    k.wall(l, hx0, iz0, hx0 + t, iz1, [], wo);
    k.wall(l, hx1 - t, iz0, hx1, iz1, bridge ? [k.window((iz1 - iz0) / 2, iz1 - iz0 - 1.2, { sill: 1.0, head: 2.4, broken: k.rand() < 0.5 })] : [], wo);
    if (l > 1) k.floor(l, 'vinyl', [ix0, iz0, ix1, iz1]);
    if (l < top) k.stairs({ level: l, start: [xh, iz0 + lane / 2], dir: 'x+', width: lane, kind: 'switchback', turn: 'right', mat: 'steel', tint: 0.6 });
    const hallId = k.room(l, ix0, iz0, xh, iz1, 'hall');
    const sideId = k.room(l, xh, zw, xw, iz1, 'hall');
    k.join(hallId, sideId);
    k.partition(l, xw + P, iz0, xw + P, iz1, [k.door(iz1 - iz0 - 1.0)]);
    if (bridge) {
      const b = k.room(l, xw + 2 * P, iz0, ix1, iz1, 'command');
      f.row(b, 'x+', 2.0, 0.8, 1.0, 'counter', { kind: 'desk', table: 'command', max: 3, tint: 0.2 });
      f.ensure(b, 'cabinet', 'command');
      continue;
    }
    k.partition(l, xm, iz0, xm, iz1, [k.door(iz1 - iz0 - 1.0, l === 1 ? 'locked' : 'open')]);
    const a = k.room(l, xw + 2 * P, iz0, xm - P, iz1, l === 1 ? 'canteen' : 'barracks');
    const r = k.room(l, xm + P, iz0, ix1, iz1, l === 1 ? 'armory' : 'clinic', { locked: l === 1 });
    if (l === 1) {
      f.row(a, 'z-', 1.6, 0.8, 0.75, 'steel', { kind: 'table', table: 'canteen', max: 3, tint: 0.5 });
      f.ensure(a, 'counter', 'kitchen');
      // The armory: racks against the far end, ammunition boxes (placed straight: nobody walks there yet).
      k.furniture(l, ix1 - 0.6, iz0 + 0.3, ix1, iz1 - 0.3, 1.9, 'steel', { tint: 0.4, search: { kind: 'shelf', face: 'x-', table: 'weapons' } });
      keys.push([l, [xm - 0.2, iz0, ix1, iz1]]);
      void r;
    } else {
      cots(f, a, { max: 3 });
      medical(f, r);
    }
  }
  // The roof of the bridge, the mast and the radar, the funnel and the gun on the deck.
  const rt = k.levelY(top + 1);
  k.box(-1, hx0, rt - 0.2, hz0, hx1, rt, hz1, 'steel', { layer: 'shell', tint: 0.9 });
  const mx = (hx0 + hx1) / 2;
  k.box(-1, mx - 0.3, rt, zc - 0.3, mx + 0.3, rt + 8, zc + 0.3, 'steel', { layer: 'shell', tint: 0.9 });
  k.box(-1, mx - 0.2, rt + 6, zc - 2.5, mx + 0.2, rt + 6.15, zc + 2.5, 'steel', { layer: 'shell', tint: 0.9, solid: false });
  k.box(-1, mx - 1.0, rt + 3, zc - 1.0, mx + 1.0, rt + 4.4, zc + 1.0, 'appliance', { layer: 'shell', tint: 0.9 });
  const funnel: Rect = [hx0 - 6, zc - 2, hx0 - 2, zc + 2];
  k.box(-1, funnel[0], deck, funnel[1], funnel[2], deck + 6, funnel[3], 'steel', { layer: 'shell', tint: 0.9 });
  k.box(-1, funnel[0], deck + 6, funnel[1], funnel[2], deck + 6.4, funnel[3], 'steel', { layer: 'shell', tint: 0.1, solid: false });
  const obstacles: Rect[] = [funnel, [hx0, hz0, hx1, hz1]];
  if (s.gun) {
    const gx = hx1 + (xb - hx1) * 0.45;
    const gun: Rect = [gx - 2, zc - 1.6, gx + 2, zc + 1.6];
    k.box(-1, gun[0], deck, gun[1], gun[2], deck + 1.8, gun[3], 'steel', { layer: 'shell', tint: 0.9 });
    k.box(-1, gun[2], deck + 1.0, zc - 0.12, gun[2] + 6, deck + 1.25, zc + 0.12, 'steel', { layer: 'shell', tint: 0.9, solid: false });
    obstacles.push(gun);
  }
  // The helicopter deck at the stern (paint).
  const hdx = s.x0 + 1;
  if (s.house[0] > 22) {
    paint(k, hdx, z0 + 1, hdx + 14, z1 - 1, 0.1, 'concrete', deck + 0.02);
    paint(k, hdx + 6, zc - 3, hdx + 6.6, zc + 3, 0, 'paper', deck + 0.03);
    paint(k, hdx + 9, zc - 3, hdx + 9.6, zc + 3, 0, 'paper', deck + 0.03);
    paint(k, hdx + 6.6, zc - 0.3, hdx + 9, zc + 0.3, 0, 'paper', deck + 0.03);
  }
  // The deck as rooms round what stands on it (clear of the railings and the gangway's hole).
  const rooms = splitRooms(k, 1, [s.x0 + 0.3, z0 + 0.3, xb - 0.2, z1 - 0.6], obstacles.sort((a, b) => a[0] - b[0]), 'roof', 'x', 50);
  for (const r of rooms) if (r.rect[2] - r.rect[0] > 12) f.ensure(r.id, 'crate', 'field');
  // The gangway: a stair from a railed foot on the quay up to the deck.
  const gz = QUAY + 2.75;
  k.stairs({ level: 0, start: [s.gangway, gz], dir: 'z-', width: 1.2, kind: 'straight', rails: ['left', 'right'], mat: 'steel', tint: 0.6 });
  const foot: Rect = [s.gangway - 1.6, QUAY, s.gangway + 1.6, QUAY + 6.4];
  const ro = { mat: 'steel' as const, tint: 0.6, y1: 1.1, exterior: true, layer: 'shell' as const };
  k.wall(0, foot[0], foot[3] - 0.08, foot[2], foot[3], [k.door(1.6, 'open', 1.2)], ro);
  k.wall(0, foot[0], foot[1], foot[0] + 0.08, foot[3] - 0.08, [], ro);
  k.wall(0, foot[2] - 0.08, foot[1], foot[2], foot[3] - 0.08, [], ro);
  k.floor(0, 'concrete', [foot[0] + 0.08, foot[1], foot[2] - 0.08, foot[3] - 0.08], { tint: 0.3 });
  k.room(0, foot[0] + 0.08, foot[1], foot[2] - 0.08, foot[3] - 0.08, 'hall');
  return keys;
}

/** 倉庫 on the quay: shutters to the quay (z-), a door at the front, shelves and crates. */
function warehouse(k: Kit, f: Fit, r: Rect, tint: number): void {
  const [x0, , x1] = r;
  const h = hall(k, {
    rect: r, levels: 2, mat: 'siding', tint, use: 'storage', floorMat: 'concrete',
    doors: [
      { side: 'z-', at: x0 + (x1 - x0) * 0.3, width: 5, head: 5, state: k.rand() < 0.6 ? 'open' : 'shutter' },
      { side: 'z-', at: x0 + (x1 - x0) * 0.7, width: 5, head: 5, state: 'shutter' },
      { side: 'z+', at: x1 - 3 },
    ],
    high: { sides: ['z+', 'x-', 'x+'], n: 3, width: 9 }, roof: 'gable', roofMat: 'metalRoof', roofTint: k.rand(), rise: 2.2, axis: 'x', broken: 0.4,
  });
  supplies(f, h.id, ['storage', 'field', 'grocery', 'fuel', 'tools'], 8);
}

export const BASE_JMSDF: BuildingDef = sdfDef('jmsdf', { size: { w: [260, 320], d: [160, 200] }, roofRise: 22, limits: { shell: 8000, interior: 9000 } }, (k, f) => {
  const { w, d } = k;
  const tint = k.rand();
  // The harbour water and the quay edge (a hidden barrier keeps walkers out of the water; gaps at the gangways).
  paint(k, 0, 0, w, QUAY, 0, 'tile', 0.03);
  const gang = [20 + 60, 20 + 140 + 12 + 30];
  k.box(-1, 0, -0.2, QUAY - 0.25, w, 0.35, QUAY, 'concrete', { layer: 'shell', tint: 0.9 });
  let gx0 = 0;
  for (const g of gang) {
    k.box(-1, gx0, 0.35, QUAY - 0.25, g - 0.7, 1.9, QUAY, 'glass', { layer: 'shell', hidden: true });
    gx0 = g + 0.7;
  }
  k.box(-1, gx0, 0.35, QUAY - 0.25, w, 1.9, QUAY, 'glass', { layer: 'shell', hidden: true });
  pave(k, 0, QUAY, w, QUAY + 26, 'concrete', 0.3);
  for (let x = 8; x < w - 4; x += 14) if (!gang.some((g) => Math.abs(g - x) < 3)) k.box(-1, x - 0.3, 0, QUAY + 0.3, x + 0.3, 0.6, QUAY + 0.9, 'steel', { layer: 'shell', tint: 0.1, role: 'furniture' });
  // The ships.
  const keys = ship(k, f, { x0: 20, len: 140, beam: 17, house: [48, 30], tiers: 3, gangway: gang[0]!, tint: 0.3, gun: true });
  keys.push(...ship(k, f, { x0: 20 + 140 + 12, len: 54, beam: 9.5, house: [18, 14], tiers: 2, gangway: gang[1]!, tint: 0.3 }));
  // The quay: a crane, crates, containers.
  const cx = w - 40;
  for (const z of [QUAY + 2, QUAY + 14]) for (const x of [cx, cx + 14]) k.box(-1, x, 0, z, x + 1, 20, z + 1, 'steel', { layer: 'shell', tint: 0.6 });
  k.box(-1, cx - 1, 20, QUAY - 6, cx + 16, 21.5, QUAY + 15, 'sign', { layer: 'shell', tint: 0.6, solid: false });
  crates(k, [cx + 3, QUAY + 5, cx + 8, QUAY + 9]);
  const c1 = container(k, [w - 20, QUAY + 4, w - 13.9, QUAY + 6.5], 'x-', { tint: 0.4, mat: 'steel' });
  supplies(f, c1, ['field', 'storage'], 2);
  // Ashore: two warehouses, the HQ, the barracks, the depots, the gate.
  warehouse(k, f, [10, QUAY + 30, 70, QUAY + 56], k.rand());
  warehouse(k, f, [80, QUAY + 30, 140, QUAY + 56], k.rand());
  const gx = w / 2 + 20;
  keys.push(...hq(k, [w - 78, d - 56, w - 20, d - 41], 3, tint));
  lockedBlock(k, [12, d - 40, 64, d - 25], 3, k.rand());
  keys.push(depot(k, [160, QUAY + 34, 169, QUAY + 46]), depot(k, [174, QUAY + 34, 183, QUAY + 46]));
  parade(k, [gx - 18, d - 50, gx + 14, d - 30], [gx - 12, d - 40]);
  const gap = mainGate(k, f, gx, d - 30, tint);
  const e = 0.6;
  mesh(k, e, d - e, w - e, d - e, [gap], 2.2);
  mesh(k, e, QUAY + 1, e, d - e, [], 2.2);
  mesh(k, w - e, QUAY + 1, w - e, d - e, [], 2.2);
  const cmd = container(k, [cx - 12, QUAY + 30, cx - 6, QUAY + 32.5], 'x-', { use: 'command', mat: 'siding', tint: 0.2 });
  command(f, cmd);
  k.box(-1, 150, 0, QUAY + 10, 152, 2.1, QUAY + 13, 'sign', { layer: 'shell', tint: 0.8, role: 'furniture' }); // forklift
  k.box(-1, 120, 0, QUAY + 8, 126, 1.4, QUAY + 12, 'olive', { layer: 'shell', tint: OD, role: 'furniture' });
  k.box(-1, 120, 1.4, QUAY + 8, 123, 1.8, QUAY + 10, 'olive', { layer: 'shell', tint: DARK, role: 'furniture' });
  return keys;
});
