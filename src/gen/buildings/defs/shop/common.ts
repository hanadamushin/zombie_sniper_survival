// Helpers shared by the shop / restaurant / lodging types (07d-2b). They only call the kit, so the
// blueprints stay plain data. Local frame as in the kit: x across the front, z towards the front
// (z = d), y up.
//
//   tall(h, head)                 an opening (door / window) with another head height
//   sign / awning / poleSign      signboards, shop awnings and the tall roadside sign (drawn only where they stick out)
//   graffiti / rust               paint and rust on a shutter (drawn only)
//   table / booth / stools        restaurant furniture (tables solid, chairs drawn only so they never block a way)
//   car / vending / toppled       an abandoned car, a vending machine, a piece of furniture lying on its side
//   facade                        long multi-storey wall as pilasters + spandrels + one pane per storey (saves triangles)
//   guestRoom                     one hotel room off a corridor (bath pod, beds, desk), or a locked one

import { ARCH } from '../../../../data/architecture.ts';
import type { Dir, Hole, Kit } from '../../kit.ts';
import type { MaterialId } from '../../types.ts';

export const P = ARCH.wall.partition / 2;

/** The same opening with another head height (shop fronts, wide arches). */
export function tall(h: Hole, head: number): Hole {
  return { ...h, head };
}

/** Signboard (shell). Solid only when it is inside the footprint and `solid` is asked for. */
export function sign(k: Kit, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tint: number, mat: MaterialId = 'sign'): void {
  k.box(-1, x0, y0, z0, x1, y1, z1, mat, { layer: 'shell', tint, solid: false });
}

/** Awning over the front wall (z = zf), sticking out by `depth` (≤ 0.6 past the footprint), at height y. */
export function awning(k: Kit, x0: number, x1: number, zf: number, depth: number, y: number, tint: number): void {
  k.box(-1, x0, y, zf, x1, y + 0.08, zf + depth, 'sign', { layer: 'shell', tint, solid: false });
  k.box(-1, x0, y - 0.35, zf + depth - 0.04, x1, y + 0.08, zf + depth, 'sign', { layer: 'shell', tint, solid: false });
}

/** A tall roadside sign on a post standing at (x, z): the post is solid, the board is drawn only. */
export function poleSign(k: Kit, x: number, z: number, top: number, board: number, tint: number): void {
  k.box(-1, x - 0.15, -0.5, z - 0.15, x + 0.15, top - 0.2, z + 0.15, 'steel', { layer: 'shell' });
  k.box(-1, x - board / 2, top - 1.6, z - 0.2, x + board / 2, top, z + 0.2, 'sign', { layer: 'shell', tint, solid: false });
}

/** Spray paint on a face at z (facing +z) between x0 and x1, y0 and y1: a few strokes, seeded. */
export function graffiti(k: Kit, x0: number, x1: number, z: number, y0: number, y1: number): void {
  const n = 2 + Math.floor(k.rand() * 3);
  for (let i = 0; i < n; i++) {
    const w = k.range(0.6, Math.min(2.2, x1 - x0));
    const x = k.range(x0, x1 - w);
    const h = k.range(0.12, 0.5);
    const y = k.range(y0, y1 - h);
    k.box(-1, x, y, z, x + w, y + h, z + 0.015, k.rand() < 0.25 ? 'blood' : 'sign', { layer: 'shell', tint: k.rand(), solid: false });
  }
}

/** Rust streaks running down a face at z (facing +z). */
export function rust(k: Kit, x0: number, x1: number, z: number, y0: number, y1: number): void {
  const n = 2 + Math.floor(k.rand() * 3);
  for (let i = 0; i < n; i++) {
    const w = k.range(0.15, 0.6);
    const x = k.range(x0, x1 - w);
    const h = k.range(0.5, y1 - y0);
    k.box(-1, x, y1 - h, z, x + w, y1, z + 0.012, 'rust', { layer: 'shell', tint: k.rand(), solid: false });
  }
}

/** Table (solid) of size sx × sz centred at (cx, cz) with chairs on the given sides (drawn only). */
export function table(k: Kit, level: number, cx: number, cz: number, sx: number, sz: number, o: { h?: number; mat?: MaterialId; tint?: number; chairs?: ('x+' | 'x-' | 'z+' | 'z-')[]; low?: boolean } = {}): void {
  const h = o.h ?? (o.low ? 0.33 : 0.72);
  k.furniture(level, cx - sx / 2, cz - sz / 2, cx + sx / 2, cz + sz / 2, h, o.mat ?? 'wood', { tint: o.tint });
  const y = k.levelY(level);
  const ch = o.low ? 0.08 : 0.45;
  const cs = o.low ? 0.5 : 0.4;
  for (const side of o.chairs ?? []) {
    const along = side[0] === 'x' ? sz : sx;
    const n = Math.max(1, Math.floor(along / 0.65));
    for (let i = 0; i < n; i++) {
      const t = -along / 2 + (along * (i + 0.5)) / n;
      const [x, z] = side === 'x+' ? [cx + sx / 2 + 0.3, cz + t] : side === 'x-' ? [cx - sx / 2 - 0.3, cz + t] : side === 'z+' ? [cx + t, cz + sz / 2 + 0.3] : [cx + t, cz - sz / 2 - 0.3];
      k.box(level, x - cs / 2, y, z - cs / 2, x + cs / 2, y + ch, z + cs / 2, o.low ? 'fabric' : 'wood', { solid: false, tint: 0.3 });
    }
  }
}

/**
 * A booth against a wall: table in the middle, a bench with a high back on each side, laid out
 * across [a0, a1] on the axis `axis` from the wall at `w0` (towards w1). Solid (it is a piece of furniture).
 */
export function booth(k: Kit, level: number, axis: 'x' | 'z', a0: number, a1: number, w0: number, w1: number, tint: number, search?: { kind: 'table' | 'counter'; face: Dir }): void {
  const lo = Math.min(w0, w1);
  const hi = Math.max(w0, w1);
  const len = a1 - a0;
  const seat = Math.min(0.55, len * 0.3);
  const box = (b0: number, b1: number, h: number, mat: MaterialId, s?: typeof search): void => {
    if (axis === 'x') k.furniture(level, b0, lo, b1, hi, h, mat, { tint, search: s ? { ...s } : undefined });
    else k.furniture(level, lo, b0, hi, b1, h, mat, { tint, search: s ? { ...s } : undefined });
  };
  box(a0, a0 + seat, 1.1, 'fabric');
  box(a1 - seat, a1, 1.1, 'fabric');
  box(a0 + seat + 0.08, a1 - seat - 0.08, 0.72, 'wood', search);
}

/** Bar stools along a line (drawn only). */
export function stools(k: Kit, level: number, axis: 'x' | 'z', a0: number, a1: number, c: number, spacing = 0.65): void {
  const y = k.levelY(level);
  for (let a = a0 + spacing / 2; a < a1; a += spacing) {
    const [x, z] = axis === 'x' ? [a, c] : [c, a];
    k.box(level, x - 0.17, y, z - 0.17, x + 0.17, y + 0.7, z + 0.17, 'steel', { solid: false, tint: 0.2 });
  }
}

/** An abandoned car at (cx, cz), body along `along` (shell, solid). */
export function car(k: Kit, cx: number, cz: number, along: 'x' | 'z', tint = k.rand()): void {
  const [hw, hl] = [0.85, 2.15];
  const [ax, az] = along === 'z' ? [hw, hl] : [hl, hw];
  k.box(-1, cx - ax, 0.2, cz - az, cx + ax, 1.0, cz + az, 'steel', { layer: 'shell', tint, role: 'furniture' });
  const [bx, bz] = along === 'z' ? [hw - 0.1, hl * 0.5] : [hl * 0.5, hw - 0.1];
  k.box(-1, cx - bx, 1.0, cz - bz, cx + bx, 1.5, cz + bz, 'glass', { layer: 'shell', role: 'furniture' });
}

/** Vending machine (1.0 × 0.75 × 1.85) with its back against a wall; a search point in front when `level` >= 0 and asked. */
export function vending(k: Kit, level: number, x0: number, z0: number, x1: number, z1: number, face: Dir, o: { search?: boolean; shell?: boolean; tint?: number } = {}): void {
  const tint = o.tint ?? k.rand();
  if (o.shell) {
    k.box(-1, x0, -0.2, z0, x1, 1.85, z1, 'appliance', { layer: 'shell', tint, role: 'furniture' });
    return;
  }
  k.furniture(level, x0, z0, x1, z1, 1.85, 'appliance', { tint, search: o.search ? { kind: 'fridge', face, table: 'grocery' } : undefined });
}

/** A shelf / cabinet lying on its side on the floor (drawn on the interior layer, solid but low). */
export function toppled(k: Kit, level: number, x0: number, z0: number, x1: number, z1: number, mat: MaterialId = 'shelf'): void {
  const y = k.levelY(level);
  k.box(level, x0, y, z0, x1, y + 0.45, z1, mat, { role: 'furniture', tint: k.rand() });
}

/**
 * A long wall of a multi-storey block as one set of parts for all its storeys: pilasters at `piers`
 * (x or z centres, the whole height), one spandrel between the storeys, and one pane per storey
 * between sill and head (a broken bay is a hidden barrier instead). The wall lies on the plane
 * [t0, t1] across, from u0 to u1 along `axis`, for storeys from..to-1 (from y0 to the top `y1`).
 * Instead of 4 boxes per window this is about 2 per storey and side plus the pilasters.
 */
export function facade(k: Kit, o: {
  axis: 'x' | 'z'; u0: number; u1: number; t0: number; t1: number; from: number; to: number; y0: number; y1: number;
  piers: number[]; pier?: number; sill?: number; head?: number; mat: MaterialId; tint?: number; pierMat?: MaterialId; broken?: number;
}): void {
  const sill = o.sill ?? 0.8;
  const head = o.head ?? 2.4;
  const pw = o.pier ?? 0.4;
  const tc = (o.t0 + o.t1) / 2;
  const box = (a0: number, a1: number, ya: number, yb: number, mat: MaterialId, c0 = o.t0, c1 = o.t1, extra: { hidden?: boolean; tint?: number } = {}): void => {
    if (a1 - a0 < 1e-6 || yb - ya < 1e-6) return;
    const opts = { layer: 'shell' as const, tint: extra.tint ?? o.tint, hidden: extra.hidden };
    if (o.axis === 'x') k.box(-1, a0, ya, c0, a1, yb, c1, mat, opts);
    else k.box(-1, c0, ya, a0, c1, yb, a1, mat, opts);
  };
  // Spandrels: below the first sill, between storeys, above the last head.
  let y = o.y0;
  for (let i = o.from; i < o.to; i++) {
    const fy = k.levelY(i);
    box(o.u0, o.u1, y, fy + sill, o.mat);
    y = fy + head;
  }
  box(o.u0, o.u1, y, o.y1, o.mat);
  // Panes, bay by bay where some are broken.
  const edges = [o.u0, ...o.piers.filter((p) => p > o.u0 + 0.01 && p < o.u1 - 0.01), o.u1];
  const pane = ARCH.window.pane;
  for (let i = o.from; i < o.to; i++) {
    const fy = k.levelY(i);
    let run = o.u0;
    for (let b = 0; b + 1 < edges.length; b++) {
      if ((o.broken ?? 0) > 0 && k.rand() < o.broken!) {
        box(run, edges[b]!, fy + sill, fy + head, 'glass', tc - pane / 2, tc + pane / 2);
        box(edges[b]!, edges[b + 1]!, fy + sill, fy + head, 'glass', tc - pane / 2, tc + pane / 2, { hidden: true });
        run = edges[b + 1]!;
      }
    }
    box(run, o.u1, fy + sill, fy + head, 'glass', tc - pane / 2, tc + pane / 2);
  }
  // Pilasters over the whole height.
  for (const p of o.piers) box(Math.max(o.u0, p - pw / 2), Math.min(o.u1, p + pw / 2), o.y0, o.y1, o.pierMat ?? o.mat);
}

/**
 * One hotel room: rect [x0, z0, x1, z1] (inside faces), entered from the corridor side `entry` at
 * `doorAt` (the door itself is the caller's, on the corridor wall). A bath pod by the door, then the
 * bed(s), a desk and the luggage rack towards the window. Locked rooms are an empty locked room.
 */
export function guestRoom(k: Kit, level: number, r: [number, number, number, number], entry: Dir, doorAt: number, o: { locked?: boolean; twin?: boolean; tint?: number; washitsu?: boolean } = {}): number {
  const [x0, z0, x1, z1] = r;
  if (o.locked) return k.room(level, x0, z0, x1, z1, o.washitsu ? 'tatami' : 'bedroom', { locked: true });
  const id = k.room(level, x0, z0, x1, z1, o.washitsu ? 'tatami' : 'bedroom');
  // Work in (u along the corridor wall, v away from it) and map to x, z.
  const alongX = entry === 'z+' || entry === 'z-';
  const U0 = alongX ? x0 : z0;
  const U1 = alongX ? x1 : z1;
  const vFrom = entry === 'z+' ? z1 : entry === 'z-' ? z0 : entry === 'x+' ? x1 : x0;
  const sgn = entry === 'z+' || entry === 'x+' ? -1 : 1;
  const V = alongX ? z1 - z0 : x1 - x0;
  const rect = (u0: number, v0: number, u1: number, v1: number): [number, number, number, number] => {
    const va = vFrom + sgn * v0;
    const vb = vFrom + sgn * v1;
    return alongX ? [u0, Math.min(va, vb), u1, Math.max(va, vb)] : [Math.min(va, vb), u0, Math.max(va, vb), u1];
  };
  const faceV: Dir = alongX ? (sgn > 0 ? 'z+' : 'z-') : sgn > 0 ? 'x+' : 'x-';
  const faceU = (towardsHi: boolean): Dir => (alongX ? (towardsHi ? 'x+' : 'x-') : towardsHi ? 'z+' : 'z-');
  const put = (u0: number, v0: number, u1: number, v1: number, h: number, mat: MaterialId, s?: { kind: 'bed' | 'desk' | 'cabinet' | 'closet' | 'table'; face: Dir; table?: 'bath' | 'bedroom' | 'closet' | 'tatami' }, tint?: number): void => {
    const q = rect(u0, v0, u1, v1);
    k.furniture(level, q[0], q[1], q[2], q[3], h, mat, { tint, search: s });
  };
  // The door is near one end; the pod stands on the other side of the entry strip.
  const doorLow = doorAt - U0 < (U1 - U0) / 2;
  const podW = Math.min(1.5, U1 - U0 - 1.4);
  const [pu0, pu1] = doorLow ? [U1 - podW, U1] : [U0, U0 + podW];
  if (o.washitsu) {
    // 和室: tatami, a low table and cushions, the tokonoma and the oshiire, the window seat (広縁).
    const t = rect(U0, 1.4, U1, V);
    k.stain(level, t[0], t[1], t[2], t[3], 'tatami');
    const cu = (U0 + U1) / 2;
    const cv = 1.4 + (V - 1.4) * 0.45;
    const c = rect(cu - 0.6, cv - 0.45, cu + 0.6, cv + 0.45);
    k.furniture(level, c[0], c[1], c[2], c[3], 0.33, 'wood', { tint: 0.2, search: { kind: 'table', face: faceU(!doorLow), table: 'tatami' } });
    put(pu0, 0, pu1, 0.7, 1.9, 'wood', { kind: 'closet', face: faceV, table: 'closet' }, 0.6); // 押入
    put(doorLow ? U1 - 1.0 : U0, V - 0.9, doorLow ? U1 : U0 + 1.0, V - 0.5, 0.15, 'woodDark'); // 床の間
    const sw = rect(U0, V - 0.5, U1, V);
    k.stain(level, sw[0], sw[1], sw[2], sw[3], 'debris');
    return id;
  }
  put(pu0, 0, pu1, 1.6, 2.2, 'appliance', { kind: 'cabinet', face: faceU(!doorLow), table: 'bath' }, 0.1);
  const bedW = o.twin ? 1.0 : 1.4;
  const bv0 = Math.max(1.8, Math.min(V - 3.2, V * 0.4));
  const bv1 = Math.min(V - 0.9, bv0 + 2.0);
  // Beds against the far side wall from the door.
  const bu = doorLow ? U1 : U0;
  const dir = doorLow ? -1 : 1;
  const bed = (off: number): void => {
    const ua = bu + dir * off;
    const ub = bu + dir * (off + bedW);
    put(Math.min(ua, ub), bv0, Math.max(ua, ub), bv1, 0.55, 'fabric', off === 0 ? { kind: 'bed', face: faceU(!doorLow), table: 'bedroom' } : undefined, o.tint);
  };
  bed(0);
  if (o.twin && U1 - U0 > 3.9) bed(bedW + 0.9);
  // Desk on the door side wall, towards the window.
  const du = doorLow ? U0 : U1;
  const dv0 = Math.max(bv0, V - 1.6);
  put(Math.min(du, du - dir * 0.5), dv0, Math.max(du, du - dir * 0.5), V - 0.2, 0.72, 'wood', { kind: 'desk', face: faceU(doorLow), table: 'bedroom' }, 0.5);
  return id;
}

/**
 * Is rect [x0, z0, x1, z1] at least `margin` away from every straight line between two of `ways`
 * (the waypoints of a room's doors and joins)? Use it before placing furniture in a room with
 * several ways in, so the straight walks between them stay free (the catalog test checks them).
 */
export function clearOfWays(ways: readonly [number, number][], r: readonly [number, number, number, number], margin = 0.4): boolean {
  const near = (x: number, z: number): boolean => {
    const dx = Math.max(r[0] - x, 0, x - r[2]);
    const dz = Math.max(r[1] - z, 0, z - r[3]);
    return dx * dx + dz * dz < margin * margin;
  };
  for (let i = 0; i < ways.length; i++) {
    for (let j = i; j < ways.length; j++) {
      const [ax, az] = ways[i]!;
      const [bx, bz] = ways[j]!;
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.05));
      for (let s = 0; s <= n; s++) if (near(ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n)) return false;
    }
  }
  return true;
}
