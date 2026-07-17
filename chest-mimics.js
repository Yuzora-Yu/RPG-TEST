/* chest-mimics.js - 宝箱トラップ専用モンスターと階層選定の正本 */
(() => {
    'use strict';

    const CHEST_MIMIC_IDS = Object.freeze({
        rank50: 120301,
        rank120: 120302,
        rank170: 120303
    });

    const CHEST_MIMICS = Object.freeze([
        {
            id: CHEST_MIMIC_IDS.rank50,
            name: '貪欲箱グラット',
            race: '無生物',
            rank: 50,
            minF: 40,
            hp: 760,
            mp: 180,
            atk: 148,
            def: 158,
            spd: 92,
            mag: 142,
            mdef: 146,
            hit: 112,
            eva: 6,
            cri: 12,
            gold: 1800,
            exp: 1500,
            actCount: 2,
            isElite: true,
            isChestTrap: true,
            isBoss: false,
            isRare: false,
            image: 'assets/monsters/chest-mimics/monster_120301.png',
            drops: {
                normal: { id: 99, rate: 100 },
                rare: { id: 102, rate: 5 }
            },
            elmRes: { '火': 10, '水': 10, '雷': -20, '風': 10, '光': -10, '闇': 30, '混沌': 20 },
            resists: { Poison: 70, ToxicPoison: 70, Shock: 40, Fear: 100, Seal: 60, Debuff: 35, InstantDeath: 100 },
            traits: [],
            archives: ['深淵の宝箱に擬態する魔物。蓋を開けた獲物を二度の連撃で仕留める。'],
            acts: [
                { id: 1, rate: 45, condition: 0 },
                { id: 113, rate: 25, condition: 0 },
                { id: 500, rate: 15, condition: 0 },
                { id: 701, rate: 15, condition: 0 }
            ]
        },
        {
            id: CHEST_MIMIC_IDS.rank120,
            name: '呪宝箱パンドラ',
            race: '無生物',
            rank: 120,
            minF: 120,
            hp: 2680,
            mp: 420,
            atk: 372,
            def: 410,
            spd: 276,
            mag: 402,
            mdef: 398,
            hit: 125,
            eva: 12,
            cri: 16,
            gold: 8500,
            exp: 14000,
            actCount: 2,
            isElite: true,
            isChestTrap: true,
            isBoss: false,
            isRare: false,
            image: 'assets/monsters/chest-mimics/monster_120302.png',
            drops: {
                normal: { id: 99, rate: 100 },
                rare: { id: 104, rate: 5 }
            },
            elmRes: { '火': 25, '水': 25, '雷': 10, '風': 10, '光': -20, '闇': 50, '混沌': 40 },
            resists: { Poison: 85, ToxicPoison: 85, Shock: 65, Fear: 100, Seal: 80, Debuff: 50, InstantDeath: 100 },
            traits: [],
            archives: ['古い宝物庫の呪念を吸った鋼の擬態箱。攻撃と呪術を同時に操る。'],
            acts: [
                { id: 1, rate: 35, condition: 0 },
                { id: 149, rate: 20, condition: 0 },
                { id: 225, rate: 20, condition: 0 },
                { id: 604, rate: 15, condition: 0 },
                { id: 238, rate: 10, condition: 2 }
            ]
        },
        {
            id: CHEST_MIMIC_IDS.rank170,
            name: '深淵宝匣アケロン',
            race: '無生物',
            rank: 170,
            minF: 170,
            hp: 4680,
            mp: 720,
            atk: 590,
            def: 628,
            spd: 402,
            mag: 638,
            mdef: 652,
            hit: 138,
            eva: 18,
            cri: 20,
            gold: 28000,
            exp: 42000,
            actCount: 2,
            isElite: true,
            isChestTrap: true,
            isBoss: false,
            isRare: false,
            image: 'assets/monsters/chest-mimics/monster_120303.png',
            drops: {
                normal: { id: 99, rate: 100 },
                rare: { id: 106, rate: 5 }
            },
            elmRes: { '火': 45, '水': 45, '雷': 35, '風': 35, '光': 10, '闇': 70, '混沌': 60 },
            resists: { Poison: 95, ToxicPoison: 95, Shock: 85, Fear: 100, Seal: 95, Debuff: 70, InstantDeath: 100 },
            traits: [],
            archives: ['深層の混沌が宝匣を核に実体化したもの。二度の行動で獲物の退路を断つ。'],
            acts: [
                { id: 1, rate: 30, condition: 0 },
                { id: 161, rate: 20, condition: 0 },
                { id: 238, rate: 20, condition: 0 },
                { id: 315, rate: 15, condition: 2 },
                { id: 705, rate: 15, condition: 0 }
            ]
        }
    ]);

    const clone = value => JSON.parse(JSON.stringify(value));
    const byId = id => CHEST_MIMICS.find(monster => Number(monster.id) === Number(id)) || null;
    const getForFloor = floor => {
        const value = Math.max(1, Number(floor) || 1);
        if (value >= 170) return CHEST_MIMICS[2];
        if (value >= 120) return CHEST_MIMICS[1];
        return CHEST_MIMICS[0];
    };

    const target = Array.isArray(window.MONSTERS_DATA) ? window.MONSTERS_DATA : [];
    CHEST_MIMICS.forEach(monster => {
        if (!target.some(existing => Number(existing.id) === Number(monster.id))) target.push(clone(monster));
    });
    window.MONSTERS_DATA = target;

    if (window.MonsterData) {
        const originalGetMonsterById = window.MonsterData.getMonsterById?.bind(window.MonsterData);
        CHEST_MIMICS.forEach(monster => {
            if (Array.isArray(window.MonsterData.allBases) && !window.MonsterData.allBases.some(existing => Number(existing.id) === Number(monster.id))) {
                window.MonsterData.allBases.push(target.find(existing => Number(existing.id) === Number(monster.id)) || clone(monster));
            }
        });
        window.MonsterData.chestTrapMonsters = target.filter(monster => monster.isChestTrap);
        window.MonsterData.getChestTrapById = id => clone(byId(id));
        window.MonsterData.getChestTrapForFloor = floor => clone(getForFloor(floor));
        window.MonsterData.getMonsterById = id => {
            const chestTrap = target.find(monster => monster.isChestTrap && Number(monster.id) === Number(id));
            return chestTrap || originalGetMonsterById?.(id) || null;
        };
    }

    window.CHEST_MIMIC_DATA = Object.freeze({
        version: '2026-07-17-v001',
        normalChestChance: 0.05,
        minimumAbyssFloor: 40,
        ids: CHEST_MIMIC_IDS,
        monsters: CHEST_MIMICS,
        getById: id => clone(byId(id)),
        getForFloor: floor => clone(getForFloor(floor))
    });
})();
