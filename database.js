/* database.js (バランス調整版) */

const CONST = {
    SAVE_KEY: 'QoE_SaveData_v34_Balance', // キー更新
    PARTS: ['武器', '盾', '頭', '体', '足'],
    ELEMENTS: ['火', '水', '風', '雷', '光', '闇', '混沌'],
    RARITY: ['N', 'R', 'SR', 'SSR', 'UR', 'EX'],
    
    // ガチャ確率
    GACHA_RATES: { N:0, R:50, SR:30, SSR:14, UR:5, EX:1 },
    
    // 鍛冶屋確率
    SMITH_RATES: { 1: { R:80, SR:15, SSR:5 }, 10: { R:10, SR:30, SSR:40, UR:15, EX:5 } },

    // ポーカー役倍率
    POKER_ODDS: { ROYAL_FLUSH: 500, STRAIGHT_FLUSH: 100, FOUR_CARD: 30, FULL_HOUSE: 10, FLUSH: 8, STRAIGHT: 5, THREE_CARD: 3, TWO_PAIR: 2, JACKS_OR_BETTER: 1 },
    
    // 装備ドロップ時の+値確率
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
    // ★スキル調整: 倍率(rate)と固定値(base)を下げ、ステータス依存度を高める
    SKILLS: [
        {id:1, name:'こうげき', type:'物理', target:'単体', mp:0, rate:1.0, count:1, base:0, elm:null, desc:'通常攻撃'},
        {id:10, name:'メラ', type:'魔法', target:'単体', mp:2, rate:1.2, count:1, base:10, elm:'火', desc:'小火球'},
        {id:11, name:'ヒャド', type:'魔法', target:'単体', mp:3, rate:1.2, count:1, base:12, elm:'水', desc:'氷の刃'},
        {id:12, name:'バギ', type:'魔法', target:'全体', mp:5, rate:0.8, count:1, base:15, elm:'風', desc:'真空の刃'},
        {id:13, name:'ライデイン', type:'魔法', target:'単体', mp:8, rate:1.8, count:1, base:30, elm:'雷', desc:'落雷'},
        {id:20, name:'ホイミ', type:'回復', target:'単体', mp:3, rate:1.5, count:1, base:30, elm:null, desc:'小回復'},
        {id:21, name:'ベホイミ', type:'回復', target:'単体', mp:6, rate:2.5, count:1, base:80, elm:null, desc:'中回復'},
        {id:22, name:'ベホマラー', type:'回復', target:'全体', mp:12, rate:1.5, count:1, base:60, elm:null, desc:'全体回復'},
        {id:30, name:'ザオラル', type:'蘇生', target:'単体', mp:8, rate:0.5, count:1, base:0, elm:null, desc:'50%蘇生'},
        {id:40, name:'火炎斬り', type:'物理', target:'単体', mp:4, rate:1.3, count:1, base:5, elm:'火', desc:'炎の剣技'},
        {id:41, name:'はやぶさ斬り', type:'物理', target:'単体', mp:6, rate:0.7, count:2, base:0, elm:null, desc:'2回攻撃'},
        {id:42, name:'ギガスラッシュ', type:'物理', target:'全体', mp:15, rate:2.0, count:1, base:50, elm:'光', desc:'光の剣技'},
        {id:50, name:'バイキルト', type:'強化', target:'単体', mp:6, rate:0, count:1, base:0, buff:{atk:1.5}, desc:'攻撃増'},
        {id:101, name:'強撃', type:'物理', target:'単体', mp:5, rate:1.5, count:1, base:10, desc:'力強い一撃'},
        {id:102, name:'癒しの風', type:'回復', target:'全体', mp:15, rate:1.0, count:1, base:40, desc:'全体小回復'},
        {id:201, name:'五月雨突き', type:'物理', target:'ランダム', mp:10, rate:0.6, count:4, base:0, desc:'4回攻撃'},
        {id:202, name:'ベギラマ', type:'魔法', target:'全体', mp:12, rate:1.2, count:1, base:20, elm:'雷', desc:'雷の帯'},
        {id:301, name:'ギガブレイク', type:'物理', target:'全体', mp:30, rate:2.5, count:1, base:80, elm:'雷', desc:'最強の剣技'},
        {id:401, name:'ゴッドハンド', type:'物理', target:'単体', mp:30, rate:3.0, count:1, base:100, elm:'光', desc:'神の拳'},
        {id:402, name:'メテオ', type:'魔法', target:'全体', mp:50, rate:2.5, count:1, base:100, elm:'火', desc:'隕石落とし'},
        {id:403, name:'フルケア', type:'回復', target:'単体', mp:40, rate:0, count:1, base:9999, fix:true, desc:'完全回復'},
        {id:901, name:'ジェネシス', type:'魔法', target:'全体', mp:100, rate:5.0, count:1, base:500, elm:'混沌', desc:'【EX】天地創造の光'},
        {id:902, name:'ラグナロク', type:'物理', target:'全体', mp:80, rate:3.0, count:5, base:50, elm:'闇', desc:'【EX】終焉の5連撃'},
        {id:903, name:'リザレクション', type:'蘇生', target:'全体', mp:200, rate:1.0, count:1, base:100, desc:'【EX】味方全員を完全蘇生'},
        {id:999, name:'激しい炎', type:'特殊', target:'全体', mp:0, rate:0, count:1, base:80, fix:true, elm:'火', desc:'全体炎'}
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
    MONSTERS: [],
    EQUIPS: [],
    
    // 装備オプション
    OPT_RULES: [
        {key:'atk', name:'攻撃', unit:'val', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:5,SR:10,SSR:20,UR:50,EX:80}, max:{N:4,R:9,SR:19,SSR:49,UR:100,EX:200}},
        {key:'def', name:'防御', unit:'val', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:5,SR:10,SSR:20,UR:50,EX:80}, max:{N:4,R:9,SR:19,SSR:49,UR:100,EX:200}},
        {key:'mag', name:'魔力', unit:'val', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:5,SR:10,SSR:20,UR:50,EX:80}, max:{N:4,R:9,SR:19,SSR:49,UR:100,EX:200}},
        {key:'hp', name:'HP', unit:'val', allowed:['N','R','SR','SSR','UR','EX'], min:{N:10,R:50,SR:100,SSR:300,UR:500,EX:1000}, max:{N:40,R:90,SR:290,SSR:490,UR:1000,EX:2500}},
        {key:'mp', name:'MP', unit:'val', allowed:['N','R','SR','SSR','UR','EX'], min:{N:5,R:10,SR:30,SSR:50,UR:100,EX:200}, max:{N:9,R:29,SR:49,SSR:99,UR:199,EX:500}},
        {key:'spd', name:'速さ', unit:'val', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:4,SSR:8,UR:15,EX:30}, max:{N:1,R:3,SR:7,SSR:14,UR:30,EX:60}},
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
        
        // ★追加: 蘇生アイテム
        { medals: 15, name: '世界樹の葉 x1', type: 'item', id: 5, count: 1 },
        
        // 既存: 体装備
        { medals: 50, name: '神秘の鎧', type: 'equip', equipId: 901, base: {name:'神秘の鎧', type:'体', rank:50, val:20000, data:{def:50, finRed:20}} },
        
        // ★追加: 盾 (全属性耐性持ち)
        { medals: 60, name: 'メタルキングの盾', type: 'equip', equipId: 902, base: {name:'メタキン盾', type:'盾', rank:80, val:25000, data:{def:60, elmRes:{'火':10,'水':10,'風':10,'雷':10}}} },
        
        // ★追加: 頭 (状態異常耐性イメージで光闇耐性)
        { medals: 70, name: 'メタルキングヘルム', type: 'equip', equipId: 903, base: {name:'メタキン兜', type:'頭', rank:80, val:28000, data:{def:45, mp:50, elmRes:{'光':20,'闇':20}}} },
        
        // ★追加: 武器 (高火力)
        { medals: 80, name: 'メタルキングの剣', type: 'equip', equipId: 904, base: {name:'メタキン剣', type:'武器', rank:90, val:40000, data:{atk:160, spd:15}} }
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
        { rank:50, name:'プラチナ', mult:10.0 }, // 少し強化
        { rank:60, name:'ミスリル', mult:15.0 }, // 少し強化
        { rank:70, name:'オリハルコン', mult:22.0 }, // 強化
        { rank:80, name:'アダマン', mult:30.0 }, // 強化
        { rank:90, name:'英雄の', mult:45.0 }, // 強化
        { rank:100, name:'神々の', mult:60.0 }  // 強化
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
        { name:'スライム', hp:30, atk:12, def:5, exp:10 }, // 基礎Atk微増
        { name:'バット', hp:20, atk:15, def:3, exp:12 },
        { name:'ウルフ', hp:50, atk:22, def:10, exp:20 },
        { name:'ゴースト', hp:40, atk:18, def:30, exp:25 },
        { name:'オーク', hp:100, atk:35, def:20, exp:50 },
        { name:'ナイト', hp:150, atk:45, def:50, exp:100 },
        { name:'デーモン', hp:300, atk:90, def:60, exp:300 },
        { name:'ドラゴン', hp:500, atk:120, def:80, exp:500 }
    ];

    const ENEMY_SKILLS = {
        low: [1, 1, 1, 10, 40],
        mid: [1, 1, 10, 11, 40, 41, 202],
        high: [1, 41, 12, 13, 101, 201, 202],
        top: [1, 41, 42, 101, 201, 301, 402, 999]
    };

    for(let r=1; r<=100; r++) {
        const typeIdx = Math.min(MONSTER_TYPES.length-1, Math.floor((r-1)/12)); 
        const base = MONSTER_TYPES[typeIdx];
        
        // ★強化: 成長係数をアップ (0.35 -> 0.45)
        const scale_factor = 0.45; 
        const hp_exp = 2.5; 

        const scale = 1.0 + (r * scale_factor); 
        
        let prefix = "";
        if(r % 10 >= 5) prefix = "強・";
        if(r > 50) prefix = "真・";
        if(r > 80) prefix = "極・";

        let acts = [1]; 
        if (r <= 10) acts = ENEMY_SKILLS.low;
        else if (r <= 40) acts = ENEMY_SKILLS.mid;
        else if (r <= 80) acts = ENEMY_SKILLS.high;
        else acts = ENEMY_SKILLS.top;

        const myActs = [1];
        const skillCount = r > 50 ? 3 : 2; 
        for(let i=0; i<skillCount; i++) {
            const skill = acts[Math.floor(Math.random() * acts.length)];
            if(!myActs.includes(skill)) myActs.push(skill);
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
            spd: 10 + r * 1.2,
            mag: Math.floor(base.mag * scale),
            exp: Math.floor(base.exp * scale * 1.5),
            gold: Math.floor(r * 25),
            acts: myActs,
            drop: null
        });
    }

    // ボス: レグナード (HP強化)
    DB.MONSTERS.push({
        id:1000, rank:100, minF:999, name:'レグナード', 
        hp:50000, mp:9999, atk:1500, def:800, spd:200, mag:500, 
        exp:100000, gold:50000, 
        acts:[1, 13, 42, 202, 301, 401, 402, 901, 902, 999] 
    });
})();

const INITIAL_DATA_TEMPLATE = {
    gold: 5000, gems: 100000,
    items: { 1: 10, 2: 5, 99: 10 }, 
    inventory: [], 
    location: { x: 23, y: 60 },
    progress: { floor: 0 },
    blacksmith: { level: 1, exp: 0 },
    dungeon: { maxFloor: 0, tryCount: 0, map: null, width: 30, height: 30 },
    book: { monsters: [] },
    battle: { active: false },
    party: ['p1', 'p2', 'p3', 'p4'],
    characters: [
        {uid:'p1', isHero:true, charId:301, name:'アルス', job:'勇者', rarity:'SSR', level:10, hp:200, mp:50, atk:40, def:30, spd:30, mag:20, limitBreak:0, equips:{}, alloc:{}},
        {uid:'p2', charId:101, name:'ジョン', job:'戦士', rarity:'R', level:8, hp:180, mp:20, atk:50, def:40, spd:20, mag:5, limitBreak:0, equips:{}},
        {uid:'p3', charId:201, name:'アラン', job:'魔法剣士', rarity:'SR', level:8, hp:160, mp:60, atk:40, def:30, spd:35, mag:40, limitBreak:0, equips:{}},
        {uid:'p4', charId:102, name:'マリー', job:'僧侶', rarity:'R', level:8, hp:140, mp:80, atk:20, def:20, spd:25, mag:50, limitBreak:0, equips:{}}
    ]
};
