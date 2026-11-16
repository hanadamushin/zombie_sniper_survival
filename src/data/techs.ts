// The technology tree (docs/03_tech_tree.md). Owner: 07 tech & progression.
//
// Everything a node does is declared here as data:
//   unlock    something becomes available (a building, gear for survivors, a job, an outpost tier)
//   modifier  a number somewhere in the game changes: getMod(state, key, base) = (base + adds) * muls
//   flag      a switch that one piece of logic asks about with hasFlag(state, flag)
// sim/research/modifiers.ts compiles the nodes the colony has (plus standing buildings and the
// difficulty) into one table. MOD_KEYS and FLAGS list every key with the place that reads it; the
// integrity test (tests/research.test.ts) rejects a node that uses a key nobody reads.
//
// Names and descriptions are in ui/i18n/ja.ts under `tech.<id>` / `tech.<id>.desc`.

import type { TechCategory } from '../core/types.ts';

/** Every modifier key and where it is read. */
export const MOD_KEYS = {
  // --- the player's rifle (sim/tactical/weapon.ts `weaponOf`) ---
  'weapon.damage': 'damage table factor',
  'weapon.torso': 'extra factor on torso hits',
  'weapon.pierce': 'bodies one bullet passes through',
  'weapon.velocity': 'muzzle velocity',
  'weapon.drag': 'air drag per km',
  'weapon.bolt': 'seconds between shots',
  'weapon.mag': 'magazine size',
  'weapon.zoomMax': 'highest magnification',
  'weapon.range': 'distance a bullet flies (m)',
  'weapon.recoil': 'recoil kick',
  'weapon.ammoPerShot': 'stock rounds one cartridge costs',
  'weapon.sway': 'sway amplitude (difficulty, calibre) — weapon.ts swayTarget',
  'knife.damage': 'knife damage — tactical/combat.ts',
  // --- structures (sim/build) ---
  'moat.work': 'work to dig a moat tile — construction.ts',
  'repair.speed': 'repair work efficiency — construction.ts',
  'wall.hp': 'durability of walls and gates — structures.ts maxHp',
  'defense.hp': 'durability of every defensive structure — structures.ts maxHp',
  'wall.selfRepair': 'share of a wall restored per quiet hour — build/index.ts',
  'build.radius': 'buildable radius around the headquarters (m) — blueprints.ts',
  'tower.range': 'range factor of defenders on towers — defense.ts',
  'capacity.food': 'food storage — structures.ts refreshCapacity',
  // --- defence and raids ---
  'defender.hit': 'hit chance of defenders — defense.ts / raids.ts',
  'ammo.issue': 'rounds defenders and expeditions draw from the stores — defense.ts / expeditions.ts',
  'raid.hordeGain': 'how fast the horde meter fills — world/index.ts',
  'raid.hordeMax': 'largest horde — raids.ts',
  'raid.nightSize': 'size of the nightly approach — raids.ts',
  'zombie.active': 'zombies on a tactical map at once — world/derive.ts',
  // --- colony ---
  'job.all': 'output of every job — jobs.ts jobMul',
  'job.farming': 'farming output', 'job.defense': 'defence output', 'job.scavenging': 'scavenging output',
  'job.construction': 'construction output', 'job.research': 'research output', 'job.crafting': 'crafting output', 'job.medical': 'medical output',
  'farm.yield': 'food per farming point — jobs.ts',
  'farm.seasonMin': 'floor of the season factor — jobs.ts',
  'food.use': 'food eaten per meal — economy.ts',
  'food.price': 'price of food from farmers and villages — economy.ts',
  'food.priceMax': 'upper bound of the price factor — economy.ts',
  wage: 'daily wages — economy.ts payWages',
  'hire.fee': 'signing fee — survivors.ts',
  'colony.popCap': 'people the colony can hold — survivors.ts hire',
  'morale.max': 'upper bound of morale — morale.ts',
  'morale.hungry': 'morale lost to short or missing meals — morale.ts',
  'heal.rest': 'hp regained per hour of rest — morale.ts',
  'cure.medicine': 'medicine per cured infection — morale.ts',
  'infection.chance': 'chance that a bite infects — tactical/zombies.ts, expeditions.ts',
  'infection.hours': 'hours until an infection kills — tactical, expeditions',
  'craft.cost': 'materials per batch of ammunition — economy.ts',
  // --- expeditions and the world ---
  'expedition.radius': 'reach of expeditions in cells — expeditions.ts',
  'expedition.time': 'duration of an expedition — expeditions.ts',
  'expedition.bonus': 'added to the return chance — expeditions.ts',
  'expedition.danger': 'added to the danger of the target — expeditions.ts',
  'travel.time': 'travel time on the strategic map — world/travel.ts',
  'travel.fast': 'fast-travel time — world/travel.ts',
  'outpost.supply': 'daily ammunition sent to outposts — outposts.ts',
} as const;
export type ModKey = keyof typeof MOD_KEYS;

/** Every flag and where it is read. */
export const FLAGS = {
  'moat.slow': 'zombies beside a moat walk slower — tactical/zombies.ts',
  militia: 'everyone at home fights in a raid — colony/jobs.ts fighters',
  snipers: 'the best defenders on towers shoot far and true — defense.ts',
  'scope.rangefinder': 'distance and hold-over in the scope — ui TacticalLayer',
  'scope.nightVision': 'no night sway penalty, bright scope at night — weapon.ts / render scope',
  'intel.zombies': 'kind and health of the zombie under the reticle; nearby cells are surveyed — ui, research/effects.ts',
  'hire.stats': 'candidates show their stats before hiring — ui Hire',
  'map.forecast': 'seven-day infection forecast on the strategic map — research/forecast.ts',
  'supply.noDelay': 'outpost convoys arrive the same day — outposts.ts',
  'horde.scout': 'a horde is announced a day ahead — raids.ts',
  'intel.scout': 'cells around the base and outposts are fully known — research/effects.ts',
  radio: 'a radio tower calls in a survivor every day — research/effects.ts',
  brewery: 'the tavern turns food into ears — research/effects.ts',
  trade: 'the market earns ears from villages and outposts — research/effects.ts',
  'desert.armed': 'deserters take ammunition with them — morale.ts',
  'ears.receipt': 'half of the ears carried survive the player\'s death — morale.ts',
  'outpost.autonomy': 'outposts grow on their own and pay tax — research/effects.ts',
  federation: 'every outpost adds to all output — jobs.ts jobMul',
  vaccine: 'bites no longer infect; held cells are cleared slowly — research/effects.ts',
  noStarve: 'missing meals no longer cost health — morale.ts',
  'garrison.fed': 'garrisons live off the land: outposts send food home — research/effects.ts',
  power: 'a generator or power plant runs — modifiers.ts (buildings with needsPower)',
  education: 'the school teaches: knowledge +1 every 30 days — research/effects.ts',
  turret: 'automatic turrets fire — defense.ts',
} as const;
export type FlagId = keyof typeof FLAGS;

export type UnlockKind = 'building' | 'gear' | 'job' | 'outpostTier';
export type TechEffect =
  | { kind: 'unlock'; what: UnlockKind; id: string }
  | { kind: 'modifier'; key: ModKey; op: 'add' | 'mul'; value: number }
  | { kind: 'flag'; flag: FlagId };

export interface TechDef {
  id: string;
  cat: TechCategory;
  era: 0 | 1 | 2 | 3;
  /** Research points. */
  cost: number;
  /** All of these must be researched ... */
  req: readonly string[];
  /** ... and at least one of these (when given). */
  any?: readonly string[];
  /** The other side of an exclusive branch: taking this node locks it and whatever needs it. */
  excludes?: string;
  /** One of the three goal technologies (spec §13). */
  goal?: boolean;
  effects: readonly TechEffect[];
}

const B = (id: string): TechEffect => ({ kind: 'unlock', what: 'building', id });
const gear = (id: string): TechEffect => ({ kind: 'unlock', what: 'gear', id });
const mul = (key: ModKey, value: number): TechEffect => ({ kind: 'modifier', key, op: 'mul', value });
const add = (key: ModKey, value: number): TechEffect => ({ kind: 'modifier', key, op: 'add', value });
const flag = (f: FlagId): TechEffect => ({ kind: 'flag', flag: f });

type Row = [id: string, era: 0 | 1 | 2 | 3, cost: number, req: readonly string[], effects: readonly TechEffect[], extra?: Partial<Pick<TechDef, 'any' | 'excludes' | 'goal'>>];
const rows = (cat: TechCategory, list: Row[]): TechDef[] => list.map(([id, era, cost, req, effects, extra]) => ({ id, cat, era, cost, req, effects, ...extra }));

/**
 * Costs are set so that four researchers on an even allocation, without a laboratory, reach the
 * settled era around day 15, the rebuilding era around day 45 and the revival era around day 90
 * (tests/research.test.ts prints the days).
 */
const DEFS: TechDef[] = [
  // ------------------------------------------------------------------ F: fortification
  ...rows('F', [
    ['F1', 0, 250, [], [B('earthwork'), B('gateEarth'), B('moat'), B('hut')]],
    ['F2', 0, 350, ['F1'], [B('tower')]],
    ['F3', 1, 500, ['F1'], [B('steelWall'), B('gateSteel'), B('house')]],
    ['F4a', 1, 900, ['F2', 'F3'], [mul('moat.work', 0.6), B('drawbridge'), flag('moat.slow')], { excludes: 'F4b' }],
    ['F4b', 1, 900, ['F2', 'F3'], [B('barbedWire'), mul('wall.hp', 1.25), mul('repair.speed', 1.5)], { excludes: 'F4a' }],
    ['F5', 2, 800, ['F3'], [B('concreteWall'), B('gateConcrete'), B('apartment'), add('build.radius', 60)]],
    ['F6a', 2, 1000, ['F4a', 'F5'], [B('waterMoat')]],
    ['F6b', 2, 1000, ['F4b', 'F5'], [add('wall.selfRepair', 0.01)]],
    ['F7a', 2, 1400, ['F5'], [B('turret'), flag('turret')], { excludes: 'F7b' }],
    ['F7b', 2, 1400, ['F5'], [flag('militia')], { excludes: 'F7a' }],
    ['F8', 3, 2500, [], [add('build.radius', 120), mul('tower.range', 1.25)], { any: ['F6a', 'F6b'] }],
    ['F9', 3, 4000, ['F8'], [mul('defense.hp', 1.5)], { any: ['F7a', 'F7b'], goal: true }],
  ]),
  // ------------------------------------------------------------------ W: weapons
  ...rows('W', [
    ['W1', 0, 250, [], [gear('melee'), mul('knife.damage', 1.5)]],
    ['W2', 0, 350, ['W1'], [B('workshop')]],
    ['W3', 1, 500, ['W1'], [gear('bow')]],
    ['W4', 1, 700, ['W2'], [gear('pistol'), gear('rifleArmor')]],
    // One shot, one kill — even through a row of them. Slow, loud on the shoulder, and hungry.
    ['W5a', 1, 900, ['W4'], [mul('weapon.damage', 2), add('weapon.pierce', 2), mul('weapon.velocity', 1.1), mul('weapon.bolt', 1.5), mul('weapon.sway', 1.2), mul('weapon.recoil', 1.5), mul('weapon.ammoPerShot', 3)], { excludes: 'W5b' }],
    // Ten rounds as fast as the trigger goes. Each one does a little less and stops in the first body.
    ['W5b', 1, 900, ['W4'], [add('weapon.mag', 5), mul('weapon.bolt', 0.35 / 1.2), mul('weapon.torso', 0.85), add('weapon.pierce', -1), add('weapon.range', -100), mul('weapon.recoil', 0.7)], { excludes: 'W5a' }],
    ['W6a', 2, 1000, ['W4'], [mul('weapon.zoomMax', 2), flag('scope.rangefinder')], { excludes: 'W6b' }],
    ['W6b', 2, 1000, ['W4'], [add('weapon.pierce', 2), mul('weapon.velocity', 1.1), mul('weapon.drag', 0.8), mul('craft.cost', 0.6)], { excludes: 'W6a' }],
    ['W7', 2, 1200, [], [flag('scope.nightVision')], { any: ['W6a', 'W6b'] }],
    ['W8', 3, 2500, ['W7'], [mul('ammo.issue', 0.5), add('expedition.bonus', 0.05)]],
    ['W9', 3, 3000, ['W8'], [flag('snipers')]],
  ]),
  // ------------------------------------------------------------------ A: agriculture
  ...rows('A', [
    ['A1', 0, 250, [], [B('farm')]],
    ['A2', 0, 350, ['A1'], [B('storehouse'), mul('capacity.food', 1.5)]],
    ['A3', 1, 500, ['A1'], [mul('farm.yield', 1.3)]],
    ['A4a', 1, 900, ['A3'], [B('ranch')], { excludes: 'A4b' }],
    ['A4b', 1, 900, ['A3'], [B('greenhouse')], { excludes: 'A4a' }],
    ['A5', 2, 800, ['A3'], [mul('job.farming', 1.4)]],
    ['A6a', 2, 1000, ['A2'], [add('expedition.radius', 2), mul('expedition.time', 0.8), flag('garrison.fed')], { any: ['A4a', 'A4b'], excludes: 'A6b' }],
    ['A6b', 2, 1000, ['A2'], [B('tavern'), flag('brewery')], { any: ['A4a', 'A4b'], excludes: 'A6a' }],
    ['A7', 3, 2500, ['A5'], [mul('farm.yield', 1.5), add('farm.seasonMin', 0.7)]],
    ['A8', 3, 3000, ['A7'], [mul('food.priceMax', 1.2 / 2.5), flag('noStarve')]],
  ]),
  // ------------------------------------------------------------------ S: science & medicine
  ...rows('S', [
    ['S1', 0, 250, [], [mul('heal.rest', 2)]],
    ['S2', 0, 350, ['S1'], [flag('intel.zombies')]],
    ['S3', 1, 500, [], [B('lab')]],
    ['S4', 1, 700, ['S1'], [B('clinic'), { kind: 'unlock', what: 'job', id: 'medical' }]],
    ['S5a', 1, 900, ['S3', 'S4'], [mul('infection.chance', 0.4), mul('cure.medicine', 0.5)], { excludes: 'S5b' }],
    ['S5b', 1, 900, ['S3', 'S4'], [B('generator'), mul('job.crafting', 1.3), mul('job.all', 1.1)], { excludes: 'S5a' }],
    ['S6a', 2, 1000, ['S5a'], [B('hospital'), mul('infection.hours', 3.5)]],
    ['S6b', 2, 1000, ['S5b'], [B('powerPlant')]],
    ['S7a', 2, 1200, ['S6a'], [flag('map.forecast')]],
    ['S7b', 2, 1200, ['S6b'], [mul('travel.time', 0.4), mul('travel.fast', 0.5), flag('supply.noDelay')]],
    ['S8', 3, 2500, [], [B('school'), flag('education')], { any: ['S6a', 'S6b'] }],
    ['S9', 3, 4000, ['S7a', 'S8'], [mul('infection.chance', 0), flag('vaccine')], { goal: true }],
  ]),
  // ------------------------------------------------------------------ C: society & economy
  ...rows('C', [
    ['C1', 0, 250, [], [B('canteen'), mul('food.use', 0.95), mul('morale.hungry', 0.7)]],
    ['C2', 0, 350, ['C1'], [mul('hire.fee', 0.7), flag('hire.stats')]],
    ['C3', 1, 500, [], [{ kind: 'unlock', what: 'outpostTier', id: '2' }, mul('outpost.supply', 1.5)]],
    ['C4a', 1, 900, ['C1', 'C3'], [B('market'), flag('trade'), mul('food.price', 0.8), mul('wage', 1.1)], { excludes: 'C4b' }],
    ['C4b', 1, 900, ['C1', 'C3'], [B('barracks'), mul('wage', 0.75), mul('job.all', 1.1), mul('morale.max', 0.8), flag('desert.armed')], { excludes: 'C4a' }],
    ['C5', 2, 800, ['C3'], [{ kind: 'unlock', what: 'outpostTier', id: '3' }, B('monument'), add('colony.popCap', 1000)]],
    ['C6a', 2, 1000, ['C5'], [B('radio'), flag('radio'), mul('raid.hordeGain', 1.5)], { excludes: 'C6b' }],
    ['C6b', 2, 1000, ['C5'], [flag('horde.scout'), flag('intel.scout'), add('expedition.danger', -0.1)], { excludes: 'C6a' }],
    ['C7', 2, 1200, [], [mul('wage', 0.9), flag('ears.receipt')], { any: ['C4a', 'C4b'] }],
    ['C8', 3, 2500, ['C5'], [flag('outpost.autonomy')]],
    ['C9', 3, 4000, ['C8', 'C7'], [flag('federation')], { goal: true }],
  ]),
];

export const TECHS: Readonly<Record<string, TechDef>> = Object.fromEntries(DEFS.map((d) => [d.id, d]));
export const TECH_LIST: readonly TechDef[] = DEFS;
export const GOAL_TECHS: readonly string[] = DEFS.filter((d) => d.goal).map((d) => d.id);

/** Numbers of the research system and of the tech effects that are behaviour rather than a modifier. */
export const RESEARCH = {
  /** Nodes of an era (all categories together) that open the next one. */
  nodesPerEra: 6,
  /** People the colony can hold before C5 (administration) lifts the limit. */
  popCap: 30,
  /** Sway factor at night without night-vision gear (W7), below this share of daylight. */
  nightSway: 1.25,
  nightBelow: 0.3,
  /** F4a: speed factor of zombies on a tile next to a moat. */
  moatSlow: 0.8,
  /** F7a: a turret fires like a defender with this weapon, this skill and this range; rounds per shot. */
  turret: { range: 45, interval: 1.5, hit: 0.45, damage: 55, headshot: 0.15, ammo: 1 },
  /** F7b: militia fight at this share of their defence output. */
  militiaShare: 0.5,
  /** W9: this many of the best defenders on towers become snipers. */
  snipers: { count: 3, range: 2.5, hit: 0.3, headshot: 0.6 },
  /** S2 / C6b: cells around the base (and outposts) that are surveyed every day, and how well. */
  surveyRadius: 4,
  scoutRadius: 6,
  /** S7a: days the forecast looks ahead. */
  forecastDays: 7,
  /** S8: days between lessons, and the ceiling. */
  schoolDays: 30,
  schoolMax: 10,
  /** S9: share of the zombies in held cells (home, outposts) that dies every day. */
  vaccineClear: 0.05,
  /** A6a: food an outpost sends home per garrison member and day. */
  garrisonFood: 0.5,
  /** A6b: the tavern turns this share of the day's food need into drink, sold at this many ears per food. */
  brewShare: 0.1,
  brewEars: 6,
  /** C4a: ears per day from each trading partner (a village in reach, every outpost), with a market standing. */
  tradeEars: 4,
  /** C4b: rounds a deserter takes along. */
  desertAmmo: 20,
  /** C6a: how far the radio reaches for people in hiding (cells). */
  radioRadius: 6,
  /** C7: share of the carried ears that survives the player's death. */
  receiptShare: 0.5,
  /** C8: days between an outpost's free upgrades, and ears of tax per tier and day. */
  autonomyDays: 10,
  taxPerTier: 3,
  /** C9: morale for everyone when the charter is signed, and output per outpost (capped). */
  federationMorale: 15,
  federationPerOutpost: 0.02,
  federationMax: 0.2,
  /** Outposts (spec §8): tier 2+ extends the expedition reach by this; tier n watches n-1 cells around; tier 3 farms and trades. */
  outpostReach: 1,
  outpostFood: 3,
  outpostEars: 5,
  /** Victory (spec §13). */
  victory: { era: 3, population: 60, outposts: 6, regions: 3 },
} as const;

/** Modifiers by difficulty (low / normal / high), merged into getMod. */
export const DIFFICULTY_MODS: readonly (readonly TechEffect[])[] = [
  [mul('weapon.sway', 0.8), mul('raid.hordeGain', 0.75), mul('raid.nightSize', 0.7), mul('zombie.active', 0.8), mul('raid.hordeMax', 80 / 150)],
  [],
  [mul('weapon.sway', 1.25), mul('raid.hordeGain', 1.3), mul('raid.nightSize', 1.3), mul('zombie.active', 1.2), mul('raid.hordeMax', 250 / 150)],
];

/** Nodes that can never be taken once `id` has been: its exclusive partner and everything that needs a locked node. */
export function locksOf(id: string, done: readonly string[] = []): string[] {
  const start = TECHS[id]?.excludes;
  if (!start) return [];
  const locked = new Set<string>([start]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const t of DEFS) {
      if (locked.has(t.id) || done.includes(t.id) || t.id === id) continue;
      if (t.req.some((r) => locked.has(r)) || (t.any !== undefined && t.any.every((r) => locked.has(r)))) {
        locked.add(t.id);
        changed = true;
      }
    }
  }
  return [...locked];
}
