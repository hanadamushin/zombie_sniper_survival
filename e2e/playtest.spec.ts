import { expect, test, type Page } from '@playwright/test';

// 07b: fixes after the first playtest — keyboard-only sniping, the way into the firing range,
// smoke over the first survivor, and the budget of the denser countryside.

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

/** Angle (rad) the view still has to turn to rest on the chest of the standing 200 m target: + = left / up. */
const aimError = (page: Page) => page.evaluate(() => {
  const s = window.__game!.state!;
  const p = s.player;
  const z = s.tactical!.zombies.find((t) => t.dummy === 1 && t.kind === 'walker' && Math.abs(p.pos[2] - t.pos[2] - 200) < 1);
  if (!z) return null;
  const dx = z.pos[0] - p.pos[0];
  const dz = z.pos[2] - p.pos[2];
  let yaw = Math.atan2(-dx, -dz) - p.yaw;
  if (yaw > Math.PI) yaw -= Math.PI * 2;
  if (yaw < -Math.PI) yaw += Math.PI * 2;
  return { yaw, pitch: Math.atan2(1.2 - (p.pos[1] + p.eye), Math.hypot(dx, dz)) - p.pitch };
});

/** Steer one axis with the arrow keys only: hold while far off, tap when close. */
async function steer(page: Page, axis: 'yaw' | 'pitch', tolerance: number): Promise<void> {
  const keys = axis === 'yaw' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
  for (let i = 0; i < 400; i++) {
    const e = (await aimError(page))?.[axis];
    if (e === undefined) {
      await page.waitForTimeout(200); // the target is being put back up
      continue;
    }
    if (Math.abs(e) < tolerance) return;
    const key = e > 0 ? keys[0]! : keys[1]!;
    await page.keyboard.down(key);
    if (Math.abs(e) > 0.012) {
      // Far off: keep the key down (it speeds up) until most of the way there.
      const sign = Math.sign(e);
      for (let k = 0; k < 200; k++) {
        const now = (await aimError(page))?.[axis];
        if (now === undefined || now * sign < 0.008) break;
      }
    } else await page.waitForTimeout(Math.abs(e) > 0.002 ? 90 : 25);
    await page.keyboard.up(key);
    await page.waitForTimeout(40);
  }
  throw new Error(`could not settle the ${axis} with the arrow keys`);
}

test('keyboard only: scope with Q, aim with the arrow keys, hold the breath, fire with F — a hit at 200 m', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await page.goto('/?range=1&res=fixed');
  await page.waitForFunction(() => (window.__game?.state?.tactical?.zombies.length ?? 0) >= 12);
  // The hint under the view says how to do it without a mouse.
  await expect(page.locator('.hint')).toContainText('矢印キー');
  await expect(page.locator('.hint')).toContainText('マウスなしでも');
  const start = await page.evaluate(() => {
    const g = window.__game!;
    (window as unknown as { __hits: unknown[] }).__hits = [];
    g.sim.events.on('bulletHit', (e) => {
      (window as unknown as { __hits: unknown[] }).__hits.push({ zombie: e.zombie, part: e.part, range: e.range });
    });
    return { pos: [...g.state!.player.pos], sway: g.state!.flags.noSway === true };
  });
  expect(start.sway).toBe(false); // the real sway is on: this is the game as played

  // Prone, zero 200 m, scope, a little more magnification — keys only from here on, no mouse at all.
  await page.keyboard.press('KeyZ');
  await page.keyboard.press('PageUp');
  await expect(page.getByTestId('hud-zero')).toHaveAttribute('data-zero', '200');
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.__game!.state!.player.aim.scopeT === 1 && window.__game!.state!.player.eye < 0.31);
  expect(await page.evaluate(() => window.__game!.state!.player.scoped)).toBe(true);
  for (let i = 0; i < 4; i++) await page.keyboard.press('Equal');
  await page.keyboard.press('Minus');
  await expect.poll(() => page.evaluate(() => window.__game!.state!.player.weapon.zoom)).toBeCloseTo(4 * 1.15 ** 3, 2);

  // The arrow keys move the reticle: coarse first, then fine. 1 mil = 20 cm at 200 m.
  for (let round = 0; round < 3; round++) {
    await steer(page, 'yaw', 0.0005);
    await steer(page, 'pitch', 0.0005);
  }
  const settled = (await aimError(page))!;
  expect(Math.abs(settled.yaw)).toBeLessThan(0.0012);
  expect(Math.abs(settled.pitch)).toBeLessThan(0.0012);
  await page.screenshot({ path: 'test-results/07b-keyboard-aim.png' });

  await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(() => window.__game!.state!.player.aim.holding === true);
  await page.waitForTimeout(600); // let the sway settle
  await page.keyboard.down('KeyF');
  await page.waitForFunction(() => window.__game!.state!.player.stats.shots === 1);
  await page.keyboard.up('KeyF');
  await page.keyboard.up('ShiftLeft');
  await page.waitForFunction(() => (window as unknown as { __hits: unknown[] }).__hits.length > 0, null, { timeout: 20_000 });
  const hit = await page.evaluate(() => (window as unknown as { __hits: { zombie: number | null; part: string | null; range: number }[] }).__hits[0]!);
  expect(hit.zombie).not.toBeNull();
  expect(hit.range).toBeGreaterThan(195);
  expect(hit.range).toBeLessThan(205);

  // Q again lowers the rifle; the arrow keys never moved the player.
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.__game!.state!.player.aim.scopeT === 0);
  const end = await page.evaluate(() => [...window.__game!.state!.player.pos]);
  expect(end[0]).toBeCloseTo(start.pos[0]!, 3);
  expect(end[2]).toBeCloseTo(start.pos[2]!, 3);
  expect(errors).toEqual([]);
});

test('the firing range is one click from the title and from the pause menu, and both ways lead back', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0&res=fixed');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page).toHaveTitle('Zombie Sniper Survival');
  await expect(page.locator('.title-card h1')).toHaveText('Zombie Sniper Survival');
  await page.screenshot({ path: 'test-results/07b-title.png' });

  // Title -> range -> title.
  await page.getByTestId('open-range').click();
  await page.waitForFunction(() => window.__game?.state?.flags.range === true && (window.__game.state.tactical?.zombies.length ?? 0) >= 12);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mode-menu')).toBeVisible();
  await expect(page.getByTestId('menu-help')).toContainText('矢印キー');
  await expect(page.getByTestId('menu-help')).toContainText('Q（押すたびに切替）');
  await expect(page.getByTestId('menu-leave-range')).toHaveCount(0);
  await expect(page.getByTestId('menu-range')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/07b-menu-range.png' });
  await page.getByTestId('menu-title').click();
  await expect(page.getByTestId('title-screen')).toBeVisible();

  // A game -> its menu -> range -> back to the same game, where it was.
  await startNewGame(page);
  await page.evaluate(() => window.__game!.debug.teleport(520, 540, 0.5, 0));
  const before = await page.evaluate(() => {
    const s = window.__game!.state!;
    return { seed: s.seed, home: s.world.homeCell, day: s.time.day, x: s.player.pos[0], z: s.player.pos[2] };
  });
  await page.keyboard.press('Escape');
  await page.getByTestId('menu-range').click();
  await page.waitForFunction(() => window.__game?.state?.flags.range === true && (window.__game.state.tactical?.zombies.length ?? 0) >= 12);
  await page.keyboard.press('Escape');
  await page.getByTestId('menu-leave-range').click();
  await page.waitForFunction(() => window.__game?.state != null && window.__game.state.flags.range !== true);
  const after = await page.evaluate(() => {
    const s = window.__game!.state!;
    return { seed: s.seed, home: s.world.homeCell, day: s.time.day, x: s.player.pos[0], z: s.player.pos[2], mode: s.mode, map: window.__game!.map?.params.isHome };
  });
  expect(after).toMatchObject({ ...before, mode: 'tactical', map: true });
  await expect(page.getByTestId('mode-tactical')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const seed of [3, 12, 21]) {
  test(`seed ${seed}: smoke shows where the first survivor hides; walk there, talk, hire`, async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await page.goto(`/?seed=${seed}&scenario=0&res=fixed`);
    await startNewGame(page);
    await page.waitForFunction(() => (window.__game?.state?.tactical?.hideouts ?? []).some((h) => h.sure), null, { timeout: 60_000 });

    // Look at the hideout from the firing position with the best view of it, and from the base.
    const look = await page.evaluate(() => {
      const g = window.__game!;
      const s = g.state!;
      const map = g.map!;
      g.debug.setClock(11);
      s.world.cells.Z[s.player.cell] = 0; // nobody interrupts the walk
      s.tactical!.zombies.length = 0;
      const hide = s.tactical!.hideouts!.find((h) => h.sure)!;
      const v = map.vantages.slice().sort((a, b) => b.pos[1] - a.pos[1])[0]!;
      return { hide: hide.pos, dist: Math.hypot(hide.pos[0] - 512, hide.pos[1] - 512), vantage: v.pos, land: map.params.land };
    });
    expect(look.dist).toBeGreaterThanOrEqual(248);
    expect(look.dist).toBeLessThanOrEqual(452);

    /** Pixels that change when the smoke is taken away, seen from (x, z) looking at the hideout. */
    const smokePixels = async (x: number, z: number, y: number | undefined, name: string): Promise<number> => {
      await page.evaluate(([px, pz, py, hx, hz]) => {
        const g = window.__game!;
        const d = Math.hypot(hx! - px!, hz! - pz!);
        g.debug.teleport(px!, pz!, Math.atan2(-(hx! - px!), -(hz! - pz!)), Math.atan2(18 - 4, d), py);
        g.dispatch({ type: 'setSpeed', speed: 0 });
      }, [x, z, y, look.hide[0], look.hide[1]] as (number | undefined)[]);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `test-results/07b-smoke-${seed}-${name}.png` });
      return page.evaluate(() => {
        const g = window.__game!;
        const s = g.state!;
        const gl = g.renderer.ctx.renderer.getContext();
        const w = gl.drawingBufferWidth;
        const h = gl.drawingBufferHeight;
        const grab = (): Uint8Array => {
          g.renderer.draw(s, 0, 0);
          const px = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
          return px;
        };
        const hide = s.tactical!.hideouts!.find((o) => o.sure)!;
        const withSmoke = grab();
        hide.met = true;
        const without = grab();
        hide.met = false;
        let n = 0;
        for (let i = 0; i < withSmoke.length; i += 4) {
          if (Math.abs(withSmoke[i]! - without[i]!) + Math.abs(withSmoke[i + 1]! - without[i + 1]!) + Math.abs(withSmoke[i + 2]! - without[i + 2]!) > 24) n++;
        }
        return n;
      });
    };
    const fromVantage = await smokePixels(look.vantage[0], look.vantage[2], look.vantage[1], 'vantage');
    const fromBase = await smokePixels(512, 512, undefined, 'base');
    console.log(`seed ${seed} (${look.land}): hideout ${Math.round(look.dist)} m out; smoke covers ${fromVantage} px from the firing position, ${fromBase} px from the base`);
    expect(Math.max(fromVantage, fromBase)).toBeGreaterThan(60);

    // Walk the last metres (W only), talk (E), then hire through the command layer (Tab).
    // Approach from the open side (a hideout at a search point is in front of a door).
    await page.evaluate(([hx, hz]) => {
      const g = window.__game!;
      const map = g.map!;
      const hide = g.state!.tactical!.hideouts!.find((o) => o.sure)!;
      const b = hide.spot >= 0 ? map.buildings[map.lootSpots.find((l) => l.id === hide.spot)!.building]! : null;
      let dx = b ? hx! - (b.x0 + b.x1) / 2 : 0;
      let dz = b ? hz! - (b.z0 + b.z1) / 2 : 1;
      // Straight out from the wall the door is in.
      if (Math.abs(dx) > Math.abs(dz) && b && (hx! < b.x0 || hx! > b.x1)) dz = 0;
      else dx = 0;
      const len = Math.hypot(dx, dz) || 1;
      const x = hx! + (dx / len) * 9;
      const z = hz! + (dz / len) * 9;
      g.dispatch({ type: 'setSpeed', speed: 1 });
      g.debug.teleport(x, z, Math.atan2(-(hx! - x), -(hz! - z)), 0);
      g.state!.player.inv.ears = 60;
    }, look.hide);
    await expect(page.getByTestId('hud-someone')).toBeVisible();
    await expect(page.getByTestId('hud-someone')).toHaveAttribute('data-dir', /^(N|E|S|W)$/);
    await expect(page.getByTestId('hud-someone')).toContainText(/人の気配 (北|東|南|西) \d+m/);
    await page.keyboard.down('KeyW');
    await expect(page.getByTestId('hud-act')).toHaveAttribute('data-kind', 'talk', { timeout: 60_000 });
    await page.keyboard.up('KeyW');
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.__game!.state!.colony.candidates.length > 0, null, { timeout: 20_000 });
    await expect(page.getByTestId('hud-hire-hint')).toBeVisible();
    await expect(page.getByTestId('hud-hire-hint')).toContainText('Tab');
    if (seed === 12) await page.screenshot({ path: 'test-results/07b-hire-hint.png' });
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('command-panel')).toBeVisible();
    await page.getByTestId('tab-hire').click();
    await page.getByTestId('candidate-row').first().getByRole('button').click();
    await page.waitForFunction(() => window.__game!.state!.colony.survivors.length === 1);
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('hud-hire-hint')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('rural and forest stay within budget with the new cover, from a firing position and on the ground', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0&res=fixed');
  await startNewGame(page);
  const lines: string[] = [];
  for (const land of ['rural', 'forest'] as const) {
    await page.evaluate((l) => window.__game!.debug.gotoLand(l, 3), land);
    await page.waitForFunction((l) => window.__game?.map?.params.land === l && (window.__game.state?.tactical?.populated ?? false), land, { timeout: 60_000 });
    for (const where of ['vantage', 'ground'] as const) {
      await page.evaluate((w) => {
        const g = window.__game!;
        const map = g.map!;
        g.debug.setClock(11);
        const v = map.vantages.slice().sort((a, b) => b.pos[1] - a.pos[1])[0]!;
        if (w === 'vantage') g.debug.teleport(v.pos[0], v.pos[2], Math.atan2(-(512 - v.pos[0]), -(512 - v.pos[2])), -0.1, v.pos[1]);
        else g.debug.teleport(300, 300, -2.3, 0);
      }, where);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `test-results/07b-${land}-${where}.png` });
      const perf = await page.evaluate(async () => {
        const g = window.__game!;
        const s = g.state!;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const info = g.debug.renderInfo();
        let t0 = performance.now();
        for (let i = 0; i < 600; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
        const tick = (performance.now() - t0) / 600;
        t0 = performance.now();
        for (let i = 0; i < 20; i++) g.renderer.draw(s, 0, 0);
        const draw = (performance.now() - t0) / 20;
        return { calls: info.calls, triangles: info.triangles, tick, draw, build: info.buildMs, zombies: s.tactical!.zombies.length, brush: g.map!.brush.length };
      });
      lines.push(`${land} (${where}): ${perf.calls} draw calls, ${perf.triangles} triangles, sim step ${perf.tick.toFixed(3)} ms + draw submission ${perf.draw.toFixed(2)} ms, ${perf.zombies} zombies, ${perf.brush} brush, world build ${perf.build.toFixed(0)} ms`);
      expect(perf.calls, land).toBeLessThan(150);
      expect(perf.triangles, land).toBeLessThan(500_000);
      expect(perf.tick + perf.draw, land).toBeLessThan(4);
    }
  }
  console.log(lines.join('\n'));
  expect(errors).toEqual([]);
});

test('game over hands the cursor back: the pointer lock is released and clicks do not take it again', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  // Headless Chromium cannot lock the pointer for real: stand in for it (the same calls, the same event).
  await page.addInitScript(() => {
    let lockedTo: Element | null = null;
    const w = window as unknown as { __locks: number };
    w.__locks = 0;
    Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get: () => lockedTo });
    Element.prototype.requestPointerLock = function (this: Element) {
      lockedTo = this;
      w.__locks++;
      document.dispatchEvent(new Event('pointerlockchange'));
      return Promise.resolve();
    } as typeof Element.prototype.requestPointerLock;
    Document.prototype.exitPointerLock = function () {
      lockedTo = null;
      document.dispatchEvent(new Event('pointerlockchange'));
    };
  });
  await page.goto('/?seed=12&scenario=0&res=fixed');
  await startNewGame(page);
  await page.locator('#scene').click({ position: { x: 640, y: 400 } });
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id ?? null)).toBe('scene');

  // Die with nobody in the colony: defeat.
  await page.evaluate(() => {
    const s = window.__game!.state!;
    s.player.hp = 0;
    s.player.aim.deadT = 0.2;
  });
  await expect(page.getByTestId('defeat')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  expect(await page.getByTestId('mode-menu').count()).toBe(0); // losing the lock here does not open the pause menu
  // Clicking the scene does not grab the pointer again; the button works.
  const locks = await page.evaluate(() => (window as unknown as { __locks: number }).__locks);
  await page.mouse.click(20, 400);
  expect(await page.evaluate(() => (window as unknown as { __locks: number }).__locks)).toBe(locks);
  await page.getByTestId('defeat').getByRole('button').click();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(errors).toEqual([]);
});
