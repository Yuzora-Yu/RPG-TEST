/* map.js */
// ==========================================
// マップデータ正本
// - ワールド座標、固定マップ、固定ダンジョン、地域別タイル設定をこのファイルに集約。
// - タイル画像キーは assets.js の PRISMA_ASSETS.graphics を参照。
// ==========================================

const tileEntry = (img, color) => ({ img, color });

// ==========================================
// 固定MAPのタイル画像指定ガイド
// ==========================================
// 各FIXED_MAPS / FIXED_DUNGEON_MAPSには、下記2項目を設定できます。
//
// themeKey: "FIRE_VILLAGE",
//   -> TILE_THEMES.FIRE_VILLAGE を基本見た目として使う。
//
// tileOverrides: {
//   W: tileEntry("任意の画像キー", "#代替色"), // 壁・外周
//   T: tileEntry("任意の画像キー", "#代替色"), // 床・通路
//   G: tileEntry("任意の画像キー", "#代替色"), // 草地・広場・装飾床
//   H: tileEntry("任意の画像キー", "#代替色"), // 家1
//   V: tileEntry("任意の画像キー", "#代替色"), // 家2 / NPC / 施設
//   I: tileEntry("任意の画像キー", "#代替色"), // 宿屋
//   S: tileEntry("任意の画像キー", "#代替色"), // 出口 / 階段
// }
//   -> そのMAPだけ個別に上書き。画像キーは assets.js の PRISMA_ASSETS.graphics に追加/指定します。
//
// 固定MAP/固定ダンジョンの「施設・宝箱・階段・ボス・イベント」は、
// 原則として床タイルを先に描画し、その上へ assets/map/overlays の画像を重ねます。
//
// fixedTileOverlays / overlayOverrides: {
//   H: tileEntry("overlay_field_house_1", "#d9bd84"), // 家
//   I: tileEntry("overlay_field_inn", "#d7b45a"),     // 宿屋
//   P: tileEntry("overlay_field_event", "#8f7dff"),   // 石碑/イベント
// }
//   -> そのMAPだけ、床に重ねるオーバーレイ画像を個別指定できます。
//      null を指定すると、その記号のオーバーレイを無効化できます。
//
// fixedOverlayBaseTiles: {
//   H: "G", I: "T"
// }
//   -> オーバーレイの下に敷く床タイルを記号ごとに指定できます。
//      未指定時は T を敷きます。
//
// STORY_DATA.areas.*.fieldTile:
//   -> ワールドマップ上に表示する、その地点専用の画像を指定できます。
//      例: fieldTile: tileEntry("overlay_field_fire_village", "#d95b3a")
// ==========================================

const TILE_THEMES = {
    WORLD: {
        W: tileEntry("sea", "#155d7a"),
        M: tileEntry("mountain", "#64636a"),
        F: tileEntry("forest", "#1f6a3f"),
        L: tileEntry("Low_mountain", "#6c6847"),
        G: tileEntry("floor", "#2c7a4e"),
        T: tileEntry("floor", "#2c7a4e"),
        I: tileEntry("settlement", "#d7b45a"),
        B: tileEntry("darkcastle", "#db3b4d"),
        D: tileEntry("lost", "#303541"),
        K: tileEntry("casino", "#7e3fa1"),
        E: tileEntry("medal", "#f6ca62")
    },
    DEFAULT: {
        W: tileEntry("wall", "#303541"),
        T: tileEntry("dungeon_floor", "#3c4151"),
        G: tileEntry("dungeon_floor", "#3c4151"),
        L: tileEntry("dungeon_floor", "#4a5160"),
        S: tileEntry("dungeon_floor", "#d7b45a"),
        D: tileEntry("stairs_dungeon", "#d7b45a"),
        U: tileEntry("stairs_dungeon", "#d7b45a"),
        C: tileEntry("chest_dungeon", "#9c6332"),
        R: tileEntry("chest_rare_dungeon", "#b6324b"),
        B: tileEntry("boss_dungeon", "#db3b4d"),
        P: tileEntry("event_dungeon", "#8f7dff"),
        X: tileEntry("door_key_red", "#8f2f2f"),
        Y: tileEntry("door_key_blue", "#2f6f9f"),
        Z: tileEntry("door_key_gold", "#b8892f"),
        Q: tileEntry("item_key_red", "#d94a4a"),
        N: tileEntry("item_key_blue", "#4aa0e6"),
        O: tileEntry("item_key_gold", "#e0b84a"),
        I: tileEntry("inn", "#356ab8"),
        K: tileEntry("casino", "#7e3fa1"),
        E: tileEntry("medal", "#f6ca62"),
        H: tileEntry("house-1", "#d9bd84"),
        V: tileEntry("house-2", "#7e3fa1"),
        M: tileEntry("magma", "#e4511e")
    },
    START_VILLAGE: {
        W: tileEntry("forest", "#1f6a3f"),
        T: tileEntry("floor", "#2c7a4e"),
        G: tileEntry("floor", "#2c7a4e"),
        H: tileEntry("house-1", "#d9bd84"),
        V: tileEntry("house-2", "#7e3fa1"),
        D: tileEntry("cave", "#303541"),
        S: tileEntry("floor", "#d7b45a"),
        I: tileEntry("inn", "#d7b45a"),
        K: tileEntry("casino", "#7e3fa1"),
        E: tileEntry("medal", "#f6ca62"),
        C: tileEntry("chest", "#9c6332"),
        R: tileEntry("chest_rare", "#b6324b"),
        B: tileEntry("boss", "#db3b4d")
    },
    START_CAVE: {
        W: tileEntry("wall", "#303541"),
        T: tileEntry("dungeon_floor", "#3c4151"),
        G: tileEntry("dungeon_floor", "#3c4151"),
        S: tileEntry("dungeon_floor", "#d7b45a"),
        V: tileEntry("dungeon_floor", "#4ab9d8"),
        C: tileEntry("chest_dungeon", "#9c6332"),
        R: tileEntry("chest_rare_dungeon", "#b6324b"),
        B: tileEntry("boss_dungeon", "#db3b4d")
    },
    FIRE_VILLAGE: {
        W: tileEntry("tile_fire_wall", "#4b2524"),
        T: tileEntry("tile_fire_floor", "#5b514d"),
        G: tileEntry("tile_fire_floor", "#6b5144"),
        M: tileEntry("magma", "#e4511e"),
        H: tileEntry("house-1", "#d9bd84"),
        V: tileEntry("fire_village", "#d95b3a"),
        I: tileEntry("inn", "#d7b45a"),
        D: tileEntry("cave", "#303541"),
        S: tileEntry("tile_fire_floor", "#d7b45a"),
        P: tileEntry("event_field", "#ff8a3d")
    },
    WIND_VILLAGE: {
        W: tileEntry("tile_wind_wall", "#64636a"),
        T: tileEntry("tile_wind_floor", "#5b7b51"),
        G: tileEntry("tile_wind_floor", "#547d50"),
        L: tileEntry("tile_wind_bridge", "#9f8a5a"),
        H: tileEntry("settlement", "#d9bd84"),
        V: tileEntry("house-1", "#cbb77e"),
        I: tileEntry("inn", "#d7b45a"),
        P: tileEntry("event_field", "#8f7dff"),
        S: tileEntry("tile_wind_floor", "#d7b45a")
    },
    WATER_CITY: {
        W: tileEntry("tile_water_canal", "#155d7a"),
        T: tileEntry("tile_water_pave", "#3c4151"),
        G: tileEntry("tile_water_pave", "#4a5262"),
        L: tileEntry("tile_water_bridge", "#a99361"),
        H: tileEntry("town", "#d9bd84"),
        V: tileEntry("shop", "#7e3fa1"),
        I: tileEntry("inn", "#d7b45a"),
        K: tileEntry("casino", "#7e3fa1"),
        E: tileEntry("medal", "#f6ca62"),
        P: tileEntry("event_field", "#8f7dff"),
        S: tileEntry("tile_water_bridge", "#d7b45a")
    },
    BIG_TOWER: {
        W: tileEntry("tile_tower_wall", "#6a3e4a"),
        T: tileEntry("tile_tower_floor", "#65314c"),
        G: tileEntry("tile_tower_floor", "#65314c"),
        S: tileEntry("tile_tower_floor", "#d7b45a"),
        D: tileEntry("stairs_dungeon", "#d7b45a"),
        U: tileEntry("stairs_dungeon", "#d7b45a"),
        C: tileEntry("chest_dungeon", "#9c6332"),
        R: tileEntry("chest_rare_dungeon", "#b6324b"),
        B: tileEntry("boss_dungeon", "#db3b4d")
    },
    THUNDER_FORT: {
        W: tileEntry("tile_thunder_wall", "#52616c"),
        T: tileEntry("tile_thunder_floor", "#52616c"),
        G: tileEntry("tile_thunder_floor", "#52616c"),
        S: tileEntry("tile_thunder_floor", "#d7b45a"),
        D: tileEntry("stairs_dungeon", "#d7b45a"),
        U: tileEntry("stairs_dungeon", "#d7b45a"),
        C: tileEntry("chest_dungeon", "#9c6332"),
        R: tileEntry("chest_rare_dungeon", "#b6324b"),
        B: tileEntry("boss_dungeon", "#db3b4d")
    },
    LIGHT_PALACE: {
        W: tileEntry("tile_light_wall", "#d9ded4"),
        T: tileEntry("tile_light_floor", "#eef0e8"),
        G: tileEntry("tile_light_floor", "#eef0e8"),
        S: tileEntry("tile_light_floor", "#d7b45a"),
        D: tileEntry("stairs_dungeon", "#d7b45a"),
        U: tileEntry("stairs_dungeon", "#d7b45a"),
        C: tileEntry("chest_dungeon", "#9c6332"),
        R: tileEntry("chest_rare_dungeon", "#b6324b"),
        B: tileEntry("boss_dungeon", "#db3b4d")
    },
    DARK_CASTLE: {
        W: tileEntry("tile_dark_wall", "#242a32"),
        T: tileEntry("tile_dark_floor", "#252b36"),
        G: tileEntry("tile_dark_floor", "#252b36"),
        S: tileEntry("tile_dark_floor", "#d7b45a"),
        D: tileEntry("stairs_dungeon", "#d7b45a"),
        U: tileEntry("stairs_dungeon", "#d7b45a"),
        C: tileEntry("chest_dungeon", "#9c6332"),
        R: tileEntry("chest_rare_dungeon", "#b6324b"),
        B: tileEntry("boss_dungeon", "#db3b4d")
    },
    ABYSS: {
        W: tileEntry("wall", "#141720"),
        T: tileEntry("dungeon_floor", "#252b36"),
        G: tileEntry("dungeon_floor", "#252b36"),
        S: tileEntry("stairs_dungeon", "#d7b45a"),
        B: tileEntry("boss_dungeon", "#db3b4d"),
        C: tileEntry("chest_dungeon", "#9c6332"),
        R: tileEntry("chest_rare_dungeon", "#b6324b"),
        M: tileEntry("magma", "#e4511e")
    },
    ABYSS_FIELD: {
        W: tileEntry("forest", "#141720"),
        T: tileEntry("tile_abyss_path", "#3b4b3a"),
        G: tileEntry("tile_abyss_grass", "#264931"),
        D: tileEntry("portal_dungeon", "#2c1d4d"),
        S: tileEntry("tile_abyss_grass", "#d7b45a")
    },
    RUINED_SHRINE: {
        W: tileEntry("tile_shrine_wall", "#4b5b48"),
        T: tileEntry("tile_shrine_floor", "#3c5145"),
        G: tileEntry("tile_shrine_floor", "#34493c"),
        P: tileEntry("tile_stone_tablet", "#8f7dff"),
        S: tileEntry("tile_shrine_floor", "#d7b45a")
    }
};

const STORY_DATA = {
    areas: {
        // fieldTile はワールドマップ上の表示専用画像。未指定なら TILE_THEMES.WORLD のタイル画像を使います。
        // 例: fieldTile: tileEntry("overlay_field_fire_village", "#d95b3a")
        START_VILLAGE: { name: "始まりの村", rank: 1, centerX: 58, centerY: 64, fieldTile: tileEntry("overlay_field_village", "#d7b45a") },
        FIRE_VILLAGE: { name: "炎の里", rank: 10, centerX: 97, centerY: 49, fieldTile: tileEntry("overlay_field_fire_village", "#d95b3a") },
        WIND_VILLAGE: { name: "風の集落", rank: 20, centerX: 98, centerY: 37, fieldTile: tileEntry("overlay_field_settlement", "#b8d889") },
        WATER_CITY: { name: "水上都市", rank: 30, centerX: 68, centerY: 21, fieldTile: tileEntry("overlay_field_town", "#5bd6ff") },
        BIG_TOWER: { name: "大灯台", rank: 30, centerX: 21, centerY: 79, fieldTile: tileEntry("overlay_field_lighthouse", "#f2e7aa") },
        THUNDER_FORT: { name: "雷の要塞", rank: 40, centerX: 45, centerY: 36, fieldTile: tileEntry("overlay_field_fortress", "#f4d84a") },
        LIGHT_PALACE: { name: "光の宮殿", rank: 50, centerX: 67, centerY: 48, fieldTile: tileEntry("overlay_field_temple", "#eef0e8") },
        DARK_CASTLE: { name: "魔王城", rank: 60, centerX: 8, centerY: 50, fieldTile: tileEntry("overlay_field_darkcastle", "#db3b4d") },
        ABYSS: { name: "深淵の魔窟", rank: 70, centerX: 51, centerY: 55, fieldTile: tileEntry("overlay_field_lost", "#303541") },
        ABYSS_FIELD: { name: "深淵の魔窟 外縁", rank: 70, centerX: 51, centerY: 55, fieldTile: tileEntry("overlay_field_lost", "#303541") },
        RUINED_SHRINE: { name: "朽ちた祠", rank: 300, centerX: 58, centerY: 56, fieldTile: tileEntry("overlay_field_ruins", "#8f7dff") },
        MEDAL: { name: "メダル王", rank: 1, centerX: 32, centerY: 18, fieldTile: tileEntry("overlay_field_medal", "#f6ca62") },
        CASINO: { name: "カジノ", rank: 1, centerX: 37, centerY: 47, fieldTile: tileEntry("overlay_field_casino", "#7e3fa1") },
        TRIAL_ISLAND: { name: "最果ての祠", rank: 120, centerX: 2, centerY: 2, fieldTile: tileEntry("overlay_field_temple", "#eef0e8") },
        SUMMIT_TEMPLE: { name: "頂の神殿", rank: 150, centerX: 89, centerY: 77, fieldTile: tileEntry("overlay_field_temple", "#eef0e8") }
    }
};

// 海上エンカウント。魔法の小舟で海を移動している時は、このリストから通常敵を抽選します。
const SEA_ENCOUNTER_MONSTERS = [100033, 100037, 100044, 100057, 100059, 100064];

const MAP_DATA = ["WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WMMMLWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WMDGTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WMFFTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGGGWWWWWWWGGGGFFFFFFWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGWWWWWWWWWGGGGGGGGGGGGGGGGGGWWWWWWWWWWGGGGFFFFFFWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGEGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWWWWGGGGGGFFFFGWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWWWWWWWWWWGGGGGGGGWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGGWWWWWWWGGGWWWWWWWWWWWWGGGGGGGWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGWWWWGGGGIGWWWWWWWWWWWWGGGGGGGWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWFGGGGGGGGGGGGGGGGGWWWWWWWWWWWWWWGGGGGGWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMFFFFFGGGGGGGGGGWWWWWWWWWWWWWWWWGGGGGGWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMFFFFFGGGGGGWWWWWWWWWWWWWWWWWGGGGGGWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMFFFFFGGGGGWWWWWWWWWWWWWWWWGGGGGGGGWWWGGWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMFFFFFGGGGGGGGGGGGGGGGGGGGGGGGWGGGGGGGGGWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMWWWWWWMMMMMMFFFFFGGGGGGGGGGGGGGGGGGGGWWWWGGGGGGGGGGFFFWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMWWWWWWMMMMMFFFFFGGGGGGGGGGGGGGGGGGWWWWWGGGGGGGGFFFFFFWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMWWWWWMMMMMMFFFFFGGGGGGGGGGGGGGWWWWWGGGGGGGGGFFFFFFFFFWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMGWWWWWWWMMMMMFFFFFFFFGGGGGMMMGWWWWWGGGGGGGGFFFFFFFFFFFFWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMGGGGGWWWWWWMMMMMMFFFFFFFFFMMMMGWWWWWGGGGGGFFFFFFFFFFFFFFFFWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMllGGMMMMWWWWWWMMMMMMFFFFFFFMMMMWWWWWWGGGGGGFFFFFFFFFFFFMMMFFWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMlllGGMMMMMMMWWWWWWMMMMMMMFFMMMMMWWWWWWGGGGGGFFFFFFFFFFFMMMMFFFWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMlllllGGGGGGMMMMMWWWWWWWMMMMMMMMMMWWWWWWGGGGGGGFFFFFFFFFFFMMMMFFFFFWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMllllllGGGGGGGGMMMMMMWWWWWWWMMMMMMWWWWWWWGGGGGGFFFFFFFFFFFFMMMMMGFFFWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMlllllllGGGGIGGGGGFMMMMMWWWWWWWWMMMWWWWWWGGGGGGGFFFFFFFFFFFFMMMMGGGGGWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMllllllllGGGGGGGGGFFFFMMMMMWWWWWWWWWWWWWMGGGGGGFFFFFFFFFFFFFMMMMGGIGGWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWMMMMMllllllllllllGGGGGGFFFFFFFFMMMMWWWWWWWWWWWMMMGGGFFFFFFFFFFFFFFMMMMGGGGGWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWMMMMllllllllllllllMMMMGFFFFFFFFFFMMMMMWWWWWWWWMMMMMMGGFFFMMMMFFFFFMMMMMGGGGWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWMMMMMlllllllllllllMMMMMFFFFFFFFFFFFFFMMMMWWWWWWWWMMMMMMMMMMMMFFFFFFMMMMGGGGWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWMMMMMllllllllllllllMMMMMFFFFFFFFFFFFFFFFMMMMWWWWWWWMMMMMMMMMMMFFFFFMMMMMGGWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWMMMMMllllllllllllllMMMMMMFFFFFFFFFFFFFFFFFFMMMMMWWWWWWMMMMMMMMFFFFFFMMMMMWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWMMMMllllllllllllllllMMMMMFFFFFFFFFFFFFFFFFFFFFMMMMMWWWWWWMMMMMMMFFFFMMMMMMWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWMMMMMMMllllllllllllllMMMMMMGFFFFFFFFFFFGGGGGGGGGGGGMMMMMMWWWWWMMMMMFFFFFFFMMMMMMMMMWWWWWWWWWWWWWWW",
"WWWWWWWWWWMMMMMMMlllllllllllllllMMMMMGGGGGGFFFFFFGGGGGGGGGGGGGGGGMMMMMWWWWWWMMMGFFFFFFFMMMMMMMMMMMMMMWWWWWWWWW",
"WWWWWWWWMMMMMMMGGGGGllllllllllMMMMGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGMMMMWWWWWWMGGGFFFFFFFFFGMMMMMMMMMMMMMMWWWWW",
"WWWWWWWMMMMGGGGGGGGGGGlllllMMMMMMGGGGKGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGMMMMWWWWWGGGGGFFFFFFFFGGGGMMMMMMMMMWWWWWW",
"WWWWWWMMMMGGGGGGGGGGGGGMMMMMMMMMMMMGGGGGGGGGGGGGGGGFFFFGGGGGGGGGGGGIGGMMMMMWWWGGGGGGGGGGGGGGGGGGGGGGMMMMWWWWWW",
"WWWWWMMMGGGGGGGGGGGGMMMMMMMMMMMMMMMMMMMMMMGGGGGGGGGGGFFFFGGGGGGGGGGGGMMMMMMMWWWGGGGGGGGGGGGGGGGGGIGMMMMWWWWWWW",
"WWWWMMGGIGGGGGGGGMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMGGGGFFFFGGGGGGGGGMMMMMMMMMWWWGGGGGGGGGGGGGGGGGGGGMMMMWWWWWWW",
"WWWGGGGGGGGGGGGGMMMMMMWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMGGGGGGGGGGGMMMMMMMMFMMMMWWGGGGGGGGGGGGGGGGGGllMMMWWWWWWWW",
"WWWWGGGGGGGGGGMMMMMWWWWWWWWWWWWWWGGGMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFMMWWGGGGGGGGGGGGGGGGlllMMMMWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFWWWGGGGGGGGGGGGGGlllMMMMWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGGMMMMMMMMMMMMMMGGGGFFMMMFFFFFWWGGGGGGGGGGGGlllllMMMMWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGGGdMMMMMMMMGGGGGGGMMMMMMFFFFFWWGGGGGGGGGGllllllMMMMWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGMMGGGGGGGGMMMMMMMMMIGGGGGMMMMMMMFFFFFGGWWGGGGGGGGlllllllMMMMMWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGMMMMMMGGGGGMMMMMMMMMMMMMMMMMMMMFFFFFFGGGGWWGGGGGGlllllllMMMMMWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGMMMMMMMMGMMMMMMMMWMMMMMMMMMMFFFFFFGGGGGGGGGGGGllllllMMMMMMMWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGMMMMMMMMMMMMMMMMWMMMMMMMFFFFFFFFGGGGGGGGGGlllllllMMMMMMMMMWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGMMMMMMMMMMMMMMMMMWMMMMFFFFFFFFFFFGGGGGGFWWllllllMMMMMMMMMMWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGMMMMMMMMMMMMMMMMMMMMWWFFFFFFFFFFGGGGGGGGGFFWWllMMMMMMMMMMWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMFFFWWWFFFFFFGGGGGGGGGGGGFFFWWMMMMMMMMMMWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMFFFFFGWWFFFFFGGGGGGGGGGGGGFFFWWWWMMMMMMWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMFFFFFFGGWFFFIGGGGGGGGGGGGGFFFFWWWWWMMMWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMlllFFFFFGGGWWFGGGGGGGGGGGGGGGFFFFWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMllllllFFFFFGGGGWGGGGGGGGGGGGGGFFFFFWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMllllllllllFFGGGGGWGGGGGGGGGGGGGFFFFFWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMllllllllllllllGGGGGGGWGGGGGGGGGGFFFFFFWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWMMMMMlllllllllllllGGGGGGGGGGGGGGGGGGGGFFFFFWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWMMMMllllllllllGGGGGGGGGGGGGGGGGGGGGGGGFFFFWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWGMMMlllllllGGGGGGGGFFFGGGGGGGGGWGGGGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWGGGGlllllGGGGGGGFFFFFFFFGGGGGGGGWGGGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGGGFFFFFFFFFFFGGGGGGGWGGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGGFFFFFFGGGFFFFFGGGGGGWGGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGFFFFFFGGGGGGFFGGGGGGGWGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGFFFFGGGGGWWGGGGGGGGGGWWGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWGGGGGGGGGGGFFFFGGGGGWWWWWGGGGGGGGGWGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMDMWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWGGGGGGGGGGGGFFGGGGWWWWWWWWWWGGGGGGGWGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWGGGGGIGGGGGGGGGGWWWWWWWWWWWWWWWWGGGGWGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWGGGGGGGGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWGGGGGGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWGGGGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"];

const FIXED_TILE_OVERLAYS = {
    // 固定MAP共通: 施設/イベントは床の上に assets/map/overlays の画像を重ねる。
    // 各MAPで fixedTileOverlays または overlayOverrides を持たせると上書きできます。
    DEFAULT_FIELD: {
        H: tileEntry("overlay_field_house_1", "#d9bd84"),
        V: tileEntry("overlay_field_house_2", "#7e3fa1"),
        I: tileEntry("overlay_field_inn", "#d7b45a"),
        K: tileEntry("overlay_field_casino", "#7e3fa1"),
        E: tileEntry("overlay_field_medal", "#f6ca62"),
        D: tileEntry("overlay_field_cave", "#303541"),
        C: tileEntry("overlay_field_chest", "#9c6332"),
        R: tileEntry("overlay_field_chest_rare", "#b6324b"),
        B: tileEntry("overlay_field_boss", "#db3b4d"),
        P: tileEntry("overlay_field_event", "#8f7dff"),
        S: null // 出口は原則、床表示だけ。目印が欲しいMAPだけ overlay_field_stairs などを指定。
    },
    DEFAULT_DUNGEON: {
        C: tileEntry("overlay_named_dungeon_chest", "#9c6332"),
        R: tileEntry("overlay_named_dungeon_chest_rare", "#b6324b"),
        B: tileEntry("overlay_named_dungeon_boss", "#db3b4d"),
        D: tileEntry("overlay_named_dungeon_stairs_down", "#d7b45a"),
        U: tileEntry("overlay_named_dungeon_stairs_up", "#d7b45a"),
        S: tileEntry("overlay_named_dungeon_stairs_up", "#d7b45a"),
        P: tileEntry("overlay_dungeon_event", "#8f7dff"),
        V: tileEntry("overlay_dungeon_event", "#4ab9d8"),
        X: tileEntry("door_key_red", "#8f2f2f"),
        Y: tileEntry("door_key_blue", "#2f6f9f"),
        Z: tileEntry("door_key_gold", "#b8892f"),
        Q: tileEntry("item_key_red", "#d94a4a"),
        N: tileEntry("item_key_blue", "#4aa0e6"),
        O: tileEntry("item_key_gold", "#e0b84a")
    },
    START_VILLAGE: {
        H: tileEntry("overlay_field_house_1", "#d9bd84"),
        V: tileEntry("overlay_field_house_2", "#7e3fa1"),
        D: tileEntry("overlay_field_cave", "#303541")
    },
    FIRE_VILLAGE: {
        H: tileEntry("overlay_field_house_1", "#d9bd84"),
        V: tileEntry("overlay_field_fire_village", "#d95b3a"),
        P: tileEntry("overlay_field_event", "#ff8a3d"),
        D: tileEntry("overlay_field_cave", "#303541")
    },
    WIND_VILLAGE: {
        H: tileEntry("overlay_field_house_1", "#cbb77e"),
        V: tileEntry("overlay_field_settlement", "#d9bd84"),
        P: tileEntry("overlay_field_event", "#8f7dff")
    },
    WATER_CITY: {
        H: tileEntry("overlay_field_town", "#d9bd84"),
        V: tileEntry("overlay_field_shop", "#7e3fa1"),
        P: tileEntry("overlay_field_event", "#8f7dff")
    },
    ABYSS_FIELD: {
        D: tileEntry("overlay_dungeon_portal", "#2c1d4d")
    },
    RUINED_SHRINE: {
        P: tileEntry("overlay_field_event", "#8f7dff")
    }
};

const FIXED_OVERLAY_BASE_TILES = {
    // オーバーレイの下に敷く床。未指定は T。
    DEFAULT_FIELD: { H: "G", V: "T", I: "T", K: "T", E: "T", D: "T", C: "T", R: "T", B: "T", P: "T", S: "S" },
    DEFAULT_DUNGEON: { C: "T", R: "T", B: "T", D: "T", U: "T", S: "T", P: "T", V: "T", X: "T", Y: "T", Z: "T", Q: "T", N: "T", O: "T" },
    WATER_CITY: { H: "T", V: "T", I: "T", K: "T", E: "T", P: "G" },
    ABYSS_FIELD: { D: "T" },
    RUINED_SHRINE: { P: "T" }
};

const FIXED_MAPS = {
    START_VILLAGE: {
        name: "始まりの村",
        themeKey: "START_VILLAGE",
        tileOverrides: {
            // このMAPだけ見た目を変えたい場合はここに追記。
            // 例: T: tileEntry("floor", "#2c7a4e"), // 床・道
        },
        width: 15,
        height: 12,
        entryPoint: { x: 7, y: 9 },
        battleBg: "battle_bg_field",
        tiles: [
            "WWWWWWWWWWWWWWW",
            "WHGHGWWWGGGDGWW",
            "WGGGGWWWWGGGGGW",
            "WGGWWWVWWWWGGGW",
            "WGGWHGGGHEWGGGW",
            "WGGIGGGGGGGGGGS",
            "WGGGGGGGGGGGGGS",
            "WGGWWGGGGWWGGGW",
            "WHGGGGGGGGGGKGW",
            "WHGGGGGGGGGGGGW",
            "WWWWWWSSWWWWWWW",
            "WWWWWWWWWWWWWWW"
        ],
        mapActions: [
            { x: 11, y: 1, label: "洞窟に入る", log: "洞窟の入口だ。", type: "fixedDungeon", target: "START_CAVE" }
        ],
        exitPoint: { area: "WORLD", x: 58, y: 65 }
    },
    FIRE_VILLAGE: {
        name: "炎の里",
        themeKey: "FIRE_VILLAGE",
        tileOverrides: {
            // 炎の里専用チップ。必要なものだけ上書きできます。
            // W: tileEntry("tile_fire_wall", "#4b2524"), // 外周・岩壁
            // T: tileEntry("tile_fire_floor", "#5b514d"), // 通路
            // G: tileEntry("tile_fire_floor", "#6b5144"), // 広場
            // V: tileEntry("fire_village", "#d95b3a"), // 里の象徴/施設
        },
        width: 29,
        height: 21,
        entryPoint: { x: 14, y: 18 },
        battleBg: "battle_bg_fire",
        tiles: [
            "WWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
            "WTTTTTTTTTTTTTTTTTTTTTTTTTTTW",
            "WTTMMTTTTTTTTTTTTTTTTTTTTTTTW",
            "WTTMMTTTTTTTTTTTTTTTTTTTTTTTW",
            "WTTMMTHTVTTTTTTTTTTTHTVTTTTTW",
            "WTTMMTTTTTTTTTTTTTTTTTTTTTTTW",
            "WTTMMTTTTTTTTTTTTTTTTTTTTTTTW",
            "WTTMMTTTTGGGGGTGGGGGTTTTTTTTW",
            "WTTMMTTTTGGGGGTGGGGGTTTTTTTTW",
            "WTTMMTTTTGGTTTTTTTGGTTTTTTTTW",
            "WTTTTTTTTTTTTTTTTTTTTTTTTTTTW",
            "WTTTTTTTTGGTTTTTTTGGTTTTMMTTW",
            "WTTTTTTTTGGGGGTGGGGGTTTTMMTTW",
            "WTTTTTTTTGGGGGTGGGGGTTTTMMTTW",
            "WTTTTTTTTTTTTTTTTTTTTTTTMMTTW",
            "WTTTTTVTHTTTTTTTTTTTVTHTMMTTW",
            "WTTTTTTTTTTTTTTTTTTTTTTTMMTTW",
            "WTTTTTTTTTTTTTTTTTTTTTTTMMTTW",
            "WTTTTTTTTTTTTTTTTTTTTTTTTTTTW",
            "WTTTTTTTTTTTTTTTTTTTTTTTTTTTW",
            "WWWWWWWWWWWWWWSSWWWWWWWWWWWWW"
        ],
        mapActions: [
            { x: 14, y: 17, label: "火口を調べる", log: "火の力が渦巻いている。ここは後でストーリー接続予定。", type: "log" }
        ],
        exitPoint: { area: "WORLD", x: 97, y: 50 }
    },
    WIND_VILLAGE: {
        name: "風の集落",
        themeKey: "WIND_VILLAGE",
        tileOverrides: {
            // 風の集落専用チップ。
            // W: tileEntry("tile_wind_wall", "#64636a"), // 外周・崖
            // T: tileEntry("tile_wind_floor", "#5b7b51"), // 草道
            // L: tileEntry("tile_wind_bridge", "#9f8a5a"), // 木橋
        },
        width: 29,
        height: 21,
        entryPoint: { x: 14, y: 18 },
        battleBg: "battle_bg_field",
        tiles: [
            "WWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
            "WWWWWWWGGGGGGGGGGGGGGGWWWWWWW",
            "WWWWWWWGGGGGGGLGGGGGGGWWWWWWW",
            "WWGGGGGGGGGGGGLGGGGGGGWWWWWWW",
            "WWGGGTTTTTVTTTITTTHTTTTTGGGWW",
            "WWGGGTTHTTTTTTLTTTTTTTTTGGGWW",
            "WWGGGTTTTTTTTTLTTTTTTVTTGGGWW",
            "WWGGGTTTTTTTTTLTTTTTTTTTGGGWW",
            "WWGGGTTTTTTTTTLTTTTTTTTTGGGWW",
            "WWGGGTTLLLLLLLLLLLLLLLTTGGGWW",
            "WWGGGTTTTTTTTTLTTTTTTTTTGGGWW",
            "WWGGGTTTTTTTTTLTTTTTTTTTGGGWW",
            "WWGGGTTTTTTTTTLTTTTTTTTTGGGWW",
            "WWGGGTTHTTTTTTLTTTTTTVTTGGGWW",
            "WWGGGTTTTTTTTTPTTTTTTTTTGGGWW",
            "WWWWWWWWGGGGGGLGGGGGGGWWWWWWW",
            "WWWWWWWWGGGGGGLGGGGGGGWWWWWWW",
            "WWWWWWWWGGGGGGGGGGGGGGWWWWWWW",
            "WWWWWWWWWWWWWWGGWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWSSWWWWWWWWWWWWW"
        ],
        mapActions: [
            { x: 14, y: 15, label: "風見台を調べる", log: "高台から世界を渡る風が吹き抜けている。", type: "log" }
        ],
        exitPoint: { area: "WORLD", x: 98, y: 38 }
    },
    WATER_CITY: {
        name: "水上都市",
        themeKey: "WATER_CITY",
        tileOverrides: {
            // 水上都市専用チップ。
            // W: tileEntry("tile_water_canal", "#155d7a"), // 水路
            // T: tileEntry("tile_water_pave", "#3c4151"), // 石畳
            // L: tileEntry("tile_water_bridge", "#a99361"), // 橋
        },
        width: 39,
        height: 27,
        entryPoint: { x: 19, y: 24 },
        battleBg: "battle_bg_field",
        tiles: [
            "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
            "WWTTTTTTTTTTTWTTTTTTTTTTTWTTTTTTTTTTTWW",
            "WWTTTTTTTTTTTWTTTTTTTTTTTWTTTTTTTTTTTWW",
            "WWTTTTHTTTTTTWTTTTITTTTTTWTTTTVTTTTTTWW",
            "WWTTTTTTTTTTLLLTTTTTTTTTLLLTTTTTTTTTTWW",
            "WWTTTTTTTTTTTWTTTTTTTTTTTWTTTTTTTTTTTWW",
            "WWTTTTTTTVTTTWTTTTTTTTHTTWTTTTTTTHTTTWW",
            "WWTTTTTTTTTTTWTTTTTTTTTTTWTTTTTTTTTTTWW",
            "WWTTTTTTTTTTTWTTTTTLTTTTTWTTTTTTTTTTTWW",
            "WWWWWWWWWWWWWWWGGGGLGGGGWWWWWWWWWWWWWWW",
            "WWWWLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLWWWW",
            "WWTTTTTTTTTTTWTGGGGLGGGGTWTTTTTTTTTTTWW",
            "WWTTTTTTTTTTTWTGGGGPGGGGTWTTTTTTTTTTTWW",
            "WWTTTTTTTTTTTWTGGGGGGGGGTWTTTTTTTTTTTWW",
            "WWTTTTTTTTTTTWTGGGGGGGGGTWTTTTTTTTTTTWW",
            "WWTTTTHTTTTTTWTGGGGLGGGGTWTTTTHTTTTTTWW",
            "WWTTTTTTTTTTLLLTTTTLTTTTLLLTTTTTTTTTTWW",
            "WWTTTTTTTTTTTWTTTTKLTTTTTWTTTTTTTTTTTWW",
            "WWTTTTTTTTTTTWTTTTTLTTTTTWTTTTTTTTTTTWW",
            "WWTTTTTTTVTTTWTTTTTLTTETTWTTTTTTTVTTTWW",
            "WWTTTTTTTTTTTWTTTTTLTTTTTWTTTTTTTTTTTWW",
            "WWTTTTTTTTTTTWTTTTTLTTTTTWTTTTTTTTTTTWW",
            "WWWWWWWWWWWWWWWWWWWLWWWWWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWWWWWLWWWWWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWWWWWLWWWWWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWWWWWSWWWWWWWWWWWWWWWWWWW"
        ],
        mapActions: [
            { x: 19, y: 13, label: "噴水を調べる", log: "澄んだ水が静かに湧き続けている。", type: "log" }
        ],
        exitPoint: { area: "WORLD", x: 68, y: 22 }
    },
    ABYSS_FIELD: {
        name: "深淵の魔窟 外縁",
        themeKey: "ABYSS_FIELD",
        tileOverrides: {
            // 魔窟外縁専用チップ。
            // G: tileEntry("tile_abyss_grass", "#264931"), // 草原
            // T: tileEntry("tile_abyss_path", "#3b4b3a"), // 道
            // D: tileEntry("portal_dungeon", "#2c1d4d"), // 自動生成ダンジョン入口
        },
        width: 17,
        height: 15,
        entryPoint: { x: 8, y: 12 },
        battleBg: "battle_bg_field",
        tiles: [
            "WWWWWWWWWWWWWWWWW",
            "WGGGGGGGGGGGGGGGW",
            "WGWWGGGGGGGGGWGGW",
            "WGGGTTTTTTTTTGWGW",
            "WGGGTTTTTTTTTGGGW",
            "WGGGTTTTTTTTTGGGW",
            "WGGGTTTTTTTTTGGGW",
            "WWGGTTTTDTTTTGGWW",
            "WGGGTTTTTTTTTGGGW",
            "WGGGTTTTTTTTTGGGW",
            "WGGGTTTTTTTTTGGGW",
            "WGGGTTTTTTTTTGGGW",
            "WGWGGGGGGGGGGGWGW",
            "WGGGGGGGGGGGGGGGW",
            "WWWWWWWWSWWWWWWWW"
        ],
        mapActions: [
            { x: 8, y: 7, label: "魔窟に入る", log: "闇がどこまでも続いているような穴がある。", type: "abyssDungeon" }
        ],
        exitPoint: { area: "WORLD", x: 51, y: 56 }
    },
    RUINED_SHRINE: {
        name: "朽ちた祠",
        themeKey: "RUINED_SHRINE",
        tileOverrides: {
            // 朽ちた祠専用チップ。
            // W: tileEntry("tile_shrine_wall", "#4b5b48"), // 石壁/森
            // T: tileEntry("tile_shrine_floor", "#3c5145"), // 祠の床
            // P: tileEntry("tile_stone_tablet", "#8f7dff"), // 石碑
        },
        width: 17,
        height: 15,
        entryPoint: { x: 8, y: 12 },
        battleBg: "battle_bg_field",
        tiles: [
            "WWWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWWW",
            "WWGGGGGGGGGGGGGWW",
            "WWGGGGGGGGGGGGGWW",
            "WWGGWTTTTTTTWGGWW",
            "WWGGTTTTTTTTTGGWW",
            "WWGGTTWTTTWTTGGWW",
            "WWGGTTTTPTTTTGGWW",
            "WWGGTTWTTTWTTGGWW",
            "WWGGTTTTTTTTTGGWW",
            "WWGGWTTTTTTTWGGWW",
            "WWGGGGGGGGGGGGGWW",
            "WWGGGGGGGGGGGGGWW",
            "WWWWWWWWGWWWWWWWW",
            "WWWWWWWWSWWWWWWWW"
        ],
        mapActions: [
            { x: 8, y: 7, label: "石碑に触れる", requiredItemId: 98, requiredItemMissingText: "不思議な気配を感じる…", log: "石碑からただならぬ気配があふれ出した……", type: "boss", monsterId: 902000, special: true }
        ],
        exitPoint: { area: "WORLD", x: 58, y: 57 }
    },
    TRIAL_ISLAND: {
        name: "最果ての祠",
        themeKey: "RUINED_SHRINE",
        tileOverrides: {
            W: tileEntry("tile_shrine_wall", "#4b5b48"),
            T: tileEntry("tile_shrine_floor", "#3c5145"),
            G: tileEntry("tile_shrine_floor", "#34493c"),
            P: tileEntry("tile_stone_tablet", "#8f7dff"),
            S: tileEntry("tile_shrine_floor", "#d7b45a")
        },
        width: 13,
        height: 13,
        entryPoint: { x: 6, y: 11 },
        battleBg: "battle_bg_field",
        tiles: [
            "WWWWWWWWWWWWW",
            "WWWWWWGWWWWWW",
            "WWWWGGGGGWWWW",
            "WWWGGTTTGGWWW",
            "WWGGTTTTTGGWW",
            "WWGTTTPTTTGWW",
            "WGGTTTPPPTGGW",
            "WWGTTTPTTTGWW",
            "WWGGTTTTTGGWW",
            "WWWGGTTTGGWWW",
            "WWWWGGGGGWWWW",
            "WWWWWWTWWWWWW",
            "WWWWWWSWWWWWW"
        ],
        mapActions: [
            { x: 6, y: 6, label: "中間試練に挑む", log: "石碑が、限界に触れた者の名を静かに問うている。", type: "limitBreakTrial", trialType: "mid" }
        ],
        exitPoint: { area: "WORLD", x: 2, y: 3 }
    },
    SUMMIT_TEMPLE: {
        name: "頂の神殿",
        themeKey: "LIGHT_PALACE",
        tileOverrides: {
            W: tileEntry("tile_light_wall", "#d9ded4"),
            T: tileEntry("tile_light_floor", "#eef0e8"),
            G: tileEntry("tile_light_floor", "#d7dfd4"),
            P: tileEntry("tile_stone_tablet", "#f4d84a"),
            S: tileEntry("tile_light_floor", "#d7b45a")
        },
        width: 13,
        height: 13,
        entryPoint: { x: 6, y: 11 },
        battleBg: "battle_bg_field",
        tiles: [
            "WWWWWWWWWWWWW",
            "WWWWWWGWWWWWW",
            "WWWWGGGGGWWWW",
            "WWWGGTTTGGWWW",
            "WWGGTTTTTGGWW",
            "WWGTTTPTTTGWW",
            "WGGTTTPPPTGGW",
            "WWGTTTPTTTGWW",
            "WWGGTTTTTGGWW",
            "WWWGGTTTGGWWW",
            "WWWWGGGGGWWWW",
            "WWWWWWTWWWWWW",
            "WWWWWWSWWWWWW"
        ],
        mapActions: [
            { x: 6, y: 6, label: "最終試練に挑む", log: "祭壇が、極限に迫る者の名を静かに問うている。", type: "limitBreakTrial", trialType: "final" }
        ],
        exitPoint: { area: "WORLD", x: 89, y: 77 }
    }
};

const FIXED_DUNGEON_MAPS = {
    START_CAVE: {
        name: "北東の洞穴",
        themeKey: "START_CAVE",
        rank: 5,
        encounterRank: 5, // monsters未指定時はこの階層相当で自動抽選
        tileOverrides: {
            // 固定ダンジョンのC/R/B/D/U/Sは床にオーバーレイ描画されます。
            // T: tileEntry("dungeon_floor", "#3c4151"), // 床
            // W: tileEntry("wall", "#303541"), // 壁
        },
        width: 15,
        height: 15,
        entryPoint: { x: 8, y: 13 },
        battleBg: "battle_bg_maze",
        tiles: [
            "WWWWWWWWWWWWWWW",
            "WBGGGGGGWGGGGCW",
            "WGGWWWWGWGWWWWW",
            "WWWWGGGGWGGGGGW",
            "WCWWGWWGWWWWWGW",
            "WGGGGWWGGGGGGGW",
            "WWWWWWWWWGWWWWW",
            "WCWGGGGCWGGGGGW",
            "WGWGWWWWWWWWWGW",
            "WGWGGGGGGGGGGGW",
            "WGWWWWWWWWWGWGW",
            "WGGGGGGGGGVWGGW",
            "WWWWWWWGGWWWWWW",
            "WWWWWWWSSWWWWWW",
            "WWWWWWWWWWWWWWW"
        ],
        chests: [
            { x: 13, y: 1, itemId: 106, type: "item" },
            { x: 1, y: 7, itemId: 1, type: "item" },
            { x: 7, y: 7, itemId: 3, type: "item" },
            { x: 1, y: 4, itemId: 99, type: "item" }
        ],
        monsters: [100001, 100002, 100003, 100004],
        bosses: [{ x: 1, y: 1, monsterId: 301000 }]
    },
    BIG_TOWER: {
        name: "大灯台",
        themeKey: "BIG_TOWER",
        rank: 30,
        encounterRank: 30, // monsters未指定時は30階相当で自動抽選
        // monsters: [100026, 100027, 100028], // 指定するとこのIDだけが通常出現
        tileOverrides: {
            // T: tileEntry("tile_tower_floor", "#65314c"), // 塔の床
            // W: tileEntry("tile_tower_wall", "#6a3e4a"), // 塔の壁
        },
        battleBg: "battle_bg_dungeon",
        entryPoint: { x: 10, y: 19 },
        floors: [
        {
            label: "1階",
            encounterRank: 30,
            monsters: [100026, 100027, 100028],
            width: 21,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTTTTTDTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTCTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWSWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 10,
                    "y": 20,
                    "to": "EXIT",
                    "label": "外に出る"
                },
                {
                    "x": 18,
                    "y": 2,
                    "toFloor": 2,
                    "targetX": 18,
                    "targetY": 18,
                    "label": "下の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                },
                {
                    "x": 18,
                    "y": 18,
                    "itemId": 3,
                    "type": "item"
                }
            ],
        },
        {
            label: "2階",
            encounterRank: 31,
            monsters: [100027, 100028, 100029],
            width: 21,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTDTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWTTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWTTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWTTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWTTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTUTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 18,
                    "y": 18,
                    "toFloor": 1,
                    "targetX": 18,
                    "targetY": 2,
                    "label": "上の階へ"
                },
                {
                    "x": 2,
                    "y": 2,
                    "toFloor": 3,
                    "targetX": 2,
                    "targetY": 18,
                    "label": "下の階へ"
                }
            ],
        },
        {
            label: "3階",
            encounterRank: 32,
            monsters: [100028, 100029, 100030],
            width: 21,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTTTTTDTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTWTTTTTTTTTTTWTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTWTTTTTTTWTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTWTTTTTTTWTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTWTTTTTTTTTTTWTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTUTTTTTTTTTTTTTTTCTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 2,
                    "y": 18,
                    "toFloor": 2,
                    "targetX": 2,
                    "targetY": 2,
                    "label": "上の階へ"
                },
                {
                    "x": 18,
                    "y": 2,
                    "toFloor": 4,
                    "targetX": 18,
                    "targetY": 18,
                    "label": "下の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                },
                {
                    "x": 18,
                    "y": 18,
                    "itemId": 3,
                    "type": "item"
                }
            ],
        },
        {
            label: "4階",
            encounterRank: 33,
            monsters: [100029, 100030, 100031],
            width: 21,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTDTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTUTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 18,
                    "y": 18,
                    "toFloor": 3,
                    "targetX": 18,
                    "targetY": 2,
                    "label": "上の階へ"
                },
                {
                    "x": 2,
                    "y": 2,
                    "toFloor": 5,
                    "targetX": 2,
                    "targetY": 18,
                    "label": "下の階へ"
                }
            ],
        },
        {
            label: "5階",
            encounterRank: 34,
            monsters: [100030, 100031, 100032],
            width: 21,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTTTTTDTW",
                "WTTWWTWWWWTTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWTTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWTTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWTTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTUTTTTTTTTTTTTTTTCTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 2,
                    "y": 18,
                    "toFloor": 4,
                    "targetX": 2,
                    "targetY": 2,
                    "label": "上の階へ"
                },
                {
                    "x": 18,
                    "y": 2,
                    "toFloor": 6,
                    "targetX": 18,
                    "targetY": 18,
                    "label": "下の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                },
                {
                    "x": 18,
                    "y": 18,
                    "itemId": 3,
                    "type": "item"
                }
            ],
        },
        {
            label: "6階",
            encounterRank: 35,
            monsters: [100031, 100032, 100033],
            width: 21,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTDTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTWTTTTTTTTTTTWTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTWTTTTTTTWTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTWTTTTTTTWTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTWTTTTTTTTTTTWTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTUTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 18,
                    "y": 18,
                    "toFloor": 5,
                    "targetX": 18,
                    "targetY": 2,
                    "label": "上の階へ"
                },
                {
                    "x": 2,
                    "y": 2,
                    "toFloor": 7,
                    "targetX": 2,
                    "targetY": 18,
                    "label": "下の階へ"
                }
            ],
        },
        {
            label: "7階",
            encounterRank: 36,
            monsters: [100032, 100033, 100034],
            width: 21,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTTTTTDTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTUTTTTTTTTTTTTTTTCTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 2,
                    "y": 18,
                    "toFloor": 6,
                    "targetX": 2,
                    "targetY": 2,
                    "label": "上の階へ"
                },
                {
                    "x": 18,
                    "y": 2,
                    "toFloor": 8,
                    "targetX": 18,
                    "targetY": 18,
                    "label": "下の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                },
                {
                    "x": 18,
                    "y": 18,
                    "itemId": 3,
                    "type": "item"
                }
            ],
        },
        {
            label: "8階",
            encounterRank: 37,
            monsters: [100033, 100034, 100035],
            width: 21,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTDTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWTTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWTTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWTTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWTTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTUTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 18,
                    "y": 18,
                    "toFloor": 7,
                    "targetX": 18,
                    "targetY": 2,
                    "label": "上の階へ"
                },
                {
                    "x": 2,
                    "y": 2,
                    "toFloor": 9,
                    "targetX": 2,
                    "targetY": 18,
                    "label": "下の階へ"
                }
            ],
        },
        {
            label: "9階",
            encounterRank: 38,
            monsters: [100034, 100035, 100036],
            width: 21,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTTTTTDTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTWTTTTTTTTTTTWTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTWTTTTTTTWTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTWTTTTTTTWTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTWTTTTTTTTTTTWTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTUTTTTTTTTTTTTTTTCTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 2,
                    "y": 18,
                    "toFloor": 8,
                    "targetX": 2,
                    "targetY": 2,
                    "label": "上の階へ"
                },
                {
                    "x": 18,
                    "y": 2,
                    "toFloor": 10,
                    "targetX": 18,
                    "targetY": 18,
                    "label": "下の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                },
                {
                    "x": 18,
                    "y": 18,
                    "itemId": 3,
                    "type": "item"
                }
            ],
        },
        {
            label: "10階",
            encounterRank: 40,
            monsters: [100036, 100037, 100038],
            width: 21,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTTTTTTTW",
                "WTTWTTTTTTTTTTTWTTTTW",
                "WTTWTTTTTTBTTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTTTTTTTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTUTW",
                "WTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 18,
                    "y": 18,
                    "toFloor": 9,
                    "targetX": 18,
                    "targetY": 2,
                    "label": "上の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                }
            ],
            bosses: [
                {
                    "x": 10,
                    "y": 4,
                    "monsterId": 401050,
                    "storyEventId": "big_tower_clear"
                }
            ],
        }
    ]
    },
    THUNDER_FORT: {
        name: "雷の要塞",
        themeKey: "THUNDER_FORT",
        rank: 40,
        encounterRank: 40, // monsters未指定時は40階相当で自動抽選
        // monsters: [100036, 100037, 100038],
        tileOverrides: {
            // T: tileEntry("tile_thunder_floor", "#52616c"), // 要塞の床
            // W: tileEntry("tile_thunder_wall", "#52616c"), // 要塞の壁
        },
        battleBg: "battle_bg_dungeon",
        entryPoint: { x: 8, y: 15 },
        floors: [
        {
            label: "1階",
            encounterRank: 40,
            monsters: [100036, 100037, 100038],
            width: 17,
            height: 17,
            tiles: [
                "WWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTDTW",
                "WTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTCTW",
                "WTTTTTTTTTTTTTTTW",
                "WWWWWWWWSWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 8,
                    "y": 16,
                    "to": "EXIT",
                    "label": "外に出る"
                },
                {
                    "x": 14,
                    "y": 2,
                    "toFloor": 2,
                    "targetX": 14,
                    "targetY": 14,
                    "label": "下の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                },
                {
                    "x": 14,
                    "y": 14,
                    "itemId": 3,
                    "type": "item"
                }
            ],
        },
        {
            label: "地下1階",
            encounterRank: 42,
            monsters: [100038, 100039, 100040],
            width: 17,
            height: 17,
            tiles: [
                "WWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTW",
                "WTDTTTTTTTTTTTTTW",
                "WTTWWTWWTWWTWWTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTWWTWWTWWTWWTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTWWTWWTWWTWWTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTUTW",
                "WTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 14,
                    "y": 14,
                    "toFloor": 1,
                    "targetX": 14,
                    "targetY": 2,
                    "label": "上の階へ"
                },
                {
                    "x": 2,
                    "y": 2,
                    "toFloor": 3,
                    "targetX": 2,
                    "targetY": 14,
                    "label": "下の階へ"
                }
            ],
        },
        {
            label: "地下2階",
            encounterRank: 44,
            monsters: [100040, 100041, 100042],
            width: 17,
            height: 17,
            tiles: [
                "WWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTDTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTWTTTTTTTWTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTTWTTTTTTTWTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTUTTTTTTTTTTTCTW",
                "WTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 2,
                    "y": 14,
                    "toFloor": 2,
                    "targetX": 2,
                    "targetY": 2,
                    "label": "上の階へ"
                },
                {
                    "x": 14,
                    "y": 2,
                    "toFloor": 4,
                    "targetX": 14,
                    "targetY": 14,
                    "label": "下の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                },
                {
                    "x": 14,
                    "y": 14,
                    "itemId": 3,
                    "type": "item"
                }
            ],
        },
        {
            label: "地下3階",
            encounterRank: 46,
            monsters: [100042, 100043, 100044],
            width: 17,
            height: 17,
            tiles: [
                "WWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTTTW",
                "WTTWTTTTTTTTTTTTW",
                "WTTWTTTTBTTTTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTWTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTUTW",
                "WTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 14,
                    "y": 14,
                    "toFloor": 3,
                    "targetX": 14,
                    "targetY": 2,
                    "label": "上の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                }
            ],
            bosses: [
                {
                    "x": 8,
                    "y": 4,
                    "monsterId": 401030,
                    "storyEventId": "thunder_fort_clear"
                }
            ],
        }
    ]
    },
    LIGHT_PALACE: {
        name: "光の宮殿",
        themeKey: "LIGHT_PALACE",
        rank: 50,
        encounterRank: 50, // monsters未指定時は50階相当で自動抽選
        // monsters: [100046, 100047, 100048],
        tileOverrides: {
            // T: tileEntry("tile_light_floor", "#eef0e8"), // 宮殿の床
            // W: tileEntry("tile_light_wall", "#d9ded4"), // 宮殿の壁
        },
        battleBg: "battle_bg_dungeon",
        entryPoint: { x: 12, y: 19 },
        floors: [
        {
            label: "1階",
            encounterRank: 50,
            monsters: [100046, 100047, 100048],
            width: 25,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTTTTTTTTTDTW",
                "WTTWTTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTTTTTTTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTTTTTTTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTTTTTTTTTWTTTTW",
                "WTTWTTTWTTTTTTTTTTTWTTTTW",
                "WTTWTTTWTTTTTTTTTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTCTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWSWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 12,
                    "y": 20,
                    "to": "EXIT",
                    "label": "外に出る"
                },
                {
                    "x": 22,
                    "y": 2,
                    "toFloor": 2,
                    "targetX": 22,
                    "targetY": 18,
                    "label": "下の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                },
                {
                    "x": 22,
                    "y": 18,
                    "itemId": 3,
                    "type": "item"
                }
            ],
        },
        {
            label: "地下1階",
            encounterRank: 52,
            monsters: [100048, 100049, 100050],
            width: 25,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTDTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWWTTWWWWTWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWWTTWWWWTWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWWTTWWWWTWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWTTTTTTTTTTWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTUTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 22,
                    "y": 18,
                    "toFloor": 1,
                    "targetX": 22,
                    "targetY": 2,
                    "label": "上の階へ"
                },
                {
                    "x": 2,
                    "y": 2,
                    "toFloor": 3,
                    "targetX": 2,
                    "targetY": 18,
                    "label": "下の階へ"
                }
            ],
        },
        {
            label: "地下2階",
            encounterRank: 54,
            monsters: [100050, 100051, 100052],
            width: 25,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTTTTTTTTTDTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTWTTTTTTTTTTTTTTTWTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTWTTTTTTTTTTTWTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTWTTTTTTTWTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTUTTTTTTTTTTTTTTTTTTTCTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 2,
                    "y": 18,
                    "toFloor": 2,
                    "targetX": 2,
                    "targetY": 2,
                    "label": "上の階へ"
                },
                {
                    "x": 22,
                    "y": 2,
                    "toFloor": 4,
                    "targetX": 22,
                    "targetY": 18,
                    "label": "下の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                },
                {
                    "x": 22,
                    "y": 18,
                    "itemId": 3,
                    "type": "item"
                }
            ],
        },
        {
            label: "地下3階",
            encounterRank: 56,
            monsters: [100052, 100053, 100054],
            width: 25,
            height: 21,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTTTTTTTTTWTTTTW",
                "WTTWTTTWTTTTTTTTTTTWTTTTW",
                "WTTTTTTTTTTTBTTTTTTTTTTTW",
                "WTTWTTTWTTTTTTTTTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTTW",
                "WTTWTTTWTTTTTTTTTTTWTTTTW",
                "WTTWTTTWTTTTTTTTTTTWTTTTW",
                "WTTWTTTWTTTTTTTTTTTWTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTUTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 22,
                    "y": 18,
                    "toFloor": 3,
                    "targetX": 22,
                    "targetY": 2,
                    "label": "上の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                }
            ],
            bosses: [
                {
                    "x": 12,
                    "y": 5,
                    "monsterId": 401130,
                    "storyEventId": "light_palace_clear"
                }
            ],
        }
    ]
    },
    DARK_CASTLE: {
        name: "魔王城",
        themeKey: "DARK_CASTLE",
        rank: 60,
        encounterRank: 60, // monsters未指定時は60階相当で自動抽選
        // monsters: [100056, 100057, 100058],
        tileOverrides: {
            // T: tileEntry("tile_dark_floor", "#252b36"), // 城の床
            // W: tileEntry("tile_dark_wall", "#242a32"), // 城の壁
        },
        battleBg: "battle_bg_lastboss",
        entryPoint: { x: 13, y: 21 },
        floors: [
        {
            label: "地下1階",
            encounterRank: 60,
            monsters: [100056, 100057, 100058],
            width: 27,
            height: 23,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTTTTTTTTTTTDTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTWTTTWTTTWTTTWTTTWTTTWTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTCTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWSWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 13,
                    "y": 22,
                    "to": "EXIT",
                    "label": "外に出る"
                },
                {
                    "x": 24,
                    "y": 2,
                    "toFloor": 2,
                    "targetX": 24,
                    "targetY": 20,
                    "label": "下の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                },
                {
                    "x": 24,
                    "y": 20,
                    "itemId": 3,
                    "type": "item"
                }
            ],
        },
        {
            label: "地下2階",
            encounterRank: 65,
            monsters: [100061, 100062, 100063],
            width: 27,
            height: 23,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTDTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWWTWTWWWTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWWTWTWWWTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWWTWTWWWTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTWWTWWWWWTWTWWWTWWWWWWTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTUTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 24,
                    "y": 20,
                    "toFloor": 1,
                    "targetX": 24,
                    "targetY": 2,
                    "label": "上の階へ"
                },
                {
                    "x": 2,
                    "y": 2,
                    "toFloor": 3,
                    "targetX": 2,
                    "targetY": 20,
                    "label": "下の階へ"
                }
            ],
        },
        {
            label: "地下3階",
            encounterRank: 70,
            monsters: [100066, 100067, 100068],
            width: 27,
            height: 23,
            tiles: [
                "WWWWWWWWWWWWWWWWWWWWWWWWWWW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTCTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTWTTTTTTTTBTTTTTTTTWTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTWTTTTTTTTTTTTTWTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTWTTTTTTTTTWTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTWTTTTTWTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTTTWTWTTTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTTTWTTTTTWTTTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTTTTTTTWTTTTTTTTTWTTTTTTTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WTUTTTTTTTTTTTTTTTTTTTTTCTW",
                "WTTTTTTTTTTTTTTTTTTTTTTTTTW",
                "WWWWWWWWWWWWWWWWWWWWWWWWWWW"
        ],
            floorLinks: [
                {
                    "x": 2,
                    "y": 20,
                    "toFloor": 2,
                    "targetX": 2,
                    "targetY": 2,
                    "label": "上の階へ"
                }
            ],
            chests: [
                {
                    "x": 2,
                    "y": 2,
                    "itemId": 1,
                    "type": "item"
                },
                {
                    "x": 24,
                    "y": 20,
                    "itemId": 3,
                    "type": "item"
                }
            ],
            bosses: [
                {
                    "x": 13,
                    "y": 4,
                    "monsterId": 401100,
                    "storyEventId": "dark_castle_clear"
                }
            ],
        }
    ]
    }
};

const MapRegistry = {
    getFixedDungeonBase(areaKey) {
        return (typeof FIXED_DUNGEON_MAPS !== "undefined") ? FIXED_DUNGEON_MAPS[areaKey] : null;
    },

    getFixedDungeonFloor(areaKey, floorNo = 1) {
        const base = MapRegistry.getFixedDungeonBase(areaKey);
        if (!base) return null;
        const floor = Math.max(1, Number(floorNo || 1));

        if (!Array.isArray(base.floors) || base.floors.length === 0) {
            const floorLabel = base.floorLabel || "";
            return {
                ...base,
                areaKey,
                baseName: base.name,
                name: base.name,
                displayName: floorLabel ? `${base.name} ${floorLabel}` : base.name,
                floor: 1,
                floorLabel,
                themeKey: base.themeKey || areaKey,
                tileOverrides: { ...(base.tileOverrides || {}) },
                encounterRank: base.encounterRank || base.rank || 1,
                isDungeon: true,
                isFixed: true
            };
        }

        const index = Math.min(base.floors.length - 1, floor - 1);
        const def = base.floors[index];
        const floorLabel = def.label || `${index + 1}階`;
        return {
            ...base,
            ...def,
            areaKey,
            baseName: base.name,
            name: base.name,
            displayName: `${base.name} ${floorLabel}`,
            floor: index + 1,
            floorLabel,
            totalFloors: base.floors.length,
            themeKey: def.themeKey || base.themeKey || areaKey,
            tileOverrides: { ...(base.tileOverrides || {}), ...(def.tileOverrides || {}) },
            encounterRank: def.encounterRank || base.encounterRank || base.rank || 1,
            monsters: Array.isArray(def.monsters) ? def.monsters : base.monsters,
            isDungeon: true,
            isFixed: true
        };
    },

    getFixedDungeonProgressKey(areaKey, floorNo = 1) {
        const base = MapRegistry.getFixedDungeonBase(areaKey);
        if (base && Array.isArray(base.floors) && base.floors.length > 0) {
            return `${areaKey}:F${Math.max(1, Number(floorNo || 1))}`;
        }
        return areaKey;
    },

    findMapAction(mapDef, x, y) {
        if (!mapDef || !Array.isArray(mapDef.mapActions)) return null;
        return mapDef.mapActions.find(action => Number(action.x) === Number(x) && Number(action.y) === Number(y)) || null;
    },

    findFloorLink(mapDef, x, y) {
        if (!mapDef || !Array.isArray(mapDef.floorLinks)) return null;
        return mapDef.floorLinks.find(link => Number(link.x) === Number(x) && Number(link.y) === Number(y)) || null;
    },

    findFixedBoss(mapDef, x, y) {
        if (!mapDef || !Array.isArray(mapDef.bosses)) return null;
        return mapDef.bosses.find(boss => Number(boss.x) === Number(x) && Number(boss.y) === Number(y)) || null;
    },

    findFixedChest(mapDef, x, y) {
        if (!mapDef || !Array.isArray(mapDef.chests)) return null;
        return mapDef.chests.find(chest => Number(chest.x) === Number(x) && Number(chest.y) === Number(y)) || null;
    },

    getWorldAreaAt(x, y) {
        if (typeof STORY_DATA === "undefined" || !STORY_DATA.areas) return null;
        return Object.entries(STORY_DATA.areas).find(([key, area]) => Number(area.centerX) === Number(x) && Number(area.centerY) === Number(y)) || null;
    },

    getWorldTileConfig(x, y) {
        const entry = MapRegistry.getWorldAreaAt(x, y);
        const area = entry ? entry[1] : null;
        return area?.fieldTile || null;
    },

    getFixedFloorDirection(mapDef, link, currentFloorNo = null, areaKey = null) {
        if (!mapDef || !link || link.toFloor === undefined || link.toFloor === null) return null;
        const key = areaKey || mapDef.areaKey || null;
        const currentNo = Math.max(1, Number(currentFloorNo || mapDef.floor || 1));
        const targetNo = Math.max(1, Number(link.toFloor || 1));

        const currentLabel = String(mapDef.floorLabel || mapDef.label || `${currentNo}階`);
        let targetLabel = '';
        if (key && typeof MapRegistry.getFixedDungeonFloor === 'function') {
            const targetDef = MapRegistry.getFixedDungeonFloor(key, targetNo);
            targetLabel = String(targetDef?.floorLabel || targetDef?.label || '');
        }
        if (!targetLabel) targetLabel = `${targetNo}階`;

        const parseFloorLabel = (label, fallbackNo) => {
            const text = String(label || '');
            const basement = text.includes('地下');
            const numMatch = text.match(/(\d+)/);
            const num = numMatch ? Number(numMatch[1]) : Number(fallbackNo || 1);
            return { basement, num };
        };

        const current = parseFloorLabel(currentLabel, currentNo);
        const target = parseFloorLabel(targetLabel, targetNo);

        // 地下表記を含むMAPは「地下へ進む」時を下り、「地上へ戻る」時を上りとして扱う。
        if (current.basement || target.basement) {
            if (current.basement && target.basement) {
                if (target.num > current.num) return 'down';
                if (target.num < current.num) return 'up';
            }
            if (!current.basement && target.basement) return 'down';
            if (current.basement && !target.basement) return 'up';
        }

        // 地上階/塔は階数が大きくなる方向を上りとして扱う。
        if (targetNo > currentNo) return 'up';
        if (targetNo < currentNo) return 'down';
        return null;
    },

    getFixedFloorActionLabel(mapDef, link, currentFloorNo = null, areaKey = null) {
        if (link?.to === 'EXIT') return '外に出る';
        const direction = MapRegistry.getFixedFloorDirection(mapDef, link, currentFloorNo, areaKey);
        if (direction === 'up') return '上の階へ';
        if (direction === 'down') return '下の階へ';
        return link?.label || '階段を使う';
    },

    getFixedOverlayConfig(mapDef, tileSign, x = null, y = null) {
        if (!mapDef) return null;
        const upper = String(tileSign || '').toUpperCase();
        const isDungeon = !!mapDef.isDungeon;
        const themeKey = mapDef.themeKey || mapDef.areaKey || mapDef.baseName;
        const defaults = isDungeon ? (FIXED_TILE_OVERLAYS.DEFAULT_DUNGEON || {}) : (FIXED_TILE_OVERLAYS.DEFAULT_FIELD || {});
        const themed = (themeKey && FIXED_TILE_OVERLAYS[themeKey]) ? FIXED_TILE_OVERLAYS[themeKey] : {};
        const local = mapDef.fixedTileOverlays || mapDef.overlayOverrides || {};
        const merged = { ...defaults, ...themed, ...local };
        if (!Object.prototype.hasOwnProperty.call(merged, upper)) return null;
        return merged[upper];
    },

    getFixedOverlayBaseTile(mapDef, tileSign) {
        if (!mapDef) return 'T';
        const upper = String(tileSign || '').toUpperCase();
        const isDungeon = !!mapDef.isDungeon;
        const themeKey = mapDef.themeKey || mapDef.areaKey || mapDef.baseName;
        const defaults = isDungeon ? (FIXED_OVERLAY_BASE_TILES.DEFAULT_DUNGEON || {}) : (FIXED_OVERLAY_BASE_TILES.DEFAULT_FIELD || {});
        const themed = (themeKey && FIXED_OVERLAY_BASE_TILES[themeKey]) ? FIXED_OVERLAY_BASE_TILES[themeKey] : {};
        const local = mapDef.fixedOverlayBaseTiles || {};
        const merged = { ...defaults, ...themed, ...local };
        return merged[upper] || 'T';
    }
};

if (typeof window !== "undefined") {
    window.MapRegistry = MapRegistry;
    window.FIXED_TILE_OVERLAYS = FIXED_TILE_OVERLAYS;
    window.FIXED_OVERLAY_BASE_TILES = FIXED_OVERLAY_BASE_TILES;
    window.SEA_ENCOUNTER_MONSTERS = SEA_ENCOUNTER_MONSTERS;
}
