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
import { generateTacticalMap, mapSeedFor, type GenParams, type TacticalMap } from '../../gen/index.ts';
import { cellTactical } from '../world/derive.ts';
import { createSpatialHash, type SpatialHash } from './collision.ts';
import { placePlayer } from './player.ts';
import { rangeMap } from './range.ts';
import { BALANCE } from '../../data/balance.ts';

export interface TacticalArea {
  map: TacticalMap;
  /** Dynamic objects of this area (zombies, survivors...) — owned by whoever inserts them (04/05). */
  dynamic: SpatialHash;
}

const areas = new WeakMap<TacticalState, TacticalArea>();
/** Last generated maps by parameters, so that re-entering a cell or reloading is instant. */
const cache = new Map<string, TacticalMap>();
const CACHE_SIZE = 3;

const keyOf = (p: GenParams): string => `${p.mapSeed}:${p.land}:${p.isHome ? 1 : 0}:${p.lootSpots}`;

function mapFor(params: GenParams): TacticalMap {
  const key = keyOf(params);
  let map = cache.get(key);
  if (map) cache.delete(key);
  else map = generateTacticalMap(params);
  cache.set(key, map); // most recent last
  while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return map;
}

/** Generation parameters of a cell for the current game (null for the sea). */
export function areaParams(state: GameState, grid: StaticGrid, cell: CellId, lootSpots?: number): GenParams | null {
  const info = cellTactical(state, grid, cell);
  if (!info) return null;
  return { mapSeed: mapSeedFor(state.seed, cell), land: info.land, isHome: cell === state.world.homeCell, lootSpots: lootSpots ?? info.lootSpots };
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
  return !state.tactical || state.tactical.cell !== state.player.cell || !areas.has(state.tactical);
}

/**
 * Bring state.tactical and its map in line with where the player is. Cheap when nothing changed.
 * Deterministic: depends only on the state and the static grid.
 */
/** Firing range (04, debug): a fixed flat map that needs no world data. */
function ensureRange(state: GameState): TacticalArea {
  const known = state.tactical ? areas.get(state.tactical) : undefined;
  if (known) return known;
  const map = rangeMap();
  const fresh = !state.tactical;
  state.tactical ??= { cell: state.player.cell, mapSeed: map.params.mapSeed, zombies: [], corpses: [], bullets: [], reserve: 0, wind: [0, 0], lootSpots: [] };
  const area: TacticalArea = { map, dynamic: createSpatialHash() };
  areas.set(state.tactical, area);
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
    // Loaded game: rebuild the same map and keep what the save knows (taken loot spots, position).
    const params = areaParams(state, grid, cell, tactical.lootSpots.length);
    if (!params) return null;
    const map = mapFor({ ...params, mapSeed: tactical.mapSeed });
    const taken = new Set(tactical.lootSpots.filter((s) => s.taken).map((s) => s.id));
    tactical.lootSpots = map.lootSpots.map((s) => ({ id: s.id, pos: [s.pos[0], s.pos[1]], taken: taken.has(s.id) }));
    const area: TacticalArea = { map, dynamic: createSpatialHash() };
    areas.set(tactical, area);
    return area;
  }

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
    lootSpots: map.lootSpots.map((s) => ({ id: s.id, pos: [s.pos[0], s.pos[1]], taken: false })),
  };
  state.tactical = tactical;
  const area: TacticalArea = { map, dynamic: createSpatialHash() };
  areas.set(tactical, area);
  // Home: the middle of the base. Elsewhere: on the road at the edge of the area, facing in.
  if (params.isHome) placePlayer(state.player, map, map.spawn.home[0], map.spawn.home[1], 0);
  else placePlayer(state.player, map, map.spawn.edge[0], map.spawn.edge[1], map.spawn.edgeYaw);
  return area;
}
