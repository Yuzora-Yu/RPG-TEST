(function () {
  const base = "assets/monsters/";
  const normalIds = Array.from({ length: 90 }, (_, i) => 100001 + i);
  const abyssHighFloorIds = Array.from({ length: 90 }, (_, i) => 100091 + i);
  const bossIds = [
    200201, 200202, 200203, 200204,
    301000, 301001, 301002,
    301010, 301011, 301012,
    301020, 301021, 301022,
    301030, 301031, 301032,
    301040, 301050,
    301060, 301061, 301062,
    301070,
    301080, 301081, 301082,
    301100,
    401010, 401020, 401030, 401040, 401050, 401060, 401070,
    401080, 401081, 401082, 401090, 401100,
    401110, 401120, 401130, 401140, 401150, 401151, 401152, 401153,
    401160, 401161, 401162, 401170, 401180, 401190, 401200,
    502049, 502098,
    902000,
  ];
  const ids = normalIds.concat(abyssHighFloorIds, bossIds);

  const bossCandidateMap = ids.reduce((map, id) => {
    map[id] = `${base}monster_${id}.png`;
    return map;
  }, {});

  const adoptedLibraryMonsters = {
    302201: "assets/monsters/library/midboss/fire/monsterlib_midboss_fire_ashhorn_minotaur_v001.png",
    302202: "assets/monsters/library/midboss/water/monsterlib_midboss_water_abyssal_shell_knight_v001.png",
    302203: "assets/monsters/library/midboss/wind/monsterlib_midboss_wind_zephyr_manticore_v001.png",
    302204: "assets/monsters/library/midboss/thunder/monsterlib_midboss_thunder_thunder_coil_golem_v001.png",
    302205: "assets/monsters/library/midboss/light/monsterlib_midboss_light_cathedral_chimera_v001.png",
    302206: "assets/monsters/library/midboss/dark/monsterlib_midboss_dark_grave_regent_v001.png",
    302207: "assets/monsters/library/midboss/earth/monsterlib_midboss_earth_root_titan_v001.png",
    302208: "assets/monsters/library/midboss/ice/monsterlib_midboss_ice_frostfang_wyrm_v001.png",
    110201: "assets/monsters/library/normal/fire/monsterlib_normal_fire_cinder_imp_v001.png",
    110202: "assets/monsters/library/normal/fire/monsterlib_normal_fire_magma_salamander_v001.png",
    110203: "assets/monsters/library/normal/water/monsterlib_normal_water_tide_jelly_v001.png",
    110204: "assets/monsters/library/normal/water/monsterlib_normal_water_shellback_crab_v001.png",
    110205: "assets/monsters/library/normal/wind/monsterlib_normal_wind_razorwing_hawk_v001.png",
    110206: "assets/monsters/library/normal/wind/monsterlib_normal_wind_breeze_moth_v001.png",
    110207: "assets/monsters/library/normal/thunder/monsterlib_normal_thunder_spark_hound_v001.png",
    110208: "assets/monsters/library/normal/thunder/monsterlib_normal_thunder_volt_beetle_v001.png",
    110209: "assets/monsters/library/normal/light/monsterlib_normal_light_prism_wisp_v001.png",
    110210: "assets/monsters/library/normal/light/monsterlib_normal_light_shrine_sentinel_v001.png",
    110211: "assets/monsters/library/normal/dark/monsterlib_normal_dark_gloom_bat_v001.png",
    110212: "assets/monsters/library/normal/dark/monsterlib_normal_dark_shade_crawler_v001.png",
    110213: "assets/monsters/library/normal/earth/monsterlib_normal_earth_stone_mole_v001.png",
    110214: "assets/monsters/library/normal/earth/monsterlib_normal_earth_thorn_boar_v001.png",
    110215: "assets/monsters/library/normal/ice/monsterlib_normal_ice_frost_jelly_v001.png",
    110216: "assets/monsters/library/normal/ice/monsterlib_normal_ice_shard_hare_v001.png",
  };

  window.MonsterImageMap = Object.assign({}, window.MonsterImageMap || {}, bossCandidateMap, adoptedLibraryMonsters);
})();
