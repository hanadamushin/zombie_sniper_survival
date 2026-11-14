// Rendering constants (camera, view distance, sky colours). Colours are 0xRRGGBB.

export const RENDER = {
  camera: {
    fov: 70,
    near: 0.1,
    far: 1500,
    /** Eye height above player.pos by stance (m). */
    eyeHeight: { stand: 1.65, crouch: 1.0, prone: 0.35 },
    /** Command layer: overhead camera height and backward offset (m). */
    commandHeight: 120,
    commandBack: 70,
  },
  /** Visibility 800 m + fog (docs/04_architecture.md §8). */
  fog: { near: 150, far: 800 },
  maxPixelRatio: 2,
  /** Operation area edge length (m). */
  areaSize: 1024,
  sky: {
    day: { sky: 0x8fb8d8, fog: 0xa9c4d6, ground: 0x4a5a3a, sun: 0xfff2dc },
    twilight: { sky: 0xd98a5a, fog: 0xc08a6a, ground: 0x3a3a2c, sun: 0xff9a5a },
    night: { sky: 0x070b16, fog: 0x0a0f1a, ground: 0x10151a, sun: 0x8fa6d8 },
    ambientDay: 2.4,
    ambientNight: 0.45,
    sunDay: 2.2,
    sunNight: 0.25,
  },
  placeholderGround: 0x556b45,
} as const;
