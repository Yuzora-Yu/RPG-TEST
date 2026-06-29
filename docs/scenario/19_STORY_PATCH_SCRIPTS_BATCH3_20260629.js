/* 19_STORY_PATCH_SCRIPTS_BATCH3_20260629.js
 * Concrete replacement snippets for PRISMA ABYSS story.js.
 * This file is a handoff patch bank, not an auto-applier.
 */
const STORY_PATCH_SCRIPTS_BATCH3_20260629 = {
  THUNDER_LEONARD_CLEAR_RESTORE: [
    {
      "type": "FIELD_CUTSCENE",
      "name": "レナード戦後・本人表示",
      "commands": [
        { "op": "CLEAR_LAYER" },
        { "op": "SHOW_SPRITE", "id": "field-visual-leonard", "monsterId": 301040, "size": 2, "z": 4 }
      ]
    },
    { "name": "雷楔のレナード", "text": "…[N:101]、まだ旧い理想にしがみつくのか。国を存続させるには、痛みを引き受ける者が必要だ。" },
    { "name": "ジョセフ", "text": "痛みを引き受けるのと、誰かから奪うのは違うだろうが！プリズムは国王の財布じゃねえ！", "charId": 101 },
    { "name": "雷楔のレナード", "text": "プリズムの力は必要な分、すでに光の神殿に集まっている。儀式の日は近い。" },
    { "name": "雷楔のレナード", "text": "……止めたいのなら、まずは大灯台で発動している魔術結界を壊すことだ。" },
    { "name": "雷楔のレナード", "text": "それから……" },
    {
      "type": "FIELD_CUTSCENE",
      "name": "レナード戦後・騎士登場",
      "commands": [
        { "op": "HIDE_STORY_UI", "hidden": true },
        { "op": "BLACKOUT", "holdMs": 140 },
        { "op": "SHOW_SPRITE", "id": "field-visual-leonard", "monsterId": 301040, "size": 2, "z": 4 },
        { "op": "SHOW_SPRITE", "id": "field-visual-knight", "monsterId": 301050, "dx": 0, "dy": -1, "size": 2, "z": 5 },
        { "op": "HIDE_STORY_UI", "hidden": false }
      ]
    },
    { "name": "？？？？", "text": "…喋りすぎ…だ。" },
    {
      "type": "FIELD_CUTSCENE",
      "name": "レナード戦後・斬撃と消滅",
      "lockMs": 1200,
      "commands": [
        { "op": "HIDE_STORY_UI", "hidden": true },
        { "op": "SHOW_SPRITE", "id": "field-visual-slash", "effect": "slash", "size": 2.25, "z": 8, "opacity": 0.96 },
        { "op": "BLINK_REMOVE", "id": "field-visual-leonard", "fallback": { "monsterId": 301040, "size": 2, "z": 4 }, "count": 4, "offMs": 80, "onMs": 80 },
        { "op": "REMOVE_SPRITE", "id": "field-visual-slash" },
        { "op": "HIDE_STORY_UI", "hidden": false }
      ]
    },
    { "name": "ジョセフ", "text": "レナード！！！", "charId": 101 },
    {
      "type": "FIELD_CUTSCENE",
      "name": "レナード戦後・騎士前進",
      "lockMs": 1200,
      "commands": [
        { "op": "HIDE_STORY_UI", "hidden": true },
        { "op": "WAIT", "ms": 200 },
        { "op": "MOVE_SPRITE", "id": "field-visual-knight", "monsterId": 301050, "dx": 0, "dy": 0, "size": 2, "z": 5, "duration": 160 },
        { "op": "WAIT", "ms": 200 },
        { "op": "HIDE_STORY_UI", "hidden": false }
      ]
    },
    { "name": "？？？？", "text": "お前達が例の反逆者か。騎士崩れと世間知らずの子供達。救世主ごっこは、ここまでだ。" },
    { "type": "FIELD_CUTSCENE", "name": "レナード戦後・演出終了", "commands": [{ "op": "CLEANUP" }] }
  ],

  FIRE_VILLAGE_CONSULT_REWRITE: [
    { "name": "里の長", "text": "……来てくれたか。\n炉の火が、日に日に荒れておる。" },
    { "name": "里の長", "text": "消えるだけなら、まだよい。\n今の火は、弱ったと思えば急に跳ねる。" },
    { "name": "里の長", "text": "鍛冶場では鉄が割れ、台所では飯が焦げる。\n湯を沸かすだけでも、子どもを近づけられぬ。" },
    { "name": "里の長", "text": "火は、火山のプリズムから届く恵みだ。\nその恵みが、こちらの手を離れつつある。" },
    { "name": "里の長", "text": "若者を火山へ送った。\n戻った者は、王国兵を見たと言う。" },
    { "name": "里の長", "text": "プリズムを確かめてくれ。\n火を失えば、この里は明日の飯から守れぬ。" }
  ],

  TOWN_FIRE_VILLAGER_2_BEFORE_REWRITE: [
    { "name": "料理番", "text": "こんな火じゃ全部真っ黒こげだ。\nかと思えば、こっちは生焼けのまま。", "charId": 1003 },
    { "name": "料理番", "text": "子どもに焦げた芋を出したら、黙って食べたよ。\n文句を言う元気もないんだ。", "charId": 1003 },
    { "name": "料理番", "text": "まともな飯を作れないってのはね、\n思ったより人の心を削るんだよ。", "charId": 1003 }
  ],

  DARK_CASTLE_ZENON_ENCOUNTER_REWRITE: [
    {
        "name": "システム",
        "text": "魔王城三階、謁見の間。\n闇のプリズムは静かに脈打ち、玉座の前に魔王[N:402]が立っている。"
    },
    {
        "name": "魔王ゼノン",
        "text": "三つの結界を越えたか。\nならば、言葉は少なくていい。",
        "charId": 402
    },
    {
        "name": "シャオ",
        "text": "私は……魔王より先に、聞きたい相手がいる。\nシャニー姉さんは、ここにいるんでしょ。",
        "charId": 105
    },
    {
        "name": "シャニー",
        "text": "……いる。",
        "charId": 306
    },
    {
        "name": "シャオ",
        "text": "なんで……里を捨てたの。\nみんな、ずっと待ってたのに。",
        "charId": 105
    },
    {
        "name": "魔王ゼノン",
        "text": "捨てた、か。\n戻れば、あの里が先に死んでいただけだ。",
        "charId": 402
    },
    {
        "name": "シャオ",
        "text": "……何を、言ってる。",
        "charId": 105
    },
    {
        "name": "魔王ゼノン",
        "text": "幼い身で深淵に魅入られた者が、\n人里で生きられると思うか。",
        "charId": 402
    },
    {
        "name": "シャニー",
        "text": "ゼノン様。そこまででいい。",
        "charId": 306
    },
    {
        "name": "魔王ゼノン",
        "text": "……よかろう。\n沈黙を選んだのは、お前だ。",
        "charId": 402
    },
    {
        "name": "シャニー",
        "text": "シャオ。今は話せない。\nでも、里を嫌いになった日はない。",
        "charId": 306
    },
    {
        "name": "シャオ",
        "text": "そんな言い方で、納得できるわけ……！",
        "charId": 105
    },
    {
        "name": "シャニー",
        "text": "うん。だから、怒ってていい。",
        "charId": 306
    },
    {
        "name": "魔王ゼノン",
        "text": "家族の話なら、剣の後にしろ。\nここは玉座で、余は魔王だ。",
        "charId": 402
    },
    {
        "name": "魔王ゼノン",
        "text": "闇を恐れて膝をつく者か、闇の前で立つ者か。\n余に示せ。",
        "charId": 402
    }
],

  DARK_CASTLE_CLEAR_REWRITE: [
    {
        "name": "魔王ゼノン",
        "text": "……見事だ。\n闇を前にしても、刃を止めなかった。",
        "charId": 402
    },
    {
        "name": "システム",
        "text": "闇のプリズムは静かに脈打っている。\n濁りはない。傷もない。"
    },
    {
        "name": "シャオ",
        "text": "壊れて……ない。\n魔王が、壊したんじゃないの？",
        "charId": 105
    },
    {
        "name": "魔王ゼノン",
        "text": "余を善と呼ぶな。不快だ。\nだが、預かったものは捨てぬ。",
        "charId": 402
    },
    {
        "name": "魔王ゼノン",
        "text": "シャニーも同じだ。\n縋ったのはあれだが、救ったのは余だ。",
        "charId": 402
    },
    {
        "name": "魔王ゼノン",
        "text": "代わりに、その才と生涯はもらった。\n契約とは、そういうものだ。",
        "charId": 402
    },
    {
        "name": "シャニー",
        "text": "ゼノン様。……もう、十分です。",
        "charId": 306
    },
    {
        "name": "シャオ",
        "text": "姉さん……何を、したの。",
        "charId": 105
    },
    {
        "name": "シャニー",
        "text": "生きるために、選んだ。\nあなたのそばには、戻れなかった。",
        "charId": 306
    },
    {
        "name": "シャニー",
        "text": "それでも……忘れた日はない。",
        "charId": 306
    },
    {
        "name": "シャオ",
        "text": "……許したわけじゃない。\nでも、知らないことがあるのは分かった。",
        "charId": 105
    },
    {
        "name": "魔王ゼノン",
        "text": "六つが応えた今なら、世界中央の亀裂も開く。\n案内は、こいつに任せる。",
        "charId": 402
    },
    {
        "name": "シャニー",
        "text": "……道は知ってる。\n今度は、黙って消えない。",
        "charId": 306
    },
    {
        "name": "システム",
        "text": "[N:306]が仲間に加わった！"
    }
],

  ABYSS_UNSEALED_FINAL_REWRITE_NO_ZENON: [
    { "name": "システム", "text": "黒い亀裂が、息をしている。\n石でも穴でもなく、世界そのものの傷口が開いていた。" },
    { "name": "ケイト", "text": "水の流れがないのに、底から波の音がします。\n……ここ、普通の穴じゃありません。", "charId": 104 },
    { "name": "レイラ", "text": "祈りの言葉が、口の中でほどけます。\n光がまっすぐ進めない場所なんて……。", "charId": 204 },
    { "name": "シャニー", "text": "深淵は、ただの穴じゃない。\n見すぎると、向こうもこちらを見る。", "charId": 306 },
    { "name": "ジョセフ", "text": "脅かすなよ。\n……いや、脅しじゃねえ顔だな。", "charId": 101 },
    { "name": "シャニー", "text": "私が見張る。\n呑まれそうになったら、名前を呼ぶ。", "charId": 306 },
    { "name": "シャオ", "text": "……勝手に消えたら、今度こそ怒るから。", "charId": 105 },
    { "name": "シャニー", "text": "うん。", "charId": 306 },
    { "name": "システム", "text": "深淵への道が開いた。" }
  ]
};

if (typeof window !== "undefined") window.STORY_PATCH_SCRIPTS_BATCH3_20260629 = STORY_PATCH_SCRIPTS_BATCH3_20260629;
if (typeof module !== "undefined") module.exports = STORY_PATCH_SCRIPTS_BATCH3_20260629;
