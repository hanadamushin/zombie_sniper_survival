# 04. アーキテクチャ

## 1. 技術選定

| 項目 | 採用 | 理由 |
|---|---|---|
| 言語 | TypeScript（strict） | セッション間の契約を型で固定できる |
| ビルド | Vite | 設定が少なく高速。静的ホスティング可 |
| 3D | Three.js | 一人称・長距離描画・InstancedMesh。物理エンジンは使わない |
| UI | Preact + CSS（DOMオーバーレイ） | 管理画面が多いので宣言的UIが有利。軽量 |
| 戦略地図 | Canvas 2D | 約3,800セルの塗り分け |
| テスト | Vitest（ロジック）、Playwright（起動スモーク） | シミュレーションをヘッドレスで検証 |
| 音 | Web Audio API による合成 | 外部アセット不要 |
| 保存 | IndexedDB | 容量と非同期性 |
| 配布 | 静的ファイル（GitHub Pages 想定、`base` は相対） | サーバ不要 |

**外部アセット（モデル・テクスチャ・音声ファイル）は使わない。** すべてコードで生成する（ローポリ＋頂点カラー＋フォグ）。
地図データのみビルド時スクリプトで生成し `public/data/` に置く。

## 2. 最重要の設計原則

1. **シミュレーションと描画の分離**
   `src/sim/**` は Three.js・DOM・`window` に一切依存しない純粋な TypeScript。`GameState` を受け取り更新するだけ。
   描画（`src/render/**`）と UI（`src/ui/**`）は `GameState` を **読むだけ**。変更は必ずコマンド経由。
2. **単一の直列化可能な状態** — `GameState` は JSON 化できるプレーンオブジェクト（クラスインスタンス・Map・循環参照を入れない）
3. **決定性** — 乱数は `state.rng` 由来のシード付き PRNG のみ。`Math.random()` と `Date.now()` は sim 内で禁止
4. **データ駆動** — 建物・技術・ゾンビ・武器・特性・バランス値は `src/data/**` の定義テーブル。ロジックに数値を直書きしない
5. **疎結合** — システム間は型付きイベントバスとコマンドでやり取りし、他システムの内部関数を直接呼ばない

## 3. ディレクトリ

```
/
├─ index.html
├─ package.json / tsconfig.json / vite.config.ts
├─ public/data/            # 生成済み地図・感染データ（コミットする）
├─ tools/                  # ビルド時スクリプト（Node 22.18+ の型ストリップで直接実行。`npm run data`）
│   ├─ build-data.ts       #   `npm run data` の入口（下の2つを呼ぶ）
│   ├─ build-grid.ts       #   日本グリッド生成
│   ├─ run-infection.ts    #   感染シミュレーション事前計算
│   ├─ preview.ts          #   検証用 PNG（`node tools/preview.ts <dir>`）
│   ├─ tactical-preview.ts #   戦術マップを上から見た PNG（`node tools/tactical-preview.ts <dir> [seed]`）
│   └─ data/               #   都市表・山脈表・交通ハブ表（手書き）
├─ src/
│   ├─ main.ts             # 起動、ゲームループ
│   ├─ core/               # 型、イベントバス、コマンド、PRNG、時間、セーブ
│   │   ├─ types.ts        #   GameState ほか全共有型（契約の中心）
│   │   ├─ events.ts
│   │   ├─ commands.ts
│   │   ├─ rng.ts
│   │   ├─ time.ts         #   時刻の純関数（daylight, addMinutes, effectiveSpeed…）
│   │   ├─ loop.ts         #   固定ステップのアキュムレータ
│   │   └─ save.ts         #   唯一 IndexedDB に触れてよい core ファイル
│   ├─ data/               # 定義テーブル（balance, tactical, render, buildings, techs, zombies, weapons, traits, jobs, resources）
│   ├─ sim/                # 純ロジック（ヘッドレス実行可）
│   │   ├─ index.ts        #   createSim() / tick(state, dt, input) — 各システムを決まった順で呼ぶ
│   │   ├─ system.ts       #   System インターフェース（step/minute/hour/day フックとコマンドハンドラ）
│   │   ├─ time.ts         #   時計を進める。setSpeed / setMode を担当
│   │   ├─ world/          #   感染、セル、移動、駐屯地、補給
│   │   ├─ tactical/       #   プレイヤー、弾道、ゾンビAI、フローフィールド、死体・耳
│   │   ├─ colony/         #   生存者、仕事、経済、遠征、士気
│   │   ├─ build/          #   設計図、建設、耐久、堀、襲来
│   │   └─ research/       #   技術、時代、勝利条件
│   ├─ gen/                # シードからの戦術マップ生成（sim からも render からも使う純関数）。index.ts が入口、types.ts に TacticalMap
│   ├─ render/             # Three.js（地形、建物、ゾンビ、生存者、スコープ、空）
│   ├─ ui/                 # Preact（HUD、指揮パネル、戦略地図、メニュー）
│   ├─ input/              # キーボード・マウス（のちにタッチ）→ コマンド/入力状態
│   └─ audio/
├─ tests/                  # Vitest。sim と gen と tools を対象
└─ e2e/                    # Playwright スモーク（`npm run e2e`）
```

## 4. ゲームループ

```ts
// main.ts（概略）
const FIXED = 1 / 60;
loop(realDt) {
  input.poll();                         // 入力状態を更新、UI操作はコマンドとしてキューへ
  acc += realDt * state.time.speed;     // speed: 0 | 1 | 3 | 10
  while (acc >= FIXED) { sim.tick(state, FIXED, inputFrame); acc -= FIXED; }
  render.draw(state, alpha);            // 補間描画
  ui.sync(state);                       // 低頻度（10Hz）で反映
}
```

実装は `core/loop.ts` の `createStepper`。実時間 dt は 0.1 秒に丸め（タブ復帰時の巨大 dt 対策）、1フレームの最大ステップ数も制限する。
1フレームに複数ステップ回るとき、視点差分などの単発入力は最初のステップだけに渡す（`continuationFrame`）。
`mode === 'menu'` の間は速度 0 として扱う（`effectiveSpeed`）。一時停止中でもコマンドが効くよう、毎フレーム `sim.applyCommands(state)` を呼ぶ。
`tick` 自体は `state.time.speed` を見ず、渡された dt だけ必ず進む（速度はループ側の責務。ヘッドレスのボットは `tick` を直接回せばよい）。

`sim.tick` の中での順序（固定）:

1. コマンド適用
2. 時間進行（分・時・日の境界イベントを発火）
3. 戦術（プレイヤー → 弾 → ゾンビ → 死体）— 毎ステップ
4. 建築・襲来（耐久、フローフィールド更新要求）— 毎ステップ（重い処理は境界時のみ）
5. コロニー（生存者の行動、経済）— ゲーム内1分ごと
6. 研究 — ゲーム内1時間ごと
7. 世界（感染、補給、遠征の解決）— ゲーム内1日ごと（遠征は1時間ごと）
8. イベントのフラッシュ

x10 速度では戦術ステップをまとめて簡略処理してよい（プレイヤーが拠点内にいる前提）。x10 は指揮層・戦略層のみ（戦術層では x3 に丸める）。

### システムの差し込み方

各領域は `sim/<領域>/index.ts` で `System` を1つ export する（`sim/system.ts`）。`sim/index.ts` の `SYSTEMS` 配列の順に呼ばれる。

```ts
export interface System {
  id: string;
  commands?: { [K in Command['type']]?: (state, cmd, ctx) => void };  // 担当コマンド（1種類につき担当は1システム）
  step?(state, ctx): void;    // 毎ステップ
  minute?(state, ctx): void;  // ゲーム内1分の境界
  hour?(state, ctx): void;    // ゲーム内1時間の境界
  day?(state, ctx): void;     // 日付が変わったとき（00:00）
}
// ctx: { dt, input, emit(event), prevEvents, grid, warn }
```

1 tick 内では「全システムの step → minute → hour → day」の順。ハンドラのないコマンドは警告ログを1回出して無視する。

## 5. 状態スキーマ（契約）

`src/core/types.ts` に置く。**基盤セッションがこのとおりに定義し、以降のセッションは追加のみ可**（既存フィールドの改名・削除は PROGRESS.md に記録して全体を直すこと）。

```ts
export type CellId = number;          // gy * gridW + gx
export type EntityId = number;        // state.nextId から採番
export type ResourceId = 'ears'|'food'|'ammo'|'wood'|'metal'|'cement'|'parts'|'medicine'|'fuel';
export type JobId = 'idle'|'farming'|'defense'|'scavenging'|'construction'|'research'|'crafting'|'medical';
export type Land = 'urban'|'suburb'|'rural'|'forest'|'mountain';
export type ZombieKind = 'walker'|'runner'|'brute'|'crawler';
export type TechCategory = 'F'|'W'|'A'|'S'|'C';

export interface GameState {
  version: number;
  seed: number;
  rng: { s: [number, number, number, number] };
  rngStreams: Record<string, { s: [number, number, number, number] }>;  // 用途別の永続系列（rng.ts の stream(state, label)）
  nextId: EntityId;
  difficulty: 0 | 1 | 2;
  time: { day: number; minute: number; sub: number; speed: 0 | 1 | 3 | 10 };   // minute: 整数 0..1439、sub: 分の端数 [0,1)
  mode: 'tactical' | 'command' | 'world' | 'menu';
  world: WorldState;
  player: PlayerState;
  tactical: TacticalState | null;     // 現在いるセルの作戦区域（保存時は差分のみ）
  colony: ColonyState;
  build: BuildState;                  // 本拠の建築物
  research: ResearchState;
  flags: Record<string, boolean | number>;   // チュートリアル・勝利など
}

export interface WorldState {
  scenario: number;                   // 同梱感染シナリオ番号
  gridW: number; gridH: number;
  cells: {                            // 構造体配列（長さ = gridW*gridH、海は Z=-1）
    S: number[]; Z: number[]; H: number[]; loot: number[];
    visited: boolean[]; intel: number[];      // intel: 0 不明 / 1 概数 / 2 詳細
  };
  homeCell: CellId | null;
  outposts: Outpost[];
  expeditions: Expedition[];
  travel: { from: CellId; to: CellId; path: CellId[]; progress: number } | null;
  hordeMeter: number;
  pendingHorde: { arrivesDay: number; arrivesMinute: number; size: number; dir: number } | null;
}
// セルの静的データ（pop0, land, lat/lon, region…）は state に入れず、
// public/data/grid.json から読み込んだ StaticGrid を別途参照する。
// sim へは createSim({ grid }) / sim.setGrid(grid) で渡し、システムは ctx.grid で読む。
// StaticGrid = { gridW, gridH, cellKm, proj, cells: (StaticCell|null)[], landIds, hubs: Hub[], prefNames, regionNames, places }
// 読み込みは src/worldData.ts（fetch）→ sim/world/grid.ts の parseGrid。同梱シナリオは sim/world/scenario.ts。

export interface PlayerState {
  cell: CellId;
  pos: [number, number, number]; yaw: number; pitch: number;   // pos は足元。x 東 / y 上 / z 南、ヨー 0 = 北(−z)
  vel: [number, number, number]; eye: number;                 // 03 が追加（速度、現在の目の高さ）
  stance: 'stand' | 'crouch' | 'prone';
  hp: number; stamina: number; winded: boolean; breath: number;   // winded: スタミナ切れ（03 が追加）
  infectedUntil: { day: number; minute: number } | null;
  weapon: { id: string; mag: number; zeroIdx: number; zoom: number; boltT: number; reloadT: number };
  scoped: boolean;
  inv: Partial<Record<ResourceId, number>>;   // 所持（耳・弾・医薬品など）
  stats: { kills: number; headshots: number; shots: number; earsCollected: number };
  aim: AimState;   // 04 が追加（STATE_VERSION 3）: scopeT, 揺れ, 反動, off（視界のずれ [yaw, pitch]）, 息, ナイフ・耳回収・落下・死亡のタイマ
}

export interface TacticalState {
  cell: CellId; mapSeed: number;
  zombies: Zombie[];                  // 上限 150
  corpses: Corpse[];                  // 上限 200
  bullets: Bullet[];
  reserve: number;                    // このセッションで補充可能な残数の目安
  wind: [number, number];
  lootSpots: { id: number; pos: [number, number]; taken: boolean }[];
  populated?: boolean; spawnT?: number; step?: number; rangeT?: number[];   // 04 が追加（初期配置済みか、補充タイマ、ステップ数、射撃場）
}
// 04 は Zombie（移動・知覚の作業用フィールド、dummy）、Corpse（kind, yaw, headshot, crippled）、
// Bullet（dist, drag, gravity, weapon, pierceFactor, maxRange, lastHit）にもフィールドを足した。定義は core/types.ts
export interface Zombie { id: EntityId; kind: ZombieKind; pos: [number,number,number]; yaw: number;
  hp: number; state: 'wander'|'alert'|'chase'|'attack'|'down'; target: EntityId | 'player' | null;
  crippled: boolean; t: number; }
export interface Corpse { id: EntityId; pos: [number,number,number]; ears: number; expiresDay: number; expiresMinute: number; }
export interface Bullet { id: EntityId; pos: [number,number,number]; vel: [number,number,number]; pierceLeft: number; dmgMul: number; life: number; }

export interface ColonyState {
  stock: Record<ResourceId, number>;
  capacity: Record<ResourceId, number>;
  survivors: Survivor[];
  candidates: Survivor[];             // 雇用候補
  foodPrice: number;
  ledger: { day: number; income: number; wages: number; food: number; other: number }[]; // 直近30日
  log: { day: number; minute: number; kind: string; text: string }[];                     // 直近200件
}
export interface Survivor {
  id: EntityId; name: string;
  ath: number; kno: number; spd: number; sta: number;   // 1..10
  wage: number; trait: string;
  job: JobId; morale: number; hp: number;
  status: 'ok' | 'injured' | 'infected' | 'away' | 'dead';
  weapon: string;                      // weapons.ts の id
  location: { kind: 'home' } | { kind: 'outpost'; id: EntityId } | { kind: 'expedition'; id: EntityId };
  // 拠点内での描画・行動用（home のときのみ有効）
  pos: [number, number]; task: { kind: string; target: EntityId | null; t: number } | null;
  unpaidDays: number; lowMoraleDays: number;
}

export interface BuildState {
  structures: Structure[];            // 壁・堀・門・塔・建物すべて
  gridRev: number;                    // 通行グリッドが変わるたびに +1（フローフィールド再計算の合図）
}
export interface Structure {
  id: EntityId; def: string;          // buildings.ts の id
  tx: number; ty: number; rot: 0|1|2|3;        // 4m タイル座標
  hp: number; progress: number;       // progress < 1 は建設中（設計図）
  delivered: Partial<Record<ResourceId, number>>;
  corpsesInMoat?: number;
  level: number; priority: 0|1|2;
}

export interface ResearchState {
  era: 0 | 1 | 2 | 3;
  done: string[];                     // 取得済みノードID
  locked: string[];                   // 排他分岐で取得不可になったID
  active: Partial<Record<TechCategory, { id: string; rp: number }>>;
  allocation: Record<TechCategory, number>;   // 合計 100
}

export interface Outpost { id: EntityId; cell: CellId; tier: 1|2|3; ammo: number; garrison: EntityId[]; defense: number; }
export interface Expedition { id: EntityId; members: EntityId[]; target: CellId; from: CellId;
  weapon: string; departDay: number; departMinute: number; returnDay: number; returnMinute: number; resolved: boolean; }
```

05 が追加（STATE_VERSION 4）:
- `ColonyState.market{food}`（農家の売り物）、`work{build, research, craft, medical}`（消費待ちの作業ポイント）、`policy{autoBuyFood}`、`villageBought`、`lastMinute`（共同体が処理済みの絶対分）、`memorial[]`、`metCells`
- `ledger[]` は `LedgerDay`（`flow?: 資源 → [入, 出]` を追加）、`log[]` は `LogEntry`（`text` は `ui/i18n/ja.ts` のキー、`params` が埋め込み値。sim は日本語を組み立てない）
- `Survivor.meals / missed / infectedUntil`、候補のみ `fromCell / waitsUntilDay`。死者は `survivors` から外して `memorial` へ（`status: 'dead'` の要素は残らない）
- `TacticalState.hideouts[]`（探索ポイントに潜む人）
- `flags.skipMinutes`（`sim/index.ts` がその分数だけ minute / hour / day フックを回して時間を飛ばす）、`flags.defeat`

06 が追加（STATE_VERSION 5）:
- `BuildState.raid`（進行中の襲来 `RaidState{kind, dir, size, toSpawn, killed, startedAbs, waveT}`）、`pendingEars`（翌朝回収する死体の数）、`lastRaid`（直近の襲来の要約 `RaidReport`）
- `Structure.ruinUntil`（破壊後、瓦礫として残る期限の絶対分。`hp` は 0）、`wear`（イベントを間引くための端数）
- `Outpost.foundedDay / convoy{day, ammo}`、`WorldState.travel.fast`、`pendingHorde.warned`、`Zombie.raid / moatT`（保存されない）
- `StaticGrid.seaLinks[]`（`SeaLink{name, a, b, minutes}`。`grid.json` の `sea`）
- `flags.colonyAlarm`（襲来中）、`flags.skipping`（`skipMinutes` の消化中。襲来は数値で解決）、`flags.unlockAll`（デバッグ: 全解禁）
- セーブ時、マップ上の襲来個体は `raid.toSpawn` に戻して保存する（`packState`）

07 が追加（STATE_VERSION は 5 のまま。どれも省略可能なフィールド）:
- `ResearchState.progress`（進行中でないノードに注いだ RP）、`ResearchState.victory{day, minute, tech}`（建国宣言の記録）
- `Bullet.torsoMul`、`BuildingDef.techAny / mods / flags`、`WeaponDef.torsoMul / ammoPerShot`
- `flags.endingSeen`（エンディングを閉じた）、`flags.lostTotal`（失った生存者の累計）
- 削除: `BUILD.unlockAllUntilTech`・`BUILD.radiusTech`・`BUILD.moatWorkF4a` ほか技術別の定数、`BUILD.raid.hordeMax` は配列から単一値（150）へ、`BALANCE.combat.swayDifficulty`、`WEAPON_MODS` と `weaponDef()`。いずれも修飾（`getMod`）に置き換えた

### 研究・修飾（`sim/research/`、07）

- `data/techs.ts`: 全 56 ノード（`TECHS` / `TECH_LIST`）、修飾キーの一覧 `MOD_KEYS`、フラグの一覧 `FLAGS`（どこで読むかを併記）、挙動系の数値 `RESEARCH`、難易度の修飾 `DIFFICULTY_MODS`、`locksOf(id)`
- `modifiers.ts`: `getMod(state, key, base)` / `hasFlag(state, flag)` / `techDone` / `techAvailable` / `modTable`（キャッシュ）/ `invalidateMods`。**sim のどこからでも import してよい**（data と型にしか依存しない）
- `index.ts`: `researchSystem`（`hour`: RP の配分と完了・勝利判定、`day`: 日次の効果）、`startResearch` / `setAllocation` / `completeTech` / `grantTech`（デバッグ・テスト用。前提ごと付与）/ `techStatus` / `startError` / `researchPerDay` / `daysLeft`
- `effects.ts`（日次の効果）、`victory.ts`（`victoryProgress` / `checkVictory` / `endingStats` / `debugFulfilVictory`）、`forecast.ts`（`forecastInfection`: 世界セルのコピーに `stepInfection` を 7 日ぶん。乱数は `fork` した系列で本番の系列を進めない。日ごとにキャッシュ）
- 数値を技術で変えたいとき: `MOD_KEYS` にキーを足す → ノードの `effects` に `mul` / `add` を書く → 読む側を `getMod(state, 'キー', 元の値)` にする。整合性テストが「誰も設定していないキー」「一覧にないキー」を落とす
- `sim/tactical/observe.ts`: スコープが指しているゾンビと距離・必要な見越し（測距と観察記録の HUD 用）

### 建築・防衛（`sim/build/`、06）

- `structures.ts`: 定義の参照（`defOf`）、解禁判定 `isUnlocked` / `techUnlocked`（**ここ 1 か所**）、タイルごとの **オーバーレイ**（`overlayOf(state, walk)`: 占有 `occ`、ゾンビが相手にする構造物 `sidx`、フローコスト `cost`、ゾンビだけを止める障壁 `zblock`、生存者の通行不可 `sblock`、有刺鉄線 `wire`、壁のつながり `links`。`gridRev` と警報の状態でキャッシュ）、当たり判定の同期（`syncSolids` / `syncMap`: 本拠マップの `map.solids` / `map.ladders` / `map.hash` の末尾に構造物ぶんを足し引きする。03 の衝突関数はそのまま使える）、`damageStructure` / `destroyStructure`（司令部なら `flags.defeat`）、建物の効果（`bedsTotal`, `plotInfo`, `jobFacility`, `moraleBonus`, `foodSaving`, `refreshCapacity`）
- `blueprints.ts`: `placementError`（配置可否の理由）、`placeBlueprint`, `cancelStructure`（取消・解体）、`setPriority`, `foundBase`（司令部と最初の農地。`beginAt` と毎分のフックから呼ばれ、冪等）、`buildNow`（デバッグ・テスト用）
- `construction.ts`: `construct(c, points)`。共同体の時計から毎時呼ばれる（`colony/index.ts`）。資材は `moveStock` 経由
- `flowfield.ts`: `computeField(cost, goals)`（Dial 法）、`raidField(state, map|null)`（`gridRev` でキャッシュ）、`chaseField(state, map)`
- `raids.ts`: `raidMinute`（発生・警告・到着・夜間接近・朝の耳回収）、`raidStep`（波状投入と終了判定）、`resolveAway`（不在時の数値戦闘）、`breachRoute`、`playerPresent`
- `defense.ts`: `updateDefenders`（射撃と、屋外の生存者への噛みつき）、`guardPosts`, `standHeight`, `defenderWeapon`
- ゾンビ側の接続は `sim/tactical/zombies.ts`: `followField`（次のタイルが構造物なら近づいて攻撃、堀なら縁から落ちる）、`barrierPush`（箱を持たない障壁からの押し戻し）、`killZombie(..., by)`。`Zombie.target` は攻撃中の構造物の id を持つ
- 駐屯地は `sim/world/outposts.ts`（設置・拡張・常駐・日次の襲来と補給・補充・プレハブの配置）。コマンドは world システムが担当
- 指揮層の視点とカーソルは `core/view.ts` の `commandView`（`GameState` の外。UI が書き、描画が読む）

### 共同体（`sim/colony/`、05）

- 時計: 共同体は `colony.lastMinute` を持ち、`minute` フックで現在時刻まで **1 分ずつ追いつく**。速度・ステップ幅・プレイヤーの所在に結果が依存しない。1 分の処理順は `colonyMinute`（日次 → 納品 → 毎時 → 食事 → 賃金 → 作業 → 製造 → 遠征 → 感染）
- 備蓄の変更は必ず `stock.ts` の `moveEars` / `moveStock` を通す（台帳と一致させるため）。ログは `logEntry`
- 他セッション向けの口（`jobs.ts`）: `distributeBuildWork(state, points, workOf?)`、`takeResearchPoints(state)`、`defenders(state)`、`farmPlots` / `housingBeds` / `facilityFactor`（`COLONY.facilities` の def id を `BuildState` から数える）
- 拠点内の移動は `ai.ts`（見た目のみ。プレイヤーが本拠セルにいる間だけ動く）。仮の配置は `COLONY.camp`
- プレイヤーの死: `tactical/combat.ts` は `deadT` を `DEATH_HOLD` で止めるだけ。`colony/morale.ts` の `updatePlayerDeath` が復帰か敗北を決める

### 乱数（`core/rng.ts`）

xoshiro128**。状態はプレーンオブジェクトで、関数に渡して使う: `rand(r)`, `randRange`, `randInt(r, lo, hi)`（両端含む）, `chance`, `pick`, `gauss`。

- `stream(state, 'colony.hire')` — 用途別の永続系列（`state.rngStreams` に保存）。**システム内ではこれを使う**（他システムの乱数消費に影響されない）
- `fork(parent, label)` — 親を進めずに派生系列を作る純関数。`gen/` で `fork(seedRng(mapSeed), 'trees')` のように使う
- `state.rng` — 主系列。順序に意味のある少数の用途のみ

## 6. コマンドとイベント

**コマンド**（UI・入力 → sim）: 判別共用体 `Command`。`dispatch(cmd)` でキューに積み、次の tick 冒頭で適用。
例: `{type:'assignJob', survivor, job}`, `{type:'placeBlueprint', def, tx, ty, rot}`, `{type:'cancelStructure', id}`,
`{type:'hire', candidate}`, `{type:'dismiss', survivor}`, `{type:'startResearch', id}`, `{type:'setAllocation', allocation}`, `{type:'dismissEnding'}`（07）,
`{type:'sendExpedition', members, target, weapon}`, `{type:'foundOutpost', cell}`, `{type:'travel', to}`,
`{type:'setSpeed', speed}`, `{type:'buyFood', amount, source}`, `{type:'resupply'}`, `{type:'setMode', mode}`

プレイヤーのリアルタイム操作（移動・視点・射撃）はコマンドではなく、毎ステップ渡す `InputFrame`:
```ts
export interface InputFrame { moveX: number; moveZ: number; lookDX: number; lookDY: number;
  fire: boolean; scope: boolean; holdBreath: boolean; sprint: boolean; reload: boolean;
  stance: 'stand'|'crouch'|'prone'|null; zoomDelta: number; zeroDelta: number; knife: boolean; interact: boolean;
  interactHeld: boolean; }   // interactHeld: E を押している間 true（04 が追加。耳の回収は長押し）
```

**イベント**（sim → render/ui/audio、および sim 内の他システム）: 判別共用体 `GameEvent`。
例: `shotFired`, `bulletHit{zombie, part, pos}`, `zombieKilled{id, kind, by, headshot}`, `earsCollected{amount}`,
`playerHurt`, `playerDied`, `structureDamaged`, `structureDestroyed`, `structureBuilt`, `moatBridged`,
`hordeWarning`, `hordeArrived`, `survivorHired`, `survivorDied`, `survivorLeft`, `expeditionReturned`,
`techCompleted`, `eraAdvanced`, `dayStarted`, `hourStarted`, `wagesPaid`, `outpostFounded`, `outpostLost`, `victory`, `defeat`

基盤が追加したイベント: `speedChanged{speed}`, `modeChanged{mode, prev}`, `commandRejected{command, reason}`。
02 が追加したイベント: `travelStarted{from, to, minutes}`, `cellEntered{cell, from}`, `travelArrived{cell}`, `travelEncounter{cell, danger}`（枠のみ）, `infectionStepped{day, homeInflow}`。
04 が追加したイベント: `dryFire`, `reloadStarted{seconds}`, `reloadDone{mag}`, `knifeSwing{hit, killed}`, `playerInfected{untilDay, untilMinute}`, `playerRevived`, `zombieAlerted{id, chase}`。`bulletHit` に `surface`（ゾンビ以外に当たったときの種類）・`dir`・`range`・`killed`、`zombieKilled` に `knife`、`playerHurt` / `playerDied` に `cause`、`shotFired` に `scoped` を追加。
05 が追加: コマンド `setPolicy{autoBuyFood}`（`resupply` は colony システムが担当）。イベント `candidateFound{id, cell, by}`, `spotSearched{spot, items}`, `expeditionSent`, `earsDeposited{amount}`, `resupplied{ammo}`, `foodBought{amount, cost, source}`, `colonyLog{kind, text}`。`defeat{reason:'noColony'}` と `playerRevived` は共同体が発火。
06 が追加: コマンド `setStructurePriority{id, priority}`, `upgradeOutpost{id}`, `assignGarrison{survivor, outpost|null}`、`travel` に `fast?`。`placeBlueprint` / `cancelStructure` / `setStructurePriority` は build、`foundOutpost` / `upgradeOutpost` / `assignGarrison` は world、`resupply` は colony（本拠でなければ駐屯地から）。イベント `blueprintPlaced`, `structureRemoved`, `raidStarted{kind, size, dir, away}`, `raidEnded{kind, killed, repelled, away}`, `defenderFired{id, pos, target, hit}`, `survivorHurt`, `outpostUpgraded`, `outpostSupplied`。`structureDamaged`（耐久の 1/20 ごと）, `structureDestroyed`, `structureBuilt`, `moatBridged`, `hordeWarning`, `hordeArrived`, `outpostFounded`, `outpostLost`, `defeat{reason:'hqDestroyed'}` を発火。`zombieKilled.by` は防衛担当か構造物（有刺鉄線・堀）の id になり得る。
07 が追加: コマンド `dismissEnding`、`startResearch` / `setAllocation` を実装（research システム）。イベント `techCompleted{id}`, `eraAdvanced{era}`, `victory{tech}` を発火。`candidateFound.by` に `'radio'`。拒否理由 `unknownTech` / `techDone` / `techLocked` / `techEra` / `techPrereq` / `badAllocation` / `popCap`、`assignJob` の `locked`。
`dayStarted` は 00:00 に、同じ tick の `hourStarted{hour:0}` より先に発火する。

イベントは tick 中にバッファされ、tick 末に購読者へ配信（`sim.events.on(type, fn)` / `onAny`）。sim 内システムが他システムのイベントを見る場合は「次の tick で処理」と決め、`ctx.prevEvents`（直前の tick で出たイベント）を読む。
`prevEvents` とコマンドキューは `GameState` の外にあり保存されない。セーブをまたいで必要な事実は必ず `GameState` に持つこと。

### 描画・UI・入力の入口

- `render/index.ts`: 組み込みは `camera` → `sky` → `tactical-world` の順（M0 の仮地面は撤去済み）。追加は `renderer.register(subRenderer)`。`SubRenderer { id, init(ctx), update(state, frame), reset?(state), resize?, dispose? }`。登録順に毎フレーム `update` され、最後に1回だけ描画。新規ゲーム・ロードで state が差し替わると `reset` が呼ばれる。FOV は `renderer.view.setFov()`
- `ui/`: `ui.sync(state)` で 10Hz 再描画（モード・速度変更時は即時）。モードごとの枠は `ui/components/modes.tsx`。UI からの操作は `UiActions`（`dispatch` ほか）経由
- `input/`: `poll()` が `InputFrame` を返し、最初のステップが消費したら `consume()`。キー割り当ては `input/bindings.ts`。ポインタロックは tactical のみ。矢印キーの照準は `poll()` の中で経過時間から `lookDX / lookDY`（マウスと同じピクセル相当）に変換する（07b、速さは `data/input.ts`）。`InputFrame` の形は変えていない
- セーブ: `core/save.ts`。`packState` が保存対象を絞る（戦術の zombies/corpses/bullets は捨てる、menu モードは command として保存）。形を変えたら `STATE_VERSION` を上げ `MIGRATIONS` に追加

## 7. 戦術マップと当たり判定

- 作戦区域: 1024m × 1024m、ハイトマップ 257×257（4m 間隔）。`gen/` の `generateTacticalMap({ mapSeed, land, isHome, lootSpots })` が決定的に生成:
  地形、道路、建物（軸平行の箱）、外階段・はしご・鉄塔、樹木、草むら、岩、探索ポイント、高所の射点、開始位置、4m 通行グリッド。本拠セルでは中央 半径120m を平坦化して空ける
- **座標系**: x = 東、z = 南、y = 上（m）。プレイ範囲は `[0, 1024]²`、北は −z。ハイトマップの標本 (ix, iz) は (4·ix, 4·iz)、タイル (tx, ty) は `[4tx, 4tx+4) × [4ty, 4ty+4)`。ヨー 0 は北向きで、正のヨーは左（西）へ回る。前方ベクトルは `(−sin yaw·cos pitch, sin pitch, −cos yaw·cos pitch)`
- **`TacticalMap` は `GameState` に入れない**（セーブしない）。`mapSeed = mapSeedFor(state.seed, cell)` から再生成してメモリに持つ。
  置き場所は `sim/tactical/area.ts`: `ensureArea(state, grid)` が `state.tactical`（§5 のフィールドのみ）とマップを現在セルに合わせ、`mapOf(state)` / `areaOf(state)` で sim・render・UI が参照する
  - 生成の契機は状態から判定: 移動中は `state.tactical = null`、移動していなくて区域がなければ作る（開始直後・到着時）、区域はあるがマップがなければ `tactical.mapSeed` から作り直す（ロード後。`lootSpots[].taken` は保存値を重ねる）。通過するだけのセルでは作らない
  - 生成は 1 回 50〜80ms（07b 以降 rural・forest は 75〜110ms）。メインループは `areaPending()` の間ロード表示を 2 フレーム出してから `ensureArea()` を呼ぶ（ヘッドレスでは次の tick が同じことをする）
- 地形の高さは描画メッシュと同じ三角形分割で補間する（`gen/height.ts`。各 4m 升を (ix, iz+1)–(ix+1, iz) の対角で分割）
- 当たり判定の実体は `TacticalMap.solids`（AABB: 建物・階段の段・鉄塔の床と脚・岩）と樹木の幹（円柱）。16m の静的ハッシュ `map.hash` に登録済み。建物の箱は床面より 6m 下まで伸びている（斜面との隙間を塞ぐ）
- 共通関数（`sim/tactical/collision.ts`。04・06 はこれを使う）:
  - `heightAt(map, x, z)`、`isWalkable(map, tx, ty)`、`gradientAt`
  - `raycastWorld(map, origin, dir, maxDist)` → `{ dist, pos, normal, kind: 'terrain'|'building'|'stair'|'rock'|'prop'|'tree', index }`。樹木は幹（高さの 55% まで）だけが弾と視線を遮る
  - `segmentHitsStatic(map, a, b)`（弾の線分。固いものだけ）
  - `sightBlocked(map, a, b)`（07b: 目と目の間の視線。上に加えて `map.brush` ＝生け垣・藪・葦・竹やぶで切れる。ゾンビの視認はこれを使う）、`brushBetween`。割合の計測は `sim/tactical/sight.ts` の `openSightShare`
  - `supportAt(map, x, z, feetY)`（立てる高さ: 地形か、足元から 0.5m 以内の箱の上面）、`pushOut(map, [x, z], radius, feetY, height)`（壁と幹からの押し戻し）、`ladderAt`
  - `createSpatialHash()` — 動的オブジェクト用の 16m ハッシュ（`set / remove / query / querySegment`）。現在の区域のものは `areaOf(state).dynamic`
- 戦術ステップの順序（`sim/tactical/index.ts`）: プレイヤー → 武器（`weapon.ts`: スコープ・揺れ・引き金）→ 弾（`ballistics.ts`）→ ゾンビ（`zombies.ts`: 補充・知覚・状態機械・移動）→ 近接と事後（`combat.ts`: ナイフ・耳・落下・死亡と仮復帰）。毎分 `expireCorpses` と感染の期限判定。プレイヤーへのダメージは `health.ts` の `hurtPlayer`
- ゾンビの当たり判定の形は `hitShapes(z)`（頭の球・胴と脚のカプセル）。描画（`render/tactical/zombies.ts`）も同じ寸法から箱を置く。ゾンビの追加は `addZombie(state, area, kind, x, z, yaw)`（空間ハッシュと id 索引を同時に更新する。`tactical.zombies` へ直接 push してもよいが索引は次のステップで作り直される）
- 武器の定義は `data/weapons.ts`。`weaponOf(state)` が `weapon.*` の修飾（`data/techs.ts`）を重ねた定義を返す（07）。ゾンビの種類別の数値は `data/zombies.ts`
- 射撃場: `state.flags.range = true` の状態は世界データなしで動く（`sim/tactical/range.ts` の固定マップ、`ensureArea` が分岐）。`?range=1` または `window.__game.debug.openRange()`。`flags.noSway` で揺れを 0 にできる
- プレイヤー: `sim/tactical/player.ts` の `updatePlayer(player, map, input, dt, lookScale)`。視線レイは `viewRay(player)`、方位は `headingDeg(yaw)`
- ナビ/建築グリッド: 4m タイル 256×256（`map.walk`: 建物・階段・大岩・急斜面が 0。静的）。構造物は `sim/build/structures.ts` のオーバーレイで重ねる。フローフィールドは拠点（司令部）を目標に Dijkstra。`BuildState.gridRev` 変更時のみ再計算（実測 約 3ms）。規則は `02_systems_spec.md` §6.4
- 弾の当たり判定: 弾の線分 vs
  - ゾンビ: 頭（球）・胴（カプセル）・脚（カプセル）の解析判定。空間ハッシュ（16mセル）で候補を絞る
  - 建物・壁・幹・地形: `raycastWorld`（箱はスラブ法、地形は 2m 刻みのレイマーチ＋二分法）
- プレイヤー・ゾンビの移動衝突: ハイトマップ＋AABB の押し戻し。物理エンジンは使わない
- 生成結果の確認: `node tools/tactical-preview.ts <dir> [seed]` が 5 区分＋本拠版を上から見た PNG に書き出す。`node tools/sight-stats.ts` が区分ごとの「200m で視線が通る割合」と生成時間を出す
- **遮蔽物（07b、`gen/cover.ts`）**: `TacticalMap.brush`（`Brush { kind: 'hedge'|'bush'|'reeds'|'bamboo', ax, az, bx, bz, r, h }` ＝地面に立つカプセル。当たり判定なし・視線だけ遮る。`map.hash.brush` に登録）と `TacticalMap.props`（`Prop { kind: 'car'|'truck'|'log'|'greenhouse', ... }` ＝箱の小道具。車・倒木は `solids` に `kind: 'scenery'` の箱も持つ）。土手・沢・段々畑は高さ配列を直接変える（`addDike` / `addCreek` / `terrace`）。生成の順は 地形 → 本拠の平坦化 → 配置（土手・道路・集落・小道具・畑）→ 射点 → 植生 → 遮蔽物

## 8. 描画方針（性能予算）

- 目標: 内蔵GPUのノートPCで 60fps（最低 30fps）。ドローコール < 150
- ゾンビ: 部位ごとの `InstancedMesh`（胴・頭・腕×2・脚×2）。歩行アニメは CPU で行列計算（最大150体）
- 生存者も同方式（`render/tactical/survivors.ts`: 1 人 7 箱、仕事ごとの上着の色と持ち物。人物 1 ＋ 影 1 ＋ 仮の野営地 1 ドローコール）。本拠セルにいるときのみ描画。探索ポイントの潜伏者も同じメッシュ
- 建物・樹木・草: InstancedMesh ＋ 距離カリング。影はプレイヤー周辺のみ（または無し＋接地ブロブ）
- 視程 800m ＋フォグ（260〜800m。04 が 150m から変更）。夜はフォグ色と環境光で表現。空は地平線でフォグ色に溶けるドーム（太陽・月・星はドームのシェーダ内、1 ドローコール）
- 戦術ワールド（`render/tactical/`）: 地形 1（1m/texel のプロシージャル地面テクスチャ）＋外周の粗い地形 1、建物・階段・鉄塔・はしごは箱の InstancedMesh 1（窓はフラグメントシェーダ）、切妻屋根 1、岩 1、草むら 1（カメラから 150m 以内のみ）、樹木は 2 種 × 4×4 チャンク（視錐台・距離カリング）。実測 15〜40 ドローコール
- カメラは `renderer.view`（`render/tactical/camera.ts`）。戦術モードの FOV は `sim/tactical/weapon.ts` の `viewFovDeg(player)`（スコープの遷移と倍率）に従い、向きは `yaw/pitch + player.aim.off`（揺れと反動）。`setFov(度)` は強制上書き、`setFov(null)` で戻す
- 遮蔽物（07b、`render/tactical/brush.ts`）: 箱（生け垣・廃車・倒木・ビニールハウスの骨組み）、塊（藪・竹やぶの下草）、葦の穂、竹の 4 ドローコール。描く形は視線判定のカプセル以上の高さ・幅にしてある（プレイヤーから隠れて見えるものは、ゾンビからも見えない）。潜伏者の合図（`signals.ts`）: 煙の粒 1 ＋夜の灯り 1（Points）
- ゾンビと死体（04）: 箱の InstancedMesh を生者用・死体用に 1 つずつ（1 体 7 箱。07b で顔の暗い板を追加。**向きはローカル −z が前**で、前傾・伸ばした腕・顔の板がそちらを向く。死体は一覧が変わったときだけ書き直す）＋接地の丸い影 1。着弾の土煙・血煙は Points 1。スコープは全画面三角形 1。合計 5 ドローコール
- 解像度の自動調整（04）: `RENDER.resolution`。フレーム時間の平均（0.5 秒で平滑化）が 1 秒間 20ms を超えると描画スケールを 0.125 下げ（40ms 超なら 0.25、下限 0.5）、17.5ms 未満が 3 秒続けば戻す。戻して 4 秒以内に再び下がったら次の試行までの待ちを倍にする。`renderer.setAutoResolution(false)` / `?res=fixed` で無効
- スコープ: カメラ FOV を倍率に応じて絞る＋円形マスクのオーバーレイ（レティクルは CSS/SVG ではなく専用の全画面クアッドで描き、mil 目盛りを FOV と正確に対応させる）。レンダーターゲット二重描画はしない
- 構造物（06、`render/tactical/structures.ts`）: 箱の InstancedMesh 2 つ（不透明・半透明）＋カーソル周りのグリッド線 1 ＋防衛担当の曳光線 1 の最大 4 ドローコール。木柵 = 高さの揃わない杭、土塁 = 幅広の二段の盛り土、鉄板壁 = 柱と板と錆の帯、コンクリート壁 = 厚い淡色の塊と笠。耐久 75 / 50 / 25% で暗くなり、傾き、杭が抜け、ひびが入る。設計図は半透明の箱＋進捗ぶんの実体＋足場の柱、堀は暗い面と土の縁と死体の山、破壊後は瓦礫。再構築は `gridRev`・損傷の段階・進捗が変わったときだけ（最短 0.2 秒間隔）。壁 587 タイル＋堀 207 タイルで 1.2 万箱ほど
- 指揮層のカメラ（06）: `core/view.ts` の `commandView`（注視点・距離・向き）に従う俯瞰。`commandView.pick(clientX, clientY)` で画面の点を地面の点に変換する
- 他セルの出来事（遠征・駐屯地・感染）は一切描画しない（数値のみ）。駐屯地セルに入ったときのプレハブだけは描く

## 9. UI 方針

- HUD と各パネルは DOM。レイアウトは CSS Grid/Flex、**最小幅 360px でも破綻しない** ように組む（スマホ対応の布石。タッチ操作自体は後回し）
- 指揮層のパネル: 生存者一覧（仕事割り振り）、建築メニュー、研究ツリー、経済台帳、ログ
- 戦略地図: セルの色（Z 密度／loot／intel）、駐屯地、移動経路、遠征
- 文言は `src/ui/i18n/ja.ts` に集約（日本語のみ実装、キーで参照）

## 10. テスト方針

- `tests/sim/**`: 弾道（既知距離での落下量）、感染シミュレーション（保存量・決定性）、経済（1日回して収支が合う）、フローフィールド（堀で迂回する）、技術（排他分岐）、セーブ（往復で一致）
- `tests/balance/**`: ヘッドレスで「ボットがN日プレイ」するシナリオテスト（バランス担当が整備）
- Playwright（`npm run e2e`、`e2e/`）: 起動 → 新規ゲーム → 速度・モード切替 → セーブ → リロードして続きから → エラーなし。射撃実装後に「1発撃つ」を足す
- `npm run check` = 型検査 + lint + vitest。**各セッションは終了前に必ず通す**
