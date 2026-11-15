// Close quarters and the aftermath: knife, collecting ears from bodies, fall damage, and the
// provisional death / revival (05 replaces the revival with the colony rules).

import type { Corpse, GameState, Zombie } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { TACTICAL } from '../../data/tactical.ts';
import type { SimContext } from '../system.ts';
import type { TacticalArea } from './area.ts';
import { ladderAt, supportAt } from './collision.ts';
import { hurtPlayer, isDead } from './health.ts';
import { placePlayer } from './player.ts';
import { weaponOf } from './weapon.ts';
import { clearZombiesNear, knifeZombie, zombieById } from './zombies.ts';

const C = BALANCE.combat;
const P = BALANCE.player;

const near: number[] = [];

/** The zombie a knife swing would reach: nearest one in front within range. */
export function knifeTarget(state: GameState, area: TacticalArea): Zombie | null {
  const t = state.tactical;
  if (!t) return null;
  const p = state.player;
  const fx = -Math.sin(p.yaw);
  const fz = -Math.cos(p.yaw);
  near.length = 0;
  area.dynamic.query(p.pos[0], p.pos[2], C.knife.range + 1, near);
  let best: Zombie | null = null;
  let bestD = Infinity;
  for (const id of near) {
    const z = zombieById(t, id);
    if (!z || z.state === 'down') continue;
    const dx = z.pos[0] - p.pos[0];
    const dz = z.pos[2] - p.pos[2];
    const d = Math.hypot(dx, dz);
    if (d > C.knife.range + 0.3 || Math.abs(z.pos[1] - p.pos[1]) > 1.6) continue;
    if (d > 0.4 && (fx * dx + fz * dz) / d < Math.cos(C.knife.arc)) continue;
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return best;
}

function updateKnife(state: GameState, area: TacticalArea, ctx: SimContext): void {
  const aim = state.player.aim;
  if (aim.knifeT > 0) aim.knifeT = Math.max(0, aim.knifeT - ctx.dt);
  if (!ctx.input.knife || aim.knifeT > 0 || state.player.weapon.reloadT > 0) return;
  aim.knifeT = C.knife.interval;
  const z = knifeTarget(state, area);
  if (!z) {
    ctx.emit({ type: 'knifeSwing', hit: null, killed: false });
    return;
  }
  // From behind, and it has not noticed: one silent stab.
  const p = state.player;
  const toPlayerX = p.pos[0] - z.pos[0];
  const toPlayerZ = p.pos[2] - z.pos[2];
  const d = Math.hypot(toPlayerX, toPlayerZ) || 1;
  const facing = (-Math.sin(z.yaw) * toPlayerX - Math.cos(z.yaw) * toPlayerZ) / d;
  const unaware = z.state === 'wander' || z.state === 'alert';
  const killed = knifeZombie(state, area, ctx, z, unaware && facing < 0.2);
  ctx.emit({ type: 'knifeSwing', hit: z.id, killed });
}

/** The body whose ears can be taken from where the player stands, or null. */
export function corpseInReach(state: GameState): Corpse | null {
  const t = state.tactical;
  if (!t) return null;
  const p = state.player;
  let best: Corpse | null = null;
  let bestD: number = C.ears.range;
  for (const c of t.corpses) {
    if (c.ears <= 0 || Math.abs(c.pos[1] - p.pos[1]) > 2) continue;
    const d = Math.hypot(c.pos[0] - p.pos[0], c.pos[2] - p.pos[2]);
    if (d <= bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function updateEars(state: GameState, ctx: SimContext): void {
  const p = state.player;
  const aim = p.aim;
  const corpse = ctx.input.interactHeld ? corpseInReach(state) : null;
  if (!corpse) {
    aim.interactT = 0;
    aim.interactId = null;
    return;
  }
  if (aim.interactId !== corpse.id) {
    aim.interactId = corpse.id;
    aim.interactT = 0;
  }
  aim.interactT += ctx.dt;
  if (aim.interactT < C.ears.seconds) return;
  const amount = corpse.ears;
  corpse.ears = 0;
  p.inv.ears = (p.inv.ears ?? 0) + amount;
  p.stats.earsCollected += amount;
  aim.interactT = 0;
  aim.interactId = null;
  ctx.emit({ type: 'earsCollected', amount });
}

/** Falls: remember the highest point since leaving the ground, hurt on landing (spec §3.6). */
function updateFall(state: GameState, area: TacticalArea, ctx: SimContext): void {
  const p = state.player;
  const aim = p.aim;
  const [x, y, z] = p.pos;
  if (ladderAt(area.map, x, z, y)) {
    aim.airPeak = null; // climbing is not falling
    return;
  }
  const grounded = y - supportAt(area.map, x, z, y) < 0.05 && p.vel[1] === 0;
  if (!grounded) {
    aim.airPeak = Math.max(aim.airPeak ?? y, y);
    return;
  }
  if (aim.airPeak === null) return;
  const drop = aim.airPeak - y;
  aim.airPeak = null;
  if (drop > P.fallSafe) hurtPlayer(state, ctx, Math.round((drop - P.fallSafe) * P.fallDamagePerM), 'fall');
}

/** deadT stays at this value once the death screen is over, until the colony has revived the player (or the game is lost). */
export const DEATH_HOLD = 1e-3;

/** Firing range only: back on the firing line with full health and ammunition. */
function revive(state: GameState, area: TacticalArea, ctx: SimContext): void {
  const p = state.player;
  const map = area.map;
  if (map.params.isHome) placePlayer(p, map, map.spawn.home[0], map.spawn.home[1], 0);
  else placePlayer(p, map, map.spawn.edge[0], map.spawn.edge[1], map.spawn.edgeYaw);
  clearZombiesNear(state, area, p.pos[0], p.pos[2], P.reviveClear);
  for (const z of state.tactical?.zombies ?? []) {
    if (z.state === 'chase' || z.state === 'attack') {
      z.state = 'wander';
      z.target = null;
      z.t = 1;
    }
  }
  p.hp = P.hp;
  p.stamina = P.stamina;
  p.breath = P.breath;
  p.stance = 'stand';
  p.eye = TACTICAL.player.eyeHeight.stand;
  p.infectedUntil = null;
  p.inv.ears = 0;
  p.inv.ammo = state.flags.range ? BALANCE.range.ammo : P.reviveAmmo;
  p.weapon.mag = weaponOf(state).magSize;
  p.weapon.boltT = 0;
  p.weapon.reloadT = 0;
  p.aim.airPeak = null;
  ctx.emit({ type: 'playerRevived' });
}

/** Knife, ears, falls and death timers — after the player and the zombies have moved. */
export function updateCombat(state: GameState, area: TacticalArea, ctx: SimContext): void {
  const aim = state.player.aim;
  if (aim.hurtT > 0) aim.hurtT = Math.max(0, aim.hurtT - ctx.dt);
  if (isDead(state)) {
    aim.interactT = 0;
    // The firing range revives on the spot. In the game the colony decides what happens next
    // (sim/colony/morale.ts updatePlayerDeath): the timer is held just above zero until it has.
    aim.deadT = Math.max(DEATH_HOLD, aim.deadT - ctx.dt);
    if (aim.deadT <= DEATH_HOLD && state.flags.range) {
      aim.deadT = 0;
      revive(state, area, ctx);
    }
    return;
  }
  updateFall(state, area, ctx);
  if (isDead(state)) return;
  updateKnife(state, area, ctx);
  updateEars(state, ctx);
}
