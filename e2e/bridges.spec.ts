// L9: the bridge landmarks laid from bank to bank in their real areas (docs/realmap_guide.md §7, L9).
// For each bridge: three pictures (the whole bridge from the side, from the air, on its deck), the
// player walks it from end to end (the game's own simulation, steering along the deck), a zombie
// set chasing at one end comes across to the player on the deck, and the three budgets on the deck
// and from the shore (draw calls, triangles, sim + draw submission). Screenshots:
// test-results/bridge-<name>-*.png. `BRIDGES=rainbow,akashi` limits it to some.

import { expect, test, type Page } from '@playwright/test';

const ONLY = (process.env.BRIDGES ?? '').split(',').filter(Boolean);

/** A point on each bridge's line (its middle) and the lane walked (m off the middle; the Aomori towers stand in it). */
// L10: `name` and the ordinary bridges (several of one building type in an area: the one nearest the point).
const BRIDGES: { id: string; name?: string; lat: number; lon: number; lane: number; side: number; air: number }[] = [
  { id: 'landmark.rainbow_bridge', lat: 35.63633, lon: 139.76407, lane: 5, side: 1, air: 1 },
  { id: 'landmark.aomori_bay_bridge', lat: 40.8302, lon: 140.7385, lane: 5, side: 1, air: 1 },
  { id: 'landmark.akashi_kaikyo_bridge', lat: 34.61752, lon: 135.0219, lane: 4, side: 1, air: 1 },
  { id: 'landmark.kintaikyo', lat: 34.16493, lon: 132.17668, lane: 0, side: 1, air: 1 },
  { id: 'landmark.onaruto_bridge', lat: 34.2386, lon: 134.65029, lane: 4, side: 1, air: 1 },
  { id: 'landmark.kanmon_bridge', lat: 33.96179, lon: 130.95852, lane: 4, side: 1, air: 1 },
  // L10: ordinary bridges over the great rivers (rows of src/data/bridges/ordinary.ts).
  { id: 'landmark.ordinary_bridge_road', name: 'tone', lat: 35.88975, lon: 140.05453, lane: 2, side: 1, air: 1 },
  { id: 'landmark.ordinary_bridge_road', name: 'kiso', lat: 35.10484, lon: 136.71272, lane: 2, side: 1, air: 1 },
  { id: 'landmark.ordinary_bridge_road', name: 'yodo', lat: 34.71385, lon: 135.4871, lane: 3, side: 1, air: 1 },
  { id: 'landmark.ordinary_bridge_rail', name: 'chikugo', lat: 33.32648, lon: 130.4988, lane: 1.9, side: 1, air: 1 },
];

/** A real point in the area of its cell (m from the north-west corner; the strategic grid of src/data/landmarks). */
function areaPoint(lat: number, lon: number): [number, number] {
  const fy = ((45.6 - lat) * 110.95) / 10;
  const fx = ((lon - 127.5) * 90.06) / 10;
  return [(fx - Math.floor(fx)) * 1024, (fy - Math.floor(fy)) * 1024];
}

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

/** The photographer and the walker stay alive (health topped up every 50 ms). */
async function heal(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { healing?: number };
    if (w.healing) return;
    w.healing = window.setInterval(() => {
      const p = window.__game!.state?.player;
      if (p && p.hp > 0 && p.hp < 100) p.hp = 100;
    }, 50);
  });
}

interface Line { pts: [number, number][]; from: number; to: number; deck: number[]; top: number }

/** The bridge's line in the current map (world coordinates), its stretch here, the deck's top every metre. */
async function lineOf(page: Page, id: string, near: [number, number]): Promise<Line | null> {
  return page.evaluate(([def, nx, nz]) => {
    const map = window.__game!.map!;
    // The placement of the type whose line passes nearest the point.
    let p: (typeof map.placements)[number] | undefined;
    let pd = Infinity;
    for (const q of map.placements) {
      if (q.def !== def || !q.span) continue;
      for (const [x, z] of q.span.path) {
        const d = Math.hypot(x + q.x0 - (nx as number), z + q.z0 - (nz as number));
        if (d < pd) {
          pd = d;
          p = q;
        }
      }
    }
    if (!p?.span) return null;
    const pts = p.span.path.map(([x, z]) => [x + p.x0, z + p.z0] as [number, number]);
    // The deck's top: the ground or the bridge's own boxes under each metre of the line's middle.
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
    const deck: number[] = [];
    let y = -1e3;
    for (let s = 0; s <= acc[acc.length - 1]!; s += 1) {
      let i = 0;
      while (i < pts.length - 2 && acc[i + 1]! < s) i++;
      const u = (s - acc[i]!) / Math.max(1e-6, acc[i + 1]! - acc[i]!);
      const x = pts[i]![0] + (pts[i + 1]![0] - pts[i]![0]) * u;
      const z = pts[i]![1] + (pts[i + 1]![1] - pts[i]![1]) * u;
      // Walked from the first end: what one stands on stepping along (not a strut or a gate overhead).
      if (y < -900) y = window.__game!.debug.supportAt(x, z, window.__game!.debug.supportAt(x, z, -1e3) + 0.3);
      y = window.__game!.debug.supportAt(x, z, y + 0.45);
      deck.push(y);
    }
    return { pts, from: p.span.from, to: p.span.to, deck, top: p.height };
  }, [id, near[0], near[1]] as const);
}

function frame(l: Line, s: number): { x: number; z: number; tx: number; tz: number; nx: number; nz: number } {
  let acc = 0;
  for (let i = 0; i + 1 < l.pts.length; i++) {
    const [ax, az] = l.pts[i]!;
    const [bx, bz] = l.pts[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    if (s <= acc + len || i + 2 === l.pts.length) {
      const tx = (bx - ax) / len;
      const tz = (bz - az) / len;
      const u = s - acc;
      return { x: ax + tx * u, z: az + tz * u, tx, tz, nx: tz, nz: -tx };
    }
    acc += len;
  }
  throw new Error('empty line');
}

async function view(page: Page, file: string, x: number, z: number, y: number, tx: number, ty: number, tz: number): Promise<void> {
  const cx = Math.min(1010, Math.max(14, x));
  const cz = Math.min(1010, Math.max(14, z));
  const yaw = Math.atan2(-(tx - cx), -(tz - cz));
  const pitch = Math.atan2(ty - y, Math.hypot(tx - cx, tz - cz));
  await page.evaluate(([px, pz, yw, p]) => {
    window.__game!.debug.teleport(px!, pz!, yw!, p!);
    window.__game!.debug.setClock(10);
  }, [cx, cz, yaw, pitch] as const);
  await settle(page);
  await page.evaluate(([px, pz, yw, p, py]) => {
    const g = window.__game!;
    g.debug.teleport(px!, pz!, yw!, p!, py!);
    g.renderer.draw(g.state!, 0, 0);
  }, [cx, cz, yaw, pitch, y] as const);
  await page.screenshot({ path: `test-results/${file}.png` });
  await page.evaluate(([px, pz]) => window.__game!.debug.teleport(px!, pz!), [cx, cz] as const);
}

test('the bridge landmarks: whole from bank to bank, walked end to end, the dead come across, within the budgets', async ({ page }) => {
  test.setTimeout(3_600_000);
  const errors = trackErrors(page);
  await page.goto('/?seed=12&scenario=0');
  await page.getByTestId('new-game').click();
  await page.getByTestId('intro-skip').click();
  await page.getByTestId('start-0').click();
  await page.waitForFunction(() => window.__game?.map != null, null, { timeout: 60_000 });
  await heal(page);
  const rows: string[] = [];
  for (const b of BRIDGES.filter((q) => ONLY.length === 0 || ONLY.some((o) => (q.name ?? q.id).includes(o)))) {
    const name = b.name ?? b.id.replace('landmark.', '');
    const cell = await page.evaluate(([la, lo]) => window.__game!.debug.gotoLatLon(la!, lo!), [b.lat, b.lon] as const);
    await page.waitForFunction((c) => {
      const info = window.__game!.debug.realInfo();
      return info !== null && info.cell === c && info.real;
    }, cell, { timeout: 60_000 });
    const l = await lineOf(page, b.id, areaPoint(b.lat, b.lon));
    expect(l, `${name}: not in cell ${cell}`).not.toBeNull();
    const line = l!;
    const L = line.deck.length - 1;
    const mid = frame(line, (line.from + line.to) / 2);
    const span = line.to - line.from;

    // (1) Pictures: the side (the whole stretch in view), the air, the deck.
    const d = Math.max(60, span * 0.85);
    const h = Math.max(...line.deck.slice(Math.floor(line.from), Math.ceil(line.to)));
    await view(page, `bridge-${name}-side`, mid.x + mid.nx * d * b.side, mid.z + mid.nz * d * b.side, h * 0.6 + 3, mid.x, h * 0.7, mid.z);
    await view(page, `bridge-${name}-air`, mid.x + mid.nx * d * 0.6 * b.air - mid.tx * d * 0.3, mid.z + mid.nz * d * 0.6 * b.air - mid.tz * d * 0.3, d * 0.7, mid.x, 0, mid.z);
    const on = frame(line, line.from + Math.min(span * 0.3, 40));
    const ahead = frame(line, Math.min(L, line.from + Math.min(span * 0.3, 40) + 40));
    const yDeck = line.deck[Math.round(line.from + Math.min(span * 0.3, 40))]!;
    await view(page, `bridge-${name}-deck`, on.x + on.nx * b.lane, on.z + on.nz * b.lane, yDeck + 1.7, ahead.x + ahead.nx * b.lane, yDeck + 2.5, ahead.z + ahead.nz * b.lane);

    // (2) Walk the stretch of this area both ways (the game's simulation, the player steered along the lane).
    for (const [s0, s1] of [[line.from, line.to], [line.to, line.from]] as const) {
      const a = Math.min(L - 1, Math.max(1, s0 === 0 || s0 === L ? s0 : s0 + Math.sign(s1 - s0) * 3));
      const z1 = s1 === 0 || s1 === L ? s1 : s1 - Math.sign(s1 - s0) * 3;
      const start = frame(line, a);
      const dir = Math.sign(z1 - a);
      const sx = start.x + start.nx * b.lane - start.tx * dir * (a === 0 || a === L ? 4 : 0);
      const sz = start.z + start.nz * b.lane - start.tz * dir * (a === 0 || a === L ? 4 : 0);
      const atEnd = a === 0 || a === L;
      await page.evaluate(([x, z, y]) => (y! < 0 ? window.__game!.debug.teleport(x!, z!) : window.__game!.debug.teleport(x!, z!, 0, 0, y!)), [sx, sz, atEnd ? -1 : line.deck[Math.round(a)]!] as const);
      const res = await page.evaluate(([pts, lane, target, dir, deck]) => {
        const g = window.__game!;
        const s = g.state!;
        const P = pts as [number, number][];
        const acc = [0];
        for (let i = 1; i < P.length; i++) acc.push(acc[i - 1]! + Math.hypot(P[i]![0] - P[i - 1]![0], P[i]![1] - P[i - 1]![1]));
        const project = (x: number, z: number): number => {
          let best = 0;
          let bd = Infinity;
          for (let i = 0; i + 1 < P.length; i++) {
            const [ax, az] = P[i]!;
            const [bx, bz] = P[i + 1]!;
            const len = acc[i + 1]! - acc[i]!;
            const u = Math.min(len, Math.max(0, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / len));
            const d = Math.hypot(x - (ax + ((bx - ax) * u) / len), z - (az + ((bz - az) * u) / len));
            if (d < bd) {
              bd = d;
              best = acc[i]! + u;
            }
          }
          return best;
        };
        const at = (q: number): [number, number, number, number] => {
          let i = 0;
          while (i < P.length - 2 && acc[i + 1]! < q) i++;
          const len = acc[i + 1]! - acc[i]!;
          const tx = (P[i + 1]![0] - P[i]![0]) / len;
          const tz = (P[i + 1]![1] - P[i]![1]) / len;
          return [P[i]![0] + tx * (q - acc[i]!), P[i]![1] + tz * (q - acc[i]!), tx, tz];
        };
        let q = project(s.player.pos[0], s.player.pos[2]);
        let under = 0;
        let steps = 0;
        for (; steps < 60 * 900 && Math.abs(q - (target as number)) > 2; steps++) {
          const [x, z, tx, tz] = at(Math.max(0, Math.min(acc[acc.length - 1]!, q + (dir as number) * 6)));
          const gx = x + tz * (lane as number);
          const gz = z - tx * (lane as number);
          s.player.yaw = Math.atan2(-(gx - s.player.pos[0]), -(gz - s.player.pos[2]));
          g.sim.tick(s, 1 / 60, { ...g.debug.noInput, moveZ: 1 });
          s.player.hp = 100;
          q = project(s.player.pos[0], s.player.pos[2]);
          const top = (deck as number[])[Math.round(q)] ?? 0;
          if (q > 1 && q < acc[acc.length - 1]! - 1 && s.player.pos[1] < top - 1.5) under++;
        }
        return { reached: q, under, seconds: steps / 60, hp: s.player.hp, pos: s.player.pos.slice(), dead: s.player.hp <= 0 };
      }, [line.pts, b.lane, z1, dir, line.deck] as const);
      if (Math.abs(res.reached - z1) >= 2.5) console.log(name, JSON.stringify(res));
      rows.push(`${name} cell ${cell}: walked ${a.toFixed(0)} → ${res.reached.toFixed(0)} (of ${z1.toFixed(0)}) in ${res.seconds.toFixed(0)} s, under the deck ${res.under} steps`);
      expect(Math.abs(res.reached - z1), `${name}: the walk stopped at ${res.reached.toFixed(1)}`).toBeLessThan(2.5);
      expect(res.under, `${name}: fell off the deck`).toBe(0);
    }

    // (3) A zombie chasing from the start of this stretch comes across to the player 50–70 m on along the deck.
    const reach = Math.min(70, span - 6);
    const zs = line.from === 0 ? 0 : line.from + 2;
    const zp = frame(line, zs);
    const pp = frame(line, zs + reach);
    const yp = line.deck[Math.round(zs + reach)]!;
    await page.evaluate(([x, z, y]) => window.__game!.debug.teleport(x!, z!, 0, 0, y!), [pp.x + pp.nx * b.lane, pp.z + pp.nz * b.lane, yp] as const);
    const chase = await page.evaluate(([zx, zz]) => {
      const g = window.__game!;
      const s = g.state!;
      const id = g.debug.placeZombie(zx as number, zz as number, 'walker', true);
      let best = Infinity;
      let t = 0;
      for (; t < 60 * 150 && best > 3; t++) {
        g.sim.tick(s, 1 / 60, { ...g.debug.noInput });
        s.player.hp = 100;
        const zb = s.tactical!.zombies.find((q) => q.id === id);
        if (!zb || zb.state === 'down') break;
        // It keeps after the player (losing sight of them is not what is tested here: the way across is).
        if (zb.state !== 'attack') {
          zb.state = 'chase';
          zb.lost = 0;
          zb.target = 'player';
          zb.goal = [s.player.pos[0], s.player.pos[2]];
        }
        best = Math.min(best, Math.hypot(zb.pos[0] - s.player.pos[0], zb.pos[2] - s.player.pos[2]));
        if (t % 300 === 0) (window as unknown as { trail?: string[] }).trail = [...((window as unknown as { trail?: string[] }).trail ?? []), `${t / 60}s ${zb.pos.map((v) => v.toFixed(1)).join(',')} ${zb.state} path=${JSON.stringify((zb as unknown as { path?: unknown }).path ?? null).slice(0, 80)}`];
      }
      const zb = s.tactical!.zombies.find((q) => q.id === id);
      return { trail: (window as unknown as { trail?: string[] }).trail, best, seconds: t / 60, zombie: zb ? { pos: zb.pos.map((v) => Math.round(v * 10) / 10), state: zb.state } : null, player: s.player.pos.map((v) => Math.round(v * 10) / 10) };
    }, [zp.x - zp.tx * (zs === 0 ? 4 : 0), zp.z - zp.tz * (zs === 0 ? 4 : 0)] as const);
    if (chase.best >= 4) console.log(name, 'chase', JSON.stringify(chase), 'start', zp.x, zp.z);
    rows.push(`${name}: the zombie came within ${chase.best.toFixed(1)} m in ${chase.seconds.toFixed(0)} s over ${reach.toFixed(0)} m of the deck`);
    expect(chase.best, `${name}: the zombie did not come across`).toBeLessThan(4);

    // (4) The budgets: on the deck in the middle looking along it, and from the shore.
    const mm = frame(line, (line.from + line.to) / 2);
    const ym = line.deck[Math.round((line.from + line.to) / 2)]!;
    const fwd = frame(line, Math.min(L, (line.from + line.to) / 2 + 30));
    for (const [where, x, z, y, tx, tz] of [
      ['deck', mm.x + mm.nx * b.lane, mm.z + mm.nz * b.lane, ym + 1.7, fwd.x, fwd.z],
      ['shore', mid.x + mid.nx * d, mid.z + mid.nz * d, undefined, mid.x, mid.z],
    ] as const) {
      const cx = Math.min(1010, Math.max(14, x));
      const cz = Math.min(1010, Math.max(14, z));
      await page.evaluate(([px, pz, yw]) => window.__game!.debug.teleport(px!, pz!, yw!, -0.05), [cx, cz, Math.atan2(-(tx - cx), -(tz - cz))] as const);
      if (y !== undefined) await page.evaluate(([px, pz, yw, py]) => window.__game!.debug.teleport(px!, pz!, yw!, -0.05, py!), [cx, cz, Math.atan2(-(tx - cx), -(tz - cz)), y - 1.7] as const);
      await settle(page);
      const m = await measure(page);
      rows.push(`${name} ${where}: ${m.calls} calls, ${(m.triangles / 1e4).toFixed(1)}万 tris, sim ${m.tick.toFixed(2)} + draw ${m.draw.toFixed(2)} ms`);
      await page.screenshot({ path: `test-results/bridge-${name}-budget-${where}.png` });
      expect(m.calls, `${name} ${where}`).toBeLessThan(150);
      expect(m.triangles, `${name} ${where}`).toBeLessThan(500_000);
      expect(m.tick + m.draw, `${name} ${where}`).toBeLessThan(4);
    }
  }
  console.log(`[bridges]\n${rows.join('\n')}`);
  expect(errors).toEqual([]);
});
