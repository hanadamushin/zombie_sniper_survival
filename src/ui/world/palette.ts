// Colours of the strategic map. Zombie density uses the same log-quantised byte as the bundled
// timelapse snapshots, so one lookup table serves both.

import { quantizeZ } from '../../sim/world/scenario.ts';

export const SEA = '#0b121c';
export const UNKNOWN = '#2b3038';

type Stop = [number, number, number, number]; // position 0..1, r, g, b

function ramp(stops: Stop[], steps: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1]![0]) k++;
    const a = stops[k]!;
    const b = stops[k + 1]!;
    const f = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])));
    const ch = (j: 1 | 2 | 3): number => Math.round(a[j] + (b[j] - a[j]) * f);
    out.push(`rgb(${ch(1)},${ch(2)},${ch(3)})`);
  }
  return out;
}

/** Index = quantizeZ(z) (0 = none ... ~235 = millions). */
const Z_LUT = ramp([[0, 58, 22, 20], [0.3, 120, 24, 20], [0.52, 200, 44, 24], [0.7, 240, 130, 30], [0.86, 250, 215, 90], [1, 255, 252, 235]], 240);
const Z_NONE = '#27332c';
const POP_LUT = ramp([[0, 24, 32, 44], [0.35, 44, 74, 110], [0.6, 70, 140, 170], [0.82, 170, 210, 190], [1, 250, 250, 230]], 64);
const LOOT_LUT = ramp([[0, 40, 36, 30], [0.5, 110, 96, 50], [1, 222, 190, 90]], 32);

export function zColorQ(q: number): string {
  return q <= 0 ? Z_NONE : Z_LUT[Math.min(Z_LUT.length - 1, q)]!;
}
export function zColor(z: number): string {
  return zColorQ(quantizeZ(z));
}
export function popColor(pop: number): string {
  const t = Math.min(1, Math.log10(1 + pop) / 6.2);
  return POP_LUT[Math.round(t * (POP_LUT.length - 1))]!;
}
export function lootColor(loot: number): string {
  return LOOT_LUT[Math.round(Math.min(1, Math.max(0, loot)) * (LOOT_LUT.length - 1))]!;
}
/** CSS gradient for legends. */
export function legendGradient(kind: 'z' | 'pop' | 'loot'): string {
  const lut = kind === 'z' ? Z_LUT : kind === 'pop' ? POP_LUT : LOOT_LUT;
  const picks = [0, 0.25, 0.5, 0.75, 1].map((t) => lut[Math.round(t * (lut.length - 1))]!);
  return `linear-gradient(90deg, ${picks.join(', ')})`;
}
