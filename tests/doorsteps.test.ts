// 09b: steps up to the doors of buildings on sloping ground (src/gen/doorsteps.ts). A building's ground
// level is the highest ground under it, so on a slope its low side stood up to a few metres above the
// street and nobody could walk in. The count over all 4,108 areas is tools/real/doors.ts (minutes); here
// the centre of Sapporo, where the problem was found, and the flat yard.
import { describe, expect, it } from 'vitest';
import { DOORSTEPS } from '../src/data/architecture.ts';
import { TACTICAL } from '../src/data/tactical.ts';
import { detailOf } from '../src/gen/buildings/index.ts';
import { setDoorSteps } from '../src/gen/doorsteps.ts';
import { heightAt } from '../src/sim/tactical/collision.ts';
import { indoorPath, indoorStep } from '../src/sim/tactical/indoor.ts';
import { mapFor } from '../tools/real/check.ts';
import { doorsOf, walkIn } from '../tools/real/doors.ts';
import { loadGrid, loadRealIndexes } from '../tools/real/lib/game.ts';

const grid = loadGrid();
loadRealIndexes(grid);
const SAPPORO = 4800;
const STEP = TACTICAL.player.stepUp;

describe('09b door steps', () => {
  const map = mapFor(grid, SAPPORO);
  const doors = doorsOf(map);

  it('every outside door of central Sapporo can be walked into; without the steps a third could not', () => {
    expect(doors.length).toBeGreaterThan(500);
    const bad = doors.filter((d) => !d.ok || d.climb > STEP + 1e-6);
    expect(bad.map((d) => `${d.def} (${d.x.toFixed(0)}, ${d.z.toFixed(0)}) ${d.climb}`)).toEqual([]);
    setDoorSteps(false);
    try {
      const before = doorsOf(mapFor(grid, SAPPORO));
      const stuck = before.filter((d) => !d.ok || d.climb > STEP + 1e-6);
      expect(stuck.length / before.length).toBeGreaterThan(0.25);
    } finally {
      setDoorSteps(true);
    }
  });

  it('the flights rise by no more than a step at a time, down to the ground', () => {
    const stepped = map.placements.filter((p) => p.steps);
    expect(stepped.length).toBeGreaterThan(300);
    let flights = 0;
    for (const p of stepped) {
      const det = detailOf(p);
      for (const st of p.steps!) {
        const l = det.links[st.link];
        if (!l) continue; // behind a key door
        const pts = l.a === -1 ? l.wpts : [...l.wpts].reverse();
        // The way in starts on the ground at the foot.
        expect(Math.abs(pts[0]![1] - heightAt(map, pts[0]![0], pts[0]![2]))).toBeLessThan(0.05);
        const w = walkIn(map, pts, pts[pts.length - 1]![1]);
        expect(w.climb, `${p.def} at (${p.x0.toFixed(0)}, ${p.z0.toFixed(0)})`).toBeLessThanOrEqual(DOORSTEPS.last + 0.02);
        flights++;
      }
    }
    expect(flights).toBeGreaterThan(400);
    // The boxes are plain stair solids of their building; they do not close the nav tiles.
    const boxes = map.solids.filter((s) => s.kind === 'stair' && map.buildings[s.ref]?.enter !== undefined);
    expect(boxes.length).toBeGreaterThan(flights);
    for (const s of boxes.slice(0, 200)) expect(s.y1 - s.y0).toBeGreaterThanOrEqual(DOORSTEPS.thick - 1e-6);
  });

  it('zombies are led to the foot of the steps, then up them and in', () => {
    // The building with the highest sill that has a flight (and one way in, so that the route is that door).
    const oneDoor = (enter: number): boolean => detailOf(map.placements[enter]!).links.filter((l) => l.a === -1 || l.b === -1).length === 1;
    const best = doors.filter((d) => map.placements[d.enter]!.steps?.some((s) => s.link === d.link) && oneDoor(d.enter)).sort((a, b) => b.sill - a.sill)[0]!;
    expect(best.sill).toBeGreaterThan(1.5);
    const p = map.placements[best.enter]!;
    const det = detailOf(p);
    const l = det.links[best.link]!;
    const pts = l.a === -1 ? l.wpts : [...l.wpts].reverse();
    const foot = pts[0]!;
    const inside = pts[pts.length - 1]!;
    // From a few metres beyond the foot, a walker heading for the room is sent to the foot first (2 m: clear of what stands beyond the foot).
    const out = pts[1]!;
    const d = Math.hypot(foot[0] - out[0], foot[2] - out[2]) || 1;
    const from: [number, number, number] = [foot[0] + ((foot[0] - out[0]) / d) * 2, heightAt(map, foot[0] + ((foot[0] - out[0]) / d) * 2, foot[2] + ((foot[2] - out[2]) / d) * 2), foot[2] + ((foot[2] - out[2]) / d) * 2];
    const next = indoorStep(map, { pos: from }, 0.32, inside);
    expect(next).not.toBeNull();
    expect(Math.hypot(next![0] - foot[0], next![2] - foot[2])).toBeLessThan(0.01);
    // The whole path walks.
    const path = indoorPath(map, from, inside, 0.32)!;
    const w = walkIn(map, [from, ...path], inside[1]);
    expect(w.climb).toBeLessThanOrEqual(STEP);
    expect(Math.abs(w.y - inside[1])).toBeLessThan(0.3);
  });
});
