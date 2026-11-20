// 木造平屋 (07d-2a). A one-storey timber house behind a front garden with a block wall and a 物置.
//
//   +---------+------+----+--------+    back rooms off the corridor: kitchen (back door), bath,
//   | kitchen | bath |WC  | 納戸/寝室|    toilet, a store room or bedroom (by width)
//   +--D------+--D---+-D--+---D----+
//   |              corridor           |
//   +  open  +----D------+----D------+
//   | genkan | living     | tatami     |
//   +---D----+------------+------------+
//   |  garden   gate      [物置]       |   front (z = d)
//
// The roof is a gable or a hip (seeded); the living room may have its front window boarded up.

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { boards, fence, hedge, P, pitched, ring, shed, tree } from './common.ts';

export const HOUSE_HIRAYA: BuildingDef = {
  id: 'house.hiraya',
  category: 'house',
  variant: 'hiraya',
  kind: 'house',
  size: { w: [9.6, 12], d: [9.6, 11.5] },
  storeys: 1,
  storeyHeight: ARCH.storey.house,
  plinth: 0.45,
  roof: 'gable',
  roofRise: 2.2,
  lootable: true,
  generate(rng, params) {
    const k = createKit(HOUSE_HIRAYA, params, rng);
    const { w, d } = k;
    const t = 0.15;
    k.thick = t;
    const D = Math.min(8.4, Math.max(7.3, d - 2.2)); // the house's depth; the garden is in front
    const zc0 = t + 2.6; // back rooms | corridor
    const zc1 = zc0 + 1.3; // corridor | front rooms
    const xg = t + 1.9; // genkan | living
    const xl = t + (w - 2 * t) * 0.56; // living | tatami
    const xk = t + (w - 2 * t) * 0.4; // kitchen | bath
    const xb = xk + 2.0; // bath | toilet
    const xw = xb + 1.25; // toilet | last room
    const wallMat = k.pick(['siding', 'mortar', 'plaster'] as const);
    const wallTint = k.rand();
    const doorX = (t + xg) / 2;
    const backOpen = k.rand() < 0.4;
    const boarded = k.rand() < 0.5;

    k.floor(0, 'flooring', [t, t, w - t, D - t]);
    const livingWin = k.window((xg + xl) / 2, 1.8, { sill: 0.3, broken: !boarded && k.rand() < 0.4 });
    ring(k, 0, [0, 0, w, D], {
      mat: wallMat, tint: wallTint,
      front: [k.door(doorX), livingWin, k.window((xl + w - t) / 2, 1.6, { sill: 0.4 })],
      back: [k.door(t + 0.8, backOpen ? 'open' : 'locked'), k.window((t + xk) / 2 + 0.6, 1.0, { sill: 1.0 }), k.window((xk + xb) / 2, 0.6, { sill: 1.3, broken: k.rand() < 0.3 }), k.window((xw + w - t) / 2, 0.9)],
      left: [k.window((zc1 + D) / 2, 0.6, { sill: 1.2 })],
      right: [k.window((zc1 + D) / 2, 1.2), k.window(zc0 / 2 + t, 0.6, { sill: 1.2 })],
    });
    if (boarded) boards(k, 0, (xg + xl) / 2 - 1.0, D - t - 0.06, (xg + xl) / 2 + 1.0, D - t - 0.02, 0.3, 2.0);
    // Step stone at the door (no collision outside the walls).
    k.part({ shape: 'box', x0: doorX - 0.5, x1: doorX + 0.5, z0: D, z1: D + 0.5, y0: -0.5, y1: 0.2, mat: 'concrete', layer: 'shell', level: 0, solid: false });

    // Partitions.
    k.partition(0, t, zc0, w - t, zc0, [k.door((t + xk) / 2 + 0.5 - t), k.door((xk + xb) / 2 - t), k.door((xb + xw) / 2 - t, 'open', 0.8), k.door((xw + w - t) / 2 - t)]);
    k.partition(0, xg, zc1, w - t, zc1, [k.door((xg + xl) / 2 - xg), k.door((xl + w - t) / 2 - xg)]);
    k.partition(0, xg, zc1, xg, D - t);
    k.partition(0, xl, zc1, xl, D - t);
    for (const x of [xk, xb, xw]) k.partition(0, x, t, x, zc0);

    // Rooms.
    const corridor = k.room(0, t, zc0 + P, w - t, zc1 - P, 'hall');
    const genkan = k.room(0, t, zc1 - P, xg - P, D - t, 'genkan');
    k.join(genkan, corridor);
    k.room(0, xg + P, zc1 + P, xl - P, D - t, 'living');
    k.room(0, xl + P, zc1 + P, w - t, D - t, 'tatami');
    k.room(0, t, t, xk - P, zc0 - P, 'kitchen');
    k.room(0, xk + P, t, xb - P, zc0 - P, 'bath');
    k.room(0, xb + P, t, xw - P, zc0 - P, 'toilet');
    const lastUse = w - t - xw > 2.8 ? 'bedroom' : 'closet';
    k.room(0, xw + P, t, w - t, zc0 - P, lastUse);

    // Furniture (along the walls, clear of the doors).
    k.furniture(0, t, D - t - 0.4, t + 0.35, D - t - 1.6, 1.0, 'wood', { tint: 0.2 }); // shoe cabinet
    k.furniture(0, t + 1.6, t, xk - 0.8, t + 0.6, 0.88, 'counter', { search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } });
    k.furniture(0, xk - 0.75, t, xk - P - 0.02, t + 0.7, 1.8, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'kitchen' } });
    k.furniture(0, xk + P + 0.05, t, xk + 1.15, t + 0.75, 0.6, 'tileFloor'); // bath tub
    k.furniture(0, xk + 1.25, t, xb - P - 0.1, t + 0.45, 0.9, 'wood', { search: { kind: 'cabinet', face: 'z+', table: 'bath' } });
    k.furniture(0, (xb + xw) / 2 - 0.2, t, (xb + xw) / 2 + 0.2, t + 0.7, 0.42, 'appliance', { solid: false });
    if (lastUse === 'bedroom') k.furniture(0, w - t - 1.0, t, w - t, t + 2.0, 0.5, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x-', table: 'bedroom' } });
    else k.furniture(0, w - t - 0.5, t, w - t, zc0 - 1.0, 1.8, 'shelf', { search: { kind: 'shelf', face: 'x-', table: 'closet' } });
    k.furniture(0, xg + P, D - t - 1.8, xg + 0.55, D - t - 0.9, 0.55, 'wood', { search: { kind: 'cabinet', face: 'x+' } }); // TV cabinet
    k.furniture(0, (xg + xl) / 2 - 0.5, zc1 + 1.3, (xg + xl) / 2 + 0.5, zc1 + 2.0, 0.38, 'wood', { tint: 0.6 }); // low table
    k.stain(0, xl + P, zc1 + P, w - t, D - t, 'tatami');
    k.furniture(0, w - t - 0.6, D - t - 1.7, w - t, D - t - 0.3, 1.8, 'wood', { tint: 0.7, search: { kind: 'closet', face: 'x-', table: 'closet' } }); // 箪笥
    k.furniture(0, xl + P + 0.1, D - t - 0.5, xl + 1.0, D - t, 1.1, 'woodDark'); // 仏壇
    // The ruin: a cupboard toppled under the living-room window, blood in the genkan.
    k.box(0, xg + 0.9, k.levelY(0), D - t - 0.75, xl - 0.6, k.levelY(0) + 0.32, D - t - 0.35, 'wood', { tint: 0.3, role: 'furniture' });
    if (k.rand() < 0.6) k.stain(0, t + 0.3, zc1 + 0.6, xg - 0.4, zc1 + 1.5);

    pitched(k, [0, 0, w, D], { mat: k.pick(['tile', 'slate', 'metalRoof'] as const), tint: k.rand(), hip: k.rand() < 0.5, axis: 'x' });

    // Garden: block wall along the front with the gate before the door, a hedge, a tree and a 物置.
    const gate0 = doorX - 1.4;
    const gate1 = doorX + 1.6;
    if (gate0 > 0.2) fence(k, 0, d - 0.12, gate0, d, 1.1);
    fence(k, gate1, d - 0.12, w, d, 1.1);
    fence(k, 0, D, 0.12, d - 0.12, 1.1);
    fence(k, w - 0.12, D, w, d - 0.12, 1.1);
    hedge(k, gate1 + 0.2, d - 0.6, Math.min(w - 2.6, gate1 + 3.5), d - 0.15, 1.2);
    tree(k, (xg + xl) / 2 + 0.4, D + (d - D) / 2, 1.4);
    shed(k, [w - 2.2, D + 0.25, w - 0.3, Math.min(d - 0.3, D + 1.75)], 'left', { locked: k.rand() < 0.3 });
    return k.finish();
  },
};
