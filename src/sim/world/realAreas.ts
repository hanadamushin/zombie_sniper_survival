// R0: which cells have real-map area data (public/data/areas/<region>/<cell>.bin) and the decoded
// data of those loaded so far. Pure: the app fetches (src/realData.ts) and hands the results over;
// the sim only asks. A cell whose data is indexed but not loaded yet is "pending": its area is not
// generated until the data arrive (the random layout would be a different map).

import type { CellId, SdfKind, StaticGrid } from '../../core/types.ts';
import type { RealArea } from '../../gen/real/format.ts';

/** Region index file (written by tools/real/region.ts). */
export interface RegionIndexFile {
  region: string;
  version: number;
  cells: Record<string, { bytes: number; police: number; fire: number; sdf: { kind: string; name: string }[] }>;
}

const regionOf = new Map<CellId, string>();
const loaded = new Map<CellId, RealArea>();
const wanted = new Set<CellId>();
/** Loaded areas kept (3 × 3 around the player plus the recently left ones). */
const KEEP = 24;

/** Register a region's index (and refine the grid's facts of its cells). */
export function addRealRegion(index: RegionIndexFile, grid: StaticGrid | null): void {
  for (const [key, info] of Object.entries(index.cells)) {
    const cell = Number(key);
    regionOf.set(cell, index.region);
    const facts = grid?.cells[cell]?.real;
    if (facts) {
      facts.area = index.region;
      facts.police = info.police;
      facts.fire = info.fire;
      if (info.sdf.length) facts.sdf = info.sdf.map((s) => ({ kind: s.kind as SdfKind, name: s.name }));
    }
  }
}

/** Forget everything (tests). */
export function clearRealAreas(): void {
  regionOf.clear();
  loaded.clear();
  wanted.clear();
}

/** Region whose data cover the cell, or undefined. */
export function realRegionOf(cell: CellId): string | undefined {
  return regionOf.get(cell);
}

export function hasRealData(cell: CellId): boolean {
  return regionOf.has(cell);
}

/** The loaded data of a cell (undefined: none, or not loaded yet). */
export function realAreaOf(cell: CellId): RealArea | undefined {
  const a = loaded.get(cell);
  if (a) {
    loaded.delete(cell);
    loaded.set(cell, a); // most recent last
  }
  return a;
}

/** True while a cell has data that have not arrived; asks for them. */
export function realPending(cell: CellId): boolean {
  if (!regionOf.has(cell) || loaded.has(cell)) return false;
  wanted.add(cell);
  return true;
}

/** Ask for a cell's data ahead of time (the neighbours of the player). */
export function requestRealArea(cell: CellId): void {
  if (regionOf.has(cell) && !loaded.has(cell)) wanted.add(cell);
}

/** Cells asked for and not loaded (the app's loader takes them). */
export function takeRealRequests(): CellId[] {
  const out = [...wanted];
  wanted.clear();
  return out;
}

export function provideRealArea(area: RealArea): void {
  loaded.delete(area.cell); // most recent last (a Map keeps the first insertion's place otherwise)
  loaded.set(area.cell, area);
  wanted.delete(area.cell);
  while (loaded.size > KEEP) loaded.delete(loaded.keys().next().value!);
}
