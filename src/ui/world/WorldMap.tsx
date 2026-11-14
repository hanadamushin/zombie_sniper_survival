// Strategic layer: the map of Japan during the game. Reads GameState; the only thing it sends back
// is the `travel` command.

import { useMemo, useState } from 'preact/hooks';
import type { CellId, GameState, StaticGrid } from '../../core/types.ts';
import { dangerOf, isCleared } from '../../sim/world/derive.ts';
import { findRoute, travelMinutesLeft } from '../../sim/world/travel.ts';
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
  const [selected, setSelected] = useState<CellId | null>(null);
  const [focus, setFocus] = useState<MapFocus>(() => ({ key: 'start', cell: state.player.cell, scale: 14 }));

  const here = state.player.cell;
  const travel = state.world.travel;
  const route = useMemo(
    () => (grid && selected !== null && selected !== here && !travel ? findRoute(grid, here, selected) : null),
    [grid, selected, here, travel],
  );

  if (!grid || state.world.gridW !== grid.gridW) return <div class="mode-layer world" data-testid="mode-world" />;
  const cells = state.world.cells;

  const paint = (id: CellId): string => {
    const intel = cells.intel[id] ?? 0;
    if (mode === 'pop') return popColor(grid.cells[id]!.pop0);
    if (mode === 'loot') return intel === 0 ? UNKNOWN : lootColor(intel === 1 ? Math.round(cells.loot[id]! * 4) / 4 : cells.loot[id]!);
    const z = cells.Z[id]!;
    return zColor(intel >= 2 ? z : intel === 1 ? roughly(z) : zBandValue(z));
  };

  const markers: MapMarker[] = [];
  if (state.world.homeCell !== null && state.world.homeCell !== here) markers.push({ cell: state.world.homeCell, kind: 'home', label: t('world.home') });
  if (selected !== null && selected !== here) markers.push({ cell: selected, kind: 'target' });
  if (travel) markers.push({ cell: travel.to, kind: 'target' });
  markers.push({ cell: here, kind: 'player', label: t('world.here') });

  const shown = hover ?? selected ?? here;
  const info = grid.cells[shown]!;
  const intel = intelOf(state, shown);
  const z = cells.Z[shown]!;
  const hub = info.hubId !== undefined ? grid.hubs[info.hubId] : undefined;
  const go = (): void => {
    if (selected === null) return;
    actions.dispatch({ type: 'travel', to: selected });
    setSelected(null);
  };

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

        {travel ? (
          <p class="status" data-testid="travel-status">
            {t('world.travelling', { name: cellName(grid, travel.to), time: formatDuration(travelMinutesLeft(state, grid)) })}
          </p>
        ) : selected !== null && selected !== here ? (
          <div class="route">
            {route ? (
              <>
                <p class="status" data-testid="route-info">{t('world.route', { cells: route.path.length - 1, time: formatDuration(route.minutes) })}</p>
                <button class="primary" data-testid="travel-go" onClick={go}>{t('world.go')}</button>
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
