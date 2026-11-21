// タワーマンション (07d-2c): a thirty-storey residential tower, square in plan, with a balcony all the
// way round every storey (a concrete upstand at the edge, the glass wall set back behind it) and
// the ground floor recessed behind a terrace. Inside: the core (stair, two dead lifts), a corridor
// round it and the flats off the corridor — three along the front, three along the back, one on
// each side. The entrance hall (concierge counter, sofas, mail boxes) and the management office on
// the ground floor, the residents' lounge and party room on the first; the fifteenth storey can be
// entered (half the flats locked), the top floor is one penthouse.
// The rest are locked at the stair. The roof: the emergency helipad, the guard rail, the mast.

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit, Rect } from '../../kit.ts';
import type { BuildingDef } from '../../types.ts';
import { ring } from '../house/common.ts';
import { canteen, corridorPlate, kitchen, officeDesks, ringRooms, storeRoom, towerFloors, twoPass, waiting, type Fit } from './common.ts';
import { flatUnit, towerRoof } from './tower.ts';

/** Balcony depth (the glass wall stands this far in), the upstand's thickness, the glass wall's. */
const B = 1.5;
const E = 0.2;
const G = 0.15;

export const OFFICE_TOWER_MANSION: BuildingDef = {
  id: 'office.tower_mansion',
  category: 'office',
  variant: 'tower_mansion',
  kind: 'apartment',
  size: { w: [26, 30], d: [26, 29] },
  storeys: 30,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.3,
  roof: 'flat',
  roofRise: 6.0,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_TOWER_MANSION, rng, params, build);
  },
};

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = B + G; // the rooms start behind the glass wall
  const tint = k.rand();
  const accent = k.rand();
  const y1 = k.levelY(1);
  const top = k.eaves + ARCH.rail.parapet;

  // ---- Outside: the recessed ground floor, the glass walls, an upstand per storey, the corners.
  ring(k, 0, [B, B, w - B, d - B], {
    mat: 'concrete', tint, thick: G, y1,
    front: [k.window(w * 0.3, w * 0.3, { sill: 0.1, head: 3.0, broken: k.rand() < 0.3 }), k.door(w / 2 + 1.0, 'open', ARCH.door.wide), k.window(w * 0.75, w * 0.25, { sill: 0.1, head: 3.0 })],
    back: [k.door(w - B - 2.0, 'locked'), k.window(w * 0.4, 4.0, { sill: 0.9 })],
    left: [k.window(d * 0.5, 5.0, { sill: 0.9 })],
    right: [k.window(d * 0.5, 5.0, { sill: 0.9 })],
  });
  const glass = (x0: number, z0: number, x1: number, z1: number): void => {
    k.box(-1, x0, y1, z0, x1, k.eaves, z1, 'glass', { layer: 'shell' });
  };
  glass(B, d - B - 0.09, w - B, d - B - 0.06);
  glass(B, B + 0.06, w - B, B + 0.09);
  glass(B + 0.06, B, B + 0.09, d - B);
  glass(w - B - 0.09, B, w - B - 0.06, d - B);
  for (let i = 1; i <= k.storeys; i++) {
    const y = k.levelY(i);
    const yt = i === k.storeys ? top : y + 1.1;
    k.box(-1, 0, y - 0.25, d - E, w, yt, d, 'concrete', { layer: 'shell', tint });
    k.box(-1, 0, y - 0.25, 0, w, yt, E, 'concrete', { layer: 'shell', tint });
    k.box(-1, 0, y - 0.25, E, E, yt, d - E, 'concrete', { layer: 'shell', tint });
    k.box(-1, w - E, y - 0.25, E, w, yt, d - E, 'concrete', { layer: 'shell', tint });
  }
  for (const [x, z] of [[0, 0], [w - 0.6, 0], [0, d - 0.6], [w - 0.6, d - 0.6]] as const) k.box(-1, x, -0.3, z, x + 0.6, top, z + 0.6, 'concrete', { layer: 'shell', tint: accent });
  // The canopy over the entrance (drawn only).
  k.box(-1, w / 2 - 3, k.levelY(0) + 3.0, B, w / 2 + 5, k.levelY(0) + 3.2, d + 0.5, 'steel', { layer: 'shell', solid: false, tint: 0.3 });

  const outer: Rect = [t, t, w - t, d - t];
  const last = k.storeys - 1;
  const flats = new Set([14]);
  const c = towerFloors(k, f, {
    t, shafts: 2, wc: false, tint,
    // One slab per storey out to the balconies' upstands.
    floorRect: [E, E, w - E, d - E],
    floorMat: (l) => (l === 0 ? 'tileFloor' : 'flooring'),
    open: (l) => l <= 1 || flats.has(l) || l === last,
    doorW: (l) => (l === 0 ? 1.8 : 1.2),
    plate: (level, _c, hole) => {
      if (flats.has(level)) {
        corridorPlate(k, level, {
          outer, hole, cw: 1.5, front: 3, back: 3, sides: true,
          fill: (u) => flatUnit(k, u, k.rand() < 0.5 && !(u.side === 'front' && u.index === 0)),
        });
        return;
      }
      if (level === 0) {
        const r = ringRooms(k, 0, outer, hole, { front: 'lobby', back: 'storage', left: 'lobby', right: 'office' });
        const R = f.roomRect(r.front!);
        f.put(r.front!, [w / 2 - 4.5, R[3] - 2.0, w / 2 - 1.5, R[3] - 1.3], 1.05, 'counter', { tint: accent, search: { kind: 'counter', face: 'z-', table: 'lobby' } });
        waiting(f, r.front!, 'lobby');
        f.row(r.left!, 'x-', 1.2, 0.4, 1.6, 'steel', { kind: 'cabinet', table: 'lobby', every: 2, max: 4, tint: 0.4 }); // mail boxes
        storeRoom(f, r.back!, 'tools');
        officeDesks(f, r.right!, { tint: 0.4 });
        for (const id of r.all) f.ensure(id, 'cabinet', k.roomById(id).use);
        return;
      }
      if (level === 1) {
        const r = ringRooms(k, 1, outer, hole, { front: 'living', back: 'canteen', left: 'storage', right: 'living' });
        for (const id of [r.front!, r.right!]) {
          f.grid(id, 2.2, 0.9, 1.5, 1.5, (q) => f.put(id, q, 0.8, 'fabric', { tint: accent }), undefined, 8);
          f.row(id, 'z-', 1.6, 0.45, 1.0, 'woodDark', { kind: 'cabinet', table: 'living', max: 1 });
        }
        canteen(f, r.back!, { tint: accent });
        storeRoom(f, r.left!);
        for (const id of r.all) f.ensure(id, 'cabinet', k.roomById(id).use);
        return;
      }
      // The penthouse: one flat the whole floor.
      const r = ringRooms(k, level, outer, hole, { front: 'living', back: 'bedroom', left: 'kitchen', right: 'bath' });
      f.grid(r.front!, 2.4, 1.0, 1.6, 1.6, (q) => f.put(r.front!, q, 0.8, 'fabric', { tint: accent }), undefined, 6);
      f.row(r.front!, 'z-', 2.0, 0.5, 1.8, 'woodDark', { kind: 'cabinet', table: 'living', max: 2 });
      f.row(r.back!, 'z-', 2.0, 2.1, 0.6, 'fabric', { kind: 'bed', table: 'bedroom', max: 2, gap: 1.5, tint: 0.9 });
      f.row(r.back!, 'x-', 1.8, 0.6, 2.0, 'wood', { kind: 'closet', table: 'closet', max: 1 });
      kitchen(f, r.left!);
      f.row(r.right!, 'x+', 1.8, 0.9, 0.6, 'tileFloor', { max: 1 });
      for (const id of r.all) f.ensure(id, 'cabinet', k.roomById(id).use);
      f.stain(r.front!);
    },
  });
  towerRoof(k, f, c, { t, tint, parapetTop: top, helipad: true, mastTop: k.eaves + 5.8, rail: false, edge: E });
  // The guard rail on the roof's upstand.
  for (const [x0, z0, x1, z1] of [[0, d - E, w, d], [0, 0, w, E], [0, E, E, d - E], [w - E, E, w, d - E]] as const) k.box(-1, x0, top, z0, x1, top + 0.25, z1, 'steel', { layer: 'shell', tint: 0.6 });
}
