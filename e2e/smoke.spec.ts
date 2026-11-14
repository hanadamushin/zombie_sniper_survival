import { expect, test, type Page } from '@playwright/test';

// Boot -> new game -> clock runs -> speed / mode keys -> save -> reload -> continue.

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

/** Title -> opening (skip the timelapse) -> pick the first start location. */
async function startNewGame(page: Page): Promise<void> {
  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.getByTestId('intro-skip').click();
  await expect(page.getByTestId('candidate-2')).toBeVisible();
  await page.getByTestId('start-0').click();
}

const mode = (page: Page) => page.getByTestId('hud-mode').getAttribute('data-mode');
const clock = (page: Page) => page.evaluate(() => {
  const s = window.__game?.state;
  return s ? s.time.day * 1440 + s.time.minute : -1;
});

test('boots, runs a new game and resumes it after a reload', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('continue')).toBeDisabled();

  await startNewGame(page);
  await expect(page.getByTestId('hud-day')).toHaveText('90日目');
  await expect(page.getByTestId('hud-clock')).toHaveText(/^06:0\d$/);
  expect(await mode(page)).toBe('tactical');

  // The operation area of the home cell is generated; the player stands in its flat middle.
  await page.waitForFunction(() => window.__game?.map != null);
  await expect(page.getByTestId('area-loading')).toBeHidden();
  const area = await page.evaluate(() => {
    const g = window.__game!;
    return { isHome: g.map!.params.isHome, land: g.map!.params.land, pos: g.state!.player.pos, vantages: g.map!.vantages.length };
  });
  expect(area.isHome).toBe(true);
  expect(['rural', 'forest']).toContain(area.land);
  expect(area.pos[0]).toBe(512);
  expect(area.pos[2]).toBe(512);
  expect(area.vantages).toBeGreaterThanOrEqual(3);
  await expect(page.getByTestId('hud-compass')).toHaveAttribute('data-heading', '0');

  // Walk north (W), then crouch (C) and go prone (Z).
  await page.keyboard.down('KeyW');
  await expect.poll(() => page.evaluate(() => window.__game!.state!.player.pos[2]), { timeout: 10_000 }).toBeLessThan(510);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyC');
  await expect(page.getByTestId('hud-stance')).toHaveAttribute('data-stance', 'crouch');
  await page.keyboard.press('KeyZ');
  await expect(page.getByTestId('hud-stance')).toHaveAttribute('data-stance', 'prone');
  await expect.poll(() => page.evaluate(() => window.__game!.state!.player.eye)).toBeLessThan(0.4);
  await page.keyboard.press('KeyZ');
  await expect(page.getByTestId('hud-stance')).toHaveAttribute('data-stance', 'stand');

  // The clock advances (1 game minute per real second at x1).
  const t0 = await clock(page);
  await expect.poll(() => clock(page), { timeout: 10_000 }).toBeGreaterThan(t0);

  // Speed keys: 2 => x3, Space => pause / resume, 3 => x10 only outside the tactical layer.
  await page.keyboard.press('Digit2');
  await expect(page.getByTestId('hud-speed')).toHaveText('x3');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('hud-speed')).toHaveText('一時停止');
  const paused = await clock(page);
  await page.waitForTimeout(1500);
  expect(await clock(page)).toBe(paused);
  await page.keyboard.press('Space');
  await expect(page.getByTestId('hud-speed')).toHaveText('x3');

  // Mode keys.
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('mode-command')).toBeVisible();
  await page.keyboard.press('Digit3');
  await expect(page.getByTestId('hud-speed')).toHaveText('x10');
  await page.keyboard.press('KeyM');
  await expect(page.getByTestId('mode-world')).toBeVisible();
  await page.keyboard.press('KeyM');
  await expect(page.getByTestId('mode-command')).toBeVisible();
  await page.keyboard.press('Digit1');
  await expect(page.getByTestId('hud-speed')).toHaveText('x1');

  // Menu pauses and saves.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mode-menu')).toBeVisible();
  await page.getByTestId('save-slot1').click();
  await expect(page.getByTestId('menu-status')).toHaveText('セーブしました');
  const saved = await clock(page);
  expect(saved).toBeGreaterThan(t0);

  // Reload -> continue from the same date and time.
  await page.reload();
  await expect(page.getByTestId('continue')).toBeEnabled();
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('hud-day')).toBeVisible();
  const resumed = await clock(page);
  expect(resumed).toBeGreaterThanOrEqual(saved);
  expect(resumed).toBeLessThanOrEqual(saved + 2);
  // The same operation area is rebuilt from its seed, and the player is where they were.
  await page.waitForFunction(() => window.__game?.map != null);
  const again = await page.evaluate(() => ({ pos: window.__game!.state!.player.pos, seed: window.__game!.map!.params.mapSeed, saved: window.__game!.state!.tactical!.mapSeed }));
  expect(again.seed).toBe(again.saved);
  expect(again.pos[2]).toBeLessThan(510);

  expect(errors).toEqual([]);
});

test('layout holds at 360px width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  await page.getByTestId('new-game').click();
  await page.getByTestId('intro-skip').click();
  await expect(page.getByTestId('candidate-0')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.getByTestId('start-0').click();
  await expect(page.getByTestId('hud-clock')).toBeVisible();
  await page.keyboard.press('KeyM');
  await expect(page.getByTestId('map-info')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('timelapse, start selection and travel on the strategic map', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0');
  await page.getByTestId('new-game').click();

  // The timelapse plays by itself.
  await expect(page.getByTestId('intro')).toHaveAttribute('data-phase', 'play');
  await expect(page.getByTestId('intro-day')).not.toHaveText('発生から 0 日', { timeout: 5000 });
  await page.getByTestId('intro-skip').click();
  await expect(page.getByTestId('intro-day')).toHaveText('発生から 90 日');
  await page.getByTestId('candidate-1').click();
  await page.getByTestId('start-1').click();
  await expect(page.getByTestId('hud-day')).toHaveText('90日目');

  // The start is a quiet rural cell, and it is the home base.
  const start = await page.evaluate(() => {
    const s = window.__game!.state!;
    return { cell: s.player.cell, home: s.world.homeCell, z: s.world.cells.Z[s.player.cell]!, scenario: s.world.scenario };
  });
  expect(start.home).toBe(start.cell);
  expect(start.z).toBeLessThan(200);
  expect(start.scenario).toBe(0);

  // M opens the map; click a neighbouring land cell, confirm, and watch the journey.
  await page.keyboard.press('KeyM');
  const canvas = page.getByTestId('map-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-scale', /\d/);
  const target = await page.evaluate(() => {
    const s = window.__game!.state!;
    const el = document.querySelector<HTMLElement>('[data-testid=map-canvas]')!;
    const scale = Number(el.dataset.scale);
    const w = s.world.gridW;
    const cell = [1, -1, w, -w].map((d) => s.player.cell + d).find((id) => s.world.cells.Z[id]! >= 0)!;
    return { cell, x: Number(el.dataset.ox) + ((cell % w) + 0.5) * scale, y: Number(el.dataset.oy) + (Math.floor(cell / w) + 0.5) * scale };
  });
  await canvas.click({ position: { x: target.x, y: target.y } });
  await expect(page.getByTestId('route-info')).toHaveText('経路 1 セル・3時間');
  const t0 = await clock(page);
  await page.getByTestId('travel-go').click();
  await expect(page.getByTestId('travel-status')).toBeVisible();
  // On the road there is no operation area.
  await expect.poll(() => page.evaluate(() => window.__game!.state!.tactical === null && window.__game!.map === null)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__game!.state!.player.cell), { timeout: 30_000 }).toBe(target.cell);
  await expect(page.getByTestId('travel-status')).toBeHidden();
  // Arrival: the area of the new cell, entered from a road at its edge.
  await page.waitForFunction((cell) => window.__game?.map != null && window.__game.state!.tactical?.cell === cell, target.cell);
  const arrived = await page.evaluate(() => {
    const g = window.__game!;
    const [x, , z] = g.state!.player.pos;
    return { isHome: g.map!.params.isHome, edge: Math.min(x, z, 1024 - x, 1024 - z) };
  });
  expect(arrived.isHome).toBe(false);
  expect(arrived.edge).toBeLessThan(20);
  expect((await clock(page)) - t0).toBeGreaterThanOrEqual(180);
  expect(await page.evaluate(() => window.__game!.state!.world.cells.visited[window.__game!.state!.player.cell])).toBe(true);

  // Other map views render too.
  await page.getByTestId('view-loot').click();
  await page.getByTestId('view-pop').click();
  expect(errors).toEqual([]);
});

test('every land class renders within the draw-call budget', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0');
  await startNewGame(page);
  await page.waitForFunction(() => window.__game?.map != null);
  const report: string[] = [];
  for (const land of ['urban', 'suburb', 'rural', 'forest', 'mountain']) {
    await page.evaluate((l) => window.__game!.debug.gotoLand(l, 40), land);
    await page.waitForFunction((l) => window.__game?.map?.params.land === l, land, { timeout: 60_000 });
    // Stand on the best vantage point, look across the map, let the first frames (uploads, shader
    // compilation) pass, then sample frame times for 4 s.
    const stats = await page.evaluate(async () => {
      const g = window.__game!;
      g.debug.setClock(12);
      const v = g.map!.vantages.reduce((a, b) => (b.pos[1] > a.pos[1] ? b : a));
      g.debug.teleport(v.pos[0], v.pos[2], Math.atan2(-(512 - v.pos[0]), -(512 - v.pos[2])), -0.1);
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const before = g.debug.renderInfo();
      const times: number[] = [];
      let last = performance.now();
      const end = last + 4000;
      await new Promise<void>((resolve) => {
        const tick = (now: number): void => {
          times.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      times.shift();
      times.sort((a, b) => a - b);
      const info = g.debug.renderInfo();
      return {
        median: times[Math.floor(times.length / 2)]!, p95: times[Math.floor(times.length * 0.95)]!, samples: times.length,
        cpu: (info.cpuMs - before.cpuMs) / Math.max(1, info.frames - before.frames), vantages: g.map!.vantages.length, ...info,
      };
    });
    report.push(`${land}: ${stats.calls} draw calls, ${stats.triangles} triangles, frame ${stats.median.toFixed(1)} ms median / ${stats.p95.toFixed(1)} ms p95 (${stats.samples} frames), ` +
      `main thread ${stats.cpu.toFixed(2)} ms/frame, world build ${stats.buildMs.toFixed(0)} ms`);
    expect(stats.calls, land).toBeLessThan(100);
    expect(stats.vantages, land).toBeGreaterThanOrEqual(3);
  }
  // Numbers for docs/PROGRESS.md (software rendering in CI; see the note there).
  console.log(report.join('\n'));
  expect(errors).toEqual([]);
});
