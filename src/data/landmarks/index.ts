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

/**
 * L6: the tables by region, in the strategic map's region order (grid.json `region`). Each region has
 * its own landmark yard (`?landmarks=<name>`, sim/tactical/yard.ts): all of them no longer fit in one.
 */
export const LANDMARK_REGIONS: readonly { name: string; spots: readonly LandmarkSpot[] }[] = [
  { name: 'hokkaido', spots: LANDMARKS_HOKKAIDO },
  { name: 'tohoku', spots: LANDMARKS_TOHOKU },
  { name: 'kanto', spots: LANDMARKS_KANTO },
  { name: 'chubu', spots: LANDMARKS_CHUBU },
  { name: 'kinki', spots: LANDMARKS_KINKI },
  { name: 'chugoku', spots: LANDMARKS_CHUGOKU },
  { name: 'shikoku', spots: LANDMARKS_SHIKOKU },
  { name: 'kyushu', spots: LANDMARKS_KYUSHU },
];

export const LANDMARKS: readonly LandmarkSpot[] = LANDMARK_REGIONS.flatMap((r) => r.spots);

const MEMORIAL = new Set(LANDMARKS.filter((s) => s.memorial).map((s) => s.id));
/** L6: a landmark type the table marks as a place of remembrance (types.ts `memorial`). */
export function isMemorialLandmark(id: string): boolean {
  return MEMORIAL.has(id);
}

/**
 * The equirectangular grid of the strategic map (public/data/grid.json `proj`, tools/real/grid.ts):
 * cell = row × gridW + column, rows from latTop southwards, columns from lon0 eastwards, cellKm each.
 * tests/landmarks.test.ts checks it against grid.json.
 */
export const LANDMARK_GRID = { lon0: 127.5, latTop: 45.6, kmPerLon: 90.06, kmPerLat: 110.95, cellKm: 10, gridW: 167 } as const;
