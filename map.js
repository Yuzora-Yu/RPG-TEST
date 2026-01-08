/* map.js - ワールドマップ・固定ダンジョン・エリア定義 */

const STORY_DATA = {
    areas: {
        'START_VILLAGE': { name: '始まりの村', rank: 1,   centerX: 58,  centerY: 64 },
        'FIRE_VILLAGE':  { name: '炎の里',     rank: 10,  centerX: 98,  centerY: 50 },
        'WIND_VILLAGE':  { name: '風の集落',   rank: 20,  centerX: 99,  centerY: 38 },
        'WATER_CITY':    { name: '水上都市',   rank: 30,  centerX: 69,  centerY: 22 },
        'BIG_TOWER':     { name: '大灯台',     rank: 30,  centerX: 22,  centerY: 80 },
        'THUNDER_FORT':  { name: '雷の要塞',   rank: 40,  centerX: 46,  centerY: 37 },
        'LIGHT_PALACE':  { name: '光の宮殿',   rank: 50,  centerX: 68,  centerY: 49 },
        'DARK_CASTLE':   { name: '魔王城',     rank: 60,  centerX: 9,   centerY: 51 },
        'ABYSS':         { name: '深淵の魔窟', rank: 70,  centerX: 52,  centerY: 56 },
        'RUINED_SHRINE': { name: '朽ちた祠',   rank: 300, centerX: 59,  centerY: 57 }, // エスターク用
        'MEDAL':         { name: 'メダル王',   rank: 1,   centerX: 38,  centerY: 48 },
        'CASINO':        { name: 'カジノ',     rank: 1,   centerX: 33,  centerY: 19 }
    }
};

// auto-generated from provided map image
// size: W110 x H90
// G:草原, W:海/川, F:森, L:山, M:岩山(進入不可）
// I:町/里/祠, E:交換所, K:カジノ, D:魔窟

const MAP_DATA = [
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwgggggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwgggggggggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwgggggggggggggggwwwwwwwggggffffffwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwgggggwwwwwwwwwggggggggggggggggggwwwwwwwwwwggggffffffwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwggEgggggggggggggggggggggggggggggwwwwwwwwwwwwwwggggggffffgwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwggggggggggggggggggggggggggggggggwwwwwwwwwwwwwwwwwwwwggggggggwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwgggggggggggggggwwwwwwwggggwwwwwwwwwwwgggggggwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwggggggggggggwwwwggggiggwwwwwwwwwwwgggggggwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwfgggggggggggggggggwwwwwwwwwwwwwwggggggwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmfffffggggggggggwwwwwwwwwwwwwwwwggggggwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmfffffggggggwwwwwwwwwwwwwwwwwggggggwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmfffffgggggwwwwwwwwwwwwwwgwggggggggwwwggwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmfffffggggggggggggggggggggggggwgggggggggwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmwwwwwwmmmmmmfffffggggggggggggggggggggwwwwggggggggggfffwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmwwwwwwmmmmmfffffggggggggggggggggggwwwwwggggggggffffffwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmmmwwwwwmmmmmmfffffggggggggggggggwwwwwgggggggggfffffffffwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmmmgwwwwwwwmmmmmffffffffgggggmmmgwwwwwggggggggffffffffffffwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmmgggggwwwwwwmmmmmmfffffffffmmmmgwwwwwggggggffffffffffffffffwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmllggmmmmwwwwwwmmmmmmfffffffmmmmwwwwwwggggggffffffffffffmmmffwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmlllggmmmmmmmwwwwwwmmmmmmmffmmmmmwwwwwwggggggfffffffffffmmmmfffwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmlllllggggggmmmmmwwwwwwwmmmmmmmmmmwwwwwwgggggggfffffffffffmmmmfffffwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmllllllggggggggmmmmmmwwwwwwwmmmmmmwwwwwwwggggggffffffffffffmmmmmgfffwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmlllllllggggigggggfmmmmmwwwwwwwwmmmwwwwwwgggggggffffffffffffmmmmgggggwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmllllllllgggggggggffffmmmmmwwwwwwwwwwwwwmggggggfffffffffffffmmmmggiggwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwmmmmmllllllllllllggggggffffffffmmmmwwwwwwwwwwwmmmgggffffffffffffffmmmmgggggwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwmmmmllllllllllllllmmmmgffffffffffmmmmmwwwwwwwwmmmmmmggfffmmmmfffffmmmmmggggwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwmmmmmlllllllllllllmmmmmffffffffffffffmmmmwwwwwwwwmmmmmmmmmmmmffffffmmmmggggwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwmmmmmllllllllllllllmmmmmffffffffffffffffmmmmwwwwwwwmmmmmmmmmmmfffffmmmmmggwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwmmmmmllllllllllllllmmmmmmffffffffffffffffffmmmmmwwwwwwmmmmmmmmffffffmmmmmwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwmmmmllllllllllllllllmmmmmfffffffffffffffffffffmmmmmwwwwwwmmmmmmmffffmmmmmmwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwmmmmmmmllllllllllllllmmmmmmgfffffffffffggggggggggggmmmmmmwwwwwmmmmmfffffffmmmmmmmmmwwwwwwwwwwwwwww",
"wwwwwwwwwwmmmmmmmlllllllllllllllmmmmmggggggffffffggggggggggggggggmmmmmwwwwwwmmmgfffffffmmmmmmmmmmmmmmwwwwwwwww",
"wwwwwwwwmmmmmmmgggggllllllllllmmmmgggggggggggggggggggggggggggggggggmmmmwwwwwwmgggfffffffffgmmmmmmmmmmmmmmwwwww",
"wwwwwwwmmmmggggggggggglllllmmmmmmggggkgggggggggggggggggggggggggggggggmmmmwwwwwgggggffffffffggggmmmmmmmmmwwwwww",
"wwwwwwmmmmgggggggggggggmmmmmmmmmmmmggggggggggggggggffffggggggggggggiggmmmmmwwwggggggggggggggggggggggmmmmwwwwww",
"wwwwwmmmggggggggggggmmmmmmmmmmmmmmmmmmmmmmgggggggggggffffggggggggggggmmmmmmmwwwggggggggggggggggggigmmmmwwwwwww",
"wwwwmmggiggggggggmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmggggffffgggggggggmmmmmmmmmwwwggggggggggggggggggggmmmmwwwwwww",
"wwwgggggggggggggmmmmmmwwwwwmmmmmmmmmmmmmmmmmmmmmmmmmmgggggggggggmmmmmmmmfmmmmwwggggggggggggggggggllmmmwwwwwwww",
"wwwwggggggggggmmmmmwwwwwwwwwwwwwwgggmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmffffffmmwwgggggggggggggggglllmmmmwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwggggggggmmmmmmmmmmmmmmmmmmmmmmmfffffffffffwwwgggggggggggggglllmmmmwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwggggggggggggggggmmmmmmmmmmmmggggffmmmffffwwwgggggggggggglllllmmmmwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwgggggggggggggggdggmmmmmmgggggggmmmmmmffffwwwggggggggggllllllmmmmwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwgggmmgggggggggggmmmmmmigggggmmmmmmmfffffgwwwgggggggglllllllmmmmmwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwgmmmmmmggggggmmmmmmmmmmmmmmmmmmmffffffgggwwwgggggglllllllmmmmmwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwggmmmmmmmmgmmmmmmmmwmmmmmmmmmmffffffggggggggggggllllllmmmmmmmwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwggggmmmmmmmmmmmmmmmmwmmmmmmmffffffffgggggggggglllllllmmmmmmmmmwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwggggmmmmmmmmmmmmmmmmmwmmmmfffffffffffggggggfwwllllllmmmmmmmmmmwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwgmmmmmmmmmmmmmmmmmmmmwwgfffffffffgggggggggffwwllmmmmmmmmmmwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmmmmmmmmmmmmmmffgwwwggggggggggggggggggfffwwmmmmmmmmmmwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmmmmmmmmmmmmmfffffgwwggggggggggggggggggfffwwwwmmmmmmwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmmmmmmmmmmmmffffffggwgggigggggggggggggffffwwwwwmmmwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmmmmmmmmmlllfffffgggwwggggggggggggggggffffwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmmmmmmllllllfffffggggwggggggggggggggfffffwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmmmmllllllllllffgggggwgggggggggggggfffffwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwmmmmmmllllllllllllllgggggggwggggggggggffffffwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwmmmmmlllllllllllllggggggggggggggggggggfffffwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwmmmmllllllllllggggggggggggggggggggggggffffwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwgmmmlllllllggggggggfffgggggggggwgggggggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwgggglllllgggggggffffffffggggggggwggggggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwgggggggggggggggfffffffffffgggggggwgggggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwggggggggggggggffffffgggfffffggggggwgggggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwgggggggggggggffffffggggggffgggggggwggggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwgggggggggggggffffgggggwwggggggggggwwgggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwgggggggggggffffgggggwwwwwgggggggggwggggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwggggggggggggffggggwwwwwwwwwwgggggggwggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwgggggIggggggggggwwwwwwwwwwwwwwwwggggwggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwgggggggggggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwgggggggggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwgggggggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwggggwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
"wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
];

const FIXED_MAPS = {
    'START_VILLAGE': {
        name: '始まりの村',
        width: 15,
        height: 12,
		
		// ★追加: 街に入った時の初期座標 (出口Sの少し上などに設定)
        entryPoint: { x: 7, y: 9 },
		
		// ★戦闘背景の追加 (村の中で戦う場合)
        battleBg: 'battle_bg_field',
		
        // G:床, W:壁, S:出口, V:長老(イベント), I:宿屋/ショップ, H:家 , D:ダンジョン入口
        tiles: [
            "WWWWWWWWWWWWWWW",
            "WHGHGWWWGGGDGWW",
            "WGGGGWWWWGGGGGW",
            "WGGWWWVWWWWGGGW", // 中央奥に長老の家
            "WGGWHGGGHEWGGGW",
            "WGGIGGGGGGGGGGS", // 左に宿屋、右にショップ
            "WGGGGGGGGGGGGGS",
            "WGGWWGGGGWWGGGW",
            "WHGGGGGGGGGGKGW",
            "WHGGGGGGGGGGGGW",
            "WWWWWWSSWWWWWWW", // 下のSからフィールドへ
            "WWWWWWWWWWWWWWW"
        ],
        // ワールドマップへ出る際の帰還座標
        exitPoint: { area: 'WORLD', x: 58, y: 65 } 
    }
};


// 固定ダンジョンの定義
const FIXED_DUNGEON_MAPS = {
    'START_CAVE': {
        name: '試練の洞窟',
        rank: 5,
        width: 15,
        height: 15,
        entryPoint: { x: 8, y: 13 },
        battleBg: 'battle_bg_maze',
        // G:床, W:壁, S:階段, C:宝箱, B:ボス
        tiles: [
            "WWWWWWWWWWWWWWW",
            "WBGGGGGGGGGGWCW", // (13, 1) に宝箱
            "WGGWWWWGWWWWWGW",
            "WWWWGGGGWGGGGGW",
            "WGWWWWWGWWWWWGW",
            "WGGGGGGGGGGGGGW",
            "WWWWWWWWWGWWWWW",
            "WCWGGGGCWGGGGGW", // (1, 7) と (8, 7) に宝箱
            "WGWGWWWWWWWWWGW",
            "WGWGGGGGGGGGGGW",
            "WGWWWWWWWWWGWWW",
            "WGGGGGGGGGGGGGW",
            "WWWWWWWGGWWWWWW",
            "WWWWWWWSSWWWWWW",
            "WWWWWWWWWWWWWWW"
        ],
        // ★追加: 固定宝箱のアイテム設定
        chests: [
            { x: 13, y: 1, itemId: 106, type: 'item' }, // スキルのたね
            { x: 1, y: 7, itemId: 2, type: 'item' },   // 上やくそう
            { x: 7, y: 7, itemId: 3, type: 'item' }    // 魔法の小瓶
        ],
		// ★追加: 出現するモンスターのIDリストを指定
        monsters: [1, 1.01, 1.5, 2, 2.01, 2.5, 3, 3.01, 4],
		// ★追加: 固定ボスの設定
        bosses: [
            { x: 1, y: 1, monsterId: 1010 }
        ]
    }
};
    // 今後、FIRE_MOUNTAIN, WATER_TEMPLE などが増えていく
