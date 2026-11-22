// Working state and primitives for map generation: heights, roads, buildings, stairs, ladders,
// towers. Layouts (lands.ts) compose these; finish() in index.ts turns the result into a TacticalMap.
// Also used by tests to build small hand-made maps.

import { fork, seedRng, type RngState } from '../core/rng.ts';
import { TACTICAL } from '../data/tactical.ts';
import { sampleHeight } from './height.ts';
import { smoothstep } from './noise.ts';
import { editFade } from './world.ts';
import { ARCH } from '../data/architecture.ts';
import { buildingDef, makePlacement, worldSize, type BuildingPlacement, type Rot } from './buildings/index.ts';
import type { TypeTally } from './placement.ts';
import { GROUND, type Area, type Brush, type Building, type BuildingKind, type GenParams, type Ladder, type Prop, type Road, type RoadKind, type Rock, type Solid, type Vantage } from './types.ts';

const T = TACTICAL;
export const SIZE = T.size;
export const TILE = T.tile;
export const TILES = SIZE / TILE;
export const N = TILES + 1;

export interface Builder {
  params: GenParams;
  root: RngState;
  height: Float32Array;
  ground: Uint8Array;
  /** Tiles taken by roads, buildings, stairs, fields... (placement tests). */
  occupied: Uint8Array;
  buildings: Building[];
  /** 07d: enterable buildings (gen/buildings). */
  placements: BuildingPlacement[];
  solids: Solid[];
  ladders: Ladder[];
  roads: Road[];
  areas: Area[];
  rocks: Rock[];
  brush: Brush[];
  props: Prop[];
  /** Polylines that must stay open to the eye besides the roads (forest creek). */
  lanes: [number, number][][];
  vantages: Vantage[];
  /** x, z, height, canopy radius, kind — 5 numbers per tree. */
  trees: number[];
  /** x, z, size — 3 numbers per tuft. */
  grass: number[];
  /** R0: share 0..1 of woodland at a point (real land use); the flora follows it instead of noise. */
  forestAt?: (x: number, z: number) => number;
  /** 07d-3: the building types placed so far (per-area caps of data/placement.ts). */
  tally?: TypeTally;
}

export function createBuilder(params: GenParams): Builder {
  return {
    params,
    root: seedRng(params.mapSeed),
    height: new Float32Array(N * N),
    ground: new Uint8Array(TILES * TILES),
    occupied: new Uint8Array(TILES * TILES),
    buildings: [],
    placements: [],
    solids: [],
    ladders: [],
    roads: [],
    areas: [],
    rocks: [],
    brush: [],
    props: [],
    lanes: [],
    vantages: [],
    trees: [],
    grass: [],
  };
}

export function rngOf(b: Builder, label: string): RngState {
  return fork(b.root, label);
}

export function hAt(b: Builder, x: number, z: number): number {
  return sampleHeight(b.height, N, TILE, x, z);
}

export function tileIndex(x: number, z: number): number {
  const tx = Math.min(TILES - 1, Math.max(0, Math.floor(x / TILE)));
  const ty = Math.min(TILES - 1, Math.max(0, Math.floor(z / TILE)));
  return ty * TILES + tx;
}

const HOME = SIZE / 2;
/** Distance from the centre of the map (home base). */
export function homeDist(x: number, z: number): number {
  return Math.hypot(x - HOME, z - HOME);
}
/** True when the rectangle touches the area that must stay empty in a home cell. */
export function inHomeZone(b: Builder, x0: number, z0: number, x1: number, z1: number, margin = 6): boolean {
  if (!b.params.isHome) return false;
  const cx = Math.min(x1, Math.max(x0, HOME));
  const cz = Math.min(z1, Math.max(z0, HOME));
  return homeDist(cx, cz) < T.homeFlatRadius + margin;
}

/** Visit the tiles overlapping a rectangle. */
export function forTiles(x0: number, z0: number, x1: number, z1: number, fn: (index: number, tx: number, ty: number) => void): void {
  const tx0 = Math.max(0, Math.floor(x0 / TILE));
  const ty0 = Math.max(0, Math.floor(z0 / TILE));
  const tx1 = Math.min(TILES - 1, Math.floor((x1 - 1e-6) / TILE));
  const ty1 = Math.min(TILES - 1, Math.floor((z1 - 1e-6) / TILE));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) fn(ty * TILES + tx, tx, ty);
}

export function occupy(b: Builder, x0: number, z0: number, x1: number, z1: number): void {
  forTiles(x0, z0, x1, z1, (i) => {
    b.occupied[i] = 1;
  });
}

/** True when the rectangle lies inside the map and touches nothing placed so far. */
export function rectFree(b: Builder, x0: number, z0: number, x1: number, z1: number, edge = 6): boolean {
  if (x0 < edge || z0 < edge || x1 > SIZE - edge || z1 > SIZE - edge) return false;
  let free = true;
  forTiles(x0, z0, x1, z1, (i) => {
    if (b.occupied[i]) free = false;
  });
  return free;
}

/** [min, max] terrain height under a rectangle (sampled every 2 m). */
export function heightRange(b: Builder, x0: number, z0: number, x1: number, z1: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  const nx = Math.max(1, Math.ceil((x1 - x0) / 2));
  const nz = Math.max(1, Math.ceil((z1 - z0) / 2));
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const h = hAt(b, x0 + ((x1 - x0) * i) / nx, z0 + ((z1 - z0) * j) / nz);
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
  }
  return [lo, hi];
}

// ---------------------------------------------------------------------------------------------
// Roads
// ---------------------------------------------------------------------------------------------

/** Points every `step` metres along a polyline. */
export function resample(pts: readonly [number, number][], step: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i]!;
    const [bx, bz] = pts[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const k = Math.max(1, Math.round(len / step));
    for (let j = 0; j < k; j++) out.push([ax + ((bx - ax) * j) / k, az + ((bz - az) * j) / k]);
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

let accH: Float32Array | null = null;
let accW: Float32Array | null = null;
let maxW: Float32Array | null = null;

/**
 * Add a road: marks ground / occupied tiles, and (when `grade` is set) cuts a smooth road bed
 * into the terrain so that it can be walked along hillsides.
 */
export function addRoad(b: Builder, kind: RoadKind, width: number, pts: [number, number][], grade = false): Road {
  const road: Road = { kind, width, pts };
  b.roads.push(road);
  const samples = resample(pts, 2);
  const half = width / 2;
  const cls = kind === 'track' ? GROUND.track : GROUND.road;

  if (grade) {
    let prof = samples.map(([x, z]) => hAt(b, x, z));
    for (let pass = 0; pass < 3; pass++) {
      const next = prof.slice();
      for (let i = 0; i < prof.length; i++) {
        let sum = 0;
        let cnt = 0;
        for (let k = -10; k <= 10; k++) {
          const v = prof[i + k];
          if (v !== undefined) {
            sum += v;
            cnt++;
          }
        }
        next[i] = sum / cnt;
      }
      prof = next;
    }
    const reach = half + 7;
    // Scratch arrays shared by every road (R0: real areas have hundreds); `touched` resets them.
    const AH = (accH ??= new Float32Array(N * N));
    const AW = (accW ??= new Float32Array(N * N));
    const MW = (maxW ??= new Float32Array(N * N));
    const touched: number[] = [];
    samples.forEach(([x, z], s) => {
      const ix0 = Math.max(0, Math.ceil((x - reach) / TILE));
      const ix1 = Math.min(N - 1, Math.floor((x + reach) / TILE));
      const iz0 = Math.max(0, Math.ceil((z - reach) / TILE));
      const iz1 = Math.min(N - 1, Math.floor((z + reach) / TILE));
      for (let iz = iz0; iz <= iz1; iz++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          const d = Math.hypot(ix * TILE - x, iz * TILE - z);
          if (d >= reach) continue;
          // 07c: the road bed fades out at the map edge, where the ground must match the neighbour's.
          const w = (1 - smoothstep(half, reach, d)) * editFade(ix * TILE, iz * TILE);
          const i = iz * N + ix;
          if (MW[i] === 0 && AW[i] === 0) touched.push(i);
          AH[i] = AH[i]! + prof[s]! * w;
          AW[i] = AW[i]! + w;
          if (w > MW[i]!) MW[i] = w;
        }
      }
    });
    for (const i of touched) {
      const w = MW[i]!;
      if (w > 0) b.height[i] = b.height[i]! * (1 - w) + (AH[i]! / AW[i]!) * w;
      AH[i] = 0;
      AW[i] = 0;
      MW[i] = 0;
    }
  }

  for (const [x, z] of samples) {
    forTiles(x - half, z - half, x + half, z + half, (i, tx, ty) => {
      const cx = (tx + 0.5) * TILE;
      const cz = (ty + 0.5) * TILE;
      if (Math.hypot(cx - x, cz - z) <= half + TILE * 0.35) {
        b.ground[i] = cls;
        b.occupied[i] = 1;
      }
    });
  }
  return road;
}

// ---------------------------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------------------------

export interface BuildingOptions {
  roof?: 'flat' | 'gable';
  tint?: number;
  lootable?: boolean;
}

const LOOTABLE: Record<BuildingKind, boolean> = { house: true, barn: true, shed: true, shop: true, apartment: true, office: true, warehouse: true, tower: false };

export function addBuilding(b: Builder, kind: BuildingKind, x0: number, z0: number, x1: number, z1: number, height: number, opts: BuildingOptions = {}): Building {
  const [, hi] = heightRange(b, x0, z0, x1, z1);
  const building: Building = {
    id: b.buildings.length,
    kind,
    x0, z0, x1, z1,
    base: hi,
    height,
    roof: opts.roof ?? 'flat',
    tint: opts.tint ?? 0.5,
    lootable: opts.lootable ?? LOOTABLE[kind],
    access: 'none',
  };
  b.buildings.push(building);
  // The box reaches below the floor so that it meets sloping ground on every side.
  b.solids.push({ x0, z0, x1, z1, y0: hi - 6, y1: hi + height, kind: 'building', ref: building.id });
  occupy(b, x0 - 1, z0 - 1, x1 + 1, z1 + 1);
  return building;
}

/** Stable seed of the n-th enterable building of a map. */
function placementSeed(mapSeed: number, n: number): number {
  let h = Math.imul((mapSeed ^ 0x27d4eb2f) >>> 0, 0x165667b1) ^ Math.imul(n + 1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

/**
 * 07d: an enterable building of type `defId`, local size lw × ld (see gen/buildings fitSize), its
 * front facing `rot`, the world footprint starting at (x0, z0). The map keeps only the placement
 * and an envelope box; the blueprint is made when something comes close.
 */
export function addEnterable(b: Builder, defId: string, x0: number, z0: number, lw: number, ld: number, rot: Rot): Building {
  const def = buildingDef(defId);
  const [ww, wd] = worldSize(rot, lw, ld);
  const [, hi] = heightRange(b, x0, z0, x0 + ww, z0 + wd);
  const id = b.buildings.length;
  const enter = b.placements.length;
  const place = makePlacement(defId, placementSeed(b.params.mapSeed, enter), rot, lw, ld, x0, z0, hi, id);
  b.placements.push(place);
  const building: Building = {
    id, kind: def.kind, x0, z0, x1: place.x1, z1: place.z1, base: hi, height: place.height, roof: def.roof === 'flat' ? 'flat' : 'gable',
    tint: 0.5, lootable: def.lootable ?? true, access: 'none', enter,
  };
  b.buildings.push(building);
  b.solids.push({ x0, z0, x1: place.x1, z1: place.z1, y0: hi - ARCH.foundation, y1: hi + place.height, kind: 'building', ref: id, enter });
  occupy(b, x0 - 1, z0 - 1, place.x1 + 1, place.z1 + 1);
  return building;
}

/** Side of a building: 0 = west wall (x0), 1 = east (x1), 2 = north (z0), 3 = south (z1). */
export type Side = 0 | 1 | 2 | 3;

interface WallFrame {
  /** Start corner of the wall, unit tangent along it, unit outward normal, wall length. */
  ox: number;
  oz: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  len: number;
}

function wallFrame(bd: Building, side: Side): WallFrame {
  switch (side) {
    case 0: return { ox: bd.x0, oz: bd.z0, tx: 0, tz: 1, nx: -1, nz: 0, len: bd.z1 - bd.z0 };
    case 1: return { ox: bd.x1, oz: bd.z0, tx: 0, tz: 1, nx: 1, nz: 0, len: bd.z1 - bd.z0 };
    case 2: return { ox: bd.x0, oz: bd.z0, tx: 1, tz: 0, nx: 0, nz: -1, len: bd.x1 - bd.x0 };
    default: return { ox: bd.x0, oz: bd.z1, tx: 1, tz: 0, nx: 0, nz: 1, len: bd.x1 - bd.x0 };
  }
}

/** World AABB of the wall-local rectangle u in [u0, u1] (along the wall), v in [v0, v1] (outwards). */
function wallRect(f: WallFrame, u0: number, u1: number, v0: number, v1: number): [number, number, number, number] {
  const ax = f.ox + f.tx * u0 + f.nx * v0;
  const az = f.oz + f.tz * u0 + f.nz * v0;
  const bx = f.ox + f.tx * u1 + f.nx * v1;
  const bz = f.oz + f.tz * u1 + f.nz * v1;
  return [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)];
}

const ST = T.stairs;
/** Ground space an outside staircase needs: along the wall and outwards from it. */
export const STAIR_LENGTH = ST.flightRun + ST.landing * 2;
export const STAIR_DEPTH = ST.lane * 2;

/**
 * Switchback staircase along one wall, up to the roof. Flights alternate between the lane next
 * to the wall and the outer lane; every landing spans both. Returns false when the wall is too short.
 */
export function addStairs(b: Builder, bd: Building, side: Side): boolean {
  const f = wallFrame(bd, side);
  if (f.len < STAIR_LENGTH) return false;
  const uS = (f.len - STAIR_LENGTH) / 2;
  const uA = uS + ST.landing; // start of the flights
  const uB = uA + ST.flightRun; // end of the flights
  const roof = bd.base + bd.height;
  const foot = hAt(b, f.ox + f.tx * (uA + 0.3) + f.nx * ST.lane * 0.5, f.oz + f.tz * (uA + 0.3) + f.nz * ST.lane * 0.5);
  const total = roof - foot;
  if (total < 0.6) return false;
  const flights = Math.max(1, Math.ceil(total / ST.flightRise - 1e-6));
  const rise = total / flights;
  const steps = Math.max(2, Math.ceil(rise / ST.rise - 1e-6));
  const stepRise = rise / steps;
  const stepRun = ST.flightRun / steps;
  const push = (r: [number, number, number, number], y0: number, y1: number): void => {
    b.solids.push({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], y0, y1, kind: 'stair', ref: bd.id });
  };

  for (let k = 0; k < flights; k++) {
    const v0 = (k % 2) * ST.lane;
    const y = foot + k * rise;
    for (let i = 0; i < steps; i++) {
      const top = y + (i + 1) * stepRise;
      const u0 = k % 2 === 0 ? uA + i * stepRun : uB - (i + 1) * stepRun;
      // The first flight is solid down to the ground; the others are open steel treads.
      push(wallRect(f, u0, u0 + stepRun, v0, v0 + ST.lane), k === 0 ? foot - 3 : top - 0.25, top);
    }
    const landingTop = y + rise;
    const r = k % 2 === 0 ? wallRect(f, uB, uB + ST.landing, 0, STAIR_DEPTH) : wallRect(f, uS, uS + ST.landing, 0, STAIR_DEPTH);
    push(r, landingTop - 0.25, landingTop);
  }
  const strip = wallRect(f, uS, uS + STAIR_LENGTH, 0, STAIR_DEPTH);
  occupy(b, strip[0], strip[1], strip[2], strip[3]);
  bd.access = 'stairs';
  b.vantages.push({ pos: [(bd.x0 + bd.x1) / 2, roof, (bd.z0 + bd.z1) / 2], kind: bd.kind === 'tower' ? 'tower' : 'roof' });
  return true;
}

/** Ladder on one wall at `along` (0..1 of the wall length), reaching the roof. */
export function addLadder(b: Builder, bd: Building, side: Side, along = 0.5): void {
  const f = wallFrame(bd, side);
  const u = Math.min(f.len - 0.5, Math.max(0.5, f.len * along));
  const r = wallRect(f, u - 0.45, u + 0.45, 0, 0.9);
  const roof = bd.base + bd.height;
  const ground = hAt(b, (r[0] + r[2]) / 2, (r[1] + r[3]) / 2);
  b.ladders.push({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], y0: ground, y1: roof + 0.02, nx: -f.nx, nz: -f.nz });
  occupy(b, r[0], r[1], r[2], r[3]);
  bd.access = 'ladder';
  b.vantages.push({ pos: [(bd.x0 + bd.x1) / 2, roof, (bd.z0 + bd.z1) / 2], kind: bd.kind === 'tower' ? 'tower' : 'roof' });
}

/**
 * Steel lookout tower: four legs, a platform and a ladder. The Building entry describes the
 * platform (base + height = deck level); only the deck and the legs collide.
 */
export function addTower(b: Builder, x: number, z: number, deck: number = T.vantage.towerHeight, side: Side = 3): Building | null {
  const half = 2.2;
  const x0 = x - half;
  const z0 = z - half;
  const x1 = x + half;
  const z1 = z + half;
  if (!rectFree(b, x0 - 2, z0 - 2, x1 + 2, z1 + 2, 10)) return null;
  const [lo, hi] = heightRange(b, x0, z0, x1, z1);
  if (hi - lo > 3) return null;
  const bd: Building = { id: b.buildings.length, kind: 'tower', x0, z0, x1, z1, base: hi, height: deck, roof: 'flat', tint: 0.5, lootable: false, access: 'none' };
  b.buildings.push(bd);
  const top = hi + deck;
  b.solids.push({ x0, z0, x1, z1, y0: top - 0.3, y1: top, kind: 'prop', ref: bd.id });
  const leg = 0.3;
  for (const [lx, lz] of [[x0, z0], [x1 - leg, z0], [x0, z1 - leg], [x1 - leg, z1 - leg]] as const) {
    b.solids.push({ x0: lx, z0: lz, x1: lx + leg, z1: lz + leg, y0: lo - 2, y1: top - 0.3, kind: 'prop', ref: bd.id });
  }
  occupy(b, x0, z0, x1, z1);
  addLadder(b, bd, side, 0.5);
  return bd;
}

/** Empty flat map for tests and the firing range (04): height `level` everywhere. */
export function createFlatBuilder(level = 0, params: Partial<GenParams> = {}): Builder {
  const b = createBuilder({ mapSeed: 1, land: 'rural', isHome: false, lootSpots: 0, ...params });
  b.height.fill(level);
  return b;
}
