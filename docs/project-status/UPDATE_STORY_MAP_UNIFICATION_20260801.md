# Story / Map Unification Update 2026-08-01

## Story source

- Surface and Abyss scripts/events now live in `story.js`.
- `abyss_story.js` was removed from the runtime, service worker, editor assumptions, CSV exporter, and validation helpers.
- `story_logic.js` remains execution logic only.
- The map/story editor therefore sees the same story event set as the game.

## Shared map contract

- `FIXED_MAPS` and `FIXED_DUNGEON_MAPS` remain the two data collections because field-style areas and multi-floor dungeons have different containers.
- Their coordinate objects now use the same normalized schema and shared `MapRegistry` lookup/execution paths.
- `mapKind` and `regionKey` provide editor grouping metadata.
- The editor can place stairs, automatic floor transfers, exits, fixed-map doors, and prison gates as paired terrain/data presets.

## Legacion layout revision

The oversized interior maps were reduced while preserving event IDs and connections:

- Upper Gallery: 41x19 -> 29x13
- West Tower: 23x23 -> 17x15
- East Tower: 23x23 -> 17x15
- Prison: 31x21 -> 23x15
- Underground Temple: 33x23 -> 21x15
- Audience Chamber: 35x23 -> 17x13

The audience chamber, gallery, and temple now contain authored carpets. The prison now has four physical gate objects and adjacent interaction events, following the same data structure used by the Light Palace prison.

The main Legacion hub remains larger because it contains the smith, alchemy, guild, arena, three interior branches, and two world exits. It can now be resized safely in the editor without changing runtime code.

## Post-battle boss depth

Automatic post-battle boss retention no longer uses the cutscene DOM layer. The retained boss is drawn as a normal map object at row depth `y * 100 + 84`; the player remains at `y * 100 + 88`. Explicit story cutscenes continue to use the dedicated front layer.
