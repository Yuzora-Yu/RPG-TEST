# CODEX_PROMPTS

Codexに投げるためのプロンプト例。

## 1. 最初のセットアップ

```text
rpg-scenario-polisher を使ってください。

このリポジトリのRPGシナリオ制作ルールを整備してください。

必ず読むこと:
- AGENTS.md
- docs/development-policy.md
- docs/main-story-plot-prism-arc-20260608.md
- docs/implemented-story-flow-20260608.md
- docs/story-bible/README.md
- docs/story-bible/20260514/*.md
- story.js
- story_logic.js
- characters.js
- map.js
- maps_logic.js
- docs/scenario/*.md

今回やること:
- docs/scenario/00_SCENARIO_CANON.md を現行資料に合わせて更新
- docs/scenario/02_CHARACTER_VOICE_BIBLE.md に主要キャラの口調表を作る
- docs/scenario/03_FORESHADOWING_LEDGER.md に既存伏線を整理
- docs/scenario/05_EVENT_SCRIPT_MASTER.md に既存イベントの目次を作る
- 不審な既存会話は 07_DIALOGUE_REVIEW_QUEUE.md に候補化

重要:
- 既存会話を自動的に正史扱いしない
- 既存会話を勝手に修正しない
- 今回は JS 実装ファイルを変更しない
- 改善案には、現行維持・軽微修正・大幅修正を併記
- 採用判断はユーザーに委ねる
```

## 2. 1エリアだけ厚くする

```text
rpg-scenario-polisher を使ってください。

今回は「炎の里〜イグナ火山〜火の里報告」だけを対象に、
Markdownシナリオ正本候補を厚くしてください。

やること:
- 既存 story.js の該当会話を抽出
- 現行文は implemented_legacy として記録
- 不審点がある現行文は 07_DIALOGUE_REVIEW_QUEUE.md に送る
- シャオ、里の長、鍛冶師、村人、王国兵、グラドの口調方針を整理
- 炎の里NPC会話を最低30件作成
- イグナ火山内の石碑・遺物・兵士の独白・プリズム反応を追加
- シャオが魔王軍を疑うミスリードを薄く入れる
- 王国軍の異常は匂わせるが、深淵に魅了されている真相は明かさない
- 各セリフ1行30文字程度に調整

禁止:
- story.js を変更しない
- map.js を変更しない
- 既存会話を勝手に正本化しない
- 既存会話を勝手に置換しない

最後に:
- レビュー表を出す
- ユーザー判断が必要な DR-ID を一覧化する
```

## 3. 既存会話レビューだけを行う

```text
rpg-scenario-polisher を使ってください。

今回は既存会話レビューだけを行ってください。
実装ファイルは変更しないでください。

対象:
- story.js

観点:
- AIっぽい説明口調
- 30文字超過
- 口調混同
- その時点で知らない情報の開示
- 伏線が露骨すぎる
- NPCが攻略情報係になっている
- 感情の動機が薄い

出力先:
- docs/scenario/07_DIALOGUE_REVIEW_QUEUE.md

各項目には必ず以下を入れる:
- 現行文
- 問題点
- 案A: 現行維持
- 案B: 軽微修正
- 案C: 大幅修正
- Codex推奨
- 実装影響
- ユーザー判断欄

ユーザーが approved と書くまで、
改善案を story.js へ反映しないでください。
```

## 4. 採用済み案だけ実装する

```text
rpg-scenario-polisher を使ってください。

07_DIALOGUE_REVIEW_QUEUE.md のうち、
status が approved_light または approved_rewrite の項目だけを
story.js に反映してください。

条件:
- pending / later / rejected は触らない
- approved_keep は現行維持として扱い、必要なら正本側だけ更新
- 既存イベントIDは可能な限り維持
- storyStep/subStep の進行を壊さない
- progress.flags の条件を壊さない
- 各セリフ1行30文字程度に調整
- 実装後に node tools/check-dialogue-lines.mjs story.js を実行

最後に:
- 変更ファイル一覧
- 反映したDR-ID一覧
- 触ったscript key一覧
- 検証結果
- 残った懸念
を報告してください。
```

## 5. 追加イベントを提案させる

```text
rpg-scenario-polisher を使ってください。

今回は新規サブイベント案を提案してください。
まだ実装しないでください。

対象エリア:
- 任意、ただし現在の storyStep 進行と矛盾しないこと

条件:
- 既存設定と矛盾しない
- 未公開の真相を早出ししない
- キャラの感情または土地の生活から始まる
- ただの攻略報酬イベントにしない
- 伏線は入れても少量
- ミスリードは感情由来にする
- 実装可能な単位に分ける

出力:
- 05_EVENT_SCRIPT_MASTER.md に draft として追加
- 必要なNPC会話は 04_NPC_LIFE_DIALOGUE_BANK.md に追加
- 伏線がある場合は 03_FORESHADOWING_LEDGER.md に追加
- 実装が必要な場合は 08_IMPLEMENTATION_HANDOFF.md にメモ

最後に、ユーザーに採用判断が必要な候補一覧を出してください。
```
