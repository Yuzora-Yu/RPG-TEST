const MONSTER_RACES = {
  antiDemon: ['死霊', '魔族'],        // 悪魔ばらい
  antiBeast: ['獣', '獣人'],          // 獣狩り
  antiMachine: ['機械', '無生物'],    // メカニック
  antiDragon: ['竜', '竜人'],         // 竜殺し

  // 現状、特攻対象外。将来追加してもよい。
  noKillerCurrently: ['粘体', '精霊', '植物'],
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
    m({id:100001,name:'ジェリー',race:'粘体',rank:1,minF:1,hp:140,mp:0,atk:70,def:45,spd:55,mag:18,mdef:5,gold:14,exp:14,actCount:1,acts:[act(1,70),act(10,15),act(2,15)],elmRes:{火:-30,雷:-20}}),
    m({id:100002,name:'やみこうもり',race:'獣',rank:1,minF:1,hp:120,mp:30,atk:65,def:38,spd:70,mag:30,mdef:5,gold:18,exp:16,actCount:1,acts:[act(1,70),act(14,20),act(61,10)],elmRes:{光:-30,雷:-20}}),
    m({id:100003,name:'ウィスプ',race:'精霊',rank:1,minF:1,hp:95,mp:45,atk:25,def:32,spd:62,mag:42,mdef:12,gold:18,exp:16,actCount:1,acts:[act(1,65),act(12,20),act(60,15)],elmRes:{火:-20,闇:-20}}),
    m({id:100004,name:'ヒールジェリー',race:'粘体',rank:1,minF:1,hp:170,mp:80,atk:25,def:55,spd:25,mag:40,mdef:12,gold:28,exp:24,actCount:1,acts:[act(1,60),act(20,25),act(2,15)],elmRes:{雷:-30,火:-20}}),
  ]},

  { bandStart: 6, bandEnd: 10, offsetType: 'low_6_10', monsters: [
    m({id:100005,name:'ホーンラビット',race:'獣',rank:6,minF:6,hp:900,mp:40,atk:230,def:120,spd:330,mag:12,mdef:60,gold:34,exp:38,actCount:1,acts:[act(1,70),act(41,15),act(49,15)],elmRes:{火:-20,闇:-10}}),
    m({id:100006,name:'ポイズンジェリー',race:'粘体',rank:6,minF:6,hp:1100,mp:120,atk:200,def:160,spd:160,mag:25,mdef:90,gold:40,exp:45,actCount:1,acts:[act(1,65),act(250,20),act(701,15)],elmRes:{火:-30,雷:-20},resists:{Poison:30}}),
    m({id:100007,name:'火の小精',race:'精霊',rank:6,minF:6,hp:650,mp:250,atk:45,def:95,spd:260,mag:80,mdef:90,gold:40,exp:45,actCount:1,acts:[act(1,65),act(10,20),act(15,15)],elmRes:{水:-40,闇:-20}}),
    m({id:100008,name:'さまよう鎧',race:'無生物',rank:6,minF:6,hp:1200,mp:0,atk:280,def:260,spd:70,mag:12,mdef:100,gold:55,exp:55,actCount:1,acts:[act(1,70),act(44,20),act(2,10)],elmRes:{雷:-30,水:-10},resists:{Poison:30}}),
    m({id:100009,name:'錆びた鎧兵',race:'無生物',rank:6,minF:6,hp:1800,mp:0,atk:180,def:300,spd:90,mag:8,mdef:130,gold:90,exp:85,actCount:2,isElite:true,acts:[act(1,60),act(44,25),act(51,15)],drops:{normal:{id:2,rate:5},rare:{id:105,rate:1}},elmRes:{雷:-30,水:-20},resists:{Poison:40}}),
  ]},

  { bandStart: 11, bandEnd: 15, monsters: [
    m({id:100010,name:'マッドゴーレム',race:'無生物',rank:11,minF:11,hp:1800,mp:0,atk:430,def:260,spd:60,mag:40,mdef:100,gold:117,exp:102,actCount:1,acts:[act(1,70),act(101,15),act(60,15)],elmRes:{水:-20,雷:-30},resists:{Poison:30}}),
    m({id:100011,name:'ブラックバット',race:'獣',rank:11,minF:11,hp:1000,mp:120,atk:240,def:75,spd:350,mag:330,mdef:50,gold:117,exp:102,actCount:1,acts:[act(1,70),act(14,20),act(703,10)],elmRes:{光:-30,雷:-20}}),
    m({id:100012,name:'アクアスライム',race:'粘体',rank:11,minF:11,hp:1500,mp:180,atk:240,def:150,spd:170,mag:360,mdef:150,gold:117,exp:102,actCount:1,acts:[act(1,65),act(11,20),act(12,15)],elmRes:{雷:-30,火:-10}}),
    m({id:100013,name:'グラスウルフ',race:'獣',rank:11,minF:11,hp:1600,mp:0,atk:500,def:110,spd:350,mag:40,mdef:50,gold:117,exp:102,actCount:1,acts:[act(1,70),act(41,20),act(60,10)],elmRes:{火:-20,光:-10}}),
  ]},

  { bandStart: 16, bandEnd: 20, monsters: [
    m({id:100014,name:'いたずらデビル',race:'魔族',rank:16,minF:16,hp:1900,mp:260,atk:360,def:120,spd:280,mag:520,mdef:180,gold:148,exp:136,actCount:1,acts:[act(1,65),act(14,20),act(60,15)],elmRes:{光:-30,雷:-10}}),
    m({id:100015,name:'ブロンズナイト',race:'無生物',rank:16,minF:16,hp:2100,mp:0,atk:510,def:270,spd:90,mag:55,mdef:200,gold:148,exp:136,actCount:1,acts:[act(1,65),act(40,15),act(44,15),act(2,5)],elmRes:{雷:-30,水:-20},resists:{Poison:40}}),
    m({id:100016,name:'ゴースト',race:'死霊',rank:16,minF:16,hp:1400,mp:260,atk:80,def:70,spd:280,mag:520,mdef:240,gold:148,exp:136,actCount:1,acts:[act(1,60),act(10,15),act(14,20),act(61,5)],elmRes:{光:-40,火:-10},resists:{Poison:30}}),
    m({id:100017,name:'いやしの芽',race:'植物',rank:16,minF:16,hp:1800,mp:340,atk:80,def:130,spd:90,mag:500,mdef:200,gold:148,exp:136,actCount:1,acts:[act(1,55),act(20,25),act(51,10),act(701,10)],elmRes:{火:-40,闇:-20},resists:{Poison:30}}),
    m({id:100018,name:'ブロンズリーダー',race:'無生物',rank:16,minF:16,hp:3100,mp:0,atk:330,def:300,spd:110,mag:30,mdef:260,gold:244,exp:224,actCount:2,isElite:true,acts:[act(1,55),act(44,20),act(101,15),act(51,10)],drops:{normal:{id:3,rate:5},rare:{id:102,rate:1}},elmRes:{雷:-30,水:-20},resists:{Poison:50}}),
  ]},

  { bandStart: 21, bandEnd: 25, monsters: [
    m({id:100019,name:'サンドリザード',race:'竜',rank:21,minF:21,hp:2700,mp:0,atk:720,def:300,spd:220,mag:60,mdef:120,gold:298,exp:272,actCount:1,acts:[act(1,65),act(43,15),act(601,20)],elmRes:{水:-30,雷:-20},resists:{Poison:20}}),
    m({id:100020,name:'ヘルラビット',race:'獣',rank:21,minF:21,hp:2200,mp:0,atk:680,def:130,spd:560,mag:60,mdef:50,gold:298,exp:272,actCount:1,acts:[act(1,65),act(41,20),act(49,15)],elmRes:{火:-20,闇:-10}}),
    m({id:100021,name:'呪いの霊魂',race:'死霊',rank:21,minF:21,hp:1800,mp:340,atk:90,def:130,spd:560,mag:620,mdef:240,gold:298,exp:272,actCount:1,acts:[act(1,60),act(14,20),act(61,10),act(703,10)],elmRes:{光:-40,雷:-20},resists:{Poison:30}}),
    m({id:100022,name:'マンドラゴラ',race:'植物',rank:21,minF:21,hp:2300,mp:340,atk:260,def:220,spd:180,mag:600,mdef:160,gold:298,exp:272,actCount:1,acts:[act(1,60),act(701,15),act(60,15),act(20,10)],elmRes:{火:-30,風:-20},resists:{Poison:40}}),
  ]},

  { bandStart: 26, bandEnd: 30, monsters: [
    m({id:100023,name:'アーミーウルフ',race:'獣',rank:26,minF:26,hp:3000,mp:0,atk:850,def:260,spd:700,mag:80,mdef:60,gold:209,exp:197,actCount:1,acts:[act(1,65),act(41,20),act(101,15)],elmRes:{火:-20,光:-10}}),
    m({id:100024,name:'アイアンジェリー',race:'粘体',rank:26,minF:26,hp:3300,mp:100,atk:600,def:420,spd:180,mag:80,mdef:260,gold:209,exp:197,actCount:1,acts:[act(1,65),act(44,15),act(2,20)],elmRes:{雷:-30,火:-20},resists:{Poison:40}}),
    m({id:100025,name:'フレイムスプライト',race:'精霊',rank:26,minF:26,hp:2300,mp:520,atk:120,def:150,spd:520,mag:720,mdef:220,gold:209,exp:197,actCount:1,acts:[act(1,60),act(10,20),act(15,20)],elmRes:{水:-50,闇:-20}}),
    m({id:100026,name:'ヒールスポア',race:'植物',rank:26,minF:26,hp:2600,mp:650,atk:120,def:210,spd:180,mag:650,mdef:260,gold:209,exp:197,actCount:1,acts:[act(1,55),act(20,25),act(701,10),act(51,10)],elmRes:{火:-40,風:-20},resists:{Poison:40}}),
    m({id:100027,name:'群狼隊長',race:'獣',rank:26,minF:26,hp:4800,mp:0,atk:560,def:360,spd:780,mag:45,mdef:120,gold:345,exp:325,actCount:2,isElite:true,acts:[act(1,55),act(41,20),act(101,15),act(703,10)],drops:{normal:{id:5,rate:2},rare:{id:104,rate:1}},elmRes:{火:-20,光:-20}}),
  ]},

  { bandStart: 31, bandEnd: 35, monsters: [
    m({id:100028,name:'キラーバット',race:'獣',rank:31,minF:31,hp:3800,mp:220,atk:850,def:260,spd:650,mag:450,mdef:130,gold:246,exp:210,actCount:1,acts:[act(1,60),act(46,20),act(14,15),act(703,5)],elmRes:{光:-30,雷:-20}}),
    m({id:100029,name:'ルーンジェリー',race:'粘体',rank:31,minF:31,hp:5000,mp:720,atk:460,def:520,spd:300,mag:1000,mdef:520,gold:246,exp:210,actCount:1,acts:[act(1,60),act(10,15),act(11,15),act(16,10)],elmRes:{雷:-30,闇:-10}}),
    m({id:100030,name:'ブリーズリザード',race:'竜',rank:31,minF:31,hp:4500,mp:0,atk:1150,def:500,spd:650,mag:100,mdef:300,gold:246,exp:210,actCount:1,acts:[act(1,60),act(43,15),act(46,15),act(601,10)],elmRes:{雷:-30,水:-20},resists:{Poison:20}}),
    m({id:100031,name:'見習いメイジ',race:'魔族',rank:31,minF:31,hp:3300,mp:720,atk:130,def:260,spd:300,mag:1300,mdef:520,gold:246,exp:210,actCount:1,acts:[act(1,55),act(301,15),act(312,15),act(60,15)],elmRes:{光:-30,雷:-10}}),
  ]},

  { bandStart: 36, bandEnd: 40, monsters: [
    m({id:100032,name:'ファイアウィスプ',race:'精霊',rank:36,minF:36,hp:4000,mp:820,atk:160,def:260,spd:500,mag:1350,mdef:600,gold:327,exp:346,actCount:1,acts:[act(1,55),act(10,20),act(15,15),act(301,10)],elmRes:{水:-50,闇:-20}}),
    m({id:100033,name:'アクアウィスプ',race:'精霊',rank:36,minF:36,hp:4000,mp:820,atk:160,def:260,spd:500,mag:1350,mdef:600,gold:327,exp:346,actCount:1,acts:[act(1,55),act(11,20),act(12,10),act(303,15)],elmRes:{雷:-40,闇:-20}}),
    m({id:100034,name:'ライトウィスプ',race:'精霊',rank:36,minF:36,hp:4000,mp:820,atk:160,def:260,spd:500,mag:1350,mdef:600,gold:327,exp:346,actCount:1,acts:[act(1,55),act(16,20),act(13,15),act(60,10)],elmRes:{闇:-40,火:-10}}),
    m({id:100035,name:'ダークウィスプ',race:'精霊',rank:36,minF:36,hp:4000,mp:820,atk:160,def:260,spd:500,mag:1350,mdef:600,gold:327,exp:346,actCount:1,acts:[act(1,55),act(14,25),act(312,10),act(61,10)],elmRes:{光:-40,雷:-10}}),
    m({id:100036,name:'ウィスプナイト',race:'無生物',rank:36,minF:36,hp:7400,mp:0,atk:850,def:1250,spd:220,mag:90,mdef:650,gold:540,exp:571,actCount:2,isElite:true,acts:[act(1,55),act(44,20),act(102,15),act(51,10)],drops:{normal:{id:13,rate:3},rare:{id:105,rate:1}},elmRes:{雷:-30,水:-20},resists:{Poison:50}}),
  ]},

  { bandStart: 41, bandEnd: 45, monsters: [
    m({id:100037,name:'バンパイア',race:'死霊',rank:41,minF:41,hp:5200,mp:620,atk:1000,def:350,spd:720,mag:900,mdef:650,gold:587,exp:587,actCount:1,acts:[act(1,55),act(47,20),act(14,15),act(703,10)],elmRes:{光:-50,雷:-20},resists:{Poison:30}}),
    m({id:100038,name:'アーマーラビット',race:'獣',rank:41,minF:41,hp:6800,mp:0,atk:1300,def:1300,spd:550,mag:120,mdef:420,gold:587,exp:587,actCount:1,acts:[act(1,60),act(44,20),act(41,20)],elmRes:{火:-20,闇:-10}}),
    m({id:100039,name:'メイジゴースト',race:'死霊',rank:41,minF:41,hp:4400,mp:850,atk:150,def:350,spd:550,mag:1500,mdef:850,gold:587,exp:587,actCount:1,acts:[act(1,50),act(301,20),act(312,20),act(60,10)],elmRes:{光:-40,火:-10},resists:{Poison:40}}),
    m({id:100040,name:'アイアンウルフ',race:'獣',rank:41,minF:41,hp:6200,mp:0,atk:1700,def:750,spd:720,mag:120,mdef:180,gold:587,exp:587,actCount:1,acts:[act(1,55),act(41,20),act(101,15),act(46,10)],elmRes:{火:-20,光:-10}}),
  ]},

  { bandStart: 46, bandEnd: 50, monsters: [
    m({id:100041,name:'ダークソルジャー',race:'無生物',rank:46,minF:46,hp:8500,mp:0,atk:1800,def:1800,spd:420,mag:180,mdef:900,gold:776,exp:800,actCount:1,acts:[act(1,55),act(44,20),act(102,15),act(50,10)],elmRes:{光:-30,雷:-20},resists:{Poison:50}}),
    m({id:100042,name:'リペアジェリー',race:'粘体',rank:46,minF:46,hp:9000,mp:1400,atk:200,def:1100,spd:260,mag:1700,mdef:1200,gold:776,exp:800,actCount:1,acts:[act(1,50),act(20,25),act(21,10),act(51,15)],elmRes:{雷:-40,闇:-20},resists:{Poison:30}}),
    m({id:100043,name:'フレイムヴァイン',race:'植物',rank:46,minF:46,hp:7500,mp:900,atk:900,def:850,spd:420,mag:1450,mdef:900,gold:776,exp:800,actCount:1,acts:[act(1,55),act(301,15),act(601,20),act(701,10)],elmRes:{水:-50,風:-20},resists:{Poison:50}}),
    m({id:100044,name:'グレイブゴースト',race:'死霊',rank:46,minF:46,hp:5200,mp:1200,atk:200,def:420,spd:900,mag:1700,mdef:1200,gold:776,exp:800,actCount:1,acts:[act(1,50),act(312,20),act(14,15),act(703,15)],elmRes:{光:-50,火:-10},resists:{Poison:50}}),
    m({id:100045,name:'ダークナイト',race:'無生物',rank:46,minF:46,hp:10500,mp:200,atk:1150,def:2100,spd:550,mag:600,mdef:1300,gold:1280,exp:1320,actCount:2,isElite:true,acts:[act(1,45),act(102,20),act(44,15),act(50,10),act(103,10)],drops:{normal:{id:14,rate:1},rare:{id:106,rate:0.5}},elmRes:{光:-30,雷:-20},resists:{Poison:60,Shock:20}}),
  ]},
  
    { bandStart: 51, bandEnd: 55, monsters: [
    m({id:100046,name:'機械兵士',race:'機械',rank:51,minF:51,hp:11000,mp:0,atk:2100,def:2300,spd:700,mag:80,mdef:1200,gold:950,exp:1000,actCount:1,acts:[act(1,45),act(44,15),act(102,25),act(153,15)],elmRes:{闇:20,雷:-30,水:-10},resists:{Poison:60,Shock:20}}),
    m({id:100047,name:'ブラッドウルフ',race:'獣',rank:51,minF:51,hp:8500,mp:0,atk:2500,def:950,spd:1600,mag:80,mdef:250,gold:950,exp:1000,actCount:1,acts:[act(1,45),act(41,15),act(108,20),act(47,20)],elmRes:{風:10,火:-20,光:-20}}),
    m({id:100048,name:'小悪魔メイジ',race:'魔族',rank:51,minF:51,hp:8000,mp:2200,atk:650,def:850,spd:1350,mag:3000,mdef:1500,gold:950,exp:1000,actCount:1,acts:[act(1,45),act(301,15),act(302,20),act(312,20)],elmRes:{闇:20,光:-30},resists:{Seal:20}}),
    m({id:100049,name:'ストーンジェリー',race:'粘体',rank:51,minF:51,hp:12000,mp:500,atk:1800,def:1800,spd:430,mag:600,mdef:900,gold:950,exp:1000,actCount:1,acts:[act(1,45),act(44,15),act(150,20),act(60,20)],elmRes:{火:10,雷:-30},resists:{Poison:50}}),
  ]},

  { bandStart: 56, bandEnd: 60, monsters: [
    m({id:100050,name:'キラーナイト',race:'無生物',rank:56,minF:56,hp:12000,mp:0,atk:2800,def:2600,spd:900,mag:100,mdef:1300,gold:1150,exp:1200,actCount:1,acts:[act(1,45),act(101,15),act(102,25),act(44,15)],elmRes:{闇:20,雷:-30,光:-10},resists:{Poison:60}}),
    m({id:100051,name:'キラーラビット',race:'獣',rank:56,minF:56,hp:9500,mp:0,atk:2500,def:900,spd:1900,mag:100,mdef:300,gold:1150,exp:1200,actCount:1,acts:[act(1,45),act(41,15),act(108,20),act(201,20)],elmRes:{風:10,火:-20}}),
    m({id:100052,name:'かえんりゅう',race:'竜',rank:56,minF:56,hp:12000,mp:1600,atk:2200,def:1800,spd:900,mag:2800,mdef:1300,gold:1150,exp:1200,actCount:1,acts:[act(1,40),act(601,20),act(603,20),act(301,20)],elmRes:{火:30,水:-50},resists:{Poison:50,Fear:20}}),
    m({id:100053,name:'ポイズンミスト',race:'死霊',rank:56,minF:56,hp:8500,mp:1900,atk:180,def:600,spd:1900,mag:2800,mdef:1700,gold:1150,exp:1200,actCount:1,acts:[act(1,45),act(701,15),act(702,15),act(312,25)],elmRes:{闇:20,光:-40},resists:{Poison:80}}),
    m({id:100054,name:'かえんまりゅう',race:'竜',rank:56,minF:56,hp:18000,mp:2000,atk:1900,def:2300,spd:1200,mag:2200,mdef:1700,gold:1898,exp:1980,actCount:2,isElite:true,acts:[act(1,35),act(603,25),act(305,15),act(102,15),act(703,10)],drops:{normal:{id:13,rate:4},rare:{id:106,rate:0.5}},elmRes:{火:40,水:-50,雷:-10},resists:{Poison:60,Fear:30}}),
  ]},

  { bandStart: 61, bandEnd: 65, monsters: [
    m({id:100055,name:'スカウトデビル',race:'魔族',rank:61,minF:61,hp:12000,mp:2300,atk:2100,def:1000,spd:2100,mag:3000,mdef:1800,gold:1350,exp:1450,actCount:1,acts:[act(1,45),act(301,15),act(65,15),act(115,25)],elmRes:{闇:20,光:-30},resists:{Seal:20}}),
    m({id:100056,name:'アーマーリザード',race:'竜',rank:61,minF:61,hp:15000,mp:0,atk:2800,def:3000,spd:1100,mag:120,mdef:1500,gold:1350,exp:1450,actCount:1,acts:[act(1,45),act(43,15),act(102,20),act(153,20)],elmRes:{火:20,水:-30},resists:{Poison:40}}),
    m({id:100057,name:'サンダーバット',race:'獣',rank:61,minF:61,hp:10500,mp:1900,atk:1600,def:700,spd:2300,mag:3000,mdef:1800,gold:1350,exp:1450,actCount:1,acts:[act(1,45),act(43,15),act(251,20),act(13,20)],elmRes:{雷:30,風:-30,光:-20},resists:{Shock:50}}),
    m({id:100058,name:'ルーンアーマー',race:'無生物',rank:61,minF:61,hp:15000,mp:1900,atk:2700,def:3000,spd:600,mag:2600,mdef:1800,gold:1350,exp:1450,actCount:1,acts:[act(1,40),act(51,15),act(103,20),act(53,25)],elmRes:{光:20,雷:-30},resists:{Poison:60,Seal:20}}),
  ]},

  { bandStart: 66, bandEnd: 70, monsters: [
    m({id:100059,name:'アルリザード',race:'竜',rank:66,minF:66,hp:15500,mp:600,atk:3600,def:2800,spd:1500,mag:1000,mdef:1700,gold:1650,exp:1750,actCount:1,acts:[act(1,40),act(102,20),act(103,20),act(602,20)],elmRes:{水:20,雷:-30},resists:{Poison:50}}),
    m({id:100060,name:'ダークバトラー',race:'魔族',rank:66,minF:66,hp:15500,mp:2300,atk:3600,def:2800,spd:1300,mag:3000,mdef:1700,gold:1650,exp:1750,actCount:1,acts:[act(1,40),act(104,25),act(116,15),act(312,20)],elmRes:{闇:30,光:-40},resists:{Seal:30,Poison:40}}),
    m({id:100061,name:'シルフウルフ',race:'獣',rank:66,minF:66,hp:14000,mp:0,atk:3300,def:1100,spd:2500,mag:120,mdef:300,gold:1650,exp:1750,actCount:1,acts:[act(1,40),act(108,20),act(105,20),act(49,20)],elmRes:{風:20,火:-20}}),
    m({id:100062,name:'ヒールフェアリー',race:'精霊',rank:66,minF:66,hp:12000,mp:3000,atk:180,def:1100,spd:2500,mag:3200,mdef:2500,gold:1650,exp:1750,actCount:1,acts:[act(1,40),act(21,20),act(22,10),act(52,15),act(53,15)],elmRes:{光:20,闇:-30},resists:{Seal:30}}),
    m({id:100063,name:'ダークバトラー強',race:'魔族',rank:66,minF:66,hp:22500,mp:3000,atk:2500,def:3000,spd:1600,mag:2500,mdef:2200,gold:2723,exp:2888,actCount:2,isElite:true,acts:[act(1,35),act(104,25),act(116,15),act(305,15),act(57,10)],drops:{normal:{id:5,rate:3},rare:{id:102,rate:1}},elmRes:{闇:40,光:-40},resists:{Poison:50,Seal:40}}),
  ]},

  { bandStart: 71, bandEnd: 75, monsters: [
    m({id:100064,name:'小悪魔アクア',race:'魔族',rank:71,minF:71,hp:15500,mp:3200,atk:1200,def:1300,spd:2300,mag:3900,mdef:2500,gold:1950,exp:2100,actCount:1,acts:[act(1,40),act(303,20),act(311,20),act(60,20)],elmRes:{水:30,雷:-40,光:-20},resists:{Seal:30}}),
    m({id:100065,name:'小悪魔ライト',race:'魔族',rank:71,minF:71,hp:15500,mp:3200,atk:1200,def:1300,spd:2300,mag:3900,mdef:2500,gold:1950,exp:2100,actCount:1,acts:[act(1,40),act(16,15),act(308,20),act(306,25)],elmRes:{光:30,闇:-40},resists:{Seal:30}}),
    m({id:100066,name:'ジェリーキング',race:'粘体',rank:71,minF:71,hp:18500,mp:2500,atk:2700,def:3000,spd:700,mag:3000,mdef:2000,gold:1950,exp:2100,actCount:1,acts:[act(1,40),act(21,15),act(150,20),act(153,25)],elmRes:{火:20,雷:-30},resists:{Poison:60}}),
    m({id:100067,name:'バトルリザード改',race:'竜',rank:71,minF:71,hp:17500,mp:600,atk:4200,def:2300,spd:2300,mag:120,mdef:2000,gold:1950,exp:2100,actCount:1,acts:[act(1,40),act(102,20),act(154,20),act(603,20)],elmRes:{火:20,水:-30},resists:{Poison:50}}),
  ]},

  { bandStart: 76, bandEnd: 80, monsters: [
    m({id:100068,name:'魔人兵士',race:'魔族',rank:76,minF:76,hp:18000,mp:2400,atk:4500,def:3000,spd:1200,mag:2200,mdef:2200,gold:2350,exp:2550,actCount:1,acts:[act(1,35),act(112,20),act(102,25),act(50,20)],elmRes:{闇:30,光:-30},resists:{Poison:50,Seal:30}}),
    m({id:100069,name:'アークバット',race:'死霊',rank:76,minF:76,hp:14500,mp:3000,atk:2800,def:900,spd:3000,mag:4100,mdef:3000,gold:2350,exp:2550,actCount:1,acts:[act(1,35),act(47,20),act(312,20),act(704,25)],elmRes:{闇:30,光:-40},resists:{Poison:60,Seal:20}}),
    m({id:100070,name:'ブレイズナイト',race:'無生物',rank:76,minF:76,hp:18500,mp:800,atk:4600,def:3600,spd:1000,mag:1800,mdef:2200,gold:2350,exp:2550,actCount:1,acts:[act(1,35),act(40,15),act(156,20),act(603,20),act(51,10)],elmRes:{火:30,水:-40,雷:-20},resists:{Poison:70}}),
    m({id:100071,name:'アビススポア',race:'植物',rank:76,minF:76,hp:15000,mp:3600,atk:1500,def:1600,spd:1000,mag:4300,mdef:2600,gold:2350,exp:2550,actCount:1,acts:[act(1,35),act(702,20),act(304,20),act(21,25)],elmRes:{風:20,火:-40},resists:{Poison:80}}),
    m({id:100072,name:'魔人兵長',race:'魔族',rank:76,minF:76,hp:28000,mp:3000,atk:3500,def:3800,spd:1600,mag:2600,mdef:2800,gold:3878,exp:4208,actCount:2,isElite:true,acts:[act(1,30),act(112,20),act(113,10),act(102,20),act(50,20)],drops:{normal:{id:7,rate:1},rare:{id:106,rate:0.7}},elmRes:{闇:40,光:-30},resists:{Poison:60,Seal:40}}),
  ]},

  { bandStart: 81, bandEnd: 85, monsters: [
    m({id:100073,name:'アークバトラー',race:'魔族',rank:81,minF:81,hp:25000,mp:3200,atk:4300,def:3600,spd:2000,mag:3600,mdef:2600,gold:2800,exp:3050,actCount:1,acts:[act(1,35),act(104,20),act(154,20),act(305,25)],elmRes:{闇:30,光:-30},resists:{Poison:50,Seal:40}}),
    m({id:100074,name:'メタルリザード',race:'竜',rank:81,minF:81,hp:26000,mp:800,atk:3600,def:4300,spd:1600,mag:120,mdef:2600,gold:2800,exp:3050,actCount:1,acts:[act(1,35),act(45,15),act(153,25),act(51,25)],elmRes:{火:20,水:20,雷:-30},resists:{Poison:70}}),
    m({id:100075,name:'ソウルゴースト',race:'死霊',rank:81,minF:81,hp:18000,mp:4000,atk:150,def:900,spd:3200,mag:4200,mdef:3500,gold:2800,exp:3050,actCount:1,acts:[act(1,35),act(307,20),act(704,20),act(312,25)],elmRes:{闇:40,光:-50},resists:{Poison:70,Seal:30}}),
    m({id:100076,name:'キラーマシン試作',race:'機械',rank:81,minF:81,hp:26000,mp:0,atk:4500,def:4300,spd:2000,mag:120,mdef:2600,gold:2800,exp:3050,actCount:1,acts:[act(1,35),act(41,15),act(154,25),act(251,25)],elmRes:{闇:20,雷:-40},resists:{Poison:80,Shock:30}}),
  ]},

  { bandStart: 86, bandEnd: 90, monsters: [
    m({id:100077,name:'デビルロード',race:'魔族',rank:86,minF:86,hp:24000,mp:4200,atk:3000,def:2800,spd:2600,mag:4500,mdef:3400,gold:3350,exp:3650,actCount:1,acts:[act(1,35),act(305,20),act(307,20),act(905,5),act(60,20)],elmRes:{闇:40,光:-30},resists:{Poison:50,Seal:50}}),
    m({id:100078,name:'アビスウルフ',race:'獣',rank:86,minF:86,hp:24000,mp:0,atk:4600,def:2800,spd:3200,mag:120,mdef:450,gold:3350,exp:3650,actCount:1,acts:[act(1,35),act(108,25),act(201,20),act(703,20)],elmRes:{風:20,光:-20,火:-20}}),
    m({id:100079,name:'サンダーアーマー',race:'無生物',rank:86,minF:86,hp:26000,mp:1000,atk:4700,def:4600,spd:1800,mag:120,mdef:3000,gold:3350,exp:3650,actCount:1,acts:[act(1,35),act(43,15),act(251,25),act(158,25)],elmRes:{雷:40,風:-30},resists:{Poison:70,Shock:80}}),
    m({id:100080,name:'ホーリージェリー',race:'粘体',rank:86,minF:86,hp:27000,mp:4200,atk:1500,def:3200,spd:900,mag:4200,mdef:3400,gold:3350,exp:3650,actCount:1,acts:[act(1,35),act(306,20),act(21,20),act(53,25)],elmRes:{光:30,闇:-30,雷:-20},resists:{Poison:60,Seal:30}}),
    m({id:100081,name:'キラーマシン試作二号',race:'機械',rank:86,minF:86,hp:38000,mp:1000,atk:3100,def:5000,spd:2600,mag:120,mdef:3600,gold:5528,exp:6023,actCount:2,isElite:true,acts:[act(1,30),act(154,25),act(251,20),act(103,15),act(57,10)],drops:{normal:{id:14,rate:3},rare:{id:104,rate:1}},elmRes:{闇:30,雷:-40},resists:{Poison:90,Shock:40}}),
  ]},

  { bandStart: 91, bandEnd: 95, monsters: [
    m({id:100082,name:'カースメイジ',race:'魔族',rank:91,minF:91,hp:30000,mp:5000,atk:200,def:2200,spd:3000,mag:5000,mdef:4200,gold:4000,exp:4350,actCount:1,acts:[act(1,30),act(305,20),act(307,20),act(704,15),act(705,15)],elmRes:{闇:40,光:-40},resists:{Seal:60}}),
    m({id:100083,name:'ブラッドナイト',race:'死霊',rank:91,minF:91,hp:35000,mp:2600,atk:5000,def:5200,spd:2100,mag:3000,mdef:3300,gold:4000,exp:4350,actCount:1,acts:[act(1,30),act(47,20),act(104,25),act(116,25)],elmRes:{闇:40,光:-50},resists:{Poison:70}}),
    m({id:100084,name:'雷牙ウルフ',race:'獣',rank:91,minF:91,hp:32000,mp:0,atk:5200,def:2800,spd:3600,mag:120,mdef:500,gold:4000,exp:4350,actCount:1,acts:[act(1,30),act(251,25),act(108,25),act(201,20)],elmRes:{雷:30,風:-30},resists:{Shock:50}}),
    m({id:100085,name:'グレータージェリー',race:'粘体',rank:91,minF:91,hp:36000,mp:3500,atk:4300,def:4500,spd:1000,mag:3500,mdef:3300,gold:4000,exp:4350,actCount:1,acts:[act(1,30),act(153,25),act(21,15),act(53,15),act(64,15)],elmRes:{火:20,雷:-30},resists:{Poison:70}}),
  ]},

  { bandStart: 96, bandEnd: 100, monsters: [
    m({id:100086,name:'アークデビル',race:'魔族',rank:96,minF:96,hp:36000,mp:5600,atk:4300,def:4200,spd:3200,mag:5400,mdef:4500,gold:4800,exp:5200,actCount:1,acts:[act(1,30),act(305,20),act(307,20),act(306,20),act(65,10)],elmRes:{闇:40,光:-40},resists:{Seal:60}}),
    m({id:100087,name:'バトルマシーン',race:'機械',rank:96,minF:96,hp:36000,mp:0,atk:5400,def:6000,spd:2400,mag:120,mdef:3800,gold:4800,exp:5200,actCount:1,acts:[act(1,30),act(154,25),act(158,20),act(103,15),act(51,10)],elmRes:{闇:30,雷:-50},resists:{Poison:90,Shock:50}}),
    m({id:100088,name:'古竜の幼体',race:'竜',rank:96,minF:96,hp:36000,mp:4200,atk:5200,def:5000,spd:3000,mag:5000,mdef:4500,gold:4800,exp:5200,actCount:1,acts:[act(1,30),act(603,25),act(602,20),act(103,15),act(703,10)],elmRes:{火:30,水:30,雷:-20,光:-20},resists:{Poison:70,Fear:40}}),
    m({id:100089,name:'ダークプリースト',race:'魔族',rank:96,minF:96,hp:32000,mp:5600,atk:1800,def:3300,spd:3000,mag:5400,mdef:5000,gold:4800,exp:5200,actCount:1,acts:[act(1,30),act(307,20),act(21,15),act(22,10),act(704,25)],elmRes:{闇:40,光:-40},resists:{Seal:60}}),
    m({id:100090,name:'古竜の若君',race:'竜',rank:96,minF:96,hp:52000,mp:5600,atk:3500,def:6200,spd:3500,mag:3500,mdef:5200,gold:7920,exp:8580,actCount:2,isElite:true,acts:[act(1,25),act(603,25),act(602,20),act(103,15),act(251,10),act(57,5)],drops:{normal:{id:106,rate:1},rare:{id:107,rate:0.2}},elmRes:{火:40,水:40,雷:-20,光:-20},resists:{Poison:80,Fear:50}}),
  ]},

  { bandStart: 101, bandEnd: 105, monsters: [
    m({id:100091,name:'アビスジェリー',race:'粘体',rank:101,minF:101,hp:52000,mp:5200,atk:5200,def:5200,spd:1200,mag:5200,mdef:4600,gold:6000,exp:6500,actCount:1,acts:[act(1,25),act(153,20),act(306,20),act(405,20),act(53,15)],elmRes:{火:20,闇:20,雷:-30,光:-10},resists:{Poison:80,Seal:30}}),
    m({id:100092,name:'カースバット',race:'死霊',rank:101,minF:101,hp:36000,mp:6200,atk:3800,def:1600,spd:4200,mag:6200,mdef:5200,gold:6000,exp:6500,actCount:1,acts:[act(1,25),act(47,15),act(307,20),act(704,20),act(705,20)],elmRes:{闇:50,光:-40},resists:{Poison:80,Seal:50}}),
    m({id:100093,name:'デスマシーン',race:'機械',rank:101,minF:101,hp:56000,mp:0,atk:6200,def:6400,spd:2600,mag:120,mdef:4200,gold:6000,exp:6500,actCount:1,acts:[act(1,25),act(154,20),act(158,20),act(401,20),act(251,15)],elmRes:{闇:30,雷:20,水:-20},resists:{Poison:100,Shock:60}}),
    m({id:100094,name:'カオスリザード',race:'竜',rank:101,minF:101,hp:54000,mp:4200,atk:6200,def:5200,spd:3300,mag:5200,mdef:4600,gold:6000,exp:6500,actCount:1,acts:[act(1,25),act(103,15),act(603,20),act(604,20),act(405,20)],elmRes:{火:30,水:30,光:-20,雷:-20},resists:{Poison:80,Fear:40}}),
  ]},

  { bandStart: 106, bandEnd: 110, monsters: [
    m({id:100095,name:'アークデビル',race:'魔族',rank:106,minF:106,hp:52000,mp:7000,atk:5600,def:4600,spd:3600,mag:6800,mdef:5600,gold:7200,exp:7600,actCount:1,acts:[act(1,25),act(305,15),act(407,20),act(405,20),act(905,20)],elmRes:{火:20,闇:40,光:-30},resists:{Poison:70,Seal:70}}),
    m({id:100096,name:'エンゼルジェリー',race:'精霊',rank:106,minF:106,hp:56000,mp:7200,atk:150,def:4200,spd:1600,mag:6800,mdef:6200,gold:7200,exp:7600,actCount:1,acts:[act(1,25),act(306,20),act(410,20),act(22,15),act(53,20)],elmRes:{光:40,闇:-40,雷:-20},resists:{Poison:70,Seal:50}}),
    m({id:100097,name:'アビスウィスプ',race:'精霊',rank:106,minF:106,hp:36000,mp:7600,atk:150,def:1600,spd:4200,mag:7200,mdef:6500,gold:7200,exp:7600,actCount:1,acts:[act(1,25),act(307,20),act(423,20),act(405,20),act(61,15)],elmRes:{闇:40,混沌:20,光:-30},resists:{Poison:70,Seal:60}}),
    m({id:100098,name:'ダークウルフ',race:'獣',rank:106,minF:106,hp:46000,mp:0,atk:6500,def:2500,spd:4800,mag:120,mdef:500,gold:7200,exp:7600,actCount:1,acts:[act(1,25),act(108,20),act(205,20),act(211,25),act(703,10)],elmRes:{闇:20,風:20,光:-20,火:-20},resists:{Fear:30}}),
    m({id:100099,name:'アークデビル強',race:'魔族',rank:106,minF:106,hp:85000,mp:7600,atk:4500,def:5200,spd:4200,mag:4800,mdef:6500,gold:11880,exp:12540,actCount:2,isElite:true,acts:[act(1,20),act(407,20),act(405,20),act(103,15),act(905,15),act(57,10)],drops:{normal:{id:106,rate:1},rare:{id:107,rate:0.2}},elmRes:{火:30,闇:50,光:-30},resists:{Poison:80,Seal:80}}),
  ]},

  { bandStart: 111, bandEnd: 115, monsters: [
    m({id:100100,name:'アビスバトラー',race:'魔族',rank:111,minF:111,hp:60000,mp:5200,atk:7600,def:5800,spd:3600,mag:3600,mdef:5200,gold:8500,exp:9000,actCount:1,acts:[act(1,25),act(104,15),act(106,20),act(119,20),act(116,20)],elmRes:{闇:40,光:-30},resists:{Poison:70,Seal:50}}),
    m({id:100101,name:'カオスアーマー',race:'無生物',rank:111,minF:111,hp:76000,mp:1000,atk:7200,def:7600,spd:2300,mag:1800,mdef:5600,gold:8500,exp:9000,actCount:1,acts:[act(1,25),act(153,15),act(401,20),act(117,20),act(51,20)],elmRes:{闇:30,光:20,雷:-30},resists:{Poison:100,Shock:50}}),
    m({id:100102,name:'エビルゴースト',race:'死霊',rank:111,minF:111,hp:44000,mp:7600,atk:150,def:1600,spd:5200,mag:8500,mdef:7000,gold:8500,exp:9000,actCount:1,acts:[act(1,25),act(307,15),act(423,20),act(704,20),act(801,20)],elmRes:{闇:50,光:-50},resists:{Poison:90,InstantDeath:80,Seal:50}}),
    m({id:100103,name:'影縫いバット',race:'死霊',rank:111,minF:111,hp:40000,mp:5600,atk:4200,def:1600,spd:5600,mag:6200,mdef:5600,gold:8500,exp:9000,actCount:1,acts:[act(1,25),act(47,15),act(705,20),act(251,20),act(204,20)],elmRes:{闇:40,光:-40,雷:-20},resists:{Poison:80,Seal:60}}),
  ]},

  { bandStart: 116, bandEnd: 120, monsters: [
    m({id:100104,name:'レッドドラゴン',race:'竜',rank:116,minF:116,hp:76000,mp:5200,atk:7600,def:6000,spd:3300,mag:7200,mdef:6000,gold:10000,exp:10500,actCount:1,acts:[act(1,25),act(603,15),act(605,25),act(407,15),act(107,20)],elmRes:{火:50,水:-50},resists:{Poison:90,Fear:60}}),
    m({id:100105,name:'ブルードラゴン',race:'竜',rank:116,minF:116,hp:76000,mp:5200,atk:7600,def:6000,spd:3300,mag:7200,mdef:6000,gold:10000,exp:10500,actCount:1,acts:[act(1,25),act(602,15),act(604,25),act(406,15),act(107,20)],elmRes:{水:50,雷:-40},resists:{Poison:90,Fear:60}}),
    m({id:100106,name:'グリーンドラゴン',race:'竜',rank:116,minF:116,hp:76000,mp:5200,atk:7600,def:6000,spd:4000,mag:7200,mdef:6000,gold:10000,exp:10500,actCount:1,acts:[act(1,25),act(105,15),act(422,20),act(614,20),act(107,20)],elmRes:{風:50,火:-30},resists:{Poison:90,Fear:60}}),
    m({id:100107,name:'イエロードラゴン',race:'竜',rank:116,minF:116,hp:76000,mp:5200,atk:7600,def:6000,spd:4000,mag:7200,mdef:6000,gold:10000,exp:10500,actCount:1,acts:[act(1,25),act(251,15),act(408,20),act(608,20),act(107,20)],elmRes:{雷:50,闇:-30},resists:{Poison:90,Shock:80,Fear:60}}),
    m({id:100108,name:'カオスレッドドラゴン',race:'竜',rank:116,minF:116,hp:120000,mp:6500,atk:5800,def:7600,spd:4200,mag:6200,mdef:7000,gold:16500,exp:17325,actCount:2,isElite:true,acts:[act(1,20),act(605,25),act(407,20),act(107,20),act(615,15)],drops:{normal:{id:100,rate:2},rare:{id:106,rate:1}},elmRes:{火:60,水:-50,光:-10},resists:{Poison:100,Fear:80}}),
  ]},
  
    { bandStart: 121, bandEnd: 125, monsters: [
    m({id:100109,name:'アークデビル強',race:'魔族',rank:121,minF:121,hp:76000,mp:7600,atk:6500,def:5600,spd:4300,mag:7600,mdef:6500,gold:12000,exp:12500,actCount:1,acts:[act(1,20),act(407,20),act(423,20),act(405,20),act(905,20)],elmRes:{火:30,闇:50,光:-30},resists:{Poison:80,Seal:80}}),
    m({id:100110,name:'カオスリザード強',race:'竜',rank:121,minF:121,hp:80000,mp:5200,atk:7600,def:6200,spd:4300,mag:5200,mdef:6200,gold:12000,exp:12500,actCount:1,acts:[act(1,20),act(604,20),act(605,20),act(609,20),act(107,20)],elmRes:{火:40,水:40,闇:20,光:-20,雷:-20},resists:{Poison:90,Fear:60}}),
    m({id:100111,name:'エビルゴースト強',race:'死霊',rank:121,minF:121,hp:50000,mp:8200,atk:150,def:1800,spd:5200,mag:8500,mdef:7000,gold:12000,exp:12500,actCount:1,acts:[act(1,20),act(423,25),act(801,10),act(704,20),act(922,25)],elmRes:{闇:60,光:-50},resists:{Poison:100,InstantDeath:90,Seal:70}}),
    m({id:100112,name:'アビスバトラー強',race:'魔族',rank:121,minF:121,hp:70000,mp:4000,atk:8200,def:6000,spd:3600,mag:3000,mdef:5200,gold:12000,exp:12500,actCount:1,acts:[act(1,20),act(106,20),act(119,25),act(117,20),act(50,15)],elmRes:{闇:40,光:-30},resists:{Poison:80,Seal:60}}),
  ]},

  { bandStart: 126, bandEnd: 130, monsters: [
    m({id:100113,name:'アビスジェリー強',race:'粘体',rank:126,minF:126,hp:90000,mp:5600,atk:5600,def:6200,spd:1400,mag:5600,mdef:5600,gold:14000,exp:14500,actCount:1,acts:[act(1,20),act(153,15),act(405,20),act(410,20),act(53,25)],elmRes:{火:30,闇:30,雷:-30},resists:{Poison:90,Seal:50}}),
    m({id:100114,name:'アビスウィスプ強',race:'精霊',rank:126,minF:126,hp:52000,mp:8200,atk:150,def:1800,spd:5600,mag:8800,mdef:7600,gold:14000,exp:14500,actCount:1,acts:[act(1,20),act(423,20),act(408,20),act(410,20),act(905,20)],elmRes:{闇:40,光:20,混沌:-20},resists:{Poison:90,Seal:70}}),
    m({id:100115,name:'カースバット強',race:'死霊',rank:126,minF:126,hp:52000,mp:6000,atk:4500,def:1800,spd:5600,mag:6500,mdef:6000,gold:14000,exp:14500,actCount:1,acts:[act(1,20),act(204,20),act(704,20),act(705,20),act(801,20)],elmRes:{闇:50,光:-40},resists:{Poison:90,Seal:70}}),
    m({id:100116,name:'カオスアーマー強',race:'無生物',rank:126,minF:126,hp:95000,mp:1200,atk:8500,def:8500,spd:2600,mag:2200,mdef:6500,gold:14000,exp:14500,actCount:1,acts:[act(1,20),act(401,20),act(117,20),act(118,20),act(53,20)],elmRes:{闇:30,光:30,雷:-30},resists:{Poison:100,Shock:70}}),
    m({id:100117,name:'ウィスプロード',race:'精霊',rank:126,minF:126,hp:120000,mp:9000,atk:150,def:2400,spd:6500,mag:6000,mdef:8500,gold:23100,exp:23925,actCount:2,isElite:true,acts:[act(1,15),act(423,20),act(408,20),act(410,20),act(905,15),act(57,10)],drops:{normal:{id:106,rate:1.5},rare:{id:107,rate:0.25}},elmRes:{闇:50,光:30,雷:30,混沌:-20},resists:{Poison:100,Seal:90}}),
  ]},

  { bandStart: 131, bandEnd: 135, monsters: [
    m({id:100118,name:'深淵の魔導師',race:'魔族',rank:131,minF:131,hp:72000,mp:10000,atk:150,def:3500,spd:5000,mag:9800,mdef:8500,gold:17000,exp:17500,actCount:1,acts:[act(1,20),act(407,20),act(408,20),act(423,20),act(905,20)],elmRes:{火:30,闇:50,光:-40},resists:{Seal:90}}),
    m({id:100119,name:'深淵の剣鬼',race:'魔族',rank:131,minF:131,hp:95000,mp:4500,atk:9800,def:7000,spd:4300,mag:3500,mdef:6500,gold:17000,exp:17500,actCount:1,acts:[act(1,20),act(106,20),act(119,20),act(409,20),act(117,20)],elmRes:{闇:40,光:-30},resists:{Poison:80,Seal:60}}),
    m({id:100120,name:'深淵の番犬',race:'獣',rank:131,minF:131,hp:82000,mp:0,atk:9200,def:3800,spd:6500,mag:120,mdef:800,gold:17000,exp:17500,actCount:1,acts:[act(1,20),act(211,25),act(205,20),act(206,20),act(703,15)],elmRes:{闇:30,風:20,火:-20,光:-20},resists:{Fear:50}}),
    m({id:100121,name:'深淵の鎧武者',race:'無生物',rank:131,minF:131,hp:105000,mp:1200,atk:9000,def:9000,spd:2800,mag:2500,mdef:7000,gold:17000,exp:17500,actCount:1,acts:[act(1,20),act(401,20),act(118,20),act(414,20),act(51,20)],elmRes:{闇:40,光:20,雷:-30},resists:{Poison:100,Shock:70}}),
  ]},

  { bandStart: 136, bandEnd: 140, monsters: [
    m({id:100122,name:'ブライトドラゴン',race:'竜',rank:136,minF:136,hp:110000,mp:9000,atk:9800,def:8000,spd:4600,mag:9800,mdef:9000,gold:20000,exp:21000,actCount:1,acts:[act(1,20),act(410,20),act(408,20),act(610,20),act(615,20)],elmRes:{光:60,雷:30,闇:-40},resists:{Poison:100,Fear:80,Seal:50}}),
    m({id:100123,name:'ダークドラゴン',race:'竜',rank:136,minF:136,hp:110000,mp:9000,atk:9800,def:8000,spd:4600,mag:9800,mdef:9000,gold:20000,exp:21000,actCount:1,acts:[act(1,20),act(423,20),act(405,20),act(611,20),act(615,20)],elmRes:{闇:60,混沌:30,光:-40},resists:{Poison:100,Fear:80,Seal:50}}),
    m({id:100124,name:'ボルトアクス',race:'魔族',rank:136,minF:136,hp:90000,mp:1000,atk:10500,def:7000,spd:4000,mag:150,mdef:5000,gold:20000,exp:21000,actCount:1,acts:[act(1,20),act(158,20),act(401,20),act(113,20),act(50,20)],elmRes:{雷:50,風:-30},resists:{Shock:90,Poison:70}}),
    m({id:100125,name:'エビルグレン',race:'魔族',rank:136,minF:136,hp:95000,mp:8500,atk:8500,def:7000,spd:4300,mag:10500,mdef:7000,gold:20000,exp:21000,actCount:1,acts:[act(1,20),act(407,20),act(424,20),act(613,20),act(905,20)],elmRes:{火:50,闇:30,水:-40,光:-20},resists:{Seal:80,Poison:80}}),
    m({id:100126,name:'ダークネスドラゴン',race:'竜',rank:136,minF:136,hp:160000,mp:10000,atk:7000,def:9500,spd:5000,mag:7000,mdef:10000,gold:33000,exp:34650,actCount:2,isElite:true,acts:[act(1,15),act(423,20),act(611,20),act(616,15),act(615,15),act(57,15)],drops:{normal:{id:106,rate:2},rare:{id:107,rate:0.3}},elmRes:{闇:70,混沌:40,光:-40},resists:{Poison:100,Fear:100,Seal:70}}),
  ]},

  { bandStart: 141, bandEnd: 145, monsters: [
    m({id:100127,name:'カオスアーマー強',race:'無生物',rank:141,minF:141,hp:78000,mp:1000,atk:15000,def:9000,spd:2600,mag:2500,mdef:7000,gold:23000,exp:24000,actCount:1,acts:[act(1,20),act(401,20),act(409,20),act(118,20),act(57,20)],elmRes:{闇:40,光:30,雷:-30},resists:{Poison:100,Shock:80}}),
    m({id:100128,name:'ヘルエンゼル',race:'精霊',rank:141,minF:141,hp:70000,mp:8000,atk:150,def:3600,spd:2600,mag:15500,mdef:8500,gold:23000,exp:24000,actCount:1,acts:[act(1,20),act(410,20),act(423,20),act(22,15),act(905,25)],elmRes:{光:40,闇:40,混沌:-30},resists:{Poison:90,Seal:70}}),
    m({id:100129,name:'アビスバトラー強',race:'魔族',rank:141,minF:141,hp:72000,mp:4200,atk:15500,def:7000,spd:4300,mag:3500,mdef:6500,gold:23000,exp:24000,actCount:1,acts:[act(1,20),act(119,25),act(409,20),act(117,20),act(50,15)],elmRes:{闇:50,光:-30},resists:{Poison:90,Seal:70}}),
    m({id:100130,name:'カースバット強',race:'死霊',rank:141,minF:141,hp:62000,mp:6000,atk:6000,def:1800,spd:5600,mag:12000,mdef:6500,gold:23000,exp:24000,actCount:1,acts:[act(1,20),act(204,20),act(704,20),act(705,20),act(804,20)],elmRes:{闇:50,光:-40},resists:{Poison:100,Seal:80,InstantDeath:90}}),
  ]},

  { bandStart: 146, bandEnd: 150, monsters: [
    m({id:100131,name:'デスマシーン改',race:'機械',rank:146,minF:146,hp:82000,mp:0,atk:15500,def:9000,spd:3800,mag:150,mdef:7000,gold:26000,exp:27000,actCount:1,acts:[act(1,15),act(154,20),act(401,20),act(409,20),act(420,25)],elmRes:{闇:40,雷:-30,水:-20},resists:{Poison:100,Shock:80}}),
    m({id:100132,name:'アークデビル強',race:'魔族',rank:146,minF:146,hp:76000,mp:8500,atk:8000,def:6200,spd:4300,mag:15500,mdef:7500,gold:26000,exp:27000,actCount:1,acts:[act(1,15),act(407,20),act(423,20),act(412,20),act(905,25)],elmRes:{火:40,闇:60,光:-40},resists:{Poison:90,Seal:90}}),
    m({id:100133,name:'アビスジェリー強',race:'粘体',rank:146,minF:146,hp:85000,mp:6000,atk:9000,def:6500,spd:1400,mag:12500,mdef:6500,gold:26000,exp:27000,actCount:1,acts:[act(1,15),act(405,20),act(410,20),act(414,20),act(53,25)],elmRes:{火:30,闇:40,光:20,雷:-30},resists:{Poison:100,Seal:70}}),
    m({id:100134,name:'深淵の司祭',race:'魔族',rank:146,minF:146,hp:72000,mp:9000,atk:1500,def:4200,spd:3800,mag:15500,mdef:8500,gold:26000,exp:27000,actCount:1,acts:[act(1,15),act(423,20),act(24,10),act(905,20),act(704,20),act(57,15)],elmRes:{闇:60,光:-40},resists:{Poison:90,Seal:90}}),
    m({id:100135,name:'デビルキング',race:'魔族',rank:146,minF:146,hp:125000,mp:9000,atk:10000,def:8000,spd:6000,mag:10300,mdef:9000,gold:42900,exp:44550,actCount:2,isElite:true,acts:[act(1,15),act(407,20),act(412,20),act(423,20),act(905,15),act(57,10)],drops:{normal:{id:106,rate:2},rare:{id:107,rate:0.3}},elmRes:{火:50,闇:70,混沌:20,光:-40},resists:{Poison:100,Seal:100}}),
  ]},

  { bandStart: 151, bandEnd: 155, monsters: [
    m({id:100136,name:'アビスロード',race:'魔族',rank:151,minF:151,hp:105000,mp:10000,atk:12000,def:8000,spd:6500,mag:19000,mdef:9000,gold:30000,exp:32000,actCount:1,acts:[act(1,15),act(305,10),act(407,20),act(425,20),act(905,20),act(901,15)],elmRes:{火:40,闇:60,混沌:30,光:-30},resists:{Poison:100,Seal:100,InstantDeath:90}}),
    m({id:100137,name:'断罪の騎士',race:'無生物',rank:151,minF:151,hp:115000,mp:1200,atk:20000,def:11000,spd:4500,mag:2500,mdef:8500,gold:30000,exp:32000,actCount:1,acts:[act(1,15),act(102,10),act(409,20),act(421,10),act(118,20),act(414,25)],elmRes:{光:40,闇:40,雷:-30},resists:{Poison:100,Shock:90,Seal:70}}),
    m({id:100138,name:'深淵竜の眷属',race:'竜',rank:151,minF:151,hp:120000,mp:8000,atk:18000,def:9000,spd:5200,mag:18000,mdef:8500,gold:30000,exp:32000,actCount:1,acts:[act(1,15),act(603,10),act(605,15),act(610,20),act(611,20),act(615,20)],elmRes:{火:50,闇:40,光:30,水:-20,雷:-20},resists:{Poison:100,Fear:100,Seal:70}}),
    m({id:100139,name:'冥府の番人',race:'死霊',rank:151,minF:151,hp:80000,mp:10000,atk:7500,def:2200,spd:8000,mag:19000,mdef:9500,gold:30000,exp:32000,actCount:1,acts:[act(1,15),act(47,10),act(423,20),act(704,15),act(805,10),act(922,30)],elmRes:{闇:70,混沌:30,光:-50},resists:{Poison:100,Seal:90,InstantDeath:100}}),
  ]},

  { bandStart: 156, bandEnd: 160, monsters: [
    m({id:100140,name:'りゅうじん',race:'竜人',rank:156,minF:156,hp:125000,mp:7000,atk:21000,def:9000,spd:6500,mag:9000,mdef:8500,gold:35000,exp:37000,actCount:1,acts:[act(1,15),act(103,10),act(409,20),act(213,20),act(615,20),act(901,15)],elmRes:{火:40,雷:30,光:30,闇:-30},resists:{Poison:100,Fear:90,Seal:70}}),
    m({id:100141,name:'エビルレオン',race:'獣人',rank:156,minF:156,hp:110000,mp:0,atk:22000,def:6500,spd:8500,mag:120,mdef:4200,gold:35000,exp:37000,actCount:1,acts:[act(1,15),act(211,15),act(212,20),act(206,20),act(617,20),act(909,10)],elmRes:{風:40,闇:30,光:-30},resists:{Fear:80,Poison:80}}),
    m({id:100142,name:'ヴェルドクローン',race:'魔族',rank:156,minF:156,hp:125000,mp:12000,atk:19000,def:10000,spd:7000,mag:22000,mdef:10000,gold:35000,exp:37000,actCount:1,acts:[act(1,15),act(405,10),act(425,20),act(426,20),act(908,20),act(500,15)],elmRes:{火:40,闇:50,混沌:40,光:-20,雷:-20},resists:{Poison:100,Seal:100,Debuff:50,InstantDeath:100}}),
    m({id:100143,name:'禍炎ウィスプ',race:'精霊',rank:156,minF:156,hp:85000,mp:12000,atk:150,def:2200,spd:8000,mag:22000,mdef:10000,gold:35000,exp:37000,actCount:1,acts:[act(1,15),act(305,10),act(407,20),act(425,20),act(613,20),act(901,15)],elmRes:{火:70,混沌:30,水:-50},resists:{Poison:100,Seal:90}}),
    m({id:100144,name:'ヴェルドクローン零式',race:'魔族',rank:156,minF:156,hp:180000,mp:12000,atk:13000,def:11000,spd:8000,mag:14000,mdef:11000,gold:57750,exp:61050,actCount:2,isElite:true,acts:[act(1,10),act(425,20),act(426,20),act(908,20),act(500,10),act(57,10),act(90,10)],drops:{normal:{id:107,rate:0.3},rare:{id:106,rate:3}},elmRes:{火:50,闇:60,混沌:50,光:-20,雷:-20},resists:{Poison:100,Seal:120,Debuff:70,InstantDeath:100}}),
  ]},

  { bandStart: 161, bandEnd: 165, monsters: [
    m({id:100145,name:'深淵の牙王',race:'獣',rank:161,minF:161,hp:140000,mp:0,atk:15500,def:6500,spd:10000,mag:150,mdef:1200,gold:42000,exp:44000,actCount:1,acts:[act(1,15),act(108,10),act(212,25),act(206,20),act(617,20),act(909,10)],elmRes:{風:50,闇:30,火:-20,光:-20},resists:{Fear:90}}),
    m({id:100146,name:'災厄機兵',race:'機械',rank:161,minF:161,hp:170000,mp:1200,atk:16000,def:14000,spd:5000,mag:2000,mdef:9000,gold:42000,exp:44000,actCount:1,acts:[act(1,15),act(154,10),act(401,20),act(409,20),act(420,20),act(431,15)],elmRes:{闇:40,光:20,雷:-50},resists:{Poison:120,Shock:100,Seal:70}}),
    m({id:100147,name:'魔導装甲ジャッジ',race:'無生物',rank:161,minF:161,hp:160000,mp:12000,atk:12000,def:15000,spd:4500,mag:15000,mdef:10000,gold:42000,exp:44000,actCount:1,acts:[act(1,15),act(306,10),act(412,20),act(408,20),act(59,15),act(53,20)],elmRes:{光:50,雷:40,闇:-30},resists:{Poison:120,Seal:100}}),
    m({id:100148,name:'黒翼の司祭',race:'魔族',rank:161,minF:161,hp:110000,mp:13000,atk:3000,def:4500,spd:8000,mag:15500,mdef:11000,gold:42000,exp:44000,actCount:1,acts:[act(1,15),act(307,10),act(423,20),act(24,10),act(905,25),act(804,20)],elmRes:{闇:70,光:-40},resists:{Poison:100,Seal:120,InstantDeath:100}}),
  ]},

  { bandStart: 166, bandEnd: 170, monsters: [
    m({id:100149,name:'カースロード',race:'死霊',rank:166,minF:166,hp:120000,mp:14000,atk:4000,def:2400,spd:9000,mag:16000,mdef:12000,gold:50000,exp:52000,actCount:1,acts:[act(1,15),act(312,10),act(423,20),act(426,20),act(805,15),act(905,20)],elmRes:{闇:70,混沌:30,光:-50},resists:{Poison:120,Seal:100,InstantDeath:120}}),
    m({id:100150,name:'アビスデーモン',race:'魔族',rank:166,minF:166,hp:160000,mp:13000,atk:14000,def:10000,spd:6500,mag:15000,mdef:10000,gold:50000,exp:52000,actCount:1,acts:[act(1,15),act(104,10),act(411,20),act(426,20),act(908,20),act(901,15)],elmRes:{闇:70,混沌:40,光:-30},resists:{Poison:100,Seal:100,Debuff:50,InstantDeath:100}}),
    m({id:100151,name:'ダークワイバーン',race:'竜',rank:166,minF:166,hp:180000,mp:12000,atk:15500,def:10000,spd:8000,mag:15000,mdef:10000,gold:50000,exp:52000,actCount:1,acts:[act(1,15),act(604,10),act(611,20),act(616,20),act(614,20),act(615,15)],elmRes:{闇:60,風:50,光:-30},resists:{Poison:120,Fear:120,Seal:80}}),
    m({id:100152,name:'シャドウマシーン',race:'機械',rank:166,minF:166,hp:170000,mp:1000,atk:16000,def:14000,spd:7000,mag:150,mdef:9000,gold:50000,exp:52000,actCount:1,acts:[act(1,15),act(154,10),act(420,20),act(206,20),act(431,15),act(57,20)],elmRes:{闇:60,雷:-50},resists:{Poison:120,Shock:100}}),
    m({id:100153,name:'ワイバーンキング',race:'竜',rank:166,minF:166,hp:300000,mp:15000,atk:10000,def:15000,spd:9000,mag:10000,mdef:12000,gold:82500,exp:85800,actCount:2,isElite:true,acts:[act(1,10),act(611,20),act(616,20),act(614,20),act(615,15),act(901,15)],drops:{normal:{id:100,rate:3},rare:{id:106,rate:2}},elmRes:{闇:70,風:60,混沌:30,光:-30},resists:{Poison:120,Fear:120,Seal:100}}),
  ]},

  { bandStart: 171, bandEnd: 175, monsters: [
    m({id:100154,name:'獄炎バトラー',race:'魔族',rank:171,minF:171,hp:230000,mp:12000,atk:17000,def:12000,spd:7000,mag:17000,mdef:10000,gold:60000,exp:62000,actCount:1,acts:[act(1,15),act(40,10),act(213,20),act(424,20),act(613,20),act(901,15)],elmRes:{火:70,闇:30,水:-40,光:-30},resists:{Poison:100,Seal:90}}),
    m({id:100155,name:'氷獄バトラー',race:'魔族',rank:171,minF:171,hp:230000,mp:12000,atk:17000,def:12000,spd:7000,mag:17000,mdef:10000,gold:60000,exp:62000,actCount:1,acts:[act(1,15),act(42,10),act(406,20),act(428,20),act(612,20),act(901,15)],elmRes:{水:70,闇:30,雷:-40,光:-30},resists:{Poison:100,Seal:90}}),
    m({id:100156,name:'雷獄バトラー',race:'魔族',rank:171,minF:171,hp:230000,mp:12000,atk:17000,def:12000,spd:7000,mag:17000,mdef:10000,gold:60000,exp:62000,actCount:1,acts:[act(1,15),act(43,10),act(408,20),act(427,20),act(413,20),act(901,15)],elmRes:{雷:70,闇:30,風:-40,光:-30},resists:{Poison:100,Seal:90,Shock:100}}),
    m({id:100157,name:'ヘルスライム',race:'粘体',rank:171,minF:171,hp:280000,mp:12000,atk:7000,def:12000,spd:1800,mag:17000,mdef:10000,gold:60000,exp:62000,actCount:1,acts:[act(1,15),act(405,10),act(609,20),act(908,20),act(911,20),act(901,15)],elmRes:{混沌:60,闇:40,火:30,光:-30,雷:-20},resists:{Poison:120,Seal:100}}),
  ]},

  { bandStart: 176, bandEnd: 180, monsters: [
    m({id:100158,name:'アビスドラゴン',race:'竜',rank:176,minF:176,hp:300000,mp:15000,atk:19000,def:13000,spd:8000,mag:19000,mdef:12000,gold:70000,exp:73000,actCount:1,acts:[act(1,10),act(605,10),act(610,20),act(611,20),act(616,20),act(615,20)],elmRes:{火:60,闇:60,光:40,混沌:30,水:-20,雷:-20},resists:{Poison:120,Fear:120,Seal:100}}),
    m({id:100159,name:'冥界の騎士',race:'死霊',rank:176,minF:176,hp:260000,mp:6000,atk:20000,def:13000,spd:6500,mag:6000,mdef:10000,gold:70000,exp:73000,actCount:1,acts:[act(1,10),act(104,10),act(411,20),act(421,10),act(119,25),act(804,25)],elmRes:{闇:70,光:-50},resists:{Poison:120,Seal:100,InstantDeath:120}}),
    m({id:100160,name:'魔触の胞子',race:'植物',rank:176,minF:176,hp:230000,mp:15000,atk:2000,def:7000,spd:4000,mag:20000,mdef:12000,gold:70000,exp:73000,actCount:1,acts:[act(1,10),act(702,10),act(908,25),act(905,25),act(24,10),act(911,20)],elmRes:{闇:50,混沌:50,火:-40,光:-20},resists:{Poison:150,Seal:100}}),
    m({id:100161,name:'イービルレイス',race:'精霊',rank:176,minF:176,hp:220000,mp:17000,atk:150,def:3000,spd:9000,mag:20500,mdef:14000,gold:70000,exp:73000,actCount:1,acts:[act(1,10),act(407,10),act(425,20),act(426,20),act(430,20),act(901,20)],elmRes:{火:40,闇:60,光:40,混沌:-20},resists:{Poison:120,Seal:120}}),
    m({id:100162,name:'ドラゴンゾンビ',race:'竜',rank:176,minF:176,hp:440000,mp:17000,atk:13000,def:15000,spd:9000,mag:13000,mdef:14000,gold:115500,exp:120450,actCount:2,isElite:true,acts:[act(1,10),act(610,20),act(611,20),act(616,20),act(615,15),act(901,15)],drops:{normal:{id:107,rate:0.4},rare:{id:106,rate:3}},elmRes:{火:70,闇:70,光:50,混沌:40,水:-20,雷:-20},resists:{Poison:150,Fear:150,Seal:120}}),
  ]},

  { bandStart: 181, bandEnd: 185, monsters: [
    m({id:100163,name:'カラミティナイト',race:'魔族',rank:181,minF:181,hp:330000,mp:6000,atk:24000,def:16000,spd:6500,mag:8000,mdef:12000,gold:85000,exp:90000,actCount:1,acts:[act(1,10),act(102,10),act(421,15),act(923,10),act(414,25),act(905,30)],elmRes:{闇:60,混沌:50,光:-40},resists:{Poison:120,Seal:100,InstantDeath:100}}),
    m({id:100164,name:'深淵の大魔導',race:'魔族',rank:181,minF:181,hp:300000,mp:20000,atk:150,def:6000,spd:8000,mag:24500,mdef:16000,gold:85000,exp:90000,actCount:1,acts:[act(1,10),act(407,10),act(425,20),act(426,20),act(427,20),act(901,20)],elmRes:{火:50,雷:50,闇:60,混沌:40,光:-40},resists:{Seal:150,Poison:100,InstantDeath:100}}),
    m({id:100165,name:'デスアーマー',race:'無生物',rank:181,minF:181,hp:380000,mp:1200,atk:23000,def:20000,spd:4500,mag:2500,mdef:13000,gold:85000,exp:90000,actCount:1,acts:[act(1,10),act(117,10),act(421,15),act(431,15),act(118,25),act(57,25)],elmRes:{闇:50,光:50,混沌:30,雷:-30},resists:{Poison:150,Shock:120,Seal:100}}),
    m({id:100166,name:'黒炎竜',race:'竜',rank:181,minF:181,hp:380000,mp:16000,atk:24000,def:16000,spd:8000,mag:24000,mdef:14000,gold:85000,exp:90000,actCount:1,acts:[act(1,10),act(605,10),act(613,20),act(609,20),act(616,20),act(901,20)],elmRes:{火:80,闇:50,混沌:40,水:-50,光:-20},resists:{Poison:150,Fear:120,Seal:100}}),
  ]},

  { bandStart: 186, bandEnd: 190, monsters: [
    m({id:100167,name:'アビスバトラー強',race:'魔族',rank:186,minF:186,hp:420000,mp:8000,atk:25000,def:18000,spd:7000,mag:8000,mdef:14000,gold:100000,exp:105000,actCount:1,acts:[act(1,10),act(106,10),act(111,20),act(119,20),act(421,15),act(902,25)],elmRes:{闇:70,混沌:40,光:-30},resists:{Poison:120,Seal:120,InstantDeath:100}}),
    m({id:100168,name:'グレイブロード',race:'死霊',rank:186,minF:186,hp:300000,mp:20000,atk:5000,def:3000,spd:9000,mag:25000,mdef:16000,gold:100000,exp:105000,actCount:1,acts:[act(1,10),act(423,10),act(426,20),act(805,15),act(922,25),act(901,20)],elmRes:{闇:80,混沌:40,光:-50},resists:{Poison:150,Seal:120,InstantDeath:150}}),
    m({id:100169,name:'滅びの機神',race:'機械',rank:186,minF:186,hp:430000,mp:1200,atk:25000,def:22000,spd:9000,mag:150,mdef:14000,gold:100000,exp:105000,actCount:1,acts:[act(1,10),act(154,10),act(420,20),act(431,15),act(432,10),act(401,35)],elmRes:{闇:50,光:40,雷:-50},resists:{Poison:150,Shock:150,Seal:100}}),
    m({id:100170,name:'深淵ジェリー皇',race:'粘体',rank:186,minF:186,hp:440000,mp:16000,atk:9000,def:16000,spd:2000,mag:24000,mdef:14000,gold:100000,exp:105000,actCount:1,acts:[act(1,10),act(405,10),act(911,20),act(908,20),act(901,20),act(53,20)],elmRes:{混沌:60,闇:50,光:30,雷:-30},resists:{Poison:150,Seal:120}}),
    m({id:100171,name:'機神零式',race:'機械',rank:186,minF:186,hp:660000,mp:1200,atk:16000,def:24000,spd:10000,mag:150,mdef:16000,gold:165000,exp:173250,actCount:2,isElite:true,acts:[act(1,10),act(420,20),act(431,15),act(432,10),act(409,20),act(57,25)],drops:{normal:{id:106,rate:3},rare:{id:107,rate:0.6}},elmRes:{闇:60,光:50,雷:-50},resists:{Poison:150,Shock:150,Seal:120}}),
  ]},

  { bandStart: 191, bandEnd: 195, monsters: [
    m({id:100172,name:'アビスロード強',race:'魔族',rank:191,minF:191,hp:520000,mp:24000,atk:18000,def:18000,spd:9000,mag:30000,mdef:18000,gold:120000,exp:130000,actCount:1,acts:[act(1,10),act(407,10),act(425,20),act(426,20),act(908,20),act(901,20)],elmRes:{火:60,闇:80,混沌:50,光:-30},resists:{Poison:150,Seal:150,InstantDeath:120}}),
    m({id:100173,name:'終焉の竜兵',race:'竜人',rank:191,minF:191,hp:560000,mp:16000,atk:30000,def:20000,spd:9500,mag:16000,mdef:16000,gold:120000,exp:130000,actCount:1,acts:[act(1,10),act(103,10),act(409,20),act(421,15),act(616,20),act(901,25)],elmRes:{火:50,雷:50,闇:50,混沌:40,光:-30},resists:{Poison:150,Fear:120,Seal:120}}),
    m({id:100174,name:'ソウルイーター',race:'死霊',rank:191,minF:191,hp:420000,mp:24000,atk:9000,def:3200,spd:10000,mag:30000,mdef:18000,gold:120000,exp:130000,actCount:1,acts:[act(1,10),act(47,10),act(922,20),act(805,15),act(426,20),act(901,25)],elmRes:{闇:80,混沌:50,光:-50},resists:{Poison:150,Seal:150,InstantDeath:150}}),
    m({id:100175,name:'混沌の甲冑',race:'無生物',rank:191,minF:191,hp:560000,mp:1200,atk:30000,def:25000,spd:5000,mag:3000,mdef:18000,gold:120000,exp:130000,actCount:1,acts:[act(1,10),act(117,10),act(411,20),act(421,15),act(432,10),act(57,35)],elmRes:{闇:60,光:60,混沌:50,雷:-30},resists:{Poison:150,Shock:150,Seal:120}}),
  ]},

  { bandStart: 196, bandEnd: 200, monsters: [
    m({id:100176,name:'大魔導ジャミラ',race:'魔族',rank:196,minF:196,hp:600000,mp:30000,atk:150,def:8000,spd:10000,mag:30000,mdef:22000,gold:150000,exp:160000,actCount:1,acts:[act(1,10),act(407,10),act(425,20),act(426,20),act(427,20),act(906,20)],elmRes:{火:60,雷:60,闇:80,混沌:60,光:-40},resists:{Poison:150,Seal:150,InstantDeath:150}}),
    m({id:100177,name:'ヘルマジンガ',race:'機械',rank:196,minF:196,hp:620000,mp:1200,atk:30000,def:30000,spd:9000,mag:150,mdef:22000,gold:150000,exp:160000,actCount:1,acts:[act(1,10),act(420,10),act(431,15),act(432,10),act(409,25),act(57,30)],elmRes:{闇:60,光:60,雷:-50,混沌:40},resists:{Poison:150,Shock:150,Seal:150}}),
    m({id:100178,name:'ロードオブジェリー',race:'粘体',rank:196,minF:196,hp:620000,mp:24000,atk:10000,def:22000,spd:2500,mag:28000,mdef:20000,gold:150000,exp:160000,actCount:1,acts:[act(1,10),act(405,10),act(908,20),act(911,20),act(901,20),act(999,5),act(53,15)],elmRes:{混沌:70,闇:60,光:40,火:40,雷:-30},resists:{Poison:150,Seal:150,InstantDeath:120}}),
    m({id:100179,name:'ドラゴンロード',race:'竜',rank:196,minF:196,hp:620000,mp:24000,atk:30000,def:22000,spd:9000,mag:28000,mdef:20000,gold:150000,exp:160000,actCount:1,acts:[act(1,10),act(605,10),act(610,20),act(611,20),act(616,20),act(906,20)],elmRes:{火:60,水:40,闇:70,光:50,混沌:50,雷:-20},resists:{Poison:150,Fear:150,Seal:150,InstantDeath:120}}),
    m({id:100180,name:'ジャジメント',race:'機械',rank:196,minF:196,hp:900000,mp:1200,atk:19000,def:33000,spd:10500,mag:150,mdef:24000,gold:247500,exp:264000,actCount:2,isElite:true,acts:[act(1,5),act(420,15),act(409,20),act(431,15),act(432,10),act(57,20),act(906,15)],drops:{normal:{id:107,rate:0.8},rare:{id:106,rate:4}},elmRes:{闇:70,光:70,雷:-50,混沌:50},resists:{Poison:150,Shock:150,Seal:150,InstantDeath:150}}),
  ]},
];

const FIXED_RARE_MONSTERS = [
  {"id":200201,"name":"メタルジェリー","race":"粘体","rank":10,"minF":5,"hp":4,"mp":999,"atk":50,"def":99999,"spd":9999,"mag":416,"mdef":99999,"hit":100,"eva":25,"cri":20,"gold":50,"exp":1000,"actCount":1,"isBoss":false,"isRare":true,"isEstark":false,"acts":[{"id":1,"rate":20,"condition":0},{"id":10,"rate":20,"condition":0},{"id":9,"rate":60,"condition":0}],"drops":{"normal":{"id":102,"rate":20},"rare":{"id":106,"rate":10}},"elmRes":{"火":120,"水":120,"風":120,"雷":120,"光":120,"闇":120,"混沌":120},"resists":{"Poison":100,"Shock":100,"Fear":50,"Seal":100,"Debuff":100,"InstantDeath":100},"traits":[],"archives":["とても固く逃げ足が速いが、倒すと大きな経験を得られるとして人気の魔物。"]},
  {"id":200202,"name":"ロンリーメタル","race":"粘体","rank":40,"minF":20,"hp":8,"mp":999,"atk":150,"def":99999,"spd":25555,"mag":2555,"mdef":99999,"hit":100,"eva":25,"cri":20,"gold":200,"exp":20000,"actCount":1,"isBoss":false,"isRare":true,"isEstark":false,"acts":[{"id":1,"rate":10,"condition":0},{"id":302,"rate":25,"condition":0},{"id":9,"rate":45,"condition":0}],"drops":{"normal":{"id":103,"rate":20},"rare":{"id":106,"rate":10}},"elmRes":{"火":1000,"水":1000,"風":1000,"雷":1000,"光":1000,"闇":1000,"混沌":1000},"resists":{"Poison":100,"Shock":100,"Fear":50,"Seal":100,"Debuff":100,"InstantDeath":1000},"traits":[],"archives":[]},
  {"id":200203,"name":"メタルロード","race":"粘体","rank":80,"minF":50,"hp":20,"mp":9999,"atk":400,"def":999999,"spd":99999,"mag":9999,"mdef":999999,"hit":100,"eva":25,"cri":20,"gold":1000,"exp":100000,"actCount":1,"isBoss":false,"isRare":true,"isEstark":false,"acts":[{"id":1,"rate":5,"condition":0},{"id":306,"rate":25,"condition":0},{"id":9,"rate":70,"condition":0}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":1000,"水":1000,"風":1000,"雷":1000,"光":1000,"闇":1000,"混沌":1000},"resists":{"Poison":100,"Shock":100,"Fear":50,"Seal":100,"Debuff":100,"InstantDeath":1000},"traits":[],"archives":[]},
  {"id":200204,"name":"プリズムキング","race":"粘体","rank":100,"minF":101,"hp":50,"mp":9999,"atk":1000,"def":999999,"spd":9999,"mag":20000,"mdef":999999,"hit":100,"eva":25,"cri":20,"gold":4160,"exp":416000,"actCount":2,"isBoss":false,"isRare":true,"isEstark":false,"acts":[{"id":406,"rate":20,"condition":0},{"id":407,"rate":20,"condition":0},{"id":500,"rate":10,"condition":0},{"id":9,"rate":40,"condition":0},{"id":1,"rate":10,"condition":0}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":1000,"水":1000,"風":1000,"雷":1000,"光":1000,"闇":1000,"混沌":1000},"resists":{"Poison":100,"Shock":100,"Fear":50,"Seal":100,"Debuff":100,"InstantDeath":1000},"traits":[],"archives":[]},
];

const FIXED_BOSS_MONSTERS = [
  {"id":301000,"name":"バトルリザード","race":"竜","rank":10,"minF":1,"hp":2000,"mp":500,"atk":420,"def":250,"spd":130,"mag":100,"mdef":100,"hit":150,"eva":20,"cri":15,"gold":500,"exp":1000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":40,"rate":17,"condition":0},{"id":44,"rate":17,"condition":0},{"id":601,"rate":17,"condition":0},{"id":41,"rate":16,"condition":0}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5}],"archives":[]},
  {"id":401010,"name":"レオン将軍","race":"獣人","rank":10,"minF":10,"hp":10000,"mp":1000,"atk":520,"def":350,"spd":150,"mag":150,"mdef":150,"hit":150,"eva":20,"cri":15,"gold":500,"exp":1000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":40,"rate":17,"condition":0},{"id":44,"rate":17,"condition":0},{"id":601,"rate":17,"condition":0},{"id":603,"rate":16,"condition":0},{"id":41,"rate":16,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":100,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5}],"archives":[]},
  {"id":401020,"name":"グレン将軍","race":"獣人","rank":20,"minF":20,"hp":14160,"mp":1200,"atk":950,"def":520,"spd":580,"mag":850,"mdef":800,"hit":150,"eva":20,"cri":15,"gold":1000,"exp":2000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":15,"condition":0},{"id":301,"rate":15,"condition":0},{"id":302,"rate":14,"condition":0},{"id":303,"rate":14,"condition":0},{"id":201,"rate":14,"condition":0},{"id":307,"rate":14,"condition":0},{"id":40,"rate":14,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":101,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5}],"archives":[]},
  {"id":401030,"name":"雷楔のレナード","race":"魔族","rank":30,"minF":30,"hp":22000,"mp":2416,"atk":1600,"def":900,"spd":850,"mag":800,"mdef":700,"hit":150,"eva":20,"cri":15,"gold":2000,"exp":4000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":13,"condition":0},{"id":41,"rate":13,"condition":0},{"id":44,"rate":13,"condition":0},{"id":101,"rate":13,"condition":0},{"id":102,"rate":12,"condition":0},{"id":104,"rate":12,"condition":0},{"id":105,"rate":12,"condition":0},{"id":49,"rate":12,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":102,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":49,"level":2}],"archives":[]},
  {"id":401040,"name":"風楔のエリシア","race":"魔族","rank":40,"minF":40,"hp":34160,"mp":3300,"atk":2500,"def":2550,"spd":1050,"mag":2300,"mdef":2000,"hit":150,"eva":20,"cri":15,"gold":3000,"exp":6000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":17,"condition":0},{"id":304,"rate":17,"condition":0},{"id":309,"rate":17,"condition":0},{"id":305,"rate":17,"condition":0},{"id":603,"rate":16,"condition":0},{"id":605,"rate":16,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":104,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":48,"level":2}],"archives":[]},
  {"id":401050,"name":"氷楔のシーリス ","race":"魔族","rank":50,"minF":50,"hp":48000,"mp":4200,"atk":3300,"def":4300,"spd":1500,"mag":3100,"mdef":3000,"hit":150,"eva":20,"cri":15,"gold":5000,"exp":10000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":15,"condition":0},{"id":42,"rate":15,"condition":0},{"id":303,"rate":14,"condition":0},{"id":604,"rate":14,"condition":0},{"id":44,"rate":14,"condition":0},{"id":41,"rate":14,"condition":0},{"id":203,"rate":14,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":105,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":49,"level":2}],"archives":[]},
  {"id":401060,"name":"炎楔のグラド","race":"魔族","rank":60,"minF":60,"hp":80000,"mp":6800,"atk":3400,"def":4750,"spd":2740,"mag":6500,"mdef":5000,"hit":150,"eva":20,"cri":15,"gold":8000,"exp":15000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":407,"rate":13,"condition":0},{"id":306,"rate":13,"condition":0},{"id":307,"rate":13,"condition":0},{"id":605,"rate":13,"condition":0},{"id":606,"rate":12,"condition":0},{"id":905,"rate":12,"condition":0},{"id":57,"rate":12,"condition":0},{"id":3,"rate":12,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":103,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":50,"level":2}],"archives":[]},
  {"id":401070,"name":"混沌の騎士ヴェルド","race":"魔族","rank":70,"minF":70,"hp":104160,"mp":8000,"atk":6600,"def":5400,"spd":2950,"mag":7600,"mdef":7000,"hit":150,"eva":20,"cri":15,"gold":10000,"exp":20000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":10,"condition":0},{"id":306,"rate":25,"condition":1},{"id":405,"rate":20,"condition":2},{"id":406,"rate":20,"condition":0},{"id":407,"rate":20,"condition":0},{"id":57,"rate":5,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":101,"rate":1}},"elmRes":{},"resists":{"InstantDeath":99},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":12,"level":2},{"id":19,"level":5}],"archives":[]},
  {"id":401080,"name":"ヘルクラッシャー","race":"機械","rank":80,"minF":80,"hp":104160,"mp":6000,"atk":8000,"def":2000,"spd":1150,"mag":1450,"mdef":2000,"hit":150,"eva":20,"cri":15,"gold":4500,"exp":10000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":113,"rate":50,"condition":0},{"id":101,"rate":20,"condition":0},{"id":102,"rate":20,"condition":0},{"id":44,"rate":9,"condition":0},{"id":1,"rate":1,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":102,"rate":1}},"elmRes":{},"resists":{"InstantDeath":50},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401081,"name":"アビスウィッチ","race":"魔族","rank":80,"minF":80,"hp":74160,"mp":6416,"atk":6416,"def":5300,"spd":3500,"mag":6700,"mdef":6000,"hit":150,"eva":20,"cri":15,"gold":4500,"exp":10000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":412,"rate":15,"condition":0},{"id":500,"rate":10,"condition":2},{"id":309,"rate":20,"condition":0},{"id":202,"rate":20,"condition":0},{"id":46,"rate":25,"condition":0},{"id":81,"rate":5,"condition":2},{"id":57,"rate":5,"condition":0}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":104,"rate":1}},"elmRes":{},"resists":{"InstantDeath":90},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401082,"name":"デモンキャット","race":"獣人","rank":80,"minF":80,"hp":80000,"mp":8400,"atk":7000,"def":6000,"spd":2450,"mag":6500,"mdef":5000,"hit":150,"eva":20,"cri":15,"gold":5000,"exp":10000,"actCount":1,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":1,"rate":1,"condition":0},{"id":305,"rate":15,"condition":1},{"id":306,"rate":15,"condition":1},{"id":24,"rate":10,"condition":2},{"id":50,"rate":10,"condition":0},{"id":412,"rate":17,"condition":2},{"id":609,"rate":17,"condition":2},{"id":405,"rate":15,"condition":2}],"drops":{"normal":{"id":4,"rate":20},"rare":{"id":105,"rate":1}},"elmRes":{},"resists":{"InstantDeath":50},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401090,"name":"暗黒神官ジャスパー","race":"魔族","rank":90,"minF":90,"hp":180000,"mp":8000,"atk":5600,"def":6700,"spd":3500,"mag":8800,"mdef":7000,"hit":150,"eva":20,"cri":15,"gold":20000,"exp":41600,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":404,"rate":20,"condition":0},{"id":405,"rate":15,"condition":2},{"id":406,"rate":15,"condition":0},{"id":407,"rate":15,"condition":0},{"id":412,"rate":10,"condition":0},{"id":500,"rate":10,"condition":2},{"id":57,"rate":5,"condition":0},{"id":81,"rate":10,"condition":2}],"drops":{"normal":{"id":5,"rate":20},"rare":{"id":106,"rate":1}},"elmRes":{},"resists":{"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5},{"id":30,"level":5}],"archives":[]},
  {"id":401100,"name":"魔王ゼノン","race":"魔族","rank":100,"minF":100,"hp":241600,"mp":9999,"atk":9999,"def":9999,"spd":3800,"mag":9999,"mdef":9999,"hit":150,"eva":20,"cri":15,"gold":41600,"exp":90000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":119,"rate":15,"condition":0},{"id":202,"rate":20,"condition":0},{"id":412,"rate":15,"condition":0},{"id":406,"rate":20,"condition":0},{"id":403,"rate":10,"condition":2},{"id":411,"rate":15,"condition":2},{"id":57,"rate":5,"condition":0},{"id":617,"rate":10,"condition":0}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":20,"水":20,"風":20,"雷":20,"光":20,"闇":20,"混沌":20},"resists":{"Poison":70,"Shock":70,"Fear":100,"Seal":100,"Debuff":0,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":18,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401110,"name":"封印竜ヴェルファイア","race":"竜","rank":110,"minF":110,"hp":400000,"mp":99999,"atk":13500,"def":13500,"spd":4200,"mag":13500,"mdef":13500,"hit":150,"eva":20,"cri":15,"gold":100000,"exp":100000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":3,"rate":15,"condition":0},{"id":614,"rate":10,"condition":1},{"id":612,"rate":10,"condition":1},{"id":613,"rate":10,"condition":1},{"id":610,"rate":10,"condition":2},{"id":611,"rate":10,"condition":2},{"id":413,"rate":10,"condition":2},{"id":107,"rate":10,"condition":2},{"id":56,"rate":10,"condition":3},{"id":57,"rate":5,"condition":0}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":20,"水":20,"風":20,"雷":20,"光":20,"闇":20,"混沌":20},"resists":{"Poison":0,"Shock":50,"Fear":100,"Seal":100,"Debuff":0,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401120,"name":"魔神シヴァ","race":"精霊","rank":120,"minF":120,"hp":541600,"mp":99999,"atk":10000,"def":9500,"spd":5200,"mag":18000,"mdef":15000,"hit":150,"eva":20,"cri":15,"gold":81600,"exp":90000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":406,"rate":15,"condition":0},{"id":415,"rate":10,"condition":0},{"id":307,"rate":10,"condition":1},{"id":921,"rate":20,"condition":0},{"id":922,"rate":15,"condition":2},{"id":606,"rate":15,"condition":2},{"id":905,"rate":10,"condition":0},{"id":57,"rate":5,"condition":0},{"id":90,"rate":5,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"水":100,"闇":100},"resists":{"Poison":70,"Shock":70,"Fear":100,"Seal":100,"Debuff":0,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401130,"name":"戦神ヴァルキュリア","race":"精霊","rank":130,"minF":130,"hp":700000,"mp":99999,"atk":17000,"def":14000,"spd":5000,"mag":16000,"mdef":15000,"hit":150,"eva":20,"cri":15,"gold":100000,"exp":100000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":610,"rate":13,"condition":0},{"id":410,"rate":13,"condition":0},{"id":402,"rate":13,"condition":0},{"id":404,"rate":13,"condition":1},{"id":416,"rate":12,"condition":2},{"id":413,"rate":12,"condition":2},{"id":56,"rate":12,"condition":3},{"id":63,"rate":12,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"風":100,"光":100,"混沌":100},"resists":{"Poison":70,"Shock":70,"Fear":100,"Seal":100,"Debuff":0,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401140,"name":"ヴェルファイア","race":"竜","rank":140,"minF":140,"hp":900000,"mp":99999,"atk":20000,"def":15000,"spd":5500,"mag":20000,"mdef":18000,"hit":150,"eva":20,"cri":15,"gold":141600,"exp":216000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":3,"rate":15,"condition":0},{"id":614,"rate":10,"condition":1},{"id":612,"rate":10,"condition":1},{"id":613,"rate":10,"condition":1},{"id":610,"rate":10,"condition":0},{"id":611,"rate":10,"condition":0},{"id":413,"rate":5,"condition":2},{"id":107,"rate":15,"condition":2},{"id":615,"rate":5,"condition":2},{"id":56,"rate":10,"condition":3}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":40,"水":40,"風":40,"雷":40,"光":40,"闇":40,"混沌":40},"resists":{"Poison":70,"Shock":70,"Fear":100,"Seal":100,"Debuff":0,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401150,"name":"シーリス・アビス","race":"獣人","rank":150,"minF":150,"hp":400000,"mp":99999,"atk":19000,"def":12000,"spd":4000,"mag":14000,"mdef":15000,"hit":150,"eva":20,"cri":15,"gold":100000,"exp":100000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":42,"rate":17,"condition":1},{"id":406,"rate":17,"condition":0},{"id":606,"rate":17,"condition":0},{"id":203,"rate":17,"condition":0},{"id":105,"rate":16,"condition":0},{"id":58,"rate":16,"condition":0}],"drops":{"normal":{"id":100,"rate":5},"rare":{"id":106,"rate":1}},"elmRes":{"火":0,"水":50,"光":0,"雷":-40},"resists":{"Poison":80,"Shock":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401151,"name":"エリシア・アビス","race":"獣人","rank":150,"minF":150,"hp":341600,"mp":99999,"atk":18000,"def":11000,"spd":6000,"mag":15000,"mdef":15000,"hit":150,"eva":20,"cri":15,"gold":100000,"exp":100000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":609,"rate":17,"condition":1},{"id":605,"rate":17,"condition":1},{"id":611,"rate":17,"condition":2},{"id":109,"rate":17,"condition":2},{"id":613,"rate":16,"condition":2},{"id":56,"rate":16,"condition":3}],"drops":{"normal":{"id":101,"rate":5},"rare":{"id":106,"rate":1}},"elmRes":{"火":25,"風":25,"光":25,"水":-10,"闇":-20},"resists":{"Poison":80,"Shock":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401152,"name":"グラド・アビス","race":"魔族","rank":150,"minF":150,"hp":380000,"mp":99999,"atk":14000,"def":13000,"spd":3500,"mag":18000,"mdef":20000,"hit":150,"eva":20,"cri":15,"gold":100000,"exp":100000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":407,"rate":15,"condition":1},{"id":412,"rate":15,"condition":0},{"id":413,"rate":14,"condition":2},{"id":609,"rate":14,"condition":0},{"id":907,"rate":14,"condition":2},{"id":905,"rate":14,"condition":3},{"id":404,"rate":14,"condition":0}],"drops":{"normal":{"id":103,"rate":5},"rare":{"id":106,"rate":1}},"elmRes":{"闇":20,"雷":-10,"混沌":40,"光":-10},"resists":{"Poison":80,"Shock":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401153,"name":"レナード・アビス","race":"魔族","rank":150,"minF":150,"hp":416000,"mp":99999,"atk":22000,"def":15000,"spd":5000,"mag":9000,"mdef":12000,"hit":150,"eva":20,"cri":15,"gold":100000,"exp":100000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":41,"rate":35,"condition":0},{"id":119,"rate":20,"condition":2},{"id":405,"rate":20,"condition":0},{"id":414,"rate":20,"condition":2},{"id":57,"rate":5,"condition":0}],"drops":{"normal":{"id":102,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"雷":-10,"光":-10,"闇":20,"混沌":20,"風":50},"resists":{"Poison":80,"Shock":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401160,"name":"常闇のゼルドラス","race":"魔族","rank":160,"minF":160,"hp":550000,"mp":99999,"atk":27000,"def":17000,"spd":6000,"mag":5000,"mdef":17000,"hit":150,"eva":20,"cri":15,"gold":0,"exp":0,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":119,"rate":15,"condition":0},{"id":113,"rate":25,"condition":1},{"id":411,"rate":20,"condition":2},{"id":55,"rate":10,"condition":2},{"id":31,"rate":10,"condition":0},{"id":202,"rate":20,"condition":0}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"Poison":70,"Shock":70,"InstantDeath":95,"Fear":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401161,"name":"混沌の騎士ヴェルド","race":"魔族","rank":160,"minF":160,"hp":700000,"mp":14160,"atk":20000,"def":20000,"spd":5000,"mag":25000,"mdef":25000,"hit":150,"eva":20,"cri":15,"gold":140000,"exp":180000,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":500,"rate":5,"condition":2},{"id":612,"rate":15,"condition":0},{"id":613,"rate":15,"condition":0},{"id":610,"rate":15,"condition":0},{"id":611,"rate":15,"condition":0},{"id":908,"rate":10,"condition":2},{"id":907,"rate":5,"condition":2},{"id":81,"rate":10,"condition":2},{"id":57,"rate":5,"condition":0},{"id":90,"rate":5,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":20,"水":20,"風":20,"雷":20,"光":20,"闇":20,"混沌":20},"resists":{"Poison":80,"Shock":80,"Fear":100,"Seal":100,"Debuff":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401162,"name":"風詠のエルメナス","race":"魔族","rank":160,"minF":160,"hp":400000,"mp":99999,"atk":20000,"def":15000,"spd":4000,"mag":27000,"mdef":15000,"hit":150,"eva":20,"cri":15,"gold":0,"exp":0,"actCount":2,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":407,"rate":13,"condition":1},{"id":406,"rate":13,"condition":0},{"id":412,"rate":14,"condition":0},{"id":922,"rate":15,"condition":2},{"id":24,"rate":15,"condition":2},{"id":403,"rate":10,"condition":2},{"id":56,"rate":20,"condition":3}],"drops":{"normal":{"id":null,"rate":0},"rare":{"id":null,"rate":0}},"elmRes":{},"resists":{"Poison":70,"Shock":70,"InstantDeath":95,"Seal":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401170,"name":"深淵竜ヴェルファイア","race":"竜","rank":170,"minF":170,"hp":1416000,"mp":99999,"atk":30000,"def":25000,"spd":7000,"mag":30000,"mdef":30000,"hit":150,"eva":20,"cri":15,"gold":141600,"exp":100000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":3,"rate":9,"condition":0},{"id":907,"rate":9,"condition":0},{"id":80,"rate":9,"condition":2},{"id":614,"rate":9,"condition":1},{"id":612,"rate":8,"condition":1},{"id":613,"rate":8,"condition":1},{"id":610,"rate":8,"condition":0},{"id":611,"rate":8,"condition":0},{"id":413,"rate":8,"condition":2},{"id":107,"rate":8,"condition":0},{"id":615,"rate":8,"condition":2},{"id":56,"rate":8,"condition":3}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":60,"水":60,"風":60,"雷":60,"光":60,"闇":60,"混沌":60},"resists":{"Poison":90,"Shock":90,"Fear":100,"Seal":100,"Debuff":50,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401180,"name":"アビスヴァイン","race":"魔族","rank":180,"minF":180,"hp":2000000,"mp":99999,"atk":38000,"def":28000,"spd":8000,"mag":20000,"mdef":20000,"hit":150,"eva":20,"cri":15,"gold":74160,"exp":141000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":119,"rate":15,"condition":2},{"id":414,"rate":15,"condition":0},{"id":401,"rate":20,"condition":0},{"id":409,"rate":15,"condition":2},{"id":907,"rate":15,"condition":2},{"id":57,"rate":5,"condition":0},{"id":108,"rate":10,"condition":1},{"id":420,"rate":5,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":100,"水":100,"風":100,"雷":100},"resists":{"Poison":90,"Shock":90,"Fear":100,"Seal":100,"Debuff":75,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401190,"name":"混沌竜ヴェルファイア","race":"竜","rank":190,"minF":190,"hp":3000000,"mp":99999,"atk":45000,"def":35000,"spd":9999,"mag":35000,"mdef":35000,"hit":150,"eva":20,"cri":15,"gold":200000,"exp":200000,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":3,"rate":10,"condition":0},{"id":80,"rate":10,"condition":2},{"id":907,"rate":10,"condition":0},{"id":614,"rate":5,"condition":1},{"id":612,"rate":5,"condition":1},{"id":613,"rate":5,"condition":1},{"id":610,"rate":10,"condition":0},{"id":611,"rate":10,"condition":0},{"id":107,"rate":10,"condition":0},{"id":413,"rate":10,"condition":2},{"id":615,"rate":10,"condition":2},{"id":906,"rate":5,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":80,"水":80,"風":80,"雷":80,"光":80,"闇":80,"混沌":80},"resists":{"Poison":90,"Shock":90,"Fear":100,"Seal":100,"Debuff":90,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
  {"id":401200,"name":"混沌竜アビス","race":"竜","rank":200,"minF":200,"hp":4160000,"mp":99999,"atk":55000,"def":45000,"spd":12000,"mag":55000,"mdef":45000,"hit":150,"eva":20,"cri":15,"gold":999999,"exp":999999,"actCount":3,"isBoss":true,"isRare":false,"isEstark":false,"acts":[{"id":923,"rate":15,"condition":0},{"id":924,"rate":15,"condition":0},{"id":925,"rate":20,"condition":0},{"id":907,"rate":10,"condition":2},{"id":906,"rate":10,"condition":2},{"id":454,"rate":10,"condition":2},{"id":908,"rate":10,"condition":2},{"id":90,"rate":10,"condition":2}],"drops":{"normal":{"id":106,"rate":5},"rare":{"id":107,"rate":1}},"elmRes":{"火":70,"水":70,"風":70,"光":70,"闇":70,"雷":30,"混沌":30},"resists":{"Poison":90,"Shock":90,"Fear":100,"Seal":100,"Debuff":90,"InstantDeath":100},"traits":[{"id":52,"level":5},{"id":53,"level":5},{"id":19,"level":5}],"archives":[]},
];

const FIXED_SPECIAL_BOSSES = [
  {"id":902000,"name":"ギルガメッシュ","race":"魔族","rank":300,"minF":300,"hp":10000000,"mp":999999,"atk":65000,"def":50000,"spd":15000,"mag":60000,"mdef":45000,"hit":150,"eva":20,"cri":15,"gold":9999999,"exp":9999999,"actCount":3,"isBoss":true,"isRare":true,"isEstark":true,"isSpecialBoss":true,"acts":[{"id":920,"rate":15,"condition":0},{"id":420,"rate":15,"condition":0},{"id":907,"rate":10,"condition":0},{"id":426,"rate":10,"condition":2},{"id":427,"rate":10,"condition":2},{"id":616,"rate":10,"condition":2},{"id":908,"rate":10,"condition":2},{"id":90,"rate":427,"rate":10,"condition":2},{"id":616,"rate":10,"condition":2},{"id":908,"rate":10,"condition":10,"condition":2},{"id":56,"rate":20,"condition":3},{"id":57,"rate":20,"condition":3},{"id":413,"rate":30,"condition":3}],"drops":{"normal":{"id":106,"rate":50},"rare":{"id":107,"rate":10}},"elmRes":{"火":80,"水":80,"風":80,"光":80,"闇":80,"雷":80,"混沌":0},"resists":{"Poison":90,"Shock":90,"Fear":200,"Seal":200,"Debuff":90,"InstantDeath":200},"traits":[{"id":52,"level":5},{"id":19,"level":10},{"id":23,"level":10}],"archives":[]},
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
