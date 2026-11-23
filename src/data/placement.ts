// 07d-3: which enterable building types (src/gen/buildings, 07d-2a..2f) stand where, and how many.
// Read by the area generators (gen/real/layout.ts for the real map, gen/lands.ts for the random
// areas). docs/02_systems_spec.md §3.12 describes the rules.
//
// Districts: the town grade of a point (gen/real/layout.ts townGrade: 1 houses, 2 dense low-rise,
// 3 mid-rise, 4 high-rise core) and the grade of the cell's municipality (CellFacts.town: 1 village,
// 2 town, 3 city, 4 prefectural capital, 5 ordinance-designated city) choose a district; each district
// has a mix of types (relative weights). A type is only taken where its size range fits the lot.

export type District = 'rural' | 'suburb' | 'dense' | 'mid' | 'core' | 'industry';

/** Relative weights of the types of each district (07d-2 types; only those whose size fits the lot are drawn). */
export const MIX: Record<District, Record<string, number>> = {
  // Villages and the countryside: farmhouses, old houses, a convenience store and a filling station by the road now and then.
  rural: {
    'house.noka': 5, 'house.kominka': 2.5, 'house.hiraya': 3, 'house.wafu2': 3, 'house.wood2': 1.5, 'house.yofu2': 1, 'house.prefab': 1, 'house.nisetai': 0.8,
    'house.bessou': 0.25, 'apartment.mokuzo2': 0.3, 'shop.konbini_road': 0.3, 'shop.gas_station': 0.25, 'shop.minshuku': 0.15, 'shop.ryokan': 0.08,
    'shop.shut_yaoya': 0.12, 'shop.shut_sakaya': 0.15, 'public.machi_koba': 0.2, 'office.soko': 0.12, 'shop.ramen': 0.06,
  },
  // Detached houses of a town or city: houses, wooden flats, a store or a restaurant on the main streets.
  suburb: {
    'house.wood2': 3, 'house.yofu2': 3, 'house.wafu2': 2, 'house.nisetai': 2, 'house.hiraya': 1.5, 'house.prefab': 1, 'house.bessou': 0.15, 'house.kyosho3': 0.3,
    'house.tenpo': 0.4, 'apartment.mokuzo2': 1.5, 'apartment.tekkotsu3': 1, 'shop.konbini_road': 0.3, 'shop.konbini': 0.2, 'shop.gas_station': 0.15,
    'shop.ramen': 0.15, 'shop.famires': 0.1, 'shop.fastfood': 0.08, 'shop.kaitenzushi': 0.06, 'shop.shut_drug': 0.1, 'shop.bank': 0.05, 'public.machi_koba': 0.3,
    'public.clinic': 0.1, 'office.clinic': 0.05, 'office.juku': 0.05, 'public.koban': 0.04,
  },
  // Dense low-rise: narrow three-storey houses, shop-houses, shuttered shopping streets, small flats and offices.
  dense: {
    'house.kyosho3': 1.5, 'house.tenpo': 1.2, 'house.wood2': 2, 'house.yofu2': 1.5, 'house.wafu2': 0.5, 'house.nisetai': 0.5, 'apartment.mokuzo2': 2, 'apartment.tekkotsu3': 2,
    'shop.shut_yaoya': 0.25, 'shop.shut_honya': 0.2, 'shop.shut_yakkyoku': 0.2, 'shop.shut_denki': 0.2, 'shop.shut_fuku': 0.2, 'shop.shut_sakaya': 0.2,
    'shop.izakaya': 0.7, 'shop.ramen': 0.5, 'shop.konbini': 0.6, 'shop.konbini_tenant': 0.3, 'office.zakkyo_narrow': 0.8, 'office.small': 0.8,
    'office.shotengai3': 1, 'public.machi_koba': 0.5, 'public.clinic': 0.2, 'office.juku': 0.3, 'apartment.danchi5': 0.2, 'apartment.ryo': 0.2, 'public.koban': 0.08,
  },
  // Mid-rise: mixed-use buildings, flats, business hotels, a bank.
  mid: {
    'office.zakkyo5': 3, 'office.zakkyo_narrow': 1.5, 'office.small': 1.5, 'office.tenant': 1.5, 'office.rc_old': 1.5, 'office.clinic': 0.8, 'office.juku': 0.6,
    'office.glass_low': 0.8, 'office.ekimae': 0.6, 'office.mid': 1, 'office.soko': 0.5, 'apartment.mansion8': 2.5, 'apartment.danchi5': 1.2, 'apartment.shataku': 0.8,
    'apartment.ryo': 0.4, 'apartment.tekkotsu3': 0.8, 'shop.hotel_biz': 0.6, 'shop.bank': 0.3, 'shop.bank_city': 0.3, 'office.shogyo': 0.3, 'office.medical_mall': 0.3,
    'shop.famires': 0.3, 'shop.kaitenzushi': 0.2, 'shop.fastfood': 0.2, 'shop.konbini': 0.6, 'shop.izakaya': 0.4, 'shop.shut_drug': 0.2, 'public.koban': 0.08,
  },
  // High-rise core of a city: offices, hotels, department stores, a few towers (their roofs are firing positions).
  core: {
    'office.mid': 3, 'office.zakkyo5': 2, 'office.ekimae': 1.5, 'office.glass_low': 1, 'office.tenant': 1, 'shop.hotel_biz': 1.5, 'shop.bank_city': 1, 'office.shogyo': 1.5,
    'office.medical_mall': 0.7, 'office.mansion_shogyo': 1, 'apartment.mansion8': 1.5, 'office.tower20': 1, 'office.hotel_office': 0.6, 'office.skyscraper': 0.6,
    'office.tower_mansion': 0.8, 'office.depart': 0.3, 'office.chosha': 0.15, 'shop.konbini_tenant': 0.3, 'shop.izakaya': 0.3, 'public.koban': 0.1,
  },
  // Industrial land (the land use's "other" land in a town: works, depots, yards).
  industry: {
    'public.factory_food': 1.5, 'public.factory_metal': 1.5, 'public.factory_chem': 1, 'office.soko': 1.5, 'public.machi_koba': 1, 'shop.gas_station': 0.15,
  },
};

/**
 * Most of a type in one area (towers: their roofs see the whole town; big shops). Types not listed
 * have no cap. The designated-city cores (municipality grade 5) get `metroMul` times more.
 */
export const AREA_CAP: Record<string, number> = {
  'office.skyscraper': 2,
  'office.tower20': 3,
  'office.hotel_office': 2,
  'office.tower_mansion': 2,
  'office.mansion_shogyo': 3,
  'office.depart': 1,
  'office.chosha': 1,
  'shop.hotel_resort': 2,
  'shop.ryokan': 2,
  'shop.minshuku': 3,
  'house.bessou': 4,
  'shop.gas_station': 4,
  'shop.konbini_road': 6,
  'public.koban': 3,
  'shop.bank_city': 3,
  'shop.hotel_biz': 6,
};
export const METRO_CAP_MUL = 2;

/** Near the sea (lattice points of sea within `coastReach` m of a lot): seaside hotels and inns join the mix. */
export const COAST = {
  reach: 70,
  rural: { 'shop.minshuku': 0.8, 'shop.hotel_resort': 0.3, 'house.bessou': 0.3 } as Record<string, number>,
  suburb: { 'shop.hotel_resort': 0.25, 'shop.minshuku': 0.3 } as Record<string, number>,
};

/** Forest and mountain cells: villas and hot-spring inns in the villages. */
export const HILLS = { 'house.bessou': 0.8, 'shop.ryokan': 0.3, 'shop.minshuku': 0.3 } as Record<string, number>;

/** A lot of a house row (grade 1–2): the gap left between two buildings along the street, the setback. */
export const LOTS = {
  gap: [1.5, 3.5] as [number, number],
  setback: [1.5, 3] as [number, number],
  /** Lots of a mid-rise / high-rise block (urbanBlock): largest side by grade 3 / 4 (grade 3 of a big city's core: `metro`). */
  urbanMax: { 3: 34, 4: 46 } as Record<number, number>,
  urbanMaxMetro: 44,
  /** "Other" land of a town (works, depots): a candidate lot every `industryStep` m, its size. */
  industryStep: 27,
  industryLot: [62, 52] as [number, number],
  /** Share of a dense block given to one row of flats (danchi / company housing) instead of houses. */
  flats: 0.12,
  /** A block left open as a car park or square (grade 3–4). */
  open: 0.08,
  /**
   * Mid-rise lots of an urban cell drawn from the core mix: (share of the built-up land of grade 3+
   * − from) × slope, plus `metro` in a designated city (`capital` in a prefectural capital), at most `max`.
   * A cell with more than `metroShare` of grade 3+ land gets the metropolitan caps.
   */
  core: { from: 0.3, slope: 0.5, metro: 0.1, capital: 0.05, max: 0.35, metroShare: 0.6 },
};

// ---------------------------------------------------------------------------------------------
// Facilities at their real place (map.pois): the type of each kind and grade, and how many per area
// ---------------------------------------------------------------------------------------------

/**
 * Station types by station grade (0 unstaffed .. 4 designated-city). The busiest station of an area
 * takes its grade; the next one at most `second`, the others at most `others` (two terminal stations
 * of a designated city do not fit in one area). Grade 4 needs a municipality of grade 4 or more.
 */
export const STATIONS = {
  types: ['transport.station_mujin', 'transport.station_town', 'transport.station_city', 'transport.station_pref', 'transport.station_seirei'],
  second: 2,
  others: 1,
  max: 6,
  /** A station without a surface railway within this distance (m) is underground: a station-front building instead. */
  railReach: 70,
  underground: 'office.ekimae',
  /** Largest offset (m) of the real railway from the station's own tracks at the ends of the site before a smaller type is taken. */
  maxSkew: 14,
};

/** The navy's base: share of its back strip that must be sea, and of the rest that may be water (drained). */
export const NAVY = { seaBack: 0.3, wetRest: 0.2, back: 42 };

/**
 * In front of the main station (city, prefectural, designated-city types) of a city (municipality grade 3+):
 * these types by municipality grade, around a point `reach` m out from the station's front, within `shift` m.
 */
export const STATION_FRONT = {
  reach: 70,
  shift: 110,
  types: {
    3: ['shop.hotel_biz'],
    4: ['office.depart', 'shop.hotel_biz', 'office.tower20'],
    5: ['office.depart', 'office.skyscraper', 'office.hotel_office', 'office.tower_mansion'],
  } as Record<number, readonly string[]>,
};

/** Big sites: how far (m) their centre may move from the annotation, and the margin kept from the area edge (07c seams). */
export const SITES = {
  /** 07d-3 prompt: a garrison stays within 150 m of its annotation. */
  shift: { gsdf: 150, msdf: 300, asdf: 260, airport: 300, station: 60, facility: 120 } as Record<string, number>,
  edge: { big: 16, small: 14 },
  /** A site of this side (m) or more counts as big (edge margin, levelling). */
  big: 100,
  /** Levelling under a site: the largest height range (m) of its ground (more: try elsewhere) and the blend outside (m). */
  levelRange: { big: 14, small: 6, huge: 34 },
  /** A site of this side (m) or more (the large garrison, the big airports) is searched more coarsely and levelled more. */
  huge: 400,
  /** Share of building land within 500 m under which a division's post may be the large garrison. */
  sparseTown: 0.25,
  /** ... and under which a garrison of a rural or forest cell may be (its training grounds around it). */
  wildTown: 0.08,
  blend: 18,
  /** Blend of a huge site (gentler banks round a training ground cut into the hills). */
  blendHuge: 48,
  /** Share of the tiles of a big site that may be water (a pond, a ditch: drained under it). */
  drain: 0.03,
  /** The same for a huge site (the large garrison: the streams of its training grounds). */
  drainHuge: 0.07,
  /** Gap (m) kept between two sites and around a site from the roads that stay. */
  gap: 4,
  /** Search step (m) of the candidate centres. */
  step: 16,
};

/**
 * Data lines a site may cut (they stop at its fence; 07d-3 prompt: a garrison is one compound, the
 * municipal roads through it go; national roads, railways and rivers stay). Line kinds of
 * gen/real/format.ts LINE: 0 motorway, 1 national, 2 prefectural, 3 wide, 4 local, 10 rail, 11 shinkansen.
 */
export const CUTS: Record<string, readonly number[]> = {
  airport: [1, 2, 3, 4, 10],
  base: [2, 3, 4],
  navy: [1, 2, 3, 4],
  station: [1, 2, 3, 4, 10, 11],
  big: [3, 4],
  facility: [4],
  /** L1: a landmark's site (the prefectural, wide and local roads under it go; national roads and railways stay). */
  landmark: [2, 3, 4],
  /**
   * L3a: a landmark whose table line says `cutRoads` (central Tokyo: an expressway or a national road
   * every 60–120 m of the area) stops every road at its fence. The expressways are drawn as avenues on
   * the ground (no decks), so cutting one is the same as cutting a national road. Railways stay.
   */
  landmarkRoads: [0, 1, 2, 3, 4],
};

/** Per-area caps of the facility kinds (the real cells hold dozens of schools; the area holds a few). */
export const FACILITY_CAP = {
  prefOffice: 1,
  cityHall: 1,
  townHall: 1,
  hospitalLarge: 1,
  hospitalMid: 2,
  clinic: 3,
  university: 1,
  police: 1,
  fire: 1,
  elem: 3,
  junior: 2,
  high: 2,
  gsdf: 2,
  msdf: 1,
  asdf: 1,
  airport: 1,
};

/** Garrison types by annotation grade (1 sub-post, 2 garrison, 3 division / training area), smaller first where the bigger does not fit. */
export const GARRISONS: Record<number, readonly string[]> = {
  1: ['base.jgsdf_s', 'military.camp_battalion'],
  2: ['base.jgsdf_s', 'military.camp_battalion'],
  3: ['base.jgsdf_m', 'base.jgsdf_s'],
};
/** In the countryside (rural, forest cells) a division's post may be the large one (training grounds all round). */
export const GARRISON_LARGE = ['base.jgsdf_l', 'base.jgsdf_m', 'base.jgsdf_s'] as const;

export const AIRPORTS: Record<number, readonly string[]> = {
  1: ['transport.airport_s'],
  2: ['transport.airport_m', 'transport.airport_s'],
  3: ['transport.airport_l', 'transport.airport_m', 'transport.airport_s'],
};
/** An airport whose island is off the area (Kansai, Chubu, Tokushima): the terminal by the access bridge only. */
export const AIRPORT_TERMINAL = 'office.glass_low';

/**
 * 07d-2f field camps (ruins of the army's camps around the cities): cells next to an urban cell, of
 * these land classes, get one with this chance; the checkpoint stands across a main road.
 */
export const CAMPS = {
  lands: ['suburb', 'rural'] as readonly string[],
  chance: 0.35,
  /** Also in cells of a city (municipality grade 3+) of these lands. */
  cityChance: 0.15,
  types: [
    'military.camp_squad', 'military.camp_checkpoint', 'military.camp_hospital', 'military.camp_heliport', 'military.camp_supply',
    'military.camp_signal', 'military.camp_watch', 'military.camp_command', 'military.camp_motor', 'military.camp_battalion',
  ] as readonly string[],
};

/** Car park / square in front of a big facility (hospital, city hall, university...): depth (m). */
export const FORECOURT = { depth: 18, kinds: ['parking', 'plaza'] as const };

/** Random areas (no real data: tests, a cell whose file is missing): the facilities of a town, a whole block each. */
export const RANDOM_FACILITIES: Record<'urban' | 'suburb', readonly string[]> = {
  urban: ['transport.station_city', 'public.hospital_mid', 'public.police', 'public.fire', 'public.elem_city'],
  suburb: ['public.elem_city', 'public.clinic', 'public.koban'],
};
