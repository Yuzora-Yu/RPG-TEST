/* chest-mimics.js - 宝箱トラップの出現条件。個体データの正本は monsters.js。 */
(() => {
    'use strict';

    const CHEST_MIMIC_IDS = Object.freeze({
        rank70: 120301,
        rank140: 120302,
        rank190: 120303
    });

    const clone = value => value ? JSON.parse(JSON.stringify(value)) : null;
    const getById = id => {
        if (window.MonsterData?.getChestTrapById) return window.MonsterData.getChestTrapById(id);
        return clone((window.MONSTERS_DATA || []).find(monster => monster.isChestTrap && Number(monster.id) === Number(id)));
    };
    const getForFloor = floor => {
        if (window.MonsterData?.getChestTrapForFloor) return window.MonsterData.getChestTrapForFloor(floor);
        const value = Math.max(1, Number(floor) || 1);
        return getById(value >= 151 ? CHEST_MIMIC_IDS.rank190 : value >= 101 ? CHEST_MIMIC_IDS.rank140 : CHEST_MIMIC_IDS.rank70);
    };

    window.CHEST_MIMIC_DATA = Object.freeze({
        version: '2026-07-18-v003-elite-floor-bands',
        normalChestChance: 0.05,
        minimumAbyssFloor: 51,
        ids: CHEST_MIMIC_IDS,
        get monsters() {
            return Object.values(CHEST_MIMIC_IDS).map(getById).filter(Boolean);
        },
        getById,
        getForFloor
    });
})();
