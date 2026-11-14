import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/events.ts';
import { addMinutes, daylight, effectiveSpeed, hasReached } from '../src/core/time.ts';
import { createInitialState, emptyInputFrame } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { createSim } from '../src/sim/index.ts';

const FIXED = BALANCE.time.fixedStep;
const input = emptyInputFrame();

function run(ticks: number) {
  const sim = createSim();
  const state = createInitialState(1, 1);
  const events: GameEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  for (let i = 0; i < ticks; i++) sim.tick(state, FIXED, input);
  return { sim, state, events };
}

describe('time system', () => {
  it('starts on day 90 at 06:00', () => {
    const s = createInitialState(1, 1);
    expect(s.time).toEqual({ day: 90, minute: 360, sub: 0, speed: 1 });
  });

  it('advances one game minute per real second (60 steps)', () => {
    const { state } = run(60 * 10);
    // Float accumulation of 1/60 may land one step early/late, never more.
    expect(state.time.minute === 370 || (state.time.minute === 369 && state.time.sub > 0.99)).toBe(true);
  });

  it('fires hourStarted on every hour boundary with the new hour', () => {
    const { events, state } = run(60 * 60 * 3 + 5);
    const hours = events.filter((e) => e.type === 'hourStarted');
    expect(hours).toEqual([
      { type: 'hourStarted', day: 90, hour: 7 },
      { type: 'hourStarted', day: 90, hour: 8 },
      { type: 'hourStarted', day: 90, hour: 9 },
    ]);
    expect(state.time.minute).toBe(9 * 60);
  });

  it('fires dayStarted at midnight, before the 00:00 hourStarted', () => {
    const { events, state } = run(60 * 60 * 18 + 5); // 06:00 -> 00:00 next day
    expect(state.time.day).toBe(91);
    expect(state.time.minute).toBe(0);
    const i = events.findIndex((e) => e.type === 'dayStarted');
    expect(events[i]).toEqual({ type: 'dayStarted', day: 91 });
    expect(events[i + 1]).toEqual({ type: 'hourStarted', day: 91, hour: 0 });
    expect(events.filter((e) => e.type === 'dayStarted')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'hourStarted')).toHaveLength(18);
  });

  it('keeps minute an integer in 0..1439 and sub in [0,1)', () => {
    const sim = createSim();
    const state = createInitialState(3, 0);
    for (let i = 0; i < 60 * 60 * 30; i++) {
      sim.tick(state, FIXED, input);
      if (!Number.isInteger(state.time.minute) || state.time.minute < 0 || state.time.minute > 1439 || state.time.sub < 0 || state.time.sub >= 1) {
        throw new Error(`bad time at tick ${i}: ${JSON.stringify(state.time)}`);
      }
    }
    expect(state.time.day).toBe(91);
  });
});

describe('time commands', () => {
  it('setSpeed changes speed and emits speedChanged', () => {
    const { sim, state, events } = run(0);
    sim.dispatch({ type: 'setSpeed', speed: 3 });
    expect(state.time.speed).toBe(1); // queued until the next tick
    sim.tick(state, FIXED, input);
    expect(state.time.speed).toBe(3);
    expect(events).toContainEqual({ type: 'speedChanged', speed: 3 });
  });

  it('x10 is capped to x3 in the tactical layer and allowed in the command layer', () => {
    const { sim, state } = run(0);
    sim.dispatch({ type: 'setSpeed', speed: 10 });
    sim.applyCommands(state);
    expect(state.time.speed).toBe(3);
    sim.dispatch({ type: 'setMode', mode: 'command' });
    sim.dispatch({ type: 'setSpeed', speed: 10 });
    sim.applyCommands(state);
    expect(state.time.speed).toBe(10);
    sim.dispatch({ type: 'setMode', mode: 'tactical' });
    sim.applyCommands(state);
    expect(state.time.speed).toBe(3);
  });

  it('applyCommands works without advancing time (paused) and emits modeChanged', () => {
    const { sim, state, events } = run(0);
    const before = { ...state.time };
    sim.dispatch({ type: 'setMode', mode: 'world' });
    sim.applyCommands(state);
    expect(state.mode).toBe('world');
    expect(state.time).toEqual(before);
    expect(events).toContainEqual({ type: 'modeChanged', mode: 'world', prev: 'tactical' });
  });

  it('the menu pauses the loop', () => {
    const s = createInitialState(1, 1);
    expect(effectiveSpeed(s)).toBe(1);
    s.mode = 'menu';
    expect(effectiveSpeed(s)).toBe(0);
  });
});

describe('time helpers', () => {
  it('daylight follows 06:00–18:00 with one-hour transitions', () => {
    expect(daylight(12)).toBe(1);
    expect(daylight(6)).toBe(1);
    expect(daylight(5.5)).toBeCloseTo(0.5);
    expect(daylight(18.5)).toBeCloseTo(0.5);
    expect(daylight(4.9)).toBe(0);
    expect(daylight(19)).toBe(0);
    expect(daylight(0)).toBe(0);
  });

  it('addMinutes / hasReached wrap across days', () => {
    expect(addMinutes({ day: 90, minute: 1400 }, 100)).toEqual({ day: 91, minute: 60 });
    expect(hasReached({ day: 91, minute: 59 }, { day: 91, minute: 60 })).toBe(false);
    expect(hasReached({ day: 91, minute: 60 }, { day: 91, minute: 60 })).toBe(true);
  });
});
