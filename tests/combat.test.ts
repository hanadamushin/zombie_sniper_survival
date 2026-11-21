import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/events.ts';
import { deserialize, serialize } from '../src/core/save.ts';
import { createInitialState, emptyInputFrame, type GameState, type InputFrame, type StaticGrid, type Zombie } from '../src/core/types.ts';
import { BALANCE } from '../src/data/balance.ts';
import { WEAPONS } from '../src/data/weapons.ts';
import { ZOMBIES } from '../src/data/zombies.ts';
import { addBuilding, addStairs, addTower, createFlatBuilder } from '../src/gen/builder.ts';
import { finishMap } from '../src/gen/index.ts';
import { createSim, type Sim } from '../src/sim/index.ts';
import { areaOf, type TacticalArea } from '../src/sim/tactical/area.ts';
import { dropAt, integrate, speedAt, SUBSTEPS, timeTo, zeroAngle } from '../src/sim/tactical/ballistics.ts';
import { heightAt, supportAt } from '../src/sim/tactical/collision.ts';
import { RANGE_SPOTS } from '../src/sim/tactical/range.ts';
import { segmentCapsule, segmentSphere } from '../src/sim/tactical/shapes.ts';
import { scopeFovDeg, swayPattern, swayTarget, viewFovDeg } from '../src/sim/tactical/weapon.ts';
import { addZombie, aliveCount, canopyCount, hitShapes, hitZombie, seesPlayer } from '../src/sim/tactical/zombies.ts';
import { activeCap } from '../src/sim/world/derive.ts';
import { parseGrid, type GridFile } from '../src/sim/world/grid.ts';
import { decodeScenario, initWorld } from '../src/sim/world/scenario.ts';
import { beginAt, findStartCandidates } from '../src/sim/world/start.ts';
import { seedRng } from '../src/core/rng.ts';

const DT = BALANCE.time.fixedStep;
const RIFLE = WEAPONS.rifle!;
const input = (over: Partial<InputFrame> = {}): InputFrame => ({ ...emptyInputFrame(), ...over });

interface Rig {
  state: GameState;
  sim: Sim;
  area: TacticalArea;
  events: GameEvent[];
  run(seconds: number, frame?: InputFrame): void;
  /** One step with the trigger pressed, then released. */
  fire(): void;
  clear(): void;
}

/** A game on the firing range (no world data needed). */
function rangeRig(seed = 5): Rig {
  const state = createInitialState(seed, 1);
  state.flags.range = true;
  const sim = createSim({ grid: null });
  const events: GameEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.tick(state, DT, input());
  const area = areaOf(state)!;
  const rig: Rig = {
    state, sim, area, events,
    run(seconds, frame = input()) {
      for (let i = 0; i < Math.round(seconds / DT); i++) sim.tick(state, DT, frame);
    },
    fire() {
      sim.tick(state, DT, input({ fire: true, scope: true }));
      sim.tick(state, DT, input({ scope: true }));
    },
    clear() {
      state.tactical!.zombies.length = 0;
      area.dynamic.clear();
      state.tactical!.rangeT = RANGE_SPOTS.map(() => -1e9); // no respawns
    },
  };
  return rig;
}

/** Hold the rifle perfectly still (tests of the ballistics, not of the sway). */
function steady(state: GameState): void {
  const aim = state.player.aim;
  state.flags.noSway = true;
  aim.scopeT = 1;
  aim.swayAmp = 0;
  aim.off = [0, 0];
  aim.recoil = [0, 0];
  aim.recoilV = [0, 0];
}

describe('ballistics', () => {
  it('matches the closed-form drop and flight time at every distance', () => {
    const h = DT / SUBSTEPS;
    const pos: [number, number, number] = [0, 0, 0];
    const vel: [number, number, number] = [RIFLE.muzzleVelocity, 0, 0];
    let t = 0;
    for (const d of [100, 200, 300, 400, 500, 600]) {
      let px = pos[0];
      let py = pos[1];
      while (pos[0] < d) {
        px = pos[0];
        py = pos[1];
        integrate(pos, vel, RIFLE.dragPerKm / 1000, RIFLE.gravity, [0, 0], h);
        t += h;
      }
      const f = (d - px) / (pos[0] - px);
      const drop = -(py + (pos[1] - py) * f);
      const time = t - h * (1 - f);
      expect(drop).toBeCloseTo(dropAt(RIFLE, d), 2); // within 5 mm
      expect(Math.abs(drop - dropAt(RIFLE, d)) / dropAt(RIFLE, d)).toBeLessThan(0.01);
      expect(time).toBeCloseTo(timeTo(RIFLE, d), 3);
    }
    // Spec values: 800 m/s, 0.6 /km. 100 m: ~8 cm, 400 m: ~1.45 m, 0.57 s.
    expect(dropAt(RIFLE, 100)).toBeCloseTo(0.0798, 3);
    expect(dropAt(RIFLE, 400)).toBeCloseTo(1.448, 2);
    expect(timeTo(RIFLE, 400)).toBeCloseTo(0.565, 2);
    expect(speedAt(RIFLE, 1000)).toBeCloseTo(800 * Math.exp(-0.6), 6);
    expect(dropAt({ ...RIFLE, dragPerKm: 0 }, 400)).toBeCloseTo(0.5 * 9.81 * 0.25, 6);
  });

  it('zeroing puts the bullet on the point of aim at the zero distance', () => {
    for (const zero of RIFLE.zeroes) {
      const rig = rangeRig();
      rig.clear();
      const { state } = rig;
      // A wall across the range exactly `zero` metres ahead of the muzzle.
      const p = state.player;
      p.weapon.zeroIdx = RIFLE.zeroes.indexOf(zero);
      const wallZ = p.pos[2] - zero;
      rig.area.map.solids.push({ x0: 0, x1: 1024, z0: wallZ - 1, z1: wallZ, y0: -5, y1: 30, kind: 'prop', ref: -1 });
      const index = rig.area.map.solids.length - 1;
      rig.area.map.hash.solids.forEach((cell, c) => {
        const cz = Math.floor(c / rig.area.map.hash.n);
        if (cz === Math.floor((wallZ - 0.5) / rig.area.map.hash.cell)) cell.push(index);
      });
      p.pitch = 0.01; // level-ish sight line
      rig.run(0.1, input({ scope: true }));
      steady(state);
      const eyeY = p.pos[1] + p.eye;
      rig.events.length = 0;
      rig.fire();
      steady(state);
      rig.run(1.2, input({ scope: true }));
      const hit = rig.events.find((e) => e.type === 'bulletHit');
      expect(hit, `zero ${zero}`).toBeDefined();
      if (hit?.type !== 'bulletHit') continue;
      const aimY = eyeY + Math.tan(0.01) * zero;
      expect(hit.pos[1]).toBeCloseTo(aimY, 2);
      expect(hit.pos[0]).toBeCloseTo(p.pos[0], 3);
      expect(hit.range).toBeCloseTo(zero, 0);
      rig.area.map.solids.pop();
      rig.area.map.hash.solids.forEach((cell) => {
        const i = cell.indexOf(index);
        if (i >= 0) cell.splice(i, 1);
      });
    }
    // The elevation matches the flat-fire estimate.
    expect(zeroAngle(RIFLE, 300)).toBeCloseTo(dropAt(RIFLE, 300) / 300, 4);
    expect(zeroAngle(RIFLE, 400)).toBeGreaterThan(zeroAngle(RIFLE, 100));
  });

  it('holding over with the reticle: a 100 m zero needs about 2.8 mil at 400 m', () => {
    const holdMil = (dropAt(RIFLE, 400) / 400 - zeroAngle(RIFLE, 100)) * 1000;
    expect(holdMil).toBeGreaterThan(2.6);
    expect(holdMil).toBeLessThan(3.0);
  });

  it('segment tests hit spheres and capsules where they should', () => {
    expect(segmentSphere([0, 0, 0], [1, 0, 0], 10, 5, 0, 0, 1)).toBeCloseTo(4, 9);
    expect(segmentSphere([0, 0, 0], [1, 0, 0], 3, 5, 0, 0, 1)).toBe(-1);
    expect(segmentSphere([0, 1.01, 0], [1, 0, 0], 10, 5, 0, 0, 1)).toBe(-1);
    expect(segmentSphere([5, 0, 0], [1, 0, 0], 10, 5, 0, 0, 1)).toBe(0);
    expect(segmentCapsule([0, 1, 0], [1, 0, 0], 10, [5, 0, 0], [5, 2, 0], 0.5)).toBeCloseTo(4.5, 9);
    expect(segmentCapsule([0, 2.4, 0], [1, 0, 0], 10, [5, 0, 0], [5, 2, 0], 0.5)).toBeCloseTo(5 - 0.3, 6); // rounded end
    expect(segmentCapsule([0, 2.6, 0], [1, 0, 0], 10, [5, 0, 0], [5, 2, 0], 0.5)).toBe(-1);
    expect(segmentCapsule([5, 10, 0], [0, -1, 0], 20, [5, 0, 0], [5, 2, 0], 0.5)).toBeCloseTo(7.5, 6); // along the axis
  });
});

describe('rifle handling', () => {
  it('fires on the press, cycles the bolt, runs dry and reloads from the carried rounds', () => {
    const rig = rangeRig();
    const { state } = rig;
    const p = state.player;
    p.inv.ammo = 7;
    expect(p.weapon.mag).toBe(5);
    rig.fire();
    expect(p.weapon.mag).toBe(4);
    expect(p.stats.shots).toBe(1);
    expect(p.weapon.boltT).toBeGreaterThan(1);
    // Holding the trigger or pulling it during the bolt cycle does nothing.
    rig.run(0.5, input({ fire: true }));
    rig.fire();
    expect(p.weapon.mag).toBe(4);
    for (let i = 0; i < 4; i++) {
      rig.run(RIFLE.boltTime + 0.05);
      rig.fire();
    }
    expect(p.weapon.mag).toBe(0);
    rig.run(RIFLE.boltTime + 0.05);
    // Empty: the trigger starts a reload.
    rig.events.length = 0;
    rig.fire();
    expect(rig.events.some((e) => e.type === 'reloadStarted')).toBe(true);
    expect(p.stats.shots).toBe(5);
    rig.run(RIFLE.reloadTime + 0.05);
    expect(p.weapon.mag).toBe(5);
    expect(p.inv.ammo).toBe(2);
    // Topping up takes what is left; with nothing left the rifle only clicks.
    rig.fire();
    rig.run(RIFLE.boltTime + 0.05);
    rig.run(DT, input({ reload: true }));
    rig.run(RIFLE.reloadTime + 0.05);
    expect(p.weapon.mag).toBe(5);
    expect(p.inv.ammo).toBe(1);
    p.weapon.mag = 0;
    p.inv.ammo = 0;
    rig.events.length = 0;
    rig.fire();
    expect(rig.events.some((e) => e.type === 'dryFire')).toBe(true);
  });

  it('zoom maps exactly onto the field of view and stays within 4-12x; zero steps through the table', () => {
    const rig = rangeRig();
    const p = rig.state.player;
    const ref = Math.tan((BALANCE.combat.scope.referenceFov * Math.PI) / 360);
    for (const zoom of [4, 6, 12]) expect(Math.tan((scopeFovDeg(zoom) * Math.PI) / 360)).toBeCloseTo(ref / zoom, 12);
    rig.run(0.5, input({ scope: true }));
    expect(p.aim.scopeT).toBe(1);
    expect(viewFovDeg(p)).toBeCloseTo(scopeFovDeg(4), 9);
    rig.run(DT, input({ scope: true, zoomDelta: 30 }));
    expect(p.weapon.zoom).toBe(12);
    expect(viewFovDeg(p)).toBeCloseTo(scopeFovDeg(12), 9);
    rig.run(DT, input({ scope: true, zoomDelta: -99 }));
    expect(p.weapon.zoom).toBe(4);
    rig.run(0.5);
    expect(p.aim.scopeT).toBe(0);
    expect(viewFovDeg(p)).toBeCloseTo(70, 9);
    for (let i = 0; i < 6; i++) rig.run(DT, input({ zeroDelta: 1 }));
    expect(p.weapon.zeroIdx).toBe(3);
    rig.run(DT, input({ zeroDelta: -1 }));
    expect(p.weapon.zeroIdx).toBe(2);
  });

  it('sways by stance, movement, fatigue and breath as specified', () => {
    const rig = rangeRig();
    const { state } = rig;
    const p = state.player;
    const C = BALANCE.combat;
    expect(swayTarget(state)).toBeCloseTo(2.4, 9);
    p.stance = 'crouch';
    expect(swayTarget(state)).toBeCloseTo(1.2, 9);
    p.stance = 'prone';
    expect(swayTarget(state)).toBeCloseTo(0.4, 9);
    p.aim.moved = 1;
    expect(swayTarget(state)).toBeCloseTo(0.4 * 2.5, 9);
    p.aim.moved = 0;
    p.stamina = 0;
    expect(swayTarget(state)).toBeCloseTo(0.4 * 1.8, 9);
    p.stamina = 100;
    p.aim.holding = true;
    expect(swayTarget(state)).toBeCloseTo(0.4 * C.breathFactor, 9);
    p.aim.holding = false;
    // The pattern is smooth and bounded.
    const a: [number, number] = [0, 0];
    const b: [number, number] = [0, 0];
    let max = 0;
    for (let t = 0; t < 30; t += DT) {
      swayPattern(t, a);
      swayPattern(t + DT, b);
      max = Math.max(max, Math.hypot(a[0], a[1]));
      expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeLessThan(0.12);
    }
    expect(max).toBeGreaterThan(0.7);
    expect(max).toBeLessThan(1.25);

    // Holding the breath lasts 6 s, then costs 3 s of heavy sway; it comes back in twice the time.
    p.stance = 'prone';
    rig.run(0.5, input({ scope: true }));
    rig.run(5.5, input({ scope: true, holdBreath: true }));
    expect(p.aim.holding).toBe(true);
    expect(p.aim.swayAmp).toBeCloseTo(0.4 * C.breathFactor, 2);
    expect(Math.hypot(p.aim.off[0], p.aim.off[1])).toBeLessThan(0.1e-3); // < 0.1 mil: 4 cm at 400 m
    rig.run(1, input({ scope: true, holdBreath: true }));
    expect(p.aim.holding).toBe(false);
    expect(p.aim.breathLock).toBeGreaterThan(2);
    rig.run(1, input({ scope: true, holdBreath: true }));
    expect(p.aim.swayAmp).toBeCloseTo(0.4 * C.breathPenalty, 1);
    rig.run(12.5, input({ scope: true }));
    expect(p.breath).toBeGreaterThan(0.99);
  });

  it('kicks on the shot and settles back', () => {
    const rig = rangeRig();
    const p = rig.state.player;
    p.stance = 'prone';
    rig.run(0.5, input({ scope: true }));
    rig.fire();
    let peak = 0;
    for (let i = 0; i < 30; i++) {
      rig.run(DT, input({ scope: true }));
      peak = Math.max(peak, p.aim.recoil[1]);
    }
    expect(peak * 1000).toBeGreaterThan(RIFLE.recoilMil * 0.6);
    expect(peak * 1000).toBeLessThan(RIFLE.recoilMil * 1.1);
    rig.run(0.5, input({ scope: true }));
    expect(Math.abs(p.aim.recoil[1]) * 1000).toBeLessThan(0.05);
  });
});

/** Aim the (steady) rifle at a world point, compensating the drop for the current zero. */
function aimAt(state: GameState, x: number, y: number, z: number): void {
  const p = state.player;
  const dx = x - p.pos[0];
  const dz = z - p.pos[2];
  const dist = Math.hypot(dx, dz);
  p.yaw = Math.atan2(-dx, -dz);
  const zero = RIFLE.zeroes[p.weapon.zeroIdx]!;
  const hold = dropAt(RIFLE, dist) / dist - zeroAngle(RIFLE, zero);
  p.pitch = Math.atan2(y - (p.pos[1] + p.eye), dist) + hold;
  steady(state);
}

describe('hits', () => {
  it('head shots kill, body shots take two, leg shots topple; damage follows the table', () => {
    const rig = rangeRig();
    rig.clear();
    const { state, area } = rig;
    const p = state.player;
    const place = (kind: Zombie['kind']): Zombie => {
      const z = addZombie(state, area, kind, p.pos[0], p.pos[2] - 100, Math.PI)!;
      z.dummy = 1;
      return z;
    };
    const shootAt = (z: Zombie, part: 'head' | 'torso' | 'legs'): void => {
      const s = hitShapes(z);
      const pt = part === 'head' ? s.head : part === 'torso' ? [(s.torsoA[0] + s.torsoB[0]) / 2, (s.torsoA[1] + s.torsoB[1]) / 2, (s.torsoA[2] + s.torsoB[2]) / 2] : [(s.legsA[0] + s.legsB[0]) / 2, (s.legsA[1] + s.legsB[1]) / 2, (s.legsA[2] + s.legsB[2]) / 2];
      aimAt(state, pt[0]!, pt[1]!, pt[2]!);
      rig.events.length = 0;
      rig.fire();
      steady(state);
      rig.run(0.3, input({ scope: true }));
      rig.run(RIFLE.boltTime);
      p.weapon.mag = 5;
    };
    rig.run(0.3, input({ scope: true }));

    const walker = place('walker');
    shootAt(walker, 'head');
    expect(walker.state).toBe('down');
    expect(rig.events.find((e) => e.type === 'zombieKilled')).toMatchObject({ headshot: true, kind: 'walker' });
    expect(rig.events.find((e) => e.type === 'bulletHit')).toMatchObject({ part: 'head', killed: true });
    expect(p.stats.headshots).toBe(1);
    rig.run(BALANCE.zombie.downSeconds);
    expect(state.tactical!.zombies).toHaveLength(0);
    expect(state.tactical!.corpses).toHaveLength(1);
    expect(state.tactical!.corpses[0]).toMatchObject({ ears: 2, headshot: true, kind: 'walker' });

    const second = place('walker');
    shootAt(second, 'torso');
    expect(second.hp).toBe(100 - ZOMBIES.walker.torso);
    expect(second.state).not.toBe('down');
    shootAt(second, 'torso');
    expect(second.state).toBe('down');
    expect(rig.events.find((e) => e.type === 'zombieKilled')).toMatchObject({ headshot: false });
    rig.run(BALANCE.zombie.downSeconds);

    const runner = place('runner');
    shootAt(runner, 'legs');
    expect(runner.hp).toBe(70 - ZOMBIES.runner.legs);
    expect(runner.crippled).toBe(true);
    expect(hitShapes(runner).head[1] - runner.pos[1]).toBeLessThan(0.5); // now crawling
    shootAt(runner, 'head');
    expect(runner.state).toBe('down');
    rig.run(BALANCE.zombie.downSeconds);

    const brute = place('brute');
    shootAt(brute, 'head');
    expect(brute.hp).toBe(300);
    shootAt(brute, 'legs');
    expect(brute.hp).toBe(275);
    expect(brute.crippled).toBe(false);
    shootAt(brute, 'head');
    expect(brute.state).toBe('down');
  });

  it('one bullet goes through two bodies, the second at 60 %, and stops there', () => {
    const rig = rangeRig();
    rig.clear();
    const { state, area } = rig;
    const p = state.player;
    const zs = [80, 82, 84].map((d) => {
      const z = addZombie(state, area, 'walker', p.pos[0], p.pos[2] - d, Math.PI)!;
      z.dummy = 1;
      return z;
    });
    rig.run(0.3, input({ scope: true }));
    const s = hitShapes(zs[0]!);
    aimAt(state, s.torsoB[0], (s.torsoA[1] + s.torsoB[1]) / 2, s.torsoB[2]);
    rig.fire();
    steady(state);
    rig.run(0.3, input({ scope: true }));
    expect(zs[0]!.hp).toBe(100 - 55);
    expect(zs[1]!.hp).toBeCloseTo(100 - 55 * 0.6, 9);
    expect(zs[2]!.hp).toBe(100);
    expect(rig.events.filter((e) => e.type === 'bulletHit')).toHaveLength(2);
    expect(state.tactical!.bullets).toHaveLength(0);
  });

  it('walls, trunks and the ground stop bullets and report where they landed', () => {
    const rig = rangeRig();
    rig.clear();
    const { state } = rig;
    const p = state.player;
    rig.run(0.3, input({ scope: true }));
    // Into the ground 50 m ahead.
    aimAt(state, p.pos[0], 0, p.pos[2] - 50);
    rig.events.length = 0;
    rig.fire();
    rig.run(0.3, input({ scope: true }));
    const ground = rig.events.find((e) => e.type === 'bulletHit');
    expect(ground).toMatchObject({ zombie: null, surface: 'terrain' });
    if (ground?.type === 'bulletHit') {
      expect(ground.pos[1]).toBeCloseTo(0, 2);
      expect(ground.pos[2]).toBeCloseTo(p.pos[2] - 50, 0);
    }
    // The 100 m board.
    rig.run(RIFLE.boltTime);
    const spot = RANGE_SPOTS[0]!;
    aimAt(state, spot.x + 1, 2, spot.z - 2);
    rig.events.length = 0;
    rig.fire();
    rig.run(0.4, input({ scope: true }));
    expect(rig.events.find((e) => e.type === 'bulletHit')).toMatchObject({ zombie: null, surface: 'prop' });
  });

  it('a moving target has to be led: aiming at where it is misses, aiming ahead hits', () => {
    for (const lead of [false, true]) {
      const rig = rangeRig();
      const { state } = rig;
      const p = state.player;
      p.weapon.zeroIdx = 2;
      rig.run(0.3, input({ scope: true }));
      const walker = state.tactical!.zombies.find((z) => z.dummy === 2 && RANGE_SPOTS[z.spot!]!.distance === 300)!;
      rig.run(3, input({ scope: true })); // let it get going
      const s = hitShapes(walker);
      const dist = Math.hypot(s.head[0] - p.pos[0], s.head[2] - p.pos[2]);
      const vx = Math.sign(walker.goal[0] - walker.pos[0]) * ZOMBIES.walker.speed;
      const ahead = lead ? vx * timeTo(RIFLE, dist) : 0;
      aimAt(state, s.head[0] + ahead, s.head[1], s.head[2]);
      rig.events.length = 0;
      rig.fire();
      steady(state);
      rig.run(0.8, input({ scope: true }));
      const hits = rig.events.filter((e) => e.type === 'bulletHit' && e.zombie === walker.id);
      expect(hits.length, lead ? 'led shot' : 'unled shot').toBe(lead ? 1 : 0);
      if (lead) expect(hits[0]).toMatchObject({ part: 'head' });
    }
  });

  it('the hit shapes line up with the body: head on top, within the height of the kind', () => {
    const rig = rangeRig();
    rig.clear();
    for (const kind of ['walker', 'runner', 'brute', 'crawler'] as const) {
      const z = addZombie(rig.state, rig.area, kind, 500, 500, 0)!;
      const s = hitShapes(z);
      const def = ZOMBIES[kind];
      if (def.prone) expect(s.head[1] + s.headR).toBeLessThan(0.5);
      else {
        expect(s.head[1] + s.headR - z.pos[1]).toBeCloseTo(def.height, 1);
        expect(s.torsoB[1]).toBeLessThan(s.head[1]);
        expect(s.legsB[1]).toBeLessThanOrEqual(s.torsoA[1]);
      }
      // A ray through the head centre from the side hits the head.
      expect(hitZombie(z, [s.head[0] + 5, s.head[1], s.head[2]], [-1, 0, 0], 10)).toMatchObject({ part: 'head' });
      expect(hitZombie(z, [s.head[0] + 5, s.head[1] + 1, s.head[2]], [-1, 0, 0], 10)).toBeNull();
    }
  });
});

describe('knife, ears, damage', () => {
  it('stabs from behind kill silently, from the front they only wound', () => {
    const rig = rangeRig();
    rig.clear();
    const { state, area } = rig;
    const p = state.player;
    p.yaw = 0; // facing north
    const back = addZombie(state, area, 'walker', p.pos[0], p.pos[2] - 1.2, 0)!; // also facing north: its back is to us
    back.dummy = 1;
    rig.run(DT, input({ knife: true }));
    expect(back.state).toBe('down');
    expect(rig.events.find((e) => e.type === 'zombieKilled')).toMatchObject({ headshot: false, knife: true });
    rig.run(BALANCE.combat.knife.interval + 0.05);
    const front = addZombie(state, area, 'walker', p.pos[0], p.pos[2] - 1.2, Math.PI)!; // facing us
    front.dummy = 1;
    rig.run(DT, input({ knife: true }));
    expect(front.hp).toBe(100 - BALANCE.combat.knife.damage);
    // The swing has an interval.
    rig.run(DT, input({ knife: true }));
    expect(front.hp).toBe(40);
    rig.run(BALANCE.combat.knife.interval);
    rig.run(DT, input({ knife: true }));
    expect(front.state).toBe('down');
    // Out of reach: nothing.
    const far = addZombie(state, area, 'walker', p.pos[0], p.pos[2] - 3, 0)!;
    far.dummy = 1;
    rig.run(BALANCE.combat.knife.interval + 0.05);
    rig.run(DT, input({ knife: true }));
    expect(far.hp).toBe(100);
  });

  it('ears are taken by holding E next to a body; bodies rot away', () => {
    const rig = rangeRig();
    rig.clear();
    const { state, area } = rig;
    const p = state.player;
    const z = addZombie(state, area, 'walker', p.pos[0], p.pos[2] - 1.2, 0)!;
    z.dummy = 1;
    rig.run(DT, input({ knife: true }));
    rig.run(BALANCE.zombie.downSeconds + 0.1);
    expect(state.tactical!.corpses).toHaveLength(1);
    // A tap is not enough.
    rig.run(0.4, input({ interactHeld: true }));
    expect(p.aim.interactT).toBeGreaterThan(0.3);
    rig.run(0.1);
    expect(p.inv.ears).toBe(0);
    rig.events.length = 0;
    rig.run(BALANCE.combat.ears.seconds + 0.05, input({ interactHeld: true }));
    expect(p.inv.ears).toBe(2);
    expect(p.stats.earsCollected).toBe(2);
    expect(rig.events.filter((e) => e.type === 'earsCollected')).toEqual([{ type: 'earsCollected', amount: 2 }]);
    // Nothing left on it.
    rig.run(1, input({ interactHeld: true }));
    expect(p.inv.ears).toBe(2);
    // Too far away: no.
    state.tactical!.corpses[0]!.ears = 2;
    p.pos[2] += 3;
    rig.run(1, input({ interactHeld: true }));
    expect(p.inv.ears).toBe(2);
    // Ten game hours later it is gone.
    const body = state.tactical!.corpses[0]!;
    const born = body.expiresDay * 1440 + body.expiresMinute - BALANCE.combat.corpse.hours * 60;
    expect(Math.abs(born - (state.time.day * 1440 + state.time.minute))).toBeLessThanOrEqual(8);
    body.expiresDay = state.time.day;
    body.expiresMinute = state.time.minute + 3; // 1 s of play = 1 game minute
    rig.run(1.5);
    expect(state.tactical!.corpses).toHaveLength(1);
    rig.run(2.5);
    expect(state.tactical!.corpses).toHaveLength(0);
  });

  it('falls hurt beyond 3 m, in proportion to the height', () => {
    const b = createFlatBuilder();
    addBuilding(b, 'office', 500, 500, 520, 520, 4);
    addBuilding(b, 'office', 540, 500, 560, 520, 8);
    addTower(b, 600, 600, 12);
    const map = finishMap(b);
    for (const [x, z, h, dmg] of [[519.5, 510, 4, 12], [559.5, 510, 8, 60], [600, 600, 12, 108]] as const) {
      const rig = rangeRig();
      rig.clear();
      // Swap the map under the running game.
      Object.assign(rig.area, { map });
      const p = rig.state.player;
      p.pos = [x, supportAt(map, x, z, Infinity), z];
      expect(p.pos[1]).toBeCloseTo(h, 5);
      p.yaw = -Math.PI / 2; // east
      rig.events.length = 0;
      rig.run(3, input({ moveZ: 1 }));
      const hurt = rig.events.filter((e) => e.type === 'playerHurt');
      if (dmg >= 100) {
        expect(rig.events.some((e) => e.type === 'playerDied' && e.cause === 'fall')).toBe(true);
      } else {
        expect(hurt).toHaveLength(1);
        expect(hurt[0]).toMatchObject({ amount: dmg, cause: 'fall' });
        expect(p.hp).toBe(100 - dmg);
      }
    }
    // Stairs and small ledges do not hurt.
    const rig = rangeRig();
    Object.assign(rig.area, { map });
    const p = rig.state.player;
    p.pos = [530, 0, 530];
    rig.run(2, input({ moveZ: 1, sprint: true }));
    expect(p.hp).toBe(100);
  });
});

describe('zombie behaviour', () => {
  /** Flat test ground with the player in the middle and no automatic spawns. */
  function arena(build?: (b: ReturnType<typeof createFlatBuilder>) => void): Rig {
    const b = createFlatBuilder();
    build?.(b);
    const map = finishMap(b);
    const rig = rangeRig();
    rig.clear();
    Object.assign(rig.area, { map });
    rig.state.player.pos = [512, 0, 512];
    rig.state.player.yaw = 0;
    rig.state.time.minute = 12 * 60;
    return rig;
  }

  it('sees the player in front within 40 m by day and 60 m by night, not behind, not through walls', () => {
    const rig = arena((b) => addBuilding(b, 'shed', 540, 505, 544, 519, 4));
    const { state, area } = rig;
    const map = area.map;
    const facing = (dx: number, dz: number): number => Math.atan2(-dx, -dz);
    const north = addZombie(state, area, 'walker', 512, 512 - 35, facing(0, 1))!; // looks south at the player
    expect(seesPlayer(state, map, north)).toBe(true);
    north.pos[2] = 512 - 45;
    expect(seesPlayer(state, map, north)).toBe(false);
    state.time.minute = 23 * 60;
    expect(seesPlayer(state, map, north)).toBe(true);
    north.pos[2] = 512 - 65;
    expect(seesPlayer(state, map, north)).toBe(false);
    state.time.minute = 12 * 60;
    // Looking away.
    north.pos[2] = 512 - 20;
    north.yaw = facing(0, -1);
    expect(seesPlayer(state, map, north)).toBe(false);
    // ... unless the player is right behind it.
    north.pos[2] = 512 - 2;
    expect(seesPlayer(state, map, north)).toBe(true);
    // Behind a shed.
    const east = addZombie(state, area, 'walker', 512 + 38, 512, facing(-1, 0))!;
    expect(seesPlayer(state, map, east)).toBe(false);
    // Lying down halves the distance.
    north.pos[2] = 512 - 30;
    north.yaw = facing(0, 1);
    expect(seesPlayer(state, map, north)).toBe(true);
    state.player.stance = 'prone';
    state.player.eye = 0.3;
    expect(seesPlayer(state, map, north)).toBe(false);
  });

  it('tree cover shortens the sight line', () => {
    const b = createFlatBuilder();
    for (let i = 0; i < 5; i++) b.trees.push(512 + 3, 512 - 8 - i * 5, 9, 4, 1);
    const map = finishMap(b);
    expect(canopyCount(map, 512, 512, 512, 512 - 30)).toBe(5);
    expect(canopyCount(map, 600, 512, 600, 512 - 30)).toBe(0);
    const rig = rangeRig();
    rig.clear();
    Object.assign(rig.area, { map });
    const { state, area } = rig;
    state.player.pos = [512, 0, 512];
    state.time.minute = 12 * 60;
    const z = addZombie(state, area, 'walker', 512, 512 - 30, Math.PI)!;
    expect(seesPlayer(state, map, z)).toBe(false); // 30 m > 40 m * (1 - 5 * 0.12)
    z.pos[0] = 600;
    state.player.pos[0] = 600;
    expect(seesPlayer(state, map, z)).toBe(true);
  });

  it('chases, bites, and can infect; the bite count follows the attack value', () => {
    const rig = arena();
    const { state, area } = rig;
    const z = addZombie(state, area, 'walker', 512, 512 - 12, Math.PI)!;
    rig.run(1);
    expect(z.state).toBe('chase');
    expect(rig.events.some((e) => e.type === 'zombieAlerted' && e.chase)).toBe(true);
    rig.run(14);
    const hurts = rig.events.filter((e) => e.type === 'playerHurt');
    expect(hurts.length).toBeGreaterThanOrEqual(1);
    expect(hurts[0]).toMatchObject({ amount: 15, cause: 'bite' });
    expect(state.player.hp).toBe(100 - 15 * hurts.length);
    // Gunshots do not attract: one far away and looking elsewhere keeps wandering while we shoot.
    const far = addZombie(state, area, 'walker', 512, 512 + 200, Math.PI)!;
    rig.fire();
    rig.run(1);
    expect(far.state).toBe('wander');
  });

  it('a zombie that sees a fellow fall goes on alert, searches, and calms down again', () => {
    const rig = arena();
    const { state, area } = rig;
    const p = state.player;
    p.pos = [512, 0, 700];
    const victim = addZombie(state, area, 'walker', 512, 500, 0)!;
    victim.dummy = 1;
    const witness = addZombie(state, area, 'walker', 520, 505, 0)!;
    witness.t = 100; // standing around
    const distant = addZombie(state, area, 'walker', 545, 440, 0)!; // too far to notice (and out of the bullet's path)
    distant.t = 100;
    rig.run(0.3, input({ scope: true }));
    const s = hitShapes(victim);
    aimAt(state, s.head[0], s.head[1], s.head[2]);
    rig.fire();
    steady(state);
    rig.run(0.5, input({ scope: true }));
    expect(victim.state).toBe('down');
    expect(witness.state).toBe('alert');
    expect(distant.state).toBe('wander');
    rig.run(8);
    expect(Math.hypot(witness.pos[0] - 512, witness.pos[2] - 500)).toBeLessThan(4); // went to look
    rig.run(BALANCE.zombie.alertSeconds);
    expect(witness.state).toBe('wander');
    // The cell's population is not touched here: the kill is only announced.
    expect(rig.events.filter((e) => e.type === 'zombieKilled')).toHaveLength(1);
  });

  it('climbs outside stairs to reach the roof, but not ladders or towers', () => {
    const rig = arena((b) => {
      const bd = addBuilding(b, 'apartment', 500, 480, 524, 500, 6);
      addStairs(b, bd, 3);
      addTower(b, 600, 512, 12);
    });
    const { state, area } = rig;
    const map = area.map;
    const p = state.player;
    p.pos = [512, supportAt(map, 512, 490, Infinity), 490];
    expect(p.pos[1]).toBeCloseTo(6, 5);
    const z = addZombie(state, area, 'walker', 470, 530, 0)!;
    z.state = 'chase';
    z.goal = [512, 490];
    let reached = false;
    for (let i = 0; i < 90 && !reached; i++) {
      rig.run(1);
      z.lost = 0; // keep it interested
      reached = z.pos[1] > 5.9 || state.player.hp < 100;
    }
    expect(reached).toBe(true);
    expect(z.pos[1]).toBeGreaterThan(5.5);

    // Tower: it waits underneath.
    const rig2 = arena((b) => addTower(b, 600, 512, 12));
    const p2 = rig2.state.player;
    p2.pos = [600, supportAt(rig2.area.map, 600, 512, Infinity), 512];
    expect(p2.pos[1]).toBeCloseTo(12, 5);
    const z2 = addZombie(rig2.state, rig2.area, 'runner', 570, 512, 0)!;
    z2.state = 'chase';
    for (let i = 0; i < 20; i++) {
      rig2.run(1);
      z2.lost = 0;
      z2.goal = [600, 512];
    }
    expect(z2.pos[1]).toBeLessThan(0.6);
    expect(Math.hypot(z2.pos[0] - 600, z2.pos[2] - 512)).toBeLessThan(5);
    expect(p2.hp).toBe(100);
  });

  it('gets around a building instead of walking into the wall forever', () => {
    const rig = arena((b) => addBuilding(b, 'house', 500, 460, 524, 480, 5));
    const { state, area } = rig;
    state.player.pos = [512, 0, 440]; // north of the house
    const z = addZombie(state, area, 'runner', 512, 500, 0)!; // south of it
    z.state = 'chase';
    for (let i = 0; i < 40 && state.player.hp === 100; i++) {
      rig.run(1);
      z.lost = 0;
      z.goal = [512, 440];
    }
    expect(state.player.hp).toBeLessThan(100);
  });

  it('being surrounded is deadly, and death brings the provisional revival', () => {
    const rig = arena();
    const { state, area } = rig;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      addZombie(state, area, i % 3 === 0 ? 'runner' : 'walker', 512 + Math.cos(a) * 15, 512 + Math.sin(a) * 15, 0)!.state = 'chase';
    }
    state.player.inv.ears = 12;
    let died = -1;
    for (let i = 0; i < 60 && died < 0; i++) {
      rig.run(1);
      if (rig.events.some((e) => e.type === 'playerDied')) died = i;
    }
    expect(died).toBeGreaterThan(3); // not instantly ...
    expect(died).toBeLessThan(40); // ... but soon
    expect(state.player.aim.deadT).toBeGreaterThan(0);
    rig.run(BALANCE.player.reviveSeconds + 0.1);
    expect(rig.events.some((e) => e.type === 'playerRevived')).toBe(true);
    expect(state.player.hp).toBe(100);
    expect(state.player.inv.ears).toBe(0);
    expect(state.player.aim.deadT).toBe(0);
  });

  it('stays cheap with 600 zombies (07c: five times the earlier 150)', () => {
    const rig = arena();
    const { state, area } = rig;
    for (let i = 0; i < 600; i++) addZombie(state, area, i % 7 === 0 ? 'runner' : 'walker', 40 + (i % 30) * 31, 40 + Math.floor(i / 30) * 47, i);
    expect(aliveCount(state.tactical!)).toBe(600);
    rig.run(1);
    const t0 = performance.now();
    rig.run(10);
    const perStep = (performance.now() - t0) / 600;
    console.log(`600 zombies: ${perStep.toFixed(3)} ms per sim step`);
    expect(perStep).toBeLessThan(1.5); // ms per fixed step (budget: 4 ms per frame with rendering)
  });
});

// ---------------------------------------------------------------------------------------------
// With the real world data
// ---------------------------------------------------------------------------------------------

const DATA = new URL('../public/data/', import.meta.url);
const grid: StaticGrid = parseGrid(JSON.parse(readFileSync(new URL('grid.json', DATA), 'utf8')) as GridFile);
const scenario = (() => {
  const buf = readFileSync(new URL('infection_0.bin', DATA));
  return decodeScenario(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
})();

function worldGame(seed = 12): { state: GameState; sim: Sim; events: GameEvent[]; run(seconds: number, frame?: InputFrame): void } {
  const state = createInitialState(seed, 1);
  initWorld(state, grid, scenario);
  const start = findStartCandidates(state.world.cells, grid, seedRng(seed))[0]!;
  beginAt(state, grid, start.cell);
  const sim = createSim({ grid });
  const events: GameEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  return {
    state, sim, events,
    run(seconds, frame = input()) {
      for (let i = 0; i < Math.round(seconds / DT); i++) sim.tick(state, DT, frame);
    },
  };
}

describe('zombies in the world', () => {
  it('the start cell has something to shoot: min(active, Z × tacticalZScale) zombies, none inside the base', () => {
    const g = worldGame();
    const { state } = g;
    const z0 = state.world.cells.Z[state.player.cell]!;
    expect(z0).toBeGreaterThanOrEqual(BALANCE.world.start.minCellZ);
    g.run(DT);
    const t = state.tactical!;
    expect(t.populated).toBe(true);
    expect(t.zombies.length).toBeGreaterThanOrEqual(10);
    expect(t.zombies.length).toBeLessThanOrEqual(Math.min(activeCap(z0 * BALANCE.world.tacticalZScale) * BALANCE.world.activeMul, BALANCE.world.activeMax));
    expect(t.zombies.length).toBeGreaterThan(300); // 07c: five times the earlier crowd
    expect(t.zombies.length).toBeGreaterThan(z0 > 60 ? 60 : 40); // 07b+: more than the cell's own Z on a quiet start
    // Placed outside the keep-out ring; one step of a runner may already have carried it a little in (R0: real start cells).
    for (const z of t.zombies) expect(Math.hypot(z.pos[0] - 512, z.pos[2] - 512)).toBeGreaterThan(BALANCE.zombie.homeKeepOut - 5);
    // Deterministic for a seed.
    const h = worldGame();
    h.run(DT);
    expect(h.state.tactical!.zombies.map((z) => [z.kind, z.pos])).toEqual(t.zombies.map((z) => [z.kind, z.pos]));
  });

  it('a kill lowers the cell Z exactly once, and reinforcements come from the edge while Z lasts', () => {
    const g = worldGame();
    const { state } = g;
    g.run(DT);
    const cell = state.player.cell;
    const t = state.tactical!;
    const before = state.world.cells.Z[cell]!;
    const count = t.zombies.length;
    const area = areaOf(state)!;
    // Kill it the honest way: a head shot from 30 m. Since 07b zombies start in cover, so the
    // victim is first led onto the open, flat middle of the home base.
    const victim = t.zombies[0]!;
    const mid = area.map.size / 2;
    const lane = mid + 80; // clear of the headquarters and the first field
    victim.pos = [lane, heightAt(area.map, lane, mid - 20), mid - 20];
    area.dynamic.set(victim.id, victim.pos[0], victim.pos[2]);
    state.player.pos = [lane, heightAt(area.map, lane, mid + 10), mid + 10];
    victim.t = 100;
    victim.dummy = 1;
    g.run(0.3, input({ scope: true }));
    const s = hitShapes(victim);
    aimAt(state, s.head[0], s.head[1], s.head[2]);
    g.sim.tick(state, DT, input({ fire: true, scope: true }));
    steady(state);
    g.run(0.5, input({ scope: true }));
    expect(victim.state).toBe('down');
    expect(state.world.cells.Z[cell]).toBe(before - 1);
    g.run(3);
    expect(state.world.cells.Z[cell]).toBe(before - 1);
    expect(aliveCount(t)).toBeLessThanOrEqual(count);
    void area;
    // While the cell has any Z left, newcomers walk in from the edge, one per respawnSeconds
    // (07b+: the area holds up to Z × tacticalZScale, so 3 left is still plenty)...
    state.world.cells.Z[cell] = 3;
    t.zombies.length = 0;
    areaOf(state)!.dynamic.clear();
    state.player.pos = [512, state.player.pos[1], 512];
    g.run(BALANCE.world.respawnSeconds * 5 + 1);
    expect(aliveCount(t)).toBe(5);
    expect(t.reserve).toBe(3 * BALANCE.world.tacticalZScale - 5);
    for (const z of t.zombies) expect(Math.min(z.pos[0], z.pos[2], 1024 - z.pos[0], 1024 - z.pos[2])).toBeLessThan(120); // came in from the edge
    // ...and at 0 nothing comes any more.
    state.world.cells.Z[cell] = 0;
    t.zombies.length = 0;
    areaOf(state)!.dynamic.clear();
    g.run(BALANCE.world.respawnSeconds * 3);
    expect(t.zombies).toHaveLength(0);
  });

  it('after a load the zombies are placed again from the cell Z; bodies and their ears are gone', () => {
    const g = worldGame();
    const { state } = g;
    g.run(1);
    state.tactical!.corpses.push({ id: 99999, pos: [500, 0, 500], ears: 2, expiresDay: 200, expiresMinute: 0, kind: 'walker', yaw: 0, headshot: true, crippled: false });
    const n = state.tactical!.zombies.length;
    expect(n).toBeGreaterThan(0);
    const loaded = deserialize(serialize(state));
    expect(loaded.tactical!.zombies).toHaveLength(0);
    expect(loaded.tactical!.corpses).toHaveLength(0);
    expect(loaded.tactical!.populated).toBe(false);
    const sim = createSim({ grid });
    sim.tick(loaded, DT, input());
    expect(loaded.tactical!.zombies.length).toBe(n);
    expect(loaded.player.aim.scopeT).toBe(0);
  });

  it('an untreated infection kills when its time is up', () => {
    const g = worldGame();
    const { state } = g;
    g.run(DT);
    state.tactical!.zombies.length = 0;
    state.world.cells.Z[state.player.cell] = 0;
    state.player.infectedUntil = { day: state.time.day, minute: state.time.minute + 3 }; // 1 s of play = 1 game minute
    g.run(1.5);
    expect(g.events.some((e) => e.type === 'playerDied')).toBe(false);
    g.run(2.5);
    expect(g.events.some((e) => e.type === 'playerDied' && e.cause === 'infection')).toBe(true);
  });

  it('an urban cell fills up to the cap and wandering into it gets you killed', () => {
    const g = worldGame(3);
    const { state } = g;
    const urban = grid.landIds.find((id) => grid.cells[id]!.land === 'urban' && state.world.cells.Z[id]! > 50_000)!;
    state.player.cell = urban;
    state.tactical = null;
    state.time.minute = 21 * 60; // night: faster, sharper-eyed
    g.run(DT);
    const t = state.tactical!;
    expect(t.zombies.length).toBe(Math.min(BALANCE.world.activeMax, activeCap(state.world.cells.Z[urban]! * BALANCE.world.tacticalZScale) * BALANCE.world.activeMul));
    expect(t.zombies.length).toBeGreaterThan(70);
    // Walk into the nearest group and stand there.
    const p = state.player;
    const nearest = t.zombies.reduce((a, b) => (Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) < Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]) ? a : b));
    p.pos = [nearest.pos[0] + 6, nearest.pos[1], nearest.pos[2] + 6];
    let died = false;
    for (let i = 0; i < 240 && !died; i++) {
      g.run(1);
      died = g.events.some((e) => e.type === 'playerDied');
    }
    expect(died).toBe(true);
  });
});
