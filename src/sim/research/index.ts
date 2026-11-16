// Research (spec §9, docs/03_tech_tree.md). Owner: 07.
//
//   hour()  the research output of the colony (colony/jobs.ts takeResearchPoints) flows into the
//           node in progress of each category by the allocation; a category with nothing in
//           progress passes its share to the others. Finished nodes take effect at once.
//           Then the victory check (victory.ts).
//   day()   technologies and buildings whose effect is something that happens once a day (effects.ts)
//
// What a node does is data (data/techs.ts) read through modifiers.ts; this file only moves points
// and keeps ResearchState: era, done, locked (exclusive branches), active, allocation, progress.

import type { GameEvent } from '../../core/events.ts';
import { TECH_CATEGORIES, type GameState, type TechCategory } from '../../core/types.ts';
import { COLONY } from '../../data/colony.ts';
import { locksOf, RESEARCH, TECH_LIST, TECHS, type TechDef } from '../../data/techs.ts';
import { refreshCapacity } from '../build/structures.ts';
import { facilityFactor, jobMul, outputPerHour, takeResearchPoints, workHours } from '../colony/jobs.ts';
import { changeMorale } from '../colony/morale.ts';
import { ctxNow, logEntry } from '../colony/stock.ts';
import { isFit } from '../colony/survivors.ts';
import type { System } from '../system.ts';
import { dailyEffects } from './effects.ts';
import { invalidateMods } from './modifiers.ts';
import { checkVictory } from './victory.ts';

type Emit = (e: GameEvent) => void;

export type TechStatus = 'done' | 'active' | 'available' | 'unavailable' | 'locked';

/** Nodes of an era the colony has, all categories together. */
export function eraCount(state: GameState, era: number): number {
  let n = 0;
  for (const id of state.research.done) if (TECHS[id]?.era === era) n++;
  return n;
}

function prereqsMet(state: GameState, t: TechDef): boolean {
  const done = state.research.done;
  return t.req.every((r) => done.includes(r)) && (t.any === undefined || t.any.some((r) => done.includes(r)));
}

/** Why a node cannot be started right now, or null when it can. */
export function startError(state: GameState, id: string): string | null {
  const t = TECHS[id];
  const r = state.research;
  if (!t) return 'unknownTech';
  if (r.done.includes(id)) return 'techDone';
  if (r.locked.includes(id)) return 'techLocked';
  if (t.era > r.era) return 'techEra';
  if (!prereqsMet(state, t)) return 'techPrereq';
  return null;
}

export function techStatus(state: GameState, id: string): TechStatus {
  const r = state.research;
  if (r.done.includes(id)) return 'done';
  if (r.locked.includes(id)) return 'locked';
  const t = TECHS[id];
  if (t && r.active[t.cat]?.id === id) return 'active';
  return startError(state, id) === null ? 'available' : 'unavailable';
}

/** Points already put into a node (in progress or shelved). */
export function techProgress(state: GameState, id: string): number {
  const t = TECHS[id];
  const r = state.research;
  if (t && r.active[t.cat]?.id === id) return r.active[t.cat]!.rp;
  return r.progress?.[id] ?? 0;
}

/** Handle `startResearch`: put a node in progress in its category. Work on the node it replaces is kept. */
export function startResearch(state: GameState, id: string): string | null {
  const error = startError(state, id);
  if (error) return error;
  const t = TECHS[id]!;
  const r = state.research;
  const current = r.active[t.cat];
  if (current?.id === id) return null;
  const shelf = (r.progress ??= {});
  if (current && current.rp > 0) shelf[current.id] = current.rp;
  r.active[t.cat] = { id, rp: shelf[id] ?? 0 };
  delete shelf[id];
  return null;
}

/** Handle `setAllocation`: shares per category, normalised to a total of 100. */
export function setAllocation(state: GameState, allocation: Record<TechCategory, number>): string | null {
  const clean = {} as Record<TechCategory, number>;
  let total = 0;
  for (const cat of TECH_CATEGORIES) {
    const v = Number(allocation[cat]);
    if (!Number.isFinite(v) || v < 0) return 'badAllocation';
    clean[cat] = v;
    total += v;
  }
  if (total <= 0) return 'badAllocation';
  for (const cat of TECH_CATEGORIES) clean[cat] = (clean[cat] * 100) / total;
  state.research.allocation = clean;
  return null;
}

/**
 * A node is acquired: its effects apply from now on, the other side of an exclusive branch and
 * everything behind it is locked for good, and the next era opens once enough nodes of the current
 * one are in. Also the entry point for debug tools and tests that grant a node.
 */
export function completeTech(state: GameState, id: string, emit: Emit, grid: Parameters<typeof ctxNow>[1] = null): void {
  const t = TECHS[id];
  const r = state.research;
  if (!t || r.done.includes(id)) return;
  r.done.push(id);
  if (r.active[t.cat]?.id === id) delete r.active[t.cat];
  if (r.progress) delete r.progress[id];
  const c = ctxNow(state, grid, emit);
  logEntry(c, 'research', 'log.techDone', { tech: id });

  for (const lock of locksOf(id, r.done)) {
    if (r.locked.includes(lock) || r.done.includes(lock)) continue;
    r.locked.push(lock);
    const cat = TECHS[lock]!.cat;
    if (r.active[cat]?.id === lock) delete r.active[cat];
    if (r.progress) delete r.progress[lock];
  }

  // Everything derived from the tech list is rebuilt: modifiers, storage, the structure overlay.
  invalidateMods(state);
  state.build.gridRev++;
  refreshCapacity(state);
  // One-off effects.
  if (id === 'C9') for (const s of state.colony.survivors) changeMorale(s, RESEARCH.federationMorale);

  emit({ type: 'techCompleted', id });
  while (r.era < 3 && eraCount(state, r.era) >= RESEARCH.nodesPerEra) {
    r.era = (r.era + 1) as 1 | 2 | 3;
    logEntry(c, 'research', 'log.eraAdvanced', { era: r.era });
    emit({ type: 'eraAdvanced', era: r.era });
  }
}

/** One hour of research: distribute the colony's points and complete what is paid for. */
export function researchHour(state: GameState, emit: Emit, grid: Parameters<typeof ctxNow>[1] = null): void {
  const r = state.research;
  const cats = TECH_CATEGORIES.filter((cat) => r.active[cat] !== undefined);
  if (cats.length === 0) return; // the points wait in the colony's buffer (it has a cap)
  const points = takeResearchPoints(state);
  if (points <= 0) return;
  // Categories with nothing in progress pass their share on to the others, in proportion.
  let total = 0;
  for (const cat of cats) total += r.allocation[cat];
  let spare = 0;
  for (const cat of cats) {
    const a = r.active[cat]!;
    const t = TECHS[a.id];
    if (!t) {
      delete r.active[cat];
      continue;
    }
    a.rp += total > 0 ? (points * r.allocation[cat]) / total : points / cats.length;
    if (a.rp >= t.cost - 1e-9) {
      spare += Math.max(0, a.rp - t.cost);
      completeTech(state, a.id, emit, grid);
    }
  }
  // What a finished node did not need is not wasted.
  if (spare > 0) state.colony.work.research = Math.min(COLONY.buffers.research, state.colony.work.research + spare);
}

/** Research points the colony makes in a day as things stand (UI estimates). */
export function researchPerDay(state: GameState): number {
  let rp = 0;
  const f = facilityFactor(state, 'research') * jobMul(state, 'research');
  for (const s of state.colony.survivors) if (s.job === 'research' && isFit(s)) rp += outputPerHour(s, 'research') * f * workHours(s);
  return rp;
}

/** Share of the colony's research a category receives right now (0 when nothing is in progress in it). */
export function categoryShare(state: GameState, cat: TechCategory): number {
  const r = state.research;
  if (!r.active[cat]) return 0;
  let total = 0;
  let n = 0;
  for (const c of TECH_CATEGORIES) {
    if (!r.active[c]) continue;
    total += r.allocation[c];
    n++;
  }
  return total > 0 ? r.allocation[cat] / total : 1 / n;
}

/** Days until the node in progress of a category is done at the current output (Infinity when nothing comes in). */
export function daysLeft(state: GameState, cat: TechCategory): number {
  const a = state.research.active[cat];
  const t = a ? TECHS[a.id] : undefined;
  if (!a || !t) return Infinity;
  const perDay = researchPerDay(state) * categoryShare(state, cat);
  return perDay > 0 ? Math.max(0, t.cost - a.rp) / perDay : Infinity;
}

/** Debug / tests: grant nodes outright, prerequisites included (never a locked one). */
export function grantTech(state: GameState, ids: readonly string[], emit: Emit = () => {}): void {
  const grant = (id: string, depth: number): void => {
    const t = TECHS[id];
    const r = state.research;
    if (!t || depth > 20 || r.done.includes(id) || r.locked.includes(id)) return;
    for (const req of t.req) grant(req, depth + 1);
    if (t.any && !t.any.some((x) => r.done.includes(x))) grant(t.any.find((x) => !r.locked.includes(x)) ?? '', depth + 1);
    if (!r.locked.includes(id)) completeTech(state, id, emit);
  };
  for (const id of ids) grant(id, 0);
}

export const ALL_TECH_IDS: readonly string[] = TECH_LIST.map((t) => t.id);

export const researchSystem: System = {
  id: 'research',
  commands: {
    startResearch(state, cmd, ctx) {
      const reason = startResearch(state, cmd.id);
      if (reason) ctx.emit({ type: 'commandRejected', command: cmd.type, reason });
    },
    setAllocation(state, cmd, ctx) {
      const reason = setAllocation(state, cmd.allocation);
      if (reason) ctx.emit({ type: 'commandRejected', command: cmd.type, reason });
    },
    dismissEnding(state) {
      state.flags.endingSeen = true;
    },
  },
  hour(state, ctx) {
    if (state.flags.range || state.world.homeCell === null || state.flags.defeat) return;
    researchHour(state, ctx.emit, ctx.grid);
    checkVictory(state, ctx);
  },
  day(state, ctx) {
    if (state.flags.range || state.world.homeCell === null || state.flags.defeat) return;
    dailyEffects(ctxNow(state, ctx.grid, ctx.emit));
  },
};
