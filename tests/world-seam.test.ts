// 07c: neighbouring operation areas meet — the ground along a shared edge is the same on both sides,
// and roads that leave one map enter the next at the same point.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createInitialState, type StaticGrid } from '../src/core/types.ts';
import { TACTICAL } from '../src/data/tactical.ts';
import { generateTacticalMap, GROUND, type TacticalMap } from '../src/gen/index.ts';
import { gatesOf } from '../src/gen/world.ts';
import { areaParams } from '../src/sim/tactical/area.ts';
import { heightAt } from '../src/sim/tactical/collision.ts';
import { parseGrid, type GridFile } from '../src/sim/world/grid.ts';
import { decodeScenario, initWorld } from '../src/sim/world/scenario.ts';

const DATA = new URL('../public/data/', import.meta.url);
const grid: StaticGrid = parseGrid(JSON.parse(readFileSync(new URL('grid.json', DATA), 'utf8')) as GridFile);
const scenario = (() => {
  const buf = readFileSync(new URL('infection_0.bin', DATA));
  return decodeScenario(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
})();
const S = TACTICAL.size;
const state = createInitialState(12, 1);
initWorld(state, grid, scenario);
const mapOfCell = (cell: number): TacticalMap => generateTacticalMap(areaParams(state, grid, cell)!);

/** Land cells whose east and south neighbours are land too, of different kinds where possible. */
function pairs(): [number, number, number][] {
  const out: [number, number, number][] = [];
  const w = grid.gridW;
  const want = new Set<string>();
  for (const id of grid.landIds) {
    const east = grid.cells[id + 1];
    const south = grid.cells[id + w];
    if (!east || !south || id % w === w - 1) continue;
    const key = `${grid.cells[id]!.land}-${east.land}-${south.land}`;
    if (want.has(key)) continue;
    want.add(key);
    out.push([id, id + 1, id + w]);
    if (out.length >= 10) break;
  }
  return out;
}

describe('neighbouring areas meet (07c)', () => {
  it('the ground along a shared edge is the same height on both sides, every 4 m', { timeout: 120_000 }, () => {
    for (const [here, east, south] of pairs()) {
      const a = mapOfCell(here);
      const e = mapOfCell(east);
      const s = mapOfCell(south);
      let worst = 0;
      for (let t = 0; t <= S; t += TACTICAL.tile) {
        worst = Math.max(worst, Math.abs(heightAt(a, S, t) - heightAt(e, 0, t)), Math.abs(heightAt(a, t, S) - heightAt(s, t, 0)));
      }
      expect(worst, `${a.params.land}|${e.params.land}/${s.params.land}`).toBeLessThan(1e-3);
      // The coarse surroundings of one map follow the neighbour's ground too (within the 64 m sampling).
      const ac = TACTICAL.apronCell;
      const rings = TACTICAL.apronRings;
      for (let j = 0; j <= S / ac; j += 4) {
        const i = S / ac + 2; // 128 m past the east edge
        const coarse = a.apron[(j + rings) * a.apronN + (i + rings)]!;
        expect(Math.abs(coarse - heightAt(e, 2 * ac, j * ac)), 'apron').toBeLessThan(6);
      }
    }
  });

  it('roads cross a shared edge at the same point from both sides', { timeout: 120_000 }, () => {
    let crossings = 0;
    for (const [here, east, south] of pairs()) {
      const a = mapOfCell(here);
      for (const [other, side, back] of [[east, 1, 0], [south, 3, 2]] as const) {
        const b = mapOfCell(other);
        const ga = gatesOf(a.params).find((g) => g.side === side);
        const gb = gatesOf(b.params).find((g) => g.side === back);
        expect(Boolean(ga), 'both sides agree on the gate').toBe(Boolean(gb));
        if (!ga || !gb) continue;
        crossings++;
        const along = side === 1 ? 1 : 0;
        expect(gb.pos[along]).toBeCloseTo(ga.pos[along], 6);
        // Town grids keep their own streets; in the countryside a road reaches the gate on both maps.
        const town = (m: TacticalMap): boolean => m.params.land === 'urban' || m.params.land === 'suburb';
        if (town(a) || town(b)) continue;
        const tileAt = (m: TacticalMap, x: number, z: number): number => m.ground[Math.min(255, Math.floor(z / 4)) * 256 + Math.min(255, Math.floor(x / 4))]!;
        const onRoad = (m: TacticalMap, x: number, z: number): boolean => [GROUND.road, GROUND.track].includes(tileAt(m, x, z) as 1 | 2);
        expect(onRoad(a, Math.min(S - 1, ga.pos[0]), Math.min(S - 1, ga.pos[1])), `${a.params.land} at its gate`).toBe(true);
        expect(onRoad(b, Math.min(S - 1, gb.pos[0]), Math.min(S - 1, gb.pos[1])), `${b.params.land} at its gate`).toBe(true);
      }
    }
    expect(crossings).toBeGreaterThan(5);
  });
});
