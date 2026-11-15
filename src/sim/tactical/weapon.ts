// The rifle in the player's hands: scope transition, zoom, zeroing, sway, breath, recoil, bolt,
// magazine and reload. Shots leave from the eye along the view direction + the view offset
// (sway and recoil) + the zero elevation, so what the reticle shows is exactly where the barrel points.

import { gauss, stream } from '../../core/rng.ts';
import type { GameState, PlayerState } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { RENDER } from '../../data/render.ts';
import { WEAPON_MODS, WEAPONS, type WeaponDef } from '../../data/weapons.ts';
import type { SimContext } from '../system.ts';
import { spawnBullet, zeroAngle } from './ballistics.ts';
import { viewDir } from './player.ts';

const C = BALANCE.combat;
const MIL = 0.001;
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

const variants = new Map<string, WeaponDef>();

/** Definition of a weapon with the patches of the researched technologies applied (cached). */
export function weaponDef(id: string, techs: readonly string[] = []): WeaponDef {
  const base = WEAPONS[id] ?? WEAPONS.rifle!;
  const mods = WEAPON_MODS.filter((m) => (m.weapon === undefined || m.weapon === base.id) && techs.includes(m.tech));
  if (mods.length === 0) return base;
  const key = `${base.id}|${mods.map((m) => m.tech).join(',')}`;
  let def = variants.get(key);
  if (!def) {
    def = { ...base };
    for (const m of mods) Object.assign(def, m.patch);
    variants.set(key, def);
  }
  return def;
}

/** The weapon the player is holding right now. */
export function weaponOf(state: GameState): WeaponDef {
  return weaponDef(state.player.weapon.id, state.research.done);
}

/** Vertical field of view (degrees) at a magnification: tan(fov / 2) = tan(reference / 2) / zoom. */
export function scopeFovDeg(zoom: number): number {
  return (2 * Math.atan(Math.tan((C.scope.referenceFov * DEG) / 2) / zoom)) / DEG;
}

const HIP_TAN = Math.tan((RENDER.camera.fov * DEG) / 2);

/** tan(fov / 2) of the current view: eases between the hip view and the scope (in tangent space). */
export function viewTan(player: PlayerState): number {
  const scoped = Math.tan((scopeFovDeg(player.weapon.zoom) * DEG) / 2);
  const t = player.aim.scopeT;
  const e = t * t * (3 - 2 * t);
  return HIP_TAN * Math.pow(scoped / HIP_TAN, e);
}
export function viewFovDeg(player: PlayerState): number {
  return (2 * Math.atan(viewTan(player))) / DEG;
}
/** Mouse sensitivity factor so that the picture moves equally fast on screen at any zoom. */
export function lookScale(player: PlayerState): number {
  return viewTan(player) / HIP_TAN;
}

/** Selected zero distance (m). */
export function zeroDistance(state: GameState): number {
  const def = weaponOf(state);
  return def.zeroes[Math.min(def.zeroes.length - 1, Math.max(0, state.player.weapon.zeroIdx))]!;
}

/** Sway amplitude the player is heading for, in mil (spec §3.3). */
export function swayTarget(state: GameState): number {
  const p = state.player;
  if (state.flags.noSway === true) return 0; // firing-range option: check the ballistics without the wobble
  const fatigue = 1 - p.stamina / BALANCE.player.stamina;
  let sway = C.swayBase[p.stance] * (1 + C.swayMove * p.aim.moved) * (1 + C.swayFatigue * fatigue) * C.swayDifficulty[state.difficulty];
  if (p.aim.holding) sway *= C.breathFactor;
  else if (p.aim.breathLock > 0) sway *= C.breathPenalty;
  if (p.weapon.boltT > 0) sway *= C.swayBolt;
  return sway;
}

/**
 * Smooth sway pattern at time t, unit amplitude: a breathing figure-eight plus a fine tremor.
 * Returns [yaw, pitch]; the magnitude stays within about 1.
 */
export function swayPattern(t: number, out: [number, number]): [number, number] {
  const w = (TAU / C.swayPeriod) * t;
  const f = C.tremorHz;
  const tx = (Math.sin(TAU * f[0] * t + 1.3) + Math.sin(TAU * f[1] * t + 4.1) + Math.sin(TAU * f[2] * t + 0.4)) / 3;
  const ty = (Math.sin(TAU * f[0] * t * 1.13 + 2.2) + Math.sin(TAU * f[1] * t * 0.91 + 0.7) + Math.sin(TAU * f[2] * t * 1.07 + 5.0)) / 3;
  out[0] = 0.8 * Math.sin(w) + C.tremorShare * tx;
  out[1] = 0.55 * Math.sin(2 * w + 0.6) + C.tremorShare * ty;
  return out;
}

/** Direction the barrel points: view + offset, raised by `elevation` radians. */
export function aimDir(player: PlayerState, elevation = 0): [number, number, number] {
  return viewDir(player.yaw + player.aim.off[0], player.pitch + player.aim.off[1] + elevation);
}

const pattern: [number, number] = [0, 0];

/** Advance scope / sway / breath / recoil and handle trigger, bolt, reload, zoom and zero input. */
export function updateWeapon(state: GameState, ctx: SimContext): void {
  const p = state.player;
  const aim = p.aim;
  const w = p.weapon;
  const def = weaponOf(state);
  const input = ctx.input;
  const dt = ctx.dt;
  const alive = aim.deadT <= 0;

  // --- zoom / zero ---
  if (input.zoomDelta !== 0) w.zoom = Math.min(def.zoomMax, Math.max(def.zoomMin, w.zoom * Math.pow(def.zoomStep, input.zoomDelta)));
  w.zoom = Math.min(def.zoomMax, Math.max(def.zoomMin, w.zoom));
  if (input.zeroDelta !== 0) w.zeroIdx = Math.min(def.zeroes.length - 1, Math.max(0, w.zeroIdx + Math.round(input.zeroDelta)));

  // --- timers ---
  if (w.boltT > 0) w.boltT = Math.max(0, w.boltT - dt);
  if (w.reloadT > 0) {
    w.reloadT = Math.max(0, w.reloadT - dt);
    if (w.reloadT === 0) {
      const n = Math.min(def.magSize - w.mag, p.inv.ammo ?? 0);
      w.mag += n;
      p.inv.ammo = (p.inv.ammo ?? 0) - n;
      ctx.emit({ type: 'reloadDone', mag: w.mag });
    }
  }

  // --- scope ---
  p.scoped = alive && input.scope && w.reloadT <= 0;
  const rate = dt / C.scope.transition;
  aim.scopeT = p.scoped ? Math.min(1, aim.scopeT + rate) : Math.max(0, aim.scopeT - rate);

  // --- breath ---
  if (aim.breathLock > 0) aim.breathLock = Math.max(0, aim.breathLock - dt);
  aim.holding = p.scoped && input.holdBreath && aim.breathLock <= 0 && p.breath > 0;
  if (aim.holding) {
    p.breath = Math.max(0, p.breath - dt / C.breathSeconds);
    if (p.breath === 0) {
      aim.holding = false;
      aim.breathLock = C.breathPenaltySeconds;
    }
  } else p.breath = Math.min(1, p.breath + dt / (C.breathSeconds * C.breathRecover));

  // --- sway ---
  const moving = Math.hypot(p.vel[0], p.vel[2]) > 0.2;
  aim.moved = moving ? 1 : Math.max(0, aim.moved - dt / C.swayMoveDecay);
  aim.swayAmp += (swayTarget(state) - aim.swayAmp) * Math.min(1, C.swayEase * dt);
  // The breathing cycle nearly stops while the breath is held.
  aim.swayT += dt * (aim.holding ? 0.3 : 1);
  swayPattern(aim.swayT, pattern);

  // --- recoil spring (critically damped) ---
  // Exact step of x'' = -w² x - 2 w x' (frame-rate independent).
  const k = C.recoilStiffness;
  const om = Math.sqrt(k);
  const decay = Math.exp(-om * dt);
  for (let i = 0; i < 2; i++) {
    const x0 = aim.recoil[i]!;
    const c = aim.recoilV[i]! + om * x0;
    aim.recoil[i] = (x0 + c * dt) * decay;
    aim.recoilV[i] = (aim.recoilV[i]! - om * c * dt) * decay;
    if (Math.abs(aim.recoil[i]!) < 1e-7 && Math.abs(aim.recoilV[i]!) < 1e-6) {
      aim.recoil[i] = 0;
      aim.recoilV[i] = 0;
    }
  }
  const s = aim.swayAmp * MIL * aim.scopeT;
  aim.off[0] = pattern[0] * s + aim.recoil[0];
  aim.off[1] = pattern[1] * s + aim.recoil[1];

  // --- reload ---
  const ammo = p.inv.ammo ?? 0;
  const startReload = (): void => {
    w.reloadT = def.reloadTime;
    ctx.emit({ type: 'reloadStarted', seconds: def.reloadTime });
  };
  if (alive && input.reload && w.reloadT <= 0 && w.mag < def.magSize && ammo > 0) startReload();

  // --- trigger (fires on the press) ---
  const pressed = alive && input.fire && !aim.trigger;
  aim.trigger = input.fire;
  if (!pressed || w.boltT > 0 || w.reloadT > 0 || !state.tactical) return;
  if (w.mag <= 0) {
    if (ammo > 0) startReload();
    else ctx.emit({ type: 'dryFire' });
    return;
  }
  const rng = stream(state, 'tactical.shot');
  const hip = (1 - aim.scopeT) * def.hipSpreadMil * MIL;
  const elevation = zeroAngle(def, zeroDistance(state));
  const dir = viewDir(p.yaw + aim.off[0] + (hip > 0 ? gauss(rng) * hip : 0), p.pitch + aim.off[1] + elevation + (hip > 0 ? gauss(rng) * hip : 0));
  const origin: [number, number, number] = [p.pos[0], p.pos[1] + p.eye, p.pos[2]];
  spawnBullet(state, def, origin, dir);
  w.mag -= 1;
  w.boltT = def.boltTime;
  p.stats.shots += 1;
  ctx.emit({ type: 'shotFired', pos: origin, dir, weapon: def.id, scoped: aim.scopeT > 0.5 });
  // Kick: an impulse that peaks at recoilMil (peak of a critically damped spring = v0 / (e * omega)).
  const kick = def.recoilMil * MIL * C.recoilStance[p.stance] * Math.E * Math.sqrt(k);
  aim.recoilV[1] = aim.recoilV[1]! + kick;
  aim.recoilV[0] = aim.recoilV[0]! + kick * (def.recoilSideMil / def.recoilMil) * gauss(rng) * 0.6;
}
