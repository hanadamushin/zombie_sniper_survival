// R0: data sources of the real map (出典). Shown from the title screen and the pause menu.
import { t, type TextKey } from '../i18n/ja.ts';

/** One entry per source; the text lives in ja.ts (credits.<id>.name / .use / .note). */
export const CREDIT_IDS = ['gsiVector', 'gsiDem', 'ksjL03b', 'ksjN03', 'ksjS12', 'ksjC28', 'ksjN02', 'ksjP29', 'ksjP04', 'ksjP05', 'estat', 'naturalEarth'] as const;

export function CreditsPanel({ onClose }: { onClose?: () => void }) {
  return (
    <div class="credits" data-testid="credits">
      <h3>{t('credits.title')}</h3>
      <p class="note">{t('credits.intro')}</p>
      <ul class="credit-list">
        {CREDIT_IDS.map((id) => (
          <li key={id} data-testid={`credit-${id}`}>
            <strong>{t(`credits.${id}.name` as TextKey)}</strong>
            <span>{t(`credits.${id}.use` as TextKey)}</span>
            <small>{t(`credits.${id}.note` as TextKey)}</small>
          </li>
        ))}
      </ul>
      <p class="note">{t('credits.processed')}</p>
      {onClose && (
        <button data-testid="credits-close" onClick={onClose}>
          {t('credits.close')}
        </button>
      )}
    </div>
  );
}
