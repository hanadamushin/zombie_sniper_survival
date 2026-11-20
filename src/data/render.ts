// Rendering constants (camera, view distance, sky colours). Colours are 0xRRGGBB.

export const RENDER = {
  camera: {
    fov: 70,
    near: 0.1,
    far: 1500,
    /** How fast the eye follows steps / stairs vertically (1/s). */
    stepRate: 16,
    /** Command layer: how steeply the overhead camera looks down (radians). Distance and heading: core/view.ts. */
    commandPitch: 1.04,
  },
  /** Visibility 800 m + fog (docs/04_architecture.md §8). */
  /** 04 moved the start of the fog from 150 m to 260 m: targets at 300 m+ must keep their silhouette. */
  fog: { near: 260, far: 800 },
  maxPixelRatio: 2,
  /**
   * Automatic resolution (04): when the average frame time (smoothed over `smooth` seconds) stays
   * above `slowMs` for `downSeconds`, the render scale drops by `step` (two steps when it is over
   * twice the limit), down to `min`. When frames stay under `fastMs` for `upSeconds` it is raised
   * again; a raise that fails within `failSeconds` doubles the wait before the next try.
   */
  resolution: { slowMs: 20, fastMs: 17.5, step: 0.125, min: 0.5, smooth: 0.5, downSeconds: 1, upSeconds: 3, failSeconds: 4, maxBackoff: 16 },
  /**
   * Terrain level of detail (07c): a 256 m chunk of ground is drawn with every 4 m sample when the
   * camera is closer than `full`, every 8 m closer than `half`, every 16 m closer than `far`, and not
   * at all beyond (the fog has hidden it). Neighbouring maps are drawn when the camera is within
   * `neighbours` of their square (`neighboursFromAbove` in the command layer, whose camera sees everything).
   */
  terrainLod: { full: 200, half: 480, far: 900, neighbours: 860, neighboursFromAbove: 300 },
  /** Anisotropic filtering of the ground texture (keeps roads sharp at grazing angles). */
  groundAnisotropy: 4,
  /** Operation area edge length (m). */
  areaSize: 1024,
  sky: {
    day: { sky: 0x8fb8d8, fog: 0xa9c4d6, ground: 0x4a5a3a, sun: 0xfff2dc },
    twilight: { sky: 0xd98a5a, fog: 0xc08a6a, ground: 0x3a3a2c, sun: 0xff9a5a },
    night: { sky: 0x070b16, fog: 0x0a0f1a, ground: 0x10151a, sun: 0x8fa6d8 },
    ambientDay: 2.4,
    /** Night-vision scope (W7): ambient light and its tint while looking through it in the dark. */
    nightVision: { ambient: 2.6, color: 0x7dff8a },
    ambientNight: 0.75,
    sunDay: 2.2,
    sunNight: 0.5,
  },
  /** Sky dome, sun / moon discs and night ambient (03). Hours: the sun is above the horizon between rise and set. */
  celestial: {
    sunrise: 5,
    sunset: 19,
    sunSize: 0.03,
    moonSize: 0.024,
    moon: 0xcfd8ea,
    zenithDay: 0x5f93c4,
    zenithNight: 0x0a1020,
    /** Colour of the ambient light at night (the sky itself stays dark). */
    ambientNightColor: 0x7f93c8,
    stars: 0.9,
  },

  // --- tactical world palette (03): muted, low-saturation colours, 0xRRGGBB ---
  ground: {
    grass: { urban: 0x66735a, suburb: 0x6b7a54, rural: 0x6f7f52, forest: 0x5d7049, mountain: 0x727a58 },
    forestFloor: 0x4b5a3c,
    rock: 0x86827a,
    paved: 0x8d8c88,
    asphalt: 0x47484b,
    sidewalk: 0x9c9a94,
    dirt: 0x8a765a,
    roadLine: 0xc9c7bd,
    fieldA: 0x9a9358,
    fieldB: 0x7d8a4e,
    paddy: 0x6f8a62,
    park: 0x62804c,
    plaza: 0xa39c8f,
  },
  /**
   * Enterable buildings (07d, render/tactical/enterables.ts). Each one is drawn in one of three
   * stages by its distance from the camera: beyond `mid` a single box with the roof shape (the far
   * outline snipers need), within `mid` the outside (walls, windows, doors, roof), within `near` (or
   * with the camera inside it) the inside too. A building drops a stage only `hysteresis` metres past
   * the line. At most `perFrame` buildings go up a stage per frame (nearest first). Instances are
   * pooled per shape; a pool starts with `capacity` slots and doubles when full.
   */
  enterables: { near: 40, mid: 300, hysteresis: 15, perFrame: 1, capacity: 4096, glassOpacity: 0.32, interiorShade: 0.82 },
  /** 07d: colours of the building materials (gen/buildings/types.ts MaterialId); Part.tint picks one. */
  materials: {
    concrete: [0x9a9790, 0x8c8a85, 0xa8a49a, 0x7f817f],
    plaster: [0xd8d2c4, 0xcfd3d4, 0xe2dccb, 0xc7bfae, 0xb9c2c6],
    mortar: [0xb8b2a4, 0xa9a598, 0xc4bca8],
    siding: [0xc9c3b3, 0xb4b8b0, 0xd2c8ae, 0x9fa5a3, 0xc1b49a, 0x8f9a94],
    brick: [0x8a5a44, 0x7a4e3e, 0x95654c],
    wood: [0x8a6a4a, 0x7a5c40, 0x9a7a56, 0x6d5238, 0xa88a62],
    woodDark: [0x4f3b2a, 0x5a4330],
    tile: [0x3f4650, 0x4a4f58, 0x5b4a42, 0x37414a],
    slate: [0x50525a, 0x5e5a55, 0x434a52],
    metalRoof: [0x6b4038, 0x3f4a4c, 0x5a6a6e, 0x7a6b52],
    steel: [0x5a5f63, 0x6a6f72, 0x4f5458],
    rust: [0x7a5440, 0x6e4a3a],
    glass: [0x2a3a48, 0x334450],
    shutter: [0x8e9296, 0x7d8286, 0x9aa0a2],
    door: [0x6a5440, 0x5a4636, 0x7d7268],
    doorSteel: [0x5f666b, 0x6f7478],
    frame: [0x3c3e40],
    flooring: [0x8f6f4d, 0xa0805a, 0x7d6045],
    tatami: [0xa9a46a, 0x9c9a62],
    carpet: [0x5d5a63, 0x6a5e52],
    tileFloor: [0xb8b6ae, 0xa9aaa6],
    vinyl: [0x8d918c, 0x9a958a],
    paper: [0xe6e0cf],
    fabric: [0x5b6a7a, 0x7a5b52, 0x6a7a5b, 0x8a8a80],
    shelf: [0x9aa0a4, 0x8a9296, 0xb0b2ae],
    counter: [0xbcb6a6, 0x9a8a72, 0x6f6a62],
    appliance: [0xd4d6d4, 0xc4c8ca, 0x8a8e90],
    sign: [0x2f7a4a, 0x2a5a9a, 0xb04a2a, 0xd0a020],
    blood: [0x4a120e, 0x3a100c],
    debris: [0x6a6258, 0x58524a],
    plant: [0x4a6634],
    asphalt: [0x47484b],
  },
  buildings: {
    /** Wall colours by kind (picked by Building.tint). */
    walls: {
      house: [0xcfc8b8, 0xb9b3a6, 0xd6cdb4, 0xa9a59c, 0xc2b8a0],
      barn: [0x7a5f4a, 0x8a7460, 0x6d6a62],
      shed: [0x77777a, 0x8a8375, 0x6f6456],
      shop: [0xbfb8a8, 0xa8adb0, 0xc8c2b6],
      apartment: [0xb4ada0, 0xa3a7a8, 0xc0b9a8, 0x989892],
      office: [0x8f979c, 0xa2a6a6, 0x7f8890, 0xb0aea6],
      warehouse: [0x8c8c86, 0x7b8388, 0x9a9488],
      tower: [0x5a5f63],
    },
    roofs: [0x4a4f58, 0x5b4a42, 0x6b4038, 0x3f4a4c, 0x50525a],
    glass: 0x1a2530,
    concrete: 0x8f8d88,
    steel: 0x4f5458,
  },
  flora: {
    trunk: 0x4a3a2c,
    conifer: 0x2c4a33,
    broadleaf: 0x4a6634,
    grass: 0x7d8c4c,
    grassTip: 0xa2a862,
    rock: 0x7c7a74,
    /** Tall grass is drawn within this distance of the camera (m), at most `grassMax` tufts. */
    grassRange: 150,
    grassMax: 5000,
    /** Tree chunks per side (frustum / distance culling granularity). */
    treeChunks: 4,
    /** 07c: chunks further than this from the camera (beyond their own half size) draw the simple far trees. */
    treeNear: 260,
  },

  // --- supply beacons (07c): a faint column over the headquarters and the outposts ---
  beacons: { color: 0x4f8fff, opacity: 0.32, radius: 2.4, height: 110, cacheHeight: 28, crate: 0x4b5233, hideNear: 80, hideNearCache: 30 },

  // --- signs of people (07b): smoke over a hideout by day, a small fire light at night ---
  signals: {
    smoke: 0x55554f,
    opacity: 0.62,
    /** Puffs per column, seconds one takes to climb it, column height and where it starts above the ground (m). */
    puffs: 16,
    seconds: 22,
    height: 55,
    base: 2.2,
    /** Puff radius at the bottom / near the top, and how far the column leans downwind (m). */
    radius: [0.7, 3.4],
    drift: 9,
    light: 0xffb05a,
    /** Size of the light in pixels (it does not shrink with distance), shown when daylight is below this. */
    lightPx: 5,
    lightBelow: 0.45,
  },

  // --- sight-blocking vegetation and scenery (07b) ---
  brush: {
    hedge: 0x35502c,
    bush: 0x40592f,
    reedRoot: 0x5f6b38,
    reedTip: 0xb9ae72,
    bambooStem: 0x7d8f4a,
    bambooLeaf: 0x4f7036,
    bambooTip: 0x86a24e,
    log: 0x5a4632,
    wreck: [0x6e4a3a, 0x59616a, 0x7a7466, 0x4a5a4e, 0x8a8f94],
    wreckDark: 0x1e1f21,
    wreckBox: 0x8f9296,
    frame: 0xa9aca8,
    sheet: 0xd4d6cc,
    /** Length of one hedge box, spacing of reed spikes / bamboo stems / the bamboo undergrowth (m), width of a reed spike. */
    hedgePiece: 2.6,
    reedSpacing: 1.5,
    reedWidth: 1.55,
    /** Reeds, bushes and bamboo of a neighbouring map are drawn when the camera is within this distance of its square (07c). */
    fineRange: 350,
    bambooSpacing: 1.6,
    bambooUnder: 3.2,
  },

  // --- scope overlay (04). Sizes relative to the viewport height unless noted ---
  scope: {
    /** Radius of the clear circle. */
    radius: 0.46,
    /** Soft edge width and how dark the rim gets. */
    edge: 0.012,
    vignette: 0.55,
    /** Scope shadow: how far the eye box wanders per rad/s of view rotation (clamped), and its softness. */
    shadowGain: 0.05,
    shadowMax: 0.11,
    reticle: 0x0a0c0d,
    /** Line half-width and dot radius in mil, with minimums in pixels. */
    lineMil: 0.035,
    lineMinPx: 0.75,
    dotMil: 0.13,
    dotMinPx: 1.7,
    /** Dots along each arm, where the thick posts start (mil). */
    dots: 8,
    postFrom: 10,
    postMil: 0.3,
  },

  // --- zombies (04): muted clothes, pale heads; colours picked per zombie by id ---
  zombies: {
    skin: [0x9aa58c, 0x8f9a86, 0xa3a08a],
    /** Dark plate on the front of the head (07b): shows which way a zombie faces. */
    face: 0x2b2a24,
    walker: { top: [0x4c5560, 0x5a5348, 0x3f4a44, 0x62605c, 0x4a4250], legs: [0x2e3238, 0x3a352e, 0x2a2f2a] },
    runner: { top: [0x7a3b33, 0x6d4630, 0x80503a], legs: [0x25272c, 0x30302c] },
    brute: { top: [0x3e4a34, 0x4a4a3a, 0x38403a], legs: [0x2a2c26, 0x33302a] },
    crawler: { top: [0x5a5648, 0x4e5a52, 0x60584e], legs: [0x34322c, 0x2c3030] },
    /** 07c: a zombie shorter than this on screen (pixels, scope included) is drawn as two plain boxes, not posed. */
    lodPixels: 14,
    /** Looted bodies are darkened by this factor. */
    lootedShade: 0.55,
    blobOpacity: 0.34,
  },

  // --- survivors (05): clean, saturated work clothes so that nobody is mistaken for a zombie ---
  survivors: {
    skin: [0xe0b08c, 0xd9a47e, 0xe8bc98],
    legs: [0x2b3a55, 0x3a3f4a, 0x4a4032],
    /** Jacket colour and the colour of what they carry / wear, per job. */
    job: {
      idle: { top: 0x6f8fb0, prop: 0x6f8fb0 },
      farming: { top: 0x3f9a4a, prop: 0xe6cf6a },
      defense: { top: 0x2f4f9a, prop: 0x1c1c1c },
      scavenging: { top: 0xe07a1f, prop: 0x5a4a32 },
      construction: { top: 0xb0862a, prop: 0xf2d21c },
      research: { top: 0xe8e8ee, prop: 0x3a6ad0 },
      crafting: { top: 0x8a5a3a, prop: 0x9a9aa2 },
      medical: { top: 0xf2f2f2, prop: 0xd02020 },
    },
    /** People in hiding who have not been met yet. */
    hidden: { top: 0xf0e060, prop: 0xffffff },
    blobOpacity: 0.3,
    max: 80,
  },

  // --- structures (06): every material reads differently at a glance ---
  structures: {
    /** Instances (boxes) of the solid and of the translucent mesh. 2,000 wall tiles need about 10,000. */
    max: 26000,
    ghostMax: 3000,
    look: {
      wood: { body: 0x8a6a48, dark: 0x5e4630, light: 0xa5825a },
      earth: { body: 0x7a6a4a, dark: 0x5a4c34, light: 0x8f7d58 },
      steel: { body: 0x7d8a96, dark: 0x4a535c, light: 0xa34a2a },
      concrete: { body: 0xb8b6ae, dark: 0x8a8880, light: 0xd2d0c8 },
      cloth: { body: 0x7f8f62, dark: 0x58653f, light: 0xd9d6c4 },
      brick: { body: 0x9a5a44, dark: 0x5c3a30, light: 0xc9b8a0 },
      glass: { body: 0xa8d4d8, dark: 0x5a7a80, light: 0xe6f4f4 },
      soil: { body: 0x5a4028, dark: 0x3e2c1c, light: 0x5f9a3a },
      wire: { body: 0x8a8f94, dark: 0x4a4038, light: 0xb0b6bc },
      pit: { body: 0x2a2219, dark: 0x16110c, light: 0x86744e },
      water: { body: 0x2f5f7a, dark: 0x1e4258, light: 0x86744e },
    },
    rubble: 0x4e4a44,
    fire: 0xd8662a,
    stone: 0x77746c,
    flag: 0xc03030,
    crate: 0x7a6238,
    body: 0x6f7a66,
    /** Blueprint ghost, and the placement cursor when the spot is fine / not. */
    ghost: 0x6fb6ff,
    ok: 0x58d27a,
    bad: 0xe0503a,
    ghostOpacity: 0.38,
    gridColor: 0xffffff,
    gridOpacity: 0.16,
    /** Half-size of the cursor grid in tiles. */
    gridTiles: 12,
    tracer: 0xffe9a8,
    tracerSeconds: 0.12,
  },

  // --- hit effects (04): dust / debris / blood puffs ---
  effects: {
    max: 384,
    dust: 0xb9a888,
    stone: 0xa9a7a0,
    wood: 0x8a6a48,
    blood: 0x6a1410,
  },

  // --- the player's own shot (08): a faint streak behind the bullet, smoke at the muzzle, a small shake ---
  shots: {
    /** Colour and opacity of the streak (additive): just enough to follow one's own round through the scope. */
    tracer: 0xd8d2b8,
    tracerOpacity: 0.32,
    /** Streak length (m) and the distance flown before it shows (so it does not flash in front of the eye). */
    tracerLength: 18,
    tracerFrom: 12,
    maxTracers: 16,
    smoke: 0xb4b0a6,
    /** Camera roll kick (radians) and how fast it settles (1/s). Scoped shots kick less. */
    shakeRoll: 0.012,
    shakeScoped: 0.4,
    shakeDecay: 14,
  },
} as const;
