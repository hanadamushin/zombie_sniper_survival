# 実在の日本地図: 地方担当（R1〜R8）の手引き

R0 が作った「実データから区域を作る仕組み」で、自分の地方のすべてのセルを仕上げるための手引き。
**これだけ読めば作業できる** ように書いてある。分からないことがあれば R0 の PROGRESS.md の節を見る。

## 1. 全体の形（覚えておくこと）

- 戦略地図の 1 セル = 実在の **10km 四方**（等距円筒図法の格子。セル番号 = `gy × 167 + gx`）
- 戦術区域（1024m 四方）= そのセルの 10km 四方を **水平に 1/10** に縮めたもの。北西の角が (0, 0)、x 東・z 南、区域の 1m が実在の約 10m
- **縮めるのは位置と広がりだけ**。人・建物・道路の幅・木は実寸。だから実在の建物を 1 棟ずつ写すのではなく、土地利用と人口から町並みを **生成** する
- 高さは別の縮め方（`src/data/realmap.ts` の `REAL_AREA.height.knots`。海の近くで 1/4.5、山で 1/13 程度）。急すぎる斜面を歩けるようにするため
- 隣り合うセルの区域は実在でも隣り合う。**辺の上の標高・土地利用は両側で同じ点を標本化している** ので、地形・水面・道路は境界で必ず一致する（一致しなければ不具合）

```
tools/real/
  region.ts        npm run data:region -- <地方>        取得 → 変換 → public/data/areas/<地方>/
  check.ts         node tools/real/check.ts <地方>      全セルの自動点検（4 節）
  area-preview.ts  node tools/real/area-preview.ts <地方> <セル>   データそのものを上から（土地利用・道路・施設）
  area-map.ts      node tools/real/area-map.ts <セル> [--home]     ゲームが作る区域を上から（1px = 1m）
  estimate.ts      npm run data:region -- <地方> --estimate      取得枚数の見積もり（全国も）
  grid.ts          npm run data                         戦略地図（全国。R1〜R8 は原則触らない）
  lib/             取得（キャッシュ・間隔）、zip、ベクトルタイル、標高タイル、シェープファイル、L03-b
tools/data/real/overrides/<地方>.ts   手直しの口（6 節）
src/gen/real/format.ts                区域ファイルの形（読み書き）
src/gen/real/layout.ts                区域の生成（地形・水・道路・町並み・施設）
src/data/realmap.ts                   すべての数値（高さの縮め方、町の格、施設の大きさ、点検のしきい値）
src/gen/buildings/catalog/landmark_<地方>.ts / defs/landmark/<地方>/   名所の建物（7 節）
```

地方とセル: 都道府県から決まる（`tools/real/lib/regions.ts`）。hokkaido / tohoku / kanto / chubu / kinki / chugoku / shikoku / kyushu（沖縄は kyushu）。

## 2. 取得と変換

1. 環境の確認: `curl -s -o /dev/null -w "%{http_code}" https://cyberjapandata.gsi.go.jp/xyz/dem/10/909/403.txt` が 200（クラウド環境「zombie_sniper_survival」でだけ通る）
2. `npm ci`（world-atlas などが要る）
3. 見積もり: `npm run data:region -- <地方> --estimate`（R0 の実測は下の表）
4. 本番: `npm run data:region -- <地方>`。**途中で止めても再開できる**（ダウンロードは `tmp/realdata/` にキャッシュ。2 回目からはほぼオフライン）
5. 一部のセルだけ作り直す: `npm run data:region -- <地方> --cells 21757,21758`（index.json は他のセルを保ったまま更新）

| 地方 | セル | DEM z12 | ベクトル z13 | 注記 z14（町だけ） | L03-b zip | 合計（見積もり） |
|---|---|---|---|---|---|---|
| hokkaido | 919 | 1833 | 6936 | 〜8300 | 33 | 17143 |
| tohoku | 725 | 1335 | 5120 | 〜7300 | 24 | 13823 |
| kanto | 341 | 630 | 2351 | 〜5900 | 13 | 8892 |
| chubu | 713 | 1312 | 4908 | 〜8800 | 27 | 15056 |
| kinki | 349 | 646 | 2399 | 〜4700 | 11 | 7798 |
| chugoku | 347 | 625 | 2357 | 〜3900 | 17 | 6871 |
| shikoku | 207 | 390 | 1417 | 〜2300 | 9 | 4090（実測: 約 3,000 件・約 360MB・約 10 分） |
| kyushu | 507 | 1025 | 3541 | 〜6000 | 29 | 10563 |

- 取得は **1 秒あたり 5 件まで**（`tools/real/lib/fetch.ts` の `RATE`。上げない）。User-Agent は汎用の名前で、個人情報は入れない
- L03-b（土地利用）は 1 次メッシュごとの zip が約 20MB。地方あたり 10〜30 個。`tmp/realdata/l03b/<メッシュ>.u8` に展開済みの格子を残すので 2 回目は速い
- **キャッシュはコミットしない**（`tmp/` は .gitignore）。別のセッションでは取り直しになる

## 3. 出力（区域ファイル）

`public/data/areas/<地方>/<セル>.bin`（gzip）と `index.json`。中身（`src/gen/real/format.ts`）:

| 部分 | 内容 | 細かさ（実在 / 区域） |
|---|---|---|
| 標高 | 129×129 点、0.5m 刻み、海は「海」の印 | 78m / 8m |
| 土地利用 | 129×129 点（標高と同じ点）: 田・畑・森林・荒地・建物用地・道路・鉄道・その他・水面・海浜・海・ゴルフ場 | 78m / 8m |
| 堅ろう建物の割合 | 64×64（国土地理院 z13 の堅ろう建物の面） | 156m / 16m |
| 人口 | 10×10（国勢調査 1km メッシュ、人/km²） | 1km / 102m |
| 線 | 高速・国道・県道・幅 13m 以上（人の少ないセルは 5.5m 以上も）・鉄道。トンネル・高架の印、実寸の幅 | 簡略化 1.2m |
| 点 | 駅・県庁・市役所・役場・病院・学校・大学・警察・消防・自衛隊・空港・城・寺社・郵便局…（名前つき） | 0.5m |

- 大きさの目安: **1 区域 平均 40KB 以下、全国 120MB 以下**。四国の実測: 平均 16.0KB・最大 20.3KB・合計 3.40MB（PROGRESS.md）。超えそうなら `durableMul`（6 節）や `REAL_AREA.build.simplify` を上げる
- `index.json`: セルごとの大きさ、**警察署・消防署の数、自衛隊の施設**（国土地理院の注記から数えたもの）。ゲームは起動時に全地方の index.json を読み、戦略地図のセル情報（`StaticCell.real`）をこの値で上書きする

## 4. 確認のしかた

### 自動点検（必ず全セル）

```
node tools/real/check.ts <地方>            # 全セル（1 セル 1〜3 秒。本拠としての生成・視線・隣との境界を含む）
node tools/real/check.ts <地方> --quick    # 視線と本拠を省く（速い）
node tools/real/check.ts <地方> --cells 21757,21758
```

点検の中身としきい値（`REAL_CHECK`、`src/data/realmap.ts`）:

| 項目 | しきい値 | 外れたときの直し方 |
|---|---|---|
| 乾いた土地のうち歩ける割合 | 60% 以上 | `heightMul` を下げる（6 節） |
| 高所の射点 | 3 か所以上（海が 6 割を超える区域は除く） | 足りなければ生成が鉄塔を足す。それでも足りないなら `addPois` に塔（POI 20）|
| 本拠の中央 半径 120m | 建物なし | 生成側で取り除く（失敗したら共通部分の不具合） |
| 東・南の隣との境界の高さの差 | 0.01m 未満 | 共通部分の不具合（標本化がずれている） |
| 境界の水面の不一致・相手のない道路の端 | 0 | 同上 |
| 建物が道路・水面の上 | 0 | 同上（R0 で施設と町の道の重なりを直した） |
| 区域ファイル | 80KB 以下 | 6 節の間引き |
| 生成時間（Node） | 900ms 以下 | ゲームでは Worker で作るので画面は止まらないが、重すぎると隣の区域の表示が遅れる |

視線の割合（地上で 200m 先が見える割合）は表の最後に区分ごとの平均が出る。目安は田舎 25〜45%、森 15% 未満（07b）。実データで外れても直ちに不具合ではないが、田舎が開けすぎなら生け垣・藪の量（`TACTICAL.cover`）は共通なので触らず、PROGRESS.md に値を書く。

### 見た目（スクリーンショット）

1. `node tools/real/area-preview.ts <地方> <セル>` → `tmp/realarea/<地方>_<セル>.png`（データそのもの。赤=国道、橙=県道、緑=高速、黒=鉄道、黄=駅、紫=自衛隊、水色=その他の施設）
2. `node tools/real/area-map.ts <セル>` → `tmp/realmap/<セル>.png`（ゲームが作る区域。青=水面、砂色=海浜）
3. 同じ 10km 四方を **地理院地図**（https://maps.gsi.go.jp/ ）で開いて見比べる。セルの範囲は `grid.json` の `proj` から: 経度 `lon0 + gx×10/kmPerLon`〜、緯度 `latTop − gy×10/kmPerLat`〜（`tools/real/cities-check.ts` が主要地点のセル番号を出す）
4. ゲームの中: `npm run build && npx vite preview`、`?seed=12` で新規ゲーム → 開発者ツールで `__game.debug.gotoLatLon(緯度, 経度)` → `__game.debug.realInfo()` で `real: true` を確かめ、高い所から見る。e2e の `e2e/realmap.spec.ts` が同じことを自動で行い `test-results/realmap-*.png` を撮る（地点の表を自分の地方に書き換えて使う）

見比べる点: 海岸線、川（大きな川は水面として出る）、主要道路の向き、鉄道、町の広がり（建物用地）、山の形（標高の陰影）、駅・役所・病院の位置。

## 5. よくある不具合と直し方

| 症状 | 原因 | 直し方 |
|---|---|---|
| 急斜面で歩けない（walkable が低い） | 高さの縮め方が足りない | そのセルの `heightMul: 0.8` など（6 節）。地方全体なら `OVERRIDES.heightMul` |
| 区域のほとんどが海や湖 | 海岸のセル（戦略地図では陸の割合 35% 以上で陸） | 不具合ではない。本拠にはなりにくい（中央 140m は陸に直す処理あり） |
| 建物が道路や川に重なる | 生成の順番（道路 → 施設 → 町の道 → 町並み → 田畑） | 共通部分。PROGRESS.md に「共通部分を直した」と書いて最小限の修正 |
| トンネルの出口で道が山に突っ込む | トンネル区間は描かない（`LINE_TUNNEL`） | そのまま（坑口で道が終わる）。気になる区間は 6 節で点を足して目印に |
| 高架・橋 | R0 は橋桁を作らず、水面の上は道路の下を **土手（盛り土）** にする | 大きな橋（瀬戸大橋・しまなみ・明石海峡）も土手として渡れる。名所として橋の塔を作るのは 7 節 |
| 境界で川や道路がずれる | ほぼ起きない（両側で同じ点を標本化） | 起きたら `check.ts` の seam 列で分かる。データの作り直し（`--cells` で両方）で直らなければ共通部分の不具合 |
| 隣の地方との境界で地形が段になる | 隣の地方のデータがまだ無い（乱数の区域） | 隣が無いセルの辺は 120m の帯で乱数の地形へ混ぜる（`REAL_AREA.seamBand`）。隣の地方が揃えば自然に消える |
| 施設の名前が違う・重複・位置がずれる | 注記の位置は文字の位置（施設の中心とは限らない） | `dropPois` / `renamePois` / `addPois`（6 節） |
| 駅が無い小さな町 | z14 の注記は「町のタイル」だけ読む（建物用地が少ないタイルは読まない） | `REAL_AREA.build.labelTileTown` は共通なので、個別に `addPois` |
| 町が密すぎて重い | 建物用地が広い大都市 | 3 指標を計測して超えたら `durableMul` を下げる（高層が減る）。07d-1 の段階的な出現が効くので、まずは計測 |

## 6. 手直しの口（`tools/data/real/overrides/<地方>.ts`）

**自分の地方のファイルだけを触る**。型は `tools/data/real/overrides/types.ts`。直したら `npm run data:region -- <地方> --cells …` で作り直す（データに焼き込まれる。高さの倍率はファイルの頭に入り、ゲームが読む）。

```ts
import { POI } from '../../../../src/gen/real/format.ts';
import type { RegionOverrides } from './types.ts';

export const OVERRIDES: RegionOverrides = {
  heightMul: 1,                          // 地方全体の高さの倍率（1 = src/data/realmap.ts のまま）
  cells: {
    21757: {
      heightMul: 0.85,                   // このセルだけ平らに
      dropPois: ['簡易郵便局'],           // 名前に含む点を消す
      renamePois: { 松山市役所: '松山市役所（本館）' },
      addPois: [{ kind: POI.tower, grade: 0, x: 300, z: 420, name: '給水塔' }], // 区域の座標（m）
      durableMul: 0.7,                   // 高層を減らす（重いとき）
      dropLocalRoads: true,              // 5.5m 以上の細い道を入れない（人の少ないセルでだけ入る）
    },
  },
};
```

数値そのもの（高さの縮め方・町の格のしきい値・施設の大きさ）は `src/data/realmap.ts` にあり **全国共通**。変えたいときは取りまとめ役に相談（PROGRESS.md に理由を書く）。

## 7. 名所の建物（任意・3 つまで）

- 設計図は 07d の形（`docs/buildings_guide.md`）。カテゴリ `landmark`、id `landmark.<名前>`（例 `landmark.matsuyama_castle`）
- ファイル: `src/gen/buildings/defs/landmark/<地方>/<名前>.ts`、登録は `src/gen/buildings/catalog/landmark_<地方>.ts` の配列（index.ts は R0 が登録済み。触らない）
- 三角形の上限は `ARCH.limits.landmark`（外観 6000・内部 3000。いちばん高いビルと同じ）。中に入れなくてよい（外観だけ）。登れる展望台があれば射点（`roof` の段）にしてよい
- 置き場所: 実在の位置を縮めた点。R0 の生成は名所を置かないので、`src/gen/real/layout.ts` の `layoutReal` の施設の順番の前に 1 行足す必要がある（共通部分なので最小限に。例: POI の名前が「松山城」なら `enterableIn(b, 'landmark.matsuyama_castle', …)`）。重なる町並みは自動で避ける
- カタログの自動テスト（`tests/buildings.test.ts`）が全種類に走る。`npm run buildings:preview` で平面図

## 8. 性能

区域ファイルの読み込みと生成は Worker（隣の区域）と読み込み画面（最初の区域）で行う。地方で **最も建物の多い区域・山地・海沿い** の 3 か所で 3 指標（ドローコール < 150、三角形 < 50 万、sim＋描画発行 < 4ms）を計測する。`e2e/realmap.spec.ts` の地点の表を書き換えて `npx playwright test e2e/realmap.spec.ts` を回すと値が出る。四国の値は PROGRESS.md の R0 の節。

## 9. 仕上げのチェックリスト

- [ ] `npm run data:region -- <地方>` が最後まで通り、全セルの `.bin` と `index.json` がある
- [ ] `node tools/real/check.ts <地方>` で問題 0（例外は理由つきで PROGRESS.md に）
- [ ] プロンプトの照合地点でスクリーンショット（ゲーム内と area-map の両方）と地理院地図の照合表
- [ ] 出力の大きさ（地方の合計・平均・最大）を PROGRESS.md に
- [ ] `npm run check`・`npm run build`、`npx playwright test e2e/realmap.spec.ts`
- [ ] 他の地方に役立つ発見は下の「各地方からの追記」に 1 行

## 各地方からの追記

（R1〜R8 はここに 1 行ずつ足す）
