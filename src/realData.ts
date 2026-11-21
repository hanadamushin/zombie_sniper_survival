// R0: loads the real-map area data (public/data/areas/<region>/...). App-level: the sim asks for
// cells (sim/world/realAreas.ts) and this module fetches, decompresses and decodes them.
//
//   await loadRealIndex(grid)   once, after the grid: which cells have data (and their facts)
//   pumpRealLoads()             every frame: start the downloads the sim has asked for

import type { StaticGrid } from './core/types.ts';
import { decodeRealArea } from './gen/real/format.ts';
import { addRealRegion, provideRealArea, realRegionOf, takeRealRequests, type RegionIndexFile } from './sim/world/realAreas.ts';

const base = `${import.meta.env.BASE_URL}data/areas/`;
const REGIONS = ['hokkaido', 'tohoku', 'kanto', 'chubu', 'kinki', 'chugoku', 'shikoku', 'kyushu'];
let indexPromise: Promise<void> | null = null;
const inFlight = new Set<number>();
/** Download and decode times (ms) of the last areas — perf checks. */
export const realLoadTimes: number[] = [];

/** Read the region indexes that exist (missing regions are simply not built yet). */
export function loadRealIndex(grid: StaticGrid): Promise<void> {
  indexPromise ??= Promise.all(
    REGIONS.map(async (region) => {
      try {
        const res = await fetch(`${base}${region}/index.json`);
        if (!res.ok) return;
        const type = res.headers.get('content-type') ?? '';
        if (type.includes('html')) return; // a dev server's fallback page, not an index
        addRealRegion((await res.json()) as RegionIndexFile, grid);
      } catch {
        // no data for this region: its areas stay random
      }
    }),
  ).then(() => undefined);
  return indexPromise;
}

async function gunzip(buf: ArrayBuffer): Promise<Uint8Array> {
  const bytes = new Uint8Array(buf);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes; // served already decompressed
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function load(cell: number): Promise<void> {
  const region = realRegionOf(cell);
  if (!region) return;
  const t0 = performance.now();
  try {
    const res = await fetch(`${base}${region}/${cell}.bin`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const area = decodeRealArea(await gunzip(await res.arrayBuffer()));
    provideRealArea(area);
    realLoadTimes.push(performance.now() - t0);
    if (realLoadTimes.length > 20) realLoadTimes.shift();
  } catch (err) {
    console.warn(`[real] area ${cell} failed`, err);
  } finally {
    inFlight.delete(cell);
  }
}

/** Start the downloads asked for since the last call (cheap when there are none). */
export function pumpRealLoads(): void {
  for (const cell of takeRealRequests()) {
    if (inFlight.has(cell)) continue;
    inFlight.add(cell);
    void load(cell);
  }
}
