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
4. Gacha, Abyss farming, reincarnation, teleport, and endless exploration become late-main-story or postgame systems.

The next implementation work should continue from Phase 1 in `docs/development-policy.md`: keep the unlock foundation stable before expanding later story events.

Temporary runtime stance: because the story unlock path is not implemented yet, all feature unlock keys currently default to open from the initial state. The unlock foundation remains in place, but gameplay menus and facilities are available during this interim build.

## Changes Made In This Pass

- Expanded the runtime unlock shape to include `smith`, `gacha`, `abyss`, `teleport`, `casino`, `medalKing`, `boat`, `wing`, and `fixedDungeonEndless`.
- Added migration behavior so old saves receive missing unlock keys without replacing existing values.
- Added shared unlock helpers on `App`: state completion, label lookup, access checks, locked messages, and `App.unlockFeature(key)`.
- Routed main-menu access for blacksmith, Abyss/dungeon, and gacha through shared unlock checks.
- Routed casino, Medal King, Abyss field entry, fixed Abyss map entry, inn teleport, Magic Boat, and Light Wing access through the unlock foundation while preserving legacy key-item compatibility for boat and wing.
- Temporarily set all unlock defaults to `true` so new and migrated saves start with every menu/facility available until story events are ready.

## Next Work Order

1. Add story event actions that call `App.unlockFeature(key)` at the planned unlock timings.
2. Extend `StoryManager.processAction()` with an `UNLOCK` action type to keep story scripts declarative.
3. Review current story events from Beginning Village through the cave and decide exactly where `smith`, `boat`, `casino`, `medalKing`, `gacha`, and `abyss` should become true.
4. Add save-compatible regional clear flags before implementing later-region unlocks.
5. After the unlock path is playable, rebalance field monsters, fixed dungeon drops, and virtual floor values.
