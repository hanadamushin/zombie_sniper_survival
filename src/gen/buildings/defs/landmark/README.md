# Landmark buildings (L1–L8)

One folder per region (`hokkaido/`, `tohoku/`, … `kyushu/`). A landmark is an **exterior-only** 07d
blueprint written with `landmarkDef` (`common.ts`), category `landmark`, id `landmark.<variant>`,
listed in `src/gen/buildings/catalog/landmark_<region>.ts`. Where it stands: one line in
`src/data/landmarks/<region>.ts` (id, lat / lon, the side its front faces). Its name: `src/ui/i18n/ja.ts`
under the same key. Everything else (placing it in its real area, drawing it to the fog, the
strategic map's mark, the `?landmarks=1` yard, the tests) follows. See `docs/realmap_guide.md` §7.
