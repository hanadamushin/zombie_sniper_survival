// R9: the whole real map after the nationwide rebuild. Enter the area with the most buildings of each
// region (counted with tools: generateTacticalMap over every cell) and the heaviest city cores of the
// country, look from the highest firing position over the middle, measure the three budgets (draw calls,
// triangles, sim + draw submission). Then the strategic map over the places whose labels R9 fixed.
// Screenshots: test-results/realmap-all-*.png. PLACES=name,name runs only those.

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

/** Enter the real area of a cell, wait for its data. */
async function enter(page: Page, cell: number): Promise<number> {
  const t0 = Date.now();
  expect(await page.evaluate((c) => window.__game!.debug.gotoCell(c), cell)).toBe(cell);
  await page.waitForFunction((c) => {
    const info = window.__game!.debug.realInfo();
    return info !== null && info.cell === c && info.real;
  }, cell, { timeout: 60_000 });
  return Date.now() - t0;
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

const PLACES: { name: string; cell: number }[] = [
  // The most buildings of each region.
  { name: 'hokkaido_max_sapporo_kita', cell: 4633 },
  { name: 'tohoku_max_sendai', cell: 13647 },
  { name: 'kanto_max_utsunomiya', cell: 16811 },
  { name: 'chubu_max_hamamatsu', cell: 20132 },
  { name: 'kinki_max_izumi', cell: 20612 },
  { name: 'chugoku_max_kurashiki', cell: 20430 },
  { name: 'shikoku_max_matsuyama', cell: 21757 },
  { name: 'kyushu_max_kumamoto', cell: 23576 },
  // The heaviest city cores (the most facilities and roads).
  { name: 'tokyo_station', cell: 18480 },
  { name: 'shinjuku', cell: 18312 },
  { name: 'osaka_umeda', cell: 20112 },
  { name: 'osaka_cityhall', cell: 20279 },
  { name: 'nagoya', cell: 19289 },
  { name: 'sapporo', cell: 4800 },
  { name: 'fukuoka', cell: 22237 },
];

test('real map: the heaviest area of every region and the big city cores, within the budgets', async ({ page }) => {
  test.setTimeout(2_400_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0');
  await startNewGame(page);
  const only = process.env.PLACES?.split(',');
  const rows: string[] = [];
  for (const p of PLACES.filter((q) => !only || only.includes(q.name))) {
    const ms = await enter(page, p.cell);
    await lookFrom(page, null, null, 0);
    await settle(page);
    const m = await measure(page);
    const info = await page.evaluate(() => window.__game!.debug.realInfo()!);
    const buildings = await page.evaluate(() => window.__game!.map!.buildings.length);
    rows.push(`${p.name} cell ${p.cell}: enter ${ms} ms (file ${info.loadMs.at(-1)?.toFixed(0)} ms), buildings ${buildings}, ${m.calls} calls, ${(m.triangles / 1e4).toFixed(1)}万 tris, sim ${m.tick.toFixed(2)} + draw ${m.draw.toFixed(2)} ms`);
    console.log(rows.at(-1));
    await page.screenshot({ path: `test-results/realmap-all-${p.name}.png` });
    expect.soft(m.calls, p.name).toBeLessThan(150);
    expect.soft(m.triangles, p.name).toBeLessThan(500_000);
    expect.soft(m.tick + m.draw, p.name).toBeLessThan(4);
  }
  console.log(`[realmap all]\n${rows.join('\n')}`);
  // The strategic map over Kawasaki / Yokohama, Osaka / Kobe and Kanmon (labels fixed in R9).
  for (const [name, cell] of [['kanto', 18646], ['kansai', 20279], ['kanmon', 21573]] as const) {
    await page.evaluate((c) => window.__game!.debug.gotoCell(c), cell);
    await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'world' }));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/realmap-all-strategic-${name}.png` });
    await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'tactical' }));
  }
  expect(errors).toEqual([]);
});
