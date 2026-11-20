// 07d-2a: the ten houses and six apartment blocks in the yard (?yard=1). For every type: in through
// its door, up to its highest open room, and one shelf searched; then the budget with all of them
// standing side by side (on the street, and on the top floor of the eight-storey block).

import { expect, test, type Page } from '@playwright/test';

const TYPES = [
  'house.hiraya', 'house.wafu2', 'house.yofu2', 'house.kominka', 'house.noka', 'house.nisetai', 'house.kyosho3', 'house.prefab', 'house.tenpo', 'house.bessou',
  'apartment.mokuzo2', 'apartment.tekkotsu3', 'apartment.danchi5', 'apartment.mansion8', 'apartment.ryo', 'apartment.shataku',
];

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

/** Walk the player through feet waypoints by stepping the sim; true when every one was reached. */
async function walk(page: Page, pts: [number, number, number][]): Promise<boolean> {
  return page.evaluate((way) => {
    const g = window.__game!;
    const s = g.state!;
    for (const [tx, ty, tz] of way) {
      let ok = false;
      for (let i = 0; i < 60 * 40; i++) {
        const p = s.player;
        const dx = tx - p.pos[0];
        const dz = tz - p.pos[2];
        if (Math.hypot(dx, dz) < 0.3 && Math.abs(ty - p.pos[1]) < 0.4) {
          ok = true;
          break;
        }
        p.yaw = Math.atan2(-dx, -dz);
        g.sim.tick(s, 1 / 60, { ...g.debug.noInput, moveZ: Math.min(1, Math.hypot(dx, dz) / 0.6 + 0.2) });
      }
      if (!ok) return false;
    }
    return true;
  }, pts);
}

async function settle(page: Page, ms = 1200): Promise<void> {
  await page.waitForFunction(() => window.__game!.debug.renderInfo().pending === 0, null, { timeout: 60_000 });
  await page.waitForTimeout(ms);
}

/** One sim step and one draw submission, measured directly (CLAUDE.md), and the counts of the last frame. */
async function measure(page: Page): Promise<{ calls: number; triangles: number; tick: number; draw: number }> {
  return page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    g.renderer.draw(s, 0, 0);
    const info = g.debug.renderInfo();
    let t0 = performance.now();
    for (let i = 0; i < 120; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
    const tick = (performance.now() - t0) / 120;
    t0 = performance.now();
    for (let i = 0; i < 20; i++) g.renderer.draw(s, 0, 0);
    const draw = (performance.now() - t0) / 20;
    return { calls: info.calls, triangles: info.triangles, tick, draw };
  });
}

test('yard: every house and apartment block can be entered, climbed and searched', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = trackErrors(page);
  await page.goto('/?yard=1&res=fixed');
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
  await page.evaluate(() => {
    window.__game!.renderer.setAutoResolution(false);
    window.__game!.debug.setClock(10);
    window.__game!.state!.player.hp = 1e9;
  });
  const report: string[] = [];
  for (const id of TYPES) {
    // From the street in front, through the first door from outside, to the highest open room.
    const r = await page.evaluate((def) => {
      const g = window.__game!;
      const b = g.debug.enterables().find((e) => e.def === def && e.rot === 0)!;
      const det = g.debug.enterable(b.i)!;
      const open = det.rooms.filter((q) => !q.locked);
      const top = Math.max(...open.map((q) => q.level));
      const goal = open.find((q) => q.level === top)!;
      const into = det.links.find((l) => l.b === goal.id || l.a === goal.id)!;
      const target = into.b === goal.id ? into.wpts[into.wpts.length - 1]! : into.wpts[0]!;
      const door = det.links.find((l) => l.a === -1)!;
      g.debug.teleport(door.wpts[0]![0], door.wpts[0]![2], 0, 0, door.wpts[0]![1]);
      const inside = door.wpts[door.wpts.length - 1]!;
      return { i: b.i, goal: { use: goal.use, level: goal.level, y: goal.wy }, door: door.wpts.slice(1), inside, target };
    }, id);
    expect(await walk(page, r.door), `${id}: in through the door`).toBe(true);
    const route = await page.evaluate((t) => window.__game!.debug.pathTo(t[0], t[1], t[2]), r.target);
    expect(route, `${id}: a way to the ${r.goal.use}`).not.toBeNull();
    expect(await walk(page, route!), `${id}: walked to the ${r.goal.use} on storey ${r.goal.level}`).toBe(true);
    expect(await page.evaluate(() => window.__game!.state!.player.pos[1])).toBeCloseTo(r.goal.y, 1);

    // The nearest shelf on this floor (or any open one), searched.
    const spot = await page.evaluate((i) => {
      const g = window.__game!;
      const det = g.debug.enterable(i)!;
      const p = g.state!.player.pos;
      const open = det.search.filter((s) => !det.bp.rooms[s.room]!.locked);
      open.sort((a, b) => Math.abs(a.wpos[1] - p[1]) - Math.abs(b.wpos[1] - p[1]) || Math.hypot(a.wpos[0] - p[0], a.wpos[2] - p[2]) - Math.hypot(b.wpos[0] - p[0], b.wpos[2] - p[2]));
      const s = open[0]!;
      return { pos: s.wpos, table: s.table, path: g.debug.pathTo(s.wpos[0], s.wpos[1], s.wpos[2]) };
    }, r.i);
    expect(spot.path, `${id}: a way to the ${spot.table} shelf`).not.toBeNull();
    expect(await walk(page, spot.path!), `${id}: walked to the ${spot.table} shelf`).toBe(true);
    const searched = await page.evaluate(() => {
      const g = window.__game!;
      const s = g.state!;
      const before = s.tactical!.lootSpots.filter((q) => q.taken).length;
      // The yard is a range (no searching, no people hiding): lift that for the one press of E.
      s.tactical!.hideouts = [];
      s.flags.range = false;
      g.sim.tick(s, 1 / 60, { ...g.debug.noInput, interact: true });
      s.flags.range = true;
      for (let i = 0; i < 10; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
      return s.tactical!.lootSpots.filter((q) => q.taken).length - before;
    });
    expect(searched, `${id}: searched the ${spot.table} shelf`).toBe(1);
    report.push(`${id}: up to the ${r.goal.use} (storey ${r.goal.level}), searched a ${spot.table} shelf`);
    if (id === 'house.kominka' || id === 'apartment.mansion8' || id === 'house.noka') {
      await settle(page);
      await page.evaluate(() => {
        const p = window.__game!.state!.player;
        p.pitch = -0.2;
      });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `test-results/residential-${id}.png` });
    }
  }
  console.log(report.join('\n'));
  expect(errors).toEqual([]);
});

test('yard: all the houses and apartment blocks side by side stay within the budget', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await page.goto('/?yard=1&res=fixed');
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
  const where = await page.evaluate(() => {
    const g = window.__game!;
    g.renderer.setAutoResolution(false);
    g.debug.setClock(11);
    const list = g.debug.enterables();
    const houses = list.filter((e) => e.def.startsWith('house.') && e.rot === 0);
    const mansion = list.find((e) => e.def === 'apartment.mansion8' && e.rot === 0)!;
    const det = g.debug.enterable(mansion.i)!;
    const top = Math.max(...det.rooms.filter((r) => !r.locked).map((r) => r.level));
    const hall = det.rooms.find((r) => r.level === top && r.use === 'hall')!;
    return {
      street: [(houses[0]!.x0 + houses[houses.length - 1]!.x1) / 2, 520] as [number, number],
      mansion: { i: mansion.i, x: (mansion.x0 + mansion.x1) / 2 },
      hall: [(hall.wx0 + hall.wx1) / 2, hall.wy, (hall.wz0 + hall.wz1) / 2] as [number, number, number],
      n: list.length,
    };
  });
  const report: string[] = [`yard: ${where.n} enterable buildings`];
  // In the street among the houses, looking along the row.
  await page.evaluate((w) => window.__game!.debug.teleport(w.street[0], w.street[1], Math.PI / 2, 0.02), where);
  await settle(page);
  await page.screenshot({ path: 'test-results/residential-street.png' });
  const street = await measure(page);
  report.push(`street: ${street.calls} draw calls, ${street.triangles} triangles, sim ${street.tick.toFixed(2)} + draw ${street.draw.toFixed(2)} ms`);
  // Up in the eight-storey block's top-floor corridor, looking out of the window at its end.
  await page.evaluate((w) => window.__game!.debug.teleport(w.mansion.x, 515, 0, 0), where);
  const path = await page.evaluate((w) => window.__game!.debug.pathTo(w.hall[0], w.hall[1], w.hall[2]), where);
  expect(path).not.toBeNull();
  const door = await page.evaluate((i) => {
    const det = window.__game!.debug.enterable(i)!;
    return det.links.find((l) => l.a === -1)!.wpts;
  }, where.mansion.i);
  await page.evaluate((p) => window.__game!.debug.teleport(p[0]![0], p[0]![2], 0, 0, p[0]![1]), door);
  expect(await walk(page, door.slice(1))).toBe(true);
  const up = await page.evaluate((w) => window.__game!.debug.pathTo(w.hall[0], w.hall[1], w.hall[2]), where);
  expect(await walk(page, up!)).toBe(true);
  await page.evaluate(() => {
    const p = window.__game!.state!.player;
    p.yaw = -Math.PI / 2;
    p.pitch = 0;
  });
  await settle(page);
  await page.screenshot({ path: 'test-results/residential-mansion-top.png' });
  const inside = await measure(page);
  report.push(`mansion top floor: ${inside.calls} draw calls, ${inside.triangles} triangles, sim ${inside.tick.toFixed(2)} + draw ${inside.draw.toFixed(2)} ms`);
  console.log(report.join('\n'));
  for (const m of [street, inside]) {
    expect(m.calls).toBeLessThan(150);
    expect(m.triangles).toBeLessThan(500_000);
    expect(m.tick + m.draw).toBeLessThan(4);
  }
  expect(errors).toEqual([]);
});

test('yard: a view of each house and apartment block from above at an angle', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = trackErrors(page);
  await page.goto('/?yard=1&res=fixed');
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
  await page.evaluate(() => {
    const g = window.__game!;
    g.renderer.setAutoResolution(false);
    g.debug.setClock(10);
    g.state!.time.speed = 0; // the camera hangs in the air without falling
  });
  for (const id of TYPES) {
    await page.evaluate((def) => {
      const g = window.__game!;
      const b = g.debug.enterables().find((e) => e.def === def && e.rot === 0)!;
      const det = g.debug.enterable(b.i)!;
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      const size = Math.max(b.x1 - b.x0, b.z1 - b.z0, det.bp.height);
      // From the front right (the street side), up and back.
      const dx = size * 0.75;
      const dz = size * 1.0;
      const h = det.bp.height * 0.6 + size * 0.7;
      g.debug.teleport(cx + dx, cz + dz, 0, 0, h);
      const p = g.state!.player;
      p.yaw = Math.atan2(dx, dz);
      p.pitch = -Math.atan2(h + p.eye - det.bp.height * 0.4, Math.hypot(dx, dz));
    }, id);
    await settle(page, 700);
    await page.screenshot({ path: `test-results/residential-view-${id}.png` });
  }
  expect(errors).toEqual([]);
});
