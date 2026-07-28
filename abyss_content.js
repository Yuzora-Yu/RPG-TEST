/* abyss_content.js - Abyss region cross-master ID registry.
 * Monster, skill, and item records live in monsters.js, skills.js, and items.js.
 */
(() => {
    'use strict';

    const REGULAR_MONSTER_IDS = Object.freeze([856, 857, 858, 859, 860, 905, 906, 907, 908, 909, 861, 862, 863, 864, 865, 910, 911, 912, 913, 914, 956, 957, 958, 959, 960, 1005, 1006, 1007, 1008, 1009, 961, 962, 963, 964, 965, 1010, 1011, 1012, 1013, 1014, 1056, 1057, 1058, 1059, 1060, 1105, 1106, 1107, 1108, 1109, 1156, 1157, 1158, 1159, 1160]);
    const BOSS_MONSTER_IDS = Object.freeze([302001, 302000, 302010, 302020, 302030, 302040, 302050, 302060, 302070, 502001, 502002, 502003, 502004, 502005, 502006, 302080, 302081, 302082, 302083, 302084, 302100, 302101]);
    const VISTA_SKILL_BOOK_ITEM_IDS = Object.freeze([600101,600119,600200,600202,600300,600400]);

    globalThis.ABYSS_REGION_CONTENT = Object.freeze({
        regularMonsterIds: REGULAR_MONSTER_IDS,
        bossMonsterIds: BOSS_MONSTER_IDS,
        skillIds: Object.freeze([700101]),
        itemIds: Object.freeze([701001,701002,701003,701004,701005,701006,701007,701008]),
        spiritItemByElement: Object.freeze({ 火:701001, 水:701002, 風:701003, 雷:701004, 光:701005, 闇:701006 }),
        spiritBossByElement: Object.freeze({ 火:502001, 水:502002, 風:502003, 雷:502004, 光:502005, 闇:502006 }),
        octaprismItemId: 701008,
        chaosFragmentItemId: 701007,
        vistaSkillBookItemIds: VISTA_SKILL_BOOK_ITEM_IDS
    });
})();
