import { useEffect, useState } from 'preact/hooks';
import { AUTO_SLOT, type SaveMeta } from '../../core/save.ts';
import type { Difficulty } from '../../core/types.ts';
import { formatClock, t, type TextKey } from '../i18n/ja.ts';
import type { UiActions } from '../store.ts';

export function slotLabel(slot: string): string {
  return slot === AUTO_SLOT ? t('slot.auto') : t('slot.manual', { n: slot.replace(/\D/g, '') });
}

export function saveSummary(meta: SaveMeta): string {
  return `${t('hud.day', { day: meta.day })} ${formatClock(meta.minute)}`;
}

export function TitleScreen({ actions }: { actions: UiActions }) {
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dataError, setDataError] = useState(false);

  useEffect(() => {
    let alive = true;
    actions.listSaves().then((list) => alive && setSaves(list), () => alive && setSaves([]));
    return () => {
      alive = false;
    };
  }, [actions]);

  const load = (slot: string) => {
    void actions.loadSlot(slot).then((ok) => setError(!ok));
  };
  const newGame = () => {
    setBusy(true);
    setDataError(false);
    void actions.newGame(difficulty).then((ok) => {
      // On success this screen is replaced by the opening.
      if (!ok) {
        setBusy(false);
        setDataError(true);
      }
    });
  };
  const latest = saves?.[0];

  return (
    <div class="title-screen" data-testid="title-screen">
      <div class="title-card">
        <h1>{t('app.title')}</h1>
        <p class="subtitle">{t('app.subtitle')}</p>
        <p class="tagline">{t('title.tagline')}</p>

        <div class="row" role="group" aria-label={t('title.difficulty')}>
          <span class="label">{t('title.difficulty')}</span>
          {([0, 1, 2] as const).map((d) => (
            <button key={d} class={d === difficulty ? 'chip active' : 'chip'} onClick={() => setDifficulty(d)}>
              {t(`difficulty.${d}` as TextKey)}
            </button>
          ))}
        </div>

        <button class="primary" data-testid="new-game" disabled={busy} onClick={newGame}>
          {busy ? t('title.loading') : t('title.newGame')}
        </button>
        {dataError && <p class="error">{t('title.dataFailed')}</p>}
        <button class="primary" data-testid="continue" disabled={!latest} onClick={() => latest && load(latest.slot)}>
          {t('title.continue')}
          {latest ? <small> — {saveSummary(latest)}</small> : saves ? <small> — {t('title.noSave')}</small> : null}
        </button>
        {error && <p class="error">{t('title.loadFailed')}</p>}
        <button data-testid="open-range" onClick={() => actions.openRange()}>
          {t('title.range')}
          <small> — {t('title.rangeNote')}</small>
        </button>

        {saves && saves.length > 0 && (
          <div class="save-list">
            <span class="label">{t('title.saves')}</span>
            {saves.map((m) => (
              <button key={m.slot} class="save-row" onClick={() => load(m.slot)}>
                <span>{slotLabel(m.slot)}</span>
                <span>{saveSummary(m)}</span>
              </button>
            ))}
          </div>
        )}
        <span class="version">{t('title.version')}</span>
      </div>
    </div>
  );
}
