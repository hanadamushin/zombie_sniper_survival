// Victory (spec §13): the founding of a nation. In the revival era, with enough people, enough
// outposts spread over enough regions and one of the three goal technologies, the colony builds
// the capitol — and that is the declaration. The goal technology decides the ending. The game goes
// on afterwards.

import type { GameState, StaticGrid } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { GOAL_TECHS, RESEARCH } from '../../data/techs.ts';
import { isBuilt, isUnlocked } from '../build/structures.ts';
import { ctxNow, logEntry } from '../colony/stock.ts';
import type { SimContext } from '../system.ts';

const V = RESEARCH.victory;

export interface VictoryProgress {
  era: number;
  population: number;
  outposts: number;
  /** Regions (grid.regionNames) the home cell and the outposts lie in. */
  regions: number;
  /** The goal technology that will name the ending: the first one researched. */
  goal: string | null;
  capitol: boolean;
  /** Each requirement on its own. */
  met: { era: boolean; population: boolean; outposts: boolean; regions: boolean; goal: boolean; capitol: boolean };
  /** Everything but the capitol itself. */
  ready: boolean;
  /** The capitol can be placed. */
  canBuild: boolean;
}

export function victoryProgress(state: GameState, grid: StaticGrid | null): VictoryProgress {
  const world = state.world;
  const regions = new Set<number>();
  if (grid) {
    const add = (cell: number | null): void => {
      const region = cell === null ? undefined : grid.cells[cell]?.region;
      if (region !== undefined) regions.add(region);
    };
    add(world.homeCell);
    for (const o of world.outposts) add(o.cell);
  }
  const goal = state.research.done.find((id) => GOAL_TECHS.includes(id)) ?? null;
  const p = {
    era: state.research.era,
    population: state.colony.survivors.length,
    outposts: world.outposts.length,
    regions: regions.size,
    goal,
    capitol: state.build.structures.some((s) => s.def === 'capitol' && isBuilt(s)),
  };
  const met = {
    era: p.era >= V.era,
    population: p.population >= V.population,
    outposts: p.outposts >= V.outposts,
    regions: p.regions >= V.regions,
    goal: goal !== null,
    capitol: p.capitol,
  };
  const ready = met.era && met.population && met.outposts && met.regions && met.goal;
  return { ...p, met, ready, canBuild: isUnlocked('capitol', state) };
}

export interface EndingStats {
  /** Days since the game began, and since the outbreak. */
  days: number;
  day: number;
  kills: number;
  headshotRate: number;
  shots: number;
  survivors: number;
  lost: number;
  outposts: number;
  techs: number;
}

/** The figures shown on the ending and the defeat screen. */
export function endingStats(state: GameState): EndingStats {
  const s = state.player.stats;
  return {
    days: state.time.day - BALANCE.time.startDay,
    day: state.time.day,
    kills: s.kills,
    headshotRate: s.kills > 0 ? s.headshots / s.kills : 0,
    shots: s.shots,
    survivors: state.colony.survivors.length,
    lost: Number(state.flags.lostTotal ?? state.colony.memorial.length),
    outposts: state.world.outposts.length,
    techs: state.research.done.length,
  };
}

/** Called every game hour: declare the nation the moment everything is in place. */
export function checkVictory(state: GameState, ctx: Pick<SimContext, 'grid' | 'emit'>): boolean {
  if (state.research.victory || state.flags.defeat) return false;
  const p = victoryProgress(state, ctx.grid);
  if (!p.ready || !p.capitol || p.goal === null) return false;
  state.research.victory = { day: state.time.day, minute: state.time.minute, tech: p.goal };
  logEntry(ctxNow(state, ctx.grid, ctx.emit), 'research', 'log.victory', { tech: p.goal });
  ctx.emit({ type: 'victory', tech: p.goal });
  return true;
}
