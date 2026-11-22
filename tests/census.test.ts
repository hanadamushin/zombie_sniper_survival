// 07d-3: every building type of the catalog stands somewhere in Japan. The nationwide scan of all
// 4,108 real areas takes minutes (tools/real/census.ts, 4 worker threads), so it writes its counts to
// tests/data/census.json and this test reads them; sample cells are regenerated here to make sure the
// file is up to date (rerun `node tools/real/census.ts --out tests/data/census.json` after changing
// the placement rules).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS } from '../src/gen/buildings/index.ts';
import { censusCell, typesHash } from '../tools/real/census.ts';

interface Census {
  seed: number;
  cells: number;
  types: Record<string, number>;
  perCell: Record<string, [number, number]>;
}
const FILE = new URL('./data/census.json', import.meta.url);
const census: Census = JSON.parse(readFileSync(FILE, 'utf8'));
/** The colony's own buildings (06: placed by the player's base, not by the area generator). */
const colonyOnly = (id: string): boolean => id.startsWith('base.') && !id.startsWith('base.j');
/** Sendai, Tokyo, Shin-Chitose, a village, Yokosuka, Utsunomiya, Kure, Misawa. */
const SAMPLES = [13647, 18480, 5304, 22758, 19147, 16811, 21087, 9142];

describe('07d-3 census of the buildings of all real areas', () => {
  it('covers every land cell with an area file', () => {
    expect(existsSync(FILE)).toBe(true);
    expect(census.cells).toBe(4108);
    expect(Object.keys(census.perCell)).toHaveLength(4108);
  });

  it('every building type of the catalog stands in at least one area', () => {
    const missing = BUILDING_DEFS.filter((d) => !colonyOnly(d.id) && !(census.types[d.id]! > 0)).map((d) => d.id);
    expect(missing).toEqual([]);
  });

  it('is up to date: sample cells regenerate to the same buildings', { timeout: 60_000 }, () => {
    for (const cell of SAMPLES) {
      const row = censusCell(cell);
      expect([row.placements, typesHash(row.types)], `cell ${cell}`).toEqual(census.perCell[cell]);
    }
  });
});
