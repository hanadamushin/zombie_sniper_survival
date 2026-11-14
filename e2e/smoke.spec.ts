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
  await expect.poll(() => page.evaluate(() => window.__game!.state!.player.cell), { timeout: 30_000 }).toBe(target.cell);
  await expect(page.getByTestId('travel-status')).toBeHidden();
  expect((await clock(page)) - t0).toBeGreaterThanOrEqual(180);
  expect(await page.evaluate(() => window.__game!.state!.world.cells.visited[window.__game!.state!.player.cell])).toBe(true);

  // Other map views render too.
  await page.getByTestId('view-loot').click();
  await page.getByTestId('view-pop').click();
  expect(errors).toEqual([]);
});
