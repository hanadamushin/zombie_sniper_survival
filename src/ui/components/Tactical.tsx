// Tactical HUD (04, 07b, 07c; restyled and reorganised by 08). Small boxes at the edges of the
// screen; through the scope only ammunition, breath, zero and magnification remain. Gauges that
// move every frame (health, stamina, breath, ear collection, the screen effects, the compass) are
// written straight into the DOM by `useLive` — the rest follows the 10 Hz sync.

import { useRef } from 'preact/hooks';
import type { GameState, StaticGrid } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { TACTICAL } from '../../data/tactical.ts';
import { ZOMBIES } from '../../data/zombies.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { interactionAt, nearestHideout } from '../../sim/colony/encounters.ts';
import { clueInReach, clueIsRead, dockInReach, stashInReach, stashOpen, stashTotalLeft } from '../../sim/world/stash.ts';

import { playerAtHome } from '../../sim/colony/morale.ts';
import { hasFlag } from '../../sim/research/modifiers.ts';
import { areaParams, cachedMap, mapOf } from '../../sim/tactical/area.ts';
import { windOf } from '../../sim/tactical/ballistics.ts';
import { corpseInReach } from '../../sim/tactical/combat.ts';
import { observe } from '../../sim/tactical/observe.ts';
import { headingDeg } from '../../sim/tactical/player.ts';
import { weaponOf, zeroDistance } from '../../sim/tactical/weapon.ts';
import { bearingName } from '../../sim/build/raids.ts';
import { cellsWithin } from '../../sim/world/grid.ts';
import { cacheInReach, nearestSupply, outpostAt } from '../../sim/world/outposts.ts';
import { tk } from '../command/format.ts';
import { t, type TextKey } from '../i18n/ja.ts';
import { setStyle, useLive } from '../live.ts';
import type { UiActions } from '../store.ts';
import { Banner, Delta, HintLine, Objectives, Toasts, useServices } from './common.tsx';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Nearest body that still has its ears: distance and bearing relative to where the player looks. */
function nearestEars(state: GameState): { dist: number; turn: number } | null {
  const p = state.player;
  let best: { dist: number; turn: number } | null = null;
  for (const c of state.tactical?.corpses ?? []) {
    if (c.ears <= 0) continue;
    const dx = c.pos[0] - p.pos[0];
    const dz = c.pos[2] - p.pos[2];
    const dist = Math.hypot(dx, dz);
    if (!best || dist < best.dist) best = { dist, turn: Math.atan2(-dx, -dz) - p.yaw };
  }
  return best;
}

const fmtDist = (d: number): string => (d < 1000 ? `${Math.max(1, Math.round(d / 10) * 10)}m` : `${(d / 1000).toFixed(1)}km`);

/** Health, stamina, stance: bottom left. */
function Vitals({ state }: { state: GameState }) {
  const p = state.player;
  const hp = useRef<HTMLSpanElement>(null);
  const st = useRef<HTMLSpanElement>(null);
  useLive((s) => {
    setStyle(hp.current, 'transform', `scaleX(${Math.max(0, Math.min(1, s.player.hp / BALANCE.player.hp)).toFixed(3)})`);
    setStyle(st.current, 'transform', `scaleX(${Math.max(0, Math.min(1, s.player.stamina / TACTICAL.player.staminaMax)).toFixed(3)})`);
  });
  return (
    <div class="hud-box vitals">
      <span class="gauge hp" title={t('hud.hp')} data-testid="hud-hp" data-hp={Math.round(p.hp)}>
        <span ref={hp} />
      </span>
      <span class="stance" data-testid="hud-stance" data-stance={p.stance}>
        {t(`stance.${p.stance}` as TextKey)}
        {p.infectedUntil && <span class="infected">{t('hud.infected')}</span>}
      </span>
      <span class="gauge stamina" title={t('hud.stamina')}>
        <span ref={st} />
      </span>
    </div>
  );
}

/** Screen effects: being hit, low health, infection. Strength written every frame. */
function ScreenFx() {
  const hurt = useRef<HTMLDivElement>(null);
  const low = useRef<HTMLDivElement>(null);
  const sick = useRef<HTMLDivElement>(null);
  useLive((s) => {
    const p = s.player;
    setStyle(hurt.current, 'opacity', (Math.min(1, p.aim.hurtT) * 0.85).toFixed(2));
    const frac = p.hp / BALANCE.player.hp;
    setStyle(low.current, 'opacity', p.aim.deadT > 0 ? '0' : frac < 0.35 ? (0.25 + (0.35 - frac) * 2).toFixed(2) : '0');
    setStyle(sick.current, 'opacity', p.infectedUntil ? '1' : '0');
  });
  return (
    <>
      <div class="fx infect" ref={sick} />
      <div class="fx lowhp" ref={low} data-testid="fx-lowhp" />
      <div class="fx hurt" ref={hurt} />
    </>
  );
}

/** Compass: written every frame so that turning reads smoothly. */
function Compass({ state }: { state: GameState }) {
  const point = useRef<HTMLSpanElement>(null);
  const deg = useRef<HTMLSpanElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const heading0 = Math.round(headingDeg(state.player.yaw)) % 360;
  useLive((s) => {
    const h = Math.round(headingDeg(s.player.yaw)) % 360;
    const text = `${String(h).padStart(3, '0')}°`;
    if (deg.current && deg.current.textContent !== text) {
      deg.current.textContent = text;
      if (point.current) point.current.textContent = t(`compass.${COMPASS[Math.round(h / 45) % 8]!}` as TextKey);
      box.current?.setAttribute('data-heading', String(h));
    }
  });
  return (
    <div class="compass" ref={box} data-testid="hud-compass" data-heading={heading0}>
      <span class="compass-point" ref={point}>{t(`compass.${COMPASS[Math.round(heading0 / 45) % 8]!}` as TextKey)}</span>
      <span class="compass-deg" ref={deg}>{String(heading0).padStart(3, '0')}°</span>
    </div>
  );
}

function BreathGauge({ state }: { state: GameState }) {
  const bar = useRef<HTMLSpanElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useLive((s) => {
    setStyle(bar.current, 'transform', `scaleY(${Math.max(0, Math.min(1, s.player.breath)).toFixed(3)})`);
    box.current?.setAttribute('data-locked', String(s.player.aim.breathLock > 0));
  });
  return (
    <div class="breath" ref={box} title={t('hud.breath')} data-testid="hud-breath" data-locked={state.player.aim.breathLock > 0}>
      <span ref={bar} />
    </div>
  );
}

function EarsPrompt() {
  const bar = useRef<HTMLSpanElement>(null);
  useLive((s) => setStyle(bar.current, 'transform', `scaleX(${Math.min(1, s.player.aim.interactT / BALANCE.combat.ears.seconds).toFixed(3)})`));
  return (
    <div class="prompt" data-testid="hud-interact">
      <span>{t('hud.takeEars')}</span>
      <span class="bar"><span ref={bar} /></span>
    </div>
  );
}

/** An arrow towards a raid or an approaching horde, around the centre of the view. */
function RaidArrow({ state }: { state: GameState }) {
  const dir = state.build.raid ? state.build.raid.dir : state.world.pendingHorde?.warned ? state.world.pendingHorde.dir : null;
  const el = useRef<HTMLDivElement>(null);
  useLive((s) => {
    if (dir === null || !el.current) return;
    const rot = (dir * 180) / Math.PI - headingDeg(s.player.yaw);
    setStyle(el.current, 'transform', `rotate(${rot.toFixed(1)}deg)`);
  });
  if (dir === null || !playerAtHome(state) || state.player.aim.scopeT > 0.5) return null;
  return (
    <div class="raid-arrow" ref={el} data-testid="hud-raid-arrow">
      <span>▲<small>{t(`dir.${bearingName(dir)}` as TextKey)}</small></span>
    </div>
  );
}

function KillMark() {
  const { notifier } = useServices();
  const k = notifier?.kill();
  if (!k) return null;
  return (
    <div class="kill-mark" key={k.at} data-head={k.headshot} data-testid="hud-kill">
      {k.knife ? t('kill.knife') : t(k.headshot ? 'kill.head' : 'kill.body', { m: Math.round(k.range) })}
    </div>
  );
}

export function TacticalLayer({ state, grid, actions }: { state: GameState; grid: StaticGrid | null; actions: UiActions }) {
  const p = state.player;
  const aim = p.aim;
  const w = p.weapon;
  const def = weaponOf(state);
  const scoped = aim.scopeT > 0.5;
  const dead = aim.deadT > 0;
  const range = state.flags.range === true;
  const ears = nearestEars(state);
  const reach = corpseInReach(state);
  const wind = windOf(state);
  const windSpeed = Math.hypot(wind[0], wind[1]);
  const act = dead ? null : interactionAt(state);
  const someone = dead || act ? null : nearestHideout(state);
  // O1: a clue at a landmark (its text while standing at it, once read) and a hidden stash's supply point.
  const clue = dead ? null : clueInReach(state);
  const stashAt = dead ? null : stashInReach(state);
  const stashHere = stashAt ? { id: stashAt.site.id, open: stashOpen(stashAt.map, stashAt.site), left: Math.floor(stashTotalLeft(state, stashAt.site.id)) } : null;
  // First steps (07b): somebody is willing to join but nobody has been hired yet — say where to do that.
  const hireHint = !dead && !range && state.colony.candidates.length > 0 && state.colony.survivors.length === 0;
  // 07c: where to get ammunition, when it cannot be had right here (caches in this and the neighbouring areas).
  const mapOfCell = (cell: number): TacticalMap | null => (cell === p.cell ? mapOf(state) : grid ? (() => {
    const params = areaParams(state, grid, cell);
    return params ? cachedMap(params) : null;
  })() : null);
  const nearCells = grid ? cellsWithin(grid, p.cell, 1) : [];
  const supplyAt = dead || range || state.world.travel ? null : nearestSupply(state, TACTICAL.size, mapOfCell, grid, nearCells);
  const cache = dead || playerAtHome(state) ? null : cacheInReach(state, grid, mapOf(state));
  const post = playerAtHome(state) || state.world.travel ? undefined : outpostAt(state, p.cell);
  const supply = playerAtHome(state) ? state.colony.stock.ammo : post ? post.ammo : stashHere ? (stashHere.open ? stashHere.left : 0) : (cache?.left ?? 0);
  const carried = p.inv.ammo ?? 0;
  const canResupply = !dead && supply >= 1 && carried < BALANCE.player.maxAmmo;
  // Rangefinder (W6a) and observation records (S2): what the reticle rests on.
  const rangefinder = scoped && !dead && hasFlag(state, 'scope.rangefinder');
  const records = scoped && !dead && hasFlag(state, 'intel.zombies');
  const seen = rangefinder || records ? observe(state) : null;
  const busy = w.reloadT > 0 ? t('hud.reloading') : w.boltT > 0 ? t('hud.bolt') : w.mag === 0 ? t(carried > 0 ? 'hud.empty' : 'hud.noAmmo') : '';
  const lowAmmo = w.mag + carried <= 20;
  return (
    <div class={`mode-layer tactical${scoped ? ' scoped' : ''}`} data-testid="mode-tactical">
      <ScreenFx />
      <Compass state={state} />
      {!range && <Objectives state={state} grid={grid} />}
      {scoped && <BreathGauge state={state} />}
      {reach && !dead && <EarsPrompt />}
      {act && !reach && (
        <div class="prompt" data-testid="hud-act" data-kind={act.kind}>
          <span>{t(act.kind === 'talk' ? 'hud.talk' : act.kind === 'read' ? (clue && clueIsRead(state, clue) ? 'hud.readAgain' : 'hud.read') : act.kind === 'boat' ? (dockInReach(state) === 'island' ? 'hud.boatBack' : 'hud.boatOver') : 'hud.search')}</span>
        </div>
      )}
      {clue && clueIsRead(state, clue) && (
        <div class="clue-note panel" data-testid="hud-clue" data-stash={clue.stash}>
          <p class="clue-kind">{t('clue.title', { place: t(`landmark.${clue.variant}` as TextKey) })}</p>
          <p>{t(`clue.${clue.variant}.${clue.stash[0]}` as TextKey)}</p>
        </div>
      )}
      {stashHere && (
        <div class="prompt third" data-testid="hud-stash" data-open={stashHere.open ? 1 : 0}>
          <span>{stashHere.open ? t(stashHere.id === 'okinawa' ? 'hud.stashAmmo' : 'hud.stashMaterials', { n: stashHere.left }) : t('hud.stashLocked')}</span>
        </div>
      )}
      {someone && (
        <div class={`prompt someone${ears && !reach ? ' second' : ''}`} data-testid="hud-someone" data-dir={someone.dir}>
          <span class="arrow" style={{ transform: `rotate(${(-someone.turn).toFixed(2)}rad)` }}>▲</span>
          <span>{t('hud.someone', { dir: t(`compass.${someone.dir}` as TextKey), m: Math.round(someone.dist) })}</span>
        </div>
      )}
      {ears && !reach && !dead && (
        <div class="prompt" data-testid="hud-earhint">
          <span class="arrow" style={{ transform: `rotate(${(-ears.turn).toFixed(2)}rad)` }}>▲</span>
          <span>{t('hud.earsAt', { m: Math.round(ears.dist) })}</span>
        </div>
      )}
      {supplyAt && (
        <div class="hud-box supply-hint" data-testid="hud-supply" data-dir={supplyAt.dir} data-kind={supplyAt.point.kind}>
          <span class="arrow" style={{ transform: `rotate(${(-supplyAt.turn).toFixed(2)}rad)` }}>▲</span>
          <span>{supplyAt.point.kind === 'stash' ? t('hud.supplyStash', {
            dir: t(`compass.${supplyAt.dir}` as TextKey),
            dist: fmtDist(supplyAt.dist),
            n: supplyAt.point.ammo,
          }) : supplyAt.point.kind === 'cache' ? t('hud.supplyCache', {
            dir: t(`compass.${supplyAt.dir}` as TextKey),
            dist: fmtDist(supplyAt.dist),
            n: supplyAt.point.ammo,
          }) : t(supplyAt.point.ammo > 0 ? 'hud.supply' : 'hud.supplyNone', {
            name: supplyAt.point.kind === 'home' ? t('world.home') : t(`world.outpost.tier.${outpostAt(state, supplyAt.point.cell)?.tier ?? 1}` as TextKey),
            dir: t(`compass.${supplyAt.dir}` as TextKey),
            dist: fmtDist(supplyAt.dist),
          })}</span>
        </div>
      )}
      {hireHint && <div class="guide" data-testid="hud-hire-hint">{t('hud.hireHint', { n: state.colony.candidates.length })}</div>}
      {seen && (rangefinder ? seen.range !== null : seen.zombie !== null) && (
        <div class="scope-info" data-testid="hud-scope-info" data-range={seen.range !== null ? Math.round(seen.range) : ''}>
          {rangefinder && seen.range !== null && <span>{t('hud.range', { m: Math.round(seen.range) })}</span>}
          {rangefinder && seen.holdMil !== null && <span>{t('hud.holdover', { mil: (seen.holdMil >= 0 ? '+' : '') + seen.holdMil.toFixed(1) })}</span>}
          {records && seen.zombie && <span data-testid="hud-target">{t('hud.target', { kind: tk(`zkind.${seen.zombie.kind}`), hp: Math.max(0, Math.round(seen.zombie.hp)), max: ZOMBIES[seen.zombie.kind].hp })}</span>}
        </div>
      )}
      <RaidArrow state={state} />
      <KillMark />
      <Toasts />
      <Banner />
      <Vitals state={state} />
      <div class="hud-box weapon-box" data-testid="hud-weapon">
        <span class="ammo" data-testid="hud-ammo" data-mag={w.mag} data-ammo={carried} data-low={lowAmmo}>
          <b>{w.mag}</b> / {carried}
        </span>
        <span class="busy">{busy}</span>
        <span class="meta" data-testid="hud-zero" data-zero={zeroDistance(state)}>{t('hud.zero', { m: zeroDistance(state) })}</span>
        <span class="meta" data-testid="hud-zoom">{t('hud.zoom', { x: w.zoom.toFixed(1) })}</span>
        {windSpeed > 0.05 && <span class="wind">{t('hud.wind', { v: windSpeed.toFixed(1), deg: Math.round(headingDeg(Math.atan2(-wind[0], -wind[1]))) })}</span>}
        <span class="ears delta-host" data-testid="hud-ears" data-ears={p.inv.ears ?? 0}>
          {t('hud.ears', { n: p.inv.ears ?? 0 })}
          <Delta value={p.inv.ears ?? 0} testId="hud-ears-delta" />
        </span>
        {canResupply && <span class="resupply" data-testid="hud-resupply" data-cache={cache && !post ? 'true' : 'false'}>{cache && !post ? t('hud.cache', { n: cache.left }) : t('hud.resupply', { n: Math.floor(supply) })}</span>}
        <span class="mag-size sr-only">{def.magSize}</span>
      </div>
      {!dead && !range && !hireHint && <HintLine state={state} actions={actions} where="tactical" />}
      {dead && (
        <div class="death" data-testid="hud-death">
          <div class="panel">{t('hud.dead')}</div>
        </div>
      )}
      {range && (
        <div class="hint">
          <p>{t('tactical.rangeHint')}</p>
          <p>{t('tactical.clickToAim')}</p>
          <p>{t('tactical.keysOnly')}</p>
        </div>
      )}
    </div>
  );
}
