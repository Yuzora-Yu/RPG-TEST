# AGENTS.md

## Project identity

This project is a personal Japanese RPG named **PRISMA ABYSS**.

The scenario should feel like an authored large-scale JRPG, not generic AI fantasy prose. Preserve mystery, character voice, local life, emotional bias, gradual revelation, and implementation safety.

## Required references before scenario work

Before editing scenario, dialogue, NPC text, story flags, map event text, or character-related content, read the relevant files first:

- `docs/development-policy.md`
- `docs/CURRENT_PRODUCT_DIRECTIVES_20260714.md`
- `docs/main-story-plot-prism-arc-20260608.md`
- `docs/implemented-story-flow-20260608.md`
- `docs/story-bible/README.md`
- `docs/story-bible/20260514/*.md`
- `docs/scenario/*.md`, if present
- `story.js`
- `story_logic.js`
- `characters.js`
- `map.js`
- `maps_logic.js`

## Scenario workflow

Do not implement substantial new dialogue directly into JavaScript first.

For scenario writing, expansion, review, or rewriting:

1. Update or create Markdown scenario sources under `docs/scenario/`.
2. Review the draft against `docs/scenario/06_SCENARIO_REVIEW_CHECKLIST.md`.
3. Put uncertain existing lines into `docs/scenario/07_DIALOGUE_REVIEW_QUEUE.md`.
4. Wait for user approval before replacing existing implemented dialogue.
5. Only approved material should be reflected into `story.js`, `map.js`, or related runtime data.
6. Keep implementation behavior compatible with `storyStep`, `subStep`, and `progress.flags`.

## Existing dialogue policy

Existing implemented dialogue is **legacy implemented source text**.

It is neither automatically final canon nor disposable draft.

Do not automatically treat existing dialogue as correct simply because it is implemented.
Do not automatically overwrite existing dialogue simply because it feels weak, AI-like, too explanatory, too long, or inconsistent.

When an existing line seems suspicious, weak, inconsistent, over-explanatory, spoiler-heavy, or AI-like:

1. Keep the existing line visible as `現行`.
2. Record the concern in `docs/scenario/07_DIALOGUE_REVIEW_QUEUE.md`.
3. Provide options such as `現行維持`, `軽微修正`, and `大幅修正`.
4. Give a Codex recommendation, but mark it as recommendation only.
5. Wait for user approval before implementation.

The user decides whether a legacy line becomes canon, gets revised, is rewritten, or is kept for now.

## Dialogue rules

- There is no fixed character-count limit for dialogue lines.
- Judge dialogue by on-screen readability, natural breathing, information density, and character voice.
- Split a thought only when the split improves rhythm, comprehension, or presentation; do not split mechanically by length.
- Consecutive lines by the same speaker are allowed.
- Do not make all characters speak in the same rhythm.
- Do not make NPCs exist only as hint dispensers.
- Do not explain mysteries completely through ruins, books, priests, villagers, or system text.
- Do not reveal information a character cannot know at that story point.
- Personal guesses, wrong rumors, prejudice, denial, and fear are allowed when grounded in the speaker.
- Foreshadowing must be light. Avoid obvious prophecy dumps.
- Misdirection should come from character emotion, local history, or partial information, not from unfair narrator lies.

## Anti-AI writing policy

Avoid generic AI-like prose:

- over-explaining
- symmetrical sentence rhythm
- everyone sounding equally polite, abstract, or wise
- vague grand words without concrete lived detail
- repeated phrases such as truth, essence, destiny, fate, world, darkness, light, unless earned
- summarizing emotions instead of showing behavior
- villagers who only state plot facts
- ancient texts that explain the entire backstory
- convenient speeches that solve the scene

Prefer:

- partial information
- local habits
- interrupted sentences
- wrong rumors
- character bias
- small physical detail
- silence
- contradiction
- later correction
- private motives
- practical concerns such as food, work, trade, weather, tools, family, fear, debts, injuries, and repairs

## Foreshadowing and misdirection

Foreshadowing should be sparse enough that the player notices it later, not immediately.

Misdirection should be emotionally motivated.

For example:

- Xiao may suspect Demon Castle or Demon King forces because of Shanny.
- Villagers may fear Demon King Zenon because inherited stories taught them to.
- Kingdom soldiers may sincerely believe sacrifice is salvation.
- Priests may use beautiful words while hiding coercion.
- Demon Castle residents may sound harsh while actually protecting something.

Do not reveal early that the kingdom army is being drawn into the Abyss unless the current story point already permits it.

## Scenario review gate

Before finalizing any scenario draft or implementation, check:

- character voice separation
- on-screen readability and dialogue rhythm
- story timing
- known facts versus hidden facts
- flag and party conditions
- NPC life detail
- exposition level
- foreshadowing subtlety
- implementation readiness
- whether user approval is required

If a change touches legacy implemented dialogue, it needs a review queue entry unless the user explicitly instructs direct replacement.

## Current product directives

- On first launch, ask whether to download the full image cache now. If the player selects Yes, show progress and wait for the complete download before starting. If the player selects No, start immediately and still cache the complete image set in the background. No means “do not wait before play,” not “disable full caching.” Do not use lazy/on-demand image fetching as the core policy. Keep every map, monster, boss, battle background, battle effect, and newly added visual registered in the centralized `assets.js` full-cache list. Optimize map rendering without reducing cache coverage. Do not repeat this prompt after the post-`PROLOGUE3` opening.
- Do not create or implement tutorials until all target screens and interaction flows are complete. A tutorial based on an obsolete screen is invalid. Tutorial planning notes may remain, but runtime tutorial implementation is deferred until the UI completion gate is satisfied.
- Gacha is not planned for player use. Keep legacy code only when removal would create unnecessary risk, but do not add a player-facing route, unlock, tutorial, reward dependency, or future-release promise.
- Do not infer effective starting combat stats from a single displayed value or one battle sample. Trace character master data, new-game copying, randomized starting equipment, `App.calcStats()`, traits, allocations, limit breaks, auras, and battle initialization first.
