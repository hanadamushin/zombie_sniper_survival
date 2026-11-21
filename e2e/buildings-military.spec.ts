// 07d-2f: the Self-Defense Force sites in the yards — the ten field camps and the small garrison in the
// yard (?yard=1), the middle and large garrisons, the naval and the air base in the third yard
// (?yard=3). For every type: in through a door, up to its highest open room (the watchtower, the
// HQ roof, the ship's bridge, the control tower's cab), one shelf searched. At the small garrison
// the key: the commander's safe searched, then into the armory it opens and its rack searched. Then
// the budget with all of them standing, and a view of each from above at an angle.

import { expect, test, type Page } from '@playwright/test';

const CAMPS = ['squad', 'checkpoint', 'hospital', 'heliport', 'supply', 'signal', 'watch', 'command', 'motor', 'battalion'].map((v) => `military.camp_${v}`);
const SMALL = [...CAMPS, 'base.jgsdf_s'];
const BIG = ['base.jgsdf_m', 'base.jgsdf_l', 'base.jmsdf', 'base.jasdf'];

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
    for (let i = 0; i < 120; i++) g.sim.tick(s, 1 / 60, g.debug.noInput);
    const tick = (performance.now() - t0) / 120;
    t0 = performance.now();
    for (let i = 0; i < 20; i++) g.renderer.draw(s, 0, 0);
    const draw = (performance.now() - t0) / 20;
    return { calls: info.calls, triangles: info.triangles, tick, draw };
  });
}

async function openYard(page: Page, big: boolean): Promise<void> {
  await page.goto(`/?yard=${big ? 3 : 1}&res=fixed`);
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

/**
 * Walk to the nearest open search point (of the given rooms, on a table / holding the key) and search
 * it. Inside a room the way is a straight line, and a hall full of trucks or crates can stand across
 * it: the next nearest spot is tried from where the walk started (up to six).
 */
async function searchNear(page: Page, i: number, rooms: number[] | null, table: string | null, key = false): Promise<{ table: string } | null> {
  const start = await page.evaluate(() => [...window.__game!.state!.player.pos] as [number, number, number]);
  const spots = await page.evaluate(([bi, part, tb, k]) => {
    const g = window.__game!;
    const det = g.debug.enterable(bi)!;
    const p = g.state!.player.pos;
    const open = det.search.filter((s) => !det.bp.rooms[s.room]!.locked && (part === null || part.includes(s.room)) && (tb === null || s.table === tb) && (!k || s.key === true));
    open.sort((a, b) => Math.abs(a.wpos[1] - p[1]) - Math.abs(b.wpos[1] - p[1]) || Math.hypot(a.wpos[0] - p[0], a.wpos[2] - p[2]) - Math.hypot(b.wpos[0] - p[0], b.wpos[2] - p[2]));
    return open.slice(0, 6).map((s) => ({ table: s.table, path: g.debug.pathTo(s.wpos[0], s.wpos[1], s.wpos[2]) }));
  }, [i, rooms, table, key] as const);
  if (spots.length === 0) return null;
  for (const spot of spots) {
    if (!spot.path) continue;
    await page.evaluate((p) => window.__game!.debug.teleport(p[0], p[2], 0, 0, p[1]), start);
    if (!(await walk(page, spot.path))) continue;
    expect(await searchHere(page), `searched the ${spot.table} spot`).toBe(1);
    return { table: spot.table };
  }
  throw new Error(`none of the ${spots.length} nearest ${table ?? ''} spots could be walked to`);
}

async function visit(page: Page, id: string, report: string[]): Promise<number> {
  // The highest open room reachable from outside, and an outside door into its part of the site.
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
    return { i: b.i, goal: { use: goal.use, level: goal.level, y: goal.wy - b.base }, door: door.wpts.slice(1), target, part: [...part] };
  }, id);
  expect(await walk(page, r.door), `${id}: in through the door`).toBe(true);
  const route = await page.evaluate((t) => window.__game!.debug.pathTo(t[0], t[1], t[2]), r.target);
  expect(route, `${id}: a way to the ${r.goal.use}`).not.toBeNull();
  expect(await walk(page, route!), `${id}: walked to the ${r.goal.use} on storey ${r.goal.level}`).toBe(true);
  const found = await searchNear(page, r.i, r.part, null);
  expect(found, `${id}: something to search up there`).not.toBeNull();
  report.push(`${id}: up to the ${r.goal.use} (storey ${r.goal.level}, ${r.goal.y.toFixed(1)} m), searched a ${found!.table} spot`);
  await settle(page, 600);
  await page.screenshot({ path: `test-results/military-${id}.png` });
  return r.i;
}

test('yards: every camp and base can be entered, climbed and searched; the safe\'s key opens the armory', async ({ page }) => {
  test.setTimeout(1_800_000);
  const errors = trackErrors(page);
  const report: string[] = [];
  await openYard(page, false);
  for (const id of SMALL) await visit(page, id, report);
  // The key: the commander's safe in the small garrison's HQ, then its armory.
  const gi = await page.evaluate(() => window.__game!.debug.enterables().find((e) => e.def === 'base.jgsdf_s' && e.rot === 0)!.i);
  const locked = await page.evaluate((i) => window.__game!.debug.enterable(i)!.rooms.filter((r) => r.locked).length, gi);
  const shut = await searchNear(page, gi, null, 'weapons');
  expect(shut, 'the armory is shut before the key').toBeNull();
  // From the outer door nearest the safe (the HQ's entrance).
  await page.evaluate((i) => {
    const g = window.__game!;
    const det = g.debug.enterable(i)!;
    const safe = det.search.find((s) => s.key)!;
    const d = (l: (typeof det.links)[number]): number => Math.hypot(l.wpts[0]![0] - safe.wpos[0], l.wpts[0]![2] - safe.wpos[2]);
    const door = det.links.filter((l) => l.a === -1).sort((a, b) => d(a) - d(b))[0]!;
    g.debug.teleport(door.wpts[0]![0], door.wpts[0]![2], 0, 0, door.wpts[0]![1]);
  }, gi);
  expect(await searchNear(page, gi, null, null, true), 'the safe').not.toBeNull();
  const after = await page.evaluate((i) => {
    const g = window.__game!;
    return { locked: g.debug.enterable(i)!.rooms.filter((r) => r.locked).length, log: g.state!.colony.log.at(-1)?.text };
  }, gi);
  expect(after.locked).toBeLessThan(locked);
  expect(after.log).toBe('log.keyFound');
  const arms = await searchNear(page, gi, null, 'weapons');
  expect(arms, 'the armory rack after the key').not.toBeNull();
  report.push(`base.jgsdf_s: the safe searched (key found: ${locked - after.locked} rooms opened), walked into the armory and searched its rack`);
  await settle(page, 600);
  await page.screenshot({ path: 'test-results/military-armory-open.png' });
  await openYard(page, true);
  for (const id of BIG) await visit(page, id, report);
  console.log(report.join('\n'));
  expect(errors).toEqual([]);
});

test('yards: all the camps and bases side by side stay within the budget', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = trackErrors(page);
  const report: string[] = [];
  const all: { calls: number; triangles: number; tick: number; draw: number }[] = [];
  const take = async (name: string): Promise<void> => {
    await settle(page);
    await page.screenshot({ path: `test-results/military-budget-${name.replace(/[ ,()']+/g, '-')}.png` });
    const m = await measure(page);
    all.push(m);
    report.push(`${name}: ${m.calls} draw calls, ${m.triangles} triangles, sim ${m.tick.toFixed(2)} + draw ${m.draw.toFixed(2)} ms`);
  };
  await openYard(page, false);
  const spots = await page.evaluate((ids) => {
    const g = window.__game!;
    const list = g.debug.enterables().filter((e) => ids.includes(e.def) && e.rot === 0);
    const out: [string, [number, number, number], number][] = [];
    out.push(['the camps street', [(list[0]!.x0 + list[list.length - 2]!.x1) / 2, 0, list[0]!.z1 + 9], Math.PI / 2]);
    const bat = list.find((e) => e.def === 'military.camp_battalion')!;
    out.push(['in the battalion camp', [(bat.x0 + bat.x1) / 2, 0, (bat.z0 + bat.z1) / 2 + 10], 0]);
    const tower = g.debug.enterable(bat.i)!.rooms.filter((q) => q.use === 'tower').sort((a, b) => b.wy - a.wy)[0]!;
    out.push(['on the battalion camp\'s watchtower', [(tower.wx0 + tower.wx1) / 2, tower.wy, (tower.wz0 + tower.wz1) / 2], Math.PI * 0.75]);
    const gs = list.find((e) => e.def === 'base.jgsdf_s')!;
    out.push(['in the small garrison', [(gs.x0 + gs.x1) / 2, 0, gs.z1 - 25], 0]);
    return out;
  }, SMALL);
  const go = async (list: [string, [number, number, number], number][]): Promise<void> => {
    for (const [name, p, yaw] of list) {
      await page.evaluate(([q, y]) => window.__game!.debug.teleport(q[0], q[2], y, -0.05, q[1] > 0.5 ? q[1] : undefined), [p, yaw] as const);
      await take(name);
    }
  };
  await go(spots);
  await openYard(page, true);
  const big = await page.evaluate((ids) => {
    const g = window.__game!;
    const list = g.debug.enterables();
    const out: [string, [number, number, number], number][] = [];
    for (const id of ids) {
      const b = list.find((e) => e.def === id)!;
      out.push([`in ${id}`, [(b.x0 + b.x1) / 2, 0, b.z1 - 25], 0]);
    }
    const ms = list.find((e) => e.def === 'base.jmsdf')!;
    const bridge = g.debug.enterable(ms.i)!.rooms.filter((q) => q.use === 'command').sort((a, b) => b.wy - a.wy)[0]!;
    out.push(['on the destroyer\'s bridge', [(bridge.wx0 + bridge.wx1) / 2, bridge.wy, (bridge.wz0 + bridge.wz1) / 2], Math.PI / 2]);
    const as = list.find((e) => e.def === 'base.jasdf')!;
    const cab = g.debug.enterable(as.i)!.rooms.filter((q) => q.use === 'tower').sort((a, b) => b.wy - a.wy)[0]!;
    out.push(['in the air base\'s tower cab', [(cab.wx0 + cab.wx1) / 2, cab.wy, (cab.wz0 + cab.wz1) / 2], 0]);
    return out;
  }, BIG);
  await go(big);
  console.log(report.join('\n'));
  for (const m of all) {
    expect(m.calls).toBeLessThan(150);
    expect(m.triangles).toBeLessThan(500_000);
    expect(m.tick + m.draw).toBeLessThan(4);
  }
  expect(errors).toEqual([]);
});

test('yards: a view of each camp and base from above at an angle', async ({ page }) => {
  test.setTimeout(900_000);
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
        // Big sites: from their front-right, close enough that the near half is drawn in full.
        const size = Math.min(220, Math.max(b.x1 - b.x0, b.z1 - b.z0, det.bp.height));
        const cx = Math.min((b.x0 + b.x1) / 2, b.x0 + 160);
        const cz = Math.max((b.z0 + b.z1) / 2, b.z1 - 110);
        const dx = size * 0.75;
        const dz = size * 0.9;
        const h = det.bp.height * 0.4 + size * 0.55;
        g.debug.teleport(cx + dx, Math.min(cz + dz, b.z1 + 120), 0, 0, h);
        const p = g.state!.player;
        p.yaw = Math.atan2(p.pos[0] - cx, p.pos[2] - cz);
        p.pitch = -Math.atan2(h + p.eye - det.bp.height * 0.2, Math.hypot(p.pos[0] - cx, p.pos[2] - cz));
      }, id);
      await settle(page, 700);
      await page.screenshot({ path: `test-results/military-view-${id}.png` });
    }
  }
  expect(errors).toEqual([]);
});
