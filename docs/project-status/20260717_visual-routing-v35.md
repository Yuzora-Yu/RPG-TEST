# Visual Routing v35 — 2026-07-17

## Battle backgrounds

- World-map ship encounters: `battle_bg_sea` → `assets/generated/battle-sea.png`
- World-map forest encounters: `battle_bg_field_forest` → `assets/generated/battle-forest-ai.png`
- Forbidden Forest remains isolated on `battle_bg_forest`.
- Abyss ordinary boss floors: `battle_bg_abyss_boss`.
- Abyss floor 200 boss: `battle_bg_abyss_floor_200`.
- The first event battle explicitly requests `battle_bg_first`.
- Wind Temple uses the indoor `battle_bg_wind_temple` set.
- Trial Island and Summit Temple reuse the rejected outdoor wind-ruins image through `battle_bg_mountain_wind_ruins`.

## Map and travel corrections

- Ignis Volcano F3 restores the authored stair tile at `(10, 1)` and its link to F4.
- Sky Prism resolves a dungeon entrance authored inside a fixed parent map and lands on that exact entrance tile.
- Wind Temple has a dedicated floor/wall/wall-face theme and a clear floor with random decoration disabled.

## Asset lifecycle

- Generated sources are stored separately from 960x540 runtime backgrounds.
- Manifests record source/runtime pairs and regeneration scripts.
- All registered assets remain included in the full cache even when they are excluded from the minimal startup-critical set.
- Cache revision: `prisma-abyss-v3.95-visual-routing` / runtime equivalent.
