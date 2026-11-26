// Colony: survivors, jobs, economy, morale, expeditions (owner: 05).
//
//   step()    E on the tactical map (talk / search), survivor movement inside the base (only while
//             the player is in the home cell), and the end of the death screen
//   minute()  everything that counts. The colony keeps its own clock (colony.lastMinute) and
//             simulates every game minute exactly once, catching up when several pass at once —
//             so results do not depend on the step size, the speed, or where the player is.
//
// Files: stock.ts (ledger, stores, log), survivors.ts (generation, hire / dismiss), jobs.ts (output,
// schedule, per-minute work, hooks for 06 / 07), economy.ts (wages, meals, food market, village,
// ammunition), morale.ts (morale, health, death, the player's revival), expeditions.ts,
// encounters.ts (E, deposit, resupply), ai.ts (walking around the base).
import { toAbsMinutes } from '../../core/time.ts';
import type { GameState, JobId } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { COLONY } from '../../data/colony.ts';
import type { SimContext, System } from '../system.ts';
import { updateSurvivorMotion } from './ai.ts';
import { buyFromVillage, buySupply, craftMinute, marketHour, payWages, serveMeal } from './economy.ts';
import { depositCarried, resupply, updateEncounters } from './encounters.ts';
import { expeditionsMinute, sendExpedition } from './expeditions.ts';
import { construct } from '../build/construction.ts';
import { gardenHour, workMinute } from './jobs.ts';
import { dailyMorale, healthHour, infectionMinute, unpaidMorale, updatePlayerDeath } from './morale.ts';
import { ctxNow, ledgerOf, logEntry, type ColonyCtx } from './stock.ts';
import { dismiss, expireCandidates, hire } from './survivors.ts';
import { techUnlocked } from '../build/structures.ts';

/** Jobs that need a technology before anyone can be put on them (data/techs.ts `unlock job`). */
export const JOB_TECH: Partial<Record<JobId, string>> = { medical: 'S4' };

const T = COLONY.schedule;
const DAY = BALANCE.time.minutesPerDay;
const JOBS: readonly JobId[] = ['idle', 'farming', 'defense', 'scavenging', 'construction', 'research', 'crafting', 'medical'];

/** One game minute of the colony. Order matters and is fixed. */
export function colonyMinute(c: ColonyCtx): void {
  const { state } = c;
  const colony = state.colony;
  const m = c.minute;
  if (m === 0) {
    dailyMorale(c);
    expireCandidates(c);
    colony.villageBought = 0;
    colony.supplyBought = 0;
  }
  ledgerOf(state, c.day);
  depositCarried(c);
  if (m % 60 === 0) {
    healthHour(c);
    marketHour(c);
    if (colony.work.build > 0) colony.work.build = construct(c, colony.work.build); // 06: materials, work, repairs, moats
  }
  if (m === T.breakfast || m === T.lunch || m === T.dinner) serveMeal(c);
  if (m === T.payday) {
    payWages(c);
    unpaidMorale(c);
  }
  workMinute(c);
  if (m % 60 === 30) gardenHour(c); // half past: never on the day boundary
  craftMinute(c);
  expeditionsMinute(c);
  infectionMinute(c);
}

/** Bring the colony up to the current game time, one minute at a time. */
export function catchUp(state: GameState, ctx: Pick<SimContext, 'grid' | 'emit'>): void {
  if (state.flags.range || state.world.homeCell === null) return;
  const colony = state.colony;
  const now = toAbsMinutes(state.time);
  if (colony.lastMinute < 0 || colony.lastMinute > now) colony.lastMinute = now - 1;
  const c: ColonyCtx = { state, grid: ctx.grid, emit: ctx.emit, day: 0, minute: 0 };
  while (colony.lastMinute < now) {
    colony.lastMinute += 1;
    c.day = Math.floor(colony.lastMinute / DAY);
    c.minute = colony.lastMinute % DAY;
    colonyMinute(c);
  }
}

export const colonySystem: System = {
  id: 'colony',
  commands: {
    assignJob(state, cmd, ctx) {
      const s = state.colony.survivors.find((x) => x.id === cmd.survivor);
      if (!s || !JOBS.includes(cmd.job)) return ctx.emit({ type: 'commandRejected', command: cmd.type, reason: 'unknownSurvivor' });
      if (s.job === cmd.job) return;
      if (!techUnlocked(state, JOB_TECH[cmd.job])) return ctx.emit({ type: 'commandRejected', command: cmd.type, reason: 'locked' });
      s.job = cmd.job;
      logEntry(ctxNow(state, ctx.grid, ctx.emit), 'people', 'log.assigned', { name: s.name, job: cmd.job });
    },
    hire(state, cmd, ctx) {
      const reason = hire(ctxNow(state, ctx.grid, ctx.emit), cmd.candidate);
      if (reason) ctx.emit({ type: 'commandRejected', command: cmd.type, reason });
    },
    dismiss(state, cmd, ctx) {
      const reason = dismiss(ctxNow(state, ctx.grid, ctx.emit), cmd.survivor);
      if (reason) ctx.emit({ type: 'commandRejected', command: cmd.type, reason });
    },
    buyFood(state, cmd, ctx) {
      const reason = cmd.source === 'village' ? buyFromVillage(ctxNow(state, ctx.grid, ctx.emit), cmd.amount) : 'unknownSource';
      if (reason) ctx.emit({ type: 'commandRejected', command: cmd.type, reason });
    },
    buySupply(state, cmd, ctx) {
      const reason = buySupply(ctxNow(state, ctx.grid, ctx.emit), cmd.resource, cmd.amount);
      if (reason) ctx.emit({ type: 'commandRejected', command: cmd.type, reason });
    },
    sendExpedition(state, cmd, ctx) {
      const reason = sendExpedition(ctxNow(state, ctx.grid, ctx.emit), cmd.members, cmd.target, cmd.weapon);
      if (reason) ctx.emit({ type: 'commandRejected', command: cmd.type, reason });
    },
    setPolicy(state, cmd) {
      state.colony.policy.autoBuyFood = cmd.autoBuyFood;
    },
    resupply(state, _cmd, ctx) {
      const c = ctxNow(state, ctx.grid, ctx.emit);
      const reason = resupply(c);
      if (reason) {
        ctx.emit({ type: 'commandRejected', command: 'resupply', reason });
        // 07c (playtest: "pressed B at the blue light, nothing happened"): say why on the HUD.
        const O1: Record<string, string> = { stashLocked: 'log.stashLocked', noMaterials: 'log.stashEmpty', storesFull: 'log.stashStoresFull' };
        logEntry(c, 'economy', O1[reason] ?? (reason === 'full' ? 'log.resupplyFull' : reason === 'noAmmo' ? 'log.resupplyEmpty' : 'log.resupplyNowhere'), {});
      }
    },
  },
  step(state, ctx) {
    // The colony's clock starts with the game (so that the very first minutes are not skipped by a large step).
    if (state.colony.lastMinute < 0 && state.world.homeCell !== null && !state.flags.range) state.colony.lastMinute = toAbsMinutes(state.time);
    updatePlayerDeath(state, ctx);
    updateEncounters(state, ctx);
    updateSurvivorMotion(state, ctx.dt);
  },
  minute(state, ctx) {
    catchUp(state, ctx);
  },
};
