// Command layer, building: the tool palette (BuildTab) and the invisible sheet over the 3D view
// that turns the mouse into camera moves and blueprints (BuildGround). The cursor and camera live
// in core/view.ts (the renderer draws from it); everything that changes the game is a command.

import { useEffect, useRef } from 'preact/hooks';
import { commandView, panView, rotateView, zoomView, type BuildPreviewTile } from '../../core/view.ts';
import type { GameState, ResourceId, Structure } from '../../core/types.ts';
import { BUILD, BUILDING_LIST, BUILDINGS, footprint, type BuildCategory, type BuildingDef, type Cost } from '../../data/buildings.ts';
import { TACTICAL } from '../../data/tactical.ts';
import { baseCentre, buildRadius, placementError } from '../../sim/build/blueprints.ts';
import { deliveredShare } from '../../sim/build/construction.ts';
import { towers } from '../../sim/build/defense.ts';
import { defOf, isRuin, isUnlocked, maxHp, overlayOf } from '../../sim/build/structures.ts';
import { defenders } from '../../sim/colony/jobs.ts';
import { isFit } from '../../sim/colony/survivors.ts';
import { mapOf } from '../../sim/tactical/area.ts';
import { t, type TextKey } from '../i18n/ja.ts';
import type { UiActions } from '../store.ts';
import { num, tk } from './format.ts';

const TILE = TACTICAL.tile;
const TILES = TACTICAL.size / TACTICAL.tile;

/** What the mouse does on the ground: place `def`, remove what is clicked, or (both off) look around and select. */
export interface BuildTool {
  def: string | null;
  remove: boolean;
  rot: number;
  category: BuildCategory;
  /** Structure picked for the info box. */
  selected: number | null;
}
export const NO_TOOL: BuildTool = { def: null, remove: false, rot: 0, category: 'defense', selected: null };

const CATEGORIES: readonly BuildCategory[] = ['defense', 'housing', 'food', 'work', 'civic'];
/** Kinds laid out in runs by dragging. */
const LINE_KINDS = new Set(['wall', 'moat', 'wire']);

export function costText(cost: Cost): string {
  const parts = (Object.keys(cost) as (keyof Cost)[]).filter((k) => (cost[k] ?? 0) > 0).map((k) => `${tk(`res.${k as ResourceId}`)} ${num(cost[k] ?? 0)}`);
  return parts.length ? parts.join('・') : t('build.free');
}

const atHome = (state: GameState): boolean => mapOf(state)?.params.isHome === true && !state.flags.range;

function structureAt(state: GameState, tx: number, ty: number): Structure | undefined {
  const map = mapOf(state);
  if (!map || tx < 0 || ty < 0 || tx >= TILES || ty >= TILES) return undefined;
  const i = overlayOf(state, map.walk).occ[ty * TILES + tx]!;
  return i > 0 ? state.build.structures[i - 1] : undefined;
}

/** Tiles from a to b moving one step at a time, never diagonally (so walls have no gaps). */
function lineTiles(ax: number, ay: number, bx: number, by: number): [number, number][] {
  const out: [number, number][] = [[ax, ay]];
  let x = ax, y = ay;
  const dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
  let err = dx - dy;
  for (let guard = 0; (x !== bx || y !== by) && guard < 400; guard++) {
    if (err >= 0 && x !== bx) {
      x += Math.sign(bx - x);
      err -= dy;
    } else {
      y += Math.sign(by - y);
      err += dx;
    }
    out.push([x, y]);
  }
  return out;
}

interface Props {
  state: GameState;
  actions: UiActions;
  tool: BuildTool;
  setTool(next: BuildTool): void;
}

/** What a building does, in a few words (the tooltip and the card under the palette). */
export function effectText(d: BuildingDef): string[] {
  const out: string[] = [];
  if (d.kind === 'wall') out.push(t('build.eff.wall', { hp: d.hp }));
  if (d.kind === 'gate') out.push(t('build.eff.gate'));
  if (d.kind === 'moat') out.push(t('build.eff.moat'));
  if (d.kind === 'tower') out.push(t('build.eff.tower'));
  if (d.beds) out.push(t('build.eff.beds', { n: d.beds }));
  if (d.plots) out.push(t('build.eff.plots', { n: d.plots }));
  for (const [job, mul] of Object.entries(d.job ?? {})) out.push(t('build.eff.job', { job: tk(`job.${job}`), n: num(mul ?? 1) }));
  if (d.morale) out.push(t('build.eff.morale', { n: d.morale }));
  if (d.capacity) out.push(t('build.eff.capacity'));
  if (d.fuelPerDay) out.push(t('build.eff.fuel', { n: num(d.fuelPerDay) }));
  const desc = tk(`bld.${d.id}.desc`);
  if (desc !== `bld.${d.id}.desc`) out.unshift(desc);
  return out;
}

function unlockText(d: BuildingDef): string {
  return d.techAny ? d.techAny.map((x) => tk(`tech.${x}`)).join('／') : d.tech ? tk(`tech.${d.tech}`) : '';
}

function BuildTip({ state, def }: { state: GameState; def: BuildingDef }) {
  const open = isUnlocked(def.id, state);
  const [w, d] = def.size;
  return (
    <div class="build-tip" data-testid="build-tip">
      <p><b>{tk(`bld.${def.id}`)}</b> <span class="note">{t('build.tip.size', { w, d })}</span></p>
      <p><span class="k">{t('build.tip.cost')}</span>{costText(def.cost)}・{t('build.work', { n: def.work })}</p>
      {effectText(def).length > 0 && <p><span class="k">{t('build.tip.effect')}</span>{effectText(def).join('・')}</p>}
      {!open && <p class="level-warn"><span class="k">{t('build.tip.unlock')}</span>{unlockText(def)}</p>}
    </div>
  );
}

/** Put the overhead camera over the headquarters (building happens around it). */
function lookAtBase(state: GameState): void {
  const [x, z] = baseCentre(state);
  commandView.x = x;
  commandView.z = z;
}

/** The palette inside the command panel. */
export function BuildTab({ state, actions, tool, setTool }: Props) {
  const home = atHome(state);
  // Opening the palette brings the base into view when the camera is somewhere else.
  useEffect(() => {
    if (!home) return;
    const [x, z] = baseCentre(state);
    if (Math.hypot(commandView.x - x, commandView.z - z) > buildRadius(state) * 0.8) lookAtBase(state);
  }, [home]);
  if (!home) return <p class="note" data-testid="build-away">{t('build.notHome')}</p>;
  const build = state.build;
  const pending = build.structures.filter((s) => s.progress < 1).length;
  const builders = state.colony.survivors.filter((s) => s.job === 'construction' && isFit(s)).length;
  const sel = tool.selected !== null ? build.structures.find((s) => s.id === tool.selected) : undefined;
  const selDef = sel ? defOf(sel) : null;
  return (
    <div class="build-tab" data-testid="build-tab">
      <p class="note" data-testid="build-status" data-pending={pending}>
        {t('build.pending', { n: pending, builders, points: num(state.colony.work.build) })}
        {pending > 0 && builders === 0 ? ` — ${t('build.noBuilders')}` : ''}
      </p>
      <p class="note">{t('build.guards', { n: defenders(state).length, towers: towers(state).length })}</p>
      <div class="actions">
        {CATEGORIES.map((c) => (
          <button key={c} class={c === tool.category ? 'chip active' : 'chip'} data-testid={`build-cat-${c}`} onClick={() => setTool({ ...tool, category: c })}>
            {t(`build.cat.${c}` as TextKey)}
          </button>
        ))}
        <span class="spacer" />
        <button class={tool.remove ? 'chip active' : 'chip'} data-testid="build-remove" onClick={() => setTool({ ...tool, def: null, remove: !tool.remove, selected: null })}>{t('build.remove')}</button>
        <button class="chip" onClick={() => setTool({ ...tool, rot: (tool.rot + 1) & 3 })}>{t('build.rotate')}</button>
        <button class="chip" onClick={() => setTool({ ...tool, def: null, remove: false, selected: null })}>{t('build.none')}</button>
        <button class="chip" data-testid="build-to-base" onClick={() => lookAtBase(state)}>{t('build.toBase')}</button>
      </div>
      <PlaceReason state={state} tool={tool} />
      {tool.def && BUILDINGS[tool.def] && <BuildTip state={state} def={BUILDINGS[tool.def]!} />}
      <div class="build-list">
        {BUILDING_LIST.filter((d) => d.category === tool.category && !d.fixed).map((d) => {
          const open = isUnlocked(d.id, state);
          return (
            <button
              key={d.id}
              class={d.id === tool.def ? 'build-item active' : 'build-item'}
              data-testid={`build-${d.id}`}
              disabled={!open}
              title={[costText(d.cost), ...effectText(d), open ? '' : `${t('build.tip.unlock')}: ${unlockText(d)}`].filter(Boolean).join('\n')}
              onClick={() => setTool({ ...tool, def: d.id === tool.def ? null : d.id, remove: false, selected: null })}
            >
              <b>{tk(`bld.${d.id}`)}</b>
              <small>{open ? costText(d.cost) : t('build.locked', { tech: unlockText(d) })}</small>
              <small>
                {t('build.work', { n: d.work })}
                {d.hp > 0 ? `・${t('build.hp', { n: d.hp })}` : ''}
                {d.beds ? `・${t('build.beds', { n: d.beds })}` : ''}
              </small>
            </button>
          );
        })}
      </div>
      {sel && selDef && (
        <div class="build-info" data-testid="build-info" data-id={sel.id}>
          <b>{t('build.selected', { name: tk(`bld.${sel.def}`) })}</b>
          {sel.progress < 1 ? (
            <span>{t('build.progress', { pct: Math.round(sel.progress * 100), mat: Math.round(deliveredShare(sel, selDef) * 100) })}</span>
          ) : selDef.hp > 0 ? (
            <span>{t('build.durability', { hp: Math.round(sel.hp), max: Math.round(maxHp(state, selDef)) })}</span>
          ) : null}
          {selDef.kind === 'moat' && sel.progress >= 1 && <span>{t('build.moatBodies', { n: Math.floor(sel.corpsesInMoat ?? 0), max: BUILD.moatFill })}</span>}
          <span class="label">{t('build.priority')}</span>
          {([0, 1, 2] as const).map((pr) => (
            <button key={pr} class={pr === sel.priority ? 'chip active' : 'chip'} onClick={() => actions.dispatch({ type: 'setStructurePriority', id: sel.id, priority: pr })}>
              {t(`build.priority.${pr}` as TextKey)}
            </button>
          ))}
          {!selDef.fixed && !isRuin(sel) && (
            <button
              class="chip"
              data-testid="build-cancel"
              onClick={() => {
                actions.dispatch({ type: 'cancelStructure', id: sel.id });
                setTool({ ...tool, selected: null });
              }}
            >
              {t(sel.progress < 1 ? 'build.cancel' : 'build.demolish')}
            </button>
          )}
        </div>
      )}
      <p class="help">{t('build.help')}</p>
    </div>
  );
}

/** Why the blueprint under the cursor cannot go there (the cursor itself only turns red). */
function PlaceReason({ state, tool }: { state: GameState; tool: BuildTool }) {
  const def = tool.def ? BUILDINGS[tool.def] : undefined;
  const at = commandView.cursor;
  if (!def || !at) return null;
  const [w, d] = footprint(def, tool.rot);
  const tx = Math.floor(at[0] / TILE) - Math.floor((w - 1) / 2), ty = Math.floor(at[1] / TILE) - Math.floor((d - 1) / 2);
  const err = placementError(state, mapOf(state), def.id, tx, ty, tool.rot);
  if (!err) {
    const short = (Object.keys(def.cost) as ResourceId[]).filter((r) => (def.cost[r as keyof Cost] ?? 0) > state.colony.stock[r]);
    return short.length > 0 ? <p class="note level-warn" data-testid="build-short">{t('build.short', { list: short.map((r) => tk(`res.${r}`)).join('・') })}</p> : null;
  }
  return <p class="note level-warn" data-testid="build-reason" data-reason={err}>{tk(`build.err.${err}`)}</p>;
}

/** Tiles the tool would cover with the cursor at tile (cx, cy), dragging from `from` when given. */
function previewTiles(state: GameState, def: BuildingDef, rot: number, from: [number, number] | null, cx: number, cy: number): BuildPreviewTile[] {
  const map = mapOf(state);
  const [w, d] = footprint(def, rot);
  const anchor = (x: number, y: number): [number, number] => [x - Math.floor((w - 1) / 2), y - Math.floor((d - 1) / 2)];
  const spots = from && LINE_KINDS.has(def.kind) ? lineTiles(from[0], from[1], cx, cy) : [[cx, cy] as [number, number]];
  return spots.map(([x, y]) => {
    const [tx, ty] = anchor(x, y);
    return { tx, ty, ok: placementError(state, map, def.id, tx, ty, rot) === null };
  });
}

/** Full-screen sheet under the panel: camera control, the build cursor, placing and removing. */
export function BuildGround({ state, actions, tool, setTool }: Props) {
  const latest = useRef({ state, tool, setTool, actions });
  latest.current = { state, tool, setTool, actions };
  const drag = useRef<{ button: number; x: number; y: number; moved: boolean; from: [number, number] | null } | null>(null);
  const last = useRef<[number, number] | null>(null);

  const refresh = (): void => {
    const { state: s, tool: tl } = latest.current;
    const home = atHome(s);
    const at = last.current && commandView.pick ? commandView.pick(last.current[0], last.current[1]) : null;
    commandView.cursor = at;
    commandView.grid = home && (tl.def !== null || tl.remove);
    commandView.preview = null;
    commandView.highlight = tl.selected;
    if (!home || !at) return;
    const tx = Math.floor(at[0] / TILE), ty = Math.floor(at[1] / TILE);
    const def = tl.def ? BUILDINGS[tl.def] : undefined;
    if (def) {
      const from = drag.current?.button === 0 ? drag.current.from : null;
      commandView.preview = { def: def.id, rot: tl.rot, tiles: previewTiles(s, def, tl.rot, from, tx, ty) };
    } else if (tl.remove) {
      const st = structureAt(s, tx, ty);
      commandView.highlight = st && !defOf(st).fixed ? st.id : null;
    }
  };
  // Keep the cursor right when the tool or the game changes under a still mouse.
  useEffect(refresh);

  useEffect(() => {
    const held = new Set<string>();
    const down = (ev: KeyboardEvent): void => {
      const target = ev.target;
      if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const { tool: tl, setTool: set } = latest.current;
      if (ev.code === 'KeyR' && !ev.repeat) set({ ...tl, rot: (tl.rot + 1) & 3 });
      else if (ev.code === 'KeyX') set({ ...tl, def: null, remove: false, selected: null });
      else held.add(ev.code);
    };
    const up = (ev: KeyboardEvent): void => void held.delete(ev.code);
    const timer = window.setInterval(() => {
      if (held.size === 0) return;
      const step = commandView.dist * 0.018;
      const has = (...codes: string[]): boolean => codes.some((c) => held.has(c));
      if (has('KeyW', 'ArrowUp')) panView(0, step);
      if (has('KeyS', 'ArrowDown')) panView(0, -step);
      if (has('KeyA', 'ArrowLeft')) panView(-step, 0);
      if (has('KeyD', 'ArrowRight')) panView(step, 0);
      if (has('KeyQ')) rotateView(-0.03);
      if (has('KeyE')) rotateView(0.03);
      refresh();
    }, 16);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      commandView.preview = null;
      commandView.highlight = null;
      commandView.grid = false;
    };
  }, []);

  const onDown = (ev: PointerEvent): void => {
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    last.current = [ev.clientX, ev.clientY];
    const at = commandView.pick?.(ev.clientX, ev.clientY) ?? null;
    drag.current = { button: ev.button, x: ev.clientX, y: ev.clientY, moved: false, from: at ? [Math.floor(at[0] / TILE), Math.floor(at[1] / TILE)] : null };
    refresh();
  };
  const onMove = (ev: PointerEvent): void => {
    const d = drag.current;
    const { tool: tl } = latest.current;
    if (d) {
      const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      if (d.button === 2 || d.button === 1) {
        rotateView(-(ev.clientX - (last.current?.[0] ?? ev.clientX)) * 0.006);
      } else if (d.button === 0 && !tl.def && !tl.remove && last.current) {
        // Drag the ground: the point under the cursor stays under the cursor.
        const k = (commandView.dist * 1.25) / Math.max(200, window.innerHeight);
        panView(-(ev.clientX - last.current[0]) * k, (ev.clientY - last.current[1]) * k);
      }
    }
    last.current = [ev.clientX, ev.clientY];
    refresh();
  };
  const onUp = (ev: PointerEvent): void => {
    const d = drag.current;
    drag.current = null;
    const { state: s, tool: tl, setTool: set, actions: act } = latest.current;
    if (!d || d.button !== 0 || !atHome(s)) {
      // Right click without dragging puts the tool away.
      if (d && d.button === 2 && !d.moved && (tl.def || tl.remove)) set({ ...tl, def: null, remove: false });
      return refresh();
    }
    const at = commandView.pick?.(ev.clientX, ev.clientY) ?? null;
    if (!at) return refresh();
    const tx = Math.floor(at[0] / TILE), ty = Math.floor(at[1] / TILE);
    const def = tl.def ? BUILDINGS[tl.def] : undefined;
    if (def) {
      for (const tile of previewTiles(s, def, tl.rot, d.from, tx, ty)) if (tile.ok) act.dispatch({ type: 'placeBlueprint', def: def.id, tx: tile.tx, ty: tile.ty, rot: (tl.rot & 3) as 0 | 1 | 2 | 3 });
    } else if (tl.remove) {
      const st = structureAt(s, tx, ty);
      if (st && !defOf(st).fixed) act.dispatch({ type: 'cancelStructure', id: st.id });
    } else if (!d.moved) {
      set({ ...tl, selected: structureAt(s, tx, ty)?.id ?? null });
    }
    refresh();
  };
  const onWheel = (ev: WheelEvent): void => {
    ev.preventDefault();
    zoomView(Math.exp(ev.deltaY * 0.0012));
    refresh();
  };

  return (
    <div
      class="build-ground"
      data-testid="build-ground"
      data-tool={tool.def ?? (tool.remove ? 'remove' : '')}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onWheel={onWheel}
      onContextMenu={(ev) => ev.preventDefault()}
    />
  );
}
