// The home base's functional buildings (07d, 06's structures) as enterable blueprints. One plain
// single-storey generator for all of them: a front room the door opens into, and the rooms behind
// it off doors in the partition, with furniture that says what the building is for. Survivors work,
// eat and sleep in these rooms (sim/colony/ai.ts).
//
// Size: a structure takes w × d tiles of 4 m (data/buildings.ts); its building is that less 0.3 m
// on each side (local w = tiles·4 − 0.6), the front (door) on the structure's rot side.

import { ARCH } from '../../../../data/architecture.ts';
import { createKit, type Kit } from '../../kit.ts';
import type { BuildingDef, FurnitureKind, LootTableId, MaterialId, Room, RoomUse } from '../../types.ts';

const P = ARCH.wall.partition / 2;
/** Gap left round a base building inside its tiles (m, each side). */
export const BASE_INSET = 0.3;

interface Program {
  /** Structure id (data/buildings.ts) and its footprint in tiles. */
  id: string;
  tiles: readonly [number, number];
  /** Front room, then the rooms behind it (left to right). */
  front: RoomUse;
  back: RoomUse[];
  wall: MaterialId;
  roof: 'gable' | 'flat';
  wideDoor?: boolean;
}

const PROGRAMS: Program[] = [
  { id: 'hq', tiles: [3, 3], front: 'command', back: ['bedroom', 'storage'], wall: 'wood', roof: 'gable' },
  { id: 'hut', tiles: [2, 2], front: 'bedroom', back: [], wall: 'wood', roof: 'gable' },
  { id: 'house', tiles: [2, 2], front: 'living', back: ['bedroom'], wall: 'brick', roof: 'gable' },
  { id: 'apartment', tiles: [3, 2], front: 'hall', back: ['bedroom', 'bedroom', 'bedroom'], wall: 'concrete', roof: 'flat' },
  { id: 'storehouse', tiles: [2, 2], front: 'storage', back: [], wall: 'wood', roof: 'gable', wideDoor: true },
  { id: 'workshop', tiles: [2, 2], front: 'workshop', back: [], wall: 'wood', roof: 'gable', wideDoor: true },
  { id: 'lab', tiles: [2, 2], front: 'lab', back: ['storage'], wall: 'brick', roof: 'flat' },
  { id: 'clinic', tiles: [2, 2], front: 'clinic', back: ['bedroom'], wall: 'plaster', roof: 'flat' },
  { id: 'hospital', tiles: [3, 3], front: 'clinic', back: ['bedroom', 'bedroom', 'storage'], wall: 'concrete', roof: 'flat' },
  { id: 'canteen', tiles: [2, 2], front: 'canteen', back: ['kitchen'], wall: 'wood', roof: 'gable' },
  { id: 'barracks', tiles: [3, 2], front: 'barracks', back: ['armory', 'bedroom'], wall: 'brick', roof: 'gable' },
  { id: 'tavern', tiles: [2, 2], front: 'bar', back: ['storage'], wall: 'wood', roof: 'gable' },
  { id: 'school', tiles: [3, 2], front: 'classroom', back: ['classroom', 'storage'], wall: 'brick', roof: 'gable' },
];

/**
 * What stands in a room of each use, and what is searched there: against the back wall, or — in a
 * front room that leads on to other rooms — against the two side walls, clear of the ways through.
 */
function furnish(k: Kit, r: Room, use: RoomUse, sides: boolean): void {
  const place = (n: number, depth: number, h: number, mat: MaterialId, kind: FurnitureKind, table?: LootTableId): void => {
    if (sides) {
      const len = Math.min(1.8, (r.z1 - r.z0) - 1.0);
      if (len < 0.6) return;
      const z0 = r.z0 + (r.z1 - r.z0 - len) / 2;
      const dd = Math.min(depth, 0.8);
      k.furniture(0, r.x0, z0, r.x0 + dd, z0 + len, h, mat, { search: { kind, face: 'x+', table } });
      if (n > 1) k.furniture(0, r.x1 - dd, z0, r.x1, z0 + len, h, mat);
      return;
    }
    const span = r.x1 - r.x0;
    const pw = Math.min(1.8, (span - 0.6) / n - 0.3);
    if (pw < 0.5) return;
    const dd = Math.min(depth, r.z1 - r.z0 - 2.4);
    if (dd < 0.3) return;
    for (let i = 0; i < n; i++) {
      const cx = r.x0 + ((i + 0.5) * span) / n;
      k.furniture(0, cx - pw / 2, r.z0, cx + pw / 2, r.z0 + dd, h, mat, { search: i === 0 ? { kind, face: 'z+', table } : undefined });
    }
  };
  switch (use) {
    case 'bedroom': case 'barracks': place(Math.max(1, Math.floor((r.x1 - r.x0) / 2.2)), 1.9, 0.5, 'fabric', 'bed', 'bedroom'); return;
    case 'storage': case 'kitchen': place(2, 0.6, 2.0, 'shelf', 'shelf', use === 'kitchen' ? 'kitchen' : 'storage'); return;
    case 'workshop': place(2, 0.8, 0.9, 'wood', 'table', 'workshop'); return;
    case 'lab': place(2, 0.75, 0.95, 'counter', 'table', 'lab'); return;
    case 'clinic': place(2, 0.9, 0.65, 'fabric', 'bed', 'clinic'); return;
    case 'canteen': place(2, 0.8, 0.75, 'wood', 'table', 'canteen'); return;
    case 'bar': place(1, 0.7, 1.05, 'counter', 'counter', 'bar'); return;
    case 'classroom': place(3, 0.6, 0.72, 'wood', 'desk', 'classroom'); return;
    case 'armory': place(2, 0.5, 1.8, 'steel', 'locker', 'armory'); return;
    case 'command': place(1, 0.8, 0.75, 'wood', 'desk', 'command'); return;
    default: place(1, 0.5, 0.9, 'wood', 'cabinet'); return;
  }
}

function makeDef(pg: Program): BuildingDef {
  const w = pg.tiles[0] * 4 - BASE_INSET * 2;
  const d = pg.tiles[1] * 4 - BASE_INSET * 2;
  const def: BuildingDef = {
    id: `base.${pg.id}`,
    category: 'base',
    variant: pg.id,
    kind: pg.wall === 'concrete' ? 'office' : 'house',
    size: { w: [w, w], d: [d, d] },
    storeys: 1,
    storeyHeight: 3.0,
    plinth: 0.2,
    roof: pg.roof,
    roofRise: pg.roof === 'gable' ? Math.min(w, d) * 0.28 : 0.6,
    lootable: false,
    generate(rng, params) {
      const k = createKit(def, params, rng);
      const t = 0.2;
      k.thick = t;
      const W = k.w;
      const D = k.d;
      const hasBack = pg.back.length > 0;
      const zf = hasBack ? D * 0.5 : t; // front room | rooms behind
      const doorX = W / 2;
      // (The front door is in the middle; the doors to the back rooms are in the middle of each.)
      const tint = k.rand();
      const backDoors = pg.back.map((_, i) => t + ((i + 0.5) * (W - 2 * t)) / pg.back.length);
      k.floor(0, pg.wall === 'wood' ? 'flooring' : 'vinyl');
      k.outerWalls(0, {
        mat: pg.wall, tint,
        front: [k.door(doorX, 'open', pg.wideDoor ? ARCH.door.wide : ARCH.door.width), k.window(W * 0.2, 1.0), k.window(W * 0.8, 1.0)],
        back: backDoors.map((x) => k.window(x, 0.9, { sill: 1.1 })),
        left: [k.window(D * 0.75, 0.9)],
        right: [k.window(D * 0.75, 0.9)],
      });
      const front = k.room(0, t, hasBack ? zf + P : t, W - t, D - t, pg.front);
      furnish(k, k.roomById(front), pg.front, hasBack);
      if (hasBack) {
        k.partition(0, t, zf, W - t, zf, backDoors.map((x) => k.door(x - t)));
        const edges = [t, ...backDoors.slice(0, -1).map((x, i) => (x + backDoors[i + 1]!) / 2), W - t];
        pg.back.forEach((use, i) => {
          if (i > 0) k.partition(0, edges[i]!, t, edges[i]!, zf - P);
          const r = k.room(0, edges[i]! + (i > 0 ? P : 0), t, edges[i + 1]! - (i < pg.back.length - 1 ? P : 0), zf - P, use);
          furnish(k, k.roomById(r), use, false);
        });
      }
      if (pg.roof === 'gable') k.roofGable({ mat: 'metalRoof', tint: k.rand() });
      else k.roofFlat({ mat: 'concrete', parapet: 0.5, parapetMat: pg.wall });
      return k.finish();
    },
  };
  return def;
}

export const BASE_BUILDINGS: readonly BuildingDef[] = PROGRAMS.map(makeDef);
/** Structure id (data/buildings.ts) -> blueprint type. */
export const BASE_BLUEPRINT: Readonly<Record<string, string>> = Object.fromEntries(PROGRAMS.map((p) => [p.id, `base.${p.id}`]));
