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

export const CATALOG: Readonly<Record<BuildingCategory, readonly BuildingDef[]>> = {
  house: HOUSE,
  apartment: APARTMENT,
  shop: SHOP,
  office: OFFICE,
  public: PUBLIC,
  transport: TRANSPORT,
  military: MILITARY,
  base: BASE,
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
