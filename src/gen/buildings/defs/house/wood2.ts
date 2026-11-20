// 木造 2 階建ての家 (07d sample). Gable roof over a timber house raised 0.45 m off the ground.
//
//   ground floor                         upper floor
//   +------+-------------+------+        +------+-------------+-+
//   |hall  | kitchen     | bath |        |hall  | tatami      |押|
//   |  ||  |   (back dr) |      |        | ==== |             |入|
//   |  ||  +----   -----+------+        | |  | +-------------+-+
//   |  ||  |                    |        | |  | | bedroom        |
//   |genkan| living             |        |    |                  |
//   +--D---+--------------------+        +------+----------------+
//      front (z = d)
//
// The hall runs along the left wall with a straight stair climbing towards the back; doors off it
// lead to the living room, the kitchen (and from there the bathroom), upstairs to the bedroom and the
// tatami room with its 押し入れ. The kitchen's back door is locked.

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';

const P = ARCH.wall.partition / 2;

export const HOUSE_WOOD2: BuildingDef = {
  id: 'house.wood2',
  category: 'house',
  variant: 'wood2',
  kind: 'house',
  size: { w: [8.6, 10.4], d: [7.2, 8.4] },
  storeys: 2,
  storeyHeight: ARCH.storey.house,
  plinth: 0.45,
  roof: 'gable',
  roofRise: 1.9,
  lootable: true,
  generate(rng, params) {
    const k = createKit(HOUSE_WOOD2, params, rng);
    const { w, d } = k;
    const t = 0.15;
    k.thick = t;
    const hx = t + 2.0; // hall partition (centre line)
    const zs = t + 4.7; // foot of the stair
    const lane = t + 0.47; // stair centre line
    const zk = Math.max(t + 2.6, Math.min(zs - 0.4, d * 0.48)); // kitchen | living
    const xw = w - t - 2.2; // kitchen | bathroom
    const zm = d * 0.5; // tatami | bedroom
    const xc = w - t - 0.96; // tatami | closet
    const doorX = t + 1.45;
    const wallTint = k.rand();
    const wallMat = k.pick(['siding', 'plaster', 'mortar'] as const);
    const broken = (): boolean => k.rand() < 0.25;

    // --- ground floor ---
    k.floor(0, 'flooring');
    const zl = (zs + d - t) / 2;
    k.outerWalls(0, {
      mat: wallMat, tint: wallTint,
      front: [k.door(doorX), ...k.evenly(hx + 0.4, w - t - 0.4, 2).map((x) => k.window(x, 1.6, { sill: 0.3, broken: broken() }))],
      back: [k.door(hx + 1.0, 'locked'), k.window(hx + 3.0, 1.0, { sill: 1.0 }), k.window((xw + w - t) / 2, 0.6, { sill: 1.3 })],
      left: [k.window(zs - 2.0, 0.8, { sill: 1.2 })],
      right: [k.window(zk / 2, 0.6, { sill: 1.3 }), k.window((zk + d) / 2, 1.2, { broken: broken() })],
    });
    k.part({ shape: 'box', x0: doorX - 0.6, x1: doorX + 0.6, z0: d, z1: d + 0.55, y0: -1, y1: 0.22, mat: 'concrete', layer: 'shell', level: 0, solid: false });
    k.partition(0, hx, t, hx, d - t, [k.door(1.2), k.door(zl - t)]);
    k.partition(0, hx, zk, w - t, zk, [{ ...k.door((xw - hx) / 2, 'open', Math.min(1.8, xw - hx - 0.5)) }]);
    k.partition(0, xw, t, xw, zk, [k.door(zk / 2 - t)]);
    const genkan = k.room(0, t, zs, hx - P, d - t, 'genkan');
    const hall = k.room(0, t + 0.92, t, hx - P, zs, 'hall');
    k.join(genkan, hall);
    k.room(0, hx + P, zk + P, w - t, d - t, 'living');
    k.room(0, hx + P, t, xw - P, zk - P, 'kitchen');
    k.room(0, xw + P, t, w - t, zk - P, 'bath');
    k.stairs({ level: 0, start: [lane, zs], dir: 'z-', width: 0.9, rails: ['right', 'end'], mat: 'woodDark' });

    // Furniture: against the walls, clear of the doors.
    k.furniture(0, t, d - t - 0.4, t + 0.9, d - t, 1.0, 'wood', { tint: 0.2 }); // shoe cabinet
    k.furniture(0, w - t - 0.5, zk + 0.7, w - t, zk + 2.2, 0.55, 'wood', { search: { kind: 'cabinet', face: 'x-' } }); // TV cabinet
    k.furniture(0, w - t - 2.6, zk + 0.9, w - t - 1.8, zk + 2.3, 0.42, 'fabric', { tint: k.rand() }); // sofa
    k.furniture(0, hx + 1.6, t, xw - 0.9, t + 0.62, 0.88, 'counter', { search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } });
    k.furniture(0, xw - 0.8, t, xw - P - 0.05, t + 0.7, 1.8, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'kitchen' } });
    k.furniture(0, w - t - 0.65, t, w - t, t + 0.65, 0.9, 'appliance'); // washing machine
    k.furniture(0, xw + P, t, xw + 1.0, t + 0.45, 1.6, 'wood', { search: { kind: 'cabinet', face: 'z+', table: 'bath' } });
    if (k.rand() < 0.7) k.stain(0, t + 0.5, zs + 0.8, t + 1.6, zs + 1.6);
    // A bookcase toppled over in the living room.
    k.box(0, hx + 2.2, k.levelY(0), d - t - 1.0, hx + 4.0, k.levelY(0) + 0.35, d - t - 0.6, 'wood', { tint: 0.3, role: 'furniture' });

    // --- upper floor ---
    k.floor(1, 'flooring');
    const zb = (Math.max(zm, zs - 3.75) + d - t) / 2;
    k.outerWalls(1, {
      mat: wallMat, tint: wallTint,
      front: [k.window(doorX, 0.6, { sill: 1.2 }), ...k.evenly(hx + 0.4, w - t - 0.4, 2).map((x) => k.window(x, 1.4, { broken: broken() }))],
      back: [k.window((hx + xc) / 2, 1.6)],
      left: [k.window(t + 0.5, 0.6, { sill: 1.2 })],
      right: [k.window((zm + d) / 2, 1.2)],
    });
    k.partition(1, hx, t, hx, d - t, [k.door(0.55), k.door(zb - t)]);
    k.partition(1, hx, zm, w - t, zm);
    // 押し入れ: the sliding doors stand open, but its middle shelf keeps people out (an opening, not a door).
    k.partition(1, xc, t, xc, zm - P, [{ ...k.window((zm - t) / 2, Math.min(1.6, zm - t - 0.4), { sill: 0, head: 1.8, broken: true }) }]);
    const hall2a = k.room(1, t, t, hx - P, zs - 3.75, 'hall');
    const hall2b = k.room(1, t + 0.98, zs - 3.75, hx - P, d - t, 'hall');
    k.join(hall2a, hall2b);
    k.room(1, hx + P, zm + P, w - t, d - t, 'bedroom');
    k.room(1, hx + P, t, xc - P, zm - P, 'tatami');
    k.room(1, xc + P, t, w - t, zm - P, 'closet', { locked: true });
    k.stain(1, hx + P, t, xc - P, zm - P, 'tatami');
    // 押し入れ: the shelf inside, searched from the tatami room.
    k.box(1, xc + P, k.levelY(1) + 0.75, t, w - t, k.levelY(1) + 0.82, zm - P, 'wood', { role: 'furniture' });
    k.search(1, xc - P - 0.5, (t + zm) / 2, 'closet', 'closet');
    k.furniture(1, w - t - 1.0, d - t - 2.1, w - t, d - t, 0.5, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x-', table: 'bedroom' } });
    k.furniture(1, hx + P + 0.05, zm + P, hx + 1.4, zm + 0.7, 1.8, 'wood', { tint: 0.5, search: { kind: 'closet', face: 'z+' } }); // wardrobe
    k.furniture(1, hx + 1.6, zm - 1.0, hx + 2.5, zm - 0.4, 0.35, 'wood', { tint: 0.7 }); // low table

    // --- roof ---
    k.roofGable({ mat: k.pick(['tile', 'slate', 'metalRoof'] as const), tint: k.rand() });
    return k.finish();
  },
};
