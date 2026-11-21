// GSI elevation tiles (標高タイル): 256 × 256 comma-separated metres per tile, "e" = no data (sea).
import { fetchCached } from './fetch.ts';
import { latToY, lonToX } from './tiles.ts';

const memo = new Map<string, Float32Array | null>();

/**
 * One elevation tile (NaN where there is no data). `kind` 'dem' is DEM10B (z <= 14), 'dem5a' the
 * 5 m laser survey (z 15, not everywhere). Kept in memory (callers sample many points per tile).
 */
export async function demTile(kind: 'dem' | 'dem5a', z: number, x: number, y: number): Promise<Float32Array | null> {
  const key = `${kind}/${z}/${x}/${y}`;
  if (memo.has(key)) return memo.get(key)!;
  const buf = await fetchCached(`https://cyberjapandata.gsi.go.jp/xyz/${key}.txt`, `gsi/${key}.txt`);
  let out: Float32Array | null = null;
  if (buf) {
    out = new Float32Array(256 * 256).fill(NaN);
    const rows = buf.toString('latin1').split('\n');
    for (let j = 0; j < 256 && j < rows.length; j++) {
      const v = rows[j]!.split(',');
      for (let i = 0; i < 256 && i < v.length; i++) {
        const s = v[i]!;
        if (s !== 'e' && s !== '') out[j * 256 + i] = Number(s);
      }
    }
  }
  if (memo.size > 3000) memo.clear();
  memo.set(key, out);
  return out;
}

/** Elevation at a point from tiles of zoom z (nearest pixel; NaN over the sea / missing tiles). Tiles must be preloaded with `demTile`. */
export function demAt(kind: 'dem' | 'dem5a', z: number, lat: number, lon: number): number {
  const X = lonToX(lon, z);
  const Y = latToY(lat, z);
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const t = memo.get(`${kind}/${z}/${x}/${y}`);
  if (!t) return NaN;
  const px = Math.min(255, Math.floor((X - x) * 256));
  const py = Math.min(255, Math.floor((Y - y) * 256));
  return t[py * 256 + px]!;
}

/** Bilinear elevation (pixel centres); NaN if any of the four is missing. */
export function demBilinear(kind: 'dem' | 'dem5a', z: number, lat: number, lon: number): number {
  const X = lonToX(lon, z) * 256 - 0.5;
  const Y = latToY(lat, z) * 256 - 0.5;
  const x0 = Math.floor(X);
  const y0 = Math.floor(Y);
  const fx = X - x0;
  const fy = Y - y0;
  const px = (gx: number, gy: number): number => {
    const t = memo.get(`${kind}/${z}/${Math.floor(gx / 256)}/${Math.floor(gy / 256)}`);
    if (!t) return NaN;
    return t[(gy & 255) * 256 + (gx & 255)]!;
  };
  const a = px(x0, y0);
  const b = px(x0 + 1, y0);
  const c = px(x0, y0 + 1);
  const d = px(x0 + 1, y0 + 1);
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}
