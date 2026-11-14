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
│   ├─ data/               # 定義テーブル（balance, render, buildings, techs, zombies, weapons, traits, jobs, resources）
│   ├─ sim/                # 純ロジック（ヘッドレス実行可）
│   │   ├─ index.ts        #   createSim() / tick(state, dt, input) — 各システムを決まった順で呼ぶ
│   │   ├─ system.ts       #   System インターフェース（step/minute/hour/day フックとコマンドハンドラ）
│   │   ├─ time.ts         #   時計を進める。setSpeed / setMode を担当
│   │   ├─ world/          #   感染、セル、移動、駐屯地、補給
│   │   ├─ tactical/       #   プレイヤー、弾道、ゾンビAI、フローフィールド、死体・耳
│   │   ├─ colony/         #   生存者、仕事、経済、遠征、士気
│   │   ├─ build/          #   設計図、建設、耐久、堀、襲来
│   │   └─ research/       #   技術、時代、勝利条件
│   ├─ gen/                # シードからの戦術マップ生成（sim からも render からも使う純関数）
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
  pos: [number, number, number]; yaw: number; pitch: number;
  stance: 'stand' | 'crouch' | 'prone';
  hp: number; stamina: number; breath: number;
  infectedUntil: { day: number; minute: number } | null;
  weapon: { id: string; mag: number; zeroIdx: number; zoom: number; boltT: number; reloadT: number };
  scoped: boolean;
  inv: Partial<Record<ResourceId, number>>;   // 所持（耳・弾・医薬品など）
  stats: { kills: number; headshots: number; shots: number; earsCollected: number };
}

export interface TacticalState {
  cell: CellId; mapSeed: number;
  zombies: Zombie[];                  // 上限 150
  corpses: Corpse[];                  // 上限 200
  bullets: Bullet[];
  reserve: number;                    // このセッションで補充可能な残数の目安
  wind: [number, number];
  lootSpots: { id: number; pos: [number, number]; taken: boolean }[];
}
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

### 乱数（`core/rng.ts`）

xoshiro128**。状態はプレーンオブジェクトで、関数に渡して使う: `rand(r)`, `randRange`, `randInt(r, lo, hi)`（両端含む）, `chance`, `pick`, `gauss`。

- `stream(state, 'colony.hire')` — 用途別の永続系列（`state.rngStreams` に保存）。**システム内ではこれを使う**（他システムの乱数消費に影響されない）
- `fork(parent, label)` — 親を進めずに派生系列を作る純関数。`gen/` で `fork(seedRng(mapSeed), 'trees')` のように使う
- `state.rng` — 主系列。順序に意味のある少数の用途のみ

## 6. コマンドとイベント

**コマンド**（UI・入力 → sim）: 判別共用体 `Command`。`dispatch(cmd)` でキューに積み、次の tick 冒頭で適用。
例: `{type:'assignJob', survivor, job}`, `{type:'placeBlueprint', def, tx, ty, rot}`, `{type:'cancelStructure', id}`,
`{type:'hire', candidate}`, `{type:'dismiss', survivor}`, `{type:'startResearch', id}`, `{type:'setAllocation', allocation}`,
`{type:'sendExpedition', members, target, weapon}`, `{type:'foundOutpost', cell}`, `{type:'travel', to}`,
`{type:'setSpeed', speed}`, `{type:'buyFood', amount, source}`, `{type:'resupply'}`, `{type:'setMode', mode}`

プレイヤーのリアルタイム操作（移動・視点・射撃）はコマンドではなく、毎ステップ渡す `InputFrame`:
```ts
export interface InputFrame { moveX: number; moveZ: number; lookDX: number; lookDY: number;
  fire: boolean; scope: boolean; holdBreath: boolean; sprint: boolean; reload: boolean;
  stance: 'stand'|'crouch'|'prone'|null; zoomDelta: number; zeroDelta: number; knife: boolean; interact: boolean; }
```

**イベント**（sim → render/ui/audio、および sim 内の他システム）: 判別共用体 `GameEvent`。
例: `shotFired`, `bulletHit{zombie, part, pos}`, `zombieKilled{id, kind, by, headshot}`, `earsCollected{amount}`,
`playerHurt`, `playerDied`, `structureDamaged`, `structureDestroyed`, `structureBuilt`, `moatBridged`,
`hordeWarning`, `hordeArrived`, `survivorHired`, `survivorDied`, `survivorLeft`, `expeditionReturned`,
`techCompleted`, `eraAdvanced`, `dayStarted`, `hourStarted`, `wagesPaid`, `outpostFounded`, `outpostLost`, `victory`, `defeat`

基盤が追加したイベント: `speedChanged{speed}`, `modeChanged{mode, prev}`, `commandRejected{command, reason}`。
02 が追加したイベント: `travelStarted{from, to, minutes}`, `cellEntered{cell, from}`, `travelArrived{cell}`, `travelEncounter{cell, danger}`（枠のみ）, `infectionStepped{day, homeInflow}`。
`dayStarted` は 00:00 に、同じ tick の `hourStarted{hour:0}` より先に発火する。

イベントは tick 中にバッファされ、tick 末に購読者へ配信（`sim.events.on(type, fn)` / `onAny`）。sim 内システムが他システムのイベントを見る場合は「次の tick で処理」と決め、`ctx.prevEvents`（直前の tick で出たイベント）を読む。
`prevEvents` とコマンドキューは `GameState` の外にあり保存されない。セーブをまたいで必要な事実は必ず `GameState` に持つこと。

### 描画・UI・入力の入口

- `render/index.ts`: `renderer.register(subRenderer)`。`SubRenderer { id, init(ctx), update(state, frame), reset?(state), resize?, dispose? }`。登録順に毎フレーム `update` され、最後に1回だけ描画。新規ゲーム・ロードで state が差し替わると `reset` が呼ばれる。仮の地面とカメラは `renderer.unregister('ground' | 'camera')` で外せる
- `ui/`: `ui.sync(state)` で 10Hz 再描画（モード・速度変更時は即時）。モードごとの枠は `ui/components/modes.tsx`。UI からの操作は `UiActions`（`dispatch` ほか）経由
- `input/`: `poll()` が `InputFrame` を返し、最初のステップが消費したら `consume()`。キー割り当ては `input/bindings.ts`。ポインタロックは tactical のみ
- セーブ: `core/save.ts`。`packState` が保存対象を絞る（戦術の zombies/corpses/bullets は捨てる、menu モードは command として保存）。形を変えたら `STATE_VERSION` を上げ `MIGRATIONS` に追加

## 7. 戦術マップと当たり判定

- 作戦区域: 1024m × 1024m、ハイトマップ 257×257（4m 間隔）。`gen/` が `(mapSeed, land, cellStatic)` から決定的に生成:
  地形、道路、建物（軸平行の箱）、樹木、草むら、探索ポイント。本拠セルでは中央を平坦化
- ナビ/建築グリッド: 4m タイル 256×256。フローフィールドは拠点（司令部）を目標に Dijkstra。`BuildState.gridRev` 変更時のみ再計算（1回 < 5ms を目標）
- 弾の当たり判定: 弾の線分 vs
  - ゾンビ: 頭（球）・胴（カプセル）・脚（カプセル）の解析判定。空間ハッシュ（16mセル）で候補を絞る
  - 建物・壁: AABB（空間ハッシュ）
  - 地形: ハイトマップのレイマーチ
- プレイヤー・ゾンビの移動衝突: ハイトマップ＋AABB の押し戻し。物理エンジンは使わない

## 8. 描画方針（性能予算）

- 目標: 内蔵GPUのノートPCで 60fps（最低 30fps）。ドローコール < 150
- ゾンビ: 部位ごとの `InstancedMesh`（胴・頭・腕×2・脚×2）。歩行アニメは CPU で行列計算（最大150体）
- 生存者も同方式（色違い）。本拠セルにいるときのみ描画
- 建物・樹木・草: InstancedMesh ＋ 距離カリング。影はプレイヤー周辺のみ（または無し＋接地ブロブ）
- 視程 800m ＋フォグ。夜はフォグ色と環境光で表現
- スコープ: カメラ FOV を倍率に応じて絞る＋円形マスクのオーバーレイ（レティクルは CSS/SVG ではなく専用の全画面クアッドで描き、mil 目盛りを FOV と正確に対応させる）。レンダーターゲット二重描画はしない
- 他セルの出来事（遠征・駐屯地・感染）は一切描画しない（数値のみ）

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
