// Kokudo Suuchi Joho (国土数値情報) and e-Stat archives: download (cached) and read.
import { fetchCached } from './fetch.ts';
import { readZip } from './zip.ts';
import { readDbf, readShp, type Shape } from './shp.ts';

export const KSJ = 'https://nlftp.mlit.go.jp/ksj/gml/data';

/** Download a KSJ zip (path below /ksj/gml/data/). */
export async function ksjZip(path: string): Promise<Buffer | null> {
  return fetchCached(`${KSJ}/${path}`, `ksj/${path}`);
}

export interface Layer {
  shapes: Shape[];
  attrs: Record<string, string>[];
}

/**
 * Read one shapefile layer from a zip: the .shp/.dbf whose name contains `match` (UTF-8 folder
 * preferred). Nested zips (national archives of per-prefecture zips) are searched too.
 */
export function shpLayer(zip: Buffer, match: string | RegExp): Layer | null {
  const entries = readZip(zip);
  const test = (n: string): boolean => (typeof match === 'string' ? n.includes(match) : match.test(n));
  const pick = (ext: string): (typeof entries)[number] | undefined => {
    const c = entries.filter((e) => e.name.toLowerCase().endsWith(ext) && test(e.name));
    return c.find((e) => /utf-?8/i.test(e.name)) ?? c[0];
  };
  const shp = pick('.shp');
  const dbf = pick('.dbf');
  if (!shp || !dbf) return null;
  const cpg = pick('.cpg');
  let enc: 'utf-8' | 'shift_jis' = /shift[-_]?jis/i.test(dbf.name) ? 'shift_jis' : 'utf-8';
  if (cpg) enc = /utf/i.test(cpg.read().toString()) ? 'utf-8' : 'shift_jis';
  else if (!/utf-?8/i.test(dbf.name)) {
    // No code page: guess from the bytes.
    const sample = dbf.read().subarray(0, 4000);
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(sample);
    } catch {
      enc = 'shift_jis';
    }
  }
  return { shapes: readShp(shp.read()), attrs: readDbf(dbf.read(), enc) };
}

/** e-Stat 2020 census, 1 km mesh (persons per 3rd-level mesh) for one 1st-level mesh. */
export async function estatPopulation(mesh1: number): Promise<Map<number, number>> {
  const buf = await fetchCached(`https://www.e-stat.go.jp/gis/statmap-search/data?statsId=T001140&code=${mesh1}&downloadType=2`, `estat/T001140_${mesh1}.zip`);
  const out = new Map<number, number>();
  if (!buf || buf.readUInt32LE(0) !== 0x04034b50) return out;
  const entry = readZip(buf).find((e) => e.name.endsWith('.txt'));
  if (!entry) return out;
  const text = new TextDecoder('shift_jis').decode(entry.read());
  for (const line of text.split(/\r?\n/)) {
    const f = line.split(',');
    const code = Number(f[0]);
    if (!Number.isFinite(code) || code < 1e7) continue;
    const pop = Number(f[4]);
    if (Number.isFinite(pop)) out.set(code, pop);
  }
  return out;
}

/** Centre (lat, lon) of a 3rd-level (1 km) mesh code. */
export function mesh3Center(code: number): [number, number] {
  const s = String(code);
  const p = Number(s.slice(0, 2));
  const u = Number(s.slice(2, 4));
  const q = Number(s[4]);
  const v = Number(s[5]);
  const r = Number(s[6]);
  const w = Number(s[7]);
  const lat = p / 1.5 + q / 12 + r / 120 + 1 / 240;
  const lon = u + 100 + v / 8 + w / 80 + 1 / 160;
  return [lat, lon];
}
