// Opening: timelapse of the outbreak (days 0..90, from the bundled snapshots), then the choice
// between three start locations.

import { useEffect, useMemo, useState } from 'preact/hooks';
import type { CellId, StaticGrid } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { dangerOf } from '../../sim/world/derive.ts';
import { dequantizeZ } from '../../sim/world/scenario.ts';
import { t, type TextKey } from '../i18n/ja.ts';
import type { IntroData, UiActions } from '../store.ts';
import { cellName, fmt, roughly } from './info.ts';
import { MapCanvas, type MapFocus, type MapMarker } from './MapCanvas.tsx';
import { zColorQ } from './palette.ts';

/** Real milliseconds per simulated day. */
const MS_PER_DAY = 140;
const HOLD_MS = 900;

export function Intro({ intro, grid, actions }: { intro: IntroData; grid: StaticGrid; actions: UiActions }) {
  const { scenario, candidates } = intro;
  const n = grid.landIds.length;
  const [day, setDay] = useState(0);
  const [phase, setPhase] = useState<'play' | 'choose'>('play');
  const [picked, setPicked] = useState(0);
  const [focus, setFocus] = useState<MapFocus>({ key: 'fit' });

  /** Cell id -> index into the land-ordered scenario arrays. */
  const landIndex = useMemo(() => {
    const index = new Int32Array(grid.gridW * grid.gridH).fill(-1);
    grid.landIds.forEach((id, i) => (index[id] = i));
    return index;
  }, [grid]);

  useEffect(() => {
    if (phase !== 'play') return;
    const started = performance.now() - day * MS_PER_DAY;
    let raf = 0;
    const tick = (now: number): void => {
      const elapsed = now - started;
      const d = Math.min(scenario.days, Math.floor(elapsed / MS_PER_DAY));
      setDay(d);
      if (elapsed >= scenario.days * MS_PER_DAY + HOLD_MS) setPhase('choose');
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `day` is only the starting point of a (re)play.
  }, [phase, scenario]);

  const shownDay = phase === 'choose' ? scenario.days : day;
  const row = shownDay * n;
  const paint = (id: CellId): string => zColorQ(scenario.snapshots[row + landIndex[id]!]!);
  const total = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += dequantizeZ(scenario.snapshots[row + i]!);
    return sum;
  }, [scenario, row, n]);

  const markers: MapMarker[] =
    phase === 'play'
      ? scenario.sources.map((hubId) => ({ cell: grid.hubs[hubId]!.cell, kind: 'source' as const, label: shownDay < 25 ? grid.hubs[hubId]!.intl ?? '' : undefined }))
      : candidates.map((c, i) => ({ cell: c.cell, kind: 'candidate' as const, label: String(i + 1), active: i === picked }));

  const pick = (i: number): void => {
    setPicked(i);
    setFocus({ key: `c${i}-${Date.now()}`, cell: candidates[i]!.cell, scale: 9 });
  };
  const replay = (): void => {
    setDay(0);
    setFocus({ key: `fit${Date.now()}` });
    setPhase('play');
  };

  return (
    <div class="intro" data-testid="intro" data-phase={phase}>
      <div class="intro-map">
      <MapCanvas
        grid={grid}
        paint={paint}
        markers={markers}
        focus={focus}
        labels
        testId="intro-map"
        onPick={(cell) => {
          const i = candidates.findIndex((c) => c.cell === cell);
          if (phase === 'choose' && i >= 0) pick(i);
        }}
      />

      <div class="intro-head panel">
        <h2>{phase === 'play' ? t('intro.title') : t('intro.chooseTitle')}</h2>
        <p class="intro-day" data-testid="intro-day">{t('intro.day', { day: shownDay })}</p>
        <p class="help">{t('intro.zombies', { n: fmt(roughly(total, 2)) })}</p>
        <p class="help">{t('intro.sources', { names: scenario.sources.map((h) => grid.hubs[h]!.intl).join('・') })}</p>
        {phase === 'play' ? (
          <button data-testid="intro-skip" onClick={() => setPhase('choose')}>{t('intro.skip')}</button>
        ) : (
          <div class="row">
            <button class="chip" onClick={replay}>{t('intro.replay')}</button>
            <button class="chip" onClick={() => actions.cancelIntro()}>{t('intro.back')}</button>
          </div>
        )}
      </div>
      </div>

      {phase === 'choose' && (
        <div class="intro-choices" data-testid="intro-choices">
          <p class="intro-lead">{t('intro.chooseLead', { day: BALANCE.time.startDay })}</p>
          {candidates.length === 0 && <p class="error">{t('intro.none')}</p>}
          <div class="cards">
            {candidates.map((c, i) => {
              const info = grid.cells[c.cell]!;
              return (
                <div key={c.cell} class={i === picked ? 'panel card active' : 'panel card'} data-testid={`candidate-${i}`} onClick={() => pick(i)}>
                  <h3>
                    <span class="badge">{i + 1}</span>
                    {cellName(grid, c.cell)}
                    <small>{t(`land.${info.land}` as TextKey)}</small>
                  </h3>
                  <dl>
                    <dt>{t('intro.cellZ')}</dt>
                    <dd>{t('world.bodies', { n: fmt(c.z) })}</dd>
                    <dt>{t('intro.nearZ')}</dt>
                    <dd>{t('world.approx', { n: t('world.bodies', { n: fmt(roughly(c.nearbyZ)) }) })}</dd>
                    <dt>{t('intro.nearH')}</dt>
                    <dd>{t('world.approx', { n: t('world.people', { n: fmt(roughly(c.nearbyH)) }) })}</dd>
                    <dt>{t('intro.suburb')}</dt>
                    <dd>{t('intro.cells', { n: c.suburbDistance })}</dd>
                    <dt>{t('world.danger')}</dt>
                    <dd>{Math.round(dangerOf(c.z) * 100)}%</dd>
                  </dl>
                  <button
                    class="primary"
                    data-testid={`start-${i}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.chooseStart(c.cell);
                    }}
                  >
                    {t('intro.start')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
