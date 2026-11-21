// Building types of the 'transport' category (07d). Each type lives in its own file under
// src/gen/buildings/defs/transport/ and is listed here — this file belongs to the session making transport buildings.
// See docs/buildings_guide.md.

import type { BuildingDef } from '../types.ts';
import { TRANSPORT_STATION_MUJIN } from '../defs/transport/station_mujin.ts';
import { TRANSPORT_STATION_TOWN } from '../defs/transport/station_town.ts';
import { TRANSPORT_STATION_CITY } from '../defs/transport/station_city.ts';
import { TRANSPORT_STATION_PREF } from '../defs/transport/station_pref.ts';
import { TRANSPORT_STATION_SEIREI } from '../defs/transport/station_seirei.ts';
import { TRANSPORT_AIRPORT_S } from '../defs/transport/airport_s.ts';
import { TRANSPORT_AIRPORT_M } from '../defs/transport/airport_m.ts';
import { TRANSPORT_AIRPORT_L } from '../defs/transport/airport_l.ts';

export const TRANSPORT: readonly BuildingDef[] = [
  TRANSPORT_STATION_MUJIN, TRANSPORT_STATION_TOWN, TRANSPORT_STATION_CITY, TRANSPORT_STATION_PREF, TRANSPORT_STATION_SEIREI,
  TRANSPORT_AIRPORT_S, TRANSPORT_AIRPORT_M, TRANSPORT_AIRPORT_L,
];
