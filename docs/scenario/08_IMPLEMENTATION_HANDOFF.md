# 08_IMPLEMENTATION_HANDOFF

Markdownシナリオから `story.js`、`map.js`、`maps_logic.js` などへ反映する時の引き継ぎ。

## Implementation policy

実装に進めるのは、以下のいずれかのみ。

1. ユーザーが明示的に実装を指示した新規草稿
2. `05_EVENT_SCRIPT_MASTER.md` で `approved` になっている台本
3. `07_DIALOGUE_REVIEW_QUEUE.md` で `approved_*` になっている既存会話修正

以下は実装不可。

- `pending` の改善案
- `draft` の未承認草稿
- Codexが勝手に良いと判断しただけの文章
- 既存会話のサイレント置換

## Before implementation

必ず確認すること:

- 対象ファイル
- script key
- map event
- storyStep/subStep
- required flags
- flags to set
- party assumptions
- approved status
- 30文字超過の有無

## Runtime files

主な確認先:

- `story.js`: story data and scripts
- `story_logic.js`: runtime story manager logic
- `map.js`: map data
- `maps_logic.js`: map event and movement logic
- `characters.js`: character names, IDs, related data

## story.js reflection template

```md
## IMPL-000

Status: ready / implemented / blocked
Source:
- scenario file:
- review queue ID:
- approval status:

### Target
- file:
- script key:
- current storyStep-subStep:
- target storyStep-subStep:

### Change summary
- 

### Dialogue keys changed
- 

### Flags changed
- set:
- check:
- remove:

### Risks
- save compatibility:
- event duplication:
- premature spoiler:
- long line:

### Validation
- `node tools/check-dialogue-lines.mjs story.js`
- manual route check:
- browser smoke test:
```

## After implementation report

Codexは実装後に以下を報告する。

```md
## Implementation report

### Files changed
- 

### Approved source used
- 

### Script keys changed
- 

### Flags touched
- 

### Long line check
- result:

### Manual concerns
- 

### User follow-up needed
- 
```
