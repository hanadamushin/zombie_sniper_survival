# 耳の国 — Zombie Sniper Survival（仮題）

崩壊後の日本で、スナイパーが生存者を雇い、駐屯地を広げ、国を建て直す。
**スコープ越しの精密狙撃** と **サバイバル建国シミュレーション** を組み合わせたブラウザゲーム（PC優先）。

現在の状態: **M0（土台）完了** — 進捗は [docs/PROGRESS.md](docs/PROGRESS.md)

```
npm install
npm run dev      # 開発サーバ
npm run check    # 型検査 + lint + テスト
npm run build    # 本番ビルド（dist/）
npm run e2e      # Playwright スモーク
```

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/01_game_design.md](docs/01_game_design.md) | ゲームデザイン（コンセプト、コアループ、世界観、各システムの狙い） |
| [docs/02_systems_spec.md](docs/02_systems_spec.md) | システム仕様（数式・初期バランス値・操作） |
| [docs/03_tech_tree.md](docs/03_tech_tree.md) | 技術ツリー（5カテゴリ×4時代、排他分岐） |
| [docs/04_architecture.md](docs/04_architecture.md) | 技術構成、ディレクトリ、状態スキーマ、モジュール間契約 |
| [docs/05_roadmap.md](docs/05_roadmap.md) | マイルストーンとセッション実行順 |
| [docs/PROGRESS.md](docs/PROGRESS.md) | セッション間の引き継ぎログ（各セッションが追記） |
| [CLAUDE.md](CLAUDE.md) | 全セッション共通の開発ルール（自動で読み込まれる） |
| [prompts/](prompts/README.md) | 役割ごとのセッション用プロンプト（10本） |

## 進め方

`prompts/README.md` の順番どおりに、1プロンプト＝1セッションで実行する。
