// The big pieces of the city stations (07d-2e), shared by station_city, station_pref and station_seirei:
//
//   stationHouse   a station building of k.storeys storeys on the street: a stair core (switchback stair,
//                  a dead lift) in the middle of its back wall, the open centre round it (the entrance hall,
//                  the concourses), a wing of rooms on either side entered from the centre, the ticket
//                  gates (改札) in the back wall of the first floor leading onto the bridge concourse,
//                  a curtain-walled front, a flat roof one can climb onto
//   islands        island platforms behind the house, two tracks each (and a through track), the bridge
//                  concourse (橋上) over them on the first floor with a stair down onto each island,
//                  trains standing at some of them (open, closed), wires and masts
//
//   z = z1  street side      +--wing L--+=====centre=====+--wing R--+
//                            |          |  [core]  GGGG  |          |    G: the gates (first floor)
//   z = z0  tracks side      +----------+-------##########----------+
//                            ======== island 1 ===[st]=====          #: the bridge (first floor)
//                            ======== island 2 ===[st]=====

import { ARCH } from '../../../../data/architecture.ts';
import { subtractRects, type Hole, type Kit, type Rect } from '../../kit.ts';
import type { LootTableId, MaterialId, RoomUse } from '../../types.ts';
import {
  canteen, coreAt, coreLevel, coreRect, coreRoof, curtain, kitchen, officeDesks, ringRooms, roofPlant, storeRoom, type Fit,
} from '../office/common.ts';
import { canopy, CAR_HALF, EDGE, flight, flightLength, mast, nameBoard, P, platform, splitRooms, SPACING, track, train, wire, type PlatformRoom } from './common.ts';

export interface WingRoom {
  use: RoomUse;
  /** The door from the centre. */
  state?: 'open' | 'locked' | 'shutter';
  /** Ground floor, front room: its own door to the street. */
  street?: 'open' | 'locked' | 'shutter';
}

export interface HouseSpec {
  /** Outer faces: x0, z0 (the back, towards the tracks), x1, z1 (the street). */
  rect: Rect;
  /** Width of the centre between the wings (partition lines). */
  centre: number;
  /** Rooms of each wing on each storey, from the back to the front. */
  wings: (level: number, side: 'left' | 'right') => WingRoom[];
  mat: MaterialId;
  tint: number;
  /** Entrance doors in the front of the centre. */
  doors: number;
  /** Ticket gates in the first floor's back wall (true: as wide as the centre's right side allows). */
  gates: boolean;
  /** Doors (x) in the first floor's front onto a pedestrian deck (a room in front of the house). */
  deck?: number[];
  /** Doors (x) in the ground floor's back wall to the outside (an airport's apron). */
  back0?: number[];
  /** Doors (x) in the first floor's back wall onto rooms behind it (boarding bridges). */
  back1?: number[];
}

export interface HouseResult {
  /** The centre's rooms per storey (ring round the core). */
  centre: number[][];
  /** Where the gates are along x (the bridge must cover it). */
  gate: [number, number];
  /** Roof rooms. */
  roof: number[];
  /** The left / right partition lines of the centre. */
  xa: number;
  xb: number;
}

const T = ARCH.wall.concrete;

/** A station building (docs on top of the file). */
export function stationHouse(k: Kit, f: Fit, s: HouseSpec): HouseResult {
  const [x0, z0, x1, z1] = s.rect;
  const L = k.storeys;
  const cm = (x0 + x1) / 2;
  const xa = cm - s.centre / 2;
  const xb = cm + s.centre / 2;
  // The core sits towards the left of the centre's back; the gates are to its right.
  const c = coreAt(k, xa + P + 2.4, z0 + T + P, { shafts: 1, hall: 2.2 });
  const hole = coreRect(c);
  const gate: [number, number] = [c.x1 + P + 0.9, xb - P - 0.9];
  const top = k.eaves + ARCH.rail.parapet;
  const inner: Rect = [x0 + T, z0 + T, x1 - T, z1 - T];

  // ---- Walls outside: the ground storey with its openings, a curtain over the front above, plain sides and back.
  const front: Hole[] = [];
  const doorsAt = k.evenly(xa + 1.5, xb - 1.5, s.doors);
  for (const x of doorsAt) front.push(k.door(x - x0, 'open', ARCH.door.wide));
  for (const side of ['left', 'right'] as const) {
    const rooms = s.wings(0, side);
    const [wx0, wx1] = side === 'left' ? [x0 + T, xa - P] : [xb + P, x1 - T];
    const last = rooms[rooms.length - 1]!;
    const m = (wx0 + wx1) / 2;
    if (last.street) front.push(k.door(m - (wx1 - wx0) * 0.25 - x0, last.street, ARCH.door.wide));
    const wa = last.street ? m + 0.4 : wx0 + 1.0;
    if (wx1 - 1.0 - wa > 1.2) front.push(k.window((wa + wx1 - 1.0) / 2 - x0, wx1 - 1.0 - wa, { sill: 0.4, head: 2.8, broken: k.rand() < 0.3 }));
  }
  const y1 = k.levelY(1);
  const wo = { mat: s.mat, tint: s.tint, y1, exterior: true, layer: 'shell' as const };
  k.wall(0, x0, z1 - T, x1, z1, front, wo);
  k.wall(0, x0, z0, x1, z0 + T, (s.back0 ?? []).map((x) => k.door(x - x0, 'open', ARCH.door.wide)), wo);
  k.wall(0, x0, z0 + T, x0 + T, z1 - T, [k.window((z1 - z0) / 2 - T, 1.6, { broken: k.rand() < 0.4 })], wo);
  k.wall(0, x1 - T, z0 + T, x1, z1 - T, [k.window((z1 - z0) / 2 - T, 1.6, { broken: k.rand() < 0.4 })], wo);
  if (L > 1) {
    const piers = [x0 + 0.3, xa, xb, x1 - 0.3];
    const broken: [number, number, number][] = [];
    for (let l = 1; l < L; l++) if (k.rand() < 0.5) broken.push([l, xa, xb]);
    if (s.deck) deckFront(k, 1, x0, x1, z1, s.deck, s.mat, s.tint);
    if (!s.deck || L > 2) curtain(k, { side: 'front', from: s.deck ? 2 : 1, to: L, y1: top, t: T, plane: [z1 - T, z1], u0: x0, u1: x1, mat: s.mat, tint: s.tint, sill: 0.9, drop: 0.5, piers, pier: 0.6, broken });
    for (const xs of [[x0, x0 + T], [x1 - T, x1]]) k.box(-1, xs[0]!, y1, z0 + T, xs[1]!, top, z1 - T, s.mat, { layer: 'shell', tint: s.tint });
    // The back: open above the gates on the first floor (the bridge comes in there).
    const y2 = k.levelY(2);
    if (s.gates) {
      k.box(-1, x0, y1, z0, gate[0] - 0.5, Math.min(y2, top), z0 + T, s.mat, { layer: 'shell', tint: s.tint });
      k.box(-1, gate[1] + 0.5, y1, z0, x1, Math.min(y2, top), z0 + T, s.mat, { layer: 'shell', tint: s.tint });
      k.box(-1, gate[0] - 0.5, y1 + 3.2, z0, gate[1] + 0.5, Math.min(y2, top), z0 + T, 'sign', { layer: 'shell', tint: 0.1 });
      if (L > 2) k.box(-1, x0, y2, z0, x1, top, z0 + T, s.mat, { layer: 'shell', tint: s.tint });
    } else if (s.back1) {
      const holes: Hole[] = [];
      let u = x0 + 1.0;
      for (const x of [...s.back1].sort((a, b) => a - b)) {
        if (x - 2.0 - u > 2) holes.push(k.window((u + x - 2.0) / 2 - x0, x - 2.0 - u, { sill: 0.9, head: 3.2, broken: k.rand() < 0.2 }));
        holes.push(k.door(x - x0, 'open', ARCH.door.wide));
        u = x + 2.0;
      }
      if (x1 - 1.0 - u > 2) holes.push(k.window((u + x1 - 1.0) / 2 - x0, x1 - 1.0 - u, { sill: 0.9, head: 3.2 }));
      k.wall(1, x0, z0, x1, z0 + T, holes, { mat: s.mat, tint: s.tint, y0: y1, y1: y2, layer: 'shell' });
      k.box(-1, x0, y2, z0, x1, top, z0 + T, s.mat, { layer: 'shell', tint: s.tint });
    } else k.box(-1, x0, y1, z0, x1, top, z0 + T, s.mat, { layer: 'shell', tint: s.tint });
  } else {
    k.box(-1, x0, y1, z0, x1, top, z0 + T, s.mat, { layer: 'shell', tint: s.tint });
  }

  // ---- Storeys.
  const res: HouseResult = { centre: [], gate, roof: [], xa, xb };
  for (let l = 0; l < L; l++) {
    k.floor(l, l === 0 ? 'tileFloor' : 'vinyl', inner);
    const ring = ringRooms(k, l, [xa + P, z0 + T, xb - P, z1 - T], hole, l === 0 ? 'lobby' : 'hall');
    res.centre.push(ring.all);
    const core = coreLevel(k, l, c, { front: [{ x: (c.hall[0] + c.hall[2]) / 2, state: 'open', width: 1.6 }], tint: s.tint });
    if (l === 0) f.row(core.hall, 'x+', 0.5, 0.5, 1.3, 'steel', { tint: 0.4, max: 1 });
    // The centre: benches and a poster stand, a ticket machine row by the gates.
    for (const r of ring.all) {
      if (f.chance(0.3)) f.stain(r, f.chance(0.5) ? 'blood' : 'paper');
    }
    if (ring.front !== undefined) {
      f.row(ring.front, 'z+', 2.2, 0.5, 0.45, 'wood', { tint: 0.4, max: 3, gap: 3 });
      f.ensure(ring.front, 'crate', 'lobby');
    }
    if (l === 1 && s.gates && ring.right !== undefined) {
      f.row(ring.right, 'x+', 0.9, 0.6, 1.6, 'appliance', { kind: 'counter', table: 'lobby', max: 3, tint: 0.2 });
      // The gate line: low machines with gaps (one or two closed), onto the bridge.
      const n = Math.max(2, Math.floor((gate[1] - gate[0]) / 1.5));
      const holes = k.evenly(0, gate[1] - gate[0], n).map((a) => k.door(a, k.rand() < 0.15 ? 'locked' : 'open', 0.9));
      if (!holes.some((h) => h.state === 'open')) holes[0]!.state = 'open';
      k.wall(1, gate[0], z0, gate[1], z0 + T, holes.map((h) => ({ ...h, leaf: 'appliance' as const })), { mat: 'appliance', tint: 0.85, y0: y1, y1: y1 + 1.05, layer: 'shell' });
    }
    // Wings.
    for (const side of ['left', 'right'] as const) {
      const rooms = s.wings(l, side);
      const zs = splitZ(rooms.length, z0 + T, z1 - T);
      const [wx0, wx1] = side === 'left' ? [x0 + T, xa - P] : [xb + P, x1 - T];
      const xp = side === 'left' ? xa : xb;
      const holes: Hole[] = [];
      rooms.forEach((rm, i) => {
        const [za, zb] = zs[i]!;
        if (i > 0) k.partition(l, wx0, za, wx1, za);
        const r: Rect = [wx0, za + (i > 0 ? P : 0), wx1, zb - (i < rooms.length - 1 ? P : 0)];
        const st = rm.state ?? 'open';
        const closed = st !== 'open' && !(l === 0 && i === rooms.length - 1 && rm.street === 'open');
        holes.push(k.door((za + zb) / 2 - (z0 + T), st, st === 'shutter' ? 2.4 : ARCH.door.width));
        const id = k.room(l, r[0], r[1], r[2], r[3], rm.use, { locked: closed });
        if (closed) {
          if (rm.use === 'sales') for (let x = r[0] + 1.2; x < r[2] - 1.2; x += 1.8) k.box(l, x, k.levelY(l), r[1] + 1.4, x + 0.5, k.levelY(l) + 1.5, r[3] - 1.4, 'shelf', { solid: false });
          return;
        }
        furnish(f, id, rm.use);
      });
      k.partition(l, xp, z0 + T, xp, z1 - T, holes);
    }
  }

  // ---- Roof: slab, parapet, the core's stair house, the roof rooms, plant and a sign.
  k.floor(L, 'concrete', inner);
  const e = k.eaves;
  for (const q of [[x0, z0, x1, z0 + T], [x0, z1 - T, x1, z1], [x0, z0 + T, x0 + T, z1 - T], [x1 - T, z0 + T, x1, z1 - T]] as const) k.box(-1, q[0], e, q[1], q[2], top, q[3], s.mat, { layer: 'shell', tint: s.tint });
  coreRoof(k, c, { tint: s.tint });
  const roof = ringRooms(k, L, inner, [c.x0 - 0.1, c.z0 - 0.1 - T, c.x1 + 0.1, c.z1 + 0.1], 'roof');
  res.roof = roof.all;
  roofPlant(f, roof.all, { units: 4 });
  for (const r of roof.all) f.ensure(r, 'crate', 'roof');
  k.box(-1, xa + 1, e + 1.2, z1 - 0.2, xb - 1, e + 3.2, z1 - 0.05, 'sign', { layer: 'shell', tint: k.rand(), solid: false });
  for (const x of [xa + 1.2, xb - 1.4]) k.box(-1, x, e, z1 - 0.35, x + 0.2, e + 3.2, z1 - 0.2, 'steel', { layer: 'shell' });
  return res;
}

/** The front wall of storey `level` opening onto a deck: doors at `doors` (x), glass between them. */
export function deckFront(k: Kit, level: number, x0: number, x1: number, z1: number, doors: number[], mat: MaterialId, tint: number, exterior = false): void {
  const holes: Hole[] = [];
  const xs = [...doors].sort((a, b) => a - b);
  let u = x0 + 1.0;
  for (const x of [...xs, x1 + 0.5]) {
    if (x - 1.6 - u > 1.5) holes.push(k.window((u + x - 1.6) / 2 - x0, x - 1.6 - u, { sill: 0.9, head: 2.8, broken: k.rand() < 0.2 }));
    if (x < x1) holes.push(k.door(x - x0, 'open', ARCH.door.wide));
    u = x + 1.6;
  }
  k.wall(level, x0, z1 - T, x1, z1, holes, { mat, tint, y0: level === 0 ? undefined : k.levelY(level), y1: k.levelY(level + 1), layer: 'shell', exterior });
}

/** n equal bands from a to b. */
function splitZ(n: number, a: number, b: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => [a + ((b - a) * i) / n, a + ((b - a) * (i + 1)) / n] as [number, number]);
}

/** A light sales floor: a few gondolas (one try per cell), a register by the wall. */
export function gondolas(f: Fit, id: number, tables: LootTableId[], max: number): void {
  if (!f.live) return;
  const tint = f.rand();
  let i = 0;
  f.grid(id, 2.6, 0.9, 1.4, 1.4, (r) => {
    const ok = f.put(id, r, 1.5, 'shelf', { tint, search: i % 2 === 0 ? { kind: 'shelf', face: 'z+', table: tables[(i / 2) % tables.length]! } : undefined });
    if (ok) i++;
    return ok;
  }, undefined, max);
  f.row(id, 'x-', 2.0, 0.6, 1.0, 'counter', { kind: 'counter', table: 'sales', max: 1, tint });
}

/** Furniture by room use. */
export function furnish(f: Fit, id: number, use: RoomUse): void {
  switch (use) {
    case 'sales':
      gondolas(f, id, ['sales', 'grocery'], 8);
      break;
    case 'canteen':
      canteen(f, id, { tint: f.rand(), max: 6 });
      break;
    case 'kitchen':
      kitchen(f, id);
      break;
    case 'office':
      officeDesks(f, id, { tint: 0.3 });
      break;
    case 'storage':
    case 'backroom':
      storeRoom(f, id);
      break;
    case 'toilet':
      f.row(id, 'z-', 1.0, 0.5, 0.85, 'appliance', { kind: 'cabinet', table: 'toilet', max: 2, tint: 0.9 });
      break;
    case 'clinic':
      f.row(id, 'z-', 1.2, 0.45, 1.8, 'steel', { kind: 'cabinet', table: 'pharmacy', max: 2, tint: 0.9 });
      break;
    default:
      f.row(id, 'z-', 1.4, 0.5, 1.2, 'shelf', { kind: 'shelf', table: use, max: 2 });
  }
  f.ensure(id, 'crate', use === 'sales' ? 'sales' : use);
  if (f.chance(0.25)) f.stain(id);
}

// ---------------------------------------------------------------------------------------------
// Island platforms and the bridge concourse
// ---------------------------------------------------------------------------------------------

export interface IslandSpec {
  /** The house's back face: the bridge's front end. */
  zTop: number;
  /** The platforms' extent along x. */
  x0: number;
  x1: number;
  /** Islands and their width. */
  n: number;
  width: number;
  /** The bridge's sides (x). */
  bridge: [number, number];
  /** One more track behind the last island (freight). */
  through?: boolean;
  tint: number;
  roofTint: number;
  /** Cars of a train at most. */
  cars: number;
}

export interface IslandResult {
  /** Track centres (z), front to back. */
  tracks: number[];
  islands: PlatformRoom[][];
  bridge: PlatformRoom[];
  /** The back end of the bridge and of the tracks (z). */
  back: number;
}

/** Space (z) the islands take behind zTop. */
export function islandsDepth(n: number, width: number, through = false): number {
  return 3.6 + n * (2 * EDGE + width) + (n - 1) * SPACING + (through ? SPACING : 0) + 3;
}

/** The islands, their tracks and trains, and the bridge concourse on the first floor (docs on top). */
export function islands(k: Kit, f: Fit, s: IslandSpec): IslandResult {
  const fy = k.levelY(0);
  const y1 = k.levelY(1);
  const L = flightLength(k);
  const [cx0, cx1] = s.bridge;
  const xs = cx0 + 2.0;
  const tracks: number[] = [];
  const centres: number[] = [];
  let ta = s.zTop - 3.6;
  for (let i = 0; i < s.n; i++) {
    const tb = ta - 2 * EDGE - s.width;
    tracks.push(ta, tb);
    centres.push((ta + tb) / 2);
    ta = tb - SPACING;
  }
  if (s.through) tracks.push(ta);
  // Tracks, wires, masts (in the gaps between the islands' tracks and behind the last).
  for (const z of tracks) {
    track(k, z, 0, k.w);
    wire(k, z, 0, k.w);
  }
  const gaps: number[] = [s.zTop - 1.0];
  for (let i = 1; i < tracks.length; i++) if (tracks[i - 1]! - tracks[i]! < SPACING + 0.01) gaps.push((tracks[i - 1]! + tracks[i]!) / 2);
  gaps.push(tracks[tracks.length - 1]! - 2.2);
  for (const gz of gaps) {
    for (let x = 6; x < k.w - 3; x += 50) {
      if (x > cx0 - 1.5 && x < cx1 + 1.5) continue;
      mast(k, x, gz, gz - 1.2, gz + 1.2);
    }
    // The bridge's columns.
    if (gz < s.zTop - 2 && gz > centres[centres.length - 1]! - 2) for (const x of [cx0 + 0.3, cx1 - 0.3]) k.box(-1, x - 0.25, 0, gz - 0.25, x + 0.25, y1 - 0.2, gz + 0.25, 'concrete', { layer: 'shell', tint: s.tint });
  }

  // Islands: each with a stair up to the bridge (and a column under its head).
  const res: IslandResult = { tracks, islands: [], bridge: [], back: tracks[tracks.length - 1]! - CAR_HALF - 1 };
  const holes: Rect[] = [];
  const cut: Rect[] = [];
  centres.forEach((zc, i) => {
    const iz1 = tracks[2 * i]! - EDGE;
    const iz0 = tracks[2 * i + 1]! + EDGE;
    const obs: Rect = [xs - 0.8, zc - 0.75, xs + L, zc + 0.75];
    const rooms = platform(k, s.x0, s.x1, iz0, iz1, { edges: ['z-', 'z+'], obstacles: [obs], tint: 0.25 });
    res.islands.push(rooms);
    flight(k, 0, 1, xs + L, zc, 'x-', { walls: true, wallTop: y1 + 1.0, roof: false, rails: ['end'], tint: s.tint });
    k.box(-1, xs - 0.7, 0, zc - 0.25, xs - 0.2, y1 - 0.2, zc + 0.25, 'concrete', { layer: 'shell', tint: s.tint });
    holes.push([xs - 0.05, zc - 0.75, xs + L + 0.12, zc + 0.75]);
    cut.push([xs, zc - 0.6, xs + L, zc + 0.6]);
    canopy(k, s.x0 + 3, xs - 1.2, iz0 + 1.2, iz1 - 1.2, fy + 3.3, s.roofTint);
    canopy(k, xs + L + 1.5, Math.min(s.x1 - 3, xs + L + 60), iz0 + 1.2, iz1 - 1.2, fy + 3.3, s.roofTint);
    nameBoard(k, xs + L + 4, zc, 0.1 + 0.25 * (i % 3));
    // Benches and a vending machine at the ends.
    f.row(rooms[0]!.id, 'x-', 0.9, 0.7, 1.85, 'appliance', { kind: 'fridge', table: 'grocery', max: 1, tint: f.rand() });
    f.row(rooms[rooms.length - 1]!.id, 'x+', 1.8, 0.45, 0.45, 'wood', { tint: 0.3, max: 2 });
    f.ensure(rooms[rooms.length - 1]!.id, 'crate', 'platform');
  });

  // The bridge: floor, rooms round the stair holes (along z), glazed sides, the back wall, a roof.
  const bz0 = centres[centres.length - 1]! - 0.75 - 1.6;
  const br: Rect = [cx0, bz0, cx1, s.zTop];
  // The floor as a shell slab (seen from afar), cut round the stairs.
  for (const q of subtractRects(br, cut)) k.box(-1, q[0], y1 - 0.5, q[1], q[2], y1, q[3], 'tileFloor', { layer: 'shell', tint: 0.5 });
  res.bridge = splitRooms(k, 1, br, holes, 'hall', 'z');
  res.back = Math.min(res.back, bz0);
  const side = (xa: number, xb: number): void => {
    k.box(-1, xa, y1 - 0.5, bz0, xb, y1 + 1.0, s.zTop, 'concrete', { layer: 'shell', tint: s.tint });
    k.box(-1, (xa + xb) / 2 - 0.015, y1 + 1.0, bz0, (xa + xb) / 2 + 0.015, y1 + 2.8, s.zTop, 'glass', { layer: 'shell' });
    k.box(-1, xa, y1 + 2.8, bz0, xb, y1 + 3.2, s.zTop, 'concrete', { layer: 'shell', tint: s.tint });
  };
  side(cx0 - 0.15, cx0);
  side(cx1, cx1 + 0.15);
  k.box(-1, cx0 - 0.15, y1 - 0.5, bz0 - 0.15, cx1 + 0.15, y1 + 3.2, bz0, 'concrete', { layer: 'shell', tint: s.tint });
  k.box(-1, cx0 - 0.4, y1 + 3.2, bz0 - 0.4, cx1 + 0.4, y1 + 3.4, s.zTop, 'metalRoof', { layer: 'shell', tint: s.roofTint });
  for (const r of res.bridge) if (f.chance(0.25)) f.stain(r.id, 'debris', 2);
  f.ensure(res.bridge[0]!.id, 'crate', 'lobby');

  // Trains: open ones at some platforms, closed at others, none at a few; at least one open.
  const room = s.x1 - s.x0 - 1;
  const most = Math.max(2, Math.min(s.cars, Math.floor((room + 0.6) / 20.6)));
  let opened = 0;
  tracks.forEach((z, i) => {
    const island = i < 2 * s.n;
    const r = k.rand();
    const forceOpen = island && i === 2 * s.n - 1 && opened === 0;
    if (!forceOpen && r < 0.25) return;
    const n = Math.max(2, most - Math.floor(k.rand() * 2));
    const len = n * 20 + (n - 1) * 0.6;
    const xt = s.x0 + 0.5 + (room - len) * k.rand();
    const open = island && (forceOpen || (r > 0.55 && opened < 2));
    if (open) opened++;
    // Two cars of an open train stand open (the others are shut).
    const first = Math.floor(k.rand() * (n - 1));
    train(k, f, xt, n, 20, z, { side: i % 2 === 0 ? 'z-' : 'z+', doors: 3, tint: k.rand(), open: open ? (c) => c === first || c === first + 1 : false });
  });
  return res;
}

// ---------------------------------------------------------------------------------------------
// Towers (department store, hotel)
// ---------------------------------------------------------------------------------------------

export interface TowerSpec {
  /** Outer faces; the front (street / deck) is z1. */
  rect: Rect;
  /** Storeys (0..levels-1), the roof at `levels` (may rise past k.storeys). */
  levels: number;
  /** The stair climbs up to this level (levels: onto the roof). */
  stairsTo: number;
  open: (level: number) => boolean;
  mat: MaterialId;
  tint: number;
  /** Glass or panels on the sides and the back. */
  sheet: MaterialId;
  /** Ground-floor entrance doors (x). */
  entrance: number[];
  /** First-floor doors onto the deck (x). */
  deck?: number[];
  /** Make an open storey's rooms (round the core rectangle, its door in the core's front wall at the core's middle) and fill them. */
  plate: (level: number, inner: Rect, core: Rect) => void;
}

/**
 * A tower block with a stair core at its back-left: a switchback stair from storey to storey up to
 * `stairsTo`, the stair hall (a room) in front of it on each storey it reaches, its door onto the
 * floor open on the open storeys and locked on the others (where no other room is made and no floor
 * is laid but the core's). Curtain walls; the ground front with the entrances; the roof (a stair
 * house and roof rooms when the stair gets there).
 */
export function tower(k: Kit, f: Fit, s: TowerSpec): { halls: number[]; roof: number[] } {
  const [x0, z0, x1, z1] = s.rect;
  const inner: Rect = [x0 + T, z0 + T, x1 - T, z1 - T];
  const lane = ARCH.stair.wideWidth;
  const n = Math.max(2, Math.ceil(k.def.storeyHeight / 2 / ARCH.stair.maxRise - 1e-6));
  const depth = n * ARCH.stair.going + ARCH.stair.landing;
  const cx0 = inner[0] + 2.4;
  const sx0 = cx0 + P;
  const sx1 = sx0 + 2 * lane + 0.15;
  const cx1 = sx1 + P;
  const cz0 = inner[1];
  const zs = cz0 + depth;
  const cz1 = zs + 2.2 + P;
  const core: Rect = [cx0 - P, cz0, cx1 + P, cz1 + P];
  const top = k.levelY(s.levels);
  const halls: number[] = [];
  // ---- Outside.
  deckFront(k, 0, x0, x1, z1, s.entrance, s.mat, s.tint, true);
  if (s.deck) deckFront(k, 1, x0, x1, z1, s.deck, s.mat, s.tint);
  const from = s.deck ? 2 : 1;
  curtain(k, { side: 'front', from, to: s.levels, y1: top + 1.1, t: T, plane: [z1 - T, z1], u0: x0, u1: x1, mat: s.mat, tint: s.tint, sill: 0.8, drop: 0.4, piers: [x0 + 0.3, (x0 + x1) / 2, x1 - 0.3], pier: 0.6 });
  curtain(k, { side: 'back', from: 0, to: s.levels, y1: top + 1.1, t: T, plane: [z0, z0 + T], u0: x0, u1: x1, mat: s.mat, tint: s.tint, sill: 1.0, drop: 0.6, sheet: s.sheet });
  for (const side of ['left', 'right'] as const) {
    const pl: [number, number] = side === 'left' ? [x0, x0 + T] : [x1 - T, x1];
    curtain(k, { side, from: 0, to: s.levels, y1: top + 1.1, t: T, plane: pl, u0: z0 + T, u1: z1 - T, mat: s.mat, tint: s.tint, sill: 1.0, drop: 0.6, sheet: s.sheet });
  }
  // ---- Storeys.
  let stairRect: Rect | null = null;
  for (let l = 0; l < s.levels; l++) {
    const open = s.open(l);
    const reached = l <= s.stairsTo;
    if (open) k.floor(l, l === 0 ? 'tileFloor' : 'carpet', inner);
    else if (reached) k.floor(l, 'concrete', [core[0], core[1], core[2], core[3]]);
    if (l < s.stairsTo) stairRect = k.stairs({ level: l, start: [sx0 + lane / 2, zs], dir: 'z-', width: lane, kind: 'switchback', turn: 'right', mat: 'concrete', tint: s.tint }).rect;
    if (!reached) continue;
    const opts = { mat: 'concrete' as const, tint: s.tint };
    k.partition(l, cx0, cz1, cx1, cz1, [k.door((cx1 - cx0) / 2, open ? 'open' : 'locked', 1.2)], opts);
    k.partition(l, cx0, cz0, cx0, cz1, [], opts);
    k.partition(l, cx1, cz0, cx1, cz1, [], opts);
    halls.push(k.room(l, cx0 + P, zs, cx1 - P, cz1 - P, 'stairs'));
    if (!open) {
      if (f.chance(0.3)) f.stain(halls[halls.length - 1]!, 'debris', 1);
      continue;
    }
    s.plate(l, inner, core);
  }
  // ---- Roof.
  const roof: number[] = [];
  const e = top;
  const holes = s.stairsTo === s.levels && stairRect ? [stairRect] : [];
  for (const q of subtractRects(inner, holes)) k.box(s.levels, q[0], e - 0.25, q[1], q[2], e, q[3], 'concrete', { layer: 'shell', tint: s.tint });
  if (s.stairsTo === s.levels) {
    const wo = { mat: s.mat, tint: s.tint, y0: e, y1: e + 2.7, layer: 'shell' as const };
    k.wall(s.levels, core[0], cz1, core[2], cz1 + 2 * P, [k.door((cx1 - cx0) / 2 + P, 'open', 1.2)], wo);
    k.box(-1, core[0], e, cz0, core[0] + 2 * P, e + 2.7, cz1, s.mat, { layer: 'shell', tint: s.tint });
    k.box(-1, core[2] - 2 * P, e, cz0, core[2], e + 2.7, cz1, s.mat, { layer: 'shell', tint: s.tint });
    k.box(-1, core[0], e + 2.7, cz0, core[2], e + 2.9, cz1 + 2 * P, s.mat, { layer: 'shell', tint: s.tint });
    halls.push(k.room(s.levels, cx0 + P, zs, cx1 - P, cz1 - P, 'stairs'));
    const ring = ringRooms(k, s.levels, inner, [core[0], core[1], core[2], cz1 + 2 * P], 'roof');
    roof.push(...ring.all);
    roofPlant(f, ring.all, { units: 3 });
    for (const r of ring.all) f.ensure(r, 'crate', 'roof');
  } else {
    // The machine room over the core.
    k.box(-1, core[0], e, core[1], core[2], e + 2.6, core[3], s.mat, { layer: 'shell', tint: s.tint });
  }
  return { halls, roof };
}
