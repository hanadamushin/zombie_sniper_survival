// 温泉旅館 (07d-2b). Two timber storeys under a big tiled hip roof, a carved gable canopy over the
// entrance. A corridor runs the length of both floors with the stair core off it. Ground floor:
// the lobby with the front desk, the banquet hall (広間), the souvenir shop; behind the corridor the
// large bath (大浴場: the dressing room, then the bath with its tub and the washing places), the
// store behind the stairs, the kitchen and the staff office. Upstairs: tatami guest rooms on both
// sides, each with its low table, cushions and a closet of futons; some are locked.
//
//   ground
//   +--------------+--+----+-------------+------+
//   | bath  [tub]  |st|stor| kitchen     |office|   back door locked
//   |---D----------|ai+-D--+             |      |
//   | dressing     |rs|    |             |      |
//   +------D-------+  +----+--D----------+--D---+
//   |               corridor                     |
//   +------D-------+-----D-----+---D-------------+
//   | 広間          | lobby     | shop            |
//   +--------------+===[door]==+-----------------+   z = d

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Kit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { capRail, core, coreSize, P, sign } from './common.ts';

/** A tatami guest room between x0 and x1, entered at x0 + 0.8 from the corridor wall at z = near. */
function washitsu(k: Kit, level: number, x0: number, x1: number, near: number, far: number, locked: boolean): void {
  const z0 = Math.min(near, far);
  const z1 = Math.max(near, far);
  k.room(level, x0, z0, x1, z1, 'tatami', { locked });
  if (locked) return;
  const s = far > near ? 1 : -1;
  const at = (a: number): number => near + s * a;
  const depth = z1 - z0;
  k.stain(level, x0, z0, x1, z1, 'tatami');
  // Low table in the middle of the far half, cushions round it, the futon closet on the x1 wall.
  const ta = Math.min(depth * 0.55 + 0.3, depth - 1.3);
  const tz = [at(ta), at(ta + 1.0)];
  const cx = (x0 + x1) / 2 - 0.2;
  k.furniture(level, cx - 0.6, Math.min(...tz), cx + 0.6, Math.max(...tz), 0.35, 'woodDark', { search: { kind: 'table', face: 'x-', table: 'tatami' } });
  for (const dx of [-1.05, 0.7]) k.furniture(level, cx + dx, Math.min(...tz) + 0.3, cx + dx + 0.35, Math.min(...tz) + 0.7, 0.1, 'fabric', { tint: 0.1, solid: false });
  const cz = [at(1.8), at(Math.min(depth - 0.2, 3.6))];
  k.furniture(level, x1 - 0.8, Math.min(...cz), x1, Math.max(...cz), 1.8, 'wood', { tint: 0.85, search: { kind: 'closet', face: 'x-', table: 'closet' } });
  if (k.rand() < 0.2) k.stain(level, x0 + 0.4, Math.min(at(1.6), at(2.6)), x0 + 1.4, Math.max(at(1.6), at(2.6)));
}

export const SHOP_RYOKAN_ONSEN: BuildingDef = {
  id: 'shop.ryokan_onsen',
  category: 'shop',
  variant: 'ryokan_onsen',
  kind: 'house',
  size: { w: [22, 28], d: [16, 20] },
  storeys: 2,
  storeyHeight: ARCH.storey.house,
  plinth: 0.4,
  roof: 'hip',
  roofRise: 2.8,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_RYOKAN_ONSEN, params, rng);
    const { w, d } = k;
    const t = 0.2;
    k.thick = t;
    const lane = ARCH.stair.width;
    const { cw, depth } = coreSize(k, lane);
    const zc0 = t + 5.5; // back rooms | corridor
    const zc1 = zc0 + 1.8; // corridor | front rooms
    const xb = t + 7.0; // bath | stairs
    const xs = xb + P; // the stair core [xs, xs + cw]
    const xk = xs + cw; // stairs and store | kitchen (centre line)
    const xo = w - t - 4.0; // kitchen | office (centre line)
    const zdr = zc0 - 2.3; // bath | dressing room
    const zst = zc0 - depth - P; // store | stairs (centre line)
    const xh0 = t + (w - 2 * t) * 0.38; // hall | lobby
    const xh1 = xh0 + 5.0; // lobby | shop
    const wall = k.pick(['plaster', 'woodDark'] as const);
    const tint = k.rand();
    const lobbyX = (xh0 + xh1) / 2;

    // --- ground floor ---
    k.floor(0, 'flooring', undefined, { tint: 0.4 });
    k.outerWalls(0, {
      mat: wall, tint,
      front: [k.window((t + xh0) / 2 - 1.6, 1.8, { sill: 0.4 }), k.window((t + xh0) / 2 + 1.6, 1.8, { sill: 0.4, broken: k.rand() < 0.4 }), k.door(lobbyX, 'open', ARCH.door.wide), k.window((xh1 + w - t) / 2, 2.4, { sill: 0.4 })],
      back: [k.window((t + xb) / 2, 3.0, { sill: 1.4, head: 2.2 }), k.window((xk + xo) / 2, 1.2, { sill: 1.1 }), k.door(xo - 1.0, 'locked'), k.window((xo + w - t) / 2, 1.0)],
      left: [k.window((zdr + zc0) / 2, 1.0, { sill: 1.4 }), k.window((zc1 + d) / 2, 2.0, { sill: 0.4 })],
      right: [k.window(zc0 / 2, 1.0), k.window((zc1 + d) / 2, 1.6, { sill: 0.4 })],
    });
    core(k, 0, xs, zc0, lane, { mat: 'woodDark' });
    k.partition(0, t, zc0, xb, zc0, [k.door((t + xb) / 2 - t)]);
    k.partition(0, xk, zc0, w - t, zc0, [k.door(xk + 1.0 - xk), k.door(xo + 1.0 - xk)]);
    k.partition(0, xb, t, xb, zc0 - P, [], { mat: 'plaster', tint: 0.95 });
    k.partition(0, xk, t, xk, zc0 - P, [k.door((t + zst) / 2 - t)]);
    k.partition(0, xs, zst, xk - P, zst);
    k.partition(0, t, zdr, xb - P, zdr, [k.door((t + xb) / 2 - t)], { mat: 'plaster', tint: 0.95 });
    k.partition(0, xo, t, xo, zc0 - P);
    k.room(0, t, t, xb - P, zdr - P, 'bath');
    k.room(0, t, zdr + P, xb - P, zc0 - P, 'bath');
    k.room(0, xs, t, xk - P, zst - P, 'storage');
    k.room(0, xk + P, t, xo - P, zc0 - P, 'kitchen');
    k.room(0, xo + P, t, w - t, zc0 - P, 'office');
    k.room(0, t, zc0 + P, w - t, zc1 - P, 'hall');
    // The bath: a tub along the back wall, washing places on the right, a shelf of soap.
    const y = k.levelY(0);
    k.furniture(0, t + 1.0, t + 0.3, xb - 1.2, t + 2.0, 0.5, 'tileFloor', { tint: 0.2 });
    k.box(0, t + 1.15, y + 0.42, t + 0.45, xb - 1.35, y + 0.45, t + 1.85, 'glass', { tint: 0.5, solid: false });
    k.furniture(0, t, t + 2.3, t + 0.4, zdr - P - 0.1, 0.9, 'tileFloor', { tint: 0.8, search: { kind: 'shelf', face: 'x+', table: 'bath' } });
    for (let z = t + 0.4; z + 0.5 < zdr - 0.4; z += 0.9) {
      k.box(0, xb - P - 0.05, y + 0.8, z, xb - P, y + 1.5, z + 0.5, 'glass', { solid: false });
      k.furniture(0, xb - 0.7, z + 0.1, xb - 0.35, z + 0.45, 0.3, 'wood', { tint: 0.9, solid: false });
    }
    // Dressing room: basket shelves, a bench, the mirror.
    k.furniture(0, t, zdr + 0.4, t + 0.5, zc0 - P - 0.3, 1.5, 'shelf', { tint: 0.7, search: { kind: 'shelf', face: 'x+', table: 'bath' } });
    k.furniture(0, xb - 0.5, zdr + 0.5, xb - P, zc0 - P - 0.5, 0.45, 'wood', { tint: 0.7 });
    // Store behind the stairs, kitchen, office.
    k.furniture(0, xs, t, xk - P, t + 0.5, 1.9, 'shelf', { search: { kind: 'shelf', face: 'z+', table: 'storage' } });
    k.furniture(0, xk + 2.0, t, xo - 1.2, t + 0.7, 0.9, 'steel', { tint: 0.8, search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } });
    k.furniture(0, xo - P - 0.8, t, xo - P, t + 0.8, 1.8, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'grocery' } });
    k.furniture(0, xk + 2.4, t + 1.9, xo - 1.6, t + 2.7, 0.9, 'wood', { tint: 0.6 });
    k.furniture(0, w - t - 1.6, t, w - t, t + 0.7, 0.75, 'wood', { tint: 0.5, search: { kind: 'desk', face: 'z+', table: 'office' } });
    k.furniture(0, w - t - 0.6, t + 2.2, w - t, zc0 - P - 1.0, 1.8, 'steel', { tint: 0.5 });
    // Front: the banquet hall, the lobby, the shop.
    k.partition(0, t, zc1, w - t, zc1, [k.door((t + xh0) / 2 - t, 'open', ARCH.door.wide), k.door(lobbyX - t, 'open', ARCH.door.wide), k.door(xh1 + 1.0 - t)]);
    k.partition(0, xh0, zc1 + P, xh0, d - t);
    k.partition(0, xh1, zc1 + P, xh1, d - t);
    k.room(0, t, zc1 + P, xh0 - P, d - t, 'tatami');
    k.room(0, xh0 + P, zc1 + P, xh1 - P, d - t, 'lobby');
    k.room(0, xh1 + P, zc1 + P, w - t, d - t, 'sales');
    k.stain(0, t, zc1 + P, xh0 - P, d - t, 'tatami');
    for (let z = zc1 + 2.2; z + 0.6 < d - t - 0.6; z += 2.0) k.furniture(0, t + 0.8, z, xh0 - 0.8, z + 0.6, 0.35, 'woodDark', { search: z === zc1 + 2.2 ? { kind: 'table', face: 'z-', table: 'canteen' } : undefined });
    k.furniture(0, xh1 - 0.7, zc1 + 1.4, xh1 - P, d - t - 2.0, 1.05, 'woodDark', { search: { kind: 'counter', face: 'x-', table: 'office' } });
    for (let z = zc1 + 1.6; z + 0.8 < d - t - 1.6; z += 1.4) k.furniture(0, xh0 + P, z, xh0 + 0.9, z + 0.8, 0.45, 'fabric', { tint: 0.3 });
    for (let x = xh1 + 2.2; x + 0.8 < w - t - 0.6; x += 2.2) k.furniture(0, x, zc1 + 1.4, x + 0.8, d - t - 1.4, 1.2, 'shelf', { tint: 0.6, search: x === xh1 + 2.2 ? { kind: 'shelf', face: 'x-', table: 'grocery' } : undefined });
    k.stain(0, lobbyX - 0.4, zc0 + 0.4, lobbyX + 1.2, zc1 - 0.3);

    // --- upper floor: guest rooms ---
    k.floor(1, 'tatami', undefined, { tint: 0.6 });
    // Rooms as [x0, x1] inside their partitions; a partition stands at x0 - P of every room after the first in a run.
    const run = (a: number, b: number, n: number): [number, number][] =>
      Array.from({ length: n }, (_, i): [number, number] => [a + ((b - a) * i) / n + (i > 0 ? P : 0), a + ((b - a) * (i + 1)) / n - (i < n - 1 ? P : 0)]);
    const fronts = run(t, w - t, Math.max(3, Math.floor((w - 2 * t) / 4.5)));
    const backs = [...run(t, xb - P, 2), ...run(xk + P, w - t, Math.max(1, Math.floor((w - t - xk) / 4.2)))];
    k.outerWalls(1, {
      mat: wall, tint,
      front: fronts.map(([a, b], i) => k.window((a + b) / 2, 1.8, { broken: i === 1 && k.rand() < 0.5 })),
      back: backs.map(([a, b]) => k.window((a + b) / 2, 1.4)),
      left: [k.window((t + zc0) / 2, 1.2), k.window((zc1 + d) / 2, 1.2)],
      right: [k.window((t + zc0) / 2, 1.2), k.window((zc1 + d) / 2, 1.2)],
    });
    k.room(1, t, zc0 + P, w - t, zc1 - P, 'hall');
    k.partition(1, t, zc0, xb, zc0, backs.filter(([a]) => a < xb).map(([a]) => k.door(a + 0.8 - t)));
    k.partition(1, xk, zc0, w - t, zc0, backs.filter(([a]) => a > xb).map(([a]) => k.door(a + 0.8 - xk)));
    k.partition(1, t, zc1, w - t, zc1, fronts.map(([a]) => k.door(a + 0.8 - t)));
    k.partition(1, xb, t, xb, zc0 - P);
    k.partition(1, xk, t, xk, zc0 - P);
    k.partition(1, xs, zst, xk - P, zst);
    k.room(1, xs, t, xk - P, zst - P, 'closet', { locked: true });
    capRail(k, 1, xs, zc0, lane);
    backs.forEach(([x0, x1], i) => {
      if (i === 1 || i > 2) k.partition(1, x0 - P, t, x0 - P, zc0 - P);
      washitsu(k, 1, x0, x1, zc0 - P, t, k.rand() < 0.3);
    });
    fronts.forEach(([x0, x1], i) => {
      if (i > 0) k.partition(1, x0 - P, zc1 + P, x0 - P, d - t);
      washitsu(k, 1, x0, x1, zc1 + P, d - t, k.rand() < 0.3);
    });

    // --- roof, the entrance ---
    k.roofHip({ mat: 'tile', tint: k.rand(), axis: 'x' });
    k.part({ shape: 'gable', x0: lobbyX - 1.8, x1: lobbyX + 1.8, z0: d - 0.4, z1: d + 0.6, y0: k.levelY(1) - 0.3, y1: k.levelY(1) + 0.6, axis: 'z', mat: 'tile', tint: 0.2, solid: false });
    k.box(-1, lobbyX - 0.75, y + 1.5, d, lobbyX + 0.75, y + 2.0, d + 0.04, 'fabric', { layer: 'shell', tint: 0.6, solid: false }); // noren
    sign(k, lobbyX + 1.3, lobbyX + 1.8, y + 0.4, y + 2.4, 0.3, { mat: 'woodDark' });
    for (const x of [lobbyX - 3.0, lobbyX + 2.6]) {
      k.box(-1, x, -0.2, d + 0.1, x + 0.4, 0.9, d + 0.5, 'concrete', { layer: 'shell', tint: 0.6, solid: false });
      k.box(-1, x - 0.1, 0.9, d + 0.0, x + 0.5, 1.2, d + 0.6, 'concrete', { layer: 'shell', tint: 0.6, solid: false });
    }
    return k.finish();
  },
};
