/* ========================================================================== 
   Prisma Abyss Tutorial Modal
   --------------------------------------------------------------------------
   - ゲーム進行側からは TutorialModal.open('tutorial-id') で呼び出せます。
   - 一覧やページ内容は TUTORIAL_DATA を編集してください。
   - 現在の39件は本文・画像とも仮案です。各 pages 配列へページを追加できます。
   - 画像は assets/tutorial/0001.png のように管理する想定です。
   ========================================================================== */
(() => {
    'use strict';

    const TUTORIAL_DATA = [
        {
            "no": "T01",
            "id": "t01-bulk-download",
            "title": "画像をまとめてダウンロード",
            "description": "初回画像取得とオフライン利用について",
            "phase": "初回起動",
            "screen": "初回画像ダウンロード確認",
            "triggerHint": "初回起動かつ画像キャッシュ選択が未回答",
            "pages": [
                {
                    "title": "画像をまとめて取得しよう",
                    "image": "assets/tutorial/0001.png",
                    "imageAlt": "画像の一括ダウンロード確認画面",
                    "body": "ゲームで使う画像を最初にまとめてダウンロードできます。\n\n通信量は増えますが、その後の画像表示が安定し、オフラインでも遊びやすくなります。設定は後から変更できます。"
                }
            ]
        },
        {
            "no": "T02",
            "id": "t02-hero-setup",
            "title": "主人公を設定しよう",
            "description": "主人公の名前と画像の設定",
            "phase": "ニューゲーム",
            "screen": "主人公設定",
            "triggerHint": "新規ゲーム開始",
            "pages": [
                {
                    "title": "主人公を設定しよう",
                    "image": "assets/tutorial/0002.png",
                    "imageAlt": "主人公の名前と画像を設定する画面",
                    "body": "主人公の名前を入力して冒険を始めよう。\n\n主人公画像の設定は任意です。あとから変更できる場合は、設定や主人公画面からいつでも見直せます。"
                }
            ]
        },
        {
            "no": "T03",
            "id": "t03-basic-attack",
            "title": "攻撃してみよう",
            "description": "戦闘コマンドと攻撃対象の選択",
            "phase": "開始直後",
            "screen": "オープニング戦闘",
            "triggerHint": "opening battle、tutorialBattleStep=0",
            "pages": [
                {
                    "title": "攻撃してみよう",
                    "image": "assets/tutorial/0003.png",
                    "imageAlt": "攻撃コマンドと敵の対象選択画面",
                    "body": "行動する仲間のコマンドから「攻撃」を選ぼう。\n\n次に攻撃したい敵を選ぶと行動が決定します。まずは通常攻撃で戦闘の流れをつかもう。"
                }
            ]
        },
        {
            "no": "T04",
            "id": "t04-skill-and-mp",
            "title": "スキルを使おう",
            "description": "スキル、MP、攻撃・回復範囲について",
            "phase": "開始直後",
            "screen": "オープニング戦闘",
            "triggerHint": "使用可能スキルあり、かつHP減少または有効な攻撃スキルあり",
            "pages": [
                {
                    "title": "スキルを使おう",
                    "image": "assets/tutorial/0004.png",
                    "imageAlt": "スキル一覧とMP、対象範囲の説明画面",
                    "body": "スキルはMPを消費する代わりに、強力な攻撃や回復などの効果を発揮します。\n\n消費MP、効果、対象範囲を確認して、必要な相手を選ぼう。"
                }
            ]
        },
        {
            "no": "T05",
            "id": "t05-field-controls",
            "title": "フィールドを歩こう",
            "description": "移動、決定、調べる操作",
            "phase": "最初の村",
            "screen": "フィールド操作",
            "triggerHint": "firstFieldControl=true",
            "pages": [
                {
                    "title": "フィールドを歩こう",
                    "image": "assets/tutorial/0005.png",
                    "imageAlt": "フィールドの方向ボタンとOKボタン",
                    "body": "方向ボタンでフィールドを移動できます。\n\n人物や宝箱、入口などの前に立って「OK」を押すと、話す・調べる・中へ入るといった行動ができます。"
                }
            ]
        },
        {
            "no": "T06",
            "id": "t06-objective-hud",
            "title": "次の目的を確認しよう",
            "description": "目的表示で次の行動を確認",
            "phase": "最初の村",
            "screen": "目的表示HUD",
            "triggerHint": "T05完了かつobjectiveHud初表示",
            "pages": [
                {
                    "title": "次の目的を確認しよう",
                    "image": "assets/tutorial/0006.png",
                    "imageAlt": "フィールド画面上部の目的表示",
                    "body": "次に何をすればよいか迷った時は、画面上部の「目的」を確認しよう。\n\n行き先や倒す相手など、物語を進めるための手がかりが表示されます。"
                }
            ]
        },
        {
            "no": "T07",
            "id": "t07-minimap",
            "title": "ミニマップを活用しよう",
            "description": "現在地と周囲の地形を確認",
            "phase": "最初の村",
            "screen": "ミニマップ",
            "triggerHint": "fieldSteps>=10 and minimapTutorial未完了",
            "pages": [
                {
                    "title": "ミニマップを活用しよう",
                    "image": "assets/tutorial/0007.png",
                    "imageAlt": "現在地と周囲の地形を示すミニマップ",
                    "body": "ミニマップには現在地と周囲の地形が表示されます。\n\n出口や目的地のおおよその方向を確かめながら進むと、探索しやすくなります。"
                }
            ]
        },
        {
            "no": "T08",
            "id": "t08-main-menu",
            "title": "メニューを開こう",
            "description": "冒険の準備を行うメインメニュー",
            "phase": "仲間加入直後",
            "screen": "メインメニュー",
            "triggerHint": "partySize>=3 and mainMenu未使用",
            "pages": [
                {
                    "title": "メニューを開こう",
                    "image": "assets/tutorial/0008.png",
                    "imageAlt": "フィールド画面のMENUボタン",
                    "body": "「MENU」から冒険の準備や各種確認ができます。\n\n仲間の編成、装備、アイテム、スキル、設定などを見直したい時に開こう。"
                }
            ]
        },
        {
            "no": "T09",
            "id": "t09-party-formation",
            "title": "パーティを編成しよう",
            "description": "戦闘メンバーと並び順の変更",
            "phase": "仲間加入直後",
            "screen": "パーティ編成",
            "triggerHint": "partySize>=3 and partyFormationTutorial未完了",
            "pages": [
                {
                    "title": "パーティを編成しよう",
                    "image": "assets/tutorial/0009.png",
                    "imageAlt": "パーティメンバーの編成画面",
                    "body": "パーティ編成では、戦闘に参加する仲間と並び順を変更できます。\n\n仲間が増えたら、それぞれの役割や敵との相性に合わせてメンバーを選ぼう。"
                }
            ]
        },
        {
            "no": "T10",
            "id": "t10-character-status",
            "title": "仲間の詳細を確認しよう",
            "description": "能力、装備、スキル、特性の確認",
            "phase": "仲間加入後",
            "screen": "キャラクターステータス",
            "triggerHint": "firstOpen=allies/status",
            "pages": [
                {
                    "title": "仲間の詳細を確認しよう",
                    "image": "assets/tutorial/0010.png",
                    "imageAlt": "キャラクター詳細の各タブ",
                    "body": "キャラクター画面では、能力値、装備、習得スキル、特性やシナジーを確認できます。\n\nタブを切り替えて、仲間の得意分野や成長状況を把握しよう。"
                }
            ]
        },
        {
            "no": "T11",
            "id": "t11-change-equipment",
            "title": "装備を変更しよう",
            "description": "装備候補と能力差の比較",
            "phase": "序盤",
            "screen": "装備",
            "triggerHint": "inventoryに未装備品あり and firstOpen=equipment",
            "pages": [
                {
                    "title": "装備を変更しよう",
                    "image": "assets/tutorial/0011.png",
                    "imageAlt": "装備変更と能力比較の画面",
                    "body": "変更したい装備枠を選び、所持している装備から候補を選ぼう。\n\n変更前後の能力値だけでなく、装備固有の効果も比べることが大切です。"
                }
            ]
        },
        {
            "no": "T12",
            "id": "t12-equipment-options",
            "title": "装備の付与効果を見よう",
            "description": "オプション、特性、シナジーの読み方",
            "phase": "序盤～中盤",
            "screen": "装備オプション・特性・シナジー",
            "triggerHint": "equipment.opts.length>0 or traits.length>0",
            "pages": [
                {
                    "title": "装備の付与効果を見よう",
                    "image": "assets/tutorial/0012.png",
                    "imageAlt": "装備オプションと特性、シナジー表示",
                    "body": "同じ名前の装備でも、付与されたオプションによって性能が異なることがあります。\n\n特性の組み合わせでシナジーが発生する場合もあるので、装備詳細を確認しよう。"
                }
            ]
        },
        {
            "no": "T13",
            "id": "t13-use-items",
            "title": "アイテムを使おう",
            "description": "回復アイテムと使用対象の選択",
            "phase": "序盤",
            "screen": "アイテム",
            "triggerHint": "hasFieldUsableHealingItem and anyMemberHP<maxHP",
            "pages": [
                {
                    "title": "アイテムを使おう",
                    "image": "assets/tutorial/0013.png",
                    "imageAlt": "アイテム一覧と使用対象選択画面",
                    "body": "アイテムには、移動中に使える回復品、戦闘中に使う道具、錬金などで使う素材があります。\n\n使用できるアイテムを選び、効果を与える仲間を選ぼう。"
                }
            ]
        },
        {
            "no": "T14",
            "id": "t14-skill-growth",
            "title": "SPで仲間を育てよう",
            "description": "SPを使った能力・スキル育成",
            "phase": "序盤",
            "screen": "スキル・育成",
            "triggerHint": "anyMemberSP>0 and skillGrowthTutorial未完了",
            "pages": [
                {
                    "title": "SPで仲間を育てよう",
                    "image": "assets/tutorial/0014.png",
                    "imageAlt": "SPを使用するスキル育成画面",
                    "body": "獲得したSPを使うと、仲間の能力やスキルを成長させられます。\n\n習得後の効果と必要SPを確認して、育成したい項目を選ぼう。"
                }
            ]
        },
        {
            "no": "T15",
            "id": "t15-defense-and-escape",
            "title": "防御と逃走を使おう",
            "description": "被害軽減、逃走、状態表示の確認",
            "phase": "初洞窟前後",
            "screen": "通常戦闘",
            "triggerHint": "normalBattleCount=1",
            "pages": [
                {
                    "title": "防御と逃走を使おう",
                    "image": "assets/tutorial/0015.png",
                    "imageAlt": "戦闘中の防御、逃走、状態表示",
                    "body": "防御を選ぶと、そのターンに受けるダメージを抑えられます。危険な戦闘では逃走も選べます。\n\n敵味方のHP、MP、状態変化は画面の表示から確認しよう。"
                }
            ]
        },
        {
            "no": "T16",
            "id": "t16-auto-and-speed",
            "title": "AUTOと戦闘速度を使おう",
            "description": "自動戦闘と進行速度の変更",
            "phase": "初洞窟前後",
            "screen": "AUTO・戦闘速度",
            "triggerHint": "normalBattleWins>=1 and autoTutorial未完了",
            "pages": [
                {
                    "title": "AUTOと戦闘速度を使おう",
                    "image": "assets/tutorial/0016.png",
                    "imageAlt": "戦闘画面のAUTOと速度変更ボタン",
                    "body": "AUTOを有効にすると、仲間が設定された作戦に従って自動で行動します。\n\n戦闘速度も変更できるので、周回や連戦では好みの速さに調整しよう。"
                }
            ]
        },
        {
            "no": "T17",
            "id": "t17-battle-strategy",
            "title": "仲間の作戦を決めよう",
            "description": "仲間ごとのAUTO行動方針",
            "phase": "仲間加入後",
            "screen": "作戦",
            "triggerHint": "partySize>=3 and autoEnabled and strategyTutorial未完了",
            "pages": [
                {
                    "title": "仲間の作戦を決めよう",
                    "image": "assets/tutorial/0017.png",
                    "imageAlt": "仲間ごとの作戦設定画面",
                    "body": "作戦では、仲間ごとにAUTO中の行動方針を設定できます。\n\n攻撃重視、回復重視、MP節約など、役割に合った方針を選ぼう。"
                }
            ]
        },
        {
            "no": "T18",
            "id": "t18-auto-skill-settings",
            "title": "AUTOで使うスキルを選ぼう",
            "description": "自動使用スキルの詳細設定",
            "phase": "中盤",
            "screen": "AUTO詳細設定",
            "triggerHint": "learnedSkills>=3 and characterConfigFirstOpen",
            "pages": [
                {
                    "title": "AUTOで使うスキルを選ぼう",
                    "image": "assets/tutorial/0018.png",
                    "imageAlt": "AUTOで使用しないスキルの設定画面",
                    "body": "AUTO中に使わせたくないスキルは、キャラクター設定から除外できます。\n\n大切なスキルやMP消費の大きいスキルを調整して、戦い方を細かく整えよう。"
                }
            ]
        },
        {
            "no": "T19",
            "id": "t19-dungeon-exploration",
            "title": "ダンジョンを探索しよう",
            "description": "階段、宝箱、敵との遭遇",
            "phase": "初洞窟",
            "screen": "固定ダンジョン",
            "triggerHint": "firstFixedDungeonEntry",
            "pages": [
                {
                    "title": "ダンジョンを探索しよう",
                    "image": "assets/tutorial/0019.png",
                    "imageAlt": "階段と宝箱があるダンジョン画面",
                    "body": "ダンジョンでは階段を探して次の階層へ進みます。\n\n宝箱や調べられる場所の前では「OK」を押そう。移動中に魔物と遭遇することもあります。"
                }
            ]
        },
        {
            "no": "T20",
            "id": "t20-dungeon-escape",
            "title": "危険な時は脱出しよう",
            "description": "ダンジョンからの途中脱出と制限",
            "phase": "初洞窟",
            "screen": "ダンジョン脱出",
            "triggerHint": "dungeonFloor>=2 or partyHpRate<0.4",
            "pages": [
                {
                    "title": "危険な時は脱出しよう",
                    "image": "assets/tutorial/0020.png",
                    "imageAlt": "ダンジョンメニューの脱出操作",
                    "body": "探索を続けるのが危険な時は、ダンジョンメニューから脱出できます。\n\nボス戦や特定の場面では脱出できないことがあるため、先へ進む前に準備しよう。"
                }
            ]
        },
        {
            "no": "T21",
            "id": "t21-colored-keys",
            "title": "色の鍵を使おう",
            "description": "赤・青・金の鍵と対応する扉",
            "phase": "初洞窟",
            "screen": "鍵・扉",
            "triggerHint": "firstKeyGranted(scope,color)",
            "pages": [
                {
                    "title": "色の鍵を使おう",
                    "image": "assets/tutorial/0021.png",
                    "imageAlt": "色付きの鍵と対応する扉・宝箱",
                    "body": "鍵は同じ色の扉や宝箱を開ける時に使い、使用すると消費されます。\n\n物語のダンジョンとアビスなどでは鍵の所持数が分かれているので、画面の鍵表示を確認しよう。"
                }
            ]
        },
        {
            "no": "T22",
            "id": "t22-trap-chests",
            "title": "宝箱の罠に注意しよう",
            "description": "罠や特殊な結果がある宝箱",
            "phase": "ダンジョン探索",
            "screen": "罠・特殊宝箱",
            "triggerHint": "firstChestTrap or firstSpecialChest",
            "pages": [
                {
                    "title": "宝箱の罠に注意しよう",
                    "image": "assets/tutorial/0022.png",
                    "imageAlt": "罠や特殊効果が発生する宝箱",
                    "body": "宝箱にはアイテムだけでなく、罠や特別な出来事が仕掛けられていることがあります。\n\n残りHPや周囲の状況を確認してから開けよう。"
                }
            ]
        },
        {
            "no": "T23",
            "id": "t23-boss-preparation",
            "title": "ボス戦に備えよう",
            "description": "強敵戦の前に行う準備",
            "phase": "初ボス前",
            "screen": "ボス戦",
            "triggerHint": "firstBossTileEnter and bossBattle未開始",
            "pages": [
                {
                    "title": "ボス戦に備えよう",
                    "image": "assets/tutorial/0023.png",
                    "imageAlt": "ボス戦前の確認画面",
                    "body": "この先では強敵との戦いが始まります。戦闘開始後は、通常の方法で脱出できない場合があります。\n\nHP・MPの回復、装備、パーティ編成、作戦を確認してから進もう。"
                }
            ]
        },
        {
            "no": "T24",
            "id": "t24-story-viewer",
            "title": "物語の見方",
            "description": "紙芝居の自動送りとスキップ",
            "phase": "初洞窟クリア後",
            "screen": "紙芝居オープニング",
            "triggerHint": "PROLOGUE3完了後のopening開始",
            "pages": [
                {
                    "title": "物語の見方",
                    "image": "assets/tutorial/0024.png",
                    "imageAlt": "紙芝居形式の物語画面とスキップ操作",
                    "body": "物語の場面は自動で進みます。\n\nもう一度見る必要がない時や先へ進みたい時は、スキップ操作を利用できます。"
                }
            ]
        },
        {
            "no": "T25",
            "id": "t25-inn",
            "title": "宿屋で休もう",
            "description": "ゴールドを使ったパーティの全回復",
            "phase": "施設利用",
            "screen": "宿屋",
            "triggerHint": "firstInnOpen and anyResourceNotFull",
            "pages": [
                {
                    "title": "宿屋で休もう",
                    "image": "assets/tutorial/0025.png",
                    "imageAlt": "宿屋の休息・回復画面",
                    "body": "宿屋ではゴールドを支払い、パーティ全員のHPやMPを回復できます。\n\n長い探索や強敵との戦いへ向かう前に、十分に休んでおこう。"
                }
            ]
        },
        {
            "no": "T26",
            "id": "t26-shop",
            "title": "ショップを利用しよう",
            "description": "アイテムの購入、売却、数量指定",
            "phase": "施設利用",
            "screen": "ショップ",
            "triggerHint": "firstShopOpen",
            "pages": [
                {
                    "title": "ショップを利用しよう",
                    "image": "assets/tutorial/0026.png",
                    "imageAlt": "ショップの購入・売却画面",
                    "body": "ショップでは、所持金、商品の価格、現在の所持数を確認して購入できます。\n\n不要になったアイテムは売却できます。数量と売却品を確認してから決定しよう。"
                }
            ]
        },
        {
            "no": "T27",
            "id": "t27-blacksmith",
            "title": "鍛冶を使い分けよう",
            "description": "合成、強化、精錬の違い",
            "phase": "火の村報告後",
            "screen": "鍛冶",
            "triggerHint": "smithUnlocked and firstBlacksmithOpen",
            "pages": [
                {
                    "title": "鍛冶を使い分けよう",
                    "image": "assets/tutorial/0027.png",
                    "imageAlt": "鍛冶の合成・強化・精錬選択画面",
                    "body": "合成は装備を掛け合わせ、強化は素材を使ってオプション値を伸ばします。精錬ではGEMを使い、オプションの段階を引き上げます。\n\n実行前に成功率、必要素材、消費する装備やGEMを確認しよう。"
                }
            ]
        },
        {
            "no": "T28",
            "id": "t28-alchemy",
            "title": "錬金で道具を作ろう",
            "description": "レシピ、必要素材、作成数の選択",
            "phase": "施設利用",
            "screen": "錬金",
            "triggerHint": "firstAlchemyOpen and craftableEntries>0",
            "pages": [
                {
                    "title": "錬金で道具を作ろう",
                    "image": "assets/tutorial/0028.png",
                    "imageAlt": "錬金のレシピ・素材・作成数選択画面",
                    "body": "カテゴリとレシピを選び、必要素材と所持数を確認して錬成しよう。作成数を指定すれば、複数個をまとめて作れます。\n\n素材を自由に選ぶ錬成は、通常のレシピ錬成とは異なる方法で行います。"
                }
            ]
        },
        {
            "no": "T29",
            "id": "t29-adventurer-guild",
            "title": "ギルドの依頼を受けよう",
            "description": "依頼の受注、進捗、報告、ランク",
            "phase": "施設利用",
            "screen": "冒険者ギルド",
            "triggerHint": "firstGuildBoardOpen",
            "pages": [
                {
                    "title": "ギルドの依頼を受けよう",
                    "image": "assets/tutorial/0029.png",
                    "imageAlt": "冒険者ギルドの依頼板と報告画面",
                    "body": "依頼板から仕事を選んで受注し、条件を達成したら受付へ報告しよう。\n\n報酬としてギルドEXP、GP、アイテムなどを獲得でき、ランクが上がると新しい依頼や交換先が広がります。"
                }
            ]
        },
        {
            "no": "T30",
            "id": "t30-monster-bestiary",
            "title": "モンスター図鑑を見よう",
            "description": "倒した魔物の情報を確認",
            "phase": "収集要素",
            "screen": "モンスター図鑑",
            "triggerHint": "bestiaryUniqueCount=1",
            "pages": [
                {
                    "title": "モンスター図鑑を見よう",
                    "image": "assets/tutorial/0030.png",
                    "imageAlt": "モンスター図鑑の一覧・詳細画面",
                    "body": "倒した魔物の情報は、モンスター図鑑へ記録されます。\n\n遭遇した魔物や討伐状況を振り返り、冒険の記録を集めよう。"
                }
            ]
        },
        {
            "no": "T31",
            "id": "t31-achievements",
            "title": "実績を確認しよう",
            "description": "実績の達成状況とプレイ記録",
            "phase": "収集要素",
            "screen": "実績",
            "triggerHint": "firstAchievementCompleted",
            "pages": [
                {
                    "title": "実績を確認しよう",
                    "image": "assets/tutorial/0031.png",
                    "imageAlt": "実績の達成一覧と進行状況画面",
                    "body": "冒険や戦闘などのプレイ記録に応じて、さまざまな実績を達成できます。\n\n実績画面で達成済みの項目と、次に狙える条件を確認しよう。"
                }
            ]
        },
        {
            "no": "T32",
            "id": "t32-magic-boat",
            "title": "魔法の舟で海を渡ろう",
            "description": "乗船、水上移動、上陸",
            "phase": "水の神殿クリア後",
            "screen": "魔法の舟",
            "triggerHint": "item108取得 or boatUnlocked",
            "pages": [
                {
                    "title": "魔法の舟で海を渡ろう",
                    "image": "assets/tutorial/0032.png",
                    "imageAlt": "魔法の舟で水上を移動するフィールド画面",
                    "body": "魔法の舟を使うと水上を移動でき、これまで行けなかった地域へ進めるようになります。\n\n舟に乗り降りできる場所を探して、新しい土地を探索しよう。"
                }
            ]
        },
        {
            "no": "T33",
            "id": "t33-magic-communication",
            "title": "魔法通信を使おう",
            "description": "離れた場所から施設を利用",
            "phase": "光の宮殿後",
            "screen": "魔法通信",
            "triggerHint": "item111取得 or craftingMenuUnlocked",
            "pages": [
                {
                    "title": "魔法通信を使おう",
                    "image": "assets/tutorial/0033.png",
                    "imageAlt": "魔法通信から各施設を選ぶ画面",
                    "body": "魔法通信を使うと、現在地から鍛冶、錬金、ギルドなどの施設へアクセスできます。\n\n新しい製作機能が増えるのではなく、すでに解放した施設を離れた場所から利用できる便利な機能です。"
                }
            ]
        },
        {
            "no": "T34",
            "id": "t34-story-abyss",
            "title": "深淵を探索しよう",
            "description": "ストーリーアビスの階層進行と到達記録",
            "phase": "深淵解放後",
            "screen": "アビス・ストーリーモード",
            "triggerHint": "abyssUnlocked and firstStoryAbyssEntry",
            "pages": [
                {
                    "title": "深淵を探索しよう",
                    "image": "assets/tutorial/0034.png",
                    "imageAlt": "ストーリーアビスの階層選択・探索画面",
                    "body": "深淵は、階層を進んで到達記録を伸ばしていく長期探索です。\n\n通常のダンジョンとは進み方、鍵の扱い、帰還条件などが異なるため、開始前の案内を確認しよう。"
                }
            ]
        },
        {
            "no": "T35",
            "id": "t35-abyss-modes",
            "title": "2つのアビスを使い分けよう",
            "description": "物語深淵と深淵の亀裂の進行・再開",
            "phase": "エンディング後",
            "screen": "深淵の亀裂・ダンジョンメニュー",
            "triggerHint": "abyssRandomUnlocked and dungeonMenuUnlocked",
            "pages": [
                {
                    "title": "2つのアビスを使い分けよう",
                    "image": "assets/tutorial/0035.png",
                    "imageAlt": "2種類のアビスを選択するダンジョンメニュー",
                    "body": "物語をたどる深淵と、踏破後に開く「深淵の亀裂」では、到達記録や進行状況が別に管理されます。\n\n到達済みの階層やチェックポイントを利用して、目的に合うモードから探索を再開しよう。"
                }
            ]
        },
        {
            "no": "T36",
            "id": "t36-inn-teleport",
            "title": "宿屋から深層へ移動しよう",
            "description": "到達済みアビス階層への転送",
            "phase": "エンディング後",
            "screen": "宿屋テレポート",
            "triggerHint": "teleportUnlocked and firstInnOpenAfterUnlock",
            "pages": [
                {
                    "title": "宿屋から深層へ移動しよう",
                    "image": "assets/tutorial/0036.png",
                    "imageAlt": "宿屋のアビス階層テレポート画面",
                    "body": "宿屋のテレポートを使うと、到達済みの「深淵の亀裂」の階層へ移動できます。\n\n転送費用は行き先によって変わります。所持金と選択階層を確認して利用しよう。"
                }
            ]
        },
        {
            "no": "T37",
            "id": "t37-reincarnation",
            "title": "転生でさらに強くなろう",
            "description": "転生で失うものと引き継ぐ成長",
            "phase": "高レベル到達",
            "screen": "転生・周回育成",
            "triggerHint": "reincarnationEligible and firstReincarnationOpen",
            "pages": [
                {
                    "title": "転生でさらに強くなろう",
                    "image": "assets/tutorial/0037.png",
                    "imageAlt": "転生前後のリセット・引き継ぎ比較画面",
                    "body": "転生すると一部の成長がリセットされる代わりに、次の育成へ引き継げる恒久的な力を得られます。\n\n実行前に、リセットされる項目、残る項目、得られる効果を必ず確認しよう。"
                }
            ]
        },
        {
            "no": "T38",
            "id": "t38-save-data",
            "title": "セーブデータを守ろう",
            "description": "バックアップ、復元、更新、削除",
            "phase": "任意",
            "screen": "設定・データ管理",
            "triggerHint": "firstDataManagementOpen",
            "pages": [
                {
                    "title": "セーブデータを守ろう",
                    "image": "assets/tutorial/0038.png",
                    "imageAlt": "セーブ書き出し・復元・更新・削除の設定画面",
                    "body": "端末変更やブラウザデータの消去に備えて、セーブデータを書き出して保管しよう。\n\n復元、アプリ更新、セーブ削除はそれぞれ役割が異なります。削除などの取り消せない操作は、内容を確認してから実行してください。"
                }
            ]
        },
        {
            "no": "T39",
            "id": "t39-tutorial-archive",
            "title": "チュートリアルを見返そう",
            "description": "一度見た遊び方の再確認",
            "phase": "全期間",
            "screen": "チュートリアル再閲覧",
            "triggerHint": "anyTutorialCompleted",
            "pages": [
                {
                    "title": "チュートリアルを見返そう",
                    "image": "assets/tutorial/0039.png",
                    "imageAlt": "お知らせメニューのチュートリアル一覧画面",
                    "body": "一度表示された説明は、「メニュー ＞ お知らせ ＞ チュートリアル」から見返せます。\n\n操作や施設の使い方を忘れた時は、見出しを選んでもう一度確認しよう。"
                }
            ]
        }
    ];

    const TutorialModal = {
        tutorials: [],
        currentTutorialId: null,
        currentPageIndex: 0,
        lastFocusedElement: null,
        previousBodyOverflow: '',
        previousHtmlOverflow: '',
        keydownHandler: null,
        resizeHandler: null,
        viewportResizeHandler: null,

        init() {
            this.registerMany(TUTORIAL_DATA);
            this.ensureStyles();
            this.ensureDOM();
            return this;
        },

        register(tutorial) {
            if (!tutorial || typeof tutorial.id !== 'string' || !tutorial.id.trim()) {
                console.warn('[TutorialModal] id がないチュートリアルは登録できません。', tutorial);
                return false;
            }
            if (!Array.isArray(tutorial.pages) || tutorial.pages.length === 0) {
                console.warn(`[TutorialModal] ${tutorial.id} にページがありません。`);
                return false;
            }

            const normalized = {
                no: String(tutorial.no || ''),
                id: tutorial.id.trim(),
                title: String(tutorial.title || 'チュートリアル'),
                description: String(tutorial.description || ''),
                phase: String(tutorial.phase || ''),
                screen: String(tutorial.screen || ''),
                triggerHint: String(tutorial.triggerHint || ''),
                pages: tutorial.pages.map((page, index) => ({
                    title: String(page?.title || `${index + 1}ページ`),
                    image: String(page?.image || ''),
                    imageAlt: String(page?.imageAlt || page?.title || 'チュートリアル画像'),
                    body: String(page?.body || '')
                }))
            };

            const existingIndex = this.tutorials.findIndex(item => item.id === normalized.id);
            if (existingIndex >= 0) this.tutorials.splice(existingIndex, 1, normalized);
            else this.tutorials.push(normalized);
            return true;
        },

        registerMany(tutorials) {
            (Array.isArray(tutorials) ? tutorials : []).forEach(tutorial => this.register(tutorial));
            return this;
        },

        getTutorials() {
            return this.tutorials.map(tutorial => ({
                no: tutorial.no,
                id: tutorial.id,
                title: tutorial.title,
                description: tutorial.description,
                phase: tutorial.phase,
                screen: tutorial.screen,
                pageCount: tutorial.pages.length
            }));
        },

        getTutorial(id) {
            return this.tutorials.find(tutorial => tutorial.id === id) || null;
        },

        open(id, startPage = 0) {
            const tutorial = this.getTutorial(id);
            if (!tutorial) {
                console.warn(`[TutorialModal] チュートリアルが見つかりません: ${id}`);
                if (typeof Menu !== 'undefined' && typeof Menu.msg === 'function') {
                    Menu.msg('チュートリアルを読み込めませんでした。');
                }
                return false;
            }

            this.ensureStyles();
            const root = this.ensureDOM();
            this.currentTutorialId = tutorial.id;
            this.currentPageIndex = this.clampPageIndex(startPage, tutorial.pages.length);
            this.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

            this.previousBodyOverflow = document.body.style.overflow;
            this.previousHtmlOverflow = document.documentElement.style.overflow;
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';

            root.hidden = false;
            root.setAttribute('aria-hidden', 'false');
            this.syncPanelWidth();
            this.installResizeControls();
            this.render();
            this.installKeyboardControls();

            const closeButton = document.getElementById('tutorial-modal-close-top');
            if (closeButton) window.requestAnimationFrame(() => closeButton.focus());
            return true;
        },

        close() {
            const root = document.getElementById('tutorial-modal-root');
            if (!root || root.hidden) return;

            root.hidden = true;
            root.setAttribute('aria-hidden', 'true');
            this.removeKeyboardControls();
            this.removeResizeControls();
            root.style.removeProperty('--tutorial-modal-panel-width');
            document.body.style.overflow = this.previousBodyOverflow;
            document.documentElement.style.overflow = this.previousHtmlOverflow;

            const focusTarget = this.lastFocusedElement;
            this.lastFocusedElement = null;
            if (focusTarget && document.contains(focusTarget) && typeof focusTarget.focus === 'function') {
                window.requestAnimationFrame(() => focusTarget.focus());
            }
        },

        move(direction) {
            const tutorial = this.getTutorial(this.currentTutorialId);
            if (!tutorial) return;
            const nextIndex = this.currentPageIndex + Number(direction || 0);
            if (nextIndex < 0 || nextIndex >= tutorial.pages.length) return;
            this.currentPageIndex = nextIndex;
            this.render();
        },

        goTo(pageIndex) {
            const tutorial = this.getTutorial(this.currentTutorialId);
            if (!tutorial) return;
            this.currentPageIndex = this.clampPageIndex(pageIndex, tutorial.pages.length);
            this.render();
        },

        clampPageIndex(pageIndex, pageCount) {
            const value = Number.isFinite(Number(pageIndex)) ? Math.floor(Number(pageIndex)) : 0;
            return Math.max(0, Math.min(Math.max(0, pageCount - 1), value));
        },

        ensureDOM() {
            let root = document.getElementById('tutorial-modal-root');
            if (root) return root;

            root = document.createElement('div');
            root.id = 'tutorial-modal-root';
            root.className = 'tutorial-modal';
            root.hidden = true;
            root.setAttribute('aria-hidden', 'true');
            root.innerHTML = `
                <section
                    class="tutorial-modal__panel"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tutorial-modal-page-title"
                    aria-describedby="tutorial-modal-description"
                >
                    <header class="tutorial-modal__header">
                        <div class="tutorial-modal__heading-wrap">
                            <div id="tutorial-modal-series-title" class="tutorial-modal__series-title"></div>
                            <h2 id="tutorial-modal-page-title" class="tutorial-modal__page-title"></h2>
                        </div>
                        <button
                            id="tutorial-modal-close-top"
                            class="tutorial-modal__icon-close"
                            type="button"
                            aria-label="チュートリアルを閉じる"
                        >×</button>
                    </header>

                    <div id="tutorial-modal-scroll" class="tutorial-modal__scroll">
                        <div class="tutorial-modal__image-frame">
                            <img id="tutorial-modal-image" class="tutorial-modal__image" alt="">
                            <div id="tutorial-modal-image-placeholder" class="tutorial-modal__image-placeholder" hidden>
                                <span class="tutorial-modal__image-placeholder-title">TUTORIAL IMAGE</span>
                                <span id="tutorial-modal-image-path" class="tutorial-modal__image-path"></span>
                            </div>
                        </div>
                        <div id="tutorial-modal-description" class="tutorial-modal__description"></div>
                    </div>

                    <footer class="tutorial-modal__footer">
                        <div class="tutorial-modal__navigation">
                            <button id="tutorial-modal-prev" class="tutorial-modal__nav-button" type="button">◀ 前へ</button>
                            <div class="tutorial-modal__progress-wrap">
                                <div id="tutorial-modal-dots" class="tutorial-modal__dots" aria-label="ページ選択"></div>
                                <div id="tutorial-modal-page-count" class="tutorial-modal__page-count"></div>
                            </div>
                            <button id="tutorial-modal-next" class="tutorial-modal__nav-button" type="button">次へ ▶</button>
                        </div>
                        <button id="tutorial-modal-close-bottom" class="tutorial-modal__close-bottom" type="button">閉じる</button>
                    </footer>
                </section>
            `;

            document.body.appendChild(root);
            document.getElementById('tutorial-modal-close-top')?.addEventListener('click', () => this.close());
            document.getElementById('tutorial-modal-close-bottom')?.addEventListener('click', () => this.close());
            document.getElementById('tutorial-modal-prev')?.addEventListener('click', () => this.move(-1));
            document.getElementById('tutorial-modal-next')?.addEventListener('click', () => this.move(1));
            return root;
        },

        render() {
            const tutorial = this.getTutorial(this.currentTutorialId);
            if (!tutorial) return;

            const page = tutorial.pages[this.currentPageIndex];
            const pageCount = tutorial.pages.length;
            const image = document.getElementById('tutorial-modal-image');
            const placeholder = document.getElementById('tutorial-modal-image-placeholder');
            const imagePath = document.getElementById('tutorial-modal-image-path');
            const scroll = document.getElementById('tutorial-modal-scroll');

            document.getElementById('tutorial-modal-series-title').textContent = tutorial.title;
            document.getElementById('tutorial-modal-page-title').textContent = page.title;
            document.getElementById('tutorial-modal-description').textContent = page.body;
            document.getElementById('tutorial-modal-page-count').textContent = `${this.currentPageIndex + 1} / ${pageCount}`;

            if (image && placeholder && imagePath) {
                image.onload = () => {
                    image.hidden = false;
                    placeholder.hidden = true;
                };
                image.onerror = () => {
                    image.hidden = true;
                    placeholder.hidden = false;
                    imagePath.textContent = page.image || '画像パス未設定';
                };
                image.alt = page.imageAlt;
                image.hidden = !page.image;
                placeholder.hidden = Boolean(page.image);
                imagePath.textContent = page.image || '画像パス未設定';

                if (page.image) {
                    image.src = '';
                    image.src = page.image;
                } else {
                    image.removeAttribute('src');
                    placeholder.hidden = false;
                }
            }

            const prev = document.getElementById('tutorial-modal-prev');
            const next = document.getElementById('tutorial-modal-next');
            if (prev) prev.disabled = this.currentPageIndex <= 0;
            if (next) next.disabled = this.currentPageIndex >= pageCount - 1;

            const dots = document.getElementById('tutorial-modal-dots');
            if (dots) {
                dots.replaceChildren();
                tutorial.pages.forEach((dotPage, index) => {
                    const dot = document.createElement('button');
                    dot.type = 'button';
                    dot.className = `tutorial-modal__dot${index === this.currentPageIndex ? ' is-active' : ''}`;
                    dot.setAttribute('aria-label', `${index + 1}ページ目: ${dotPage.title}`);
                    dot.setAttribute('aria-current', index === this.currentPageIndex ? 'page' : 'false');
                    dot.addEventListener('click', () => this.goTo(index));
                    dots.appendChild(dot);
                });
            }

            if (scroll) scroll.scrollTop = 0;
        },

        getParentSurface() {
            const focused = this.lastFocusedElement;
            if (focused && typeof focused.closest === 'function') {
                const focusedSurface = focused.closest('.sub-screen, .scene-layer, #menu-screen, #main-menu, #game-container');
                if (focusedSurface) return focusedSurface;
            }
            return document.getElementById('game-container')
                || document.querySelector('.game-container')
                || null;
        },

        syncPanelWidth() {
            const root = document.getElementById('tutorial-modal-root');
            if (!root) return;

            // スマホでは従来どおり、画面端から約10pxずつ空けた全幅表示にする。
            const isDesktop = typeof window.matchMedia === 'function'
                ? window.matchMedia('(min-width: 601px)').matches
                : window.innerWidth >= 601;
            if (!isDesktop) {
                root.style.removeProperty('--tutorial-modal-panel-width');
                return;
            }

            // PCではゲーム本体・現在の親メニュー幅を上限にし、その内側に左右10pxの余白を残す。
            const surface = this.getParentSurface();
            const surfaceWidth = surface?.getBoundingClientRect?.().width || 450;
            const viewportWidth = window.visualViewport?.width || window.innerWidth || surfaceWidth;
            const panelWidth = Math.max(240, Math.floor(Math.min(surfaceWidth, viewportWidth) - 20));
            root.style.setProperty('--tutorial-modal-panel-width', `${panelWidth}px`);
        },

        installResizeControls() {
            this.removeResizeControls();
            this.resizeHandler = () => this.syncPanelWidth();
            window.addEventListener('resize', this.resizeHandler, { passive: true });

            if (window.visualViewport) {
                this.viewportResizeHandler = () => this.syncPanelWidth();
                window.visualViewport.addEventListener('resize', this.viewportResizeHandler, { passive: true });
            }
        },

        removeResizeControls() {
            if (this.resizeHandler) {
                window.removeEventListener('resize', this.resizeHandler);
                this.resizeHandler = null;
            }
            if (this.viewportResizeHandler && window.visualViewport) {
                window.visualViewport.removeEventListener('resize', this.viewportResizeHandler);
                this.viewportResizeHandler = null;
            }
        },

        installKeyboardControls() {
            this.removeKeyboardControls();
            this.keydownHandler = event => {
                const root = document.getElementById('tutorial-modal-root');
                if (!root || root.hidden) return;

                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.close();
                    return;
                }
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    this.move(-1);
                    return;
                }
                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    this.move(1);
                    return;
                }
                if (event.key !== 'Tab') return;

                const focusable = [...root.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
                    .filter(element => !element.hidden && element.getClientRects().length > 0);
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            };
            document.addEventListener('keydown', this.keydownHandler);
        },

        removeKeyboardControls() {
            if (!this.keydownHandler) return;
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        },

        ensureStyles() {
            if (document.getElementById('tutorial-modal-styles')) return;
            const style = document.createElement('style');
            style.id = 'tutorial-modal-styles';
            style.textContent = `
                .tutorial-modal,
                .tutorial-modal * {
                    box-sizing: border-box;
                }

                .tutorial-modal[hidden] {
                    display: none !important;
                }

                .tutorial-modal {
                    position: fixed;
                    inset: 0;
                    z-index: 40000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding-top: max(10px, env(safe-area-inset-top));
                    padding-right: max(10px, env(safe-area-inset-right));
                    padding-bottom: max(10px, env(safe-area-inset-bottom));
                    padding-left: max(10px, env(safe-area-inset-left));
                    background: rgba(3, 5, 9, 0.88);
                    overscroll-behavior: contain;
                    touch-action: pan-y;
                }

                .tutorial-modal__panel {
                    width: min(100%, 560px);
                    height: 100%;
                    min-height: 0;
                    display: grid;
                    grid-template-rows: auto minmax(0, 1fr) auto;
                    overflow: hidden;
                    color: #282515;
                    background:
                        linear-gradient(rgba(249, 242, 197, 0.96), rgba(239, 229, 178, 0.98)),
                        repeating-linear-gradient(0deg, rgba(95, 75, 30, 0.025) 0 1px, transparent 1px 4px);
                    border: 2px solid #c6b574;
                    border-radius: 12px;
                    box-shadow:
                        0 0 0 2px rgba(37, 30, 12, 0.82),
                        0 18px 50px rgba(0, 0, 0, 0.72),
                        inset 0 0 28px rgba(98, 75, 24, 0.18);
                    font-family: inherit;
                }

                .tutorial-modal__header {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 68px;
                    padding: 10px 56px 9px 18px;
                    border-bottom: 1px solid rgba(104, 85, 38, 0.42);
                    background: rgba(255, 250, 218, 0.45);
                    flex-shrink: 0;
                }

                .tutorial-modal__heading-wrap {
                    min-width: 0;
                    text-align: center;
                }

                .tutorial-modal__series-title {
                    color: #81713d;
                    font-size: 10px;
                    line-height: 1.2;
                    letter-spacing: 0.08em;
                }

                .tutorial-modal__page-title {
                    margin: 4px 0 0;
                    color: #242113;
                    font-size: clamp(16px, 4.6vw, 21px);
                    line-height: 1.3;
                    font-weight: 800;
                    overflow-wrap: anywhere;
                }

                .tutorial-modal__icon-close {
                    position: absolute;
                    top: 11px;
                    right: 11px;
                    width: 38px;
                    height: 38px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    color: #332c16;
                    background: rgba(255, 251, 222, 0.72);
                    border: 1px solid #8e7d49;
                    border-radius: 50%;
                    font: 700 25px/1 inherit;
                    cursor: pointer;
                    -webkit-tap-highlight-color: transparent;
                }

                .tutorial-modal__scroll {
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                    padding: clamp(10px, 2.8vw, 16px);
                    scrollbar-width: thin;
                    scrollbar-color: #a18c4e rgba(255, 255, 255, 0.18);
                }

                .tutorial-modal__image-frame {
                    position: relative;
                    width: 100%;
                    min-height: 220px;
                    flex: 1.65 1 0;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #16191b;
                    border: 2px solid #75673d;
                    border-radius: 5px;
                    box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.58);
                }

                .tutorial-modal__image {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: contain;
                    background: #111;
                }

                .tutorial-modal__image[hidden] {
                    display: none;
                }

                .tutorial-modal__image-placeholder {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 18px;
                    color: #d8cc98;
                    background:
                        linear-gradient(135deg, rgba(226, 198, 96, 0.08), transparent 45%),
                        repeating-linear-gradient(45deg, #1b2022 0 12px, #171b1d 12px 24px);
                    text-align: center;
                }

                .tutorial-modal__image-placeholder[hidden] {
                    display: none;
                }

                .tutorial-modal__image-placeholder-title {
                    font-size: 15px;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                }

                .tutorial-modal__image-path {
                    max-width: 100%;
                    color: #9e9878;
                    font-size: 10px;
                    overflow-wrap: anywhere;
                }

                .tutorial-modal__description {
                    min-height: 110px;
                    flex: 1 1 0;
                    margin-top: 12px;
                    padding: clamp(15px, 4vw, 22px);
                    color: #292414;
                    background: rgba(215, 202, 138, 0.31);
                    border: 1px solid rgba(127, 104, 48, 0.24);
                    border-radius: 8px;
                    font-size: clamp(13px, 3.8vw, 16px);
                    line-height: 1.85;
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                }

                .tutorial-modal__footer {
                    padding: 10px 12px 12px;
                    background: rgba(255, 250, 218, 0.5);
                    border-top: 1px solid rgba(104, 85, 38, 0.42);
                    flex-shrink: 0;
                }

                .tutorial-modal__navigation {
                    display: grid;
                    grid-template-columns: minmax(82px, 1fr) minmax(86px, auto) minmax(82px, 1fr);
                    align-items: center;
                    gap: 8px;
                }

                .tutorial-modal__nav-button,
                .tutorial-modal__close-bottom {
                    min-height: 44px;
                    color: #fff8d1;
                    background: linear-gradient(#46412b, #28271f);
                    border: 1px solid #8f7d42;
                    border-radius: 7px;
                    font: 700 13px/1.2 inherit;
                    cursor: pointer;
                    box-shadow: inset 0 1px rgba(255, 255, 255, 0.14);
                    -webkit-tap-highlight-color: transparent;
                }

                .tutorial-modal__nav-button:disabled {
                    color: rgba(255, 248, 209, 0.35);
                    background: #77715d;
                    border-color: #8c856e;
                    cursor: default;
                    box-shadow: none;
                }

                .tutorial-modal__progress-wrap {
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                }

                .tutorial-modal__dots {
                    max-width: 130px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    overflow-x: auto;
                    padding: 3px;
                    scrollbar-width: none;
                }

                .tutorial-modal__dots::-webkit-scrollbar {
                    display: none;
                }

                .tutorial-modal__dot {
                    width: 9px;
                    height: 9px;
                    flex: 0 0 9px;
                    padding: 0;
                    border: 0;
                    border-radius: 50%;
                    background: #a39a72;
                    cursor: pointer;
                }

                .tutorial-modal__dot.is-active {
                    width: 11px;
                    height: 11px;
                    flex-basis: 11px;
                    background: #52451e;
                    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.62);
                }

                .tutorial-modal__page-count {
                    color: #6b603c;
                    font-size: 10px;
                    line-height: 1;
                }

                .tutorial-modal__close-bottom {
                    width: 100%;
                    margin-top: 9px;
                    color: #2d2919;
                    background: rgba(255, 251, 222, 0.82);
                    border-color: #817344;
                }

                .tutorial-modal button:focus-visible {
                    outline: 3px solid #2a89ff;
                    outline-offset: 2px;
                }

                @media (min-width: 601px) {
                    .tutorial-modal__panel {
                        width: min(100%, var(--tutorial-modal-panel-width, 430px));
                    }
                }

                @media (hover: hover) {
                    .tutorial-modal__icon-close:hover,
                    .tutorial-modal__close-bottom:hover {
                        filter: brightness(1.08);
                    }
                    .tutorial-modal__nav-button:not(:disabled):hover {
                        filter: brightness(1.18);
                    }
                }

                @media (max-height: 580px) {
                    .tutorial-modal__header {
                        min-height: 56px;
                        padding-top: 7px;
                        padding-bottom: 7px;
                    }
                    .tutorial-modal__icon-close {
                        top: 8px;
                        width: 34px;
                        height: 34px;
                    }
                    .tutorial-modal__image-frame {
                        min-height: 150px;
                    }
                    .tutorial-modal__description {
                        min-height: 86px;
                        line-height: 1.65;
                    }
                    .tutorial-modal__nav-button,
                    .tutorial-modal__close-bottom {
                        min-height: 38px;
                    }
                }

                @media (prefers-reduced-motion: no-preference) {
                    .tutorial-modal:not([hidden]) .tutorial-modal__panel {
                        animation: tutorial-modal-enter 150ms ease-out;
                    }
                    @keyframes tutorial-modal-enter {
                        from { opacity: 0; transform: translateY(8px) scale(0.99); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                }
            `;
            document.head.appendChild(style);
        }
    };

    window.TUTORIAL_DATA = TUTORIAL_DATA;
    window.TutorialModal = TutorialModal.init();
})();
