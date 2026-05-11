# PRISMA ABYSS Asset And Code Map

## Managed Assets

Accepted assets live under `assets/managed/current/`.

- `map/terrain/`: fixed terrain tiles such as grass, sea, dungeon floor, and dungeon wall.
- `map/objects/`: composite map object tiles such as stairs, treasure chests, villages, houses, forests, mountains, caves, boss marks, and event marks. These are already combined with the accepted grass or dungeon floor tile for stable rendering.
- `map/overlays/`: transparent cutout sources for the current map objects. Use these when rebuilding composites on a new base floor.
- `assets/managed/source/map/sheets/`: generated source sheets kept for traceability before cutout and compositing.
- `battle/fx/`: battle effects. Physical, spell, heal, buff, debuff, breath, special, and critical overlays are separated by name.
- `monsters/`: accepted monster sprites keyed as `monster_<monsterId>.png`.
- `battle/bg/`, `hero/`, `ui/`: reserved for accepted battle backgrounds, walking sprites, and UI materials.

When replacing an accepted asset, move the previous file to `assets/managed/old/YYYYMMDD-HHMMSS/` with the same relative path, then place the new file in `current/`.

## Naming

- Terrain: `terrain_<area>_<kind>_vNNN.png`
- Map objects: `object_<area>_<kind>_vNNN.png`
- Battle effects: `fx_<category>_<kind>_vNNN.png`
- Monster sprites: `monster_<monsterId>.png`

Examples:

- `terrain_grass_field_v001.png`
- `object_dungeon_chest_rare_v002.png`
- `fx_phys_neutral_chain_v001.png`
- `fx_spell_thunder_v001.png`
- `monster_902000.png`
- `fx_critical_spark_v001.png`

## Current Code Hooks

- `polish.js` `installGraphics()`: overlays accepted image assets into `GRAPHICS.data`.
- `polish.js` `installThemes()`: maps map symbols to visual tile keys. Random dungeon `S` uses `stairs_dungeon`; fixed `START_CAVE` entrance/exit `S` stays `dungeon_floor`.
- `main.js` `Field.getDungeonWallGraphicForDraw()`: when a dungeon wall has a non-wall tile directly below it, the renderer swaps the normal wall image to `wall_face`, with `wall_face_torch` every 5 columns.
- `polish.js` `PolishBattleFX`: selects battle effects by skill type, element, target scope, hit count, boss state, and critical log cues.
- `modern-polish.css`: owns modern UI styling and battle effect animations, including critical damage number emphasis.
- `battle.js`: owns battle rules and damage/heal/passive resolution. Dual-wield behavior is intentionally left unchanged.
- `monster-images.js`: maps accepted monster IDs to `assets/managed/current/monsters/monster_<id>.png`.
- `menus.js` `MenuBook.getMonsterImgSrc()`: uses `window.MonsterImageMap` before legacy embedded graphics.

Current accepted boss and rare candidate monster sprites are stored in `assets/managed/current/monsters/`.
Raw user-provided sources are stored in `assets/managed/source/monsters/boss-candidates/raw/`.
Verification previews are stored in `verification/monster-alpha-final/`.
The current alpha pass uses conservative outer-edge removal for the silver metal monsters `200201`, `200202`, and `200203`, and inner-hole removal for the other first-pass boss candidate images. User-provided transparent boss sprites for `401030`, `401040`, `401050`, `401060`, `401100`, `401150`, `401151`, `401152`, `401153`, and `401200` were cropped to their alpha bounds and added directly.
Regenerated sprites currently installed: `200204` was regenerated on green chroma key to avoid magenta-key interference, `401010` was regenerated with a shorter katana grip, and `401130` / `401140` were regenerated then reprocessed with inner green removal. Older accepted files were moved under `assets/managed/old/<timestamp>/monsters/` before replacement.

Current map tile set: field/dungeon objects are `v002`, except the forest tile which is `object_field_forest_v003.png` because it was rebuilt as a two-tree tile.

## Current Battle Effect Routing

- Beneficial support: `buff` or `heal-blossom`.
- Debuff-only/status skills: `debuff` or `poison`.
- Breath skills: `breath-*` by element, using the shared breath image with CSS color grading.
- Physical skills: `phys-*` by element when an element is present; neutral and passive follow-ups use `neutral-*` silver/steel effects.
- Critical, defense-piercing, and boosted magic damage hits: keep the base effect, then overlay `critical-spark` and use the stronger critical damage number.
- Skill IDs `500-502` and `900+`: routed to existing high-grade effects where possible, with `special-rupture` as the fallback.

## Future Split Notes

Large files are still intentionally left intact while visual and behavior fixes are being stabilized. A later structural pass should split:

- `battle.js` into battle core, action resolution, passives, render/status UI, and logging/effects bridge.
- `menus.js` into top menu, equipment, formation, facilities, and log/help panels.
- `main.js` into app lifecycle, field rendering, save/load, and HUD controls.
