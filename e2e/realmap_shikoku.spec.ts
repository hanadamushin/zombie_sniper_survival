// R7: the real map of Shikoku. Enter the areas of the check sites (capitals, bridges, SDF sites, mountains,
// coasts), look from the highest firing position over the middle, measure the three budgets (draw calls,
// triangles, sim + draw submission), open the strategic map over Shikoku.
// Screenshots: test-results/realmap-sk-*.png (compared with the GSI map, docs/PROGRESS.md R7).

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

/** Stand at the best firing position (or a given point) and look in a direction; `toward`: from the firing
 * position that best overlooks (x, z), look at it. */
async function lookFrom(page: Page, x: number | null, z: number | null, yaw: number, pitch = -0.14, toward = false): Promise<void> {
  await page.evaluate(([px, pz, y, p, tw]) => {
    const g = window.__game!;
    const map = g.map!;
    let tx = px;
    let tz = pz;
    let ty: number | undefined;
    let yawTo = y!;
    if (tw && tx !== null && tz !== null) {
      const [cx, cz] = [tx, tz];
      const score = (v: (typeof map.vantages)[number]): number => v.pos[1] - Math.hypot(v.pos[0] - cx, v.pos[2] - cz) * 0.15;
      const v = [...map.vantages].sort((a, b) => score(b) - score(a))[0]!;
      [tx, ty, tz] = v.pos;
      yawTo = Math.atan2(-(cx - tx), -(cz - tz));
    } else if (tx === null || tz === null) {
      // The highest firing position that looks over the middle of the area (not the edge).
      const v = [...map.vantages].sort((a, b) => b.pos[1] - Math.hypot(b.pos[0] - 512, b.pos[2] - 512) * 0.05 - (a.pos[1] - Math.hypot(a.pos[0] - 512, a.pos[2] - 512) * 0.05))[0]!;
      [tx, ty, tz] = v.pos;
      yawTo = Math.atan2(-(512 - tx), -(512 - tz));
    }
    g.debug.teleport(tx!, tz!, yawTo, p!, ty);
    g.debug.setClock(10);
  }, [x, z, yaw, pitch, toward] as const);
}

const PLACES: { name: string; lat: number; lon: number; x: number | null; z: number | null; yaw: number; toward?: boolean }[] = [
  { name: 'matsuyama', lat: 33.8395, lon: 132.7657, x: null, z: null, yaw: 0 }, // the most buildings of the region (758)
  { name: 'matsuyama_airport', lat: 33.8272, lon: 132.6997, x: null, z: null, yaw: 0 }, // Mitsuhama and the airport on the coast
  { name: 'takamatsu', lat: 34.3505, lon: 134.0467, x: null, z: null, yaw: 0 },
  { name: 'takamatsu_east', lat: 34.31, lon: 134.1, x: null, z: null, yaw: 0 }, // Yashima side, the second most buildings (727)
  { name: 'kochi', lat: 33.5597, lon: 133.5311, x: null, z: null, yaw: 0 },
  { name: 'kochi_airport', lat: 33.5461, lon: 133.6694, x: null, z: null, yaw: 0 },
  { name: 'tokushima', lat: 34.0703, lon: 134.5548, x: null, z: null, yaw: 0 },
  { name: 'komatsushima', lat: 34.0048, lon: 134.6286, x: null, z: null, yaw: 0 }, // MSDF Komatsushima and GSDF Tokushima
  { name: 'naruto', lat: 34.235, lon: 134.644, x: null, z: null, yaw: 0 }, // the Shikoku end of the Onaruto bridge
  { name: 'zentsuji', lat: 34.227, lon: 133.787, x: null, z: null, yaw: 0 }, // the 14th Brigade
  { name: 'sakaide_setoohashi', lat: 34.335, lon: 133.84, x: null, z: null, yaw: 0 },
  { name: 'imabari_shimanami', lat: 34.0855, lon: 132.997, x: null, z: null, yaw: 0 },
  { name: 'kurushima_bridge', lat: 34.0855, lon: 132.997, x: 300, z: 240, yaw: 0, toward: true }, // the bridge (an embankment) from the vantage overlooking it
  { name: 'niihama', lat: 33.96, lon: 133.283, x: null, z: null, yaw: 0 },
  { name: 'ishizuchi', lat: 33.7675, lon: 133.1153, x: null, z: null, yaw: 0 }, // mountains
  { name: 'tsurugi', lat: 33.8536, lon: 134.0944, x: null, z: null, yaw: 0 },
  { name: 'oboke', lat: 33.869, lon: 133.755, x: null, z: null, yaw: 0 },
  { name: 'uwajima', lat: 33.2235, lon: 132.56, x: null, z: null, yaw: 0 },
  { name: 'shimanto', lat: 32.99, lon: 132.934, x: null, z: null, yaw: 0 },
  { name: 'ashizuri', lat: 32.724, lon: 133.02, x: null, z: null, yaw: 0 }, // a coastal cape
];

test('real map: the Shikoku areas, from a high point, within the budgets', async ({ page }) => {
  test.setTimeout(1_800_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0');
  await startNewGame(page);
  const rows: string[] = [];
  // PLACES=name,name: only those places (and the strategic map).
  const only = process.env.PLACES?.split(',');
  for (const p of PLACES.filter((q) => !only || only.includes(q.name))) {
    const { cell, ms } = await enter(page, p.lat, p.lon);
    await lookFrom(page, p.x, p.z, p.yaw, -0.14, p.toward);
    await settle(page);
    const m = await measure(page);
    const info = await page.evaluate(() => window.__game!.debug.realInfo()!);
    rows.push(`${p.name} cell ${cell}: enter ${ms} ms (file ${info.loadMs.at(-1)?.toFixed(0)} ms), ${m.calls} calls, ${(m.triangles / 1e4).toFixed(1)}万 tris, sim ${m.tick.toFixed(2)} + draw ${m.draw.toFixed(2)} ms, pois ${info.pois.length}`);
    console.log(rows.at(-1));
    await page.screenshot({ path: `test-results/realmap-sk-${p.name}.png` });
    expect.soft(m.calls, p.name).toBeLessThan(150);
    expect.soft(m.triangles, p.name).toBeLessThan(500_000);
    expect.soft(m.tick + m.draw, p.name).toBeLessThan(4);
  }
  console.log(`[realmap shikoku]\n${rows.join('\n')}`);
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'world' }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/realmap-sk-strategic.png' });
  expect(errors).toEqual([]);
});
