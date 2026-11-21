// ESRI shapefile (.shp + .dbf) reader for the KSJ archives: points, polylines and polygons in
// lon/lat. Attributes come back as strings keyed by field name.

export type Ring = [number, number][];
export interface Shape {
  /** 1 point, 3 polyline, 5 polygon (Z / M variants are folded into these). */
  type: number;
  /** Parts: one ring / line per part; a point is one part with one vertex. */
  parts: Ring[];
  bbox: [number, number, number, number];
}

export function readShp(buf: Buffer): Shape[] {
  const out: Shape[] = [];
  let p = 100;
  while (p + 8 <= buf.length) {
    const len = buf.readInt32BE(p + 4) * 2;
    const r = p + 8;
    const type = buf.readInt32LE(r);
    const base = type % 10 === 1 || type === 1 ? 1 : type % 10 === 3 || type === 3 ? 3 : type % 10 === 5 || type === 5 ? 5 : type % 10 === 8 ? 8 : 0;
    if (base === 1) {
      const x = buf.readDoubleLE(r + 4);
      const y = buf.readDoubleLE(r + 12);
      out.push({ type: 1, parts: [[[x, y]]], bbox: [x, y, x, y] });
    } else if (base === 3 || base === 5) {
      const bbox: [number, number, number, number] = [buf.readDoubleLE(r + 4), buf.readDoubleLE(r + 12), buf.readDoubleLE(r + 20), buf.readDoubleLE(r + 28)];
      const np = buf.readInt32LE(r + 36);
      const nv = buf.readInt32LE(r + 40);
      const starts: number[] = [];
      for (let i = 0; i < np; i++) starts.push(buf.readInt32LE(r + 44 + i * 4));
      const v0 = r + 44 + np * 4;
      const parts: Ring[] = [];
      for (let i = 0; i < np; i++) {
        const a = starts[i]!;
        const b = i + 1 < np ? starts[i + 1]! : nv;
        const ring: Ring = [];
        for (let k = a; k < b; k++) ring.push([buf.readDoubleLE(v0 + k * 16), buf.readDoubleLE(v0 + k * 16 + 8)]);
        parts.push(ring);
      }
      out.push({ type: base, parts, bbox });
    } else if (base === 8) {
      const np = buf.readInt32LE(r + 36);
      const parts: Ring[] = [];
      for (let k = 0; k < np; k++) parts.push([[buf.readDoubleLE(r + 40 + k * 16), buf.readDoubleLE(r + 48 + k * 16)]]);
      out.push({ type: 1, parts, bbox: [0, 0, 0, 0] });
    } else {
      out.push({ type: 0, parts: [], bbox: [0, 0, 0, 0] });
    }
    p = r + len;
  }
  return out;
}

export function readDbf(buf: Buffer, encoding: 'utf-8' | 'shift_jis' = 'utf-8'): Record<string, string>[] {
  const n = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recLen = buf.readUInt16LE(10);
  const fields: { name: string; len: number }[] = [];
  for (let p = 32; buf[p] !== 0x0d && p < headerLen; p += 32) {
    const name = buf.subarray(p, p + 11).toString('latin1').replace(/\0.*$/, '');
    fields.push({ name, len: buf[p + 16]! });
  }
  const dec = new TextDecoder(encoding);
  const out: Record<string, string>[] = [];
  for (let i = 0; i < n; i++) {
    let p = headerLen + i * recLen + 1;
    const rec: Record<string, string> = {};
    for (const f of fields) {
      rec[f.name] = dec.decode(buf.subarray(p, p + f.len)).trim();
      p += f.len;
    }
    out.push(rec);
  }
  return out;
}

/** Point-in-polygon (even-odd over all rings). */
export function inRings(rings: Ring[], x: number, y: number): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[i]!;
      const [x2, y2] = ring[j]!;
      if (y1 > y !== y2 > y && x < x1 + ((y - y1) / (y2 - y1)) * (x2 - x1)) inside = !inside;
    }
  }
  return inside;
}
