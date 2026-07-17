# Adopted Monster Image Library

This directory contains the 24 runtime-compatible generated monsters adopted on 2026-07-16.

- Runtime format: 768x768 RGBA PNG with transparent background. Sprites are reduced to a 192x192 logical canvas and enlarged 4x with nearest-neighbor to enforce late-SFC-sized pixel clusters.
- Metadata source of truth: `manifest.json`.
- Grouping: `<midboss|normal>/<element>/monsterlib_<role>_<element>_<slug>_vNNN.png`.
- Registered cache keys: `monsterlib_<role>_<element>_<slug>` in `assets.js`.
- Raw and alpha-removed sources: `assets/managed/source/monster-library/v001/`.
- Visual catalog: `docs/generated/monster-library/monster-library-v001.png`.
- Rebuild command: `python tools/art/build-monster-library.py`.

`monsterId` and `storyAssignment` are fixed in both `manifest.json` and `tools/art/build-monster-library.py`. Rebuilding the art therefore preserves the reviewed game-data assignment.

- Midboss IDs `302201`–`302208` replace only the enemy groups of existing deep companion quests. Existing quest coordinates, progress flags, and rewards are retained.
- Normal IDs `110201`–`110216` are assigned one-by-one to Abyss bands 81–160 in `monsters.js`.
- `assets.js` and `monster-images.js` expose numeric `monster_<id>` aliases directly to these library paths; no duplicate numeric PNG is required.

All adopted sprites use a reduced palette (40 colors for midbosses, 28 for normal enemies), hard alpha silhouette, and integer nearest-neighbor scaling to suppress high-resolution AI-painting artifacts when rendered at battle size.
