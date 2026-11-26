// 09b: steps up to the doors of enterable buildings on sloping ground.
//
// A building's ground level is the highest ground under its footprint (builder.ts addEnterable), so
// on a slope the low side of its ground slab stands above the ground: a door there was a wall of up
// to a few metres that neither the player nor the zombies could climb (their step-up is 0.5 m).
// After everything else of an area is laid out, every way in from outside is walked on paper — from
// the room out along the door's line — and where the way meets a drop of more than DOORSTEPS.over a
// landing and a flight of steps (rise DOORSTEPS.rise, never more than DOORSTEPS.last to the ground)
// are added as plain 'stair' solids: the same boxes collide (sim/tactical/collision.ts) and are drawn
// (render/tactical/buildings.ts). The flight runs straight out, or along the wall when something
// stands in the way. The placement keeps the way up (BuildingPlacement.steps) and the building's nav
// links start at the foot of the steps (gen/buildings detailOf), so zombies come up them too.

import { DOORSTEPS } from '../data/architecture.ts';
import { TACTICAL } from '../data/tactical.ts';
import { DOOR_RING, hAt, heightRange, type Builder } from './builder.ts';
import { blueprintOf, buildingDef, localColliders, openBlueprint, toWorld, type BuildingPlacement, type DoorSteps } from './buildings/index.ts';
import type { LocalCollider } from './buildings/colliders.ts';
import { trunkRadius, type Solid } from './types.ts';

const D = DOORSTEPS;
const SIZE = TACTICAL.size;
const CELL = 16;
const GN = Math.ceil(SIZE / CELL);

interface Index {
  solids: number[][];
  /** The clear ground at the foot of the flights made so far (world rectangles): nothing is built on it. */
  feet: Rects;
  /** Trees (their index) and rocks (-1 - index) taken out because nothing else let a door have its steps. */
  felled: Set<number>;
  trees: number[][];
  rocks: number[][];
}

const cellOf = (v: number): number => Math.min(GN - 1, Math.max(0, Math.floor(v / CELL)));

function addSolid(ix: Index, s: Solid, i: number): void {
  for (let cz = cellOf(s.z0); cz <= cellOf(s.z1); cz++) for (let cx = cellOf(s.x0); cx <= cellOf(s.x1); cx++) ix.solids[cz * GN + cx]!.push(i);
}

function indexOf(b: Builder): Index {
  const ix: Index = { feet: new Rects(), felled: new Set(), solids: Array.from({ length: GN * GN }, () => []), trees: Array.from({ length: GN * GN }, () => []), rocks: Array.from({ length: GN * GN }, () => []) };
  b.solids.forEach((s, i) => addSolid(ix, s, i));
  for (let i = 0; i < b.trees.length / 5; i++) ix.trees[cellOf(b.trees[i * 5 + 1]!) * GN + cellOf(b.trees[i * 5]!)]!.push(i);
  b.rocks.forEach((r, i) => ix.rocks[cellOf(r.z) * GN + cellOf(r.x)]!.push(i));
  return ix;
}

/** World rectangles with an owner (placement, link), bucketed like the solids: the fronts of the doors, the feet of the flights. */
class Rects {
  private list: [number, number, number, number, number, number][] = [];
  private cells: number[][] = Array.from({ length: GN * GN }, () => []);
  add(x0: number, z0: number, x1: number, z1: number, enter: number, link: number): void {
    const i = this.list.length;
    this.list.push([x0, z0, x1, z1, enter, link]);
    for (let cz = cellOf(z0); cz <= cellOf(z1); cz++) for (let cx = cellOf(x0); cx <= cellOf(x1); cx++) this.cells[cz * GN + cx]!.push(i);
  }
  /** Does a rectangle of someone else's (not this placement's link; link -1: anyone's) overlap this one? */
  hit(x0: number, z0: number, x1: number, z1: number, enter: number, link: number): boolean {
    for (let cz = cellOf(z0); cz <= cellOf(z1); cz++) {
      for (let cx = cellOf(x0); cx <= cellOf(x1); cx++) {
        for (const i of this.cells[cz * GN + cx]!) {
          const g = this.list[i]!;
          if (g[4] === enter && g[5] === link) continue;
          if (g[2] > x0 + 0.02 && g[0] < x1 - 0.02 && g[3] > z0 + 0.02 && g[1] < z1 - 0.02) return true;
        }
      }
    }
    return false;
  }
}

/** A box of the flight in the building's local frame. */
interface Box {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  top: number;
}

/** Lowest ground (above the placement's base) under a local rectangle. */
function groundMin(b: Builder, p: BuildingPlacement, x0: number, z0: number, x1: number, z1: number): number {
  let lo = Infinity;
  const q: [number, number] = [0, 0];
  for (let j = 0; j <= 2; j++) {
    for (let i = 0; i <= 2; i++) {
      toWorld(p, x0 + ((x1 - x0) * i) / 2, z0 + ((z1 - z0) * j) / 2, q);
      const h = hAt(b, q[0], q[1]) - p.base;
      if (h < lo) lo = h;
    }
  }
  return lo;
}

/** Is the world rectangle (between heights y0 and y1) free of other things and inside the map? (A door on a canal gets steps down to the water.) */
function free(b: Builder, ix: Index, self: number, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, fell: number[] | null = null): boolean {
  if (x0 < 1 || z0 < 1 || x1 > SIZE - 1 || z1 > SIZE - 1) {
    doorStepsDebug.why = 'the edge of the area';
    return false;
  }
  for (let cz = cellOf(z0 - 1); cz <= cellOf(z1 + 1); cz++) {
    for (let cx = cellOf(x0 - 1); cx <= cellOf(x1 + 1); cx++) {
      const c = cz * GN + cx;
      for (const si of ix.solids[c]!) {
        const s = b.solids[si]!;
        if (si === self || s.x1 <= x0 || s.x0 >= x1 || s.z1 <= z0 || s.z0 >= z1 || s.y1 <= y0 + 0.05 || s.y0 >= y1) continue;
        // A bridge's envelope covers the banks under it; its own boxes are what stands there.
        if (s.enter !== undefined && b.placements[s.enter]?.span) continue;
        if (doorStepsDebug.log) doorStepsDebug.why = `${s.kind}${s.enter !== undefined ? ` ${b.placements[s.enter]!.def}` : ''} at ${s.x0.toFixed(1)},${s.z0.toFixed(1)}..${s.x1.toFixed(1)},${s.z1.toFixed(1)} y ${s.y0.toFixed(1)}..${s.y1.toFixed(1)}`;
        return false;
      }
      for (const ti of ix.trees[c]!) {
        const tx = b.trees[ti * 5]!;
        const tz = b.trees[ti * 5 + 1]!;
        const r = trunkRadius(b.trees[ti * 5 + 2]!) + 0.35;
        if (ix.felled.has(ti) || !(tx > x0 - r && tx < x1 + r && tz > z0 - r && tz < z1 + r)) continue;
        // `fell`: the trees in the way are noted (to be taken out) instead of stopping the flight.
        if (!fell) {
          doorStepsDebug.why = 'a tree';
          return false;
        }
        fell.push(ti);
      }
      for (const ri of ix.rocks[c]!) {
        const k = b.rocks[ri]!;
        const r = k.r * 0.72;
        if (ix.felled.has(-1 - ri) || !(k.x + r > x0 && k.x - r < x1 && k.z + r > z0 && k.z - r < z1)) continue;
        if (!fell) {
          doorStepsDebug.why = 'a rock';
          return false;
        }
        fell.push(-1 - ri);
      }
    }
  }
  return true;
}

interface Flight {
  boxes: Box[];
  /** Local waypoints from the foot to the landing (x, height above base, z). */
  way: [number, number, number][];
  /** Local rectangle of everything, the clear ground at the foot included. */
  rect: [number, number, number, number];
  low: number;
  /** The clear ground at the foot and its height. */
  footRect: [number, number, number, number];
  footY: number;
}

/**
 * A flight from the edge of a drop at local (ex, ez) (the last point on top), top height `up`,
 * leading out along (nx, nz): `turn` 0 straight out, ±1 along the wall to that side.
 */
function flight(b: Builder, p: BuildingPlacement, ex: number, ez: number, nx: number, nz: number, up: number, width: number, turn: -1 | 0 | 1, fit: 0 | 1 | 2): Flight | null {
  // Where the usual flight does not fit (a small yard): steeper steps and less room at the foot; as a
  // last resort steps as steep as a ship's ladder.
  const tight = fit > 0;
  const going = fit === 2 ? D.steepGoing : tight ? D.tightGoing : D.going;
  const footLen = tight ? D.tightFoot : D.foot;
  // Unit vector along the wall.
  const tx = -nz;
  const tz = nx;
  const rect = (o0: number, o1: number, s0: number, s1: number): [number, number, number, number] => {
    const ax = ex + nx * o0 + tx * s0;
    const az = ez + nz * o0 + tz * s0;
    const bx = ex + nx * o1 + tx * s1;
    const bz = ez + nz * o1 + tz * s1;
    return [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)];
  };
  const hw = width / 2;
  // Straight out the flight comes up to the door itself (its top step is deeper); along the wall it starts from a landing.
  const depth = turn === 0 ? 0 : tight ? D.tightSide : D.sideWidth;
  const boxes: Box[] = [];
  let low = Infinity;
  if (turn !== 0) {
    const landing = rect(0, depth, -hw, hw);
    boxes.push({ x0: landing[0], z0: landing[1], x1: landing[2], z1: landing[3], top: up });
    low = groundMin(b, p, landing[0], landing[1], landing[2], landing[3]);
  }
  let top = up;
  let k = 0;
  // Strip i of the flight (straight out the first one is `topGoing` deep).
  const at = (i: number): number => (i <= 0 ? 0 : D.topGoing + (i - 1) * going);
  const region = (i: number): [number, number, number, number] => (turn === 0 ? rect(at(i), at(i + 1), -hw, hw) : rect(0, depth, turn * (hw + i * going), turn * (hw + (i + 1) * going)));
  for (;;) {
    const r = region(k);
    // Where the next step down lands: this strip and the ground just past it.
    const r2 = region(k + 1);
    const g = Math.min(groundMin(b, p, r[0], r[1], r[2], r[3]), groundMin(b, p, r2[0], r2[1], r2[2], r2[3]));
    low = Math.min(low, g);
    if (top - g <= D.last) break;
    if (++k > D.maxSteps) return null;
    top -= D.rise;
    boxes.push({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], top });
  }
  // Clear ground at the foot.
  const run = turn === 0 ? at(k) : k * going;
  const end = turn === 0 ? rect(0, run + footLen, -hw, hw) : rect(0, depth, turn < 0 ? -(hw + run + footLen) : -hw, turn < 0 ? hw : hw + run + footLen);
  const mid = depth / 2;
  const footO = turn === 0 ? run + footLen * 0.5 : mid;
  const footS = turn === 0 ? 0 : turn * (hw + run + footLen * 0.5);
  const fx = ex + nx * footO + tx * footS;
  const fz = ez + nz * footO + tz * footS;
  const q = toWorld(p, fx, fz);
  const way: [number, number, number][] = [[fx, hAt(b, q[0], q[1]) - p.base, fz]];
  // The top of a flight along the wall: on the landing, in line with the flight.
  if (turn !== 0) way.push([ex + nx * mid, up, ez + nz * mid]);
  const footRect = turn === 0 ? rect(run, run + footLen, -hw, hw) : rect(0, depth, turn * (hw + run), turn * (hw + run + footLen));
  return { boxes, way, rect: end, low, footRect: [footRect[0], footRect[1], footRect[2], footRect[3]], footY: way[0]![1] };
}

/** The top surface a walker finds at a local point, no higher than `cap`: the ground or one of the building's own boxes. */
function surface(b: Builder, p: BuildingPlacement, cols: readonly LocalCollider[], x: number, z: number, cap: number): number {
  const q = toWorld(p, x, z);
  let s = hAt(b, q[0], q[1]) - p.base;
  for (const c of cols) if (!c.pane && x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && c.y1 > s && c.y1 <= cap) s = c.y1;
  return s;
}

/** Lift a building (its placement, its envelope, what was put on it) by `dy`. */
function reseat(b: Builder, p: BuildingPlacement, self: number, dy: number): void {
  const old = p.base;
  p.base += dy;
  const bd = b.buildings[p.building];
  if (bd) bd.base += dy;
  b.solids.forEach((s, i) => {
    if (i === self || (s.enter === undefined && s.ref === p.building && s.kind !== 'rock' && s.kind !== 'scenery')) {
      s.y0 += dy;
      s.y1 += dy;
    }
  });
  for (const v of b.vantages) if (v.pos[0] >= p.x0 && v.pos[0] <= p.x1 && v.pos[2] >= p.z0 && v.pos[2] <= p.z1 && v.pos[1] >= old + 1) v.pos[1] += dy;
  for (const l of b.ladders) {
    if (l.x1 < p.x0 - 1 || l.x0 > p.x1 + 1 || l.z1 < p.z0 - 1 || l.z0 > p.z1 + 1) continue;
    l.y1 += dy;
  }
}

/** Tools: set `log` to hear why a door got no steps (every flight tried and what stood in its way). */
export const doorStepsDebug: { log?: (line: string) => void; why?: string } = {};

let enabled = true;
/** Tools and tests: generate areas without door steps (tools/real/doors.ts --before measures what they fix). */
export function setDoorSteps(on: boolean): void {
  enabled = on;
}

/**
 * Add the door steps of every enterable building of the area. Call when everything else is placed
 * (the flights keep clear of the other solids, the trees and the rocks).
 */
export function addDoorSteps(b: Builder): number {
  if (!enabled || b.placements.length === 0) return 0;
  const ix = indexOf(b);
  let made = 0;
  // First every building: seated on the ground as it is now, the ground in front of its doors noted
  // (the flights of other doors, its own and its neighbours', keep clear of it).
  interface Job {
    p: BuildingPlacement;
    enter: number;
    self: number;
    w: number;
    d: number;
    doors: ([number, number, number][] | null)[];
    widths: number[];
    /** The building's boxes, kept when a door may need steps. */
    cols: LocalCollider[] | null;
  }
  const jobs: Job[] = [];
  /** World squares in front of the doors. */
  const fronts = new Rects();
  const envelope = new Map<number, number>();
  b.solids.forEach((s, i) => {
    if (s.enter !== undefined) envelope.set(s.enter, i);
  });
  b.placements.forEach((p, enter) => {
    if (p.span || p.building < 0) return;
    const def = buildingDef(p.def);
    if (def.exteriorOnly) return;
    const self = envelope.get(enter) ?? -1;
    // A level lot needs nothing: no ground under and round the footprint is lower than a step under the
    // floor, none is above the building's ground level (the blueprint, a quarter of a millisecond each,
    // is not made: most of a town on a plain).
    const [lo, hi] = heightRange(b, p.x0 - D.probe, p.z0 - D.probe, p.x1 + D.probe, p.z1 + D.probe);
    if (p.base + def.plinth - lo <= D.over - D.levelMargin && hi - p.base <= D.buried) return;
    const bp = openBlueprint(blueprintOf(p), true);
    const doors = bp.links.map((l) => {
      if ((l.a !== -1 && l.b !== -1) || l.kind === 'ladder') return null;
      const pts = l.a === -1 ? l.pts : [...l.pts].reverse();
      return pts[pts.length - 1]![1] > D.maxFloor ? null : pts;
    });
    if (!doors.some((q) => q !== null)) return;
    // Earthworks laid after the building (a bridge's ramp, a graded road) may have raised the ground
    // over a door: the building is seated again on the ground as it is now.
    let over = 0;
    let low = Infinity;
    for (const pts of doors) {
      if (!pts) continue;
      const w = toWorld(p, pts[0]![0], pts[0]![2]);
      over = Math.max(over, hAt(b, w[0], w[1]) - p.base);
    }
    if (over > D.buried) {
      const small = Math.max(p.x1 - p.x0, p.z1 - p.z0) <= TACTICAL.openSite;
      const to = small ? Math.max(p.base + over, heightRange(b, p.x0 - DOOR_RING, p.z0 - DOOR_RING, p.x1 + DOOR_RING, p.z1 + DOOR_RING)[1]) : p.base + over;
      reseat(b, p, self, to - p.base);
    }
    doors.forEach((pts, li) => {
      if (!pts) return;
      const w = toWorld(p, pts[0]![0], pts[0]![2]);
      fronts.add(w[0] - D.front, w[1] - D.front, w[0] + D.front, w[1] + D.front, enter, li);
      low = Math.min(low, pts[pts.length - 1]![1]);
    });
    // Boxes kept only where the ground under the footprint is low enough for some door to need steps (with a margin: the range is sampled).
    const need = low + p.base - heightRange(b, p.x0 - D.probe, p.z0 - D.probe, p.x1 + D.probe, p.z1 + D.probe)[0] > D.over - 0.25;
    jobs.push({ p, enter, self, w: bp.w, d: bp.d, doors, widths: bp.links.map((l) => l.width), cols: need ? localColliders(bp) : null });
  });
  // Then the flights.
  for (const job of jobs) {
    const { p, enter, self, doors } = job;
    const cols = job.cols;
    if (!cols) continue;
    const bp = { w: job.w, d: job.d };
    doors.forEach((pts, li) => {
      if (!pts) return;
      const l = { width: job.widths[li]! };
      const o = pts[0]!;
      const q = pts[1]!;
      const floor = pts[pts.length - 1]![1];
      let nx = o[0] - q[0];
      let nz = o[2] - q[2];
      const len = Math.hypot(nx, nz);
      if (len < 1e-6 || Math.min(Math.abs(nx), Math.abs(nz)) > 0.01 * len) return; // not along an axis
      nx = Math.round(nx / len);
      nz = Math.round(nz / len);
      // Cheap way out: flat ground all along the way.
      // As far as just past the footprint (a porch or a small yard inside it; not across a whole site).
      const reach = len + (nx > 0 ? bp.w - o[0] : nx < 0 ? o[0] : nz > 0 ? bp.d - o[2] : o[2]);
      const out = Math.min(Math.max(len, reach), len + D.yard) + D.probe;
      {
        let lo = Infinity;
        for (let t = 0; t <= out; t += 0.25) {
          const w0 = toWorld(p, q[0] + nx * t, q[2] + nz * t);
          lo = Math.min(lo, hAt(b, w0[0], w0[1]) - p.base);
        }
        if (floor - lo <= D.over) return;
      }
      // Walk out from the room: the outermost drop over the limit.
      const dt = 0.05;
      const n = Math.ceil(out / dt);
      let prev = surface(b, p, cols, q[0], q[2], floor + 0.05);
      let edge = -1;
      let up = 0;
      for (let k = 1; k <= n; k++) {
        const s = surface(b, p, cols, q[0] + nx * k * dt, q[2] + nz * k * dt, prev + 0.05);
        if (prev - s > D.over) {
          edge = k - 1;
          up = prev;
        }
        prev = s;
      }
      if (edge < 0) return;
      const ex = q[0] + nx * edge * dt;
      const ez = q[2] + nz * edge * dt;
      let best: Flight | null = null;
      // Straight out before along the wall, as wide as the door and a little more before as narrow as a
      // walker needs (between the posts of a canopy, in an alcove); the usual steps before the steeper ones.
      const wide = Math.max(D.minWidth, l.width + D.widen);
      const mid = Math.min(l.width, D.minWidth);
      const tries: [0 | 1 | -1, number, 0 | 1 | 2][] = [];
      for (const fit of [0, 1, 2] as const) {
        for (const turn of [0, 1, -1] as const) {
          for (const width of fit === 0 ? [wide, mid, D.narrow] : fit === 1 ? [mid, D.narrow] : [D.narrow]) tries.push([turn, width, fit]);
        }
      }
      // A second round takes out the trees and rocks in the way (a tree planted right in front of a door).
      let felled: number[] = [];
      for (const [turn, width, fit, cut] of [...tries.map((t) => [...t, false] as const), ...tries.map((t) => [...t, true] as const)]) {
        {
          const fell: number[] | null = cut ? [] : null;
          const say = (why: string): void => doorStepsDebug.log?.(`${p.def} at ${p.x0.toFixed(1)},${p.z0.toFixed(1)} link ${li} drop ${up.toFixed(2)}: ${turn === 0 ? 'straight' : turn > 0 ? 'right' : 'left'} ${width.toFixed(1)} m fit ${fit}${cut ? ' felling' : ''}: ${why}`);
          const f = flight(b, p, ex, ez, nx, nz, up, width, turn, fit);
          if (!f) {
            say('too long');
            continue;
          }
          // Clear of this building's own boxes over each step and the ground at the foot (posts, fences,
          // walls; a kerb a walker steps over does not count). The flight starts a few centimetres inside
          // the edge it leaves: the wall the door is in does not count either.
          const [rx0, rz0, rx1, rz1] = f.rect;
          const m = 0.12;
          const clip = (r: readonly [number, number, number, number]): [number, number, number, number] => [nx > 0 ? Math.max(r[0], ex + m) : r[0], nz > 0 ? Math.max(r[1], ez + m) : r[1], nx < 0 ? Math.min(r[2], ex - m) : r[2], nz < 0 ? Math.min(r[3], ez - m) : r[3]];
          const hits = (r: readonly [number, number, number, number], top: number): boolean => {
            const [ox0, oz0, ox1, oz1] = clip(r);
            return cols.some((c) => c.x1 > ox0 + 0.02 && c.x0 < ox1 - 0.02 && c.z1 > oz0 + 0.02 && c.z0 < oz1 - 0.02 && c.y1 > top + D.over && c.y0 < top + 1.8);
          };
          if (f.boxes.some((q) => hits([q.x0, q.z0, q.x1, q.z1], q.top)) || hits(f.footRect, f.footY)) {
            say('its own boxes');
            continue;
          }
          // ...and of everything else.
          const a = toWorld(p, rx0, rz0);
          const c = toWorld(p, rx1, rz1);
          if (!free(b, ix, self, Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1]), p.base + f.low, p.base + up + 1.8, fell)) {
            say(doorStepsDebug.why ?? '?');
            continue;
          }
          // No step on the clear ground at the foot of another flight (two feet may share ground), nor in front of another door.
          if (f.boxes.some((q) => {
            const u = toWorld(p, q.x0, q.z0);
            const v = toWorld(p, q.x1, q.z1);
            const bx0 = Math.min(u[0], v[0]);
            const bz0 = Math.min(u[1], v[1]);
            const bx1 = Math.max(u[0], v[0]);
            const bz1 = Math.max(u[1], v[1]);
            return ix.feet.hit(bx0, bz0, bx1, bz1, -1, -1) || fronts.hit(bx0, bz0, bx1, bz1, enter, li);
          })) {
            say('the foot of another flight or the front of another door');
            continue;
          }
          {
            // Nor does it come down in front of another door.
            const u = toWorld(p, f.footRect[0], f.footRect[1]);
            const v = toWorld(p, f.footRect[2], f.footRect[3]);
            const fx0 = Math.min(u[0], v[0]);
            const fz0 = Math.min(u[1], v[1]);
            const fx1 = Math.max(u[0], v[0]);
            const fz1 = Math.max(u[1], v[1]);
            if (fronts.hit(fx0, fz0, fx1, fz1, enter, li)) {
              say('comes down in front of another door');
              continue;
            }
          }
          best = f;
          felled = fell ?? [];
        }
        if (best) break;
      }
      if (!best) return;
      for (const ti of felled) ix.felled.add(ti);
      for (const box of best.boxes) {
        const a = toWorld(p, box.x0, box.z0);
        const c = toWorld(p, box.x1, box.z1);
        const x0 = Math.min(a[0], c[0]);
        const z0 = Math.min(a[1], c[1]);
        const x1 = Math.max(a[0], c[0]);
        const z1 = Math.max(a[1], c[1]);
        const lo = groundMin(b, p, box.x0, box.z0, box.x1, box.z1);
        const s: Solid = { x0, z0, x1, z1, y0: p.base + Math.min(lo - D.sunk, box.top - D.thick), y1: p.base + box.top, kind: 'stair', ref: p.building };
        addSolid(ix, s, b.solids.length);
        b.solids.push(s);
      }
      {
        const a = toWorld(p, best.footRect[0], best.footRect[1]);
        const c = toWorld(p, best.footRect[2], best.footRect[3]);
        ix.feet.add(Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1]), enter, li);
      }
      const steps: DoorSteps = {
        link: li,
        pts: best.way.map((v) => {
          const w = toWorld(p, v[0], v[2]);
          return [w[0], p.base + v[1], w[1]];
        }),
      };
      (p.steps ??= []).push(steps);
      made++;
    });
  }
  if (ix.felled.size > 0) {
    const kept: number[] = [];
    for (let i = 0; i < b.trees.length / 5; i++) if (!ix.felled.has(i)) kept.push(b.trees[i * 5]!, b.trees[i * 5 + 1]!, b.trees[i * 5 + 2]!, b.trees[i * 5 + 3]!, b.trees[i * 5 + 4]!);
    b.trees = kept;
    b.rocks = b.rocks.filter((_, i) => !ix.felled.has(-1 - i));
  }
  return made;
}
