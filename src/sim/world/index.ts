// World layer: infection, travel, (later) supply, outposts, expeditions. Owner: 02, later 05/06.
//   step():   kills reported by the tactical layer reduce the cell's Z
//   minute(): journey progress
//   day():    one infection step; zombie inflow into the home cell accumulates in hordeMeter
// Pure helpers for other systems live next to this file: derive.ts (cell -> tactical parameters),
// travel.ts (routes), start.ts (start candidates), scenario.ts (bundled data), grid.ts (static map).
import { rand, stream } from '../../core/rng.ts';
import type { GameState, StaticGrid } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import type { System } from '../system.ts';
import { dangerOf, removeZombies } from './derive.ts';
import { stepInfection, type InfectionExtras } from './infection.ts';
import { ctxNow } from '../colony/stock.ts';
import { assignGarrison, foundOutpost, isStation, outpostsDay, upgradeOutpost } from './outposts.ts';
import { advanceTravel, findRoute } from './travel.ts';

/** Prey weight added by the player's settlements (spec §2.2: population x 2 counts as H). */
export function settlementAttraction(state: GameState): InfectionExtras {
  const P = BALANCE.infection;
  const perColonist = P.colonistAsH * P.wH;
  const attraction: { cell: number; weight: number }[] = [];
  const home = state.world.homeCell;
  if (home !== null) {
    const atHome = state.colony.survivors.filter((s) => s.status !== 'dead' && s.location.kind === 'home').length;
    attraction.push({ cell: home, weight: (atHome + 1) * perColonist }); // +1: the player
  }
  for (const outpost of state.world.outposts) attraction.push({ cell: outpost.cell, weight: outpost.garrison.length * perColonist });
  // Watched cells: the home base first, then every outpost in order (their inflow is the day's attack on them).
  return { attraction, watch: home !== null ? [home, ...state.world.outposts.map((o) => o.cell)] : [] };
}

function worldReady(state: GameState, grid: StaticGrid | null): grid is StaticGrid {
  return grid !== null && state.world.gridW === grid.gridW && state.world.cells.Z.length === grid.gridW * grid.gridH;
}

export const worldSystem: System = {
  id: 'world',
  commands: {
    travel(state, cmd, ctx) {
      const reject = (reason: string): void => ctx.emit({ type: 'commandRejected', command: 'travel', reason });
      if (!worldReady(state, ctx.grid)) return reject('noMap');
      if (state.world.travel) return reject('alreadyTravelling');
      // Fast travel (06): only between the base and outposts.
      const fast = cmd.fast === true;
      if (fast && !(isStation(state, state.player.cell) && isStation(state, cmd.to))) return reject('notStation');
      const route = findRoute(ctx.grid, state.player.cell, cmd.to, fast);
      if (!route || route.path.length < 2) return reject('noRoute');
      state.world.travel = { from: state.player.cell, to: cmd.to, path: route.path, progress: 0 };
      if (fast) state.world.travel.fast = true;
      ctx.emit({ type: 'travelStarted', from: state.player.cell, to: cmd.to, minutes: route.minutes });
    },
    foundOutpost(state, cmd, ctx) {
      const reason = foundOutpost(ctxNow(state, ctx.grid, ctx.emit), cmd.cell);
      if (reason) ctx.emit({ type: 'commandRejected', command: cmd.type, reason });
    },
    upgradeOutpost(state, cmd, ctx) {
      const reason = upgradeOutpost(ctxNow(state, ctx.grid, ctx.emit), cmd.id);
      if (reason) ctx.emit({ type: 'commandRejected', command: cmd.type, reason });
    },
    assignGarrison(state, cmd, ctx) {
      const reason = assignGarrison(ctxNow(state, ctx.grid, ctx.emit), cmd.survivor, cmd.outpost);
      if (reason) ctx.emit({ type: 'commandRejected', command: cmd.type, reason });
    },
  },

  step(state, ctx) {
    for (const e of ctx.prevEvents) if (e.type === 'zombieKilled') removeZombies(state, state.player.cell, 1);
  },

  minute(state, ctx) {
    if (!state.world.travel || !worldReady(state, ctx.grid)) return;
    let from = state.player.cell;
    const { entered, arrived } = advanceTravel(state, ctx.grid);
    for (const cell of entered) {
      ctx.emit({ type: 'cellEntered', cell, from });
      from = cell;
      // Encounter hook: rolled here so the random stream is already in place; resolution comes later.
      const danger = dangerOf(state.world.cells.Z[cell] ?? 0);
      if (rand(stream(state, 'world.encounter')) < danger * BALANCE.world.travel.encounterScale) ctx.emit({ type: 'travelEncounter', cell, danger });
    }
    if (arrived) ctx.emit({ type: 'travelArrived', cell: state.player.cell });
  },

  day(state, ctx) {
    if (!worldReady(state, ctx.grid)) return;
    const stats = stepInfection(state.world.cells, ctx.grid, state.time.day, settlementAttraction(state), stream(state, 'world.infection'));
    const inflow = stats.inflow[0] ?? 0;
    state.world.hordeMeter += inflow;
    ctx.emit({ type: 'infectionStepped', day: state.time.day, homeInflow: inflow });
    outpostsDay(ctxNow(state, ctx.grid, ctx.emit), stats.inflow.slice(1));
  },
};
