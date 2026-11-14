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

