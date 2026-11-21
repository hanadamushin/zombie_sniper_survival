// Pieces of the Self-Defense Force sites (07d-2f), shared by the field camps (military) and the
// garrisons / bases (base). They only call the kit, so the blueprints stay plain data. Local frame as
// in the kit: x across the front, z towards the front (z = d), y up.
//
//   tent          a canvas tent: a room in thin olive walls under a canvas gable, flap doors
//   pit           a sandbag position (土嚢の陣地): a room in a chest-high ring of bags, a gap to enter
//   bags          a line of sandbags (no room)
//   watchtower    監視塔: a plank hut at the foot, a switchback stair inside the frame, the platform
//                 with its sandbag parapet two storeys up (a perch to shoot from)
//   container     a shipping / shelter container (a room behind its end doors, open or shut)
//   jeep / mtruck / apc / tank / heli / fighter    vehicles (shell, solid), whole or burnt out
//   drums / crates / net / mastAntenna / helipadH / flagPole / barrier   the clutter of a camp
//   keyDoors      after finish(): the locked doors inside the given rectangles open with the area's
//                 key (the HQ safe, table 'safe'), with the ways through them kept aside
//
// Furniture is placed in the second pass of twoPass (office/common.ts Fit): cots, field hospital,
// command post, supply stacks.

import { ARCH } from '../../../../data/architecture.ts';
import type { Dir, Hole, Kit, Rect } from '../../kit.ts';
import type { BuildingBlueprint, MaterialId, NavLink, RoomUse } from '../../types.ts';
import type { Fit } from '../office/common.ts';
import { paint } from '../transport/common.ts';

/** Olive palette (data/render.ts RENDER.materials.olive): drab, lighter drab, sand (sandbags), dark. */
export const OD = 0.1;
export const OD2 = 0.35;
export const SAND = 0.6;
export const DARK = 0.9;

type Sides = Record<Dir, Hole[]>;
const sides = (): Sides => ({ 'x-': [], 'x+': [], 'z-': [], 'z+': [] });

/** Four walls round rect r on storey 0 (exterior, shell), from the foundation to `y1`. */
function ring(k: Kit, r: Rect, t: number, hs: Sides, mat: MaterialId, tint: number, y1: number, level = 0): void {
  const [x0, z0, x1, z1] = r;
  const wo = { mat, tint, y1, exterior: true, layer: 'shell' as const, ...(level > 0 ? { y0: k.levelY(level) } : {}) };
  k.wall(level, x0, z1 - t, x1, z1, hs['z+'], wo);
  k.wall(level, x0, z0, x1, z0 + t, hs['z-'], wo);
  k.wall(level, x0, z0 + t, x0 + t, z1 - t, hs['x-'], wo);
  k.wall(level, x1 - t, z0 + t, x1, z1 - t, hs['x+'], wo);
}

// ---------------------------------------------------------------------------------------------
// Tents, positions, towers, containers
// ---------------------------------------------------------------------------------------------

export interface TentSpec {
  use: RoomUse;
  /** Sides with a flap door (at the middle of the side, or `at` metres along it). */
  doors: Dir[];
  at?: Partial<Record<Dir, number>>;
  /** 1.8 m doors (stretchers, brutes). */
  wide?: boolean;
  tint?: number;
  /** Height of the side walls. */
  h?: number;
  floor?: MaterialId;
  /** Roll-up windows in the long sides without a door. */
  windows?: boolean;
}

/** A canvas tent on rect r (outer faces): returns its room. */
export function tent(k: Kit, r: Rect, o: TentSpec): number {
  const [x0, z0, x1, z1] = r;
  const t = 0.08;
  const fy = k.levelY(0);
  const h = o.h ?? 2.2;
  const tint = o.tint ?? OD;
  const hs = sides();
  const len = (s: Dir): number => (s[0] === 'z' ? x1 - x0 : z1 - z0 - 2 * t);
  for (const s of o.doors) hs[s].push(k.door(o.at?.[s] ?? len(s) / 2, 'open', o.wide ? ARCH.door.wide : 1.2));
  if (o.windows) {
    const long: Dir[] = x1 - x0 >= z1 - z0 ? ['z-', 'z+'] : ['x-', 'x+'];
    for (const s of long) {
      if (hs[s].length > 0) continue;
      const n = Math.floor(len(s) / 4);
      for (const at of k.evenly(0, len(s), n)) hs[s].push(k.window(at, 1.0, { sill: 1.0, head: 1.8, broken: k.rand() < 0.6 }));
    }
  }
  ring(k, r, t, hs, 'olive', tint, fy + h);
  k.floor(0, o.floor ?? 'wood', [x0 + t, z0 + t, x1 - t, z1 - t], { tint: 0.4 });
  const axis = x1 - x0 >= z1 - z0 ? 'x' : 'z';
  const span = axis === 'x' ? z1 - z0 : x1 - x0;
  k.part({ shape: 'gable', x0: x0 - 0.15, x1: x1 + 0.15, z0: z0 - 0.15, z1: z1 + 0.15, y0: fy + h, y1: fy + h + Math.min(1.8, span * 0.3), mat: 'olive', tint, axis });
  return k.room(0, x0 + t, z0 + t, x1 - t, z1 - t, o.use);
}

/** A tent that has come down: canvas heaped on its poles (drawn only). */
export function fallenTent(k: Kit, r: Rect, tint = OD): void {
  const [x0, z0, x1, z1] = r;
  const axis = x1 - x0 >= z1 - z0 ? 'x' : 'z';
  k.part({ shape: 'gable', x0, x1, z0, z1, y0: 0, y1: 0.7, mat: 'olive', tint, axis, solid: false });
  k.box(-1, x0 + 0.3, 0, z0 + 0.3, x0 + 0.4, 1.6, z0 + 0.4, 'steel', { layer: 'shell', solid: false });
}

/** A sandbag position on rect r (outer faces of the bags): a gap in side `gate`, returns its room. */
export function pit(k: Kit, r: Rect, gate: Dir, o: { use?: RoomUse; h?: number; at?: number; gun?: Dir } = {}): number {
  const [x0, z0, x1, z1] = r;
  const t = 0.55;
  const fy = k.levelY(0);
  const h = o.h ?? 1.15;
  const hs = sides();
  const len = gate[0] === 'z' ? x1 - x0 : z1 - z0 - 2 * t;
  hs[gate].push(k.door(o.at ?? len / 2, 'open', 1.0));
  ring(k, r, t, hs, 'olive', SAND, fy + h);
  k.floor(0, 'wood', [x0 + t, z0 + t, x1 - t, z1 - t], { tint: 0.8 });
  if (o.gun) {
    // A machine gun on the bags (drawn only).
    const [gx, gz] = o.gun === 'z+' ? [(x0 + x1) / 2, z1 - t / 2] : o.gun === 'z-' ? [(x0 + x1) / 2, z0 + t / 2] : o.gun === 'x+' ? [x1 - t / 2, (z0 + z1) / 2] : [x0 + t / 2, (z0 + z1) / 2];
    const [ax, az] = o.gun[0] === 'z' ? [0.06, 0.6] : [0.6, 0.06];
    k.box(-1, gx - ax, fy + h, gz - az, gx + ax, fy + h + 0.18, gz + az, 'steel', { layer: 'shell', solid: false, tint: 0.9 });
  }
  return k.room(0, x0 + t, z0 + t, x1 - t, z1 - t, o.use ?? 'armory');
}

/** A line of sandbags (x0 === x1 or z0 === z1 is not needed: any thin rect), chest high, solid. */
export function bags(k: Kit, x0: number, z0: number, x1: number, z1: number, h = 1.1): void {
  k.box(-1, x0, -0.2, z0, x1, h, z1, 'olive', { layer: 'shell', tint: SAND });
}

/** Depth of the switchback stairwell for the building's storey height. */
function well(k: Kit): number {
  return Math.ceil(k.def.storeyHeight / 2 / ARCH.stair.maxRise - 1e-6) * ARCH.stair.going + ARCH.stair.landing;
}

/** Footprint of a watchtower (its x span and z span from its corner) for a kit's storey height. */
export function towerSize(k: Kit): { w: number; d: number } {
  return { w: 2.8, d: 0.12 + 0.1 + well(k) + 1.7 + 0.12 };
}
/** The watchtower's footprint with 3 m storeys (the field camps). */
export const TOWER = { w: 2.8, d: 5.34 } as const;

/**
 * 監視塔 at corner (x0, z0), its door on the z+ side: a plank hut at the foot, a switchback stair
 * up through the frame to a landing (storey 1) and the platform (storey 2), the platform a little
 * wider than the frame with a sandbag parapet and a tin roof. Returns the rooms of the platform.
 */
export function watchtower(k: Kit, x0: number, z0: number, o: { tint?: number; mat?: MaterialId } = {}): number[] {
  const { w, d } = towerSize(k);
  const x1 = x0 + w;
  const z1 = z0 + d;
  const t = 0.12;
  const mat = o.mat ?? 'wood';
  const tint = o.tint ?? 0.6;
  const lane = ARCH.stair.width;
  const sx0 = x0 + t + 0.08;
  const zs = z0 + t + 0.1 + well(k);
  // Foot: plank walls, a door at the front; storey 1: open on the front over the landing.
  const hs = sides();
  hs['z+'].push(k.door(w / 2, 'open'));
  ring(k, [x0, z0, x1, z1], t, hs, mat, tint, k.levelY(1));
  const up = sides();
  up['z+'].push(k.window(w / 2, w - 0.8, { sill: 1.0, head: 2.4, broken: true }));
  up['x-'].push(k.window(d / 2, 1.2, { sill: 1.0, head: 2.2, broken: true }));
  up['x+'].push(k.window(d / 2, 1.2, { sill: 1.0, head: 2.2, broken: true }));
  ring(k, [x0, z0, x1, z1], t, up, mat, tint, k.levelY(2), 1);
  const inner: Rect = [x0 + t, z0 + t, x1 - t, z1 - t];
  k.floor(0, 'concrete', inner);
  k.floor(1, 'wood', inner, { tint: 0.3 });
  for (let l = 0; l < 2; l++) k.stairs({ level: l, start: [sx0 + lane / 2, zs], dir: 'z-', width: lane, kind: 'switchback', turn: 'right', mat: 'steel', tint: 0.4 });
  k.room(0, inner[0], inner[1], inner[2], inner[3], 'stairs');
  k.room(1, inner[0], zs, inner[2], inner[3], 'stairs');
  // The platform: 0.6 wider than the frame all round (inside the site), its floor round the stair hole.
  const ov = 0.6;
  const pr: Rect = [x0 - ov, z0 - ov, x1 + ov, z1 + ov];
  const y2 = k.levelY(2);
  k.floor(2, 'wood', pr, { tint: 0.3 });
  const sx1 = sx0 + 2 * lane + 0.15;
  const front = k.room(2, pr[0] + 0.3, zs, pr[2] - 0.3, pr[3] - 0.3, 'tower');
  const right = k.room(2, sx1, pr[1] + 0.3, pr[2] - 0.3, zs, 'tower');
  k.join(front, right);
  const pt = 0.3;
  k.box(-1, pr[0], y2, pr[1], pr[2], y2 + 1.1, pr[1] + pt, 'olive', { layer: 'shell', tint: SAND });
  k.box(-1, pr[0], y2, pr[3] - pt, pr[2], y2 + 1.1, pr[3], 'olive', { layer: 'shell', tint: SAND });
  k.box(-1, pr[0], y2, pr[1] + pt, pr[0] + pt, y2 + 1.1, pr[3] - pt, 'olive', { layer: 'shell', tint: SAND });
  k.box(-1, pr[2] - pt, y2, pr[1] + pt, pr[2], y2 + 1.1, pr[3] - pt, 'olive', { layer: 'shell', tint: SAND });
  // Posts and the roof (drawn only above the parapet).
  for (const [px, pz] of [[pr[0], pr[1]], [pr[2] - 0.15, pr[1]], [pr[0], pr[3] - 0.15], [pr[2] - 0.15, pr[3] - 0.15]] as const) {
    k.box(-1, px, y2 + 1.1, pz, px + 0.15, y2 + 2.5, pz + 0.15, 'wood', { layer: 'shell', tint, solid: false });
  }
  k.box(-1, pr[0] - 0.1, y2 + 2.5, pr[1] - 0.1, pr[2] + 0.1, y2 + 2.62, pr[3] + 0.1, 'metalRoof', { layer: 'shell', tint: 0.4, solid: false });
  // A searchlight on the parapet.
  k.box(-1, x1 - 0.2, y2 + 1.1, z1 + 0.05, x1 + 0.3, y2 + 1.5, z1 + 0.45, 'steel', { layer: 'shell', solid: false, tint: 0.9 });
  return [front, right];
}

/** A container on rect r (along its long side), doors at end `door` (open: a room you can enter). */
export function container(k: Kit, r: Rect, door: Dir, o: { state?: 'open' | 'locked'; use?: RoomUse; tint?: number; mat?: MaterialId } = {}): number {
  const [x0, z0, x1, z1] = r;
  const t = 0.1;
  const fy = k.levelY(0);
  const h = 2.5;
  const state = o.state ?? 'open';
  const hs = sides();
  const len = door[0] === 'z' ? x1 - x0 : z1 - z0 - 2 * t;
  hs[door].push(k.door(len / 2, state, Math.min(1.8, len - 0.3)));
  const tint = o.tint ?? k.rand();
  ring(k, r, t, hs, o.mat ?? 'olive', tint, fy + h);
  k.box(-1, x0, fy + h, z0, x1, fy + h + 0.12, z1, o.mat ?? 'olive', { layer: 'shell', tint });
  k.floor(0, 'wood', [x0 + t, z0 + t, x1 - t, z1 - t], { tint: 0.2 });
  return k.room(0, x0 + t, z0 + t, x1 - t, z1 - t, o.use ?? 'storage', { locked: state !== 'open' });
}

// ---------------------------------------------------------------------------------------------
// Vehicles and clutter (shell, solid unless said)
// ---------------------------------------------------------------------------------------------

type Along = 'x' | 'z';
/** Rect of a piece centred at (cx, cz): `a` along the vehicle from a0 to a1, `b` across. */
function piece(cx: number, cz: number, along: Along, a0: number, a1: number, b: number): Rect {
  return along === 'x' ? [cx + Math.min(a0, a1), cz - b, cx + Math.max(a0, a1), cz + b] : [cx - b, cz + Math.min(a0, a1), cx + b, cz + Math.max(a0, a1)];
}
function vbox(k: Kit, r: Rect, y0: number, y1: number, mat: MaterialId, tint: number, solid = true): void {
  k.box(-1, r[0], y0, r[1], r[2], y1, r[3], mat, { layer: 'shell', tint, role: 'furniture', ...(solid ? {} : { solid: false }) });
}

/** 1/2 t truck (jeep) at (cx, cz), its bonnet towards +along when dir = 1. */
export function jeep(k: Kit, cx: number, cz: number, along: Along, o: { dir?: 1 | -1; burnt?: boolean } = {}): void {
  const s = o.dir ?? 1;
  const mat: MaterialId = o.burnt ? 'rust' : 'olive';
  vbox(k, piece(cx, cz, along, -2.1, 2.1, 0.9), 0.35, 1.15, mat, OD);
  vbox(k, piece(cx, cz, along, -2.0 * s, 0.4 * s, 0.85), 1.15, 1.85, mat, o.burnt ? 0.9 : OD2, !o.burnt);
}

/** 3 1/2 t truck: cab and a canvas-covered bed. */
export function mtruck(k: Kit, cx: number, cz: number, along: Along, o: { dir?: 1 | -1; burnt?: boolean; open?: boolean } = {}): void {
  const s = o.dir ?? 1;
  const mat: MaterialId = o.burnt ? 'rust' : 'olive';
  vbox(k, piece(cx, cz, along, 2.0 * s, 3.6 * s, 1.15), 0.5, 2.7, mat, OD);
  vbox(k, piece(cx, cz, along, -3.6 * s, 1.9 * s, 1.2), 0.5, 1.35, mat, DARK);
  if (!o.open && !o.burnt) vbox(k, piece(cx, cz, along, -3.6 * s, 1.9 * s, 1.2), 1.35, 3.1, 'olive', OD2);
}

/** Wheeled armoured vehicle: the hull and a small turret. */
export function apc(k: Kit, cx: number, cz: number, along: Along, o: { dir?: 1 | -1; burnt?: boolean } = {}): void {
  const s = o.dir ?? 1;
  const mat: MaterialId = o.burnt ? 'rust' : 'olive';
  vbox(k, piece(cx, cz, along, -3.4, 3.4, 1.4), 0.5, 2.2, mat, OD);
  vbox(k, piece(cx, cz, along, -0.6 * s, 0.8 * s, 0.6), 2.2, 2.7, mat, DARK);
  vbox(k, piece(cx, cz, along, 0.8 * s, 2.4 * s, 0.05), 2.4, 2.5, 'steel', 0.9, false);
}

/** Main battle tank: tracks, hull, turret and the gun. */
export function tank(k: Kit, cx: number, cz: number, along: Along, o: { dir?: 1 | -1; burnt?: boolean } = {}): void {
  const s = o.dir ?? 1;
  const mat: MaterialId = o.burnt ? 'rust' : 'olive';
  for (const side of [-1, 1]) {
    const r = piece(cx, cz, along, -3.8, 3.8, 0.35);
    const off = side * 1.35;
    const q: Rect = along === 'x' ? [r[0], r[1] + off, r[2], r[3] + off] : [r[0] + off, r[1], r[2] + off, r[3]];
    vbox(k, q, 0, 1.0, 'steel', 0.9);
  }
  vbox(k, piece(cx, cz, along, -3.7, 3.7, 1.7), 0.9, 1.6, mat, OD);
  vbox(k, piece(cx, cz, along, -1.8 * s, 1.0 * s, 1.5), 1.6, 2.35, mat, OD2);
  vbox(k, piece(cx, cz, along, 1.0 * s, 6.0 * s, 0.09), 1.85, 2.03, mat, DARK, false);
}

/** Helicopter on its skids: fuselage, tail boom and fin, the rotor (drawn only). `crashed`: burnt, a blade down. */
export function heli(k: Kit, cx: number, cz: number, along: Along, o: { dir?: 1 | -1; crashed?: boolean; big?: boolean } = {}): void {
  const s = o.dir ?? 1;
  const L = o.big ? 1.4 : 1;
  const mat: MaterialId = o.crashed ? 'rust' : 'olive';
  vbox(k, piece(cx, cz, along, -2.6 * L * s, 3.2 * L * s, 1.1 * L), 0.5, 0.5 + 2.2 * L, mat, OD);
  vbox(k, piece(cx, cz, along, 2.6 * L * s, 3.4 * L * s, 0.8 * L), 0.9, 0.5 + 1.8 * L, 'glass', 0.5, false);
  vbox(k, piece(cx, cz, along, -9 * L * s, -2.6 * L * s, 0.3), 1.6, 2.2, mat, OD, false);
  vbox(k, piece(cx, cz, along, -9 * L * s, -8.2 * L * s, 0.08), 2.2, 3.6, mat, OD, false);
  for (const side of [-1, 1]) {
    const r = piece(cx, cz, along, -2.4 * L, 2.6 * L, 0.05);
    const off = side * 1.2 * L;
    const q: Rect = along === 'x' ? [r[0], r[1] + off, r[2], r[3] + off] : [r[0] + off, r[1], r[2] + off, r[3]];
    vbox(k, q, 0, 0.5, 'steel', 0.9, false);
  }
  const hub = 0.5 + 2.2 * L;
  const R = 5.5 * L;
  if (o.crashed) {
    vbox(k, piece(cx, cz, along, -0.15, 0.15, R), hub, hub + 0.08, 'steel', 0.9, false);
    vbox(k, piece(cx, cz, along, 0.5, R, 0.12), 0, 0.08, 'steel', 0.9, false);
  } else {
    vbox(k, piece(cx, cz, along, -R, R, 0.15), hub + 0.3, hub + 0.36, 'steel', 0.9, false);
    vbox(k, piece(cx, cz, along, -0.15, 0.15, R), hub + 0.3, hub + 0.36, 'steel', 0.9, false);
  }
}

/** A fighter parked with its nose towards `nose`: fuselage, canopy, delta wings, twin fins. */
export function fighter(k: Kit, cx: number, cz: number, nose: 'z+' | 'z-', tint = 0.5): void {
  const s = nose === 'z+' ? 1 : -1;
  const at = (a: number, b: number): [number, number] => [Math.min(cz + s * a, cz + s * b), Math.max(cz + s * a, cz + s * b)];
  const sh = { layer: 'shell' as const, role: 'furniture' as const };
  const [f0, f1] = at(-7.5, 6.0);
  k.box(-1, cx - 0.8, 1.0, f0, cx + 0.8, 2.4, f1, 'steel', { ...sh, tint });
  const [n0, n1] = at(6.0, 8.5);
  k.box(-1, cx - 0.45, 1.3, n0, cx + 0.45, 2.0, n1, 'steel', { ...sh, tint, solid: false });
  const [c0, c1] = at(2.8, 5.4);
  k.box(-1, cx - 0.45, 2.4, c0, cx + 0.45, 3.0, c1, 'glass', { ...sh, solid: false });
  const [w0, w1] = at(-5.5, 1.5);
  k.box(-1, cx - 5.5, 1.5, w0, cx + 5.5, 1.7, w1, 'steel', { ...sh, tint, solid: false });
  const [t0, t1] = at(-7.5, -5.5);
  k.box(-1, cx - 3.0, 1.6, t0, cx + 3.0, 1.75, t1, 'steel', { ...sh, tint, solid: false });
  for (const fx of [-1.1, 1.1]) k.box(-1, cx + fx - 0.08, 2.4, t0, cx + fx + 0.08, 4.6, t1, 'steel', { ...sh, tint, solid: false });
  const [g0, g1] = at(4.0, 4.6);
  k.box(-1, cx - 0.2, 0, g0, cx + 0.2, 1.0, g1, 'steel', { ...sh, tint: 0.95 });
  const [m0, m1] = at(-2.5, -1.7);
  k.box(-1, cx - 1.6, 0, m0, cx + 1.6, 1.0, m1, 'steel', { ...sh, tint: 0.95 });
}

/** A cluster of fuel drums round (x, z) (n of them). */
export function drums(k: Kit, x: number, z: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const dx = (i % 3) * 0.65;
    const dz = Math.floor(i / 3) * 0.65;
    k.box(-1, x + dx, 0, z + dz, x + dx + 0.58, 0.9, z + dz + 0.58, k.rand() < 0.3 ? 'rust' : 'sign', { layer: 'shell', tint: k.rand() < 0.5 ? 0.1 : 0.4, role: 'furniture' });
  }
}

/** A stack of ammunition / ration crates on rect r, `h` high (one box, solid). */
export function crates(k: Kit, r: Rect, h = 1.2, tint = OD): void {
  k.box(-1, r[0], 0, r[1], r[2], h, r[3], 'olive', { layer: 'shell', tint, role: 'furniture' });
  k.box(-1, r[0] + 0.1, h, r[1] + 0.1, (r[0] + r[2]) / 2, h + 0.4, (r[1] + r[3]) / 2, 'wood', { layer: 'shell', tint: 0.4, role: 'furniture' });
}

/** Camouflage net on posts over rect r at height y (net drawn only, posts solid). */
export function net(k: Kit, r: Rect, y = 3.2): void {
  k.box(-1, r[0], y, r[1], r[2], y + 0.05, r[3], 'olive', { layer: 'shell', tint: DARK, solid: false });
  for (const [px, pz] of [[r[0], r[1]], [r[2] - 0.1, r[1]], [r[0], r[3] - 0.1], [r[2] - 0.1, r[3] - 0.1]] as const) {
    k.box(-1, px, 0, pz, px + 0.1, y, pz + 0.1, 'steel', { layer: 'shell', tint: 0.4 });
  }
}

/** A lattice antenna mast standing on the ground at (x, z), `top` high (solid foot, thin and solid). */
export function mastAntenna(k: Kit, x: number, z: number, top: number): void {
  k.box(-1, x - 0.5, 0, z - 0.5, x + 0.5, 0.4, z + 0.5, 'concrete', { layer: 'shell', role: 'furniture' });
  k.box(-1, x - 0.12, 0.4, z - 0.12, x + 0.12, top, z + 0.12, 'steel', { layer: 'shell', tint: 0.4 });
  for (let y = top * 0.5; y < top - 0.5; y += top * 0.22) k.box(-1, x - 0.9, y, z - 0.04, x + 0.9, y + 0.08, z + 0.04, 'steel', { layer: 'shell', tint: 0.4, solid: false });
  k.box(-1, x - 0.6, top - 1.0, z - 0.6, x + 0.6, top - 0.8, z + 0.6, 'appliance', { layer: 'shell', tint: 0.8, solid: false });
}

/** A helicopter landing pad painted on the ground: a circle-ish square and the H. */
export function helipadH(k: Kit, cx: number, cz: number, size: number): void {
  const s = size / 2;
  paint(k, cx - s, cz - s, cx + s, cz + s, 0.2, 'concrete', 0.03);
  const b = 0.4;
  paint(k, cx - s, cz - s, cx + s, cz - s + b, 0, 'paper', 0.04);
  paint(k, cx - s, cz + s - b, cx + s, cz + s, 0, 'paper', 0.04);
  paint(k, cx - s, cz - s, cx - s + b, cz + s, 0, 'paper', 0.04);
  paint(k, cx + s - b, cz - s, cx + s, cz + s, 0, 'paper', 0.04);
  const hh = s * 0.5;
  const hw = s * 0.35;
  paint(k, cx - hw, cz - hh, cx - hw + 0.6, cz + hh, 0, 'paper', 0.05);
  paint(k, cx + hw - 0.6, cz - hh, cx + hw, cz + hh, 0, 'paper', 0.05);
  paint(k, cx - hw + 0.6, cz - 0.3, cx + hw - 0.6, cz + 0.3, 0, 'paper', 0.05);
}

/** A flag pole at (x, z) with the flag (drawn only), `top` high. */
export function flagPole(k: Kit, x: number, z: number, top = 10): void {
  k.box(-1, x - 0.08, 0, z - 0.08, x + 0.08, top, z + 0.08, 'steel', { layer: 'shell', tint: 0.9 });
  k.box(-1, x + 0.08, top - 1.4, z - 0.02, x + 2.2, top - 0.1, z + 0.02, 'appliance', { layer: 'shell', tint: 0, solid: false });
}

/** A barrier arm across a road along x at z, from x0 to x1: the post solid, the arm (raised or down) drawn only. */
export function barrier(k: Kit, x0: number, x1: number, z: number, down: boolean): void {
  k.box(-1, x0 - 0.3, 0, z - 0.3, x0 + 0.3, 1.1, z + 0.3, 'concrete', { layer: 'shell', tint: 0.9 });
  if (down) k.box(-1, x0 + 0.3, 0.9, z - 0.06, x1, 1.02, z + 0.06, 'sign', { layer: 'shell', tint: 0.7, solid: false });
  else k.box(-1, x0 - 0.06, 1.1, z - 0.06, x0 + 0.06, 5.0, z + 0.06, 'sign', { layer: 'shell', tint: 0.7, solid: false });
}

/** Concertina wire along a line (a low see-through tangle: stops walkers, bullets and sight pass). */
export function wire(k: Kit, x0: number, z0: number, x1: number, z1: number): void {
  const r: Rect = [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)];
  const alongX = r[2] - r[0] >= r[3] - r[1];
  const q: Rect = alongX ? [r[0], r[1] - 0.35, r[2], r[1] + 0.35] : [r[0] - 0.35, r[1], r[0] + 0.35, r[3]];
  k.box(-1, q[0], 0, q[1], q[2], 0.9, q[3], 'glass', { layer: 'shell', tint: 1 });
  k.box(-1, q[0], 0.85, q[1], q[2], 0.9, q[3], 'steel', { layer: 'shell', tint: 0.4, solid: false });
}

/** Scorch and blood on the ground (drawn only). */
export function scorch(k: Kit, cx: number, cz: number, size: number, mat: MaterialId = 'debris'): void {
  k.box(-1, cx - size / 2, 0, cz - size / 2, cx + size / 2, 0.035, cz + size / 2, mat, { layer: 'shell', solid: false, tint: 0.9 });
}

// ---------------------------------------------------------------------------------------------
// Furniture (second pass)
// ---------------------------------------------------------------------------------------------

/** Cots along the long walls, footlockers; a cot and a locker searched. */
export function cots(f: Fit, room: number, o: { max?: number } = {}): void {
  const r = f.roomRect(room);
  const alongX = r[2] - r[0] >= r[3] - r[1];
  const [a, b]: [Dir, Dir] = alongX ? ['z-', 'z+'] : ['x-', 'x+'];
  const max = o.max ?? 8;
  f.row(room, a, 0.8, 1.9, 0.45, 'fabric', { kind: 'bed', table: 'barracks', every: 4, max, gap: 0.5, tint: 0.7 });
  f.row(room, b, 0.8, 1.9, 0.45, 'fabric', { kind: 'bed', table: 'barracks', every: 4, max, gap: 0.5, tint: 0.7 });
  f.ensure(room, 'crate', 'field');
  if (f.chance(0.4)) f.stain(room, f.chance(0.5) ? 'blood' : 'debris');
}

/** Field hospital ward: beds, a medicine cabinet, a treatment table. */
export function medical(f: Fit, room: number): void {
  const r = f.roomRect(room);
  const alongX = r[2] - r[0] >= r[3] - r[1];
  const [a, b]: [Dir, Dir] = alongX ? ['z-', 'z+'] : ['x-', 'x+'];
  f.row(room, a, 0.9, 2.0, 0.65, 'fabric', { kind: 'bed', table: 'ward', every: 3, max: 6, gap: 0.6, tint: 0.95 });
  f.row(room, b, 0.6, 0.5, 1.8, 'steel', { kind: 'cabinet', table: 'pharmacy', max: 2, gap: 1.0, tint: 0.9 });
  f.ensure(room, 'crate', 'pharmacy');
  if (f.chance(0.6)) f.stain(room, 'blood', 1.5);
}

/** Command post: the map table, radio desks, a cabinet. */
export function command(f: Fit, room: number): void {
  const r = f.roomRect(room);
  const cx = (r[0] + r[2]) / 2;
  const cz = (r[1] + r[3]) / 2;
  f.put(room, [cx - 0.9, cz - 0.6, cx + 0.9, cz + 0.6], 0.85, 'wood', { tint: 0.5, search: { kind: 'table', face: 'z+', table: 'command' } });
  const alongX = r[2] - r[0] >= r[3] - r[1];
  f.row(room, alongX ? 'z-' : 'x-', 1.4, 0.7, 0.75, 'steel', { kind: 'desk', table: 'command', max: 2, tint: 0.3 });
  f.row(room, alongX ? 'z+' : 'x+', 0.9, 0.5, 1.7, 'steel', { kind: 'cabinet', table: 'field', max: 1, tint: 0.3 });
  f.ensure(room, 'desk', 'command');
}

/** Supply tent / store: stacks of crates along the walls (tables in turn). */
export function supplies(f: Fit, room: number, tables: ('field' | 'fuel' | 'pharmacy' | 'weapons' | 'armory' | 'storage' | 'grocery' | 'tools' | 'garage')[], max = 6): void {
  const r = f.roomRect(room);
  const alongX = r[2] - r[0] >= r[3] - r[1];
  const walls: Dir[] = alongX ? ['z-', 'z+', 'x-', 'x+'] : ['x-', 'x+', 'z-', 'z+'];
  let i = 0;
  for (const side of walls) {
    if (i >= max) break;
    i += f.row(room, side, 1.2, 0.9, 1.1, 'olive', { kind: 'crate', table: tables[i % tables.length]!, max: Math.max(1, Math.ceil(max / 3)), gap: 0.3, tint: i % 2 ? OD : DARK });
  }
  f.ensure(room, 'crate', tables[0]);
}

// ---------------------------------------------------------------------------------------------
// Keys (07d-2f)
// ---------------------------------------------------------------------------------------------

/**
 * Make the locked doors inside `rects` (per storey: [level, rect]) open with the area's key: the
 * openings, their leaves and the rooms behind them (locked rooms touching the door) are marked, and
 * the ways through them kept in `keyLinks` (gen/buildings/index.ts adds them once the placement is
 * open). Every search point on the 'safe' table holds the key. Returns the blueprint.
 */
export function keyDoors(bp: BuildingBlueprint, rects: [number, Rect][]): BuildingBlueprint {
  const keyLinks: NavLink[] = [];
  const roomAt = (level: number, x: number, z: number): number => {
    let best = -1;
    let area = Infinity;
    for (const r of bp.rooms) {
      if (r.level !== level || x < r.x0 - 0.05 || x > r.x1 + 0.05 || z < r.z0 - 0.05 || z > r.z1 + 0.05) continue;
      const a = (r.x1 - r.x0) * (r.z1 - r.z0);
      if (a < area) {
        area = a;
        best = r.id;
      }
    }
    return best;
  };
  bp.openings.forEach((op, i) => {
    if (op.kind !== 'door' || op.state !== 'locked') return;
    if (!rects.some(([l, r]) => l === op.level && op.x >= r[0] - 0.3 && op.x <= r[2] + 0.3 && op.z >= r[1] - 0.3 && op.z <= r[3] + 0.3)) return;
    op.key = true;
    const hw = op.width / 2;
    for (const p of bp.parts) {
      if (p.mat !== 'doorSteel' && p.mat !== 'door') continue;
      if (p.y0 < op.y0 - 0.01 || p.y1 > op.y1 + 0.01) continue;
      const [u0, u1, c] = op.axis === 'x' ? [p.x0, p.x1, (p.z0 + p.z1) / 2] : [p.z0, p.z1, (p.x0 + p.x1) / 2];
      const [ou, oc] = op.axis === 'x' ? [op.x, op.z] : [op.z, op.x];
      if (Math.abs(u0 - (ou - hw)) < 0.02 && Math.abs(u1 - (ou + hw)) < 0.02 && Math.abs(c - oc) < 0.3) p.key = true;
    }
    const reach = ARCH.doorReach + 0.2;
    const [nx, nz] = op.axis === 'x' ? [0, 1] : [1, 0];
    const ra = roomAt(op.level, op.x - nx * reach, op.z - nz * reach);
    const rb = roomAt(op.level, op.x + nx * reach, op.z + nz * reach);
    // Outer doors: the outside (-1) first.
    const flip = op.exterior && ra >= 0 && rb < 0;
    const sg = flip ? -1 : 1;
    const b = flip ? ra : rb;
    const a = op.exterior ? -1 : ra;
    const fy = b >= 0 ? bp.rooms[b]!.y : 0;
    const pa: [number, number, number] = [op.x - sg * nx * reach, op.exterior && op.level === 0 ? 0 : fy, op.z - sg * nz * reach];
    const pb: [number, number, number] = [op.x + sg * nx * reach, fy, op.z + sg * nz * reach];
    if (b < 0 || (a < 0 && !op.exterior)) throw new Error(`${bp.def}: a key door at (${op.x.toFixed(2)}, ${op.z.toFixed(2)}) on storey ${op.level} leads nowhere`);
    for (const id of [a, b]) if (id >= 0 && bp.rooms[id]!.locked) bp.rooms[id]!.key = true;
    keyLinks.push({ a, b, kind: 'door', width: op.width, pts: [pa, pb], opening: i });
  });
  if (keyLinks.length > 0) {
    bp.keyLinks = keyLinks;
    for (const s of bp.search) if (s.table === 'safe') s.key = true;
  }
  return bp;
}
