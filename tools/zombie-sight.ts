// How many zombies a new game shows (07b+ measurement, 07d-3: with the zombies inside the buildings):
//   node tools/zombie-sight.ts [--root <checkout>] [--seeds 12,3] [--minutes 3]
// For each of the 3 bundled scenarios × seeds × the 3 start candidates: a new game on the real map
// (the area files of public/data), the sim run for `minutes`, then the zombies on the map, those
// inside the enterable buildings, and those seen (sightBlocked, within 500 m, eye height standing)
// from the best firing position (the one that sees most) and from the middle of the home base.
// --root runs another checkout's code (e.g. a worktree of the commit before) for a before/after.
import { readFileSync } from 'node:fs';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const root = (arg('--root') ?? new URL('..', import.meta.url).pathname).replace(/\/?$/, '/');
const seeds = (arg('--seeds') ?? '12,3').split(',').map(Number);
const minutes = Number(arg('--minutes') ?? 3);

const { createInitialState, emptyInputFrame } = await import(`${root}src/core/types.ts`);
const { stream } = await import(`${root}src/core/rng.ts`);
const { createSim } = await import(`${root}src/sim/index.ts`);
const { decodeScenario, initWorld } = await import(`${root}src/sim/world/scenario.ts`);
const { beginAt, findStartCandidates } = await import(`${root}src/sim/world/start.ts`);
const { areaOf } = await import(`${root}src/sim/tactical/area.ts`);
const { heightAt, sightBlocked } = await import(`${root}src/sim/tactical/collision.ts`);
const { loadGrid, loadRealIndexes, provideAround } = await import(`${root}tools/real/lib/game.ts`);
const { TACTICAL } = await import(`${root}src/data/tactical.ts`);

const grid = loadGrid();
loadRealIndexes(grid);
const DT = 1 / 60;
const EYE = TACTICAL.player.eyeHeight.stand;

type Z = { pos: [number, number, number]; state: string; kind: string; inside?: number };
function seen(map: unknown, zs: Z[], x: number, y: number, z: number): number {
  let n = 0;
  for (const zb of zs) {
    if (zb.state === 'down') continue;
    const d = Math.hypot(zb.pos[0] - x, zb.pos[2] - z);
    if (d > 500 || d < 1) continue;
    if (!sightBlocked(map, [x, y + EYE, z], [zb.pos[0], zb.pos[1] + 1.5, zb.pos[2]])) n++;
  }
  return n;
}

const rows: { scen: number; seed: number; cand: number; cell: number; land: string; onMap: number; inside: number; vantage: number; home: number }[] = [];
for (const scen of [0, 1, 2]) {
  const buf = readFileSync(new URL(`public/data/infection_${scen}.bin`, `file://${root}`));
  const scenario = decodeScenario(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  for (const seed of seeds) {
    const probe = createInitialState(seed, 1);
    initWorld(probe, grid, scenario);
    const cands = findStartCandidates(probe.world.cells, grid, stream(probe, 'world.start'));
    cands.forEach((cand: { cell: number }, ci: number) => {
      const state = createInitialState(seed, 1);
      initWorld(state, grid, scenario);
      provideAround(grid, cand.cell);
      beginAt(state, grid, cand.cell);
      state.mode = 'tactical';
      const sim = createSim({ grid });
      const idle = emptyInputFrame();
      for (let i = 0; i < Math.round((minutes * 60) / DT); i++) sim.tick(state, DT, idle);
      const map = areaOf(state)!.map;
      const zs = state.tactical!.zombies as Z[];
      let best = 0;
      for (const v of map.vantages) best = Math.max(best, seen(map, zs, v.pos[0], v.pos[1], v.pos[2]));
      const home = seen(map, zs, 512, heightAt(map, 512, 512), 512);
      const alive = zs.filter((zb) => zb.state !== 'down');
      rows.push({ scen, seed, cand: ci, cell: cand.cell, land: map.params.land, onMap: alive.length, inside: alive.filter((zb) => zb.inside !== undefined).length, vantage: best, home });
      const r = rows[rows.length - 1]!;
      console.log(`scenario ${scen} seed ${seed} candidate ${ci} cell ${r.cell} ${r.land}: on the map ${r.onMap} (inside ${r.inside}), best vantage ${r.vantage}, home ${r.home}`);
    });
  }
}
const mean = (k: 'onMap' | 'inside' | 'vantage' | 'home'): string => (rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(1);
console.log(`\n${rows.length} games: on the map ${mean('onMap')} (inside ${mean('inside')}), seen from the best vantage ${mean('vantage')}, from the home centre ${mean('home')}`);
