# Monster Runtime Assets

This folder is the runtime source of truth for monster sprites.

- File naming: `monster_<monsterId>.png` for ID-mapped monsters.
- Legacy name fallback images may also live here when `battle.js` resolves by monster display name.
- Code hooks: `assets.js`, `monster-images.js`, `battle.js`, `menus.js`, `dungeon.js`, `main.js`, `index.html`, and `sw.js`.
- Raw generated or editing sources should go under `assets/managed/source/`, not here.
- Replaced accepted files should be moved to `assets/managed/old/YYYYMMDD-HHMMSS/` before adding the new version.
