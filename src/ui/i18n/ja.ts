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

  'menu.title': 'メニュー',
  'menu.resume': 'ゲームに戻る',
  'menu.save': 'セーブ',
  'menu.saved': 'セーブしました',
  'menu.saveFailed': 'セーブに失敗しました',
  'menu.toTitle': 'タイトルへ戻る',

  'title.loading': '地図を読み込み中…',
  'title.dataFailed': '地図データを読み込めませんでした',

  'land.urban': '都市',
  'land.suburb': '郊外',
  'land.rural': '田舎',
  'land.forest': '森林',
  'land.mountain': '山地',

  'intro.title': '感染拡大の記録',
  'intro.day': '発生から {day} 日',
  'intro.zombies': '推定ゾンビ数 {n}',
  'intro.sources': '発生源: {names}',
  'intro.skip': 'スキップ',
  'intro.replay': 'もう一度見る',
  'intro.chooseTitle': 'どこから始めるか',
  'intro.chooseLead': '任務で過疎地にいたあなたは、感染を免れた。{day}日目の朝、ここから始まる。',
  'intro.start': 'ここから始める',
  'intro.back': 'タイトルへ',
  'intro.candidate': '候補 {n}',
  'intro.cellZ': 'このセルのゾンビ',
  'intro.nearZ': '周辺のゾンビ',
  'intro.nearH': '周辺の潜伏生存者',
  'intro.suburb': '最寄りの町',
  'intro.cells': '{n} セル先',
  'intro.none': '候補地が見つかりませんでした',

  'world.view.z': 'ゾンビ',
  'world.view.loot': '物資',
  'world.view.pop': '人口（崩壊前）',
  'world.view.label': '表示',
  'world.fit': '全国',
  'world.locate': '現在地',
  'world.here': '現在地',
  'world.home': '本拠',
  'world.near': '{name}付近',
  'world.pop0': '崩壊前人口',
  'world.z': 'ゾンビ',
  'world.h': '潜伏生存者',
  'world.loot': '残存物資',
  'world.danger': '危険度',
  'world.cleared': '掃討済み',
  'world.unknown': '不明',
  'world.approx': '約 {n}',
  'world.band.none': 'ほぼいない見込み',
  'world.band.low': '少ない見込み',
  'world.band.mid': '多い見込み',
  'world.band.high': '非常に多い見込み',
  'world.people': '{n} 人',
  'world.bodies': '{n} 体',
  'world.intel.0': '情報なし',
  'world.intel.1': '概況のみ',
  'world.intel.2': '詳細',
  'world.intel': '情報',
  'world.route': '経路 {cells} セル・{time}',
  'world.noRoute': '陸路では行けません',
  'world.go': 'ここへ移動する',
  'world.cancel': '選択を解除',
  'world.travelling': '移動中 → {name}（残り {time}）',
  'world.hint': 'クリックでセルを選択 / ドラッグで移動 / ホイールで拡大縮小',
  'world.hours': '{h}時間',
  'world.hoursMinutes': '{h}時間{m}分',
  'world.minutes': '{m}分',
  'world.days': '{d}日{h}時間',
  'world.legend.low': '少',
  'world.legend.high': '多',
  'world.hub': '交通拠点: {name}',
  'world.horde': '本拠への流入（累積）',

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
