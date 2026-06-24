# PRISMA ABYSS Map / Story Editor

## 追加・変更したファイル

- `map_story_editor.html`  
  `map.js` / `story.js` 編集用の統合エディタです。ゲーム本体と同じ順序でマスタJSを読み込み、右側にゲーム内風プレビューを表示します。

- `maps_logic.js`  
  旧 `map.js` から `MapRegistry` と座標正規化ロジックを分離した保護用ロジックです。

- `story_logic.js`  
  旧 `story.js` から `StoryManager` 実行ロジックを分離した保護用ロジックです。

- `map.js`  
  編集対象データ専用に整理しました。`STORY_MAP_MUTATIONS`, `TILE_THEMES`, `STORY_DATA`, `MAP_DATA`, `FIXED_MAPS`, `FIXED_DUNGEON_MAPS` などを保持します。

- `story.js`  
  編集対象データ専用に整理しました。`STORY_MANAGER_DATA` の中に目的文、会話スクリプト、イベントを保持します。

- `index.html`  
  読み込み順を以下の形に変更しました。

```html
<script src="map.js"></script>
<script src="maps_logic.js"></script>
<script src="phaser-field.js"></script>
<script src="story.js"></script>
<script src="story_logic.js"></script>
```

## 使い方

1. プロジェクトルートで `map_story_editor.html` を開きます。
2. 左側からマップ、会話、イベントを選びます。
3. マップ編集時は右側Canvasでゲーム内風プレビューを見ながら、選択・ペン・矩形塗りができます。
4. 宝箱、ボス、階段、イベント/NPC、タイル効果、回復ポイントは「座標オブジェクト」から編集できます。
5. 既存機能の細かいキーは各「詳細JSON」で編集できます。
6. 「検証」で、タイル寸法、座標範囲、アイテムID、モンスターID、会話ID、イベントID、画像キーなどを確認できます。
7. 「map.js出力」「story.js出力」から編集済みファイルをダウンロードします。

## プレビューについて

- `assets/` フォルダが実プロジェクト内に存在する場合、`PRISMA_ASSETS.graphics` の画像パスを使って描画します。
- 画像が見つからない場合でも、`TILE_THEMES` の `color` を使って色付きタイルとして描画します。
- ワールドマップでは `STORY_DATA.areas.*.fieldTile` を拠点アイコンとして表示します。
- 固定マップ/固定ダンジョンでは、宝箱・ボス・階段・マップアクション・タイル効果・回復ポイントを重ね表示します。

## 注意

- 通常、エディタから出力するのは `map.js` と `story.js` のみです。
- `maps_logic.js` と `story_logic.js` はロジック保護用なので、原則として手編集しない想定です。
- ブラウザの制約により、HTML単体ではローカルの `assets/` フォルダを自動再帰スキャンできません。画像候補は `assets.js` の `PRISMA_ASSETS.graphics` を正本として参照します。
