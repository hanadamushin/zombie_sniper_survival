// The operation area of the cell the player is in: when it is created and where its generated
// TacticalMap lives. The map is NOT in GameState (it is rebuilt from the seed); state.tactical only
// holds the §5 fields. Sim, render and UI all get the map through mapOf().
//
// Life cycle (state-driven, so it also works after a load and in headless runs):
//   - travelling                 -> state.tactical = null (travelStarted)
//   - not travelling, no area    -> create it for state.player.cell (after beginAt / travelArrived)
//   - area present, map missing  -> regenerate from tactical.mapSeed (after a load)
// Cells that are only passed through on the road never get a map.

import type { CellId, GameState, StaticGrid, TacticalState } from '../../core/types.ts';
import { generateTacticalMap, mapSeedFor, type GenParams, type LootSpot, type TacticalMap, type WorldContext } from '../../gen/index.ts';
import { cellTactical } from '../world/derive.ts';
import { createSpatialHash, type SpatialHash } from './collision.ts';
import { placePlayer } from './player.ts';
import type { GameEvent } from '../../core/events.ts';
import { reveal } from '../world/travel.ts';
import { TACTICAL } from '../../data/tactical.ts';
import { rangeMap } from './range.ts';
import { yardMap } from './yard.ts';
import { BALANCE } from '../../data/balance.ts';
import { hasRealData, realAreaOf, realPending, requestRealArea } from '../world/realAreas.ts';

export interface TacticalArea {
  map: TacticalMap;
  /** Dynamic objects of this area (zombies, survivors...) — owned by whoever inserts them (04/05). */
  dynamic: SpatialHash;
}

const areas = new WeakMap<TacticalState, TacticalArea>();

/** What the state keeps of a search point (07d: its floor height and loot table inside a building). */
function spotState(s: LootSpot, taken: boolean): TacticalState['lootSpots'][number] {
  const out: TacticalState['lootSpots'][number] = { id: s.id, pos: [s.pos[0], s.pos[1]], taken };
  if (s.y !== undefined) out.y = s.y;
  if (s.table !== undefined) out.table = s.table;
  if (s.key) out.key = true;
  if (s.enter !== undefined) out.enter = s.enter;
  return out;
}

/**
 * 07d-2f: open the key doors of every building whose key (the HQ safe) has been found in this area,
 * and close those whose key has not (the maps are cached and shared). Swaps the placement for an
 * `open` copy: collision, rooms and links (detailOf) and the drawing follow the placement.
 */
export function applyKeys(state: GameState, map: TacticalMap): void {
  const spots = state.tactical?.lootSpots ?? [];
  const keyed = new Set<number>();
  for (const s of spots) if (s.enter !== undefined) keyed.add(s.enter);
  for (const i of keyed) {
    const p = map.placements[i];
    if (!p) continue;
    const open = spots.some((s) => s.key && s.taken && s.enter === i);
    if ((p.open === true) === open) continue;
    const q = { ...p };
    if (open) q.open = true;
    else delete q.open;
    map.placements[i] = q;
  }
}
/** Last generated maps by parameters, so that re-entering a cell or reloading is instant. */
const cache = new Map<string, TacticalMap>();
/** 07c: the 3 × 3 neighbourhood the renderer shows, plus a few just left. */
const CACHE_SIZE = 14;

const keyOf = (p: GenParams): string => `${p.mapSeed}:${p.land}:${p.isHome ? 1 : 0}:${p.lootSpots}${p.real ? ':r' : ''}`;

function mapFor(params: GenParams): TacticalMap {
  const key = keyOf(params);
  let map = cache.get(key);
  if (map) cache.delete(key);
  else map = generateTacticalMap(params);
  cache.set(key, map); // most recent last
  while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return map;
}

/** Where a cell sits and what surrounds it (07c): terrain and roads continue into the neighbours. */
export function worldContext(state: GameState, grid: StaticGrid, cell: CellId): WorldContext {
  const w = grid.gridW;
  const gx = cell % w;
  const gy = Math.floor(cell / w);
  const around: WorldContext['around'] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = gx + dx;
      const y = gy + dy;
      const id = y * w + x;
      const info = x >= 0 && y >= 0 && x < w && y < grid.gridH ? grid.cells[id] : undefined;
      around.push(info ? (hasRealData(id) ? { land: info.land, mapSeed: mapSeedFor(state.seed, id), real: true } : { land: info.land, mapSeed: mapSeedFor(state.seed, id) }) : null);
    }
  }
  return { seed: state.seed >>> 0, gx, gy, gridW: w, around };
}

/** Generation parameters of a cell for the current game (null for the sea). */
export function areaParams(state: GameState, grid: StaticGrid, cell: CellId, lootSpots?: number): GenParams | null {
  const info = cellTactical(state, grid, cell);
  if (!info) return null;
  const params: GenParams = { mapSeed: mapSeedFor(state.seed, cell), land: info.land, isHome: cell === state.world.homeCell, lootSpots: lootSpots ?? info.lootSpots, world: worldContext(state, grid, cell) };
  // R0: the real map of the cell when its data are loaded (callers check realPending first).
  const real = realAreaOf(cell);
  if (real) params.real = real;
  // 07d-3: the municipality grade, stations and airports of the cell choose the buildings.
  const facts = grid.cells[cell]?.real;
  if (facts) params.facts = facts;
  return params;
}

/** R0: ask for the real-map data of the 3 × 3 cells around `cell` (loaded in the background by the app). */
export function prefetchReal(grid: StaticGrid, cell: CellId): void {
  const w = grid.gridW;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) requestRealArea(cell + dy * w + dx);
}

/** The live area of this game, or null while it has not been generated (or on the road). */
export function areaOf(state: GameState): TacticalArea | null {
  return state.tactical ? (areas.get(state.tactical) ?? null) : null;
}
export function mapOf(state: GameState): TacticalMap | null {
  return areaOf(state)?.map ?? null;
}

/** True when ensureArea() has (possibly slow) work to do — the main loop shows a loading screen first. */
export function areaPending(state: GameState, grid: StaticGrid | null): boolean {
  if (state.flags.range) return !state.tactical || !areas.has(state.tactical);
  if (!grid || state.world.travel || state.world.homeCell === null || !grid.cells[state.player.cell]) return false;
  const need = !state.tactical || state.tactical.cell !== state.player.cell || !areas.has(state.tactical);
  if (need) prefetchReal(grid, state.player.cell);
  return need;
}

/** R0: true while the area to be made waits for the cell's real-map data. */
export function areaWaiting(state: GameState, grid: StaticGrid | null): boolean {
  return Boolean(grid) && areaPending(state, grid) && realPending(state.player.cell);
}

/**
 * Bring state.tactical and its map in line with where the player is. Cheap when nothing changed.
 * Deterministic: depends only on the state and the static grid.
 */
/** Firing range (04, debug): a fixed flat map that needs no world data. */
function ensureRange(state: GameState): TacticalArea {
  const known = state.tactical ? areas.get(state.tactical) : undefined;
  if (known) return known;
  const map = state.flags.yard ? yardMap(state.flags.yard === 2 || state.flags.yard === 3 ? state.flags.yard : 1) : rangeMap();
  const fresh = !state.tactical;
  state.tactical ??= { cell: state.player.cell, mapSeed: map.params.mapSeed, zombies: [], corpses: [], bullets: [], reserve: 0, wind: [0, 0], lootSpots: state.flags.yard ? map.lootSpots.map((s) => spotState(s, false)) : [] };
  const area: TacticalArea = { map, dynamic: createSpatialHash() };
  areas.set(state.tactical, area);
  applyKeys(state, map);
  if (fresh) {
    placePlayer(state.player, map, map.spawn.edge[0], map.spawn.edge[1], map.spawn.edgeYaw);
    state.player.inv.ammo = BALANCE.range.ammo;
  }
  return area;
}

export function ensureArea(state: GameState, grid: StaticGrid | null): TacticalArea | null {
  if (state.flags.range) return ensureRange(state);
  if (!grid || state.world.homeCell === null) return null;
  if (state.world.travel) {
    state.tactical = null; // left the area; a new one is made on arrival
    return null;
  }
  const cell = state.player.cell;
  let tactical = state.tactical;
  if (tactical && tactical.cell === cell) {
    const known = areas.get(tactical);
    if (known) return known;
    if (realPending(cell)) return null; // R0: wait for the real-map data
    // Loaded game: rebuild the same map and keep what the save knows (taken loot spots, position).
    const params = areaParams(state, grid, cell, tactical.lootSpots.length);
    if (!params) return null;
    const map = mapFor({ ...params, mapSeed: tactical.mapSeed });
    const taken = new Set(tactical.lootSpots.filter((s) => s.taken).map((s) => s.id));
    tactical.lootSpots = map.lootSpots.map((s) => spotState(s, taken.has(s.id)));
    const area: TacticalArea = { map, dynamic: createSpatialHash() };
    areas.set(tactical, area);
    applyKeys(state, map);
    return area;
  }

  if (realPending(cell)) return null; // R0: wait for the real-map data
  prefetchReal(grid, cell);
  const params = areaParams(state, grid, cell);
  if (!params) return null;
  const map = mapFor(params);
  tactical = {
    cell,
    mapSeed: params.mapSeed,
    zombies: [],
    corpses: [],
    bullets: [],
    reserve: Math.max(0, state.world.cells.Z[cell] ?? 0),
    wind: [0, 0],
    lootSpots: map.lootSpots.map((s) => spotState(s, false)),
  };
  state.tactical = tactical;
  const area: TacticalArea = { map, dynamic: createSpatialHash() };
  areas.set(tactical, area);
  applyKeys(state, map);
  // Home: the middle of the base. Elsewhere: on the road at the edge of the area, facing in.
  if (params.isHome) placePlayer(state.player, map, map.spawn.home[0], map.spawn.home[1], 0);
  else placePlayer(state.player, map, map.spawn.edge[0], map.spawn.edge[1], map.spawn.edgeYaw);
  return area;
}

// ---------------------------------------------------------------------------------------------
// Walking into the next cell (07c)
// ---------------------------------------------------------------------------------------------

/** Areas the player walked out of, by cell, most recent last: stepping back finds them as they were. Not saved. */
const parked = new Map<CellId, { tactical: TacticalState; area: TacticalArea }>();

/** Generated map of a cell if it is already in the cache (render: neighbours), without generating it. */
export function cachedMap(params: GenParams): TacticalMap | null {
  return cache.get(keyOf(params)) ?? null;
}

/** Put a map generated elsewhere (a worker) into the cache, so that walking into its cell is instant. */
export function provideMap(params: GenParams, map: TacticalMap): void {
  const key = keyOf(params);
  if (cache.has(key)) return;
  cache.set(key, map);
  while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
}

/** Map of a cell for this game, generating it if needed (the renderer's neighbours, tests). */
export function mapForCell(state: GameState, grid: StaticGrid, cell: CellId): TacticalMap | null {
  if (realPending(cell)) return null;
  const params = areaParams(state, grid, cell);
  return params ? mapFor(params) : null;
}

/**
 * The player has stepped over the edge of the area onto the next cell's ground: make that cell
 * the current one. Coordinates move by one map size; the area left behind is parked; zombies
 * close by or chasing come along (put down just inside the new edge). Returns the new area, or
 * null when nothing happened.
 */
export function walkAcross(state: GameState, grid: StaticGrid | null, emit: (e: GameEvent) => void): TacticalArea | null {
  const t = state.tactical;
  if (!grid || !t || state.flags.range || state.world.travel) return null;
  const old = areas.get(t);
  if (!old) return null;
  const S = old.map.size;
  const p = state.player.pos;
  let dx = p[0] < 0 ? -1 : p[0] > S ? 1 : 0;
  let dz = p[2] < 0 ? -1 : p[2] > S ? 1 : 0;
  if (dx === 0 && dz === 0) return null;
  const w = grid.gridW;
  const gx = t.cell % w;
  const gy = Math.floor(t.cell / w);
  const land = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < grid.gridH && Boolean(grid.cells[y * w + x]);
  // Through a corner onto the sea: cross on one axis only (the one stepped further over).
  if (dx !== 0 && dz !== 0 && !land(gx + dx, gy + dz)) {
    const overX = dx < 0 ? -p[0] : p[0] - S;
    const overZ = dz < 0 ? -p[2] : p[2] - S;
    if (overX >= overZ) {
      p[2] = Math.min(S, Math.max(0, p[2]));
      dz = 0;
    } else {
      p[0] = Math.min(S, Math.max(0, p[0]));
      dx = 0;
    }
  }
  // R0: a neighbour whose real-map data have not arrived is closed for a moment (they are asked for).
  if (!land(gx + dx, gy + dz) || (!parked.has((gy + dz) * w + gx + dx) && realPending((gy + dz) * w + gx + dx))) {
    p[0] = Math.min(S, Math.max(0, p[0]));
    p[2] = Math.min(S, Math.max(0, p[2]));
    return null;
  }
  const from = t.cell;
  const to = (gy + dz) * w + gx + dx;
  prefetchReal(grid, to);
  const shiftX = -dx * S;
  const shiftZ = -dz * S;

  // Who comes along: anything close, and whatever is after the player.
  const carry = TACTICAL.world.carry;
  const coming = t.zombies.filter((z) => z.state !== 'down' && !z.dummy && (z.target === 'player' || Math.hypot(z.pos[0] - p[0], z.pos[2] - p[2]) < carry));
  t.zombies = t.zombies.filter((z) => !coming.includes(z));
  for (const z of coming) old.dynamic.remove(z.id);
  t.bullets.length = 0;

  // Park the area left behind (most recent last), then take the next one: parked, or new.
  parked.delete(from);
  parked.set(from, { tactical: t, area: old });
  while (parked.size > TACTICAL.world.parked) parked.delete(parked.keys().next().value!);

  state.player.cell = to;
  p[0] += shiftX;
  p[2] += shiftZ;
  reveal(state, grid, to);
  let next = parked.get(to);
  parked.delete(to);
  if (next) {
    state.tactical = next.tactical;
    areas.set(next.tactical, next.area);
  } else {
    const params = areaParams(state, grid, to);
    if (!params) return null;
    const map = mapFor(params);
    const tactical: TacticalState = {
      cell: to,
      mapSeed: params.mapSeed,
      zombies: [],
      corpses: [],
      bullets: [],
      reserve: Math.max(0, state.world.cells.Z[to] ?? 0),
      wind: [0, 0],
      lootSpots: map.lootSpots.map((s) => spotState(s, false)),
    };
    next = { tactical, area: { map, dynamic: createSpatialHash() } };
    state.tactical = tactical;
    areas.set(tactical, next.area);
  }
  applyKeys(state, next.area.map);
  // Followers step over too, just inside the new edge where they were along it.
  const nt = state.tactical!;
  const inside = (v: number): number => Math.min(S - 3, Math.max(3, v));
  for (const z of coming) {
    z.pos[0] = inside(z.pos[0] + shiftX);
    z.pos[2] = inside(z.pos[2] + shiftZ);
    z.goal[0] = inside(z.goal[0] + shiftX);
    z.goal[1] = inside(z.goal[1] + shiftZ);
    nt.zombies.push(z);
    next.area.dynamic.set(z.id, z.pos[0], z.pos[2]);
  }
  emit({ type: 'cellEntered', cell: to, from, walked: true });
  return next.area;
}

/** Forget the parked areas (new game, load, quitting). */
export function clearParked(): void {
  parked.clear();
}
