// 別荘風 (07d-2a). A timber holiday cabin under a steep gable facing the front: a double-height
// living room with a brick fireplace, a sleeping loft over the back rooms reached by an open stair,
// and a raised wooden deck along the front with a railing and steps.
//
//   ground floor                                  loft
//   +--+--------+--------+------+                 +--+---------------------+
//   |  | kitchen| bedroom| bath |                 |↑ |  loft (beds)        |
//   |st+===D====+---D----+--D---+                 +--+=====railing========+
//   |ai|   living (double height)    [fire]|        (open to the living below)
//   |rs|                                   |
//   +--+---------glass==D==glass------------+
//   |  deck                                 |
//   +-----------------gate------------------+      front (z = d)

import { ARCH } from '../../../../data/architecture.ts';
import { createKit } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { P, pitched, tree } from './common.ts';

export const HOUSE_BESSOU: BuildingDef = {
  id: 'house.bessou',
  category: 'house',
  variant: 'bessou',
  kind: 'house',
  size: { w: [11, 13.5], d: [11, 13] },
  storeys: 2,
  storeyHeight: ARCH.storey.house,
  plinth: 0.45,
  roof: 'gable',
  roofRise: 3.4,
  lootable: true,
  generate(rng, params) {
    const k = createKit(HOUSE_BESSOU, params, rng);
    const { w, d } = k;
    const t = 0.18;
    k.thick = t;
    const D = d - 2.6; // the deck in front
    const lane = t + 0.47;
    const px = t + 1.04; // stair lane | back rooms (centre line)
    const zl = t + 3.6; // back rooms (loft above) | living
    const zs = zl + 2.0; // foot of the stair
    const xk = px + (w - t - px) * 0.38; // kitchen | bedroom
    const xb = w - t - 2.0; // bedroom | bath
    const fy = k.levelY(0);
    const tint = k.rand();
    const logs = { mat: 'wood' as const, tint, exterior: true, layer: 'shell' as const };
    const cx = w / 2;

    // --- walls: back and sides outside, the front onto the deck (a room) ---
    const top0 = k.levelY(1);
    k.wall(0, 0, 0, w, t, [k.window((px + xk) / 2, 1.2, { sill: 1.0 }), k.window((xk + xb) / 2, 1.2), k.window((xb + w - t) / 2, 0.6, { sill: 1.4 })], { ...logs, y1: top0 });
    k.wall(0, 0, t, t, D - t, [k.window((zs + D) / 2 - t, 1.4)], { ...logs, y1: top0 });
    k.wall(0, w - t, t, w, D - t, [k.window(zl / 2 - t, 0.9), k.window((zl + zs) / 2 - t, 1.2)], { ...logs, y1: top0 });
    const sweep = { sill: 0.1, head: 2.1 };
    k.wall(0, 0, D - t, w, D, [k.window(cx - 2.4, 2.4, { ...sweep, broken: k.rand() < 0.4 }), k.door(cx, 'open', 1.6), k.window(cx + 2.4, 2.4, sweep)], { ...logs, exterior: false, y1: top0 });
    k.floor(0, 'flooring', [t, t, w - t, D - t]);

    // Back rooms under the loft, the living room in two parts (the stair runs along the left wall).
    k.partition(0, px, t, px, zl);
    k.partition(0, px, zl, w - t, zl, [k.door((px + xk) / 2 - px, 'open', 1.6), k.door((xk + xb) / 2 - px), k.door(xb + 0.7 - px, 'open', 0.8)]);
    k.partition(0, xk, t, xk, zl);
    k.partition(0, xb, t, xb, zl);
    k.room(0, px + P, t, xk - P, zl - P, 'kitchen');
    k.room(0, xk + P, t, xb - P, zl - P, 'bedroom');
    k.room(0, xb + P, t, w - t, zl - P, 'bath');
    const livingB = k.room(0, t + 0.98, zl + P, w - t, zs, 'living');
    const livingA = k.room(0, t, zs, w - t, D - t, 'living');
    k.join(livingB, livingA);
    k.stairs({ level: 0, start: [lane, zs], dir: 'z-', width: 0.9, rails: ['right'], mat: 'woodDark' });

    k.furniture(0, px + P, t, xk - P - 0.8, t + 0.62, 0.9, 'counter', { tint: 0.4, search: { kind: 'cabinet', face: 'z+', table: 'kitchen' } });
    k.furniture(0, xk - P - 0.7, t, xk - P, t + 0.7, 1.8, 'appliance', { search: { kind: 'fridge', face: 'z+', table: 'kitchen' } });
    k.furniture(0, xb - P - 1.0, t, xb - P, t + 2.0, 0.5, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x-', table: 'bedroom' } });
    k.furniture(0, xk + P, t, xk + 0.6, t + 1.2, 1.8, 'wood', { tint: 0.3, search: { kind: 'closet', face: 'x+', table: 'bedroom' } });
    k.furniture(0, w - t - 0.75, t, w - t, t + 1.5, 0.6, 'tileFloor');
    k.search(0, xb + 0.6, t + 0.8, 'cabinet', 'bath');
    // Fireplace and chimney on the right wall, a sofa facing it, a rug. A gun cabinet in the bedroom (a hunting lodge).
    k.box(-1, w - 0.8, -0.5, zs + 0.3, w, k.eaves + 2.0, zs + 1.3, 'brick', { layer: 'shell', role: 'furniture' });
    k.furniture(0, w - 2.6, zs + 0.2, w - 1.8, zs + 1.9, 0.45, 'fabric', { tint: k.rand() });
    k.stain(0, cx - 0.6, zs + 0.4, w - 2.8, zs + 1.6, 'carpet');
    k.search(0, w - 1.3, zs + 0.8, 'crate', 'living'); // the log basket by the fire
    k.furniture(0, xk + 1.7, t, xk + 2.3, t + 0.5, 1.9, 'woodDark', { search: { kind: 'locker', face: 'z+', table: 'weapons' } });
    k.furniture(0, w - t - 0.5, zl + 0.4, w - t, zl + 1.4, 1.0, 'wood', { tint: 0.6, search: { kind: 'shelf', face: 'x-', table: 'living' } });
    if (k.rand() < 0.7) k.stain(0, cx - 1.0, zl + 0.4, cx + 0.4, zl + 1.4);

    // --- loft ---
    k.floor(1, 'flooring', [t, t, w - t, zl]);
    k.outerWalls(1, {
      mat: 'wood', tint,
      front: [k.window(cx - 1.6, 1.4, { sill: 0.3 }), k.window(cx + 1.6, 1.4, { sill: 0.3 })],
      back: [k.window(cx, 1.2)],
      left: [k.window((zs + D) / 2, 0.9)],
      right: [k.window(zl / 2, 0.9)],
    });
    const strip = k.room(1, t, t, t + 0.98, zs - 3.75, 'hall');
    const loft = k.room(1, t + 1.04, t, w - t, zl - ARCH.rail.thick, 'bedroom');
    k.join(strip, loft);
    k.box(1, t + 0.98, k.levelY(1), zl - ARCH.rail.thick, w - t, k.levelY(1) + ARCH.rail.height, zl, 'wood', { tint: 0.3, role: 'furniture' }); // railing
    k.furniture(1, w - t - 2.1, t, w - t, t + 1.0, 0.4, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'z+', table: 'bedroom' } });
    k.furniture(1, cx - 1.2, t, cx - 0.2, t + 2.0, 0.4, 'fabric', { tint: k.rand(), search: { kind: 'bed', face: 'x+', table: 'bedroom' } });
    k.furniture(1, t + 1.1, t, t + 1.9, t + 0.5, 1.0, 'wood', { tint: 0.7, search: { kind: 'cabinet', face: 'z+', table: 'closet' } });

    pitched(k, [0, 0, w, D], { mat: k.pick(['metalRoof', 'slate'] as const), tint: k.rand(), axis: 'z' });

    // --- the deck: a room of its own, railing round it, steps through a gap at the front ---
    const dz0 = D;
    const dz1 = D + 2.3;
    const rail = { mat: 'wood' as const, tint: 0.3, exterior: true, layer: 'shell' as const, y1: fy + 1.0 };
    k.floor(0, 'wood', [0.1, dz0, w - 0.1, dz1 - 0.1], { tint: 0.4 });
    k.wall(0, 0, dz1 - 0.1, w, dz1, [k.door(cx, 'open', 1.4)], rail);
    k.wall(0, 0, dz0, 0.1, dz1 - 0.1, [], rail);
    k.wall(0, w - 0.1, dz0, w, dz1 - 0.1, [], rail);
    k.room(0, 0.1, dz0, w - 0.1, dz1 - 0.1, 'hall');
    k.furniture(0, w - 2.0, dz0 + 0.4, w - 0.6, dz0 + 1.2, 0.45, 'wood', { tint: 0.5 }); // bench
    k.box(-1, cx - 0.7, -0.5, dz1, cx + 0.7, 0.22, dz1 + 0.35, 'wood', { layer: 'shell', tint: 0.4, solid: false }); // step
    tree(k, 0.8, dz1 + 0.15, 1.2);
    return k.finish();
  },
};
