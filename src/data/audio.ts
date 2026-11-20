// Sound mix (08). Everything is synthesised with Web Audio (src/audio/); these are the levels,
// ranges and rhythms. The recipes (oscillators, filters, envelopes) live with the code.

export const AUDIO = {
  /** Speed of sound (m/s): a far impact is heard range / speed seconds after the round lands. */
  soundSpeed: 343,
  /** Overall level of each bus before the player's volume settings. */
  bus: { sfx: 0.9, ambience: 0.55, ui: 0.5 },
  /** Distance falloff: full level within `near` m, then near / d, silent beyond `far`. */
  falloff: { near: 6, far: 420 },

  shot: { level: 0.55, bolt: [0.28, 0.55, 0.82] as readonly number[], casing: 0.95 },
  impact: { level: 0.5, minRange: 25 },
  headshot: { level: 0.22 },

  footsteps: { walkInterval: 0.56, runInterval: 0.34, crouchFactor: 1.5, level: 0.16, minSpeed: 0.4 },
  /** Heartbeat while holding the breath (beats per minute) and the gasp when it runs out. */
  breath: { bpm: 68, level: 0.28, gasp: 0.22 },

  zombies: {
    /** Seconds between moans (any zombie within `range`); chasing zombies groan more often. */
    interval: 1.6,
    chaseInterval: 0.7,
    range: 90,
    level: 0.32,
    maxVoices: 3,
  },
  walls: { level: 0.4, minGap: 0.18 },

  ambience: {
    wind: { day: 0.32, night: 0.2, urban: 0.6 },
    insects: 0.07,
    birds: { level: 0.08, interval: 7 },
    /** Faint drone over the base in the command layer ("silence is the music"). */
    drone: 0.035,
  },

  alarm: { level: 0.5, rings: 3 },
} as const;
