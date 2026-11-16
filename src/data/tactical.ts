// Tactical layer constants (owner: 03 tactical world): operation-area geometry, player movement
// and the per-land map-generation parameters. docs/02_systems_spec.md §3.6 mirrors the player part.

export const TACTICAL = {
  /** Operation area: 1024 m square, height samples and nav tiles every 4 m. */
  size: 1024,
  tile: 4,
  /** Static / dynamic spatial hash cell (m). */
  hashCell: 16,
  /** Home base: radius kept flat and empty, and where the flattening has faded out (m). */
  homeFlatRadius: 120,
  homeBlendRadius: 210,
  /** Coarse terrain outside the playable square (render only): cell size and number of rings. */
  apronCell: 64,
  apronRings: 13,

  player: {
    radius: 0.35,
    /** Body height by stance (collision) and eye height above the feet (camera, view ray). */
    bodyHeight: { stand: 1.8, crouch: 1.15, prone: 0.45 },
    eyeHeight: { stand: 1.7, crouch: 1.0, prone: 0.3 },
    /** Eye height approaches its target at this rate (1/s). */
    eyeRate: 9,
    /** Speeds in m/s. */
    walk: 1.6,
    sprint: 5.0,
    crouch: 1.0,
    prone: 0.4,
    /** Velocity approaches the wanted velocity at this rate (1/s). */
    accel: 12,
    /** Radians per pixel of mouse movement. */
    lookSensitivity: 0.0027,
    maxPitch: 1.5,
    /** Ledges up to this height are stepped onto; anything higher blocks. */
    stepUp: 0.5,
    gravity: 18,
    maxFallSpeed: 40,
    /** Stamina (0..max): drained by sprinting, recovered otherwise (faster when standing still). */
    staminaMax: 100,
    sprintDrain: 9,
    staminaRegenMoving: 5,
    staminaRegenIdle: 11,
    /** After running dry, sprinting needs at least this much again. */
    sprintMinStamina: 15,
    /** Slope (rise / run): full speed below `slopeFree`, `slopeMinFactor` of it above `slopeMax` when going uphill. */
    slopeFree: 0.55,
    slopeMax: 1.2,
    slopeMinFactor: 0.12,
    ladderSpeed: 1.5,
    /** Looking down steeper than this while on a ladder makes "forward" climb down. */
    ladderDownPitch: -0.6,
    /** Keep-out margin at the edge of the map (m). */
    edgeMargin: 2,
  },

  stairs: {
    rise: 0.3,
    /** Horizontal length of one flight and of a landing, lane width (m). */
    flightRun: 4,
    landing: 1.2,
    lane: 1.2,
    /** Height gained per flight (a storey). */
    flightRise: 3,
  },

  /** Tiles steeper than this (rise / run) are not walkable for the nav grid. */
  navMaxSlope: 0.9,

  /** Vantage points: at least this many per map, hills must rise this far above the median ground; hill tops are kept clear of trees within hillClear, and of trees taller than the viewer within hillView. */
  vantage: { min: 3, hillProminence: 9, separation: 200, towerHeight: 12, hillClear: 30, hillView: 130 },

  /**
   * Terrain per land class. amp / wave: fbm amplitude (m) and base wavelength (m);
   * ridge: amplitude of the ridged component; hills: extra rounded hills [count, minH, maxH].
   */
  terrain: {
    urban: { amp: 1.5, wave: 700, ridge: 0, hills: [0, 0, 0] },
    suburb: { amp: 4, wave: 600, ridge: 0, hills: [1, 12, 18] },
    rural: { amp: 7, wave: 520, ridge: 0, hills: [3, 20, 34] },
    forest: { amp: 38, wave: 560, ridge: 22, hills: [2, 20, 40] },
    mountain: { amp: 60, wave: 680, ridge: 120, hills: [0, 0, 0] },
  },

  /** Vegetation density per land: trees per hectare in wooded patches, share of the map that is wooded, grass tufts per hectare, rocks per km². */
  flora: {
    urban: { treesPerHa: 12, wooded: 0.0, street: 0.5, grassPerHa: 120, rocks: 0, conifer: 0.1 },
    suburb: { treesPerHa: 30, wooded: 0.04, street: 0.35, grassPerHa: 120, rocks: 10, conifer: 0.2 },
    rural: { treesPerHa: 120, wooded: 0.16, street: 0, grassPerHa: 260, rocks: 40, conifer: 0.35 },
    forest: { treesPerHa: 130, wooded: 0.62, street: 0, grassPerHa: 300, rocks: 160, conifer: 0.6 },
    mountain: { treesPerHa: 95, wooded: 0.4, street: 0, grassPerHa: 160, rocks: 420, conifer: 0.85 },
  },

  /** Town layout: road spacing range and widths (m). */
  town: {
    urban: { blockMin: 84, blockMax: 124, street: 9, avenue: 22, avenueEvery: 3, lotMin: 20, lotMax: 40, openShare: 0.14, climbable: 6 },
    suburb: { blockMin: 64, blockMax: 92, street: 6, avenue: 11, avenueEvery: 5, lotMin: 13, lotMax: 18, openShare: 0.1, climbable: 4 },
  },
} as const;
