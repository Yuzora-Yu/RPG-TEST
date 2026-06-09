# 実装済みストーリー進行メモ

作成日: 2026-06-08

## 実装方針

- ユーザー提示プロットを正として、`storyStep` / `subStep` と `flags` で進行を管理する。
- 固定ダンジョンのボスマスは、直接戦闘ではなく `startEventId` から会話イベントを起動する。
- ボス勝利後の進行は `winEventId` でつなぎ、固定ダンジョン内の鍵報酬は `keyRewardColor` で付与する。
- 戦闘後に予約された `pendingEventId` / `pendingBattleWinEventId` は、会話中ロックを引きずらないよう再開入口で状態を整理してから実行する。
- ランダムダンジョンの鍵と固定ダンジョンの鍵は別スコープで管理する。
- 固定ダンジョンの入口は、加入イベント未到達でも基本的に通行可能にする。進行条件が必要な場所は、ゲーム内世界観に沿った案内文で止める。
- マップやNPCの表示は、生成したタイル・オーバーレイ画像を `assets/map/...` に配置して参照する。

## メイン進行

### 火の里 / イグナ火山

- 里の長から、火のプリズムが弱まり鍛冶が止まった相談を受ける。
- 始まりの村クリア直後の `storyStep: 2 / subStep: 1` では、まず里の長へ相談する。
- 相談後の `storyStep: 2 / subStep: 2` で火山入口へ向かうと、シャオ加入イベントが発生する。断っても再度同行を求め、加入するまで進む。
- シャオ加入時は `ALLY 105` を実行し、加入メッセージを会話内にも表示する。空きパーティ枠がある場合は、その場でパーティにも入る。
- `IGNIS_VOLCANO` は3階層。
- 火の祭壇のボスマスは `fire_volcano_soldiers_encounter` から起動する。
- ブロンズリーダー、ブロンズナイト3体との戦闘後、炎楔のグラド戦へつながる。
- 兵士戦は `storyWinEventId: fire_volcano_soldiers_clear` でグラド登場イベントへ接続し、グラド戦は `301010` を参照する。
- グラド撃破後、火のプリズムが復活し、里の長への報告で鍛冶機能を解放する。
- 次の目的地は風の集落。

### 風の集落 / 禁忌の森 / 風の神殿

- 風の集落でエリーゼ加入イベントが発生する。
- 集落の西から `FORBIDDEN_FOREST` に入り、祈りの広場へ向かう構成にしている。
- 祈りの広場のボスマスは `wind_forest_guardians_encounter` から起動する。
- シルフウルフ、ヒールフェアリー戦後、風の神殿へ進む。
- `WIND_TEMPLE` は3階層。
- 風の祭壇のボスマスは `wind_temple_elicia_encounter` から起動する。
- 風楔のエリシア撃破後、風のプリズムが復活し、水上都市へ向かう流れに入る。

### 水上都市 / 海底神殿

- 水上都市で兵士に連行されそうな少女を助ける。
- 宿の酒場でソフィアから街の現状を聞き、ケイトが同行する。
- `SEABED_TEMPLE` は3階層。
- 1階の封鎖兵ボスマスは `sea_temple_gate_encounter` から起動し、撃破で赤鍵を取得する。
- 2階の赤水門は赤鍵を使わないと先へ進めない。
- 3階の祈祷の間では `water_temple_syris_encounter` から氷楔のシーリス戦が起動する。
- シーリス戦は不意打ち指定あり。
- 勝利後、水上都市に活気が戻り、船を取得する。ケイトは正式加入する。

### 雷の要塞

- 水上都市クリア後、船で雷の要塞へ向かえる。
- 要塞入口でジョセフ加入イベントが発生する。
- `THUNDER_FORT` は4階層。
- 地下1階のバトルマシーン戦は `thunder_machine_gate_encounter` から起動し、赤鍵を取得する。
- 地下2階のサンダーアーマー戦は `thunder_armor_gate_encounter` から起動し、青鍵を取得する。
- 地下3階のレナード戦は `thunder_leonard_encounter` から起動する。
- レナード撃破後、聖騎士ヴェルドとの負けイベントに入る。
- ジョセフ加入後、次の目的地は大灯台。

### 大灯台

- `BIG_TOWER` は10階層。
- 5階の結界炉で `big_tower_midboss_encounter` が起動する。
- ヘルクラッシャー、デモンキャット戦に勝つと金鍵を取得する。
- 6階の金扉を開けて上層へ進む。
- 10階の灯台頂上で `big_tower_lilith_encounter` が起動する。
- 常闇のリリス撃破後、光の神殿を覆う結界が消える。

### 光の宮殿

- 大灯台未攻略時は、結界により進行不能。
- `LIGHT_PALACE` は4階層。
- 最奥の光の祭壇で `light_palace_final_encounter` が起動する。
- 魔道神官ジャスパー、聖騎士ヴェルド戦に進む。
- 勝利後、レイラ加入と魔王城への目的更新を行う。

### 魔王城

- `DARK_CASTLE` は3階層。
- 地下1階の常闇のゼルドラス戦は `dark_castle_zeldras_encounter` から起動し、赤鍵を取得する。
- 地下2階の冥騎士ベレト、風詠のエルメナス戦は `dark_castle_belet_elm_encounter` から起動し、金鍵を取得する。
- 地下3階の金扉を開けた先で `dark_castle_zenon_encounter` が起動する。
- 魔王ゼノン戦後、闇のプリズムが守られていたこと、真の問題が混沌であることを明かす。
- シャニー加入後、深淵の入口へ向かう。

### 深淵の入口

- 6属性の加護を得た状態で、世界中央のひずみから深淵の魔窟が解禁される。
- 以降はランダムダンジョン探索へ接続する。

## 加入管理

- シャオ: イグナ火山入口の同行イベントで加入。火の里報告後も正式同行。
- エリーゼ: 風の集落で加入。風の神殿クリア後も正式同行。
- ケイト: 水上都市のソフィア依頼で加入。海底神殿クリア後に正式同行。
- ジョセフ: 雷の要塞突入時に加入。ヴェルド負けイベント後に正式同行。
- レイラ: 光の宮殿クリア後に加入。
- シャニー: 魔王城クリア後に加入。

## 固定ダンジョンと鍵

- `IGNIS_VOLCANO`: 3階層。火山道、溶岩回廊、火の祭壇。
- `FORBIDDEN_FOREST`: 2階層。封じられた森、祈りの広場。
- `WIND_TEMPLE`: 3階層。風廊、旋風の回廊、風の祭壇。
- `SEABED_TEMPLE`: 3階層。沈水回廊、赤水門、祈祷の間。赤鍵あり。
- `THUNDER_FORT`: 4階層。赤鍵、青鍵あり。
- `BIG_TOWER`: 10階層。5階中ボス、6階金扉、10階ボス。
- `LIGHT_PALACE`: 4階層。結界解除後に進行可能。
- `DARK_CASTLE`: 3階層。赤鍵、金鍵あり。

## マップチップ / 画像素材

- NPCオーバーレイは `assets/map/overlays/overlay_npc_*_v002.png` に配置。
- 追加済みNPC:
  - `overlay_npc_elder`
  - `overlay_npc_villager`
  - `overlay_npc_child`
  - `overlay_npc_dark_soldier`
  - `overlay_npc_bronze_knight`
- 鍵と扉:
  - `assets/map/objects/item_key_red_v002.png`
  - `assets/map/objects/item_key_blue_v002.png`
  - `assets/map/objects/item_key_gold_v002.png`
  - `assets/map/objects/door_key_red_v002.png`
  - `assets/map/objects/door_key_blue_v002.png`
  - `assets/map/objects/door_key_gold_v002.png`
- キャッシュ更新用に `PRISMA_ASSETS.cacheWarmup.version` を更新済み。

## 検証

- `node --check story.js map.js dungeon.js` 通過。
- `tools/validate-key-door-runtime.js` 通過。
- `tools/validate-map-safety.js` 通過。
- ストーリーイベント、会話スクリプト、モンスターID、固定マップボス参照の相互検査を通過。
- `docs/generated/fixed-dungeon-preview.html` を再生成し、ブラウザで中ボス階、赤/青/金扉、階層名を確認。
- `main.html` をローカル起動し、タイトル、続きから、フィールドHUD、目的表示にブラウザ警告/エラーが出ないことを確認。
