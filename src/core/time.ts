// Pure helpers for game time (no state mutation here; advancing lives in sim/time.ts).

import { BALANCE } from '../data/balance.ts';
import type { GameState } from './types.ts';

const T = BALANCE.time;

export interface GameTime {
  day: number;
  minute: number;
}

export function hourOf(minute: number): number {
  return Math.floor(minute / 60);
}

/** Absolute minutes since day 0 00:00 — handy for comparing/adding timestamps. */
export function toAbsMinutes(t: GameTime): number {
  return t.day * T.minutesPerDay + t.minute;
}

export function fromAbsMinutes(abs: number): GameTime {
  return { day: Math.floor(abs / T.minutesPerDay), minute: ((abs % T.minutesPerDay) + T.minutesPerDay) % T.minutesPerDay };
}

export function addMinutes(t: GameTime, minutes: number): GameTime {
  return fromAbsMinutes(toAbsMinutes(t) + minutes);
}

/** True once `now` has reached `target`. */
export function hasReached(now: GameTime, target: GameTime): boolean {
  return toAbsMinutes(now) >= toAbsMinutes(target);
}

/** Continuous hour of day in [0, 24), including the sub-minute fraction (for smooth rendering). */
export function hourFloat(time: GameState['time']): number {
  return (time.minute + time.sub) / 60;
}

/**
 * Daylight factor: 1 during the day (06:00–18:00), 0 at night, linear over the one-hour
 * dawn (05:00–06:00) and dusk (18:00–19:00) transitions.
 */
export function daylight(hour: number): number {
  const dawn0 = T.dayStartHour - T.twilightHours;
  const dusk1 = T.dayEndHour + T.twilightHours;
  if (hour < dawn0 || hour >= dusk1) return 0;
  if (hour < T.dayStartHour) return (hour - dawn0) / T.twilightHours;
  if (hour < T.dayEndHour) return 1;
  return 1 - (hour - T.dayEndHour) / T.twilightHours;
}

export function isNight(minute: number): boolean {
  return daylight(minute / 60) < 0.5;
}

/** Speed the main loop should actually run at (the in-game menu always pauses). */
export function effectiveSpeed(state: GameState): number {
  if (state.mode === 'menu' || state.time.speed === 0) return 0;
  // Journeys between cells are fast-forwarded (spec §1); pausing still works.
  return state.world.travel ? BALANCE.world.travel.speed : state.time.speed;
}
