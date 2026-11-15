// Where the player and the colony meet on the tactical map: people hiding at search points
// (E to talk -> candidates), searching a building, handing in ears at home, taking ammunition.

import { randRange, stream } from '../../core/rng.ts';
import type { GameState, ResourceId, StaticGrid } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { COLONY, LOOT_TABLE } from '../../data/colony.ts';
import type { SimContext } from '../system.ts';
import { playerAtHome } from './morale.ts';
import { ctxNow, itemsParam, logEntry, moveEars, moveStock, type ColonyCtx } from './stock.ts';
import { addCandidates, hideoutGroup } from './survivors.ts';

const N = COLONY.encounter;

/** Decide once per visit which search points of the area hide people (from the cell's H). */
export function ensureHideouts(state: GameState): void {
  const t = state.tactical;
  if (!t || t.hideouts || state.flags.range) return;
  t.hideouts = [];
  const key = String(t.cell);
  const last = state.colony.metCells[key];
  if (last !== undefined && state.time.day - last < N.cooldownDays) return;
  const h = Math.max(0, state.world.cells.H[t.cell] ?? 0);
  const want = Math.min(N.maxPerArea, Math.round(Math.log10(1 + h)), t.lootSpots.length);
  if (want <= 0) return;
  const rng = stream(state, 'colony.hideout');
  const free = t.lootSpots.filter((s) => !s.taken);
  for (let i = 0; i < want && free.length > 0; i++) {
    const spot = free.splice(Math.floor(randRange(rng, 0, free.length)), 1)[0]!;
    t.hideouts.push({ spot: spot.id, pos: [spot.pos[0], spot.pos[1]], met: false });
  }
  state.colony.metCells[key] = state.time.day;
}

export interface Interaction {
  kind: 'talk' | 'search';
  spot: number;
  dist: number;
}

/** What E would do where the player stands: talk to someone hiding, or search a building. */
export function interactionAt(state: GameState): Interaction | null {
  const t = state.tactical;
  if (!t) return null;
  const [px, , pz] = state.player.pos;
  let best: Interaction | null = null;
  for (const s of t.lootSpots) {
    const hide = t.hideouts?.find((h) => h.spot === s.id && !h.met);
    if (s.taken && !hide) continue;
    const dist = Math.hypot(s.pos[0] - px, s.pos[1] - pz);
    if (dist <= N.reach && (!best || dist < best.dist)) best = { kind: hide ? 'talk' : 'search', spot: s.id, dist };
  }
  return best;
}

/** Nearest person still hiding in this area: distance and bearing relative to the view (HUD hint). */
export function nearestHideout(state: GameState): { dist: number; turn: number } | null {
  const p = state.player;
  let best: { dist: number; turn: number } | null = null;
  for (const h of state.tactical?.hideouts ?? []) {
    if (h.met) continue;
    const dx = h.pos[0] - p.pos[0];
    const dz = h.pos[1] - p.pos[2];
    const dist = Math.hypot(dx, dz);
    if (dist <= N.senseDist && (!best || dist < best.dist)) best = { dist, turn: Math.atan2(-dx, -dz) - p.yaw };
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
  const spot = t.lootSpots.find((s) => s.id === at.spot)!;
  if (at.kind === 'talk') {
    const hide = t.hideouts!.find((h) => h.spot === at.spot)!;
    hide.met = true;
    const found = addCandidates(c, t.cell, hideoutGroup(state), 'player');
    if (found.length > 0) logEntry(c, 'people', 'log.met', { names: found.map((s) => s.name).join('、'), n: found.length });
    else logEntry(c, 'people', 'log.metNobody', {});
    return;
  }
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
  if (!playerAtHome(state)) return 'notHome';
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
