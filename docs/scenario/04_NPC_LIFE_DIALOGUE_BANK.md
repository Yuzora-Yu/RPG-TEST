# 04_NPC_LIFE_DIALOGUE_BANK

村人・商人・兵士・子どもなど、生活感のあるNPC会話を貯める場所。

## Purpose

NPCを攻略情報の看板にしない。
NPCは、その世界で暮らしている。

## NPC dialogue ratio

1つの町や拠点における目安:

- 生活会話: 50%以上
- 地域の噂: 20%程度
- 直接ヒント: 10〜20%程度
- 伏線・違和感: 少量
- ギャグ・雑談・無駄話: 少量

## NPC entry template

````md
## NPC-AREA-000

Status: draft / approved / implemented
Area:
Story timing:
Required flags:
NPC role:
Speaker name:

### Life base
- 仕事:
- 家族:
- 今日の困りごと:
- 信じている噂:
- 間違っていること:
- 欲しいもの:

### Dialogue: first visit
```text
村人：
「」
```

### Dialogue: after event
```text
村人：
「」
```

### Dialogue: after clear
```text
村人：
「」
```

### Function
- life / hint / rumor / foreshadowing / flavor / misdirection

### Notes
- 
````

## Area bank: 始まりの村

## NPC-START-001

Status: draft
Area: 始まりの村
Story timing: storyStep 0-1
Required flags: なし
NPC role: 畑番
Speaker name: 村人

### Life base
- 仕事: 北東の畑の見回り
- 家族: 息子が穴を塞ぎに行った
- 今日の困りごと: 柵が壊され、作物が踏まれた
- 信じている噂: 穴の奥から鐘のような音がする
- 間違っていること: 魔王軍の穴だと思っている
- 欲しいもの: 戻ってこない若者の安否

### Dialogue: first visit
```text
村人：
「北東の柵が、また壊された。」
「畑より、息子が心配でな。」
```

### Dialogue: after clear
```text
村人：
「土を戻せば、畑は生き返る。」
「人も、そうだといいんだが。」
```

### Function
- life / rumor / emotional_misread

### Notes
- アルスの故郷喪失には触れない。

## Area bank: 炎の里

## NPC-FIRE-001

Status: draft
Area: 炎の里
Story timing: storyStep 2
Required flags: なし
NPC role: 鍛冶場の釘打ち職人
Speaker name: 鍛冶職人

### Life base
- 仕事: 鍋、農具、釘の修理
- 家族: 弟子が火山道へ行ったまま
- 今日の困りごと: 炉が弱く、釘すら曲がる
- 信じている噂: 王国軍の視察後から火が細った
- 間違っていること: 魔王軍が炉に呪いをかけたと思っている
- 欲しいもの: 普通に鉄を焼ける火

### Dialogue: first visit
```text
鍛冶職人：
「剣どころか、鍋の底も直せん。」
「火が弱いと、飯まで不味くなる。」
```

### Dialogue: after clear
```text
鍛冶職人：
「聞け、この音。」
「鉄が、ちゃんと返事をしてる。」
```

### Function
- life / rumor / foreshadowing

### Notes
- 王国軍疑惑は噂に留める。

## Area bank: 北の風の集落

## NPC-WIND-001

Status: draft
Area: 北の風の集落
Story timing: storyStep 3
Required flags: なし
NPC role: 留守番の子ども
Speaker name: 子ども

### Life base
- 仕事: 小さな弟妹の世話
- 家族: 母が森へ消えた
- 今日の困りごと: 洗濯物が同じ向きに揺れない
- 信じている噂: 森が夜に歩く
- 間違っていること: 大人は森に隠れて遊んでいると思いたい
- 欲しいもの: 大人が帰ってくる音

### Dialogue: first visit
```text
子ども：
「昨日のスープ、まだ残ってる。」
「母さん、温め直すって言ったのに。」
```

### Dialogue: after clear
```text
子ども：
「風がまっすぐ吹いてる。」
「今日は洗濯物、飛ばされないね。」
```

### Function
- life / emotional_detail

### Notes
- 大人失踪の怖さを生活物で見せる。

## Area bank: 水上都市

## NPC-WATER-001

Status: draft
Area: 水上都市
Story timing: storyStep 4
Required flags: なし
NPC role: 宿の下働き
Speaker name: 宿の若者

### Life base
- 仕事: 宿の皿洗いと兵士の部屋掃除
- 家族: 船大工の父が仕事を失っている
- 今日の困りごと: 兵士が濡れた鎧で床を汚す
- 信じている噂: 神殿の水音が止まると街の運も止まる
- 間違っていること: ソフィアをただの面倒な客だと思っている
- 欲しいもの: 兵士が宿から出ていく日

### Dialogue: first visit
```text
宿の若者：
「黒い鎧って、乾かないんですかね。」
「床板が毎日、潮で白くなるんです。」
```

### Dialogue: after clear
```text
宿の若者：
「今朝、床が乾いてました。」
「それだけで、泣きそうになって。」
```

### Function
- life / local_detail

### Notes
- 兵士支配を生活の不便として見せる。

## Area bank: 雷の要塞

## NPC-THUNDER-001

Status: draft
Area: 雷の要塞
Story timing: storyStep 5
Required flags: `hasShip` または `waterCityCleared`
NPC role: 補給兵
Speaker name: 要塞兵

### Life base
- 仕事: 雷導線と食料箱の確認
- 家族: 川向こうに妹がいる
- 今日の困りごと: 機械が号令より先に動く
- 信じている噂: プリズムが怒ると鉄が人を噛む
- 間違っていること: レナードなら必ず止められると思っている
- 欲しいもの: 普通に門番へ戻ること

### Dialogue: first visit
```text
要塞兵：
「機械が、返事をしなくなった。」
「命令より先に、歯車が吠える。」
```

### Dialogue: after clear
```text
要塞兵：
「静かな鉄って、ありがたいな。」
「妹に手紙を書く気になったよ。」
```

### Function
- life / hint / foreshadowing

### Notes
- レナードへの信頼を、後の衝突の下地にする。

## Area bank: 光の神殿周辺

## NPC-LIGHT-001

Status: draft
Area: 光の神殿周辺
Story timing: storyStep 7
Required flags: `bigTowerCleared`
NPC role: 巫女見習い
Speaker name: 巫女

### Life base
- 仕事: 灯明の油を替える
- 家族: 神殿勤めの姉がいる
- 今日の困りごと: 灯明が白すぎて目が痛む
- 信じている噂: 光が強いほど祝福も強い
- 間違っていること: 痛みも祝福だと思おうとしている
- 欲しいもの: 眠れる夜

### Dialogue: first visit
```text
巫女：
「灯りが白すぎるんです。」
「祝福なら、痛くないはずなのに。」
```

### Dialogue: after clear
```text
巫女：
「今の灯りは、少し黄色い。」
「人の家みたいで、ほっとします。」
```

### Function
- life / foreshadowing / local_rumor

### Notes
- 光=善ではない違和感を薄く出す。

## Area bank: 魔王城

## NPC-DARK-001

Status: draft
Area: 魔王城
Story timing: storyStep 8
Required flags: `lightPalaceCleared`
NPC role: 魔族の門番
Speaker name: 魔族

### Life base
- 仕事: 城門と闇のプリズム側廊の見張り
- 家族: 地下区画に子どもがいる
- 今日の困りごと: 人間の侵入者が増えた
- 信じている噂: 人間は光を掲げるほど約束を破る
- 間違っていること: 主人公たちも王国軍と同じだと思っている
- 欲しいもの: 約束が破られない夜

### Dialogue: first visit
```text
魔族：
「我らが王は残酷だ。」
「だが、約束だけは破らぬ。」
```

### Dialogue: after clear
```text
魔族：
「王が負けた夜も、門は閉じる。」
「子どもを眠らせねばならん。」
```

### Function
- life / foreshadowing / misdirection

### Notes
- ゼノン善人化ではなく、怖さと責務を両立する。

## Area bank: 深淵

## NPC-ABYSS-001

Status: draft
Area: 深淵の入口
Story timing: storyStep 9-10
Required flags: `prismBlessingsComplete`
NPC role: なし。環境テキスト候補
Speaker name: システム

### Life base
- 仕事: 該当なし
- 家族: 該当なし
- 今日の困りごと: 世界中央の亀裂が六属性に反応する
- 信じている噂: 該当なし
- 間違っていること: 該当なし
- 欲しいもの: 該当なし

### Dialogue: first visit
```text
システム：
「黒い亀裂が、息をしている。」
「六つの光が、足元で震えた。」
```

### Function
- flavor / visual_motif

### Notes
- 深淵の説明を環境描写に留める。
