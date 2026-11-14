# 01 基盤アーキテクト

あなたはこのゲームの基盤を作る担当です。以降の9セッションが全員あなたの作った骨組みの上で作業するので、
**機能の多さよりも、契約（型・ループ・コマンド・イベント）が明確で壊れにくいこと** を最優先してください。

## 読むもの
- `CLAUDE.md`、`docs/04_architecture.md`（全部）、`docs/02_systems_spec.md` の §1 時間・§10 セーブ
- `docs/01_game_design.md` は §3（3層構造）だけ目を通せば十分

## ゴール（M0）
ブラウザで起動すると空の3Dシーンが表示され、ゲーム内時間が進み、速度変更・モード切替・セーブ/ロードができる。
他の担当が「自分のシステムを差し込む場所」がコード上で一目で分かる。

## 実装範囲
1. **プロジェクト雛形**: Vite + TypeScript(strict) + Three.js + Preact + Vitest + ESLint。`npm run dev / build / check / data` を用意（`data` は今は空のスクリプトでよい）
2. **`src/core/types.ts`**: `04_architecture.md` §5 の型をそのまま定義。`createInitialState(seed, difficulty)` も用意
3. **`core/rng.ts`**: シード付き PRNG（xoshiro128** など）。状態は `GameState.rng` に保持。`rand()`, `randInt()`, `pick()`, `gauss()`、および用途別に独立した系列を作る `fork(label)`
4. **`core/events.ts` / `core/commands.ts`**: 判別共用体の型と、バッファ付きイベントバス、コマンドキュー。`04_architecture.md` §6 に列挙したものを型として先に全部定義しておく（ハンドラは未実装でよく、未実装コマンドは警告ログ）
5. **`sim/index.ts`**: `tick(state, dt, input)`。§4 の順序で各システムの `update` を呼ぶ。各システムは `sim/<領域>/index.ts` に空実装のスタブを置き、どの頻度で呼ばれるかをコメントで明記
6. **時間システム**: 分・時・日の境界で `hourStarted` / `dayStarted` を発火。速度 0/1/3/10
7. **`main.ts`**: 固定ステップのゲームループ（§4）。タブ非アクティブ時の巨大 dt を抑制
8. **`render/`**: Three.js の初期化、リサイズ、空と地面だけの仮シーン、時刻に応じた空色。`render.draw(state, alpha)` の入口と、サブレンダラを登録する仕組み
9. **`input/`**: キーボード・マウス（Pointer Lock）から `InputFrame` を作る層。キー割り当ては `02_systems_spec.md` §3.1。モードが tactical のときだけポインタをロック
10. **`ui/`**: Preact のルート、モード切替（tactical / command / world / menu）の枠、デバッグ用の最小 HUD（日付・時刻・速度・FPS）、タイトル画面（新規・続きから）。`ui/i18n/ja.ts`
11. **`core/save.ts`**: IndexedDB への保存・読込、バージョンとマイグレーションの枠、自動セーブ（`dayStarted` 時）
12. **`data/balance.ts`**: 時間まわりの定数を置き、他の担当が追記していく形を示す
13. **テスト**: PRNG の決定性、時間境界イベント、セーブ往復の一致、`tick` を1万回回して例外が出ないこと
14. **Playwright スモーク**: 起動 → 新規ゲーム → コンソールエラーなし（`npm run check` には含めず `npm run e2e`）

## やらないこと
地形生成、プレイヤー移動、射撃、ゾンビ、生存者、建築、地図データ。スタブと型だけ用意して中身は書かない。

## 受け入れ基準
- `npm run check` と `npm run build` が通る
- 起動して新規ゲームを始めると、時計が進み、1/2/3 キーで速度が変わり、Tab と M でモード表示が切り替わる
- リロードして「続きから」で同じ日時から再開する
- `src/sim/**` が three / preact / DOM を import していない（ESLint の `no-restricted-imports` で機械的に禁止する）
- `docs/04_architecture.md` と実装に差が出た場合は docs を更新済み

## 終わりに
`CLAUDE.md` の「終わる前にやること」を実行。PROGRESS.md には、後続担当が最初に見るべきファイルと、システムの追加手順を3〜5行で書いてください。
