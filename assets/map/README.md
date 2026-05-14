# Map Runtime Assets

This folder is the runtime source of truth for map graphics.

- `terrain/`: base map tiles such as grass, sea, dungeon floor, dungeon wall, wall face, torch wall face, and regional fixed-map tiles named `tile_<area>_<kind>.png`.
- `objects/`: finalized composite tiles already placed on the correct grass or dungeon base.
- `overlays/`: transparent runtime overlays used by fixed maps and fixed dungeons. The renderer draws the base floor first, then draws these overlays for houses, facilities, chests, stairs, bosses, events, and world landmarks.

Code reads these files through `assets.js` `PRISMA_ASSETS.graphics`. `map.js` chooses graphics by `TILE_THEMES`, `fixedTileOverlays`, `fixedOverlayBaseTiles`, and `STORY_DATA.areas.*.fieldTile`; `main.js` performs the actual canvas drawing.

When replacing a finalized file, keep the same naming pattern and move the previous version to `old/YYYYMMDD-HHMMSS/` before adding the new one. After adding or replacing runtime map graphics, update `assets.js` and bump `PRISMA_ASSETS.cacheWarmup.version` so PWA/APK builds do not keep stale warmed assets.
