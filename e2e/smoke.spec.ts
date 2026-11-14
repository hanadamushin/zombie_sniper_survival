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

  await page.getByTestId('new-game').click();
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
  await expect(page.getByTestId('hud-clock')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
