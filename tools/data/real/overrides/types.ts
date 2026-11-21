// Hand corrections of a region's real-map data (R1..R8 each edit only their own file).
// See docs/realmap_guide.md §6.
import type { RealPoi } from '../../../../src/gen/real/format.ts';

export interface CellOverride {
  /** Multiplies the height compression of this cell (src/data/realmap.ts REAL_AREA.height): < 1 flatter, > 1 steeper. */
  heightMul?: number;
  /** Drop points whose name contains one of these strings (wrong / duplicate annotations). */
  dropPois?: string[];
  /** Extra or corrected points (area-local game metres; see POI kinds in src/gen/real/format.ts). */
  addPois?: RealPoi[];
  /** Rename points: annotation name -> name shown. */
  renamePois?: Record<string, string>;
  /** Drop local (narrow) roads from the data: the town generator draws its own streets. */
  dropLocalRoads?: boolean;
  /** Share 0..1 of the durable-building cover to keep (thins tall buildings when a cell is too heavy). */
  durableMul?: number;
}

export interface RegionOverrides {
  /** Multiplies the height compression of every cell of the region. */
  heightMul?: number;
  /** By cell id (the number in public/data/areas/<region>/<cell>.bin). */
  cells?: Record<number, CellOverride>;
  /** Place names on the strategic map: municipality name -> shown name (not used by R0). */
  names?: Record<string, string>;
}
