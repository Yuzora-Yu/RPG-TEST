# Character Runtime Assets

This folder is the runtime source of truth for character face images.

- File naming: `char_face_<characterId>.gif`
- Code hook: `characters.js` stores each character's `img` as `assets/characters/char_face_<id>.gif`.
- Raw generated or editing sources should go under `assets/managed/source/`, not here.
- Replaced accepted files should be moved to `assets/managed/old/YYYYMMDD-HHMMSS/` before adding the new version.
