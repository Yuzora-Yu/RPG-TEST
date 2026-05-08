# PRISMA ABYSS Asset And Code Map

## Managed Assets

Accepted assets live under `assets/managed/current/`.

- `map/terrain/`: fixed terrain tiles such as grass, sea, dungeon floor, and dungeon wall.
- `map/objects/`: object tiles composited onto the accepted floor tiles, such as stairs, treasure chests, villages, houses, forests, mountains, caves, boss marks, and event marks.
- `battle/fx/`: battle effects. Physical, spell, heal, buff, debuff, breath, special, and critical overlays are separated by name.
- `battle/bg/`, `hero/`, `ui/`: reserved for accepted battle backgrounds, walking sprites, and UI materials.

When replacing an accepted asset, move the previous file to `assets/managed/old/YYYYMMDD-HHMMSS/` with the same relative path, then place the new file in `current/`.

## Naming

- Terrain: `terrain_<area>_<kind>_vNNN.png`
- Map objects: `object_<area>_<kind>_vNNN.png`
- Battle effects: `fx_<category>_<kind>_vNNN.png`

Examples:

- `terrain_grass_field_v001.png`
- `object_dungeon_chest_rare_v001.png`
- `fx_phys_neutral_chain_v001.png`
- `fx_spell_thunder_v001.png`
- `fx_critical_spark_v001.png`

## Current Code Hooks

- `polish.js` `installGraphics()`: overlays accepted image assets into `GRAPHICS.data`.
- `polish.js` `installThemes()`: maps map symbols to visual tile keys. Random dungeon `S` uses `stairs_dungeon`; fixed `START_CAVE` entrance/exit `S` stays `dungeon_floor`.
- `polish.js` `PolishBattleFX`: selects battle effects by skill type, element, target scope, hit count, boss state, and critical log cues.
- `modern-polish.css`: owns modern UI styling and battle effect animations, including critical damage number emphasis.
- `battle.js`: owns battle rules and damage/heal/passive resolution. Dual-wield behavior is intentionally left unchanged.

## Current Battle Effect Routing

- Beneficial support: `buff` or `heal-blossom`.
- Debuff-only/status skills: `debuff` or `poison`.
- Breath skills: `breath`.
- Neutral physical and passive follow-ups: `neutral-*` silver/steel effects.
- Critical hits: keep the base effect, then overlay `critical-spark` and use the stronger critical damage number.
- Skill IDs `500-502` and `900+`: routed to existing high-grade effects where possible, with `special-rupture` as the fallback.

## Future Split Notes

Large files are still intentionally left intact while visual and behavior fixes are being stabilized. A later structural pass should split:

- `battle.js` into battle core, action resolution, passives, render/status UI, and logging/effects bridge.
- `menus.js` into top menu, equipment, formation, facilities, and log/help panels.
- `main.js` into app lifecycle, field rendering, save/load, and HUD controls.
