# docs/scenario

このディレクトリは、PRISMA ABYSSのシナリオ正本・草稿・レビュー・実装引き継ぎを管理する場所です。

機能解放やプレイヤー導線については、現行の `story.js` / `map.js` / `main.js` / `menus.js` を正とします。古い草稿やレビューに `gacha`、カジノ、メダル交換、船の解放方針が残っていても、最新実装と矛盾する場合は現行実装と最新READMEを優先します。

現在の制作指示は `docs/CURRENT_PRODUCT_DIRECTIVES_20260714.md` を最優先します。セリフに固定文字数制限はありません。チュートリアルは対象画面と操作フローがすべて完成するまで実装せず、ガチャはプレイヤー向け機能として使用しません。

## 重要な考え方

既存の `story.js` 等に入っている会話は、**実装済み資料**です。

しかし、それは自動的に「完成稿」「正史」「変更禁止」を意味しません。
同時に、AIが勝手に「古いから」「AIっぽいから」と判断して書き換えてよいものでもありません。

このディレクトリでは、以下を分けて扱います。

| 種別 | 意味 | 実装反映 |
|---|---|---|
| 現行実装 | 現在ゲームに入っている文章 | 既に反映済み |
| 未検証 | まだ品質・整合性を見ていない文章 | 追加反映不可 |
| 改善候補 | Codexが問題点と案を出した文章 | ユーザー判断待ち |
| 承認済み | ユーザーが採用した文章 | 反映可 |
| 正本 | 現時点で採用済みの公式シナリオ | 反映可 |

## ファイル一覧

- `00_SCENARIO_CANON.md`: 採用済み設定・進行・真相の整理
- `01_WRITING_RULES.md`: 文体・セリフ・AI臭禁止ルール
- `02_CHARACTER_VOICE_BIBLE.md`: キャラクター別の口調・感情・誤解
- `03_FORESHADOWING_LEDGER.md`: 伏線とミスリードの台帳
- `04_NPC_LIFE_DIALOGUE_BANK.md`: 生活感のあるNPC会話バンク
- `05_EVENT_SCRIPT_MASTER.md`: 各町・ダンジョン・イベント台本の正本候補
- `06_SCENARIO_REVIEW_CHECKLIST.md`: 実装前レビュー表
- `07_DIALOGUE_REVIEW_QUEUE.md`: 既存会話の改善候補・採用待ちリスト
- `08_IMPLEMENTATION_HANDOFF.md`: MarkdownからJSへ反映する時の引き継ぎ
- `09_EDITING_DIRECTIVE_20260629.md`: 既存会話を人間の生活に戻すための編集方針
- `10_ABYSS_STORYLINE_DRAFT_20260629.md`: 深淵1階から100階までのイベント・台詞ドラフト
- `11_TOWN_DIALOGUE_REWRITE_BATCH_20260629.md`: 町人会話を生活者の声へ戻す改稿バッチ
- `12_ABYSS_AND_DIALOGUE_CANON_NOTES_20260629.md`: 深淵終盤、ヴェルド/レイラ、台詞論理整合性の最新正本メモ
- `13_STORY_WIDE_POLISH_PROPOSALS_20260629_v4.md`: 物語全体のブラッシュアップ提案
- `14_CHARACTER_DETAIL_SHEETS_DRAFT_20260629_v3.md`: キャラクター詳細シート草稿
- `15_REFERENCE_DIALOGUE_STYLE_NOTES_20260629.md`: 参考作品から会話設計だけを抽出するメモ
- `16_IMPLEMENTATION_PATCH_NOTES_20260629.md`: 実装直前に確認すべき導線・台詞差し替え案
- `17_MULTI_VIEW_STORY_REVIEW_AND_REWRITE_POLICY_20260629.md`: 複数視点レビューと修正方針
- `18_STORY_FULL_REWRITE_PACKAGE_20260629_v3.md`: 全体改稿パッケージ
- `19_STORY_PATCH_SCRIPTS_BATCH3_20260629.js`: story.js向け差し替え候補スクリプト集
- `20_TOWN_DIALOGUE_PROGRESS_BANK_20260629_v2.md`: 町会話進行差分バンク
- `21_COMPANION_QUEST_EXPANSION_DRAFT_20260629_v2.md`: 仲間加入クエスト拡張案
- `22_CHARACTER_VOICE_BIBLE_REBUILD_V6_20260629.md`: キャラクターボイス再構築メモ
- `23_AUTHOR_DIRECTIVE_AND_HANDOFF_20260629_v2.md`: 作者意図と今後作業者向け引き継ぎ
- `24_IMPLEMENTATION_HOLD_POINTS_20260629.md`: 実装前にユーザー判断が必要な保留項目
- `README_LATEST_FILES.md`: 2026-06-29最新成果物ZIPの同梱一覧
- `CODEX_PROMPTS.md`: Codexに投げるプロンプト例

## Codexへの基本指示

```text
rpg-scenario-polisher を使ってください。

既存会話を確認する場合、
それを自動的に正本化しないでください。
ただし、勝手に修正・削除もしないでください。

不審点や改善余地があれば、
07_DIALOGUE_REVIEW_QUEUE.md に
現行文、問題点、現行維持案、軽微修正案、大幅修正案、推奨、実装影響、ユーザー判断欄を追加してください。

ユーザーが approved と明記した案だけを
05_EVENT_SCRIPT_MASTER.md または story.js へ反映してください。
```
