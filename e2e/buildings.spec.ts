// 07d: enterable buildings. The yard (?yard=1) has every type side by side on flat ground; the sim
// is stepped from the page (walking at a steady 60 Hz no matter how slowly the software renderer
// draws), the screenshots show what the player sees.

import { expect, test, type Page } from '@playwright/test';

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

/** Let the renderer finish what it has to build (neighbours, building stages), then a moment more. */
async function settle(page: Page, ms = 1200): Promise<void> {
  // Let the renderer see the new camera position first (two frames), or `pending` is still the old view's.
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  // 07d-3: every town building is enterable now; going up one building a frame at the software
  // renderer's few frames a second takes a minute or two in the middle of a city.
  await page.waitForFunction(() => window.__game!.debug.renderInfo().pending === 0, null, { timeout: 240_000 });
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

const SAMPLES = ['house.wood2', 'shop.konbini', 'office.zakkyo5'] as const;

test('yard: in through the front door, up the stairs to the top of each sample, and a shot out of a window', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await page.goto('/?yard=1&res=fixed');
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
  await page.evaluate(() => {
    window.__game!.renderer.setAutoResolution(false);
    window.__game!.debug.setClock(10);
  });
  for (const id of SAMPLES) {
    const r = await page.evaluate((def) => {
      const g = window.__game!.debug;
      const b = g.enterables().find((e) => e.def === def && e.rot === 0)!;
      const det = g.enterable(b.i)!;
      const open = det.rooms.filter((q) => !q.locked);
      const top = Math.max(...open.map((q) => q.level));
      const room = open.find((q) => q.level === top && (q.use === 'roof' || top < 5))!;
      // Out in the street in front of it (07d-2b: the yard goes on along more streets, 9 m from the front).
      g.teleport((b.x0 + b.x1) / 2, b.z1 + 9, 0, 0, 0);
      const target: [number, number, number] = [(room.wx0 + room.wx1) / 2, room.wy, (room.wz0 + room.wz1) / 2];
      return { i: b.i, room: { use: room.use, level: room.level, y: room.wy }, path: g.pathTo(target[0], target[1], target[2]) };
    }, id);
    expect(r.path, id).not.toBeNull();
    expect(await walk(page, r.path!), `${id}: walked to the ${r.room.use}`).toBe(true);
    const y = await page.evaluate(() => window.__game!.state!.player.pos[1]);
    expect(y, id).toBeCloseTo(r.room.y, 1);
    if (r.room.level > 0) expect(y).toBeGreaterThan(2.5);
    await settle(page);
    expect(await page.evaluate((i) => window.__game!.debug.enterableStage(i), r.i)).toBe(2);
    await page.evaluate(() => {
      const p = window.__game!.state!.player;
      p.yaw = -Math.PI * 0.75; // look back across the street (south-east)
      p.pitch = -0.15;
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `test-results/buildings-${id}-top.png` });
  }

  // Upstairs in the house at a front window: a walker in the street, one shot through the glass.
  const shot = await page.evaluate(() => {
    const g = window.__game!;
    const b = g.debug.enterables().find((e) => e.def === 'house.wood2' && e.rot === 0)!;
    const det = g.debug.enterable(b.i)!;
    const p = det.place;
    const win = det.bp.openings.find((o) => o.kind === 'window' && o.exterior && o.level === 1 && o.width > 1 && o.z > p.d - 0.5)!;
    const fy = p.base + det.bp.storeys[1]!.y;
    g.debug.teleport(p.x0 + win.x, p.z0 + win.z - 0.8, Math.PI, 0, fy);
    const id = g.debug.placeZombie(p.x0 + win.x + 3, p.z1 + 7);
    const s = g.state!;
    const z = s.tactical!.zombies.find((q) => q.id === id)!;
    z.dummy = 1;
    s.flags.noSway = true;
    const eye = [s.player.pos[0], s.player.pos[1] + s.player.eye, s.player.pos[2]];
    const dx = z.pos[0] - eye[0]!;
    const dz = z.pos[2] - eye[2]!;
    s.player.yaw = Math.atan2(-dx, -dz);
    s.player.pitch = Math.atan2(z.pos[1] + 1.2 - eye[1]!, Math.hypot(dx, dz));
    s.player.aim.scopeT = 1;
    for (let i = 0; i < 30; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput, scope: true });
    return { id, hp: z.hp };
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/buildings-window-scope.png' });
  const after = await page.evaluate((id) => {
    const g = window.__game!;
    const s = g.state!;
    g.sim.tick(s, 1 / 60, { ...g.debug.noInput, scope: true, fire: true });
    for (let i = 0; i < 40; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput, scope: true });
    const z = s.tactical!.zombies.find((q) => q.id === id);
    return z ? { hp: z.hp, down: z.state === 'down' } : { hp: 0, down: true };
  }, shot.id);
  expect(after.hp < shot.hp || after.down).toBe(true);
  expect(errors).toEqual([]);
});

test('yard: a zombie follows the player in through the door and up the stairs; one at a locked door goes round', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await page.goto('/?yard=1&res=fixed');
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
  const res = await page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    s.player.hp = 1e9;
    const run = (seconds: number, done: () => boolean): number => {
      for (let i = 0; i < seconds * 60; i++) {
        g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
        if (done()) return i / 60;
      }
      return -1;
    };
    // The house: the player in the bedroom upstairs, a walker in the street.
    const hb = g.debug.enterables().find((e) => e.def === 'house.wood2' && e.rot === 0)!;
    const house = g.debug.enterable(hb.i)!;
    const bed = house.rooms.find((r) => r.use === 'bedroom')!;
    g.debug.teleport((bed.wx0 + bed.wx1) / 2, (bed.wz0 + bed.wz1) / 2, 0, 0, bed.wy);
    const a = g.debug.placeZombie((hb.x0 + hb.x1) / 2 + 4, 518, 'walker', true);
    const za = s.tactical!.zombies.find((q) => q.id === a)!;
    const upstairs = run(120, () => za.pos[1] > bed.wy - 0.3 && Math.hypot(za.pos[0] - s.player.pos[0], za.pos[2] - s.player.pos[2]) < 1.5);
    s.tactical!.zombies.length = 0;
    // The convenience store: the player in the back room, a walker at the locked back door.
    const kb = g.debug.enterables().find((e) => e.def === 'shop.konbini' && e.rot === 0)!;
    const shop = g.debug.enterable(kb.i)!;
    const back = shop.rooms.find((r) => r.use === 'backroom')!;
    const door = shop.bp.openings.find((o) => o.kind === 'door' && o.state === 'locked' && o.exterior)!;
    g.debug.teleport((back.wx0 + back.wx1) / 2, (back.wz0 + back.wz1) / 2, 0, 0, back.wy);
    const b = g.debug.placeZombie(kb.x0 + door.x, kb.z0 - 1.5, 'walker', true);
    const zb = s.tactical!.zombies.find((q) => q.id === b)!;
    let wentRound = false;
    const inside = run(150, () => {
      if (zb.pos[2] > kb.z1) wentRound = true;
      return Math.hypot(zb.pos[0] - s.player.pos[0], zb.pos[2] - s.player.pos[2]) < 1.5;
    });
    return { upstairs, inside, wentRound, za: za.pos, zb: zb.pos };
  });
  expect(res.upstairs, `house: ${JSON.stringify(res.za)}`).toBeGreaterThan(0);
  expect(res.inside, `shop: ${JSON.stringify(res.zb)}`).toBeGreaterThan(0);
  expect(res.wentRound).toBe(true);
  await settle(page, 600);
  await page.evaluate(() => {
    const p = window.__game!.state!.player;
    p.yaw = 0;
    p.pitch = -0.1;
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/buildings-zombie-inside.png' });
  expect(errors).toEqual([]);
});

test('city: far buildings are boxes, closer ones show their outside, the nearest their inside; switching stays light; budget on the ground, the roof and indoors', async ({ page }) => {
  test.setTimeout(1_200_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0&res=fixed');
  await page.getByTestId('new-game').click();
  await page.getByTestId('intro-skip').click();
  await page.getByTestId('start-0').click();
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
  // R0: central Sendai (an urban cell ringed by suburbs; the 40th urban cell of the real grid is in
  // the middle of Tokyo, where all eight neighbours are dense city too). R9: Sendai was still a random
  // area then; its real area (R2) has one office.zakkyo5. Central Sapporo (Ōdōri, cell 4800) has the most
  // of them among the urban cells with few urban neighbours (4, two urban neighbours).
  await page.evaluate(() => window.__game!.debug.gotoLatLon(43.0606, 141.3545));
  await page.waitForFunction(() => window.__game?.map?.params.land === 'urban', null, { timeout: 90_000 });
  // An office sample away from the edges, the street in front of it.
  const b = await page.evaluate(() => {
    const g = window.__game!;
    g.renderer.setAutoResolution(false);
    g.debug.setClock(11);
    const s = g.state!;
    s.player.hp = 1e9;
    for (const z of s.tactical!.zombies) z.dummy = 1;
    const list = g.debug.enterables().filter((e) => e.def === 'office.zakkyo5');
    const mid = list.sort((p, q) => Math.hypot((p.x0 + p.x1) / 2 - 512, (p.z0 + p.z1) / 2 - 512) - Math.hypot((q.x0 + q.x1) / 2 - 512, (q.z0 + q.z1) / 2 - 512))[0]!;
    const det = g.debug.enterable(mid.i)!;
    const front = det.links.find((l) => l.a === -1)!.wpts[0]!;
    // Direction from the building's centre out through its front door: stand off along it.
    const cx = (mid.x0 + mid.x1) / 2;
    const cz = (mid.z0 + mid.z1) / 2;
    const len = Math.hypot(front[0] - cx, front[2] - cz);
    return { i: mid.i, n: list.length, cx, cz, ux: (front[0] - cx) / len, uz: (front[2] - cz) / len, front, roof: det.rooms.find((r) => r.use === 'roof')!, hall: det.rooms.find((r) => r.level === 2 && (r.use === 'hall'))! };
  });
  expect(b.n).toBeGreaterThanOrEqual(3);
  const stand = async (dist: number): Promise<number> => {
    await page.evaluate(([b, dist]) => {
      const g = window.__game!;
      const x = b.cx + b.ux * dist;
      const z = b.cz + b.uz * dist;
      // Look back at the building, from eye height over whatever is there.
      g.debug.teleport(x, z, Math.atan2(b.ux, b.uz), dist > 200 ? 0.04 : 0.12);
    }, [b, dist] as const);
    await settle(page);
    return page.evaluate((i) => window.__game!.debug.enterableStage(i), b.i);
  };
  const report: string[] = [];
  expect(await stand(520)).toBe(0);
  await page.screenshot({ path: 'test-results/buildings-stage-far.png' });
  expect(await stand(150)).toBe(1);
  await page.screenshot({ path: 'test-results/buildings-stage-mid.png' });
  expect(await stand(25)).toBe(2);
  await page.screenshot({ path: 'test-results/buildings-stage-near.png' });
  const counts = await page.evaluate(() => window.__game!.debug.enterableStages());
  report.push(`stages at 25 m from an office: far ${counts.far} / outside ${counts.mid} / inside ${counts.near}`);

  // Walking briskly through the city: the slowest stage change and the slowest frame submission.
  const sweep = await page.evaluate(async (b) => {
    const g = window.__game!;
    const s = g.state!;
    g.debug.enterableStages(true);
    let worst = 0;
    for (let k = 0; k < 120; k++) {
      // 5 m per frame (a sprint at 60 fps is 0.08 m; this is a stress test of the switching).
      const x = Math.min(1000, Math.max(24, b.cx - 300 + k * 5));
      g.debug.teleport(x, b.cz + b.uz * 30, -Math.PI / 2, 0);
      const t0 = performance.now();
      g.renderer.draw(s, 0, 0);
      worst = Math.max(worst, performance.now() - t0);
      await new Promise((r) => setTimeout(r, 0));
    }
    return { worstDraw: worst, worstStage: g.debug.enterableStages().maxMs };
  }, b);
  report.push(`sweep over 600 m at 5 m a frame: slowest draw submission ${sweep.worstDraw.toFixed(1)} ms, slowest single stage change ${sweep.worstStage.toFixed(1)} ms`);
  expect(sweep.worstStage).toBeLessThan(16);

  // Budget: on the ground in front of it, on its roof, inside on the third floor.
  await stand(12);
  const ground = await measure(page);
  report.push(`ground: ${ground.calls} draw calls, ${ground.triangles} triangles, sim ${ground.tick.toFixed(2)} + draw ${ground.draw.toFixed(2)} ms`);
  const pathRoof = await page.evaluate((b) => window.__game!.debug.pathTo((b.roof.wx0 + b.roof.wx1) / 2, b.roof.wy, (b.roof.wz0 + b.roof.wz1) / 2), b);
  expect(await walk(page, pathRoof!)).toBe(true);
  await page.evaluate((b) => {
    const p = window.__game!.state!.player;
    p.yaw = Math.atan2(b.ux, b.uz) + Math.PI;
    p.pitch = -0.08;
  }, b);
  await settle(page);
  await page.screenshot({ path: 'test-results/buildings-office-roof.png' });
  const roof = await measure(page);
  report.push(`roof: ${roof.calls} draw calls, ${roof.triangles} triangles, sim ${roof.tick.toFixed(2)} + draw ${roof.draw.toFixed(2)} ms`);
  const pathIn = await page.evaluate((b) => window.__game!.debug.pathTo((b.hall.wx0 + b.hall.wx1) / 2, b.hall.wy, (b.hall.wz0 + b.hall.wz1) / 2), b);
  expect(await walk(page, pathIn!)).toBe(true);
  await settle(page);
  await page.screenshot({ path: 'test-results/buildings-office-inside.png' });
  const inside = await measure(page);
  report.push(`inside (3rd floor): ${inside.calls} draw calls, ${inside.triangles} triangles, sim ${inside.tick.toFixed(2)} + draw ${inside.draw.toFixed(2)} ms`);
  console.log(report.join('\n'));
  for (const m of [ground, roof, inside]) {
    expect(m.calls).toBeLessThan(150);
    expect(m.triangles).toBeLessThan(500_000);
    expect(m.tick + m.draw).toBeLessThan(4);
  }
  expect(errors).toEqual([]);
});

test('base: the workshop and the headquarters can be entered and the survivors work inside', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0&res=fixed');
  await page.getByTestId('new-game').click();
  await page.getByTestId('intro-skip').click();
  await page.getByTestId('start-0').click();
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
  const r = await page.evaluate(() => {
    const g = window.__game!;
    const s = g.state!;
    g.renderer.setAutoResolution(false);
    s.tactical!.zombies.length = 0;
    s.world.cells.Z[s.player.cell] = 0;
    const hq = s.build.structures.find((q) => q.def === 'hq')!;
    g.debug.build('workshop', hq.tx + 5, hq.ty, 0);
    g.debug.addSurvivors(3, 'crafting');
    g.debug.setClock(10);
    // They are hired at the edge of the camp and walk in (about a minute).
    for (let i = 0; i < 60 * 90; i++) g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
    const list = g.debug.enterables();
    const ws = list.map((e) => g.debug.enterable(e.i)!).find((d) => d.place.def === 'base.workshop')!;
    const room = ws.rooms.find((q) => q.use === 'workshop')!;
    const crafters = s.colony.survivors.filter((v) => v.job === 'crafting');
    const inRoom = crafters.filter((v) => v.pos[0] > room.wx0 && v.pos[0] < room.wx1 && v.pos[1] > room.wz0 && v.pos[1] < room.wz1).length;
    // Into the workshop through its door.
    const door = ws.links.find((l) => l.a === -1)!;
    g.debug.teleport(door.wpts[0]![0], door.wpts[0]![2], 0, 0);
    return { inRoom, crafters: crafters.length, path: g.debug.pathTo((room.wx0 + room.wx1) / 2, room.wy, (room.wz0 + room.wz1) / 2), defs: list.map((e) => e.def) };
  });
  expect(r.defs).toContain('base.hq');
  expect(r.defs).toContain('base.workshop');
  expect(r.inRoom).toBe(r.crafters);
  expect(await walk(page, r.path!)).toBe(true);
  await page.evaluate(() => {
    const p = window.__game!.state!.player;
    p.yaw = Math.PI;
    p.pitch = -0.2;
  });
  await settle(page);
  await page.screenshot({ path: 'test-results/buildings-base-workshop.png' });
  expect(errors).toEqual([]);
});
