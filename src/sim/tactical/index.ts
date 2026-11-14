// Tactical layer: player -> bullets -> zombies -> corpses (owner: 03 world, 04 sniping).
// Called EVERY fixed step (60 Hz). At x10 the player is assumed to be inside the base, so this
// system may batch/simplify its work (check state.time.speed).
//
// Files: area.ts (operation-area life cycle + where the generated map lives), player.ts
// (movement, view ray), collision.ts (raycasts, height, nav tiles, spatial hash).
// 04 adds weapon.ts / ballistics.ts / zombies.ts and calls them from step() below.
import type { System } from '../system.ts';
import { ensureArea } from './area.ts';
import { updatePlayer } from './player.ts';

export const tacticalSystem: System = {
  id: 'tactical',
  commands: {
    // resupply: (state, cmd, ctx) => { ... },
  },
  step(state, ctx) {
    const area = ensureArea(state, ctx.grid);
    if (!area) return;
    // 1. player. Controls only arrive in the tactical mode; elsewhere the player stands still.
    updatePlayer(state.player, area.map, ctx.input, ctx.dt);
    // 2. bullets  3. zombies  4. corpses / ears   (04)
  },
};
