# 役割別プロンプト

1ファイル＝1セッション。上から順に実行する（02 と 03 だけは並行可）。

| # | ファイル | 役割 | 到達マイルストーン | 重さ |
|---|---|---|---|---|
| 01 | [01_foundation.md](01_foundation.md) | 基盤アーキテクト | M0 | 中 |
| 02 | [02_map_infection.md](02_map_infection.md) | 地図データ・感染シミュレーション | M1 | 中 |
| 03 | [03_tactical_world.md](03_tactical_world.md) | 戦術3Dワールド | M2 前半 | 大 |
| 04 | [04_sniping_zombies.md](04_sniping_zombies.md) | 狙撃・ゾンビ戦闘 | M2 | 大 |
| 05 | [05_colony.md](05_colony.md) | 生存者・経済 | M3 | 大 |
| 06 | [06_building_defense.md](06_building_defense.md) | 建築・防衛・駐屯地 | M4 | 大 |
| 07 | [07_tech_progression.md](07_tech_progression.md) | 技術ツリー・進行 | M5 | 中 |
| 07b | [07b_playtest_fixes.md](07b_playtest_fixes.md) | 実機プレイの指摘への対応（操作・地形の遮蔽・生存者の発見・タイトル） | M5 | 中 |
| 07e | [07e_economy_loot.md](07e_economy_loot.md) | 耳の値打ち（4〜6 耳で 1 人雇える）と探索の収穫 ×3 | — | 小 |
| 07d-1 | [07d1_building_framework.md](07d1_building_framework.md) | 中に入れる建物の基盤（設計図の型・段階的な出現・拠点の建物） | — | 大 |
| 07d-2a | [07d2a_buildings_residential.md](07d2a_buildings_residential.md) | 建物の生成: 家 10・アパート 6 | — | 中 |
| 07d-2b | [07d2b_buildings_commerce.md](07d2b_buildings_commerce.md) | 建物の生成: 銀行・コンビニ・飲食・ホテル・旅館・GS・シャッター店 | — | 中 |
| 07d-2c | [07d2c_buildings_office.md](07d2c_buildings_office.md) | 建物の生成: ビル 20 | — | 中 |
| 07d-2d | [07d2d_buildings_public.md](07d2d_buildings_public.md) | 建物の生成: 学校 8・警察・消防・病院 3・工場 4 | — | 中 |
| 07d-2e | [07d2e_buildings_transport.md](07d2e_buildings_transport.md) | 建物の生成: 駅 5・空港 3 | — | 中 |
| 07d-2f | [07d2f_buildings_military.md](07d2f_buildings_military.md) | 建物の生成: 野営基地の残骸 10・陸自 3・海自 1・空自 1 | — | 中 |
| 07d-3 | [07d3_building_placement.md](07d3_building_placement.md) | 建物の配置（町の格・駅・空港・自衛隊の位置） | — | 大 |
| 08 | [08_ui_audio.md](08_ui_audio.md) | UI/UX・音・チュートリアル | M6 | 中 |
| 09 | [09_balance_qa.md](09_balance_qa.md) | バランス調整・QA | M7 | 中 |
| 10 | [10_mobile.md](10_mobile.md) | スマホ対応（任意） | M8 | 小 |

## 実在の地図（R0〜R8）

- 発注者の要望で、地図を実データ（国土地理院・e-Stat・国土数値情報）に置き換える。**クラウド環境「zombie_sniper_survival」でセッションを始めること**（実データの配布元へ接続できるのはこの環境だけ）
- R0（基盤・四国で試験）→ R1〜R8（8 地方を並行）→ 07d-3（縮図の町並みを建物の種類で埋める）
- 区域はセルの実在の 10km 四方を **1/10 に縮めた縮図**（人・建物は実寸）
- 07d-2a〜2f（建物の種類づくり）は R0〜R8 と並行して進めてよい（触るファイルが別）

| # | ファイル | 内容 |
|---|---|---|
| R0 | [R0_realmap_foundation.md](R0_realmap_foundation.md) | 実データの取得・変換・区域の生成の仕組み、戦略地図の実データ化、四国で通し |
| R1 | [R1_realmap_hokkaido.md](R1_realmap_hokkaido.md) | 北海道 |
| R2 | [R2_realmap_tohoku.md](R2_realmap_tohoku.md) | 東北 |
| R3 | [R3_realmap_kanto.md](R3_realmap_kanto.md) | 関東 |
| R4 | [R4_realmap_chubu.md](R4_realmap_chubu.md) | 中部 |
| R5 | [R5_realmap_kinki.md](R5_realmap_kinki.md) | 近畿 |
| R6 | [R6_realmap_chugoku.md](R6_realmap_chugoku.md) | 中国 |
| R7 | [R7_realmap_shikoku.md](R7_realmap_shikoku.md) | 四国（R0 の試験台の仕上げ） |
| R8 | [R8_realmap_kyushu.md](R8_realmap_kyushu.md) | 九州・沖縄 |

## 07d・07e の進め方

- 07e は単独で、いつでも実行できる（07d と並行可）
- 07d-1 → （07d-2a〜2f を並行）→ 07d-3 の順。07d-2 の 6 本は、07d-1 が `main` に入ってから同時に別チャットで始めてよい（触るファイルが分かれている）
- 07d-3 は 07d-2 と R0〜R8 が全部 `main` に入ってから。すべて終わったら 09 → 10

## 使い方

0. 新しいセッションは **リポジトリ `hanadamushin/zombie_sniper_survival` を選んだ状態で** 始める（選び忘れても、プロンプト冒頭の「作業の前提」でセッション自身が書き込み権限つきで追加する）
1. 新しいセッションを開き、該当ファイルの中身をそのまま貼る（または「`prompts/NN_xxx.md` の指示に従って実装して」と伝える）
2. 共通ルールは `CLAUDE.md` に書いてあり自動で読まれるので、プロンプト側では繰り返していない
3. セッションが終わったら `docs/PROGRESS.md` の追記内容を確認し、実際に遊んでみてから次へ進む
4. 気になる点があれば、次のプロンプトの末尾に「追加の指示」として書き足す

## モデルの使い分けの目安

最上位モデルの枠を節約したい場合、判断の難しさで振り分ける。

- 最上位モデル推奨: **01**（全体の契約を決める）、**04**（手触りが命）、**06**（経路・防衛の絡みが複雑）、**09**（全体を見た調整）
- 一段下のモデルでも可: 02、03、05、07、08、10（仕様が具体的で、契約が 01 で固まっているため）
