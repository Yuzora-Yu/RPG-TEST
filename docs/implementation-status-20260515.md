# PRISMA ABYSS Implementation Status 2026-05-15

This note summarizes the current inspection pass and the organization direction after the recent progress.

## Inspection Result

- The folder is not a Git repository, so progress was checked by file state, source inspection, and runtime-oriented static checks.
- Recent work is concentrated in `main.js`, `battle.js`, `dungeon.js`, `menus_allies.js`, `monsters.js`, `modern-polish.css`, `polish.js`, `skills.js`, `database.js`, `index.html`, and `map.js`.
- All top-level JavaScript files passed `node --check` during this pass, both before and after the organization changes.
- Fixed map, fixed dungeon, map asset routing, Sky Prism destination discovery, boat/flight transport, sea encounter routing, and menu splitting are already substantially in place.

## Confirmed Direction

The active product direction remains:

1. Story progression opens the world.
2. Story allies carry the main route.
3. Facilities and travel tools unlock as story rewards.
4. Abyss farming, reincarnation, teleport, and endless exploration become late-main-story or postgame systems. Gacha remains legacy/internal unless a new player-facing route is explicitly added.

The next implementation work should continue from Phase 1 in `docs/development-policy.md`: keep the unlock foundation stable before expanding later story events.

Current runtime stance: the implementation now uses explicit defaults and migrations. `smith`, `gacha`, `boat`, and `dungeonMenu` default closed; `abyss`, `teleport`, `wing`, and `fixedDungeonEndless` default open. Existing saves are migrated, and gacha is forced closed by the v3.23 migration because it has no current main-menu player route.

## Changes Made In This Pass

- Expanded the runtime unlock shape to include `smith`, `gacha`, `abyss`, `dungeonMenu`, `teleport`, `boat`, `wing`, and `fixedDungeonEndless`.
- Added migration behavior so old saves receive missing unlock keys without replacing existing values.
- Added shared unlock helpers on `App`: state completion, label lookup, access checks, locked messages, and `App.unlockFeature(key)`.
- Routed main-menu access for blacksmith and dungeon through shared unlock checks. Gacha screen code remains, but the main menu button has been removed.
- Routed Abyss field entry, fixed Abyss map entry, inn teleport, Magic Boat, and Light Wing access through the unlock foundation while preserving legacy key-item compatibility for boat and wing.
- Casino and Medal exchange are current map-facility routes, not documented as `progress.unlocked` gates.

## Next Work Order

1. Add story event actions that call `App.unlockFeature(key)` at the planned unlock timings.
2. Extend `StoryManager.processAction()` with an `UNLOCK` action type to keep story scripts declarative.
3. Review current story events from Beginning Village through the cave and decide any future changes to `smith`, `boat`, `dungeonMenu`, and `abyss` gates. Do not document gacha as a current player-facing unlock unless the menu route is reintroduced.
4. Add save-compatible regional clear flags before implementing later-region unlocks.
5. After the unlock path is playable, rebalance field monsters, fixed dungeon drops, and virtual floor values.
