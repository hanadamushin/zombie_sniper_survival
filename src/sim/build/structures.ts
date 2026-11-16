// Structures as the rest of the sim sees them: lookups, what they do to the 4 m grid (the
// "overlay"), their collision boxes inside the home map, damage and destruction, and the effects
// functional buildings have on the colony.
//
// Nothing here is saved: the overlay and the collision boxes are derived from state.build and
// rebuilt whenever build.gridRev changes.

import type { GameEvent } from '../../core/events.ts';
import { toAbsMinutes } from '../../core/time.ts';
import type { GameState, JobId, ResourceId, Structure } from '../../core/types.ts';
import { BUILD, BUILDINGS, footprint, type BuildingDef } from '../../data/buildings.ts';
import { COLONY } from '../../data/colony.ts';
import { TACTICAL } from '../../data/tactical.ts';
import type { Ladder, Solid, TacticalMap } from '../../gen/index.ts';
import { ctxNow, logEntry } from '../colony/stock.ts';
import { heightAt } from '../tactical/collision.ts';

export const TILE = TACTICAL.tile;
export const TILES = TACTICAL.size / TACTICAL.tile;
const F = BUILD.flow;

export function defOf(st: Structure): BuildingDef {
  return BUILDINGS[st.def] ?? BUILDINGS.palisade!;
}

/** A tech the colony really has (bonuses). Availability goes through isUnlocked. */
export function hasTech(state: GameState, id: string): boolean {
  return state.research.done.includes(id);
}

/**
 * THE one place that decides whether something tech-gated is available (buildings, defender
 * weapons, outpost tiers). 07 only has to fill state.research.done and set BUILD.unlockAllUntilTech
 * to false; `flags.unlockAll` stays as the debug override.
 */
export function techUnlocked(state: GameState, tech: string | undefined): boolean {
  return tech === undefined || BUILD.unlockAllUntilTech || state.flags.unlockAll === true || hasTech(state, tech);
}
export function isUnlocked(defId: string, state: GameState): boolean {
  const def = BUILDINGS[defId];
  return def !== undefined && techUnlocked(state, def.tech);
}

export function maxHp(state: GameState, def: BuildingDef): number {
  return def.hp * (hasTech(state, 'F9') && def.category === 'defense' ? BUILD.hpMulF9 : 1);
}

export const isRuin = (st: Structure): boolean => st.ruinUntil !== undefined;
/** Finished and standing. */
export const isBuilt = (st: Structure): boolean => st.progress >= 1 && st.ruinUntil === undefined;

export function forTiles(st: Structure, fn: (tile: number, tx: number, ty: number) => void): void {
  const [w, d] = footprint(defOf(st), st.rot);
  for (let y = st.ty; y < st.ty + d; y++) for (let x = st.tx; x < st.tx + w; x++) fn(y * TILES + x, x, y);
}

/** Centre of a structure in metres [x, z]. */
export function centreOf(st: Structure): [number, number] {
  const [w, d] = footprint(defOf(st), st.rot);
  return [(st.tx + w / 2) * TILE, (st.ty + d / 2) * TILE];
}

export function hqOf(state: GameState): Structure | undefined {
  return state.build.structures.find((s) => s.def === 'hq' && isBuilt(s));
}

export function structureById(state: GameState, id: number): Structure | undefined {
  return state.build.structures.find((s) => s.id === id);
}

/** A moat tile that bodies have made passable. */
export const moatFilled = (st: Structure): boolean => !defOf(st).unfillable && (st.corpsesInMoat ?? 0) >= BUILD.moatFill;

// ---------------------------------------------------------------------------------------------
// Overlay: what the structures do to each tile
// ---------------------------------------------------------------------------------------------

export interface Overlay {
  rev: number;
  /** Index + 1 into build.structures of whatever occupies the tile (blueprints and rubble included), 0 = free. */
  occ: Int16Array;
  /** Index + 1 of the standing structure that zombies have to deal with on this tile, 0 = none. */
  sidx: Int16Array;
  /** Flow-field cost of entering the tile (Infinity = never). */
  cost: Float32Array;
  /**
   * Barriers that stop zombies but not people or bullets (they have no collision box):
   * 1 = the whole tile (moat, raised bridge, the space under a tower), 2 / 3 = a gate running east–west / north–south.
   */
  zblock: Uint8Array;
  /** Wall-like tiles: bit 1 west, 2 east, 4 north, 8 south neighbour is wall-like too; 16 = runs east–west when alone. */
  links: Uint8Array;
  /** 1 = people cannot walk through (walls, moats, buildings — not gates, not lowered bridges). */
  sblock: Uint8Array;
  /** 1 = barbed wire. */
  wire: Uint8Array;
}

const LINKS = new Set(['wall', 'gate', 'tower']);
const overlays = new WeakMap<GameState['build'], { walk: Uint8Array | null; alarm: boolean; ov: Overlay }>();

/** Flow cost of a standing structure's tile. */
function tileCost(st: Structure, def: BuildingDef, alarm: boolean): number {
  switch (def.kind) {
    case 'moat': return def.unfillable ? Infinity : moatFilled(st) ? F.moatFilled : 1 + F.moatPerBody * (BUILD.moatFill - (st.corpsesInMoat ?? 0));
    case 'bridge': return alarm ? 1 + st.hp / F.wallHpPerCost + F.moatPerBody : 1;
    case 'wire': return 1 + F.wire;
    case 'field': return 1;
    default: return 1 + st.hp / F.wallHpPerCost;
  }
}

/**
 * The overlay for the current structures. `walk` is the static walkability of the home map
 * (TacticalMap.walk) or null when the map is not loaded — the base then counts as open ground,
 * which is what its levelled building site is.
 */
export function overlayOf(state: GameState, walk: Uint8Array | null): Overlay {
  const build = state.build;
  const alarm = state.flags.colonyAlarm === true;
  const cached = overlays.get(build);
  if (cached && cached.ov.rev === build.gridRev && cached.walk === walk && cached.alarm === alarm) return cached.ov;
  const n = TILES * TILES;
  const ov: Overlay = cached?.ov ?? { rev: 0, occ: new Int16Array(n), sidx: new Int16Array(n), cost: new Float32Array(n), zblock: new Uint8Array(n), sblock: new Uint8Array(n), wire: new Uint8Array(n), links: new Uint8Array(n) };
  ov.rev = build.gridRev;
  ov.occ.fill(0);
  ov.sidx.fill(0);
  ov.zblock.fill(0);
  ov.sblock.fill(0);
  ov.wire.fill(0);
  ov.links.fill(0);
  if (walk) for (let i = 0; i < n; i++) ov.cost[i] = walk[i] ? 1 : Infinity;
  else ov.cost.fill(1);
  build.structures.forEach((st, index) => {
    const def = defOf(st);
    const built = isBuilt(st);
    forTiles(st, (t) => {
      if (t < 0 || t >= n) return;
      ov.occ[t] = index + 1;
      if (isRuin(st)) {
        ov.cost[t] = F.rubble;
        return;
      }
      if (!built) return;
      ov.cost[t] = tileCost(st, def, alarm);
      if (def.kind === 'field') return;
      if (def.kind === 'wire') {
        ov.wire[t] = 1;
        ov.sidx[t] = index + 1;
        return;
      }
      if (def.kind === 'moat' && moatFilled(st)) return;
      if (def.kind === 'bridge' && !alarm) return;
      ov.sidx[t] = index + 1;
      if (def.kind === 'moat' || def.kind === 'bridge' || def.kind === 'tower') ov.zblock[t] = 1;
      if (def.kind !== 'gate') ov.sblock[t] = 1;
    });
  });
  // Second pass: how walls, gates and towers join up.
  build.structures.forEach((st) => {
    const kind = defOf(st).kind;
    if (!isBuilt(st) || !LINKS.has(kind)) return;
    const l = wallLinks(state, ov, st.tx, st.ty);
    const t = st.ty * TILES + st.tx;
    const ew = runsEastWest(l, st.rot);
    ov.links[t] = (l[0] ? 1 : 0) | (l[1] ? 2 : 0) | (l[2] ? 4 : 0) | (l[3] ? 8 : 0) | (ew ? 16 : 0);
    if (kind === 'gate') ov.zblock[t] = ew ? 2 : 3;
  });
  overlays.set(build, { walk, alarm, ov });
  return ov;
}

export function structureAtTile(state: GameState, ov: Overlay, tile: number): Structure | undefined {
  const i = ov.sidx[tile]!;
  return i > 0 ? state.build.structures[i - 1] : undefined;
}

// ---------------------------------------------------------------------------------------------
// Collision boxes inside the home map
// ---------------------------------------------------------------------------------------------

interface Synced {
  owner: object | null;
  rev: number;
  baseSolids: number;
  baseLadders: number;
}
const synced = new WeakMap<TacticalMap, Synced>();

/** Which of the four neighbours (W, E, N, S) of a wall-like tile are wall-like too. */
export function wallLinks(state: GameState, ov: Overlay, tx: number, ty: number): [boolean, boolean, boolean, boolean] {
  const at = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= TILES || y >= TILES) return false;
    const i = ov.occ[y * TILES + x]!;
    const st = i > 0 ? state.build.structures[i - 1] : undefined;
    return st !== undefined && isBuilt(st) && LINKS.has(defOf(st).kind);
  };
  return [at(tx - 1, ty), at(tx + 1, ty), at(tx, ty - 1), at(tx, ty + 1)];
}

/** Does a lone wall / gate run east–west (true) or north–south? Decided by its neighbours, then its rotation. */
export function runsEastWest(links: readonly boolean[], rot: number): boolean {
  if (links[0] || links[1]) return true;
  if (links[2] || links[3]) return false;
  return rot % 2 === 0;
}

/** Ladder side of a tower by rotation: [dx, dz] pointing away from the tower. */
export function towerLadderDir(rot: number): [number, number] {
  return ([[0, 1], [-1, 0], [0, -1], [1, 0]] as const)[rot & 3] as unknown as [number, number];
}

function addSolids(_state: GameState, ov: Overlay, map: TacticalMap, st: Structure, solids: Solid[], ladders: Ladder[]): void {
  const def = defOf(st);
  const [w, d] = footprint(def, st.rot);
  const x0 = st.tx * TILE, z0 = st.ty * TILE, x1 = x0 + w * TILE, z1 = z0 + d * TILE;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const base = heightAt(map, cx, cz);
  const box = (ax: number, az: number, bx: number, bz: number, y0: number, y1: number): void => {
    solids.push({ x0: ax, z0: az, x1: bx, z1: bz, y0, y1, kind: 'prop', ref: -1 });
  };
  switch (def.kind) {
    case 'wall': {
      const h = (def.thick ?? 0.5) / 2;
      const l = ov.links[st.ty * TILES + st.tx]!;
      const links = [(l & 1) !== 0, (l & 2) !== 0, (l & 4) !== 0, (l & 8) !== 0];
      const any = (l & 15) !== 0;
      const ew = (l & 16) !== 0;
      const top = base + def.height;
      const lo = base - 2;
      // One box per axis, from the centre out to every linked side (a lone tile spans its own length).
      const west = links[0] || (!any && ew), east = links[1] || (!any && ew), north = links[2] || (!any && !ew), south = links[3] || (!any && !ew);
      if (west || east) box(west ? x0 : cx - h, cz - h, east ? x1 : cx + h, cz + h, lo, top);
      if (north || south) box(cx - h, north ? z0 : cz - h, cx + h, south ? z1 : cz + h, lo, top);
      return;
    }
    case 'tower': {
      const top = base + def.height;
      box(x0, z0, x1, z1, top - 0.3, top);
      const leg = 0.3;
      for (const [lx, lz] of [[x0, z0], [x1 - leg, z0], [x0, z1 - leg], [x1 - leg, z1 - leg]] as const) box(lx, lz, lx + leg, lz + leg, base - 2, top - 0.3);
      const [dx, dz] = towerLadderDir(st.rot);
      const lx = cx + dx * (TILE / 2 + 0.45), lz = cz + dz * (TILE / 2 + 0.45);
      ladders.push({ x0: lx - 0.45, z0: lz - 0.45, x1: lx + 0.45, z1: lz + 0.45, y0: heightAt(map, lx, lz), y1: top + 0.02, nx: -dx, nz: -dz });
      // The ladder itself is a narrow board: the climber leans on it (there is no wall behind a tower ladder).
      const bx = cx + dx * (TILE / 2 - 0.05), bz = cz + dz * (TILE / 2 - 0.05);
      box(bx - (dx ? 0.05 : 0.45), bz - (dz ? 0.05 : 0.45), bx + (dx ? 0.05 : 0.45), bz + (dz ? 0.05 : 0.45), base - 2, top - 0.3);
      return;
    }
    case 'building': {
      const inset = 0.3;
      box(x0 + inset, z0 + inset, x1 - inset, z1 - inset, base - 2, base + def.height);
      return;
    }
    default:
      return; // gates, moats, bridges, wire and fields have no boxes (see Overlay.zblock)
  }
}

/**
 * Replace the extra collision boxes and ladders of a generated map (everything after the ones it
 * was generated with) by what `fill` adds, unless (owner, rev) is what is already in place.
 * This is how the player, bullets and zombies meet built things through the ordinary collision
 * functions. `owner` null clears the extras.
 */
export function syncSolids(map: TacticalMap, owner: object | null, rev: number, fill: (solids: Solid[], ladders: Ladder[]) => void): void {
  let rec = synced.get(map);
  if (!rec) {
    if (owner === null) return;
    synced.set(map, (rec = { owner: null, rev: -1, baseSolids: map.solids.length, baseLadders: map.ladders.length }));
  }
  if (rec.owner === owner && rec.rev === rev) return;
  rec.owner = owner;
  rec.rev = rev;
  const hash = map.hash;
  for (const list of hash.solids) while (list.length > 0 && list[list.length - 1]! >= rec.baseSolids) list.pop();
  map.solids.length = rec.baseSolids;
  map.ladders.length = rec.baseLadders;
  if (owner === null) return;
  fill(map.solids, map.ladders);
  const cs = hash.cell;
  const clamp = (v: number): number => Math.min(hash.n - 1, Math.max(0, Math.floor(v / cs)));
  for (let i = rec.baseSolids; i < map.solids.length; i++) {
    const s = map.solids[i]!;
    for (let cz = clamp(s.z0); cz <= clamp(s.z1); cz++) for (let cx = clamp(s.x0); cx <= clamp(s.x1); cx++) hash.solids[cz * hash.n + cx]!.push(i);
  }
}

/** The home map gets the boxes and ladders of the standing structures. Cheap when nothing changed. */
export function syncMap(state: GameState, map: TacticalMap): void {
  syncSolids(map, state.build, state.build.gridRev, (solids, ladders) => {
    const ov = overlayOf(state, map.walk);
    for (const st of state.build.structures) if (isBuilt(st)) addSolids(state, ov, map, st, solids, ladders);
  });
}

/** Thickness of a gate's leaves (m): what zombies press against. */
export const GATE_THICK = 0.5;

/** Horizontal distance from (x, z) to the body of the structure standing on `tile` (0 inside). */
export function bodyDistance(ov: Overlay, st: Structure, tile: number, x: number, z: number): number {
  const def = defOf(st);
  const tx = tile % TILES, ty = (tile - tx) / TILES;
  const x0 = tx * TILE, z0 = ty * TILE, x1 = x0 + TILE, z1 = z0 + TILE;
  const boxDist = (ax: number, az: number, bx: number, bz: number): number => Math.hypot(Math.max(ax - x, 0, x - bx), Math.max(az - z, 0, z - bz));
  if (def.kind === 'wall' || def.kind === 'gate') {
    const l = ov.links[tile]!;
    const h = (def.kind === 'gate' ? GATE_THICK : (def.thick ?? 0.5)) / 2;
    const cx = x0 + TILE / 2, cz = z0 + TILE / 2;
    const any = (l & 15) !== 0;
    const ew = (l & 16) !== 0;
    let d = Infinity;
    const west = (l & 1) !== 0 || (!any && ew), east = (l & 2) !== 0 || (!any && ew), north = (l & 4) !== 0 || (!any && !ew), south = (l & 8) !== 0 || (!any && !ew);
    if (def.kind === 'gate') return ew ? boxDist(x0, cz - h, x1, cz + h) : boxDist(cx - h, z0, cx + h, z1);
    if (west || east) d = Math.min(d, boxDist(west ? x0 : cx - h, cz - h, east ? x1 : cx + h, cz + h));
    if (north || south) d = Math.min(d, boxDist(cx - h, north ? z0 : cz - h, cx + h, south ? z1 : cz + h));
    return d;
  }
  return boxDist(x0, z0, x1, z1);
}

// ---------------------------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------------------------

type Emit = (e: GameEvent) => void;

/** Recompute the stores' capacity from the standing buildings. */
export function refreshCapacity(state: GameState): void {
  const cap = { ...COLONY.economy.baseCapacity };
  for (const st of state.build.structures) {
    if (!isBuilt(st)) continue;
    const add = defOf(st).capacity;
    if (add) for (const res of Object.keys(add) as ResourceId[]) cap[res] += add[res] ?? 0;
  }
  if (hasTech(state, 'A2')) cap.food *= 1.5;
  state.colony.capacity = cap;
}

export function destroyStructure(state: GameState, emit: Emit, st: Structure): void {
  if (isRuin(st)) return;
  const def = defOf(st);
  st.hp = 0;
  st.wear = 0;
  st.ruinUntil = toAbsMinutes(state.time) + BUILD.rubbleMinutes;
  state.build.gridRev++;
  refreshCapacity(state);
  emit({ type: 'structureDestroyed', id: st.id, def: st.def });
  const c = ctxNow(state, null, emit);
  logEntry(c, 'defense', 'log.structureLost', { def: st.def });
  if (def.id === 'hq' && !state.flags.defeat) {
    state.flags.defeat = true;
    logEntry(c, 'death', 'log.hqLost', {});
    emit({ type: 'defeat', reason: 'hqDestroyed' });
  }
}

/** Take durability off a structure. Returns true when that destroyed it. */
export function damageStructure(state: GameState, emit: Emit, st: Structure, amount: number): boolean {
  if (!isBuilt(st) || defOf(st).hp <= 0 || amount <= 0) return false;
  st.hp -= amount;
  if (st.hp <= 0) {
    destroyStructure(state, emit, st);
    return true;
  }
  // Report in steps of a twentieth of the durability, not every frame.
  st.wear = (st.wear ?? 0) + amount;
  if (st.wear >= defOf(st).hp / 20) {
    st.wear = 0;
    emit({ type: 'structureDamaged', id: st.id, hp: st.hp });
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Effects on the colony (read by sim/colony)
// ---------------------------------------------------------------------------------------------

export function bedsTotal(state: GameState): number {
  let n = 0;
  for (const st of state.build.structures) if (isBuilt(st)) n += defOf(st).beds ?? 0;
  return n;
}

/** Farm plots weighted by their yield, and the share of that which ignores the season. */
export function plotInfo(state: GameState): { plots: number; allSeason: number } {
  let plots = 0;
  let green = 0;
  for (const st of state.build.structures) {
    if (!isBuilt(st)) continue;
    const def = defOf(st);
    const p = (def.plots ?? 0) * (def.yieldMul ?? 1);
    plots += p;
    if (def.allSeason) green += p;
  }
  return { plots, allSeason: plots > 0 ? green / plots : 0 };
}

/** Best facility factor for a job among the standing buildings, or null when there is none. */
export function jobFacility(state: GameState, job: JobId): number | null {
  let best: number | null = null;
  for (const st of state.build.structures) {
    if (!isBuilt(st)) continue;
    const f = defOf(st).job?.[job as 'crafting'];
    if (f !== undefined && (best === null || f > best)) best = f;
  }
  return best;
}

/** Morale per day from buildings (each kind counts once) and the share of food the canteen saves. */
export function moraleBonus(state: GameState): number {
  const seen = new Set<string>();
  let m = 0;
  for (const st of state.build.structures) {
    if (!isBuilt(st) || seen.has(st.def)) continue;
    seen.add(st.def);
    m += defOf(st).morale ?? 0;
  }
  return m;
}
export function foodSaving(state: GameState): number {
  let best = 0;
  for (const st of state.build.structures) if (isBuilt(st)) best = Math.max(best, defOf(st).foodSaving ?? 0);
  return best;
}
