// All user-facing text lives here (Japanese only). Reference by key: t('title.newGame').
// Later sessions add their own sections; keep keys in English, grouped by screen.

export const ja = {
  'app.title': '耳の国',
  'app.subtitle': 'Zombie Sniper Survival',

  'title.newGame': '新規ゲーム',
  'title.continue': '続きから',
  'title.noSave': 'セーブデータなし',
  'title.difficulty': '難易度',
  'title.saves': 'セーブデータ',
  'title.load': 'ロード',
  'title.loadFailed': 'セーブデータを読み込めませんでした',

  'difficulty.0': '低',
  'difficulty.1': '中',
  'difficulty.2': '高',

  'slot.auto': 'オート',
  'slot.manual': 'スロット {n}',
  'slot.empty': '空き',

  'hud.day': '{day}日目',
  'hud.paused': '一時停止',
  'hud.fps': '{fps} fps',
  'hud.draws': '{n} draw',
  'hud.speed.pause': '一時停止 (Space)',
  'hud.speed.set': '速度 x{n}',

  'mode.tactical': '戦術',
  'mode.command': '指揮',
  'mode.world': '戦略地図',
  'mode.menu': 'メニュー',
  'mode.label': 'モード',

  'tactical.clickToAim': 'クリックで視点操作を開始',
  'command.placeholder': '指揮層（建築・生存者・研究のパネルがここに入ります）',
  'world.placeholder': '戦略地図（日本地図がここに入ります）',

  'menu.title': 'メニュー',
  'menu.resume': 'ゲームに戻る',
  'menu.save': 'セーブ',
  'menu.saved': 'セーブしました',
  'menu.saveFailed': 'セーブに失敗しました',
  'menu.toTitle': 'タイトルへ戻る',

  'help.keys': 'Tab: 指揮 / M: 地図 / Space: 一時停止 / 1・2・3: 速度 / Esc: メニュー',
} as const;

export type TextKey = keyof typeof ja;

/** Look up a text and fill `{name}` placeholders. */
export function t(key: TextKey, params?: Record<string, string | number>): string {
  const text: string = ja[key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export function formatClock(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
