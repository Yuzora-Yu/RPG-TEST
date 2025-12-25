/* database.js (装備システム独立化・クリーンアップ版) */

const CONST = {
    SAVE_KEY: 'QoE_SaveData_v38_BalanceFix', 
    PARTS: ['武器', '盾', '頭', '体', '足'],
    ELEMENTS: ['火', '水', '風', '雷', '光', '闇', '混沌'],
    RARITY: ['N', 'R', 'SR', 'SSR', 'UR', 'EX'],
	
    GACHA_RATES: { N:0, R:46.5, SR:32, SSR:18, UR:3, EX:0.5 },
    SMITH_RATES: { 1: { R:80, SR:15, SSR:5 }, 10: { R:10, SR:30, SSR:40, UR:15, EX:5 } },
    POKER_ODDS: { ROYAL_FLUSH: 500, STRAIGHT_FLUSH: 100, FOUR_CARD: 30, FULL_HOUSE: 10, FLUSH: 8, STRAIGHT: 5, THREE_CARD: 3, TWO_PAIR: 2, JACKS_OR_BETTER: 1 },
    PLUS_RATES: { 3: 0.10, 2: 0.30, 1: 0.60 }, 
    
    MAX_LEVEL: 100,
    EXP_BASE: 100,
    EXP_GROWTH: 1.08,
    RARITY_EXP_MULT: { N:1.0, R:1.1, SR:1.2, SSR:1.3, UR:1.5, EX:2.0 },
	
    SKILL_TREES: {
        ATK: {
            name: '攻撃強化',
            steps: [
                { desc: '物理攻撃力 +5%' },
                { desc: '物理攻撃力 +10%' },
                { desc: '物理攻撃力 +15% / 渾身斬り(102)習得', skillId: 102 },
                { desc: '物理攻撃力 +20% / 超はやぶさ斬り(108)習得', skillId: 108 },
                { desc: '物理攻撃力 +25% / 物理スキル使用時20％で防御無視', passive: 'atkIgnoreDef' }
            ],
            costs: [5, 12, 22, 35, 50]
        },
        MAG: {
            name: '魔力強化',
            steps: [
                { desc: '魔法攻撃力 +5%' },
                { desc: '魔法攻撃力 +10%' },
                { desc: '魔法攻撃力 +15% / ベギラマ(302)習得', skillId: 302 },
                { desc: '魔法攻撃力 +20% / メラゾーマ(305)習得', skillId: 305 },
                { desc: '魔法攻撃力 +25% / 魔法スキル使用時20％でダメージ2倍', passive: 'magCrit' }
            ],
            costs: [5, 12, 22, 35, 50]
        },
        SPD: {
            name: '素早さ強化',
            steps: [
                { desc: '素早さ +5%' },
                { desc: '素早さ +10%' },
                { desc: '素早さ +15% / 疾風突き(49)習得', skillId: 49 },
                { desc: '素早さ +20% / 戦闘時20%で最速行動', passive: 'fastestAction' }, 
                { desc: '素早さ +25% / 戦闘時20%で2回行動', passive: 'doubleAction' } 
            ],
            costs: [5, 12, 22, 35, 50]
        },
        HP: {
            name: '生命力強化',
            steps: [
                { desc: '最大HP +10%' },
                { desc: '最大HP +15%' },
                { desc: '最大HP +20% / ハッスルダンス(22)習得', skillId: 22 },
                { desc: '最大HP +25% / ザオラル(30)習得', skillId: 30 },
                { desc: '最大HP +30% / 毎ターン終了時HP5％回復', passive: 'hpRegen' }
            ],
            costs: [5, 12, 22, 35, 50]
        },
        MP: {
            name: '防御・精神力強化',
            steps: [
                { desc: '最大MP・防御力 +5%' },
                { desc: '最大MP・防御力 +10%' },
                { desc: '最大MP・防御力 +15% / 無念無想(81)習得', skillId: 81 },
                { desc: '最大MP・防御力 +20% / マジックバリア(53)習得', skillId: 53 },
                { desc: '最大MP・防御力 +25% / 被ダメージ軽減 +10%', passive: 'finRed10' }
            ],
            costs: [5, 12, 22, 35, 50]
       }
    }
};

const MAP_DATA = [
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWWWW",
    "WWWWWWWWGGGGGGGLLLLMGGGGGGGGGGGGGGGGGGWWWWWWWWWWWW",
    "WWWWWWGGGGGGLLLLMMMMMMMGGGGGGGGGGGGGGGGGWWWWWWWWWW",
    "WWWWWGGGGLLLLMMMMMMMMMMMMMGGGGGGGGGGGGGGGGWWWWWWWW",
    "WWWWGGGGGLLLMMMMMMMMMMMMMMMMGGGGGGGGGGGGGGGWWWWWWW",
    "WWWWGGGGLLMMMMMMMMMMMMMMMMMMMMGGGGGGGGGGGGGGWWWWWW",
    "WWWGGGGGLLMMMMMMMMMMMMMMMMMMMMGGGGGGGGGGGGGGWWWWWW",
    "WWWGGGGGLLLMMMMMMMMMMMMMMMMMMMGMGGGGGGGGGGGGWWWWWW",
    "WWGGGGGGGGLLLLMMMMMMMMMMMMMMMMMMGGGGGGGGGGGGWWWWWW",
    "WWGGGFFGGGGGGLLLLLMMMMMMMMMMMMMMMGGGGGGGGGGGWWWWWW",
    "WGGGGFFFGGGGGGGGGGLLLLLLLLMMMMMMLLGGGGGGGGGGGWWWWW",
    "WGGGFFFFFGGGGGGGGGGGGGGGGLLLLLLLLLGGGGGGGGGGGWWWWW",
    "WGGGFFFFFFGGGGGGGGGGGGGGGGGGGGLLLLGGGGGGGGGGGGWWWW",
    "WWGGFFFFFFFGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWW",
    "WWGGGFFFFFFFGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWW",
    "WWWGGGFFFFFFFFGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWW",
    "WWWWGGGFFFFFFFFFGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWW",
    "WWWWWWGGFFFFFFFFFFGGGGGGGGGGGGGGGGGGLLGGGGGGGGWWWW",
    "WWWWWWWGGGFFFFFFFFFGGGGGGGGGGGGGGGGLLLGGGGGGGGWWWW",
    "WWWWWWWWGGGGFFFFFFFFFGGGGGGGGGGGGGGLLLGGGGGGGGWWWW",
    "WWWWWWWWWWGGGFFFFFFFFGGGGGGGGGGGGGGLLGGGGGGGGGWWWW",
    "WWWWGGWWWWWWGGGGFFFFFGGGGGGGGGGGGGGLGGGGGGGGGWWWWW",
    "WWWWWGGGWWWWWGGGGGFFGGGGGGGGGGGGGGGGGGGGGGGWWWWWWW",
    "WWWWWWGGGWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWW",
    "GGGGGGGGGGGGFFFGGGGGGIEKGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "WWWWWWWGGGGGGFFFFGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWW",
    "WWWWWWWWGGGGGGFFFFGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWW",
    "WWWWWWWWWWGGGGGFFGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWW",
    "WWWWWWWWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWW",
    "WWWWWWWWWWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
];

const DB = {
    SKILLS: window.SKILLS_DATA || [],
    ITEMS: window.ITEMS_DATA || [],
    CHARACTERS: window.CHARACTERS_DATA || [],
    MONSTERS: window.MONSTERS_DATA || [],
    // 独立したマスタ(equips.js)を参照するように変更
    EQUIPS: window.EQUIP_MASTER || [],

    OPT_RULES: [
        {key:'atk', name:'攻撃', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:5,UR:8,EX:12}, max:{N:2,R:3,SR:6,SSR:10,UR:15,EX:25}},
        {key:'def', name:'防御', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:5,UR:8,EX:12}, max:{N:2,R:3,SR:6,SSR:10,UR:15,EX:25}},
        {key:'mag', name:'魔力', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:5,UR:8,EX:12}, max:{N:2,R:3,SR:6,SSR:10,UR:15,EX:25}},
        {key:'spd', name:'速さ', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:5,UR:8,EX:12}, max:{N:2,R:3,SR:6,SSR:10,UR:15,EX:25}},
        {key:'hp', name:'HP', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:5,UR:8,EX:12}, max:{N:3,R:5,SR:8,SSR:12,UR:18,EX:30}},
        {key:'mp', name:'MP', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:5,UR:8,EX:12}, max:{N:3,R:5,SR:8,SSR:12,UR:18,EX:30}},
        {key:'finDmg', name:'与ダメ', unit:'%', allowed:['UR','EX'], min:{UR:10,EX:20}, max:{UR:20,EX:30}},
        {key:'finRed', name:'被ダメ', unit:'%', allowed:['UR','EX'], min:{UR:3,EX:5}, max:{UR:6,EX:10}},
        {key:'elmAtk', elm:'火', name:'火攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},
        {key:'elmAtk', elm:'水', name:'水攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},
        {key:'elmAtk', elm:'風', name:'風攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},
        {key:'elmAtk', elm:'雷', name:'雷攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},
        {key:'elmAtk', elm:'光', name:'光攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},
        {key:'elmAtk', elm:'闇', name:'闇攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},
        {key:'elmAtk', elm:'混沌', name:'混沌攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},
        {key:'elmRes', elm:'火', name:'火耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
        {key:'elmRes', elm:'水', name:'水耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
        {key:'elmRes', elm:'風', name:'風耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
        {key:'elmRes', elm:'雷', name:'雷耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
        {key:'elmRes', elm:'光', name:'光耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
        {key:'elmRes', elm:'闇', name:'闇耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
        {key:'elmRes', elm:'混沌', name:'混沌耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
        {key:'attack_Fear', name:'攻撃時怯え', unit:'%', allowed:['R','SR','SSR','UR','EX'], min:{R:1,SR:2,SSR:3,UR:4,EX:5}, max:{R:1,SR:2,SSR:3,UR:4,EX:5}},
        {key:'attack_Poison', name:'攻撃時毒', unit:'%', allowed:['R','SR','SSR','UR','EX'], min:{R:1,SR:2,SSR:3,UR:4,EX:5}, max:{R:1,SR:2,SSR:3,UR:4,EX:5}},
        {key:'resists_Debuff', name:'弱体ガード', unit:'%', allowed:['R','SR','SSR','UR','EX'], min:{R:5,SR:11,SSR:21,UR:31,EX:50}, max:{R:10,SR:20,SSR:30,UR:40,EX:50}},
        {key:'resists_Fear', name:'怯えガード', unit:'%', allowed:['R','SR','SSR','UR','EX'], min:{R:5,SR:11,SSR:21,UR:31,EX:50}, max:{R:10,SR:20,SSR:30,UR:40,EX:50}},
        {key:'resists_Poison', name:'毒ガード', unit:'%', allowed:['R','SR','SSR','UR','EX'], min:{R:5,SR:11,SSR:21,UR:31,EX:50}, max:{R:10,SR:20,SSR:30,UR:40,EX:50}},
        {key:'resists_SkillSeal', name:'特技封印G', unit:'%', allowed:['R','SR','SSR','UR','EX'], min:{R:10,SR:31,SSR:41,UR:61,EX:100}, max:{R:30,SR:40,SSR:60,UR:80,EX:100}},
        {key:'resists_SpellSeal', name:'呪文封印G', unit:'%', allowed:['R','SR','SSR','UR','EX'], min:{R:10,SR:31,SSR:41,UR:61,EX:100}, max:{R:30,SR:40,SSR:60,UR:80,EX:100}},
        {key:'resists_HealSeal', name:'回復封印G', unit:'%', allowed:['R','SR','SSR','UR','EX'], min:{R:10,SR:31,SSR:41,UR:61,EX:100}, max:{R:30,SR:40,SSR:60,UR:80,EX:100}},
        {key:'resists_Shock', name:'感電ガード', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:21,EX:50}, max:{SSR:20,UR:40,EX:50}},
        {key:'resists_InstantDeath', name:'即死ガード', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:21,EX:50}, max:{SSR:20,UR:40,EX:50}},
    ],
    
    SYNERGIES: [
        { key: 'spd', count: 3, name: '疾風怒濤', effect: 'doubleAction', desc: '戦闘時20%で2回行動', color:'#f88' },
        { key: 'hp', count: 3, name: '吸血', effect: 'drain', desc: '与えたダメージの20%を回復', color:'#f88' },
        { key: 'mag', count: 3, name: '魔力暴走', effect: 'magCrit', desc: '魔法スキル使用時20％でダメージ2倍', color:'#88f' },
        { key: 'atk', count: 3, name: '貫通', effect: 'pierce', desc: '攻撃時20%で防御無視', color:'#f88' },
        { key: 'def', count: 3, name: '守護', effect: 'guardian', desc: '防御力+100%', color:'#8f8' },
        { key: 'mp', count: 3, name: '吸魔', effect: 'drainMp', desc: '与えたダメージの1%MP回復', color:'#88f' },
        { key: 'finDmg', count: 3, name: '剛力', effect: 'might', desc: '与ダメージ+30%', color:'#f88' },
        { key: 'finRed', count: 3, name: '鉄壁', effect: 'ironWall', desc: '被ダメージ軽減+10%', color:'#8f8' },
        { 
            name: '軍神', 
            effect: 'warGod', 
            desc: '戦闘開始時 攻・魔1.5倍(永続)', 
            color:'#d4d',
            req: [ {key:'atk', count:2}, {key:'mag', count:2} ]
        },
        { 
            name: '加護', 
            effect: 'divineProtection', 
            desc: '全状態異常耐性+20%', 
            color:'#ffc',
            req: [ {key:'hp', count:2}, {key:'mp', count:2} ]
        },
        { key: 'elmAtk', elm: '混沌', count: 4, name: '混沌の刃', effect: 'grantSkill', value: 923, desc: '魔奥義:カラミティエンド習得', color:'#d4d' },
        { key: 'elmRes', elm: '混沌', count: 4, name: '混沌の壁', effect: 'grantSkill', value: 924, desc: '魔奥義:カラミティウォール習得', color:'#d4d' }
    ],

    MEDAL_REWARDS: [
        { medals: 5, name: '上やくそう x3', type: 'item', id: 2, count: 3 },
        { medals: 10, name: '魔法の小瓶 x5', type: 'item', id: 3, count: 5 },
        { medals: 15, name: '世界樹の葉 x1', type: 'item', id: 5, count: 1 },
        { medals: 20, name: '世界樹の雫 x1', type: 'item', id: 6, count: 1 },
        { medals: 25, name: 'エルフの飲み薬 x1', type: 'item', id: 7, count: 1 },
        { medals: 50, name: 'メタルキングの鎧・レプリカ', type: 'equip', equipId: 901, base: {name:'メタルキングの鎧・レプリカ', type:'体', rank:80, val:20000, data:{def:300, finRed:10}} },
        { medals: 60, name: 'メタルキングの盾・レプリカ', type: 'equip', equipId: 902, base: {name:'メタルキングの盾・レプリカ', type:'盾', rank:80, val:25000, data:{def:260, elmRes:{'火':20,'水':20,'風':20,'雷':20}}} },
        { medals: 70, name: 'メタルキングヘルム・レプリカ', type: 'equip', equipId: 903, base: {name:'メタルキングヘルム・レプリカ', type:'頭', rank:80, val:28000, data:{def:350, mp:250, elmRes:{'光':20,'闇':20}}} },
        { medals: 80, name: 'メタルキングの剣・レプリカ', type: 'equip', equipId: 904, base: {name:'メタルキングの剣・レプリカ', type:'武器', rank:90, val:40000, data:{atk:450, spd:15}} },
        { medals: 90, name: 'メタルキングブーツ・レプリカ', type: 'equip', equipId: 905, base: {name:'メタルキングブーツ・レプリカ', type:'足', rank:90, val:35000, data:{def:30, spd:1000, elmRes:{'混沌':20}}} },
        { medals: 99, name: '災厄の楔', type: 'item', id: 98, count: 1 }
    ]
};

// ユーティリティ関数
window.generateEnemy = function(floor) {
    const candidates = DB.MONSTERS.filter(m => Math.floor(m.rank) === floor && m.id < 1000);
    if (candidates.length > 0) {
        const base = candidates[Math.floor(Math.random() * candidates.length)];
        return JSON.parse(JSON.stringify(base));
    }
    return { name:'エラースライム', hp:50, atk:10, def:10, spd:10, mag:10, exp:1, gold:1, acts:[1] };
};

// 初期データテンプレート
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
        {uid:'p1', isHero:true, charId:301, name:'アルス', job:'勇者', rarity:'N', level:1, hp:800, mp:300, atk:150, def:120, spd:100, mag:100, limitBreak:0, sp:1,tree:{"ATK":0,"MAG":0,"SPD":0,"HP":0,"MP":0}, equips:{}, alloc:{}}
    ]
};

window.DB = DB;
