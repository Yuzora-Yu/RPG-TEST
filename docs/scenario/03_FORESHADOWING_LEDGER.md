# 03_FORESHADOWING_LEDGER

伏線・ミスリード・後半回収の台帳。

## Policy

伏線は多ければよいわけではない。
このゲームでは、後から振り返って気づく程度を基本とする。

- 露骨な予言は禁止。
- 同じ伏線の繰り返しすぎは禁止。
- 古文書による答え合わせは禁止。
- キャラの感情による誤認は歓迎。
- ミスリードは、後で納得できる理由を持たせる。

## Clue types

| type | 意味 |
|---|---|
| true_clue | 後で真相につながる本物の伏線 |
| false_clue | その時点では筋が通るが、後で違うと分かるもの |
| emotional_misread | キャラの感情による誤解 |
| local_rumor | 土地の噂・伝承・偏見 |
| damaged_record | 欠けた記録・碑文・書物 |
| visual_motif | 台詞ではなく演出上の違和感 |

## Ledger template

```md
## FL-000

Status: draft / approved / implemented / retired
Type: true_clue / false_clue / emotional_misread / local_rumor / damaged_record / visual_motif

### Location
- area:
- scene:
- storyStep-subStep:
- required flags:

### Surface meaning now
プレイヤーが初見で受け取る意味。

### Hidden meaning later
後で分かる本当の意味。

### Text or staging
実際に置く台詞・石碑・演出。

### Speaker or object
誰が言うか、何が示すか。

### Reveal timing
いつ意味が反転・回収されるか。

### Risk check
- 露骨すぎないか:
- 多すぎないか:
- キャラが知りすぎていないか:
- 他の伏線と重複していないか:
```

## Example direction: Demon army misread

```md
## FL-example-xiao-demon-army

Status: draft
Type: emotional_misread

### Location
- area: 炎の里〜イグナ火山
- scene: 王国兵の足跡、魔族の噂、火のプリズム異変
- storyStep-subStep: 2-x

### Surface meaning now
魔王軍が火山の異変に関わっているように見える。
シャオもその可能性に強く引っ張られる。

### Hidden meaning later
実際には、王国軍側の行動や深淵の影響が重要であり、魔王軍は別目的でプリズムを守ろうとしていた可能性が見えてくる。

### Text or staging
- 王国兵の足跡があるが、村人は魔族の仕業だと噂する。
- 魔族らしき影は見えるが、プリズムには触れていない。
- シャオは「またあいつらか」と言うが、根拠は薄い。

### Risk check
- 真相を言わない。
- シャオを愚かにしない。
- 魔王軍善玉説を序盤で言わない。
```

## FL-001-xiao-shanny-misread

Status: draft
Type: emotional_misread

### Location
- area: 炎の里〜魔王城
- scene: シャオの魔王軍・シャニーへの反応
- storyStep-subStep: 2-x から 8-x
- required flags: `shaoJoinedAtVolcano`

### Surface meaning now
シャオは魔王軍やシャニーを、里を傷つける裏切り者として見ている。

### Hidden meaning later
シャニーは妹や故郷を守るため、ゼノンと契約して裏切り者として消えた可能性がある。

### Text or staging
- 炎の里で、シャオが魔王軍の噂に過敏に反応する。
- 魔王城でシャニーの名前が出た時、怒りより先に一瞬だけ言葉が詰まる。

### Speaker or object
シャオ、炎の里の老人、魔王城側の魔族

### Reveal timing
魔王城終盤、またはシャニー加入後の個別会話。

### Risk check
- 露骨すぎないか: 「姉妹」と序盤で断定しない。
- 多すぎないか: 炎の里では1〜2箇所まで。
- キャラが知りすぎていないか: 村人は噂以上を知らない。
- 他の伏線と重複していないか: 魔王軍善玉化とは分ける。

## FL-002-joseph-leon-silence

Status: draft
Type: true_clue

### Location
- area: 雷の要塞〜光の神殿
- scene: ジョセフが白銀騎士・レオンの名に反応する
- storyStep-subStep: 5-x から 7-x
- required flags: `josephJoinedAtThunderFort`

### Surface meaning now
ジョセフが王国軍時代に何かを失ったように見える。

### Hidden meaning later
ジョセフはレオンの父であり、父と名乗る資格を失ったと思っている。

### Text or staging
- 「白銀の騎士」の名を聞いた時だけ、ジョセフが黙る。
- バロンやシルビアは事情を知っているが、本人が言うまで触れない。

### Speaker or object
ジョセフ、バロン、シルビア、光の宮殿NPC

### Reveal timing
光の宮殿終盤、または魔王城前の重い会話。

### Risk check
- 露骨すぎないか: 「父」「息子」は伏せる。
- 多すぎないか: 雷の要塞では沈黙1回で足りる。
- キャラが知りすぎていないか: 一般NPCは「似ている」程度。
- 他の伏線と重複していないか: ジョセフの責任テーマと接続する。

## FL-003-kingdom-salvation-language

Status: draft
Type: false_clue

### Location
- area: 火の里〜光の神殿
- scene: 王国兵・神官が「国の未来」「祝福」を語る
- storyStep-subStep: 2-x から 7-x
- required flags: なし

### Surface meaning now
王国軍は危険な手段を使ってでも国を守ろうとしている。

### Hidden meaning later
美しい言葉は、混沌や深淵に近づく儀式を覆い隠す建前になっている。

### Text or staging
- 王国兵は「命令」よりも「救済」「祝福」という語を使う。
- 神官は痛みや犠牲を美しい言葉で包む。

### Speaker or object
グラド、レナード、ヴェルド、ジャスパー、王国兵

### Reveal timing
光の神殿から魔王城、深淵入口。

### Risk check
- 露骨すぎないか: 早期に「洗脳」と断定しない。
- 多すぎないか: 敵幹部ごとに語彙を変える。
- キャラが知りすぎていないか: 味方側は違和感だけを持つ。
- 他の伏線と重複していないか: 王国軍全体を単純悪にしない。

## FL-004-zenon-not-good-person

Status: draft
Type: true_clue

### Location
- area: 魔王城
- scene: 魔王ゼノン戦前後
- storyStep-subStep: 8-x
- required flags: `lightPalaceCleared`

### Surface meaning now
ゼノンは恐ろしく、倒すべき魔王に見える。

### Hidden meaning later
ゼノンは闇のプリズムを守っていたが、善人として弁明するつもりはない。

### Text or staging
- 魔王城の魔族が「王は残酷だ。だが約束だけは破らぬ」と言う。
- ゼノン自身は守っていた理由を最低限しか語らない。

### Speaker or object
魔王城の魔族、ゼノン

### Reveal timing
ゼノン撃破後から深淵解放。

### Risk check
- 露骨すぎないか: 「実はいい人」にしない。
- 多すぎないか: 魔王城内の一部NPCだけ。
- キャラが知りすぎていないか: 魔族は忠誠と恐怖を混ぜる。
- 他の伏線と重複していないか: 闇=悪の反転と接続する。
