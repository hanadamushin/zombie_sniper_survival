// Pieces the school types share (07d-2d): the gym (an evacuation shelter now), the schoolyard
// props, a rooftop pool, an open covered walkway. Local frame as in the kit.

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit, Rect } from '../../kit.ts';
import type { MaterialId } from '../../types.ts';
import { catwalk, hall, lines, mesh, yardTree, type Bay, type Fit } from './common.ts';

/**
 * 体育館: a tall hall (two storeys high) whose doors face z+, a stage at the z- end, hoops, the
 * lines of the court. It became an evacuation shelter: rows of mats and cardboard screens, the
 * supply crates (searched) along the side walls, a stain or two. With `gallery` a steel gallery
 * runs along the back wall above the stage (stair from the floor), high windows to shoot from.
 */
export function gym(k: Kit, r: Rect, o: { mat: MaterialId; tint: number; roof: 'gable' | 'flat'; roofMat?: MaterialId; levels?: number; gallery?: boolean; doors?: number[] }): number {
  const [x0, z0, x1, z1] = r;
  const levels = o.levels ?? 2;
  const doors = (o.doors ?? (o.gallery ? [(x0 + x1) / 2 + 1, x1 - 3] : [x0 + 3, x1 - 3])).map((at) => ({ side: 'z+' as const, at, width: ARCH.door.wide }));
  const g = hall(k, {
    rect: r, levels, mat: o.mat, tint: o.tint, use: 'hall', floorMat: 'flooring',
    doors,
    low: { sides: ['x-', 'x+'], n: Math.max(2, Math.round((z1 - z0) / 6)), width: 1.6 },
    high: { sides: ['x-', 'x+', 'z+'], n: Math.max(2, Math.round((z1 - z0) / 5)), width: 2.2 },
    roof: o.roof, roofMat: o.roofMat ?? 'metalRoof', roofTint: k.rand(), rise: o.roof === 'gable' ? 2.2 : 0, axis: 'z', broken: 0.25,
  });
  const [ix0, iz0, ix1, iz1] = g.inner;
  const y = k.levelY(0);
  // Stage at the back (z-), solid but low; its front edge 4 m in.
  const sd = Math.min(4, (iz1 - iz0) * 0.18);
  k.furniture(0, ix0 + 2.0, iz0, ix1 - 2.0, iz0 + sd, 1.0, 'wood', { tint: 0.3 });
  k.box(0, ix0 + 2.0, y + 1.0, iz0, ix1 - 2.0, y + 4.5, iz0 + 0.1, 'fabric', { tint: 0.2, solid: false }); // curtain
  // Hoops on the side walls (drawn only), the court.
  for (const x of [ix0 + 0.05, ix1 - 0.35]) k.box(0, x, y + 2.9, (iz0 + iz1) / 2 - 0.6, x + 0.3, y + 3.9, (iz0 + iz1) / 2 + 0.6, 'appliance', { solid: false, tint: 0.1 });
  lines(k, [ix0 + 1.5, iz0 + sd + 1.5, ix1 - 1.5, iz1 - 2.5], 0.08);
  // The shelter: mats in rows down the middle (drawn), low cardboard screens, supply crates by the side walls.
  const rows = Math.max(1, Math.floor((ix1 - ix0 - 6) / 3.2));
  for (let i = 0; i < rows; i++) {
    const xm = ix0 + 3.0 + i * 3.2;
    for (let z = iz0 + sd + 1.2; z + 2.0 < iz1 - 3.0; z += 2.4) {
      if (k.rand() < 0.35) continue;
      k.box(0, xm, y, z, xm + 1.0, y + 0.08, z + 2.0, 'fabric', { solid: false, tint: k.rand() });
      if (k.rand() < 0.5) k.box(0, xm + 1.1, y, z, xm + 1.14, y + 0.9, z + 2.0, 'paper', { solid: false });
    }
  }
  const sideZ = (iz0 + sd + iz1 - 3.0) / 2;
  k.furniture(0, ix0, sideZ - 1.0, ix0 + 0.8, sideZ + 1.0, 1.0, 'wood', { tint: 0.5, search: { kind: 'crate', face: 'x+', table: 'canteen' } });
  k.furniture(0, ix1 - 0.8, sideZ - 1.0, ix1, sideZ + 1.0, 1.0, 'wood', { tint: 0.5, search: { kind: 'crate', face: 'x-', table: 'pharmacy' } });
  if (k.rand() < 0.6) k.stain(0, (ix0 + ix1) / 2 - 1.2, iz1 - 6, (ix0 + ix1) / 2 + 0.4, iz1 - 4.6);
  if (o.gallery && levels >= 2) {
    // The gallery along the front wall (high windows onto the yard), up a stair near the left wall.
    const c = catwalk(k, 1, ix0 + 0.2, ix1 - 0.2, iz1, { stairAt: ix0 + 1.6, side: 'z+', tint: 0.4, use: 'hall' });
    k.search(1, (c.rect[0] + c.rect[2]) / 2 + 2.0, (c.rect[1] + c.rect[3]) / 2, 'locker', 'storage');
  }
  return g.id;
}

/** The yard: a running track (lines), trees along the fence line, a flag pole, bars and a sandbox. */
export function yard(k: Kit, r: Rect, o: { track?: boolean; trees?: number; bars?: boolean; statue?: boolean; backstop?: boolean; keep?: Rect[] } = {}): void {
  const [x0, z0, x1, z1] = r;
  const keep = o.keep ?? [];
  const clear = (x: number, z: number, m: number): boolean => keep.every((q) => x < q[0] - m || x > q[2] + m || z < q[1] - m || z > q[3] + m);
  if (o.track !== false) lines(k, [x0 + 4, z0 + 4, x1 - 4, z1 - 4], 0.15);
  // Trees along the front fence (cherries), skipping the gates.
  const n = o.trees ?? Math.floor((x1 - x0) / 9);
  for (const x of k.evenly(x0 + 2, x1 - 2, n)) if (clear(x, z1 - 1.2, 1.5)) yardTree(k, x, z1 - 1.2, 2.6);
  // Flag pole and a 朝礼台 (stand) facing the building.
  k.box(-1, x0 + 2.0, -0.5, z0 + 1.0, x0 + 2.12, 9, z0 + 1.12, 'steel', { layer: 'shell' });
  k.box(-1, (x0 + x1) / 2 - 1.2, -0.5, z0 + 1.0, (x0 + x1) / 2 + 1.2, 1.2, z0 + 2.4, 'steel', { layer: 'shell', tint: 0.5 });
  if (o.bars) {
    // 鉄棒: posts and bars (bars drawn only), and a sandbox.
    const bx = x1 - 6;
    for (let i = 0; i < 3; i++) k.box(-1, bx + i * 1.6, -0.5, z0 + 2, bx + i * 1.6 + 0.08, 1.3 + i * 0.2, z0 + 2.08, 'steel', { layer: 'shell' });
    k.box(-1, bx, 1.1, z0 + 2, bx + 3.3, 1.16, z0 + 2.06, 'steel', { layer: 'shell', solid: false });
    k.box(-1, bx - 6, 0, z0 + 1.5, bx - 2, 0.05, z0 + 4.5, 'debris', { layer: 'shell', solid: false });
  }
  if (o.statue) {
    // A statue on a plinth (a reading boy carrying firewood).
    const sx = x0 + 5;
    k.box(-1, sx - 0.5, -0.5, z0 + 3.0, sx + 0.5, 1.0, z0 + 4.0, 'concrete', { layer: 'shell' });
    k.box(-1, sx - 0.25, 1.0, z0 + 3.25, sx + 0.25, 2.2, z0 + 3.75, 'steel', { layer: 'shell', tint: 0.9 });
  }
  if (o.backstop) {
    // Baseball backstop in the far corner: tall mesh (see-through) on posts.
    const bx = x0 + 8;
    const bz = z1 - 8;
    mesh(k, bx - 4, bz, bx + 4, bz, [], 6);
    mesh(k, bx - 4, bz - 3, bx - 4, bz, [], 6);
    mesh(k, bx + 4, bz - 3, bx + 4, bz, [], 6);
  }
}

/** Rooftop pool on a flat roof at `level` (drawn water, a low rim that is solid). */
export function pool(k: Kit, level: number, r: Rect): void {
  const [x0, z0, x1, z1] = r;
  const y = k.levelY(level);
  k.box(level, x0, y, z0, x1, y + 0.45, z0 + 0.2, 'concrete', { layer: 'shell', tint: 0.9 });
  k.box(level, x0, y, z1 - 0.2, x1, y + 0.45, z1, 'concrete', { layer: 'shell', tint: 0.9 });
  k.box(level, x0, y, z0 + 0.2, x0 + 0.2, y + 0.45, z1 - 0.2, 'concrete', { layer: 'shell', tint: 0.9 });
  k.box(level, x1 - 0.2, y, z0 + 0.2, x1, y + 0.45, z1 - 0.2, 'concrete', { layer: 'shell', tint: 0.9 });
  k.box(level, x0 + 0.2, y, z0 + 0.2, x1 - 0.2, y + 0.35, z1 - 0.2, 'glass', { layer: 'shell', solid: true, tint: 1 });
}

/** Open covered walkway (渡り廊下) between two blocks: a roof on posts, nothing to bump into but the posts. */
export function walkway(k: Kit, x0: number, x1: number, za: number, zb: number, y: number): void {
  k.box(-1, x0, y, Math.min(za, zb), x1, y + 0.2, Math.max(za, zb), 'concrete', { layer: 'shell', tint: 0.4 });
  const n = Math.max(2, Math.ceil(Math.abs(zb - za) / 4));
  for (const z of k.evenly(Math.min(za, zb) + 0.6, Math.max(za, zb) - 0.6, n)) {
    k.box(-1, x0, -0.5, z - 0.1, x0 + 0.2, y, z + 0.1, 'steel', { layer: 'shell' });
    k.box(-1, x1 - 0.2, -0.5, z - 0.1, x1, y, z + 0.1, 'steel', { layer: 'shell' });
  }
}

/** 昇降口: shoe lockers in rows across the room, leaving the middle clear (the room is open to the corridor). */
export const genkan: Fit = (k, level, r) => {
  const [x0, z0, x1, z1] = r;
  const zm = (z0 + z1) / 2;
  if (x1 - x0 < 3) return;
  k.furniture(level, x0 + 0.1, zm - 1.2, x0 + 0.5, zm + 1.2, 1.5, 'wood', { tint: 0.7, search: { kind: 'shelf', face: 'x+', table: 'genkan' } });
  k.furniture(level, x1 - 0.5, zm - 1.2, x1 - 0.1, zm + 1.2, 1.5, 'wood', { tint: 0.7 });
  k.stain(level, (x0 + x1) / 2 - 0.6, zm - 0.5, (x0 + x1) / 2 + 0.7, zm + 0.6, 'debris');
};

/** 図書室: rows of shelves (searched), a reading table. */
export const library: Fit = (k, level, r, ctx) => {
  const [x0, z0, x1, z1] = r;
  const keep = 1.4;
  const za = ctx.corr === 'z+' ? z0 + 0.4 : z0 + keep + 0.2;
  const zb = ctx.corr === 'z+' ? z1 - keep - 0.2 : z1 - 0.4;
  let first = true;
  for (let x = x0 + 0.6; x + 0.5 < x1 - 2.6; x += 1.6) {
    k.furniture(level, x, za, x + 0.5, zb, 1.8, 'shelf', { tint: 0.2, search: first ? { kind: 'shelf', face: 'x+', table: 'office' } : undefined });
    first = false;
  }
  k.furniture(level, x1 - 2.0, za + 0.4, x1 - 0.8, zb - 0.4, 0.72, 'wood', { tint: 0.5 });
};

/** 音楽室: the piano and risers. */
export const music: Fit = (k, level, r, ctx) => {
  const [x0, z0, x1, z1] = r;
  const zf = ctx.corr === 'z+' ? z0 + 0.3 : z1 - 1.8;
  k.furniture(level, x0 + 0.6, zf, x0 + 2.1, zf + 1.5, 1.0, 'woodDark', { tint: 0.1, search: { kind: 'cabinet', face: 'x+', table: 'classroom' } });
  const ra = ctx.corr === 'z+' ? z0 + 0.4 : z0 + 1.6;
  const rb = ctx.corr === 'z+' ? z1 - 1.6 : z1 - 0.4;
  if (rb - ra > 1) k.furniture(level, x1 - 2.4, ra, x1 - 0.4, rb, 0.4, 'wood', { tint: 0.6 });
};

/** Bays: n classrooms of `len` m. */
export function classes(n: number, len = 8.5): Bay[] {
  return Array.from({ length: n }, () => ({ use: 'classroom' as const, len }));
}
