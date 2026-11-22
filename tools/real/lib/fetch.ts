// Polite, cached downloads for the real-map pipeline (R0).
//
//   await fetchCached(url, 'gsi/dem/12/3570/1620.txt')   -> Buffer | null (null: 404 / no data)
//
// Every file is kept under tmp/realdata/ (not committed) and never downloaded twice. Requests are
// spaced so that no more than RATE start per second (the data providers ask for restraint), and a
// generic User-Agent is sent (no personal details). curl does the transfer: it honours the
// HTTPS_PROXY / CA settings of the build environment without extra code.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CACHE_DIR = fileURLToPath(new URL('../../../tmp/realdata/', import.meta.url));
const RATE = 5;
const MAX_PARALLEL = 5;
const UA = 'zss-realmap-build/1.0 (offline game data converter)';

let lastStarts: number[] = [];
let active = 0;
const waiters: (() => void)[] = [];
export const stats = { downloaded: 0, cached: 0, missing: 0, bytes: 0 };

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function slot(): Promise<void> {
  while (active >= MAX_PARALLEL) await new Promise<void>((r) => waiters.push(r));
  active++;
  for (;;) {
    const now = Date.now();
    lastStarts = lastStarts.filter((t) => now - t < 1000);
    if (lastStarts.length < RATE) {
      lastStarts.push(now);
      return;
    }
    await sleep(1000 - (now - lastStarts[0]!) + 5);
  }
}
function release(): void {
  active--;
  waiters.shift()?.();
}

function curl(url: string, out: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn('curl', ['-s', '-L', '--retry', '3', '--retry-delay', '2', '-A', UA, '-o', out, '-w', '%{http_code}', url]);
    let code = '';
    p.stdout.on('data', (d: Buffer) => (code += d.toString()));
    p.on('error', reject);
    p.on('close', (status) => (status === 0 ? resolve(Number(code)) : reject(new Error(`curl ${status} for ${url}`))));
  });
}

/** Path of a cache entry. */
export function cachePath(key: string): string {
  return join(CACHE_DIR, key);
}

/**
 * Download `url` once into tmp/realdata/<key>. Returns the bytes, or null when the server has no
 * such file (404 / 204: e.g. a tile over the sea). The "missing" answer is cached too.
 */
export async function fetchCached(url: string, key: string): Promise<Buffer | null> {
  const path = cachePath(key);
  const miss = `${path}.404`;
  if (existsSync(path)) {
    stats.cached++;
    return readFileSync(path);
  }
  if (existsSync(miss)) {
    stats.missing++;
    return null;
  }
  mkdirSync(dirname(path), { recursive: true });
  await slot();
  try {
    const tmp = `${path}.part`;
    let status = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      // R9: a dropped connection (curl exit 35 / 56 through the build proxy) is retried like a 5xx
      // instead of ending the whole region run.
      status = await curl(url, tmp).catch((e: unknown) => {
        if (attempt === 3) throw e;
        return 599;
      });
      if (status !== 0 && status < 500 && status !== 429) break;
      await sleep(2000 * (attempt + 1));
    }
    if (status === 404 || status === 204 || status === 400) {
      rmSync(tmp, { force: true });
      writeFileSync(miss, '');
      stats.missing++;
      return null;
    }
    if (status !== 200) throw new Error(`HTTP ${status} for ${url}`);
    renameSync(tmp, path);
    const buf = readFileSync(path);
    stats.downloaded++;
    stats.bytes += buf.length;
    return buf;
  } finally {
    release();
  }
}

/** Run `fn` over items with the fetcher's parallelism (order of results = order of items). */
export async function mapLimit<T, R>(items: readonly T[], fn: (item: T, i: number) => Promise<R>, limit = MAX_PARALLEL * 2): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
