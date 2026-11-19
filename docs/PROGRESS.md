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
