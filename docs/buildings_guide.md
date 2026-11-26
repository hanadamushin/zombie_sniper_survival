# 建物の作り方（07d 手引き）

中に入れる建物を 1 種類足すための手引き。**07d-2a〜2f はこれだけを読めば作れる** ようにしてある。仕組み（描画・当たり判定・ゾンビの経路・段階的な出現）は 07d-1 が作った。種類を足す人は **設計図を返す関数を 1 つ書いて登録するだけ** でよく、描画・当たり判定・経路・探索・テストは自動で付いてくる。

---

## 1. 全体の流れ

```
BuildingDef（種類）── generate(rng, {w, d, seed}) ──▶ BuildingBlueprint（設計図・データだけ）
      │                                                  │
      │ 区域の地図は BuildingPlacement（種類・位置・向き・シード）だけ持つ
      ▼                                                  ▼
  遠景: 外形の箱＋屋根（設計図なしで描く）      parts ─┬─▶ 描画（外観 / 内部の 2 層、形ごとに 1 ドローコール）
                                                       ├─▶ 当たり判定（部品から自動、描画と同じ寸法）
                                                       rooms + links ─▶ ゾンビ・生存者の経路
                                                       search ─▶ 探索ポイント（収穫表 id つき）
```

- 設計図は **three を使わない純粋なデータ**。`src/gen/buildings/` 以下は DOM・`window`・`Math.random()` を使わない。乱数は `generate` に渡される `rng`（`kit.rand()` など）だけ
- 設計図は「何かが近づいたとき」に初めて作られ、LRU に入る（`blueprintOf` / `detailOf`）。同じシード・同じ大きさなら必ず同じ建物になること（テストが検査する）
- 見本: `src/gen/buildings/defs/house/wood2.ts`（木造 2 階建て）、`defs/shop/konbini.ts`（コンビニ）、`defs/office/zakkyo5.ts`（5 階建て雑居ビル）、`defs/base/hall.ts`（拠点の建物を 1 つの関数で 13 種類）

## 2. ファイルと登録

1. 建物 1 種類につき 1 ファイル: `src/gen/buildings/defs/<category>/<variant>.ts`
2. 自分のカテゴリの一覧 `src/gen/buildings/catalog/<category>.ts` の配列に **追記だけ** する（他のカテゴリのファイル・`catalog/index.ts` は触らない）
3. id は `<category>.<variant>`（例 `house.kominka`）。カテゴリと id の不一致・重複は起動時に例外になる
4. カテゴリ: `house` `apartment` `shop` `office` `public` `transport` `military` `base`

```ts
// src/gen/buildings/catalog/house.ts
import { HOUSE_WOOD2 } from '../defs/house/wood2.ts';
import { HOUSE_HIRAYA } from '../defs/house/hiraya.ts';   // ← 足すのはここだけ
export const HOUSE: readonly BuildingDef[] = [HOUSE_WOOD2, HOUSE_HIRAYA];
```

組み立て道具（`kit.ts`）に足りないものがあれば、**既存の関数は変えずに新しい関数を足す**（`Kit` インターフェースへの追加と実装）。PROGRESS.md に書くこと。並行作業でぶつかりやすいので、できれば自分の建物のファイル内の補助関数で済ませる。

## 3. 座標系（設計図の中）

- 原点は敷地の角。**x は間口（0〜w）、z は奥行き（0〜d）、y は上**（m）
- **正面（主な入口）は z = d の側**。配置するときに 90° 単位で回す（`rot`: 0 南 / 1 東 / 2 北 / 3 西 を正面が向く）ので、設計図は常にこの向きで書けばよい
- y = 0 は敷地のいちばん高い地面。床は `def.plinth`（地面からの床高、0.5 以下）から始まる。`k.levelY(i)` が i 階の床の高さ（0 = 1 階、`k.storeys` = 屋上・小屋裏の床 = 軒の高さ `k.eaves`）
- 外壁と 1 階の床は地面の下 3m（`ARCH.foundation`）まで伸ばしてある（斜面との隙間を隠す）。自分で何かを地面に埋める必要はない
- **斜面では、低い側の扉の前に踏み段が自動で付く**（09b、`src/gen/doorsteps.ts`）。設計図の側で階段を作る必要はないが、**扉の正面 1〜4m と、扉の左右の壁沿い 1m を、塀・柵・柱・植え込みでふさがないこと**（踏み段の置き場所がなくなる。柱の間は 0.8m 以上あける）。敷地の中の庭（設計図の床が無いところ）は地面のままなので、斜面では敷地の基準面より低くなる。塀で囲った庭の出入口は、塀の切れ目を扉の正面まで広げておく（化学工場はこれで直した）

## 4. `BuildingDef`

| フィールド | 意味 |
|---|---|
| `id` / `category` / `variant` | `<category>.<variant>` |
| `kind` | 遠景の見た目（窓の模様）と統計用。03 の `BuildingKind`（`house` `shop` `apartment` `office` `warehouse` `barn` `shed`） |
| `size: { w: [最小, 最大], d: [最小, 最大] }` | 間口と奥行きの範囲（m）。配置側が区画に合わせてこの範囲で決め、`generate` に `{w, d}` で渡す。**範囲のどの大きさでも成り立つ** ように書く（テストは最小・最大・中間で検査する） |
| `storeys` / `storeyHeight` / `plinth` | 階数、階高（`ARCH.storey`）、床高 |
| `roof` / `roofRise` | 屋根の形（`flat` `gable` `hip` `shed`）と軒より上に乗るものの高さ（勾配屋根・屋上の塔屋・パラペット・看板）。**部品はすべて `plinth + storeys × storeyHeight + roofRise` 以下に収める**（外形の箱＝当たり判定の外枠がこの高さ） |
| `lootable` | 区域の探索ポイントに選ばれるか（false でも探索ポイント自体は持てる） |
| `limits?` | 三角形の上限を種類ごとに上書き（ふつうは使わない） |
| `generate(rng, params)` | 設計図を返す。`createKit(def, params, rng)` → 道具を呼ぶ → `k.finish()` |

## 5. 組み立て道具（`src/gen/buildings/kit.ts`）

```ts
const k = createKit(MY_DEF, params, rng);
const { w, d } = k;
k.thick = 0.2;                           // 外壁の厚さ（outerWalls が使う）
```

| 道具 | 使い方 |
|---|---|
| `k.door(at, state?, width?)` | 扉の穴。`at` は壁の始点からの中心位置。`state`: `'open'`（通れる。既定）/`'locked'`（閉じた扉。誰も通れない）/`'shutter'`（シャッター）。幅は既定 0.9m、`ARCH.door.wide` = 1.8m |
| `k.window(at, width?, { sill, head, broken })` | 窓の穴。**弾と視線は通し、人とゾンビは通さない**。`broken: true` はガラスなし（見えない板が残る） |
| `k.evenly(from, to, n)` | n 個の開口の中心を等間隔に |
| `k.outerWalls(level, { mat, tint, front, back, left, right, parapet?, y1? })` | その階の外壁 4 面。`front`/`back` の `at` は x = 0 から、`left`/`right` は z = 0 から測る |
| `k.wall(level, x0, z0, x1, z1, holes, opts)` | 任意の壁（平面の長方形、長い方向に開口） |
| `k.partition(level, x0, z0, x1, z1, holes?)` | 間仕切り（厚さ 0.12m、線の中心に立つ）。`x0 === x1` なら z 方向、`z0 === z1` なら x 方向 |
| `k.floor(level, mat, rect?)` | 床スラブ（既定は外壁の内側全体）。**階段の穴は自動で開く**（後から `stairs` を呼んでよい） |
| `k.hole(level, rect)` / `k.shaft(rect, from, to)` | 床の穴 / 使えないエレベーター穴（各階の床に穴を開ける。扉は `locked` で付ける） |
| `k.stairs({ level, start, dir, width?, kind?, turn?, rails?, to? })` | 階段。`start` は 1 段目の手前の中心、`dir` は上る向き（`'z-'` など）。`kind: 'straight'`（直階段、上階の穴の周りに手すり `rails`）/`'switchback'`（折り返し。2 本目は `turn` 側の隣の列、間に壁、踊り場つき）。蹴上げは 0.2m 以下に自動で分割。**最上階 → `k.storeys` へ掛けると屋上に出られる** |
| `k.ladder(level, x, z, nx, nz, to?)` | 壁付きのはしご（屋上ハッチなど）。(nx, nz) ははしごから壁への向き |
| `k.room(level, x0, z0, x1, z1, use, { locked? })` | **部屋は長方形**。歩ける場所はすべてどれかの部屋に入れる。L 字の空間は 2 部屋に分けて `join` |
| `k.join(a, b)` | 辺を接する 2 部屋をつなぐ（壁のない開口・廊下の曲がり角） |
| `k.furniture(level, x0, z0, x1, z1, h, mat, { search?, tint?, solid? })` | 床に置く箱。`search: { kind, face, table? }` を付けると、`face` 側 0.5m の位置が探索ポイントになる |
| `k.search(level, x, z, kind, table?)` | 家具なしの探索ポイント |
| `k.stain(level, x0, z0, x1, z1, mat?)` | 床のしみ（血痕 `blood`・瓦礫 `debris`・畳 `tatami` の敷物）。当たり判定なし |
| `k.box(level, x0, y0, z0, x1, y1, z1, mat, opts)` / `k.part({...})` | 道具にない形（看板・庇・倒れた家具）。`layer: 'shell'` が外観、`'interior'` が内部（既定） |
| `k.roofGable({ mat, axis?, rise? })` / `k.roofHip(...)` / `k.roofFlat({ mat, parapet? })` | 屋根。勾配屋根は小屋裏の床（最上階の天井）も張る |
| `k.levelY(i)` `k.eaves` `k.rand()` `k.range(a, b)` `k.pick(list)` `k.roomById(id)` | 補助 |
| `k.finish()` | 床を穴で切り、部屋のつながり（扉・開口・階段）を計算して設計図を返す。**扉が部屋に通じていない・探索ポイントが部屋の外にある** と例外（場所つきのメッセージ） |

扉の両側 0.55m（`ARCH.doorReach`）の点が経路の通過点になり、扉は自動で部屋どうし（外壁なら外と部屋）をつなぐ。施錠・シャッターの扉は経路に入らず、当たり判定で塞がる。

## 6. 大きさの約束（`src/data/architecture.ts` の `ARCH`）

| 項目 | 値 |
|---|---|
| 階高 | 木造 2.85m / RC 3.3m / 店舗 3.6m |
| 床スラブ | 0.2m |
| 扉 | 0.9 × 2.0m（両開き・自動ドア 1.8m）。**人 0.35m・歩行者 0.32m は 0.9m を通れる。肥大型（半径 0.5m）は通れない**（1.8m 以上なら通れる） |
| 窓 | 腰 0.9m・頭 2.0m |
| 廊下 | 1.2m 以上 |
| 階段 | 蹴上げ 0.2m 以下（03 の段差 0.5m で人もゾンビも登れる）、踏み面 0.25m、幅 0.9m（`wideWidth` 1.2m）、踊り場 1.3m |
| 手すり・パラペット | 1.0m / 1.1m |
| 軒の出 | 0.45m（部品は敷地から 0.6m まではみ出してよい。**ただし当たり判定のある部品は敷地の中**。はみ出す庇・看板・踏み石は `solid: false`） |
| 床高 `plinth` | 0.5m 以下（地面から入口に上がれる高さ） |

## 7. 材質

`MaterialId`（`src/gen/buildings/types.ts`）。色は `src/data/render.ts` の `RENDER.materials`（部品の `tint` 0〜1 がその一覧から選ぶ。省略するとシードで決まる）。振る舞いは `src/gen/buildings/materials.ts`:

| 振る舞い | 材質 |
|---|---|
| 固い（人・ゾンビ・弾・視線を止める） | `concrete` `plaster` `mortar` `siding` `brick` `wood` `woodDark` `tile` `slate` `metalRoof` `steel` `rust` `shutter` `door` `doorSteel` `frame` `flooring` `tatami` `carpet` `tileFloor` `vinyl` `fabric` `shelf` `counter` `appliance` `sign` `asphalt` |
| ガラス（人とゾンビだけ止める、半透明で描く） | `glass` |
| 飾り（当たり判定なし） | `paper` `blood` `debris` `plant` |

部品ごとに `solid: false`（描くだけ）/ `hidden: true`（当たり判定だけ）で上書きできる。`role: 'stair' | 'furniture'` は着弾の種類（`HitSurface`）を変える。新しい材質を足すときは `MaterialId`・`MATERIALS`・`RENDER.materials` の 3 か所。

## 8. 部屋・経路・探索

- **歩ける場所はすべて長方形の部屋で覆う**。部屋どうしは扉・`join`・階段でつながる。ゾンビは追跡中、この部屋のつながりで扉から入り、階段を上り下りする（`src/sim/tactical/indoor.ts`）
- **1 つの部屋の中では、出入口（扉・join・階段の端）の通過点どうしを直線で歩ける** こと（家具で塞がない）。テストが半径 0.28m で検査する。塞がるなら部屋を分けて `join` する（コンビニの通路が例）
- 施錠で入れない部屋は `room(..., { locked: true })`（到達性の検査から外れる）。押し入れのように「見えるが入れない」場所は、`window(..., { sill: 0, head: 1.8, broken: true })` を開口にして部屋を `locked` にする（木造 2 階建ての押し入れ）
- 階段室・吹き抜けの上は部屋にしない（階段の途中にいる者は直前の部屋を覚えている）
- 探索ポイント: `kind`（`shelf` `desk` `locker` `cabinet` `fridge` `counter` `closet` `crate` `bed` `table`）と収穫表 `table`。`table` を省くと部屋の用途（`RoomUse`）。表は `src/data/colony.ts` の `ROOM_LOOT`（05 の値 × 07e の `LOOT_SCALE`）。用途を足したら表にも行を足す（無い id は土地の表になる）。特別な棚は `pharmacy` `grocery` `tools` `weapons` `fuel`（燃料。07d-2b のガソリンスタンド）`stock`（鋼材などの資材。07d-2d の工場）。部屋の用途 `ward`（病室、医薬品が多い）は 07d-2d
- 区域の探索ポイントの総数は今までどおり `params.lootSpots`。中に入れる建物が選ばれると、その建物の探索ポイントが 1 つずつ地図の探索ポイントになる（施錠の部屋のものは除く）。潜伏者は 1 階の探索ポイントにだけ隠れる

## 9. 三角形の上限（描いたときの数）

部品 1 つの三角形: 箱 12、切妻・寄棟・くさび 8（`SHAPE_TRIS`）。`hidden` は 0。外観 = `layer: 'shell'` の合計、内部 = 階ごとの `interior` の合計。

| カテゴリ | 外観 | 内部（1 階あたり） |
|---|---|---|
| house | 1,500 | 4,000 |
| apartment | 3,000 | 3,000 |
| shop | 2,000 | 4,000 |
| office | 3,000 | 3,000 |
| public | 4,000 | 4,000 |
| transport | 4,000 | 4,000 |
| military | 3,000 | 3,000 |
| base | 1,500 | 3,000 |

見本の実測: 木造 2 階建て 外観 812 / 内部 432・240、コンビニ 480 / 228、雑居ビル 2,184 / 1 階あたり 444〜516。窓 1 つで壁が 3 片＋ガラス 1 枚増える（約 48 三角形）。生成は 1 棟 4ms 未満（Node の中央値）。

描画は 3 段階（`RENDER.enterables`）: 霧の端まで＝外形の箱（設計図なし）、300m 以内＝外観、40m 以内か中にいる＝内部。同じ形の部品は全建物でまとめて描くので、建物が増えてもドローコールは増えない（1 区域で最大 7: 外形の箱・外形の屋根・箱・切妻・寄棟・くさび・ガラス）。

## 10. テストと確認

`tests/buildings.test.ts` の最初の `describe` は **カタログの全種類** に対して自動で走る。新しい種類を登録すると次がすべて検査される:

1. 決定的（同じシード・大きさで同じ JSON）、三角形の上限、生成時間
2. 部品が敷地（＋0.6m）と外形の高さに収まる、当たり判定が敷地の中、`plinth` ≤ 0.5m
3. 施錠でない全部屋に外から行ける、外への扉がある、探索ポイントが家具に埋まっていない
4. 部屋ごとに出入口の通過点どうしが直線で歩ける
5. **4 方向に回した配置で、すべての扉・開口・階段を両向きに実際に歩いて通れる**（`updatePlayer` で歩かせる）

失敗のメッセージには種類・シード・部屋・座標が出る。自分の種類に固有のことは、同じファイルか自分のテストファイル（`tests/buildings-<category>.test.ts`）に足す。

目で見る:
- `npm run buildings:preview` → `tmp/buildings/<id>.png`（各階の平面図＋正面の立面。灰 = 壁、水色 = ガラス、茶 = 階段、黄 = 探索ポイント、緑線 = 扉の通り道、橙線 = 階段の通り道、赤み = 施錠の部屋）
- ゲームで `?yard=1`（または `window.__game.debug.openYard()`）: 全種類が平らな地面に 2 列（南向き・北向き）で並ぶ（07d-2b: 地図の東端 x = 990 を越えると次の通りに折り返す。07d-2d: 通りの間隔はその通りに並ぶ最も奥行きの深い種類で決まり、1 本目 z = 520 から +z 側・−z 側へ交互に足していく。通りは建物の正面から 9m）。`debug.enterables()` で一覧、`debug.enterable(i)` で部屋・通過点、`debug.pathTo(x, y, z)` で経路、`debug.teleport(x, z, yaw, pitch, y)` で中へ（y を渡さないと屋根の上に立つ）
- e2e の雛形: `e2e/buildings.spec.ts`（歩いて入る・上る・窓から撃つ・ゾンビが追ってくる・段階の切り替え・性能）

### 大きな建物の部品（07d-2d、`src/gen/buildings/defs/public/common.ts`）

学校・病院・工場のような大きな建物は、敷地の一部に立つ棟をいくつも組み合わせる。kit.ts は変えずに、次の補助を足した（他のカテゴリも自由に使ってよい）:

- `wing(k, spec)`: x 方向に長い棟 1 つ（何階でも）。廊下（前・後・中）、両側か片側の部屋（`bays` で階ごと・側ごとに用途と長さ。合計は棟の長さに合わせて伸縮）、両端の折り返し階段（階段室の脇に便所・倉庫）、1 階の扉と連窓、2 階以上は `facade`、陸屋根（屋上へ出られる塔屋つき）か勾配屋根。**廊下は部屋の区切りごとに部屋を分けて `join` する**（廊下 1 部屋に出入口が 20 も付くと、カタログのテストの直線の検査が 5 秒を超える）。部屋に外への扉を付けるのは `bay.outer`（位置 `at` もずらせる）、廊下側の扉の位置は `bay.doorAt`
- `hall(k, spec)`: 高い 1 部屋（体育館・工場・倉庫）。扉、低い窓と高い窓（連窓と柱）、切妻・陸・鋸屋根
- `catwalk(k, level, ...)`: 壁沿いの鉄骨の通路（`level` 階の高さ）と、壁へ向かって上る直階段。階段の足元は部屋の中ほどに出るので、出入口どうしの直線を塞がない
- `slab`（任意の長方形の床・屋根。穴あき）、`mesh`（金網のフェンス。弾と視線は通す）、`truck`、`stripe`、家具の詰め方（`classroom` `lab` `office` `nurse` `ward` `shelves` `toilets` `kitchen`。廊下側の 1.4m を空ける）
- 大きな広間（工場など）は **扉の並ぶ壁沿いに 7m の通路を空け、機械はその奥に置く**。扉・階段の足元・倉庫の扉がすべて通路に面していれば、出入口どうしの直線の検査が通る
- 窓は 1 枚ずつではなく、扉と扉の間を 1 枚のガラスにして柱を立てる（窓 1 つ 4 部品 → 柱 1 部品）。間口 90m の学校でも外観 4,000 三角形に収まる
- 経路: 扉が多い建物では「外に出て別の扉から入る」経路が建物の中の経路と同じ長さになりやすい。07d-2d で `roomRoute` が外を経由する経路につながり 4 本ぶん（`TACTICAL.interior.outsideCost`）を足すようにした

## 11. よくある失敗

- 庇・看板・踏み石に当たり判定がある → 敷地の外の当たり判定はテストで落ちる（`solid: false`）
- 扉のすぐ外（0.6m）に塀や金網 → 平地でも人が通れない。`node tools/real/doors.ts` が「stopped by own」として数える（09b）
- 開口が重なる → `finish` ではなく `wall` の時点で例外。`evenly` で配ると重ならない
- 扉の前に家具 → 「something stands between two ways」。扉の内側 1.4m は空ける
- 部屋が長方形でない空間を 1 部屋にした → 直線の検査で落ちる。分けて `join`
- 2 本目の折り返し階段の上で天井に頭が当たる → `stairs` を使えば上階の床に穴が開く。自分で床を張るときは `hole`
- 上の階の部屋の矩形が階段の穴の上にかかる → 上っている途中で部屋が切り替わってゾンビが迷う。穴の上は部屋にしない
- 高い部品（塔屋・給水塔・看板）が `roofRise` を超える → 外形の箱から出て当たり判定が切れる。テストが落とす

## 12. 4 つ目を作ってみた記録（07d-1）

この手引きだけを見て `house.hiraya`（木造平屋: 玄関・居間・台所・寝室、切妻）を `defs/house/hiraya.ts` に書き、`catalog/house.ts` に 1 行足した。手直しなしで全テスト（決定性・上限・到達性・直線・4 方向の歩行）が通り、`?yard=1` に並んだことを確認してから消した（平屋は 07d-2a が作る）。かかった作業: ファイル 1 つ（約 50 行）と登録 1 行。

## 13. 高い建物と階の繰り返し（07d-2c）

10 階を超える建物は、全階を作り込むと三角形（外観 3,000）と生成時間（4ms）を超える。ビル（`defs/office/`）は次のように作った。補助は `defs/office/common.ts`（kit.ts は変えていない）:

- **外観は階ごとに数えない**: `curtain` / `curtainAll` は多層の外壁を「階ごとの帯（腰壁）1 本＋全高の柱＋側面ごとのガラス 1 枚」で作る。窓ごとに壁を切らないので、三角形は「階数 × 側面 × 12」と柱の本数ぶんしか増えない（32 階で外観 2,900 前後）。割れた窓だけガラスを分ける（割れた区画は見えない板）
- **入れない階に部屋を作らない**: `towerFloors` は全階にコア（折り返し階段・使えないエレベーター・トイレ・踊り場のホール）を作り、入れる階だけ `plate` で部屋と家具を作る。他の階は踊り場のホールの扉が施錠（時々バリケード）で、ガラス越しに見える机の列を当たり判定なしで置くだけ。施錠の階が続くところのコアの壁はその階数ぶんの高さの箱 1 つ。階段は屋上まで続く。どの階も同じ間取りなので、平面図（`buildings:preview`）は同じ間取りが続く階を 1 枚にまとめて描く
- **家具は 2 回目の組み立てで置く**: `twoPass` は同じ乱数で 2 回組み立てる。1 回目で各部屋の出入口（扉・join・階段の端）を求め、2 回目に `Fit` が家具を「出入口どうしの直線から 0.45m・壁・他の家具・探索ポイントの立ち位置」を避けて置く（置けない場所は飛ばす）。構造は `k.rand()`、家具は `f.rand()` から引く。1 回目は部屋と階段だけ作り、壁・join・階段は kit と同じ式で通過点を記録するだけ（箱・床・`finish` なし）。出入口は部屋の階と矩形で引くので、家具の無い階（施錠の階）は 1 回目で省ける
- 屋上: `coreRoof`（塔屋・機械室）、`ringRooms`（屋上の部屋）、`helipad`（塗装だけ）、`guardRail`（パラペットの上の手すり。立てば撃てる高さ）、`mast`。高層の屋上は狙撃の射点になる
- 1 階に別の種類を入れる: `embedGround(完成した設計図, 1 階だけの設計図, dx, dz)` は部屋・通り道・開口・探索ポイントの番号を付け替えて合わせる（テナントビルが `shop.konbini_tenant` を入れる）。床高と階高が同じこと、受け側は 1 階のその枠に何も作らないこと

## 14. 駅と空港・敷地いっぱいの施設（07d-2e）

駅（`defs/transport/station_*.ts`）と空港（`airport_*.ts`）は、線路・ホーム・滑走路を含む **敷地全体** を 1 種類にした（最大 850 × 280m）。補助は `defs/transport/common.ts`・`parts.ts`・`airport_parts.ts`（kit.ts は変えていない。他のカテゴリも自由に使ってよい）:

- `track` / `wire` / `mast`（線路は描くだけ。地面を歩ける）、`car` / `train`（止まった電車。**開いた車両は部屋**（用途 `train`）で、ホーム側の扉から入る。長いすと荷物の探索ポイント。閉じた車両の続きは箱 1 つにまとめる）、`platform`（ホームの床は 1 階の床＝`plinth`。上に立つ階段・柱を避けて長方形の部屋に分け、`join` でつなぐ。60m ごとにも区切る）、`splitRooms`（任意の床を障害物の周りの部屋に分ける。x 方向・z 方向）、`flight`（x 方向の直階段と囲い）、`fence` / `paint` / `pave` / `bus` / `shelter` / `plane`（駐機中の航空機）/ `canopy` / `nameBoard`
- `stationHouse`（階段コア・中央の広間・左右の翼の部屋・2 階の背面の改札・前面のカーテンウォール・屋上。`deck`／`back0`／`back1` で 2 階の前面の扉、1 階の背面の外への扉、2 階の背面の扉（搭乗橋）を足せる）、`islands`（島式ホームと線路と電車、2 階の橋上コンコース。各島へ下りる階段）、`tower`（背面左のコアの階段で上る塔。入れる階だけ部屋を作り、他の階は踊り場の扉を施錠）、`terminal` / `controlTower` / `hangar` / `jetway` / `runway` / `taxiway`
- **`def.storeys` より上の階**: 部屋は高さで探されるので、建物は `roofRise` の中で `storeys` より上に階を重ねてよい（ホテル・百貨店・管制塔）。遠景の外形の箱は軒（`storeys` の高さ）までなので、線路・滑走路が大半の敷地でも低い箱で済む。`triangleCount` はそれらの階の内部を屋上の階にまとめて数える（政令市の駅・大空港は `limits` を上書きした）。平面図（`buildings:preview`）はそれらの階も描く（大きな敷地では 1 m あたりの画素を減らし、上の階は部屋の周りだけ描く）
- 大きすぎる種類は **別の試験用の地図**（`?yard=2`）に並ぶ: 中間の大きさが間口 300m か奥行き 100m を超えるもの（`bigForYard`）。ふつうの試験用の地図には出ない
- 部屋の中の直線の検査（`tests/buildings.test.ts`）は、部屋の出入口の外接矩形（＋0.3m）にかかる当たり判定だけを見る（同じ検査で速い）。それでも出入口が 10 を超える部屋が長いと重いので、ホームは 60m ごとに区切る
- 生成時間: 政令市の駅（3 棟＋8 線）は Node で 2.3〜3ms（この上限の 4ms に近い。重い既存の種類と同程度）。家具は `Fit` の格子を小さめに（`gondolas` の `max`）。屋内のゾンビの経路のため、長いデッキ・コンコースも長方形の部屋をつないで作る

## 15. 自衛隊の施設と「鍵」（07d-2f）

野営基地の残骸 10 種類（`military`）と駐屯地・基地 5 種類（`base`）は、敷地全体を 1 つの設計図にした（07d-2d・2e と同じ）。補助は `defs/military/parts.ts`（野営の部品）と `defs/base/sdf_parts.ts`（駐屯地の建物）。kit.ts は変えていない。他のカテゴリも自由に使ってよい:

- `tent`（キャンバスのテント: 薄い壁＋切妻、出入口のめくれた幕）、`fallenTent`、`pit`（土嚢の陣地: 胸の高さの土嚢の輪に切れ目＝外への扉。部屋になる）、`bags`、`watchtower`（監視塔: 足元の小屋・折り返し階段・2 階分上の見張り台。階高から階段の奥行きを決める `towerSize(k)`）、`container`（コンテナ: 端の扉が開いていれば部屋）、車両 `jeep` `mtruck` `apc` `tank` `heli` `fighter`（どれも外観の箱、`burnt` で焼けた色）、`drums` `crates` `net`（偽装網）`mastAntenna` `helipadH` `flagPole` `barrier` `wire`（鉄条網: 人とゾンビは止め、弾と視線は通す）`scorch`、家具 `cots` `medical` `command` `supplies`（Fit で置く）
- `sdf_parts.ts`: `hq`（本部。`wing` の 2〜3 階。2 階に司令の部屋＝金庫、1 階に武器庫（施錠））、`barracks`（隊舎。2 段ベッドの居室、食堂・武器庫を入れられる）、`lockedBlock`（入れない棟: 窓の帯と施錠の扉だけ。生成時間と三角形を節約）、`motorPool`（車両整備場）、`messHall`、`gym`、`depot`（覆土式の弾薬庫）、`guardHut` `mainGate` `perimeter` `training` `rifleRange` `vehicleRow` `parade`、種類の定義 `sdfDef`
- **床のない部屋に注意**: 屋外に置く小さな部屋（舷梯の足元など）にも `k.floor(0, ...)` を張る。床がないと地面（y = 0）と `plinth` の差で階段の 2 段目が足に当たり、歩行の検査で止まる

### 鍵（施錠の扉を後から開ける）

武器・弾薬が取り放題にならないよう、弾薬庫・武器庫は施錠し、**同じ設計図の中の「金庫」（収穫表 `safe`）を探索すると開く**:

1. 施錠の扉（`k.door(at, 'locked')`）と、その奥の施錠の部屋（`room(..., { locked: true })`）を普通に作る
2. 金庫は収穫表 `'safe'` の探索ポイント（施錠でない部屋に置く）
3. `generate` の最後に `keyDoors(bp, [[階, 矩形], ...])`（`defs/military/parts.ts`）: 矩形の中の施錠の扉が「鍵の扉」（`Opening.key`）になり、扉板（`Part.key`）・奥の部屋（`Room.key`、`locked` のまま）・扉を通る経路（`bp.keyLinks`）が記録され、`safe` の探索ポイントが `SearchPoint.key` になる。`sdfDef` と野営の `camp` はこれを自動で呼ぶ
4. 実行時: 区域の探索ポイントでは金庫が建物の先頭に来て、鍵の部屋の棚も探索ポイントに入る（`LootSpot.key` / `.enter`）。金庫を探索すると `applyKeys`（`sim/tactical/area.ts`）がその建物の配置を `open: true` の写しに替え、`openBlueprint`（`gen/buildings/index.ts`）が扉板を消し・経路を足し・部屋の施錠を解く。当たり判定・屋内の経路・描画はすべて配置から作られるので自動で切り替わる。区域に入り直したとき・ロードしたときも探索の状態から決め直す
- テストは鍵の扉を施錠の扉として扱う（到達性・歩行の検査から外れる）。開いた後の検査は `tests/buildings-military.test.ts`

### 大きさ
- 野営 30〜120m、小さな駐屯地 150〜180 × 90〜100m はふつうの試験用の地図（`?yard=1`）。中・大の駐屯地（大は 700〜800 × 460〜540m＝区域の大半）・海自・空自は **3 つ目の試験用の地図 `?yard=3`**（`sdfYard`、`debug.openYard(3)`）。`?yard=2` には入りきらないため
- 海自の基地は **敷地の奥 z < 42 が海**（塗装と、岸壁の縁の見えない柵）。海沿いの区域で、奥を海に向けて置くこと
