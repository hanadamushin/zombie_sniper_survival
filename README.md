# Zombie Sniper Survival（仮題）

崩壊後の日本で、スナイパーが生存者を雇い、駐屯地を広げ、国を建て直す。
**スコープ越しの精密狙撃** と **サバイバル建国シミュレーション** を組み合わせたブラウザゲーム（PC優先）。

現在の状態: **M0（土台）完了** — 進捗は [docs/PROGRESS.md](docs/PROGRESS.md)

```
npm install
npm run dev      # 開発サーバ
npm run check    # 型検査 + lint + テスト
npm run build    # 本番ビルド（dist/）
npm run e2e      # Playwright スモーク
npm run balance  # 通しプレイのボット 138 ゲーム（釣り合いの検証。結果は tmp/balance/、読み方は docs/balance_log.md）
npm run balance:play -- 12 0 30 average   # 実シミュレーションで序盤 30 分を自動操縦
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
| [docs/realmap_guide.md](docs/realmap_guide.md) | 実在の日本地図（R0〜R8）: 取得・変換・点検・手直しの手引き |
| [CLAUDE.md](CLAUDE.md) | 全セッション共通の開発ルール（自動で読み込まれる） |
| [prompts/](prompts/README.md) | 役割ごとのセッション用プロンプト（10本） |

## 進め方

`prompts/README.md` の順番どおりに、1プロンプト＝1セッションで実行する。

## 地図データの出典

戦略地図と戦術区域は、次の公的なオープンデータをビルド時に変換・縮小して作っています（`npm run data`・`npm run data:region -- <地方>`。手順は [docs/realmap_guide.md](docs/realmap_guide.md)）。ゲーム内でもタイトルとメニューの「出典」で表示します。

- 国土地理院ベクトルタイル提供実験・標高タイル（国土地理院コンテンツ利用規約に基づき加工）
- 国土数値情報（国土交通省）: 土地利用細分メッシュ（L03-b 2021）、行政区域（N03 2024）、駅別乗降客数（S12 2024）、空港（C28 2021）、鉄道（N02 2024）、学校（P29 2023）、医療機関（P04 2020）、市町村役場等及び公的集会施設（P05 2022）
- 政府統計の総合窓口（e-Stat）: 令和2年国勢調査 地域メッシュ統計（1km、総務省統計局）
- Natural Earth（world-atlas）: 取得範囲の決定のみ

建物の形・種類・細かな配置の多くはゲームが生成したもので、実在のものを写したものではありません。
