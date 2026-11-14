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
