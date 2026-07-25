/* guild_master.js - Adventurer Guild rank, promotion trial and exchange master */
(function(root) {
    'use strict';

    const GUILD_MASTER_DATA = {
        schemaVersion: 5,
        maxOffers: 5,
        ranks: [
            { id: 'G', requiredTotalExp: 0, label: 'Gランク' },
            { id: 'F', requiredTotalExp: 60, label: 'Fランク' },
            { id: 'E', requiredTotalExp: 170, label: 'Eランク' },
            { id: 'D', requiredTotalExp: 340, label: 'Dランク' },
            { id: 'C', requiredTotalExp: 600, label: 'Cランク' },
            { id: 'B', requiredTotalExp: 980, label: 'Bランク' },
            { id: 'A', requiredTotalExp: 1500, label: 'Aランク' },
            { id: 'S', requiredTotalExp: 2200, label: 'Sランク' }
        ],
        promotionTrials: {
            F: {
                id: 'guild_promotion_f',
                fromRank: 'G',
                targetRank: 'F',
                monsterId: 303100,
                name: 'Fランク昇格試験「鉄壁を崩す者」',
                objective: '攻守を切り替える歴戦の試験官を撃破し、実戦任務を任せられる力量を示す。'
            },
            E: {
                id: 'guild_promotion_e',
                fromRank: 'F',
                targetRank: 'E',
                monsterId: 303101,
                name: 'Eランク昇格試験「灼熱の間合い」',
                objective: '自己強化と炎技を使い分ける試験官を破り、長期戦への対応力を示す。'
            },
            D: {
                id: 'guild_promotion_d',
                fromRank: 'E',
                targetRank: 'D',
                monsterId: 303102,
                name: 'Dランク昇格試験「疾風を捉える者」',
                objective: '高い速度と連続攻撃を制し、変化する戦況を捉える判断力を示す。'
            },
            C: {
                id: 'guild_promotion_c',
                fromRank: 'D',
                targetRank: 'C',
                monsterId: 303103,
                name: 'Cランク昇格試験「氷壁の攻略」',
                objective: '高い防御と回復を備えた試験官を攻略し、決定力と継戦能力を示す。'
            },
            B: {
                id: 'guild_promotion_b',
                fromRank: 'C',
                targetRank: 'B',
                monsterId: 303104,
                name: 'Bランク昇格試験「雷霆を越えて」',
                objective: '強化解除と雷撃を操る試験官を退け、上位依頼を率いる実力を示す。'
            },
            A: {
                id: 'guild_promotion_a',
                fromRank: 'B',
                targetRank: 'A',
                monsterId: 303105,
                name: 'Aランク昇格試験「聖域の審判」',
                objective: '攻撃・防御・回復を高水準で操る試験官を破り、英雄級の力量を示す。'
            },
            S: {
                id: 'guild_promotion_s',
                fromRank: 'A',
                targetRank: 'S',
                monsterId: 303106,
                name: 'Sランク昇格試験「極彩の証明」',
                objective: '複数属性と弱体化を使い分ける総試験官を撃破し、最高位冒険者の資格を示す。'
            }
        },
        exchangeEntries: [
            { id: 'seed_hp', itemId: 100, count: 1, cost: 30 },
            { id: 'seed_mp', itemId: 101, count: 1, cost: 30 },
            { id: 'seed_atk', itemId: 102, count: 1, cost: 35 },
            { id: 'seed_mag', itemId: 103, count: 1, cost: 35 },
            { id: 'seed_spd', itemId: 104, count: 1, cost: 35 },
            { id: 'seed_def', itemId: 105, count: 1, cost: 35 },
            { id: 'seed_sp', itemId: 106, count: 1, cost: 80 },
            { id: 'gem_100', gems: 100, cost: 50 },
            { id: 'gem_500', gems: 500, cost: 220 },
            { id: 'reincarnation', itemId: 107, count: 1, cost: 1200, requiredRank: 'A' },
            { id: 'trait_book_sword', itemId: 112, count: 1, cost: 5000 },
            { id: 'trait_book_spear', itemId: 113, count: 1, cost: 5000 },
            { id: 'trait_book_axe', itemId: 114, count: 1, cost: 5000 },
            { id: 'trait_book_dagger', itemId: 115, count: 1, cost: 5000 },
            { id: 'trait_book_bow', itemId: 116, count: 1, cost: 5000 },
            { id: 'trait_book_staff', itemId: 117, count: 1, cost: 5000 },
            { id: 'trait_book_eagle_eye', itemId: 118, count: 1, cost: 10000 },
            { id: 'trait_book_martial_arts', itemId: 119, count: 1, cost: 10000 },
            { id: 'trait_book_spell', itemId: 120, count: 1, cost: 10000 },
            { id: 'trait_book_breath', itemId: 121, count: 1, cost: 10000 },
            { id: 'trait_book_healing', itemId: 122, count: 1, cost: 10000 }
        ]
    };

    root.GUILD_MASTER_DATA = GUILD_MASTER_DATA;
})(globalThis);
