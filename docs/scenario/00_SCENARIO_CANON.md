# 00_SCENARIO_CANON

このファイルは、PRISMA ABYSSの採用済みシナリオ正本を管理する。

## Canon policy

正本は、以下の順で確定する。

1. ユーザーが明示的に承認した設定・会話・イベント
2. `docs/story-bible/` の既存設定のうち、現在も破棄されていないもの
3. 現在の `story.js` / `map.js` / `main.js` に実装されている内容
4. `docs/development-policy.md` と矛盾しない長期方針
5. Codexが追加した草稿

注意:

- 機能解放・プレイヤー導線は現行実装を正とする。古い方針資料と矛盾する場合は、現行実装と最新READMEを優先する。
- Codex草稿は、ユーザー承認前には正史ではない。
- 矛盾がある場合は勝手に解決せず、候補を分けて提示する。
- 既存実装を変更する場合は、`07_DIALOGUE_REVIEW_QUEUE.md` またはユーザーの明示指示が必要。

## Core progression

現在想定するメイン進行:

1. 始まりの村
2. 炎の里
3. 北の風の集落
4. 水上都市
5. 雷の要塞
6. 光の神殿
7. 魔王城
8. 深淵

元素順:

1. 火
2. 風
3. 水
4. 雷
5. 光
6. 闇

## Current story objectives source

`story.js` の `STORY_MANAGER_DATA.storyObjectives` を確認すること。
目的文は `storyStep-subStep` のキーと対応する。

新しい進行を追加する場合:

- `storyObjectives` を更新する。
- `story_logic.js` の進行仕様を壊さない。
- セーブ互換性を保つ。

## Known major hidden structure

このセクションは、プレイヤーに早出ししてはいけない真相を管理する。

### Hidden truth candidates

- 魔王軍は単純な悪ではなく、各地のプリズムを独自に守ろうとしている可能性がある。
- 王国軍こそが深淵に魅了され、暴走している可能性がある。
- シャオは魔王軍への恨みやシャニー関連の感情から、真の敵を誤認しやすい。
- 魔王ゼノンや魔王城側の言葉は、序盤では信用されにくくてよい。

### Spoiler discipline

序盤で明かしてよいもの:

- 魔物や魔王軍への恐怖
- 王国軍への信頼
- プリズムの異変
- 伝承の不完全さ
- 兵士や神官の不自然な熱狂

序盤で明かしてはいけないもの:

- 王国軍が深淵に魅了されているという明確な真相
- 魔王軍がプリズムを守っていたという断定
- 深淵の全体構造
- 後半加入キャラの核心的な秘密

## Area canon template

以下の形式で、各エリアの正本を追記する。

```md
## Area: 炎の里

### Story timing
- storyStep:
- subStep:
- required flags:
- party:

### Adopted canon
- 

### Current implemented facts
- 

### Unverified legacy lines
- 

### Approved changes
- 

### Hidden facts not to reveal here
- 

### Notes
- 
```

## Area: 始まりの村

### Story timing
- storyStep: 0-1
- required flags: なし
- party: アルス単独から、ガイル・サラ加入へ

### Adopted canon
- アルスの本当の故郷は始まりの村ではない。
- 始まりの村は、アルスが「復讐者」から「仲間を持つ旅人」へ変わる最初の場所。
- ガイルとサラは始まりの村の住人。

### Current implemented facts
- `game_start` で開幕戦闘を行う。
- 始まりの村の事件後、ガイル `109` とサラ `110` が加入する。
- 始まりの洞窟のボス撃破後、炎の里へ向かう。

### Unverified legacy lines
- 序盤の村長・ガイル・サラ会話は長文が多く、レビュー対象。

### Hidden facts not to reveal here
- 深淵の王の正体。
- 王国軍と深淵の関係。
- 魔王ゼノンの真意。

### Notes
- アルスの喪失は重く置くが、始まりの村を「滅びた故郷」にしない。

## Area: 炎の里 / イグナ火山

### Story timing
- storyStep: 2
- required flags: `fireVillageConsulted`, `shaoJoinedAtVolcano`, `firePrismRestored`
- party: アルス、ガイル、サラ、シャオ

### Adopted canon
- 炎の里は鍛冶と炉で成り立つ土地。
- 火のプリズム異変により、鍛冶が止まり里全体が困窮している。
- シャオは里を背負う同行者であり、魔王軍への疑いを抱きやすい。

### Current implemented facts
- `fire_village_consult` で里の長から相談を受ける。
- `fire_volcano_entrance` でシャオ `105` が加入する。
- イグナ火山で王国兵戦からグラド戦へ進む。
- `fire_village_report` で鍛冶機能が解放される。

### Unverified legacy lines
- グラド、里長、シャオの会話は一部説明が長く、行長レビュー対象。

### Hidden facts not to reveal here
- 魔王軍がプリズムを守ろうとしていた可能性。
- シャオとシャニーの真相。
- 王国軍が深淵に魅了されているという断定。

### Notes
- シャオの誤認は、喪失と姉への感情から出す。
- 「王国軍が怪しい」は出してよいが、真相の確定説明にはしない。

## Area: 風の集落 / 禁忌の森 / 風の神殿

### Story timing
- storyStep: 3
- required flags: `eliseJoinedAtWindVillage`, `windForestCleansed`, `windVillageCleared`
- party: エリーゼ加入後

### Adopted canon
- 風の集落は大人が消え、子どもだけが残った異常な場所。
- エリーゼは笑顔や踊りで不安を隠す人物として扱う。
- 禁忌の森は、かつて聖域だったがプリズム崩壊後に封じられた。

### Current implemented facts
- `wind_village_intro` でエリーゼ `106` が加入する。
- 祈りの広場で神獣を浄化し、風の神殿へ進む。
- 風楔のエリシア撃破後、風の集落が回復する。

### Unverified legacy lines
- エリーゼと神獣の説明は長文が多く、分割・口調レビュー対象。

### Hidden facts not to reveal here
- エリーゼの妹とクロードの罪悪感。
- リーシアの詳細な正体。

### Notes
- 集落NPCは「子どもの生活」と「大人が消えた空白」を中心にする。

## Area: 水上都市 / 海底神殿

### Story timing
- storyStep: 4
- required flags: `kateJoinedAtWaterCity`, `seabedTempleGateCleared`, `waterCityCleared`
- party: ケイト加入後

### Adopted canon
- 水上都市は王国兵の休息地にされ、活気を失っている。
- ソフィアは不審視されると宿や親族へ迷惑がかかるため、直接動けない。
- ケイトは実戦を通じて自分の意志を得る。

### Current implemented facts
- `water_city_intro` で暗黒兵士戦が発生する。
- `water_city_sophia` でケイト `104` が加入し、海底神殿へ進む。
- `water_temple_clear` で魔法の小舟 `108` を得て、船移動が可能になる。

### Unverified legacy lines
- ソフィア、ケイト、シーリスの会話は行長・説明量レビュー対象。

### Hidden facts not to reveal here
- ケイトの内面の核心的秘密。
- ソフィアとリーシアの詳細な因縁。

### Notes
- カジノ/メダル交換は、現行コードでは施設タイル導線として扱う。水上都市/雷の要塞の古い解放方針コメントは正本にしない。

## Area: 雷の要塞 / 大灯台

### Story timing
- storyStep: 5-6
- required flags: `josephJoinedAtThunderFort`, `thunderFortCleared`, `bigTowerCleared`
- party: ジョセフ加入後

### Adopted canon
- 雷の要塞は雷のプリズムで機械を動かす防衛拠点。
- ジョセフは元王国軍側の責任を背負う大人として参加する。
- レナードは単純な悪ではなく、国を守るために従っている。

### Current implemented facts
- `thunder_fort_entry` でジョセフ `101` が加入する。
- レナード戦後、ヴェルド戦の負けイベントへ進む。
- 大灯台でリリスを倒すと光の神殿の結界が消える。

### Unverified legacy lines
- ジョセフ、レナード、ヴェルド周辺は良い核があるが長文が多い。

### Hidden facts not to reveal here
- ジョセフとレオンの親子関係の明示。
- 王国儀式の全体構造。

### Notes
- ジョセフとレオンの伏線は沈黙・反応・他者の噂で薄く置く。

## Area: 光の神殿

### Story timing
- storyStep: 7
- required flags: `bigTowerCleared`, `lightPalaceCleared`
- party: レイラ加入前後

### Adopted canon
- 光の神殿は「光=善」ではなく、秩序・祝福・裁きの場所。
- リュシオンの加護は、光のプリズムを呼び戻す要素。
- レイラは光の宮殿後に同行する。
- レイラにとって、ヴェルドは幼い頃に拾い育てた後見人/養父。
- レオンはレイラの騎士としての正式な師。

### Current implemented facts
- `light_palace_final_encounter` でジャスパー、ヴェルドと戦う。
- 敗北または勝利ルートを経て `light_palace_clear` へ進む。
- レイラ `204` が加入し、魔王城へ向かう。

### Unverified legacy lines
- ジャスパー、ヴェルド、レイラの説明的会話はレビュー対象。

### Hidden facts not to reveal here
- リュシオンの全事情。
- ルーナ、レオン、クロードの深い背景。

### Notes
- 光は温かい救いと冷たい裁きの両面を持たせる。
- 光の宮殿でレイラを書く場合、ヴェルドへの家族としての想いを薄く足してよい。
- レオン関連は騎士道の継承、ヴェルド関連は家族との決着として分ける。

## Area: 魔王城 / 深淵の入口

### Story timing
- storyStep: 8-10
- required flags: `darkCastleCleared`, `prismBlessingsComplete`, `abyssOuterReached`
- party: シャニー加入後、深淵解放へ

### Adopted canon
- ゼノンは残酷で苛烈だが、闇のプリズムを守っていた。
- 魔王軍は単純な善玉ではなく、恐怖を背負う守護者として扱う。
- 深淵は六属性の理が割れた傷であり、混沌は第七属性ではない。
- 混沌は、六属性の調和に生まれた裂け目から滲む「属性ならざる歪み」。
- ジャスパーが混沌を「第七属性」と呼ぶ場合、それは誤った研究者分類。

### Current implemented facts
- 魔王城で三つの鍵を得てゼノン戦へ進む。
- `dark_castle_clear` でシャニー `306` が加入する。
- `abyss_unsealed` で深淵の魔窟が解放される。

### Unverified legacy lines
- ゼノン、シャニー、深淵入口の会話はネタバレ密度と行長のレビュー対象。

### Hidden facts not to reveal here
- 深淵中盤以降の真相。
- 深淵の王の完全な正体。

### Notes
- ゼノンは「実はいい人」ではなく「悪として憎まれる役を引き受けた王」として扱う。
- 深淵100階は達成感ある区切りにするが、深淵そのものは消さない。
- アゼルガラグ撃破後、地上へ漏れていた深淵化は鎮まり、世界は一度息を吹き返す。
- アゼルガラグは混沌の傷から生まれた影であり、元凶そのものではない。

## Latest canon notes

- 2026-06-29時点の深淵70階ヴェルド/レイラ、台詞の論理整合性、40字前後許容、余白/間の扱いは `12_ABYSS_AND_DIALOGUE_CANON_NOTES_20260629.md` を優先参照する。
- 特にヴェルド戦は、レイラの家族との決着であり、戦闘前は高潔な騎士として非道を止める場面、戦闘後は娘として父と別れる場面。
- ヴェルドの歪みは「弱者の敵を刈る苛烈さ」ではなく、「門外で泣く者を救済対象から外す選別思想」として描く。
- 深淵90階ジャスパー戦は「光属性の誤った価値観」を描く。ジャスパーは闇堕ちした神官ではなく、自分こそ光だと信じたまま深淵に利用された者。
- ジャスパーが混沌を第七属性と呼ぶ場合、それは誤った研究者分類であり、正本上は属性ではない。
- 深淵10〜100階のボス会話は最終盤の密度を許容し、短文連射よりも人間の呼吸・生活感・属性感を優先する。
- 敵台詞は「悪役っぽい」だけで採用しない。敵の主張と味方の反論が同じ論点で噛み合っていることを必ず確認する。
