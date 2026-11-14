// Shared state schema — the contract between all sessions (docs/04_architecture.md §5).
// Rules: GameState must stay JSON-serialisable (no classes, Map, Set, cycles, undefined-as-data).
// Fields may be ADDED by later sessions; renames/removals must be recorded in docs/PROGRESS.md.

import { BALANCE } from '../data/balance.ts';
import { seedRng, type RngState } from './rng.ts';

export const STATE_VERSION = 1;

export type CellId = number; // gy * gridW + gx
export type EntityId = number; // allocated from state.nextId (see allocId)
export type ResourceId = 'ears' | 'food' | 'ammo' | 'wood' | 'metal' | 'cement' | 'parts' | 'medicine' | 'fuel';
export type JobId = 'idle' | 'farming' | 'defense' | 'scavenging' | 'construction' | 'research' | 'crafting' | 'medical';
export type Land = 'urban' | 'suburb' | 'rural' | 'forest' | 'mountain';
export type ZombieKind = 'walker' | 'runner' | 'brute' | 'crawler';
export type TechCategory = 'F' | 'W' | 'A' | 'S' | 'C';
export type Difficulty = 0 | 1 | 2;
export type Speed = 0 | 1 | 3 | 10;
export type Mode = 'tactical' | 'command' | 'world' | 'menu';
export type Stance = 'stand' | 'crouch' | 'prone';

export const RESOURCE_IDS: readonly ResourceId[] = ['ears', 'food', 'ammo', 'wood', 'metal', 'cement', 'parts', 'medicine', 'fuel'];
export const TECH_CATEGORIES: readonly TechCategory[] = ['F', 'W', 'A', 'S', 'C'];

export interface GameState {
  version: number;
  seed: number;
  /** Main PRNG stream. Use core/rng.ts; prefer `stream(state, label)` for per-system streams. */
  rng: RngState;
  /** Lazily created per-purpose PRNG streams (see rng.ts `stream`). Added by 01. */
  rngStreams: Record<string, RngState>;
  nextId: EntityId;
  difficulty: Difficulty;
  /**
   * day: days since the outbreak. minute: integer 0..1439.
   * sub: fraction [0,1) of the current game minute (added by 01 so that time is exact across save/load).
   * speed: what the main loop multiplies real time by; `tick` itself always advances by its dt.
   */
  time: { day: number; minute: number; sub: number; speed: Speed };
  mode: Mode;
  world: WorldState;
  player: PlayerState;
  tactical: TacticalState | null; // operation area of the current cell (only a diff is saved)
  colony: ColonyState;
  build: BuildState; // structures of the home base
  research: ResearchState;
  flags: Record<string, boolean | number>; // tutorial, victory, ...
}

export interface WorldState {
  scenario: number; // bundled infection scenario index
  gridW: number;
  gridH: number;
  cells: {
    // struct of arrays (length = gridW*gridH, sea cells have Z = -1)
    S: number[];
    Z: number[];
    H: number[];
    loot: number[];
    visited: boolean[];
    intel: number[]; // 0 unknown / 1 rough / 2 detailed
  };
  homeCell: CellId | null;
  outposts: Outpost[];
  expeditions: Expedition[];
  travel: { from: CellId; to: CellId; path: CellId[]; progress: number } | null;
  hordeMeter: number;
  pendingHorde: { arrivesDay: number; arrivesMinute: number; size: number; dir: number } | null;
}

// Static per-cell data is NOT part of GameState. It is loaded from public/data/grid.json
// and handed to the sim via createSim({ grid }) / sim.setGrid(). Session 02 owns the exact shape
// (fields below follow docs/02_systems_spec.md §2.1 and may be extended).
export interface StaticCell {
  id: CellId;
  gx: number;
  gy: number;
  lat: number;
  lon: number;
  pop0: number;
  land: Land;
  coastal: boolean;
  region: number;
  pref: number;
  hubId?: number;
}
export interface StaticGrid {
  gridW: number;
  gridH: number;
  /** Indexed by CellId; null for sea cells. */
  cells: (StaticCell | null)[];
}

export interface PlayerState {
  cell: CellId;
  pos: [number, number, number];
  yaw: number;
  pitch: number;
  stance: Stance;
  hp: number;
  stamina: number;
  breath: number;
  infectedUntil: { day: number; minute: number } | null;
  weapon: { id: string; mag: number; zeroIdx: number; zoom: number; boltT: number; reloadT: number };
  scoped: boolean;
  inv: Partial<Record<ResourceId, number>>; // carried (ears, ammo, medicine, ...)
  stats: { kills: number; headshots: number; shots: number; earsCollected: number };
}

export interface TacticalState {
  cell: CellId;
  mapSeed: number;
  zombies: Zombie[]; // max 150
  corpses: Corpse[]; // max 200
  bullets: Bullet[];
  reserve: number; // rough number of zombies that can still be spawned this visit
  wind: [number, number];
  lootSpots: { id: number; pos: [number, number]; taken: boolean }[];
}
export interface Zombie {
  id: EntityId;
  kind: ZombieKind;
  pos: [number, number, number];
  yaw: number;
  hp: number;
  state: 'wander' | 'alert' | 'chase' | 'attack' | 'down';
  target: EntityId | 'player' | null;
  crippled: boolean;
  t: number;
}
export interface Corpse {
  id: EntityId;
  pos: [number, number, number];
  ears: number;
  expiresDay: number;
  expiresMinute: number;
}
export interface Bullet {
  id: EntityId;
  pos: [number, number, number];
  vel: [number, number, number];
  pierceLeft: number;
  dmgMul: number;
  life: number;
}

export interface ColonyState {
  stock: Record<ResourceId, number>;
  capacity: Record<ResourceId, number>;
  survivors: Survivor[];
  candidates: Survivor[]; // hireable
  foodPrice: number;
  ledger: { day: number; income: number; wages: number; food: number; other: number }[]; // last 30 days
  log: { day: number; minute: number; kind: string; text: string }[]; // last 200 entries
}
export interface Survivor {
  id: EntityId;
  name: string;
  ath: number;
  kno: number;
  spd: number;
  sta: number; // 1..10
  wage: number;
  trait: string;
  job: JobId;
  morale: number;
  hp: number;
  status: 'ok' | 'injured' | 'infected' | 'away' | 'dead';
  weapon: string; // id in data/weapons.ts
  location: { kind: 'home' } | { kind: 'outpost'; id: EntityId } | { kind: 'expedition'; id: EntityId };
  // For drawing / behaviour inside the base (only valid when location.kind === 'home')
  pos: [number, number];
  task: { kind: string; target: EntityId | null; t: number } | null;
  unpaidDays: number;
  lowMoraleDays: number;
}

export interface BuildState {
  structures: Structure[]; // walls, moats, gates, towers, buildings
  gridRev: number; // +1 whenever the walkability grid changes (flow-field recompute signal)
}
export interface Structure {
  id: EntityId;
  def: string; // id in data/buildings.ts
  tx: number;
  ty: number;
  rot: 0 | 1 | 2 | 3; // 4 m tile coordinates
  hp: number;
  progress: number; // < 1 means under construction (blueprint)
  delivered: Partial<Record<ResourceId, number>>;
  corpsesInMoat?: number;
  level: number;
  priority: 0 | 1 | 2;
}

export interface ResearchState {
  era: 0 | 1 | 2 | 3;
  done: string[]; // acquired node ids
  locked: string[]; // ids made unavailable by exclusive branches
  active: Partial<Record<TechCategory, { id: string; rp: number }>>;
  allocation: Record<TechCategory, number>; // sums to 100
}

export interface Outpost {
  id: EntityId;
  cell: CellId;
  tier: 1 | 2 | 3;
  ammo: number;
  garrison: EntityId[];
  defense: number;
}
export interface Expedition {
  id: EntityId;
  members: EntityId[];
  target: CellId;
  from: CellId;
  weapon: string;
  departDay: number;
  departMinute: number;
  returnDay: number;
  returnMinute: number;
  resolved: boolean;
}

/** Real-time player controls, sampled by input/ and handed to every sim step (not a Command). */
export interface InputFrame {
  moveX: number; // -1..1 (right +)
  moveZ: number; // -1..1 (forward +)
  lookDX: number; // radians-agnostic raw mouse delta (px); one-shot, see continuationFrame()
  lookDY: number;
  fire: boolean;
  scope: boolean;
  holdBreath: boolean;
  sprint: boolean;
  reload: boolean; // one-shot
  stance: Stance | null; // one-shot request
  zoomDelta: number; // one-shot
  zeroDelta: number; // one-shot
  knife: boolean; // one-shot
  interact: boolean; // one-shot
}

export function emptyInputFrame(): InputFrame {
  return {
    moveX: 0, moveZ: 0, lookDX: 0, lookDY: 0,
    fire: false, scope: false, holdBreath: false, sprint: false, reload: false,
    stance: null, zoomDelta: 0, zeroDelta: 0, knife: false, interact: false,
  };
}

/**
 * When several sim steps run in one rendered frame, only the first step receives the one-shot
 * parts (deltas / presses); later steps get this copy with held controls only.
 */
export function continuationFrame(f: InputFrame): InputFrame {
  return { ...f, lookDX: 0, lookDY: 0, reload: false, stance: null, zoomDelta: 0, zeroDelta: 0, knife: false, interact: false };
}

function zeroResources(): Record<ResourceId, number> {
  return { ears: 0, food: 0, ammo: 0, wood: 0, metal: 0, cement: 0, parts: 0, medicine: 0, fuel: 0 };
}

/** Allocate a unique entity id. */
export function allocId(state: GameState): EntityId {
  return state.nextId++;
}

/**
 * A fresh game. World cells are empty until session 02 fills them from a bundled scenario;
 * `tactical` is null until session 03 generates the operation area.
 */
export function createInitialState(seed: number, difficulty: Difficulty): GameState {
  const t = BALANCE.time;
  const p = BALANCE.player;
  return {
    version: STATE_VERSION,
    seed: seed >>> 0,
    rng: seedRng(seed),
    rngStreams: {},
    nextId: 1,
    difficulty,
    time: { day: t.startDay, minute: t.startMinute, sub: 0, speed: 1 },
    mode: 'tactical',
    world: {
      scenario: 0,
      gridW: 0,
      gridH: 0,
      cells: { S: [], Z: [], H: [], loot: [], visited: [], intel: [] },
      homeCell: null,
      outposts: [],
      expeditions: [],
      travel: null,
      hordeMeter: 0,
      pendingHorde: null,
    },
    player: {
      cell: 0,
      pos: [0, 0, 0],
      yaw: 0,
      pitch: 0,
      stance: 'stand',
      hp: p.hp,
      stamina: p.stamina,
      breath: p.breath,
      infectedUntil: null,
      weapon: { id: p.startWeapon, mag: p.startMag, zeroIdx: 0, zoom: p.startZoom, boltT: 0, reloadT: 0 },
      scoped: false,
      inv: {},
      stats: { kills: 0, headshots: 0, shots: 0, earsCollected: 0 },
    },
    tactical: null,
    colony: {
      stock: zeroResources(),
      capacity: zeroResources(),
      survivors: [],
      candidates: [],
      foodPrice: 1,
      ledger: [],
      log: [],
    },
    build: { structures: [], gridRev: 0 },
    research: {
      era: 0,
      done: [],
      locked: [],
      active: {},
      allocation: { ...BALANCE.research.defaultAllocation },
    },
    flags: {},
  };
}
