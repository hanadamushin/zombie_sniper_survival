// One frame per mode. These are the mount points for later sessions:
//   TacticalLayer — crosshair, ammo, stance, scope overlay hooks (04 / 08)
//   CommandLayer  — survivors, build menu, research, ledger, log panels (05 / 06 / 07)
//   WorldLayer    — strategic map canvas (02)
//   MenuOverlay   — pause menu, save slots, settings (08)

import { useState } from 'preact/hooks';
import type { GameState, StaticGrid } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { TACTICAL } from '../../data/tactical.ts';
import { windOf } from '../../sim/tactical/ballistics.ts';
import { corpseInReach } from '../../sim/tactical/combat.ts';
import { headingDeg } from '../../sim/tactical/player.ts';
import { weaponOf, zeroDistance } from '../../sim/tactical/weapon.ts';
import { t, type TextKey } from '../i18n/ja.ts';
import type { UiActions } from '../store.ts';
import { WorldMap } from '../world/WorldMap.tsx';
import { slotLabel } from './TitleScreen.tsx';
import { BuildGround, NO_TOOL, type BuildTool } from '../command/build.tsx';
import { CommandPanel } from '../command/CommandPanel.tsx';
import { cacheInReach, nearestSupply, outpostAt } from '../../sim/world/outposts.ts';
import { areaParams, cachedMap, mapOf } from '../../sim/tactical/area.ts';
import { cellsWithin } from '../../sim/world/grid.ts';
import type { TacticalMap } from '../../gen/index.ts';
import { logText } from '../command/format.ts';
import { interactionAt, nearestHideout } from '../../sim/colony/encounters.ts';
import { playerAtHome } from '../../sim/colony/morale.ts';
import { hasFlag } from '../../sim/research/modifiers.ts';
import { endingStats } from '../../sim/research/victory.ts';
import { observe } from '../../sim/tactical/observe.ts';
import { ZOMBIES } from '../../data/zombies.ts';
import { tk } from '../command/format.ts';

interface ModeProps {
  state: GameState;
  actions: UiActions;
  /** Static map (null until loaded). */
  grid: StaticGrid | null;
}

/** Controls listed in the pause menu (07b: includes the keyboard-only way to aim and shoot). */
const HELP_KEYS: readonly TextKey[] = ['help.move', 'help.look', 'help.scope', 'help.fire', 'help.breath', 'help.zoom', 'help.zero', 'help.stance', 'help.reload', 'help.knife', 'help.interact', 'help.resupply', 'help.layers', 'help.time', 'help.menu'];

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

/** The latest log line, shown for a few game minutes on the tactical HUD. */
function Toast({ state, grid }: { state: GameState; grid: StaticGrid | null }) {
  const last = state.colony.log[state.colony.log.length - 1];
  if (!last) return null;
  const age = state.time.day * 1440 + state.time.minute - (last.day * 1440 + last.minute);
  if (age < 0 || age > 8) return null;
  return <div class="toast" data-testid="hud-toast" data-kind={last.kind}>{logText(last, grid)}</div>;
}

export function TacticalLayer({ state, grid }: ModeProps) {
  const p = state.player;
  const aim = p.aim;
  const w = p.weapon;
  const def = weaponOf(state);
  const heading = Math.round(headingDeg(p.yaw)) % 360;
  const point = COMPASS[Math.round(heading / 45) % 8]!;
  const stamina = Math.round((p.stamina / TACTICAL.player.staminaMax) * 100);
  const hp = Math.max(0, Math.round((p.hp / BALANCE.player.hp) * 100));
  const scoped = aim.scopeT > 0.5;
  const dead = aim.deadT > 0;
  const ears = nearestEars(state);
  const reach = corpseInReach(state);
  const wind = windOf(state);
  const windSpeed = Math.hypot(wind[0], wind[1]);
  const act = dead ? null : interactionAt(state);
  const someone = dead || act ? null : nearestHideout(state);
  // First steps (07b): somebody is willing to join but nobody has been hired yet — say where to do that.
  const hireHint = !dead && !state.flags.range && state.colony.candidates.length > 0 && state.colony.survivors.length === 0;
  // 07c: where to get ammunition, when it cannot be had right here.
  // Caches (07c) in this area and the neighbouring ones whose maps are made.
  const mapOfCell = (cell: number): TacticalMap | null => (cell === p.cell ? mapOf(state) : grid ? (() => {
    const params = areaParams(state, grid, cell);
    return params ? cachedMap(params) : null;
  })() : null);
  const nearCells = grid ? cellsWithin(grid, p.cell, 1) : [];
  const supplyAt = dead || state.flags.range || state.world.travel ? null : nearestSupply(state, TACTICAL.size, mapOfCell, grid, nearCells);
  const cache = dead || playerAtHome(state) ? null : cacheInReach(state, grid, mapOf(state));
  const post = playerAtHome(state) || state.world.travel ? undefined : outpostAt(state, p.cell);
  const supply = playerAtHome(state) ? state.colony.stock.ammo : post ? post.ammo : (cache?.left ?? 0);
  const canResupply = !dead && supply >= 1 && (p.inv.ammo ?? 0) < BALANCE.player.maxAmmo;
  // Rangefinder (W6a) and observation records (S2): what the reticle rests on.
  const rangefinder = scoped && !dead && hasFlag(state, 'scope.rangefinder');
  const records = scoped && !dead && hasFlag(state, 'intel.zombies');
  const seen = rangefinder || records ? observe(state) : null;
  const busy = w.reloadT > 0 ? t('hud.reloading') : w.boltT > 0 ? t('hud.bolt') : w.mag === 0 ? t((p.inv.ammo ?? 0) > 0 ? 'hud.empty' : 'hud.noAmmo') : '';
  return (
    <div class={`mode-layer tactical${scoped ? ' scoped' : ''}`} data-testid="mode-tactical">
      <div class="compass" data-testid="hud-compass" data-heading={heading}>
        <span class="compass-point">{t(`compass.${point}` as TextKey)}</span>
        <span class="compass-deg">{String(heading).padStart(3, '0')}°</span>
      </div>
      {aim.hurtT > 0 && <div class="hurt" style={{ opacity: Math.min(1, aim.hurtT) * 0.8 }} />}
      {scoped && (
        <div class="breath" title={t('hud.breath')} data-testid="hud-breath" data-locked={aim.breathLock > 0}>
          <span style={{ height: `${Math.round(p.breath * 100)}%` }} />
        </div>
      )}
      {reach && !dead && (
        <div class="interact" data-testid="hud-interact">
          <span>{t('hud.takeEars')}</span>
          <span class="bar"><span style={{ width: `${Math.round((aim.interactT / BALANCE.combat.ears.seconds) * 100)}%` }} /></span>
        </div>
      )}
      {act && !reach && (
        <div class="interact" data-testid="hud-act" data-kind={act.kind}>
          <span>{t(act.kind === 'talk' ? 'hud.talk' : 'hud.search')}</span>
        </div>
      )}
      {someone && (
        <div class={`ear-hint${ears && !reach ? ' second' : ''}`} data-testid="hud-someone" data-dir={someone.dir}>
          <span class="arrow" style={{ transform: `rotate(${(-someone.turn).toFixed(2)}rad)` }}>▲</span>
          <span>{t('hud.someone', { dir: t(`compass.${someone.dir}` as TextKey), m: Math.round(someone.dist) })}</span>
        </div>
      )}
      {supplyAt && (
        <div class="supply-hint" data-testid="hud-supply" data-dir={supplyAt.dir} data-kind={supplyAt.point.kind}>
          <span class="arrow" style={{ transform: `rotate(${(-supplyAt.turn).toFixed(2)}rad)` }}>▲</span>
          <span>{supplyAt.point.kind === 'cache' ? t('hud.supplyCache', {
            dir: t(`compass.${supplyAt.dir}` as TextKey),
            dist: supplyAt.dist < 1000 ? `${Math.max(1, Math.round(supplyAt.dist / 10) * 10)}m` : `${(supplyAt.dist / 1000).toFixed(1)}km`,
            n: supplyAt.point.ammo,
          }) : t(supplyAt.point.ammo > 0 ? 'hud.supply' : 'hud.supplyNone', {
            name: supplyAt.point.kind === 'home' ? t('world.home') : t(`world.outpost.tier.${outpostAt(state, supplyAt.point.cell)?.tier ?? 1}` as TextKey),
            dir: t(`compass.${supplyAt.dir}` as TextKey),
            dist: supplyAt.dist < 1000 ? `${Math.round(supplyAt.dist / 10) * 10}m` : `${(supplyAt.dist / 1000).toFixed(1)}km`,
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
      <Toast state={state} grid={grid} />
      {ears && !reach && !dead && (
        <div class="ear-hint" data-testid="hud-earhint">
          <span class="arrow" style={{ transform: `rotate(${(-ears.turn).toFixed(2)}rad)` }}>▲</span>
          <span>{t('hud.earsAt', { m: Math.round(ears.dist) })}</span>
        </div>
      )}
      <div class="stance-box">
        <span class="hp" title={t('hud.hp')} data-testid="hud-hp" data-hp={Math.round(p.hp)}>
          <span style={{ width: `${hp}%` }} />
        </span>
        <span class="stance" data-testid="hud-stance" data-stance={p.stance}>
          {t(`stance.${p.stance}` as TextKey)}
          {p.infectedUntil && <span class="infected"> {t('hud.infected')}</span>}
        </span>
        <span class="stamina" title={t('hud.stamina')}><span style={{ width: `${stamina}%` }} /></span>
      </div>
      <div class="weapon-box" data-testid="hud-weapon">
        <span class="ammo" data-testid="hud-ammo" data-mag={w.mag} data-ammo={p.inv.ammo ?? 0}>
          <b>{w.mag}</b> / {p.inv.ammo ?? 0}
        </span>
        <span class="busy">{busy}</span>
        <span data-testid="hud-zero" data-zero={zeroDistance(state)}>{t('hud.zero', { m: zeroDistance(state) })}</span>
        <span data-testid="hud-zoom">{t('hud.zoom', { x: w.zoom.toFixed(1) })}</span>
        {windSpeed > 0.05 && <span>{t('hud.wind', { v: windSpeed.toFixed(1), deg: Math.round(headingDeg(Math.atan2(-wind[0], -wind[1]))) })}</span>}
        <span class="ears" data-testid="hud-ears" data-ears={p.inv.ears ?? 0}>{t('hud.ears', { n: p.inv.ears ?? 0 })}</span>
        {canResupply && <span class="resupply" data-testid="hud-resupply" data-cache={cache && !post ? 'true' : 'false'}>{cache && !post ? t('hud.cache', { n: cache.left }) : t('hud.resupply', { n: Math.floor(supply) })}</span>}
        <span class="mag-size sr-only">{def.magSize}</span>
      </div>
      {dead && (
        <div class="death" data-testid="hud-death">
          <div class="panel">{t('hud.dead')}</div>
        </div>
      )}
      <div class="hint">
        {state.flags.range === true && <p>{t('tactical.rangeHint')}</p>}
        <p>{t('tactical.clickToAim')}</p>
        <p>{t('tactical.keysOnly')}</p>
      </div>
    </div>
  );
}

/** Shown while the operation area of the current cell is being generated. */
export function AreaLoading() {
  return (
    <div class="mode-layer loading" data-testid="area-loading">
      <div class="panel">{t('tactical.loading')}</div>
    </div>
  );
}

export function CommandLayer(props: ModeProps) {
  // The build tool is shared by the palette in the panel and the sheet over the 3D view (06).
  const [tool, setTool] = useState<BuildTool>(NO_TOOL);
  return (
    <div class="mode-layer command" data-testid="mode-command">
      <BuildGround state={props.state} actions={props.actions} tool={tool} setTool={setTool} />
      <CommandPanel {...props} tool={tool} setTool={setTool} />
    </div>
  );
}

/** The game is lost (the player died with nobody left in the colony). */
export function DefeatOverlay({ state, actions }: ModeProps) {
  return (
    <div class="mode-layer menu defeat" data-testid="defeat">
      <div class="panel menu-panel">
        <h2>{t('hud.defeat')}</h2>
        <p data-testid="defeat-lead">{t(state.build.structures.some((b) => b.def === 'hq' && b.ruinUntil !== undefined) ? 'hud.defeatHq' : 'hud.defeatLead')}</p>
        <p class="status">{t('hud.defeatDays', { day: state.time.day })}</p>
        <StatList state={state} defeat />
        <button class="primary" onClick={() => actions.quitToTitle()}>{t('menu.toTitle')}</button>
      </div>
    </div>
  );
}

/** The record of a game: shown on the ending and on the defeat screen. */
function StatList({ state, defeat }: { state: GameState; defeat?: boolean }) {
  const s = endingStats(state);
  return (
    <ul class="stat-list" data-testid="end-stats">
      <li>{defeat ? t('defeat.stats.days', { n: s.days }) : t('ending.days', { n: s.days, day: s.day })}</li>
      <li>{t('ending.kills', { n: s.kills })}</li>
      <li>{t('ending.headshots', { pct: Math.round(s.headshotRate * 100), shots: s.shots })}</li>
      <li>{t('ending.survivors', { n: s.survivors })}</li>
      <li>{t('ending.lost', { n: s.lost })}</li>
      <li>{t('ending.outposts', { n: s.outposts })}</li>
      <li>{t('ending.techs', { n: s.techs })}</li>
    </ul>
  );
}

/** The nation has been declared (07). The goal technology names the ending; the game goes on afterwards. */
export function EndingOverlay({ state, actions }: ModeProps) {
  const v = state.research.victory!;
  return (
    <div class="mode-layer menu ending" data-testid="ending" data-tech={v.tech}>
      <div class="panel menu-panel">
        <h2>{t('ending.title')}</h2>
        <p class="status">{tk(`tech.${v.tech}`)}</p>
        <p data-testid="ending-text">{tk(`ending.${v.tech}`)}</p>
        <h3>{t('ending.stats')}</h3>
        <StatList state={state} />
        <button class="primary" data-testid="ending-continue" onClick={() => actions.dispatch({ type: 'dismissEnding' })}>{t('ending.continue')}</button>
        <button onClick={() => actions.quitToTitle()}>{t('menu.toTitle')}</button>
      </div>
    </div>
  );
}

export function WorldLayer({ state, actions, grid }: ModeProps) {
  return <WorldMap state={state} grid={grid} actions={actions} />;
}

export function MenuOverlay({ state, actions }: ModeProps) {
  const range = state.flags.range === true;
  const [message, setMessage] = useState('');
  const save = (slot: string) => {
    void actions.saveSlot(slot).then((ok) => setMessage(t(ok ? 'menu.saved' : 'menu.saveFailed')));
  };
  const slots = Array.from({ length: BALANCE.save.manualSlots }, (_, i) => `slot${i + 1}`);

  return (
    <div class="mode-layer menu" data-testid="mode-menu">
      <div class="panel menu-panel">
        <h2>{t('menu.title')}</h2>
        <button class="primary" data-testid="menu-resume" onClick={() => actions.toggleMode('menu')}>
          {t('menu.resume')}
        </button>
        {!range && (
          <div class="row">
            <span class="label">{t('menu.save')}</span>
            {slots.map((slot) => (
              <button key={slot} class="chip" data-testid={`save-${slot}`} onClick={() => save(slot)}>
                {slotLabel(slot)}
              </button>
            ))}
          </div>
        )}
        <p class="status" data-testid="menu-status">{message}</p>
        {/* Firing range (07b): from a game it is a detour — the game waits and is resumed afterwards. */}
        {!range && <button data-testid="menu-range" onClick={() => actions.openRange()}>{t('menu.range')}</button>}
        {range && state.flags.rangeReturn === true && <button data-testid="menu-leave-range" onClick={() => actions.leaveRange()}>{t('menu.leaveRange')}</button>}
        <button data-testid="menu-title" onClick={() => actions.quitToTitle()}>{t('menu.toTitle')}</button>
        <h3>{t('help.title')}</h3>
        <ul class="help" data-testid="menu-help">
          {HELP_KEYS.map((k) => <li key={k}>{t(k)}</li>)}
        </ul>
      </div>
    </div>
  );
}
