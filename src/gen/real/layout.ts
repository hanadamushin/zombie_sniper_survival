// R0: an operation area made from the real data of its cell (docs/02_systems_spec.md §3.11).
//
// The area is the cell's real 10 km square shrunk 1/10 horizontally. Positions and extents shrink;
// people, buildings, road widths and trees keep their true size. So nothing is copied one by one:
//   terrain      real elevation (129² lattice, every 78 m of the real ground), heights compressed by
//                REAL_AREA.height (more in the mountains) so that the ground stays walkable
//   water        the sea where the elevation data stops; rivers and lakes from the land use (rivers
//                carved a little, a water surface drawn over them — map.water)
//   land use     paddies, fields, forest, open ground, beaches at their shrunk place (128² of 8 m)
//   roads, rails the main roads (motorway, national, prefectural, 13 m+) and the railways at their
//                shrunk place and true width; the narrow streets come from the town generator
//   towns        a street lattice over the built-up land, filled with 07d buildings whose density and
//                height follow the population and the share of durable buildings
//   facilities   stations, town halls, hospitals, schools, police, fire, SDF at their shrunk place
// Neighbouring real cells share their edge samples, so terrain, water and roads meet; next to a cell
// without real data the terrain fades into the 07c world function over REAL_AREA.seamBand.

import { chance, rand, randInt, randRange, type RngState } from '../../core/rng.ts';
import { REAL_AREA, REAL_LANDMARKS } from '../../data/realmap.ts';
import { TACTICAL } from '../../data/tactical.ts';
import { buildingDef } from '../buildings/catalog/index.ts';
import { envelopeOf, type Rot } from '../buildings/index.ts';
import {
  addBuilding, addRoad, addStairs, addTower, forTiles, heightRange, homeDist, inHomeZone, N, occupy, rectFree, rngOf, SIZE, STAIR_DEPTH, STAIR_LENGTH,
  TILE, TILES, tileIndex, type Builder,
} from '../builder.ts';
import { enterableIn, farmstead } from '../lands.ts';
import { noise2, smoothstep } from '../noise.ts';
import { GROUND, type Building, type GenParams, type MapPoi } from '../types.ts';
import { DUR_N, ELEV_N, LINE, LINE_TUNNEL, LU, LU_N, POI, POP_N, type RealArea } from './format.ts';

const R = REAL_AREA;
const T = TACTICAL;
const STEP = SIZE / (ELEV_N - 1); // 8 m between lattice points
const MID = SIZE / 2;

// ---------------------------------------------------------------------------------------------
// Heights
// ---------------------------------------------------------------------------------------------

/** Game height (m above the sea) of a real elevation (m): the compression of REAL_AREA.height. */
export function compressHeight(e: number, mul = 1): number {
  const K = R.height.knots;
  if (e <= 0) return e * K[0]![1] * mul;
  let h = 0;
  for (let k = 0; k + 1 < K.length; k++) {
    const [e0, s0] = K[k]!;
    const [e1, s1] = K[k + 1]!;
    if (e <= e0) break;
    const top = Math.min(e, e1);
    const sTop = s0 + ((s1 - s0) * (top - e0)) / (e1 - e0);
    h += ((s0 + sTop) / 2) * (top - e0);
  }
  const [eL, sL] = K[K.length - 1]!;
  if (e > eL) h += sL * (e - eL);
  return h * mul;
}

/** Lattice of game heights (sea: the sea bed) from the area's real elevations. */
function latticeHeights(real: RealArea, isHome: boolean): Float32Array {
  const mul = real.heightMul ?? 1;
  const out = new Float32Array(ELEV_N * ELEV_N);
  for (let i = 0; i < out.length; i++) {
    const e = real.elev[i]!;
    out[i] = Number.isFinite(e) ? compressHeight(e, mul) : R.seaBed;
  }
  if (isHome) {
    // The base needs dry ground: the middle of a home area is never sea.
    for (let j = 0; j < ELEV_N; j++) for (let i = 0; i < ELEV_N; i++) {
      if (Math.hypot(i * STEP - MID, j * STEP - MID) < T.homeBlendRadius + 20 && !Number.isFinite(real.elev[j * ELEV_N + i]!)) out[j * ELEV_N + i] = compressHeight(1, mul);
    }
  }
  return out;
}

const cr = (p0: number, p1: number, p2: number, p3: number, t: number): number =>
  p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));

/** Catmull–Rom over the lattice (clamped at the borders, so the apron continues the edge). */
function bicubic(L: Float32Array, x: number, z: number): number {
  const fx = Math.min(ELEV_N - 1, Math.max(0, x / STEP));
  const fz = Math.min(ELEV_N - 1, Math.max(0, z / STEP));
  const i = Math.min(ELEV_N - 2, Math.floor(fx));
  const j = Math.min(ELEV_N - 2, Math.floor(fz));
  const tx = fx - i;
  const tz = fz - j;
  const at = (a: number, b: number): number => L[Math.min(ELEV_N - 1, Math.max(0, b)) * ELEV_N + Math.min(ELEV_N - 1, Math.max(0, a))]!;
  const row = (b: number): number => cr(at(i - 1, b), at(i, b), at(i + 1, b), at(i + 2, b), tx);
  return cr(row(j - 1), row(j), row(j + 1), row(j + 2), tz);
}

/** Bilinear share 0..1 of lattice points with the class test true. */
function shareAt(real: RealArea, test: (c: number) => boolean, x: number, z: number): number {
  const fx = Math.min(LU_N - 1, Math.max(0, x / STEP));
  const fz = Math.min(LU_N - 1, Math.max(0, z / STEP));
  const i = Math.min(LU_N - 2, Math.floor(fx));
  const j = Math.min(LU_N - 2, Math.floor(fz));
  const tx = fx - i;
  const tz = fz - j;
  const v = (a: number, b: number): number => (test(real.landuse[b * LU_N + a]!) ? 1 : 0);
  return (v(i, j) * (1 - tx) + v(i + 1, j) * tx) * (1 - tz) + (v(i, j + 1) * (1 - tx) + v(i + 1, j + 1) * tx) * tz;
}

/** Land-use class of the nearest lattice point. */
export function luAt(real: RealArea, x: number, z: number): number {
  const i = Math.min(LU_N - 1, Math.max(0, Math.round(x / STEP)));
  const j = Math.min(LU_N - 1, Math.max(0, Math.round(z / STEP)));
  return real.landuse[j * LU_N + i]!;
}

const isWater = (c: number): boolean => c === LU.water || c === LU.sea;

/**
 * Terrain height function of a real area (local coordinates, valid outside the square: the apron).
 * `synth` is the 07c world function, used towards neighbours that have no real data.
 */
export function realTerrain(params: GenParams, real: RealArea, synth: ((x: number, z: number) => number) | null): (x: number, z: number) => number {
  const L = latticeHeights(real, params.isHome);
  const world = params.world;
  const ox = world ? world.gx * SIZE : 0;
  const oz = world ? world.gy * SIZE : 0;
  const seed = world ? world.seed : params.mapSeed;
  // Sides whose neighbour is land without real data: 0 west, 1 east, 2 north, 3 south.
  const fake = [3, 5, 1, 7].map((k) => Boolean(world?.around[k] && !world.around[k]!.real));
  const band = R.seamBand;
  const detail = R.height.detail;
  return (x, z) => {
    let h = bicubic(L, x, z);
    // Water carving: rivers and lakes sit a little below their banks (the surface is map.water).
    const w = shareAt(real, (c) => c === LU.water, x, z);
    if (w > 0.3) h -= R.riverDepth * smoothstep(0.3, 0.8, w);
    if (detail > 0) h += detail * noise2((ox + x) / 19, (oz + z) / 19, seed ^ 0x51ed);
    if (synth && fake.some(Boolean)) {
      // Weight of each side without real data: 1 on that side, 0 a band inside — and 0 at both ends
      // of the side, so that the edges shared with real neighbours stay exactly the real ground.
      let w = 0;
      const side = (dist: number, along: number): void => {
        if (dist >= band) return;
        const ends = smoothstep(0, band, Math.min(along, SIZE - along));
        w = Math.max(w, (1 - smoothstep(0, band, dist)) * ends);
      };
      if (fake[0]) side(x, z);
      if (fake[1]) side(SIZE - x, z);
      if (fake[2]) side(z, x);
      if (fake[3]) side(SIZE - z, x);
      if (w > 0) h += (synth(x, z) - h) * w;
    }
    return h;
  };
}

// ---------------------------------------------------------------------------------------------
// Water and ground classes
// ---------------------------------------------------------------------------------------------

/** Water surface per height vertex (NaN: dry), and the ground classes of water / beach tiles. */
function waterAndGround(b: Builder, real: RealArea, terrain: (x: number, z: number) => number): Float32Array {
  const water = new Float32Array(N * N).fill(NaN);
  const L = latticeHeights(real, b.params.isHome);
  for (let iz = 0; iz < N; iz++) {
    for (let ix = 0; ix < N; ix++) {
      const x = ix * TILE;
      const z = iz * TILE;
      if (b.params.isHome && homeDist(x, z) < T.homeBlendRadius) continue;
      const sea = shareAt(real, (c) => c === LU.sea, x, z);
      const river = shareAt(real, (c) => c === LU.water, x, z);
      if (sea >= 0.5) water[iz * N + ix] = 0;
      else if (river >= 0.45) water[iz * N + ix] = bicubic(L, x, z) - R.riverSurface;
    }
  }
  void terrain;
  for (let ty = 0; ty < TILES; ty++) {
    for (let tx = 0; tx < TILES; tx++) {
      const i = ty * N + tx;
      const wet = [i, i + 1, i + N, i + N + 1].filter((k) => Number.isFinite(water[k]!)).length;
      const t = ty * TILES + tx;
      if (wet >= 3) {
        b.ground[t] = GROUND.water;
        b.occupied[t] = 1;
      } else {
        const c = luAt(real, (tx + 0.5) * TILE, (ty + 0.5) * TILE);
        if (c === LU.beach) b.ground[t] = GROUND.sand;
        else if (c === LU.forest) b.ground[t] = GROUND.forest;
        else if (c === LU.golf) b.ground[t] = GROUND.park;
        else if (c === LU.rail) b.ground[t] = GROUND.track;
      }
    }
  }
  return water;
}

// ---------------------------------------------------------------------------------------------
// Roads and railways
// ---------------------------------------------------------------------------------------------

function realRoads(b: Builder, real: RealArea, water: Float32Array): void {
  const order = [...real.lines].sort((a, c) => c.width - a.width);
  for (const line of order) {
    if (line.flags & LINE_TUNNEL) continue; // inside the mountain
    if (line.kind === LINE.river) continue;
    const pts: [number, number][] = [];
    for (let k = 0; k < line.pts.length; k += 2) pts.push([line.pts[k]!, line.pts[k + 1]!]);
    if (pts.length < 2) continue;
    const rail = line.kind === LINE.rail || line.kind === LINE.shinkansen;
    const kind = rail ? 'track' : line.kind === LINE.motorway || line.width >= 14 ? 'avenue' : line.kind === LINE.local ? 'lane' : 'street';
    // Over water a road is carried on an embankment (R0: no bridge decks yet).
    causeway(b, pts, line.width, water);
    addRoad(b, kind, line.width, pts, true);
  }
}

/** Raise the ground and drop the water under a road that crosses a river or the sea. */
function causeway(b: Builder, pts: [number, number][], width: number, water: Float32Array): void {
  const reach = width / 2 + 3;
  // The edge samples are never changed (the neighbour must see the same ground and water there); a
  // river under a road at the very edge is waded (TACTICAL.player.wadeMax).
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, az] = pts[k]!;
    const [bx, bz] = pts[k + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / 2));
    for (let s = 0; s <= n; s++) {
      const x = ax + ((bx - ax) * s) / n;
      const z = az + ((bz - az) * s) / n;
      const ix0 = Math.max(0, Math.ceil((x - reach) / TILE));
      const ix1 = Math.min(N - 1, Math.floor((x + reach) / TILE));
      const iz0 = Math.max(0, Math.ceil((z - reach) / TILE));
      const iz1 = Math.min(N - 1, Math.floor((z + reach) / TILE));
      for (let iz = Math.max(1, iz0); iz <= Math.min(N - 2, iz1); iz++) for (let ix = Math.max(1, ix0); ix <= Math.min(N - 2, ix1); ix++) {
        const i = iz * N + ix;
        const lvl = water[i]!;
        if (!Number.isFinite(lvl)) continue;
        if (Math.hypot(ix * TILE - x, iz * TILE - z) > reach) continue;
        b.height[i] = Math.max(b.height[i]!, lvl + R.causeway);
        water[i] = NaN;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Density of the town
// ---------------------------------------------------------------------------------------------

/** Persons per km² (real) at a point. */
function popAt(real: RealArea, x: number, z: number): number {
  const i = Math.min(POP_N - 1, Math.max(0, Math.floor((x / SIZE) * POP_N)));
  const j = Math.min(POP_N - 1, Math.max(0, Math.floor((z / SIZE) * POP_N)));
  return real.pop[j * POP_N + i]!;
}
/** Share 0..1 of durable buildings around a point. */
function durableAt(real: RealArea, x: number, z: number): number {
  const i = Math.min(DUR_N - 1, Math.max(0, Math.floor((x / SIZE) * DUR_N)));
  const j = Math.min(DUR_N - 1, Math.max(0, Math.floor((z / SIZE) * DUR_N)));
  return real.durable[j * DUR_N + i]! / 15;
}
/** Grade of the town at a point: 1 houses, 2 dense low-rise, 3 mid-rise, 4 high-rise core. */
export function townGrade(real: RealArea, x: number, z: number): number {
  const G = R.town;
  const pop = popAt(real, x, z);
  const dur = durableAt(real, x, z);
  if (dur >= G.highDurable && pop >= G.highPop) return 4;
  if (dur >= G.midDurable || pop >= G.midPop) return 3;
  if (pop >= G.densePop) return 2;
  return 1;
}

const townLand = (c: number): boolean => c === LU.building;

/**
 * Lots are tested against what stood before the town was filled (roads, water, facilities), not
 * against the neighbouring lots: their 4 m tile margins would leave every other house out.
 */
let before: Uint8Array | null = null;
function lotFree(x0: number, z0: number, x1: number, z1: number): boolean {
  if (x0 < 8 || z0 < 8 || x1 > SIZE - 8 || z1 > SIZE - 8) return false;
  let free = true;
  forTiles(x0, z0, x1, z1, (i) => {
    if (before![i]) free = false;
  });
  return free;
}
/** Ground a town lot may take: anything built-up or open, not fields, woods or water. */
const lotLand = (c: number): boolean => c === LU.building || c === LU.other || c === LU.road || c === LU.rail || c === LU.waste;

// ---------------------------------------------------------------------------------------------
// Facilities at their real place
// ---------------------------------------------------------------------------------------------

/** Rough footprint (m) and height of the facilities R0 builds as boxes. */
function facility(b: Builder, rng: RngState, kind: number, grade: number, x: number, z: number, enterRng: RngState): Building | null {
  const F = R.facilities;
  const spec = kind === POI.station ? (grade >= 3 ? F.stationBig : F.station)
    : kind === POI.prefOffice ? F.prefOffice
      : kind === POI.cityHall ? F.cityHall
        : kind === POI.townHall ? F.townHall
          : kind === POI.hospital ? (grade >= 2 ? F.hospitalBig : F.hospital)
            : kind === POI.university ? F.university
              : kind === POI.school ? F.school
                : kind === POI.police || kind === POI.fire ? F.small
                  : null;
  if (kind === POI.gsdf) {
    // 07d-2f: a small garrison where it really is (07d-3 chooses the size; R0 puts the small one).
    // R2: the compound (180 × 100 m: 1.8 × 1 km of the real ground, more than most real garrisons) seldom
    // fits right at the annotation in a town, between the data roads: the nearest free and level enough
    // spot within 160 m, either way round, the full size or the def's smallest (150 × 90 m).
    for (let r = 0; r <= 160; r += 16) {
      const steps = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 16);
      for (let s = 0; s < steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const cx = x + Math.cos(a) * r;
        const cz = z + Math.sin(a) * r;
        for (const [hw, hd] of [[90, 50], [75, 45]] as const) {
          for (const rot of [0, 1] as const) {
            const [ex, ez] = rot === 0 ? [hw, hd] : [hd, hw];
            const [x0, z0, x1, z1] = [cx - ex, cz - ez, cx + ex, cz + ez];
            if (inHomeZone(b, x0, z0, x1, z1) || !rectFree(b, x0, z0, x1, z1, 14)) continue;
            const [lo, hi] = heightRange(b, x0, z0, x1, z1);
            if (hi - lo > R.facilityMaxSlope * 3) continue;
            const bd = enterableIn(b, 'base.jgsdf_s', x0, z0, x1, z1, rot);
            if (bd) return bd;
          }
        }
      }
    }
    return null;
  }
  if (!spec) return null;
  for (let tries = 0; tries < 12; tries++) {
    const a = rand(rng) * Math.PI * 2;
    const d = tries === 0 ? 0 : 6 + tries * 4;
    const cx = x + Math.cos(a) * d;
    const cz = z + Math.sin(a) * d;
    const w = spec.w;
    const dd = spec.d;
    const alongX = chance(rng, 0.5);
    const ww = alongX ? w : dd;
    const wd = alongX ? dd : w;
    const x0 = cx - ww / 2;
    const z0 = cz - wd / 2;
    if (!rectFree(b, x0 - 2, z0 - 2, x0 + ww + 2, z0 + wd + 2, 12) || inHomeZone(b, x0, z0, x0 + ww, z0 + wd)) continue;
    const [lo, hi] = heightRange(b, x0, z0, x0 + ww, z0 + wd);
    if (hi - lo > R.facilityMaxSlope) continue;
    // Some town halls and stations are the enterable office (07d-3 will pick the real types).
    if ((kind === POI.cityHall || kind === POI.townHall) && chance(enterRng, 0.5)) {
      const bd = enterableIn(b, 'office.zakkyo5', x0, z0, x0 + ww, z0 + wd, 0);
      if (bd) return bd;
    }
    const bd = addBuilding(b, spec.kind, x0, z0, x0 + ww, z0 + wd, randRange(rng, spec.h[0], spec.h[1]), { tint: rand(rng) });
    if (spec.yard) b.areas.push({ kind: 'yard', x0: x0 - 4, z0: z0 + wd + 2, x1: x0 + ww + 4, z1: z0 + wd + 2 + spec.yard, variant: rand(rng) });
    if (spec.h[0] >= 9 && chance(rng, 0.4)) {
      if (rectFree(b, x0 - STAIR_DEPTH - 2, z0, x0 - 1, z0 + wd, 8) && wd >= STAIR_LENGTH) addStairs(b, bd, 0);
    }
    return bd;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Towns: a street lattice over the built-up land, filled by grade
// ---------------------------------------------------------------------------------------------

function realTowns(b: Builder, real: RealArea): void {
  const G = R.town;
  const rng = rngOf(b, 'real.town');
  const enterRng = rngOf(b, 'real.town.enterable');
  const world = b.params.world;
  const ox = world ? world.gx * SIZE : 0;
  const oz = world ? world.gy * SIZE : 0;
  const sp = G.block;
  // Street lines in WORLD position (k × block + offset), so that neighbouring towns line up.
  const first = (o: number): number => Math.ceil((o - G.offset) / sp) * sp + G.offset - o;
  const xs: number[] = [];
  const zs: number[] = [];
  // Lines on (or right at) the map edge are left out: the neighbour decides its own side.
  for (let v = first(ox); v < SIZE; v += sp) if (v > G.edgeClear && v < SIZE - G.edgeClear) xs.push(v);
  for (let v = first(oz); v < SIZE; v += sp) if (v > G.edgeClear && v < SIZE - G.edgeClear) zs.push(v);
  const townShare = (x: number, z: number): number => shareAt(real, townLand, x, z);

  // Streets: runs of a lattice line over town land (and not over water).
  const streets = (lines: number[], alongX: boolean): void => {
    for (const pos of lines) {
      let run: [number, number][] = [];
      let grade = 1;
      const flush = (): void => {
        if (run.length >= 5) {
          const width = grade >= 3 ? G.streetWide : G.street;
          const a = run[0]!;
          const c = run[run.length - 1]!;
          addRoad(b, 'street', width, [a, c], true);
        }
        run = [];
        grade = 1;
      };
      // Town streets stop short of the map edge (only the real roads cross into the next area).
      for (let s = G.edgeClear; s <= SIZE - G.edgeClear; s += STEP) {
        const x = alongX ? s : pos;
        const z = alongX ? pos : s;
        const c = luAt(real, x, z);
        const t = tileIndex(x, z);
        // Not through a facility built at its real place (occupied, but not a road).
        const taken = b.occupied[t] === 1 && b.ground[t] !== GROUND.road && b.ground[t] !== GROUND.track;
        const ok = townShare(x, z) >= 0.4 && !isWater(c) && !taken && !(b.params.isHome && homeDist(x, z) < T.homeFlatRadius + 10);
        if (ok) {
          run.push([x, z]);
          grade = Math.max(grade, townGrade(real, x, z));
        } else flush();
      }
      flush();
    }
  };
  streets(zs, true);
  streets(xs, false);

  // Blocks between the lines (and the map edge).
  const spans = (lines: number[]): [number, number][] => {
    const out: [number, number][] = [];
    let prev = 4;
    const m = G.streetWide / 2 + 3; // clear of the widest street's tiles
    for (const l of lines) {
      if (l - m - prev >= 16) out.push([prev, l - m]);
      prev = l + m;
    }
    if (SIZE - 4 - prev >= 16) out.push([prev, SIZE - 4]);
    return out;
  };
  const climbables: Building[] = [];
  before = b.occupied.slice();
  for (const [x0, x1] of spans(xs)) {
    for (const [z0, z1] of spans(zs)) {
      // How much of the block is town, and its grade.
      let town = 0;
      let built = 0;
      let count = 0;
      let grade = 1;
      for (let z = z0 + 4; z < z1; z += STEP) for (let x = x0 + 4; x < x1; x += STEP) {
        count++;
        const c = luAt(real, x, z);
        if (lotLand(c)) built++;
        if (townLand(c)) {
          town++;
          grade = Math.max(grade, townGrade(real, x, z));
        }
      }
      const share = count && built / count >= G.blockMinShare ? town / count : 0;
      if (share < G.blockMinTown) {
        // Scattered houses in the fields: farmsteads on the town points.
        if (share > 0 && chance(rng, share * 4)) {
          for (let z = z0 + 4; z < z1; z += STEP * 2) for (let x = x0 + 4; x < x1; x += STEP * 2) {
            if (townLand(luAt(real, x, z)) && chance(rng, 0.5)) farmstead(b, rng, x, z, enterRng);
          }
        }
        continue;
      }
      if (inHomeZone(b, x0, z0, x1, z1, -40)) continue;
      if (grade >= 3) urbanBlock(b, rng, enterRng, real, x0, z0, x1, z1, grade, climbables);
      else houseBlock(b, rng, enterRng, real, x0, z0, x1, z1, grade);
    }
  }
  gapFill(b, rng, enterRng, real);
}

/**
 * Fill what the blocks left between the real roads: a scan of candidate lots over the built-up land,
 * each kept when nothing stands there yet.
 */
function gapFill(b: Builder, rng: RngState, enterRng: RngState, real: RealArea): void {
  const G = R.town;
  // Exact spacing between buildings (the 4 m occupancy tiles would keep every other house out);
  // roads, water and facilities from the snapshot taken before the town.
  const cell = 16;
  const cells = SIZE / cell;
  const near: number[][] = Array.from({ length: cells * cells }, () => []);
  const index = (bd: Building): void => {
    for (let cz = Math.max(0, Math.floor(bd.z0 / cell)); cz <= Math.min(cells - 1, Math.floor(bd.z1 / cell)); cz++) {
      for (let cx = Math.max(0, Math.floor(bd.x0 / cell)); cx <= Math.min(cells - 1, Math.floor(bd.x1 / cell)); cx++) near[cz * cells + cx]!.push(bd.id);
    }
  };
  for (const bd of b.buildings) index(bd);
  const clear = (x0: number, z0: number, x1: number, z1: number, gap: number): boolean => {
    if (!lotFree(x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5)) return false;
    for (let cz = Math.max(0, Math.floor((z0 - gap) / cell)); cz <= Math.min(cells - 1, Math.floor((z1 + gap) / cell)); cz++) {
      for (let cx = Math.max(0, Math.floor((x0 - gap) / cell)); cx <= Math.min(cells - 1, Math.floor((x1 + gap) / cell)); cx++) {
        for (const id of near[cz * cells + cx]!) {
          const o = b.buildings[id]!;
          if (o.x0 < x1 + gap && o.x1 > x0 - gap && o.z0 < z1 + gap && o.z1 > z0 - gap) return false;
        }
      }
    }
    return true;
  };
  for (let z = 10; z < SIZE - 20; z += G.gapStep) {
    for (let x = 10; x < SIZE - 20; x += G.gapStep) {
      const cx = x + randRange(rng, -2, 2);
      const cz = z + randRange(rng, -2, 2);
      const c = luAt(real, cx, cz);
      const g = townGrade(real, cx, cz);
      if (!(townLand(c) || (g >= 2 && lotLand(c))) || chance(rng, G.gapSkip)) continue;
      const big = g >= 3;
      const w = big ? randRange(rng, 14, 24) : randRange(rng, 7, 10);
      const d = big ? randRange(rng, 12, 20) : randRange(rng, 6.5, 9);
      const x0 = cx - w / 2;
      const z0 = cz - d / 2;
      if (!clear(x0, z0, x0 + w, z0 + d, big ? 4 : G.gapHouse) || inHomeZone(b, x0, z0, x0 + w, z0 + d)) continue;
      const [lo, hi] = heightRange(b, x0, z0, x0 + w, z0 + d);
      if (hi - lo > 2.5) continue;
      let bd: Building | null = null;
      if (big) {
        const h = g >= 4 && chance(rng, 0.5) ? Math.round(randRange(rng, G.highFloors[0], G.highFloors[1])) * 3.4 : randInt(rng, G.midFloors[0], G.midFloors[1]) * 3;
        bd = addBuilding(b, chance(rng, 0.5) ? 'apartment' : 'office', x0, z0, x0 + w, z0 + d, h, { tint: rand(rng) });
      } else {
        if (chance(enterRng, T.enterable.house)) bd = enterableIn(b, 'house.wood2', x0, z0, x0 + w, z0 + d, randInt(rng, 0, 3) as Rot);
        bd ??= addBuilding(b, 'house', x0, z0, x0 + w, z0 + d, chance(rng, 0.25) ? 3.2 : randRange(rng, 5.6, 6.6), { roof: 'gable', tint: rand(rng) });
      }
      index(bd);
    }
  }
}

function urbanBlock(b: Builder, rng: RngState, enterRng: RngState, real: RealArea, bx0: number, bz0: number, bx1: number, bz1: number, grade: number, climbables: Building[]): void {
  const G = R.town;
  if (chance(rng, G.openShare) && bx1 - bx0 > 30 && bz1 - bz0 > 30) {
    b.areas.push({ kind: chance(rng, 0.5) ? 'parking' : 'plaza', x0: bx0, z0: bz0, x1: bx1, z1: bz1, variant: rand(rng) });
    forTiles(bx0, bz0, bx1, bz1, (i) => {
      if (b.ground[i] !== GROUND.water) b.ground[i] = GROUND.paved;
    });
    occupy(b, bx0, bz0, bx1, bz1);
    return;
  }
  const lots: [number, number, number, number][] = [];
  const split = (x0: number, z0: number, x1: number, z1: number): void => {
    if (x1 - x0 <= G.lotMax && z1 - z0 <= G.lotMax) {
      lots.push([x0, z0, x1, z1]);
      return;
    }
    const t = randRange(rng, 0.38, 0.62);
    if (x1 - x0 >= z1 - z0) {
      const m = Math.round(x0 + (x1 - x0) * t);
      split(x0, z0, m, z1);
      split(m, z0, x1, z1);
    } else {
      const m = Math.round(z0 + (z1 - z0) * t);
      split(x0, z0, x1, m);
      split(x0, m, x1, z1);
    }
  };
  split(bx0, bz0, bx1, bz1);
  for (const [x0, z0, x1, z1] of lots) {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    if (!lotLand(luAt(real, cx, cz)) || chance(rng, 0.06)) continue;
    const inset = randRange(rng, 1.2, 3);
    const lx0 = x0 + inset;
    const lz0 = z0 + inset;
    const lx1 = x1 - inset;
    const lz1 = z1 - inset;
    if (lx1 - lx0 < 8 || lz1 - lz0 < 8) continue;
    if (!lotFree(lx0, lz0, lx1, lz1) || inHomeZone(b, lx0, lz0, lx1, lz1)) continue;
    const [lo, hi] = heightRange(b, lx0, lz0, lx1, lz1);
    if (hi - lo > 3) continue;
    const g = townGrade(real, cx, cz);
    const r = rand(rng);
    let kind: Building['kind'];
    let h: number;
    if (g >= 4 && r < 0.55) {
      kind = 'office';
      h = Math.round(randRange(rng, G.highFloors[0], G.highFloors[1])) * 3.4;
    } else if (r < 0.3 + (g >= 4 ? 0.2 : 0)) {
      kind = 'office';
      h = Math.round(randRange(rng, 4, 8)) * 3.4;
    } else if (r < 0.75) {
      kind = 'apartment';
      h = randInt(rng, G.midFloors[0], G.midFloors[1]) * 3;
    } else if (r < 0.92) {
      kind = 'shop';
      h = randRange(rng, 4.5, 8);
    } else {
      kind = 'warehouse';
      h = randRange(rng, 7, 11);
    }
    void grade;
    if (kind === 'office' && h <= 18 && chance(enterRng, T.enterable.office)) {
      if (enterableIn(b, 'office.zakkyo5', lx0, lz0, lx1, lz1, 0)) continue;
    }
    if (kind === 'shop' && chance(enterRng, T.enterable.shop)) {
      if (enterableIn(b, 'shop.konbini', lx0, lz0, lx1, lz1, 0)) continue;
    }
    const wantStairs = h >= 9 && h <= 34 && climbables.length < R.town.climbable && climbables.every((c) => Math.hypot((c.x0 + c.x1) / 2 - cx, (c.z0 + c.z1) / 2 - cz) > 150);
    const room = STAIR_DEPTH + 0.8;
    if (wantStairs && lx1 - lx0 >= STAIR_LENGTH + room + 4 && lz1 - lz0 >= STAIR_LENGTH + 2) {
      const bd = addBuilding(b, kind, lx0 + room, lz0, lx1, lz1, h, { tint: rand(rng) });
      if (addStairs(b, bd, 0)) climbables.push(bd);
      continue;
    }
    addBuilding(b, kind, lx0, lz0, lx1, lz1, h, { tint: rand(rng) });
  }
}

function houseBlock(b: Builder, rng: RngState, enterRng: RngState, real: RealArea, bx0: number, bz0: number, bx1: number, bz1: number, grade: number): void {
  const G = R.town;
  const w = bx1 - bx0;
  const d = bz1 - bz0;
  // A low apartment block now and then in the denser parts.
  if (grade >= 2 && chance(rng, G.apartmentShare) && w > 36 && d > 30) {
    const floors = randInt(rng, 3, 5);
    const x0 = bx0 + 4;
    const z0 = bz0 + d / 2 - 6;
    if (lotFree(x0, z0, bx1 - 4, z0 + 12) && !inHomeZone(b, x0, z0, bx1 - 4, z0 + 12)) {
      const [lo, hi] = heightRange(b, x0, z0, bx1 - 4, z0 + 12);
      if (hi - lo < 3) {
        addBuilding(b, 'apartment', x0, z0, bx1 - 4, z0 + 12, floors * 3, { tint: rand(rng) });
        b.areas.push({ kind: 'parking', x0: bx0, z0: bz0, x1: bx1, z1: bz1, variant: rand(rng) });
        return;
      }
    }
  }
  const alongX = w >= d;
  const length = alongX ? w : d;
  const depth = (alongX ? d : w) / 2;
  const lotMin = grade >= 2 ? G.lotMinDense : G.lotMin;
  const lotMax = grade >= 2 ? G.lotMaxDense : G.lotMax;
  for (let row = 0; row < 2; row++) {
    let u = 0;
    while (u < length - lotMin) {
      const lot = Math.min(length - u, randRange(rng, lotMin, lotMax));
      const u0 = u;
      u += lot;
      if (chance(rng, grade >= 2 ? 0.05 : 0.15)) continue;
      const hw = Math.min(lot - 3, randRange(rng, 7, 10.5));
      const hd = Math.min(depth - 4, randRange(rng, 6.5, 9));
      if (hw < 6 || hd < 5) continue;
      const setback = randRange(rng, 2, 3.5);
      const a0 = (alongX ? bx0 : bz0) + u0 + (lot - hw) / 2;
      const c0 = row === 0 ? (alongX ? bz0 : bx0) + setback : (alongX ? bz1 : bx1) - setback - hd;
      const x0 = alongX ? a0 : c0;
      const z0 = alongX ? c0 : a0;
      const x1 = x0 + (alongX ? hw : hd);
      const z1 = z0 + (alongX ? hd : hw);
      if (!lotLand(luAt(real, (x0 + x1) / 2, (z0 + z1) / 2))) continue;
      if (!lotFree(x0, z0, x1, z1) || inHomeZone(b, x0, z0, x1, z1)) continue;
      const [lo, hi] = heightRange(b, x0, z0, x1, z1);
      if (hi - lo > 2.5) continue;
      if (chance(rng, grade >= 2 ? 0.1 : 0.05)) {
        if (!(chance(enterRng, T.enterable.shop) && enterableIn(b, 'shop.konbini', x0 - 4, z0 - 4, x1 + 4, z1 + 4, 0))) addBuilding(b, 'shop', x0, z0, x1, z1, randRange(rng, 3.6, 5), { tint: rand(rng) });
        continue;
      }
      const rot: Rot = alongX ? (row === 0 ? 2 : 0) : row === 0 ? 3 : 1;
      if (chance(enterRng, T.enterable.house) && enterableIn(b, 'house.wood2', x0, z0, x1, z1, rot)) continue;
      addBuilding(b, 'house', x0, z0, x1, z1, chance(rng, 0.25) ? 3.2 : randRange(rng, 5.6, 6.6), { roof: 'gable', tint: rand(rng) });
    }
  }
  b.areas.push({ kind: 'yard', x0: bx0, z0: bz0, x1: bx1, z1: bz1, variant: rand(rng) });
}

// ---------------------------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------------------------

/** Paddies and fields as plots on the 8 m lattice, grouped in rectangles up to the plot size. */
function realFields(b: Builder, real: RealArea): void {
  const rng = rngOf(b, 'real.fields');
  const n = LU_N - 1;
  const used = new Uint8Array(n * n);
  const cls = (i: number, j: number): number => real.landuse[j * LU_N + i]!;
  const P = R.fields;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (used[j * n + i]) continue;
      const c = cls(i, j);
      if (c !== LU.paddy && c !== LU.field) continue;
      // Grow right, then down, while the class holds and the plot is small enough.
      let w = 1;
      while (i + w < n && w * STEP < P.max && !used[j * n + i + w] && cls(i + w, j) === c) w++;
      let h = 1;
      while (j + h < n && h * STEP < P.max) {
        let ok = true;
        for (let k = 0; k < w; k++) if (used[(j + h) * n + i + k] || cls(i + k, j + h) !== c) ok = false;
        if (!ok) break;
        h++;
      }
      for (let jj = 0; jj < h; jj++) for (let ii = 0; ii < w; ii++) used[(j + jj) * n + i + ii] = 1;
      const x0 = i * STEP + 1;
      const z0 = j * STEP + 1;
      const x1 = (i + w) * STEP - 1;
      const z1 = (j + h) * STEP - 1;
      if (x1 - x0 < P.min || z1 - z0 < P.min) continue;
      if (inHomeZone(b, x0, z0, x1, z1, 12)) continue;
      let free = true;
      forTiles(x0, z0, x1, z1, (t) => {
        if (b.occupied[t]) free = false;
      });
      if (!free) continue;
      const paddy = c === LU.paddy;
      b.areas.push({ kind: paddy ? 'paddy' : 'field', x0, z0, x1, z1, variant: rand(rng) });
      forTiles(x0, z0, x1, z1, (t, tx, ty) => {
        const cx = (tx + 0.5) * TILE;
        const cz = (ty + 0.5) * TILE;
        if (cx > x0 && cx < x1 && cz > z0 && cz < z1) b.ground[t] = GROUND.field;
      });
      occupy(b, x0, z0, x1, z1);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The whole layout
// ---------------------------------------------------------------------------------------------

/** Forest share 0..1 at a point (scatterFlora puts the woods there). */
export function realForest(real: RealArea): (x: number, z: number) => number {
  return (x, z) => shareAt(real, (c) => c === LU.forest, x, z) + 0.35 * shareAt(real, (c) => c === LU.waste, x, z);
}

/**
 * A landmark centred on (x, z), front to the south — or on the nearest free and flat enough spot within
 * 48 m (rings of 8 points every 4 m), since the shrunk point often falls on a road.
 */
function landmark(b: Builder, id: string, x: number, z: number): Building | null {
  const def = buildingDef(id);
  const w = def.size.w[1];
  const d = def.size.d[1];
  for (let r = 0; r <= 48; r += 4) {
    for (let k = 0; k < (r === 0 ? 1 : 8); k++) {
      const cx = x + Math.cos((k / 8) * Math.PI * 2) * r;
      const cz = z + Math.sin((k / 8) * Math.PI * 2) * r;
      const [x0, z0, x1, z1] = [cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2];
      if (inHomeZone(b, x0, z0, x1, z1) || !rectFree(b, x0 - 2, z0 - 2, x1 + 2, z1 + 2, 12)) continue;
      const [lo, hi] = heightRange(b, x0, z0, x1, z1);
      if (hi - lo > R.facilityMaxSlope) continue;
      const bd = enterableIn(b, id, x0, z0, x1, z1, 0);
      if (!bd) continue;
      // The roof's front strip by the parapet (the stair house stands over the middle; front = south).
      b.vantages.push({ pos: [cx, bd.base + envelopeOf(def).eaves, bd.z1 - 1], kind: 'roof' });
      return bd;
    }
  }
  return null;
}

export function layoutReal(b: Builder, real: RealArea, terrain: (x: number, z: number) => number): { water: Float32Array; pois: MapPoi[] } {
  const water = waterAndGround(b, real, terrain);
  realRoads(b, real, water);
  // Facilities first (the town fills around them), the larger kinds first.
  const rng = rngOf(b, 'real.facilities');
  const enterRng = rngOf(b, 'real.facilities.enterable');
  const pois: MapPoi[] = real.pois.map((p) => ({ kind: p.kind, grade: p.grade, x: p.x, z: p.z, name: p.name }));
  // R1: landmarks (REAL_LANDMARKS) first, at their real point; the deck / roof is a firing position.
  for (const p of pois) {
    const id = REAL_LANDMARKS[p.name];
    if (id) p.building = landmark(b, id, p.x, p.z)?.id;
    // R1: other towers (an override's `addPois` of POI.tower): a lookout tower, a firing position.
    else if (p.kind === POI.tower) p.building = addTower(b, p.x, p.z, p.grade > 0 ? p.grade : T.vantage.towerHeight)?.id;
  }
  const order = [POI.gsdf, POI.prefOffice, POI.cityHall, POI.station, POI.hospital, POI.university, POI.school, POI.townHall, POI.police, POI.fire] as number[];
  for (const kind of order) {
    for (const p of pois) {
      if (p.kind !== kind) continue;
      if (p.x < 14 || p.z < 14 || p.x > SIZE - 14 || p.z > SIZE - 14) continue;
      if (isWater(luAt(real, p.x, p.z))) continue;
      const bd = facility(b, rng, p.kind, p.grade, p.x, p.z, enterRng);
      if (bd) p.building = bd.id;
    }
  }
  realTowns(b, real);
  realFields(b, real);
  // Water tiles are never walked on (nav) — the sim keeps the player out of deep water.
  for (let i = 0; i < b.ground.length; i++) if (b.ground[i] === GROUND.water) b.occupied[i] = 1;
  return { water, pois };
}
