// Epidemiological survey (S7a): where the dead will be in a week. Runs the real infection step on a
// copy of the world cells with a forked random series, so the game's own `world.infection` series
// and cells are untouched. About 1 ms per simulated day; cached per game day.

import { fork } from '../../core/rng.ts';
import type { GameState, StaticGrid } from '../../core/types.ts';
import { RESEARCH } from '../../data/techs.ts';
import { stepInfection } from '../world/infection.ts';
import { settlementAttraction } from '../world/index.ts';

export interface Forecast {
  /** Day the forecast was made on, and the day it describes. */
  day: number;
  forDay: number;
  /** Zombies per cell on `forDay` (same indexing as world.cells.Z). */
  Z: number[];
}

const cache = new WeakMap<GameState, Forecast>();

export function forecastInfection(state: GameState, grid: StaticGrid, days: number = RESEARCH.forecastDays): Forecast {
  const hit = cache.get(state);
  if (hit && hit.day === state.time.day && hit.forDay === state.time.day + days) return hit;
  const src = state.world.cells;
  const cells = { S: [...src.S], Z: [...src.Z], H: [...src.H], loot: [...src.loot] };
  // A series of its own, derived from the game's without advancing it.
  const rng = fork(state.rngStreams['world.infection'] ?? state.rng, `forecast.${state.time.day}`);
  const extras = settlementAttraction(state);
  for (let d = 1; d <= days; d++) stepInfection(cells, grid, state.time.day + d, extras, rng);
  const out: Forecast = { day: state.time.day, forDay: state.time.day + days, Z: cells.Z };
  cache.set(state, out);
  return out;
}
