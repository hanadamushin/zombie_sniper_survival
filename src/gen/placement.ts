// 07d-3: choosing the enterable building type of a lot from the district mixes (src/data/placement.ts).
// Shared by the real-map layout (gen/real/layout.ts) and the random layouts (gen/lands.ts).

import { rand, randRange, type RngState } from '../core/rng.ts';
import { AREA_CAP, COAST, HILLS, METRO_CAP_MUL, MIX, type District } from '../data/placement.ts';
import { buildingDef } from './buildings/catalog/index.ts';
import type { Land } from '../core/types.ts';

/** District of a point: its town grade (1..4), the municipality grade of the cell (1..5) and the cell's land class. */
export function districtOf(grade: number, muni: number, land: Land): District {
  if (grade >= 4) return muni >= 4 || land === 'urban' ? 'core' : 'mid';
  if (grade === 3) return 'mid';
  if (grade === 2) return 'dense';
  if (land === 'rural' || land === 'forest' || land === 'mountain' || muni <= 1) return 'rural';
  return 'suburb';
}

/** Per-area tally of the types placed (caps of AREA_CAP). */
export interface TypeTally {
  counts: Map<string, number>;
  /** Designated-city core: caps × METRO_CAP_MUL. */
  metro: boolean;
}
export function newTally(metro = false): TypeTally {
  return { counts: new Map(), metro };
}
export function tallyAdd(t: TypeTally, id: string): void {
  t.counts.set(id, (t.counts.get(id) ?? 0) + 1);
}
function capped(t: TypeTally, id: string): boolean {
  const cap = AREA_CAP[id];
  if (cap === undefined) return false;
  return (t.counts.get(id) ?? 0) >= cap * (t.metro ? METRO_CAP_MUL : 1);
}

export interface Pick {
  id: string;
  /** Local frontage and depth (within the type's size range and the lot). */
  w: number;
  d: number;
}

export interface PickOptions {
  /** Near the sea / in the hills (forest, mountain cells): the seaside and hill types join the mix. */
  coast?: boolean;
  hills?: boolean;
  /** Prefer the smaller sizes (rows of houses: more of them along a street). */
  small?: boolean;
  /** Leave these types out. */
  except?: (id: string) => boolean;
}

const mixCache = new Map<string, [string, number][]>();
function mixOf(district: District, coast: boolean, hills: boolean): [string, number][] {
  const key = `${district}:${coast ? 1 : 0}:${hills ? 1 : 0}`;
  let list = mixCache.get(key);
  if (list) return list;
  const m: Record<string, number> = { ...MIX[district] };
  const add = (extra: Record<string, number>): void => {
    for (const [id, w] of Object.entries(extra)) m[id] = (m[id] ?? 0) + w;
  };
  if (coast && (district === 'rural' || district === 'suburb')) add(district === 'rural' ? COAST.rural : COAST.suburb);
  if (hills && district === 'rural') add(HILLS);
  list = Object.entries(m);
  mixCache.set(key, list);
  return list;
}

/**
 * A type for a lot of `lw` (frontage) × `ld` (depth) metres: drawn by weight among the district's
 * types whose smallest size fits and whose area cap is not reached. Null when nothing fits.
 */
export function pickType(rng: RngState, district: District, lw: number, ld: number, tally: TypeTally, opts: PickOptions = {}): Pick | null {
  const cands: [string, number][] = [];
  let total = 0;
  for (const [id, wt] of mixOf(district, opts.coast === true, opts.hills === true)) {
    const def = buildingDef(id);
    if (def.size.w[0] > lw + 1e-6 || def.size.d[0] > ld + 1e-6) continue;
    if (capped(tally, id) || opts.except?.(id)) continue;
    cands.push([id, wt]);
    total += wt;
  }
  if (total <= 0) return null;
  let r = rand(rng) * total;
  let id = cands[cands.length - 1]![0];
  for (const [cid, wt] of cands) {
    r -= wt;
    if (r < 0) {
      id = cid;
      break;
    }
  }
  const def = buildingDef(id);
  const wMax = Math.min(lw, def.size.w[1]);
  const dMax = Math.min(ld, def.size.d[1]);
  const t = opts.small ? 0.35 : 1;
  const w = randRange(rng, def.size.w[0], def.size.w[0] + (wMax - def.size.w[0]) * t);
  const d = randRange(rng, def.size.d[0], def.size.d[0] + (dMax - def.size.d[0]) * t);
  return { id, w, d };
}
