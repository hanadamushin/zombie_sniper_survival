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
    nightActive: { base: 8, perLog: 14, min: 5, max: 120 },
    /** Seconds between reinforcements from the map edge (07b+: 20 -> 12). */
    respawnSeconds: 12,
    clearedBelowZ: 20,
    /** Zombie kind mix; urban cells get runner / brute x urbanBoost (then renormalised). */
    kindMix: { walker: 0.8, runner: 0.12, crawler: 0.06, brute: 0.02 },
    urbanBoost: 1.5,
    /** danger = clamp(log10(1 + Z/km²) / dangerLogDiv, 0, 1). */
    dangerLogDiv: 3,
    /** Lootable buildings in a tactical map at loot = 1. */
    lootSpots: { urban: 40, suburb: 24, rural: 10, forest: 3, mountain: 1 },
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
    max: 150,
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
    /** LOD: beyond these distances a zombie is updated every 2nd / 4th step (with a longer dt). */
    lodMid: 80,
    lodFar: 200,
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
} as const;

