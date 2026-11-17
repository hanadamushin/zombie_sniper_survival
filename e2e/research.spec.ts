import { expect, test, type Page } from '@playwright/test';

// 07: the research tab (tree, allocation, a branch and its confirmation), unlocks reaching the build
// palette, the rifle variants and the rangefinder on the firing range, the declaration and its ending.

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

async function startNewGame(page: Page): Promise<void> {
  await page.goto('/?seed=12&scenario=0&res=fixed');
  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.getByTestId('intro-skip').click();
  await page.getByTestId('start-0').click();
  await page.waitForFunction(() => window.__game?.map != null);
}

/** Run the simulation by hand (much faster than waiting for software-rendered frames). */
const runSim = (page: Page, seconds: number) => page.evaluate((n) => {
  const g = window.__game!;
  for (let i = 0; i < n * 60; i++) g.sim.tick(g.state!, 1 / 60, { ...g.debug.noInput });
}, seconds);

test('research: from the palisade to earthworks to steel walls, an exclusive branch, and the budget', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await startNewGame(page);
  await page.evaluate(() => {
    const g = window.__game!;
    g.state!.world.cells.Z[g.state!.world.homeCell!] = 0; // a quiet cell: this is about research
    g.dispatch({ type: 'setMode', mode: 'command' });
    g.dispatch({ type: 'setSpeed', speed: 0 });
  });
  await expect(page.getByTestId('mode-command')).toBeVisible();

  // A fresh colony can raise a fence and nothing better.
  await page.getByTestId('tab-build').click();
  await expect(page.getByTestId('build-palisade')).toBeEnabled();
  await expect(page.getByTestId('build-earthwork')).toBeDisabled();
  await expect(page.getByTestId('build-steelWall')).toBeDisabled();

  // The tree: pick the basics of earthworks, start it.
  await page.getByTestId('tab-research').click();
  await expect(page.getByTestId('research-tab')).toHaveAttribute('data-era', '0');
  await expect(page.getByTestId('tech-F1')).toHaveAttribute('data-status', 'available');
  await expect(page.getByTestId('tech-F3')).toHaveAttribute('data-status', 'unavailable');
  await page.getByTestId('tech-F3').click();
  await expect(page.getByTestId('tech-why')).toBeVisible();
  await page.getByTestId('tech-F1').click();
  await page.getByTestId('tech-start').click();
  await expect(page.getByTestId('tech-F1')).toHaveAttribute('data-status', 'active');

  // Researchers do the work: two of them for a few game hours, then the rest of the points at once.
  await page.evaluate(() => {
    const g = window.__game!;
    g.debug.addSurvivors(2, 'research');
    g.state!.colony.stock.food = 40;
    g.state!.colony.stock.ears = 300;
    g.debug.setClock(8);
  });
  await runSim(page, 4 * 60);
  const rp = await page.evaluate(() => window.__game!.state!.research.active.F?.rp ?? 0);
  expect(rp).toBeGreaterThan(10);
  await page.screenshot({ path: 'test-results/research-tree.png' });
  await page.evaluate(() => window.__game!.debug.research(400));
  await expect(page.getByTestId('tech-F1')).toHaveAttribute('data-status', 'done');
  await page.getByTestId('tab-build').click();
  await expect(page.getByTestId('build-earthwork')).toBeEnabled();
  await expect(page.getByTestId('build-moat')).toBeEnabled();
  await expect(page.getByTestId('build-steelWall')).toBeDisabled();

  // The rest of the survival era opens the settled era; metal walls follow.
  await page.evaluate(() => window.__game!.debug.grantTech(['F2', 'W1', 'W2', 'A1', 'S1']));
  await page.getByTestId('tab-research').click();
  await expect(page.getByTestId('research-tab')).toHaveAttribute('data-era', '1');
  await page.getByTestId('tech-F3').click();
  await page.getByTestId('tech-start').click();
  await page.evaluate(() => {
    const g = window.__game!;
    g.dispatch({ type: 'setAllocation', allocation: { F: 100, W: 0, A: 0, S: 0, C: 0 } });
    g.sim.applyCommands(g.state!);
    g.debug.research(600);
  });
  await expect(page.getByTestId('tech-F3')).toHaveAttribute('data-status', 'done');
  await page.getByTestId('tab-build').click();
  await expect(page.getByTestId('build-steelWall')).toBeEnabled();
  await expect(page.getByTestId('build-concreteWall')).toBeDisabled();
  // ... and it can really be put on the ground.
  const placed = await page.evaluate(() => {
    const g = window.__game!;
    g.dispatch({ type: 'placeBlueprint', def: 'steelWall', tx: 118, ty: 118, rot: 0 });
    g.sim.applyCommands(g.state!);
    return g.state!.build.structures.some((s) => s.def === 'steelWall');
  });
  expect(placed).toBe(true);

  // An exclusive branch asks first, showing both sides and what is lost.
  await page.evaluate(() => window.__game!.debug.grantTech(['W4']));
  await page.getByTestId('tab-research').click();
  await page.getByTestId('tech-W5a').click();
  await page.getByTestId('tech-start').click();
  await expect(page.getByTestId('branch-dialog')).toBeVisible();
  await expect(page.getByTestId('branch-lose')).toContainText('半自動化');
  await page.screenshot({ path: 'test-results/research-branch.png' });
  await page.getByTestId('branch-cancel').click();
  expect(await page.evaluate(() => window.__game!.state!.research.active.W)).toBeUndefined();
  await page.getByTestId('tech-start').click();
  await page.getByTestId('branch-confirm').click();
  await expect(page.getByTestId('tech-W5a')).toHaveAttribute('data-status', 'active');
  await page.evaluate(() => {
    const g = window.__game!;
    g.dispatch({ type: 'setAllocation', allocation: { F: 0, W: 100, A: 0, S: 0, C: 0 } });
    g.sim.applyCommands(g.state!);
    g.debug.research(600);
    g.debug.research(600);
  });
  await expect(page.getByTestId('tech-W5a')).toHaveAttribute('data-status', 'done');
  await expect(page.getByTestId('tech-W5b')).toHaveAttribute('data-status', 'locked');
  await page.getByTestId('tech-W5b').click();
  await expect(page.getByTestId('tech-why')).toBeVisible();
  expect(await page.evaluate(() => window.__game!.state!.research.locked)).toEqual(['W5b']);

  // Allocation sliders keep a total of 100.
  await page.getByTestId('alloc-S').fill('60');
  await page.waitForFunction(() => Math.abs(window.__game!.state!.research.allocation.S - 60) < 1e-6);
  const alloc = await page.evaluate(() => window.__game!.state!.research.allocation);
  expect(alloc.S).toBeCloseTo(60, 6);
  expect(alloc.F + alloc.W + alloc.A + alloc.S + alloc.C).toBeCloseTo(100, 6);
  await page.screenshot({ path: 'test-results/research-locked.png' });

  // Budget with the tree on screen (no GPU here: draw calls, triangles, one sim step + one draw submission).
  const perf = await page.evaluate(async () => {
    const g = window.__game!;
    const s = g.state!;
    await new Promise((r) => setTimeout(r, 2500));
    const info = g.debug.renderInfo();
    // 07c: steady frames only — wait until the neighbouring areas are built.
    for (let w = 0; w < 600 && g.debug.renderInfo().pending > 0; w++) await new Promise((r) => setTimeout(r, 50));
    let t0 = performance.now();
    for (let i = 0; i < 600; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
    const tick = (performance.now() - t0) / 600;
    t0 = performance.now();
    for (let i = 0; i < 20; i++) g.renderer.draw(s, 0, 1 / 60);
    const draw = (performance.now() - t0) / 20;
    return { calls: info.calls, triangles: info.triangles, tick, draw };
  });
  console.log(`research tab open: ${perf.calls} draw calls, ${perf.triangles} triangles, sim step ${perf.tick.toFixed(3)} ms + draw submission ${perf.draw.toFixed(2)} ms`);
  expect(perf.calls).toBeLessThan(150);
  expect(perf.triangles).toBeLessThan(500_000);
  expect(perf.tick + perf.draw).toBeLessThan(4);

  // Narrow screens: the tree scrolls inside its own box.
  await page.setViewportSize({ width: 360, height: 640 });
  await page.screenshot({ path: 'test-results/research-360.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  expect(errors).toEqual([]);
});

test('firing range: the semi-automatic empties ten rounds fast; optics show the distance and the hold-over', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await page.goto('/?range=1');
  await page.waitForFunction(() => (window.__game?.state?.tactical?.zombies.length ?? 0) >= 12);
  // Bolt action first: three seconds of hammering the trigger.
  const hammer = (): Promise<number> => page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    s.player.weapon.mag = 10;
    s.player.weapon.boltT = 0;
    const before = s.player.stats.shots;
    for (let i = 0; i < 180; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput, scope: true, fire: i % 6 < 3 });
    return s.player.stats.shots - before;
  });
  expect(await hammer()).toBe(3);
  await page.evaluate(() => window.__game!.debug.grantTech(['W5b', 'W6a', 'S2']));
  expect(await hammer()).toBeGreaterThanOrEqual(8);
  expect(await page.evaluate(() => window.__game!.state!.research.locked)).toEqual(expect.arrayContaining(['W5a', 'W6b']));

  // Look through the scope at the 300 m target: the rangefinder reads it, the records name it.
  await page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    s.flags.noSway = true;
    const p = s.player;
    const z = s.tactical!.zombies.find((t) => t.dummy === 1 && t.kind === 'walker' && Math.abs(p.pos[2] - t.pos[2] - 300) < 1)!;
    const dx = z.pos[0] - p.pos[0], dz = z.pos[2] - p.pos[2];
    p.yaw = Math.atan2(-dx, -dz);
    p.pitch = Math.atan2(z.pos[1] + 1.2 - (p.pos[1] + p.eye), Math.hypot(dx, dz));
    g.debug.setInput({ scope: true, zoomDelta: 40 });
  });
  await page.waitForFunction(() => window.__game!.state!.player.aim.scopeT === 1 && window.__game!.state!.player.aim.recoil[1] === 0);
  await expect(page.getByTestId('hud-zoom')).toContainText('24.0');
  const info = page.getByTestId('hud-scope-info');
  await expect(info).toBeVisible();
  const range = Number(await info.getAttribute('data-range'));
  expect(Math.abs(range - 300)).toBeLessThan(3);
  await expect(info).toContainText('mil');
  await expect(page.getByTestId('hud-target')).toContainText('歩行型');
  await page.screenshot({ path: 'test-results/research-rangefinder.png' });
  expect(errors).toEqual([]);
});

test('victory: with every condition met the capitol is the declaration; the ending shows and the game goes on', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await startNewGame(page);
  await page.evaluate(() => {
    const g = window.__game!;
    g.state!.world.cells.Z[g.state!.world.homeCell!] = 0;
    g.dispatch({ type: 'setMode', mode: 'command' });
    g.dispatch({ type: 'setSpeed', speed: 0 });
    g.debug.setClock(9);
    g.debug.fulfilVictory('C9', false);
    g.state!.colony.stock.food = 60;
  });
  await page.getByTestId('tab-research').click();
  const progress = page.getByTestId('victory-progress');
  await expect(progress).toHaveAttribute('data-ready', 'true');
  await expect(progress.locator('li[data-key="capitol"]')).toHaveAttribute('data-ok', 'false');
  await runSim(page, 61);
  await expect(page.getByTestId('ending')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/victory-progress.png' });

  // The capitol is unlocked by the goal technology; once it stands, the next hour brings the declaration.
  await page.getByTestId('tab-build').click();
  await page.getByTestId('build-cat-civic').click();
  await expect(page.getByTestId('build-capitol')).toBeEnabled();
  await page.evaluate(() => window.__game!.debug.build('capitol', 120, 130));
  await runSim(page, 61);
  const ending = page.getByTestId('ending');
  await expect(ending).toBeVisible();
  await expect(ending).toHaveAttribute('data-tech', 'C9');
  await expect(page.getByTestId('ending-text')).toContainText('連邦');
  await expect(page.getByTestId('end-stats')).toContainText('生存者 60 人');
  await page.screenshot({ path: 'test-results/victory-ending.png' });

  await page.getByTestId('ending-continue').click();
  await expect(ending).toHaveCount(0);
  const day = await page.evaluate(() => window.__game!.state!.time.day);
  await runSim(page, 120);
  await expect(ending).toHaveCount(0);
  expect(await page.evaluate(() => window.__game!.state!.flags.defeat)).toBeFalsy();
  expect(await page.evaluate(() => window.__game!.state!.research.victory?.day)).toBe(day);
  await page.getByTestId('tab-research').click();
  await expect(page.getByTestId('victory-progress')).toHaveAttribute('data-won', 'true');
  expect(errors).toEqual([]);
});
