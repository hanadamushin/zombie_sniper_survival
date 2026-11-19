/**
 * assets.ts — 崩壊後の日本の田舎と森の植生・岩・地面を、すべてコードで生成する部品。
 *
 *  - 依存は three（r187）だけ。画像・glTF・外部ライブラリは使わない。
 *  - 形はすべて非インデックスの THREE.BufferGeometry。
 *    属性は position / normal / color（どれも Float32、3 成分）。
 *  - 想定する材質: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
 *    ※ grassTuft() だけは「法線が全部真上」を活かすため flatShading: false・FrontSide の
 *      材質で描くこと（flatShading: true だと Three.js は normal 属性を使わず画面微分から
 *      法線を作る。DoubleSide だと裏向きの面の法線が反転して黒くなる）。
 *  - 頂点カラーは「中くらいの明るさの基本色」。1 個ごとの明るさむら（0.75〜1.2 倍）は
 *    ゲーム側のインスタンスカラーで掛ける前提。
 *  - 各形の y=0 は地面。地面の凹凸で根元が浮かないよう、根元は少し地中まで伸ばしてある。
 *
 * 三角形数（tests で実測・上限）:
 *   coniferNear 40/40   coniferFar 8/8   broadleafNear 40/40   broadleafFar 8/8
 *   rock 19/20          grassTuft 12/12  bush 18/20            hedgePiece 16/16
 *   reedSpike 8/8       bambooCulm 16/16
 *
 * 地面の 2 関数（groundPixels / detailTexture）は three を一切参照しない。
 * ファイル末尾の「GROUND」節は単独で切り出しても動く（Web Worker 用）。
 * three の import は名前付きなので、Worker 側でこのファイルを読んでもバンドラが
 * 未使用として落とす（three は package.json で sideEffects を宣言済み）。
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';

// ============================================================================
// 色（sRGB の 16 進数）。ここを変えれば見た目の調整ができる。
// ============================================================================

/**
 * true: 頂点カラーを sRGB → リニアに変換して書き込む（Three.js r152 以降の既定の色管理
 * ColorManagement.enabled = true に合わせた設定）。色管理を切っているなら false にする。
 */
export const VERTEX_COLORS_LINEAR = true;

export const COLORS = {
  // 針葉樹（杉・檜）
  coniferBark: 0x5a4434,
  coniferBarkDark: 0x45352a,
  coniferLeaf: 0x38533b,
  coniferLeafTop: 0x45633f,
  coniferLeafUnder: 0x2b3f30,
  // 広葉樹
  broadleafBark: 0x5b5446,
  broadleafBarkDark: 0x463f35,
  broadleafLeaf: 0x52693a,
  broadleafLeafTop: 0x647b44,
  broadleafLeafUnder: 0x3d512f,
  // 岩
  rock: 0x7b7870,
  rockDark: 0x615d56,
  rockTop: 0x777b62, // 上面は苔が乗ってやや緑がかった灰
  // 草むら
  grassBase: 0x4a5c33,
  grassTip: 0x7f8a4d,
  // 藪
  bushBase: 0x39492f,
  bushMid: 0x46593a,
  bushTop: 0x55693f,
  // 生け垣
  hedgeBase: 0x33442e,
  hedgeSide: 0x3f5537,
  hedgeTop: 0x4d6640,
  // 葦
  reedBase: 0x56653a,
  reedTip: 0xb1a57a,
  // 竹
  bambooCulmDark: 0x5f6c3d,
  bambooCulm: 0x7f8b52,
  bambooLeaf: 0x67793f,
  bambooLeafTop: 0x7a8c4b,
  bambooLeafUnder: 0x4f5f34,
} as const;

/** 1 面ごとの明るさの揺らぎ（±）。ローポリの面を見分けやすくするための弱いもの。 */
const FACE_JITTER = 0.05;

// ============================================================================
// 判定を覆うための寸法（ゲーム側の拡大範囲。変わったらここを直す）
// ============================================================================

/** インスタンスの全高 h・樹冠半径 r の範囲（m）。幹の太さはこの最悪値から決める。 */
export const CONIFER_RANGE = { hMin: 9, hMax: 18, rMin: 1.7, rMax: 3.1 } as const;
export const BROADLEAF_RANGE = { hMin: 6, hMax: 12.5, rMin: 2.4, rMax: 4.6 } as const;

/** 判定の幹: 半径 0.14 + 0.018h（m）、高さ 0.55h まで。 */
const TRUNK_HIT_R0 = 0.14;
const TRUNK_HIT_RH = 0.018;
const TRUNK_SIDES = 6;
const COVER_MARGIN = 1.03;

/**
 * 単位形での幹の頂点半径。拡大 (r, h, r) のもとで判定の円柱（半径 0.14+0.018h）を
 * 六角柱が必ず覆うよう、(0.14+0.018h)/r の最大値（h 最大・r 最小）÷ cos(30°) にする。
 * ゲームの木で h と r が連動しているなら、その組で最大になる値に下げると幹が細く見える。
 */
export function trunkUnitRadius(range: { hMax: number; rMin: number }): number {
  const worst = (TRUNK_HIT_R0 + TRUNK_HIT_RH * range.hMax) / range.rMin;
  return (worst / Math.cos(Math.PI / TRUNK_SIDES)) * COVER_MARGIN;
}

// ============================================================================
// 形づくりの下回り
// ============================================================================

type V3 = readonly [number, number, number];
type RGB = readonly [number, number, number];

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgb(hex: number): RGB {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return VERTEX_COLORS_LINEAR ? [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)] : [r, g, b];
}

/** 決まった列を返す乱数（毎回同じ形になる）。 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class GeoBuilder {
  private readonly pos: number[] = [];
  private readonly nrm: number[] = [];
  private readonly col: number[] = [];

  private readonly rand: () => number;
  private readonly jitter: number;

  constructor(rand: () => number = () => 0.5, jitter = 0) {
    this.rand = rand;
    this.jitter = jitter;
  }

  get triangles(): number {
    return this.pos.length / 9;
  }

  /** 表から見て反時計回り（Three.js の表面）。normal を渡せばその法線を 3 頂点に使う。 */
  tri(a: V3, b: V3, c: V3, ca: RGB, cb: RGB = ca, cc: RGB = ca, normal?: V3): void {
    let nx: number, ny: number, nz: number;
    if (normal) {
      [nx, ny, nz] = normal;
    } else {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      nx = uy * vz - uz * vy;
      ny = uz * vx - ux * vz;
      nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
    }
    const k = this.jitter > 0 ? 1 + (this.rand() * 2 - 1) * this.jitter : 1;
    for (const [p, cl] of [[a, ca], [b, cb], [c, cc]] as const) {
      this.pos.push(p[0], p[1], p[2]);
      this.nrm.push(nx, ny, nz);
      this.col.push(Math.min(1, cl[0] * k), Math.min(1, cl[1] * k), Math.min(1, cl[2] * k));
    }
  }

  /** a→b→c→d が表から見て反時計回りの四角形。 */
  quad(a: V3, b: V3, c: V3, d: V3, ca: RGB, cb: RGB, cc: RGB, cd: RGB): void {
    this.tri(a, b, c, ca, cb, cc);
    this.tri(a, c, d, ca, cc, cd);
  }

  /** 下の輪と上の輪をつなぐ側面（上の輪は同じ角度でも半歩ずれでもよい）。外向き。 */
  band(lower: V3[], upper: V3[], cl: RGB, cu: RGB): void {
    const n = lower.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.tri(lower[i]!, upper[i]!, lower[j]!, cl, cu, cl);
      this.tri(lower[j]!, upper[i]!, upper[j]!, cl, cu, cu);
    }
  }

  /** 輪から上の頂点へ閉じる円錐（外向き・上向き）。 */
  fanUp(ring: V3[], apex: V3, cr: RGB, ca: RGB): void {
    const n = ring.length;
    for (let i = 0; i < n; i++) this.tri(ring[i]!, apex, ring[(i + 1) % n]!, cr, ca, cr);
  }

  /** 輪から下側の点へ閉じる底面（下向き）。点が輪より上なら凹んだ裏面になる。 */
  fanDown(ring: V3[], center: V3, cr: RGB, cc: RGB): void {
    const n = ring.length;
    for (let i = 0; i < n; i++) this.tri(ring[i]!, ring[(i + 1) % n]!, center, cr, cr, cc);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * 水平な輪（角度が増える向きに並ぶ。x = cosθ, z = sinθ）。
 * radius(i) と yJit で 1 頂点ずつ揺らす。
 */
function ring(
  n: number,
  y: number,
  radius: (i: number) => number,
  phase = 0,
  center: readonly [number, number] = [0, 0],
  yJit: (i: number) => number = () => 0,
): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < n; i++) {
    const t = phase + (i * Math.PI * 2) / n;
    const r = radius(i);
    out.push([center[0] + Math.cos(t) * r, y + yJit(i), center[1] + Math.sin(t) * r]);
  }
  return out;
}

/** 六角柱の幹（12 三角形）。根元を少し太らせ、地中 3% まで伸ばす。 */
function trunk(b: GeoBuilder, r: number, top: number, bark: RGB, barkDark: RGB): void {
  const lo = ring(TRUNK_SIDES, -0.03, () => r * 1.15);
  const hi = ring(TRUNK_SIDES, top, () => r);
  b.band(lo, hi, barkDark, bark);
}

// ============================================================================
// 木
// ============================================================================

/**
 * 杉・檜の近景（40 三角形）。全高 1・樹冠半径 1・根元 y=0。拡大 (r, h, r)。
 * 幹（六角柱）は y=0.34 まで、その上は 2 段の円錐の樹冠の中に入る。
 * 判定の幹（0.55h まで）は、下は幹、上は樹冠の中身で覆う。
 */
export function coniferNear(): BufferGeometry {
  const r = rng(0xc0f1);
  const b = new GeoBuilder(r, FACE_JITTER);
  const bark = rgb(COLORS.coniferBark), barkDark = rgb(COLORS.coniferBarkDark);
  const leaf = rgb(COLORS.coniferLeaf), top = rgb(COLORS.coniferLeafTop), under = rgb(COLORS.coniferLeafUnder);

  trunk(b, trunkUnitRadius(CONIFER_RANGE), 0.34, bark, barkDark);

  // 下段: 樹冠いっぱいの裾。裏は y=0.30 に向かって凹ませる。
  const t1 = ring(7, 0.22, () => 0.93 + r() * 0.07, 0, [0, 0], () => (r() - 0.5) * 0.03);
  b.fanUp(t1, [0, 0.74, 0], leaf, leaf);
  b.fanDown(t1, [0, 0.3, 0], leaf, under);

  // 上段: 半歩回して穂先へ。
  const t2 = ring(7, 0.5, () => 0.64 + r() * 0.08, Math.PI / 7, [0, 0], () => (r() - 0.5) * 0.03);
  b.fanUp(t2, [0.01, 1, -0.01], leaf, top);
  b.fanDown(t2, [0, 0.56, 0], leaf, under);
  return b.build();
}

/** 針葉樹の遠景（8 三角形、260m より遠く）。四角錐 2 つ。下の頂点を幹色にして幹に見せる。 */
export function coniferFar(): BufferGeometry {
  const b = new GeoBuilder();
  const leaf = rgb(COLORS.coniferLeaf), top = rgb(COLORS.coniferLeafTop), bark = rgb(COLORS.coniferBark);
  // 四角の頂点半径 1.04 で、近景の 7 角の樹冠と平均の見かけ幅がそろう
  const rr = ring(4, 0.24, () => 1.04, Math.PI / 4);
  b.fanUp(rr, [0, 1, 0], leaf, top);
  b.fanDown(rr, [0, 0.02, 0], leaf, bark);
  return b.build();
}

/**
 * 広葉樹の近景（40 三角形）。全高 1・樹冠半径 1・根元 y=0。拡大 (r, h, r)。
 * 幹（六角柱）は y=0.44 まで。樹冠は 7 角の輪 2 本（半歩ずらし）でできた塊。
 */
export function broadleafNear(): BufferGeometry {
  const r = rng(0xb10a);
  const b = new GeoBuilder(r, FACE_JITTER);
  const bark = rgb(COLORS.broadleafBark), barkDark = rgb(COLORS.broadleafBarkDark);
  const leaf = rgb(COLORS.broadleafLeaf), top = rgb(COLORS.broadleafLeafTop), under = rgb(COLORS.broadleafLeafUnder);

  trunk(b, trunkUnitRadius(BROADLEAF_RANGE), 0.44, bark, barkDark);

  const ra = ring(7, 0.5, () => 0.9 + r() * 0.1, 0, [0, 0], () => (r() - 0.5) * 0.06);
  const rb = ring(7, 0.8, () => 0.78 + r() * 0.12, Math.PI / 7, [0, 0], () => (r() - 0.5) * 0.06);
  b.fanDown(ra, [0, 0.38, 0], leaf, under);
  b.band(ra, rb, leaf, leaf);
  b.fanUp(rb, [0.03, 1, -0.02], leaf, top);
  return b.build();
}

/**
 * 広葉樹の遠景（8 三角形）。つぶれた八面体。下の頂点を幹色に寄せる。
 * 組み込み時の修正: 下の頂点を y=0.18 → 0 にした（浮いた菱形に見えたため。細い下側が幹に見える）。
 */
export function broadleafFar(): BufferGeometry {
  const b = new GeoBuilder();
  const leaf = rgb(COLORS.broadleafLeaf), top = rgb(COLORS.broadleafLeafTop), bark = rgb(COLORS.broadleafBark);
  const rr = ring(4, 0.6, () => 1.04, Math.PI / 4);
  b.fanUp(rr, [0, 1, 0], leaf, top);
  b.fanDown(rr, [0, 0, 0], leaf, bark);
  return b.build();
}

// ============================================================================
// 岩
// ============================================================================

/**
 * 岩（19 三角形）。拡大 (r, 0.85h, 0.8〜1.1r)。y=0 が地面、底は y=-0.25 まで埋まる。
 * 判定の箱（一辺 1.44r・高さ 0.8h）は単位形では |x|≤0.72、|z|≤0.9（z 倍率 0.8 のとき）、
 * y≤0.941 になる。90° 回しても覆えるよう、|x|,|z|≤0.9 の正方形を高さ 0.95 まで覆う
 * 角ばった塊にしてある（四隅は半径 1.35 まで張り出す）。
 */
export function rock(): BufferGeometry {
  const r = rng(0x70c4);
  const b = new GeoBuilder(r, FACE_JITTER * 1.4);
  const side = rgb(COLORS.rock), dark = rgb(COLORS.rockDark), topC = rgb(COLORS.rockTop);
  const deg = Math.PI / 180;
  const C = 0.955; // 角の座標（正方形 0.9 を覆う）
  // [角度, 上の輪の水平半径]
  const spec: [number, number][] = [
    [0, 1.04], [45, C * Math.SQRT2], [100, 1.03], [135, C * Math.SQRT2],
    [180, 1.06], [225, C * Math.SQRT2], [315, C * Math.SQRT2],
  ];
  const topRing: V3[] = spec.map(([a, rad]) => [Math.cos(a * deg) * rad, 0.95 + r() * 0.1, Math.sin(a * deg) * rad]);
  const lowRing: V3[] = spec.map(([a, rad]) => {
    const k = 1.07 + r() * 0.05;
    return [Math.cos(a * deg) * rad * k, -0.25, Math.sin(a * deg) * rad * k];
  });
  b.band(lowRing, topRing, dark, side);
  // 上面: 7 角形を頂点 0 から扇に割る（5 三角形）。頂点の高さの差で面が立つ。
  for (let k = 1; k < topRing.length - 1; k++) {
    b.tri(topRing[0]!, topRing[k + 1]!, topRing[k]!, topC);
  }
  return b.build();
}

// ============================================================================
// 草・藪・生け垣・葦・竹
// ============================================================================

/**
 * 草の束（12 三角形）。高さ 1、6 枚の葉を表裏 1 枚ずつ。法線は全部 (0,1,0)。
 * ※ 材質は flatShading: false、side は FrontSide（既定）にすること。
 *   flatShading: true だと法線属性が無視され、DoubleSide だと裏から見た面の法線が
 *   下向きに反転して黒く見える（表裏は形の側で 2 枚持っているので DoubleSide は不要）。
 */
export function grassTuft(): BufferGeometry {
  const r = rng(0x6a55);
  const b = new GeoBuilder();
  const base = rgb(COLORS.grassBase), tip = rgb(COLORS.grassTip);
  const up: V3 = [0, 1, 0];
  const blades = 6;
  for (let i = 0; i < blades; i++) {
    const a = (i * Math.PI * 2) / blades + r() * 0.6;
    const ca = Math.cos(a), sa = Math.sin(a);
    const off = 0.04 + r() * 0.08;
    const bx = ca * off, bz = sa * off;
    const w = 0.06 + r() * 0.03; // 根元の半幅
    const lean = 0.22 + r() * 0.25;
    const h = i === 0 ? 1 : 0.6 + r() * 0.35;
    const p0: V3 = [bx - sa * w, -0.02, bz + ca * w];
    const p1: V3 = [bx + sa * w, -0.02, bz - ca * w];
    const tp: V3 = [bx + ca * lean, h, bz + sa * lean];
    b.tri(p0, p1, tp, base, base, tip, up);
    b.tri(p1, p0, tp, base, base, tip, up);
  }
  return b.build();
}

/**
 * 藪（18 三角形）。拡大 (1.08r, 0.64h, 1.08r)。y=0 が地面。
 * 判定の円柱（半径 r・高さ h）は単位形では半径 0.926・高さ 1.5625。これを覆うため、
 * 六角の輪 2 本（頂点半径 ≥1.09、半歩ずらし）の側面を y=1.62 まで立て、上を円錐で閉じる。
 * 見た目の高さはおよそ 1.18h、幅は 2.4r 程度になる。
 */
export function bush(): BufferGeometry {
  const r = rng(0xb05e);
  const b = new GeoBuilder(r, FACE_JITTER * 1.2);
  const base = rgb(COLORS.bushBase), mid = rgb(COLORS.bushMid), top = rgb(COLORS.bushTop);
  const lo = ring(6, -0.2, () => 1.1 + r() * 0.06);
  const hi = ring(6, 1.62, () => 1.09 + r() * 0.07, Math.PI / 6, [0, 0], () => r() * 0.08);
  b.band(lo, hi, base, mid);
  b.fanUp(hi, [0.06, 1.85, -0.04], mid, top);
  return b.build();
}

/**
 * 生け垣 1 片（16 三角形）。範囲は x,z ∈ [-0.5, 0.5]、y ∈ [0, 1]（地中 -0.15 まで）。
 * 箱の 6 面すべてが判定の箱の外側か同じ面にあり、中に隙間はない。
 * 前後の面は中央が少しふくらみ、上面は中央が高い（並べると刈り込みのうねりになる。
 * 隣の片と重なる部分で前面が同一平面にならないので、ちらつきも出にくい）。
 */
export function hedgePiece(): BufferGeometry {
  const b = new GeoBuilder(rng(0x4ed6), FACE_JITTER);
  const base = rgb(COLORS.hedgeBase), side = rgb(COLORS.hedgeSide), top = rgb(COLORS.hedgeTop);
  const Y0 = -0.15, BUL = 0.05, RISE = 1.1;
  const FB0: V3 = [-0.5, Y0, 0.5], FB1: V3 = [0, Y0, 0.5 + BUL], FB2: V3 = [0.5, Y0, 0.5];
  const FT0: V3 = [-0.5, 1, 0.5], FT1: V3 = [0, RISE, 0.5 + BUL], FT2: V3 = [0.5, 1, 0.5];
  const BB0: V3 = [-0.5, Y0, -0.5], BB1: V3 = [0, Y0, -0.5 - BUL], BB2: V3 = [0.5, Y0, -0.5];
  const BT0: V3 = [-0.5, 1, -0.5], BT1: V3 = [0, RISE, -0.5 - BUL], BT2: V3 = [0.5, 1, -0.5];
  // 前（+z）
  b.quad(FB0, FB1, FT1, FT0, base, base, side, side);
  b.quad(FB1, FB2, FT2, FT1, base, base, side, side);
  // 後（-z）
  b.quad(BB2, BB1, BT1, BT2, base, base, side, side);
  b.quad(BB1, BB0, BT0, BT1, base, base, side, side);
  // 端（+x, -x）
  b.quad(FB2, BB2, BT2, FT2, base, base, side, side);
  b.quad(BB0, FB0, FT0, BT0, base, base, side, side);
  // 上
  b.quad(FT0, FT1, BT1, BT0, top, top, top, top);
  b.quad(FT1, FT2, BT2, BT1, top, top, top, top);
  return b.build();
}

/** 葦の穂（8 三角形）。高さ 1・半径 0.5、根元 y=0。四角錐 2 本を 45° ずらして束ねる。 */
export function reedSpike(): BufferGeometry {
  const b = new GeoBuilder(rng(0x4eed), FACE_JITTER * 0.6);
  const base = rgb(COLORS.reedBase), tip = rgb(COLORS.reedTip);
  b.fanUp(ring(4, -0.05, () => 0.5, 0), [0.04, 1, 0.02], base, tip);
  b.fanUp(ring(4, -0.05, () => 0.42, Math.PI / 4, [0.05, -0.04]), [-0.1, 0.82, -0.06], base, tip);
  return b.build();
}

/**
 * 竹 1 本（16 三角形）。高さ 1、y だけ 6.4〜10.5 倍される（横方向は m のまま）。
 * 三角柱の茎（半径 4.5cm、少し傾く）と、上部の葉の塊（五角の双角錐、半径 0.75〜1.05m）。
 */
export function bambooCulm(): BufferGeometry {
  const r = rng(0xba3b);
  const b = new GeoBuilder(r, FACE_JITTER);
  const culmDark = rgb(COLORS.bambooCulmDark), culm = rgb(COLORS.bambooCulm);
  const leaf = rgb(COLORS.bambooLeaf), top = rgb(COLORS.bambooLeafTop), under = rgb(COLORS.bambooLeafUnder);
  const LEAN = 0.22; // y=0.86 での横ずれ（m）
  b.band(ring(3, 0, () => 0.045), ring(3, 0.86, () => 0.03, 0, [LEAN, 0]), culmDark, culm);
  const crown = ring(5, 0.8, () => 0.75 + r() * 0.3, 0.3, [0.2, 0], () => (r() - 0.5) * 0.04);
  b.fanUp(crown, [0.32, 1, 0.05], leaf, top);
  b.fanDown(crown, [0.14, 0.52, 0], leaf, under);
  return b.build();
}

// ============================================================================
// GROUND — ここから下は three を使わない（Web Worker 用に単独で切り出せる）
// ============================================================================

export type LandKind = 'urban' | 'suburb' | 'rural' | 'forest' | 'mountain';

export interface GroundArea {
  kind: 'field' | 'paddy' | 'park' | 'parking' | 'plaza' | 'yard';
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  variant: number;
}

export interface GroundRoad {
  kind: 'avenue' | 'street' | 'lane' | 'track';
  /** 路面の全幅（m） */
  width: number;
  pts: [number, number][];
}

export interface GroundInput {
  /** 画素数（1 辺）。1 画素 = 1m。既定の使い方は 1024。 */
  size: number;
  /** 区画の一辺（m）。既定 4。 */
  tile: number;
  land: LandKind;
  seed: number;
  /** このマップの格子位置。世界座標 = gx * size + x、gy * size + z。 */
  gx: number;
  gy: number;
  /** (size/tile)^2。添字は cz * (size/tile) + cx。0 草地 1 舗装道路 2 未舗装 3 畑 4 舗装面 5 岩 6 林床 7 公園 */
  ground: Uint8Array;
  /** (size/tile+1)^2 の標高（m）。添字は iz * (size/tile+1) + ix。 */
  height: Float32Array;
  areas: GroundArea[];
  roads: GroundRoad[];
  /** areas / roads の座標が世界座標なら true（既定 false = このマップ内の m、0〜size）。 */
  worldCoords?: boolean;
}

type C3 = readonly [number, number, number];

/** 地面の色（sRGB、0〜255）。DataTexture は colorSpace = SRGBColorSpace で使う想定。 */
export const GROUND_COLORS = {
  grassA: [98, 111, 68],
  grassB: [77, 90, 54],
  grassDry: [130, 124, 80],
  parkA: [102, 120, 70],
  parkB: [85, 103, 60],
  litter: [94, 78, 54],
  litterDark: [70, 58, 42],
  litterLight: [124, 102, 66],
  moss: [72, 86, 50],
  rock: [122, 118, 110],
  rockDark: [88, 85, 80],
  rockLichen: [118, 120, 92],
  dirt: [124, 103, 74],
  dirtDark: [98, 80, 58],
  dirtRut: [80, 66, 50],
  verge: [112, 106, 86],
  gravel: [128, 121, 106],
  asphalt: [70, 70, 70],
  asphaltWorn: [90, 89, 86],
  lineWhite: [198, 196, 186],
  lineYellow: [192, 162, 74],
  concrete: [136, 134, 127],
  concreteDark: [108, 106, 101],
  brick: [128, 100, 88],
  fieldRidge: [120, 98, 70],
  fieldFurrow: [86, 69, 50],
  crop: [92, 112, 56],
  paddyWater: [76, 100, 94],
  paddyDeep: [60, 84, 84],
  levee: [104, 106, 70],
} satisfies Record<string, C3>;

/** 土地柄ごとの調整。dry: 枯れ草の増え方、bare: 裸地、rockSlope: 岩肌になる勾配の下げ幅。 */
const LAND_TUNING: Record<LandKind, { dry: number; bare: number; rockSlope: number }> = {
  urban: { dry: 0.14, bare: 0.12, rockSlope: 0 },
  suburb: { dry: 0.08, bare: 0.06, rockSlope: 0 },
  rural: { dry: 0.04, bare: 0.03, rockSlope: 0 },
  forest: { dry: 0, bare: 0.02, rockSlope: 0.03 },
  mountain: { dry: 0.12, bare: 0.08, rockSlope: 0.1 },
};

/*
 * 速さについて: V8 は、最適化されたコードの中でも「インライン展開されなかった関数」へ
 * 小数を渡したり返したりするたびにヒープに箱を作る。1024² 画素でこれが起きると GC で
 * 数十 ms 失うので、画素ごとの値は作業用の Float64Array（S, P, Q）か画素バッファで受け渡し、
 * 行ごとの処理は 1 行ずつ別の関数にしてある（大きな関数の内側ループだけが最適化されて
 * 行の終わりごとに捨てられるのも防ぐ）。
 */

function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) * 2.3283064365386963e-10;
}

/** 値ノイズ（0〜1）。座標は世界座標で渡すので、隣のマップと境界でつながる。 */
function vnoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/**
 * vnoise と同じ値を、マップ 1 枚ぶんの格子点のハッシュを先に表にしてから引くためのもの。
 * f は周波数（1/m）。表は世界座標の格子なので、隣のマップと同じ値になる。
 */
interface Lattice {
  tab: Float32Array;
  w: number;
  x0: number;
  z0: number;
  f: number;
}
function lattice(f: number, ox: number, oz: number, size: number, seed: number): Lattice {
  const x0 = Math.floor((ox - 2) * f), z0 = Math.floor((oz - 2) * f);
  const w = Math.floor((ox + size + 2) * f) + 2 - x0;
  const h = Math.floor((oz + size + 2) * f) + 2 - z0;
  const tab = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) tab[j * w + i] = hash2(x0 + i, z0 + j, seed);
  return { tab, w, x0, z0, f };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** 幅 2hw の線を 1 画素の箱で受けたときの被覆率（d は線の中心からの距離）。 */
function lineCov(d: number, hw: number): number {
  const a = Math.min(hw + 0.5 - Math.abs(d), 2 * hw, 1);
  return a < 0 ? 0 : a;
}

/** 作業用の色（0〜255 の float）。 */
const P = new Float64Array(3);
const Q = new Float64Array(3);
/** 画素ごとの入力値（色関数へ小数を引数で渡さないための置き場）。 */
const S = new Float64Array(7);
const S_LOW = 0, S_FINE = 1, S_PATCH = 2, S_SPECK = 3, S_CRACK = 4, S_H = 5, S_SLOPE = 6;
const INV255 = 1 / 255;

function setLerp(o: Float64Array, a: C3, b: C3, t: number): void {
  o[0] = a[0] + (b[0] - a[0]) * t;
  o[1] = a[1] + (b[1] - a[1]) * t;
  o[2] = a[2] + (b[2] - a[2]) * t;
}
function mixTo(o: Float64Array, c: C3, t: number): void {
  if (t <= 0) return;
  o[0]! += (c[0] - o[0]!) * t;
  o[1]! += (c[1] - o[1]!) * t;
  o[2]! += (c[2] - o[2]!) * t;
}
function mixBuf(o: Float64Array, c: Float64Array, t: number): void {
  o[0]! += (c[0]! - o[0]!) * t;
  o[1]! += (c[1]! - o[1]!) * t;
  o[2]! += (c[2]! - o[2]!) * t;
}
function scale(o: Float64Array, k: number): void {
  o[0]! *= k; o[1]! *= k; o[2]! *= k;
}
function writePx(out: Uint8ClampedArray, i: number, o: Float64Array): void {
  const j = i * 4;
  out[j] = o[0]!; out[j + 1] = o[1]!; out[j + 2] = o[2]!; out[j + 3] = 255;
}
function readPx(out: Uint8ClampedArray, i: number, o: Float64Array): void {
  const j = i * 4;
  o[0] = out[j]!; o[1] = out[j + 1]!; o[2] = out[j + 2]!;
}
/** 画素バッファの値を S に読み込む。 */
function loadS(c: GroundCtx, i: number): void {
  S[S_LOW] = c.bLow[i]! * INV255;
  S[S_FINE] = c.bFine[i]! * INV255;
  S[S_PATCH] = c.bPatch[i]! * INV255;
  S[S_SPECK] = c.bSpeck[i]! * INV255;
  S[S_CRACK] = c.bCrack[i]! * INV255;
}

type Tune = (typeof LAND_TUNING)[LandKind];
const G = GROUND_COLORS;

// ---- 地面の種類ごとの色（S を読んで o に書く）

function grassColor(o: Float64Array, lt: Tune, park: boolean): void {
  const low = S[S_LOW]!, fine = S[S_FINE]!, patch = S[S_PATCH]!;
  const m = clamp01(low * 0.65 + fine * 0.35);
  if (park) setLerp(o, G.parkB, G.parkA, m);
  else setLerp(o, G.grassB, G.grassA, m);
  mixTo(o, G.grassDry, smoothstep(0.56 - lt.dry, 0.84 - lt.dry, patch!) * (park ? 0.3 : 0.75));
  const bareKey = (1 - patch) * 0.75 + fine * 0.25;
  mixTo(o, G.dirt, smoothstep(0.8 - lt.bare, 0.9 - lt.bare, bareKey) * (park ? 0.4 : 0.7));
}

function forestColor(o: Float64Array): void {
  const low = S[S_LOW]!, fine = S[S_FINE]!, patch = S[S_PATCH]!, speck = S[S_SPECK]!;
  setLerp(o, G.litter, G.moss, smoothstep(0.42, 0.72, patch * 0.6 + low * 0.4));
  mixTo(o, G.litterDark, (1 - fine) * 0.35);
  if (speck > 0.86) mixTo(o, G.litterLight, 0.55);
  else if (speck < 0.08) mixTo(o, G.litterDark, 0.6);
}

function rockColor(o: Float64Array): void {
  const low = S[S_LOW]!, fine = S[S_FINE]!, patch = S[S_PATCH];
  setLerp(o, G.rockDark, G.rock, clamp01(fine * 0.6 + low * 0.4));
  // 標高に沿った地層の縞（急なところだけ。平らな岩場で等高線の輪にならないように）
  scale(o, 1 + Math.sin(S[S_H]! * 1.9 + fine * 2.5) * 0.07 * smoothstep(0.4, 0.9, S[S_SLOPE]!));
  mixTo(o, G.rockLichen, smoothstep(0.65, 0.9, patch!) * 0.45);
}

function dirtColor(o: Float64Array): void {
  setLerp(o, G.dirtDark, G.dirt, clamp01(S[S_FINE]! * 0.7 + S[S_LOW]! * 0.3));
  mixTo(o, G.grassB, smoothstep(0.55, 0.8, S[S_PATCH]!) * 0.5);
}

/** 舗装道路の区画の残り（道そのものは roads で描く）: 路肩の砂利と枯れ草。 */
function vergeColor(o: Float64Array): void {
  setLerp(o, G.verge, G.gravel, S[S_FINE]!);
  mixTo(o, G.grassDry, S[S_LOW]! * 0.35);
}

/** 舗装（ひび・ひびの草）。 */
function asphaltColor(o: Float64Array): void {
  setLerp(o, G.asphalt, G.asphaltWorn, clamp01(S[S_FINE]! * 0.6 + S[S_LOW]! * 0.4));
  const cr = S[S_CRACK]!;
  if (cr > 0) {
    scale(o, 1 - 0.3 * cr);
    if (S[S_PATCH]! > 0.55) mixTo(o, G.grassB, cr * 0.8);
  }
}

/** コンクリート（4m 目地・しみ・ひび）。ix, iz は世界座標の整数画素。 */
function concreteColor(o: Float64Array, ix: number, iz: number): void {
  const low = S[S_LOW]!;
  setLerp(o, G.concreteDark, G.concrete, clamp01(S[S_FINE]! * 0.5 + low * 0.5));
  if ((ix & 3) === 0 || (iz & 3) === 0) scale(o, 0.95);
  if (low < 0.3) scale(o, 0.92 + low * 0.25);
  const cr = S[S_CRACK]!;
  if (cr > 0) {
    scale(o, 1 - 0.3 * cr);
    if (S[S_PATCH]! > 0.5) mixTo(o, G.grassB, cr * 0.85);
  }
}

// ---- 本体

interface GroundCtx {
  inp: GroundInput;
  size: number;
  tile: number;
  cells: number;
  vs: number;
  seed: number;
  lt: Tune;
  ox: number;
  oz: number;
  out: Uint8ClampedArray;
  H: Float32Array;
  ground: Uint8Array;
  // 粗い場（4m 格子の頂点）
  fWX: Float32Array;
  fWZ: Float32Array;
  fLow: Float32Array;
  fPatch: Float32Array;
  fSlope: Float32Array;
  latFine: Lattice;
  latCrack: Lattice;
  // 画素ごと（0〜255 に量子化）
  bType: Uint8Array;
  bFine: Uint8Array;
  bLow: Uint8Array;
  bPatch: Uint8Array;
  bSpeck: Uint8Array;
  bSlope: Uint8Array;
  bCrack: Uint8Array;
  prio: Uint8Array;
  // 列ごとの表（x だけで決まる値）
  colIx: Int32Array;
  colTx: Float32Array;
  colFk: Int32Array;
  colFu: Float32Array;
  colCk: Int32Array;
  colCu: Float32Array;
  colHx: Int32Array;
  // 行ごとに z 方向だけ補間した粗い場
  rWX: Float32Array;
  rWZ: Float32Array;
  rLow: Float32Array;
  rPatch: Float32Array;
  rSlope: Float32Array;
}

/** 作業用バッファ（呼ぶたびに確保し直さない。Worker は 1 本の流れなので共有してよい）。 */
type Scratch = Omit<GroundCtx, 'inp' | 'size' | 'tile' | 'cells' | 'vs' | 'seed' | 'lt' | 'ox' | 'oz' | 'out' | 'H' | 'ground' | 'latFine' | 'latCrack'>;
let scratch: (Scratch & { n: number; size: number; vs: number }) | null = null;
function scratchBuffers(size: number, vs: number): Scratch {
  const n = size * size, nV = vs * vs;
  if (!scratch || scratch.size !== size || scratch.vs !== vs) {
    scratch = {
      n, size, vs,
      fWX: new Float32Array(nV), fWZ: new Float32Array(nV), fLow: new Float32Array(nV),
      fPatch: new Float32Array(nV), fSlope: new Float32Array(nV),
      bType: new Uint8Array(n), bFine: new Uint8Array(n), bLow: new Uint8Array(n), bPatch: new Uint8Array(n),
      bSpeck: new Uint8Array(n), bSlope: new Uint8Array(n), bCrack: new Uint8Array(n), prio: new Uint8Array(n),
      colIx: new Int32Array(size), colTx: new Float32Array(size), colFk: new Int32Array(size),
      colFu: new Float32Array(size), colCk: new Int32Array(size), colCu: new Float32Array(size),
      colHx: new Int32Array(size),
      rWX: new Float32Array(vs), rWZ: new Float32Array(vs), rLow: new Float32Array(vs),
      rPatch: new Float32Array(vs), rSlope: new Float32Array(vs),
    };
  }
  return scratch;
}

/** x だけで決まる値を表にする（格子の列、補間の重み、ハッシュの x 側）。 */
function columnTables(c: GroundCtx): void {
  const { size, tile, cells, ox, latFine, latCrack, colIx, colTx, colFk, colFu, colCk, colCu, colHx } = c;
  for (let x = 0; x < size; x++) {
    const gxf = (x + 0.5) / tile;
    const ix0 = Math.min(cells - 1, Math.floor(gxf));
    colIx[x] = ix0;
    colTx[x] = gxf - ix0;
    const wx = ox + x + 0.5;
    const fx = wx * latFine.f, fi = Math.floor(fx), ff = fx - fi;
    colFk[x] = fi - latFine.x0;
    colFu[x] = ff * ff * (3 - 2 * ff);
    const cx = wx * latCrack.f, ci = Math.floor(cx), cf = cx - ci;
    colCk[x] = ci - latCrack.x0;
    colCu[x] = cf * cf * (3 - 2 * cf);
    colHx[x] = Math.imul((ox + x) | 0, 0x27d4eb2d);
  }
}

/**
 * 地面の色（RGBA、size × size、1 画素 = 1m、行 = z）。three を使わない。
 * 返り値は out[(z * size + x) * 4 + 0..3]。
 */
export function groundPixels(inp: GroundInput): Uint8Array {
  const size = inp.size | 0;
  const tile = inp.tile;
  const cells = Math.round(size / tile);
  const vs = cells + 1;
  const seed = inp.seed | 0;
  const ox = inp.gx * size, oz = inp.gy * size;
  const buf = new Uint8Array(size * size * 4);
  const c: GroundCtx = {
    inp, size, tile, cells, vs, seed, ox, oz,
    lt: LAND_TUNING[inp.land] ?? LAND_TUNING.rural,
    out: new Uint8ClampedArray(buf.buffer),
    H: inp.height,
    ground: inp.ground,
    latFine: lattice(0.31, ox, oz, size, seed + 31),
    latCrack: lattice(0.19, ox, oz, size, seed + 51),
    ...scratchBuffers(size, vs),
  };
  columnTables(c);
  for (let iz = 0; iz < vs; iz++) coarseRow(c, iz);
  for (let z = 0; z < size; z++) prepRow(c, z);
  for (let z = 0; z < size; z++) shadeRow(c, z);
  areaPass(c);
  roadPass(c);
  return buf;
}

/** 粗い場を 4m 格子の頂点 1 行ぶん計算する（世界座標なので継ぎ目なし）。 */
function coarseRow(c: GroundCtx, iz: number): void {
  const { tile, cells, vs, seed, ox, oz, H, fWX, fWZ, fLow, fPatch, fSlope } = c;
  const wz = oz + iz * tile;
  const zl = iz > 0 ? iz - 1 : iz, zr = iz < cells ? iz + 1 : iz;
  const k0 = iz * vs;
  noiseRow(fWX, k0, vs, ox, tile, wz, 1 / 7.3, 0, 0, seed + 11, 1, false);
  noiseRow(fWZ, k0, vs, ox, tile, wz, 1 / 7.3, 31.7, -17.3, seed + 13, 1, false);
  noiseRow(fLow, k0, vs, ox, tile, wz, 1 / 41, 0, 0, seed + 17, 0.6, false);
  noiseRow(fLow, k0, vs, ox, tile, wz, 1 / 13, 0, 0, seed + 19, 0.4, true);
  noiseRow(fPatch, k0, vs, ox, tile, wz, 1 / 57, 0, 0, seed + 23, 0.7, false);
  noiseRow(fPatch, k0, vs, ox, tile, wz, 1 / 19, 0, 0, seed + 29, 0.3, true);
  for (let ix = 0; ix < vs; ix++) {
    const k = k0 + ix;
    const xl = ix > 0 ? ix - 1 : ix, xr = ix < cells ? ix + 1 : ix;
    const dhx = (H[iz * vs + xr]! - H[iz * vs + xl]!) / ((xr - xl) * tile);
    const dhz = (H[zr * vs + ix]! - H[zl * vs + ix]!) / ((zr - zl) * tile);
    fSlope[k] = Math.sqrt(dhx * dhx + dhz * dhz);
  }
}

/** dst[k0 + i] に（add なら足し込みで）w × vnoise((ox + i*step)*f + ax, wz*f + az) を書く。 */
function noiseRow(
  dst: Float32Array, k0: number, n: number, ox: number, step: number, wz: number,
  f: number, ax: number, az: number, seed: number, w: number, add: boolean,
): void {
  for (let i = 0; i < n; i++) {
    const v = vnoise((ox + i * step) * f + ax, wz * f + az, seed) * w;
    dst[k0 + i] = add ? dst[k0 + i]! + v : v;
  }
}

/** 1 行ぶんの下準備: 粗い場の補間、区画の種類（境界を揺らす）、細かいノイズ、ひび、斑点。 */
function prepRow(c: GroundCtx, z: number): void {
  const { size, tile, cells, vs, seed, oz, ground, fWX, fWZ, fLow, fPatch, fSlope, latFine, latCrack } = c;
  const { bType, bFine, bLow, bPatch, bSpeck, bSlope, bCrack } = c;
  const { colIx, colTx, colFk, colFu, colCk, colCu, colHx, rWX, rWZ, rLow, rPatch, rSlope } = c;
  const WARP = 4.5 / tile; // 区画の境界を 4.5m の幅で揺らして 4m の角を消す（区画単位）
  const gzf = (z + 0.5) / tile;
  const iz0 = Math.min(cells - 1, Math.floor(gzf));
  const tz = gzf - iz0;
  // 粗い場を z 方向だけ先に補間しておく（画素では x 方向の 1 回で済む）
  const k0 = iz0 * vs, k1 = k0 + vs, sz = 1 - tz;
  for (let ix = 0; ix < vs; ix++) {
    rWX[ix] = fWX[k0 + ix]! * sz + fWX[k1 + ix]! * tz;
    rWZ[ix] = fWZ[k0 + ix]! * sz + fWZ[k1 + ix]! * tz;
    rLow[ix] = fLow[k0 + ix]! * sz + fLow[k1 + ix]! * tz;
    rPatch[ix] = fPatch[k0 + ix]! * sz + fPatch[k1 + ix]! * tz;
    rSlope[ix] = fSlope[k0 + ix]! * sz + fSlope[k1 + ix]! * tz;
  }
  const wz = oz + z + 0.5;
  // 細かいノイズ（約 3m 周期）とひび（約 5m 周期）の格子の行
  const fT = latFine.tab, fW = latFine.w;
  const fzv = wz * latFine.f, fzi = Math.floor(fzv), fzf = fzv - fzi, fuz = fzf * fzf * (3 - 2 * fzf);
  const fRow = (fzi - latFine.z0) * fW;
  const cT = latCrack.tab, cW = latCrack.w;
  const czv = wz * latCrack.f, czi = Math.floor(czv), czf = czv - czi, cuz = czf * czf * (3 - 2 * czf);
  const cRow = (czi - latCrack.z0) * cW;
  const hz = Math.imul((oz + z) | 0, 0x165667b1) ^ Math.imul((seed + 41) | 0, 0x2c1b3c6d);
  const czBase = gzf - 0.5 * WARP;
  const row = z * size;
  for (let x = 0; x < size; x++) {
    const ix0 = colIx[x]!, tx = colTx[x]!;
    const warpX = rWX[ix0!]! + (rWX[ix0 + 1]! - rWX[ix0!]!) * tx;
    const warpZ = rWZ[ix0!]! + (rWZ[ix0 + 1]! - rWZ[ix0!]!) * tx;
    const low = rLow[ix0!]! + (rLow[ix0 + 1]! - rLow[ix0!]!) * tx;
    const patch = rPatch[ix0!]! + (rPatch[ix0 + 1]! - rPatch[ix0!]!) * tx;
    const slope = rSlope[ix0!]! + (rSlope[ix0 + 1]! - rSlope[ix0!]!) * tx;

    let cx = Math.floor(ix0 + tx + (warpX - 0.5) * WARP);
    let cz = Math.floor(czBase + warpZ * WARP);
    cx = cx < 0 ? 0 : cx >= cells ? cells - 1 : cx;
    cz = cz < 0 ? 0 : cz >= cells ? cells - 1 : cz;

    const fk = fRow + colFk[x]!, fux = colFu[x]!;
    const fa = fT[fk]!, fb = fT[fk + 1]!, fc = fT[fk + fW]!, fd = fT[fk + fW + 1]!;
    const fine = fa + (fb - fa) * fux + (fc - fa) * fuz + (fa - fb - fc + fd) * fux * fuz;

    const ck = cRow + colCk[x]!, cux = colCu[x]!;
    const ca = cT[ck]!, cb = cT[ck + 1]!, cc = cT[ck + cW]!, cd = cT[ck + cW + 1]!;
    const cn = Math.abs(ca + (cb - ca) * cux + (cc - ca) * cuz + (ca - cb - cc + cd) * cux * cuz - 0.5);
    let crack = 0;
    if (cn < 0.03) {
      const t = 1 - cn / 0.03;
      crack = t * t * (3 - 2 * t);
    }

    let h = colHx[x]! ^ hz;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;

    const pi = row + x;
    bType[pi] = ground[cz * cells + cx]!;
    bFine[pi] = fine * 255 + 0.5;
    bLow[pi] = low * 255 + 0.5;
    bPatch[pi] = patch * 255 + 0.5;
    bSpeck[pi] = h >>> 24;
    bSlope[pi] = slope >= 3.98 ? 255 : slope * 64 + 0.5;
    bCrack[pi] = crack * 255 + 0.5;
  }
}

/** 1 行ぶんの下地の色。 */
function shadeRow(c: GroundCtx, z: number): void {
  const { size, tile, cells, vs, lt, ox, oz, out, H, bType, bFine, bSpeck, bSlope } = c;
  const gzf = (z + 0.5) / tile;
  const iz0 = Math.min(cells - 1, Math.floor(gzf));
  const tz = gzf - iz0;
  const rock0 = 0.62 - lt.rockSlope; // 勾配 0.62〜1.0（約 32°〜45°）で岩肌へ
  const furrowRow = (((oz + z) % 3) + 3) % 3 === 0;
  const row = z * size;
  for (let x = 0; x < size; x++) {
    const pi = row + x;
    const type = bType[pi];
    loadS(c, pi);
    S[S_SLOPE] = bSlope[pi]! * (1 / 64);
    let natural = true;
    switch (type) {
      case 1:
        vergeColor(P);
        natural = false;
        break;
      case 2:
        dirtColor(P);
        break;
      case 3: // 区画だけの畑（areas に無いもの）: x 方向の畝、3m ピッチ
        setLerp(P, furrowRow ? G.fieldFurrow : G.fieldRidge, G.dirt, S[S_FINE]! * 0.25);
        break;
      case 4:
        concreteColor(P, ox + x, oz + z);
        natural = false;
        break;
      case 5:
        loadHeight(H, vs, tile, cells, x, iz0, tz);
        rockColor(P);
        natural = false;
        break;
      case 6:
        forestColor(P);
        break;
      case 7:
        grassColor(P, lt, true);
        break;
      default:
        grassColor(P, lt, false);
    }
    if (natural) {
      // 急斜面は岩肌
      let t = (bSlope[pi]! * (1 / 64) + (bFine[pi]! * INV255 - 0.5) * 0.35 - rock0) * (1 / 0.38);
      if (t > 0) {
        if (t > 1) t = 1;
        loadHeight(H, vs, tile, cells, x, iz0, tz);
        rockColor(Q);
        const k = t * t * (3 - 2 * t);
        P[0]! += (Q[0]! - P[0]!) * k;
        P[1]! += (Q[1]! - P[1]!) * k;
        P[2]! += (Q[2]! - P[2]!) * k;
      }
    }
    if (type !== 6) {
      const k = 1 + (bSpeck[pi]! * INV255 - 0.5) * 0.1;
      P[0]! *= k; P[1]! *= k; P[2]! *= k;
    }
    writePx(out, pi, P);
  }
}

/** 画素 x（行の z は iz0, tz で渡す）の標高を双線形補間して S[S_H] に入れる。 */
function loadHeight(H: Float32Array, vs: number, tile: number, cells: number, x: number, iz0: number, tz: number): void {
  const gxf = (x + 0.5) / tile;
  const ix0 = Math.min(cells - 1, Math.floor(gxf));
  const tx = gxf - ix0;
  const k = iz0 * vs + ix0;
  S[S_H] = (H[k]! * (1 - tx) + H[k + 1]! * tx) * (1 - tz) + (H[k + vs]! * (1 - tx) + H[k + vs + 1]! * tx) * tz;
}

// ---- 田・畑・駐車場などの矩形

interface AreaJob {
  xs: number;
  xe: number;
  ax0: number;
  az0: number;
  aw: number;
  ad: number;
  v: number;
}

function areaPass(c: GroundCtx): void {
  const { inp, size, ox, oz } = c;
  const dx = inp.worldCoords ? ox : 0, dz = inp.worldCoords ? oz : 0;
  for (const a of inp.areas) {
    const ax0 = Math.min(a.x0, a.x1) - dx, ax1 = Math.max(a.x0, a.x1) - dx;
    const az0 = Math.min(a.z0, a.z1) - dz, az1 = Math.max(a.z0, a.z1) - dz;
    const xs = Math.max(0, Math.floor(ax0)), xe = Math.min(size, Math.ceil(ax1));
    const zs = Math.max(0, Math.floor(az0)), ze = Math.min(size, Math.ceil(az1));
    if (xs >= xe || zs >= ze) continue;
    const job: AreaJob = { xs, xe, ax0, az0, aw: ax1 - ax0, ad: az1 - az0, v: a.variant | 0 };
    for (let z = zs; z < ze; z++) {
      switch (a.kind) {
        case 'field': fieldRow(c, job, z); break;
        case 'paddy': paddyRow(c, job, z); break;
        case 'park': parkRow(c, job, z); break;
        case 'parking': parkingRow(c, job, z); break;
        case 'plaza': plazaRow(c, job, z); break;
        case 'yard': yardRow(c, job, z); break;
      }
    }
  }
}

/** 畑: 畝の縞（向きとピッチは variant）。variant%3==0 は作物の列、%5==4 は耕作放棄で草。 */
function fieldRow(c: GroundCtx, j: AreaJob, z: number): void {
  const { size, out } = c;
  const { xs, xe, ax0, az0, aw, ad, v } = j;
  const alongX = (v & 1) === 0 ? aw >= ad : aw < ad;
  const pitch = 2 + ((v >> 1) & 1);
  const crops = v % 3 === 0, fallow = v % 5 === 4;
  const lv = z + 0.5 - az0;
  const zRow = z - Math.floor(az0);
  for (let x = xs; x < xe; x++) {
    const i = z * size + x;
    loadS(c, i);
    const fine = S[S_FINE]!;
    const lu = x + 0.5 - ax0;
    const edge = Math.min(lu, lv, aw - lu, ad - lv);
    const furrow = (alongX ? zRow : x - Math.floor(ax0)) % pitch === 0;
    setLerp(P, furrow ? G.fieldFurrow : G.fieldRidge, G.dirt, fine * 0.25);
    if (crops && !furrow) mixTo(P, G.crop, 0.55 * smoothstep(0.3, 0.6, S[S_LOW]! + fine * 0.2));
    if (fallow) mixTo(P, G.grassB, 0.45 + 0.35 * fine);
    if (edge < 1) mixTo(P, G.levee, 0.7);
    writePx(out, i, P);
  }
}

/** 田: 水を張った青緑と畦（幅 1.5m）。大きな矩形は variant で決まる大きさに区切る。 */
function paddyRow(c: GroundCtx, j: AreaJob, z: number): void {
  const { size, out } = c;
  const { xs, xe, ax0, az0, aw, ad, v } = j;
  const nx = Math.max(1, Math.round(aw / (24 + (v % 3) * 8)));
  const nz = Math.max(1, Math.round(ad / (16 + ((v >> 2) % 3) * 6)));
  const plotW = aw / nx, plotD = ad / nz;
  const lv = z + 0.5 - az0;
  const fv = lv - Math.floor(lv / plotD) * plotD;
  const dv = Math.min(fv, plotD - fv, lv, ad - lv);
  for (let x = xs; x < xe; x++) {
    const i = z * size + x;
    loadS(c, i);
    const fine = S[S_FINE]!;
    const lu = x + 0.5 - ax0;
    const fu = lu - Math.floor(lu / plotW) * plotW;
    const cov = lineCov(Math.min(dv, fu, plotW - fu, lu, aw - lu), 0.75);
    setLerp(P, G.paddyWater, G.paddyDeep, S[S_LOW]!);
    scale(P, 1 + (fine - 0.5) * 0.08);
    mixTo(P, G.grassB, smoothstep(0.62, 0.85, S[S_PATCH]! + fine * 0.2) * 0.7); // 放棄田の草
    if (cov > 0) {
      setLerp(Q, G.levee, G.grassDry, fine * 0.5);
      mixBuf(P, Q, cov);
    }
    writePx(out, i, P);
  }
}

/** 公園: 手入れされていた芝と 2m 幅の園路。縁は下地にぼかす。 */
function parkRow(c: GroundCtx, j: AreaJob, z: number): void {
  const { size, out, lt } = c;
  const { xs, xe, ax0, az0, aw, ad, v } = j;
  const alongX = (v & 1) === 0;
  const lv = z + 0.5 - az0;
  for (let x = xs; x < xe; x++) {
    const i = z * size + x;
    loadS(c, i);
    const fine = S[S_FINE]!;
    const lu = x + 0.5 - ax0;
    const edge = Math.min(lu, lv, aw - lu, ad - lv);
    readPx(out, i, Q);
    grassColor(P, lt, true);
    const pc = lineCov(Math.abs(alongX ? lv - ad * 0.5 : lu - aw * 0.5), 1);
    if (pc > 0) mixTo(P, G.gravel, pc * 0.8);
    mixBuf(Q, P, smoothstep(0, 2.5, edge + (fine - 0.5) * 1.5));
    writePx(out, i, Q);
  }
}

/** 駐車場: 舗装と、かすれた区画線（幅 2.5m・奥行 5m、通路 6m）。 */
function parkingRow(c: GroundCtx, j: AreaJob, z: number): void {
  const { size, out } = c;
  const { xs, xe, ax0, az0, aw, ad } = j;
  const alongX = aw >= ad;
  const lv = z + 0.5 - az0;
  for (let x = xs; x < xe; x++) {
    const i = z * size + x;
    loadS(c, i);
    asphaltColor(P);
    const lu = x + 0.5 - ax0;
    const pu = alongX ? lu : lv, pv = alongX ? lv : lu;
    const rv = pv - Math.floor(pv / 16) * 16;
    if (rv < 5 || rv >= 11) {
      const du = Math.abs(pu - Math.round(pu / 2.5) * 2.5);
      const back = Math.min(rv, 16 - rv);
      const cov = Math.max(lineCov(du, 0.2), lineCov(back, 0.2));
      mixTo(P, G.lineWhite, cov * (0.35 + 0.25 * S[S_FINE]!));
    }
    writePx(out, i, P);
  }
}

/** 広場: 2m 角の敷石（variant 奇数は煉瓦色）、目地の草。 */
function plazaRow(c: GroundCtx, j: AreaJob, z: number): void {
  const { size, out, ox, oz, seed } = c;
  const { xs, xe, ax0, az0, v } = j;
  const brick = (v & 1) === 1;
  const lv = z + 0.5 - az0;
  const tv = Math.floor(lv / 2);
  const dv = Math.abs(lv - Math.round(lv / 2) * 2);
  for (let x = xs; x < xe; x++) {
    const i = z * size + x;
    loadS(c, i);
    concreteColor(P, ox + x, oz + z);
    if (brick) mixTo(P, G.brick, 0.6);
    const lu = x + 0.5 - ax0;
    scale(P, 0.94 + hash2(Math.floor(lu / 2), tv, seed + 61) * 0.12); // 1 枚ずつ色違い
    const du = Math.abs(lu - Math.round(lu / 2) * 2);
    const jc = Math.max(lineCov(du, 0.15), lineCov(dv, 0.15));
    if (jc > 0) {
      scale(P, 1 - 0.25 * jc);
      if (S[S_PATCH]! > 0.6) mixTo(P, G.grassB, jc * 0.7);
    }
    writePx(out, i, P);
  }
}

/** 庭: 踏み固めた土と砂利、草が戻りかけている。縁は下地にぼかす。 */
function yardRow(c: GroundCtx, j: AreaJob, z: number): void {
  const { size, out } = c;
  const { xs, xe, ax0, az0, aw, ad } = j;
  const lv = z + 0.5 - az0;
  for (let x = xs; x < xe; x++) {
    const i = z * size + x;
    loadS(c, i);
    const fine = S[S_FINE]!;
    const lu = x + 0.5 - ax0;
    const edge = Math.min(lu, lv, aw - lu, ad - lv);
    readPx(out, i, Q);
    setLerp(P, G.dirt, G.gravel, fine!);
    mixTo(P, G.grassB, smoothstep(0.4, 0.75, S[S_LOW]!) * 0.6);
    mixBuf(Q, P, smoothstep(0, 1.5, edge + (fine - 0.5)));
    writePx(out, i, Q);
  }
}

// ---- 道（轍・路肩・中央線）

interface SegJob {
  kind: GroundRoad['kind'];
  ax: number;
  az: number;
  dx: number;
  dz: number;
  L: number;
  L2: number;
  R: number;
  hw: number;
  sw: number;
  edgeLine: number;
  /** 轍の中心の横位置（m、道の中心から） */
  ruts: Float64Array;
  s0: number;
}

/**
 * 舗装路: 路肩の砂利、端の白線、轍（わずかに暗い）、ひびと草。
 *   avenue = 黄色の中央線（実線）、street = 白の破線（5m 引いて 5m あける）、lane = 中央線なし。
 * 未舗装（track）: 2 本の轍、轍の間の草、縁は草に戻る。
 * 近い道ほど優先（交差点・曲がり角の重なりで、遠い方の路肩が近い方の路面を塗りつぶさない）。
 */
function roadPass(c: GroundCtx): void {
  const { inp, size, ox, oz, prio } = c;
  const offX = inp.worldCoords ? ox : 0, offZ = inp.worldCoords ? oz : 0;
  prio.fill(255);
  for (const road of inp.roads) {
    const pts = road.pts;
    if (pts.length < 2) continue;
    const hw = Math.max(0.75, road.width * 0.5);
    const sw = road.kind === 'avenue' ? 1.6 : road.kind === 'street' ? 1.2 : 0.9;
    const R = hw + sw + 0.5;
    const twoLane = road.kind === 'avenue' || road.kind === 'street';
    const ruts = new Float64Array(twoLane ? [hw * 0.5 - 0.85, hw * 0.5 + 0.85, -hw * 0.5 - 0.85, -hw * 0.5 + 0.85] : [-0.85, 0.85]);
    let s0 = 0;
    for (let si = 0; si + 1 < pts.length; si++) {
      const ax = pts[si]![0] - offX, az = pts[si]![1] - offZ;
      const dx = pts[si + 1]![0] - offX - ax, dz = pts[si + 1]![1] - offZ - az;
      const L2 = dx * dx + dz * dz;
      if (L2 < 1e-8) continue;
      const L = Math.sqrt(L2);
      const job: SegJob = { kind: road.kind, ax, az, dx, dz, L, L2, R, hw, sw, edgeLine: hw - 0.45, ruts, s0 };
      const zStart = Math.max(0, Math.floor(Math.min(az, az + dz) - R));
      const zEnd = Math.min(size - 1, Math.ceil(Math.max(az, az + dz) + R));
      for (let z = zStart; z <= zEnd; z++) segRow(c, job, z);
      s0 += L;
    }
  }
}

function segRow(c: GroundCtx, j: SegJob, z: number): void {
  const { size, out, prio } = c;
  const { kind, ax, az, dx, dz, L, L2, R, hw, sw, edgeLine, ruts, s0 } = j;
  const paved = kind !== 'track';
  const pz = z + 0.5;
  // この行でカプセル（線分 + 半径 R）にかかる t の範囲 → x の範囲
  let ta = 0, tb = 1;
  if (Math.abs(dz) > 1e-9) {
    const t1 = (pz - R - az) / dz, t2 = (pz + R - az) / dz;
    ta = Math.max(0, Math.min(t1, t2));
    tb = Math.min(1, Math.max(t1, t2));
    if (ta > tb) return;
  } else if (Math.abs(pz - az) > R) return;
  const xa = ax + dx * ta, xb = ax + dx * tb;
  const xStart = Math.max(0, Math.floor(Math.min(xa, xb) - R));
  const xEnd = Math.min(size - 1, Math.ceil(Math.max(xa, xb) + R));
  for (let x = xStart; x <= xEnd; x++) {
    const px = x + 0.5;
    let t = ((px - ax) * dx + (pz - az) * dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = px - (ax + dx * t), ez = pz - (az + dz * t);
    const d = Math.sqrt(ex * ex + ez * ez);
    if (d > hw + sw) continue;
    const q = d <= hw ? Math.floor((d / hw) * 100) : Math.min(254, 101 + Math.floor(((d - hw) / sw) * 150));
    const i = z * size + x;
    if (q >= prio[i]!) continue;
    prio[i] = q;

    loadS(c, i);
    const fine = S[S_FINE]!;
    const lat = dx * ez - dz * ex >= 0 ? d : -d;
    const surf = clamp01(hw + 0.5 - d); // 路面の被覆率（縁のぎざぎざを消す）

    // 路肩: 下地の上に砂利・土を薄く
    readPx(out, i, Q);
    if (surf < 1) {
      if (paved) setLerp(P, G.verge, G.gravel, fine!);
      else setLerp(P, G.dirt, G.grassDry, 0.5);
      mixBuf(Q, P, (1 - smoothstep(0.25, 1, (d - hw) / sw + (fine - 0.5) * 0.5)) * 0.85);
    }
    if (surf > 0) {
      let rd = 99;
      for (let r = 0; r < ruts.length; r++) rd = Math.min(rd, Math.abs(lat - ruts[r]!));
      const rut = Math.exp(-(rd * rd) / (2 * 0.35 * 0.35));
      if (paved) {
        asphaltColor(P);
        scale(P, 1 - 0.12 * rut);
        mixTo(P, G.verge, smoothstep(hw - 0.9, hw, d + (fine - 0.5) * 0.8) * 0.6); // 縁に草と土
        const wear = 0.5 + 0.35 * fine; // かすれた塗装
        if (kind !== 'lane' || hw >= 2) mixTo(P, G.lineWhite, lineCov(d - edgeLine, 0.2) * wear);
        if (kind === 'avenue') {
          mixTo(P, G.lineYellow, lineCov(lat, 0.25) * wear);
        } else if (kind === 'street') {
          const along = s0 + t * L;
          if (along - Math.floor(along / 10) * 10 < 5) mixTo(P, G.lineWhite, lineCov(lat, 0.22) * wear);
        }
      } else {
        setLerp(P, G.dirtDark, G.dirt, clamp01(fine * 0.6 + S[S_LOW]! * 0.4));
        mixTo(P, G.dirtRut, rut * 0.75);
        const al = Math.abs(lat);
        if (al < 0.5) mixTo(P, G.grassB, (1 - al / 0.5) * (0.45 + 0.35 * fine)); // 轍の間の草
        mixTo(P, G.grassB, smoothstep(hw - 0.7, hw + 0.2, d + (fine - 0.5) * 0.8) * 0.6);
      }
      mixBuf(Q, P, surf);
    }
    writePx(out, i, Q);
  }
}

// ---- 細かい凹凸

/** 周期 period（格子数）でつながる値ノイズ。 */
function pnoise(x: number, z: number, period: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const x0 = ((ix % period) + period) % period, z0 = ((iz % period) + period) % period;
  const x1 = (x0 + 1) % period, z1 = (z0 + 1) % period;
  const a = hash2(x0, z0, seed), b = hash2(x1, z0, seed), c = hash2(x0, z1, seed), d = hash2(x1, z1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/**
 * 細かい凹凸（RGBA、64 × 64、灰色、継ぎ目なくタイルする）。
 * 平均は mean（既定 128）。地面色に「×(texel / mean)」相当で掛けると明るさが変わらない。
 * 既存のシェーダが別の平均を前提にしているなら mean を合わせる。
 */
export function detailTexture(opts: { mean?: number; contrast?: number; seed?: number } = {}): Uint8Array {
  const N = 64;
  const mean = opts.mean ?? 128;
  const contrast = opts.contrast ?? 46;
  const seed = opts.seed ?? 7;
  const h = new Float32Array(N * N);
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      h[z * N + x] =
        // 大きい波を弱めにして、64 画素ごとの繰り返しを目立たせない
        pnoise(x / 16, z / 16, 4, seed) * 0.22 +
        pnoise(x / 8, z / 8, 8, seed + 1) * 0.34 +
        pnoise(x / 4, z / 4, 16, seed + 2) * 0.28 +
        pnoise(x / 2, z / 2, 32, seed + 3) * 0.16;
    }
  }
  const out = new Uint8Array(N * N * 4);
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const c = h[z * N + x]!;
      // 斜め上からの光で浮き出し（周期でつながるよう折り返して引く）
      const ul = h[((z + N - 1) % N) * N + ((x + N - 1) % N)]!;
      const dr = h[((z + 1) % N) * N + ((x + 1) % N)]!;
      const grain = hash2(x, z, seed + 9) - 0.5;
      const v = mean + contrast * ((c - 0.5) * 1.1 + (ul - dr) * 2.2 + grain * 0.3);
      const j = (z * N + x) * 4;
      const g = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
      out[j] = g; out[j + 1] = g; out[j + 2] = g; out[j + 3] = 255;
    }
  }
  return out;
}
