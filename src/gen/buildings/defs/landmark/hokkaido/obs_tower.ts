// R1: an observation tower (展望塔) — what the Hokkaido landmarks share (さっぽろテレビ塔, 五稜郭タワー).
//
//   A shaft in the middle of the lot holds a switchback stair from the ground hall up to the
//   observation deck on the top storey; the storeys between are only the stair halls (their doors
//   locked: nothing to enter but the stair). The deck fills the whole lot, glass all round; above it
//   the open roof with a parapet and a rail is a firing position (gen/real/layout.ts adds the vantage).
//   Each tower dresses the shaft its own way (steel lattice legs, a concrete column...) through `dress`.
//
//   lot (w × d)     +----------------------------+  <- the deck (top storey), glass on the lot's edge
//                   |       +--shaft--+          |
//                   |       | [core]  |          |     core: the stair and its hall (back-left of the shaft)
//                   |       +---------+          |
//                   +-------------door-----------+  z = d (front)

import { ARCH } from '../../../../../data/architecture.ts';
import { subtractRects, type Kit, type Rect } from '../../../kit.ts';
import type { MaterialId } from '../../../types.ts';
import { guardRail, ringRooms, type Fit } from '../../office/common.ts';

const T = ARCH.wall.concrete;
const P = ARCH.wall.partition / 2;

export interface ObsTowerSpec {
  /** Shaft size (centred on the lot). */
  shaft: number;
  /** Shaft walls and the deck's frame. */
  mat: MaterialId;
  tint: number;
  /** Glass of the deck. */
  deckTint?: number;
}

export interface ObsTower {
  shaft: Rect;
  core: Rect;
  /** Top of the roof slab (the eaves) and the top of the stair house on it. */
  roof: number;
  house: number;
}

/** The shaft, the stair, the deck and the roof (docs on top of the file). */
export function obsTower(k: Kit, f: Fit, s: ObsTowerSpec): ObsTower {
  const { w, d } = k;
  const L = k.storeys;
  const deck = L - 1;
  const sx0 = (w - s.shaft) / 2;
  const sz0 = (d - s.shaft) / 2;
  const shaft: Rect = [sx0, sz0, sx0 + s.shaft, sz0 + s.shaft];
  const inner: Rect = [shaft[0] + T, shaft[1] + T, shaft[2] - T, shaft[3] - T];
  const lot: Rect = [T, T, w - T, d - T];
  // The core: the same geometry as the station / control towers (transport/parts.ts tower()).
  const lane = ARCH.stair.wideWidth;
  const n = Math.max(2, Math.ceil(k.def.storeyHeight / 2 / ARCH.stair.maxRise - 1e-6));
  const depth = n * ARCH.stair.going + ARCH.stair.landing;
  const cx0 = inner[0] + 1.6;
  const stx0 = cx0 + P;
  const stx1 = stx0 + 2 * lane + 0.15;
  const cx1 = stx1 + P;
  const cz0 = inner[1];
  const zs = cz0 + depth;
  const cz1 = zs + 2.2 + P;
  const core: Rect = [cx0 - P, cz0 - 2 * P, cx1 + P, cz1 + P];
  const wo = { mat: s.mat, tint: s.tint, layer: 'shell' as const };
  const yDeck = k.levelY(deck);
  const e = k.levelY(L);

  // ---- The shaft: the ground hall's walls (the door in front), one box per side up to the deck.
  const mid = (shaft[0] + shaft[2]) / 2;
  k.wall(0, shaft[0], shaft[3] - T, shaft[2], shaft[3], [k.door(mid - shaft[0], 'open', ARCH.door.wide)], { ...wo, exterior: true });
  k.wall(0, shaft[0], shaft[1], shaft[2], shaft[1] + T, [], { ...wo, exterior: true });
  k.wall(0, shaft[0], shaft[1] + T, shaft[0] + T, shaft[3] - T, [], { ...wo, exterior: true });
  k.wall(0, shaft[2] - T, shaft[1] + T, shaft[2], shaft[3] - T, [], { ...wo, exterior: true });
  const y1 = k.levelY(1);
  k.box(-1, shaft[0], y1, shaft[3] - T, shaft[2], yDeck, shaft[3], s.mat, wo);
  k.box(-1, shaft[0], y1, shaft[1], shaft[2], yDeck, shaft[1] + T, s.mat, wo);
  k.box(-1, shaft[0], y1, shaft[1] + T, shaft[0] + T, yDeck, shaft[3] - T, s.mat, wo);
  k.box(-1, shaft[2] - T, y1, shaft[1] + T, shaft[2], yDeck, shaft[3] - T, s.mat, wo);

  // ---- Storeys: the stair from each to the next (the last onto the roof), its hall on each.
  let stairRect: Rect | null = null;
  for (let l = 0; l < L; l++) {
    if (l === 0) k.floor(0, 'tileFloor', inner);
    else if (l === deck) k.floor(l, 'carpet', lot);
    else k.floor(l, 'concrete', core);
    stairRect = k.stairs({ level: l, start: [stx0 + lane / 2, zs], dir: 'z-', width: lane, kind: 'switchback', turn: 'right', mat: 'concrete', tint: s.tint }).rect;
    const open = l === 0 || l === deck;
    const po = { mat: 'concrete' as const, tint: s.tint };
    k.partition(l, cx0, cz1, cx1, cz1, [k.door((cx1 - cx0) / 2, open ? 'open' : 'locked', 1.2)], po);
    if (l === deck) {
      // On the deck the core stands free: its back wall too.
      k.partition(l, cx0 - P, cz0 - P, cx1 + P, cz0 - P, [], po);
      k.partition(l, cx0, cz0 - P, cx0, cz1, [], po);
      k.partition(l, cx1, cz0 - P, cx1, cz1, [], po);
    } else {
      k.partition(l, cx0, cz0, cx0, cz1, [], po);
      k.partition(l, cx1, cz0, cx1, cz1, [], po);
    }
    const hall = k.room(l, cx0 + P, zs, cx1 - P, cz1 - P, 'stairs');
    if (l === 0) {
      const ring = ringRooms(k, 0, inner, [core[0], inner[1], core[2], core[3]], 'lobby');
      for (const r of ring.all) f.ensure(r, 'locker', 'tower');
    } else if (l === deck) {
      const ring = ringRooms(k, l, lot, core, 'tower');
      for (const r of ring.all) {
        f.row(r, 'z+', 2.4, 0.7, 0.9, 'counter', { kind: 'desk', table: 'tower', max: 1, tint: 0.2 });
        f.ensure(r, 'cabinet', 'tower');
      }
    } else if (f.chance(0.25)) f.stain(hall, 'debris', 1);
  }

  // ---- The deck: glass on the lot's edge (one sheet per side, frame posts), a fascia under it.
  const glass = { mat: 'glass' as const, tint: s.deckTint ?? 0.5, layer: 'shell' as const, y0: yDeck, y1: e - 0.25 };
  k.wall(deck, 0, d - T, w, d, [], glass);
  k.wall(deck, 0, 0, w, T, [], glass);
  k.wall(deck, 0, T, T, d - T, [], glass);
  k.wall(deck, w - T, T, w, d - T, [], glass);
  for (const [x, z] of [[0, 0], [w - T, 0], [0, d - T], [w - T, d - T]] as const) k.box(-1, x, yDeck, z, x + T, e, z + T, s.mat, wo);
  for (const q of subtractRects([0, 0, w, d], [shaft])) k.box(-1, q[0], yDeck - 1.4, q[1], q[2], yDeck - 0.2, q[3], s.mat, wo);

  // ---- The roof: slab (the stair's hole), a parapet with a rail, the stair house.
  for (const q of subtractRects([0, 0, w, d], stairRect ? [stairRect] : [])) k.box(L, q[0], e - 0.25, q[1], q[2], e, q[3], 'concrete', { layer: 'shell', tint: s.tint });
  const par = ARCH.rail.parapet;
  k.box(-1, 0, e, 0, w, e + par, T, s.mat, wo);
  k.box(-1, 0, e, d - T, w, e + par, d, s.mat, wo);
  k.box(-1, 0, e, T, T, e + par, d - T, s.mat, wo);
  k.box(-1, w - T, e, T, w, e + par, d - T, s.mat, wo);
  guardRail(k, T, e + par);
  const hh = 2.7;
  k.wall(L, core[0], cz1, core[2], cz1 + 2 * P, [k.door((cx1 - cx0) / 2 + P, 'open', 1.2)], { ...wo, y0: e, y1: e + hh });
  k.box(-1, core[0], e, core[1], core[2], e + hh, core[1] + 2 * P, s.mat, wo);
  k.box(-1, core[0], e, core[1] + 2 * P, core[0] + 2 * P, e + hh, cz1, s.mat, wo);
  k.box(-1, core[2] - 2 * P, e, core[1] + 2 * P, core[2], e + hh, cz1, s.mat, wo);
  k.box(-1, core[0], e + hh, core[1], core[2], e + hh + 0.2, cz1 + 2 * P, s.mat, wo);
  k.room(L, cx0 + P, zs, cx1 - P, cz1 - P, 'stairs');
  const ring = ringRooms(k, L, lot, [core[0], core[1], core[2], cz1 + 2 * P], 'roof');
  for (const r of ring.all) f.ensure(r, 'crate', 'roof');
  return { shaft, core, roof: e, house: e + hh + 0.2 };
}
