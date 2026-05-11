const CACHE_NAME = "prisma-abyss-v2.63-managed-map-effect";
const NORMAL_MONSTER_IMAGE_IDS = Array.from({ length: 90 }, (_, i) => 100001 + i);
const BOSS_MONSTER_IMAGE_IDS = [
  200201, 200202, 200203, 200204,
  301000,
  401010, 401020, 401030, 401040, 401050, 401060, 401070,
  401080, 401081, 401082, 401090, 401100,
  401110, 401120, 401130, 401140, 401150, 401151, 401152, 401153,
  401160, 401161, 401162, 401170, 401180, 401190, 401200,
  902000,
];
const MONSTER_IMAGE_FILES = NORMAL_MONSTER_IMAGE_IDS
  .concat(BOSS_MONSTER_IMAGE_IDS)
  .map((id) => `monster/img/monster_${id}.png`);
const MAP_ASSET_FILES = [
  "assets/map/objects/object_dungeon_boss_v002.png",
  "assets/map/objects/object_dungeon_chest_rare_v002.png",
  "assets/map/objects/object_dungeon_chest_v002.png",
  "assets/map/objects/object_dungeon_event_v002.png",
  "assets/map/objects/object_dungeon_portal_v002.png",
  "assets/map/objects/object_dungeon_stairs_v002.png",
  "assets/map/objects/object_field_barrel_v002.png",
  "assets/map/objects/object_field_boss_v002.png",
  "assets/map/objects/object_field_casino_v002.png",
  "assets/map/objects/object_field_castle_v002.png",
  "assets/map/objects/object_field_cave_v002.png",
  "assets/map/objects/object_field_chest_rare_v002.png",
  "assets/map/objects/object_field_chest_v002.png",
  "assets/map/objects/object_field_darkcastle_v002.png",
  "assets/map/objects/object_field_empty_v002.png",
  "assets/map/objects/object_field_event_v002.png",
  "assets/map/objects/object_field_farm_v002.png",
  "assets/map/objects/object_field_fire_village_v002.png",
  "assets/map/objects/object_field_forest_v003.png",
  "assets/map/objects/object_field_fortress_v002.png",
  "assets/map/objects/object_field_grass_v002.png",
  "assets/map/objects/object_field_hall_v002.png",
  "assets/map/objects/object_field_house_1_v002.png",
  "assets/map/objects/object_field_house_2_v002.png",
  "assets/map/objects/object_field_inn_v002.png",
  "assets/map/objects/object_field_lighthouse_v002.png",
  "assets/map/objects/object_field_lost_v002.png",
  "assets/map/objects/object_field_low_mountain_v002.png",
  "assets/map/objects/object_field_medal_v002.png",
  "assets/map/objects/object_field_mountain_v002.png",
  "assets/map/objects/object_field_pot_v002.png",
  "assets/map/objects/object_field_ruins_v002.png",
  "assets/map/objects/object_field_settlement_v002.png",
  "assets/map/objects/object_field_shop_v002.png",
  "assets/map/objects/object_field_smith_v002.png",
  "assets/map/objects/object_field_stairs_v002.png",
  "assets/map/objects/object_field_temple_v002.png",
  "assets/map/objects/object_field_tower_v002.png",
  "assets/map/objects/object_field_town_v002.png",
  "assets/map/objects/object_field_village_v002.png",
  "assets/map/objects/object_field_weapon_v002.png",
  "assets/map/overlays/overlay_dungeon_boss_v002.png",
  "assets/map/overlays/overlay_dungeon_chest_rare_v002.png",
  "assets/map/overlays/overlay_dungeon_chest_v002.png",
  "assets/map/overlays/overlay_dungeon_event_v002.png",
  "assets/map/overlays/overlay_dungeon_portal_v002.png",
  "assets/map/overlays/overlay_dungeon_stairs_v002.png",
  "assets/map/overlays/overlay_field_barrel_v002.png",
  "assets/map/overlays/overlay_field_boss_v002.png",
  "assets/map/overlays/overlay_field_casino_v002.png",
  "assets/map/overlays/overlay_field_castle_v002.png",
  "assets/map/overlays/overlay_field_cave_v002.png",
  "assets/map/overlays/overlay_field_chest_rare_v002.png",
  "assets/map/overlays/overlay_field_chest_v002.png",
  "assets/map/overlays/overlay_field_darkcastle_v002.png",
  "assets/map/overlays/overlay_field_empty_v002.png",
  "assets/map/overlays/overlay_field_event_v002.png",
  "assets/map/overlays/overlay_field_farm_v002.png",
  "assets/map/overlays/overlay_field_fire_village_v002.png",
  "assets/map/overlays/overlay_field_forest_v003.png",
  "assets/map/overlays/overlay_field_fortress_v002.png",
  "assets/map/overlays/overlay_field_grass_v002.png",
  "assets/map/overlays/overlay_field_hall_v002.png",
  "assets/map/overlays/overlay_field_house_1_v002.png",
  "assets/map/overlays/overlay_field_house_2_v002.png",
  "assets/map/overlays/overlay_field_inn_v002.png",
  "assets/map/overlays/overlay_field_lighthouse_v002.png",
  "assets/map/overlays/overlay_field_lost_v002.png",
  "assets/map/overlays/overlay_field_low_mountain_v002.png",
  "assets/map/overlays/overlay_field_medal_v002.png",
  "assets/map/overlays/overlay_field_mountain_v002.png",
  "assets/map/overlays/overlay_field_pot_v002.png",
  "assets/map/overlays/overlay_field_ruins_v002.png",
  "assets/map/overlays/overlay_field_settlement_v002.png",
  "assets/map/overlays/overlay_field_shop_v002.png",
  "assets/map/overlays/overlay_field_smith_v002.png",
  "assets/map/overlays/overlay_field_stairs_v002.png",
  "assets/map/overlays/overlay_field_temple_v002.png",
  "assets/map/overlays/overlay_field_tower_v002.png",
  "assets/map/overlays/overlay_field_town_v002.png",
  "assets/map/overlays/overlay_field_village_v002.png",
  "assets/map/overlays/overlay_field_weapon_v002.png",
  "assets/map/terrain/terrain_dungeon_floor_v001.png",
  "assets/map/terrain/terrain_dungeon_wall_face_torch_v002.png",
  "assets/map/terrain/terrain_dungeon_wall_face_v002.png",
  "assets/map/terrain/terrain_dungeon_wall_v001.png",
  "assets/map/terrain/terrain_grass_field_v001.png",
  "assets/map/terrain/terrain_sea_v001.png",
];
const EFFECT_IMAGE_FILES = [
  "assets/effect/fx_breath_dragon_v001.png",
  "assets/effect/fx_critical_spark_v001.png",
  "assets/effect/fx_phys_neutral_chain_v001.png",
  "assets/effect/fx_phys_neutral_combo_v001.png",
  "assets/effect/fx_phys_neutral_heavy_v001.png",
  "assets/effect/fx_phys_neutral_pierce_v001.png",
  "assets/effect/fx_phys_neutral_slash_v001.png",
  "assets/effect/fx_phys_neutral_smash_v001.png",
  "assets/effect/fx_special_rupture_v001.png",
  "assets/effect/fx_spell_chaos_v001.png",
  "assets/effect/fx_spell_dark_v001.png",
  "assets/effect/fx_spell_fire_v001.png",
  "assets/effect/fx_spell_ice_v001.png",
  "assets/effect/fx_spell_light_v001.png",
  "assets/effect/fx_spell_thunder_v001.png",
  "assets/effect/fx_spell_wind_v001.png",
  "assets/effect/fx_support_buff_v001.png",
  "assets/effect/fx_support_debuff_v001.png",
  "assets/effect/fx_support_heal_v001.png",
  "assets/effect/fx-abyss-vortex-ai.png",
  "assets/effect/fx-all-slash-ai.png",
  "assets/effect/fx-breath-ai.png",
  "assets/effect/fx-buff-ai.png",
  "assets/effect/fx-chaos-ai.png",
  "assets/effect/fx-claw-ai.png",
  "assets/effect/fx-combo-ai.png",
  "assets/effect/fx-dark-ai.png",
  "assets/effect/fx-debuff-ai.png",
  "assets/effect/fx-enemy-claw-ai.png",
  "assets/effect/fx-fire-ai.png",
  "assets/effect/fx-heal-ai.png",
  "assets/effect/fx-heal-blossom-ai.png",
  "assets/effect/fx-holy-burst-ai.png",
  "assets/effect/fx-ice-ai.png",
  "assets/effect/fx-ice-spear-ai.png",
  "assets/effect/fx-light-ai.png",
  "assets/effect/fx-meteor-ai.png",
  "assets/effect/fx-neutral-chain-ai.png",
  "assets/effect/fx-neutral-combo-ai.png",
  "assets/effect/fx-neutral-heavy-ai.png",
  "assets/effect/fx-neutral-pierce-ai.png",
  "assets/effect/fx-neutral-slash-ai.png",
  "assets/effect/fx-neutral-smash-ai.png",
  "assets/effect/fx-party-hit-ai.png",
  "assets/effect/fx-poison-ai.png",
  "assets/effect/fx-slash-ai.png",
  "assets/effect/fx-spell-chaos-ai.png",
  "assets/effect/fx-spell-dark-ai.png",
  "assets/effect/fx-spell-fire-ai.png",
  "assets/effect/fx-spell-ice-ai.png",
  "assets/effect/fx-spell-light-ai.png",
  "assets/effect/fx-spell-thunder-ai.png",
  "assets/effect/fx-spell-wind-ai.png",
  "assets/effect/fx-thunder-ai.png",
  "assets/effect/fx-thunder-pillar-ai.png",
  "assets/effect/fx-ultimate-chaos-ai.png",
  "assets/effect/fx-wind-ai.png",
];
const FILES_TO_CACHE = [
  "./", // ルート
  "main.html",
  "index.html",
  "manifest.json",
  "modern-polish.css",
  "polish.js",
  "main.js",
  "menus.js",
  "database.js",
  "gacha.js",
  "monsters.js",
  "monster-images.js",
  "skills.js",
  "characters.js",
  "battle.js",
  "equips.js",
  "assets.js",
  "blacksmith.js",
  "dungeon.js",
  "facilities.js",
  "items.js",
  "job_data.js",
  "map.js",
  "story.js",
  "passiveSkill.js",
  "achievements.js",
  "news.js",
  ...MONSTER_IMAGE_FILES,
  ...MAP_ASSET_FILES,
  ...EFFECT_IMAGE_FILES,
];

// インストール時にキャッシュ
self.addEventListener("install", (e) => {
  // ★追加: 新しいService Workerを即座に待機状態から有効化する
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
});

// 有効化時に古いキャッシュを削除
self.addEventListener("activate", (e) => {
  // ★追加: 制御下のページをすぐに現在のService Workerで支配する
  e.waitUntil(clients.claim());
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))
    )
  );
});

// フェッチ（通信）発生時の処理
self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      // キャッシュがあれば返し、なければネットワークへ（オフライン時はここでエラーになる）
      return res || fetch(e.request);
    })
  );
});




