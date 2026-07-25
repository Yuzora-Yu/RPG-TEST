/* audio_manifest.js - BGM / SE asset slots. Silent OGG placeholders are bundled for direct replacement. */
(function() {
    const bgm = (src, title, group, loop = true) => ({ src, title, group, loop, enabled: true });
    const se = (src, title, group, cooldownMs = 0) => ({ src, title, group, cooldownMs, enabled: true });

    const BGM = {
        field_world: bgm('assets/audio/bgm/bgm_field_world.ogg', '世界フィールド', 'field'),
        field_abyss_outer: bgm('assets/audio/bgm/bgm_field_abyss_outer.ogg', '深淵の魔窟 外縁', 'field'),
        field_ship: bgm('assets/audio/bgm/bgm_field_ship.ogg', '船で移動中', 'field'),
        field_wing: bgm('assets/audio/bgm/bgm_field_wing.ogg', '翼で飛行中', 'field'),

        town_start_village: bgm('assets/audio/bgm/bgm_town_start_village.ogg', 'リュミナ村', 'town'),
        town_fire_village: bgm('assets/audio/bgm/bgm_town_fire_village.ogg', '炎の里イグニシア', 'town'),
        town_wind_village: bgm('assets/audio/bgm/bgm_town_wind_village.ogg', '風の集落カザリア', 'town'),
        town_water_city: bgm('assets/audio/bgm/bgm_town_water_city.ogg', '水上都市リヴァリア', 'town'),
        base_big_tower: bgm('assets/audio/bgm/bgm_base_big_tower.ogg', '大灯台', 'base'),
        base_thunder_fort: bgm('assets/audio/bgm/bgm_base_thunder_fort.ogg', 'ライザーク要塞', 'base'),
        base_light_palace: bgm('assets/audio/bgm/bgm_base_light_palace.ogg', '光の宮殿グランプリズマ', 'base'),
        base_dark_castle: bgm('assets/audio/bgm/bgm_base_dark_castle.ogg', '魔王城ガルヴァニア', 'base'),

        dungeon_start_cave: bgm('assets/audio/bgm/bgm_dungeon_start_cave.ogg', 'はじまりの洞窟', 'dungeon'),
        dungeon_ignis_volcano: bgm('assets/audio/bgm/bgm_dungeon_ignis_volcano.ogg', 'イグナ火山', 'dungeon'),
        dungeon_forbidden_forest: bgm('assets/audio/bgm/bgm_dungeon_forbidden_forest.ogg', '禁忌の森', 'dungeon'),
        dungeon_wind_temple: bgm('assets/audio/bgm/bgm_dungeon_wind_temple.ogg', '風の神殿', 'dungeon'),
        dungeon_seabed_temple: bgm('assets/audio/bgm/bgm_dungeon_seabed_temple.ogg', '海底神殿', 'dungeon'),
        dungeon_big_tower: bgm('assets/audio/bgm/bgm_dungeon_big_tower.ogg', '大灯台 上層', 'dungeon'),
        dungeon_thunder_fort: bgm('assets/audio/bgm/bgm_dungeon_thunder_fort.ogg', 'ライザーク要塞 内部', 'dungeon'),
        dungeon_light_palace: bgm('assets/audio/bgm/bgm_dungeon_light_palace.ogg', '光の宮殿 内部', 'dungeon'),
        dungeon_galvania_cave: bgm('assets/audio/bgm/bgm_dungeon_galvania_cave.ogg', 'ガルヴァニア洞窟', 'dungeon'),
        dungeon_dark_castle: bgm('assets/audio/bgm/bgm_dungeon_dark_castle.ogg', '魔王城 内部', 'dungeon'),
        dungeon_forest_wind_hole: bgm('assets/audio/bgm/bgm_dungeon_forest_wind_hole.ogg', '森の風穴', 'dungeon'),
        dungeon_crena_limestone: bgm('assets/audio/bgm/bgm_dungeon_crena_limestone.ogg', 'クレナ鍾乳洞', 'dungeon'),
        dungeon_dark_shrine: bgm('assets/audio/bgm/bgm_dungeon_dark_shrine.ogg', '闇の神殿跡地', 'dungeon'),
        dungeon_grezelia: bgm('assets/audio/bgm/bgm_dungeon_grezelia.ogg', '禁則地グレゼリア', 'dungeon'),
        dungeon_ruined_shrine: bgm('assets/audio/bgm/bgm_dungeon_ruined_shrine.ogg', '朽ちた祠', 'dungeon'),
        dungeon_trial_island: bgm('assets/audio/bgm/bgm_dungeon_trial_island.ogg', '試練の島', 'dungeon'),
        dungeon_summit_temple: bgm('assets/audio/bgm/bgm_dungeon_summit_temple.ogg', '山頂神殿', 'dungeon'),
        dungeon_abyss: bgm('assets/audio/bgm/bgm_dungeon_abyss.ogg', '深淵の魔窟', 'dungeon'),

        facility_inn: bgm('assets/audio/bgm/bgm_facility_inn.ogg', '宿屋', 'facility'),
        facility_shop: bgm('assets/audio/bgm/bgm_facility_shop.ogg', '商店', 'facility'),
        facility_blacksmith: bgm('assets/audio/bgm/bgm_facility_blacksmith.ogg', '鍛冶屋', 'facility'),
        facility_alchemy: bgm('assets/audio/bgm/bgm_facility_alchemy.ogg', '錬金所', 'facility'),
        facility_casino: bgm('assets/audio/bgm/bgm_facility_casino.ogg', 'カジノ', 'facility'),
        facility_medal: bgm('assets/audio/bgm/bgm_facility_medal.ogg', 'メダル交換所', 'facility'),

        battle_normal: bgm('assets/audio/bgm/bgm_battle_normal.ogg', '通常戦闘', 'battle'),
        battle_midboss: bgm('assets/audio/bgm/bgm_battle_midboss.ogg', '中ボス戦闘', 'battle'),
        battle_bigboss: bgm('assets/audio/bgm/bgm_battle_bigboss.ogg', '大ボス戦闘', 'battle'),
        battle_finalboss: bgm('assets/audio/bgm/bgm_battle_finalboss.ogg', 'ラスボス戦闘', 'battle'),
        battle_secretboss: bgm('assets/audio/bgm/bgm_battle_secretboss.ogg', '裏ボス戦闘', 'battle'),
        battle_wipeout: bgm('assets/audio/bgm/bgm_battle_wipeout.ogg', '全滅時', 'battle')
    };

    const SE = {
        event_effect: se('assets/audio/se/se_event_effect.ogg', 'イベントエフェクト', 'event'),
        heal: se('assets/audio/se/se_heal.ogg', '回復', 'event'),
        heal_spring: se('assets/audio/se/se_heal_spring.ogg', '回復の泉', 'event'),
        chest_open: se('assets/audio/se/se_chest_open.ogg', '宝箱開封', 'field'),
        floor_move: se('assets/audio/se/se_floor_move.ogg', 'フロア移動', 'field'),
        stairs: se('assets/audio/se/se_stairs.ogg', '階段移動', 'field'),
        warp: se('assets/audio/se/se_warp.ogg', 'ワープ床', 'field'),
        damage_floor: se('assets/audio/se/se_damage_floor.ogg', 'ダメージ床', 'field', 120),
        switch: se('assets/audio/se/se_switch.ogg', 'スイッチ起動', 'field'),
        ice_slide: se('assets/audio/se/se_ice_slide.ogg', '氷床', 'field', 100),
        wall_bump: se('assets/audio/se/se_wall_bump.ogg', '壁衝突', 'field', 130),

        menu_confirm: se('assets/audio/se/se_menu_confirm.ogg', 'メニュー決定', 'ui', 35),
        menu_cancel: se('assets/audio/se/se_menu_cancel.ogg', 'メニューキャンセル／戻る', 'ui', 35),
        dialogue: se('assets/audio/se/se_dialogue.ogg', '会話送り', 'ui', 45),
        ui_item_heal: se('assets/audio/se/se_ui_item_heal.ogg', '道具使用（回復系）', 'ui', 45),
        ui_item_move: se('assets/audio/se/se_ui_item_move.ogg', '道具使用（移動系）', 'ui', 45),
        ui_item_growth: se('assets/audio/se/se_ui_item_growth.ogg', '道具使用（育成系）', 'ui', 45),
        ui_skill_heal_revive: se('assets/audio/se/se_ui_skill_heal_revive.ogg', 'スキル使用（回復・蘇生）', 'ui', 45),
        ui_blacksmith_start: se('assets/audio/se/se_ui_blacksmith_start.ogg', '鍛冶開始', 'ui'),
        ui_alchemy_start: se('assets/audio/se/se_ui_alchemy_start.ogg', '錬金開始', 'ui'),
        ui_shop_buy: se('assets/audio/se/se_ui_shop_buy.ogg', '購入', 'ui', 45),
        ui_shop_sell: se('assets/audio/se/se_ui_shop_sell.ogg', '売却', 'ui', 45),

        encounter_start: se('assets/audio/se/se_encounter_start.ogg', '戦闘開始', 'battle'),
        battle_attack: se('assets/audio/se/se_battle_attack.ogg', '通常攻撃', 'battle', 45),
        battle_skill_magic: se('assets/audio/se/se_battle_skill_magic.ogg', '魔法スキル発動', 'battle', 45),
        battle_skill_breath: se('assets/audio/se/se_battle_skill_breath.ogg', 'ブレススキル発動', 'battle', 45),
        battle_skill_physical: se('assets/audio/se/se_battle_skill_physical.ogg', '物理スキル発動', 'battle', 45),
        battle_skill_other: se('assets/audio/se/se_battle_skill_other.ogg', 'その他スキル発動', 'battle', 45),
        battle_item: se('assets/audio/se/se_battle_item.ogg', '戦闘中のアイテム使用', 'battle', 45),
        battle_damage: se('assets/audio/se/se_battle_damage.ogg', 'ダメージ', 'battle', 35),
        battle_heal: se('assets/audio/se/se_battle_heal.ogg', '戦闘中の回復', 'battle', 70),
        battle_critical: se('assets/audio/se/se_battle_critical.ogg', 'クリティカルダメージ', 'battle', 45),
        battle_victory: se('assets/audio/se/se_battle_victory.ogg', '戦闘勝利', 'battle'),
        battle_level_up: se('assets/audio/se/se_battle_level_up.ogg', 'レベルアップ', 'battle')
    };

    const AREA_BGM = {
        START_VILLAGE: 'town_start_village',
        FIRE_VILLAGE: 'town_fire_village',
        WIND_VILLAGE: 'town_wind_village',
        WATER_CITY: 'town_water_city',
        ABYSS_FIELD: 'field_abyss_outer',
        START_CAVE: 'dungeon_start_cave',
        IGNIS_VOLCANO: 'dungeon_ignis_volcano',
        FORBIDDEN_FOREST: 'dungeon_forbidden_forest',
        WIND_TEMPLE: 'dungeon_wind_temple',
        SEABED_TEMPLE: 'dungeon_seabed_temple',
        BIG_TOWER: 'dungeon_big_tower',
        THUNDER_FORT: 'dungeon_thunder_fort',
        LIGHT_PALACE: 'dungeon_light_palace',
        GALVANIA_CAVE: 'dungeon_galvania_cave',
        DARK_CASTLE: 'dungeon_dark_castle',
        FOREST_WIND_HOLE: 'dungeon_forest_wind_hole',
        CRENA_LIMESTONE_CAVE: 'dungeon_crena_limestone',
        DARK_SHRINE_RUINS: 'dungeon_dark_shrine',
        GREZELIA_FORBIDDEN: 'dungeon_grezelia',
        RUINED_SHRINE: 'dungeon_ruined_shrine',
        TRIAL_ISLAND: 'dungeon_trial_island',
        SUMMIT_TEMPLE: 'dungeon_summit_temple',
        ABYSS: 'dungeon_abyss'
    };

    const BASE_FLOOR_BGM = {
        BIG_TOWER: 'base_big_tower',
        THUNDER_FORT: 'base_thunder_fort',
        LIGHT_PALACE: 'base_light_palace',
        DARK_CASTLE: 'base_dark_castle'
    };

    window.AUDIO_MANIFEST = { BGM, SE, AREA_BGM, BASE_FLOOR_BGM };
})();
