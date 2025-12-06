/* database.js (敵スキル個性化・ステータス計算式調整版) */

const CONST = {
    SAVE_KEY: 'QoE_SaveData_v38_BalanceFix', // 前回と同じキー（変更なし）
    PARTS: ['武器', '盾', '頭', '体', '足'],
    ELEMENTS: ['火', '水', '風', '雷', '光', '闇', '混沌'],
    RARITY: ['N', 'R', 'SR', 'SSR', 'UR', 'EX'],
    
    GACHA_RATES: { N:0, R:50, SR:30, SSR:14, UR:5, EX:1 },
    SMITH_RATES: { 1: { R:80, SR:15, SSR:5 }, 10: { R:10, SR:30, SSR:40, UR:15, EX:5 } },
    POKER_ODDS: { ROYAL_FLUSH: 500, STRAIGHT_FLUSH: 100, FOUR_CARD: 30, FULL_HOUSE: 10, FLUSH: 8, STRAIGHT: 5, THREE_CARD: 3, TWO_PAIR: 2, JACKS_OR_BETTER: 1 },
    PLUS_RATES: { 3: 0.05, 2: 0.15, 1: 0.40 }, 
    
    MAX_LEVEL: 99,
    EXP_BASE: 100,
    EXP_GROWTH: 1.15,
    RARITY_EXP_MULT: { N:1.0, R:1.1, SR:1.2, SSR:1.3, UR:1.5, EX:2.0 }
};

const MAP_DATA = [
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWGGGGGGGGGGGGGFFFFFFGGGGGGGGWWWWWWWWWWWWWWW",
    "WWWWWWGGGGGGGGGGGGGGGFFFFFFGGGGGGGGGGWWWWWWWWWWWWW",
    "WWWWWGGGGGGGGGGGGGGGGFFFFFFGGGGGGGGGGGGWWWWWWWWWWW",
    "WWWWGGGGGGMMMGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWW",
    "WWWWGGGGGMMMMMGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWW",
    "WWWGGGGGGGGGGGGMGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWW",
    "WWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWW",
    "WWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWW",
    "WWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWW",
    "WWWWGGGGGGMMMGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWW",
    "WWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWW",
    "WWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWW",
    "WWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWWBBBWWWWWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWWBBBWWWWWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWWWGGGGGGGGGGGWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWGGGGGGGGGGGGGGGWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWWWW",
    "WWWWWWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWW",
    "WWWWWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWW",
    "WWWWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWW",
    "GGGGGGGGGGGGGGGGGGGGGIEKGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "WWWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWW",
    "WWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWW",
    "WWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWW",
    "WWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWW",
    "WWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
];

const DB = {
    SKILLS: [
        // --- 基本 ---
        {id:1, name:'こうげき', type:'物理', target:'単体', mp:0, rate:1.0, count:1, base:0, elm:null, desc:'通常攻撃'},
        {id:2, name:'ぼうぎょ', type:'特殊', target:'自分', mp:0, rate:0, count:0, base:0, elm:null, desc:'ダメージ軽減'},
        {id:9, name:'逃げる', type:'特殊', target:'自分', mp:0, rate:0, count:0, base:0, desc:'戦闘から離脱'},

        // --- 初級魔法 ---
        {id:10, name:'メラ', type:'魔法', target:'単体', mp:2, rate:1.2, count:1, base:10, elm:'火', desc:'小火球'},
        {id:11, name:'ヒャド', type:'魔法', target:'単体', mp:3, rate:1.2, count:1, base:12, elm:'水', desc:'氷の刃'},
        {id:12, name:'バギ', type:'魔法', target:'全体', mp:5, rate:0.8, count:1, base:15, elm:'風', desc:'真空の刃'},
        {id:13, name:'ライデイン', type:'魔法', target:'単体', mp:6, rate:1.5, count:1, base:20, elm:'雷', desc:'落雷'},
        {id:14, name:'ドルマ', type:'魔法', target:'単体', mp:4, rate:1.4, count:1, base:15, elm:'闇', desc:'闇の弾'},

        // --- 回復・補助 ---
        {id:20, name:'ホイミ', type:'回復', target:'単体', mp:3, rate:1.5, count:1, base:30, elm:null, desc:'小回復'},
        {id:21, name:'ベホイミ', type:'回復', target:'単体', mp:6, rate:2.5, count:1, base:80, elm:null, desc:'中回復'},
        {id:22, name:'ベホマラー', type:'回復', target:'全体', mp:12, rate:1.5, count:1, base:60, elm:null, desc:'全体回復'},
        {id:23, name:'ベホマ', type:'回復', target:'単体', mp:10, rate:0, count:1, base:999, fix:true, desc:'全回復'},
        {id:30, name:'ザオラル', type:'蘇生', target:'単体', mp:8, rate:0.5, count:1, base:0, elm:null, desc:'50%蘇生'},
        {id:31, name:'ザオリク', type:'蘇生', target:'単体', mp:20, rate:1.0, count:1, base:0, elm:null, desc:'100%蘇生'},

        // --- 物理スキル ---
        {id:40, name:'火炎斬り', type:'物理', target:'単体', mp:4, rate:1.3, count:1, base:5, elm:'火', desc:'炎の剣技'},
        {id:41, name:'はやぶさ斬り', type:'物理', target:'単体', mp:6, rate:0.7, count:2, base:0, elm:null, desc:'2回攻撃'},
        {id:42, name:'氷結斬り', type:'物理', target:'単体', mp:4, rate:1.3, count:1, base:5, elm:'水', desc:'氷の剣技'},
        {id:43, name:'雷鳴突き', type:'物理', target:'単体', mp:4, rate:1.3, count:1, base:5, elm:'雷', desc:'雷の槍技'},
        {id:44, name:'兜割り', type:'物理', target:'単体', mp:4, rate:1.2, count:1, base:5, buff:{def:0.8}, desc:'敵の守備を下げる'},

        // --- 強化・弱体 ---
        {id:50, name:'バイキルト', type:'強化', target:'単体', mp:8, rate:0, count:1, base:0, buff:{atk:1.5}, desc:'攻撃力アップ'},
        {id:51, name:'スカラ', type:'強化', target:'単体', mp:4, rate:0, count:1, base:0, buff:{def:1.5}, desc:'守備力アップ'},
        {id:52, name:'ピオリム', type:'強化', target:'全体', mp:6, rate:0, count:1, base:0, buff:{spd:1.3}, desc:'素早さアップ'},
        {id:60, name:'ルカニ', type:'弱体', target:'単体', mp:4, rate:0, count:1, base:0, buff:{def:0.7}, desc:'敵の守備ダウン'},
        {id:61, name:'ボミオス', type:'弱体', target:'全体', mp:6, rate:0, count:1, base:0, buff:{spd:0.7}, desc:'敵の素早さダウン'},

        // --- 中級・上級物理 ---
        {id:101, name:'強撃', type:'物理', target:'単体', mp:5, rate:1.8, count:1, base:10, desc:'力強い一撃'},
        {id:102, name:'渾身斬り', type:'物理', target:'単体', mp:10, rate:2.5, count:1, base:30, desc:'渾身の一撃'},
        {id:103, name:'ギガスラッシュ', type:'物理', target:'全体', mp:15, rate:2.0, count:1, base:50, elm:'光', desc:'光の剣技'},
        {id:104, name:'暗黒剣', type:'物理', target:'単体', mp:12, rate:2.2, count:1, base:40, elm:'闇', desc:'闇の剣技'},
        {id:201, name:'五月雨突き', type:'物理', target:'ランダム', mp:10, rate:0.6, count:4, base:0, desc:'4回攻撃'},
        {id:202, name:'爆裂拳', type:'物理', target:'ランダム', mp:12, rate:0.7, count:4, base:0, desc:'4回攻撃'},

        // --- 中級・上級魔法 ---
        {id:301, name:'メラミ', type:'魔法', target:'単体', mp:6, rate:1.8, count:1, base:40, elm:'火', desc:'中火球'},
        {id:302, name:'ベギラマ', type:'魔法', target:'全体', mp:10, rate:1.5, count:1, base:30, elm:'雷', desc:'雷の帯'},
        {id:303, name:'ヒャダルコ', type:'魔法', target:'全体', mp:10, rate:1.5, count:1, base:30, elm:'水', desc:'氷の波動'},
        {id:304, name:'バギマ', type:'魔法', target:'全体', mp:10, rate:1.5, count:1, base:30, elm:'風', desc:'真空の嵐'},
        {id:305, name:'メラゾーマ', type:'魔法', target:'単体', mp:15, rate:2.8, count:1, base:100, elm:'火', desc:'大火球'},
        {id:306, name:'イオナズン', type:'魔法', target:'全体', mp:25, rate:2.2, count:1, base:80, elm:'光', desc:'大爆発'},
        {id:307, name:'ドルモーア', type:'魔法', target:'単体', mp:15, rate:2.8, count:1, base:100, elm:'闇', desc:'闇の爆発'},

        // --- 最上級・EX ---
        {id:401, name:'ギガブレイク', type:'物理', target:'全体', mp:30, rate:2.8, count:1, base:100, elm:'雷', desc:'最強の剣技'},
        {id:402, name:'ゴッドハンド', type:'物理', target:'単体', mp:35, rate:3.5, count:1, base:150, elm:'光', desc:'神の拳'},
        {id:403, name:'フルケア', type:'回復', target:'単体', mp:40, rate:0, count:1, base:9999, fix:true, desc:'完全回復'},
        {id:404, name:'メテオ', type:'魔法', target:'全体', mp:50, rate:3.0, count:1, base:150, elm:'火', desc:'隕石落とし'},
        {id:405, name:'ジゴスパーク', type:'魔法', target:'全体', mp:45, rate:2.8, count:1, base:120, elm:'雷', desc:'地獄の雷'},
        {id:406, name:'マヒャデドス', type:'魔法', target:'全体', mp:45, rate:2.8, count:1, base:120, elm:'水', desc:'極大氷魔法'},
        {id:407, name:'メラガイアー', type:'魔法', target:'単体', mp:30, rate:4.0, count:1, base:200, elm:'火', desc:'極大火炎'},

        {id:408, name:'ギガデイン', type:'魔法', target:'全体', mp:60, rate:3.5, count:1, base:180, elm:'雷', desc:'極大雷呪文'},
        {id:409, name:'ギガクロスブレイク', type:'物理', target:'単体', mp:50, rate:2.5, count:2, base:100, elm:'雷', desc:'雷の2連撃'},
        {id:410, name:'シャイニング', type:'魔法', target:'全体', mp:70, rate:3.8, count:1, base:200, elm:'光', desc:'聖なる光'},
        {id:411, name:'ラグナブレード', type:'物理', target:'単体', mp:60, rate:5.5, count:1, base:300, elm:'混沌', desc:'混沌の一撃'},
        
        {id:500, name:'マダンテ', type:'魔法', target:'全体', mp:0, rate:10.0, count:1, base:0, desc:'全MPを消費し大爆発'},

        {id:901, name:'ジェネシス', type:'魔法', target:'全体', mp:100, rate:5.0, count:1, base:500, elm:'混沌', desc:'【EX】天地創造の光'},
        {id:902, name:'ラグナロク', type:'物理', target:'ランダム', mp:80, rate:3.0, count:5, base:50, elm:'闇', desc:'【EX】終焉の5連撃'},
        {id:903, name:'リザレクション', type:'蘇生', target:'全体', mp:200, rate:1.0, count:1, base:100, desc:'【EX】味方全員を完全蘇生'},
        {id:905, name:'やみのはどう', type:'弱体', target:'全体', mp:50, rate:0, count:1, base:0, buff:{atk:0.7, def:0.7, mag:0.7, spd:0.7}, desc:'全能力ダウン'},

        {id:999, name:'激しい炎', type:'特殊', target:'全体', mp:0, rate:0, count:1, base:80, fix:true, elm:'火', desc:'全体炎'}
    ],
    CHARACTERS: [
        {id:301, name:'アルス', job:'勇者', rarity:'N', hp:800, mp:300, atk:150, def:120, spd:100, mag:100, lbSkills:{50:42, 99:401}},
        // R～EXキャラはデータ量削減のため省略（既存のままでOK）
        // ※実際のファイルでは既存の定義を残してください
    ],
    ITEMS: [
        {id:1, name:'やくそう', type:'HP回復', val:100, desc:'HPを約100回復', target:'単体', price:10},
        {id:2, name:'上やくそう', type:'HP回復', val:300, desc:'HPを約300回復', target:'単体', price:50},
        {id:3, name:'魔法の小瓶', type:'MP回復', val:30, desc:'MPを約30回復', target:'単体', price:100},
        {id:4, name:'魔法の聖水', type:'MP回復', val:100, desc:'MPを約100回復', target:'単体', price:500},
        {id:5, name:'世界樹の葉', type:'蘇生', val:100, desc:'死んだ仲間を生き返らせる', target:'単体', price:1000},
        {id:99, name:'ちいさなメダル', type:'貴重品', val:0, desc:'世界各地に散らばるメダル', target:'なし', price:0}
    ],
    MONSTERS: [],
    EQUIPS: [],
    
    OPT_RULES: [
        {key:'atk', name:'攻撃', unit:'val', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:5,SR:10,SSR:20,UR:50,EX:80}, max:{N:4,R:9,SR:19,SSR:49,UR:100,EX:200}},
        {key:'def', name:'防御', unit:'val', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:5,SR:10,SSR:20,UR:50,EX:80}, max:{N:4,R:9,SR:19,SSR:49,UR:100,EX:200}},
        {key:'mag', name:'魔力', unit:'val', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:5,SR:10,SSR:20,UR:50,EX:80}, max:{N:4,R:9,SR:19,SSR:49,UR:100,EX:200}},
        {key:'hp', name:'HP', unit:'val', allowed:['N','R','SR','SSR','UR','EX'], min:{N:10,R:50,SR:100,SSR:300,UR:500,EX:1000}, max:{N:40,R:90,SR:290,SSR:490,UR:1000,EX:2500}},
        {key:'mp', name:'MP', unit:'val', allowed:['N','R','SR','SSR','UR','EX'], min:{N:5,R:10,SR:30,SSR:50,UR:100,EX:200}, max:{N:9,R:29,SR:49,SSR:99,UR:199,EX:500}},
        
        // ★修正: 素早さ(spd)の数値を上方修正
        {key:'spd', name:'速さ', unit:'val', allowed:['N','R','SR','SSR','UR','EX'], min:{N:5,R:10,SR:15,SSR:25,UR:50,EX:80}, max:{N:10,R:20,SR:35,SSR:50,UR:100,EX:150}},
        
        {key:'finDmg', name:'与ダメ', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:1,UR:3,EX:5}, max:{SSR:2,UR:5,EX:10}},
        {key:'finRed', name:'被ダメ', unit:'val', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:50}},
        
        {key:'elmAtk', elm:'火', name:'火攻', unit:'val', allowed:['SR','SSR','UR','EX'], min:{SR:5,SSR:10,UR:20,EX:40}, max:{SR:9,SSR:19,UR:39,EX:80}},
        {key:'elmAtk', elm:'水', name:'水攻', unit:'val', allowed:['SR','SSR','UR','EX'], min:{SR:5,SSR:10,UR:20,EX:40}, max:{SR:9,SSR:19,UR:39,EX:80}},
        {key:'elmAtk', elm:'風', name:'風攻', unit:'val', allowed:['SR','SSR','UR','EX'], min:{SR:5,SSR:10,UR:20,EX:40}, max:{SR:9,SSR:19,UR:39,EX:80}},
        {key:'elmAtk', elm:'雷', name:'雷攻', unit:'val', allowed:['SR','SSR','UR','EX'], min:{SR:5,SSR:10,UR:20,EX:40}, max:{SR:9,SSR:19,UR:39,EX:80}},
        {key:'elmAtk', elm:'光', name:'光攻', unit:'val', allowed:['SSR','UR','EX'], min:{SSR:15,UR:30,EX:60}, max:{SSR:29,UR:59,EX:120}},
        {key:'elmAtk', elm:'闇', name:'闇攻', unit:'val', allowed:['SSR','UR','EX'], min:{SSR:15,UR:30,EX:60}, max:{SSR:29,UR:59,EX:120}},

        {key:'elmRes', elm:'火', name:'火耐', unit:'val', allowed:['R','SR','SSR','UR','EX'], min:{R:5,SR:10,SSR:20,UR:40,EX:80}, max:{R:9,SR:19,SSR:39,UR:79,EX:150}},
        {key:'elmRes', elm:'水', name:'水耐', unit:'val', allowed:['R','SR','SSR','UR','EX'], min:{R:5,SR:10,SSR:20,UR:40,EX:80}, max:{R:9,SR:19,SSR:39,UR:79,EX:150}},
        {key:'elmRes', elm:'風', name:'風耐', unit:'val', allowed:['R','SR','SSR','UR','EX'], min:{R:5,SR:10,SSR:20,UR:40,EX:80}, max:{R:9,SR:19,SSR:39,UR:79,EX:150}},
        {key:'elmRes', elm:'雷', name:'雷耐', unit:'val', allowed:['R','SR','SSR','UR','EX'], min:{R:5,SR:10,SSR:20,UR:40,EX:80}, max:{R:9,SR:19,SSR:39,UR:79,EX:150}},
        {key:'elmRes', elm:'光', name:'光耐', unit:'val', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:19,UR:39,EX:80}},
        {key:'elmRes', elm:'闇', name:'闇耐', unit:'val', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:19,UR:39,EX:80}}
    ],

    SYNERGIES: [
        { key: 'spd', count: 3, name: '疾風怒濤', effect: 'doubleAction', desc: '50%で2回行動', color:'#f88' },
        { key: 'hp', count: 3, name: '吸血', effect: 'drain', desc: '与ダメの10%回復', color:'#f88' },
        { key: 'mag', count: 3, name: '魔力暴走', effect: 'magCrit', desc: '魔法がたまに会心', color:'#88f' }
    ],
    MEDAL_REWARDS: [
        { medals: 5, name: '上やくそう x3', type: 'item', id: 2, count: 3 },
        { medals: 10, name: '魔法の小瓶 x5', type: 'item', id: 3, count: 5 },
        { medals: 15, name: '世界樹の葉 x1', type: 'item', id: 5, count: 1 },
        { medals: 50, name: 'メタルキングの鎧', type: 'equip', equipId: 901, base: {name:'メタルキングの鎧', type:'体', rank:50, val:20000, data:{def:50, finRed:20}} },
        { medals: 60, name: 'メタルキングの盾', type: 'equip', equipId: 902, base: {name:'メタルキングの盾', type:'盾', rank:80, val:25000, data:{def:60, elmRes:{'火':10,'水':10,'風':10,'雷':10}}} },
        { medals: 70, name: 'メタルキングヘルム', type: 'equip', equipId: 903, base: {name:'メタルキングヘルム', type:'頭', rank:80, val:28000, data:{def:45, mp:50, elmRes:{'光':20,'闇':20}}} },
        { medals: 80, name: 'メタルキングの剣', type: 'equip', equipId: 904, base: {name:'メタルキングの剣', type:'武器', rank:90, val:40000, data:{atk:160, spd:15}} }
    ]
};

// データ自動生成
(() => {
    const TIERS = [
        { rank:1, name:'ボロの', mult:0.5 },
        { rank:5, name:'銅の', mult:1.0 },
        { rank:10, name:'鉄の', mult:1.5 },
        { rank:20, name:'鋼の', mult:2.5 },
        { rank:30, name:'白銀の', mult:4.0 },
        { rank:40, name:'黄金の', mult:6.0 },
        { rank:50, name:'プラチナ', mult:10.0 },
        { rank:60, name:'ミスリル', mult:15.0 },
        { rank:70, name:'オリハルコン', mult:22.0 },
        { rank:80, name:'アダマン', mult:30.0 },
        { rank:90, name:'英雄の', mult:45.0 },
        { rank:100, name:'神々の', mult:60.0 } 
    ];

    const EQUIP_TYPES = [
        { type:'武器', baseName:'剣', stat:'atk', baseVal:10 },
        { type:'武器', baseName:'斧', stat:'atk', baseVal:15, spdMod:-2 },
        { type:'武器', baseName:'短剣', stat:'atk', baseVal:8, spdMod:5 },
        { type:'盾', baseName:'盾', stat:'def', baseVal:5 },
        { type:'頭', baseName:'兜', stat:'def', baseVal:3 },
        { type:'体', baseName:'鎧', stat:'def', baseVal:8 },
        { type:'体', baseName:'ローブ', stat:'def', baseVal:5, magMod:5 },
        { type:'足', baseName:'ブーツ', stat:'spd', baseVal:5, defMod:2 }
    ];

    TIERS.forEach(tier => {
        EQUIP_TYPES.forEach((eq, idx) => {
            const data = {};
            data[eq.stat] = Math.floor(eq.baseVal * tier.mult);
            if(eq.spdMod) data.spd = Math.floor(eq.spdMod * (1 + tier.rank/20));
            if(eq.magMod) data.mag = Math.floor(eq.magMod * (1 + tier.rank/20));
            if(eq.defMod) data.def = Math.floor(eq.defMod * (1 + tier.rank/20));

            DB.EQUIPS.push({
                id: `eq_${tier.rank}_${idx}`,
                rank: tier.rank,
                name: `${tier.name}${eq.baseName}`,
                type: eq.type,
                val: tier.rank * 100,
                minF: tier.rank,
                data: data
            });
        });
    });

    const MONSTER_TYPES = [
        { name:'スライム', hp:300, atk:100, def:80, spd:80, mag:80, exp:10, gold:10 }, 
        { name:'ドラキー', hp:400, atk:120, def:90, spd:110, mag:90, exp:12, gold:12 },
        { name:'さまようよろい', hp:600, atk:150, def:100, spd:100, mag:80, exp:20, gold:20 },
        { name:'ゴースト', hp:850, atk:130, def:150, spd:90, mag:150, exp:25, gold:25 },
        { name:'オーク', hp:1000, atk:180, def:120, spd:80, mag:60, exp:50, gold:50 },
        { name:'キラーマシン', hp:1800, atk:200, def:200, spd:90, mag:100, exp:100, gold:100 },
        { name:'アークデーモン', hp:2100, atk:250, def:180, spd:120, mag:250, exp:300, gold:300 },
        { name:'ドラゴン', hp:2500, atk:350, def:250, spd:150, mag:200, exp:500, gold:500 }
    ];

    // ★追加: 雑魚敵のランク別スキル割り当て (種類ごと)
    const MONSTER_SKILL_SETS = {
        'スライム': { low:[1,1], mid:[1,10], high:[1,305] },        // 通常->メラ->メラゾーマ
        'ドラキー': { low:[1,14], mid:[14,61], high:[307,61] },     // ドルマ->ボミオス->ドルモーア
        'さまようよろい': { low:[1,40], mid:[40,44], high:[44,101] }, // 火炎斬り->兜割り->強撃
        'ゴースト': { low:[1,10], mid:[10,60], high:[301,60] },     // メラ->ルカニ->メラミ
        'オーク': { low:[1,1], mid:[1,44], high:[44,102] },         // 通常->兜割り->渾身
        'キラーマシン': { low:[1,41], mid:[41,202], high:[41,401] },// はやぶさ->爆裂->ギガブレ
        'アークデーモン': { low:[1,302], mid:[302,306], high:[306,404] }, // ベギラマ->イオナズン->メテオ
        'ドラゴン': { low:[1,999], mid:[1,999,101], high:[999,409] } // 炎->強撃->ギガクロス
    };

    for(let r=1; r<=100; r++) {
        const typeIdx = Math.min(MONSTER_TYPES.length-1, Math.floor((r-1)/12)); 
        const base = MONSTER_TYPES[typeIdx];
        
        const scale_factor = 0.45; 
        const hp_exp = 1.2; // ★修正: HP成長率をマイルドに

        const scale = 1.0 + (r * scale_factor); 
        
        let prefix = "";
        if(r % 10 >= 5) prefix = "強・";
        if(r > 50) prefix = "真・";
        if(r > 80) prefix = "極・";

        // ★修正: ランクと種類に応じたスキル割り当て
        let myActs = [1];
        const skillSet = MONSTER_SKILL_SETS[base.name];
        if (skillSet) {
            if (r < 30) myActs = skillSet.low;
            else if (r < 70) myActs = skillSet.mid;
            else myActs = skillSet.high;
        }

        DB.MONSTERS.push({
            id: r,
            rank: r,
            minF: r,
            name: `${prefix}${base.name} Lv${r}`,
            hp: Math.floor(base.hp * Math.pow(scale, hp_exp)), 
            mp: 50 + r * 10,
            atk: Math.floor(base.atk * scale),
            def: Math.floor(base.def * scale),
            // ★修正: 素早さとGoldを基礎ステータス依存に変更
            spd: Math.floor(base.spd * scale),
            mag: Math.floor(base.mag * scale),
            gold: Math.floor(base.gold * scale * 1.5),
            exp: Math.floor(base.exp * scale * 1.5),
            acts: myActs,
            drop: null
        });
    }

    // --- メタル系 ---
    // メタルスライム (Rank 5-20 相当)
    DB.MONSTERS.push({
        id:201, rank:10, minF:5, name:'メタルスライム',
        hp:4, mp:999, atk:50, def:999, spd:999, mag:50,
        exp:1000, gold:50, 
        acts:[1, 10, 9], // 攻撃, メラ, 逃げる
        elmRes:{'火':100,'水':100,'風':100,'雷':100,'光':100,'闇':100}
    });

    // はぐれメタル (Rank 30-50 相当)
    DB.MONSTERS.push({
        id:202, rank:40, minF:20, name:'はぐれメタル',
        hp:8, mp:999, atk:150, def:999, spd:999, mag:100,
        exp:10000, gold:200, 
        acts:[1, 302, 9], // 攻撃, ベギラマ, 逃げる
        elmRes:{'火':100,'水':100,'風':100,'雷':100,'光':100,'闇':100}
    });

    // メタルキング (Rank 70-100 相当)
    DB.MONSTERS.push({
        id:203, rank:80, minF:50, name:'メタルキング',
        hp:20, mp:999, atk:400, def:999, spd:999, mag:300,
        exp:30000, gold:1000, 
        acts:[1, 306, 9], // 攻撃, イオナズン, 逃げる
        elmRes:{'火':100,'水':100,'風':100,'雷':100,'光':100,'闇':100}
    });
    
    // プラチナキング (Rank 100- 相当)
    DB.MONSTERS.push({
        id:204, rank:100, minF:101, name:'プラチナキング',
        hp:50, mp:999, atk:1000, def:999, spd:999, mag:500,
        exp:100000, gold:5000, 
        acts:[1, 406, 407, 9], // 攻撃, マヒャデドス, メラガイアー, 逃げる
        elmRes:{'火':100,'水':100,'風':100,'雷':100,'光':100,'闇':100}
    });

    // --- ボス定義 ---

    // 40階まで: デュラン (物理主体)
    DB.MONSTERS.push({
        id: 1010, rank: 40, minF: 999, name: 'デュラン',
        hp: 10000, mp: 100, atk: 600, def: 400, spd: 150, mag: 100,
        exp: 20000, gold: 5000,
        acts: [1, 40, 41, 42, 43, 44, 101, 102, 104], // 初級〜中級物理
        actCount: 1
    });

    // 80階まで: ムドー (魔法主体)
    DB.MONSTERS.push({
        id: 1020, rank: 80, minF: 999, name: 'ムドー',
        hp: 25000, mp: 500, atk: 300, def: 500, spd: 200, mag: 800,
        exp: 40000, gold: 10000,
        acts: [10, 11, 12, 13, 14, 301, 302, 303, 304, 305, 306, 307], // 初級〜上級魔法
        actCount: 1
    });

    // 90階: 悪霊の神々 (3体同時出現用)
    // アトラス (物理)
    DB.MONSTERS.push({
        id: 1030, rank: 90, minF: 999, name: 'アトラス',
        hp: 45000, mp: 50, atk: 1200, def: 400, spd: 250, mag: 50,
        exp: 25000, gold: 5000,
        acts: [1, 101, 102, 44], 
        actCount: 1
    });
    // バズズ (魔法・デバフ)
    DB.MONSTERS.push({
        id: 1031, rank: 90, minF: 999, name: 'バズズ',
        hp: 27000, mp: 300, atk: 400, def: 300, spd: 400, mag: 700,
        exp: 25000, gold: 5000,
        acts: [13, 302, 306, 500, 30, 60, 61], 
        actCount: 1
    });
    // ベリアル (バランス・回復)
    DB.MONSTERS.push({
        id: 1032, rank: 90, minF: 999, name: 'ベリアル',
        hp: 32000, mp: 300, atk: 800, def: 500, spd: 300, mag: 500,
        exp: 25000, gold: 5000,
        acts: [1, 40, 305, 306, 22, 50], 
        actCount: 1
    });

    // 100階: シドー (破壊神・2回行動)
    DB.MONSTERS.push({
        id: 1040, rank: 100, minF: 999, name: 'シドー',
        hp: 100000, mp: 999, atk: 2000, def: 1000, spd: 500, mag: 1000,
        exp: 200000, gold: 50000,
        acts: [1, 103, 404, 407, 999, 23, 60], // ギガスラ, メテオ, メラガイアー, 激しい炎, ベホマ, ルカニ
        actCount: 2 // 2回行動
    });

    // 101階以降: レグナード (竜神・凶悪・2回行動)
    DB.MONSTERS.push({
        id: 1000, rank: 100, minF: 999, name: 'レグナード', 
        hp: 150000, mp: 9999, atk: 3000, def: 2000, spd: 800, mag: 1500, 
        exp: 500000, gold: 100000, 
        acts: [1, 401, 402, 405, 406, 901, 902, 905, 999], // ギガブレ, ゴッド, ジゴスパ, マヒャデ, ジェネシス, ラグナ, やみのはどう
        actCount: 2 // 2回行動
    });

})();

// 初期データ (1人パーティに変更)
const INITIAL_DATA_TEMPLATE = {
    gold: 5000, gems: 100000,
    items: { 1: 10, 2: 5, 99: 100 }, 
    inventory: [], 
    location: { x: 23, y: 60 },
    progress: { floor: 0 },
    blacksmith: { level: 1, exp: 0 },
    dungeon: { maxFloor: 0, tryCount: 0, map: null, width: 30, height: 30 },
    book: { monsters: [] },
    battle: { active: false },
    party: ['p1', null, null, null], 
    characters: [
        {uid:'p1', isHero:true, charId:301, name:'アルス', job:'勇者', rarity:'N', level:1, hp:800, mp:300, atk:150, def:120, spd:100, mag:100, limitBreak:0, equips:{}, alloc:{}}
    ]
};
