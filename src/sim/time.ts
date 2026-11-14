// Time system: advances the clock, reports minute/hour/day boundaries, and owns the
// setSpeed / setMode commands.

import { hourOf } from '../core/time.ts';
import type { GameState } from '../core/types.ts';
import { BALANCE } from '../data/balance.ts';
import type { CommandHandlers, SimContext } from './system.ts';

const T = BALANCE.time;

export interface TimeBoundaries {
  minute: boolean;
  hour: boolean;
  day: boolean;
}

/**
 * Advance game time by one fixed step. With the 60 Hz step at most one minute boundary can be
 * crossed per call; the loop is kept so larger dt values (headless bots) stay correct —
 * in that case the flags report "at least one".
 */
export function advanceTime(state: GameState, ctx: SimContext): TimeBoundaries {
  const time = state.time;
  const out: TimeBoundaries = { minute: false, hour: false, day: false };
  time.sub += ctx.dt / T.realSecondsPerGameMinute;
  while (time.sub >= 1) {
    time.sub -= 1;
    time.minute += 1;
    out.minute = true;
    if (time.minute >= T.minutesPerDay) {
      time.minute = 0;
      time.day += 1;
      out.day = true;
      ctx.emit({ type: 'dayStarted', day: time.day });
    }
    if (time.minute % 60 === 0) {
      out.hour = true;
      ctx.emit({ type: 'hourStarted', day: time.day, hour: hourOf(time.minute) });
    }
  }
  return out;
}

export const timeCommands: CommandHandlers = {
  setSpeed(state, cmd, ctx) {
    if (!T.speeds.includes(cmd.speed)) {
      ctx.emit({ type: 'commandRejected', command: cmd.type, reason: 'invalidSpeed' });
      return;
    }
    // x10 is reserved for the command / world layers.
    const speed = state.mode === 'tactical' && cmd.speed > T.maxTacticalSpeed ? T.maxTacticalSpeed : cmd.speed;
    if (speed === state.time.speed) return;
    state.time.speed = speed;
    ctx.emit({ type: 'speedChanged', speed });
  },

  setMode(state, cmd, ctx) {
    if (cmd.mode === state.mode) return;
    const prev = state.mode;
    state.mode = cmd.mode;
    ctx.emit({ type: 'modeChanged', mode: cmd.mode, prev });
    if (cmd.mode === 'tactical' && state.time.speed > T.maxTacticalSpeed) {
      state.time.speed = T.maxTacticalSpeed;
      ctx.emit({ type: 'speedChanged', speed: state.time.speed });
    }
  },
};
