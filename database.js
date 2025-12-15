/* database.js (完全統合版: 全スキル・全ボス・新計算式対応) */

const CONST = {
    SAVE_KEY: 'QoE_SaveData_v38_BalanceFix', 
    PARTS: ['武器', '盾', '頭', '体', '足'],
    ELEMENTS: ['火', '水', '風', '雷', '光', '闇', '混沌'],
    RARITY: ['N', 'R', 'SR', 'SSR', 'UR', 'EX'],
    
    GACHA_RATES: { N:0, R:50, SR:30, SSR:14, UR:5, EX:1 },
    SMITH_RATES: { 1: { R:80, SR:15, SSR:5 }, 10: { R:10, SR:30, SSR:40, UR:15, EX:5 } },
    POKER_ODDS: { ROYAL_FLUSH: 500, STRAIGHT_FLUSH: 100, FOUR_CARD: 30, FULL_HOUSE: 10, FLUSH: 8, STRAIGHT: 5, THREE_CARD: 3, TWO_PAIR: 2, JACKS_OR_BETTER: 1 },
    PLUS_RATES: { 3: 0.10, 2: 0.30, 1: 0.60 }, 
    
    MAX_LEVEL: 100,
    EXP_BASE: 100,
    EXP_GROWTH: 1.08,
    RARITY_EXP_MULT: { N:1.0, R:1.1, SR:1.2, SSR:1.3, UR:1.5, EX:2.0 },
	
// ★修正: パッシブID (passive) を追加して、バトル側で判定できるようにする
    SKILL_TREES: {
        // 攻撃力 (ATK)
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
        // 魔力 (MAG)
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
        // 素早さ (SPD)
        SPD: {
            name: '素早さ強化',
            steps: [
                { desc: '素早さ +5%' },
                { desc: '素早さ +10%' },
                { desc: '素早さ +15% / 疾風突き(49)習得', skillId: 49 },
                { desc: '素早さ +20% / 戦闘時20%で最速行動', passive: 'fastestAction' }, // Lv4で習得
                { desc: '素早さ +25% / 戦闘時20%で2回行動', passive: 'doubleAction' }  // Lv5で習得
            ],
            costs: [5, 12, 22, 35, 50]
        },
        // HP
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
        // 防御・MP
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

/* 自然な形状にリメイクしたMAPデータ */
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
    "WWWWWWGGGWWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWW",
    "GGGGGGGGGGGGFFFGGGGGGIEKGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "WWWWWWWGGGGGGFFFFGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWW",
    "WWWWWWWWGGGGGGFFFFGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWW",
    "WWWWWWWWWWGGGGGFFGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWW",
    "WWWWWWWWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWW",
    "WWWWWWWWWWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
];

/* database.js (スキル・アイテム調整版) */

const DB = {
	SKILLS: window.SKILLS_DATA || [],
    ITEMS: window.ITEMS_DATA || [],
    CHARACTERS: window.CHARACTERS_DATA || [],
    MONSTERS: window.MONSTERS_DATA || [],

    //MONSTERS: [],
    EQUIPS: [],
  
OPT_RULES: [
        // 基礎ステータス (前回の減少値を維持)
        {key:'atk', name:'攻撃', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:5,UR:8,EX:12}, max:{N:2,R:3,SR:6,SSR:10,UR:15,EX:25}},
        {key:'def', name:'防御', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:5,UR:8,EX:12}, max:{N:2,R:3,SR:6,SSR:10,UR:15,EX:25}},
        {key:'mag', name:'魔力', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:5,UR:8,EX:12}, max:{N:2,R:3,SR:6,SSR:10,UR:15,EX:25}},
        {key:'spd', name:'速さ', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:5,UR:8,EX:12}, max:{N:2,R:3,SR:6,SSR:10,UR:15,EX:25}},
        
        {key:'hp', name:'HP', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:5,UR:8,EX:12}, max:{N:3,R:5,SR:8,SSR:12,UR:18,EX:30}},
        {key:'mp', name:'MP', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:5,UR:8,EX:12}, max:{N:3,R:5,SR:8,SSR:12,UR:18,EX:30}},
        
        {key:'finDmg', name:'与ダメ', unit:'%', allowed:['UR','EX'], min:{UR:10,EX:20}, max:{UR:20,EX:30}},
        {key:'finRed', name:'被ダメ', unit:'%', allowed:['UR','EX'], min:{UR:3,EX:5}, max:{UR:6,EX:10}}, 
        
        // ★修正: 火水風雷 (SSR以上限定に変更)
        {key:'elmAtk', elm:'火', name:'火攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},
        {key:'elmAtk', elm:'水', name:'水攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},
        {key:'elmAtk', elm:'風', name:'風攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},
        {key:'elmAtk', elm:'雷', name:'雷攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},
        {key:'elmAtk', elm:'光', name:'光攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},
        {key:'elmAtk', elm:'闇', name:'闇攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},
        {key:'elmAtk', elm:'混沌', name:'混沌攻', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:5,UR:10,EX:20}, max:{SSR:10,UR:20,EX:40}},

        // ★修正: 火水風雷耐性 (SSR以上限定に変更)
        {key:'elmRes', elm:'火', name:'火耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
        {key:'elmRes', elm:'水', name:'水耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
        {key:'elmRes', elm:'風', name:'風耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
        {key:'elmRes', elm:'雷', name:'雷耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
        {key:'elmRes', elm:'光', name:'光耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
        {key:'elmRes', elm:'闇', name:'闇耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
        {key:'elmRes', elm:'混沌', name:'混沌耐', unit:'%', allowed:['SSR','UR','EX'], min:{SSR:10,UR:20,EX:40}, max:{SSR:20,UR:40,EX:80}},
    ],
    
    SYNERGIES: [
        { key: 'spd', count: 3, name: '疾風怒濤', effect: 'doubleAction', desc: '戦闘時20%で2回行動', color:'#f88' },
        { key: 'hp', count: 3, name: '吸血', effect: 'drain', desc: '与えたダメージの20%を回復', color:'#f88' },
        { key: 'mag', count: 3, name: '魔力暴走', effect: 'magCrit', desc: '魔法スキル使用時20％でダメージ2倍', color:'#88f' }
    ],

MEDAL_REWARDS: [
        { medals: 5, name: '上やくそう x3', type: 'item', id: 2, count: 3 },
        { medals: 10, name: '魔法の小瓶 x5', type: 'item', id: 3, count: 5 },
        { medals: 15, name: '世界樹の葉 x1', type: 'item', id: 5, count: 1 },
        { medals: 20, name: '世界樹の雫 x1', type: 'item', id: 6, count: 1 },
        { medals: 25, name: 'エルフの飲み薬 x1', type: 'item', id: 7, count: 1 },
        
        { medals: 50, name: 'メタルキングの鎧', type: 'equip', equipId: 901, base: {name:'メタルキングの鎧', type:'体', rank:80, val:20000, data:{def:300, finRed:10}} },
        { medals: 60, name: 'メタルキングの盾', type: 'equip', equipId: 902, base: {name:'メタルキングの盾', type:'盾', rank:80, val:25000, data:{def:260, elmRes:{'火':20,'水':20,'風':20,'雷':20}}} },
        { medals: 70, name: 'メタルキングヘルム', type: 'equip', equipId: 903, base: {name:'メタルキングヘルム', type:'頭', rank:80, val:28000, data:{def:350, mp:250, elmRes:{'光':20,'闇':20}}} },
        { medals: 80, name: 'メタルキングの剣', type: 'equip', equipId: 904, base: {name:'メタルキングの剣', type:'武器', rank:90, val:40000, data:{atk:450, spd:15}} },
        { medals: 90, name: 'メタルキングブーツ', type: 'equip', equipId: 905, base: {name:'メタルキングブーツ', type:'足', rank:90, val:35000, data:{def:30, spd:1000, elmRes:{'混沌':20}}} }
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
        { rank:100, name:'神々の', mult:60.0 },
        // --- 追加ランク ---
        { rank:110, name:'神話の', mult:80.0 },
        { rank:120, name:'深淵の', mult:100.0 },
        { rank:130, name:'幻想の', mult:125.0 },
        { rank:140, name:'終焉の', mult:150.0 },
        { rank:150, name:'創世の', mult:180.0 },
        { rank:200, name:'絶対の', mult:250.0 }
    ];

    const EQUIP_TYPES = [
        { type:'武器', baseName:'剣', stat:'atk', baseVal:10 },
        { type:'武器', baseName:'斧', stat:'atk', baseVal:15, spdMod:-2 },
        { type:'武器', baseName:'短剣', stat:'atk', baseVal:8, spdMod:5 },
        
        { type:'盾', baseName:'盾', stat:'def', baseVal:5 },
        // 追加: 籠手 (守備は盾より低いが攻撃が上がる)
        { type:'盾', baseName:'籠手', stat:'def', baseVal:3, atkMod:3 }, 

        { type:'頭', baseName:'兜', stat:'def', baseVal:3 },
        // 追加: 帽子 (守備は兜より低いが魔力が上がる)
        { type:'頭', baseName:'帽子', stat:'def', baseVal:2, magMod:3 },

        { type:'体', baseName:'鎧', stat:'def', baseVal:8 },
        { type:'体', baseName:'ローブ', stat:'def', baseVal:5, magMod:5 },
        
        { type:'足', baseName:'ブーツ', stat:'spd', baseVal:5, defMod:2 },
        // 追加: くつ (防御補正はないが素早さが高い)
        { type:'足', baseName:'くつ', stat:'spd', baseVal:8 }
    ];

    TIERS.forEach(tier => {
        EQUIP_TYPES.forEach((eq, idx) => {
            const data = {};
            // メインステータス計算
            data[eq.stat] = Math.floor(eq.baseVal * tier.mult);
            
            // サブステータス計算 (ランクに応じて補正値も増える)
            // ★atkModの処理を追加しました
            if(eq.atkMod) data.atk = Math.floor(eq.atkMod * (1 + tier.rank/20));
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

    // 互換性維持: generateEnemy関数 (既存のdungeon.js/battle.jsが呼んでも動くようにする)
    window.generateEnemy = function(floor) {
        // 事前生成されたリストから、その階層の雑魚敵(actCount未定義またはボスID以外)をランダムに返す
        const candidates = DB.MONSTERS.filter(m => Math.floor(m.rank) === floor && m.id < 1000);
        if (candidates.length > 0) {
            const base = candidates[Math.floor(Math.random() * candidates.length)];
            return JSON.parse(JSON.stringify(base));
        }
        // フォールバック
        return { name:'エラースライム', hp:50, atk:10, def:10, spd:10, mag:10, exp:1, gold:1, acts:[1] };
    };

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
        {uid:'p1', isHero:true, charId:301, name:'アルス', job:'勇者', rarity:'N', level:1, hp:800, mp:300, atk:150, def:120, spd:100, mag:100, limitBreak:0, sp:1,tree:{"ATK":0,"MAG":0,"SPD":0,"HP":0,"MP":0}, equips:{}, alloc:{}}
    ]
};
// エディタ用：windowオブジェクトにDBを登録して参照可能にする
window.DB = DB;
