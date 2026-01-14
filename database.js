/* database.js (装備システム独立化・クリーンアップ版) */

const CONST = {
    SAVE_KEY: 'QoE_SaveData_v38_BalanceFix', 
    PARTS: ['武器', '盾', '頭', '体', '足'],
    ELEMENTS: ['火', '水', '風', '雷', '光', '闇', '混沌'],
    RARITY: ['N', 'R', 'SR', 'SSR', 'UR', 'EX'],
	
    GACHA_RATES: { N:0, R:52.5, SR:35, SSR:10, UR:2, EX:0.5 },
    SMITH_RATES: { 1: { R:80, SR:15, SSR:5 }, 10: { R:10, SR:30, SSR:40, UR:15, EX:5 } },
    POKER_ODDS: { ROYAL_FLUSH: 500, STRAIGHT_FLUSH: 100, FOUR_CARD: 30, FULL_HOUSE: 10, FLUSH: 8, STRAIGHT: 5, THREE_CARD: 3, TWO_PAIR: 2, JACKS_OR_BETTER: 1 },
    PLUS_RATES: { 3: 0.10, 2: 0.30, 1: 0.60 }, 
    
    MAX_LEVEL: 100,
    EXP_BASE: 100,
    EXP_GROWTH: 1.08,
    RARITY_EXP_MULT: { N:1.0, R:1.1, SR:1.2, SSR:1.3, UR:1.5, EX:2.0 },
	
	SKILL_TREES : {
		// --- 転生回数 0 から表示される基本ツリー ---
		ATK: {
			name: '攻撃強化',
			reqReincarnation: 0,
			costs: [5, 12, 22, 35, 50],
			steps: [
				{ desc: '攻撃力 +5%', stats: { atkMult: 0.05 } },
				{ desc: '攻撃力 +10%', stats: { atkMult: 0.05 } },
				{ desc: '攻撃力 +15% / 渾身斬り習得', stats: { atkMult: 0.05 }, skillId: 102 },
				{ desc: '攻撃力 +20% / 超はやぶさ斬り習得', stats: { atkMult: 0.05 }, skillId: 108 },
				{ desc: '攻撃力 +25% / 20％で防御無視', stats: { atkMult: 0.05 }, passive: 'atkIgnoreDef' }
			]
		},
		MAG: {
			name: '魔力強化',
			reqReincarnation: 0,
			costs: [5, 12, 22, 35, 50],
			steps: [
				{ desc: '魔力 +5%', stats: { magMult: 0.05 } },
				{ desc: '魔力 +10%', stats: { magMult: 0.05 } },
				{ desc: '魔力 +15% / ベギラマ習得', stats: { magMult: 0.05 }, skillId: 302 },
				{ desc: '魔力 +20% / メラゾーマ習得', stats: { magMult: 0.05 }, skillId: 305 },
				{ desc: '魔力 +25% / 20％でダメージ2倍', stats: { magMult: 0.05 }, passive: 'magCrit' }
			]
		},
		SPD: {
			name: '素早さ強化',
			reqReincarnation: 0,
			costs: [5, 12, 22, 35, 50],
			steps: [
				{ desc: '素早さ +5%', stats: { spdMult: 0.05 } },
				{ desc: '素早さ +10%', stats: { spdMult: 0.05 } },
				{ desc: '素早さ +15% / 疾風突き習得', stats: { spdMult: 0.05 }, skillId: 49 },
				{ desc: '素早さ +20% / 20%で最速行動', stats: { spdMult: 0.05 }, passive: 'fastestAction' },
				{ desc: '素早さ +25% / 20%で2回行動', stats: { spdMult: 0.05 }, passive: 'doubleAction' }
			]
		},
		HP: {
			name: '生命力強化',
			reqReincarnation: 0,
			costs: [5, 12, 22, 35, 50],
			steps: [
				{ desc: '最大HP +10%', stats: { hpMult: 0.10 } },
				{ desc: '最大HP +20%', stats: { hpMult: 0.10 } },
				{ desc: '最大HP +30% / ハッスルダンス習得', stats: { hpMult: 0.10 }, skillId: 22 },
				{ desc: '最大HP +40% / ザオラル習得', stats: { hpMult: 0.10 }, skillId: 30 },
				{ desc: '最大HP +50% / HP5％回復', stats: { hpMult: 0.10 }, passive: 'hpRegen' }
			]
		},
		MP: {
			name: '防御・精神力強化',
			reqReincarnation: 0,
			costs: [5, 12, 22, 35, 50],
			steps: [
				{ desc: '最大MP・防御力 +5%', stats: { mpMult: 0.05, defMult: 0.05 } },
				{ desc: '最大MP・防御力 +10%', stats: { mpMult: 0.05, defMult: 0.05 } },
				{ desc: '最大MP・防御力 +15% / 無念無想習得', stats: { mpMult: 0.05, defMult: 0.05 }, skillId: 81 },
				{ desc: '最大MP・防御力 +20% / マジックバリア習得', stats: { mpMult: 0.05, defMult: 0.05 }, skillId: 53 },
				{ desc: '最大MP・防御力 +25% / 被ダメ軽減 +10%', stats: { mpMult: 0.05, defMult: 0.05 }, passive: 'finRed10' }
			]
		},

		// --- 転生回数 1 以上で表示される上級ツリー ---
		WARRIOR: {
			name: '極意：戦士',
			reqReincarnation: 1,
			costs: [15, 30, 50, 75, 100],
			steps: [
				{ desc: '最大HP +25%', stats: { hpMult: 0.25 } },
				{ desc: '攻撃力 +25%', stats: { atkMult: 0.25 } },
				{ desc: '与ダメージ +20%', stats: { dmgMult: 0.20 } },
				{ desc: '鉄甲斬習得', skillId: 117 },
				{ desc: '真やいばくだき習得', skillId: 118 }
			]
		},
		MAGE: {
			name: '極意：魔法使い',
			reqReincarnation: 1,
			costs: [15, 30, 50, 75, 100],
			steps: [
				{ desc: '最大MP +25%', stats: { mpMult: 0.25 } },
				{ desc: '魔力 +25%', stats: { magMult: 0.25 } },
				{ desc: '与ダメージ +20%', stats: { dmgMult: 0.20 } },
				{ desc: '魔力覚醒習得', skillId: 54 },
				{ desc: 'メテオ習得', skillId: 416 }
			]
		},
		PRIEST: {
			name: '極意：僧侶',
			reqReincarnation: 1,
			costs: [15, 30, 50, 75, 100],
			steps: [
				{ desc: '最大HP +25%', stats: { hpMult: 0.25 } },
				{ desc: '防御力 +25%', stats: { defMult: 0.25 } },
				{ desc: '被ダメージ軽減 +10%', passive: 'finRed10' },
				{ desc: 'ザオリク習得', skillId: 31 },
				{ desc: 'ひかりのはどう習得', skillIds: 56 }
			]
		},
		M_KNIGHT: {
			name: '極意：魔法戦士',
			reqReincarnation: 1,
			costs: [15, 30, 50, 75, 100],
			steps: [
				{ desc: '最大MP +25%', stats: { mpMult: 0.25 } },
				{ desc: '最大HP +25%', stats: { hpMult: 0.25 } },
				{ desc: '全属性攻撃 +20%', stats: { allElmMult: 0.20 } },
				{ desc: 'シャイニングボウ習得', skillId: 207 },
				{ desc: 'フォースブレイク習得', skillId: 55 }
			]
		}
	}
};

const DB = {
    SKILLS: window.SKILLS_DATA || [],
    ITEMS: window.ITEMS_DATA || [],
    CHARACTERS: window.CHARACTERS_DATA || [],
    MONSTERS: window.MONSTERS_DATA || [],
    // 独立したマスタ(equips.js)を参照するように変更
    EQUIPS: window.EQUIP_MASTER || [],

    OPT_RULES: [
        {key:'atk', name:'攻撃', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:6,UR:10,EX:15}, max:{N:2,R:3,SR:6,SSR:10,UR:15,EX:25}},
        {key:'def', name:'防御', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:6,UR:10,EX:15}, max:{N:2,R:3,SR:6,SSR:10,UR:15,EX:25}},
        {key:'mag', name:'魔力', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:6,UR:10,EX:15}, max:{N:2,R:3,SR:6,SSR:10,UR:15,EX:25}},
        {key:'spd', name:'速さ', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:6,UR:10,EX:15}, max:{N:2,R:3,SR:6,SSR:10,UR:15,EX:25}},
		{key:'mdef', name:'魔防', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:6,UR:10,EX:15}, max:{N:2,R:3,SR:6,SSR:10,UR:15,EX:25}},

        {key:'hit', name:'命中', unit:'%', allowed:['UR','EX'], min:{UR:3,EX:6}, max:{UR:6,EX:10}},
        {key:'eva', name:'回避', unit:'%', allowed:['UR','EX'], min:{UR:3,EX:6}, max:{UR:6,EX:10}},
        {key:'cri', name:'会心', unit:'%', allowed:['UR','EX'], min:{UR:3,EX:6}, max:{UR:6,EX:10}},

        {key:'hp', name:'HP', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:6,UR:10,EX:15}, max:{N:3,R:5,SR:8,SSR:12,UR:18,EX:30}},
        {key:'mp', name:'MP', unit:'%', allowed:['N','R','SR','SSR','UR','EX'], min:{N:1,R:2,SR:3,SSR:6,UR:10,EX:15}, max:{N:3,R:5,SR:8,SSR:12,UR:18,EX:30}},
        {key:'finDmg', name:'与ダメ', unit:'%', allowed:['UR','EX'], min:{UR:10,EX:20}, max:{UR:20,EX:30}},
        {key:'finRed', name:'被ダメ', unit:'%', allowed:['UR','EX'], min:{UR:3,EX:6}, max:{UR:6,EX:10}},
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
        {key:'attack_Fear', name:'攻撃時怯え', unit:'%', allowed:['R','SR','SSR','UR','EX'], min:{R:1,SR:2,SSR:3,UR:5,EX:10}, max:{R:1,SR:2,SSR:5,UR:10,EX:20}},
        {key:'attack_Poison', name:'攻撃時毒', unit:'%', allowed:['R','SR','SSR','UR','EX'], min:{R:1,SR:2,SSR:3,UR:5,EX:10}, max:{R:1,SR:2,SSR:5,UR:10,EX:20}},
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
        { key: 'elmAtk', elm: '混沌', count: 4, name: '深淵の刃', effect: 'grantSkill', value: 923, desc: '魔奥義:カラミティエンド習得', color:'#d4d' },
        { key: 'elmRes', elm: '混沌', count: 4, name: '混沌の壁', effect: 'grantSkill', value: 924, desc: '魔奥義:カラミティウォール習得', color:'#d4d' },

		{ key: 'hp', count: 4, name: '鉄人', effect: 'hpBoost100', desc: '最大HP +100%', color: '#f88' },
		{ key: 'mp', count: 4, name: '夢幻の悟り', effect: 'sealGuard50', desc: '全封印耐性 +50%', color: '#88f' },
		{ key: 'atk', count: 4, name: '武神', effect: 'atkDouble', desc: '戦闘開始時 攻撃2倍(永続)', color: '#f88' },
		{ key: 'mag', count: 4, name: '魔神', effect: 'magDouble', desc: '戦闘開始時 魔力2倍(永続)', color: '#88f' },
		{ key: 'spd', count: 4, name: '神速', effect: 'spdBoost100', desc: '素早さ +100%', color: '#8f8' },
		{ key: 'def', count: 4, name: '金剛', effect: 'debuffImmune', desc: '弱体耐性 100%', color: '#8f8' },
		
		// 属性極意 (3つで+25%)
		{ key: 'elmAtk', elm: '火', count: 3, name: '火の極意', effect: 'elmAtk25', desc: '火属性攻撃 +25%', color: '#f88' },
		{ key: 'elmAtk', elm: '水', count: 3, name: '水の極意', effect: 'elmAtk25', desc: '水属性攻撃 +25%', color: '#88f' },
		{ key: 'elmAtk', elm: '風', count: 3, name: '風の極意', effect: 'elmAtk25', desc: '風属性攻撃 +25%', color: '#8f8' },
		{ key: 'elmAtk', elm: '雷', count: 3, name: '雷の極意', effect: 'elmAtk25', desc: '雷属性攻撃 +25%', color: '#ff4' },
		{ key: 'elmAtk', elm: '光', count: 3, name: '光の極意', effect: 'elmAtk25', desc: '光属性攻撃 +25%', color: '#fff' },
		{ key: 'elmAtk', elm: '闇', count: 3, name: '闇の極意', effect: 'elmAtk25', desc: '闇属性攻撃 +25%', color: '#a0a' },
		{ key: 'elmAtk', elm: '混沌', count: 3, name: '混沌の極意', effect: 'elmAtk25', desc: '混沌属性攻撃 +25%', color: '#d4d' },

		// 複合シナジー
		{ 
			name: '元素崩壊', effect: 'allResDown20', desc: '攻撃時20%で全耐性50%低下', color: '#8ff',
			req: [ {key:'elmAtk', elm:'火', count:1}, {key:'elmAtk', elm:'水', count:1}, {key:'elmAtk', elm:'風', count:1}, {key:'elmAtk', elm:'雷', count:1} ]
		},
		{ 
			name: '致命攻撃', effect: 'instantDeath20', desc: '攻撃時20%で即死付与', color: '#d4d',
			req: [ {key:'elmAtk', elm:'光', count:1}, {key:'elmAtk', elm:'闇', count:1}, {key:'elmAtk', elm:'混沌', count:1}, {key:'finDmg', count:1} ]
		}	
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
    gold: 5000, gems: 9000,
    items: { 1: 5 }, 
    inventory: [], 
    location: { 
        area: 'START_VILLAGE', 
        x: 7, y: 8 // 村の広場の真ん中あたり
    },
    progress: { 
        floor: 0,
        storyStep: 0,        // ストーリー進行フラグ
        flags: {},           // イベント個別フラグ (hasShip 等)
        unlocked: { smith: false, gacha: false }, // 機能解放
        clearedDungeons: []  // 攻略済みエリア
    },
    characters: [
        {
            uid:'p1', isHero:true, charId:301, name:'アルス', job:'勇者', rarity:'N', 
            level:1, hp:700, mp:300, atk:150, def:120, spd:120, mag:130, 
            mdef: 120, hit: 100, eva: 0, cri: 0, // ★新規ステータス追加 
			limitBreak:0, sp:1,
            tree:{"ATK":0,"MAG":0,"SPD":0,"HP":0,"MP":0, "WARRIOR":0, "MAGE":0, "PRIEST":0, "M_KNIGHT":0}, 
            equips:{}, alloc:{}, skills:[1],
            traits: [ { id: 30, level: 1 } ], // ★初期特性の付与
            disabledTraits: [], // 特性ON/OFF管理用
        }		
    ],
    party: ['p1'],
    book: { monsters: [], killCounts: {} },
    stats: { totalSteps: 0, startTime: Date.now() }
};

window.DB = DB;
