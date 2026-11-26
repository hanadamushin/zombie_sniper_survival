// Where the player and the colony meet on the tactical map: people hiding at search points
// (E to talk -> candidates), searching a building, handing in ears at home, taking ammunition.

import { outpostAt, resupplyAtOutpost, resupplyFromCache } from '../world/outposts.ts';
import { randRange, stream } from '../../core/rng.ts';
import type { GameState, ResourceId, StaticGrid } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { COLONY } from '../../data/colony.ts';
import { lootYield } from './loot.ts';
import type { SimContext } from '../system.ts';
import { playerAtHome } from './morale.ts';
import { ctxNow, itemsParam, logEntry, moveEars, moveStock, type ColonyCtx } from './stock.ts';
import { addCandidates, hideoutGroup } from './survivors.ts';
import { applyKeys, mapOf } from '../tactical/area.ts';
import { heightAt, isWalkable } from '../tactical/collision.ts';
import { GROUND, type TacticalMap } from '../../gen/index.ts';
import { clueInReach, dockInReach, eliteHideouts, eliteReachable, meetElite, openVault, readClue, stashInReach, takeBoat, takeFromStash } from '../world/stash.ts';

const N = COLONY.encounter;

/**
 * The first contact of a new game (07b): one person is always hiding within COLONY.encounter.firstRing
 * of the home base — at a search point in that ring if there is one, otherwise camping in the open.
 * Their smoke (render/tactical/signals.ts) is what tells the player that somebody is out there.
 */
/** 07d: people hide on the ground floor only (they are drawn and met at ground level). */
function onGround(map: TacticalMap, s: { id: number; pos: [number, number]; y?: number }): boolean {
  if (s.y === undefined) return true;
  // 09b: the ground storey of its building (on a slope the floor is more than a metre over the low side's ground).
  const bd = map.buildings[map.lootSpots[s.id]?.building ?? -1];
  return s.y - (bd ? bd.base : heightAt(map, s.pos[0], s.pos[1])) < 1;
}

function firstContact(state: GameState): void {
  const t = state.tactical!;
  const map = mapOf(state);
  if (!map || t.cell !== state.world.homeCell || state.flags.firstContact) return;
  state.flags.firstContact = true;
  // Only a colony that has nobody and knows nobody needs the help (old saves included).
  if (state.colony.survivors.length > 0 || state.colony.candidates.length > 0) return;
  const rng = stream(state, 'colony.hideout');
  const home = map.spawn.home;
  const inRing = (x: number, z: number): boolean => {
    const d = Math.hypot(x - home[0], z - home[1]);
    return d >= N.firstRing[0] && d <= N.firstRing[1];
  };
  const spots = t.lootSpots.filter((s) => !s.taken && inRing(s.pos[0], s.pos[1]) && onGround(map, s));
  if (spots.length > 0) {
    const spot = spots[Math.floor(randRange(rng, 0, spots.length))]!;
    t.hideouts!.push({ spot: spot.id, pos: [spot.pos[0], spot.pos[1]], met: false, sure: true });
    return;
  }
  for (let i = 0; i < 200; i++) {
    const a = randRange(rng, 0, Math.PI * 2);
    const d = randRange(rng, N.firstRing[0], N.firstRing[1]);
    const x = home[0] + Math.cos(a) * d;
    const z = home[1] + Math.sin(a) * d;
    const tx = Math.floor(x / map.tile);
    const ty = Math.floor(z / map.tile);
    if (x < 12 || z < 12 || x > map.size - 12 || z > map.size - 12 || !isWalkable(map, tx, ty)) continue;
    const g = map.ground[ty * map.tiles + tx];
    if (g === GROUND.road || g === GROUND.track || g === GROUND.field) continue;
    t.hideouts!.push({ spot: -1, pos: [x, z], met: false, sure: true });
    return;
  }
}

/** Decide once per visit which search points of the area hide people (from the cell's H). */
export function ensureHideouts(state: GameState): void {
  const t = state.tactical;
  if (!t || t.hideouts || state.flags.range) return;
  t.hideouts = [];
  firstContact(state);
  const key = String(t.cell);
  const last = state.colony.metCells[key];
  if (last !== undefined && state.time.day - last < N.cooldownDays) return;
  const h = Math.max(0, state.world.cells.H[t.cell] ?? 0);
  const map = mapOf(state);
  const free = t.lootSpots.filter((s) => !s.taken && !t.hideouts!.some((o) => o.spot === s.id) && (!map || onGround(map, s)));
  const want = Math.min(N.maxPerArea - t.hideouts.length, Math.round(Math.log10(1 + h)), free.length);
  if (want <= 0) return;
  const rng = stream(state, 'colony.hideout');
  for (let i = 0; i < want && free.length > 0; i++) {
    const spot = free.splice(Math.floor(randRange(rng, 0, free.length)), 1)[0]!;
    t.hideouts.push({ spot: spot.id, pos: [spot.pos[0], spot.pos[1]], met: false });
  }
  state.colony.metCells[key] = state.time.day;
}

export interface Interaction {
  /** O1: `read` a clue at a landmark, `boat` across to Hashima and back. */
  kind: 'talk' | 'search' | 'read' | 'boat';
  /** Search point id; -1 when talking to someone camping in the open. */
  spot: number;
  dist: number;
  /** Index into tactical.hideouts for 'talk'. */
  hide?: number;
}

/** What E would do where the player stands: talk to someone hiding, or search a building. */
export function interactionAt(state: GameState): Interaction | null {
  const t = state.tactical;
  if (!t) return null;
  const [px, , pz] = state.player.pos;
  let best: Interaction | null = null;
  const hideouts = t.hideouts ?? [];
  for (const s of t.lootSpots) {
    const hide = hideouts.findIndex((h) => h.spot === s.id && !h.met);
    if (s.taken && hide < 0) continue;
    const dist = Math.hypot(s.pos[0] - px, s.pos[1] - pz);
    // 07d: inside a building only the shelves of the floor the player is on.
    if (s.y !== undefined && Math.abs(s.y - state.player.pos[1]) > 1.4) continue;
    if (dist <= N.reach && (!best || dist < best.dist)) best = hide >= 0 ? { kind: 'talk', spot: s.id, dist, hide } : { kind: 'search', spot: s.id, dist };
  }
  let elitesOpen: boolean | null = null;
  hideouts.forEach((h, hide) => {
    if (h.met || h.spot >= 0) return;
    // O1: the elites hide behind the locked doors until the safe's key has opened them.
    if (h.elite !== undefined && !(elitesOpen ??= eliteReachable(state))) return;
    if (h.y !== undefined && Math.abs(h.y - state.player.pos[1]) > 1.6) return;
    const dist = Math.hypot(h.pos[0] - px, h.pos[1] - pz);
    // An elite within reach is talked to before the shelves of their room are searched.
    if (dist <= N.reach && (!best || dist < best.dist || (h.elite !== undefined && best.kind === 'search'))) best = { kind: 'talk', spot: -1, dist, hide };
  });
  // O1: a clue board, or the boat at a landing, when nothing nearer.
  const found = best as Interaction | null;
  if (!found) {
    const clue = clueInReach(state);
    if (clue) return { kind: 'read', spot: -1, dist: Math.hypot(clue.pos[0] - px, clue.pos[2] - pz) };
    if (dockInReach(state)) return { kind: 'boat', spot: -1, dist: 0 };
  }
  return found;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/**
 * Nearest person still hiding in this area (HUD hint): distance, bearing relative to the view
 * (`turn`, for the arrow) and the compass direction they are in (07b).
 */
export function nearestHideout(state: GameState): { dist: number; turn: number; dir: (typeof COMPASS)[number] } | null {
  const p = state.player;
  let best: { dist: number; turn: number; dir: (typeof COMPASS)[number] } | null = null;
  for (const h of state.tactical?.hideouts ?? []) {
    if (h.met) continue;
    const dx = h.pos[0] - p.pos[0];
    const dz = h.pos[1] - p.pos[2];
    const dist = Math.hypot(dx, dz);
    if (dist > N.senseDist || (best && dist >= best.dist)) continue;
    // Bearing: 0 = north (-z), clockwise; eight sectors.
    const bearing = (Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2);
    best = { dist, turn: Math.atan2(-dx, -dz) - p.yaw, dir: COMPASS[Math.round(bearing / (Math.PI / 4)) % 8]! };
  }
  return best;
}

function integerShare(amount: number, roll: number): number {
  return Math.floor(amount) + (roll < amount - Math.floor(amount) ? 1 : 0);
}

function interact(c: ColonyCtx, grid: StaticGrid | null): void {
  const { state } = c;
  const t = state.tactical;
  const at = interactionAt(state);
  if (!t || !at) return;
  if (at.kind === 'read') {
    const clue = clueInReach(state);
    if (clue) readClue(c, clue);
    return;
  }
  if (at.kind === 'boat') {
    const why = takeBoat(c);
    if (why) c.emit({ type: 'commandRejected', command: 'interact', reason: why });
    return;
  }
  if (at.kind === 'talk') {
    const hide = t.hideouts![at.hide!]!;
    hide.met = true;
    if (hide.elite !== undefined) {
      meetElite(c, hide.elite);
      return;
    }
    // The first contact is there whatever the cell's numbers say.
    const H = state.world.cells.H;
    if (hide.sure && (H[t.cell] ?? 0) < 1) H[t.cell] = 1;
    const found = addCandidates(c, t.cell, hideoutGroup(state), 'player');
    if (found.length > 0) logEntry(c, 'people', 'log.met', { names: found.map((s) => s.name).join('、'), n: found.length });
    else logEntry(c, 'people', 'log.metNobody', {});
    return;
  }
  const spot = t.lootSpots.find((s) => s.id === at.spot)!;
  // Search the building: a handful of things into the pack, and the cell is that much poorer.
  spot.taken = true;
  const land = grid?.cells[t.cell]?.land ?? 'rural';
  const rng = stream(state, 'colony.search');
  const cells = state.world.cells;
  const items: Partial<Record<ResourceId, number>> = {};
  // 07d: a shelf inside a building yields what its room holds.
  for (const [res, expected] of lootYield(spot.table ? { table: spot.table, land } : land, COLONY.search.points)) {
    const n = integerShare(expected * randRange(rng, COLONY.search.spread[0], COLONY.search.spread[1]), randRange(rng, 0, 1));
    if (n <= 0) continue;
    items[res] = n;
    state.player.inv[res] = (state.player.inv[res] ?? 0) + n;
  }
  cells.loot[t.cell] = Math.max(0, (cells.loot[t.cell] ?? 0) - 1 / BALANCE.world.lootSpots[land]);
  const text = itemsParam(items);
  logEntry(c, 'search', text ? 'log.searched' : 'log.searchedNothing', { items: text });
  c.emit({ type: 'spotSearched', spot: spot.id, items: text });
  if (spot.key) {
    // 07d-2f: the commander's safe held the key: the armories and depots of this base open.
    const map = mapOf(state);
    if (map) applyKeys(state, map);
    logEntry(c, 'search', 'log.keyFound', {});
    openVault(c, spot); // O1: the hidden stash's safe also holds its ears
  }
}

/** Every step: set up hideouts for a new area and react to E. */
export function updateEncounters(state: GameState, ctx: SimContext): void {
  if (!state.tactical || state.flags.range) return;
  ensureHideouts(state);
  eliteHideouts(state);
  if (ctx.input.interact && state.mode === 'tactical' && state.player.aim.deadT <= 0) interact(ctxNow(state, ctx.grid, ctx.emit), ctx.grid);
}

/** Back at the base: everything carried except ammunition goes into the stores (ears are income). */
export function depositCarried(c: ColonyCtx): void {
  const { state } = c;
  if (!playerAtHome(state) || state.player.aim.deadT > 0) return;
  const inv = state.player.inv;
  const ears = inv.ears ?? 0;
  if (ears > 0) {
    inv.ears = 0;
    moveEars(c, 'income', ears);
    c.emit({ type: 'earsDeposited', amount: ears });
  }
  const items: Partial<Record<ResourceId, number>> = {};
  for (const res of Object.keys(inv) as ResourceId[]) {
    if (res === 'ears' || res === 'ammo') continue;
    const n = inv[res] ?? 0;
    if (n > 0) {
      moveStock(c, res, n);
      items[res] = n;
    }
    delete inv[res];
  }
  if (ears > 0 || Object.keys(items).length > 0) logEntry(c, 'economy', 'log.deposited', { ears, items: itemsParam(items) });
}

/** Handle `resupply`: stock ammunition -> the player, up to the carry limit. Home cell only (outposts: 06). */
export function resupply(c: ColonyCtx): string | null {
  const { state } = c;
  if (!playerAtHome(state)) {
    // 06: outposts hold their own ammunition; 07c: elsewhere, a cache within reach.
    if (outpostAt(state, state.player.cell)) return resupplyAtOutpost(c);
    // O1: a hidden stash's supply point, when the player stands at it.
    if (stashInReach(state)) return takeFromStash(c);
    return resupplyFromCache(c, mapOf(state));
  }
  const inv = state.player.inv;
  const room = BALANCE.player.maxAmmo - (inv.ammo ?? 0);
  if (room <= 0) return 'full';
  const got = Math.floor(Math.min(room, state.colony.stock.ammo));
  if (got <= 0) return 'noAmmo';
  moveStock(c, 'ammo', -got);
  inv.ammo = (inv.ammo ?? 0) + got;
  c.emit({ type: 'resupplied', ammo: got });
  return null;
}
