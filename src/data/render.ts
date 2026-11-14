// Rendering constants (camera, view distance, sky colours). Colours are 0xRRGGBB.

export const RENDER = {
  camera: {
    fov: 70,
    near: 0.1,
    far: 1500,
    /** How fast the eye follows steps / stairs vertically (1/s). */
    stepRate: 16,
    /** Command layer: overhead camera height and backward offset (m). */
    commandHeight: 120,
    commandBack: 70,
  },
  /** Visibility 800 m + fog (docs/04_architecture.md §8). */
  fog: { near: 150, far: 800 },
  maxPixelRatio: 2,
  /** Anisotropic filtering of the ground texture (keeps roads sharp at grazing angles). */
  groundAnisotropy: 4,
  /** Operation area edge length (m). */
  areaSize: 1024,
  sky: {
    day: { sky: 0x8fb8d8, fog: 0xa9c4d6, ground: 0x4a5a3a, sun: 0xfff2dc },
    twilight: { sky: 0xd98a5a, fog: 0xc08a6a, ground: 0x3a3a2c, sun: 0xff9a5a },
    night: { sky: 0x070b16, fog: 0x0a0f1a, ground: 0x10151a, sun: 0x8fa6d8 },
    ambientDay: 2.4,
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
  },
} as const;
