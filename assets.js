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
 * - sw.js では画像を全量事前キャッシュしない。
 * - 画像は使われた時点で runtime cache に保存する。
 * ============================================================================
 */


// ---------------------------------------------------------------------------
// 起動体験を損なわないための画像キャッシュ定義
// ---------------------------------------------------------------------------
// 今後の画像管理はこの assets.js に統一します。
// Service Worker はこの一覧を main.js から受け取り、初回起動後に裏側で順次キャッシュします。
// sw.js 側にモンスター画像やエフェクト画像の全量リストを直接復活させないこと。
//
// 目的:
// - 起動時に全画像を待たない。
// - ただし、初戦闘やロード画面で画像読み込み待ちが目立たないようにする。
// - 画像は「軽い初期表示用」→「戦闘で使いやすい素材」→「残り素材」の順で温める。
const PRISMA_NORMAL_MONSTER_IMAGE_IDS = Array.from({ length: 90 }, (_, i) => 100001 + i);
const PRISMA_BOSS_MONSTER_IMAGE_IDS = [
  200201, 200202, 200203, 200204,
  301000,
  401010, 401020, 401030, 401040, 401050, 401060, 401070,
  401080, 401081, 401082, 401090, 401100,
  401110, 401120, 401130, 401140, 401150, 401151, 401152, 401153,
  401160, 401161, 401162, 401170, 401180, 401190, 401200,
  902000,
];
const PRISMA_MONSTER_IMAGE_FILES = PRISMA_NORMAL_MONSTER_IMAGE_IDS
  .concat(PRISMA_BOSS_MONSTER_IMAGE_IDS)
  .map((id) => `monster/img/monster_${id}.png`);

// ロード画面に使う候補。ここは sw.js の INITIAL_IMAGE_PRECACHE と同じ考え方の少数精鋭。
// 全モンスターをここへ入れないこと。残りは warmCache.backgroundImages で裏側キャッシュする。
const PRISMA_LOADING_MONSTER_IMAGE_FILES = PRISMA_NORMAL_MONSTER_IMAGE_IDS
  .slice(0, 12)
  .map((id) => `monster/img/monster_${id}.png`);

const PRISMA_ASSETS = {
  // Field.render / Battle 背景 / 主人公歩行画像で使う GRAPHICS 用画像。
  graphics: {
    floor: "assets/map/terrain/terrain_grass_field_v001.png",
    sea: "assets/map/terrain/terrain_sea_v001.png",
    forest: "assets/map/objects/object_field_forest_v003.png",
    mountain: "assets/map/objects/object_field_mountain_v002.png",
    Low_mountain: "assets/map/objects/object_field_low_mountain_v002.png",
    wall: "assets/map/terrain/terrain_dungeon_wall_v001.png",
    wall_face: "assets/map/terrain/terrain_dungeon_wall_face_v002.png",
    wall_face_torch: "assets/map/terrain/terrain_dungeon_wall_face_torch_v002.png",
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
    event_field: "assets/map/objects/object_field_event_v002.png",
    event_dungeon: "assets/map/objects/object_dungeon_event_v002.png",
    portal_dungeon: "assets/map/objects/object_dungeon_portal_v002.png",
    battle_bg_field: "assets/generated/battle-field-ai.png",
    battle_bg_forest: "assets/generated/battle-forest-ai.png",
    battle_bg_mountain: "assets/generated/battle-mountain-ai.png",
    battle_bg_dungeon: "assets/generated/battle-dungeon-ai.png",
    battle_bg_boss: "assets/generated/battle-boss-ai.png",
    battle_bg_maze: "assets/generated/battle-maze-ai.png",
    battle_bg_lastboss: "assets/generated/battle-abyss-ai.png",
    hero_down_1: "assets/generated/hero-down-1.gif",
    hero_down_2: "assets/generated/hero-down-2.gif",
    hero_up_1: "assets/generated/hero-up-1.gif",
    hero_up_2: "assets/generated/hero-up-2.gif",
    hero_left_1: "assets/generated/hero-left-1.gif",
    hero_left_2: "assets/generated/hero-left-2.gif",
    hero_right_1: "assets/generated/hero-right-1.gif",
    hero_right_2: "assets/generated/hero-right-2.gif",
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
    debuff: "assets/effect/fx_support_debuff_v001.png",
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
    "heal-blossom": "assets/effect/fx_support_heal_v001.png",
    "neutral-slash": "assets/effect/fx_phys_neutral_slash_v001.png",
    "neutral-smash": "assets/effect/fx_phys_neutral_smash_v001.png",
    "neutral-pierce": "assets/effect/fx_phys_neutral_pierce_v001.png",
    "neutral-combo": "assets/effect/fx_phys_neutral_combo_v001.png",
    "neutral-chain": "assets/effect/fx_phys_neutral_chain_v001.png",
    "neutral-heavy": "assets/effect/fx_phys_neutral_heavy_v001.png",
    "phys-sword": "assets/effect/fx_phys_neutral_slash_v001.png",
    "phys-spear": "assets/effect/fx_phys_neutral_pierce_v001.png",
    "phys-axe": "assets/effect/fx_phys_neutral_smash_v001.png",
    "phys-combo": "assets/effect/fx_phys_neutral_combo_v001.png",
    "spell-fire": "assets/effect/fx_spell_fire_v001.png",
    "spell-ice": "assets/effect/fx_spell_ice_v001.png",
    "spell-thunder": "assets/effect/fx_spell_thunder_v001.png",
    "spell-wind": "assets/effect/fx_spell_wind_v001.png",
    "spell-light": "assets/effect/fx_spell_light_v001.png",
    "spell-dark": "assets/effect/fx_spell_dark_v001.png",
    "spell-chaos": "assets/effect/fx_spell_chaos_v001.png",
    breath: "assets/effect/fx_breath_dragon_v001.png",
    "special-rupture": "assets/effect/fx_special_rupture_v001.png",
    "critical-spark": "assets/effect/fx_critical_spark_v001.png",
  },


  // Service Worker へ渡す「裏側キャッシュ」用リスト。
  // criticalImages: ロード画面と初戦闘の体感を守る少数の画像。
  // backgroundImages: 起動後に順次温める画像。ここは多少多くてもよいが、起動処理では待たない。
  cacheWarmup: {
    version: "2026-05-13-cache-warmup-v1",
    criticalImages: [
      ...PRISMA_LOADING_MONSTER_IMAGE_FILES,
      "assets/generated/battle-field-ai.png",
      "assets/generated/battle-forest-ai.png",
      "assets/generated/battle-dungeon-ai.png",
      "assets/generated/battle-boss-ai.png",
    ],
    backgroundImages: [],
  },
};


window.PRISMA_ASSETS = PRISMA_ASSETS;

// backgroundImages は graphics / battleFx / monster画像から自動構築する。
// 画像を追加した場合は PRISMA_ASSETS.graphics または battleFx に足せば、裏側キャッシュにも反映される。
(() => {
  const unique = (items) => Array.from(new Set(items.filter(Boolean)));
  const critical = PRISMA_ASSETS.cacheWarmup.criticalImages || [];
  PRISMA_ASSETS.cacheWarmup.backgroundImages = unique([
    ...Object.values(PRISMA_ASSETS.graphics || {}),
    ...Object.values(PRISMA_ASSETS.battleFx || {}),
    "assets/gacha/back_card.png",
    "assets/gacha/front_card.png",
    "assets/background/PRISMA ABYSS.png",
    "assets/background/宿屋.jpg",
    "assets/background/メダル交換所.png",
    "assets/background/カジノ.png",
    ...PRISMA_MONSTER_IMAGE_FILES,
  ]).filter((src) => !critical.includes(src));
})();

const GRAPHICS = {
  images: {},
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

    const src = GRAPHICS.data[key];
    if (!src) return null;

    const img = new Image();
    img.onload = () => {
      GRAPHICS.images[key] = img;
    };
    img.onerror = () => {
      delete GRAPHICS.images[key];
      console.warn(`[GRAPHICS] 遅延読み込み失敗: ${key} -> ${src}`);
    };
    img.src = src;
    return img;
  },
};

window.GRAPHICS = GRAPHICS;
