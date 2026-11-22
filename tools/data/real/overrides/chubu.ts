// Hand corrections of the real-map data of Chubu (R4). Format: tools/data/real/overrides/types.ts,
// docs/realmap_guide.md §6. Positions are area-local game metres (the real 10 km square shrunk 1/10).
import type { RegionOverrides } from './types.ts';

// Dense cities (Nagoya, Niigata, Shizuoka, Hamamatsu): the municipal wide-street grid would pave the town
// over. Same value as Hokkaido / Tohoku / Kanto: Chubu borders Tohoku and Kanto by land, edge decisions must agree.
export const OVERRIDES: RegionOverrides = { dropWideRoadsAbove: 4000 };
