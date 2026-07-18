/* assets.js: Prisma Abyss 画像管理の統一入口
 * ============================================================================
 * 2026-05-13 方針変更
 * ----------------------------------------------------------------------------
 * 今後の画像パス管理はこのファイルに統一します。
 * polish.js から GRAPHICS.data へ Object.assign で画像を流し込む方式は、
 * どのファイルが画像の正本なのか分からなくなるため廃止しました。
 *
 * Codex等で編集する際の注意:
 * - マップ/戦闘背景/主人公歩行画像を追加・変更する場合は PRISMA_ASSETS.graphics を編集。
 * - 戦闘エフェクト画像を追加・変更する場合は PRISMA_ASSETS.battleFx を編集。
 * - polish.js 側に画像パス一覧を再作成しないこと。
 * - Base64画像の大量埋め込みは避け、原則として assets/ 配下の画像ファイルを参照すること。
 *
 * Service Worker 側の注意:
 * - 2026-05-14時点では、初回表示品質を優先し、初回起動時に画像もまとめてキャッシュする。
 * - ただし画像リストの正本はこの assets.js。sw.js 側に巨大な画像配列を再作成しないこと。
 * - 将来、画像軽量化・分割ロード方針に戻す場合も、まずこの cacheWarmup 定義を変更する。
 * ============================================================================
 */


// ---------------------------------------------------------------------------
// 起動体験を損なわないための画像キャッシュ定義
// ---------------------------------------------------------------------------
// 今後の画像管理はこの assets.js に統一します。
// Service Worker はこの一覧を main.js / sw.js から参照する。
// sw.js 側にモンスター画像やエフェクト画像の全量リストを直接復活させないこと。
//
// 現在の方針:
// - 初回起動時に画像をまとめてキャッシュし、ロード画面・初戦闘・ガチャ・施設背景の
//   「初回だけ画像が出ない/遅れる」体験を避ける。
// - ただし、正本はこの assets.js。Android化や画像軽量化時もここを編集する。
// - main.js は startupImages をローディング中に先読みし、sw.js は installImages を初回キャッシュする。
const PRISMA_NORMAL_MONSTER_IMAGE_IDS = Array.from({ length: 90 }, (_, i) => 100001 + i)
  .concat(Array.from({ length: 16 }, (_, i) => 200001 + i));
const PRISMA_BOSS_MONSTER_IMAGE_IDS = [
  200201, 200202, 200203, 200204,
  301000, 301001, 301002, 301010, 301011, 301012, 301020, 301021, 301022, 301030, 301031, 301032, 301040, 301050, 301060, 301061, 301062, 301070, 301080, 301081, 301082, 301100,
  302201, 302202, 302203, 302204, 302205, 302206, 302207, 302208,
  401010, 401020, 401030, 401040, 401050, 401060, 401070, 401080, 401081, 401082, 401090, 401100, 401110, 401120, 401130, 401140, 401150, 401151, 401152, 401153, 401160, 401161, 401162, 401170, 401180, 401190, 401200,
  502049, 502098,
  902000,
];
const PRISMA_MONSTER_IMAGE_FILES = PRISMA_NORMAL_MONSTER_IMAGE_IDS
  .concat(PRISMA_BOSS_MONSTER_IMAGE_IDS)
  .map((id) => `assets/monsters/monster_${id}.png`);

// Runtime-ready but not yet placed/assigned map visual libraries.
// The manifest under assets/map/library is the metadata source of truth.
const PRISMA_MAP_CHIP_LIBRARY_GROUPS = {
  village: ["wildflowers", "medicinal_herbs", "mushroom_patch", "hay_bundle", "fence_post", "roadside_sign", "clay_jar", "mossy_stone", "firewood_stack"],
  forest: ["ancient_stump", "exposed_roots", "fern_patch", "red_mushrooms", "fallen_log", "lichen_boulder", "twisted_sapling", "vine_stone", "glowing_fungus", "decayed_roadside_sign"],
  cave: ["stalagmite", "rock_pile", "purple_crystals", "mineral_puddle", "pale_mushrooms", "bone_pile", "mine_support", "miner_cart", "spring_vent"],
  volcanic: ["lava_vent", "obsidian_shards", "ember_fissure", "ritual_brazier", "scorched_bones", "sulfur_crystals", "molten_boulder", "ash_heap", "fire_rune_stone"],
  water: ["puddle_ripple", "branching_coral", "shell_cluster", "seaweed_clump", "broken_column", "sea_anemone", "sunken_urn", "bubble_vent", "starfish_debris"],
  thunder: ["control_terminal", "cable_coil", "broken_conduit", "lightning_capacitor", "battery_cell", "floor_grate", "gear_assembly", "warning_beacon", "transformer_coil"],
  light: ["crystal_pedestal", "prism_cluster", "gold_inlay", "luminous_flower", "marble_urn", "mirror_stand", "sun_altar", "star_mosaic", "marble_rubble"],
  dark: ["iron_candelabrum", "chain_pile", "horned_skull", "gargoyle_statue", "black_crystals", "sealed_obelisk", "broken_armor", "blue_brazier", "ritual_rune"],
  tower: ["gear_assembly", "rope_coil", "hand_winch", "oil_lamp", "reinforced_crate", "weathered_barrel", "brass_pipe", "lens_fragment", "iron_anchor"],
  ruins: ["broken_column", "ancient_tablet", "void_crystals", "black_roots", "ritual_brazier", "masonry_pile", "weathered_rune", "bone_lantern", "prism_shard"],
};
// OPより前に戦う、開幕ジェリーと始まりの洞穴の通常敵・ボスを起動前に取得する。
const PRISMA_PRE_OP_MONSTER_IMAGE_FILES = [100001, 100002, 100003, 100004, 301000]
  .map((id) => `assets/monsters/monster_${id}.png`);

const PRISMA_ASSETS = {
  // Field.render / Battle 背景 / 主人公歩行画像で使う GRAPHICS 用画像。
  graphics: {
    opening_prism_collapse: "assets/generated/opening-prism-collapse-v002.png",
    item_icon_attack: "assets/ui/menu-icons/item-attack-v001.png",
    item_icon_buff: "assets/ui/menu-icons/item-buff-v001.png",
    item_icon_debuff: "assets/ui/menu-icons/item-debuff-v001.png",
    item_icon_material: "assets/ui/menu-icons/item-material-v001.png",
    item_icon_vehicle: "assets/ui/menu-icons/item-vehicle-v001.png",
    item_icon_travel: "assets/ui/menu-icons/item-travel-v001.png",
    item_icon_heal: "assets/ui/menu-icons/item-heal-v001.png",
    item_icon_revive: "assets/ui/menu-icons/item-revive-v001.png",
    item_icon_growth: "assets/ui/menu-icons/item-growth-v001.png",
    item_icon_key: "assets/ui/menu-icons/item-key-v001.png",
    monster_120301: "assets/monsters/monster_120301.png",
    monster_120302: "assets/monsters/monster_120302.png",
    monster_120303: "assets/monsters/monster_120303.png",
    floor: "assets/map/terrain/terrain_grass_field_v001.png",
    sea: "assets/map/terrain/terrain_sea_v001.png",
    forest: "assets/map/objects/object_field_forest_v003.png",
    mountain: "assets/map/objects/object_field_mountain_v002.png",
    Low_mountain: "assets/map/objects/object_field_low_mountain_v002.png",
    wall: "assets/map/terrain/terrain_dungeon_wall_v001.png",
    wall_face: "assets/map/terrain/terrain_dungeon_wall_face_v002.png",
    wall_face_torch: "assets/map/terrain/terrain_dungeon_wall_face_torch_v002.png",
    tile_fire_wall_face: "assets/map/terrain/tile_fire_wall_face_v001.png",
    tile_wind_temple_wall_face: "assets/map/terrain/tile_wind_temple_wall_face_v001.png",
    tile_wind_hole_wall_face: "assets/map/terrain/tile_wind_hole_wall_face_v001.png",
    tile_tower_wall_face: "assets/map/terrain/tile_tower_wall_face_v001.png",
    tile_thunder_wall_face: "assets/map/terrain/tile_thunder_wall_face_v001.png",
    tile_dark_castle_wall_face: "assets/map/terrain/tile_dark_castle_wall_face_v001.png",
    tile_galvania_wall_face: "assets/map/terrain/tile_galvania_wall_face_v001.png",
    tile_grezelia_wall_face: "assets/map/terrain/tile_grezelia_wall_face_v001.png",
    magma: "assets/map/terrain/magma.png",
    dungeon_floor: "assets/map/terrain/terrain_dungeon_floor_v001.png",
    stairs: "assets/map/objects/object_field_stairs_v002.png",
    stairs_dungeon: "assets/map/objects/object_dungeon_stairs_v002.png",
    cave: "assets/map/objects/object_field_cave_v002.png",
    cave_dungeon: "assets/map/terrain/terrain_dungeon_floor_v001.png",
    hall: "assets/map/objects/object_field_hall_v002.png",
    "house-1": "assets/map/objects/object_field_house_1_v002.png",
    "house-2": "assets/map/objects/object_field_house_2_v002.png",
    village: "assets/map/objects/object_field_village_v002.png",
    inn: "assets/map/objects/object_field_inn_v002.png",
    casino: "assets/map/objects/object_field_casino_v002.png",
    weapon: "assets/map/objects/object_field_weapon_v002.png",
    shop: "assets/map/objects/object_field_shop_v002.png",
    medal: "assets/map/objects/object_field_medal_v002.png",
    town: "assets/map/objects/object_field_town_v002.png",
    settlement: "assets/map/objects/object_field_settlement_v002.png",
    castle: "assets/map/objects/object_field_castle_v002.png",
    temple: "assets/map/objects/object_field_temple_v002.png",
    fortress: "assets/map/objects/object_field_fortress_v002.png",
    ruins: "assets/map/objects/object_field_ruins_v002.png",
    lost: "assets/map/objects/object_field_lost_v002.png",
    darkcastle: "assets/map/objects/object_field_darkcastle_v002.png",
    lighthouse: "assets/map/objects/object_field_lighthouse_v002.png",
    tower: "assets/map/objects/object_field_tower_v002.png",
    farm: "assets/map/objects/object_field_farm_v002.png",
    pot_grass: "assets/map/objects/object_field_pot_v002.png",
    barrel_grass: "assets/map/objects/object_field_barrel_v002.png",
    chest: "assets/map/objects/object_field_chest_v002.png",
    chest_rare: "assets/map/objects/object_field_chest_rare_v002.png",
    chest_dungeon: "assets/map/objects/object_dungeon_chest_v002.png",
    chest_rare_dungeon: "assets/map/objects/object_dungeon_chest_rare_v002.png",
    smith: "assets/map/objects/object_field_smith_v002.png",
    fire_village: "assets/map/objects/object_field_fire_village_v002.png",
    dummy_grass: "assets/map/objects/object_field_grass_v002.png",
    boss: "assets/map/objects/object_field_boss_v002.png",
    boss_dungeon: "assets/map/objects/object_dungeon_boss_v002.png",

    // 固定ダンジョン用オーバーレイ。
    // 床タイルを先に描画し、その上へ重ねるための画像。差し替えはこのパスだけでOK。
    overlay_named_dungeon_boss: "assets/map/overlays/overlay_named_dungeon_boss.png",
    overlay_named_dungeon_chest_rare: "assets/map/overlays/overlay_named_dungeon_chest_rare.png",
    overlay_named_dungeon_chest: "assets/map/overlays/overlay_named_dungeon_chest.png",
    overlay_named_dungeon_stairs_down: "assets/map/overlays/overlay_named_dungeon_stairs_down.png",
    overlay_named_dungeon_stairs_up: "assets/map/overlays/overlay_named_dungeon_stairs_up.png",

    // 固定MAP/ワールド表示用オーバーレイ（床の上に重ねる画像）。
    overlay_field_barrel: "assets/map/overlays/overlay_field_barrel_v002.png",
    overlay_field_boss: "assets/map/overlays/overlay_field_boss_v002.png",
    overlay_field_casino: "assets/map/overlays/overlay_field_casino_v002.png",
    overlay_field_castle: "assets/map/overlays/overlay_field_castle_v002.png",
    overlay_field_cave: "assets/map/overlays/overlay_field_cave_v002.png",
    overlay_field_chest: "assets/map/overlays/overlay_field_chest_v002.png",
    overlay_field_chest_rare: "assets/map/overlays/overlay_field_chest_rare_v002.png",
    overlay_field_darkcastle: "assets/map/overlays/overlay_field_darkcastle_v002.png",
    overlay_field_event: "assets/map/overlays/overlay_field_event_v002.png",
    overlay_event_blue_glimmer: "assets/map/overlays/overlay_event_blue_glimmer_v001.png",
    overlay_field_farm: "assets/map/overlays/overlay_field_farm_v002.png",
    overlay_field_fire_village: "assets/map/overlays/overlay_field_fire_village_v002.png",
    overlay_field_forest: "assets/map/overlays/overlay_field_forest_v006.png",
    overlay_field_fortress: "assets/map/overlays/overlay_field_fortress_v002.png",
    overlay_field_grass: "assets/map/overlays/overlay_field_grass_v002.png",
    overlay_field_hall: "assets/map/overlays/overlay_field_hall_v002.png",
    overlay_field_house_1: "assets/map/overlays/overlay_field_house_1_v002.png",
    overlay_field_house_2: "assets/map/overlays/overlay_field_house_2_v002.png",
    overlay_field_inn: "assets/map/overlays/overlay_field_inn_v002.png",
    overlay_field_lighthouse: "assets/map/overlays/overlay_field_lighthouse_v002.png",
    overlay_field_lost: "assets/map/overlays/overlay_field_lost_v002.png",
    overlay_field_low_mountain: "assets/map/overlays/overlay_field_low_mountain_v002.png",
    overlay_field_medal: "assets/map/overlays/overlay_field_medal_v002.png",
    overlay_field_mountain: "assets/map/overlays/overlay_field_mountain_v002.png",
    overlay_field_pot: "assets/map/overlays/overlay_field_pot_v002.png",
    overlay_field_ruins: "assets/map/overlays/overlay_field_ruins_v002.png",
    overlay_field_settlement: "assets/map/overlays/overlay_field_settlement_v002.png",
    overlay_field_shop: "assets/map/overlays/overlay_field_shop_v002.png",
    overlay_field_smith: "assets/map/overlays/overlay_field_smith_v002.png",
    overlay_field_stairs: "assets/map/overlays/overlay_field_stairs_v002.png",
    overlay_field_temple: "assets/map/overlays/overlay_field_temple_v002.png",
    overlay_field_tower: "assets/map/overlays/overlay_field_tower_v002.png",
    overlay_field_town: "assets/map/overlays/overlay_field_town_v002.png",
    overlay_field_village: "assets/map/overlays/overlay_field_village_v002.png",
    overlay_field_weapon: "assets/map/overlays/overlay_field_weapon_v002.png",
    overlay_decor_default_cave_dust: "assets/map/overlays/overlay_decor_default_cave_dust_v001.png",
    overlay_decor_start_village_herbs: "assets/map/overlays/overlay_decor_start_village_herbs_v001.png",
    overlay_decor_start_cave_damp: "assets/map/overlays/overlay_decor_start_cave_damp_v001.png",
    overlay_decor_fire_ember_fissure: "assets/map/overlays/overlay_decor_fire_ember_fissure_v001.png",
    overlay_decor_wind_village_feather: "assets/map/overlays/overlay_decor_wind_village_feather_v001.png",
    overlay_decor_wind_hole_root: "assets/map/overlays/overlay_decor_wind_hole_root_v001.png",
    overlay_decor_forbidden_forest_moss: "assets/map/overlays/overlay_decor_forbidden_forest_moss_v001.png",
    overlay_decor_water_city_puddle: "assets/map/overlays/overlay_decor_water_city_puddle_v001.png",
    overlay_decor_big_tower_gear_oil: "assets/map/overlays/overlay_decor_big_tower_gear_oil_v001.png",
    overlay_decor_thunder_fort_wiring: "assets/map/overlays/overlay_decor_thunder_fort_wiring_v001.png",
    overlay_decor_light_palace_prism: "assets/map/overlays/overlay_decor_light_palace_prism_v001.png",
    overlay_decor_galvania_crystal: "assets/map/overlays/overlay_decor_galvania_crystal_v001.png",
    overlay_decor_dark_castle_chain: "assets/map/overlays/overlay_decor_dark_castle_chain_v001.png",
    overlay_decor_crena_limestone_pool: "assets/map/overlays/overlay_decor_crena_limestone_pool_v001.png",
    overlay_decor_seabed_temple_ripple: "assets/map/overlays/overlay_decor_seabed_temple_ripple_v001.png",
    overlay_decor_dark_shrine_sigil: "assets/map/overlays/overlay_decor_dark_shrine_sigil_v001.png",
    overlay_decor_grezelia_fossil: "assets/map/overlays/overlay_decor_grezelia_fossil_v001.png",
    overlay_decor_abyss_void_dust: "assets/map/overlays/overlay_decor_abyss_void_dust_v001.png",
    overlay_decor_abyss_field_flora: "assets/map/overlays/overlay_decor_abyss_field_flora_v001.png",
    overlay_decor_ruined_shrine_glyph: "assets/map/overlays/overlay_decor_ruined_shrine_glyph_v001.png",
    overlay_castle_carpet_fill: "assets/map/overlays/overlay_castle_carpet_fill_v001.png",
    overlay_castle_carpet_edge_n: "assets/map/overlays/overlay_castle_carpet_edge_n_v001.png",
    overlay_castle_carpet_edge_s: "assets/map/overlays/overlay_castle_carpet_edge_s_v001.png",
    overlay_castle_carpet_edge_w: "assets/map/overlays/overlay_castle_carpet_edge_w_v001.png",
    overlay_castle_carpet_edge_e: "assets/map/overlays/overlay_castle_carpet_edge_e_v001.png",
    overlay_castle_carpet_corner_nw: "assets/map/overlays/overlay_castle_carpet_corner_nw_v001.png",
    overlay_castle_carpet_corner_ne: "assets/map/overlays/overlay_castle_carpet_corner_ne_v001.png",
    overlay_castle_carpet_corner_sw: "assets/map/overlays/overlay_castle_carpet_corner_sw_v001.png",
    overlay_castle_carpet_corner_se: "assets/map/overlays/overlay_castle_carpet_corner_se_v001.png",
    overlay_castle_carpet_blue_silver_fill: "assets/map/overlays/overlay_castle_carpet_blue_silver_fill_v001.png",
    overlay_castle_carpet_blue_silver_edge_n: "assets/map/overlays/overlay_castle_carpet_blue_silver_edge_n_v001.png",
    overlay_castle_carpet_blue_silver_edge_s: "assets/map/overlays/overlay_castle_carpet_blue_silver_edge_s_v001.png",
    overlay_castle_carpet_blue_silver_edge_w: "assets/map/overlays/overlay_castle_carpet_blue_silver_edge_w_v001.png",
    overlay_castle_carpet_blue_silver_edge_e: "assets/map/overlays/overlay_castle_carpet_blue_silver_edge_e_v001.png",
    overlay_castle_carpet_blue_silver_corner_nw: "assets/map/overlays/overlay_castle_carpet_blue_silver_corner_nw_v001.png",
    overlay_castle_carpet_blue_silver_corner_ne: "assets/map/overlays/overlay_castle_carpet_blue_silver_corner_ne_v001.png",
    overlay_castle_carpet_blue_silver_corner_sw: "assets/map/overlays/overlay_castle_carpet_blue_silver_corner_sw_v001.png",
    overlay_castle_carpet_blue_silver_corner_se: "assets/map/overlays/overlay_castle_carpet_blue_silver_corner_se_v001.png",
    overlay_village_goza_fill: "assets/map/overlays/overlay_village_goza_fill_v001.png",
    overlay_village_goza_edge_n: "assets/map/overlays/overlay_village_goza_edge_n_v001.png",
    overlay_village_goza_edge_s: "assets/map/overlays/overlay_village_goza_edge_s_v001.png",
    overlay_village_goza_edge_w: "assets/map/overlays/overlay_village_goza_edge_w_v001.png",
    overlay_village_goza_edge_e: "assets/map/overlays/overlay_village_goza_edge_e_v001.png",
    overlay_village_goza_corner_nw: "assets/map/overlays/overlay_village_goza_corner_nw_v001.png",
    overlay_village_goza_corner_ne: "assets/map/overlays/overlay_village_goza_corner_ne_v001.png",
    overlay_village_goza_corner_sw: "assets/map/overlays/overlay_village_goza_corner_sw_v001.png",
    overlay_village_goza_corner_se: "assets/map/overlays/overlay_village_goza_corner_se_v001.png",
    overlay_world_grass_detail: "assets/map/overlays/overlay_world_grass_detail_v001.png",
    overlay_world_grass_weeds: "assets/map/overlays/overlay_world_grass_weeds_v001.png",
    overlay_world_grass_earth: "assets/map/overlays/overlay_world_grass_earth_v001.png",
    overlay_world_forest_understory: "assets/map/overlays/overlay_world_forest_understory_v001.png",
    overlay_world_forest_roots: "assets/map/overlays/overlay_world_forest_roots_v001.png",
    overlay_world_foothill_rocks: "assets/map/overlays/overlay_world_foothill_rocks_v001.png",
    overlay_world_shore_foam: "assets/map/overlays/overlay_world_shore_foam_v001.png",
    overlay_world_bridge_wood: "assets/map/overlays/overlay_world_bridge_wood_v001.png",
    overlay_dungeon_boss: "assets/map/overlays/overlay_dungeon_boss_v002.png",
    overlay_dungeon_chest: "assets/map/overlays/overlay_dungeon_chest_v002.png",
    overlay_dungeon_chest_rare: "assets/map/overlays/overlay_dungeon_chest_rare_v002.png",
    overlay_dungeon_chest_empty: "assets/map/overlays/overlay_dungeon_chest_empty_v001.png",
    overlay_dungeon_chest_rare_empty: "assets/map/overlays/overlay_dungeon_chest_rare_empty_v001.png",
    overlay_dungeon_event: "assets/map/overlays/overlay_dungeon_event_v002.png",
    overlay_dungeon_portal: "assets/map/overlays/overlay_dungeon_portal_v002.png",
    overlay_dungeon_stairs: "assets/map/overlays/overlay_dungeon_stairs_v002.png",
    door_key_red: "assets/map/objects/door_key_red_v003.png",
    door_key_blue: "assets/map/objects/door_key_blue_v003.png",
    door_key_gold: "assets/map/objects/door_key_gold_v003.png",
    object_blocking_castle_candelabrum: "assets/map/objects/object_blocking_castle_candelabrum_v001.png",
    object_blocking_forest_stump: "assets/map/objects/object_blocking_forest_stump_v001.png",
    object_blocking_thunder_terminal: "assets/map/objects/object_blocking_thunder_terminal_v001.png",
    object_blocking_cave_stalagmite: "assets/map/objects/object_blocking_cave_stalagmite_v001.png",
    object_blocking_seabed_coral_pillar: "assets/map/objects/object_blocking_seabed_coral_pillar_v001.png",
    object_blocking_light_crystal_pedestal: "assets/map/objects/object_blocking_light_crystal_pedestal_v001.png",
    object_blocking_fire_brazier: "assets/map/objects/object_blocking_fire_brazier_v001.png",
    object_blocking_lighthouse_gear_pedestal: "assets/map/objects/object_blocking_lighthouse_gear_pedestal_v001.png",
    object_blocking_dark_shrine_obelisk: "assets/map/objects/object_blocking_dark_shrine_obelisk_v001.png",
    item_key_red: "assets/map/objects/item_key_red_v002.png",
    item_key_blue: "assets/map/objects/item_key_blue_v002.png",
    item_key_gold: "assets/map/objects/item_key_gold_v002.png",
    overlay_npc_elder: "assets/map/overlays/overlay_npc_elder_v002.png",
    overlay_npc_villager: "assets/map/overlays/overlay_npc_villager_v002.png",
    overlay_npc_child: "assets/map/overlays/overlay_npc_child_v002.png",
    overlay_npc_dark_soldier: "assets/map/overlays/overlay_npc_dark_soldier_v002.png",
    overlay_npc_bronze_knight: "assets/map/overlays/overlay_npc_bronze_knight_v002.png",
    overlay_light_captive_king: "assets/map/overlays/overlay_light_captive_king_v001.png",
    overlay_light_captive_princess: "assets/map/overlays/overlay_light_captive_princess_v001.png",
    overlay_light_captive_priest_a: "assets/map/overlays/overlay_light_captive_priest_a_v001.png",
    overlay_light_captive_priest_b: "assets/map/overlays/overlay_light_captive_priest_b_v001.png",
    overlay_companion_marie: "assets/map/overlays/overlay_companion_marie_v001.png",
    overlay_companion_zelied: "assets/map/overlays/overlay_companion_zelied_v001.png",
    overlay_companion_hayate: "assets/map/overlays/overlay_companion_hayate_v001.png",
    overlay_companion_sylvia: "assets/map/overlays/overlay_companion_sylvia_v001.png",
    overlay_companion_rin: "assets/map/overlays/overlay_companion_rin_v001.png",
    overlay_companion_sophia: "assets/map/overlays/overlay_companion_sophia_v003.png",
    overlay_companion_alan: "assets/map/overlays/overlay_companion_alan_v003.png",
    overlay_companion_frieda: "assets/map/overlays/overlay_companion_frieda_v003.png",
    overlay_companion_baron: "assets/map/overlays/overlay_companion_baron_v003.png",
    overlay_companion_karin: "assets/map/overlays/overlay_companion_karin_v001.png",
    overlay_companion_arisa: "assets/map/overlays/overlay_companion_arisa_v003.png",
    overlay_companion_haine: "assets/map/overlays/overlay_companion_haine_v003.png",
    overlay_companion_claude: "assets/map/overlays/overlay_companion_claude_v003.png",
    overlay_companion_leon: "assets/map/overlays/overlay_companion_leon_v003.png",
    overlay_companion_luna: "assets/map/overlays/overlay_companion_luna_v001.png",
    overlay_companion_licia: "assets/map/overlays/overlay_companion_licia_v001.png",
    overlay_companion_ryu: "assets/map/overlays/overlay_companion_ryu_v003.png",
    overlay_companion_minerva: "assets/map/overlays/overlay_companion_minerva_v001.png",
    overlay_companion_zenon: "assets/map/overlays/overlay_companion_zenon_v001.png",
    overlay_town_fire_blacksmith: "assets/map/overlays/overlay_town_fire_blacksmith_v001.png",
    overlay_town_fire_coal_carrier: "assets/map/overlays/overlay_town_fire_coal_carrier_v001.png",
    overlay_town_fire_resident: "assets/map/overlays/overlay_town_fire_resident_v001.png",
    overlay_town_wind_watch: "assets/map/overlays/overlay_town_wind_watch_v001.png",
    overlay_town_wind_weaver: "assets/map/overlays/overlay_town_wind_weaver_v001.png",
    overlay_town_water_guard: "assets/map/overlays/overlay_town_water_guard_v001.png",
    overlay_town_water_boatman: "assets/map/overlays/overlay_town_water_boatman_v001.png",
    overlay_town_light_pilgrim: "assets/map/overlays/overlay_town_light_pilgrim_v001.png",
    overlay_town_demon_guard: "assets/map/overlays/overlay_town_demon_guard_v001.png",
    overlay_monster_guardian: "assets/monsters/monster_100010.png",
    overlay_building_fire_forge: "assets/map/overlays/overlay_building_fire_forge_v002.png",
    overlay_building_wind_hut: "assets/map/overlays/overlay_building_wind_hut_v002.png",
    overlay_building_water_shop: "assets/map/overlays/overlay_building_water_shop_v002.png",
    overlay_dungeon_warp: "assets/map/overlays/overlay_dungeon_warp_v001.png",
    overlay_dungeon_trial_angel: "assets/map/overlays/overlay_dungeon_trial_angel_v001.png",
    overlay_dungeon_adventurer: "assets/map/overlays/overlay_dungeon_adventurer_v001.png",
    overlay_dungeon_adventurer_down_1: "assets/map/overlays/overlay_dungeon_adventurer_down_1_v001.png",
    overlay_dungeon_adventurer_down_2: "assets/map/overlays/overlay_dungeon_adventurer_down_2_v001.png",
    overlay_dungeon_adventurer_left_1: "assets/map/overlays/overlay_dungeon_adventurer_left_1_v001.png",
    overlay_dungeon_adventurer_left_2: "assets/map/overlays/overlay_dungeon_adventurer_left_2_v001.png",
    overlay_dungeon_adventurer_right_1: "assets/map/overlays/overlay_dungeon_adventurer_right_1_v001.png",
    overlay_dungeon_adventurer_right_2: "assets/map/overlays/overlay_dungeon_adventurer_right_2_v001.png",
    overlay_dungeon_adventurer_up_1: "assets/map/overlays/overlay_dungeon_adventurer_up_1_v001.png",
    overlay_dungeon_adventurer_up_2: "assets/map/overlays/overlay_dungeon_adventurer_up_2_v001.png",
                                "buff-ai": "assets/effect/fx-buff-ai.png",
                                "abyss-vortex": "assets/effect/fx-abyss-vortex-ai.png",
    overlay_dungeon_hunter: "assets/map/overlays/overlay_dungeon_hunter_v001.png",
    overlay_dungeon_hunter_fire: "assets/map/overlays/overlay_dungeon_hunter_fire_v001.png",
    overlay_dungeon_hunter_forest: "assets/map/overlays/overlay_dungeon_hunter_forest_v001.png",
    overlay_dungeon_hunter_sea: "assets/map/overlays/overlay_dungeon_hunter_sea_v001.png",
    overlay_dungeon_hunter_thunder: "assets/map/overlays/overlay_dungeon_hunter_thunder_v001.png",
    overlay_dungeon_hunter_shadow: "assets/map/overlays/overlay_dungeon_hunter_shadow_v001.png",
    overlay_boss_100078: "assets/monsters/monster_100078.png",
    overlay_boss_100081: "assets/monsters/monster_100081.png",
    overlay_boss_100082: "assets/monsters/monster_100082.png",
    overlay_boss_100089: "assets/monsters/monster_100089.png",
    overlay_boss_301000: "assets/monsters/monster_301000.png",
    overlay_boss_301001: "assets/monsters/monster_301001.png",
    overlay_boss_301002: "assets/monsters/monster_301002.png",
    overlay_boss_301010: "assets/monsters/monster_301010.png",
    overlay_boss_301011: "assets/monsters/monster_301011.png",
    overlay_boss_301012: "assets/monsters/monster_301012.png",
    overlay_boss_301020: "assets/monsters/monster_301020.png",
    overlay_boss_301021: "assets/monsters/monster_301021.png",
    overlay_boss_301022: "assets/monsters/monster_301022.png",
    overlay_boss_301030: "assets/monsters/monster_301030.png",
    overlay_boss_301031: "assets/monsters/monster_301031.png",
    overlay_boss_301032: "assets/monsters/monster_301032.png",
    overlay_boss_301040: "assets/monsters/monster_301040.png",
    overlay_boss_301050: "assets/monsters/monster_301050.png",
    overlay_boss_301060: "assets/monsters/monster_301060.png",
    overlay_boss_301061: "assets/monsters/monster_301061.png",
    overlay_boss_301062: "assets/monsters/monster_301062.png",
    overlay_boss_301070: "assets/monsters/monster_301070.png",
    overlay_boss_301080: "assets/monsters/monster_301080.png",
    overlay_boss_301081: "assets/monsters/monster_301081.png",
    overlay_boss_301082: "assets/monsters/monster_301082.png",
    overlay_boss_301100: "assets/monsters/monster_301100.png",
    overlay_boss_902000: "assets/monsters/monster_902000.png",
    overlay_magic_boat_down: "assets/map/overlays/overlay_magic_boat_down_v001.png",
    overlay_magic_boat_up: "assets/map/overlays/overlay_magic_boat_up_v001.png",
    overlay_magic_boat_left: "assets/map/overlays/overlay_magic_boat_left_v001.png",
    overlay_magic_boat_right: "assets/map/overlays/overlay_magic_boat_right_v001.png",

    // 地域別マップチップ（map.js の TILE_THEMES から参照）
    tile_fire_wall: "assets/map/terrain/tile_fire_wall_v004.png",
    tile_fire_floor: "assets/map/terrain/tile_fire_floor_v004.png",
    tile_magma: "assets/map/terrain/tile_magma_v004.png",
    tile_poison_bog: "assets/map/terrain/tile_poison_bog_v001.png",
    tile_ice_slide: "assets/map/terrain/tile_ice_slide_v001.png",
    tile_wind_wall: "assets/map/terrain/tile_forest_wall_v001.png",
    tile_forest_wall: "assets/map/terrain/tile_forest_wall_v001.png",
    tile_wind_floor: "assets/map/terrain/tile_wind_floor_v004.png",
    tile_wind_bridge: "assets/map/terrain/tile_wind_bridge_v004.png",
    tile_wind_temple_wall: "assets/map/terrain/tile_wind_temple_wall_v001.png",
    tile_wind_temple_floor: "assets/map/terrain/tile_wind_temple_floor_v001.png",
    tile_wind_hole_wall: "assets/map/terrain/tile_wind_hole_wall_v001.png",
    tile_wind_hole_floor: "assets/map/terrain/tile_wind_hole_floor_v001.png",
    tile_wind_hole_wall_2: "assets/map/terrain/tile_wind_hole_wall_v002.png",
    tile_wind_hole_wall_3: "assets/map/terrain/tile_wind_hole_wall_v003.png",
    tile_wind_hole_wall_4: "assets/map/terrain/tile_wind_hole_wall_v004.png",
    tile_wind_hole_floor_2: "assets/map/terrain/tile_wind_hole_floor_v002.png",
    tile_wind_hole_floor_3: "assets/map/terrain/tile_wind_hole_floor_v003.png",
    tile_wind_hole_floor_4: "assets/map/terrain/tile_wind_hole_floor_v004.png",
    tile_forbidden_forest_wall: "assets/map/terrain/tile_forbidden_forest_wall_v001.png",
    tile_forbidden_forest_floor: "assets/map/terrain/tile_forbidden_forest_floor_v001.png",
    tile_forbidden_forest_wall_2: "assets/map/terrain/tile_forbidden_forest_wall_v002.png",
    tile_forbidden_forest_wall_3: "assets/map/terrain/tile_forbidden_forest_wall_v003.png",
    tile_forbidden_forest_wall_4: "assets/map/terrain/tile_forbidden_forest_wall_v004.png",
    tile_forbidden_forest_floor_2: "assets/map/terrain/tile_forbidden_forest_floor_v002.png",
    tile_forbidden_forest_floor_3: "assets/map/terrain/tile_forbidden_forest_floor_v003.png",
    tile_forbidden_forest_floor_4: "assets/map/terrain/tile_forbidden_forest_floor_v004.png",
    tile_water_canal: "assets/map/terrain/tile_water_canal_v004.png",
    tile_water_pave: "assets/map/terrain/tile_water_pave_v004.png",
    tile_water_bridge: "assets/map/terrain/tile_water_bridge_v004.png",
    tile_tower_wall: "assets/map/terrain/tile_tower_wall_v005.png",
    tile_tower_floor: "assets/map/terrain/tile_tower_floor_v005.png",
    tile_thunder_wall: "assets/map/terrain/tile_thunder_wall_v005.png",
    tile_thunder_floor: "assets/map/terrain/tile_thunder_floor_v005.png",
    tile_thunder_wall_2: "assets/map/terrain/tile_thunder_wall_alt_v002.png",
    tile_thunder_wall_3: "assets/map/terrain/tile_thunder_wall_alt_v003.png",
    tile_thunder_wall_4: "assets/map/terrain/tile_thunder_wall_alt_v004.png",
    tile_thunder_floor_2: "assets/map/terrain/tile_thunder_floor_alt_v002.png",
    tile_thunder_floor_3: "assets/map/terrain/tile_thunder_floor_alt_v003.png",
    tile_thunder_floor_4: "assets/map/terrain/tile_thunder_floor_alt_v004.png",
    tile_light_wall: "assets/map/terrain/tile_light_wall_v005.png",
    tile_light_floor: "assets/map/terrain/tile_light_floor_v005.png",
    tile_light_wall_face: "assets/map/terrain/tile_light_wall_face_v001.png",
    tile_light_wall_face_prism: "assets/map/terrain/tile_light_wall_face_prism_v001.png",
    tile_dark_wall: "assets/map/terrain/tile_dark_wall_v005.png",
    tile_dark_floor: "assets/map/terrain/tile_dark_floor_v005.png",
    tile_dark_wall_2: "assets/map/terrain/tile_dark_wall_alt_v002.png",
    tile_dark_wall_3: "assets/map/terrain/tile_dark_wall_alt_v003.png",
    tile_dark_wall_4: "assets/map/terrain/tile_dark_wall_alt_v004.png",
    tile_dark_floor_2: "assets/map/terrain/tile_dark_floor_alt_v002.png",
    tile_dark_floor_3: "assets/map/terrain/tile_dark_floor_alt_v003.png",
    tile_dark_floor_4: "assets/map/terrain/tile_dark_floor_alt_v004.png",
    tile_crena_floor: "assets/map/terrain/tile_crena_floor_v001.png",
    tile_crena_water: "assets/map/terrain/tile_crena_water_v001.png",
    tile_seabed_floor: "assets/map/terrain/tile_seabed_floor_v001.png",
    tile_seabed_floor_2: "assets/map/terrain/tile_seabed_floor_alt_v002.png",
    tile_seabed_floor_3: "assets/map/terrain/tile_seabed_floor_alt_v003.png",
    tile_seabed_floor_4: "assets/map/terrain/tile_seabed_floor_alt_v004.png",
    tile_dark_shrine_wall: "assets/map/terrain/tile_dark_shrine_wall_v004.png",
    tile_dark_shrine_floor: "assets/map/terrain/tile_dark_shrine_floor_v003.png",
    tile_dark_shrine_wall_2: "assets/map/terrain/tile_dark_shrine_wall_alt_v011.png",
    tile_dark_shrine_wall_3: "assets/map/terrain/tile_dark_shrine_wall_alt_v012.png",
    tile_dark_shrine_wall_4: "assets/map/terrain/tile_dark_shrine_wall_alt_v013.png",
    tile_dark_shrine_wall_face: "assets/map/terrain/tile_dark_shrine_wall_face_v001.png",
    tile_dark_shrine_floor_2: "assets/map/terrain/tile_dark_shrine_floor_alt_v008.png",
    tile_dark_shrine_floor_3: "assets/map/terrain/tile_dark_shrine_floor_alt_v009.png",
    tile_dark_shrine_floor_4: "assets/map/terrain/tile_dark_shrine_floor_alt_v010.png",
    tile_galvania_wall: "assets/map/terrain/tile_galvania_wall_v001.png",
    tile_galvania_wall_2: "assets/map/terrain/tile_galvania_wall_alt_v002.png",
    tile_galvania_wall_3: "assets/map/terrain/tile_galvania_wall_alt_v003.png",
    tile_galvania_wall_4: "assets/map/terrain/tile_galvania_wall_alt_v004.png",
    tile_galvania_floor: "assets/map/terrain/tile_galvania_floor_v001.png",
    tile_galvania_floor_2: "assets/map/terrain/tile_galvania_floor_alt_v002.png",
    tile_galvania_floor_3: "assets/map/terrain/tile_galvania_floor_alt_v003.png",
    tile_galvania_floor_4: "assets/map/terrain/tile_galvania_floor_alt_v004.png",
    tile_grezelia_wall: "assets/map/terrain/tile_grezelia_wall_v001.png",
    tile_grezelia_floor: "assets/map/terrain/tile_grezelia_floor_v001.png",
    tile_grezelia_wall_2: "assets/map/terrain/tile_grezelia_wall_alt_v002.png",
    tile_grezelia_wall_3: "assets/map/terrain/tile_grezelia_wall_alt_v003.png",
    tile_grezelia_wall_4: "assets/map/terrain/tile_grezelia_wall_alt_v004.png",
    tile_grezelia_floor_2: "assets/map/terrain/tile_grezelia_floor_alt_v002.png",
    tile_grezelia_floor_3: "assets/map/terrain/tile_grezelia_floor_alt_v003.png",
    tile_grezelia_floor_4: "assets/map/terrain/tile_grezelia_floor_alt_v004.png",
    tile_abyss_grass: "assets/map/terrain/tile_abyss_grass_v003.png",
    tile_abyss_path: "assets/map/terrain/tile_abyss_path_v003.png",
    tile_abyss_outer_wall: "assets/map/terrain/tile_abyss_outer_wall_v003_a.png",
    tile_abyss_outer_wall_2: "assets/map/terrain/tile_abyss_outer_wall_v003_b.png",
    tile_abyss_outer_wall_3: "assets/map/terrain/tile_abyss_outer_wall_v003_c.png",
    tile_abyss_outer_wall_4: "assets/map/terrain/tile_abyss_outer_wall_v003_d.png",
    tile_abyss_outer_floor: "assets/map/terrain/tile_abyss_outer_dark_floor_v003_a.png",
    tile_abyss_outer_floor_2: "assets/map/terrain/tile_abyss_outer_dark_floor_v003_b.png",
    tile_abyss_outer_floor_3: "assets/map/terrain/tile_abyss_outer_dark_floor_v003_c.png",
    tile_abyss_outer_floor_4: "assets/map/terrain/tile_abyss_outer_dark_floor_v003_d.png",
    tile_abyss_outer_prism_paving: "assets/map/terrain/tile_abyss_outer_prism_paving_v003_a.png",
    tile_abyss_outer_prism_paving_2: "assets/map/terrain/tile_abyss_outer_prism_paving_v003_b.png",
    tile_abyss_outer_prism_paving_3: "assets/map/terrain/tile_abyss_outer_prism_paving_v003_c.png",
    tile_abyss_outer_prism_paving_4: "assets/map/terrain/tile_abyss_outer_prism_paving_v003_d.png",
    overlay_abyss_outer_chasm_nw: "assets/map/overlays/overlay_abyss_outer_chasm_nw_v003.png",
    overlay_abyss_outer_chasm_n: "assets/map/overlays/overlay_abyss_outer_chasm_n_v003.png",
    overlay_abyss_outer_chasm_ne: "assets/map/overlays/overlay_abyss_outer_chasm_ne_v003.png",
    overlay_abyss_outer_chasm_w: "assets/map/overlays/overlay_abyss_outer_chasm_w_v003.png",
    overlay_abyss_outer_chasm_c: "assets/map/overlays/overlay_abyss_outer_chasm_c_v003.png",
    overlay_abyss_outer_chasm_e: "assets/map/overlays/overlay_abyss_outer_chasm_e_v003.png",
    overlay_abyss_outer_chasm_sw: "assets/map/overlays/overlay_abyss_outer_chasm_sw_v003.png",
    overlay_abyss_outer_chasm_s: "assets/map/overlays/overlay_abyss_outer_chasm_s_v003.png",
    overlay_abyss_outer_chasm_se: "assets/map/overlays/overlay_abyss_outer_chasm_se_v003.png",
    overlay_abyss_outer_ruined_altar: "assets/map/overlays/overlay_abyss_outer_ruined_altar_v003.png",
    overlay_abyss_outer_fallen_pillar: "assets/map/overlays/overlay_abyss_outer_fallen_pillar_v003.png",
    overlay_abyss_outer_intact_column: "assets/map/overlays/overlay_abyss_outer_intact_column_v003.png",
    overlay_abyss_outer_broken_column_stump: "assets/map/overlays/overlay_abyss_outer_broken_column_stump_v003.png",
    overlay_abyss_outer_prism_pedestal_intact: "assets/map/overlays/overlay_abyss_outer_prism_pedestal_intact_v003.png",
    overlay_abyss_outer_prism_pedestal_collapsed: "assets/map/overlays/overlay_abyss_outer_prism_pedestal_collapsed_v003.png",
    tile_ruined_shrine_wall: "assets/map/terrain/tile_ruined_shrine_wall_v002_a.png",
    tile_ruined_shrine_wall_2: "assets/map/terrain/tile_ruined_shrine_wall_v002_b.png",
    tile_ruined_shrine_wall_3: "assets/map/terrain/tile_ruined_shrine_wall_v002_c.png",
    tile_ruined_shrine_wall_4: "assets/map/terrain/tile_ruined_shrine_wall_v002_d.png",
    tile_ruined_shrine_floor: "assets/map/terrain/tile_ruined_shrine_floor_v002_a.png",
    tile_ruined_shrine_floor_2: "assets/map/terrain/tile_ruined_shrine_floor_v002_b.png",
    tile_ruined_shrine_floor_3: "assets/map/terrain/tile_ruined_shrine_floor_v002_c.png",
    tile_ruined_shrine_floor_4: "assets/map/terrain/tile_ruined_shrine_floor_v002_d.png",
    tile_ruined_shrine_withered_grass: "assets/map/terrain/tile_ruined_shrine_withered_grass_v002_a.png",
    tile_ruined_shrine_withered_grass_2: "assets/map/terrain/tile_ruined_shrine_withered_grass_v002_b.png",
    tile_ruined_shrine_withered_grass_3: "assets/map/terrain/tile_ruined_shrine_withered_grass_v002_c.png",
    tile_ruined_shrine_withered_grass_4: "assets/map/terrain/tile_ruined_shrine_withered_grass_v002_d.png",
    tile_ruined_shrine_wall_face: "assets/map/terrain/tile_ruined_shrine_wall_face_v002_a.png",
    tile_ruined_shrine_wall_face_rooted: "assets/map/terrain/tile_ruined_shrine_wall_face_v002_b.png",
    overlay_ruined_shrine_pillar: "assets/map/overlays/overlay_ruined_shrine_pillar_v002.png",
    overlay_ruined_shrine_raised_stage_a: "assets/map/overlays/overlay_ruined_shrine_raised_stage_v002_a.png",
    overlay_ruined_shrine_raised_stage_b: "assets/map/overlays/overlay_ruined_shrine_raised_stage_v002_b.png",
    overlay_ruined_shrine_raised_stage_c: "assets/map/overlays/overlay_ruined_shrine_raised_stage_v002_c.png",
    overlay_ruined_shrine_raised_stage_d: "assets/map/overlays/overlay_ruined_shrine_raised_stage_v002_d.png",
    overlay_ruined_shrine_raised_stage_e: "assets/map/overlays/overlay_ruined_shrine_raised_stage_v002_e.png",
    overlay_ruined_shrine_raised_stage_f: "assets/map/overlays/overlay_ruined_shrine_raised_stage_v002_f.png",
    overlay_ruined_shrine_ritual_astrolabe: "assets/map/overlays/overlay_ruined_shrine_ritual_astrolabe_v002.png",
    overlay_ruined_shrine_rusted_sword: "assets/map/overlays/overlay_ruined_shrine_rusted_sword_v002.png",
    overlay_ruined_shrine_rusted_spear: "assets/map/overlays/overlay_ruined_shrine_rusted_spear_v002.png",
    overlay_ruined_shrine_rusted_axe: "assets/map/overlays/overlay_ruined_shrine_rusted_axe_v002.png",
    tile_shrine_wall: "assets/map/terrain/tile_shrine_wall_v003.png",
    tile_shrine_floor: "assets/map/terrain/tile_shrine_floor_v003.png",
    tile_trial_shrine_floor: "assets/map/terrain/tile_trial_shrine_floor_v001_a.png",
    tile_trial_shrine_floor_2: "assets/map/terrain/tile_trial_shrine_floor_v001_b.png",
    tile_trial_shrine_wall: "assets/map/terrain/tile_trial_shrine_wall_v001.png",
    tile_trial_shrine_wall_face: "assets/map/terrain/tile_trial_shrine_wall_face_v001.png",
    overlay_trial_shrine_stage_a: "assets/map/overlays/overlay_trial_shrine_stage_v001_a.png",
    overlay_trial_shrine_stage_b: "assets/map/overlays/overlay_trial_shrine_stage_v001_b.png",
    overlay_trial_shrine_stage_c: "assets/map/overlays/overlay_trial_shrine_stage_v001_c.png",
    overlay_trial_shrine_stage_d: "assets/map/overlays/overlay_trial_shrine_stage_v001_d.png",
    overlay_trial_shrine_stage_e: "assets/map/overlays/overlay_trial_shrine_stage_v001_e.png",
    overlay_trial_shrine_stage_f: "assets/map/overlays/overlay_trial_shrine_stage_v001_f.png",
    overlay_trial_shrine_stage_g: "assets/map/overlays/overlay_trial_shrine_stage_v001_g.png",
    overlay_trial_shrine_stage_h: "assets/map/overlays/overlay_trial_shrine_stage_v001_h.png",
    overlay_trial_shrine_stage_i: "assets/map/overlays/overlay_trial_shrine_stage_v001_i.png",
    overlay_trial_shrine_stage_j: "assets/map/overlays/overlay_trial_shrine_stage_v001_j.png",
    overlay_trial_shrine_stage_k: "assets/map/overlays/overlay_trial_shrine_stage_v001_k.png",
    overlay_trial_shrine_stage_l: "assets/map/overlays/overlay_trial_shrine_stage_v001_l.png",
    overlay_trial_shrine_stage_m: "assets/map/overlays/overlay_trial_shrine_stage_v001_m.png",
    overlay_trial_shrine_stage_n: "assets/map/overlays/overlay_trial_shrine_stage_v001_n.png",
    overlay_trial_shrine_stage_o: "assets/map/overlays/overlay_trial_shrine_stage_v001_o.png",
    overlay_trial_shrine_statue_a: "assets/map/overlays/overlay_trial_shrine_statue_a_v001.png",
    overlay_trial_shrine_statue_un: "assets/map/overlays/overlay_trial_shrine_statue_un_v001.png",
    tile_summit_temple_floor: "assets/map/terrain/tile_summit_temple_floor_v001_a.png",
    tile_summit_temple_floor_2: "assets/map/terrain/tile_summit_temple_floor_v001_b.png",
    tile_summit_temple_mountain_trail: "assets/map/terrain/tile_summit_temple_mountain_trail_v001_a.png",
    tile_summit_temple_mountain_trail_2: "assets/map/terrain/tile_summit_temple_mountain_trail_v001_b.png",
    tile_summit_temple_sky: "assets/map/terrain/tile_summit_temple_sky_v001_a.png",
    tile_summit_temple_wall: "assets/map/terrain/tile_summit_temple_wall_v001.png",
    tile_summit_temple_wall_face: "assets/map/terrain/tile_summit_temple_wall_face_v001.png",
    overlay_summit_temple_cloud_bank: "assets/map/overlays/overlay_summit_temple_cloud_bank_v002.png",
    overlay_summit_temple_cloud_wispy: "assets/map/overlays/overlay_summit_temple_cloud_wispy_v001.png",
    overlay_summit_temple_cloud_compact: "assets/map/overlays/overlay_summit_temple_cloud_compact_v001.png",
    overlay_summit_temple_cliff_edge_n: "assets/map/overlays/overlay_summit_temple_cliff_edge_n_v001.png",
    overlay_summit_temple_cliff_edge_e: "assets/map/overlays/overlay_summit_temple_cliff_edge_e_v001.png",
    overlay_summit_temple_cliff_edge_s: "assets/map/overlays/overlay_summit_temple_cliff_edge_s_v001.png",
    overlay_summit_temple_cliff_edge_w: "assets/map/overlays/overlay_summit_temple_cliff_edge_w_v001.png",
    overlay_shrine_healing_spring: "assets/map/overlays/overlay_shrine_healing_spring_v002.png",
    overlay_summit_temple_stage_a: "assets/map/overlays/overlay_summit_temple_stage_v001_a.png",
    overlay_summit_temple_stage_b: "assets/map/overlays/overlay_summit_temple_stage_v001_b.png",
    overlay_summit_temple_stage_c: "assets/map/overlays/overlay_summit_temple_stage_v001_c.png",
    overlay_summit_temple_stage_d: "assets/map/overlays/overlay_summit_temple_stage_v001_d.png",
    overlay_summit_temple_stage_e: "assets/map/overlays/overlay_summit_temple_stage_v001_e.png",
    overlay_summit_temple_stage_f: "assets/map/overlays/overlay_summit_temple_stage_v001_f.png",
    overlay_summit_temple_stage_g: "assets/map/overlays/overlay_summit_temple_stage_v001_g.png",
    overlay_summit_temple_stage_h: "assets/map/overlays/overlay_summit_temple_stage_v001_h.png",
    overlay_summit_temple_stage_i: "assets/map/overlays/overlay_summit_temple_stage_v001_i.png",
    overlay_summit_temple_stage_j: "assets/map/overlays/overlay_summit_temple_stage_v001_j.png",
    overlay_summit_temple_stage_k: "assets/map/overlays/overlay_summit_temple_stage_v001_k.png",
    overlay_summit_temple_stage_l: "assets/map/overlays/overlay_summit_temple_stage_v001_l.png",
    overlay_summit_temple_stage_m: "assets/map/overlays/overlay_summit_temple_stage_v001_m.png",
    overlay_summit_temple_stage_n: "assets/map/overlays/overlay_summit_temple_stage_v001_n.png",
    overlay_summit_temple_stage_o: "assets/map/overlays/overlay_summit_temple_stage_v001_o.png",
    overlay_summit_temple_statue_angel: "assets/map/overlays/overlay_summit_temple_statue_angel_v001.png",
    overlay_summit_temple_statue_divine_dragon: "assets/map/overlays/overlay_summit_temple_statue_divine_dragon_v001.png",
    tile_stone_tablet: "assets/map/terrain/tile_stone_tablet.png",
    event_field: "assets/map/objects/object_field_event_v002.png",
    event_dungeon: "assets/map/objects/object_dungeon_event_v002.png",
    portal_dungeon: "assets/map/objects/object_dungeon_portal_v002.png",
    battle_bg_field: "assets/generated/battle-field-ai.png",
    battle_bg_field_forest: "assets/generated/battle-forest-ai.png",
    battle_bg_forest: "assets/generated/battle-forbidden-forest-v001.png",
    battle_bg_mountain: "assets/generated/battle-mountain-ai.png",
    battle_bg_dungeon: "assets/generated/battle-dungeon-ai.png",
    battle_bg_boss: "assets/generated/battle-boss-ai.png",
    battle_bg_maze: "assets/generated/battle-maze-ai.png",
    battle_bg_fire: "assets/generated/battle-fire.png",
    battle_bg_sea: "assets/generated/battle-sea-v002.png",
    battle_bg_lastboss: "assets/generated/battle-abyss-ai.png",
    battle_bg_first: "assets/generated/first-battle.png",
    battle_bg_abyss_boss: "assets/generated/battle-abyss-boss-v001.png",
    battle_bg_abyss_floor_200: "assets/generated/battle-abyss-floor-200-v001.png",
    battle_bg_wind_temple: "assets/generated/battle-wind-temple-v001.png",
    battle_bg_mountain_wind_ruins: "assets/generated/battle-mountain-wind-ruins-v001.png",
    battle_bg_trial_shrine: "assets/generated/battle-trial-shrine-v001.png",
    battle_bg_summit_temple: "assets/generated/battle-summit-temple-v001.png",
    hero_down_1: "assets/generated/hero-down-1.gif",
    hero_down_2: "assets/generated/hero-down-2.gif",
    hero_up_1: "assets/generated/hero-up-1.gif",
    hero_up_2: "assets/generated/hero-up-2.gif",
    hero_left_1: "assets/generated/hero-left-1.gif",
    hero_left_2: "assets/generated/hero-left-2.gif",
    hero_right_1: "assets/generated/hero-right-1.gif",
    hero_right_2: "assets/generated/hero-right-2.gif",
    hero_wing_down_1: "assets/generated/hero-wing-down-1-v003.png",
    hero_wing_down_2: "assets/generated/hero-wing-down-2-v003.png",
    hero_wing_up_1: "assets/generated/hero-wing-up-1-v003.png",
    hero_wing_up_2: "assets/generated/hero-wing-up-2-v003.png",
    hero_wing_left_1: "assets/generated/hero-wing-left-1-v003.png",
    hero_wing_left_2: "assets/generated/hero-wing-left-2-v003.png",
    hero_wing_right_1: "assets/generated/hero-wing-right-1-v003.png",
    hero_wing_right_2: "assets/generated/hero-wing-right-2-v003.png",
    battle_bg_thunder_fort: "assets/generated/battle-thunder-fort-v001.png",
    battle_bg_light_palace: "assets/generated/battle-light-palace-v001.png",
    battle_bg_big_tower: "assets/generated/battle-big-tower-v001.png",
    battle_bg_dark_castle: "assets/generated/battle-dark-castle-v001.png",
    battle_bg_crena: "assets/generated/battle-crena-v001.png",
    battle_bg_seabed: "assets/generated/battle-seabed-v001.png",
    battle_bg_flooded: "assets/generated/battle-flooded-v001.png",
    battle_bg_dark_shrine: "assets/generated/battle-dark-shrine-v001.png",
    battle_bg_galvania_cave: "assets/generated/battle-galvania-cave-v001.png",
    battle_bg_grezelia: "assets/generated/battle-grezelia-v001.png",
    battle_bg_wind_hole: "assets/generated/battle-forest-wind-hole-v001.png",
  },

  // polish.js の BattleFX が参照する戦闘エフェクト画像。
  // ここに統一し、polish.js には画像パス一覧を置かない。
  battleFx: {
    slash: "assets/effect/fx-slash-ai.png",
    claw: "assets/effect/fx-claw-ai.png",
    fire: "assets/effect/fx-fire-ai.png",
    ice: "assets/effect/fx-ice-ai.png",
    thunder: "assets/effect/fx-thunder-ai.png",
    wind: "assets/effect/fx-wind-ai.png",
    light: "assets/effect/fx-light-ai.png",
    dark: "assets/effect/fx-dark-ai.png",
    chaos: "assets/effect/fx-chaos-ai.png",
    heal: "assets/effect/fx-heal-ai.png",
    buff: "assets/effect/fx_support_buff_v001.png",
    "buff-ai": "assets/effect/fx-buff-ai.png",
    debuff: "assets/effect/fx_support_debuff_hex_v002.png",
    combo: "assets/effect/fx-combo-ai.png",
    "all-slash": "assets/effect/fx-all-slash-ai.png",
    "enemy-claw": "assets/effect/fx-enemy-claw-ai.png",
    "party-hit": "assets/effect/fx-party-hit-ai.png",
    meteor: "assets/effect/fx-meteor-ai.png",
    "ice-spear": "assets/effect/fx-ice-spear-ai.png",
    "thunder-pillar": "assets/effect/fx-thunder-pillar-ai.png",
    "abyss-vortex": "assets/effect/fx-abyss-vortex-ai.png",
    "holy-burst": "assets/effect/fx-holy-burst-ai.png",
    poison: "assets/effect/fx-poison-ai.png",
    "ultimate-chaos": "assets/effect/fx-ultimate-chaos-ai.png",
    "ultimate-ragnarok": "assets/effect/fx_ultimate_166_ragnarok_v001.png",
    "ultimate-prisma-end": "assets/effect/fx_ultimate_168_prisma_end_v001.png",
    "ultimate-big-bang": "assets/effect/fx_ultimate_238_big_bang_v001.png",
    "ultimate-abyss-wall": "assets/effect/fx_ultimate_242_abyss_wall_v001.png",
    "ultimate-phoenix-flare": "assets/effect/fx_ultimate_243_phoenix_flare_v001.png",
    "ultimate-genesis-magic": "assets/effect/fx_ultimate_244_genesis_magic_v001.png",
    "ultimate-chaos-shock": "assets/effect/fx_ultimate_245_chaos_shock_v001.png",
    "ultimate-illuminati-break": "assets/effect/fx_ultimate_246_illuminati_break_v001.png",
    "ultimate-the-end": "assets/effect/fx_ultimate_247_the_end_v001.png",
    "ultimate-lost-prisma": "assets/effect/fx_ultimate_248_lost_prisma_v001.png",
    "heal-blossom": "assets/effect/fx_support_heal_radiance_v002.png",
    "neutral-slash": "assets/effect/fx_phys_slash_arc_v002.png",
    "neutral-smash": "assets/effect/fx_phys_smash_impact_v002.png",
    "neutral-pierce": "assets/effect/fx_phys_pierce_lance_v002.png",
    "neutral-combo": "assets/effect/fx_phys_neutral_combo_v001.png",
    "neutral-chain": "assets/effect/fx_phys_neutral_chain_v001.png",
    "neutral-heavy": "assets/effect/fx_phys_neutral_heavy_v001.png",
    "phys-sword": "assets/effect/fx_phys_slash_arc_v002.png",
    "phys-spear": "assets/effect/fx_phys_pierce_lance_v002.png",
    "phys-axe": "assets/effect/fx_phys_smash_impact_v002.png",
    "ranged-volley": "assets/effect/fx_phys_ranged_volley_v001.png",
    "phys-combo": "assets/effect/fx_phys_neutral_combo_v001.png",
    "spell-fire": "assets/effect/fx_spell_fire_v001.png",
    "spell-ice": "assets/effect/fx_spell_ice_v001.png",
    "spell-thunder": "assets/effect/fx_spell_thunder_v001.png",
    "spell-wind": "assets/effect/fx_spell_wind_v001.png",
    "spell-light": "assets/effect/fx_spell_light_v001.png",
    "spell-dark": "assets/effect/fx_spell_dark_v001.png",
    "spell-chaos": "assets/effect/fx_spell_chaos_v001.png",
    breath: "assets/effect/fx_breath_cone_master_v001.png",
    "arcane-burst": "assets/effect/fx_magic_arcane_burst_v001.png",
    "special-rupture": "assets/effect/fx_special_rupture_v001.png",
    "critical-spark": "assets/effect/fx_critical_spark_v001.png",
    "phys-elemental": "assets/effect/fx_phys_elemental_arc_v001.png",
  },


  // Service Worker / 起動時先読みへ渡す画像キャッシュ用リスト。
  // initialGraphicKeys / criticalImages: 全量取得を待たない場合でも起動直後に必要なセット。
  // openingImages: PROLOGUE3後の紙芝居OPで使う画像（全量キャッシュにも含める）。
  // startupImages: ローディング中にブラウザ側でも先読みする画像。
  // installImages: Service Worker の初回install時にキャッシュする画像全体。
  // backgroundImages: install後の再試行/補助ウォームキャッシュ用。
  cacheWarmup: {
    version: "2026-07-18-summit-temple-sky-v58",
    initialGraphicKeys: [
      "floor", "sea", "forest", "mountain", "Low_mountain", "cave", "house-1", "house-2", "inn", "wall", "dungeon_floor",
      "item_icon_attack", "item_icon_buff", "item_icon_debuff", "item_icon_material", "item_icon_vehicle", "item_icon_travel",
      "item_icon_heal", "item_icon_revive", "item_icon_growth", "item_icon_key",
      "overlay_field_forest", "overlay_field_house_1", "overlay_field_house_2", "overlay_field_cave",
      "overlay_field_village",
      "overlay_decor_default_cave_dust", "overlay_decor_start_village_herbs", "overlay_decor_start_cave_damp",
      "overlay_decor_fire_ember_fissure", "overlay_decor_wind_village_feather", "overlay_decor_wind_hole_root",
      "overlay_decor_forbidden_forest_moss", "overlay_decor_water_city_puddle", "overlay_decor_big_tower_gear_oil",
      "overlay_decor_thunder_fort_wiring", "overlay_decor_light_palace_prism", "overlay_decor_galvania_crystal",
      "overlay_decor_dark_castle_chain", "overlay_decor_crena_limestone_pool", "overlay_decor_seabed_temple_ripple",
      "overlay_decor_dark_shrine_sigil", "overlay_decor_grezelia_fossil", "overlay_decor_abyss_void_dust",
      "overlay_decor_abyss_field_flora", "overlay_decor_ruined_shrine_glyph",
      "overlay_castle_carpet_fill", "overlay_castle_carpet_edge_n", "overlay_castle_carpet_edge_s",
      "overlay_castle_carpet_edge_w", "overlay_castle_carpet_edge_e", "overlay_castle_carpet_corner_nw",
      "overlay_castle_carpet_corner_ne", "overlay_castle_carpet_corner_sw", "overlay_castle_carpet_corner_se",
      "overlay_castle_carpet_blue_silver_fill", "overlay_castle_carpet_blue_silver_edge_n", "overlay_castle_carpet_blue_silver_edge_s",
      "overlay_castle_carpet_blue_silver_edge_w", "overlay_castle_carpet_blue_silver_edge_e", "overlay_castle_carpet_blue_silver_corner_nw",
      "overlay_castle_carpet_blue_silver_corner_ne", "overlay_castle_carpet_blue_silver_corner_sw", "overlay_castle_carpet_blue_silver_corner_se",
      "overlay_village_goza_fill", "overlay_village_goza_edge_n", "overlay_village_goza_edge_s",
      "overlay_village_goza_edge_w", "overlay_village_goza_edge_e", "overlay_village_goza_corner_nw",
      "overlay_village_goza_corner_ne", "overlay_village_goza_corner_sw", "overlay_village_goza_corner_se",
      "door_key_red", "door_key_blue", "door_key_gold",
      "object_blocking_castle_candelabrum", "object_blocking_forest_stump", "object_blocking_thunder_terminal",
      "object_blocking_cave_stalagmite", "object_blocking_seabed_coral_pillar", "object_blocking_light_crystal_pedestal",
      "object_blocking_fire_brazier", "object_blocking_lighthouse_gear_pedestal", "object_blocking_dark_shrine_obelisk",
      "tile_trial_shrine_floor", "tile_trial_shrine_floor_2", "tile_trial_shrine_wall", "tile_trial_shrine_wall_face",
      "overlay_trial_shrine_stage_a", "overlay_trial_shrine_stage_b", "overlay_trial_shrine_stage_c", "overlay_trial_shrine_stage_d", "overlay_trial_shrine_stage_e",
      "overlay_trial_shrine_stage_f", "overlay_trial_shrine_stage_g", "overlay_trial_shrine_stage_h", "overlay_trial_shrine_stage_i", "overlay_trial_shrine_stage_j",
      "overlay_trial_shrine_stage_k", "overlay_trial_shrine_stage_l", "overlay_trial_shrine_stage_m", "overlay_trial_shrine_stage_n", "overlay_trial_shrine_stage_o",
      "overlay_trial_shrine_statue_a", "overlay_trial_shrine_statue_un", "overlay_event_blue_glimmer",
      "overlay_world_grass_detail", "overlay_world_forest_understory", "overlay_world_foothill_rocks", "overlay_world_shore_foam", "overlay_world_bridge_wood",
      "overlay_world_grass_weeds", "overlay_world_grass_earth", "overlay_world_forest_roots",
      "overlay_named_dungeon_chest", "overlay_named_dungeon_chest_rare",
      "overlay_dungeon_chest", "overlay_dungeon_chest_rare",
      "overlay_dungeon_stairs",
      "overlay_dungeon_chest_empty", "overlay_dungeon_chest_rare_empty",
      "overlay_dungeon_adventurer_down_1", "overlay_dungeon_adventurer_down_2",
      "overlay_dungeon_adventurer_left_1", "overlay_dungeon_adventurer_left_2",
      "overlay_dungeon_adventurer_right_1", "overlay_dungeon_adventurer_right_2",
      "overlay_dungeon_adventurer_up_1", "overlay_dungeon_adventurer_up_2",
      "overlay_npc_elder", "overlay_npc_villager", "overlay_npc_child", "overlay_npc_bronze_knight",
      "overlay_boss_301000", "battle_bg_field", "battle_bg_dungeon", "battle_bg_flooded", "battle_bg_first",
      "hero_down_1", "hero_down_2", "hero_up_1", "hero_up_2",
      "hero_left_1", "hero_left_2", "hero_right_1", "hero_right_2",
      "hero_wing_down_1", "hero_wing_down_2", "hero_wing_up_1", "hero_wing_up_2",
      "hero_wing_left_1", "hero_wing_left_2", "hero_wing_right_1", "hero_wing_right_2",
    ],
    criticalImages: [
      ...PRISMA_PRE_OP_MONSTER_IMAGE_FILES,
      "assets/generated/battle-field-ai.png",
      "assets/generated/battle-dungeon-ai.png",
      "assets/generated/battle-flooded-v001.png",
      "assets/generated/first-battle.png",
      "assets/map/terrain/terrain_grass_field_v001.png",
      "assets/map/terrain/terrain_sea_v001.png",
      "assets/map/objects/object_field_forest_v003.png",
      "assets/map/objects/object_field_mountain_v002.png",
      "assets/map/objects/object_field_low_mountain_v002.png",
      "assets/map/objects/object_field_cave_v002.png",
      "assets/map/objects/object_field_house_1_v002.png",
      "assets/map/objects/object_field_house_2_v002.png",
      "assets/map/objects/object_field_inn_v002.png",
      "assets/map/overlays/overlay_field_forest_v006.png",
      "assets/map/overlays/overlay_field_house_1_v002.png",
      "assets/map/overlays/overlay_field_house_2_v002.png",
      "assets/map/overlays/overlay_field_cave_v002.png",
      "assets/map/overlays/overlay_field_village_v002.png",
      "assets/map/overlays/overlay_decor_start_village_herbs_v001.png",
      "assets/map/overlays/overlay_decor_start_cave_damp_v001.png",
      "assets/map/overlays/overlay_world_grass_detail_v001.png",
      "assets/map/overlays/overlay_world_grass_weeds_v001.png",
      "assets/map/overlays/overlay_world_grass_earth_v001.png",
      "assets/map/overlays/overlay_world_forest_understory_v001.png",
      "assets/map/overlays/overlay_world_forest_roots_v001.png",
      "assets/map/overlays/overlay_world_foothill_rocks_v001.png",
      "assets/map/overlays/overlay_world_shore_foam_v001.png",
      "assets/effect/fx_phys_slash_arc_v002.png",
      "assets/effect/fx_phys_elemental_arc_v001.png",
      "assets/map/terrain/terrain_dungeon_wall_v001.png",
      "assets/map/terrain/terrain_dungeon_floor_v001.png",
      "assets/map/overlays/overlay_named_dungeon_chest.png",
      "assets/map/overlays/overlay_named_dungeon_chest_rare.png",
      "assets/map/overlays/overlay_dungeon_chest_v002.png",
      "assets/map/overlays/overlay_dungeon_chest_rare_v002.png",
      "assets/map/overlays/overlay_dungeon_stairs_v002.png",
      "assets/map/overlays/overlay_dungeon_chest_empty_v001.png",
      "assets/map/overlays/overlay_dungeon_chest_rare_empty_v001.png",
      "assets/map/overlays/overlay_npc_elder_v002.png",
      "assets/map/overlays/overlay_npc_villager_v002.png",
      "assets/map/overlays/overlay_npc_child_v002.png",
      "assets/map/overlays/overlay_npc_bronze_knight_v002.png",
      "assets/generated/hero-down-1.gif", "assets/generated/hero-down-2.gif",
      "assets/generated/hero-up-1.gif", "assets/generated/hero-up-2.gif",
      "assets/generated/hero-left-1.gif", "assets/generated/hero-left-2.gif",
      "assets/generated/hero-right-1.gif", "assets/generated/hero-right-2.gif",
    ],
    openingImages: [
      "assets/generated/opening-prism-collapse-v002.png",
      "assets/background/PRISMA ABYSS.png",
      "assets/effect/fx_special_rupture_v001.png",
    ],
    startupImages: [],
    installImages: [],
    backgroundImages: [],
  },
};


// ブラウザでもService Worker(importScripts)でも参照できるよう globalThis に出す。
// sw.js はこの PRISMA_ASSETS.cacheWarmup を読み、画像初回キャッシュ対象を決める。
const PRISMA_MAP_CHIP_DECORATION_SLUGS = new Set([
  "wildflowers", "medicinal_herbs", "mushroom_patch", "mossy_stone", "exposed_roots", "fern_patch", "red_mushrooms",
  "glowing_fungus", "rock_pile", "mineral_puddle", "pale_mushrooms", "bone_pile", "spring_vent", "lava_vent",
  "ember_fissure", "scorched_bones", "ash_heap", "puddle_ripple", "shell_cluster", "seaweed_clump", "sea_anemone",
  "bubble_vent", "starfish_debris", "cable_coil", "broken_conduit", "floor_grate", "gold_inlay", "luminous_flower",
  "star_mosaic", "marble_rubble", "chain_pile", "horned_skull", "broken_armor", "ritual_rune", "rope_coil",
  "brass_pipe", "iron_anchor",
]);
Object.entries(PRISMA_MAP_CHIP_LIBRARY_GROUPS).forEach(([theme, slugs]) => {
  slugs.forEach((slug) => {
    const key = `maplib_${theme}_${slug}`;
    const role = PRISMA_MAP_CHIP_DECORATION_SLUGS.has(slug) ? "decoration" : "blocking";
    PRISMA_ASSETS.graphics[key] = `assets/map/library/${theme}/${role}/maplib_${theme}_${slug}_v001.png`;
  });
});
// 採用済みライブラリモンスターは、戦闘とフィールド表示の双方が同じ原画を参照する。
// IDと用途は個別に決めており、この対応表から自動採番・自動配置は行わない。
globalThis.PRISMA_ASSETS = PRISMA_ASSETS;

// backgroundImages は graphics / battleFx / monster画像から自動構築する。
// 画像を追加した場合は PRISMA_ASSETS.graphics または battleFx に足せば、裏側キャッシュにも反映される。
(() => {
  const unique = (items) => Array.from(new Set(items.filter(Boolean)));
  const critical = unique(PRISMA_ASSETS.cacheWarmup.criticalImages || []);
  const allImages = unique([
    ...Object.values(PRISMA_ASSETS.graphics || {}),
    ...Object.values(PRISMA_ASSETS.battleFx || {}),
    "assets/gacha/back_card.png",
    "assets/gacha/front_card.png",
    "assets/background/PRISMA ABYSS.png",
    "assets/background/bg_inn.jpg",
    "assets/background/bg_medal.png",
    "assets/background/bg_casino.png",
    ...PRISMA_MONSTER_IMAGE_FILES,
  ]);

  // ローディング画面中にブラウザ側でも先読みする対象。
  // ここを増やしすぎると起動待ちが長くなるため、初回表示で目立つ素材に絞る。
  PRISMA_ASSETS.cacheWarmup.startupImages = unique([...critical]);

  // Service Worker install時に一度だけキャッシュする対象。
  // 画像リストの正本はここ。sw.js 側へ手書きで複製しないこと。
  PRISMA_ASSETS.cacheWarmup.installImages = allImages;

  // install後の補助ウォームキャッシュ用。installに失敗/未完了だった画像もここで再試行される。
  PRISMA_ASSETS.cacheWarmup.backgroundImages = allImages.filter((src) => !critical.includes(src));
})();

// マップ上のボスチップは低解像度の overlay_boss_* ではなく、
// 戦闘用モンスター原画 assets/monsters/monster_*.png を直接参照できるキーも用意する。
// overlay_boss_* は既存参照互換のため残すが、新規コードは monster_* を優先する。
PRISMA_BOSS_MONSTER_IMAGE_IDS.forEach((id) => {
  const key = `monster_${id}`;
  if (!PRISMA_ASSETS.graphics[key]) {
    PRISMA_ASSETS.graphics[key] = `assets/monsters/monster_${id}.png`;
  }
});
[100078, 100081, 100082, 100089].forEach((id) => {
  const key = `monster_${id}`;
  if (!PRISMA_ASSETS.graphics[key]) {
    PRISMA_ASSETS.graphics[key] = `assets/monsters/monster_${id}.png`;
  }
});

const GRAPHICS = {
  images: {},
  loading: {},
  spriteDefs: {},
  loadedCount: 0,
  totalCount: 0,
  data: PRISMA_ASSETS.graphics,

  load(callback, options = {}) {
    const keys = options.keys || Object.keys(GRAPHICS.data);
    GRAPHICS.loadedCount = 0;
    GRAPHICS.totalCount = keys.length;

    if (!keys.length) {
      if (callback) callback();
      return;
    }

    const done = () => {
      GRAPHICS.loadedCount += 1;
      if (GRAPHICS.loadedCount >= GRAPHICS.totalCount && callback) callback();
    };

    keys.forEach((key) => {
      const src = GRAPHICS.data[key];
      if (!src) {
        done();
        return;
      }

      const img = new Image();
      img.onload = () => {
        GRAPHICS.images[key] = img;
        done();
      };
      img.onerror = () => {
        delete GRAPHICS.images[key];
        console.warn(`[GRAPHICS] 画像読み込み失敗: ${key} -> ${src}`);
        done();
      };
      img.src = src;
    });
  },

  // 将来、特定画像だけ遅延読み込みしたい場合の入口。
  // 画像管理を分散させず、この関数から PRISMA_ASSETS.graphics を参照する。
  get(key) {
    if (GRAPHICS.images[key]) return GRAPHICS.images[key];
    if (GRAPHICS.loading[key]) return GRAPHICS.loading[key];

    const src = GRAPHICS.data[key];
    if (!src) return null;

    const img = new Image();
    GRAPHICS.loading[key] = img;
    img.onload = () => {
      delete GRAPHICS.loading[key];
      GRAPHICS.images[key] = img;
      if (!GRAPHICS.redrawQueued) {
        GRAPHICS.redrawQueued = true;
        requestAnimationFrame(() => {
          GRAPHICS.redrawQueued = false;
          // Phaser側は静的マップ署名が同じだとプレイヤーだけを更新する。
          // 遅延画像をテクスチャへ追加した直後は静的層を明示的に破棄し、
          // 「一歩歩くまで画像が出ない」状態を作らない。
          if (typeof PhaserFieldRenderer !== "undefined" && typeof PhaserFieldRenderer.refresh === "function") {
            PhaserFieldRenderer.refresh();
          } else if (typeof Field !== "undefined" && typeof Field.render === "function") {
            Field.render();
          }
        });
      }
    };
    img.onerror = () => {
      delete GRAPHICS.loading[key];
      delete GRAPHICS.images[key];
      console.warn(`[GRAPHICS] 遅延読み込み失敗: ${key} -> ${src}`);
    };
    img.src = src;
    return img;
  },
};

window.GRAPHICS = GRAPHICS;
