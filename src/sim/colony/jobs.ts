// Jobs: aptitude and output (spec §4.2), the daily schedule, and the per-minute results of work.
// Results are plain numbers per game minute, independent of where a survivor is drawn — the same at
// every speed and whether or not the player is watching (ai.ts only moves the figures).
//
// Interfaces for later sessions:
//   06  distributeBuildWork(state, points, workOf?)  — construction output -> pending blueprints
//       defenders(state)                             — who is on guard duty right now
//       farmPlots / housingBeds / facilityFactor     — read BuildState by the ids in COLONY.facilities
//   07  takeResearchPoints(state)                    — research output accumulated since the last call

import type { GameState, JobId, ResourceId, Structure, Survivor } from '../../core/types.ts';
import { COLONY, LOOT_TABLE } from '../../data/colony.ts';
import { RESEARCH } from '../../data/techs.ts';
import { traitOf } from '../../data/traits.ts';
import { getMod, hasFlag } from '../research/modifiers.ts';
import { bedsTotal, jobFacility, plotInfo } from '../build/structures.ts';
import { moveStock, type ColonyCtx } from './stock.ts';
import { isFit } from './survivors.ts';

const W = COLONY.work;
const T = COLONY.schedule;

export type Activity = 'sleep' | 'eat' | 'work' | 'free' | 'rest';

export function aptitude(s: Survivor, job: JobId): number {
  const [a, k] = COLONY.aptitude[job];
  return a * s.ath + k * s.kno;
}

export function moraleFactor(morale: number): number {
  return W.moraleBase + morale / 100;
}
export function healthFactor(s: Survivor): number {
  return s.status === 'ok' ? W.healthBase + (1 - W.healthBase) * (Math.max(0, Math.min(100, s.hp)) / 100) : 0;
}

export function builtCount(state: GameState, def: string): number {
  let n = 0;
  for (const st of state.build.structures) if (st.def === def && st.progress >= 1) n++;
  return n;
}

/** Equipment factor of a job: the best building for it (data/buildings.ts `job`); crafting without a workshop is hand work. */
export function facilityFactor(state: GameState, job: JobId): number {
  const f = jobFacility(state, job);
  if (job === 'crafting') return f ?? COLONY.craft.handFactor;
  return f ?? 1;
}

/**
 * What technology, buildings and the difficulty do to a job's output (07): `job.<id>` x `job.all`,
 * and with the federal charter (C9) a little for every outpost.
 */
export function jobMul(state: GameState, job: JobId): number {
  if (job === 'idle') return 1;
  let m = getMod(state, `job.${job}`, 1) * getMod(state, 'job.all', 1);
  if (hasFlag(state, 'federation')) m *= 1 + Math.min(RESEARCH.federationMax, RESEARCH.federationPerOutpost * state.world.outposts.length);
  return m;
}

/** Output per hour of work (spec §4.2), without the facility factor and without jobMul. */
export function outputPerHour(s: Survivor, job: JobId): number {
  const trait = traitOf(s.trait).job;
  const traitMul = (trait?.[job] ?? 1) * (trait?.all ?? 1);
  return aptitude(s, job) * (W.speedBase + W.speedPer * s.spd) * moraleFactor(s.morale) * healthFactor(s) * traitMul;
}

export function workHours(s: Survivor): number {
  return W.hoursBase + W.hoursPerSta * s.sta + (traitOf(s.trait).hoursBonus ?? 0);
}

export function mealPerDay(s: Survivor): number {
  return (W.mealBase - W.mealPerSta * s.sta) * (traitOf(s.trait).foodMul ?? 1);
}

/** Minute of the day at which this survivor's work ends (the lunch break extends the day). */
export function workEnd(s: Survivor): number {
  const end = T.workStart + Math.round(workHours(s) * 60);
  return end > T.lunch ? end + (T.lunchEnd - T.lunch) : end;
}

export function isWorkTime(s: Survivor, minute: number): boolean {
  return minute >= T.workStart && minute < workEnd(s) && !(minute >= T.lunch && minute < T.lunchEnd);
}

/** What a survivor at home is doing at this minute of the day. */
export function activityAt(s: Survivor, minute: number): Activity {
  if (s.status !== 'ok') return 'rest';
  if (minute < T.wake || minute >= T.sleep) return 'sleep';
  if (s.job !== 'idle' && isWorkTime(s, minute)) return 'work';
  if ((minute >= T.breakfast && minute < T.workStart) || (minute >= T.lunch && minute < T.lunchEnd) || (minute >= T.dinner && minute < T.dinnerEnd)) return 'eat';
  return 'free';
}

// --- interfaces for 06 / 07 ---------------------------------------------------------------

/** Farm plots (weighted by yield): the fields, ranches and greenhouses that stand (06). */
export function farmPlots(state: GameState): number {
  return plotInfo(state).plots;
}

/** Beds: the headquarters and every finished dwelling (06). */
export function housingBeds(state: GameState): number {
  return bedsTotal(state);
}

/** Survivors assigned to defence who are at home and fit; `onDuty` during their working hours. */
export function defenders(state: GameState): { survivor: Survivor; onDuty: boolean; power: number }[] {
  const minute = state.time.minute;
  return state.colony.survivors
    .filter((s) => s.job === 'defense' && isFit(s))
    .map((s) => ({ survivor: s, onDuty: isWorkTime(s, minute), power: outputPerHour(s, 'defense') * jobMul(state, 'defense') }));
}

/**
 * Everyone who fights when the dead are at the walls: the defenders, and with a militia (F7b)
 * every other able person at home, at a share of their defence output. `alarm`: a raid is on.
 */
export function fighters(state: GameState, alarm: boolean = state.flags.colonyAlarm === true): { survivor: Survivor; onDuty: boolean; power: number; militia?: boolean }[] {
  const list: { survivor: Survivor; onDuty: boolean; power: number; militia?: boolean }[] = defenders(state);
  if (alarm && hasFlag(state, 'militia')) {
    const mul = jobMul(state, 'defense') * RESEARCH.militiaShare;
    for (const s of state.colony.survivors) if (s.job !== 'defense' && isFit(s)) list.push({ survivor: s, onDuty: true, power: outputPerHour(s, 'defense') * mul, militia: true });
  }
  return list;
}

/** Research points produced since the last call (07 calls this every hour). */
export function takeResearchPoints(state: GameState): number {
  const rp = state.colony.work.research;
  state.colony.work.research = 0;
  return rp;
}

/**
 * Spend construction points on the blueprints (progress < 1), highest priority first, oldest first.
 * `workOf` gives the points a structure needs in total (06 passes the value from data/buildings.ts).
 * Returns the points left over.
 */
export function distributeBuildWork(state: GameState, points: number, workOf: (s: Structure) => number = () => COLONY.defaultBuildWork): number {
  if (points <= 0) return 0;
  const pending = state.build.structures.filter((s) => s.progress < 1).sort((a, b) => b.priority - a.priority || a.id - b.id);
  let left = points;
  for (const st of pending) {
    if (left <= 0) break;
    const total = Math.max(1e-6, workOf(st));
    const need = (1 - st.progress) * total;
    const spent = Math.min(need, left);
    st.progress = spent >= need ? 1 : st.progress + spent / total;
    left -= spent;
  }
  return left;
}

/** Month (0..11) of a day counted from the outbreak. */
export function monthOf(day: number): number {
  const doy = (((day + COLONY.farm.outbreakDayOfYear) % 365) + 365) % 365;
  return Math.min(11, Math.floor(doy / (365 / 12)));
}
export function seasonFactor(day: number): number {
  return COLONY.farm.season[monthOf(day)]!;
}

/** The season factor with the floor that seed research (A7) puts under it. */
export function seasonOf(state: GameState, day: number): number {
  return Math.max(seasonFactor(day), getMod(state, 'farm.seasonMin', 0));
}

// --- one minute of work --------------------------------------------------------------------

const farmers: { s: Survivor; out: number }[] = [];

/** Everyone at work produces a minute's worth of their job. */
export function workMinute(c: ColonyCtx): void {
  const { state } = c;
  const colony = state.colony;
  const work = colony.work;
  const B = COLONY.buffers;
  farmers.length = 0;
  let forage = 0;
  for (const s of colony.survivors) {
    if (s.job === 'idle' || s.job === 'defense' || !isFit(s) || !isWorkTime(s, c.minute)) continue;
    const out = (outputPerHour(s, s.job) * facilityFactor(state, s.job) * jobMul(state, s.job)) / 60;
    switch (s.job) {
      case 'farming': farmers.push({ s, out }); break;
      case 'scavenging': forage += out; break;
      case 'construction': work.build = Math.min(B.build, work.build + out); break;
      case 'research': work.research = Math.min(B.research, work.research + out); break;
      case 'crafting': work.craft += out; break;
      case 'medical': work.medical = Math.min(B.medical, work.medical + out); break;
    }
  }
  if (farmers.length > 0) {
    // The best farmers get the plots; the rest crowd in at a fraction of their output.
    farmers.sort((a, b) => b.out - a.out || a.s.id - b.s.id);
    const F = COLONY.farm;
    const plots = plotInfo(state);
    const full = Math.round(plots.plots * F.workersPerPlot);
    // Greenhouses do not care about the season.
    const season = seasonOf(state, c.day);
    const perPoint = getMod(state, 'farm.yield', F.foodPerPlotDay / F.refPoints) * (season + (1 - season) * plots.allSeason);
    let food = 0;
    for (let i = 0; i < farmers.length; i++) food += farmers[i]!.out * (i < full ? 1 : F.crowdedFactor) * perPoint;
    colony.market.food += food;
  }
  if (forage > 0) forageMinute(c, forage * COLONY.forageFactor);
}

/** The headquarters' kitchen garden: a little food into the stores every hour, no workers needed (07b+). */
export function gardenHour(c: ColonyCtx): void {
  if (c.state.world.homeCell === null || c.state.flags.range) return;
  moveStock(c, 'food', COLONY.garden.foodPerDay / 24);
}

/** Scavengers at home comb the home cell: its loot shrinks, the stores grow. */
function forageMinute(c: ColonyCtx, points: number): void {
  const home = c.state.world.homeCell;
  const land = home !== null ? c.grid?.cells[home]?.land : undefined;
  if (home === null || !land) return;
  const cells = c.state.world.cells;
  const loot = Math.max(0, cells.loot[home] ?? 0);
  if (loot <= 0) return;
  const table = LOOT_TABLE[land];
  for (const res of Object.keys(table) as Exclude<ResourceId, 'ears'>[]) moveStock(c, res, points * (table[res] ?? 0) * loot);
  cells.loot[home] = Math.max(0, loot - points * COLONY.expedition.lootPerPoint);
}
