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
  .map((id) => `assets/monsters/monster_${id}.png`);

// ロード画面・序盤戦闘で使う候補。
// 初回起動時の見栄えを優先し、やや多めに先読み/初回キャッシュする。
// 画像軽量化後はここを増減してよいが、参照リストは sw.js 側へ複製しないこと。
const PRISMA_LOADING_MONSTER_IMAGE_FILES = PRISMA_NORMAL_MONSTER_IMAGE_IDS
  .slice(0, 24)
  .map((id) => `assets/monsters/monster_${id}.png`);

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
    magma: "assets/map/objects/magma.png",
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
    overlay_field_farm: "assets/map/overlays/overlay_field_farm_v002.png",
    overlay_field_fire_village: "assets/map/overlays/overlay_field_fire_village_v002.png",
    overlay_field_forest: "assets/map/overlays/overlay_field_forest_v003.png",
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
    overlay_dungeon_boss: "assets/map/overlays/overlay_dungeon_boss_v002.png",
    overlay_dungeon_chest: "assets/map/overlays/overlay_dungeon_chest_v002.png",
    overlay_dungeon_chest_rare: "assets/map/overlays/overlay_dungeon_chest_rare_v002.png",
    overlay_dungeon_event: "assets/map/overlays/overlay_dungeon_event_v002.png",
    overlay_dungeon_portal: "assets/map/overlays/overlay_dungeon_portal_v002.png",
    overlay_dungeon_stairs: "assets/map/overlays/overlay_dungeon_stairs_v002.png",

    // 地域別マップチップ（map.js の TILE_THEMES から参照）
    tile_fire_wall: "assets/map/terrain/tile_fire_wall.png",
    tile_fire_floor: "assets/map/terrain/tile_fire_floor.png",
    tile_wind_wall: "assets/map/terrain/tile_wind_wall.png",
    tile_wind_floor: "assets/map/terrain/tile_wind_floor.png",
    tile_wind_bridge: "assets/map/terrain/tile_wind_bridge.png",
    tile_water_canal: "assets/map/terrain/tile_water_canal.png",
    tile_water_pave: "assets/map/terrain/tile_water_pave.png",
    tile_water_bridge: "assets/map/terrain/tile_water_bridge.png",
    tile_tower_wall: "assets/map/terrain/tile_tower_wall.png",
    tile_tower_floor: "assets/map/terrain/tile_tower_floor.png",
    tile_thunder_wall: "assets/map/terrain/tile_thunder_wall.png",
    tile_thunder_floor: "assets/map/terrain/tile_thunder_floor.png",
    tile_light_wall: "assets/map/terrain/tile_light_wall.png",
    tile_light_floor: "assets/map/terrain/tile_light_floor.png",
    tile_dark_wall: "assets/map/terrain/tile_dark_wall.png",
    tile_dark_floor: "assets/map/terrain/tile_dark_floor.png",
    tile_abyss_grass: "assets/map/terrain/tile_abyss_grass.png",
    tile_abyss_path: "assets/map/terrain/tile_abyss_path.png",
    tile_shrine_wall: "assets/map/terrain/tile_shrine_wall.png",
    tile_shrine_floor: "assets/map/terrain/tile_shrine_floor.png",
    tile_stone_tablet: "assets/map/terrain/tile_stone_tablet.png",
    event_field: "assets/map/objects/object_field_event_v002.png",
    event_dungeon: "assets/map/objects/object_dungeon_event_v002.png",
    portal_dungeon: "assets/map/objects/object_dungeon_portal_v002.png",
    battle_bg_field: "assets/generated/battle-field-ai.png",
    battle_bg_forest: "assets/generated/battle-forest-ai.png",
    battle_bg_mountain: "assets/generated/battle-mountain-ai.png",
    battle_bg_dungeon: "assets/generated/battle-dungeon-ai.png",
    battle_bg_boss: "assets/generated/battle-boss-ai.png",
    battle_bg_maze: "assets/generated/battle-maze-ai.png",
    battle_bg_fire: "assets/generated/battle-fire.png",
    battle_bg_sea: "assets/generated/battle-sea.png",
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
    "buff-ai": "assets/effect/fx-buff-ai.png",
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


  // Service Worker / 起動時先読みへ渡す画像キャッシュ用リスト。
  // criticalImages: 初回表示で特に遅延が目立つ画像。
  // startupImages: ローディング中にブラウザ側でも先読みする画像。
  // installImages: Service Worker の初回install時にキャッシュする画像全体。
  // backgroundImages: install後の再試行/補助ウォームキャッシュ用。
  cacheWarmup: {
    version: "2026-05-14-background-rename-v1",
    criticalImages: [
      ...PRISMA_LOADING_MONSTER_IMAGE_FILES,
      "assets/monsters/monster_301000.png",
      "assets/monsters/monster_902000.png",
      "assets/generated/battle-field-ai.png",
      "assets/generated/battle-forest-ai.png",
      "assets/generated/battle-dungeon-ai.png",
      "assets/generated/battle-boss-ai.png",
      "assets/generated/battle-maze-ai.png",
      "assets/generated/battle-fire.png",
      "assets/generated/battle-abyss-ai.png",
      "assets/map/objects/magma.png",
      "assets/gacha/back_card.png",
      "assets/gacha/front_card.png",
      "assets/background/bg_inn.jpg",
      "assets/background/bg_medal.png",
      "assets/background/bg_casino.png",
    ],
    startupImages: [],
    installImages: [],
    backgroundImages: [],
  },
};


// ブラウザでもService Worker(importScripts)でも参照できるよう globalThis に出す。
// sw.js はこの PRISMA_ASSETS.cacheWarmup を読み、画像初回キャッシュ対象を決める。
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
  PRISMA_ASSETS.cacheWarmup.startupImages = unique([
    ...critical,
    "assets/generated/battle-mountain-ai.png",
    "assets/generated/battle-maze-ai.png",
  ]);

  // Service Worker install時に一度だけキャッシュする対象。
  // 画像リストの正本はここ。sw.js 側へ手書きで複製しないこと。
  PRISMA_ASSETS.cacheWarmup.installImages = allImages;

  // install後の補助ウォームキャッシュ用。installに失敗/未完了だった画像もここで再試行される。
  PRISMA_ASSETS.cacheWarmup.backgroundImages = allImages.filter((src) => !critical.includes(src));
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
