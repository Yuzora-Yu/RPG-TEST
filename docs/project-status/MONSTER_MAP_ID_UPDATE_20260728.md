# Monster / Map ID update history (2026-07-28)

- Normal monsters: 196 IDs reassigned into 50-ID blocks per five Rank bands.
- Quest bosses: 302201-302208 -> 303201-303208.
- Guild promotion examiners: 303100-303106 -> 304100-304106.
- Monster image filenames use six-digit IDs (`monster_000001.png`).
- `monsters.js` now owns habitat and Abyss-floor metadata and encounter candidate selection.
- `map.js` now owns stable map IDs; floor IDs use `MAPxxxxxx-NN`.
- Old save IDs are migrated at load and remain accepted by MonsterData lookups.
- Skill/trait books in guild point exchange require Rank A or higher.

`assets/monsters` is included as a complete final-state folder, including unchanged images. The seven guild promotion examiners now have standalone files `monster_304100.png` through `monster_304106.png`; each was initially copied from the boss sprite previously referenced by `imageId`. The `imageId` overrides were removed, so future examiner art can be replaced independently without code changes. See `GUILD_EXAMINER_IMAGE_COPY_MAP.csv` for the initial copy sources.


## Package note

- Replace the project `assets/monsters` folder with the included folder to obtain the clean final filename set.
- The folder contains 271 PNG files: 264 final existing images plus 7 standalone examiner images.
- If files are merged instead of replacing the folder, remove the paths listed in `DELETE_OLD_MONSTER_FILES.txt`.
