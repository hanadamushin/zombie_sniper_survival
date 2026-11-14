// Fixed-step accumulator used by main.ts (docs/04_architecture.md §4). Pure, so it can be tested.

export interface StepperOptions {
  fixedStep: number;
  /** Real-time delta clamp (seconds) — swallows the huge dt after a background tab wakes up. */
  maxFrameDt: number;
  /** Upper bound of steps per frame; excess simulated time is dropped instead of spiralling. */
  maxStepsPerFrame: number;
}

export interface Stepper {
  /**
   * Feed one rendered frame. Calls `step(isFirstStepOfFrame)` 0..n times and returns the
   * interpolation alpha in [0,1) for rendering.
   */
  advance(realDt: number, speed: number, step: (first: boolean) => void): number;
  reset(): void;
}

export function createStepper(opts: StepperOptions): Stepper {
  let acc = 0;
  return {
    advance(realDt, speed, step) {
      const dt = Math.min(Math.max(realDt, 0), opts.maxFrameDt);
      acc += dt * speed;
      let n = 0;
      while (acc >= opts.fixedStep && n < opts.maxStepsPerFrame) {
        step(n === 0);
        acc -= opts.fixedStep;
        n++;
      }
      if (acc >= opts.fixedStep) acc = 0; // could not keep up: drop the backlog
      return speed > 0 ? acc / opts.fixedStep : 0;
    },
    reset() {
      acc = 0;
    },
  };
}
