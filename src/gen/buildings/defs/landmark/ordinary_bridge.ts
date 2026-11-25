// L10: the ordinary bridges of the real areas (docs/realmap_guide.md §7, L10): a concrete girder
// bridge on piers for a road, a steel plate girder for a railway, laid by gen/real/bridges.ts along
// the rows of src/data/bridges/ordinary.ts wherever a road or railway crosses water 30 m wide or more
// (the shrunk area's). The deck's width and tracks are the row's (BridgeSpan.deck); here only what
// every ordinary bridge shares. Not landmarks of the table: they have no name on the strategic map.
//
// Carried as 'water': over the water the bridge's hidden boxes carry the walkers and the water and
// its bed stay under the deck (2 m of air under the slab: bullets and eyes pass under it, people wade
// under it); on the land its ramps are earth (the ground is raised to the deck: the town's streets
// climb over it). Piers every 7 m of the shrunk area (spans of about 70 m), in the water only.

import { bridgeDef } from './bridge.ts';

export const ORDINARY_BRIDGE_ROAD = bridgeDef({
  variant: 'ordinary_bridge_road',
  spans: [1],
  fit: 0,
  main: 'girder',
  carry: 'water',
  deck: { width: 12.2, thick: 1, top: 'charcoal', side: 'stone', parapet: 0.9, parapetPaint: 'offWhite', lines: [0] },
  profile: { clear: 3, slope: 0.1 },
  piers: { every: 7, paint: 'stone', columns: 2, size: 1.2 },
  yard: { length: 60, depth: 24, water: [14, 46] },
});

export const ORDINARY_BRIDGE_RAIL = bridgeDef({
  variant: 'ordinary_bridge_rail',
  spans: [1],
  fit: 0,
  main: 'girder',
  carry: 'water',
  deck: { width: 9, thick: 1.2, top: 'stone', side: 'rust', parapet: 0.6, parapetPaint: 'rust', rails: [-1.9, 1.9] },
  profile: { clear: 3, slope: 0.1 },
  piers: { every: 7, paint: 'gray', columns: 1, size: 1.6 },
  yard: { length: 60, depth: 24, water: [14, 46] },
});

/** The ordinary bridges' building types (not in the landmark table). */
export const ORDINARY_BRIDGES_DEFS = [ORDINARY_BRIDGE_ROAD, ORDINARY_BRIDGE_RAIL] as const;
export const ORDINARY_BRIDGE_IDS: ReadonlySet<string> = new Set(ORDINARY_BRIDGES_DEFS.map((d) => d.id));
