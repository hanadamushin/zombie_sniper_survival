// Building kit (07d): the tools a building type is assembled from. A generate() function makes a
// kit, calls these, and returns kit.finish(). Everything is in the blueprint's local frame
// (x across the front, z front-to-back with the FRONT at z = d, y up from the ground).
//
//   const k = createKit(def, params);
//   k.floor(0, 'flooring');                          ground slab (down to the foundation)
//   k.outerWalls(0, { mat: 'siding', front: [k.door(2.0), k.window(5.5, 1.6)], ... });
//   k.stairs({ level: 0, start: [1, 5], dir: 'z-', ... });
//   k.room(0, x0, z0, x1, z1, 'living');           every walkable space is a rectangle room
//   k.partition(0, x0, z0, x1, z1, [k.door(at)]);  thin wall with openings
//   k.furniture(0, x0, z0, x1, z1, 0.9, 'shelf', { search: { kind: 'shelf', face: 'z+' } });
//   k.roofGable({ mat: 'tile' });
//   return k.finish();
//
// Floors are collected and cut at the end, so stairs may be added after the floor they pierce.
// finish() works out the room graph (doors, joins, stairs) and throws when a door leads nowhere.

import { rand, seedRng, type RngState } from '../../core/rng.ts';
import { ARCH } from '../../data/architecture.ts';
import { solidOf } from './materials.ts';
import type {
  BuildingBlueprint, BuildingDef, FurnitureKind, GenerateParams, LootTableId, MaterialId, NavLink, Opening, OpeningState, Part, PartLayer,
  Room, RoomUse, SearchPoint, StairInfo, Storey,
} from './types.ts';

export type Rect = [number, number, number, number];
export type Dir = 'x+' | 'x-' | 'z+' | 'z-';

/** An opening to cut into a wall: centre `at` metres along the wall from its start (x0 or z0). */
export interface Hole {
  kind: 'door' | 'window';
  at: number;
  width: number;
  /** Bottom and top above the storey's floor (m). */
  sill: number;
  head: number;
  state: OpeningState;
  /** Door leaf / shutter material when closed. */
  leaf?: MaterialId;
}

export interface WallOptions {
  mat: MaterialId;
  tint?: number;
  layer?: PartLayer;
  /** Bottom / top (local y). Default: the storey's floor to the next floor (the ground storey from the foundation). */
  y0?: number;
  y1?: number;
  exterior?: boolean;
}

export interface OuterWallSpec {
  mat: MaterialId;
  tint?: number;
  thick?: number;
  /** Top of the walls (default: the next floor; the top storey: the eaves, plus `parapet`). */
  y1?: number;
  parapet?: number;
  /** Openings per side, `at` measured from x = 0 (front / back) or z = 0 (left / right). */
  front?: Hole[];
  back?: Hole[];
  left?: Hole[];
  right?: Hole[];
}

export interface StairOptions {
  level: number;
  /** Centre of the foot of the (first) flight, and the direction it climbs. */
  start: [number, number];
  dir: Dir;
  width?: number;
  kind?: 'straight' | 'switchback';
  /** switchback: the side the second flight lies on, looking up the first. */
  turn?: 'left' | 'right';
  mat?: MaterialId;
  tint?: number;
  /** straight: railings on the upper floor around the hole ('left' / 'right' looking up, 'end' the open low end). */
  rails?: ('left' | 'right' | 'end')[];
  /** Floor it arrives at (default level + 1). */
  to?: number;
}

export interface StairResult {
  /** Plan rectangle of the stairwell (the hole in the floor above). */
  rect: Rect;
  /** Waypoint below the first step and above the last (local, feet). */
  bottom: [number, number, number];
  top: [number, number, number];
}

export interface SearchSpec {
  kind: FurnitureKind;
  /** Side of the piece the searcher stands at. */
  face: Dir;
  table?: LootTableId;
}

export interface Kit {
  readonly def: BuildingDef;
  readonly w: number;
  readonly d: number;
  readonly rng: RngState;
  /** Wall thickness used by outerWalls (default ARCH.wall.exterior). */
  thick: number;
  /** Floor level of storey i (local y); i = storeys gives the eaves / roof level. */
  levelY(i: number): number;
  readonly storeys: number;
  readonly eaves: number;
  /** Random helpers on the kit's rng. */
  rand(): number;
  range(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;

  /** Opening factories (`at` along the wall). */
  door(at: number, state?: OpeningState, width?: number): Hole;
  window(at: number, width?: number, opts?: { sill?: number; head?: number; broken?: boolean }): Hole;
  /** Centres of n openings spread evenly over [from, to]. */
  evenly(from: number, to: number, n: number): number[];

  /** Raw part (anything the helpers do not cover). */
  part(p: Omit<Part, 'layer' | 'level'> & { layer?: PartLayer; level?: number }): Part;
  box(level: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: MaterialId, opts?: Partial<Pick<Part, 'tint' | 'solid' | 'hidden' | 'role' | 'layer'>>): Part;
  /** A wall: plan rectangle (thin in one direction), with openings along its long axis. Returns the openings' indices. */
  wall(level: number, x0: number, z0: number, x1: number, z1: number, holes: Hole[], opts: WallOptions): number[];
  outerWalls(level: number, spec: OuterWallSpec): void;
  /** Interior wall, ARCH.wall.partition thick, centred on the line x = x0 (when x0 === x1) or z = z0. */
  partition(level: number, x0: number, z0: number, x1: number, z1: number, holes?: Hole[], opts?: Partial<WallOptions>): number[];
  /** Floor slab of a storey (top at levelY(level)); default rect: inside the outer walls. Holes from stairs are cut automatically. */
  floor(level: number, mat: MaterialId, rect?: Rect, opts?: { tint?: number; thick?: number }): void;
  /** Cut a hole into a storey's floor (lift shafts, light wells). */
  hole(level: number, rect: Rect): void;
  stairs(o: StairOptions): StairResult;
  /** Ladder on a wall from one floor to the next (roof hatches): the climb zone faces (nx, nz) towards the wall. */
  ladder(level: number, x: number, z: number, nx: number, nz: number, to?: number): void;
  /** A lift shaft (cannot be used): holes in every floor it crosses and closed doors at each. */
  shaft(rect: Rect, from: number, to: number): void;
  room(level: number, x0: number, z0: number, x1: number, z1: number, use: RoomUse, opts?: { locked?: boolean }): number;
  roomById(id: number): Room;
  /** Join two rooms that touch (an open archway): a nav link through the middle of the shared edge. */
  join(a: number, b: number): void;
  /** Box standing on a storey's floor; with `search` it is a search point. */
  furniture(level: number, x0: number, z0: number, x1: number, z1: number, h: number, mat: MaterialId, opts?: { tint?: number; search?: SearchSpec; solid?: boolean }): Part;
  /** Search point without a piece of furniture (a pile of boxes drawn elsewhere, a body...). */
  search(level: number, x: number, z: number, kind: FurnitureKind, table?: LootTableId): void;
  /** Flat stain on the floor (blood, debris): decoration. */
  stain(level: number, x0: number, z0: number, x1: number, z1: number, mat?: MaterialId): void;
  /** Roofs over the whole footprint (with ARCH.overhang). */
  roofGable(opts: { mat: MaterialId; tint?: number; axis?: 'x' | 'z'; rise?: number; overhang?: number }): void;
  roofHip(opts: { mat: MaterialId; tint?: number; axis?: 'x' | 'z'; rise?: number; overhang?: number }): void;
  /** Flat roof: the roof slab (as the floor of level `storeys`) and a parapet. */
  roofFlat(opts: { mat: MaterialId; tint?: number; parapet?: number; parapetMat?: MaterialId }): void;
  finish(): BuildingBlueprint;
}

const EPS = 1e-6;

/** Rectangle minus holes, as a few boxes (grid of the hole edges, then merged runs). */
export function subtractRects(r: Rect, holes: readonly Rect[]): Rect[] {
  const hs = holes
    .map((h): Rect => [Math.max(r[0], h[0]), Math.max(r[1], h[1]), Math.min(r[2], h[2]), Math.min(r[3], h[3])])
    .filter((h) => h[2] - h[0] > EPS && h[3] - h[1] > EPS);
  if (hs.length === 0) return [r];
  const xs = [...new Set([r[0], r[2], ...hs.flatMap((h) => [h[0], h[2]])])].sort((a, b) => a - b);
  const zs = [...new Set([r[1], r[3], ...hs.flatMap((h) => [h[1], h[3]])])].sort((a, b) => a - b);
  const runs: Rect[] = [];
  for (let j = 0; j + 1 < zs.length; j++) {
    let start = -1;
    for (let i = 0; i + 1 <= xs.length; i++) {
      const free = i + 1 < xs.length && !hs.some((h) => {
        const cx = (xs[i]! + xs[i + 1]!) / 2;
        const cz = (zs[j]! + zs[j + 1]!) / 2;
        return cx > h[0] && cx < h[2] && cz > h[1] && cz < h[3];
      });
      if (free && start < 0) start = i;
      if (!free && start >= 0) {
        runs.push([xs[start]!, zs[j]!, xs[i]!, zs[j + 1]!]);
        start = -1;
      }
    }
  }
  // Merge runs with the same x span in consecutive rows.
  const out: Rect[] = [];
  for (const run of runs) {
    const prev = out.find((o) => Math.abs(o[0] - run[0]) < EPS && Math.abs(o[2] - run[2]) < EPS && Math.abs(o[3] - run[1]) < EPS);
    if (prev) prev[3] = run[3];
    else out.push([...run]);
  }
  return out;
}

const UNIT: Record<Dir, [number, number]> = { 'x+': [1, 0], 'x-': [-1, 0], 'z+': [0, 1], 'z-': [0, -1] };

export function createKit(def: BuildingDef, params: GenerateParams, rngIn?: RngState): Kit {
  const rng = rngIn ?? seedRng(params.seed);
  const { w, d } = params;
  const parts: Part[] = [];
  const openings: Opening[] = [];
  const rooms: Room[] = [];
  const search: { level: number; pos: [number, number, number]; kind: FurnitureKind; table?: LootTableId }[] = [];
  const stairs: StairInfo[] = [];
  const ladders: BuildingBlueprint['ladders'] = [];
  const rawLinks: { kind: NavLink['kind']; levelA: number; levelB: number; width: number; pts: [number, number, number][]; opening?: number; exterior?: boolean; a?: number; b?: number }[] = [];
  const floors: { level: number; rect: Rect; mat: MaterialId; tint?: number; thick: number }[] = [];
  const holes = new Map<number, Rect[]>();
  const storeyCount = def.storeys;
  const levelY = (i: number): number => def.plinth + i * def.storeyHeight;
  const eaves = levelY(storeyCount);
  let roofAccess = false;

  const addHole = (level: number, r: Rect): void => {
    const list = holes.get(level) ?? [];
    list.push(r);
    holes.set(level, list);
  };

  const kit: Kit = {
    def,
    w,
    d,
    rng,
    thick: ARCH.wall.exterior,
    levelY,
    storeys: storeyCount,
    eaves,
    rand: () => rand(rng),
    range: (lo, hi) => lo + (hi - lo) * rand(rng),
    pick: (items) => items[Math.min(items.length - 1, Math.floor(rand(rng) * items.length))]!,

    door(at, state = 'open', width = ARCH.door.width) {
      return { kind: 'door', at, width, sill: 0, head: ARCH.door.height, state, leaf: state === 'shutter' ? 'shutter' : 'door' };
    },
    window(at, width = 1.2, opts = {}) {
      return { kind: 'window', at, width, sill: opts.sill ?? ARCH.window.sill, head: opts.head ?? ARCH.window.head, state: opts.broken ? 'broken' : 'glazed' };
    },
    evenly(from, to, n) {
      const out: number[] = [];
      for (let i = 0; i < n; i++) out.push(from + ((to - from) * (i + 0.5)) / n);
      return out;
    },

    part(p) {
      const full: Part = { layer: 'shell', level: -1, ...p };
      parts.push(full);
      return full;
    },
    box(level, x0, y0, z0, x1, y1, z1, mat, opts = {}) {
      const p: Part = { shape: 'box', x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), mat, layer: opts.layer ?? 'interior', level };
      if (opts.tint !== undefined) p.tint = opts.tint;
      if (opts.solid !== undefined) p.solid = opts.solid;
      if (opts.hidden) p.hidden = true;
      if (opts.role) p.role = opts.role;
      parts.push(p);
      return p;
    },

    wall(level, x0, z0, x1, z1, hs, opts) {
      const alongX = x1 - x0 >= z1 - z0;
      const layer = opts.layer ?? (opts.exterior ? 'shell' : 'interior');
      const y0 = opts.y0 ?? (level === 0 ? -ARCH.foundation : levelY(level));
      const y1 = opts.y1 ?? levelY(level + 1);
      const fy = levelY(level);
      const u0 = alongX ? x0 : z0;
      const u1 = alongX ? x1 : z1;
      const t0 = alongX ? z0 : x0;
      const t1 = alongX ? z1 : x1;
      const tc = (t0 + t1) / 2;
      const piece = (a: number, b: number, ya: number, yb: number, mat: MaterialId = opts.mat, thin = 0, extra: Partial<Part> = {}): void => {
        if (b - a < EPS || yb - ya < EPS) return;
        const ta = thin > 0 ? tc - thin / 2 : t0;
        const tb = thin > 0 ? tc + thin / 2 : t1;
        const p: Part = alongX
          ? { shape: 'box', x0: a, x1: b, z0: ta, z1: tb, y0: ya, y1: yb, mat, layer, level }
          : { shape: 'box', x0: ta, x1: tb, z0: a, z1: b, y0: ya, y1: yb, mat, layer, level };
        if (opts.tint !== undefined && mat === opts.mat) p.tint = opts.tint;
        Object.assign(p, extra);
        parts.push(p);
      };
      const sorted = [...hs].sort((a, b) => a.at - b.at);
      const ids: number[] = [];
      let cur = u0;
      for (const h of sorted) {
        const a = Math.max(u0, u0 + h.at - h.width / 2);
        const b = Math.min(u1, u0 + h.at + h.width / 2);
        if (a < cur - EPS) throw new Error(`${def.id}: openings overlap along a wall at ${h.at.toFixed(2)}`);
        piece(cur, a, y0, y1);
        const ha = fy + h.sill;
        const hb = Math.min(y1, fy + h.head);
        piece(a, b, y0, ha);
        piece(a, b, hb, y1);
        cur = b;
        const mid = (a + b) / 2;
        const op: Opening = {
          kind: h.kind, state: h.state, level, x: alongX ? mid : tc, z: alongX ? tc : mid, y0: ha, y1: hb, width: b - a, axis: alongX ? 'x' : 'z', exterior: opts.exterior === true,
        };
        ids.push(openings.length);
        openings.push(op);
        if (h.kind === 'window') {
          if (h.state === 'glazed') piece(a, b, ha, hb, 'glass', ARCH.window.pane, { layer });
          else piece(a, b, ha, hb, 'glass', ARCH.window.pane, { layer, hidden: true });
        } else if (h.state === 'locked') piece(a, b, ha, hb, h.leaf ?? 'door', ARCH.door.leaf * 2, { layer });
        else if (h.state === 'shutter') piece(a, b, ha, hb, 'shutter', Math.min(0.12, t1 - t0), { layer });
        if (h.kind === 'door' && h.state === 'open') {
          const n = alongX ? [0, 1] : [1, 0];
          const r = ARCH.doorReach + (t1 - t0) / 2;
          rawLinks.push({
            kind: 'door', levelA: level, levelB: level, width: b - a, opening: openings.length - 1, exterior: opts.exterior === true,
            pts: [
              [op.x - n[0]! * r, fy, op.z - n[1]! * r],
              [op.x + n[0]! * r, fy, op.z + n[1]! * r],
            ],
          });
        }
      }
      piece(cur, u1, y0, y1);
      return ids;
    },

    outerWalls(level, spec) {
      const t = spec.thick ?? kit.thick;
      const top = spec.y1 ?? (level === storeyCount - 1 ? eaves + (spec.parapet ?? 0) : levelY(level + 1));
      const o: WallOptions = { mat: spec.mat, tint: spec.tint, y1: top, exterior: true, layer: 'shell' };
      // Front and back span the full width; the sides fit between them.
      kit.wall(level, 0, d - t, w, d, spec.front ?? [], o);
      kit.wall(level, 0, 0, w, t, spec.back ?? [], o);
      kit.wall(level, 0, t, t, d - t, (spec.left ?? []).map((h) => ({ ...h, at: h.at - t })), o);
      kit.wall(level, w - t, t, w, d - t, (spec.right ?? []).map((h) => ({ ...h, at: h.at - t })), o);
    },

    partition(level, x0, z0, x1, z1, hs = [], opts = {}) {
      const half = ARCH.wall.partition / 2;
      const alongX = Math.abs(z1 - z0) < EPS || x1 - x0 > z1 - z0;
      const rect: Rect = alongX ? [Math.min(x0, x1), z0 - half, Math.max(x0, x1), z0 + half] : [x0 - half, Math.min(z0, z1), x0 + half, Math.max(z0, z1)];
      return kit.wall(level, rect[0], rect[1], rect[2], rect[3], hs, { mat: opts.mat ?? 'plaster', tint: opts.tint, y0: opts.y0 ?? levelY(level), y1: opts.y1 ?? levelY(level + 1) - ARCH.slab, layer: 'interior' });
    },

    floor(level, mat, rect, opts = {}) {
      const t = kit.thick;
      floors.push({ level, rect: rect ?? [t, t, w - t, d - t], mat, tint: opts.tint, thick: opts.thick ?? ARCH.slab });
    },
    hole: addHole,

    stairs(o) {
      const to = o.to ?? o.level + 1;
      const y0 = levelY(o.level);
      const y1 = levelY(to);
      const rise = y1 - y0;
      const width = o.width ?? ARCH.stair.width;
      const mat = o.mat ?? 'wood';
      const [ux, uz] = UNIT[o.dir];
      // Side vector: to the right when looking up the flight (x right of z-: +x ... ).
      const sx = -uz;
      const sz = ux;
      const g = ARCH.stair.going;
      const tread = ARCH.stair.tread;
      const at = (along: number, side: number): [number, number] => [o.start[0] + ux * along + sx * side, o.start[1] + uz * along + sz * side];
      const rectOf = (a0: number, a1: number, s0: number, s1: number): Rect => {
        const p = at(a0, s0);
        const q = at(a1, s1);
        return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])];
      };
      const step = (a0: number, a1: number, s0: number, s1: number, top: number): void => {
        const r = rectOf(a0, a1, s0, s1);
        kit.box(o.level, r[0], top - tread, r[1], r[2], top, r[3], mat, { tint: o.tint, role: 'stair' });
      };
      const reach = 0.6;
      if ((o.kind ?? 'straight') === 'straight') {
        const n = Math.max(2, Math.ceil(rise / ARCH.stair.maxRise - EPS));
        const len = n * g;
        for (let i = 0; i < n; i++) step(i * g, (i + 1) * g, -width / 2, width / 2, y0 + ((i + 1) * rise) / n);
        const r = rectOf(0, len, -width / 2, width / 2);
        addHole(to, r);
        // Railings round the hole on the upper floor.
        const rail = (a0: number, a1: number, s0: number, s1: number): void => {
          const rr = rectOf(a0, a1, s0, s1);
          kit.box(to, rr[0], y1, rr[1], rr[2], y1 + ARCH.rail.height, rr[3], 'steel', { role: 'furniture' });
        };
        const rt = ARCH.rail.thick;
        for (const side of o.rails ?? ['left', 'right', 'end']) {
          if (side === 'left') rail(0, len, -width / 2 - rt, -width / 2);
          else if (side === 'right') rail(0, len, width / 2, width / 2 + rt);
          else rail(-rt, 0, -width / 2, width / 2);
        }
        const bottom = at(-reach, 0);
        const top = at(len + reach, 0);
        stairs.push({ kind: 'stairs', from: o.level, to, rect: r, usable: true });
        rawLinks.push({ kind: 'stairs', levelA: o.level, levelB: to, width, pts: [[bottom[0], y0, bottom[1]], [top[0], y1, top[1]]] });
        if (to === storeyCount) roofAccess = true;
        return { rect: r, bottom: [bottom[0], y0, bottom[1]], top: [top[0], y1, top[1]] };
      }
      // Switchback: flight 1 up the first lane, a landing across both, flight 2 back down the other lane.
      const half = rise / 2;
      const n = Math.max(2, Math.ceil(half / ARCH.stair.maxRise - EPS));
      const len = n * g;
      const land = ARCH.stair.landing;
      const gap = 0.15;
      const side = o.turn === 'left' ? -1 : 1;
      const laneA: [number, number] = [-width / 2, width / 2];
      const laneB: [number, number] = side > 0 ? [width / 2 + gap, width * 1.5 + gap] : [-width * 1.5 - gap, -width / 2 - gap];
      for (let i = 0; i < n; i++) step(i * g, (i + 1) * g, laneA[0], laneA[1], y0 + ((i + 1) * half) / n);
      const lo = Math.min(laneA[0], laneB[0]);
      const hi = Math.max(laneA[1], laneB[1]);
      step(len, len + land, lo, hi, y0 + half);
      for (let i = 0; i < n; i++) step(len - (i + 1) * g, len - i * g, laneB[0], laneB[1], y0 + half + ((i + 1) * half) / n);
      // The wall between the flights.
      const wr = rectOf(0, len, side > 0 ? width / 2 : -width / 2 - gap, side > 0 ? width / 2 + gap : -width / 2);
      kit.box(o.level, wr[0], y0, wr[1], wr[2], y1, wr[3], 'concrete', { role: 'stair' });
      const r = rectOf(0, len + land, lo, hi);
      addHole(to, r);
      const cA = (laneA[0] + laneA[1]) / 2;
      const cB = (laneB[0] + laneB[1]) / 2;
      const p0 = at(-reach, cA);
      const p1 = at(len + land / 2, cA);
      const p2 = at(len + land / 2, cB);
      const p3 = at(-reach, cB);
      stairs.push({ kind: 'stairs', from: o.level, to, rect: r, usable: true });
      rawLinks.push({ kind: 'stairs', levelA: o.level, levelB: to, width, pts: [[p0[0], y0, p0[1]], [p1[0], y0 + half, p1[1]], [p2[0], y0 + half, p2[1]], [p3[0], y1, p3[1]]] });
      if (to === storeyCount) roofAccess = true;
      return { rect: r, bottom: [p0[0], y0, p0[1]], top: [p3[0], y1, p3[1]] };
    },

    ladder(level, x, z, nx, nz, to = level + 1) {
      const y0 = levelY(level);
      const y1 = levelY(to);
      const half = 0.45;
      ladders.push({ x0: x - half, z0: z - half, x1: x + half, z1: z + half, y0, y1: y1 + 0.02, nx, nz });
      // Rails and rungs on the wall side.
      const wx = x + nx * (half - 0.1);
      const wz = z + nz * (half - 0.1);
      const tx = -nz;
      const tz = nx;
      for (const s of [-0.25, 0.25]) kit.box(level, wx + tx * s - 0.03, y0, wz + tz * s - 0.03, wx + tx * s + 0.03, y1 + 0.9, wz + tz * s + 0.03, 'steel', { solid: false });
      for (let y = y0 + 0.3; y < y1; y += 0.35) kit.box(level, wx - Math.abs(tx) * 0.25 - 0.02, y, wz - Math.abs(tz) * 0.25 - 0.02, wx + Math.abs(tx) * 0.25 + 0.02, y + 0.04, wz + Math.abs(tz) * 0.25 + 0.02, 'steel', { solid: false });
      addHole(to, [x - half, z - half, x + half, z + half]);
      stairs.push({ kind: 'ladder', from: level, to, rect: [x - half, z - half, x + half, z + half], usable: true });
      rawLinks.push({ kind: 'ladder', levelA: level, levelB: to, width: 0.6, pts: [[x - nx * 0.6, y0, z - nz * 0.6], [x, y1, z]] });
      if (to === storeyCount) roofAccess = true;
    },

    shaft(rect, from, to) {
      for (let l = from + 1; l <= to; l++) addHole(l, rect);
      stairs.push({ kind: 'shaft', from, to, rect, usable: false });
    },

    room(level, x0, z0, x1, z1, use, opts = {}) {
      const id = rooms.length;
      const room: Room = { id, level, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y: levelY(level), use };
      if (opts.locked) room.locked = true;
      rooms.push(room);
      return id;
    },

    roomById(id) {
      const r = rooms[id];
      if (!r) throw new Error(`${def.id}: no room ${id}`);
      return r;
    },

    join(a, b) {
      const ra = rooms[a]!;
      const rb = rooms[b]!;
      const ox0 = Math.max(ra.x0, rb.x0);
      const ox1 = Math.min(ra.x1, rb.x1);
      const oz0 = Math.max(ra.z0, rb.z0);
      const oz1 = Math.min(ra.z1, rb.z1);
      let pa: [number, number];
      let pb: [number, number];
      let width: number;
      const r = 0.5;
      if (ox1 - ox0 > EPS && Math.abs(oz1 - oz0) < 0.3) {
        // Shared edge along x.
        const cx = (ox0 + ox1) / 2;
        const z = (oz0 + oz1) / 2;
        const sign = ra.z0 < rb.z0 ? 1 : -1;
        pa = [cx, z - sign * r];
        pb = [cx, z + sign * r];
        width = ox1 - ox0;
      } else if (oz1 - oz0 > EPS && Math.abs(ox1 - ox0) < 0.3) {
        const cz = (oz0 + oz1) / 2;
        const x = (ox0 + ox1) / 2;
        const sign = ra.x0 < rb.x0 ? 1 : -1;
        pa = [x - sign * r, cz];
        pb = [x + sign * r, cz];
        width = oz1 - oz0;
      } else throw new Error(`${def.id}: rooms ${a} and ${b} do not share an edge`);
      rawLinks.push({ kind: 'join', levelA: ra.level, levelB: rb.level, width, a, b, pts: [[pa[0], ra.y, pa[1]], [pb[0], rb.y, pb[1]]] });
    },

    furniture(level, x0, z0, x1, z1, h, mat, opts = {}) {
      const y = levelY(level);
      const p = kit.box(level, x0, y, z0, x1, y + h, z1, mat, { tint: opts.tint, role: 'furniture', solid: opts.solid });
      if (opts.search) {
        const [fx, fz] = UNIT[opts.search.face];
        const cx = fx > 0 ? Math.max(x0, x1) + 0.5 : fx < 0 ? Math.min(x0, x1) - 0.5 : (x0 + x1) / 2;
        const cz = fz > 0 ? Math.max(z0, z1) + 0.5 : fz < 0 ? Math.min(z0, z1) - 0.5 : (z0 + z1) / 2;
        search.push({ level, pos: [cx, y, cz], kind: opts.search.kind, table: opts.search.table });
      }
      return p;
    },
    search(level, x, z, kind, table) {
      search.push({ level, pos: [x, levelY(level), z], kind, table });
    },
    stain(level, x0, z0, x1, z1, mat = 'blood') {
      const y = levelY(level);
      kit.box(level, x0, y, z0, x1, y + 0.012, z1, mat, { solid: false });
    },

    roofGable(o) {
      const ov = o.overhang ?? ARCH.overhang;
      const axis = o.axis ?? (w >= d ? 'x' : 'z');
      const rise = o.rise ?? def.roofRise;
      kit.part({ shape: 'gable', x0: -ov, x1: w + ov, z0: -ov, z1: d + ov, y0: eaves, y1: eaves + rise, mat: o.mat, tint: o.tint, axis });
      kit.floor(storeyCount, 'wood', undefined, { thick: ARCH.slab });
    },
    roofHip(o) {
      const ov = o.overhang ?? ARCH.overhang;
      const axis = o.axis ?? (w >= d ? 'x' : 'z');
      const rise = o.rise ?? def.roofRise;
      kit.part({ shape: 'hip', x0: -ov, x1: w + ov, z0: -ov, z1: d + ov, y0: eaves, y1: eaves + rise, mat: o.mat, tint: o.tint, axis });
      kit.floor(storeyCount, 'wood', undefined, { thick: ARCH.slab });
    },
    roofFlat(o) {
      const t = kit.thick;
      floors.push({ level: storeyCount, rect: [t, t, w - t, d - t], mat: o.mat, tint: o.tint, thick: ARCH.slab });
      const ph = o.parapet ?? 0;
      if (ph > 0) {
        // The outer walls stop at the eaves; the parapet stands on them.
        const pm = o.parapetMat ?? o.mat;
        kit.box(-1, 0, eaves, d - t, w, eaves + ph, d, pm, { layer: 'shell', tint: o.tint });
        kit.box(-1, 0, eaves, 0, w, eaves + ph, t, pm, { layer: 'shell', tint: o.tint });
        kit.box(-1, 0, eaves, t, t, eaves + ph, d - t, pm, { layer: 'shell', tint: o.tint });
        kit.box(-1, w - t, eaves, t, w, eaves + ph, d - t, pm, { layer: 'shell', tint: o.tint });
      }
    },

    finish() {
      // Floors, cut around the stairwells.
      for (const f of floors) {
        const top = levelY(f.level);
        const bottom = f.level === 0 ? -ARCH.foundation : top - f.thick;
        const layer: PartLayer = f.level === storeyCount ? 'shell' : 'interior';
        for (const r of subtractRects(f.rect, holes.get(f.level) ?? [])) {
          const p: Part = { shape: 'box', x0: r[0], z0: r[1], x1: r[2], z1: r[3], y0: bottom, y1: top, mat: f.mat, layer, level: f.level };
          if (f.tint !== undefined) p.tint = f.tint;
          parts.push(p);
        }
      }
      const roomAt = (level: number, x: number, z: number): number => {
        let best = -1;
        let area = Infinity;
        for (const r of rooms) {
          if (r.level !== level || x < r.x0 - 0.05 || x > r.x1 + 0.05 || z < r.z0 - 0.05 || z > r.z1 + 0.05) continue;
          const a = (r.x1 - r.x0) * (r.z1 - r.z0);
          if (a < area) {
            area = a;
            best = r.id;
          }
        }
        return best;
      };
      const links: NavLink[] = [];
      for (const l of rawLinks) {
        const first = l.pts[0]!;
        const last = l.pts[l.pts.length - 1]!;
        let a = l.a ?? roomAt(l.levelA, first[0], first[2]);
        let b = l.b ?? roomAt(l.levelB, last[0], last[2]);
        let pts = l.pts;
        if (l.kind === 'door' && l.exterior) {
          // Outer door: which side is inside? Keep the outside as `a` (-1).
          if (a >= 0 && b < 0) {
            b = a;
            pts = [...pts].reverse();
          }
          if (b < 0) throw new Error(`${def.id}: an outer door at (${first[0].toFixed(2)}, ${first[2].toFixed(2)}) on storey ${l.levelA} opens into no room`);
          a = -1;
          // The outside waypoint is on the ground (local y 0) when the door is on the ground storey.
          if (l.levelA === 0) pts = [[pts[0]![0], 0, pts[0]![2]], ...pts.slice(1)];
        } else if (a < 0 || b < 0) {
          throw new Error(`${def.id}: a ${l.kind} near (${first[0].toFixed(2)}, ${first[2].toFixed(2)}) on storey ${l.levelA} does not join two rooms`);
        }
        const link: NavLink = { a, b, kind: l.kind, width: l.width, pts };
        if (l.opening !== undefined) link.opening = l.opening;
        links.push(link);
      }
      const points: SearchPoint[] = search.map((s) => {
        const room = roomAt(s.level, s.pos[0], s.pos[2]);
        if (room < 0) throw new Error(`${def.id}: a search point at (${s.pos[0].toFixed(2)}, ${s.pos[2].toFixed(2)}) on storey ${s.level} lies in no room`);
        return { pos: s.pos, room, kind: s.kind, table: s.table ?? rooms[room]!.use };
      });
      const st: Storey[] = [];
      for (let i = 0; i < storeyCount; i++) st.push({ y: levelY(i), height: def.storeyHeight });
      if (roofAccess || rooms.some((r) => r.level === storeyCount)) st.push({ y: eaves, height: 0 });
      let height = 0;
      for (const p of parts) if (p.y1 > height) height = p.y1;
      return {
        def: def.id, w, d, height, storeys: st, roofAccess: roofAccess || rooms.some((r) => r.level === storeyCount && r.use === 'roof'),
        parts, openings, rooms, stairs, search: points, links, ladders,
      };
    },
  };
  return kit;
}

/** Does a part collide? (materials.ts + the part's own override). */
export const partSolid = solidOf;
