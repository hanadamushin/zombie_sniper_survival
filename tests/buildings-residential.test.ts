// Houses and apartment blocks (07d-2a). The catalog test in buildings.test.ts already checks every
// type (determinism, triangles, reachability, straight ways, walking every link turned four ways);
// this file checks what is particular to the residential types: that the variants really differ,
// that the seed changes the details, the features each one promises, and a walk in from the door to
// the top floor of each.

import { describe, expect, it } from 'vitest';
import { createInitialState, emptyInputFrame, type GameState } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { ROOM_LOOT } from '../src/data/colony.ts';
import { addEnterable, createFlatBuilder } from '../src/gen/builder.ts';
import { BUILDING_DEFS, detailOf, generateBlueprint, type BuildingDef, type Rot } from '../src/gen/buildings/index.ts';
import { finishMap, type TacticalMap } from '../src/gen/index.ts';
import { supportAt, type Vec3 } from '../src/sim/tactical/collision.ts';
import { indoorPath } from '../src/sim/tactical/indoor.ts';
import { placePlayer, updatePlayer } from '../src/sim/tactical/player.ts';

const HOUSES = ['hiraya', 'wafu2', 'yofu2', 'kominka', 'noka', 'nisetai', 'kyosho3', 'prefab', 'tenpo', 'bessou'].map((v) => `house.${v}`);
const APARTMENTS = ['mokuzo2', 'tekkotsu3', 'danchi5', 'mansion8', 'ryo', 'shataku'].map((v) => `apartment.${v}`);
const MINE = [...HOUSES, ...APARTMENTS];
const def = (id: string): BuildingDef => BUILDING_DEFS.find((d) => d.id === id)!;
const mid = (d: BuildingDef): [number, number] => [(d.size.w[0] + d.size.w[1]) / 2, (d.size.d[0] + d.size.d[1]) / 2];
const DT = BALANCE.time.fixedStep;

/** Rooms with a purpose of their own (not ways through): each must have something to search. */
const PASSAGE = new Set(['hall', 'genkan', 'lobby', 'stairs', 'roof', 'toilet']);

function walkThrough(map: TacticalMap, state: GameState, pts: readonly Vec3[]): number {
  const p = state.player;
  for (let i = 0; i < pts.length; i++) {
    const [tx, ty, tz] = pts[i]!;
    let ok = false;
    for (let s = 0; s < 30 / DT; s++) {
      const dx = tx - p.pos[0];
      const dz = tz - p.pos[2];
      if (Math.hypot(dx, dz) < 0.3 && Math.abs(ty - p.pos[1]) < 0.35) {
        ok = true;
        break;
      }
      p.yaw = Math.atan2(-dx, -dz);
      updatePlayer(p, map, { ...emptyInputFrame(), moveZ: Math.min(1, Math.hypot(dx, dz) / 0.6 + 0.2) }, DT);
    }
    if (!ok) return i;
  }
  return -1;
}

describe('houses and apartment blocks (07d-2a)', () => {
  it('registers ten houses and six apartment blocks', () => {
    for (const id of MINE) expect(def(id), id).toBeDefined();
    expect(BUILDING_DEFS.filter((d) => d.category === 'apartment').length).toBeGreaterThanOrEqual(6);
  });

  it('makes every variant look and lay out differently, and the seed change its details', () => {
    const signatures = new Set<string>();
    for (const id of MINE) {
      const d = def(id);
      const [w, dd] = mid(d);
      const bp = generateBlueprint(d, w, dd, 7);
      const uses = bp.rooms.map((r) => `${r.level}:${r.use}`).sort().join(',');
      signatures.add(`${d.storeys}|${d.roof}|${uses}`);
      // Another seed, same size: colours, furniture or windows differ.
      const other = generateBlueprint(d, w, dd, 8);
      expect(JSON.stringify(other.parts), `${id}: seeds 7 and 8 give the same building`).not.toBe(JSON.stringify(bp.parts));
    }
    expect(signatures.size).toBe(MINE.length);
  });

  it('gives every room with a purpose something to search, from a loot table that exists', () => {
    for (const id of MINE) {
      const d = def(id);
      for (const seed of [1, 2, 3]) {
        const bp = generateBlueprint(d, d.size.w[0], d.size.d[0], seed);
        for (const r of bp.rooms) {
          if (r.locked || PASSAGE.has(r.use)) continue;
          expect(bp.search.some((s) => s.room === r.id), `${id} seed ${seed}: the ${r.use} on storey ${r.level} has nothing to search`).toBe(true);
        }
        for (const s of bp.search) expect(ROOM_LOOT[s.table], `${id}: loot table ${s.table}`).toBeDefined();
      }
    }
  });

  it('has the features each type promises', () => {
    const bp = (id: string, seed = 3): ReturnType<typeof generateBlueprint> => {
      const d = def(id);
      const [w, dd] = mid(d);
      return generateBlueprint(d, w, dd, seed);
    };
    // 古民家: the doma is lower than the raised rooms; there is no stair.
    const kominka = bp('house.kominka');
    const ys = new Set(kominka.rooms.map((r) => r.y.toFixed(2)));
    expect(ys.size).toBe(2);
    expect(kominka.stairs.length).toBe(0);
    // 農家: the barn is a store room on the ground floor, with the tools.
    expect(bp('house.noka').search.some((s) => s.table === 'tools')).toBe(true);
    // 狭小 3 階建て: three floors and the roof terrace; the garage behind a shutter.
    const kyosho = bp('house.kyosho3');
    expect(kyosho.roofAccess).toBe(true);
    expect(kyosho.rooms.some((r) => r.use === 'garage')).toBe(true);
    expect(kyosho.openings.some((o) => o.state === 'shutter' && o.exterior)).toBe(true);
    // 店舗併用住宅: the shop's shutter is down, the shop is reached from inside.
    const tenpo = bp('house.tenpo');
    expect(tenpo.openings.some((o) => o.state === 'shutter' && o.exterior)).toBe(true);
    expect(tenpo.rooms.some((r) => r.use === 'sales' && !r.locked)).toBe(true);
    // 二世帯住宅: two front doors, two kitchens.
    const nisetai = bp('house.nisetai');
    expect(nisetai.links.filter((l) => l.a === -1).length).toBeGreaterThanOrEqual(2);
    expect(nisetai.search.filter((s) => s.table === 'kitchen').length).toBeGreaterThanOrEqual(2);
    // Yards: sheds, carports and fences are part of the outside.
    for (const id of ['house.hiraya', 'house.yofu2', 'house.wafu2']) expect(bp(id).parts.some((p) => p.layer === 'shell' && p.level === -1 && p.y1 < 2.5 && p.mat !== 'plant'), id).toBe(true);
    // The mansion has a lift shaft that cannot be used, and its stair reaches the eighth floor.
    const mansion = bp('apartment.mansion8');
    expect(mansion.stairs.some((s) => s.kind === 'shaft' && !s.usable)).toBe(true);
    expect(Math.max(...mansion.rooms.filter((r) => !r.locked).map((r) => r.level))).toBe(7);
    // The dormitory has a stair at each end.
    expect(bp('apartment.ryo').stairs.filter((s) => s.kind === 'stairs' && s.from === 0).length).toBe(2);
  });

  it('locks about half of the flats', () => {
    for (const id of APARTMENTS) {
      const d = def(id);
      let locked = 0;
      let all = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const bp = generateBlueprint(d, d.size.w[1], d.size.d[1], seed);
        const flats = bp.rooms.filter((r) => r.use === 'bedroom' || r.use === 'tatami');
        all += flats.length;
        locked += flats.filter((r) => r.locked).length;
      }
      expect(locked / all, id).toBeGreaterThan(0.2);
      expect(locked / all, id).toBeLessThan(0.75);
    }
  });

  it('walks in from the front door to the highest room of each, turned east', () => {
    for (const id of MINE) {
      const d = def(id);
      const b = createFlatBuilder(0);
      addEnterable(b, id, 100, 100, d.size.w[0], d.size.d[0], 1 as Rot);
      const map = finishMap(b);
      const det = detailOf(map.placements[0]!);
      const open = det.rooms.filter((r) => !r.locked);
      const topLevel = Math.max(...open.map((r) => r.level));
      const goal = open.find((r) => r.level === topLevel)!;
      const door = det.links.find((l) => l.a === -1)!;
      const start = door.wpts[0]!;
      // Its way in (the room's middle may hold a table).
      const into = det.links.find((l) => l.b === goal.id || l.a === goal.id)!;
      const target: Vec3 = into.b === goal.id ? into.wpts[into.wpts.length - 1]! : into.wpts[0]!;
      // Through the door, then the way the zombies would take to the goal.
      const inside = door.wpts[door.wpts.length - 1]!;
      const route = indoorPath(map, inside, target, 0.35);
      expect(route, id).not.toBeNull();
      const path = [...door.wpts.slice(1), ...route!];
      const state = createInitialState(1, 1);
      placePlayer(state.player, map, start[0], start[2], 0);
      state.player.pos[1] = supportAt(map, start[0], start[2], 0.05);
      expect(walkThrough(map, state, path), `${id}: walking to the ${goal.use} on storey ${goal.level}`).toBe(-1);
      expect(state.player.pos[1]).toBeCloseTo(goal.wy, 1);
    }
  });
});
