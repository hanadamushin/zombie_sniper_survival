// External ballistics: bullets are projectiles with muzzle velocity, gravity and a simple drag
// (speed decays exponentially with distance: dv/ds = -k v, i.e. acceleration -k |v| v). Each fixed
// step is split into SUBSTEPS; every sub-step's chord is tested against zombies (analytic head /
// torso / legs shapes) and the static world (raycastWorld).
//
// Closed forms for flat fire, used by the tests and by anything that wants a quick answer:
//   time to x:   t(x) = (e^{kx} - 1) / (k v0)
//   drop at x:   y(x) = g / (2 a²) * ((e^{2kx} - 1) / 2 - kx),  a = k v0

import type { HitSurface } from '../../core/events.ts';
import type { Bullet, GameState } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import type { WeaponDef } from '../../data/weapons.ts';
import type { TacticalArea } from './area.ts';
import { raycastWorld, type Vec3 } from './collision.ts';
import type { SimContext } from '../system.ts';
import { damageZombie, hitZombie, zombieById } from './zombies.ts';

export const SUBSTEPS = 4;

/** Drag constant in 1/m. */
export const dragOf = (def: WeaponDef): number => def.dragPerKm / 1000;

/** Flat-fire flight time to horizontal distance x (s). */
export function timeTo(def: WeaponDef, x: number): number {
  const k = dragOf(def);
  return k > 0 ? (Math.exp(k * x) - 1) / (k * def.muzzleVelocity) : x / def.muzzleVelocity;
}

/** Flat-fire drop below the bore line at horizontal distance x (m, positive down). */
export function dropAt(def: WeaponDef, x: number): number {
  const k = dragOf(def);
  if (k <= 0) return 0.5 * def.gravity * (x / def.muzzleVelocity) ** 2;
  const a = k * def.muzzleVelocity;
  return (def.gravity / (2 * a * a)) * ((Math.exp(2 * k * x) - 1) / 2 - k * x);
}

/** Remaining speed at distance x (m/s). */
export function speedAt(def: WeaponDef, x: number): number {
  return def.muzzleVelocity * Math.exp(-dragOf(def) * x);
}

/**
 * One integration step (midpoint rule) of position and velocity. Drag acts on the velocity
 * relative to the air, so wind [x, z] pushes the bullet sideways.
 */
export function integrate(pos: Vec3, vel: Vec3, drag: number, gravity: number, wind: readonly [number, number], dt: number): void {
  let rx = vel[0] - wind[0];
  let rz = vel[2] - wind[1];
  let s = Math.hypot(rx, vel[1], rz);
  const ax = -drag * s * rx;
  const ay = -drag * s * vel[1] - gravity;
  const az = -drag * s * rz;
  const mx = vel[0] + ax * dt * 0.5;
  const my = vel[1] + ay * dt * 0.5;
  const mz = vel[2] + az * dt * 0.5;
  rx = mx - wind[0];
  rz = mz - wind[1];
  s = Math.hypot(rx, my, rz);
  pos[0] += mx * dt;
  pos[1] += my * dt;
  pos[2] += mz * dt;
  vel[0] += -drag * s * rx * dt;
  vel[1] += (-drag * s * my - gravity) * dt;
  vel[2] += -drag * s * rz * dt;
}

const zeroCache = new Map<string, number>();

/**
 * Elevation above the line of sight (radians) that makes the trajectory cross a level sight line
 * at `zero` metres. Solved with the same integrator and step the game uses, so the zero is exact
 * in play, not just on paper.
 */
export function zeroAngle(def: WeaponDef, zero: number): number {
  const key = `${def.muzzleVelocity}:${def.dragPerKm}:${def.gravity}:${zero}`;
  const cached = zeroCache.get(key);
  if (cached !== undefined) return cached;
  const dt = BALANCE.time.fixedStep / SUBSTEPS;
  const drag = dragOf(def);
  let angle = dropAt(def, zero) / zero;
  for (let iter = 0; iter < 6; iter++) {
    const pos: Vec3 = [0, 0, 0];
    const vel: Vec3 = [def.muzzleVelocity * Math.cos(angle), def.muzzleVelocity * Math.sin(angle), 0];
    let px = 0;
    let py = 0;
    while (pos[0] < zero) {
      px = pos[0];
      py = pos[1];
      integrate(pos, vel, drag, def.gravity, [0, 0], dt);
    }
    const f = (zero - px) / (pos[0] - px);
    const y = py + (pos[1] - py) * f;
    angle -= y / zero;
    if (Math.abs(y) < 1e-5) break;
  }
  zeroCache.set(key, angle);
  return angle;
}

/** Wind acting on bullets: only on the highest difficulty or when unlocked by a flag (07). */
export function windOf(state: GameState): readonly [number, number] {
  const on = state.difficulty === 2 || state.flags.wind === true;
  return on && state.tactical ? state.tactical.wind : NO_WIND;
}
const NO_WIND: readonly [number, number] = [0, 0];

export function spawnBullet(state: GameState, def: WeaponDef, origin: Readonly<Vec3>, dir: Readonly<Vec3>): Bullet | null {
  const t = state.tactical;
  if (!t) return null;
  const v = def.muzzleVelocity;
  const bullet: Bullet = {
    id: state.nextId++,
    pos: [origin[0], origin[1], origin[2]],
    vel: [dir[0] * v, dir[1] * v, dir[2] * v],
    pierceLeft: def.pierce,
    dmgMul: def.damageMul,
    life: 0,
    dist: 0,
    drag: dragOf(def),
    gravity: def.gravity,
    weapon: def.id,
    pierceFactor: def.pierceFactor,
    maxRange: def.maxRange,
    lastHit: null,
  };
  t.bullets.push(bullet);
  return bullet;
}

const candidates: number[] = [];
const p0: Vec3 = [0, 0, 0];
const d: Vec3 = [0, 0, 0];

/** Advance all bullets by ctx.dt; resolve hits. */
export function updateBullets(state: GameState, area: TacticalArea, ctx: SimContext): void {
  const t = state.tactical;
  if (!t || t.bullets.length === 0) return;
  const { map, dynamic } = area;
  const wind = windOf(state);
  const h = ctx.dt / SUBSTEPS;
  const bullets = t.bullets;
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi]!;
    let done = false;
    for (let s = 0; s < SUBSTEPS && !done; s++) {
      p0[0] = b.pos[0];
      p0[1] = b.pos[1];
      p0[2] = b.pos[2];
      integrate(b.pos, b.vel, b.drag, b.gravity, wind, h);
      d[0] = b.pos[0] - p0[0];
      d[1] = b.pos[1] - p0[1];
      d[2] = b.pos[2] - p0[2];
      const len = Math.hypot(d[0], d[1], d[2]);
      if (len < 1e-9) continue;
      d[0] /= len;
      d[1] /= len;
      d[2] /= len;
      const wall = raycastWorld(map, p0, d, len);
      const limit = wall ? wall.dist : len;
      candidates.length = 0;
      dynamic.querySegment(p0[0], p0[2], b.pos[0], b.pos[2], 2.5, candidates);
      // Bodies along this chord, nearest first (a bullet may pass through several).
      while (!done) {
        let best = -1;
        let bestT = limit;
        let bestPart: 'head' | 'torso' | 'legs' = 'torso';
        for (const id of candidates) {
          if (id === b.lastHit) continue;
          const z = zombieById(t, id);
          if (!z || z.state === 'down') continue;
          const hit = hitZombie(z, p0, d, len);
          if (hit && hit.t < bestT) {
            bestT = hit.t;
            best = id;
            bestPart = hit.part;
          }
        }
        if (best < 0) break;
        const z = zombieById(t, best)!;
        const pos: Vec3 = [p0[0] + d[0] * bestT, p0[1] + d[1] * bestT, p0[2] + d[2] * bestT];
        const killed = damageZombie(state, area, ctx, z, bestPart, b.dmgMul, d);
        ctx.emit({ type: 'bulletHit', zombie: best, part: bestPart, pos, dir: [d[0], d[1], d[2]], range: b.dist + bestT, killed });
        b.lastHit = best;
        b.pierceLeft -= 1;
        b.dmgMul *= b.pierceFactor;
        if (b.pierceLeft <= 0) done = true;
      }
      if (!done && wall) {
        ctx.emit({ type: 'bulletHit', zombie: null, part: null, pos: wall.pos, surface: wall.kind as HitSurface, dir: [d[0], d[1], d[2]], range: b.dist + wall.dist });
        done = true;
      }
      b.dist += len;
      b.life += h;
      const x = b.pos[0];
      const zz = b.pos[2];
      if (b.dist > b.maxRange || b.life > BALANCE.combat.bulletLife || x < 0 || zz < 0 || x > map.size || zz > map.size) done = true;
    }
    if (done) {
      bullets[bi] = bullets[bullets.length - 1]!;
      bullets.pop();
    }
  }
}
