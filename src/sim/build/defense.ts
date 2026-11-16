// Defenders (spec §4.5) while the player is at the base: who stands where, who shoots what, and
// what the dead do to people caught in the open. Deliberately modest — a rifle downs a walker
// every eight seconds or so, a brute shrugs most of it off — so that the player's own shooting
// decides how a night goes. The abstract battle in raids.ts uses the same numbers.

import { rand, stream } from '../../core/rng.ts';
import type { GameState, Structure, Zombie } from '../../core/types.ts';
import { BUILD, DEFENDER_WEAPONS, type DefenderWeapon } from '../../data/buildings.ts';
import { ZOMBIES } from '../../data/zombies.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { RESEARCH } from '../../data/techs.ts';
import { fighters } from '../colony/jobs.ts';
import { getMod, hasFlag } from '../research/modifiers.ts';
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

/** Rounds one shot takes from the stores (standardised logistics, W8, halves it). */
export function ammoPerShot(state: GameState, w: Pick<DefenderWeapon, 'ammo'>): number {
  return getMod(state, 'ammo.issue', w.ammo);
}

/** Automatic turrets that fire (F7a): they need power and ammunition, not people. */
export function activeTurrets(state: GameState): Structure[] {
  if (!hasFlag(state, 'turret') || !hasFlag(state, 'power')) return [];
  return state.build.structures.filter((s) => isBuilt(s) && s.def === 'turret');
}
export const TURRET_WEAPON: DefenderWeapon = { id: 'turret', ...RESEARCH.turret };

/** Ids of the defenders who serve as snipers (W9): the best few. */
export function sniperIds(state: GameState, list: readonly { survivor: { id: number }; power: number; militia?: boolean }[]): Set<number> {
  if (!hasFlag(state, 'snipers')) return new Set();
  return new Set([...list].filter((d) => !d.militia).sort((a, b) => b.power - a.power || a.survivor.id - b.survivor.id).slice(0, RESEARCH.snipers.count).map((d) => d.survivor.id));
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

  const hitBonus = getMod(state, 'defender.hit', 0); // floodlights (power plant)
  /** One shot from (x, y, z): pick a target, pay for the round, roll the hit. Returns the seconds to wait. */
  const shoot = (id: number, x: number, y: number, z: number, w: DefenderWeapon, range: number, hitChance: number, headshot: number, interval: number): number => {
    const target = nearestZombie(state, area, x, y, z, range, w.range > 5);
    if (!target) return 0.4;
    const rounds = ammoPerShot(state, w);
    if (rounds > 0) moveStock(ctxNow(state, ctx.grid, ctx.emit), 'ammo', -rounds);
    const hit = rand(rng) < hitChance + hitBonus;
    ctx.emit({ type: 'defenderFired', id, pos: [x, y, z], target: [target.pos[0], target.pos[1] + 1.1, target.pos[2]], hit });
    if (!hit) return interval;
    if (target.kind !== 'brute' && rand(rng) < headshot) killZombie(state, area, ctx, target, true, false, id);
    else {
      target.hp -= w.damage;
      if (target.hp <= 0) killZombie(state, area, ctx, target, false, false, id);
      else target.flinch = 0.2;
    }
    return interval;
  };

  const list = fighters(state, alarm);
  const snipers = sniperIds(state, list);
  const towerRange = getMod(state, 'tower.range', R.towerRange);
  for (const d of list) {
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
    // A sniper (W9) is one of the best defenders, up a tower, with a firearm.
    const sniper = onTower && w.ammo > 0 && snipers.has(s.id);
    const range = w.range * (onTower && w.range > 5 ? towerRange : 1) * (sniper ? RESEARCH.snipers.range : 1);
    const hitChance = w.hit + (onTower ? R.towerHit : 0) + (sniper ? RESEARCH.snipers.hit : 0);
    rt.cd.set(s.id, shoot(s.id, s.pos[0], y, s.pos[1], w, range, hitChance, sniper ? RESEARCH.snipers.headshot : w.headshot, w.interval / defenderSkill(state, d.power)));
  }

  // Automatic turrets (F7a): no crew, but they eat ammunition and stop without power.
  for (const tur of activeTurrets(state)) {
    const key = -tur.id;
    const cd = (rt.cd.get(key) ?? rand(rng)) - dt;
    if (cd > 0) {
      rt.cd.set(key, cd);
      continue;
    }
    if (state.colony.stock.ammo < ammoPerShot(state, TURRET_WEAPON)) {
      rt.cd.set(key, 2);
      continue;
    }
    const [x, z] = centreOf(tur);
    const y = heightAt(area.map, x, z) + defOf(tur).height;
    rt.cd.set(key, shoot(tur.id, x, y, z, TURRET_WEAPON, TURRET_WEAPON.range, TURRET_WEAPON.hit, TURRET_WEAPON.headshot, TURRET_WEAPON.interval));
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
