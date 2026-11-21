// Mapbox Vector Tile (protobuf) decoder — just what the GSI vector tiles need. No dependency.
//
// Geometry is returned in tile units (0..extent), rings / lines as arrays of [x, y].

export type Pt = [number, number];
export interface MvtFeature {
  type: 1 | 2 | 3; // point, line, polygon
  props: Record<string, string | number | boolean>;
  /** Points: one part per point. Lines: one part per line. Polygons: rings (outer + holes). */
  geom: Pt[][];
}
export interface MvtLayer {
  name: string;
  extent: number;
  features: MvtFeature[];
}

class Reader {
  pos = 0;
  buf: Uint8Array;
  end: number;
  constructor(buf: Uint8Array, end = buf.length) {
    this.buf = buf;
    this.end = end;
  }
  varint(): number {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = this.buf[this.pos++]!;
      result += (b & 0x7f) * 2 ** shift;
      shift += 7;
    } while (b & 0x80);
    return result;
  }
  skip(wire: number): void {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) this.pos += this.varint();
    else if (wire === 5) this.pos += 4;
    else throw new Error(`wire type ${wire}`);
  }
  sub(): Reader {
    const len = this.varint();
    const r = new Reader(this.buf, this.pos + len);
    r.pos = this.pos;
    this.pos += len;
    return r;
  }
}

const zz = (n: number): number => (n % 2 === 1 ? -(n + 1) / 2 : n / 2);

function readValue(r: Reader): string | number | boolean {
  let v: string | number | boolean = '';
  while (r.pos < r.end) {
    const tag = r.varint();
    const f = tag >> 3;
    const w = tag & 7;
    const dv = new DataView(r.buf.buffer, r.buf.byteOffset);
    if (f === 1) {
      const len = r.varint();
      v = new TextDecoder().decode(r.buf.subarray(r.pos, r.pos + len));
      r.pos += len;
    } else if (f === 2) { v = dv.getFloat32(r.pos, true); r.pos += 4; }
    else if (f === 3) { v = dv.getFloat64(r.pos, true); r.pos += 8; }
    else if (f === 4 || f === 5) v = r.varint();
    else if (f === 6) v = zz(r.varint());
    else if (f === 7) v = r.varint() !== 0;
    else r.skip(w);
  }
  return v;
}

function decodeGeom(cmds: number[], type: number): Pt[][] {
  const parts: Pt[][] = [];
  let cur: Pt[] = [];
  let x = 0;
  let y = 0;
  let i = 0;
  while (i < cmds.length) {
    const c = cmds[i++]!;
    const id = c & 7;
    const count = c >> 3;
    if (id === 1 || id === 2) {
      for (let k = 0; k < count; k++) {
        x += zz(cmds[i++]!);
        y += zz(cmds[i++]!);
        if (id === 1) {
          if (cur.length) parts.push(cur);
          cur = [];
        }
        cur.push([x, y]);
      }
    } else if (id === 7) {
      if (type === 3 && cur.length) cur.push([cur[0]![0], cur[0]![1]]);
    }
  }
  if (cur.length) parts.push(cur);
  return parts;
}

export function decodeMvt(buf: Uint8Array): MvtLayer[] {
  const r = new Reader(buf);
  const layers: MvtLayer[] = [];
  while (r.pos < r.end) {
    const tag = r.varint();
    if (tag >> 3 !== 3 || (tag & 7) !== 2) {
      r.skip(tag & 7);
      continue;
    }
    const lr = r.sub();
    let name = '';
    let extent = 4096;
    const keys: string[] = [];
    const values: (string | number | boolean)[] = [];
    const raw: { type: number; tags: number[]; geom: number[] }[] = [];
    while (lr.pos < lr.end) {
      const t = lr.varint();
      const f = t >> 3;
      if (f === 1) {
        const len = lr.varint();
        name = new TextDecoder().decode(lr.buf.subarray(lr.pos, lr.pos + len));
        lr.pos += len;
      } else if (f === 2) {
        const fr = lr.sub();
        const feat = { type: 0, tags: [] as number[], geom: [] as number[] };
        while (fr.pos < fr.end) {
          const ft = fr.varint();
          const ff = ft >> 3;
          if (ff === 2 || ff === 4) {
            const pr = fr.sub();
            const arr = ff === 2 ? feat.tags : feat.geom;
            while (pr.pos < pr.end) arr.push(pr.varint());
          } else if (ff === 3) feat.type = fr.varint();
          else fr.skip(ft & 7);
        }
        raw.push(feat);
      } else if (f === 3) {
        const len = lr.varint();
        keys.push(new TextDecoder().decode(lr.buf.subarray(lr.pos, lr.pos + len)));
        lr.pos += len;
      } else if (f === 4) values.push(readValue(lr.sub()));
      else if (f === 5) extent = lr.varint();
      else lr.skip(t & 7);
    }
    const features = raw.map((f): MvtFeature => {
      const props: MvtFeature['props'] = {};
      for (let k = 0; k + 1 < f.tags.length; k += 2) props[keys[f.tags[k]!]!] = values[f.tags[k + 1]!]!;
      return { type: (f.type || 2) as 1 | 2 | 3, props, geom: decodeGeom(f.geom, f.type) };
    });
    layers.push({ name, extent, features });
  }
  return layers;
}
