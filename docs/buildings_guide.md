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
- 探索ポイント: `kind`（`shelf` `desk` `locker` `cabinet` `fridge` `counter` `closet` `crate` `bed` `table`）と収穫表 `table`。`table` を省くと部屋の用途（`RoomUse`）。表は `src/data/colony.ts` の `ROOM_LOOT`（05 の値 × 07e の `LOOT_SCALE`）。用途を足したら表にも行を足す（無い id は土地の表になる）。特別な棚は `pharmacy` `grocery` `tools` `weapons`
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
- ゲームで `?yard=1`（または `window.__game.debug.openYard()`）: 全種類が平らな地面に 2 列（南向き・北向き）で並ぶ。`debug.enterables()` で一覧、`debug.enterable(i)` で部屋・通過点、`debug.pathTo(x, y, z)` で経路、`debug.teleport(x, z, yaw, pitch, y)` で中へ（y を渡さないと屋根の上に立つ）
- e2e の雛形: `e2e/buildings.spec.ts`（歩いて入る・上る・窓から撃つ・ゾンビが追ってくる・段階の切り替え・性能）

## 11. よくある失敗

- 庇・看板・踏み石に当たり判定がある → 敷地の外の当たり判定はテストで落ちる（`solid: false`）
- 開口が重なる → `finish` ではなく `wall` の時点で例外。`evenly` で配ると重ならない
- 扉の前に家具 → 「something stands between two ways」。扉の内側 1.4m は空ける
- 部屋が長方形でない空間を 1 部屋にした → 直線の検査で落ちる。分けて `join`
- 2 本目の折り返し階段の上で天井に頭が当たる → `stairs` を使えば上階の床に穴が開く。自分で床を張るときは `hole`
- 上の階の部屋の矩形が階段の穴の上にかかる → 上っている途中で部屋が切り替わってゾンビが迷う。穴の上は部屋にしない
- 高い部品（塔屋・給水塔・看板）が `roofRise` を超える → 外形の箱から出て当たり判定が切れる。テストが落とす

## 12. 4 つ目を作ってみた記録（07d-1）

この手引きだけを見て `house.hiraya`（木造平屋: 玄関・居間・台所・寝室、切妻）を `defs/house/hiraya.ts` に書き、`catalog/house.ts` に 1 行足した。手直しなしで全テスト（決定性・上限・到達性・直線・4 方向の歩行）が通り、`?yard=1` に並んだことを確認してから消した（平屋は 07d-2a が作る）。かかった作業: ファイル 1 つ（約 50 行）と登録 1 行。
