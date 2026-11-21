// 政令指定都市の駅 (07d-2e): the station complex that fills most of a city centre. Behind it four
// island platforms (eight tracks) and a freight track under a long bridge concourse. On the street,
// side by side: a department store (eight storeys; the ground and first floors open, the rest shut),
// the three-storey station building (gates on the first floor) and a eight-storey hotel (lobby,
// lounge, a guest floor open; its roof can be reached — the highest point of the site). In front of
// all three a pedestrian deck (ペデストリアンデッキ) on the first floor with doors into each and two
// wide stairs down to the plaza: the bus and taxi rotary, and the shuttered entrances of the
// underground mall (地下街).
//
//   z = d    plaza: rotary, buses, taxis, mall entrances [M], the deck's stairs [s]
//            ===================== deck (first floor) =========================
//            | department store |      | station building |      |  hotel  |
//   z = zTop ---------------------------------------------------------------------
//            islands and tracks (the bridge over them from the station building)

import type { Kit, Rect } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { car as parkedCar, guestRoom } from '../shop/common.ts';
import { canteen, ringRooms, twoPass, waiting, type Fit } from '../office/common.ts';
import { bus, fence, flightLength, P, paint, pave, shelter } from './common.ts';
import { gondolas, islands, islandsDepth, stationHouse, tower, type WingRoom } from './parts.ts';
import { passage } from './station_pref.ts';

export const TRANSPORT_STATION_SEIREI: BuildingDef = {
  id: 'transport.station_seirei',
  category: 'transport',
  variant: 'station_seirei',
  kind: 'office',
  size: { w: [240, 280], d: [150, 180] },
  storeys: 3,
  storeyHeight: 4.2,
  plinth: 0.5,
  roof: 'flat',
  roofRise: 25,
  lootable: true,
  // A city block of buildings on one site: three blocks, nine tracks of trains, the deck and the plaza.
  // Storeys above `storeys` (the towers) are counted with the roof's storey by triangleCount.
  limits: { shell: 8000, interior: 7000 },
  generate(rng, params) {
    return twoPass(TRANSPORT_STATION_SEIREI, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const tint = k.rand();
  const roofTint = k.rand();
  const zTop = islandsDepth(4, 9);
  const hd = 26 + (d - 150) * 0.2;
  const zf = zTop + hd;
  const dD = 8;
  // Blocks along the street.
  const dw = 52 + (w - 240) * 0.3;
  const hw = 78;
  const tw = 34 + (w - 240) * 0.2;
  const ax0 = 6 + (w - 240) * 0.1;
  const ax1 = ax0 + dw;
  const hx0 = ax1 + 6;
  const hx1 = hx0 + hw;
  const tx0 = hx1 + 6;
  const tx1 = tx0 + tw;
  const hm = (hx0 + hx1) / 2;

  // ---- The station building and the islands.
  const wings = (level: number, side: 'left' | 'right'): WingRoom[] => {
    if (level === 0) return side === 'left'
      ? [{ use: 'storage', state: 'locked' }, { use: 'sales', state: 'open', street: 'shutter' }]
      : [{ use: 'toilet' }, { use: 'canteen', state: 'shutter', street: 'shutter' }];
    if (level === 1) return side === 'left'
      ? [{ use: 'office', state: k.rand() < 0.6 ? 'open' : 'locked' }, { use: 'sales' }]
      : [{ use: 'toilet' }, { use: 'canteen', state: k.rand() < 0.5 ? 'open' : 'shutter' }];
    return side === 'left'
      ? [{ use: 'kitchen' }, { use: 'bar', state: 'shutter' }]
      : [{ use: 'office', state: 'locked' }, { use: 'office', state: k.rand() < 0.5 ? 'open' : 'locked' }];
  };
  const house = stationHouse(k, f, { rect: [hx0, zTop, hx1, zf], centre: 26, wings, mat: 'concrete', tint, doors: 4, gates: true, deck: [hm - 6, hm + 6] });
  const L = flightLength(k);
  const cx0 = house.gate[0] - 2;
  const cx1 = Math.max(house.gate[1] + 2, cx0 + L + 5);
  islands(k, f, { zTop, x0: 5, x1: w - 5, n: 4, width: 9, bridge: [cx0, cx1], tint, roofTint, cars: 6 });

  // ---- The department store: ground and first floors open (sales floors round the core).
  const am = (ax0 + ax1) / 2;
  tower(k, f, {
    rect: [ax0, zTop, ax1, zf], levels: 8, stairsTo: 2, open: (l) => l < 2, mat: 'mortar', tint: k.rand(), sheet: 'concrete',
    entrance: [am - 10, am + 10], deck: [am - 8, am + 8],
    plate: (l, inner, core) => {
      const ring = ringRooms(k, l, inner, core, 'sales');
      for (const r of ring.all) {
        gondolas(f, r, l === 0 ? ['grocery', 'sales'] : ['sales', 'bedroom'], 5);
        f.ensure(r, 'shelf', 'sales');
      }
      if (ring.front !== undefined && f.chance(0.5)) f.stain(ring.front);
    },
  });
  k.box(-1, ax0 + 3, k.levelY(8) - 4, zf, ax1 - 3, k.levelY(8) - 0.5, zf + 0.15, 'sign', { layer: 'shell', tint: k.rand(), solid: false });

  // ---- The hotel: lobby, the lounge on the deck, two guest floors, the roof.
  const guests = [3 + Math.floor(k.rand() * 4)];
  const tm = (tx0 + tx1) / 2;
  tower(k, f, {
    rect: [tx0, zTop, tx1, zf], levels: 8, stairsTo: 8, open: (l) => l < 2 || guests.includes(l), mat: 'concrete', tint: k.rand(), sheet: 'glass',
    entrance: [tm], deck: [tm],
    plate: (l, inner, core) => {
      if (l < 2) {
        const ring = ringRooms(k, l, inner, core, 'lobby');
        if (ring.front !== undefined) {
          if (l === 0) f.row(ring.front, 'x+', 3.0, 0.7, 1.05, 'counter', { kind: 'counter', table: 'lobby', max: 1, tint: 0.3 });
          waiting(f, ring.front);
        }
        if (ring.right !== undefined) {
          if (l === 0) canteen(f, ring.right, { tint: 0.6, max: 6 });
          else waiting(f, ring.right);
        }
        for (const r of ring.all) f.ensure(r, 'crate', l === 0 ? 'lobby' : 'canteen');
        return;
      }
      guestFloor(k, f, l, inner, core);
    },
  });
  k.box(-1, tx1 - 0.15, k.levelY(3), (zTop + zf) / 2 - 2, tx1 + 0.4, k.levelY(8) - 1, (zTop + zf) / 2 + 2, 'sign', { layer: 'shell', tint: k.rand(), solid: false });

  // ---- The deck: one room per block front, joined; railings; columns; two stairs down to the plaza.
  const y1 = k.levelY(1);
  const fy = k.levelY(0);
  const dx0 = ax0 + 2;
  const dx1 = tx1 - 2;
  k.box(-1, dx0, y1 - 0.5, zf, dx1, y1, zf + dD, 'tileFloor', { layer: 'shell', tint: 0.4 });
  const cuts = [dx0, (ax1 + hx0) / 2, (hx1 + tx0) / 2, dx1];
  const deck: number[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    deck.push(k.room(1, cuts[i]!, zf, cuts[i + 1]!, zf + dD, 'roof'));
    if (i > 0) k.join(deck[i - 1]!, deck[i]!);
  }
  const stairsAt = [(ax1 + hx0) / 2 - 8, (hx1 + tx0) / 2 + 6];
  const sw = 2.4;
  const sl = flightLength(k);
  // Railing along the front edge (gaps at the stairs) and the ends.
  let u = dx0;
  for (const sx of [...stairsAt, dx1 + sw]) {
    if (sx - sw / 2 - u > 0.1) k.box(-1, u, y1, zf + dD - 0.08, sx - sw / 2, y1 + 1.1, zf + dD, 'glass', { layer: 'shell' });
    u = sx + sw / 2;
  }
  for (const x of [dx0, dx1 - 0.08]) k.box(-1, x, y1, zf, x + 0.08, y1 + 1.1, zf + dD, 'glass', { layer: 'shell' });
  for (let x = dx0 + 6; x < dx1 - 3; x += 18) {
    if (stairsAt.some((sx) => Math.abs(sx - x) < 3)) continue;
    k.box(-1, x - 0.35, 0, zf + dD - 1.0, x + 0.35, y1 - 0.5, zf + dD - 0.3, 'concrete', { layer: 'shell', tint: 0.5 });
  }
  for (const sx of stairsAt) {
    const zs = zf + dD + sl;
    k.stairs({ level: 0, start: [sx, zs], dir: 'z-', width: sw, kind: 'straight', rails: [], mat: 'concrete', tint: 0.5, to: 1 });
    for (const s of [-1, 1]) k.box(-1, sx + s * sw / 2, fy, zf + dD, sx + s * (sw / 2 + 0.1), y1 + 1.1, zs, 'concrete', { layer: 'shell', tint: 0.5 });
    // The landing at the foot: a step up from the plaza.
    const l1 = zs + 2.6;
    k.box(-1, sx - 2.2, -0.3, zs, sx + 2.2, fy, l1, 'concrete', { layer: 'shell', tint: 0.5 });
    k.wall(0, sx - 2.2, l1 - 0.12, sx + 2.2, l1, [k.door(2.2, 'open', 2.6)], { mat: 'steel', tint: 0.5, y1: fy + 1.0, exterior: true, layer: 'shell' });
    fence(k, sx - 2.14, zs, sx - 2.14, l1 - 0.12, fy + 1.0);
    fence(k, sx + 2.14, zs, sx + 2.14, l1 - 0.12, fy + 1.0);
    k.room(0, sx - 2.08, zs, sx + 2.08, l1 - 0.12, 'hall');
  }
  for (const r of deck) if (f.chance(0.3)) f.stain(r, 'debris', 2);
  f.ensure(deck[1]!, 'crate', 'lobby');

  // ---- The plaza: the rotary, buses and taxis, the underground mall's entrances.
  const zp = zf + dD + sl + 3;
  pave(k, 0, zf, w, d);
  const zr = (zp + d) / 2;
  const rr = Math.min(9, (d - zp) / 2 - 7);
  k.box(-1, hm - rr * 2, 0, zr - rr, hm + rr * 2, 0.2, zr + rr, 'concrete', { layer: 'shell', tint: 0.4 });
  k.box(-1, hm - rr * 2 + 0.5, 0.2, zr - rr + 0.5, hm + rr * 2 - 0.5, 1.2, zr + rr - 0.5, 'plant', { layer: 'shell', solid: false });
  for (let i = 0; i < 4; i++) if (k.rand() < 0.7) bus(k, hm - rr * 2 - 8 + i * 13, zr - rr - 4.5, 'x', k.rand());
  for (let i = 0; i < 3; i++) shelter(k, hm - rr * 2 - 6 + i * 13, zr - rr - 2.6, hm - rr * 2 + i * 13, zr - rr - 1.2, 'z+', roofTint);
  for (let i = 0; i < 6; i++) if (k.rand() < 0.6) parkedCar(k, hm + rr * 2 + 6 + i * 5, zr + 2, 'z', 0.95);
  for (let x = hm + rr * 2 + 3.5; x < hm + rr * 2 + 33; x += 5) paint(k, x, zr - 1, x + 0.12, zr + 5);
  passage(k, ax0 + dw * 0.3, d - 7, 'z-', tint);
  passage(k, tx1 - 8, zp + 4, 'z+', tint);
}

/** A hotel guest floor: a corridor along x through the middle, rooms either side, a hall in front of the core. */
function guestFloor(k: Kit, f: Fit, l: number, inner: Rect, core: Rect): void {
  const zc = (core[3] + inner[3]) / 2 - 1.5;
  const c0 = zc - 0.9;
  const c1 = zc + 0.9;
  const xa = core[2];
  // The hall in front of the core, the corridor in segments.
  const hall = k.room(l, inner[0], core[3], xa - P, inner[3], 'hall');
  k.partition(l, xa, core[3], xa, c0);
  k.partition(l, xa, c1, xa, inner[3]);
  const n = Math.max(2, Math.floor((inner[2] - xa) / 4.2));
  const step = (inner[2] - xa) / n;
  const segs: number[] = [];
  for (let s = 0; s < 3; s++) {
    const a = xa + Math.round((n * s) / 3) * step;
    const b = xa + Math.round((n * (s + 1)) / 3) * step;
    segs.push(k.room(l, s === 0 ? xa + P : a, c0 + P, b, c1 - P, 'hall'));
    if (s === 0) k.join(hall, segs[0]!);
    else k.join(segs[s - 1]!, segs[s]!);
  }
  // Rooms behind and in front of the corridor (the back row starts past the core's side).
  for (const side of ['z-', 'z+'] as const) {
    const [za, zb] = side === 'z-' ? [inner[1], c0 - P] : [c1 + P, inner[3]];
    const holes = [];
    for (let i = 0; i < n; i++) {
      const a = xa + i * step;
      const b = a + step;
      if (i > 0) k.partition(l, a, za, a, zb);
      const doorAt = a + 0.9;
      holes.push(k.door(doorAt - xa, 'open'));
      const shut = k.rand() < 0.35;
      holes[holes.length - 1]!.state = shut ? 'locked' : 'open';
      guestRoom(k, l, [a + (i > 0 ? P : 0.12), za, b - (i < n - 1 ? P : 0), zb], side === 'z-' ? 'z+' : 'z-', doorAt, { locked: shut, twin: k.rand() < 0.5, tint: k.rand() });
    }
    k.partition(l, xa, side === 'z-' ? c0 : c1, inner[2], side === 'z-' ? c0 : c1, holes);
  }
  f.ensure(hall, 'crate', 'hall');
  if (f.chance(0.6)) f.stain(segs[1]!);
}
