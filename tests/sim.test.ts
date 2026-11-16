import { describe, expect, it, vi } from 'vitest';
import type { Command } from '../src/core/commands.ts';
import { createStepper } from '../src/core/loop.ts';
import { createInitialState, emptyInputFrame, continuationFrame } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { createSim, SYSTEMS } from '../src/sim/index.ts';
import type { System } from '../src/sim/system.ts';

const FIXED = BALANCE.time.fixedStep;
const input = emptyInputFrame();

describe('sim.tick', () => {
  it('runs 10,000 ticks without throwing and keeps the state JSON-clean', () => {
    const sim = createSim();
    const state = createInitialState(2026, 1);
    for (let i = 0; i < 10_000; i++) sim.tick(state, FIXED, input);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(state.time.minute).toBeGreaterThan(360);
  });

  it('is deterministic: same seed + same commands => identical state', () => {
    const play = () => {
      const sim = createSim();
      const state = createInitialState(99, 2);
      for (let i = 0; i < 5000; i++) {
        if (i === 100) sim.dispatch({ type: 'setMode', mode: 'command' });
        if (i === 200) sim.dispatch({ type: 'setSpeed', speed: 10 });
        sim.tick(state, FIXED, input);
      }
      return JSON.stringify(state);
    };
    expect(play()).toBe(play());
  });

  it('calls hooks in the documented order and frequency', () => {
    const calls: string[] = [];
    const mk = (id: string): System => ({
      id,
      step: () => calls.push(`${id}.step`),
      minute: () => calls.push(`${id}.minute`),
      hour: () => calls.push(`${id}.hour`),
      day: () => calls.push(`${id}.day`),
    });
    const sim = createSim({ systems: [mk('a'), mk('b')] });
    const state = createInitialState(1, 1);
    state.time.minute = 1439;
    state.time.sub = 0.999; // next tick crosses minute, hour and day at once
    sim.tick(state, FIXED, input);
    expect(calls).toEqual(['a.step', 'b.step', 'a.minute', 'b.minute', 'a.hour', 'b.hour', 'a.day', 'b.day']);

    calls.length = 0;
    for (let i = 0; i < 120; i++) sim.tick(state, FIXED, input);
    expect(calls.filter((c) => c === 'a.step')).toHaveLength(120);
    expect(calls.filter((c) => c === 'a.minute')).toHaveLength(2);
    expect(calls.filter((c) => c.endsWith('.hour') || c.endsWith('.day'))).toHaveLength(0);
  });

  it('applies commands before systems run and shows events to systems one tick later', () => {
    const seen: string[][] = [];
    const probe: System = {
      id: 'probe',
      step: (state, ctx) => seen.push([state.mode, ...ctx.prevEvents.map((e) => e.type)]),
    };
    const sim = createSim({ systems: [SYSTEMS[0]!, probe] });
    const state = createInitialState(1, 1);
    sim.dispatch({ type: 'setMode', mode: 'command' });
    sim.tick(state, FIXED, input);
    sim.tick(state, FIXED, input);
    sim.tick(state, FIXED, input);
    expect(seen).toEqual([['command'], ['command', 'modeChanged'], ['command']]);
  });

  it('warns once for commands without a handler and keeps running', () => {
    const warn = vi.fn();
    // Every command has an owner by now (07), so the check runs on a sim that lacks the research system.
    const sim = createSim({ warn, systems: SYSTEMS.filter((s) => s.id !== 'research') });
    const state = createInitialState(1, 1);
    const cmd: Command = { type: 'startResearch', id: 'x' };
    sim.dispatch(cmd);
    sim.dispatch(cmd);
    sim.tick(state, FIXED, input);
    sim.dispatch(cmd);
    sim.tick(state, FIXED, input);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('startResearch');
  });

  it('rejects two systems claiming the same command', () => {
    const a: System = { id: 'a', commands: { resupply: () => {} } };
    const b: System = { id: 'b', commands: { resupply: () => {} } };
    expect(() => createSim({ systems: [a, b] })).toThrow(/resupply/);
  });
});

describe('fixed-step loop', () => {
  const opts = { fixedStep: FIXED, maxFrameDt: 0.1, maxStepsPerFrame: 90 };

  it('runs speed-scaled steps and marks only the first of a frame', () => {
    const stepper = createStepper(opts);
    const firsts: boolean[] = [];
    stepper.advance(0.05, 3, (first) => firsts.push(first)); // 0.15 s of sim time = 9 steps
    expect(firsts.length).toBe(9);
    expect(firsts.filter(Boolean)).toHaveLength(1);
    expect(firsts[0]).toBe(true);
  });

  it('does nothing while paused', () => {
    const stepper = createStepper(opts);
    let n = 0;
    expect(stepper.advance(0.016, 0, () => n++)).toBe(0);
    expect(n).toBe(0);
  });

  it('clamps a huge dt after the tab was inactive', () => {
    const stepper = createStepper(opts);
    let n = 0;
    stepper.advance(3600, 1, () => n++);
    expect(n).toBeLessThanOrEqual(7); // 0.1 s max => 6 steps (+1 for float rounding)
    n = 0;
    stepper.advance(3600, 10, () => n++);
    expect(n).toBeLessThanOrEqual(opts.maxStepsPerFrame);
  });

  it('carries the remainder between frames', () => {
    const stepper = createStepper(opts);
    let n = 0;
    for (let i = 0; i < 144; i++) stepper.advance(1 / 144, 1, () => n++); // one second on a 144 Hz display
    expect(Math.abs(n - 60)).toBeLessThanOrEqual(1);
  });
});

describe('input frames', () => {
  it('continuationFrame keeps held controls and drops one-shots', () => {
    const f = { ...emptyInputFrame(), moveZ: 1, fire: true, lookDX: 12, reload: true, stance: 'prone' as const, zoomDelta: 1 };
    expect(continuationFrame(f)).toEqual({ ...emptyInputFrame(), moveZ: 1, fire: true });
  });
});
