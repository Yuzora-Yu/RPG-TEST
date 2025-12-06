/* database.js (完全統合版: 全スキル・全ボス・新計算式対応) */

const CONST = {
    SAVE_KEY: 'QoE_SaveData_v38_BalanceFix', 
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

/* database.js の SKILLS 部分を差し替え */

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
        {id:23, name:'ベホマ', type:'回復', target:'単体', mp:10, rate:0, count:1, base:9999, fix:true, desc:'全回復'},
        {id:24, name:'ベホマズン', type:'回復', target:'全体', mp:30, rate:0, count:1, base:9999, fix:true, desc:'全体全回復'},
        {id:30, name:'ザオラル', type:'蘇生', target:'単体', mp:8, rate:0.5, count:1, base:0, elm:null, desc:'50%蘇生'},
        {id:31, name:'ザオリク', type:'蘇生', target:'単体', mp:20, rate:1.0, count:1, base:0, elm:null, desc:'100%蘇生'},

        // --- 物理スキル ---
        {id:40, name:'火炎斬り', type:'物理', target:'単体', mp:4, rate:1.3, count:1, base:5, elm:'火', desc:'炎の剣技'},
        {id:41, name:'はやぶさ斬り', type:'物理', target:'単体', mp:6, rate:0.7, count:2, base:0, elm:null, desc:'2回攻撃'},
        {id:42, name:'氷結斬り', type:'物理', target:'単体', mp:4, rate:1.3, count:1, base:5, elm:'水', desc:'氷の剣技'},
        {id:43, name:'雷鳴突き', type:'物理', target:'単体', mp:4, rate:1.3, count:1, base:5, elm:'雷', desc:'雷の槍技'},
        {id:44, name:'兜割り', type:'物理', target:'単体', mp:4, rate:1.2, count:1, base:5, buff:{def:0.8}, desc:'敵の守備を下げる'},
        {id:45, name:'メタル斬り', type:'物理', target:'単体', mp:5, rate:0, count:1, base:2, fix:true, desc:'メタルに固定ダメージ'},
        
        // ★追加: 風属性物理、混沌属性吸収物理
        {id:46, name:'ウイングアッパー', type:'物理', target:'単体', mp:6, rate:1.4, count:1, base:10, elm:'風', desc:'風の拳'},
        {id:47, name:'ブラッドソード', type:'物理', target:'単体', mp:8, rate:1.5, count:1, base:20, elm:'混沌', drain:true, desc:'HP吸収'},

        // --- 強化・弱体 ---
        {id:50, name:'バイキルト', type:'強化', target:'単体', mp:8, rate:0, count:1, base:0, buff:{atk:1.5}, desc:'攻撃力アップ'},
        {id:51, name:'スカラ', type:'強化', target:'単体', mp:4, rate:0, count:1, base:0, buff:{def:1.5}, desc:'守備力アップ'},
        {id:52, name:'ピオリム', type:'強化', target:'全体', mp:6, rate:0, count:1, base:0, buff:{spd:1.3}, desc:'素早さアップ'},
        {id:53, name:'マジックバリア', type:'強化', target:'全体', mp:8, rate:0, count:1, base:0, buff:{mag:1.5}, desc:'魔法防御アップ'},
        {id:60, name:'ルカニ', type:'弱体', target:'単体', mp:4, rate:0, count:1, base:0, buff:{def:0.7}, desc:'敵の守備ダウン'},
        {id:61, name:'ボミオス', type:'弱体', target:'全体', mp:6, rate:0, count:1, base:0, buff:{spd:0.7}, desc:'敵の素早さダウン'},

        // --- 中級・上級物理 ---
        {id:101, name:'強撃', type:'物理', target:'単体', mp:5, rate:1.8, count:1, base:10, desc:'力強い一撃'},
        {id:102, name:'渾身斬り', type:'物理', target:'単体', mp:10, rate:2.5, count:1, base:30, desc:'渾身の一撃'},
        {id:103, name:'ギガスラッシュ', type:'物理', target:'全体', mp:15, rate:2.0, count:1, base:50, elm:'光', desc:'光の剣技'},
        {id:104, name:'暗黒剣', type:'物理', target:'単体', mp:12, rate:2.2, count:1, base:40, elm:'闇', desc:'闇の剣技'},
        
        // ★追加: 風属性全体物理、6回攻撃
        {id:105, name:'しんくうは', type:'物理', target:'全体', mp:15, rate:1.8, count:1, base:30, elm:'風', desc:'真空の刃'},
        {id:106, name:'天下無双', type:'物理', target:'単体', mp:30, rate:0.5, count:6, base:0, desc:'怒涛の6連撃'},

        {id:201, name:'五月雨突き', type:'物理', target:'ランダム', mp:10, rate:0.6, count:4, base:0, desc:'4回攻撃'},
        {id:202, name:'爆裂拳', type:'物理', target:'ランダム', mp:12, rate:0.7, count:4, base:0, desc:'4回攻撃'},
        {id:203, name:'さみだれ剣', type:'物理', target:'ランダム', mp:15, rate:0.6, count:4, base:10, desc:'4回斬撃'},

        // --- 中級・上級魔法 ---
        {id:301, name:'メラミ', type:'魔法', target:'単体', mp:6, rate:1.8, count:1, base:40, elm:'火', desc:'中火球'},
        // ★変更: ベギラマを火属性に
        {id:302, name:'ベギラマ', type:'魔法', target:'全体', mp:10, rate:1.5, count:1, base:30, elm:'火', desc:'灼熱の帯'},
        {id:303, name:'ヒャダルコ', type:'魔法', target:'全体', mp:10, rate:1.5, count:1, base:30, elm:'水', desc:'氷の波動'},
        {id:304, name:'バギマ', type:'魔法', target:'全体', mp:10, rate:1.5, count:1, base:30, elm:'風', desc:'真空の嵐'},
        {id:305, name:'メラゾーマ', type:'魔法', target:'単体', mp:15, rate:2.8, count:1, base:100, elm:'火', desc:'大火球'},
        {id:306, name:'イオナズン', type:'魔法', target:'全体', mp:25, rate:2.2, count:1, base:80, elm:'光', desc:'大爆発'},
        {id:307, name:'ドルモーア', type:'魔法', target:'単体', mp:15, rate:2.8, count:1, base:100, elm:'闇', desc:'闇の爆発'},
        {id:308, name:'イオラ', type:'魔法', target:'全体', mp:12, rate:1.2, count:1, base:40, elm:'光', desc:'中爆発'},
        
        // ★追加: 風・火の上級魔法
        {id:309, name:'バギクロス', type:'魔法', target:'全体', mp:25, rate:2.2, count:1, base:80, elm:'風', desc:'真空の大嵐'},
        {id:310, name:'ベギラゴン', type:'魔法', target:'全体', mp:25, rate:2.2, count:1, base:80, elm:'火', desc:'灼熱の波動'},

        // --- 最上級・EX ---
        {id:401, name:'ギガブレイク', type:'物理', target:'全体', mp:30, rate:2.8, count:1, base:100, elm:'雷', desc:'最強の剣技'},
        {id:402, name:'ゴッドハンド', type:'物理', target:'単体', mp:35, rate:3.5, count:1, base:150, elm:'光', desc:'神の拳'},
        {id:403, name:'フルケア', type:'回復', target:'単体', mp:40, rate:0, count:1, base:9999, fix:true, desc:'完全回復'},
        // ★変更: メテオを混沌属性に
        {id:404, name:'メテオ', type:'魔法', target:'全体', mp:50, rate:3.0, count:1, base:150, elm:'混沌', desc:'隕石落とし'},
        {id:405, name:'ジゴスパーク', type:'魔法', target:'全体', mp:45, rate:2.8, count:1, base:120, elm:'雷', desc:'地獄の雷'},
        {id:406, name:'マヒャデドス', type:'魔法', target:'全体', mp:45, rate:2.8, count:1, base:120, elm:'水', desc:'極大氷魔法'},
        {id:407, name:'メラガイアー', type:'魔法', target:'単体', mp:30, rate:4.0, count:1, base:200, elm:'火', desc:'極大火炎'},

        {id:408, name:'ギガデイン', type:'魔法', target:'全体', mp:60, rate:3.5, count:1, base:180, elm:'雷', desc:'極大雷呪文'},
        {id:409, name:'ギガクロスブレイク', type:'物理', target:'単体', mp:50, rate:2.5, count:2, base:100, elm:'雷', desc:'雷の2連撃'},
        {id:410, name:'シャイニング', type:'魔法', target:'全体', mp:70, rate:3.8, count:1, base:200, elm:'光', desc:'聖なる光'},
        {id:411, name:'ラグナブレード', type:'物理', target:'単体', mp:60, rate:5.5, count:1, base:300, elm:'混沌', desc:'混沌の一撃'},
        {id:412, name:'イオグランデ', type:'魔法', target:'全体', mp:65, rate:3.5, count:1, base:180, elm:'光', desc:'極大爆発'},
        
        {id:500, name:'マダンテ', type:'魔法', target:'全体', mp:0, rate:10.0, count:1, base:0, desc:'全MPを消費し大爆発'},

        // --- ブレス ---
        {id:601, name:'火炎の息', type:'魔法', target:'全体', mp:0, rate:1.0, count:1, base:40, elm:'火', desc:'炎の息'},
        {id:602, name:'こごえる吹雪', type:'魔法', target:'全体', mp:0, rate:1.0, count:1, base:50, elm:'水', desc:'冷たい息'},
        {id:603, name:'はげしい炎', type:'魔法', target:'全体', mp:0, rate:1.0, count:1, base:80, elm:'火', desc:'激しい炎'},
        {id:604, name:'かがやく息', type:'魔法', target:'全体', mp:0, rate:1.0, count:1, base:100, elm:'水', desc:'極寒の息'},
        {id:605, name:'しゃくねつ', type:'魔法', target:'全体', mp:0, rate:1.0, count:1, base:150, elm:'火', desc:'灼熱の業火'},
        {id:606, name:'絶対零度', type:'魔法', target:'全体', mp:0, rate:1.0, count:1, base:150, elm:'水', desc:'全てを凍らす息'},
        {id:607, name:'どくのいき', type:'魔法', target:'全体', mp:0, rate:1.0, count:1, base:30, elm:'闇', desc:'毒の息'},
        {id:608, name:'いなずま', type:'魔法', target:'全体', mp:0, rate:1.0, count:1, base:60, elm:'雷', desc:'稲妻'},
        {id:609, name:'煉獄火炎', type:'魔法', target:'全体', mp:0, rate:1.0, count:1, base:200, elm:'混沌', desc:'地獄の炎'},

        // --- ボス・神級 ---
        {id:901, name:'ジェネシス', type:'魔法', target:'全体', mp:100, rate:5.0, count:1, base:500, elm:'混沌', desc:'【EX】天地創造の光'},
        {id:902, name:'ラグナロク', type:'物理', target:'ランダム', mp:80, rate:3.0, count:5, base:50, elm:'闇', desc:'【EX】終焉の5連撃'},
        {id:903, name:'リザレクション', type:'蘇生', target:'全体', mp:200, rate:1.0, count:1, base:100, desc:'【EX】味方全員を完全蘇生'},
        {id:905, name:'やみのはどう', type:'弱体', target:'全体', mp:50, rate:0, count:1, base:0, buff:{atk:0.7, def:0.7, mag:0.7, spd:0.7}, desc:'全能力ダウン'},

        {id:999, name:'激しい炎', type:'特殊', target:'全体', mp:0, rate:0, count:1, base:80, fix:true, elm:'火', desc:'全体炎'}
    ],
    
    CHARACTERS: [
        {id:301, name:'アルス', job:'勇者', rarity:'N', hp:800, mp:300, atk:150, def:120, spd:100, mag:100, lbSkills:{50:42, 99:401}},
        {id:101, name:'ジョン', job:'戦士', rarity:'R', hp:150, mp:20, atk:40, def:30, spd:20, mag:10, lbSkills:{50:101, 99:44}},
        {id:102, name:'マリー', job:'僧侶', rarity:'R', hp:120, mp:50, atk:20, def:20, spd:25, mag:40, lbSkills:{50:20, 99:30}},
        {id:103, name:'ボブ', job:'盗賊', rarity:'R', hp:130, mp:30, atk:30, def:20, spd:50, mag:10, lbSkills:{50:41, 99:201}},
        {id:104, name:'ケイト', type:'魔法使い', job:'魔法使い', rarity:'R', hp:100, mp:60, atk:10, def:15, spd:30, mag:50, lbSkills:{50:10, 99:301}},
        {id:105, name:'ダン', job:'武闘家', rarity:'R', hp:160, mp:10, atk:45, def:25, spd:40, mag:5, lbSkills:{50:41, 99:202}},
        {id:106, name:'エミ', job:'踊り子', rarity:'R', hp:120, mp:40, atk:25, def:20, spd:55, mag:30, lbSkills:{50:52, 99:61}},
        {id:107, name:'トム', job:'狩人', rarity:'R', hp:140, mp:25, atk:35, def:25, spd:45, mag:10, lbSkills:{50:201, 99:41}},
        {id:108, name:'リサ', job:'商人', rarity:'R', hp:150, mp:20, atk:30, def:30, spd:20, mag:20, lbSkills:{50:50, 99:51}},
        {id:109, name:'ガイル', job:'傭兵', rarity:'R', hp:170, mp:15, atk:42, def:35, spd:15, mag:5, lbSkills:{50:101, 99:102}},
        {id:110, name:'サラ', job:'シスター', rarity:'R', hp:110, mp:55, atk:15, def:15, spd:30, mag:45, lbSkills:{50:21, 99:30}},
        {id:201, name:'アラン', job:'魔法剣士', rarity:'SR', hp:250, mp:80, atk:60, def:50, spd:40, mag:60, lbSkills:{50:42, 99:202}},
        {id:202, name:'ソフィア', job:'賢者', rarity:'SR', hp:220, mp:120, atk:40, def:40, spd:35, mag:90, lbSkills:{50:22, 99:306}},
        {id:203, name:'ハヤテ', job:'忍者', rarity:'SR', hp:200, mp:60, atk:70, def:30, spd:80, mag:40, lbSkills:{50:41, 99:104}},
        {id:204, name:'レイラ', job:'パラディン', rarity:'SR', hp:350, mp:50, atk:50, def:90, spd:20, mag:40, lbSkills:{50:23, 99:401}},
        {id:205, name:'バロン', job:'ダークナイト', rarity:'SR', hp:300, mp:60, atk:80, def:60, spd:30, mag:30, lbSkills:{50:104, 99:202}},
        {id:206, name:'ミネルバ', job:'ウィザード', rarity:'SR', hp:180, mp:150, atk:20, def:30, spd:50, mag:110, lbSkills:{50:305, 99:306}},
        {id:207, name:'ケン', job:'侍', rarity:'SR', hp:280, mp:40, atk:85, def:40, spd:60, mag:10, lbSkills:{50:42, 99:102}},
        {id:208, name:'リン', job:'拳法家', rarity:'SR', hp:260, mp:50, atk:75, def:35, spd:70, mag:20, lbSkills:{50:202, 99:401}},
        {id:209, name:'シルビア', job:'スーパースター', rarity:'SR', hp:240, mp:100, atk:50, def:50, spd:60, mag:60, lbSkills:{50:52, 99:22}},
        {id:210, name:'ゴードン', job:'海賊', rarity:'SR', hp:320, mp:40, atk:70, def:60, spd:40, mag:20, lbSkills:{50:43, 99:201}},
        {id:302, name:'カイン', job:'竜騎士', rarity:'SSR', hp:500, mp:100, atk:120, def:90, spd:70, mag:40, lbSkills:{50:201, 99:405}},
        {id:303, name:'ティナ', job:'召喚士', rarity:'SSR', hp:400, mp:200, atk:50, def:60, spd:60, mag:140, lbSkills:{50:404, 99:901}},
        {id:304, name:'クラウド', job:'ソルジャー', rarity:'SSR', hp:550, mp:80, atk:130, def:80, spd:65, mag:50, lbSkills:{50:42, 99:202}},
        {id:305, name:'セシル', job:'聖騎士', rarity:'SSR', hp:600, mp:120, atk:100, def:110, spd:50, mag:70, lbSkills:{50:23, 99:103}},
        {id:306, name:'エッジ', job:'上忍', rarity:'SSR', hp:450, mp:90, atk:110, def:60, spd:100, mag:60, lbSkills:{50:302, 99:43}},
        {id:401, name:'ジャンヌ', job:'聖女', rarity:'UR', hp:1200, mp:500, atk:100, def:150, spd:120, mag:300, lbSkills:{50:403, 99:903}},
        {id:402, name:'ギル', job:'魔王', rarity:'UR', hp:1500, mp:400, atk:300, def:200, spd:100, mag:250, lbSkills:{50:402, 99:901}},
        {id:501, name:'ゼノン', job:'神', rarity:'EX', hp:4000, mp:1500, atk:900, def:600, spd:400, mag:800, lbSkills:{50:901, 99:903}}
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
        { medals: 80, name: 'メタルキングの剣', type: 'equip', equipId: 904, base: {name:'メタルキングの剣', type:'武器', rank:90, val:40000, data:{atk:160, spd:15}} },
        // ★追加: 素早さ特化の足装備
        { medals: 90, name: 'メタルキングブーツ', type: 'equip', equipId: 905, base: {name:'メタルキングブーツ', type:'足', rank:90, val:35000, data:{def:30, spd:100, elmRes:{'混沌':20}}} }
    ]
};

 /* database.js の // データ自動生成 以降を上書き */

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

   
/* database.js の 雑魚敵生成ロジック部分 (上書き用) */

    // ★修正: 基礎ステータスを高めに設定しつつ、個性を強調
    const MONSTER_TYPES = [
        // 名前, HP, 攻, 防, 速, 魔, 経験値, 金
        { name:'スライム', hp:300, atk:80, def:80, spd:80, mag:50, exp:10, gold:10 },       // バランス・最弱
        { name:'ドラキー', hp:250, atk:90, def:60, spd:130, mag:100, exp:12, gold:15 },     // 高速・魔法
        { name:'さまようよろい', hp:500, atk:110, def:160, spd:50, mag:20, exp:25, gold:30 }, // 高耐久・鈍足
        { name:'ゴースト', hp:350, atk:90, def:70, spd:110, mag:130, exp:20, gold:20 },     // 魔法・素早い
        { name:'オーク', hp:800, atk:130, def:90, spd:70, mag:40, exp:40, gold:35 },        // 高HP・パワー
        { name:'キラーマシン', hp:600, atk:150, def:140, spd:120, mag:30, exp:80, gold:80 },// 高ステータス物理
        { name:'アークデーモン', hp:700, atk:120, def:100, spd:90, mag:180, exp:100, gold:90 }, // 高魔力・タフ
        { name:'ドラゴン', hp:1000, atk:170, def:110, spd:80, mag:80, exp:150, gold:120 },  // 全体的に高い
        { name:'ホイミスライム', hp:400, atk:60, def:70, spd:100, mag:120, exp:20, gold:20 }, // 回復役・そこそこ速い
        { name:'ベビーサタン', hp:450, atk:80, def:70, spd:110, mag:200, exp:50, gold:50 },   // 高魔力・紙装甲
        { name:'キラーマシン2', hp:900, atk:200, def:180, spd:150, mag:50, exp:250, gold:250, actCount:2 } // 最強雑魚
    ];

/* database.js の MONSTER_SKILL_SETS 定義以降を上書き */

    // 種類ごとのランク別スキル設定 (新スキル・ブレス対応版)
    // low: 1-30F, mid: 31-70F, high: 71-100F
    const MONSTER_SKILL_SETS = {
        'スライム': { 
            low: [1, 10, 2],                  // 攻撃, メラ, 防御
            mid: [1, 301, 40, 101],           // 攻撃, メラミ, 火炎斬り, 強撃
            high: [1, 305, 407, 601, 603]     // 攻撃, メラゾーマ, メラガイアー, 火炎の息, 激しい炎
        },
        'ドラキー': { 
            low: [1, 14, 2],                  // 攻撃, ドルマ, 防御
            mid: [1, 307, 61, 46],            // 攻撃, ドルモーア, ボミオス, ウイングアッパー
            high: [1, 307, 410, 607, 52]      // 攻撃, ドルモーア, シャイニング, 毒の息, ピオリム
        },
        'さまようよろい': { 
            low: [1, 40, 2],                  // 攻撃, 火炎斬り, 防御
            mid: [1, 44, 42, 101],            // 攻撃, 兜割り, 氷結斬り, 強撃
            high: [1, 102, 106, 402, 50]      // 攻撃, 渾身, 天下無双, ゴッドハンド, バイキルト
        },
        'ゴースト': { 
            low: [1, 10, 60],                 // 攻撃, メラ, ルカニ
            mid: [1, 301, 14, 607],           // 攻撃, メラミ, ドルマ, 毒の息
            high: [1, 305, 307, 47, 60]       // 攻撃, メラゾーマ, ドルモーア, ブラッドソード, ルカニ
        },
        'オーク': { 
            low: [1, 20, 2],                  // 攻撃, ホイミ, 防御
            mid: [1, 21, 101, 43],            // 攻撃, ベホイミ, 強撃, 雷鳴突き
            high: [1, 22, 102, 202, 409]      // 攻撃, ベホマラー, 渾身, 爆裂拳, ギガクロスブレイク
        },
        'キラーマシン': { 
            low: [1, 41, 40],                 // 攻撃, はやぶさ, 火炎斬り
            mid: [1, 41, 202, 43],            // 攻撃, はやぶさ, 爆裂拳, 雷鳴突き
            high: [1, 203, 401, 105, 302]     // 攻撃, さみだれ剣, ギガブレイク, しんくうは, ベギラマ
        },
        'アークデーモン': { 
            low: [1, 302, 2],                 // 攻撃, ベギラマ, 防御
            mid: [1, 308, 304, 601],          // 攻撃, イオラ, バギマ, 火炎の息
            high: [1, 306, 310, 412, 605]     // 攻撃, イオナズン, ベギラゴン, イオグランデ, しゃくねつ
        },
        'ドラゴン': { 
            low: [1, 601, 2],                 // 攻撃, 火炎の息, 防御
            mid: [1, 603, 602, 101],          // 攻撃, 激しい炎, こごえる吹雪, 強撃
            high: [1, 605, 604, 609, 404]     // 攻撃, しゃくねつ, かがやく息, 煉獄火炎, メテオ
        },
        'ホイミスライム': { 
            low: [1, 20, 2],                  // 攻撃, ホイミ, 防御
            mid: [1, 21, 51, 12],             // 攻撃, ベホイミ, スカラ, バギ
            high: [1, 22, 23, 24, 309]        // 攻撃, ベホマラー, ベホマ, ベホマズン, バギクロス
        },
        'ベビーサタン': { 
            low: [1, 308, 10],                // 攻撃, イオラ, メラ
            mid: [1, 306, 602, 607],          // 攻撃, イオナズン, こごえる吹雪, 毒の息
            high: [1, 412, 606, 500, 307]     // 攻撃, イオグランデ, 絶対零度, マダンテ, ドルモーア
        },
        'キラーマシン2': { 
            low: [1, 41, 44],                 // 攻撃, はやぶさ, 兜割り
            mid: [1, 203, 608, 42],           // 攻撃, さみだれ剣, 稲妻, 氷結斬り
            high: [1, 401, 409, 608, 106]     // 攻撃, ギガブレイク, ギガクロス, 稲妻, 天下無双
        }
    };

    for(let r=1; r<=100; r++) {
        const typeIdx = Math.floor((r - 1) / (100 / MONSTER_TYPES.length));
        const base = MONSTER_TYPES[Math.min(typeIdx, MONSTER_TYPES.length - 1)];
        
        const scale_factor = 0.3; 
        const hp_exp = 1.2; 

        const scale = 1.0 + (r * scale_factor); 
        
        let prefix = "";
        if(r % 10 >= 5) prefix = "強・";
        if(r > 50) prefix = "真・";
        if(r > 80) prefix = "極・";

        let myActs = [1];
        const skillSet = MONSTER_SKILL_SETS[base.name];
        if (skillSet) {
            let sourceActs = [];
            if (r < 30) sourceActs = skillSet.low;
            else if (r < 70) sourceActs = skillSet.mid;
            else sourceActs = skillSet.high;
            myActs = sourceActs; 
        }

        // 1ランクにつき2体生成
        for(let i=0; i<2; i++) {
            DB.MONSTERS.push({
                id: r + (i * 0.1),
                rank: r,
                minF: r,
                name: `${prefix}${base.name} Lv${r}`,
                hp: Math.floor(base.hp * Math.pow(scale, hp_exp)), 
                mp: 50 + r * 5,
                atk: Math.floor(base.atk * scale),
                def: Math.floor(base.def * scale),
                spd: Math.floor(base.spd * scale),
                mag: Math.floor(base.mag * scale),
                gold: Math.floor(base.gold * scale),
                exp: Math.floor(base.exp * scale),
                acts: myActs,
                actCount: base.actCount || 1,
                drop: null
            });
        }

        // 30%でホイミスライム追加
        if (Math.random() < 0.3) {
            const hoimiBase = MONSTER_TYPES.find(m => m.name === 'ホイミスライム');
            let hoimiActs = MONSTER_SKILL_SETS['ホイミスライム'].low;
            if (r >= 30) hoimiActs = MONSTER_SKILL_SETS['ホイミスライム'].mid;
            if (r >= 70) hoimiActs = MONSTER_SKILL_SETS['ホイミスライム'].high;

            DB.MONSTERS.push({
                id: r + 0.5,
                rank: r,
                minF: r,
                name: `${prefix}ホイミン Lv${r}`,
                hp: Math.floor(hoimiBase.hp * Math.pow(scale, hp_exp)),
                mp: 100 + r * 10,
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

    // --- メタル系 ---
    DB.MONSTERS.push({
        id:201, rank:10, minF:5, name:'メタルスライム',
        hp:4, mp:999, atk:50, def:9999, spd:999, mag:50,
        exp:1000, gold:50, acts:[1, 10, 9], 
        elmRes:{'火':100,'水':100,'風':100,'雷':100,'光':100,'闇':100}
    });
    DB.MONSTERS.push({
        id:202, rank:40, minF:20, name:'はぐれメタル',
        hp:8, mp:999, atk:150, def:9999, spd:999, mag:100,
        exp:10000, gold:200, acts:[1, 302, 9], 
        elmRes:{'火':100,'水':100,'風':100,'雷':100,'光':100,'闇':100}
    });
    DB.MONSTERS.push({
        id:203, rank:80, minF:50, name:'メタルキング',
        hp:20, mp:999, atk:400, def:9999, spd:999, mag:300,
        exp:30000, gold:1000, acts:[1, 306, 9], 
        elmRes:{'火':100,'水':100,'風':100,'雷':100,'光':100,'闇':100}
    });
    DB.MONSTERS.push({
        id:204, rank:100, minF:101, name:'プラチナキング',
        hp:50, mp:999, atk:1000, def:9999, spd:999, mag:500,
        exp:100000, gold:5000, acts:[1, 406, 407, 9], 
        elmRes:{'火':100,'水':100,'風':100,'雷':100,'光':100,'闇':100}
    });

    // --- ボス定義 (10階ごと・スキル強化版) ---

    // 10階: バトルレックス (炎と物理)
    DB.MONSTERS.push({
        id: 1010, rank: 10, minF: 999, name: 'バトルレックス',
        hp: 3000, mp: 100, atk: 200, def: 100, spd: 50, mag: 50,
        exp: 1000, gold: 500,
        acts: [1, 40, 101, 44, 601, 603], // 攻撃, 火炎斬り, 強撃, 兜割り, 火炎の息, 激しい炎
        actCount: 1
    });

    // 20階: 魔王のつかい (魔法とランダム物理・2回)
    DB.MONSTERS.push({
        id: 1020, rank: 20, minF: 999, name: '魔王のつかい',
        hp: 5000, mp: 200, atk: 250, def: 150, spd: 80, mag: 150,
        exp: 2000, gold: 1000,
        acts: [1, 301, 302, 303, 201, 202, 307], // メラミ, ベギラマ, ヒャダルコ, 五月雨, 爆裂, ドルモーア
        actCount: 2
    });

    // 30階: デュラン (中級物理・2回)
    DB.MONSTERS.push({
        id: 1030, rank: 30, minF: 999, name: 'デュラン',
        hp: 8000, mp: 200, atk: 400, def: 200, spd: 100, mag: 100,
        exp: 4000, gold: 2000,
        acts: [1, 41, 44, 101, 102, 104, 105], // はやぶさ, 兜割り, 強撃, 渾身, 暗黒剣, しんくうは
        actCount: 2
    });

    // 40階: ジャミラス (ブレス、魔法・2回)
    DB.MONSTERS.push({
        id: 1040, rank: 40, minF: 999, name: 'ジャミラス',
        hp: 12000, mp: 300, atk: 350, def: 250, spd: 150, mag: 300,
        exp: 6000, gold: 3000,
        acts: [1, 304, 309, 601, 603, 605], // バギマ, バギクロス, 火炎の息, 激しい炎, しゃくねつ
        actCount: 2
    });

    // 50階: グラコス (上級物理、弱体、水・2回)
    DB.MONSTERS.push({
        id: 1050, rank: 50, minF: 999, name: 'グラコス',
        hp: 18000, mp: 400, atk: 500, def: 300, spd: 120, mag: 200,
        exp: 10000, gold: 5000,
        acts: [1, 42, 303, 602, 604, 60, 61], // 氷結斬り, ヒャダルコ, こごえる吹雪, かがやく息, ルカニ, ボミオス
        actCount: 2
    });

    // 60階: ムドー (上級魔法、ブレス、状態異常・2回)
    DB.MONSTERS.push({
        id: 1060, rank: 60, minF: 999, name: 'ムドー',
        hp: 25000, mp: 500, atk: 400, def: 350, spd: 140, mag: 500,
        exp: 15000, gold: 8000,
        acts: [305, 306, 307, 605, 606, 607, 52, 60], // メラゾーマ, イオナズン, ドルモーア, しゃくねつ, 絶対零度, 毒の息, ピオリム, ルカニ
        actCount: 2
    });

    // 70階: アクバー (上級魔法、上級物理・2回)
    DB.MONSTERS.push({
        id: 1070, rank: 70, minF: 999, name: 'アクバー',
        hp: 35000, mp: 600, atk: 600, def: 400, spd: 160, mag: 600,
        exp: 20000, gold: 10000,
        acts: [1, 103, 306, 405, 406, 407, 53], // ギガスラ, イオナズン, ジゴスパ, マヒャデ, メラガイアー, マジックバリア
        actCount: 2
    });

    // 80階: 悪霊の神々 (3体)
    DB.MONSTERS.push({
        id: 1080, rank: 80, minF: 999, name: 'アトラス',
        hp: 40000, mp: 100, atk: 1200, def: 400, spd: 150, mag: 50,
        exp: 10000, gold: 5000, acts: [1, 101, 102, 44, 409, 106], actCount: 1 // 天下無双追加
    });
    DB.MONSTERS.push({
        id: 1081, rank: 80, minF: 999, name: 'バズズ',
        hp: 25000, mp: 500, atk: 500, def: 300, spd: 250, mag: 700,
        exp: 10000, gold: 5000, acts: [13, 306, 500, 30, 60, 61, 406], actCount: 1
    });
    DB.MONSTERS.push({
        id: 1082, rank: 80, minF: 999, name: 'ベリアル',
        hp: 30000, mp: 400, atk: 700, def: 400, spd: 180, mag: 500,
        exp: 10000, gold: 5000, acts: [1, 305, 306, 22, 50, 412, 609], actCount: 1 // 煉獄火炎追加
    });

    // 90階: ハーゴン (超級魔法)
    DB.MONSTERS.push({
        id: 1090, rank: 90, minF: 999, name: 'ハーゴン',
        hp: 60000, mp: 999, atk: 600, def: 500, spd: 200, mag: 900,
        exp: 50000, gold: 20000,
        acts: [404, 405, 406, 407, 412, 500, 905], // メテオ〜イオグランデ、マダンテ、やみのはどう
        actCount: 2
    });

    // 100階: シドー (破壊神・2回)
    DB.MONSTERS.push({
        id: 1100, rank: 100, minF: 999, name: 'シドー',
        hp: 100000, mp: 999, atk: 1500, def: 1000, spd: 300, mag: 800,
        exp: 100000, gold: 50000,
        acts: [1, 103, 404, 407, 609, 23, 60, 411], // 煉獄火炎、ラグナブレード追加
        actCount: 2 
    });

    // 101階以降: レグナード (竜神・凶悪・2回)
    DB.MONSTERS.push({
        id: 1000, rank: 100, minF: 999, name: 'レグナード', 
        hp: 200000, mp: 9999, atk: 2500, def: 1500, spd: 500, mag: 1200, 
        exp: 200000, gold: 100000, 
        acts: [1, 401, 402, 405, 406, 901, 902, 905, 609], // 煉獄火炎追加
        actCount: 2 
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
