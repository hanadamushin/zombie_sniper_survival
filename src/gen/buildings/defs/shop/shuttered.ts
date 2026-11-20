// シャッターの下りた店 (07d-2b): seven small shops closed up for good — 八百屋・本屋・薬局・電器店・
// 服屋・ドラッグストア・酒屋. One generator, one BuildingDef per kind (like base/hall.ts).
//
//   +---------------------------+
//   | back store (勝手口から)     |   the back door is open: a corner of the store room behind the shop
//   +------------D(locked)------+   (a crate or two). The door into the shop is locked ...
//   |                           |
//   |   shop floor (locked)     |   ... and the front is rolled-down shutters with graffiti and rust.
//   |                           |
//   +==shutter=====shutter======+   front (z = d), signboard over the shutters
//
// The pharmacy (薬局) is the exception: its door from the back store is open and its shop floor
// (shelves, the dispensary) has medicine. Kinds differ in size, storeys, roof, how many shutters,
// signs, awnings and what stands outside.

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Hole, type Kit } from '../../kit.ts';
import type { BuildingDef, MaterialId, RoofKind } from '../../types.ts';
import { awning, grime, P, sign } from './common.ts';

interface Kind {
  variant: string;
  w: [number, number];
  d: [number, number];
  storeys: 1 | 2;
  roof: RoofKind;
  wall: MaterialId;
  /** Shutters across the front (each as wide as the front allows). */
  shutters: number;
  signTint: number;
  /** Extras that make the kind read from the street. */
  extra: 'awning' | 'cross' | 'roofSign' | 'display' | 'sideDoor' | 'crates' | 'pylon';
  open?: boolean;
}

const KINDS: readonly Kind[] = [
  { variant: 'yaoya', w: [6, 8], d: [8, 10], storeys: 2, roof: 'gable', wall: 'mortar', shutters: 1, signTint: 0.15, extra: 'awning' },
  { variant: 'honya', w: [6, 8], d: [10, 13], storeys: 2, roof: 'flat', wall: 'plaster', shutters: 1, signTint: 0.55, extra: 'sideDoor' },
  { variant: 'yakkyoku', w: [7, 9], d: [9, 11], storeys: 1, roof: 'flat', wall: 'plaster', shutters: 1, signTint: 0.35, extra: 'cross', open: true },
  { variant: 'denki', w: [9, 12], d: [10, 13], storeys: 2, roof: 'flat', wall: 'siding', shutters: 2, signTint: 0.8, extra: 'roofSign' },
  { variant: 'fuku', w: [7, 10], d: [9, 12], storeys: 1, roof: 'flat', wall: 'brick', shutters: 1, signTint: 0.65, extra: 'display' },
  { variant: 'drug', w: [16, 20], d: [16, 20], storeys: 1, roof: 'flat', wall: 'siding', shutters: 3, signTint: 0.95, extra: 'pylon' },
  { variant: 'sakaya', w: [7, 9], d: [9, 11], storeys: 1, roof: 'gable', wall: 'woodDark', shutters: 1, signTint: 0.25, extra: 'crates' },
];

function build(def: BuildingDef, kind: Kind, k: Kit): void {
  const { w, d } = k;
  const t = 0.2;
  k.thick = t;
  const y = k.levelY(0);
  const zb = t + 2.2; // back store | shop floor
  const tint = k.rand();
  const head = Math.min(3.0, def.storeyHeight - 0.4);

  // --- ground floor ---
  k.floor(0, kind.open ? 'tileFloor' : 'concrete');
  const span = w - 0.6 - (kind.extra === 'sideDoor' ? 1.4 : 0) - (kind.extra === 'display' ? 2.4 : 0);
  const sw = Math.min(5.0, span / kind.shutters - 0.35);
  const x0 = 0.3 + (kind.extra === 'display' ? 2.4 : 0);
  const centres = k.evenly(x0, x0 + span, kind.shutters);
  const front: Hole[] = centres.map((c) => ({ ...k.door(c, 'shutter', sw), head }));
  if (kind.extra === 'sideDoor') front.push(k.door(w - 0.9, 'locked'));
  if (kind.extra === 'display') front.unshift(k.window(1.4, 1.8, { sill: 0.4, head: 2.6, broken: k.rand() < 0.5 }));
  k.outerWalls(0, {
    mat: kind.wall, tint,
    front,
    back: [k.door(w / 2, 'open'), k.window(w * 0.2, 0.6, { sill: 1.4 })],
    left: [k.window((zb + d) / 2, 0.9, { sill: 1.6, head: 2.4 })],
  });
  for (const c of centres) grime(k, c - sw / 2, c + sw / 2, y, head);

  // Back store, entered through the back door; the shop floor behind a door that is locked (pharmacy: open).
  k.partition(0, t, zb, w - t, zb, [k.door(w / 2 - t, kind.open ? 'open' : 'locked')]);
  k.room(0, t, t, w - t, zb - P, kind.open ? 'backroom' : 'storage');
  k.furniture(0, t, t, t + 1.0, t + 1.0, 0.8, 'wood', { tint: 0.4, search: { kind: 'crate', face: 'x+', table: kind.variant === 'yaoya' || kind.variant === 'sakaya' ? 'grocery' : 'storage' } });
  k.furniture(0, w - t - 0.5, t, w - t, zb - P - 0.1, 1.9, 'shelf', { tint: 0.3 });
  if (k.rand() < 0.6) k.stain(0, w / 2 + 0.4, t + 0.3, w / 2 + 1.3, t + 1.1, 'debris');
  const shop = k.room(0, t, zb + P, w - t, d - t, 'sales', { locked: !kind.open });
  if (kind.open) {
    // 薬局: shelves down the floor, the dispensary counter across the back corner.
    const r = k.roomById(shop);
    const n = Math.max(1, Math.floor((w - 2 * t - 1.4) / 2.2));
    for (let i = 0; i < n; i++) {
      const gx = r.x0 + 1.4 + i * 2.2;
      k.furniture(0, gx, zb + 2.2, gx + 0.8, d - t - 1.6, 1.5, 'shelf', { tint: 0.5, search: i === 0 ? { kind: 'shelf', face: 'x-', table: 'pharmacy' } : undefined });
    }
    k.furniture(0, t, zb + 1.6, t + 0.45, d - t - 1.2, 1.9, 'shelf', { search: { kind: 'shelf', face: 'x+', table: 'pharmacy' } });
    k.furniture(0, w - t - 2.6, zb + P + 1.0, w - t, zb + P + 1.6, 1.0, 'counter', { search: { kind: 'counter', face: 'z+', table: 'pharmacy' } });
    k.furniture(0, w - t - 0.45, zb + P, w - t, zb + P + 0.95, 1.9, 'steel', { tint: 0.9 }); // drug cabinet
    k.stain(0, t + 1.6, d - t - 1.6, t + 2.6, d - t - 0.8);
    k.box(0, r.x0 + 1.6, y, d - t - 1.4, r.x0 + 3.0, y + 0.35, d - t - 1.0, 'shelf', { role: 'furniture', tint: 0.5 }); // a shelf knocked over
  } else {
    // Seen through nothing, but the floor is not bare.
    k.furniture(0, t, zb + 1.0, t + 0.5, d - t - 1.0, 1.8, 'shelf', { tint: 0.5 });
  }

  // --- upper floor: the family's rooms, shut (no way up from the shop) ---
  if (kind.storeys === 2) {
    k.floor(1, 'flooring');
    k.outerWalls(1, {
      mat: kind.wall, tint,
      front: k.evenly(0.4, w - 0.4, w > 7 ? 2 : 1).map((x) => k.window(x, 1.5, { broken: k.rand() < 0.3 })),
      back: [k.window(w / 2, 1.0)],
    });
    k.room(1, t, t, w - t, d - t, 'living', { locked: true });
  }

  // --- roof ---
  const e = k.eaves;
  if (kind.roof === 'gable') k.roofGable({ mat: kind.wall === 'woodDark' ? 'tile' : 'metalRoof', tint: k.rand(), axis: 'x' });
  else k.roofFlat({ mat: 'concrete', parapet: kind.storeys === 1 ? 0.8 : 0.6, parapetMat: kind.wall, tint });

  // --- the street front ---
  const sy = k.levelY(0) + head + 0.1;
  sign(k, 0.2, w - 0.2, sy, Math.min(sy + 0.7, k.levelY(1) - 0.05), kind.signTint);
  switch (kind.extra) {
    case 'awning':
      awning(k, 0.2, w - 0.2, sy - 0.05, 0.6, k.rand());
      break;
    case 'cross':
      // A green cross standing on the roof.
      sign(k, w - 1.5, w - 0.5, e + 0.35, e + 0.75, 0.35, { z: d - 0.7 });
      sign(k, w - 1.2, w - 0.8, e + 0.05, e + 1.05, 0.35, { z: d - 0.72 });
      break;
    case 'roofSign':
      for (const x of [1.0, w - 1.2]) k.box(-1, x, e, d - 1.2, x + 0.2, e + 1.2, d - 1.0, 'steel', { layer: 'shell' });
      k.box(-1, 0.6, e + 1.2, d - 1.2, w - 0.6, e + 2.4, d - 1.05, 'sign', { layer: 'shell', tint: kind.signTint });
      break;
    case 'display':
      k.furniture(0, t + 0.4, d - t - 0.8, t + 0.8, d - t - 0.4, 1.7, 'fabric', { tint: k.rand(), solid: false }); // mannequin
      awning(k, 0.2, 2.6, sy - 0.05, 0.5, k.rand());
      break;
    case 'pylon':
      // The chain's sign tower on the front corner of the roof.
      k.box(-1, w - 1.4, e, d - 1.4, w - 1.1, e + 1.0, d - 1.1, 'steel', { layer: 'shell' });
      k.box(-1, w - 2.6, e + 0.3, d - 1.1, w - 0.3, e + 1.4, d - 0.95, 'sign', { layer: 'shell', tint: kind.signTint, solid: false });
      break;
    case 'crates':
      // Beer crates stacked against the front wall, a vending machine.
      for (let i = 0; i < 3; i++) k.box(-1, w - 1.5, i * 0.3, d, w - 1.0, i * 0.3 + 0.28, d + 0.38, 'shelf', { layer: 'shell', tint: 0.1, solid: false });
      k.box(-1, 0.3, 0, d, 1.2, 1.8, d + 0.55, 'appliance', { layer: 'shell', tint: k.rand(), solid: false });
      break;
    default:
      break;
  }
}

function defOf(kind: Kind): BuildingDef {
  const def: BuildingDef = {
    id: `shop.shut_${kind.variant}`,
    category: 'shop',
    variant: `shut_${kind.variant}`,
    kind: 'shop',
    size: { w: kind.w, d: kind.d },
    storeys: kind.storeys,
    storeyHeight: kind.storeys === 2 ? ARCH.storey.house + 0.35 : ARCH.storey.shop,
    plinth: 0.1,
    roof: kind.roof,
    roofRise: kind.roof === 'gable' ? 1.6 : kind.extra === 'roofSign' ? 2.5 : kind.extra === 'pylon' ? 1.5 : kind.extra === 'cross' ? 1.2 : 0.9,
    lootable: kind.open === true,
    generate(rng, params) {
      const k = createKit(def, params, rng);
      build(def, kind, k);
      return k.finish();
    },
  };
  return def;
}

export const SHOP_SHUTTERED: readonly BuildingDef[] = KINDS.map(defOf);
