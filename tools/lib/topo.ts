// Minimal TopoJSON decoder (enough for world-atlas country files) — avoids a topojson-client dependency.
import { readFileSync } from 'node:fs';

interface Topology {
  transform?: { scale: [number, number]; translate: [number, number] };
  arcs: [number, number][][];
  objects: Record<string, { geometries: { id?: string; type: string; arcs: unknown }[] }>;
}

export type Ring = [number, number][]; // [lon, lat]

/** All rings (outer boundaries and holes alike) of one country, for even-odd rasterisation. */
export function countryRings(file: string, countryId: string): Ring[] {
  const topo = JSON.parse(readFileSync(file, 'utf8')) as Topology;
  const geom = topo.objects.countries!.geometries.find((g) => g.id === countryId);
  if (!geom) throw new Error(`country ${countryId} not found in ${file}`);
  const [sx, sy] = topo.transform?.scale ?? [1, 1];
  const [tx, ty] = topo.transform?.translate ?? [0, 0];
  const decoded = topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]): [number, number] => {
      x += dx;
      y += dy;
      return topo.transform ? [x * sx + tx, y * sy + ty] : [dx, dy];
    });
  });
  const ringOf = (indices: number[]): Ring => {
    const ring: Ring = [];
    for (const idx of indices) {
      const arc = idx >= 0 ? decoded[idx]! : decoded[~idx]!.slice().reverse();
      for (let i = ring.length ? 1 : 0; i < arc.length; i++) ring.push(arc[i]!);
    }
    return ring;
  };
  const polys = (geom.type === 'Polygon' ? [geom.arcs] : geom.arcs) as number[][][];
  return polys.flatMap((poly) => poly.map(ringOf));
}
