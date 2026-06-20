# Phaser map rendering migration

## Target

The map renderer is moving from the original 2D Canvas loop to Phaser 3.90.0.
The target look is late-SFC pixel art with HD-2D-like depth:

- tall walls and buildings anchored to the bottom of their map tile
- Y-position depth sorting so actors can pass behind and in front of scenery
- separate ground, object, actor, atmosphere, and HUD layers
- pixel-perfect scaling on desktop and mobile
- relative URLs compatible with the GitHub Pages project site `/RPG-TEST/`

## Current phase

`phaser-field.js` is an adapter around the existing `Field`, `Dungeon`, and
`MapRegistry` state. Game rules, collision, encounters, quests, saves, battles,
and menus remain owned by the existing modules.

The renderer deliberately uses Phaser's Canvas backend. Existing map images are
shared from the browser image cache, and some browsers reject those images when
Phaser uploads them through WebGL `texImage2D`. Canvas avoids that deployment-
dependent CORS failure. Phaser audio is disabled because this instance only
owns map rendering; game audio remains outside this adapter.

Phaser currently renders:

- field and dungeon ground tiles
- walls and elevated wall faces
- buildings and map overlays
- poison, ice, and warp floor effects
- random dungeon special objects
- player sprite and ground shadows
- atmosphere tint
- minimap markers and held dungeon keys

The original Canvas renderer remains available as an automatic fallback when
Phaser cannot initialize or when a render synchronization error occurs. A
rendering failure must never interrupt movement, saving, or area transitions.

## Asset and deployment rules

- Phaser is vendored at `vendor/phaser/phaser.min.js`.
- Runtime assets use repository-relative paths only.
- New scripts are included in the service-worker app shell.
- The field renderer consumes `PRISMA_ASSETS.graphics`; image path ownership
  stays centralized in `assets.js`.

## Next rendering phases

1. Split large structures into lower collision parts and upper roof/canopy
   parts for more precise occlusion.
2. Add per-area ambient profiles, animated water/lava, torch light, fog, and
   weather.
3. Add short movement tweens while keeping tile-based rules authoritative.
4. Introduce dedicated multi-tile structure definitions instead of inferring
   building size from texture names.
5. Add optional WebGL post-processing profiles, with Canvas-safe fallbacks for
   lower-end mobile devices.
