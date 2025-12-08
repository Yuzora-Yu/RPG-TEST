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
    EXP_GROWTH: 1.1,
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

/* database.js (スキル・アイテム調整版) */

const DB = {
    SKILLS: [
        // --- 基本 ---
        {id:1, name:'こうげき', type:'物理', target:'単体', mp:0, rate:0.8, count:1, base:50, elm:null, desc:'通常攻撃'},
        {id:2, name:'ぼうぎょ', type:'特殊', target:'自分', mp:0, rate:0, count:0, base:20, elm:null, desc:'ダメージ軽減'},
        {id:9, name:'逃げる', type:'特殊', target:'自分', mp:0, rate:0, count:0, base:20, desc:'戦闘から離脱'},

// --- 初級魔法（消費微増） ---
    {id:10, name:'メラ', type:'魔法', target:'単体', mp:4, rate:1.0, count:1, base:60, elm:'火', desc:'小火球'},
    {id:11, name:'ヒャド', type:'魔法', target:'単体', mp:5, rate:1.0, count:1, base:62, elm:'水', desc:'氷の刃'},
    {id:12, name:'バギ', type:'魔法', target:'全体', mp:8, rate:0.7, count:1, base:35, elm:'風', desc:'真空の刃'},
    {id:13, name:'ライデイン', type:'魔法', target:'単体', mp:10, rate:1.2, count:1, base:70, elm:'雷', desc:'落雷'},
    {id:14, name:'ドルマ', type:'魔法', target:'単体', mp:6, rate:1.1, count:1, base:65, elm:'闇', desc:'闇の弾'},

    // --- 回復・補助（中級以上は大幅消費増） ---
    {id:20, name:'ホイミ', type:'回復', target:'単体', mp:5, rate:1.2, count:1, base:80, elm:null, desc:'小回復'},
    {id:21, name:'ベホイミ', type:'回復', target:'単体', mp:40, rate:1.8, count:1, base:230, elm:null, desc:'中回復'},
    {id:22, name:'ハッスルダンス', type:'回復', target:'全体', mp:120, rate:1.2, count:1, base:110, elm:null, desc:'全体回復'},
    {id:23, name:'ベホイム', type:'回復', target:'単体', mp:250, rate:0, count:1, base:29999, fix:true, desc:'超回復'},
    {id:24, name:'ベホマラー', type:'回復', target:'全体', mp:1200, rate:0, count:1, base:29999, fix:true, desc:'全体超回復'},
    {id:403, name:'ベホマ', type:'回復', target:'単体', mp:2000, rate:0, count:1, base:99999, fix:true, desc:'完全回復'},
    {id:404, name:'ベホマズン', type:'回復', target:'全体', mp:4000, rate:0, count:1, base:99999, fix:true, desc:'全体完全回復'},
    
    {id:30, name:'ザオラル', type:'蘇生', target:'単体', mp:60, rate:0.5, count:1, base:20, elm:null, desc:'50%蘇生'},
    {id:31, name:'ザオリク', type:'蘇生', target:'単体', mp:300, rate:1, count:1, base:50, elm:null, desc:'100%蘇生'},
    {id:80, name:'めいそう', type:'回復', target:'単体', mp:0, rate:0, count:1, base:0, ratio:0.5, desc:'HPを50%回復'},
    {id:81, name:'無念無想', type:'MP回復', target:'単体', mp:0, rate:0, count:1, base:0, ratio:0.5, desc:'MPを50%回復'},
    
    // --- 物理スキル（威力に見合うMPへ） ---
    {id:40, name:'火炎斬り', type:'物理', target:'単体', mp:15, rate:1.0, count:1, base:55, elm:'火', desc:'炎の剣技'},
    {id:41, name:'はやぶさ斬り', type:'物理', target:'単体', mp:25, rate:0.6, count:2, base:20, elm:null, desc:'2回攻撃'},
    {id:42, name:'氷結斬り', type:'物理', target:'単体', mp:15, rate:1.0, count:1, base:55, elm:'水', desc:'氷の剣技'},
    {id:43, name:'雷鳴突き', type:'物理', target:'単体', mp:15, rate:1.0, count:1, base:55, elm:'雷', desc:'雷の槍技'},
    {id:44, name:'兜割り', type:'物理', target:'単体', mp:15, rate:1.0, count:1, base:55, buff:{def:0.8}, desc:'敵の守備を下げる'},
    {id:45, name:'メタル斬り', type:'物理', target:'単体', mp:20, rate:0, count:1, base:22, fix:true, desc:'メタルに固定ダメージ'},
    {id:46, name:'ウイングアッパー', type:'物理', target:'単体', mp:20, rate:1.1, count:1, base:60, elm:'風', desc:'風の拳'},
    {id:47, name:'ブラッドソード', type:'物理', target:'単体', mp:30, rate:1.2, count:1, base:70, elm:'混沌', drain:true, desc:'HP吸収'},

    // --- 追加物理スキル ---
    {id:48, name:'ミラクルソード', type:'物理', target:'単体', mp:35, rate:0.7, count:1, base:50, drain:true, desc:'奇跡の剣技・HP回復'},
    {id:49, name:'疾風突き', type:'物理', target:'単体', mp:20, rate:0.5, count:1, base:0, priority:1, desc:'神速の突き'},

    // --- 強化・弱体 ---
    {id:50, name:'バイキルト', type:'強化', target:'単体', mp:40, rate:0, count:1, base:20, buff:{atk:1.5}, desc:'攻撃力アップ'},
    {id:51, name:'スカラ', type:'強化', target:'単体', mp:20, rate:0, count:1, base:20, buff:{def:1.5}, desc:'守備力アップ'},
    {id:52, name:'ピオリム', type:'強化', target:'全体', mp:30, rate:0, count:1, base:20, buff:{spd:1.3}, desc:'素早さアップ'},
    {id:53, name:'マジックバリア', type:'強化', target:'全体', mp:40, rate:0, count:1, base:20, buff:{mag:1.5}, desc:'魔法防御アップ'},
    {id:60, name:'ルカニ', type:'弱体', target:'単体', mp:20, rate:0, count:1, base:20, buff:{def:0.7}, desc:'敵の守備ダウン'},
    {id:61, name:'ボミオス', type:'弱体', target:'全体', mp:30, rate:0, count:1, base:20, buff:{spd:0.7}, desc:'敵の素早さダウン'},
    {id:55, name:'フォースブレイク', type: '弱体', target: '単体', mp: 150, rate: 0, count: 1, base: 20, buff: { elmResDown: 100 }, desc: '敵の全属性耐性を激減させる' },
    
    {id:56, name:'ひかりのはどう', type:'強化', target:'全体', mp:250, rate:0, count:1, base:0, buff:{atk:1.1, def:1.1, spd:1.1, mag:1.1}, desc:'味方全体の全ステータスUP'},

    // --- 中級・上級物理（消費10倍近くへ） ---
    {id:101, name:'強撃', type:'物理', target:'単体', mp:40, rate:1.4, count:1, base:60, desc:'力強い一撃'},
    {id:102, name:'渾身斬り', type:'物理', target:'単体', mp:80, rate:1.8, count:1, base:180, desc:'渾身の一撃'},
    {id:103, name:'ギガスラッシュ', type:'物理', target:'全体', mp:150, rate:1.4, count:1, base:200, elm:'光', desc:'光の剣技'},
    {id:104, name:'暗黒剣', type:'物理', target:'単体', mp:120, rate:1.5, count:1, base:190, elm:'闇', desc:'闇の剣技'},
    {id:105, name:'しんくうは', type:'物理', target:'全体', mp:140, rate:1.4, count:2, base:80, elm:'風', desc:'真空の刃'},
    {id:106, name:'天下無双', type:'物理', target:'単体', mp:250, rate:0.6, count:6, base:20, desc:'怒涛の6連撃'},
    {id:107, name:'テールスイング', type:'物理', target:'全体', mp:200, rate:1, count:2, base:1999, desc:'強烈な尻尾攻撃2連'},

    // --- 追加上級物理 ---
    {id:108, name:'超はやぶさ斬り', type:'物理', target:'単体', mp:180, rate:0.7, count:4, base:50, desc:'超高速の4連撃'},
    {id:109, name:'不死鳥天舞', type:'物理', target:'単体', mp:220, rate:0.7, count:4, base:100, drain:true, desc:'再生を伴う4連撃'},
    {id:110, name:'九龍連斬', type:'物理', target:'単体', mp:300, rate:0.6, count:9, base:50, desc:'9頭の龍の如き連撃'},
    {id:111, name:'魔人の絶技', type:'物理', target:'単体', mp:350, rate:1.1, count:6, base:100, desc:'八つの刃で切り刻む'},

    {id:201, name:'五月雨突き', type:'物理', target:'ランダム', mp:80, rate:0.5, count:4, base:20, desc:'4回攻撃'},
    {id:202, name:'爆裂拳', type:'物理', target:'ランダム', mp:100, rate:0.6, count:4, base:20, desc:'4回攻撃'},
    {id:203, name:'さみだれ剣', type:'物理', target:'ランダム', mp:120, rate:0.7, count:4, base:50, desc:'4回斬撃'},

    // --- 中級・上級魔法（消費大幅増） ---
    {id:301, name:'メラミ', type:'魔法', target:'単体', mp:40, rate:1.4, count:1, base:90, elm:'火', desc:'中火球'},
    {id:302, name:'ベギラマ', type:'魔法', target:'全体', mp:70, rate:1.2, count:1, base:80, elm:'火', desc:'灼熱の帯'},
    {id:303, name:'ヒャダルコ', type:'魔法', target:'全体', mp:70, rate:1.2, count:1, base:80, elm:'水', desc:'氷の波動'},
    {id:304, name:'バギマ', type:'魔法', target:'全体', mp:70, rate:1.2, count:1, base:80, elm:'風', desc:'真空の嵐'},
    {id:305, name:'メラゾーマ', type:'魔法', target:'単体', mp:150, rate:2.0, count:1, base:250, elm:'火', desc:'大火球'},
    {id:306, name:'イオナズン', type:'魔法', target:'全体', mp:250, rate:1.5, count:1, base:230, elm:'光', desc:'大爆発'},
    {id:307, name:'ドルモーア', type:'魔法', target:'単体', mp:150, rate:2.0, count:1, base:250, elm:'闇', desc:'闇の爆発'},
    {id:308, name:'イオラ', type:'魔法', target:'全体', mp:100, rate:1.0, count:1, base:90, elm:'光', desc:'中爆発'},
    {id:309, name:'バギクロス', type:'魔法', target:'全体', mp:250, rate:1.5, count:1, base:230, elm:'風', desc:'真空の大嵐'},
    {id:310, name:'ベギラゴン', type:'魔法', target:'全体', mp:250, rate:1.5, count:1, base:230, elm:'火', desc:'灼熱の波動'},

    // --- 最上級・EX・神級（MP消費10倍以上、必殺技化） ---
    {id:401, name:'ギガブレイク', type:'物理', target:'全体', mp:450, rate:2.0, count:1, base:250, elm:'雷', desc:'最強の剣技'},
    {id:402, name:'ゴッドハンド', type:'物理', target:'単体', mp:500, rate:2.1, count:1, base:450, elm:'光', desc:'神の拳'},
    {id:404, name:'プチメテオ', type:'魔法', target:'ランダム', mp:600, rate:0.6, count:7, base:170, elm:'火', desc:'隕石落とし'},
    {id:405, name:'ジゴスパーク', type:'魔法', target:'全体', mp:550, rate:2.0, count:1, base:270, elm:'混沌', desc:'地獄の雷'},
    {id:406, name:'マヒャデドス', type:'魔法', target:'全体', mp:550, rate:2.0, count:1, base:270, elm:'水', desc:'極大氷魔法'},
    {id:407, name:'メラガイアー', type:'魔法', target:'単体', mp:400, rate:2.4, count:1, base:500, elm:'火', desc:'極大火炎'},
    {id:408, name:'ギガデイン', type:'魔法', target:'全体', mp:500, rate:2.1, count:1, base:480, elm:'雷', desc:'極大雷呪文'},
    {id:409, name:'ギガクロスブレイク', type:'物理', target:'単体', mp:650, rate:2.1, count:2, base:400, elm:'雷', desc:'雷の2連撃'},
    {id:410, name:'シャイニング', type:'魔法', target:'全体', mp:600, rate:2.3, count:1, base:500, elm:'光', desc:'聖なる光'},
    {id:411, name:'ラグナブレード', type:'物理', target:'単体', mp:550, rate:4.5, count:1, base:600, elm:'混沌', buff:{def:0.5}, desc:'混沌の一撃'},
    {id:412, name:'イオグランデ', type:'魔法', target:'全体', mp:550, rate:2.1, count:1, base:480, elm:'光', desc:'極大爆発'},
    {id:413, name:'裁きの雷霆', type:'魔法', target:'ランダム', mp:500, rate:0.9, count:5, base:100, elm:'雷', buff:{def:0.5}, desc:'雷魔法超ダメージ5連・守備激減'},
    {id:414, name:'グランドクロス', type:'物理', target:'全体', mp:500, rate:1.0, count:2, base:999, elm:'風', desc:'十字に切り裂く2連撃'},
    {id:415, name:'絶対零度', type:'魔法', target:'単体', mp:600, rate:2.5, count:1, base:450, elm:'水', desc:'凍てつく極大魔法'},
    {id:500, name:'マダンテ', type:'魔法', target:'全体', mp:0, rate:6.0, count:1, base:300, elm:'混沌', desc:'全MPを消費し大爆発'},

    // --- 追加最上級・神級スキル ---
    {id:420, name:'神避', type:'物理', target:'全体', mp:500, rate:1.2, count:1, base:0, priority:1, desc:'神速で全てを薙ぎ払う'},
    {id:421, name:'アルテマソード', type:'物理', target:'単体', mp:600, rate:6.0, count:1, base:500, desc:'究極の剣技'},

    // --- ブレス（MP消費なしのまま、または微増だがブレスはMP0が通例のため維持） ---
    {id:601, name:'火炎の息', type:'魔法', target:'全体', mp:0, rate:0.8, count:1, base:90, elm:'火', desc:'炎の息'},
    {id:602, name:'こごえる吹雪', type:'魔法', target:'全体', mp:0, rate:0.8, count:1, base:100, elm:'水', desc:'冷たい息'},
    {id:603, name:'はげしい炎', type:'魔法', target:'全体', mp:0, rate:0.8, count:1, base:130, elm:'火', desc:'激しい炎'},
    {id:604, name:'かがやく息', type:'魔法', target:'全体', mp:0, rate:0.8, count:1, base:150, elm:'水', desc:'極寒の息'},
    {id:605, name:'しゃくねつ', type:'魔法', target:'全体', mp:0, rate:0.8, count:1, base:200, elm:'火', desc:'灼熱の業火'},
    {id:606, name:'絶対零度', type:'魔法', target:'全体', mp:0, rate:0.8, count:1, base:200, elm:'水', desc:'全てを凍らす息'},
    {id:607, name:'どくのいき', type:'魔法', target:'全体', mp:0, rate:0.8, count:1, base:80, elm:'闇', desc:'毒の息'},
    {id:608, name:'いなずま', type:'魔法', target:'全体', mp:0, rate:0.8, count:1, base:110, elm:'雷', desc:'稲妻'},
    {id:609, name:'煉獄火炎', type:'魔法', target:'全体', mp:0, rate:1.4, count:1, base:250, elm:'混沌', desc:'地獄の炎'},
    {id:610, name:'シャイニングブレス', type:'魔法', target:'全体', mp:50, rate:1.4, count:1, base:150, elm:'光', buff:{atk:0.8, def:0.8, spd:0.8, mag:0.8}, desc:'光のブレス・全能力ダウン'},
    {id:611, name:'ダークネスブレス', type:'魔法', target:'全体', mp:50, rate:1.4, count:1, base:150, elm:'闇', buff:{elmResDown:50}, desc:'闇のブレス・属性耐性ダウン'},
    {id:999, name:'激しい炎', type:'特殊', target:'全体', mp:0, rate:0, count:1, base:500, fix:true, elm:'火', desc:'全体炎'}

    // --- ボス・神級（MP超増加） ---
    {id:901, name:'ジェネシス', type:'魔法', target:'全体', mp:500, rate:3.0, count:1, base:800, elm:'混沌', desc:'【EX】天地創造の光'},
    {id:902, name:'ラグナロク', type:'物理', target:'ランダム', mp:700, rate:1.2, count:5, base:350, elm:'闇', desc:'【EX】終焉の5連撃'},
    {id:903, name:'ザオリーマ', type:'蘇生', target:'全体', mp:1000, rate:0.8, count:1, base:150, desc:'【EX】味方全員を完全蘇生'},
    {id:905, name:'やみのはどう', type:'弱体', target:'全体', mp:500, rate:0, count:1, base:20, buff:{atk:0.7, def:0.7, mag:0.7, spd:0.7}, desc:'全能力ダウン'},
    {id:906, name:'創世の魔力', type:'魔法', target:'全体', mp:1000, rate:3.5, count:1, base:800, elm:'混沌', buff:{atk:0.7, def:0.7, mag:0.7, spd:0.7}, desc:'【EX】世界を創り変える力'},

    // --- 追加ボス専用スキル ---
    {id:920, name:'王者の一閃', type:'物理', target:'単体', mp:300, rate:5.0, count:1, base:0, desc:'王者の威光を纏った一撃'},
    {id:921, name:'サイコキャノン', type:'魔法', target:'単体', mp:300, rate:1.5, count:1, base:500, drain:true, desc:'精神エネルギー砲・HP吸収'},
    {id:922, name:'サイコストーム', type:'魔法', target:'ランダム', mp:700, rate:1.0, count:4, base:300, drain:true, desc:'精神の嵐・HP吸収'},
    {id:923, name:'カラミティエンド', type:'物理', target:'単体', mp:700, rate:6.0, count:1, base:500, buff:{def:0.2}, desc:'厄災の終焉'},
    {id:924, name:'カラミティウォール', type:'魔法', target:'全体', mp:1000, rate:2.0, count:1, base:1000, elm:'混沌', desc:'厄災の壁'},
    {id:925, name:'カイザーフェニックス', type:'魔法', target:'単体', mp:1000, rate:3.0, count:1, base:5000, elm:'火', desc:'皇帝の不死鳥'},

],

    ITEMS: [
        {id:1, name:'やくそう', type:'HP回復', val:100, desc:'HPを約100回復', target:'単体', price:10},
        {id:2, name:'上やくそう', type:'HP回復', val:300, desc:'HPを約300回復', target:'単体', price:50},
        {id:3, name:'魔法の小瓶', type:'MP回復', val:30, desc:'MPを約30回復', target:'単体', price:100},
        {id:4, name:'魔法の聖水', type:'MP回復', val:100, desc:'MPを約100回復', target:'単体', price:500},
        {id:5, name:'世界樹の葉', type:'蘇生', val:100, desc:'死んだ仲間を生き返らせる', target:'単体', price:10000},
        {id:6, name:'世界樹の雫', type:'HP回復', val:99999, desc:'味方全員のHPを全回復', target:'全体', price:500000},
        {id:7, name:'エルフの飲み薬', type:'MP回復', val:9999, desc:'MPを全回復', target:'単体', price:300000},
        {id:99, name:'ちいさなメダル', type:'貴重品', val:0, desc:'世界各地に散らばるメダル', target:'なし', price:0}
    ],
            
CHARACTERS: [
        // --- N (主人公) ---
        {id:301, name:'アルス', job:'勇者', rarity:'N', hp:800, mp:300, atk:190, def:140, spd:120, mag:140, lbSkills:{50:48, 99:903}, sp:1},

        // --- R (ゴースト基準: HP350, MP500, ATK90, MAG130 前後) ---
        // 戦士タイプはHP/ATK高め、魔法タイプはMP/MAG高めに調整
        {id:101, name:'ジョン', job:'戦士', rarity:'R', hp:450, mp:150, atk:110, def:90, spd:70, mag:30, lbSkills:{50:101, 99:44}, sp:1},
        {id:102, name:'マリー', job:'僧侶', rarity:'R', hp:320, mp:550, atk:50, def:60, spd:80, mag:140, lbSkills:{50:20, 99:30}, sp:1},
        {id:103, name:'ボブ', job:'盗賊', rarity:'R', hp:380, mp:200, atk:90, def:70, spd:140, mag:40, lbSkills:{50:41, 99:201}, sp:1},
        {id:104, name:'ケイト', type:'魔法使い', job:'魔法使い', rarity:'R', hp:300, mp:600, atk:40, def:50, spd:90, mag:160, lbSkills:{50:10, 99:301}, sp:1},
        {id:105, name:'ダン', job:'武闘家', rarity:'R', hp:420, mp:120, atk:120, def:80, spd:110, mag:20, lbSkills:{50:41, 99:202}, sp:1},
        {id:106, name:'エミ', job:'踊り子', rarity:'R', hp:340, mp:300, atk:80, def:60, spd:150, mag:100, lbSkills:{50:52, 99:61}, sp:1},
        {id:107, name:'トム', job:'狩人', rarity:'R', hp:360, mp:250, atk:100, def:70, spd:130, mag:60, lbSkills:{50:201, 99:41}, sp:1},
        {id:108, name:'リサ', job:'商人', rarity:'R', hp:400, mp:200, atk:85, def:85, spd:70, mag:70, lbSkills:{50:50, 99:51}, sp:1},
        {id:109, name:'ガイル', job:'傭兵', rarity:'R', hp:480, mp:100, atk:125, def:100, spd:60, mag:20, lbSkills:{50:101, 99:102}, sp:1},
        {id:110, name:'サラ', job:'シスター', rarity:'R', hp:310, mp:580, atk:45, def:55, spd:85, mag:150, lbSkills:{50:21, 99:30}, sp:1},

        // --- SR (ベビーサタン基準: HP平均500, MP400, MAG200 前後) ---
        // ベビーサタンはHP低めだが味方SRとしてはHP500程度を確保しつつ、特化ステータスを伸ばす
        {id:201, name:'アラン', job:'魔法剣士', rarity:'SR', hp:550, mp:350, atk:140, def:120, spd:110, mag:160, lbSkills:{50:42, 99:202}, sp:1},
        {id:202, name:'ソフィア', job:'賢者', rarity:'SR', hp:480, mp:500, atk:80, def:90, spd:100, mag:220, lbSkills:{50:22, 99:306}, sp:1},
        {id:203, name:'ハヤテ', job:'忍者', rarity:'SR', hp:450, mp:300, atk:150, def:80, spd:200, mag:100, lbSkills:{50:41, 99:104}, sp:1},
        {id:204, name:'レイラ', job:'パラディン', rarity:'SR', hp:700, mp:250, atk:130, def:200, spd:70, mag:110, lbSkills:{50:23, 99:401}, sp:1},
        {id:205, name:'バロン', job:'ダークナイト', rarity:'SR', hp:650, mp:300, atk:170, def:140, spd:90, mag:90, lbSkills:{50:104, 99:202}, sp:1},
        {id:206, name:'ミネルバ', job:'ウィザード', rarity:'SR', hp:420, mp:600, atk:60, def:70, spd:120, mag:250, lbSkills:{50:305, 99:306}, sp:1},
        {id:207, name:'ケン', job:'侍', rarity:'SR', hp:600, mp:200, atk:180, def:110, spd:140, mag:50, lbSkills:{50:42, 99:102}, sp:1},
        {id:208, name:'リン', job:'拳法家', rarity:'SR', hp:580, mp:180, atk:175, def:100, spd:160, mag:60, lbSkills:{50:202, 99:401}, sp:1},
        {id:209, name:'シルビア', job:'スーパースター', rarity:'SR', hp:500, mp:450, atk:110, def:110, spd:150, mag:180, lbSkills:{50:52, 99:22}, sp:1},
        {id:210, name:'ゴードン', job:'海賊', rarity:'SR', hp:680, mp:220, atk:160, def:130, spd:100, mag:70, lbSkills:{50:43, 99:201}, sp:1},

        // --- SSR (アークデーモン基準: HP800, MP600, ATK180, MAG250 前後) ---
        // アークデーモン(HP400)は敵としては低めなので、味方SSRとしては倍のHP800程度を基準にする
        {id:302, name:'カイン', job:'竜騎士', rarity:'SSR', hp:900, mp:400, atk:220, def:180, spd:160, mag:120, lbSkills:{50:201, 99:405}, sp:1},
        {id:303, name:'ティナ', job:'召喚士', rarity:'SSR', hp:750, mp:800, atk:100, def:120, spd:140, mag:300, lbSkills:{50:404, 99:901}, sp:1},
        {id:304, name:'クラウド', job:'ソルジャー', rarity:'SSR', hp:950, mp:350, atk:240, def:160, spd:150, mag:100, lbSkills:{50:42, 99:202}, sp:1},
        {id:305, name:'セシル', job:'聖騎士', rarity:'SSR', hp:1000, mp:500, atk:190, def:220, spd:110, mag:180, lbSkills:{50:23, 99:103}, sp:1},
        {id:306, name:'エッジ', job:'上忍', rarity:'SSR', hp:800, mp:450, atk:210, def:130, spd:240, mag:150, lbSkills:{50:302, 99:43}, sp:1},

        // --- UR/EX (さらに強化) ---
        {id:401, name:'ジャンヌ', job:'聖女', rarity:'UR', hp:1500, mp:999, atk:250, def:250, spd:200, mag:600, lbSkills:{50:24, 99:903}, sp:1},
        {id:402, name:'ギル', job:'魔王', rarity:'UR', hp:1800, mp:800, atk:450, def:300, spd:250, mag:450, lbSkills:{50:406, 99:901}, sp:1},
        {id:501, name:'ゼノン', job:'神', rarity:'EX', hp:5000, mp:2000, atk:999, def:800, spd:600, mag:999, lbSkills:{50:55, 99:500}, sp:1}
    ],
    
    MONSTERS: [],
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
        
        { medals: 50, name: 'メタルキングの鎧', type: 'equip', equipId: 901, base: {name:'メタルキングの鎧', type:'体', rank:50, val:20000, data:{def:300, finRed:10}} },
        { medals: 60, name: 'メタルキングの盾', type: 'equip', equipId: 902, base: {name:'メタルキングの盾', type:'盾', rank:80, val:25000, data:{def:260, elmRes:{'火':20,'水':20,'風':20,'雷':20}}} },
        { medals: 70, name: 'メタルキングヘルム', type: 'equip', equipId: 903, base: {name:'メタルキングヘルム', type:'頭', rank:80, val:28000, data:{def:350, mp:250, elmRes:{'光':20,'闇':20}}} },
        { medals: 80, name: 'メタルキングの剣', type: 'equip', equipId: 904, base: {name:'メタルキングの剣', type:'武器', rank:90, val:40000, data:{atk:450, spd:15}} },
        { medals: 90, name: 'メタルキングブーツ', type: 'equip', equipId: 905, base: {name:'メタルキングブーツ', type:'足', rank:90, val:35000, data:{def:30, spd:1000, elmRes:{'混沌':20}}} }
    ]
};

/* database.js (モンスター生成ロジック修正版) */

// データ自動生成
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

// ★修正: カンマ漏れを修正し、mp定義を反映
    const MONSTER_TYPES = [
        { minRank:1,  name:'スライム', hp:300, mp:200, atk:80, def:80, spd:80, mag:50, exp:10, gold:10 },
        { minRank:1,  name:'ドラキー', hp:250, mp:300, atk:90, def:60, spd:130, mag:100, exp:12, gold:15 },
        { minRank:5,  name:'ゴースト', hp:350, mp:500, atk:90, def:70, spd:110, mag:130, exp:20, gold:20 },
        { minRank:10, name:'さまようよろい', hp:400, mp:400, atk:110, def:160, spd:50, mag:20, exp:25, gold:30 },
        { minRank:15, name:'ホイミスライム', hp:280, mp:800, atk:60, def:70, spd:100, mag:120, exp:20, gold:20 },
        { minRank:20, name:'ベビーサタン', hp:250, mp:400, atk:80, def:70, spd:110, mag:200, exp:50, gold:50 },
        { minRank:30, name:'オーク', hp:500, mp:400, atk:130, def:90, spd:70, mag:40, exp:40, gold:35 },
        { minRank:40, name:'アークデーモン', hp:400, mp:600, atk:120, def:100, spd:90, mag:180, exp:100, gold:90 },
        { minRank:50, name:'キラーマシン', hp:450, mp:400, atk:150, def:140, spd:120, mag:30, exp:80, gold:80 },
        { minRank:60, name:'ドラゴン', hp:550, mp:500, atk:170, def:110, spd:80, mag:80, exp:150, gold:120 },
        { minRank:80, name:'キラーマシン2', hp:650, mp:500, atk:200, def:180, spd:130, mag:50, exp:250, gold:250, actCount:2 }
    ];

    // --- 雑魚敵用スキルセット ---
    const MONSTER_SKILL_SETS = {
        'スライム': { 
            low: [1, 10, 2], 
            mid: [1, 301, 40, 101], 
            high: [1, 305, 407, 601, 603, 605],
            god: [407, 404, 500, 103, 999] 
        },
        'ドラキー': { 
            low: [1, 14, 2], 
            mid: [1, 307, 61, 46], 
            high: [1, 307, 410, 607, 52],
            god: [405, 415, 609, 310, 500] 
        },
        'さまようよろい': { 
            low: [1, 40, 2], 
            mid: [1, 44, 42, 101], 
            high: [1, 102, 106, 402, 50],
            god: [421, 420, 402, 401, 50] 
        },
        'ゴースト': { 
            low: [1, 10, 60], 
            mid: [1, 301, 14, 607], 
            high: [1, 305, 307, 47, 60],
            god: [406, 411, 415, 47, 60] 
        },
        'オーク': { 
            low: [1, 20, 2], 
            mid: [1, 21, 101, 43], 
            high: [1, 22, 102, 202, 409],
            god: [409, 414, 24, 106] 
        },
        'キラーマシン': { 
            low: [1, 41, 40], 
            mid: [1, 41, 202, 43], 
            high: [1, 203, 401, 105, 302],
            god: [109, 401, 108, 420, 105] 
        },
        'アークデーモン': { 
            low: [1, 302, 2], 
            mid: [1, 308, 304, 601], 
            high: [1, 306, 310, 412, 605],
            god: [412, 407, 500, 609] 
        },
        'ドラゴン': { 
            low: [1, 601, 2], 
            mid: [1, 603, 602, 101], 
            high: [1, 605, 604, 609, 404, 107],
            god: [609, 606, 404, 107, 415] 
        },
        'ホイミスライム': { 
            low: [1, 20, 2], 
            mid: [1, 21, 51, 12], 
            high: [1, 22, 23, 24, 309],
            god: [410, 24, 403, 408] 
        },
        'ベビーサタン': { 
            low: [1, 308, 10], 
            mid: [1, 306, 602, 607], 
            high: [1, 412, 606, 500, 307],
            god: [500, 412, 406, 405] 
        },
        'キラーマシン2': { 
            low: [1, 41, 44], 
            mid: [1, 203, 608, 42], 
            high: [1, 401, 409, 608, 106],
            god: [409, 408, 420, 111] 
        }
    };
// 自動生成ロジック (事前生成ループ)
    for(let r=1; r<=200; r++) {
        // 1. 候補選定
        let candidates = MONSTER_TYPES.filter(m => m.minRank <= r);
        if (candidates.length === 0) candidates = [MONSTER_TYPES[0]];

        // 2. 3体選出
        let indices = Array.from({length: candidates.length}, (_, i) => i);
        // シャッフル
        for(let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const selectedIndices = indices.slice(0, 3);

        const isExtra = r > 100;
        let scale, prefix, actsType;

        // 3. パラメータ計算 (101階で超強化)
        if (!isExtra) {
            // 通常 (1-100)
            scale = 1.0 + (r * 0.4);
            prefix = "";
            if(r % 10 >= 5) prefix = "強・";
            if(r > 50) prefix = "真・";
            if(r > 80) prefix = "極・";

            if (r < 30) actsType = 'low';
            else if (r < 70) actsType = 'mid';
            else actsType = 'high';
        } else {
            // 裏ダンジョン (101-200)
            const extraR = r - 100;
            scale = 70.0 + (extraR * 2.0); // 101F=32倍, 200F=230倍
            prefix = "神・";
            actsType = 'god';
        }

        const hp_exp = 1.2;

        selectedIndices.forEach((idx, i) => {
            const base = candidates[idx];
            let myActs = [1];
            const skillSet = MONSTER_SKILL_SETS[base.name] || MONSTER_SKILL_SETS['スライム'];
            if (skillSet && skillSet[actsType]) {
                myActs = skillSet[actsType];
            }

            const enemy = {
                id: r + (i * 0.01),
                rank: r,
                minF: r,
                name: `${prefix}${base.name} Lv${r}`,
                hp: Math.floor(base.hp * Math.pow(scale, hp_exp)),
                mp: Math.floor(base.mp * scale),
                atk: Math.floor(base.atk * scale),
                def: Math.floor(base.def * scale),
                spd: Math.floor(base.spd * scale),
                mag: Math.floor(base.mag * scale),
                gold: Math.floor(base.gold * scale),
                exp: Math.floor(base.exp * scale),
                acts: myActs,
                actCount: base.actCount || 1,
                drop: null
            };

            // 裏ダンジョンは全属性耐性30%
            if (isExtra) {
                enemy.elmRes = {'火':30, '水':30, '風':30, '雷':30, '光':30, '闇':30, '混沌':30};
            }

            DB.MONSTERS.push(enemy);
        });

        // 30%でホイミスライム追加
        if (Math.random() < 0.3) {
            const hoimiBase = MONSTER_TYPES.find(m => m.name === 'ホイミスライム') || MONSTER_TYPES[0];
            let hoimiActs = MONSTER_SKILL_SETS['ホイミスライム'].low;
            if (r >= 30) hoimiActs = MONSTER_SKILL_SETS['ホイミスライム'].mid;
            if (r >= 70) hoimiActs = MONSTER_SKILL_SETS['ホイミスライム'].high;
            if (isExtra) hoimiActs = MONSTER_SKILL_SETS['ホイミスライム'].god;

            DB.MONSTERS.push({
                id: r + 0.5,
                rank: r,
                minF: r,
                name: `${prefix}${hoimiBase.name} Lv${r}`,
                hp: Math.floor(hoimiBase.hp * Math.pow(scale, hp_exp)),
                mp: Math.floor((100 + r * 10) * (isExtra ? 20 : 1)),
                atk: Math.floor(hoimiBase.atk * scale),
                def: Math.floor(hoimiBase.def * scale),
                spd: Math.floor(hoimiBase.spd * scale),
                mag: Math.floor(hoimiBase.mag * scale),
                gold: Math.floor(hoimiBase.gold * scale),
                exp: Math.floor(hoimiBase.exp * scale),
                acts: hoimiActs,
                actCount: 1,
                drop: null
            });
        }
    }

    // 互換性維持: generateEnemy関数 (既存のdungeon.js/battle.jsが呼んでも動くようにする)
    window.generateEnemy = function(floor) {
        // 事前生成されたリストから、その階層の雑魚敵(actCount未定義またはボスID以外)をランダムに返す
        const candidates = DB.MONSTERS.filter(m => Math.floor(m.rank) === floor && m.id < 1000);
        if (candidates.length > 0) {
            const base = candidates[Math.floor(Math.random() * candidates.length)];
            return JSON.parse(JSON.stringify(base));
        }
        // フォールバック
        return { name:'スライム', hp:50, atk:10, def:10, spd:10, mag:10, exp:1, gold:1, acts:[1] };
    };

    // --- メタル系 ---
    DB.MONSTERS.push({
        id:201, rank:10, minF:5, name:'メタルスライム',
        hp:4, mp:999, atk:50, def:99999, spd:9999, mag:500,
        exp:1000, gold:50, acts:[1, 10, 9], 
        elmRes:{'火':100,'水':100,'風':100,'雷':100,'光':100,'闇':100,'混沌':100}
    });
    DB.MONSTERS.push({
        id:202, rank:40, minF:20, name:'はぐれメタル',
        hp:8, mp:999, atk:150, def:99999, spd:25500, mag:2550,
        exp:20000, gold:200, acts:[1, 302, 9], 
        elmRes:{'火':1000,'水':1000,'風':1000,'雷':1000,'光':1000,'闇':1000,'混沌':1000}
    });
    DB.MONSTERS.push({
        id:203, rank:80, minF:50, name:'メタルキング',
        hp:20, mp:9999, atk:400, def:99999, spd:99999, mag:9999,
        exp:100000, gold:1000, acts:[1, 306, 9], 
        elmRes:{'火':1000,'水':1000,'風':1000,'雷':1000,'光':1000,'闇':1000,'混沌':1000}
    });
    DB.MONSTERS.push({
        id:204, rank:100, minF:101, name:'プラチナキング',
        hp:50, mp:9999, atk:1000, def:99999, spd:9999, mag:20000,
        exp:500000, gold:5000, acts:[1, 406, 407, 9], 
        elmRes:{'火':1000,'水':1000,'風':1000,'雷':1000,'光':1000,'闇':1000,'混沌':1000}
    });
    // --- ボス定義 (10階ごと・スキル強化版) ---

    // 10階: バトルレックス (炎と物理)
    DB.MONSTERS.push({
        id: 1010, rank: 10, minF: 999, name: 'バトルレックス',
        hp: 10000, mp: 1000, atk: 520, def: 350, spd: 150, mag: 150,
        exp: 1000, gold: 500,
        acts: [1, 40, 101, 44, 601, 603], // 攻撃, 火炎斬り, 強撃, 兜割り, 火炎の息, 激しい炎, しゃくねつ
        actCount: 1
    });

    // 20階: 魔王のつかい (魔法とランダム物理・2回)
    DB.MONSTERS.push({
        id: 1020, rank: 20, minF: 999, name: '魔王のつかい',
        hp: 15000, mp: 1200, atk: 950, def: 520, spd: 580, mag: 850,
        exp: 2000, gold: 1000,
        acts: [1, 301, 302, 303, 201, 202, 307], // メラミ, ベギラマ, ヒャダルコ, 五月雨, 爆裂, ドルモーア
        actCount: 2
    });

    // 30階: デュラン (中級物理・2回)
    DB.MONSTERS.push({
        id: 1030, rank: 30, minF: 999, name: 'デュラン',
        hp: 22000, mp: 2500, atk: 1600, def: 900, spd: 850, mag: 800,
        exp: 4000, gold: 2000,
        acts: [1, 41, 44, 101, 102, 104, 105], // はやぶさ, 兜割り, 強撃, 渾身, 暗黒剣, しんくうは
        actCount: 2
    });

    // 40階: ジャミラス (ブレス、魔法・2回)
    DB.MONSTERS.push({
        id: 1040, rank: 40, minF: 999, name: 'ジャミラス',
        hp: 35000, mp: 3300, atk: 2500, def: 2550, spd: 1050, mag: 2300,
        exp: 6000, gold: 3000,
        acts: [1, 304, 309, 601, 603, 605], // バギマ, バギクロス, 火炎の息, 激しい炎, しゃくねつ
        actCount: 2
    });

    // 50階: グラコス (上級物理、弱体、水・2回)
    DB.MONSTERS.push({
        id: 1050, rank: 50, minF: 999, name: 'グラコス',
        hp: 48000, mp: 4200, atk: 3300, def: 4300, spd: 1500, mag: 3100,
        exp: 10000, gold: 5000,
        acts: [1, 42, 303, 602, 604, 60, 61], // 氷結斬り, ヒャダルコ, こごえる吹雪, かがやく息, ルカニ, ボミオス
        actCount: 2
    });

    // 60階: ムドー (上級魔法、ブレス、状態異常・2回)
    DB.MONSTERS.push({
        id: 1060, rank: 60, minF: 999, name: 'ムドー',
        hp: 80000, mp: 6800, atk: 3400, def: 4750, spd: 2740, mag: 6500,
        exp: 15000, gold: 8000,
        acts: [305, 306, 307, 605, 606, 607], // メラゾーマ, イオナズン, ドルモーア, しゃくねつ, 絶対零度, 毒の息
        actCount: 2
    });

    // 70階: アクバー (上級魔法、上級物理・2回)
    DB.MONSTERS.push({
        id: 1070, rank: 70, minF: 999, name: 'アクバー',
        hp: 105000, mp: 8000, atk: 6600, def: 5400, spd: 2950, mag: 7600,
        exp: 20000, gold: 10000,
        acts: [1, 103, 306, 405, 406, 407, 53], // ギガスラ, イオナズン, ジゴスパ, マヒャデ, メラガイアー, マジックバリア
        actCount: 2
    });

    // 80階: 悪霊の神々 (3体)
    DB.MONSTERS.push({
        id: 1080, rank: 80, minF: 999, name: 'アトラス',
        hp: 105000, mp: 6000, atk: 7500, def: 2000, spd: 1150, mag: 1450,
        exp: 10000, gold: 5000, acts: [1, 101, 102, 44, 409, 106], actCount: 1 // 天下無双追加
    });
    DB.MONSTERS.push({
        id: 1081, rank: 80, minF: 999, name: 'バズズ',
        hp: 75000, mp: 6500, atk: 6000, def: 5300, spd: 3500, mag: 6700,
        exp: 10000, gold: 5000, acts: [13, 306, 500, 30, 60, 61, 406], actCount: 1
    });
    DB.MONSTERS.push({
        id: 1082, rank: 80, minF: 999, name: 'ベリアル',
        hp: 80000, mp: 8400, atk: 6700, def: 6000, spd: 2450, mag: 6500,
        exp: 10000, gold: 5000, acts: [1, 305, 306, 22, 50, 412, 609], actCount: 1 // 煉獄火炎追加
    });

    // 90階: ハーゴン (超級魔法)
    DB.MONSTERS.push({
        id: 1090, rank: 90, minF: 999, name: 'ハーゴン',
        hp: 180000, mp: 8000, atk: 5600, def: 6700, spd: 3500, mag: 8800,
        exp: 50000, gold: 20000,
        acts: [404, 405, 406, 407, 412, 500, 905, 81], // メテオ〜イオグランデ、マダンテ、やみのはどう
        actCount: 2
    });

// 100階: シドー (破壊神・3回)
    DB.MONSTERS.push({
        id: 1100, rank: 100, minF: 999, name: 'シドー',
        hp: 250000, mp: 9999, atk: 9999, def: 9999, spd: 3800, mag: 9999,
        exp: 100000, gold: 50000,
        acts: [1, 103, 404, 407, 609, 23, 60, 411, 80], // 煉獄火炎、ラグナブレード追加
        elmRes: {'火':20, '水':20, '風':20, '雷':20, '光':20, '闇':20, '混沌':20}, // ★全属性耐性20%
        actCount: 3 
    });

// --- 110階〜 裏ボス定義 ---

    // 110階: レグナードⅠ (既存強化)
    DB.MONSTERS.push({
        id: 1110, rank: 110, minF: 110, name: 'レグナードⅠ', 
        hp: 400000, mp: 99999, atk: 13500, def: 13500, spd: 4200, mag: 13500, 
        exp: 200000, gold: 100000, 
        acts: [1, 401, 402, 405, 406, 901, 902, 905, 609, 610, 611, 413, 107],
        elmRes: {'火':20, '水':20, '風':20, '雷':20, '光':20, '闇':20, '混沌':20},
        actCount: 3 
    });

    // 120階: 大魔王ゾーマ (氷・闇・サイコ系)
    DB.MONSTERS.push({
        id: 1120, rank: 120, minF: 120, name: '大魔王ゾーマ', 
        hp: 550000, mp: 99999, atk: 10000, def: 9500, spd: 5200, mag: 18000, 
        exp: 300000, gold: 150000, 
        acts: [406, 415, 307, 921, 922, 606, 905], // マヒャデドス, 絶対零度, ドルモーア, サイコキャノン/ストーム
        elmRes: {'水':100, '闇':100}, 
        actCount: 3 
    });

    // 130階: しんりゅう (ブレス・神級技)
    DB.MONSTERS.push({
        id: 1130, rank: 130, minF: 130, name: 'しんりゅう', 
        hp: 700000, mp: 99999, atk: 17000, def: 14000, spd: 5000, mag: 16000, 
        exp: 400000, gold: 200000, 
        acts: [609, 610, 611, 404, 420, 402, 901], // 煉獄火炎, ブレス系, プチメテオ, 神避, ゴッドハンド, ジェネシス
        elmRes: {'風':100, '光':100, '混沌':100}, 
        actCount: 3 
    });

    // 140階: レグナードⅡ (全属性40%耐性)
    DB.MONSTERS.push({
        id: 1140, rank: 140, minF: 140, name: 'レグナードⅡ', 
        hp: 900000, mp: 99999, atk: 20000, def: 15000, spd: 5500, mag: 20000, 
        exp: 500000, gold: 250000, 
        acts: [1, 401, 402, 901, 902, 609, 610, 611, 413, 107],
        elmRes: {'火':40, '水':40, '風':40, '雷':40, '光':40, '闇':40, '混沌':40},
        actCount: 3 
    });

    // 150階: 四天王強 (4体)
    DB.MONSTERS.push({
        id: 1150, rank: 150, minF: 150, name: 'グラコス強', 
        hp: 400000, mp: 99999, atk: 19000, def: 12000, spd: 4000, mag: 14000, exp: 200000, gold: 100000, acts: [42, 406, 606, 421], actCount: 2 
    });
    DB.MONSTERS.push({
        id: 1151, rank: 150, minF: 150, name: 'ジャミラス強', 
        hp: 350000, mp: 99999, atk: 18000, def: 11000, spd: 6000, mag: 15000, exp: 200000, gold: 100000, acts: [309, 414, 605, 610], actCount: 2 
    });
    DB.MONSTERS.push({
        id: 1152, rank: 150, minF: 150, name: 'ムドー強', 
        hp: 380000, mp: 99999, atk: 14000, def: 13000, spd: 3500, mag: 18000, exp: 200000, gold: 100000, acts: [305, 407, 306, 412, 607, 905], actCount: 2 
    });
    DB.MONSTERS.push({
        id: 1153, rank: 150, minF: 150, name: 'デュラン強', 
        hp: 500000, mp: 99999, atk: 22000, def: 15000, spd: 5000, mag: 9000, exp: 200000, gold: 100000, acts: [102, 106, 401, 402, 420], actCount: 2 
    });

    // 160階: デスタムーア最終形態 (右手・本体・左手)
    DB.MONSTERS.push({
        id: 1160, rank: 160, minF: 160, name: 'デスタムーア左手', // 物理＆蘇生
        hp: 420000, mp: 99999, atk: 27000, def: 13000, spd: 6000, mag: 5000, 
        exp: 0, gold: 0, acts: [106, 401, 409, 411, 414, 31, 903], actCount: 2 // ザオリク, リザレクション
    });
    DB.MONSTERS.push({
        id: 1161, rank: 160, minF: 160, name: 'デスタムーア', // 本体：ブレス
        hp: 800000, mp: 99999, atk: 20000, def: 20000, spd: 5000, mag: 25000, 
        exp: 800000, gold: 400000, acts: [605, 606, 609, 610, 611, 999, 905], 
        elmRes: {'火':20, '水':20, '風':20, '雷':20, '光':20, '闇':20, '混沌':20},
        actCount: 2
    });
    DB.MONSTERS.push({
        id: 1162, rank: 160, minF: 160, name: 'デスタムーア右手', // 魔法＆回復
        hp: 400000, mp: 99999, atk: 10000, def: 15000, spd: 4000, mag: 27000, 
        exp: 0, gold: 0, acts: [407, 406, 412, 405, 24, 403], actCount: 2 // ベホマズン, フルケア
    });

    // 170階: レグナードⅢ (全属性60%耐性)
    DB.MONSTERS.push({
        id: 1170, rank: 170, minF: 170, name: 'レグナードⅢ', 
        hp: 1500000, mp: 99999, atk: 30000, def: 25000, spd: 7000, mag: 30000, 
        exp: 1000000, gold: 500000, 
        acts: [1, 401, 402, 901, 902, 609, 610, 611, 413, 107, 420],
        elmRes: {'火':60, '水':60, '風':60, '雷':60, '光':60, '闇':60, '混沌':60},
        actCount: 3 
    });

    // 180階: ダークドレアム (物理最強)
    DB.MONSTERS.push({
        id: 1180, rank: 180, minF: 180, name: 'ダークドレアム', 
        hp: 2000000, mp: 99999, atk: 38000, def: 28000, spd: 8000, mag: 20000, 
        exp: 1500000, gold: 750000, 
        acts: [111, 414, 401, 409, 421, 106, 920, 923], // 八刀一閃, グランドクロス, アルテマ, カラミティエンド
        elmRes: {'火':100, '水':100, '風':100, '雷':100},
        actCount: 3 
    });

    // 190階: レグナードⅣ (全属性80%耐性)
    DB.MONSTERS.push({
        id: 1190, rank: 190, minF: 190, name: 'レグナードⅣ', 
        hp: 3000000, mp: 99999, atk: 45000, def: 35000, spd: 9999, mag: 35000, 
        exp: 2000000, gold: 1000000, 
        acts: [1, 401, 402, 901, 902, 609, 610, 611, 413, 107, 420, 906],
        elmRes: {'火':80, '水':80, '風':80, '雷':80, '光':80, '闇':80, '混沌':80},
        actCount: 3 
    });

    // 200階: 大魔王バーン (ラスボス)
    DB.MONSTERS.push({
        id: 1200, rank: 200, minF: 200, name: '大魔王バーン', 
        hp: 5000000, mp: 99999, atk: 55000, def: 45000, spd: 12000, mag: 55000, 
        exp: 9999999, gold: 9999999, 
        acts: [923, 924, 925, 420, 901, 906, 412, 407, 920], // カラミティ系, カイザーフェニックス
        elmRes: {'火':70, '水':70, '風':70, '光':70, '闇':70, '雷':30, '混沌':30},
        actCount: 3 
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
        {uid:'p1', isHero:true, charId:301, name:'アルス', job:'勇者', rarity:'N', level:1, hp:800, mp:300, atk:150, def:120, spd:100, mag:100, limitBreak:0, sp:1,tree:{"ATK":0,"MAG":0,"SPD":0,"HP":0,"MP":0}, equips:{}, alloc:{}}
    ]
};
