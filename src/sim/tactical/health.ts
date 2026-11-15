// Damage to the player: bites (with a chance of infection), falls, the infection running out.
// Death only marks the player as down and emits playerDied; combat.ts handles the revival.

import { chance, stream } from '../../core/rng.ts';
import { addMinutes, hasReached } from '../../core/time.ts';
import type { GameState } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import type { SimContext } from '../system.ts';

const P = BALANCE.player;

export type HurtCause = 'bite' | 'fall' | 'infection';

export function isDead(state: GameState): boolean {
  return state.player.aim.deadT > 0;
}

export function hurtPlayer(state: GameState, ctx: SimContext, amount: number, cause: HurtCause): void {
  const p = state.player;
  if (isDead(state) || amount <= 0) return;
  p.hp = Math.max(0, p.hp - amount);
  p.aim.hurtT = 1;
  ctx.emit({ type: 'playerHurt', amount, hp: p.hp, cause });
  if (cause === 'bite' && p.hp > 0 && !p.infectedUntil && chance(stream(state, 'tactical.infection'), P.infectionChance)) {
    const until = addMinutes({ day: state.time.day, minute: state.time.minute }, P.infectionHours * 60);
    p.infectedUntil = { day: until.day, minute: until.minute };
    ctx.emit({ type: 'playerInfected', untilDay: until.day, untilMinute: until.minute });
  }
  if (p.hp <= 0) {
    p.aim.deadT = P.reviveSeconds;
    p.scoped = false;
    ctx.emit({ type: 'playerDied', cause });
  }
}

/** An untreated infection kills when its time is up (medicine / clinic: 05). */
export function checkInfection(state: GameState, ctx: SimContext): void {
  const until = state.player.infectedUntil;
  if (!until || isDead(state)) return;
  if (hasReached({ day: state.time.day, minute: state.time.minute }, until)) hurtPlayer(state, ctx, state.player.hp, 'infection');
}
