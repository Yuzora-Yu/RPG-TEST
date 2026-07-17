# Reusable Map-Chip Library

This directory contains runtime-ready reusable map chips. Version v001 is promoted through explicit, hand-authored fixed-map coordinates; it is never randomly scattered.

- Runtime format: 32x32 RGBA PNG, transparent background, bottom-center anchor.
- Metadata source of truth: `manifest.json`.
- Grouping: `<theme>/<decoration|blocking>/maplib_<theme>_<slug>_vNNN.png`.
- Registered cache keys: `maplib_<theme>_<slug>` in `assets.js`.
- Raw and 256x256 master sources: `assets/managed/source/map-chip-library/v001/`.
- Visual catalogs: theme sheets and `map-chip-library-v001.png` under `docs/generated/map-chip-library/`.
- Rebuild command: `python tools/art/build-map-chip-library.py`.

`decoration` entries are cosmetic and default to walkable. Add them to a theme-specific decoration table or an authored fixed-map overlay list only after checking density and visual fit.

`blocking` entries default to collision. For fixed maps and fixed dungeons, place them through `blockingObjects: [{ x, y, imageKey, drawWidth, drawHeight, log }]` so drawing and collision stay synchronized. Do not recreate one-off movement branches.

The current authored source of truth is `AUTHORED_MAP_PROP_PLACEMENTS` in `map.js`. Its one-by-one placement ledger is `docs/generated/authored-map-prop-placement-ledger.md`, and `tools/validation/validate-authored-map-props.js` verifies complete manifest coverage, floor suitability, passability classification, reserved cells, and navigation connectivity.

The library is included in the complete background cache but not in the startup-critical set. Adding a library asset must not introduce lazy/on-demand fetching.
