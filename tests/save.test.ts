import { makeZombie } from '../src/sim/tactical/zombies.ts';
import { describe, expect, it } from 'vitest';
import {
  AUTO_SLOT, deserialize, listSaves, loadGame, MemorySaveStore, migrate, packState, SaveError, saveGame, serialize,
} from '../src/core/save.ts';
import { rand, stream } from '../src/core/rng.ts';
import { createInitialState, emptyInputFrame, STATE_VERSION, type GameState } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { createSim } from '../src/sim/index.ts';

const FIXED = BALANCE.time.fixedStep;
const input = emptyInputFrame();

function played(ticks: number): GameState {
  const sim = createSim();
  const state = createInitialState(555, 1);
  rand(state.rng);
  rand(stream(state, 'test'));
  for (let i = 0; i < ticks; i++) sim.tick(state, FIXED, input);
  return state;
}

describe('save', () => {
  it('round-trips the state exactly', () => {
    const state = played(4321);
    expect(deserialize(serialize(state))).toEqual(state);
  });

  it('round-trips through a store, keeping slots separate', async () => {
    const store = new MemorySaveStore();
    const a = played(100);
    const b = played(9000);
    await saveGame(store, AUTO_SLOT, a, 1000);
    await saveGame(store, 'slot1', b, 2000);
    expect(await loadGame(store, AUTO_SLOT)).toEqual(a);
    expect(await loadGame(store, 'slot1')).toEqual(b);
    expect(await loadGame(store, 'slot2')).toBeNull();
    const metas = await listSaves(store);
    expect(metas.map((m) => m.slot)).toEqual(['slot1', AUTO_SLOT]); // newest first
    expect(metas[0]).toMatchObject({ day: b.time.day, minute: b.time.minute, version: STATE_VERSION });
  });

  it('a loaded game continues exactly like the original', () => {
    const original = played(3000);
    const loaded = deserialize(serialize(original));
    const simA = createSim();
    const simB = createSim();
    for (let i = 0; i < 3000; i++) {
      simA.tick(original, FIXED, input);
      simB.tick(loaded, FIXED, input);
    }
    rand(stream(original, 'test'));
    rand(stream(loaded, 'test'));
    expect(loaded).toEqual(original);
  });

  it('packState drops transient tactical entities and never saves the menu mode', () => {
    const state = createInitialState(1, 1);
    state.mode = 'menu';
    state.tactical = {
      cell: 3, mapSeed: 9, reserve: 4, wind: [1, 0],
      zombies: [makeZombie(state, 'walker', 0, 0, 0, 0)],
      corpses: [{ id: 2, pos: [0, 0, 0], ears: 2, expiresDay: 91, expiresMinute: 0, kind: 'walker', yaw: 0, headshot: false, crippled: false }],
      populated: true,
      bullets: [],
      lootSpots: [{ id: 1, pos: [5, 5], taken: true }],
    };
    const packed = packState(state);
    expect(packed.mode).toBe('command');
    expect(packed.tactical).toEqual({ cell: 3, mapSeed: 9, reserve: 4, wind: [1, 0], zombies: [], corpses: [], bullets: [], lootSpots: [{ id: 1, pos: [5, 5], taken: true }], populated: false });
    expect(state.mode).toBe('menu'); // live state untouched
    expect(state.tactical?.zombies).toHaveLength(1);
  });

  it('brings a version-5 save (before the release baseline) up to date and plays on', () => {
    const state = played(600);
    // What a save from session 06 looks like: version 5, none of the fields added later.
    const old = JSON.parse(serialize(state)) as Record<string, Record<string, unknown>> & { version: number };
    old.version = 5;
    delete old.research!.progress;
    delete old.colony!.metCells;
    delete old.colony!.policy;
    delete old.world!.cacheTaken;
    delete (old.player!.aim as Record<string, unknown>).deadT;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.version).toBe(STATE_VERSION);
    expect(loaded.colony.metCells).toEqual({});
    expect(loaded.colony.policy).toEqual(createInitialState(1, 1).colony.policy);
    expect(loaded.player.aim.deadT).toBe(0);
    const sim = createSim();
    for (let i = 0; i < 600; i++) sim.tick(loaded, FIXED, input);
    expect(loaded.time.minute).toBeGreaterThan(state.time.minute);
  });

  it('brings a version-6 save up to date (09b: ears spent on supplies today)', () => {
    const old = JSON.parse(serialize(played(60))) as Record<string, Record<string, unknown>> & { version: number };
    old.version = 6;
    delete old.colony!.supplyBought;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.version).toBe(STATE_VERSION);
    expect(loaded.colony.supplyBought).toBe(0);
  });

  it('refuses a damaged save with a SaveError instead of failing later', () => {
    const good = JSON.parse(serialize(played(60))) as Record<string, unknown>;
    const broken = (change: (s: Record<string, Record<string, unknown>>) => void): string => {
      const copy = JSON.parse(JSON.stringify(good)) as Record<string, Record<string, unknown>>;
      change(copy);
      return JSON.stringify(copy);
    };
    expect(() => deserialize(JSON.stringify(good))).not.toThrow();
    expect(() => deserialize(broken((s) => delete (s as Record<string, unknown>).colony))).toThrow(SaveError);
    expect(() => deserialize(broken((s) => { s.time!.minute = 'noon'; }))).toThrow(SaveError);
    expect(() => deserialize(broken((s) => { s.time!.minute = 5000; }))).toThrow(SaveError);
    expect(() => deserialize(broken((s) => { (s.colony!.stock as Record<string, unknown>).ammo = null; }))).toThrow(SaveError);
    expect(() => deserialize(broken((s) => { (s.world!.cells as Record<string, unknown>).Z = [1, 2, 3]; }))).toThrow(SaveError);
    expect(() => deserialize(broken((s) => { s.build!.structures = [{ id: 1 }]; }))).toThrow(SaveError);
    expect(() => deserialize(broken((s) => { s.player!.pos = [0, 0]; }))).toThrow(SaveError);
    expect(() => deserialize(JSON.stringify(good).slice(0, 900))).toThrow(SaveError); // cut off while writing
    expect(() => deserialize('[]')).toThrow(SaveError);
  });

  it('rejects broken, versionless and future saves', () => {
    expect(() => deserialize('{nope')).toThrow(SaveError);
    expect(() => deserialize('null')).toThrow(SaveError);
    expect(() => migrate({ seed: 1 })).toThrow(SaveError);
    expect(() => migrate({ version: STATE_VERSION + 1 })).toThrow(SaveError);
  });
});
