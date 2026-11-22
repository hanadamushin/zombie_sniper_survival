// R4: the real map of Chubu. Enter the areas of the places the R4 prompt names, look from the
// highest firing position over the middle, measure the three budgets (draw calls, triangles, sim +
// draw submission), open the strategic map over Chubu.
// Screenshots: test-results/realmap-cb-*.png (compared with the GSI map, docs/PROGRESS.md R4).

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
  { name: 'nagoya', lat: 35.1709, lon: 136.8815, x: null, z: null, yaw: 0 },
  { name: 'moriyama', lat: 35.2051, lon: 136.9693, x: null, z: null, yaw: 0 },
  { name: 'kanayama', lat: 35.1430, lon: 136.9010, x: null, z: null, yaw: 0 },
  { name: 'niigata', lat: 37.9026, lon: 139.0236, x: null, z: null, yaw: 0 },
  { name: 'niigata_station', lat: 37.9122, lon: 139.0618, x: null, z: null, yaw: 0 },
  { name: 'ryotsu', lat: 38.0820, lon: 138.4370, x: null, z: null, yaw: 0 },
  { name: 'shizuoka', lat: 34.9716, lon: 138.3890, x: null, z: null, yaw: 0 },
  { name: 'hamamatsu', lat: 34.7037, lon: 137.7349, x: null, z: null, yaw: 0 },
  { name: 'hamamatsu_base', lat: 34.7500, lon: 137.7030, x: null, z: null, yaw: 0 },
  { name: 'centrair', lat: 34.8584, lon: 136.8400, x: null, z: null, yaw: 0 }, // the island is in a sea cell: Tokoname, the bridge
  { name: 'komatsu', lat: 36.3940, lon: 136.4067, x: null, z: null, yaw: 0 },
  { name: 'fuji_garrison', lat: 35.3600, lon: 138.8800, x: null, z: null, yaw: 0 },
  { name: 'mt_fuji', lat: 35.3606, lon: 138.7274, x: null, z: null, yaw: 0 },
  { name: 'kawaguchiko', lat: 35.5100, lon: 138.7600, x: null, z: null, yaw: 0 },
  { name: 'yarigatake', lat: 36.3420, lon: 137.6476, x: null, z: null, yaw: 0 },
  { name: 'hotaka', lat: 36.2894, lon: 137.6480, x: null, z: null, yaw: 0 },
  { name: 'tateyama', lat: 36.5761, lon: 137.6197, x: null, z: null, yaw: 0 },
  { name: 'toyama', lat: 36.6953, lon: 137.2113, x: null, z: null, yaw: 0 },
  { name: 'kanazawa', lat: 36.5781, lon: 136.6481, x: null, z: null, yaw: 0 },
  { name: 'fukui', lat: 36.0652, lon: 136.2216, x: null, z: null, yaw: 0 },
  { name: 'kofu', lat: 35.6642, lon: 138.5684, x: null, z: null, yaw: 0 },
  { name: 'nagano', lat: 36.6513, lon: 138.1810, x: null, z: null, yaw: 0 },
  { name: 'gifu', lat: 35.3912, lon: 136.7223, x: null, z: null, yaw: 0 },
];

test('real map: the Chubu areas, from a high point, within the budgets', async ({ page }) => {
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
    console.log(rows.at(-1));
    await page.screenshot({ path: `test-results/realmap-cb-${p.name}.png` });
    expect.soft(m.calls, p.name).toBeLessThan(150);
    expect.soft(m.triangles, p.name).toBeLessThan(500_000);
    expect.soft(m.tick + m.draw, p.name).toBeLessThan(4);
  }
  console.log(`[realmap chubu]\n${rows.join('\n')}`);
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'world' }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/realmap-cb-strategic.png' });
  expect(errors).toEqual([]);
});
