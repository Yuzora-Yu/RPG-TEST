const ACHIEVEMENTS_DATA = [
    // --- 1. 主人公レベル (Type: LV) ---

	//テストデータ
    //{ id: 100, type: "LV", goal: 1, title: "テスト装備配布用実績", desc: "主人公のレベルが1に到達", rewards: [
	//		{ type: 'EQUIP', eid: 701, plus: 3, // 武器ID:701 を+3で付与
    //        opts: [
    //            { key: 'elmAtk', elm: '雷', val: 25, rarity: 'EX' },
    //            { key: 'elmAtk', elm: '雷', val: 25, rarity: 'EX' },
    //            { key: 'elmAtk', elm: '雷', val: 25, rarity: 'EX' }],
	//		traits: [{ id: 1, level: 10 },{ id: 10, level: 10 },{ id: 26, level: 10 },{ id: 58, level: 20 },{ id: 59, level: 20 },{ id: 60, level: 20 }] 
	//		}
    //    ] },
		
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
	
	//追加案（判定ロジック未作成）
	
	//転生回数
	{ id: 701, type: "REBIRTH", goal: 1, title: "新たなる始まり", desc: "転生を1回行う", rewards:[{type:'GEM', val:1000}] },
	{ id: 702, type: "REBIRTH", goal: 5, title: "輪廻の探究者", desc: "転生を5回行う", rewards:[{type:'GEM', val:2000}] },
	{ id: 703, type: "REBIRTH", goal: 20, title: "永劫回帰", desc: "転生を20回行う", rewards:[{type:'GEM', val:3000},{type:'ITEM', id:107, val:1}] },
	
	//Estark討伐回数（BOSS）
	{ id: 801, type: "BOSS", goal: 1, title: "災厄への挑戦", desc: "災厄の王を1体討伐", rewards:[{type:'GEM', val:3000}] },
	{ id: 802, type: "BOSS", goal: 10, title: "災厄を撃ち払う者", desc: "災厄の王を10体討伐", rewards:[{type:'GEM', val:3000}] },
	{ id: 803, type: "BOSS", goal: 50, title: "災厄の征服者", desc: "災厄の王を50体討伐", rewards:[{type:'EQUIP', eid:801 , plus: 3}] },

	//仲間人数（ALLY）
	{ id: 901, type: "ALLY", goal: 5, title: "小さな仲間たち", desc: "仲間を5人集める", rewards:[{type:'GEM', val:300}] },
	{ id: 902, type: "ALLY", goal: 10, title: "冒険者ギルド", desc: "仲間を10人集める", rewards:[{type:'GEM', val:900}] },
	{ id: 903, type: "ALLY", goal: 25, title: "英雄団", desc: "仲間を25人集める", rewards:[{type:'GEM', val:1500},{type:'ITEM', id:6, val:5}] },

	//累計ダンジョン踏破数（RUN）
	{ id: 1001, type: "RUN", goal: 50, title: "探索者", desc: "ダンジョンに50回挑戦", rewards:[{type:'GEM', val:1000}] },
	{ id: 1002, type: "RUN", goal: 200, title: "深層常連", desc: "ダンジョンに200回挑戦", rewards:[{type:'GEM', val:1000}] },

	//小さなメダル（MEDAL）
	{ id: 1101, type: "MEDAL", goal: 10, title: "収集癖", desc: "小さなメダルを10枚集める", rewards:[{type:'GEM', val:500},{type:'ITEM', id:5, val:5}] },
	{ id: 1102, type: "MEDAL", goal: 50, title: "蒐集家", desc: "小さなメダルを50枚集める", rewards:[{type:'GEM', val:500},{type:'ITEM', id:14, val:5}] },
	{ id: 1103, type: "MEDAL", goal: 100, title: "伝説の蒐集家", desc: "小さなメダルを10枚集める00枚集める", rewards:[{type:'GEM', val:1000},{type:'ITEM', id:100, val:5}] },

	//装備厳選系（HACK）
	{ id: 1201, type: "EQUIP", goal: 1, title: "極意の発現", desc: "EXオプション付き装備を入手", rewards:[{type:'GEM', val:500}] },
	{ id: 1202, type: "EQUIP", goal: 3, title: "共鳴", desc: "シナジー装備を3個完成", rewards:[{type:'GEM', val:1000}] },

];