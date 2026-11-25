// L9: the bridge landmarks laid from bank to bank (docs/realmap_guide.md §7, L9). The table's lines
// and designs; in each real area a bridge's line crosses: the bridge stands there, the area's roads no
// longer run along its deck on an embankment, nothing is built on its deck, the player walks it from
// end to end both ways without going into the water, the walk grid lets the dead through, and two
// areas sharing a bridge raise the same ground on their common edge.
import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { createInitialState, emptyInputFrame } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { LANDMARKS } from '../src/data/landmarks/index.ts';
import { bridgeDesign, bridgeLayout, pathFrame } from '../src/gen/buildings/defs/landmark/bridge.ts';
import { blueprintOf, buildingDef, triangleCount } from '../src/gen/buildings/index.ts';
import { bridgesIn, realInCell } from '../src/gen/real/bridges.ts';
import { realToArea } from '../src/gen/real/landmarks.ts';
import type { TacticalMap } from '../src/gen/types.ts';
import { heightAt, supportAt, waterDepthAt } from '../src/sim/tactical/collision.ts';
import { placePlayer, updatePlayer } from '../src/sim/tactical/player.ts';
import { yardEntries, yardMap } from '../src/sim/tactical/yard.ts';
import { LANDMARK_REGIONS } from '../src/data/landmarks/index.ts';
import { clearRealAreas } from '../src/sim/world/realAreas.ts';
import { mapFor } from '../tools/real/check.ts';
import { loadGrid, loadRealIndexes } from '../tools/real/lib/game.ts';

const DT = BALANCE.time.fixedStep;
const BRIDGES = LANDMARKS.filter((s) => s.bridge);

describe('the bridge landmarks of the table (L9)', () => {
  it('each has a design, a line of two points or more, its middle near the line', () => {
    expect(BRIDGES.length).toBeGreaterThanOrEqual(4);
    for (const s of BRIDGES) {
      const D = bridgeDesign(s.id);
      expect(D, s.id).toBeDefined();
      expect(buildingDef(s.id).exteriorOnly).toBe(true);
      expect(s.bridge!.path.length, s.id).toBeGreaterThanOrEqual(2);
      // The middle (the strategic map's mark) lies within 60 m (shrunk) of the line.
      const cell = realToArea(s.lat, s.lon).cell;
      const f = pathFrame(s.bridge!.path.map(([la, lo]) => realInCell(cell, la, lo)));
      const [mx, mz] = realInCell(cell, s.lat, s.lon);
      expect(f.project(mx, mz).dist, s.id).toBeLessThan(60);
      // The main structure stands on the line, and the deck meets the table's ends.
      const lay = bridgeLayout(D!, f.length, s.bridge!.ends, s.bridge!.water ?? 0);
      expect(lay.bounds[0]!, s.id).toBeGreaterThanOrEqual(0);
      expect(lay.bounds[lay.bounds.length - 1]!, s.id).toBeLessThanOrEqual(f.length);
      expect(lay.deck(0)).toBeCloseTo(s.bridge!.ends[0], 6);
      expect(lay.deck(f.length)).toBeCloseTo(s.bridge!.ends[1], 6);
      // The deck never rises faster than 0.5 m per metre (people walk it; the zombies' step).
      for (let x = 0; x + 0.5 <= f.length; x += 0.5) expect(Math.abs(lay.deck(x + 0.5) - lay.deck(x)), `${s.id} at ${x}`).toBeLessThan(0.5);
    }
  });

  it('counts its towers, anchorages and arches as the real ones', () => {
    const count = (id: string): number => bridgeDesign(id)!.spans.length;
    // Spans of the main structure: 3 for the suspension and cable-stayed bridges (two towers), 5 for the Kintai Bridge.
    expect(count('landmark.rainbow_bridge')).toBe(3);
    expect(count('landmark.akashi_kaikyo_bridge')).toBe(3);
    expect(count('landmark.aomori_bay_bridge')).toBe(3);
    expect(count('landmark.kintaikyo')).toBe(5);
    expect(bridgeDesign('landmark.kintaikyo')!.arches!.which).toEqual([1, 2, 3]);
  });
});

describe('the bridge landmarks in the landmark yards (L9)', () => {
  it('stand there whole (a straight line over a dug channel) within the triangle limit', () => {
    for (const [r, region] of LANDMARK_REGIONS.entries()) {
      const ids = new Set(region.spots.filter((s) => s.bridge).map((s) => s.id));
      if (ids.size === 0) continue;
      const map = yardMap(4, r);
      for (const e of yardEntries(4, r)) {
        if (!ids.has(e.def)) continue;
        const p = map.placements[e.enter]!;
        const bp = blueprintOf(p);
        expect(triangleCount(bp).shell, e.def).toBeLessThanOrEqual(buildingDef(e.def).limits?.shell ?? 6000);
      }
    }
  });
});

// The real areas.
const grid = loadGrid();
const regions = ['hokkaido', 'tohoku', 'kanto', 'chubu', 'kinki', 'chugoku', 'shikoku', 'kyushu'];
const haveCell = (c: number): boolean => existsSync(new URL(`../public/data/areas/${regions[grid.cells[c]?.region ?? -1] ?? 'none'}/${c}.bin`, import.meta.url));
if (regions.some((r) => existsSync(new URL(`../public/data/areas/${r}/index.json`, import.meta.url)))) loadRealIndexes(grid);
afterAll(() => clearRealAreas());

/** Every cell a bridge's line runs through (around its middle's cell). */
function cellsOf(id: string): number[] {
  const s = BRIDGES.find((q) => q.id === id)!;
  const mid = realToArea(s.lat, s.lon).cell;
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const c = mid + dy * grid.gridW + dx;
    if (haveCell(c) && bridgesIn(c).some((b) => b.spot.id === id)) out.push(c);
  }
  return out;
}

/** Walk the player along the deck from `from` to `to` (m along the line), `lane` m off its middle. */
function walk(map: TacticalMap, id: string, cell: number, from: number, to: number, lane: number): { reached: number; wet: number; low: number } {
  const br = bridgesIn(cell).find((b) => b.spot.id === id)!;
  const pl = createInitialState(1, 1).player;
  const dir = to > from ? 1 : -1;
  const a = br.f.at(from);
  placePlayer(pl, map, a.x + a.nx * lane - a.tx * dir * 4, a.z + a.nz * lane - a.tz * dir * 4, 0);
  pl.pos[1] = supportAt(map, pl.pos[0], pl.pos[2], heightAt(map, pl.pos[0], pl.pos[2]) + 0.5);
  let wet = 0;
  let low = 0;
  let s = from;
  for (let t = 0; t < 900 / DT && Math.abs(s - to) > 2; t++) {
    const q = br.f.project(pl.pos[0], pl.pos[2]);
    s = q.s;
    const g = br.f.at(Math.min(br.f.length, Math.max(0, s + dir * 6)));
    pl.yaw = Math.atan2(-(g.x + g.nx * lane - pl.pos[0]), -(g.z + g.nz * lane - pl.pos[2]));
    updatePlayer(pl, map, { ...emptyInputFrame(), moveZ: 1 }, DT);
    if (waterDepthAt(map, pl.pos[0], pl.pos[2], pl.pos[1]) > 0.3) wet++;
    // Never far under the deck (fallen off it) while on the bridge.
    if (s > 1 && s < br.f.length - 1 && pl.pos[1] < br.lay.deck(s) - 1.2) low++;
  }
  return { reached: s, wet, low };
}

const LANES: Record<string, number> = { 'landmark.aomori_bay_bridge': 5, 'landmark.rainbow_bridge': 5, 'landmark.akashi_kaikyo_bridge': 4, 'landmark.kintaikyo': 0, 'landmark.onaruto_bridge': 4, 'landmark.kanmon_bridge': 4 };

describe.each(BRIDGES.map((s) => s.id))('%s in its real areas (L9)', (id) => {
  const cells = cellsOf(id);
  it.skipIf(cells.length === 0)('stands from bank to bank, its deck walked both ways, the dead let through, no embankment or building on it', { timeout: 600_000 }, () => {
    const maps = new Map(cells.map((c) => [c, mapFor(grid, c)]));
    // Every stretch of the line is built by one area (the stretches meet exactly).
    const stretches = cells.map((c) => bridgesIn(c).find((b) => b.spot.id === id)!).map((b) => [b.from, b.to] as const).sort((p, q) => p[0] - q[0]);
    expect(stretches[0]![0]).toBe(0);
    for (let k = 1; k < stretches.length; k++) expect(stretches[k]![0]).toBeCloseTo(stretches[k - 1]![1], 6);
    const full = bridgesIn(cells[0]!).find((b) => b.spot.id === id)!;
    expect(stretches[stretches.length - 1]![1]).toBeCloseTo(full.f.length, 6);
    for (const c of cells) {
      const map = maps.get(c)!;
      const br = bridgesIn(c).find((b) => b.spot.id === id)!;
      const p = map.placements.find((q) => q.def === id);
      expect(p, `${id} in ${c}`).toBeDefined();
      expect(p!.span!.from).toBeCloseTo(br.from, 6);
      // No road or railway runs along the deck any more (its embankment is gone).
      for (const r of map.roads) {
        for (let k = 0; k + 1 < r.pts.length; k++) {
          const [ax, az] = r.pts[k]!;
          const [bx, bz] = r.pts[k + 1]!;
          const len = Math.hypot(bx - ax, bz - az);
          if (len < 0.5) continue;
          const q = br.f.project((ax + bx) / 2, (az + bz) / 2);
          if (q.s < 3 || q.s > br.f.length - 3 || Math.abs(q.off) > br.hw - 1 || Math.abs(q.off) < q.dist - 0.01) continue;
          const t = br.f.at(q.s);
          expect(Math.abs(((bx - ax) * t.tx + (bz - az) * t.tz) / len), `${id} in ${c}: a road along the deck at s ${q.s.toFixed(1)}`).toBeLessThan(0.8);
        }
      }
      // Nothing is built on the deck.
      for (const b of map.buildings) {
        const q = br.f.project((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
        expect(q.dist > br.hw || q.s < 0.5 || q.s > br.f.length - 0.5, `${id} in ${c}: building ${b.id} on the deck`).toBe(true);
      }
      // The walk grid: along the deck's middle every tile is walked (the dead come across).
      for (let s = Math.max(br.from, 2); s <= Math.min(br.to, br.f.length - 2); s += 2) {
        const q = br.f.at(s);
        const lane = LANES[id] ?? 0;
        const x = q.x + q.nx * lane;
        const z = q.z + q.nz * lane;
        if (x < 0 || z < 0 || x >= map.size || z >= map.size) continue;
        expect(map.walk[Math.floor(z / map.tile) * map.tiles + Math.floor(x / map.tile)], `${id} in ${c}: tile at s ${s.toFixed(0)}`).toBe(1);
      }
      // The player walks the stretch of this area both ways: never in the water, never fallen under the deck.
      const lane = LANES[id] ?? 0;
      const inner = (s: number): number => Math.min(br.to, Math.max(br.from, s));
      const [a, b] = [inner(br.from + (br.from > 0 ? 3 : 0)), inner(br.to - (br.to < br.f.length ? 3 : 0))];
      for (const [x, y, side] of [[a, b, lane], [b, a, lane], [a, b, -lane]] as const) {
        const w = walk(map, id, c, x, y, side);
        expect(Math.abs(w.reached - y), `${id} in ${c}: from ${x.toFixed(0)} towards ${y.toFixed(0)} (lane ${side}) stopped at ${w.reached.toFixed(1)}`).toBeLessThan(2.5);
        expect(w.wet, `${id} in ${c}: in the water`).toBe(0);
        expect(w.low, `${id} in ${c}: under the deck`).toBe(0);
      }
    }
    // Two areas sharing the bridge: the same ground on their common edge.
    for (const c of cells) {
      for (const d of cells) {
        if (d !== c + grid.gridW) continue;
        const A = maps.get(c)!;
        const B = maps.get(d)!;
        const n = A.n;
        let worst = 0;
        for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(A.height[(n - 1) * n + i]! - B.height[i]!));
        expect(worst, `${id}: edge ${c}/${d}`).toBeLessThan(0.01);
      }
    }
  });
});
