# Map Runtime Assets

This folder is the runtime source of truth for map graphics.

- `terrain/`: base map tiles such as grass, sea, dungeon floor, dungeon wall, wall face, torch wall face, and regional fixed-map tiles named `tile_<area>_<kind>.png`.
- `objects/`: finalized composite tiles already placed on the correct grass or dungeon base.
- `overlays/`: transparent runtime overlays used by fixed maps and fixed dungeons. The renderer draws the base floor first, then draws these overlays for houses, facilities, chests, stairs, bosses, events, and world landmarks.

Code reads these files through `assets.js` `PRISMA_ASSETS.graphics`. `map.js` chooses graphics by `TILE_THEMES`, `fixedTileOverlays`, `fixedOverlayBaseTiles`, and `STORY_DATA.areas.*.fieldTile`; `main.js` performs the actual canvas drawing.

When replacing a finalized file, keep the same naming pattern and move the previous version to `old/YYYYMMDD-HHMMSS/` before adding the new one. After adding or replacing runtime map graphics, update `assets.js` and bump `PRISMA_ASSETS.cacheWarmup.version` so PWA/APK builds do not keep stale warmed assets.

Generated world-map micro-decoration uses `overlays/overlay_world_*_vNNN.png`. These overlays are cosmetic and must remain independent from collision and event data. Grass and forest variants are selected by deterministic coordinate hashing. Shoreline foam is drawn on every exact water-to-land boundary rather than in the center of a water tile. A walkable grass tile with water on opposite sides receives `overlay_world_bridge_wood_v001.png` without changing collision or event data. Do not reintroduce a fixed-screen atmosphere overlay on `WORLD`, because Canvas zoom can expose additive buffer bounds as a rectangular patch.

Theme floor decoration uses one `overlay_decor_<theme-detail>_vNNN.png` per `TILE_THEMES` key. The registry and density live together in `phaser-field.js` as `FLOOR_DECOR_THEME_CONFIG`; do not fall back to a shared gray crack/rubble image. Runtime overlays are 32×32 RGBA and are selected by deterministic coordinate hashing at no more than 2.5% of eligible floor tiles. Rebuild the generated source atlases with `tools/build-theme-floor-assets.py` instead of hand-cropping individual files.

<<<<<<< HEAD
Connected floor textiles are authored through a floor's `floorDecorations` rectangle. Supported types are `castle_carpet` (red/gold), `castle_carpet_blue_silver`, and `village_goza`. Every covered tile is drawn at its own row depth so later floor rows cannot cover a tall carpet; adjacent fills overlap by two pixels and only the rectangle's outer edges receive trim. The blue carpet and goza are registered and full-cached but intentionally unplaced until their coordinates are manually approved. See `overlays/connected-textiles-v001.json` and rebuild them with `tools/art/build-connected-textiles.py`. Key doors use the full-tile `door_key_<color>_v003.png` assets and remain collision/event tiles rather than floor decoration.

Blocking map props are transparent `objects/object_blocking_<theme-detail>_vNNN.png` assets. Declare placement in a fixed map or floor with `blockingObjects: [{ x, y, imageKey, drawWidth, drawHeight, log }]`. The shared renderer bottom-aligns the image to its tile and the shared movement path rejects entry into that coordinate; do not encode these objects as decorative tiles or one-off collision branches. Every `imageKey` must be registered in `assets.js`, included in the full install cache, and validated by `tools/validation/validate-blocking-map-objects.js`. Rebuild the current generated set with `tools/build-blocking-map-objects.py`.

Reusable map chips live under `library/` with searchable theme/role metadata in `library/manifest.json`. They are full-cache registered and are never automatically scattered. Fixed placements use the explicit `AUTHORED_MAP_PROP_PLACEMENTS` registry in `map.js`; see `docs/generated/authored-map-prop-placement-ledger.md` and `library/README.md` before adding or moving a coordinate.
=======
Connected Demon Castle carpet is authored through a floor's `floorDecorations` rectangle (`type: "castle_carpet"`). The renderer draws the generated fill and only the gold edges with no carpet neighbor, so one tile is a closed square while longer rectangles have one continuous outer border. Key doors use the full-tile `door_key_<color>_v003.png` assets and remain collision/event tiles rather than floor decoration.

Blocking map props are transparent `objects/object_blocking_<theme-detail>_vNNN.png` assets. Declare placement in a fixed map or floor with `blockingObjects: [{ x, y, imageKey, drawWidth, drawHeight, log }]`. The shared renderer bottom-aligns the image to its tile and the shared movement path rejects entry into that coordinate; do not encode these objects as decorative tiles or one-off collision branches. Every `imageKey` must be registered in `assets.js`, included in the full install cache, and validated by `tools/validate-blocking-map-objects.js`. Rebuild the current generated set with `tools/build-blocking-map-objects.py`.
>>>>>>> 2069569eb8fb4158c20e139c27fcfc5d5dc3bcf8
