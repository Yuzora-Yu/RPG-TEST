/* database.js */

const CONST = {
    SAVE_KEY: 'QoE_SaveData_v25_FullParty', // キー更新
    PARTS: ['武器', '盾', '頭', '体', '足'],
    ELEMENTS: ['火', '水', '風', '雷', '光', '闇', '混沌'],
    RARITY: ['R', 'SR', 'SSR', 'UR', 'EX'],
    GACHA_RATES: { R:50, SR:30, SSR:15, UR:4.9, EX:0.1 },
    SMITH_RATES: { 1: { R:80, SR:15, SSR:5 }, 10: { R:10, SR:30, SSR:40, UR:15, EX:5 } },
    POKER_ODDS: { ROYAL_FLUSH: 500, STRAIGHT_FLUSH: 100, FOUR_CARD: 30, FULL_HOUSE: 10, FLUSH: 8, STRAIGHT: 5, THREE_CARD: 3, TWO_PAIR: 2, JACKS_OR_BETTER: 1 }
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
        {id:1, name:'こうげき', type:'物理', target:'単体', mp:0, rate:1.0, count:1, base:0, elm:null, desc:'通常攻撃'},
        {id:10, name:'メラ', type:'魔法', target:'単体', mp:2, rate:1.5, count:1, base:20, elm:'火', desc:'小火球'},
        {id:11, name:'ヒャド', type:'魔法', target:'単体', mp:3, rate:1.5, count:1, base:25, elm:'水', desc:'氷の刃'},
        {id:12, name:'バギ', type:'魔法', target:'全体', mp:5, rate:0.8, count:1, base:30, elm:'風', desc:'真空の刃'},
        {id:13, name:'ライデイン', type:'魔法', target:'単体', mp:8, rate:2.0, count:1, base:50, elm:'雷', desc:'落雷'},
        {id:20, name:'ホイミ', type:'回復', target:'単体', mp:3, rate:1.5, count:1, base:30, elm:null, desc:'小回復'},
        {id:21, name:'ベホイミ', type:'回復', target:'単体', mp:6, rate:2.5, count:1, base:80, elm:null, desc:'中回復'},
        {id:22, name:'ベホマラー', type:'回復', target:'全体', mp:12, rate:1.5, count:1, base:60, elm:null, desc:'全体回復'},
        {id:30, name:'ザオラル', type:'蘇生', target:'単体', mp:8, rate:0.5, count:1, base:0, elm:null, desc:'50%蘇生'},
        {id:40, name:'火炎斬り', type:'物理', target:'単体', mp:4, rate:1.5, count:1, base:10, elm:'火', desc:'炎の剣技'},
        {id:41, name:'はやぶさ斬り', type:'物理', target:'単体', mp:6, rate:0.75, count:2, base:0, elm:null, desc:'2回攻撃'},
        {id:42, name:'ギガスラッシュ', type:'物理', target:'全体', mp:15, rate:2.5, count:1, base:100, elm:'光', desc:'光の剣技'},
        {id:50, name:'バイキルト', type:'強化', target:'単体', mp:6, rate:0, count:1, base:0, buff:{atk:1.5}, desc:'攻撃増'},
        {id:101, name:'強撃', type:'物理', target:'単体', mp:5, rate:2.0, count:1, base:10, desc:'力強い一撃'},
        {id:102, name:'癒しの風', type:'回復', target:'全体', mp:15, rate:1.0, count:1, base:50, desc:'全体小回復'},
        {id:201, name:'五月雨突き', type:'物理', target:'ランダム', mp:10, rate:0.8, count:4, base:0, desc:'4回攻撃'},
        {id:202, name:'ベギラマ', type:'魔法', target:'全体', mp:12, rate:1.5, count:1, base:40, elm:'雷', desc:'雷の帯'},
        {id:301, name:'ギガブレイク', type:'物理', target:'全体', mp:30, rate:4.0, count:1, base:200, elm:'雷', desc:'最強の剣技'},
        {id:401, name:'ゴッドハンド', type:'物理', target:'単体', mp:30, rate:5.0, count:1, base:200, elm:'光', desc:'神の拳'},
        {id:402, name:'メテオ', type:'魔法', target:'全体', mp:50, rate:4.0, count:1, base:300, elm:'火', desc:'隕石落とし'},
        {id:403, name:'フルケア', type:'回復', target:'単体', mp:40, rate:0, count:1, base:9999, fix:true, desc:'完全回復'},
        {id:901, name:'ジェネシス', type:'魔法', target:'全体', mp:100, rate:10.0, count:1, base:1000, elm:'混沌', desc:'【EX】天地創造の光'},
        {id:902, name:'ラグナロク', type:'物理', target:'全体', mp:80, rate:5.0, count:5, base:100, elm:'闇', desc:'【EX】終焉の5連撃'},
        {id:903, name:'リザレクション', type:'蘇生', target:'全体', mp:200, rate:1.0, count:1, base:100, desc:'【EX】味方全員を完全蘇生'},
        {id:999, name:'激しい炎', type:'特殊', target:'全体', mp:0, rate:0, count:1, base:50, fix:true, elm:'火', desc:'全体炎'}
    ],
    CHARACTERS: [
        {id:101, name:'戦士ジョン', job:'戦士', rarity:'R', hp:150, mp:20, atk:40, def:30, spd:20, mag:10, lbSkills:{50:101, 99:201}},
        {id:102, name:'僧侶マリー', job:'僧侶', rarity:'R', hp:120, mp:50, atk:20, def:20, spd:25, mag:40, lbSkills:{50:20, 99:102}},
        {id:201, name:'魔法剣士アラン', job:'魔法剣士', rarity:'SR', hp:200, mp:60, atk:50, def:40, spd:35, mag:50, lbSkills:{50:202, 99:42}},
        {id:202, name:'賢者ソフィア', job:'賢者', rarity:'SR', hp:180, mp:100, atk:30, def:30, spd:30, mag:80, lbSkills:{50:102, 99:22}},
        {id:301, name:'勇者アルス', job:'勇者', rarity:'SSR', hp:300, mp:100, atk:80, def:60, spd:50, mag:50, lbSkills:{50:42, 99:401}},
        {id:302, name:'竜騎士カイン', job:'竜騎士', rarity:'SSR', hp:350, mp:50, atk:90, def:70, spd:60, mag:20, lbSkills:{50:201, 99:402}},
        {id:401, name:'聖女ジャンヌ', job:'聖女', rarity:'UR', hp:500, mp:300, atk:50, def:80, spd:70, mag:150, lbSkills:{50:22, 99:403}},
        {id:402, name:'魔王ギル', job:'魔王', rarity:'UR', hp:600, mp:200, atk:150, def:100, spd:40, mag:120, lbSkills:{50:402, 99:901}},
        {id:501, name:'創造神ゼノン', job:'神', rarity:'EX', hp:9999, mp:999, atk:999, def:999, spd:999, mag:999, lbSkills:{50:901, 99:903}}
    ],
    ITEMS: [
        {id:1, name:'やくそう', type:'HP回復', val:100, desc:'HPを約100回復', target:'単体', price:10},
        {id:2, name:'上やくそう', type:'HP回復', val:300, desc:'HPを約300回復', target:'単体', price:50},
        {id:3, name:'魔法の小瓶', type:'MP回復', val:30, desc:'MPを約30回復', target:'単体', price:100},
        {id:4, name:'魔法の聖水', type:'MP回復', val:100, desc:'MPを約100回復', target:'単体', price:500},
        {id:5, name:'世界樹の葉', type:'蘇生', val:100, desc:'死んだ仲間を生き返らせる', target:'単体', price:1000},
        {id:99, name:'ちいさなメダル', type:'貴重品', val:0, desc:'世界各地に散らばるメダル', target:'なし', price:0}
    ],
    MONSTERS: [
        {id:1, name:'スライム', hp:40, mp:0, atk:20, def:5, spd:8, mag:5, exp:10, gold:10, acts:[1], minF:0, drop:1},
        {id:2, name:'ドラキー', hp:55, mp:10, atk:25, def:8, spd:15, mag:10, exp:15, gold:15, acts:[1,10], minF:0, drop:1},
        {id:3, name:'ゴースト', hp:40, mp:20, atk:18, def:30, spd:15, mag:20, exp:12, gold:15, acts:[1,10], minF:0, drop:3},
        {id:10, name:'ドラゴン', hp:500, mp:50, atk:80, def:60, spd:20, mag:20, exp:500, gold:200, acts:[1,100], minF:5, drop:2},
        {id:100, name:'ダンジョンボス', hp:1000, mp:100, atk:100, def:80, spd:20, mag:30, exp:2000, gold:500, acts:[1,100], minF:999, drop:3}
    ],
    EQUIPS: [
        {id:1, name:'銅の剣', type:'武器', val:100, minF:0, data:{atk:10}},
        {id:2, name:'鉄の剣', type:'武器', val:500, minF:5, data:{atk:25}},
        {id:3, name:'炎の剣', type:'武器', val:2000, minF:15, data:{atk:45, elmAtk:{'火':30}}},
        {id:4, name:'ひかりのつるぎ', type:'武器', val:10000, minF:40, data:{atk:120, spd:20}},
        {id:11, name:'皮の盾', type:'盾', val:100, minF:0, data:{def:5}},
        {id:12, name:'鉄の盾', type:'盾', val:800, minF:5, data:{def:15}},
        {id:13, name:'魔法の盾', type:'盾', val:2000, minF:20, data:{def:12, finRed:5}},
        {id:21, name:'布の服', type:'体', val:50, minF:0, data:{def:5}},
        {id:22, name:'皮の鎧', type:'体', val:300, minF:5, data:{def:12}},
        {id:23, name:'鉄の鎧', type:'体', val:1000, minF:10, data:{def:25}},
        {id:24, name:'魔法のローブ', type:'体', val:2500, minF:20, data:{def:20, mag:20}},
        {id:31, name:'皮の帽子', type:'頭', val:100, minF:0, data:{def:3}},
        {id:41, name:'革の靴', type:'足', val:100, minF:0, data:{def:2, spd:5}}
    ],
    OPT_RULES: [
        {key:'atk', name:'攻撃', unit:'val', allowed:['R','SR','SSR','UR'], min:{R:1,SR:6,SSR:11,UR:21}, max:{R:5,SR:10,SSR:20,UR:50}},
        {key:'def', name:'防御', unit:'val', allowed:['R','SR','SSR','UR'], min:{R:1,SR:6,SSR:11,UR:21}, max:{R:5,SR:10,SSR:20,UR:50}},
        {key:'hp', name:'HP', unit:'val', allowed:['R','SR','SSR','UR'], min:{R:10,SR:50,SSR:100,UR:300}, max:{R:40,SR:90,SSR:290,UR:500}},
        {key:'spd', name:'素早さ', unit:'val', allowed:['R','SR','SSR','UR'], min:{R:1,SR:3,SSR:6,UR:11}, max:{R:2,SR:5,SSR:10,UR:20}},
        {key:'finDmg', name:'与ダメ', unit:'%', allowed:['UR','EX'], min:{UR:1,EX:5}, max:{UR:4,EX:10}},
        {key:'elmAtk', elm:'火', name:'火攻', unit:'val', allowed:['UR','EX'], min:{UR:5,EX:15}, max:{UR:10,EX:30}},
        {key:'elmAtk', elm:'雷', name:'雷攻', unit:'val', allowed:['UR','EX'], min:{UR:5,EX:15}, max:{UR:10,EX:30}}
    ],
    SYNERGIES: [
        { key: 'spd', count: 3, name: '疾風怒濤', effect: 'doubleAction', desc: '50%で2回行動', color:'#f88' },
        { key: 'hp', count: 3, name: '吸血', effect: 'drain', desc: '与ダメの10%回復', color:'#f88' }
    ],
    MEDAL_REWARDS: [
        { medals: 5, name: '上やくそう x3', type: 'item', id: 2, count: 3 },
        { medals: 10, name: '魔法の小瓶 x5', type: 'item', id: 3, count: 5 },
        { medals: 20, name: 'メタルキングの剣', type: 'equip', equipId: 900, base: {name:'メタキン剣', type:'武器', val:10000, data:{atk:130, finDmg:20}} }, 
        { medals: 50, name: '神秘の鎧', type: 'equip', equipId: 901, base: {name:'神秘の鎧', type:'体', val:20000, data:{def:50, finRed:20}} }
    ]
};

// ★修正: 初期パーティを4人に設定
const INITIAL_DATA_TEMPLATE = {
    gold: 5000, gems: 1000000,
    items: { 1: 10, 2: 5, 99: 10 }, 
    inventory: [], 
    location: { x: 23, y: 60 },
    progress: { floor: 0 },
    blacksmith: { level: 1, exp: 0 },
    dungeon: { maxFloor: 0, tryCount: 0 },
    book: { monsters: [] },
    battle: { active: false },
    // 4人パーティ (ID: p1, p2, p3, p4)
    party: ['p1', 'p2', 'p3', 'p4'],
    characters: [
        {uid:'p1', isHero:true, charId:301, name:'アルス', job:'勇者', rarity:'SSR', level:10, hp:200, mp:50, atk:40, def:30, spd:30, mag:20, limitBreak:0, equips:{}, alloc:{}},
        {uid:'p2', charId:101, name:'ジョン', job:'戦士', rarity:'R', level:8, hp:180, mp:20, atk:50, def:40, spd:20, mag:5, limitBreak:0, equips:{}},
        {uid:'p3', charId:201, name:'アラン', job:'魔法剣士', rarity:'SR', level:8, hp:160, mp:60, atk:40, def:30, spd:35, mag:40, limitBreak:0, equips:{}},
        {uid:'p4', charId:102, name:'マリー', job:'僧侶', rarity:'R', level:8, hp:140, mp:80, atk:20, def:20, spd:25, mag:50, limitBreak:0, equips:{}}
    ]
};
