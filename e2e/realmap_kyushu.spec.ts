// R8: the real map of Kyushu / Okinawa. Enter the areas of the places the R8 prompt names, look from the
// highest firing position over the middle, measure the three budgets (draw calls, triangles, sim +
// draw submission), open the strategic map over Kyushu.
// Screenshots: test-results/realmap-ks-*.png (compared with the GSI map, docs/PROGRESS.md R8).

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
  { name: 'fukuoka', lat: 33.5897, lon: 130.4207, x: null, z: null, yaw: 0 }, // Hakata, Tenjin, the city hall and the prefectural office
  { name: 'fukuoka_airport', lat: 33.5897, lon: 130.4207, x: 591, z: 304, yaw: 0, toward: true }, // the firing position that overlooks the airport
  { name: 'fukuoka_west', lat: 33.5845, lon: 130.3833, x: null, z: null, yaw: 0 }, // Fukuoka castle ruins, Ohori park, Momochi
  { name: 'kasuga', lat: 33.531, lon: 130.467, x: null, z: null, yaw: 0 }, // GSDF Fukuoka, ASDF Kasuga
  { name: 'kokura', lat: 33.8829, lon: 130.8752, x: null, z: null, yaw: 0 }, // Kitakyushu city hall, Kokura castle (north edge), GSDF Kokura
  { name: 'yahata', lat: 33.868, lon: 130.811, x: null, z: null, yaw: 0 },
  { name: 'kanmon_moji', lat: 33.9468, lon: 130.9622, x: null, z: null, yaw: 0 }, // the Kyushu end of the Kanmon strait: Mojiko, Mekari
  { name: 'kanmon_bridge', lat: 33.9468, lon: 130.9622, x: 245, z: 190, yaw: 1.01 }, // over the Mekari tunnel mouth, looking north-west along the Kanmon bridge (an embankment from (200, 160) to (96, 94))
  { name: 'kanmon_shimonoseki', lat: 33.95, lon: 130.9214, x: null, z: null, yaw: 0 }, // the Honshu side in a Fukuoka cell: Shimonoseki station, Hikoshima, Kokura (south edge)
  { name: 'kumamoto', lat: 32.8063, lon: 130.7058, x: null, z: null, yaw: 0 }, // Kumamoto castle and the city hall
  { name: 'kumamoto_station', lat: 32.7898, lon: 130.6886, x: null, z: null, yaw: 0 },
  { name: 'kita_kumamoto', lat: 32.853, lon: 130.727, x: null, z: null, yaw: 0 }, // GSDF Kita-Kumamoto (8th Division); the most buildings of the region (821)
  { name: 'kengun', lat: 32.791, lon: 130.768, x: null, z: null, yaw: 0 }, // GSDF Kengun (Western Army HQ), the prefectural office
  { name: 'aso', lat: 32.8844, lon: 131.104, x: null, z: null, yaw: 0 }, // Nakadake crater
  { name: 'aso_caldera', lat: 32.952, lon: 131.12, x: null, z: null, yaw: 0 }, // the caldera floor, Aso station
  { name: 'sakurajima', lat: 31.5806, lon: 130.6589, x: null, z: null, yaw: 0 },
  { name: 'kagoshima', lat: 31.5838, lon: 130.5414, x: null, z: null, yaw: 0 }, // Kagoshima-Chuo, the prefectural office, the port
  // Sasebo's centre is on the corner of four cells: the station in 22899's south-west corner, the MSDF District HQ in
  // 22898's south-east corner, the bay (Hiu, Hario island, Haiki) in 23066.
  { name: 'sasebo_hq', lat: 33.1706, lon: 129.7128, x: 951, z: 926, yaw: 0, toward: true }, // MSDF Sasebo District HQ, GSDF Ainoura
  { name: 'sasebo_bay', lat: 33.13, lon: 129.75, x: null, z: null, yaw: 0 },
  { name: 'tsuiki', lat: 33.685, lon: 131.04, x: null, z: null, yaw: 0 }, // ASDF Tsuiki
  { name: 'naha', lat: 26.2061, lon: 127.6466, x: null, z: null, yaw: 0 }, // Naha airport, ASDF Naha, GSDF Naha, the prefectural office (Okinawa, over the sea route)
  { name: 'naha_airport', lat: 26.2061, lon: 127.6466, x: 328, z: 180, yaw: 0, toward: true },
  { name: 'nago', lat: 26.5916, lon: 127.9775, x: null, z: null, yaw: 0 }, // the north of Okinawa island
  { name: 'okinawa_city', lat: 26.3556, lon: 127.7675, x: null, z: null, yaw: 0 }, // Okinawa city, Kadena
  { name: 'saga', lat: 33.2494, lon: 130.2988, x: null, z: null, yaw: 0 },
  { name: 'nagasaki', lat: 32.7503, lon: 129.8694, x: null, z: null, yaw: 0 },
  { name: 'oita', lat: 33.2382, lon: 131.6126, x: null, z: null, yaw: 0 },
  { name: 'miyazaki', lat: 31.9111, lon: 131.4239, x: null, z: null, yaw: 0 },
  { name: 'kuju', lat: 33.086, lon: 131.239, x: null, z: null, yaw: 0 },
  { name: 'kirishima', lat: 31.934, lon: 130.861, x: null, z: null, yaw: 0 },
  { name: 'unzen', lat: 32.757, lon: 130.293, x: null, z: null, yaw: 0 },
];

test('real map: the Kyushu areas, from a high point, within the budgets', async ({ page }) => {
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
    await page.screenshot({ path: `test-results/realmap-ks-${p.name}.png` });
    expect.soft(m.calls, p.name).toBeLessThan(150);
    expect.soft(m.triangles, p.name).toBeLessThan(500_000);
    expect.soft(m.tick + m.draw, p.name).toBeLessThan(4);
  }
  console.log(`[realmap kyushu]\n${rows.join('\n')}`);
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'world' }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/realmap-ks-strategic.png' });
  expect(errors).toEqual([]);
});
