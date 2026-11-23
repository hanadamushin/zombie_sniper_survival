// R3: the real map of Kanto. Enter the areas of the places the R3 prompt names, look from the
// highest firing position over the middle, measure the three budgets (draw calls, triangles, sim +
// draw submission), open the strategic map over Kanto.
// Screenshots: test-results/realmap-kt-*.png (compared with the GSI map, docs/PROGRESS.md R3).

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
  { name: 'tokyo', lat: 35.6812, lon: 139.7671, x: null, z: null, yaw: 0 },
  { name: 'shinjuku', lat: 35.6896, lon: 139.7006, x: null, z: null, yaw: 0 },
  { name: 'shibuya', lat: 35.6580, lon: 139.7016, x: null, z: null, yaw: 0 },
  { name: 'yokohama', lat: 35.4658, lon: 139.6223, x: null, z: null, yaw: 0 },
  { name: 'kawasaki', lat: 35.5313, lon: 139.6969, x: null, z: null, yaw: 0 },
  { name: 'omiya', lat: 35.9064, lon: 139.6238, x: null, z: null, yaw: 0 },
  { name: 'urawa', lat: 35.8570, lon: 139.6489, x: null, z: null, yaw: 0 },
  { name: 'chiba', lat: 35.6131, lon: 140.1134, x: null, z: null, yaw: 0 },
  { name: 'sagamihara', lat: 35.5714, lon: 139.3734, x: null, z: null, yaw: 0 },
  { name: 'narita', lat: 35.7720, lon: 140.3929, x: null, z: null, yaw: 0 },
  { name: 'haneda', lat: 35.5494, lon: 139.7798, x: null, z: null, yaw: 0 },
  { name: 'asaka', lat: 35.7930, lon: 139.5960, x: null, z: null, yaw: 0 },
  { name: 'narashino', lat: 35.7065, lon: 140.0500, x: null, z: null, yaw: 0 },
  { name: 'yokosuka', lat: 35.2903, lon: 139.6650, x: null, z: null, yaw: 0 },
  { name: 'hyakuri', lat: 36.1813, lon: 140.4147, x: null, z: null, yaw: 0 },
  { name: 'iruma', lat: 35.8419, lon: 139.4106, x: null, z: null, yaw: 0 },
  { name: 'kumotori', lat: 35.8555, lon: 138.9440, x: null, z: null, yaw: 0 },
  { name: 'okutama', lat: 35.8094, lon: 139.0965, x: null, z: null, yaw: 0 },
  { name: 'chichibu_forest', lat: 35.9110, lon: 138.9923, x: null, z: null, yaw: 0 }, // the most trees of the region (cell 17972)
  { name: 'takao', lat: 35.6251, lon: 139.2437, x: null, z: null, yaw: 0 },
  { name: 'oshima', lat: 34.7500, lon: 139.3550, x: null, z: null, yaw: 0 },
  { name: 'mito', lat: 36.3418, lon: 140.4468, x: null, z: null, yaw: 0 },
  { name: 'utsunomiya', lat: 36.5658, lon: 139.8836, x: null, z: null, yaw: 0 },
  { name: 'maebashi', lat: 36.3911, lon: 139.0608, x: null, z: null, yaw: 0 },
];

test('real map: the Kanto areas, from a high point, within the budgets', async ({ page }) => {
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
    await page.screenshot({ path: `test-results/realmap-kt-${p.name}.png` });
    expect.soft(m.calls, p.name).toBeLessThan(150);
    expect.soft(m.triangles, p.name).toBeLessThan(500_000);
    expect.soft(m.tick + m.draw, p.name).toBeLessThan(4);
  }
  console.log(`[realmap kanto]\n${rows.join('\n')}`);
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'world' }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/realmap-kt-strategic.png' });
  expect(errors).toEqual([]);
});
