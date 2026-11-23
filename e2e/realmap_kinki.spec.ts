// R5: the real map of Kinki. Enter the areas of the places the R5 prompt names, look from the
// highest firing position over the middle, measure the three budgets (draw calls, triangles, sim +
// draw submission), open the strategic map over Kinki.
// Screenshots: test-results/realmap-kk-*.png (compared with the GSI map, docs/PROGRESS.md R5).

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
  { name: 'umeda', lat: 34.7025, lon: 135.4959, x: null, z: null, yaw: 0 },
  { name: 'namba', lat: 34.6659, lon: 135.5013, x: null, z: null, yaw: 0 },
  { name: 'osaka_port', lat: 34.6553, lon: 135.4317, x: null, z: null, yaw: 0 },
  { name: 'kyoto', lat: 34.9858, lon: 135.7588, x: null, z: null, yaw: 0 },
  { name: 'kobe', lat: 34.6946, lon: 135.1952, x: null, z: null, yaw: 0 },
  { name: 'kobe_port', lat: 34.6828, lon: 135.1887, x: null, z: null, yaw: 0 },
  { name: 'sakai', lat: 34.5733, lon: 135.4830, x: null, z: null, yaw: 0 },
  { name: 'kix', lat: 34.4114, lon: 135.2962, x: null, z: null, yaw: 0 }, // the island is in a sea cell: Rinku, the bridge
  { name: 'itami', lat: 34.7855, lon: 135.4382, x: null, z: null, yaw: 0 },
  { name: 'amagasaki', lat: 34.7330, lon: 135.4100, x: null, z: null, yaw: 0 }, // west of Umeda (Senzo is in the Itami cell)
  { name: 'maizuru_hq', lat: 35.4748, lon: 135.3714, x: null, z: null, yaw: 0 }, // the district HQ, west of the cell of the piers
  { name: 'shinodayama', lat: 34.4910, lon: 135.4500, x: null, z: null, yaw: 0 },
  { name: 'otsu', lat: 35.0045, lon: 135.8686, x: null, z: null, yaw: 0 },
  { name: 'biwako_bridge', lat: 35.0820, lon: 135.9200, x: null, z: null, yaw: 0 },
  { name: 'hikone', lat: 35.2745, lon: 136.2595, x: null, z: null, yaw: 0 },
  { name: 'hakkyo', lat: 34.1767, lon: 135.9075, x: null, z: null, yaw: 0 },
  { name: 'odaigahara', lat: 34.1810, lon: 136.1100, x: null, z: null, yaw: 0 },
  { name: 'koyasan', lat: 34.2130, lon: 135.5850, x: null, z: null, yaw: 0 },
  { name: 'akashi_bridge', lat: 34.6316, lon: 135.0336, x: null, z: null, yaw: 0 },
  { name: 'maizuru', lat: 35.4750, lon: 135.3870, x: null, z: null, yaw: 0 },
  { name: 'nara', lat: 34.6851, lon: 135.8329, x: null, z: null, yaw: 0 },
  { name: 'wakayama', lat: 34.2261, lon: 135.1675, x: null, z: null, yaw: 0 },
  { name: 'tsu', lat: 34.7303, lon: 136.5086, x: null, z: null, yaw: 0 },
  { name: 'himeji', lat: 34.8394, lon: 134.6939, x: null, z: null, yaw: 0 },
];

test('real map: the Kinki areas, from a high point, within the budgets', async ({ page }) => {
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
    await page.screenshot({ path: `test-results/realmap-kk-${p.name}.png` });
    expect.soft(m.calls, p.name).toBeLessThan(150);
    expect.soft(m.triangles, p.name).toBeLessThan(500_000);
    expect.soft(m.tick + m.draw, p.name).toBeLessThan(4);
  }
  console.log(`[realmap kinki]\n${rows.join('\n')}`);
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'world' }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/realmap-kk-strategic.png' });
  expect(errors).toEqual([]);
});
