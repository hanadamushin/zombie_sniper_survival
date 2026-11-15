// Morale (spec §4.3), desertion, injuries and infections, death — and what happens when the
// player dies (spec §3.5): three days later at the headquarters if anyone is left, defeat otherwise.

import { hasReached } from '../../core/time.ts';
import type { GameState, StaticGrid, Survivor } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { COLONY } from '../../data/colony.ts';
import { TACTICAL } from '../../data/tactical.ts';
import { traitOf } from '../../data/traits.ts';
import type { SimContext } from '../system.ts';
import { areaOf } from '../tactical/area.ts';
import { DEATH_HOLD } from '../tactical/combat.ts';
import { placePlayer } from '../tactical/player.ts';
import { weaponOf } from '../tactical/weapon.ts';
import { clearZombiesNear } from '../tactical/zombies.ts';
import { moraleBonus } from '../build/structures.ts';
import { housingBeds } from './jobs.ts';
import { ctxNow, ledgerOf, logEntry, moveEars, moveStock, type ColonyCtx } from './stock.ts';
import { isAlive, isHome, returnHidden } from './survivors.ts';

const M = COLONY.morale;
const H = COLONY.health;

const clampMorale = (v: number): number => Math.min(100, Math.max(0, v));

export function changeMorale(s: Survivor, delta: number): void {
  s.morale = clampMorale(s.morale + delta);
}

/** A survivor dies: off the roll, onto the memorial, and the others take it hard (that day only). */
export function killSurvivor(c: ColonyCtx, s: Survivor, cause: string): void {
  const colony = c.state.colony;
  if (!colony.survivors.includes(s)) return;
  s.status = 'dead';
  colony.survivors = colony.survivors.filter((x) => x !== s);
  colony.memorial.push({ name: s.name, day: c.day, cause });
  if (colony.memorial.length > 50) colony.memorial.shift();
  for (const o of colony.survivors) changeMorale(o, M.death);
  logEntry(c, 'death', 'log.died', { name: s.name, cause });
  c.emit({ type: 'survivorDied', id: s.id, cause });
}

/** The morning after an unpaid day. */
export function unpaidMorale(c: ColonyCtx): void {
  for (const s of c.state.colony.survivors) if (s.unpaidDays > 0) changeMorale(s, traitOf(s.trait).unpaidMorale ?? M.unpaid);
}

/** Midnight: yesterday's meals and shelter move morale; the miserable leave; the starved die. */
export function dailyMorale(c: ColonyCtx): void {
  const colony = c.state.colony;
  const beds = housingBeds(c.state);
  const comforts = moraleBonus(c.state); // canteen, tavern, monument... (06)
  let bed = 0;
  let homeless = 0;
  for (const s of [...colony.survivors]) {
    if (isHome(s)) {
      const meals = s.meals;
      if (s.missed === 0) changeMorale(s, M.fed);
      else if (meals > 0) changeMorale(s, M.hungry);
      else {
        changeMorale(s, M.starving);
        s.hp -= H.starveHp;
      }
      if (bed++ < beds) changeMorale(s, M.housed);
      else {
        changeMorale(s, M.homeless);
        homeless++;
      }
      changeMorale(s, (traitOf(s.trait).moralePerDay ?? 0) + comforts);
    }
    s.meals = 0;
    s.missed = 0;
    if (s.hp <= 0) {
      killSurvivor(c, s, 'starvation');
      continue;
    }
    s.lowMoraleDays = s.morale < M.desertBelow ? s.lowMoraleDays + 1 : 0;
    if (s.lowMoraleDays >= M.desertDays && s.location.kind === 'home') desert(c, s);
  }
  if (homeless > 0 && c.day % 3 === 0) logEntry(c, 'morale', 'log.homeless', { n: homeless });
}

function desert(c: ColonyCtx, s: Survivor): void {
  const colony = c.state.colony;
  colony.survivors = colony.survivors.filter((x) => x !== s);
  const ears = Math.floor(moveEars(c, 'other', Math.min(colony.stock.ears, s.wage * M.stealWageDays)));
  const food = moveStock(c, 'food', -M.stealFood);
  returnHidden(c.state, c.state.world.homeCell);
  logEntry(c, 'morale', 'log.deserted', { name: s.name, ears, food: Math.round(food * 10) / 10, reason: s.unpaidDays > 0 ? 'unpaid' : 'misery' });
  c.emit({ type: 'survivorLeft', id: s.id, reason: 'deserted' });
}

/** The player is in the home cell and not on the road. */
export function playerAtHome(state: GameState): boolean {
  return state.world.homeCell !== null && state.player.cell === state.world.homeCell && !state.world.travel;
}

/**
 * Every hour: rest heals, first aid and the medics treat — infections first (earliest deadline,
 * the player included when at home; each cure takes medicine), then the injured.
 */
export function healthHour(c: ColonyCtx): void {
  const { state } = c;
  const colony = state.colony;
  const atHome = colony.survivors.filter(isHome);
  const player = state.player;
  const playerHere = playerAtHome(state) && player.aim.deadT <= 0;
  if (atHome.length > 0 || playerHere) colony.work.medical = Math.min(COLONY.buffers.medical, colony.work.medical + H.firstAidPerHour);

  for (const s of atHome) if (s.hp < 100) s.hp = Math.min(100, s.hp + H.restPerHour);
  if (playerHere && player.hp < BALANCE.player.hp) player.hp = Math.min(BALANCE.player.hp, player.hp + H.playerRestPerHour);

  // Infections: the most urgent case first.
  type Patient = { until: { day: number; minute: number }; s: Survivor | null };
  const sick: Patient[] = atHome.filter((s) => s.status === 'infected' && s.infectedUntil).map((s) => ({ until: s.infectedUntil!, s }));
  if (playerHere && player.infectedUntil) sick.push({ until: player.infectedUntil, s: null });
  sick.sort((a, b) => a.until.day * 1440 + a.until.minute - (b.until.day * 1440 + b.until.minute));
  for (const p of sick) {
    if (colony.work.medical < H.cureWork) break;
    if (colony.stock.medicine < H.cureMedicine) {
      if (state.flags.noMedicineDay !== c.day) {
        state.flags.noMedicineDay = c.day;
        logEntry(c, 'health', 'log.noMedicine', {});
      }
      break;
    }
    colony.work.medical -= H.cureWork;
    moveStock(c, 'medicine', -H.cureMedicine);
    if (p.s) {
      p.s.infectedUntil = null;
      p.s.status = p.s.hp >= H.fitHp ? 'ok' : 'injured';
      logEntry(c, 'health', 'log.cured', { name: p.s.name });
    } else {
      player.infectedUntil = null;
      logEntry(c, 'health', 'log.playerCured', {});
    }
  }
  // Spare care goes to the worst wounds.
  const hurt = atHome.filter((s) => s.status === 'injured').sort((a, b) => a.hp - b.hp || a.id - b.id);
  for (const s of hurt) {
    if (colony.work.medical <= 0) break;
    const points = Math.min(colony.work.medical, (H.fitHp - s.hp) / H.hpPerPoint);
    if (points > 0) {
      colony.work.medical -= points;
      s.hp += points * H.hpPerPoint;
    }
  }
  for (const s of atHome) {
    if (s.status === 'injured' && s.hp >= H.fitHp - 1e-6) {
      s.status = 'ok';
      logEntry(c, 'health', 'log.recovered', { name: s.name });
    }
  }
}

/** Untreated infections run out (checked every minute). */
export function infectionMinute(c: ColonyCtx): void {
  for (const s of [...c.state.colony.survivors]) {
    if (s.status === 'infected' && s.infectedUntil && hasReached({ day: c.day, minute: c.minute }, s.infectedUntil)) killSurvivor(c, s, 'infection');
  }
}

// --- the player's death ----------------------------------------------------------------------


/**
 * Called every step. When the death screen is over: with a colony, the player wakes up at the
 * headquarters `recoverDays` later without what they carried; without one, the game is lost.
 */
export function updatePlayerDeath(state: GameState, ctx: SimContext): void {
  const aim = state.player.aim;
  if (aim.deadT <= 0 || aim.deadT > DEATH_HOLD || state.flags.range || state.flags.defeat) return;
  const c = ctxNow(state, ctx.grid, ctx.emit);
  if (!state.colony.survivors.some(isAlive)) {
    state.flags.defeat = true;
    logEntry(c, 'death', 'log.defeat', {});
    ctx.emit({ type: 'defeat', reason: 'noColony' });
    return;
  }
  revivePlayer(state, ctx.grid, c);
  ctx.emit({ type: 'playerRevived' });
}

function revivePlayer(state: GameState, _grid: StaticGrid | null, c: ColonyCtx): void {
  const p = state.player;
  const P = BALANCE.player;
  const home = state.world.homeCell;
  const lostEars = p.inv.ears ?? 0;
  const lostAmmo = (p.inv.ammo ?? 0) + p.weapon.mag;
  // Carried back to the headquarters.
  state.world.travel = null;
  if (home !== null && p.cell !== home) {
    p.cell = home;
    state.tactical = null; // the home area is rebuilt and the player placed at its centre
  } else {
    const area = areaOf(state);
    if (area) {
      placePlayer(p, area.map, area.map.spawn.home[0], area.map.spawn.home[1], 0);
      clearZombiesNear(state, area, p.pos[0], p.pos[2], P.reviveClear);
      for (const z of state.tactical?.zombies ?? []) {
        if (z.state === 'chase' || z.state === 'attack') {
          z.state = 'wander';
          z.target = null;
          z.t = 1;
        }
      }
    }
  }
  p.hp = P.hp;
  p.stamina = P.stamina;
  p.breath = P.breath;
  p.stance = 'stand';
  p.eye = TACTICAL.player.eyeHeight.stand;
  p.infectedUntil = null;
  p.inv = { ammo: 0, ears: 0 };
  p.weapon.mag = 0;
  p.weapon.boltT = 0;
  p.weapon.reloadT = 0;
  p.aim.airPeak = null;
  p.aim.deadT = 0;
  p.scoped = false;
  // The colony makes sure the player does not come back to an empty armoury.
  const short = H.recoverAmmo - state.colony.stock.ammo;
  if (short > 0) moveStock(c, 'ammo', short);
  const give = Math.min(P.maxAmmo, state.colony.stock.ammo, Math.max(H.recoverAmmo, weaponOf(state).magSize));
  p.inv.ammo = moveStock(c, 'ammo', -give);
  ledgerOf(state, c.day);
  logEntry(c, 'death', 'log.playerDown', { days: H.recoverDays, ears: lostEars, ammo: lostAmmo });
  // Three days pass (sim/index.ts fast-forwards minute by minute; the colony carries on meanwhile).
  state.flags.skipMinutes = H.recoverDays * BALANCE.time.minutesPerDay;
}
