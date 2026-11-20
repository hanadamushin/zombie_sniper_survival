// シャッターの下りた店 (07d-2b): seven small shops from one generator. Their shutters are down and
// rusted, sprayed over; nobody gets in. What can be reached is the recess in front of the shutter
// (under the sign, out of the rain) — some have a vending machine there. The pharmacy is the
// exception: its back door was left open, and its shelves still hold medicine.
//
//   +-------------------+
//   |  back room         |     pharmacy: back door open, a door into the shop
//   +---------(D)--------+
//   |  shop (locked)     |     2-storey kinds: the family lived upstairs (locked)
//   +==[ shutter ]=======+     zs: the shutter wall, set back from the front
//   |  recess  [vending] |     the recess is a room open to the street
//   +-[       open      ]-+    front (z = d)

import { ARCH } from '../../../../data/architecture.ts';
import { boards } from '../house/common.ts';
import { createKit, type Kit } from '../../kit.ts';
import type { BuildingDef, LootTableId, RoofKind, RoomUse } from '../../types.ts';
import { awning, graffiti, P, rust, sign, tall, toppled, vending } from './common.ts';

interface ShutterKind {
  variant: string;
  size: BuildingDef['size'];
  storeys: number;
  roof: RoofKind;
  roofRise: number;
  /** Colour of the sign / awning (sign palette: 0 green, 0.3 blue, 0.55 red, 0.8 yellow), or seeded. */
  tint?: number;
  /** Shutters across the front: their share of the inside width. */
  shutters: number[];
  /** A glazed show window beside the shutter (clothes). */
  showWindow?: boolean;
  awning?: boolean;
  vendings: number;
  /** What is on the shelves inside. */
  goods: LootTableId;
  backUse: RoomUse;
  /** The back door is open and the shop can be searched (the pharmacy). */
  enterable?: boolean;
  wallMat: 'mortar' | 'siding' | 'plaster' | 'concrete';
  /** Drawn-only things in the recess and on the roof. */
  props(k: Kit, f: Frame): void;
}

interface Frame {
  t: number;
  zs: number;
  y: number;
  tint: number;
}

function generate(def: BuildingDef, spec: ShutterKind, rng: Parameters<BuildingDef['generate']>[0], params: Parameters<BuildingDef['generate']>[1]) {
  const k = createKit(def, params, rng);
  const { w, d } = k;
  const t = ARCH.wall.exterior;
  k.thick = t;
  const y = k.levelY(0);
  const tint = spec.tint ?? k.rand();
  const wallTint = k.rand();
  const zs = d - t - 1.9; // shutter line (its outer face)
  const zw = zs - 0.2; // its inner face
  const zb = Math.min(zw - 3.0, t + k.range(2.6, 3.4)); // back room | shop
  const f: Frame = { t, zs, y, tint };
  const top = spec.storeys - 1;

  // Ground storey: the front is open to the recess; the side and back walls are blind but for a vent.
  k.floor(0, spec.enterable ? 'tileFloor' : 'concrete');
  const backDoor = k.door(w - t - 1.0, spec.enterable ? 'open' : 'locked');
  backDoor.leaf = 'doorSteel';
  k.outerWalls(0, {
    mat: spec.wallMat, tint: wallTint, parapet: spec.roof === 'flat' && top === 0 ? 0.9 : 0,
    front: [tall(k.door(w / 2, 'open', w - 1.0), 2.8)],
    back: [k.window(t + 1.2, 0.6, { sill: 1.6, head: 2.2 }), backDoor],
  });
  // The shutter wall: shutters (and a show window).
  const inner = w - 2 * t;
  const holes = [];
  let at = 0;
  const shares = spec.showWindow ? [...spec.shutters, 0.35] : spec.shutters;
  const total = shares.reduce((a, b) => a + b, 0);
  for (let i = 0; i < shares.length; i++) {
    const span = (inner * shares[i]!) / total;
    const width = span - 0.4;
    if (spec.showWindow && i === shares.length - 1) holes.push(k.window(at + span / 2, width, { sill: 0.5, head: 2.6 }));
    else holes.push(tall(k.door(at + span / 2, 'shutter', width), 2.7));
    at += span;
  }
  k.wall(0, t, zw, w - t, zs, holes, { mat: spec.wallMat, tint: wallTint, exterior: true, layer: 'shell' });
  // Shutter boxes (the rolled-up drum housing), paint and rust.
  k.box(-1, t, y + 2.7, zs, w - t, y + 3.05, zs + 0.3, 'shutter', { layer: 'shell', tint: 0.5, solid: false });
  graffiti(k, t + 0.3, w - t - 0.3 - (spec.showWindow ? inner * 0.3 : 0), zs - 0.04, y + 0.3, y + 2.3);
  rust(k, t + 0.2, w - t - 0.2, zs - 0.03, y + 0.2, y + 2.65);
  // The recess.
  k.room(0, t, zs, w - t, d - t, 'hall');
  for (let i = 0; i < spec.vendings; i++) {
    const x0 = i === 0 ? t : w - t - 1.0;
    vending(k, 0, x0, zs, x0 + 1.0, zs + 0.75, 'z+', { search: true, tint: (tint + i * 0.37) % 1 });
  }
  k.stain(0, w / 2 - 1.0, zs + 0.3, w / 2 + 0.4, zs + 1.1, 'debris');
  // Sign over the recess, awning.
  sign(k, 0.2, y + 2.85, d, w - 0.2, k.levelY(1) - 0.1, d + 0.12, tint);
  if (spec.awning) awning(k, 0.3, w - 0.3, d, 0.55, y + 2.6, tint);

  // Inside the shop and the back room.
  const shopUse: RoomUse = 'sales';
  k.partition(0, t, zb, w - t, zb, [k.door(inner - 1.6, spec.enterable ? 'open' : 'locked')]);
  k.room(0, t, t, w - t, zb - P, spec.backUse, { locked: !spec.enterable });
  k.room(0, t, zb + P, w - t, zw, shopUse, { locked: !spec.enterable });
  // Back room: shelving on the left wall, boxes.
  k.furniture(0, t, t + 0.3, t + 0.5, zb - 0.4, 1.9, 'shelf', { search: { kind: 'shelf', face: 'x+', table: spec.goods } });
  k.furniture(0, t + 1.0, t, t + 2.0, t + 0.8, 0.9, 'wood', { tint: 0.4, search: { kind: 'crate', face: 'z+', table: spec.backUse === 'storage' ? 'storage' : spec.backUse } });
  // Shop: shelves along both walls, a counter at the back; the middle stays clear (from the inner door to the shutter).
  const sx0 = zb + 0.9;
  const sx1 = zw - 0.6;
  k.furniture(0, t, sx0, t + 0.5, sx1, 1.8, 'shelf', { tint, search: { kind: 'shelf', face: 'x+', table: spec.goods } });
  k.furniture(0, w - t - 0.5, sx0, w - t, sx1, 1.8, 'shelf', { tint, search: { kind: 'shelf', face: 'x-', table: spec.goods } });
  k.furniture(0, t + 0.9, zb + 0.4, Math.max(t + 1.5, w - t - 2.4), zb + 0.95, 1.0, 'counter', { search: { kind: 'counter', face: 'z+', table: spec.enterable ? 'pharmacy' : 'sales' } });
  if (spec.enterable) {
    // The dispensary: a locked medicine cabinet was forced open; blood by the back door.
    k.furniture(0, w - t - 0.45, t + 0.4, w - t, zb - 1.6, 1.9, 'steel', { tint: 0.9, search: { kind: 'cabinet', face: 'x-', table: 'pharmacy' } });
    k.stain(0, w - t - 1.7, t + 0.4, w - t - 0.4, t + 1.4);
    toppled(k, 0, w / 2 - 1.2, (sx0 + sx1) / 2 - 0.3, w / 2 - 0.4, (sx0 + sx1) / 2 + 0.8);
  }

  // Upper storey: the family's rooms, locked; boarded windows.
  for (let level = 1; level < spec.storeys; level++) {
    const wins = k.evenly(t + 0.3, w - t - 0.3, Math.max(1, Math.round(inner / 2.6)));
    k.outerWalls(level, {
      mat: spec.wallMat, tint: wallTint, parapet: spec.roof === 'flat' && level === top ? 0.9 : 0,
      front: wins.map((x) => k.window(x, 1.3, { broken: k.rand() < 0.3 })),
      back: [k.window(w / 2, 1.2)],
    });
    k.floor(level, 'tatami');
    k.room(level, t, t, w - t, d - t, 'living', { locked: true });
    if (k.rand() < 0.6) boards(k, level, wins[0]! - 0.7, d - t - 0.06, wins[0]! + 0.7, d - t - 0.01, 0.9, 2.0);
  }
  if (spec.roof === 'flat') k.roofFlat({ mat: 'concrete', parapet: 0.9, parapetMat: spec.wallMat, tint: wallTint });
  else {
    k.roofGable({ mat: 'metalRoof', axis: 'z', tint: k.rand(), overhang: 0.15 });
    // 看板建築: a flat false front hides the gable from the street.
    k.box(-1, 0, k.eaves, d - t, w, k.eaves + spec.roofRise - 0.2, d, spec.wallMat, { layer: 'shell', tint: wallTint });
  }
  spec.props(k, f);
  return k.finish();
}

function shop(spec: ShutterKind): BuildingDef {
  const def: BuildingDef = {
    id: `shop.${spec.variant}`,
    category: 'shop',
    variant: spec.variant,
    kind: 'shop',
    size: spec.size,
    storeys: spec.storeys,
    storeyHeight: ARCH.storey.shop,
    plinth: 0.12,
    roof: spec.roof,
    roofRise: spec.roofRise,
    lootable: spec.enterable === true,
    generate: (rng, params) => generate(def, spec, rng, params),
  };
  return def;
}

/** Drawn-only box (in the recess or on the roof). */
const deco = (k: Kit, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: Parameters<Kit['box']>[7], tint?: number): void => {
  k.box(-1, x0, y0, z0, x1, y1, z1, mat, { layer: 'shell', tint, solid: false });
};

/** 八百屋: a wide shutter under a green awning, the stepped stands left out with rotten vegetables. */
export const SHOP_SHUT_YAOYA = shop({
  variant: 'shut_yaoya', size: { w: [6, 8], d: [8.5, 10] }, storeys: 2, roof: 'gable', roofRise: 2.2, tint: 0.05,
  shutters: [1], awning: true, vendings: 0, goods: 'grocery', backUse: 'storage', wallMat: 'mortar',
  props(k, f) {
    for (const [x0, x1] of [[f.t + 0.4, k.w / 2 - 0.9], [k.w / 2 + 0.9, k.w - f.t - 0.4]] as const) {
      for (let i = 0; i < 3; i++) {
        const z0 = f.zs + 0.1 + i * 0.35;
        deco(k, x0, f.y, z0, x1, f.y + 0.9 - i * 0.25, z0 + 0.35, 'wood', 0.3);
        deco(k, x0 + 0.1, f.y + 0.9 - i * 0.25, z0 + 0.05, x1 - 0.1, f.y + 1.0 - i * 0.25, z0 + 0.3, k.rand() < 0.5 ? 'plant' : 'debris');
      }
    }
  },
});

/** 本屋: narrow and deep, a big sign board, the magazine rack still out in front. */
export const SHOP_SHUT_HONYA = shop({
  variant: 'shut_honya', size: { w: [5.5, 7], d: [10, 13] }, storeys: 2, roof: 'flat', roofRise: 1.0, tint: 0.3,
  shutters: [1], vendings: 0, goods: 'office', backUse: 'storage', wallMat: 'siding',
  props(k, f) {
    deco(k, f.t + 0.2, f.y, f.zs + 0.1, f.t + 1.3, f.y + 1.3, f.zs + 0.5, 'shelf');
    deco(k, f.t + 0.3, f.y + 0.2, f.zs + 0.5, f.t + 1.2, f.y + 1.1, f.zs + 0.55, 'paper');
    k.stain(0, k.w / 2, f.zs + 0.6, k.w / 2 + 1.2, f.zs + 1.4, 'paper');
    // A tall sign board standing on the parapet.
    sign(k, 0.3, k.eaves + 0.1, k.d - 0.4, k.w - 0.3, k.eaves + 0.95, k.d - 0.3, f.tint);
  },
});

/** 薬局: the green cross over the shutter; the back door is open and the medicine is still inside. */
export const SHOP_SHUT_YAKKYOKU = shop({
  variant: 'shut_yakkyoku', size: { w: [6, 8], d: [9, 12] }, storeys: 2, roof: 'flat', roofRise: 1.0, tint: 0.02,
  shutters: [1], vendings: 1, goods: 'pharmacy', backUse: 'storage', enterable: true, wallMat: 'plaster',
  props(k, f) {
    const cx = k.w - 0.9;
    const cy = f.y + 3.2;
    deco(k, cx - 0.45, cy - 0.15, k.d, cx + 0.45, cy + 0.15, k.d + 0.15, 'sign', 0.02);
    deco(k, cx - 0.15, cy - 0.45, k.d, cx + 0.15, cy + 0.45, k.d + 0.15, 'sign', 0.02);
  },
});

/** 電器店: washing machines and fridges left out, the antenna mast on the roof, a maker's sign. */
export const SHOP_SHUT_DENKI = shop({
  variant: 'shut_denki', size: { w: [7, 9], d: [10, 12] }, storeys: 2, roof: 'flat', roofRise: 3.0, tint: 0.3,
  shutters: [1], vendings: 0, goods: 'workshop', backUse: 'workshop', wallMat: 'concrete',
  props(k, f) {
    for (let i = 0; i < 3; i++) deco(k, f.t + 0.3 + i * 0.75, f.y, f.zs + 0.15, f.t + 0.95 + i * 0.75, f.y + (i === 1 ? 1.7 : 0.95), f.zs + 0.8, 'appliance', 0.1 * i);
    // Antenna mast and the outdoor units on the roof.
    deco(k, k.w - 1.5, k.eaves, 1.5, k.w - 1.4, k.eaves + 2.9, 1.6, 'steel');
    for (const yy of [1.8, 2.4]) deco(k, k.w - 2.4, k.eaves + yy, 1.52, k.w - 0.6, k.eaves + yy + 0.05, 1.58, 'steel');
    k.box(-1, 1.0, k.eaves, 1.0, 2.0, k.eaves + 0.7, 1.6, 'appliance', { layer: 'shell', tint: 0.5 });
  },
});

/** 服屋: a show window beside the shutter, mannequins still behind the glass. */
export const SHOP_SHUT_FUKU = shop({
  variant: 'shut_fuku', size: { w: [6.5, 8.5], d: [9, 11] }, storeys: 1, roof: 'gable', roofRise: 2.0, tint: 0.55,
  shutters: [1], showWindow: true, awning: true, vendings: 0, goods: 'closet', backUse: 'storage', wallMat: 'plaster',
  props(k, f) {
    // Mannequins in the show window (inside the locked shop, behind the glass).
    const x1 = k.w - f.t - 0.3;
    for (let i = 0; i < 2; i++) {
      const x = x1 - 0.5 - i * 0.8;
      k.box(0, x - 0.2, f.y, f.zs - 0.75, x + 0.2, f.y + 1.75, f.zs - 0.45, 'fabric', { tint: k.rand(), role: 'furniture' });
    }
  },
});

/** ドラッグストア: a wide low box with two shutters, the big yellow sign, carts left in the recess. */
export const SHOP_SHUT_DRUG = shop({
  variant: 'shut_drug', size: { w: [14, 20], d: [14, 18] }, storeys: 1, roof: 'flat', roofRise: 1.6, tint: 0.85,
  shutters: [1, 1], vendings: 2, goods: 'pharmacy', backUse: 'storage', wallMat: 'siding',
  props(k, f) {
    for (let i = 0; i < 3; i++) deco(k, k.w / 2 - 2.6 + i * 0.25, f.y + 0.1, f.zs + 0.3, k.w / 2 - 2.0 + i * 0.25, f.y + 0.95, f.zs + 1.2, 'steel', 0.2);
    sign(k, 1.0, k.eaves - 0.1, k.d, k.w - 1.0, k.eaves + 1.5, k.d + 0.15, 0.85);
  },
});

/** 酒屋: two vending machines in the recess, beer crates stacked, a cedar ball (sakabayashi) under the eaves. */
export const SHOP_SHUT_SAKAYA = shop({
  variant: 'shut_sakaya', size: { w: [7, 9], d: [9, 11] }, storeys: 2, roof: 'gable', roofRise: 2.4, tint: 0.55,
  shutters: [1], vendings: 2, goods: 'bar', backUse: 'bar', wallMat: 'mortar',
  props(k, f) {
    for (let i = 0; i < 3; i++) deco(k, 1.4 + i * 0.05, f.y + i * 0.33, f.zs + 0.9, 1.9 + i * 0.05, f.y + 0.32 + i * 0.33, f.zs + 1.3, 'sign', 0.55);
    deco(k, k.w / 2 - 0.35, f.y + 2.95, k.d + 0.05, k.w / 2 + 0.35, f.y + 3.5, k.d + 0.55, 'plant');
  },
});
