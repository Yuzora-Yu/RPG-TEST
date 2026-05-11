# Managed Assets

`current/` is legacy. Map and battle effect runtime assets are now read from:

- `assets/map/`
- `assets/effect/`

Use `managed/source/` for raw generated or user-provided sources and `managed/old/` for rollback archives.

When replacing an accepted asset, move the previous file to `old/YYYYMMDD-HHMMSS/` using the same relative path, then place the new file in `current/`.

Use consistent names:

- `terrain_<area>_<kind>_vNNN.png`
- `object_<area>_<kind>_vNNN.png`
- `fx_<category>_<kind>_vNNN.png`
