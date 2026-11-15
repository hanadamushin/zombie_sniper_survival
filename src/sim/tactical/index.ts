// Tactical layer: player -> weapon -> bullets -> zombies -> knife / ears / damage (owner: 03 world, 04 sniping).
// Called EVERY fixed step (60 Hz). At x10 the player is assumed to be inside the base, so this
// system may batch/simplify its work (check state.time.speed).
//
// Files: area.ts (operation-area life cycle + where the generated map lives), player.ts
// (movement, view ray), collision.ts (raycasts, height, nav tiles, spatial hash), weapon.ts (scope,
// sway, trigger, reload), ballistics.ts (bullets), zombies.ts (spawning, AI, hit shapes, damage),
// combat.ts (knife, ears, falls, death), health.ts (damage to the player), range.ts (debug firing range).
import { emptyInputFrame } from '../../core/types.ts';
import type { System } from '../system.ts';
import { ensureArea } from './area.ts';
import { updateBullets } from './ballistics.ts';
import { updateCombat } from './combat.ts';
import { checkInfection, isDead } from './health.ts';
import { updatePlayer } from './player.ts';
import { lookScale, updateWeapon } from './weapon.ts';
import { expireCorpses, updateZombies } from './zombies.ts';

const NO_CONTROLS = Object.freeze(emptyInputFrame());

export const tacticalSystem: System = {
  id: 'tactical',
  commands: {
    // resupply: (state, cmd, ctx) => { ... },   (05: colony stock -> player)
  },
  step(state, ctx) {
    const area = ensureArea(state, ctx.grid);
    if (!area) return;
    // 1. player. Controls only arrive in the tactical mode; elsewhere the player stands still.
    const dead = isDead(state);
    updatePlayer(state.player, area.map, dead ? NO_CONTROLS : ctx.input, ctx.dt, lookScale(state.player));
    // 2. rifle: scope, sway, trigger -> new bullets
    updateWeapon(state, dead ? { ...ctx, input: NO_CONTROLS } : ctx);
    // 3. bullets  4. zombies  5. knife, ears, falls, death
    updateBullets(state, area, ctx);
    updateZombies(state, area, ctx);
    updateCombat(state, area, ctx);
  },
  minute(state, ctx) {
    expireCorpses(state);
    checkInfection(state, ctx);
  },
};
