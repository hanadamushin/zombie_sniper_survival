// Central balance table. Every tunable number lives under src/data/** — never inline in logic.
// Each session appends its own section below (keep `as const`, keep docs/02_systems_spec.md in sync).

export const BALANCE = {
  // --- docs/02_systems_spec.md §1 (owner: 01 foundation) ---
  time: {
    /** Fixed simulation step in real seconds (60 Hz). */
    fixedStep: 1 / 60,
    /** Real seconds per game minute at x1 (1 game hour = 60 real seconds, 1 day = 24 min). */
    realSecondsPerGameMinute: 1,
    minutesPerDay: 1440,
    /** Selectable speeds. x10 is only allowed outside the tactical layer. */
    speeds: [0, 1, 3, 10] as const,
    maxTacticalSpeed: 3,
    /** The game starts on day 90 after the outbreak at 06:00. */
    startDay: 90,
    startMinute: 6 * 60,
    /** Full daylight between these hours; dawn/dusk fade over `twilightHours` outside of it. */
    dayStartHour: 6,
    dayEndHour: 18,
    twilightHours: 1,
  },

  // --- docs/02_systems_spec.md §10 (owner: 01 foundation) ---
  save: {
    autosaveHour: 6,
    manualSlots: 3,
  },

  // --- main loop guards (owner: 01 foundation) ---
  loop: {
    /** Real-time delta clamp; hides huge gaps after the tab was in the background. */
    maxFrameDt: 0.1,
    /** Hard cap of sim steps per rendered frame (x10 at 100 ms = 60 steps). */
    maxStepsPerFrame: 90,
    uiSyncHz: 10,
  },

  // --- feel of the shot (08): the world stops for a moment when the player's round takes a head ---
  feel: {
    /** Seconds of real time; long-range kills (>= hitstopFarRange m) get a little more. Never slow motion. */
    hitstop: 0.04,
    hitstopFar: 0.08,
    hitstopFarRange: 300,
  },

  // --- docs/02_systems_spec.md §2.2 infection simulation (owner: 02 map / infection) ---
  infection: {
    /** Days simulated at build time; the game starts on the last one. */
    precomputeDays: 90,
    /** Bundled scenarios (public/data/infection_<n>.bin) and their seeds. */
    scenarioSeeds: [3, 4, 8],
    sourceCount: 3,
    sourceZ: 50,
    /** Victims per zombie per day while prey is plentiful: attacked = beta * landBeta * S*Z/(S+Z+1). */
    beta: 2.2,
    /** Contact multiplier by land class (people are harder to find in the countryside). */
    landBeta: { urban: 1, suburb: 0.85, rural: 0.5, forest: 0.3, mountain: 0.2 },
    /** Share of the attacked who rise as zombies; the rest are dead (minus those who hide). */
    turnRate: 0.38,
    /** Share of the attacked who slip away and become hidden survivors (H). */
    hideOnAttack: { urban: 0.002, suburb: 0.005, rural: 0.015, forest: 0.02, mountain: 0.02 },
    /**
     * Zombies destroyed by the living: killed = rho * resist[land] * S*Z/(S+Z+1). Organised
     * resistance in the cities breaks down on resistCollapseDay; the countryside keeps fighting
     * until society itself collapses (hideStartDay).
     */
    rho: 0.08,
    resistCollapseDay: 30,
    resistEarly: { urban: 1, suburb: 1.3, rural: 3.5, forest: 5, mountain: 5 },
    resistLate: { urban: 0.25, suburb: 0.4, rural: 3.5, forest: 5, mountain: 5 },
    /** Evacuation: this share of S leaves a threatened cell every day until evacEndDay. */
    evacRate: 0.06,
    evacEndDay: 30,
    /** Long-distance spread along hub links until hubEndDay. */
    hubRate: 0.002,
    hubEndDay: 10,
    /**
     * Zombie migration. Share leaving per day = diffusionMax * Wn / (Wn + selfHold * wSelf), where
     * w = wS*S + wH*H + wBuilt*pop0 + attraction and Wn sums the passable neighbours (3 % on even
     * ground). wBuilt: the dead drift back to built-up areas, so the countryside slowly drains.
     * With no prey in sight they drift at idleDiffusion.
     */
    diffusionMax: 0.06,
    selfHold: 8,
    idleDiffusion: 0.004,
    wS: 1,
    wH: 5,
    wBuilt: 0.03,
    /** A colonist attracts like this many hidden survivors (home base and outposts). */
    colonistAsH: 2,
    /** From this day the remaining S go into hiding or perish, collapseRate of them per day. */
    hideStartDay: 60,
    collapseRate: 0.1,
    hideOnCollapse: { urban: 0.02, suburb: 0.05, rural: 0.15, forest: 0.15, mountain: 0.15 },
    /** Share of the non-hiding rest that turns (the others die). */
    collapseTurn: 0,
    lootDecay: 0.002,
  },

  // --- docs/02_systems_spec.md §2.3 / §2.4 / §1 world layer (owner: 02 map / infection) ---
  world: {
    cellAreaKm2: 100,
    /**
     * active = clamp(base + perLog * log10(1 + Z per 100 km²), min, max).
     * 07b+: raised from base 8 / perLog 14 after the playtest ("too few zombies to see").
     * The night approach on the base keeps the old scale (`nightActive`, used by sim/build/raids.ts).
     */
    active: { base: 20, perLog: 20, min: 5, max: 120 },
    /**
     * Ammunition caches left in the world (07c, playtest: "ten times as many supply points; several
     * on one map is fine"): how many per cell by land [min, max], rounds in each [min, max], and how
     * close the player must stand to take from one with B (m). They do not refill.
     */
    caches: {
      perCell: { urban: [2, 4], suburb: [1, 3], rural: [0, 2], forest: [0, 2], mountain: [0, 1] },
      ammo: [25, 60],
      reach: 4,
      /** Kept clear of the middle of the home base (m), where the stores are. */
      homeClear: 160,
    },
    /** 07c (playtest: "five times as many"): the area holds this many times `active` (up to activeMax). */
    activeMul: 5,
    activeMax: 600,
    nightActive: { base: 8, perLog: 14, min: 5, max: 120 },
    /**
     * The operation area is populated as if the cell held this many times its Z (07b+, playtest:
     * "walking is all there is"). 17 makes a 5 % danger cell (Z ≈ 41) as crowded as a 30 % one
     * (Z ≈ 700) used to be. Kills still take 1 from the cell's Z; once Z is 0 nothing new comes in.
     */
    tacticalZScale: 17,
    /** Seconds between reinforcements from the map edge (07b+: 20 -> 12). */
    respawnSeconds: 12,
    clearedBelowZ: 20,
    /** Zombie kind mix; urban cells get runner / brute x urbanBoost (then renormalised). */
    kindMix: { walker: 0.8, runner: 0.12, crawler: 0.06, brute: 0.02 },
    urbanBoost: 1.5,
    /** danger = clamp(log10(1 + Z/km²) / dangerLogDiv, 0, 1). */
    dangerLogDiv: 3,
    /**
     * Search points in a tactical map at loot = 1 (07d-3: × 1.5 — every building can be entered now and
     * the owner wants more to find; a search lowers the cell's loot by 1 / this, as before).
     */
    lootSpots: { urban: 60, suburb: 36, rural: 15, forest: 5, mountain: 2 },
    /**
     * 07d-3: search points one enterable building gives at most (spread over its floors), so that the
     * points are found in several buildings of the area; a building with a key (07d-2f: the HQ safe and
     * the armouries it opens) up to `lootPerKeyBuilding`.
     */
    lootPerBuilding: 4,
    /**
     * L6: round a place of remembrance (a memorial landmark, the Atomic Bomb Dome): no zombie of the
     * first lot or indoors, no search point and no ammunition cache within this many m of its lot.
     */
    memorialClear: 60,
    lootPerKeyBuilding: 14,
    start: {
      lands: ['rural', 'forest'],
      maxZPerKm2: 2,
      suburbRadius: 3,
      minNearbyH: 5,
      /** Prefer starts with at least this many zombies within suburbRadius (something to hunt). */
      minNearbyZ: 300,
      /** The start cell itself must hold at least this many zombies (04: something to shoot on day one). */
      minCellZ: 40,
      /** Candidates must be on a landmass at least this large and this far apart from each other. */
      minLandmass: 200,
      minSeparation: 12,
      count: 3,
      /**
       * One of the candidates comes from a busier band (07b+, after the playtest: the quiet starts had
       * too few zombies to earn the first signing fee). Same rules otherwise, but the danger of the cell
       * (dangerOf) must lie in [minDanger, maxDanger) — Z of roughly 300..700 per cell. When no such cell
       * qualifies, the slot goes to another quiet one.
       */
      busy: { count: 1, minDanger: 0.2, maxDanger: 0.3 },
      intelRadius: 2,
    },
    travel: {
      minutesPerCell: 180,
      /** Fast travel between the base and outposts (spec §8): one cell = one game hour. */
      fastMinutesPerCell: 60,
      mountainFactor: 1.5,
      diagonalFactor: 1.4,
      /** Game-time multiplier while travelling (the loop fast-forwards). */
      speed: 30,
      /** Chance of an encounter when entering a cell = danger * encounterScale (hook only for now). */
      encounterScale: 0.5,
    },
  },

  // --- docs/02_systems_spec.md §3.5 player (owner: 04 sniping) ---
  player: {
    hp: 100,
    stamina: 100,
    breath: 1,
    startWeapon: 'rifle',
    startMag: 5,
    startZoom: 4,
    /** Carried rounds at the start (spec §5 "initial ammo 100"; 05 may move part of it to the colony stock). */
    startAmmo: 100,
    maxAmmo: 150,
    /** Chance that a bite infects, and game hours until an untreated infection kills. */
    infectionChance: 0.1,
    infectionHours: 48,
    /** Falls: no damage up to `fallSafe` metres, then `fallDamagePerM` per extra metre. */
    fallSafe: 3,
    fallDamagePerM: 12,
    /** Provisional death handling until 05 ties it to the colony: seconds on the death screen, ammo floor on revival. */
    reviveSeconds: 4,
    reviveAmmo: 40,
    /** Zombies this close to the revival point are removed (m). */
    reviveClear: 60,
  },

  // --- docs/02_systems_spec.md §3.2 / §3.3 / §3.5 aiming, knife, ears (owner: 04 sniping) ---
  combat: {
    scope: {
      /** Seconds to raise / lower the scope. */
      transition: 0.25,
      /**
       * Magnification is measured against this vertical field of view ("1x" for a monitor), not
       * against the wide hip view: tan(fov / 2) = tan(reference / 2) / zoom.
       */
      referenceFov: 40,
    },
    /** Sway amplitude in mil by stance (spec §3.3). */
    swayBase: { stand: 2.4, crouch: 1.2, prone: 0.4 },
    swayMove: 1.5,
    swayFatigue: 0.8,
    /** Seconds until the just-moved factor has decayed to 0. */
    swayMoveDecay: 1.5,
    /** Breathing figure-eight period (s) and the share / frequencies (Hz) of the fine tremor on top. */
    swayPeriod: 4.6,
    tremorShare: 0.22,
    tremorHz: [1.7, 2.9, 4.3],
    /** How fast the amplitude follows its target (1/s). */
    swayEase: 4,
    /** Extra sway while the bolt is cycled. */
    swayBolt: 1.6,
    /** Holding breath: sway factor, seconds available, recovery takes `breathRecover` times as long. */
    breathFactor: 0.15,
    breathSeconds: 6,
    breathRecover: 2,
    /** Ran out of breath: sway factor for this many seconds (no holding meanwhile). */
    breathPenalty: 1.6,
    breathPenaltySeconds: 3,
    /** Recoil spring: stiffness (1/s², critically damped) and stance factors of the kick. */
    recoilStiffness: 190,
    recoilStance: { stand: 1.3, crouch: 1, prone: 0.7 },
    /** Wind (only on difficulty 2 or with flags.wind): maximum speed in m/s. */
    windMax: 6,
    knife: { range: 1.8, damage: 60, interval: 0.6, arc: 0.9 },
    ears: { perCorpse: 2, range: 2, seconds: 0.8 },
    corpse: { hours: 10, max: 200 },
    bulletLife: 4,
  },

  // --- docs/02_systems_spec.md §3.4 zombie behaviour (owner: 04; per-kind numbers are in data/zombies.ts) ---
  zombie: {
    /** Zombies alive in an area at once (07c: 150 -> 750, so that a raid of 120 still fits beside 600 roaming). */
    max: 750,
    /** Sight: distance by day / night multiplier, half field of view (radians), eye height share of the body. */
    viewDist: 40,
    nightView: 1.5,
    nightSpeed: 1.3,
    halfFov: Math.PI / 3,
    /** Alerted zombies look harder: range factor and half field of view. */
    alertView: 1.25,
    alertHalfFov: Math.PI * 0.6,
    /** A crouching / prone player is seen from less far away. */
    stanceView: { stand: 1, crouch: 0.75, prone: 0.5 },
    /** Each tree canopy over the line of sight shortens it by this share (floor: canopyMin). */
    canopyCut: 0.12,
    canopyMin: 0.45,
    /** Anything this close is noticed regardless of direction (m). */
    senseDist: 3,
    /** Seeing a body within corpseDist puts a zombie on alert for alertSeconds. */
    corpseDist: 15,
    alertSeconds: 20,
    /** A zombie that starts chasing draws others within this range to the spot (m). */
    callDist: 22,
    /** Chasers give up this long after losing sight (s). */
    loseSeconds: 8,
    wanderSpeed: 0.55,
    wanderRadius: 40,
    wanderPause: [2, 9],
    /** Melee: reach, wind-up before the hit lands, pause after it (s), vertical reach. */
    attackRange: 1.3,
    attackReach: 1.9,
    attackWindup: 0.45,
    attackCooldown: 0.9,
    attackHeight: 1.6,
    /** Seconds from death to becoming a corpse (the fall), and of the stagger after a body hit. */
    downSeconds: 1.2,
    flinchSeconds: 0.35,
    /** Spawning: keep-out distance from the player / the home base centre, cluster size and spread. */
    spawnMinDist: 90,
    edgeMinDist: 140,
    homeKeepOut: 150,
    cluster: [1, 4],
    clusterSpread: 12,
    /**
     * 07b — where the first lot stands: `spawnRoadShare` of the groups on a road, the rest where there is
     * cover (under trees, within coverDist of a building, a wreck or brush, or in a hollow at least
     * hollowDepth below the ground hollowRing away); `spawnOpenShare` of them out in the open anyway.
     */
    spawnRoadShare: 0.15,
    clusterTries: 4,
    spawnOpenShare: 0.3,
    coverDist: 9,
    hollowRing: 22,
    hollowDepth: 1.1,
    /** Brush hides the player only from zombies further away than this (m). */
    brushNear: 6,
    /**
     * 07d-3 — zombies inside the enterable buildings: `share` of an area's first lot by land class,
     * placed `perBuilding` at a time in the rooms (a few buildings per step: `buildingsPerStep`). The
     * building's weight: hospitals, stations, airports and SDF bases hold more (`weights` by type id
     * prefix, the first that matches), the rooms by floor area and use (`rooms`). Not within
     * `playerClear` m of the player.
     */
    indoor: {
      share: { urban: 0.3, suburb: 0.25, rural: 0.15, forest: 0.1, mountain: 0.1 } as Record<string, number>,
      perBuilding: [1, 4] as [number, number],
      buildingsPerStep: 3,
      playerClear: 40,
      weights: [['landmark.hashima', 2], ['landmark.', 0], ['public.hospital', 4], ['transport.', 4], ['base.j', 4], ['military.', 2.5], ['public.', 1.6], ['shop.', 1.2], ['office.', 1]] as [string, number][],
      rooms: { ward: 2.5, train: 2, platform: 1.5, lobby: 1.5, barracks: 1.5, hall: 0.8, stairs: 0, roof: 0.3, toilet: 0.4, closet: 0.2, bath: 0.4 } as Record<string, number>,
    },
    /** LOD: beyond these distances a zombie is updated every 2nd / 4th step (with a longer dt). */
    lodMid: 80,
    lodFar: 200,
    /** 07c: beyond this distance from the player (m) a zombie that is not chasing or raiding is not updated at all. */
    freezeDist: 650,
    /** Steps between sight checks of one zombie. */
    senseEvery: 12,
    /** Stuck handling: metres of side-stepping per detour — the first one, and the cap as they grow. */
    detourSeconds: [2.5, 30],
    turnRate: 5,
    gravity: 18,
    stepUp: 0.5,
  },

  // --- firing range (04, debug): distances of the target lines (m) ---
  range: {
    distances: [100, 200, 300, 400, 500, 600],
    firingLine: [512, 960],
    laneSpacing: 9,
    walkerLane: [40, 70],
    respawnSeconds: 4,
    ammo: 999,
  },

  // --- research (placeholder; owner: 07 tech) ---
  research: {
    defaultAllocation: { F: 20, W: 20, A: 20, S: 20, C: 20 },
  },

  // --- docs/02_systems_spec.md §3.12 the hidden stashes (O1). The owner wants them overwhelming: far and
  // dangerous, but worth it. 09 keeps them so (prompts/O1). Same place and contents in every game. ---
  /** The last SDF depot of Okinawa: in the Naha garrison (陸自 那覇駐屯地, cell 35906, base.jgsdf_s). */
  okinawa: {
    cell: 35906,
    /** Where the strategic map shows the rumour (one clue): the middle of the main island (Okinawa City). */
    rumourCell: 35573,
    /** The host building: the first placement in the cell whose type starts with one of these. */
    host: ['base.jgsdf', 'base.', 'military.camp_battalion', 'military.'],
    /** What lies there (the supply point: B; taken a carry at a time or by expeditions). */
    stock: { ammo: 100_000 } as Partial<Record<'ammo' | 'wood' | 'metal' | 'cement' | 'parts' | 'medicine' | 'fuel' | 'food', number>>,
    /** Ears in the commander's safe: once, into the pack (handed in at home). */
    vault: 10_000,
    /** The supply point needs the area's key (the depot is locked until the safe is found). */
    locked: true,
    /** Elite survivors hiding in the HQ's armory (ja.ts `stash.elite.<id>` is not needed: names here). */
    elites: [
      { name: '比嘉 隼人', trait: 'specops' },
      { name: '仲宗根 葵', trait: 'specops' },
      { name: '上原 誠', trait: 'specops' },
      { name: '島袋 礼子', trait: 'scientist' },
    ] as readonly { name: string; trait: string }[],
    /** What one member of an expedition carries home from the stash (limited by the room in the stores). */
    carryPerMember: 1000,
  },
  /** Hashima (端島, 軍艦島, cell 23901): builders holed up in the old flats with their materials. */
  hashima: {
    cell: 23901,
    rumourCell: 23901,
    host: ['landmark.hashima'],
    stock: { wood: 10_000, metal: 10_000, cement: 10_000, parts: 10_000, fuel: 10_000, medicine: 1_000 } as Partial<Record<'ammo' | 'wood' | 'metal' | 'cement' | 'parts' | 'medicine' | 'fuel' | 'food', number>>,
    vault: 0,
    locked: false,
    elites: [
      { name: '浦川 剛', trait: 'masterBuilder' },
      { name: '岩永 千秋', trait: 'masterBuilder' },
      { name: '松尾 鉄平', trait: 'artisan' },
    ] as readonly { name: string; trait: string }[],
    carryPerMember: 150,
    /** What the player takes per B (each material; the pack has no limit for them, the stash does). */
    playerCarry: { wood: 100, metal: 100, cement: 100, parts: 100, fuel: 100, medicine: 20 } as Partial<Record<'wood' | 'metal' | 'cement' | 'parts' | 'medicine' | 'fuel', number>>,
    /** Game minutes the boat takes between the Nagasaki shore and the island. */
    boatMinutes: 60,
    /** Zombies on the island when the player lands (a few: it was empty before the fall). */
    zombies: 8,
    /** Reach of E at a landing (m). */
    dockReach: 4,
  },
  /** Every elite (both stashes): all four stats at the top, the lowest wage (the fee follows: 1 ear). */
  elite: { stat: 10, wage: 0.2 },
  /** Clues at the landmarks (data/landmarks `clues`): the reach of E and how many open the stash's cell on the map. */
  clues: { reach: 3.5, okinawaExact: 2, hashimaExact: 1 },
} as const;

