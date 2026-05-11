# Map Runtime Assets

This folder is the runtime source of truth for map graphics.

- `terrain/`: base map tiles such as grass, sea, dungeon floor, dungeon wall, wall face, and torch wall face.
- `objects/`: finalized composite tiles already placed on the correct grass or dungeon base.
- `overlays/`: transparent object cutouts kept for rebuilding composites on a new base tile.

Code reads these files through `polish.js` `installGraphics()`. When replacing a finalized file, keep the same naming pattern and move the previous version to `old/YYYYMMDD-HHMMSS/` before adding the new one.

