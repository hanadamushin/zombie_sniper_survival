// The colony's books: every change of the stock goes through here so that the ledger always
// explains the stores (tests/colony.test.ts checks 30 days of it), plus the log.

import type { GameEvent } from '../../core/events.ts';
import type { GameState, LedgerDay, ResourceId, StaticGrid } from '../../core/types.ts';
import { COLONY } from '../../data/colony.ts';

const E = COLONY.economy;

/**
 * What colony code needs while it simulates one game minute. `day` / `minute` are the minute being
 * simulated, which lags state.time while the colony catches up (large steps, the three days after
 * the player's death).
 */
export interface ColonyCtx {
  state: GameState;
  grid: StaticGrid | null;
  emit(event: GameEvent): void;
  day: number;
  minute: number;
}

export type EarColumn = 'income' | 'wages' | 'food' | 'other';

export function ledgerOf(state: GameState, day: number): LedgerDay {
  const ledger = state.colony.ledger;
  const last = ledger[ledger.length - 1];
  if (last && last.day === day) return last;
  const entry: LedgerDay = { day, income: 0, wages: 0, food: 0, other: 0, flow: {} };
  ledger.push(entry);
  while (ledger.length > E.ledgerDays) ledger.shift();
  return entry;
}

/** Ears coming in (`income`) or going out (any other column). Returns the amount actually moved. */
export function moveEars(c: ColonyCtx, column: EarColumn, amount: number): number {
  const stock = c.state.colony.stock;
  if (!(amount > 0)) return 0;
  const moved = column === 'income' ? amount : Math.min(amount, stock.ears);
  stock.ears += column === 'income' ? moved : -moved;
  ledgerOf(c.state, c.day)[column] += moved;
  return moved;
}

/**
 * Add (amount > 0) or take (amount < 0) a resource other than ears. What does not fit is lost
 * (and booked as going out); taking stops at zero. Returns the amount that actually went in / out.
 */
export function moveStock(c: ColonyCtx, res: Exclude<ResourceId, 'ears'>, amount: number): number {
  const colony = c.state.colony;
  if (amount === 0 || !Number.isFinite(amount)) return 0;
  const day = ledgerOf(c.state, c.day);
  const flow = ((day.flow ??= {})[res] ??= [0, 0]);
  if (amount > 0) {
    const room = Math.max(0, colony.capacity[res] - colony.stock[res]);
    const kept = Math.min(amount, room);
    colony.stock[res] += kept;
    flow[0] += amount;
    flow[1] += amount - kept;
    return kept;
  }
  const taken = Math.min(-amount, colony.stock[res]);
  colony.stock[res] -= taken;
  flow[1] += taken;
  return taken;
}

export function logEntry(c: ColonyCtx, kind: string, text: string, params?: Record<string, string | number>): void {
  const log = c.state.colony.log;
  log.push(params ? { day: c.day, minute: c.minute, kind, text, params } : { day: c.day, minute: c.minute, kind, text });
  while (log.length > E.logMax) log.shift();
  c.emit({ type: 'colonyLog', kind, text });
}

/** "food:3|metal:1.5" — the form the UI turns into a list of resources. */
export function itemsParam(items: Partial<Record<ResourceId, number>>): string {
  return Object.entries(items)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([id, n]) => `${id}:${Math.round((n ?? 0) * 10) / 10}`)
    .join('|');
}

/** Context for code that runs outside the minute loop (commands, per-step interactions). */
export function ctxNow(state: GameState, grid: StaticGrid | null, emit: (e: GameEvent) => void): ColonyCtx {
  return { state, grid, emit, day: state.time.day, minute: state.time.minute };
}
