// Zombie kinds (docs/02_systems_spec.md §3.4). Owner: 04. Sizes are metres; the hit shapes and
// the drawn boxes are both derived from them (sim/tactical/zombies.ts `hitShapes`, render/tactical/zombies.ts).

import type { ZombieKind } from '../core/types.ts';

export interface ZombieDef {
  hp: number;
  /** Chase speed by day (m/s). Wandering is slower (BALANCE.zombie.wanderSpeed). */
  speed: number;
  /** Damage per second against walls (06) and per hit against people. */
  wallDps: number;
  attack: number;
  /** Damage of one rifle hit by part. KILL = dies outright. */
  head: number;
  torso: number;
  legs: number;
  /** A leg hit knocks it over for good (it crawls from then on). */
  topples: boolean;
  /** Body: total height, shoulder width, head radius, torso and leg radii (hit shapes). */
  height: number;
  width: number;
  headR: number;
  torsoR: number;
  legR: number;
  /** Forward lean of the upper body when moving (radians). */
  lean: number;
  /** Collision radius against the world and other zombies. */
  radius: number;
  /** Lies flat (crawler; also what a toppled zombie becomes). */
  prone: boolean;
}

export const KILL = 99999;

export const ZOMBIES: Record<ZombieKind, ZombieDef> = {
  walker: { hp: 100, speed: 1.0, wallDps: 4, attack: 15, head: KILL, torso: 55, legs: 30, topples: true, height: 1.75, width: 0.5, headR: 0.125, torsoR: 0.21, legR: 0.16, lean: 0.1, radius: 0.32, prone: false },
  runner: { hp: 70, speed: 4.5, wallDps: 3, attack: 12, head: KILL, torso: 70, legs: 40, topples: true, height: 1.72, width: 0.38, headR: 0.115, torsoR: 0.16, legR: 0.13, lean: 0.42, radius: 0.28, prone: false },
  brute: { hp: 600, speed: 0.8, wallDps: 25, attack: 35, head: 300, torso: 40, legs: 25, topples: false, height: 2.15, width: 1.0, headR: 0.15, torsoR: 0.44, legR: 0.3, lean: 0.06, radius: 0.5, prone: false },
  crawler: { hp: 50, speed: 0.6, wallDps: 2, attack: 10, head: KILL, torso: 50, legs: 50, topples: false, height: 1.7, width: 0.48, headR: 0.125, torsoR: 0.2, legR: 0.15, lean: 0, radius: 0.32, prone: true },
};
