// R0: the real map. Operation areas of Shikoku are the real 10 km squares shrunk 1/10: enter them,
// look from a high point, measure the three budgets (draw calls, triangles, sim + draw submission),
// walk over the edge into the next real cell, open the data-source screen. Screenshots:
// test-results/realmap-*.png (compare with the GSI map of the same square, docs/realmap_guide.md §5).

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
  { name: 'matsuyama', lat: 33.8395, lon: 132.7657, x: null, z: null, yaw: 2.2 },
  { name: 'takamatsu', lat: 34.3402, lon: 134.0434, x: null, z: null, yaw: 0.6 },
  { name: 'kochi', lat: 33.5597, lon: 133.5311, x: null, z: null, yaw: 0.8 },
  { name: 'tokushima', lat: 34.0703, lon: 134.5548, x: null, z: null, yaw: -0.8 },
  { name: 'ishizuchi', lat: 33.7675, lon: 133.1153, x: null, z: null, yaw: 0.0 },
  { name: 'imabari_shimanami', lat: 34.0855, lon: 132.9970, x: null, z: null, yaw: 0.4 },
  { name: 'sakaide_setoohashi', lat: 34.3350, lon: 133.8400, x: null, z: null, yaw: 0.2 },
];

test('real map: the Shikoku areas, from a high point, within the budgets', async ({ page }) => {
  test.setTimeout(900_000);
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
    await page.screenshot({ path: `test-results/realmap-${p.name}.png` });
    expect(m.calls, p.name).toBeLessThan(150);
    expect(m.triangles, p.name).toBeLessThan(500_000);
    expect(m.tick + m.draw, p.name).toBeLessThan(4);
  }
  console.log(`[realmap]\n${rows.join('\n')}`);
  // The strategic map with the real prefectures, places and the cell facts.
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'world' }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/realmap-strategic.png' });
  expect(errors).toEqual([]);
});

test('real map: walking over the edge into the next real cell, the road and the ground go on', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0');
  await startNewGame(page);
  const { cell } = await enter(page, 33.8395, 132.7657); // Matsuyama
  // A road that leaves the area to the east, and the ground there on both sides of the edge.
  const road = await page.evaluate(() => {
    const map = window.__game!.map!;
    for (const r of map.roads) for (const p of [r.pts[0]!, r.pts[r.pts.length - 1]!]) if (Math.abs(p[0] - 1024) < 0.01) return p[1];
    return 512;
  });
  await page.evaluate((z) => window.__game!.debug.teleport(1014, z, -Math.PI / 2, 0), road);
  // Walk east; the feet never jump at the edge (largest change of height in one 1/60 s step).
  const walked = await page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    const start = s.player.cell;
    let jump = 0;
    let y = s.player.pos[1];
    for (let i = 0; i < 60 * 8 && s.player.cell === start; i++) {
      g.sim.tick(s, 1 / 60, { ...g.debug.noInput, moveZ: 1 });
      if (s.player.cell === start) {
        jump = Math.max(jump, Math.abs(s.player.pos[1] - y));
        y = s.player.pos[1];
      }
    }
    const crossed = s.player.cell !== start;
    if (crossed) jump = Math.max(jump, Math.abs(s.player.pos[1] - y));
    return { crossed, jump };
  });
  expect(walked.crossed).toBe(true);
  expect(walked.jump).toBeLessThan(0.3);
  await page.waitForFunction((c) => window.__game!.debug.realInfo()?.cell === c + 1 && window.__game!.debug.realInfo()!.real, cell, { timeout: 30_000 });
  await page.evaluate(() => {
    const g = window.__game!;
    const p = g.state!.player.pos;
    g.debug.teleport(p[0] + 6, p[2], Math.PI / 2, -0.05); // look back west over the edge
  });
  await settle(page);
  await page.screenshot({ path: 'test-results/realmap-border.png' });
  const m = await measure(page);
  console.log(`[realmap] border: ${m.calls} calls, ${(m.triangles / 1e4).toFixed(1)}万 tris, sim ${m.tick.toFixed(2)} + draw ${m.draw.toFixed(2)} ms`);
  expect(m.calls).toBeLessThan(150);
  expect(m.triangles).toBeLessThan(500_000);
  expect(errors).toEqual([]);
});

test('data sources: the 出典 screen from the title and from the menu', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-credits').click();
  await expect(page.getByTestId('credits')).toBeVisible();
  await expect(page.getByTestId('credit-gsiVector')).toContainText('国土地理院');
  await expect(page.getByTestId('credit-estat')).toContainText('国勢調査');
  await expect(page.getByTestId('credit-ksjL03b')).toContainText('国土数値情報');
  await page.screenshot({ path: 'test-results/realmap-credits.png' });
  await page.getByTestId('credits-close').click();
  await expect(page.getByTestId('new-game')).toBeVisible();
});
