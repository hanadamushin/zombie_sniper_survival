// L1: the landmarks (名所). (1) The landmark yard (`?landmarks=1`): every landmark of every region on
// flat ground — each one from the street 200 m off and from the air, the three budgets over the whole
// yard (draw calls, triangles, sim + draw submission), climbing the tower ladders to their decks.
// (2) The real areas: the landmarks at their real (shrunk) place, the cell with the most of them
// measured, the strategic map's landmark marks. Screenshots: test-results/landmark-*.png.
// `LANDMARKS=id,id` limits both to some landmarks (the L2–L8 sessions: their own).

import { expect, test, type Page } from '@playwright/test';

const ONLY = (process.env.LANDMARKS ?? '').split(',').filter(Boolean);
const wanted = (id: string): boolean => ONLY.length === 0 || ONLY.some((o) => id.includes(o));

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
  await page.waitForFunction(() => window.__game!.debug.renderInfo().pending === 0 && window.__game!.debug.enterableStages().pending === 0, null, { timeout: 90_000 });
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

/** Stand at (x, z) on the ground, let everything around be built, then (optionally) rise to y and look. */
async function shoot(page: Page, file: string, x: number, z: number, yaw: number, pitch: number, y?: number): Promise<void> {
  await page.evaluate(([px, pz, yw, p]) => {
    const g = window.__game!;
    g.debug.teleport(px!, pz!, yw!, p!);
    g.debug.setClock(10);
  }, [x, z, yaw, pitch] as const);
  await heal(page);
  await settle(page);
  await heal(page);
  if (y !== undefined) {
    // From the air: put the eye up there and take the picture before the fall is noticeable.
    await page.evaluate(([px, pz, yw, p, py]) => {
      const g = window.__game!;
      g.debug.teleport(px!, pz!, yw!, p!, py!);
      g.renderer.draw(g.state!, 0, 0);
    }, [x, z, yaw, pitch, y] as const);
  }
  await page.screenshot({ path: `test-results/${file}.png` });
  // Back on the ground before the fall ends (it would kill).
  if (y !== undefined) await page.evaluate(([px, pz]) => window.__game!.debug.teleport(px!, pz!), [x, z] as const);
}

/** The real areas have zombies: the photographer stays alive (health topped up every 50 ms from now on). */
async function heal(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { hp0?: number; healing?: number };
    if (w.healing) return;
    w.hp0 = window.__game!.state!.player.hp;
    w.healing = window.setInterval(() => {
      const p = window.__game!.state?.player;
      if (p && p.hp > 0 && p.hp < w.hp0!) p.hp = w.hp0!;
    }, 50);
  });
}

interface Lm { def: string; x0: number; z0: number; x1: number; z1: number; base: number; top: number; vantage: [number, number, number] | null }

async function landmarksOf(page: Page): Promise<Lm[]> {
  return page.evaluate(() => {
    const map = window.__game!.map!;
    return map.placements.filter((p) => p.def.startsWith('landmark.')).map((p) => {
      const v = map.vantages.find((q) => q.pos[0] >= p.x0 && q.pos[0] <= p.x1 && q.pos[2] >= p.z0 && q.pos[2] <= p.z1);
      return { def: p.def, x0: p.x0, z0: p.z0, x1: p.x1, z1: p.z1, base: p.base, top: p.height, vantage: v ? v.pos : null };
    });
  });
}

/** From the street `dist` m in front (south) and from the air south-east of it. */
async function portraits(page: Page, prefix: string, l: Lm, dist = 200): Promise<void> {
  const cx = (l.x0 + l.x1) / 2;
  const cz = (l.z0 + l.z1) / 2;
  const name = l.def.replace('landmark.', '');
  const pitch = Math.atan2(Math.max(4, l.top * 0.55) - 1.6, dist);
  await shoot(page, `${prefix}-${name}-street`, cx, l.z1 + dist, 0, Math.min(0.6, pitch));
  // The air: as far again up as the landmark is tall, looking down at it.
  const r = Math.max(70, Math.max(l.x1 - l.x0, l.z1 - l.z0) * 1.1, l.top * 1.1);
  const h = l.base + Math.max(60, l.top * 1.2);
  const ax = cx + r * 0.7;
  const az = cz + r * 0.7;
  const yaw = Math.atan2(-(cx - ax), -(cz - az));
  const down = -Math.atan2(h - (l.base + l.top * 0.4), Math.hypot(ax - cx, az - cz));
  await shoot(page, `${prefix}-${name}-air`, ax, az, yaw, down, h);
}

test('landmark yard: every landmark from the street and from the air, the budgets, the tower decks', async ({ page }) => {
  test.setTimeout(1_200_000);
  const errors = trackErrors(page);
  await page.goto('/?landmarks=1');
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
  await settle(page);
  const all = await landmarksOf(page);
  expect(all.length).toBeGreaterThan(0);
  // The budgets: over the whole yard from its north-west corner (every landmark's outside drawn), and from the middle.
  const rows: string[] = [];
  for (const [label, x, z, yaw] of [['corner', 22, 22, -Math.PI * 0.75], ['middle', 512, 300, Math.PI]] as const) {
    await page.evaluate(([px, pz, yw]) => window.__game!.debug.teleport(px!, pz!, yw!, -0.05), [x, z, yaw] as const);
    await settle(page);
    const m = await measure(page);
    const st = await page.evaluate(() => window.__game!.debug.enterableStages());
    rows.push(`${label}: ${m.calls} calls, ${(m.triangles / 1e4).toFixed(1)}万 tris, sim ${m.tick.toFixed(2)} + draw ${m.draw.toFixed(2)} ms, stages far ${st.far} / out ${st.mid} / in ${st.near}`);
    expect(m.calls).toBeLessThan(150);
    expect(m.triangles).toBeLessThan(500_000);
    expect(m.tick + m.draw).toBeLessThan(4);
  }
  console.log(`[landmark yard]\n${rows.join('\n')}`);
  for (const l of all.filter((q) => wanted(q.def))) await portraits(page, 'landmark-yard', l);

  // The tower decks: climb the ladder from its foot (look up, walk into it) and stand on the deck.
  for (const l of all.filter((q) => q.vantage && wanted(q.def))) {
    const ladder = await page.evaluate((def) => {
      const map = window.__game!.map!;
      const i = map.placements.findIndex((p) => p.def === def);
      const det = window.__game!.debug.enterable(i)!;
      const lad = det.ladders[0]!;
      return { x: (lad.x0 + lad.x1) / 2, z: (lad.z0 + lad.z1) / 2, nx: lad.nx, nz: lad.nz, y1: lad.y1 };
    }, l.def);
    // Stand 0.8 m out from the ladder, facing it, and climb (forward with the view up).
    await page.evaluate((q) => {
      const g = window.__game!;
      g.debug.teleport(q.x - q.nx * 0.5, q.z - q.nz * 0.5, Math.atan2(-q.nx, -q.nz), 0.6);
      g.debug.setInput({ moveZ: 1 });
    }, ladder);
    await page.waitForFunction((y1) => window.__game!.state!.player.pos[1] > y1 - 0.1, ladder.y1, { timeout: 240_000 });
    await page.waitForTimeout(1500); // step off onto the deck
    await page.evaluate(() => window.__game!.debug.setInput(null));
    const feet = await page.evaluate(() => window.__game!.state!.player.pos[1]);
    // At the deck (L2: not every deck is a tower's — Yamadera's stage is 22 m up).
    expect(feet, l.def).toBeGreaterThan(l.vantage![1] - 0.5);
    await page.evaluate(() => {
      const g = window.__game!;
      g.state!.player.pitch = -0.3;
    });
    await settle(page, 600);
    await page.screenshot({ path: `test-results/landmark-yard-${l.def.replace('landmark.', '')}-deck.png` });
  }
  expect(errors).toEqual([]);
});

async function startNewGame(page: Page): Promise<void> {
  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.getByTestId('intro-skip').click();
  await expect(page.getByTestId('candidate-2')).toBeVisible();
  await page.getByTestId('start-0').click();
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
}

/** Real places to visit: a point in each cell that holds landmarks (L2–L8 add theirs). */
const CELLS: { name: string; lat: number; lon: number }[] = [
  { name: 'sapporo', lat: 43.0611, lon: 141.3564 },
  { name: 'hakodate', lat: 41.7942, lon: 140.7538 },
  { name: 'otaru', lat: 43.199, lon: 141.001 },
  // L2 tohoku
  { name: 'hirosaki', lat: 40.6075, lon: 140.4645 },
  { name: 'aomori', lat: 40.8302, lon: 140.7385 },
  { name: 'hiraizumi', lat: 39.0003, lon: 141.1012 },
  { name: 'sendai', lat: 38.2532, lon: 140.8563 },
  { name: 'kakunodate', lat: 39.597, lon: 140.5625 },
  { name: 'yamadera', lat: 38.3127, lon: 140.438 },
  { name: 'aizu', lat: 37.4877, lon: 139.9298 },
];

test('real map: the landmarks at their place, the busiest cell within the budgets, the marks on the strategic map', async ({ page }) => {
  test.setTimeout(1_500_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0');
  await startNewGame(page);
  await heal(page);
  const rows: string[] = [];
  for (const c of CELLS) {
    const cell = await page.evaluate(([la, lo]) => window.__game!.debug.gotoLatLon(la!, lo!), [c.lat, c.lon]);
    await page.waitForFunction((id) => {
      const info = window.__game!.debug.realInfo();
      return info !== null && info.cell === id && info.real;
    }, cell, { timeout: 60_000 });
    const list = (await landmarksOf(page)).filter((l) => wanted(l.def));
    if (list.length === 0) continue;
    for (const l of list) await portraits(page, `landmark-${c.name}`, l, 180);
    // The budgets in the cell: from the highest landmark deck looking over the others (or from the
    // street 220 m south of them), where the most of them are drawn at once.
    const mx = list.reduce((s, l) => s + (l.x0 + l.x1) / 2, 0) / list.length;
    const mz = list.reduce((s, l) => s + (l.z0 + l.z1) / 2, 0) / list.length;
    const deck = list.filter((l) => l.vantage).sort((a, b) => b.vantage![1] - a.vantage![1])[0];
    if (deck) {
      const [vx, vy, vz] = deck.vantage!;
      await page.evaluate(([x, y, z, tx, tz]) => window.__game!.debug.teleport(x!, z!, Math.atan2(-(tx! - x!), -(tz! - z!)), -0.35, y! + 0.05), [vx, vy, vz, mx, mz] as const);
    } else await page.evaluate(([x, z]) => window.__game!.debug.teleport(x!, z! + 220, 0, 0.05), [mx, mz] as const);
    await heal(page);
    await settle(page);
    await heal(page);
    const m = await measure(page);
    rows.push(`${c.name} cell ${cell} (${list.length} landmarks): ${m.calls} calls, ${(m.triangles / 1e4).toFixed(1)}万 tris, sim ${m.tick.toFixed(2)} + draw ${m.draw.toFixed(2)} ms`);
    await page.screenshot({ path: `test-results/landmark-${c.name}-budget.png` });
    expect(m.calls, c.name).toBeLessThan(150);
    expect(m.triangles, c.name).toBeLessThan(500_000);
    expect(m.tick + m.draw, c.name).toBeLessThan(4);
  }
  console.log(`[landmarks in the real areas]\n${rows.join('\n')}`);
  await page.evaluate(() => window.__game!.dispatch({ type: 'setMode', mode: 'world' }));
  await expect(page.getByTestId('map-landmark-legend')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/landmark-strategic.png' });
  expect(errors).toEqual([]);
});
