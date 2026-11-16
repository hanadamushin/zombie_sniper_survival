// Input feel (07b): numbers the input layer uses to turn key presses into InputFrame values.
// Mouse sensitivity itself is TACTICAL.player.lookSensitivity (the sim applies it).

export const INPUT = {
  /**
   * Aiming with the arrow keys (laptops without a mouse: a touchpad stops moving the cursor
   * while keys are held, so the rifle must be usable from the keyboard alone).
   * Turn rates in degrees per second of the un-zoomed view; the sim scales them down with the
   * magnification like mouse movement. A press starts at `start` and reaches `max` after `ramp`
   * seconds (quadratic ease), so that a tap nudges the reticle and holding the key swings it.
   */
  keyLook: {
    hip: { start: 22, max: 150, ramp: 0.9 },
    /** Through the scope: at 12x a tap of 0.1 s moves the reticle about 0.15 mil. */
    scoped: { start: 2, max: 70, ramp: 1.6 },
    /** Vertical rates are this share of the horizontal ones. */
    pitchFactor: 0.7,
    /** Longest time step one frame may contribute (s) — keeps a slow frame from flinging the view. */
    maxStep: 0.1,
  },
} as const;
