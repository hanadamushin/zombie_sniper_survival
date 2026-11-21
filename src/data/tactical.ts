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
    /** Radians per pixel of mouse movement (scaled down with the scope magnification). 07b: +25 % after the first playtest (was 0.0027). */
    lookSensitivity: 0.003375,
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
    /** R0: deepest water walked into (m), and the speed factor while wading. */
    wadeMax: 1.2,
    wadeFactor: 0.55,
  },

  /**
   * Enterable buildings (07d, gen/buildings, sim/tactical/indoor.ts). Blueprints and their world
   * collision are generated the first time something touches a building and kept in LRU caches of
   * these sizes. Zombies chasing the player find their way through rooms and doors only for the
   * buildings within `routeRange` of the player.
   */
  interior: {
    blueprints: 256,
    details: 160,
    routeRange: 90,
    /** A chasing zombie heads straight for a door within this distance (further out it follows the flow field). */
    doorApproach: 30,
    /** A waypoint counts as reached within this (m, horizontal) and this height difference. */
    reach: 0.45,
    reachY: 0.9,
    /** While a chasing zombie is on its way through a building, it loses track of an unseen player this much slower. */
    lostRate: 0.25,
    /** ...and within this distance of the player it does not lose track at all (it hears them inside). */
    hear: 25,
    /** 07d-2d: a route between two rooms of a building that steps outside (out of one door, in at another) counts this many extra links, so a way inside wins when there is one. */
    outsideCost: 4,
  },
  /**
   * 07d samples standing in for some of 03's generated buildings (the rest stay boxes until 07d-3
   * places every building as a type): the share of suburban / rural houses, suburban shops, car-park
   * shops and urban offices that become the enterable sample of their kind (when the lot fits).
   */
  enterable: {
    house: 0.35,
    shop: 0.6,
    office: 0.25,
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

  /**
   * Continuity with the neighbouring cells (07c, gen/world.ts). blend: half width of the band on each
   * side of a border over which the land classes' relief is mixed (m). seaDrop: how far below the
   * rural level the ground of a sea cell lies. gateChance / gateWild: chance that a road crosses a
   * shared edge (between two forest / mountain cells: a track); gateMargin: gates stay this far from
   * the corners. editFade: road beds, dikes and creeks fade out over this distance from the edge (m).
   */
  world: {
    blend: 120, seaDrop: 7, gateChance: 0.65, gateWild: 0.45, gateMargin: 170, editFade: 40,
    /** Walking over an open edge: how far past it the player may stand before the handoff (m). */
    crossOver: 0.5,
    /** Zombies within this distance of the player (or chasing) follow across the border (m). */
    carry: 70,
    /** Areas just left are kept in memory (zombies, bodies, searched spots) this many at a time, so stepping back finds them as they were. */
    parked: 4,
  },

  /** Tiles steeper than this (rise / run) are not walkable for the nav grid. */
  navMaxSlope: 0.9,

  /** Vantage points: at least this many per map, hills must rise this far above the median ground; hill tops are kept clear of trees within hillClear, and of trees taller than the viewer within hillView. */
  vantage: { min: 3, hillProminence: 9, separation: 200, towerHeight: 12, hillClear: 30, hillView: 130 },

  /**
   * Terrain per land class. amp / wave: fbm amplitude (m) and base wavelength (m);
   * ridge: amplitude of the ridged component; hills: extra rounded hills [count, minH, maxH].
   * 07b — mid / midWave: a second, shorter undulation (m) that makes knolls and hollows a walker
   * cannot see over; knolls: small extra hills [count, minH, maxH] (40..70 m across).
   */
  terrain: {
    urban: { amp: 1.5, wave: 700, ridge: 0, hills: [0, 0, 0], mid: 0, midWave: 150, knolls: [0, 0, 0] },
    suburb: { amp: 4, wave: 600, ridge: 0, hills: [1, 12, 18], mid: 0, midWave: 150, knolls: [0, 0, 0] },
    rural: { amp: 7, wave: 520, ridge: 0, hills: [3, 20, 34], mid: 2.8, midWave: 150, knolls: [5, 5, 9] },
    forest: { amp: 38, wave: 560, ridge: 22, hills: [2, 20, 40], mid: 2.5, midWave: 110, knolls: [0, 0, 0] },
    mountain: { amp: 60, wave: 680, ridge: 120, hills: [0, 0, 0], mid: 0, midWave: 150, knolls: [0, 0, 0] },
  },

  /**
   * Cover (07b): what breaks the view of someone on foot. Sizes in metres. Brush hides but does not
   * stop bullets or walkers; logs and wrecks are solid. The numbers were tuned against the share of
   * 200 m ground-level sight lines that stay open (tests/sight.test.ts): rural 25..45 %, forest < 15 %.
   */
  cover: {
    /** Lines of sight and what a hedge may stand next to: clearance from buildings, from the map edge. */
    buildingGap: 1.5,
    edge: 5,
    /** Brush stays this far from the foot of a roof / tower vantage point. */
    vantageGap: 9,
    rural: {
      /** Embankments across the map: [min, max] count, crest height, half width of the flat crest, width of each slope. */
      dikes: [1, 2],
      dikeHeight: [2.4, 3.2],
      dikeCrest: 2,
      dikeSlope: 7,
      /** Field plots are levelled into terraces when the ground under them differs by less than this. */
      terraceMaxRange: 6.5,
      /** Chance per field side (north and west) of a hedge, and of a windbreak (hedge + a row of conifers) instead. Paddies get `paddyFactor` of both. */
      hedge: 0.34,
      windbreak: 0.12,
      paddyFactor: 0.45,
      hedgeRadius: [0.9, 1.3],
      hedgeHeight: [2.2, 3],
      windbreakHeight: 3.3,
      windbreakTreeEvery: 6,
      /** Gap left in a hedge for a gate. */
      gate: 5,
      /** Homestead groves: hedge this far from the house walls on two sides, with trees. */
      groveGap: 6,
      groveHeight: 3.2,
      bamboo: [4, 6],
      bambooRadius: [7, 11],
      bambooLength: [0, 26],
      bambooHeight: 7.5,
      /** Reed / tall-grass beds on rough ground, and share of dry fields left to overgrow (each gets a few beds). */
      reeds: [14, 20],
      reedRadius: [5, 9],
      reedLength: [0, 28],
      reedHeight: 2.3,
      overgrown: 0.22,
      overgrownBeds: [2, 4],
      bushes: 220,
      bushRadius: [1.6, 3.4],
      bushHeight: [1.9, 2.8],
      /** Scenery: lone barns / sheds out in the fields, greenhouse frames, wrecks on the roads. */
      barns: [5, 8],
      greenhouses: [3, 5],
      wrecks: [4, 7],
    },
    forest: {
      /** Undergrowth thickets per hectare of wooded ground (open ground gets `openFactor` of it). */
      thicketsPerHa: 40,
      openFactor: 0.35,
      thicketRadius: [1.8, 4.2],
      thicketHeight: [1.9, 2.7],
      logs: 150,
      logLength: [4, 9],
      logThickness: [0.5, 0.85],
      /** The track and the creek stay clear of undergrowth and logs this far to each side: the sight lanes. */
      laneClear: 7,
      /** Creek: depth of the cut, half width of its bed, width of each bank. */
      creekDepth: 2.2,
      creekBed: 2.5,
      creekBank: 7,
    },
  },

  /** Vegetation density per land: trees per hectare in wooded patches, share of the map that is wooded, grass tufts per hectare, rocks per km². */
  flora: {
    urban: { treesPerHa: 12, wooded: 0.0, street: 0.5, grassPerHa: 120, rocks: 0, conifer: 0.1 },
    suburb: { treesPerHa: 30, wooded: 0.04, street: 0.35, grassPerHa: 120, rocks: 10, conifer: 0.2 },
    rural: { treesPerHa: 120, wooded: 0.16, street: 0, grassPerHa: 260, rocks: 40, conifer: 0.35 },
    forest: { treesPerHa: 130, wooded: 0.62, street: 0, grassPerHa: 300, rocks: 260, conifer: 0.6 },
    mountain: { treesPerHa: 95, wooded: 0.4, street: 0, grassPerHa: 160, rocks: 420, conifer: 0.85 },
  },

  /** Town layout: road spacing range and widths (m). */
  town: {
    urban: { blockMin: 84, blockMax: 124, street: 9, avenue: 22, avenueEvery: 3, lotMin: 20, lotMax: 40, openShare: 0.14, climbable: 6 },
    suburb: { blockMin: 64, blockMax: 92, street: 6, avenue: 11, avenueEvery: 5, lotMin: 13, lotMax: 18, openShare: 0.1, climbable: 4 },
  },
} as const;
