// Defenders (spec §4.5) while the player is at the base: who stands where, who shoots what, and
// what the dead do to people caught in the open. Deliberately modest — a rifle downs a walker
// every eight seconds or so, a brute shrugs most of it off — so that the player's own shooting
// decides how a night goes. The abstract battle in raids.ts uses the same numbers.

import { rand, stream } from '../../core/rng.ts';
import type { GameState, Structure, Zombie } from '../../core/types.ts';
import { BUILD, DEFENDER_WEAPONS, type DefenderWeapon } from '../../data/buildings.ts';
import { ZOMBIES } from '../../data/zombies.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { defenders } from '../colony/jobs.ts';
import { killSurvivor } from '../colony/morale.ts';
import { ctxNow, moveStock } from '../colony/stock.ts';
import { isHome } from '../colony/survivors.ts';
import type { SimContext } from '../system.ts';
import type { TacticalArea } from '../tactical/area.ts';
import { heightAt, segmentHitsStatic } from '../tactical/collision.ts';
import { killZombie, zombieById } from '../tactical/zombies.ts';
import { baseCentre } from './blueprints.ts';
import { tileOf } from './flowfield.ts';
import { centreOf, defOf, isBuilt, jobFacility, overlayOf, techUnlocked, TILE, TILES } from './structures.ts';

const R = BUILD.raid;

/** What a defender fights with: the best unlocked weapon the stores can feed. */
export function defenderWeapon(state: GameState, ammoLeft: number = state.colony.stock.ammo): DefenderWeapon {
  for (const w of DEFENDER_WEAPONS) if (techUnlocked(state, w.tech) && (w.ammo === 0 || ammoLeft >= w.ammo)) return w;
  return DEFENDER_WEAPONS[DEFENDER_WEAPONS.length - 1]!;
}

/** Skill factor of a defender: 1 for an average one (defence output 5 / h), with the barracks bonus. */
export function defenderSkill(state: GameState, power: number): number {
  return Math.min(1.6, Math.max(0.5, 0.5 + power / 10)) * (jobFacility(state, 'defense') ?? 1);
}

/** Expected zombies put down per shot (used by the abstract battle; the real one rolls each shot). */
export function killsPerShot(w: DefenderWeapon, hit: number, avgHp: number, bruteShare: number): number {
  return Math.min(1, hit) * ((1 - bruteShare) * (w.headshot + (1 - w.headshot) * Math.min(1, w.damage / avgHp)) + bruteShare * Math.min(1, w.damage / ZOMBIES.brute.hp));
}

export function towers(state: GameState): Structure[] {
  return state.build.structures.filter((s) => isBuilt(s) && defOf(s).kind === 'tower');
}

/** Height someone at (x, z) stands at: a tower deck when there is one, otherwise the ground. */
export function standHeight(state: GameState, map: TacticalMap, x: number, z: number): number {
  const ov = overlayOf(state, map.walk);
  const i = ov.sidx[tileOf(x, z)]!;
  const st = i > 0 ? state.build.structures[i - 1] : undefined;
  const ground = heightAt(map, x, z);
  return st && defOf(st).kind === 'tower' ? ground + defOf(st).height : ground;
}

export interface GuardPost {
  pos: [number, number];
  tower: number | null;
}

/** Where the defenders stand: on the towers first, then just inside the gates, then around the headquarters. */
export function guardPosts(state: GameState): GuardPost[] {
  const posts: GuardPost[] = [];
  for (const t of towers(state)) posts.push({ pos: centreOf(t), tower: t.id });
  const [cx, cz] = baseCentre(state);
  for (const g of state.build.structures) {
    if (!isBuilt(g) || defOf(g).kind !== 'gate') continue;
    const [gx, gz] = centreOf(g);
    const d = Math.hypot(cx - gx, cz - gz) || 1;
    posts.push({ pos: [gx + ((cx - gx) / d) * 3.5, gz + ((cz - gz) / d) * 3.5], tower: null });
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    posts.push({ pos: [cx + Math.cos(a) * 12, cz + Math.sin(a) * 12], tower: null });
  }
  return posts;
}

interface Runtime {
  cd: Map<number, number>;
  biteT: number;
}
const runtimes = new WeakMap<GameState['colony'], Runtime>();

const near: number[] = [];

function nearestZombie(state: GameState, area: TacticalArea, x: number, y: number, z: number, range: number, needSight: boolean): Zombie | null {
  near.length = 0;
  area.dynamic.query(x, z, range, near);
  let best: Zombie | null = null;
  let bestD = range;
  for (const id of near) {
    const zb = zombieById(state.tactical!, id);
    if (!zb || zb.state === 'down' || zb.dummy) continue;
    const d = Math.hypot(zb.pos[0] - x, zb.pos[2] - z);
    if (d >= bestD) continue;
    if (needSight && segmentHitsStatic(area.map, [x, y, z], [zb.pos[0], zb.pos[1] + 1.1, zb.pos[2]])) continue;
    best = zb;
    bestD = d;
  }
  return best;
}

/** Every step while the player is in the home cell. */
export function updateDefenders(state: GameState, area: TacticalArea, ctx: SimContext): void {
  const t = state.tactical;
  if (!t || t.zombies.length === 0) return;
  const colony = state.colony;
  let rt = runtimes.get(colony);
  if (!rt) runtimes.set(colony, (rt = { cd: new Map(), biteT: 0 }));
  const dt = ctx.dt;
  const alarm = state.flags.colonyAlarm === true;
  const rng = stream(state, 'build.defense');
  const ov = overlayOf(state, area.map.walk);

  for (const d of defenders(state)) {
    if (!d.onDuty && !alarm) continue;
    const s = d.survivor;
    const cd = (rt.cd.get(s.id) ?? rand(rng) * 2) - dt;
    if (cd > 0) {
      rt.cd.set(s.id, cd);
      continue;
    }
    const w = defenderWeapon(state);
    const tile = tileOf(s.pos[0], s.pos[1]);
    const si = ov.sidx[tile]!;
    const onTower = si > 0 && defOf(state.build.structures[si - 1]!).kind === 'tower';
    const y = standHeight(state, area.map, s.pos[0], s.pos[1]) + 1.5;
    const range = w.range * (onTower && w.range > 5 ? R.towerRange : 1);
    const target = nearestZombie(state, area, s.pos[0], y, s.pos[1], range, w.range > 5);
    if (!target) {
      rt.cd.set(s.id, 0.4);
      continue;
    }
    rt.cd.set(s.id, w.interval / defenderSkill(state, d.power));
    if (w.ammo > 0) moveStock(ctxNow(state, ctx.grid, ctx.emit), 'ammo', -w.ammo);
    const hit = rand(rng) < w.hit + (onTower ? R.towerHit : 0);
    ctx.emit({ type: 'defenderFired', id: s.id, pos: [s.pos[0], y, s.pos[1]], target: [target.pos[0], target.pos[1] + 1.1, target.pos[2]], hit });
    if (!hit) continue;
    if (target.kind !== 'brute' && rand(rng) < w.headshot) killZombie(state, area, ctx, target, true, false, s.id);
    else {
      target.hp -= w.damage;
      if (target.hp <= 0) killZombie(state, area, ctx, target, false, false, s.id);
      else target.flinch = 0.2;
    }
  }

  // People in the open get bitten. Inside a building or up a tower they are safe.
  rt.biteT += dt;
  if (rt.biteT < 0.5) return;
  const span = rt.biteT;
  rt.biteT = 0;
  const c = ctxNow(state, ctx.grid, ctx.emit);
  for (const s of [...colony.survivors]) {
    if (!isHome(s)) continue;
    const tx = Math.floor(s.pos[0] / TILE), ty = Math.floor(s.pos[1] / TILE);
    if (tx < 0 || ty < 0 || tx >= TILES || ty >= TILES) continue;
    const i = ov.sidx[ty * TILES + tx]!;
    if (i > 0) {
      const kind = defOf(state.build.structures[i - 1]!).kind;
      if (kind === 'building' || kind === 'tower') continue;
    }
    near.length = 0;
    area.dynamic.query(s.pos[0], s.pos[1], R.biteReach, near);
    let biters = 0;
    for (const id of near) {
      const zb = zombieById(t, id);
      if (zb && zb.state !== 'down' && !zb.dummy && Math.hypot(zb.pos[0] - s.pos[0], zb.pos[2] - s.pos[1]) < R.biteReach) biters++;
    }
    if (biters === 0) continue;
    s.hp -= R.biteDps * Math.min(3, biters) * span;
    ctx.emit({ type: 'survivorHurt', id: s.id, hp: s.hp });
    if (s.hp <= 0) killSurvivor(c, s, 'raid');
    else if (s.hp < R.fleeHp && s.status === 'ok') s.status = 'injured';
  }
}
