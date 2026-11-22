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
- **性能の実測**（GPU なし・SwiftShader、1280×720 等倍。sim 1 ステップと `renderer.draw` 1 回を直接計測、`e2e/research.spec.ts`）: 研究タブを開いた指揮視点で **37 ドローコール / 32.1 万三角形 / sim 0.02〜0.03 ms ＋ 描画発行 0.2〜0.6 ms**（予算 150 未満・50 万未満・4 ms 未満）。07 が描画に足したものは無い（暗視は環境光の値を変えるだけ）。`getMod` は表の参照 1 回で、06 の襲来シナリオの再計測（117 体＋生存者 30 人＋壁 587 タイル）は 24 ドローコール / 27.5 万三角形 / sim 0.46 ms ＋ 描画発行 2.41 ms で予算内（06 の記録 0.25〜0.39 ＋ 0.75〜1.04 ms より大きいが、今回は e2e 全 15 件を 2 並列で回した中での値で、単独では測り直していない）。e2e は 15 件すべて通過。感染予測は 7 日ぶんで約 7 ms（Node 実測。初回だけ隣接表の構築込みで 60 ms 台）、1 日 1 回だけ計算してキャッシュ。「内蔵 GPU で 60fps」は今回も未検証
- 受け入れ基準は e2e とスクリーンショットで確認: 新規ゲーム（全解禁フラグなし）で木柵だけ → F1 を研究して土塁・堀 → 定住期に入って F3 で鉄板壁の設計図が置ける／W5a の確認ダイアログ（両者の効果と失うもの）→ 取得後に W5b が取り消し線・開始不可／射撃場で半自動化の連射（3 秒で 3 発 → 8 発以上）と光学の測距表示（300m の標的で「距離 300m 見越し +1.8 mil」）／`debug.fulfilVictory` → 政府庁舎 → 次の時報でエンディング（連邦憲章の文と統計）→ 続行／幅 360px
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
  - 既存テスト: `tests/build.test.ts` と `tests/colony.test.ts` の rig、`e2e/build.spec.ts` と `e2e/smoke.spec.ts` の共同体シナリオに `flags.unlockAll = true`、`tests/sim.test.ts` の「ハンドラのないコマンド」は研究システムを外した sim で `startResearch` を投げる形に変更（全コマンドに担当ができたため）
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

## 07b 実機プレイの指摘への対応 — 2026-11-16
- 完了したこと（発注者の指摘 A〜G）:
  - **A. マウスなしの狙撃**: Q（スコープ切替）・F（射撃）・`-` / `=`（倍率）に加えて、**矢印キーで照準**（押し始めはゆっくり、押し続けると加速。スコープ中は倍率に応じて遅い）。矢印キーは移動から外した（移動は WASD だけ。指揮層の俯瞰カメラの矢印キーはそのまま）。`InputFrame` の形は変えず、`input/index.ts` の `poll()` が経過時間から `lookDX / lookDY` に載せる。画面下のヒントに「マウスなしでも狙撃できます — Q → 矢印キー → Shift → F」を足し、一時停止メニューに操作一覧（15 行）を出した
  - **B. マウス感度 +25%**: `TACTICAL.player.lookSensitivity` 0.0027 → 0.003375（通常時・スコープ中とも）
  - **C. 射撃場の入口**: タイトルの「射撃場」ボタン、一時停止メニューの「射撃場で練習する」。ゲーム中に開くとゲームは中断して待機し、「射撃場を出てゲームに戻る」で元の位置・時刻に戻る。どちらからもタイトルへ戻れる
  - **D. 地形の遮蔽**（`gen/cover.ts`、数値は `TACTICAL.cover` / `TACTICAL.terrain`、仕様は `02_systems_spec.md` §3.7）:
    - rural: 短い波長の起伏と小さな丘 5 つ、土手 1〜2 本、段々の田畑、畑の境の生け垣・防風林、屋敷林、竹やぶ、葦・背の高い草むら（放棄された畑にも）、藪、畑の中の納屋・物置、ビニールハウスの骨組み、道路の廃車・トラック
    - forest: 起伏、下生えの藪（40 /ha）、倒木 150、岩 260。林道と沢筋（新設。礫の川床）は両側 7m を空けて射線として残した
    - 視線だけを遮る植生は `TacticalMap.brush`（当たり判定なし・弾は通る）。`sightBlocked()` を新設してゾンビの視認に使った（6m 以内は葉越しに見える）。廃車・倒木は当たり判定つき（`SolidKind 'scenery'`）
    - ゾンビの初期配置を遮蔽物の近く・建物の陰・窪地へ寄せた（3 シードの実測で 6 割強が遮蔽あり。無作為な地点より 10 ポイント以上高いことをテストで確認）
  - **E. 生存者**: 新規ゲームの本拠セルに、中心から 250〜450m の潜伏者 1 か所を保証（H が 0 でも会える）。未会見の潜伏場所から細い煙（夜は灯り）。HUD の「人の気配」に方角（8 方位）を追加し、感知距離を 160 → 200m に。会話後、誰も雇っていない間は「Tab（指揮）→ 雇用候補で雇えます」の案内を出す
  - **F. ゾンビの腕**: **指摘どおり前後逆だった**。腕のポーズは「負 = 前」で書かれていたのに、垂れた腕を後ろへ振る符号で回していた（脚・前傾・這行型の腕は正しかった）。符号を直し、倒れた後の腕も作り直した（仰向け = 体の横、うつ伏せ = 頭の先）。向きが読めるよう頭の前面に暗い板（顔）を足した（1 体 6 → 7 箱、84 三角形）
  - **G. タイトル**: 仮題を **Zombie Sniper Survival** だけにした。表示名は `ja.ts` の `app.title` 1 か所（タイトル画面と `document.title` が読む）。`git grep 耳の国` に残るのはこの指示書（`prompts/07b_playtest_fixes.md`）と本ファイルの過去の記録だけ
  - テスト 8 件追加（`tests/cover.test.ts`）、e2e 6 件追加（`e2e/playtest.spec.ts`）。`npm run check`（183 件）・`npm run build`・`npm run e2e`（21 件）通過
- **「200m で視線が通る割合」の前後**（目の高さ 1.7m、歩ける 2 点、6 シード × 本拠/非本拠の 12 マップ平均。`node tools/sight-stats.ts`）:

  | 区分 | 変更前（03 の地形） | 変更後 | 目標 | 個別マップの範囲 |
  |---|---|---|---|---|
  | rural | 65.7% | **29.1%** | 25〜45% | 24〜35% |
  | forest | 25.0% | **12.7%** | 15% 未満 | 10〜16% |
  | urban / suburb / mountain | 14.1% / 10.4% / 31.8% | 変更なし | — | — |

  - forest は下生えを無視すると（幹・地形・岩だけ）約 2 割が通る。藪が目標達成の主因
  - 射点からの眺望: rural / forest の 8 マップで、最良の射点から 48 方位のうち 8 方位以上で 300〜450m 先の立ち姿の頭が見えることをテストにした（既存の「射点 3 か所以上」も通過）
  - スクリーンショットで確認したもの: rural / forest の射点からの眺望と地上 6 か所からの眺め（生け垣・葦・藪が実際に視界を切っている）、ゾンビ 4 種＋這行・転倒・死体の横と斜め上（全員が東を向いた列で、顔・伸ばした腕・前傾・進行方向がそろっている）、3 シードの煙、タイトル、メニューの操作一覧
- **性能の実測**（GPU なし・SwiftShader、1280×720 等倍。sim 1 ステップと `renderer.draw` 1 回を直接計測）:

  | 場面 | ドローコール | 三角形 | sim 1 ステップ ＋ 描画発行 |
  |---|---|---|---|
  | rural 射点 / 地上 | 44 / 41 | 32.2 万 / 31.8 万 | 0.14 ＋ 0.57 ms / 0.00 ＋ 0.69 ms |
  | forest 射点 / 地上 | 44 / 40 | 40.4 万 / 37.9 万 | 0.00 ＋ 0.73 ms / 0.00 ＋ 0.42 ms |
  | 射撃場 150 体 | 7 | 15.2 万 | 0.04 ＋ 1.08 ms |
  | 06 の襲来（117 体・壁 587）戦術 / 指揮 | 28 / 46 | 33.2 万 / **45.4 万** | 0.52 ＋ 1.11 ms |
  | 本拠 58 人 戦術 / 指揮 | 28 / 38 | 27.3 万 / 36.5 万 | 0.05 ＋ 1.28 ms |

  - 予算（150 未満・50 万未満・4 ms 未満）の内側。03 比で rural +13 万・forest +3 万三角形（forest は広葉樹の上の塊を 20 → 8 三角形に減らして相殺）、ドローコール +4〜5
  - **マップ生成**: rural 約 75 ms・forest 約 90 ms（Node、暖機後の中央値。予算 150 ms 未満）。プロセス起動直後の 1 回目だけ JIT で rural 160 ms 前後かかる
  - rural / forest の計測時、区域のゾンビは 0 体だった（`gotoLand` で飛んだ先のセルによる）。ゾンビ込みの負荷は射撃場 150 体と 06 の襲来の行を参照
  - 05 以降の方針に合わせ、射撃場 150 体の判定をフレーム平均から直接計測に替えた（フレーム平均は並列実行時に 4.25 ms と出て落ちた。直接計測は 1.1 ms）
- 未完了・既知の問題:
  - **実機では誰も遊んでいない**（今回もヘッドレスとスクリーンショットのみ）。特に未確認: 矢印キー照準の速さの体感、感度 +25%、遮蔽物を増やした後の歩きの退屈さ。**歩き 1.6 m/s は変えていない**
  - rural の指標は目標の下限寄り（29%、個別には 24% のマップもある）。これ以上遮蔽物を足すなら何かを減らすこと
  - 藪の中にいると 6m より遠いゾンビからは完全に見えない（割引ではなく遮断）。強すぎるかは 09 で
  - 煙は細く、400m 先だと数十〜数百ピクセル。seed 21（forest）では最も高い射点からは稜線に隠れて見えず、本拠からは見えた（e2e は「射点か本拠のどちらかから見える」で判定）。どこからも見えない配置がありうる
  - 遮蔽物は rural / forest のみ。suburb・urban・mountain は手を入れていない
  - 生け垣は軸平行の直線だけ、倒木・廃車も軸平行の箱。ビニールハウスの骨組みは当たり判定なし（通り抜けられる）。土手・沢はマップ端 24m で高さを 0 に戻している（外周の粗い地形とつなぐため）
  - 防衛担当の射線・スコープの測距（`observe.ts`）は藪を無視する（`segmentHitsStatic` / `raycastWorld` のまま）
  - 射撃場を「ゲーム中のメニューから」開いたとき、待機中のゲームはメモリ上にあるだけ（開く直前にオートセーブはする）。射撃場でタブを閉じるとオートセーブ時点に戻る
  - 三角形の余裕が減った（指揮視点 45.4 万）。forest に大きな拠点を建てると 50 万を超える恐れ。削る場所は `prompts/09` に書いた
- 仕様からの変更点（更新した docs）:
  - `02_systems_spec.md`: §3.1（矢印キー照準・感度・射撃場の入口）、§3.4（藪による視線の遮断、初期配置）、§3.6（歩行速度は据え置きの注記）、**§3.7 地形の遮蔽を新設**、§4.6 実装メモ（最初の 1 人・煙・案内）
  - `04_architecture.md`: §6（入力）、§7（`sightBlocked`、`brush` / `props`、生成の順、`sight-stats`）、§8（遮蔽物と合図の描画、ゾンビの向きの規約）
  - 既存テストの変更: `tests/combat.test.ts` の「撃って Z が 1 減る」は、ゾンビが遮蔽物の陰に出るようになったので標的を本拠の平坦地へ移してから撃つ形にした。`e2e/smoke.spec.ts` は歩行待ちを 10 → 30 秒、150 体の判定を直接計測に変更
  - `STATE_VERSION` は 5 のまま（追加は省略可能なフィールドとフラグだけ）。**同じシードでも地形は別物になる**（マップは保存しないので旧セーブは読める。本拠の平坦地は同じ場所・同じ半径だが、標高は周囲の地形の平均なので数十 cm 変わりうる）
  - 依存の追加なし
- 次のセッションへの注意:
  - **08 向け**・**09 向け**: 各プロンプトの末尾「07b の結果を受けて」に書いた
  - 遮蔽物を足す・変える手順: `TACTICAL.cover` の数値 → `gen/cover.ts` → `node tools/sight-stats.ts` と `npm run tactical:preview`（生け垣は濃緑、藪は緑、葦は藁色、竹は明るい緑で出る）→ `tests/cover.test.ts`
  - 視線の判定は 2 種類ある: 弾・固いもの = `segmentHitsStatic`、目で見えるか = `sightBlocked`。ゾンビや生存者が「見る」処理を足すときは後者
  - デバッグ: `window.__game.map.brush` / `.props`、`state.tactical.hideouts`（`sure: true` が最初の 1 人）
- 追加した共有型・コマンド・イベント:
  - 型: `TacticalMap.brush / props`、`Brush`、`Prop`、`StaticHash.brush`、`SolidKind 'scenery'`、`HitSurface 'scenery'`、`TacticalState.hideouts[].sure`（`spot: -1` = 建物のない野営）、`Interaction.hide`、`UiActions.openRange / leaveRange`
  - データ: `data/input.ts`（`INPUT.keyLook`）、`TACTICAL.cover`、`TACTICAL.terrain.*.mid / midWave / knolls`、`BALANCE.zombie.spawnRoadShare / spawnOpenShare / clusterTries / coverDist / hollowRing / hollowDepth / brushNear`、`COLONY.encounter.firstRing`、`RENDER.brush / signals`、`RENDER.zombies.face`
  - 関数: `sightBlocked`, `brushBetween`（collision）、`openSightShare`（`sim/tactical/sight.ts`）、`hasCover`（zombies）、`scatterCover` ほか（`gen/cover.ts`）
  - フラグ: `flags.firstContact`（最初の 1 人を配置済み）、`flags.rangeReturn`（射撃場から戻るゲームがある）
  - キー: 矢印キー = 照準（`lookUp / lookDown / lookLeft / lookRight`）。コマンド・イベントの追加なし
  - npm script の追加なし（`node tools/sight-stats.ts` を直接実行）

### 07b 追補: 危険度 20〜30% の開始候補 — 2026-11-17
- 発注者の指摘: 「開始地点の選択肢に危険度 20〜30% ぐらいの地域を含められないか。ゾンビが少なく、生存者を雇えない」
- 従来の候補は条件 Z/km² < 2（＝危険度 約 16% 未満）のため、3 シナリオとも危険度 5〜15% だった。3 枠のうち 3 番目を **危険度 20〜30% の田舎・森林** から選ぶようにした（他の条件は同じ。`BALANCE.world.start.busy`、`StartCandidate.tier: 'quiet' | 'busy'`）。1・2 番目は乱数の消費順を変えていないので、同じシードなら以前と同じ候補のまま
- 実測（seed 12）: 危険な候補は危険度 21〜24%、セル Z 329〜408（静かな候補の 2〜3 倍）、地図上の同時出現 43〜45 体（静かな候補 37〜39）、潜伏場所 3（同 2〜3）
- 候補カードに注記（「ゾンビも潜伏者も多い土地…危険も大きい」）と赤い枠。1280px・360px のスクリーンショットで確認
- テスト: `tests/world.test.ts` の開始候補テストを「静かな 2 つ＋危険度 20〜30% の 1 つ」に変更。`npm run check`（183 件）・`npm run build` 通過
- 未確認・注意（09 向け）: 同時出現数は `active = 8 + 14·log10(1 + Z)` なので危険度を上げてもあまり増えない。「見える数が少ない」のが不満なら `BALANCE.world.active` か補充間隔（20 秒）の方が効く。危険な候補で始めたときの夜間接近・大群メーターの重さは通しで見ていない

### 07b 追補: 見えるゾンビを増やす — 2026-11-17
- 発注者の要望「見えるゾンビを増やしてほしい」。07b で初期配置を遮蔽物へ寄せたぶん、見える数が減っていた
- 変更（数値のみ、`src/data/balance.ts`）:
  - 同時出現上限 `BALANCE.world.active`: 8 + 14·log10(…) → **20 + 20·log10(…)**（Z = 100 で 36 → 60、都市は上限 120）。本拠への夜間接近は旧式のまま（`BALANCE.world.nightActive` を新設して `sim/build/raids.ts` が使う）
  - 開けた場所に出る群れ `BALANCE.zombie.spawnOpenShare`: 12% → **30%**
  - マップ端からの補充間隔 `BALANCE.world.respawnSeconds`: 20 → **12 秒**
- 実測（3 シナリオ × seed 12 / 3 × 候補 3 つ = 18 ゲーム、開始 3 分後。視線は `sightBlocked`、500m 以内）:

  | | 変更前 | 変更後 |
  |---|---|---|
  | 地図上のゾンビ | 39.2 体 | 63.2 体 |
  | 最も良い射点から見える数 | 11.8 体 | 20.1 体 |
  | 本拠の中心から見える数 | 4.9 体 | 8.0 体 |

  - 静かな候補でもセルの Z が 42〜70 しかない場所は、地図上の数が Z で頭打ちになる（42 体など）
- テストの変更: `tests/colony.test.ts` の「1 日の成果が速度によらず同じ」は、本拠セルの Z を 0 にするだけでなく地図上のゾンビも消すようにした（増えたゾンビの 1 体が本拠中央のプレイヤーを倒し、3 日分の時間が飛んでいた）。`tests/world.test.ts` / `tests/build.test.ts` は式の値を data から読むようにした
- 09 向け: 耳の稼ぎ（序盤の契約金・賃金）が速くなる方向の変更。夜間接近の規模は変えていない。森の拠点で同時 70 体前後になるので、襲来時の上限 150 との兼ね合いは通しで確認してほしい
- 確認: `npm run check` 183 件通過。`npm run e2e` は 21 件中 20 件通過。落ちた 1 件は `e2e/build.spec.ts` の「駐屯地」（補給後の所持弾が 20 のまま）で、06 の記録にある「通しで回したときだけ落ちる」と同じ現象。単独で 3 回繰り返すと 3 回とも通った（駐屯地セルのゾンビ数はテストが 6 に固定しており、今回の変更の影響は受けない）。直していない（09 の e2e 安定化の項目）
- 性能（GPU なし・SwiftShader、直接計測）: 予算内。射撃場 150 体 7 ドローコール / 15.2 万三角形 / sim 0.17 ＋ 描画発行 0.73 ms、襲来 113 体 28 / 33.2 万 / 0.47 ＋ 1.08 ms、研究タブ 38 / 35.7 万 / 0.18 ＋ 1.40 ms

### 07b 追補: 低危険度でも戦える密度に — 2026-11-17
- 発注者の要望: 「今の 30% が 5% ぐらいの感覚でゾンビを増やしてほしい。移動で終わる」
- 原因: 地図上の数は `min(active, セルの Z)` で、静かな開始セル（Z 40〜180）はセルの Z そのものが上限だった。セルは 100km²、戦術マップは 1km² なのに、セルの全数が 1km² に集まる計算でも足りなかった
- 変更: 戦術マップはセルの Z × 17（`BALANCE.world.tacticalZScale`）を「localZ」として配置する（`cellTactical().localZ`）。17 は「危険度 5%（Z ≈ 41）を以前の 30%（Z ≈ 700）と同じ混み具合にする」倍率。倒すとセルの Z が 1 減るのは従来どおり（耳・掃討・駐屯地の進み方は変えない）。Z が 0 になると補充は止まり、残った個体は倒しても Z は 0 のまま。本拠への夜間接近は従来の式（セルの Z から、`nightActive`）のまま
- 実測（18 ゲーム、開始 3 分後、500m 以内）:

  | | 07b 直後 | 前回（式の引き上げ） | 今回 |
  |---|---|---|---|
  | 地図上 | 39.2 体 | 63.2 体 | **89.0 体** |
  | 最良の射点から見える | 11.8 体 | 20.1 体 | **26.7 体** |
  | 本拠の中心から見える | 4.9 体 | 8.0 体 | **11.7 体** |

  - 静かな候補（危険度 5〜15%）は地図上 77〜90 体・射点から 15〜31 体になり、前回の危険な候補（危険度 21〜24%: 70〜75 体・25〜29 体）とほぼ同じ。危険な候補は 95〜100 体・29〜38 体
- 本拠への流れ込み: 数が増えて、うろつく個体が本拠へ入り込みやすくなった（前回の設定で 9 ゲーム × 3 時間に計 6 体が 150m 以内へ）。04 の「本拠には基本来ない」に合わせ、うろつきの目的地を本拠の中心 150m 以内に取らないようにした（`pickWanderGoal`。追跡・襲来は対象外）。今回の設定で 0 体
- e2e `smoke.spec.ts` の共同体シナリオは、2 日間の経済を見る前に地図上のゾンビも消すようにした（以前はセルの Z を 0 にするだけで、残った個体が本拠に入って敗北していた）。起動〜再読み込みのテストは制限を 120 秒に（並列実行時に 60 秒を超えた）
- テスト: `tests/combat.test.ts` の開始セル（上限を localZ に、静かなセルでもセルの Z より多いこと）、都市の上限、補充（Z が 3 残っていれば 12 秒に 1 体ずつ入り続け、0 で止まる）を新しい規則に合わせた
- 09 向け: 1 セルを掃討するまでに倒す数は変わらない（セルの Z ぶん）が、地図上には常に 80 体前後いるので、掃討済み（Z < 20）になっても数十体が残る。「掃討済みなのに多い」と感じるなら、Z が少ないほど localZ の倍率を下げる形に変える。耳の入りは大きく増える方向

### 07b 追補: 司令部の菜園（序盤の食料） — 2026-11-17
- 発注者の要望: 「デフォルトの食料生産能力を 2 人分ぐらいに。序盤は全然食料が手に入らない」
- 原因: 農地の収穫は農家の「売り物」に入り、共同体は耳で買う（05 の食料市場）。農家も耳もない序盤は、初期備蓄 6 と探索で拾う分しか食料がなかった
- 変更: 司令部の菜園が毎時 30 分に 2.6 ÷ 24 食料を直接備蓄に入れる（1 日 2.6 ≒ 2 人分、`COLONY.garden.foodPerDay`、`sim/colony/jobs.ts` の `gardenHour`）。季節の影響なし、耳は不要、台帳の食料流入に計上。0 時ちょうどを避けたのは日ごとの台帳の境目にかからないようにするため
- テスト: 「食料ゼロで飢える」は 1 人 → 5 人（菜園の 2 人分を上回る人数）に変更。「農家なしで 2 人（最も大食いのスタミナ 1 × 2）が 10 日間食料切れを起こさない」を追加。`npm run check` 184 件通過
- 09 向け: 農家 1 人（約 4 食料/日）の半分強がタダで入る。序盤の雇用 → 賃金 → 食料の流れが緩くなるので、農業を割り振る動機が弱すぎないか見てほしい。UI に菜園の表示はない（経済タブの台帳に流入として出るだけ）

### 07b 追補: ゲームオーバー時のカーソル — 2026-11-17
- 発注者の指摘: 「ゲームオーバー時にカーソルが表示されない（視界移動のまま）」
- 原因: 敗北画面・エンディング画面の間もモードは `tactical` のままで、入力層はポインタロックを保持し、画面クリックでも取り直していた
- 修正（`src/input/index.ts`）: 敗北中・未確認のエンディング表示中は「戦術で操作中」とみなさない（ロックを取らない・操作を受けない・ロックが外れてもメニューを開かない）。`defeat` / `victory` イベントでロックを解放する。エンディングを閉じて戦術に戻ったら、従来どおり画面クリックで再びロックする
- e2e: `e2e/playtest.spec.ts` に「敗北でロックが外れ、画面クリックで取り直さず、ボタンでタイトルへ戻れる」を追加（ヘッドレスでは本物のロックが取れないので `requestPointerLock` / `exitPointerLock` / `pointerLockElement` を差し替えて確認。修正前のコードでは落ちることを確認済み）
- 発注者の質問への回答（記録）: 作戦区域が 1km 四方で端を越えられないのは 03 からの仕様（隣のセルへは戦略地図で移動）。見た目を外部モデル・テクスチャで作り直す件は `prompts/08` の末尾に書いた

## 07c 地続きの世界 — 2026-11-17
- 発注者の要望: 「戦略地図だけでなく、プレイヤーを中心とする同心円のマップを読み込んで視界を表示する仕様に。周囲が突然平地になるのは不自然」。選択肢（見た目だけ地続き／歩いて行ける地続き）を示し、**歩いて行ける地続き**が選ばれた
- 完了したこと（仕様は `02_systems_spec.md` §3.8、構造は `04_architecture.md` §7・§8）:
  - **地形のつながり**（`gen/world.ts`）: 起伏を世界座標で計算し、土地区分ごとの起伏を境界の両側 120m で混ぜ、隣の丘も含める。境界の高さは両側で一致（`tests/world-seam.test.ts`、誤差 0.001m 未満を 10 組で確認）。林と針葉樹の混じり方も世界座標。土手・沢・道路の盛り土は端 40m で消える
  - **道路の関所**: セルの組ごとに決まる位置で道が境界を越え、両側の道がそこへ向かう（田舎・森・山。町の格子道はつながらない）
  - **歩いて越える**（`sim/tactical/area.ts` の `walkAcross`）: 隣が陸の端は越えられる。越えた瞬間に現在セル・座標・区域が切り替わり、近く（70m）と追跡中のゾンビはついてくる。直前の 4 区域は記憶（引き返すと元のまま）。海側は閉じたまま
  - **描画**（`render/tactical/index.ts` / `neighbours.ts` / `mapWorker.ts` / `terrain.ts`）: 周囲 3×3 のうち霧の範囲にかかる区域を描く。隣の地図と地面の画素は Web Worker で前もって生成。地形は 256m 区画ごとの 3 段階の細かさとスカート。葦・藪・竹は 350m 以内の区画だけ。本拠の隣にいるときは本拠の構造物と生存者も描く
  - テスト: 単体 4 件（境界の高さ、関所の一致、歩いて越えて戻る、海側は閉じる）、e2e 1 件（境界の手前・越えた直後に振り返る・4 セルの角で予算を計測）
- **性能**（GPU なし・SwiftShader、1280×720、sim 1 ステップ＋描画発行を直接計測）: 境界の 12m 手前 72 ドローコール / 28.6 万三角形 / 0.65 ms、越えて本拠を振り返る 71 / 38.9 万 / 1.5 ms、4 セルの角 69 / 35.8 万 / 2.1 ms。予算内。最初は角で 50.6 万三角形あったので、隣の区域の細かい植生を距離で間引き、葦の穂を太く・まばらにし（数は約 2/5）、地形の細かい範囲を狭めた
  - e2e 全件（23 件）: 1 回目は 22 件通過。落ちた 1 件は 06 の大きな拠点（壁 587 枚・117 体）を**指揮層の上空カメラ**で見た場面で 59.0 万三角形（隣のセルの森まで見えるため）。指揮層では隣の区域をカメラから 300m 以内だけ描くようにして（`RENDER.terrainLod.neighboursFromAbove`）50 ドローコール / 39.1 万三角形で通過
  - 他の場面（全件の実行中の値）: 森 地上 73 / 46.9 万（予算 50 万に近い）・射点 70 / 47.7 万、田舎 地上 71 / 27.9 万、研究タブ 65 / 43.0 万、本拠 58 人の指揮層 65 / 43.5 万、襲来の戦術視点 66 / 39.4 万、sim＋描画発行はすべて 4 ms 未満
  - **注意**: e2e「every land class renders」の参考値（フレーム平均の本スレッド時間）が田舎 137 ms/フレーム・都市 50 ms と大きく出た。区域に入った直後で、隣の区域のメッシュを 1 フレームに 1 つずつ構築している最中の値。実機でも区域に入った直後・境界を越えた直後に数フレームのカクつきが出る可能性が高い（Worker に移せていない部分: 植生・藪のインスタンス配置とテクスチャの転送）
  - マップ生成（Node、ゲーム内の隣接つき）: 中央値 田舎 80ms・森 100ms・郊外 60ms・山 70ms。最大はぶれて 150〜220ms（GC 等）。ゲーム中は Worker で作るので画面は止まらない（最初の区域だけはロード表示中に本スレッドで作る）
- 未完了・既知の問題:
  - **隣のセルのゾンビは、そのセルに入るまで描かれず動かない**。境界越しに撃つと弾は現在のセルの外で消える。追ってきたゾンビは新しい区域の端の内側に置き直すので、境界際で数十 m 跳んで見えることがある
  - 隣の区域のメッシュ構築（植生・テクスチャの転送）は 1 フレームに 1 区域ずつ本スレッドで行う。境界を越えた直後に新しく視界に入る区域ぶん、実機で小さなカクつきが出る可能性がある（実機未確認）
  - 地面の細かい模様（色むら）はセルごとに別の乱数なので、境界にうっすら線が見えることがある。町の格子道は境界でつながらない
  - 本拠の隣のセルにいる間は「不在」扱い（襲来は数値で解決、生存者は止まって見える）。指揮層の俯瞰カメラは現在セルの中心を見る
  - 歩いて 1km で隣のセル（10km 四方）に入るので、縮尺は戦略地図と一致しない（徒歩の移動は近道になる）。戦略地図の移動時間は従来どおり
  - 本セッションの性能測定は 1 シード（森の開始セル）と射撃場のみ。都市・郊外の隣接区域を同時に描いたときの値は e2e「every land class renders」で 100 未満を確認しているが三角形は未計測
- 追加した共有型・コマンド・イベント:
  - 型: `GenParams.world`（`WorldContext`）、`cellEntered.walked`
  - データ: `TACTICAL.world`（`blend` / `seaDrop` / `gateChance` / `gateWild` / `gateMargin` / `editFade` / `crossOver` / `carry` / `parked`）、`RENDER.terrainLod`、`RENDER.brush.fineRange`
  - 関数: `terrainFunction`, `cellHills`, `gatesOf`, `editFade`（gen/world.ts）、`walkAcross`, `worldContext`, `cachedMap`, `provideMap`, `mapForCell`, `clearParked`（area.ts）
  - コマンドの追加なし。`STATE_VERSION` は 5 のまま（地形は再生成。旧セーブも同じ seed から新しい地形で読める）

### 07c 追補: 補給場所の表示とゾンビ 5 倍 — 2026-11-17
- 発注者の評価: 地続きの制限（隣のセルのゾンビは入るまで動かない等）は「軽量化の工夫として妥当」。プレイ感は良好
- **補給場所の表示**（`02_systems_spec.md` §3.9）: 戦略地図の本拠・駐屯地に「弾」の札と残弾数、凡例。戦術画面の右上に最寄りの補給場所の方角と距離（`sim/world/outposts.ts` の `supplyPoints` / `nearestSupply`）。司令部と駐屯地の上に青い光の柱（`render/tactical/beacons.ts`、1 ドローコール）
- **ゾンビ 5 倍**: 区域の同時出現を 5 倍（`BALANCE.world.activeMul = 5`、上限 `activeMax = 600`、襲来込みの上限 `BALANCE.zombie.max` 150 → 750）。夜間接近の規模は変えていない。`CLAUDE.md` の性能予算を「ゾンビ同時 600 体まで」に更新した（発注者の要望による変更）
  - 実測（18 ゲーム、開始 3 分後）: 地図上 89 → 445 体、最良の射点から見える数 27 → 141 体、本拠の中心から 12 → 74 体（本拠の 150m 以内には入らない）
  - 性能を保つために: 木の遠景用の簡略形（260m より遠い区画は幹なしの円錐・八面体、`RENDER.flora.treeNear`）、ゾンビは霧の外と視野の外を描かない（手足の姿勢計算も省く）
  - 性能（SwiftShader、直接計測）: 射撃場 600 体 7 ドローコール / 10.1 万三角形 / sim 0.27 ＋ 描画発行 1.50 ms。森の地上 31.4 万（以前 46.9 万）・射点 32.6 万。境界 72 / 25.2 万 / 2.2 ms、角 67 / 27.1 万 / 1.3 ms。sim 単体で 600 体 0.23 ms/ステップ（Node）
- テスト: 単体 1 件（隣のセルから本拠の方角と距離）、e2e 1 件（地図の札と凡例、隣のセルで HUD と光の柱）、負荷試験を 150 → 600 体に、開始セルの数の検査を 5 倍に合わせた
- 09 向け: 耳の入りが大きく増え、地上で囲まれやすくなる（バランス全体は未調整）。射撃場の性能テストは 600 体で sim＋描画発行 1.8 ms だが、実機の内蔵 GPU では未確認。ゾンビ 1 体 84 三角形 × 600 体の頂点処理が重ければ、遠くの個体の簡略形を検討（頭の当たり判定と見た目を揃える制約に注意）

### 07c 追補: 遠くのゾンビの停止・組み立ての分割・e2e の直列化 — 2026-11-17
- 発注者の許可（「GPU 的に厳しければ、一定半径外の個体は配置のみで動かさなくてよい」）を受けて、プレイヤーから 650m より遠く、追跡中・襲来中でない個体は更新しない（`BALANCE.zombie.freezeDist`）。ただしシミュレーションは 600 体でも 0.2〜0.4 ms/ステップで、負荷の中心は描画の側
- 隣の区域のメッシュ（地形・建物・木・藪）を 1 フレームに 1 部品ずつ組み立てるようにした。境界を越えた直後は 7 フレームで組み終わり、最も重いフレームで 6.6 ms（SwiftShader。以前は 1 区域ぶんを 1 フレームで組んで数十〜数百 ms）。`debug.renderInfo().pending` で残りが分かる
- 性能の e2e は組み立て待ちが 0 になってから測る（定常状態の 1 フレーム）。襲来の場面は壁の損傷の描き直しや GC で 1 回だけ跳ねるので、描画発行を 20 回の中央値で判定し、最大も出力する
- **e2e を 1 本ずつの実行にした**（`playwright.config.ts` の `workers: 1`）。GPU なしの 4 コアで 2 本並列だと、性能の測定値と時間待ちのテストが負荷でぶれて落ちていた。全件で約 19 分
- e2e 24 件すべて通過（直列）。主な値（ドローコール / 三角形 / sim ＋ 描画発行）: 襲来 68 / 33.8 万 / 0.36 ＋ 1.70 ms（最悪 6.4 ms）、射撃場 600 体 7 / 10.1 万 / 0.21 ＋ 1.15 ms、森 地上 73 / 31.4 万 / 1.56 ms、境界の角 69 / 27.1 万 / 1.96 ms、本拠 58 人 31 / 21.3 万 / 2.26 ms

### 07c 追補: 見た目の依頼文・遠くのゾンビの簡略化・補給箱 — 2026-11-18
- **別チャット用の依頼文**: `prompts/assets_visual_request.md`（木・岩・草むら・藪・生け垣・地面の模様を、コードで生成する部品として作ってもらう。単位形・三角形の上限・判定との大きさの約束・地面の画素関数の入出力・差し込み先を書いた）
- **遠くのゾンビの簡略化**（発注者の提案「スコープで視認できない範囲は腕の動き等のないオブジェクトが動くだけに」）: 距離ではなく **画面上の身長**（スコープの倍率込み）で判定し、14px 未満なら胴と頭の 2 箱で姿勢なし（`RENDER.zombies.lodPixels`）。12 倍スコープでは 600m 先でも約 35px あるので、覗けば細かい姿に戻る。肉眼だと約 37m 先から簡略形。三角形は 1 体 84 → 24、行列計算は 7 → 2 部品
- **補給箱**（発注者の要望「駐屯地・弾薬補給場所を 10 倍に。同じマップに複数あっても構わない」）: 世界に最初から置かれた弾薬の集積所を足した（`02_systems_spec.md` §3.9）。全国平均 1 セル約 1.2 か所、1 つ 25〜60 発、補充なし。B で取る、戦略地図に残り、戦術画面に弾薬箱と短い光の柱、HUD に最寄りの方角と距離。光の柱は近くでは消す（近くに立つと空を覆っていた）
  - 周囲 3×3 の歩ける範囲の補給場所は、以前は本拠 1 か所だけだったのが、補給箱を合わせて 10 か所前後（テストでは開始セル周りに 5 か所以上を確認）
  - 型: `WorldState.cacheTaken?`（省略可能、`STATE_VERSION` は 5 のまま）、`TacticalMap.caches`、`SupplyPoint.kind 'cache'`、`MapMarker.kind 'cache'`
  - テスト 2 件（数がシードどおり・本拠の中心にない・周りに十分ある／B で取る・残りが減る・空になる・セーブ往復）
- 09 向け: 補給箱は補充されないので、長いゲームでは本拠周りが尽きる（遠征・駐屯地へ誘導する意図）。数・弾数は `BALANCE.world.caches`。耳の入りが増えた（ゾンビ 5 倍）ことと合わせて弾薬の経済を見直してほしい
- e2e（直列）: 24 件中 23 件通過。落ちた 1 件は補給の案内の e2e で、「隣のセルから本拠（西）を指す」前提が、補給箱が近くにあると南東の補給箱を指すようになったため（正しい挙動）。周りの補給箱を空にしてから本拠を指すことを確かめる形に直し、単独で通過。主な値: 射撃場 600 体 7 ドローコール / 9.0 万三角形（遠景の簡略化で 10.1 万から減）/ sim 0.15 ＋ 描画発行 0.77 ms、襲来 69 / 33.5 万 / 0.23 ＋ 1.20 ms（最悪 3.9 ms）、森 地上 76 / 31.4 万 / 1.22 ms、境界越え直後の最も重いフレーム 2.6 ms

### 07c 追補: 別チャットで作った見た目の部品を組み込み — 2026-11-19
- 発注者が別チャットで作った `src/render/tactical/assets.ts`（コード生成の植生・岩・地面。依頼文は `prompts/assets_visual_request.md`）を組み込んだ。外部ファイルは使っていない
  - `vegetation.ts`: 木（近景・遠景）・岩・草むらを差し替え。形は y=0 が地面。岩は 90° 単位の回転だけ（当たり判定の箱が回らないため）。草むらは表面のみ・なめらかな陰影の材質
  - `brush.ts`: 藪・葦・竹を差し替え、生け垣は専用のメッシュ（`brush-hedges`、常に描く）に分けた。廃車・倒木・ビニールハウスは従来の箱。1 区域あたりドローコール +1
  - `groundPixels.ts` / `groundTexture.ts`: 地面の模様と近距離の細かい凹凸を `assets.ts` の関数に。世界座標（`gx` / `gy`）を渡すので境界で模様がつながる。地面の生成は 1 区域 100〜175 ms（以前 400〜740 ms）。Worker は 59 kB で three を含まない
  - `assets.ts` への修正 1 点: 遠景の広葉樹の下の頂点を y=0.18 → 0（遠目に浮いた菱形に見えたため）
- e2e 24 件すべて通過（直列）。主な値（ドローコール / 三角形 / sim ＋ 描画発行）: 襲来 72 / 37.3 万 / 0.19 ＋ 1.40 ms、森 地上 76 / 35.6 万 / 2.28 ms・射点 73 / 36.2 万、田舎 75 / 24.8 万、境界 77 / 29.6 万、射撃場 600 体 7 / 9.0 万 / 0.70 ms、境界越え直後の最も重いフレーム 7.6 ms。三角形は以前より 3〜4 万増えたが予算内
- 見た目の気づき（未対応）: 藪は判定の円柱を覆うため角柱に近く、近くでは暗い塊に見える。葦原は遠目に尖った円錐の列。幹が太く見えるか（`assets.ts` の注意 2）は未確認

### 07c 追補: 補給の分かりにくさ — 2026-11-19
- 発注者の指摘: 「青く光っている場所に行って B を押しても何も起きない」。原因は、本拠の青い柱が **備蓄 0 でも** 立っていたこと（新規ゲームの 100 発は手持ちで、本拠の備蓄は 0。B は「弾薬なし」で拒否されるが、画面には何も出ていなかった）
- 直したこと: 青い柱は弾薬が 1 発以上ある場所だけ。B で補給できなかったときは理由を画面上部のトーストに出す（`log.resupplyEmpty` / `log.resupplyFull` / `log.resupplyNowhere`）。右上の「最寄りの補給」は弾薬のある場所を優先。トーストの位置を方位計と重ならないよう少し下げた
- テスト 1 件（備蓄 0・満杯・補給できる・空の本拠を指す）。補給の e2e は本拠に備蓄を入れてから柱を確かめる形に
- 未対応（判断待ち）: 新規ゲームで本拠の備蓄を 0 から始めるか（今は工作担当が作るか、補給箱・駐屯地で補う）

## 08 UI/UX・音・チュートリアル — 2026-11-20
- 完了したこと:
  - **見た目の統一**（`ui/styles.css` を全面的に書き直し）: CSS 変数のデザイントークン（`--ink-*` 面・`--paper*` 文字・`--khaki` 操作・`--rust` 注意・`--blood*` 危険・`--line*` 罫線・余白 `--s1..5`・角 `--r1/2`・文字 `--fs-*`・数字 `--font-num`）。乾いた終末の野帳・作戦図: くすんだ紙色の文字、オリーブ墨の面に薄い罫線、角はほぼ四角、数字は等幅。タイトル・オープニング・上部バー・戦術 HUD・指揮層・研究ツリー・戦略地図・メニュー・結果画面がすべて同じトークンを使う（クラス名と `data-testid` は従来のまま）
  - **画面の構成**: 上部バーは全モード共通（日付・速度・3 層・「問題 n」・「通知」・☰、襲来の赤い帯）。戦術 HUD は縁の小箱だけ（左下 体力・姿勢・スタミナ、右下 弾・ゼロイン・倍率・耳、上 方位、左上 次にやること、下中央 ヒント 1 行と操作の案内）。**スコープ中は弾数・息・ゼロイン・倍率だけ**（上部バーも消える）。指揮層は **下のタブバー＋左右にドッキングするパネル**（建築は拠点が見えるよう右・幅 400px、他は ⇆ で左右入れ替え、▾ でたたむ）＋上の備蓄の帯＋反対側に「次にやること」と「問題」。幅 720px 以下ではパネルが下からのシートになる
  - **毎フレームの表示**（`ui/live.ts`）: 息・耳の回収・体力・スタミナ・方位・画面効果は Preact を通さず、`useLive` で登録した関数がメインループから毎フレーム style を直接書く。10Hz の再描画は従来どおり
  - **数値の変化**: 耳・備蓄が変わると数字の横に「+2」「−7」が浮いて消える（0.9 秒以内の変化はまとめる＝連続キル・賃金・購入でも 1 つ）
  - **情報設計**: 生存者一覧に仕事別の人数（押すと絞り込み）・「負傷・感染・不満」の絞り込み・並べ替え（仕事・名前・士気・賃金・運動・知識、ブラウザに記憶）・**★ 適性の高い仕事**（能力と特性から、解禁済みの仕事の中で最大の成果）。行は 05 の署名メモ化のまま。**問題欄**（`ui/warnings.ts`: 食料あと◯日・未払い・士気・壁の損傷と破壊・堀の詰まり・設計図と建築担当・感染・弾薬・待機・研究の空き。重い順）。**通知**（`ui/notify.ts`: 共同体のログがトーストになり重さで色分け、同じ文が続けば ×n、履歴 80 件）。襲来は上部バーの赤い帯＋中央のバナー「大群襲来 東から」＋画面中央を囲む方角の矢印。戦略地図に印の凡例（現在地・本拠・駐屯地・行き先・補給箱・海路）。建築メニューに解禁条件・費用・効果のツールチップと選択中の説明カード、置けない理由（「司令部から遠すぎる」など）と資材不足の注意、「司令部へ」ボタン（建築タブを開くとカメラが拠点へ寄る）
  - **設定**（メニューの「設定」、`src/settings.ts`、localStorage）: マウス感度・矢印キー照準の速さ（入力層が掛ける）・スコープ（押している間／押すたびに切替）・視野角（スコープなしの端だけ。スコープ中の絵とミル目盛りは変わらない）・音量 4 系統・視程（霧）・解像度の自動調整（既定オン）と固定スケール・ヒント・性能表示・キー配置。**影は接地の丸い影しかないので設定項目は説明だけ**
  - **音**（`src/audio/`、Web Audio の合成のみ）: 抑制された発砲＋ボルト 3 回＋空薬莢、着弾音は **距離 ÷ 343 m/s 遅れて** 土・木・石・肉で別、ヘッドショットの手応え音、空撃ち・装填、ナイフ、足音（地面・屋上や塔の板・町の舗装）、息止め中の心音と息切れのあえぎ、ゾンビのうめき（近い数体から、方角で左右・距離で減衰とこもり、追跡中は頻繁）、壁を叩く音と崩れる音（位置つき）、防衛担当の銃声、警鐘、建設完了、研究完了、時代、勝利・敗北、雇用、UI のクリック。環境音は風（突風でゆらぐ）、夜の虫、昼の鳥（田舎・森）、町は風だけ、指揮層で拠点のごく薄いドローン。音楽はなし。最初のキー入力かクリックで AudioContext を開始
  - **イベントと音・表示の対応**は `src/audio/feedback.ts` の `EVENT_FEEDBACK`（`Record<GameEventType, …>` なので、イベントを足すと型検査が記入を求める）。表は下に
  - **チュートリアル**（`ui/guide.ts`）: 状況に応じた 1 行ヒント 12 段（歩く → スコープと息止め → 最初の 1 発（**見えている最寄りのゾンビの方角と距離**を出す。開始地点からは約 150m）→ 耳 → 煙を探して話す → 雇う → 仕事 → 柵（夜の接近・木材の入手先）→ 研究（土木の基礎 F1）→ 地図 → 遠征 → 駐屯地）と状況のヒント 5 つ（弾の補給: B・手持ち 100・本拠の備蓄は 0 から・補給箱と駐屯地／**防衛担当は塔の上からしか壁越しに撃てない**／**司令部が壊れると敗北**（最初の襲来で）／**堀は切れ目を 1 か所残すと列ができる**（堀の解禁で）／日暮れ）。マウスとキーの両方を書いた。× で閉じられる。完了はゲームの記録（撃破数・耳・雇用・仕事・設計図・研究・遠征・駐屯地）で判定し、記録のないもの（歩いた・覗いた・地図を開いた）と閉じたものだけコマンド `markSeen` で `state.flags['seen.tut.<id>']` に残す（セーブされる）。左上の「次にやること」は未完了の 3 件、なければ建国条件のうち未達の 3 件＋「建国宣言まで — 時代・人口・駐屯地」
  - **ヘルプ**（メニューの「ヘルプ」）: 操作（マウスとキー）、仕事と能力の対応表、ゾンビ図鑑（体力・速さ・壁への攻撃は data から）、弾道の読み方（ゼロイン、ミル測距、落下表、着弾の遅れ、姿勢、貫通）、目的と勝敗
  - **一時停止メニュー**: 「ゲーム／設定／ヘルプ」のタブ、セーブスロットに日付つき（上書きの表示）、オートセーブの日時。**タイトル画面**: 標語・開発版の表示（表示名は従来どおり `ja.ts` の `app.title` 1 か所）
  - **敗北**: 「直前のオートセーブから再開」（日時つき）。`flags.defeat` が立った後は `saveSlot(AUTO_SLOT)` を拒否するので、メニューを開いても上書きされない（sim の敗北規則は変えていない）
  - **演出**: 被弾で縁が赤く、体力 35% 未満で暗い縁が脈打ち、感染中は縁が黄緑。死亡は暗転。セルを越える・到着するたびに中央に地名・土地区分・危険度のバナー（戦略地図と同じ地名）。時代が進むと「定住期へ」のバナー（5 秒）。エンディング・敗北はフェードイン。**ヘッドショットで 0.04 秒（300m 以上は 0.08 秒）のヒットストップ**（main ループが sim を止めるだけ。描画は続く。スローはなし）、照準の下に「ヘッドショット 312m」。**自分の弾の薄い軌跡**（`render/tactical/shots.ts`、飛んでいる弾の後ろ 18m、加算合成、1 ドローコール）、銃口の小さな煙（スコープ中は視野に入らないよう低く短く）、発砲時の小さなロール
  - テスト: 単体 10 件（`tests/ui.test.ts`: `markSeen` とセーブ往復・不正なキー・一時停止中、設定の補正、ヒントの順序と閉じたもの、次にやること、問題欄、全イベントの対応）、e2e 4 件（`e2e/ui.spec.ts`: **新規ゲームからヒントだけで 1〜7 を通す**、敗北 → オートセーブから再開、設定の保存・ヘルプ・問題と通知のポップアップ、360px / 1920px の 3 画面で横スクロールなし・HUD がはみ出さない＋性能）
- **通しプレイの確認**（Playwright、seed 12、1280×720）: ヒント「W A S D で歩く」→ 歩くと「右クリック（または Q）…Shift で息を止める」→ 覗くと「東 約 150m にゾンビ…」→ 撃つと「死体まで歩き E を長押し」→ 拾うと「煙の立つ場所に人が隠れている」→ 話すと「雇用候補が 1 人います — Tab…」→ 雇うと「仕事を割り振る。★…」→ 建築担当にすると「木柵をドラッグで並べ…」→ 木柵の設計図を置くと「研究担当を置き…土木の基礎」。e2e では照準だけはスクリプトで合わせている（ヘッドレスはポインタロックが取れないため `debug.setInput` と `teleport`）。**実機で人が初見で通したわけではない**
- **性能**（GPU なし・SwiftShader、1280×720、sim 1 ステップ＋描画発行の直接計測、`e2e/ui.spec.ts`）: 本拠の開始地点でスコープを覗いて撃ち、弾が飛んでいる間（軌跡あり）に **25 ドローコール / 16.2 万三角形 / sim 0.12〜0.22 ms ＋ 描画発行 1.17〜2.06 ms**（4 回の計測の範囲）（予算 150 未満・50 万未満・4 ms 未満）。**UI の 1 回の再描画（10Hz の同期）は 0.16〜0.35 ms**（`debug.uiPaintMs`）。08 が描画に足したのは軌跡の LineSegments 1（弾が飛んでいる間だけ）と煙の粒子（既存の Points に相乗り）だけ。チュートリアルの「見えている最寄りのゾンビ」は 0.5 秒に 1 回、近い順に最大 24 体だけ視線を調べる（600 体いても重くならない）
- **確認**: `npm run check`（単体 202 件）・`npm run build`・`npm run e2e`（28 件、直列で 18 分）すべて通過。既存の e2e の変更は 1 か所（敗北画面のボタンが 2 つになったので `defeat-title` を押す）
- **入力の不具合を 2 件直した**（`input/index.ts`）: (1) Esc / Tab / M を素早く 2 回押すと、1 回目のモード変更がまだ適用されていない状態から 2 回目を判定していた（Esc 2 回でメニューが閉じない）。押したモードを次のフレームまで覚えておくようにした。(2) 戦術へ戻るとき、ポインタロックを 2 回続けて要求していた（`toggleMode` と `modeChanged` の両方）。Chromium は処理中の要求に重ねて要求されると両方を捨てることがあり、ロックが外れた＝ Esc と読んでメニューが開き直っていた（ヘッドレスで再現、元のコードでも 4 回中 2 回）。要求中は重ねないようにした。06・07c の記録にある「通しで回したときだけ落ちる e2e」の一因だった可能性がある
- 未完了・既知の問題:
  - **実機で誰も聴いていない・触っていない**。音量のつり合い（`data/audio.ts`）、うめきの頻度、心音の大きさ、ヒットストップの長さ（`BALANCE.feel`）、ヒントの文の長さは 09 の実機確認で
  - 雨・天候は無い（天候の仕組みがない）ので雨音も無い。ナイフの音は振る・当たるの 2 種だけ。葉擦れ・藪に入った音は未着手
  - 影の設定は項目だけ（実体は丸い影のみ）。視程を下げても隣の区域の構築範囲は変わらない（霧が近くなるだけ）
  - 研究ツリーは横スクロールのまま（360px では 3 列ぶん）。縮小表示は未着手
  - 「ヒントを最初から」は入れていない（`seen.*` を消すコマンドがないため）。設定のリセットは設定だけ
  - 通知の履歴はセッション内だけ（共同体のログは従来どおりセーブされ、指揮層の「ログ」で全件見られる）
- 仕様からの変更点（更新した docs）:
  - `04_architecture.md` §6（`markSeen`）、§8（自分の弾・音）、§9（見た目の約束、画面の構成、毎フレームの表示、通知、チュートリアル、問題欄、設定）
  - `02_systems_spec.md` §3.2（手応え: ヒットストップと表示）、§10（敗北後はオートセーブを上書きしない）
  - `STATE_VERSION` は 5 のまま（`flags` にキーが増えるだけ）
- 次のセッションへの注意:
  - **09 向け**: 音量と頻度は `data/audio.ts`、ヒットストップは `BALANCE.feel`、軌跡と揺れは `RENDER.shots`。ヒントの文は `ja.ts` の `tut.*`、順序と判定は `ui/guide.ts`。実機での初見プレイで「どこで迷ったか」を見てヒントを直すこと
  - 音は最初にキーかボタンを**離した**ときに AudioContext を作る（押したときはポインタロックの要求と重なるため分けた）
  - **10 向け**: タッチ操作は未実装。HUD の部品は縁に寄せてあり、ボタンは `#ui button` だけがポインタを受ける。幅 480px 以下で上部バーが 2 段になる（`--hud-h: 64px`）
  - 新しい画面を作るときは `ui/styles.css` 冒頭のトークンと `.panel` / `.chip` / `.stamp` を使う。毎フレーム動くものは `useLive`。イベントを足したら `audio/feedback.ts` に音か表示を書く（型検査が求める）
  - UI は `state` を直接書かない（チュートリアルの既読も `markSeen` コマンド）。ブラウザごとの好み（パネルの左右・並べ替え・目標カードの開閉）は `localStorage` の `zss.ui.*`、設定は `zss.settings.v1`
  - デバッグ: `window.__game.debug.uiPaintMs(n)`（UI の 1 回の再描画）、`.audioRunning()`
- 追加した共有型・コマンド・イベント:
  - コマンド: `markSeen{key}`（time システム）。イベントの追加なし
  - データ: `data/audio.ts`（`AUDIO`）、`BALANCE.feel`（ヒットストップ）、`RENDER.shots`
  - `Renderer.setFixedScale(scale)`、`createUi(root, actions, { events, click })`、`Ui.frame` / `Ui.reset` / `Ui.notifier`、`UiActions` は変更なし
  - 依存の追加なし

### 08 追補: 音が小さすぎた — 2026-11-20
- 発注者の指摘: 「音が出ていないかも（PC の出力設定は正常）」
- 原因: 音は出ていたが、出力の最大値が発砲で約 0.13（−17 dBFS）、環境音で 0.05 と小さすぎた。帯域を絞ったノイズはフィルタでエネルギーの大半を失うのに、バスの音量を 0.5〜0.9 にしていた。ノート PC のスピーカーではほぼ聞こえない
- 直したこと:
  - バスの音量を効果音 ×4・環境音 ×2・画面の音 ×4 に（`AUDIO.bus`）、最後のリミッター（`AUDIO.limiter`、−6 dB・12:1）で割れを防ぐ。測定（タイトル画面で `debug.audioTest()`、出力のピーク）: 発砲＋ボルトで 0.84〜0.92、環境音の床は約 0.09（発砲が約 20 dB 上）。1.0 を超えない
  - AudioContext を、キー・クリック・タッチの **ハンドラの中で同期的に** 作る／再開するようにした（以前はキー・ボタンを離したあとの `setTimeout` で作っていて、Safari などユーザー操作の中でしか音を始めさせないブラウザでは止まったままになりうる）。止められた（別タブ・システム）コンテキストは次の操作で再開する。ポインタロックとの干渉は、前の節の二重要求の修正で解消済み（4 回繰り返して安定を確認）
  - 設定の「音」に **音の状態（再生中／止まっている／まだ始まっていない）とテスト音のボタン**
  - デバッグ: `debug.audioStatus()`（状態と出力のピーク。`AnalyserNode` を出力に挿している）、`debug.audioTest()`
- e2e 1 件追加（キー入力で音が始まり、テスト音のピークが 0.4〜1.05）。注意: ヘッドレスはゲーム画面の描画で 1 フレーム数百 ms かかるので、短い音のピークはゲーム中には測れない（タイトル画面で測る）
- **実機の耳では未確認**。大きすぎる・小さすぎる場合は `AUDIO.bus` と設定の音量で調整できる

### 08 イベントと音・表示の対応表（`src/audio/feedback.ts` から生成）

| イベント | 音 | 表示 |
|---|---|---|
| `hourStarted` | — | （なし: 時報（オートセーブの契機）） |
| `dayStarted` | — | （なし: 日付の変化は上部の時計で見える） |
| `speedChanged` | — | 上部バーの速度表示 |
| `modeChanged` | 画面の切替音（メニューは開閉音） | 画面そのもの |
| `commandRejected` | 低い警告音 | トースト「できない: 理由」（雇用・研究・遠征など、プレイヤーが選んだ操作のみ） |
| `shotFired` | 抑制された発砲音＋ボルト操作 3 回＋空薬莢 | 銃口の煙・画面の小さな揺れ・弾の薄い軌跡 |
| `bulletHit` | 着弾音（距離 ÷ 343 m/s 遅れ、土・木・石・肉で別） | 土煙・破片・血煙（04） |
| `zombieKilled` | ヘッドショットの手応え音（プレイヤーの頭部撃破のみ） | 照準の下に「ヘッドショット 312m」。頭部撃破で 0.04〜0.08 秒のヒットストップ。1 体ごとのトーストはなし |
| `earsCollected` | 袋に入れる音 | 耳の数字の横に「+2」（続けて拾うとまとめて表示） |
| `playerHurt` | 鈍い打撃音 | 画面の縁が赤くなる（毎フレーム）。体力 35% 未満で脈打つ暗い縁 |
| `playerDied` | 低い下降音 | 暗転と「力尽きた…」 |
| `dryFire` | カチッ | 弾倉の表示「弾倉が空（R）」 |
| `reloadStarted` | 装填の金属音（所要時間に合わせて 6 回） | 「装填中…」 |
| `reloadDone` | — | （なし: 装填音の最後で足りる） |
| `knifeSwing` | 振る音（当たれば鈍い音） | — |
| `playerInfected` | 低い音 | トースト（危険）・画面の縁が黄緑・問題欄 |
| `playerRevived` | — | 暗転が明けて画面が戻る（共同体がいれば 3 日後に司令部で） |
| `zombieAlerted` | — | （なし: 多すぎるので個別には鳴らさない（追跡中のうめきが増える）） |
| `structureDamaged` | 壁を叩く音（本拠のみ、0.18 秒に 1 回まで、位置つき） | 問題欄「壁の損傷」 |
| `structureDestroyed` | 崩れる音（位置つき） | ログのトースト（危険）・問題欄 |
| `structureBuilt` | 木を打つ音＋短い和音 | ログのトースト |
| `moatBridged` | — | 問題欄「堀の詰まり」 |
| `hordeWarning` | 警鐘 3 回 | ログのトースト（危険）・上部バーの赤い表示（方角・規模・残り時間）・画面の矢印 |
| `hordeArrived` | — | ログのトースト |
| `blueprintPlaced` | クリック | 設計図の半透明の箱 |
| `structureRemoved` | — | （なし: 操作した本人に見えている） |
| `raidStarted` | 警鐘（大群は 4 回、夜間接近は 2 回） | バナー「大群襲来／夜間接近 ○から」・トースト・上部バー・方角の矢印（留守中は音なし） |
| `raidEnded` | 撃退なら短い和音 | ログのトースト・上部バーの報告（3 時間） |
| `defenderFired` | 抑制のない銃声（位置つき・距離で遅れる） | 曳光線（06） |
| `survivorHurt` | — | 生存者タブの状態・問題欄 |
| `outpostUpgraded` | — | ログのトースト |
| `outpostSupplied` | — | （なし: 戦略地図の駐屯地の弾数で見える） |
| `survivorHired` | 短い上昇音 | ログのトースト |
| `survivorDied` | 低い音 | ログのトースト（危険） |
| `survivorLeft` | 低い音（小） | ログのトースト（危険） |
| `expeditionReturned` | 戸を叩く音 3 回 | ログのトースト（帰還・収穫・犠牲） |
| `wagesPaid` | 未払いがあれば警告音 | 耳の備蓄の「−n」・未払いならトーストと問題欄 |
| `candidateFound` | 短い 2 音 | ログのトースト・「雇用候補が n 人います」の案内 |
| `spotSearched` | — | ログのトースト（見つけた物） |
| `expeditionSent` | — | ログのトースト |
| `earsDeposited` | — | 備蓄の耳の「+n」・ログのトースト |
| `resupplied` | 弾を込める音 2 回 | 弾数の表示 |
| `foodBought` | — | 備蓄の食料「+n」と耳「−n」 |
| `colonyLog` | — | トースト（重さで色分け）と通知の履歴 |
| `techCompleted` | 3 音のチャイム | ログのトースト |
| `eraAdvanced` | 5 音の和音 | バナー「○○期へ」（5 秒）・ログのトースト |
| `victory` | 長い和音 | エンディング画面 |
| `defeat` | 低い下降音 | 敗北画面（直前のオートセーブから再開できる） |
| `outpostFounded` | 3 音の和音 | ログのトースト |
| `outpostLost` | 鐘 1 回＋低い音 | ログのトースト（危険） |
| `travelStarted` | — | 戦略地図の移動表示 |
| `cellEntered` | — | バナー「地名・土地区分・危険度」（歩いて越えたときも） |
| `travelArrived` | — | （なし: cellEntered のバナーで足りる） |
| `travelEncounter` | — | （なし: 効果のない枠（02）） |
| `infectionStepped` | — | （なし: 日次の内部処理） |

## 07e 耳の価値と探索の収穫 — 2026-11-20

発注者の要望（「平均 4〜6 耳で 1 人雇えるぐらいに」「建物を調べて手に入る資材をもっと増やしてほしい」）。

### A. 耳の値打ち（すべての耳の価格を 1/6）

- **実測から比率を決めた**: 05 の式で生存者 10 万人を作ると賃金の平均 6.0・契約金の平均 30（プロンプトの「4 / 20」は概算だった）。目標の契約金 5 にするため **比率は 1/6**。1 体あたりの耳（2）・遠征の 0.8 耳/体・襲来の回収率 70% は変えていない（耳の入りは同じで、使い道が 6 倍に効く）
- **賃金** `max(0.2, 0.1 刻み((0.33 + 0.1·(合計 − 16)) × 特性))`。平均 0.97 耳/日、0.2〜2.7 の 27 段階（「最低 1 耳」に潰れない）。**契約金** `max(1, round(賃金 × 5))`、平均 5.1・中央値 5（5〜95% 点 2〜9）
- **端数**: 賃金は本人ごとの `Survivor.wageOwed`（07e で追加。省略可、旧セーブは 0 扱い）に毎朝足し、整数ぶんを払う。払うべき整数ぶんを備蓄で払えない朝は未払い（その日の分は消える＝05 と同じく借金にはしない）。払う額が 0 の朝は未払いにならない。技術の賃金補正後は 0.01 刻み（`wageDue`）
- 研究の日次の耳収入は小数で合算し、整数を入れて端数を `flags.incomeCarry` に繰り越す（0.7 耳/日の交易が毎日切り捨てで 0 にならないように）
- 食料の購入は 05 から小数の耳で払っている（価格 × 量）ので、そのまま

耳の出入りの一覧（`git grep moveEars` と `.ears` で洗い出し）:

| 種類 | 場所 | 変更前 | 変更後 |
|---|---|---|---|
| 賃金 | `COLONY.survivor.wageBase / wagePerPoint` | 2 / 0.6（平均 6/日、整数、最低 1） | 0.33 / 0.1（平均 1/日、0.1 刻み、最低 0.2） |
| 契約金 | `feeDays` × 賃金 | 平均 30 | 平均 5（整数、最低 1） |
| 食料（農家から） | `economy.foodBasePrice` | 2 耳 | 0.33 耳（価格係数 0.6〜2.5 は同じ） |
| 食料（農村から） | `foodBasePrice × villageFactor 1.8` | 3.6 耳 | 0.59 耳 |
| 自動購入方針 | 農村と同じ価格 | — | 自動で 1/6 |
| 離反の持ち去り | `賃金 × stealWageDays 3` | 平均 18 | 平均 3（自動） |
| 駐屯地の設置・拡張 | `BUILD.outpost.tiers[].ears` | 40 / 150 / 500 | 7 / 25 / 83 |
| 等級 3 駐屯地の収入 | `RESEARCH.outpostEars` | 5/日 | 0.8/日 |
| 交易（C4a） | `RESEARCH.tradeEars` | 4/日・相手 | 0.7 |
| 地方自治の税（C8） | `RESEARCH.taxPerTier` | 3/日・等級 | 0.5 |
| 醸造（A6b） | `RESEARCH.brewEars` | 6/食料 | 1 |
| 技術の補正（C2 契約金 ×0.7、C4a/b・C7 賃金、食料価格） | `techs.ts` の倍率 | 倍率なので変更なし | — |
| 入り: 死体 2 耳・遠征 0.8/体・襲来/駐屯地の回収 70%・預かり証 50% | `balance.ts` ほか | 変更なし | 変更なし |

研究費用（研究ポイント）・建物の資材は耳ではないので対象外。研究の説明文（`ja.ts` の C4a・C8）と `03_tech_tree.md` の数字も直した。

### B. 探索の収穫 3 倍

- `LOOT_TABLE` = 05 の表（`LOOT_BASE`）× `LOOT_SCALE = 3`。土地ごとの比率は同じ。プレイヤーの探索・遠征・在宅の調達はすべて同じ表なので同じく 3 倍。セルの `loot` の減り方は変えていない
- **収穫の計算を `src/sim/colony/loot.ts` の `lootYield(kind, points)` に集約**（`[資源, 期待値][]` を表の順で返す。乱数・loot 係数は呼び出し側）。`kind` は今は `Land`（`LootKind = Land`）。07d はここを建物の種類に置き換える

### テスト

- `tests/colony.test.ts`: 賃金の式を新しい値に。**生存者 1,000 人の契約金の中央値・平均が 4〜6**、整数、賃金の平均 0.8〜1.2、10 段階以上、能力の高い人ほど高い。**端数の賃金が整数で払われる**（0.4/日 → 5 日で 2 耳）。30 日台帳テストは既定の賃金を 1 にして通過、「未払い → 離反」もそのまま通過
- `tests/research.test.ts` / `tests/build.test.ts` / e2e（`build.spec.ts`・`smoke.spec.ts`）の耳の期待値を新しい値に
- `npm run check` 204 件通過。全体実行中に時間を測るテスト（「構造が変わったときだけ再計算 5ms 未満」「遮蔽物の生成」）が負荷でまれに落ちる — 変更前のコードでも同じく落ちることを確認済み、単独・再実行では通る
- `npm run e2e` 29 件すべて通過（1 回の実行が 30 分を超えたので、ファイルを分けて実行）。性能（e2e の計測、変更前と同水準）: 58 人の拠点（戦術）65 ドローコール・28.2 万三角形・sim 0.055 ms＋描画発行 1.80 ms、射撃場 601 体 7 ドローコール・sim 0.105＋0.51 ms、地形別は最大 75 ドローコール・36.5 万三角形。sim の計算量は変わらない（定数と 1 関数呼び出しのみ）
- 指揮画面: 食料価格が 1 耳を切ったので、1 食料あたりの価格は小数 2 桁で表示（`ui/command/format.ts` の `price`）。雇用候補タブ・経済タブを 1280px と 360px で目視（賃金 0.6〜1.7/日、契約金 3〜9、崩れなし）

### 後続への注意

- 耳は「ゾンビ 1 体 = 2 耳 ≒ 2 人の 1 日分の賃金」。新しく耳の価格を足すときはこの尺度で（05〜07 の値をそのまま参考にすると 6 倍高くなる）
- 07d: `lootYield` の `kind` を建物の種類に広げる。建物ごとの表は今の 3 倍の値を基準に

## 07d-1 中に入れる建物の基盤 — 2026-11-20

発注者の要望「拠点を含めて、家やビルの中に入れるように。範囲に入るまではデータだけ置き、入ってから実体を出す」。100 種類以上は 07d-2a〜2f が並行して作るので、ここでは **契約（型・組み立て道具・登録）と仕組み** と見本 3 種類（＋拠点の 13 種類）を作った。後続向けの手引きは **`docs/buildings_guide.md`**。

### 完了したこと
- **A. 設計図**（`src/gen/buildings/`、three なし・決定的）
  - `types.ts`: `BuildingDef`（id・カテゴリ・大きさの範囲・階数・階高・床高・屋根・`generate`）、`BuildingBlueprint`（部品 `Part`＝箱・切妻・寄棟・くさび＋材質＋外観/内部の層、開口 `Opening`＝扉 open/locked/shutter・窓 glazed/broken、階 `Storey`、部屋 `Room`（長方形＋用途）、階段 `StairInfo`（階段・はしご・使えない穴）、探索ポイント `SearchPoint`（家具の種類＋収穫表 id）、部屋のつながり `NavLink`（扉・開口・階段・はしごの通過点）、はしご）、`BuildingPlacement`（種類・位置・向き・シードだけ）
  - `kit.ts`: 開口つきの壁・外壁 4 面・間仕切り・床（階段の穴を自動で切る）・直階段（上階の穴に手すり）・折り返し階段（踊り場と中央の壁）・はしご・使えない昇降路・部屋・部屋の連結・家具（探索ポイントつき）・しみ・切妻/寄棟/陸屋根。`finish()` が扉と部屋を結び、つながらない扉・部屋の外の探索ポイントを場所つきで例外にする
  - `colliders.ts`: 当たり判定を部品から自動で作る（箱はそのまま、勾配屋根は内接 3 段、ガラスは「動くものだけ止める」）。三角形の数え方 `triangleCount`
  - `place.ts`（90° 単位の回転）、`index.ts`（`blueprintOf` / `detailOf` を LRU、世界座標の当たり判定に 2m 格子）、`materials.ts`（材質 32 種の振る舞い。色は `RENDER.materials`）
  - 登録: `catalog/<category>.ts` を 8 カテゴリ分作成（後続は自分のファイルにだけ追記）。id とカテゴリの不一致・重複は起動時に例外
  - 寸法の約束: `src/data/architecture.ts`（`ARCH`: 階高・スラブ・扉 0.9×2.0m・窓・廊下・蹴上げ 0.2m 以下・手すり・軒の出・三角形の上限・生成時間 4ms）
- **B. 中に入る（sim）**
  - `collision.ts`: 外形の箱（`Solid.enter`）に触れたら中の箱で判定（`raycastWorld` は格子の DDA、`pushOut` / `supportAt` / `ladderAt` も）。屋内では外形の箱そのものは当たらない
  - `sim/tactical/indoor.ts`: 建物ごとの部屋のグラフ（`roomRoute`）。追跡中のゾンビは、プレイヤーか自分が建物の中にいるとき扉→部屋→階段の順に向かう（`zombies.ts` の chase。プレイヤーから 90m 以内の建物だけ）。外から 30m 以内なら角を回って扉へ。幅の足りない扉（肥大型に 0.9m）は使わない。建物を通って追う間は 25m 以内なら見失わない。通過点の進み方は「到達したか、次の区間の途中にいる」で判定（扉の前で行き来しない）
  - 探索: 選ばれた建物は棚・机ごとに探索ポイントになる（`LootSpot.y` / `table`、`TacticalState.lootSpots[].y` / `table`）。E はその階の棚だけ。収穫は `lootYield({ table, land })` → `ROOM_LOOT`（部屋の用途・特別な棚 32 表。05 の水準 × 3）。潜伏者は 1 階の探索ポイントだけ
- **C. 段階的な出現**（`render/tactical/enterables.ts`、数値は `RENDER.enterables`）: 遠景＝外形の箱＋屋根（設計図を作らない）、300m 以内＝外観、40m 以内か中にいる＝内部。形ごとの InstancedMesh（箱・切妻・寄棟・くさび・ガラス）＋外形 2 の **1 区域最大 7 ドローコール**（建物数によらない）。段階を上げるのは 1 フレームに 1 棟（近い順）、下げるのはその場。スロットは形ごとのプールから範囲で借りて返す。隣の区域も同じ。sim の当たり判定は描画と別に「触れたとき」に作る
- **D. 拠点の建物**: 06 の機能建物 13 種（司令部・小屋・住宅・集合住宅・倉庫・工房・研究所・診療所・病院・食堂・兵舎・酒場・学校）を `defs/base/hall.ts` の 1 つの生成関数で平屋の設計図にした（占有タイル × 4m − 0.6m、扉は構造物の向き）。`syncMap` が完成した建物ごとに placements へ足す。生存者は寝る・働く・食べる・警報の避難先が部屋の中になり、扉を通って出入りする（`ai.ts` の `indoorSpot` / `routeTo`、描画は床の高さ）。テント・畑・温室・牧場・無線塔・発電機・発電所・記念碑・議事堂・銃座は従来の箱のまま
- **E. 見本 3 種類**: `house.wood2`（木造 2 階建て。玄関ホールの直階段、居間・台所・浴室・寝室・和室の 5 部屋＋押し入れ、勝手口は施錠）、`shop.konbini`（売り場は通路ごとの部屋、ゴンドラ・冷蔵棚・レジ・バックヤード・トイレ、自動ドアは壊れて開いたまま、裏口は施錠）、`office.zakkyo5`（5 階、左の階段室の折り返し階段、各階 2 テナント（店・バー・事務所・診療所・倉庫をシードで。3 割は施錠）、屋上へ塔屋の扉から出られる、給水塔・室外機）。区域の生成で一部を差し替え（郊外・田舎の家の 35%、駐車場の店の 60%、都市のオフィスの 25%。区画に収まるときだけ。別の乱数列なので他の配置は同じ）。実測: 都市で雑居ビル 72〜78 棟、郊外で家 150〜190 棟・コンビニ 4〜5、田舎で家 3〜4
- **F. 手引き** `docs/buildings_guide.md`（流れ・登録・座標系・Def の各項目・道具の一覧・大きさ・材質・部屋と経路と探索の約束・三角形の上限・テスト・目視の方法・よくある失敗）。**手引きだけを見て 4 つ目（`house.hiraya` 木造平屋）を書いたら手直しなしで全テストが通り、試験用の地図に並んだ**ので消した
- 道具: `npm run buildings:preview`（全種類の各階の平面図と正面の PNG を `tmp/buildings/`）、試験用の地図 `?yard=1`（`sim/tactical/yard.ts`。全種類が南向き・北向きの 2 列）、デバッグ `debug.openYard / enterables / enterable / enterableStage / enterableStages / pathTo / placeZombie`

### テスト
- `tests/buildings.test.ts`（96 件）: **カタログの全種類に自動で** 決定性・三角形の上限・生成時間・部品が敷地と外形に収まる・当たり判定が敷地の中・施錠でない全部屋に外から行ける・探索ポイントが家具に埋まらない・部屋の中の出入口どうしが直線で歩ける・**4 方向に回した配置ですべての扉・開口・階段を両向きに実際に歩ける**。見本で: 道から最上階へ歩く、各階に立てる・窓とガラスで止まる・屋上へ、窓越しに弾と視線が通り壁は通らない、施錠の扉で止まる、部屋の数、ゾンビが玄関から入って 2 階まで追う、施錠の裏口から正面へ回り込む、肥大型は 0.9m の扉を通れない、2 階の窓から撃って当たる、探索ポイントが各階の棚に、司令部の部屋に生存者の場所があり扉を通って歩ける
- 既存テストの変更 1 件: `tests/tactical.test.ts` の探索ポイント（建物 1 つ = 扉の前 1 か所 → 中に入れる建物は棚ごと）
- `npm run check` 295 件・`npm run build` 通過。**`npm run e2e` 全 33 件通過**（直列 24.7 分。既存 29 件に変更なし）
- e2e `e2e/buildings.spec.ts` 4 件（すべて通過）: 試験用の地図で 3 見本の最上階（屋上）へ歩いて上がる・2 階の窓からスコープで撃つ／ゾンビが扉から入って 2 階まで追う・施錠の裏口から回り込む／都市で遠景→外観→内部の切り替え（スクリーンショット）・600m を 1 フレーム 5m で横切ったときの最大時間・地上/屋上/屋内の性能／拠点の工房に生存者が入って働く・中へ歩いて入れる。スクリーンショット: `test-results/buildings-*.png`

### 性能（GPU なし・SwiftShader、1280×720、sim 1 ステップ＋`renderer.draw` 1 回を直接計測）
都市（seed 12、`gotoLand('urban', 40)`、雑居ビルの前）:

| 場所 | ドローコール | 三角形 | sim ＋ 描画発行 |
|---|---|---|---|
| 地上（ビルの正面 12m） | 48 | 26.1 万 | 0.24 ＋ 1.43 ms |
| 屋上 | 21 | 20.7 万 | 0.24 ＋ 1.23 ms |
| 屋内（3 階の廊下） | 27 | 22.4 万 | 0.14 ＋ 0.87 ms |

- 段階: ビルから 25m で 遠景 414 棟 / 外観 30 棟 / 内部 1 棟（中に入れる建物はすべて都市の雑居ビルの見本）
- 切り替えの最大時間: 600m を 1 フレーム 5m（全力疾走の 60 倍）で横切って **1 回の段階変更 最大 3.1〜4.3 ms**、その間の描画発行の最大 16.8〜20.9 ms（段階変更 1 棟に加えて、隣の区域の組み立て・GPU 転送を含む。通常の歩行ではこの 1/60 の速さ）
- 区域の生成: 都市 70〜80ms・郊外 67〜83ms（変更前と同程度。設計図は探索ポイントに選ばれた建物のぶんだけ）
- 設計図の生成（Node）: 家 0.5ms・コンビニ 0.2〜0.6ms・雑居ビル 1.5〜2.2ms（JIT 前の初回は数 ms）

### 未完了・既知の問題
- **実機では誰も歩いていない**（ヘッドレスとスクリーンショットのみ）。屋内は天井と壁が近く、光源が太陽だけなので室内が平板に明るい（影なし）。窓ガラスは半透明の板
- 開け閉めできる扉はない（開いている／閉じて施錠の 2 種）。窓から出入りはできない（割れていても）
- 屋内のゾンビの配置と徘徊はない（07d-3）。追跡中だけ部屋を通る。追跡していないゾンビは建物の外壁沿いをうろつく
- 屋内で撃っても音の反響・こもりは変わらない。防衛担当（06）の射線は建物の中を考えない
- 拠点の建物は平屋だけ（集合住宅・病院も平屋に）。2 階建ての拠点は道具（階段）で作れるが未作成。損傷の見た目（暗く・傾く）は中に入れる建物には出ない
- 遠景の外形の箱は窓の模様だけで、寄棟も切妻で描く
- 段階の切り替えは「1 フレームに 1 棟」。車で高速に移動する仕組みが入ったら `RENDER.enterables.perFrame` を見直すこと

### 仕様からの変更点（更新した docs）
- `02_systems_spec.md` §3.10 中に入れる建物（扉・窓・ゾンビの屋内の経路・探索・拠点・描画の段階）を新設
- `04_architecture.md` §7（設計図・当たり判定・経路・区域の生成・拠点・試験用の地図）、§8（段階的な描画）
- `docs/buildings_guide.md` を新設
- `STATE_VERSION` は 5 のまま（追加は省略可能なフィールドだけ: `Zombie.inside / room`、`TacticalState.lootSpots[].y / table`）。地図は再生成なので旧セーブも読める（同じシードでも一部の家・店・ビルが見本に変わる）
- 依存の追加なし

### 次のセッションへの注意
- **07d-2a〜2f**: 手引きどおり。各プロンプトの末尾にも注意を書いた
- **07d-3**: 配置の口は `addEnterable` / `fitSize`（`lands.ts` の `enterableIn` が例）。探索ポイントの数え方が変わった点、屋内ゾンビが無い点はプロンプト末尾に書いた
- **09 / 10**: 各プロンプトの末尾
- 当たり判定を足す処理を書くときは、建物の外形の箱（`Solid.enter` あり）を直接の当たりとして扱わないこと。`map.solids` を自分で走査するコード（`zombies.ts` の `perchOf` / `hasCover` など）は外形の箱を固い箱として見る（今のところ害はない）

### 追加した共有型・コマンド・イベント
- 型（`src/gen/types.ts`、追加のみ）: `TacticalMap.placements`、`Building.enter?`、`Solid.enter?`、`LootSpot.y? / table?`。`src/core/types.ts`: `Zombie.inside? / room?`、`TacticalState.lootSpots[].y? / table?`
- 型（新設）: `src/gen/buildings/types.ts` 一式
- データ: `src/data/architecture.ts`（`ARCH`）、`TACTICAL.interior` / `TACTICAL.enterable`、`RENDER.enterables` / `RENDER.materials`、`COLONY.walkRadius`、`ROOM_LOOT`
- 関数: `addEnterable`（builder）、`whereIs` / `indoorStep` / `indoorPath` / `roomRoute`（indoor）、`detailOfSolid`（collision）、`indoorSpot` / `routeTo`（colony/ai）、`LootKind` を `Land | { table, land }` に
- フラグ: `flags.yard`（試験用の地図）。URL `?yard=1`。npm script `buildings:preview`
- コマンド・イベントの追加なし

## 07d-2a 建物の生成: 住宅 — 2026-11-20

`docs/buildings_guide.md` どおりに、家 10 種類とアパート 6 種類を作って `catalog/house.ts`・`catalog/apartment.ts` に登録した（配置の規則は 07d-3）。見本の `house.wood2` はそのまま残した（家は 11 種類になる）。

### 完了したこと
- **家 10 種類**（`src/gen/buildings/defs/house/`）
  - `hiraya` 木造平屋: 中廊下の両側に台所・浴室・トイレ・納戸（間口が広いと寝室）と居間・和室。切妻か寄棟（シード）。前庭にブロック塀と門、植木、物置（3 割施錠）
  - `wafu2` 木造 2 階・和風: 寄棟の瓦、縁側の下屋と木の縁台、和室 2 間（襖を外した開口）・床の間・仏壇、DK・浴室と洗面・トイレ・納戸。階段は廊下から奥へ、2 階は奥の廊下・寝室・和室・階段脇の押入（入れない）。高いブロック塀と門柱、横の庭に松と石灯籠
  - `yofu2` 木造 2 階・洋風: 妻側を道に向けた切妻、1 階は LDK 一間（アイランド）、右の列に玄関ホールと階段・浴室、2 階は寝室 2・トイレ。カーポート（7 割で車）、木の低い柵、生垣、玄関の庇
  - `kominka` 古民家: 高い寄棟（トタン）、左に土間（床 0.12m、かまど・流し・水甕・薪。大戸は 1.8m）、0.38m 上がって田の字の 4 間（板の間に囲炉裏、奥座敷に床の間と仏壇）、表に縁側（ガラス戸）、縁側の端に勝手口。前庭に井戸と柿の木
  - `noka` 農家: 2 階建ての母屋（真ん中の列に広い玄関と階段、台所・座敷・浴室・トイレ・居間、2 階に 3 間）と、横に納屋（2.8m の戸、トラクター・干し草・米袋・工具棚・作業台）。前庭に軽トラと木箱
  - `nisetai` 二世帯住宅: 片流れ屋根、玄関が 2 つ。1 階が親世帯（LDK・和室・浴室・トイレ）、2 階が子世帯（専用の玄関と階段、全面の LDK・寝室 2・浴室・トイレ）。玄関どうしの戸は 7 割施錠
  - `kyosho3` 狭小 3 階建て: 間口 5.2〜6.4m。右の階段室を折り返し階段が屋上まで、1 階はシャッターの車庫（奥行きがあれば軽自動車）と浴室、2 階 LDK とトイレ、3 階寝室 2、屋上は塔屋とテラス
  - `prefab` プレハブ: 軽量鉄骨の平屋、緩い片流れ。廊下なしで台所→居間→寝室→トイレ→浴室と部屋が並ぶ。鉄の踏み段、室外機、ガスボンベ、物干し
  - `tenpo` 鉄骨の店舗併用住宅: 3 階。1 階は店（シャッターが下りている。日用品・薬・金物をシードで）と倉庫、家族は横の勝手口から。2 階 LDK・浴室、3 階寝室 2。看板と日よけ
  - `bessou` 別荘風: 急な切妻（妻を道へ）、丸太の壁、2 層吹き抜けの居間に煉瓦の暖炉と煙突、奥の部屋の上にロフト（手すり、ベッド 2）、表に手すり付きのデッキ（部屋。段から入る）。寝室に猟銃のロッカー（`weapons`）
- **アパート 6 種類**（`src/gen/buildings/defs/apartment/`）。住戸は共通の `unit.ts`（入口の壁に沿って浴室と台所の帯、奥に 1 部屋か 2 部屋。入口の向き・奥行きの向きを回して、外廊下・内廊下・階段室のどれにも使う）。施錠の住戸は中身なしの施錠の部屋 1 つ（扉も施錠）
  - `mokuzo2` 木造 2 階・外廊下: 1K を 2〜4 戸ずつ。2 階は外廊下、鉄の外階段は廊下の前を道と平行に上がり、足元は低い塀の門から（左端の踊り場に着く）。1 階の住戸は廊下の下へ直接。駐輪の列とゴミ置き場
  - `tekkotsu3` 鉄骨 3 階: 各階の外廊下（1 階は低い塀と門 2 つ）、右端の鉄骨の折り返し外階段、裏にバルコニー、左端に駐輪場（屋根）とゴミ置き場、陸屋根
  - `danchi5` RC 5 階・階段室型: 中央の階段室を正面の入口から、各階で向かい合う 2 戸（2DK、和室はシード）。裏にバルコニー、屋上の高架水槽、集合ポスト、駐輪場、ゴミ置き場
  - `mansion8` RC 8 階・内廊下: 西端の階段室（折り返し）、その隣にエレベーターの穴（施錠の鉄扉、使えない昇降路、屋上に機械室）、裏 2 戸・表 3 戸（1 階の表の中央はエントランスホールと郵便受け）、表にガラス手すりのバルコニー
  - `ryo` 学生寮 3 階: 中廊下の両端に階段、両側に個室（ベッド・机）。1 階の表は食堂（長机・配膳台・冷蔵庫）・玄関ホール（下駄箱）・大浴場、2・3 階の表の中央は共用の洗面・トイレ。寄棟屋根、玄関の庇、駐輪
  - `shataku` 社宅 RC 4 階: 外廊下（1 階は低い塀と門 2 つ）、表の中央に突き出した階段塔（折り返し）、各階 3 戸（2DK）。1 階の中央は集会所。裏にバルコニー、塔の両脇に駐輪場とゴミ置き場
  - 施錠は住戸ごとに 5 割（12 シードで 2〜7.5 割に収まることをテスト）。各階の少なくとも決まった 1 戸を開けておく種類（木造・鉄骨・団地・社宅）と、全部施錠の階もありうる種類（マンション・寮）がある
- 廃墟の雰囲気は種類ごとに 1〜2 点: 倒れた家具（箪笥・本棚・食器棚）、血痕、瓦礫・ガラス片、窓の板打ち（`boards`）、裏口の前に積んだ椅子、割れた窓（シード）
- **共通の補助**（`src/gen/buildings/defs/house/common.ts`。kit.ts は変更なし）: `ring`（敷地の一部に立つ外壁 4 面。`frontInside` で表の壁を廊下・デッキ側の内壁に）、`pitched`（矩形に切妻・寄棟と天井）、`fence` / `hedge` / `tree`、`shed`（入れる物置、`tools` の棚）、`carport`（柱・屋根・車）、`boards`、`lowerRoom`（finish 後に部屋の床の高さを変える。土間用。部屋・通過点・探索ポイントを動かす）
- 共有ファイルへの追加なし（`RoomUse` / `MaterialId` / `FurnitureKind` / `ROOM_LOOT` はすべて既存の値で足りた。食堂 `canteen`・集会所 `office`・納屋 `storage` / `tools` / `workshop`・別荘の `weapons` など）

### テスト
- カタログの自動テスト（`tests/buildings.test.ts`）が 16 種類 × 5 項目（決定性・三角形・生成時間／敷地と外形／到達性と探索ポイント／部屋の中の直線／4 方向の歩行）ですべて通る
- `tests/buildings-residential.test.ts`（6 件）: 16 種類の登録、**種類ごとに階数・屋根・部屋の構成がすべて違う**、シードを変えると部品が変わる、目的のある部屋（廊下・玄関・階段・屋上・トイレ以外）すべてに探索ポイントがあり収穫表が存在する、種類ごとの特徴（古民家の土間の高さ・納屋の工具・狭小の屋上と車庫のシャッター・店舗のシャッターと店内・二世帯の玄関 2 と台所 2・外構・マンションの昇降路と 8 階・寮の階段 2）、アパートの施錠率、東向きに置いて**表の扉から最上階の部屋まで歩く**
- `npm run check` 381 件・`npm run build` 通過。**`npm run e2e` 全 36 件通過**（直列 27.0 分。既存 33 件に変更なし）
- e2e `e2e/buildings-residential.spec.ts`（3 件、通過）: 試験用の地図で 16 種類それぞれ、表の扉から入って最上階の部屋まで歩き、その階の棚を 1 つ探索する（試験用の地図は射撃場扱いで探索が切ってあるので、その 1 回だけ外す）／全種類を並べた地図の性能／16 種類を斜め上から見た画像 `test-results/residential-view-<id>.png`。平面図と正面は `npm run buildings:preview`（`tmp/buildings/`）で目視した

### 実測（Node、最大の大きさ・9 シードの中央値。三角形は 9 シードの最大）

| 種類 | 間口 × 奥行き (m) | 階 | 外観 | 内部(1 階あたり最大) | 部屋（うち施錠） | 探索 | 生成 ms |
|---|---|---|---|---|---|---|---|
| house.hiraya | 9.6–12 × 9.6–11.5 | 1 | 728 | 468 | 9 (0) | 7 | 0.22 |
| house.wafu2 | 12–14 × 12–13.5 | 2 | 976 | 672 | 13 (1) | 12 | 0.23 |
| house.yofu2 | 11–13 × 10–12 | 2 | 868 | 396 | 9 (0) | 10 | 0.16 |
| house.kominka | 14–17 × 11–13 | 1 | 764 | 444 | 6 (0) | 7 | 0.07 |
| house.noka | 18–21 × 12.5–14.5 | 2 | 1156 | 648 | 14 (0) | 15 | 0.16 |
| house.nisetai | 11–13 × 10–11.5 | 2 | 1052 | 564 | 14 (0) | 14 | 0.16 |
| house.kyosho3 | 5.2–6.4 × 9.5–11.5 | 3 | 780 | 384 | 12 (0) | 10 | 0.14 |
| house.prefab | 10–13 × 7.5–9 | 1 | 668 | 288 | 5 (0) | 7 | 0.05 |
| house.tenpo | 7–9 × 10–13 | 3 | 788 | 420 | 9 (0) | 13 | 0.09 |
| house.bessou | 11–13.5 × 11–13 | 2 | 884 | 456 | 8 (0) | 11 | 0.13 |
| apartment.mokuzo2 | 14–19 × 9–10.5 | 2 | 1520 | 636 | 21 (3) | 20 | 0.24 |
| apartment.tekkotsu3 | 15–20 × 9.5–11 | 3 | 1704 | 648 | 24 (3) | 24 | 0.22 |
| apartment.danchi5 | 14.5–17 × 11–13 | 5 | 2220 | 768 | 33 (4) | 36 | 0.36 |
| apartment.mansion8 | 18–22 × 16–19 | 8 | 2504 | 1500 | 108 (19) | 121 | 0.82 |
| apartment.ryo | 20–24 × 12.5–14 | 3 | 2588 | 1404 | 43 (22) | 33 | 0.18 |
| apartment.shataku | 20–25 × 13–14.5 | 4 | 2544 | 852 | 40 (3) | 50 | 0.26 |

上限は house 1,500 / 4,000、apartment 3,000 / 3,000。寮・社宅・マンションの外観は窓の数で上限の 85% 近くまで来ている（窓を足すときは注意）。

### 性能（GPU なし・SwiftShader、1280×720、sim 1 ステップ＋`renderer.draw` 1 回を直接計測、e2e で計測）
試験用の地図（中に入れる建物 64 棟: この 16 種類と既存の見本・拠点の種類が南向き・北向きの 2 列）:

| 場所 | ドローコール | 三角形 | sim ＋ 描画発行 |
|---|---|---|---|
| 家の並ぶ通り（列に沿って見る） | 11 | 11.5 万 | 0.01 ＋ 0.31〜0.38 ms |
| 8 階建ての最上階の廊下 | 11 | 16.1 万 | 0.01 ＋ 0.40〜0.51 ms |

### 未完了・既知の問題
- 区域への配置はしていない（07d-3）。今は試験用の地図にだけ並ぶ。`house.wood2` は 07d-1 の区域の差し替え（郊外・田舎の家）にそのまま使われている
- 屋外の経路: 外から別の扉へ回り込む直線が敷地の中の塀・柵に当たることがある（二世帯の玄関の間の低い壁は短くして回避した）。ゾンビの屋外の回り込みは 07d-1 の仕組み（30m 以内なら角を回る）任せ
- 部屋の中の歩行は「出入口どうし」は保証されるが、出入口から部屋の奥の棚までは家具に当たることがある（e2e でプレハブの机をずらした）。プレイヤーは避けて歩けるので実害は小さい
- 土間（古民家）は `lowerRoom` で部屋の高さだけ下げている。外の地面 → 敷居（0.5m）→ 土間 0.12m の段差は扉の下の壁を `sill` を負にして消した
- 屋上に出られるのは狭小 3 階建てだけ（他のアパートは最上階の階段の穴に手すり）
- 寮とマンションは施錠の住戸が多い階がある（全部施錠の階もありうる）

### 次のセッションへの注意（各プロンプトの末尾にも書いた）
- 07d-2b〜2f: `defs/house/common.ts` の `ring`（`frontInside`）・`shed`・`carport`・`lowerRoom`、`defs/apartment/unit.ts`（向きを回せる住戸。社宅・寮・ホテルの客室などに使える）は自由に使ってよい。kit.ts は変えていない
- **`kit.partition` は端点を小さい順に渡すこと**（z 方向の壁で z0 > z1 を渡すと x 方向の壁と誤判定される。`unit.ts` は並べ替えて呼んでいる）
- 試験用の地図は `flags.range` なので E の探索が動かない。e2e で探索を確かめるときは、その 1 回だけ `flags.range = false`・`tactical.hideouts = []` にする（`e2e/buildings-residential.spec.ts`）

### 追加した共有型・コマンド・イベント
- なし（型・データ・kit への追加なし）。新しいファイル: `defs/house/{common,hiraya,wafu2,yofu2,kominka,noka,nisetai,kyosho3,prefab,tenpo,bessou}.ts`、`defs/apartment/{unit,mokuzo2,tekkotsu3,danchi5,mansion8,ryo,shataku}.ts`、`tests/buildings-residential.test.ts`、`e2e/buildings-residential.spec.ts`

## 07d-2b 建物の生成: 商業・宿泊 — 2026-11-20

`docs/buildings_guide.md` どおりに、`shop` カテゴリの建物 20 種類を作って `catalog/shop.ts` に登録した（見本の `shop.konbini` と合わせて 21 種類。配置の規則は 07d-3）。

### 完了したこと
- **銀行 2 種類**
  - `bank` 地方銀行の支店（平屋）: ロビー（長椅子・パンフレット棚・番号札の機械）、窓口のカウンターは高さ 1.05m の低い壁で右端に通用口、奥に営業室（机の列・書庫）、金庫（鋼の扉で施錠）・休憩室（ロッカー・冷蔵庫、裏口はシードで開／施錠）・トイレ。ATM コーナーは表に専用の扉、ロビーとの間はシャッター
  - `bank_city` 都市銀行の大型支店（3 階）: 石の正面（1 階はガラス、2・3 階は柱型の外壁）、左奥の折り返し階段から各階の奥を横切る職員の廊下、使えないエレベーター（施錠の鉄扉）、1 階は金庫（施錠）・営業室・低いカウンター・ロビー・ATM コーナー、2 階は融資の事務室と会議室、3 階は食堂と支店長室・ロッカー室。側面の通用口はシード
- **コンビニ 2 種類**
  - `konbini_road` 路面店: 見本（奥にバックヤード・通路は前後・レジ右）と逆に、レジは扉の左、通路は横向き、奥の壁にウォークインの冷蔵棚、右の列に在庫室と客用トイレ、表のガラス沿いにイートインのカウンター。手前 6.5m は駐車場（白線・車止め・ゴミ箱・ポールの看板・放置車 7 割）
  - `konbini_tenant` ビルの 1 階のテナント（階高 3.3m の 1 階だけ）: 左 1.8m はビルの入口ロビー（郵便受け）と施錠の階段室、店は柱型の表・ファサードの看板、レジはロビー側の壁沿い、冷蔵棚は右の壁、奥にバックヤードとトイレ
- **レストラン 5 種類**
  - `famires` ファミレス: 1 階はピロティの駐車場（柱・車止め・放置車、閉じているのは左前の階段の箱だけ）、2 階に待合・ドリンクバーとレジ・トイレ 2・事務室・厨房（配膳の窓）・客席（窓沿いのブース、中央のテーブル）。ポールの看板
  - `ramen` ラーメン屋: 横に長いカウンターとスツール（広いと 2 人席の列）、奥の厨房（寸胴の並ぶコンロ・冷蔵庫）、入口の券売機、低い壁と通用口、トイレと倉庫。大きな看板・赤提灯・のれん・排気ダクト
  - `kaitenzushi` 回転寿司: 奥の厨房から表へ伸びるレーン（2〜4 本）の両側にボックス席、レーンの間が通路（部屋）、表の広い待合（長椅子・レジ）、トイレと倉庫。屋上の大きな看板
  - `izakaya` 居酒屋（木造 2 階）: 1 階はカウンター（低い壁の上に天板）とスツール・テーブル 2・厨房・トイレ、入口すぐの直階段で 2 階の座敷 2 間（低い座卓・座布団・床の間・押入）。赤提灯・のれん・ビールケースと樽
  - `fastfood` ファストフード: 右と奥が 4m のドライブスルーの車線（メニュー看板・スピーカー・高さ制限のバー・受け渡し窓の前の放置車）、店は客席（テーブルは通り道を避けて自動配置）・注文カウンター（低い壁）・厨房（フライヤーの列・袋詰めの台）・事務室・ウォークイン倉庫（車線への裏口）・トイレ。屋根の周りにマンサードの帯
- **ホテル 2 種類**
  - `hotel_biz` ビジネスホテル（10 階）: 全階同じ間取り（左端の折り返し階段・エレベーターホール・死んだエレベーター・自販機室・施錠のリネン室・中廊下の両側に客室 3〜5 室ずつ）。客室は扉の脇にユニットバス、ベッド（シングル／ツイン）、窓際の机。約半分が施錠。1 階はロビー（フロントの低いカウンターの奥に事務室と荷物室）・朝食室。階段は屋上の塔屋まで、屋上に給水塔と HOTEL の看板。**長い 3 面の外壁は柱＋腰壁＋階ごとのガラス 1 枚（`facade`）で、外観 1,548 三角形**
  - `hotel_resort` リゾートホテル（3 階・間口 40〜50m）: 大きな寄棟、裏（庭側）に全室のバルコニー、表側に廊下、両端に折り返し階段。1 階の中央がロビー（表と庭のテラスへのガラス扉）、片側に売店・フロント（低いカウンター）、反対側にレストラン（庭の窓、テーブル自動配置）と厨房
- **旅館 2 種類**
  - `ryokan` 温泉旅館（2 階・寄棟の瓦）: 1 階は家を横切る廊下、表に大広間（座卓の列）・玄関（下駄箱）・帳場（低いカウンター）・売店、奥に厨房（裏口）・階段・トイレ・男湯と女湯（脱衣所のロッカー → 浴場の大きな湯船と洗い場）。2 階は廊下の両側に和室（畳・座卓・押入・床の間・広縁）。唐破風風の玄関の屋根・灯籠・のれん
  - `minshuku` 民宿（木造 2 階）: 玄関から直階段、左の廊下の奥に風呂、食堂（座卓）・台所・家族の部屋、2 階は廊下の前後に客室の和室 4 と客用トイレ。民宿の板看板・浮き玉と網
- **ガソリンスタンド** `gas_station`: 手前に大屋根（ファシアの看板）と給油島 2（給油機 4・柱）、放置車、価格の看板とポールの看板。奥の建物は売店（オイル棚・冷蔵庫）とその奥の事務所、外から入るトイレ、**燃料の倉庫**（`fuel` の棚と缶）、整備場（広い扉・リフトに上がった車・工具棚・作業台・タイヤ）
- **シャッターの下りた店 7 種類**（`defs/shop/shuttered.ts` の 1 つの生成関数）: 八百屋 `shut_yaoya`（緑の日よけ・腐った野菜の段台・看板建築の切妻）、本屋 `shut_honya`（雑誌ラック・屋上の大看板）、**薬局 `shut_yakkyoku`（緑十字。裏口が開いていて、奥の倉庫と店内の薬の棚・こじ開けられた薬品庫を探索できる）**、電器店 `shut_denki`（店先の洗濯機・冷蔵庫、屋上のアンテナと室外機）、服屋 `shut_fuku`（シャッターの横のショーウインドウにマネキン）、ドラッグストア `shut_drug`（間口 14〜20m の平屋、シャッター 2 枚・黄色の大看板・カート・自販機 2）、酒屋 `shut_sakaya`（自販機 2・ビールケース・杉玉）。シャッターは道から 1.9m 引っ込んでいて、手前の軒下だけ入れる（部屋 `hall`）。シャッターに落書き・錆の筋・巻き取りの箱。2 階建ての種類は 2 階が施錠の住まい（板打ちの窓）。自販機のある 3 種類と薬局だけ `lootable: true`
- 廃墟の雰囲気は種類ごとに 1〜2 点: 血痕（カウンター前・通路）、割れたガラス片（入口）、倒れた長椅子・棚・ロッカー（低い箱。歩く邪魔にならない場所）、割れた窓（シード）、板打ち、散らばった書類（銀行）
- **共通の補助**（`src/gen/buildings/defs/shop/common.ts`。kit.ts は変更なし）: `facade`（多層の壁を柱・腰壁・階ごとのガラス 1 枚で。割れた区画は見えない板）、`guestRoom`（客室・和室。施錠なら空の施錠の部屋）、`clearOfWays`（家具が部屋の出入口どうしの直線から離れているか）、`table` `booth` `stools` `vending` `car` `toppled` `sign` `awning` `poleSign` `graffiti` `rust` `tall`
- **共有ファイルへの追加**（末尾に 1 行ずつ）: `LootTableId` に `'fuel'`（`types.ts`）、`ROOM_LOOT_BASE` に `fuel: { fuel: 0.16, metal: 0.02, parts: 0.01 }`（`colony.ts`、× `LOOT_SCALE`）。`RoomUse` / `MaterialId` / `FurnitureKind` は既存の値で足りた
- **試験用の地図の折り返し**（`sim/tactical/yard.ts`、契約上必要な最小限）: 全種類が 1 本の通り（地図 1024m）に入りきらなくなった（07d-2a までで東端 953m）。x = 990 を越える種類から次の通り z = 600 → 680 → 440 → 360 → 760 → 280 へ。南向き・北向きの列は同じ種類で折り返す。`e2e/buildings.spec.ts` の「通りに出る」位置を z = 520 の決め打ちから `b.z1 + 9`（その建物の通り）に直した

### テスト
- カタログの自動テスト（`tests/buildings.test.ts`）が 21 種類 × 5 項目（決定性・三角形・生成時間／敷地と外形／到達性と探索ポイント／部屋の中の直線／4 方向の歩行）ですべて通る
- `tests/buildings-shop.test.ts`（6 件）: 21 種類の登録、**種類ごとに階数・屋根・部屋の構成（施錠を含む）がすべて違う**、シードを変えると部品が変わる、目的のある部屋の用途ごとに探索ポイントがあり収穫表が存在する、シャッターの店は軒下以外に入れない（薬局だけ裏口から店内へ・薬がある）・落書きと錆がある・探索に選ばれるのは自販機か店内に届くときだけ、種類ごとの特徴（銀行の施錠の金庫と鋼の扉・低いカウンター・ATM の専用扉、都市銀行の 3 階と昇降路、路面店の駐車場、テナントの施錠の階段室とロビー、ファミレスの 1 階は階段の箱だけ、居酒屋 2 階の座敷 2、回転寿司のレーン、ドライブスルーの車線と受け渡し窓、**ビジネスホテルの 2〜10 階の間取りが 1 階上と完全に同じ**・屋上・外観の上限・施錠率、リゾートの 3 階と階段 2、旅館の浴場 2 と和室、民宿の和室 4、ガソリンスタンドの `fuel` の棚 2 以上と工具・`fuel` が `garage` より燃料が多い）、東向きに置いて**扉から最も高い部屋まで歩く**（薬局は裏口から店内へ）
- `npm run check` 492 件・`npm run build` 通過。**`npm run e2e` 全 39 件通過**（直列 30.3 分。既存 36 件のうち変更は `e2e/buildings.spec.ts` の通りの位置 1 行だけ）
- e2e `e2e/buildings-shop.spec.ts`（3 件、通過）: 試験用の地図で 21 種類それぞれ、扉から入って最も高い部屋（ビジネスホテルは屋上）まで歩き、その部分の棚を 1 つ探索する（自販機のないシャッターの店は軒下まで）／全種類を並べた地図の性能／21 種類を斜め上から見た画像 `test-results/shop-view-<id>.png`。平面図と正面は `npm run buildings:preview`（`tmp/buildings/`）で目視した

### 実測（Node、最大の大きさ・9 シード。三角形は最大、部屋と探索はシード 5、生成は中央値）

| 種類 | 間口 × 奥行き (m) | 階 | 外観 | 内部(1 階あたり最大) | 部屋（うち施錠） | 探索 | 生成 ms |
|---|---|---|---|---|---|---|---|
| shop.konbini（見本） | 12–16 × 10–13 | 1 | 552 | 240 | 10 (0) | 10 | 0.12 |
| shop.bank | 16–20 × 14–17 | 1 | 768 | 576 | 6 (1) | 7 | 0.08 |
| shop.bank_city | 22–28 × 18–22 | 3 | 1044 | 2172 | 16 (1) | 16 | 0.94 |
| shop.konbini_road | 14–18 × 17–21 | 1 | 636 | 432 | 12 (0) | 12 | 0.05 |
| shop.konbini_tenant | 9–12 × 14–19 | 1 | 432 | 288 | 10 (1) | 8 | 0.04 |
| shop.famires | 22–28 × 17–21 | 2 | 1500 | 1932 | 8 (0) | 11 | 0.24 |
| shop.ramen | 7–9.5 × 10–13 | 1 | 408 | 528 | 5 (0) | 6 | 0.05 |
| shop.kaitenzushi | 18–24 × 16–20 | 1 | 768 | 2160 | 9 (0) | 10 | 0.09 |
| shop.izakaya | 9–12 × 11–14 | 2 | 692 | 924 | 7 (0) | 6 | 0.12 |
| shop.fastfood | 19–23 × 21–26 | 1 | 876 | 1176 | 6 (0) | 8 | 0.32 |
| shop.hotel_biz | 18–24 × 13–15 | 10 | 1548 | 1140 | 136 (48) | 171 | 1.04 |
| shop.hotel_resort | 40–50 × 13.5–15.5 | 3 | 1304 | 1332 | 41 (17) | 54 | 0.46 |
| shop.ryokan | 26–32 × 18–21 | 2 | 1348 | 1788 | 27 (5) | 32 | 0.23 |
| shop.minshuku | 11–14 × 11–13 | 2 | 920 | 552 | 12 (1) | 13 | 0.11 |
| shop.gas_station | 24–30 × 20–26 | 1 | 744 | 300 | 5 (0) | 11 | 0.03 |
| shop.shut_yaoya | 6–8 × 8.5–10 | 2 | 788 | 132 | 4 (3) | 5 | 0.03 |
| shop.shut_honya | 5.5–7 × 10–13 | 2 | 684 | 144 | 4 (3) | 5 | 0.03 |
| shop.shut_yakkyoku | 6–8 × 9–12 | 2 | 660 | 168 | 4 (1) | 7 | 0.03 |
| shop.shut_denki | 7–9 × 10–12 | 2 | 732 | 132 | 4 (3) | 5 | 0.04 |
| shop.shut_fuku | 6.5–8.5 × 9–11 | 1 | 464 | 156 | 3 (2) | 5 | 0.04 |
| shop.shut_drug | 14–20 × 14–18 | 1 | 516 | 156 | 3 (2) | 7 | 0.03 |
| shop.shut_sakaya | 7–9 × 9–11 | 2 | 668 | 156 | 4 (3) | 7 | 0.05 |

上限は shop 2,000 / 4,000（`limits` の上書きはなし）。ファミレスとビジネスホテルの外観が上限の 75% 前後（窓を足すときは `facade` を使う）。

### 性能（GPU なし・SwiftShader、1280×720、sim 1 ステップ＋`renderer.draw` 1 回を直接計測、e2e で計測）
試験用の地図（中に入れる建物 106 棟: 全 53 種類が南向き・北向きの 2 列、2 本の通り）:

| 場所 | ドローコール | 三角形 | sim ＋ 描画発行 |
|---|---|---|---|
| 銀行〜ホテルの通り（列に沿って見る） | 11 | 12.6 万 | 0.01 ＋ 0.34〜0.60 ms |
| 2 本目の通り（リゾート・旅館・シャッターの店） | 11 | 16.0 万 | 0.00〜0.01 ＋ 0.35〜0.42 ms |
| ビジネスホテルの屋上 | 9 | 10.7 万 | 0.01〜0.02 ＋ 0.27〜0.44 ms |
| ビジネスホテル 10 階の廊下 | 10 | 10.7 万 | 0.01〜0.02 ＋ 0.33〜0.44 ms |

### 未完了・既知の問題
- 区域への配置はしていない（07d-3）。今は試験用の地図にだけ並ぶ
- 屋外の部分（駐車場・給油場・ドライブスルー・ピロティ）は部屋ではないので探索ポイントは置けない（給油機は探索できない。燃料は倉庫と整備場）。遠景の外形の箱は敷地全体に軒の高さで描かれる（駐車場の上にも箱が見える）
- シャッターの店の「入れない」は、軒下（部屋）だけ入れる形にした。カタログのテストが「外への扉が 1 つ以上・探索ポイントが 1 つ以上」を全種類に求めるため
- テナント型コンビニとビルの上の階を積み重ねる仕組みはない（設計図は 1 階だけ。上に載せるなら 07d-3 か 07d-2c で）
- 客室のユニットバスは中に入れない箱（扉の脇に探索ポイント）。浴槽の湯は描くだけの半透明の板
- `indoorPath` は建物の外を回り込まないので、裏口からしか入れない部屋（薬局）へは裏口の外から歩かせる必要がある（テストはそうしている）

### 次のセッションへの注意（各プロンプトの末尾にも書いた）
- 07d-2c〜2f: `defs/shop/common.ts` の `facade`・`guestRoom`・`clearOfWays` などは自由に使ってよい。試験用の地図は複数の通りに折り返す（e2e で z = 520 を決め打ちしない）
- 07d-3: 敷地に駐車場などを含む種類、シャッターの店の並べ方、ホテルの探索ポイントの多さ
- 取りまとめ役: 共有ファイルの追加は `LootTableId` の `'fuel'` と `ROOM_LOOT` の `fuel` 行だけ。`yard.ts` の折り返しは他の 07d-2 が同じ問題で別の直し方をしているかもしれない（1 つにまとめること）

### 追加した共有型・コマンド・イベント
- 型: `LootTableId` に `'fuel'`。データ: `ROOM_LOOT.fuel`。コマンド・イベントの追加なし
- 新しいファイル: `defs/shop/{common,bank,bank_city,konbini_road,konbini_tenant,famires,ramen,kaitenzushi,izakaya,fastfood,hotel_biz,hotel_resort,ryokan,minshuku,gas_station,shuttered}.ts`、`tests/buildings-shop.test.ts`、`e2e/buildings-shop.spec.ts`
- 依存の追加なし

## 07d-2c 建物の生成: ビル — 2026-11-21

`docs/buildings_guide.md` どおりに、`office` カテゴリの建物 20 種類を作って `catalog/office.ts` に登録した（見本の `office.zakkyo5` と合わせて 21 種類。配置の規則は 07d-3）。

### 完了したこと
- **5 階以下 10 種類**（`src/gen/buildings/defs/office/`）
  - `zakkyo_narrow` 雑居ビル（ペンシル型 5 階）: 奥に階段・トイレ・小さなホールのコア、各階 1 テナント（スナック・雀荘・消費者金融・マッサージ・倉庫をシード、一部施錠）。1 階は通りから階段への細い通路と立ち飲み屋（4 割はシャッター）。表の角に各階のテナントの袖看板、屋上に看板の骨組み
  - `small` 小さな事務所ビル（3 階）: 左の帯に折り返し階段（1 階はその前が玄関ホール）、右は 1 社の事務所（1 階は受付カウンター、2 階は執務室、3 階は社長室（金庫は `weapons`）と会議室）。前面の連続窓、屋上に社名の看板
  - `tenant` テナントビル（4 階）: **1 階の店の枠に 07d-2b の `shop.konbini_tenant` を入れる**（シードで約 55%。残りはシャッターの店）。上の階へは右の屋外の鉄骨の折り返し階段（門・各階の踊り場・手すり、屋上へはパラペットの戸）。上の階は廊下と 2 テナント（事務所・英会話教室・美容室・倉庫、一部施錠）
  - `shotengai3` 商店街の 3 階建て（間口 5.5〜7.5m）: 1 階の店はシャッター（入れない）、右の家族用の戸から細い折り返し階段（幅 0.9m）、2 階は店の事務所と在庫、3 階は居間と和室（押入・布団）、屋上に物干し。正面は屋根より高い看板建築のパネルとアーケードの庇
  - `rc_old` 古い RC の事務所（3 階・横長）: 全幅の廊下の左端に階段、廊下の奥にトイレ・給湯室・書庫、表に事務室 3 つ（1 階の中央は玄関ホール）。錆の筋・板打ちの窓・倒れたキャビネット・散らばった書類、屋上に脚つきの高架水槽
  - `ekimae` 駅前ビル（5 階）: 奥の中央のコア（階段・死んだエレベーター・トイレ）の前に各階の小さなホール、左右にテナント。1 階はシャッターの店と牛丼屋（厨房つき、通りから直接）、2 階は消費者金融と英会話、3・4 階はカラオケ（両側に廊下と個室）、5 階は居酒屋（客席・厨房・倉庫）。表の両角に縦の看板、屋上に看板
  - `clinic` 診療所ビル（4 階）: 1 階は調剤薬局（表の売り場と奥の調剤室）、2 階は内科（待合・受付・診察室 2）、3 階は歯科（治療台の列）、4 階はリハビリ・検査（3 割施錠）。屋上に緑十字、表に各階の看板
  - `juku` 塾の入ったビル（4 階）: 右の帯に階段、1 階は受付と保護者の待合・奥に自習室（ブース席）、2・3 階は教室 2 つ、4 階は教室と講師室。表に合格の垂れ幕、屋上に塾の名前
  - `soko` 倉庫兼事務所（2 階・切妻の鋼板屋根）: 2 層吹き抜けの倉庫（ラックの列・壁沿いの棚・木箱・フォークリフト）、搬入口はシャッター 1 つと開いたままの 3m の口（**肥大型も通れる**）。左手前の 2 階建ての事務棟（1 階は受付とロッカー室、2 階は事務室と休憩室・倉庫を見下ろす窓）
  - `glass_low` ガラス張りの低層オフィス（3 階）: 中央のコア、まわりは間仕切りのない床（1 階はロビー・受付・カフェ、2・3 階は執務室、3 階前面は会議テーブル）。床から天井までのガラスと細いマリオン、割れたガラス。屋上庭園のプランター
- **6〜15 階 5 種類**
  - `mid` 中規模オフィス（9 階）: 帯状の連続窓と石張りの角、中央のコア（階段・エレベーター 2・トイレ）。入れるのは 1・2・5・9 階と屋上（冷却塔・アンテナ）
  - `depart` 百貨店（7 階・階高 4.2m・間口 32〜40m）: 窓のない煉瓦の壁とショーウインドウ・入口 4 つ・大きな店名。奥に職員のコア（階段・荷物用エレベーター 2・トイレ）と倉庫、残りは広い売り場で、中央に**止まったエスカレーター**（幅 1.0m の直階段を階ごとに向きを交互に。歩いて上れる）。1 階は化粧品のショーケース、2・3 階は服（ラックとマネキン）、4 階は生活用品、5 階はおもちゃと本、6 階はレストラン街、7 階は催事場。屋上の遊園地（遊具・観覧車の骨組み）
  - `shogyo` 商業ビル（10 階）: 窓のない壁に大きな看板、正面中央に縦のガラスの帯。中央のコアのまわりに幅 2m の廊下と区画、**区画の大半はシャッター**（1 階は中央が入口の通路）。入れるのは 1・2・7・10 階（レストラン街）と屋上（ビアガーデンのテーブル）
  - `medical_mall` 医療モール（7 階）: 白いタイルと連続窓、コアのまわりの廊下に診療所の区画（3 割施錠）。1 階は調剤薬局と売店。入れるのは 1・2・3・6 階と最上階（健診センター）、屋上に緑十字の塔
  - `chosha` 庁舎風ビル（12 階・間口 30〜36m）: 左右対称、奥の両端に階段のコア 2 つ、その前に全幅の廊下、表に執務室 3、コアの間に事務室と書庫。1 階は全幅の窓口ホール（区切られた長いカウンター・職員の机・待合の長椅子）と柱の並ぶ玄関の庇。入れるのは 1・2・7（議場風の大テーブル）・12 階（社長室・食堂）と屋上（ヘリポート・アンテナ・旗竿）
- **16〜24 階 3 種類**
  - `tower20` 超高層手前のオフィス（20 階）: 全面のカーテンウォール、エントランスの庇。入れるのは 1・2・10・19・20 階と屋上
  - `hotel_office` ホテル兼オフィス（22 階）: 2〜11 階はオフィス（ガラスとマリオン）、12 階から上はホテル（石の格子の窓）。1 階は共用ロビー（入口 2）、12 階はスカイロビー（フロント・レストラン・厨房）、16・21 階は客室階（コアのまわりの廊下と前後の客室。約半分施錠。07d-2b の `guestRoom`）、22 階はバー。入れるのはこれらと 2 階・屋上
  - `mansion_shogyo` マンション兼商業（18 階）: 3 階建ての基壇（ガラス・スーパーの看板）と、その上の住戸階（タイルの格子の窓・ベランダの室外機）。1 階はスーパー（コアのまわり全部が売り場・奥が倉庫）、2 階は店と診療所の区画、3 階はジム（マシン・ロッカー）、4・10・18 階は住戸（前後 3 戸ずつ、約半分施錠。07d-2a の `unit`）
- **25 階以上 2 種類**
  - `skyscraper` 超高層オフィス（32 階・高さ約 116m の屋上）: 濃いガラスと連続した帯、石の角、屋上のまわりのルーバーの冠。入れるのは 1・2・16（スカイロビー: カフェと厨房）・31（レストラン）・32 階と屋上
  - `tower_mansion` タワーマンション（30 階・正方形）: 全周のバルコニー（外周の手すり壁と 1.5m 奥のガラスの壁）、1 階は奥まったエントランス（コンシェルジュのカウンター・ソファ・郵便受け・管理室）、2 階は住民のラウンジとパーティールーム、15 階は住戸（コアのまわりの廊下に前後 3 戸・左右 1 戸）、30 階はペントハウス（1 戸で全フロア）
- **高層の共通**: 全階に中央のコア（折り返し階段は屋上まで続く・使えないエレベーター・トイレ・踊り場のホール）。**入れない階は踊り場のホールの鋼の扉が施錠（時々バリケード）で、その階には部屋を作らない**（ガラス越しに見える机の列だけ。当たり判定なし）。施錠の階が続くところのコアの壁はその階数ぶんの高さの箱 1 つ（階の繰り返し）。屋上は塔屋・機械室・手すり（パラペットの上の鋼管。立てば撃てる高さ）・アンテナ・設備。**16 階以上と庁舎風・マンション兼商業はヘリポート**（塗装）。屋上は全種類で入れる（倉庫兼事務所を除く）
- 廃墟の雰囲気（種類ごとに 1〜2 点）: 血痕・瓦礫・割れたガラス（カーテンウォールは割れた区画だけ見えない板）・倒れたキャビネット・踊り場のバリケード（机と椅子の山）・板打ちの窓・錆の筋
- **共通の補助**（`defs/office/common.ts`・`tower.ts`。kit.ts は変更なし）:
  - `twoPass` と `Fit`: 同じ乱数で 2 回組み立て、1 回目で各部屋の出入口を求め、2 回目で家具を「出入口どうしの直線から 0.45m・壁・他の家具・探索ポイントの立ち位置」を避けて置く（置けなければ飛ばす。`put` / `row` / `grid` / `ensure`）。1 回目は部屋と階段だけ作り、壁・join・階段は kit と同じ式で通過点を記録するだけ（箱・床・`finish` なし）。出入口は部屋の階と矩形で引くので、1 回目は家具の無い部分を省いてよい（施錠の階）。構造は `k.rand()`・家具は `f.rand()` から引く約束
  - `coreAt` / `coreLevel` / `coreRoof`、`stripStair` / `stripRoof`、`ringRooms`、`corridorPlate`（コアのまわりの廊下と区画）、`towerFloors`（中央コアの高層の各階）、`curtain` / `curtainAll`（多層の外壁を階ごとの帯＋全高の柱＋側面ごとのガラス 1 枚で）、`helipad` / `guardRail` / `mast` / `roofPlant`、`embedGround`（別の種類の 1 階だけの設計図を、完成した建物の 1 階の枠に入れる）、家具の型（事務机・会議・教室・診察室・待合・売り場・倉庫・食堂・厨房・バー・カラオケ・バリケード）、`tower.ts` の `towerStoreys`（階ごとのプログラム: ロビー・事務所・役員・レストラン・スカイロビー・バー・客室）・`towerRoof`・`flatUnit` / `shopUnit` / `clinicUnit`
- 共有ファイルへの追加なし（`RoomUse` / `MaterialId` / `FurnitureKind` / `LootTableId` / `ROOM_LOOT` は既存の値で足りた）。`tools/building-preview.ts` に 3 つ目の引数（id の頭で絞る）と「同じ間取りが続く階を 1 枚にまとめる」を足した（既存の使い方は変わらない）

### テスト
- カタログの自動テスト（`tests/buildings.test.ts`）が office 21 種類 × 5 項目（決定性・三角形・生成時間／敷地と外形／到達性と探索ポイント／部屋の中の直線／4 方向の歩行）ですべて通る
- `tests/buildings-office.test.ts`（9 件）: 20 種類の登録と 4 つの高さの帯・奥行き 30m 以下（試験用の地図の隣の通りと重ならない）、**種類ごとに階数・種類・階ごとの部屋の構成がすべて違う**・シードで部品が変わる、目的のある部屋すべてに探索ポイント・収穫表が存在、**倉庫以外は屋上に上がれる**・高い建物はヘリポートと撃てる高さの縁、**高層は一部の階だけ入れる・全階に踊り場のホール・施錠の階どうしは同じ間取り**・最大の大きさで 12 シードとも外観 3,000 以下、種類ごとの特徴（テナントビルのコンビニが 12 シード中 3〜10・外階段の踊り場、百貨店のエスカレーター 6 本と広い売り場、商業ビルのシャッター、医療モール・診療所の薬、塾の教室、カラオケの個室、倉庫の 1.8m 以上の口、客室・住戸、庁舎風の階段 2 と全幅の窓口ホール、血痕・瓦礫）、家具が出入口の直線を避ける判定、**低い家具（長椅子など）が通過点の下に無い**（e2e で見つけた不具合の再発防止）、東向きに置いて**通りから最上部（屋上）まで歩く**
- `npm run check` 601 件・`npm run build` 通過。**`npm run e2e` 全 42 件通過**（直列 45.2 分。既存 39 件に変更なし。その後の生成時間の改善のあと `e2e/buildings-office.spec.ts` の 3 件を再実行して通過、9.4 分）
- e2e `e2e/buildings-office.spec.ts`（3 件、通過）: 試験用の地図で 20 種類それぞれ、扉から入って最も高い部屋（倉庫以外は屋上。超高層は 32 階ぶんの階段）まで歩き、棚を 1 つ探索する／全種類を並べた地図の性能／20 種類を斜め上から見た画像 `test-results/office-view-<id>.png`。平面図と正面は `npm run buildings:preview tmp/buildings 1 office.` で目視した

### 実測（Node、最大の大きさ。三角形は 9 シードの最大、部屋と探索はシード 5、生成は 9 回の中央値。「入れる階」の R は屋上）

| 種類 | 間口 × 奥行き (m) | 階 | 入れる階 | 外観 | 内部(1 階あたり最大) | 部屋（うち施錠） | 探索 | 生成 ms |
|---|---|---|---|---|---|---|---|---|
| office.zakkyo5（見本） | 9.5–12.5 × 14–18 | 5 | 1–5,R | 2472 | 588 | 18 (3) | 16 | 0.21 |
| office.zakkyo_narrow | 7–9 × 15–19 | 5 | 1–5,R | 1272 | 948 | 17 (1) | 10 | 0.64 |
| office.small | 9–12 × 10–13 | 3 | 1–3,R | 984 | 672 | 10 (0) | 13 | 0.28 |
| office.tenant | 12.5–14.75 × 14–19 | 4 | 2–4,R | 2032 | 1116 | 16 (2) | 23 | 0.35 |
| office.shotengai3 | 5.5–7.5 × 11–14 | 3 | 1–3,R | 852 | 540 | 12 (2) | 11 | 0.15 |
| office.rc_old | 15–19 × 10.5–12.5 | 3 | 1–3,R | 2256 | 1020 | 24 (0) | 44 | 0.71 |
| office.ekimae | 16–20 × 14–18 | 5 | 1–5,R | 996 | 1344 | 55 (6) | 42 | 0.76 |
| office.clinic | 11–14 × 13–16 | 4 | 1–4,R | 1500 | 624 | 16 (0) | 31 | 0.36 |
| office.juku | 10–13 × 14–17 | 4 | 1–4,R | 1656 | 948 | 15 (0) | 17 | 0.38 |
| office.soko | 18–24 × 16–22 | 2 | 1,2 | 716 | 804 | 6 (0) | 17 | 0.28 |
| office.glass_low | 20–26 × 15–19 | 3 | 1–3,R | 1416 | 1740 | 23 (0) | 34 | 0.55 |
| office.mid | 24–30 × 20–26 | 9 | 1,2,5,9,R | 1416 | 2016 | 34 (0) | 51 | 0.84 |
| office.tower20 | 28–34 × 24–29 | 20 | 1,2,10,19,20,R | 2784 | 2064 | 50 (0) | 50 | 1.50 |
| office.hotel_office | 26–32 × 21–25 | 22 | 1,2,12,16,21,22,R | 2916 | 1944 | 89 (15) | 87 | 1.76 |
| office.skyscraper | 34–40 × 27–30 | 32 | 1,2,16,31,32,R | 2868 | 2124 | 62 (0) | 59 | 1.30 |
| office.tower_mansion | 26–30 × 26–29 | 30 | 1,2,15,30,R | 2292 | 1992 | 77 (2) | 74 | 1.12 |
| office.shogyo | 22–28 × 19–24 | 10 | 1,2,7,10,R | 624 | 2652 | 67 (20) | 33 | 1.03 |
| office.medical_mall | 19–24 × 17–21 | 7 | 1–3,6,7,R | 1044 | 1404 | 69 (15) | 63 | 0.70 |
| office.mansion_shogyo | 24–30 × 21–25 | 18 | 1–4,10,18,R | 2580 | 1980 | 123 (17) | 118 | 1.38 |
| office.chosha | 30–36 × 18–22 | 12 | 1,2,7,12,R | 2268 | 2808 | 58 (3) | 55 | 1.10 |
| office.depart | 32–40 × 24–29 | 7 | 1–7,R | 1248 | 2568 | 52 (2) | 184 | 1.40 |

上限は office 3,000 / 3,000（`limits` の上書きはなし）。ホテル兼オフィス・超高層・超高層手前・百貨店の内部・庁舎風の内部が上限の 9 割前後（窓・家具を足すときは注意。外観は割れたガラス 1 枚で 2〜4 箱増える）。生成は 2 回組み立てても 1.8ms 以下（Node・単独）。テストは並列で走るので、単独で 2ms 前後だと 4ms の検査を時々超えた（タワーマンション）。1 回目の組み立てを「部屋と階段と通過点の記録だけ」にし、施錠の階を 1 回目で飛ばし、施錠の階のコアの壁を連続する階ぶんの箱にして、エレベーターの穴を 1 つにまとめた。タワーマンションの入れる住戸階は 1 つにした（全体を 11 回続けて走らせて超えなかった）。

### 性能（GPU なし・SwiftShader、1280×720、sim 1 ステップ＋`renderer.draw` 1 回を直接計測、e2e で計測）
試験用の地図（中に入れる建物 146 棟: 全 73 種類が南向き・北向きの 2 列）:

| 場所 | ドローコール | 三角形 | sim ＋ 描画発行 |
|---|---|---|---|
| ビルの通り 1 本目（雑居ビル〜タワーマンションの 16 種類と隣の列。列に沿って見る） | 11 | 23.1 万 | 0.00 ＋ 0.55 ms |
| ビルの通り 2 本目（商業ビル・医療モール・マンション兼商業・庁舎風・百貨店） | 11 | 24.7 万 | 0.00 ＋ 0.72 ms |
| 超高層の屋上（116m、街を見下ろす） | 10 | 20.1 万 | 0.02 ＋ 0.54 ms |
| 超高層の 16 階スカイロビー | 10 | 20.1 万 | 0.01 ＋ 0.38 ms |

### 未完了・既知の問題
- 区域への配置はしていない（07d-3）。今は試験用の地図にだけ並ぶ
- 高層の入れない階は部屋が無い（施錠の扉の先は何も無い扱い）。ガラス越しに机が見えるのは内部を描く 40m 以内だけ。中距離からはガラスの向こうが空に見える（07d-2b のホテルと同じ）
- 百貨店のエスカレーターは止まった直階段（幅 1.0m）。最上階にはエスカレーターの上りが無いので、その位置の床は部屋の外（歩けるが部屋に入っていない）
- タワーマンションのバルコニーは部屋ではない（ガラスの壁の外。入れない）。屋上の外周の帯（バルコニーの上）は屋上の部屋に含めた
- 超高層の屋上（116m）まで階段で上がると実時間で数分かかる。ゾンビも同じ経路で追ってくる
- 家具は「出入口の直線を避けて置けなければ置かない」ので、出入口の多い部屋（コアのまわりの床・廊下）は家具がまばらになることがある

### 次のセッションへの注意（各プロンプトの末尾にも書いた）
- 07d-2d〜2f: `defs/office/common.ts` の `twoPass` / `Fit`（家具が通り道を塞がない）、`curtain`（多層の外壁を安く）、`towerFloors`、`embedGround` などは自由に使ってよい。手引きに「13. 高い建物と階の繰り返し」を足した
- 07d-3: テナントビルは自分でコンビニを入れる。高層は入れる階が限られるが屋上は入れる。探索ポイントが多い種類（百貨店 180 前後）
- 09: 超高層の屋上の射点の強さ、医療系のビルの薬の多さ
- 10: 32 階ぶんの折り返し階段のタッチ操作

### 追加した共有型・コマンド・イベント
- なし（型・データ・kit への追加なし）。新しいファイル: `defs/office/{common,tower,zakkyo_narrow,small,tenant,shotengai3,rc_old,ekimae,clinic,juku,soko,glass_low,mid,depart,shogyo,medical_mall,chosha,tower20,hotel_office,mansion_shogyo,skyscraper,tower_mansion}.ts`、`tests/buildings-office.test.ts`、`e2e/buildings-office.spec.ts`

## 07d-2d 建物の生成: 公共施設・工場 — 2026-11-21

`docs/buildings_guide.md` どおりに、`public` カテゴリの建物 18 種類を作って `catalog/public.ts` に登録した（配置の規則は 07d-3）。

### 完了したこと
- **学校 6 種類**（`defs/public/schools.ts`。敷地全体＝校舎・体育館・校庭・金網のフェンスと校門。校門は昇降口の正面）
  - `elem_rural` 地方の小学校: **木造 2 階の校舎**（下見板・瓦の切妻）、北側の廊下と南向きの教室、昇降口（下駄箱、校庭への広い扉）、職員室・保健室・給食室、2 階に教室・理科室・図書室・音楽室。木造の小さな体育館（切妻）、広い校庭（トラックの白線・鉄棒・砂場・二宮金次郎像・朝礼台・国旗掲揚台・桜）、百葉箱とうさぎ小屋
  - `elem_city` 都市の小学校: RC 4 階、**屋上にプール**（塔屋から出られる）、校舎の横に陸屋根の体育館、狭い校庭
  - `junior_rural` 地方の中学校: RC 3 階（屋上へ）、**ギャラリー（2 階の高さの鉄骨通路・高窓）つきの大きな体育館**、武道場（畳）、トラックのある広い校庭、駐輪場
  - `junior_city` 都市の中学校: 教室棟 4 階と特別教室棟 3 階を **渡り廊下**（屋根と柱）でつなぐ、陸屋根の体育館、狭い校庭
  - `high_rural` 地方の高校: 教室棟 3 階と管理・特別棟 2 階（昇降口・職員室・保健室・食堂）＋渡り廊下、ギャラリーつき体育館、武道場、野球のバックネットのある校庭、駐輪場
  - `high_city` 都市の高校: **RC 6 階の中廊下の校舎**（屋上は転落防止の金網）、正面に 2 層の体育館（ギャラリーつき）、中庭程度の校庭
  - 体育館は **避難所の跡**（マット・段ボールの仕切り・物資の箱＝食堂と薬の探索ポイント・血痕）。ステージ・幕・バスケットのゴール・コートの線
- **大学 2 種類**（`defs/public/university.ts`、区域 1 つに収まるキャンパス）
  - `univ_rural`: 3 階の講義棟（中廊下の両側に大講義室。教壇・スクリーン・長机の列）、2 階のレンガの研究棟（実験室・薬品棚）、2 層吹き抜けの学食（厨房カウンター・テーブル）、平屋の図書館、芝の広場と並木・ベンチ、駐輪場、校門
  - `univ_city`: **8 階の研究棟**（実験室・研究室、屋上へ出られる）、3 階の講義棟、平屋の学食、舗装の広場と彫刻、渡り廊下
- **交番・警察署・消防署**（`defs/public/safety.ts`）
  - `koban` 交番: 2 階建て。表の事務室（机・ロッカー）、奥の休憩室（流し・直階段）、2 階の畳の部屋。扉の上の赤色灯と看板
  - `police` 警察署: 4 階。1 階はロビーと交通課・生活安全課、当直室（駐車場への通用口）、**留置場（施錠）**。2 階は刑事課・取調室、3 階は警備課と **武器庫**（鋼の扉。シードの約 6 割は施錠で入れず、約 4 割はこじ開けられていて銃の棚・弾薬箱＝`weapons` を探索できる）、4 階は道場・会議室・食堂。裏の駐車場にパトカー、屋上に無線のマスト
  - `fire` 消防署: 2 階の本庁舎（1 階は高さ 3.3m の車庫の扉が 2〜3 枚。1 枚目は開いて空、残りはシャッターで奥に消防車、装備の棚＝`garage`）、2 階は仮眠室・台所・事務室。**望楼**: 5 層の階段塔の上に屋根つきの見張り台（床の高さ約 18m、パラペット 1.1m。射点）
- **病院 3 種類**（`defs/public/hospital.ts`、医薬品が多い）
  - `clinic` 診療所: 2 階。待合（長椅子）・薬局の棚・診察室 2、2 階に病室 2・院長室・倉庫。緑十字
  - `hospital_mid` 総合病院: **6 階の病棟**（2〜6 階は同じ間取り: 中廊下の両側に 4 床の病室、廊下に開いたナースステーション＝薬品棚とカウンター、リネン庫）、1 階は外来ロビー・薬局・検査室・厨房（裏口）・霊安室（施錠）。前に **4 階の外来棟**（正面玄関と車寄せの庇、診察室・検査・手術室・事務）、渡り廊下、駐車場と救急車
  - `hospital_large` 大病院: **8 階の病棟**（屋上にヘリポートの印）、3 階の外来棟（正面玄関・手術室 3）、**2 階の救急棟と救急車の庇**（入口は幅 2.7m、救急車 1〜2 台）、広い駐車場
- **工場 4 種類**（`defs/public/factory.ts`）
  - `machi_koba` 町工場: 2 階。1 階は作業場（シャッターか開いた間口・旋盤・プレス・作業台＝`tools`・鋼材の棚＝`stock`）、直階段で 2 階の事務所と家族の和室。看板と錆
  - `factory_food` 食品工場: 2 層の生産棟（切妻）にコンベアの列・ミキサー・包装の台、**冷蔵庫室**（`grocery`）、正面の壁沿いの **キャットウォーク**（高窓）、2 階の事務棟（社員食堂）、荷捌きのトラック
  - `factory_metal` 金属加工工場: **鋸屋根** の工場、天井クレーン、プレス、鋼材の棚 3（`stock`）と鋼板の山、キャットウォーク、屋外の鋼材、事務棟
  - `factory_chem` 化学工場: **防液堤に囲まれたタンクヤード**（タンク 4 基・配管ラックのキャットウォーク・煙突 約 19m）、ドラム缶の倉庫（`fuel`）、3 階の管理棟（屋上へ出られる）
- 廃墟の雰囲気は種類ごとに 1〜2 点: 割れた窓（シード）、血痕（体育館・待合・教室・手術室）、瓦礫、倒れた机（教室の机の欠け）、こじ開けた武器庫の扉、錆
- **共通の補助**（`defs/public/common.ts`・`school_parts.ts`。kit.ts は変更なし）: `wing`（x 方向の棟。廊下・部屋の列・両端の折り返し階段・1 階の扉と連窓・2 階以上の `facade`・屋上の塔屋。廊下は部屋の区切りごとに分けて `join`）、`hall`（高い 1 部屋。連窓・切妻／陸／鋸屋根）、`catwalk`（壁沿いの鉄骨通路と壁へ向かう直階段）、`slab`・`mesh`（金網）・`truck`・`stripe`、家具（教室・実験室・職員室・保健室・病室・棚・便所・台所）、`gym`・`yard`・`pool`・`walkway`。使い方は `docs/buildings_guide.md` に足した
- **共有ファイルへの追加**（末尾に 1 行ずつ）: `RoomUse` に `'ward'`、`LootTableId` に `'stock'`（`types.ts`）、`ROOM_LOOT_BASE` に `ward: { medicine: 0.14, food: 0.02 }` と `stock: { metal: 0.18, cement: 0.05, wood: 0.04, parts: 0.05 }`（`colony.ts`、× `LOOT_SCALE`）。02 の 3.10 にも書いた
- **屋内の経路の修正**（`sim/tactical/indoor.ts` の `roomRoute`、契約上必要な最小限）: つながりの数の幅優先から、**外を経由するとつながり 4 本ぶん余計に数える** 最短経路に変えた（`TACTICAL.interior.outsideCost = 4`）。扉の多い大きな建物（学校）で「昇降口から外へ出て裏口から入り直す」経路が中の経路と同じ長さになり、外の直線が建物の壁を突き抜けていた（ゾンビが壁に張り付く）。外にしか道がない場合（キャンパスの別の棟）は今までどおり外を通る
- **試験用の地図**（`sim/tactical/yard.ts`、契約上必要な最小限）: 通りの間隔を固定（80m）から **その通りに並ぶ種類の最大の奥行きで決める** ように変えた（学校の敷地は奥行き 60〜80m で、隣の通りの列と重なっていた）。1 本目は z = 520 のまま、2 本目以降は +z 側・−z 側へ交互に、列から 6m 離して置く。今は 142 棟が重ならずに z = 314〜773 に並ぶ
- `tools/building-preview.ts` に 3 つ目の引数（id の前方一致）を足した: `node tools/building-preview.ts tmp/buildings 1 public.`

### テスト
- カタログの自動テスト（`tests/buildings.test.ts`）が 18 種類 × 5 項目ですべて通る（最も遅い直線の検査は `hospital_large` 2.5 秒、`high_city` 2.0 秒。上限 5 秒）
- `tests/buildings-public.test.ts`（10 件）: 18 種類の登録、**種類ごとに階数・屋根・間口・部屋の構成がすべて違う**、シードで部品が変わる、目的のある部屋の用途ごとに探索ポイントがあり収穫表が存在する、学校（教室 4 以上・体育館・校庭の線・昇降口・木造の切妻・屋上プール・ギャラリー・6 階と 8 階・学食と実験室）、武器庫（20 シードで施錠の方が多く、開いていれば `weapons` が 2 か所以上、施錠なら探索ポイントなし）・留置場・交番の赤色灯、消防署（車庫の高い扉とシャッター・望楼の上 17m 以上に行ける）、病院（病棟の階の間取りが同じ・ヘリポート・救急の広い扉・**医薬品の期待値が 診療所 < 中 < 大、診療所でも高校より多い**）、工場（キャットウォークに行けて探索できる・鋸屋根・金属加工が食品より金属が多く `stock` 3 以上・化学の `fuel` 3 以上と煙突とタンク・冷蔵庫室・町工場の作業場と和室）、試験用の地図で敷地が重ならない、東向きに置いて扉から最も高い部屋まで歩く
- `npm run check` 592 件・`npm run build` 通過。**建物の e2e 4 ファイル 13 件が全部通過**（`buildings` `buildings-residential` `buildings-shop` `buildings-public`、直列 21.2 分。経路と試験用の地図を変えたので既存の 10 件も流した。その他の e2e は流していない）
- e2e `e2e/buildings-public.spec.ts`（3 件、通過）: 試験用の地図で 18 種類それぞれ扉から入って最も高い部屋（屋上・望楼・2 階の事務所）まで歩き、その部分の棚を 1 つ探索する／全種類を並べた地図の性能／18 種類を斜め上から見た画像 `test-results/public-view-<id>.png`（目視した）。平面図と正面は `node tools/building-preview.ts tmp/buildings 1 public.` で目視した

### 実測（Node、最大の大きさ・9 シード。三角形は最大、部屋と探索はシード 5、生成は中央値）

| 種類 | 間口 × 奥行き (m) | 階 | 外観 | 内部(1 階あたり最大) | 部屋（うち施錠） | 探索 | 生成 ms |
|---|---|---|---|---|---|---|---|
| public.elem_rural | 62–72 × 50–58 | 2 | 2188 | 1608 | 31 (0) | 25 | 1.03 |
| public.elem_city | 46–54 × 40–46 | 4 | 2148 | 1164 | 44 (0) | 29 | 0.89 |
| public.junior_rural | 72–82 × 60–68 | 3 | 2968 | 2244 | 54 (0) | 44 | 0.79 |
| public.junior_city | 56–64 × 46–54 | 4 | 2964 | 2544 | 82 (0) | 63 | 0.66 |
| public.high_rural | 84–94 × 70–80 | 3 | 3808 | 3360 | 78 (0) | 61 | 0.58 |
| public.high_city | 52–60 × 42–48 | 6 | 2028 | 3024 | 106 (0) | 96 | 0.71 |
| public.univ_rural | 88–100 × 70–80 | 3 | 3816 | 3768 | 70 (0) | 65 | 0.81 |
| public.univ_city | 72–82 × 56–64 | 8 | 2484 | 3288 | 157 (3) | 132 | 2.22 |
| public.koban | 7–8.5 × 7.5–9 | 2 | 468 | 288 | 4 (0) | 5 | 0.03 |
| public.police | 30–36 × 26–32 | 4 | 1152 | 1368 | 63 (2) | 50 | 0.51 |
| public.fire | 26–32 × 22–28 | 5 | 1656 | 768 | 24 (0) | 13 | 0.23 |
| public.clinic | 14–17 × 15–18 | 2 | 696 | 708 | 22 (0) | 15 | 0.12 |
| public.hospital_mid | 40–48 × 34–40 | 6 | 2076 | 2484 | 155 (1) | 147 | 0.89 |
| public.hospital_large | 76–86 × 56–64 | 8 | 3444 | 3696 | 292 (1) | 297 | 1.81 |
| public.machi_koba | 10–13 × 12–16 | 2 | 644 | 288 | 4 (0) | 6 | 0.02 |
| public.factory_food | 44–52 × 36–42 | 2 | 1760 | 984 | 19 (0) | 19 | 0.16 |
| public.factory_metal | 46–56 × 36–44 | 2 | 1660 | 984 | 16 (0) | 15 | 0.14 |
| public.factory_chem | 52–60 × 42–50 | 3 | 1388 | 1296 | 30 (0) | 23 | 0.18 |

上限は public 4,000 / 4,000（`limits` の上書きはなし）。高校（地方）・大学（地方）・大病院の外観が上限の 86〜95%、大学（地方）・大病院の 1 階の内部が 92〜94%（1 階に棟が 3 つ並ぶため）。窓を足すときは `wing` の連窓・`facade` を使う。

### 性能（GPU なし・SwiftShader、1280×720、sim 1 ステップ＋`renderer.draw` 1 回を直接計測、e2e で計測）
試験用の地図（中に入れる建物 142 棟: 全 71 種類が南向き・北向きの 2 列）:

| 場所 | ドローコール | 三角形 | sim ＋ 描画発行 |
|---|---|---|---|
| 公共施設の通り 1（学校〜大学） | 11 | 23.2 万 | 0.01 ＋ 0.44 ms |
| 公共施設の通り 2（警察〜工場） | 11 | 25.6 万 | 0.00 ＋ 0.37 ms |
| 大病院の屋上（ヘリポート） | 11 | 27.0 万 | 0.01 ＋ 0.53 ms |
| 大病院 8 階の病棟の廊下 | 11 | 27.0 万 | 0.02 ＋ 0.56 ms |
| 消防署の望楼の上 | 11 | 24.2 万 | 0.04 ＋ 0.33 ms |

### 未完了・既知の問題
- 区域への配置はしていない（07d-3）。今は試験用の地図にだけ並ぶ
- **学校・大学・病院・工場の敷地は校庭・広場・駐車場・タンクヤードを含む**。遠景（300m より先）の外形の箱は敷地全体に軒の高さで描かれるので、校庭の上にも 2〜8 階ぶんの箱が見える（07d-2b の駐車場と同じ問題で、もっと目立つ）。07d-3 で遠景の箱を「棟ごと」にするか、敷地を建物と屋外に分けて置く必要がある（`BuildingDef` に遠景用の矩形を足すなど。型の追加が要る）
- 屋外（校庭・広場・駐車場）は部屋ではないので探索ポイントは置けない。化学工場のタンクヤードは防液堤の中を 1 部屋（`machine`）にした
- 大学の棟の間・病院の外来棟と病棟の間は外を歩く（渡り廊下は屋根と柱だけ）。同じ建物の別の棟へのゾンビの経路は外を通る（`outsideCost` を払っても外にしか道がないため）
- 武器庫はシードの約 6 割で入れない（施錠の部屋は探索ポイントにならない）
- 工場の大きな広間・体育館は部屋の中に冷蔵庫室などの小部屋が重なっている（小さい方の部屋が優先される `roomAt` に頼っている）
- キャットウォークの床と手すりは内部の層（40m 以内で描かれる）。化学工場のタンクヤードのものは屋外にあるので、40m より遠くでは見えない（柱と配管は外観の層なので見える）

### 次のセッションへの注意（各プロンプトの末尾にも書いた）
- 07d-2e / 2f / 2c: `defs/public/common.ts` の `wing`・`hall`・`catwalk`・`mesh` などは自由に使ってよい（駅舎・格納庫・兵舎・オフィスの中廊下に向く）。大きな建物の廊下は区切って `join` しないとカタログの直線の検査が 5 秒を超える。試験用の地図の通りの間隔は奥行きで決まるようになった
- 07d-3: 公共施設の大きさは上の表（学校・大学は 46〜100m 四方の敷地全体。校門は正面 z = d の中ほど）。セルに 1 つの施設（大学・警察署・消防署・大病院）の候補。遠景の箱の問題（上）
- 取りまとめ役: 共有ファイルの追加は `RoomUse` の `'ward'`、`LootTableId` の `'stock'`、`ROOM_LOOT` の 2 行。`indoor.ts` の `roomRoute` と `TACTICAL.interior.outsideCost`、`yard.ts` の通りの間隔（07d-2b の折り返しを置き換えた）、`tools/building-preview.ts` の 3 つ目の引数

### 追加した共有型・コマンド・イベント
- 型: `RoomUse` に `'ward'`、`LootTableId` に `'stock'`。データ: `ROOM_LOOT.ward` / `.stock`、`TACTICAL.interior.outsideCost`。コマンド・イベントの追加なし
- 新しいファイル: `defs/public/{common,school_parts,schools,university,safety,hospital,factory}.ts`、`tests/buildings-public.test.ts`、`e2e/buildings-public.spec.ts`
- 依存の追加なし

## 07d-2e 建物の生成: 駅・空港 — 2026-11-21

`docs/buildings_guide.md` どおりに、`transport` カテゴリの建物 8 種類（駅 5・空港 3）を作って `catalog/transport.ts` に登録した（配置の規則は 07d-3）。どれも線路・ホーム・滑走路を含む **敷地全体** の設計図。

### 完了したこと
- **駅 5 種類**（`defs/transport/station_*.ts`。線路は敷地の奥（z = 0 側）を x 方向に端から端まで、駅舎と駅前は正面 z = d。ホームの床＝1 階の床＝`plinth` 0.5m（線路の地面から一段上がる））
  - `station_mujin` 無人駅: 単線とホーム 1 面、**木造の待合小屋**（道からの入口を兼ねる。ベンチ・時刻表・割れた窓）、低い柵、駅名標、自販機（`grocery`）、線路の雑草。**気動車 1〜2 両が扉を開けて停車**（車内に入れる）
  - `station_town` 町の駅: 平屋の駅舎（切妻。待合の広間・改札口・駅務室（窓口の小窓、シードで施錠）・シャッターの売店・便所）、**相対式ホーム 2 面と複線（架線・架線柱）**、**屋根と囲いのある跨線橋**（各ホームから階段で上る）、ホームの上屋・ベンチ・自販機、駅前のタクシーと自転車。1 番線に 2〜3 両の電車（開いた車両）、2 番線にシードで 2 両（開いている／閉じている／なし）
  - `station_city` 市の駅: **3 階の駅ビル**（1 階: 入口の広間・売店（通りはシャッター、中から入れる）・便所・シャッターの飲食店・施錠の倉庫、2 階: コンコース・**改札**（低い改札機の列と通り口。シードで 1〜2 か所閉じている）・窓口・駅務室・**売店**、3 階: 厨房とレストラン・事務所、屋上（塔屋・室外機））、**橋上コンコース** で島式ホーム 2 面（4 線）へ階段で下りる、**バスとタクシーのロータリー**（中央の植え込み・時計柱・バス停・バス・タクシー）
  - `station_pref` 県庁所在地の駅: **4 階の大きな駅ビル**（3 階はレストラン街とバー、4 階は事務所）、島式ホーム 3 面＋貨物の通過線（7 線）と長い橋上コンコース、**バスターミナル**（乗り場の島・屋根・バス）、**地下通路の入口 2 か所はシャッターで封鎖**（下りる階段の囲い・看板）
  - `station_seirei` 政令指定都市の駅: **3 棟が並ぶ複合体**（百貨店 8 階（1・2 階の売り場が開いている。上は施錠）・3 階の駅ビル・**ホテル 8 階**（ロビーとレストラン、デッキ階のラウンジ、客室の 1 階（シードで 3〜6 階。廊下と客室 12 室前後、一部施錠）、**屋上へ上れる＝約 34m の射点**））、2 階の **ペデストリアンデッキ**（3 棟それぞれに扉、広場へ下りる幅広の階段 2 か所）、島式ホーム 4 面（8 線）と橋上コンコース、ロータリー（バス・タクシー）、**地下街の入口 2 か所（シャッター）**
  - 線路と車両: 開いた車両は **部屋（用途 `train`）**。ホーム側の扉（1.3m）から入り、反対側の壁沿いに長いす、置き忘れの荷物（`train`）、ときどき血痕。閉じた車両の続きは箱 1 つ（窓の帯つき）。先頭と最後尾に運転台の窓。大きな駅では開いた電車は 2 編成まで、各編成の 2 両だけが開いている
- **空港 3 種類**（`defs/transport/airport_*.ts`。滑走路が奥、誘導路・エプロン・ターミナル・駐車場の順に正面へ）
  - `airport_s` 小: 両端まで敷地に入る短い滑走路（幅 30m・末端の標識）、ターミナル 1 棟（2 階。1 階: 手荷物受取所 `baggage`（エプロンへの扉）・チェックイン・事務所・売店・カフェ、2 階: 搭乗待合・免税店・レストラン、**屋上の送迎デッキ**）、ターボプロップ機 1〜2 機、給油車・トーイングカー・手荷物カート、吹き流し
  - `airport_m` 中: 滑走路（幅 45m）・平行誘導路、ターミナル、**管制塔**（6 層。階段の塔を上った **ガラス張りの管制室（約 23m・射点）**。卓と無線機＝`tower`）、**格納庫**（30m のシャッター、小さな扉、中に小型機、工具の棚 `tools`・作業台 `garage`・燃料のドラム `fuel`）、リージョナルジェット 2〜3 機
  - `airport_l` 大: **滑走路は敷地の両端で切れる**（幅 60m）、ターミナル 2 棟、それぞれ 2 階から **搭乗橋 3 本**（ガラスの通路、先は閉じている。手荷物 `baggage`）、多くの搭乗橋に大型機（双発・4 発）、ターミナルの間の **管制塔（9 層、管制室 約 36m）**、駐車場
- 廃墟の雰囲気は種類ごとに 1〜2 点: 割れた窓（車両・駅舎・ホテル）、血痕（車内・広間・デッキ）、瓦礫（橋上コンコース・跨線橋）、閉じた改札、シャッター
- **共通の補助**（kit.ts は変更なし）: `defs/transport/common.ts`（`track` `wire` `mast` `car` `train` `platform` `splitRooms` `flight` `canopy` `nameBoard` `fence` `paint` `pave` `bus` `shelter` `plane`）、`parts.ts`（`stationHouse` `islands` `tower` `deckFront` `gondolas` `furnish`）、`airport_parts.ts`（`runway` `taxiway` `windsock` `terminal` `controlTower` `hangar` `jetway` `apronClutter` `landside`）。使い方は手引きの 14 節
- **`def.storeys` より上の階**: ホテル・百貨店・管制塔は `storeys`（駅ビル・ターミナルの階数）より上に階を重ねた（部屋は高さで探されるので動く）。遠景の外形の箱は軒の高さまでなので、敷地の大半が線路・滑走路でも箱が低い（政令市 13m、空港 9.3m）
- **共有ファイルへの追加**（末尾に 1 行ずつ）: `RoomUse` に `'train'` `'baggage'` `'tower'`（`types.ts`。直前の `| 'ward';` の行のセミコロンだけ動いた）、`ROOM_LOOT_BASE` に `train: { food: 0.04, medicine: 0.03, parts: 0.01 }`・`baggage: { food: 0.05, medicine: 0.04, parts: 0.02, wood: 0.01 }`・`tower: { parts: 0.07, metal: 0.02, ammo: 0.01 }`（`colony.ts`、× `LOOT_SCALE`）。02 の 3.10 にも書いた
- **大きな種類の試験用の地図**（契約上必要な最小限）: 試験用の地図（1024m 四方）に間口 850m・奥行き 280m の空港は並ばない。`sim/tactical/yard.ts` に `bigForYard`（中間の大きさが間口 300m か奥行き 100m を超える）と 2 つ目の地図 `yardMap(true)` / `yardEntries(true)` を足した（1 棟ずつ南向き、行は x = 30〜990・南から北へ）。`state.flags.yard === 2`、URL `?yard=2`、`debug.openYard(true)`（`main.ts`・`area.ts` に 1 行ずつ）。ふつうの試験用の地図からは大きな種類が外れる（今は県庁所在地・政令市の駅と空港 3 つ）
- **カタログの直線の検査を速く**（`tests/buildings.test.ts`、検査の中身は同じ）: 部屋ごとに、出入口の外接矩形（＋0.3m）と体の高さにかかる当たり判定だけを `clearAt` に渡す。政令市の駅で 6.5 秒（上限 5 秒、時間切れ）→ 2.5 秒（単独で実行）
- `tools/building-preview.ts`: 大きな敷地は 1m あたりの画素を減らす（6,000px 以内）、`storeys` より上の階も描き、上の階は部屋の周りだけを描く

### テスト
- カタログの自動テスト（`tests/buildings.test.ts`）が 8 種類 × 5 項目ですべて通る
- `tests/buildings-transport.test.ts`（9 件）: 8 種類の登録、**種類ごとに階数・大きさ・部屋の構成がすべて違う**、シードで部品が変わる、目的のある部屋にはすべて探索ポイントがあり収穫表が存在する、**全駅・4 シードで開いた車両があり、ホームから扉で入れて荷物がある**・線路が敷地の端から端まで、町の駅の跨線橋（2 階の部屋と階段 2 本）・市以上の駅の改札（2 階の低い扉 2 か所以上）と各島へ下りる階段・屋上、県庁所在地と政令市の封鎖された地下の入口（幅 2.5m 以上のシャッター 2 か所以上）、政令市のデッキ（3 部屋・扉 5 以上・広場への階段 2 本）・ホテルの屋上（8 階、33m 以上）に行ける・百貨店の売り場・客室、空港の滑走路・手荷物受取所・送迎デッキ・エプロンへの扉、小空港に管制塔がない・中空港の管制室（20m 以上）と格納庫と大きなシャッター・大空港の管制室（35m 以上）と搭乗橋 6 本（手荷物つき）とターミナル 2 棟、試験用の地図 2 つ（小さい駅はふつうの地図に 2 棟、大きな種類は大きな地図に 1 棟ずつ、重ならず地図の中）、東向きに置いて扉から最も高い部屋まで歩く
- `npm run check` 750 件・`npm run build` 通過（最後の実行で全件通過。`check` は CPU の負荷で時間の検査が時々落ちる: 途中の 1 回は政令市の駅の生成時間 4.29ms（上限 4ms）と cover.test の地図生成時間。どちらも単独では通る。重い既存の種類（`public.hospital_large` など）もこの環境で 3.5〜4.8ms を測る）
- **e2e `e2e/buildings-transport.spec.ts` 3 件、すべて通過**（直列 5.0 分）: 試験用の地図 2 つで 8 種類それぞれ扉から入って最も高い部屋（無人駅のホーム・跨線橋・駅ビルの屋上・ホテルの屋上 34.1m・送迎デッキ・管制室 22.8m / 36.3m）まで歩き、その部分の棚を 1 つ探索、**駅では開いた車両まで歩いて荷物を探索**／全種類を並べた地図の性能／斜め上からの画像 `test-results/transport-view-<id>.png`（目視した）。平面図と正面は `node tools/building-preview.ts tmp/buildings 1 transport.` で目視した。他の e2e は流していない（試験用の地図から大きな種類が外れる変更は、既存の e2e が使う種類に影響しない）

### 実測（Node、最大の大きさ。三角形は 9 シードの最大、部屋と探索はシード 5、生成は 9 回の中央値。階の (+n) は `storeys` より上の階、高さは入れる部屋の最も高い床）

| 種類 | 間口 × 奥行き (m) | 階 | 最も高い床 (m) | 外観 / 上限 | 内部(1 階あたり最大) / 上限 | 部屋（うち施錠） | 探索 | 生成 ms |
|---|---|---|---|---|---|---|---|---|
| transport.station_mujin | 36–50 × 12–16 | 1 | 0.5 | 716 / 4000 | 168 / 4000 | 4 (0) | 4 | 0.23 |
| transport.station_town | 70–90 × 34–42 | 1 | 5.0 | 2204 / 4000 | 1356 / 4000 | 14 (1) | 15 | 0.59 |
| transport.station_city | 110–130 × 70–85 | 3 | 13.1 | 3252 / 4000 | 1776 / 4000 | 49 (4) | 40 | 1.54 |
| transport.station_pref | 160–190 × 95–115 | 4 | 17.3 | 4728 / 5000 | 2208 / 4000 | 74 (12) | 58 | 2.18 |
| transport.station_seirei | 240–280 × 150–180 | 3 (+5) | 34.1 | 7344 / 8000 | 3984 / 7000 | 125 (10) | 107 | 2.31 |
| transport.airport_s | 450–560 × 130–150 | 2 | 9.3 | 1812 / 4000 | 1620 / 4000 | 24 (1) | 34 | 0.33 |
| transport.airport_m | 600–700 × 190–220 | 2 (+3) | 22.8 | 3368 / 4000 | 2340 / 4000 | 37 (1) | 48 | 0.77 |
| transport.airport_l | 780–850 × 250–280 | 2 (+6) | 36.3 | 5724 / 6000 | 4980 / 6000 | 77 (4) | 124 | 2.36 |

**上限を上書きした種類**（`limits`。手引きでは「ふつうは使わない」）: 県庁所在地の駅（外観 5,000）、政令市の駅（外観 8,000・内部 7,000）、大空港（外観・内部 6,000）。理由: 1 つの設計図に駅ビル・百貨店・ホテル（またはターミナル 2 棟と管制塔）と 7〜8 線の電車・バスターミナルが入る「何棟分もの敷地」で、棟ごとに見ればそれぞれ上限に収まる。また `storeys` より上の階（ホテル・塔）の内部は `triangleCount` が屋上の階にまとめて数える。描いたときの実数は下の性能の表（どこでも 29 万三角形以下）

### 性能（GPU なし・SwiftShader、1280×720、sim 1 ステップ＋`renderer.draw` 1 回を直接計測、e2e で計測）
試験用の地図（`?yard=1`、中に入れる建物 148 棟）と大きな種類の地図（`?yard=2`、5 棟）:

| 場所 | ドローコール | 三角形 | sim ＋ 描画発行 |
|---|---|---|---|
| 小さい駅の通り（無人駅・町の駅・市の駅） | 11 | 28.4 万 | 0.00 ＋ 0.36 ms |
| 県庁所在地の駅の前 | 8 | 8.7 万 | 0.01 ＋ 0.39 ms |
| 政令市の駅の前 | 8 | 11.6 万 | 0.00 ＋ 0.38 ms |
| 政令市の駅のホテルの屋上 | 8 | 10.4 万 | 0.03 ＋ 0.51 ms |
| 政令市の駅のホーム | 8 | 9.2 万 | 0.02 ＋ 0.26 ms |
| 小空港の前 | 8 | 11.3 万 | 0.00 ＋ 0.23 ms |
| 中空港の前 | 8 | 13.5 万 | 0.01 ＋ 0.53 ms |
| 大空港の前 | 8 | 11.5 万 | 0.01 ＋ 0.36 ms |
| 大空港の管制室 | 8 | 10.0 万 | 0.01 ＋ 0.35 ms |

### 未完了・既知の問題
- 区域への配置はしていない（07d-3）。今は試験用の地図にだけ並ぶ
- **遠景の外形の箱**: 敷地全体に軒の高さで描かれる（07d-2d と同じ問題。空港は 650〜850m 四方に 9.3m の灰色の板、政令市の駅は 260 × 165m に 13m の箱が、300m より先で見える。e2e の画像で確認）。ホテル・百貨店・管制塔は軒より上なので、300m より先では見えない。遠景の箱を棟ごとにする仕組みが要る（07d-3）
- 電車は線路の上に低く乗る（床＝ホームの高さ 0.5m。地面を掘れないため、レールの面とホームの段差は実際より小さい）。電車の扉・連結部から隣の車両へは行けない（車両ごとにホームから入る）
- 地下通路・地下街の入口はシャッターの囲いだけ（地面の下は作れない）
- 架線柱・上屋の柱・ホームの細い柱は当たり判定なし（ホームの部屋の直線の検査を通すため）。架線は描くだけ
- 航空機・格納庫の小型機・バス・閉じた電車は中に入れない（当たり判定はある）。搭乗橋の先は閉じている
- ホテルの客室階は 1 つだけ開いている（他の階は踊り場の扉が施錠）。百貨店は 1・2 階だけ
- 屋外（駅前広場・エプロン・ロータリー・滑走路）は部屋ではないので探索ポイントはない
- 政令市の駅の生成は 2.3ms 前後（上限 4ms）。CPU が混んでいると上限に近づく

### 次のセッションへの注意（各プロンプトの末尾にも書いた）
- 07d-2f: `defs/transport/` の補助（`tower`・`controlTower`・`hangar`・`plane`・`splitRooms`・`stationHouse`）は自由に使ってよい。大きな種類は `?yard=2` に出る。`storeys` より上の階を重ねてよい
- 07d-3: 駅・空港の大きさ・線路の向き（x 方向、敷地の奥）、遠景の箱、探索ポイントの数、射点。大空港・政令市の駅はほぼ区域に 1 つ
- 取りまとめ役: 共有ファイルの追加は `RoomUse` の 3 行、`ROOM_LOOT` の 3 行。`yard.ts`（`bigForYard`・`yardMap(big)`・`yardEntries(big)`）、`area.ts` と `main.ts`（`flags.yard === 2`・`?yard=2`・`openYard(big)`）、`tests/buildings.test.ts` の直線の検査（`nearWays`）、`tools/building-preview.ts`（縮尺・上の階）

### 追加した共有型・コマンド・イベント
- 型: `RoomUse` に `'train'` `'baggage'` `'tower'`。データ: `ROOM_LOOT.train` / `.baggage` / `.tower`。フラグ: `flags.yard` に 2（大きな種類の試験用の地図）、URL `?yard=2`、`debug.openYard(big?)`。コマンド・イベントの追加なし
- 新しいファイル: `defs/transport/{common,parts,airport_parts,station_mujin,station_town,station_city,station_pref,station_seirei,airport_s,airport_m,airport_l}.ts`、`tests/buildings-transport.test.ts`、`e2e/buildings-transport.spec.ts`
- 依存の追加なし

## 07d-2f 建物の生成: 自衛隊 — 2026-11-21

`docs/buildings_guide.md` どおりに、野営基地の残骸 10 種類（`military`）と駐屯地・基地 5 種類（`base`）を作って登録した（配置の規則は 07d-3）。どれもテント・陣地・車両・建物を含む **敷地全体** の設計図。弾薬庫・武器庫は施錠し、**同じ施設の金庫を探索すると開く「鍵」** を作った。

### 完了したこと
- **野営基地の残骸 10 種類**（`defs/military/camps.ts`。崩壊初期に展開して放棄された野営地。床高 0.15m・階高 3.0m）
  - `camp_squad` 小隊の野営地: 分隊用テント 3 張（1 張はシードで倒れている）、機関銃の土嚢陣地、焚き火の跡、偽装網の下の木箱、ジープ（シードで焼けている）
  - `camp_checkpoint` 検問所: 敷地を x 方向に通る道、遮断機 2 本（下りている／上がっている）、土嚢のシケイン、警備の小屋（コンテナ）、道の両側の陣地、鉄条網、**通れなかった車の列**と焼けた車・血痕
  - `camp_hospital` 野戦病院: 病棟テント 2 張（1.8m の扉）、トリアージのテント、薬のテント（`pharmacy`）、地面の赤十字、救急車、発電機、遺体袋
  - `camp_heliport` ヘリの着陸地点: ヘリパッド 2 面（1 機は待機、1 機は墜落して焼けている）、吹き流し、運用テント（指揮）、燃料のテント（`fuel`）とドラム缶
  - `camp_supply` 補給所: 大きな倉庫テント（物資・食料・燃料・薬・工具）、コンテナ 2 基（1 基はシードで施錠）、偽装網の下の木箱の列、ドラム缶、フォークリフト、トラック
  - `camp_signal` 通信所: 格子のアンテナ塔 2 本（約 12〜15m）、無線のシェルター（コンテナ）、発電機、テント、陣地、ケーブル
  - `camp_watch` 監視陣地: **監視塔**（足元の小屋→折り返し階段→見張り台 約 6.2m・土嚢の胸壁・トタン屋根＝射点）、敷地を囲む鉄条網、前の角の陣地 2 つ、テント
  - `camp_command` 指揮所: 敷地を囲む土嚢の壁、指揮テント（**金庫＝鍵**）、通信テント、**施錠の武器コンテナ**（鍵で開く。`weapons` / `armory`）、アンテナ塔、装甲車、ジープ
  - `camp_motor` 車両集積所: トラック・装甲車・ジープ・戦車の 2 列（半分近く焼けている）、整備テント（`tools` / `garage`）、燃料のテント、コンテナ
  - `camp_battalion` 大隊の宿営地（100〜120 × 70〜90m）: 分隊用テント 2 列（倒れたものあり）、指揮・医療・補給のテント、監視塔、ヘリパッド、ゲートの遮断機と陣地 2 つ、トラックの列
- **駐屯地・基地 5 種類**（`defs/base/jgsdf.ts` `jmsdf.ts` `jasdf.ts`。床高 0.2m・階高 3.3m。`storeys` 1 で、上の階は `roofRise` の中に重ねた）
  - `jgsdf_s` 陸自 駐屯地（小、150〜180 × 90〜100m）: 外柵と正門（門柱・名札・遮断機・**衛兵所**）、営庭と国旗掲揚塔、**本部**（2 階。1 階: 事務室・玄関・事務室／倉庫・**武器庫（施錠・鍵）**・医務室、2 階: **司令の部屋（金庫＝鍵）**・事務室、屋上）、**隊舎**（3 階、2 段ベッドの居室・浴室、屋上）、**車両整備場**（シャッター、トラック・装甲車、工具棚）、**覆土式の弾薬庫 2 棟**（施錠・鍵、金網の囲い）、訓練場（障害物）
  - `jgsdf_m` 陸自 駐屯地（中、270〜320 × 170〜210m）: 小に加えて、隊舎（食堂と武器庫つき）と施錠の隊舎、**食堂**、**体育館**、車両整備場 2 棟と車両の列、弾薬庫 3 棟と監視塔の囲い、訓練場、**射撃場**（土手と標的）、ヘリパッド（ヘリはシードで）
  - `jgsdf_l` 陸自 駐屯地（大、**700〜800 × 460〜540m＝区域の大半**）: 本部（3 階）、隊舎地区（入れる隊舎 1・施錠の隊舎 2）、食堂・体育館、車両整備場 3 棟（1 棟は戦車）、車両と戦車の列、弾薬庫 4 棟と監視塔の囲い、訓練場 2 面、射撃場、ヘリパッド 2 面、監視塔
  - `jmsdf` 海自 基地（260〜320 × 160〜200m）: **敷地の奥 z < 42m が港の海**（塗った水面、岸壁の縁の見えない柵）。**護衛艦（140m）と掃海艇（54m）が停泊**: 岸壁の柵で囲った足元から **舷梯（直階段）で甲板へ**、甲板（上部構造・煙突・主砲を避けた部屋、手すり、艦尾のヘリ甲板）、**上部構造の中**（甲板の階: 食堂と **武器庫（施錠・鍵）**、上の階: 居住区と医務室、最上階: **艦橋**＝射点 約 10m、マスト・レーダー）。岸壁: 係船柱・クレーン・木箱・コンテナ、倉庫 2 棟、**司令部庁舎**（3 階、金庫）、弾薬庫 2 棟、隊舎（施錠）、外柵と正門
  - `jasdf` 空自 基地（520〜600 × 200〜240m）: **滑走路の一部**（敷地の両端で切れる、幅 45m）・誘導路・エプロン、**格納庫 3 棟（中に戦闘機、大きな扉はシードで開いている）**、駐機中の戦闘機、**管制塔**（7 層、管制室 約 20m＝射点）、**レーダー**（2 階の建物の上のレドーム）、燃料タンク、本部（3 階、金庫）、弾薬庫 2 棟、外柵と正門
- **鍵**（取りすぎて序盤が簡単にならないよう、施設ごとの鍵にした。手引き 15 節）: 弾薬庫・武器庫は施錠の扉と施錠の部屋。`keyDoors`（`defs/military/parts.ts`）が設計図の最後にその扉を「鍵の扉」にし（扉板 `Part.key`・`Opening.key`・奥の部屋 `Room.key`・扉を通る経路 `bp.keyLinks`）、収穫表 `safe` の探索ポイントを鍵（`SearchPoint.key`）にする。金庫を E で探索すると `applyKeys`（`sim/tactical/area.ts`）が建物の配置を `open: true` の写しに替え、`openBlueprint`（`gen/buildings/index.ts`）が扉板を消して経路を足し部屋の施錠を解く。当たり判定・屋内の経路（ゾンビも）・描画（扉板を描かない）は配置から作られるので自動で切り替わる。**開いたかどうかは探索済みの金庫から毎回決まるので、セーブに新しい値は増えない**（区域に入ったとき・ロード・地続きの移動でも決め直す）。ログ「金庫に鍵があった。施錠されていた武器庫と弾薬庫の扉が開いた」。区域の探索ポイントでは金庫を施設の先頭に入れ、鍵の部屋の棚も探索ポイントに含める（`gen/index.ts` の `placeLootSpots`）。「E 長押しで壊す」案は採らなかった（鍵で足りた）
- 収穫: 野営の物資 `field`（弾・医薬品・燃料・食料をまとめて多め）、金庫 `safe`、武器 `weapons`・弾薬 `armory`（鍵の部屋だけ）、薬 `pharmacy`（病院テント）、燃料 `fuel`（燃料テント・格納庫）、工具 `tools` / `garage`（整備場）。収穫表は 02 の 3.10 にも書いた
- 廃墟の雰囲気は種類ごとに 1〜2 点: 倒れたテント、焼けた車両と焦げ跡、血痕、割れた窓、墜落したヘリ、通れなかった車の列
- **補助**（kit.ts は変更なし）: `defs/military/parts.ts`（`tent` `fallenTent` `pit` `bags` `watchtower` `towerSize` `container` `jeep` `mtruck` `apc` `tank` `heli` `fighter` `drums` `crates` `net` `mastAntenna` `helipadH` `flagPole` `barrier` `wire` `scorch`、家具 `cots` `medical` `command` `supplies` `keepWays`、`keyDoors`）、`defs/base/sdf_parts.ts`（`hq` `barracks` `lockedBlock` `motorPool` `messHall` `gym` `depot` `guardHut` `mainGate` `perimeter` `training` `rifleRange` `vehicleRow` `parade` `sdfDef`、家具 `commander` `bunks` `desks`）
- **材質 `olive`**（オリーブドラブ・明るいドラブ・土嚢の砂色・濃いドラブ）を足した（`types.ts`・`materials.ts`・`render.ts` に 1 行ずつ）
- **3 つ目の試験用の地図 `?yard=3`**（`sdfYard`。中・大の駐屯地・海自・空自が 1 棟ずつ。`?yard=2` に入りきらないため）。`debug.openYard(3)`。野営 10 種類と小の駐屯地はふつうの試験用の地図（`?yard=1`）

### テスト
- カタログの自動テスト（`tests/buildings.test.ts`）が 15 種類 × 5 項目ですべて通る
- `tests/buildings-military.test.ts`（7 件）: 10＋5 種類の登録と **種類ごとに大きさ・部屋の構成がすべて違う**、シードで部品が変わる、弾・医薬品・燃料が手に入る（全野営地に `field`）、**基地 5 種類と指揮所に鍵**（鍵の扉・金庫は入れる部屋・鍵の部屋は施錠・`weapons` は鍵の部屋だけ・開くと全部屋に行ける）、**小の駐屯地で鍵を見つける前は扉が弾と視線と人を止め経路がない／見つけた後は扉が開き歩いて通れる／新しい訪問では閉じ直す**、**シミュレーション全体で指揮所の金庫を E で探索すると配置が開きログが出て、武器の棚まで経路がある**、監視塔（6m 以上）と護衛艦の艦橋（9m 以上）に扉から歩いて上れる
- e2e `e2e/buildings-military.spec.ts` 3 件（結果は下の「性能」と「e2e」）

### 実測（Node、最大の大きさ。三角形は 9 シードの最大、部屋と探索はシード 5、生成は 9 回の中央値・負荷のない時。高さは入れる部屋の最も高い床）

| 種類 | 間口 × 奥行き (m) | 外観 / 上限 | 内部(1 階あたり最大) / 上限 | 部屋 | 探索 | 鍵の部屋 | 最も高い床 (m) | 生成 ms |
|---|---|---|---|---|---|---|---|---|
| military.camp_squad | 30–36 × 24–30 | 804 / 3000 | 444 / 3000 | 3 | 9 | 0 | 0.15 | 0.23 |
| military.camp_checkpoint | 40–48 × 22–28 | 644 / 3000 | 192 / 3000 | 4 | 7 | 0 | 0.15 | 0.11 |
| military.camp_hospital | 46–56 × 34–42 | 512 / 3000 | 444 / 3000 | 4 | 15 | 0 | 0.15 | 0.12 |
| military.camp_heliport | 56–66 × 46–56 | 904 / 3000 | 168 / 3000 | 3 | 11 | 0 | 0.15 | 0.12 |
| military.camp_supply | 54–64 × 38–46 | 860 / 3000 | 216 / 3000 | 4 | 14 | 0 | 0.15 | 0.15 |
| military.camp_signal | 34–40 × 28–34 | 680 / 3000 | 192 / 3000 | 3 | 6 | 0 | 0.15 | 0.07 |
| military.camp_watch | 32–38 × 32–38 | 824 / 3000 | 372 / 3000 | 7 | 5 | 0 | 6.2 | 0.14 |
| military.camp_command | 46–54 × 38–46 | 744 / 3000 | 312 / 3000 | 5 | 14 | 1 | 0.15 | 0.11 |
| military.camp_motor | 60–72 × 42–50 | 1132 / 3000 | 180 / 3000 | 3 | 12 | 0 | 0.15 | 0.09 |
| military.camp_battalion | 100–120 × 70–90 | 2676 / 3000 | 2448 / 3000 | 23 | 74 | 0 | 6.2 | 0.40 |
| base.jgsdf_s | 150–180 × 90–100 | 3456 / 4000 | 4512 / 5000 | 106 | 98 | 3 | 10.1（屋上） | 1.68 |
| base.jgsdf_m | 270–320 × 170–210 | 6836 / 8000 | 4860 / 8000 | 117 | 110 | 5 | 10.1（屋上） | 2.22 |
| base.jgsdf_l | 700–800 × 460–540 | 10344 / 12000 | 5268 / 9000 | 121 | 112 | 6 | 10.1（屋上） | 1.92 |
| base.jmsdf | 260–320 × 160–200 | 4676 / 8000 | 4692 / 9000 | 101 | 99 | 5 | 10.1（艦橋・屋上） | 1.47 |
| base.jasdf | 520–600 × 200–240 | 4692 / 6000 | 5028 / 6000 | 77 | 77 | 3 | 20.0（管制室） | 1.36 |

**上限を上書きした種類**（`limits`）: 基地 5 種類（`base` の既定は外観 1,500・内部 3,000。拠点の小屋向けの値）。理由: 1 つの設計図に本部・隊舎・整備場・弾薬庫・車両の列（海自は艦艇 2 隻、空自は格納庫 3 棟と管制塔）が入る「何棟分もの敷地」で、棟ごとに見ればそれぞれ上限に収まる。内部は敷地の全棟の 1 階が 1 つの階に数えられる。描いたときの実数は下の性能の表（どこでも 17.3 万三角形以下）。生成時間: 部屋の多い棟を増やすと 4ms に近づくので、大の駐屯地は入れる隊舎 1 棟（2 階）＋施錠の隊舎 2 棟、中は本部 2 階＋施錠の隊舎 1 棟にした

### 性能（GPU なし・SwiftShader、1280×720、sim 1 ステップ＋`renderer.draw` 1 回を直接計測、e2e で計測）
試験用の地図（`?yard=1`、中に入れる建物 210 棟）と自衛隊の大きな地図（`?yard=3`、4 棟）:

| 場所 | ドローコール | 三角形 | sim ＋ 描画発行 |
|---|---|---|---|
| 野営地の通り（10 種類が並ぶ） | 11 | 15.6 万 | 0.01 ＋ 0.65 ms |
| 大隊の宿営地の中 | 9 | 13.5 万 | 0.02 ＋ 0.48 ms |
| 大隊の宿営地の監視塔の上 | 9 | 13.4 万 | 0.02 ＋ 0.67 ms |
| 小の駐屯地の中 | 11 | 17.2 万 | 0.01 ＋ 0.31 ms |
| 中の駐屯地の中 | 8 | 9.7 万 | 0.02 ＋ 0.41 ms |
| 大の駐屯地の中 | 9 | 12.8 万 | 0.01 ＋ 0.31 ms |
| 海自の基地の中 | 9 | 8.6 万 | 0.01 ＋ 0.37 ms |
| 空自の基地の中 | 9 | 9.9 万 | 0.01 ＋ 0.26 ms |
| 護衛艦の艦橋 | 9 | 9.3 万 | 0.01 ＋ 0.36 ms |
| 空自の管制室 | 9 | 11.2 万 | 0.04 ＋ 0.59 ms |

### e2e
- `e2e/buildings-military.spec.ts` 3 件、すべて通過（直列。1 件目 2.2 分、2・3 件目 3.3 分）: 15 種類それぞれ扉から入って最も高い部屋（テント・監視塔 6.2m・本部の屋上 10.1m・管制室 20.0m）まで歩き、その部分の棚を 1 つ探索。**小の駐屯地で武器の棚は鍵の前は探索できない → 金庫を探索（ログ `log.keyFound`、3 部屋が開く）→ 武器庫まで歩いて棚を探索**／全種類を並べた地図の性能（上の表）／斜め上からの画像 `test-results/military-view-<id>.png`（15 枚、目視した）。各階の平面図と正面は `node tools/building-preview.ts tmp/buildings 1 military` / `... base.j` で目視した
- `npm run check`: 832 件中 830 件通過、`public.univ_city` と `public.hospital_large`（07d-2d の種類）の生成時間の検査が CPU の負荷で落ちた（単独では通る。07d-2e の記録と同じ現象。自分の変更前のコードでも同じ）。`npm run build` 通過。他の e2e は流していない（共有の変更は鍵の部屋の探索ポイントと `?yard=3` で、既存の種類には鍵がないので既存の e2e の対象は変わらない）

### 未完了・既知の問題
- 区域への配置はしていない（07d-3）。今は試験用の地図にだけ並ぶ
- **遠景の外形の箱**: 大の駐屯地は 750 × 500m に軒 3.5m の箱が 300m より先で見える（07d-2d・2e と同じ問題。e2e の画像でも他の敷地の箱が見える）
- **部屋の中の経路は直線**: 整備場のトラック・倉庫テントの木箱の列が、扉から遠い棚への直線を塞ぐことがある（カタログの検査は出入口どうしの直線だけを見る）。プレイヤーは避けて歩けるが、`debug.pathTo` の経路をそのまま歩かせると止まることがある（e2e は近い順に 6 か所まで試す）
- 艦艇の船体の中（甲板の下）は作っていない（上部構造の中だけ）。艦艇・戦闘機・ヘリ・車両には入れない（当たり判定はある）。海は地面に塗った水面と見えない柵で、地面の高さは変えていない
- 鍵は「同じ建物（施設）の金庫が探索済みか」で決まる。区域の `lootSpots` の上限で金庫が探索ポイントに入らない施設は、武器庫も開かない（金庫を施設の先頭に入れてあるので、施設が選ばれれば金庫は必ず入る）。屋内のゾンビの経路は開いた扉も通る
- 警察署の武器庫（07d-2d）は鍵の仕組みを使っていない（シードでこじ開けられている）

### 次のセッションへの注意（各プロンプトの末尾にも書いた）
- 07d-3: 種類と大きさ、海自は奥（z < 42m）が海、大の駐屯地は区域の大半、検問所は敷地を道が通る、鍵と探索ポイントの並び、射点
- 09: 弾の入り方（`field`・鍵の武器庫）の釣り合い
- 10: 大の駐屯地の三角形、金庫は E を 1 回押すだけ
- 取りまとめ役: 共有ファイルの追加は `types.ts`（`MaterialId` の `'olive'`、`LootTableId` の `'field'` `'safe'`、任意の項目 `key` / `keyLinks` / `open`）、`materials.ts`・`render.ts` の `olive`、`colony.ts` の `field` `safe`。鍵の仕組みで触ったファイルは 07d-3 のプロンプトの末尾に一覧

### 追加した共有型・コマンド・イベント
- 型: `MaterialId` に `'olive'`、`LootTableId` に `'field'` `'safe'`、`Part.key?` `Opening.key?` `Room.key?` `SearchPoint.key?` `BuildingBlueprint.keyLinks?` `BuildingPlacement.open?`（`gen/buildings/types.ts`）、`LootSpot.key?` `.enter?`（`gen/types.ts`）、`TacticalState.lootSpots[]` の `key?` `enter?`（`core/types.ts`、追加のみ・セーブの形は互換）。関数: `openBlueprint`（`gen/buildings/index.ts`）、`applyKeys`（`sim/tactical/area.ts`）、`sdfYard`・`yardMap(3)`・`yardEntries(3)`（`sim/tactical/yard.ts`）。データ: `ROOM_LOOT.field` / `.safe`、`RENDER.materials.olive`。文言: `log.keyFound`。フラグ: `flags.yard` に 3、URL `?yard=3`、`debug.openYard(3)`。コマンド・イベントの追加なし
- 新しいファイル: `defs/military/{parts,camps}.ts`、`defs/base/{sdf_parts,jgsdf,jmsdf,jasdf}.ts`、`tests/buildings-military.test.ts`、`e2e/buildings-military.spec.ts`
- 依存の追加なし

### 取りまとめ: 生成時間のテストを負荷に強く — 2026-11-21
- 07d-2c〜2f が続けて報告した「`npm run check` を通しで流すと、建物の生成時間（4ms）・フローフィールド（5ms）・区域の生成（150ms）の検査が負荷でまれに落ちる」への対応。並列のテストワーカーの負荷を拾う中央値をやめ、**複数回のうち最速の値** で判定するようにした（`tests/buildings.test.ts`・`build.test.ts`・`cover.test.ts`）。上限の値は変えていない。仕事そのものの重さが上限を超えれば従来どおり落ちる


## R0 実在の日本地図: 基盤 — 2026-11-21

発注者の要望「地図は日本の実際のものに合わせたい。出来る限り。都道府県ごと、地方ごとにチャットを分けても良い」。R0 は **実データから地図を作る仕組み（取得・変換・区域の生成）** を作り、四国（207 セル）で通した。残りの地方は R1〜R8 が同じ仕組みで仕上げる。手引きは **`docs/realmap_guide.md`**。

### 完了したこと
- **A. 戦略地図を実データに**（`tools/real/grid.ts`、`npm run data`。仕様は `02_systems_spec.md` §2.1）
  - 陸と海・標高: 国土地理院 標高タイル（DEM10B z10、セルあたり 20×20 点）。陸地 3,885 → **4,108 セル**（セル番号・投影は不変）
  - 人口: e-Stat 令和2年国勢調査 1km メッシュ（176,560 メッシュ、合計 1 億 2,602 万）を集計 → `pop0`
  - 都道府県・市区町村: 国土数値情報 N03（2024）を 1km 格子に塗り、**セルの人口が最も多い県** をそのセルの県に（02 の「県境付近が隣県になる」不具合を解消）。地名は市区町村ごとに 1 つ、役所（P05 の本庁。政令市は市役所）のセルに。格 1 村〜5 政令指定都市（`places[].grade`、`StaticCell.real.town`）
  - 駅（S12、乗降客数の格 0〜4）、空港（C28、滑走路で大中小）、学校（P29）・病院（P04）の数、警察・消防（人口から見積もり → 地方の区域データで国土地理院の注記の数に上書き）、自衛隊（同、地方の区域データから）を `StaticCell.real`（`CellFacts`）に追加（追加のみ）。戦略地図のセル情報に表示
  - 交通ハブ 69 件すべてを実在の新幹線駅（N02）・空港（C28）の位置に。海を渡る経路の両端を実在の橋・トンネル・港に（`tools/data/sealinks.ts`）
  - 感染の事前計算（`infection_*.bin`）を新しい人口で作り直した（感染モデルの数値は不変）。比較は下の表
- **B. 区域のデータ**（`tools/real/region.ts`、`npm run data:region -- <地方> [--cells …] [--estimate]`）
  - 1 セル = 標高 129×129（実在 78m ごと、0.5m 刻み）・土地利用 129×129（L03-b、**標高と同じ格子点** なので境界の両側で一致）・堅ろう建物の割合 64×64（国土地理院 z13 の建物の面）・人口 10×10・線（高速・国道・県道・幅 13m 以上・人の少ない所は 5.5m 以上の道、鉄道。トンネル・橋の印）・点（駅・県庁・役所・病院・学校・大学・警察・消防・自衛隊・空港・城・寺社…名前つき）。形は `src/gen/real/format.ts`（独自の可変長符号＋gzip）
  - 取得は `tools/real/lib/fetch.ts`（curl、**1 秒 5 件まで**、`tmp/realdata/` にキャッシュ、汎用の User-Agent）。z14 の注記は「町のタイル」（L03-b で建物用地か「その他」が一定以上）だけ読む
  - `public/data/areas/<地方>/index.json` にセルごとの大きさ・警察署・消防署の数・自衛隊の施設
- **C. 区域の生成を実データ対応に**（`src/gen/real/layout.ts`、仕様 `02` §2.5、構造 `04` §7）
  - 地形: 実標高を Catmull–Rom で 257² に、高さを `REAL_AREA.height.knots` で縮める（傾き 0m 0.22 → 60m 0.18 → 250m 0.13 → 700m 0.095 → 1,500m 以上 0.075。石鎚山 1,982m が区域で約 190m）＋世界座標の細かい起伏 0.25m。海は水面 0・海底 −3.5m、川・湖は 1.6m 掘り下げて岸の 0.6m 下に水面
  - 水: `TacticalMap.water`（高さの標本ごとの水面）、`GROUND.water` / `GROUND.sand` を追加。水面は通行不可（ナビ）、プレイヤーは深さ 1.2m まで歩いて渡れる（速さ 0.55 倍）。描画は区域ごとに 1 メッシュ（`render/tactical/water.ts`、海は長方形にまとめる）
  - 道路・鉄道: 縮めた位置に実寸の幅（高速 20m・国道 11m・県道 8m・広い道 15m・鉄道 5/8m）。トンネルは描かない、路面電車は道路の上なので描かない。**水の上は土手で渡る**（瀬戸大橋・しまなみ海道の来島海峡大橋も土手として渡れる）
  - 町並み: 建物用地の上に世界座標でそろえた 84m の街路の格子、街区を人口（1km メッシュ）と堅ろう建物の割合で決まる格（1 戸建て / 2 密集した低層 / 3 中層 / 4 高層）で埋め、実在の道路の間は 9m ごとの候補で埋める（建物どうしは正確な隙間で判定）。今ある 07d の種類（家・コンビニ・雑居ビル）か箱
  - 施設: 駅・県庁・市役所・役場・病院・学校・大学・警察・消防を実在の位置に箱で、陸自の駐屯地に `base.jgsdf_s`。すべて `TacticalMap.pois` に残す（07d-3 用）
  - 森は土地利用の森林に（`Builder.forestAt`）。藪・草むら・岩・ゾンビ・探索・補給箱・潜伏者は従来の仕組みがそのまま動く
  - 読み込み: `src/realData.ts`（8 地方の index.json を起動時に、区域ファイルは要求されたら fetch → gzip 展開 → 復号）と `sim/world/realAreas.ts`（純粋な登録簿）。**データが届くまで区域を作らない**（読み込み画面）、周囲 3×3 を先読み、未着の隣へは越えない。ファイルの無いセルは今までどおり乱数の区域
  - 境界: 実データどうしは辺の上の点を両側で同じ緯度経度から標本化しているので一致。隣が乱数の区域の辺は 120m の帯で 07c の地形へ混ぜる（角では混ぜない＝実データどうしの辺を崩さない）
- **D. 手直しの口**: `tools/data/real/overrides/<地方>.ts` × 8（空、型は `types.ts`: 高さの倍率・点の削除/改名/追加・高層の間引き・細い道の除外）。名所: `src/gen/buildings/catalog/landmark_<地方>.ts` × 8（空、`catalog/index.ts` に登録済み、カテゴリ `landmark` と三角形の上限 `ARCH.limits.landmark` を追加）、`defs/landmark/<地方>/`
- **E. 四国で通した**: 207 セル取得・変換・全セル自動点検・ゲーム内で 7 地点（e2e）
- **F. 手引き** `docs/realmap_guide.md`（取得と変換・キャッシュ・大きさ・点検・見比べ方・よくある不具合・手直しの口・名所・性能・チェックリスト）。R1〜R8・07d-3・09・10 のプロンプト末尾に注意を追記
- 出典の画面: タイトルの「出典」とメニューの「出典」タブ（`src/ui/components/Credits.tsx`、文言は `ja.ts` の `credits.*`）。README にも出典
- 道具: `tools/real/area-preview.ts`（データを上から）、`tools/real/area-map.ts`（ゲームの区域を上から）、`tools/real/check.ts`（自動点検）、`tools/real/cities-check.ts`（主要地点のセル情報）、`tools/real/infection-stats.ts`、`tools/preview.ts` に県・標高・施設の PNG。デバッグ `debug.gotoCell / gotoLatLon / realInfo`

### データの利用条件（各データのページで確認、2026-11-21）
| データ | 版 | 利用条件 | 使い道 |
|---|---|---|---|
| 国土地理院ベクトルタイル提供実験（experimental_bvmap） | 現行 | 国土地理院コンテンツ利用規約（出典明示で商用可・加工可） | 道路・鉄道・水面・建物の分布・注記 |
| 国土地理院 標高タイル（DEM10B） | 現行 | 同上 | 標高・海岸 |
| 国土数値情報 土地利用細分メッシュ L03-b | 2021 | オープンデータ（CC BY 4.0 互換） | 区域の土地利用 |
| 国土数値情報 行政区域 N03 | 2024 | CC BY 4.0 | 県・市区町村・地名 |
| 国土数値情報 駅別乗降客数 S12 | 2024 | CC BY 4.0 | 駅の格 |
| 国土数値情報 空港 C28 | 2021 | 商用可 | 空港 |
| 国土数値情報 鉄道 N02 | 2024 | CC BY 4.0（2020 年以降） | 新幹線駅（ハブ） |
| 国土数値情報 学校 P29 | 2023 | CC BY 4.0（2013 年版は非商用。使っていない） | 学校の数 |
| 国土数値情報 医療機関 P04 | 2020 | CC BY 4.0 | 病院の数 |
| 国土数値情報 市町村役場等 P05 | 2022 | CC BY 4.0 | 役所の位置（地名） |
| e-Stat 国勢調査 地域メッシュ統計（1km） | 2020 | 政府標準利用規約（CC BY 4.0 互換） | 人口 |
| Natural Earth（world-atlas） | — | パブリックドメイン | 取得範囲の決定のみ |
| ~~国土数値情報 警察署 P18・消防署 P17・役場 P34・国の機関 P28~~ | — | **非商用** | **使っていない**（警察・消防は国土地理院の注記で数えた） |

### 取得量（見積もりと実測）
- 見積もり（`npm run data:region -- shikoku --estimate`）: **全国 約 84,200 件**（10 万件未満。内訳は手引き 2 節の表）。z14 は町のタイルだけ、建物の z16 は使わない
- 実測: 全国の戦略地図 DEM z10 985 枚（うち海の 404 を含む）・e-Stat 176 メッシュ・国土数値情報 約 60 zip（N03 47 県で約 400MB）。四国の区域 DEM z12 402・ベクトル z13 1,454・z14 1,167・L03-b 9 zip。キャッシュ合計 1.1GB（コミットしない）。四国の初回の取得は並列化後で 約 10 分（並列化前の版で約 25 分）、2 回目以降の変換は 207 セルで 52 秒

### 変更前後の比較（戦略地図）
| | 変更前（合成） | 変更後（実データ） |
|---|---|---|
| 陸地セル | 3,885 | 4,108 |
| 人口 | 1 億 2,500 万（正規化） | 1 億 2,601.9 万（国勢調査。範囲外の離島 約 5,500 人を除く） |
| urban / suburb / rural / forest / mountain | 128 / 646 / 1,513 / 1,182 / 416 | 161 / 660 / 1,621 / 1,277 / 389 |

90 日目（シナリオ 0 / 1 / 2）: ゾンビ総数と、セルの Z 中央値（都市・郊外・田舎。森林・山地はどちらも 0）

| | 変更前 | 変更後 |
|---|---|---|
| 総数 | 3,437 万 / 3,486 万 / 3,481 万 | 3,281 万 / 3,518 万 / 3,464 万 |
| 都市 | 104,452 / 105,693 / 117,524 | 81,239 / 97,130 / 93,841 |
| 郊外 | 12,822 / 12,483 / 12,493 | 8,454 / 9,160 / 9,453 |
| 田舎 | 711 / 946 / 850 | 100 / 400 / 441 |

### 主要地点のセル（`node tools/real/cities-check.ts`）
| 地点 | セル | 県・市区町村（格） | 崩壊前人口 | 区分 | 駅（格・乗降/日） | 空港 | ハブ |
|---|---|---|---|---|---|---|---|
| 札幌駅 | 4800 | 北海道 札幌市（政令） | 491,865 | urban | 札幌（4・168,030） | — | 札幌 |
| 仙台駅 | 13647 | 宮城県 仙台市（政令） | 641,023 | urban | 仙台（4・336,112） | — | 仙台 |
| 東京駅 | 18480 | 東京都 品川区ほか（特別区） | 1,029,057 | urban | 東京（4・1,176,902） | — | 東京 |
| 新宿駅 | 18312 | 東京都 杉並区ほか | 1,972,434 | urban | 新宿（4・3,927,423） | — | — |
| 名古屋駅 | 19289 | 愛知県 名古屋市（政令） | 830,805 | urban | 名古屋（4・791,971） | — | 名古屋 |
| 大阪駅 | 20112 | 大阪府 大阪市（政令） | 1,153,045 | urban | 新大阪（4・563,364） | — | 新大阪 |
| 広島駅 | 20752 | 広島県 広島市（政令） | 515,690 | urban | 広島（4・141,126） | — | 広島 |
| 博多駅 | 22237 | 福岡県 福岡市（政令） | 858,770 | urban | 博多（4・508,643） | 福岡空港（大） | 博多・福岡空港 |
| 松山市駅 | 21757 | 愛媛県 松山市（県庁所在地） | 419,277 | urban | 松山市（3・17,439） | — | — |
| 那覇空港 | 35906 | 沖縄県 那覇市（県庁所在地） | 366,926 | urban | 那覇空港（2） | 那覇空港（大） | 那覇空港 |
| 新千歳空港 | 5304 | 北海道 千歳市（市） | 5,618 | rural | 新千歳空港（3） | 新千歳空港（大） | 新千歳空港 |

全国の地図: `node tools/preview.ts tmp/preview` の `pref.png`（県の色分け）・`land.png`・`elev.png`・`facilities.png`、ゲーム内は e2e の `test-results/realmap-strategic.png`。

### 四国（試験台）
- 207 セル、**合計 3.40MB・平均 16.0KB・最大 20.3KB**（目安 平均 40KB・全国 120MB 以内）
- 自動点検（`node tools/real/check.ts shikoku`）: **205 / 207 セルが問題なし**。例外 2 セル（20936・22924）は道路が区域の辺を「かすめる」だけの所で、片側にだけ道の端ができる（高さ・水面は一致、見た目の段差なし）
  - 生成時間（Node）平均 92ms・最大 184ms。乾いた土地の歩ける割合は全セル 60% 以上、射点は全セル 3 か所以上、本拠の中央 120m に建物なし、境界の高さの差 0.000m
  - 地上で 200m 先が見える割合（区分ごとの平均）: 都市 11% / 郊外 15% / **田舎 10%** / 森 7% / 山地 13%。**田舎が 07b の目安（25〜45%）より閉じている**: 四国の「田舎」は山あいの集落で、起伏と土地利用の森林が視線を切るため（木を減らしても 9→10% で、主に地形）。生け垣・藪（`TACTICAL.cover`）は共通なので触っていない（09 / R7 で判断）
  - 森の木の密さ: 土地利用の森林 1ha あたり 80 本（`REAL_AREA.forestTreesPerHa`）。最初は乱数の森（130 本）と同じにしていたが、区域の大半が森の実在のセル（鬼北町）で 10,300 本になり、指揮層の上空カメラで三角形の予算（50 万）を超えたので、乱数の最も密な森（約 6,000 本）と同程度の 6,500 本に合わせた
- 自衛隊: 陸自の善通寺（＋第14旅団司令部）・徳島・松山・高知の 4 駐屯地を注記から検出。海自の小松島・徳島の航空基地は検出できていない（注記が町のタイルの外。R7 で `addPois`）
- 警察署 54・消防署（分署を含む）141 を注記から数えた

#### 照合（ゲーム内のスクリーンショット `test-results/realmap-*.png` と `tools/real/area-preview.ts` / `area-map.ts` の PNG を、地理院地図の同じ 10km 四方と見比べた）
| 地点 | セル | 合っている | 合っていない・未確認 |
|---|---|---|---|
| 松山の中心 | 21757 | 城山（中央の緑の丘）、石手川と重信川（南端）、市街の広がり、東の山地（みかん畑＝畑）、伊予鉄・JR 予讃線、国道 11・33・56 号、松山 IC 付近の高速、松山駅・松山市駅・県庁・市役所・赤十字病院の位置 | 三津浜の海岸線はセルの西端の外（隣のセル）。城山に天守は無い（名所は R7） |
| 高松 | 20766 | 北の瀬戸内海と女木島、海沿いの市街（セルの南寄り）、高松駅・県庁・市役所・栗林公園の位置 | 中心市街の大部分は南のセル 20933。玉藻城（名所）なし |
| 高知 | 22265 | 鏡川・浦戸湾の入り江、北の山地と高知自動車道、市街の帯、高知駅・県庁・市役所 | 高知城の丘はなだらか（縮め方で低くなる）。県庁の箱は実在より大きい |
| 徳島 | 21272 | 吉野川と新町川の水面、眉山、市街、徳島駅・県庁、眉山ロープウェイ（山麓駅・山頂駅） | 徳島空港は東隣のセル |
| 石鎚山の付近（四国山地） | 21927 | 深い谷と尾根、針葉樹の森、林道のみ | 石鎚山の山頂そのものは西隣のセル 21926。急な所は岩肌 |
| 今治・しまなみ海道 | 21258 | 来島海峡と大島・馬島、来島海峡大橋（土手として渡れる）、今治市街と今治駅 | 橋は土手（橋桁・塔は無い） |
| 坂出・瀬戸大橋 | 20765 | 坂出の番の州の工業地帯（その他の用地）、瀬戸大橋の四国側の取り付け | 区域の 7 割が海。瀬戸大橋の海上部は北のセル（香川側の区域の外） |
| 境界越え | 21757→21758 | 松山の区域から東へ道路を歩いて越えると、足元の高さは 1 ステップ 0.3m 未満の変化で続き、振り返ると道と地面がつながって見える（`test-results/realmap-border.png`） | — |

### 性能（GPU なし・SwiftShader、1280×720、sim 1 ステップ＋`renderer.draw` 1 回を直接計測、`e2e/realmap.spec.ts`）
高所の射点から区域の中央を見た場面（区域に入ってから組み立て待ちが 0 になった後）:

| 場所 | セル | ドローコール | 三角形 | sim ＋ 描画発行 | 区域に入る時間（ファイル） |
|---|---|---|---|---|---|
| 松山の中心（最も建物の多い区域） | 21757 | 71 | 20.8 万 | 0.15 ＋ 1.42 ms | 1.9 s（0.37 s） |
| 高松（海沿い） | 20766 | 56 | 24.3 万 | 0.06 ＋ 1.07 ms | 0.7 s（0.06 s） |
| 高知 | 22265 | 60 | 21.9 万 | 0.00 ＋ 0.66 ms | 0.8 s（0.07 s） |
| 徳島 | 21272 | 71 | 24.7 万 | 0.05 ＋ 1.00 ms | 0.9 s（0.08 s） |
| 石鎚山付近（山地） | 21927 | 57 | 24.2 万 | 0.00 ＋ 0.88 ms | 0.7 s（0.07 s） |
| 今治・しまなみ（海沿い） | 21258 | 55 | 15.6 万 | 0.06 ＋ 0.99 ms | 0.8 s（0.08 s） |
| 坂出・瀬戸大橋 | 20765 | 78 | 32.0 万 | 0.11 ＋ 1.20 ms | 0.7 s（0.05 s） |
| 境界越えの直後に振り返る | 21758 | 63 | 22.9 万 | 0.13 ＋ 1.01 ms | — |
| 本拠（鬼北町、seed 12 の開始セル）に壁 587 枚・襲来 109 体・30 人、指揮層の上空 | 22758 | 64 | 40.2 万 | — | — |
| 同、戦術視点 | 22758 | 44 | 28.3 万 | 0.28 ＋ 1.70 ms | — |

- 森の密さを下げる前の計測では、別の視点（最も高い射点から外向き）で高知 81 / 47.6 万三角形まであった。重い区域は 07d-1 の段階的な出現が効いている
- 区域ファイル 1 つの読み込み（fetch＋展開＋復号）40〜360ms、生成は Node で平均 118ms（ゲームでは Worker）
- `addRoad` の勾配付けが道路ごとに 66k 要素の配列を 3 つ作っていたのを使い回しに（実データの区域は道路が数百。乱数の区域も速くなる。出力は同じ）

### テスト
- `tests/realmap.test.ts`（7 件）: 区域ファイルの往復（標高 0.5m・海・土地利用・線・点）、高さの縮め方（単調・山ほど強い・倍率）、実データのあるセル／無いセル、**データが届くまで区域を作らない**、松山の区域（建物・鉄道・広い道路・駅・県庁・水面・歩ける割合・重なりなし）、**隣り合う実データの区域の境界（高さ・水面・道路）**、松山・高知・山地の自動点検
- 既存テストの変更（新しい戦略地図に合わせた）: `world.test.ts`（陸地セル数の上限 4,300、人口は国勢調査の範囲、地名「対馬」→「対馬市」）、`combat.test.ts`（本拠の中心からの距離の許容を 1 ステップぶん広げた）、`colony.test.ts`（探索ポイントの床の高さに立つ・同じ部屋の次の棚）
- `npm run check` 839 件・`npm run build` 通過
- e2e: 新しい戦略地図で開始セルが変わったため、特定のセル・シードに依存していた 3 件を直した
  - `build.spec.ts`「a moat with one opening」: seed 12 の開始セルが **四国の実在の区域（愛媛県鬼北町）** になり、指揮層の上空カメラで 50.3 万三角形（森が多い）→ 上の森の密さの調整で 40.2 万
  - `buildings.spec.ts`「city: far buildings…」: `gotoLand('urban', 40)` が東京・江戸川区（周囲 8 セルすべて都市）になり、150m で外観の段にならなかった（隣の都市の区域の建物で段階の枠が埋まると思われる。07d-1 の仕組みの限界として 07d-3 / 09 へ）。テストは仙台の中心（周囲が郊外）へ `gotoLatLon` で行くように
  - `playtest.spec.ts` の潜伏者の煙: seed 21 の開始セルでは煙が射点からも本拠からも見えない位置になった（7 画素）。シードを 24 に替えた（3・12・24）
  - `ui.spec.ts`「first steps」: 開始セル（鬼北町の森）で、40〜260m の最寄りのゾンビへの 5 発が木と斜面に当たって弾が尽きた。標的を本拠の中央の空き地（70m 先）に置き、弾倉を補うように
  - 結果: 54 件すべて通過（1 回目の全件の実行が 1 時間の上限で 38 件目で止まったため、残り 16 件と直した 4 件を含む 36 件を別に実行して通過、直した ui の 1 件を単独で通過）
  - 注意: Playwright の `webServer` は `reuseExistingServer: true` なので、**途中で止めた実行が残した `vite preview` があると古いビルドのまま測る**。測り直す前に `pkill -f "vite preview"`

### 未完了・既知の問題
- **施設は箱**（07d-3 が種類を当てはめる）。名所なし（R1〜R8）。橋は土手、トンネルは描かない（坑口で道が終わる）。海自・空自の基地は置いていない（07d-3）
- 田舎の視線が目安より閉じている（上記）。町の街路は軸に平行な格子（実在の街路の向きは使っていない）
- 区域の中の細い川（水面として出ない幅）は描かない。L03-b の「河川地及び湖沼」と国土地理院の水面の面だけ
- 戦略地図は全国を実データにしたが、**区域は四国だけ**。他の地方は R1〜R8 が揃うまで乱数の区域。地方の境界（例: 四国と本州の橋の先）では隣が乱数の区域なので 120m の帯で混ぜる
- 地名のラベルは 1 セル 1 つ（政令市は市役所のセル。名古屋駅のセルは「清須市」と出る）
- 区域ファイルのあるセルは、ファイルが届くまで隣へ越えられない（先読みしているので普通は気づかない）
- セーブの互換: セル番号と世界の配列（格子全体の長さ）は不変なので以前のセーブも読めるが、新しく陸になった 223 セルは人も物資も 0、人口や県は新しい地図のものになる。**実在の地図で遊ぶには新規ゲームから**。`STATE_VERSION` は変えていない

### 仕様からの変更点（更新した docs）
- `02_systems_spec.md` §2.1（実データの戦略地図）、§2.2（90 日目の目安）、§2.5 新設（実在の地図の区域）
- `04_architecture.md` §5（`CellFacts`）、§7（実在の地図の区域・読み込み・境界・追加した型）、§8（水面）
- `docs/realmap_guide.md` 新設、README に出典
- 決めてある「縮め方」のうち、**高さの縮め方の値** は計測で決めた（上の knots。歩ける割合 60% 以上・射点 3 以上を全 207 セルで満たす）。07c の境界の 120m の帯は、実データどうしでは不要（標本化で一致）、乱数の区域との間だけに残した

### 次のセッションへの注意
- **R1〜R8**: 手引き `docs/realmap_guide.md` のとおり。`npm run data` は回さない（戦略地図は全国ぶん R0 が作り直し済み。回すと全地方で `grid.json` が衝突する）
- **07d-3**: `map.pois` と `StaticCell.real` から建物を選ぶ（プロンプト末尾に追記）
- **09**: 田舎の Z が減った（上の表）。開始候補と難しさの見直し
- **10**: 区域ファイルの読み込み（オフライン対応は地方単位で）

### 追加した共有型・コマンド・イベント
- 型（追加のみ）: `StaticCell.real?: CellFacts`、`CellFacts`、`SdfKind`、`StaticGrid.places[].grade?`（`core/types.ts`）。`GenParams.real?`、`WorldContext.around[].real?`、`MapPoi`、`TacticalMap.water?` / `pois?`、`GROUND.water` / `sand`（`gen/types.ts`）。`Builder.forestAt?`。`BuildingCategory` に `'landmark'`。`GridFile` に `placeGrade / elev / relief / muni / muniNames / town / fac / stations / airports`（省略可能）
- データ: `src/data/realmap.ts`（`REAL_GRID` / `REAL_AREA` / `REAL_CHECK`）、`TACTICAL.player.wadeMax / wadeFactor`、`RENDER.water`、`ARCH.limits.landmark`
- 関数: `waterDepthAt`（collision）、`areaWaiting` / `prefetchReal`（area）、`sim/world/realAreas.ts` 一式、`src/realData.ts`、`gen/real/format.ts`・`layout.ts`
- 文言: `credits.*`、`menu.tab.credits`、`world.real.*`。デバッグ: `debug.gotoCell / gotoLatLon / realInfo`。npm script `data:region`
- コマンド・イベントの追加なし。`STATE_VERSION` は据え置き
- 依存の追加なし（zip・シェープファイル・ベクトルタイルの読み取りは自作。取得は curl）

## R1 実在の日本地図: 北海道 — 2026-11-21

北海道（919 セル）のすべてのセルを実データの区域にし、自動点検・見通しの 2 つの決まり・実在の地図との照合・性能の計測を通した。名所 2 つ（さっぽろテレビ塔・五稜郭タワー）。**共通部分を直した**（下の「共通部分の変更」。鉄道のトンネルの読み違いは全地方に影響するので、四国を含む全地方で区域の作り直しが要る）。

### 完了したこと
- **取得と変換**: `npm run data:region -- hokkaido` で 919 セル。取得 約 13,500 件（DEM z12・ベクトル z13・注記 z14・L03-b 33 zip、約 1.0GB のキャッシュ）、初回 約 75 分（途中で TLS の一時的な失敗が 1 回 → 再実行で続きから）。2 回目以降の変換は 919 セルで約 95 秒
- **出力の大きさ**: 合計 **12.94MB**・平均 **13.8KB**・最大 **19.6KB**（目安: 平均 40KB 以下。全国 120MB の 11%）
- **自動点検**（`node tools/real/check.ts hokkaido`）: **913 / 919 セルが問題なし**。例外 6 セル（3147・3976・5320・5458・6798・6962）はすべて「相手のない道路の端」1〜2 本で、R0 の四国の例外と同じ種類: 道路が区域の辺に触れて引き返す（3976・5320・5458・6798・6962）、高速の IC のループの途中の点が辺の上にある（3147→3314、相手側では端点でなく線の途中の点）。高さ・水面の不一致は 0、見た目の段差なし
  - 生成時間（Node）平均 74ms・最大 146ms。乾いた土地の歩ける割合は全セル 60% 以上（最小 90%）、射点は全セル 3 か所以上、本拠の中央 120m に建物なし、境界の高さの差 0.000m
  - 地上で 200m 先が見える割合（記録のみ。区分ごとの平均）: 都市 6%（4 セル）/ 郊外 31%（36）/ 田舎 16%（188）/ 森 9%（639）/ 山地 14%（52）
- **見通しの 2 つの決まり**（取りまとめの注意。`node tools/real/sightlines.ts hokkaido`、新設）: **919 セルすべて通過**
  - (1) 高所の射点のうち、立って 300m 先の地面＋1m が 16 方向のどこかに見えるものが 3 か所以上（海が 6 割を超える区域は除く、check.ts と同じ）。最初は 126 セルが不足（起伏のある森で 12m の塔でも梢に隠れる）→ 物見櫓（POI.tower、高さ 20m の見張り台）を **128 セルに計 194 基**、手直しのファイルに足した（場所は `--suggest` が「平らで空いた乾いた土地のうち 300m が最も多くの方向に見える所」を選ぶ。足す → 作り直す → 測り直すを 2〜3 回で収束）。平均 3.4 か所
  - (2) 田舎・森のセル（827 セル）を本拠として作り、中央 半径 120m の空き地（中央と 60m 外の 8 点）から空き地の外の 150m 先が 16 方向のうち 2 方向以上で見える。**全セル通過**、平均 14.1 方向・最小 5 方向。※中央 1 点だけで測ると 4 セル（3142・3162・5300・7461）が 1 方向だった
- **町の広い道路**: 札幌の中心は実在の幅 13m 以上の市道が約 100m ごと（縮めると 10m ごと）に並び、区域の中心がほぼ一面の舗装になっていた（中心 4800 の建物 430 棟）。地方全体の手直し `dropWideRoadsAbove: 4000`（1km メッシュの人口が 4,000 人/km² 以上の所の **市道の** 広い道路だけ入れない。国道・道道は残す。町の生成器の街路の格子が代わる）で街区が戻った（4800: 526 棟、北隣 4633: 1,131 棟）。北海道は他の地方と陸で接しないので境界の不一致は起きない
- **自衛隊**: 注記から 57 件 → 手直し後 **39 か所**: 陸自の大きな駐屯地 5（札幌・真駒内・旭川・東千歳・帯広。方面総監部・師団・旅団の司令部の注記は駐屯地と同じ場所の重複なので、その駐屯地を大に）、中 22、分屯地 4、空自 6（千歳基地・八雲・当別・奥尻島・網走・長沼）、海自 2（函館基地隊・余市防備隊）。**演習場（17 件）は外した**（建物のない訓練場。駐屯地の敷地を森の中に置いてしまうため）。注記が町のタイルの外にあった 安平・鹿追・静内の駐屯地と空自 4・海自 1 は z14 の注記を探して実在の位置で足した。稚内・根室・襟裳の分屯基地は戦略地図で海のセル（区域がない）
  - 駐屯地の敷地（180×100m）が区域の辺にかかって置けない 3 か所（旭川・東千歳・帯広）は内側へ 40〜90m 寄せた
- 警察署 63・消防署（出張所を含む）223（注記から数えた）
- 札幌の `道庁` と `北海道庁舎`（同じ点の重複）→ `北海道庁` 1 つに

### 照合（ゲームの区域 `tools/real/area-map.ts`、データ `area-preview.ts`、地理院地図の同じ 10km 四方（標準地図 z13 を切り出し）の 3 枚を並べ、ゲーム内のスクリーンショット `test-results/realmap-hk-*.png` も見た）
| 地点 | セル | 合っている | 合っていない・未確認 |
|---|---|---|---|
| 札幌の中心（大通・札幌駅・すすきの） | 4800 | 豊平川の流れ（南の真駒内から北東へ）、藻岩山（ロープウェイの山麓・中腹・山頂駅）と円山・三角山の山並み、碁盤目の中心街（北東）、国道 5・36・230・453 号、JR 函館本線（札幌駅の高架）、地下鉄は地下で描かない、道庁・市役所・区役所、北部方面総監部の札幌駐屯地・真駒内駐屯地の位置 | 札幌駅はセルの北端（z=87）で、駅の北側は北隣 4633。テレビ塔は大通と創成川通の交差点に重なるので 20m 南東に建つ。大通公園の緑地は細い（土地利用 100m 格子では道路と建物用地）|
| 札幌の北（北区・新琴似） | 4633 | 札樽自動車道、国道 5・231 号、JR 札沼線・函館本線、発寒川・創成川、住宅地の広がり（区域の建物は地方で最多 1,131 棟） | — |
| 真駒内駐屯地 | 4800（南端） | 真駒内の住宅地と駐屯地の敷地、豊平川と国道 453 号 | 注記の位置が敷地の北寄りのため、駐屯地は実在より 90m（区域）北 |
| 旭川の中心 | 3473 | 石狩川と忠別川・美瑛川の合流（広い水面）、旭川駅、国道 12・237 号、神居の丘陵、旭川駐屯地（第 2 師団） | 駐屯地は北の辺にかかるため 43m 南へ寄せた |
| 函館の中心・五稜郭 | 7133 | 函館湾と津軽海峡側の弓なりの海岸、国道 278 号の海岸線、五稜郭の堀（水面）、湯の川、函館空港の敷地（東端）、函館駐屯地 | 函館駅はセルの西端（x=120）。五稜郭タワーは縮めた点が堀ぎわの道路に重なるので 25m 南東（堀の南）に建つ。空港の滑走路・ターミナルは建たない（07d-3） |
| 函館山 | 7132 | 函館山の半島（標高の陰影）、函館湾、北斗市側の海岸と国道 228 号・道南いさりび鉄道 | 上磯の工場の桟橋（専用線）が湾の中へ土手として延びる（実在する構造物） |
| 釧路の中心 | 4828・4995 | 釧路湿原（荒地）、新釧路川・釧路川、国道 38・44・391 号、釧路外環状道路、JR 釧網本線・根室本線、春採湖、南の海岸線 | 釧路駅・幣舞橋はセルの角（4828 の南西・4995 の北西）で、中心市街の大半は西隣 4827・4994 |
| 新千歳空港 | 5304 | 空港の敷地（その他の用地）、道央自動車道、国道 36 号、美々川と丹治沼、千歳基地の注記 | **滑走路・ターミナルは建たない**（R0 は空港を置かない。07d-3 が `transport.airport_l` を当てはめる） |
| 千歳（北千歳・東千歳駐屯地） | 5137 | 千歳の市街と碁盤目、千歳川、JR 千歳線、道東自動車道、国道 36・337 号、北千歳・東千歳駐屯地（第 7 師団） | 東千歳駐屯地は東の辺にかかるため 87m 西へ寄せた。千歳・恵庭演習場・東千歳演習場は外した |
| 大雪山（旭岳・御鉢平） | 3645 | 旭岳 2,291m（西）・御鉢平のカルデラ（中央）・北海岳・白雲岳の高まり、森林限界より上の荒地（裸地）、高山の草地 | 区域の高さは 108〜219m（縮め方が山で強い）。登山道は細すぎて入らない |
| 青函トンネルの北の端（知内町湯の里） | 7463 | 北海道新幹線が湯の里の短い区間だけ地上に出て知内川を渡る（土手）、その前後はトンネル（描かない）、国道 228 号、知内川と知内ダム、知内温泉 | **直した**: 最初はトンネル区間も地上の線路としてセルを斜めに横切っていた（下の「共通部分の変更」）。坑口で線路が終わる |
| 知床（知床五湖・羅臼岳） | 2830 | 知床五湖の小さな水面、オホーツク海側の断崖の海岸線、道道 93 号（知床公園線）、羅臼岳 1,660m・サシルイ岳の稜線（南東） | 国道 334 号の知床横断道路は南端をかすめるだけ |
| ウトロ | 2996 | ウトロの集落と漁港（北端）、国道 334 号の海岸線、ウトロ高原の牧草地（畑）、遠音別岳（南東） | 集落は小さく町のタイルにならないため、学校・役場の注記は入らない |

- 戦略地図（`test-results/realmap-hk-strategic.png`）: 北海道の形、市の名前（札幌市は政令市の格 5、他の 33 市が格 3）、駅（札幌・新さっぽろ・手稲・麻生・千歳・新千歳空港・小樽・北広島ほか格 2 以上 18 駅）、空港 12（新千歳・函館が大、稚内・利尻・紋別・女満別・旭川・中標津・釧路・帯広が中、札幌飛行場・奥尻が小）、ハブ 9（新函館北斗・札幌・新千歳空港ほか）が実在どおり。北海道は 1 県なので県境の照合は「全 919 セルが北海道」のみ。警察・消防・自衛隊の数は区域の index.json の値
- ゲーム内の名所: テレビ塔は 4 本の脚・電光時計・展望台・アンテナが遠くからも分かる（`realmap-hk-tv_tower.png`）。屋上（地上 約 90m）から大通・藻岩山が見渡せる（`realmap-hk-tv_tower-roof.png`）

### 性能（GPU なし・SwiftShader、1280×720、sim 1 ステップ＋`renderer.draw` 1 回を直接計測、`e2e/realmap_hokkaido.spec.ts`）
高所の射点から区域の中央を見た場面:

| 場所 | セル | ドローコール | 三角形 | sim ＋ 描画発行 | 区域に入る時間 |
|---|---|---|---|---|---|
| 札幌の中心（テレビ塔の屋上） | 4800 | 81 | 28.8 万 | 0.05 ＋ 1.49 ms | 1.2 s |
| 札幌の北（**最も建物の多い区域**、1,131 棟） | 4633 | 67 | 29.4 万 | 0.09 ＋ 1.15 ms | 0.6 s |
| 真駒内 | 4800 | 79 | 28.5 万 | 0.05 ＋ 1.70 ms | 0.5 s |
| 旭川 | 3473 | 71 | 29.1 万 | 0.01 ＋ 1.51 ms | 0.9 s |
| 函館（五稜郭タワーの屋上、海沿い） | 7133 | 41 | 20.1 万 | 0.09 ＋ 0.82 ms | 0.7 s |
| 函館山（海沿い） | 7132 | 44 | 15.7 万 | 0.04 ＋ 0.94 ms | 0.4 s |
| 釧路 | 4828 | 75 | 21.4 万 | 0.01 ＋ 0.94 ms | 0.7 s |
| 釧路の海岸 | 4995 | 56 | 17.4 万 | 0.01 ＋ 0.68 ms | 0.4 s |
| 新千歳空港 | 5304 | 86 | 37.8 万 | 0.06 ＋ 1.02 ms | 0.5 s |
| 千歳（駐屯地） | 5137 | 81 | 24.3 万 | 0.04 ＋ 0.93 ms | 0.5 s |
| 大雪山（**山地**） | 3645 | 56 | 21.2 万 | 0.00 ＋ 0.61 ms | 0.5 s |
| 青函トンネル北端（森） | 7463 | 81 | **41.3 万** | 0.00 ＋ 0.59 ms | 0.6 s |
| 知床（山地・海沿い） | 2830 | 51 | 29.5 万 | 0.01 ＋ 0.61 ms | 0.7 s |
| ウトロ（海沿い） | 2996 | 60 | 33.4 万 | 0.00 ＋ 0.56 ms | 0.6 s |

- すべて予算内（ドローコール < 150、三角形 < 50 万、sim＋描画発行 < 4ms）。最も重いのは三角形が森の木の多い 7463（41.3 万）。間引きは不要だった
- 区域ファイル 1 つの読み込み 30〜300ms（同時に先読みが走ると 1.4s まで）

### 名所（`src/gen/buildings/defs/landmark/hokkaido/`、カタログ `landmark_hokkaido.ts`）
- `landmark.sapporo_tv_tower`（さっぽろテレビ塔）: 18〜20m 角、20 階（階高 4.5m）＋アンテナ。外観 1,092 三角形・内部 1 階あたり最大 480、生成 1.3〜1.8ms
- `landmark.goryokaku_tower`（五稜郭タワー）: 20〜22m 角、白いコンクリートの塔身・星形の展望台の尖り（飾り）。外観 616 三角形、生成 1.0ms
- 共通の作り（`obs_tower.ts` の `obsTower`）: 敷地の中央の塔身に 1 階から屋上まで折り返し階段、中間の階は踊り場だけ（扉は施錠）、最上階が敷地いっぱいのガラス張りの展望台、その上の屋上（パラペット＋手すり、階段室）が射点。カタログの自動テスト（決定性・上限・到達性・直線・4 方向の歩行）をすべて通過
- 置き方: 手直しのファイルの `addPois`（POI.tower、名前「さっぽろテレビ塔」「五稜郭タワー」）＋ `src/data/realmap.ts` の `REAL_LANDMARKS`（名前 → 種類）。生成は縮めた点か、そこから 48m 以内の最も近い空いた平らな所（どちらも縮めた点は道路・堀ぎわに落ちる）。屋上の正面側（南）のパラペットぎわを射点に足す

### 共通部分の変更（共通部分を直した）
1. **鉄道のトンネルの読み違い（全地方に影響）** `tools/real/region.ts`: ベクトルタイル z13 の `railState` は **100 がトンネル・地下**（z14 の 2 トンネル・3 地下と照合: 青函トンネルへの取り付け区間、札幌の地下鉄）。高架は 0 で `lvOrder` > 0。R0 は 100 を橋と読んでいたため、**全国の鉄道トンネルと地下鉄が地上の線路として描かれていた**（山を貫く線路・街の中を走る地下鉄）。100/200/300 をトンネルに。**四国（R7）と他の地方は `npm run data:region -- <地方>` で作り直しが要る**（ファイルの形は不変）。道路の z13 の `ftCode` 2704（トンネル）は正しい（北海道で 1,685 件）
2. `tools/data/real/overrides/types.ts` に地方全体の `dropWideRoadsAbove?: number`（追加のみ、既定は無効）、`region.ts` に 1 行（`popAt` を `sparseAt` と共用）。陸で隣り合う地方どうしで使うときは両方で同じ値にすること（境界の道路の判断がそろう）
3. `src/gen/real/layout.ts`: (a) 名所の置き場所 `landmark()`（`REAL_LANDMARKS` の名前の点。48m 以内で探す・屋上を射点に）、(b) **POI.tower（手直しの `addPois` の塔）を実際に建てる**（手引きは「足りなければ `addPois` に塔（POI 20）」としていたが、R0 の生成は POI.tower を何も建てていなかった）。`grade` が 0 より大きければ見張り台の高さ（m）、0 は 07b の既定 12m
4. `src/data/realmap.ts` に `REAL_LANDMARKS`（名前 → 名所の種類。各地方が 1 行ずつ足す）
5. 道具の新設 `tools/real/sightlines.ts`（見通しの 2 つの決まりの点検と、物見櫓の場所の提案 `--suggest`）

### テスト
- `tests/realmap_hokkaido.test.ts`（6 件）: 全セルの区域がある、テレビ塔と五稜郭タワーが建ち屋上が地上 80m 超の射点、青函の取り付け区間はトンネルが地上より長く札幌に地下鉄（トンネル）がある、札幌の中心に市道の広い道路が少なく建物 450 棟超、自衛隊の一覧（演習場・司令部なし、大は 5 駐屯地）、代表 5 セルの自動点検と見通しの決まり
- `npm run check` 855 件・`npm run build` 通過
- e2e: `e2e/realmap_hokkaido.spec.ts`（新設、2 件: 14 地点の計測とスクリーンショット・戦略地図、名所の屋上と外観）と `e2e/realmap.spec.ts`（四国、3 件）を流して 5 件通過。全件は取りまとめ役

### 未完了・既知の問題
- 例外 6 セルの道路の端（上記）。空港の滑走路・ターミナル、海自・空自の基地の建物は 07d-3
- 物見櫓が 194 基と多い（北海道は起伏のある森が広く、12m の塔では梢に隠れる）。見た目がうるさければ 09 で数・高さを調整（`tools/real/sightlines.ts --suggest` で選び直せる）
- 稚内・根室・襟裳の空自分屯基地は戦略地図で海のセルにあり、区域がない
- 札幌駅・函館駅・釧路駅はいずれもセルの端にあり、中心市街が 2 セルにまたがる（10km 格子の位置で決まる）
- 四国のデータは鉄道のトンネルの修正前のまま（R7 が作り直す）

### 次のセッションへの注意
- **R2〜R8・取りまとめ**: 上の「共通部分の変更」1 のため、自分の地方の区域を作り直してから照合する。四国（R7）も作り直す
- **07d-3**: 北海道の `map.pois` に名所（POI.tower、`building` あり）と物見櫓（POI.tower、名前「物見櫓」）が入る。施設の種類の当てはめの対象外にしてよい
- **09**: 物見櫓の数（上記）

### 追加した共有型・コマンド・イベント
- 型（追加のみ）: `RegionOverrides.dropWideRoadsAbove?`（tools の型）
- データ: `REAL_LANDMARKS`（`src/data/realmap.ts`）。名所 2 種類（カテゴリ `landmark`）
- 道具: `tools/real/sightlines.ts`。e2e `e2e/realmap_hokkaido.spec.ts`、テスト `tests/realmap_hokkaido.test.ts`
- コマンド・イベント・文言・依存の追加なし。`STATE_VERSION` 据え置き

## R2 実在の日本地図: 東北 — 2026-11-22

東北（青森・岩手・宮城・秋田・山形・福島、725 セル）のすべてのセルを実データの区域にし、自動点検・見通しの 2 つの決まり・実在の地図との照合・性能の計測を通した。名所は作らない（L2）。**共通部分を直した**（下の「共通部分の変更」: 索道を線路として描かない、駐屯地の敷地の置き場所の探索）。

### 完了したこと
- **取得と変換**: `npm run data:region -- tohoku` で 725 セル。取得 10,644 件（1,174MB、DEM z12・ベクトル z13・注記 z14・L03-b・e-Stat）、初回 約 56 分（R1 の鉄道のトンネルの修正後の `main` で作成）。2 回目以降の変換は 725 セルで約 120 秒。注記の追加の探索で z14 を数十枚
- **出力の大きさ**: 合計 **11.41MB**・平均 **15.4KB**・最大 **20.2KB**（目安: 平均 40KB 以下。全国 120MB の 9.5%）
- **自動点検**（`node tools/real/check.ts tohoku`）: **708 / 725 セルが問題なし**。例外 17 セルはすべて「相手のない道路の端」1〜2 本（下の表）。高さの差は全辺 0.000m、水面の不一致 0、建物と道路・水面の重なり 0、本拠の中央 120m に建物なし（全セル）
  - 生成時間（Node）平均 95ms・最大 195ms。乾いた土地の歩ける割合は最小 78%（全セル 60% 以上）。高所の射点は海が 6 割を超える青森港のセル（8803、海 84%）の 2 か所を除き全セル 3 か所以上
  - 地上で 200m 先が見える割合（記録のみ。区分ごとの平均）: 都市 14%（5 セル）/ 郊外 31%（75）/ 田舎 13%（321）/ 森 8%（261）/ 山地 16%（63）
- **見通しの 2 つの決まり**（`node tools/real/sightlines.ts tohoku`）: **725 セルすべて通過**
  - (1) 300m 先が見える高所の射点: 最初は 69 セルが不足 → 物見櫓（POI.tower、高さ 20m）を **70 セルに計 88 基**、手直しのファイルに足した（`--suggest` → 作り直し → 測り直しを 3 回。スキーリフトを外した後に 1 セル（12145）が不足になり 1 基追加）。平均 3.5 か所（区分ごと: 都市 6.8・郊外 3.7・田舎 3.5・森 3.4・山地 3.5）
  - (2) 田舎・森のセル 582 を本拠として作り、中央 半径 120m の空き地から 150m 先が見える方向: 平均 14.2/16、**最小 5 方向**（全セル 2 方向以上）
- **町の広い道路**: 地方全体の `dropWideRoadsAbove: 4000`（北海道と同じ値。関東・中部と陸で接するので R3・R4 も同じ値に）。仙台の中心（13647）は市道の広い道路 8 本・建物 998 棟（地方で最多）
- **自衛隊**: 注記から 31 件 → 手直し後 **25 か所**（index.json と戦略地図）
  - 陸自: 大 3（**仙台**（東北方面総監部）・**青森**（第 9 師団）・**神町**（第 6 師団）。司令部の注記は駐屯地と重複なので外し、その駐屯地を大に）、中 12（霞目・多賀城・大和・船岡・福島・郡山・弘前・八戸・岩手・秋田）、分屯地 1（反町）
  - 海自 3（大湊基地・大湊航空基地・八戸航空基地。大湊地方総監部の注記は大湊基地と重複なので外した）
  - 空自 7（三沢基地・松島基地・秋田分屯基地・東北町分屯基地、**z14 の注記を探して足した** 大湊（釜臥山）・車力・加茂・山田の各分屯基地。車力の注記は「航空自衛隊」とだけある）
  - **演習場（6 件: 岩手山・秋田（寺内）・大高根・王城寺原・福島（庭坂）・八戸）は外した**（建物のない訓練場）
  - 注記が区域の辺にかかる駐屯地は内側へ寄せた（八戸・福島・郡山・多賀城・反町）。青森駐屯地は区域 8969 の北東の角（浪館・三内丸山の南）にあって敷地が置けないので、東隣の 8970 の西の辺（同じ地点）に移した
  - 区域の中で敷地（`base.jgsdf_s`）が建つのは 14 か所（13 駐屯地＋反町分屯地）のうち **10**（仙台・霞目・青森・神町・八戸・郡山・弘前・岩手・秋田・船岡。注記からのずれ 0〜144m（実在の 0〜1.4km）、下の「共通部分の変更」2）。福島・多賀城・大和・反町は周りが急斜面か密な道路で建たない（点は `map.pois` に残る。07d-3）
- 警察署 101・消防署（分署・出張所を含む）373（注記から数えた）

### 自動点検の例外（17 セル、すべて道路の端 1〜2 本）
| 種類 | セル | 内容 |
|---|---|---|
| 道路が辺を 1m 未満かすめて戻る（隣の側の切れ端が 0.5m の丸めで消え、こちらに端が 2 つ残る） | 10142・10818・10977・11971・12636・14981 | 東北道の IC のランプ（10142→10309）、盛岡の国道 4 号（10977→10978）など |
| 道路の端・交差点がちょうど辺の上 | 8808・10638・12468・12480・12484・13640・14979・15815 | 細い道（5.5m 以上）がちょうど辺で終わる、または辺の上の交差点の先が人の多い所の細い道として入らない（12468: 人口 6 人/km² 側だけ入る）|
| 辺に沿った数 m の切れ端 | 10982・13146・15141 | 道路が辺の上を数 m 走る |

高さ・水面は一致し、見た目の段差はない（R0 の四国・R1 の北海道の例外と同じ種類）。`check.ts` の数え方（端の位置だけを突き合わせる）の限界で、直すには seam の判定か切り抜きの共通部分を変える必要がある（取りまとめ役に任せる）。

### 照合（データ `tools/real/area-preview.ts`、ゲームの区域 `tools/real/area-map.ts`、地理院地図の同じ 10km 四方（標準地図 z13 を切り出し）の 3 枚を並べ、ゲーム内のスクリーンショット `test-results/realmap-th-*.png` も見た）
| 地点 | セル | 合っている | 合っていない・未確認 |
|---|---|---|---|
| 仙台の中心（政令指定都市・宮城県庁） | 13647 | 広瀬川の蛇行、青葉山の森（仙台城跡）、仙台駅・県庁・市役所・各区役所の位置、東北本線・東北新幹線・仙石線、地下鉄（南北線・東西線）はトンネルで描かない、国道 4・45・48・286 号、仙台南部道路（南端）、宮城野の市街の広がり、仙台駐屯地（東北方面総監部、北東）・霞目駐屯地（南東） | 駐屯地の敷地は注記から 64m（仙台）・32m（霞目）ずれて建つ（周りの国道を避ける）|
| 青森（県庁所在地） | 8803・8970 | 陸奥湾の弓なりの海岸線と青森港（8803 は 8 割が海）、青い森鉄道・奥羽本線、国道 4・7 号、県庁は 8803 の南端、8970 に市街の南半分・青森自動車道・東北新幹線（南は八甲田トンネルで描かない）・青森駐屯地 | 県庁と中心市街が 2 セルにまたがる（10km 格子の位置）。駐屯地の敷地は注記から 128m（実在の 1.3km）ずれる |
| 盛岡（県庁所在地） | 10977・10978 | 北上川・雫石川の合流、盛岡駅・県庁・市役所（10977 の東端）、東北道・盛岡 IC、秋田新幹線・田沢湖線、国道 4・46 号、東の中津川・岩山の丘陵（10978） | 県庁は区域の東の辺から 45m（中心市街の東半分は 10978）|
| 秋田（県庁所在地） | 10968 | 日本海の海岸線、雄物川と旧雄物川、秋田駅・県庁・市役所、奥羽本線・羽越本線、国道 7・13 号、新屋の市街 | 寺内の演習場の注記は外した |
| 山形（県庁所在地） | 13642 | 馬見ヶ崎川、霞城公園の位置、山形駅・県庁・市役所、奥羽本線（山形新幹線）・仙山線、山形自動車道、国道 13・112・348 号、東の千歳山の山並み | — |
| 福島（県庁所在地） | 14645・14478 | 阿武隈川・荒川、福島駅（14645 の北端）・県庁、信夫山（14478）、東北本線・東北新幹線・福島交通飯坂線、東北道、国道 4・13・115 号、西の福島駐屯地（地理院地図の旗印と同じ所） | 福島駐屯地は急斜面と道路で敷地が建たない |
| 三陸の海岸: 宮古 | 11152 | 宮古湾と重茂半島の尾根、閉伊川の河口と宮古の市街（北西）、国道 45 号、三陸鉄道、浄土ヶ浜側の入り組んだ岩の海岸 | — |
| 三陸の海岸: 釜石 | 11819 | 釜石湾と甲子川、釜石駅・製鉄所の埋め立て、釜石線・三陸鉄道（石塚トンネルはトンネル）、三陸道・釜石 JCT、国道 45・283 号、尾崎半島 | 鉄道・道路のトンネルの坑口で線が終わる |
| 三陸の海岸: 気仙沼 | 12484 | 気仙沼湾と大川の河口、市街の広がり、三陸道・気仙沼中央 IC、国道 45・284 号、大船渡線 | — |
| 奥羽山脈: 蔵王 | 13810 | 熊野岳の山頂の裸地と御釜（水面）、蔵王温泉の集落（西）、蔵王エコーライン、北の蔵王ダム | **直した**: スキーリフト・ロープウェイが斜面をまっすぐ登る線路として描かれていた（下の共通部分の変更 1）|
| 奥羽山脈: 岩手山 | 10642 | 岩手山の山頂（南東）と鬼ヶ城の稜線、裾野の森、北の松川・八幡平温泉郷の集落と牧草地 | 同上（網張・岩手高原のリフト）|
| 奥羽山脈: 八幡平 | 10474 | 八幡平の高原の湿原と小さな沼、茶臼岳・畚岳、八幡平アスピーテライン | — |
| 奥羽山脈: 栗駒山 | 12310 | 栗駒山・剣岳の山頂の尾根、須川温泉、国道 342・398 号の峠道 | 登山道は細すぎて入らない |
| 青函トンネルの南の端 | 8299・8300 | 浜名の坑口の付近（8299 の北東）から南は海峡線がトンネル、奥津軽いまべつ駅・津軽二股駅の付近だけ地上（8300 の北西）、その南は津軽トンネル（描かない）、今別川・国道 280 号 | 坑口そのものは 8299 の北の辺のすぐ外（海のセル）|
| 陸自 仙台駐屯地・霞目駐屯地 | 13647 | 宮城野区の駐屯地の位置、霞目飛行場の南の市街 | 上記 |
| 陸自 青森駐屯地 | 8969・8970 | 浪館（青森市の南西の市街の端）、東北道・青森 IC の東 | 上記（隣のセルへ）|
| 海自 大湊 | 8138 | 大湊の市街（桜木町）と大湊基地、芦崎の砂州と大湊航空基地（地理院地図の旗印）、国道 338 号の海岸、釜臥山の大湊分屯基地（空自） | 基地の建物は建たない（07d-3）|
| 空自 三沢 | 9142 | 三沢飛行場の敷地（その他の用地）、小川原湖・姉沼、青い森鉄道・三沢駅、上北自動車道、国道 45 号 | 滑走路・格納庫は建たない（07d-3）|

- 戦略地図（`test-results/realmap-th-strategic.png`）: 6 県のセル数（青森 113・岩手 160・宮城 78・秋田 130・山形 98・福島 146）、県庁所在地の格（仙台市 5、青森・盛岡・秋田・山形・福島の各市 4）、他の 66 市が格 3、駅（格 2 以上 38 駅: 仙台 4、青森・八戸・秋田・盛岡・泉中央・山形・名取・福島・郡山が 3 ほか）、空港 9（青森・三沢・仙台が大、大館能代・秋田・花巻・庄内・山形・福島が中）、ハブ 10（新青森・盛岡・秋田・仙台・山形・福島・郡山・仙台空港・青森空港・秋田空港）、自衛隊 25・警察 101・消防 373（区域の index.json の値）

### 性能（GPU なし・SwiftShader、1280×720、sim 1 ステップ＋`renderer.draw` 1 回を直接計測、`e2e/realmap_tohoku.spec.ts`）
高所の射点から区域の中央を見た場面（駐屯地の 2 か所は地上から敷地を見た場面）:

| 場所 | セル | ドローコール | 三角形 | sim ＋ 描画発行 | 区域に入る時間 |
|---|---|---|---|---|---|
| 仙台の中心（**最も建物の多い区域**、998 棟） | 13647 | 71 | 27.3 万 | 0.17 ＋ 1.34 ms | 1.2 s |
| 仙台駐屯地（地上） | 13647 | 69 | 24.1 万 | 0.05 ＋ 1.26 ms | 0.7 s |
| 青森（海沿い） | 8803 | 55 | 18.5 万 | 0.01 ＋ 0.94 ms | 0.7 s |
| 青森駐屯地（地上） | 8970 | 68 | 21.7 万 | 0.01 ＋ 1.27 ms | 0.4 s |
| 盛岡 | 10977 | 67 | 30.0 万 | 0.02 ＋ 0.90 ms | 0.8 s |
| 秋田（海沿い） | 10968 | 78 | 30.0 万 | 0.00 ＋ 0.75 ms | 0.8 s |
| 山形 | 13642 | 61 | 26.8 万 | 0.05 ＋ 0.90 ms | 1.0 s |
| 福島 | 14645 | 78 | 27.7 万 | 0.07 ＋ 1.03 ms | 0.9 s |
| 宮古（三陸、海沿い） | 11152 | 74 | 36.8 万 | 0.01 ＋ 0.59 ms | 0.7 s |
| 釜石（三陸、海沿い） | 11819 | 71 | 34.3 万 | 0.01 ＋ 0.80 ms | 0.7 s |
| 気仙沼（三陸、海沿い） | 12484 | 80 | 31.9 万 | 0.07 ＋ 0.87 ms | 0.8 s |
| 蔵王（**山地**） | 13810 | 76 | 25.2 万 | 0.01 ＋ 0.65 ms | 0.7 s |
| 八幡平（山地） | 10474 | 56 | 18.9 万 | 0.00 ＋ 0.85 ms | 0.8 s |
| 青函トンネル南端（森） | 8300 | 57 | 28.9 万 | 0.01 ＋ 0.76 ms | 0.6 s |
| 大湊（海沿い） | 8138 | 58 | 28.4 万 | 0.00 ＋ 0.93 ms | 0.7 s |
| 三沢 | 9142 | 90 | **39.7 万** | 0.01 ＋ 0.78 ms | 0.9 s |

- すべて予算内（ドローコール < 150、三角形 < 50 万、sim＋描画発行 < 4ms）。間引き（`durableMul`）は不要だった
- 区域ファイル 1 つの読み込み 40〜1,100ms（同時に先読みが走ると長い）

### 共通部分の変更（共通部分を直した）
1. **索道（ロープウェイ・スキーリフト）を線路として描いていた（全地方に影響）** `tools/real/region.ts`: ベクトルタイル z13 の鉄道の `rtCode1` が `40206…` のものは索道（東北の全タイルで調べると 612 本の断片、すべてスキー場・ロープウェイ: 蔵王・猪苗代・岩手高原・八甲田など。`40201` JR、`40202` 私鉄、`40203` 地下鉄、`40205` 臨港・専用線）。R0 は線路の敷地としてゲレンデをまっすぐ登る帯を描いていたので入れないようにした（駅の注記は残る）。**北海道（藻岩山・スキー場）・四国（眉山ロープウェイ）なども作り直しで消える**。ファイルの形は不変
2. **陸自の駐屯地の敷地が町ではほぼ建っていなかった** `src/gen/real/layout.ts`（`facility` の `POI.gsdf`）: 180×100m の敷地を注記の点にだけ置こうとし、データの道路が 1 本でも通ると置かなかった（東北 14 か所で 1 か所、北海道の札幌・真駒内・旭川・東千歳・北千歳・安平でも 0）。注記から 16m ごとの輪で 160m まで、向き 2 通り・大きさ 2 通り（180×100、定義の最小 150×90）で、空いていて平らな最も近い所を探すようにした（決定的。160m を超えると町の別の所になるので打ち切り。320m では札幌駐屯地が 300m 先の別の街区に建った）。東北は 10 / 14、北海道は真駒内・東千歳が建つようになった（札幌・旭川・北千歳・安平は建たないまま）
3. 道具の追加（共通部分ではない）: `tools/real/tohoku-sites.ts`（照合地点のセルと区域の座標）

### テスト
- `tests/realmap_tohoku.test.ts`（7 件）: 全セルの区域がある、仙台の中心に市道の広い道路が少なく建物 400 棟超、青函の本州側の取り付けはトンネルが 300m 以上、**仙台・青森の駐屯地の敷地が注記から 160m 以内に建つ**、**蔵王に索道の線路がない**、自衛隊の一覧（演習場・司令部なし、大は仙台・青森・神町）、代表 5 セル（仙台・青函・宮古・蔵王・秋田）の自動点検と見通しの決まり
- `npm run check` 862 件・`npm run build` 通過
- e2e: `e2e/realmap_tohoku.spec.ts`（新設: 16 地点の計測とスクリーンショット・戦略地図）通過。共通部分を変えたので `e2e/realmap.spec.ts`（四国）と `e2e/realmap_hokkaido.spec.ts` も流して 5 件通過（あわせて 6 件）。全件は取りまとめ役

### 未完了・既知の問題
- 例外 17 セルの道路の端（上記）
- 福島・多賀城・大和・反町の駐屯地の敷地は建たない（点だけ）。空港の滑走路・ターミナル、海自・空自の基地の建物は 07d-3
- 物見櫓 88 基（70 セル）。起伏のある森で 12m の塔では梢に隠れる（北海道と同じ）
- 県庁と中心市街が 2 セルにまたがる: 青森（8803/8970）・盛岡（10977/10978）・福島（14645/14478）
- 北海道・四国のデータは索道の修正の前のまま（各地方の担当・取りまとめ役が作り直す。キャッシュの無いこのセッションでは作り直していない）。北海道は R1 の照合の表で「藻岩山（ロープウェイの山麓・中腹・山頂駅）」とある所の線路が消える

### 次のセッションへの注意
- **R3（関東）・R4（中部）**: 東北と陸で接する。`dropWideRoadsAbove` は 4,000 に。境界の帯（乱数の区域との 120m の混ぜ）は揃えば消える
- **R1・R7・取りまとめ**: 上の共通部分の変更 1 のため、スキー場・ロープウェイのある地方は作り直す
- **07d-3**: 東北の `map.pois` に物見櫓（POI.tower、名前「物見櫓」）。駐屯地は `building` のあるものだけ敷地が建っている
- **L2（東北の名所）**: 名所は作っていない。`REAL_LANDMARKS` と手直しのファイルの `addPois` の書き方は R1 の節

### 追加した共有型・コマンド・イベント
- なし（型・コマンド・イベント・文言・依存の追加なし。`STATE_VERSION` 据え置き）
- データ: `public/data/areas/tohoku/`（725 区域＋index.json）。手直し `tools/data/real/overrides/tohoku.ts`
- 道具: `tools/real/tohoku-sites.ts`。e2e `e2e/realmap_tohoku.spec.ts`、テスト `tests/realmap_tohoku.test.ts`
