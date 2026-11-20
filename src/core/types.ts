// Shared state schema — the contract between all sessions (docs/04_architecture.md §5).
// Rules: GameState must stay JSON-serialisable (no classes, Map, Set, cycles, undefined-as-data).
// Fields may be ADDED by later sessions; renames/removals must be recorded in docs/PROGRESS.md.

import { BALANCE } from '../data/balance.ts';
import { COLONY } from '../data/colony.ts';
import { TACTICAL } from '../data/tactical.ts';
import { seedRng, type RngState } from './rng.ts';

export const STATE_VERSION = 5;

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
  /** 07c: rounds already taken from the ammunition caches of a cell (cell id -> per cache index). Sparse; absent = untouched. */
  cacheTaken?: Record<string, number[]>;
  expeditions: Expedition[];
  /** `fast` (06): between the base and outposts, one cell per game hour. */
  travel: { from: CellId; to: CellId; path: CellId[]; progress: number; fast?: boolean } | null;
  hordeMeter: number;
  /** A horde on its way (06). `dir` is the bearing it comes from (radians, 0 = north, clockwise); `warned` once the colony knows. */
  pendingHorde: { arrivesDay: number; arrivesMinute: number; size: number; dir: number; warned?: boolean } | null;
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
  region: number; // index into StaticGrid.regionNames (0..7)
  pref: number; // JIS prefecture code 1..47 (index into StaticGrid.prefNames)
  hubId?: number; // index into StaticGrid.hubs
}
/** Transport hub (Shinkansen station / airport cell). `links` are hub ids. Added by 02. */
export interface Hub {
  id: number;
  name: string;
  cell: CellId;
  /** Name of the international gateway (outbreak source candidate), or null. */
  intl: string | null;
  links: number[];
}
export interface StaticGrid {
  gridW: number;
  gridH: number;
  /** Cell edge length in km (10). */
  cellKm: number;
  /** Equirectangular projection: lon = lon0 + x_km / kmPerLon, lat = latTop - y_km / kmPerLat. */
  proj: { lon0: number; latTop: number; kmPerLon: number; kmPerLat: number };
  /** Indexed by CellId; null for sea cells. */
  cells: (StaticCell | null)[];
  /** Ids of all land cells, ascending. Bundled infection data is indexed in this order. */
  landIds: CellId[];
  hubs: Hub[];
  prefNames: string[];
  regionNames: string[];
  /** Named places (largest town of a cell) for map labels. */
  places: { name: string; cell: CellId }[];
  /** Fixed crossings between landmasses (tunnels, bridges, ferries; 06). People use them, the dead do not. */
  seaLinks?: SeaLink[];
}
export interface SeaLink {
  name: string;
  a: CellId;
  b: CellId;
  /** Game minutes to cross. */
  minutes: number;
}

export interface PlayerState {
  cell: CellId;
  /** Feet position in the operation area (x east, y up, z south; metres). */
  pos: [number, number, number];
  /** Velocity in m/s (added by 03, save version 2). */
  vel: [number, number, number];
  /** Yaw 0 looks north (-z), positive turns left; pitch positive looks up (radians). */
  yaw: number;
  pitch: number;
  stance: Stance;
  /** Current eye height above pos (eases between stances; added by 03). */
  eye: number;
  hp: number;
  stamina: number;
  /** Ran out of stamina: no sprinting until it has partly recovered (added by 03). */
  winded: boolean;
  breath: number;
  infectedUntil: { day: number; minute: number } | null;
  weapon: { id: string; mag: number; zeroIdx: number; zoom: number; boltT: number; reloadT: number };
  scoped: boolean;
  inv: Partial<Record<ResourceId, number>>; // carried (ears, ammo, medicine, ...)
  stats: { kills: number; headshots: number; shots: number; earsCollected: number };
  /** Aiming / close-combat working state (added by 04, save version 3). */
  aim: AimState;
}

/** Scope, sway, recoil, knife, ear collection and death timers of the player (04). */
export interface AimState {
  /** 0 = hip, 1 = fully scoped (eases over BALANCE.combat.scope.transition). */
  scopeT: number;
  /** Clock of the sway pattern (s) and its current amplitude (mil, eased towards the target). */
  swayT: number;
  swayAmp: number;
  /** Just-moved factor 0..1 (1 while moving, decays after stopping). */
  moved: number;
  /** View offset [yaw, pitch] in radians from sway + recoil. The camera and every shot use yaw/pitch + off. */
  off: [number, number];
  recoil: [number, number];
  recoilV: [number, number];
  holding: boolean;
  /** Seconds of out-of-breath penalty left. */
  breathLock: number;
  /** Trigger was down on the previous step (shots fire on the press). */
  trigger: boolean;
  /** Seconds until the knife can swing again. */
  knifeT: number;
  /** Ear collection in progress: seconds held and the corpse it applies to. */
  interactT: number;
  interactId: EntityId | null;
  /** Highest feet height since leaving the ground (fall damage), null on the ground. */
  airPeak: number | null;
  /** Seconds since the last damage taken counts down from 1 (HUD flash). */
  hurtT: number;
  /** > 0 while dead: seconds until the provisional revival. */
  deadT: number;
}

export function defaultAim(): AimState {
  return {
    scopeT: 0, swayT: 0, swayAmp: 0, moved: 0, off: [0, 0], recoil: [0, 0], recoilV: [0, 0], holding: false,
    breathLock: 0, trigger: false, knifeT: 0, interactT: 0, interactId: null, airPeak: null, hurtT: 0, deadT: 0,
  };
}

export interface TacticalState {
  cell: CellId;
  mapSeed: number;
  zombies: Zombie[]; // max 150
  corpses: Corpse[]; // max 200
  bullets: Bullet[];
  reserve: number; // rough number of zombies that can still be spawned this visit
  wind: [number, number];
  /** 07d: `y` floor height of a search point inside a building, `table` its loot table (data/colony.ts ROOM_LOOT). */
  lootSpots: { id: number; pos: [number, number]; taken: boolean; y?: number; table?: string }[];
  /** The initial zombies of this visit have been placed (04; false again after a load). */
  populated?: boolean;
  /** Seconds until the next reinforcement from the map edge (04). */
  spawnT?: number;
  /** Fixed steps simulated in this area (staggers LOD and sight checks deterministically; 04). */
  step?: number;
  /** Firing range only: seconds each target lane has been empty (04). */
  rangeT?: number[];
  /** People hiding at search points of this area (05). `met` once the player has talked to them. */
  /** 07b: `spot` is -1 for a camp away from any building; `sure` = someone is there even if the cell's H says nobody is left (the first contact of a new game). */
  hideouts?: { spot: number; pos: [number, number]; met: boolean; sure?: boolean }[];
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
  /** State timer (s): pause / alert time left / attack wind-up / time since death. */
  t: number;
  // --- working fields of sim/tactical/zombies.ts (04). Zombies are never saved. ---
  /** Vertical speed while falling. */
  vy: number;
  /** Where it is heading: wander goal, the thing that alerted it, or the player's last known position. */
  goal: [number, number];
  /** Seconds since it last saw the player (chase). */
  lost: number;
  /** Seconds until it may attack again; stagger time left after a hit. */
  cd: number;
  flinch: number;
  /** Side-stepping around an obstacle: seconds left and the side (-1 / 1). */
  detourT: number;
  detourSide: number;
  /** Progress bookkeeping for the stuck test. */
  stuck: number;
  /** Detours taken in a row, and seconds of unhindered walking since. */
  detours: number;
  free: number;
  /** Outside staircase being climbed: building id and next waypoint, or -1. */
  stair: number;
  stairAt: number;
  /** Highest corpse id it has already reacted to. */
  corpseSeen: number;
  /** Id its body will have (allocated at death, so corpse ids ascend in order of death). */
  corpseId: number;
  /** Killed by a head shot (falls backwards). */
  headshot: boolean;
  /** Distance walked (drives the gait animation). */
  walk: number;
  /** Personal speed factor. */
  pace: number;
  /** Raider (06): heads for the base along the flow field instead of wandering. */
  raid?: boolean;
  /** Seconds it has been pressing into a moat, and the structure it is working on. */
  moatT?: number;
  /** Firing-range target: 1 stands still, 2 paces sideways; never attacks. `spot` is its lane. */
  dummy?: number;
  spot?: number;
  /** 07d: enterable building it is in (TacticalMap.placements index) and the last room it was seen in. */
  inside?: number;
  room?: number;
}
export interface Corpse {
  id: EntityId;
  pos: [number, number, number];
  ears: number;
  expiresDay: number;
  expiresMinute: number;
  // --- 04: what the body looks like ---
  kind: ZombieKind;
  yaw: number;
  headshot: boolean;
  crippled: boolean;
}
export interface Bullet {
  id: EntityId;
  pos: [number, number, number];
  vel: [number, number, number];
  pierceLeft: number;
  dmgMul: number;
  life: number;
  /** Distance flown (m), drag constant (1/m) and gravity of the round, weapon id (04). */
  dist: number;
  drag: number;
  gravity: number;
  weapon: string;
  pierceFactor: number;
  maxRange: number;
  /** Zombie hit last (not tested again while passing through it). */
  lastHit: EntityId | null;
  /** Extra factor on torso hits (07: the semi-automatic's lighter round). */
  torsoMul?: number;
}

export interface ColonyState {
  stock: Record<ResourceId, number>;
  capacity: Record<ResourceId, number>;
  survivors: Survivor[];
  candidates: Survivor[]; // hireable
  foodPrice: number;
  ledger: LedgerDay[]; // last 30 days, today's entry last
  log: LogEntry[]; // last 200 entries
  // --- added by 05 (save version 4) ---
  /** Produce the farmers have on sale; the community buys from here at foodPrice. */
  market: { food: number };
  /** Work that waits for its consumer: construction points (06), research points (07), ammunition batch and medical points. */
  work: { build: number; research: number; craft: number; medical: number };
  policy: { autoBuyFood: boolean };
  /** Food bought from the village today. */
  villageBought: number;
  /** Absolute game minute the colony has been simulated up to (-1: not started). */
  lastMinute: number;
  /** The dead. */
  memorial: { name: string; day: number; cause: string }[];
  /** Day on which the hideouts of a cell were last set up (cell id -> day). */
  metCells: Record<string, number>;
}
/**
 * One day of the ledger. Ears: income - wages - food - other = change of the ear stock.
 * `flow` holds [in, out] per other resource (out includes what was lost to full stores).
 */
export interface LedgerDay {
  day: number;
  income: number;
  wages: number;
  food: number;
  other: number;
  flow?: Partial<Record<ResourceId, [number, number]>>;
}
/**
 * `text` is a key of ui/i18n/ja.ts (the sim never formats Japanese); `params` fill its placeholders.
 * The UI translates a few parameter names: cell, land, job, trait, weapon, cause, items ("food:3|metal:1").
 */
export interface LogEntry {
  day: number;
  minute: number;
  kind: string;
  text: string;
  params?: Record<string, string | number>;
}
export interface Survivor {
  id: EntityId;
  name: string;
  ath: number;
  kno: number;
  spd: number;
  sta: number; // 1..10
  wage: number; // ears per day, may be fractional (07e: steps of 0.1)
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
  /** 07e: wage earned but not yet paid (below one whole ear); missing in older saves = 0. */
  wageOwed?: number;
  // --- added by 05 (save version 4) ---
  /** Meals eaten / missed today. */
  meals: number;
  missed: number;
  infectedUntil: { day: number; minute: number } | null;
  /** Candidates only: where they were found and the day they stop waiting. */
  fromCell?: CellId;
  waitsUntilDay?: number;
}

export interface BuildState {
  structures: Structure[]; // walls, moats, gates, towers, buildings
  gridRev: number; // +1 whenever the walkability grid changes (flow-field recompute signal)
  // --- added by 06 (save version 5) ---
  /** The attack on the base that is under way, if any. */
  raid: RaidState | null;
  /** Zombies put down near the walls whose ears are picked up in the morning (spec §4.5). */
  pendingEars: number;
  /** What the last attack did (shown when the player comes back). */
  lastRaid: RaidReport | null;
}
/** An attack on the home base (06). While the player is there the raiders are real zombies; otherwise it is resolved in numbers. */
export interface RaidState {
  kind: 'night' | 'horde';
  /** Bearing the raiders come from (radians, 0 = north, clockwise). */
  dir: number;
  size: number;
  /** Raiders that have not entered the map yet / that have been put down. */
  toSpawn: number;
  killed: number;
  /** Absolute game minute it began, and seconds until the next wave. */
  startedAbs: number;
  waveT: number;
}
export interface RaidReport {
  kind: 'night' | 'horde';
  day: number;
  minute: number;
  size: number;
  killed: number;
  wallsLost: number;
  dead: number;
  /** Resolved in numbers because the player was away. */
  away: boolean;
  repelled: boolean;
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
  // --- added by 06 ---
  /** Destroyed: rubble that stays until this absolute game minute (hp is 0, nothing collides). */
  ruinUntil?: number;
  /** Fractional wear that has not yet been reported as damage (keeps events rare). */
  wear?: number;
}

export interface ResearchState {
  era: 0 | 1 | 2 | 3;
  done: string[]; // acquired node ids
  locked: string[]; // ids made unavailable by exclusive branches
  active: Partial<Record<TechCategory, { id: string; rp: number }>>;
  allocation: Record<TechCategory, number>; // sums to 100
  // --- added by 07 ---
  /** Points already put into nodes that are not in progress right now (the player switched away). */
  progress?: Record<string, number>;
  /** Set when the nation has been declared: when, and the goal technology that names the ending. */
  victory?: { day: number; minute: number; tech: string } | null;
}

export interface Outpost {
  id: EntityId;
  cell: CellId;
  tier: 1 | 2 | 3;
  ammo: number;
  garrison: EntityId[];
  defense: number;
  // --- added by 06 ---
  foundedDay?: number;
  /** Ammunition on its way from the base: arrives on `day`. */
  convoy?: { day: number; ammo: number } | null;
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
  /** E is held down (ear collection needs a long press; added by 04). */
  interactHeld: boolean;
}

export function emptyInputFrame(): InputFrame {
  return {
    moveX: 0, moveZ: 0, lookDX: 0, lookDY: 0,
    fire: false, scope: false, holdBreath: false, sprint: false, reload: false,
    stance: null, zoomDelta: 0, zeroDelta: 0, knife: false, interact: false, interactHeld: false,
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

/** The colony of a fresh game (also used by the save migration to version 4). */
export function initialColony(): ColonyState {
  const E = COLONY.economy;
  return {
    stock: { ...zeroResources(), ...E.initialStock },
    capacity: { ...E.baseCapacity },
    survivors: [],
    candidates: [],
    foodPrice: E.foodBasePrice,
    ledger: [],
    log: [],
    market: { food: 0 },
    work: { build: 0, research: 0, craft: 0, medical: 0 },
    policy: { autoBuyFood: false },
    villageBought: 0,
    lastMinute: -1,
    memorial: [],
    metCells: {},
  };
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
      vel: [0, 0, 0],
      yaw: 0,
      pitch: 0,
      stance: 'stand',
      eye: TACTICAL.player.eyeHeight.stand,
      hp: p.hp,
      stamina: p.stamina,
      winded: false,
      breath: p.breath,
      infectedUntil: null,
      weapon: { id: p.startWeapon, mag: p.startMag, zeroIdx: 0, zoom: p.startZoom, boltT: 0, reloadT: 0 },
      scoped: false,
      inv: { ammo: p.startAmmo, ears: 0 },
      stats: { kills: 0, headshots: 0, shots: 0, earsCollected: 0 },
      aim: defaultAim(),
    },
    tactical: null,
    colony: initialColony(),
    build: { structures: [], gridRev: 0, raid: null, pendingEars: 0, lastRaid: null },
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
