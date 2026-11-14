// Tactical layer: player -> bullets -> zombies -> corpses (owner: 03 world, 04 sniping).
// Called EVERY fixed step (60 Hz). At x10 the player is assumed to be inside the base, so this
// system may batch/simplify its work (check state.time.speed).
// Split the work into files in this directory (player.ts, ballistics.ts, zombies.ts, ...).
import type { System } from '../system.ts';

export const tacticalSystem: System = {
  id: 'tactical',
  commands: {
    // resupply: (state, cmd, ctx) => { ... },
  },
  step(_state, _ctx) {
    // 1. player (ctx.input)  2. bullets  3. zombies  4. corpses / ears
  },
};
