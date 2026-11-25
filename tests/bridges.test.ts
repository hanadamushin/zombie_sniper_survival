// L9: the bridge landmarks laid from bank to bank (docs/realmap_guide.md §7, L9). The table's lines
// and designs; in each real area a bridge's line crosses: the bridge stands there, the area's roads no
// longer run along its deck on an embankment, nothing is built on its deck, the player walks it from
// end to end both ways without going into the water, the walk grid lets the dead through, and two
// areas sharing a bridge raise the same ground on their common edge.
import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { createInitialState, emptyInputFrame } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { LANDMARKS, LANDMARK_GRID } from '../src/data/landmarks/index.ts';
import { bridgeDesign, bridgeLayout, carryOf, pathFrame } from '../src/gen/buildings/defs/landmark/bridge.ts';
import { ORDINARY_BRIDGES } from '../src/data/bridges/ordinary.ts';
import { blueprintOf, buildingDef, triangleCount } from '../src/gen/buildings/index.ts';
import { bridgesIn, realInCell } from '../src/gen/real/bridges.ts';
import { realToArea } from '../src/gen/real/landmarks.ts';
import type { TacticalMap } from '../src/gen/types.ts';
import { heightAt, segmentHitsStatic, supportAt, waterDepthAt } from '../src/sim/tactical/collision.ts';
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
    // L10: the Seto-Ōhashi's six (suspension 3 · cable-stayed 2 · a truss of three spans) and the
    // Shimanami Kaidō's Kurushima (three suspension bridges: six towers), Tatara and Innoshima.
    const main = (id: string): string => bridgeDesign(id)!.main;
    for (const id of ['shimotsui_seto_bridge', 'kita_bisan_seto_bridge', 'minami_bisan_seto_bridge', 'kurushima_kaikyo_bridge_1', 'kurushima_kaikyo_bridge_2', 'kurushima_kaikyo_bridge_3', 'innoshima_bridge']) {
      expect(main(`landmark.${id}`), id).toBe('suspension');
      expect(count(`landmark.${id}`), id).toBe(3);
    }
    for (const id of ['hitsuishijima_bridge', 'iwakurojima_bridge', 'tatara_bridge']) {
      expect(main(`landmark.${id}`), id).toBe('stayed');
      expect(count(`landmark.${id}`), id).toBe(3);
    }
    expect(main('landmark.yoshima_bridge')).toBe('girder');
    expect(bridgeDesign('landmark.yoshima_bridge')!.spans).toEqual([175, 245, 165]);
    expect(bridgeDesign('landmark.minami_bisan_seto_bridge')!.spans[1]).toBe(1100);
    // The three Kurushima bridges meet end to end (the same point, the same height).
    const k = [1, 2, 3].map((n) => LANDMARKS.find((q) => q.id === `landmark.kurushima_kaikyo_bridge_${n}`)!.bridge!);
    for (let n = 0; n < 2; n++) {
      expect(k[n]!.path[k[n]!.path.length - 1]).toEqual(k[n + 1]!.path[0]);
      expect(k[n]!.ends[1]).toBe(k[n + 1]!.ends[0]);
    }
  });
});

describe('the ordinary bridges of the table (L10)', () => {
  it('cross the real areas: lines of two points or more on dry land at both ends, decks over the water, a type for road and railway', () => {
    expect(ORDINARY_BRIDGES.length).toBeGreaterThan(1000);
    for (const [i, r] of ORDINARY_BRIDGES.entries()) {
      expect(r.p.length % 2, `row ${i}`).toBe(0);
      expect(r.p.length, `row ${i}`).toBeGreaterThanOrEqual(4);
      expect([0, 1], `row ${i}`).toContain(r.k);
      expect(r.w, `row ${i}`).toBeGreaterThan(4);
      expect(r.c, `row ${i}`).toBeGreaterThanOrEqual(r.w / 2);
      // Both ends at or above the water (the ground of the banks), the deck never steeper than the walkers' step.
      expect(Math.min(r.e[0], r.e[1]), `row ${i}`).toBeGreaterThanOrEqual(r.l);
      const D = bridgeDesign(r.k === 1 ? 'landmark.ordinary_bridge_rail' : 'landmark.ordinary_bridge_road')!;
      const f = pathFrame(Array.from({ length: r.p.length / 2 }, (_, k) => [r.p[2 * k]!, r.p[2 * k + 1]!] as [number, number]));
      const lay = bridgeLayout(D, f.length, [r.e[0], r.e[1]], r.l);
      for (let x = 0; x + 0.5 <= f.length; x += 0.5) expect(Math.abs(lay.deck(x + 0.5) - lay.deck(x)), `row ${i} at ${x}`).toBeLessThan(0.1);
    }
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

/** Every cell (with an area) a bridge's line runs through (around its middle's cell). `id`: a landmark's type or an ordinary bridge's key. */
function cellsOf(id: string): number[] {
  const s = BRIDGES.find((q) => q.id === id);
  const mid = s ? realToArea(s.lat, s.lon).cell : ordinaryCell(Number(id.split('.')[1]));
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const c = mid + dy * grid.gridW + dx;
    if (haveCell(c) && bridgesIn(c).some((b) => b.key === id && b.to > b.from)) out.push(c);
  }
  return out;
}

/** L10: the cell of an ordinary bridge's middle point. */
function ordinaryCell(i: number): number {
  const r = ORDINARY_BRIDGES[i]!;
  const k = Math.floor(r.p.length / 4) * 2;
  return Math.floor(r.p[k + 1]! / 1024) * grid.gridW + Math.floor(r.p[k]! / 1024);
}
/** L10: the ordinary bridge (its key) whose line passes nearest a real point. */
function ordinaryNear(lat: number, lon: number): string {
  const [X, Z] = [(((lon - LANDMARK_GRID.lon0) * LANDMARK_GRID.kmPerLon) / LANDMARK_GRID.cellKm) * 1024, (((LANDMARK_GRID.latTop - lat) * LANDMARK_GRID.kmPerLat) / LANDMARK_GRID.cellKm) * 1024];
  let best = -1;
  let bd = Infinity;
  ORDINARY_BRIDGES.forEach((r, i) => {
    for (let k = 0; k < r.p.length; k += 2) {
      const d = Math.hypot(r.p[k]! - X, r.p[k + 1]! - Z);
      if (d < bd) [bd, best] = [d, i];
    }
  });
  return `ordinary.${best}`;
}

/** Walk the player along the deck from `from` to `to` (m along the line), `lane` m off its middle. */
function walk(map: TacticalMap, id: string, cell: number, from: number, to: number, lane: number): { reached: number; wet: number; low: number } {
  const br = bridgesIn(cell).find((b) => b.key === id)!;
  const pl = createInitialState(1, 1).player;
  const dir = to > from ? 1 : -1;
  const a = br.f.at(from);
  // From 4 m before a real end of the bridge, or 1 m inside the area where the line goes on into the next one.
  const back = (dir > 0 ? from <= 0.01 : from >= br.f.length - 0.01) ? 4 : -1;
  placePlayer(pl, map, a.x + a.nx * lane - a.tx * dir * back, a.z + a.nz * lane - a.tz * dir * back, 0);
  // On the deck where the walk starts (L10: over the water it is the bridge's boxes, not the ground;
  // a walker coming over from the neighbouring area keeps its height — sim/tactical/area.ts walkAcross).
  pl.pos[1] = supportAt(map, pl.pos[0], pl.pos[2], Math.max(heightAt(map, pl.pos[0], pl.pos[2]), br.lay.deck(Math.min(br.f.length, Math.max(0, from - dir * back)))) + 0.5);
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

const LANES: Record<string, number> = { 'landmark.aomori_bay_bridge': 5, 'landmark.rainbow_bridge': 5, 'landmark.akashi_kaikyo_bridge': 4, 'landmark.kintaikyo': 0, 'landmark.onaruto_bridge': 4, 'landmark.kanmon_bridge': 4, 'landmark.shimotsui_seto_bridge': 5 };

// L10: ordinary bridges over the great rivers (Tone, Kiso, Yodo, Chikugo: roads and a railway) and the
// first one in the table that runs over a cell's edge between two areas.
const edgeRow = ORDINARY_BRIDGES.findIndex((_, i) => cellsOf(`ordinary.${i}`).length >= 2);
const ORDINARY = [ordinaryNear(35.88975, 140.05453), ordinaryNear(35.10484, 136.71272), ordinaryNear(34.71385, 135.4871), ordinaryNear(33.32648, 130.4988), `ordinary.${edgeRow}`];

describe.each([...BRIDGES.map((s) => s.id), ...ORDINARY])('%s in its real areas (L9, L10)', (id) => {
  const cells = cellsOf(id);
  it.skipIf(cells.length === 0)('stands from bank to bank, its deck walked both ways, the dead let through, no embankment or building on it', { timeout: 600_000 }, () => {
    const maps = new Map(cells.map((c) => [c, mapFor(grid, c)]));
    // Every stretch of the line is built by one area (the stretches meet exactly).
    const stretches = cells.map((c) => bridgesIn(c).find((b) => b.key === id)!).map((b) => [b.from, b.to] as const).sort((p, q) => p[0] - q[0]);
    expect(stretches[0]![0]).toBe(0);
    for (let k = 1; k < stretches.length; k++) expect(stretches[k]![0]).toBeCloseTo(stretches[k - 1]![1], 6);
    const full = bridgesIn(cells[0]!).find((b) => b.key === id)!;
    expect(stretches[stretches.length - 1]![1]).toBeCloseTo(full.f.length, 6);
    for (const c of cells) {
      const map = maps.get(c)!;
      const br = bridgesIn(c).find((b) => b.key === id)!;
      const p = map.placements.find((q) => q.def === br.id && q.span && Math.abs(q.span.from - br.from) < 1e-6 && Math.abs(q.span.path[0]![0] + q.x0 - br.path[0]![0]) < 1e-6);
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
      // L10: over the water the ground is not raised under the deck — the water stays, bullets and
      // eyes pass under the slab (from bank side to bank side, 0.8 m over the water, between the piers).
      if (carryOf(br.design) !== 'ground') {
        let open = 0;
        let under = 0;
        for (const [a, b] of p!.span!.land ?? []) {
          for (let s = a + 3; s < b - 3; s += 1) {
            const q = br.f.at(s);
            if (!(q.x > 2 && q.z > 2 && q.x < map.size - 2 && q.z < map.size - 2)) continue;
            if (waterDepthAt(map, q.x, q.z) < 0.5) continue;
            under++;
            expect(heightAt(map, q.x, q.z), `${id} in ${c}: ground raised under the deck at s ${s}`).toBeLessThan(br.lay.water);
            const y = br.lay.water + 0.8;
            const o = br.hw + 6;
            if (!segmentHitsStatic(map, [q.x - q.nx * o, y, q.z - q.nz * o], [q.x + q.nx * o, y, q.z + q.nz * o])) open++;
          }
        }
        if (under > 0) expect(open, `${id} in ${c}: no open line under the deck`).toBeGreaterThan(0);
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

// L10: the Kurushima-Kaikyō Bridge, three rows of the table meeting over the water and on Umajima:
// walked from Ōshima to Imabari in one go (and back), never in the water.
const KURUSHIMA = [1, 2, 3].map((n) => `landmark.kurushima_kaikyo_bridge_${n}`);
const kurushimaCell = realToArea(34.12163, 133.00132).cell;
describe.skipIf(!haveCell(kurushimaCell))('the Kurushima-Kaikyō Bridge from end to end (L10)', () => {
  it('is walked across its three bridges both ways', { timeout: 300_000 }, () => {
    const map = mapFor(grid, kurushimaCell);
    const rows = KURUSHIMA.map((id) => bridgesIn(kurushimaCell).find((b) => b.key === id)!);
    const pts = [...rows[0]!.path, ...rows[1]!.path.slice(1), ...rows[2]!.path.slice(1)];
    const f = pathFrame(pts);
    for (const dir of [1, -1]) {
      const pl = createInitialState(1, 1).player;
      const s0 = dir > 0 ? 0 : f.length;
      const s1 = dir > 0 ? f.length : 0;
      const a = f.at(s0);
      placePlayer(pl, map, a.x - a.tx * dir * 4, a.z - a.tz * dir * 4, 0);
      pl.pos[1] = supportAt(map, pl.pos[0], pl.pos[2], heightAt(map, pl.pos[0], pl.pos[2]) + 0.5);
      let s = s0;
      let wet = 0;
      for (let t = 0; t < 900 / DT && Math.abs(s - s1) > 2; t++) {
        s = f.project(pl.pos[0], pl.pos[2]).s;
        const g = f.at(Math.min(f.length, Math.max(0, s + dir * 6)));
        pl.yaw = Math.atan2(-(g.x + g.nx * 4 - pl.pos[0]), -(g.z + g.nz * 4 - pl.pos[2]));
        updatePlayer(pl, map, { ...emptyInputFrame(), moveZ: 1 }, DT);
        if (waterDepthAt(map, pl.pos[0], pl.pos[2], pl.pos[1]) > 0.3) wet++;
      }
      expect(Math.abs(s - s1), `towards ${s1.toFixed(0)}: stopped at ${s.toFixed(1)}`).toBeLessThan(2.5);
      expect(wet).toBe(0);
    }
  });
});
