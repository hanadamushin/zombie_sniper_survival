// R2: the real map of Tohoku. Enter the areas of the places the R2 prompt names, look from the
// highest firing position over the middle, measure the three budgets (draw calls, triangles, sim +
// draw submission), open the strategic map over Tohoku.
// Screenshots: test-results/realmap-th-*.png (compared with the GSI map, docs/PROGRESS.md R2).

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
  { name: 'sendai', lat: 38.2601, lon: 140.8822, x: null, z: null, yaw: 0 },
  { name: 'sendai_garrison', lat: 38.2700, lon: 140.9200, x: 900, z: 600, yaw: 0 }, // looking north at the compound
  { name: 'aomori', lat: 40.8244, lon: 140.7400, x: null, z: null, yaw: 0 },
  { name: 'aomori_garrison', lat: 40.8148, lon: 140.7140, x: 150, z: 300, yaw: 0 }, // cell 8970, looking north at the compound
  { name: 'morioka', lat: 39.7036, lon: 141.1527, x: null, z: null, yaw: 0 },
  { name: 'akita', lat: 39.7186, lon: 140.1024, x: null, z: null, yaw: 0 },
  { name: 'yamagata', lat: 38.2404, lon: 140.3633, x: null, z: null, yaw: 0 },
  { name: 'fukushima', lat: 37.7503, lon: 140.4676, x: null, z: null, yaw: 0 },
  { name: 'miyako', lat: 39.6505, lon: 141.9800, x: null, z: null, yaw: 0 },
  { name: 'kamaishi', lat: 39.2742, lon: 141.8858, x: null, z: null, yaw: 0 },
  { name: 'kesennuma', lat: 38.9081, lon: 141.5700, x: null, z: null, yaw: 0 },
  { name: 'zao', lat: 38.1436, lon: 140.4400, x: null, z: null, yaw: 0 },
  { name: 'hachimantai', lat: 39.9578, lon: 140.8542, x: null, z: null, yaw: 0 },
  { name: 'seikan_south', lat: 41.1447, lon: 140.5156, x: null, z: null, yaw: 0 },
  { name: 'ominato', lat: 41.2523, lon: 141.1403, x: null, z: null, yaw: 0 },
  { name: 'misawa', lat: 40.7031, lon: 141.3686, x: null, z: null, yaw: 0 },
];

test('real map: the Tohoku areas, from a high point, within the budgets', async ({ page }) => {
  test.setTimeout(1_800_000);
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
    await page.screenshot({ path: `test-results/realmap-th-${p.name}.png` });
    expect(m.calls, p.name).toBeLessThan(150);
    expect(m.triangles, p.name).toBeLessThan(500_000);
    expect(m.tick + m.draw, p.name).toBeLessThan(4);
  }
  console.log(`[realmap tohoku]\n${rows.join('\n')}`);
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'world' }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/realmap-th-strategic.png' });
  expect(errors).toEqual([]);
});
