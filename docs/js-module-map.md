# PRISMA ABYSS JavaScript Module Map

This document records the current responsibility of each runtime JavaScript file after the menu module split.

- `assets.js`: image path source of truth, `GRAPHICS`, battle effect paths, startup image preload lists, and Service Worker install/warm cache lists.
- `database.js`: constants, save key, static system tables, gacha/smith rates, and skill tree constants.
- `characters.js`: playable character master data and character face paths.
- `monsters.js`: monster master data and floor/boss enemy generation helpers.
- `monster-images.js`: monster ID to `assets/monsters/monster_<id>.png` mapping.
- `main.js`: app lifecycle, save/load, new/continue game, field map rendering, HUD, movement, action button refresh, and startup image warm cache handoff.
- `battle.js`: battle setup, enemy creation, turn/action resolution, damage/heal/status/passive rules, rewards, and battle rendering.
- `dungeon.js`: random dungeon state, floor generation, special dungeon objects, chests, stairs, boss/rift events, and dungeon entry/exit flow.
- `menus.js`: shared menu helpers, main menu open/close flow, sub-screen routing, rarity/equipment HTML helpers, and common dialogs.
- `menus_party.js`: party formation screen.
- `menus_status.js`: play status / adventure record screen.
- `menus_items.js`: consumable item list and field-use flow.
- `menus_inventory.js`: equipment inventory filtering, sorting, lock, select, and sell flow.
- `menus_allies.js`: ally list, ally status/equipment/skill/trait tabs, skill tree, and bonus point allocation.
- `menus_skills.js`: field skill use menu.
- `menus_book.js`: monster book list/detail screen and monster trait detail overlay.
- `menus_ally_detail.js`: ally archive and growth record detail screen.
- `menus_skill_detail.js`: skill detail modal.
- `menus_trait_detail.js`: trait detail and trait reroll modal.
- `menus_exchange.js`: exchange screen, daily rewards, and news list.
- `menus_news_detail.js`: news detail modal.
- `menus_achievements.js`: achievement list, filters, and reward claim UI.
- `polish.js`: UI polish hooks, tile themes, keyboard handling, battle effect routing, damage float/effect rendering, and post-load UI enhancements.
- `modern-polish.css`: single CSS source for title/game base layout, scoped page layout, modern UI polish, and battle effect styling paired with `polish.js`.
- `gacha.js`: gacha draw flow and card presentation.
- `facilities.js`: inn, medal exchange, casino/poker, and facility scene layout.
- `blacksmith.js`: equipment enhancement, forging, and blacksmith menu flow.
- `equips.js`: equipment master data and option/synergy definitions.
- `passiveSkill.js`: passive trait master data and trait/equipment passive helpers.
- `skills.js`: skill master data.
- `items.js`: item master data.
- `map.js`: world/fixed map data and tile theme base objects.
- `story.js`: story area data, event flow, and story progress helpers.
- `achievements.js`: achievement master data, progress checks, and reward grants.
- `news.js`: in-game news data.
- `sw.js`: PWA/service worker app shell cache, runtime asset cache, and background image warm cache.
- `serve-local.js`: local static file server for development verification.

Large-file split candidates remain `battle.js` and `main.js`. Split them only after behavior is stable and the new module boundary can be verified with gameplay smoke tests.
