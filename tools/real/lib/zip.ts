// Minimal ZIP reader (central directory + deflate), enough for the KSJ / e-Stat archives.
import { inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  name: string;
  read(): Buffer;
}

function decodeName(buf: Buffer, utf8: boolean): string {
  if (utf8) return buf.toString('utf8');
  try {
    return new TextDecoder('shift_jis').decode(buf);
  } catch {
    return buf.toString('latin1');
  }
}

export function readZip(zip: Buffer): ZipEntry[] {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip file');
  let count = zip.readUInt16LE(eocd + 10);
  let cd = zip.readUInt32LE(eocd + 16);
  // ZIP64 (very large archives)
  if (cd === 0xffffffff || count === 0xffff) {
    const loc = eocd - 20;
    if (zip.readUInt32LE(loc) === 0x07064b50) {
      const rec = Number(zip.readBigUInt64LE(loc + 8));
      count = Number(zip.readBigUInt64LE(rec + 32));
      cd = Number(zip.readBigUInt64LE(rec + 48));
    }
  }
  const out: ZipEntry[] = [];
  let p = cd;
  for (let k = 0; k < count; k++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const flags = zip.readUInt16LE(p + 8);
    const method = zip.readUInt16LE(p + 10);
    let csize = zip.readUInt32LE(p + 20);
    const nlen = zip.readUInt16LE(p + 28);
    const xlen = zip.readUInt16LE(p + 30);
    const clen = zip.readUInt16LE(p + 32);
    let local = zip.readUInt32LE(p + 42);
    const name = decodeName(zip.subarray(p + 46, p + 46 + nlen), (flags & 0x800) !== 0);
    // ZIP64 extra field
    if (csize === 0xffffffff || local === 0xffffffff) {
      let x = p + 46 + nlen;
      const end = x + xlen;
      while (x < end) {
        const id = zip.readUInt16LE(x);
        const size = zip.readUInt16LE(x + 2);
        if (id === 1) {
          let q = x + 4;
          if (zip.readUInt32LE(p + 24) === 0xffffffff) q += 8;
          if (csize === 0xffffffff) { csize = Number(zip.readBigUInt64LE(q)); q += 8; }
          if (local === 0xffffffff) local = Number(zip.readBigUInt64LE(q));
        }
        x += 4 + size;
      }
    }
    const lo = local;
    const cs = csize;
    out.push({
      name,
      read(): Buffer {
        const n = zip.readUInt16LE(lo + 26);
        const x = zip.readUInt16LE(lo + 28);
        const data = zip.subarray(lo + 30 + n + x, lo + 30 + n + x + cs);
        if (method === 0) return Buffer.from(data);
        if (method === 8) return inflateRawSync(data);
        throw new Error(`zip method ${method} not supported (${name})`);
      },
    });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

/** The first entry whose name matches. */
export function zipEntry(zip: Buffer, test: (name: string) => boolean): ZipEntry | null {
  return readZip(zip).find((e) => test(e.name)) ?? null;
}
