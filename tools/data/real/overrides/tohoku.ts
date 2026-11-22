// Hand corrections of the real-map data of Tohoku (R2). Format: tools/data/real/overrides/types.ts,
// docs/realmap_guide.md §6. Positions are area-local game metres (the real 10 km square shrunk 1/10).
import type { CellOverride, RegionOverrides } from './types.ts';

const cells: Record<number, CellOverride> = {};

// Dense cities (Sendai...): the municipal wide-street grid would pave the town over. Same value as
// Hokkaido (R1); Kanto (R3) and Chubu (R4) share land borders with Tohoku and should use it too.
export const OVERRIDES: RegionOverrides = { dropWideRoadsAbove: 4000, cells };
