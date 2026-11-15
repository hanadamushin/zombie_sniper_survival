// Fixed crossings between landmasses: tunnels, bridges and the ferries that still run (06).
// Each end is snapped to the nearest land cell, so pick points a little inland on the right side.
// `minutes` is the game time of the crossing — longer than an ordinary cell (180).

export interface SeaLinkDef {
  name: string;
  a: [lat: number, lon: number];
  b: [lat: number, lon: number];
  minutes: number;
}

export const SEA_LINKS: SeaLinkDef[] = [
  { name: '青函トンネル', a: [41.15, 140.5], b: [41.6, 140.35], minutes: 480 },
  { name: '関門橋', a: [34.02, 131.0], b: [33.82, 130.9], minutes: 240 },
  { name: '瀬戸大橋', a: [34.52, 133.8], b: [34.25, 133.85], minutes: 300 },
  { name: 'しまなみ海道', a: [34.45, 133.15], b: [34.0, 132.95], minutes: 420 },
  { name: '明石海峡大橋', a: [34.72, 135.0], b: [34.5, 134.92], minutes: 240 },
  { name: '大鳴門橋', a: [34.28, 134.75], b: [34.12, 134.5], minutes: 240 },
  { name: '佐渡航路', a: [37.85, 139.0], b: [38.02, 138.4], minutes: 600 },
  { name: '沖縄航路', a: [31.5, 130.55], b: [26.35, 127.8], minutes: 2400 },
];
