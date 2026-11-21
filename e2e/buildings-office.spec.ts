// 07d-2c: the office buildings in the yard (?yard=1). For every type: in through a door, up to its
// highest open room (the roof for all but the warehouse — up to thirty-two storeys of stairs), and
// one shelf searched there or on the way; then the budget with all of them standing side by side
// (on the office street, on the skyscraper's roof, inside a tower), and a view of each from above
// at an angle.

import { expect, test, type Page } from '@playwright/test';

const TYPES = [
  'office.zakkyo_narrow', 'office.small', 'office.tenant', 'office.shotengai3', 'office.rc_old', 'office.ekimae', 'office.clinic', 'office.juku',
  'office.soko', 'office.glass_low', 'office.mid', 'office.depart', 'office.shogyo', 'office.medical_mall', 'office.chosha',
  'office.tower20', 'office.hotel_office', 'office.mansion_shogyo', 'office.skyscraper', 'office.tower_mansion',
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
  // Let the renderer see the new camera position first (two frames), or `pending` is still the old view's.
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
    t0 = performance.now();
    for (let i = 0; i < 20; i++) g.renderer.draw(s, 0, 0);
    const draw = (performance.now() - t0) / 20;
    return { calls: info.calls, triangles: info.triangles, tick, draw };
  });
}

async function openYard(page: Page): Promise<void> {
  await page.goto('/?yard=1&res=fixed');
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
}

test('yard: every office building can be entered, climbed to the top and searched', async ({ page }) => {
  test.setTimeout(1_500_000);
  const errors = trackErrors(page);
  await openYard(page);
  await page.evaluate(() => {
    window.__game!.renderer.setAutoResolution(false);
    window.__game!.debug.setClock(10);
    window.__game!.state!.player.hp = 1e9;
  });
  const report: string[] = [];
  for (const id of TYPES) {
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
      const top = Math.max(...open.map((q) => q.level));
      const goal = open.filter((q) => q.level === top).sort((a, c) => (c.wx1 - c.wx0) * (c.wz1 - c.wz0) - (a.wx1 - a.wx0) * (a.wz1 - a.wz0))[0]!;
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

    // The nearest open shelf in this part of the building (on the roof, or the storeys below it).
    const spot = await page.evaluate(([i, part]) => {
      const g = window.__game!;
      const det = g.debug.enterable(i)!;
      const p = g.state!.player.pos;
      const open = det.search.filter((s) => !det.bp.rooms[s.room]!.locked && part.includes(s.room));
      if (open.length === 0) return null;
      open.sort((a, b) => Math.abs(a.wpos[1] - p[1]) - Math.abs(b.wpos[1] - p[1]) || Math.hypot(a.wpos[0] - p[0], a.wpos[2] - p[2]) - Math.hypot(b.wpos[0] - p[0], b.wpos[2] - p[2]));
      const s = open[0]!;
      return { pos: s.wpos, table: s.table, path: g.debug.pathTo(s.wpos[0], s.wpos[1], s.wpos[2]) };
    }, [r.i, r.part] as const);
    if (spot) {
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
    } else expect(false, `${id}: something to search`).toBe(true);
    report.push(`${id}: up to the ${r.goal.use} (storey ${r.goal.level})${spot ? `, searched a ${spot.table} shelf` : ' (nothing to search out front)'}`);
    if (['office.skyscraper', 'office.tower_mansion', 'office.depart', 'office.tenant'].includes(id)) {
      await settle(page);
      await page.evaluate(() => {
        window.__game!.state!.player.pitch = -0.2;
      });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `test-results/office-${id}.png` });
    }
  }
  console.log(report.join('\n'));
  expect(errors).toEqual([]);
});

test('yard: all the office buildings side by side stay within the budget', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await openYard(page);
  const where = await page.evaluate(() => {
    const g = window.__game!;
    g.renderer.setAutoResolution(false);
    g.debug.setClock(11);
    const list = g.debug.enterables();
    const offices = list.filter((e) => e.def.startsWith('office.') && e.rot === 0);
    const streets = [...new Set(offices.map((e) => Math.round(e.z1)))];
    const rows = streets.map((z) => offices.filter((e) => Math.round(e.z1) === z));
    const sky = list.find((e) => e.def === 'office.skyscraper' && e.rot === 0)!;
    return {
      n: list.length,
      rows: rows.map((r) => [(r[0]!.x0 + r[r.length - 1]!.x1) / 2, r[0]!.z1 + 9] as [number, number]),
      sky: sky.i,
    };
  });
  const report: string[] = [`yard: ${where.n} enterable buildings`];
  const all: { calls: number; triangles: number; tick: number; draw: number }[] = [];
  for (const [i, at] of where.rows.entries()) {
    await page.evaluate((p) => window.__game!.debug.teleport(p[0], p[1], Math.PI / 2, 0.05), at);
    await settle(page);
    await page.screenshot({ path: `test-results/office-street-${i}.png` });
    const m = await measure(page);
    all.push(m);
    report.push(`office street ${i}: ${m.calls} draw calls, ${m.triangles} triangles, sim ${m.tick.toFixed(2)} + draw ${m.draw.toFixed(2)} ms`);
  }
  // On the skyscraper's roof (the highest perch), looking over the yard.
  const roof = await page.evaluate((i) => {
    const det = window.__game!.debug.enterable(i)!;
    const r = det.rooms.filter((q) => q.use === 'roof').sort((a, b) => (b.wx1 - b.wx0) * (b.wz1 - b.wz0) - (a.wx1 - a.wx0) * (a.wz1 - a.wz0))[0]!;
    return [(r.wx0 + r.wx1) / 2, r.wy, (r.wz0 + r.wz1) / 2] as [number, number, number];
  }, where.sky);
  await page.evaluate((p) => window.__game!.debug.teleport(p[0], p[2], Math.PI, -0.25, p[1]), roof);
  await settle(page);
  await page.screenshot({ path: 'test-results/office-skyscraper-roof.png' });
  const top = await measure(page);
  all.push(top);
  report.push(`skyscraper roof (${roof[1].toFixed(0)} m): ${top.calls} draw calls, ${top.triangles} triangles, sim ${top.tick.toFixed(2)} + draw ${top.draw.toFixed(2)} ms`);
  // Inside, in the sky lobby half way up.
  const lobby = await page.evaluate((i) => {
    const det = window.__game!.debug.enterable(i)!;
    const r = det.rooms.filter((q) => q.level === 15 && q.use === 'lobby')[0]!;
    return [(r.wx0 + r.wx1) / 2, r.wy, (r.wz0 + r.wz1) / 2] as [number, number, number];
  }, where.sky);
  await page.evaluate((p) => window.__game!.debug.teleport(p[0], p[2], 0, 0, p[1]), lobby);
  await settle(page);
  await page.screenshot({ path: 'test-results/office-skyscraper-skylobby.png' });
  const inside = await measure(page);
  all.push(inside);
  report.push(`skyscraper sky lobby (16th floor): ${inside.calls} draw calls, ${inside.triangles} triangles, sim ${inside.tick.toFixed(2)} + draw ${inside.draw.toFixed(2)} ms`);
  console.log(report.join('\n'));
  for (const m of all) {
    expect(m.calls).toBeLessThan(150);
    expect(m.triangles).toBeLessThan(500_000);
    expect(m.tick + m.draw).toBeLessThan(4);
  }
  expect(errors).toEqual([]);
});

test('yard: a view of each office building from above at an angle', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = trackErrors(page);
  await openYard(page);
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
      const dx = size * 0.75;
      const dz = size * 1.0;
      const h = det.bp.height * 0.6 + size * 0.7;
      g.debug.teleport(cx + dx, cz + dz, 0, 0, h);
      const p = g.state!.player;
      p.yaw = Math.atan2(dx, dz);
      p.pitch = -Math.atan2(h + p.eye - det.bp.height * 0.4, Math.hypot(dx, dz));
    }, id);
    await settle(page, 700);
    await page.screenshot({ path: `test-results/office-view-${id}.png` });
  }
  expect(errors).toEqual([]);
});
