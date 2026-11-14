# 開発ルール（全セッション共通）

このリポジトリは、ゾンビ狙撃 × サバイバル建国のブラウザゲーム。1セッション＝1役割で段階的に実装する。

## 最初にやること

1. `docs/PROGRESS.md` を読む（前のセッションの引き継ぎ）
2. `docs/04_architecture.md` を読む（守るべき構造と型の契約）
3. 自分の役割のプロンプト（`prompts/NN_*.md`）が指す docs の節を読む
4. 既存コードの該当ディレクトリを確認してから書き始める

## 守ること

- **sim と描画の分離**: `src/sim/**` と `src/gen/**` は Three.js・DOM・`window` を import しない。状態変更はコマンドか sim 内でのみ
- **決定性**: sim 内で `Math.random()` / `Date.now()` を使わない。`core/rng.ts` を使う
- **数値は `src/data/**` に置く**。ロジックへ直書きしない。仕様値を変えたら `docs/02_systems_spec.md` も直す
- **`GameState` は JSON 化可能に保つ**。共有型（`src/core/types.ts`）は追加のみ。改名・削除が必要なら全参照を直し PROGRESS.md に書く
- **外部アセット禁止**（モデル・画像・音声ファイル）。形状・色・音はコードで生成
- **依存追加は最小限**。three / preact / vite / vitest / playwright 以外を入れるときは PROGRESS.md に理由を書く
- 自分の役割の範囲外のディレクトリは、契約上必要な最小限の変更にとどめる
- UI 文言は日本語、`src/ui/i18n/ja.ts` に集約。コード中の識別子・コメントは英語
- 性能予算: 内蔵GPUで 60fps 目標、ドローコール < 150、ゾンビ同時 150 体まで
- PC（キーボード＋マウス）優先。UI は幅 360px でも崩れない CSS にしておく（タッチ操作の実装は 10 番まで不要）

## 終わる前にやること

1. `npm run check`（型検査・lint・テスト）と `npm run build` を通す
2. 実際に起動して受け入れ基準を確認する（Playwright でスクリーンショットを撮って目視するのが確実）
3. `docs/PROGRESS.md` に追記する
4. コミットしてプッシュする（PR は指示がない限り作らない）

## コマンド（基盤セッションが整備）

- `npm run dev` — 開発サーバ
- `npm run build` — 本番ビルド
- `npm run check` — tsc + eslint + vitest
- `npm run data` — 地図・感染データの再生成（`tools/`）
