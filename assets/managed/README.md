# Managed Assets

`current/` is legacy. Runtime assets are now read from stable folders:

- `assets/map/`
- `assets/effect/`
- `assets/monsters/`
- `assets/characters/`

Use `managed/source/` for raw generated or user-provided sources and `managed/old/` for rollback archives.

When replacing an accepted asset, move the previous file to `assets/managed/old/YYYYMMDD-HHMMSS/` using the same relative path, then place the new file in the appropriate runtime folder.

Use consistent names:

- `terrain_<area>_<kind>_vNNN.png`
- `object_<area>_<kind>_vNNN.png`
- `fx_<category>_<kind>_vNNN.png`
- `monster_<monsterId>.png`
- `char_face_<characterId>.gif`
