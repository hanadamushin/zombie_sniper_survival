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
  /**
   * R1: leave out the municipal wide roads (LINE.wide, 13 m+; not national / prefectural roads) where the
   * 1 km census mesh under the road piece has at least this many people per km². In a dense city the
   * real grid of wide streets every ~100 m becomes roads every ~10 m in the shrunk area, a field of
   * asphalt; the town generator's own street lattice takes their place. Decided per tile piece (like the
   * sparse local roads), so both cells sharing a road agree. Off when undefined.
   */
  dropWideRoadsAbove?: number;
  /** Place names on the strategic map: municipality name -> shown name (not used by R0). */
  names?: Record<string, string>;
}
