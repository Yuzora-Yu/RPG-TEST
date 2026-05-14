# PRISMA ABYSS Map And Travel System

This document records the current fixed-map, transport, and travel-item implementation.

## Fixed Map Data

- `map.js` is the source of truth for world coordinates, fixed field maps, fixed dungeon maps, tile themes, and overlay rules.
- `STORY_DATA.areas` owns each named area's world coordinate, rank, and optional `fieldTile` for world-map landmark rendering.
- `FIXED_MAPS` owns field-style fixed maps such as villages, abyss outer field, and shrine-style areas.
- `FIXED_DUNGEON_MAPS` owns fixed dungeon bases and floor arrays. `MapRegistry.getFixedDungeonFloor()` merges base and floor data for runtime use.
- `MapRegistry` also owns fixed-map helpers for map actions, floor links, fixed chests, fixed bosses, world coordinate lookup, overlay lookup, and stair direction labels.

## Tile Rendering

- `TILE_THEMES` maps tile letters to `assets.js` graphic keys and fallback colors.
- Fixed maps can set `themeKey` and `tileOverrides` to reuse a regional theme while overriding only local symbols.
- Fixed-map and fixed-dungeon objects use overlays. `main.js` draws the configured base floor tile first, then draws the overlay image.
- `fixedTileOverlays` / `overlayOverrides` can customize overlay graphics per map.
- `fixedOverlayBaseTiles` controls which ground tile is drawn under an overlay symbol.
- World landmarks use `STORY_DATA.areas.*.fieldTile`; this is applied only at the matching world coordinate.

## Discovery And Travel

- `main.js` stores discovered fixed maps in `App.data.progress.visitedFixedMaps`.
- `App.discoverFixedMap(areaKey)` records fixed field maps and fixed dungeons when entered or recovered from existing saves.
- `App.getAllFixedMapDiscoveryEntries()` builds the travel list used by `Sky Prism`.
- `Sky Prism` is item `110`. It can move to discovered fixed-map destinations from non-dungeon locations and is consumed on success.
- Dungeon travel is intentionally blocked by `App.isInDungeonForSkyPrism()` for the abyss, random dungeons, and fixed dungeons.

## Transport

- `App.data.transportMode` is the current transport state: `null`, `"boat"`, or `"flying"`.
- `Magic Boat` is item `108`. It is a key item; owning it allows world-map sea movement. Sea movement sets `transportMode` to `"boat"` and uses sea encounter settings.
- `Light Wing` is item `109`. It is a reusable vehicle item; using it on the world map sets `transportMode` to `"flying"`.
- While flying, normal encounters and world tile actions are suppressed. `OK` attempts landing through `App.tryLandFromFlight()`.
- Landing is allowed on non-sea and non-mountain world tiles.

## Encounters

- Sea encounters are flagged in `main.js` by setting `App.data.battle.encounterType = "sea"`.
- `map.js` exposes `SEA_ENCOUNTER_MONSTERS` for sea-specific enemy candidates.
- `battle.js` reads the sea flag and sea monster list during enemy creation.
- `main.js` selects `battle_bg_sea` for sea encounters.

## Update Notes

- Add new runtime map graphics to `assets.js` first.
- Add new fixed-map symbols to `TILE_THEMES` or per-map `tileOverrides`.
- Add object overlays through `FIXED_TILE_OVERLAYS`; avoid baking objects into terrain when the object should appear over multiple floor types.
- Bump `PRISMA_ASSETS.cacheWarmup.version` after changing graphics or warm-cache membership.
