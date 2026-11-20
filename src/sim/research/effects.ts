// Technology and building effects that are something happening once a day rather than a number:
// surveys and scouts, what outposts send home, the radio, the tavern, the market, the school,
// autonomous outposts, the vaccine. Each is a few lines and reads its figures from RESEARCH
// (data/techs.ts). Simplified on purpose — see the list in docs/PROGRESS.md (07).

import { RESEARCH } from '../../data/techs.ts';
import type { CellId, GameState, StaticGrid } from '../../core/types.ts';
import { isBuilt } from '../build/structures.ts';
import { foodNeedPerDay, villageNear } from '../colony/economy.ts';
import { logEntry, moveEars, moveStock, type ColonyCtx } from '../colony/stock.ts';
import { addCandidates, isHome, populationCap } from '../colony/survivors.ts';
import { removeZombies } from '../world/derive.ts';
import { cellsWithin } from '../world/grid.ts';
import { outpostDefense } from '../world/outposts.ts';
import { hasFlag } from './modifiers.ts';

const stands = (state: GameState, def: string): boolean => state.build.structures.some((s) => s.def === def && isBuilt(s));

function mark(state: GameState, grid: StaticGrid, centre: CellId, radius: number, level: number): void {
  const intel = state.world.cells.intel;
  for (const id of cellsWithin(grid, centre, radius)) if ((intel[id] ?? 0) < level) intel[id] = level;
}

/** Cells the colony holds: the home cell and every outpost. */
export function heldCells(state: GameState): CellId[] {
  const home = state.world.homeCell;
  return home === null ? [] : [home, ...state.world.outposts.map((o) => o.cell)];
}

/** What the colony knows about the map without going there. */
export function updateIntel(state: GameState, grid: StaticGrid): void {
  const home = state.world.homeCell;
  if (home === null) return;
  // Observation records (S2): rough numbers around the base. Scouts (C6b): everything, far out, around every post.
  if (hasFlag(state, 'intel.zombies')) mark(state, grid, home, RESEARCH.surveyRadius, 1);
  if (hasFlag(state, 'intel.scout')) for (const cell of heldCells(state)) mark(state, grid, cell, RESEARCH.scoutRadius, 2);
  // Outposts watch their surroundings (spec §8): tier 2 one cell around, tier 3 two.
  for (const o of state.world.outposts) if (o.tier >= 2 && o.garrison.length > 0) mark(state, grid, o.cell, o.tier - 1, 2);
}

export function dailyEffects(c: ColonyCtx): void {
  const { state, grid } = c;
  const world = state.world;
  const home = world.homeCell;
  if (home === null) return;
  if (grid) updateIntel(state, grid);

  // --- outposts ---
  let food = 0;
  let ears = 0;
  const manned = world.outposts.filter((o) => o.garrison.length > 0);
  for (const o of manned) {
    if (o.tier >= 3) {
      // A branch has its own fields and a trading post.
      food += RESEARCH.outpostFood;
      ears += RESEARCH.outpostEars;
    }
    if (hasFlag(state, 'garrison.fed')) food += RESEARCH.garrisonFood * o.garrison.length; // field rations (A6a)
    if (hasFlag(state, 'outpost.autonomy')) {
      // Local self-government (C8): they pay tax and grow on their own.
      ears += RESEARCH.taxPerTier * o.tier;
      const age = state.time.day - (o.foundedDay ?? state.time.day);
      if (o.tier < 3 && age > 0 && age % RESEARCH.autonomyDays === 0) {
        o.tier = (o.tier + 1) as 2 | 3;
        o.defense = outpostDefense(state, o);
        logEntry(c, 'outpost', 'log.outpostGrew', { cell: o.cell, tier: o.tier });
        c.emit({ type: 'outpostUpgraded', id: o.id, tier: o.tier });
      }
    }
  }
  if (food > 0) moveStock(c, 'food', food);

  // --- trade (C4a): a market sells to the villages and along the outpost network ---
  if (hasFlag(state, 'trade') && stands(state, 'market')) {
    const partners = manned.length + (villageNear(state, grid) ? 1 : 0);
    ears += partners * RESEARCH.tradeEars;
  }

  // --- brewing (A6b): the tavern turns part of the food into something that sells ---
  if (hasFlag(state, 'brewery') && stands(state, 'tavern')) {
    const used = moveStock(c, 'food', -Math.min(state.colony.stock.food, foodNeedPerDay(state) * RESEARCH.brewShare));
    ears += used * RESEARCH.brewEars;
  }
  // 07e: the amounts are fractions of an ear; whole ears are paid in and the rest carries to the next day.
  const total = ears + Number(state.flags.incomeCarry ?? 0);
  ears = Math.floor(total + 1e-9);
  state.flags.incomeCarry = Math.round((total - ears) * 1000) / 1000;
  if (ears > 0) {
    moveEars(c, 'income', ears);
    logEntry(c, 'economy', 'log.dailyIncome', { ears });
  }

  // --- radio broadcasts (C6a): someone out there hears it and walks in ---
  if (grid && hasFlag(state, 'radio') && stands(state, 'radio') && state.colony.survivors.length + state.colony.candidates.length < populationCap(state)) {
    let best: CellId | null = null;
    for (const id of cellsWithin(grid, home, RESEARCH.radioRadius)) {
      const h = world.cells.H[id] ?? 0;
      if (h >= 1 && (best === null || h > (world.cells.H[best] ?? 0))) best = id;
    }
    if (best !== null) {
      const found = addCandidates(c, best, 1, 'radio');
      if (found.length > 0) logEntry(c, 'people', 'log.radioVisitor', { name: found[0]!.name, cell: best });
    }
  }

  // --- school (S8): lessons pay off slowly ---
  if (hasFlag(state, 'education') && stands(state, 'school') && state.time.day % RESEARCH.schoolDays === 0) {
    let n = 0;
    for (const s of state.colony.survivors) {
      if (!isHome(s) || s.kno >= RESEARCH.schoolMax) continue;
      s.kno += 1;
      n++;
    }
    if (n > 0) logEntry(c, 'research', 'log.schoolTerm', { n });
  }

  // --- vaccine (S9): the dead around the colony's people thin out ---
  if (hasFlag(state, 'vaccine')) {
    for (const cell of heldCells(state)) removeZombies(state, cell, Math.ceil(Math.max(0, world.cells.Z[cell] ?? 0) * RESEARCH.vaccineClear));
  }
}
