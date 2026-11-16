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

## 03 戦術3Dワールド — 2026-11-14
- 完了したこと:
  - **マップ生成**（`src/gen/`）: `generateTacticalMap({ mapSeed, land, isHome, lootSpots })` → `TacticalMap`（ハイトマップ 257²、建物、当たり判定の箱、道路、区画、樹木、草むら、岩、探索ポイント、高所の射点、開始位置、4m 通行グリッド、16m 静的ハッシュ）。5 区分すべて対応、1 回 50〜80ms
    - urban: 大通り（幅 22m）と街路の格子、中高層ビル 700 棟前後、外階段つきビル 6 棟、公園・駐車場・広場
    - suburb: 街路格子に切妻の住宅 1000 棟前後、団地（外階段）、はしごつき商店、公園、丘 1 つ
    - rural: 起伏の緩い地形に丘 3 つ、道路＋農道、集落（民家・納屋・物置）、田畑の区画、火の見櫓
    - forest / mountain: 高低差 50m / 150m 級、林道 1 本、小屋、森林には監視塔。稜線・山頂が射点
    - 高所の射点は必ず 3 か所以上（丘は周囲の木を払って見通しを確保。足りなければ鉄塔を追加）。本拠セルは中央 半径 120m を平坦化して空ける
  - **衝突・照会**（`sim/tactical/collision.ts`）: `heightAt` / `isWalkable` / `raycastWorld` / `segmentHitsStatic` / `supportAt` / `pushOut` / `ladderAt` / `createSpatialHash`
  - **プレイヤー**（`sim/tactical/player.ts`）: 視点、歩き・走り・しゃがみ・伏せ、スタミナ、地形追従、箱と幹との衝突、段差 0.5m の乗り越え（外階段）、はしご、落下、急斜面の減速。`viewRay(player)` / `headingDeg(yaw)`
  - **セル遷移**（`sim/tactical/area.ts`）: 開始直後・到着時・ロード後に区域を用意、移動中は `state.tactical = null`。同じセルは同じ地形（テスト済み）。ロード表示つき
  - **描画**（`src/render/tactical/`）: 地形（1m/texel のプロシージャル地面テクスチャ＋近景ディテール）、外周の粗い地形、建物・階段・鉄塔・はしご（窓はシェーダ）、切妻屋根、樹木（チャンク分割）、岩、草むら。空ドーム・太陽・月・星を `render/sky.ts` に追加し、光源が太陽／月に追従
  - HUD: 方位（8 方位＋度）、姿勢、スタミナ。`tools/tactical-preview.ts`（`npm run tactical:preview`）で上から見た PNG
  - テスト 27 件追加（決定的生成、区分ごとの性格、射点 3 か所 × 30 マップ、本拠の平坦化、レイキャスト、移動速度、階段・はしご・落下、4 分間のランダム歩行で埋まらない・すり抜けない、遷移とセーブ／ロード、v1 セーブの移行）。e2e に移動・姿勢・到着・ロード後の再生成・全区分の描画を追加
  - 受け入れ基準は 5 区分とも Playwright のスクリーンショットで目視確認（射点からの眺望、外階段、鉄塔、昼・夕・夜、指揮視点、幅 360px）
- **性能の実測（重要な但し書きつき）**: この環境には GPU がなく、Chromium は SwiftShader（CPU によるソフトウェア描画、4 vCPU）で動く。そのためフレーム時間は実機の目安にならない。`npm run e2e` の最後のテストが各区分の最高の射点から 4 秒間計測して出力する（1280×720）:

  | 区分 | ドローコール | 三角形 | メインスレッド(sim+描画発行) | フレーム時間（SwiftShader、中央値） | ワールド構築 |
  |---|---|---|---|---|---|
  | urban | 12 | 17.0万 | 0.9 ms | 283 ms | 286 ms |
  | suburb | 28 | 17.5万 | 0.6 ms | 233 ms | 424 ms |
  | rural | 37 | 18.6万 | 0.9 ms | 267 ms | 293 ms |
  | forest | 39 | 37.2万 | 1.1 ms | 333 ms | 276 ms |
  | mountain | 28 | 20.7万 | 1.3 ms | 433 ms | 296 ms |

  - 確かに言えるのは「ドローコール 12〜39（予算 100 未満）、三角形 40 万未満、CPU 側は 1 フレーム約 1ms」まで。**「内蔵 GPU で 60fps」は未検証**（ソフトウェア描画では画素数に比例して遅く、解像度を 1/4 にすると約 3.5 倍速くなる＝塗り律速）。実機での確認を 04 か 10 で必ず行うこと。重い場合の調整点は `RENDER.maxPixelRatio`、`RENDER.groundAnisotropy`、`RENDER.flora.grassMax` / `treeChunks`、`TACTICAL.flora.*.treesPerHa`
  - 「ワールド構築」はロード表示中に 1 回だけ起きる（大半は地面テクスチャ 1024² の生成）
- 未完了・既知の問題:
  - 影なし（接地感は弱い）。夕方の地面がやや暗い。建物は箱のみで内部には入れない（探索ポイントは扉の前の座標）
  - 外階段・屋上に手すりがない（端から落ちる。落下ダメージは未実装）。はしごは W/S のみで、途中で横に降りられない
  - 切妻屋根は描画だけで当たり判定は軒高までの箱（屋根の三角部分は弾が抜ける）。樹木は幹（高さの 55% まで）だけが弾・視線を遮り、樹冠は素通し
  - マップ外周の粗い地形には木も建物もない（フォグで薄れるが、端に立つと分かる）。区域の端 2m から先へは進めない
  - 都市・郊外が本拠になった場合も中央は空くが、道路の塗りは残る（開始地点は rural / forest なので通常起きない）
  - プレイヤーの移動は戦術モード以外では止まる（入力が来ない）。x10 でも毎ステップ更新しているが軽い
  - ゾンビ用の経路は `map.walk`（4m）だけ。階段タイルは通行不可にしてある（ゾンビは屋上に来ない前提）
- 仕様からの変更点（更新した docs）:
  - `02_systems_spec.md` に §3.6「移動（戦術層）」を追加（速度・目の高さ・スタミナ・段差・斜面・はしご・座標系）
  - `04_architecture.md` §5 に `PlayerState.vel / eye / winded` を追記、§7 を実装に合わせて書き直し（座標系、`TacticalMap` の置き場所、共通関数の一覧）、§8 に戦術ワールドの描画構成、§6 の描画入口を更新
  - `STATE_VERSION` を 2 に上げ、v1 → v2 のマイグレーションを追加（`player.vel / eye / winded` を補う）
  - M0 の仮地面・仮カメラ（`render/placeholder.ts`）は削除し、`render/index.ts` が `camera` → `sky` → `tactical-world` を登録する形にした（`unregister` は不要）
  - 目の高さは `RENDER.camera.eyeHeight` から `TACTICAL.player.eyeHeight`（1.7 / 1.0 / 0.3）へ移動。地面はプロンプトの「頂点カラー」ではなくプロシージャルな DataTexture（道路や畝を 4m 格子より細かく描くため。外周の粗い地形は頂点カラー）
- 次のセッションへの注意（04 向け）:
  - **マップの取り方**: `areaOf(state)` → `{ map, dynamic }`（`sim/tactical/area.ts`）。`map` は読み取り専用。`dynamic` は 16m 空間ハッシュで、ゾンビを `set(id, x, z)` で登録して使う。`tacticalSystem.step` の `updatePlayer` の後ろに弾 → ゾンビ → 死体を足す
  - **座標**: x 東 / y 上 / z 南、北が −z。ヨー 0 = 北向き、正で左回り。視線は `viewRay(state.player)`（原点は目の位置 `pos.y + player.eye`）。方向は `viewDir(yaw, pitch)`
  - **スコープ**: FOV は `renderer.view.setFov(度)`（`main.ts` の `renderer`、`window.__game.renderer`）。マウス感度は `updatePlayer(..., lookScale)` の第 5 引数で倍率に合わせて下げる
  - **遮蔽**: `raycastWorld(map, origin, dir, maxDist)` の `kind` で着弾の種類（土煙か壁か）が分かる。視認判定は `segmentHitsStatic`。レイはプレイ範囲 `[0,1024]²` の外に出た時点で終わる
  - **出現位置**: マップ端なら `map.spawn.edge` や `map.roads` の端点、歩ける場所は `isWalkable(map, tx, ty)`、高さは `heightAt`。移動の押し戻しは `pushOut(map, [x, z], 半径, 足元Y, 身長)`、立つ高さは `supportAt`
  - **`state.tactical` は移動中 `null`**、到着後の最初の tick で新しい区域に作り直される（zombies / corpses / bullets は空で始まる）。ロード後も同じ。`reserve` にはセルの Z を入れてあるだけなので 04 が意味を決めてよい。`wind` は `[0, 0]`
  - **本拠セル**は `map.params.isHome`。中央 `map.spawn.home`（512, 512）の半径 120m は平坦で何もない（06 の建築用地）
  - 射撃場（04 の F）は `gen/builder.ts` の `createFlatBuilder()` ＋ `addBuilding` / `addStairs` / `addTower` → `finishMap()` で手組みのマップを作れる（テストがこの方法を使っている）
  - デバッグ: `window.__game.debug.gotoLand('urban')`（その区分のセルへ瞬間移動）、`.teleport(x, z, yaw, pitch)`、`.setClock(時)`、`.renderInfo()`。`window.__game.map` で現在のマップ
  - 夜の明るさは `RENDER.sky.ambientNight` / `sunNight` と `RENDER.celestial.ambientNightColor`。フォグは 150〜800m
- 追加した共有型・コマンド・イベント:
  - 型: `PlayerState.vel` / `eye` / `winded`（`STATE_VERSION` 2）。`TacticalMap` ほか生成物の型は `src/gen/types.ts`（`GameState` には含めない）
  - データ: `src/data/tactical.ts` の `TACTICAL`（区域の寸法、プレイヤー移動、区分ごとの地形・植生・街区）、`RENDER.celestial` / `ground` / `buildings` / `flora`
  - コマンド・イベントの追加なし（区域の切り替えは `travelStarted` / `travelArrived` ではなく状態から判定している）
  - `Renderer.view`（`setFov` / `fov`）、`window.__game.map` / `.renderer` / `.debug`、npm script `tactical:preview`

## 04 狙撃・ゾンビ戦闘 — 2026-11-15
- 完了したこと:
  - **弾道**（`sim/tactical/ballistics.ts`）: 発射体（初速 800、重力、速度減衰 0.6/km）、1 ステップ 4 サブステップの中点法、線分判定（ゾンビの頭＝球・胴／脚＝カプセル、静的世界は `raycastWorld`）、貫通 2 体（2 体目 60%）、ゼロイン 100〜400m（発射角をゲームと同じ積分で数値的に解く）、風（難易度「高」か `flags.wind` のときだけ）
  - **ライフル**（`weapon.ts`、定義は `data/weapons.ts`）: スコープ遷移 0.25 秒、倍率 4〜12、揺れ（§3.3 の式。呼吸の 8 の字＋微細動）、息止め（6 秒・切れると 3 秒 ×1.6）、反動、ボルト 1.2 秒、弾倉 5、リロード 2.8 秒、空撃ち、腰だめの散布
  - **スコープ描画**（`render/tactical/scope.ts`）: 全画面三角形 1 枚。円形マスク、周辺減光、視点を振ったときに寄る影、第一焦点面のミルドット（1 目盛り = 1 mil を FOV から厳密に換算）
  - **ゾンビ**（`zombies.ts`、数値は `data/zombies.ts` と `BALANCE.zombie`）: 4 種、徘徊 → 警戒 → 追跡 → 攻撃 → 倒れる。視認（距離・視野・遮蔽・姿勢・樹冠）、仲間が倒れるのを見る／死体に出くわすと警戒、追跡開始で周囲を呼ぶ、部位判定、脚で転倒して這行化、壁沿いの回り込み、外階段を登る、遠方は 1/2・1/4 の頻度で更新。出現は `min(active, セルの Z, 150)`、補充はマップ端から 20 秒に 1 体
  - **耳・ナイフ・被ダメージ**（`combat.ts`, `health.ts`）: 死体（10 ゲーム時間、上限 200）、E 長押し 0.8 秒で耳 +2、ナイフ（背後から未発見なら一撃）、噛みつき・感染（10%、48 時間）・落下ダメージ・死亡と仮の復帰
  - **描画**: ゾンビと死体は箱の InstancedMesh（生者 1・死体 1）＋接地の丸い影、着弾の土煙／破片／血煙（Points）。解像度の自動調整
  - **HUD**: 弾倉/所持弾、ボルト・装填の表示、姿勢、体力、息ゲージ（スコープ中）、ゼロイン、倍率、耳、未回収の死体の方向と距離、E の進行ゲージ、被弾の赤み、死亡表示
  - **射撃場**: `?range=1`（または `window.__game.debug.openRange()`）。100〜600m に静止標的（後ろに板、横に距離 ÷100 本の杭）と歩行標的、100m 列に走行・肥大・這行。世界データ不要。倒した標的は 4 秒で戻る
  - テスト 29 件追加（`tests/combat.test.ts`）: 落下量と飛翔時間が解析値と一致、各ゼロイン距離で照準点に着弾、貫通、見越し射撃、部位ダメージ、ボルト・弾倉・リロード、揺れの式、反動、ナイフ、耳、落下、視認、樹冠、追跡・噛みつき、警戒、階段／鉄塔、回り込み、囲まれて死亡と復帰、150 体の負荷、開始セル、Z の減算が 1 回だけ、補充と Z=0、ロード後の再配置、感染死、都市セル。e2e に射撃場（スコープ → 300m ヘッドショット → 耳回収 → 150 体の計測）と本拠セルでの 1 発を追加
- **手触りの確認結果**（射撃場をスクリーンショットで目視＋ヘッドレスで集計。実機のマウスでは誰も撃っていない）:
  - 100m ゼロのまま 400m の頭を狙うと、着弾は 3 つ目の点のすぐ上（2.8 mil 下）に土煙が出る。目盛りでの見越しは成立している
  - 照準を頭の中心に置いてタイミングを選ばずに撃ったときの命中率: 伏せ 200m 100% / 300m 98% / 400m 68%、伏せ＋息止めは 400m で息が続く 6 秒以内ならほぼ揺れない（息切れ後を含む集計では 77%。「ほぼ 100%」は推定で計測値ではない。600m は未計測）、しゃがみ 200m 28%（息止めで 73%）・400m 7%、立ち 100m で頭 27%・胴 95%、立ち 200m 胴 37%。「伏せ＋息止めなら狙えば当たる／立ちは近距離のみ」になっている
  - 着弾までの間は 400m で 0.57 秒。反動は約 0.4 秒で戻るので、着弾（血煙・土煙）はレティクルが戻ってから見える
  - **未確認**: 揺れ・反動・マウス感度の体感、歩行速度と回収の退屈さ。数値は `BALANCE.combat` と `data/weapons.ts` にまとめてあるので 09 で実機調整してほしい
- **性能の実測**（GPU なし・SwiftShader。fps ではなく 3 指標で判定）:
  - 射撃場に **150 体**（1280×720、等倍）: ドローコール 7、三角形 15.0 万、メインスレッド（sim＋描画発行）1.35 ms/フレーム。ゾンビ関連の追加はドローコール 3〜5（生者・死体・影・エフェクト・スコープ）、三角形は 1 体 72
  - シミュレーション単体: 150 体で 0.06〜0.08 ms/ステップ（ブラウザ内計測）。都市セル（78 体）で 0.04 ms/ステップ（Node）
  - 5 区分の再計測（ゾンビ込み、等倍）: urban 14 / 17.7 万 / 1.36 ms、suburb 28 / 17.5 万 / 0.83 ms、rural 37 / 18.6 万 / 0.96 ms、forest 39 / 37.2 万 / 0.97 ms、mountain 28 / 20.8 万 / 1.43 ms（ドローコール / 三角形 / メインスレッド）。予算（150 未満・50 万未満・4 ms 未満）の内側
  - 解像度の自動調整はソフトウェア描画では数秒で下限 0.5 まで下がる（＝働いている）。**スケール変更時の描画バッファ再確保は SwiftShader だと 100ms 以上かかる**ので、計測中は `setAutoResolution(false)` にしている。実 GPU での確認は依然として未実施
- 未完了・既知の問題:
  - **死亡は仮実装**: 4 秒後に区域の開始位置で復帰、耳 0・弾 40・感染解除、周囲 60m のゾンビを消す。05 が「3 日後に司令部」へ置き換える（`combat.ts` の `revive`）
  - **セーブ時に zombies / corpses / bullets は保存しない**。ロード後はセルの Z から配置し直す（`tactical.populated` を false にして保存）。未回収の死体と耳はロードで消える
  - 開始時の所持弾 100 発は仕様 §5 の「初期 弾薬 100」をプレイヤーの所持に置いたもの（コロニーの備蓄は 0 のまま）。`resupply` コマンドは未実装。05 で備蓄と所持の配分を決めること
  - ゾンビの移動は直進＋壁沿いの回り込み。凹んだ地形や密集した建物では遠回りしたり、しばらく引っかかることがある（フローフィールドは 06）。ゾンビ同士は押し合うだけで、屋上から落ちてもダメージはない
  - はしご・鉄塔の上は噛まれないが、下に集まった個体は降りるまで離れない（追跡は視線が切れて 8 秒で解ける）。伏せると屋上の縁で視線が切れやすい
  - 射撃場の標的は `dummy` 付き（動かない・襲わない）。耳は取れるが射撃場の状態はセーブされない
  - 弾の軌跡（トレーサー）と銃口の演出はない。音は 08（イベントは発火済み）
  - HUD は 10Hz 更新なので、息ゲージと回収ゲージの動きはやや粗い
- 仕様からの変更点（更新した docs）:
  - `02_systems_spec.md` §2.3（同時出現数は `min(active, Z, 150)`、初期配置）、§2.4（開始セルは Z ≥ 40）、§3.2（倍率の基準、解析式と落下表、ゼロイン、レティクル、反動・腰だめ・所持弾）、§3.3（揺れの形、追従、目安の命中率）、§3.4（姿勢・樹冠・警戒・呼び寄せ・攻撃・階段）、§3.5（仮の復帰、落下ダメージ）、§3.6
  - **倍率の基準を「縦視野 40° = 1 倍」にした**（`BALANCE.combat.scope.referenceFov`）。腰だめの 70° を基準にすると 12 倍でも 400m の頭が 720p で 3px しかなく、精密射撃にならないため。12 倍で 1 mil ≒ 12px（720p）
  - **フォグの開始を 150m → 260m**（`RENDER.fog.near`）。300m 以遠の標的のシルエットが霞みすぎていた
  - 都市セルの同時出現は式どおりだと 78 前後（Z 10 万）。上限 120 に達するのは Z が 1 億のときだけ
  - `STATE_VERSION` 3（`player.aim` と所持弾を補うマイグレーション）
  - 画面中央の点（`.crosshair`）は削除（非スコープ時は照準点なし）
- 次のセッションへの注意:
  - **05 向け**: `playerDied{cause}` → `combat.ts` の `revive` を置き換える。弾の補給は `resupply` コマンド（`sim/tactical/index.ts` の `commands` に口だけある）。耳は `player.inv.ears`、回収時に `earsCollected{amount}`。本拠セルには中央 150m より外にゾンビが出る（視認 40m なので拠点には基本来ない。襲来は 06）
  - **06 向け**: ゾンビの移動は `zombies.ts` の `moveToward`（目標点へ直進）。フローフィールドは `updateOne` の `chase` / 新しい状態から目標点を差し替えれば載る。壁への攻撃値は `ZOMBIES[kind].wallDps`。`Zombie.target` は今は `'player' | null` だけ使っている。ゾンビの追加は `addZombie`
  - **07 向け**: `data/weapons.ts` の `WEAPON_MODS` に `{ tech, patch }` を足すと `weaponOf(state)` に反映される（大口径 = `damageMul`、半自動 = `boltTime: 0`、光学 = `zoomMax`、貫通 = `pierce`）。風は `state.flags.wind = true`
  - **08 向け**: 音・演出用のイベントは `shotFired{scoped}`, `dryFire`, `reloadStarted`, `reloadDone`, `bulletHit{part, surface, range, killed}`, `zombieKilled{headshot, knife}`, `zombieAlerted`, `knifeSwing`, `earsCollected`, `playerHurt{cause}`, `playerInfected`, `playerDied`, `playerRevived`
  - 1 秒 = ゲーム内 1 分。死体の期限 10 ゲーム時間は実時間 10 分、感染 48 時間は 48 分
  - デバッグ: `debug.setInput({ scope: true, fire: true, ... })`（ヘッドレスではポインタロックが取れないので入力を上書きする口）、`debug.spawnZombies(n, 半径, 種類)`、`debug.openRange(noSway)`、`renderer.resolutionScale()` / `setAutoResolution(false)`、URL `?range=1` `?res=fixed`
- 追加した共有型・コマンド・イベント:
  - 型: `PlayerState.aim`（`AimState`、`defaultAim()`）、`InputFrame.interactHeld`、`TacticalState.populated / spawnT / step / rangeT`、`Zombie` の作業用フィールドと `dummy / spot`、`Corpse.kind / yaw / headshot / crippled`、`Bullet.dist / drag / gravity / weapon / pierceFactor / maxRange / lastHit`
  - データ: `data/weapons.ts`（`WEAPONS`, `WEAPON_MODS`）、`data/zombies.ts`（`ZOMBIES`, `KILL`）、`BALANCE.player`（拡張）/ `combat` / `zombie` / `range`、`BALANCE.world.start.minCellZ`、`RENDER.resolution / scope / zombies / effects`
  - イベント: `dryFire`, `reloadStarted`, `reloadDone`, `knifeSwing`, `playerInfected`, `playerRevived`, `zombieAlerted`。既存イベントへのフィールド追加は `04_architecture.md` §6
  - フラグ: `state.flags.range`（射撃場）、`flags.noSway`、`flags.wind`
  - コマンドの追加なし

## 05 生存者・経済 — 2026-11-15
- 完了したこと:
  - **生存者**（`sim/colony/survivors.ts`、数値は `data/colony.ts`・`data/traits.ts`・`data/names.ts`）: 4 ステータス（3d4−2、土地の偏り）、賃金式、特性 13 種、日本人名。`hire` / `dismiss`、契約金（賃金 × 5。備蓄で足りなければ所持の耳から）
  - **雇用候補**: 区域ごとに探索ポイントへ潜伏者を配置（セルの H から最大 3 か所）。HUD に「人の気配 Nm」、近づいて E で会話 → 候補リスト。調達隊も連れ帰る。見つけた人数ぶん `world.cells.H` を減らし、待ちくたびれ・解雇・離反で H に戻す
  - **探索**: 探索ポイントで E → 物資を所持品へ、セルの loot を消費（プレイヤーの探索はどのプロンプトにも無かったので最小限で入れた）
  - **仕事**（`jobs.ts`）: 8 種、作業量式、1 日の予定、分単位の成果加算。農業（仮の畑 1 区画・季節係数）、調達（在宅時は本拠セルを漁る）、工作（手作業 50% の弾薬）、医療、建築・研究・防衛は受け口
  - **行動 AI**（`ai.ts`）: 予定 → 行動 → 場所 → 歩行。直線が通らなければ 4m グリッドの幅優先探索。プレイヤーが本拠セルにいる間だけ動く
  - **経済**（`economy.ts`, `stock.ts`）: 備蓄と容量、06:00 の賃金（不足時は能力の高い順に未払い）、食事 3 回、食料市場（価格式）、農村からの購入と自動購入方針、台帳 30 日、ログ 200 件
  - **士気・健康**（`morale.ts`）: 食事・賃金・住居・仲間の死、3 日で離反（物資を持ち去る）、負傷・感染の経過と治療、餓死。プレイヤーの感染治療（医薬品 1 ＋ 医療 8 ポイント、本拠セルで）
  - **プレイヤーの死**: 共同体がいれば所持品を失って 3 日後に司令部（`flags.skipMinutes` で時間を飛ばす）、いなければ敗北画面
  - **弾と耳の流れ**: 本拠セルで耳・物資は自動納品、`resupply`（B キー／経済タブ）で備蓄 → 所持（上限 150）
  - **遠征**（`expeditions.ts`）: 編成（2〜6 人）、`findRoute` による所要時間、帰還判定、収穫、loot 消費、`removeZombies`、耳、連れ帰り、読み物ログ（誰が何を見つけ、誰が戻らなかったか）
  - **描画**（`render/tactical/survivors.ts`）: 箱の InstancedMesh（人物・影・仮の野営地で 3 ドローコール）。仕事ごとの上着の色と持ち物（麦わら帽・ヘルメット・長物・背嚢・赤十字…）、歩く／働く／座って食べる／寝る。潜伏者は黄色で手を振る
  - **UI**（`ui/command/`）: 指揮層パネル（生存者一覧と仕事のドロップダウン、雇用候補、経済と台帳、遠征の編成と進行、ログ）。戦術 HUD に会話・探索・補給の案内と直近ログのトースト、敗北画面
  - テスト 25 件追加（`tests/colony.test.ts`）: 賃金・作業量・帰還率の境界値、29 日回して台帳と備蓄が全資源で一致、未払い → 士気低下 → 離反、飢餓、**x1 / x10 / x30 / 5 分刻み / プレイヤー在宅（全システム）で 1 日の成果が一致**、武器別の帰還率を各 600 人で統計確認、遠征の時間経過とログ、連れ帰りが H を超えない、不正な命令の拒否、遭遇 → 雇用 → 解雇、納品と補給、治療、死亡と復帰・敗北、06/07 向けの口、セーブ往復と v3 からの移行。e2e 2 件追加
  - 受け入れ基準は e2e とスクリーンショットで確認（潜伏者に E → 候補 → 雇用 → 農業に割り振り → 2 日後に食料・木材が増え賃金が引かれている → 遠征の出発 → ログ、幅 360px、敗北画面）
- **性能の実測**（GPU なし・SwiftShader）:
  - 共同体の更新（生存者 60 人、Node）: step 0.005 ms、分境界の tick で 0.022 ms（基準 1 ms 未満）
  - 本拠の野営地に 58 人（1280×720）: 戦術視点 28 ドローコール / 25.2 万三角形 / sim 1 ステップ 0.018 ms ＋ 描画発行 0.36 ms。指揮視点（60 行のパネル表示中）38 / 34.0 万 / 0.018 ＋ 0.26 ms
  - **計測方法の注意**: 従来の「メインスレッド ms/フレーム」（`renderInfo().cpuMs / frames`）は、ソフトウェア描画で 1〜2fps まで落ちると 1 フレームに sim 6 ステップと UI 同期がまとまるため、フレームレートに引きずられる（同じ場面で 1.3〜4.0 ms とぶれた）。05 の e2e は sim 1 ステップと `renderer.draw` 1 回を直接測って判定し、フレーム平均は参考値として出している（上の場面で 1.6 ms / 2.0 ms）
  - 指揮パネルは 60 行 × 仕事 8 択を 10Hz で作り直すと 1 回 6〜8 ms かかったので、行を署名文字列でメモ化した（`SurvivorRow`）
- 未完了・既知の問題:
  - **バランスは未調整**。目安: 平均的な生存者の賃金 4 耳/日、農家 1 人で約 4 食料/日（3〜4 人を養える）、仮の畑は農家 2 人まで。6 人雇うと賃金だけで 1 日 20 耳前後（ゾンビ 10 体）。野宿（5 人目以降）は差し引き士気 −1/日で、住居（06）ができるまでじわじわ下がる
  - 生存者に当たり判定はない（弾もゾンビも素通り。ゾンビは生存者を襲わない）。襲来での被害は 06
  - 仮の野営地（テント・畑・作業台）は見た目だけで衝突も建築グリッドの占有もない。06 が実物に置き換えるときは `COLONY.camp` の座標と `render/tactical/survivors.ts` の `buildCamp` を消す
  - 遠征中の生存者は食事をしない（携行食の扱いなし）。自動で遠征に出す方針はない（毎回プレイヤーが編成）
  - 弓・拳銃・小銃は最初から選べる（`EXPEDITION_WEAPONS[].tech` を 07 が埋めれば研究で解禁になる）。拳銃・小銃は弾薬の備蓄が要る
  - 潜伏者は 2 日ごとに同じセルへ再配置されるので、H が多いセルでは事実上いくらでも勧誘できる（歯止めは耳）
  - 3 日間の時間飛ばしは 1 tick の中で 4,320 分ぶんのフックを回す（数十 ms）。その間に襲来（06）が起きる場合の扱いは 06 で決めること
  - ログ文は `ui/i18n/ja.ts` のキー＋パラメータで保存している。キーを消すと古いセーブのログがキー名のまま表示される
- 仕様からの変更点（更新した docs）:
  - `02_systems_spec.md`: §3.5（死亡・敗北・治療）、§4.6 実装メモ（予定、健康係数、農地の人数、在宅調達、住居、負傷、候補、探索、遠征の細目）、§5 実装メモ（弾と耳の流れ、食料市場、農村、容量、台帳）
  - `04_architecture.md`: §5 に 05 の追加フィールドと「共同体」の節、§6 にコマンド・イベント、§8 に生存者の描画
  - `STATE_VERSION` 4（v3 → v4: 共同体の初期化。v3 以前に生存者はいない）
  - `Survivor.status: 'dead'` の要素は配列に残さない（`colony.memorial` に記録）。`ColonyState.log[].text` は表示文ではなく i18n キーになった
  - `sim/index.ts` に時間飛ばし（`flags.skipMinutes`）を追加。`resupply` の担当は tactical ではなく colony
  - 基盤のテスト「ハンドラのないコマンドは警告」は `assignJob` が実装されたので `startResearch` に差し替えた（07 が実装したらまた替えること）
- 次のセッションへの注意:
  - **06 向け**: 建築 output は毎時 `distributeBuildWork(state, colony.work.build)` で設計図（`progress < 1`、`priority` の高い順）へ配っている。必要作業量は第 3 引数（今は一律 `COLONY.defaultBuildWork = 40`）。`sim/colony/index.ts` の呼び出しに `buildings.ts` の値を渡すよう直すこと。資材の消費（`Structure.delivered`）は未実装で、備蓄から取るときは `stock.ts` の `moveStock` を使う（直接 `colony.stock` を書くと台帳テストが落ちる）。防衛担当は `defenders(state)`（`onDuty` と `power`）。建物の効果は `COLONY.facilities` の def id（`farm` / `workshop` / `clinic` / `house`）を `builtCount` で数えているので、id を合わせるか表を直す。容量は `colony.capacity` を増やす。耳の自動回収（§4.5）は `moveEars(c, 'income', n)`。生存者の経路は `ai.ts` の `findPath`（`map.walk` のみ参照。壁・堀を足したら通行判定を差し替える）。襲来撃退の士気 +5 は `morale.ts` の `changeMorale`。襲来時の避難・持ち場は `ai.ts` の `setAlarm(state, on)`（移動のみ）。`prompts/06` `07` の末尾にも同じ内容を追記した
  - **07 向け**: 研究ポイントは `takeResearchPoints(state)`（呼ぶと 0 に戻る。毎時呼ぶ想定、上限 600）。医療は「技術で解禁」だが今は最初から割り振れる。解禁制にするなら `ui/command/CommandPanel.tsx` の `JOBS` と `assignJob` に条件を足す。遠征の武器は `EXPEDITION_WEAPONS[].tech`
  - **08 向け**: 音・演出用に `survivorHired`, `survivorDied`, `survivorLeft`, `expeditionSent`, `expeditionReturned`, `wagesPaid{unpaid}`, `candidateFound`, `spotSearched`, `earsDeposited`, `resupplied`, `foodBought`, `colonyLog{kind}`, `defeat`。パネルの見た目は機能優先のまま（`ui/styles.css` 末尾）
  - **09 向け**: 調整点は `data/colony.ts` に集約。30 日回す雛形は `tests/colony.test.ts` の `rig()`（colony + world のみなら 1 日 = 1,440 tick で数 ms）
  - デバッグ: `window.__game.debug.addSurvivors(n, job)`、`.give(res, amount)`（台帳を通さない）、`.noInput`（手で `sim.tick` を回すとき用）
  - 依存の追加なし
- 追加した共有型・コマンド・イベント:
  - 型: `LedgerDay`, `LogEntry`, `ColonyState.market / work / policy / villageBought / lastMinute / memorial / metCells`, `Survivor.meals / missed / infectedUntil / fromCell / waitsUntilDay`, `TacticalState.hideouts`, `initialColony()`
  - データ: `data/colony.ts`（`COLONY`, `LOOT_TABLE`, `EXPEDITION_WEAPONS`）, `data/traits.ts`, `data/names.ts`, `RENDER.survivors`
  - コマンド: `assignJob`, `hire`, `dismiss`, `buyFood`, `sendExpedition`, `resupply` を実装、`setPolicy` を追加
  - イベント: `candidateFound`, `spotSearched`, `expeditionSent`, `earsDeposited`, `resupplied`, `foodBought`, `colonyLog`。`survivorHired`, `survivorDied`, `survivorLeft`, `expeditionReturned`, `wagesPaid`, `defeat` を発火
  - フラグ: `flags.skipMinutes`, `flags.defeat`（ほかに日次ログ抑制用の `craftIdleDay` / `noMedicineDay`）
  - キー: B（補給）

## 06 建築・防衛・駐屯地 — 2026-11-16
- 完了したこと:
  - **構造物の定義**（`data/buildings.ts`）: §6.1 の防御構造 14 種（木柵・土塁・鉄板壁・コンクリート壁、各材質の門、空堀・水堀、跳ね橋、見張り塔、有刺鉄線、自動銃座）と §6.2 の機能建物 23 種。解禁は技術 id で持ち、判定は `isUnlocked(defId, state)` の 1 か所。07 までは `BUILD.unlockAllUntilTech = true` で全解禁
  - **設計図と建設**（`sim/build/blueprints.ts`, `construction.ts`）: 配置可否（範囲・占有・既存の建物や樹木・傾斜）、取消と解体（資材返却）、優先度、毎時の「資材搬入 → 工数 → 完成」、修理、堀の清掃。新規ゲームは司令部と農地 1 区画つきで始まる（05 の仮の野営地・仮の畑は撤去）
  - **構造物の働き**（`structures.ts`）: 壁（当たり判定つき、ゾンビが壊す）、門（人と弾は通し、ゾンビは止める）、堀（ゾンビだけ通れず、死体 8 体で埋まる）、見張り塔（はしごで登る射点）、有刺鉄線（減速とダメージ）、跳ね橋（警報中は上がる）、瓦礫、司令部の破壊で敗北。機能建物の収容・容量・農地・係数・士気・食事を共同体へ反映
  - **フローフィールド**（`flowfield.ts`）: 256×256 の Dijkstra（バケットキュー）。`gridRev` 変更時のみ再計算。襲来用（司令部が目標）と追跡用（プレイヤーが目標、全セル共通で 04 の引っかかり対策）
  - **襲来**（`raids.ts`）: 夜間接近、`hordeMeter` からの大群（消費ぶんを差し引く）、警告（塔＋防衛担当で 6 時間前）、120 体までの波状投入、警報（`setAlarm`）、撃退の士気、朝の耳回収。**不在時・移動中・死亡後の 3 日間は数値で解決**（`resolveAway`）し、壁の損傷・堀の死体・死傷・撃破数を `BuildState` に書く
  - **防衛担当**（`defense.ts`）: 武器別の射程・命中・間隔、塔ボーナス、視線判定（地上からは壁越しに撃てない）、屋外の生存者への噛みつき・負傷・死亡
  - **駐屯地**（`sim/world/outposts.ts`）: 設置・拡張・常駐の出し入れ、日次の襲来判定と陥落、補給（距離による遅延・中継）、駐屯地での `resupply`、ファストトラベル、戦術マップのプレハブ（柵・テント・弾薬箱・旗、当たり判定つき）
  - **海を渡る経路**: 青函・関門・本四 3 ルート（瀬戸大橋、しまなみ、明石＋鳴門）・佐渡・沖縄を `tools/data/sealinks.ts` に定義、`findRoute` と戦略地図（破線）に反映
  - **描画**（`render/tactical/structures.ts`）: 材質ごとに形と色の違う壁、門、堀（死体の溜まり具合）、塔、有刺鉄線、建物、設計図（半透明＋足場）、損傷 3 段階、瓦礫、駐屯地のプレハブ、配置カーソルとグリッド、防衛担当の曳光線。最大 4 ドローコール
  - **UI**: 指揮層の建築タブ（区分・一覧・取消/解体・回転・選択した構造物の耐久と優先度）、地面へのドラッグ配置、俯瞰カメラ（WASD 移動・Q/E と右ドラッグで回転・ホイールで拡大）、上部バーの襲来アラート、戦略地図の駐屯地（設置・拡張・常駐・補給状況・ファストトラベル）と海路、司令部破壊時の敗北文
  - テスト 16 件追加（`tests/build.test.ts`）: 堀の切れ目へ全経路が向かう／囲いきると最も弱い壁へ／埋まった堀を渡る・水堀は渡れない／再計算は `gridRev` 変更時だけで 5ms 未満、建設（資材・工数・取消・解体・修理・建物の効果・セーブ往復）、配置可否、塔のはしごとゾンビ、大群の発生・警告・到着・波、堀の切れ目に列ができる（実マップ）、柵が破られ司令部が壊れて敗北、塔の防衛担当と朝の耳、**不在時と在席時の結果の比較**、死亡後 3 日間の襲来、駐屯地の一連、**どの開始候補からも 3 地方以上に到達**。e2e 4 件追加（`e2e/build.spec.ts`）
  - 受け入れ基準は e2e とスクリーンショットで確認: ドラッグで柵 → 門に差し替え → 塔 → 建築担当が完成させる → 夜間接近を塔の上からスコープで撃つ／堀の切れ目に列ができ塔から縦一列に見える／柵が破られ司令部が落ちて敗北画面／隣のセルに駐屯地 → 補給 → ファストトラベル → 弾薬を受け取る／幅 360px
- **性能の実測**（GPU なし・SwiftShader、1280×720 等倍。sim 1 ステップと `renderer.draw` 1 回を直接計測）:
  - 襲来 116〜117 体＋生存者 30 人＋壁 587 タイル＋堀 207 タイル（塔の上から）: **24 ドローコール / 27.5 万三角形 / sim 0.25〜0.39 ms ＋ 描画発行 0.75〜1.04 ms**（予算 150 未満・50 万未満・4 ms 未満）。指揮視点では 44 ドローコール / 42.7 万三角形
  - フローフィールド 1 回 約 2.9 ms（Node。初版は 19 ms あり、クロージャと浮動小数のループ変数をやめて整数だけの内側ループにした）
  - 「内蔵 GPU で 60fps」は今回も未検証（実機なし）
- 未完了・既知の問題:
  - **バランスは未調整・実機で誰も遊んでいない**。特に: 木柵は 5 体に 7〜8 秒で破られる／司令部は建物補正（被ダメージ 2.5%）頼み／防衛担当は調整前、10 人の小銃で 150 体を全滅させたので命中と射程を下げた（今は止めきれない）。数値は `prompts/09` に書いた
  - 不在時の数値戦闘と在席時の比較は 1 条件（木柵＋門＋塔 3、45 体）だけ。壁なし・堀だけ・大規模は未検証。数値戦闘は侵入経路を 1 本とみなす（実戦では複数の壁に同時に取りつく）
  - 堀は地面を掘り下げていない（暗い面と土の縁）。プレイヤーと弾は堀を素通りする。生存者は迂回する
  - 門は常に「人は通れる」扱いで開閉の絵はない。プレイヤーが不死身に近い状態で拠点内にいると、ゾンビは司令部よりプレイヤーを追う
  - 自動銃座・市場・無線塔・発電機・発電所・学校・政府庁舎は建つだけで効果なし。駐屯地の「調達範囲」「監視」「等級 3 の農地・交易所」、F4a の堀沿い減速、F4b の二重壁、F7b 民兵制は未実装（07 へ）
  - 生存者の武器は個別に持たせていない（解禁済みで弾のある最良の武器を全員が使う）。生存者はゾンビから逃げず、警報時に司令部へ向かうだけ
  - 指揮層のパネルが大きく、建築中に拠点が隠れる（建築タブのときだけ低くしてある）。建築可能範囲の円は表示していない（範囲外はカーソルが赤くなる）
  - 駐屯地の常駐者は食事をしない。駐屯地のプレハブは見た目と当たり判定だけで、常駐者の姿は描かない
  - e2e「駐屯地」は全件を通しで回したとき 1 回だけ落ちた（単独・4 回反復では再現せず。DOM 待ちを状態の確認に替えた）。再発したら `e2e/build.spec.ts` の補給待ちを疑うこと
  - セーブ中の襲来個体は保存せず、`raid.toSpawn` に戻す（ロード後に同じ方角から入り直す）
- 仕様からの変更点（更新した docs）:
  - `02_systems_spec.md`: §3.4（襲来個体・有刺鉄線）、§4.5 実装メモ（防衛担当の表・塔・耳回収）、§6.3 実装メモ、§6.4 フローフィールド、§7 実装メモ（夜間接近の人口補正、不在時の解決）、§8 実装メモ、§8.1 海を渡る経路
  - `04_architecture.md`: §5 に 06 の追加フィールドと「建築・防衛」の節、§6 のコマンド・イベント、§7 のナビ、§8 の構造物描画と指揮カメラ
  - **仕様と違う点**: 夜間接近は `× min(1, 人口/12)` で縮小し、無人の拠点には来ない（序盤に留守で即敗北しないため）。建物は壁攻撃の 2.5% しか受けない。堀は「通行不可」ではなく「死体 8 体ぶんの高コスト」（囲いきった堀だけの拠点でも、いずれ埋めて渡ってくる）。門は弾を通す
  - `STATE_VERSION` 5（v4 → v5: `build.raid / pendingEars / lastRaid`。司令部と農地は次の分境界で `foundBase` が補う）
  - `COLONY.camp` を整理（建物のないときの立ち位置だけ残した）、`COLONY.facilities` / `housing` / `farm.provisionalPlots` を削除。`farmPlots` / `housingBeds` / `facilityFactor` は建物の定義から計算。05 のテスト 3 件を新しい前提に合わせた（夜間接近を避けるため本拠セルの Z を 0 にする、司令部ぶんの添字、セーブ版数）。02 のテスト 2 件は「北海道へ行けない」→「青函で行ける、対馬へは行けない」に変更
  - `RENDER.camera.commandHeight / commandBack` を `commandPitch` に置き換え（距離と向きは `core/view.ts`）、`RENDER.survivors.camp` を削除
  - 依存の追加なし
- 次のセッションへの注意:
  - **07 向け**: `prompts/07` の末尾に追記した（解禁の入口、`unlockAllUntilTech` を false にすること、既に `hasTech` で読んでいるボーナスの一覧、残した未実装）
  - **08 向け**: `prompts/08` の末尾（イベント一覧、建築パネルの配置、チュートリアルで伝えること）
  - **09 向け**: `prompts/09` の末尾（見てほしい数値、テストの雛形）
  - 構造物を足す手順: `data/buildings.ts` に定義 → 必要なら `structures.ts` の `tileCost` / `addSolids` と `render/tactical/structures.ts` の描き分け → `ui/i18n/ja.ts` に `bld.<id>`
  - 構造物の変更は必ず `build.gridRev++`（オーバーレイ・当たり判定・フローフィールド・描画がこれで更新される）。`state.build.structures` を直接いじるデバッグコードも同じ
  - デバッグ: `window.__game.debug.build(def, tx, ty, rot)`（完成品を置く）、`.horde(size, dir)`（今すぐ大群）、`.view`（指揮カメラ）、`state.flags.unlockAll = true`
- 追加した共有型・コマンド・イベント:
  - 型: `RaidState`, `RaidReport`, `SeaLink`, `BuildState.raid / pendingEars / lastRaid`, `Structure.ruinUntil / wear`, `Outpost.foundedDay / convoy`, `WorldState.travel.fast`, `pendingHorde.warned`, `Zombie.raid / moatT`, `StaticGrid.seaLinks`。`core/view.ts`（`commandView`）
  - データ: `data/buildings.ts`（`BUILDINGS`, `BUILDING_LIST`, `BUILD`, `DEFENDER_WEAPONS`, `footprint`）、`RENDER.structures`、`BALANCE.world.travel.fastMinutesPerCell`、`tools/data/sealinks.ts`
  - コマンド: `placeBlueprint`, `cancelStructure`, `foundOutpost` を実装、`setStructurePriority`, `upgradeOutpost`, `assignGarrison` を追加、`travel.fast`
  - イベント: `blueprintPlaced`, `structureRemoved`, `raidStarted`, `raidEnded`, `defenderFired`, `survivorHurt`, `outpostUpgraded`, `outpostSupplied` を追加。`structureDamaged`, `structureDestroyed`, `structureBuilt`, `moatBridged`, `hordeWarning`, `hordeArrived`, `outpostFounded`, `outpostLost`, `defeat{reason:'hqDestroyed'}` を発火
  - フラグ: `flags.colonyAlarm`（05 の口を使用）, `flags.skipping`, `flags.unlockAll`


## 07 技術ツリー・進行 — 2026-11-16
- 完了したこと:
  - **技術データ**（`src/data/techs.ts`）: 全 56 ノード（5 カテゴリ × 4 時代、排他分岐 9 組、到達技術 3）。効果は `unlock` / `modifier` / `flag` の宣言。修飾キー（`MOD_KEYS`）とフラグ（`FLAGS`）は「どこで読むか」つきの一覧になっていて、整合性テストが未知のキー・誰も設定しないキーを落とす
  - **修飾の解決**（`sim/research/modifiers.ts`）: `getMod(state, key, base)`（加算 → 乗算）、`hasFlag`、`techDone` / `techAvailable`。取得済み技術・建っている建物（`BuildingDef.mods / flags`）・難易度を 1 つの表にまとめてキャッシュ（`research.done`・`build.gridRev`・難易度の変化で作り直し）。特性は 1 人ごとの値なので従来の式のまま
  - **研究の進行**（`sim/research/index.ts`）: 毎時の RP 配分（進行中のないカテゴリの取り分は再配分）、`startResearch` / `setAllocation`、棚上げしたノードの RP 保持、排他分岐の封鎖（取得時に相手側と後続を `locked`）、時代の進行（6 個）、`techCompleted` / `eraAdvanced`
  - **研究 UI**（`ui/command/research.tsx`、指揮層の「研究」タブ）: 5 カテゴリ × 4 時代の表、前提の線（OR は破線、封鎖は点線）、状態 5 種（取得済 / 研究中 / 取得可 / 未解禁 / 封鎖＝取り消し線）、進捗バー、残り日数、配分スライダー（合計 100% を保つ）、分岐の確認ダイアログ（両者の効果と封鎖されるノードの一覧）、建国条件の進捗
  - **勝利・敗北・難易度**（`sim/research/victory.ts`）: 建国条件の判定と進捗、政府庁舎（到達技術のいずれかで解禁）の完成で `victory`、到達技術別のエンディング文＋統計、「このまま続ける」、敗北画面にも統計。難易度 3 段階は `DIFFICULTY_MODS` として `getMod` に統合
  - **`BUILD.unlockAllUntilTech` を廃止**。新規ゲームで建てられるのは木柵・木の門・テントだけ。F1 で土塁・堀・小屋、F3（定住期）で鉄板壁、と進む
  - テスト 27 件追加（`tests/research.test.ts`）: データ整合性（ID・前提・循環・分岐の対称・キーとフラグ・建物 / 装備 / 仕事 / 等級との突き合わせ・文言と配置）、**分岐 9 組の全 512 通りで全時代が開き到達技術に届く**、封鎖の範囲、修飾の合成順とキャッシュ無効化、既存システムへの反映、新規ゲームから木柵 → 土塁 → 鉄板壁、装備と仕事の解禁、RP の配分・完了・端数・棚上げ・コマンドの拒否、排他分岐（セーブ往復込み）、W5 の両側（連射数・貫通・胴 1 発・弾薬 3 倍）、民兵・自動銃座・日次の効果・感染予測（本番の乱数系列とセルを変えない）、建国宣言、時代到達日数。e2e 3 件追加（`e2e/research.spec.ts`）
- **時代への到達日数**（研究担当 4 人＝知識 6・速度 5・スタミナ 5、研究所なし、配分均等、238 RP/日。`tests/research.test.ts` の pacing が出力）: **定住期 14.6 日 / 再建期 44.3 日 / 復興期 92.5 日**。当初の費用（60〜6,000）では定住期が 3 日で来てしまうので、費用を 300〜5,000 に付け替えた（`03_tech_tree.md` と `02_systems_spec.md` §9 を更新）
- **`getMod` / `hasFlag` / `techUnlocked` に置き換えた箇所**:

  | 場所 | 以前 | いま |
  |---|---|---|
  | `build/structures.ts` `maxHp` | `hasTech('F9')` | `wall.hp`（F4b）、`defense.hp`（F9） |
  | `build/structures.ts` `refreshCapacity` | `hasTech('A2')` | `capacity.food` |
  | `build/structures.ts` `techUnlocked` / `isUnlocked` | `BUILD.unlockAllUntilTech` | `techAvailable`（`techAny` 対応） |
  | `build/construction.ts` `workOf` / 修理 | `hasTech('F4a')` / `('F4b')` | `moat.work` / `repair.speed` |
  | `build/blueprints.ts` `buildRadius` | `BUILD.radiusTech` | `build.radius`（F5, F8） |
  | `build/index.ts` `upkeep` | `hasTech('F6b')` | `wall.selfRepair` |
  | `build/raids.ts` 警告・大群上限・夜間接近 | `done.includes('C6b')`、難易度の配列 | `horde.scout`、`raid.hordeMax`、`raid.nightSize` |
  | `build/defense.ts` / `raids.ts`（不在時） | — | `ammo.issue`（W8）、`tower.range`（F8）、`defender.hit`（発電所）、狙撃手、自動銃座、民兵 |
  | `world/outposts.ts` 補給 | `hasTech('S7b')` / `('C3')` | `supply.noDelay` / `outpost.supply` |
  | `world/travel.ts` `advanceTravel` / `travelMinutesLeft` | — | `travel.time` / `travel.fast`（`travelFactor`） |
  | `world/index.ts` 大群メーター、`world/derive.ts` 同時出現数 | — | `raid.hordeGain` / `zombie.active`（難易度、C6a） |
  | `tactical/weapon.ts` `weaponOf` / `swayTarget` / リロード | `WEAPON_MODS`、`swayDifficulty` | `weapon.*` 12 キー、`weapon.sway`、夜の揺れ、`ammoPerShot` |
  | `tactical/health.ts`・`colony/expeditions.ts` 感染 | 定数 | `infection.chance` / `infection.hours` |
  | `tactical/zombies.ts` ナイフ・移動・胴ダメージ | 定数 | `knife.damage`、堀沿いの減速（`moat.slow`）、`torsoMul` |
  | `colony/jobs.ts` `workMinute` / `defenders` | — | `jobMul`（`job.<仕事>` × `job.all` × 連邦憲章）、`farm.yield`、`farm.seasonMin`、`fighters`（民兵） |
  | `colony/economy.ts` 価格・賃金・食事・弾薬製造 | 定数 | `food.price` / `food.priceMax`、`wage`（`wageDue`）、`food.use`、`craft.cost` |
  | `colony/survivors.ts` 契約金・雇用 | 定数 | `hire.fee`、`colony.popCap` |
  | `colony/morale.ts` 士気・回復・治療・離反・復帰 | 定数 | `morale.max` / `morale.hungry`、`noStarve`、`heal.rest`、`cure.medicine`、`desert.armed`、`ears.receipt` |
  | `colony/expeditions.ts` 範囲・所要・帰還率・弾薬・武器 | `done.includes(tech)` | `expedition.radius / time / bonus / danger`、`ammo.issue`、`techUnlocked` |
  | `colony/index.ts` `assignJob` | — | 医療は S4 から（`JOB_TECH`） |

- **分岐の両側**（どちらも動く。釣り合いは未調整）:
  - F4: 誘導築城 = 堀の工数 −40%・跳ね橋・堀沿いの減速 ／ 重層防壁 = 有刺鉄線・壁と門の耐久 +25%・修理 +50%
  - F7: 自動防衛 = 自動銃座（燃料と弾薬を消費。不在時の数値戦闘にも参加）／ 民兵制 = 襲来時に在宅の全員が防衛 output の 50% で戦う
  - W5: 大口径 = ダメージ ×2・貫通 4・初速 +10%／ボルト 1.8 秒・揺れ +20%・反動 +50%・弾薬 3 倍 ／ 半自動 = 弾倉 10・0.35 秒・反動 −30%／胴 −15%・貫通 1・射程 −100m（3 秒間の連射数は ボルト 3 発 / 大口径 2 発 / 半自動 8 発以上）
  - W6: 光学 = 24 倍・測距と見越しの表示 ／ 弾薬工学 = 貫通 +2・初速 +10%・空気抵抗 −20%・製造資材 −40%
  - A4: 畜産 = 畜舎（1.8 区画・士気 +2・夜間接近 +20%）／ 温室（季節の影響なし）
  - A6: 携行糧食 = 遠征範囲 +2・所要 −20%・駐屯地からの食料 ／ 醸造 = 酒場（士気 +6）・酒の売上
  - S5: 感染症学 = 感染率 ×0.4・医薬品 −50%（→ 病院・発症 7 日・感染予測・ワクチン）／ 工学 = 発電機・工作 +30%・全作業 +10%（→ 発電所・車両）。工学を選ぶと S9 は取れない（F9 か C9 を目指す。テスト済み）
  - C4: 交易 = 市場（交易収入・価格安定）・食料 −20%／賃金 +10% ／ 規律 = 兵舎・賃金 −25%・全作業 +10%／士気上限 80・離反者が弾薬を持ち去る
  - C6: 無線放送 = 毎日 1 人来訪／大群メーター +50% ／ 斥候網 = 24 時間前警告・周囲 6 セルの詳細・遠征の危険度 −0.1
- **簡略化したもの**（09 が見る）:
  - F4a「跳ね橋」は 06 の実装のまま（警報中に上がる堀の通路）。「堀沿いの速度 −20%」は堀に隣接するタイルの上にいるゾンビの減速
  - F4b「隣接する壁同士の耐久 +25%」→ 壁と門の耐久を一律 +25%（取得前に建てた壁は修理で新しい上限まで戻る）
  - F7a 自動銃座 = 防衛担当 1 人ぶんの固定火力（射程 45m・1.5 秒・命中 45%）。「電力を消費」は燃料 0.5/日（発電機を前提にすると感染症学ルートで建てられなくなるため）。燃料が 0 なら止まる
  - F7b 民兵 = 警報中に防衛担当以外も射撃に加わるだけ。持ち場は 05 の避難先（司令部の周り）のままなので、実質は「壁を破られてからの戦力」
  - F8「塔の射程ボーナス」= 塔の上の射程 ×1.25。F9「大群の規模上限を無視して耐える実績」は無し
  - W1「ナイフ強化」= ダメージ +50%。W2 は工房の解禁だけ（手作業の製造は最初からできる）。W3「矢は回収可」= 弓は弾薬を使わない（06 のまま）
  - W5a「肥大型も頭 1 発」「歩行型は胴 1 発」は全体のダメージ ×2 で実現。W6a「弾道補正マーカー」= 見越し量を mil の数字で出す。W6b「マッチ弾」= 初速 +10%・空気抵抗 −20%
  - W7 = 夜のスコープ中に環境光を緑に上げる。夜の揺れペナルティ（×1.25）は 07 が新設し、W7 で消える
  - W8「銃器配備コスト −50%」= 防衛担当・遠征隊の弾薬消費 −50%。W9 狙撃手 = 任命 UI は無く、防衛 output の上位 3 人が塔の上で銃を持っていれば自動でなる
  - A2「腐敗なし」は腐敗の仕組みが無いので無し。A4a「飼料に農地 2 区画」は無し、「家畜の誘引」= 夜間接近 +20%。A4b「部品・電力を消費」は建設費のみ。A5「燃料消費」は無し
  - A6a「常駐者の食料自給」= 常駐 1 人あたり 0.5 食料/日を本拠へ（常駐者はもともと食べない）。A6b「食料の 10% を消費」= 1 日の必要量の 10% を備蓄から引いて 6 耳/食料で売る
  - A8「飢餓イベントなし」= 食事を欠いても体力が減らない（士気は下がる）
  - S1「包帯の製造」は無し。S2 = スコープで狙った個体の種類と体力、本拠から 4 セルの概数。S4「感染の治療」は最初からできる（05 のまま）、S4 は診療所と医療の仕事の解禁
  - S5b「道具による全作業 +10%」は修飾のみ。S6a「7 日間発症しない」= 感染の期限を 48 時間 → 168 時間。S6b「電力を要する建物すべて稼働」は無し（発電所が工作・研究 +20%、防衛の命中 +8% を持つ）
  - S7a「大群の発生元セルが分かる」は無し（予測表示のみ）。S7b「燃料消費」は無し
  - S8 = 学校が建っていれば 30 日ごとに在宅者の知識 +1（賃金は据え置き）。S9「支配セル」= 本拠と駐屯地のセル
  - C1「士気の飢餓ペナルティ緩和」= 食事不足の士気低下 ×0.7。C2 を取るまで候補の能力は UI で隠れる（賃金と特性は見える）
  - C4a 交易 = 市場があれば「農村が近い ＋ 常駐者のいる駐屯地の数」× 4 耳/日。C4b「脱走」= 離反時に弾薬 20 も持ち去る
  - C5「人口上限の撤廃」のために上限 30 人を新設（`hire` が拒否。デバッグの `addSurvivors` と遠征の連れ帰り候補は対象外）
  - C6a = 無線塔があれば毎日、6 セル以内で H が最も多いセルから 1 人が候補に加わる。「拠点の誘引 +50%」= 大群メーターの蓄積 ×1.5
  - C6b「未踏セルの Z・loot・H」= 本拠と駐屯地から 6 セル以内を毎日 intel 2 に。C7「預かり証」= 死亡時に所持耳の半分が備蓄に入る
  - C8 = 設置から 10 日ごとに無料で等級 +1（常駐者がいるとき）、毎日 等級 × 3 耳。C9 = 取得時に士気 +15（1 回）、駐屯地 1 か所につき全 output +2%（最大 +20%）
  - 駐屯地: 「調達範囲 +1」= 等級 2 以上が 1 つでもあれば遠征範囲 +1（本拠中心のまま）、「監視」= 周囲のセルを intel 2 に、等級 3 の「農地・交易所」= 食料 3・耳 5 /日
  - 市場「食料価格安定」= 価格係数の上限 ×0.8。発電機 = 工作 +10%（燃料 0.3/日）
- 未完了・既知の問題:
  - **未着手**: 車両によるファストトラベルの専用演出（数値の短縮のみ）、遠征の目的地を駐屯地中心に広げること、民兵の持ち場、狙撃手の任命 UI、電力網（建物ごとの稼働条件）、畜舎の飼料、温室の維持費、研究完了時の演出と音（イベントは出ている）、研究の予約キュー（1 カテゴリ 1 ノードを手で選び直す）
  - **バランスは未調整**。分岐の両側は「動く」ことだけ確認した。気になる点は `prompts/09` に書いた（規律 > 交易、工学の全作業 +10%、大口径の弾薬 3 倍、半自動の胴 −15% が歩行型に無影響 など）
  - 費用は研究担当 4 人固定で合わせた。実プレイでは人数・研究所・学校・発電所で後半ほど速くなるはず（未計測）
  - 壁の耐久上限が上がる技術（F4b / F9）を取っても、既存の壁の現在値は上がらない（修理で上限まで戻る）。半自動化で弾倉が増えても装填済みの弾はそのまま
  - 旧セーブ（06 以前）は読めるが、技術なしで建てた建物はそのまま残り、新しく建てるには研究が要る。`STATE_VERSION` は 5 のまま（追加は省略可能なフィールドだけ）
  - 研究タブは横 1,270px の表を枠内スクロールで見せている（幅 360px では 3 列ぶんしか見えない）。08 で縮小表示などを検討
  - 「実際に遊んで分岐の魅力を比べる」ことはしていない（ヘッドレスのテストとスクリーンショットのみ）
- 仕様からの変更点（更新した docs）:
  - `03_tech_tree.md`: 全ノードの費用と効果を実装に合わせて書き直した（冒頭に注記）
  - `02_systems_spec.md`: §9 を書き直し（費用の帯、実装メモ、難易度、人口上限、夜の揺れ、日次の効果）、§9.1 建国宣言・エンディング・敗北を追加、§6.3 の「未実装の効果」を 07 の実装に置き換え
  - `04_architecture.md`: §5 に 07 の追加・削除フィールドと「研究・修飾」の節、§6 のコマンド・イベント、§7 の武器定義の説明
  - 建物の解禁を直した: 無線塔 `C6` → `C6a`、記念碑 `C6` → `C5`、政府庁舎 `C9` → 到達技術のいずれか（`techAny`）。遠征の武器に解禁技術を入れた（近接 W1 / 弓 W3 / 拳銃・小銃 W4）
  - 既存テスト: `tests/build.test.ts` と `tests/colony.test.ts` の rig に `flags.unlockAll = true`、`tests/sim.test.ts` の「ハンドラのないコマンド」は研究システムを外した sim で `startResearch` を投げる形に変更（全コマンドに担当ができたため）
  - 依存の追加なし
- 次のセッションへの注意:
  - **08 向け**: `prompts/08` の末尾（研究タブとエンディングの場所、イベント、チュートリアルで伝えること）
  - **09 向け**: `prompts/09` の末尾（調整点、見てほしい分岐、pacing の雛形）
  - 技術で数値を変える手順は `04_architecture.md`「研究・修飾」の節。`getMod` は毎フレーム呼んでよい（表の参照 1 回）
  - テストや e2e で建物・装備を使うときは `state.flags.unlockAll = true` か `grantTech(state, ['F3', ...])`（前提ごと付与。封鎖されたノードは付与しない）
  - デバッグ: `window.__game.debug.grantTech(ids | 'all')`、`.research(points)`（RP を足して 1 時間ぶん配分）、`.fulfilVictory('F9' | 'S9' | 'C9', capitol?)`（人口・駐屯地・時代・到達技術・政府庁舎を揃える。次の時報で建国宣言）
- 追加した共有型・コマンド・イベント:
  - 型: `ResearchState.progress / victory`、`Bullet.torsoMul`、`BuildingDef.techAny / mods / flags`、`WeaponDef.torsoMul / ammoPerShot`、`TechDef` / `TechEffect` / `ModKey` / `FlagId`（`data/techs.ts`）
  - データ: `data/techs.ts`（`TECHS`, `TECH_LIST`, `GOAL_TECHS`, `MOD_KEYS`, `FLAGS`, `RESEARCH`, `DIFFICULTY_MODS`, `locksOf`）、`RENDER.sky.nightVision`
  - コマンド: `startResearch`, `setAllocation` を実装、`dismissEnding` を追加
  - イベント: `techCompleted`, `eraAdvanced`, `victory{tech}` を発火。`candidateFound.by: 'radio'`
  - フラグ: `flags.endingSeen`, `flags.lostTotal`
