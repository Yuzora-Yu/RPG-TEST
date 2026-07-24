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
 * - モンスター画像は monsters.js のIDから自動登録する。assets.jsへID配列を追加しないこと。
 * - polish.js 側に画像パス一覧を再作成しないこと。
 * - Base64画像の大量埋め込みは避け、原則として assets/ 配下の画像ファイルを参照すること。
 *
 * Service Worker 側の注意:
 * - 2026-05-14時点では、初回表示品質を優先し、初回起動時に画像もまとめてキャッシュする。
 * - 一般画像リストの正本は assets.js、モンスターIDの正本は monsters.js。sw.js 側へ配列を複製しないこと。
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
// - 共通画像規則の正本は assets.js、モンスターIDの正本は monsters.js。
// - main.js は startupImages をローディング中に先読みし、sw.js は installImages を初回キャッシュする。
const PRISMA_MONSTER_IMAGE_BASE = "assets/monsters/";
const PRISMA_MONSTER_IMAGE_IDS = [];
const PRISMA_MONSTER_IMAGE_FILES = [];

const normalizePrismaMonsterId = (monsterOrId) => {
  const raw = (monsterOrId && typeof monsterOrId === "object")
    ? (monsterOrId.baseId ?? monsterOrId.id)
    : monsterOrId;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
};

const prismaMonsterImagePath = (monsterOrId) => {
  const id = normalizePrismaMonsterId(monsterOrId);
  return id === null ? null : `${PRISMA_MONSTER_IMAGE_BASE}monster_${id}.png`;
};

const prismaMonsterGraphicKey = (monsterOrId) => {
  const id = normalizePrismaMonsterId(monsterOrId);
  return id === null ? null : `monster_${id}`;
};

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
// monsters.js の preloadAtStartup フラグから、開幕前に必要な画像だけを自動抽出する。
const PRISMA_STARTUP_MONSTER_IMAGE_FILES = [];
const PRISMA_STARTUP_MONSTER_GRAPHIC_KEYS = [];

const PRISMA_ASSETS = {
  // Field.render / Battle 背景 / 主人公歩行画像で使う GRAPHICS 用画像。
  graphics: {
    opening_prism_collapse: "assets/generated/opening-prism-collapse.png",
    item_icon_attack: "assets/ui/menu-icons/item-attack.png",
    item_icon_buff: "assets/ui/menu-icons/item-buff.png",
    item_icon_debuff: "assets/ui/menu-icons/item-debuff.png",
    item_icon_material: "assets/ui/menu-icons/item-material.png",
    item_icon_vehicle: "assets/ui/menu-icons/item-vehicle.png",
    item_icon_travel: "assets/ui/menu-icons/item-travel.png",
    item_icon_heal: "assets/ui/menu-icons/item-heal.png",
    item_icon_revive: "assets/ui/menu-icons/item-revive.png",
    item_icon_growth: "assets/ui/menu-icons/item-growth.png",
    item_icon_key: "assets/ui/menu-icons/item-key.png",
    floor: "assets/map/terrain/terrain_grass_field.png",
    sea: "assets/map/terrain/terrain_sea.png",
    forest: "assets/map/objects/object_field_forest.png",
    mountain: "assets/map/objects/object_field_mountain.png",
    Low_mountain: "assets/map/objects/object_field_low_mountain.png",
    wall: "assets/map/terrain/terrain_dungeon_wall.png",
    wall_face: "assets/map/terrain/terrain_dungeon_wall_face.png",
    wall_face_torch: "assets/map/terrain/terrain_dungeon_wall_face_torch.png",
    tile_fire_wall_face: "assets/map/terrain/tile_fire_wall_face.png",
    tile_wind_temple_wall_face: "assets/map/terrain/tile_wind_temple_wall_face.png",
    tile_wind_hole_wall_face: "assets/map/terrain/tile_wind_hole_wall_face.png",
    tile_tower_wall_face: "assets/map/terrain/tile_tower_wall_face.png",
    tile_thunder_wall_face: "assets/map/terrain/tile_thunder_wall_face.png",
    tile_dark_castle_wall_face: "assets/map/terrain/tile_dark_castle_wall_face.png",
    tile_galvania_wall_face: "assets/map/terrain/tile_galvania_wall_face.png",
    tile_grezelia_wall_face: "assets/map/terrain/tile_grezelia_wall_face.png",
    magma: "assets/map/terrain/magma.png",
    dungeon_floor: "assets/map/terrain/terrain_dungeon_floor.png",
    stairs: "assets/map/objects/object_field_stairs.png",
    stairs_dungeon: "assets/map/objects/object_dungeon_stairs.png",
    cave: "assets/map/objects/object_field_cave.png",
    cave_dungeon: "assets/map/terrain/terrain_dungeon_floor.png",
    hall: "assets/map/objects/object_field_hall.png",
    "house-1": "assets/map/objects/object_field_house_1.png",
    "house-2": "assets/map/objects/object_field_house_2.png",
    village: "assets/map/objects/object_field_village.png",
    inn: "assets/map/objects/object_field_inn.png",
    casino: "assets/map/objects/object_field_casino.png",
    weapon: "assets/map/objects/object_field_weapon.png",
    shop: "assets/map/objects/object_field_shop.png",
    medal: "assets/map/objects/object_field_medal.png",
    town: "assets/map/objects/object_field_town.png",
    settlement: "assets/map/objects/object_field_settlement.png",
    castle: "assets/map/objects/object_field_castle.png",
    temple: "assets/map/objects/object_field_temple.png",
    fortress: "assets/map/objects/object_field_fortress.png",
    ruins: "assets/map/objects/object_field_ruins.png",
    lost: "assets/map/objects/object_field_lost.png",
    darkcastle: "assets/map/objects/object_field_darkcastle.png",
    lighthouse: "assets/map/objects/object_field_lighthouse.png",
    tower: "assets/map/objects/object_field_tower.png",
    farm: "assets/map/objects/object_field_farm.png",
    pot_grass: "assets/map/objects/object_field_pot.png",
    barrel_grass: "assets/map/objects/object_field_barrel.png",
    chest: "assets/map/objects/object_field_chest.png",
    chest_rare: "assets/map/objects/object_field_chest_rare.png",
    chest_dungeon: "assets/map/objects/object_dungeon_chest.png",
    chest_rare_dungeon: "assets/map/objects/object_dungeon_chest_rare.png",
    smith: "assets/map/objects/object_field_smith.png",
    fire_village: "assets/map/objects/object_field_fire_village.png",
    dummy_grass: "assets/map/objects/object_field_grass.png",
    boss: "assets/map/objects/object_field_boss.png",
    boss_dungeon: "assets/map/objects/object_dungeon_boss.png",

    // 固定ダンジョン用オーバーレイ。
    // 床タイルを先に描画し、その上へ重ねるための画像。差し替えはこのパスだけでOK。
    overlay_named_dungeon_boss: "assets/map/overlays/overlay_named_dungeon_boss.png",
    overlay_named_dungeon_chest_rare: "assets/map/overlays/overlay_named_dungeon_chest_rare.png",
    overlay_named_dungeon_chest: "assets/map/overlays/overlay_named_dungeon_chest.png",
    overlay_named_dungeon_stairs_down: "assets/map/overlays/overlay_named_dungeon_stairs_down.png",
    overlay_named_dungeon_stairs_up: "assets/map/overlays/overlay_named_dungeon_stairs_up.png",

    // 固定MAP/ワールド表示用オーバーレイ（床の上に重ねる画像）。
    overlay_field_barrel: "assets/map/overlays/overlay_field_barrel.png",
    overlay_field_boss: "assets/map/overlays/overlay_field_boss.png",
    overlay_field_casino: "assets/map/overlays/overlay_field_casino.png",
    overlay_field_castle: "assets/map/overlays/overlay_field_castle.png",
    overlay_field_cave: "assets/map/overlays/overlay_field_cave.png",
    overlay_field_chest: "assets/map/overlays/overlay_field_chest.png",
    overlay_field_chest_rare: "assets/map/overlays/overlay_field_chest_rare.png",
    overlay_field_darkcastle: "assets/map/overlays/overlay_field_darkcastle.png",
    overlay_field_event: "assets/map/overlays/overlay_field_event.png",
    overlay_event_blue_glimmer: "assets/map/overlays/overlay_event_blue_glimmer.png",
    overlay_field_farm: "assets/map/overlays/overlay_field_farm.png",
    overlay_field_fire_village: "assets/map/overlays/overlay_field_fire_village.png",
    overlay_field_forest: "assets/map/overlays/overlay_field_forest.png",
    overlay_field_fortress: "assets/map/overlays/overlay_field_fortress.png",
    overlay_field_grass: "assets/map/overlays/overlay_field_grass.png",
    overlay_field_hall: "assets/map/overlays/overlay_field_hall.png",
    overlay_field_house_1: "assets/map/overlays/overlay_field_house_1.png",
    overlay_field_house_2: "assets/map/overlays/overlay_field_house_2.png",
    overlay_field_inn: "assets/map/overlays/overlay_field_inn.png",
    overlay_field_lighthouse: "assets/map/overlays/overlay_field_lighthouse.png",
    overlay_field_lost: "assets/map/overlays/overlay_field_lost.png",
    overlay_field_low_mountain: "assets/map/overlays/overlay_field_low_mountain.png",
    overlay_field_medal: "assets/map/overlays/overlay_field_medal.png",
    overlay_field_mountain: "assets/map/overlays/overlay_field_mountain.png",
    overlay_field_pot: "assets/map/overlays/overlay_field_pot.png",
    overlay_field_ruins: "assets/map/overlays/overlay_field_ruins.png",
    overlay_field_settlement: "assets/map/overlays/overlay_field_settlement.png",
    overlay_field_shop: "assets/map/overlays/overlay_field_shop.png",
    overlay_field_smith: "assets/map/overlays/overlay_field_smith.png",
    overlay_field_stairs: "assets/map/overlays/overlay_field_stairs.png",
    overlay_field_temple: "assets/map/overlays/overlay_field_temple.png",
    overlay_field_tower: "assets/map/overlays/overlay_field_tower.png",
    overlay_field_town: "assets/map/overlays/overlay_field_town.png",
    overlay_field_village: "assets/map/overlays/overlay_field_village.png",
    overlay_field_weapon: "assets/map/overlays/overlay_field_weapon.png",
    overlay_decor_default_cave_dust: "assets/map/overlays/overlay_decor_default_cave_dust.png",
    overlay_decor_start_village_herbs: "assets/map/overlays/overlay_decor_start_village_herbs.png",
    overlay_decor_start_cave_damp: "assets/map/overlays/overlay_decor_start_cave_damp.png",
    overlay_decor_fire_ember_fissure: "assets/map/overlays/overlay_decor_fire_ember_fissure.png",
    overlay_decor_wind_village_feather: "assets/map/overlays/overlay_decor_wind_village_feather.png",
    overlay_decor_wind_hole_root: "assets/map/overlays/overlay_decor_wind_hole_root.png",
    overlay_decor_forbidden_forest_moss: "assets/map/overlays/overlay_decor_forbidden_forest_moss.png",
    overlay_decor_water_city_puddle: "assets/map/overlays/overlay_decor_water_city_puddle.png",
    overlay_decor_big_tower_gear_oil: "assets/map/overlays/overlay_decor_big_tower_gear_oil.png",
    overlay_decor_thunder_fort_wiring: "assets/map/overlays/overlay_decor_thunder_fort_wiring.png",
    overlay_decor_light_palace_prism: "assets/map/overlays/overlay_decor_light_palace_prism.png",
    overlay_decor_galvania_crystal: "assets/map/overlays/overlay_decor_galvania_crystal.png",
    overlay_decor_dark_castle_chain: "assets/map/overlays/overlay_decor_dark_castle_chain.png",
    overlay_decor_crena_limestone_pool: "assets/map/overlays/overlay_decor_crena_limestone_pool.png",
    overlay_decor_seabed_temple_ripple: "assets/map/overlays/overlay_decor_seabed_temple_ripple.png",
    overlay_decor_dark_shrine_sigil: "assets/map/overlays/overlay_decor_dark_shrine_sigil.png",
    overlay_decor_grezelia_fossil: "assets/map/overlays/overlay_decor_grezelia_fossil.png",
    overlay_decor_abyss_void_dust: "assets/map/overlays/overlay_decor_abyss_void_dust.png",
    overlay_decor_abyss_field_flora: "assets/map/overlays/overlay_decor_abyss_field_flora.png",
    overlay_decor_ruined_shrine_glyph: "assets/map/overlays/overlay_decor_ruined_shrine_glyph.png",
    overlay_castle_carpet_fill: "assets/map/overlays/overlay_castle_carpet_fill.png",
    overlay_castle_carpet_edge_n: "assets/map/overlays/overlay_castle_carpet_edge_n.png",
    overlay_castle_carpet_edge_s: "assets/map/overlays/overlay_castle_carpet_edge_s.png",
    overlay_castle_carpet_edge_w: "assets/map/overlays/overlay_castle_carpet_edge_w.png",
    overlay_castle_carpet_edge_e: "assets/map/overlays/overlay_castle_carpet_edge_e.png",
    overlay_castle_carpet_corner_nw: "assets/map/overlays/overlay_castle_carpet_corner_nw.png",
    overlay_castle_carpet_corner_ne: "assets/map/overlays/overlay_castle_carpet_corner_ne.png",
    overlay_castle_carpet_corner_sw: "assets/map/overlays/overlay_castle_carpet_corner_sw.png",
    overlay_castle_carpet_corner_se: "assets/map/overlays/overlay_castle_carpet_corner_se.png",
    overlay_castle_carpet_blue_silver_fill: "assets/map/overlays/overlay_castle_carpet_blue_silver_fill.png",
    overlay_castle_carpet_blue_silver_edge_n: "assets/map/overlays/overlay_castle_carpet_blue_silver_edge_n.png",
    overlay_castle_carpet_blue_silver_edge_s: "assets/map/overlays/overlay_castle_carpet_blue_silver_edge_s.png",
    overlay_castle_carpet_blue_silver_edge_w: "assets/map/overlays/overlay_castle_carpet_blue_silver_edge_w.png",
    overlay_castle_carpet_blue_silver_edge_e: "assets/map/overlays/overlay_castle_carpet_blue_silver_edge_e.png",
    overlay_castle_carpet_blue_silver_corner_nw: "assets/map/overlays/overlay_castle_carpet_blue_silver_corner_nw.png",
    overlay_castle_carpet_blue_silver_corner_ne: "assets/map/overlays/overlay_castle_carpet_blue_silver_corner_ne.png",
    overlay_castle_carpet_blue_silver_corner_sw: "assets/map/overlays/overlay_castle_carpet_blue_silver_corner_sw.png",
    overlay_castle_carpet_blue_silver_corner_se: "assets/map/overlays/overlay_castle_carpet_blue_silver_corner_se.png",
    overlay_village_goza_fill: "assets/map/overlays/overlay_village_goza_fill.png",
    overlay_village_goza_edge_n: "assets/map/overlays/overlay_village_goza_edge_n.png",
    overlay_village_goza_edge_s: "assets/map/overlays/overlay_village_goza_edge_s.png",
    overlay_village_goza_edge_w: "assets/map/overlays/overlay_village_goza_edge_w.png",
    overlay_village_goza_edge_e: "assets/map/overlays/overlay_village_goza_edge_e.png",
    overlay_village_goza_corner_nw: "assets/map/overlays/overlay_village_goza_corner_nw.png",
    overlay_village_goza_corner_ne: "assets/map/overlays/overlay_village_goza_corner_ne.png",
    overlay_village_goza_corner_sw: "assets/map/overlays/overlay_village_goza_corner_sw.png",
    overlay_village_goza_corner_se: "assets/map/overlays/overlay_village_goza_corner_se.png",
    overlay_world_grass_detail: "assets/map/overlays/overlay_world_grass_detail.png",
    overlay_world_grass_weeds: "assets/map/overlays/overlay_world_grass_weeds.png",
    overlay_world_grass_earth: "assets/map/overlays/overlay_world_grass_earth.png",
    overlay_world_forest_understory: "assets/map/overlays/overlay_world_forest_understory.png",
    overlay_world_forest_roots: "assets/map/overlays/overlay_world_forest_roots.png",
    overlay_world_foothill_rocks: "assets/map/overlays/overlay_world_foothill_rocks.png",
    overlay_world_shore_foam: "assets/map/overlays/overlay_world_shore_foam.png",
    overlay_world_bridge_wood: "assets/map/overlays/overlay_world_bridge_wood.png",
    overlay_dungeon_boss: "assets/map/overlays/overlay_dungeon_boss.png",
    overlay_dungeon_chest: "assets/map/overlays/overlay_dungeon_chest.png",
    overlay_dungeon_chest_rare: "assets/map/overlays/overlay_dungeon_chest_rare.png",
    overlay_dungeon_chest_empty: "assets/map/overlays/overlay_dungeon_chest_empty.png",
    overlay_dungeon_chest_rare_empty: "assets/map/overlays/overlay_dungeon_chest_rare_empty.png",
    overlay_dungeon_event: "assets/map/overlays/overlay_dungeon_event.png",
    overlay_dungeon_portal: "assets/map/overlays/overlay_dungeon_portal.png",
    overlay_dungeon_stairs: "assets/map/overlays/overlay_dungeon_stairs.png",
    door_key_red: "assets/map/objects/door_key_red.png",
    door_key_blue: "assets/map/objects/door_key_blue.png",
    door_key_gold: "assets/map/objects/door_key_gold.png",
    object_blocking_castle_candelabrum: "assets/map/objects/object_blocking_castle_candelabrum.png",
    object_blocking_forest_stump: "assets/map/objects/object_blocking_forest_stump.png",
    object_blocking_thunder_terminal: "assets/map/objects/object_blocking_thunder_terminal.png",
    object_blocking_cave_stalagmite: "assets/map/objects/object_blocking_cave_stalagmite.png",
    object_blocking_seabed_coral_pillar: "assets/map/objects/object_blocking_seabed_coral_pillar.png",
    object_blocking_light_crystal_pedestal: "assets/map/objects/object_blocking_light_crystal_pedestal.png",
    object_blocking_fire_brazier: "assets/map/objects/object_blocking_fire_brazier.png",
    object_blocking_lighthouse_gear_pedestal: "assets/map/objects/object_blocking_lighthouse_gear_pedestal.png",
    object_blocking_dark_shrine_obelisk: "assets/map/objects/object_blocking_dark_shrine_obelisk.png",
    item_key_red: "assets/map/objects/item_key_red.png",
    item_key_blue: "assets/map/objects/item_key_blue.png",
    item_key_gold: "assets/map/objects/item_key_gold.png",
    overlay_npc_elder: "assets/map/overlays/overlay_npc_elder.png",
    overlay_npc_villager: "assets/map/overlays/overlay_npc_villager.png",
    overlay_npc_child: "assets/map/overlays/overlay_npc_child.png",
    overlay_npc_dark_soldier: "assets/map/overlays/overlay_npc_dark_soldier.png",
    overlay_npc_bronze_knight: "assets/map/overlays/overlay_npc_bronze_knight.png",
    overlay_light_captive_king: "assets/map/overlays/overlay_light_captive_king.png",
    overlay_light_captive_princess: "assets/map/overlays/overlay_light_captive_princess.png",
    overlay_light_captive_priest_a: "assets/map/overlays/overlay_light_captive_priest_a.png",
    overlay_light_captive_priest_b: "assets/map/overlays/overlay_light_captive_priest_b.png",
    overlay_light_captive_leila_bed: "assets/map/overlays/overlay_light_captive_leila_bed.png",
    overlay_light_prison_gate_horizontal: "assets/map/overlays/overlay_light_prison_gate_horizontal.png",
    overlay_companion_marie: "assets/map/overlays/overlay_companion_marie.png",
    overlay_companion_zelied: "assets/map/overlays/overlay_companion_zelied.png",
    overlay_companion_hayate: "assets/map/overlays/overlay_companion_hayate.png",
    overlay_companion_sylvia: "assets/map/overlays/overlay_companion_sylvia.png",
    overlay_companion_rin: "assets/map/overlays/overlay_companion_rin.png",
    overlay_companion_sophia: "assets/map/overlays/overlay_companion_sophia.png",
    overlay_companion_alan: "assets/map/overlays/overlay_companion_alan.png",
    overlay_companion_frieda: "assets/map/overlays/overlay_companion_frieda.png",
    overlay_companion_baron: "assets/map/overlays/overlay_companion_baron.png",
    overlay_companion_karin: "assets/map/overlays/overlay_companion_karin.png",
    overlay_companion_arisa: "assets/map/overlays/overlay_companion_arisa.png",
    overlay_companion_haine: "assets/map/overlays/overlay_companion_haine.png",
    overlay_companion_claude: "assets/map/overlays/overlay_companion_claude.png",
    overlay_companion_leon: "assets/map/overlays/overlay_companion_leon.png",
    overlay_companion_luna: "assets/map/overlays/overlay_companion_luna.png",
    overlay_companion_licia: "assets/map/overlays/overlay_companion_licia.png",
    overlay_companion_ryu: "assets/map/overlays/overlay_companion_ryu.png",
    overlay_companion_minerva: "assets/map/overlays/overlay_companion_minerva.png",
    overlay_companion_zenon: "assets/map/overlays/overlay_companion_zenon.png",
    overlay_town_fire_blacksmith: "assets/map/overlays/overlay_town_fire_blacksmith.png",
    overlay_town_fire_coal_carrier: "assets/map/overlays/overlay_town_fire_coal_carrier.png",
    overlay_town_fire_resident: "assets/map/overlays/overlay_town_fire_resident.png",
    overlay_town_wind_watch: "assets/map/overlays/overlay_town_wind_watch.png",
    overlay_town_wind_weaver: "assets/map/overlays/overlay_town_wind_weaver.png",
    overlay_town_water_guard: "assets/map/overlays/overlay_town_water_guard.png",
    overlay_town_water_boatman: "assets/map/overlays/overlay_town_water_boatman.png",
    overlay_town_light_pilgrim: "assets/map/overlays/overlay_town_light_pilgrim.png",
    overlay_town_demon_guard: "assets/map/overlays/overlay_town_demon_guard.png",
    overlay_monster_guardian: "assets/monsters/monster_100010.png",
    overlay_building_fire_forge: "assets/map/overlays/overlay_building_fire_forge.png",
    overlay_building_wind_hut: "assets/map/overlays/overlay_building_wind_hut.png",
    overlay_building_water_shop: "assets/map/overlays/overlay_building_water_shop.png",
    overlay_building_water_alchemy: "assets/map/overlays/overlay_building_water_alchemy.png",
    overlay_dungeon_warp: "assets/map/overlays/overlay_dungeon_warp.png",
    overlay_dungeon_trial_angel: "assets/map/overlays/overlay_dungeon_trial_angel.png",
    overlay_dungeon_adventurer: "assets/map/overlays/overlay_dungeon_adventurer.png",
    overlay_dungeon_adventurer_down_1: "assets/map/overlays/overlay_dungeon_adventurer_down_1.png",
    overlay_dungeon_adventurer_down_2: "assets/map/overlays/overlay_dungeon_adventurer_down_2.png",
    overlay_dungeon_adventurer_left_1: "assets/map/overlays/overlay_dungeon_adventurer_left_1.png",
    overlay_dungeon_adventurer_left_2: "assets/map/overlays/overlay_dungeon_adventurer_left_2.png",
    overlay_dungeon_adventurer_right_1: "assets/map/overlays/overlay_dungeon_adventurer_right_1.png",
    overlay_dungeon_adventurer_right_2: "assets/map/overlays/overlay_dungeon_adventurer_right_2.png",
    overlay_dungeon_adventurer_up_1: "assets/map/overlays/overlay_dungeon_adventurer_up_1.png",
    overlay_dungeon_adventurer_up_2: "assets/map/overlays/overlay_dungeon_adventurer_up_2.png",
                                "buff-ai": "assets/effect/fx-buff-ai.png",
                                "abyss-vortex": "assets/effect/fx-abyss-vortex-ai.png",
    overlay_dungeon_hunter: "assets/map/overlays/overlay_dungeon_hunter.png",
    overlay_dungeon_hunter_fire: "assets/map/overlays/overlay_dungeon_hunter_fire.png",
    overlay_dungeon_hunter_forest: "assets/map/overlays/overlay_dungeon_hunter_forest.png",
    overlay_dungeon_hunter_sea: "assets/map/overlays/overlay_dungeon_hunter_sea.png",
    overlay_dungeon_hunter_thunder: "assets/map/overlays/overlay_dungeon_hunter_thunder.png",
    overlay_dungeon_hunter_shadow: "assets/map/overlays/overlay_dungeon_hunter_shadow.png",
    overlay_magic_boat_down: "assets/map/overlays/overlay_magic_boat_down.png",
    overlay_magic_boat_up: "assets/map/overlays/overlay_magic_boat_up.png",
    overlay_magic_boat_left: "assets/map/overlays/overlay_magic_boat_left.png",
    overlay_magic_boat_right: "assets/map/overlays/overlay_magic_boat_right.png",

    // 地域別マップチップ（map.js の TILE_THEMES から参照）
    tile_fire_wall: "assets/map/terrain/tile_fire_wall.png",
    tile_fire_floor: "assets/map/terrain/tile_fire_floor.png",
    tile_magma: "assets/map/terrain/tile_magma.png",
    tile_poison_bog: "assets/map/terrain/tile_poison_bog.png",
    tile_ice_slide: "assets/map/terrain/tile_ice_slide.png",
    tile_wind_wall: "assets/map/terrain/tile_forest_wall.png",
    tile_forest_wall: "assets/map/terrain/tile_forest_wall.png",
    tile_wind_floor: "assets/map/terrain/tile_wind_floor.png",
    tile_wind_bridge: "assets/map/terrain/tile_wind_bridge.png",
    tile_wind_temple_wall: "assets/map/terrain/tile_wind_temple_wall.png",
    tile_wind_temple_floor: "assets/map/terrain/tile_wind_temple_floor.png",
    tile_wind_hole_wall: "assets/map/terrain/tile_wind_hole_wall.png",
    tile_wind_hole_floor: "assets/map/terrain/tile_wind_hole_floor.png",
    tile_wind_hole_wall_2: "assets/map/terrain/tile_wind_hole_wall_variant_a.png",
    tile_wind_hole_wall_3: "assets/map/terrain/tile_wind_hole_wall_variant_b.png",
    tile_wind_hole_wall_4: "assets/map/terrain/tile_wind_hole_wall_variant_c.png",
    tile_wind_hole_floor_2: "assets/map/terrain/tile_wind_hole_floor_variant_a.png",
    tile_wind_hole_floor_3: "assets/map/terrain/tile_wind_hole_floor_variant_b.png",
    tile_wind_hole_floor_4: "assets/map/terrain/tile_wind_hole_floor_variant_c.png",
    tile_forbidden_forest_wall: "assets/map/terrain/tile_forbidden_forest_wall.png",
    tile_forbidden_forest_floor: "assets/map/terrain/tile_forbidden_forest_floor.png",
    tile_forbidden_forest_wall_2: "assets/map/terrain/tile_forbidden_forest_wall_variant_a.png",
    tile_forbidden_forest_wall_3: "assets/map/terrain/tile_forbidden_forest_wall_variant_b.png",
    tile_forbidden_forest_wall_4: "assets/map/terrain/tile_forbidden_forest_wall_variant_c.png",
    tile_forbidden_forest_floor_2: "assets/map/terrain/tile_forbidden_forest_floor_variant_a.png",
    tile_forbidden_forest_floor_3: "assets/map/terrain/tile_forbidden_forest_floor_variant_b.png",
    tile_forbidden_forest_floor_4: "assets/map/terrain/tile_forbidden_forest_floor_variant_c.png",
    tile_water_canal: "assets/map/terrain/tile_water_canal.png",
    tile_water_pave: "assets/map/terrain/tile_water_pave.png",
    tile_water_bridge: "assets/map/terrain/tile_water_bridge.png",
    tile_tower_wall: "assets/map/terrain/tile_tower_wall.png",
    tile_tower_floor: "assets/map/terrain/tile_tower_floor.png",
    tile_thunder_wall: "assets/map/terrain/tile_thunder_wall.png",
    tile_thunder_floor: "assets/map/terrain/tile_thunder_floor.png",
    tile_thunder_wall_2: "assets/map/terrain/tile_thunder_wall_alt.png",
    tile_thunder_wall_3: "assets/map/terrain/tile_thunder_wall_alt_variant_a.png",
    tile_thunder_wall_4: "assets/map/terrain/tile_thunder_wall_alt_variant_b.png",
    tile_thunder_floor_2: "assets/map/terrain/tile_thunder_floor_alt.png",
    tile_thunder_floor_3: "assets/map/terrain/tile_thunder_floor_alt_variant_a.png",
    tile_thunder_floor_4: "assets/map/terrain/tile_thunder_floor_alt_variant_b.png",
    tile_light_wall: "assets/map/terrain/tile_light_wall.png",
    tile_light_floor: "assets/map/terrain/tile_light_floor.png",
    tile_light_wall_face: "assets/map/terrain/tile_light_wall_face.png",
    tile_light_wall_face_prism: "assets/map/terrain/tile_light_wall_face_prism.png",
    tile_dark_wall: "assets/map/terrain/tile_dark_wall.png",
    tile_dark_floor: "assets/map/terrain/tile_dark_floor.png",
    tile_dark_wall_2: "assets/map/terrain/tile_dark_wall_alt.png",
    tile_dark_wall_3: "assets/map/terrain/tile_dark_wall_alt_variant_a.png",
    tile_dark_wall_4: "assets/map/terrain/tile_dark_wall_alt_variant_b.png",
    tile_dark_floor_2: "assets/map/terrain/tile_dark_floor_alt.png",
    tile_dark_floor_3: "assets/map/terrain/tile_dark_floor_alt_variant_a.png",
    tile_dark_floor_4: "assets/map/terrain/tile_dark_floor_alt_variant_b.png",
    tile_crena_floor: "assets/map/terrain/tile_crena_floor.png",
    tile_crena_water: "assets/map/terrain/tile_crena_water.png",
    tile_seabed_floor: "assets/map/terrain/tile_seabed_floor.png",
    tile_seabed_floor_2: "assets/map/terrain/tile_seabed_floor_alt.png",
    tile_seabed_floor_3: "assets/map/terrain/tile_seabed_floor_alt_variant_a.png",
    tile_seabed_floor_4: "assets/map/terrain/tile_seabed_floor_alt_variant_b.png",
    tile_dark_shrine_wall: "assets/map/terrain/tile_dark_shrine_wall.png",
    tile_dark_shrine_floor: "assets/map/terrain/tile_dark_shrine_floor.png",
    tile_dark_shrine_wall_2: "assets/map/terrain/tile_dark_shrine_wall_alt.png",
    tile_dark_shrine_wall_3: "assets/map/terrain/tile_dark_shrine_wall_alt_variant_a.png",
    tile_dark_shrine_wall_4: "assets/map/terrain/tile_dark_shrine_wall_alt_variant_b.png",
    tile_dark_shrine_wall_face: "assets/map/terrain/tile_dark_shrine_wall_face.png",
    tile_dark_shrine_floor_2: "assets/map/terrain/tile_dark_shrine_floor_alt.png",
    tile_dark_shrine_floor_3: "assets/map/terrain/tile_dark_shrine_floor_alt_variant_a.png",
    tile_dark_shrine_floor_4: "assets/map/terrain/tile_dark_shrine_floor_alt_variant_b.png",
    tile_galvania_wall: "assets/map/terrain/tile_galvania_wall.png",
    tile_galvania_wall_2: "assets/map/terrain/tile_galvania_wall_alt.png",
    tile_galvania_wall_3: "assets/map/terrain/tile_galvania_wall_alt_variant_a.png",
    tile_galvania_wall_4: "assets/map/terrain/tile_galvania_wall_alt_variant_b.png",
    tile_galvania_floor: "assets/map/terrain/tile_galvania_floor.png",
    tile_galvania_floor_2: "assets/map/terrain/tile_galvania_floor_alt.png",
    tile_galvania_floor_3: "assets/map/terrain/tile_galvania_floor_alt_variant_a.png",
    tile_galvania_floor_4: "assets/map/terrain/tile_galvania_floor_alt_variant_b.png",
    tile_grezelia_wall: "assets/map/terrain/tile_grezelia_wall.png",
    tile_grezelia_floor: "assets/map/terrain/tile_grezelia_floor.png",
    tile_grezelia_wall_2: "assets/map/terrain/tile_grezelia_wall_alt.png",
    tile_grezelia_wall_3: "assets/map/terrain/tile_grezelia_wall_alt_variant_a.png",
    tile_grezelia_wall_4: "assets/map/terrain/tile_grezelia_wall_alt_variant_b.png",
    tile_grezelia_floor_2: "assets/map/terrain/tile_grezelia_floor_alt.png",
    tile_grezelia_floor_3: "assets/map/terrain/tile_grezelia_floor_alt_variant_a.png",
    tile_grezelia_floor_4: "assets/map/terrain/tile_grezelia_floor_alt_variant_b.png",
    tile_abyss_grass: "assets/map/terrain/tile_abyss_grass.png",
    tile_abyss_path: "assets/map/terrain/tile_abyss_path.png",
    tile_abyss_outer_wall: "assets/map/terrain/tile_abyss_outer_wall_variant_a.png",
    tile_abyss_outer_wall_2: "assets/map/terrain/tile_abyss_outer_wall_variant_b.png",
    tile_abyss_outer_wall_3: "assets/map/terrain/tile_abyss_outer_wall_variant_c.png",
    tile_abyss_outer_wall_4: "assets/map/terrain/tile_abyss_outer_wall_variant_d.png",
    tile_abyss_outer_floor: "assets/map/terrain/tile_abyss_outer_dark_floor_variant_a.png",
    tile_abyss_outer_floor_2: "assets/map/terrain/tile_abyss_outer_dark_floor_variant_b.png",
    tile_abyss_outer_floor_3: "assets/map/terrain/tile_abyss_outer_dark_floor_variant_c.png",
    tile_abyss_outer_floor_4: "assets/map/terrain/tile_abyss_outer_dark_floor_variant_d.png",
    tile_abyss_outer_prism_paving: "assets/map/terrain/tile_abyss_outer_prism_paving_variant_a.png",
    tile_abyss_outer_prism_paving_2: "assets/map/terrain/tile_abyss_outer_prism_paving_variant_b.png",
    tile_abyss_outer_prism_paving_3: "assets/map/terrain/tile_abyss_outer_prism_paving_variant_c.png",
    tile_abyss_outer_prism_paving_4: "assets/map/terrain/tile_abyss_outer_prism_paving_variant_d.png",
    overlay_abyss_outer_chasm_nw: "assets/map/overlays/overlay_abyss_outer_chasm_nw.png",
    overlay_abyss_outer_chasm_n: "assets/map/overlays/overlay_abyss_outer_chasm_n.png",
    overlay_abyss_outer_chasm_ne: "assets/map/overlays/overlay_abyss_outer_chasm_ne.png",
    overlay_abyss_outer_chasm_w: "assets/map/overlays/overlay_abyss_outer_chasm_w.png",
    overlay_abyss_outer_chasm_c: "assets/map/overlays/overlay_abyss_outer_chasm_c.png",
    overlay_abyss_outer_chasm_e: "assets/map/overlays/overlay_abyss_outer_chasm_e.png",
    overlay_abyss_outer_chasm_sw: "assets/map/overlays/overlay_abyss_outer_chasm_sw.png",
    overlay_abyss_outer_chasm_s: "assets/map/overlays/overlay_abyss_outer_chasm_s.png",
    overlay_abyss_outer_chasm_se: "assets/map/overlays/overlay_abyss_outer_chasm_se.png",
    overlay_abyss_outer_ruined_altar: "assets/map/overlays/overlay_abyss_outer_ruined_altar.png",
    overlay_abyss_outer_fallen_pillar: "assets/map/overlays/overlay_abyss_outer_fallen_pillar.png",
    overlay_abyss_outer_intact_column: "assets/map/overlays/overlay_abyss_outer_intact_column.png",
    overlay_abyss_outer_broken_column_stump: "assets/map/overlays/overlay_abyss_outer_broken_column_stump.png",
    overlay_abyss_outer_prism_pedestal_intact: "assets/map/overlays/overlay_abyss_outer_prism_pedestal_intact.png",
    overlay_abyss_outer_prism_pedestal_collapsed: "assets/map/overlays/overlay_abyss_outer_prism_pedestal_collapsed.png",
    tile_ruined_shrine_wall: "assets/map/terrain/tile_ruined_shrine_wall_variant_a.png",
    tile_ruined_shrine_wall_2: "assets/map/terrain/tile_ruined_shrine_wall_variant_b.png",
    tile_ruined_shrine_wall_3: "assets/map/terrain/tile_ruined_shrine_wall_variant_c.png",
    tile_ruined_shrine_wall_4: "assets/map/terrain/tile_ruined_shrine_wall_variant_d.png",
    tile_ruined_shrine_floor: "assets/map/terrain/tile_ruined_shrine_floor_variant_a.png",
    tile_ruined_shrine_floor_2: "assets/map/terrain/tile_ruined_shrine_floor_variant_b.png",
    tile_ruined_shrine_floor_3: "assets/map/terrain/tile_ruined_shrine_floor_variant_c.png",
    tile_ruined_shrine_floor_4: "assets/map/terrain/tile_ruined_shrine_floor_variant_d.png",
    tile_ruined_shrine_withered_grass: "assets/map/terrain/tile_ruined_shrine_withered_grass_variant_a.png",
    tile_ruined_shrine_withered_grass_2: "assets/map/terrain/tile_ruined_shrine_withered_grass_variant_b.png",
    tile_ruined_shrine_withered_grass_3: "assets/map/terrain/tile_ruined_shrine_withered_grass_variant_c.png",
    tile_ruined_shrine_withered_grass_4: "assets/map/terrain/tile_ruined_shrine_withered_grass_variant_d.png",
    tile_ruined_shrine_wall_face: "assets/map/terrain/tile_ruined_shrine_wall_face_variant_a.png",
    tile_ruined_shrine_wall_face_rooted: "assets/map/terrain/tile_ruined_shrine_wall_face_variant_b.png",
    overlay_ruined_shrine_pillar: "assets/map/overlays/overlay_ruined_shrine_pillar.png",
    overlay_ruined_shrine_raised_stage_a: "assets/map/overlays/overlay_ruined_shrine_raised_stage_variant_a.png",
    overlay_ruined_shrine_raised_stage_b: "assets/map/overlays/overlay_ruined_shrine_raised_stage_variant_b.png",
    overlay_ruined_shrine_raised_stage_c: "assets/map/overlays/overlay_ruined_shrine_raised_stage_variant_c.png",
    overlay_ruined_shrine_raised_stage_d: "assets/map/overlays/overlay_ruined_shrine_raised_stage_variant_d.png",
    overlay_ruined_shrine_raised_stage_e: "assets/map/overlays/overlay_ruined_shrine_raised_stage_variant_e.png",
    overlay_ruined_shrine_raised_stage_f: "assets/map/overlays/overlay_ruined_shrine_raised_stage_variant_f.png",
    overlay_ruined_shrine_ritual_astrolabe: "assets/map/overlays/overlay_ruined_shrine_ritual_astrolabe.png",
    overlay_ruined_shrine_rusted_sword: "assets/map/overlays/overlay_ruined_shrine_rusted_sword.png",
    overlay_ruined_shrine_rusted_spear: "assets/map/overlays/overlay_ruined_shrine_rusted_spear.png",
    overlay_ruined_shrine_rusted_axe: "assets/map/overlays/overlay_ruined_shrine_rusted_axe.png",
    tile_shrine_wall: "assets/map/terrain/tile_shrine_wall.png",
    tile_shrine_floor: "assets/map/terrain/tile_shrine_floor.png",
    tile_trial_shrine_floor: "assets/map/terrain/tile_trial_shrine_floor_variant_a.png",
    tile_trial_shrine_floor_2: "assets/map/terrain/tile_trial_shrine_floor_variant_b.png",
    tile_trial_shrine_wall: "assets/map/terrain/tile_trial_shrine_wall.png",
    tile_trial_shrine_wall_face: "assets/map/terrain/tile_trial_shrine_wall_face.png",
    overlay_trial_shrine_stage_a: "assets/map/overlays/overlay_trial_shrine_stage_variant_a.png",
    overlay_trial_shrine_stage_b: "assets/map/overlays/overlay_trial_shrine_stage_variant_b.png",
    overlay_trial_shrine_stage_c: "assets/map/overlays/overlay_trial_shrine_stage_variant_c.png",
    overlay_trial_shrine_stage_d: "assets/map/overlays/overlay_trial_shrine_stage_variant_d.png",
    overlay_trial_shrine_stage_e: "assets/map/overlays/overlay_trial_shrine_stage_variant_e.png",
    overlay_trial_shrine_stage_f: "assets/map/overlays/overlay_trial_shrine_stage_variant_f.png",
    overlay_trial_shrine_stage_g: "assets/map/overlays/overlay_trial_shrine_stage_variant_g.png",
    overlay_trial_shrine_stage_h: "assets/map/overlays/overlay_trial_shrine_stage_variant_h.png",
    overlay_trial_shrine_stage_i: "assets/map/overlays/overlay_trial_shrine_stage_variant_i.png",
    overlay_trial_shrine_stage_j: "assets/map/overlays/overlay_trial_shrine_stage_variant_j.png",
    overlay_trial_shrine_stage_k: "assets/map/overlays/overlay_trial_shrine_stage_variant_k.png",
    overlay_trial_shrine_stage_l: "assets/map/overlays/overlay_trial_shrine_stage_variant_l.png",
    overlay_trial_shrine_stage_m: "assets/map/overlays/overlay_trial_shrine_stage_variant_m.png",
    overlay_trial_shrine_stage_n: "assets/map/overlays/overlay_trial_shrine_stage_variant_n.png",
    overlay_trial_shrine_stage_o: "assets/map/overlays/overlay_trial_shrine_stage_variant_o.png",
    overlay_trial_shrine_statue_a: "assets/map/overlays/overlay_trial_shrine_statue_a.png",
    overlay_trial_shrine_statue_un: "assets/map/overlays/overlay_trial_shrine_statue_un.png",
    tile_summit_temple_floor: "assets/map/terrain/tile_summit_temple_floor_variant_a.png",
    tile_summit_temple_floor_2: "assets/map/terrain/tile_summit_temple_floor_variant_b.png",
    tile_summit_temple_mountain_trail: "assets/map/terrain/tile_summit_temple_mountain_trail_variant_a.png",
    tile_summit_temple_mountain_trail_2: "assets/map/terrain/tile_summit_temple_mountain_trail_variant_b.png",
    tile_summit_temple_sky: "assets/map/terrain/tile_summit_temple_sky_variant_a.png",
    tile_summit_temple_wall: "assets/map/terrain/tile_summit_temple_wall.png",
    tile_summit_temple_wall_face: "assets/map/terrain/tile_summit_temple_wall_face.png",
    overlay_summit_temple_cloud_bank: "assets/map/overlays/overlay_summit_temple_cloud_bank.png",
    overlay_summit_temple_cloud_wispy: "assets/map/overlays/overlay_summit_temple_cloud_wispy.png",
    overlay_summit_temple_cloud_compact: "assets/map/overlays/overlay_summit_temple_cloud_compact.png",
    overlay_summit_temple_cliff_edge_n: "assets/map/overlays/overlay_summit_temple_cliff_edge_n.png",
    overlay_summit_temple_cliff_edge_e: "assets/map/overlays/overlay_summit_temple_cliff_edge_e.png",
    overlay_summit_temple_cliff_edge_s: "assets/map/overlays/overlay_summit_temple_cliff_edge_s.png",
    overlay_summit_temple_cliff_edge_w: "assets/map/overlays/overlay_summit_temple_cliff_edge_w.png",
    overlay_shrine_healing_spring: "assets/map/overlays/overlay_shrine_healing_spring.png",
    overlay_summit_temple_stage_a: "assets/map/overlays/overlay_summit_temple_stage_variant_a.png",
    overlay_summit_temple_stage_b: "assets/map/overlays/overlay_summit_temple_stage_variant_b.png",
    overlay_summit_temple_stage_c: "assets/map/overlays/overlay_summit_temple_stage_variant_c.png",
    overlay_summit_temple_stage_d: "assets/map/overlays/overlay_summit_temple_stage_variant_d.png",
    overlay_summit_temple_stage_e: "assets/map/overlays/overlay_summit_temple_stage_variant_e.png",
    overlay_summit_temple_stage_f: "assets/map/overlays/overlay_summit_temple_stage_variant_f.png",
    overlay_summit_temple_stage_g: "assets/map/overlays/overlay_summit_temple_stage_variant_g.png",
    overlay_summit_temple_stage_h: "assets/map/overlays/overlay_summit_temple_stage_variant_h.png",
    overlay_summit_temple_stage_i: "assets/map/overlays/overlay_summit_temple_stage_variant_i.png",
    overlay_summit_temple_stage_j: "assets/map/overlays/overlay_summit_temple_stage_variant_j.png",
    overlay_summit_temple_stage_k: "assets/map/overlays/overlay_summit_temple_stage_variant_k.png",
    overlay_summit_temple_stage_l: "assets/map/overlays/overlay_summit_temple_stage_variant_l.png",
    overlay_summit_temple_stage_m: "assets/map/overlays/overlay_summit_temple_stage_variant_m.png",
    overlay_summit_temple_stage_n: "assets/map/overlays/overlay_summit_temple_stage_variant_n.png",
    overlay_summit_temple_stage_o: "assets/map/overlays/overlay_summit_temple_stage_variant_o.png",
    overlay_summit_temple_statue_angel: "assets/map/overlays/overlay_summit_temple_statue_angel.png",
    overlay_summit_temple_statue_divine_dragon: "assets/map/overlays/overlay_summit_temple_statue_divine_dragon.png",
    tile_stone_tablet: "assets/map/terrain/tile_stone_tablet.png",
    event_field: "assets/map/objects/object_field_event.png",
    event_dungeon: "assets/map/objects/object_dungeon_event.png",
    portal_dungeon: "assets/map/objects/object_dungeon_portal.png",
    battle_bg_field: "assets/generated/battle-field-ai.png",
    battle_bg_field_forest: "assets/generated/battle-forest-ai.png",
    battle_bg_forest: "assets/generated/battle-forbidden-forest.png",
    battle_bg_mountain: "assets/generated/battle-mountain-ai.png",
    battle_bg_dungeon: "assets/generated/battle-dungeon-ai.png",
    battle_bg_boss: "assets/generated/battle-boss-ai.png",
    battle_bg_maze: "assets/generated/battle-maze-ai.png",
    battle_bg_fire: "assets/generated/battle-fire.png",
    battle_bg_sea: "assets/generated/battle-sea.png",
    battle_bg_lastboss: "assets/generated/battle-abyss-ai.png",
    battle_bg_first: "assets/generated/first-battle.png",
    battle_bg_abyss_boss: "assets/generated/battle-abyss-boss.png",
    battle_bg_abyss_floor_200: "assets/generated/battle-abyss-floor-200.png",
    battle_bg_wind_temple: "assets/generated/battle-wind-temple.png",
    battle_bg_mountain_wind_ruins: "assets/generated/battle-mountain-wind-ruins.png",
    battle_bg_trial_shrine: "assets/generated/battle-trial-shrine.png",
    battle_bg_summit_temple: "assets/generated/battle-summit-temple.png",
    hero_down_1: "assets/generated/hero-down-1.gif",
    hero_down_2: "assets/generated/hero-down-2.gif",
    hero_up_1: "assets/generated/hero-up-1.gif",
    hero_up_2: "assets/generated/hero-up-2.gif",
    hero_left_1: "assets/generated/hero-left-1.gif",
    hero_left_2: "assets/generated/hero-left-2.gif",
    hero_right_1: "assets/generated/hero-right-1.gif",
    hero_right_2: "assets/generated/hero-right-2.gif",
    hero_wing_down_1: "assets/generated/hero-wing-down-1.png",
    hero_wing_down_2: "assets/generated/hero-wing-down-2.png",
    hero_wing_up_1: "assets/generated/hero-wing-up-1.png",
    hero_wing_up_2: "assets/generated/hero-wing-up-2.png",
    hero_wing_left_1: "assets/generated/hero-wing-left-1.png",
    hero_wing_left_2: "assets/generated/hero-wing-left-2.png",
    hero_wing_right_1: "assets/generated/hero-wing-right-1.png",
    hero_wing_right_2: "assets/generated/hero-wing-right-2.png",
    battle_bg_thunder_fort: "assets/generated/battle-thunder-fort.png",
    battle_bg_light_palace: "assets/generated/battle-light-palace.png",
    battle_bg_big_tower: "assets/generated/battle-big-tower.png",
    battle_bg_dark_castle: "assets/generated/battle-dark-castle.png",
    battle_bg_crena: "assets/generated/battle-crena.png",
    battle_bg_seabed: "assets/generated/battle-seabed.png",
    battle_bg_flooded: "assets/generated/battle-flooded.png",
    battle_bg_dark_shrine: "assets/generated/battle-dark-shrine.png",
    battle_bg_galvania_cave: "assets/generated/battle-galvania-cave.png",
    battle_bg_grezelia: "assets/generated/battle-grezelia.png",
    battle_bg_wind_hole: "assets/generated/battle-forest-wind-hole.png",
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
    buff: "assets/effect/fx_support_buff.png",
    "buff-ai": "assets/effect/fx-buff-ai.png",
    debuff: "assets/effect/fx_support_debuff_hex.png",
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
    "ultimate-ragnarok": "assets/effect/fx_ultimate_166_ragnarok.png",
    "ultimate-prisma-end": "assets/effect/fx_ultimate_168_prisma_end.png",
    "ultimate-big-bang": "assets/effect/fx_ultimate_238_big_bang.png",
    "ultimate-abyss-wall": "assets/effect/fx_ultimate_242_abyss_wall.png",
    "ultimate-phoenix-flare": "assets/effect/fx_ultimate_243_phoenix_flare.png",
    "ultimate-genesis-magic": "assets/effect/fx_ultimate_244_genesis_magic.png",
    "ultimate-chaos-shock": "assets/effect/fx_ultimate_245_chaos_shock.png",
    "ultimate-illuminati-break": "assets/effect/fx_ultimate_246_illuminati_break.png",
    "ultimate-the-end": "assets/effect/fx_ultimate_247_the_end.png",
    "ultimate-lost-prisma": "assets/effect/fx_ultimate_248_lost_prisma.png",
    "heal-blossom": "assets/effect/fx_support_heal_radiance.png",
    "neutral-slash": "assets/effect/fx_phys_slash_arc.png",
    "neutral-smash": "assets/effect/fx_phys_smash_impact.png",
    "neutral-pierce": "assets/effect/fx_phys_pierce_lance.png",
    "neutral-combo": "assets/effect/fx_phys_neutral_combo.png",
    "neutral-chain": "assets/effect/fx_phys_neutral_chain.png",
    "neutral-heavy": "assets/effect/fx_phys_neutral_heavy.png",
    "phys-sword": "assets/effect/fx_phys_slash_arc.png",
    "phys-spear": "assets/effect/fx_phys_pierce_lance.png",
    "phys-axe": "assets/effect/fx_phys_smash_impact.png",
    "ranged-volley": "assets/effect/fx_phys_ranged_volley.png",
    "phys-combo": "assets/effect/fx_phys_neutral_combo.png",
    "spell-fire": "assets/effect/fx_spell_fire.png",
    "spell-ice": "assets/effect/fx_spell_ice.png",
    "spell-thunder": "assets/effect/fx_spell_thunder.png",
    "spell-wind": "assets/effect/fx_spell_wind.png",
    "spell-light": "assets/effect/fx_spell_light.png",
    "spell-dark": "assets/effect/fx_spell_dark.png",
    "spell-chaos": "assets/effect/fx_spell_chaos.png",
    breath: "assets/effect/fx_breath_cone_master.png",
    "arcane-burst": "assets/effect/fx_magic_arcane_burst.png",
    "special-rupture": "assets/effect/fx_special_rupture.png",
    "critical-spark": "assets/effect/fx_critical_spark.png",
    "phys-elemental": "assets/effect/fx_phys_elemental_arc.png",
  },


  // Service Worker / 起動時先読みへ渡す画像キャッシュ用リスト。
  // initialGraphicKeys / criticalImages: 全量取得を待たない場合でも起動直後に必要なセット。
  // openingImages: PROLOGUE3後の紙芝居OPで使う画像（全量キャッシュにも含める）。
  // startupImages: ローディング中にブラウザ側でも先読みする画像。
  // installImages: Service Worker の初回install時にキャッシュする画像全体。
  // backgroundImages: install後の再試行/補助ウォームキャッシュ用。
  cacheWarmup: {
    version: "2026-07-24-monster-id-registry-v59",
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
      "battle_bg_field", "battle_bg_dungeon", "battle_bg_flooded", "battle_bg_first",
      "hero_down_1", "hero_down_2", "hero_up_1", "hero_up_2",
      "hero_left_1", "hero_left_2", "hero_right_1", "hero_right_2",
      "hero_wing_down_1", "hero_wing_down_2", "hero_wing_up_1", "hero_wing_up_2",
      "hero_wing_left_1", "hero_wing_left_2", "hero_wing_right_1", "hero_wing_right_2",
    ],
    criticalImages: [
      "assets/generated/battle-field-ai.png",
      "assets/generated/battle-dungeon-ai.png",
      "assets/generated/battle-flooded.png",
      "assets/generated/first-battle.png",
      "assets/map/terrain/terrain_grass_field.png",
      "assets/map/terrain/terrain_sea.png",
      "assets/map/objects/object_field_forest.png",
      "assets/map/objects/object_field_mountain.png",
      "assets/map/objects/object_field_low_mountain.png",
      "assets/map/objects/object_field_cave.png",
      "assets/map/objects/object_field_house_1.png",
      "assets/map/objects/object_field_house_2.png",
      "assets/map/objects/object_field_inn.png",
      "assets/map/overlays/overlay_field_forest.png",
      "assets/map/overlays/overlay_field_house_1.png",
      "assets/map/overlays/overlay_field_house_2.png",
      "assets/map/overlays/overlay_field_cave.png",
      "assets/map/overlays/overlay_field_village.png",
      "assets/map/overlays/overlay_decor_start_village_herbs.png",
      "assets/map/overlays/overlay_decor_start_cave_damp.png",
      "assets/map/overlays/overlay_world_grass_detail.png",
      "assets/map/overlays/overlay_world_grass_weeds.png",
      "assets/map/overlays/overlay_world_grass_earth.png",
      "assets/map/overlays/overlay_world_forest_understory.png",
      "assets/map/overlays/overlay_world_forest_roots.png",
      "assets/map/overlays/overlay_world_foothill_rocks.png",
      "assets/map/overlays/overlay_world_shore_foam.png",
      "assets/effect/fx_phys_slash_arc.png",
      "assets/effect/fx_phys_elemental_arc.png",
      "assets/map/terrain/terrain_dungeon_wall.png",
      "assets/map/terrain/terrain_dungeon_floor.png",
      "assets/map/overlays/overlay_named_dungeon_chest.png",
      "assets/map/overlays/overlay_named_dungeon_chest_rare.png",
      "assets/map/overlays/overlay_dungeon_chest.png",
      "assets/map/overlays/overlay_dungeon_chest_rare.png",
      "assets/map/overlays/overlay_dungeon_stairs.png",
      "assets/map/overlays/overlay_dungeon_chest_empty.png",
      "assets/map/overlays/overlay_dungeon_chest_rare_empty.png",
      "assets/map/overlays/overlay_npc_elder.png",
      "assets/map/overlays/overlay_npc_villager.png",
      "assets/map/overlays/overlay_npc_child.png",
      "assets/map/overlays/overlay_npc_bronze_knight.png",
      "assets/generated/hero-down-1.gif", "assets/generated/hero-down-2.gif",
      "assets/generated/hero-up-1.gif", "assets/generated/hero-up-2.gif",
      "assets/generated/hero-left-1.gif", "assets/generated/hero-left-2.gif",
      "assets/generated/hero-right-1.gif", "assets/generated/hero-right-2.gif",
    ],
    openingImages: [
      "assets/generated/opening-prism-collapse.png",
      "assets/background/PRISMA ABYSS.png",
      "assets/effect/fx_special_rupture.png",
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
    PRISMA_ASSETS.graphics[key] = `assets/map/library/${theme}/${role}/maplib_${theme}_${slug}.png`;
  });
});
// モンスター画像は monsters.js のIDを正本とし、命名規則から自動登録する。
globalThis.PRISMA_ASSETS = PRISMA_ASSETS;

const PRISMA_BASE_INITIAL_GRAPHIC_KEYS = [...(PRISMA_ASSETS.cacheWarmup.initialGraphicKeys || [])];
const PRISMA_BASE_CRITICAL_IMAGES = [...(PRISMA_ASSETS.cacheWarmup.criticalImages || [])];

// backgroundImages は graphics / battleFx / monster画像から自動構築する。
// モンスター一覧は monsters.js 読み込み後に registerMonsterDefinitions() から追加される。
function refreshPrismaAssetWarmupLists() {
  const unique = (items) => Array.from(new Set(items.filter(Boolean)));
  const critical = unique([
    ...PRISMA_BASE_CRITICAL_IMAGES,
    ...PRISMA_STARTUP_MONSTER_IMAGE_FILES,
  ]);
  const allImages = unique([
    ...Object.values(PRISMA_ASSETS.graphics || {}),
    ...Object.values(PRISMA_ASSETS.battleFx || {}),
    "assets/gacha/back_card.png",
    "assets/gacha/front_card.png",
    "assets/background/PRISMA ABYSS.png",
    "assets/background/bg_inn.jpg",
    "assets/background/bg_medal.png",
    "assets/background/bg_casino.png",
    "assets/background/bg_alchemy_water_city.png",
    "assets/background/bg_blacksmith.png",
    ...PRISMA_MONSTER_IMAGE_FILES,
  ]);

  PRISMA_ASSETS.cacheWarmup.initialGraphicKeys = unique([
    ...PRISMA_BASE_INITIAL_GRAPHIC_KEYS,
    ...PRISMA_STARTUP_MONSTER_GRAPHIC_KEYS,
  ]);
  PRISMA_ASSETS.cacheWarmup.criticalImages = critical;
  PRISMA_ASSETS.cacheWarmup.startupImages = unique([...critical]);
  PRISMA_ASSETS.cacheWarmup.installImages = allImages;
  PRISMA_ASSETS.cacheWarmup.backgroundImages = allImages.filter((src) => !critical.includes(src));
}

function shouldPreloadPrismaMonsterGraphic(monster) {
  return !!(monster && (
    monster.isBoss ||
    monster.isRare ||
    monster.isSpecialBoss ||
    monster.isEstark ||
    monster.mapSprite === true ||
    monster.preloadAtStartup === true
  ));
}

function ensurePrismaMonsterGraphic(monsterOrId, options = {}) {
  const key = prismaMonsterGraphicKey(monsterOrId);
  const path = prismaMonsterImagePath(monsterOrId);
  if (!key || !path) return null;
  if (!PRISMA_ASSETS.graphics[key]) PRISMA_ASSETS.graphics[key] = path;
  const canLoadImage = options.load !== false && typeof Image !== "undefined";
  if (canLoadImage && globalThis.GRAPHICS?.get && !globalThis.GRAPHICS.images?.[key]) {
    globalThis.GRAPHICS.get(key);
  }
  return key;
}

function registerPrismaMonsterDefinitions(definitions) {
  const list = Array.isArray(definitions) ? definitions : [];
  const ids = Array.from(new Set(list
    .map(normalizePrismaMonsterId)
    .filter((id) => id !== null)))
    .sort((a, b) => a - b);

  PRISMA_MONSTER_IMAGE_IDS.splice(0, PRISMA_MONSTER_IMAGE_IDS.length, ...ids);
  PRISMA_MONSTER_IMAGE_FILES.splice(
    0,
    PRISMA_MONSTER_IMAGE_FILES.length,
    ...ids.map(prismaMonsterImagePath).filter(Boolean)
  );

  const startupMonsters = list.filter((monster) => monster?.preloadAtStartup === true);
  PRISMA_STARTUP_MONSTER_IMAGE_FILES.splice(
    0,
    PRISMA_STARTUP_MONSTER_IMAGE_FILES.length,
    ...startupMonsters.map(prismaMonsterImagePath).filter(Boolean)
  );
  PRISMA_STARTUP_MONSTER_GRAPHIC_KEYS.splice(
    0,
    PRISMA_STARTUP_MONSTER_GRAPHIC_KEYS.length,
    ...startupMonsters.map(prismaMonsterGraphicKey).filter(Boolean)
  );

  const imageMap = globalThis.MonsterImageMap || {};
  list.forEach((monster) => {
    const id = normalizePrismaMonsterId(monster);
    const path = prismaMonsterImagePath(id);
    if (id === null || !path) return;
    imageMap[id] = path;
    if (shouldPreloadPrismaMonsterGraphic(monster)) ensurePrismaMonsterGraphic(id, { load: false });
  });
  globalThis.MonsterImageMap = imageMap;

  refreshPrismaAssetWarmupLists();
  return ids.slice();
}

PRISMA_ASSETS.monsters = {
  basePath: PRISMA_MONSTER_IMAGE_BASE,
  ids: PRISMA_MONSTER_IMAGE_IDS,
  files: PRISMA_MONSTER_IMAGE_FILES,
  getId: normalizePrismaMonsterId,
  getPath: prismaMonsterImagePath,
  getKey: prismaMonsterGraphicKey,
  ensureGraphic: ensurePrismaMonsterGraphic,
  register: registerPrismaMonsterDefinitions,
};
PRISMA_ASSETS.getMonsterImagePath = prismaMonsterImagePath;
PRISMA_ASSETS.getMonsterGraphicKey = prismaMonsterGraphicKey;
PRISMA_ASSETS.ensureMonsterGraphic = ensurePrismaMonsterGraphic;
PRISMA_ASSETS.registerMonsterDefinitions = registerPrismaMonsterDefinitions;
PRISMA_ASSETS.refreshCacheWarmup = refreshPrismaAssetWarmupLists;

refreshPrismaAssetWarmupLists();

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

globalThis.GRAPHICS = GRAPHICS;
