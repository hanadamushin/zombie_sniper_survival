// Landmarks of the kyushu region (L8: Kyushu and Okinawa). One line per landmark: its building type,
// real position and the side its front faces (types.ts). Building types:
// src/gen/buildings/defs/landmark/kyushu/, listed in src/gen/buildings/catalog/landmark_kyushu.ts; names
// in src/ui/i18n/ja.ts (the key is the type's id). Positions from the GSI annotations
// (tools/real/label-search.ts) unless a line says otherwise.

import type { LandmarkSpot } from './types.ts';

export const LANDMARKS_KYUSHU: readonly LandmarkSpot[] = [
  // Fukuoka: the tower on the Momochi seaside (cell 22236); Dazaifu Tenmangū (22405), 11 m from the
  // cell's north edge at the foot of the hills: the lot is levelled into a terrace (40 m south).
  { id: 'landmark.fukuoka_tower', lat: 33.5933, lon: 130.3515, rot: 0 },
  { id: 'landmark.dazaifu_tenmangu', lat: 33.5215, lon: 130.5348, rot: 0, level: 20 },
  // Saga: Karatsu Castle (22400). Its hill at the river mouth is a small peninsula, gone in the shrunk
  // area (the point is in the sea): the castle stands on the shore 23 m south, half its lot over the
  // water (drained). Yoshinogari's northern inner enclosure (22737, 32 m from the east edge; the point
  // is the park's west side of the enclosure, memory).
  { id: 'landmark.karatsu_castle', lat: 33.4565, lon: 129.9780, rot: 0, level: 30, drain: 0.5 },
  { id: 'landmark.yoshinogari', lat: 33.3285, lon: 130.3835, rot: 0 },
  // Nagasaki (23735): Ōura Church and the Glover House 120 m apart on the hillside over the harbour (12 m
  // in the area; the church first). The national road runs along the shore under them: both stand on
  // terraces cut into the hill (level). Hashima in the sea off the peninsula (23901), drawn small.
  { id: 'landmark.oura_cathedral', lat: 32.7342, lon: 129.8702, rot: 3, level: 30 },
  { id: 'landmark.glover_house', lat: 32.7332, lon: 129.8688, rot: 3, level: 30 },
  { id: 'landmark.hashima', lat: 32.6276, lon: 129.7385, rot: 1, drain: 1.1, reach: 16 },
  // Kumamoto (23575): the keep's point (32.8062, 130.7058) has the railway 10 m east and the moat round
  // it; left free the lot went 45 m west onto a high school's site (the cell lost the school). The point
  // is moved 470 m north into the castle grounds: the castle stands 49 m from the keep's shrunk point.
  { id: 'landmark.kumamoto_castle', lat: 32.8104, lon: 130.7062, rot: 0, drain: 0.3, reach: 16 },
  // Ōita: Umi Jigoku among the hells of Kannawa, Beppu (22747): national roads all round the point; the
  // lot is cut into the hillside above them (20 m north).
  { id: 'landmark.beppu_umi_jigoku', lat: 33.3165, lon: 131.4678, rot: 0, level: 20 },
  // Miyazaki: Aoshima Shrine (25586; the shrine's point is memory, the island's middle). The island is
  // too small to survive the shrinking: the lot stands in the sea (drained) and digs its sea back round
  // a small island.
  { id: 'landmark.aoshima_shrine', lat: 31.8048, lon: 131.4752, rot: 3, drain: 1.1, reach: 16 },
  // Kagoshima (25912): the wheel stands on the station building just east of the platforms (31.5840,
  // 130.5430). In the shrunk area the station's site fills that ground and a stream runs east of it:
  // the wheel took the station's site (the prefectural station fell to a town station). Its point is
  // moved 0.9 km south-east, beside the station's site (the station stays). Saigō's statue at the foot
  // of Shiroyama.
  { id: 'landmark.kagoshima_amu_run', lat: 31.5752, lon: 130.5529, rot: 1, reach: 16 },
  { id: 'landmark.saigo_statue', lat: 31.5953, lon: 130.5549, rot: 0 },
  // Okinawa: Shuri Castle (35906): the main hall is 24 m from the cell's east edge and 55 m from its
  // north edge; the point is between Shureimon and the hall, the lot on the hill between the edge and
  // Ryūtan pond (31 m). The Churaumi Aquarium on the slope over the sea in Ocean Expo Park (34906).
  { id: 'landmark.shuri_castle', lat: 26.2174, lon: 127.7182, rot: 3, level: 20 },
  { id: 'landmark.churaumi_aquarium', lat: 26.6946, lon: 127.8781, rot: 3, level: 20, drain: 0.25 },
  // L9: the Kanmon Bridge from the Moji shore over the strait (its motorway's line in cell 21574).
  { id: 'landmark.kanmon_bridge', lat: 33.96179, lon: 130.95852, rot: 0, bridge: { path: [[33.95765, 130.96731], [33.95906, 130.96384], [33.96575, 130.95082]], ends: [16, 9] } },
];
