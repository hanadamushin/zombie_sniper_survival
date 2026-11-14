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
    /** active = clamp(base + perLog * log10(1 + Z per 100 km²), min, max). */
    active: { base: 8, perLog: 14, min: 5, max: 120 },
    respawnSeconds: 20,
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
      /** Candidates must be on a landmass at least this large and this far apart from each other. */
      minLandmass: 200,
      minSeparation: 12,
      count: 3,
      intelRadius: 2,
    },
    travel: {
      minutesPerCell: 180,
      mountainFactor: 1.5,
      diagonalFactor: 1.4,
      /** Game-time multiplier while travelling (the loop fast-forwards). */
      speed: 30,
      /** Chance of an encounter when entering a cell = danger * encounterScale (hook only for now). */
      encounterScale: 0.5,
    },
  },

  // --- initial player values (placeholder; owner: 04 sniping) ---
  player: {
    hp: 100,
    stamina: 100,
    breath: 1,
    startWeapon: 'rifle',
    startMag: 5,
    startZoom: 4,
  },

  // --- research (placeholder; owner: 07 tech) ---
  research: {
    defaultAllocation: { F: 20, W: 20, A: 20, S: 20, C: 20 },
  },
} as const;

