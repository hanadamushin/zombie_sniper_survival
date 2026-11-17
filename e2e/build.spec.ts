import { expect, test, type Page } from '@playwright/test';

// 06: blueprints -> builders -> walls; a night approach met from a tower; a horde that queues at
// the one opening of a moat; a neglected fence, the headquarters lost; an outpost; the budget.

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
  // These scenarios are about building and defence; what research unlocks is e2e/research.spec.ts.
  await page.evaluate(() => {
    window.__game!.state!.flags.unlockAll = true;
  });
}

/** Screen position of the middle of a tile under the command camera. */
const tileOnScreen = (page: Page, tx: number, ty: number) => page.evaluate(([x, y]) => {
  const g = window.__game!;
  const cam = g.renderer.ctx.camera;
  const map = g.map!;
  const wx = (x! + 0.5) * 4, wz = (y! + 0.5) * 4;
  const h = map.height[Math.round(wz / 4) * map.n + Math.round(wx / 4)]!;
  cam.updateMatrixWorld();
  const e = cam.matrixWorldInverse.elements, p = cam.projectionMatrix.elements;
  const vx = e[0]! * wx + e[4]! * h + e[8]! * wz + e[12]!, vy = e[1]! * wx + e[5]! * h + e[9]! * wz + e[13]!, vz = e[2]! * wx + e[6]! * h + e[10]! * wz + e[14]!;
  const cx = p[0]! * vx + p[8]! * vz, cy = p[5]! * vy + p[9]! * vz, cw = -vz;
  const rect = g.renderer.ctx.canvas.getBoundingClientRect();
  return { x: rect.left + ((cx / cw) * 0.5 + 0.5) * rect.width, y: rect.top + (1 - ((cy / cw) * 0.5 + 0.5)) * rect.height };
}, [tx, ty]);

/** Run the simulation by hand (much faster than waiting for software-rendered frames). */
const runSim = (page: Page, seconds: number, until?: string) => page.evaluate(([n, cond]) => {
  const g = window.__game!;
  const stop = cond ? (new Function('g', `return ${cond as string}`) as (x: typeof g) => boolean) : null;
  for (let i = 0; i < (n as number) * 60; i++) {
    g.sim.tick(g.state!, 1 / 60, { ...g.debug.noInput });
    if (stop && i % 30 === 0 && stop(g)) return true;
  }
  return false;
}, [seconds, until ?? null] as const);

const HQ = { x: 127, y: 124 };

test('blueprints are drawn on the ground, builders raise them, and a night approach is met from the tower', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await startNewGame(page);
  await page.evaluate(() => {
    const g = window.__game!;
    g.debug.give('wood', 200);
    g.debug.give('metal', 40);
    g.debug.give('food', 60);
    g.debug.give('ears', 300);
    g.debug.addSurvivors(4, 'construction');
    g.state!.world.cells.Z[g.state!.world.homeCell!] = 0; // nobody wanders in while we build
  });
  // The base starts with its headquarters and one field.
  expect(await page.evaluate(() => window.__game!.state!.build.structures.map((s) => s.def).sort())).toEqual(['farm', 'hq']);

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('mode-command')).toBeVisible();
  await page.getByTestId('tab-build').click();
  await expect(page.getByTestId('build-tab')).toBeVisible();
  await page.evaluate(() => { window.__game!.debug.view.dist = 110; });
  await page.waitForTimeout(600);

  // Drag a run of palisade south of the headquarters: a continuous line of blueprints.
  await page.getByTestId('build-palisade').click();
  const a = await tileOnScreen(page, HQ.x - 5, HQ.y + 6);
  const b = await tileOnScreen(page, HQ.x + 5, HQ.y + 6);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/build-drag.png' });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__game!.state!.build.structures.filter((s) => s.def === 'palisade').length)).toBe(11);
  // A gate replaces the middle section, a tower goes up behind the fence.
  await page.getByTestId('build-remove').click();
  const mid = await tileOnScreen(page, HQ.x, HQ.y + 6);
  await page.mouse.click(mid.x, mid.y);
  await expect.poll(() => page.evaluate(() => window.__game!.state!.build.structures.filter((s) => s.def === 'palisade').length)).toBe(10);
  await page.getByTestId('build-gateWood').click();
  await page.mouse.click(mid.x, mid.y);
  await page.getByTestId('build-tower').click();
  const tw = await tileOnScreen(page, HQ.x + 2, HQ.y + 4);
  await page.mouse.click(tw.x, tw.y);
  // The headquarters cannot be built over: the cursor is red there and nothing is placed.
  const onHq = await tileOnScreen(page, HQ.x, HQ.y);
  await page.mouse.click(onHq.x, onHq.y);
  await expect.poll(() => page.evaluate(() => window.__game!.state!.build.structures.length)).toBe(2 + 10 + 1 + 1);
  await expect(page.getByTestId('build-status')).toHaveAttribute('data-pending', '12');
  await page.screenshot({ path: 'test-results/build-blueprints.png' });

  // Two working days: materials are carried in, work is done, everything stands.
  await page.evaluate(() => window.__game!.debug.setClock(6));
  await runSim(page, 60 * 40, 'g.state.build.structures.every((s) => s.progress >= 1)');
  const built = await page.evaluate(() => {
    const s = window.__game!.state!;
    return { all: s.build.structures.every((x) => x.progress >= 1), wood: s.colony.stock.wood, ladders: window.__game!.map!.ladders.length, hp: s.build.structures.find((x) => x.def === 'gateWood')!.hp };
  });
  expect(built.all).toBe(true);
  expect(built.wood).toBe(200 - 10 * 4 - 8 - 20);
  expect(built.hp).toBe(90);
  expect(built.ladders).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/build-done.png' });

  // Night: the dead come; the player is up the tower with the rifle.
  await page.keyboard.press('Tab');
  await page.evaluate(() => {
    const g = window.__game!;
    g.state!.world.cells.Z[g.state!.world.homeCell!] = 150;
    g.state!.tactical!.spawnT = 1e9;
    g.debug.setClock(21.98);
    g.debug.teleport((127 + 2 + 0.5) * 4, (124 + 4 + 0.5) * 4, Math.PI, -0.1);
  });
  await runSim(page, 240, 'g.state.build.raid !== null && g.state.tactical.zombies.some((z) => z.raid && Math.hypot(z.pos[0] - 510, z.pos[2] - 498) < 150)');
  const night = await page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    return { raid: s.build.raid?.kind, alarm: s.flags.colonyAlarm, raiders: s.tactical!.zombies.filter((z) => z.raid).length, y: s.player.pos[1] - g.map!.height[128 * g.map!.n + 128]! };
  });
  expect(night.raid).toBe('night');
  expect(night.alarm).toBe(true);
  expect(night.raiders).toBeGreaterThanOrEqual(3);
  expect(night.y).toBeGreaterThan(4.5); // standing on the deck
  await expect(page.getByTestId('hud-raid')).toHaveAttribute('data-kind', 'night');
  // Face the nearest raider, raise the scope, and fire.
  await page.evaluate(() => {
    const g = window.__game!;
    const p = g.state!.player;
    const z = g.state!.tactical!.zombies.filter((q) => q.raid).sort((u, v) => Math.hypot(u.pos[0] - p.pos[0], u.pos[2] - p.pos[2]) - Math.hypot(v.pos[0] - p.pos[0], v.pos[2] - p.pos[2]))[0]!;
    p.yaw = Math.atan2(-(z.pos[0] - p.pos[0]), -(z.pos[2] - p.pos[2]));
    p.pitch = Math.atan2(z.pos[1] + 1.2 - (p.pos[1] + p.eye), Math.hypot(z.pos[0] - p.pos[0], z.pos[2] - p.pos[2]));
    g.debug.setInput({ scope: true });
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/build-night-tower.png' });
  const shots0 = await page.evaluate(() => window.__game!.state!.player.stats.shots);
  await page.evaluate(() => window.__game!.debug.setInput({ scope: true, fire: true }));
  await expect.poll(() => page.evaluate(() => window.__game!.state!.player.stats.shots), { timeout: 15_000 }).toBeGreaterThan(shots0);
  await page.evaluate(() => window.__game!.debug.setInput(null));
  expect(errors).toEqual([]);
});

test('a moat with one opening: the horde files through it; 120 raiders, 30 survivors and 500 wall tiles stay within budget', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await startNewGame(page);
  const setup = await page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    const d = g.debug;
    const X = 127, Y = 124;
    s.build.structures = s.build.structures.filter((b) => b.def !== 'farm');
    const free = (x: number, y: number): boolean => !s.build.structures.some((b) => b.tx === x && b.ty === y);
    const ring = (r: number, def: (x: number, y: number) => string | null): void => {
      for (let i = -r; i <= r; i++) for (const [x, y] of [[X + i, Y - r], [X + i, Y + r], [X - r, Y + i], [X + r, Y + i]] as const) {
        const id = def(x, y);
        if (id && free(x, y)) d.build(id, x, y);
      }
    };
    // Three rings of walls in four materials (with gates to the south), and a moat with one opening outside them.
    ring(9, (x, y) => (x === X && y === Y + 9 ? 'gateWood' : 'palisade'));
    ring(12, (x, y) => (x === X && y === Y + 12 ? 'gateWood' : 'palisade'));
    ring(14, (x, y) => (x === X && y === Y + 14 ? 'gateWood' : 'palisade'));
    ring(17, (x, y) => (x === X && y === Y + 17 ? 'gateSteel' : x < X ? 'steelWall' : 'earthwork'));
    ring(22, (x, y) => (x === X && y === Y + 22 ? 'gateConcrete' : 'concreteWall'));
    ring(26, (x, y) => (x === X && y === Y + 26 ? null : 'moat'));
    for (const [x, y] of [[X - 3, Y + 20], [X + 3, Y + 20], [X - 10, Y + 20], [X + 10, Y + 20]] as const) d.build('tower', x, y);
    const jobs = ['defense', 'farming', 'construction', 'research', 'crafting', 'scavenging'] as const;
    for (let i = 0; i < 30; i++) d.addSurvivors(1, jobs[i % jobs.length]);
    d.give('ammo', 80);
    d.give('food', 80);
    s.player.hp = 1e9;
    d.setClock(14);
    s.tactical!.zombies.length = 0;
    s.tactical!.spawnT = 1e9;
    d.horde(150, Math.PI); // from the south: the opening and the gates face them
    return { walls: s.build.structures.filter((b) => ['palisade', 'steelWall', 'earthwork', 'concreteWall'].includes(b.def)).length, moats: s.build.structures.filter((b) => b.def === 'moat').length };
  });
  expect(setup.walls).toBeGreaterThanOrEqual(500);
  console.log(`defence scene: ${setup.walls} wall tiles, ${setup.moats} moat tiles`);

  // Let them come; count who crosses the line of the moat, and where.
  const crossing = await page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    const moat = new Set(s.build.structures.filter((b) => b.def === 'moat').map((b) => b.ty * 256 + b.tx));
    const gap = (124 + 26) * 256 + 127;
    let inMoat = 0;
    const through = new Set<number>();
    let maxActive = 0;
    for (let i = 0; i < 60 * 420; i++) {
      g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
      if (i % 6) continue;
      let active = 0;
      for (const z of s.tactical!.zombies) {
        if (!z.raid || z.state === 'down') continue;
        active++;
        const t = Math.floor(z.pos[2] / 4) * 256 + Math.floor(z.pos[0] / 4);
        if (moat.has(t)) inMoat++;
        if (t === gap) through.add(z.id);
      }
      maxActive = Math.max(maxActive, active);
      if (through.size >= 15 && active >= 100) break;
    }
    return { inMoat, through: through.size, maxActive, raid: s.build.raid?.kind, left: s.build.raid?.toSpawn };
  });
  expect(crossing.inMoat).toBe(0);
  expect(crossing.through).toBeGreaterThanOrEqual(15);
  expect(crossing.maxActive).toBeLessThanOrEqual(120);
  expect(crossing.raid).toBe('horde');

  // Look down the column from the tower by the gate: they come in a line — made for a piercing shot.
  await page.evaluate(() => window.__game!.debug.teleport((127 + 3 + 0.5) * 4, (124 + 20 + 0.5) * 4, Math.PI, -0.14));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/build-horde-tower.png' });
  await expect(page.getByTestId('hud-raid')).toHaveAttribute('data-kind', 'horde');

  // Budget: one sim step + one draw submission, with the raid at full strength.
  const perf = await page.evaluate(async () => {
    const g = window.__game!;
    const s = g.state!;
    // Top the map up to the cap first.
    for (let i = 0; i < 60 * 30 && s.tactical!.zombies.filter((z) => z.raid && z.state !== 'down').length < 115 && s.build.raid && s.build.raid.toSpawn > 0; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
    await new Promise((r) => setTimeout(r, 3000));
    const info = g.debug.renderInfo();
    const raiders = s.tactical!.zombies.filter((z) => z.raid && z.state !== 'down').length;
    const all = s.tactical!.zombies.length;
    // 07c: steady frames only — wait until the neighbouring areas are built.
    for (let w = 0; w < 600 && g.debug.renderInfo().pending > 0; w++) await new Promise((r) => setTimeout(r, 50));
    let t0 = performance.now();
    for (let i = 0; i < 600; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
    const tick = (performance.now() - t0) / 600;
    const times: number[] = [];
    const pend: number[] = [];
    for (let i = 0; i < 20; i++) {
      t0 = performance.now();
      g.renderer.draw(s, 0, 1 / 60);
      times.push(performance.now() - t0);
      pend.push(g.debug.renderInfo().pending);
    }
    // One draw = the median: during a fight the walls' damage is redrawn now and then (06), and a
    // single garbage collection can dwarf twenty frames; the worst one is reported as well.
    const sorted = times.slice().sort((a, b) => a - b);
    const draw = sorted[10]!;
    const worst = sorted[19]!;
    void pend;
    return { calls: info.calls, triangles: info.triangles, tick, draw, worst, raiders, all, survivors: s.colony.survivors.filter((x) => x.location.kind === 'home').length };
  });
  console.log(`horde at the walls (tactical): ${perf.raiders} raiders (${perf.all} zombies), ${perf.survivors} survivors, ${setup.walls} wall tiles: ${perf.calls} draw calls, ${perf.triangles} triangles, sim step ${perf.tick.toFixed(3)} ms + draw submission ${perf.draw.toFixed(2)} ms (median of 20; worst ${perf.worst.toFixed(1)} ms)`);
  expect(perf.raiders).toBeGreaterThanOrEqual(100);
  expect(perf.survivors).toBeGreaterThanOrEqual(28);
  expect(perf.calls).toBeLessThan(150);
  expect(perf.triangles).toBeLessThan(500_000);
  expect(perf.tick + perf.draw).toBeLessThan(4);

  // The same from above, with the build palette open; and at 360 px.
  await page.keyboard.press('Tab');
  await page.getByTestId('tab-build').click();
  await page.evaluate(() => { window.__game!.debug.view.dist = 230; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/build-horde-command.png' });
  const cmd = await page.evaluate(() => window.__game!.debug.renderInfo());
  console.log(`horde at the walls (command layer): ${cmd.calls} draw calls, ${cmd.triangles} triangles`);
  expect(cmd.calls).toBeLessThan(150);
  expect(cmd.triangles).toBeLessThan(500_000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/build-360.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  expect(errors).toEqual([]);
});

test('a neglected fence is broken, the headquarters falls: defeat', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await startNewGame(page);
  await page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    const X = 127, Y = 124, r = 7;
    s.build.structures = s.build.structures.filter((b) => b.def !== 'farm');
    for (let i = -r; i <= r; i++) for (const [x, y] of [[X + i, Y - r], [X + i, Y + r], [X - r, Y + i], [X + r, Y + i]] as const) {
      if (!s.build.structures.some((b) => b.tx === x && b.ty === y)) g.debug.build('palisade', x, y);
    }
    g.debug.addSurvivors(2, 'farming');
    s.player.hp = 1e9;
    g.debug.teleport(60, 60, 0, 0);
    s.player.stance = 'prone';
    s.tactical!.zombies.length = 0;
    s.tactical!.spawnT = 1e9;
    g.debug.setClock(13);
    g.debug.horde(80, 0.8);
  });
  await runSim(page, 300, 'g.state.build.structures.some((b) => b.def === "palisade" && b.ruinUntil !== undefined)');
  // (Watched from above: the player stays out of it, or the dead would turn on them instead.)
  await page.keyboard.press('Tab');
  await page.evaluate(() => { const v = window.__game!.debug.view; v.x = 510; v.z = 498; v.dist = 90; });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/build-breach.png' });
  expect(await runSim(page, 1500, 'g.state.flags.defeat === true')).toBe(true);
  await expect(page.getByTestId('defeat')).toBeVisible();
  await expect(page.getByTestId('defeat-lead')).toHaveText(/司令部が破壊された/);
  await page.screenshot({ path: 'test-results/build-defeat.png' });
  expect(errors).toEqual([]);
});

test('an outpost in a cleared neighbouring cell: found it on the map, travel fast, take ammunition', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await startNewGame(page);
  const target = await page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    const w = s.world.gridW;
    const cell = [1, -1, w, -w].map((d) => s.player.cell + d).find((id) => s.world.cells.Z[id]! >= 0)!;
    s.world.cells.Z[cell] = 6; // cleared
    s.world.cells.visited[cell] = true;
    s.world.cells.intel[cell] = 2;
    g.debug.give('ears', 100);
    g.debug.give('wood', 40);
    g.debug.give('ammo', 200);
    g.debug.give('food', 40);
    g.debug.addSurvivors(2, 'defense');
    s.player.inv.ammo = 20;
    return cell;
  });
  await page.keyboard.press('KeyM');
  const canvas = page.getByTestId('map-canvas');
  await expect(canvas).toHaveAttribute('data-scale', /\d/);
  const at = await page.evaluate((cell) => {
    const el = document.querySelector<HTMLElement>('[data-testid=map-canvas]')!;
    const scale = Number(el.dataset.scale);
    const w = window.__game!.state!.world.gridW;
    return { x: Number(el.dataset.ox) + ((cell % w) + 0.5) * scale, y: Number(el.dataset.oy) + (Math.floor(cell / w) + 0.5) * scale };
  }, target);
  await canvas.click({ position: at });
  await page.getByTestId('outpost-found').click();
  await expect(page.getByTestId('outpost-info')).toHaveAttribute('data-tier', '1');
  expect(await page.evaluate(() => window.__game!.state!.colony.stock.ears)).toBe(60);
  // A day passes: the first supply run brings ammunition.
  await runSim(page, 1440);
  // (one or two midnights, depending on how far the live loop got)
  await expect.poll(() => page.evaluate(() => window.__game!.state!.world.outposts[0]?.ammo ?? -1), { timeout: 15_000 }).toBeGreaterThanOrEqual(30);
  await expect(page.getByTestId('outpost-info')).toBeVisible();
  await page.screenshot({ path: 'test-results/build-outpost-map.png' });
  // Fast travel is offered between the base and the outpost: one cell, one hour.
  await expect(page.getByTestId('travel-fast')).toHaveText(/1時間/);
  await page.getByTestId('travel-fast').click();
  await runSim(page, 90, 'g.state.world.travel === null && g.state.player.cell !== g.state.world.homeCell');
  await page.waitForFunction((cell) => window.__game?.map != null && window.__game.state!.tactical?.cell === cell, target, { timeout: 60_000 });
  await page.evaluate(() => window.__game!.dispatch({ type: 'resupply' })); // (what the B key sends)
  await expect.poll(() => page.evaluate(() => window.__game!.state!.player.inv.ammo)).toBeGreaterThanOrEqual(50);
  // The compound stands in the middle of the area.
  await page.evaluate(() => {
    const g = window.__game!;
    const s = g.map!.solids.filter((x) => x.kind === 'prop').at(-1)!;
    g.debug.teleport(s.x0 - 4, s.z0 + 26, 0, -0.05);
    g.dispatch({ type: 'setMode', mode: 'tactical' });
  });
  await expect(page.getByTestId('mode-tactical')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const p = window.__game!.state!.player;
    p.yaw = 0;
    p.pitch = -0.05;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/build-outpost-compound.png' });
  expect(errors).toEqual([]);
});
