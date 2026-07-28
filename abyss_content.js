/* abyss_content.js - Abyss region cross-master ID registry.
 * Monster, skill, and item records live in monsters.js, skills.js, and items.js.
 */
(() => {
    'use strict';

    const REGULAR_MONSTER_IDS = Object.freeze([510001, 510002, 510003, 510004, 510005, 510011, 510012, 510013, 510014, 510015, 510021, 510022, 510023, 510024, 510025, 510031, 510032, 510033, 510034, 510035, 510041, 510042, 510043, 510044, 510045, 510051, 510052, 510053, 510054, 510055, 510061, 510062, 510063, 510064, 510065, 510071, 510072, 510073, 510074, 510075, 510081, 510082, 510083, 510084, 510085, 510091, 510092, 510093, 510094, 510095, 510101, 510102, 510103, 510104, 510105]);
    const BOSS_MONSTER_IDS = Object.freeze([511010, 511020, 511030, 511040, 511050, 511060, 511070, 511080, 511090, 511101, 511102, 511103, 511104, 511105, 511106, 512001, 512002, 512003, 512004, 512005, 512100, 512101]);
    const VISTA_SKILL_BOOK_ITEM_IDS = Object.freeze([600101,600119,600200,600202,600300,600400]);

    globalThis.ABYSS_REGION_CONTENT = Object.freeze({
        regularMonsterIds: REGULAR_MONSTER_IDS,
        bossMonsterIds: BOSS_MONSTER_IDS,
        skillIds: Object.freeze([700101]),
        itemIds: Object.freeze([701001,701002,701003,701004,701005,701006,701007,701008]),
        spiritItemByElement: Object.freeze({ 火:701001, 水:701002, 風:701003, 雷:701004, 光:701005, 闇:701006 }),
        spiritBossByElement: Object.freeze({ 火:511101, 水:511102, 風:511103, 雷:511104, 光:511105, 闇:511106 }),
        octaprismItemId: 701008,
        chaosFragmentItemId: 701007,
        vistaSkillBookItemIds: VISTA_SKILL_BOOK_ITEM_IDS
    });
})();
