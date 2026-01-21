const ACHIEVEMENTS_DATA = [
    // --- 1. 主人公レベル (Type: LV) ---
    { id: 101, type: "LV", goal: 5, title: "駆け出し冒険者", desc: "主人公のレベルが5に到達", rewards: [
			{ type: 'EQUIP', eid: 21, plus: 3, // 武器ID:1 を+3で付与
            opts: [
                { key: 'atk',  val: 10, rarity: 'UR' },
                { key: 'atk',  val: 10, rarity: 'UR' },
                { key: 'elmAtk', elm: '雷', val: 10, rarity: 'UR' }],
			traits: [{ id: 1, level: 3 },{ id: 11, level: 3 }] 
			}
        ] },
    { id: 102, type: "LV", goal: 20, title: "熟練の剣筋", desc: "主人公のレベルが20に到達", rewards: [
            { type: 'GEM', val: 500 },
            { type: 'GOLD', val: 5000 }
        ] },
    { id: 103, type: "LV", goal: 50, title: "伝説の胎動", desc: "主人公のレベルが50に到達", rewards: [
            { type: 'GEM', val: 1000 },
			{ type: 'ITEM', id: 6, val: 5 }
        ] },
    { id: 104, type: "LV", goal: 100, title: "深淵の到達者", desc: "主人公のレベルが100に到達", rewards: [
            { type: 'GEM', val: 3000 },
            { type: 'GOLD', val: 10000 }
        ] },

    // --- 2. 最大ダメージ (Type: DMG) ---
    { id: 201, type: "DMG", goal: 100, title: "重い一撃", desc: "最大ダメージ 100突破", rewards: [
            { type: 'GEM', val: 100 }
        ] },
    { id: 202, type: "DMG", goal: 1000, title: "必殺の極意", desc: "最大ダメージ 1,000突破", rewards: [
            { type: 'GEM', val: 500 }
        ] },
    { id: 203, type: "DMG", goal: 10000, title: "神殺しの権能", desc: "最大ダメージ 10,000突破", rewards: [
            { type: 'GEM', val: 1000 }
        ] },
    { id: 204, type: "DMG", goal: 100000, title: "魔神の一撃", desc: "最大ダメージ 100,000突破", rewards: [
            { type: 'GEM', val: 1000 }
        ] },

    // --- 3. 到達階層 (Type: FLOOR) ---
    { id: 301, type: "FLOOR", goal: 11, title: "深淵の入り口", desc: "ダンジョン 11階に到達", rewards: [
            { type: 'GEM', val: 100 }
        ] },
    { id: 302, type: "FLOOR", goal: 31, title: "中層の覇者", desc: "ダンジョン 31階に到達", rewards: [
            { type: 'GEM', val: 500 }
        ] },
    { id: 303, type: "FLOOR", goal: 51, title: "奈落を識る者", desc: "ダンジョン 51階に到達", rewards: [
            { type: 'GEM', val: 1000 }
        ] },
    { id: 304, type: "FLOOR", goal: 101, title: "奈落を識る者", desc: "ダンジョン 101階に到達", rewards: [
            { type: 'GEM', val: 3000 },
			{ type: 'ITEM', id: 107, val: 1 }
        ] },

    // --- 4. ストーリー進行度 (Type: STORY) ---
    { id: 401, type: "STORY", goal: 2, title: "旅立ちの決意", desc: "ストーリー進行度 2に到達", rewards: [
            { type: 'GEM', val: 3000 },
            { type: 'GOLD', val: 10000 }
        ] },
    { id: 402, type: "STORY", goal: 5, title: "世界の真実", desc: "ストーリー進行度 5に到達", rewards: [
            { type: 'GEM', val: 3000 },
            { type: 'GOLD', val: 10000 }
        ] },

    // --- 5. 鍛冶屋レベル (Type: SMITH) ---
    { id: 501, type: "SMITH", goal: 2, title: "見習い職人", desc: "鍛冶屋レベル 2に到達", rewards: [
            { type: 'GEM', val: 200 }
        ] },
    { id: 502, type: "SMITH", goal: 5, title: "名匠の称号", desc: "鍛冶屋レベル 5に到達", rewards: [
            { type: 'GEM', val: 500 }
        ] },

    // --- 6. 魔物図鑑 (Type: BOOK) ---
    { id: 601, type: "BOOK", goal: 10, title: "魔物学者", desc: "魔物図鑑を10種類埋める", rewards: [
            { type: 'GEM', val: 100 }
        ] },
    { id: 602, type: "BOOK", goal: 50, title: "モンスターハンター", desc: "魔物図鑑を50種類埋める", rewards: [
            { type: 'GEM', val: 100 }
        ] },

    // --- 7. 累計所持ゴールド (Type: GOLD) ---
    { id: 701, type: "GOLD", goal: 100000, title: "貯金家", desc: "累計所持ゴールド 100,000突破", rewards: [
            { type: 'GEM', val: 100 }
        ] },
    { id: 702, type: "GOLD", goal: 1000000, title: "大富豪", desc: "累計所持ゴールド 1,000,000突破", rewards: [
            { type: 'GEM', val: 100 }
        ] },
];