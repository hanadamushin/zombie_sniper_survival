// 狭小 3 階建て (07d-2a). A narrow three-storey town house on a deep plot: a built-in garage behind
// a rolled-down shutter, the living floor in the middle, bedrooms on top, and a roof terrace reached
// by the stair, which folds back on itself up a core along the right wall.
//
//   ground                 1st                    2nd                    roof
//   +------+----+          +------+----+          +------+----+          +------+----+
//   | bath |stair|         |kitchen|stair|        | bed  |stair|         | roof |塔屋 |
//   |      | ↕   |         |  LDK  | ↕   |        |      | ↕   |         |      |  D  |
//   +------+    |          |       =hall |        +--  --D    |          |  terrace   |
//   |garage D hall|        |       |    |        | bed  D hall|          |            |
//   | (car)|    |          |       +-D--+         |      |    |          |            |
//   +shutter+-D-+          +-------+ WC +         +------+----+          +------------+

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P } from './common.ts';

export const HOUSE_KYOSHO3: BuildingDef = {
  id: 'house.kyosho3',
  category: 'house',
  variant: 'kyosho3',
  kind: 'house',
  size: { w: [5.2, 6.4], d: [9.5, 11.5] },
  storeys: 3,
  storeyHeight: ARCH.storey.house,
  plinth: 0.2,
  roof: 'flat',
  roofRise: 2.9,
  lootable: true,
  generate(rng, params) {
    const k = createKit(HOUSE_KYOSHO3, params, rng);
    const { w, d } = k;
    const t = 0.15;
    k.thick = t;
    const xcI = w - t - 2.0; // the core's inner face (left)
    const xc = xcI - P; // left rooms | core (centre line)
    const laneA = xcI + 0.47;
    const zs = t + 3.3; // the line the stair starts from on every floor
    const zg = Math.max(zs + 1.4, d - t - 5.2); // bath | garage
    const zt = d - t - 1.5; // 1st floor: hall | WC
    const zm = Math.max(zs + 1.4, (t + d) / 2 + 0.5); // 2nd floor: back | front bedroom
    const tint = k.rand();
    const wallMat = k.pick(['siding', 'concrete', 'mortar'] as const);
    const coreX = xcI + 1.0;

    const core = (level: number, use: 'hall' | 'genkan', z1 = d - t): number => k.room(level, xcI, zs, w - t, z1, use);
    const stair = (level: number): void => {
      k.stairs({ level, start: [laneA, zs], dir: 'z-', width: 0.9, kind: 'switchback', turn: 'right', mat: 'woodDark' });
    };

    // --- ground: garage, bath, the entrance hall ---
    k.floor(0, 'concrete', [t, t, xc - P, d - t]);
    k.floor(0, 'flooring', [xc - P, t, w - t, d - t]);
    k.outerWalls(0, {
      mat: wallMat, tint,
      front: [k.door((t + xc) / 2, 'shutter', xc - t - 0.5), k.door(coreX)],
      back: [k.window((t + xc) / 2, 0.6, { sill: 1.4 })],
      right: [k.window((zs + d) / 2, 0.4, { sill: 1.5 })],
    });
    k.partition(0, xc, t, xc, d - t, [k.door((zs + zg) / 2 - t), k.door((zg + d - t) / 2 - t)]);
    k.partition(0, t, zg, xc, zg);
    const hall0 = core(0, 'genkan');
    void hall0;
    k.room(0, t, t, xc - P, zg - P, 'bath');
    k.room(0, t, zg + P, xc - P, d - t, 'garage');
    stair(0);
    k.furniture(0, t, t, t + 0.8, t + 1.6, 0.6, 'tileFloor'); // tub
    k.furniture(0, xc - P - 0.5, t, xc - P, t + 0.9, 0.85, 'counter', { search: { kind: 'cabinet', face: 'x-', table: 'bath' } });
    k.furniture(0, t, zg + P, t + 1.6, zg + 0.45, 1.8, 'shelf', { search: { kind: 'shelf', face: 'z+', table: 'tools' } });
    if (d >= 10.5 && k.rand() < 0.7) {
      // A kei car, nose to the shutter, beside the way in from the hall.
      const y = k.levelY(0);
      k.box(0, t + 0.1, y + 0.2, d - t - 3.5, t + 1.55, y + 0.95, d - t - 0.2, 'steel', { tint: k.rand(), role: 'furniture' });
      k.box(0, t + 0.15, y + 0.95, d - t - 2.8, t + 1.5, y + 1.5, d - t - 1.0, 'glass', { role: 'furniture' });
    }
    k.stain(0, xcI + 0.3, zs + 1.6, xcI + 1.5, zs + 2.6);

    // --- 1st: the living floor ---
    k.floor(1, 'flooring');
    k.outerWalls(1, {
      mat: wallMat, tint,
      front: [k.window((t + xc) / 2, xc - t - 0.8, { sill: 0.4, broken: k.rand() < 0.4 }), k.window(coreX, 0.5, { sill: 1.4 })],
      back: [k.window((t + xc) / 2, 1.4, { sill: 1.0 })],
      right: [k.window((zs + zt) / 2, 0.9, { sill: 1.0 })],
    });
    k.partition(1, xc, t, xc, zs);
    k.partition(1, xcI, zt, w - t, zt, [k.door(1.0, 'open', 0.8)]);
    const ldk = k.room(1, t, t, xc - P, d - t, 'living');
    const hall1 = core(1, 'hall', zt - P);
    k.join(ldk, hall1);
    k.room(1, xcI, zt + P, w - t, d - t, 'toilet');
    stair(1);
    k.furniture(1, t, t, t + 0.65, t + 2.6, 0.9, 'counter', { search: { kind: 'cabinet', face: 'x+', table: 'kitchen' } });
    k.furniture(1, xc - P - 0.7, t, xc - P, t + 0.7, 1.8, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'kitchen' } });
    k.furniture(1, t + 0.9, t + 3.2, t + 1.9, t + 4.4, 0.72, 'wood', { tint: 0.8 }); // table
    k.furniture(1, t, d - t - 2.6, t + 0.85, d - t - 0.8, 0.45, 'fabric', { tint: k.rand() });
    k.furniture(1, t + 1.0, d - t - 0.45, t + 2.2, d - t, 0.5, 'woodDark', { search: { kind: 'cabinet', face: 'z-', table: 'living' } });
    k.furniture(1, xcI + 0.3, d - t - 0.4, xcI + 1.4, d - t, 1.2, 'shelf', { search: { kind: 'shelf', face: 'z-', table: 'toilet' } });

    // --- 2nd: two bedrooms ---
    k.floor(2, 'flooring');
    k.outerWalls(2, {
      mat: wallMat, tint, parapet: ARCH.rail.parapet,
      front: [k.window((t + xc) / 2, 1.6, { broken: k.rand() < 0.3 })],
      back: [k.window((t + xc) / 2, 1.2)],
      right: [k.window(d - t - 1.0, 0.6, { sill: 1.2 })],
    });
    k.partition(2, xc, t, xc, d - t, [k.door((zs + zm) / 2 - t), k.door((zm + d - t) / 2 - t)]);
    k.partition(2, t, zm, xc, zm);
    core(2, 'hall');
    k.room(2, t, t, xc - P, zm - P, 'bedroom');
    k.room(2, t, zm + P, xc - P, d - t, 'bedroom');
    stair(2);
    k.furniture(2, t, t, t + 1.0, t + 2.0, 0.45, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x+', table: 'bedroom' } });
    k.furniture(2, t, zm - 0.6 - P, t + 1.4, zm - P, 1.9, 'wood', { search: { kind: 'closet', face: 'z-', table: 'bedroom' } });
    k.furniture(2, t, d - t - 2.0, t + 0.9, d - t, 0.45, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x+', table: 'bedroom' } });
    k.box(2, t + 1.0, k.levelY(2), zm + 0.3, xc - 0.7, k.levelY(2) + 0.45, zm + 0.9, 'wood', { tint: 0.5, role: 'furniture' }); // toppled shelf

    // --- roof terrace and the stair house ---
    k.roofFlat({ mat: 'concrete', tint: 0.5 }); // the parapet is the top of the 2nd floor's walls
    const e = k.eaves;
    const ph = 2.6;
    const pz = zs + 1.3; // front face of the stair house
    const so = { mat: wallMat, tint, y0: e, y1: e + ph, layer: 'shell' as const };
    k.wall(3, xcI - t, pz, w, pz + t, [k.door(coreX - (xcI - t))], so);
    k.wall(3, xcI - t, t, xcI, pz, [], so);
    const pp = e + ARCH.rail.parapet;
    k.box(-1, xcI - t, pp, 0, w, e + ph, t, wallMat, { layer: 'shell', tint });
    k.box(-1, w - t, pp, t, w, e + ph, pz, wallMat, { layer: 'shell', tint });
    k.box(-1, xcI - t, e + ph, 0, w, e + ph + 0.2, pz + t, 'concrete', { layer: 'shell', tint: 0.5 });
    k.room(3, xcI, t, w - t, pz, 'stairs');
    const terrace = k.room(3, t, pz + t, w - t, d - t, 'roof');
    const side = k.room(3, t, t, xcI - t, pz + t, 'roof');
    k.join(side, terrace);
    k.furniture(3, t, d - t - 1.2, t + 1.6, d - t - 0.3, 0.7, 'wood', { tint: 0.4, search: { kind: 'crate', face: 'z-', table: 'storage' } }); // planter box / storage bench
    return k.finish();
  },
};
