# 実装済みストーリー進行メモ

作成日: 2026-06-08  
更新日: 2026-06-15

## 実装方針

- ユーザー提示プロットを正として、メイン進行は `storyStep` / `subStep`、補助状態は `progress.flags` で管理する。
- 「現在の目的」表示の正本は `story.js` の `StoryManager.storyObjectives`。UI側や `main.js` 側に目的文の分岐を増やさない。
- 固定フィールド上の進行イベントは `StoryManager.triggers`、固定ダンジョン内のボスマスは `map.js` の `startEventId` から会話イベントを起動する。
- ボス勝利後の進行は `winEventId` / `storyWinEventId` / `pendingEventId` / `pendingBattleWinEventId` でつなぐ。
- 戦闘後に予約されたイベントは、会話中ロックを引きずらないよう再開入口で状態を整理してから実行する。
- ランダムダンジョンの鍵と固定ダンジョンの鍵は別スコープで管理する。固定ダンジョン鍵は `progress.fixedDungeonKeys`、ランダム鍵は `dungeon.randomKeys` 側に寄せる。
- 固定ダンジョンの入口は、加入イベント未到達でも基本的に通行可能にする。進行条件が必要な場所は、ゲーム内世界観に沿った案内文で止める。
- マップやNPCの表示は、生成したタイル・オーバーレイ画像を `assets/map/...` に配置して参照する。

## メイン進行

### 0. オープニング / 始まりの村

- `game_start` で開幕戦闘を行い、勝利後に `storyStep: 0 / subStep: 2` へ進む。
- 開幕戦闘に負けた場合は `game_start_retry` に入り、一時的なLB99救済、全回復、再戦を行う。
- 始まりの村のイベントでガイル `109` とサラ `110` が加入し、`storyStep: 1 / subStep: 1` へ進む。
- 始まりの洞窟のボス `301000` 撃破後、`storyStep: 2 / subStep: 0` となり炎の里へ向かう。

### 1. 火の里 / イグナ火山

- `storyStep: 2 / subStep: 1` では、火の里の長へ相談する。
- `fire_village_consult` で `fireVillageConsulted` を立て、`storyStep: 2 / subStep: 2` へ進む。
- 火山入口の `fire_volcano_entrance` でシャオ `105` が加入し、`shaoJoinedAtVolcano` を立てて `storyStep: 2 / subStep: 3` へ進む。
- `IGNIS_VOLCANO` は3階層。
- 火の祭壇のボスマスは `fire_volcano_soldiers_encounter` から起動する。
- 初回はブロンズリーダー `301002`、ブロンズナイト `301001` x3 戦。勝利後 `fireVolcanoSoldiersCleared` を立て、同じボスタイルから炎楔のグラド `301010` 戦へつながる。
- 旧データ互換として、兵士戦勝利後にボスタイルだけ討伐済みになっていた場合でも、火のプリズム未復旧ならグラド再戦用タイルとして復旧する処理が `dungeon.js` にある。
- グラド撃破後、`firePrismRestored` を立て、`storyStep: 2 / subStep: 4` へ進む。
- 火の里へ報告する `fire_village_report` でシャオを再加入保証し、`smith` を解放し、`fireVillageCleared` を立てて `storyStep: 3 / subStep: 0` へ進む。

### 2. 風の集落 / 禁忌の森 / 風の神殿

- 風の集落の `wind_village_intro` でエリーゼ `106` が加入し、`eliseJoinedAtWindVillage` を立てて `storyStep: 3 / subStep: 1` へ進む。
- 集落西の `wind_forest_entry` で `windForestEntryIntroduced` を立て、`FORBIDDEN_FOREST` へ入る。
- `FORBIDDEN_FOREST` は2階層。
- 祈りの広場のボスマスは `wind_forest_guardians_encounter` から起動する。
- シルフウルフ `301011`、ヒールフェアリー `301012` 撃破で金鍵を取得し、`windForestCleansed` を立てて `storyStep: 3 / subStep: 2` へ進む。
- `WIND_TEMPLE` は3階層。風の祭壇のボスマスは `wind_temple_elicia_encounter` から起動する。
- 風楔のエリシア `301020` 撃破後、エリーゼを再加入保証し、`windVillageCleared` を立てて `storyStep: 4 / subStep: 0` へ進む。

### 3. 水上都市 / 海底神殿

- 水上都市の `water_city_intro` で暗黒兵士 `301021` x2 戦が発生し、勝利後 `water_city_sophia` へつながる。
- `water_city_sophia` でケイト `104` が加入し、`kateJoinedAtWaterCity` を立て、`storyStep: 4 / subStep: 1` へ進み、`SEABED_TEMPLE` へ入る。
- `SEABED_TEMPLE` は3階層。
- 1階の封鎖兵ボスマスは `sea_temple_gate_encounter` から起動する。
- 暗黒兵士 `301021` x2 と氷楔のシーリス側近 `301022` 撃破で、赤鍵と青鍵を同時取得し、`seabedTempleGateCleared` を立てる。
- 3階の祈祷の間では `water_temple_syris_encounter` から `301022`, `301030`, `301022` の不意打ち戦が起動する。
- 勝利後 `water_temple_clear` でケイトを再加入保証し、魔法の小舟 `108` を取得し、`boat` と `medalKing` を解放し、`hasShip` / `waterCityCleared` を立てて `storyStep: 5 / subStep: 0` へ進む。
- 注意: 長期方針では水上都市クリアで `boat` と `casino`、雷の要塞クリアで `medalKing` の想定だったが、現行の `water_temple_clear` は `boat` + `medalKing` を解放する。後述の評価を参照。

### 4. 雷の要塞

- `storyStep: 5 / subStep: 0` 以降、船または `hasShip` があると雷の要塞へ入れる。
- 雷の要塞初回突入時は `thunder_fort_entry` が発生し、ジョセフ `101` が加入し、`josephJoinedAtThunderFort` を立てて `THUNDER_FORT` へ入る。
- `THUNDER_FORT` は4階層。
- 地下1階の `thunder_machine_gate_encounter` でバトルマシーン `301031` 戦が起動し、赤鍵を取得する。
- 地下2階の `thunder_armor_gate_encounter` でサンダーアーマー `301032` 戦が起動し、青鍵を取得する。
- 地下3階の `thunder_leonard_encounter` でレナード `301040` 戦が起動する。
- レナード撃破後、`thunder_fort_clear` で聖騎士ヴェルド `301050` 戦に入る。
- ヴェルド戦は `bossStatMultiplier: 3`。勝った場合も `thunder_veld_forced_loss` で通常全滅演出へ落とす。負けた場合は `thunder_veld_loss` へ入る。
- `thunder_veld_loss` ではジョセフを再加入保証し、`medalKing` を解放し、`thunderFortCleared` を立てて `storyStep: 6 / subStep: 0` へ進む。
- 注意: `thunder_veld_forced_loss` は現状 `casino` を解放する。一方で通常敗北側の `thunder_veld_loss` は `medalKing` を解放する。どちらの分岐でも最終的な解放内容が揃うよう整理した方がよい。

### 5. 大灯台

- `BIG_TOWER` は10階層。
- 雷の要塞クリア前でも入場自体は可能。ただし `map.js` のボス定義側で `thunderFortCleared` を要求するため、進行用ボスは出現しない。
- 5階の結界炉で `big_tower_midboss_encounter` が起動する。
- ヘルクラッシャー `301060`、デモンキャット `301062` 撃破で金鍵を取得する。
- 6階の金扉を開けて上層へ進む。
- 10階の灯台頂上で `big_tower_lilith_encounter` が起動し、常闇のリリス `301061` 戦へ入る。
- 勝利後 `big_tower_clear` で `lighthouseCleared` / `bigTowerCleared` を立て、`storyStep: 7 / subStep: 0` へ進む。

### 6. 光の宮殿

- 大灯台未攻略時は、結界により進行不能。
- `LIGHT_PALACE` は4階層。
- 最奥の光の祭壇で `light_palace_final_encounter` が起動し、魔道神官ジャスパー `301070`、聖騎士ヴェルド `301050` 戦へ進む。
- 初回戦は `bossStatMultiplier: 3`。勝利できた場合は `light_palace_overpower_clear`、敗北した場合は `light_palace_blessing_retry` へ進む。
- 敗北側は会話、全回復、再戦を挟み、再戦勝利後 `light_palace_clear` へ進む。
- どちらの勝利ルートでもレイラ `204` が加入し、`lightPalaceCleared` を立て、`storyStep: 8 / subStep: 0` へ進む。

### 7. 魔王城

- `DARK_CASTLE` は3階層。
- 光の宮殿クリア前は進行不能。
- 地下1階の `dark_castle_zeldras_encounter` で常闇のゼルドラス `301080` 戦が起動し、青鍵を取得する。
- 地下2階の `dark_castle_elmenas_encounter` で風詠のエルメナス `301082` 戦が起動し、赤鍵を取得する。
- 地下2階の `dark_castle_belet_elm_encounter` で冥騎士ベレト `301081` 戦が起動し、金鍵を取得する。
- 地下3階の金扉を開けた先で `dark_castle_zenon_encounter` が起動し、魔王ゼノン `301100` 戦へ入る。
- 勝利後 `dark_castle_clear` でシャニー `306` が加入し、`darkCastleCleared` / `prismBlessingsComplete` を立てて `storyStep: 9 / subStep: 0` へ進む。
- 魔王ゼノン戦後、闇のプリズムが守られていたこと、真の問題が混沌であることを明かす。

### 8. 深淵の入口

- `storyStep: 9 / subStep: 0` 以降、世界中央の `ABYSS_FIELD` 座標で `abyss_unsealed` が発生する。
- `abyss_unsealed` で `abyss` を解放し、`abyssOuterReached` を立て、`storyStep: 10 / subStep: 0` へ進み、深淵の魔窟へ入る。
- `StoryManager.maxMainStoryProgress` は `storyStep: 10 / subStep: 0`。以後の目的文はダンジョン目標へ切り替わる。

## 加入管理

- ガイル `109`: 始まりの村イベントで加入。初期Lv1。
- サラ `110`: 始まりの村イベントで加入。初期Lv1。
- シャオ `105`: イグナ火山入口の同行イベントで加入。火の里報告でも再加入保証。初期Lv5。
- エリーゼ `106`: 風の集落で加入。風の神殿クリアでも再加入保証。初期Lv10。
- ケイト `104`: 水上都市のソフィア依頼で加入。海底神殿クリアでも再加入保証。初期Lv14。
- ジョセフ `101`: 雷の要塞突入時に加入。ヴェルド戦後でも再加入保証。初期Lv20。
- レイラ `204`: 光の宮殿クリア後に加入。初期Lv32。
- シャニー `306`: 魔王城クリア後に加入。初期Lv40。

`App.addStoryAlly()` は、既に加入済みのキャラにも対応している。既存キャラは初期Lv基準まで内部レベルアップし、空きパーティ枠があれば自動で入る。未加入キャラはガチャ産と同じ保存構造で生成され、初期Lvまで通常レベルアップ相当の成長、SP、特性付与を適用する。

## 固定ダンジョンと鍵

- `IGNIS_VOLCANO`: 3階層。兵士戦からグラド戦への同一タイル連戦。
- `FORBIDDEN_FOREST`: 2階層。守護者戦で金鍵。
- `WIND_TEMPLE`: 3階層。風楔のエリシア戦。
- `SEABED_TEMPLE`: 3階層。封鎖兵戦で赤鍵と青鍵。
- `THUNDER_FORT`: 4階層。地下1階で赤鍵、地下2階で青鍵。
- `BIG_TOWER`: 10階層。5階中ボスで金鍵、6階金扉、10階ボス。
- `LIGHT_PALACE`: 4階層。大灯台クリア後に進行可能。
- `DARK_CASTLE`: 3階層。ゼルドラスで青鍵、エルメナスで赤鍵、ベレトで金鍵。

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

## サブクエスト / 仲間加入クエスト追加前提の評価

### 現在の強み

- `StoryManager.events` は `CONV`, `BOSS`, `ALLY`, `FLAG`, `UNLOCK`, `ITEM`, `START_FIXED_DUNGEON`, `IF_FLAG`, `CHOICE` を持っており、会話、戦闘、報酬、分岐を一つのデータ列で表現できる。
- `StoryManager.triggers` と `main.js` の `resolveProgressEvent()` は、進行度とフラグでイベントを出し分けられる。
- `App.addStoryAlly()` は重複加入、初期Lv補正、控え加入に耐えるため、仲間加入クエストの報酬処理として再利用しやすい。
- `lbProgress.sources.quest` は既にデータ構造に存在する。将来、クエスト報酬で限界突破値を与える余地がある。

### 現在の弱点 / 追加前に整えたい点

- サブクエスト専用の状態領域がまだない。すべて `progress.flags` に積むと、メイン進行、加入済み、施設解放、一時状態、サブクエスト段階が混在し、後で追跡が難しくなる。
- `StoryManager.triggers` はメイン進行向けの座標トリガーが中心。複数NPCの会話段階、受注中、報告待ち、完了後会話を増やすには、クエストID単位の条件表現が欲しい。
- 解放タイミングに一部不整合がある。`water_temple_clear` は `boat` + `medalKing`、`thunder_veld_forced_loss` は `casino`、`thunder_veld_loss` は `medalKing` を解放する。長期方針では水上都市で `boat` + `casino`、雷の要塞で `medalKing` が自然。
- 旧系統イベントらしい `fire_village_clear`, `wind_village_clear`, `water_city_clear` と、現在の細分化イベントが併存している。使っていないなら互換イベントとして明記し、使うなら現行ルートと報酬内容を合わせる。
- `tools/validate-key-door-runtime.js` は、現行の複数鍵報酬、固定ダンジョン鍵タイル、固定鍵スコープに合わせて更新済み。

### 推奨するクエスト状態設計

将来のサブクエストは、`progress.flags` に直接フラグを増やすより、次のような専用領域を追加するのが望ましい。

```js
progress.quests = {
  shao_personal_01: {
    state: "notStarted", // notStarted | active | reportReady | cleared | failed
    step: 0,
    flags: {},
    startedAtStoryStep: 3,
    clearedAt: null
  }
};
```

実装ルール:

- メイン進行のロックは `storyStep` / `subStep` を使う。
- クエスト内部の段階は `progress.quests[questId].step` を使う。
- 一回限りの事実は `progress.quests[questId].flags` に閉じる。
- 世界全体に影響する事実だけ `progress.flags` に昇格する。
- 仲間加入済み判定は、最終的には `App.data.characters` の `charId` とクエスト完了状態の両方で見る。

### 推奨するイベント設計

- メインストーリーイベントIDは現状通り `fire_...`, `wind_...` など地域名で始める。
- サブクエストは `quest_<character>_<number>_<phase>` のように命名する。
- 仲間加入クエストは `ally_<character>_<phase>` でもよいが、通常のサブクエストと同じ処理系に乗せる。
- `ALLY` 報酬を含むイベントでは、同時に `FLAG` または `QUEST_SET` 相当の完了状態を保存する。
- メイン進行を進める `STEP` / `SUB` は、原則メインストーリーイベントだけで使う。サブクエストでは使わない。

### 追加したいイベントアクション

現行のアクションだけでも簡単なクエストは作れるが、以下があると拡張が安定する。

- `QUEST_START`: `progress.quests[questId]` を作成し、`state: "active"` にする。
- `QUEST_STEP`: クエストの `step` を更新する。
- `QUEST_FLAG`: クエスト内フラグを更新する。
- `QUEST_CLEAR`: `state: "cleared"` と `clearedAt` を保存し、必要なら報酬をまとめて処理する。
- `REWARD_LB`: `App.addLimitBreak(char, amount, "quest")` を呼ぶ。
- `REWARD_GOLD` / `REWARD_GEM`: サブクエスト報酬用。

これらを足す場合も、既存の `processAction()` に小さく追加するだけで済む。

### 加入クエストを作る時の注意

- 「仮加入」と「正式加入」を分けるなら、仮加入時にも `ALLY` を呼ぶのか、戦闘ゲスト専用構造を作るのかを先に決める。
- 現状の `ALLY` は即座に永続加入する。仮加入をやるなら `TEMP_ALLY` のような別アクションが必要。
- パーティ枠が埋まっている時は控え加入になる。加入演出では「パーティ」ではなく「仲間」表現にしておくと齟齬が出にくい。
- 個人クエストで限界突破や専用スキルを解放する場合、`lbProgress.sources.quest` と `trials` を混ぜない。
- 高レアキャラの早期加入は長期方針に反するため、メイン中はゲスト出演、正式加入は後半またはポストゲームに寄せる。

## 検証結果と評価

2026-06-15 時点の確認:

- `node --check story.js`
- `node --check map.js`
- `node --check dungeon.js`
- `node --check battle.js`
- `tools/validate-map-safety.js`
- `tools/validate-key-door-runtime.js`

上記の構文チェック、マップ安全性検証、鍵/扉ランタイム検証は通過。

- `validate-map-safety.js`: Random floors 480を確認。Locked-door floors と Floor keys はランダム生成結果により実行ごとに多少変動する。直近実行例は Locked-door floors 104、Floor keys 153、Story triggers 14。
- `validate-key-door-runtime.js`: Fixed doors 13、Fixed floor links 50。ランダム床鍵/扉、守護者報酬、複数鍵固定ボス報酬を確認。

追加確認:

- `StoryManager.events` を機械的に走査し、`ALLY`, `UNLOCK`, `ITEM`, `FLAG`, `BOSS`, `STEP`, `SUB` の流れを確認した。
- `StoryManager.triggers` を確認し、始まりの村、始まりの洞窟、火の里、風の集落、水上都市、深淵入口の座標トリガーを確認した。
- `App.addStoryAlly()` の重複加入処理、初期Lv補正、空きパーティ枠への自動編入を確認した。
- `dungeon.js` の固定ボス処理、鍵報酬、討伐済みボス管理、火山兵士戦からグラド戦への互換処理を確認した。

未完了 / 注意:

- `water_temple_clear` / `thunder_veld_forced_loss` / `thunder_veld_loss` の解放内容は、長期方針と揃える価値がある。
- 今後のサブクエスト追加前に、`progress.quests` の導入とイベントアクション追加を行うと、後からの修正量を抑えられる。
