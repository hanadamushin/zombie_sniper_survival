// Colony numbers: survivors, jobs, economy, morale, health, expeditions (docs/02_systems_spec.md §4, §5).
// Owner: 05 colony. Later sessions tune values here; logic never carries literals.

import type { JobId, Land, ResourceId } from '../core/types.ts';

export type LootTable = Partial<Record<ResourceId, number>>;

export const COLONY = {
  // --- §4.1 generation ---
  survivor: {
    /** Stats are (dice)d(sides) - offset, clamped to 1..10: 3d4-2 gives a bell around 5.5. */
    statDice: 3,
    statSides: 4,
    statOffset: 2,
    /** Where a person grew up shifts one stat. */
    landBias: { urban: { kno: 1 }, suburb: {}, rural: { ath: 1 }, forest: { ath: 1 }, mountain: { ath: 1 } } as Record<Land, { ath?: number; kno?: number }>,
    /** wage = max(1, round((wageBase + wagePerPoint * (sum - wageSumRef)) * trait factor)) ears / day. */
    wageBase: 2,
    wagePerPoint: 0.6,
    wageSumRef: 16,
    /** Signing fee = wage x this. */
    feeDays: 5,
    morale: 60,
    hp: 100,
    defaultWeapon: 'melee',
  },

  // --- §4.2 work ---
  work: {
    /** output/h = aptitude * (speedBase + speedPer * spd) * moraleFactor * healthFactor * facility * trait. */
    speedBase: 0.5,
    speedPer: 0.1,
    /** moraleFactor = moraleBase + morale / 100. */
    moraleBase: 0.5,
    /** healthFactor = healthBase + (1 - healthBase) * hp / 100 while fit for work, 0 otherwise. */
    healthBase: 0.6,
    /** Daily working hours = hoursBase + hoursPerSta * sta. */
    hoursBase: 6,
    hoursPerSta: 0.6,
    /** Food per day = mealBase - mealPerSta * sta, eaten in `meals` equal parts. */
    mealBase: 1.3,
    mealPerSta: 0.06,
  },
  /** Aptitude weights per job: [athletics, knowledge]. */
  aptitude: {
    idle: [0, 0],
    farming: [0.6, 0.4],
    defense: [0.8, 0.2],
    scavenging: [0.7, 0.3],
    construction: [0.9, 0.1],
    research: [0, 1],
    crafting: [0.4, 0.6],
    medical: [0.1, 0.9],
  } as Record<JobId, readonly [number, number]>,

  /** The day in game minutes. Work runs from workStart for the survivor's hours, with the lunch break on top. */
  schedule: {
    wake: 5 * 60,
    breakfast: 5 * 60 + 30,
    workStart: 6 * 60,
    lunch: 12 * 60,
    lunchEnd: 13 * 60,
    dinner: 19 * 60 + 30,
    dinnerEnd: 20 * 60,
    sleep: 21 * 60 + 30,
    /** Morning settlement: wages (spec §5). */
    payday: 6 * 60,
  },

  // --- §5 economy ---
  economy: {
    /** Stock at the start (the 100 rounds of spec §5 are carried by the player, see BALANCE.player.startAmmo). */
    initialStock: { food: 6, medicine: 1 } as LootTable,
    /** Storage of the bare headquarters; buildings add to it (06). Ears take no room. */
    baseCapacity: { ears: 1e9, food: 60, ammo: 600, wood: 200, metal: 120, cement: 120, parts: 60, medicine: 20, fuel: 60 } as Record<ResourceId, number>,
    foodBasePrice: 2,
    /** price = base * clamp(priceTop - pricePerDay * days of food in stock, priceMin, priceMax). */
    priceTop: 1.6,
    pricePerDay: 0.1,
    priceMin: 0.6,
    priceMax: 2.5,
    /** The community buys from its farmers until the stock covers this many days. */
    targetFoodDays: 3,
    /** Unsold produce the farmers can keep: a flat amount plus this much per farmer; the rest rots. */
    marketBase: 10,
    marketPerFarmer: 8,
    /** Neutral farming villages: price factor, daily limit, and how to tell that one is near. */
    villageFactor: 1.8,
    villageDailyCap: 12,
    villageRadius: 3,
    villageMinPeople: 50,
    /** With the auto-buy policy on, the village is used when the stock falls below this many days. */
    autoBuyBelowDays: 1,
    ledgerDays: 30,
    logMax: 200,
  },
  farm: {
    /** One plot yields this much food per day from a reference farmer (refPoints of farming output per day). */
    foodPerPlotDay: 4,
    refPoints: 45,
    /** Farmers one plot keeps fully busy; the others on it work at crowdedFactor. */
    workersPerPlot: 2,
    crowdedFactor: 0.3,
    /** Day of the year (0..364) on which the outbreak began; the game starts 90 days later, in early summer. */
    outbreakDayOfYear: 60,
    /** Yield factor per month, January first (winter 0.4). */
    season: [0.4, 0.4, 0.7, 1, 1, 1, 1.1, 1.1, 1, 0.9, 0.7, 0.4],
  },
  craft: {
    /** One batch: `work` crafting points and these materials make `ammo` rounds. */
    work: 6,
    metal: 1,
    parts: 0.2,
    ammo: 10,
    /** Efficiency without a workshop (hand work). */
    handFactor: 0.5,
  },
  /** Research points wait here for 07 (takeResearchPoints); construction points for 06. Caps keep them bounded. */
  buffers: { research: 600, build: 60, medical: 24 },
  /** Work per blueprint for distributeBuildWork() callers that pass none (the game uses data/buildings.ts through sim/build/construction.ts). */
  defaultBuildWork: 40,

  // --- §4.3 morale ---
  morale: {
    fed: 2,
    hungry: -10,
    starving: -25,
    unpaid: -15,
    housed: 1,
    homeless: -3,
    death: -8,
    /** Below `desertBelow` for `desertDays` days in a row: gone, with some of the stores. */
    desertBelow: 20,
    desertDays: 3,
    /** A deserter takes up to wage x stealWageDays ears and stealFood food. */
    stealWageDays: 3,
    stealFood: 2,
  },

  // --- health ---
  health: {
    /** A day without any meal costs this much hp. */
    starveHp: 15,
    /** Hp per hour for anyone resting at home; the injured are fit again at fitHp. */
    restPerHour: 0.5,
    fitHp: 70,
    /** Anyone can dress a wound: medical points per hour the colony has without a medic. */
    firstAidPerHour: 0.5,
    /** Curing an infection: medical points and medicine. Hp healed per spare medical point. */
    cureWork: 8,
    cureMedicine: 1,
    hpPerPoint: 1.5,
    infectionHours: 48,
    /** The player resting in the home cell. */
    playerRestPerHour: 2,
    /** Days the player is out after dying (spec §3.5). */
    recoverDays: 3,
    /** The colony scrapes together at least this many rounds for the player's return. */
    recoverAmmo: 20,
  },

  // --- §4.4 expeditions ---
  expedition: {
    minMembers: 2,
    maxMembers: 6,
    radius: 3,
    searchHours: 8,
    /** p = clamp(base + ath * perAth + spd * perSpd + weapon + (n - 1) * perMember - danger * dangerWeight, min, max). */
    base: 0.55,
    perAth: 0.04,
    perSpd: 0.02,
    perMember: 0.03,
    dangerWeight: 0.45,
    min: 0.05,
    max: 0.99,
    /** Those who fail: this share dies, the rest come back injured (hp in the given range); some of them bitten. */
    deathShare: 0.5,
    injuredHp: [25, 55],
    infectedShare: 0.3,
    /** The injured carry this share of a healthy load. */
    injuredCarry: 0.4,
    /** Cell loot used up per scavenging point. */
    lootPerPoint: 0.0004,
    /** Ears brought home per zombie killed on the way. */
    earsPerKill: 0.8,
    /** Chance to find hidden people (when the cell has any), plus perMember for each extra member; group size range. */
    rescueChance: 0.3,
    rescuePerMember: 0.05,
    rescueGroup: [1, 2],
  },
  /** Scavengers who stay home comb the home cell: same table, this share of the points, no risk. */
  forageFactor: 0.3,

  // --- recruits ---
  encounter: {
    /** Hideouts in an operation area = clamp(round(log10(1 + H)), 0, maxPerArea), at most one per search point. */
    maxPerArea: 3,
    /** Chance that two people share a hideout. */
    pairChance: 0.25,
    /** Days before a cell hides new people after its hideouts were set up. */
    cooldownDays: 2,
    /** Reach of E (m), and how far the HUD senses a hideout. */
    reach: 3,
    senseDist: 160,
    /** Candidates wait this many days for an offer. */
    waitDays: 4,
    maxCandidates: 12,
  },
  /** The player searching a building: scavenging points per search point. */
  search: { points: 14, spread: [0.5, 1.5] },

  // --- where people stand inside the base (metres from the centre of the headquarters; x east, z south).
  // Work and sleep happen in the real buildings (06); these are the spots used while a building is missing.
  camp: {
    fire: [-6, 13],
    bench: [-10, 9.5],
    desk: [5, 8.5],
    clinic: [10, 10],
    yard: [0, 22],
    /** Foragers roam between the two radii. */
    forage: [60, 105],
    /** New arrivals walk in from here (metres from the map centre). */
    gate: [20, 70],
    walkSpeed: 1.5,
    /** Minutes after which a worker picks another spot inside the work site. */
    shuffleMinutes: 20,
  },
} as const;

/** Scavenging yield per point at loot = 1, by land class (spec §4.4 "land table"). */
export const LOOT_TABLE: Record<Land, LootTable> = {
  urban: { food: 0.07, ammo: 0.05, wood: 0.02, metal: 0.08, cement: 0.04, parts: 0.045, medicine: 0.015, fuel: 0.02 },
  suburb: { food: 0.08, ammo: 0.025, wood: 0.04, metal: 0.05, cement: 0.025, parts: 0.025, medicine: 0.01, fuel: 0.015 },
  rural: { food: 0.07, ammo: 0.01, wood: 0.07, metal: 0.025, cement: 0.01, parts: 0.01, medicine: 0.004, fuel: 0.01 },
  forest: { food: 0.03, ammo: 0.002, wood: 0.12, metal: 0.006, parts: 0.003, medicine: 0.001 },
  mountain: { food: 0.015, wood: 0.06, metal: 0.01, parts: 0.002 },
};

/** What an expedition can be sent out with (spec §4.4). `tech` (07) gates availability when set. */
export interface ExpeditionWeapon {
  id: string;
  bonus: number;
  /** Rounds taken from the stock per member. */
  ammo: number;
  /** Zombies one member puts down on a trip into a fully dangerous cell. */
  kills: number;
  tech?: string;
}
export const EXPEDITION_WEAPONS: readonly ExpeditionWeapon[] = [
  { id: 'unarmed', bonus: 0, ammo: 0, kills: 0 },
  { id: 'melee', bonus: 0.08, ammo: 0, kills: 2 },
  { id: 'bow', bonus: 0.15, ammo: 0, kills: 4 },
  { id: 'pistol', bonus: 0.22, ammo: 6, kills: 5 },
  { id: 'rifleArmor', bonus: 0.3, ammo: 12, kills: 10 },
];
export function expeditionWeapon(id: string): ExpeditionWeapon | undefined {
  return EXPEDITION_WEAPONS.find((w) => w.id === id);
}
