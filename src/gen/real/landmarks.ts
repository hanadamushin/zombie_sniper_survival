// L1: landmarks at their real place (docs/realmap_guide.md §7). The table is src/data/landmarks/;
// here the real position becomes a cell and a point of its area, and a placed landmark gets what its
// blueprint asks of the ground (a moat, a canal, a lawn) and its firing positions.
//
// Pure (no DOM): the area generator (layout.ts), the landmark yard (sim/tactical/yard.ts) and the
// strategic map (ui/world) all read it.

import { LANDMARKS, LANDMARK_GRID, type LandmarkSpot } from '../../data/landmarks/index.ts';
import { blueprintOf, toWorld, type BuildingPlacement, type GroundFeature } from '../buildings/index.ts';
import { forTiles, N, SIZE, TILE, type Builder } from '../builder.ts';
import { GROUND, type Building } from '../types.ts';

export interface LandmarkAt {
  spot: LandmarkSpot;
  cell: number;
  /** The shrunk point in the cell's area (m from its north-west corner). */
  x: number;
  z: number;
}

/** Cell and area position of a real point (the strategic map's grid; the area is the cell's 10 km square shrunk to SIZE). */
export function realToArea(lat: number, lon: number): { cell: number; x: number; z: number } {
  const G = LANDMARK_GRID;
  const fy = ((G.latTop - lat) * G.kmPerLat) / G.cellKm;
  const fx = ((lon - G.lon0) * G.kmPerLon) / G.cellKm;
  const gy = Math.floor(fy);
  const gx = Math.floor(fx);
  return { cell: gy * G.gridW + gx, x: (fx - gx) * SIZE, z: (fy - gy) * SIZE };
}

let byCell: Map<number, LandmarkAt[]> | null = null;
/** Every landmark of the table with its cell and point. */
export function allLandmarks(): LandmarkAt[] {
  return [...landmarkCells().values()].flat();
}
function landmarkCells(): Map<number, LandmarkAt[]> {
  if (byCell) return byCell;
  byCell = new Map();
  for (const spot of LANDMARKS) {
    const a = realToArea(spot.lat, spot.lon);
    const list = byCell.get(a.cell) ?? [];
    list.push({ spot, ...a });
    byCell.set(a.cell, list);
  }
  return byCell;
}

/** The landmarks whose real point lies in a cell, in table order. */
export function landmarksIn(cell: number): readonly LandmarkAt[] {
  return landmarkCells().get(cell) ?? [];
}

const inside = (poly: readonly [number, number][], x: number, z: number): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};

const KIND = { grass: GROUND.park, paved: GROUND.paved, gravel: GROUND.track } as const;

/**
 * What a placed landmark does to its surroundings: its blueprint's ground (water dug under the lot's
 * ground level, lawns, paving) and its firing positions. `water` is the map's surface per height
 * sample (layout.ts; the yard makes its own). The samples on the area's edge are never changed (the
 * neighbour must see the same ground there).
 */
export function applyLandmark(b: Builder, bd: Building, water: Float32Array): void {
  const place: BuildingPlacement = b.placements[bd.enter!]!;
  const bp = blueprintOf(place);
  for (const v of bp.vantages ?? []) {
    const [x, z] = toWorld(place, v[0], v[2]);
    b.vantages.push({ pos: [x, place.base + v[1], z], kind: 'roof' });
  }
  for (const g of bp.ground ?? []) applyGround(b, place, g, water);
}

function applyGround(b: Builder, place: BuildingPlacement, g: GroundFeature, water: Float32Array): void {
  const poly = g.poly.map(([x, z]) => toWorld(place, x, z));
  const xs = poly.map((p) => p[0]);
  const zs = poly.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  if (g.kind === 'water') {
    const depth = g.depth ?? 2.4;
    const drop = g.drop ?? 0.8;
    for (let iz = Math.max(1, Math.ceil(z0 / TILE)); iz <= Math.min(N - 2, Math.floor(z1 / TILE)); iz++) {
      for (let ix = Math.max(1, Math.ceil(x0 / TILE)); ix <= Math.min(N - 2, Math.floor(x1 / TILE)); ix++) {
        if (!inside(poly, ix * TILE, iz * TILE)) continue;
        const i = iz * N + ix;
        b.height[i] = place.base - depth;
        water[i] = place.base - drop;
      }
    }
  }
  forTiles(Math.max(0, x0), Math.max(0, z0), Math.min(SIZE, x1), Math.min(SIZE, z1), (t, tx, ty) => {
    if (!inside(poly, (tx + 0.5) * TILE, (ty + 0.5) * TILE)) return;
    if (g.kind === 'water') {
      b.ground[t] = GROUND.water;
      b.occupied[t] = 1;
    } else b.ground[t] = KIND[g.kind];
  });
}
