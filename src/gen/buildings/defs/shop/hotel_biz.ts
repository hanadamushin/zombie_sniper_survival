// ビジネスホテル (07d-2b): ten storeys of the same plan. A switchback stair at the left end (the lift
// beside it is dead), the lift hall, a corridor down the middle and identical single / twin rooms
// either side of it — each with its bath pod by the door, a bed, a desk under the window. About half
// the rooms are locked (card keys without power). The ground floor is the lobby (front desk with the
// office behind it, the breakfast room, the luggage store); the stair goes on up to a stair house on
// the roof, with the water tank and the big HOTEL sign.
//
// The long walls are one pilaster / spandrel facade for all the upper storeys (common.ts facade), so
// the outside stays within the triangle budget however many windows there are.
//
//   upper storeys                                       ground
//   +--------+----+----+----+----+----+                 +--------+---------+--------------+
//   | linen  |lift| room | room | room |                 | linen  | lift |store |  office   |
//   |  (L)   +----+-D----D----D----D---+                 |  (L)   +----+-+---D--+==desk====g|
//   | stair  | H  =  corridor          |                 | stair  | H  =   lobby            |
//   |        |    +-D----D----D----D---+                 |        |    D                   |
//   | vending room| room | room | room |                 | breakfast   |   [sofas]          |
//   +-------------+------+------+------+                 +-------------+=====[door]========+

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { clearOfWays, facade, guestRoom, P, sign, table, vending } from './common.ts';

const LANE = ARCH.stair.wideWidth;

export const SHOP_HOTEL_BIZ: BuildingDef = {
  id: 'shop.hotel_biz',
  category: 'shop',
  variant: 'hotel_biz',
  kind: 'office',
  size: { w: [18, 24], d: [13, 15] },
  storeys: 10,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.15,
  roof: 'flat',
  roofRise: 3.6,
  lootable: true,
  generate(rng, params) {
    const k = createKit(SHOP_HOTEL_BIZ, params, rng);
    const { w, d } = k;
    const t = ARCH.wall.concrete;
    k.thick = t;
    const tile = k.rand();
    const accent = k.rand();
    const zm = d / 2;
    const n = Math.ceil(k.def.storeyHeight / 2 / ARCH.stair.maxRise - 1e-6);
    const xs1 = t + n * ARCH.stair.going + ARCH.stair.landing; // front of the stairwell (flights climb towards -x)
    const xr0 = xs1 + 2.6; // lift hall | rooms
    const hz0 = zm - 1.35; // hall's back wall
    const hz1 = zm + 1.35; // hall's front wall
    const zc0 = zm - 0.7; // corridor
    const zc1 = zm + 0.7;
    const m = Math.max(2, Math.floor((w - t - xr0) / 3.0));
    const U = (w - t - xr0) / m;
    const edges = Array.from({ length: m + 1 }, (_, i) => xr0 + i * U);
    const shaft: [number, number, number, number] = [xs1 + 0.25, hz0 - P - 2.0, xs1 + 2.35, hz0 - P];
    k.shaft(shaft, 0, k.storeys - 1);
    const top = k.storeys - 1;

    // ---- Outside: ground-floor walls, the facade of the upper storeys, the roof.
    const y1 = k.levelY(1);
    const lobbyDoor = (xr0 + w) / 2;
    k.outerWalls(0, {
      mat: 'concrete', tint: tile, y1,
      front: [
        k.window((t + xr0) / 2, xr0 - t - 1.0, { sill: 0.6, head: 2.6, broken: k.rand() < 0.3 }),
        k.window((xr0 + lobbyDoor - 1.0) / 2, lobbyDoor - 1.0 - xr0 - 0.6, { sill: 0.2, head: 2.8, broken: k.rand() < 0.3 }),
        k.door(lobbyDoor, 'open', ARCH.door.wide),
        k.window((lobbyDoor + 1.0 + w) / 2, w - lobbyDoor - 1.0 - 0.6, { sill: 0.2, head: 2.8 }),
      ],
      back: [k.door(xr0 + 1.0, 'locked'), k.window(w - 2.0, 1.2, { sill: 1.2 })],
      right: [k.window(zc1 + 1.5, 1.2, { sill: 1.0 })],
    });
    const yTop = k.eaves + ARCH.rail.parapet;
    const piers = [0.2, xr0, ...edges.slice(1, -1), w - 0.2];
    facade(k, { axis: 'x', u0: 0, u1: w, t0: d - t, t1: d, from: 1, to: k.storeys, y0: y1, y1: yTop, piers, pier: 0.4, sill: 0.85, head: 2.45, mat: 'concrete', tint: tile, pierMat: 'plaster', broken: 0.05 });
    facade(k, { axis: 'x', u0: 0, u1: w, t0: 0, t1: t, from: 1, to: k.storeys, y0: y1, y1: yTop, piers, pier: 0.4, sill: 0.85, head: 2.45, mat: 'concrete', tint: tile, pierMat: 'plaster' });
    facade(k, { axis: 'z', u0: t, u1: d - t, t0: w - t, t1: w, from: 1, to: k.storeys, y0: y1, y1: yTop, piers: [t + 0.2, zc0 - P, zc1 + P, d - t - 0.2], pier: 0.4, sill: 0.9, head: 2.2, mat: 'concrete', tint: tile });
    k.box(-1, 0, y1, t, t, yTop, d - t, 'concrete', { layer: 'shell', tint: tile });
    k.roofFlat({ mat: 'concrete', tint: tile });
    // Vertical HOTEL sign on the front right corner, the canopy over the door.
    sign(k, w - 0.9, y1 + 1.0, d, w - 0.3, k.eaves - 1.0, d + 0.5, accent);
    k.box(-1, lobbyDoor - 2.0, k.levelY(0) + 2.9, d - 0.05, lobbyDoor + 2.0, k.levelY(0) + 3.1, d + 0.55, 'steel', { layer: 'shell', solid: false });

    // ---- Every storey: the stair, the lift hall, the vending room, the locked linen room.
    for (let level = 0; level < k.storeys; level++) {
      k.floor(level, level === 0 ? 'tileFloor' : 'carpet');
      k.stairs({ level, start: [xs1, zm + LANE / 2 + 0.075], dir: 'x-', width: LANE, kind: 'switchback', turn: 'right', mat: 'concrete', tint: tile, to: level + 1 });
      // Stairwell walls (back and front), the hall's walls.
      k.partition(level, t, hz0, xr0, hz0, [Object.assign(k.door(xs1 + 1.3 - t, 'locked'), { leaf: 'doorSteel' as const })]);
      k.partition(level, t, hz1, xr0, hz1, [k.door(xs1 + 1.3 - t)]);
      k.partition(level, xs1 - 0.1, shaft[1], xs1 - 0.1, hz0 - P);
      const H = k.room(level, xs1, hz0 + P, xr0, hz1 - P, level === 0 ? 'lobby' : 'hall');
      k.room(level, t, t, xs1 - 0.1 - P, hz0 - P, 'storage', { locked: true });
      // The room in front of the stair: breakfast room downstairs, vending machines and ice upstairs.
      if (level === 0) k.partition(level, xr0, hz1 + P, xr0, d - t, [k.door((d - t - hz1) / 2)]);
      else k.partition(level, xr0, zc1 + P, xr0, d - t);
      k.room(level, t, hz1 + P, xr0 - P, d - t, 'canteen');
      if (level === 0) {
        table(k, 0, (t + xr0) / 2 + 0.6, d - t - 1.4, 1.6, 0.8, { chairs: ['z+', 'z-'], tint: 0.6 });
        k.furniture(0, t, hz1 + 0.4, t + 0.6, d - t - 0.4, 0.9, 'counter', { tint: 0.4, search: { kind: 'counter', face: 'x+', table: 'canteen' } });
      } else {
        vending(k, level, t, hz1 + P, t + 1.0, hz1 + 0.85, 'z+', { search: true, tint: accent });
        k.furniture(level, t + 1.1, hz1 + P, t + 1.9, hz1 + 0.8, 0.9, 'appliance', { tint: 0.8 });
        if (k.rand() < 0.3) k.stain(level, t + 0.5, d - t - 1.6, xr0 - 0.6, d - t - 0.6);
      }
      if (level === 0) {
        groundFloor(k, { H, t, xr0, zc0, zc1, hz1, lobbyDoor, accent });
        continue;
      }
      // Corridor and the rooms either side.
      const C = k.room(level, xr0, zc0 + P, w - t, zc1 - P, 'hall');
      k.join(H, C);
      const back: ReturnType<typeof k.door>[] = [];
      const fr: ReturnType<typeof k.door>[] = [];
      for (let i = 0; i < m; i++) {
        const x0 = edges[i]!;
        const x1 = edges[i + 1]!;
        const at = i % 2 === 0 ? x0 + 0.75 : x1 - 0.75;
        for (const side of ['back', 'front'] as const) {
          const locked = k.rand() < 0.5 && !(level === top && i === 0);
          const r: [number, number, number, number] = side === 'back' ? [x0 + P, t, x1 - P, zc0 - P] : [x0 + P, zc1 + P, x1 - P, d - t];
          guestRoom(k, level, r, side === 'back' ? 'z+' : 'z-', at, { locked, twin: k.rand() < 0.35, tint: accent });
          (side === 'back' ? back : fr).push(k.door(at - xr0, locked ? 'locked' : 'open'));
        }
        if (i > 0) {
          k.partition(level, x0, t, x0, zc0 - P);
          k.partition(level, x0, zc1 + P, x0, d - t);
        }
      }
      k.partition(level, xr0, t, xr0, zc0 - P);
      k.partition(level, xr0, zc0, w - t, zc0, back);
      k.partition(level, xr0, zc1, w - t, zc1, fr);
      if (k.rand() < 0.4) {
        const sx0 = xr0 + 1.0 + k.rand() * (w - xr0 - 4);
        k.stain(level, sx0, zc0 + 0.2, sx0 + 1.5, zc1 - 0.2);
      }
    }

    // ---- Roof: the stair house over the stairwell (its door faces east), the tank, the sign.
    const e = k.eaves;
    const R = k.storeys;
    const sx = xs1 + 1.2; // the stair house's east wall
    const wallOpts = { mat: 'concrete' as const, tint: tile, y0: e, y1: e + 2.7, layer: 'shell' as const };
    k.wall(R, sx, hz0, sx + t, hz1, [k.door(hz1 - hz0 - 1.5)], wallOpts);
    k.wall(R, t, hz0 - t, sx + t, hz0, [], wallOpts);
    k.wall(R, t, hz1, sx + t, hz1 + t, [], wallOpts);
    k.box(-1, 0, yTop, hz0 - t, t, e + 2.7, hz1 + t, 'concrete', { layer: 'shell', tint: tile });
    k.box(-1, 0, e + 2.7, hz0 - t, sx + t, e + 2.9, hz1 + t, 'concrete', { layer: 'shell', tint: tile });
    k.room(R, xs1, hz0, sx, hz1, 'stairs');
    const roofE = k.room(R, sx + t, t, w - t, d - t, 'roof');
    const roofF = k.room(R, t, hz1 + t, sx + t, d - t, 'roof');
    const roofB = k.room(R, t, t, sx + t, hz0 - t, 'roof');
    k.join(roofF, roofE);
    k.join(roofB, roofE);
    k.furniture(R, w - t - 3.0, t + 0.5, w - t - 0.8, t + 2.5, 2.2, 'rust', { search: { kind: 'crate', face: 'z+', table: 'roof' } });
    k.furniture(R, sx + 1.5, d - t - 1.6, sx + 3.3, d - t - 0.6, 1.2, 'steel', { tint: 0.6 });
    sign(k, xr0, e + 0.6, d - 0.5, w - 1.5, e + 3.5, d - 0.35, accent);
    k.box(-1, xr0 + 0.3, e, d - 0.55, xr0 + 0.45, e + 0.6, d - 0.3, 'steel', { layer: 'shell' });
    k.box(-1, w - 1.9, e, d - 0.55, w - 1.75, e + 0.6, d - 0.3, 'steel', { layer: 'shell' });
    return k.finish();
  },
};

/** The lobby: front desk (a low wall with a gate) and the office and store behind it; sofas. */
function groundFloor(k: ReturnType<typeof createKit>, o: { H: number; t: number; xr0: number; zc0: number; zc1: number; hz1: number; lobbyDoor: number; accent: number }): void {
  const { w, d } = k;
  const { t, xr0, zc0, hz1, lobbyDoor, accent } = o;
  const y = k.levelY(0);
  const xo = Math.min(w - t - 4.0, xr0 + 4.0); // store | office
  const gateX = w - t - 0.7;
  k.partition(0, xr0, t, xr0, zc0 - P);
  k.partition(0, xr0, zc0, xo, zc0, []);
  k.partition(0, xo, zc0, w - t, zc0, [k.door(gateX - xo)], { mat: 'counter', tint: accent, y1: y + 1.1 });
  k.partition(0, xo, t, xo, zc0 - P, [k.door(zc0 - 1.4 - t)]);
  k.room(0, xr0 + P, t, xo - P, zc0 - P, 'storage');
  k.furniture(0, xr0 + P, t + 0.3, xr0 + 0.7, zc0 - 0.5, 2.0, 'shelf', { search: { kind: 'shelf', face: 'x+', table: 'storage' } });
  k.room(0, xo + P, t, w - t, zc0 - P, 'office');
  k.furniture(0, xo + 1.4, t, w - t - 1.6, t + 0.5, 1.8, 'steel', { tint: 0.7, search: { kind: 'cabinet', face: 'z+', table: 'office' } });
  k.furniture(0, w - t - 0.8, t + 0.5, w - t, t + 1.9, 0.72, 'wood', { tint: 0.5, search: { kind: 'desk', face: 'x-', table: 'office' } });
  const L = k.room(0, xr0 + P, zc0 + P, w - t, d - t, 'lobby');
  // The hall opens into the lobby where the corridor would be.
  k.join(o.H, L);
  const ways: [number, number][] = [[xr0 + P + 0.5, (zc0 + hz1) / 2], [lobbyDoor, d - t - 0.65], [gateX, zc0 + 0.61], [xr0 + 0.61, (hz1 + d - t) / 2]];
  for (const [cx, cz] of [[xr0 + 2.2, d - t - 1.6], [w - t - 2.2, d - t - 1.6], [(xr0 + w) / 2, zm(o)]] as const) {
    const r: [number, number, number, number] = [cx - 1.3, cz - 0.9, cx + 1.3, cz + 0.9];
    if (clearOfWays(ways, r, 0.35)) {
      k.furniture(0, cx - 1.0, cz - 0.3, cx + 1.0, cz + 0.3, 0.42, 'wood', { tint: 0.3 });
      k.furniture(0, cx - 1.1, cz + 0.45, cx + 1.1, cz + 0.9, 0.8, 'fabric', { tint: accent });
    }
  }
  k.search(0, gateX - 1.6, zc0 + 0.75, 'counter', 'lobby');
  k.stain(0, lobbyDoor - 1.0, d - t - 1.6, lobbyDoor + 1.0, d - t - 0.4, 'debris');
}

function zm(o: { zc0: number; zc1: number }): number {
  return (o.zc0 + o.zc1) / 2 + 1.2;
}
