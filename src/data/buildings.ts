// Structures of the home base (docs/02_systems_spec.md §6.1, §6.2), raids (§7), defenders (§4.5)
// and outposts (§8). Owner: 06 building & defense. Logic never carries these numbers.
//
// A structure occupies `size` tiles (4 m each; rot 1 / 3 swaps width and depth). `kind` decides how
// it behaves:
//   wall      solid, zombies break it down                gate    people pass, zombies break it
//   moat      zombies cannot cross until bodies fill it   bridge  a moat tile people can cross (raised in an alarm)
//   wire      slows and hurts whatever walks through      tower   firing position reached by a ladder
//   building  solid box with an effect                    field   open ground with an effect (crops)

import type { ResourceId } from '../core/types.ts';
import type { FlagId, ModKey } from './techs.ts';

export type StructureKind = 'wall' | 'gate' | 'moat' | 'bridge' | 'wire' | 'tower' | 'building' | 'field';
export type BuildCategory = 'defense' | 'housing' | 'food' | 'work' | 'civic';
export type Cost = Partial<Record<Exclude<ResourceId, 'ears'>, number>>;

export interface BuildingDef {
  id: string;
  kind: StructureKind;
  category: BuildCategory;
  /** Footprint in tiles [width (x), depth (z)] at rot 0. */
  size: readonly [number, number];
  /** Durability; 0 = cannot be attacked (moats). */
  hp: number;
  /** Materials and construction output for the whole structure. */
  cost: Cost;
  work: number;
  /** Tech node that unlocks it (docs/03_tech_tree.md); undefined = from the start. */
  tech?: string;
  /** Unlocked by any one of these instead (the capitol: any goal technology). */
  techAny?: readonly string[];
  era: 0 | 1 | 2 | 3;
  /** Height in metres (collision and drawing); for towers the deck level. */
  height: number;
  /** Walls: thickness of the collision / drawn body (m). */
  thick?: number;
  /** Material look (render/tactical/structures.ts). */
  look: 'wood' | 'earth' | 'steel' | 'concrete' | 'cloth' | 'soil' | 'glass' | 'brick' | 'wire' | 'water' | 'pit';
  /** Only one may stand (headquarters, capitol). */
  unique?: boolean;
  /** Cannot be placed or demolished by the player (headquarters). */
  fixed?: boolean;
  // --- effects (read by sim/build/effects.ts and through it by the colony) ---
  beds?: number;
  capacity?: Partial<Record<ResourceId, number>>;
  /** Farm plots, their yield factor, and whether the season is ignored. */
  plots?: number;
  yieldMul?: number;
  allSeason?: boolean;
  /** Facility factor of a job while at least one stands (the best one counts). */
  job?: Partial<Record<'crafting' | 'research' | 'medical' | 'defense', number>>;
  /** Morale per day for everyone (each building counts once per id). */
  morale?: number;
  /** Share of the food saved at every meal. */
  foodSaving?: number;
  /** Zombies die in a water moat never; fuel per tile and day it needs to stay filled. */
  fuelPerDay?: number;
  /** A water moat: bodies sink, it takes BUILD.waterMoatFill of them (not moatFill) to get across. */
  unfillable?: boolean;
  // --- global effects while at least one stands (07; compiled by sim/research/modifiers.ts) ---
  mods?: readonly { key: ModKey; op: 'add' | 'mul'; value: number }[];
  flags?: readonly FlagId[];

}

const wall = (id: string, hp: number, cost: Cost, work: number, era: 0 | 1 | 2 | 3, tech: string | undefined, height: number, thick: number, look: BuildingDef['look']): BuildingDef =>
  ({ id, kind: 'wall', category: 'defense', size: [1, 1], hp, cost, work, era, tech, height, thick, look });
/** Gates: 60 % of the wall's durability, twice its materials and work (spec §6.1). */
const gate = (id: string, of: BuildingDef): BuildingDef => {
  const cost: Cost = {};
  for (const k of Object.keys(of.cost) as (keyof Cost)[]) cost[k] = (of.cost[k] ?? 0) * 2;
  if (Object.keys(cost).length === 0) cost.wood = 6; // an earthwork gate is still a wooden door
  return { ...of, id, kind: 'gate', hp: Math.round(of.hp * 0.6), cost, work: of.work * 2 };
};
const building = (id: string, category: BuildCategory, size: readonly [number, number], hp: number, cost: Cost, work: number, era: 0 | 1 | 2 | 3, tech: string | undefined, height: number, look: BuildingDef['look'], fx: Partial<BuildingDef> = {}): BuildingDef =>
  ({ id, kind: 'building', category, size, hp, cost, work, era, tech, height, look, ...fx });

const palisade = wall('palisade', 150, { wood: 4 }, 6, 0, undefined, 2.6, 0.5, 'wood');
const earthwork = wall('earthwork', 300, {}, 20, 0, 'F1', 2.2, 2.6, 'earth');
const steelWall = wall('steelWall', 700, { metal: 6 }, 16, 1, 'F3', 3.0, 0.4, 'steel');
const concreteWall = wall('concreteWall', 1500, { cement: 5, metal: 2 }, 30, 2, 'F5', 3.6, 0.8, 'concrete');

const DEFS: BuildingDef[] = [
  // --- §6.1 defensive structures ---
  palisade,
  earthwork,
  steelWall,
  concreteWall,
  gate('gateWood', palisade),
  gate('gateEarth', earthwork),
  gate('gateSteel', steelWall),
  gate('gateConcrete', concreteWall),
  { id: 'moat', kind: 'moat', category: 'defense', size: [1, 1], hp: 0, cost: {}, work: 40, era: 0, tech: 'F1', height: 0, look: 'pit' },
  { id: 'waterMoat', kind: 'moat', category: 'defense', size: [1, 1], hp: 0, cost: { parts: 1 }, work: 60, era: 2, tech: 'F6a', height: 0, look: 'water', unfillable: true, fuelPerDay: 0.05 },
  { id: 'drawbridge', kind: 'bridge', category: 'defense', size: [1, 1], hp: 200, cost: { wood: 10, metal: 2 }, work: 50, era: 1, tech: 'F4a', height: 0.3, look: 'wood' },
  { id: 'tower', kind: 'tower', category: 'defense', size: [1, 1], hp: 400, cost: { wood: 20, metal: 4 }, work: 60, era: 0, tech: 'F2', height: 5, look: 'wood' },
  { id: 'barbedWire', kind: 'wire', category: 'defense', size: [1, 1], hp: 80, cost: { metal: 2 }, work: 4, era: 1, tech: 'F4b', height: 1, look: 'wire' },
  building('turret', 'defense', [1, 1], 300, { metal: 12, parts: 6 }, 80, 2, 'F7a', 2.2, 'steel', { fuelPerDay: 0.5 }), // its own little generator

  // --- §6.2 functional buildings ---
  building('hq', 'civic', [3, 3], 2000, {}, 0, 0, undefined, 4.2, 'wood', { unique: true, fixed: true, beds: 4 }),
  building('tent', 'housing', [1, 1], 60, { wood: 3 }, 6, 0, undefined, 2.0, 'cloth', { beds: 2 }),
  building('hut', 'housing', [2, 2], 200, { wood: 16 }, 30, 0, 'F1', 2.8, 'wood', { beds: 4, morale: 0 }),
  building('house', 'housing', [2, 2], 400, { wood: 20, metal: 6 }, 60, 1, 'F3', 3.2, 'brick', { beds: 6 }),
  building('apartment', 'housing', [3, 2], 900, { cement: 30, metal: 12 }, 160, 2, 'F5', 7.5, 'concrete', { beds: 16 }),
  { id: 'farm', kind: 'field', category: 'food', size: [4, 4], hp: 0, cost: {}, work: 24, era: 0, tech: 'A1', height: 0.3, look: 'soil', plots: 1 },
  building('ranch', 'food', [4, 3], 300, { wood: 30 }, 70, 1, 'A4a', 3.0, 'wood', { plots: 1, yieldMul: 1.8, morale: 2, mods: [{ key: 'raid.nightSize', op: 'mul', value: 1.2 }] }), // livestock draws the dead
  building('greenhouse', 'food', [3, 2], 150, { metal: 10, parts: 4 }, 60, 1, 'A4b', 2.6, 'glass', { plots: 1, yieldMul: 1.3, allSeason: true }), // 09: x1.3 — a game ends before the first winter, so "all season" alone never paid
  building('storehouse', 'work', [2, 2], 300, { wood: 24 }, 40, 0, 'A2', 3.0, 'wood',
    { capacity: { food: 120, ammo: 600, wood: 300, metal: 200, cement: 200, parts: 80, medicine: 30, fuel: 80 } }),
  building('workshop', 'work', [2, 2], 300, { wood: 20, metal: 8 }, 50, 0, 'W2', 3.0, 'wood', { job: { crafting: 1 } }),
  building('lab', 'work', [2, 2], 350, { wood: 16, metal: 12, parts: 6 }, 90, 1, 'S3', 3.2, 'brick', { job: { research: 1.5 } }),
  building('clinic', 'work', [2, 2], 300, { wood: 16, metal: 6 }, 70, 1, 'S4', 3.0, 'cloth', { job: { medical: 1.3 } }),
  building('hospital', 'work', [3, 3], 900, { cement: 40, metal: 20, parts: 10 }, 220, 2, 'S6a', 6.5, 'concrete', { job: { medical: 1.8 } }),
  building('canteen', 'civic', [2, 2], 300, { wood: 24, metal: 4 }, 60, 1, 'C1', 3.0, 'wood', { foodSaving: 0.1, morale: 2 }),
  building('market', 'civic', [3, 2], 300, { wood: 30 }, 70, 1, 'C4a', 2.8, 'cloth', { mods: [{ key: 'food.priceMax', op: 'mul', value: 0.8 }] }),
  building('barracks', 'civic', [3, 2], 500, { wood: 24, metal: 10 }, 90, 1, 'C4b', 3.2, 'brick', { job: { defense: 1.25 }, beds: 6 }),
  building('radio', 'civic', [1, 1], 250, { metal: 20, parts: 12 }, 120, 2, 'C6a', 14, 'steel'),
  building('generator', 'work', [1, 1], 200, { metal: 12, parts: 8 }, 60, 1, 'S5b', 1.6, 'steel', { fuelPerDay: 0.3, mods: [{ key: 'job.crafting', op: 'mul', value: 1.1 }] }),
  building('powerPlant', 'work', [3, 3], 900, { cement: 40, metal: 40, parts: 20 }, 300, 2, 'S6b', 6, 'concrete',
    // Machines in the workshop and the laboratory, floodlights on the walls.
    { fuelPerDay: 1, mods: [{ key: 'job.crafting', op: 'mul', value: 1.2 }, { key: 'job.research', op: 'mul', value: 1.2 }, { key: 'defender.hit', op: 'add', value: 0.08 }] }),
  building('tavern', 'civic', [2, 2], 300, { wood: 24 }, 60, 2, 'A6b', 3.0, 'wood', { morale: 6 }),
  building('school', 'civic', [3, 2], 600, { cement: 20, wood: 20 }, 160, 3, 'S8', 3.6, 'brick', { mods: [{ key: 'job.research', op: 'mul', value: 1.2 }] }),
  building('monument', 'civic', [1, 1], 500, { cement: 20, metal: 5 }, 100, 2, 'C5', 5, 'concrete', { morale: 3 }),
  building('capitol', 'civic', [4, 3], 3000, { cement: 120, metal: 60, parts: 30 }, 800, 3, undefined, 9, 'concrete', { unique: true, techAny: ['F9', 'S9', 'C9'] }),
];

export const BUILDINGS: Readonly<Record<string, BuildingDef>> = Object.fromEntries(DEFS.map((d) => [d.id, d]));
export const BUILDING_LIST: readonly BuildingDef[] = DEFS;

/**
 * How defenders fight, by what they hold (spec §4.5). A good rifleman on a tower downs a walker every
 * 8-10 s, an average one on the ground every 15 s; brutes take a dozen hits. Ten of them cannot stop
 * a horde of 150 on their own — that is what the player's rifle is for.
 */
export interface DefenderWeapon {
  id: string;
  /** Reach (m), seconds between shots, chance to hit, damage per hit, chance that a hit is a head shot (kills all but brutes). */
  range: number;
  interval: number;
  hit: number;
  damage: number;
  headshot: number;
  /** Rounds taken from the stores per shot. */
  ammo: number;
  tech?: string;
}
export const DEFENDER_WEAPONS: readonly DefenderWeapon[] = [
  { id: 'rifleArmor', range: 60, interval: 4, hit: 0.4, damage: 55, headshot: 0.2, ammo: 1, tech: 'W4' },
  { id: 'pistol', range: 22, interval: 2.5, hit: 0.35, damage: 40, headshot: 0.12, ammo: 1, tech: 'W4' },
  { id: 'bow', range: 30, interval: 6, hit: 0.4, damage: 60, headshot: 0.15, ammo: 0, tech: 'W3' },
  { id: 'melee', range: 2.6, interval: 1.6, hit: 0.55, damage: 34, headshot: 0.1, ammo: 0 },
];

export const BUILD = {
  /** Buildable radius around the headquarters (m); techs add to it (modifier `build.radius`). */
  radius: 120,
  /** Where a new game puts the headquarters and the first field (tile of the min corner; the map centre is tile 128). */
  start: { hq: [126, 123], farm: [134, 126] },
  /** Largest height difference under a footprint outside the levelled ground (m). */
  maxSlope: 1.5,
  /** Cancelling a blueprint returns everything delivered; demolishing returns this share of the materials. */
  demolishRefund: 0.5,
  /** Repairs: work per missing durability point, and the share of the build cost at full loss (spec §6.1). */
  repairWork: 0.02,
  repairCost: 0.5,
  /** Moats: bodies that make a tile passable, and the work to clear one (spec §6.1). */
  moatFill: 8,
  /**
   * 09: a water moat (`unfillable`) takes this many — it used to take none at all, which made a base
   * ringed by water without a bridge unreachable: every raid was "repelled" without a scratch while the
   * defenders shot the crowd on the far bank for its ears. Three times a dry ditch is still a great deal.
   */
  waterMoatFill: 24,
  moatClearWork: 10,
  /** Rubble of a broken wall stays this many game minutes. */
  rubbleMinutes: 360,
  /** Barbed wire (spec §6.1): speed factor and damage per second to whatever crosses; wear per zombie-second. */
  wireSlow: 0.3,
  wireDps: 5,
  wireWear: 1,

  // --- flow field costs (spec §3.4 / prompt D). One step on open ground costs 1. ---
  flow: {
    /** Walls and gates: 1 + hp / wallHpPerCost. */
    wallHpPerCost: 20,
    moatFilled: 3,
    /** An unfilled moat is crossed only by filling it: this much per body still missing. */
    moatPerBody: 30,
    wire: 4,
    rubble: 2,
    /** Other buildings where people shelter count as secondary goals this far "behind" the headquarters. */
    shelterBias: 15,
    /** Chase field (zombies hunting the player): rebuilt when the player has moved this far, at most this often (s). */
    chaseMove: 8,
    chaseInterval: 1,
  },

  // --- §7 raids ---
  raid: {
    /** Nightly approach: starts at this hour, the survivors of it give up at dawn. */
    nightHour: 22,
    dawnHour: 4,
    /** Share of the cell's active cap that comes — in full once the base holds nightFullPop people (they come for people). */
    nightShare: 0.3,
    nightFullPop: 12,
    nightMin: 2,
    /**
     * Horde threshold = base + perHead * population (player included). 09: base 60 -> 40 — the first
     * horde is what the threshold makes it (about 80 instead of 100 for eight people), and a player
     * alone at the rifle puts down some five a minute while fences and the headquarters buy a quarter of an hour.
     */
    hordeBase: 40,
    hordePerHead: 4,
    /**
     * Largest horde (normal difficulty; 160 / 300 / 500 through the modifier `raid.hordeMax`).
     * 09: 150 -> 300 — the threshold grows with the colony (60 people: 300), the cap did not, and a
     * late colony with rifles on its towers put 150 down without losing a wall.
     */
    hordeMax: 300,
    /**
     * 09: the dead take time to find a new settlement — over the first hordeRampDays days of a game the
     * meter takes only (day / hordeRampDays) ^ hordeRampPower of the inflow (a busy start cell filled
     * it in four days: a horde of 95 against five people on the fifth morning). With 16 days squared
     * the busiest start candidates see their first horde around day 11, the quiet ones around day 18-25.
     */
    hordeRampDays: 16,
    hordeRampPower: 2,
    /** Hours between the horde forming and its arrival; who gets told when. */
    leadHours: 6,
    warnTowerHours: 6,
    warnScoutHours: 24,
    warnBlindHours: 1,
    /** At most this many raiders walk the map at once; the rest follow in waves. */
    maxActive: 120,
    waveSize: 12,
    waveSeconds: 5,
    /** Where they appear: distance from the base centre (m) and half-width of the arc (radians). */
    spawnDist: [240, 300],
    spawnArc: 0.45,
    /** Bodies within this distance of a structure are picked clean the next morning at this rate (spec §4.5). */
    earRadius: 30,
    earRate: 0.7,
    earHour: 6,
    /** Morale for everyone when a horde has been beaten off. */
    repelMorale: 5,
    /** A zombie pressing into a moat goes over the edge after this many seconds. */
    moatFallSeconds: 4,
    /**
     * Buildings are far tougher than fences: zombies pawing at one do this share of their wall damage.
     * 09: 0.025 -> 0.035 while wall damage went to a quarter: the headquarters (2,000) lasts about a quarter
     * of an hour with sixty at it, about three times as long as before.
     */
    buildingDamage: 0.035,
    /** Zombies that can work on one wall tile at once (the abstract battle uses the same figure). */
    attackersPerTile: 5,
    /** Bites on people out in the open: damage per second and zombie within reach (m). */
    biteDps: 9,
    biteReach: 1.5,
    /** Injured below this, they leave the fight. */
    fleeHp: 30,
    /** Abstract battle (player away): seconds per round, walking time to the base, share of defenders' shots that find a target. */
    roundSeconds: 10,
    approachSeconds: 200,
    engageShare: 0.7,
    /**
     * Abstract battle, guards on the ground once the dead are inside: each keeps `awayHold` of them off;
     * per one more (per guard) the chance per round of being bitten rises by `awayBite` (09: guards on
     * towers are safe, and whoever is bitten out of the fight stops shooting — before, two guards in an
     * unwalled base "repelled" thirty without loss while the real fight lost the headquarters).
     */
    awayHold: 25,
    awayBite: 0.01,
    /** Tower: range and accuracy bonus of a defender standing on one. */
    towerRange: 1.5,
    towerHit: 0.12,
  },

  // --- §8 outposts ---
  outpost: {
    /** 07e: ears are one sixth of the 06 values (40 / 150 / 500), like wages and food. */
    tiers: [
      { ears: 7, cost: { wood: 20 } as Cost, garrison: 1, ammoCap: 60, defense: 12 },
      { ears: 25, cost: { metal: 20 } as Cost, garrison: 2, ammoCap: 200, defense: 30, tech: 'C3' },
      { ears: 83, cost: { cement: 30 } as Cost, garrison: 4, ammoCap: 600, defense: 70, tech: 'C5' },
    ],
    /** How far from the base (or another outpost) one can be founded, in cells. */
    reach: 12,
    /** Daily supply = min(shortfall, base + perTier * tier); one day of delay per `delayCells` cells to the nearest supplied point. */
    supplyBase: 20,
    supplyPerTier: 10,
    delayCells: 6,
    /** Defence value added per garrison member (x their defence aptitude / 5). */
    defensePerGuard: 10,
    /** Daily attack = zombies flowing into the cell; it falls when attack > defense * this. */
    fallFactor: 1.5,
    /** Share of the attackers the garrison puts down when it holds, and the chance each member dies when it falls. */
    killShare: 0.5,
    deathChance: 0.4,
    /** Carry limit when resupplying at an outpost is the player's (BALANCE.player.maxAmmo). */
  },
} as const;

/** Footprint [w, d] in tiles for a rotation. */
export function footprint(def: BuildingDef, rot: number): [number, number] {
  return rot % 2 === 1 ? [def.size[1], def.size[0]] : [def.size[0], def.size[1]];
}
