# PRISMA ABYSS Development Policy

Last updated: 2026-07-14

This document records the current long-term development direction. Treat it as a product/design policy, not just an implementation TODO.

Story, character relationship, and hidden-setting references are archived under `docs/story-bible/`.

All implemented story regions, including the Abyss and post-surface chapters, must be stored in `story.js`. Region-specific runtime append files must not make the editor and game load different scenario sets.

The current non-negotiable directives are recorded in `docs/CURRENT_PRODUCT_DIRECTIVES_20260714.md`. They supersede older notes about dialogue length, tutorial timing, cache confirmation, and future gacha use.

Opening asset delivery is staged: before play begins, preload Lumina Village, the opening Jelly battle, and the complete pre-opening first-cave battle set (map tiles, regular enemies, boss, and field/dungeon battle backgrounds). Play the paper-theater opening after the first-cave clear report `PROLOGUE3` advances the save to `storyStep: 2 / subStep: 1`, then present the full-image download choice.

## Core Intent

The game has become feature-rich, but the next direction is to reorganize it as an RPG where features open naturally through story progression.

## Maintainable Implementation Rule

### Map rendering authority

- `phaser-field.js` is the production field/map renderer and must be implemented and verified first for every map visual, overlay, animation, depth, shadow, and atmosphere change.
- The legacy `Field.render()` 2D Canvas path in `main.js` exists only as an automatic safety fallback when Phaser initialization or synchronization fails. It is not the primary implementation target.
- Phaser itself currently uses its Canvas backend for asset compatibility. This is separate from the legacy Canvas fallback above; “Phaser-first” still applies.
- After the Phaser implementation is complete, mirror the minimum equivalent behavior into the legacy Canvas path so a renderer failure does not break movement or essential readability.
- A map-editor preview or a passing legacy-Canvas check does not prove the production renderer is correct. Visual changes must be checked in the active Phaser game view, and validation must assert both paths when fallback parity matters.

手抜き作業と、その場しのぎのつぎはぎ修正を禁止する。症状だけを局所的に隠すのではなく、描画・移動・イベント・データ参照の正本を確認し、同種の挙動が一つの共有ロジックへ収束するよう修正すること。

新しいデータやアセットは、後から由来・用途・再生成方法を追跡できる状態で格納する。既存ファイルの配置が保守を妨げている場合は、参照元・全量キャッシュ・検証スクリプトを同時に更新したうえで適切なフォルダへ整理する。生成原画、ゲーム用加工物、マニフェスト、加工スクリプトを分離し、無名の上書きや用途不明ファイルを増やさない。

変更時は少なくとも、既存セーブ互換、入口と帰還先、通行可能性、画像の全量キャッシュ登録、描画欠けの同期フォールバック、データ検証を確認する。短期的に動くことより、再現可能で管理しやすい構成を優先する。

The game should not begin with every major system available. Blacksmithing, the abyss, boat travel, wing flight, dungeon transfer, and other systems should become available as the player explores the field, clears regional fixed maps, gains allies, and expands the world. Gacha-related code and assets may remain as dormant legacy/internal implementation, but gacha is not planned as a player-facing feature and must not receive an unlock route.

Existing code uses `progress.unlocked` for story-gated systems. Field blacksmith access is gated by `smith`, while the main-menu **Magic Communication** route to blacksmithing, alchemy, and guild quest reception is independently gated by `craftingMenu`. Dungeon menu access keeps its own unlock check; gacha is not shown in the main menu route.

`Magic Boat` and `Light Wing` are progression-linked travel items. `Light Wing` is a unique Final Altar reward from Lycion. `Sky Prism` is intentionally an ordinary consumable sold by normal item shops; its destination list is limited by discovered-map records rather than by an acquisition event.

## Main Game Scope

The main story should focus on field exploration and regional story progression until roughly level 50.

During this period:

- Field travel and fixed maps should be the main experience.
- Story allies should carry the party experience.
- Abyss farming should not be the main route to power during the main story.
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
  - Record future tutorial requirements only; implementation waits until all target screens are complete.

- Fire Village clear:
  - Xiao joins.
  - The local Fire Village blacksmith facility opens.
  - Main-menu Magic Communication access to blacksmithing, alchemy, and guild quest reception remains locked until a future dedicated quest unlocks `craftingMenu`.
  - Record the future blacksmith tutorial requirement, but do not implement it before the blacksmith UI is final.

- Wind Settlement clear:
  - Elise joins.
  - Wind area progression.
  - Reserve status-ailment and speed teaching goals for the post-UI-completion tutorial pass.

- Water City clear:
  - Kate joins.
  - Magic Boat obtained.
  - Sea movement opens.
  - Casino is placed in Water City as a map facility.

- Thunder Fortress clear:
  - Joseph joins.
  - Medal King remains a reachable map facility with no story-clear prerequisite; the fortress may still explain small medals.

- Light Palace clear:
  - The prison rescue route opens. Layla does not join at the altar.
  - Returning to the prison and giving Layla one World Tree Leaf restores and recruits her.
  - Abyss and reincarnation foreshadowing.
  - Reserve light/dark teaching goals for the post-UI-completion tutorial pass.

- Demon Castle arrival event battle:
  - Shanny joins.

- Demon Castle clear:
  - Main story reaches a major ending point.
  - Gacha remains unused dormant legacy/internal code; no player-facing unlock is planned.
  - Main postgame/farming systems open through their implemented story gates.

- Six regions and Demon Castle clear:
  - Abyss opens.

- Abyss floor 40 boss defeated:
  - Surface ending.
  - Additional Light Palace event opens.
  - One Reincarnation Fruit is granted.

- Light Palace clear:
  - The prison rescue route opens. Layla joins only after the party returns to the prison and gives her one World Tree Leaf.

- Final Altar / Azelgarag clear:
  - Lycion grants the Light Wing. It is not a Medal King reward.

- Postgame Final Altar crack event:
  - Random Abyss and the dungeon menu open.
  - The inn dungeon-transfer door becomes visible and usable at the same time.

Inn transfer visibility and use are both gated by `progress.flags.abyssRandomUnlocked` / `progress.unlocked.teleport`. `abyssFirstEntered` is history only and must not reveal the door. Older saves that already own the legacy random-Abyss clear state may preserve access through migration.

## Unlock State Shape

Future `progress.unlocked` should move toward this shape:

```js
progress.unlocked = {
  smith: false, // local Fire Village blacksmith facility
  craftingMenu: false, // future quest reward: Magic Communication access to blacksmithing, alchemy, and guild quest reception
  gacha: false, // legacy/internal; no current main-menu player route
  abyss: true,
  dungeonMenu: false,
  teleport: true,
  boat: false,
  wing: true,
  fixedDungeonEndless: true
};
```

Implementation rule:

- Preserve existing save compatibility.
- Add missing keys in `App.init()` migration.
- Default missing unlock keys to `false`.
- Do not assume old saves already contain the full structure.

## Story Ally Policy

During the main story, party growth should center on story allies. Gacha is not exposed as a current player-facing progression route.

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

- Light Palace prison rescue after clear:
  - Layla (give one World Tree Leaf)

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

- Medal King facility tile; no story-clear prerequisite

Light Palace:

- Final battle and prison rescue route
- Layla recovery by World Tree Leaf
- Abyss and reincarnation foreshadowing

Demon Castle:

- Demon King defeat
- Transition from main story to postgame
- Gacha code may remain in the repository, but it is not documented as a current in-game unlock.

Menu and facility display should follow their respective unlock states. Local facility access and remote menu access must not share a flag when they are intended as different rewards. Unreleased systems can be hidden, or shown as `???` with a clear note such as "unlocks through story progress" if hiding them makes the UI confusing.

## Abyss Positioning

The Abyss is the current main dungeon system, but it should become a late-main-story/postgame system rather than something freely available from the beginning.

Proposed Abyss stages:

- Initial Abyss access:
  - Dungeon entry opens.

- Floor 40 boss defeated:
  - Surface ending.
  - Light Palace event opens.
  - One Reincarnation Fruit is granted.

- After Light Palace clear:
  - The party must return to the prison and spend one World Tree Leaf to restore and recruit Layla.
  - Regional endless exploration remains a separate system decision and is not an inn-transfer visibility condition.

- Final Altar / Azelgarag clear:
  - Lycion grants the Light Wing.

- Final Altar postgame crack:
  - Random Abyss opens.
  - The inn transfer door appears and becomes usable.

- Random Abyss high floors:
  - High-difficulty bosses may assume reincarnation.

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
  - Medal King and small medal explanation. The explanation is not an unlock gate.

- Light Palace priestess:
  - Layla's prison condition, Abyss foreshadowing, and reincarnation explanation.

## Tutorial Policy

Tutorial implementation is deferred until every target screen and interaction flow is complete. Tutorials built against obsolete screens create incorrect guidance and rework.

Before the UI completion gate, only maintain a tutorial-requirement ledger: what must be taught, the intended story timing, prerequisites, and measurable success conditions. Do not finalize tutorial copy, screenshots, pointer coordinates, or forced input sequences.

After the UI completion gate, build and validate tutorials against the final screens. Prefer teaching through current gameplay and story context rather than detached explanation screens.

There is no gacha tutorial because gacha is not planned for player use.

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
- Main menu access for blacksmith and dungeon systems is routed through shared unlock checks. Gacha has no current main-menu button.
- Abyss entry, inn teleport, Magic Boat, and Light Wing access now use the unlock foundation or legacy key-item compatibility. Casino and Medal exchange remain map-facility routes in the current implementation.
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

`Sky Prism` normally moves to the world-map entrance. When a fixed dungeon's actual entrance is authored inside another fixed map, resolve that `mapActions` entrance through the shared map registry and land on the entrance tile inside the parent fixed map instead of dropping the player on the world map.

### Phase 4: Facility Unlocks

- Fire Village clear opens blacksmith.
- Water City / Seabed Temple progression grants the Magic Boat and opens sea travel through `boat`, item `108`, and `hasShip` compatibility.
- Casino and Medal exchange are current map-facility routes rather than separately documented `progress.unlocked` gates.
- Demon King defeat does not currently open gacha through the player-facing menu route.
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

During the main story, the player should struggle forward with story allies. The intended RPG identity is not "use farming to brute-force everything", but "travel through fire, wind, water, thunder, light, and dark regions while gathering allies, tools, and systems."

After Demon King defeat and the later Abyss gates, expand the game as a long-term postgame RPG through the implemented Abyss, travel, and fixed-dungeon systems. Gacha is not part of the current player-facing unlock route.

## Tutorial Impact Review

大きな機能追加、操作導線の変更、既存仕様の大幅な変更を完了した際は、対象画面が確定した後にチュートリアルへの影響を確認する。

- 既存チュートリアルが新しい画面・用語・操作と矛盾しないか確認する。
- 初見プレイヤーが自力で理解しにくい変更であれば、チュートリアルの追加または修正案をユーザーへ提示する。
- 画面や操作が未完成の段階では、将来変更が前提となるランタイムチュートリアルを先行実装しない。
- チュートリアル変更が不要と判断した場合も、実装報告の影響確認欄へ理由を残す。
