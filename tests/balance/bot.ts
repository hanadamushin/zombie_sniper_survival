// Headless playthrough bots (09 balance). A bot plays a whole game through the simulation's own
// commands, one tick per game minute, without the tactical map:
//   - the colony, construction, research, raids, the world and its infection are the real systems;
//   - the player's rifle is a statistical model (`Skill`): engagements per game hour, hit and
//     head-shot rates, ears picked up, a risk of dying that grows with the danger of the cell;
//   - raids are fought by the game's own battle in numbers (sim/build/raids.ts resolveAway), which
//     the modelled player joins through `awayPlayer.gun`.
// A bot keeps no memory of its own: everything it decides follows from the GameState (its few
// notes live in state.flags under `bot.*`, its dice in the `bot` random stream), so a game that
// is saved, loaded and continued must come out exactly like one played in one go.

import { chance, rand, stream } from '../../src/core/rng.ts';
import type { GameEvent } from '../../src/core/events.ts';
import { emptyInputFrame, type CellId, type GameState, type JobId, type ResourceId, type StaticGrid, type Survivor, type TechCategory } from '../../src/core/types.ts';
import { BALANCE } from '../../src/data/balance.ts';
import { BUILD, BUILDINGS, footprint } from '../../src/data/buildings.ts';
import { COLONY, EXPEDITION_WEAPONS, LOOT_TABLE } from '../../src/data/colony.ts';
import { TECHS } from '../../src/data/techs.ts';
import { ZOMBIES } from '../../src/data/zombies.ts';
import { cacheAmmo } from '../../src/gen/caches.ts';
import { mapSeedFor } from '../../src/gen/index.ts';
import { placementError } from '../../src/sim/build/blueprints.ts';
import { awayPlayer, hordeThreshold } from '../../src/sim/build/raids.ts';
import { bedsTotal, isBuilt, isRuin, isUnlocked, plotInfo } from '../../src/sim/build/structures.ts';
import { foodNeedPerDay } from '../../src/sim/colony/economy.ts';
import { expeditionAmmo, expeditionTargets, weaponAvailable } from '../../src/sim/colony/expeditions.ts';
import { aptitude } from '../../src/sim/colony/jobs.ts';
import { lootYield } from '../../src/sim/colony/loot.ts';
import { ctxNow } from '../../src/sim/colony/stock.ts';
import { addCandidates, hideoutGroup, isFit, populationCap, signingFee, statSum } from '../../src/sim/colony/survivors.ts';
import { createSim, SYSTEMS, type Sim } from '../../src/sim/index.ts';
import { startError } from '../../src/sim/research/index.ts';
import { techDone } from '../../src/sim/research/modifiers.ts';
import { victoryProgress } from '../../src/sim/research/victory.ts';
import { weaponOf } from '../../src/sim/tactical/weapon.ts';
import { cellTactical, dangerOf, isCleared, kindMix, removeZombies } from '../../src/sim/world/derive.ts';
import { cellDistance, cellsWithin } from '../../src/sim/world/grid.ts';
import { foundError } from '../../src/sim/world/outposts.ts';
import { findRoute } from '../../src/sim/world/travel.ts';

/** How well the modelled player shoots. One game hour is one real minute at x1. */
export interface Skill {
  /** Zombies taken on per game hour of hunting when the area is full of them. */
  perHour: number;
  /** Chance that a round hits, and that a hit is a head shot. */
  hit: number;
  head: number;
  /** Rounds spent on one zombie before giving up on it. */
  maxShots: number;
  /** Share of the bodies whose ears are picked up. */
  collect: number;
  /** Chance per hunting hour of being killed in a cell of danger 1. */
  risk: number;
  /** Shoots the pouch empty by day instead of keeping rounds for the night. */
  wasteful?: boolean;
}

export const SKILLS = {
  /** Takes the time to aim: few rounds, most of them in the head. */
  careful: { perHour: 4, hit: 0.8, head: 0.6, maxShots: 3, collect: 0.85, risk: 0.012 },
  average: { perHour: 5, hit: 0.65, head: 0.4, maxShots: 4, collect: 0.8, risk: 0.02 },
  /** Fires at whatever moves. */
  sloppy: { perHour: 7, hit: 0.4, head: 0.2, maxShots: 6, collect: 0.6, risk: 0.035, wasteful: true },
  expert: { perHour: 7, hit: 0.88, head: 0.75, maxShots: 3, collect: 0.9, risk: 0.008 },
} as const satisfies Record<string, Skill>;

export type Branch = 'a' | 'b';
export type BranchId = 'F4' | 'F7' | 'W5' | 'W6' | 'A4' | 'A6' | 'S5' | 'C4' | 'C6';

export interface Policy {
  id: string;
  skill: Skill;
  /** Game hours a day spent shooting, and buildings searched a day. */
  huntHours: number;
  searchPerDay: number;
  /** People wanted on game day d (0 = the first day). */
  pop(d: number): number;
  /** Shares of the people by job; what is left goes scavenging. */
  jobs: { farming: number; construction: number; research: number; defense: number; crafting: number };
  /** Fence round the headquarters from this day on (-1: never), the outer ring, towers, a moat. */
  keepDay: number;
  outerDay: number;
  towers: number;
  /** Scavenging parties of this size (0: none) and the danger they accept. */
  party: number;
  partyDanger: number;
  /** Outposts wanted on day d; hunting trips to the neighbours when the home cell runs dry. */
  outposts(d: number): number;
  roam: boolean;
  research: boolean;
  branch: Record<BranchId, Branch>;
  /** Does next to nothing (the neglect bot): no building, no research, no orders after the first hires. */
  idle?: boolean;
}

export const BRANCH_A: Record<BranchId, Branch> = { F4: 'a', F7: 'a', W5: 'a', W6: 'a', A4: 'a', A6: 'a', S5: 'a', C4: 'a', C6: 'a' };

const B = (p: Policy, id: BranchId): string => `${id}${p.branch[id]}`;
/** Research order: within an era the list is worked through per category, the goal is C9 (the only one every branch can reach). */
function techOrder(p: Policy): string[] {
  return [
    'A1', 'F1', 'C1', 'W1', 'S1', 'F2', 'A2', 'W2', 'C2', 'S2',
    'S3', 'C3', 'F3', 'A3', 'W4', 'S4', 'W3', B(p, 'C4'), B(p, 'A4'), B(p, 'S5'), B(p, 'F4'), B(p, 'W5'),
    'C5', 'F5', 'A5', 'C7', B(p, 'C6'), p.branch.S5 === 'a' ? 'S6a' : 'S6b', B(p, 'A6'), B(p, 'F7'), B(p, 'W6'),
    'C8', 'C9', 'W7', p.branch.S5 === 'a' ? 'S7a' : 'S7b', p.branch.F4 === 'a' ? 'F6a' : 'F6b', 'A7', 'S8', 'F8', 'W8', 'A8', 'F9', 'S9', 'W9',
  ];
}

export interface Milestones {
  firstHire: number | null;
  /** First raid that broke something or killed someone, and the first night the headquarters itself was damaged. */
  firstLoss: number | null;
  firstHqHit: number | null;
  era: (number | null)[];
  victory: number | null;
  defeat: number | null;
  defeatReason: string;
  /** Days on which the player stood without a round at some hour of the hunt. */
  dryDays: number;
  firstDry: number | null;
  playerDeaths: number;
  raids: number;
  hordes: number;
  wallsLost: number;
  dead: number;
  deserted: number;
  outpostsLost: number;
  inflow: number;
}

export interface Game {
  state: GameState;
  sim: Sim;
  grid: StaticGrid;
  policy: Policy;
  m: Milestones;
  rows: Record<string, number | string>[];
  /** Ears earned by the rifle per day (for the income curve), kills per day. */
  today: { ears: number; kills: number; shots: number; dry: boolean };
}

const START = BALANCE.time.startDay;
const idle = emptyInputFrame();
const dayOf = (state: GameState): number => state.time.day - START;
const flag = (state: GameState, key: string): number => Number(state.flags[`bot.${key}`] ?? 0);
const setFlag = (state: GameState, key: string, v: number): void => {
  if (v === 0) delete state.flags[`bot.${key}`];
  else state.flags[`bot.${key}`] = v;
};

/** The headless system list: everything but the tactical layer. */
export const HEADLESS = SYSTEMS.filter((s) => s.id !== 'tactical');

export function attach(state: GameState, grid: StaticGrid, policy: Policy): Game {
  const sim = createSim({ grid, systems: HEADLESS, warn: () => {} });
  const g: Game = {
    state, sim, grid, policy, rows: [],
    m: { firstHire: null, firstLoss: null, firstHqHit: null, era: [0, null, null, null], victory: null, defeat: null, defeatReason: '', dryDays: 0, firstDry: null, playerDeaths: 0, raids: 0, hordes: 0, wallsLost: 0, dead: 0, deserted: 0, outpostsLost: 0, inflow: 0 },
    today: { ears: 0, kills: 0, shots: 0, dry: false },
  };
  sim.events.onAny((e: GameEvent) => onEvent(g, e));
  return g;
}

function onEvent(g: Game, e: GameEvent): void {
  const m = g.m;
  const d = dayOf(g.state);
  switch (e.type) {
    case 'survivorHired': m.firstHire ??= d; break;
    case 'raidEnded': {
      m.raids++;
      if (e.kind === 'horde') m.hordes++;
      const r = g.state.build.lastRaid;
      if (r) {
        m.wallsLost += r.wallsLost;
        if (r.wallsLost > 0 || r.dead > 0) m.firstLoss ??= d;
      }
      break;
    }
    case 'structureDamaged': if (g.state.build.structures.find((s) => s.id === e.id)?.def === 'hq') m.firstHqHit ??= d; break;
    case 'survivorDied': m.dead++; break;
    case 'survivorLeft': if (e.reason === 'deserted') m.deserted++; break;
    case 'eraAdvanced': m.era[e.era] = d; break;
    case 'victory': m.victory = d; break;
    case 'defeat': m.defeat = d; m.defeatReason = e.reason; break;
    case 'outpostLost': m.outpostsLost++; break;
    case 'infectionStepped': m.inflow += e.homeInflow; break;
    case 'playerRevived': m.playerDeaths++; break;
  }
}

// ---------------------------------------------------------------------------------------------
// The player's rifle
// ---------------------------------------------------------------------------------------------

/** Zombies on the map before the hunt gets slower for want of targets. */
const FULL_MAP = 150;
/** Seconds of an engagement that are not the bolt (finding, aiming); in a raid they walk straight at the muzzle. */
const AIM_SECONDS = 6;
const RAID_AIM_SECONDS = 3;
/** Rounds a player who thinks ahead keeps for the night instead of spending them on the day's hunt. */
const NIGHT_RESERVE = 25;

function shotsPerZombie(g: Game, brute: boolean): { shots: number; killed: boolean } {
  const { state, policy } = g;
  const rng = stream(state, 'bot');
  const w = weaponOf(state);
  const def = brute ? ZOMBIES.brute : ZOMBIES.walker;
  let hp = def.hp;
  let shots = 0;
  while (shots < policy.skill.maxShots * (brute ? 3 : 1)) {
    shots++;
    if (!chance(rng, policy.skill.hit)) continue;
    hp -= chance(rng, policy.skill.head) ? def.head * w.damageMul : def.torso * w.damageMul * w.torsoMul;
    if (hp <= 0) return { shots, killed: true };
  }
  return { shots, killed: false };
}

function carried(state: GameState): number {
  return state.player.inv.ammo ?? 0;
}

/** Take what fits from a cache of the cell the player is in. Returns the rounds taken. */
function takeCache(g: Game): number {
  const { state, grid } = g;
  const cell = state.player.cell;
  const info = grid.cells[cell];
  if (!info) return 0;
  const all = cacheAmmo(mapSeedFor(state.seed, cell), info.land);
  const taken = ((state.world.cacheTaken ??= {})[String(cell)] ??= []);
  for (let i = 0; i < all.length; i++) {
    while (taken.length <= i) taken.push(0);
    const left = all[i]! - taken[i]!;
    const room = BALANCE.player.maxAmmo - carried(state);
    if (left <= 0 || room <= 0) continue;
    const got = Math.min(left, room);
    taken[i] = taken[i]! + got;
    state.player.inv.ammo = carried(state) + got;
    return got;
  }
  return 0;
}

function cachesIn(g: Game, cell: CellId): number {
  const info = g.grid.cells[cell];
  if (!info) return 0;
  const taken = g.state.world.cacheTaken?.[String(cell)] ?? [];
  return cacheAmmo(mapSeedFor(g.state.seed, cell), info.land).reduce((s, a, i) => s + Math.max(0, a - (taken[i] ?? 0)), 0);
}

const atHome = (state: GameState): boolean => state.player.cell === state.world.homeCell && !state.world.travel;

/** One game hour of shooting where the player stands. */
function huntHour(g: Game): void {
  const { state, grid, policy } = g;
  const rng = stream(state, 'bot');
  const cell = state.player.cell;
  const ct = cellTactical(state, grid, cell);
  if (!ct) return;
  const w = weaponOf(state);
  const perShot = Math.max(1, Math.round(w.ammoPerShot));
  // Rounds: from the stores at home, from a cache otherwise (an hour's walk either way is not counted).
  if (carried(state) < perShot * 4) {
    if (atHome(state) && state.colony.stock.ammo >= 1) g.sim.dispatch({ type: 'resupply' });
    else if (takeCache(g) > 0) return; // the hour went into the walk to the cache
    g.sim.applyCommands(state);
  }
  // Short of rounds: the careful keep some for the night (and for the horde that is building up)
  // and spend the hour searching instead. With ears enough for the coming days there is no reason
  // to spend rounds either — except on a trip that is there to clear a cell.
  const total = carried(state) + (atHome(state) ? state.colony.stock.ammo : 0);
  if (total < perShot * 4) g.today.dry = true;
  if (!policy.skill.wasteful && (total <= ammoReserve(g) || (!earsWanted(g) && flag(state, 'trip') !== TRIP_OUTPOST))) {
    searchSpot(g);
    return;
  }
  const onMap = Math.min(ct.z, ct.active);
  const pace = (AIM_SECONDS + BALANCE.combat.ears.seconds + 1.2) / (AIM_SECONDS + BALANCE.combat.ears.seconds + w.boltTime);
  const want = policy.skill.perHour * pace * Math.min(1, onMap / FULL_MAP);
  let n = Math.floor(want) + (chance(rng, want - Math.floor(want)) ? 1 : 0);
  const bruteShare = kindMix(ct.land).brute;
  let kills = 0;
  let knife = false;
  for (; n > 0; n--) {
    if (carried(state) < perShot) {
      // No rounds: the knife, one at a time, when one comes close.
      knife = true;
      if (chance(rng, 0.35)) kills++;
      break;
    }
    const r = shotsPerZombie(g, chance(rng, bruteShare));
    const spent = Math.min(carried(state), r.shots * perShot);
    state.player.inv.ammo = carried(state) - spent;
    state.player.stats.shots += r.shots;
    g.today.shots += r.shots;
    if (r.killed && spent >= r.shots * perShot) kills++;
  }
  kills = removeZombies(state, cell, kills);
  if (kills > 0) {
    const ears = Math.round(kills * BALANCE.combat.ears.perCorpse * policy.skill.collect);
    state.player.inv.ears = (state.player.inv.ears ?? 0) + ears;
    state.player.stats.kills += kills;
    state.player.stats.earsCollected += ears;
    g.today.ears += ears;
    g.today.kills += kills;
  }
  if (chance(rng, policy.skill.risk * ct.danger * (knife ? 3 : 1) * (onMap > 0 ? 1 : 0))) state.player.aim.deadT = 0.001; // colony/morale.ts takes it from here
}

/** Rounds kept back: the night's visitors, and a horde once its meter is half full. */
function ammoReserve(g: Game): number {
  const { state } = g;
  const share = state.world.hordeMeter / hordeThreshold(state);
  return NIGHT_RESERVE + (state.world.pendingHorde || share > 0.5 ? 120 : 0);
}

/** Whether the colony needs more ears than it has: a week of wages, the fees of who is waiting, an outpost. */
function earsWanted(g: Game): boolean {
  const { state, policy } = g;
  const colony = state.colony;
  const have = colony.stock.ears + (state.player.inv.ears ?? 0);
  let want = 20 + wagesPerDay(state) * 7;
  if (colony.survivors.length < policy.pop(dayOf(state))) want += 12;
  if (state.world.outposts.length < policy.outposts(dayOf(state))) want += BUILD.outpost.tiers[0].ears;
  return have < want;
}

/** The player's part in a raid fought in numbers: one aimed round every few seconds from the roof of the headquarters. */
function raidGun(g: Game): (state: GameState, seconds: number, alive: number) => number {
  return (state, seconds) => {
    if (state !== g.state || !atHome(state) || state.flags.skipping === true || state.flags.defeat) return 0;
    const w = weaponOf(state);
    const perShot = Math.max(1, Math.round(w.ammoPerShot));
    const k = g.policy.skill;
    // Whole rounds only; the fractions wait in the state (a bot remembers nothing by itself).
    const due = flag(state, 'shotCarry') + seconds / (RAID_AIM_SECONDS + w.boltTime);
    const shots = Math.min(Math.floor(carried(state) / perShot), Math.floor(due));
    setFlag(state, 'shotCarry', shots > 0 ? due - shots : Math.min(due, 1));
    if (shots <= 0) return 0;
    // A walker falls to a head shot, or to two in the body (one with the large calibre).
    const body = ZOMBIES.walker.torso * w.damageMul * w.torsoMul >= ZOMBIES.walker.hp ? 1 : 0.5;
    const carry = flag(state, 'killCarry') + shots * k.hit * (k.head + (1 - k.head) * body) * 0.8; // night
    state.player.inv.ammo = carried(state) - shots * perShot;
    state.player.stats.shots += shots;
    g.today.shots += shots;
    const kills = Math.floor(carry);
    setFlag(state, 'killCarry', carry - kills);
    if (kills > 0) {
      const ears = Math.round(kills * BALANCE.combat.ears.perCorpse * k.collect);
      state.player.inv.ears = (state.player.inv.ears ?? 0) + ears;
      state.player.stats.kills += kills;
      g.today.ears += ears;
      g.today.kills += kills;
    }
    return kills;
  };
}

/** Search one building of the cell the player is in (the land table; rooms differ, the sum is close). */
function searchSpot(g: Game): void {
  const { state, grid } = g;
  const cell = state.player.cell;
  const land = grid.cells[cell]?.land;
  const cells = state.world.cells;
  if (!land || (cells.loot[cell] ?? 0) * BALANCE.world.lootSpots[land] < 1) return;
  const rng = stream(state, 'bot');
  for (const [res, expected] of lootYield(land, COLONY.search.points)) {
    const x = expected * (COLONY.search.spread[0] + rand(rng) * (COLONY.search.spread[1] - COLONY.search.spread[0]));
    const n = Math.floor(x) + (rand(rng) < x - Math.floor(x) ? 1 : 0);
    if (n > 0) state.player.inv[res] = (state.player.inv[res] ?? 0) + n;
  }
  cells.loot[cell] = Math.max(0, (cells.loot[cell] ?? 0) - 1 / BALANCE.world.lootSpots[land]);
}

/** People hiding in the cell the player hunts in (colony/encounters.ts ensureHideouts, without the map). */
function meetPeople(g: Game): void {
  const { state, grid } = g;
  const cell = state.player.cell;
  const key = String(cell);
  const E = COLONY.encounter;
  const first = cell === state.world.homeCell && !state.flags.firstContact;
  const last = state.colony.metCells[key];
  if (!first && last !== undefined && state.time.day - last < E.cooldownDays) return;
  const H = state.world.cells.H;
  if (first) {
    state.flags.firstContact = true;
    if ((H[cell] ?? 0) < 1) H[cell] = 1;
  }
  const want = Math.min(E.maxPerArea, Math.max(first ? 1 : 0, Math.round(Math.log10(1 + Math.max(0, H[cell] ?? 0)))));
  state.colony.metCells[key] = state.time.day;
  const rng = stream(state, 'bot');
  const c = ctxNow(state, grid, (e) => g.sim.events.emit(e));
  // Not every hideout is reached on the day (they are a walk away, and the dead are in between).
  for (let i = 0; i < want; i++) if (first || chance(rng, 0.7)) addCandidates(c, cell, hideoutGroup(state), 'player');
}

// ---------------------------------------------------------------------------------------------
// The colony's orders
// ---------------------------------------------------------------------------------------------

const wagesPerDay = (state: GameState): number => state.colony.survivors.reduce((s, x) => s + (x.job === 'farming' ? 0 : x.wage), 0);

function hirePeople(g: Game): void {
  const { state, policy } = g;
  const colony = state.colony;
  const d = dayOf(state);
  const target = Math.min(policy.pop(d), populationCap(state));
  if (policy.idle && d > 3) return;
  const list = [...colony.candidates].sort((a, b) => statSum(b) / b.wage - statSum(a) / a.wage || a.id - b.id);
  for (const s of list) {
    if (colony.survivors.length >= target) break;
    const fee = signingFee(s, state);
    const purse = colony.stock.ears + (atHome(state) ? state.player.inv.ears ?? 0 : 0);
    // Three days of everyone's wages stay in the box.
    if (purse < fee + (wagesPerDay(state) + s.wage) * 3) continue;
    g.sim.dispatch({ type: 'hire', candidate: s.id });
    g.sim.applyCommands(state);
  }
}

function pendingBlueprints(state: GameState): number {
  return state.build.structures.reduce((n, s) => n + (s.progress < 1 ? 1 : 0), 0);
}

/** Everything for the declaration is in place except the materials of the capitol: nothing else may eat them. */
function capitolWaits(g: Game): boolean {
  const vp = victoryProgress(g.state, g.grid);
  return vp.ready && vp.canBuild && !vp.capitol && !g.state.build.structures.some((s) => s.def === 'capitol' && s.progress >= 1);
}

function assignJobs(g: Game): void {
  const { state, policy } = g;
  const people = state.colony.survivors.filter((s) => s.location.kind === 'home' && s.status !== 'dead');
  const n = people.length;
  if (n === 0) return;
  const want: Partial<Record<JobId, number>> = {};
  const plots = plotInfo(state).plots;
  if (policy.idle) {
    want.farming = Math.min(2, n);
  } else {
    const damaged = state.build.structures.some((s) => isBuilt(s) && BUILDINGS[s.def]!.hp > 0 && s.hp < BUILDINGS[s.def]!.hp * 0.9);
    want.farming = Math.min(Math.round(plots * COLONY.farm.workersPerPlot), Math.max(1, Math.round(n * policy.jobs.farming)));
    want.construction = pendingBlueprints(state) > 0 || damaged ? Math.max(1, Math.round(n * policy.jobs.construction)) : 0;
    want.research = policy.research ? (n >= 2 ? Math.max(n >= 5 ? 2 : 1, Math.round(n * policy.jobs.research)) : 0) : 0;
    want.defense = n >= 4 ? Math.round(n * policy.jobs.defense) : 0;
    // Ammunition is made while the stores are short of it — not from the metal a blueprint is waiting for.
    const owe = owed(state);
    const ammoGoal = Math.min(state.colony.capacity.ammo * 0.8, 300 + n * 5);
    const canCraft = state.colony.stock.metal - (owe.metal ?? 0) >= 2 && state.colony.stock.parts >= 0.4 && state.colony.stock.ammo < ammoGoal && !capitolWaits(g);
    want.crafting = canCraft ? Math.max(n >= 3 ? 1 : 0, Math.round(n * policy.jobs.crafting)) : 0;
    want.medical = techDone(state, 'S4') && people.some((s) => s.status === 'injured' || s.status === 'infected') ? 1 : 0;
  }
  const free = new Set(people);
  const set = (s: Survivor, job: JobId): void => {
    free.delete(s);
    if (s.job !== job) g.sim.dispatch({ type: 'assignJob', survivor: s.id, job });
  };
  for (const job of ['farming', 'research', 'construction', 'defense', 'crafting', 'medical'] as const) {
    for (let k = want[job] ?? 0; k > 0 && free.size > 0; k--) {
      let best: Survivor | null = null;
      for (const s of free) if (!best || aptitude(s, job) > aptitude(best, job) || (aptitude(s, job) === aptitude(best, job) && s.id < best.id)) best = s;
      set(best!, job);
    }
  }
  for (const s of [...free]) set(s, policy.idle ? 'idle' : 'scavenging');
  g.sim.applyCommands(state);
}

// --- building -----------------------------------------------------------------------------------

const HQ = BUILD.start.hq;
const CX = HQ[0] + 1;
const CY = HQ[1] + 1;
const KEEP = 3;
const OUTER = 14;
const ringTiles = (half: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let x = CX - half; x <= CX + half; x++) out.push([x, CY - half]);
  for (let y = CY - half + 1; y <= CY + half; y++) out.push([CX + half, y]);
  for (let x = CX + half - 1; x >= CX - half; x--) out.push([x, CY + half]);
  for (let y = CY + half - 1; y > CY - half; y--) out.push([CX - half, y]);
  return out;
};
const KEEP_RING = ringTiles(KEEP);
const OUTER_RING = ringTiles(OUTER);
const onRing = (x: number, y: number, half: number): boolean => Math.max(Math.abs(x - CX), Math.abs(y - CY)) === half;

type Res = Exclude<ResourceId, 'ears'>;

/** Materials still owed to the blueprints already placed. */
function owed(state: GameState): Partial<Record<Res, number>> {
  const out: Partial<Record<Res, number>> = {};
  for (const st of state.build.structures) {
    if (st.progress >= 1) continue;
    const cost = BUILDINGS[st.def]!.cost;
    for (const res of Object.keys(cost) as Res[]) out[res] = (out[res] ?? 0) + Math.max(0, (cost[res] ?? 0) - (st.delivered[res] ?? 0));
  }
  return out;
}

function affordable(state: GameState, defId: string, owe: Partial<Record<Res, number>>): boolean {
  const cost = BUILDINGS[defId]!.cost;
  for (const res of Object.keys(cost) as Res[]) if (state.colony.stock[res] - (owe[res] ?? 0) < (cost[res] ?? 0)) return false;
  return true;
}

function place(g: Game, defId: string, tx: number, ty: number, owe: Partial<Record<Res, number>>): boolean {
  const { state } = g;
  if (placementError(state, null, defId, tx, ty, 0) !== null) return false;
  g.sim.dispatch({ type: 'placeBlueprint', def: defId, tx, ty, rot: 0 });
  g.sim.applyCommands(state);
  const cost = BUILDINGS[defId]!.cost;
  for (const res of Object.keys(cost) as Res[]) owe[res] = (owe[res] ?? 0) + (cost[res] ?? 0);
  return true;
}

/** A free place for a building: inside the outer ring (not on a ring, not inside the keep), or south of it for fields. */
function findSpot(g: Game, defId: string, zone: 'inside' | 'fields'): [number, number] | null {
  const def = BUILDINGS[defId]!;
  const [w, d] = footprint(def, 0);
  let best: [number, number] | null = null;
  let bestD = Infinity;
  const lo = zone === 'inside' ? -OUTER + 1 : -30;
  const hi = zone === 'inside' ? OUTER - 1 : 30;
  for (let ty = CY + lo; ty + d - 1 <= CY + hi; ty++) {
    for (let tx = CX + lo; tx + w - 1 <= CX + hi; tx++) {
      let ok = true;
      for (let y = ty - 1; y <= ty + d && ok; y++) {
        for (let x = tx - 1; x <= tx + w && ok; x++) {
          const r = Math.max(Math.abs(x - CX), Math.abs(y - CY));
          // Clear of the keep, of both rings, and (fields) outside the outer ring.
          if (zone === 'inside' ? r <= KEEP + 1 || r >= OUTER - 1 : r <= OUTER + 1) ok = false;
        }
      }
      if (!ok) continue;
      const dist = Math.hypot(tx + w / 2 - CX, ty + d / 2 - CY);
      if (dist >= bestD || placementError(g.state, null, defId, tx, ty, 0) !== null) continue;
      // One tile of room round every building so that people (and the dead) can walk between them.
      let clear = true;
      for (const st of g.state.build.structures) {
        if (isRuin(st)) continue;
        const [sw, sd] = footprint(BUILDINGS[st.def]!, st.rot);
        if (tx - 1 < st.tx + sw && st.tx < tx + w + 1 && ty - 1 < st.ty + sd && st.ty < ty + d + 1) clear = false;
      }
      if (!clear) continue;
      best = [tx, ty];
      bestD = dist;
    }
  }
  return best;
}

const count = (state: GameState, defId: string): number => state.build.structures.reduce((n, s) => n + (s.def === defId && !isRuin(s) ? 1 : 0), 0);

function bestWall(state: GameState): string {
  // Earth costs nothing but work; steel and concrete only once the stores can spare them.
  if (isUnlocked('concreteWall', state) && state.colony.stock.cement > 150 && state.colony.stock.metal > 60) return 'concreteWall';
  if (isUnlocked('steelWall', state) && state.colony.stock.metal > 80) return 'steelWall';
  if (isUnlocked('earthwork', state)) return 'earthwork';
  return 'palisade';
}

function buildRing(g: Game, ring: [number, number][], half: number, owe: Partial<Record<Res, number>>, budget: number): number {
  const { state } = g;
  const taken = new Set<number>();
  for (const st of state.build.structures) if (!isRuin(st) && onRing(st.tx, st.ty, half) && BUILDINGS[st.def]!.size[0] === 1) taken.add(st.ty * 1000 + st.tx);
  const wall = bestWall(state);
  const gateOf: Record<string, string> = { palisade: 'gateWood', earthwork: 'gateEarth', steelWall: 'gateSteel', concreteWall: 'gateConcrete' };
  for (const [x, y] of ring) {
    if (budget <= 0) break;
    if (taken.has(y * 1000 + x)) continue;
    const isGate = x === CX && y === CY + half;
    const def = isGate ? gateOf[wall]! : wall;
    if (!affordable(state, def, owe)) break;
    if (place(g, def, x, y, owe)) budget--;
  }
  return budget;
}

function build(g: Game): void {
  const { state, policy } = g;
  if (policy.idle) return;
  const d = dayOf(state);
  const colony = state.colony;
  const owe = owed(state);
  let budget = 6 - pendingBlueprints(state);
  if (budget <= 0) return;
  const one = (defId: string, zone: 'inside' | 'fields' = 'inside'): boolean => {
    if (budget <= 0 || !isUnlocked(defId, state) || !affordable(state, defId, owe)) return false;
    const spot = findSpot(g, defId, zone);
    if (!spot || !place(g, defId, spot[0], spot[1], owe)) return false;
    budget--;
    return true;
  };

  // The capitol comes before everything once it may be built.
  const vp = victoryProgress(state, g.grid);
  if (vp.ready && vp.canBuild && count(state, 'capitol') === 0) {
    const spot = findSpot(g, 'capitol', 'inside');
    if (spot) place(g, 'capitol', spot[0], spot[1], owe);
  }
  if (capitolWaits(g)) return;

  // Beds for everyone who is here and the next two.
  const pending = (id: string): number => state.build.structures.reduce((n, s) => n + (s.def === id && s.progress < 1 ? 1 : 0), 0);
  const bedsComing = bedsTotal(state) + pending('tent') * 2 + pending('hut') * 4 + pending('house') * 6 + pending('apartment') * 16;
  if (bedsComing < Math.min(policy.pop(d), colony.survivors.length + 2)) {
    if (!one('apartment') && !one('house') && !one('hut')) one('tent');
  }
  // Fields for the farmers the policy wants.
  const farmers = Math.max(1, Math.round(Math.max(colony.survivors.length, 2) * policy.jobs.farming));
  const plots = plotInfo(state).plots + pending('farm') + pending('ranch') + pending('greenhouse');
  if (plots * COLONY.farm.workersPerPlot < farmers) {
    if (!one('ranch', 'fields') && !one('greenhouse')) one('farm', 'fields');
  }
  // The fence round the headquarters, then towers in its corners.
  if (policy.keepDay >= 0 && d >= policy.keepDay) budget = buildRing(g, KEEP_RING, KEEP, owe, budget);
  const corners: [number, number][] = [[CX - 2, CY - 2], [CX + 2, CY - 2], [CX - 2, CY + 2], [CX + 2, CY + 2]];
  for (let i = count(state, 'tower'); i < (techDone(state, 'W4') ? policy.towers : Math.min(1, policy.towers)) && budget > 0 && isUnlocked('tower', state) && affordable(state, 'tower', owe); i++) {
    const spot = corners.find(([x, y]) => placementError(state, null, 'tower', x, y, 0) === null);
    if (!spot || !place(g, 'tower', spot[0], spot[1], owe)) break;
    budget--;
  }
  // Workplaces, one of each as they are unlocked.
  for (const id of ['storehouse', 'workshop', 'lab', 'canteen', 'clinic', 'market', 'barracks', 'tavern', 'monument', 'school', 'hospital', 'radio']) {
    if (count(state, id) === 0) one(id);
  }
  if (colony.stock.fuel > 20) for (const id of ['generator', 'powerPlant']) if (count(state, id) === 0) one(id);
  if (colony.stock.fuel > 30 && count(state, 'turret') < 2) one('turret');
  if (count(state, 'storehouse') === 1 && colony.survivors.length >= 20) one('storehouse');
  // The outer ring last: it is long.
  if (policy.outerDay >= 0 && d >= policy.outerDay && budget > 0) buildRing(g, OUTER_RING, OUTER, owe, Math.min(budget, 4));
}

// --- research -----------------------------------------------------------------------------------

function research(g: Game): void {
  const { state, policy } = g;
  if (!policy.research) return;
  const r = state.research;
  const order = techOrder(policy);
  for (const id of order) {
    const t = TECHS[id];
    if (!t || r.active[t.cat] || startError(state, id) !== null) continue;
    g.sim.dispatch({ type: 'startResearch', id });
    g.sim.applyCommands(state);
  }
  // From the rebuilding era on the society branch (the goal) gets the larger share.
  const goalWeight = r.era >= 2 ? 3 : 1;
  const want: Record<TechCategory, number> = { F: 1, W: 1, A: 1, S: 1, C: goalWeight };
  const total = 4 + goalWeight;
  if (Math.abs(r.allocation.C - (goalWeight * 100) / total) > 0.5) {
    g.sim.dispatch({ type: 'setAllocation', allocation: want });
    g.sim.applyCommands(state);
  }
}

// --- scavenging parties -------------------------------------------------------------------------

const VALUE: Partial<Record<ResourceId, number>> = { food: 0.4, ammo: 1.2, wood: 1, metal: 1.5, cement: 1.5, parts: 2, medicine: 1, fuel: 0.6 };

function sendParty(g: Game): void {
  const { state, grid, policy } = g;
  if (policy.party <= 0) return;
  const pool = state.colony.survivors.filter((s) => s.job === 'scavenging' && isFit(s) && s.hp >= 80).sort((a, b) => aptitude(b, 'scavenging') - aptitude(a, 'scavenging') || a.id - b.id);
  const size = Math.max(COLONY.expedition.minMembers, Math.min(COLONY.expedition.maxMembers, policy.party));
  const busy = new Set(state.world.expeditions.map((e) => e.target));
  const targets = expeditionTargets(state, grid);
  // Several parties a day while there are people for them, each to a cell of its own.
  for (let sent = state.world.expeditions.length; sent < 4 && pool.length >= size; sent++) {
    const members = pool.splice(0, size);
    const weapon = [...EXPEDITION_WEAPONS].reverse().find((w) => {
      const need = expeditionAmmo(state, w, members.length);
      return weaponAvailable(state, w) && (need === 0 || state.colony.stock.ammo >= need + 60);
    });
    if (!weapon) return;
    let best: CellId | null = null;
    let bestScore = 0;
    for (const t of targets) {
      const land = grid.cells[t.cell]?.land;
      if (!land || busy.has(t.cell) || t.danger - weapon.bonus > policy.partyDanger) continue;
      let value = 0;
      for (const res of Object.keys(LOOT_TABLE[land]) as ResourceId[]) value += (LOOT_TABLE[land][res] ?? 0) * (VALUE[res] ?? 0);
      const score = (value * Math.max(0, state.world.cells.loot[t.cell] ?? 0)) / (1 + t.totalMinutes / 1440);
      if (score > bestScore) {
        bestScore = score;
        best = t.cell;
      }
    }
    if (best === null) return;
    busy.add(best);
    g.sim.dispatch({ type: 'sendExpedition', members: members.map((s) => s.id), target: best, weapon: weapon.id });
    g.sim.applyCommands(state);
  }
}

// --- trips: outposts, caches, hunting grounds ---------------------------------------------------

const TRIP_OUTPOST = 1;
const TRIP_HUNT = 2;

function regionsHeld(g: Game): Set<number> {
  const out = new Set<number>();
  const add = (c: CellId | null): void => {
    const r = c === null ? undefined : g.grid.cells[c]?.region;
    if (r !== undefined) out.add(r);
  };
  add(g.state.world.homeCell);
  for (const o of g.state.world.outposts) add(o.cell);
  return out;
}

/** The next cell to plant an outpost on: near, quiet, and on the way to a region the colony does not hold yet. */
function outpostTarget(g: Game): CellId | null {
  const { state, grid } = g;
  const home = state.world.homeCell!;
  const stations = [home, ...state.world.outposts.map((o) => o.cell)];
  const held = regionsHeld(g);
  const needRegion = held.size < 3;
  // Cells of other regions, to steer toward.
  const foreign = needRegion ? grid.landIds.filter((c) => !held.has(grid.cells[c]!.region)) : [];
  let best: CellId | null = null;
  let bestScore = Infinity;
  const seen = new Set<CellId>();
  for (const s of stations) {
    for (const cell of cellsWithin(grid, s, BUILD.outpost.reach)) {
      if (seen.has(cell)) continue;
      seen.add(cell);
      const z = state.world.cells.Z[cell] ?? -1;
      if (z < 0 || z > 160 || stations.includes(cell) || flag(state, `bad.${cell}`) > 0) continue;
      if (stations.some((t) => cellDistance(grid, t, cell) < 3)) continue; // spread them out
      const route = findRoute(grid, home, cell);
      if (!route) continue;
      let score = route.minutes + z * 12;
      if (needRegion) {
        if (!held.has(grid.cells[cell]!.region)) score -= 100000;
        else {
          let near = Infinity;
          for (const f of foreign) near = Math.min(near, cellDistance(grid, cell, f));
          score += near * 400;
        }
      }
      if (score < bestScore) {
        bestScore = score;
        best = cell;
      }
    }
  }
  return best;
}

function huntTarget(g: Game, why: 'cache' | 'ears' | 'loot'): CellId | null {
  const { state, grid, policy } = g;
  const home = state.world.homeCell!;
  let best: CellId | null = null;
  let bestScore = 0;
  for (const cell of cellsWithin(grid, home, 2)) {
    if (cell === home) continue;
    const z = state.world.cells.Z[cell] ?? -1;
    const land = grid.cells[cell]?.land;
    if (z < 0 || !land || !findRoute(grid, home, cell)) continue;
    const danger = dangerOf(z);
    const spots = (state.world.cells.loot[cell] ?? 0) * BALANCE.world.lootSpots[land];
    // What the trip is for comes first; the rest is a bonus. Danger the skill cannot take counts against.
    const gain = why === 'cache' ? cachesIn(g, cell) * 3 + spots : why === 'ears' ? (z >= 60 ? Math.min(z, 600) : 0) + cachesIn(g, cell) : spots * 10 + cachesIn(g, cell);
    const score = gain / (cellDistance(grid, home, cell) * (1 + danger * policy.skill.risk * 400));
    if (score > bestScore) {
      bestScore = score;
      best = cell;
    }
  }
  return best;
}

function trips(g: Game): void {
  const { state, grid, policy } = g;
  if (state.world.travel || policy.idle) return;
  const home = state.world.homeCell!;
  const kind = flag(state, 'trip');
  const d = dayOf(state);
  const go = (to: CellId, tripKind: number): void => {
    g.sim.dispatch({ type: 'resupply' });
    g.sim.dispatch({ type: 'travel', to });
    g.sim.applyCommands(state);
    if (state.world.travel) {
      setFlag(state, 'trip', tripKind);
      setFlag(state, 'tripDay', state.time.day);
    }
  };
  const back = (): void => {
    setFlag(state, 'trip', 0);
    if (state.player.cell !== home) {
      g.sim.dispatch({ type: 'travel', to: home });
      g.sim.applyCommands(state);
    }
  };
  // A horde is coming (or about to form): the player belongs at home.
  const hordeNear = state.world.pendingHorde?.warned === true || state.world.hordeMeter >= hordeThreshold(state) * 0.75;
  if (kind === 0) {
    if (state.player.cell !== home) return back();
    if (state.time.minute !== 6 * 60 || hordeNear) return; // trips start in the morning
    const colony = state.colony;
    const T = BUILD.outpost.tiers[0];
    if (state.world.outposts.length < policy.outposts(d) && colony.stock.ears >= T.ears + wagesPerDay(state) * 3 && colony.stock.wood >= (T.cost.wood ?? 0) && colony.survivors.filter(isFit).length >= 3 && carried(state) + colony.stock.ammo >= 60) {
      const target = outpostTarget(g);
      if (target !== null) return go(target, TRIP_OUTPOST);
    }
    // A few days in a neighbouring cell: for ears when the home cell has run dry, for the caches
    // when the rounds have, for its buildings when the ones at home are searched out.
    const ct = cellTactical(state, grid, home);
    const land = grid.cells[home]!.land;
    const noZ = !!ct && Math.min(ct.z, ct.active) < FULL_MAP * 0.3 && earsWanted(g);
    const noAmmo = carried(state) + colony.stock.ammo < 80;
    const noLoot = (state.world.cells.loot[home] ?? 0) * BALANCE.world.lootSpots[land] < 1;
    if (policy.roam && (noZ || noAmmo || noLoot) && state.time.day - flag(state, 'lastTrip') >= (noAmmo ? 1 : 2)) {
      const target = huntTarget(g, noAmmo ? 'cache' : noZ ? 'ears' : 'loot');
      if (target !== null) return go(target, TRIP_HUNT);
    }
    return;
  }
  // Out there.
  if (hordeNear && kind === TRIP_HUNT) return back();
  const cell = state.player.cell;
  const days = state.time.day - flag(state, 'tripDay');
  setFlag(state, 'lastTrip', state.time.day);
  if (kind === TRIP_OUTPOST) {
    if (isCleared(state.world.cells.Z[cell] ?? 0)) {
      if (foundError(state, grid, cell) === null) {
        g.sim.dispatch({ type: 'foundOutpost', cell });
        g.sim.applyCommands(state);
        return back();
      }
      if (days >= 2) return back(); // the colony cannot pay for it after all
    }
    if (days >= 7 || (carried(state) < 3 && cachesIn(g, cell) === 0)) {
      setFlag(state, `bad.${cell}`, 1);
      return back();
    }
    return;
  }
  if (days >= 2 || (carried(state) < 3 && cachesIn(g, cell) === 0) || (state.player.inv.ears ?? 0) >= 150) back();
}

// ---------------------------------------------------------------------------------------------
// One game hour of decisions, one game day of bookkeeping
// ---------------------------------------------------------------------------------------------

function botHour(g: Game): void {
  const { state, policy } = g;
  if (state.flags.defeat || state.world.homeCell === null) return;
  const hour = state.time.minute / 60;
  const travelling = state.world.travel !== null;
  if (!travelling) {
    if (hour >= 7 && hour < 7 + policy.huntHours) {
      if (hour === 7) meetPeople(g);
      huntHour(g);
      // Searching is spread over the hunting hours.
      const per = policy.searchPerDay / policy.huntHours;
      const n = Math.floor(per) + (chance(stream(state, 'bot'), per - Math.floor(per)) ? 1 : 0);
      for (let i = 0; i < n; i++) searchSpot(g);
      // Away from home the caches are what the trip is for.
      if (!atHome(state) && carried(state) < BALANCE.player.maxAmmo - 20) takeCache(g);
    }
    // Rounds for the night watch.
    if (hour === 21 && atHome(state) && carried(state) < 60 && state.colony.stock.ammo >= 1) {
      g.sim.dispatch({ type: 'resupply' });
      g.sim.applyCommands(state);
    }
  }
  hirePeople(g);
  if (hour === 6 || hour === 13) assignJobs(g);
  if (hour === 6 || hour === 12 || hour === 18) build(g);
  research(g);
  if (hour === 6) sendParty(g);
  trips(g);
  if (hour === 6 && !state.colony.policy.autoBuyFood && !policy.idle) {
    g.sim.dispatch({ type: 'setPolicy', autoBuyFood: true });
    g.sim.applyCommands(state);
  }
}

function dayRow(g: Game): void {
  const { state } = g;
  const colony = state.colony;
  const home = state.world.homeCell!;
  const ledger = colony.ledger.find((l) => l.day === state.time.day - 1);
  const walls = state.build.structures.filter((s) => isBuilt(s) && (BUILDINGS[s.def]!.kind === 'wall' || BUILDINGS[s.def]!.kind === 'gate')).length;
  if (g.today.dry) {
    g.m.dryDays++;
    g.m.firstDry ??= dayOf(state) - 1;
  }
  g.rows.push({
    day: dayOf(state),
    pop: colony.survivors.length,
    ears: Math.round(colony.stock.ears),
    food: Math.round(colony.stock.food * 10) / 10,
    foodNeed: Math.round(foodNeedPerDay(state) * 10) / 10,
    ammo: Math.round(colony.stock.ammo + carried(state)),
    wood: Math.round(colony.stock.wood),
    metal: Math.round(colony.stock.metal),
    cement: Math.round(colony.stock.cement),
    parts: Math.round(colony.stock.parts),
    era: state.research.era,
    techs: state.research.done.length,
    outposts: state.world.outposts.length,
    walls,
    wallsLost: g.m.wallsLost,
    dead: g.m.dead,
    deserted: g.m.deserted,
    rifleEars: g.today.ears,
    kills: g.today.kills,
    shots: g.today.shots,
    income: Math.round(ledger?.income ?? 0),
    wages: Math.round(ledger?.wages ?? 0),
    homeZ: Math.round(state.world.cells.Z[home] ?? 0),
    horde: Math.round(state.world.hordeMeter),
    raids: g.m.raids,
    beds: bedsTotal(state),
    morale: colony.survivors.length ? Math.round(colony.survivors.reduce((s, x) => s + x.morale, 0) / colony.survivors.length) : 0,
    away: atHome(state) ? 0 : 1,
  });
  g.today = { ears: 0, kills: 0, shots: 0, dry: false };
}

/** Advance the game by `minutes` game minutes with the bot at the controls. */
export function play(g: Game, minutes: number, onDay?: (g: Game) => void): void {
  const { state, sim } = g;
  awayPlayer.gun = raidGun(g);
  try {
    for (let i = 0; i < minutes; i++) {
      if (state.flags.defeat) break;
      if (state.time.minute % 60 === 0 && state.flags.skipping !== true) botHour(g);
      const before = state.time.day;
      sim.tick(state, 1, idle);
      if (state.time.day !== before) {
        // A time skip (the player laid up) can pass several midnights in one tick.
        dayRow(g);
        onDay?.(g);
      }
    }
  } finally {
    awayPlayer.gun = null;
  }
}
