// 町の駅 (07d-2e): a one-storey station house on the road with its gate onto the first platform,
// two side platforms facing each other across two electrified tracks, and a covered footbridge
// (跨線橋) over the tracks: an enclosed stair up from each platform and the bridge between them. A
// train stands at the first platform with its doors open, sometimes another at the second.
//
//   z = d   forecourt (taxi, bicycles)
//           +--office--+---hall---+--shop/WC--+          station house (gate G onto platform A)
//    =[st]==+==========G==========+=====================  platform A
//    ---- track 1 (train, open) --------------------------
//    ---- track 2 ----------------------------------------
//    =[st]================================================  platform B
//   z = 0   ([st]: the stairs up to the footbridge, which crosses at the left)

import { ARCH } from '../../../../data/architecture.ts';
import type { Hole, Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { car as parkedCar } from '../shop/common.ts';
import { twoPass, type Fit } from '../office/common.ts';
import { canopy, EDGE, fence, flight, flightLength, mast, nameBoard, P, pave, platform, SPACING, track, train, trainLength, wire } from './common.ts';

export const TRANSPORT_STATION_TOWN: BuildingDef = {
  id: 'transport.station_town',
  category: 'transport',
  variant: 'station_town',
  kind: 'shop',
  size: { w: [70, 90], d: [34, 42] },
  storeys: 1,
  storeyHeight: 4.5,
  plinth: 0.5,
  roof: 'flat',
  roofRise: 3.0,
  lootable: true,
  generate(rng, params) {
    return twoPass(TRANSPORT_STATION_TOWN, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const fy = k.levelY(0);
  const y1 = k.levelY(1);
  const L = flightLength(k);
  // Bands across the site, back to front.
  const zB0 = 1.0;
  const zB1 = zB0 + 4.6;
  const zt2 = zB1 + EDGE;
  const zt1 = zt2 + SPACING;
  const zA0 = zt1 + EDGE;
  const zA1 = zA0 + 4.6;
  const bd = 10 + (d - 34) * 0.25;
  const zS1 = zA1 + bd;
  // The station house and the footbridge to its left.
  const bw = 22 + (w - 70) * 0.15;
  const bx0 = Math.round((w - bw) * k.range(0.45, 0.6) * 10) / 10;
  const bx1 = bx0 + bw;
  const cw = 2.6;
  const fx1 = bx0 - 1.2 - L;
  const fx0 = fx1 - cw;
  const zsA = zA1 - 0.7;
  const zsB = zB0 + 0.7;
  const tint = k.rand();
  const roofTint = k.rand();

  // ---- Tracks, wires and masts.
  for (const z of [zt1, zt2]) {
    track(k, z, 0, w);
    wire(k, z, 0, w);
  }
  for (let x = 4; x < w - 2; x += 24) if (x < fx0 - 1 || x > fx1 + 1) mast(k, x, (zt1 + zt2) / 2, zt2 - 0.3, zt1 + 0.3);

  // ---- Platforms (A: the house's side, B: the far side), the stairs and the bridge's columns on them.
  const obsA: [number, number, number, number] = [fx0 - 0.2, zsA - 0.7, fx1 + L, zA1];
  const obsB: [number, number, number, number] = [fx0 - 0.2, zB0, fx1 + L, zsB + 0.7];
  const platA = platform(k, 6, w - 6, zA0, zA1, { edges: ['z-'], obstacles: [obsA] });
  const platB = platform(k, 8, w - 8, zB0, zB1, { edges: ['z+'], obstacles: [obsB] });
  flight(k, 0, 1, fx1 + L, zsA, 'x-', { tint });
  flight(k, 0, 1, fx1 + L, zsB, 'x-', { tint });
  for (const z of [zsA, zsB]) {
    k.box(-1, fx0 - 0.15, 0, z - 0.15, fx0 + 0.15, y1 - 0.2, z + 0.15, 'concrete', { layer: 'shell', tint });
    k.box(-1, fx1 - 0.4, 0, z - 0.15, fx1 - 0.1, y1 - 0.2, z + 0.15, 'concrete', { layer: 'shell', tint });
  }
  for (const x of [fx0, fx1 - 0.25]) k.box(-1, x - 0.15, 0, (zt1 + zt2) / 2 - 0.15, x + 0.15, y1 - 0.2, (zt1 + zt2) / 2 + 0.15, 'concrete', { layer: 'shell', tint });
  // The bridge: one long room between the two stair heads, glazed sides, a roof.
  const bz0 = zsB - 0.6;
  const bz1 = zsA + 0.6;
  k.floor(1, 'vinyl', [fx0, bz0, fx1, bz1]);
  const bridge = k.room(1, fx0, bz0, fx1, bz1, 'hall');
  const side = (x0: number, x1: number, za: number, zb: number): void => {
    k.box(-1, x0, y1 - 0.4, za, x1, y1 + 1.0, zb, 'concrete', { layer: 'shell', tint });
    k.box(-1, (x0 + x1) / 2 - 0.015, y1 + 1.0, za, (x0 + x1) / 2 + 0.015, y1 + 2.2, zb, 'glass', { layer: 'shell', hidden: k.rand() < 0.3 });
    k.box(-1, x0, y1 + 2.2, za, x1, y1 + 2.6, zb, 'concrete', { layer: 'shell', tint });
  };
  side(fx0 - 0.12, fx0, bz0 - 0.1, bz1 + 0.1);
  side(fx1, fx1 + 0.12, zsB + 0.7, zsA - 0.7);
  k.box(-1, fx0 - 0.12, y1 - 0.4, bz0 - 0.1, fx1 + 0.12, y1 + 2.6, bz0, 'concrete', { layer: 'shell', tint });
  k.box(-1, fx0 - 0.12, y1 - 0.4, bz1, fx1 + 0.12, y1 + 2.6, bz1 + 0.1, 'concrete', { layer: 'shell', tint });
  k.box(-1, fx0 - 0.3, y1 + 2.6, bz0 - 0.3, fx1 + 0.3, y1 + 2.8, bz1 + 0.3, 'metalRoof', { layer: 'shell', tint: roofTint });
  if (f.chance(0.5)) f.stain(bridge, 'debris', 2);

  // ---- The station house.
  const t = ARCH.wall.exterior;
  const hw = 9 + (w - 70) * 0.05;
  const hx0 = bx0 + (bw - hw) * 0.42;
  const hx1 = hx0 + hw;
  const zm = zA1 + bd * 0.5; // the right wing's split: shop in front, WC behind
  const gate = (hx0 + hx1) / 2;
  const front: Hole[] = [
    k.window((bx0 + hx0) / 2 - bx0, hx0 - bx0 - 2.4, { sill: 1.0, broken: k.rand() < 0.4 }),
    k.door(gate - 1.4 - bx0, 'open', ARCH.door.wide),
    k.door(gate + 1.4 - bx0, k.rand() < 0.5 ? 'open' : 'locked', ARCH.door.wide),
    k.window((hx1 + bx1) / 2 - bx0, bx1 - hx1 - 2.4, { sill: 0.3, head: 2.6, broken: k.rand() < 0.5 }),
  ];
  const wall = { mat: 'plaster' as const, tint, y1: k.eaves, layer: 'shell' as const };
  k.wall(0, bx0, zS1 - t, bx1, zS1, front, { ...wall, exterior: true });
  // The back wall opens onto platform A (a room, so not an outer wall).
  k.wall(0, bx0, zA1, bx1, zA1 + t, [k.window((bx0 + hx0) / 2 - bx0, 1.6, { broken: k.rand() < 0.3 }), k.door(gate - bx0, 'open', ARCH.door.wide)], wall);
  k.wall(0, bx0, zA1 + t, bx0 + t, zS1 - t, [k.window(bd / 2, 1.4)], { ...wall, exterior: true });
  k.wall(0, bx1 - t, zA1 + t, bx1, zS1 - t, [k.window(bd * 0.25, 1.0, { broken: k.rand() < 0.5 })], { ...wall, exterior: true });
  k.floor(0, 'tileFloor', [bx0 + t, zA1 + t, bx1 - t, zS1 - t]);
  k.part({ shape: 'gable', x0: bx0 - 0.45, x1: bx1 + 0.45, z0: zA1 - 0.6, z1: zS1 + 0.45, y0: k.eaves, y1: k.eaves + 2.4, mat: k.pick(['tile', 'metalRoof'] as const), tint: roofTint, axis: 'x' });
  // Partitions: the office (left), the hall, the shop in front and the WC behind on the right.
  const officeOpen = k.rand() < 0.7;
  k.partition(0, hx0, zA1 + t, hx0, zS1 - t, [k.window(bd * 0.62, 1.2, { sill: 0.9, head: 1.8, broken: true }), k.door(bd * 0.3, officeOpen ? 'open' : 'locked')]);
  k.partition(0, hx1, zA1 + t, hx1, zS1 - t, [k.door((zA1 + t + zm) / 2 - zA1 - t, 'open'), k.door((zm + zS1 - t) / 2 - zA1 - t, 'shutter', 1.6)]);
  k.partition(0, hx1, zm, bx1 - t, zm);
  const office = k.room(0, bx0 + t, zA1 + t, hx0 - P, zS1 - t, 'office', { locked: !officeOpen });
  const hall = k.room(0, hx0 + P, zA1 + t, hx1 - P, zS1 - t, 'lobby');
  const wc = k.room(0, hx1 + P, zA1 + t, bx1 - t, zm - P, 'toilet');
  k.room(0, hx1 + P, zm + P, bx1 - t, zS1 - t, 'sales', { locked: true });
  // Shelves seen through the shop window (drawn only).
  for (let x = hx1 + 1.2; x < bx1 - 1.2; x += 1.6) k.box(0, x, fy, zm + 1.0, x + 0.5, fy + 1.4, zS1 - 1.2, 'shelf', { solid: false });
  if (officeOpen) {
    f.row(office, 'x-', 1.6, 0.7, 0.75, 'wood', { kind: 'desk', table: 'office', max: 2, tint: 0.5 });
    f.row(office, 'z+', 1.0, 0.45, 1.8, 'steel', { kind: 'cabinet', table: 'office', max: 2, tint: 0.7 });
    f.row(office, 'z-', 1.2, 0.5, 1.1, 'steel', { kind: 'locker', table: 'office', max: 1, tint: 0.4 });
    f.ensure(office, 'desk', 'office');
  }
  // The hall: benches along the walls, the ticket machines by the gate, a poster wall.
  f.row(hall, 'x-', 2.0, 0.45, 0.45, 'wood', { tint: 0.4, max: 2, gap: 0.8 });
  f.row(hall, 'x+', 2.0, 0.45, 0.45, 'wood', { tint: 0.4, max: 1 });
  f.put(hall, [gate - 2.6, zA1 + t, gate - 1.6, zA1 + t + 0.6], 1.6, 'appliance', { tint: 0.2, search: { kind: 'counter', face: 'z+', table: 'lobby' } });
  f.ensure(hall, 'crate', 'lobby');
  if (f.chance(0.5)) f.stain(hall);
  f.row(wc, 'z-', 1.0, 0.5, 0.85, 'appliance', { kind: 'cabinet', table: 'toilet', max: 2, tint: 0.9 });
  f.ensure(wc, 'cabinet', 'toilet');

  // ---- On the platforms: canopies, benches, vending machines, the name boards, fences.
  canopy(k, Math.max(6, bx0 - 0.8), Math.min(w - 6, bx1 + 8), zA0 + 0.4, zA1, fy + 3.2, roofTint);
  canopy(k, Math.max(8, fx1 + L + 1), Math.min(w - 8, fx1 + L + 22), zB0, zB1 - 0.4, fy + 3.2, roofTint);
  for (const p of [platA, platB]) {
    const back = p === platA ? 'z+' : 'z-';
    for (const r of p) {
      f.row(r.id, back, 1.8, 0.45, 0.45, 'wood', { tint: 0.3, max: 2, gap: 6 });
      if (r === p[p.length - 1]) f.row(r.id, back, 0.9, 0.7, 1.85, 'appliance', { kind: 'fridge', table: 'grocery', max: 1, tint: f.rand() });
    }
    f.ensure(p[0]!.id, 'crate', 'platform');
  }
  nameBoard(k, bx1 + 4, zA1 - 0.5, 0.1);
  nameBoard(k, w * 0.6, zB0 + 0.5, 0.1);
  fence(k, 6, zA1 + 0.06, bx0, zA1 + 0.06, fy + 1.1);
  fence(k, bx1, zA1 + 0.06, w - 6, zA1 + 0.06, fy + 1.1);
  fence(k, 8, zB0 - 0.06, w - 8, zB0 - 0.06, fy + 1.1);
  fence(k, 0.5, 0.3, w - 0.5, 0.3, 1.8);

  // ---- Trains: one at platform A with its doors open; sometimes one at B.
  const lenA = w - 12 >= trainLength(3, 20) + 1 ? 3 : 2;
  const xA = 6.5 + (w - 13 - trainLength(lenA, 20)) * k.rand();
  train(k, f, xA, lenA, 20, zt1, { side: 'z+', doors: 3, tint: k.rand(), open: true });
  const atB = k.rand();
  if (atB < 0.7) {
    const xB = 8.5 + (w - 17 - trainLength(2, 20)) * k.rand();
    train(k, f, xB, 2, 20, zt2, { side: 'z-', doors: 3, tint: k.rand(), open: atB < 0.45 });
  }

  // ---- The forecourt: asphalt, a taxi, bicycles.
  pave(k, 0, zS1, w, d);
  parkedCar(k, bx0 + k.range(2, bw - 2), zS1 + 3.5, 'x');
  for (let i = 0; i < 6; i++) {
    const x = bx1 + 1.5 + i * 0.7;
    if (x < w - 1 && k.rand() < 0.8) k.box(-1, x, 0, zS1 + 0.5, x + 0.08, 1.0, zS1 + 2.1, 'steel', { layer: 'shell', tint: k.rand(), solid: false });
  }
}
