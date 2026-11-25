// L10: the ordinary bridges (category 'landmark' for their drawing: exterior only, out to the fog;
// they are not in the landmark table). defs/landmark/ordinary_bridge.ts.

import type { BuildingDef } from '../types.ts';
import { ORDINARY_BRIDGES_DEFS } from '../defs/landmark/ordinary_bridge.ts';

export const LANDMARK_BRIDGES: readonly BuildingDef[] = [...ORDINARY_BRIDGES_DEFS];
