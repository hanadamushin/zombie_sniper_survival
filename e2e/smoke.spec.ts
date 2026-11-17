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
  test.setTimeout(120_000); // two map generations; slow when the suite runs in parallel
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
  await expect.poll(() => page.evaluate(() => window.__game!.state!.player.pos[2]), { timeout: 30_000 }).toBeLessThan(510);
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
  await expect.poll(() => page.evaluate(() => window.__game!.state!.player.cell), { timeout: 60_000 }).toBe(target.cell);
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
      g.renderer.setAutoResolution(false); // measure at full resolution, without buffer reallocations in the sample
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

// ---------------------------------------------------------------------------------------------
// 04: sniping
// ---------------------------------------------------------------------------------------------

test('firing range: scope, a zeroed head shot at 300 m, ears, and 600 zombies within budget', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await page.goto('/?range=1');
  await page.waitForFunction(() => (window.__game?.state?.tactical?.zombies.length ?? 0) >= 12);
  await expect(page.getByTestId('hud-ammo')).toHaveAttribute('data-mag', '5');

  // Scope up, prone, zero 300 m, full zoom. The debug input stands in for the mouse (no pointer lock headless).
  await page.evaluate(() => {
    const g = window.__game!;
    g.state!.flags.noSway = true;
    g.debug.setInput({ scope: true, stance: 'prone', zoomDelta: 30, zeroDelta: 2 });
  });
  await page.waitForFunction(() => window.__game!.state!.player.aim.scopeT === 1 && window.__game!.state!.player.eye < 0.31);
  await expect(page.getByTestId('hud-zero')).toHaveAttribute('data-zero', '300');
  expect(await page.evaluate(() => window.__game!.renderer.view.fov())).toBeCloseTo((2 * Math.atan(Math.tan((20 * Math.PI) / 180) / 12) * 180) / Math.PI, 3);

  // Put the reticle on the head of the 300 m target and fire: with the zero set, no hold-over is needed.
  const before = await page.evaluate(() => {
    const s = window.__game!.state!;
    const p = s.player;
    const z = s.tactical!.zombies.find((t) => t.dummy === 1 && t.kind === 'walker' && Math.abs(p.pos[2] - t.pos[2] - 300) < 1)!;
    const dx = z.pos[0] - p.pos[0];
    const dz = z.pos[2] - p.pos[2];
    p.yaw = Math.atan2(-dx, -dz);
    p.pitch = Math.atan2(1.75 - 0.125 - (p.pos[1] + p.eye), Math.hypot(dx, dz));
    window.__game!.debug.setInput({ fire: true });
    return { id: z.id, kills: p.stats.kills };
  });
  await page.waitForFunction((k) => window.__game!.state!.player.stats.kills > k, before.kills, { timeout: 20_000 });
  const after = await page.evaluate(() => ({ ...window.__game!.state!.player.stats, mag: window.__game!.state!.player.weapon.mag }));
  expect(after.headshots).toBe(1);
  expect(after.shots).toBe(1);
  expect(after.mag).toBe(4);
  await page.evaluate(() => window.__game!.debug.setInput(null));

  // Walk up to the body (teleport) and hold E.
  await page.waitForFunction(() => window.__game!.state!.tactical!.corpses.length === 1, null, { timeout: 20_000 });
  await expect(page.getByTestId('hud-earhint')).toBeVisible();
  await page.evaluate(() => {
    const g = window.__game!;
    const c = g.state!.tactical!.corpses[0]!;
    g.debug.teleport(c.pos[0] + 1, c.pos[2] + 1);
    g.debug.setInput({ interactHeld: true });
  });
  await expect(page.getByTestId('hud-ears')).toHaveAttribute('data-ears', '2', { timeout: 20_000 });
  await page.evaluate(() => window.__game!.debug.setInput(null));

  // 600 zombies on screen (07c: five times the earlier 150): draw calls, triangles and main-thread time (no GPU here; see docs/PROGRESS.md).
  const stats = await page.evaluate(async () => {
    const g = window.__game!;
    const auto = g.renderer.resolutionScale(); // what the automatic resolution settled on so far (software rendering)
    g.renderer.setAutoResolution(false);
    g.debug.teleport(512, 700, 0, 0);
    const have = g.state!.tactical!.zombies.length;
    g.debug.spawnZombies(600 - have, 160);
    for (const z of g.state!.tactical!.zombies) if (!z.dummy) z.dummy = 1; // keep them on their feet for the measurement
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const a = g.debug.renderInfo();
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const b = g.debug.renderInfo();
    // The budget is judged on one sim step + one draw submission measured directly (CLAUDE.md);
    // the frame average depends on the software-rendered frame rate and is printed for reference.
    const s = g.state!;
    // 07c: steady frames only — wait until the neighbouring areas are built.
    for (let w = 0; w < 600 && g.debug.renderInfo().pending > 0; w++) await new Promise((r) => setTimeout(r, 50));
    let t0 = performance.now();
    for (let i = 0; i < 300; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
    const tick = (performance.now() - t0) / 300;
    t0 = performance.now();
    for (let i = 0; i < 20; i++) g.renderer.draw(s, 0, 0);
    const draw = (performance.now() - t0) / 20;
    return { zombies: s.tactical!.zombies.length, calls: b.calls, triangles: b.triangles, cpu: (b.cpuMs - a.cpuMs) / Math.max(1, b.frames - a.frames), tick, draw, scale: auto };
  });
  console.log(`range, ${stats.zombies} zombies: ${stats.calls} draw calls, ${stats.triangles} triangles, sim step ${stats.tick.toFixed(3)} ms + draw submission ${stats.draw.toFixed(2)} ms (frame average incl. UI: ${stats.cpu.toFixed(2)} ms; automatic scale had reached ${stats.scale})`);
  expect(stats.zombies).toBeGreaterThanOrEqual(600); // a respawned target may come back meanwhile
  expect(stats.calls).toBeLessThan(150);
  expect(stats.triangles).toBeLessThan(500_000);
  expect(stats.tick + stats.draw).toBeLessThan(4);
  expect(errors).toEqual([]);
});

test('home cell: zombies are out there, one shot fired from the start position', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0');
  await startNewGame(page);
  await page.waitForFunction(() => (window.__game?.state?.tactical?.zombies.length ?? 0) >= 10, null, { timeout: 60_000 });
  const z0 = await page.evaluate(() => window.__game!.state!.world.cells.Z[window.__game!.state!.player.cell]!);
  expect(z0).toBeGreaterThanOrEqual(40);
  await page.evaluate(() => window.__game!.debug.setInput({ scope: true }));
  await page.waitForFunction(() => window.__game!.state!.player.aim.scopeT === 1);
  await page.evaluate(() => window.__game!.debug.setInput({ fire: true }));
  await page.waitForFunction(() => window.__game!.state!.player.stats.shots === 1);
  await expect(page.getByTestId('hud-ammo')).toHaveAttribute('data-mag', '4');
  await expect(page.getByTestId('hud-ammo')).toHaveAttribute('data-ammo', '100');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// 05: colony
// ---------------------------------------------------------------------------------------------

test('colony: meet someone, hire, assign jobs, days pass — food and materials in, wages out; 60 survivors within budget', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0&res=fixed');
  await startNewGame(page);
  // Gear and the medical job are tech-gated since 07 (e2e/research.spec.ts covers the gating).
  await page.evaluate(() => {
    window.__game!.state!.flags.unlockAll = true;
  });
  await page.waitForFunction(() => (window.__game?.state?.tactical?.hideouts?.length ?? 0) > 0, null, { timeout: 60_000 });

  // Someone is hiding at a search point: the HUD senses them, E talks to them.
  const h0 = await page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    const hide = s.tactical!.hideouts![0]!;
    g.debug.teleport(hide.pos[0] + 1, hide.pos[1] + 1, 0, 0);
    return s.world.cells.H[s.player.cell]!;
  });
  await expect(page.getByTestId('hud-act')).toHaveAttribute('data-kind', 'talk');
  await page.screenshot({ path: 'test-results/colony-hideout.png' });
  await page.evaluate(() => window.__game!.debug.setInput({ interact: true }));
  await page.waitForFunction(() => window.__game!.state!.colony.candidates.length > 0);
  const found = await page.evaluate(() => window.__game!.state!.colony.candidates.length);
  expect(await page.evaluate(() => window.__game!.state!.world.cells.H[window.__game!.state!.player.cell]!)).toBe(h0 - found);
  await expect(page.getByTestId('hud-toast')).toBeVisible();

  // Back at the camp with ears in the pocket: hire from the command layer.
  await page.evaluate(() => {
    const g = window.__game!;
    g.debug.teleport(512, 530, 0, 0);
    g.state!.player.inv.ears = 150;
  });
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('command-panel')).toBeVisible();
  await page.getByTestId('tab-hire').click();
  await page.getByTestId('candidate-row').first().getByRole('button').click();
  await page.getByTestId('tab-people').click();
  await expect(page.getByTestId('survivor-row')).toHaveCount(1);
  const first = await page.evaluate(() => window.__game!.state!.colony.survivors[0]!.id);
  await page.getByTestId(`job-${first}`).selectOption('farming');
  await page.waitForFunction(() => window.__game!.state!.colony.survivors[0]!.job === 'farming');

  // More hands, then two days go by.
  const before = await page.evaluate(() => {
    const g = window.__game!;
    g.debug.addSurvivors(1, 'farming');
    g.debug.addSurvivors(2, 'scavenging');
    g.debug.addSurvivors(1, 'crafting');
    const s = g.state!;
    s.colony.stock.ears += 300;
    // (06) Nobody is on watch in this test: keep the nightly visitors away so that the two days are about the economy.
    s.world.cells.Z[s.world.homeCell!] = 0;
    // ...and those already on the map too (since 07b+ there are 80 or so; some would wander into the camp).
    s.tactical!.zombies.length = 0;
    for (let i = 0; i < 2 * 1440 * 4; i++) g.sim.tick(s, 0.25, { ...g.debug.noInput });
    return { survivors: s.colony.survivors.length };
  });
  expect(before.survivors).toBe(5);
  const after = await page.evaluate(() => {
    const c = window.__game!.state!.colony;
    const sum = (f: (d: (typeof c.ledger)[number]) => number): number => c.ledger.reduce((s, d) => s + f(d), 0);
    return {
      wages: sum((d) => d.wages), foodBought: sum((d) => d.food), foodIn: sum((d) => d.flow?.food?.[0] ?? 0), woodIn: sum((d) => d.flow?.wood?.[0] ?? 0),
      wood: c.stock.wood, log: c.log.length, days: c.ledger.length,
    };
  });
  expect(after.wages).toBeGreaterThan(10);
  expect(after.foodBought).toBeGreaterThan(3);
  expect(after.foodIn).toBeGreaterThan(5);
  expect(after.wood).toBeGreaterThan(1);
  expect(after.days).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: 'test-results/colony-people.png' });
  await page.getByTestId('tab-economy').click();
  await expect(page.getByTestId('ledger').locator('tbody tr')).toHaveCount(after.days);
  await page.screenshot({ path: 'test-results/colony-economy.png' });

  // Send the two scavengers out with pipes.
  await page.getByTestId('tab-expedition').click();
  const scavs = await page.evaluate(() => window.__game!.state!.colony.survivors.filter((s) => s.job === 'scavenging').map((s) => s.id));
  for (const id of scavs) await page.getByTestId(`member-${id}`).check();
  await expect(page.getByTestId('exp-estimate')).toBeVisible();
  await page.screenshot({ path: 'test-results/colony-expedition.png' });
  await page.getByTestId('exp-send').click();
  await expect(page.getByTestId('expedition-running')).toHaveCount(1);
  await page.getByTestId('tab-log').click();
  await expect(page.getByTestId('colony-log')).toContainText('出発した');
  await page.screenshot({ path: 'test-results/colony-log.png' });

  // 60 survivors at work in the camp at noon, seen from the edge: budget check (no GPU here: draw calls,
  // triangles and main-thread time, not fps).
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'tactical' }));
  await expect(page.getByTestId('mode-tactical')).toBeVisible();
  // Software rendering makes frames so long here that a "frame" bundles several sim steps and a UI sync,
  // so the per-frame average is only logged; the budget is checked on one sim step + one draw submission.
  const sample = (): Promise<{ calls: number; triangles: number; cpu: number; tick: number; draw: number; n: number }> => page.evaluate(async () => {
    const g = window.__game!;
    const s = g.state!;
    await new Promise((r) => setTimeout(r, 2500));
    const a = g.debug.renderInfo();
    await new Promise((r) => setTimeout(r, 4000));
    const b = g.debug.renderInfo();
    // 07c: steady frames only — wait until the neighbouring areas are built.
    for (let w = 0; w < 600 && g.debug.renderInfo().pending > 0; w++) await new Promise((r) => setTimeout(r, 50));
    let t0 = performance.now();
    for (let i = 0; i < 600; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
    const tick = (performance.now() - t0) / 600;
    t0 = performance.now();
    for (let i = 0; i < 20; i++) g.renderer.draw(s, 0, 1 / 60);
    const draw = (performance.now() - t0) / 20;
    return { calls: b.calls, triangles: b.triangles, cpu: (b.cpuMs - a.cpuMs) / Math.max(1, b.frames - a.frames), tick, draw, n: s.colony.survivors.filter((x) => x.location.kind === 'home').length };
  });
  await page.evaluate(() => {
    const g = window.__game!;
    const jobs = ['farming', 'defense', 'scavenging', 'construction', 'research', 'crafting', 'medical', 'idle'] as const;
    for (let i = g.state!.colony.survivors.length; i < 60; i++) g.debug.addSurvivors(1, jobs[i % jobs.length]);
    g.state!.colony.stock.food = 60;
    g.debug.setClock(10);
    // Let the newcomers walk in from the edge of the camp before looking.
    for (let i = 0; i < 60 * 90; i++) g.sim.tick(g.state!, 1 / 60, { ...g.debug.noInput });
    g.debug.teleport(512, 545, 0, -0.05);
  });
  const perf = await sample();
  const line = (p: typeof perf): string => `${p.calls} draw calls, ${p.triangles} triangles, sim step ${p.tick.toFixed(3)} ms + draw submission ${p.draw.toFixed(2)} ms (frame average incl. UI: ${p.cpu.toFixed(2)} ms)`;
  console.log(`colony camp (tactical), ${perf.n} survivors at home: ${line(perf)}`);
  expect(perf.calls).toBeLessThan(150);
  expect(perf.triangles).toBeLessThan(500_000);
  expect(perf.tick + perf.draw).toBeLessThan(4);
  await page.screenshot({ path: 'test-results/colony-camp.png' });
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'command' }));
  await page.getByTestId('tab-people').click();
  await expect(page.getByTestId('survivor-row')).toHaveCount(60);
  const cmd = await sample();
  console.log(`colony camp (command layer, 60 rows): ${line(cmd)}`);
  expect(cmd.tick + cmd.draw).toBeLessThan(4);
  await page.screenshot({ path: 'test-results/colony-camp-command.png' });
  await page.setViewportSize({ width: 360, height: 640 });
  await page.screenshot({ path: 'test-results/colony-360.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  expect(errors).toEqual([]);
});

test('colony: dying alone is defeat', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0&res=fixed');
  await startNewGame(page);
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
  await page.evaluate(() => {
    const s = window.__game!.state!;
    s.player.hp = 0;
    s.player.aim.deadT = 0.2;
  });
  await expect(page.getByTestId('defeat')).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: 'test-results/colony-defeat.png' });
  expect(errors).toEqual([]);
});
