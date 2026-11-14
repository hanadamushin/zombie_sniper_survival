// Colony: survivors, jobs, economy, morale (owner: 05).
// Called once per GAME MINUTE (= 60 steps at 60 Hz); daily settlement in day().
import type { System } from '../system.ts';

export const colonySystem: System = {
  id: 'colony',
  commands: {
    // assignJob, hire, dismiss, buyFood, sendExpedition
  },
  minute(_state, _ctx) {
    // survivor tasks, production, consumption
  },
  day(_state, _ctx) {
    // wages, ledger rollover, candidates refresh
  },
};
