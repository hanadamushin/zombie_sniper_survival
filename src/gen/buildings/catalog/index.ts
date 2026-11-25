// Every enterable building type (07d), gathered from the per-category lists. Add a type to its
// category's file, never here (docs/buildings_guide.md).

import type { BuildingCategory, BuildingDef } from '../types.ts';
import { APARTMENT } from './apartment.ts';
import { BASE } from './base.ts';
import { HOUSE } from './house.ts';
import { MILITARY } from './military.ts';
import { OFFICE } from './office.ts';
import { PUBLIC } from './public.ts';
import { SHOP } from './shop.ts';
import { TRANSPORT } from './transport.ts';
// R0: landmarks, one list per region (R1..R8 fill their own).
import { LANDMARK_HOKKAIDO } from './landmark_hokkaido.ts';
import { LANDMARK_TOHOKU } from './landmark_tohoku.ts';
import { LANDMARK_KANTO } from './landmark_kanto.ts';
import { LANDMARK_CHUBU } from './landmark_chubu.ts';
import { LANDMARK_KINKI } from './landmark_kinki.ts';
import { LANDMARK_CHUGOKU } from './landmark_chugoku.ts';
import { LANDMARK_SHIKOKU } from './landmark_shikoku.ts';
import { LANDMARK_KYUSHU } from './landmark_kyushu.ts';
// L10: the ordinary bridges of the real areas.
import { LANDMARK_BRIDGES } from './landmark_bridges.ts';

export const CATALOG: Readonly<Record<BuildingCategory, readonly BuildingDef[]>> = {
  house: HOUSE,
  apartment: APARTMENT,
  shop: SHOP,
  office: OFFICE,
  public: PUBLIC,
  transport: TRANSPORT,
  military: MILITARY,
  base: BASE,
  landmark: [...LANDMARK_HOKKAIDO, ...LANDMARK_TOHOKU, ...LANDMARK_KANTO, ...LANDMARK_CHUBU, ...LANDMARK_KINKI, ...LANDMARK_CHUGOKU, ...LANDMARK_SHIKOKU, ...LANDMARK_KYUSHU, ...LANDMARK_BRIDGES],
};

export const BUILDING_DEFS: readonly BuildingDef[] = Object.values(CATALOG).flat();

const byId = new Map<string, BuildingDef>();
for (const [category, list] of Object.entries(CATALOG)) {
  for (const def of list) {
    if (byId.has(def.id)) throw new Error(`building type ${def.id} is registered twice`);
    if (def.category !== category) throw new Error(`building type ${def.id} is listed under ${category} but says ${def.category}`);
    if (def.id !== `${def.category}.${def.variant}`) throw new Error(`building type ${def.id}: the id must be <category>.<variant>`);
    byId.set(def.id, def);
  }
}

export function buildingDef(id: string): BuildingDef {
  const def = byId.get(id);
  if (!def) throw new Error(`unknown building type ${id}`);
  return def;
}

export function hasBuildingDef(id: string): boolean {
  return byId.has(id);
}
