// Helpers shared by the house and apartment types (07d-2a). Everything here only calls the kit, so
// the blueprints stay plain data. Local frame as in the kit: x across the front, z towards the
// front (z = d), y up.
//
//   ring(k, level, rect, spec)      outer walls round a rectangle that is not the whole footprint (yards)
//   pitched(k, rect, opts)          gable / hip roof over a rectangle, with its ceiling
//   fence / hedge / tree            block walls, hedges and garden trees (shell)
//   shed(k, rect, side)             物置: a small enterable store with a shelf
//   carport(k, rect)                posts, a roof and (sometimes) an abandoned car
//   lowerRoom(bp, room, y)          after finish(): a room whose floor is not at its storey's level (土間)

import { ARCH } from '../../../../data/architecture.ts';
import type { Hole, Kit, Rect } from '../../kit.ts';
import type { BuildingBlueprint, MaterialId } from '../../types.ts';

export const P = ARCH.wall.partition / 2;

export interface RingSpec {
  mat: MaterialId;
  tint?: number;
  thick?: number;
  /** Top of the walls (default: the next floor, or the eaves on the top storey). */
  y1?: number;
  /** Openings per side, `at` in local x (front / back) or local z (left / right) — not from the corner. */
  front?: Hole[];
  back?: Hole[];
  left?: Hole[];
  right?: Hole[];
  /** The front wall opens onto a room of the building (a corridor, a deck), not onto the outside. */
  frontInside?: boolean;
}

/** Outer walls round rect [x0, z0, x1, z1] on a storey (like kit.outerWalls, for a house standing in its yard). */
export function ring(k: Kit, level: number, r: Rect, s: RingSpec): void {
  const t = s.thick ?? k.thick;
  const top = s.y1 ?? (level === k.storeys - 1 ? k.eaves : k.levelY(level + 1));
  const o = { mat: s.mat, tint: s.tint, y1: top, exterior: true, layer: 'shell' as const };
  const [x0, z0, x1, z1] = r;
  const shift = (hs: Hole[] | undefined, by: number): Hole[] => (hs ?? []).map((h) => ({ ...h, at: h.at - by }));
  k.wall(level, x0, z1 - t, x1, z1, shift(s.front, x0), s.frontInside ? { ...o, exterior: false } : o);
  k.wall(level, x0, z0, x1, z0 + t, shift(s.back, x0), o);
  k.wall(level, x0, z0 + t, x0 + t, z1 - t, shift(s.left, z0 + t), o);
  k.wall(level, x1 - t, z0 + t, x1, z1 - t, shift(s.right, z0 + t), o);
}

/** Inside of a ring of walls. */
export function inner(r: Rect, t: number): Rect {
  return [r[0] + t, r[1] + t, r[2] - t, r[3] - t];
}

/**
 * Pitched roof over rect (the walls' outer faces) whose eaves are at the top of storey `level - 1`
 * (default: the eaves of the building), with the ceiling slab of that storey.
 */
export function pitched(k: Kit, r: Rect, o: { mat: MaterialId; tint?: number; hip?: boolean; axis?: 'x' | 'z'; rise?: number; overhang?: number; level?: number; thick?: number }): void {
  const level = o.level ?? k.storeys;
  const y = k.levelY(level);
  const ov = o.overhang ?? ARCH.overhang;
  const rise = o.rise ?? k.def.roofRise;
  const axis = o.axis ?? (r[2] - r[0] >= r[3] - r[1] ? 'x' : 'z');
  k.part({ shape: o.hip ? 'hip' : 'gable', x0: r[0] - ov, x1: r[2] + ov, z0: r[1] - ov, z1: r[3] + ov, y0: y, y1: y + rise, mat: o.mat, tint: o.tint, axis });
  k.floor(level, 'wood', inner(r, o.thick ?? k.thick));
}

/** Block wall / fence of height h (shell, from below the ground so slopes do not show a gap). */
export function fence(k: Kit, x0: number, z0: number, x1: number, z1: number, h: number, mat: MaterialId = 'concrete', tint?: number): void {
  k.box(-1, x0, -1, z0, x1, h, z1, mat, { layer: 'shell', tint });
}

/** Hedge: drawn, nothing to bump into. */
export function hedge(k: Kit, x0: number, z0: number, x1: number, z1: number, h: number): void {
  k.box(-1, x0, -0.5, z0, x1, h, z1, 'plant', { layer: 'shell', solid: false });
}

/** Garden tree: a thin trunk (solid) and a crown (drawn only). */
export function tree(k: Kit, x: number, z: number, size: number): void {
  k.box(-1, x - 0.08, -0.5, z - 0.08, x + 0.08, size * 0.9, z + 0.08, 'woodDark', { layer: 'shell' });
  k.box(-1, x - size / 2, size * 0.7, z - size / 2, x + size / 2, size * 1.6, z + size / 2, 'plant', { layer: 'shell', solid: false });
}

/**
 * 物置: a little steel store standing in the yard, rect [x0, z0, x1, z1] (at least 1.4 m on the door
 * side and 1.4 m deep), its door on `side`. Has a room and a shelf to search. Its floor is the
 * ground storey's level.
 */
export function shed(k: Kit, r: Rect, side: 'front' | 'back' | 'left' | 'right', o: { locked?: boolean; tint?: number } = {}): void {
  const t = 0.08;
  const y = k.levelY(0);
  const top = y + 2.1;
  const mid = side === 'front' || side === 'back' ? (r[0] + r[2]) / 2 : (r[1] + r[3]) / 2;
  const door = k.door(mid, o.locked ? 'locked' : 'open');
  door.leaf = 'doorSteel';
  const tint = o.tint ?? k.rand();
  ring(k, 0, r, { mat: 'steel', tint, thick: t, y1: top, [side]: [door] });
  k.box(-1, r[0], top, r[1], r[2], top + 0.08, r[3], 'metalRoof', { layer: 'shell', tint });
  const ir = inner(r, t);
  k.floor(0, 'concrete', ir);
  k.room(0, ir[0], ir[1], ir[2], ir[3], 'storage', { locked: o.locked });
  // Shelf on the wall opposite the door.
  const depth = 0.4;
  const spec = { kind: 'shelf' as const, table: 'tools' as const };
  if (side === 'front') k.furniture(0, ir[0], ir[1], ir[2], ir[1] + depth, 1.8, 'shelf', { search: { ...spec, face: 'z+' } });
  else if (side === 'back') k.furniture(0, ir[0], ir[3] - depth, ir[2], ir[3], 1.8, 'shelf', { search: { ...spec, face: 'z-' } });
  else if (side === 'left') k.furniture(0, ir[2] - depth, ir[1], ir[2], ir[3], 1.8, 'shelf', { search: { ...spec, face: 'x-' } });
  else k.furniture(0, ir[0], ir[1], ir[0] + depth, ir[3], 1.8, 'shelf', { search: { ...spec, face: 'x+' } });
}

/** Carport over rect: four posts, a corrugated roof and, more often than not, an abandoned car. */
export function carport(k: Kit, r: Rect, o: { car?: boolean; along?: 'x' | 'z' } = {}): void {
  const [x0, z0, x1, z1] = r;
  const h = 2.3;
  for (const [x, z] of [[x0, z0], [x1 - 0.1, z0], [x0, z1 - 0.1], [x1 - 0.1, z1 - 0.1]] as const) k.box(-1, x, -0.5, z, x + 0.1, h, z + 0.1, 'steel', { layer: 'shell' });
  k.box(-1, x0 - 0.05, h, z0 - 0.05, x1 + 0.05, h + 0.08, z1 + 0.05, 'metalRoof', { layer: 'shell', tint: 0.66, solid: false });
  if (o.car ?? k.rand() < 0.7) {
    const along = o.along ?? (z1 - z0 >= x1 - x0 ? 'z' : 'x');
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const [hw, hl] = [0.85, 2.1];
    const [ax, az] = along === 'z' ? [hw, hl] : [hl, hw];
    const tint = k.rand();
    k.box(-1, cx - ax, 0.2, cz - az, cx + ax, 1.0, cz + az, 'steel', { layer: 'shell', tint, role: 'furniture' });
    const [bx, bz] = along === 'z' ? [hw - 0.1, hl * 0.5] : [hl * 0.5, hw - 0.1];
    k.box(-1, cx - bx, 1.0, cz - bz, cx + bx, 1.5, cz + bz, 'glass', { layer: 'shell', role: 'furniture' });
  }
}

/** Boards nailed across a window from inside (a barricade): drawn only, on the interior layer. */
export function boards(k: Kit, level: number, x0: number, z0: number, x1: number, z1: number, sill: number, head: number): void {
  const y = k.levelY(level);
  const n = 3;
  for (let i = 0; i < n; i++) {
    const yb = y + sill + ((head - sill) * (i + 0.5)) / n - 0.07;
    k.box(level, x0, yb, z0, x1, yb + 0.14, z1, 'wood', { solid: false, tint: 0.8 });
  }
}

/**
 * After finish(): put a room's floor at height y (a 土間 below the house floor). Moves the room,
 * the ends of its links and its search points; the slab itself is the caller's.
 */
export function lowerRoom(bp: BuildingBlueprint, room: number, y: number): BuildingBlueprint {
  bp.rooms[room]!.y = y;
  for (const l of bp.links) {
    if (l.a === room) l.pts[0]![1] = y;
    if (l.b === room) l.pts[l.pts.length - 1]![1] = y;
  }
  for (const s of bp.search) if (s.room === room) s.pos[1] = y;
  return bp;
}
