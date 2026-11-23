// Landmarks of the chubu region (L4). One line per landmark: its building type, real position and the
// side its front faces (types.ts). Building types: src/gen/buildings/defs/landmark/chubu/, listed in
// src/gen/buildings/catalog/landmark_chubu.ts; names in src/ui/i18n/ja.ts (the key is the type's id).

import type { LandmarkSpot } from './types.ts';

export const LANDMARKS_CHUBU: readonly LandmarkSpot[] = [
  // Aichi (Nagoya, cell 19289: the castle, the TV tower, the station's towers; Atsuta in 19456). The
  // castle stands over the remains of its moats (drain); the twin towers west of the station's tracks
  // (a band 100 m wide in the area, never cut), facing west; Atsuta between national roads (cutRoads).
  { id: 'landmark.nagoya_castle', lat: 35.18531, lon: 136.89956, rot: 0, drain: 0.3 },
  { id: 'landmark.mirai_tower', lat: 35.17198, lon: 136.90839, rot: 0 },
  { id: 'landmark.nagoya_twin_towers', lat: 35.17083, lon: 136.8825, rot: 3 },
  { id: 'landmark.atsuta_jingu', lat: 35.12796, lon: 136.90858, rot: 0, drain: 0.3, cutRoads: true },
  // Nagano: Matsumoto Castle (the moat south and west of the keep); Zenkō-ji, its gate to the south.
  { id: 'landmark.matsumoto_castle', lat: 36.23861, lon: 137.96889, rot: 0, drain: 0.3 },
  { id: 'landmark.zenkoji', lat: 36.66154, lon: 138.18781, rot: 0 },
  // Gifu: the gasshō village of Ogimachi in the Shō valley (a strip along the steep shrunk valley floor,
  // cutting the valley road); Gifu Castle on the top of Mount Kinka (the summit levelled).
  { id: 'landmark.shirakawago', lat: 36.2575, lon: 136.9064, rot: 0, drain: 0.2, level: 10, cutRoads: true },
  { id: 'landmark.gifu_castle', lat: 35.43397, lon: 136.78201, rot: 0, level: 30 },
  // Ishikawa (Kanazawa, cell 16782): the Kotoji lantern by its pond first (in the other order the gate
  // took the garden's place and they stood the wrong way round), then the Ishikawa Gate facing the garden.
  { id: 'landmark.kenrokuen_kotoji', lat: 36.5622, lon: 136.6627, rot: 0 },
  { id: 'landmark.kanazawa_ishikawamon', lat: 36.5629, lon: 136.6608, rot: 1 },
  // Niigata: Toki Messe on Bandai Island, its promenade on the Shinano River (west).
  { id: 'landmark.toki_messe', lat: 37.9268, lon: 139.0571, rot: 3, drain: 0.3 },
  // Toyama: the castle park's keep, the moat south of it.
  { id: 'landmark.toyama_castle', lat: 36.6933, lon: 137.2104, rot: 0 },
  // Fukui: the dinosaur museum on its hill in Katsuyama.
  { id: 'landmark.fukui_dinosaur_museum', lat: 36.0827, lon: 136.5067, rot: 0 },
  // Yamanashi: the Fuji Sengen shrine of Fujiyoshida (in place of the war memorial pagoda: PROGRESS.md L4).
  { id: 'landmark.fuji_sengen_jinja', lat: 35.4757, lon: 138.7958, rot: 1, drain: 0.15 },
  // Shizuoka: Kunōzan Tōshō-gū on its hill over Suruga Bay (south). The real point (34.962) is in cell
  // 19804, whose land ends 24 m south of it at the sea with only a 20 m strip at the cell's north edge:
  // the point is moved 470 m north into 19637, where the hill's south slope is (PROGRESS.md L4).
  { id: 'landmark.kunozan_toshogu', lat: 34.9662, lon: 138.4672, rot: 0, level: 30 },
];
