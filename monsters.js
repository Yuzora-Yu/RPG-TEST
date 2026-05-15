/* monsters.js - DQ-scale balance rework generated 2026-05-15 */
const MONSTER_RACES = {
  antiDemon: ['死霊', '魔族'],        // 悪魔ばらい
  antiBeast: ['獣', '獣人'],          // 獣狩り
  antiMachine: ['機械', '無生物'],    // メカニック
  antiDragon: ['竜', '竜人'],         // 竜殺し

  // 現状、特攻対象外。将来追加してもよい。
  noKillerCurrently: ['粘体', '精霊', '植物', '人'],
};

const emptyDrops = () => ({
  normal: { id: null, rate: 0 },
  rare: { id: null, rate: 0 },
});

const act = (id, rate, condition = 0) => ({ id, rate, condition });

const m = (d) => ({
  hit: 0,
  eva: 0,
  cri: 0,
  isBoss: false,
  isRare: false,
  isEstark: false,
  isSpecialBoss: false,
  drops: emptyDrops(),
  elmRes: {},
  resists: {},
  traits: [],
  archives: [],
  ...d,
});

const BALANCE_RULE = {
  singleBossFloor: {
    baseHp: 'boss.hp',
    basePower: 'Math.max(boss.atk, boss.mag)',
  },

  multiBossFloor: {
    baseHp: 'sum(boss.hp) / (bossCount / 1.5)',
    basePower: 'sum(Math.max(boss.atk, boss.mag)) / (bossCount / 1.5)',
  },

  normalMonster: {
    hpLimit: 'baseHp * 0.20',
    powerLimit: 'basePower * 0.70',
  },

  eliteMonster: {
    hpLimit: 'baseHp * 0.30',
    powerLimit: 'basePower * 0.90',
    note: 'actCount: 2 の場合は、ATK/MAG * 2回行動込みで powerLimit 内に収める',
  },
};

const LOW_FLOOR_OFFSETS = {
  1: [
    { hpMp: 1.00, other: 1.00, reward: 1.00 },
    { hpMp: 1.80, other: 1.20, reward: 1.25 },
    { hpMp: 2.90, other: 1.40, reward: 1.45 },
    { hpMp: 4.30, other: 1.65, reward: 1.70 },
    { hpMp: 6.30, other: 2.00, reward: 2.00 },
  ],
  6: [
    { hpMp: 1.00, other: 1.00, reward: 1.00 },
    { hpMp: 1.15, other: 1.06, reward: 1.08 },
    { hpMp: 1.30, other: 1.12, reward: 1.14 },
    { hpMp: 1.45, other: 1.18, reward: 1.20 },
    { hpMp: 1.60, other: 1.24, reward: 1.26 },
  ],
};

const STANDARD_FLOOR_OFFSETS = [
  { hpMp: 1.00, other: 1.00, reward: 1.00 },
  { hpMp: 1.08, other: 1.06, reward: 1.05 },
  { hpMp: 1.16, other: 1.12, reward: 1.10 },
  { hpMp: 1.24, other: 1.18, reward: 1.15 },
  { hpMp: 1.32, other: 1.24, reward: 1.20 },
];

const MONSTER_BANDS_1_200 = [
  { bandStart: 1, bandEnd: 5, offsetType: 'low_1_5', monsters: [
    m({id:100001,name:'ジェリー',race:'粘体',rank:1,minF:1,hp:10,mp:15,atk:9,def:5,spd:3,mag:4,mdef:3,gold:14,exp:14,actCount:1,acts:[act(1,70),act(10,15),act(2,15)],elmRes:{火:-30,雷:-20}}),
    m({id:100002,name:'やみこうもり',race:'獣',rank:1,minF:1,hp:9,mp:30,atk:11,def:6,spd:4,mag:8,mdef:3,gold:18,exp:16,actCount:1,acts:[act(1,70),act(14,20),act(61,10)],elmRes:{光:-30,雷:-20}}),
    m({id:100003,name:'ウィスプ',race:'精霊',rank:1,minF:1,hp:7,mp:25,atk:7,def:7,spd:3,mag:10,mdef:6,gold:19,exp:16,actCount:1,acts:[act(1,65),act(12,20),act(60,15)],elmRes:{火:-20,闇:-20}}),
    m({id:100004,name:'ヒールジェリー',race:'粘体',rank:1,minF:1,hp:8,mp:15,atk:5,def:3,spd:1,mag:3,mdef:8,gold:28,exp:32,actCount:1,acts:[act(1,60),act(20,25),act(2,15)],elmRes:{雷:-30,火:-20}}),
  ]},

  { bandStart: 6, bandEnd: 10, offsetType: 'low_6_10', monsters: [
    m({id:100005,name:'ホーンラビット',race:'獣',rank:6,minF:6,hp:64,mp:13,atk:16,def:7,spd:18,mag:2,mdef:4,gold:34,exp:38,actCount:1,acts:[act(1,70),act(41,15),act(49,15)],elmRes:{火:-20,闇:-10}}),
    m({id:100006,name:'ポイズンジェリー',race:'粘体',rank:6,minF:6,hp:149,mp:15,atk:14,def:9,spd:9,mag:5,mdef:5,gold:40,exp:45,actCount:1,acts:[act(1,65),act(250,20),act(701,15)],elmRes:{火:-30,雷:-20},resists:{Poison:30}}),
    m({id:100007,name:'火の小精',race:'精霊',rank:6,minF:6,hp:46,mp:25,atk:8,def:5,spd:14,mag:16,mdef:11,gold:40,exp:45,actCount:1,acts:[act(1,65),act(10,20),act(15,15)],elmRes:{水:-40,闇:-20}}),
    m({id:100008,name:'さまよう鎧',race:'無生物',rank:6,minF:6,hp:156,mp:13,atk:18,def:14,spd:4,mag:6,mdef:8,gold:55,exp:55,actCount:1,acts:[act(1,70),act(44,20),act(2,10)],elmRes:{雷:-30,水:-10},resists:{Poison:30}}),
    m({id:100009,name:'錆びた鎧兵',race:'無生物',rank:6,minF:6,hp:191,mp:35,atk:14,def:17,spd:5,mag:3,mdef:9,gold:90,exp:85,actCount:2,isElite:true,acts:[act(1,60),act(44,25),act(51,15)],drops:{normal:{id:2,rate:5},rare:{id:105,rate:1}},elmRes:{雷:-30,水:-20},resists:{Poison:40}}),
  ]},

  { bandStart: 11, bandEnd: 15, monsters: [
    m({id:100010,name:'マッドゴーレム',race:'無生物',rank:11,minF:11,hp:191,mp:20,atk:24,def:14,spd:3,mag:2,mdef:6,gold:117,exp:102,actCount:1,acts:[act(1,70),act(101,15),act(60,15)],elmRes:{水:-20,雷:-30},resists:{Poison:30}}),
    m({id:100011,name:'ブラックバット',race:'獣',rank:11,minF:11,hp:71,mp:24,atk:19,def:4,spd:19,mag:18,mdef:3,gold:117,exp:102,actCount:1,acts:[act(1,70),act(14,20),act(703,10)],elmRes:{光:-30,雷:-20}}),
    m({id:100012,name:'アクアスライム',race:'粘体',rank:11,minF:11,hp:174,mp:24,atk:19,def:8,spd:9,mag:20,mdef:8,gold:117,exp:102,actCount:1,acts:[act(1,65),act(11,20),act(12,15)],elmRes:{雷:-30,火:-10}}),
    m({id:100013,name:'グラスウルフ',race:'獣',rank:11,minF:11,hp:180,mp:20,atk:28,def:6,spd:19,mag:2,mdef:3,gold:117,exp:102,actCount:1,acts:[act(1,70),act(41,20),act(60,10)],elmRes:{火:-20,光:-10}}),
  ]},

  { bandStart: 16, bandEnd: 20, monsters: [
    m({id:100014,name:'いたずらバット',race:'魔族',rank:16,minF:16,hp:196,mp:31,atk:20,def:7,spd:16,mag:29,mdef:10,gold:148,exp:136,actCount:1,acts:[act(1,65),act(14,20),act(60,15)],elmRes:{光:-30,雷:-10}}),
    m({id:100015,name:'ブロンズナイト',race:'無生物',rank:16,minF:16,hp:206,mp:23,atk:28,def:15,spd:5,mag:3,mdef:11,gold:148,exp:136,actCount:1,acts:[act(1,65),act(40,15),act(44,15),act(2,5)],elmRes:{雷:-30,水:-20},resists:{Poison:40}}),
    m({id:100016,name:'ゴースト',race:'死霊',rank:16,minF:16,hp:168,mp:31,atk:4,def:4,spd:16,mag:29,mdef:13,gold:148,exp:136,actCount:1,acts:[act(1,60),act(10,15),act(14,20),act(61,5)],elmRes:{光:-40,火:-10},resists:{Poison:30}}),
    m({id:100017,name:'いやしの芽',race:'植物',rank:16,minF:16,hp:191,mp:31,atk:4,def:7,spd:5,mag:28,mdef:11,gold:148,exp:136,actCount:1,acts:[act(1,55),act(20,25),act(51,10),act(701,10)],elmRes:{火:-40,闇:-20},resists:{Poison:30}}),
    m({id:100018,name:'ブロンズリーダー',race:'無生物',rank:16,minF:16,hp:251,mp:30,atk:18,def:17,spd:6,mag:2,mdef:14,gold:244,exp:224,actCount:2,isElite:true,acts:[act(1,55),act(44,20),act(101,15),act(51,10)],drops:{normal:{id:3,rate:5},rare:{id:102,rate:1}},elmRes:{雷:-30,水:-20},resists:{Poison:50}}),
  ]},

  { bandStart: 21, bandEnd: 25, monsters: [
    m({id:100019,name:'サンドリザード',race:'竜',rank:21,minF:21,hp:234,mp:27,atk:40,def:17,spd:12,mag:3,mdef:7,gold:298,exp:272,actCount:1,acts:[act(1,65),act(43,15),act(601,20)],elmRes:{水:-30,雷:-20},resists:{Poison:20}}),
    m({id:100020,name:'ヘルラビット',race:'獣',rank:21,minF:21,hp:211,mp:27,atk:38,def:7,spd:31,mag:3,mdef:3,gold:298,exp:272,actCount:1,acts:[act(1,65),act(41,20),act(49,15)],elmRes:{火:-20,闇:-10}}),
    m({id:100021,name:'呪いの霊魂',race:'死霊',rank:21,minF:21,hp:191,mp:38,atk:5,def:7,spd:31,mag:34,mdef:13,gold:298,exp:272,actCount:1,acts:[act(1,60),act(14,20),act(61,10),act(703,10)],elmRes:{光:-40,雷:-20},resists:{Poison:30}}),
    m({id:100022,name:'マンドラゴラ',race:'植物',rank:21,minF:21,hp:216,mp:38,atk:14,def:12,spd:10,mag:33,mdef:9,gold:298,exp:272,actCount:1,acts:[act(1,60),act(701,15),act(60,15),act(20,10)],elmRes:{火:-30,風:-20},resists:{Poison:40}}),
  ]},

  { bandStart: 26, bandEnd: 30, monsters: [
    m({id:100023,name:'アーミーウルフ',race:'獣',rank:26,minF:26,hp:246,mp:32,atk:47,def:14,spd:39,mag:4,mdef:3,gold:209,exp:197,actCount:1,acts:[act(1,65),act(41,20),act(101,15)],elmRes:{火:-20,光:-10}}),
    m({id:100024,name:'アイアンジェリー',race:'粘体',rank:26,minF:26,hp:259,mp:32,atk:33,def:23,spd:10,mag:4,mdef:14,gold:209,exp:197,actCount:1,acts:[act(1,65),act(44,15),act(2,20)],elmRes:{雷:-30,火:-20},resists:{Poison:40}}),
    m({id:100025,name:'フレイムスプライト',race:'精霊',rank:26,minF:26,hp:216,mp:45,atk:7,def:8,spd:29,mag:40,mdef:12,gold:209,exp:197,actCount:1,acts:[act(1,60),act(10,20),act(15,20)],elmRes:{水:-50,闇:-20}}),
    m({id:100026,name:'ヒールスポア',race:'植物',rank:26,minF:26,hp:229,mp:45,atk:7,def:12,spd:10,mag:36,mdef:14,gold:209,exp:197,actCount:1,acts:[act(1,55),act(20,25),act(701,10),act(51,10)],elmRes:{火:-40,風:-20},resists:{Poison:40}}),
    m({id:100027,name:'群狼隊長',race:'獣',rank:26,minF:26,hp:312,mp:37,atk:31,def:20,spd:43,mag:3,mdef:7,gold:345,exp:325,actCount:2,isElite:true,acts:[act(1,55),act(41,20),act(101,15),act(703,10)],drops:{normal:{id:5,rate:2},rare:{id:104,rate:1}},elmRes:{火:-20,光:-20}}),
  ]},

  { bandStart: 31, bandEnd: 35, monsters: [
    m({id:100028,name:'キラーバット',race:'獣',rank:31,minF:31,hp:277,mp:51,atk:47,def:14,spd:36,mag:25,mdef:7,gold:246,exp:210,actCount:1,acts:[act(1,60),act(46,20),act(14,15),act(703,5)],elmRes:{光:-30,雷:-20}}),
    m({id:100029,name:'ルーンジェリー',race:'粘体',rank:31,minF:31,hp:318,mp:51,atk:26,def:29,spd:17,mag:56,mdef:29,gold:246,exp:210,actCount:1,acts:[act(1,60),act(10,15),act(11,15),act(16,10)],elmRes:{雷:-30,闇:-10}}),
    m({id:100030,name:'ブリーズリザード',race:'竜',rank:31,minF:31,hp:302,mp:37,atk:71,def:28,spd:36,mag:6,mdef:17,gold:246,exp:210,actCount:1,acts:[act(1,60),act(43,15),act(46,15),act(601,10)],elmRes:{雷:-30,水:-20},resists:{Poison:20}}),
    m({id:100031,name:'見習いメイジ',race:'魔族',rank:31,minF:31,hp:259,mp:51,atk:7,def:14,spd:17,mag:76,mdef:29,gold:246,exp:210,actCount:1,acts:[act(1,55),act(301,15),act(312,15),act(60,15)],elmRes:{光:-30,雷:-10}}),
  ]},

  { bandStart: 36, bandEnd: 40, monsters: [
    m({id:100032,name:'ファイアウィスプ',race:'精霊',rank:36,minF:36,hp:285,mp:58,atk:9,def:14,spd:28,mag:77,mdef:33,gold:327,exp:346,actCount:1,acts:[act(1,55),act(10,20),act(15,15),act(301,10)],elmRes:{水:-50,闇:-20}}),
    m({id:100033,name:'アクアウィスプ',race:'精霊',rank:36,minF:36,hp:285,mp:58,atk:9,def:14,spd:28,mag:77,mdef:33,gold:327,exp:346,actCount:1,acts:[act(1,55),act(11,20),act(12,10),act(303,15)],elmRes:{雷:-40,闇:-20}}),
    m({id:100034,name:'ライトウィスプ',race:'精霊',rank:36,minF:36,hp:285,mp:58,atk:9,def:14,spd:28,mag:77,mdef:33,gold:327,exp:346,actCount:1,acts:[act(1,55),act(16,20),act(13,15),act(60,10)],elmRes:{闇:-40,火:-10}}),
    m({id:100035,name:'ダークウィスプ',race:'精霊',rank:36,minF:36,hp:285,mp:58,atk:9,def:14,spd:28,mag:77,mdef:33,gold:327,exp:346,actCount:1,acts:[act(1,55),act(14,25),act(312,10),act(61,10)],elmRes:{光:-40,雷:-10}}),
    m({id:100036,name:'ウィスプナイト',race:'無生物',rank:36,minF:36,hp:387,mp:48,atk:47,def:74,spd:12,mag:5,mdef:36,gold:540,exp:571,actCount:2,isElite:true,acts:[act(1,55),act(44,20),act(102,15),act(51,10)],drops:{normal:{id:13,rate:3},rare:{id:105,rate:1}},elmRes:{雷:-30,水:-20},resists:{Poison:50}}),
  ]},

  { bandStart: 41, bandEnd: 45, monsters: [
    m({id:100037,name:'バンパイア',race:'死霊',rank:41,minF:41,hp:324,mp:65,atk:56,def:19,spd:40,mag:50,mdef:36,gold:587,exp:587,actCount:1,acts:[act(1,55),act(47,20),act(14,15),act(703,10)],elmRes:{光:-50,雷:-20},resists:{Poison:30}}),
    m({id:100038,name:'アーマーラビット',race:'獣',rank:41,minF:41,hp:371,mp:46,atk:76,def:76,spd:31,mag:7,mdef:23,gold:587,exp:587,actCount:1,acts:[act(1,60),act(44,20),act(41,20)],elmRes:{火:-20,闇:-10}}),
    m({id:100039,name:'メイジゴースト',race:'死霊',rank:41,minF:41,hp:298,mp:65,atk:8,def:19,spd:31,mag:81,mdef:47,gold:587,exp:587,actCount:1,acts:[act(1,50),act(301,20),act(312,20),act(60,10)],elmRes:{光:-40,火:-10},resists:{Poison:40}}),
    m({id:100040,name:'アイアンウルフ',race:'獣',rank:41,minF:41,hp:354,mp:46,atk:87,def:42,spd:40,mag:7,mdef:10,gold:587,exp:587,actCount:1,acts:[act(1,55),act(41,20),act(101,15),act(46,10)],elmRes:{火:-20,光:-10}}),
  ]},

  { bandStart: 46, bandEnd: 50, monsters: [
    m({id:100041,name:'ダークソルジャー',race:'無生物',rank:46,minF:46,hp:415,mp:51,atk:89,def:89,spd:23,mag:10,mdef:50,gold:776,exp:800,actCount:1,acts:[act(1,55),act(44,20),act(102,15),act(50,10)],elmRes:{光:-30,雷:-20},resists:{Poison:50}}),
    m({id:100042,name:'リペアジェリー',race:'粘体',rank:46,minF:46,hp:427,mp:94,atk:11,def:70,spd:14,mag:87,mdef:73,gold:776,exp:800,actCount:1,acts:[act(1,50),act(20,25),act(21,10),act(51,15)],elmRes:{雷:-40,闇:-20},resists:{Poison:30}}),
    m({id:100043,name:'フレイムヴァイン',race:'植物',rank:46,minF:46,hp:390,mp:72,atk:50,def:47,spd:23,mag:80,mdef:50,gold:776,exp:800,actCount:1,acts:[act(1,55),act(301,15),act(601,20),act(701,10)],elmRes:{水:-50,風:-20},resists:{Poison:50}}),
    m({id:100044,name:'グレイブゴースト',race:'死霊',rank:46,minF:46,hp:324,mp:87,atk:11,def:23,spd:50,mag:87,mdef:73,gold:776,exp:800,actCount:1,acts:[act(1,50),act(312,20),act(14,15),act(703,15)],elmRes:{光:-50,火:-10},resists:{Poison:50}}),
    m({id:100045,name:'ダークナイト',race:'無生物',rank:46,minF:46,hp:461,mp:60,atk:71,def:96,spd:31,mag:33,mdef:76,gold:1280,exp:1320,actCount:2,isElite:true,acts:[act(1,45),act(102,20),act(44,15),act(50,10),act(103,10)],drops:{normal:{id:14,rate:1},rare:{id:106,rate:0.5}},elmRes:{光:-30,雷:-20},resists:{Poison:60,Shock:20}}),
  ]},
  
    { bandStart: 51, bandEnd: 55, monsters: [
    m({id:100046,name:'機械兵士',race:'機械',rank:51,minF:51,hp:472,mp:56,atk:96,def:101,spd:39,mag:4,mdef:73,gold:950,exp:1000,actCount:1,acts:[act(1,45),act(44,15),act(102,25),act(153,15)],elmRes:{闇:20,雷:-30,水:-10},resists:{Poison:60,Shock:20}}),
    m({id:100047,name:'ブラッドウルフ',race:'獣',rank:51,minF:51,hp:415,mp:56,atk:105,def:53,spd:84,mag:4,mdef:14,gold:950,exp:1000,actCount:1,acts:[act(1,45),act(41,15),act(108,20),act(47,20)],elmRes:{風:10,火:-20,光:-20}}),
    m({id:100048,name:'リトルメイジ',race:'魔族',rank:51,minF:51,hp:402,mp:117,atk:36,def:47,spd:77,mag:115,mdef:81,gold:950,exp:1000,actCount:1,acts:[act(1,45),act(301,15),act(302,20),act(312,20)],elmRes:{闇:20,光:-30},resists:{Seal:20}}),
    m({id:100049,name:'ストーンジェリー',race:'粘体',rank:51,minF:51,hp:493,mp:56,atk:89,def:89,spd:24,mag:33,mdef:50,gold:950,exp:1000,actCount:1,acts:[act(1,45),act(44,15),act(150,20),act(60,20)],elmRes:{火:10,雷:-30},resists:{Poison:50}}),
  ]},

  { bandStart: 56, bandEnd: 60, monsters: [
    m({id:100050,name:'キラーナイト',race:'無生物',rank:56,minF:56,hp:493,mp:61,atk:111,def:107,spd:50,mag:6,mdef:76,gold:1150,exp:1200,actCount:1,acts:[act(1,45),act(101,15),act(102,25),act(44,15)],elmRes:{闇:20,雷:-30,光:-10},resists:{Poison:60}}),
    m({id:100051,name:'キラーラビット',race:'獣',rank:56,minF:56,hp:439,mp:61,atk:105,def:50,spd:92,mag:6,mdef:17,gold:1150,exp:1200,actCount:1,acts:[act(1,45),act(41,15),act(108,20),act(201,20)],elmRes:{風:10,火:-20}}),
    m({id:100052,name:'かえんりゅう',race:'竜',rank:56,minF:56,hp:493,mp:100,atk:98,def:89,spd:50,mag:111,mdef:76,gold:1150,exp:1200,actCount:1,acts:[act(1,40),act(601,20),act(603,20),act(301,20)],elmRes:{火:30,水:-50},resists:{Poison:50,Fear:20}}),
    m({id:100053,name:'ポイズンミスト',race:'死霊',rank:56,minF:56,hp:415,mp:109,atk:10,def:33,spd:92,mag:111,mdef:87,gold:1150,exp:1200,actCount:1,acts:[act(1,45),act(701,15),act(702,15),act(312,25)],elmRes:{闇:20,光:-40},resists:{Poison:80}}),
    m({id:100054,name:'かえんまりゅう',race:'竜',rank:56,minF:56,hp:604,mp:112,atk:92,def:101,spd:73,mag:98,mdef:87,gold:1898,exp:1980,actCount:2,isElite:true,acts:[act(1,35),act(603,25),act(305,15),act(102,15),act(703,10)],drops:{normal:{id:13,rate:4},rare:{id:106,rate:0.5}},elmRes:{火:40,水:-50,雷:-10},resists:{Poison:60,Fear:30}}),
  ]},

  { bandStart: 61, bandEnd: 65, monsters: [
    m({id:100055,name:'スカウトデビル',race:'魔族',rank:61,minF:61,hp:493,mp:120,atk:96,def:56,spd:96,mag:115,mdef:89,gold:1350,exp:1450,actCount:1,acts:[act(1,45),act(301,15),act(65,15),act(115,25)],elmRes:{闇:20,光:-30},resists:{Seal:20}}),
    m({id:100056,name:'アーマーリザード',race:'竜',rank:61,minF:61,hp:551,mp:65,atk:111,def:115,spd:70,mag:7,mdef:81,gold:1350,exp:1450,actCount:1,acts:[act(1,45),act(43,15),act(102,20),act(153,20)],elmRes:{火:20,水:-30},resists:{Poison:40}}),
    m({id:100057,name:'サンダーバット',race:'獣',rank:61,minF:61,hp:461,mp:109,atk:84,def:39,spd:101,mag:115,mdef:89,gold:1350,exp:1450,actCount:1,acts:[act(1,45),act(43,15),act(251,20),act(13,20)],elmRes:{雷:30,風:-30,光:-20},resists:{Shock:50}}),
    m({id:100058,name:'ルーンアーマー',race:'無生物',rank:61,minF:61,hp:551,mp:109,atk:109,def:115,spd:33,mag:107,mdef:89,gold:1350,exp:1450,actCount:1,acts:[act(1,40),act(51,15),act(103,20),act(53,25)],elmRes:{光:20,雷:-30},resists:{Poison:60,Seal:20}}),
  ]},

  { bandStart: 66, bandEnd: 70, monsters: [
    m({id:100059,name:'アルリザード',race:'竜',rank:66,minF:66,hp:560,mp:70,atk:126,def:111,spd:81,mag:56,mdef:87,gold:1650,exp:1750,actCount:1,acts:[act(1,40),act(102,20),act(103,20),act(602,20)],elmRes:{水:20,雷:-30},resists:{Poison:50}}),
    m({id:100060,name:'ダークバトラー',race:'魔族',rank:66,minF:66,hp:560,mp:120,atk:126,def:111,spd:76,mag:115,mdef:87,gold:1650,exp:1750,actCount:1,acts:[act(1,40),act(104,25),act(116,15),act(312,20)],elmRes:{闇:30,光:-40},resists:{Seal:30,Poison:40}}),
    m({id:100061,name:'シルフウルフ',race:'獣',rank:66,minF:66,hp:532,mp:70,atk:121,def:70,spd:105,mag:7,mdef:17,gold:1650,exp:1750,actCount:1,acts:[act(1,40),act(108,20),act(105,20),act(49,20)],elmRes:{風:20,火:-20}}),
    m({id:100062,name:'ヒールフェアリー',race:'精霊',rank:66,minF:66,hp:493,mp:137,atk:10,def:70,spd:105,mag:119,mdef:105,gold:1650,exp:1750,actCount:1,acts:[act(1,40),act(21,20),act(22,10),act(52,15),act(53,15)],elmRes:{光:20,闇:-30},resists:{Seal:30}}),
    m({id:100063,name:'ダークバトラー強',race:'魔族',rank:66,minF:66,hp:675,mp:144,atk:105,def:115,spd:84,mag:105,mdef:98,gold:2723,exp:2888,actCount:2,isElite:true,acts:[act(1,35),act(104,25),act(116,15),act(305,15),act(57,10)],drops:{normal:{id:5,rate:3},rare:{id:102,rate:1}},elmRes:{闇:40,光:-40},resists:{Poison:50,Seal:40}}),
  ]},

  { bandStart: 71, bandEnd: 75, monsters: [
    m({id:100064,name:'アクアリリィ',race:'魔族',rank:71,minF:71,hp:560,mp:141,atk:73,def:76,spd:101,mag:131,mdef:105,gold:1950,exp:2100,actCount:1,acts:[act(1,40),act(303,20),act(311,20),act(60,20)],elmRes:{水:30,雷:-40,光:-20},resists:{Seal:30}}),
    m({id:100065,name:'ライトリリィ',race:'魔族',rank:71,minF:71,hp:560,mp:141,atk:73,def:76,spd:101,mag:131,mdef:105,gold:1950,exp:2100,actCount:1,acts:[act(1,40),act(16,15),act(308,20),act(306,25)],elmRes:{光:30,闇:-40},resists:{Seal:30}}),
    m({id:100066,name:'ジェリーキング',race:'粘体',rank:71,minF:71,hp:612,mp:125,atk:109,def:115,spd:39,mag:115,mdef:94,gold:1950,exp:2100,actCount:1,acts:[act(1,40),act(21,15),act(150,20),act(153,25)],elmRes:{火:20,雷:-30},resists:{Poison:60}}),
    m({id:100067,name:'バトルリザード',race:'竜',rank:71,minF:71,hp:595,mp:75,atk:136,def:101,spd:101,mag:7,mdef:94,gold:1950,exp:2100,actCount:1,acts:[act(1,40),act(102,20),act(154,20),act(603,20)],elmRes:{火:20,水:-30},resists:{Poison:50}}),
  ]},

  { bandStart: 76, bandEnd: 80, monsters: [
    m({id:100068,name:'魔人兵士',race:'魔族',rank:76,minF:76,hp:604,mp:122,atk:141,def:115,spd:73,mag:98,mdef:98,gold:2350,exp:2550,actCount:1,acts:[act(1,35),act(112,20),act(102,25),act(50,20)],elmRes:{闇:30,光:-30},resists:{Poison:50,Seal:30}}),
    m({id:100069,name:'アークバット',race:'死霊',rank:76,minF:76,hp:542,mp:137,atk:111,def:50,spd:115,mag:134,mdef:115,gold:2350,exp:2550,actCount:1,acts:[act(1,35),act(47,20),act(312,20),act(704,25)],elmRes:{闇:30,光:-40},resists:{Poison:60,Seal:20}}),
    m({id:100070,name:'ブレイズナイト',race:'無生物',rank:76,minF:76,hp:612,mp:80,atk:142,def:126,spd:56,mag:89,mdef:98,gold:2350,exp:2550,actCount:1,acts:[act(1,35),act(40,15),act(156,20),act(603,20),act(51,10)],elmRes:{火:30,水:-40,雷:-20},resists:{Poison:70}}),
    m({id:100071,name:'アビススポア',race:'植物',rank:76,minF:76,hp:551,mp:150,atk:81,def:84,spd:56,mag:138,mdef:107,gold:2350,exp:2550,actCount:1,acts:[act(1,35),act(702,20),act(304,20),act(21,25)],elmRes:{風:20,火:-40},resists:{Poison:80}}),
    m({id:100072,name:'魔人兵長',race:'魔族',rank:76,minF:76,hp:753,mp:137,atk:124,def:129,spd:84,mag:107,mdef:111,gold:3878,exp:4208,actCount:2,isElite:true,acts:[act(1,30),act(112,20),act(113,10),act(102,20),act(50,20)],drops:{normal:{id:7,rate:1},rare:{id:106,rate:0.7}},elmRes:{闇:40,光:-30},resists:{Poison:60,Seal:40}}),
  ]},

  { bandStart: 81, bandEnd: 85, monsters: [
    m({id:100073,name:'アークバトラー',race:'魔族',rank:81,minF:81,hp:712,mp:141,atk:138,def:126,spd:94,mag:126,mdef:107,gold:2800,exp:3050,actCount:1,acts:[act(1,35),act(104,20),act(154,20),act(305,25)],elmRes:{闇:30,光:-30},resists:{Poison:50,Seal:40}}),
    m({id:100074,name:'メタルリザード',race:'竜',rank:81,minF:81,hp:726,mp:84,atk:126,def:138,spd:84,mag:7,mdef:107,gold:2800,exp:3050,actCount:1,acts:[act(1,35),act(45,15),act(153,25),act(51,25)],elmRes:{火:20,水:20,雷:-30},resists:{Poison:70}}),
    m({id:100075,name:'ソウルゴースト',race:'死霊',rank:81,minF:81,hp:604,mp:158,atk:8,def:50,spd:119,mag:136,mdef:124,gold:2800,exp:3050,actCount:1,acts:[act(1,35),act(307,20),act(704,20),act(312,25)],elmRes:{闇:40,光:-50},resists:{Poison:70,Seal:30}}),
    m({id:100076,name:'キラーマシン試作',race:'機械',rank:81,minF:81,hp:726,mp:84,atk:141,def:138,spd:94,mag:7,mdef:107,gold:2800,exp:3050,actCount:1,acts:[act(1,35),act(41,15),act(154,25),act(251,25)],elmRes:{闇:20,雷:-40},resists:{Poison:80,Shock:30}}),
  ]},

  { bandStart: 86, bandEnd: 90, monsters: [
    m({id:100077,name:'デビルロード',race:'魔族',rank:86,minF:86,hp:697,mp:162,atk:115,def:111,spd:107,mag:141,mdef:122,gold:3350,exp:3650,actCount:1,acts:[act(1,35),act(305,20),act(307,20),act(905,5),act(60,20)],elmRes:{闇:40,光:-30},resists:{Poison:50,Seal:50}}),
    m({id:100078,name:'アビスウルフ',race:'獣',rank:86,minF:86,hp:697,mp:89,atk:142,def:111,spd:119,mag:7,mdef:25,gold:3350,exp:3650,actCount:1,acts:[act(1,35),act(108,25),act(201,20),act(703,20)],elmRes:{風:20,光:-20,火:-20}}),
    m({id:100079,name:'サンダーアーマー',race:'無生物',rank:86,minF:86,hp:726,mp:89,atk:144,def:142,spd:89,mag:7,mdef:115,gold:3350,exp:3650,actCount:1,acts:[act(1,35),act(43,15),act(251,25),act(158,25)],elmRes:{雷:40,風:-30},resists:{Poison:70,Shock:80}}),
    m({id:100080,name:'ホーリージェリー',race:'粘体',rank:86,minF:86,hp:739,mp:162,atk:81,def:119,spd:50,mag:136,mdef:122,gold:3350,exp:3650,actCount:1,acts:[act(1,35),act(306,20),act(21,20),act(53,25)],elmRes:{光:30,闇:-30,雷:-20},resists:{Poison:60,Seal:30}}),
    m({id:100081,name:'キラーマシン試作二号',race:'機械',rank:86,minF:86,hp:877,mp:144,atk:117,def:148,spd:107,mag:7,mdef:126,gold:5528,exp:6023,actCount:2,isElite:true,acts:[act(1,30),act(154,25),act(251,20),act(103,15),act(57,10)],drops:{normal:{id:14,rate:3},rare:{id:104,rate:1}},elmRes:{闇:30,雷:-40},resists:{Poison:90,Shock:40}}),
  ]},

  { bandStart: 91, bandEnd: 95, monsters: [
    m({id:100082,name:'カースメイジ',race:'魔族',rank:91,minF:91,hp:779,mp:177,atk:11,def:98,spd:115,mag:148,mdef:136,gold:4000,exp:4350,actCount:1,acts:[act(1,30),act(305,20),act(307,20),act(704,15),act(705,15)],elmRes:{闇:40,光:-40},resists:{Seal:60}}),
    m({id:100083,name:'ブラッドナイト',race:'死霊',rank:91,minF:91,hp:842,mp:127,atk:148,def:151,spd:96,mag:115,mdef:121,gold:4000,exp:4350,actCount:1,acts:[act(1,30),act(47,20),act(104,25),act(116,25)],elmRes:{闇:40,光:-50},resists:{Poison:70}}),
    m({id:100084,name:'イグナイトウルフ',race:'獣',rank:91,minF:91,hp:805,mp:94,atk:151,def:111,spd:126,mag:7,mdef:28,gold:4000,exp:4350,actCount:1,acts:[act(1,30),act(251,25),act(108,25),act(201,20)],elmRes:{雷:30,風:-30},resists:{Shock:50}}),
    m({id:100085,name:'グレータージェリー',race:'粘体',rank:91,minF:91,hp:854,mp:148,atk:138,def:141,spd:56,mag:124,mdef:121,gold:4000,exp:4350,actCount:1,acts:[act(1,30),act(153,25),act(21,15),act(53,15),act(64,15)],elmRes:{火:20,雷:-30},resists:{Poison:70}}),
  ]},

  { bandStart: 96, bandEnd: 100, monsters: [
    m({id:100086,name:'アークデビル',race:'魔族',rank:96,minF:96,hp:854,mp:187,atk:138,def:136,spd:119,mag:154,mdef:141,gold:4800,exp:5200,actCount:1,acts:[act(1,30),act(305,20),act(307,20),act(306,20),act(65,10)],elmRes:{闇:40,光:-40},resists:{Seal:60}}),
    m({id:100087,name:'バトルマシーン',race:'機械',rank:96,minF:96,hp:854,mp:99,atk:154,def:163,spd:103,mag:7,mdef:129,gold:4800,exp:5200,actCount:1,acts:[act(1,30),act(154,25),act(158,20),act(103,15),act(51,10)],elmRes:{闇:30,雷:-50},resists:{Poison:90,Shock:50}}),
    m({id:100088,name:'古竜の幼体',race:'竜',rank:96,minF:96,hp:854,mp:162,atk:151,def:148,spd:115,mag:148,mdef:141,gold:4800,exp:5200,actCount:1,acts:[act(1,30),act(603,25),act(602,20),act(103,15),act(703,10)],elmRes:{火:30,水:30,雷:-20,光:-20},resists:{Poison:70,Fear:40}}),
    m({id:100089,name:'ダークプリースト',race:'魔族',rank:96,minF:96,hp:805,mp:187,atk:89,def:121,spd:115,mag:154,mdef:148,gold:4800,exp:5200,actCount:1,acts:[act(1,30),act(307,20),act(21,15),act(22,10),act(704,25)],elmRes:{闇:40,光:-40},resists:{Seal:60}}),
    m({id:100090,name:'古竜の若君',race:'竜',rank:96,minF:96,hp:1026,mp:187,atk:124,def:165,spd:124,mag:124,mdef:151,gold:7920,exp:8580,actCount:2,isElite:true,acts:[act(1,25),act(603,25),act(602,20),act(103,15),act(251,10),act(57,5)],drops:{normal:{id:106,rate:1},rare:{id:107,rate:0.2}},elmRes:{火:40,水:40,雷:-20,光:-20},resists:{Poison:80,Fear:50}}),
  ]},

  { bandStart: 101, bandEnd: 105, monsters: [
    m({id:100091,name:'ステラジェリー',race:'粘体',rank:101,minF:101,hp:1026,mp:180,atk:151,def:151,spd:73,mag:151,mdef:142,gold:6000,exp:6500,actCount:1,acts:[act(1,25),act(153,20),act(306,20),act(405,20),act(53,15)],elmRes:{火:20,闇:20,雷:-30,光:-10},resists:{Poison:80,Seal:30}}),
    m({id:100092,name:'カースバット',race:'死霊',rank:101,minF:101,hp:854,mp:197,atk:129,def:84,spd:136,mag:165,mdef:151,gold:6000,exp:6500,actCount:1,acts:[act(1,25),act(47,15),act(307,20),act(704,20),act(705,20)],elmRes:{闇:50,光:-40},resists:{Poison:80,Seal:50}}),
    m({id:100093,name:'デスマシーン',race:'機械',rank:101,minF:101,hp:1065,mp:103,atk:165,def:168,spd:107,mag:7,mdef:136,gold:6000,exp:6500,actCount:1,acts:[act(1,25),act(154,20),act(158,20),act(401,20),act(251,15)],elmRes:{闇:30,雷:20,水:-20},resists:{Poison:100,Shock:60}}),
    m({id:100094,name:'カオスリザード',race:'竜',rank:101,minF:101,hp:1046,mp:162,atk:165,def:151,spd:121,mag:151,mdef:142,gold:6000,exp:6500,actCount:1,acts:[act(1,25),act(103,15),act(603,20),act(604,20),act(405,20)],elmRes:{火:30,水:30,光:-20,雷:-20},resists:{Poison:80,Fear:40}}),
  ]},

  { bandStart: 106, bandEnd: 110, monsters: [
    m({id:100095,name:'アークデビル',race:'魔族',rank:106,minF:106,hp:1026,mp:209,atk:157,def:142,spd:126,mag:173,mdef:157,gold:7200,exp:7600,actCount:1,acts:[act(1,25),act(305,15),act(407,20),act(405,20),act(905,20)],elmRes:{火:20,闇:40,光:-30},resists:{Poison:70,Seal:70}}),
    m({id:100096,name:'エンゼルジェリー',race:'精霊',rank:106,minF:106,hp:1065,mp:212,atk:8,def:136,spd:84,mag:173,mdef:165,gold:7200,exp:7600,actCount:1,acts:[act(1,25),act(306,20),act(410,20),act(22,15),act(53,20)],elmRes:{光:40,闇:-40,雷:-20},resists:{Poison:70,Seal:50}}),
    m({id:100097,name:'アビスウィスプ',race:'精霊',rank:106,minF:106,hp:854,mp:218,atk:8,def:84,spd:136,mag:178,mdef:169,gold:7200,exp:7600,actCount:1,acts:[act(1,25),act(307,20),act(423,20),act(405,20),act(61,15)],elmRes:{闇:40,混沌:20,光:-30},resists:{Poison:70,Seal:60}}),
    m({id:100098,name:'ダークウルフ',race:'獣',rank:106,minF:106,hp:965,mp:108,atk:169,def:105,spd:145,mag:7,mdef:28,gold:7200,exp:7600,actCount:1,acts:[act(1,25),act(108,20),act(205,20),act(211,25),act(703,10)],elmRes:{闇:20,風:20,光:-20,火:-20},resists:{Fear:30}}),
    m({id:100099,name:'アザゼルナイト',race:'魔族',rank:106,minF:106,hp:1312,mp:218,atk:141,def:151,spd:136,mag:145,mdef:169,gold:11880,exp:12540,actCount:2,isElite:true,acts:[act(1,20),act(407,20),act(405,20),act(103,15),act(905,15),act(57,10)],drops:{normal:{id:106,rate:1},rare:{id:107,rate:0.2}},elmRes:{火:30,闇:50,光:-30},resists:{Poison:80,Seal:80}}),
  ]},

  { bandStart: 111, bandEnd: 115, monsters: [
    m({id:100100,name:'アビスバトラー',race:'魔族',rank:111,minF:111,hp:1102,mp:180,atk:183,def:160,spd:126,mag:126,mdef:151,gold:8500,exp:9000,actCount:1,acts:[act(1,25),act(104,15),act(106,20),act(119,20),act(116,20)],elmRes:{闇:40,光:-30},resists:{Poison:70,Seal:50}}),
    m({id:100101,name:'カオスアーマー',race:'無生物',rank:111,minF:111,hp:1241,mp:113,atk:178,def:183,spd:101,mag:89,mdef:157,gold:8500,exp:9000,actCount:1,acts:[act(1,25),act(153,15),act(401,20),act(117,20),act(51,20)],elmRes:{闇:30,光:20,雷:-30},resists:{Poison:100,Shock:50}}),
    m({id:100102,name:'エビルゴースト',race:'死霊',rank:111,minF:111,hp:944,mp:218,atk:8,def:84,spd:151,mag:194,mdef:176,gold:8500,exp:9000,actCount:1,acts:[act(1,25),act(307,15),act(423,20),act(704,20),act(801,20)],elmRes:{闇:50,光:-50},resists:{Poison:90,InstantDeath:80,Seal:50}}),
    m({id:100103,name:'シャドウシーカー',race:'死霊',rank:111,minF:111,hp:900,mp:187,atk:136,def:84,spd:157,mag:165,mdef:157,gold:8500,exp:9000,actCount:1,acts:[act(1,25),act(47,15),act(705,20),act(251,20),act(204,20)],elmRes:{闇:40,光:-40,雷:-20},resists:{Poison:80,Seal:60}}),
  ]},

  { bandStart: 116, bandEnd: 120, monsters: [
    m({id:100104,name:'レッドドラゴン',race:'竜',rank:116,minF:116,hp:1241,mp:180,atk:183,def:163,spd:121,mag:178,mdef:163,gold:10000,exp:10500,actCount:1,acts:[act(1,25),act(603,15),act(605,25),act(407,15),act(107,20)],elmRes:{火:50,水:-50},resists:{Poison:90,Fear:60}}),
    m({id:100105,name:'ブルードラゴン',race:'竜',rank:116,minF:116,hp:1241,mp:180,atk:183,def:163,spd:121,mag:178,mdef:163,gold:10000,exp:10500,actCount:1,acts:[act(1,25),act(602,15),act(604,25),act(406,15),act(107,20)],elmRes:{水:50,雷:-40},resists:{Poison:90,Fear:60}}),
    m({id:100106,name:'グリーンドラゴン',race:'竜',rank:116,minF:116,hp:1241,mp:180,atk:183,def:163,spd:133,mag:178,mdef:163,gold:10000,exp:10500,actCount:1,acts:[act(1,25),act(105,15),act(422,20),act(614,20),act(107,20)],elmRes:{風:50,火:-30},resists:{Poison:90,Fear:60}}),
    m({id:100107,name:'イエロードラゴン',race:'竜',rank:116,minF:116,hp:1241,mp:180,atk:183,def:163,spd:133,mag:178,mdef:163,gold:10000,exp:10500,actCount:1,acts:[act(1,25),act(251,15),act(408,20),act(608,20),act(107,20)],elmRes:{雷:50,闇:-30},resists:{Poison:90,Shock:80,Fear:60}}),
    m({id:100108,name:'カオスドラゴン',race:'竜',rank:116,minF:116,hp:1559,mp:202,atk:160,def:183,spd:136,mag:165,mdef:176,gold:16500,exp:17325,actCount:2,isElite:true,acts:[act(1,20),act(605,25),act(407,20),act(107,20),act(615,15)],drops:{normal:{id:100,rate:2},rare:{id:106,rate:1}},elmRes:{火:60,水:-50,光:-10},resists:{Poison:100,Fear:80}}),
  ]},
  
    { bandStart: 121, bandEnd: 125, monsters: [
    m({id:100109,name:'オネイロス',race:'魔族',rank:121,minF:121,hp:1241,mp:218,atk:169,def:157,spd:138,mag:183,mdef:169,gold:12000,exp:12500,actCount:1,acts:[act(1,20),act(407,20),act(423,20),act(405,20),act(905,20)],elmRes:{火:30,闇:50,光:-30},resists:{Poison:80,Seal:80}}),
    m({id:100110,name:'ニーズヘッグ',race:'竜',rank:121,minF:121,hp:1273,mp:180,atk:183,def:165,spd:138,mag:151,mdef:165,gold:12000,exp:12500,actCount:1,acts:[act(1,20),act(604,20),act(605,20),act(609,20),act(107,20)],elmRes:{火:40,水:40,闇:20,光:-20,雷:-20},resists:{Poison:90,Fear:60}}),
    m({id:100111,name:'レムレスキラー',race:'死霊',rank:121,minF:121,hp:1006,mp:226,atk:8,def:89,spd:151,mag:194,mdef:176,gold:12000,exp:12500,actCount:1,acts:[act(1,20),act(423,25),act(801,10),act(704,20),act(922,25)],elmRes:{闇:60,光:-50},resists:{Poison:100,InstantDeath:90,Seal:70}}),
    m({id:100112,name:'ヘルバルバトス',race:'魔族',rank:121,minF:121,hp:1191,mp:158,atk:190,def:163,spd:126,mag:115,mdef:151,gold:12000,exp:12500,actCount:1,acts:[act(1,20),act(106,20),act(119,25),act(117,20),act(50,15)],elmRes:{闇:40,光:-30},resists:{Poison:80,Seal:60}}),
  ]},

  { bandStart: 126, bandEnd: 130, monsters: [
    m({id:100113,name:'イビルスライム',race:'粘体',rank:126,minF:126,hp:1350,mp:187,atk:157,def:165,spd:79,mag:157,mdef:157,gold:14000,exp:14500,actCount:1,acts:[act(1,20),act(153,15),act(405,20),act(410,20),act(53,25)],elmRes:{火:30,闇:30,雷:-30},resists:{Poison:90,Seal:50}}),
    m({id:100114,name:'ヘルシーカー',race:'精霊',rank:126,minF:126,hp:1026,mp:226,atk:8,def:89,spd:157,mag:197,mdef:183,gold:14000,exp:14500,actCount:1,acts:[act(1,20),act(423,20),act(408,20),act(410,20),act(905,20)],elmRes:{闇:40,光:20,混沌:-20},resists:{Poison:90,Seal:70}}),
    m({id:100115,name:'キングスキラー',race:'死霊',rank:126,minF:126,hp:1026,mp:194,atk:141,def:89,spd:157,mag:169,mdef:163,gold:14000,exp:14500,actCount:1,acts:[act(1,20),act(204,20),act(704,20),act(705,20),act(801,20)],elmRes:{闇:50,光:-40},resists:{Poison:90,Seal:70}}),
    m({id:100116,name:'リリスナイト',race:'無生物',rank:126,minF:126,hp:1387,mp:127,atk:194,def:194,spd:107,mag:98,mdef:169,gold:14000,exp:14500,actCount:1,acts:[act(1,20),act(401,20),act(117,20),act(118,20),act(53,20)],elmRes:{闇:30,光:30,雷:-30},resists:{Poison:100,Shock:70}}),
    m({id:100117,name:'ウィスプロード',race:'精霊',rank:126,minF:126,hp:1559,mp:246,atk:8,def:103,spd:169,mag:163,mdef:194,gold:23100,exp:23925,actCount:2,isElite:true,acts:[act(1,15),act(423,20),act(408,20),act(410,20),act(905,15),act(57,10)],drops:{normal:{id:106,rate:1.5},rare:{id:107,rate:0.25}},elmRes:{闇:50,光:30,雷:30,混沌:-20},resists:{Poison:100,Seal:90}}),
  ]},

  { bandStart: 131, bandEnd: 135, monsters: [
    m({id:100118,name:'ノクティリア',race:'魔族',rank:131,minF:131,hp:1207,mp:250,atk:8,def:124,spd:148,mag:208,mdef:194,gold:17000,exp:17500,actCount:1,acts:[act(1,20),act(407,20),act(408,20),act(423,20),act(905,20)],elmRes:{火:30,闇:50,光:-40},resists:{Seal:90}}),
    m({id:100119,name:'ヴェルザーク',race:'魔族',rank:131,minF:131,hp:1387,mp:168,atk:208,def:176,spd:138,mag:124,mdef:169,gold:17000,exp:17500,actCount:1,acts:[act(1,20),act(106,20),act(119,20),act(409,20),act(117,20)],elmRes:{闇:40,光:-30},resists:{Poison:80,Seal:60}}),
    m({id:100120,name:'ガルヴァロス',race:'獣',rank:131,minF:131,hp:1289,mp:132,atk:201,def:129,spd:169,mag:7,mdef:44,gold:17000,exp:17500,actCount:1,acts:[act(1,20),act(211,25),act(205,20),act(206,20),act(703,15)],elmRes:{闇:30,風:20,火:-20,光:-20},resists:{Fear:50}}),
    m({id:100121,name:'アルカナソード',race:'無生物',rank:131,minF:131,hp:1458,mp:132,atk:199,def:199,spd:111,mag:105,mdef:176,gold:17000,exp:17500,actCount:1,acts:[act(1,20),act(401,20),act(118,20),act(414,20),act(51,20)],elmRes:{闇:40,光:20,雷:-30},resists:{Poison:100,Shock:70}}),
  ]},

  { bandStart: 136, bandEnd: 140, monsters: [
    m({id:100122,name:'ブライトドラゴン',race:'竜',rank:136,minF:136,hp:1492,mp:237,atk:208,def:188,spd:142,mag:208,mdef:199,gold:20000,exp:21000,actCount:1,acts:[act(1,20),act(410,20),act(408,20),act(610,20),act(615,20)],elmRes:{光:60,雷:30,闇:-40},resists:{Poison:100,Fear:80,Seal:50}}),
    m({id:100123,name:'ダークドラゴン',race:'竜',rank:136,minF:136,hp:1492,mp:237,atk:208,def:188,spd:142,mag:208,mdef:199,gold:20000,exp:21000,actCount:1,acts:[act(1,20),act(423,20),act(405,20),act(611,20),act(615,20)],elmRes:{闇:60,混沌:30,光:-40},resists:{Poison:100,Fear:80,Seal:50}}),
    m({id:100124,name:'ボルトアクス',race:'魔族',rank:136,minF:136,hp:1350,mp:137,atk:215,def:176,spd:133,mag:8,mdef:148,gold:20000,exp:21000,actCount:1,acts:[act(1,20),act(158,20),act(401,20),act(113,20),act(50,20)],elmRes:{雷:50,風:-30},resists:{Shock:90,Poison:70}}),
    m({id:100125,name:'エビルグレン',race:'魔族',rank:136,minF:136,hp:1387,mp:230,atk:194,def:176,spd:138,mag:215,mdef:176,gold:20000,exp:21000,actCount:1,acts:[act(1,20),act(407,20),act(424,20),act(613,20),act(905,20)],elmRes:{火:50,闇:30,水:-40,光:-20},resists:{Seal:80,Poison:80}}),
    m({id:100126,name:'ラグナドラグーン',race:'竜',rank:136,minF:136,hp:1800,mp:250,atk:176,def:205,spd:148,mag:176,mdef:210,gold:33000,exp:34650,actCount:2,isElite:true,acts:[act(1,15),act(423,20),act(611,20),act(616,15),act(615,15),act(57,15)],drops:{normal:{id:106,rate:2},rare:{id:107,rate:0.3}},elmRes:{闇:70,混沌:40,光:-40},resists:{Poison:100,Fear:100,Seal:70}}),
  ]},

  { bandStart: 141, bandEnd: 145, monsters: [
    m({id:100127,name:'ネメシスユニット',race:'無生物',rank:141,minF:141,hp:1257,mp:141,atk:257,def:199,spd:107,mag:105,mdef:176,gold:23000,exp:24000,actCount:1,acts:[act(1,20),act(401,20),act(409,20),act(118,20),act(57,20)],elmRes:{闇:40,光:30,雷:-30},resists:{Poison:100,Shock:80}}),
    m({id:100128,name:'ヘルエンゼル',race:'精霊',rank:141,minF:141,hp:1191,mp:224,atk:8,def:126,spd:107,mag:261,mdef:194,gold:23000,exp:24000,actCount:1,acts:[act(1,20),act(410,20),act(423,20),act(22,15),act(905,25)],elmRes:{光:40,闇:40,混沌:-30},resists:{Poison:90,Seal:70}}),
    m({id:100129,name:'ネクロヴェイル',race:'魔族',rank:141,minF:141,hp:1207,mp:162,atk:261,def:176,spd:138,mag:124,mdef:169,gold:23000,exp:24000,actCount:1,acts:[act(1,20),act(119,25),act(409,20),act(117,20),act(50,15)],elmRes:{闇:50,光:-30},resists:{Poison:90,Seal:70}}),
    m({id:100130,name:'グリムレイス',race:'死霊',rank:141,minF:141,hp:1120,mp:200,atk:163,def:89,spd:157,mag:230,mdef:169,gold:23000,exp:24000,actCount:1,acts:[act(1,20),act(204,20),act(704,20),act(705,20),act(804,20)],elmRes:{闇:50,光:-40},resists:{Poison:100,Seal:80,InstantDeath:90}}),
  ]},

  { bandStart: 146, bandEnd: 150, monsters: [
    m({id:100131,name:'ドレッドノート',race:'機械',rank:146,minF:146,hp:1289,mp:146,atk:261,def:199,spd:129,mag:8,mdef:176,gold:26000,exp:27000,actCount:1,acts:[act(1,15),act(154,20),act(401,20),act(409,20),act(420,25)],elmRes:{闇:40,雷:-30,水:-20},resists:{Poison:100,Shock:80}}),
    m({id:100132,name:'アークベリアル',race:'魔族',rank:146,minF:146,hp:1241,mp:230,atk:188,def:165,spd:138,mag:261,mdef:182,gold:26000,exp:27000,actCount:1,acts:[act(1,15),act(407,20),act(423,20),act(412,20),act(905,25)],elmRes:{火:40,闇:60,光:-40},resists:{Poison:90,Seal:90}}),
    m({id:100133,name:'ウロボロス',race:'粘体',rank:146,minF:146,hp:1312,mp:207,atk:199,def:169,spd:79,mag:235,mdef:169,gold:26000,exp:27000,actCount:1,acts:[act(1,15),act(405,20),act(410,20),act(414,20),act(53,25)],elmRes:{火:30,闇:40,光:20,雷:-30},resists:{Poison:100,Seal:70}}),
    m({id:100134,name:'エルダーリッチ',race:'魔族',rank:146,minF:146,hp:1207,mp:237,atk:81,def:136,spd:129,mag:261,mdef:194,gold:26000,exp:27000,actCount:1,acts:[act(1,15),act(423,20),act(24,10),act(905,20),act(704,20),act(57,15)],elmRes:{闇:60,光:-40},resists:{Poison:90,Seal:90}}),
    m({id:100135,name:'デビルキング',race:'魔族',rank:146,minF:146,hp:1591,mp:246,atk:210,def:188,spd:163,mag:213,mdef:199,gold:42900,exp:44550,actCount:2,isElite:true,acts:[act(1,15),act(407,20),act(412,20),act(423,20),act(905,15),act(57,10)],drops:{normal:{id:106,rate:2},rare:{id:107,rate:0.3}},elmRes:{火:50,闇:70,混沌:20,光:-40},resists:{Poison:100,Seal:100}}),
  ]},

  { bandStart: 151, bandEnd: 155, monsters: [
    m({id:100136,name:'アビスロード',race:'魔族',rank:151,minF:151,hp:1458,mp:250,atk:230,def:188,spd:169,mag:289,mdef:199,gold:30000,exp:32000,actCount:1,acts:[act(1,15),act(305,10),act(407,20),act(425,20),act(905,20),act(901,15)],elmRes:{火:40,闇:60,混沌:30,光:-30},resists:{Poison:100,Seal:100,InstantDeath:90}}),
    m({id:100137,name:'ルインシェイド',race:'無生物',rank:151,minF:151,hp:1526,mp:151,atk:297,def:220,spd:141,mag:105,mdef:194,gold:30000,exp:32000,actCount:1,acts:[act(1,15),act(102,10),act(409,20),act(421,10),act(118,20),act(414,25)],elmRes:{光:40,闇:40,雷:-30},resists:{Poison:100,Shock:90,Seal:70}}),
    m({id:100138,name:'バルムガルド',race:'竜',rank:151,minF:151,hp:1559,mp:224,atk:282,def:199,spd:151,mag:282,mdef:194,gold:30000,exp:32000,actCount:1,acts:[act(1,15),act(603,10),act(605,15),act(610,20),act(611,20),act(615,20)],elmRes:{火:50,闇:40,光:30,水:-20,雷:-20},resists:{Poison:100,Fear:100,Seal:70}}),
    m({id:100139,name:'エレシュキガル',race:'死霊',rank:151,minF:151,hp:1273,mp:268,atk:182,def:98,spd:188,mag:289,mdef:205,gold:30000,exp:32000,actCount:1,acts:[act(1,15),act(47,10),act(423,20),act(704,15),act(805,10),act(922,30)],elmRes:{闇:70,混沌:30,光:-50},resists:{Poison:100,Seal:90,InstantDeath:100}}),
  ]},

  { bandStart: 156, bandEnd: 160, monsters: [
    m({id:100140,name:'竜将ダハーカ',race:'竜人',rank:156,minF:156,hp:1591,mp:220,atk:304,def:199,spd:169,mag:199,mdef:194,gold:35000,exp:37000,actCount:1,acts:[act(1,15),act(103,10),act(409,20),act(213,20),act(615,20),act(901,15)],elmRes:{火:40,雷:30,光:30,闇:-30},resists:{Poison:100,Fear:90,Seal:70}}),
    m({id:100141,name:'ヴァルファング',race:'獣人',rank:156,minF:156,hp:1492,mp:156,atk:311,def:169,spd:194,mag:7,mdef:136,gold:35000,exp:37000,actCount:1,acts:[act(1,15),act(211,15),act(212,20),act(206,20),act(617,20),act(909,10)],elmRes:{風:40,闇:30,光:-30},resists:{Fear:80,Poison:80}}),
    m({id:100142,name:'ヴェルドクローン',race:'魔族',rank:156,minF:156,hp:1591,mp:274,atk:289,def:210,spd:176,mag:311,mdef:210,gold:35000,exp:37000,actCount:1,acts:[act(1,15),act(405,10),act(425,20),act(426,20),act(908,20),act(500,15)],elmRes:{火:40,闇:50,混沌:40,光:-20,雷:-20},resists:{Poison:100,Seal:100,Debuff:50,InstantDeath:100}}),
    m({id:100143,name:'イビルフレイム',race:'精霊',rank:156,minF:156,hp:1312,mp:274,atk:8,def:98,spd:188,mag:311,mdef:210,gold:35000,exp:37000,actCount:1,acts:[act(1,15),act(305,10),act(407,20),act(425,20),act(613,20),act(901,15)],elmRes:{火:70,混沌:30,水:-50},resists:{Poison:100,Seal:90}}),
    m({id:100144,name:'ラグナビースト',race:'獣人',rank:156,minF:156,hp:1909,mp:348,atk:239,def:220,spd:188,mag:248,mdef:220,gold:57750,exp:61050,actCount:2,isElite:true,acts:[act(1,10),act(425,20),act(426,20),act(908,20),act(500,10),act(57,10),act(90,10)],drops:{normal:{id:107,rate:0.3},rare:{id:106,rate:3}},elmRes:{火:50,闇:60,混沌:50,光:-20,雷:-20},resists:{Poison:100,Seal:120,Debuff:70,InstantDeath:100}}),
  ]},

  { bandStart: 161, bandEnd: 165, monsters: [
    m({id:100145,name:'牙王マルバス',race:'獣',rank:161,minF:161,hp:1684,mp:160,atk:261,def:169,spd:210,mag:8,mdef:73,gold:42000,exp:44000,actCount:1,acts:[act(1,15),act(108,10),act(212,25),act(206,20),act(617,20),act(909,10)],elmRes:{風:50,闇:30,火:-20,光:-20},resists:{Fear:90}}),
    m({id:100146,name:'災厄機兵ヴリトラ',race:'機械',rank:161,minF:161,hp:1855,mp:160,atk:266,def:248,spd:148,mag:94,mdef:199,gold:42000,exp:44000,actCount:1,acts:[act(1,15),act(154,10),act(401,20),act(409,20),act(420,20),act(431,15)],elmRes:{闇:40,光:20,雷:-50},resists:{Poison:120,Shock:100,Seal:70}}),
    m({id:100147,name:'魔導装甲ジャッジ',race:'無生物',rank:161,minF:161,hp:1800,mp:274,atk:230,def:257,spd:141,mag:257,mdef:210,gold:42000,exp:44000,actCount:1,acts:[act(1,15),act(306,10),act(412,20),act(408,20),act(59,15),act(53,20)],elmRes:{光:50,雷:40,闇:-30},resists:{Poison:120,Seal:100}}),
    m({id:100148,name:'黒翼司祭アスタロト',race:'魔族',rank:161,minF:161,hp:1492,mp:285,atk:115,def:141,spd:188,mag:261,mdef:220,gold:42000,exp:44000,actCount:1,acts:[act(1,15),act(307,10),act(423,20),act(24,10),act(905,25),act(804,20)],elmRes:{闇:70,光:-40},resists:{Poison:100,Seal:120,InstantDeath:100}}),
  ]},

  { bandStart: 166, bandEnd: 170, monsters: [
    m({id:100149,name:'ネクロマンサー',race:'死霊',rank:166,minF:166,hp:1559,mp:296,atk:133,def:103,spd:199,mag:266,mdef:230,gold:50000,exp:52000,actCount:1,acts:[act(1,15),act(312,10),act(423,20),act(426,20),act(805,15),act(905,20)],elmRes:{闇:70,混沌:30,光:-50},resists:{Poison:120,Seal:100,InstantDeath:120}}),
    m({id:100150,name:'アビスデーモン',race:'魔族',rank:166,minF:166,hp:1800,mp:285,atk:248,def:210,spd:169,mag:257,mdef:210,gold:50000,exp:52000,actCount:1,acts:[act(1,15),act(104,10),act(411,20),act(426,20),act(908,20),act(901,15)],elmRes:{闇:70,混沌:40,光:-30},resists:{Poison:100,Seal:100,Debuff:50,InstantDeath:100}}),
    m({id:100151,name:'ダークワイバーン',race:'竜',rank:166,minF:166,hp:1909,mp:274,atk:261,def:210,spd:188,mag:257,mdef:210,gold:50000,exp:52000,actCount:1,acts:[act(1,15),act(604,10),act(611,20),act(616,20),act(614,20),act(615,15)],elmRes:{闇:60,風:50,光:-30},resists:{Poison:120,Fear:120,Seal:80}}),
    m({id:100152,name:'シャドウマシーン',race:'機械',rank:166,minF:166,hp:1855,mp:165,atk:266,def:248,spd:176,mag:8,mdef:199,gold:50000,exp:52000,actCount:1,acts:[act(1,15),act(154,10),act(420,20),act(206,20),act(431,15),act(57,20)],elmRes:{闇:60,雷:-50},resists:{Poison:120,Shock:100}}),
    m({id:100153,name:'翼竜王ヴリトラ',race:'竜',rank:166,minF:166,hp:2465,mp:306,atk:210,def:257,spd:199,mag:210,mdef:230,gold:82500,exp:85800,actCount:2,isElite:true,acts:[act(1,10),act(611,20),act(616,20),act(614,20),act(615,15),act(901,15)],drops:{normal:{id:100,rate:3},rare:{id:106,rate:2}},elmRes:{闇:70,風:60,混沌:30,光:-30},resists:{Poison:120,Fear:120,Seal:100}}),
  ]},

  { bandStart: 171, bandEnd: 175, monsters: [
    m({id:100154,name:'終焔執事スルト',race:'魔族',rank:171,minF:171,hp:2158,mp:274,atk:274,def:230,spd:176,mag:274,mdef:210,gold:60000,exp:62000,actCount:1,acts:[act(1,15),act(40,10),act(213,20),act(424,20),act(613,20),act(901,15)],elmRes:{火:70,闇:30,水:-40,光:-30},resists:{Poison:100,Seal:90}}),
    m({id:100155,name:'凍獄執事コキュートス',race:'魔族',rank:171,minF:171,hp:2158,mp:274,atk:274,def:230,spd:176,mag:274,mdef:210,gold:60000,exp:62000,actCount:1,acts:[act(1,15),act(42,10),act(406,20),act(428,20),act(612,20),act(901,15)],elmRes:{水:70,闇:30,雷:-40,光:-30},resists:{Poison:100,Seal:90}}),
    m({id:100156,name:'轟雷執事バアル',race:'魔族',rank:171,minF:171,hp:2158,mp:274,atk:274,def:230,spd:176,mag:274,mdef:210,gold:60000,exp:62000,actCount:1,acts:[act(1,15),act(43,10),act(408,20),act(427,20),act(413,20),act(901,15)],elmRes:{雷:70,闇:30,風:-40,光:-30},resists:{Poison:100,Seal:90,Shock:100}}),
    m({id:100157,name:'冥王タナトス',race:'死霊',rank:171,minF:171,hp:2381,mp:274,atk:176,def:230,spd:89,mag:274,mdef:210,gold:60000,exp:62000,actCount:1,acts:[act(1,15),act(405,10),act(609,20),act(908,20),act(911,20),act(901,15)],elmRes:{混沌:60,闇:40,火:30,光:-30,雷:-20},resists:{Poison:120,Seal:100}}),
  ]},

  { bandStart: 176, bandEnd: 180, monsters: [
    m({id:100158,name:'アビスドラゴン',race:'竜',rank:176,minF:176,hp:2465,mp:306,atk:289,def:239,spd:188,mag:289,mdef:230,gold:70000,exp:73000,actCount:1,acts:[act(1,10),act(605,10),act(610,20),act(611,20),act(616,20),act(615,20)],elmRes:{火:60,闇:60,光:40,混沌:30,水:-20,雷:-20},resists:{Poison:120,Fear:120,Seal:100}}),
    m({id:100159,name:'冥騎士ベレト',race:'死霊',rank:176,minF:176,hp:2295,mp:194,atk:297,def:239,spd:169,mag:163,mdef:210,gold:70000,exp:73000,actCount:1,acts:[act(1,10),act(104,10),act(411,20),act(421,10),act(119,25),act(804,25)],elmRes:{闇:70,光:-50},resists:{Poison:120,Seal:100,InstantDeath:120}}),
    m({id:100160,name:'魔触アルラウネ',race:'植物',rank:176,minF:176,hp:2158,mp:306,atk:94,def:176,spd:133,mag:297,mdef:230,gold:70000,exp:73000,actCount:1,acts:[act(1,10),act(702,10),act(908,25),act(905,25),act(24,10),act(911,20)],elmRes:{闇:50,混沌:50,火:-40,光:-20},resists:{Poison:150,Seal:100}}),
    m({id:100161,name:'イービルレイス',race:'精霊',rank:176,minF:176,hp:2111,mp:326,atk:8,def:115,spd:199,mag:301,mdef:248,gold:70000,exp:73000,actCount:1,acts:[act(1,10),act(407,10),act(425,20),act(426,20),act(430,20),act(901,20)],elmRes:{火:40,闇:60,光:40,混沌:-20},resists:{Poison:120,Seal:120}}),
    m({id:100162,name:'屍竜ファフニール',race:'竜',rank:176,minF:176,hp:2985,mp:326,atk:239,def:257,spd:199,mag:239,mdef:248,gold:115500,exp:120450,actCount:2,isElite:true,acts:[act(1,10),act(610,20),act(611,20),act(616,20),act(615,15),act(901,15)],drops:{normal:{id:107,rate:0.4},rare:{id:106,rate:3}},elmRes:{火:70,闇:70,光:50,混沌:40,水:-20,雷:-20},resists:{Poison:150,Fear:150,Seal:120}}),
  ]},

  { bandStart: 181, bandEnd: 185, monsters: [
    m({id:100163,name:'カラミティナイト',race:'魔族',rank:181,minF:181,hp:2585,mp:194,atk:325,def:266,spd:169,mag:188,mdef:230,gold:85000,exp:90000,actCount:1,acts:[act(1,10),act(102,10),act(421,15),act(923,10),act(414,25),act(905,30)],elmRes:{闇:60,混沌:50,光:-40},resists:{Poison:120,Seal:100,InstantDeath:100}}),
    m({id:100164,name:'深淵のキルケー',race:'魔族',rank:181,minF:181,hp:2465,mp:354,atk:8,def:163,spd:188,mag:329,mdef:266,gold:85000,exp:90000,actCount:1,acts:[act(1,10),act(407,10),act(425,20),act(426,20),act(427,20),act(901,20)],elmRes:{火:50,雷:50,闇:60,混沌:40,光:-40},resists:{Seal:150,Poison:100,InstantDeath:100}}),
    m({id:100165,name:'デスアーマー',race:'無生物',rank:181,minF:181,hp:2774,mp:179,atk:318,def:297,spd:141,mag:105,mdef:239,gold:85000,exp:90000,actCount:1,acts:[act(1,10),act(117,10),act(421,15),act(431,15),act(118,25),act(57,25)],elmRes:{闇:50,光:50,混沌:30,雷:-30},resists:{Poison:150,Shock:120,Seal:100}}),
    m({id:100166,name:'黒炎竜アモン',race:'竜',rank:181,minF:181,hp:2774,mp:316,atk:325,def:266,spd:188,mag:325,mdef:248,gold:85000,exp:90000,actCount:1,acts:[act(1,10),act(605,10),act(613,20),act(609,20),act(616,20),act(901,20)],elmRes:{火:80,闇:50,混沌:40,水:-50,光:-20},resists:{Poison:150,Fear:120,Seal:100}}),
  ]},

  { bandStart: 186, bandEnd: 190, monsters: [
    m({id:100167,name:'アスモデウス',race:'魔族',rank:186,minF:186,hp:2916,mp:224,atk:332,def:282,spd:176,mag:188,mdef:248,gold:100000,exp:105000,actCount:1,acts:[act(1,10),act(106,10),act(111,20),act(119,20),act(421,15),act(902,25)],elmRes:{闇:70,混沌:40,光:-30},resists:{Poison:120,Seal:120,InstantDeath:100}}),
    m({id:100168,name:'グレイブロード',race:'死霊',rank:186,minF:186,hp:2465,mp:354,atk:148,def:115,spd:199,mag:332,mdef:266,gold:100000,exp:105000,actCount:1,acts:[act(1,10),act(423,10),act(426,20),act(805,15),act(922,25),act(901,20)],elmRes:{闇:80,混沌:40,光:-50},resists:{Poison:150,Seal:120,InstantDeath:150}}),
    m({id:100169,name:'機神アマデウス',race:'機械',rank:186,minF:186,hp:2951,mp:184,atk:332,def:311,spd:199,mag:8,mdef:248,gold:100000,exp:105000,actCount:1,acts:[act(1,10),act(154,10),act(420,20),act(431,15),act(432,10),act(401,35)],elmRes:{闇:50,光:40,雷:-50},resists:{Poison:150,Shock:150,Seal:100}}),
    m({id:100170,name:'ヨルムンガンド',race:'粘体',rank:186,minF:186,hp:2985,mp:316,atk:199,def:266,spd:94,mag:325,mdef:248,gold:100000,exp:105000,actCount:1,acts:[act(1,10),act(405,10),act(911,20),act(908,20),act(901,20),act(53,20)],elmRes:{混沌:60,闇:50,光:30,雷:-30},resists:{Poison:150,Seal:120}}),
    m({id:100171,name:'滅神アポカリプス',race:'機械',rank:186,minF:186,hp:3656,mp:212,atk:266,def:325,spd:210,mag:8,mdef:266,gold:165000,exp:173250,actCount:2,isElite:true,acts:[act(1,10),act(420,20),act(431,15),act(432,10),act(409,20),act(57,25)],drops:{normal:{id:106,rate:3},rare:{id:107,rate:0.6}},elmRes:{闇:60,光:50,雷:-50},resists:{Poison:150,Shock:150,Seal:120}}),
  ]},

  { bandStart: 191, bandEnd: 195, monsters: [
    m({id:100172,name:'常闇のリリス',race:'魔族',rank:191,minF:191,hp:3245,mp:387,atk:282,def:282,spd:199,mag:364,mdef:282,gold:120000,exp:130000,actCount:1,acts:[act(1,10),act(407,10),act(425,20),act(426,20),act(908,20),act(901,20)],elmRes:{火:60,闇:80,混沌:50,光:-30},resists:{Poison:150,Seal:150,InstantDeath:120}}),
    m({id:100173,name:'魔竜騎兵カイン',race:'竜人',rank:191,minF:191,hp:3367,mp:316,atk:364,def:297,spd:205,mag:266,mdef:266,gold:120000,exp:130000,actCount:1,acts:[act(1,10),act(103,10),act(409,20),act(421,15),act(616,20),act(901,25)],elmRes:{火:50,雷:50,闇:50,混沌:40,光:-30},resists:{Poison:150,Fear:120,Seal:120}}),
    m({id:100174,name:'ソウルイーター',race:'死霊',rank:191,minF:191,hp:2916,mp:387,atk:199,def:119,spd:210,mag:364,mdef:282,gold:120000,exp:130000,actCount:1,acts:[act(1,10),act(47,10),act(922,20),act(805,15),act(426,20),act(901,25)],elmRes:{闇:80,混沌:50,光:-50},resists:{Poison:150,Seal:150,InstantDeath:150}}),
    m({id:100175,name:'混沌装甲アケローン',race:'無生物',rank:191,minF:191,hp:3367,mp:189,atk:364,def:332,spd:148,mag:115,mdef:282,gold:120000,exp:130000,actCount:1,acts:[act(1,10),act(117,10),act(411,20),act(421,15),act(432,10),act(57,35)],elmRes:{闇:60,光:60,混沌:50,雷:-30},resists:{Poison:150,Shock:150,Seal:120}}),
  ]},

  { bandStart: 196, bandEnd: 200, monsters: [
    m({id:100176,name:'大魔導ジャミラ',race:'魔族',rank:196,minF:196,hp:3486,mp:433,atk:8,def:188,spd:210,mag:364,mdef:311,gold:150000,exp:160000,actCount:1,acts:[act(1,10),act(407,10),act(425,20),act(426,20),act(427,20),act(906,20)],elmRes:{火:60,雷:60,闇:80,混沌:60,光:-40},resists:{Poison:150,Seal:150,InstantDeath:150}}),
    m({id:100177,name:'獄機ヘルマジンガ',race:'機械',rank:196,minF:196,hp:3543,mp:194,atk:364,def:364,spd:199,mag:8,mdef:311,gold:150000,exp:160000,actCount:1,acts:[act(1,10),act(420,10),act(431,15),act(432,10),act(409,25),act(57,30)],elmRes:{闇:60,光:60,雷:-50,混沌:40},resists:{Poison:150,Shock:150,Seal:150}}),
    m({id:100178,name:'ウロボロスロード',race:'粘体',rank:196,minF:196,hp:3543,mp:600,atk:210,def:311,spd:105,mag:351,mdef:297,gold:150000,exp:160000,actCount:1,acts:[act(1,10),act(405,10),act(908,20),act(911,20),act(901,20),act(999,5),act(53,15)],elmRes:{混沌:70,闇:60,光:40,火:40,雷:-30},resists:{Poison:150,Seal:150,InstantDeath:120}}),
    m({id:100179,name:'竜王ティアマト',race:'竜',rank:196,minF:196,hp:3543,mp:387,atk:364,def:311,spd:199,mag:351,mdef:297,gold:150000,exp:160000,actCount:1,acts:[act(1,10),act(605,10),act(610,20),act(611,20),act(616,20),act(906,20)],elmRes:{火:60,水:40,闇:70,光:50,混沌:50,雷:-20},resists:{Poison:150,Fear:150,Seal:150,InstantDeath:120}}),
    m({id:100180,name:'審判機神ジャジメント',race:'機械',rank:196,minF:196,hp:4269,mp:315,atk:289,def:381,spd:215,mag:8,mdef:325,gold:247500,exp:264000,actCount:2,isElite:true,acts:[act(1,5),act(420,15),act(409,20),act(431,15),act(432,10),act(57,20),act(906,15)],drops:{normal:{id:107,rate:0.8},rare:{id:106,rate:4}},elmRes:{闇:70,光:70,雷:-50,混沌:50},resists:{Poison:150,Shock:150,Seal:150,InstantDeath:150}}),
  ]},
];

const FIXED_RARE_MONSTERS = [
  {"id":200201,"name":"メタルジェリー","race":"粘体","rank":10,"minF":5,"hp":1,"mp":67,"atk":3,"def":664,"spd":210,"mag":23,"mdef":664,"hit":100,"eva":25,"cri":20,"gold":50,"exp":1000,"actCount":1,"isBoss":false,"isRare":true,"isEstark":false,"acts":[{"id":1,"rate":20,"condition":0},{"id":10,"rate":20,"condition":0},{"id":9,"rate":60,"condition":0}],"drops":{"normal":{"id":102,"rate":20},"rare":{"id":106,"rate":10}},"elmRes":{"火":120,"水":120,"風":120,"雷":120,"光":120,"闇":120,"混沌":120},"resists":{"Poison":100,"Shock":100,"Fear":50,"Seal":100,"Debuff":100,"InstantDeath":100},"traits":[],"archives":["とても固く逃げ足が速いが、倒すと大きな経験を得られるとして人気の魔物。"]},
  {"id":200202,"name":"ロンリーメタル","race":"粘体","rank":40,"minF":20,"hp":1,"mp":67,"atk":8,"def":664,"spd":336,"mag":106,"mdef":664,"hit":100,"eva":25,"cri":20,"gold":200,"exp":20000,"actCount":1,"isBoss":false,"isRare":true,"isEstark":false,"acts":[{"id":1,"rate":10,"condition":0},{"id":302,"rate":25,"condition":0},{"id":9,"rate":45,"condition":0}],"drops":{"normal":{"id":103,"rate":20},"rare":{"id":106,"rate":10}},"elmRes":{"火":1000,"水":1000,"風":1000,"雷":1000,"光":1000,"闇":1000,"混沌":1000},"resists":{"Poison":100,"Shock":100,"Fear":50,"Seal":100,"Debuff":100,"InstantDeath":1000},"traits":[],"archives":[]},
  {"id":200203,"name":"メタルロード","race":"粘体","rank":80,"minF":50,"hp":1,"mp":250,"atk":22,"def":2100,"spd":664,"mag":210,"mdef":2100,"hit":100,"eva":25,"cri":20,"gold":1000,"exp":100000,"actCount":1,"isBoss":false,"isRare":true,"isEstark":false,"acts":[{"id":1,"rate":5,"condition":0},{"id":306,"rate":25,"condition":0},{"id":9,"rate":70,"condition":0}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":1000,"水":1000,"風":1000,"雷":1000,"光":1000,"闇":1000,"混沌":1000},"resists":{"Poison":100,"Shock":100,"Fear":50,"Seal":100,"Debuff":100,"InstantDeath":1000},"traits":[],"archives":[]},
  {"id":200204,"name":"プリズムキング","race":"粘体","rank":100,"minF":101,"hp":4,"mp":250,"atk":56,"def":2100,"spd":210,"mag":297,"mdef":2100,"hit":100,"eva":25,"cri":20,"gold":4160,"exp":416000,"actCount":2,"isBoss":false,"isRare":true,"isEstark":false,"acts":[{"id":406,"rate":20,"condition":0},{"id":407,"rate":20,"condition":0},{"id":500,"rate":10,"condition":0},{"id":9,"rate":40,"condition":0},{"id":1,"rate":10,"condition":0}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":1000,"水":1000,"風":1000,"雷":1000,"光":1000,"闇":1000,"混沌":1000},"resists":{"Poison":100,"Shock":100,"Fear":50,"Seal":100,"Debuff":100,"InstantDeath":1000},"traits":[],"archives":[]},
];

const FIXED_BOSS_MONSTERS = [
  // ストーリーボス（300000～）

  // はじまりの村-北東の洞穴ボス
  {"id":301000,"name":"バトルリザード","race":"竜","rank":10,"minF":1,"hp":156,"mp":33,"atk":23,"def":14,"spd":7,"mag":6,"mdef":6,"hit":150,"eva":5,"cri":15,"gold":500,"exp":1000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":40,"rate":17,"condition":0},{"id":44,"rate":17,"condition":0},{"id":601,"rate":17,"condition":0},{"id":41,"rate":16,"condition":0}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[],"archives":[]},

  // 炎の里中ボス（未調整）
  {"id":301001,"name":"ブロンズナイト","race":"人","rank":10,"minF":1,"hp":156,"mp":33,"atk":23,"def":14,"spd":7,"mag":6,"mdef":6,"hit":150,"eva":5,"cri":15,"gold":500,"exp":1000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":40,"rate":17,"condition":0},{"id":44,"rate":17,"condition":0},{"id":601,"rate":17,"condition":0},{"id":41,"rate":16,"condition":0}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[],"archives":[]},
  {"id":301002,"name":"ブロンズリーダー","race":"人","rank":10,"minF":1,"hp":156,"mp":33,"atk":23,"def":14,"spd":7,"mag":6,"mdef":6,"hit":150,"eva":5,"cri":15,"gold":500,"exp":1000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":40,"rate":17,"condition":0},{"id":44,"rate":17,"condition":0},{"id":601,"rate":17,"condition":0},{"id":41,"rate":16,"condition":0}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[],"archives":[]},

  // 炎の里ボス（未調整）
  {"id":301010,"name":"炎楔のグラド","race":"人","rank":20,"minF":60,"hp":1273,"mp":206,"atk":122,"def":145,"spd":110,"mag":169,"mdef":148,"hit":150,"eva":5,"cri":15,"gold":8000,"exp":15000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":407,"rate":13,"condition":0},{"id":306,"rate":13,"condition":0},{"id":307,"rate":13,"condition":0},{"id":605,"rate":13,"condition":0},{"id":606,"rate":12,"condition":0},{"id":905,"rate":12,"condition":0},{"id":57,"rate":12,"condition":0},{"id":3,"rate":12,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":103,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":50,"level":2}],"archives":[]},

  // 風の集落中ボス（未調整）
  {"id":301011,"name":"シルフウルフ","race":"獣","rank":30,"minF":40,"hp":832,"mp":144,"atk":105,"def":106,"spd":68,"mag":101,"mdef":94,"hit":150,"eva":5,"cri":15,"gold":3000,"exp":6000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":304,"rate":17,"condition":0},{"id":309,"rate":17,"condition":0},{"id":305,"rate":17,"condition":0},{"id":603,"rate":16,"condition":0},{"id":605,"rate":16,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":104,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":48,"level":2}],"archives":[]},
  {"id":301012,"name":"ヒールフェアリー","race":"精霊","rank":30,"minF":40,"hp":832,"mp":144,"atk":105,"def":106,"spd":68,"mag":101,"mdef":94,"hit":150,"eva":5,"cri":15,"gold":3000,"exp":6000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":304,"rate":17,"condition":0},{"id":309,"rate":17,"condition":0},{"id":305,"rate":17,"condition":0},{"id":603,"rate":16,"condition":0},{"id":605,"rate":16,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":104,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":48,"level":2}],"archives":[]},

  // 風の集落ボス（未調整）
  {"id":301020,"name":"風楔のエリシア","race":"人","rank":30,"minF":40,"hp":832,"mp":144,"atk":105,"def":106,"spd":68,"mag":101,"mdef":94,"hit":150,"eva":5,"cri":15,"gold":3000,"exp":6000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":304,"rate":17,"condition":0},{"id":309,"rate":17,"condition":0},{"id":305,"rate":17,"condition":0},{"id":603,"rate":16,"condition":0},{"id":605,"rate":16,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":104,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":48,"level":2}],"archives":[]},

  // 水上都市中ボス（未調整）
  {"id":301021,"name":"ダークソルジャー","race":"人","rank":10,"minF":1,"hp":156,"mp":33,"atk":23,"def":14,"spd":7,"mag":6,"mdef":6,"hit":150,"eva":5,"cri":15,"gold":500,"exp":1000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":40,"rate":17,"condition":0},{"id":44,"rate":17,"condition":0},{"id":601,"rate":17,"condition":0},{"id":41,"rate":16,"condition":0}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[],"archives":[]},
  {"id":301022,"name":"ダークナイト","race":"人","rank":10,"minF":1,"hp":156,"mp":33,"atk":23,"def":14,"spd":7,"mag":6,"mdef":6,"hit":150,"eva":5,"cri":15,"gold":500,"exp":1000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":40,"rate":17,"condition":0},{"id":44,"rate":17,"condition":0},{"id":601,"rate":17,"condition":0},{"id":41,"rate":16,"condition":0}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[],"archives":[]},

  // 水上都市ボス（未調整）
  {"id":301030,"name":"氷楔のシーリス ","race":"人","rank":40,"minF":50,"hp":986,"mp":162,"atk":121,"def":138,"spd":81,"mag":117,"mdef":115,"hit":150,"eva":5,"cri":15,"gold":5000,"exp":10000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":15,"condition":0},{"id":42,"rate":15,"condition":0},{"id":303,"rate":14,"condition":0},{"id":604,"rate":14,"condition":0},{"id":44,"rate":14,"condition":0},{"id":41,"rate":14,"condition":0},{"id":203,"rate":14,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":105,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":49,"level":2}],"archives":[]},

  // 雷の要塞中ボス（未調整）
  {"id":301031,"name":"バトルマシーン","race":"機械","rank":10,"minF":1,"hp":156,"mp":33,"atk":23,"def":14,"spd":7,"mag":6,"mdef":6,"hit":150,"eva":5,"cri":15,"gold":500,"exp":1000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":40,"rate":17,"condition":0},{"id":44,"rate":17,"condition":0},{"id":601,"rate":17,"condition":0},{"id":41,"rate":16,"condition":0}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[],"archives":[]},
  {"id":301032,"name":"サンダーアーマー","race":"人","rank":10,"minF":1,"hp":156,"mp":33,"atk":23,"def":14,"spd":7,"mag":6,"mdef":6,"hit":150,"eva":5,"cri":15,"gold":500,"exp":1000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":40,"rate":17,"condition":0},{"id":44,"rate":17,"condition":0},{"id":601,"rate":17,"condition":0},{"id":41,"rate":16,"condition":0}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[],"archives":[]},

  // 雷の要塞ボス（未調整）
  {"id":301040,"name":"雷楔のレナード","race":"人","rank":50,"minF":30,"hp":667,"mp":123,"atk":84,"def":50,"spd":47,"mag":44,"mdef":39,"hit":150,"eva":5,"cri":15,"gold":2000,"exp":4000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":13,"condition":0},{"id":41,"rate":13,"condition":0},{"id":44,"rate":13,"condition":0},{"id":101,"rate":13,"condition":0},{"id":102,"rate":12,"condition":0},{"id":104,"rate":12,"condition":0},{"id":105,"rate":12,"condition":0},{"id":49,"rate":12,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":102,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":49,"level":2}],"archives":[]},

  // 中ボス（未調整）
  {"id":301050,"name":"聖騎士ヴェルド","race":"人","rank":60,"minF":70,"hp":1452,"mp":224,"atk":171,"def":154,"spd":114,"mag":183,"mdef":176,"hit":150,"eva":5,"cri":15,"gold":10000,"exp":20000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":10,"condition":0},{"id":306,"rate":25,"condition":1},{"id":405,"rate":20,"condition":2},{"id":406,"rate":20,"condition":0},{"id":407,"rate":20,"condition":0},{"id":57,"rate":5,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":101,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":12,"level":2},{"id":19,"level":5}],"archives":[]},

  // 大灯台ボス（未調整）
  {"id":301060,"name":"ヘルクラッシャー","race":"機械","rank":70,"minF":80,"hp":1452,"mp":194,"atk":188,"def":94,"spd":71,"mag":80,"mdef":94,"hit":70,"eva":0,"cri":50,"gold":4500,"exp":10000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":113,"rate":50,"condition":0},{"id":101,"rate":20,"condition":0},{"id":102,"rate":20,"condition":0},{"id":44,"rate":9,"condition":0},{"id":1,"rate":1,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":102,"rate":1}},"elmRes":{},"resists":{"InstantDeath":50},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":301061,"name":"常闇のリリス","race":"魔族","rank":70,"minF":80,"hp":1225,"mp":200,"atk":168,"def":153,"spd":124,"mag":172,"mdef":163,"hit":150,"eva":10,"cri":15,"gold":4500,"exp":10000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":412,"rate":15,"condition":0},{"id":500,"rate":10,"condition":2},{"id":309,"rate":20,"condition":0},{"id":202,"rate":20,"condition":0},{"id":46,"rate":25,"condition":0},{"id":81,"rate":5,"condition":2},{"id":57,"rate":5,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":104,"rate":1}},"elmRes":{},"resists":{"InstantDeath":90},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":301062,"name":"デモンキャット","race":"獣人","rank":70,"minF":80,"hp":1273,"mp":229,"atk":176,"def":163,"spd":104,"mag":169,"mdef":148,"hit":150,"eva":10,"cri":15,"gold":5000,"exp":10000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":1,"condition":0},{"id":305,"rate":15,"condition":1},{"id":306,"rate":15,"condition":1},{"id":24,"rate":10,"condition":2},{"id":50,"rate":10,"condition":0},{"id":412,"rate":17,"condition":2},{"id":609,"rate":17,"condition":2},{"id":405,"rate":15,"condition":2}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":105,"rate":1}},"elmRes":{},"resists":{"InstantDeath":50},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},

  // 光の宮殿ボス（未調整）
  {"id":301070,"name":"魔道神官ジャスパー","race":"人","rank":80,"minF":90,"hp":1909,"mp":224,"atk":157,"def":172,"spd":124,"mag":197,"mdef":176,"hit":150,"eva":10,"cri":15,"gold":20000,"exp":41600,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":404,"rate":20,"condition":0},{"id":405,"rate":15,"condition":2},{"id":406,"rate":15,"condition":0},{"id":407,"rate":15,"condition":0},{"id":412,"rate":10,"condition":0},{"id":500,"rate":10,"condition":2},{"id":57,"rate":5,"condition":0},{"id":81,"rate":10,"condition":2}],"drops":{"normal":{"id":5,"rate":20},"rare":{"id":106,"rate":1}},"elmRes":{},"resists":{"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5},{"id":30,"level":5}],"archives":[]},
  {"id":401071,"name":"聖騎士ヴェルド","race":"人","rank":80,"minF":160,"hp":3974,"mp":297,"atk":297,"def":297,"spd":148,"mag":332,"mdef":332,"hit":100,"eva":0,"cri":50,"gold":140000,"exp":180000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":500,"rate":5,"condition":2},{"id":612,"rate":15,"condition":0},{"id":613,"rate":15,"condition":0},{"id":610,"rate":15,"condition":0},{"id":611,"rate":15,"condition":0},{"id":908,"rate":10,"condition":2},{"id":907,"rate":5,"condition":2},{"id":81,"rate":10,"condition":2},{"id":57,"rate":5,"condition":0},{"id":90,"rate":5,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":20,"水":20,"風":20,"雷":20,"光":20,"闇":20,"混沌":20},"resists":{"Poison":80,"Shock":80,"Fear":100,"Seal":100,"Debuff":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},

  // 魔王城中ボス（未調整）
  {"id":401160,"name":"常闇のゼルドラス","race":"魔族","rank":160,"minF":160,"hp":3628,"mp":791,"atk":345,"def":274,"spd":163,"mag":148,"mdef":274,"hit":150,"eva":20,"cri":15,"gold":66666,"exp":66666,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":119,"rate":15,"condition":0},{"id":113,"rate":25,"condition":1},{"id":411,"rate":20,"condition":2},{"id":55,"rate":10,"condition":2},{"id":31,"rate":10,"condition":0},{"id":202,"rate":20,"condition":0}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"Poison":70,"Shock":70,"InstantDeath":95,"Fear":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401161,"name":"冥騎士ベレト","race":"魔族","rank":160,"minF":160,"hp":3974,"mp":297,"atk":297,"def":297,"spd":148,"mag":332,"mdef":332,"hit":100,"eva":0,"cri":50,"gold":140000,"exp":180000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":500,"rate":5,"condition":2},{"id":612,"rate":15,"condition":0},{"id":613,"rate":15,"condition":0},{"id":610,"rate":15,"condition":0},{"id":611,"rate":15,"condition":0},{"id":908,"rate":10,"condition":2},{"id":907,"rate":5,"condition":2},{"id":81,"rate":10,"condition":2},{"id":57,"rate":5,"condition":0},{"id":90,"rate":5,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":20,"水":20,"風":20,"雷":20,"光":20,"闇":20,"混沌":20},"resists":{"Poison":80,"Shock":80,"Fear":100,"Seal":100,"Debuff":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401162,"name":"風詠のエルメナス","race":"魔族","rank":160,"minF":160,"hp":3245,"mp":791,"atk":297,"def":257,"spd":133,"mag":345,"mdef":257,"hit":150,"eva":20,"cri":15,"gold":66666,"exp":66666,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":407,"rate":13,"condition":1},{"id":406,"rate":13,"condition":0},{"id":412,"rate":14,"condition":0},{"id":922,"rate":15,"condition":2},{"id":24,"rate":15,"condition":2},{"id":403,"rate":10,"condition":2},{"id":56,"rate":20,"condition":3}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"Poison":70,"Shock":70,"InstantDeath":95,"Seal":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},

  // 魔王城ボス（未調整）
  {"id":301100,"name":"魔王ゼノン","race":"魔族","rank":100,"minF":100,"hp":2212,"mp":250,"atk":210,"def":210,"spd":129,"mag":210,"mdef":210,"hit":150,"eva":10,"cri":15,"gold":41600,"exp":90000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":119,"rate":15,"condition":0},{"id":202,"rate":20,"condition":0},{"id":412,"rate":15,"condition":0},{"id":406,"rate":20,"condition":0},{"id":403,"rate":10,"condition":2},{"id":411,"rate":15,"condition":2},{"id":57,"rate":5,"condition":0},{"id":617,"rate":10,"condition":0}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":20,"水":20,"風":20,"雷":20,"光":20,"闇":20,"混沌":20},"resists":{"Poison":70,"Shock":70,"Fear":100,"Seal":100,"Debuff":0,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":18,"level":5},{"id":19,"level":5}],"archives":[]},

  // イベントボス（300000～）

  // 中間試練ボス（未調整）
  {"id":502049,"name":"魔神シヴァ","race":"精霊","rank":120,"minF":120,"hp":3312,"mp":791,"atk":210,"def":205,"spd":151,"mag":282,"mdef":257,"hit":150,"eva":10,"cri":15,"gold":81600,"exp":90000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":406,"rate":15,"condition":0},{"id":415,"rate":10,"condition":0},{"id":307,"rate":10,"condition":1},{"id":921,"rate":20,"condition":0},{"id":922,"rate":15,"condition":2},{"id":606,"rate":15,"condition":2},{"id":905,"rate":10,"condition":0},{"id":57,"rate":5,"condition":0},{"id":90,"rate":5,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"水":100,"闇":100},"resists":{"Poison":70,"Shock":70,"Fear":100,"Seal":100,"Debuff":0,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},

  // 最終試練ボス（未調整）
  {"id":502098,"name":"戦神ヴァルキュリア","race":"精霊","rank":130,"minF":130,"hp":3765,"mp":791,"atk":274,"def":248,"spd":148,"mag":266,"mdef":257,"hit":150,"eva":10,"cri":15,"gold":100000,"exp":100000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":610,"rate":13,"condition":0},{"id":410,"rate":13,"condition":0},{"id":402,"rate":13,"condition":0},{"id":404,"rate":13,"condition":1},{"id":416,"rate":12,"condition":2},{"id":413,"rate":12,"condition":2},{"id":56,"rate":12,"condition":3},{"id":63,"rate":12,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"風":100,"光":100,"混沌":100},"resists":{"Poison":70,"Shock":70,"Fear":100,"Seal":100,"Debuff":0,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},

  // ダンジョンボス（400000～）
  {"id":401010,"name":"レオン将軍","race":"獣人","rank":10,"minF":10,"hp":402,"mp":67,"atk":29,"def":19,"spd":8,"mag":8,"mdef":8,"hit":150,"eva":5,"cri":15,"gold":500,"exp":1000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":40,"rate":17,"condition":0},{"id":44,"rate":17,"condition":0},{"id":601,"rate":17,"condition":0},{"id":603,"rate":16,"condition":0},{"id":41,"rate":16,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":100,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5}],"archives":[]},
  {"id":401020,"name":"グレン将軍","race":"獣人","rank":20,"minF":20,"hp":535,"mp":87,"atk":53,"def":29,"spd":32,"mag":47,"mdef":44,"hit":150,"eva":5,"cri":15,"gold":1000,"exp":2000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":15,"condition":0},{"id":301,"rate":15,"condition":0},{"id":302,"rate":14,"condition":0},{"id":303,"rate":14,"condition":0},{"id":201,"rate":14,"condition":0},{"id":307,"rate":14,"condition":0},{"id":40,"rate":14,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":101,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5}],"archives":[]},
  {"id":401030,"name":"雷楔のレナード","race":"魔族","rank":30,"minF":30,"hp":667,"mp":123,"atk":84,"def":50,"spd":47,"mag":44,"mdef":39,"hit":150,"eva":5,"cri":15,"gold":2000,"exp":4000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":13,"condition":0},{"id":41,"rate":13,"condition":0},{"id":44,"rate":13,"condition":0},{"id":101,"rate":13,"condition":0},{"id":102,"rate":12,"condition":0},{"id":104,"rate":12,"condition":0},{"id":105,"rate":12,"condition":0},{"id":49,"rate":12,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":102,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":49,"level":2}],"archives":[]},
  {"id":401040,"name":"風楔のエリシア","race":"魔族","rank":40,"minF":40,"hp":832,"mp":144,"atk":105,"def":106,"spd":68,"mag":101,"mdef":94,"hit":150,"eva":5,"cri":15,"gold":3000,"exp":6000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":304,"rate":17,"condition":0},{"id":309,"rate":17,"condition":0},{"id":305,"rate":17,"condition":0},{"id":603,"rate":16,"condition":0},{"id":605,"rate":16,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":104,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":48,"level":2}],"archives":[]},
  {"id":401050,"name":"氷楔のシーリス ","race":"魔族","rank":50,"minF":50,"hp":986,"mp":162,"atk":121,"def":138,"spd":81,"mag":117,"mdef":115,"hit":150,"eva":5,"cri":15,"gold":5000,"exp":10000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":15,"condition":0},{"id":42,"rate":15,"condition":0},{"id":303,"rate":14,"condition":0},{"id":604,"rate":14,"condition":0},{"id":44,"rate":14,"condition":0},{"id":41,"rate":14,"condition":0},{"id":203,"rate":14,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":105,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":49,"level":2}],"archives":[]},
  {"id":401060,"name":"炎楔のグラド","race":"魔族","rank":60,"minF":60,"hp":1273,"mp":206,"atk":122,"def":145,"spd":110,"mag":169,"mdef":148,"hit":150,"eva":5,"cri":15,"gold":8000,"exp":15000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":407,"rate":13,"condition":0},{"id":306,"rate":13,"condition":0},{"id":307,"rate":13,"condition":0},{"id":605,"rate":13,"condition":0},{"id":606,"rate":12,"condition":0},{"id":905,"rate":12,"condition":0},{"id":57,"rate":12,"condition":0},{"id":3,"rate":12,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":103,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":50,"level":2}],"archives":[]},
  {"id":401070,"name":"混沌の騎士ヴェルド","race":"魔族","rank":70,"minF":70,"hp":1452,"mp":224,"atk":171,"def":154,"spd":114,"mag":183,"mdef":176,"hit":150,"eva":5,"cri":15,"gold":10000,"exp":20000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":10,"condition":0},{"id":306,"rate":25,"condition":1},{"id":405,"rate":20,"condition":2},{"id":406,"rate":20,"condition":0},{"id":407,"rate":20,"condition":0},{"id":57,"rate":5,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":101,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":12,"level":2},{"id":19,"level":5}],"archives":[]},
  {"id":401080,"name":"ヘルクラッシャー","race":"機械","rank":80,"minF":80,"hp":1452,"mp":194,"atk":188,"def":94,"spd":71,"mag":80,"mdef":94,"hit":70,"eva":0,"cri":50,"gold":4500,"exp":10000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":113,"rate":50,"condition":0},{"id":101,"rate":20,"condition":0},{"id":102,"rate":20,"condition":0},{"id":44,"rate":9,"condition":0},{"id":1,"rate":1,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":102,"rate":1}},"elmRes":{},"resists":{"InstantDeath":50},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401081,"name":"アビスウィッチ","race":"魔族","rank":80,"minF":80,"hp":1225,"mp":200,"atk":168,"def":153,"spd":124,"mag":172,"mdef":163,"hit":150,"eva":10,"cri":15,"gold":4500,"exp":10000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":412,"rate":15,"condition":0},{"id":500,"rate":10,"condition":2},{"id":309,"rate":20,"condition":0},{"id":202,"rate":20,"condition":0},{"id":46,"rate":25,"condition":0},{"id":81,"rate":5,"condition":2},{"id":57,"rate":5,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":104,"rate":1}},"elmRes":{},"resists":{"InstantDeath":90},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401082,"name":"デモンキャット","race":"獣人","rank":80,"minF":80,"hp":1273,"mp":229,"atk":176,"def":163,"spd":104,"mag":169,"mdef":148,"hit":150,"eva":10,"cri":15,"gold":5000,"exp":10000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":1,"condition":0},{"id":305,"rate":15,"condition":1},{"id":306,"rate":15,"condition":1},{"id":24,"rate":10,"condition":2},{"id":50,"rate":10,"condition":0},{"id":412,"rate":17,"condition":2},{"id":609,"rate":17,"condition":2},{"id":405,"rate":15,"condition":2}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":105,"rate":1}},"elmRes":{},"resists":{"InstantDeath":50},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401090,"name":"暗黒神官ジャスパー","race":"魔族","rank":90,"minF":90,"hp":1909,"mp":224,"atk":157,"def":172,"spd":124,"mag":197,"mdef":176,"hit":150,"eva":10,"cri":15,"gold":20000,"exp":41600,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":404,"rate":20,"condition":0},{"id":405,"rate":15,"condition":2},{"id":406,"rate":15,"condition":0},{"id":407,"rate":15,"condition":0},{"id":412,"rate":10,"condition":0},{"id":500,"rate":10,"condition":2},{"id":57,"rate":5,"condition":0},{"id":81,"rate":10,"condition":2}],"drops":{"normal":{"id":5,"rate":20},"rare":{"id":106,"rate":1}},"elmRes":{},"resists":{"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5},{"id":30,"level":5}],"archives":[]},
  {"id":401100,"name":"魔王ゼノン","race":"魔族","rank":100,"minF":100,"hp":2212,"mp":250,"atk":210,"def":210,"spd":129,"mag":210,"mdef":210,"hit":150,"eva":10,"cri":15,"gold":41600,"exp":90000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":119,"rate":15,"condition":0},{"id":202,"rate":20,"condition":0},{"id":412,"rate":15,"condition":0},{"id":406,"rate":20,"condition":0},{"id":403,"rate":10,"condition":2},{"id":411,"rate":15,"condition":2},{"id":57,"rate":5,"condition":0},{"id":617,"rate":10,"condition":0}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":20,"水":20,"風":20,"雷":20,"光":20,"闇":20,"混沌":20},"resists":{"Poison":70,"Shock":70,"Fear":100,"Seal":100,"Debuff":0,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":18,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401110,"name":"封印竜ヴェルファイア","race":"竜","rank":110,"minF":110,"hp":2846,"mp":791,"atk":244,"def":244,"spd":136,"mag":244,"mdef":244,"hit":150,"eva":10,"cri":15,"gold":100000,"exp":100000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":3,"rate":15,"condition":0},{"id":614,"rate":10,"condition":1},{"id":612,"rate":10,"condition":1},{"id":613,"rate":10,"condition":1},{"id":610,"rate":10,"condition":2},{"id":611,"rate":10,"condition":2},{"id":413,"rate":10,"condition":2},{"id":107,"rate":10,"condition":2},{"id":56,"rate":10,"condition":3},{"id":57,"rate":5,"condition":0}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":20,"水":20,"風":20,"雷":20,"光":20,"闇":20,"混沌":20},"resists":{"Poison":0,"Shock":50,"Fear":100,"Seal":100,"Debuff":0,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401120,"name":"魔神シヴァ","race":"精霊","rank":120,"minF":120,"hp":3312,"mp":791,"atk":210,"def":205,"spd":151,"mag":282,"mdef":257,"hit":150,"eva":10,"cri":15,"gold":81600,"exp":90000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":406,"rate":15,"condition":0},{"id":415,"rate":10,"condition":0},{"id":307,"rate":10,"condition":1},{"id":921,"rate":20,"condition":0},{"id":922,"rate":15,"condition":2},{"id":606,"rate":15,"condition":2},{"id":905,"rate":10,"condition":0},{"id":57,"rate":5,"condition":0},{"id":90,"rate":5,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"水":100,"闇":100},"resists":{"Poison":70,"Shock":70,"Fear":100,"Seal":100,"Debuff":0,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401130,"name":"戦神ヴァルキュリア","race":"精霊","rank":130,"minF":130,"hp":3765,"mp":791,"atk":274,"def":248,"spd":148,"mag":266,"mdef":257,"hit":150,"eva":10,"cri":15,"gold":100000,"exp":100000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":610,"rate":13,"condition":0},{"id":410,"rate":13,"condition":0},{"id":402,"rate":13,"condition":0},{"id":404,"rate":13,"condition":1},{"id":416,"rate":12,"condition":2},{"id":413,"rate":12,"condition":2},{"id":56,"rate":12,"condition":3},{"id":63,"rate":12,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"風":100,"光":100,"混沌":100},"resists":{"Poison":70,"Shock":70,"Fear":100,"Seal":100,"Debuff":0,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401140,"name":"ヴェルファイア","race":"竜","rank":140,"minF":140,"hp":4269,"mp":791,"atk":297,"def":257,"spd":156,"mag":297,"mdef":282,"hit":150,"eva":10,"cri":15,"gold":141600,"exp":216000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":3,"rate":15,"condition":0},{"id":614,"rate":10,"condition":1},{"id":612,"rate":10,"condition":1},{"id":613,"rate":10,"condition":1},{"id":610,"rate":10,"condition":0},{"id":611,"rate":10,"condition":0},{"id":413,"rate":5,"condition":2},{"id":107,"rate":15,"condition":2},{"id":615,"rate":5,"condition":2},{"id":56,"rate":10,"condition":3}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":40,"水":40,"風":40,"雷":40,"光":40,"闇":40,"混沌":40},"resists":{"Poison":70,"Shock":70,"Fear":100,"Seal":100,"Debuff":0,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401150,"name":"シーリス・アビス","race":"魔族","rank":150,"minF":150,"hp":3118,"mp":791,"atk":289,"def":230,"spd":133,"mag":248,"mdef":257,"hit":150,"eva":10,"cri":15,"gold":66666,"exp":66666,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":42,"rate":17,"condition":1},{"id":406,"rate":17,"condition":0},{"id":606,"rate":17,"condition":0},{"id":203,"rate":17,"condition":0},{"id":105,"rate":16,"condition":0},{"id":58,"rate":16,"condition":0}],"drops":{"normal":{"id":100,"rate":5},"rare":{"id":106,"rate":1}},"elmRes":{"火":0,"水":50,"光":0,"雷":-40},"resists":{"Poison":80,"Shock":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401151,"name":"エリシア・アビス","race":"魔族","rank":150,"minF":150,"hp":3019,"mp":791,"atk":282,"def":220,"spd":163,"mag":257,"mdef":257,"hit":150,"eva":10,"cri":15,"gold":66666,"exp":66666,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":609,"rate":17,"condition":1},{"id":605,"rate":17,"condition":1},{"id":611,"rate":17,"condition":2},{"id":109,"rate":17,"condition":2},{"id":613,"rate":16,"condition":2},{"id":56,"rate":16,"condition":3}],"drops":{"normal":{"id":101,"rate":5},"rare":{"id":106,"rate":1}},"elmRes":{"火":25,"風":25,"光":25,"水":-10,"闇":-20},"resists":{"Poison":80,"Shock":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401152,"name":"グラド・アビス","race":"魔族","rank":150,"minF":150,"hp":3427,"mp":791,"atk":248,"def":239,"spd":124,"mag":282,"mdef":297,"hit":150,"eva":10,"cri":15,"gold":66666,"exp":66666,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":407,"rate":15,"condition":1},{"id":412,"rate":15,"condition":0},{"id":413,"rate":14,"condition":2},{"id":609,"rate":14,"condition":0},{"id":907,"rate":14,"condition":2},{"id":905,"rate":14,"condition":3},{"id":404,"rate":14,"condition":0}],"drops":{"normal":{"id":103,"rate":5},"rare":{"id":106,"rate":1}},"elmRes":{"闇":20,"雷":-10,"混沌":40,"光":-10},"resists":{"Poison":80,"Shock":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401153,"name":"レナード・アビス","race":"魔族","rank":150,"minF":150,"hp":3245,"mp":791,"atk":311,"def":257,"spd":148,"mag":199,"mdef":230,"hit":150,"eva":20,"cri":15,"gold":66666,"exp":66666,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":41,"rate":35,"condition":0},{"id":119,"rate":20,"condition":2},{"id":405,"rate":20,"condition":0},{"id":414,"rate":20,"condition":2},{"id":57,"rate":5,"condition":0}],"drops":{"normal":{"id":102,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"雷":-10,"光":-10,"闇":20,"混沌":20,"風":50},"resists":{"Poison":80,"Shock":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401160,"name":"常闇のゼルドラス","race":"魔族","rank":160,"minF":160,"hp":3628,"mp":791,"atk":345,"def":274,"spd":163,"mag":148,"mdef":274,"hit":150,"eva":20,"cri":15,"gold":66666,"exp":66666,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":119,"rate":15,"condition":0},{"id":113,"rate":25,"condition":1},{"id":411,"rate":20,"condition":2},{"id":55,"rate":10,"condition":2},{"id":31,"rate":10,"condition":0},{"id":202,"rate":20,"condition":0}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"Poison":70,"Shock":70,"InstantDeath":95,"Fear":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401161,"name":"深淵の騎士ヴェルド","race":"魔族","rank":160,"minF":160,"hp":3974,"mp":297,"atk":297,"def":297,"spd":148,"mag":332,"mdef":332,"hit":100,"eva":0,"cri":50,"gold":140000,"exp":180000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":500,"rate":5,"condition":2},{"id":612,"rate":15,"condition":0},{"id":613,"rate":15,"condition":0},{"id":610,"rate":15,"condition":0},{"id":611,"rate":15,"condition":0},{"id":908,"rate":10,"condition":2},{"id":907,"rate":5,"condition":2},{"id":81,"rate":10,"condition":2},{"id":57,"rate":5,"condition":0},{"id":90,"rate":5,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":20,"水":20,"風":20,"雷":20,"光":20,"闇":20,"混沌":20},"resists":{"Poison":80,"Shock":80,"Fear":100,"Seal":100,"Debuff":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401162,"name":"風詠のエルメナス","race":"魔族","rank":160,"minF":160,"hp":3245,"mp":791,"atk":297,"def":257,"spd":133,"mag":345,"mdef":257,"hit":150,"eva":20,"cri":15,"gold":66666,"exp":66666,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":407,"rate":13,"condition":1},{"id":406,"rate":13,"condition":0},{"id":412,"rate":14,"condition":0},{"id":922,"rate":15,"condition":2},{"id":24,"rate":15,"condition":2},{"id":403,"rate":10,"condition":2},{"id":56,"rate":20,"condition":3}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"Poison":70,"Shock":70,"InstantDeath":95,"Seal":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401170,"name":"深淵竜ヴェルファイア","race":"竜","rank":170,"minF":170,"hp":5511,"mp":791,"atk":364,"def":332,"spd":176,"mag":364,"mdef":364,"hit":150,"eva":20,"cri":15,"gold":141600,"exp":100000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":3,"rate":9,"condition":0},{"id":907,"rate":9,"condition":0},{"id":80,"rate":9,"condition":2},{"id":614,"rate":9,"condition":1},{"id":612,"rate":8,"condition":1},{"id":613,"rate":8,"condition":1},{"id":610,"rate":8,"condition":0},{"id":611,"rate":8,"condition":0},{"id":413,"rate":8,"condition":2},{"id":107,"rate":8,"condition":0},{"id":615,"rate":8,"condition":2},{"id":56,"rate":8,"condition":3}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":60,"水":60,"風":60,"雷":60,"光":60,"闇":60,"混沌":60},"resists":{"Poison":90,"Shock":90,"Fear":100,"Seal":100,"Debuff":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401180,"name":"アビスヴァイン","race":"魔族","rank":180,"minF":180,"hp":6364,"mp":791,"atk":409,"def":351,"spd":188,"mag":297,"mdef":297,"hit":150,"eva":20,"cri":15,"gold":74160,"exp":141000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":119,"rate":15,"condition":2},{"id":414,"rate":15,"condition":0},{"id":401,"rate":20,"condition":0},{"id":409,"rate":15,"condition":2},{"id":907,"rate":15,"condition":2},{"id":57,"rate":5,"condition":0},{"id":108,"rate":10,"condition":1},{"id":420,"rate":5,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":100,"水":100,"風":100,"雷":100},"resists":{"Poison":90,"Shock":90,"Fear":100,"Seal":100,"Debuff":75,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401190,"name":"混沌竜ヴェルファイア","race":"竜","rank":190,"minF":190,"hp":7794,"mp":791,"atk":445,"def":393,"spd":210,"mag":393,"mdef":393,"hit":150,"eva":20,"cri":15,"gold":200000,"exp":200000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":3,"rate":10,"condition":0},{"id":80,"rate":10,"condition":2},{"id":907,"rate":10,"condition":0},{"id":614,"rate":5,"condition":1},{"id":612,"rate":5,"condition":1},{"id":613,"rate":5,"condition":1},{"id":610,"rate":10,"condition":0},{"id":611,"rate":10,"condition":0},{"id":107,"rate":10,"condition":0},{"id":413,"rate":10,"condition":2},{"id":615,"rate":10,"condition":2},{"id":906,"rate":5,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":80,"水":80,"風":80,"雷":80,"光":80,"闇":80,"混沌":80},"resists":{"Poison":90,"Shock":90,"Fear":100,"Seal":100,"Debuff":90,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401200,"name":"混沌竜アビス","race":"竜","rank":200,"minF":200,"hp":9178,"mp":791,"atk":492,"def":445,"spd":230,"mag":492,"mdef":445,"hit":150,"eva":20,"cri":15,"gold":999999,"exp":999999,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":923,"rate":15,"condition":0},{"id":924,"rate":15,"condition":0},{"id":925,"rate":20,"condition":0},{"id":907,"rate":10,"condition":2},{"id":906,"rate":10,"condition":2},{"id":454,"rate":10,"condition":2},{"id":908,"rate":10,"condition":2},{"id":90,"rate":10,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":70,"水":70,"風":70,"光":70,"闇":70,"雷":30,"混沌":30},"resists":{"Poison":90,"Shock":90,"Fear":100,"Seal":100,"Debuff":90,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
];

const FIXED_SPECIAL_BOSSES = [
  {"id":902000,"name":"ギルガメッシュ","race":"魔族","rank":999,"minF":999,"hp":15000,"mp":2500,"atk":535,"def":470,"spd":257,"mag":514,"mdef":445,"hit":150,"eva":20,"cri":30,"gold":9999999,"exp":9999999,"actCount":3,"isBoss":true,"isRare":true,"isEstark":true,"isSpecialBoss":true,"acts":[{"id":920,"rate":15,"condition":0},{"id":420,"rate":15,"condition":0},{"id":907,"rate":10,"condition":0},{"id":426,"rate":10,"condition":2},{"id":427,"rate":10,"condition":2},{"id":616,"rate":10,"condition":2},{"id":908,"rate":10,"condition":2},{"id":90,"rate":10,"condition":2},{"id":616,"rate":10,"condition":2},{"id":908,"rate":10,"condition":10,"condition":2},{"id":56,"rate":20,"condition":3},{"id":57,"rate":20,"condition":3},{"id":413,"rate":30,"condition":3}],"drops":{"normal":{"id":106,"rate":50},"rare":{"id":107,"rate":10}},"elmRes":{"火":80,"水":80,"風":80,"光":80,"闇":80,"雷":80,"混沌":0},"resists":{"Poison":90,"Shock":90,"Fear":200,"Seal":200,"Debuff":90,"InstantDeath":200},"traits":[{"id":52,"level":5},{"id":19,"level":10},{"id":10,"level":10}],"archives":[]},
];

const FIXED_MONSTERS = [
  ...FIXED_RARE_MONSTERS,
  ...FIXED_BOSS_MONSTERS,
  ...FIXED_SPECIAL_BOSSES,
];

const NORMAL_MONSTER_BASES = MONSTER_BANDS_1_200.flatMap((band) => band.monsters);

const ALL_MONSTER_BASES = [
  ...NORMAL_MONSTER_BASES,
  ...FIXED_MONSTERS,
];

// 旧 monsters 相当。互換用に通常雑魚ベース、レア、ボス、特殊ボスをすべて含める。
const monsters = ALL_MONSTER_BASES;

function cloneMonsterData(monster) {
  const clone = JSON.parse(JSON.stringify(monster));
  if (clone.isSpecialBoss === undefined) clone.isSpecialBoss = false;
  return clone;
}

function getFloorOffset(floor, band) {
  const index = Math.max(0, Math.min(4, floor - band.bandStart));

  if (band.offsetType === 'low_1_5') {
    return LOW_FLOOR_OFFSETS[1][index];
  }

  if (band.offsetType === 'low_6_10') {
    return LOW_FLOOR_OFFSETS[6][index];
  }

  return STANDARD_FLOOR_OFFSETS[index];
}

function getReferenceBossStatsForFloor(floor) {
  const floorNo = Math.max(1, Number(floor) || 1);
  const bossFloor = Math.max(10, Math.min(200, Math.ceil(floorNo / 10) * 10));
  const bosses = FIXED_BOSS_MONSTERS.filter((monster) =>
    monster.isBoss &&
    !monster.isRare &&
    !monster.isEstark &&
    !monster.isSpecialBoss &&
    monster.minF === bossFloor
  );

  if (bosses.length === 0) {
    return null;
  }

  const hpSum = bosses.reduce((sum, boss) => sum + (Number(boss.hp) || 0), 0);
  const powerSum = bosses.reduce((sum, boss) =>
    sum + Math.max(Number(boss.atk) || 0, Number(boss.mag) || 0), 0);

  if (bosses.length === 1) {
    return { floor: bossFloor, hp: hpSum, power: powerSum };
  }

  const divisor = bosses.length / 1.5;
  return { floor: bossFloor, hp: hpSum / divisor, power: powerSum / divisor };
}

function getMonsterHpLimitForFloor(monster, floor) {
  const reference = getReferenceBossStatsForFloor(floor);
  if (!reference) {
    return null;
  }

  const ratio = monster.isElite ? 0.30 : 0.20;
  return Math.max(1, Math.floor(reference.hp * ratio));
}

function applyFloorOffset(baseMonster, floor, band) {
  const offset = getFloorOffset(floor, band);
  const monster = cloneMonsterData(baseMonster);

  monster.hp = Math.floor(monster.hp * offset.hpMp);
  monster.mp = Math.floor(monster.mp * offset.hpMp);
  monster.atk = Math.floor(monster.atk * offset.other);
  monster.def = Math.floor(monster.def * offset.other);
  monster.spd = Math.floor(monster.spd * offset.other);
  monster.mag = Math.floor(monster.mag * offset.other);
  monster.mdef = Math.floor(monster.mdef * offset.other);
  monster.gold = Math.floor(monster.gold * offset.reward);
  monster.exp = Math.floor(monster.exp * offset.reward);

  const hpLimit = getMonsterHpLimitForFloor(monster, floor);
  if (hpLimit !== null) {
    monster.hp = Math.min(monster.hp, hpLimit);
  }

  monster.baseId = baseMonster.id;
  monster.generatedFloor = floor;
  monster.isBandMonster = true;

  return monster;
}

function getMonsterBandForFloor(floor) {
  return MONSTER_BANDS_1_200.find((band) => floor >= band.bandStart && floor <= band.bandEnd) || null;
}

function generateBandMonster(floor) {
  const band = getMonsterBandForFloor(floor);

  if (!band || !band.monsters || band.monsters.length === 0) {
    return null;
  }

  const base = band.monsters[Math.floor(Math.random() * band.monsters.length)];
  return applyFloorOffset(base, floor, band);
}

function getBossesForFloor(floor) {
  return FIXED_BOSS_MONSTERS
    .filter((monster) => monster.isBoss && !monster.isRare && !monster.isEstark && !monster.isSpecialBoss && monster.minF === floor)
    .map(cloneMonsterData);
}

function getSpecialBossesForFloor(floor) {
  return FIXED_SPECIAL_BOSSES
    .filter((monster) => monster.isBoss && (monster.isSpecialBoss || monster.isEstark) && monster.minF === floor)
    .map(cloneMonsterData);
}

function getBossesByIds(ids) {
  const idList = Array.isArray(ids) ? ids : [ids];

  return idList
    .map((id) => ALL_MONSTER_BASES.find((monster) => monster.id === id))
    .filter(Boolean)
    .map(cloneMonsterData);
}

function getRareCandidatesForFloor(floor) {
  const unlocked = FIXED_RARE_MONSTERS
    .filter((monster) => monster.isRare && !monster.isBoss && !monster.isEstark && !monster.isSpecialBoss && floor >= monster.minF)
    .sort((a, b) => b.minF - a.minF);

  // 同一階層で複数のメタル系を混ぜるより、最新解禁の1体だけを候補にする。
  return unlocked.length > 0 ? [unlocked[0]] : [];
}

function getRareEncounterRate(floor) {
  if (floor >= 101) return 0.03;
  if (floor >= 50) return 0.025;
  if (floor >= 20) return 0.02;
  if (floor >= 5) return 0.015;
  return 0;
}

function tryGenerateRareMonster(floor) {
  const candidates = getRareCandidatesForFloor(floor);

  if (candidates.length === 0) {
    return null;
  }

  if (Math.random() >= getRareEncounterRate(floor)) {
    return null;
  }

  return cloneMonsterData(candidates[Math.floor(Math.random() * candidates.length)]);
}

function getMonsterById(id) {
  return ALL_MONSTER_BASES.find((monster) => monster.id === id) || null;
}

function getDeepFloorNormalBaseCandidates() {
  return NORMAL_MONSTER_BASES.filter((monster) => !monster.isBoss && !monster.isRare && !monster.isEstark && !monster.isSpecialBoss);
}

function generateEnemyForFloor(floor, options = {}) {
  const { allowRare = true } = options;

  if (allowRare) {
    const rare = tryGenerateRareMonster(floor);
    if (rare) return rare;
  }

  if (floor >= 1 && floor <= 200) {
    return generateBandMonster(floor);
  }

  return null;
}

// database.js など既存コード向けの互換公開。
window.MONSTERS_DATA = monsters;

// 新しいモンスター生成API。
window.MonsterData = {
  races: MONSTER_RACES,
  balanceRule: BALANCE_RULE,
  lowFloorOffsets: LOW_FLOOR_OFFSETS,
  standardFloorOffsets: STANDARD_FLOOR_OFFSETS,

  bands: MONSTER_BANDS_1_200,
  normalBases: NORMAL_MONSTER_BASES,
  rareMonsters: FIXED_RARE_MONSTERS,
  bossMonsters: FIXED_BOSS_MONSTERS,
  specialBosses: FIXED_SPECIAL_BOSSES,
  fixedMonsters: FIXED_MONSTERS,
  allBases: ALL_MONSTER_BASES,

  cloneMonsterData,
  getFloorOffset,
  applyFloorOffset,
  getMonsterBandForFloor,
  generateBandMonster,
  getBossesForFloor,
  getSpecialBossesForFloor,
  getBossesByIds,
  getRareCandidatesForFloor,
  getRareEncounterRate,
  tryGenerateRareMonster,
  getMonsterById,
  getDeepFloorNormalBaseCandidates,
  generateEnemyForFloor,
};
