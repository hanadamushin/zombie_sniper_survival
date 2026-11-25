// Outposts (spec §8): forward bases in cleared cells. Founding and upgrading, the garrison, the
// daily supply run from the base, resupplying the player, attacks decided in numbers, and the
// little prefab compound that stands in the middle of an outpost cell's operation area.

import { rand, stream } from '../../core/rng.ts';
import type { CellId, GameState, Outpost, ResourceId, StaticGrid, Survivor } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { BUILD, type Cost } from '../../data/buildings.ts';
import { mapSeedFor, type TacticalMap } from '../../gen/index.ts';
import { cacheAmmo } from '../../gen/caches.ts';
import { techUnlocked } from '../build/structures.ts';
import { getMod, hasFlag } from '../research/modifiers.ts';
import { aptitude } from '../colony/jobs.ts';
import { killSurvivor } from '../colony/morale.ts';
import { logEntry, moveEars, moveStock, type ColonyCtx } from '../colony/stock.ts';
import { isFit, statSum } from '../colony/survivors.ts';
import { isCleared, removeZombies } from './derive.ts';
import { stashSite, stashSupply } from './stash.ts';
import { cellDistance } from './grid.ts';

const O = BUILD.outpost;
type Res = Exclude<ResourceId, 'ears'>;

export function outpostAt(state: GameState, cell: CellId): Outpost | undefined {
  return state.world.outposts.find((o) => o.cell === cell);
}

/** The base or an outpost: where convoys start and fast travel works. */
export function isStation(state: GameState, cell: CellId): boolean {
  return cell === state.world.homeCell || outpostAt(state, cell) !== undefined;
}

const tierOf = (tier: number) => O.tiers[tier - 1]!;

export function garrisonOf(state: GameState, o: Outpost): Survivor[] {
  return o.garrison.map((id) => state.colony.survivors.find((s) => s.id === id)).filter((s): s is Survivor => s !== undefined);
}

/** Defence value: the works of its tier plus what the garrison adds. */
export function outpostDefense(state: GameState, o: Outpost): number {
  let d: number = tierOf(o.tier).defense;
  for (const s of garrisonOf(state, o)) d += (O.defensePerGuard * aptitude(s, 'defense')) / 5;
  return d;
}

function canPay(state: GameState, ears: number, cost: Cost): string | null {
  if (state.colony.stock.ears < ears) return 'noEars';
  for (const res of Object.keys(cost) as Res[]) if (state.colony.stock[res] < (cost[res] ?? 0)) return 'noMaterials';
  return null;
}
function pay(c: ColonyCtx, ears: number, cost: Cost): void {
  moveEars(c, 'other', ears);
  for (const res of Object.keys(cost) as Res[]) moveStock(c, res, -(cost[res] ?? 0));
}

/** Who goes when nobody is named: a guard, then someone idle, then whoever is least missed. */
function pickGuard(state: GameState): Survivor | undefined {
  const fit = state.colony.survivors.filter(isFit);
  return fit.find((s) => s.job === 'defense') ?? fit.find((s) => s.job === 'idle') ?? [...fit].sort((a, b) => statSum(a) - statSum(b) || a.id - b.id)[0];
}

/** Why an outpost cannot be founded on `cell`, or null. */
export function foundError(state: GameState, grid: StaticGrid, cell: CellId): string | null {
  const home = state.world.homeCell;
  if (home === null || !grid.cells[cell]) return 'noMap';
  if (cell === home || outpostAt(state, cell)) return 'occupied';
  if ((state.world.cells.intel[cell] ?? 0) < 2 || !isCleared(state.world.cells.Z[cell] ?? 0)) return 'notCleared';
  const near = [home, ...state.world.outposts.map((o) => o.cell)].some((c) => cellDistance(grid, c, cell) <= O.reach);
  if (!near) return 'tooFar';
  const T = tierOf(1);
  const short = canPay(state, T.ears, T.cost);
  if (short) return short;
  if (!pickGuard(state)) return 'noGuard';
  return null;
}

export function foundOutpost(c: ColonyCtx, cell: CellId): string | null {
  const { state, grid } = c;
  if (!grid) return 'noMap';
  const error = foundError(state, grid, cell);
  if (error) return error;
  const T = tierOf(1);
  pay(c, T.ears, T.cost);
  const guard = pickGuard(state)!;
  const o: Outpost = { id: state.nextId++, cell, tier: 1, ammo: 0, garrison: [guard.id], defense: 0, foundedDay: state.time.day, convoy: null };
  guard.location = { kind: 'outpost', id: o.id };
  guard.task = null;
  o.defense = outpostDefense(state, o);
  state.world.outposts.push(o);
  logEntry(c, 'outpost', 'log.outpostFounded', { cell, name: guard.name });
  c.emit({ type: 'outpostFounded', id: o.id, cell });
  return null;
}

export function upgradeError(state: GameState, o: Outpost): string | null {
  if (o.tier >= 3) return 'maxTier';
  const T = tierOf(o.tier + 1);
  if (!techUnlocked(state, (T as { tech?: string }).tech)) return 'locked';
  if (garrisonOf(state, o).length < T.garrison) return 'noGuard';
  return canPay(state, T.ears, T.cost);
}

export function upgradeOutpost(c: ColonyCtx, id: number): string | null {
  const o = c.state.world.outposts.find((x) => x.id === id);
  if (!o) return 'unknownOutpost';
  const error = upgradeError(c.state, o);
  if (error) return error;
  const T = tierOf(o.tier + 1);
  pay(c, T.ears, T.cost);
  o.tier = (o.tier + 1) as 2 | 3;
  o.defense = outpostDefense(c.state, o);
  logEntry(c, 'outpost', 'log.outpostUpgraded', { cell: o.cell, tier: o.tier });
  c.emit({ type: 'outpostUpgraded', id: o.id, tier: o.tier });
  return null;
}

/** Post a survivor from the base to an outpost, or call one back (outpost null). */
export function assignGarrison(c: ColonyCtx, survivorId: number, outpostId: number | null): string | null {
  const { state } = c;
  const s = state.colony.survivors.find((x) => x.id === survivorId);
  if (!s) return 'unknownSurvivor';
  if (outpostId === null) {
    if (s.location.kind !== 'outpost') return 'notPosted';
    const from = state.world.outposts.find((o) => o.id === (s.location as { id: number }).id);
    if (from) {
      from.garrison = from.garrison.filter((id) => id !== s.id);
      from.defense = outpostDefense(state, from);
    }
    s.location = { kind: 'home' };
    s.task = null;
    return null;
  }
  const o = state.world.outposts.find((x) => x.id === outpostId);
  if (!o) return 'unknownOutpost';
  if (!isFit(s)) return 'notAvailable';
  s.location = { kind: 'outpost', id: o.id };
  s.task = null;
  o.garrison.push(s.id);
  o.defense = outpostDefense(state, o);
  logEntry(c, 'outpost', 'log.outpostPosted', { cell: o.cell, name: s.name });
  return null;
}

/** Days a convoy from the nearest supplied point takes (0 = same day). */
export function supplyDelay(state: GameState, grid: StaticGrid, o: Outpost): number {
  if (hasFlag(state, 'supply.noDelay')) return 0; // vehicles (S7b)
  const home = state.world.homeCell;
  let dist = home === null ? 0 : cellDistance(grid, home, o.cell);
  // Other outposts that already hold ammunition can pass it on.
  for (const other of state.world.outposts) if (other !== o && other.ammo > 0) dist = Math.min(dist, cellDistance(grid, other.cell, o.cell));
  return Math.floor(dist / O.delayCells);
}

/**
 * Once a day, after the infection step. `inflow[i]` is the number of zombies that walked into
 * outpost i's cell today: the attack. Then the supply convoys.
 */
export function outpostsDay(c: ColonyCtx, inflow: readonly number[]): void {
  const { state, grid } = c;
  if (!grid) return;
  const rng = stream(state, 'world.outposts');
  const list = [...state.world.outposts];
  list.forEach((o, i) => {
    // Garrison members who died or left elsewhere.
    o.garrison = o.garrison.filter((id) => state.colony.survivors.some((s) => s.id === id));
    o.defense = outpostDefense(state, o);
    const attack = inflow[i] ?? 0;
    if (attack > o.defense * O.fallFactor) {
      // Overrun: the garrison runs for the base, not everyone makes it.
      let dead = 0;
      for (const s of garrisonOf(state, o)) {
        if (rand(rng) < O.deathChance) {
          killSurvivor(c, s, 'outpost');
          dead++;
        } else {
          s.location = { kind: 'home' };
          s.task = null;
        }
      }
      state.world.outposts = state.world.outposts.filter((x) => x !== o);
      logEntry(c, 'outpost', 'log.outpostLost', { cell: o.cell, n: Math.round(attack), dead });
      c.emit({ type: 'outpostLost', id: o.id, cell: o.cell });
      return;
    }
    if (attack >= 1 && o.garrison.length > 0) {
      const killed = removeZombies(state, o.cell, Math.round(attack * O.killShare));
      if (killed > 0) {
        moveEars(c, 'income', Math.floor(killed * BALANCE.combat.ears.perCorpse * BUILD.raid.earRate));
        logEntry(c, 'outpost', 'log.outpostHeld', { cell: o.cell, n: killed });
      }
    }
    // Supply.
    if (o.convoy && state.time.day >= o.convoy.day) {
      o.ammo = Math.min(tierOf(o.tier).ammoCap, o.ammo + o.convoy.ammo);
      c.emit({ type: 'outpostSupplied', id: o.id, ammo: o.convoy.ammo });
      o.convoy = null;
    }
    if (!o.convoy && o.garrison.length > 0) {
      const short = tierOf(o.tier).ammoCap - o.ammo;
      const rate = getMod(state, 'outpost.supply', O.supplyBase + O.supplyPerTier * o.tier);
      const want = Math.floor(Math.min(short, rate, state.colony.stock.ammo));
      if (want > 0) {
        const sent = moveStock(c, 'ammo', -want);
        const delay = supplyDelay(state, grid, o);
        if (delay <= 0) {
          o.ammo += sent;
          c.emit({ type: 'outpostSupplied', id: o.id, ammo: sent });
        } else o.convoy = { day: state.time.day + delay, ammo: sent };
      }
    }
  });
}

/** The player takes ammunition from the outpost they are standing in. */
export function resupplyAtOutpost(c: ColonyCtx): string | null {
  const { state } = c;
  if (state.world.travel) return 'notHome';
  const o = outpostAt(state, state.player.cell);
  if (!o) return 'notHome';
  const inv = state.player.inv;
  const room = BALANCE.player.maxAmmo - (inv.ammo ?? 0);
  if (room <= 0) return 'full';
  const got = Math.floor(Math.min(room, o.ammo));
  if (got <= 0) return 'noAmmo';
  o.ammo -= got;
  inv.ammo = (inv.ammo ?? 0) + got;
  c.emit({ type: 'resupplied', ammo: got });
  return null;
}

// ---------------------------------------------------------------------------------------------
// The compound in the operation area
// ---------------------------------------------------------------------------------------------

export interface PrefabBox {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Height above the ground and what it looks like. `solid` boxes collide. */
  h: number;
  look: 'wood' | 'cloth' | 'crate' | 'flag' | 'steel';
  solid: boolean;
}
export interface Prefab {
  /** Middle of the compound (m). */
  site: [number, number];
  boxes: PrefabBox[];
}

const sites = new WeakMap<TacticalMap, [number, number] | null>();

/** The flat, open spot nearest the middle of the map that fits the compound (5 x 5 tiles), or null. */
export function outpostSite(map: TacticalMap): [number, number] | null {
  const known = sites.get(map);
  if (known !== undefined) return known;
  const mid = map.tiles / 2;
  const fits = (tx: number, ty: number): boolean => {
    let lo = Infinity, hi = -Infinity;
    for (let y = ty - 3; y <= ty + 3; y++) {
      for (let x = tx - 3; x <= tx + 3; x++) {
        if (!map.walk[y * map.tiles + x]) return false;
        const h = map.height[y * map.n + x]!;
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
    }
    if (hi - lo > 2) return false;
    const x0 = (tx - 3) * map.tile, z0 = (ty - 3) * map.tile, x1 = (tx + 4) * map.tile, z1 = (ty + 4) * map.tile;
    for (let i = 0; i < map.trees.n; i++) if (map.trees.x[i]! > x0 && map.trees.x[i]! < x1 && map.trees.z[i]! > z0 && map.trees.z[i]! < z1) return false;
    return true;
  };
  let found: [number, number] | null = null;
  search: for (let r = 0; r < 60; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (fits(mid + dx * 2, mid + dy * 2)) {
          found = [(mid + dx * 2 + 0.5) * map.tile, (mid + dy * 2 + 0.5) * map.tile];
          break search;
        }
      }
    }
  }
  sites.set(map, found);
  return found;
}

/** Fence with a gap to the south, tents, ammunition crates and a flag; more of each with the tier. */
export function outpostPrefab(map: TacticalMap, tier: number): Prefab | null {
  const site = outpostSite(map);
  if (!site) return null;
  const [cx, cz] = site;
  const boxes: PrefabBox[] = [];
  const half = 9;
  const t = 0.25;
  const fenceH = tier >= 2 ? 2.2 : 1.6;
  const look = tier >= 3 ? 'steel' : 'wood';
  const add = (x0: number, z0: number, x1: number, z1: number, h: number, l: PrefabBox['look'], solid = true): void => {
    boxes.push({ x0, z0, x1, z1, h, look: l, solid });
  };
  add(cx - half, cz - half, cx + half, cz - half + t, fenceH, look); // north
  add(cx - half, cz - half, cx - half + t, cz + half, fenceH, look); // west
  add(cx + half - t, cz - half, cx + half, cz + half, fenceH, look); // east
  add(cx - half, cz + half - t, cx - 1.6, cz + half, fenceH, look); // south, with the entrance in the middle
  add(cx + 1.6, cz + half - t, cx + half, cz + half, fenceH, look);
  for (let i = 0; i < tier + 1; i++) add(cx - 7 + i * 4.2, cz - 7, cx - 3.8 + i * 4.2, cz - 3.5, 2, 'cloth');
  for (let i = 0; i < tier * 2; i++) add(cx + 4 + (i % 2) * 1.1, cz + 2 + Math.floor(i / 2) * 1.1, cx + 5 + (i % 2) * 1.1, cz + 3 + Math.floor(i / 2) * 1.1, 0.8, 'crate');
  add(cx - 0.08, cz + 3, cx + 0.08, cz + 3.16, 6, 'wood', false); // flag pole
  add(cx + 0.08, cz + 3.04, cx + 1.5, cz + 3.1, 0.9, 'flag', false); // (drawn at the top of the pole)
  return { site, boxes };
}

// ---------------------------------------------------------------------------------------------
// Where to get ammunition (07c: map markers, the HUD hint and the beacons)
// ---------------------------------------------------------------------------------------------

export interface SupplyPoint {
  cell: CellId;
  /** O1: `stash` a hidden stash's supply point (data/balance okinawa), once its cell is known. */
  kind: 'home' | 'outpost' | 'cache' | 'stash';
  /** For a cache: its index in TacticalMap.caches / cacheAmmo(). */
  index?: number;
  /** Rounds there now. */
  ammo: number;
  /** Where in the cell's area to head for (m, the area's own frame): the headquarters, or the compound's site when `map` is known (else the middle). */
  pos: [number, number];
  /** O1: the floor it stands on (a stash inside a building), when known. */
  y?: number;
}

/** Rounds left in each ammunition cache of a cell (07c). */
export function cachesLeft(state: GameState, grid: StaticGrid, cell: CellId): number[] {
  const info = grid.cells[cell];
  if (!info) return [];
  const taken = state.world.cacheTaken?.[String(cell)] ?? [];
  return cacheAmmo(mapSeedFor(state.seed, cell), info.land).map((a, i) => Math.max(0, a - (taken[i] ?? 0)));
}

/** The cache in reach of the player in the current area, if any rounds are left in it. */
export function cacheInReach(state: GameState, grid: StaticGrid | null, map: TacticalMap | null): { index: number; left: number } | null {
  if (!grid || !map || state.flags.range || state.world.travel) return null;
  const left = cachesLeft(state, grid, state.player.cell);
  const [px, , pz] = state.player.pos;
  let best: { index: number; left: number; d: number } | null = null;
  map.caches.forEach((c, i) => {
    const d = Math.hypot(c.pos[0] - px, c.pos[1] - pz);
    if ((left[i] ?? 0) > 0 && d <= BALANCE.world.caches.reach && (!best || d < best.d)) best = { index: i, left: left[i]!, d };
  });
  const found = best as { index: number; left: number; d: number } | null;
  return found ? { index: found.index, left: found.left } : null;
}

/** B next to a cache: take what fits from it (07c). */
export function resupplyFromCache(c: ColonyCtx, map: TacticalMap | null): string | null {
  const { state, grid } = c;
  const at = cacheInReach(state, grid, map);
  if (!at) return 'notHome';
  const inv = state.player.inv;
  const room = BALANCE.player.maxAmmo - (inv.ammo ?? 0);
  if (room <= 0) return 'full';
  const got = Math.min(room, at.left);
  const key = String(state.player.cell);
  const taken = ((state.world.cacheTaken ??= {})[key] ??= []);
  while (taken.length <= at.index) taken.push(0);
  taken[at.index] = taken[at.index]! + got;
  inv.ammo = (inv.ammo ?? 0) + got;
  c.emit({ type: 'resupplied', ammo: got });
  return null;
}

/**
 * Everywhere B takes ammunition: the base and the outposts (anywhere in that cell), and — for the
 * cells listed in `cacheCells` — the caches with rounds left (07c; next to them). `mapOfCell` gives
 * exact positions where the area's map is known.
 */
export function supplyPoints(state: GameState, mapOfCell?: (cell: CellId) => TacticalMap | null, grid?: StaticGrid | null, cacheCells: readonly CellId[] = []): SupplyPoint[] {
  const out: SupplyPoint[] = [];
  const home = state.world.homeCell;
  if (home !== null) {
    const hq = state.build.structures.find((s) => s.def === 'hq');
    const pos: [number, number] = hq ? [(hq.tx + 1.5) * 4, (hq.ty + 1.5) * 4] : [512, 512];
    out.push({ cell: home, kind: 'home', ammo: Math.floor(state.colony.stock.ammo), pos });
  }
  for (const o of state.world.outposts) {
    const map = mapOfCell?.(o.cell) ?? null;
    out.push({ cell: o.cell, kind: 'outpost', ammo: Math.floor(o.ammo), pos: (map && outpostSite(map)) ?? [512, 512] });
  }
  if (grid) {
    for (const cell of cacheCells) {
      const left = cachesLeft(state, grid, cell);
      if (left.length === 0) continue;
      const map = mapOfCell?.(cell) ?? null;
      left.forEach((n, i) => {
        if (n <= 0) return;
        const pos = map?.caches[i]?.pos;
        if (map && !pos) return;
        out.push({ cell, kind: 'cache', index: i, ammo: n, pos: pos ? [pos[0], pos[1]] : [512, 512] });
      });
    }
    // O1: the hidden stash with rounds, where its place is known (like a cache: next to it).
    for (const sp of stashSupply(state, grid, mapOfCell)) {
      if (!cacheCells.includes(sp.cell)) continue;
      const map = mapOfCell?.(sp.cell) ?? null;
      const site = map ? stashSite(map) : null;
      if (map && !site) continue;
      out.push(site ? { cell: sp.cell, kind: 'stash', ammo: sp.ammo, pos: sp.pos, y: site.supply[1] } : { cell: sp.cell, kind: 'stash', ammo: sp.ammo, pos: sp.pos });
    }
  }
  return out;
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/**
 * Nearest supply point to the player on foot (07c: the world is continuous, an area is 1,024 m):
 * straight-line distance in metres, compass direction, and the turn from the view for an arrow.
 * Null when the player already stands in a supply cell, or there is none.
 */
export function nearestSupply(
  state: GameState, size = 1024, mapOfCell?: (cell: CellId) => TacticalMap | null, grid?: StaticGrid | null, cacheCells: readonly CellId[] = [],
): { point: SupplyPoint; dist: number; dir: (typeof DIRS)[number]; turn: number } | null {
  const w = state.world.gridW;
  if (!w) return null;
  const here = state.player.cell;
  // Caches only where their place is known (the areas whose maps are made).
  const points = supplyPoints(state, mapOfCell, grid, cacheCells.filter((c) => mapOfCell?.(c)));
  if (points.some((p) => p.cell === here && p.kind !== 'cache' && p.kind !== 'stash')) return null;
  const px = (here % w) * size + state.player.pos[0];
  const pz = Math.floor(here / w) * size + state.player.pos[2];
  let best: { point: SupplyPoint; dist: number; dir: (typeof DIRS)[number]; turn: number } | null = null;
  // Where there is ammunition first; only when there is none anywhere, the nearest empty one ("no ammunition").
  const stocked = points.filter((p) => p.ammo > 0);
  for (const p of stocked.length > 0 ? stocked : points) {
    const dx = (p.cell % w) * size + p.pos[0] - px;
    const dz = Math.floor(p.cell / w) * size + p.pos[1] - pz;
    const dist = Math.hypot(dx, dz);
    if (best && dist >= best.dist) continue;
    const bearing = (Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2);
    best = { point: p, dist, dir: DIRS[Math.round(bearing / (Math.PI / 4)) % 8]!, turn: Math.atan2(-dx, -dz) - state.player.yaw };
  }
  return best;
}
