// L8 → O1: 端島 (Hashima, "軍艦島" the Battleship Island), off the Nagasaki peninsula. A coal-mining
// island walled in concrete and built over with Japan's first reinforced-concrete blocks of flats (from
// 1916), up to ten storeys, home to 5,000 people until the mine closed in 1974 — a ruin long before
// the fall. From the sea: the grey sea wall like a hull, the blocks packed along it, the rock ridge in
// the middle with the shrine and the small white lighthouse on top, and at the south end the mine's
// ruins — the brick walls of its office, the stumps of the coal conveyor.
//
// O1 (the owner: "軍艦島も同様の扱いに"): builders holed up on the island with a hoard of materials
// (BALANCE.hashima, sim/world/stash.ts), so the island is walked: the path along the top of the sea
// wall (stairs up from the alleys), the alleys between the blocks, three blocks of flats one goes into
// (07d's wing: rooms off a corridor, stairs to the roof; three, to keep the island's inside light), roofs joined by footbridges over the
// alleys, the store of materials on the ground floor of the company flats (日給社宅, `stash`), the
// builders in a room on the first floor of block 65 (`hide`), the landing on the sea wall facing the
// peninsula (`dock`, the boat: E), and where the island's dead stand (`zombies`). The other blocks
// are shut ruins (locked doors, dark window bands).
//
// Real size: 480 × 160 m. Drawn at about 0.42 (the island 204 × 64 m, its blocks at their real
// height): the owner asked for 1/3–1/2 and the island to be walkable. The lot stands in the sea (the
// table drains it): the sea round the island is dug back in. Local x runs along the island from
// south to north (the table turns it: rot 1), the front (z = d) faces east, to the peninsula.

import { ARCH } from '../../../../../data/architecture.ts';
import type { Kit, Rect } from '../../../kit.ts';
import type { BuildingDef, GroundFeature, MaterialId } from '../../../types.ts';
import { twoPass, type Fit } from '../../office/common.ts';
import { wing, zone, type Bay, type Fit as RoomFit } from '../../public/common.ts';
import { paint } from '../common.ts';
import type { PaintName } from '../../../../../data/render.ts';

const W = 216;
const D = 80;
/** The island's outline: the lot minus its four corners (CH), the sea wall (T thick) inside it. */
export const HASHIMA_ISLAND = { x0: 6, z0: 8, x1: 210, z1: 72, ch: 10 } as const;
const { x0: X0, z0: Z0, x1: X1, z1: Z1, ch: CH } = HASHIMA_ISLAND;
const T = 3;
/** Top of the sea wall: the walkway (local y over the island's ground). */
const WY = 4.2;
/** Storeys of the blocks one goes into (their roofs at one height: the footbridges join them). */
const LEVELS = 3;


const pbox = (k: Kit, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, name: PaintName, solid = true): void => {
  k.box(-1, x0, y0, z0, x1, y1, z1, 'paint', { layer: 'shell', tint: paint(name), solid });
};

/** A room of a flat: a low table in the middle and the family's chest against the far wall (searched). */
const flat: RoomFit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx);
  const [x0, , x1] = r;
  if (z[3] - z[1] < 2.2 || x1 - x0 < 2.4) return;
  const far = face === 'z+' ? z[1] : z[3];
  const sg = face === 'z+' ? 1 : -1;
  const [a, b] = [Math.min(far, far + sg * 0.6), Math.max(far, far + sg * 0.6)];
  k.furniture(level, x0 + 0.3, a, Math.min(x1 - 0.3, x0 + 1.8), b, 1.6, 'wood', { tint: 0.35, search: { kind: 'closet', face, table: 'living' } });
  const mx = (x0 + x1) / 2;
  const mz = (z[1] + z[3]) / 2;
  if (x1 - x0 > 3.4) k.furniture(level, mx - 0.5, mz - 0.4, mx + 0.5, mz + 0.4, 0.35, 'woodDark', { tint: 0.5 });
};

/** The builders' store: crates and sacks along the walls (the hoard itself is the stash's supply point). */
const store: RoomFit = (k, level, r, ctx) => {
  const { z, face } = zone(r, ctx, 1.2);
  const [x0, , x1] = r;
  if (z[3] - z[1] < 2 || x1 - x0 < 3) return;
  const far = face === 'z+' ? z[1] : z[3];
  const sg = face === 'z+' ? 1 : -1;
  const [a, b] = [Math.min(far, far + sg * 0.9), Math.max(far, far + sg * 0.9)];
  k.furniture(level, x0 + 0.3, a, x1 - 0.3, b, 1.3, 'olive', { tint: 0.4, search: { kind: 'crate', face, table: 'stock' } });
};

/** A block of flats one goes into (07d's wing), 14 m deep along x, its entrance hall towards `door`. */
function block(k: Kit, r: Rect, door: 'z+' | 'z-', tint: number, special?: { level: number; side: 'z+' | 'z-'; bay: Bay }): ReturnType<typeof wing> {
  const room = (): Bay => ({ use: 'living', len: 8, fit: flat });
  return wing(k, {
    rect: r, levels: LEVELS, corridor: 'mid', cw: 2.0,
    left: { rooms: ['toilet', 'storage'] }, right: { rooms: ['bath', 'storage'] }, roofAccess: 'right',
    mat: 'concrete', tint, pierMat: 'concrete', roof: 'flat', broken: 0.6,
    bays: (level, side) => {
      const out: Bay[] = level === 0 && side === door
        ? [room(), { use: 'lobby', len: 5, open: true, outer: { width: ARCH.door.wide } }, room()]
        : [room(), room(), room()];
      if (special && special.level === level && special.side === side) out[2] = special.bay;
      return out;
    },
  });
}

/** A shut ruin of a block: plain walls, a dark band per storey, a part of the top storeys fallen in. */
function ruin(k: Kit, r: Rect, levels: number, name: PaintName): void {
  const [x0, z0, x1, z1] = r;
  const fh = ARCH.storey.concrete;
  const top = levels * fh;
  const along = x1 - x0 >= z1 - z0;
  const gone = k.rand() < 0.5 ? 0.3 : 0;
  if (gone > 0 && along) {
    const xs = x1 - (x1 - x0) * gone;
    pbox(k, x0, 0, z0, xs, top, z1, name);
    pbox(k, xs, 0, z0, x1, top - 2 * fh, z1, name);
  } else pbox(k, x0, 0, z0, x1, top, z1, name);
  for (let f = 0; f < levels; f++) {
    const ya = f * fh + fh * 0.3;
    const yb = f * fh + fh * 0.8;
    if (along) for (const z of [z0 - 0.08, z1]) pbox(k, x0 + 0.6, ya, z, x1 - 0.6, yb, z + 0.08, 'windowDark', false);
    else for (const x of [x0 - 0.08, x1]) pbox(k, x, ya, z0 + 0.6, x + 0.08, yb, z1 - 0.6, 'windowDark', false);
  }
}

/** Steps of ARCH.stair.maxRise from y0 to y1 along x (dir +1 / -1 from x), z0..z1 wide; returns the far end's x. */
function steps(k: Kit, x: number, dir: 1 | -1, z0: number, z1: number, y0: number, y1: number, mat: MaterialId, tint: number): number {
  const n = Math.ceil((y1 - y0) / ARCH.stair.maxRise - 1e-6);
  const rise = (y1 - y0) / n;
  const go = 0.3;
  for (let i = 1; i <= n; i++) {
    const a = x + dir * (i - 1) * go;
    const b = x + dir * i * go;
    k.box(-1, Math.min(a, b), y0, z0, Math.max(a, b), y0 + i * rise, z1, mat, { layer: 'shell', tint });
  }
  return x + dir * n * go;
}

/** A footbridge from roof to roof over an alley along x (xa..xb), z0..z1 wide: steps up over both parapets, rails. */
function footbridge(k: Kit, xa: number, xb: number, z0: number, z1: number, roof: number): void {
  const deck = roof + ARCH.rail.parapet + 0.1;
  const tint = 0.55;
  const ea = steps(k, xa - 3.2, 1, z0, z1, roof, deck, 'concrete', tint);
  const eb = steps(k, xb + 3.2, -1, z0, z1, roof, deck, 'concrete', tint);
  k.box(-1, ea, deck - 0.25, z0, eb, deck, z1, 'steel', { layer: 'shell', tint: 0.3 });
  for (const z of [z0 - 0.06, z1]) k.box(-1, ea, deck, z, eb, deck + ARCH.rail.height, z + 0.06, 'steel', { layer: 'shell', tint: 0.3 });
}

export const LANDMARK_HASHIMA: BuildingDef = {
  id: 'landmark.hashima',
  category: 'landmark',
  variant: 'hashima',
  kind: 'tower',
  size: { w: [W, W], d: [D, D] },
  storeys: 1,
  storeyHeight: ARCH.storey.concrete,
  plinth: 0.2,
  roof: 'flat',
  roofRise: 34,
  lootable: true,
  // A whole island of blocks in one blueprint (as a garrison is a whole site): the outside of a dozen
  // buildings, and the inside of three blocks on one storey's count.
  limits: { shell: 12000, interior: 9000 },
  generate(rng, params) {
    const marks: Record<string, [number, number, number][]> = {};
    const bp = twoPass(LANDMARK_HASHIMA, rng, params, (k, f) => {
      for (const key of Object.keys(marks)) delete marks[key];
      build(k, f, marks);
    });
    bp.marks = marks;
    bp.ground = sea();
    bp.vantages = [[176, ARCH.storey.concrete * LEVELS + 0.2, 19]];
    return bp;
  },
};

/** The sea round the island: the lot outside its outline (corners cut). */
function sea(): GroundFeature[] {
  const g = (poly: [number, number][]): GroundFeature => ({ kind: 'water', poly, depth: 4, drop: 1.2 });
  return [
    g([[0, 0], [W, 0], [W, Z0], [0, Z0]]),
    g([[0, Z1], [W, Z1], [W, D], [0, D]]),
    g([[0, Z0], [X0, Z0], [X0, Z1], [0, Z1]]),
    g([[X1, Z0], [W, Z0], [W, Z1], [X1, Z1]]),
    g([[X0, Z0], [X0 + CH, Z0], [X0 + CH, Z0 + CH], [X0, Z0 + CH]]),
    g([[X1 - CH, Z0], [X1, Z0], [X1, Z0 + CH], [X1 - CH, Z0 + CH]]),
    g([[X0, Z1 - CH], [X0 + CH, Z1 - CH], [X0 + CH, Z1], [X0, Z1]]),
    g([[X1 - CH, Z1 - CH], [X1, Z1 - CH], [X1, Z1], [X1 - CH, Z1]]),
  ];
}

function build(k: Kit, _f: Fit, marks: Record<string, [number, number, number][]>): void {
  const mark = (name: string, x: number, y: number, z: number): void => {
    (marks[name] ??= []).push([x, y, z]);
  };
  // ---- The sea wall (the hull): its top is the walkway, a low parapet on the sea side.
  const wallTint = paint('hashima');
  const wallBox = (x0: number, z0: number, x1: number, z1: number): void => {
    k.box(-1, x0, -ARCH.foundation, z0, x1, WY, z1, 'paint', { layer: 'shell', tint: wallTint });
  };
  const para = (x0: number, z0: number, x1: number, z1: number): void => {
    k.box(-1, x0, WY, z0, x1, WY + 1.0, z1, 'paint', { layer: 'shell', tint: paint('gray') });
  };
  // Long sides (z low: the open sea; z high: the peninsula, the front).
  wallBox(X0 + CH, Z0, X1 - CH, Z0 + T);
  para(X0 + CH, Z0, X1 - CH, Z0 + 0.4);
  wallBox(X0 + CH, Z1 - T, X1 - CH, Z1);
  para(X0 + CH, Z1 - 0.4, X1 - CH, Z1);
  // Ends.
  wallBox(X0, Z0 + CH, X0 + T, Z1 - CH);
  para(X0, Z0 + CH, X0 + 0.4, Z1 - CH);
  wallBox(X1 - T, Z0 + CH, X1, Z1 - CH);
  para(X1 - 0.4, Z0 + CH, X1, Z1 - CH);
  // The four cut corners: two short walls each (the inner corner square closes them).
  for (const [cx, cz, sx, sz] of [[X0, Z0, 1, 1], [X1, Z0, -1, 1], [X0, Z1, 1, -1], [X1, Z1, -1, -1]] as const) {
    const xa = cx;
    const xb = cx + sx * (CH + T);
    const za = cz + sz * CH;
    const zb = cz + sz * (CH + T);
    wallBox(Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb));
    para(Math.min(xa, xb), Math.min(za, za + sz * 0.4), Math.max(xa, xb), Math.max(za, za + sz * 0.4));
    const xc = cx + sx * CH;
    const xd = cx + sx * (CH + T);
    wallBox(Math.min(xc, xd), Math.min(cz, za), Math.max(xc, xd), Math.max(cz, za));
    para(Math.min(xc, xc + sx * 0.4), Math.min(cz, za), Math.max(xc, xc + sx * 0.4), Math.max(cz, za));
  }
  // Stairs from the alleys up onto the wall: by the landing (front), between two blocks (west), at the south end (front).
  const stTint = 0.5;
  steps(k, 135.5, 1, Z1 - T - 2.6, Z1 - T, 0, WY, 'concrete', stTint);
  steps(k, 148.8, 1, Z0 + T, Z0 + T + 2.4, 0, WY, 'concrete', stTint);
  steps(k, 20, 1, Z1 - T - 2.6, Z1 - T, 0, WY, 'concrete', stTint);

  // ---- The blocks one goes into, down the west side: 日給社宅 (A, the store on its ground floor), B,
  // and block 65 (C, the builders on its first floor). Their roofs are joined over the alleys.
  const A: Rect = [62, 12, 102, 26];
  const B: Rect = [108, 12, 148, 26];
  const C: Rect = [156, 12, 196, 26];
  const a = block(k, A, 'z+', 0.35, { level: 0, side: 'z-', bay: { use: 'storage', len: 8, fit: store } });
  block(k, B, 'z+', 0.5);
  const c = block(k, C, 'z+', 0.42, { level: 1, side: 'z+', bay: { use: 'living', len: 9 } });
  const roof = k.levelY(LEVELS);
  // Over the rooms on the alley side, clear of the stair houses on the corridor.
  footbridge(k, 102, 108, 22.6, 24.8, roof);
  footbridge(k, 148, 156, 22.6, 24.8, roof);
  const storeRoom = a.rooms.find((r) => r.level === 0 && r.bay.use === 'storage' && r.side === 'z-');
  if (storeRoom) {
    const [x0, z0, x1, z1] = storeRoom.rect;
    mark('stash', (x0 + x1) / 2, k.levelY(0), (z0 + z1) / 2);
  }
  const hideRoom = c.rooms.find((r) => r.level === 1 && r.side === 'z+' && r.bay.len === 9);
  if (hideRoom) {
    const [x0, z0, x1, z1] = hideRoom.rect;
    const mz = (z0 + z1) / 2;
    for (const u of [-0.3, 0, 0.3]) mark('hide', (x0 + x1) / 2 + u * (x1 - x0 - 1.5), k.levelY(1), mz);
  }

  // ---- Shut ruins: the school, the tall blocks round 65's courtyard, the east side.
  ruin(k, [42, 12, 58, 24], 6, 'charcoal');
  ruin(k, [70, 53, 106, 67], 9, 'hashima');
  ruin(k, [184, 32, 200, 46], 9, 'hashima');
  ruin(k, [40, 54, 66, 66], 5, 'gray');
  ruin(k, [112, 54, 130, 66], 7, 'hashima');
  ruin(k, [156, 54, 178, 66], 8, 'hashima');
  ruin(k, [184, 52, 198, 60], 6, 'gray');

  // ---- The rock ridge in the middle, the shrine on it and the small white lighthouse.
  const r1 = k.part({ shape: 'cyl', x0: 62, y0: 0, z0: 31, x1: 150, y1: 14, z1: 47, mat: 'paint', layer: 'shell', tint: paint('grayGreen') });
  r1.taper = 0.62;
  const r2 = k.part({ shape: 'cyl', x0: 82, y0: 13, z0: 34, x1: 130, y1: 22, z1: 44, mat: 'paint', layer: 'shell', tint: paint('grayGreen') });
  r2.taper = 0.45;
  pbox(k, 104, 21, 37, 108, 24, 40, 'gray');
  const lh = k.part({ shape: 'cyl', x0: 94.9, y0: 20, z0: 37.9, x1: 97.1, y1: 27, z1: 40.1, mat: 'paint', layer: 'shell', tint: paint('white') });
  lh.solid = true;

  // ---- The mine at the south end: the brick shell of its office, the conveyor's stumps, a pithead's base.
  for (const [x0, z0, x1, z1, h] of [[14, 32, 26, 33, 9], [14, 32, 15, 42, 7], [25, 32, 26, 38, 8], [18, 41.5, 26, 42.5, 5]] as const) pbox(k, x0, 0, z0, x1, h, z1, 'brickRed');
  for (let x = 14; x <= 38; x += 4) pbox(k, x - 0.8, 0, 22, x + 0.8, 7.5, 24, 'gray');
  pbox(k, 30, 0, 28, 38, 3.5, 36, 'gray');
  pbox(k, 32, 3.5, 30, 36, 9, 34, 'charcoal', false);

  // ---- The landing on the sea wall facing the peninsula, and where the island's dead stand.
  mark('dock', 142, WY, Z1 - 1.6);
  for (const [x, z] of [[84, 28.5], [126, 28.5], [170, 29], [90, 49.5], [140, 49.5], [56, 49.5], [30, 28], [180, 49], [104, 9.5], [150, 69.5]] as const) {
    mark('zombies', x, x === 104 || x === 150 ? WY : 0, z);
  }
}
