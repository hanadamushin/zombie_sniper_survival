import { expect, test, type Page } from '@playwright/test';

// 08: a new player follows the one-line hints from the first step to the first fence; the defeat
// screen picks the game up from the autosave; settings stick; layouts at 360 and 1920 px; budget.

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

async function startNewGame(page: Page, seed = 12): Promise<void> {
  await page.goto(`/?seed=${seed}&scenario=0&res=fixed`);
  await page.getByTestId('new-game').click();
  await page.getByTestId('intro-skip').click();
  await expect(page.getByTestId('candidate-2')).toBeVisible();
  await page.getByTestId('start-0').click();
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
  await expect(page.getByTestId('area-loading')).toBeHidden();
}

const hint = (page: Page) => page.getByTestId('hint-line');

test('first steps: the hints lead from walking to the first fence', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = trackErrors(page);
  await startNewGame(page);

  // 1. Walk.
  await expect(hint(page)).toHaveAttribute('data-hint', 'move');
  await expect(hint(page)).toContainText('W A S D');
  await expect(page.getByTestId('objectives')).toContainText('歩いてみる');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__game!.state!.flags['seen.tut.move'] === true, null, { timeout: 120_000 });
  await page.keyboard.up('KeyW');

  // 2. Scope and hold the breath (headless: no pointer lock, so the controls are injected).
  await expect(hint(page)).toHaveAttribute('data-hint', 'scope');
  await expect(hint(page)).toContainText('右クリック（または Q）');
  await page.evaluate(() => window.__game!.debug.setInput({ scope: true, holdBreath: true }));
  await page.waitForFunction(() => window.__game!.state!.flags['seen.tut.scope'] === true, null, { timeout: 60_000 });
  // Through the scope only ammunition, breath, zero and magnification remain.
  await expect(page.getByTestId('hud-breath')).toBeVisible();
  await expect(page.getByTestId('hud-ammo')).toBeVisible();
  await expect(page.getByTestId('hud-compass')).toBeHidden();
  await expect(page.getByTestId('hud-top')).toHaveCSS('opacity', '0');
  await page.screenshot({ path: 'test-results/08-scoped.png' });
  await page.evaluate(() => window.__game!.debug.setInput(null));

  // 3. The first shot: the hint names a direction and a distance.
  await expect(hint(page)).toHaveAttribute('data-hint', 'shoot');
  await expect(hint(page)).toContainText(/約 \d+m にゾンビ/);
  await page.screenshot({ path: 'test-results/08-hint-shoot.png' });
  for (let tries = 0; tries < 6; tries++) {
    const aimed = await page.evaluate(() => {
      const g = window.__game!;
      const s = g.state!;
      const p = s.player;
      s.flags.noSway = true;
      p.weapon.mag = Math.max(p.weapon.mag, 3); // R0: a miss into the woods must not leave the rifle empty
      // R0: the start may be a real, wooded area: the target stands in the open middle of the base
      // (flat and clear for 120 m), 70 m from the player, so trees and hills cannot take the shot.
      const mid = 512;
      const zid = g.debug.placeZombie(mid + 70, mid);
      g.debug.teleport(mid, mid, Math.PI / 2, 0);
      const eye = [p.pos[0], p.pos[1] + p.eye, p.pos[2]] as const;
      let best: { z: NonNullable<typeof s.tactical>["zombies"][number]; d: number } | null = null;
      for (const z of s.tactical!.zombies) {
        const d = Math.hypot(z.pos[0] - eye[0], z.pos[2] - eye[2]);
        if (z.state === 'down' || (z.id !== zid && (d < 40 || d > 260))) continue;
        if (z.id === zid || !best || d < best.d) best = { z, d };
        if (z.id === zid) break;
      }
      if (!best) return false;
      const { z, d } = best;
      z.state = 'wander';
      z.t = 30;
      z.goal = [z.pos[0], z.pos[2]];
      const dx = z.pos[0] - eye[0], dz = z.pos[2] - eye[2], dy = z.pos[1] + 1.62 - eye[1];
      const drop = d > 100 ? 0.0009 * ((d - 100) / 100) * (d / 200) : 0;
      g.debug.teleport(p.pos[0], p.pos[2], Math.atan2(-dx, -dz), Math.atan2(dy, d) + drop);
      return true;
    });
    if (!aimed) continue;
    const shots = await page.evaluate(() => window.__game!.state!.player.stats.shots);
    await page.evaluate(() => window.__game!.debug.setInput({ scope: true, holdBreath: true }));
    await page.waitForFunction(() => window.__game!.state!.player.aim.scopeT >= 1, null, { timeout: 30_000 });
    await page.evaluate(() => window.__game!.debug.setInput({ fire: true }));
    await page.waitForFunction((n) => window.__game!.state!.player.stats.shots > n, shots, { timeout: 30_000 });
    await page.evaluate(() => window.__game!.debug.setInput({ fire: false }));
    await page.waitForTimeout(3000);
    if (await page.evaluate(() => window.__game!.state!.player.stats.kills > 0)) break;
  }
  await page.evaluate(() => window.__game!.debug.setInput(null));
  expect(await page.evaluate(() => window.__game!.state!.player.stats.kills)).toBeGreaterThan(0);

  // 4. Ears.
  await expect(hint(page)).toHaveAttribute('data-hint', 'ears');
  await page.waitForFunction(() => window.__game!.state!.tactical!.corpses.some((x) => x.ears > 0), null, { timeout: 30_000 });
  await page.evaluate(() => {
    const g = window.__game!;
    const c = g.state!.tactical!.corpses.find((x) => x.ears > 0)!;
    g.debug.teleport(c.pos[0] + 1, c.pos[2] + 1);
  });
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__game!.state!.player.stats.earsCollected > 0, null, { timeout: 60_000 });
  await page.keyboard.up('KeyE');

  // 5. Meet somebody: the hint points at the smoke.
  await expect(hint(page)).toHaveAttribute('data-hint', 'meet');
  await expect(hint(page)).toContainText('煙');
  await page.evaluate(() => {
    const g = window.__game!;
    const h = g.state!.tactical!.hideouts!.find((x) => !x.met)!;
    g.debug.teleport(h.pos[0] + 1.5, h.pos[1] + 1.5);
  });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__game!.state!.colony.candidates.length > 0, null, { timeout: 20_000 });
  await expect(page.getByTestId('hud-hire-hint')).toBeVisible();
  await expect(page.getByTestId('hud-toast')).toBeVisible();

  // 6. Hire (with enough ears for the fee) and give a job — the star marks the best one.
  await page.evaluate(() => window.__game!.debug.give('ears', 60));
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('command-panel')).toBeVisible();
  await expect(hint(page)).toHaveAttribute('data-hint', 'hire');
  await page.getByTestId('tab-hire').click();
  await page.getByTestId('candidate-row').first().getByRole('button').click();
  await page.waitForFunction(() => window.__game!.state!.colony.survivors.length === 1);
  await page.getByTestId('tab-people').click();
  await expect(hint(page)).toHaveAttribute('data-hint', 'job');
  await expect(page.getByTestId('survivor-row').locator('.rec')).toContainText('★');
  await expect(page.getByTestId('job-summary')).toContainText('待機');
  const id = await page.evaluate(() => window.__game!.state!.colony.survivors[0]!.id);
  await page.getByTestId(`job-${id}`).selectOption('construction');

  // 7. The first fence: the palette brings the base into view; a drag lays a run of blueprints.
  await expect(hint(page)).toHaveAttribute('data-hint', 'fence');
  await expect(hint(page)).toContainText('木柵');
  await page.getByTestId('tab-build').click();
  await page.getByTestId('build-palisade').click();
  await expect(page.getByTestId('build-tip')).toContainText('木材');
  const g = (await page.getByTestId('build-ground').boundingBox())!;
  const cx = g.x + g.width * 0.3, cy = g.y + g.height * 0.62;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 160, cy, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__game!.state!.build.structures.some((s) => s.def === 'palisade'));
  await expect(hint(page)).toHaveAttribute('data-hint', 'research');
  await expect(page.getByTestId('objectives')).toContainText('研究を始める');
  await page.screenshot({ path: 'test-results/08-first-fence.png' });

  // The seen flags are part of the save: a reload does not start the hints over.
  expect(await page.evaluate(() => Object.keys(window.__game!.state!.flags).filter((k) => k.startsWith('seen.tut.')).sort())).toEqual(['seen.tut.move', 'seen.tut.scope']);
  expect(errors).toEqual([]);
});

test('defeat: the game can be picked up from the last autosave', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await startNewGame(page);
  // An autosave to come back to (the menu saves on open).
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mode-menu')).toBeVisible();
  // Resume with the button: the pointer lock is asked for once (08 fixed a double request that made
  // Chromium drop the lock at once, which read as Esc and opened the menu again).
  await page.getByTestId('menu-resume').click();
  await expect(page.getByTestId('mode-tactical')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('mode-menu')).toHaveCount(0);
  const before = await page.evaluate(() => window.__game!.state!.time.day * 1440 + window.__game!.state!.time.minute);
  await page.evaluate(() => {
    const s = window.__game!.state!;
    s.player.hp = 0;
    s.player.aim.deadT = 0.2;
  });
  await expect(page.getByTestId('defeat')).toBeVisible({ timeout: 30_000 });
  // The menu (which autosaves) cannot overwrite the autosave of a lost game.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mode-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mode-menu')).toHaveCount(0);
  await expect(page.getByTestId('defeat-retry')).toBeVisible();
  await page.screenshot({ path: 'test-results/08-defeat.png' });
  await page.getByTestId('defeat-retry').click();
  await expect(page.getByTestId('defeat')).toBeHidden({ timeout: 30_000 });
  const after = await page.evaluate(() => ({ defeat: window.__game!.state!.flags.defeat === true, at: window.__game!.state!.time.day * 1440 + window.__game!.state!.time.minute }));
  expect(after.defeat).toBe(false);
  expect(after.at).toBeLessThanOrEqual(before + 2);
  expect(errors).toEqual([]);
});

test('sound: a key press starts the audio, and the test sound is clearly audible without clipping', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(await page.evaluate(() => window.__game!.debug.audioStatus().state)).toBe('none');
  await page.keyboard.press('KeyA'); // any gesture
  await expect.poll(() => page.evaluate(() => window.__game!.debug.audioStatus().state)).toBe('running');
  await page.waitForTimeout(300); // the output settles just after the context starts
  // The title screen draws nothing, so the meter can be read often enough to catch the shot.
  const peak = await page.evaluate(async () => {
    const d = window.__game!.debug;
    d.audioTest();
    let max = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 1500) {
      max = Math.max(max, d.audioStatus().peak);
      await new Promise((r) => setTimeout(r, 5));
    }
    return max;
  });
  console.log(`08 test sound peak ${peak.toFixed(2)}`);
  expect(peak).toBeGreaterThan(0.4);
  expect(peak).toBeLessThan(1.05);
  expect(errors).toEqual([]);
});

test('settings stick, the help has its pages, problems and notices open from the top bar', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await startNewGame(page);
  await page.keyboard.press('Escape');
  await page.getByTestId('menu-tab-settings').click();
  await expect(page.getByTestId('set-audio-state')).toHaveAttribute('data-state', 'running');
  await page.getByTestId('set-mouse').fill('1.5');
  await page.getByTestId('set-scope-toggle').click();
  await page.getByTestId('set-autores').uncheck();
  await expect(page.getByTestId('set-scale')).toBeVisible();
  await page.screenshot({ path: 'test-results/08-settings.png' });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('zss.settings.v1') ?? '{}'));
  expect(stored.mouseSens).toBe(1.5);
  expect(stored.scopeMode).toBe('toggle');
  expect(stored.autoResolution).toBe(false);
  expect(stored.keyLookSpeed).toBe(1);
  await page.getByTestId('menu-tab-help').click();
  for (const tab of ['jobs', 'zombies', 'ballistics', 'goal']) {
    await page.getByTestId(`help-tab-${tab}`).click();
    await expect(page.getByTestId('help')).not.toBeEmpty();
  }
  await expect(page.getByTestId('help')).toContainText('司令部');
  await page.getByTestId('help-tab-zombies').click();
  await expect(page.getByTestId('help')).toContainText('肥大型');
  await page.screenshot({ path: 'test-results/08-help.png' });
  await page.getByTestId('menu-tab-game').click();
  // The command layer: the pointer is free there (in the field it is locked to the view).
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'command' }));
  await expect(page.getByTestId('mode-command')).toBeVisible();
  await page.evaluate(() => {
    const s = window.__game!.state!;
    s.player.inv.ammo = 3;
  });
  await page.getByTestId('hud-problems').click();
  await expect(page.getByTestId('pop-warnings')).toContainText('弾薬が少ない');
  await page.getByTestId('hud-notices').click();
  await expect(page.getByTestId('pop-notices')).toBeVisible();
  // Back to the defaults for the other tests in this browser profile.
  await page.evaluate(() => localStorage.removeItem('zss.settings.v1'));
  expect(errors).toEqual([]);
});

test('layouts at 360 and 1920 px; budget with the new HUD and the tracer', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await startNewGame(page);
  for (const [w, h] of [[360, 740], [1920, 1080]] as const) {
    await page.setViewportSize({ width: w, height: h });
    for (const mode of ['tactical', 'command', 'world'] as const) {
      await page.evaluate((m) => window.__game!.dispatch({ type: 'setMode', mode: m }), mode);
      await expect(page.getByTestId(`mode-${mode}`)).toBeVisible();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `test-results/08-${mode}-${w}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
      // Nothing of the HUD hangs off the screen.
      const off = await page.evaluate((vw) => [...document.querySelectorAll('.hud-top, .hud-box, .cmd-bar, .command-panel, .hint-line, .objectives')]
        .map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && (r.left < -1 || r.right > vw + 1)).length, w);
      expect(off).toBe(0);
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'tactical' }));

  // Budget: rounds in flight (tracers), smoke, toasts and the per-frame HUD.
  const perf = await page.evaluate(async () => {
    const g = window.__game!;
    const s = g.state!;
    s.flags.noSway = true;
    for (let w = 0; w < 600 && g.debug.renderInfo().pending > 0; w++) await new Promise((r) => setTimeout(r, 50));
    g.debug.setInput({ scope: true, fire: true });
    for (let i = 0; i < 40 && s.tactical!.bullets.length === 0; i++) await new Promise((r) => setTimeout(r, 100));
    const inFlight = s.tactical!.bullets.length;
    g.renderer.draw(s, 0, 1 / 60);
    const info = g.debug.renderInfo();
    let t0 = performance.now();
    for (let i = 0; i < 300; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
    const tick = (performance.now() - t0) / 300;
    t0 = performance.now();
    for (let i = 0; i < 20; i++) g.renderer.draw(s, 0, 1 / 60);
    const draw = (performance.now() - t0) / 20;
    g.debug.setInput(null);
    return { inFlight, calls: info.calls, triangles: info.triangles, tick, draw, ui: g.debug.uiPaintMs(20) };
  });
  console.log(`08 HUD + tracer: ${perf.calls} draw calls, ${perf.triangles} triangles, sim ${perf.tick.toFixed(3)} ms + draw ${perf.draw.toFixed(2)} ms, one UI paint ${perf.ui.toFixed(2)} ms (bullets in flight at the sample: ${perf.inFlight})`);
  expect(perf.calls).toBeLessThan(150);
  expect(perf.triangles).toBeLessThan(500_000);
  expect(perf.tick + perf.draw).toBeLessThan(4);
  expect(errors).toEqual([]);
});
