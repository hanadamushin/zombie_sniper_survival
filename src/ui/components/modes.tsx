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
import { outpostAt } from '../../sim/world/outposts.ts';
import { logText } from '../command/format.ts';
import { interactionAt, nearestHideout } from '../../sim/colony/encounters.ts';
import { playerAtHome } from '../../sim/colony/morale.ts';

interface ModeProps {
  state: GameState;
  actions: UiActions;
  /** Static map (null until loaded). */
  grid: StaticGrid | null;
}

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
  const post = playerAtHome(state) || state.world.travel ? undefined : outpostAt(state, p.cell);
  const supply = playerAtHome(state) ? state.colony.stock.ammo : (post?.ammo ?? 0);
  const canResupply = !dead && supply >= 1 && (p.inv.ammo ?? 0) < BALANCE.player.maxAmmo;
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
      {someone && !ears && (
        <div class="ear-hint" data-testid="hud-someone">
          <span class="arrow" style={{ transform: `rotate(${(-someone.turn).toFixed(2)}rad)` }}>▲</span>
          <span>{t('hud.someone', { m: Math.round(someone.dist) })}</span>
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
        {canResupply && <span class="resupply" data-testid="hud-resupply">{t('hud.resupply', { n: Math.floor(supply) })}</span>}
        <span class="mag-size sr-only">{def.magSize}</span>
      </div>
      {dead && (
        <div class="death" data-testid="hud-death">
          <div class="panel">{t('hud.dead')}</div>
        </div>
      )}
      <p class="hint">{t(state.flags.range ? 'tactical.rangeHint' : 'tactical.clickToAim')}</p>
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
        <button class="primary" onClick={() => actions.quitToTitle()}>{t('menu.toTitle')}</button>
      </div>
    </div>
  );
}

export function WorldLayer({ state, actions, grid }: ModeProps) {
  return <WorldMap state={state} grid={grid} actions={actions} />;
}

export function MenuOverlay({ actions }: ModeProps) {
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
        <div class="row">
          <span class="label">{t('menu.save')}</span>
          {slots.map((slot) => (
            <button key={slot} class="chip" data-testid={`save-${slot}`} onClick={() => save(slot)}>
              {slotLabel(slot)}
            </button>
          ))}
        </div>
        <p class="status" data-testid="menu-status">{message}</p>
        <button data-testid="menu-title" onClick={() => actions.quitToTitle()}>{t('menu.toTitle')}</button>
        <p class="help">{t('help.keys')}</p>
      </div>
    </div>
  );
}
