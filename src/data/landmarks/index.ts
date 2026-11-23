// L1: every region's landmark table (types.ts). Add lines to your region's file, never here.

import type { LandmarkSpot } from './types.ts';
import { LANDMARKS_HOKKAIDO } from './hokkaido.ts';
import { LANDMARKS_TOHOKU } from './tohoku.ts';
import { LANDMARKS_KANTO } from './kanto.ts';
import { LANDMARKS_CHUBU } from './chubu.ts';
import { LANDMARKS_KINKI } from './kinki.ts';
import { LANDMARKS_CHUGOKU } from './chugoku.ts';
import { LANDMARKS_SHIKOKU } from './shikoku.ts';
import { LANDMARKS_KYUSHU } from './kyushu.ts';

export type { LandmarkSpot } from './types.ts';

export const LANDMARKS: readonly LandmarkSpot[] = [
  ...LANDMARKS_HOKKAIDO, ...LANDMARKS_TOHOKU, ...LANDMARKS_KANTO, ...LANDMARKS_CHUBU,
  ...LANDMARKS_KINKI, ...LANDMARKS_CHUGOKU, ...LANDMARKS_SHIKOKU, ...LANDMARKS_KYUSHU,
];

/**
 * The equirectangular grid of the strategic map (public/data/grid.json `proj`, tools/real/grid.ts):
 * cell = row × gridW + column, rows from latTop southwards, columns from lon0 eastwards, cellKm each.
 * tests/landmarks.test.ts checks it against grid.json.
 */
export const LANDMARK_GRID = { lon0: 127.5, latTop: 45.6, kmPerLon: 90.06, kmPerLat: 110.95, cellKm: 10, gridW: 167 } as const;
