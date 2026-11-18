// Where the player and the colony meet on the tactical map: people hiding at search points
// (E to talk -> candidates), searching a building, handing in ears at home, taking ammunition.

import { outpostAt, resupplyAtOutpost, resupplyFromCache } from '../world/outposts.ts';
import { randRange, stream } from '../../core/rng.ts';
import type { GameState, ResourceId, StaticGrid } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { COLONY, LOOT_TABLE } from '../../data/colony.ts';
import type { SimContext } from '../system.ts';
import { playerAtHome } from './morale.ts';
import { ctxNow, itemsParam, logEntry, moveEars, moveStock, type ColonyCtx } from './stock.ts';
import { addCandidates, hideoutGroup } from './survivors.ts';
import { mapOf } from '../tactical/area.ts';
import { isWalkable } from '../tactical/collision.ts';
import { GROUND } from '../../gen/index.ts';

const N = COLONY.encounter;

/**
 * The first contact of a new game (07b): one person is always hiding within COLONY.encounter.firstRing
 * of the home base — at a search point in that ring if there is one, otherwise camping in the open.
 * Their smoke (render/tactical/signals.ts) is what tells the player that somebody is out there.
 */
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
  const spots = t.lootSpots.filter((s) => !s.taken && inRing(s.pos[0], s.pos[1]));
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
  const free = t.lootSpots.filter((s) => !s.taken && !t.hideouts!.some((o) => o.spot === s.id));
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
  kind: 'talk' | 'search';
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
    if (dist <= N.reach && (!best || dist < best.dist)) best = hide >= 0 ? { kind: 'talk', spot: s.id, dist, hide } : { kind: 'search', spot: s.id, dist };
  }
  hideouts.forEach((h, hide) => {
    if (h.met || h.spot >= 0) return;
    const dist = Math.hypot(h.pos[0] - px, h.pos[1] - pz);
    if (dist <= N.reach && (!best || dist < best.dist)) best = { kind: 'talk', spot: -1, dist, hide };
  });
  return best;
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
  if (at.kind === 'talk') {
    const hide = t.hideouts![at.hide!]!;
    hide.met = true;
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
  const table = LOOT_TABLE[land];
  for (const res of Object.keys(table) as ResourceId[]) {
    const n = integerShare(COLONY.search.points * (table[res] ?? 0) * randRange(rng, COLONY.search.spread[0], COLONY.search.spread[1]), randRange(rng, 0, 1));
    if (n <= 0) continue;
    items[res] = n;
    state.player.inv[res] = (state.player.inv[res] ?? 0) + n;
  }
  cells.loot[t.cell] = Math.max(0, (cells.loot[t.cell] ?? 0) - 1 / BALANCE.world.lootSpots[land]);
  const text = itemsParam(items);
  logEntry(c, 'search', text ? 'log.searched' : 'log.searchedNothing', { items: text });
  c.emit({ type: 'spotSearched', spot: spot.id, items: text });
}

/** Every step: set up hideouts for a new area and react to E. */
export function updateEncounters(state: GameState, ctx: SimContext): void {
  if (!state.tactical || state.flags.range) return;
  ensureHideouts(state);
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
