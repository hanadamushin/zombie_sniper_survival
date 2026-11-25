// O1: the hidden stashes, from a new game (moves sped up with the debug shortcuts): read two clues at
// the landmarks (Kagoshima's Saigō statue, the Fukuoka Tower) → the strategic map shows the Okinawa
// stash → the Okinawa ferry from Kagoshima to Naha (the journey's time skipped) → the Naha garrison:
// the depot locked, the commander's safe (10,000 ears and the key), B takes the rounds, an elite met and
// hired → home: the ears handed in, the elite there. Then Hashima: the boat from the Nagasaki shore,
// the island's alleys and blocks, B takes materials, a builder met, the boat back. The three budgets
// on the island and in the garrison. Screenshots: test-results/stash-*.png.

import { expect, test, type Page } from '@playwright/test';

const NAHA = 35906;
const KAGOSHIMA = 25912;
const FUKUOKA = 22236;
const HASHIMA = 23901;

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

async function settle(page: Page, ms = 900): Promise<void> {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  await page.waitForFunction(() => window.__game!.debug.renderInfo().pending === 0 && window.__game!.debug.enterableStages().pending === 0, null, { timeout: 120_000 });
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
    const draws: number[] = [];
    for (let i = 0; i < 20; i++) {
      t0 = performance.now();
      g.renderer.draw(s, 0, 0);
      draws.push(performance.now() - t0);
    }
    draws.sort((a, b) => a - b);
    return { calls: info.calls, triangles: info.triangles, tick, draw: draws[10]! };
  });
}

/** Go to a cell (debug) and wait for its area; no zombies in the way unless asked. */
async function goTo(page: Page, cell: number, keepZombies = false): Promise<void> {
  await page.evaluate(([c, keep]) => {
    const g = window.__game!;
    if (!keep) g.state!.world.cells.Z[c as number] = 0;
    g.debug.gotoCell(c as number);
  }, [cell, keepZombies] as const);
  await page.waitForFunction((c) => window.__game!.map != null && window.__game!.state!.tactical?.cell === c, cell, { timeout: 120_000 });
}

async function press(page: Page): Promise<void> {
  await page.evaluate(() => window.__game!.debug.setInput({ interact: true }));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__game!.debug.setInput(null));
}

async function stand(page: Page, p: readonly [number, number, number], yaw = 0, pitch = 0): Promise<void> {
  await page.evaluate(([x, y, z, a, b]) => {
    const g = window.__game!;
    g.debug.teleport(x!, z!, a, b, g.debug.supportAt(x!, z!, y! + 0.05));
    for (const zz of g.state!.tactical?.zombies ?? []) if (Math.hypot(zz.pos[0] - x!, zz.pos[2] - z!) < 40) zz.hp = 0;
  }, [p[0], p[1], p[2], yaw, pitch]);
  await page.waitForTimeout(250);
}

async function readClue(page: Page, cell: number, stash: 'okinawa' | 'hashima', shot?: string): Promise<void> {
  await goTo(page, cell);
  const board = await page.evaluate((s) => window.__game!.debug.stash().clues.find((b) => b.stash === s) ?? null, stash);
  expect(board, `a clue for ${stash} in ${cell}`).not.toBeNull();
  await stand(page, board!.pos, board!.yaw, -0.05);
  await expect(page.getByTestId('hud-act')).toHaveAttribute('data-kind', 'read');
  await press(page);
  await expect(page.getByTestId('hud-clue')).toBeVisible();
  if (shot) {
    await settle(page, 500);
    await page.screenshot({ path: `test-results/stash-${shot}.png` });
  }
}

test('O1: clues → the Okinawa ferry → the Naha stash (safe, B, elites) → home; Hashima by boat', async ({ page }) => {
  test.setTimeout(40 * 60_000);
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?res=fixed');
  await page.getByTestId('new-game').click();
  await page.getByTestId('intro-skip').click();
  await page.getByTestId('start-0').click();
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 120_000 });
  const home = await page.evaluate(() => window.__game!.state!.world.homeCell!);
  // Daylight for the pictures (the clock still runs: the ferry and the boat take their hours).
  await page.evaluate(() => window.__game!.debug.setClock(9));

  // ---- Two clues: Kagoshima (the Saigō statue) and the Fukuoka Tower (it tells of both stashes).
  await readClue(page, KAGOSHIMA, 'okinawa', 'clue-kagoshima');
  expect(await page.evaluate(() => window.__game!.state!.colony.log.at(-1)!.text)).toBe('log.clueOkinawa');
  await readClue(page, FUKUOKA, 'okinawa');
  const fukuokaHashima = await page.evaluate(() => window.__game!.debug.stash().clues.find((b) => b.stash === 'hashima')!);
  await stand(page, fukuokaHashima.pos, fukuokaHashima.yaw, -0.05);
  await press(page);
  const flags = await page.evaluate(() => Object.keys(window.__game!.state!.flags).filter((k) => k.startsWith('seen.clue.')).sort());
  expect(flags).toEqual(['seen.clue.fukuoka_tower.h', 'seen.clue.fukuoka_tower.o', 'seen.clue.saigo_statue.o']);

  // ---- The strategic map: the stash and the rumour in the legend.
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'world' }));
  await expect(page.getByTestId('map-marker-legend')).toContainText('秘蔵の物資');
  await page.screenshot({ path: 'test-results/stash-map.png' });
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'tactical' }));

  // ---- The ferry: from Kagoshima to Naha over the Okinawa sea link (its 40 hours skipped).
  await goTo(page, KAGOSHIMA);
  const path = await page.evaluate((to) => {
    const g = window.__game!;
    g.dispatch({ type: 'travel', to });
    return new Promise<number[]>((r) => setTimeout(() => r(g.state!.world.travel?.path ?? []), 600));
  }, NAHA);
  expect(path[0]).toBe(KAGOSHIMA);
  expect(path.at(-1)).toBe(NAHA);
  expect(path.indexOf(NAHA) - path.indexOf(KAGOSHIMA)).toBe(1); // one leg: the ferry
  await page.evaluate((c) => {
    const g = window.__game!;
    g.state!.world.cells.Z[c] = 0;
    g.state!.flags.skipMinutes = 2600;
  }, NAHA);
  await page.waitForFunction((c) => window.__game!.state!.world.travel === null && window.__game!.map != null && window.__game!.state!.tactical?.cell === c, NAHA, { timeout: 180_000 });

  // ---- The Naha garrison.
  const site = await page.evaluate(() => window.__game!.debug.stash().site!);
  expect(site).not.toBeNull();
  await page.evaluate(() => {
    window.__game!.state!.player.inv.ammo = 0;
  });
  await stand(page, site.supply);
  await expect(page.getByTestId('hud-stash')).toHaveAttribute('data-open', '0');
  await page.evaluate(() => window.__game!.dispatch({ type: 'resupply' }));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__game!.state!.player.inv.ammo)).toBe(0);
  // The commander's safe.
  const safe = await page.evaluate((host) => window.__game!.state!.tactical!.lootSpots.find((s) => s.key && s.enter === host)!, site.host);
  await stand(page, [safe.pos[0], safe.y!, safe.pos[1]]);
  await press(page);
  expect(await page.evaluate(() => window.__game!.state!.player.inv.ears)).toBeGreaterThanOrEqual(10_000);
  // B at the depot.
  await stand(page, site.supply, 0, -0.3);
  await expect(page.getByTestId('hud-stash')).toHaveAttribute('data-open', '1');
  await settle(page, 400);
  await page.screenshot({ path: 'test-results/stash-naha-depot.png' });
  await page.evaluate(() => window.__game!.dispatch({ type: 'resupply' }));
  await page.waitForFunction(() => window.__game!.state!.player.inv.ammo === 150, null, { timeout: 10_000 });
  // An elite in the HQ's armory.
  const hide = await page.evaluate(() => window.__game!.state!.tactical!.hideouts!.find((h) => h.elite === 0)!);
  await stand(page, [hide.pos[0], hide.y!, hide.pos[1]]);
  await expect(page.getByTestId('hud-act')).toHaveAttribute('data-kind', 'talk');
  await press(page);
  const cand = await page.evaluate(() => window.__game!.state!.colony.candidates.find((s) => s.trait === 'specops')!);
  expect([cand.ath, cand.kno, cand.spd, cand.sta]).toEqual([10, 10, 10, 10]);
  await page.evaluate((id) => window.__game!.dispatch({ type: 'hire', candidate: id }), cand.id);
  await page.waitForFunction((n) => window.__game!.state!.colony.survivors.some((s) => s.name === n), cand.name, { timeout: 10_000 });
  // The world map: the cell's stash in its information.
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'world' }));
  await expect(page.getByTestId('info-stash')).toContainText('那覇駐屯地の補給基地');
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'tactical' }));
  await settle(page);
  const naha = await measure(page);
  console.log(`[O1] Naha garrison: ${naha.calls} calls, ${(naha.triangles / 1e4).toFixed(1)} 万 triangles, sim ${naha.tick.toFixed(2)} + draw ${naha.draw.toFixed(2)} ms`);

  // ---- Home: the ears handed in, the elite there.
  await goTo(page, home);
  await page.waitForFunction(() => (window.__game!.state!.player.inv.ears ?? 0) === 0, null, { timeout: 60_000 });
  const back = await page.evaluate((n) => ({ ears: window.__game!.state!.colony.stock.ears, elite: window.__game!.state!.colony.survivors.find((s) => s.name === n)?.location.kind }), cand.name);
  expect(back.ears).toBeGreaterThanOrEqual(10_000 - 10);
  expect(back.elite).toBe('home');

  // ---- Hashima: the boat from the Nagasaki shore.
  await goTo(page, HASHIMA);
  await page.evaluate(() => window.__game!.debug.setClock(9));
  const hs = await page.evaluate(() => window.__game!.debug.stash().site!);
  expect(hs.dock).not.toBeNull();
  const toIsland = Math.atan2(-(hs.dock![0] - hs.shore![0]), -(hs.dock![2] - hs.shore![2]));
  await stand(page, hs.shore!, toIsland, 0.02);
  await settle(page);
  await page.screenshot({ path: 'test-results/stash-hashima-shore.png' });
  await expect(page.getByTestId('hud-act')).toHaveAttribute('data-kind', 'boat');
  const before = await page.evaluate(() => window.__game!.state!.time.day * 1440 + window.__game!.state!.time.minute);
  await press(page);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.__game!.state!.time.day * 1440 + window.__game!.state!.time.minute);
  expect(after - before).toBeGreaterThanOrEqual(60);
  const onIsland = await page.evaluate(() => {
    const g = window.__game!;
    const p = g.state!.player.pos;
    const lot = g.debug.enterables().find((e) => e.def === 'landmark.hashima')!;
    return p[0] >= lot.x0 && p[0] <= lot.x1 && p[2] >= lot.z0 && p[2] <= lot.z1;
  });
  expect(onIsland).toBe(true);
  await settle(page);
  await page.screenshot({ path: 'test-results/stash-hashima-landing.png' });
  const island = await measure(page);
  console.log(`[O1] Hashima landing: ${island.calls} calls, ${(island.triangles / 1e4).toFixed(1)} 万 triangles, sim ${island.tick.toFixed(2)} + draw ${island.draw.toFixed(2)} ms`);
  // The store of materials, the builders.
  await page.evaluate(() => {
    for (const z of window.__game!.state!.tactical!.zombies) z.hp = 0;
  });
  await stand(page, hs.supply);
  await page.evaluate(() => window.__game!.dispatch({ type: 'resupply' }));
  await page.waitForFunction(() => (window.__game!.state!.player.inv.wood ?? 0) > 0, null, { timeout: 10_000 });
  const builder = await page.evaluate(() => window.__game!.state!.tactical!.hideouts!.find((h) => h.elite === 0)!);
  await stand(page, [builder.pos[0], builder.y!, builder.pos[1]]);
  await press(page);
  expect(await page.evaluate(() => window.__game!.state!.colony.candidates.some((s) => s.trait === 'masterBuilder'))).toBe(true);
  await settle(page);
  const inside = await measure(page);
  console.log(`[O1] Hashima block 65 inside: ${inside.calls} calls, ${(inside.triangles / 1e4).toFixed(1)} 万 triangles, sim ${inside.tick.toFixed(2)} + draw ${inside.draw.toFixed(2)} ms`);
  // A look over the island (the footbridges, the ridge, the sea wall), from the air to the south-east.
  const roof = await page.evaluate(() => window.__game!.debug.enterables().find((e) => e.def === 'landmark.hashima')!);
  // From the air: the eye up there and the picture before the fall is noticeable (then back down).
  // (the game paused meanwhile: the fall would kill)
  await page.evaluate(([x, z, y]) => {
    const g = window.__game!;
    g.dispatch({ type: 'setSpeed', speed: 0 });
    g.debug.teleport(x!, z!, 0.55, -0.42, y);
  }, [roof.x1 + 70, roof.z1 + 40, roof.base + 70]);
  await settle(page, 600);
  await page.screenshot({ path: 'test-results/stash-hashima-air.png' });
  await page.evaluate(([x, y, z]) => {
    const g = window.__game!;
    g.debug.teleport(x!, z!, 0, 0, y);
    g.dispatch({ type: 'setSpeed', speed: 1 });
  }, [hs.dock![0], hs.dock![1], hs.dock![2]]);
  await page.waitForTimeout(400);
  // The boat back.
  await stand(page, hs.dock!);
  await expect(page.getByTestId('hud-act')).toHaveAttribute('data-kind', 'boat');
  await press(page);
  await page.waitForTimeout(500);
  const ashore = await page.evaluate(([x, z]) => Math.hypot(window.__game!.state!.player.pos[0] - x!, window.__game!.state!.player.pos[2] - z!), [hs.shore![0], hs.shore![2]]);
  expect(ashore).toBeLessThan(3);

  for (const m of [naha, island, inside]) {
    expect(m.calls).toBeLessThan(150);
    expect(m.triangles).toBeLessThan(500_000);
    expect(m.tick + m.draw).toBeLessThan(4);
  }
  expect(errors.filter((e) => !/favicon|404/.test(e))).toEqual([]);
});
