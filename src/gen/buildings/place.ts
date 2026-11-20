// From a blueprint's local frame to the map (07d). A placement turns the local frame in 90° steps
// (Rot: the side the front faces) about its footprint, so axis-aligned boxes stay axis-aligned.
//
//   rot 0  front south (+z): world = (x0 + lx,       z0 + lz)
//   rot 1  front east  (+x): world = (x0 + lz,       z0 + (w - lx))
//   rot 2  front north (-z): world = (x0 + (w - lx), z0 + (d - lz))
//   rot 3  front west  (-x): world = (x0 + (d - lz), z0 + lx)

import type { BuildingPlacement, Rot } from './types.ts';

export function toWorld(p: Pick<BuildingPlacement, 'rot' | 'w' | 'd' | 'x0' | 'z0'>, lx: number, lz: number, out: [number, number] = [0, 0]): [number, number] {
  switch (p.rot) {
    case 0: out[0] = p.x0 + lx; out[1] = p.z0 + lz; break;
    case 1: out[0] = p.x0 + lz; out[1] = p.z0 + (p.w - lx); break;
    case 2: out[0] = p.x0 + (p.w - lx); out[1] = p.z0 + (p.d - lz); break;
    default: out[0] = p.x0 + (p.d - lz); out[1] = p.z0 + lx; break;
  }
  return out;
}

export function toLocal(p: Pick<BuildingPlacement, 'rot' | 'w' | 'd' | 'x0' | 'z0'>, wx: number, wz: number, out: [number, number] = [0, 0]): [number, number] {
  const ax = wx - p.x0;
  const az = wz - p.z0;
  switch (p.rot) {
    case 0: out[0] = ax; out[1] = az; break;
    case 1: out[0] = p.w - az; out[1] = ax; break;
    case 2: out[0] = p.w - ax; out[1] = p.d - az; break;
    default: out[0] = az; out[1] = p.d - ax; break;
  }
  return out;
}

const a: [number, number] = [0, 0];
const b: [number, number] = [0, 0];
/** World AABB of a local rectangle. */
export function rectToWorld(p: Pick<BuildingPlacement, 'rot' | 'w' | 'd' | 'x0' | 'z0'>, lx0: number, lz0: number, lx1: number, lz1: number): [number, number, number, number] {
  toWorld(p, lx0, lz0, a);
  toWorld(p, lx1, lz1, b);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

/** A local direction (unit x / z) in the world. */
export function dirToWorld(rot: Rot, dx: number, dz: number): [number, number] {
  switch (rot) {
    case 0: return [dx, dz];
    case 1: return [dz, -dx];
    case 2: return [-dx, -dz];
    default: return [-dz, dx];
  }
}

/** World footprint size for local w × d. */
export function worldSize(rot: Rot, w: number, d: number): [number, number] {
  return rot % 2 === 0 ? [w, d] : [d, w];
}

/** Rotation whose front faces the world direction (dx, dz) best. */
export function rotFacing(dx: number, dz: number): Rot {
  if (Math.abs(dz) >= Math.abs(dx)) return dz >= 0 ? 0 : 2;
  return dx >= 0 ? 1 : 3;
}
