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
