// Finding the way through enterable buildings (07d). The 4 m nav grid of 03-06 cannot show rooms,
// so every building has its own small graph — rooms joined by doors, archways and stairs
// (BuildingBlueprint.links). A zombie chasing the player into (or out of) a building follows it:
// room by room, through the doors that are open and wide enough for it, up and down the stairs.
// Only buildings near the player are planned in (TACTICAL.interior.routeRange); the blueprints are
// generated on first use (gen/buildings detailOf).
//
//   whereIs(map, x, y, z)                   the building and room a point is in
//   indoorStep(map, z, radius, target)      next waypoint for a zombie on its way to `target`, or null
//   indoorPath(map, from, to, radius)       the whole list of waypoints (survivors at home, tests)

import { TACTICAL } from '../../data/tactical.ts';
import { ARCH } from '../../data/architecture.ts';
import { detailOf, roomAtWorld, type BuildingDetail } from '../../gen/buildings/index.ts';
import type { TacticalMap } from '../../gen/index.ts';
import type { Vec3 } from './collision.ts';

const I = TACTICAL.interior;

export interface Where {
  /** TacticalMap.placements index. */
  enter: number;
  det: BuildingDetail;
  /** Room (-1: inside the footprint but in no room — a doorway, a stair, a wall). */
  room: number;
}

/** The enterable building whose footprint holds (x, z) at feet height y, and the room there. */
export function whereIs(map: TacticalMap, x: number, y: number, z: number): Where | null {
  if (map.placements.length === 0) return null;
  const hash = map.hash;
  const cx = Math.min(hash.n - 1, Math.max(0, Math.floor(x / hash.cell)));
  const cz = Math.min(hash.n - 1, Math.max(0, Math.floor(z / hash.cell)));
  for (const si of hash.solids[cz * hash.n + cx]!) {
    const s = map.solids[si]!;
    if (s.enter === undefined || x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1 || y < s.y0 || y > s.y1 + 1) continue;
    const det = detailOf(map.placements[s.enter]!);
    return { enter: s.enter, det, room: roomAtWorld(det, x, y, z) };
  }
  return null;
}

/** Links of a building that someone of this radius can use, as adjacency: room -> [link index, forward?]. */
function graph(det: BuildingDetail, radius: number): Map<number, [number, boolean][]> {
  const need = radius * 2 + ARCH.doorSlack;
  const key = Math.round(need * 100);
  let byNeed = graphs.get(det);
  if (!byNeed) graphs.set(det, (byNeed = new Map()));
  let g = byNeed.get(key);
  if (g) return g;
  g = new Map();
  det.links.forEach((l, i) => {
    if (l.width < need) return;
    const a = g!.get(l.a) ?? [];
    a.push([i, true]);
    g!.set(l.a, a);
    const b = g!.get(l.b) ?? [];
    b.push([i, false]);
    g!.set(l.b, b);
  });
  byNeed.set(key, g);
  return g;
}
const graphs = new WeakMap<BuildingDetail, Map<number, Map<number, [number, boolean][]>>>();

/**
 * Fewest links from room `from` to room `to` (-1 = outside), a step outside counting
 * `outsideCost` extra between two rooms (07d-2d: big buildings with several doors would otherwise
 * route out of one door and in at another, straight through their own walls).
 */
export function roomRoute(det: BuildingDetail, from: number, to: number, radius: number): [number, boolean][] | null {
  if (from === to) return [];
  const g = graph(det, radius);
  const prev = new Map<number, [number, number, boolean]>();
  const cost = new Map<number, number>([[from, 0]]);
  const done = new Set<number>();
  for (;;) {
    let cur = NaN;
    let best = Infinity;
    for (const [room, c] of cost) if (!done.has(room) && c < best) [cur, best] = [room, c];
    if (Number.isNaN(cur) || cur === to) break;
    done.add(cur);
    for (const [li, fwd] of g.get(cur) ?? []) {
      const l = det.links[li]!;
      const next = fwd ? l.b : l.a;
      if (done.has(next)) continue;
      const c = best + 1 + (next === -1 && to !== -1 ? I.outsideCost : 0);
      if (c < (cost.get(next) ?? Infinity)) {
        cost.set(next, c);
        prev.set(next, [cur, li, fwd]);
      }
    }
  }
  if (!cost.has(to)) return null;
  const out: [number, boolean][] = [];
  for (let c = to; c !== from; ) {
    const [p, li, fwd] = prev.get(c)!;
    out.push([li, fwd]);
    c = p;
  }
  return out.reverse();
}

function waypoints(det: BuildingDetail, li: number, fwd: boolean): [number, number, number][] {
  const pts = det.links[li]!.wpts;
  return fwd ? pts : [...pts].reverse();
}

/**
 * The next point to walk to along a link's waypoints, from where the walker is: the first one it
 * has neither reached nor got past (past = ahead of it on the way to the next, close to the line).
 */
function along(pts: readonly [number, number, number][], pos: Readonly<Vec3>): [number, number, number] {
  let i = 0;
  while (i < pts.length - 1) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const ax = pos[0] - a[0];
    const az = pos[2] - a[2];
    const at = Math.hypot(ax, az) <= I.reach && Math.abs(a[1] - pos[1]) <= I.reachY;
    const sx = b[0] - a[0];
    const sz = b[2] - a[2];
    const len = Math.hypot(sx, sz);
    const ahead = len > 1e-6 ? (ax * sx + az * sz) / len : 0;
    const side = len > 1e-6 ? Math.abs(ax * sz - az * sx) / len : Math.hypot(ax, az);
    // On the way between a and b (the height between theirs, give or take a step).
    const lo = Math.min(a[1], b[1]) - 0.4;
    const hi = Math.max(a[1], b[1]) + 0.4;
    const between = ahead > 0 && ahead < len + I.reach && side < I.reach && pos[1] > lo && pos[1] < hi;
    if (!at && !between) break;
    i++;
  }
  return pts[i]!;
}

export interface IndoorWalker {
  pos: [number, number, number];
  inside?: number;
  room?: number;
}

function track(map: TacticalMap, w: IndoorWalker): Where | null {
  const here = whereIs(map, w.pos[0], w.pos[1], w.pos[2]);
  if (!here) {
    delete w.inside;
    delete w.room;
    return null;
  }
  if (here.room >= 0) {
    w.inside = here.enter;
    w.room = here.room;
  } else if (w.inside === here.enter && w.room !== undefined) {
    here.room = w.room; // in a doorway or on the stairs: still on the way from the last room
  } else {
    w.inside = here.enter;
    // Inside the walls without a room: the nearest room on this floor.
    here.room = roomAtWorld(here.det, w.pos[0], w.pos[1], w.pos[2], 1.5);
    if (here.room >= 0) w.room = here.room;
  }
  return here;
}

/**
 * Where a walker of this radius should head next to get to `target` when buildings are in the way
 * (into the target's building through a door, out of its own, between floors), or null when it
 * can simply walk at the target (same room, both outside, too far away, or no way through).
 */
export function indoorStep(map: TacticalMap, w: IndoorWalker, radius: number, target: Readonly<Vec3>): [number, number, number] | null {
  const zw = track(map, w);
  const tw = whereIs(map, target[0], target[1], target[2]);
  if (!zw && !tw) return null;
  if (tw && tw.room < 0) tw.room = roomAtWorld(tw.det, target[0], target[1], target[2], 1.5);
  let det: BuildingDetail;
  let from: number;
  let to: number;
  if (zw) {
    det = zw.det;
    from = zw.room;
    to = tw && tw.enter === zw.enter ? tw.room : -1;
    if (from < 0) return null;
  } else {
    det = tw!.det;
    const p = det.place;
    const dx = Math.max(p.x0 - w.pos[0], 0, w.pos[0] - p.x1);
    const dz = Math.max(p.z0 - w.pos[2], 0, w.pos[2] - p.z1);
    if (Math.hypot(dx, dz) > I.doorApproach) return null;
    from = -1;
    to = tw!.room;
  }
  if (from === to) return null;
  const route = roomRoute(det, from, to, radius);
  if (!route || route.length === 0) return null;
  const [li, fwd] = route[0]!;
  const pts = waypoints(det, li, fwd);
  const next = along(pts, w.pos);
  // From outside to a door on the far side: round the building's corners, not into its back wall.
  return from === -1 && next === pts[0] ? around(det, w.pos, next, radius) : next;
}

/** Next point on the way from p to q outside a building's footprint (a rectangle): q itself, or the corner to go round first. */
function around(det: BuildingDetail, p: Readonly<Vec3>, q: [number, number, number], radius: number): [number, number, number] {
  const pl = det.place;
  const m = radius + 0.6;
  const x0 = pl.x0 - m;
  const z0 = pl.z0 - m;
  const x1 = pl.x1 + m;
  const z1 = pl.z1 + m;
  // Does the straight line cross the footprint (shrunk a little, so that a door point on its edge does not count)?
  const s = 0.05;
  // 09b: a way in that starts inside the footprint (a porch, a yard, the foot of door steps along the
  // wall): from the side it opens to, straight at it; from elsewhere, round to that side first.
  const target = q;
  if (q[0] > pl.x0 + s && q[0] < pl.x1 - s && q[2] > pl.z0 + s && q[2] < pl.z1 - s) {
    const d = [q[2] - pl.z0, pl.x1 - q[0], pl.z1 - q[2], q[0] - pl.x0]; // to the N, E, S, W edges
    const e = d.indexOf(Math.min(...d));
    const beyond = e === 0 ? p[2] <= pl.z0 + s : e === 1 ? p[0] >= pl.x1 - s : e === 2 ? p[2] >= pl.z1 - s : p[0] <= pl.x0 + s;
    if (beyond) return target;
    q = e === 0 ? [q[0], q[1], z0] : e === 1 ? [x1, q[1], q[2]] : e === 2 ? [q[0], q[1], z1] : [x0, q[1], q[2]];
    if (!segmentCrossesRect(p[0], p[2], q[0], q[2], pl.x0 + s, pl.z0 + s, pl.x1 - s, pl.z1 - s)) return [q[0], p[1], q[2]];
  } else if (!segmentCrossesRect(p[0], p[2], q[0], q[2], pl.x0 + s, pl.z0 + s, pl.x1 - s, pl.z1 - s)) return q;
  // Corners clockwise from the north-west, and the position of a point along that perimeter.
  const corners: [number, number][] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const per = 2 * (x1 - x0 + z1 - z0);
  const posOf = (x: number, z: number): number => {
    const cx = Math.min(x1, Math.max(x0, x));
    const cz = Math.min(z1, Math.max(z0, z));
    const d = [cz - z0, x1 - cx, z1 - cz, cx - x0]; // distance to the N, E, S, W edges
    const e = d.indexOf(Math.min(...d));
    if (e === 0) return cx - x0;
    if (e === 1) return x1 - x0 + (cz - z0);
    if (e === 2) return x1 - x0 + (z1 - z0) + (x1 - cx);
    return 2 * (x1 - x0) + (z1 - z0) + (z1 - cz);
  };
  const a = posOf(p[0], p[2]);
  const b = posOf(q[0], q[2]);
  const cw = (b - a + per) % per;
  const marks = [0, x1 - x0, x1 - x0 + (z1 - z0), 2 * (x1 - x0) + (z1 - z0)];
  // The first corner met going the shorter way.
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < 4; i++) {
    const d = cw <= per / 2 ? (marks[i]! - a + per) % per : (a - marks[i]! + per) % per;
    if (d > 0.3 && d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const c = corners[best]!;
  return [c[0], p[1], c[1]];
}

function segmentCrossesRect(ax: number, az: number, bx: number, bz: number, x0: number, z0: number, x1: number, z1: number): boolean {
  // Liang–Barsky clipping.
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const clip = (pp: number, qq: number): boolean => {
    if (Math.abs(pp) < 1e-12) return qq >= 0;
    const r = qq / pp;
    if (pp < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dz, az - z0) && clip(dz, z1 - az) && t0 < t1;
}

/**
 * All the waypoints from `from` to `to` (feet positions) through the buildings they are in, for
 * someone of this radius — or null when there is no way. Points outside are joined straight.
 */
export function indoorPath(map: TacticalMap, from: Readonly<Vec3>, to: Readonly<Vec3>, radius: number): [number, number, number][] | null {
  const a = whereIs(map, from[0], from[1], from[2]);
  const b = whereIs(map, to[0], to[1], to[2]);
  const out: [number, number, number][] = [];
  const add = (det: BuildingDetail, r0: number, r1: number): boolean => {
    const route = roomRoute(det, r0, r1, radius);
    if (!route) return false;
    for (const [li, fwd] of route) out.push(...waypoints(det, li, fwd));
    return true;
  };
  const roomOf = (w: Where, p: Readonly<Vec3>): number => (w.room >= 0 ? w.room : roomAtWorld(w.det, p[0], p[1], p[2], 1.5));
  if (a && b && a.enter === b.enter) {
    if (!add(a.det, roomOf(a, from), roomOf(b, to))) return null;
  } else {
    if (a && !add(a.det, roomOf(a, from), -1)) return null;
    if (b && !add(b.det, -1, roomOf(b, to))) return null;
  }
  out.push([to[0], to[1], to[2]]);
  return out;
}

/** Is the player (or any point) inside an enterable building within the routing range of `p`? */
export function routeRelevant(map: TacticalMap, p: Readonly<Vec3>, q: Readonly<Vec3>): boolean {
  return Math.hypot(p[0] - q[0], p[2] - q[2]) < I.routeRange;
}
