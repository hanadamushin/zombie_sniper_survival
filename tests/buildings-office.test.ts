// Office buildings (07d-2c). The catalog test in buildings.test.ts already checks every type
// (determinism, triangles, reachability, straight ways, walking every link turned four ways); this
// file checks what is particular to the 'office' types: twenty new ones in four height bands, that
// they really differ, that the seed changes the details, the features each promises (the roof to
// shoot from with its helipad on the tall ones, locked storeys, repeated floors, the konbini in the
// tenant building's slot, the escalators, the external stair...) and a walk in from the door to
// the highest open room — the roof — of each.

import { describe, expect, it } from 'vitest';
import { createInitialState, emptyInputFrame, type GameState } from '../src/core/types.ts';
import { ARCH } from '../src/data/architecture.ts';
import { BALANCE } from '../src/data/balance.ts';
import { ROOM_LOOT } from '../src/data/colony.ts';
import { addEnterable, createFlatBuilder } from '../src/gen/builder.ts';
import { BUILDING_DEFS, detailOf, generateBlueprint, triangleCount, type BuildingBlueprint, type BuildingDef, type Rot } from '../src/gen/buildings/index.ts';
import { clearOf, segRectDist, twoPass } from '../src/gen/buildings/defs/office/common.ts';
import { finishMap, type TacticalMap } from '../src/gen/index.ts';
import { supportAt, type Vec3 } from '../src/sim/tactical/collision.ts';
import { indoorPath } from '../src/sim/tactical/indoor.ts';
import { placePlayer, updatePlayer } from '../src/sim/tactical/player.ts';

const LOW = ['zakkyo_narrow', 'small', 'tenant', 'shotengai3', 'rc_old', 'ekimae', 'clinic', 'juku', 'soko', 'glass_low'];
const MID = ['mid', 'depart', 'shogyo', 'medical_mall', 'chosha'];
const HIGH = ['tower20', 'hotel_office', 'mansion_shogyo'];
const SUPER = ['skyscraper', 'tower_mansion'];
const MINE = [...LOW, ...MID, ...HIGH, ...SUPER].map((v) => `office.${v}`);
const def = (id: string): BuildingDef => BUILDING_DEFS.find((d) => d.id === id)!;
const mid = (d: BuildingDef): [number, number] => [(d.size.w[0] + d.size.w[1]) / 2, (d.size.d[0] + d.size.d[1]) / 2];
const bp = (id: string, seed = 3): BuildingBlueprint => {
  const d = def(id);
  const [w, dd] = mid(d);
  return generateBlueprint(d, w, dd, seed);
};
const DT = BALANCE.time.fixedStep;
/** Rooms one walks through rather than searches. */
const PASSAGE = new Set(['hall', 'genkan', 'lobby', 'stairs', 'roof', 'toilet']);

function reachable(b: BuildingBlueprint): Set<number> {
  const reach = new Set<number>([-1]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const l of b.links) {
      if (reach.has(l.a) !== reach.has(l.b)) {
        reach.add(l.a);
        reach.add(l.b);
        changed = true;
      }
    }
  }
  return reach;
}

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

describe('office buildings (07d-2c)', () => {
  it('registers twenty new office types in the four height bands', () => {
    for (const id of MINE) expect(def(id), id).toBeDefined();
    expect(MINE.length).toBe(20);
    for (const v of LOW) expect(def(`office.${v}`).storeys, v).toBeLessThanOrEqual(5);
    for (const v of MID) expect(def(`office.${v}`).storeys, v).toBeGreaterThanOrEqual(6);
    for (const v of MID) expect(def(`office.${v}`).storeys, v).toBeLessThanOrEqual(15);
    for (const v of HIGH) expect(def(`office.${v}`).storeys, v).toBeGreaterThanOrEqual(16);
    for (const v of HIGH) expect(def(`office.${v}`).storeys, v).toBeLessThanOrEqual(24);
    for (const v of SUPER) expect(def(`office.${v}`).storeys, v).toBeGreaterThanOrEqual(25);
    // The yard (07d-2b) puts the rows of neighbouring streets 80 m apart: two depths must stay under 62 m.
    for (const id of MINE) expect(def(id).size.d[1], id).toBeLessThanOrEqual(30);
  });

  it('makes every variant look and lay out differently, and the seed change its details', () => {
    const signatures = new Set<string>();
    for (const id of MINE) {
      const d = def(id);
      const [w, dd] = mid(d);
      const b = generateBlueprint(d, w, dd, 7);
      const uses = [...new Set(b.rooms.map((r) => `${r.level}:${r.use}`))].sort().join(',');
      signatures.add(`${d.storeys}|${d.kind}|${uses}`);
      const other = generateBlueprint(d, w, dd, 8);
      expect(JSON.stringify(other.parts), `${id}: seeds 7 and 8 give the same building`).not.toBe(JSON.stringify(b.parts));
    }
    expect(signatures.size).toBe(MINE.length);
  });

  it('has something to search in every kind of room with a purpose, from loot tables that exist', () => {
    for (const id of MINE) {
      for (const seed of [1, 2, 3]) {
        const d = def(id);
        const b = generateBlueprint(d, d.size.w[0], d.size.d[0], seed);
        const reach = reachable(b);
        const uses = new Set(b.rooms.filter((r) => !r.locked && reach.has(r.id) && !PASSAGE.has(r.use)).map((r) => r.use));
        for (const use of uses) {
          expect(b.search.some((s) => b.rooms[s.room]!.use === use && reach.has(s.room)), `${id} seed ${seed}: nothing to search in any ${use}`).toBe(true);
        }
        for (const s of b.search) expect(ROOM_LOOT[s.table], `${id}: loot table ${s.table}`).toBeDefined();
      }
    }
  });

  it('lets people up onto the roof of every one but the warehouse, with a helipad and rail on the tall ones', () => {
    for (const id of MINE) {
      const b = bp(id);
      if (id === 'office.soko') {
        expect(def(id).roof).toBe('gable');
        continue;
      }
      expect(b.roofAccess, `${id}: roof access`).toBe(true);
      const reach = reachable(b);
      const roof = b.rooms.filter((r) => r.use === 'roof' && reach.has(r.id));
      expect(roof.length, `${id}: a roof room reached from the street`).toBeGreaterThan(0);
      expect(roof.every((r) => r.level === b.storeys.length - 1)).toBe(true);
      if (def(id).storeys >= 16 || id === 'office.chosha') {
        // The helipad: an asphalt square with yellow edges painted on the roof.
        const e = b.storeys[b.storeys.length - 1]!.y;
        expect(b.parts.some((p) => p.mat === 'asphalt' && p.solid === false && Math.abs(p.y0 - e) < 0.05 && p.x1 - p.x0 >= 6), `${id}: helipad`).toBe(true);
        // The rail / upstand round the roof stays below the eye of someone standing (they can shoot over it).
        const edge = b.parts.filter((p) => p.layer === 'shell' && p.y1 > e + 0.5 && p.y0 < e + 1.0 && p.z0 > b.d - 0.5 && p.x1 - p.x0 > b.w * 0.5);
        expect(edge.length, `${id}: something along the front edge of the roof`).toBeGreaterThan(0);
        for (const p of edge) expect(p.y1 - e, `${id}: the edge is low enough to shoot over`).toBeLessThan(1.5);
      }
    }
  });

  it('locks most storeys of the tall ones at the stair and repeats their floors', () => {
    for (const id of ['office.mid', ...HIGH, ...SUPER, 'office.shogyo', 'office.medical_mall', 'office.chosha'].map((v) => (v.startsWith('office.') ? v : `office.${v}`))) {
      const b = bp(id);
      const levels = b.storeys.length - 1;
      const reach = reachable(b);
      const entered = new Set(b.rooms.filter((r) => reach.has(r.id) && r.use !== 'stairs').map((r) => r.level));
      expect(entered.size, `${id}: only some storeys can be entered`).toBeLessThan(levels);
      // Every storey has its stair hall (the stair is continuous) even when the floor itself is locked.
      for (let l = 0; l <= levels; l++) expect(b.rooms.some((r) => r.level === l && r.use === 'stairs' && reach.has(r.id)), `${id}: stair hall on storey ${l}`).toBe(true);
      const locked = b.openings.filter((o) => o.kind === 'door' && o.state === 'locked' && !entered.has(o.level));
      expect(locked.length, `${id}: locked doors on the locked storeys`).toBeGreaterThan(0);
      // Two locked storeys next to each other are laid out the same (the repeated floor).
      const decor = new Set(['blood', 'debris', 'paper', 'plant']);
      const plan = (l: number): string => b.parts.filter((p) => p.level === l && p.role !== 'furniture' && p.solid !== false && !decor.has(p.mat)).map((p) => `${p.mat}:${p.x0.toFixed(2)},${p.z0.toFixed(2)},${p.x1.toFixed(2)},${p.z1.toFixed(2)}`).sort().join(';');
      const pair = [...Array(levels - 1).keys()].find((l) => l > 0 && !entered.has(l) && !entered.has(l + 1) && l + 1 < levels);
      expect(pair, `${id}: two locked storeys in a row`).toBeDefined();
      expect(plan(pair! + 1)).toBe(plan(pair!));
    }
    // The shell stays within the budget for any seed at the largest size (broken panes split the glass).
    for (const id of MINE) {
      const d = def(id);
      for (let seed = 1; seed <= 12; seed++) expect(triangleCount(generateBlueprint(d, d.size.w[1], d.size.d[1], seed)).shell, `${id} seed ${seed}`).toBeLessThanOrEqual(ARCH.limits.office.shell);
    }
    // The shell of the tallest stays within the budget because of the repeated bands, not per window.
    for (const v of SUPER) expect(triangleCount(bp(`office.${v}`)).shell).toBeLessThanOrEqual(ARCH.limits.office.shell);
  });

  it('has the features each type promises', () => {
    // テナントビル: the konbini (07d-2b's tenant type) in the slot on about half the seeds, the shutter on the rest; the fire stair outside.
    let konbini = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const b = bp('office.tenant', seed);
      const ground = b.rooms.filter((r) => r.level === 0);
      if (ground.some((r) => r.use === 'sales' && !r.locked)) {
        konbini++;
        expect(ground.some((r) => r.use === 'stairs' && r.locked), 'the konbini lobby keeps its locked core').toBe(true);
        expect(b.search.some((s) => s.table === 'grocery')).toBe(true);
      } else expect(b.openings.some((o) => o.level === 0 && o.state === 'shutter' && o.exterior)).toBe(true);
      // Every upper floor is entered from the landing of the stair in the open strip.
      for (let l = 1; l < 4; l++) expect(b.rooms.some((r) => r.level === l && r.use === 'stairs' && r.x0 > b.w - 3)).toBe(true);
    }
    expect(konbini).toBeGreaterThanOrEqual(3);
    expect(konbini).toBeLessThanOrEqual(10);
    // 百貨店: escalators (straight steel flights) on every storey but the top, alternating direction; wide sales floors.
    const dep = bp('office.depart');
    const esc = dep.stairs.filter((s) => s.kind === 'stairs' && s.rect[2] - s.rect[0] < 1.3 && s.rect[3] - s.rect[1] > 4.5);
    expect(esc.length).toBe(def('office.depart').storeys - 1);
    expect(dep.rooms.filter((r) => r.level === 1 && r.use === 'sales').reduce((a, r) => a + (r.x1 - r.x0) * (r.z1 - r.z0), 0)).toBeGreaterThan(400);
    // 商業ビル: most shop units shuttered.
    const sho = bp('office.shogyo');
    const shutters = sho.openings.filter((o) => o.state === 'shutter' && !o.exterior).length;
    expect(shutters).toBeGreaterThan(sho.rooms.filter((r) => r.use === 'sales' && !r.locked).length);
    // 医療モール / 診療所: clinics and medicine.
    for (const id of ['office.medical_mall', 'office.clinic']) {
      const b = bp(id);
      expect(b.rooms.filter((r) => r.use === 'clinic' && !r.locked).length, id).toBeGreaterThanOrEqual(2);
      expect(b.search.some((s) => s.table === 'pharmacy'), id).toBe(true);
    }
    // 塾: classrooms; 駅前: karaoke boxes (small bar rooms); 倉庫: a door a brute fits through.
    expect(bp('office.juku').rooms.filter((r) => r.use === 'classroom').length).toBeGreaterThanOrEqual(5);
    expect(bp('office.ekimae').rooms.filter((r) => r.use === 'bar' && (r.x1 - r.x0) * (r.z1 - r.z0) < 14).length).toBeGreaterThanOrEqual(6);
    expect(bp('office.soko').links.some((l) => l.a === -1 && l.width >= 1.8)).toBe(true);
    // Hotel and flats in the towers.
    expect(bp('office.hotel_office').rooms.filter((r) => r.use === 'bedroom').length).toBeGreaterThanOrEqual(12);
    for (const id of ['office.tower_mansion', 'office.mansion_shogyo']) {
      const b = bp(id);
      expect(b.rooms.filter((r) => r.use === 'kitchen').length, id).toBeGreaterThanOrEqual(3);
      expect(b.rooms.filter((r) => r.use === 'bath').length, id).toBeGreaterThanOrEqual(3);
    }
    // 庁舎風: two stair cores, the counter hall the full width of the ground floor.
    const ch = bp('office.chosha');
    expect(ch.stairs.filter((s) => s.kind === 'stairs' && s.from === 0).length).toBe(2);
    const hall = ch.rooms.find((r) => r.level === 0 && r.use === 'lobby')!;
    expect(hall.x1 - hall.x0).toBeGreaterThan(ch.w - 1);
    // Ruin: broken panes, blood or debris, something toppled or barricaded somewhere in each.
    for (const id of MINE) {
      const b = bp(id, 4);
      expect(b.parts.some((p) => p.mat === 'blood' || p.mat === 'debris'), `${id}: stains`).toBe(true);
    }
  });

  it('keeps furniture off the straight walks between ways (the two-pass placement)', () => {
    expect(segRectDist(0, 0, 10, 0, [4, 1, 5, 2])).toBeCloseTo(1, 6);
    expect(segRectDist(0, 0, 10, 0, [4, -1, 5, 2])).toBe(0);
    expect(clearOf([[0, 0], [10, 0]], [4, 0.6, 5, 2], 0.45)).toBe(true);
    expect(clearOf([[0, 0], [10, 0]], [4, 0.3, 5, 2], 0.45)).toBe(false);
    // twoPass gives the same blueprint for the same random state.
    const d = def('office.small');
    const a = generateBlueprint(d, 10, 11, 9);
    const b = generateBlueprint(d, 10, 11, 9);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(typeof twoPass).toBe('function');
  });

  it('walks in from the street to the highest open room of each (the roof), turned east', () => {
    for (const id of MINE) {
      const d = def(id);
      const b = createFlatBuilder(0);
      addEnterable(b, id, 100, 100, d.size.w[0], d.size.d[0], 1 as Rot);
      const map = finishMap(b);
      const det = detailOf(map.placements[0]!);
      const reach = reachable(det.bp);
      const open = det.rooms.filter((r) => !r.locked && reach.has(r.id));
      const topLevel = Math.max(...open.map((r) => r.level));
      const goal = open.filter((r) => r.level === topLevel).sort((a, b2) => (b2.x1 - b2.x0) * (b2.z1 - b2.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0]!;
      const doors = det.links.filter((l) => l.a === -1).sort((p, q) => q.wpts[0]![0] - p.wpts[0]![0]);
      let done = false;
      for (const door of doors) {
        const into = det.links.find((l) => l.b === goal.id || l.a === goal.id)!;
        const target: Vec3 = into.b === goal.id ? into.wpts[into.wpts.length - 1]! : into.wpts[0]!;
        const route = indoorPath(map, door.wpts[door.wpts.length - 1]!, target, 0.35);
        if (!route) continue;
        const start = door.wpts[0]!;
        const state = createInitialState(1, 1);
        placePlayer(state.player, map, start[0], start[2], 0);
        state.player.pos[1] = supportAt(map, start[0], start[2], 0.05);
        expect(walkThrough(map, state, [...door.wpts.slice(1), ...route]), `${id}: walking to the ${goal.use} on storey ${goal.level}`).toBe(-1);
        expect(state.player.pos[1]).toBeCloseTo(goal.wy, 1);
        done = true;
        break;
      }
      expect(done, `${id}: a door with a way up`).toBe(true);
    }
  });
});
