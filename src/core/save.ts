// Save / load. JSON in IndexedDB with a version number and a migration chain
// (docs/02_systems_spec.md §10). This is the only core file allowed to touch browser APIs;
// the (de)serialisation half is pure and unit-tested against an in-memory store.

import { BALANCE } from '../data/balance.ts';
import { createInitialState, defaultAim, initialColony, STATE_VERSION, type GameState } from './types.ts';

export const AUTO_SLOT = 'auto';
export type SlotId = string; // 'auto' | 'slot1' | 'slot2' | 'slot3'

export interface SaveMeta {
  slot: SlotId;
  version: number;
  /** Wall-clock ms; only for sorting/display, never read by the sim. */
  savedAt: number;
  day: number;
  minute: number;
  difficulty: number;
}

export interface SaveRecord {
  meta: SaveMeta;
  /** JSON text of the packed GameState. */
  json: string;
}

export interface SaveStore {
  put(record: SaveRecord): Promise<void>;
  get(slot: SlotId): Promise<SaveRecord | undefined>;
  list(): Promise<SaveMeta[]>;
  delete(slot: SlotId): Promise<void>;
}

// ---------------------------------------------------------------------------------------------
// Pure part
// ---------------------------------------------------------------------------------------------

/**
 * Reduce the state to what must be persisted. The tactical map is regenerated from its seed on
 * load, so only the diff is kept: live zombies, corpses and bullets are dropped (cell Z / loot
 * live in world.cells; structures in build). Sessions 03/04 extend this if they need more.
 * Returns a new object; the live state is not modified.
 */
export function packState(state: GameState): GameState {
  return {
    ...state,
    // Resuming inside the pause menu would be confusing; the command layer needs no pointer lock.
    mode: state.mode === 'menu' ? 'command' : state.mode,
    // 04: after a load the zombies are placed again from the cell's Z (populated: false); bodies and their ears are gone.
    tactical: state.tactical ? { ...state.tactical, zombies: [], corpses: [], bullets: [], populated: false } : null,
    // 06: raiders on the map are not saved either; they come in again with the next waves.
    build: state.build.raid
      ? { ...state.build, raid: { ...state.build.raid, toSpawn: state.build.raid.toSpawn + (state.tactical?.zombies ?? []).reduce((n, z) => n + (z.raid && z.state !== 'down' ? 1 : 0), 0) } }
      : state.build,
  };
}

export function serialize(state: GameState): string {
  return JSON.stringify(packState(state));
}

type Migration = (old: Record<string, unknown>) => Record<string, unknown>;

/**
 * MIGRATIONS[n] upgrades a save from version n to n+1. When you change the shape of GameState:
 * bump STATE_VERSION in types.ts and add an entry here that fills in / converts the fields.
 */
const MIGRATIONS: Record<number, Migration> = {
  // 1 -> 2 (03): player.vel / eye / winded for first-person movement.
  1: (old) => {
    const player = { ...(old.player as Record<string, unknown>) };
    player.vel ??= [0, 0, 0];
    player.eye ??= 1.7;
    player.winded ??= false;
    return { ...old, player };
  },
  // 2 -> 3 (04): player.aim (scope / sway / knife timers) and carried ammunition.
  2: (old) => {
    const player = { ...(old.player as Record<string, unknown>) };
    player.aim ??= defaultAim();
    const inv = { ...(player.inv as Record<string, number> | undefined) };
    inv.ammo ??= BALANCE.player.startAmmo;
    inv.ears ??= 0;
    player.inv = inv;
    return { ...old, player };
  },
  // 3 -> 4 (05): the colony gets its market, work buffers, policy and stores; no survivors existed before.
  3: (old) => {
    const colony = { ...initialColony(), ...(old.colony as Record<string, unknown>) };
    colony.capacity = initialColony().capacity;
    colony.stock = initialColony().stock;
    colony.foodPrice = initialColony().foodPrice;
    return { ...old, colony };
  },
  // 4 -> 5 (06): raids and outposts. Older bases get their headquarters and first field when the build system next runs.
  4: (old) => {
    const build = { raid: null, pendingEars: 0, lastRaid: null, ...(old.build as Record<string, unknown>) };
    return { ...old, build };
  },
  // 5 -> 6 (09): the release baseline. Whatever 07..O1 added without a version of its own is filled
  // in from a fresh game, section by section; what the save has always wins.
  5: (old) => {
    const fresh = createInitialState(typeof old.seed === 'number' ? old.seed : 0, 1) as unknown as Record<string, Record<string, unknown>>;
    const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
    const fill = (key: string, nested: string[] = []): Record<string, unknown> => {
      const out = { ...fresh[key], ...obj(old[key]) };
      for (const n of nested) out[n] = { ...obj(fresh[key]![n]), ...obj(obj(old[key])[n]) };
      return out;
    };
    const colony = fill('colony', ['market', 'work', 'policy', 'stock', 'capacity']);
    const person = (s: unknown): unknown => ({ meals: 0, missed: 0, infectedUntil: null, unpaidDays: 0, lowMoraleDays: 0, task: null, ...obj(s) });
    for (const list of ['survivors', 'candidates']) colony[list] = Array.isArray(colony[list]) ? (colony[list] as unknown[]).map(person) : [];
    return {
      ...old,
      rngStreams: obj(old.rngStreams),
      flags: obj(old.flags),
      world: fill('world'),
      player: fill('player', ['weapon', 'stats', 'aim', 'inv']),
      colony,
      build: fill('build'),
      research: fill('research', ['allocation', 'active']),
    };
  },
};

export class SaveError extends Error {}

const RESOURCES = ['ears', 'food', 'ammo', 'wood', 'metal', 'cement', 'parts', 'medicine', 'fuel'] as const;

/**
 * 09: refuse a save that cannot be played instead of crashing somewhere in the first frame (a file
 * cut off by a full disk, hand-edited, or from a build whose shape this one does not know). Checks
 * the skeleton every system reads on its first tick — not the game rules.
 */
export function validate(state: GameState): GameState {
  const bad = (what: string): never => {
    throw new SaveError(`Save data is damaged: ${what}`);
  };
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  const num = (v: unknown, what: string): number => (typeof v === 'number' && Number.isFinite(v) ? v : bad(what));
  const s = state as unknown as Record<string, unknown>;
  for (const key of ['time', 'world', 'player', 'colony', 'build', 'research', 'flags', 'rng', 'rngStreams']) if (!isObj(s[key])) bad(key);
  num(s.seed, 'seed');
  if (![0, 1, 2].includes(s.difficulty as number)) bad('difficulty');
  if (!['tactical', 'command', 'world', 'menu'].includes(s.mode as string)) bad('mode');
  const t = state.time;
  num(t.day, 'time.day');
  if (!(num(t.minute, 'time.minute') >= 0 && t.minute < BALANCE.time.minutesPerDay)) bad('time.minute');
  num(t.sub, 'time.sub');
  const w = state.world;
  if (!isObj(w.cells)) bad('world.cells');
  const size = num(w.gridW, 'world.gridW') * num(w.gridH, 'world.gridH');
  for (const key of ['S', 'Z', 'H', 'loot', 'visited', 'intel'] as const) if (!Array.isArray(w.cells[key]) || w.cells[key].length !== size) bad(`world.cells.${key}`);
  if (!Array.isArray(w.outposts) || !Array.isArray(w.expeditions)) bad('world.outposts');
  if (w.homeCell !== null && !(num(w.homeCell, 'world.homeCell') >= 0 && w.homeCell < Math.max(1, size))) bad('world.homeCell');
  num(w.hordeMeter, 'world.hordeMeter');
  const p = state.player;
  if (!Array.isArray(p.pos) || p.pos.length !== 3 || !isObj(p.inv) || !isObj(p.weapon) || !isObj(p.stats) || !isObj(p.aim)) bad('player');
  for (const v of p.pos) num(v, 'player.pos');
  num(p.hp, 'player.hp');
  const c = state.colony;
  if (!isObj(c.stock) || !isObj(c.capacity) || !isObj(c.market) || !isObj(c.work) || !isObj(c.policy)) bad('colony');
  for (const r of RESOURCES) {
    num(c.stock[r], `colony.stock.${r}`);
    num(c.capacity[r], `colony.capacity.${r}`);
  }
  for (const key of ['survivors', 'candidates', 'ledger', 'log', 'memorial'] as const) if (!Array.isArray(c[key])) bad(`colony.${key}`);
  for (const person of [...c.survivors, ...c.candidates]) {
    if (!isObj(person) || !isObj(person.location)) bad('colony.survivors');
    num(person.id, 'survivor.id');
    num(person.hp, 'survivor.hp');
  }
  if (!Array.isArray(state.build.structures)) bad('build.structures');
  for (const st of state.build.structures) {
    if (!isObj(st) || typeof st.def !== 'string' || !isObj(st.delivered)) bad('build.structures');
    num(st.tx, 'structure.tx');
    num(st.ty, 'structure.ty');
    num(st.hp, 'structure.hp');
    num(st.progress, 'structure.progress');
  }
  const r = state.research;
  if (!Array.isArray(r.done) || !Array.isArray(r.locked) || !isObj(r.active) || !isObj(r.allocation)) bad('research');
  if (state.tactical !== null && (!isObj(state.tactical) || !Array.isArray(state.tactical.lootSpots))) bad('tactical');
  return state;
}

// 6 -> 7 (09b): ears spent on supplies today.
MIGRATIONS[6] = (old) => ({ ...old, colony: { supplyBought: 0, ...(old.colony as Record<string, unknown>) } });

export function migrate(raw: Record<string, unknown>): GameState {
  let data = raw;
  let version = typeof data.version === 'number' ? data.version : NaN;
  if (!Number.isInteger(version) || version < 1) throw new SaveError('Save data has no valid version');
  if (version > STATE_VERSION) throw new SaveError(`Save version ${version} is newer than this build (${STATE_VERSION})`);
  while (version < STATE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new SaveError(`No migration from save version ${version}`);
    data = step(data);
    version += 1;
    data.version = version;
  }
  return validate(data as unknown as GameState);
}

export function deserialize(json: string): GameState {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new SaveError('Save data is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null) throw new SaveError('Save data is not an object');
  return migrate(raw as Record<string, unknown>);
}

export async function saveGame(store: SaveStore, slot: SlotId, state: GameState, savedAt: number): Promise<SaveMeta> {
  const meta: SaveMeta = {
    slot,
    version: state.version,
    savedAt,
    day: state.time.day,
    minute: state.time.minute,
    difficulty: state.difficulty,
  };
  // Serialise synchronously (a consistent snapshot between ticks), then write asynchronously.
  const json = serialize(state);
  await store.put({ meta, json });
  return meta;
}

export async function loadGame(store: SaveStore, slot: SlotId): Promise<GameState | null> {
  const record = await store.get(slot);
  return record ? deserialize(record.json) : null;
}

/** Newest first. */
export async function listSaves(store: SaveStore): Promise<SaveMeta[]> {
  return (await store.list()).sort((a, b) => b.savedAt - a.savedAt);
}

/** In-memory store for tests and as a fallback when IndexedDB is unavailable. */
export class MemorySaveStore implements SaveStore {
  private records = new Map<SlotId, SaveRecord>();
  async put(record: SaveRecord): Promise<void> {
    this.records.set(record.meta.slot, record);
  }
  async get(slot: SlotId): Promise<SaveRecord | undefined> {
    return this.records.get(slot);
  }
  async list(): Promise<SaveMeta[]> {
    return [...this.records.values()].map((r) => r.meta);
  }
  async delete(slot: SlotId): Promise<void> {
    this.records.delete(slot);
  }
}

// ---------------------------------------------------------------------------------------------
// IndexedDB part
// ---------------------------------------------------------------------------------------------

const DB_NAME = 'zombie-sniper-survival';
const DB_VERSION = 1;
const STORE = 'saves';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export class IndexedDbSaveStore implements SaveStore {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'meta.slot' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Cannot open IndexedDB'));
      });
      this.db.catch(() => (this.db = null));
    }
    return this.db;
  }

  private async tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    const tx = db.transaction(STORE, mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    });
    const result = await request(run(tx.objectStore(STORE)));
    await done;
    return result;
  }

  async put(record: SaveRecord): Promise<void> {
    await this.tx('readwrite', (s) => s.put(record));
  }
  async get(slot: SlotId): Promise<SaveRecord | undefined> {
    return this.tx('readonly', (s) => s.get(slot) as IDBRequest<SaveRecord | undefined>);
  }
  async list(): Promise<SaveMeta[]> {
    const all = await this.tx('readonly', (s) => s.getAll() as IDBRequest<SaveRecord[]>);
    return all.map((r) => r.meta);
  }
  async delete(slot: SlotId): Promise<void> {
    await this.tx('readwrite', (s) => s.delete(slot));
  }
}

/** IndexedDB when available (browser), otherwise a volatile in-memory store. */
export function createDefaultSaveStore(): SaveStore {
  return typeof indexedDB !== 'undefined' ? new IndexedDbSaveStore() : new MemorySaveStore();
}
