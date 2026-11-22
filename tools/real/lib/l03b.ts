// KSJ L03-b land-use subdivision mesh (100 m, 2021): one 800 × 800 grid per first-level mesh.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { LU } from '../../../src/gen/real/format.ts';
import { cachePath } from './fetch.ts';
import { ksjZip } from './ksj.ts';
import { readZip } from './zip.ts';

/** L03-b code -> land-use class. */
const CODES: Record<string, number> = {
  '0100': LU.paddy,
  '0200': LU.field,
  '0500': LU.forest,
  '0600': LU.waste,
  '0700': LU.building,
  '0901': LU.road,
  '0902': LU.rail,
  '1000': LU.other,
  '1100': LU.water,
  '1400': LU.beach,
  '1500': LU.sea,
  '1600': LU.golf,
};

const memo = new Map<number, Uint8Array | null>();

/** 800 × 800 classes of a first-level mesh, row 0 = north. null when the mesh has no data. */
export async function l03b(mesh1: number): Promise<Uint8Array | null> {
  if (memo.has(mesh1)) return memo.get(mesh1)!;
  const cached = cachePath(`l03b/${mesh1}.u8`);
  let out: Uint8Array | null = null;
  if (existsSync(cached)) out = new Uint8Array(readFileSync(cached));
  else {
    const zip = await ksjZip(`L03-b/L03-b-21/L03-b-21_${mesh1}-jgd2011_GML.zip`);
    if (zip) {
      // R3: not the metadata file KS-META-L03-b-21_<mesh>.xml (it comes first in some zips: the whole
      // mesh then read as "none"). R4: some zips name their entries with a backslash folder
      // (`L03-b-21_5538-jgd2011_GML\L03-b-21_5538.xml`, 6 of Chubu's 27): either separator.
      const entry = readZip(zip).find((e) => /(^|[\\/])L03-b-21_\d+\.xml$/.test(e.name));
      if (!entry) throw new Error(`L03-b ${mesh1}: no land-use grid among ${readZip(zip).map((e) => e.name).join(', ')}`);
      {
        const text = entry.read().toString('utf8');
        const a = text.indexOf('<gml:tupleList>');
        const b = text.indexOf('</gml:tupleList>', a);
        if (a < 0 || b < 0) throw new Error(`L03-b ${mesh1}: no tupleList in ${entry.name}`);
        const vals = text.slice(a + 15, b).trim().split(/\s+/);
        out = new Uint8Array(800 * 800);
        for (let i = 0; i < out.length && i < vals.length; i++) out[i] = CODES[vals[i]!] ?? LU.none;
        mkdirSync(dirname(cached), { recursive: true });
        writeFileSync(cached, out);
      }
    }
  }
  memo.set(mesh1, out);
  return out;
}

/** First-level mesh code of a point. */
export function mesh1Of(lat: number, lon: number): number {
  return Math.floor(lat * 1.5) * 100 + Math.floor(lon - 100);
}

/** Class at a point (meshes must be loaded with l03b first); none outside the data. */
export function l03bAt(lat: number, lon: number): number {
  const m = mesh1Of(lat, lon);
  const grid = memo.get(m);
  if (!grid) return LU.none;
  const lat0 = Math.floor(lat * 1.5) / 1.5;
  const lon0 = Math.floor(lon);
  const col = Math.min(799, Math.floor((lon - lon0) * 800));
  const row = Math.min(799, Math.floor((lat0 + 2 / 3 - lat) * 1200));
  return grid[row * 800 + col]!;
}
