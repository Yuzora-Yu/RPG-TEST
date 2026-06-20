# ストーリー実装フローまとめ 2026-06-05

## 実装方針

既存の `story.js` の開始村、開始洞窟、開始洞窟ボスのイベント座標は変更せず、その後の本編を `storyStep` 3 から 10 まで拡張した。

フィールド上の地域イベントは既存マップアクション座標にトリガーを追加し、固定ダンジョンのボス進行は既存ボス座標を維持したまま、`map.js` のボス定義へ `storyEventId` を付与して勝利後イベントへ接続している。

## 本編導線

| 順序 | 場所 | 発生条件 | イベントID | 主な内容 |
|---:|---|---|---|---|
| 1 | 始まりの村 | `START_VILLAGE` x6 y3, step 0 | `start_adventure` | ガイル、サラ加入。開始洞窟へ誘導 |
| 2 | 始まりの洞窟 | `START_CAVE` x1 y1, step 1 | `start_boss_battle` | 開始洞窟ボス撃破。step 2 へ |
| 3 | 炎の里 | `FIRE_VILLAGE` x14 y17, step 2 | `fire_village_clear` | シャオ加入。鍛冶屋解放 |
| 4 | 風の集落 | `WIND_VILLAGE` x14 y15, step 3 | `wind_village_clear` | エリーゼ加入。水上都市へ誘導 |
| 5 | 水上都市 | `WATER_CITY` x19 y13, step 4 | `water_city_clear` | ケイト加入。魔法の小舟入手。船、カジノ解放 |
| 6 | 深淵入口 | `ABYSS_FIELD` x8 y7, step 5 | `abyss_unsealed` | 深淵探索解放 |
| 7 | 大塔 | 固定ボス `401050` 勝利後 | `big_tower_clear` | 大塔結界破壊。雷の要塞へ誘導 |
| 8 | 雷の要塞 | 固定ボス `401030` 勝利後 | `thunder_fort_clear` | ジョセフ加入。メダル王解放 |
| 9 | 光の宮殿 | 固定ボス `401130` 勝利後 | `light_palace_clear` | レイラ加入。魔王城へ誘導 |
| 10 | 魔王城 | 固定ボス `401100` 勝利後 | `dark_castle_clear` | シャニー加入。ガチャ解放。メインストーリークリア |

## 追加会話スクリプト

| スクリプトID | 使用イベント | 会話の役割 |
|---|---|---|
| `FIRE_VILLAGE_ARRIVAL` | `fire_village_clear` | 既存の炎の里到着会話。火の宝玉が奪われた状況を提示 |
| `STORY_FIRE_CLEAR` | `fire_village_clear` | シャオが里の解放後に同行を決意し、妹シャニーの影を追う導線を提示 |
| `STORY_WIND_CLEAR` | `wind_village_clear` | エリーゼが罪悪感から逃げず、風を道に変える役として加入 |
| `STORY_WATER_CLEAR` | `water_city_clear` | ケイトが小舟を用意し、海路と雷の要塞への進行を開く |
| `STORY_ABYSS_UNSEALED` | `abyss_unsealed` | ガイルとサラが深淵探索の危険性を受け止める |
| `STORY_BIG_TOWER_CLEAR` | `big_tower_clear` | 大塔の結界破壊により雷の要塞が次目標になる |
| `STORY_THUNDER_CLEAR` | `thunder_fort_clear` | ジョセフが自分の迷いを認め、同行とメダル王解放を行う |
| `STORY_LIGHT_CLEAR` | `light_palace_clear` | レイラが「裁きではなく救い」の導線で魔王城同行を決意 |
| `STORY_DARK_CLEAR` | `dark_castle_clear` | シャニーを敵ではなく人として呼び戻し、加入と本編クリアへ接続 |

## 加入キャラクター

| キャラ | ID | 加入イベント |
|---|---:|---|
| ガイル | 109 | `start_adventure` |
| サラ | 110 | `start_adventure` |
| シャオ | 105 | `fire_village_clear` |
| エリーゼ | 106 | `wind_village_clear` |
| ケイト | 104 | `water_city_clear` |
| ジョセフ | 101 | `thunder_fort_clear` |
| レイラ | 204 | `light_palace_clear` |
| シャニー | 306 | `dark_castle_clear` |

## 解放フラグと入手物

| イベント | 解放、入手、フラグ |
|---|---|
| `fire_village_clear` | `unlocked.smith`, `flags.fireVillageCleared` |
| `wind_village_clear` | `flags.windVillageCleared` |
| `water_city_clear` | item `108` 魔法の小舟, `unlocked.boat`, `unlocked.casino`, `flags.hasShip`, `flags.waterCityCleared` |
| `abyss_unsealed` | `unlocked.abyss`, `flags.abyssOuterReached` |
| `big_tower_clear` | `flags.bigTowerCleared` |
| `thunder_fort_clear` | `unlocked.medalKing`, `flags.thunderFortCleared` |
| `light_palace_clear` | `flags.lightPalaceCleared` |
| `dark_castle_clear` | `flags.darkCastleCleared`, `flags.mainStoryCleared` |

ガチャは当面開放条件を設定せず、メニュー上では未開放として扱う。

## 鍵HUD修正

扉解錠時に `Dungeon.consumeDungeonKey(color)` を呼ぶようにした。これにより、扉を開けた色の鍵は保持順配列 `_order` からも削除され、ミニマップ下の鍵アイコン表示から即座に消える。

固定ダンジョン鍵は `progress.fixedDungeonKeys`、ランダムダンジョン鍵は `dungeon.randomKeys` のまま分離し、解錠時の消費も現在のダンジョンスコープに従う。

## 検証結果

| 検証 | 結果 |
|---|---|
| `node --check story.js dungeon.js map.js main.js assets.js sw.js` | OK |
| `tools/validate-map-safety.js` | OK。ランダム480階、鍵扉128階、床鍵190件、ストーリートリガー11件 |
| `tools/validate-key-door-runtime.js` | OK。ランダム鍵扉、固定鍵分離、鍵消費、守護者報酬を確認 |
| ストーリー参照検証 | OK。16イベント、11トリガー、固定ボス `storyEventId`、加入ID、目的文を確認 |

## 2026-06-05 追補

炎の里の火口座標は既存 `mapActions` と同じ場所にあるため、`main.js` のアクション再構築でストーリートリガーを mapAction より先に評価するよう修正した。これにより `FIRE_VILLAGE` x14 y17 の `fire_village_clear` が正しく起動する。

開始村への報告イベント `start_adventure3` は `storyStep=2/subStep=0` の一度だけ発生し、完了後に `subStep=1` へ進める。炎の里イベントは `storyStep=2/subStep>=1` で発生するため、報告前に炎の里へ入っても本編が飛ばない。

上部目的表示は `storyObjectives` に `2-1` から `10-0` まで追加済み。`2-1` は「東の果て『炎の里』へ向かい、火口を調べよう！！」を表示する。
