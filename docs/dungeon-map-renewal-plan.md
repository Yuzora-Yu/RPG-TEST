# Dungeon Map Renewal Plan

## Scope

- Keep the world field map chips conservative.
- Apply renewed depth rendering to fixed maps, fixed dungeons, and random dungeons.
- Use colored locked doors as local dungeon puzzles, not as irreversible global progression locks.
- Do not use late override processors for fixed maps or fixed dungeons. Preserve source-data coordinates used by `story.js`, chests, bosses, map actions, and floor links.

## Reference Patterns

The implementation borrows structural patterns, not copyrighted map layouts.

- Dragon Quest style keys: locked doors and treasure rooms support exploration memory and later reward routes.
- Mystery Dungeon style keys: keys can open locked doors inside dungeon floors, so placement must be floor-safe.
- Zelda-style lock-and-key graph: a key must exist in the reachable graph before its matching door.
- General dungeon-map design: routes should include loops, choices, reveal points, and meaningful side rewards.
- Codex + Agent Sprite Forge workflow: keep map objects as distinct visual layers and use depth/billboard-like treatment where the existing engine can support it.

Source links:

- https://note.com/npaka/n/n34b00d58dfbe
- https://www.rpgmapeditor.com/guides/dungeon-map-design-basics
- https://bulbapedia.bulbagarden.net/wiki/Mystery_Dungeon
- https://www.gamedeveloper.com/design/depicting-the-level-design-of-a-legend-of-zelda-dungeon
- https://www.psu.com/news/dragon-quest-xi-magic-red-doors-locations/

## Tile Contract

- `X`: red locked door.
- `Y`: blue locked door.
- `Z`: gold locked door.
- `Q`: red floor key.
- `N`: blue floor key.
- `O`: gold floor key.
- A floor may use at most three key colors.
- Keys are retained within their local scope instead of consumed, avoiding multiple-door softlocks.

## Random Dungeon Safety Rules

- Boss floors and treasure rooms do not receive random key doors.
- Floors below 3 do not receive random key doors.
- A door is placed only where blocking that exact tile disconnects spawn from stairs.
- The matching floor key must be reachable before that door.
- A state-space BFS validates that the stairs remain reachable after collecting keys.
- If validation fails, the floor reverts to a normal dungeon with no locked doors.

## Fixed Dungeon Guidelines

- Use locked doors as clear local gates, not hidden gotchas.
- Put any required key pickup on the visible or near-visible side route.
- Put reward chests after the door or in dead-end branches.
- Keep floor links and exit tiles reachable without ambiguity.
- Validate every edited floor with `node tools/validate-map-safety.js`.

## Fixed Map Guidelines

- Villages and shrines should have a clear entrance line, one readable central landmark, and short side loops.
- Map actions must sit on visible landmark tiles and be reachable from the entry point.
- Exits must remain on `S` tiles and lead back to the world coordinate defined by the area.
- Review the generated overview with `node tools/render-fixed-map-preview.js`.

## Review Artifacts

- `docs/generated/fixed-map-preview.html`: overview of all fixed field maps.
- `docs/generated/fixed-dungeon-preview.html`: overview of all fixed dungeon floors.
- `tools/validate-map-safety.js`: coordinate integrity, `story.js` trigger coverage, and random-floor key-door safety validation.
- `tools/validate-key-door-runtime.js`: runtime-like checks for locked-door movement, floor key pickup, guardian key rewards, and fixed-floor links.
- `tools/render-random-key-door-preview.js`: visual overview of generated route-blocking doors and floor keys.

## Rendering Guidelines

- World field rendering remains simple and unchanged in feel.
- Current map data surfaces use ambient background, tile shading, object lift, foot shadows, and vignette.
- Doors and keys use generated bitmap assets with distinct red, blue, and gold silhouettes.
