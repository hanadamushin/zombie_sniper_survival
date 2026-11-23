// 07d-3: the 07d-2 buildings placed over the real map. The start area of a new game and the areas of a
// designated city, a prefectural capital, an airport, the army's and the navy's bases: a screenshot of
// each facility (test-results/placement-*.png). Then the three budgets (draw calls, triangles, sim +
// draw submission) on the ground, at the best firing position and inside a building, in the heaviest
// areas (Tokyo, Osaka, Shinjuku, Sendai), a suburb, the countryside and the base areas.
// PLACES=name,name runs only those.

import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

async function startNewGame(page: Page): Promise<void> {
  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.getByTestId('intro-skip').click();
  await expect(page.getByTestId('candidate-2')).toBeVisible();
  await page.getByTestId('start-0').click();
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
}

async function settle(page: Page, ms = 1200): Promise<void> {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  await page.waitForFunction(() => window.__game!.debug.renderInfo().pending === 0, null, { timeout: 120_000 });
  await page.waitForTimeout(ms);
}

async function measure(page: Page): Promise<{ calls: number; triangles: number; tick: number; draw: number }> {
  return page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    g.renderer.draw(s, 0, 0);
    const info = g.debug.renderInfo();
    let t0 = performance.now();
    for (let i = 0; i < 60; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
    const tick = (performance.now() - t0) / 60;
    // Median of 20 draws: one garbage-collection pause must not decide the result.
    const draws: number[] = [];
    for (let i = 0; i < 20; i++) {
      t0 = performance.now();
      g.renderer.draw(s, 0, 0);
      draws.push(performance.now() - t0);
    }
    draws.sort((a, b) => a - b);
    const draw = draws[10]!;
    return { calls: info.calls, triangles: info.triangles, tick, draw };
  });
}

async function enter(page: Page, cell: number): Promise<number> {
  const t0 = Date.now();
  expect(await page.evaluate((c) => window.__game!.debug.gotoCell(c), cell)).toBe(cell);
  await page.waitForFunction((c) => {
    const info = window.__game!.debug.realInfo();
    return info !== null && info.cell === c && info.real;
  }, cell, { timeout: 60_000 });
  // The zombies of the area are about (and come for the player standing still): not in the way here.
  await page.evaluate(() => {
    window.__game!.state!.player.hp = 1e9;
  });
  return Date.now() - t0;
}

/** The first enterable building of a type (regex on its id), or null. */
async function findBuilding(page: Page, pattern: string): Promise<{ i: number; def: string; x0: number; z0: number; x1: number; z1: number; base: number; rot: number } | null> {
  return page.evaluate((p) => {
    const re = new RegExp(p);
    const list = window.__game!.debug.enterables().filter((e) => re.test(e.def));
    // The biggest of them.
    list.sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0));
    return list[0] ?? null;
  }, pattern);
}

/** Look at a building from a firing position near it (the best that sees it), or from above its front. */
async function overlook(page: Page, b: { x0: number; z0: number; x1: number; z1: number; base: number; rot: number }): Promise<void> {
  await page.evaluate((bb) => {
    const g = window.__game!;
    const map = g.map!;
    const cx = (bb.x0 + bb.x1) / 2;
    const cz = (bb.z0 + bb.z1) / 2;
    const size = Math.max(bb.x1 - bb.x0, bb.z1 - bb.z0);
    // In front of it, at a distance that shows the whole site, well above the roofs around (the game
    // is paused for the picture, so nobody falls).
    g.dispatch({ type: 'setSpeed', speed: 0 });
    const [fx, fz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][bb.rot] as [number, number];
    const d = Math.min(420, size * 0.8 + 50);
    const x = Math.min(1010, Math.max(14, cx + fx * d + fz * d * 0.3));
    const z = Math.min(1010, Math.max(14, cz + fz * d - fx * d * 0.3));
    const y = bb.base + Math.max(70, size * 0.45);
    const yaw = Math.atan2(-(cx - x), -(cz - z));
    const pitch = -Math.atan2(y - bb.base, Math.hypot(cx - x, cz - z)) * 0.8;
    g.debug.teleport(x, z, yaw, pitch, y);
    g.debug.setClock(10);
    void map;
  }, b);
}

/** Stand on the ground in front of a building (12 m out), looking at it. */
async function groundAt(page: Page, b: { x0: number; z0: number; x1: number; z1: number; rot: number }): Promise<void> {
  await page.evaluate((bb) => {
    const g = window.__game!;
    const [fx, fz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][bb.rot] as [number, number];
    const cx = (bb.x0 + bb.x1) / 2;
    const cz = (bb.z0 + bb.z1) / 2;
    const x = fx > 0 ? bb.x1 + 12 : fx < 0 ? bb.x0 - 12 : cx;
    const z = fz > 0 ? bb.z1 + 12 : fz < 0 ? bb.z0 - 12 : cz;
    g.debug.teleport(Math.min(1010, Math.max(14, x)), Math.min(1010, Math.max(14, z)), Math.atan2(-(cx - x), -(cz - z)), -0.05);
    g.debug.setClock(10);
  }, b);
}

/** Stand in the largest first-floor room of a building. */
async function inside(page: Page, i: number): Promise<boolean> {
  return page.evaluate((idx) => {
    const g = window.__game!;
    const det = g.debug.enterable(idx);
    if (!det) return false;
    const rooms = det.rooms.filter((r) => !r.locked && r.level === 0).sort((a, b) => (b.wx1 - b.wx0) * (b.wz1 - b.wz0) - (a.wx1 - a.wx0) * (a.wz1 - a.wz0));
    const r = rooms[0];
    if (!r) return false;
    g.debug.teleport((r.wx0 + r.wx1) / 2, (r.wz0 + r.wz1) / 2, 0, 0, r.wy);
    g.debug.setClock(10);
    return true;
  }, i);
}

async function lookFromBest(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = window.__game!;
    const map = g.map!;
    const v = [...map.vantages].sort((a, b) => b.pos[1] - Math.hypot(b.pos[0] - 512, b.pos[2] - 512) * 0.05 - (a.pos[1] - Math.hypot(a.pos[0] - 512, a.pos[2] - 512) * 0.05))[0]!;
    g.debug.teleport(v.pos[0], v.pos[2], Math.atan2(-(512 - v.pos[0]), -(512 - v.pos[2])), -0.14, v.pos[1]);
    g.debug.setClock(10);
  });
}

/** Areas and the facility shown in each. */
const SHOTS: { name: string; cell: number; type: string }[] = [
  { name: 'seirei_sendai_station', cell: 13647, type: 'station_seirei' },
  { name: 'seirei_sendai_core', cell: 13647, type: 'office\\.(skyscraper|depart|hotel_office|tower_mansion)' },
  { name: 'pref_utsunomiya_station', cell: 16811, type: 'station_(pref|city)' },
  { name: 'pref_utsunomiya_chosha', cell: 16811, type: 'office\\.chosha' },
  { name: 'airport_new_chitose', cell: 5304, type: 'airport_' },
  { name: 'gsdf_sendai', cell: 13647, type: 'base\\.jgsdf' },
  { name: 'msdf_kure', cell: 21087, type: 'base\\.jmsdf' },
  { name: 'village_kihoku', cell: 22758, type: 'house\\.(noka|kominka|hiraya|wafu2)' },
];

/** Areas measured: the heaviest city cores, a suburb, the countryside, the base areas. */
const PERF: { name: string; cell: number; type: string }[] = [
  { name: 'tokyo_station', cell: 18480, type: 'station_|office\\.' },
  { name: 'shinjuku', cell: 18312, type: 'station_|office\\.' },
  { name: 'osaka_umeda', cell: 20112, type: 'station_|office\\.' },
  { name: 'sendai_station', cell: 13647, type: 'station_seirei' },
  { name: 'suburb_chitose', cell: 5137, type: 'house\\.|apartment\\.' },
  { name: 'rural_kihoku', cell: 22758, type: 'house\\.' },
  { name: 'airport_new_chitose', cell: 5304, type: 'airport_' },
  { name: 'gsdf_sendai', cell: 13647, type: 'base\\.jgsdf' },
  { name: 'msdf_kure', cell: 21087, type: 'base\\.jmsdf' },
];

test('07d-3: the start area and the facilities of the real map look the part', async ({ page }) => {
  test.setTimeout(1_800_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0');
  await startNewGame(page);
  // The start area: the home base in the middle, the village around.
  await page.evaluate(() => {
    const g = window.__game!;
    g.state!.player.hp = 1e9;
    g.dispatch({ type: 'setSpeed', speed: 0 });
    const map = g.map!;
    const ground = map.height[Math.round(760 / map.tile) * map.n + Math.round(512 / map.tile)]!;
    g.debug.teleport(512, 760, 0, -0.3, ground + 70);
    g.debug.setClock(10);
  });
  await settle(page);
  await page.screenshot({ path: 'test-results/placement-start.png' });
  await page.evaluate(() => window.__game!.dispatch({ type: 'setSpeed', speed: 1 }));
  const only = process.env.PLACES?.split(',');
  const found: string[] = [];
  for (const s of SHOTS.filter((q) => !only || only.includes(q.name))) {
    await enter(page, s.cell);
    const b = await findBuilding(page, s.type);
    expect.soft(b, s.name).not.toBeNull();
    if (!b) continue;
    found.push(`${s.name}: ${b.def} at ${Math.round((b.x0 + b.x1) / 2)}, ${Math.round((b.z0 + b.z1) / 2)}`);
    await overlook(page, b);
    await settle(page);
    await page.screenshot({ path: `test-results/placement-${s.name}.png` });
    await page.evaluate(() => window.__game!.dispatch({ type: 'setSpeed', speed: 1 }));
  }
  console.log(`[placement shots]\n${found.join('\n')}`);
  expect(errors).toEqual([]);
});

test('07d-3: budgets on the ground, at the best firing position and inside, in the heaviest areas', async ({ page }) => {
  test.setTimeout(2_400_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0');
  await startNewGame(page);
  const only = process.env.PLACES?.split(',');
  const rows: string[] = [];
  for (const p of PERF.filter((q) => !only || only.includes(q.name))) {
    const ms = await enter(page, p.cell);
    const b = await findBuilding(page, p.type);
    const count = await page.evaluate(() => window.__game!.map!.placements.length);
    const views: [string, () => Promise<boolean>][] = [
      ['ground', async () => {
        if (!b) return false;
        await groundAt(page, b);
        return true;
      }],
      ['vantage', async () => {
        await lookFromBest(page);
        return true;
      }],
      ['inside', async () => (b ? inside(page, b.i) : false)],
    ];
    for (const [view, go] of views) {
      if (!(await go())) continue;
      await settle(page);
      const m = await measure(page);
      const st = await page.evaluate(() => window.__game!.debug.enterableStages());
      rows.push(`${p.name} (${p.cell}) ${view}: enter ${ms} ms, ${count} buildings [far ${st.far} / mid ${st.mid} / near ${st.near}], ${m.calls} calls, ${(m.triangles / 1e4).toFixed(1)}万 tris, sim ${m.tick.toFixed(2)} + draw ${m.draw.toFixed(2)} ms`);
      console.log(rows.at(-1));
      await page.screenshot({ path: `test-results/placement-perf-${p.name}-${view}.png` });
      expect.soft(m.calls, `${p.name} ${view}`).toBeLessThan(150);
      expect.soft(m.triangles, `${p.name} ${view}`).toBeLessThan(500_000);
      expect.soft(m.tick + m.draw, `${p.name} ${view}`).toBeLessThan(4);
    }
  }
  console.log(`[placement budgets]\n${rows.join('\n')}`);
  expect(errors).toEqual([]);
});
