# 進捗・引き継ぎログ

各セッションは **終了時にこのファイルの末尾へ追記** する。次のセッションはまずここを読む。

書式:

```
## <プロンプト番号> <役割名> — <日付>
- 完了したこと:
- 未完了・既知の問題:
- 仕様からの変更点（更新した docs）:
- 次のセッションへの注意:
- 追加した共有型・コマンド・イベント:
```

---

## 00 設計 — 2026-11-14
- 完了したこと: ゲームデザイン、システム仕様、技術ツリー、アーキテクチャ、ロードマップ、役割別プロンプト10本
- 未完了・既知の問題: 実装は未着手。数値はすべて机上の初期値
- 次のセッションへの注意: `prompts/01_foundation.md` から開始

## 01 基盤アーキテクト — 2026-11-14
- 完了したこと: Vite + TS(strict) + Three.js + Preact + Vitest + ESLint の雛形。共有型と `createInitialState`、PRNG、イベントバス、コマンドキュー、`createSim().tick`、時間システム（速度 0/1/3/10、分・時・日の境界）、固定ステップループ、仮シーン（空・地面・時刻で変わる空色）、入力層（Pointer Lock）、Preact UI（タイトル・HUD・モード枠・メニュー）、IndexedDB セーブ（オート＋3スロット、マイグレーション枠）、テスト36件、Playwright スモーク2件。M0 の受け入れ基準はすべて e2e とスクリーンショットで確認済み
- **最初に見るファイル**: `src/sim/index.ts`（tick の順序と差し込み方）→ `src/sim/system.ts`（`System` の契約）→ `src/core/types.ts` / `events.ts` / `commands.ts` → 自分の領域の `src/sim/<領域>/index.ts`。描画は `src/render/index.ts`、UI は `src/ui/components/modes.tsx`
- **システムの追加手順**:
  1. `src/sim/<領域>/index.ts` の `System` に必要なフック（`step` / `minute` / `hour` / `day`）を実装。処理は同じディレクトリのファイルに分割
  2. コマンドは同じ `System` の `commands` にハンドラを書く（型は `core/commands.ts` に定義済み。足りなければ共用体に追加）
  3. 起きたことは `ctx.emit({type: ...})` で通知（型は `core/events.ts`）。数値は `src/data/*.ts`、乱数は `stream(state, '領域.用途')`
  4. 見た目は `renderer.register({id, init, update})`、画面は `ui/components/modes.tsx` の各レイヤーに部品を足し、文言は `ui/i18n/ja.ts`
  5. `tests/` にヘッドレスのテストを足し、`npm run check` → `npm run build` → `npm run e2e`
- 未完了・既知の問題:
  - 仮の地面とカメラ（`render/placeholder.ts`）は 03 が置き換える前提。プレイヤーは動かない（`InputFrame` は sim に届いているが未使用）
  - `StaticGrid` / `StaticCell` は仕様 §2.1 から起こした仮の形。02 が確定させる（`sim.setGrid()` で渡す口だけある）
  - ヘッドレス Chromium ではポインタロック周りを実機ほど検証できていない。Esc でロックが外れたらメニューを開く実装
  - バンドルは three 込みで約 570kB（gzip 148kB）。警告しきい値は 1200kB にしてある
- 仕様からの変更点（更新した docs）:
  - `04_architecture.md`: `time.sub` と `rngStreams` を追加、`System` フック・`applyCommands`・`prevEvents`・SubRenderer・乱数 API を追記、tools は tsx ではなく Node の型ストリップで実行
  - `02_systems_spec.md` §10: 自動セーブの契機にメニューを開いたとき・タブを隠したとき・タイトルへ戻るときを追加
  - プロンプトは「自動セーブは `dayStarted` 時」だが、仕様 §10 に合わせて **06:00 の `hourStarted`** で行っている（`dayStarted` は 00:00 発火）
- 次のセッションへの注意:
  - `src/sim` `src/gen` `src/core` `src/data` は ESLint で three / preact / DOM グローバル / `Math.random` / `Date.now` / `new Date` を禁止（`core/save.ts` のみ例外）
  - `tick` は `state.time.speed` を見ない（速度は main ループが掛ける）。x10 は戦術層では x3 に丸められる
  - 他システムのイベントは `ctx.prevEvents` で次の tick に読む。保存されないので、セーブをまたぐ情報は `GameState` に置く
  - セーブは `packState` で戦術の zombies / corpses / bullets を捨てる。03/04 はロード後にシードと `world.cells` から再構成すること。`GameState` の形を変えたら `STATE_VERSION` を上げて `MIGRATIONS` を書く
  - `window.__game`（`state` / `dispatch` / `sim`）をデバッグと e2e 用に公開している
  - 依存追加: `@playwright/test`（e2e、1.63.0 固定）、`eslint` / `typescript-eslint` / `@eslint/js`、型定義のみ。JSX は Vite 標準の変換で足りるので `@preact/preset-vite` は入れていない
- 追加した共有型・コマンド・イベント:
  - 型: `GameState.rngStreams`, `GameState.time.sub`, `StaticGrid`, `StaticCell`, `InputFrame`, `Difficulty`, `Speed`, `Mode`, `Stance`、ヘルパ `allocId`, `emptyInputFrame`, `continuationFrame`
  - コマンド: §6 記載の14種を型定義。実装済みは `setSpeed`, `setMode` のみ
  - イベント: §6 記載の全種を型定義（ペイロードは `core/events.ts`。フィールド追加可）＋ `speedChanged`, `modeChanged`, `commandRejected`。発火済みは `hourStarted`, `dayStarted`, `speedChanged`, `modeChanged`, `commandRejected`

## 02 地図・感染シミュレーション — 2026-11-14
- 完了したこと:
  - `npm run data`: `public/data/grid.json`（57KB、167×218、陸地 3,885 セル、ハブ 68）と `infection_{0,1,2}.bin`（各 406KB）を生成。ネットワーク不要・決定的
  - `sim/world/infection.ts` の `stepInfection(cells, grid, day, extras, rng)`（1日 約1ms）。ビルド時とゲーム中で共通
  - 世界システム: 毎日 00:00 に感染1ステップ、本拠への流入を `hordeMeter` に累積、`zombieKilled` で現在セルの Z を減算、`travel` コマンドと経路探索・移動
  - 戦略地図 UI（Canvas 2D、ゾンビ／物資／人口の切替、パン・ズーム、ホバー情報、移動先の指定）、オープニングのタイムラプス → 候補3つの選択
  - テスト 15 件追加（決定性、総数の保存、海・山地に拡散しない、同梱データが最新かつゲームへ連続、性能、候補地、移動）。e2e を新しい開始手順に更新し、タイムラプス〜移動のシナリオを追加
  - 受け入れ基準は e2e とスクリーンショット、`tools/preview.ts` の PNG で確認済み
- 未完了・既知の問題:
  - 人口・標高・都道府県境は統計データではなく手書きの表からの合成（都市表は記憶ベースの概数）。県境付近のセルは隣県になっていることがある
  - 移動中の遭遇は `travelEncounter` イベントを出すだけで効果なし。移動中は戦術モードへ切り替えられない（`setMode` を拒否）。到着後の戦術マップ再生成は 03 の担当
  - 島へは渡れない（陸続きのみ）。北海道・四国・九州へも現状は行けない（橋・トンネル・フェリーは未実装）
  - セーブは世界セルを含み約 650KB の JSON（stringify 約1.5ms）。01 時点のセーブ（世界なし）は「読み込めませんでした」になる（`STATE_VERSION` は据え置き）
  - H はゲーム中に減らない（雇用で減らすのは 05）。H が多いセルはゾンビを引き寄せ続ける
- 仕様からの変更点（更新した docs）: `02_systems_spec.md` §1・§2.1・§2.2・§2.4 を実装に合わせて書き直した。主な変更:
  - 人数を整数化し確率的に丸める。β=0.9 → 2.2 だが襲われた人の 38% だけが Z になる（残りは死亡）。土地区分ごとの感染・抵抗係数を追加
  - 田舎・森林は 60 日目まで抵抗を続ける。H は「襲われたときに逃げ延びる少数」＋「60日目以降の崩壊で残る人」
  - 拡散の重みに `0.03·pop0`（市街地へ戻る傾向）と自セルの引き留めを追加。60日目以降の S は Z にならず H か死亡
  - これらは「全国が一様に真っ赤」にならず、田舎に狩り尽くせる規模（数十〜数千）が残るようにするための調整
- 次のセッションへの注意:
  - セルの戦術パラメータは `sim/world/derive.ts` の `cellTactical(state, grid, cell)`（active 上限・種類比率・危険度・探索建物数）。Z を減らすときは `removeZombies(state, cell, n)`
  - 現在地は `state.player.cell`、本拠は `state.world.homeCell`（開始時に同じセル）。移動で現在地が変わったら `cellEntered` / `travelArrived` が出る
  - `world.travel.progress` は「経路上の何区間目か＋その区間の進み具合」。移動中の実効速度は `core/time.ts` の `effectiveSpeed` が x30 にする
  - 新規ゲームは `main.ts` の `newGame`（データ読込 → `initWorld` → 候補抽出 → オープニング）→ `chooseStart`（`beginAt` → 開始）。URL に `?seed=12&scenario=0` で再現可能
  - 感染パラメータを変えたら `npm run data` を実行してコミットすること（テスト「are up to date」が落ちる）。結果は `node tools/preview.ts tmp/preview` の PNG で確認できる
  - 依存追加: `world-atlas`（devDependency、日本の陸地ポリゴン。ビルド時のみ使用）
- 追加した共有型・コマンド・イベント:
  - 型: `StaticGrid` を確定（`cellKm`, `proj`, `landIds`, `hubs`, `prefNames`, `regionNames`, `places` を追加）、`Hub`。`UiActions.newGame` は `Promise<boolean>` に変更、`chooseStart` / `cancelIntro` を追加、`UiSnapshot.grid` / `intro`
  - コマンド: `travel` を実装
  - イベント: `travelStarted`, `cellEntered`, `travelArrived`, `travelEncounter`, `infectionStepped`。`commandRejected` の理由に `noMap` / `alreadyTravelling` / `noRoute` / `travelling`
  - `BALANCE.infection`, `BALANCE.world`
