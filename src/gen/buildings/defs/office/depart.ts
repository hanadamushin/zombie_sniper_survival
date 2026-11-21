// 百貨店 (07d-2c): a seven-storey department store with tall, wide sales floors. Blank walls above a
// row of show windows and two entrances, the store's name in big letters, a strip of glass at the
// restaurant floor. Inside: the staff core (stair, two goods lifts, toilets) and the stock room
// along the back; the sales floor the rest of each storey round a pair of stopped escalators in the
// middle (scissor fashion: up towards the back on even storeys, towards the front on odd ones — they
// are walked like stairs). Cosmetics and accessories (glass showcases) on the ground floor, women's
// and men's clothes (racks), household goods, toys and books, the restaurants, the event hall at
// the top. The core's stair goes on to the rooftop playground.
//
//   +-------+---------------------------+
//   | core  |    stock room             |
//   +--D----+------------D--------------+
//   |            sales  (back)          |
//   |   sales  |  ‖ ‖  esc  |  sales    |
//   |            sales  (front)         |
//   +==show=====[D]========[D]===show===+

import { ARCH } from '../../../../data/architecture.ts';
import type { Kit, Rect } from '../../kit.ts';
import type { BuildingDef, LootTableId, MaterialId } from '../../types.ts';
import {
  canteen, coreAt, coreLevel, coreRoof, curtain, kitchen, P, ringRooms, roofPlant, storeRoom, twoPass, waiting, type Fit,
} from './common.ts';

const EW = 1.0; // escalator width

export const OFFICE_DEPART: BuildingDef = {
  id: 'office.depart',
  category: 'office',
  variant: 'depart',
  kind: 'shop',
  size: { w: [32, 40], d: [24, 29] },
  storeys: 7,
  storeyHeight: 4.2,
  plinth: 0.2,
  roof: 'flat',
  roofRise: 4.6,
  lootable: true,
  generate(rng, params) {
    return twoPass(OFFICE_DEPART, rng, params, build);
  },
};

interface Floor {
  tables: LootTableId[];
  piece: [number, number, number, MaterialId];
}
/** Each sales floor: what can be found on it, the fixture (size x, size z, height, material). */
const FLOORS: Floor[] = [
  { tables: ['pharmacy', 'sales'], piece: [2.4, 0.7, 0.95, 'counter'] }, // cosmetics: showcases
  { tables: ['sales', 'bedroom'], piece: [1.8, 0.5, 1.4, 'steel'] }, // women's: racks
  { tables: ['sales', 'closet'], piece: [1.8, 0.5, 1.4, 'steel'] }, // men's
  { tables: ['tools', 'kitchen'], piece: [2.6, 0.9, 1.6, 'shelf'] }, // household goods
  { tables: ['sales', 'classroom'], piece: [2.6, 0.9, 1.5, 'shelf'] }, // toys and books
];

function build(k: Kit, f: Fit): void {
  const { w, d } = k;
  const t = 0.3;
  k.thick = t;
  const tint = k.rand();
  const brand = k.rand();
  const y1 = k.levelY(1);
  const top = k.eaves + ARCH.rail.parapet;
  const c = coreAt(k, t + P, t + P, { shafts: 2, shaftW: 2.4, wc: true, hall: 2.2 });
  const zs = c.z1 + P; // sales floor's back
  const xe = w / 2; // escalators' centre line
  const run = Math.ceil(k.def.storeyHeight / ARCH.stair.maxRise - 1e-6) * ARCH.stair.going;
  const zm = (zs + d - t) / 2 + 0.5;
  const zf = zm + run / 2; // the front end of the escalators
  const zb = zf - run; // the back end
  const xa = xe - 0.15 - EW / 2; // up towards the back (even storeys)
  const xb = xe + 0.15 + EW / 2; // up towards the front (odd storeys)
  const esc: Rect = [xa - EW / 2 - 0.12, zb - 0.1, xb + EW / 2 + 0.12, zf + 0.1];
  const last = k.storeys - 1;

  // ---- Outside: show windows and entrances, blank walls with the name, glass at the restaurants.
  const shows = (a: number, b: number, n: number) => k.evenly(a, b, n).map((x) => k.window(x, (b - a) / n - 0.8, { sill: 0.6, head: 3.4, broken: k.rand() < 0.3 }));
  k.outerWalls(0, {
    mat: 'brick', tint, y1,
    front: [...shows(0.6, w * 0.3 - 1.4, 2), k.door(w * 0.3, 'open', ARCH.door.wide), ...shows(w * 0.3 + 1.4, w * 0.7 - 1.4, 2), k.door(w * 0.7, 'open', ARCH.door.wide), ...shows(w * 0.7 + 1.4, w - 0.6, 2)],
    back: [{ ...k.door(w - 5, 'shutter', 3.2), head: 3.4 }, k.door(w - 9, 'locked')],
    left: [...shows(d * 0.45, d - 0.6, 2), k.door(d * 0.3, 'open', ARCH.door.wide)],
    right: [...shows(d * 0.45, d - 0.6, 2), k.door(d * 0.3, 'open', ARCH.door.wide)],
  });
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    curtain(k, { side, from: 1, to: last, y1: k.levelY(last) - 0.1, t, mat: 'brick', tint, sill: 0, drop: 0, sheet: 'brick' });
    curtain(k, { side, from: last, to: k.storeys, y1: top, t, mat: 'brick', tint, sill: 1.0, drop: 0.4, piers: side === 'front' || side === 'back' ? [w / 3, (2 * w) / 3] : [d / 2], pier: 0.8 });
  }
  // The name across the front and down a corner, a canopy over each entrance (drawn only).
  k.box(-1, w * 0.2, k.levelY(3), d, w * 0.8, k.levelY(5) - 0.5, d + 0.15, 'sign', { layer: 'shell', tint: brand, solid: false });
  k.box(-1, w - 0.6, y1 + 1, d - 0.1, w - 0.1, k.levelY(last) - 1, d + 0.5, 'sign', { layer: 'shell', tint: brand, solid: false });
  for (const x of [w * 0.3, w * 0.7]) k.box(-1, x - 2.5, k.levelY(0) + 3.6, d - 0.3, x + 2.5, k.levelY(0) + 3.8, d + 0.6, 'steel', { layer: 'shell', solid: false, tint: 0.3 });

  for (let level = 0; level < k.storeys; level++) {
    k.floor(level, level === 0 ? 'tileFloor' : level === last - 1 ? 'flooring' : 'carpet');
    // The escalator up from this storey (none from the top), rails round the hole it leaves above.
    if (level < last) {
      const even = level % 2 === 0;
      k.stairs({ level, start: [even ? xa : xb, even ? zf : zb], dir: even ? 'z-' : 'z+', width: EW, kind: 'straight', mat: 'steel', tint: 0.5, rails: ['left', 'right', 'end'] });
    }
    const { wc } = coreLevel(k, level, c, { front: [{ x: (c.hall[0] + c.hall[2]) / 2, state: 'open', width: 1.6 }], tint, wcOpen: true });
    if (wc >= 0) f.ensure(wc, 'cabinet', 'toilet');
    // The stock room behind the sales floor.
    const lockStock = level > 0 && k.rand() < 0.3;
    k.partition(level, c.x1, c.z1, w - t, c.z1, [k.door(w * 0.6 - c.x1, lockStock ? 'locked' : 'open', 1.6)]);
    const stock = k.room(level, c.x1 + P, t, w - t, c.z1 - P, 'storage', { locked: lockStock });
    if (!lockStock) storeRoom(f, stock, level === last - 1 ? 'grocery' : 'storage');
    // The sales floor round the escalators.
    const isTop = level === last;
    const food = level === last - 1;
    const ring = ringRooms(k, level, [t, zs, w - t, d - t], esc, isTop ? 'hall' : food ? 'canteen' : 'sales');
    if (isTop) {
      // The event hall: rows of folding chairs (drawn) and a stage, the store's office behind.
      for (const r of ring.all) {
        f.grid(r, 3.0, 0.5, 1.2, 0.9, (q) => {
          f.deco(r, q, 0.45, 'fabric', 0.6);
          return true;
        }, undefined, 10);
      }
      if (ring.left !== undefined) {
        f.row(ring.left, 'x-', 4.0, 2.0, 0.6, 'woodDark', { max: 1 });
        waiting(f, ring.left, 'office');
      }
      for (const r of ring.all) f.ensure(r, 'crate', 'storage');
    } else if (food) {
      for (const r of ring.all) {
        if (r === ring.back) kitchen(f, r);
        canteen(f, r, { tint: brand, counter: r !== ring.back, max: 9 });
      }
    } else {
      const fl = FLOORS[level]!;
      for (const r of ring.all) {
        let i = 0;
        f.grid(r, fl.piece[0], fl.piece[1], 1.5, 1.5, (q) => {
          const table = fl.tables[i % fl.tables.length]!;
          const ok = f.put(r, q, fl.piece[2], fl.piece[3], { tint: brand, search: i % 3 === 0 ? { kind: fl.piece[3] === 'counter' ? 'counter' : 'shelf', face: 'z+', table } : undefined }) || f.put(r, q, fl.piece[2], fl.piece[3], { tint: brand });
          if (ok) i++;
          return ok;
        }, undefined, 18);
        f.row(r, 'z-', 2.2, 0.7, 1.05, 'counter', { kind: 'counter', table: 'sales', max: 1, tint: 0.2 });
        f.ensure(r, 'shelf', fl.tables[0]);
      }
      // Mannequins (drawn only) on the clothes floors.
      if (level === 1 || level === 2) {
        for (const r of ring.all) {
          f.grid(r, 0.4, 0.4, 3.0, 3.0, (q) => {
            if (!f.chance(0.3) || !f.free(r, q)) return false;
            f.deco(r, q, 1.75, 'plaster', 0.2);
            return true;
          }, undefined, 6);
        }
      }
    }
    for (const r of ring.all) if (f.chance(0.25)) f.stain(r, f.chance(0.5) ? 'blood' : 'debris', 1.4);
  }

  // ---- The rooftop playground round the stair house: rides (drawn) and the fence (the parapet).
  k.roofFlat({ mat: 'concrete', tint });
  coreRoof(k, c, { tint });
  const roof = ringRooms(k, k.storeys, [t, t, w - t, d - t], [c.x0 - 0.1, c.z0 - 0.1, c.x1 + 0.1, c.z1 + 0.1], 'roof');
  const e = k.eaves;
  for (const r of roof.all) {
    f.grid(r, 1.6, 1.0, 2.5, 2.5, (q) => {
      if (!f.chance(0.35) || !f.put(r, q, 0.6, 'sign', { tint: f.rand() })) return false;
      f.deco(r, [q[0] + 0.3, q[1] + 0.2, q[2] - 0.3, q[3] - 0.2], 1.3, 'sign', f.rand());
      return true;
    }, undefined, 8);
  }
  roofPlant(f, roof.all, { units: 3, tank: true });
  for (const r of roof.all) f.ensure(r, 'crate', 'roof');
  // A small Ferris wheel's frame over the front of the roof (drawn only, within the roof's rise).
  const fx = w * 0.75;
  k.box(-1, fx - 0.1, e, d - 3.0, fx + 0.1, e + 4.4, d - 2.8, 'steel', { layer: 'shell', solid: false, tint: 0.9 });
  k.box(-1, fx - 2.0, e + 2.2, d - 3.0, fx + 2.0, e + 2.4, d - 2.8, 'steel', { layer: 'shell', solid: false, tint: 0.9 });
  k.box(-1, fx - 1.5, e + 0.6, d - 3.0, fx + 1.5, e + 4.2, d - 2.95, 'sign', { layer: 'shell', solid: false, tint: 0.8 });
}
