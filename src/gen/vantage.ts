// 07d-3: at least three elevated firing positions that see far (the R1 rule of the real areas:
// a standing shooter sees a target 300 m away — ground + 1 m — in one of 16 directions).
//
// The roofs of the town (07d-3) and the buildings around changed what the hills and towers see, so
// after the trees and the cover are in, the real areas check their firing positions with an
// approximate line of sight (terrain, the boxes of the solids, tree trunks, brush — what the sim's
// sightBlocked stops at, with the enterable buildings as their whole outline) and add lookout
// towers where too few see far (as R9 did by hand with tools/real/sightlines.ts --suggest).
// Pure, no sim imports (the sim imports gen).

import { TACTICAL } from '../data/tactical.ts';
import { addTower, hAt, homeDist, rectFree, rngOf, SIZE, TILE, TILES, type Builder } from './builder.ts';
import { randRange } from '../core/rng.ts';
import { GROUND, TRUNK_SHARE, trunkRadius } from './types.ts';

const T = TACTICAL;
const DIRS = 16;
const CELL = 16;
const N = SIZE / CELL;

interface Index {
  solids: number[][];
  trees: number[][];
  brush: number[][];
}

export function indexOf(b: Builder): Index {
  const idx: Index = { solids: Array.from({ length: N * N }, () => []), trees: Array.from({ length: N * N }, () => []), brush: Array.from({ length: N * N }, () => []) };
  const c = (v: number): number => Math.min(N - 1, Math.max(0, Math.floor(v / CELL)));
  b.solids.forEach((s, i) => {
    for (let z = c(s.z0); z <= c(s.z1); z++) for (let x = c(s.x0); x <= c(s.x1); x++) idx.solids[z * N + x]!.push(i);
  });
  for (let i = 0; i < b.trees.length / 5; i++) idx.trees[c(b.trees[i * 5 + 1]!) * N + c(b.trees[i * 5]!)]!.push(i);
  b.brush.forEach((br, i) => {
    for (let z = c(Math.min(br.az, br.bz) - br.r); z <= c(Math.max(br.az, br.bz) + br.r); z++) {
      for (let x = c(Math.min(br.ax, br.bx) - br.r); x <= c(Math.max(br.ax, br.bx) + br.r); x++) idx.brush[z * N + x]!.push(i);
    }
  });
  return idx;
}

/** Height the line must clear where it leaves the roof stood on: the parapet and the rail on it (07d-2c: 1.45 m over the deck on the towers). */
const PARAPET = 1.5;

/**
 * Is the line from (ax, ay, az) to (bx, by, bz) clear? `self` = the building stood on: a tower does not
 * block its own view; an enterable roof does where the line leaves it below the parapet's top.
 */
function clear(b: Builder, idx: Index, ax: number, ay: number, az: number, bx: number, by: number, bz: number, self: number): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  const own = self >= 0 ? b.buildings[self] : undefined;
  if (own && own.enter !== undefined) {
    // Where the line leaves the roof's outline (in plan), it must be over the parapet.
    let t = 1;
    if (dx > 1e-9) t = Math.min(t, (own.x1 - ax) / dx);
    if (dx < -1e-9) t = Math.min(t, (own.x0 - ax) / dx);
    if (dz > 1e-9) t = Math.min(t, (own.z1 - az) / dz);
    if (dz < -1e-9) t = Math.min(t, (own.z0 - az) / dz);
    const roof = own.base + b.placements[own.enter]!.eaves + PARAPET;
    if (ay + (by - ay) * Math.max(0, t) < roof) return false;
  }
  const steps = Math.max(1, Math.ceil(len / 3));
  const seen = new Set<number>();
  let last = -1;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + dx * t;
    const z = az + dz * t;
    const y = ay + (by - ay) * t;
    if (hAt(b, x, z) > y) return false;
    const cell = Math.min(N - 1, Math.floor(z / CELL)) * N + Math.min(N - 1, Math.floor(x / CELL));
    if (cell === last) continue;
    last = cell;
    for (const si of idx.solids[cell]!) {
      if (seen.has(si)) continue;
      seen.add(si);
      const s = b.solids[si]!;
      if (s.ref === self && self >= 0) continue;
      if (segBox(ax, ay, az, bx, by, bz, s.x0, s.y0, s.z0, s.x1, s.y1, s.z1)) return false;
    }
    for (const ti of idx.trees[cell]!) {
      const tx = b.trees[ti * 5]!;
      const tz = b.trees[ti * 5 + 1]!;
      const th = b.trees[ti * 5 + 2]!;
      const r = trunkRadius(th);
      const u = Math.max(0, Math.min(1, ((tx - ax) * dx + (tz - az) * dz) / (len * len)));
      if (Math.hypot(ax + dx * u - tx, az + dz * u - tz) > r) continue;
      const ground = hAt(b, tx, tz);
      const yy = ay + (by - ay) * u;
      if (yy < ground + th * TRUNK_SHARE) return false;
    }
    for (const bi of idx.brush[cell]!) {
      const br = b.brush[bi]!;
      // Closest approach of the sight line to the brush's axis (sampled: brush is short).
      for (let k = 0; k <= 4; k++) {
        const px = br.ax + ((br.bx - br.ax) * k) / 4;
        const pz = br.az + ((br.bz - br.az) * k) / 4;
        const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (len * len)));
        if (Math.hypot(ax + dx * u - px, az + dz * u - pz) > br.r) continue;
        const ground = hAt(b, px, pz);
        const yy = ay + (by - ay) * u;
        if (yy < ground + br.h && yy > ground - 2) return false;
      }
    }
  }
  return true;
}

/** Does the segment cross the box (slab test)? */
function segBox(ax: number, ay: number, az: number, bx: number, by: number, bz: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const d = [bx - ax, by - ay, bz - az];
  const o = [ax, ay, az];
  const lo = [x0, y0, z0];
  const hi = [x1, y1, z1];
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]!) < 1e-9) {
      if (o[k]! < lo[k]! || o[k]! > hi[k]!) return false;
      continue;
    }
    let ta = (lo[k]! - o[k]!) / d[k]!;
    let tb = (hi[k]! - o[k]!) / d[k]!;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** Directions (of 16) in which a target 300 m away is seen from eye height over (x, y, z). */
export function farDirections(b: Builder, idx: Index, x: number, y: number, z: number, self: number, mask?: number[]): number {
  const eye = y + T.player.eyeHeight.stand;
  let n = 0;
  for (let i = 0; i < DIRS; i++) {
    const a = (i / DIRS) * Math.PI * 2;
    const tx = x + Math.cos(a) * T.vantage.far;
    const tz = z + Math.sin(a) * T.vantage.far;
    if (tx < 8 || tz < 8 || tx > SIZE - 8 || tz > SIZE - 8) continue;
    if (clear(b, idx, x, eye, z, tx, hAt(b, tx, tz) + 1, tz, self)) {
      n++;
      mask?.push(i);
    }
  }
  return n;
}

/**
 * Add lookout towers until three elevated firing positions see far (unless the area is mostly
 * water). Candidates: the higher free ground, away from the other positions and the home base;
 * the trees and brush around a new tower are cleared.
 */
export function ensureFarVantages(b: Builder): void {
  let wet = 0;
  for (let i = 0; i < b.ground.length; i++) if (b.ground[i] === GROUND.water) wet++;
  if (wet > b.ground.length * 0.6) return;
  let idx = indexOf(b);
  const high = b.vantages.filter((v) => v.kind === 'hill' || v.pos[1] >= hAt(b, v.pos[0], v.pos[2]) + 4);
  let far = 0;
  for (const v of high) {
    if (far >= T.vantage.min) break;
    // A roof or a tower stands on its own building: that one does not block its own view.
    const self = b.buildings.find((o) => v.pos[0] >= o.x0 - 1 && v.pos[0] <= o.x1 + 1 && v.pos[2] >= o.z0 - 1 && v.pos[2] <= o.z1 + 1 && v.pos[1] >= o.base + 2)?.id ?? -1;
    if (farDirections(b, idx, v.pos[0], v.pos[1], v.pos[2], self) > 0) far++;
  }
  if (far >= T.vantage.min) return;
  const rng = rngOf(b, 'vantage.far');
  const deck = T.vantage.farTower;
  const cands: [number, number, number][] = [];
  for (let z = 60; z <= SIZE - 60; z += 24) {
    for (let x = 60; x <= SIZE - 60; x += 24) {
      const cx = x + randRange(rng, -6, 6);
      const cz = z + randRange(rng, -6, 6);
      if (b.params.isHome && homeDist(cx, cz) < T.homeFlatRadius + 30) continue;
      if (b.vantages.some((v) => Math.hypot(v.pos[0] - cx, v.pos[2] - cz) < T.vantage.separation * 0.6)) continue;
      const t = Math.floor(cz / TILE) * TILES + Math.floor(cx / TILE);
      if (b.ground[t] === GROUND.water || !rectFree(b, cx - 4.5, cz - 4.5, cx + 4.5, cz + 4.5, 12)) continue;
      cands.push([cx, cz, hAt(b, cx, cz)]);
    }
  }
  cands.sort((p, q) => q[2] - p[2]);
  for (const [cx, cz, h] of cands.slice(0, 160)) {
    if (far >= T.vantage.min) break;
    if (b.vantages.some((v) => Math.hypot(v.pos[0] - cx, v.pos[2] - cz) < T.vantage.separation * 0.6)) continue;
    if (farDirections(b, idx, cx, h + deck, cz, -1) < 2) continue;
    const tower = addTower(b, cx, cz, deck);
    if (!tower) continue;
    // Clear the trees and brush right round it (its legs and ladder; R9 did the same by hand).
    const keep: number[] = [];
    for (let i = 0; i < b.trees.length / 5; i++) if (Math.hypot(b.trees[i * 5]! - cx, b.trees[i * 5 + 1]! - cz) > 6) keep.push(...b.trees.slice(i * 5, i * 5 + 5));
    b.trees = keep;
    b.brush = b.brush.filter((br) => Math.hypot((br.ax + br.bx) / 2 - cx, (br.az + br.bz) / 2 - cz) > 8);
    idx = indexOf(b);
    far++;
  }
}
