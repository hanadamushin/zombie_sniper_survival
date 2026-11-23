// Building yard (07d, debug): every enterable building type on flat ground, in two rows facing a
// street — the first row's fronts face south (rot 0), the second row's north (rot 2). Like the firing
// range it needs no world data (state.flags.range + state.flags.yard; area.ts). Tests and e2e walk
// into the buildings here; the 07d-2 sessions see their new types appear in it automatically.
//
// 07d-2e: types too big for the streets (the stations of the big cities, airports: up to 850 × 270 m)
// stand in a second yard instead (`?yard=2`, state.flags.yard === 2), once each, fronts facing south.

import { BUILDING_DEFS, type BuildingDef } from '../../gen/buildings/index.ts';
import { addEnterable, createFlatBuilder, N } from '../../gen/builder.ts';
import { finishMap, type TacticalMap } from '../../gen/index.ts';
import { applyLandmark } from '../../gen/real/landmarks.ts';

/** The street between the two rows (z) and where the first building starts (x). */
export const YARD = { street: 520, startX: 120, gap: 14, streetHalf: 9 } as const;
/**
 * 07d-2b: when a row would run off the map (x past `endX`) it goes on along the next street (z).
 * 07d-2d: the streets are spaced by the depth of what stands on them (school sites and campuses
 * are 60–80 m deep): the next street goes on the +z side, then the -z side, then +z... of the
 * streets laid out so far, clear of their rows by `STREET_GAP`.
 */
const END_X = 990;
const STREET_GAP = 6;
/** 07d-2e: a type whose middle size is wider or deeper than this (m) goes to the big yard. */
export const YARD_BIG = { w: 300, d: 100 } as const;

export function bigForYard(def: BuildingDef): boolean {
  return (def.size.w[0] + def.size.w[1]) / 2 > YARD_BIG.w || (def.size.d[0] + def.size.d[1]) / 2 > YARD_BIG.d;
}

/** 07d-2f: the big Self-Defense Force sites (garrisons up to 800 × 540 m, the naval and the air base) have a third yard (`?yard=3`, flags.yard === 3). */
export function sdfYard(def: BuildingDef): boolean {
  return bigForYard(def) && (def.category === 'military' || def.category === 'base');
}

/** Which yard: 1 (or true / false) the streets, 2 the big types, 3 the big Self-Defense Force sites, 4 the landmarks (L1). */
export type YardKind = boolean | 1 | 2 | 3 | 4;
const yardNo = (k: YardKind): 1 | 2 | 3 | 4 => (k === 2 || k === true ? 2 : k === 3 ? 3 : k === 4 ? 4 : 1);
/** L1: the landmarks stand in their own yard (`?landmarks=1`), not among the enterable types. */
const isLandmark = (def: BuildingDef): boolean => def.category === 'landmark';

export interface YardEntry {
  def: string;
  /** TacticalMap.placements index. */
  enter: number;
  rot: 0 | 2;
}

let cached: { map: TacticalMap; entries: YardEntry[] } | null = null;
let cachedBig: { map: TacticalMap; entries: YardEntry[] } | null = null;
let cachedSdf: { map: TacticalMap; entries: YardEntry[] } | null = null;

function build(): { map: TacticalMap; entries: YardEntry[] } {
  const b = createFlatBuilder(0, { mapSeed: 11, land: 'suburb', lootSpots: 100000, allShelves: true });
  const entries: YardEntry[] = [];
  const defs = BUILDING_DEFS.filter((def) => !bigForYard(def) && !isLandmark(def));
  // Where each type stands along which street (both rows break at the same types).
  const slots: { x: number; street: number }[] = [];
  const depth: number[] = [0];
  let x = YARD.startX;
  let street = 0;
  for (const def of defs) {
    const w = (def.size.w[0] + def.size.w[1]) / 2;
    if (x + w > END_X) {
      street++;
      depth.push(0);
      x = YARD.startX;
    }
    slots.push({ x, street });
    depth[street] = Math.max(depth[street]!, (def.size.d[0] + def.size.d[1]) / 2);
    x += w + YARD.gap;
  }
  // Street z: the first at YARD.street, the others alternately on the +z and the -z side of the band used so far.
  const zs: number[] = [YARD.street];
  let north = YARD.street + YARD.streetHalf + depth[0]!;
  let south = YARD.street - YARD.streetHalf - depth[0]!;
  for (let i = 1; i < depth.length; i++) {
    const half = YARD.streetHalf + depth[i]!;
    if (i % 2 === 1) {
      zs.push(north + STREET_GAP + half);
      north += STREET_GAP + 2 * half;
    } else {
      zs.push(south - STREET_GAP - half);
      south -= STREET_GAP + 2 * half;
    }
  }
  for (const rot of [0, 2] as const) {
    defs.forEach((def, i) => {
      const w = (def.size.w[0] + def.size.w[1]) / 2;
      const d = (def.size.d[0] + def.size.d[1]) / 2;
      const { x: x0, street: si } = slots[i]!;
      const z = zs[si]!;
      const z0 = rot === 0 ? z - YARD.streetHalf - d : z + YARD.streetHalf;
      const bd = addEnterable(b, def.id, x0, z0, w, d, rot);
      entries.push({ def: def.id, enter: bd.enter!, rot });
    });
  }
  const map = finishMap(b);
  map.spawn.edge = [YARD.startX - 8, YARD.street];
  map.spawn.edgeYaw = -Math.PI / 2; // facing east along the street
  return { map, entries };
}

/**
 * 07d-2e: the big yard. Rows from the south edge northwards, each as deep as its deepest type, the
 * fronts facing south onto a street in front of the row; a row ends where the next type would run
 * past END_X.
 */
function buildBig(sdf = false): { map: TacticalMap; entries: YardEntry[] } {
  const b = createFlatBuilder(0, { mapSeed: sdf ? 13 : 12, land: 'suburb', lootSpots: 100000, allShelves: true });
  const entries: YardEntry[] = [];
  const defs = BUILDING_DEFS.filter((def) => bigForYard(def) && sdfYard(def) === sdf && !isLandmark(def));
  const rows: BuildingDef[][] = [];
  let x = END_X;
  for (const def of defs) {
    const w = (def.size.w[0] + def.size.w[1]) / 2;
    if (x + w > END_X) {
      rows.push([]);
      x = BIG_START_X;
    }
    rows[rows.length - 1]!.push(def);
    x += w + YARD.gap;
  }
  let z0 = BIG_START_Z;
  let first = YARD.street;
  for (const row of rows) {
    const deep = Math.max(...row.map((def) => (def.size.d[0] + def.size.d[1]) / 2));
    let rx = BIG_START_X;
    for (const def of row) {
      const w = (def.size.w[0] + def.size.w[1]) / 2;
      const d = (def.size.d[0] + def.size.d[1]) / 2;
      // Fronts on the row's street, at its back edge if shallower than the row.
      const bd = addEnterable(b, def.id, rx, z0 + deep - d, w, d, 0);
      entries.push({ def: def.id, enter: bd.enter!, rot: 0 });
      rx += w + YARD.gap;
    }
    if (row === rows[0]) first = z0 + deep + YARD.streetHalf;
    z0 += deep + 2 * YARD.streetHalf + STREET_GAP;
  }
  const map = finishMap(b);
  map.spawn.edge = [BIG_START_X - 8, first];
  map.spawn.edgeYaw = -Math.PI / 2;
  return { map, entries };
}
const BIG_START_X = 30;
const BIG_START_Z = 20;

/**
 * L1: the landmark yard (`?landmarks=1`, flags.yard === 4): every landmark of every region on flat
 * ground, fronts facing south onto a street, in rows from the north edge (like the big yard), with
 * their moats and canals dug and their firing positions. The tests and the e2e measure it.
 */
function buildLandmarks(): { map: TacticalMap; entries: YardEntry[] } {
  const b = createFlatBuilder(0, { mapSeed: 14, land: 'urban', lootSpots: 0 });
  const water = new Float32Array(N * N).fill(NaN);
  const entries: YardEntry[] = [];
  const defs = BUILDING_DEFS.filter(isLandmark);
  const gap = 24;
  let x = LM_START;
  let z0 = LM_START;
  let deep = 0;
  let first = 0;
  for (const def of defs) {
    const w = def.size.w[1];
    const d = def.size.d[1];
    if (x + w > END_X && x > LM_START) {
      z0 += deep + 2 * YARD.streetHalf + gap;
      x = LM_START;
      deep = 0;
    }
    const bd = addEnterable(b, def.id, x, z0, w, d, 0);
    applyLandmark(b, bd, water);
    entries.push({ def: def.id, enter: bd.enter!, rot: 0 });
    deep = Math.max(deep, d);
    if (z0 === LM_START) first = z0 + deep + YARD.streetHalf;
    x += w + gap;
  }
  const map = finishMap(b);
  map.water = water;
  map.spawn.edge = [LM_START - 8, first];
  map.spawn.edgeYaw = -Math.PI / 2;
  return { map, entries };
}
const LM_START = 30;
let cachedLandmarks: { map: TacticalMap; entries: YardEntry[] } | null = null;

function yardOf(kind: YardKind): { map: TacticalMap; entries: YardEntry[] } {
  const n = yardNo(kind);
  if (n === 4) return (cachedLandmarks ??= buildLandmarks());
  return n === 3 ? (cachedSdf ??= buildBig(true)) : n === 2 ? (cachedBig ??= buildBig()) : (cached ??= build());
}

export function yardMap(big: YardKind = false): TacticalMap {
  return yardOf(big).map;
}

export function yardEntries(big: YardKind = false): YardEntry[] {
  return yardOf(big).entries;
}
