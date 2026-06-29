# 07_DIALOGUE_REVIEW_QUEUE

既存会話の不審点・改善余地・採用待ちを管理する。

## Purpose

既存会話は、現在ゲームに入っている実装済み資料である。

しかし、既存会話を自動的に完成稿・正史とは扱わない。
同時に、Codexが勝手に直して実装へ反映してもいけない。

このファイルは、その中間のためにある。

- 気になる既存会話を記録する。
- 現行文を残す。
- 改善案を複数提示する。
- Codexの推奨を出す。
- ユーザー判断欄を空ける。
- 承認後だけ実装へ進める。

## Status values

| status | 意味 | 実装反映 |
|---|---|---|
| pending | ユーザー判断待ち | 不可 |
| approved_keep | 現行維持で承認 | 可 |
| approved_light | 軽微修正で承認 | 可 |
| approved_rewrite | 大幅修正で承認 | 可 |
| rejected | 不採用 | 不可 |
| later | 保留 | 不可 |
| implemented | 承認済み変更を反映済み | 済 |

## Review entry template

````md
## DR-000

Status: pending
Created:
Updated:

### Target
- file:
- script key / event ID:
- map / area:
- storyStep-subStep:
- required flags:
- speaker:

### Current implemented text
```text
話者：
「現行文」
```

### Concern
- 気になる点:
- なぜ問題か:
- 影響する設定:
- 影響する後続イベント:
- 30文字超過:
- ネタバレ危険:
- 口調混同:
- AIっぽさ:

### Option A: keep current
```text
話者：
「現行文」
```

#### Reason to keep
- 

#### Risk if kept
- 

### Option B: light revision
```text
話者：
「軽微修正文」
```

#### Revision intent
- 

#### Implementation impact
- none / text only / flags / event flow

### Option C: larger rewrite
```text
話者：
「大幅修正文」
```

#### Rewrite intent
- 

#### Implementation impact
- none / text only / flags / event flow / new event

### Codex recommendation
- recommended option:
- reason:
- confidence:

### User decision
- decision: undecided
- selected option:
- user notes:
- approved date:

### Implementation tracking
- implemented file:
- implemented script key:
- implemented date:
- validation:
````

## Entries

## DR-001-opening-lycion-long-line

Status: pending
Created: 2026-06-26
Updated: 2026-06-26

### Target
- file: `story.js`
- script key / event ID: 開幕リュシオン周辺
- map / area: 開幕
- storyStep-subStep: 0-x
- required flags: なし
- speaker: リュシオン

### Current implemented text
```text
リュシオン：
「私に残された最後の権能をもって、今一度、深淵を打ち倒す力を授けます…」
```

### Concern
- 気になる点: 1行が長く、開幕から情報密度が高い。
- なぜ問題か: プレイヤーが世界観を掴む前に、神・権能・深淵が一気に出る。
- 影響する設定: リュシオン、深淵、アルスの過去。
- 影響する後続イベント: 光の神殿、深淵解放。
- 30文字超過: yes
- ネタバレ危険: medium
- 口調混同: low
- AIっぽさ: medium

### Option A: keep current
```text
リュシオン：
「私に残された最後の権能をもって、今一度、深淵を打ち倒す力を授けます…」
```

#### Reason to keep
- 開幕から神話的スケールを出せる。

#### Risk if kept
- 説明語が重なり、印象がやや抽象的になる。

### Option B: light revision
```text
リュシオン：
「私に残る力を、あなたへ。」
「もう一度だけ、深淵に抗うために。」
```

#### Revision intent
- 意味を保ちつつ、表示行を短くする。

#### Implementation impact
- text only

### Option C: larger rewrite
```text
リュシオン：
「……まだ、届く。」
「アルス。私の最後の光を持って。」
「深淵に、呑まれないで。」
```

#### Rewrite intent
- 神話説明より、祈りと切迫感を優先する。

#### Implementation impact
- text only

### Codex recommendation
- recommended option: Option B
- reason: 現行の意味を壊さず、開幕の読みやすさを改善できる。
- confidence: medium

### User decision
- decision: undecided
- selected option:
- user notes:
- approved date:

### Implementation tracking
- implemented file:
- implemented script key:
- implemented date:
- validation:

## DR-002-start-village-elder-request

Status: pending
Created: 2026-06-26
Updated: 2026-06-26

### Target
- file: `story.js`
- script key / event ID: 始まりの村の依頼
- map / area: 始まりの村
- storyStep-subStep: 1-x
- required flags: なし
- speaker: 村長

### Current implemented text
```text
村長：
「村の若い衆で塞ごうとしたんですが、奥に巨大な化け物がいてどうにも手が出せず…」
「勝手なお願いとは思うのですが、どうか、化け物を討伐してくれないじゃろうか。」
```

### Concern
- 気になる点: 依頼説明が長く、村長の口調も少し揺れている。
- なぜ問題か: 序盤の依頼は短く、生活被害が見える方が強い。
- 影響する設定: 始まりの村、ガイル・サラ加入。
- 影響する後続イベント: 始まりの洞窟。
- 30文字超過: yes
- ネタバレ危険: low
- 口調混同: medium
- AIっぽさ: medium

### Option A: keep current
```text
村長：
「村の若い衆で塞ごうとしたんですが、奥に巨大な化け物がいてどうにも手が出せず…」
「勝手なお願いとは思うのですが、どうか、化け物を討伐してくれないじゃろうか。」
```

#### Reason to keep
- 状況説明としては分かりやすい。

#### Risk if kept
- 会話が依頼文らしく整いすぎ、村の生活感が薄い。

### Option B: light revision
```text
村長：
「若い衆で塞ごうとした。」
「だが奥に、でかい影がおってな。」
「頼める立場ではないが……」
「どうか、見てきてくれんか。」
```

#### Revision intent
- 情報を分割し、村長の年配口調へ寄せる。

#### Implementation impact
- text only

### Option C: larger rewrite
```text
村長：
「北東の畑が、もう使えん。」
「穴から魔物が出て、柵も壊された。」
「若い衆も戻ってこん。」
「旅の方。頼めんじゃろうか。」
```

#### Rewrite intent
- 抽象的な「大穴」より、畑・柵・若者という生活被害で見せる。

#### Implementation impact
- text only

### Codex recommendation
- recommended option: Option C
- reason: 序盤NPCを攻略看板にせず、村の被害として伝えられる。
- confidence: medium

### User decision
- decision: undecided
- selected option:
- user notes:
- approved date:

### Implementation tracking
- implemented file:
- implemented script key:
- implemented date:
- validation:

## DR-003-fire-elder-report-exposition

Status: pending
Created: 2026-06-26
Updated: 2026-06-26

### Target
- file: `story.js`
- script key / event ID: `fire_village_report`
- map / area: 炎の里
- storyStep-subStep: 2-4
- required flags: `firePrismRestored`
- speaker: 里の長

### Current implemented text
```text
里の長：
「礼を言う、旅の者よ。王国軍がプリズムに手をかけていたとは、信じたくない話だが……目を逸らしてはならんな。」
「北の風の集落へ向かうがよい。あの地の風は、世界の流れに敏い。道を示してくれるはずだ。」
```

### Concern
- 気になる点: 1行が非常に長く、次目的地説明も神託めいている。
- なぜ問題か: 炎の里の長なら、まず炉・鍛冶・里の損害から語る方が土地に根ざす。
- 影響する設定: 王国軍への疑い、風の集落導線。
- 影響する後続イベント: 風の集落。
- 30文字超過: yes
- ネタバレ危険: low
- 口調混同: medium
- AIっぽさ: high

### Option A: keep current
```text
里の長：
「礼を言う、旅の者よ。王国軍がプリズムに手をかけていたとは、信じたくない話だが……目を逸らしてはならんな。」
```

#### Reason to keep
- 王国軍への違和感と次目的地が明確。

#### Risk if kept
- 里長の口から作者説明が出ている印象がある。

### Option B: light revision
```text
里の長：
「礼を言う。炉が息を吹き返した。」
「王国軍の話は……重いな。」
「だが、目を逸らすわけにもいかぬ。」
```

#### Revision intent
- 現行の意味を保ち、火の里らしい具体物を入れる。

#### Implementation impact
- text only

### Option C: larger rewrite
```text
里の長：
「聞こえるか。槌の音が戻った。」
「これで、冬までに鍋も直せる。」
「……王国軍の件は、胸に置く。」
「北へ行け。風の集落なら、道を知る。」
```

#### Rewrite intent
- 鍛冶と生活の回復を中心にしてから、次目的地へつなぐ。

#### Implementation impact
- text only

### Codex recommendation
- recommended option: Option C
- reason: 火の里の生活感が増え、次目的地説明も自然になる。
- confidence: medium

### User decision
- decision: undecided
- selected option:
- user notes:
- approved date:

### Implementation tracking
- implemented file:
- implemented script key:
- implemented date:
- validation:

## DR-004-sophia-kate-long-line

Status: pending
Created: 2026-06-26
Updated: 2026-06-26

### Target
- file: `story.js`
- script key / event ID: 水上都市クリア周辺
- map / area: 水上都市
- storyStep-subStep: 4-x
- required flags: `waterCityCleared`
- speaker: ソフィア / ケイト

### Current implemented text
```text
ソフィア：
「プリズムを狙う連中の言葉、こちらでも洗っておく。[N:104]は連れていきな。あの子に足りなかったのは、机の上じゃなく実戦だ。」

ケイト：
「怖くないと言えば嘘になります。でも、足手まといのままでは終わりたくありません。どうか、同行させてください。」
```

### Concern
- 気になる点: どちらも長く、師弟の距離感は良いが説明が一息に出ている。
- なぜ問題か: ソフィアはもっと余白と含みで魅せられる。ケイトは震えながら短く決意する方が合う。
- 影響する設定: ケイトの成長、ソフィアの立場。
- 影響する後続イベント: 海底神殿後、ケイト正式同行。
- 30文字超過: yes
- ネタバレ危険: low
- 口調混同: low
- AIっぽさ: medium

### Option A: keep current
```text
ソフィア：
「プリズムを狙う連中の言葉、こちらでも洗っておく。[N:104]は連れていきな。あの子に足りなかったのは、机の上じゃなく実戦だ。」
```

#### Reason to keep
- ソフィアの師匠らしい評価が出ている。

#### Risk if kept
- 行が長く、ゲーム内テンポが重い。

### Option B: light revision
```text
ソフィア：
「連中の言葉は、こっちで洗う。」
「[N:104]は連れていきな。」
「あの子に足りないのは、実戦さ。」

ケイト：
「怖くない、と言えば嘘です。」
「でも、足手まといでは終われません。」
「どうか、同行させてください。」
```

#### Revision intent
- 現行意味を保ったまま分割する。

#### Implementation impact
- text only

### Option C: larger rewrite
```text
ソフィア：
「机の上じゃ、潮の匂いは読めない。」
「行きな、[N:104]。」
「怖いなら、なおさら見ておいで。」

ケイト：
「……足は震えています。」
「でも、ここで待つ方が怖いです。」
「僕も行きます。」
```

#### Rewrite intent
- 水上都市らしい比喩と、ケイトの弱さからの決意を出す。

#### Implementation impact
- text only

### Codex recommendation
- recommended option: Option C
- reason: キャラの声が分かれ、水上都市の土地感も出る。
- confidence: medium

### User decision
- decision: undecided
- selected option:
- user notes:
- approved date:

### Implementation tracking
- implemented file:
- implemented script key:
- implemented date:
- validation:

## DR-005-veld-sacrifice-speech

Status: pending
Created: 2026-06-26
Updated: 2026-06-26

### Target
- file: `story.js`
- script key / event ID: `thunder_fort_clear` / ヴェルド戦
- map / area: 雷の要塞
- storyStep-subStep: 5-x
- required flags: `thunderFortCleared` 前
- speaker: ヴェルド

### Current implemented text
```text
ヴェルド：
「お前達は救世の障害だ。大いなる祝福には犠牲が伴い、犠牲無しに世界を変えることなどできない。」
「お前達は世界を救っている気になっているようだが、ゆるやかな死に向かっているだけよ。」
```

### Concern
- 気になる点: テーマは良いが、説明がかなり直接的。
- なぜ問題か: ヴェルドの恐ろしさは、思想説明より裁きの短さで出せる。
- 影響する設定: 王国軍、祝福、犠牲、光の神殿。
- 影響する後続イベント: 光の神殿。
- 30文字超過: yes
- ネタバレ危険: medium
- 口調混同: low
- AIっぽさ: medium

### Option A: keep current
```text
ヴェルド：
「お前達は救世の障害だ。大いなる祝福には犠牲が伴い、犠牲無しに世界を変えることなどできない。」
```

#### Reason to keep
- 敵思想が分かりやすい。

#### Risk if kept
- 伏線ではなく説明になりやすい。

### Option B: light revision
```text
ヴェルド：
「お前達は、救世の障害だ。」
「大いなる祝福には、犠牲が伴う。」
「犠牲を恐れて、世界は変えられぬ。」
```

#### Revision intent
- 現行思想を保ち、表示単位を短くする。

#### Implementation impact
- text only

### Option C: larger rewrite
```text
ヴェルド：
「退け。」
「祈りの列に、迷いは要らぬ。」
「犠牲を数える者に、救済は成せん。」
```

#### Rewrite intent
- 神官的・騎士的な冷たさを強め、真相説明を抑える。

#### Implementation impact
- text only

### Codex recommendation
- recommended option: Option B
- reason: 現行プロット指定に近く、実装時の意味変化が少ない。
- confidence: high

### User decision
- decision: undecided
- selected option:
- user notes:
- approved date:

### Implementation tracking
- implemented file:
- implemented script key:
- implemented date:
- validation:

## DR-006-zenon-chaos-exposition

Status: pending
Created: 2026-06-26
Updated: 2026-06-26

### Target
- file: `story.js`
- script key / event ID: `dark_castle_clear`
- map / area: 魔王城
- storyStep-subStep: 8-x
- required flags: `lightPalaceCleared`
- speaker: ゼノン

### Current implemented text
```text
ゼノン：
「六つのプリズムが応えた今、世界の中心に開いた亀裂へ進める。だが、混沌は力だけで越えられる場所ではない。」
「混沌への案内は、こいつに任せる。ひよっこ達が混沌に魅入られないように、助けてやれ。」
```

### Concern
- 気になる点: 重要な真相と次目的地が一息に説明される。
- なぜ問題か: ゼノンは言い訳しない王なので、説明しすぎると威厳が薄まる。
- 影響する設定: 闇のプリズム、混沌、シャニー加入。
- 影響する後続イベント: 深淵解放。
- 30文字超過: yes
- ネタバレ危険: medium
- 口調混同: medium
- AIっぽさ: medium

### Option A: keep current
```text
ゼノン：
「六つのプリズムが応えた今、世界の中心に開いた亀裂へ進める。だが、混沌は力だけで越えられる場所ではない。」
```

#### Reason to keep
- 次目的地と危険が明確。

#### Risk if kept
- 魔王が案内役になりすぎる。

### Option B: light revision
```text
ゼノン：
「六つのプリズムが応えた。」
「ならば、中心の亀裂も開く。」
「だが混沌は、力だけでは越えられぬ。」
```

#### Revision intent
- 意味を保ちつつ、ゼノンの語りを短くする。

#### Implementation impact
- text only

### Option C: larger rewrite
```text
ゼノン：
「中心の亀裂へ行け。」
「六つの光を持つ今なら、門は開く。」
「だが忘れるな。」
「混沌は、勝者から先に喰う。」
```

#### Rewrite intent
- 案内を短くし、混沌の怖さをゼノンらしい警告にする。

#### Implementation impact
- text only

### Codex recommendation
- recommended option: Option C
- reason: ゼノンを善良な説明者にせず、危険な王のまま次へ送れる。
- confidence: medium

### User decision
- decision: undecided
- selected option:
- user notes:
- approved date:

### Implementation tracking
- implemented file:
- implemented script key:
- implemented date:
- validation:
