// 07d-2e: the stations and airports in the yards — the small stations in the yard (?yard=1), the big
// ones and the airports in the big yard (?yard=2). For every type: in through a door, up to its
// highest open room (footbridge, roof decks, the hotel roof, the tower cabs), one shelf searched;
// at every station also into an open train car and its bag searched. Then the budget with all of
// them standing, and a view of each from above at an angle.

import { expect, test, type Page } from '@playwright/test';

const SMALL = ['transport.station_mujin', 'transport.station_town', 'transport.station_city'];
const BIG = ['transport.station_pref', 'transport.station_seirei', 'transport.airport_s', 'transport.airport_m', 'transport.airport_l'];

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
      for (let i = 0; i < 60 * 90; i++) {
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
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
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
    // Median of 20 draws: one garbage-collection pause must not decide the result.
    const draws: number[] = [];
    for (let i = 0; i < 20; i++) {
      t0 = performance.now();
      g.renderer.draw(s, 0, 0);
      draws.push(performance.now() - t0);
    }
    draws.sort((a, b) => a - b);
    const draw = draws[10]!;
    return { calls: info.calls, triangles: info.triangles, tick, draw };
  });
}

async function openYard(page: Page, big: boolean): Promise<void> {
  await page.goto(`/?yard=${big ? 2 : 1}&res=fixed`);
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
  await page.evaluate(() => {
    window.__game!.renderer.setAutoResolution(false);
    window.__game!.debug.setClock(10);
    window.__game!.state!.player.hp = 1e9;
  });
}

/** Press E once at the player's spot (the yard is a range: lifted for the press). Returns how many spots were taken. */
async function searchHere(page: Page): Promise<number> {
  return page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    const before = s.tactical!.lootSpots.filter((q) => q.taken).length;
    s.tactical!.hideouts = [];
    s.flags.range = false;
    g.sim.tick(s, 1 / 60, { ...g.debug.noInput, interact: true });
    s.flags.range = true;
    for (let i = 0; i < 10; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
    return s.tactical!.lootSpots.filter((q) => q.taken).length - before;
  });
}

/** Walk to the nearest open search point of the given rooms (by table filter) and search it. */
async function searchNear(page: Page, i: number, rooms: number[] | null, table: string | null): Promise<{ table: string } | null> {
  const spot = await page.evaluate(([bi, part, tb]) => {
    const g = window.__game!;
    const det = g.debug.enterable(bi)!;
    const p = g.state!.player.pos;
    const open = det.search.filter((s) => !det.bp.rooms[s.room]!.locked && (part === null || part.includes(s.room)) && (tb === null || s.table === tb));
    if (open.length === 0) return null;
    open.sort((a, b) => Math.abs(a.wpos[1] - p[1]) - Math.abs(b.wpos[1] - p[1]) || Math.hypot(a.wpos[0] - p[0], a.wpos[2] - p[2]) - Math.hypot(b.wpos[0] - p[0], b.wpos[2] - p[2]));
    const s = open[0]!;
    return { table: s.table, path: g.debug.pathTo(s.wpos[0], s.wpos[1], s.wpos[2]) };
  }, [i, rooms, table] as const);
  if (!spot) return null;
  expect(spot.path, `a way to the ${spot.table} spot`).not.toBeNull();
  expect(await walk(page, spot.path!), `walked to the ${spot.table} spot`).toBe(true);
  expect(await searchHere(page), `searched the ${spot.table} spot`).toBe(1);
  return { table: spot.table };
}

async function visit(page: Page, id: string, report: string[]): Promise<void> {
  // The highest open room reachable from outside, and an outside door into its part of the building.
  const r = await page.evaluate((def) => {
    const g = window.__game!;
    const b = g.debug.enterables().find((e) => e.def === def && e.rot === 0)!;
    const det = g.debug.enterable(b.i)!;
    const links = det.bp.links;
    const reach = new Set<number>([-1]);
    for (let changed = true; changed; ) {
      changed = false;
      for (const l of links) {
        if (reach.has(l.a) !== reach.has(l.b)) {
          reach.add(l.a);
          reach.add(l.b);
          changed = true;
        }
      }
    }
    const open = det.rooms.filter((q) => !q.locked && reach.has(q.id));
    const top = Math.max(...open.map((q) => q.wy));
    const goal = open.filter((q) => q.wy === top).sort((a, c) => (c.wx1 - c.wx0) * (c.wz1 - c.wz0) - (a.wx1 - a.wx0) * (a.wz1 - a.wz0))[0]!;
    const part = new Set<number>([goal.id]);
    for (let changed = true; changed; ) {
      changed = false;
      for (const l of links) {
        if (l.a < 0) continue;
        if (part.has(l.a) !== part.has(l.b)) {
          part.add(l.a);
          part.add(l.b);
          changed = true;
        }
      }
    }
    const door = det.links.find((l) => l.a === -1 && part.has(l.b))!;
    const into = det.links.find((l) => l.b === goal.id || l.a === goal.id)!;
    const target = into.b === goal.id ? into.wpts[into.wpts.length - 1]! : into.wpts[0]!;
    g.debug.teleport(door.wpts[0]![0], door.wpts[0]![2], 0, 0, door.wpts[0]![1]);
    return { i: b.i, goal: { use: goal.use, level: goal.level, y: goal.wy }, door: door.wpts.slice(1), target, part: [...part] };
  }, id);
  expect(await walk(page, r.door), `${id}: in through the door`).toBe(true);
  const route = await page.evaluate((t) => window.__game!.debug.pathTo(t[0], t[1], t[2]), r.target);
  expect(route, `${id}: a way to the ${r.goal.use}`).not.toBeNull();
  expect(await walk(page, route!), `${id}: walked to the ${r.goal.use} on storey ${r.goal.level}`).toBe(true);
  expect(await page.evaluate(() => window.__game!.state!.player.pos[1])).toBeCloseTo(r.goal.y, 1);
  const found = await searchNear(page, r.i, r.part, null);
  expect(found, `${id}: something to search up there`).not.toBeNull();
  let line = `${id}: up to the ${r.goal.use} (storey ${r.goal.level}, ${r.goal.y.toFixed(1)} m), searched a ${found!.table} spot`;
  if (id.includes('station')) {
    // Into an open car of a train standing at a platform, and its bag.
    const car = await searchNear(page, r.i, null, 'train');
    expect(car, `${id}: an open train car`).not.toBeNull();
    line += ', searched a bag in a train';
  }
  await settle(page, 600);
  await page.screenshot({ path: `test-results/transport-${id}.png` });
  report.push(line);
}

test('yards: every station and airport can be entered, climbed and searched (and the trains boarded)', async ({ page }) => {
  test.setTimeout(1_500_000);
  const errors = trackErrors(page);
  const report: string[] = [];
  await openYard(page, false);
  for (const id of SMALL) await visit(page, id, report);
  await openYard(page, true);
  for (const id of BIG) await visit(page, id, report);
  console.log(report.join('\n'));
  expect(errors).toEqual([]);
});

test('yards: all the stations and airports side by side stay within the budget', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = trackErrors(page);
  const report: string[] = [];
  const all: { calls: number; triangles: number; tick: number; draw: number }[] = [];
  const take = async (name: string): Promise<void> => {
    await settle(page);
    await page.screenshot({ path: `test-results/transport-budget-${name.replace(/[ ,()]+/g, '-')}.png` });
    const m = await measure(page);
    all.push(m);
    report.push(`${name}: ${m.calls} draw calls, ${m.triangles} triangles, sim ${m.tick.toFixed(2)} + draw ${m.draw.toFixed(2)} ms`);
  };
  // The small stations' street in the yard.
  await openYard(page, false);
  const at = await page.evaluate((ids) => {
    const list = window.__game!.debug.enterables().filter((e) => ids.includes(e.def) && e.rot === 0);
    return [(list[0]!.x0 + list[list.length - 1]!.x1) / 2, list[0]!.z1 + 9] as [number, number];
  }, SMALL);
  await page.evaluate((p) => window.__game!.debug.teleport(p[0], p[1], Math.PI / 2, 0.02), at);
  await take('yard, the small stations street');
  // The big yard: in front of each, on the hotel roof, the platforms of the big city, the tower cab.
  await openYard(page, true);
  const spots = await page.evaluate((ids) => {
    const g = window.__game!;
    const list = g.debug.enterables();
    const out: [string, [number, number, number], number][] = [];
    for (const id of ids) {
      const b = list.find((e) => e.def === id)!;
      out.push([`in front of ${id}`, [(b.x0 + b.x1) / 2, 0, b.z1 + 6], Math.PI]);
    }
    const sei = list.find((e) => e.def === 'transport.station_seirei')!;
    const det = g.debug.enterable(sei.i)!;
    const roof = det.rooms.filter((q) => q.use === 'roof').sort((a, b) => b.wy - a.wy)[0]!;
    out.push(['the hotel roof of the big city station', [(roof.wx0 + roof.wx1) / 2, roof.wy, (roof.wz0 + roof.wz1) / 2], 0]);
    const plat = det.rooms.filter((q) => q.use === 'platform').sort((a, b) => (b.wx1 - b.wx0) - (a.wx1 - a.wx0))[0]!;
    out.push(['a platform of the big city station', [(plat.wx0 + plat.wx1) / 2, plat.wy, (plat.wz0 + plat.wz1) / 2], Math.PI / 2]);
    const air = list.find((e) => e.def === 'transport.airport_l')!;
    const cab = g.debug.enterable(air.i)!.rooms.filter((q) => q.use === 'tower').sort((a, b) => b.wy - a.wy)[0]!;
    out.push(['the tower cab of the large airport', [(cab.wx0 + cab.wx1) / 2, cab.wy, (cab.wz0 + cab.wz1) / 2], 0]);
    return out;
  }, BIG);
  for (const [name, p, yaw] of spots) {
    await page.evaluate(([q, y]) => window.__game!.debug.teleport(q[0], q[2], y, -0.05, q[1] > 0.5 ? q[1] : undefined), [p, yaw] as const);
    await take(name);
  }
  console.log(report.join('\n'));
  for (const m of all) {
    expect(m.calls).toBeLessThan(150);
    expect(m.triangles).toBeLessThan(500_000);
    expect(m.tick + m.draw).toBeLessThan(4);
  }
  expect(errors).toEqual([]);
});

test('yards: a view of each station and airport from above at an angle', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = trackErrors(page);
  for (const big of [false, true]) {
    await openYard(page, big);
    await page.evaluate(() => {
      window.__game!.state!.time.speed = 0; // the camera hangs in the air without falling
    });
    for (const id of big ? BIG : SMALL) {
      await page.evaluate((def) => {
        const g = window.__game!;
        const b = g.debug.enterables().find((e) => e.def === def && e.rot === 0)!;
        const det = g.debug.enterable(b.i)!;
        // Big sites: from their front-right corner, close enough that all of the near half is drawn in full.
        const size = Math.min(220, Math.max(b.x1 - b.x0, b.z1 - b.z0, det.bp.height));
        const cx = Math.min((b.x0 + b.x1) / 2, b.x0 + 160);
        const cz = (b.z0 + b.z1) / 2;
        const dx = size * 0.75;
        const dz = size * 0.9;
        const h = det.bp.height * 0.4 + size * 0.55;
        g.debug.teleport(cx + dx, Math.min(cz + dz, b.z1 + 120), 0, 0, h);
        const p = g.state!.player;
        p.yaw = Math.atan2(p.pos[0] - cx, p.pos[2] - cz);
        p.pitch = -Math.atan2(h + p.eye - det.bp.height * 0.2, Math.hypot(p.pos[0] - cx, p.pos[2] - cz));
      }, id);
      await settle(page, 700);
      await page.screenshot({ path: `test-results/transport-view-${id}.png` });
    }
  }
  expect(errors).toEqual([]);
});
