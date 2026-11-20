// What the player hears and sees for every sim event (08). The type makes this table complete:
// adding an event to core/events.ts without deciding its feedback is a compile error.
// `sound`: the recipe in audio/index.ts. `notice`: how it shows on screen (ui/notify.ts and the HUD).
// `none`: why it has neither (internal, or too frequent to announce one by one).

import type { GameEventType } from '../core/events.ts';

export interface Feedback {
  sound?: string;
  notice?: string;
  none?: string;
}

export const EVENT_FEEDBACK: Record<GameEventType, Feedback> = {
  hourStarted: { none: '時報（オートセーブの契機）' },
  dayStarted: { none: '日付の変化は上部の時計で見える' },
  speedChanged: { notice: '上部バーの速度表示' },
  modeChanged: { sound: '画面の切替音（メニューは開閉音）', notice: '画面そのもの' },
  commandRejected: { sound: '低い警告音', notice: 'トースト「できない: 理由」（雇用・研究・遠征など、プレイヤーが選んだ操作のみ）' },
  shotFired: { sound: '抑制された発砲音＋ボルト操作 3 回＋空薬莢', notice: '銃口の煙・画面の小さな揺れ・弾の薄い軌跡' },
  bulletHit: { sound: '着弾音（距離 ÷ 343 m/s 遅れ、土・木・石・肉で別）', notice: '土煙・破片・血煙（04）' },
  zombieKilled: { sound: 'ヘッドショットの手応え音（プレイヤーの頭部撃破のみ）', notice: '照準の下に「ヘッドショット 312m」。頭部撃破で 0.04〜0.08 秒のヒットストップ。1 体ごとのトーストはなし' },
  earsCollected: { sound: '袋に入れる音', notice: '耳の数字の横に「+2」（続けて拾うとまとめて表示）' },
  playerHurt: { sound: '鈍い打撃音', notice: '画面の縁が赤くなる（毎フレーム）。体力 35% 未満で脈打つ暗い縁' },
  playerDied: { sound: '低い下降音', notice: '暗転と「力尽きた…」' },
  dryFire: { sound: 'カチッ', notice: '弾倉の表示「弾倉が空（R）」' },
  reloadStarted: { sound: '装填の金属音（所要時間に合わせて 6 回）', notice: '「装填中…」' },
  reloadDone: { none: '装填音の最後で足りる' },
  knifeSwing: { sound: '振る音（当たれば鈍い音）' },
  playerInfected: { sound: '低い音', notice: 'トースト（危険）・画面の縁が黄緑・問題欄' },
  playerRevived: { notice: '暗転が明けて画面が戻る（共同体がいれば 3 日後に司令部で）' },
  zombieAlerted: { none: '多すぎるので個別には鳴らさない（追跡中のうめきが増える）' },
  structureDamaged: { sound: '壁を叩く音（本拠のみ、0.18 秒に 1 回まで、位置つき）', notice: '問題欄「壁の損傷」' },
  structureDestroyed: { sound: '崩れる音（位置つき）', notice: 'ログのトースト（危険）・問題欄' },
  structureBuilt: { sound: '木を打つ音＋短い和音', notice: 'ログのトースト' },
  moatBridged: { notice: '問題欄「堀の詰まり」' },
  hordeWarning: { sound: '警鐘 3 回', notice: 'ログのトースト（危険）・上部バーの赤い表示（方角・規模・残り時間）・画面の矢印' },
  hordeArrived: { notice: 'ログのトースト' },
  blueprintPlaced: { sound: 'クリック', notice: '設計図の半透明の箱' },
  structureRemoved: { none: '操作した本人に見えている' },
  raidStarted: { sound: '警鐘（大群は 4 回、夜間接近は 2 回）', notice: 'バナー「大群襲来／夜間接近 ○から」・トースト・上部バー・方角の矢印（留守中は音なし）' },
  raidEnded: { sound: '撃退なら短い和音', notice: 'ログのトースト・上部バーの報告（3 時間）' },
  defenderFired: { sound: '抑制のない銃声（位置つき・距離で遅れる）', notice: '曳光線（06）' },
  survivorHurt: { notice: '生存者タブの状態・問題欄' },
  outpostUpgraded: { notice: 'ログのトースト' },
  outpostSupplied: { none: '戦略地図の駐屯地の弾数で見える' },
  survivorHired: { sound: '短い上昇音', notice: 'ログのトースト' },
  survivorDied: { sound: '低い音', notice: 'ログのトースト（危険）' },
  survivorLeft: { sound: '低い音（小）', notice: 'ログのトースト（危険）' },
  expeditionReturned: { sound: '戸を叩く音 3 回', notice: 'ログのトースト（帰還・収穫・犠牲）' },
  wagesPaid: { sound: '未払いがあれば警告音', notice: '耳の備蓄の「−n」・未払いならトーストと問題欄' },
  candidateFound: { sound: '短い 2 音', notice: 'ログのトースト・「雇用候補が n 人います」の案内' },
  spotSearched: { notice: 'ログのトースト（見つけた物）' },
  expeditionSent: { notice: 'ログのトースト' },
  earsDeposited: { notice: '備蓄の耳の「+n」・ログのトースト' },
  resupplied: { sound: '弾を込める音 2 回', notice: '弾数の表示' },
  foodBought: { notice: '備蓄の食料「+n」と耳「−n」' },
  colonyLog: { notice: 'トースト（重さで色分け）と通知の履歴' },
  techCompleted: { sound: '3 音のチャイム', notice: 'ログのトースト' },
  eraAdvanced: { sound: '5 音の和音', notice: 'バナー「○○期へ」（5 秒）・ログのトースト' },
  victory: { sound: '長い和音', notice: 'エンディング画面' },
  defeat: { sound: '低い下降音', notice: '敗北画面（直前のオートセーブから再開できる）' },
  outpostFounded: { sound: '3 音の和音', notice: 'ログのトースト' },
  outpostLost: { sound: '鐘 1 回＋低い音', notice: 'ログのトースト（危険）' },
  travelStarted: { notice: '戦略地図の移動表示' },
  cellEntered: { notice: 'バナー「地名・土地区分・危険度」（歩いて越えたときも）' },
  travelArrived: { none: 'cellEntered のバナーで足りる' },
  travelEncounter: { none: '効果のない枠（02）' },
  infectionStepped: { none: '日次の内部処理' },
};
