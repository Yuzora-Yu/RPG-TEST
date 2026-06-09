# PRISMA ABYSS Development Policy

Last updated: 2026-05-15

This document records the current long-term development direction. Treat it as a product/design policy, not just an implementation TODO.

Story, character relationship, and hidden-setting references are archived under `docs/story-bible/`.

## Core Intent

The game has become feature-rich, but the next direction is to reorganize it as an RPG where features open naturally through story progression.

The game should not begin with every major system available. Gacha, blacksmithing, the abyss, boat travel, wing flight, dungeon transfer, and other systems should become available as the player explores the field, clears regional fixed maps, gains allies, and expands the world.

Existing code already has `progress.unlocked.smith` and `progress.unlocked.gacha`. Future work should expand this structure so menus, facilities, travel tools, and dungeon systems are connected to story progress.

Travel and key items such as `Magic Boat`, `Light Wing`, and `Sky Prism` should be treated as story rewards rather than ordinary inventory entries.

## Main Game Scope

The main story should focus on field exploration and regional story progression until roughly level 50.

During this period:

- Field travel and fixed maps should be the main experience.
- Story allies should carry the party experience.
- Gacha and abyss farming should not be the main route to power.
- Fixed story dungeons should be hand-authored rather than randomly generated.
- Random/deep farming systems should become stronger after the main story opens them.

The goal is for the player to feel that the world opens gradually through adventure.

## World Progression

Primary field destinations:

- Beginning Village
- Fire Village
- Wind Settlement
- Water City
- Thunder Fortress
- Light Palace
- Demon Castle
- Abyss

Main progression order:

1. Beginning Village
2. Fire Village
3. Wind Settlement
4. Water City
5. Thunder Fortress
6. Light Palace
7. Demon Castle
8. Abyss

Element order:

1. Fire
2. Wind
3. Water
4. Thunder
5. Light
6. Dark

Story dungeons should be fixed maps. For story-use dungeons, prefer fixed definitions for:

- Enemy appearance
- Chest contents
- Bosses
- Events
- Entrances and exits

This should make story progression feel authored and memorable.

## Feature Unlock Plan

Features should unlock through story progress, not be fully available at game start.

Proposed unlock route:

- Beginning Village clear:
  - Gaile and Sara join.
  - Basic controls, battle, and item tutorial.

- Fire Village clear:
  - Xiao joins.
  - Blacksmith opens.
  - Blacksmith tutorial.

- Wind Settlement clear:
  - Elise joins.
  - Wind area progression.
  - Status ailment and speed-focused combat tutorial.

- Water City clear:
  - Kate joins.
  - Magic Boat obtained.
  - Sea movement opens.
  - Casino is placed in Water City.

- Thunder Fortress clear:
  - Joseph joins.
  - Medal King becomes available.
  - Small medal exchange route opens.

- Light Palace clear:
  - Layla joins.
  - Abyss and reincarnation foreshadowing.
  - Light/dark element tutorial.

- Demon Castle arrival event battle:
  - Shanny joins.

- Demon Castle clear:
  - Main story reaches a major ending point.
  - Gacha opens.
  - Main postgame/farming systems open.

- Six regions and Demon Castle clear:
  - Abyss opens.

- Abyss floor 40 boss defeated:
  - Surface ending.
  - Additional Light Palace event opens.
  - One Reincarnation Fruit is granted.

- Light Palace post-floor-40 event viewed:
  - Abyss floor 41+ opens.
  - Inn dungeon-transfer service opens.
  - Endless exploration opens for fixed regional dungeons.

- Abyss floor 100 clear:
  - Light Wing opens.

Inn transfer logic already exists. It should eventually be gated by something like `progress.unlocked.teleport`.

## Unlock State Shape

Future `progress.unlocked` should move toward this shape:

```js
progress.unlocked = {
  smith: false,
  gacha: false,
  abyss: false,
  teleport: false,
  casino: false,
  medalKing: false,
  boat: false,
  wing: false,
  fixedDungeonEndless: false
};
```

Implementation rule:

- Preserve existing save compatibility.
- Add missing keys in `App.init()` migration.
- Default missing unlock keys to `false`.
- Do not assume old saves already contain the full structure.

## Story Ally Policy

During the main story, party growth should center on story allies. Gacha should not be open during the main route.

Planned story joins:

- Beginning Village clear:
  - Gaile
  - Sara

- Fire Village clear:
  - Xiao

- Wind Settlement clear:
  - Elise

- Water City clear:
  - Kate

- Thunder Fortress clear:
  - Joseph

- Light Palace clear:
  - Layla

- Demon Castle arrival event battle victory:
  - Shanny

Main character placement:

- Beginning Village:
  - Gaile, Sara

- Fire Village:
  - Xiao, Karin

- Wind Settlement:
  - Elise, Arisa, Heine, Marie
  - Licia appears only as a rumor.

- Water City:
  - Kate, Sophia, Silvia, Alan, Hayate

- Thunder Fortress:
  - Joseph, Frieda, Baron, Rin, Zeried

- Light Palace:
  - Layla, Claude, Leon, Luna
  - Lycion appears through telepathy only.

- Demon Castle:
  - Shanny, Zenon, Minerva, Ryu

High-rarity and very strong characters should not join too early. Main story should lean on R/SR characters. SSR+ characters are better as event appearances, foreshadowing, post-Demon-Castle rewards, or postgame content.

## Facility Placement

All major towns:

- Inn

Fire Village:

- Blacksmith unlock point

Water City:

- Casino
- Boat acquisition event

Thunder Fortress:

- Medal King

Light Palace:

- Post-Abyss-floor-40 event
- Reincarnation Fruit reward
- Abyss floor 41+ unlock event

Demon Castle:

- Demon King defeat
- Gacha unlock
- Transition from main story to postgame

Menu and facility display should follow unlock state. Unreleased systems can be hidden, or shown as `???` with a clear note such as "unlocks through story progress" if hiding them makes the UI confusing.

## Abyss Positioning

The Abyss is the current main dungeon system, but it should become a late-main-story/postgame system rather than something freely available from the beginning.

Proposed Abyss stages:

- Initial Abyss access:
  - Dungeon entry opens.

- Floor 40 boss defeated:
  - Surface ending.
  - Light Palace event opens.
  - One Reincarnation Fruit is granted.

- After Light Palace event:
  - Abyss floor 41+ opens.
  - Inn transfer service opens.
  - Regional endless exploration opens.

- Floor 100 clear:
  - Light Wing opens.

- Floor 150+:
  - High-difficulty bosses assuming reincarnation.

## Regional Endless Exploration

After the Light Palace event, fixed regional dungeons should gain endless exploration modes. These should be separate from story fixed dungeons.

Story fixed dungeons:

- Fixed map
- Fixed enemies
- Fixed chests
- Fixed events
- Built to be cleared once as part of the story

Endless exploration:

- Attribute-focused enemies
- Attribute-focused equipment drops
- Repeatable growth, farming, and equipment hunting

Attribute dungeon examples:

- Fire region:
  - More fire monsters.
  - Fire resistance equipment and fire weapons drop more often.

- Wind region:
  - More wind monsters.
  - Wind resistance equipment and wind weapons drop more often.

- Water region:
  - More water monsters.
  - Water resistance equipment and water weapons drop more often.

- Thunder region:
  - More thunder monsters.
  - Thunder resistance equipment and thunder weapons drop more often.

- Light Palace region:
  - More light monsters.
  - Light resistance equipment and light weapons drop more often.

- Demon Castle region:
  - More dark monsters.
  - Dark resistance equipment and dark weapons drop more often.

## Field Monster Direction

Field monsters should vary by area instead of feeling uniform.

- Beginning Village area:
  - Level 1-5 equivalent.
  - Slime and basic enemies.

- Fire Village area:
  - Level 5-10 equivalent.
  - Fire skills common.
  - High fire resistance.
  - Low water resistance.

- Wind Settlement area:
  - Level 10-15 equivalent.
  - Wind skills common.
  - High wind resistance.
  - Low fire resistance.

- Water City area:
  - Level 15-20 equivalent.
  - Water skills common.
  - High water resistance.
  - Low thunder resistance.

- Thunder Fortress area:
  - Level 20-25 equivalent.
  - Thunder skills common.
  - High thunder resistance.
  - Low wind resistance.

- Light Palace area:
  - Level 25-30 equivalent.
  - Light skills common.
  - High light resistance.
  - Low dark resistance.

- Demon Castle area:
  - Level 30-40 equivalent.
  - Dark skills common.
  - High dark resistance.
  - Low light resistance.

- Abyss floor 1-20:
  - Level 40-45 equivalent.

- Abyss floor 21-50:
  - Level 45-50 equivalent.

- Abyss floor 51-75:
  - Level 50-70 equivalent.

- Abyss floor 76-100:
  - Level 70-90 equivalent.

- Abyss floor 101+:
  - Level 100 equivalent.
  - Floor 150+ assumes reincarnation.

## Virtual Floor Policy

Keep the current equipment drop system, but clarify how field/story areas map to virtual floor values.

Proposed virtual floor mapping:

- Beginning Village: 1
- Fire Village: 10
- Wind Settlement: 20
- Water City: 30
- Thunder Fortress: 40
- Light Palace: 50
- Demon Castle: 60
- Abyss floor 1-20: 70
- Abyss floor 21-40: 80
- Abyss floor 41-75: 90
- Abyss floor 76-100: 100
- Abyss floor 101+: actual floor

`App.getVirtualFloor()` already has the right kind of hook. Future work should consolidate this policy there.

## Monster, Boss, And Drop Rework

After field and Abyss progression are reorganized, monster definitions should be reviewed broadly.

Review targets:

- Monster names
- Stats
- Element resistances
- Skills
- Experience
- Gold
- Normal drops
- Rare drops
- Boss behavior
- Abyss spawn logic

Preferred individual drop shape:

```js
drops: {
  normal: { type: "item", id: 1, rate: 0.15 },
  rare: { type: "item", id: 100, rate: 0.02 }
}
```

Equipment drops should keep the current system. The virtual floor policy should tune which equipment rank bands appear.

## Achievement Notifications

Achievement completion should not stop play with a blocking modal. Prefer a toast notification in the upper-right area.

Example:

```text
Achievement Unlocked!
旅の道標
固有MAPを3か所発見した！
```

Desired behavior:

- Upper-right display.
- Auto-dismiss after a few seconds.
- Queue multiple achievements.
- Do not block controls.
- Show reward lightly when present.

The player should feel achievements at the moment they happen, not only when opening the achievements screen.

## Item And Equipment Icons

Items and equipment should gain simple icons.

Start with text, emoji, or simple symbols. Structure data so image icons can replace them later.

Examples:

```js
{ id: 1, name: "やくそう", icon: "🌿" }
{ id: 108, name: "魔法の小舟", icon: "⛵" }
{ id: 109, name: "光の翼", icon: "🪽" }
{ id: 110, name: "スカイプリズム", icon: "🔷" }
```

Equipment icon direction:

- Weapon: sword icon
- Shield: shield icon
- Head: crown/helm icon
- Body: armor/robe icon
- Feet: boot icon

When implementing, avoid hard-coding icons directly into menu rendering. Prefer data fields and fallback logic.

## Fixed Map NPCs

Fixed maps should have residents who can be spoken to.

NPC roles:

- Worldbuilding
- Next-destination hints
- Element matchup hints
- Facility tutorials
- Feature unlock explanation
- Character development
- Hidden-content hints

Examples:

- Fire Village artisan:
  - Blacksmith unlock and blacksmith tutorial.

- Water City shipwright:
  - Boat acquisition event and sea travel explanation.

- Thunder Fortress soldier:
  - Medal King and small medal explanation.

- Light Palace priestess:
  - Abyss, reincarnation, and floor 41+ explanation.

## Tutorial Policy

Tutorials should be embedded into story events and NPC conversations instead of isolated explanation screens.

Tutorial placement:

- Battle tutorial:
  - First battle around Beginning Village.

- Item tutorial:
  - During Beginning Village progress.

- Blacksmith tutorial:
  - After Fire Village.

- Boat tutorial:
  - After Water City.

- Medal tutorial:
  - After Thunder Fortress arrival.

- Abyss tutorial:
  - After Demon Castle clear or first Abyss entry.

- Reincarnation tutorial:
  - After Abyss floor 40 boss and Light Palace event.

- Gacha tutorial:
  - After Demon King defeat.

The player should learn naturally through the story rather than feel forced to read detached instructions.

## Implementation Phases

### Phase 1: Unlock Flag Foundation

- Expand `progress.unlocked`.
- Add migration for old saves.
- Control menu display.
- Control facility access.
- Control item usage.

Priority: build the foundation for "when systems can be used" before adding more systems.

Current status on 2026-05-15:

- `progress.unlocked` now migrates toward the full planned key set.
- Main menu access for blacksmith, Abyss/dungeon, and gacha is routed through shared unlock checks.
- Casino, Medal King, Abyss entry, inn teleport, Magic Boat, and Light Wing access now use the same unlock foundation or legacy key-item compatibility.
- Future story events should call `App.unlockFeature(key)` at the planned unlock moments instead of directly opening systems.

### Phase 2: Story Progress And Ally Joins

- Organize `storyStep` / `subStep` from Beginning Village through Demon Castle.
- Add regional clear flags.
- Add story ally join handling.
- Add fixed dungeon clear flags.

Main story should be playable with story allies.

### Phase 3: Field, Fixed Maps, And Entrances

- Place six elemental regions on the field.
- Organize entrance coordinates.
- Place fixed dungeon entrances.
- Connect `Sky Prism` to discovered/undiscovered fixed-map records.

Keep the current policy that `Sky Prism` moves to the world-map coordinate near a fixed map, not directly inside that fixed map.

### Phase 4: Facility Unlocks

- Fire Village clear opens blacksmith.
- Water City clear opens boat and casino.
- Thunder Fortress opens Medal King.
- Demon King defeat opens gacha.
- Abyss/Light Palace event opens transfer service.
- Abyss floor 100 opens Light Wing.

### Phase 5: Enemy, Drop, And Virtual Floor Balance

- Area-based monster settings.
- Attribute-based monster tuning.
- Fixed-dungeon enemy fixation.
- Abyss spawn logic review.
- Normal and rare drops.
- Equipment drops tuned by virtual floor.

### Phase 6: Presentation And UI

- Achievement toast notifications.
- Item and equipment icons.
- Fixed-map resident NPCs.
- Story-integrated tutorials.
- Unlocked/locked feature display cleanup.

## Guiding Principle

The most important thing is not simply adding more features.

The core progression should feel like:

1. Advance the story.
2. Gain new allies.
3. Reach new regions.
4. Open new facilities.
5. Obtain new travel tools.
6. Unlock deeper postgame systems.

Do not give everything to the player immediately. The player should feel the world expanding through adventure.

During the main story, the player should struggle forward with story allies. The intended RPG identity is not "use gacha and abyss farming to brute-force everything", but "travel through fire, wind, water, thunder, light, and dark regions while gathering allies, tools, and systems."

After Demon King defeat, unlock gacha, Abyss, reincarnation, endless exploration, and attribute equipment farming, then expand the game as a long-term postgame RPG.
