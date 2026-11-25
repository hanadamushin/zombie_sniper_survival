// Static-world queries shared by the player (03), bullets and zombies (04) and the defence layer (06).
// Everything here is a pure function of a TacticalMap; nothing touches GameState.
//
//   heightAt(map, x, z)                       terrain height
//   isWalkable(map, tx, ty)                   4 m nav tile
//   raycastWorld(map, origin, dir, maxDist)   first hit on terrain / buildings / stairs / rocks / trunks
//   segmentHitsStatic(map, a, b)              bullet / hard line-of-sight segment test
//   sightBlocked(map, a, b)                   can a not see b? (the above, plus hedges, reeds, thickets)
//   supportAt(map, x, z, feetY, stepUp)       what a walker at (x, z) stands on
//   pushOut(map, pos, radius, feetY, height)  keep a circle out of walls and trunks
//   createSpatialHash()                       16 m buckets for dynamic objects (zombies, survivors)

import { TACTICAL } from '../../data/tactical.ts';
import { sampleGradient, sampleHeight, TRUNK_SHARE, trunkRadius, type Ladder, type Solid, type SolidKind, type TacticalMap } from '../../gen/index.ts';
import { detailOf, type BuildingDetail } from '../../gen/buildings/index.ts';

export type Vec3 = [number, number, number];

export function heightAt(map: TacticalMap, x: number, z: number): number {
  return sampleHeight(map.height, map.n, map.tile, x, z);
}

/**
 * R0: depth of the water at (x, z) above the ground (0 where dry): the sea, rivers and lakes of a
 * real area (map.water). The nearest height sample with water decides the surface. L9: `feetY`
 * (where someone stands, a bridge's deck) counts as the ground when it is higher.
 */
export function waterDepthAt(map: TacticalMap, x: number, z: number, feetY?: number): number {
  const W = map.water;
  if (!W) return 0;
  const ix = Math.min(map.n - 1, Math.max(0, Math.round(x / map.tile)));
  const iz = Math.min(map.n - 1, Math.max(0, Math.round(z / map.tile)));
  const level = W[iz * map.n + ix]!;
  if (!Number.isFinite(level)) return 0;
  // L9: someone standing higher (on a bridge's deck over the shore) is not in the water.
  const ground = heightAt(map, x, z);
  return Math.max(0, level - (feetY === undefined ? ground : Math.max(ground, feetY)));
}

/** Terrain gradient (dh/dx, dh/dz) at (x, z). */
export function gradientAt(map: TacticalMap, x: number, z: number, out: [number, number]): [number, number] {
  return sampleGradient(map.height, map.n, map.tile, x, z, out);
}

/** Nav tile test; tiles outside the map are not walkable. */
export function isWalkable(map: TacticalMap, tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < map.tiles && ty < map.tiles && map.walk[ty * map.tiles + tx] === 1;
}

export interface RayHit {
  /** Distance along the (normalised) direction. */
  dist: number;
  pos: Vec3;
  normal: Vec3;
  kind: 'terrain' | 'tree' | SolidKind;
  /** Index into map.solids / map.trees, or -1 for terrain. */
  index: number;
}

/**
 * First intersection of a ray with the static world within maxDist, or null.
 * The ray ends where it leaves the playable square.
 */
export function raycastWorld(map: TacticalMap, origin: Readonly<Vec3>, dir: Readonly<Vec3>, maxDist: number): RayHit | null {
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (len === 0 || maxDist <= 0) return null;
  const dx = dir[0] / len;
  const dy = dir[1] / len;
  const dz = dir[2] / len;
  const [ox, oy, oz] = origin;
  const S = map.size;

  // Clip to the map square.
  let t0 = 0;
  let t1 = maxDist;
  for (const [o, d] of [[ox, dx], [oz, dz]] as const) {
    if (Math.abs(d) < 1e-12) {
      if (o < 0 || o > S) return null;
    } else {
      const a = (0 - o) / d;
      const b = (S - o) / d;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
  }
  if (t0 > t1) return null;

  let best = t1;
  let kind: RayHit['kind'] | null = null;
  let index = -1;
  let nx = 0;
  let ny = 1;
  let nz = 0;

  // --- solids and tree trunks: walk the 16 m hash cells along the ray ---
  const hash = map.hash;
  const cs = hash.cell;
  const hn = hash.n;
  const sx = ox + dx * t0;
  const sz = oz + dz * t0;
  let cx = Math.min(hn - 1, Math.max(0, Math.floor(sx / cs)));
  let cz = Math.min(hn - 1, Math.max(0, Math.floor(sz / cs)));
  const stepX = dx > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const invX = Math.abs(dx) > 1e-12 ? 1 / dx : Infinity;
  const invY = Math.abs(dy) > 1e-12 ? 1 / dy : Infinity;
  const invZ = Math.abs(dz) > 1e-12 ? 1 / dz : Infinity;
  let tMaxX = invX === Infinity ? Infinity : t0 + ((dx > 0 ? (cx + 1) * cs : cx * cs) - sx) * invX;
  let tMaxZ = invZ === Infinity ? Infinity : t0 + ((dz > 0 ? (cz + 1) * cs : cz * cs) - sz) * invZ;
  const tDeltaX = Math.abs(cs * invX);
  const tDeltaZ = Math.abs(cs * invZ);
  let tCell = t0;
  const trees = map.trees;
  while (tCell <= best && cx >= 0 && cz >= 0 && cx < hn && cz < hn) {
    const c = cz * hn + cx;
    for (const si of hash.solids[c]!) {
      const s = map.solids[si]!;
      // Slab test.
      let tn = t0;
      let tf = best;
      let axis = -1;
      let a = (s.x0 - ox) * invX;
      let b = (s.x1 - ox) * invX;
      if (invX === Infinity) {
        if (ox < s.x0 || ox > s.x1) continue;
      } else {
        if (a > b) [a, b] = [b, a];
        if (a > tn) { tn = a; axis = 0; }
        if (b < tf) tf = b;
      }
      if (invY === Infinity) {
        if (oy < s.y0 || oy > s.y1) continue;
      } else {
        a = (s.y0 - oy) * invY;
        b = (s.y1 - oy) * invY;
        if (a > b) [a, b] = [b, a];
        if (a > tn) { tn = a; axis = 1; }
        if (b < tf) tf = b;
      }
      if (invZ === Infinity) {
        if (oz < s.z0 || oz > s.z1) continue;
      } else {
        a = (s.z0 - oz) * invZ;
        b = (s.z1 - oz) * invZ;
        if (a > b) [a, b] = [b, a];
        if (a > tn) { tn = a; axis = 2; }
        if (b < tf) tf = b;
      }
      if (tn > tf || tn >= best) continue;
      if (s.enter !== undefined) {
        // 07d: an enterable building — the ray goes on inside it, against its own walls and floors.
        const hit = rayDetail(detailOfSolid(map, s), ox, oy, oz, dx, dy, dz, invX, invY, invZ, tn, Math.min(tf, best));
        if (!hit) continue;
        best = hit.t;
        kind = hit.kind;
        index = si;
        nx = hit.axis === 0 ? -stepX : 0;
        ny = hit.axis === 1 ? (dy > 0 ? -1 : 1) : 0;
        nz = hit.axis === 2 ? -stepZ : 0;
        if (hit.axis === -1) ny = 1;
        continue;
      }
      best = tn;
      kind = s.kind;
      index = si;
      nx = axis === 0 ? -stepX : 0;
      ny = axis === 1 ? (dy > 0 ? -1 : 1) : 0;
      nz = axis === 2 ? -stepZ : 0;
      if (axis === -1) ny = 1; // started inside the box
    }
    const h2 = dx * dx + dz * dz;
    if (h2 > 1e-12) {
      for (const ti of hash.trees[c]!) {
        // Vertical cylinder: 2D circle, then the height range of the bare trunk.
        const r = trunkRadius(trees.h[ti]!);
        const px = ox - trees.x[ti]!;
        const pz = oz - trees.z[ti]!;
        const bq = px * dx + pz * dz;
        const cq = px * px + pz * pz - r * r;
        const disc = bq * bq - h2 * cq;
        if (disc < 0) continue;
        const t = (-bq - Math.sqrt(disc)) / h2;
        if (t < t0 || t >= best) continue;
        const y = oy + dy * t;
        if (y < trees.y[ti]! - 0.5 || y > trees.y[ti]! + trees.h[ti]! * TRUNK_SHARE) continue;
        best = t;
        kind = 'tree';
        index = ti;
        nx = (px + dx * t) / r;
        ny = 0;
        nz = (pz + dz * t) / r;
      }
    }
    if (tMaxX < tMaxZ) {
      tCell = tMaxX;
      tMaxX += tDeltaX;
      cx += stepX;
    } else {
      tCell = tMaxZ;
      tMaxZ += tDeltaZ;
      cz += stepZ;
    }
  }

  // --- terrain: march, then bisect the crossing ---
  const step = map.tile / 2;
  let prev = t0;
  if (oy + dy * t0 < heightAt(map, sx, sz)) {
    best = t0;
    kind = 'terrain';
    index = -1;
  } else {
    for (let t = t0 + step; prev < best; t += step) {
      const tt = Math.min(t, best);
      if (oy + dy * tt < heightAt(map, ox + dx * tt, oz + dz * tt)) {
        let lo = prev;
        let hi = tt;
        for (let i = 0; i < 16; i++) {
          const mid = (lo + hi) / 2;
          if (oy + dy * mid < heightAt(map, ox + dx * mid, oz + dz * mid)) hi = mid;
          else lo = mid;
        }
        best = hi;
        kind = 'terrain';
        index = -1;
        break;
      }
      prev = tt;
    }
  }
  if (kind === null) return null;
  const pos: Vec3 = [ox + dx * best, oy + dy * best, oz + dz * best];
  if (kind === 'terrain') {
    const g = gradientAt(map, pos[0], pos[2], [0, 0]);
    const inv = 1 / Math.hypot(g[0], 1, g[1]);
    nx = -g[0] * inv;
    ny = inv;
    nz = -g[1] * inv;
  }
  return { dist: best, pos, normal: [nx, ny, nz], kind, index };
}

/** True when the segment a -> b touches terrain, a solid or a tree trunk. */
export function segmentHitsStatic(map: TacticalMap, a: Readonly<Vec3>, b: Readonly<Vec3>): boolean {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  if (len < 1e-9) return false;
  const hit = raycastWorld(map, a, d, len);
  return hit !== null && hit.dist < len - 1e-6;
}

/** Squared distance between the 2D segments p1 -> p2 and q1 -> q2; `out` receives the parameter (0..1) of the closest point on p. */
function segSegDist2(p1x: number, p1z: number, p2x: number, p2z: number, q1x: number, q1z: number, q2x: number, q2z: number, out: [number]): number {
  const d1x = p2x - p1x;
  const d1z = p2z - p1z;
  const d2x = q2x - q1x;
  const d2z = q2z - q1z;
  const rx = p1x - q1x;
  const rz = p1z - q1z;
  const a = d1x * d1x + d1z * d1z;
  const e = d2x * d2x + d2z * d2z;
  const f = d2x * rx + d2z * rz;
  let s: number;
  let t: number;
  if (a <= 1e-12 && e <= 1e-12) {
    s = 0;
    t = 0;
  } else if (a <= 1e-12) {
    s = 0;
    t = Math.min(1, Math.max(0, f / e));
  } else {
    const c = d1x * rx + d1z * rz;
    if (e <= 1e-12) {
      t = 0;
      s = Math.min(1, Math.max(0, -c / a));
    } else {
      const b = d1x * d2x + d1z * d2z;
      const den = a * e - b * b;
      s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.min(1, Math.max(0, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.min(1, Math.max(0, (b - c) / a));
      }
    }
  }
  out[0] = s;
  const dx = rx + d1x * s - d2x * t;
  const dz = rz + d1z * s - d2z * t;
  return dx * dx + dz * dz;
}

const segOut: [number] = [0];

/** True when the straight line a -> b passes through sight-blocking vegetation (TacticalMap.brush) below its top. */
export function brushBetween(map: TacticalMap, a: Readonly<Vec3>, b: Readonly<Vec3>): boolean {
  if (map.brush.length === 0) return false;
  const hash = map.hash;
  const cs = hash.cell;
  const hn = hash.n;
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dz);
  // Visit the hash cells along the line (every quarter cell; a capsule is listed in every cell it touches).
  const steps = Math.max(1, Math.ceil(len / (cs * 0.25)));
  let last = -1;
  for (let i = 0; i <= steps; i++) {
    const x = a[0] + (dx * i) / steps;
    const z = a[2] + (dz * i) / steps;
    const cx = Math.min(hn - 1, Math.max(0, Math.floor(x / cs)));
    const cz = Math.min(hn - 1, Math.max(0, Math.floor(z / cs)));
    const c = cz * hn + cx;
    if (c === last) continue;
    last = c;
    for (const bi of hash.brush[c]!) {
      const br = map.brush[bi]!;
      if (segSegDist2(a[0], a[2], b[0], b[2], br.ax, br.az, br.bx, br.bz, segOut) >= br.r * br.r) continue;
      const s = segOut[0];
      const px = a[0] + dx * s;
      const pz = a[2] + dz * s;
      const y = a[1] + (b[1] - a[1]) * s;
      const ground = heightAt(map, px, pz);
      if (y < ground + br.h && y > ground - 2) return true;
    }
  }
  return false;
}

/** Line of sight between two eyes: blocked by everything a bullet stops at, and by hedges, reeds and thickets. */
export function sightBlocked(map: TacticalMap, a: Readonly<Vec3>, b: Readonly<Vec3>): boolean {
  return brushBetween(map, a, b) || segmentHitsStatic(map, a, b);
}

/**
 * Height a walker at (x, z) with feet at feetY stands on: the terrain, or the top of a solid
 * under it that is no more than stepUp above the feet.
 */
export function supportAt(map: TacticalMap, x: number, z: number, feetY: number, stepUp: number = TACTICAL.player.stepUp): number {
  let best = heightAt(map, x, z);
  const hash = map.hash;
  const cx = Math.min(hash.n - 1, Math.max(0, Math.floor(x / hash.cell)));
  const cz = Math.min(hash.n - 1, Math.max(0, Math.floor(z / hash.cell)));
  for (const si of hash.solids[cz * hash.n + cx]!) {
    const s = map.solids[si]!;
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    if (s.enter !== undefined) {
      // 07d: inside an enterable building's footprint: its floors, stairs and furniture.
      const det = detailOfSolid(map, s);
      const c = det.cells[detailCell(det, z, 'z') * det.gnx + detailCell(det, x, 'x')]!;
      for (const di of c) {
        const q = det.solids[di]!;
        if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1 && q.y1 > best && q.y1 <= feetY + stepUp) best = q.y1;
      }
      continue;
    }
    if (s.y1 > best && s.y1 <= feetY + stepUp) best = s.y1;
  }
  return best;
}

/**
 * Push a vertical cylinder (centre pos, radius, feetY .. feetY + height) out of the solids and tree
 * trunks it overlaps. Solids whose top is within stepUp of the feet do not block (they are stepped
 * onto). Mutates pos [x, z]; returns true when it moved.
 */
export function pushOut(map: TacticalMap, pos: [number, number], radius: number, feetY: number, height: number, stepUp: number = TACTICAL.player.stepUp): boolean {
  const hash = map.hash;
  const n = hash.n;
  const cs = hash.cell;
  let moved = false;
  const seen = pushSeen;
  for (let iter = 0; iter < 3; iter++) {
    let again = false;
    seen.length = 0;
    const cx0 = Math.max(0, Math.floor((pos[0] - radius) / cs));
    const cx1 = Math.min(n - 1, Math.floor((pos[0] + radius) / cs));
    const cz0 = Math.max(0, Math.floor((pos[1] - radius) / cs));
    const cz1 = Math.min(n - 1, Math.floor((pos[1] + radius) / cs));
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = cz * n + cx;
        for (const si of hash.solids[c]!) {
          const s = map.solids[si]!;
          if (s.enter !== undefined) {
            // 07d: an enterable building: push against its own boxes (once per pass).
            if (seen.includes(si) || feetY > s.y1 + 0.1 || feetY + height < s.y0) continue;
            if (pos[0] < s.x0 - radius || pos[0] > s.x1 + radius || pos[1] < s.z0 - radius || pos[1] > s.z1 + radius) continue;
            seen.push(si);
            if (pushDetail(detailOfSolid(map, s), pos, radius, feetY, height, stepUp)) {
              again = true;
              moved = true;
            }
            continue;
          }
          if (s.y1 <= feetY + stepUp || s.y0 >= feetY + height) continue;
          const qx = Math.min(s.x1, Math.max(s.x0, pos[0]));
          const qz = Math.min(s.z1, Math.max(s.z0, pos[1]));
          const dx = pos[0] - qx;
          const dz = pos[1] - qz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= radius * radius) continue;
          if (d2 > 1e-10) {
            const d = Math.sqrt(d2);
            pos[0] = qx + (dx / d) * radius;
            pos[1] = qz + (dz / d) * radius;
          } else {
            // Centre inside the box: leave through the nearest face.
            const l = pos[0] - s.x0;
            const r = s.x1 - pos[0];
            const t = pos[1] - s.z0;
            const b = s.z1 - pos[1];
            const m = Math.min(l, r, t, b);
            if (m === l) pos[0] = s.x0 - radius;
            else if (m === r) pos[0] = s.x1 + radius;
            else if (m === t) pos[1] = s.z0 - radius;
            else pos[1] = s.z1 + radius;
          }
          again = true;
          moved = true;
        }
        const trees = map.trees;
        for (const ti of hash.trees[c]!) {
          const ty = trees.y[ti]!;
          if (feetY > ty + trees.h[ti]! * TRUNK_SHARE || feetY + height < ty - 0.5) continue;
          const rr = radius + trunkRadius(trees.h[ti]!);
          const dx = pos[0] - trees.x[ti]!;
          const dz = pos[1] - trees.z[ti]!;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2);
          if (d > 1e-6) {
            pos[0] = trees.x[ti]! + (dx / d) * rr;
            pos[1] = trees.z[ti]! + (dz / d) * rr;
          } else pos[0] += rr;
          again = true;
          moved = true;
        }
      }
    }
    if (!again) break;
  }
  return moved;
}

/** Ladder whose climb zone contains (x, z) at a height within its span, or null. */
export function ladderAt(map: TacticalMap, x: number, z: number, feetY: number): Ladder | null {
  const inZone = (l: Ladder): boolean => x >= l.x0 - 0.1 && x <= l.x1 + 0.1 && z >= l.z0 - 0.1 && z <= l.z1 + 0.1 && feetY >= l.y0 - 0.6 && feetY <= l.y1 + 0.05;
  for (const l of map.ladders) if (inZone(l)) return l;
  // 07d: ladders inside enterable buildings (roof hatches).
  const hash = map.hash;
  const cx = Math.min(hash.n - 1, Math.max(0, Math.floor(x / hash.cell)));
  const cz = Math.min(hash.n - 1, Math.max(0, Math.floor(z / hash.cell)));
  for (const si of hash.solids[cz * hash.n + cx]!) {
    const s = map.solids[si]!;
    if (s.enter === undefined || x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    for (const l of detailOfSolid(map, s).ladders) if (inZone(l)) return l;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Enterable buildings (07d): queries inside an envelope box use the building's own boxes
// ---------------------------------------------------------------------------------------------

const pushSeen: number[] = [];

/** The building behind an envelope box (generated on first use, gen/buildings detailOf). */
export function detailOfSolid(map: TacticalMap, s: Solid): BuildingDetail {
  return detailOf(map.placements[s.enter!]!);
}

function detailCell(det: BuildingDetail, v: number, axis: 'x' | 'z'): number {
  const o = axis === 'x' ? det.gx0 : det.gz0;
  const n = axis === 'x' ? det.gnx : det.gnz;
  return Math.min(n - 1, Math.max(0, Math.floor((v - o) / det.cell)));
}

const stamps = new WeakMap<BuildingDetail, { mark: Uint32Array; gen: number }>();

/**
 * First hit of the ray on a building's boxes between t0 and t1 (glass is passed through).
 * Walks the building's 2 m lookup grid along the ray.
 */
function rayDetail(
  det: BuildingDetail, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  invX: number, invY: number, invZ: number, t0: number, t1: number,
): { t: number; axis: number; kind: SolidKind } | null {
  let st = stamps.get(det);
  if (!st) stamps.set(det, (st = { mark: new Uint32Array(det.solids.length), gen: 0 }));
  st.gen = (st.gen + 1) >>> 0 || 1;
  const gen = st.gen;
  const mark = st.mark;
  const cs = det.cell;
  let best = t1;
  let axisBest = -2;
  let kindBest: SolidKind = 'building';
  const sx = ox + dx * t0;
  const sz = oz + dz * t0;
  let cx = detailCell(det, sx, 'x');
  let cz = detailCell(det, sz, 'z');
  const stepX = dx > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  let tMaxX = invX === Infinity ? Infinity : t0 + ((dx > 0 ? det.gx0 + (cx + 1) * cs : det.gx0 + cx * cs) - sx) * invX;
  let tMaxZ = invZ === Infinity ? Infinity : t0 + ((dz > 0 ? det.gz0 + (cz + 1) * cs : det.gz0 + cz * cs) - sz) * invZ;
  const tDeltaX = Math.abs(cs * invX);
  const tDeltaZ = Math.abs(cs * invZ);
  let tCell = t0;
  while (tCell <= best && cx >= 0 && cz >= 0 && cx < det.gnx && cz < det.gnz) {
    for (const di of det.cells[cz * det.gnx + cx]!) {
      if (mark[di] === gen) continue;
      mark[di] = gen;
      const q = det.solids[di]!;
      if (q.pane) continue;
      let tn = t0;
      let tf = best;
      let axis = -1;
      if (invX === Infinity) {
        if (ox < q.x0 || ox > q.x1) continue;
      } else {
        let a = (q.x0 - ox) * invX;
        let b = (q.x1 - ox) * invX;
        if (a > b) [a, b] = [b, a];
        if (a > tn) { tn = a; axis = 0; }
        if (b < tf) tf = b;
      }
      if (invY === Infinity) {
        if (oy < q.y0 || oy > q.y1) continue;
      } else {
        let a = (q.y0 - oy) * invY;
        let b = (q.y1 - oy) * invY;
        if (a > b) [a, b] = [b, a];
        if (a > tn) { tn = a; axis = 1; }
        if (b < tf) tf = b;
      }
      if (invZ === Infinity) {
        if (oz < q.z0 || oz > q.z1) continue;
      } else {
        let a = (q.z0 - oz) * invZ;
        let b = (q.z1 - oz) * invZ;
        if (a > b) [a, b] = [b, a];
        if (a > tn) { tn = a; axis = 2; }
        if (b < tf) tf = b;
      }
      if (tn > tf || tn >= best) continue;
      best = tn;
      axisBest = axis;
      kindBest = q.kind;
    }
    if (tMaxX === Infinity && tMaxZ === Infinity) break;
    if (tMaxX < tMaxZ) {
      tCell = tMaxX;
      tMaxX += tDeltaX;
      cx += stepX;
    } else {
      tCell = tMaxZ;
      tMaxZ += tDeltaZ;
      cz += stepZ;
    }
  }
  return axisBest === -2 ? null : { t: best, axis: axisBest, kind: kindBest };
}

/** pushOut against one building's boxes (glass included). */
function pushDetail(det: BuildingDetail, pos: [number, number], radius: number, feetY: number, height: number, stepUp: number): boolean {
  let moved = false;
  const x0 = detailCell(det, pos[0] - radius, 'x');
  const x1 = detailCell(det, pos[0] + radius, 'x');
  const z0 = detailCell(det, pos[1] - radius, 'z');
  const z1 = detailCell(det, pos[1] + radius, 'z');
  let st = stamps.get(det);
  if (!st) stamps.set(det, (st = { mark: new Uint32Array(det.solids.length), gen: 0 }));
  st.gen = (st.gen + 1) >>> 0 || 1;
  const gen = st.gen;
  for (let cz = z0; cz <= z1; cz++) {
    for (let cx = x0; cx <= x1; cx++) {
      for (const di of det.cells[cz * det.gnx + cx]!) {
        if (st.mark[di] === gen) continue;
        st.mark[di] = gen;
        const s = det.solids[di]!;
        if (s.y1 <= feetY + stepUp || s.y0 >= feetY + height) continue;
        const qx = Math.min(s.x1, Math.max(s.x0, pos[0]));
        const qz = Math.min(s.z1, Math.max(s.z0, pos[1]));
        const ddx = pos[0] - qx;
        const ddz = pos[1] - qz;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-10) {
          const dd = Math.sqrt(d2);
          pos[0] = qx + (ddx / dd) * radius;
          pos[1] = qz + (ddz / dd) * radius;
        } else {
          const l = pos[0] - s.x0;
          const r = s.x1 - pos[0];
          const t = pos[1] - s.z0;
          const b = s.z1 - pos[1];
          const m = Math.min(l, r, t, b);
          if (m === l) pos[0] = s.x0 - radius;
          else if (m === r) pos[0] = s.x1 + radius;
          else if (m === t) pos[1] = s.z0 - radius;
          else pos[1] = s.z1 + radius;
        }
        moved = true;
      }
    }
  }
  return moved;
}

// ---------------------------------------------------------------------------------------------
// Dynamic objects
// ---------------------------------------------------------------------------------------------

/** Uniform grid of buckets for moving things (zombies, survivors, corpses), keyed by entity id. */
export interface SpatialHash {
  /** Insert, or move if the id is already present. */
  set(id: number, x: number, z: number): void;
  remove(id: number): void;
  clear(): void;
  readonly size: number;
  /** Ids whose bucket overlaps the circle (a superset: test exact distances yourself). Appends to `out`. */
  query(x: number, z: number, radius: number, out: number[]): number[];
  /** Ids in buckets within `pad` of the segment (superset). Appends to `out`. */
  querySegment(ax: number, az: number, bx: number, bz: number, pad: number, out: number[]): number[];
}

export function createSpatialHash(cell: number = TACTICAL.hashCell, size: number = TACTICAL.size): SpatialHash {
  const n = Math.ceil(size / cell);
  const buckets: number[][] = Array.from({ length: n * n }, () => []);
  const where = new Map<number, number>();
  const clampI = (v: number): number => Math.min(n - 1, Math.max(0, Math.floor(v / cell)));
  const drop = (id: number, c: number): void => {
    const b = buckets[c]!;
    const i = b.indexOf(id);
    if (i >= 0) {
      b[i] = b[b.length - 1]!;
      b.pop();
    }
  };
  const collect = (cx0: number, cz0: number, cx1: number, cz1: number, out: number[]): void => {
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) for (const id of buckets[cz * n + cx]!) out.push(id);
  };
  return {
    set(id, x, z) {
      const c = clampI(z) * n + clampI(x);
      const old = where.get(id);
      if (old === c) return;
      if (old !== undefined) drop(id, old);
      buckets[c]!.push(id);
      where.set(id, c);
    },
    remove(id) {
      const old = where.get(id);
      if (old === undefined) return;
      drop(id, old);
      where.delete(id);
    },
    clear() {
      for (const b of buckets) b.length = 0;
      where.clear();
    },
    get size() {
      return where.size;
    },
    query(x, z, radius, out) {
      collect(clampI(x - radius), clampI(z - radius), clampI(x + radius), clampI(z + radius), out);
      return out;
    },
    querySegment(ax, az, bx, bz, pad, out) {
      const len = Math.hypot(bx - ax, bz - az);
      const steps = Math.max(1, Math.ceil(len / cell));
      let lastX0 = -1;
      let lastZ0 = -1;
      let lastX1 = -1;
      let lastZ1 = -1;
      const seen = new Set<number>();
      for (let i = 0; i <= steps; i++) {
        const x = ax + ((bx - ax) * i) / steps;
        const z = az + ((bz - az) * i) / steps;
        const cx0 = clampI(x - pad);
        const cz0 = clampI(z - pad);
        const cx1 = clampI(x + pad);
        const cz1 = clampI(z + pad);
        if (cx0 === lastX0 && cz0 === lastZ0 && cx1 === lastX1 && cz1 === lastZ1) continue;
        lastX0 = cx0;
        lastZ0 = cz0;
        lastX1 = cx1;
        lastZ1 = cz1;
        for (let cz = cz0; cz <= cz1; cz++) {
          for (let cx = cx0; cx <= cx1; cx++) {
            const c = cz * n + cx;
            if (seen.has(c)) continue;
            seen.add(c);
            for (const id of buckets[c]!) out.push(id);
          }
        }
      }
      return out;
    },
  };
}
