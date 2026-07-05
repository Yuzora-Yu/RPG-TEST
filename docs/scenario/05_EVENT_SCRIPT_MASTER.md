# 05_EVENT_SCRIPT_MASTER

各町・各ダンジョン・各イベントの台本正本候補。

## Important status policy

このファイルには、以下を混ぜてよいが、必ず状態を明示する。

- `implemented_legacy`: 既に `story.js` 等にある現行文。未レビューの可能性あり。
- `draft`: Codex草稿。未承認。
- `review_pending`: ユーザー判断待ち。
- `approved`: ユーザー承認済み。正本化可。
- `implemented`: JS等へ反映済み。

既存会話をここに転記する場合、勝手に `approved` にしない。
現行文は `implemented_legacy` として扱い、品質面で気になる場合は `07_DIALOGUE_REVIEW_QUEUE.md` に送る。

## Event script template

````md
## EVENT-AREA-000: イベント名

Status: draft / implemented_legacy / review_pending / approved / implemented
Source:
- file:
- script key:
- map event:

### Area

### Story timing
- storyStep:
- subStep:
- required flags:
- forbidden flags:
- party assumptions:

### Known facts at this point
- 

### Hidden facts not to reveal
- 

### Scene purpose
- gameplay:
- emotion:
- worldbuilding:
- foreshadowing:

### Current implemented text, if any
```text
話者：
「現行文」
```

### Proposed script
```text
話者：
「30文字程度の行」
「同じ話者の続き」

別の話者：
「別の口調」
```

### Conditional variants

#### If flag: xxx
```text
```

#### If party includes: xxx
```text
```

#### After clear
```text
```

### NPC life additions
- `04_NPC_LIFE_DIALOGUE_BANK.md` の該当ID:

### Foreshadowing ledger links
- `03_FORESHADOWING_LEDGER.md` の該当ID:

### Dialogue review queue links
- `07_DIALOGUE_REVIEW_QUEUE.md` の該当ID:

### Implementation notes
- story.js script key:
- map.js event:
- maps_logic.js condition:
- storyStep/subStep change:
- flags to set:
- flags to check:
````

## Main route sections

### 始まりの村

## EVENT-START-001: 開幕戦闘と始まりの村救援

Status: implemented_legacy
Source:
- file: `story.js`
- script key: `game_start` 周辺
- map event: 始まりの村進行

### Area
始まりの村

### Story timing
- storyStep: 0-1
- party assumptions: アルス単独からガイル・サラ加入

### Known facts at this point
- アルスは深淵と因縁を持つ旅人。
- 始まりの村はアルスの故郷ではない。

### Hidden facts not to reveal
- 深淵の王の正体。
- 王国軍と混沌の関係。

### Scene purpose
- gameplay: 初戦闘、序盤加入、始まりの洞窟誘導。
- emotion: 復讐者が他者を守る旅へ踏み出す。
- worldbuilding: 村の危機と深淵の脅威を示す。

### Dialogue review queue links
- `DR-001-opening-lycion-long-line`
- `DR-002-start-village-elder-request`

### 炎の里

## EVENT-FIRE-001: 火の里相談

Status: implemented_legacy
Source:
- file: `story.js`
- script key: `fire_village_consult`
- map event: 火の里の長

### Area
炎の里

### Story timing
- storyStep: 2
- required flags: なし
- forbidden flags: `fireVillageConsulted`
- party assumptions: ガイル、サラ加入済み

### Known facts at this point
- 火のプリズム異変で鍛冶が止まっている。
- 王国軍への違和感は噂レベル。

### Hidden facts not to reveal
- 王国軍が深淵に魅了されているという断定。
- シャオとシャニーの真相。

### Scene purpose
- gameplay: イグナ火山への導線。
- emotion: 里の生活危機を出す。
- worldbuilding: 鍛冶、炉、武器流通を示す。

### Dialogue review queue links
- `DR-003-fire-elder-report-exposition`

### イグナ火山

## EVENT-FIRE-002: 王国兵戦からグラド戦

Status: implemented_legacy
Source:
- file: `story.js`
- script key: `fire_volcano_soldiers_encounter`, `fire_volcano_grad_encounter`
- map event: `IGNIS_VOLCANO` ボスマス

### Area
イグナ火山

### Story timing
- storyStep: 2
- required flags: `shaoJoinedAtVolcano`

### Known facts at this point
- 火のプリズムの光が弱っている。
- 王国軍らしき兵士が火山奥にいる。

### Hidden facts not to reveal
- 王国儀式全体の目的。
- 魔王軍が守る側だった可能性。

### Scene purpose
- gameplay: 連戦、火のプリズム復旧。
- emotion: シャオの怒りと疑念を立ち上げる。
- foreshadowing: 王国側の言葉に「国の未来」を混ぜる。

### 北の風の集落

## EVENT-WIND-001: 子どもだけの集落

Status: implemented_legacy
Source:
- file: `story.js`
- script key: `wind_village_intro`
- map event: 風の集落

### Area
北の風の集落

### Story timing
- storyStep: 3
- party assumptions: エリーゼ加入

### Known facts at this point
- 大人が消え、子どもだけが残っている。
- 森が異変の中心に見える。

### Hidden facts not to reveal
- エリーゼの妹とクロードの詳細。
- リーシアの正体。

### Scene purpose
- gameplay: 禁忌の森への導線。
- emotion: 子どもだけの不安、エリーゼの仮面。
- worldbuilding: 風の集落の日常の欠落。

### 禁忌の森・風の神殿

## EVENT-WIND-002: 神獣浄化と風楔のエリシア

Status: implemented_legacy
Source:
- file: `story.js`
- script key: `wind_forest_guardians_encounter`, `wind_temple_elicia_encounter`
- map event: `FORBIDDEN_FOREST`, `WIND_TEMPLE` ボスマス

### Area
禁忌の森・風の神殿

### Story timing
- storyStep: 3
- required flags: `windForestEntryIntroduced`

### Known facts at this point
- 森の神獣が呪いに縛られている。
- 大人たちは風の祭壇側へ向かった。

### Hidden facts not to reveal
- 王国儀式の完成形。
- 深淵と混沌の全体構造。

### Scene purpose
- gameplay: 金鍵取得、風のプリズム復旧。
- emotion: エリーゼの恐怖と決意。
- foreshadowing: 「儀式は止まらない」を軽く置く。

### 水上都市

## EVENT-WATER-001: 水上都市の封鎖とソフィア依頼

Status: implemented_legacy
Source:
- file: `story.js`
- script key: `water_city_intro`, `water_city_sophia`
- map event: 水上都市

### Area
水上都市

### Story timing
- storyStep: 4
- party assumptions: ケイト加入

### Known facts at this point
- 街は王国兵の休息地にされている。
- ソフィアは直接動けず、ケイトを同行させる。

### Hidden facts not to reveal
- ケイトの核心的秘密。
- ソフィアとリーシアの深い因縁。

### Scene purpose
- gameplay: ケイト加入、海底神殿への導線。
- emotion: ケイトの不安と初めての意志。
- worldbuilding: 水路、宿、兵士の占拠。

### Dialogue review queue links
- `DR-004-sophia-kate-long-line`

### クレナ鍾乳洞・海底神殿

## EVENT-WATER-002: 海底神殿と氷楔のシーリス

Status: implemented_legacy
Source:
- file: `story.js`
- script key: `sea_temple_gate_encounter`, `water_temple_syris_encounter`, `water_temple_clear`
- map event: `SEABED_TEMPLE` ボスマス

### Area
海底神殿

### Story timing
- storyStep: 4
- required flags: `kateJoinedAtWaterCity`

### Known facts at this point
- 水のプリズムが凍り、水流が乱れている。
- 王国兵が神殿内で鍵を管理している。

### Hidden facts not to reveal
- 王国儀式全体の到達点。

### Scene purpose
- gameplay: 鍵扉、氷床、船入手。
- emotion: ケイトが実戦を通じて前へ出る。
- foreshadowing: 水の力が「刃」に変えられる違和感。

### 雷の要塞

## EVENT-THUNDER-001: ジョセフ加入とレナード戦

Status: implemented_legacy
Source:
- file: `story.js`
- script key: `thunder_fort_entry`, `thunder_leonard_encounter`, `thunder_fort_clear`
- map event: `THUNDER_FORT` ボスマス

### Area
雷の要塞

### Story timing
- storyStep: 5
- party assumptions: ジョセフ加入

### Known facts at this point
- 雷の要塞の機械が暴走している。
- レナードは国を守るために剣を抜く。

### Hidden facts not to reveal
- ジョセフとレオンの親子関係。
- 光の神殿儀式の全貌。

### Scene purpose
- gameplay: 中ボス鍵、負けイベント、大灯台導線。
- emotion: 責任を背負う大人同士の衝突。
- foreshadowing: ジョセフの沈黙、レナードの言いかけ。

### Dialogue review queue links
- `DR-005-veld-sacrifice-speech`

### 光の神殿

## EVENT-LIGHT-001: 光の神殿最終戦

Status: implemented_legacy
Source:
- file: `story.js`
- script key: `light_palace_final_encounter`, `light_palace_clear`
- map event: `LIGHT_PALACE` ボスマス

### Area
光の神殿

### Story timing
- storyStep: 7
- required flags: `bigTowerCleared`

### Known facts at this point
- 大灯台の結界が消え、神殿奥へ進める。
- 光のプリズムが黒く濁っている。

### Hidden facts not to reveal
- リュシオンの全事情。
- 光の神側の完全な真相。

### Scene purpose
- gameplay: 強敵戦、加護による再戦、レイラ加入。
- emotion: 光の恐ろしさと救いの両面。
- foreshadowing: 光=善ではない。

### 魔王城

## EVENT-DARK-001: 魔王ゼノン戦

Status: implemented_legacy
Source:
- file: `story.js`
- script key: `dark_castle_zenon_encounter`, `dark_castle_clear`
- map event: `DARK_CASTLE` ボスマス

### Area
魔王城

### Story timing
- storyStep: 8
- required flags: `lightPalaceCleared`

### Known facts at this point
- 闇のプリズムは魔王城にある。
- 魔王軍は恐れられている。

### Hidden facts not to reveal
- 深淵の王の完全な正体。

### Scene purpose
- gameplay: 闇のプリズム確認、シャニー加入、深淵導線。
- emotion: 敵だと思ってきた相手の意味が反転する。
- foreshadowing: ゼノンは善人ではなく、約束を破らない王。

### Dialogue review queue links
- `DR-006-zenon-chaos-exposition`

### 深淵

## EVENT-ABYSS-001: 深淵解放

Status: implemented_legacy
Source:
- file: `story.js`
- script key: `abyss_unsealed`
- map event: `ABYSS_FIELD`

### Area
深淵の入口

### Story timing
- storyStep: 9-10
- required flags: `prismBlessingsComplete`

### Known facts at this point
- 六属性の加護により、世界中央の亀裂へ進める。
- 混沌は力だけで越えられない。

### Hidden facts not to reveal
- 深淵中盤以降の核心。

### Scene purpose
- gameplay: Abyss解放。
- emotion: 命じられた旅から、自分たちで選ぶ旅へ。
- worldbuilding: 六属性の理が割れた傷として深淵を扱う。
