// R0: an operation area made from the real data of its cell (docs/02_systems_spec.md §2.5; the
// buildings: §3.11, 07d-3).
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
//   towns        a street lattice over the built-up land, filled with the 07d-2 types of the district
//                (data/placement.ts MIX by the town grade — population and durable buildings — and the
//                municipality's grade), their fronts to the street
//   facilities   stations on their railway, airports, SDF bases, town halls, hospitals, schools,
//                police, fire at their shrunk place (sites.ts plans them before the roads are laid)
// Neighbouring real cells share their edge samples, so terrain, water and roads meet; next to a cell
// without real data the terrain fades into the 07c world function over REAL_AREA.seamBand.

import { chance, rand, randInt, randRange, type RngState } from '../../core/rng.ts';
import type { Land } from '../../core/types.ts';
import { COAST, FORECOURT, LOTS } from '../../data/placement.ts';
import { REAL_AREA } from '../../data/realmap.ts';
import { TACTICAL } from '../../data/tactical.ts';
import { buildingDef } from '../buildings/catalog/index.ts';
import { blueprintOf, envelopeOf, generateBlueprint, toWorld, type Rot } from '../buildings/index.ts';
import {
  addEnterable, addRoad, addTower, forTiles, hAt, heightRange, homeDist, inHomeZone, N, occupy, rectFree, rngOf, SIZE,
  TILE, TILES, tileIndex, type Builder,
} from '../builder.ts';
import { farmstead } from '../lands.ts';
import { noise2, smoothstep } from '../noise.ts';
import { districtOf, newTally, pickType, tallyAdd, type TypeTally } from '../placement.ts';
import { GROUND, type Building, type GenParams, type MapPoi } from '../types.ts';
import { DUR_N, ELEV_N, LINE, LINE_TUNNEL, LU, LU_N, POI, POP_N, type RealArea } from './format.ts';
import { bridgesIn, cutByBridges, finishBridges, layBridges, type BridgeAt } from './bridges.ts';
import { applyLandmark, landmarksIn } from './landmarks.ts';
import { createPlanner, cutLine, levelSites, planLandmark, planSites, reserve, type Site } from './sites.ts';

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

function realRoads(b: Builder, real: RealArea, water: Float32Array, sites: readonly Site[], bridges: readonly BridgeAt[]): void {
  const order = [...real.lines].sort((a, c) => c.width - a.width);
  for (const line of order) {
    if (line.flags & LINE_TUNNEL) continue; // inside the mountain
    if (line.kind === LINE.river) continue;
    const pts: [number, number][] = [];
    for (let k = 0; k < line.pts.length; k += 2) pts.push([line.pts[k]!, line.pts[k + 1]!]);
    if (pts.length < 2) continue;
    const rail = line.kind === LINE.rail || line.kind === LINE.shinkansen;
    const kind = rail ? 'track' : line.kind === LINE.motorway || line.width >= 14 ? 'avenue' : line.kind === LINE.local ? 'lane' : 'street';
    // 07d-3: the minor roads (and a station's own railway) stop at the fence of a site that took them.
    for (const cut of cutLine(pts, line.kind, line.width, sites)) {
      // L9: where a bridge landmark runs, its deck carries the road (gen/real/bridges.ts).
      for (const piece of cutByBridges(cut, bridges)) {
        // Over water a road is carried on an embankment (R0: no bridge decks yet).
        causeway(b, piece, line.width, water);
        addRoad(b, kind, line.width, piece, true);
      }
    }
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
// Facilities at their real place (07d-3: gen/real/sites.ts plans them, here they are built)
// ---------------------------------------------------------------------------------------------

/** Car park or square in front of a facility, when the ground there is free. */
function forecourt(b: Builder, rng: RngState, bd: Building, rot: Rot): void {
  const D = FORECOURT.depth;
  const r: [number, number, number, number] = rot === 0 ? [bd.x0, bd.z1 + 1.5, bd.x1, bd.z1 + 1.5 + D]
    : rot === 2 ? [bd.x0, bd.z0 - 1.5 - D, bd.x1, bd.z0 - 1.5]
      : rot === 1 ? [bd.x1 + 1.5, bd.z0, bd.x1 + 1.5 + D, bd.z1]
        : [bd.x0 - 1.5 - D, bd.z0, bd.x0 - 1.5, bd.z1];
  if (!rectFree(b, r[0], r[1], r[2], r[3], 10) || inHomeZone(b, r[0], r[1], r[2], r[3])) return;
  b.areas.push({ kind: FORECOURT.kinds[chance(rng, 0.6) ? 0 : 1], x0: r[0], z0: r[1], x1: r[2], z1: r[3], variant: rand(rng) });
  forTiles(r[0], r[1], r[2], r[3], (i) => {
    if (b.ground[i] !== GROUND.water) b.ground[i] = GROUND.paved;
  });
  occupy(b, r[0], r[1], r[2], r[3]);
}

/** Build the planned sites: one enterable building each, its forecourt, the point it stands for. */
function buildSites(b: Builder, sites: readonly Site[], pois: MapPoi[], ctx: TownCtx): void {
  const rng = rngOf(b, 'real.sites.build');
  for (const s of sites) {
    forTiles(s.x0, s.z0, s.x1, s.z1, (t) => {
      ctx.sites[t] = 1;
    });
    const bd = addEnterable(b, s.def, s.x0, s.z0, s.w, s.d, s.rot);
    tallyAdd(ctx.tally, s.def);
    if (s.poi >= 0) pois[s.poi]!.building = bd.id;
    if (s.forecourt) forecourt(b, rng, bd, s.rot);
  }
}

/**
 * Firing positions on the roofs of the town (as R0's outside stairs were): the highest roofs of the
 * enterable offices and hotels with a way up (07d-2c: all but the warehouse), one block each (not a
 * site of several wings, whose front strip may be a forecourt), at most `climbable` and 150 m apart.
 * The shooter stands on the roof deck (its blueprint: the slab at the eaves) 1 m in from the parapet
 * where nothing stands to head height, on the side that looks out furthest (rays over the building
 * boxes and the ground); a roof that sees nothing 300 m off is left out.
 */
function roofVantages(b: Builder): void {
  const cands = b.placements.filter((p) => p.roof === 'flat' && p.eaves >= R.town.roofMinEaves && Math.max(p.w, p.d) <= 42 && /^(office|shop)\./.test(p.def));
  if (cands.length === 0) return;
  cands.sort((p, q) => q.base + q.eaves - (p.base + p.eaves));
  // Building boxes on a 32 m grid for the rays.
  const C = 32;
  const n = SIZE / C;
  const grid: number[][] = Array.from({ length: n * n }, () => []);
  for (const bd of b.buildings) {
    for (let cz = Math.max(0, Math.floor(bd.z0 / C)); cz <= Math.min(n - 1, Math.floor(bd.z1 / C)); cz++) {
      for (let cx = Math.max(0, Math.floor(bd.x0 / C)); cx <= Math.min(n - 1, Math.floor(bd.x1 / C)); cx++) grid[cz * n + cx]!.push(bd.id);
    }
  }
  const D = R.town.roofSight;
  const eye = T.player.eyeHeight.stand;
  const clear = (x: number, y: number, z: number, dx: number, dz: number, self: number): boolean => {
    const ex = x + dx * D;
    const ez = z + dz * D;
    if (ex < 8 || ez < 8 || ex > SIZE - 8 || ez > SIZE - 8) return false;
    const y0 = y + eye;
    const y1 = hAt(b, ex, ez) + 1;
    for (let t = 6; t < D; t += 6) {
      const px = x + dx * t;
      const pz = z + dz * t;
      const h = y0 + ((y1 - y0) * t) / D;
      if (hAt(b, px, pz) > h) return false;
      for (const id of grid[Math.min(n - 1, Math.floor(pz / C)) * n + Math.min(n - 1, Math.floor(px / C))]!) {
        const o = b.buildings[id]!;
        if (id !== self && px > o.x0 && px < o.x1 && pz > o.z0 && pz < o.z1 && o.base + o.height > h) return false;
      }
    }
    return true;
  };
  let count = 0;
  for (const p of cands) {
    if (count >= R.town.climbable) break;
    const cx = (p.x0 + p.x1) / 2;
    const cz = (p.z0 + p.z1) / 2;
    if (b.vantages.some((v) => v.kind === 'roof' && Math.hypot(v.pos[0] - cx, v.pos[2] - cz) < 150) || !roofAccess(p.def)) continue;
    const y = p.base + p.eaves;
    let best: [number, number, number] | null = null;
    let score = 0;
    // Each side: 0.6 m in from its parapet, three rays out (straight and ±30°).
    // The roof deck: the largest slab whose top is at the eaves (the parapet stands on its edge).
    const bp = blueprintOf(p);
    let deck: [number, number, number, number] | null = null;
    for (const part of bp.parts) {
      if (Math.abs(part.y1 - p.eaves) > 0.15 || part.y1 - part.y0 > 1) continue;
      if (!deck || (part.x1 - part.x0) * (part.z1 - part.z0) > (deck[2] - deck[0]) * (deck[3] - deck[1])) deck = [part.x0, part.z0, part.x1, part.z1];
    }
    if (!deck || deck[2] - deck[0] < 4 || deck[3] - deck[1] < 4) continue;
    // A spot on the deck where nothing stands or hangs within 4 m of the floor (parapet, stair house and its roof, rail, mast).
    const freeAt = (lx: number, lz: number): boolean => !bp.parts.some((q) => !q.hidden && q.y1 > p.eaves + 0.05 && q.y0 < p.eaves + 4 && lx > q.x0 - 0.35 && lx < q.x1 + 0.35 && lz > q.z0 - 0.35 && lz < q.z1 + 0.35);
    const [dx0, dz0, dx1, dz1] = deck;
    const spots: [number, number][] = [];
    // As close to the parapet as one can stand (the line down to the street must clear it), mid-side and corners.
    for (const inset of [0.6, 0.8, 1.1]) {
      for (const [lx, lz] of [[(dx0 + dx1) / 2, dz1 - inset], [dx1 - inset, (dz0 + dz1) / 2], [(dx0 + dx1) / 2, dz0 + inset], [dx0 + inset, (dz0 + dz1) / 2], [dx0 + inset, dz1 - inset], [dx1 - inset, dz1 - inset], [dx1 - inset, dz0 + inset], [dx0 + inset, dz0 + inset]] as const) {
        if (freeAt(lx, lz) && !spots.some((q) => Math.hypot(q[0] - lx, q[1] - lz) < 2)) spots.push([lx, lz]);
      }
    }
    for (const [lx, lz] of spots) {
      const [x, z] = toWorld(p, lx, lz);
      // Out over the nearest parapet (and ±30°).
      const ex = Math.min(x - p.x0, p.x1 - x);
      const ez = Math.min(z - p.z0, p.z1 - z);
      const nx = ex <= ez ? (x - p.x0 < p.x1 - x ? -1 : 1) : 0;
      const nz = ex <= ez ? 0 : z - p.z0 < p.z1 - z ? -1 : 1;
      let k = 0;
      for (const a of [-0.52, 0, 0.52]) {
        const dx = nx * Math.cos(a) - nz * Math.sin(a);
        const dz = nx * Math.sin(a) + nz * Math.cos(a);
        if (clear(x, y, z, dx, dz, p.building)) k++;
      }
      // The line straight out must clear the parapet at the edge (a steep look down from a tower).
      const edge = Math.max(0.3, nx !== 0 ? (nx > 0 ? p.x1 - x : x - p.x0) : nz > 0 ? p.z1 - z : z - p.z0);
      const drop = ((y + T.player.eyeHeight.stand - hAt(b, x + nx * R.town.roofSight, z + nz * R.town.roofSight)) / R.town.roofSight) * edge;
      if (T.player.eyeHeight.stand - drop < 1.5) k = 0;
      if (k > score) {
        score = k;
        best = [x, y, z];
      }
    }
    if (!best) continue;
    b.vantages.push({ pos: best, kind: 'roof' });
    count++;
  }
}

/** Does a type have a way up to its roof (a room at the eaves: the stair house's landing)? Per type, once. */
const roofs = new Map<string, boolean>();
function roofAccess(id: string): boolean {
  let v = roofs.get(id);
  if (v === undefined) {
    const def = buildingDef(id);
    const eaves = envelopeOf(def).eaves;
    v = generateBlueprint(def, def.size.w[0], def.size.d[0], 7).rooms.some((r) => !r.locked && r.y >= eaves - 0.6);
    roofs.set(id, v);
  }
  return v;
}

// ---------------------------------------------------------------------------------------------
// Towns: a street lattice over the built-up land, filled by grade with the 07d-2 types
// ---------------------------------------------------------------------------------------------

interface TownCtx {
  real: RealArea;
  /** Municipality grade of the cell (CellFacts.town; 3 without facts). */
  muni: number;
  land: Land;
  tally: TypeTally;
  hills: boolean;
  /** Lattice points (LU_N²) within COAST.reach of the sea. */
  coast: Uint8Array | null;
  /** Tiles of the facility sites (the town streets keep out of them). */
  sites: Uint8Array;
  /** Chance that a mid-rise lot is drawn from the high-rise core's mix (big cities). */
  core: number;
}

function townCtx(b: Builder, real: RealArea): TownCtx {
  const muni = b.params.facts?.town ?? 3;
  const land = b.params.land;
  // How metropolitan the cell is: the share of its built-up land that is mid- or high-rise (the census
  // counts residents, so the business districts seldom reach grade 4): mid-rise lots of the big cities
  // are high-rise core lots now and then.
  let built = 0;
  let tall = 0;
  for (let j = 0; j < LU_N; j += 2) for (let i = 0; i < LU_N; i += 2) {
    if (real.landuse[j * LU_N + i] !== LU.building) continue;
    built++;
    if (townGrade(real, i * STEP, j * STEP) >= 3) tall++;
  }
  const share = built > 0 ? tall / built : 0;
  const C = LOTS.core;
  const core = land === 'urban' ? Math.min(C.max, Math.max(0, (share - C.from) * C.slope) + (muni >= 5 ? C.metro : muni === 4 ? C.capital : 0)) : 0;
  return { real, muni, land, tally: (b.tally ??= newTally(muni >= 5 || share > C.metroShare)), hills: land === 'forest' || land === 'mountain', coast: coastMask(real), sites: new Uint8Array(TILES * TILES), core };
}

/** Lattice points within COAST.reach of the sea (two passes of a running maximum), or null without sea. */
function coastMask(real: RealArea): Uint8Array | null {
  const n = LU_N;
  const sea = new Uint8Array(n * n);
  let any = false;
  for (let i = 0; i < n * n; i++) if (real.landuse[i] === LU.sea) {
    sea[i] = 1;
    any = true;
  }
  if (!any) return null;
  const r = Math.ceil(COAST.reach / STEP);
  const tmp = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let v = 0;
    for (let k = Math.max(0, i - r); k <= Math.min(n - 1, i + r) && !v; k++) v = sea[j * n + k]!;
    tmp[j * n + i] = v;
  }
  const out = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let v = 0;
    for (let k = Math.max(0, j - r); k <= Math.min(n - 1, j + r) && !v; k++) v = tmp[k * n + i]!;
    out[j * n + i] = v;
  }
  return out;
}

function coastAt(ctx: TownCtx, x: number, z: number): boolean {
  if (!ctx.coast) return false;
  const i = Math.min(LU_N - 1, Math.max(0, Math.round(x / STEP)));
  const j = Math.min(LU_N - 1, Math.max(0, Math.round(z / STEP)));
  return ctx.coast[j * LU_N + i] === 1;
}

/** A type for a lot of the district at (x, z). */
function pickAt(ctx: TownCtx, rng: RngState, x: number, z: number, lw: number, ld: number, small: boolean, grade = townGrade(ctx.real, x, z)): ReturnType<typeof pickType> {
  const g = grade === 3 && ctx.core > 0 && chance(rng, ctx.core) ? 4 : grade;
  return pickType(rng, districtOf(g, ctx.muni, ctx.land), lw, ld, ctx.tally, { small, coast: coastAt(ctx, x, z), hills: ctx.hills });
}

/** Place a picked type with its front on the front edge of the world rectangle (centred along it). */
function placeIn(b: Builder, ctx: TownCtx, id: string, w: number, d: number, x0: number, z0: number, x1: number, z1: number, rot: Rot): Building {
  const [ww, wd] = rot % 2 === 0 ? [w, d] : [d, w];
  let ax: number;
  let az: number;
  if (rot === 0) [ax, az] = [(x0 + x1 - ww) / 2, z1 - wd];
  else if (rot === 2) [ax, az] = [(x0 + x1 - ww) / 2, z0];
  else if (rot === 1) [ax, az] = [x1 - ww, (z0 + z1 - wd) / 2];
  else [ax, az] = [x0, (z0 + z1 - wd) / 2];
  const bd = addEnterable(b, id, ax, az, w, d, rot);
  tallyAdd(ctx.tally, id);
  return bd;
}

function realTowns(b: Builder, real: RealArea, ctx: TownCtx): void {
  const G = R.town;
  const rng = rngOf(b, 'real.town');
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
        // Not through a facility built at its real place (occupied, but not a road; 07d-3: nor a site, whose ground may be the railway's).
        const taken = ctx.sites[t] === 1 || (b.occupied[t] === 1 && b.ground[t] !== GROUND.road && b.ground[t] !== GROUND.track);
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
            if (townLand(luAt(real, x, z)) && chance(rng, 0.5)) farmstead(b, rng, x, z, rng, (lw, ld) => pickAt(ctx, rng, x, z, lw, ld, true, 1));
          }
        }
        continue;
      }
      if (inHomeZone(b, x0, z0, x1, z1, -40)) continue;
      if (grade >= 3) urbanBlock(b, rng, ctx, x0, z0, x1, z1, grade);
      else houseBlock(b, rng, ctx, x0, z0, x1, z1, grade);
    }
  }
  gapFill(b, rng, ctx);
}

/** The side (rotation) of a point whose nearest road (in the snapshot before the town) is closest, within `reach`. */
function roadSide(x: number, z: number, hw: number, hd: number, reach: number): Rot | null {
  let best: Rot | null = null;
  let dist = reach;
  const dirs: [Rot, number, number, number][] = [[0, 0, 1, hd], [1, 1, 0, hw], [2, 0, -1, hd], [3, -1, 0, hw]];
  for (const [rot, dx, dz, half] of dirs) {
    for (let s = half + 1; s < half + dist; s += 2) {
      const px = x + dx * s;
      const pz = z + dz * s;
      if (px < 0 || pz < 0 || px >= SIZE || pz >= SIZE) break;
      const t = tileIndex(px, pz);
      if (before![t] && (groundOf![t] === GROUND.road || groundOf![t] === GROUND.track)) {
        if (s - half < dist) {
          dist = s - half;
          best = rot;
        }
        break;
      }
    }
  }
  return best;
}
let groundOf: Uint8Array | null = null;

/**
 * Fill what the blocks left between the real roads: a scan of candidate lots over the built-up land,
 * each kept when nothing stands there yet; the building's front to the nearest road.
 */
function gapFill(b: Builder, rng: RngState, ctx: TownCtx): void {
  const G = R.town;
  const real = ctx.real;
  groundOf = b.ground;
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
  const place = (pick: NonNullable<ReturnType<typeof pickType>>, cx: number, cz: number, gap: number, slope: number): boolean => {
    const rot = roadSide(cx, cz, pick.w / 2, pick.d / 2, 18) ?? (randInt(rng, 0, 3) as Rot);
    const [ww, wd] = rot % 2 === 0 ? [pick.w, pick.d] : [pick.d, pick.w];
    const x0 = cx - ww / 2;
    const z0 = cz - wd / 2;
    if (!clear(x0, z0, x0 + ww, z0 + wd, gap) || inHomeZone(b, x0, z0, x0 + ww, z0 + wd)) return false;
    const [lo, hi] = heightRange(b, x0, z0, x0 + ww, z0 + wd);
    if (hi - lo > slope) return false;
    const bd = addEnterable(b, pick.id, x0, z0, pick.w, pick.d, rot);
    tallyAdd(ctx.tally, pick.id);
    index(bd);
    return true;
  };
  // Works and depots on the "other" land (industrial estates, yards), before the houses.
  for (let z = 30; z < SIZE - 40; z += LOTS.industryStep) {
    for (let x = 30; x < SIZE - 40; x += LOTS.industryStep) {
      const cx = x + randRange(rng, -4, 4);
      const cz = z + randRange(rng, -4, 4);
      if (luAt(real, cx, cz) !== LU.other || shareAt(real, (c) => c === LU.other, cx, cz) < 0.75 || chance(rng, 0.3)) continue;
      for (const [lw, ld] of [LOTS.industryLot, [30, 24]] as const) {
        const pick = pickType(rng, 'industry', lw, ld, ctx.tally);
        if (pick && place(pick, cx, cz, 4, 3.5)) break;
      }
    }
  }
  for (let z = 10; z < SIZE - 20; z += G.gapStep) {
    for (let x = 10; x < SIZE - 20; x += G.gapStep) {
      const cx = x + randRange(rng, -2, 2);
      const cz = z + randRange(rng, -2, 2);
      const c = luAt(real, cx, cz);
      const g = townGrade(real, cx, cz);
      if (!(townLand(c) || (g >= 2 && lotLand(c))) || chance(rng, G.gapSkip)) continue;
      const big = g >= 3;
      // The type first (the district's mix as it is), then the room for it, turned to face the nearest
      // road; where it does not fit, a smaller lot once.
      for (const [lw, ld] of big ? [[ctx.core > 0.15 ? 40 : 34, 30], [16, 14]] : [[24, 18], [11, 11]]) {
        const pick = pickAt(ctx, rng, cx, cz, lw!, ld!, !big, g);
        if (pick && place(pick, cx, cz, big ? 4 : G.gapHouse, 2.5)) break;
      }
    }
  }
}

/** Mid- and high-rise block: lots (larger in the core), each a type facing the nearest street; an open car park or square now and then. */
function urbanBlock(b: Builder, rng: RngState, ctx: TownCtx, bx0: number, bz0: number, bx1: number, bz1: number, grade: number): void {
  const real = ctx.real;
  if (chance(rng, LOTS.open) && bx1 - bx0 > 30 && bz1 - bz0 > 30) {
    b.areas.push({ kind: chance(rng, 0.5) ? 'parking' : 'plaza', x0: bx0, z0: bz0, x1: bx1, z1: bz1, variant: rand(rng) });
    forTiles(bx0, bz0, bx1, bz1, (i) => {
      if (b.ground[i] !== GROUND.water) b.ground[i] = GROUND.paved;
    });
    occupy(b, bx0, bz0, bx1, bz1);
    return;
  }
  const lotMax = grade === 3 && ctx.core > 0.15 ? LOTS.urbanMaxMetro : LOTS.urbanMax[grade] ?? LOTS.urbanMax[3]!;
  const lots: [number, number, number, number][] = [];
  const split = (x0: number, z0: number, x1: number, z1: number): void => {
    if (x1 - x0 <= lotMax && z1 - z0 <= lotMax) {
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
  const blk = { x0: bx0, z0: bz0, x1: bx1, z1: bz1 };
  for (const [x0, z0, x1, z1] of lots) {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    if (!lotLand(luAt(real, cx, cz)) || chance(rng, 0.06)) continue;
    const inset = randRange(rng, 1.2, 3);
    const lx0 = x0 + inset;
    const lz0 = z0 + inset;
    const lx1 = x1 - inset;
    const lz1 = z1 - inset;
    if (lx1 - lx0 < 5 || lz1 - lz0 < 5) continue;
    if (!lotFree(lx0, lz0, lx1, lz1) || inHomeZone(b, lx0, lz0, lx1, lz1)) continue;
    const [lo, hi] = heightRange(b, lx0, lz0, lx1, lz1);
    if (hi - lo > 3) continue;
    const rot = streetSide(x0, z0, x1, z1, blk);
    const [lw, ld] = rot % 2 === 0 ? [lx1 - lx0, lz1 - lz0] : [lz1 - lz0, lx1 - lx0];
    const pick = pickAt(ctx, rng, cx, cz, lw, ld, false);
    if (!pick) continue;
    placeIn(b, ctx, pick.id, pick.w, pick.d, lx0, lz0, lx1, lz1, rot);
  }
}

/** The side of a lot that faces the nearest edge of its block (the street): as a rotation. */
function streetSide(x0: number, z0: number, x1: number, z1: number, blk: { x0: number; z0: number; x1: number; z1: number }): Rot {
  const d = [blk.z1 - z1, blk.x1 - x1, z0 - blk.z0, x0 - blk.x0];
  const m = Math.min(...d);
  return d.indexOf(m) as Rot;
}

/** Low-rise block: two rows of lots back to back along the longer side, each a type facing its street; a row of flats now and then. */
function houseBlock(b: Builder, rng: RngState, ctx: TownCtx, bx0: number, bz0: number, bx1: number, bz1: number, grade: number): void {
  const real = ctx.real;
  const w = bx1 - bx0;
  const d = bz1 - bz0;
  const alongX = w >= d;
  const length = alongX ? w : d;
  const depth = (alongX ? d : w) / 2;
  // A row of flats (danchi, company housing, dormitory) facing the first street, now and then in the denser parts.
  const flats = grade >= 2 && chance(rng, LOTS.flats) && length > 40 && depth > 16;
  for (let row = 0; row < 2; row++) {
    const rot: Rot = alongX ? (row === 0 ? 2 : 0) : row === 0 ? 3 : 1;
    let u = randRange(rng, 0, 3);
    let guard = 0;
    while (u < length - 5 && guard++ < 40) {
      const setback = randRange(rng, LOTS.setback[0], LOTS.setback[1]);
      const gap = randRange(rng, LOTS.gap[0], LOTS.gap[1]);
      const a0 = (alongX ? bx0 : bz0) + u;
      const mid = a0 + 6;
      const [px, pz] = alongX ? [mid, row === 0 ? bz0 + depth / 2 : bz1 - depth / 2] : [row === 0 ? bx0 + depth / 2 : bx1 - depth / 2, mid];
      const g = townGrade(real, px, pz);
      let pick = null;
      if (flats && row === 0) pick = pickType(rng, 'dense', Math.min(26, length - u), depth - setback - 1, ctx.tally, { except: (id) => !id.startsWith('apartment.') || id === 'apartment.mokuzo2' });
      if (!pick && chance(rng, grade >= 2 ? 0.04 : 0.1)) {
        u += randRange(rng, 6, 12); // a vacant lot, a garden
        continue;
      }
      pick ??= pickAt(ctx, rng, px, pz, length - u, depth - setback - 1, true, Math.min(g, 2));
      if (!pick) break;
      const fw = pick.w;
      const fd = pick.d;
      u += fw + gap;
      const c0 = row === 0 ? (alongX ? bz0 : bx0) + setback : (alongX ? bz1 : bx1) - setback - fd;
      const x0 = alongX ? a0 : c0;
      const z0 = alongX ? c0 : a0;
      const x1 = x0 + (alongX ? fw : fd);
      const z1 = z0 + (alongX ? fd : fw);
      if (!lotLand(luAt(real, (x0 + x1) / 2, (z0 + z1) / 2))) continue;
      if (!lotFree(x0, z0, x1, z1) || inHomeZone(b, x0, z0, x1, z1)) continue;
      const [lo, hi] = heightRange(b, x0, z0, x1, z1);
      if (hi - lo > 2.5) continue;
      addEnterable(b, pick.id, x0, z0, fw, fd, rot);
      tallyAdd(ctx.tally, pick.id);
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

export function layoutReal(b: Builder, real: RealArea, terrain: (x: number, z: number) => number): { water: Float32Array; pois: MapPoi[]; sites: Site[] } {
  const water = waterAndGround(b, real, terrain);
  const pois: MapPoi[] = real.pois.map((p) => ({ kind: p.kind, grade: p.grade, x: p.x, z: p.z, name: p.name }));
  // 07d-3: the facility sites first (stations on their railway, airports and bases on open land, the
  // one-per-area facilities at their point), then the ground under them is levelled and the roads
  // are laid — the minor ones stop at a site's fence.
  const P = createPlanner(b, real, rngOf(b, 'real.sites'));
  // L1: the landmarks of the table (src/data/landmarks/) whose real point is in this cell, first: a site
  // each, so that the facilities, the town and the minor roads keep out. A point of the data with the
  // landmark's `poi` name is where it stands (and is no lookout tower).
  const taken = new Set<number>();
  for (const m of landmarksIn(real.cell)) {
    if (m.spot.bridge) continue; // L9: laid along its line (bridges.ts), not a lot
    let poi = m.spot.poi ? pois.findIndex((p) => p.name === m.spot.poi) : -1;
    if (poi < 0) {
      poi = pois.length;
      pois.push({ kind: POI.landmark, grade: 0, x: m.x, z: m.z, name: m.spot.id });
    }
    taken.add(poi);
    planLandmark(P, m.spot.id, pois[poi]!.x, pois[poi]!.z, m.spot.rot, m.spot.reach ?? 48, poi, { level: m.spot.level, drain: m.spot.drain, cutRoads: m.spot.cutRoads });
  }
  // L9: the bridge landmarks whose line runs through this area: no facility under their deck.
  const bridges = bridgesIn(real.cell);
  for (const br of bridges) {
    for (let s = br.from; s <= br.to; s += 6) {
      const p = br.f.at(s);
      reserve(P, p.x, p.z, br.hw + 3);
    }
  }
  // R1, R9: the lookout towers keep their spot (they were placed for the sight lines).
  pois.forEach((p, i) => {
    if (p.kind === POI.tower && !taken.has(i)) reserve(P, p.x, p.z, 5);
  });
  const ctx = townCtx(b, real);
  const around = b.params.world?.around ?? [];
  const nearCity = b.params.land !== 'urban' && around.some((c, k) => k !== 4 && c?.land === 'urban');
  planSites(P, { pois, facts: b.params.facts, townGradeAt: (x, z) => townGrade(real, x, z), nearCity });
  levelSites(b, P.sites, water);
  // L9: the bridge landmarks replace the roads' embankments along their line.
  realRoads(b, real, water, P.sites, bridges);
  layBridges(b, bridges, water);
  buildSites(b, P.sites, pois, ctx);
  // L1: a landmark's moat / canal / lawn and its firing positions (its blueprint's ground and vantages).
  for (const s of P.sites) if (s.what === 'landmark') applyLandmark(b, b.buildings[pois[s.poi]!.building!]!, water);
  // R1: other towers (an override's `addPois` of POI.tower): a lookout tower, a firing position.
  pois.forEach((p, i) => {
    if (p.kind === POI.tower && !taken.has(i)) p.building = addTower(b, p.x, p.z, p.grade > 0 ? p.grade : T.vantage.towerHeight)?.id;
  });
  realTowns(b, real, ctx);
  roofVantages(b);
  realFields(b, real);
  // L9: the ground under the bridges' decks (after the town's streets have graded theirs).
  finishBridges(b, bridges, water);
  // Water tiles are never walked on (nav) — the sim keeps the player out of deep water.
  for (let i = 0; i < b.ground.length; i++) if (b.ground[i] === GROUND.water) b.occupied[i] = 1;
  return { water, pois, sites: P.sites };
}
