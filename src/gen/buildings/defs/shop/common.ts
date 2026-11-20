// Helpers shared by the shop types (07d-2b): banks, convenience stores, restaurants, hotels, inns,
// the petrol station and the shuttered shops. Everything here only calls the kit, so the
// blueprints stay plain data. Local frame as in the kit: x across the front, z towards the front
// (z = d), y up.
//
//   core(k, level, x0, z1, lane)     switchback stair in a core [x0, x0 + cw] × [z1 - depth, z1], entered from z1
//   coreSize(k, lane)                that core's width and depth for this building's storey height
//   capRail(k, level, x0, z1, lane)  railing across the open flight on the top floor (no stair further up)
//   facade(k, side, from, cols, o)   curtain wall of piers, spandrels and glass over storeys from..top
//                                    (a tall block's windows for a fraction of the triangles of k.window)
//   sign / awning / grime            signboards, shop awnings, graffiti and rust on shutters

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit } from '../../kit.ts';
import type { MaterialId } from '../../types.ts';

export const P = ARCH.wall.partition / 2;
export const LANE = ARCH.stair.wideWidth;
const GAP = 0.15;

/** Width (x) and depth (z) of a switchback stair core with lanes of `lane` for this building's storeys. */
export function coreSize(k: Kit, lane: number = LANE): { cw: number; depth: number } {
  const n = Math.ceil(k.def.storeyHeight / 2 / ARCH.stair.maxRise - 1e-6);
  return { cw: lane * 2 + GAP, depth: n * ARCH.stair.going + ARCH.stair.landing };
}

/**
 * Switchback stair from `level` to `to` in the core [x0, x0 + cw] × [z1 - depth, z1]: the first flight
 * climbs away from z1 on the left lane, the second comes back on the right one, so the foot and the
 * top both open onto whatever room lies in front of z1 (z > z1).
 */
export function core(k: Kit, level: number, x0: number, z1: number, lane: number = LANE, o: { to?: number; mat?: MaterialId; tint?: number } = {}): void {
  k.stairs({ level, start: [x0 + lane / 2, z1], dir: 'z-', width: lane, kind: 'switchback', turn: 'right', mat: o.mat ?? 'concrete', tint: o.tint, to: o.to });
}

/** Top floor: a railing across the first flight's lane, so nobody steps off into the stairwell. */
export function capRail(k: Kit, level: number, x0: number, z1: number, lane: number = LANE): void {
  const y = k.levelY(level);
  k.box(level, x0, y, z1 - ARCH.rail.thick, x0 + lane, y + ARCH.rail.height, z1, 'steel', { role: 'furniture' });
}

export type Side = 'front' | 'back' | 'left' | 'right';

export interface FacadeSpec {
  mat: MaterialId;
  tint?: number;
  /** Window width, sill and head above each floor (m). */
  win: number;
  sill: number;
  head: number;
  /** Height of the wall above the eaves (a parapet). */
  parapet?: number;
  /** Window columns left without glass (broken all the way up: the barrier stays, hidden). */
  broken?: number[];
  thick?: number;
  /** The building's outer faces when it does not fill the footprint (default [0, 0, w, d]). */
  rect?: readonly [number, number, number, number];
}

/**
 * Outer wall of one side over storeys `from`..top as a curtain: piers between the window columns
 * (full height), one spandrel band per floor and one pane per column. `cols` are the window
 * centres along the side (x for front / back, z for left / right, as for kit.outerWalls). The
 * storeys below `from` are built with kit.outerWalls as usual (their walls stop at levelY(from)).
 */
export function facade(k: Kit, side: Side, from: number, cols: readonly number[], o: FacadeSpec): void {
  const t = o.thick ?? k.thick;
  const [rx0, rz0, rx1, rz1] = o.rect ?? [0, 0, k.w, k.d];
  const alongX = side === 'front' || side === 'back';
  const u0 = alongX ? rx0 : rz0 + t;
  const u1 = alongX ? rx1 : rz1 - t;
  const [s0, s1] = side === 'front' ? [rz1 - t, rz1] : side === 'back' ? [rz0, rz0 + t] : side === 'left' ? [rx0, rx0 + t] : [rx1 - t, rx1];
  const top = k.storeys - 1;
  const yTop = k.eaves + (o.parapet ?? 0);
  const box = (a: number, b: number, ya: number, yb: number, mat: MaterialId, extra: { thin?: number; hidden?: boolean } = {}): void => {
    if (b - a < 1e-6 || yb - ya < 1e-6) return;
    const c = (s0 + s1) / 2;
    const [ta, tb] = extra.thin ? [c - extra.thin / 2, c + extra.thin / 2] : [s0, s1];
    const opts = { layer: 'shell' as const, tint: mat === o.mat ? o.tint : undefined, hidden: extra.hidden };
    if (alongX) k.box(-1, a, ya, ta, b, yb, tb, mat, opts);
    else k.box(-1, ta, ya, a, tb, yb, b, mat, opts);
  };
  const half = o.win / 2;
  // Piers.
  let cur = u0;
  for (const c of cols) {
    box(cur, c - half, k.levelY(from), yTop, o.mat);
    cur = c + half;
  }
  box(cur, u1, k.levelY(from), yTop, o.mat);
  // Spandrels: below the first row of windows, between the rows, above the last (each one box
  // along the whole side, overlapping the piers in the same material).
  const bands: [number, number][] = [[k.levelY(from), k.levelY(from) + o.sill]];
  for (let l = from; l < top; l++) bands.push([k.levelY(l) + o.head, k.levelY(l + 1) + o.sill]);
  bands.push([k.levelY(top) + o.head, yTop]);
  if (cols.length > 0) for (const [ya, yb] of bands) box(cols[0]! - half, cols[cols.length - 1]! + half, ya, yb, o.mat);
  // Glass, one pane per column.
  cols.forEach((c, i) => {
    const broken = o.broken?.includes(i) ?? false;
    box(c - half, c + half, k.levelY(from) + o.sill, k.levelY(top) + o.head, 'glass', { thin: ARCH.window.pane, hidden: broken });
  });
}

/** Signboard on the front face (drawn only: it may hang over the footprint's edge). */
export function sign(k: Kit, x0: number, x1: number, y0: number, y1: number, tint: number, o: { z?: number; depth?: number; mat?: MaterialId } = {}): void {
  const z = o.z ?? k.d;
  k.box(-1, x0, y0, z, x1, y1, z + (o.depth ?? 0.15), o.mat ?? 'sign', { layer: 'shell', tint, solid: false });
}

/** Sloping awning over the front between x0 and x1, hanging out `out` metres from the front wall. */
export function awning(k: Kit, x0: number, x1: number, y: number, out: number, tint: number): void {
  const d = k.d;
  k.part({ shape: 'wedge', x0, x1, z0: d, z1: d + out, y0: y - 0.5, y1: y, slope: 'z-', mat: 'fabric', tint, solid: false });
}

/** Graffiti and rust streaks on the outside of a front shutter between x0 and x1 (bottom at y). */
export function grime(k: Kit, x0: number, x1: number, y: number, h: number): void {
  const z = k.d - k.thick / 2 + 0.065; // just outside the shutter, which hangs in the middle of the wall
  const n = 1 + Math.floor(k.rand() * 3);
  for (let i = 0; i < n; i++) {
    const a = x0 + k.rand() * (x1 - x0) * 0.6;
    const b = Math.min(x1, a + 0.6 + k.rand() * 1.6);
    const ya = y + 0.3 + k.rand() * h * 0.4;
    k.box(-1, a, ya, z, b, ya + 0.3 + k.rand() * 0.6, z + 0.01, 'paper', { layer: 'shell', tint: k.rand(), solid: false });
  }
  const r = x0 + k.rand() * (x1 - x0 - 0.5);
  k.box(-1, r, y, z, r + 0.4 + k.rand() * 0.5, y + h * (0.3 + k.rand() * 0.5), z + 0.012, 'rust', { layer: 'shell', solid: false });
}

/** Flat roof over rect (the walls' outer faces) at the eaves, with a parapet on the walls (k.roofFlat for a building that does not fill its footprint). */
export function flatRoof(k: Kit, r: readonly [number, number, number, number], o: { mat?: MaterialId; parapet?: number; parapetMat?: MaterialId; tint?: number; thick?: number } = {}): void {
  const t = o.thick ?? k.thick;
  const [x0, z0, x1, z1] = r;
  k.floor(k.storeys, o.mat ?? 'concrete', [x0 + t, z0 + t, x1 - t, z1 - t]);
  const ph = o.parapet ?? 0;
  if (ph <= 0) return;
  const e = k.eaves;
  const pm = o.parapetMat ?? o.mat ?? 'concrete';
  const opts = { layer: 'shell' as const, tint: o.tint };
  k.box(-1, x0, e, z1 - t, x1, e + ph, z1, pm, opts);
  k.box(-1, x0, e, z0, x1, e + ph, z0 + t, pm, opts);
  k.box(-1, x0, e, z0 + t, x0 + t, e + ph, z1 - t, pm, opts);
  k.box(-1, x1 - t, e, z0 + t, x1, e + ph, z1 - t, pm, opts);
}

/** Abandoned car (shell): body and glass, along x or z, centred at (cx, cz), on the ground. */
export function car(k: Kit, cx: number, cz: number, along: 'x' | 'z', tint: number): void {
  const [hw, hl] = [0.85, 2.15];
  const [ax, az] = along === 'z' ? [hw, hl] : [hl, hw];
  k.box(-1, cx - ax, 0.2, cz - az, cx + ax, 1.0, cz + az, 'steel', { layer: 'shell', tint, role: 'furniture' });
  const [bx, bz] = along === 'z' ? [hw - 0.1, hl * 0.5] : [hl * 0.5, hw - 0.1];
  k.box(-1, cx - bx, 1.0, cz - bz, cx + bx, 1.5, cz + bz, 'glass', { layer: 'shell', role: 'furniture' });
}

/** Painted parking lines and car stops for n bays along x between x0 and x1, the stops at z = zs, the bays reaching to z1. */
export function parking(k: Kit, x0: number, x1: number, zs: number, z1: number, n: number): number[] {
  const bw = (x1 - x0) / n;
  const centres: number[] = [];
  for (let i = 0; i <= n; i++) k.box(-1, x0 + i * bw - 0.06, -0.2, zs, x0 + i * bw + 0.06, 0.012, z1, 'paper', { layer: 'shell', tint: 0.98, solid: false });
  for (let i = 0; i < n; i++) {
    const c = x0 + (i + 0.5) * bw;
    centres.push(c);
    k.box(-1, c - 0.8, -0.2, zs + 0.2, c + 0.8, 0.12, zs + 0.35, 'concrete', { layer: 'shell', tint: 0.9 });
  }
  return centres;
}
