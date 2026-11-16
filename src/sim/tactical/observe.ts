// What the scope is pointed at (07): the zombie under the reticle and the distance to the aim point.
// Read by the HUD for the rangefinder (W6a) and the observation records (S2). Pure; changes nothing.

import type { GameState, Zombie } from '../../core/types.ts';
import { ZOMBIES } from '../../data/zombies.ts';
import { areaOf } from './area.ts';
import { dropAt, zeroAngle } from './ballistics.ts';
import { raycastWorld } from './collision.ts';
import { aimDir, weaponOf, zeroDistance } from './weapon.ts';

export interface Observation {
  /** Distance to whatever the reticle rests on (m), or null when it points at the sky. */
  range: number | null;
  zombie: Zombie | null;
  /** Mil to hold over (positive: aim higher) at that range with the current zero. */
  holdMil: number | null;
}

export function observe(state: GameState): Observation {
  const area = areaOf(state);
  const p = state.player;
  if (!area || !state.tactical) return { range: null, zombie: null, holdMil: null };
  const def = weaponOf(state);
  const origin: [number, number, number] = [p.pos[0], p.pos[1] + p.eye, p.pos[2]];
  const dir = aimDir(p);
  const wall = raycastWorld(area.map, origin, dir, def.maxRange);
  let range = wall ? wall.dist : null;
  let zombie: Zombie | null = null;
  for (const z of state.tactical.zombies) {
    if (z.state === 'down') continue;
    const zd = ZOMBIES[z.kind];
    // Centre of the body, and how far the line of sight passes from it.
    const cx = z.pos[0] - origin[0];
    const cy = z.pos[1] + (zd.prone ? 0.3 : zd.height * 0.55) - origin[1];
    const cz = z.pos[2] - origin[2];
    const along = cx * dir[0] + cy * dir[1] + cz * dir[2];
    if (along <= 0 || (range !== null && along > range)) continue;
    const off = Math.hypot(cx - dir[0] * along, cy - dir[1] * along, cz - dir[2] * along);
    if (off > Math.max(zd.width, zd.prone ? 0.5 : zd.height * 0.5)) continue;
    range = along;
    zombie = z;
  }
  const holdMil = range !== null && range > 1 ? (dropAt(def, range) / range - zeroAngle(def, zeroDistance(state))) * 1000 : null;
  return { range, zombie, holdMil };
}
