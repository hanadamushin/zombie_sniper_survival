// Continuity between neighbouring operation areas (07c): the player walks from one cell's map
// into the next, so terrain and roads must meet at the shared edge.
//
//   - Terrain is a function of WORLD position (cell grid position × map size + local position):
//     the base relief uses noise seeded by the game, not by the cell, and the land-class
//     parameters (urban flat … mountain steep) are blended over a band on each side of a border.
//     Hills of the neighbouring cells are included. Two cells evaluating the same world point get
//     the same height, so the shared edge row of their height grids is identical.
//   - Roads leave a cell only through "gates": one per shared edge (or none), decided from the
//     pair of cells, so both sides put their road at the same spot.
//
// Without a world context (tests, the firing range) a map behaves as before 07c: its own noise,
// its own land everywhere.

import { fork, rand, randRange, seedRng, type RngState } from '../core/rng.ts';
import type { Land } from '../core/types.ts';
import { TACTICAL } from '../data/tactical.ts';
import { fbm, noise2, ridged, smoothstep } from './noise.ts';
import type { GenParams, WorldContext } from './types.ts';

const T = TACTICAL;
const SIZE = T.size;
const W = T.world;

export interface Hill {
  x: number;
  z: number;
  h: number;
  s: number;
}

/** Hills and knolls of a cell (local coordinates), from its map seed and land only. */
export function cellHills(mapSeed: number, land: Land): Hill[] {
  const P = T.terrain[land];
  // Same stream and order of draws as the map generator has always used (terrain seeds first).
  const rng = fork(seedRng(mapSeed), 'terrain');
  for (let i = 0; i < 3; i++) rand(rng);
  const hills: Hill[] = [];
  const mid = SIZE / 2;
  const homeDist = (x: number, z: number): number => Math.hypot(x - mid, z - mid);
  for (let i = 0; i < P.hills[0]; i++) {
    for (let tries = 0; tries < 40; tries++) {
      const x = randRange(rng, 130, SIZE - 130);
      const z = randRange(rng, 130, SIZE - 130);
      if (homeDist(x, z) < 290) continue;
      if (hills.some((o) => Math.hypot(o.x - x, o.z - z) < 300)) continue;
      hills.push({ x, z, h: randRange(rng, P.hills[1], P.hills[2]), s: randRange(rng, 85, 130) });
      break;
    }
  }
  rand(rng); // the seed of the shorter undulation
  for (let i = 0; i < P.knolls[0]; i++) {
    for (let tries = 0; tries < 40; tries++) {
      const x = randRange(rng, 60, SIZE - 60);
      const z = randRange(rng, 60, SIZE - 60);
      if (homeDist(x, z) < 200) continue;
      if (hills.some((o) => Math.hypot(o.x - x, o.z - z) < o.s + 60)) continue;
      hills.push({ x, z, h: randRange(rng, P.knolls[1], P.knolls[2]), s: randRange(rng, 22, 36) });
      break;
    }
  }
  return hills;
}

interface Seeds {
  s1: number;
  s2: number;
  s3: number;
  s4: number;
}

function seedsOf(rng: RngState): Seeds {
  const s1 = Math.floor(rand(rng) * 0x7fffffff);
  const s2 = Math.floor(rand(rng) * 0x7fffffff);
  const s3 = Math.floor(rand(rng) * 0x7fffffff);
  const s4 = Math.floor(rand(rng) * 0x7fffffff);
  return { s1, s2, s3, s4 };
}

/** Base relief of a land class at a point (no hills). `sea` lies a few metres below the rural level. */
function baseHeight(land: Land | null, x: number, z: number, s: Seeds): number {
  const P = T.terrain[land ?? 'rural'];
  let h = P.amp + 4 + P.amp * fbm(x / P.wave, z / P.wave, s.s1, 4);
  if (P.ridge > 0) {
    const r = ridged(x / (P.wave * 1.5), z / (P.wave * 1.5), s.s2, 3);
    h += P.ridge * r * r;
  }
  if (P.mid > 0) h += P.mid * fbm(x / P.midWave, z / P.midWave, s.s4, 2);
  const detail = land === 'urban' ? 0 : land === 'suburb' ? 0.15 : 0.5;
  if (detail > 0) h += detail * noise2(x / 23, z / 23, s.s3);
  return land === null ? h - W.seaDrop : h;
}

/** Weights of the cells left / here / right of a coordinate along one axis (local, the map's own cell is 0). */
function axisWeights(u: number, out: [number, number, number]): void {
  // Which cell the point is in, and the position inside it.
  const c = Math.floor(u / SIZE);
  const f = u - c * SIZE;
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  const put = (cell: number, w: number): void => {
    const k = Math.max(-1, Math.min(1, cell)) + 1;
    out[k] = out[k]! + w;
  };
  if (f < SIZE / 2) {
    const w = smoothstep(-W.blend, W.blend, f); // weight of the cell the point is in
    put(c, w);
    put(c - 1, 1 - w);
  } else {
    const w = smoothstep(-W.blend, W.blend, SIZE - f);
    put(c, w);
    put(c + 1, 1 - w);
  }
}

/**
 * Raw terrain height function of a map, in its local coordinates; valid outside the playable
 * square too (the coarse surroundings and the neighbours' edge use it).
 */
export function terrainFunction(params: GenParams, rng: RngState): (x: number, z: number) => number {
  const own = seedsOf(rng);
  const world = params.world;
  const hills = cellHills(params.mapSeed, params.land);
  if (!world) {
    const P = T.terrain[params.land];
    void P;
    return (x, z) => {
      let h = baseHeight(params.land, x, z, own);
      for (const hill of hills) h += hill.h * Math.exp(-((x - hill.x) ** 2 + (z - hill.z) ** 2) / (2 * hill.s * hill.s));
      return h;
    };
  }
  const shared = seedsOf(fork(seedRng(world.seed), 'world.terrain'));
  const ox = world.gx * SIZE;
  const oz = world.gy * SIZE;
  // Hills of the 3 × 3 neighbourhood, moved into this map's coordinates.
  const all: (Hill & { r: number; r2: number; k: number })[] = [];
  const reach = (hl: Hill, x: number, z: number): boolean => {
    const r = hl.s * 4;
    return x > -r - SIZE && x < 2 * SIZE + r && z > -r - SIZE && z < 2 * SIZE + r;
  };
  world.around.forEach((n, i) => {
    if (!n) return;
    const dx = (i % 3) - 1;
    const dz = Math.floor(i / 3) - 1;
    const list = i === 4 ? hills : cellHills(n.mapSeed, n.land);
    for (const hl of list) {
      const x = hl.x + dx * SIZE;
      const z = hl.z + dz * SIZE;
      if (reach(hl, x, z)) all.push({ x, z, h: hl.h, s: hl.s, r: hl.s * 4, r2: 16 * hl.s * hl.s, k: 1 / (2 * hl.s * hl.s) });
    }
  });
  const lands = world.around.map((n) => (n ? n.land : null));
  const wx: [number, number, number] = [0, 0, 0];
  const wz: [number, number, number] = [0, 0, 0];
  return (x, z) => {
    axisWeights(x, wx);
    axisWeights(z, wz);
    // World coordinates for the shared noise: the same point gives the same value in every cell.
    const px = ox + x;
    const pz = oz + z;
    let h = 0;
    for (let j = 0; j < 3; j++) {
      const wj = wz[j]!;
      if (wj === 0) continue;
      for (let i = 0; i < 3; i++) {
        const w = wx[i]! * wj;
        if (w === 0) continue;
        h += w * baseHeight(lands[j * 3 + i]!, px, pz, shared);
      }
    }
    // Hills reach 4 sigma (beyond that they add less than a centimetre); both sides of an edge
    // see the same hills there, so the cut-off keeps them equal.
    for (let k = 0; k < all.length; k++) {
      const hill = all[k]!;
      const dx = x - hill.x;
      if (dx > hill.r || dx < -hill.r) continue;
      const dz = z - hill.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < hill.r2) h += hill.h * Math.exp(-d2 * hill.k);
    }
    return h;
  };
}

// ---------------------------------------------------------------------------------------------
// Gates: where roads cross from one cell into the next
// ---------------------------------------------------------------------------------------------

/** Side of the map: 0 west (x = 0), 1 east (x = SIZE), 2 north (z = 0), 3 south (z = SIZE). */
export type EdgeSide = 0 | 1 | 2 | 3;

export interface Gate {
  side: EdgeSide;
  /** Point on the edge (local coordinates). */
  pos: [number, number];
}

/** Index into WorldContext.around of the neighbour on a side. */
const SIDE_INDEX: Record<EdgeSide, number> = { 0: 3, 1: 5, 2: 1, 3: 7 };

/** Road gates of a cell. Both cells sharing an edge get the same answer for it. */
export function gatesOf(params: GenParams): Gate[] {
  const world = params.world;
  if (!world) return [];
  const here = world.gy * world.gridW + world.gx;
  const gates: Gate[] = [];
  for (const side of [0, 1, 2, 3] as EdgeSide[]) {
    const n = world.around[SIDE_INDEX[side]];
    if (!n) continue;
    const there = side === 0 ? here - 1 : side === 1 ? here + 1 : side === 2 ? here - world.gridW : here + world.gridW;
    const a = Math.min(here, there);
    const b = Math.max(here, there);
    const rng = fork(seedRng((world.seed ^ Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca6b)) >>> 0), 'gate');
    const roll = rand(rng);
    const along = randRange(rng, W.gateMargin, SIZE - W.gateMargin);
    const wild = (l: Land): boolean => l === 'forest' || l === 'mountain';
    const chance = wild(n.land) && wild(params.land) ? W.gateWild : W.gateChance;
    if (roll >= chance) continue;
    gates.push({ side, pos: side === 0 ? [0, along] : side === 1 ? [SIZE, along] : side === 2 ? [along, 0] : [along, SIZE] });
  }
  return gates;
}

/** How much a terrain edit (road grading, dikes, a creek) may change the ground at (x, z): 0 at the map edge, where it must match the neighbour. */
export function editFade(x: number, z: number): number {
  return smoothstep(0, W.editFade, Math.min(x, z, SIZE - x, SIZE - z));
}

export type { WorldContext };
