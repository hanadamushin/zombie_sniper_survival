import { expect, test, type Page } from '@playwright/test';

// 09: the worst case within budget (a horde at the walls of a large base), nothing piling up over a
// long session (cell after cell, day after day), and the page behaving when it is resized, hidden
// and shown again. Budget: draw calls < 150, triangles < 500,000, one sim step + one draw
// submission < 4 ms (CLAUDE.md; the development machine has no GPU, so no frame rates).

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
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
}

/** One sim step (mean of 600) and one draw submission (median of 20), as the 05 e2e measures them. */
const sample = (page: Page) => page.evaluate(async () => {
  const g = window.__game!;
  const s = g.state!;
  for (let w = 0; w < 600 && g.debug.renderInfo().pending > 0; w++) await new Promise((r) => setTimeout(r, 50));
  let t0 = performance.now();
  for (let i = 0; i < 600; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
  const tick = (performance.now() - t0) / 600;
  const times: number[] = [];
  for (let i = 0; i < 20; i++) {
    t0 = performance.now();
    g.renderer.draw(s, 0, 1 / 60);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const info = g.debug.renderInfo();
  return { calls: info.calls, triangles: info.triangles, tick, draw: times[10]!, worst: times[19]! };
});

test('worst case: 120 raiders, 60 survivors, 1,000 wall tiles and 200 bodies stay within budget', async ({ page }) => {
  test.setTimeout(420_000);
  const errors = trackErrors(page);
  await startNewGame(page);
  const setup = await page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    const d = g.debug;
    s.flags.unlockAll = true;
    const X = 127, Y = 124;
    s.build.structures = s.build.structures.filter((b) => b.def !== 'farm');
    const free = (x: number, y: number): boolean => !s.build.structures.some((b) => b.tx === x && b.ty === y);
    const ring = (r: number, def: (x: number, y: number) => string): void => {
      for (let i = -r; i <= r; i++) for (const [x, y] of [[X + i, Y - r], [X + i, Y + r], [X - r, Y + i], [X + r, Y + i]] as const) if (free(x, y)) d.build(def(x, y), x, y);
    };
    // Eight rings in four materials, each with a gate to the south: a little over a thousand tiles.
    const mats = ['palisade', 'palisade', 'earthwork', 'earthwork', 'steelWall', 'steelWall', 'concreteWall', 'concreteWall'];
    const gates = ['gateWood', 'gateWood', 'gateEarth', 'gateEarth', 'gateSteel', 'gateSteel', 'gateConcrete', 'gateConcrete'];
    [8, 11, 14, 17, 20, 22, 24, 26].forEach((r, i) => ring(r, (x, y) => (x === X && y === Y + r ? gates[i]! : mats[i]!)));
    for (const [x, y] of [[X - 3, Y + 19], [X + 3, Y + 19], [X - 12, Y + 19], [X + 12, Y + 19], [X - 3, Y - 19], [X + 3, Y - 19]] as const) d.build('tower', x, y);
    const jobs = ['defense', 'farming', 'construction', 'research', 'crafting', 'scavenging'] as const;
    for (let i = 0; i < 60; i++) d.addSurvivors(1, jobs[i % jobs.length]);
    d.give('ammo', 400);
    d.give('food', 60);
    s.player.hp = 1e9;
    d.setClock(14);
    s.tactical!.zombies.length = 0;
    s.tactical!.spawnT = 1e9;
    d.horde(260, Math.PI);
    return { walls: s.build.structures.filter((b) => /palisade|earthwork|Wall|gate/.test(b.def)).length };
  });
  expect(setup.walls).toBeGreaterThanOrEqual(1000);

  // Let the horde reach the walls and fill the map up to its cap; then lay the bodies out before the gate.
  const scene = await page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    const raiders = (): number => s.tactical!.zombies.filter((z) => z.raid && z.state !== 'down').length;
    let started = false;
    for (let i = 0; i < 60 * 400 && raiders() < 115; i++) {
      g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
      started ||= s.build.raid !== null;
      if (started && (!s.build.raid || s.build.raid.toSpawn <= 0)) break;
    }
    const t = s.tactical!;
    const C = 200 - t.corpses.length;
    for (let i = 0; i < C; i++) {
      const a = (i / Math.max(1, C)) * Math.PI - Math.PI / 2;
      const r = 112 + (i % 7) * 4;
      const x = 510 + Math.sin(a) * r, z = 498 + Math.cos(a) * r;
      t.corpses.push({ id: s.nextId++, pos: [x, g.debug.supportAt(x, z, 1e4), z], ears: 2, expiresDay: s.time.day + 1, expiresMinute: 0, kind: i % 9 === 0 ? 'brute' : 'walker', yaw: i, headshot: i % 2 === 0, crippled: false });
    }
    return { raiders: raiders(), corpses: t.corpses.length, survivors: s.colony.survivors.filter((x) => x.location.kind === 'home').length, raid: s.build.raid?.kind ?? null };
  });
  expect(scene.raiders).toBeGreaterThanOrEqual(100);
  expect(scene.corpses).toBeGreaterThanOrEqual(200);
  expect(scene.survivors).toBeGreaterThanOrEqual(58);

  // From a tower by the gate, looking down the column; and from above with the command layer open.
  await page.evaluate(() => window.__game!.debug.teleport((127 + 3 + 0.5) * 4, (124 + 19 + 0.5) * 4, Math.PI, -0.14));
  await page.waitForTimeout(2500);
  const tactical = await sample(page);
  await page.screenshot({ path: 'test-results/balance-worst-tactical.png' });
  await page.keyboard.press('Tab');
  await page.evaluate(() => { window.__game!.debug.view.dist = 230; });
  await page.waitForTimeout(2500);
  const command = await sample(page);
  await page.screenshot({ path: 'test-results/balance-worst-command.png' });
  const left = await page.evaluate(() => ({ raiders: window.__game!.state!.tactical!.zombies.filter((z) => z.raid && z.state !== 'down').length, corpses: window.__game!.state!.tactical!.corpses.length }));
  for (const [name, p] of [['tactical', tactical], ['command', command]] as const) {
    console.log(`worst case (${name}): ${scene.raiders} raiders, ${scene.survivors} survivors, ${setup.walls} wall tiles, ${scene.corpses} bodies: ${p.calls} draw calls, ${p.triangles} triangles, sim step ${p.tick.toFixed(3)} ms + draw ${p.draw.toFixed(2)} ms (worst ${p.worst.toFixed(2)}) = ${(p.tick + p.draw).toFixed(2)} ms; a 30 fps frame (2 steps + 1 draw) ${(p.tick * 2 + p.draw).toFixed(2)} ms of 33.3`);
    expect(p.calls).toBeLessThan(150);
    expect(p.triangles).toBeLessThan(500_000);
    expect(p.tick + p.draw).toBeLessThan(4);
  }
  expect(left.corpses).toBeLessThanOrEqual(200); // the cap holds while the fight goes on
  expect(errors).toEqual([]);
});

test('a long session does not pile up: cell after cell, day after day, raid after raid — GPU objects, DOM and heap stay level', async ({ page }) => {
  test.setTimeout(900_000);
  const errors = trackErrors(page);
  await startNewGame(page);
  const probe = () => page.evaluate(() => {
    const g = window.__game!;
    const m = g.renderer.ctx.renderer.info.memory;
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    return { geometries: m.geometries, textures: m.textures, heapMB: Math.round(heap / 1e6), nodes: document.querySelectorAll('*').length };
  });
  const cycle = async (): Promise<void> => {
    // Out to two neighbours and home again, then a raid and a game day.
    const home = await page.evaluate(() => window.__game!.state!.world.homeCell!);
    const w = await page.evaluate(() => window.__game!.state!.world.gridW);
    for (const cell of [home + 1, home + w, home]) {
      const ok = await page.evaluate((c) => window.__game!.debug.gotoCell(c), cell);
      if (ok === null) continue;
      await page.waitForFunction((c) => window.__game?.map != null && window.__game.state!.player.cell === c && window.__game.debug.renderInfo().pending === 0, cell, { timeout: 120_000 });
      await page.evaluate(() => {
        const g = window.__game!;
        for (let i = 0; i < 300; i++) g.sim.tick(g.state!, 1 / 60, { ...g.debug.noInput });
      });
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => {
      const g = window.__game!;
      const s = g.state!;
      s.player.hp = 1e9;
      g.debug.horde(40, 1);
      // A raid for two game minutes at 60 Hz, then the rest of the day a minute per tick.
      for (let i = 0; i < 60 * 120; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
      s.tactical!.zombies.length = 0;
      for (let i = 0; i < 1440; i++) g.sim.tick(s, 1, { ...g.debug.noInput });
    });
    await page.waitForTimeout(1500);
  };
  await cycle(); // warm up: caches fill, the neighbouring areas get built once
  const before = await probe();
  for (let i = 0; i < 3; i++) await cycle();
  const after = await probe();
  console.log(`long session: geometries ${before.geometries} -> ${after.geometries}, textures ${before.textures} -> ${after.textures}, JS heap ${before.heapMB} -> ${after.heapMB} MB, DOM nodes ${before.nodes} -> ${after.nodes}`);
  // Level, give or take what one more area in the cache holds.
  expect(after.geometries).toBeLessThan(before.geometries * 1.25 + 40);
  expect(after.textures).toBeLessThanOrEqual(before.textures + 4);
  expect(after.nodes).toBeLessThan(before.nodes * 1.5 + 200);
  if (before.heapMB > 0) expect(after.heapMB).toBeLessThan(before.heapMB * 1.6 + 60);
  // The save after all that: size and time.
  const save = await page.evaluate(() => {
    const g = window.__game!;
    const t0 = performance.now();
    const json = JSON.stringify(g.state);
    return { kb: Math.round(json.length / 1024), ms: performance.now() - t0 };
  });
  console.log(`save after the session: ${save.kb} KB, ${save.ms.toFixed(1)} ms to serialise`);
  expect(save.kb).toBeLessThan(2000);
  expect(save.ms).toBeLessThan(100);
  expect(errors).toEqual([]);
});

test('resize, a hidden tab and coming back: the picture follows the window, time does not jump, the autosave is written', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await startNewGame(page);
  // Resize: the canvas and the projection follow, down to a phone's width and back.
  for (const [w, h] of [[900, 500], [360, 640], [1600, 900], [1280, 720]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(600);
    const view = await page.evaluate(() => {
      const g = window.__game!;
      const c = g.renderer.ctx.canvas.getBoundingClientRect();
      return { w: Math.round(c.width), h: Math.round(c.height), aspect: (g.renderer.ctx.camera as unknown as { aspect: number }).aspect, scroll: document.documentElement.scrollWidth };
    });
    expect(view.w).toBe(w);
    expect(view.h).toBe(h);
    expect(view.aspect).toBeCloseTo(w / h, 2);
    expect(view.scroll).toBeLessThanOrEqual(w);
  }
  // Hidden for a while: the autosave is written at once; on return the clock has not leapt ahead
  // (the loop clamps a frame to 0.1 s, so a minute away is not a minute of unattended zombies).
  const clock = () => page.evaluate(() => {
    const s = window.__game!.state!;
    return s.time.day * 1440 + s.time.minute + s.time.sub;
  });
  const before = await clock();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await page.evaluate(() => window.__game!.debug.saves())).some((m) => m.slot === 'auto'), { timeout: 10_000 }).toBe(true);
  // What a browser does to a hidden tab: no frames for a long time, then one with a huge time step.
  const leap = await page.evaluate(async () => {
    const g = window.__game!;
    const s = g.state!;
    const t0 = s.time.day * 1440 + s.time.minute + s.time.sub;
    const real = window.requestAnimationFrame.bind(window);
    let held: FrameRequestCallback | null = null;
    window.requestAnimationFrame = (cb) => { held = cb; return 0; };
    await new Promise((r) => setTimeout(r, 400)); // the running frame parks its successor in `held`
    const parked = held as FrameRequestCallback | null;
    window.requestAnimationFrame = real;
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    if (parked) parked(performance.now() + 600_000); // "ten minutes later"
    return s.time.day * 1440 + s.time.minute + s.time.sub - t0;
  });
  expect(leap).toBeLessThan(1); // not ten game minutes: at most the clamped frame
  await page.waitForTimeout(1500);
  const after = await clock();
  expect(after - before).toBeLessThan(30);
  expect(await page.evaluate(() => window.__game!.state!.player.hp)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
