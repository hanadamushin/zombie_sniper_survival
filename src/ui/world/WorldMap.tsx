// Strategic layer: the map of Japan during the game. Reads GameState; the only thing it sends back
// is the `travel` command.

import { useMemo, useState } from 'preact/hooks';
import type { CellId, GameState, StaticGrid } from '../../core/types.ts';
import { dangerOf, isCleared } from '../../sim/world/derive.ts';
import { findRoute, travelFactor, travelMinutesLeft } from '../../sim/world/travel.ts';
import { forecastInfection } from '../../sim/research/forecast.ts';
import { hasFlag } from '../../sim/research/modifiers.ts';
import { BUILD } from '../../data/buildings.ts';
import { isFit } from '../../sim/colony/survivors.ts';
import { foundError, garrisonOf, isStation, outpostAt, outpostDefense, upgradeError } from '../../sim/world/outposts.ts';
import { costText } from '../command/build.tsx';
import { tk } from '../command/format.ts';
import { t, type TextKey } from '../i18n/ja.ts';
import type { UiActions } from '../store.ts';
import { cellName, fmt, formatDuration, intelOf, knownCount, roughly, zBand, zBandValue } from './info.ts';
import { MapCanvas, type MapFocus, type MapMarker } from './MapCanvas.tsx';
import { legendGradient, lootColor, popColor, UNKNOWN, zColor } from './palette.ts';

type ViewMode = 'z' | 'loot' | 'pop';
const VIEWS: readonly ViewMode[] = ['z', 'loot', 'pop'];

interface Props {
  state: GameState;
  grid: StaticGrid | null;
  actions: UiActions;
}

export function WorldMap({ state, grid, actions }: Props) {
  const [mode, setMode] = useState<ViewMode>('z');
  const [hover, setHover] = useState<CellId | null>(null);
  const [forecastOn, setForecast] = useState(false);
  const [selected, setSelected] = useState<CellId | null>(null);
  const [focus, setFocus] = useState<MapFocus>(() => ({ key: 'start', cell: state.player.cell, scale: 14 }));

  const here = state.player.cell;
  const travel = state.world.travel;
  const route = useMemo(
    () => (grid && selected !== null && selected !== here && !travel ? findRoute(grid, here, selected) : null),
    [grid, selected, here, travel],
  );
  // Fast travel (06): only between the base and outposts.
  const stations = state.world.outposts.length;
  const fastRoute = useMemo(
    () => (grid && selected !== null && selected !== here && !travel && isStation(state, here) && isStation(state, selected) ? findRoute(grid, here, selected, true) : null),
    // (`state` is mutated in place; the station count stands in for it)
    [grid, selected, here, travel, stations],
  );

  if (!grid || state.world.gridW !== grid.gridW) return <div class="mode-layer world" data-testid="mode-world" />;
  const cells = state.world.cells;
  // Epidemiological survey (S7a): the zombie view can show where they will be in a week.
  const canForecast = hasFlag(state, 'map.forecast');
  const forecast = canForecast && forecastOn && mode === 'z' ? forecastInfection(state, grid) : null;

  const paint = (id: CellId): string => {
    const intel = cells.intel[id] ?? 0;
    if (mode === 'pop') return popColor(grid.cells[id]!.pop0);
    if (mode === 'loot') return intel === 0 ? UNKNOWN : lootColor(intel === 1 ? Math.round(cells.loot[id]! * 4) / 4 : cells.loot[id]!);
    const z = forecast ? forecast.Z[id]! : cells.Z[id]!;
    return zColor(intel >= 2 ? z : intel === 1 ? roughly(z) : zBandValue(z));
  };

  const markers: MapMarker[] = [];
  if (state.world.homeCell !== null && state.world.homeCell !== here) markers.push({ cell: state.world.homeCell, kind: 'home', label: t('world.home') });
  for (const o of state.world.outposts) if (o.cell !== here) markers.push({ cell: o.cell, kind: 'outpost', label: t(`world.outpost.tier.${o.tier}` as TextKey) });
  if (selected !== null && selected !== here) markers.push({ cell: selected, kind: 'target' });
  if (travel) markers.push({ cell: travel.to, kind: 'target' });
  markers.push({ cell: here, kind: 'player', label: t('world.here') });

  const shown = hover ?? selected ?? here;
  const info = grid.cells[shown]!;
  const intel = intelOf(state, shown);
  const z = cells.Z[shown]!;
  const hub = info.hubId !== undefined ? grid.hubs[info.hubId] : undefined;
  const go = (fast = false): void => {
    if (selected === null) return;
    actions.dispatch(fast ? { type: 'travel', to: selected, fast: true } : { type: 'travel', to: selected });
    setSelected(null);
  };
  const sea = grid.seaLinks?.find((l) => l.a === shown || l.b === shown);
  const outpost = outpostAt(state, shown);
  const O = BUILD.outpost;
  // Founding is offered for the selected cell (or the one the player stands in).
  const site = selected ?? here;
  const canFoundHere = site === shown && !outpost && shown !== state.world.homeCell;
  const foundReason = canFoundHere ? foundError(state, grid, shown) : null;
  const upReason = outpost ? upgradeError(state, outpost) : null;
  const nextTier = outpost && outpost.tier < 3 ? (O.tiers as readonly (typeof O.tiers)[number][])[outpost.tier]! : null;
  const free = state.colony.survivors.filter(isFit);

  return (
    <div class="mode-layer world world-map" data-testid="mode-world">
      <MapCanvas
        grid={grid}
        paint={paint}
        markers={markers}
        path={travel ? travel.path.slice(Math.floor(travel.progress)) : route?.path}
        focus={focus}
        labels
        onHover={setHover}
        onPick={(cell) => !travel && setSelected(cell === here ? null : cell)}
      />

      <div class="map-tools panel">
        <div class="row" role="group" aria-label={t('world.view.label')}>
          {VIEWS.map((v) => (
            <button key={v} class={v === mode ? 'chip active' : 'chip'} data-testid={`view-${v}`} onClick={() => setMode(v)}>
              {t(`world.view.${v}` as TextKey)}
            </button>
          ))}
          {canForecast && mode === 'z' && (
            <button class={forecastOn ? 'chip active' : 'chip'} data-testid="view-forecast" onClick={() => setForecast(!forecastOn)}>{t('world.forecast')}</button>
          )}
        </div>
        <div class="legend">
          <span>{t('world.legend.low')}</span>
          <span class="legend-bar" style={{ background: legendGradient(mode) }} />
          <span>{t('world.legend.high')}</span>
        </div>
        <div class="row">
          <button class="chip" onClick={() => setFocus({ key: `fit${Date.now()}` })}>{t('world.fit')}</button>
          <button class="chip" onClick={() => setFocus({ key: `here${Date.now()}`, cell: here, scale: 14 })}>{t('world.locate')}</button>
        </div>
      </div>

      <div class="map-info panel" data-testid="map-info">
        <h3>
          {cellName(grid, shown)}
          <small>{t(`land.${info.land}` as TextKey)}</small>
        </h3>
        <dl>
          <dt>{t('world.z')}</dt>
          <dd data-testid="info-z">
            {intel === 0 ? t(zBand(z)) : knownCount(z, intel, 'world.bodies')}
            {intel >= 2 && isCleared(z) ? `（${t('world.cleared')}）` : ''}
            {forecast ? <small data-testid="info-forecast"> {t('world.forecastNote', { day: forecast.forDay, z: knownCount(forecast.Z[shown]!, Math.max(1, intel), 'world.bodies') })}</small> : null}
          </dd>
          <dt>{t('world.h')}</dt>
          <dd>{knownCount(cells.H[shown]!, intel, 'world.people')}</dd>
          <dt>{t('world.loot')}</dt>
          <dd>{intel === 0 ? t('world.unknown') : `${Math.round((intel === 1 ? Math.round(cells.loot[shown]! * 4) / 4 : cells.loot[shown]!) * 100)}%`}</dd>
          <dt>{t('world.danger')}</dt>
          <dd>{intel === 0 ? t('world.unknown') : `${Math.round(dangerOf(intel === 1 ? roughly(z) : z) * 100)}%`}</dd>
          <dt>{t('world.pop0')}</dt>
          <dd>{t('world.people', { n: fmt(info.pop0) })}</dd>
          <dt>{t('world.intel')}</dt>
          <dd>{t(`world.intel.${intel}` as TextKey)}</dd>
          {shown === state.world.homeCell && (
            <>
              <dt>{t('world.horde')}</dt>
              <dd>{fmt(state.world.hordeMeter)}</dd>
            </>
          )}
        </dl>
        {hub && <p class="help">{t('world.hub', { name: hub.name })}</p>}
        {sea && <p class="help">{t('world.sea', { name: sea.name })}</p>}

        {outpost && (
          <div class="outpost" data-testid="outpost-info" data-tier={outpost.tier} data-ammo={outpost.ammo}>
            <b>{t('world.outpost')}</b>
            <span>
              {t('world.outpost.info', { tier: t(`world.outpost.tier.${outpost.tier}` as TextKey), ammo: Math.floor(outpost.ammo), cap: O.tiers[outpost.tier - 1]!.ammoCap, n: outpost.garrison.length, def: Math.round(outpostDefense(state, outpost)) })}
            </span>
            {outpost.convoy && <span class="help">{t('world.outpost.convoy', { day: outpost.convoy.day, ammo: outpost.convoy.ammo })}</span>}
            {garrisonOf(state, outpost).map((s) => (
              <span class="who" key={s.id}>
                {s.name}
                <button class="chip" onClick={() => actions.dispatch({ type: 'assignGarrison', survivor: s.id, outpost: null })}>{t('world.outpost.recall')}</button>
              </span>
            ))}
            {free.length > 0 && (
              <select
                data-testid="outpost-post"
                value=""
                onChange={(e) => {
                  const id = Number((e.target as HTMLSelectElement).value);
                  if (id) actions.dispatch({ type: 'assignGarrison', survivor: id, outpost: outpost.id });
                }}
              >
                <option value="">{t('world.outpost.pick')}</option>
                {free.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}（{t('world.outpost.post')}）</option>
                ))}
              </select>
            )}
            {nextTier && (
              <button data-testid="outpost-upgrade" disabled={upReason !== null} title={upReason ? tk(`reject.${upReason}`) : ''} onClick={() => actions.dispatch({ type: 'upgradeOutpost', id: outpost.id })}>
                {t('world.outpost.upgrade', { tier: t(`world.outpost.tier.${outpost.tier + 1}` as TextKey), ears: nextTier.ears, items: costText(nextTier.cost), n: nextTier.garrison })}
              </button>
            )}
            {upReason && nextTier && <span class="help">{tk(`reject.${upReason}`)}</span>}
          </div>
        )}
        {canFoundHere && (
          <div class="outpost">
            <button data-testid="outpost-found" disabled={foundReason !== null} onClick={() => actions.dispatch({ type: 'foundOutpost', cell: shown })}>
              {t('world.outpost.found', { ears: O.tiers[0].ears, items: costText(O.tiers[0].cost) })}
            </button>
            {foundReason && <span class="help" data-testid="outpost-reason">{tk(`reject.${foundReason}`)}</span>}
          </div>
        )}

        {travel ? (
          <p class="status" data-testid="travel-status">
            {t('world.travelling', { name: cellName(grid, travel.to), time: formatDuration(travelMinutesLeft(state, grid)) })}
          </p>
        ) : selected !== null && selected !== here ? (
          <div class="route">
            {route ? (
              <>
                <p class="status" data-testid="route-info">{t('world.route', { cells: route.path.length - 1, time: formatDuration(route.minutes * travelFactor(state)) })}</p>
                <button class="primary" data-testid="travel-go" onClick={() => go()}>{t('world.go')}</button>
                {fastRoute && <button data-testid="travel-fast" onClick={() => go(true)}>{t('world.fast', { time: formatDuration(fastRoute.minutes * travelFactor(state, true)) })}</button>}
              </>
            ) : (
              <p class="error" data-testid="route-info">{t('world.noRoute')}</p>
            )}
            <button onClick={() => setSelected(null)}>{t('world.cancel')}</button>
          </div>
        ) : (
          <p class="help">{t('world.hint')}</p>
        )}
      </div>
    </div>
  );
}
