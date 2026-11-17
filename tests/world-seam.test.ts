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

// ---------------------------------------------------------------------------------------------
// Walking across (07c)
// ---------------------------------------------------------------------------------------------

import { emptyInputFrame, type GameState, type InputFrame } from '../src/core/types.ts';
import type { GameEvent } from '../src/core/events.ts';
import { BALANCE } from '../src/data/balance.ts';
import { createSim } from '../src/sim/index.ts';
import { areaOf, mapOf } from '../src/sim/tactical/area.ts';
import { addZombie } from '../src/sim/tactical/zombies.ts';
import { beginAt } from '../src/sim/world/start.ts';

const DT = BALANCE.time.fixedStep;

function gameAt(cell: number): { s: GameState; sim: ReturnType<typeof createSim>; events: GameEvent[] } {
  const s = createInitialState(12, 1);
  initWorld(s, grid, scenario);
  beginAt(s, grid, cell);
  const sim = createSim({ grid });
  const events: GameEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.tick(s, DT, emptyInputFrame());
  s.mode = 'tactical';
  s.tactical!.zombies.length = 0;
  areaOf(s)!.dynamic.clear();
  return { s, sim, events };
}

/** Face along (dx, dz) and walk until the cell changes or `seconds` pass. */
function walk(g: ReturnType<typeof gameAt>, dx: number, dz: number, seconds: number): void {
  g.s.player.yaw = Math.atan2(-dx, -dz);
  const input: InputFrame = { ...emptyInputFrame(), moveZ: 1, sprint: true };
  const start = g.s.player.cell;
  for (let i = 0; i < seconds / DT && g.s.player.cell === start; i++) {
    g.s.player.stamina = 100;
    g.sim.tick(g.s, DT, input);
  }
}

describe('walking into the next cell (07c)', () => {
  const w = grid.gridW;
  // A rural or forest cell with land to the east, and one with the sea to the east.
  const inland = grid.landIds.find((id) => ['rural', 'forest'].includes(grid.cells[id]!.land) && grid.cells[id + 1] && grid.cells[id - 1] && grid.cells[id + w] && grid.cells[id - w] && grid.cells[id + 1 + w] && grid.cells[id + 1 - w])!;
  const coast = grid.landIds.find((id) => ['rural', 'forest'].includes(grid.cells[id]!.land) && !grid.cells[id + 1] && id % w !== w - 1 && grid.cells[id - 1])!;

  it('walking east over the edge puts the player in the east neighbour, on the same ground, and back again', { timeout: 120_000 }, () => {
    const g = gameAt(inland);
    const p = g.s.player;
    const S = TACTICAL.size;
    // Next to the east edge, on walkable ground.
    const map = mapOf(g.s)!;
    let z0 = 500;
    while (z0 < 900 && !map.walk[Math.floor(z0 / 4) * 256 + 254]) z0 += 4;
    p.pos = [S - 6, heightAt(map, S - 6, z0), z0];
    const firstArea = g.s.tactical!;
    // A zombie chasing the player comes along.
    const chaser = addZombie(g.s, areaOf(g.s)!, 'walker', S - 30, z0, -Math.PI / 2)!;
    chaser.state = 'chase';
    chaser.target = 'player';
    walk(g, 1, 0, 20);
    expect(p.cell).toBe(inland + 1);
    expect(g.s.tactical!.cell).toBe(inland + 1);
    expect(mapOf(g.s)!.params.mapSeed).toBe(areaParams(g.s, grid, inland + 1)!.mapSeed);
    expect(p.pos[0]).toBeGreaterThanOrEqual(-0.01);
    expect(p.pos[0]).toBeLessThan(2);
    // Same ground: the height under the feet did not jump.
    expect(Math.abs(p.pos[1] - heightAt(mapOf(g.s)!, p.pos[0], p.pos[2]))).toBeLessThan(0.6);
    expect(g.events.some((e) => e.type === 'cellEntered' && e.cell === inland + 1 && e.from === inland && e.walked === true)).toBe(true);
    expect(g.s.world.cells.visited[inland + 1]).toBe(true);
    expect(g.s.tactical!.zombies.some((z) => z.id === chaser.id)).toBe(true);
    expect(firstArea.zombies.some((z) => z.id === chaser.id)).toBe(false);
    // Turn round: back in the first cell, the very same area (bodies, searched spots) as it was left.
    g.s.tactical!.zombies.length = 0;
    walk(g, -1, 0, 20);
    expect(p.cell).toBe(inland);
    expect(g.s.tactical).toBe(firstArea);
    expect(p.pos[0]).toBeGreaterThan(S - 2);
  });

  it('the edge towards the sea stays shut', { timeout: 60_000 }, () => {
    const g = gameAt(coast);
    const p = g.s.player;
    const map = mapOf(g.s)!;
    p.pos = [TACTICAL.size - 8, heightAt(map, TACTICAL.size - 8, 512), 512];
    walk(g, 1, 0, 15);
    expect(p.cell).toBe(coast);
    expect(p.pos[0]).toBeLessThanOrEqual(TACTICAL.size - TACTICAL.player.edgeMargin + 1e-6);
  });
});

import { nearestSupply, supplyPoints } from '../src/sim/world/outposts.ts';

describe('where to get ammunition (07c)', () => {
  it('points from the next cell back to the headquarters: direction and distance on foot', { timeout: 60_000 }, () => {
    const w = grid.gridW;
    const inland = grid.landIds.find((id) => ['rural', 'forest'].includes(grid.cells[id]!.land) && grid.cells[id + 1] && grid.cells[id - 1] && grid.cells[id + w] && grid.cells[id - w])!;
    const g = gameAt(inland);
    const home = supplyPoints(g.s).find((p) => p.kind === 'home')!;
    expect(home.cell).toBe(inland);
    expect(home.ammo).toBe(Math.floor(g.s.colony.stock.ammo));
    // In the base cell: B works here, no hint.
    expect(nearestSupply(g.s)).toBeNull();
    // 200 m into the east neighbour: the headquarters lies to the west, a little over 200 m + the rest of the area away.
    g.s.player.cell = inland + 1;
    g.s.player.pos = [200, 0, home.pos[1]];
    g.s.player.yaw = 0; // looking north
    const hint = nearestSupply(g.s)!;
    expect(hint.point.kind).toBe('home');
    expect(hint.dir).toBe('W');
    expect(hint.dist).toBeCloseTo(TACTICAL.size + 200 - home.pos[0], 6);
    expect(hint.turn).toBeCloseTo(Math.PI / 2, 6); // to the left
  });
});
