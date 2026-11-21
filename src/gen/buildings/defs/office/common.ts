// Helpers shared by the office types (07d-2c). They only call the kit (or rewrite a finished
// blueprint), so the blueprints stay plain data. Local frame as in the kit: x across the front,
// z towards the front (z = d), y up.
//
//   twoPass(def, rng, params, body)   build the building twice: the first pass only finds every room's
//                                     ways in and out (doors, joins, stairs), the second places the
//                                     furniture where it keeps those straight walks free (Fit)
//   Fit                               furniture placement that checks the ways, the walls and the
//                                     other pieces (desks, rows along a wall, a search point in any room)
//   coreAt / coreLevel / coreRoof     a stair core: a switchback stair, dead lifts, a toilet and the hall
//                                     in front of them; on the roof its stair house and machine room
//   ringRooms                         open floor round a core (four rooms joined at the corners)
//   curtain                           a multi-storey wall as one band per storey, full-height piers and one
//                                     glass sheet: the cost grows by one box per storey and side, not per window
//   helipad / guardRail / mast        roof furniture of the tall ones
//   embedGround                       put another type's one-storey blueprint (shop.konbini_tenant) into
//                                     the ground floor of a finished building
//
// Furniture programs (office desks, classrooms, clinics, sales floors...) are at the bottom.

import { fork, rand, type RngState } from '../../../../core/rng.ts';
import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Dir, type Hole, type Kit, type Rect } from '../../kit.ts';
import type { BuildingBlueprint, BuildingDef, FurnitureKind, GenerateParams, LootTableId, MaterialId, RoomUse } from '../../types.ts';

export const P = ARCH.wall.partition / 2;
export const LANE: number = ARCH.stair.wideWidth;
/** Width of a switchback stairwell (two flights and the gap between them, kit.stairs). */
export const SW = 2 * LANE + 0.15;

/** Depth of a switchback stairwell for a storey height (flights plus the landing). */
export function flightDepth(storeyHeight: number, lane = LANE): number {
  void lane;
  const n = Math.max(2, Math.ceil(storeyHeight / 2 / ARCH.stair.maxRise - 1e-6));
  return n * ARCH.stair.going + ARCH.stair.landing;
}

// ---------------------------------------------------------------------------------------------
// Two passes
// ---------------------------------------------------------------------------------------------

export type Ways = Map<number, [number, number][]>;

/** Every room's ways in and out (the ends of its links, local x / z). */
export function waysOf(bp: BuildingBlueprint): Ways {
  const ways: Ways = new Map();
  const add = (room: number, p: [number, number, number]): void => {
    if (room < 0) return;
    const list = ways.get(room) ?? [];
    list.push([p[0], p[2]]);
    ways.set(room, list);
  };
  for (const l of bp.links) {
    add(l.a, l.pts[0]!);
    add(l.b, l.pts[l.pts.length - 1]!);
  }
  return ways;
}

/**
 * Build a blueprint in two passes from the same random state. `body` must make the same rooms and
 * links in both (draw the structure from `k`, the furniture from `f`): the first pass has no
 * furniture and tells the second where every room's ways are.
 */
export function twoPass(def: BuildingDef, rng: RngState, params: GenerateParams, body: (k: Kit, f: Fit) => void): BuildingBlueprint {
  const s = [...rng.s] as RngState['s'];
  const a = createKit(def, params, { s: [...s] as RngState['s'] });
  // The first pass only needs the rooms and links: plain boxes (steps, slabs, signs) and floors are
  // left out (they never make a link nor draw from the random state).
  const none = { shape: 'box', x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0, mat: 'concrete', layer: 'shell', level: -1 } as const;
  a.box = () => ({ ...none });
  a.part = () => ({ ...none });
  a.floor = () => {};
  body(a, new Fit(a, null));
  const ways = waysOf(a.finish());
  const b = createKit(def, params, { s: [...s] as RngState['s'] });
  body(b, new Fit(b, ways));
  return b.finish();
}

/** Distance from point (x, z) to rectangle r. */
function pointRect(x: number, z: number, r: Rect): number {
  const dx = Math.max(r[0] - x, 0, x - r[2]);
  const dz = Math.max(r[1] - z, 0, z - r[3]);
  return Math.sqrt(dx * dx + dz * dz);
}

/** Distance from point (x, z) to segment a-b. */
function pointSeg(x: number, z: number, ax: number, az: number, dx: number, dz: number, l2: number): number {
  const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
  const ex = ax + dx * t - x;
  const ez = az + dz * t - z;
  return Math.sqrt(ex * ex + ez * ez);
}

/** Distance from segment a-b to rectangle r (0 when they touch). */
export function segRectDist(ax: number, az: number, bx: number, bz: number, r: Rect): number {
  const dx = bx - ax;
  const dz = bz - az;
  // Liang–Barsky: does the segment cross the rectangle?
  let t0 = 0;
  let t1 = 1;
  let hit = true;
  const clip = (p: number, q: number): void => {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) hit = false;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
  };
  clip(-dx, ax - r[0]);
  clip(dx, r[2] - ax);
  clip(-dz, az - r[1]);
  clip(dz, r[3] - az);
  if (hit && t0 <= t1) return 0;
  const l2 = dx * dx + dz * dz;
  return Math.min(
    pointRect(ax, az, r), pointRect(bx, bz, r),
    pointSeg(r[0], r[1], ax, az, dx, dz, l2), pointSeg(r[2], r[1], ax, az, dx, dz, l2),
    pointSeg(r[0], r[3], ax, az, dx, dz, l2), pointSeg(r[2], r[3], ax, az, dx, dz, l2),
  );
}

/** Is rect r at least `margin` from every straight line between two of `ways` (and from each way point)? */
export function clearOf(ways: readonly [number, number][], r: Rect, margin: number): boolean {
  for (let i = 0; i < ways.length; i++) {
    const a = ways[i]!;
    for (let j = i; j < ways.length; j++) {
      const b = ways[j]!;
      // Far apart in either axis: no need to measure.
      if (Math.max(a[0], b[0]) + margin <= r[0] || Math.min(a[0], b[0]) - margin >= r[2] || Math.max(a[1], b[1]) + margin <= r[1] || Math.min(a[1], b[1]) - margin >= r[3]) continue;
      if (segRectDist(a[0], a[1], b[0], b[1], r) < margin) return false;
    }
  }
  return true;
}

const FACE: Record<Dir, [number, number]> = { 'x+': [1, 0], 'x-': [-1, 0], 'z+': [0, 1], 'z-': [0, -1] };
const OPP: Record<Dir, Dir> = { 'x+': 'x-', 'x-': 'x+', 'z+': 'z-', 'z-': 'z+' };

export interface PutOpts {
  tint?: number;
  search?: { kind: FurnitureKind; face: Dir; table?: LootTableId };
  solid?: boolean;
  /** Distance kept from the room's straight ways (default 0.45; 0 for low pieces). */
  margin?: number;
}

/**
 * Furniture placement for the second pass. Every piece is checked against its room: inside it,
 * clear of the other pieces and search points, `margin` away from the straight lines between the
 * room's ways, and its search point (0.5 m in front) with room to stand. In the first pass nothing
 * is placed (put() returns false) — the structure must not depend on what was placed.
 */
export class Fit {
  readonly k: Kit;
  readonly live: boolean;
  private readonly ways: Ways | null;
  private readonly rng: RngState;
  private readonly taken = new Map<number, Rect[]>();
  private readonly spots = new Map<number, [number, number][]>();

  constructor(k: Kit, ways: Ways | null) {
    this.k = k;
    this.ways = ways;
    this.live = ways !== null;
    this.rng = fork(k.rng, 'office-fit');
  }

  rand(): number {
    return rand(this.rng);
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * rand(this.rng);
  }
  chance(p: number): boolean {
    return rand(this.rng) < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.min(items.length - 1, Math.floor(rand(this.rng) * items.length))]!;
  }

  roomRect(room: number): Rect {
    const r = this.k.roomById(room);
    return [r.x0, r.z0, r.x1, r.z1];
  }

  /** Does a piece fit at r in the room? */
  free(room: number, r: Rect, margin = 0.45): boolean {
    if (!this.ways) return false;
    const R = this.k.roomById(room);
    if (r[0] < R.x0 - 1e-6 || r[1] < R.z0 - 1e-6 || r[2] > R.x1 + 1e-6 || r[3] > R.z1 + 1e-6) return false;
    for (const q of this.taken.get(room) ?? []) if (r[0] < q[2] - 1e-6 && r[2] > q[0] + 1e-6 && r[1] < q[3] - 1e-6 && r[3] > q[1] + 1e-6) return false;
    for (const s of this.spots.get(room) ?? []) if (segRectDist(s[0], s[1], s[0], s[1], r) < 0.36) return false;
    return margin <= 0 || clearOf(this.ways.get(room) ?? [], r, margin);
  }

  private standable(room: number, x: number, z: number): boolean {
    const R = this.k.roomById(room);
    if (x < R.x0 + 0.36 || x > R.x1 - 0.36 || z < R.z0 + 0.36 || z > R.z1 - 0.36) return false;
    for (const q of this.taken.get(room) ?? []) if (segRectDist(x, z, x, z, q) < 0.36) return false;
    return true;
  }

  private note(room: number, r: Rect): void {
    const list = this.taken.get(room) ?? [];
    list.push(r);
    this.taken.set(room, list);
  }

  /** Keep a rectangle free of furniture (something drawn elsewhere stands there). */
  reserve(room: number, r: Rect): void {
    if (this.live) this.note(room, r);
  }

  /** Place a piece of furniture standing on its room's floor; false when it does not fit. */
  put(room: number, r: Rect, h: number, mat: MaterialId, o: PutOpts = {}): boolean {
    if (!this.ways) return false;
    const blocking = h > 0.45 && o.solid !== false;
    if (!this.free(room, r, o.margin ?? (blocking ? 0.45 : 0))) return false;
    let spot: [number, number] | null = null;
    if (o.search) {
      const [fx, fz] = FACE[o.search.face];
      spot = [fx > 0 ? r[2] + 0.5 : fx < 0 ? r[0] - 0.5 : (r[0] + r[2]) / 2, fz > 0 ? r[3] + 0.5 : fz < 0 ? r[1] - 0.5 : (r[1] + r[3]) / 2];
      if (!this.standable(room, spot[0], spot[1])) return false;
    }
    const level = this.k.roomById(room).level;
    this.k.furniture(level, r[0], r[1], r[2], r[3], h, mat, { tint: o.tint, search: o.search, solid: o.solid });
    if (o.solid !== false) this.note(room, r);
    if (spot) {
      const list = this.spots.get(room) ?? [];
      list.push(spot);
      this.spots.set(room, list);
    }
    return true;
  }

  /** Something drawn only (chairs, papers) when it fits; no collision. */
  deco(room: number, r: Rect, h: number, mat: MaterialId, tint?: number): void {
    if (!this.ways) return;
    const R = this.k.roomById(room);
    if (r[0] < R.x0 || r[1] < R.z0 || r[2] > R.x1 || r[3] > R.z1) return;
    const y = this.k.levelY(R.level);
    this.k.box(R.level, r[0], y, r[1], r[2], y + h, r[3], mat, { solid: false, tint });
  }

  /** A stain (blood, debris) somewhere in the room. */
  stain(room: number, mat: MaterialId = 'blood', size = 1.2): void {
    if (!this.ways) return;
    const R = this.k.roomById(room);
    const sx = Math.min(size, R.x1 - R.x0 - 0.2);
    const sz = Math.min(size * 0.8, R.z1 - R.z0 - 0.2);
    const x = this.range(R.x0 + 0.1, R.x1 - sx - 0.1);
    const z = this.range(R.z0 + 0.1, R.z1 - sz - 0.1);
    this.k.stain(R.level, x, z, x + sx, z + sz, mat);
  }

  has(room: number): boolean {
    return (this.spots.get(room) ?? []).length > 0;
  }

  /** A search point in the room if it has none yet (a heap of boxes / a body), wherever there is room to stand. */
  ensure(room: number, kind: FurnitureKind = 'crate', table?: LootTableId): void {
    if (!this.ways || this.has(room)) return;
    const R = this.k.roomById(room);
    const ox = this.rand() * 0.4;
    for (let z = R.z0 + 0.45 + ox; z < R.z1 - 0.4; z += 0.4) {
      for (let x = R.x0 + 0.45 + ox; x < R.x1 - 0.4; x += 0.4) {
        if (!this.standable(room, x, z)) continue;
        if ((this.spots.get(room) ?? []).some((s) => Math.hypot(s[0] - x, s[1] - z) < 0.7)) continue;
        this.k.search(R.level, x, z, kind, table);
        this.spots.set(room, [...(this.spots.get(room) ?? []), [x, z]]);
        const y = this.k.levelY(R.level);
        this.k.box(R.level, x - 0.3, y, z - 0.3, x + 0.3, y + 0.25, z + 0.3, 'debris', { solid: false });
        return;
      }
    }
  }

  /**
   * A row of pieces against one wall of the room (`side`: the wall they stand against), from one
   * end to the other, skipping where a way or a door is. Each piece is `len` along the wall and
   * `depth` out from it; `every` pieces gets a search point (facing into the room).
   */
  row(room: number, side: Dir, len: number, depth: number, h: number, mat: MaterialId, o: { tint?: number; kind?: FurnitureKind; table?: LootTableId; every?: number; max?: number; gap?: number; from?: number; to?: number } = {}): number {
    if (!this.ways) return 0;
    const R = this.roomRect(room);
    const alongX = side === 'z-' || side === 'z+';
    const a0 = o.from ?? (alongX ? R[0] : R[1]);
    const a1 = o.to ?? (alongX ? R[2] : R[3]);
    const face = OPP[side];
    let n = 0;
    for (let a = a0 + 0.05; a + len <= a1 - 0.05 && n < (o.max ?? 99); ) {
      const r: Rect = alongX
        ? [a, side === 'z-' ? R[1] : R[3] - depth, a + len, side === 'z-' ? R[1] + depth : R[3]]
        : [side === 'x-' ? R[0] : R[2] - depth, a, side === 'x-' ? R[0] + depth : R[2], a + len];
      const search = o.kind && n % (o.every ?? 1) === 0 ? { kind: o.kind, face, table: o.table } : undefined;
      if (this.put(room, r, h, mat, { tint: o.tint, search }) || (search && this.put(room, r, h, mat, { tint: o.tint }))) {
        n++;
        a += len + (o.gap ?? 0.05);
      } else a += 0.3;
    }
    return n;
  }

  /**
   * Fill the room (or `area`) with a grid of pieces `sx` × `sz` and aisles between them; `make`
   * places one at rect r (return false to leave the cell empty).
   */
  grid(room: number, sx: number, sz: number, ax: number, az: number, make: (r: Rect, i: number, j: number) => boolean, area?: Rect, max = 14): number {
    if (!this.ways) return 0;
    const R = area ?? this.roomRect(room);
    // Aisles between the pieces; against the walls at most half a metre (the ways are checked anyway).
    const nx = Math.max(0, Math.floor((R[2] - R[0] - 2 * Math.min(ax, 0.5) + ax) / (sx + ax)));
    const nz = Math.max(0, Math.floor((R[3] - R[1] - 2 * Math.min(az, 0.5) + az) / (sz + az)));
    const x0 = R[0] + (R[2] - R[0] - nx * sx - (nx - 1) * ax) / 2;
    const z0 = R[1] + (R[3] - R[1] - nz * sz - (nz - 1) * az) / 2;
    let n = 0;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * (sx + ax);
        const z = z0 + j * (sz + az);
        if (n < max && make([x, z, x + sx, z + sz], i, j)) n++;
      }
    }
    return n;
  }
}

// ---------------------------------------------------------------------------------------------
// Stair core
// ---------------------------------------------------------------------------------------------

export interface Core {
  /** Wall centre lines. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Front of the stairwell (the flights climb towards -z from here). */
  zs: number;
  /** Stairwell's inside left edge, its right edge. */
  sx0: number;
  sx1: number;
  /** The hall in front of the stair and the lifts (room rect). */
  hall: Rect;
  shafts: Rect[];
  /** The toilet beside the lifts (room rect), if any. */
  wc: Rect | null;
  lane: number;
}

/**
 * A stair core with its back-left wall centre line at (x0, z0): the switchback stairwell, `shafts`
 * dead lift shafts and an optional toilet in a row behind the hall, the hall in front of them all.
 * The lift shafts are cut through every storey but the roof.
 */
export function coreAt(k: Kit, x0: number, z0: number, o: { shafts?: number; shaftW?: number; hall?: number; wc?: boolean; wcW?: number; lane?: number } = {}): Core {
  const lane = o.lane ?? LANE;
  const sw = 2 * lane + 0.15;
  const L = flightDepth(k.def.storeyHeight, lane);
  const sx0 = x0 + P;
  const sx1 = sx0 + sw;
  const zs = z0 + P + L;
  let cur = sx1;
  const shafts: Rect[] = [];
  for (let i = 0; i < (o.shafts ?? 0); i++) {
    const a = cur + 2 * P;
    shafts.push([a, z0 + P, a + (o.shaftW ?? 2.0), zs - P]);
    cur = a + (o.shaftW ?? 2.0);
  }
  let wc: Rect | null = null;
  if (o.wc) {
    const a = cur + 2 * P;
    wc = [a, z0 + P, a + (o.wcW ?? 1.8), zs - P];
    cur = a + (o.wcW ?? 1.8);
  }
  const x1 = cur + P;
  const z1 = zs + (o.hall ?? 2.2) + P;
  for (const s of shafts) k.shaft(s, 0, k.storeys - 1);
  return { x0, z0, x1, z1, zs, sx0, sx1, hall: [x0 + P, zs, x1 - P, z1 - P], shafts, wc, lane };
}

/** Outer rectangle of a core (wall outside faces). */
export function coreRect(c: Core, thick = 2 * P): Rect {
  return [c.x0 - thick / 2, c.z0 - thick / 2, c.x1 + thick / 2, c.z1 + thick / 2];
}

export function steelDoor(k: Kit, at: number, state: 'open' | 'locked' = 'locked', width?: number): Hole {
  const h = k.door(at, state, width);
  h.leaf = 'doorSteel';
  return h;
}

/**
 * One storey of a core: the flight up (none on the roof), the walls with the front wall's openings
 * (`front`: holes at absolute x), the lift doors (locked) and the toilet's door, the hall room.
 * Returns the hall's room id (and the toilet's when it has one and `wcOpen`).
 */
export function coreLevel(k: Kit, level: number, c: Core, o: { front: { x: number; state: 'open' | 'locked' | 'shutter'; width?: number; steel?: boolean }[]; use?: RoomUse; tint?: number; wcOpen?: boolean; left?: { z: number; state: 'open' | 'locked'; width?: number }[]; right?: { z: number; state: 'open' | 'locked'; width?: number }[] }): { hall: number; wc: number } {
  const mat: MaterialId = 'concrete';
  if (level < k.storeys) {
    k.stairs({ level, start: [c.sx0 + c.lane / 2, c.zs], dir: 'z-', width: c.lane, kind: 'switchback', turn: 'right', mat: 'concrete', tint: o.tint });
  }
  const opts = { mat, tint: o.tint };
  const holes = (list: { at: number; state: 'open' | 'locked' | 'shutter'; width?: number; steel?: boolean }[]): Hole[] =>
    list.map((d) => (d.steel ? steelDoor(k, d.at, d.state === 'open' ? 'open' : 'locked', d.width) : k.door(d.at, d.state, d.width)));
  k.partition(level, c.x0, c.z0, c.x1, c.z0, [], opts);
  k.partition(level, c.x0, c.z0, c.x0, c.z1, holes((o.left ?? []).map((d) => ({ at: d.z - c.z0, state: d.state, width: d.width, steel: true }))), opts);
  k.partition(level, c.x1, c.z0, c.x1, c.z1, holes((o.right ?? []).map((d) => ({ at: d.z - c.z0, state: d.state, width: d.width, steel: true }))), opts);
  k.partition(level, c.x0, c.z1, c.x1, c.z1, holes(o.front.map((d) => ({ at: d.x - c.x0, state: d.state, width: d.width, steel: d.steel }))), opts);
  // Walls between the stairwell, the shafts and the toilet; their fronts on the hall.
  const fronts: Hole[] = [];
  let px = c.sx1 + P;
  for (const s of c.shafts) {
    k.partition(level, px, c.z0, px, c.zs, [], opts);
    fronts.push(steelDoor(k, (s[0] + s[2]) / 2 - c.sx1, 'locked'));
    px = s[2] + P;
  }
  let wc = -1;
  if (c.wc) {
    k.partition(level, px, c.z0, px, c.zs, [], opts);
    const open = o.wcOpen ?? false;
    fronts.push(k.door((c.wc[0] + c.wc[2]) / 2 - c.sx1, open ? 'open' : 'locked'));
    if (open) wc = k.room(level, c.wc[0], c.wc[1], c.wc[2], c.wc[3], 'toilet');
  }
  if (c.shafts.length || c.wc) k.partition(level, c.sx1, c.zs, c.x1, c.zs, fronts, opts);
  const hall = k.room(level, c.hall[0], c.hall[1], c.hall[2], c.hall[3], o.use ?? 'stairs');
  return { hall, wc };
}

/**
 * The core on the roof: a stair house round the whole core (door in its front wall at `doorX`),
 * a machine room over the lift shafts and toilet, a slab on top. Returns the hall's room id.
 * Its parts reach `k.eaves + 2.9`.
 */
export function coreRoof(k: Kit, c: Core, o: { doorX?: number; tint?: number; height?: number } = {}): number {
  const e = k.eaves;
  const h = o.height ?? 2.7;
  const R = k.storeys;
  const t = 0.2;
  const opts = { mat: 'concrete' as const, tint: o.tint, y0: e, y1: e + h, layer: 'shell' as const };
  const [X0, Z0, X1, Z1] = [c.x0 - t / 2, c.z0 - t / 2, c.x1 + t / 2, c.z1 + t / 2];
  k.wall(R, X0, Z1 - t, X1, Z1, [k.door((o.doorX ?? (c.hall[0] + c.hall[2]) / 2) - X0)], opts);
  k.wall(R, X0, Z0, X1, Z0 + t, [], opts);
  k.wall(R, X0, Z0 + t, X0 + t, Z1 - t, [], opts);
  k.wall(R, X1 - t, Z0 + t, X1, Z1 - t, [], opts);
  k.box(-1, X0, e + h, Z0, X1, e + h + 0.2, Z1, 'concrete', { layer: 'shell', tint: o.tint });
  if (c.shafts.length || c.wc) k.box(-1, c.sx1, e, Z0 + t, X1 - t, e + h, c.zs, 'concrete', { layer: 'shell', tint: o.tint });
  const hall = k.room(R, c.hall[0], c.hall[1], c.hall[2], c.hall[3], 'stairs');
  return hall;
}

// ---------------------------------------------------------------------------------------------
// Floor plates
// ---------------------------------------------------------------------------------------------

export interface Ring {
  front?: number;
  back?: number;
  left?: number;
  right?: number;
  all: number[];
}

/**
 * Open floor round a hole (a core): front and back strips the full width, left and right strips
 * between them, joined at the corners. Strips thinner than `min` are left out.
 */
export function ringRooms(k: Kit, level: number, outer: Rect, hole: Rect, use: RoomUse | { front: RoomUse; back: RoomUse; left: RoomUse; right: RoomUse }, o: { locked?: boolean; min?: number } = {}): Ring {
  const min = o.min ?? 0.9;
  const u = typeof use === 'string' ? { front: use, back: use, left: use, right: use } : use;
  const lock = { locked: o.locked };
  const ring: Ring = { all: [] };
  if (outer[3] - hole[3] >= min) ring.front = k.room(level, outer[0], hole[3], outer[2], outer[3], u.front, lock);
  if (hole[1] - outer[1] >= min) ring.back = k.room(level, outer[0], outer[1], outer[2], hole[1], u.back, lock);
  const zs0 = ring.back === undefined ? outer[1] : hole[1];
  const zs1 = ring.front === undefined ? outer[3] : hole[3];
  if (hole[0] - outer[0] >= min) ring.left = k.room(level, outer[0], zs0, hole[0], zs1, u.left, lock);
  if (outer[2] - hole[2] >= min) ring.right = k.room(level, hole[2], zs0, outer[2], zs1, u.right, lock);
  for (const side of [ring.left, ring.right]) {
    if (side === undefined) continue;
    if (ring.front !== undefined) k.join(side, ring.front);
    if (ring.back !== undefined) k.join(side, ring.back);
  }
  ring.all = [ring.front, ring.back, ring.left, ring.right].filter((r): r is number => r !== undefined);
  return ring;
}

// ---------------------------------------------------------------------------------------------
// Facades
// ---------------------------------------------------------------------------------------------

export type Side = 'front' | 'back' | 'left' | 'right';

export interface CurtainSpec {
  side: Side;
  /** Storeys from..to-1; the top band runs from the floor of `to` up to y1 (the parapet). */
  from: number;
  to: number;
  y1: number;
  /** Wall thickness and, optionally, its plane [c0, c1] across (default: the footprint's edge). */
  t: number;
  plane?: [number, number];
  u0?: number;
  u1?: number;
  /** Band from `drop` below each floor to `sill` above it. */
  sill?: number;
  drop?: number;
  mat: MaterialId;
  tint?: number;
  /** Piers (full height) at these positions along the side. */
  piers?: number[];
  pier?: number;
  pierMat?: MaterialId;
  pierTint?: number;
  /** Broken panes: [storey, u0, u1] (a hidden barrier instead of glass). */
  broken?: [number, number, number][];
  /** Sheet material (default glass; an opaque panel for blank walls). */
  sheet?: MaterialId;
}

/** A multi-storey wall: one band per storey, full-height piers and one glass sheet (split only round broken panes). */
export function curtain(k: Kit, o: CurtainSpec): void {
  const { w, d } = k;
  const t = o.t;
  const alongX = o.side === 'front' || o.side === 'back';
  const u0 = o.u0 ?? (alongX ? 0 : t);
  const u1 = o.u1 ?? (alongX ? w : d - t);
  const [c0, c1] = o.plane ?? (o.side === 'front' ? [d - t, d] : o.side === 'back' ? [0, t] : o.side === 'left' ? [0, t] : [w - t, w]);
  const drop = o.drop ?? 0.35;
  const sill = o.sill ?? 0.9;
  const box = (a0: number, a1: number, y0: number, y1: number, mat: MaterialId, b0 = c0, b1 = c1, extra: { hidden?: boolean; tint?: number } = {}): void => {
    if (a1 - a0 < 1e-6 || y1 - y0 < 1e-6) return;
    const opts = { layer: 'shell' as const, tint: extra.tint ?? (mat === o.mat ? o.tint : undefined), hidden: extra.hidden };
    if (alongX) k.box(-1, a0, y0, b0, a1, y1, b1, mat, opts);
    else k.box(-1, b0, y0, a0, b1, y1, a1, mat, opts);
  };
  for (let i = o.from; i < o.to; i++) box(u0, u1, k.levelY(i) - drop, k.levelY(i) + sill, o.mat);
  box(u0, u1, k.levelY(o.to) - drop, o.y1, o.mat);
  const sheet = o.sheet ?? 'glass';
  const pc = (c0 + c1) / 2;
  const pane = sheet === 'glass' ? ARCH.window.pane : Math.min(0.1, c1 - c0);
  const glass = (a0: number, a1: number, y0: number, y1: number, hidden = false): void => box(a0, a1, y0, y1, sheet, pc - pane / 2, pc + pane / 2, { hidden, tint: sheet === 'glass' ? undefined : 0.5 });
  let y = k.levelY(o.from) + sill;
  const broken = [...(o.broken ?? [])].filter((b) => b[0] >= o.from && b[0] < o.to).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const levels = [...new Set(broken.map((b) => b[0]))];
  for (const level of levels) {
    const yb = k.levelY(level) + sill;
    const ye = k.levelY(level + 1) - drop;
    glass(u0, u1, y, yb);
    let a = u0;
    for (const b of broken.filter((q) => q[0] === level)) {
      const b0 = Math.max(a, b[1]);
      const b1 = Math.min(u1, b[2]);
      if (b1 <= b0) continue;
      glass(a, b0, yb, ye);
      glass(b0, b1, yb, ye, true);
      a = b1;
    }
    glass(a, u1, yb, ye);
    y = ye;
  }
  glass(u0, u1, y, k.levelY(o.to) - drop);
  const pw = o.pier ?? 0.4;
  for (const p of o.piers ?? []) {
    const a0 = Math.max(u0, p - pw / 2);
    const a1 = Math.min(u1, p + pw / 2);
    if (a1 - a0 < 1e-6) continue;
    if (alongX) k.box(-1, a0, k.levelY(o.from) - drop, c0, a1, o.y1, c1, o.pierMat ?? o.mat, { layer: 'shell', tint: o.pierTint ?? o.tint });
    else k.box(-1, c0, k.levelY(o.from) - drop, a0, c1, o.y1, a1, o.pierMat ?? o.mat, { layer: 'shell', tint: o.pierTint ?? o.tint });
  }
}

/** Evenly spaced positions from a to b with about `step` between them (both ends included). */
export function spaced(a: number, b: number, step: number): number[] {
  const n = Math.max(1, Math.round((b - a) / step));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

/** Curtain walls on all four sides with the same options (piers every `step`). */
export function curtainAll(k: Kit, o: Omit<CurtainSpec, 'side' | 'piers' | 'broken'> & { step: number; corner?: number; broken?: number }): void {
  const { w, d } = k;
  const t = o.t;
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    const alongX = side === 'front' || side === 'back';
    const [a, b] = alongX ? [0, w] : [t, d - t];
    const piers = spaced(a + (alongX ? (o.corner ?? 0.4) / 2 : 0), b - (alongX ? (o.corner ?? 0.4) / 2 : 0), o.step).filter((p) => alongX || (p > a + 0.3 && p < b - 0.3));
    const broken: [number, number, number][] = [];
    if ((o.broken ?? 0) > 0) {
      for (let i = o.from; i < o.to; i++) {
        if (k.rand() < o.broken!) {
          const j = Math.floor(k.rand() * Math.max(1, piers.length - 1));
          if (piers[j + 1] !== undefined) broken.push([i, piers[j]!, piers[j + 1]!]);
        }
      }
    }
    curtain(k, { ...o, side, piers, broken });
  }
}

// ---------------------------------------------------------------------------------------------
// Roofs
// ---------------------------------------------------------------------------------------------

/** A painted helipad (H in a square) on the roof slab, centred at (cx, cz). Drawn only. */
export function helipad(k: Kit, cx: number, cz: number, size: number): void {
  const e = k.eaves + 0.01;
  const s = size / 2;
  const paint = (x0: number, z0: number, x1: number, z1: number, mat: MaterialId, tint: number, h = 0.012): void => {
    k.box(-1, x0, e, z0, x1, e + h, z1, mat, { layer: 'shell', tint, solid: false });
  };
  paint(cx - s, cz - s, cx + s, cz + s, 'asphalt', 0, 0.01);
  const b = 0.3;
  paint(cx - s, cz - s, cx + s, cz - s + b, 'sign', 0.9);
  paint(cx - s, cz + s - b, cx + s, cz + s, 'sign', 0.9);
  paint(cx - s, cz - s + b, cx - s + b, cz + s - b, 'sign', 0.9);
  paint(cx + s - b, cz - s + b, cx + s, cz + s - b, 'sign', 0.9);
  const hh = s * 0.55;
  const hw = s * 0.38;
  paint(cx - hw, cz - hh, cx - hw + 0.5, cz + hh, 'paper', 0, 0.02);
  paint(cx + hw - 0.5, cz - hh, cx + hw, cz + hh, 'paper', 0, 0.02);
  paint(cx - hw + 0.5, cz - 0.25, cx + hw - 0.5, cz + 0.25, 'paper', 0, 0.02);
}

/** A steel guard rail along the top of the parapet on every side (drawn and solid, inside the footprint). */
export function guardRail(k: Kit, t: number, top: number, h = 0.25): void {
  const { w, d } = k;
  const opts = { layer: 'shell' as const, tint: 0.6 };
  const r = 0.06;
  k.box(-1, t / 2 - r, top, t / 2 - r, w - t / 2 + r, top + h, t / 2 + r, 'steel', opts);
  k.box(-1, t / 2 - r, top, d - t / 2 - r, w - t / 2 + r, top + h, d - t / 2 + r, 'steel', opts);
  k.box(-1, t / 2 - r, top, t / 2 + r, t / 2 + r, top + h, d - t / 2 - r, 'steel', opts);
  k.box(-1, w - t / 2 - r, top, t / 2 + r, w - t / 2 + r, top + h, d - t / 2 - r, 'steel', opts);
}

/** An antenna mast on the roof (solid foot, thin mast drawn and solid). */
export function mast(k: Kit, x: number, z: number, top: number): void {
  const e = k.eaves;
  k.box(-1, x - 0.4, e, z - 0.4, x + 0.4, e + 0.5, z + 0.4, 'concrete', { layer: 'shell', role: 'furniture' });
  k.box(-1, x - 0.08, e + 0.5, z - 0.08, x + 0.08, top, z + 0.08, 'steel', { layer: 'shell' });
  k.box(-1, x - 0.6, top - 1.2, z - 0.03, x + 0.6, top - 1.1, z + 0.03, 'steel', { layer: 'shell', solid: false });
}

/** Roof plant on the roof rooms: AC units, a water tank or cooling tower (one search point), a vent. */
export function roofPlant(f: Fit, rooms: number[], o: { tank?: boolean; units?: number; tint?: number } = {}): void {
  if (!f.live) return;
  const order = [...rooms].sort((a, b) => area(f.roomRect(b)) - area(f.roomRect(a)));
  let tank = o.tank ?? true;
  let units = o.units ?? 3;
  for (const room of order) {
    if (tank) {
      const R = f.roomRect(room);
      for (const side of ['z-', 'x+', 'x-', 'z+'] as const) {
        if (f.row(room, side, 2.4, 1.8, 2.2, 'rust', { kind: 'crate', table: 'roof', max: 1, tint: o.tint }) > 0) {
          tank = false;
          break;
        }
      }
      void R;
    }
    if (units > 0) units -= f.row(room, 'z-', 1.0, 0.7, 0.9, 'appliance', { max: units, gap: 0.2, tint: 0.7 });
    if (units > 0) units -= f.row(room, 'x+', 1.0, 0.7, 0.9, 'appliance', { max: units, gap: 0.2, tint: 0.7 });
  }
}

function area(r: Rect): number {
  return (r[2] - r[0]) * (r[3] - r[1]);
}

// ---------------------------------------------------------------------------------------------
// Another type in the ground floor
// ---------------------------------------------------------------------------------------------

/**
 * Put the ground storey of `sub` (a one-storey blueprint such as shop.konbini_tenant, generated for
 * the slot's size) into a finished building at (dx, dz). The host must leave the slot empty on its
 * ground floor (no walls, rooms or floor there) and have the same plinth and storey height; the
 * sub's roof slab and parapet are dropped (the host's first floor covers the slot). Rooms, links,
 * openings and search points are renumbered and moved.
 */
export function embedGround(host: BuildingBlueprint, sub: BuildingBlueprint, dx: number, dz: number): BuildingBlueprint {
  const top = sub.storeys[0]!.y + sub.storeys[0]!.height - 1e-3;
  const nr = host.rooms.length;
  const no = host.openings.length;
  const mv = <T extends { x0: number; x1: number; z0: number; z1: number }>(o: T): T => ({ ...o, x0: o.x0 + dx, x1: o.x1 + dx, z0: o.z0 + dz, z1: o.z1 + dz });
  const pt = (p: [number, number, number]): [number, number, number] => [p[0] + dx, p[1], p[2] + dz];
  return {
    ...host,
    parts: [...host.parts, ...sub.parts.filter((p) => p.level === 0 || (p.level < 0 && p.y0 < top)).map(mv)],
    openings: [...host.openings, ...sub.openings.filter((o) => o.level === 0).map((o) => ({ ...o, x: o.x + dx, z: o.z + dz }))],
    rooms: [...host.rooms, ...sub.rooms.filter((r) => r.level === 0).map((r) => ({ ...mv(r), id: r.id + nr }))],
    search: [...host.search, ...sub.search.map((s) => ({ ...s, pos: pt(s.pos), room: s.room + nr }))],
    links: [
      ...host.links,
      ...sub.links.map((l) => {
        const out = { ...l, a: l.a < 0 ? -1 : l.a + nr, b: l.b < 0 ? -1 : l.b + nr, pts: l.pts.map(pt) };
        if (l.opening !== undefined) out.opening = l.opening + no;
        return out;
      }),
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Furniture programs
// ---------------------------------------------------------------------------------------------

/** Open office: islands of desks (two facing rows), cabinets along a wall, a copier, papers. */
export function officeDesks(f: Fit, room: number, o: { tint?: number; area?: Rect; dense?: boolean } = {}): void {
  if (!f.live) return;
  const tint = o.tint ?? f.rand();
  let searched = 0;
  f.grid(room, 2.4, 1.4, o.dense ? 1.1 : 1.3, 1.3, (r, i, j) => {
    const want = searched < 2 && (i + j) % 3 === 0;
    const face: Dir = 'z+';
    const ok = f.put(room, r, 0.72, 'wood', { tint, search: want ? { kind: 'desk', face, table: 'office' } : undefined }) || (want && f.put(room, r, 0.72, 'wood', { tint }));
    if (ok) {
      if (want && f.has(room)) searched++;
      f.deco(room, [r[0] + 0.5, r[1] - 0.45, r[0] + 1.0, r[1] - 0.05], 0.45, 'fabric', 0.1);
      if (f.chance(0.3)) f.deco(room, [r[0] + 0.2, r[1] + 0.3, r[0] + 0.8, r[1] + 0.7], 0.76, 'paper');
    }
    return ok;
  }, o.area);
  f.row(room, 'z-', 0.9, 0.45, 1.8, 'steel', { kind: 'cabinet', table: 'office', every: 3, max: 6, tint: 0.7 });
  if (f.chance(0.6)) f.row(room, 'x+', 1.0, 0.6, 1.2, 'appliance', { max: 1, tint: 0.6 }); // copier
}

/** Meeting room: one long table, chairs drawn round it, a cabinet. */
export function meeting(f: Fit, room: number): void {
  if (!f.live) return;
  const R = f.roomRect(room);
  const cx = (R[0] + R[2]) / 2;
  const cz = (R[1] + R[3]) / 2;
  const lx = Math.min(4.8, R[2] - R[0] - 2.6);
  const lz = Math.min(1.4, R[3] - R[1] - 2.6);
  if (lx > 1.0 && lz > 0.8 && f.put(room, [cx - lx / 2, cz - lz / 2, cx + lx / 2, cz + lz / 2], 0.72, 'wood', { tint: 0.2, search: { kind: 'table', face: 'z+', table: 'office' } })) {
    for (let x = cx - lx / 2 + 0.3; x < cx + lx / 2 - 0.3; x += 0.8) {
      f.deco(room, [x, cz - lz / 2 - 0.55, x + 0.45, cz - lz / 2 - 0.1], 0.45, 'fabric', 0.2);
    }
  }
  f.row(room, 'z-', 1.2, 0.45, 1.1, 'woodDark', { kind: 'cabinet', table: 'office', max: 1 });
}

/** Classroom: rows of small desks facing the board on the `board` wall, the teacher's desk. */
export function classroom(f: Fit, room: number, board: Dir): void {
  if (!f.live) return;
  const R = f.roomRect(room);
  const lvl = f.k.roomById(room).level;
  const y = f.k.levelY(lvl);
  // The board: a thin plate on the wall (drawn only).
  const along = board === 'z-' || board === 'z+';
  if (along) {
    const z = board === 'z-' ? R[1] : R[3] - 0.03;
    f.k.box(lvl, R[0] + 1.0, y + 0.9, z, R[2] - 1.0, y + 2.1, z + 0.03, 'sign', { solid: false, tint: 0.1 });
  } else {
    const x = board === 'x-' ? R[0] : R[2] - 0.03;
    f.k.box(lvl, x, y + 0.9, R[1] + 1.0, x + 0.03, y + 2.1, R[3] - 1.0, 'sign', { solid: false, tint: 0.1 });
  }
  const inset: Rect = board === 'z-' ? [R[0], R[1] + 1.8, R[2], R[3]] : board === 'z+' ? [R[0], R[1], R[2], R[3] - 1.8] : board === 'x-' ? [R[0] + 1.8, R[1], R[2], R[3]] : [R[0], R[1], R[2] - 1.8, R[3]];
  let first = true;
  f.grid(room, along ? 1.2 : 0.5, along ? 0.5 : 1.2, 0.6, 0.6, (r) => {
    const ok = f.put(room, r, 0.7, 'wood', { tint: 0.6, search: first ? { kind: 'desk', face: OPP[board], table: 'classroom' } : undefined }) || f.put(room, r, 0.7, 'wood', { tint: 0.6 });
    if (ok && f.has(room)) first = false;
    return ok;
  }, inset, 36);
  // Teacher's desk by the board.
  const td: Rect = board === 'z-' ? [(R[0] + R[2]) / 2 - 0.7, R[1] + 0.5, (R[0] + R[2]) / 2 + 0.7, R[1] + 1.2] : board === 'z+' ? [(R[0] + R[2]) / 2 - 0.7, R[3] - 1.2, (R[0] + R[2]) / 2 + 0.7, R[3] - 0.5] : board === 'x-' ? [R[0] + 0.5, (R[1] + R[3]) / 2 - 0.7, R[0] + 1.2, (R[1] + R[3]) / 2 + 0.7] : [R[2] - 1.2, (R[1] + R[3]) / 2 - 0.7, R[2] - 0.5, (R[1] + R[3]) / 2 + 0.7];
  f.put(room, td, 0.75, 'wood', { tint: 0.3, search: { kind: 'desk', face: OPP[board], table: 'classroom' } });
  f.ensure(room, 'desk', 'classroom');
}

/** Exam / treatment room: bed, medicine cabinet, the doctor's desk. */
export function clinicRoom(f: Fit, room: number): void {
  if (!f.live) return;
  for (const side of ['x+', 'x-', 'z-'] as const) if (f.row(room, side, 1.9, 0.9, 0.65, 'fabric', { max: 1, tint: 0.95 })) break;
  for (const side of ['z-', 'x-', 'x+', 'z+'] as const) if (f.row(room, side, 1.0, 0.45, 1.8, 'steel', { kind: 'cabinet', table: 'pharmacy', max: 1, tint: 0.95 })) break;
  for (const side of ['z+', 'x-', 'x+'] as const) if (f.row(room, side, 1.2, 0.6, 0.72, 'wood', { kind: 'desk', table: 'clinic', max: 1, tint: 0.7 })) break;
  if (f.chance(0.4)) f.stain(room);
  f.ensure(room, 'cabinet', 'clinic');
}

/** Waiting room: benches in rows, a magazine rack. */
export function waiting(f: Fit, room: number, table: LootTableId = 'lobby'): void {
  if (!f.live) return;
  f.grid(room, 2.2, 0.55, 1.4, 1.1, (r) => f.put(room, r, 0.45, 'fabric', { tint: 0.4 }), undefined, 10);
  f.row(room, 'x-', 1.0, 0.35, 1.3, 'shelf', { kind: 'shelf', table, max: 1, tint: 0.5 });
  f.ensure(room, 'shelf', table);
}

/** Sales floor: gondolas in rows (shelf search points), a register counter by the wall. */
export function salesFloor(f: Fit, room: number, o: { tables?: LootTableId[]; tint?: number; along?: 'x' | 'z'; h?: number; counter?: boolean } = {}): void {
  if (!f.live) return;
  const tables = o.tables ?? ['sales'];
  const tint = o.tint ?? f.rand();
  let i = 0;
  const along = o.along ?? 'x';
  f.grid(room, along === 'x' ? 2.6 : 0.9, along === 'x' ? 0.9 : 2.6, 1.4, 1.4, (r) => {
    const table = tables[i % tables.length]!;
    const ok = f.put(room, r, o.h ?? 1.5, 'shelf', { tint, search: { kind: 'shelf', face: along === 'x' ? 'z+' : 'x+', table } }) || f.put(room, r, o.h ?? 1.5, 'shelf', { tint });
    if (ok) i++;
    return ok;
  }, undefined, 24);
  if (o.counter !== false) f.row(room, 'x-', 2.0, 0.6, 1.0, 'counter', { kind: 'counter', table: 'sales', max: 1, tint });
  f.ensure(room, 'shelf', tables[0]);
}

/** Store room: racks along the walls, crates. */
export function storeRoom(f: Fit, room: number, table: LootTableId = 'storage'): void {
  if (!f.live) return;
  f.row(room, 'z-', 1.8, 0.6, 2.0, 'shelf', { kind: 'shelf', table, every: 2, max: 4 });
  f.row(room, 'x+', 1.8, 0.6, 2.0, 'shelf', { kind: 'shelf', table, every: 2, max: 3 });
  f.grid(room, 1.0, 1.0, 1.4, 1.4, (r) => f.chance(0.35) && f.put(room, r, 0.9, 'wood', { tint: 0.4, search: { kind: 'crate', face: 'z+', table } }));
  f.ensure(room, 'crate', table);
}

/** Canteen / restaurant: tables with chairs drawn round them, a counter. */
export function canteen(f: Fit, room: number, o: { tint?: number; counter?: boolean; max?: number } = {}): void {
  if (!f.live) return;
  const tint = o.tint ?? f.rand();
  f.grid(room, 1.2, 0.8, 1.3, 1.3, (r) => {
    const ok = f.put(room, r, 0.72, 'wood', { tint });
    if (ok) {
      f.deco(room, [r[0] + 0.2, r[1] - 0.5, r[0] + 0.6, r[1] - 0.1], 0.45, 'wood', 0.3);
      f.deco(room, [r[2] - 0.6, r[3] + 0.1, r[2] - 0.2, r[3] + 0.5], 0.45, 'wood', 0.3);
    }
    return ok;
  }, undefined, o.max ?? 14);
  if (o.counter !== false) f.row(room, 'z-', 2.4, 0.7, 0.95, 'counter', { kind: 'counter', table: 'canteen', max: 1, tint });
  f.ensure(room, 'counter', 'canteen');
}

/** Kitchen: counters and a fridge along the walls. */
export function kitchen(f: Fit, room: number): void {
  if (!f.live) return;
  f.row(room, 'z-', 1.8, 0.7, 0.9, 'counter', { kind: 'counter', table: 'kitchen', every: 2, max: 4, tint: 0.1 });
  f.row(room, 'x+', 0.8, 0.7, 1.9, 'appliance', { kind: 'fridge', table: 'kitchen', max: 1 });
  f.ensure(room, 'counter', 'kitchen');
}

/** Bar / snack: a counter with stools drawn in front, a bottle shelf on the wall. */
export function barRoom(f: Fit, room: number, tint = f.rand()): void {
  if (!f.live) return;
  for (const side of ['z-', 'x+', 'x-'] as const) if (f.row(room, side, 0.5, 2.6, 1.9, 'shelf', { max: 1, tint })) break;
  const R = f.roomRect(room);
  const z = R[1] + 1.4;
  const len = Math.min(4.2, R[2] - R[0] - 1.8);
  if (len > 1.2 && f.put(room, [R[0] + 0.9, z, R[0] + 0.9 + len, z + 0.55], 1.05, 'counter', { tint: 0.2, search: { kind: 'counter', face: 'z-', table: 'bar' } })) {
    for (let x = R[0] + 1.1; x < R[0] + 0.7 + len; x += 0.7) f.deco(room, [x, z + 0.7, x + 0.32, z + 1.02], 0.7, 'steel', 0.2);
  }
  f.grid(room, 1.6, 0.6, 1.2, 1.2, (r) => f.chance(0.5) && f.put(room, r, 0.75, 'fabric', { tint: 0.1 }), [R[0], z + 1.8, R[2], R[3]]);
  f.ensure(room, 'counter', 'bar');
}

/** Karaoke box / private room: an L of sofa, a low table, a screen on the wall. */
export function karaoke(f: Fit, room: number): void {
  if (!f.live) return;
  const R = f.roomRect(room);
  f.row(room, 'z-', Math.min(2.6, R[2] - R[0] - 0.6), 0.65, 0.8, 'fabric', { max: 1, tint: f.rand() });
  const cx = (R[0] + R[2]) / 2;
  const cz = R[1] + 1.6;
  f.put(room, [cx - 0.6, cz - 0.35, cx + 0.6, cz + 0.35], 0.45, 'wood', { tint: 0.1, search: { kind: 'table', face: 'x+', table: 'bar' } });
  f.ensure(room, 'table', 'bar');
}

/** Barricade: desks and chairs piled against a wall of the room near (x, z) (solid, but clear of the ways). */
export function barricade(f: Fit, room: number, x: number, z: number, along: 'x' | 'z'): void {
  if (!f.live) return;
  const r: Rect = along === 'x' ? [x - 1.0, z - 0.4, x + 1.0, z + 0.4] : [x - 0.4, z - 1.0, x + 0.4, z + 1.0];
  if (!f.put(room, r, 0.75, 'wood', { tint: 0.5 })) return;
  const y = f.k.levelY(f.k.roomById(room).level);
  const lvl = f.k.roomById(room).level;
  f.k.box(lvl, r[0] + 0.2, y + 0.75, r[1] + 0.05, r[2] - 0.3, y + 1.45, r[3] - 0.1, 'wood', { tint: 0.3, solid: false });
  f.k.box(lvl, r[0] + 0.5, y + 1.45, r[1] + 0.15, r[0] + 1.0, y + 1.9, r[3] - 0.2, 'fabric', { tint: 0.1, solid: false });
}

/** A piece of furniture lying on its side (low, solid) somewhere it does not block. */
export function toppled(f: Fit, room: number, mat: MaterialId = 'steel'): void {
  if (!f.live) return;
  f.grid(room, 1.8, 0.5, 1.0, 1.0, (r) => f.chance(0.08) && f.put(room, r, 0.45, mat, { tint: f.rand(), margin: 0.45 }));
}

// ---------------------------------------------------------------------------------------------
// Drivers: a stair strip along one side wall, a tower round a central core
// ---------------------------------------------------------------------------------------------

/** The switchback in a strip along the left or right outer wall, climbing towards the back (its front at zs). */
export function stripStair(k: Kit, level: number, side: 'left' | 'right', t: number, zs: number, o: { lane?: number; tint?: number; mat?: MaterialId } = {}): void {
  const lane = o.lane ?? LANE;
  const x = side === 'left' ? t + lane / 2 : k.w - t - lane / 2;
  k.stairs({ level, start: [x, zs], dir: 'z-', width: lane, kind: 'switchback', turn: side === 'left' ? 'right' : 'left', mat: o.mat ?? 'concrete', tint: o.tint });
}

/**
 * Flat roof over a building with a stair strip: the slab, the stair house over the strip's back
 * (door in its front wall), its walls rising from the parapet, and the roof rooms round it.
 * `xs` is the strip's inner edge (inside face), `zh` the stair house's front (outside face).
 */
export function stripRoof(k: Kit, side: 'left' | 'right', t: number, xs: number, zs: number, zh: number, o: { tint?: number; mat?: MaterialId; parapet?: number } = {}): Ring {
  const { w, d } = k;
  const e = k.eaves;
  const R = k.storeys;
  const mat = o.mat ?? 'concrete';
  const ph = o.parapet ?? ARCH.rail.parapet;
  k.roofFlat({ mat: 'concrete', tint: o.tint });
  const opts = { mat, tint: o.tint, y0: e, y1: e + 2.7, layer: 'shell' as const };
  const [hx0, hx1] = side === 'left' ? [0, xs + t] : [xs - t, w];
  const doorAt = side === 'left' ? (t + xs) / 2 : (xs + w - t) / 2;
  k.wall(R, hx0, zh - t, hx1, zh, [k.door(doorAt - hx0)], opts);
  if (side === 'left') k.wall(R, xs, t, xs + t, zh - t, [], opts);
  else k.wall(R, xs - t, t, xs, zh - t, [], opts);
  k.box(-1, hx0, e + ph, 0, hx1, e + 2.7, t, mat, { layer: 'shell', tint: o.tint });
  if (side === 'left') k.box(-1, 0, e + ph, t, t, e + 2.7, zh - t, mat, { layer: 'shell', tint: o.tint });
  else k.box(-1, w - t, e + ph, t, w, e + 2.7, zh - t, mat, { layer: 'shell', tint: o.tint });
  k.box(-1, hx0, e + 2.7, 0, hx1, e + 2.9, zh, 'concrete', { layer: 'shell', tint: o.tint });
  if (side === 'left') k.room(R, t, zs, xs, zh - t, 'stairs');
  else k.room(R, xs, zs, w - t, zh - t, 'stairs');
  void d;
  return ringRooms(k, R, [t, t, w - t, d - t], [hx0, 0, hx1, zh], 'roof');
}

export interface TowerSpec {
  /** Outer wall thickness (k.thick). */
  t: number;
  shafts: number;
  wc?: boolean;
  hall?: number;
  /** Centre of the core (default: the middle of the footprint). */
  cx?: number;
  cz?: number;
  tint: number;
  floorMat?: (level: number) => MaterialId;
  /** Which storeys can be entered (the rest: the stair hall's door is locked). */
  open: (level: number) => boolean;
  /** Fill an open storey round the core (rooms and furniture); `hole` is the core's outside. */
  plate: (level: number, c: Core, hole: Rect, hall: number) => void;
  /** Width of the hall's door to the floor. */
  doorW?: (level: number) => number;
  /** Furniture seen through the glass on a locked storey (the same on every one: drawn only). */
  stamp?: (level: number, rects: Rect[]) => void;
}

/**
 * A tower round a central core: every storey gets the core (stair, dead lifts, toilet, hall);
 * open storeys are filled by `plate`, locked ones get a locked open floor (and a barricade in the
 * hall now and then). Returns the core. The facade and the roof are the caller's.
 */
export function towerFloors(k: Kit, f: Fit, s: TowerSpec): Core {
  const { w, d } = k;
  const t = s.t;
  k.thick = t;
  const L = flightDepth(k.def.storeyHeight);
  const hall = s.hall ?? 2.2;
  const coreW = 2 * P + SW + s.shafts * (2 * P + 2.0) + (s.wc ? 2 * P + 1.8 : 0);
  const coreD = 2 * P + L + hall;
  const c = coreAt(k, (s.cx ?? w / 2) - coreW / 2, (s.cz ?? d / 2) - coreD / 2, { shafts: s.shafts, wc: s.wc, hall });
  const hole = coreRect(c);
  const outer: Rect = [t, t, w - t, d - t];
  for (let level = 0; level < k.storeys; level++) {
    k.floor(level, s.floorMat?.(level) ?? (level === 0 ? 'tileFloor' : 'carpet'));
    const open = s.open(level);
    const { hall: h, wc } = coreLevel(k, level, c, { front: [{ x: (c.hall[0] + c.hall[2]) / 2, state: open ? 'open' : 'locked', width: s.doorW?.(level) ?? 1.2, steel: !open }], tint: s.tint, wcOpen: open && s.wc });
    if (wc >= 0) {
      f.row(wc, 'z-', 0.6, 0.5, 0.85, 'appliance', { kind: 'cabinet', table: 'toilet', max: 1, tint: 0.9 });
      f.ensure(wc, 'cabinet', 'toilet');
    }
    if (open) {
      s.plate(level, c, hole, h);
      continue;
    }
    // Nobody gets onto a locked storey: no rooms there, only what is seen through the glass.
    s.stamp?.(level, ringRects(outer, hole));
    if (f.chance(0.3)) barricade(f, h, (c.hall[0] + c.hall[2]) / 2 + 1.4, c.hall[3] - 0.45, 'x');
    if (f.chance(0.25)) f.stain(h);
  }
  return c;
}

/** The front and back strips of an open floor round a hole (what ringRooms would make of them). */
export function ringRects(outer: Rect, hole: Rect): Rect[] {
  const out: Rect[] = [];
  if (outer[3] - hole[3] >= 0.9) out.push([outer[0], hole[3], outer[2], outer[3]]);
  if (hole[1] - outer[1] >= 0.9) out.push([outer[0], outer[1], outer[2], hole[1]]);
  return out;
}

/** Desks seen through the glass of a locked storey: the same few boxes on each (drawn only). */
export function stampDesks(k: Kit, level: number, rects: Rect[], tint: number): void {
  const y = k.levelY(level);
  for (const r of rects) {
    const n = Math.max(1, Math.floor((r[2] - r[0] - 2) / 4.5));
    for (let i = 0; i < n; i++) {
      const x = r[0] + 1.5 + i * 4.5;
      const z = (r[1] + r[3]) / 2 - 0.7;
      k.box(level, x, y, z, x + 2.4, y + 0.75, z + 1.4, 'wood', { tint, solid: false });
    }
  }
}

export interface UnitSlot {
  level: number;
  /** Room rect (inside faces). */
  rect: Rect;
  /** Which side the corridor is on, seen from the unit (the unit is entered towards -entry). */
  entry: Dir;
  /** Door centre along the corridor wall (absolute x or z). */
  door: number;
  side: Side;
  index: number;
}

/**
 * A ring corridor round a core (front and back corridors the full width, left and right ones
 * beside the core) and units off it: `front` / `back` units in a row along those walls, one unit on
 * each side beside the side corridors. `fill` makes each unit's rooms and returns its door (state,
 * width, and `at` to move the door along the wall). Returns the corridor rooms.
 */
export function corridorPlate(k: Kit, level: number, o: {
  outer: Rect; hole: Rect; cw: number; front: number; back: number; sides: boolean;
  fill: (u: UnitSlot) => { state: 'open' | 'locked' | 'shutter'; width?: number; at?: number };
  corridorUse?: RoomUse;
}): Ring {
  const [X0, Z0, X1, Z1] = o.outer;
  const [h0, h1, h2, h3] = o.hole;
  const cw = o.cw;
  const use = o.corridorUse ?? 'hall';
  const zf = h3 + cw + P; // front units' wall
  const zb = h1 - cw - P; // back units' wall
  const xl = h0 - cw - P; // left unit's wall
  const xr = h2 + cw + P; // right unit's wall
  const ring: Ring = { all: [] };
  ring.front = k.room(level, X0, h3, X1, zf - P, use);
  ring.back = k.room(level, X0, zb + P, X1, h1, use);
  ring.left = k.room(level, xl + P, h1, h0, h3, use);
  ring.right = k.room(level, h2, h1, xr - P, h3, use);
  for (const s of [ring.left, ring.right]) {
    k.join(s, ring.front);
    k.join(s, ring.back);
  }
  ring.all = [ring.front, ring.back, ring.left, ring.right];
  const row = (side: 'front' | 'back', n: number): void => {
    const z0 = side === 'front' ? zf + P : Z0;
    const z1 = side === 'front' ? Z1 : zb - P;
    const step = (X1 - X0) / n;
    const doors: Hole[] = [];
    for (let i = 0; i < n; i++) {
      const a = X0 + i * step + (i > 0 ? P : 0);
      const b = X0 + (i + 1) * step - (i < n - 1 ? P : 0);
      if (i > 0) k.partition(level, X0 + i * step, z0, X0 + i * step, z1);
      const at = i % 2 === 0 ? a + 0.8 : b - 0.8;
      const r = o.fill({ level, rect: [a, z0, b, z1], entry: side === 'front' ? 'z-' : 'z+', door: at, side, index: i });
      const hole = r.state === 'shutter' ? k.door((r.at ?? (a + b) / 2) - X0, 'shutter', r.width ?? Math.min(2.6, b - a - 0.8)) : k.door((r.at ?? at) - X0, r.state, r.width);
      doors.push(hole);
    }
    k.partition(level, X0, side === 'front' ? zf : zb, X1, side === 'front' ? zf : zb, doors);
  };
  row('front', o.front);
  row('back', o.back);
  for (const side of ['left', 'right'] as const) {
    const x0 = side === 'left' ? X0 : xr + P;
    const x1 = side === 'left' ? xl - P : X1;
    const wx = side === 'left' ? xl : xr;
    // The unit is closed off from the front and back corridors.
    k.partition(level, side === 'left' ? x0 : x0 - P, h3 - P, side === 'left' ? x1 + P : x1, h3 - P);
    k.partition(level, side === 'left' ? x0 : x0 - P, h1 + P, side === 'left' ? x1 + P : x1, h1 + P);
    if (!o.sides || x1 - x0 < 2.0) {
      k.room(level, x0, h1 + 2 * P, x1, h3 - 2 * P, 'storage', { locked: true });
      k.partition(level, wx, h1 + P, wx, h3 - P);
      continue;
    }
    const at = (h1 + h3) / 2;
    const r = o.fill({ level, rect: [x0, h1 + 2 * P, x1, h3 - 2 * P], entry: side === 'left' ? 'x+' : 'x-', door: at, side, index: 0 });
    k.partition(level, wx, h1 + P, wx, h3 - P, [k.door((r.at ?? at) - (h1 + P), r.state === 'shutter' ? 'shutter' : r.state, r.width)]);
  }
  return ring;
}
