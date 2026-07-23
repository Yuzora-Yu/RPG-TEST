# 会話ワークブック反映記録（2026-07-23）

## 正本と編集方針

- 実行時の正本は `story.js` とする。
- 会話文に固定文字数制限は設けない。旧30文字制限を前提にした編集・検証は行わない。
- チュートリアル文はゲーム本編・画面が完成してから作成する。今回ワークブックに含まれた新規 `【TIPS】` 行は意図的に未反映。
- 会話ワークブックの列Fに単独で存在した `QUEST_KARIN_VOLCANO_ENCOUNTER` の `46223` は、会話・演出指定として解釈できないため未反映。

## 旧互換経路の整理

参照元をリポジトリ全体で確認したうえで、定義以外から呼ばれていなかった次のイベント経路を会話配列とともに削除した。

- `fire_village_clear`
- `wind_village_clear`
- `water_city_clear`
- `FIRE_VILLAGE_ARRIVAL`
- `STORY_FIRE_CLEAR`
- `STORY_WIND_CLEAR`
- `STORY_WATER_CLEAR`

次のイベントIDは、固定マップの `storyEventId` およびボスの `winEventId` から現在も呼ばれるため維持した。ただし、未参照だった旧 `STORY_*_CLEAR` 会話配列は削除し、現行の専用会話だけを使用する。

- `thunder_fort_clear` → `THUNDER_LEONARD_CLEAR` と後続戦闘
- `big_tower_clear` → `LIGHTHOUSE_CLEAR`
- `light_palace_clear` → `LIGHT_PALACE_CLEAR`
- `dark_castle_clear` → `DARK_CASTLE_CLEAR`

## 今回追加した実行時分岐

- 初期村・火の里・風の集落の一度きりの贈り物会話と取得済み会話
- 風の集落の進行後会話
- カリン加入クエスト開始会話
- 禁忌の森の守護者撃破後イベント
- `WIND_TEMPLE_ELICIA_ENCOUNTER` 終端のエリシアは `charId` なし

## 検証

```powershell
node tools/validation/validate-story-dialogue-data.js
node tools/validation/validate-main-story-routing.js
node tools/validation/validate-quest-runtime.js
node tools/validation/validate-quest-experience.js
```

検証は、会話ID参照、イベント参照、マップアクション参照、クエスト開始イベント参照を対象とする。未参照会話は自動削除せず、作者の意図を確認してから個別整理する。
