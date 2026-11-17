// First-person movement: look, stance, walking / sprinting with stamina, terrain following,
// collision with solids and trees, stairs (step-up), ladders and falling. Shooting and the scope
// belong to 04; this file only provides the view ray they start from.

import type { InputFrame, PlayerState, Stance } from '../../core/types.ts';
import { TACTICAL } from '../../data/tactical.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { gradientAt, heightAt, ladderAt, pushOut, supportAt, type Vec3 } from './collision.ts';

const P = TACTICAL.player;

/** Unit view direction for yaw / pitch. Yaw 0 looks north (-z); positive yaw turns left (west). */
export function viewDir(yaw: number, pitch: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const c = Math.cos(pitch);
  out[0] = -Math.sin(yaw) * c;
  out[1] = Math.sin(pitch);
  out[2] = -Math.cos(yaw) * c;
  return out;
}

/** Eye position and view direction of the player — where shots and interactions start (04). */
export function viewRay(player: PlayerState): { origin: Vec3; dir: Vec3 } {
  return { origin: [player.pos[0], player.pos[1] + player.eye, player.pos[2]], dir: viewDir(player.yaw, player.pitch) };
}

/** Compass heading in degrees: 0 north, 90 east. */
export function headingDeg(yaw: number): number {
  const d = (-yaw * 180) / Math.PI;
  return ((d % 360) + 360) % 360;
}

export function moveSpeed(stance: Stance, sprinting: boolean): number {
  if (stance === 'prone') return P.prone;
  if (stance === 'crouch') return P.crouch;
  return sprinting ? P.sprint : P.walk;
}

const grad: [number, number] = [0, 0];
const xz: [number, number] = [0, 0];

/** Advance the player by dt seconds. `lookScale` scales mouse sensitivity (04: scope zoom). */
export function updatePlayer(player: PlayerState, map: TacticalMap, input: InputFrame, dt: number, lookScale = 1): void {
  // --- look ---
  const sens = P.lookSensitivity * lookScale;
  player.yaw -= input.lookDX * sens;
  if (player.yaw > Math.PI) player.yaw -= Math.PI * 2;
  else if (player.yaw < -Math.PI) player.yaw += Math.PI * 2;
  player.pitch = Math.min(P.maxPitch, Math.max(-P.maxPitch, player.pitch - input.lookDY * sens));

  // --- stance ---
  if (input.stance) player.stance = input.stance;
  const eyeTarget = P.eyeHeight[player.stance];
  player.eye += (eyeTarget - player.eye) * Math.min(1, P.eyeRate * dt);
  if (Math.abs(eyeTarget - player.eye) < 0.002) player.eye = eyeTarget;
  if (dt <= 0) return;

  const pos = player.pos;
  const vel = player.vel;
  const height = P.bodyHeight[player.stance];
  const supportBefore = supportAt(map, pos[0], pos[2], pos[1]);
  const grounded = pos[1] - supportBefore < 0.05 && vel[1] <= 0;
  const ladder = ladderAt(map, pos[0], pos[2], pos[1]);
  const onLadder = ladder !== null && (!grounded || input.moveZ !== 0) && pos[1] < ladder.y1 + 0.03;

  // --- wanted horizontal velocity ---
  let mx = input.moveX;
  let mz = input.moveZ;
  const mlen = Math.hypot(mx, mz);
  if (mlen > 1) {
    mx /= mlen;
    mz /= mlen;
  }
  const moving = mlen > 0.01;
  // Out of breath at 0; sprinting is possible again once some stamina has come back.
  if (player.stamina <= 0) player.winded = true;
  else if (player.stamina >= P.sprintMinStamina) player.winded = false;
  const sprinting = input.sprint && player.stance === 'stand' && mz > 0 && grounded && !onLadder && !player.winded;
  let speed = moveSpeed(player.stance, sprinting);
  if (onLadder) {
    speed = Math.min(speed, P.walk) * 0.5;
    // Hanging on the ladder, forward / back only climbs; stepping off works at the top and the bottom.
    if (!grounded && pos[1] < ladder.y1 - 0.02) mz = 0;
  }
  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  let wx = (cos * mx - sin * mz) * speed;
  let wz = (-sin * mx - cos * mz) * speed;

  // Steep ground slows the climb (never to zero, so nobody gets stuck in a hollow).
  if (moving && grounded && pos[1] - heightAt(map, pos[0], pos[2]) < 0.05) {
    gradientAt(map, pos[0], pos[2], grad);
    const up = (grad[0] * wx + grad[1] * wz) / speed; // rise per metre walked
    if (up > P.slopeFree) {
      const f = 1 - (1 - P.slopeMinFactor) * Math.min(1, (up - P.slopeFree) / (P.slopeMax - P.slopeFree));
      wx *= f;
      wz *= f;
    }
  }
  const k = Math.min(1, P.accel * dt);
  vel[0] += (wx - vel[0]) * k;
  vel[2] += (wz - vel[2]) * k;

  // --- stamina ---
  if (sprinting) player.stamina = Math.max(0, player.stamina - P.sprintDrain * dt);
  else player.stamina = Math.min(P.staminaMax, player.stamina + (moving ? P.staminaRegenMoving : P.staminaRegenIdle) * dt);

  // --- horizontal move + collision ---
  // 07c: where a land cell lies beyond the edge the player may step over it (sim/tactical/area.ts
  // walkAcross then moves them into that cell's area); towards the sea or off the grid the edge stays shut.
  const around = map.params.world?.around;
  const over = TACTICAL.world.crossOver;
  const loX = around?.[3] ? -over : P.edgeMargin;
  const hiX = around?.[5] ? map.size + over : map.size - P.edgeMargin;
  const loZ = around?.[1] ? -over : P.edgeMargin;
  const hiZ = around?.[7] ? map.size + over : map.size - P.edgeMargin;
  xz[0] = Math.min(hiX, Math.max(loX, pos[0] + vel[0] * dt));
  xz[1] = Math.min(hiZ, Math.max(loZ, pos[2] + vel[2] * dt));
  pushOut(map, xz, P.radius, pos[1], height);
  xz[0] = Math.min(hiX, Math.max(loX, xz[0]));
  xz[1] = Math.min(hiZ, Math.max(loZ, xz[1]));
  pos[0] = xz[0];
  pos[2] = xz[1];

  // --- vertical ---
  const support = supportAt(map, pos[0], pos[2], pos[1]);
  if (onLadder) {
    const dir = player.pitch < P.ladderDownPitch ? -1 : 1;
    vel[1] = 0;
    pos[1] = Math.min(ladder.y1, Math.max(support, pos[1] + input.moveZ * dir * P.ladderSpeed * dt));
  } else if (grounded && support >= pos[1] - P.stepUp) {
    // Follow the ground, steps included (up and down).
    pos[1] = support;
    vel[1] = 0;
  } else {
    vel[1] = Math.max(-P.maxFallSpeed, vel[1] - P.gravity * dt);
    pos[1] += vel[1] * dt;
    if (pos[1] <= support) {
      pos[1] = support;
      vel[1] = 0;
    }
  }
}

/** Put the player on the ground at (x, z), standing still. */
export function placePlayer(player: PlayerState, map: TacticalMap, x: number, z: number, yaw: number): void {
  player.pos = [x, heightAt(map, x, z), z];
  player.vel = [0, 0, 0];
  player.yaw = yaw;
  player.pitch = 0;
}
