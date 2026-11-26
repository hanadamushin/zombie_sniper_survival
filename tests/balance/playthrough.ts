// `npm run balance:play` — the first half hour of real time played by an autopilot on the REAL
// simulation: every system, the generated map of the start cell, zombies that see and chase, real
// ballistics, sway and recoil, walking at walking speed to cut the ears off. (The 150-day bots in
// bot.ts replace all of that by a statistical model; this is where its numbers are checked.)
//
//   node tests/balance/playthrough.ts [seed=12] [start=0] [hours=30] [hand=average]
//
// The autopilot does what a player does, through the same InputFrame: crouch, scope, hold the
// breath, put the reticle on a head (with a human's aiming error on top of the rifle's sway), fire,
// work the bolt; walk to the body and hold E; back away from what comes too close; go home at dusk
// and shoot what the night brings. It reports what the hour is made of (aiming, walking, waiting),
// hit rates by distance, rounds per kill, ears per game hour and the damage taken.

import { fileURLToPath } from 'node:url';
import { gauss, stream } from '../../src/core/rng.ts';
import type { GameEvent } from '../../src/core/events.ts';
import { createInitialState, emptyInputFrame, type Corpse, type GameState, type InputFrame, type Zombie } from '../../src/core/types.ts';
import { BALANCE } from '../../src/data/balance.ts';
import { TACTICAL } from '../../src/data/tactical.ts';
import { ZOMBIES } from '../../src/data/zombies.ts';
import { createSim } from '../../src/sim/index.ts';
import { areaOf } from '../../src/sim/tactical/area.ts';
import { dropAt, zeroAngle } from '../../src/sim/tactical/ballistics.ts';
import { sightBlocked } from '../../src/sim/tactical/collision.ts';
import { weaponOf } from '../../src/sim/tactical/weapon.ts';
import { initWorld } from '../../src/sim/world/scenario.ts';
import { beginAt, findStartCandidates } from '../../src/sim/world/start.ts';
import { loadGrid, loadScenario } from './harness.ts';

/** How the hand behind the rifle behaves. */
export interface Hand {
  /** Seconds on the reticle before the trigger, the aiming error (mil, 1 sigma), the farthest shot taken (m). */
  aimSeconds: number;
  errorMil: number;
  maxRange: number;
  /** Aims for the head up to this distance, for the chest beyond. */
  headRange: number;
}
export const HANDS: Record<string, Hand> = {
  careful: { aimSeconds: 3.5, errorMil: 0.35, maxRange: 220, headRange: 160 },
  average: { aimSeconds: 2.5, errorMil: 0.7, maxRange: 250, headRange: 120 },
  sloppy: { aimSeconds: 1.2, errorMil: 1.6, maxRange: 300, headRange: 60 },
};

export interface PlayReport {
  seed: number;
  start: number;
  land: string;
  cellZ: number;
  hours: number;
  hand: string;
  shots: number;
  hits: number;
  kills: number;
  headshots: number;
  ears: number;
  /** [upper bound of the distance bin (m), shots, hits]. */
  byRange: [number, number, number][];
  /** Seconds of game time by what the player was doing. */
  seconds: { aim: number; walkEars: number; walkFind: number; wait: number; home: number; close: number };
  walked: number;
  earTrips: number;
  earTripMetres: number;
  damage: number;
  died: number | null;
  ammoLeft: number;
  nightKills: number;
  firstKillMinute: number | null;
  ms: number;
}

const DT = BALANCE.time.fixedStep;

export function playthrough(seed: number, start: number, hours: number, handId: string): PlayReport {
  const t0 = performance.now();
  const hand = HANDS[handId]!;
  const grid = loadGrid();
  const state: GameState = createInitialState(seed, 1);
  initWorld(state, grid, loadScenario(seed % BALANCE.infection.scenarioSeeds.length));
  const candidates = findStartCandidates(state.world.cells, grid, stream(state, 'world.start'));
  const cell = candidates[Math.min(start, candidates.length - 1)]!.cell;
  const cellZ = Math.round(state.world.cells.Z[cell]!);
  beginAt(state, grid, cell);
  const sim = createSim({ grid, warn: () => {} });
  const rng = stream(state, 'autopilot');
  const report: PlayReport = {
    seed, start, land: grid.cells[cell]!.land, cellZ, hours, hand: handId, shots: 0, hits: 0, kills: 0, headshots: 0, ears: 0,
    byRange: [[50, 0, 0], [100, 0, 0], [150, 0, 0], [200, 0, 0], [300, 0, 0]],
    seconds: { aim: 0, walkEars: 0, walkFind: 0, wait: 0, home: 0, close: 0 }, walked: 0, earTrips: 0, earTripMetres: 0, damage: 0, died: null,
    ammoLeft: 0, nightKills: 0, firstKillMinute: null, ms: 0,
  };
  const startAbs = state.time.day * 1440 + state.time.minute;
  const minuteNow = (): number => state.time.day * 1440 + state.time.minute - startAbs;
  sim.events.onAny((e: GameEvent) => {
    if (e.type === 'zombieKilled' && e.by === 'player') {
      report.kills++;
      if (e.headshot) report.headshots++;
      report.firstKillMinute ??= minuteNow();
      const h = state.time.minute / 60;
      if (h >= 19 || h < 5) report.nightKills++;
    } else if (e.type === 'earsCollected') report.ears += e.amount;
    else if (e.type === 'playerDied') report.died ??= minuteNow();
  });
  sim.tick(state, DT, emptyInputFrame());

  // --- the autopilot ---
  let aimT = 0;
  let targetId = -1;
  let offset: [number, number] = [0, 0];
  let pending: { id: number; hp: number; dist: number; t: number } | null = null;
  let corpseId = -1;
  let corpseT = 0;
  let tripFrom: [number, number] | null = null;
  const skip = new Set<number>();
  let noTargetT = 0;
  let stuckT = 0;
  let stuckAt: [number, number] = [0, 0];
  let detours = 0;
  let detourT = 0;
  let detourSide = 1;
  let lastHp = state.player.hp;
  let lastPos: [number, number] = [state.player.pos[0], state.player.pos[2]];

  const eyeOf = (): [number, number, number] => [state.player.pos[0], state.player.pos[1] + state.player.eye, state.player.pos[2]];
  const distTo = (x: number, z: number): number => Math.hypot(x - state.player.pos[0], z - state.player.pos[2]);
  const headOf = (z: Zombie): [number, number, number] => {
    const def = ZOMBIES[z.kind];
    const prone = def.prone || z.crippled;
    return [z.pos[0], z.pos[1] + (prone ? 0.25 : def.height - def.headR), z.pos[2]];
  };
  const chestOf = (z: Zombie): [number, number, number] => {
    const def = ZOMBIES[z.kind];
    return [z.pos[0], z.pos[1] + (def.prone || z.crippled ? 0.2 : def.height * 0.68), z.pos[2]];
  };
  const face = (x: number, z: number): void => {
    state.player.yaw = Math.atan2(-(x - state.player.pos[0]), -(z - state.player.pos[2]));
  };
  const settle = (dist: number): void => {
    if (!pending) return;
    const z = state.tactical!.zombies.find((x) => x.id === pending!.id);
    const hit = !z || z.state === 'down' || z.hp < pending.hp;
    if (hit) report.hits++;
    const bin = report.byRange.find((b) => pending!.dist <= b[0]) ?? report.byRange[report.byRange.length - 1]!;
    bin[1]++;
    if (hit) bin[2]++;
    pending = null;
    void dist;
  };

  const frame = (): InputFrame => {
    const input = emptyInputFrame();
    const t = state.tactical;
    const area = areaOf(state);
    const p = state.player;
    if (!t || !area || p.aim.deadT > 0) return input;
    const map = area.map;
    const hour = state.time.minute / 60;
    const night = hour >= 19 || hour < 5;
    const eye = eyeOf();
    if (pending && (pending.t -= DT) <= 0) settle(pending.dist);

    // Who is out there.
    let near: Zombie | null = null;
    let nearD = Infinity;
    let best: Zombie | null = null;
    let bestD = Infinity;
    let any: Zombie | null = null;
    let anyD = Infinity;
    for (const z of t.zombies) {
      if (z.state === 'down' || z.dummy) continue;
      const d = distTo(z.pos[0], z.pos[2]);
      if (d < nearD) {
        nearD = d;
        near = z;
      }
      if (d < anyD) {
        anyD = d;
        any = z;
      }
      if (d <= hand.maxRange && d < bestD && !sightBlocked(map, eye, chestOf(z))) {
        bestD = d;
        best = z;
      }
    }

    // Rounds: reload an empty rifle, fetch more at home.
    const ammo = p.inv.ammo ?? 0;
    if (p.weapon.mag === 0 && ammo > 0 && p.weapon.reloadT <= 0) input.reload = true;
    const home = map.spawn.home;
    const atBase = state.player.cell === state.world.homeCell && distTo(home[0], home[1]) < 40;
    if (atBase && ammo < 20 && state.colony.stock.ammo >= 1) sim.dispatch({ type: 'resupply' });

    const shootAt = (z: Zombie, d: number, close: boolean): void => {
      if (z.id !== targetId) {
        targetId = z.id;
        aimT = 0;
        offset = [gauss(rng, 0, hand.errorMil / 1000), gauss(rng, 0, hand.errorMil / 1000)];
      }
      input.stance = close ? 'stand' : 'crouch';
      input.scope = true;
      input.holdBreath = !close;
      const at = !close && d <= hand.headRange ? headOf(z) : chestOf(z);
      const w = weaponOf(state);
      const dx = at[0] - p.pos[0];
      const dz = at[2] - p.pos[2];
      const flat = Math.hypot(dx, dz);
      const zero = w.zeroes[p.weapon.zeroIdx]!;
      p.yaw = Math.atan2(-dx, -dz) + offset[0];
      p.pitch = Math.atan2(at[1] - (p.pos[1] + p.eye), flat) + dropAt(w, flat) / Math.max(1, flat) - zeroAngle(w, zero) + offset[1];
      aimT += DT;
      const ready = p.weapon.boltT <= 0 && p.weapon.reloadT <= 0 && p.weapon.mag > 0 && p.aim.scopeT >= 0.99;
      if (ready && aimT >= (close ? 0.5 : hand.aimSeconds)) {
        input.fire = true;
        if (pending) settle(pending.dist);
        pending = { id: z.id, hp: z.hp, dist: d, t: 1.2 };
        report.shots++;
        aimT = 0;
        offset = [gauss(rng, 0, hand.errorMil / 1000), gauss(rng, 0, hand.errorMil / 1000)];
      }
    };
    const walkTo = (x: number, z: number, run: boolean): void => {
      face(x, z);
      p.pitch = 0;
      input.stance = 'stand';
      input.sprint = run && p.stamina > 30;
      // Held up by a hedge, a wall, a ditch: step sideways for a while (longer each time), then try again.
      stuckT += DT;
      if (stuckT >= 2) {
        if (Math.hypot(p.pos[0] - stuckAt[0], p.pos[2] - stuckAt[1]) < 1.2) {
          detours++;
          detourT = Math.min(12, 2 + detours * 1.5);
          detourSide = detours % 2 === 0 ? 1 : -1;
        } else if (detourT <= 0) detours = Math.max(0, detours - 1);
        stuckT = 0;
        stuckAt = [p.pos[0], p.pos[2]];
      }
      if (detourT > 0) {
        detourT -= DT;
        input.moveX = detourSide;
        input.moveZ = 0.15;
      } else input.moveZ = 1;
    };

    // 1. Something within arm's reach of the rifle: deal with it first.
    if (near && nearD < 14) {
      report.seconds.close += DT;
      if (nearD < BALANCE.combat.knife.range && (p.weapon.mag === 0 || ammo + p.weapon.mag === 0)) {
        face(near.pos[0], near.pos[2]);
        input.knife = true;
      } else if (p.weapon.mag > 0) shootAt(near, nearD, true);
      else {
        // Empty: back off the way it came.
        face(2 * p.pos[0] - near.pos[0], 2 * p.pos[2] - near.pos[2]);
        input.moveZ = 1;
        input.sprint = true;
      }
      return input;
    }
    // 2. Night: home, and whatever shows up there.
    if (night) {
      report.seconds.home += DT;
      if (best && bestD < 120 && p.weapon.mag + ammo > 0) shootAt(best, bestD, false);
      else if (!atBase || distTo(home[0], home[1]) > 12) walkTo(home[0], home[1], false);
      return input;
    }
    // 3. Ears lying about and nobody close by: fetch them (the nearest body first).
    let body: Corpse | null = null;
    let bodyD = Infinity;
    if (nearD > 45) {
      for (const c of t.corpses) {
        if (c.ears <= 0 || skip.has(c.id)) continue;
        const d = distTo(c.pos[0], c.pos[2]);
        if (d < bodyD) {
          bodyD = d;
          body = c;
        }
      }
    }
    // Shoot first while there is something in sight and rounds to do it with; walk when a few bodies have piled up.
    const bodies = t.corpses.reduce((n, c) => n + (c.ears > 0 && !skip.has(c.id) ? 1 : 0), 0);
    const canShoot = best !== null && p.weapon.mag + ammo > 0;
    if (body && (!canShoot || bodies >= 3 || corpseId >= 0)) {
      if (corpseId !== body.id) {
        if (corpseId < 0) {
          report.earTrips++;
          tripFrom = [p.pos[0], p.pos[2]];
        }
        corpseId = body.id;
        corpseT = 0;
      }
      corpseT += DT;
      report.seconds.walkEars += DT;
      if (corpseT > 300) skip.add(body.id); // cannot get there (a fence, water): leave it
      if (bodyD > BALANCE.combat.ears.range * 0.7) walkTo(body.pos[0], body.pos[2], bodyD > 60);
      else {
        face(body.pos[0], body.pos[2]);
        input.interactHeld = true;
      }
      return input;
    }
    if (corpseId >= 0) {
      corpseId = -1;
      if (tripFrom) report.earTripMetres += Math.hypot(p.pos[0] - tripFrom[0], p.pos[2] - tripFrom[1]);
      tripFrom = null;
    }
    // 4. A target in sight: shoot.
    if (canShoot) {
      noTargetT = 0;
      report.seconds.aim += DT;
      shootAt(best!, bestD, false);
      return input;
    }
    // 5. Nothing in sight: wait a little, then walk toward the nearest one.
    noTargetT += DT;
    if (any && noTargetT > 15 && p.weapon.mag + ammo > 0) {
      report.seconds.walkFind += DT;
      walkTo(any.pos[0], any.pos[2], false);
    } else report.seconds.wait += DT;
    return input;
  };

  const steps = Math.round((hours * 60) / DT);
  for (let i = 0; i < steps; i++) {
    if (state.flags.defeat) break;
    sim.tick(state, DT, frame());
    const p = state.player;
    if (p.hp < lastHp) report.damage += lastHp - p.hp;
    lastHp = p.hp;
    const step = Math.hypot(p.pos[0] - lastPos[0], p.pos[2] - lastPos[1]);
    if (step < 5) report.walked += step;
    lastPos = [p.pos[0], p.pos[2]];
  }
  if (pending) settle(0);
  report.ammoLeft = (state.player.inv.ammo ?? 0) + state.player.weapon.mag;
  report.walked = Math.round(report.walked);
  report.damage = Math.round(report.damage);
  report.earTripMetres = Math.round(report.earTripMetres);
  for (const k of Object.keys(report.seconds) as (keyof PlayReport['seconds'])[]) report.seconds[k] = Math.round(report.seconds[k]);
  report.ms = Math.round(performance.now() - t0);
  void TACTICAL;
  return report;
}

export function describeReport(r: PlayReport): string {
  const total = Object.values(r.seconds).reduce((a, b) => a + b, 0) || 1;
  const pct = (v: number): string => `${Math.round((v / total) * 100)}%`;
  const rate = (hits: number, shots: number): string => (shots > 0 ? `${Math.round((hits / shots) * 100)}%（${shots} 発）` : '—');
  return [
    `seed ${r.seed} / 候補 ${r.start}（${r.land}、Z ${r.cellZ}）/ ${r.hours} ゲーム時間 / 腕前 ${r.hand}`,
    `  発砲 ${r.shots}・命中 ${r.hits}（${rate(r.hits, r.shots)}）・撃破 ${r.kills}（頭 ${r.headshots}）・1 体あたり ${(r.shots / Math.max(1, r.kills)).toFixed(2)} 発・耳 ${r.ears}（1 ゲーム時間あたり ${(r.ears / r.hours).toFixed(1)}）・残弾 ${r.ammoLeft}`,
    `  距離別の命中: ${r.byRange.map(([d, s, h]) => `〜${d}m ${rate(h, s)}`).join(' / ')}`,
    `  時間の内訳: 狙う ${pct(r.seconds.aim)}・耳を取りに歩く ${pct(r.seconds.walkEars)}・獲物を探して歩く ${pct(r.seconds.walkFind)}・待つ ${pct(r.seconds.wait)}・接近戦 ${pct(r.seconds.close)}・夜（本拠） ${pct(r.seconds.home)}`,
    `  歩いた距離 ${r.walked} m・耳の回収率 ${Math.round((r.ears / Math.max(1, r.kills * BALANCE.combat.ears.perCorpse)) * 100)}%・被ダメージ ${r.damage}・夜の撃破 ${r.nightKills}・最初の撃破 ${r.firstKillMinute ?? '—'} 分後・死亡 ${r.died === null ? 'なし' : `${r.died} 分後`}（計算 ${r.ms} ms）`,
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [seed = '12', start = '0', hours = '30', hand = 'average'] = process.argv.slice(2);
  console.log(describeReport(playthrough(Number(seed), Number(start), Number(hours), hand)));
}
