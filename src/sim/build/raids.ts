// Raids on the home base (spec §7): the nightly approach and the hordes that build up from the
// zombies drifting into the home cell (world.hordeMeter, filled by the world system every day).
//
// While the player is at the base a raid is real: zombies enter the map in waves from one
// direction and follow the flow field. When the player is away, travelling or laid up after dying,
// the tactical map does not exist, so the raid is fought in numbers by `resolveAway` — along the
// same route (the flow field over the structures), with the same wall, moat and defender figures —
// and its results are written into BuildState for the player to come home to.

import { rand, randRange, stream, type RngState } from '../../core/rng.ts';
import { addMinutes, toAbsMinutes } from '../../core/time.ts';
import type { GameState, RaidState, StaticGrid, Structure, Zombie, ZombieKind } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { BUILD } from '../../data/buildings.ts';
import { TACTICAL } from '../../data/tactical.ts';
import { RESEARCH } from '../../data/techs.ts';
import { ZOMBIES } from '../../data/zombies.ts';
import { setAlarm } from '../colony/ai.ts';
import { defenders, fighters } from '../colony/jobs.ts';
import { changeMorale, killSurvivor } from '../colony/morale.ts';
import { ctxNow, logEntry, moveEars, moveStock } from '../colony/stock.ts';
import { isHome } from '../colony/survivors.ts';
import { getMod, hasFlag } from '../research/modifiers.ts';
import type { SimContext } from '../system.ts';
import { areaOf, type TacticalArea } from '../tactical/area.ts';
import { isDead } from '../tactical/health.ts';
import { addZombie } from '../tactical/zombies.ts';
import { activeCap, kindMix, removeZombies } from '../world/derive.ts';
import { baseCentre } from './blueprints.ts';
import { activeTurrets, ammoPerShot, defenderSkill, defenderWeapon, killsPerShot, sniperIds, towers, TURRET_WEAPON } from './defense.ts';
import { FIELD_UNREACHED, raidField, tileOf } from './flowfield.ts';
import { damageStructure, defOf, hqOf, isBuilt, moatFilled, overlayOf, TILE, TILES } from './structures.ts';

const R = BUILD.raid;
type Ctx = Pick<SimContext, 'emit' | 'grid'>;

/** The player is at the base, alive, and its map is loaded: raids are fought for real. */
export function playerPresent(state: GameState): boolean {
  const area = areaOf(state);
  return !!area && area.map.params.isHome && state.world.homeCell === state.player.cell && !state.world.travel && !isDead(state) && state.flags.skipping !== true && !state.flags.range;
}

export function population(state: GameState): number {
  return 1 + state.colony.survivors.filter(isHome).length;
}
export function hordeThreshold(state: GameState): number {
  return R.hordeBase + R.hordePerHead * population(state);
}

const mixOf = (state: GameState, grid: StaticGrid | null): Record<ZombieKind, number> => kindMix(grid?.cells[state.world.homeCell ?? -1]?.land ?? 'rural');

function pickKind(rng: RngState, mix: Record<ZombieKind, number>): ZombieKind {
  let r = rand(rng);
  for (const kind of ['walker', 'runner', 'crawler', 'brute'] as const) {
    r -= mix[kind];
    if (r < 0) return kind;
  }
  return 'walker';
}

const raiders = (state: GameState): Zombie[] => (state.tactical?.zombies ?? []).filter((z) => z.raid && z.state !== 'down');

// ---------------------------------------------------------------------------------------------
// Scheduling (once a game minute)
// ---------------------------------------------------------------------------------------------

/** Hours of warning the colony gets: a manned tower sees a horde coming, scouts hear of it a day ahead. */
function warningHours(state: GameState): number {
  if (hasFlag(state, 'horde.scout')) return R.warnScoutHours; // scout network (C6b)
  const manned = towers(state).length > 0 && defenders(state).length > 0;
  return manned ? R.warnTowerHours : R.warnBlindHours;
}

export function raidMinute(state: GameState, ctx: Ctx): void {
  const home = state.world.homeCell;
  if (home === null || state.flags.range || state.flags.defeat) return;
  const world = state.world;
  const now = toAbsMinutes(state.time);
  const minute = state.time.minute;
  const c = ctxNow(state, ctx.grid, ctx.emit);

  // A horde on its way: warn when the colony can know, start when it is here.
  const ph = world.pendingHorde;
  if (ph) {
    const due = ph.arrivesDay * BALANCE.time.minutesPerDay + ph.arrivesMinute;
    if (!ph.warned && due - now <= warningHours(state) * 60) {
      ph.warned = true;
      ctx.emit({ type: 'hordeWarning', arrivesDay: ph.arrivesDay, arrivesMinute: ph.arrivesMinute, size: ph.size, dir: ph.dir });
      logEntry(c, 'defense', 'log.hordeWarning', { dir: bearingName(ph.dir), size: roughSize(ph.size), hours: Math.max(1, Math.round((due - now) / 60)) });
    }
    if (now >= due) {
      world.pendingHorde = null;
      startRaid(state, ctx, 'horde', ph.size, ph.dir);
    }
  }
  if (minute % 60 !== 0) return;

  // The meter has run over: a horde forms and sets out.
  if (!world.pendingHorde && world.hordeMeter >= hordeThreshold(state)) {
    const size = Math.round(Math.min(world.hordeMeter, getMod(state, 'raid.hordeMax', R.hordeMax)));
    world.hordeMeter = Math.max(0, world.hordeMeter - size);
    const at = addMinutes({ day: state.time.day, minute }, R.leadHours * 60);
    world.pendingHorde = { arrivesDay: at.day, arrivesMinute: at.minute, size, dir: rand(stream(state, 'build.raid')) * Math.PI * 2 };
  }

  // The nightly approach.
  if (minute === R.nightHour * 60 && !state.build.raid) {
    const z = Math.max(0, world.cells.Z[home] ?? 0);
    const size = Math.min(z, Math.max(R.nightMin, Math.round(getMod(state, 'raid.nightSize', activeCap(z) * R.nightShare * Math.min(1, population(state) / R.nightFullPop)))));
    // They come for people: an empty base draws nobody.
    if (size > 0 && (playerPresent(state) || population(state) > 1)) startRaid(state, ctx, 'night', size, rand(stream(state, 'build.raid')) * Math.PI * 2);
  }

  // Morning: the ears of what fell by the walls.
  if (minute === R.earHour * 60) collectEars(state, ctx);
}

const BEARINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export function bearingName(dir: number): string {
  const turns = ((dir / (Math.PI * 2)) % 1 + 1) % 1;
  return BEARINGS[Math.round(turns * 8) % 8]!;
}
/** What a lookout can tell: a round figure. */
export function roughSize(size: number): number {
  return size < 20 ? Math.max(5, Math.round(size / 5) * 5) : Math.round(size / 10) * 10;
}

function startRaid(state: GameState, ctx: Ctx, kind: 'night' | 'horde', size: number, dir: number): void {
  const c = ctxNow(state, ctx.grid, ctx.emit);
  const present = playerPresent(state);
  if (kind === 'horde') ctx.emit({ type: 'hordeArrived', size, dir });
  ctx.emit({ type: 'raidStarted', kind, size, dir, away: !present });
  if (!present) {
    resolveAway(state, ctx, kind, size, dir, 0);
    return;
  }
  const running = state.build.raid;
  if (running) {
    // A horde arriving on top of the night's visitors: one fight.
    running.kind = kind === 'horde' ? 'horde' : running.kind;
    running.size += size;
    running.toSpawn += size;
    if (kind === 'horde') running.dir = dir;
  } else state.build.raid = { kind, dir, size, toSpawn: size, killed: 0, startedAbs: toAbsMinutes(state.time), waveT: 0 };
  setAlarm(state, true);
  logEntry(c, 'defense', kind === 'horde' ? 'log.hordeArrived' : 'log.nightRaid', { dir: bearingName(dir), size: roughSize(size) });
}

function endRaid(state: GameState, ctx: Ctx, raid: RaidState, killed: number, repelled: boolean, away: boolean, wallsLost: number, dead: number): void {
  const c = ctxNow(state, ctx.grid, ctx.emit);
  state.build.raid = null;
  setAlarm(state, false);
  state.build.lastRaid = { kind: raid.kind, day: state.time.day, minute: state.time.minute, size: raid.size, killed, wallsLost, dead, away, repelled };
  if (repelled && raid.kind === 'horde') for (const s of state.colony.survivors) if (isHome(s)) changeMorale(s, R.repelMorale);
  ctx.emit({ type: 'raidEnded', kind: raid.kind, killed, repelled, away });
  if (state.flags.defeat) return;
  logEntry(c, 'defense', away ? 'log.raidAway' : repelled ? 'log.raidRepelled' : 'log.raidOver', { size: raid.size, killed, walls: wallsLost, dead });
}

// ---------------------------------------------------------------------------------------------
// The real thing (every step while the player is at the base)
// ---------------------------------------------------------------------------------------------

/** Structures and people lost since the raid began are counted from these marks. */
const marks = new WeakMap<RaidState, { ruins: number; dead: number }>();
const ruinCount = (state: GameState): number => state.build.structures.reduce((n, s) => n + (s.ruinUntil !== undefined ? 1 : 0), 0);

export function raidStep(state: GameState, ctx: SimContext, area: TacticalArea): void {
  const raid = state.build.raid;
  if (!raid) return;
  if (!marks.has(raid)) marks.set(raid, { ruins: ruinCount(state), dead: state.colony.memorial.length });
  const alive = raiders(state);
  const map = area.map;
  const rng = stream(state, 'build.raid');

  // Waves.
  if (raid.toSpawn > 0) {
    raid.waveT -= ctx.dt;
    if (raid.waveT <= 0) {
      raid.waveT = R.waveSeconds;
      const [cx, cz] = baseCentre(state);
      const mix = mixOf(state, ctx.grid);
      let room = Math.min(R.waveSize, raid.toSpawn, R.maxActive - alive.length);
      for (let tries = 0; room > 0 && tries < 60; tries++) {
        const a = raid.dir + randRange(rng, -R.spawnArc, R.spawnArc);
        const r = randRange(rng, R.spawnDist[0], R.spawnDist[1]);
        const x = Math.min(map.size - 6, Math.max(6, cx + Math.sin(a) * r));
        const z = Math.min(map.size - 6, Math.max(6, cz - Math.cos(a) * r));
        if (!map.walk[tileOf(x, z)]) continue;
        const zb = addZombie(state, area, pickKind(rng, mix), x, z, Math.atan2(-(cx - x), -(cz - z)));
        if (!zb) break; // the map is full: wait for the next wave
        zb.raid = true;
        raid.toSpawn--;
        room--;
      }
    }
  }

  const fallen = raid.size - raid.toSpawn - raiders(state).length;
  raid.killed = Math.max(raid.killed, fallen);
  const mark = marks.get(raid)!;
  const lost = (): [number, number] => [Math.max(0, ruinCount(state) - mark.ruins), Math.max(0, state.colony.memorial.length - mark.dead)];
  if (state.flags.defeat) return endRaid(state, ctx, raid, raid.killed, false, false, ...lost());
  if (raid.toSpawn <= 0 && raiders(state).length === 0) return endRaid(state, ctx, raid, raid.killed, true, false, ...lost());
  // Dawn: what is left of a night's visitors loses interest.
  const hour = state.time.minute / 60;
  if (raid.kind === 'night' && hour >= R.dawnHour && hour < R.nightHour) {
    for (const z of alive) z.raid = false;
    endRaid(state, ctx, raid, raid.killed, true, false, ...lost());
  }
}

/** The player has left (travel, death): what remains of the raid is settled in numbers. */
export function raidAbandoned(state: GameState, ctx: Ctx): void {
  const raid = state.build.raid;
  if (!raid) return;
  const t = state.tactical;
  let left = raid.toSpawn;
  if (t) {
    const area = areaOf(state);
    for (const z of t.zombies) {
      if (!z.raid || z.state === 'down') continue;
      left++;
      area?.dynamic.remove(z.id);
    }
    t.zombies = t.zombies.filter((z) => !z.raid || z.state === 'down');
  }
  state.build.raid = null;
  setAlarm(state, false);
  if (left > 0) resolveAway(state, ctx, raid.kind, left, raid.dir, raid.killed, raid.size);
  else endRaid(state, ctx, raid, raid.killed, true, false, 0, 0);
}

// ---------------------------------------------------------------------------------------------
// Ears in the morning (spec §4.5)
// ---------------------------------------------------------------------------------------------

function collectEars(state: GameState, ctx: Ctx): void {
  const build = state.build;
  let ears = 0;
  const C = BALANCE.combat.ears;
  const haveGuards = defenders(state).length > 0;
  if (haveGuards) {
    // Bodies still lying by the walls (only while the map exists).
    const t = state.tactical;
    const area = areaOf(state);
    if (t && area && area.map.params.isHome) {
      const ov = overlayOf(state, area.map.walk);
      const reach = Math.ceil(R.earRadius / TILE);
      for (const corpse of t.corpses) {
        if (corpse.ears <= 0) continue;
        const tx = Math.floor(corpse.pos[0] / TILE), ty = Math.floor(corpse.pos[2] / TILE);
        let nearWall = false;
        for (let y = Math.max(0, ty - reach); y <= Math.min(TILES - 1, ty + reach) && !nearWall; y++) {
          for (let x = Math.max(0, tx - reach); x <= Math.min(TILES - 1, tx + reach); x++) {
            if (ov.sidx[y * TILES + x]! > 0 && Math.hypot(x - tx, y - ty) * TILE <= R.earRadius) {
              nearWall = true;
              break;
            }
          }
        }
        if (!nearWall) continue;
        ears += corpse.ears * R.earRate;
        corpse.ears = 0;
      }
    }
    ears += build.pendingEars * C.perCorpse * R.earRate;
  }
  build.pendingEars = 0;
  ears = Math.floor(ears);
  if (ears <= 0) return;
  const c = ctxNow(state, ctx.grid, ctx.emit);
  moveEars(c, 'income', ears);
  logEntry(c, 'economy', 'log.earsGathered', { ears });
}

// ---------------------------------------------------------------------------------------------
// The battle in numbers (player away)
// ---------------------------------------------------------------------------------------------

export interface AwayResult {
  killed: number;
  wallsLost: number;
  dead: number;
  repelled: boolean;
  hqLost: boolean;
  seconds: number;
}

/** Structures a column from bearing `dir` has to get through, in order, ending with the building it is after. */
export function breachRoute(state: GameState, dir: number): { route: Structure[]; reachable: boolean } {
  const field = raidField(state, areaOf(state)?.map.params.isHome ? areaOf(state)!.map : null);
  const ov = overlayOf(state, areaOf(state)?.map.params.isHome ? areaOf(state)!.map.walk : null);
  const [cx, cz] = baseCentre(state);
  const r: number = R.spawnDist[0];
  const clamp = (v: number): number => Math.min(TACTICAL.size - 6, Math.max(6, v));
  // Start where the column enters; if that very spot is no ground to stand on, a little nearer.
  let tile = -1;
  for (let back = 0; back < r - 20 && tile < 0; back += TILE) {
    const t = tileOf(clamp(cx + Math.sin(dir) * (r - back)), clamp(cz - Math.cos(dir) * (r - back)));
    if (field.dist[t] !== FIELD_UNREACHED) tile = t;
  }
  const route: Structure[] = [];
  if (tile < 0) return { route, reachable: false };
  for (let guard = 0; guard < TILES * 4; guard++) {
    const next = field.next[tile]!;
    if (next < 0) break;
    const i = ov.sidx[next]!;
    if (i > 0 && !ov.wire[next]) {
      const st = state.build.structures[i - 1]!;
      if (route[route.length - 1] !== st) route.push(st);
    }
    tile = next;
  }
  return { route, reachable: true };
}

/**
 * Fight a raid without the tactical map. Rounds of R.roundSeconds: raiders arrive in waves, the
 * front works on the next obstacle of their route (walls lose durability, moats fill with
 * bodies), defenders shoot at the same rates as in the real fight, and once the route is open the
 * headquarters itself is attacked. The results go straight into the state.
 */
export function resolveAway(state: GameState, ctx: Ctx, kind: 'night' | 'horde', size: number, dir: number, killedBefore: number, totalSize: number = size): AwayResult {
  const c = ctxNow(state, ctx.grid, ctx.emit);
  const home = state.world.homeCell!;
  const mix = mixOf(state, ctx.grid);
  const kinds = ['walker', 'runner', 'crawler', 'brute'] as const;
  const softHp = kinds.reduce((s, k) => s + (k === 'brute' ? 0 : mix[k] * ZOMBIES[k].hp), 0) / Math.max(1e-6, 1 - mix.brute);
  const wallDps = kinds.reduce((s, k) => s + mix[k] * ZOMBIES[k].wallDps, 0);
  const speed = kinds.reduce((s, k) => s + mix[k] * ZOMBIES[k].speed, 0);

  const { route, reachable } = breachRoute(state, dir);
  const hq = hqOf(state);
  // Everyone who fights: defenders, the militia (F7b), and automatic turrets (F7a) as tireless tower guards.
  const people = fighters(state, true);
  const snipers = sniperIds(state, people);
  const towerCount = towers(state).length;
  const hitBonus = getMod(state, 'defender.hit', 0);
  type Gun = { g: (typeof people)[number] | null; tower: boolean; sniper: boolean };
  const guns: Gun[] = people.map((g, i) => ({ g, tower: i < towerCount && !g.militia, sniper: i < towerCount && snipers.has(g.survivor.id) }));
  for (let i = activeTurrets(state).length; i > 0; i--) guns.push({ g: null, tower: true, sniper: false });
  const guards = people;
  const ruinsBefore = ruinCount(state);
  const deadBefore = state.colony.memorial.length;

  const dt = R.roundSeconds;
  const approach = R.spawnDist[0] / Math.max(0.5, speed * BALANCE.zombie.nightSpeed);
  const limit = kind === 'night' ? ((24 + R.dawnHour - R.nightHour) % 24) * 60 : 24 * 60; // game minutes = seconds of battle
  let killed = 0;
  let bodies = 0; // lying near the walls with their ears on
  let alive = 0;
  let arrived = 0;
  let stage = 0;
  let shots = 0;
  let killCarry = 0;
  let hqLost = false;
  let seconds = 0;
  for (; seconds < limit; seconds += dt) {
    // arrivals
    const due = seconds < approach ? 0 : Math.min(size, (Math.floor((seconds - approach) / R.waveSeconds) + 1) * R.waveSize);
    alive += due - arrived;
    arrived = due;
    if (arrived >= size && alive <= 0) break;
    if (alive <= 0) continue;

    // defenders
    let ammoLeft = state.colony.stock.ammo - shots;
    for (const gun of guns) {
      const turret = gun.g === null;
      if (turret && ammoLeft < 1) continue;
      let w = turret ? TURRET_WEAPON : defenderWeapon(state, ammoLeft);
      const sniper = gun.sniper && w.ammo > 0;
      if (sniper) w = { ...w, headshot: RESEARCH.snipers.headshot };
      const onTower = gun.tower;
      // Without a tower there is nothing to shoot over the walls with until the dead are inside.
      const breached = stage >= route.length - 1;
      const share = w.range > 5 ? (onTower || breached || route.length <= 1 ? R.engageShare : 0.15) : breached ? 0.6 : 0.3;
      const n = (dt / (turret ? w.interval : w.interval / defenderSkill(state, gun.g!.power))) * share;
      const rounds = n * ammoPerShot(state, w);
      ammoLeft -= rounds;
      shots += rounds;
      killCarry += n * killsPerShot(w, w.hit + hitBonus + (onTower && !turret ? R.towerHit : 0) + (sniper ? RESEARCH.snipers.hit : 0), softHp, mix.brute);
    }
    const shot = Math.min(alive, Math.floor(killCarry));
    killCarry -= shot;
    alive -= shot;
    killed += shot;
    bodies += shot;
    if (alive <= 0) continue;
    if (!reachable) continue;

    // the front works on the next obstacle
    const st = route[stage];
    if (!st) continue;
    const def = defOf(st);
    // A building is attacked from all round, and shrugs most of it off.
    const sides = def.kind === 'building' ? 2 * (def.size[0] + def.size[1]) : 1;
    const front = Math.min(alive, R.attackersPerTile * sides) * (def.kind === 'building' ? R.buildingDamage : 1);
    if (!isBuilt(st)) {
      stage++;
    } else if (def.kind === 'moat' && !moatFilled(st)) {
      if (def.unfillable) continue;
      const fell = Math.min(alive, Math.ceil(BUILD.moatFill - (st.corpsesInMoat ?? 0)), Math.max(1, Math.round((front * dt) / R.moatFallSeconds)));
      st.corpsesInMoat = (st.corpsesInMoat ?? 0) + fell;
      alive -= fell;
      killed += fell;
      if (moatFilled(st)) {
        state.build.gridRev++;
        ctx.emit({ type: 'moatBridged', id: st.id });
        stage++;
      }
    } else if (def.kind === 'moat' || def.hp <= 0) {
      stage++;
    } else if (damageStructure(state, ctx.emit, st, front * wallDps * dt)) {
      if (st === hq) {
        hqLost = true;
        break;
      }
      stage++;
      // The route beyond a fallen building leads on to the headquarters.
      if (stage >= route.length && hq && isBuilt(hq)) route.push(hq);
    }

    // inside: people caught in the open
    if (stage >= route.length - 1 && route.length > 0) {
      for (const g of guards) {
        const s = g.survivor;
        if (s.status !== 'ok' || !state.colony.survivors.includes(s)) continue;
        if (rand(stream(state, 'build.raid')) < Math.min(0.5, (alive / Math.max(1, guards.length)) * 0.04)) {
          s.hp -= R.biteDps * dt * 0.5;
          if (s.hp <= 0) killSurvivor(c, s, 'raid');
          else if (s.hp < R.fleeHp) s.status = 'injured';
        }
      }
    }
  }

  if (shots > 0) moveStock(c, 'ammo', -Math.min(state.colony.stock.ammo, Math.round(shots)));
  removeZombies(state, home, killed);
  state.build.pendingEars += bodies;
  const result: AwayResult = {
    killed: killed + killedBefore,
    wallsLost: Math.max(0, ruinCount(state) - ruinsBefore),
    dead: state.colony.memorial.length - deadBefore,
    repelled: !hqLost && (alive <= 0 || kind === 'night' || !reachable || stage < route.length),
    hqLost,
    seconds,
  };
  const raid: RaidState = { kind, dir, size: totalSize, toSpawn: 0, killed: result.killed, startedAbs: toAbsMinutes(state.time), waveT: 0 };
  endRaid(state, ctx, raid, result.killed, result.repelled, true, result.wallsLost, result.dead);
  return result;
}
