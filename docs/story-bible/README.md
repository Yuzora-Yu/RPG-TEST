# PRISMA ABYSS Story Bible Archive

This folder stores current story, worldbuilding, character relationship, and future-plot references.

## Current Archive

- `20260514/`: extracted contents of `prisma_story_bible_20260514.zip`.
- `20260514/source/prisma_story_bible_20260514.zip`: original source archive copied from the provided file.

## 20260514 Contents

- `README.md`: original package index.
- `01_内部用_世界観設定集.md`: worldbuilding, six elements, Prisma, kingdom, Demon Castle, gods, and Abyss.
- `02_内部用_ストーリー進行と機能解放方針.md`: story progression and feature unlock policy.
- `03_内部用_キャラクター設定集_by_area.md`: character placement by area and story-use notes.
- `04_内部用_キャラクター相関整理.md`: major relationship axes and emotion tags.
- `05_内部用_隠し設定と今後の伏線.md`: hidden settings, future foreshadowing, and NPC dialogue seed ideas.
- `06_ゲーム内用_オープニングプロローグ案.md`: opening narration drafts.
- `07_Codex向け_実装指示メモ.md`: implementation notes for unlock flags, story joins, and future `characters.js` metadata.
- `08_characters_current_data_summary.md`: current character data summary.
- `09_characters_current_data_summary.tsv`: tabular current character summary.
- `10_編集メモ_今後characters_jsへ入れたい項目.md`: proposed structured `story` metadata for characters.

TXT duplicates are preserved as source copies. Prefer the `.md` files for editing and reference.

## Usage Rules

- Treat files labeled `内部用` as internal planning material. Do not expose hidden relationships or late-story twists directly in early-game dialogue.
- Use `06_ゲーム内用_オープニングプロローグ案.md` as the safer source for player-facing text.
- Before implementing story, NPC, unlock, or character metadata changes, check this archive and `docs/development-policy.md`.
- When adding a new story bible package, store it in a dated folder and keep the original zip under that folder's `source/` directory.

## Key Design Notes

- The world is built around six elements: fire, wind, water, thunder, light, and dark.
- Chaos is not a seventh element; it is the scar created where the six-element law cracked.
- Demon King Zenon should remain harsh and frightening, not simply become a misunderstood good person.
- The early game should follow story allies and regional progression before gacha, abyss farming, reincarnation, and endless exploration become central.
- Character relationships are dense and should be revealed gradually through events, NPCs, rumors, and postgame content.
