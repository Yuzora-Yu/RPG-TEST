/* abyss_content.js - Abyss region cross-master ID registry.
 * Monster, skill, and item records live in monsters.js, skills.js, and items.js.
 */
(() => {
    'use strict';

    const REGULAR_MONSTER_IDS = Object.freeze([856, 857, 858, 859, 860, 905, 906, 907, 908, 909, 861, 862, 863, 864, 865, 910, 911, 912, 913, 914, 956, 957, 958, 959, 960, 1005, 1006, 1007, 1008, 1009, 961, 962, 963, 964, 965, 1010, 1011, 1012, 1013, 1014, 1056, 1057, 1058, 1059, 1060, 1105, 1106, 1107, 1108, 1109, 1156, 1157, 1158, 1159, 1160]);
    const BOSS_MONSTER_IDS = Object.freeze([302001, 302000, 302010, 302020, 302030, 302040, 302050, 302060, 302070, 502001, 502002, 502003, 502004, 502005, 502006, 302080, 302081, 302082, 302083, 302084, 302100, 302101]);
    const VISTA_SKILL_BOOK_ITEM_IDS = Object.freeze([600101,600119,600200,600202,600300,600400]);


    // 深淵101階以降・訓練所のボス強化でのみ使う正式マスター。
    // 元技と無関係な高位技を混ぜないため、同系統の弱→強だけを明示する。
    const DEEP_BOSS_SKILL_FAMILIES = Object.freeze([
        { id:'physical_single', skillIds:[100,111,113,131,136,148,154,162,167,168] },
        { id:'physical_multihit', skillIds:[102,121,123,124,125,132,134,135,142,147,149,150] },
        { id:'physical_all', skillIds:[119,128,129,130,145,161,163,165] },
        { id:'physical_def_down', skillIds:[107,143] },
        { id:'physical_atk_down', skillIds:[117,144] },
        { id:'physical_fire_single', skillIds:[104,153] },
        { id:'physical_water_single', skillIds:[105,122] },
        { id:'physical_water_all', skillIds:[139] },
        { id:'physical_wind_single', skillIds:[103] },
        { id:'physical_wind_all', skillIds:[127,159] },
        { id:'physical_thunder_single', skillIds:[106,118,158,164] },
        { id:'physical_thunder_all', skillIds:[138,155] },
        { id:'physical_light_single', skillIds:[156] },
        { id:'physical_light_all', skillIds:[126,160] },
        { id:'physical_dark_single', skillIds:[114] },
        { id:'physical_dark_all', skillIds:[137,140] },
        { id:'physical_dark_random', skillIds:[166] },
        { id:'physical_chaos_single', skillIds:[109,157] },
        { id:'magic_fire_single', skillIds:[200,207,213,224,243] },
        { id:'magic_fire_all', skillIds:[204,209,216,223] },
        { id:'magic_fire_random', skillIds:[219,231,233] },
        { id:'magic_water_single', skillIds:[201,229] },
        { id:'magic_water_all', skillIds:[210,217,221,235] },
        { id:'magic_wind_all', skillIds:[202,211,215,222,236] },
        { id:'magic_dark_single', skillIds:[203,208,214,225,247] },
        { id:'magic_dark_random', skillIds:[234] },
        { id:'magic_light_all', skillIds:[205,212,218,227,228] },
        { id:'magic_light_random', skillIds:[232,246] },
        { id:'magic_thunder_single', skillIds:[206] },
        { id:'magic_thunder_all', skillIds:[226,237] },
        { id:'magic_thunder_random', skillIds:[230] },
        { id:'magic_chaos_all', skillIds:[220,238,242,244,245] },
        { id:'magic_chaos_random', skillIds:[239] },
        { id:'magic_arcane_single', skillIds:[240] },
        { id:'magic_arcane_random', skillIds:[241] },
        { id:'magic_arcane_all', skillIds:[248] },
        { id:'breath_fire', skillIds:[300,302,306,310] },
        { id:'breath_water', skillIds:[301,305,307,309] },
        { id:'breath_wind', skillIds:[311] },
        { id:'breath_thunder', skillIds:[304] },
        { id:'breath_light', skillIds:[312] },
        { id:'breath_dark_all', skillIds:[303,313] },
        { id:'breath_dark_random', skillIds:[314] },
        { id:'breath_chaos', skillIds:[308,315] },
        { id:'heal_single', skillIds:[400,401,411,412,417] },
        { id:'heal_all', skillIds:[404,413,416,418] },
        { id:'revive', skillIds:[407,414,419] },
        { id:'cleanse', skillIds:[405,408] },
        { id:'buff_attack', skillIds:[500,508] },
        { id:'buff_defense', skillIds:[501,509] },
        { id:'buff_speed', skillIds:[502] },
        { id:'buff_element', skillIds:[503,504] },
        { id:'buff_magic_self', skillIds:[506] },
        { id:'buff_physical_self', skillIds:[507] },
        { id:'buff_dark_self', skillIds:[510,700101] },
        { id:'debuff_defense', skillIds:[600,602] },
        { id:'debuff_speed', skillIds:[601] },
        { id:'debuff_attack', skillIds:[603,604] },
        { id:'dispel', skillIds:[705] },
        { id:'poison', skillIds:[700,702] },
        { id:'fear', skillIds:[701,711,712,714] },
        { id:'instant_death', skillIds:[706,707,708,709,710,715] }
    ].map(family => Object.freeze({
        id: family.id,
        skillIds: Object.freeze(family.skillIds.slice())
    })));

    // ボスの基礎能力・使用技から役割を判定した後、この範囲からだけ追加特性を選ぶ。
    // 武器専用・探索専用・永続成長特性（58～60）は含めない。
    const DEEP_BOSS_ROLE_TRAIT_POOLS = Object.freeze({
        physical: Object.freeze([10,19,22,46,47,49]),
        magic: Object.freeze([11,19,20,31,50,53]),
        breath: Object.freeze([12,17,19,21,52]),
        tank: Object.freeze([15,16,17,18,20,21,43,51,52]),
        speed: Object.freeze([14,19,22,46,48]),
        support: Object.freeze([13,20,21,52,53])
    });

    const DEEP_BOSS_STATUS_RESIST_KEYS = Object.freeze([
        'Poison','ToxicPoison','Shock','Fear','SkillSeal','SpellSeal','HealSeal','InstantDeath','Debuff','Seal'
    ]);

    // レガシオンのストーリーボス訓練所で使用する正式マスター。
    // 解放判定は各ボスの討伐記録を正本とし、対応する進行フラグも旧セーブ補助として参照する。
    const STORY_BOSS_TRAINING_MASTER = Object.freeze([
        { id:'surface_glad', category:'地上編', monsterIds:[301010], unlockFlag:'firePrismRestored' },
        { id:'surface_elicia', category:'地上編', monsterIds:[301020], unlockFlag:'windVillageCleared' },
        { id:'surface_syris', category:'地上編', monsterIds:[301030], unlockFlag:'waterCityCleared' },
        { id:'surface_leonard', category:'地上編', monsterIds:[301040], unlockFlag:'thunderFortCleared' },
        { id:'surface_lilith', category:'地上編', monsterIds:[301061], unlockFlag:'bigTowerCleared' },
        { id:'surface_jasper', category:'地上編', monsterIds:[301070], unlockFlag:'lightPalaceCleared' },
        { id:'surface_veld', category:'地上編', monsterIds:[301050], unlockFlag:'lightPalaceCleared' },
        { id:'surface_zenon', category:'地上編', monsterIds:[301100], unlockFlag:'darkCastleCleared' },
        { id:'abyss_glen', category:'深淵編', monsterIds:[302000], unlockFlag:'abyssCarmenaGateCleared' },
        { id:'abyss_galeon', category:'深淵編', monsterIds:[302001], unlockFlag:'abyssCarmenaGateCleared' },
        { id:'abyss_leonard', category:'深淵編', monsterIds:[302010], unlockFlag:'abyssLeonardDefeated' },
        { id:'abyss_elicia', category:'深淵編', monsterIds:[302020], unlockFlag:'abyssEliciaDefeated' },
        { id:'abyss_syris', category:'深淵編', monsterIds:[302030], unlockFlag:'abyssSyrisDefeated' },
        { id:'abyss_grad', category:'深淵編', monsterIds:[302040], unlockFlag:'abyssGradDefeated' },
        { id:'abyss_veld', category:'深淵編', monsterIds:[302050], unlockFlag:'abyssVeldDefeated' },
        { id:'abyss_jasper', category:'深淵編', monsterIds:[302060], unlockFlag:'abyssJasperDefeated' },
        { id:'abyss_illuminacia', category:'深淵編', monsterIds:[302070], unlockFlag:'abyssIlluminaciaDefeated' },
        { id:'abyss_azelgarag_final', category:'深淵編', monsterIds:[302101], unlockFlag:'abyssAzelgaragDefeated' }
    ].map(entry => Object.freeze({
        id: entry.id,
        category: entry.category,
        monsterIds: Object.freeze(entry.monsterIds.slice()),
        unlockFlag: entry.unlockFlag || null
    })));

    const STORY_BOSS_TRAINING_DIFFICULTIES = Object.freeze([
        Object.freeze({ id:'floor101', label:'初級', strengthFloor:101, description:'深淵101階相当' }),
        Object.freeze({ id:'floor151', label:'中級', strengthFloor:151, description:'深淵151階相当' }),
        Object.freeze({ id:'floor201', label:'上級', strengthFloor:201, description:'深淵201階相当' }),
        Object.freeze({ id:'floor301', label:'極限', strengthFloor:301, description:'深淵301階相当' })
    ]);

    // 六属性プリズムの進行と、オクタプリズマによるアゼルガラグ戦支援の正式マスター。
    // 戦闘ごとの場当たり計算を避け、会話・報酬・支援効果が同じ正本を参照する。
    const SPIRIT_TRIAL_ELEMENTS = Object.freeze(['火', '水', '風', '雷', '光', '闇']);
    const SPIRIT_TRIALS = Object.freeze({
        火: Object.freeze({ key:'fire', bossId:502001, rewardItemId:701001 }),
        水: Object.freeze({ key:'water', bossId:502002, rewardItemId:701002 }),
        風: Object.freeze({ key:'wind', bossId:502003, rewardItemId:701003 }),
        雷: Object.freeze({ key:'thunder', bossId:502004, rewardItemId:701004 }),
        光: Object.freeze({ key:'light', bossId:502005, rewardItemId:701005 }),
        闇: Object.freeze({ key:'dark', bossId:502006, rewardItemId:701006 })
    });
    const OCTAPRISM_SUPPORT_MASTER = Object.freeze({
        itemId: 701008,
        azelgaragMonsterIds: Object.freeze([302100, 302101]),
        heroCharacterId: 301,
        heroChaosResistanceFloor: 90,
        triggerRate: 0.5,
        avoidImmediateRepeat: true,
        supports: Object.freeze({
            火: Object.freeze({ type:'damage', fx:'fire', maxHpRate:0.04, damageCapByPhase:Object.freeze({ 302100:4000, 302101:6000 }) }),
            水: Object.freeze({ type:'mpRecovery', fx:'ice', maxMpRate:0.15, minimum:1 }),
            風: Object.freeze({ type:'hpRecovery', fx:'wind', maxHpRate:0.18, minimum:1 }),
            雷: Object.freeze({ type:'damageAndDefenseDown', fx:'thunder', maxHpRate:0.03, damageCapByPhase:Object.freeze({ 302100:3200, 302101:4800 }), defenseMultiplier:0.85, turns:1 }),
            光: Object.freeze({ type:'elementResistance', fx:'light', value:50, turns:1 }),
            闇: Object.freeze({ type:'allStatDown', fx:'dark', multiplier:0.9, turns:2, stats:Object.freeze(['atk','def','spd','mag','mdef']) })
        })
    });

    globalThis.ABYSS_REGION_CONTENT = Object.freeze({
        regularMonsterIds: REGULAR_MONSTER_IDS,
        bossMonsterIds: BOSS_MONSTER_IDS,
        skillIds: Object.freeze([700101]),
        itemIds: Object.freeze([701001,701002,701003,701004,701005,701006,701007,701008]),
        spiritItemByElement: Object.freeze({ 火:701001, 水:701002, 風:701003, 雷:701004, 光:701005, 闇:701006 }),
        spiritBossByElement: Object.freeze({ 火:502001, 水:502002, 風:502003, 雷:502004, 光:502005, 闇:502006 }),
        octaprismItemId: 701008,
        chaosFragmentItemId: 701007,
        vistaSkillBookItemIds: VISTA_SKILL_BOOK_ITEM_IDS,
        deepBossSkillFamilies: DEEP_BOSS_SKILL_FAMILIES,
        deepBossRoleTraitPools: DEEP_BOSS_ROLE_TRAIT_POOLS,
        deepBossStatusResistKeys: DEEP_BOSS_STATUS_RESIST_KEYS,
        storyBossTrainingMaster: STORY_BOSS_TRAINING_MASTER,
        storyBossTrainingDifficulties: STORY_BOSS_TRAINING_DIFFICULTIES,
        spiritTrialElements: SPIRIT_TRIAL_ELEMENTS,
        spiritTrials: SPIRIT_TRIALS,
        octaprismSupportMaster: OCTAPRISM_SUPPORT_MASTER
    });
})();
