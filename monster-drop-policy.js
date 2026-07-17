/* monster-drop-policy.js - one maintainable source of truth for normal enemy item drops */
(() => {
    'use strict';

    const monsters = Array.isArray(window.MONSTERS_DATA) ? window.MONSTERS_DATA : [];
    const catalog = window.PRISMA_ITEM_CATALOG;
    if (!catalog || monsters.length === 0) return;

    const raceMaterialPools = Object.freeze({
        '機械': [0], '無生物': [0],
        '植物': [1],
        '精霊': [2, 3, 6],
        '獣': [4, 5, 3], '獣人': [4, 5, 3],
        '竜': [4, 0], '竜人': [4, 0],
        '粘体': [6],
        '死霊': [7, 2],
        '魔族': [7, 2, 4],
        '人': [0, 1, 3]
    });
    const stableNumber = monster => Math.abs(Number(monster?.id || 0));
    const monsterRank = monster => Math.max(1, Number(monster?.rank || monster?.minF || 1));
    const materialCategoryIndex = monster => {
        const pool = raceMaterialPools[monster?.race] || [7];
        return pool[stableNumber(monster) % pool.length];
    };
    const recoveryTypes = new Set(['HP回復', 'MP回復', '状態異常回復', '蘇生']);
    const combatTypes = ['攻撃道具', '強化道具', '弱体道具'];
    const chooseNearestRank = (pool, rank, salt, allowance = 10) => {
        const eligible = pool.filter(item =>
            item.medalOnly !== true &&
            item.shopAvailable !== false &&
            Number(item.rank || 1) <= rank + allowance
        );
        if (eligible.length === 0) return null;
        const nearestRank = Math.max(...eligible.map(item => Number(item.rank || 1)));
        const band = eligible.filter(item => Number(item.rank || 1) >= Math.max(1, nearestRank - 10));
        return band[salt % band.length] || null;
    };
    const recoveryDropFor = (monster, rareSlot = false) => {
        const rank = monsterRank(monster);
        const salt = stableNumber(monster);
        const fullPool = monsters.length && Array.isArray(window.ITEMS_DATA)
            ? window.ITEMS_DATA.filter(item => recoveryTypes.has(item.type) && Number(item.price || 0) > 0)
            : [];
        const corePool = fullPool.filter(item => item.type === 'HP回復' || item.type === 'MP回復');
        // Opening drops should directly sustain exploration. Status cures and
        // revival items enter later instead of crowding out herbs and MP bottles.
        const pool = rank <= 25 || salt % 4 !== 0 ? corePool : fullPool;
        const allowance = rareSlot ? 15 : (rank <= 5 ? 0 : 5);
        const selected = chooseNearestRank(pool, rank, salt + (rareSlot ? 7 : 0), allowance);
        return Number(selected?.id || 1);
    };
    const combatDropFor = (monster, gradeIndex, rareSlot = false) => {
        const rank = monsterRank(monster);
        const salt = stableNumber(monster) + (rareSlot ? 11 : 0);
        const preferredType = combatTypes[(Math.floor(salt / 3) + gradeIndex) % combatTypes.length];
        const preferred = catalog.combatItems.filter(item => item.type === preferredType);
        const fallback = catalog.combatItems.filter(item => combatTypes.includes(item.type));
        const selected = chooseNearestRank(preferred, rank, salt, rareSlot ? 20 : 10)
            || chooseNearestRank(fallback, rank, salt, rareSlot ? 20 : 10);
        return Number(selected?.id || recoveryDropFor(monster, rareSlot));
    };
    const itemDropFor = (monster, gradeIndex, rareSlot = false) => {
        const rank = monsterRank(monster);
        const salt = stableNumber(monster) + (rareSlot ? 1 : 0);
        // Early enemies primarily supply the recovery loop. Combat consumables
        // begin appearing from the middle bands and grow into a meaningful minority.
        const useCombat = rank > 25 && salt % 3 === 0;
        return useCombat
            ? combatDropFor(monster, gradeIndex, rareSlot)
            : recoveryDropFor(monster, rareSlot);
    };

    let rareCount = 0;
    let normalCount = 0;
    let eliteCount = 0;
    const distribution = {
        normal: { material: 0, recovery: 0, combat: 0, growth: 0 },
        rare: { material: 0, recovery: 0, combat: 0, growth: 0 }
    };
    monsters.forEach(monster => {
        // 宝箱トラップは chest-mimics.js の固有報酬を維持する。
        if (!monster || monster.isChestTrap || monster.isBoss || monster.isSpecialBoss || monster.isEstark) return;
        const rank = monsterRank(monster);
        const gradeIndex = catalog.getMaterialGradeIndexForRank(rank);

        if (monster.isRare) {
            monster.drops = {
                normal: { id: 99, rate: 100 },
                rare: { id: 100 + (stableNumber(monster) % 7), rate: 5 }
            };
            rareCount += 1;
            return;
        }

        const categoryIndex = materialCategoryIndex(monster);
        const salt = stableNumber(monster);
        // About half of normal enemies drop materials. The first five bands use
        // a 1/3 material split so herbs and magic bottles support the opening.
        const normalIsMaterial = rank <= 25 ? salt % 3 === 0 : salt % 2 === 0;
        const normalId = normalIsMaterial
            ? catalog.getMaterialItemId(categoryIndex, gradeIndex)
            : itemDropFor(monster, gradeIndex, false);
        let rareId = normalIsMaterial
            ? itemDropFor(monster, gradeIndex, true)
            : catalog.getMaterialItemId(categoryIndex, Math.min(7, gradeIndex + 1));
        const isElite = Number(monster.actCount || 1) >= 2;
        if (isElite) {
            // Each ten-rank band has one two-action elite. Its rare slot is a
            // stat-growth item, explicitly excluding reincarnation item 107.
            const band = Math.max(0, Math.floor((rank - 1) / 10));
            rareId = 100 + ((band + salt) % 7);
            eliteCount += 1;
        }
        const normalItem = window.ITEMS_DATA.find(item => Number(item.id) === normalId);
        const rareItem = window.ITEMS_DATA.find(item => Number(item.id) === rareId);
        const classify = item => item?.type === '素材'
            ? 'material'
            : (item?.type === '育成' ? 'growth' : (combatTypes.includes(item?.type) ? 'combat' : 'recovery'));
        distribution.normal[classify(normalItem)] += 1;
        distribution.rare[classify(rareItem)] += 1;
        monster.drops = {
            // 通常雑魚の基準値。解体などの特性補正は戦闘終了時にこの設定値へ加算する。
            normal: { id: normalId, rate: Math.min(15, 12 + Math.floor(gradeIndex / 2)) },
            rare: { id: rareId, rate: Math.min(5, 2 + Math.floor(gradeIndex / 2)) }
        };
        normalCount += 1;
    });

    window.PRISMA_MONSTER_DROP_POLICY = Object.freeze({
        version: '2026-07-17-balanced-items-v3-drop-rates',
        rareCount,
        normalCount,
        eliteCount,
        distribution: Object.freeze({
            normal: Object.freeze({ ...distribution.normal }),
            rare: Object.freeze({ ...distribution.rare })
        }),
        raceMaterialPools,
        materialCategoryIndex
    });
})();
