# 24_IMPLEMENTATION_HOLD_POINTS_20260629

Status: hold / needs user decision before fix

2026-06-29の `prisma_abyss_latest_files_20260629.zip` 読み込み後、即時反映せず保留した実装項目。

## 1. 光の宮殿後、レイラ即加入をやめる導線

Source:

- `16_IMPLEMENTATION_PATCH_NOTES_20260629.md`

Proposal:

- `light_palace_clear` / `light_palace_overpower_clear` でレイラを即加入させない。
- 戦闘後は「宮殿の牢屋でレイラの様子を確認しよう」へ誘導する。
- 牢屋でレイラ加入イベントを起こす。
- レイラ未加入のままガルヴァニア洞窟北口へ行くと、兵士に止められ、牢屋へ戻るヒントを出す。

Hold reason:

- 現行のメイン導線、`storyStep` / `subStep`、目的ログ、マップ通行、イベント座標が連動する。
- `ALLY 204` のタイミングをずらすと、既存の魔王城導線・ガルヴァニア洞窟進行に影響する可能性が高い。
- 実装する場合は、フラグ設計、目的文、封鎖イベント、レイラ加入イベントを一括で入れる必要がある。

Decision needed:

- 採用するか。
- 採用する場合、レイラ加入地点を光の宮殿牢屋に固定するか。
- `storyStep` を `7-1` / `7-2` のように増やすか、既存step内のflagで管理するか。

## 2. `TOWN_FIRE_VILLAGER_2_BEFORE_REWRITE`

Source:

- `19_STORY_PATCH_SCRIPTS_BATCH3_20260629.js`
- `20_TOWN_DIALOGUE_PROGRESS_BANK_20260629_v2.md`

Proposal:

- 炎の里クリア前の料理番NPC台詞を追加する。

Hold reason:

- 現行 `story.js` に `TOWN_FIRE_VILLAGER_2_BEFORE` という script key はない。
- 既存の `TOWN_FIRE_VILLAGER_2` を置き換えるのか、新規NPC/条件付き会話として追加するのか判断が必要。
- NPC配置やイベントID接続なしに台本だけ追加すると未使用データになる。

Decision needed:

- 既存 `TOWN_FIRE_VILLAGER_2` をクリア前用に置き換えるか。
- 新規イベント `town_fire_villager_2_before` を追加し、マップ側で条件分岐させるか。

## 3. 仲間加入クエスト拡張案

Source:

- `21_COMPANION_QUEST_EXPANSION_DRAFT_20260629_v2.md`

Proposal:

- 仲間加入クエスト開始時点で、依頼者、目的地、討伐対象名、数、同行理由を自然な台詞で伝える。

Hold reason:

- `quests.js`、`story.js`、既存イベントの進行条件を横断する。
- 対象モンスター名と討伐数の整合確認が必要。
- 会話だけ差し替えると、実際のクエスト条件とズレる可能性がある。

Decision needed:

- どの仲間加入クエストから優先実装するか。
- 台詞だけ先行するか、クエスト条件表示も同時に直すか。

## Already applied in this pass

- `00_SCENARIO_CANON.md` polished版へ差し替え。
- `02_CHARACTER_VOICE_BIBLE.md` polished版へ差し替え。
- `12_ABYSS_AND_DIALOGUE_CANON_NOTES_20260629.md` polished版へ差し替え。
- `13` から `23` までの最新成果物を `docs/scenario/` に追加。
- `README.md` のファイル一覧更新。
- `story.js` の既存キーに安全に入る以下の本文差し替え:
  - `FIRE_VILLAGE_CONSULT`
  - `DARK_CASTLE_ZENON_ENCOUNTER`
  - `DARK_CASTLE_CLEAR`
  - `ABYSS_UNSEALED_FINAL`
