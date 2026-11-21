// Fixed crossings between landmasses: tunnels, bridges and the ferries that still run (06).
// Each end is snapped to the nearest land cell. R0: the ends are the real landfalls of the bridges
// and tunnels (approximate to ~1 km, from the GSI map), and the ports of the two ferries.
// `minutes` is the game time of the crossing — longer than an ordinary cell (180).

export interface SeaLinkDef {
  name: string;
  a: [lat: number, lon: number];
  b: [lat: number, lon: number];
  minutes: number;
}

export const SEA_LINKS: SeaLinkDef[] = [
  { name: '青函トンネル', a: [41.18, 140.40], b: [41.56, 140.22], minutes: 480 }, // 今別 — 知内
  { name: '関門橋', a: [33.97, 130.96], b: [33.95, 130.95], minutes: 240 }, // 下関 壇之浦 — 門司 和布刈
  { name: '瀬戸大橋', a: [34.46, 133.81], b: [34.33, 133.84], minutes: 300 }, // 児島 — 坂出 番の州
  { name: 'しまなみ海道', a: [34.39, 133.21], b: [34.12, 132.99], minutes: 420 }, // 尾道 — 今治
  { name: '明石海峡大橋', a: [34.63, 135.02], b: [34.60, 134.99], minutes: 240 }, // 垂水 舞子 — 淡路 岩屋
  { name: '大鳴門橋', a: [34.25, 134.69], b: [34.23, 134.64], minutes: 240 }, // 淡路 福良 — 鳴門 孫崎
  { name: '佐渡航路', a: [37.95, 139.06], b: [38.08, 138.44], minutes: 600 }, // 新潟港 — 両津港
  { name: '沖縄航路', a: [31.59, 130.57], b: [26.22, 127.67], minutes: 2400 }, // 鹿児島新港 — 那覇港
];
