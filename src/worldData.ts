// Loads the generated map data (public/data/**). App-level: the sim itself never fetches.

import type { StaticGrid } from './core/types.ts';
import { parseGrid, type GridFile } from './sim/world/grid.ts';
import { decodeScenario, type ScenarioData } from './sim/world/scenario.ts';

const base = `${import.meta.env.BASE_URL}data/`;
let gridPromise: Promise<StaticGrid> | null = null;
const scenarios = new Map<number, Promise<ScenarioData>>();

async function get(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

/** The static grid (cached; a failed request can be retried). */
export function loadGrid(): Promise<StaticGrid> {
  gridPromise ??= get(`${base}grid.json`)
    .then((res) => res.json() as Promise<GridFile>)
    .then(parseGrid)
    .catch((err: unknown) => {
      gridPromise = null;
      throw err;
    });
  return gridPromise;
}

/** One bundled infection scenario (cached). */
export function loadScenario(n: number): Promise<ScenarioData> {
  let p = scenarios.get(n);
  if (!p) {
    p = get(`${base}infection_${n}.bin`)
      .then((res) => res.arrayBuffer())
      .then(decodeScenario)
      .catch((err: unknown) => {
        scenarios.delete(n);
        throw err;
      });
    scenarios.set(n, p);
  }
  return p;
}
