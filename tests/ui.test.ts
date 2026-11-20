// 08: tutorial bookkeeping, settings, the first-steps sequence, the problem list and the
// event -> feedback table. Headless (no DOM): only the pure parts of the UI layer.

import { describe, expect, it } from 'vitest';
import { createInitialState, emptyInputFrame, type GameState } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { createSim } from '../src/sim/index.ts';
import { defaultSettings, sanitizeSettings } from '../src/settings.ts';
import { nextStep, objectives, stepDone } from '../src/ui/guide.ts';
import { warnings } from '../src/ui/warnings.ts';
import { EVENT_FEEDBACK } from '../src/audio/feedback.ts';
import { generateSurvivor } from '../src/sim/colony/survivors.ts';
import { stream } from '../src/core/rng.ts';
import { ja } from '../src/ui/i18n/ja.ts';

const FIXED = BALANCE.time.fixedStep;

function fresh(): GameState {
  return createInitialState(7, 1);
}

describe('markSeen (08)', () => {
  it('sets a seen flag that survives a save round trip, and refuses odd keys', () => {
    const sim = createSim();
    const state = fresh();
    const rejected: string[] = [];
    sim.events.on('commandRejected', (e) => rejected.push(e.reason));
    sim.dispatch({ type: 'markSeen', key: 'tut.move' });
    sim.dispatch({ type: 'markSeen', key: 'no spaces allowed' });
    sim.dispatch({ type: 'markSeen', key: 'x'.repeat(40) });
    sim.tick(state, FIXED, emptyInputFrame());
    expect(state.flags['seen.tut.move']).toBe(true);
    expect(Object.keys(state.flags).filter((k) => k.startsWith('seen.'))).toEqual(['seen.tut.move']);
    expect(rejected).toEqual(['badKey', 'badKey']);
    expect(JSON.parse(JSON.stringify(state)).flags['seen.tut.move']).toBe(true);
  });

  it('works while paused (applyCommands)', () => {
    const sim = createSim();
    const state = fresh();
    sim.dispatch({ type: 'markSeen', key: 'tut.scope' });
    sim.applyCommands(state);
    expect(state.flags['seen.tut.scope']).toBe(true);
  });
});

describe('settings (08)', () => {
  it('fills in defaults and clamps what is stored', () => {
    expect(sanitizeSettings(null)).toEqual(defaultSettings());
    const s = sanitizeSettings({ mouseSens: 99, keyLookSpeed: -3, scopeMode: 'toggle', fov: 'wide', volume: { master: 2, ui: 0.3 }, renderScale: 0.1, hints: 'yes' });
    expect(s.mouseSens).toBe(3);
    expect(s.keyLookSpeed).toBe(0.25);
    expect(s.scopeMode).toBe('toggle');
    expect(s.fov).toBe(defaultSettings().fov);
    expect(s.volume.master).toBe(1);
    expect(s.volume.ui).toBe(0.3);
    expect(s.volume.sfx).toBe(defaultSettings().volume.sfx);
    expect(s.renderScale).toBe(0.5);
    expect(s.hints).toBe(true);
    expect(s.autoResolution).toBe(true); // automatic resolution stays the default (no real GPU tested)
  });
});

describe('first steps (08)', () => {
  it('walks the sequence in order as the game records progress', () => {
    const s = fresh();
    expect(nextStep(s)).toBe('move');
    s.flags['seen.tut.move'] = true;
    s.flags['seen.tut.scope'] = true;
    expect(nextStep(s)).toBe('shoot');
    s.player.stats.kills = 1;
    expect(nextStep(s)).toBe('ears');
    s.player.stats.earsCollected = 2;
    expect(nextStep(s)).toBe('meet');
    const person = generateSurvivor(s, 'rural', stream(s, 'test.people'));
    s.colony.candidates.push(person);
    expect(nextStep(s)).toBe('hire');
    s.colony.candidates.length = 0;
    s.colony.survivors.push(person);
    expect(nextStep(s)).toBe('job');
    person.job = 'construction';
    expect(nextStep(s)).toBe('fence');
    s.build.structures.push({ id: 900, def: 'palisade', tx: 120, ty: 120, rot: 0, hp: 0, progress: 0, delivered: {}, level: 1, priority: 1 });
    expect(nextStep(s)).toBe('research');
    expect(stepDone(s, 'fence')).toBe(true);
  });

  it('a dismissed hint counts as done', () => {
    const s = fresh();
    s.flags['seen.tut.move'] = true;
    s.flags['seen.tut.scope'] = true;
    s.flags['seen.tut.shoot'] = true;
    expect(nextStep(s)).toBe('ears');
  });

  it('lists at most three things to do and the road to the declaration', () => {
    const s = fresh();
    const o = objectives(s, null);
    expect(o.items.length).toBe(3);
    expect(o.items[0]!.id).toBe('move');
    expect(o.nation).toContain('60');
  });

  it('every hint, objective and warning text exists', () => {
    for (const id of ['move', 'scope', 'shoot', 'shootLook', 'ears', 'meet', 'hire', 'job', 'fence', 'research', 'map', 'expedition', 'outpost', 'tip.ammo', 'tip.tower', 'tip.hq', 'tip.moat', 'tip.night']) expect(ja).toHaveProperty(`tut.${id}`);
    for (const id of ['move', 'scope', 'shoot', 'ears', 'meet', 'hire', 'job', 'fence', 'research', 'map', 'expedition', 'outpost']) expect(ja).toHaveProperty(`obj.${id}`);
  });
});

describe('problems (08)', () => {
  it('reports hunger, unpaid wages, idle hands and low ammunition', () => {
    const s = fresh();
    const a = generateSurvivor(s, 'rural', stream(s, 'test.people'));
    a.unpaidDays = 2;
    s.colony.survivors.push(a);
    s.colony.stock.food = 0.5;
    s.player.inv.ammo = 4;
    s.player.weapon.mag = 0;
    const ids = warnings(s).map((w) => w.id);
    expect(ids).toEqual(expect.arrayContaining(['food', 'unpaid', 'idle', 'ammo']));
    // Worst first.
    expect(warnings(s)[0]!.level).toBe('danger');
  });

  it('is quiet in a fresh game and on the firing range', () => {
    const s = fresh();
    expect(warnings(s)).toEqual([]);
    s.player.inv.ammo = 0;
    s.flags.range = true;
    expect(warnings(s)).toEqual([]);
  });
});

describe('event feedback table (08)', () => {
  it('gives every event a sound, a notice, or a reason for neither', () => {
    for (const [type, f] of Object.entries(EVENT_FEEDBACK)) {
      expect(Boolean(f.sound || f.notice || f.none), type).toBe(true);
    }
  });
});
