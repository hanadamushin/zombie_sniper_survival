// R1: the real map of Hokkaido. Enter the areas of the places the R1 prompt names, look from the
// highest firing position over the middle, measure the three budgets (draw calls, triangles, sim +
// draw submission), stand on the two landmarks' roofs, open the strategic map over Hokkaido.
// Screenshots: test-results/realmap-hk-*.png (compared with the GSI map, docs/PROGRESS.md R1).

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
  await page.waitForFunction(() => window.__game!.debug.renderInfo().pending === 0, null, { timeout: 90_000 });
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
    t0 = performance.now();
    for (let i = 0; i < 20; i++) g.renderer.draw(s, 0, 0);
    const draw = (performance.now() - t0) / 20;
    return { calls: info.calls, triangles: info.triangles, tick, draw };
  });
}

/** Enter the real area of the cell at lat / lon, wait for its data and the neighbours. */
async function enter(page: Page, lat: number, lon: number): Promise<{ cell: number; ms: number }> {
  const t0 = Date.now();
  const cell = await page.evaluate(([la, lo]) => window.__game!.debug.gotoLatLon(la!, lo!), [lat, lon]);
  expect(cell).not.toBeNull();
  await page.waitForFunction((c) => {
    const info = window.__game!.debug.realInfo();
    return info !== null && info.cell === c && info.real;
  }, cell, { timeout: 60_000 });
  return { cell: cell!, ms: Date.now() - t0 };
}

/** Stand at the best firing position (or a given point) and look in a direction. */
async function lookFrom(page: Page, x: number | null, z: number | null, yaw: number, pitch = -0.14): Promise<void> {
  await page.evaluate(([px, pz, y, p]) => {
    const g = window.__game!;
    const map = g.map!;
    let tx = px;
    let tz = pz;
    let ty: number | undefined;
    let yawTo = y!;
    if (tx === null || tz === null) {
      // The highest firing position that looks over the middle of the area (not the edge).
      const v = [...map.vantages].sort((a, b) => b.pos[1] - Math.hypot(b.pos[0] - 512, b.pos[2] - 512) * 0.05 - (a.pos[1] - Math.hypot(a.pos[0] - 512, a.pos[2] - 512) * 0.05))[0]!;
      [tx, ty, tz] = v.pos;
      yawTo = Math.atan2(-(512 - tx), -(512 - tz));
    }
    g.debug.teleport(tx!, tz!, yawTo, p!, ty);
    g.debug.setClock(10);
  }, [x, z, yaw, pitch] as const);
}

const PLACES: { name: string; lat: number; lon: number; x: number | null; z: number | null; yaw: number }[] = [
  { name: 'sapporo', lat: 43.0606, lon: 141.3545, x: null, z: null, yaw: 0 },
  { name: 'sapporo_kita', lat: 43.1000, lon: 141.3400, x: null, z: null, yaw: 0 }, // cell 4633: the most buildings of the region
  { name: 'makomanai', lat: 42.9935, lon: 141.3550, x: 760, z: 900, yaw: 0.6 },
  { name: 'asahikawa', lat: 43.7628, lon: 142.3582, x: null, z: null, yaw: 0 },
  { name: 'hakodate', lat: 41.7737, lon: 140.7264, x: null, z: null, yaw: 0 },
  { name: 'hakodate_yama', lat: 41.7593, lon: 140.7043, x: null, z: null, yaw: 0 },
  { name: 'kushiro', lat: 42.9905, lon: 144.3820, x: null, z: null, yaw: 0 },
  { name: 'kushiro_nusamai', lat: 42.9842, lon: 144.3850, x: null, z: null, yaw: 0 },
  { name: 'new_chitose', lat: 42.7752, lon: 141.6923, x: null, z: null, yaw: 0 },
  { name: 'chitose_garrison', lat: 42.8360, lon: 141.6670, x: null, z: null, yaw: 0 },
  { name: 'daisetsuzan', lat: 43.6636, lon: 142.8542, x: null, z: null, yaw: 0 },
  { name: 'seikan_north', lat: 41.5760, lon: 140.3560, x: null, z: null, yaw: 0 },
  { name: 'shiretoko', lat: 44.1230, lon: 145.0850, x: null, z: null, yaw: 0 },
  { name: 'utoro', lat: 44.0640, lon: 144.9950, x: null, z: null, yaw: 0 },
];

test('real map: the Hokkaido areas, from a high point, within the budgets', async ({ page }) => {
  test.setTimeout(1_500_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0');
  await startNewGame(page);
  const rows: string[] = [];
  for (const p of PLACES) {
    const { cell, ms } = await enter(page, p.lat, p.lon);
    await lookFrom(page, p.x, p.z, p.yaw);
    await settle(page);
    const m = await measure(page);
    const info = await page.evaluate(() => window.__game!.debug.realInfo()!);
    rows.push(`${p.name} cell ${cell}: enter ${ms} ms (file ${info.loadMs.at(-1)?.toFixed(0)} ms), ${m.calls} calls, ${(m.triangles / 1e4).toFixed(1)}万 tris, sim ${m.tick.toFixed(2)} + draw ${m.draw.toFixed(2)} ms, pois ${info.pois.length}`);
    await page.screenshot({ path: `test-results/realmap-hk-${p.name}.png` });
    expect(m.calls, p.name).toBeLessThan(150);
    expect(m.triangles, p.name).toBeLessThan(500_000);
    expect(m.tick + m.draw, p.name).toBeLessThan(4);
  }
  console.log(`[realmap hokkaido]\n${rows.join('\n')}`);
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'world' }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/realmap-hk-strategic.png' });
  expect(errors).toEqual([]);
});

test('real map: the Hokkaido landmarks stand at their place, their roofs are firing positions', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0');
  await startNewGame(page);
  for (const [name, lat, lon, id] of [['tv_tower', 43.0611, 141.3564, 'landmark.sapporo_tv_tower'], ['goryokaku_tower', 41.7942, 140.7538, 'landmark.goryokaku_tower']] as const) {
    await enter(page, lat, lon);
    const lm = await page.evaluate((def) => {
      const map = window.__game!.map!;
      const pl = map.placements.find((q) => q.def === def);
      if (!pl) return null;
      const v = map.vantages.find((q) => q.pos[0] >= pl.x0 && q.pos[0] <= pl.x1 && q.pos[2] >= pl.z0 && q.pos[2] <= pl.z1);
      return { x0: pl.x0, z0: pl.z0, x1: pl.x1, z1: pl.z1, roof: v?.pos[1] ?? null, vx: v?.pos[0] ?? 0, vz: v?.pos[2] ?? 0, ground: pl.base };
    }, id);
    expect(lm, name).not.toBeNull();
    expect(lm!.roof! - lm!.ground, name).toBeGreaterThan(80);
    // From the roof (L1: at its firing position, the deck's edge) looking over the town; then from the street looking up at it.
    await page.evaluate(([x, z, y]) => {
      const g = window.__game!;
      g.debug.teleport(x!, z!, Math.PI, -0.25, y!);
      g.debug.setClock(10);
    }, [lm!.vx, lm!.vz, lm!.roof! + 0.05] as const);
    await settle(page);
    await page.screenshot({ path: `test-results/realmap-hk-${name}-roof.png` });
    await page.evaluate(([x, z]) => window.__game!.debug.teleport(x!, z!, 0, 0.75), [(lm!.x0 + lm!.x1) / 2, lm!.z1 + 70] as const);
    await settle(page);
    await page.screenshot({ path: `test-results/realmap-hk-${name}.png` });
  }
  expect(errors).toEqual([]);
});
