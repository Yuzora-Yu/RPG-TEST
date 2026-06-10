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
        M: tileEntry("tile_magma", "#e4511e")
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
        M: tileEntry("tile_magma", "#e4511e"),
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
        M: tileEntry("tile_magma", "#e4511e")
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
        SEABED_TEMPLE: { name: "海底神殿", rank: 35, centerX: 68, centerY: 15, fieldTile: tileEntry("overlay_field_temple", "#5bd6ff") },
        BIG_TOWER: { name: "大灯台", rank: 30, centerX: 21, centerY: 79, fieldTile: tileEntry("overlay_field_lighthouse", "#f2e7aa") },
        THUNDER_FORT: { name: "雷の要塞", rank: 40, centerX: 45, centerY: 36, fieldTile: tileEntry("overlay_field_fortress", "#f4d84a"), entrances: [
            { x: 45, y: 36, entryKey: "west", label: "西門" },
            { x: 47, y: 36, entryKey: "east", label: "東門" }
        ] },
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

// ワールドマップ通常エンカウント。近隣ダンジョン1〜2階相当の敵を地域別に出す。
const FIELD_ENCOUNTER_ZONES = [
    { id: "START_PLAINS", name: "始まりの村周辺", rank: 5, centerX: 58, centerY: 64, radius: 34, monsters: [100001, 100002, 100003, 100004, 100005, 100006] },
    { id: "FIRE_FOOTHILLS", name: "イグナ火山山麓", rank: 12, centerX: 97, centerY: 49, radius: 24, monsters: [100010, 100011, 100012, 100013, 100014] },
    { id: "WIND_HIGHLANDS", name: "禁忌の森外縁", rank: 22, centerX: 98, centerY: 37, radius: 20, monsters: [100020, 100021, 100022, 100023, 100024] },
    { id: "WATER_COAST", name: "水上都市近海", rank: 35, centerX: 68, centerY: 21, radius: 28, monsters: [100033, 100034, 100035, 100036] },
    { id: "BIG_TOWER_SHORE", name: "大灯台沿岸", rank: 30, centerX: 21, centerY: 79, radius: 30, monsters: [100026, 100027, 100028, 100029] },
    { id: "THUNDER_FRONTIER", name: "雷鳴の荒野", rank: 42, centerX: 45, centerY: 36, radius: 24, monsters: [100040, 100041, 100042, 100043] },
    { id: "LIGHT_PALACE_GROVE", name: "光の宮殿周辺", rank: 62, centerX: 67, centerY: 48, radius: 18, monsters: [100060, 100061, 100062, 100063] },
    { id: "DARK_WASTES", name: "魔王城外郭", rank: 60, centerX: 8, centerY: 50, radius: 30, monsters: [100056, 100057, 100058, 100059] },
    { id: "ABYSS_EDGE", name: "深淵外縁", rank: 70, centerX: 51, centerY: 55, radius: 20, priority: 1, monsters: [100064, 100065, 100066, 100067] }
];

const MAP_DATA = ["WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WMMMLWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WMGGTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
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
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGGGWWWWWWWGGGGFFFFFFWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGWWWWWWWWWWGGGGGGGGGGGGGGGGGGWWWWWWWWWWGGGGFFFFFFWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGEGGGWWWGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWWWWGGGGGGFFFFGWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGWWGGGGGGGGGGGGGGGGGGGGGGGWWWWWWWWWWWWWWWWWWWWGGGGGGGGWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGGWWWWWWWGGGWWWWWWWWWWWWGGGGGGGWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGWWWWGGGGGGWWWWWWWWWWWWGGGGGGGWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWFGGGGGGGGGGGGGGGGGWWWWWWWWWWWWWWGGGGGGWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMFFFFFGGGGGGGGGGWWWWWWWWWWWWWWWWGGGGGGWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMFFFFFGGGGGGWWWWWWWWWWWWWWWWWGGGGGGWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMFFFFFGGGGGWWWWWWWWWWWWWWWWGGGGGGGGWWWGGWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMFFFFFGGGGGGGGGGGGGGGGGGGGGGGGWGGGGGGGGGWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMWWWWWWMMMMMMFFFFFGGGGGGGGGGGGGGGGGGGGWWWWGGGGGGGGGGFFFWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMWWWWWWMMMMMFFFFFGGGGGGGGGGGGGGGGGGWWWWWGGGGGGGGFFFFFFWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMWWWWWMMMMMMFFFFFGGGGGGGGGGGGGGWWWWWGGGGGGGGGFFFFFFFFFWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMGWWWWWWWMMMMMFFFFFFFFGGGGGMMMGWWWWWGGGGGGGGFFFFFFFFFFFFWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMllGGGWWWWWWMMMMMMFFFFFFFFFMMMMGWWWWWGGGGGGFFFFFFFFFFFFFFFFWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMlllGGMMMWWWWWWMMMMMMFFFFFFFMMMMWWWWWWGGGGGGFFFFFFFFFFFFMMMFFWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMllllGGMMMMMMWWWWWWMMMMMMMFFMMMMMWWWWWWGGGGGGFFFFFFFFFFFMMMMFFFWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMllllllGGMMMMMMMMWWWWWWWMMMMMMMMMMWWWWWWGGGGGGGFFFFFFFFFFFMMMMFFFFFWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMlllllllGGMMMMMMMMMMMWWWWWWWMMMMMMWWWWWWWGGGGGGFFFFFFFFFFFFMMMMMFFFFWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMllllllllGGGIMIGGMMMMMMMWWWWWWWWMMMWWWWWWGGGGGGGFFFFFFFFFFFFMMMMFFFFFWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMllllllllllllMMGGGFFFFMMMMMWWWWWWWWWWWWWMGGGGGGFFFFFFFFFFFFFMMMMFFGFFWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWMMMMMllllllllllllllMMGGFFFFFFFFMMMMWWWWWWWWWWWMMMGGGFFFFFFFFFFFFFFMMMMFFFFFWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWMMMMllllllllllllllMMMMGFFFFFFFFFFMMMMMWWWWWWWWMMMMMMGGFFFMMMMFFFFFMMMMMFFFFWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWMMMMMlllllllllllllMMMMMFFFFFFFFFFFFFFMMMMWWWWWWWWMMMMMMMMMMMMFFFFFFMMMMFFFFWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWMMMMMllllllllllllllMMMMMFFFFFFFFFFFFFFFFMMMMWWWWWWWMMMMMMMMMMMFFFFFMMMMMFFWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWMMMMMllllllllllllllMMMMMMFFFFFFFFFFFFFFFFFFMMMMMWWWWWWMMMMMMMMFFFFFFMMMMMWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWMMMMllllllllllllllllMMMMMFFFFFFFFFFFFFFFFFFFFFMMMMMWWWWWWMMMMMMMFFFFMMMMMMWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWMMMMMMMllllllllllllllMMMMMMGFFFFFFFFFFFGGGGGGGGGGGGMMMMMMWWWWWMMMMMFFFFFFFMMMMMMMMMWWWWWWWWWWWWWWW",
"WWWWWWWWWWMMMMMMMlllllllllllllllMMMMMGGGGGGFFFFFFGGGGGGGGGGGGGGGGMMMMMWWWWWWMMMGFFFFFFFMMMMMMMMMMMMMMWWWWWWWWW",
"WWWWWWWWMMMMMMMGGGGGllllllllllMMMMGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGMMMMWWWWWWMGGGFFFFFFFFFGMMMMMMMMMMMMMMWWWWW",
"WWWWWWWMMMMGGGGGGGGGGGlllllMMMMMMGGGGKGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGMMMMWWWWWGGGGGFFFFFFFFGGGGMMMMMMMMMWWWWWW",
"WWWWWWMMMMGGGGGGGGGGGGGMMMMMMMMMMMMGGGGGGGGGGGGGGGGFFFFGGGGGGGGGGGGGGGMMMMMWWWGGGGGGGGGGGGGGGGGGGGGGMMMMWWWWWW",
"WWWWWMMMGGGGGGGGGGGGMMMMMMMMMMMMMMMMMMMMMMGGGGGGGGGGGFFFFGGGGGGGGGGGGMMMMMMMWWWGGGGGGGGGGGGGGGGGGGGMMMMWWWWWWW",
"WWWWMMGGGGGGGGGGGMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMGGGGFFFFGGGGGGGGGMMMMMMMMMWWWGGGGGGGGGGGGGGGGGGGGMMMMWWWWWWW",
"WWWGGGGGGGGGGGGGMMMMMMWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMGGGGGGGGGGGMMMMMMMMFMMMMWWGGGGGGGGGGGGGGGGGGllMMMWWWWWWWW",
"WWWWGGGGGGGGGGMMMMMWWWWWWWWWWWWWWGGGMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFMMWWGGGGGGGGGGGGGGGGlllMMMMWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFWWWGGGGGGGGGGGGGGlllMMMMWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGGMMMMMMMMMMMMMMGGGGFFMMMFFFFFWWGGGGGGGGGGGGlllllMMMMWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGGGdMMMMMMMMGGGGGGGMMMMMMFFFFFWWGGGGGGGGGGllllllMMMMWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGMMGGGGGGGGMMMMMMMMMGGGGGGMMMMMMMFFFFFGGWWGGGGGGGGlllllllMMMMMWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGMMMMMMGGGGGMMMMMMMMMMMMMMMMMMMMFFFFFFGGGGWWGGGGGGlllllllMMMMMWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGMMMMMMMMGMMMMMMMMWMMMMMMMMMMFFFFFFGGGGGGGGGGGGllllllMMMMMMMWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGMMMMMMMMMMMMMMMMWMMMMMMMFFFFFFFFGGGGGGGGGGlllllllMMMMMMMMMWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGMMMMMMMMMMMMMMMMMWMMMMFFFFFFFFFFFGGGGGGFWWllllllMMMMMMMMMMWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGMMMMMMMMMMMMMMMMMMMMWWFFFFFFFFFFGGGGGGGGGFFWWllMMMMMMMMMMWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMFFFWWWFFFFFFGGGGGGGGGGGGFFFWWMMMMMMMMMMWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMFFFFFGWWFFFFFGGGGGGGGGGGGGFFFWWWWMMMMMMWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMFFFFFFGGWFFFGGGGGGGGGGGGGGFFFFWWWWWMMMWWWWWWWWWWWWWWWWWWWWWWWWWW",
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
"WWWWWWWWWWWWWWWWWWGGGGGGGGGGGFFFFGGGGGWWWWWGGGGGGGGGWGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMGMWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWGGGGGGGGGGGGFFGGGGWWWWWWWWWWGGGGGGGWGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWGGGGGGGGGGGGGGGGWWWWWWWWWWWWWWWWGGGGWGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
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
        A: tileEntry("overlay_npc_elder", "#d8c89a"),
        J: tileEntry("overlay_npc_villager", "#8fb066"),
        P: tileEntry("overlay_field_event", "#8f7dff"),
        S: null // 出口は原則、床表示だけ。目印が欲しいMAPだけ overlay_field_stairs などを指定。
    },
    DEFAULT_DUNGEON: {
        C: tileEntry("overlay_named_dungeon_chest", "#9c6332"),
        R: tileEntry("overlay_named_dungeon_chest_rare", "#b6324b"),
        B: tileEntry("overlay_monster_guardian", "#db3b4d"),
        A: tileEntry("overlay_npc_bronze_knight", "#b8843a"),
        J: tileEntry("overlay_monster_guardian", "#7f68a5"),
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
        H: tileEntry("overlay_building_fire_forge", "#d9bd84"),
        V: tileEntry("overlay_building_fire_forge", "#d95b3a"),
        A: tileEntry("overlay_npc_elder", "#d8c89a"),
        J: tileEntry("overlay_npc_villager", "#8fb066"),
        P: tileEntry("overlay_field_event", "#ff8a3d"),
        D: tileEntry("overlay_field_cave", "#303541")
    },
    WIND_VILLAGE: {
        H: tileEntry("overlay_building_wind_hut", "#cbb77e"),
        V: tileEntry("overlay_building_wind_hut", "#d9bd84"),
        A: tileEntry("overlay_npc_child", "#d9d28c"),
        J: tileEntry("overlay_npc_child", "#b7d8a6"),
        P: tileEntry("overlay_field_event", "#8f7dff")
    },
    WATER_CITY: {
        H: tileEntry("overlay_building_water_shop", "#d9bd84"),
        V: tileEntry("overlay_building_water_shop", "#7e3fa1"),
        A: tileEntry("overlay_npc_villager", "#8fb066"),
        J: tileEntry("overlay_npc_villager", "#8fb066"),
        R: tileEntry("overlay_npc_dark_soldier", "#333946"),
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
    DEFAULT_FIELD: { H: "T", V: "T", I: "T", K: "T", E: "T", D: "T", C: "T", R: "T", B: "T", A: "T", J: "T", P: "T", S: "S" },
    DEFAULT_DUNGEON: { C: "T", R: "T", B: "T", A: "T", J: "T", D: "T", U: "T", S: "T", P: "T", V: "T", X: "T", Y: "T", Z: "T", Q: "T", N: "T", O: "T" },
    FIRE_VILLAGE: { H: "T", V: "T", A: "T", J: "T", P: "T", D: "T" },
    WIND_VILLAGE: { H: "T", V: "T", A: "T", J: "T", P: "T" },
    WATER_CITY: { H: "T", V: "T", I: "T", K: "T", E: "T", A: "T", J: "T", R: "T", P: "G" },
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
            { x: 6, y: 3, label: "道具を買う", log: "道具屋の看板が出ている。", type: "shop", shopType: "item", title: "始まりの村 道具屋", shopRank: 5 },
            { x: 1, y: 8, label: "武器を見る", log: "簡素な武器が並んでいる。", type: "shop", shopType: "weapon", title: "始まりの村 武器屋", shopRank: 5 },
            { x: 1, y: 9, label: "防具を見る", log: "旅支度用の防具が並んでいる。", type: "shop", shopType: "armor", title: "始まりの村 防具屋", shopRank: 5 },
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
            "WMMMMTTTTTTTTTDTTTTTTTTTMMMMW",
            "WMMMMTTTTTTTTTTTTTTTTTTTMMMMW",
            "WMMMMTTHTTTTTTTTTTHTTTTTMMMMW",
            "WMMMMTVJTTTTTTTTTTTJVTTTMMMMW",
            "WMMMMTTTTTTTTTTTTTTTTTTTMMMMW",
            "WMMMMTTGGGGGMMMMMGGGGGTTMMMMW",
            "WMMMMTTGGGGGMMMMMGGGGGTTMMMMW",
            "WMMMMTTGGGGGGGGGGGGGGGTTMMMMW",
            "WMMMMTTTTTTTTTTTTTTTTTTTMMMMW",
            "WMMMMTTTGGGGGGPGGGGGGTTTMMMMW",
            "WMMMMTTTGGGGGGGGGGGGGTTTMMMMW",
            "WMMMMTTTGGGGGGGGGGGGGTTTMMMMW",
            "WMMMMITTTTTTTTTTTTTTTTHTMMMMW",
            "WMMMMTTVJTTTTGGGTTTTJVTTMMMMW",
            "WMMMMTTTTTTGGGGGGGTTTTTTMMMMW",
            "WMMMMTTTTTTGGGGGGGTTTTTTMMMMW",
            "WMMMMTTTTTTGGGAGGGTTTTTTMMMMW",
            "WMMMMTTTTTTGGGGGGGTTTTTTMMMMW",
            "WMMMMTTTTTTTTTTTTTTTTTTTTTTTW",
            "WWWWWWWWWWWWWWSSWWWWWWWWWWWWW"
        ],
        mapActions: [
            { x: 5, y: 13, label: "泊まる", log: "熱気をしのげる宿屋がある。", type: "inn" },
            { x: 6, y: 4, label: "道具を買う", log: "火山探索向けの道具屋だ。", type: "shop", shopType: "item", title: "炎の里 道具屋", shopRank: 12 },
            { x: 20, y: 4, label: "武器を見る", log: "鍛冶火が赤く揺れる武器屋だ。", type: "shop", shopType: "weapon", title: "炎の里 武器屋", shopRank: 12 },
            { x: 22, y: 13, label: "防具を見る", log: "火山の熱に耐える防具を扱っている。", type: "shop", shopType: "armor", title: "炎の里 防具屋", shopRank: 12 },
            {
                x: 14,
                y: 17,
                label: "里の長に話す",
                log: "里の長が弱まった炎を見つめている。",
                type: "log",
                events: [
                    { stepMin: 0, stepMax: 1, eventId: "fire_village_elder_before_story" },
                    { stepMin: 2, stepMax: 2, subMin: 2, subMax: 3, eventId: "fire_village_elder_during_volcano" },
                    { stepMin: 3, stepMax: 99, eventId: "fire_village_elder_after_clear" },
                    { default: true, eventId: "fire_village_elder_idle" }
                ]
            },
            {
                x: 14,
                y: 1,
                label: "イグナ火山へ入る",
                log: "北の火山道から、熱と魔物の気配が流れてくる。",
                type: "fixedDungeon",
                target: "IGNIS_VOLCANO",
                requiredStoryStep: 2,
                requiredSubStep: 2,
                requiredStoryMissingText: "火山道から熱気が吹き下ろしてくる。今はまだ、里の事情を聞かずに踏み込むべきではなさそうだ。",
                events: [
                    { stepMin: 2, stepMax: 2, subMin: 2, subMax: 2, eventId: "fire_volcano_entrance" }
                ]
            }
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
            "WGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
            "WGGGGGGGGGGGGLLLGGGGGGGGGGGGW",
            "WGGTTTTTTTTTTLLLTTTTTTTTTTGGW",
            "WGGTTTHTTTTTTLLLTTTTTVTTTTGGW",
            "WGGTTTTJTTTTTLLLTTTTJTTTTTGGW",
            "WGGTTTTTTTTTTLLLTTTTTTTTTTGGW",
            "WLLLLLLLLLLLLLLLTTTTTTTTTTGGW",
            "WLLLLLLLLLLLLLLLTTTTTTTTTTGGW",
            "WLPLLLLLLLLLLLLLTTTTTTTTTTGGW",
            "WGGTTTTTTTTTTLLLTTTTTTTTTTGGW",
            "WGGTTTTTTJTTTLLLTTTTTTJTTTGGW",
            "WGGTTTTTITTTTLLLTTTTTVTTTTGGW",
            "WGGTTTTTTTTTTLLLTTTTTTTTTTGGW",
            "WGGTTTTTTTTTTLALTTTTTTTTTTGGW",
            "WGGGGGGGGGGGGLLLGGGGGGGGGGGGW",
            "WGGGGGGGGGGGGLLLGGGGGGGGGGGGW",
            "WGGGGGGGGGGGGLLLGGGGGGGGGGGGW",
            "WWWWWWWWWWWWWWGWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWSSWWWWWWWWWWWWW"
        ],
        mapActions: [
            { x: 8, y: 13, label: "泊まる", log: "風よけの宿屋がある。", type: "inn" },
            { x: 21, y: 5, label: "道具を買う", log: "森歩きに備えた道具屋だ。", type: "shop", shopType: "item", title: "風の集落 道具屋", shopRank: 22 },
            { x: 6, y: 5, label: "武器を見る", log: "軽く扱いやすい武器が並んでいる。", type: "shop", shopType: "weapon", title: "風の集落 武器屋", shopRank: 22 },
            { x: 21, y: 13, label: "防具を見る", log: "森の魔物に備えた防具屋だ。", type: "shop", shopType: "armor", title: "風の集落 防具屋", shopRank: 22 },
            {
                x: 14,
                y: 15,
                label: "エリーゼに話す",
                log: "子どもたちが不安そうに身を寄せ合っている。",
                type: "log",
                events: [
                    { stepMin: 0, stepMax: 2, eventId: "wind_village_before_story" },
                    { stepMin: 3, stepMax: 3, subMin: 1, subMax: 2, eventId: "wind_village_elise_during" },
                    { stepMin: 4, stepMax: 99, eventId: "wind_village_after_clear" },
                    { default: true, eventId: "wind_village_before_story" }
                ]
            },
            {
                x: 2,
                y: 10,
                label: "禁忌の森へ入る",
                log: "西の森から、淀んだ風が吹き込んでくる。",
                type: "fixedDungeon",
                target: "FORBIDDEN_FOREST",
                requiredStoryStep: 3,
                requiredSubStep: 1,
                requiredStoryMissingText: "森の奥から、呼吸をひそめるような風が流れてくる。案内もなく進めば、すぐに道を失いそうだ。",
                events: [
                    { stepMin: 3, stepMax: 3, subMin: 1, subMax: 1, missingFlag: "windForestEntryIntroduced", eventId: "wind_forest_entry" }
                ]
            }
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
            "WTTTTTTTTTTTTWTTTTTTTTTTTWTTTTTTTTTTTTW",
            "WTTTTHTTTTTTTWTTTTTTTTTTTWTTTTTHTTTTTTW",
            "WTTTTTVTTTTTTWTTTTTITTTTTWTTTTTTJTTTTTW",
            "WTTTTTTTTTTTLLLTTTTTTTTTLLLTTTTTTTTTTTW",
            "WTTTTTTTTTTTTWTTTTTTTTTTTWTTTTTTTTTTTTW",
            "WTTTTTTTTTTTTWTTTTTTTTTTTWTTTTTTTTTTTTW",
            "WTTTTTTTTTTTTWTTTTTTTTTTTWTTTTTTTTTTTTW",
            "WTTTTTTTTTTTTWTTTTLLLTTTTWTTTTTTTTTTTTW",
            "WLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLW",
            "WLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLW",
            "WTTTTTTTATTTTWTTTGLLLGTTTWTTTTTTTTTTTTW",
            "WTTTTTTTTTTTTWTTTGLRLGTTTWTTTTTTTTTTTTW",
            "WTTTTTTTTTTTTWTTTGLJLGTTTWTTTTTTTTTTTTW",
            "WTTTTTTTTTTTLLLTTGLLLGTTLLLTTTTTTTTTTTW",
            "WTTTTTHTTTTTTWTTTGLLLGTTTWTTTTTHTTTTTTW",
            "WTTTTTTTTTTTTWTTTTLLLTTTTWTTTTTTTTJTTTW",
            "WTTTTTTTVTTTTWTTTTKLLETTTWTTTTTTTTTTTTW",
            "WTTTTTTTTTTTTWTTTTLLLTTTTWTTTTTTTTTTTTW",
            "WTTTTTTTRTTTTWTTTTLLLTTTTWTTTTTRTTTTTTW",
            "WTTTTTTTTTTTTWTTTTLLLTTTTWTTTTTTTTTTTTW",
            "WTTTTTTTTTTTTWTTTTTTTTTTTWTTTTTTTTTTTTW",
            "WWWWWWWWWWWWWWWWWWWLWWWWWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWWWWWLWWWWWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWWWWWLWWWWWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWWWWWSWWWWWWWWWWWWWWWWWWW"
        ],
        mapActions: [
            { x: 6, y: 4, label: "道具を買う", log: "水路沿いの道具屋だ。", type: "shop", shopType: "item", title: "水上都市 道具屋", shopRank: 35 },
            { x: 5, y: 3, label: "武器を見る", log: "海底神殿に備えた武器を扱っている。", type: "shop", shopType: "weapon", title: "水上都市 武器屋", shopRank: 35 },
            { x: 31, y: 3, label: "防具を見る", log: "水と闇に強い防具を扱っている。", type: "shop", shopType: "armor", title: "水上都市 防具屋", shopRank: 35 },
            {
                x: 19,
                y: 13,
                label: "広場を調べる",
                log: "濁った水路の音が、街の沈黙に混じっている。",
                type: "log",
                events: [
                    { stepMin: 0, stepMax: 3, eventId: "water_city_before_story" },
                    { stepMin: 4, stepMax: 4, subMin: 1, subMax: 99, eventId: "water_city_sophia_after_meeting" },
                    { stepMin: 5, stepMax: 99, eventId: "water_city_after_clear" },
                    { default: true, eventId: "water_city_before_story" }
                ]
            }
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
    IGNIS_VOLCANO: {
        name: "イグナ火山",
        themeKey: "FIRE_VILLAGE",
        rank: 12,
        encounterRank: 12,
        battleBg: "battle_bg_fire",
        overlayOverrides: { B: tileEntry("overlay_npc_bronze_knight", "#b8843a") },
        entryPoint: { x: 10, y: 18 },
        floors: [
            {
                label: "火山道",
                encounterRank: 12,
                monsters: [100010,100011,100012],
                width: 21,
                height: 21,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWTTTCTW",
                    "WWWMMWWWWWWWWWWMMTTTW",
                    "WWWMWWWWWWWWWWMMMMTTW",
                    "WWWWWWWWWWWWWWTTMMMMW",
                    "WWWWWWWWWWWWWWTTMMDMW",
                    "WWWWWWWWWWWWWWTTMMMMW",
                    "WWWWWWWWWWWWWWTTTTTTW",
                    "WWTTTTTWWWWWWWWTWWWWW",
                    "WWTTMMTWWWWWWWWTWWWWW",
                    "WWTTMMTWWWWWWWWTWWWWW",
                    "WWTTTTTWWWWWWWWTWWWWW",
                    "WWTTTTTTTTTTTTTTWWWWW",
                    "WWWWWWWWWWTWWWWWWWWWW",
                    "WWWWWMWWWWTWWWWWWWWWW",
                    "WWWWWWWWWWTWWWWWMMMWW",
                    "WWWWWWWTTTTTTTWWWWWWW",
                    "WWWWWWWTTTMMTTWWWWWWW",
                    "WWWWWWWTTTMMTTWWWWWWW",
                    "WWWWWWWTTTTTTTWWWWWWW",
                    "WWWWWWWWWWSWWWWWWWWWW"
                ],
                floorLinks: [
                    {
                        "x": 10,
                        "y": 20,
                        "to": "EXIT",
                        "label": "里へ戻る"
                    },
                    {
                        "x": 18,
                        "y": 5,
                        "toFloor": 2,
                        "targetX": 2,
                        "targetY": 17,
                        "label": "溶岩回廊へ"
                    }
                ],
                chests: [
                    {
                        "x": 18,
                        "y": 1,
                        "itemId": 1,
                        "type": "item"
                    }
                ],
                entryPoint: {
                    "x": 10,
                    "y": 18
                }
            },
            {
                label: "溶岩回廊",
                encounterRank: 14,
                monsters: [100012,100013,100014],
                width: 21,
                height: 21,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWTTTTTDW",
                    "WWWWWWWWWWWWWWTTTTGTW",
                    "WWWWWWWWWWTTTTTTTTTTW",
                    "WWWWWWWWWWTWWWMMMMMMW",
                    "WWWMMMWWWWTWWWMMMMMMW",
                    "WWWWWWWWWWTWWWWWWWWWW",
                    "WWWWWWWWWWTWWWWWWWWWW",
                    "WWWWWWWTTTTTTTWWWWWWW",
                    "WWWWWWWTTMMMTTWMMWWWW",
                    "WWWWWTTTTMMMTTWMMWWWW",
                    "WWWWWTWTTMMMTTWWWWWWW",
                    "WWWWWTWTTTTTTTWWWWWWW",
                    "WWWWWTWWWWWWWWWWWWWWW",
                    "WTTTTTWWWWWWWWWWWWWWW",
                    "WCTTTTWWWWWWMMWWWWWWW",
                    "WTTTTTWWWWWWWWWWWWWWW",
                    "WTUTTTWWWWWWWWWWWWWWW",
                    "WTTTTTWWWWWWWWWWWWWWW",
                    "WTTTTTWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    {
                        "x": 2,
                        "y": 17,
                        "toFloor": 1,
                        "targetX": 18,
                        "targetY": 5,
                        "label": "火山道へ戻る"
                    },
                    {
                        "x": 19,
                        "y": 1,
                        "toFloor": 3,
                        "targetX": 10,
                        "targetY": 17,
                        "label": "火の祭壇へ"
                    }
                ],
                chests: [
                    {
                        "x": 1,
                        "y": 15,
                        "itemId": 99,
                        "type": "item"
                    }
                ],
                entryPoint: {
                    "x": 2,
                    "y": 17
                }
            },
            {
                label: "火の祭壇",
                encounterRank: 16,
                monsters: [100014,100015,100016],
                width: 21,
                height: 21,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWWWMMTTTTTTTTTMMWWWW",
                    "WWWWMMTTMMMMMTTMMWWWW",
                    "WWWWTTTMMMBMMMTTTWWWW",
                    "WWWWTTTMMMTMMMTTTWWWW",
                    "WWWWTTTMMTTTMMTTTWWWW",
                    "WWWWTTTMMTTTMMTTTWWWW",
                    "WWWWTTTTTTTTTTTTTWWWW",
                    "WWWWMMTTTTTTTTTMMWWWW",
                    "WWWWMMTTTTTTTTTMMWWWW",
                    "WWWWWWWWWWTWWWWWWWWWW",
                    "WWWWWTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTUTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    {
                        "x": 10,
                        "y": 17,
                        "toFloor": 2,
                        "targetX": 19,
                        "targetY": 1,
                        "label": "溶岩回廊へ戻る"
                    }
                ],
                bosses: [
                    {
                        "x": 10,
                        "y": 6,
                        "monsterId": [
                            301002,
                            301001,
                            301001,
                            301001
                        ],
                        "startEventId": "fire_volcano_soldiers_encounter",
                        "storyEventId": "fire_volcano_soldiers_clear",
                        "actionLabel": "兵士に声をかける"
                    }
                ],
                entryPoint: {
                    "x": 10,
                    "y": 17
                }
            }
        ]
    },
    FORBIDDEN_FOREST: {
        name: "禁忌の森",
        themeKey: "WIND_VILLAGE",
        tileOverrides: {
            W: tileEntry("forest", "#1f6a3f"),
            T: tileEntry("floor", "#2c7a4e"),
            G: tileEntry("floor", "#3f8b54"),
            S: tileEntry("floor", "#4e9c61")
        },
        // 森内の地続き遷移点は階段表示にしない。
        fixedTileOverlays: { S: null },
        rank: 22,
        encounterRank: 22,
        battleBg: "battle_bg_forest",
        entryPoint: { x: 51, y: 16 },
        floors: [
            {
                label: "封じられた森・東の迷い路",
                encounterRank: 22,
                monsters: [100020, 100021, 100022, 100023, 100024],
                width: 55,
                height: 33,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWGGGGGGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWGTTTTTTTTGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWGSTTTTTTTGGWWWWGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWGTTTTTTTTGGWWWWGTTTTGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWGTTTTTTTTGGWWWWGTTRTGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWGTTTTTTTTGGWWWWGTTTTGWWWWWWWWGGGGGGGGGGGGGGGGGGGGGGWW",
                    "WWGGGGGGGGTGGWWWWGTGGGGWWWWWWWWGGGGWWWGGGGGGGGGGGGGGGWW",
                    "WWWWGGGTTTTGGGTTTTTWWWWWWGGGGGGGGGGGGGGGGGGGGGGGWWGGGWW",
                    "WWWWGGTTTTTTTTGWWWWWWWWWWGGGGGGGGGTTTTTTTTTTTTTTTTTGGWW",
                    "WWWWGGTTTTTTTTGWWWWWWWWWWGGTTTTTTGTTTTTTTWTTTTTTTTTGGWW",
                    "WWWWGGTTTTTTTTGWWWWWWWWWWGGTTTTTTGTTGGGGGGGGGGGGTTTGGWW",
                    "WWWWGGTTTTTTTTGTTTTTTTTTXGGTTTTTTGTTGGGGGGGGGGGGTTTGGWW",
                    "WWWWGGTTTTTTTTGWWWWWWWWWWGGTTTTTTTTTTTTGGGGGGGGGTTWGGWW",
                    "WWWWGGTTTTTTTTGWWWWWWWWWWGGTTTTTTGTTGGGGGGGGGGGGTTTGGWW",
                    "WWWWGGTTTTTTTTGWWWWWWWWWWGGTTTTTTGTTGGTTTTTTTGGGTTTTTSW",
                    "WWWWGGGGGGGGGGGWWWWWWWWWWGGGGGGGGGTTGGGGGGGGTGGGTTTGGWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWGGGGWGGGGTTGGGGGGGGTGGGTTTGGWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGTTTGGGGGGGGTGGGTTTGGWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGTWWTTTWWTTTTTTTTTTGGWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGTTTTTTTTTTTTTTTTTTGGWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGTTTTTTTGGGGTTGGGGTGGWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGTTTTTTGGGGGWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGTTTTTTGGGGGWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGGTTTQTTGGGGGWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGTTTTTTGGWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGGGGWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    {
                        x: 53,
                        y: 16,
                        to: "EXIT",
                        label: "風の集落へ戻る",
                        log: "集落へ続く森の出口だ。"
                    },
                    {
                        x: 3,
                        y: 4,
                        toFloor: 2,
                        targetX: 35,
                        targetY: 32,
                        auto: true,
                        label: "森の奥へ進む",
                        log: "木々の切れ目から、さらに深い森へ道が続いている。"
                    }
                ],
                chests: [
                    { x: 20, y: 6, itemId: 100, type: "item", rare: true }
                ],
                entryPoint: { x: 51, y: 16 }
            },
            {
                label: "封じられた森・祈りの広場",
                encounterRank: 24,
                monsters: [100021, 100022, 100023, 100024, 100025],
                width: 41,
                height: 37,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWSWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWGGGGGGGGGGGGGWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWGWTTTTTTTTTWGWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWGGTTTTTTTTTGGWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWGGTTTTTTTTTGGWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWGGTTTTTTTTTGGWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWGGGGGGGGGGGWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWTWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWZWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWTWWWWWWWWWWWWWWWWWWWW",
                    "WWWGGGGGGGWWWWWWWWWWTWWWWWWWWWWWWWWWWWWWW",
                    "WWWGTTTTTGWWWWWWWWWWTWWWWWWWWWWWWWWWWWWWW",
                    "WWWGTTTTTGWWWWWWWWWWTWWWWWWWWWWWWWWWWWWWW",
                    "WWWGTRTTTGWWWWGGGGGGTGGGGGGWWWWWWWWWWWWWW",
                    "WWWGTTTTTGTTTTTTTTTTTTTTTGGWWWWWWWWWWWWWW",
                    "WWWGTTTTTGWWWWGGTTTTTTTTTGGWWWGGGGGGGWWWW",
                    "WWWGGGGGGGWWWWGGTTTTBTTTTGGWWWGTTTTTGWWWW",
                    "WWWWWWWWWWWWWWGGTTTTTTTTTGGWWWGTTTTTGWWWW",
                    "WWWWWWWWWWWWWWGGTTTTTTTTTTTTTTGTTTCTGWWWW",
                    "WWWWWWWWWWWWWWGGTTTTTTTTTGGWWWGTTTTTGWWWW",
                    "WWWWWWWWWWWWWWGGTTTTTTTTTGGWWWGTTTTTGWWWW",
                    "WWWWWWWWWWWWWWWGGGGGGGGGGGWWWWGGGGGGGWWWW",
                    "WWWWWWWWWWWWWWWWWWWWYWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWTWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWTWWWWWWWWWWWWWWWWWWWW",
                    "WWWWGGGGGWGWWWWWWWWWTWWWWWWWWWWWWWWWWWWWW",
                    "WWWWGTTTTTGWWWWWWWWWTWWWWWWWWGGGGGGGGGGWW",
                    "WWWWGTTTTTGWWWWWWWWWTWWWWWWWWGWGGGGGGGGWW",
                    "WWWWGTNTTTGTTTTTTTTTTTTTTTTTTTTTTTTTTTGWW",
                    "WWWWGTTTTTGWWWWWWWWWWWWWWWWWWGGTTTTTTTGWW",
                    "WWWWGTTTTTGWWWWWWWWWWWWWWWWWWGGTTTTTTTGWW",
                    "WWWWGGGGGGGWWWWWWWWWWWWWWWWWWGGTTTTTTTSWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGGGWGGWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    {
                        x: 38,
                        y: 33,
                        toFloor: 1,
                        targetX: 4,
                        targetY: 4,
                        auto: true,
                        label: "東の森へ戻る",
                        log: "木々の切れ目から、来た道へ戻れそうだ。"
                    },
                    {
                        x: 20,
                        y: 2,
                        toDungeon: "WIND_TEMPLE",
                        auto: true,
                        label: "風の神殿へ入る",
                        log: "森の北端に、風の神殿へ続く古い石門が開いている。",
                        requiredFlag: "windForestCleansed",
                        lockedLabel: "石門を調べる",
                        lockedLog: "黒い風が石門を塞いでいる。祈りの広場の守護者を鎮めなければ進めなさそうだ。"
                    }
                ],
                chests: [
                    { x: 5, y: 15, itemId: 106, type: "item", rare: true },
                    { x: 34, y: 20, itemId: 4, type: "item" }
                ],
                bosses: [
                    {
                        x: 20,
                        y: 18,
                        monsterId: [301011, 301012],
                        keyRewardColor: "gold",
                        startEventId: "wind_forest_guardians_encounter",
                        storyEventId: "wind_forest_guardians_clear",
                        actionLabel: "守護者に祈る",
                        inspectLog: "祈りの広場の中央で、黒い風に包まれた守護者がうずくまっている。"
                    }
                ],
                entryPoint: { x: 35, y: 32 }
            }
        ]
    },
    WIND_TEMPLE: {
        name: "風の神殿",
        themeKey: "WIND_VILLAGE",
        rank: 26,
        encounterRank: 26,
        battleBg: "battle_bg_dungeon",
        entryPoint: { x: 11, y: 18 },
        floors: [
            {
                label: "風廊",
                encounterRank: 26,
                monsters: [100024,100025,100026],
                width: 23,
                height: 21,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWTTTTTWWWWWWWWWWWWWWWW",
                    "WWTCTTTWWWWWWWWWWWWWWWW",
                    "WWTTTTTWWWWWWWWWWWWWWWW",
                    "WWTTTTTWWWWWWWWWWWWWWWW",
                    "WWWWTWWWWWWWWWWWWTTTTTW",
                    "WWWWTWWWWWWWWWWWWTTTTTW",
                    "WWWWTWWWWWWWWWWWWTTTTTW",
                    "WWWWTWWWWWWWWWWWWTTTDTW",
                    "WWWWTWWWWWWWWWWWWTTTTTW",
                    "WWWWTWWWWWWWWWWWWTTTTTW",
                    "WWWWTWWWWWWWWWWWWTTTTTW",
                    "WWWWTTTTTTTTTTTTTTTWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
                    "WWWWWWWWTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTWWWWWWWW",
                    "WWWWWWWWWWWSWWWWWWWWWWW"
                ],
                floorLinks: [
                    {
                        "x": 11,
                        "y": 20,
                        "to": "EXIT",
                        "label": "森へ戻る"
                    },
                    {
                        "x": 20,
                        "y": 9,
                        "toFloor": 2,
                        "targetX": 2,
                        "targetY": 9,
                        "label": "旋風の回廊へ"
                    }
                ],
                chests: [
                    {
                        "x": 3,
                        "y": 3,
                        "itemId": 1,
                        "type": "item"
                    }
                ],
                entryPoint: {
                    "x": 11,
                    "y": 19
                }
            },
            {
                label: "旋風の回廊",
                encounterRank: 28,
                monsters: [100026,100027,100028],
                width: 23,
                height: 21,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWTTTTTTTTWWWWWWW",
                    "WWWWWWWWTTTTTTTTWWWWWWW",
                    "WWWWWWWWTTTTTTTTWWWWWWW",
                    "WTTTTTTWTTTTTTTTWWWWWWW",
                    "WTTTTTTWTTTTTTTTWWWWWWW",
                    "WTUTTTTTTTTWWWWTWWWWWWW",
                    "WTTTTTTWWWTWWWWTWWWWWWW",
                    "WTTTTTTWWWTWWWWTWWWWWWW",
                    "WWWWWWWWWWTWWWWTWWWWWWW",
                    "WWWWWWWWWWTWWWWTWWWWWWW",
                    "WWWWWWWWWWTTTTTTTWWWWWW",
                    "WWWWWWWWWWWWWWTTTTTTTTW",
                    "WWWWWWWWWWWWWWTTTTTTTTW",
                    "WWWWWWWWWWWWWWTTTTTTTTW",
                    "WWWWWWWWWWWWWWTTTTTDTTW",
                    "WWWWWWWWWWWWWWTTTTTTTTW",
                    "WWWWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    {
                        "x": 2,
                        "y": 9,
                        "toFloor": 1,
                        "targetX": 20,
                        "targetY": 9,
                        "label": "風廊へ戻る"
                    },
                    {
                        "x": 19,
                        "y": 18,
                        "toFloor": 3,
                        "targetX": 11,
                        "targetY": 17,
                        "label": "風の祭壇へ"
                    }
                ],
                entryPoint: {
                    "x": 2,
                    "y": 9
                }
            },
            {
                label: "風の祭壇",
                encounterRank: 30,
                monsters: [100028,100029,100030],
                width: 23,
                height: 21,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTBTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
                    "WWWWWWWTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTUTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    {
                        "x": 11,
                        "y": 17,
                        "toFloor": 2,
                        "targetX": 19,
                        "targetY": 18,
                        "label": "旋風の回廊へ戻る"
                    }
                ],
                bosses: [
                    {
                        "x": 11,
                        "y": 8,
                        "monsterId": 301020,
                        "startEventId": "wind_temple_elicia_encounter",
                        "storyEventId": "wind_temple_clear",
                        "actionLabel": "祭壇へ進む"
                    }
                ],
                entryPoint: {
                    "x": 11,
                    "y": 17
                }
            }
        ]
    },
    SEABED_TEMPLE: {
        name: "海底神殿",
        themeKey: "WATER_CITY",
        rank: 35,
        encounterRank: 35,
        battleBg: "battle_bg_dungeon",
        overlayOverrides: { B: tileEntry("overlay_npc_dark_soldier", "#333946"), A: tileEntry("overlay_npc_dark_soldier", "#333946") },
        entryPoint: { x: 11, y: 20 },
        floors: [
            {
                label: "沈水回廊",
                encounterRank: 35,
                monsters: [100033,100034,301021],
                width: 23,
                height: 23,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTDTTTTWWWWWWW",
                    "WWWTTTTTTTTTTTTTTTTTWWW",
                    "WWWTWWWTTTTTTTTTWWWTWWW",
                    "WWWTWWWWWWWTWWWWWWWTWWW",
                    "WWWTWWWWWWWTWWWWWWWTWWW",
                    "WWWTWWWWWWWTWWWWWWWTWWW",
                    "WWWTWWWWWWWTWWWWWWWTWWW",
                    "WWWTWWTTTTTTTTTTTWWTWWW",
                    "WWWTWWTTTTTTTTTTTWWTWWW",
                    "WWWTTTTTTTTTTTTTTTTTWWW",
                    "WWWWWWTTTTTTTTTTTWWWWWW",
                    "WWWWWWTTTTTTTTTTTWWWWWW",
                    "WWWWWWWWWWWYWWWWWWWWWWW",
                    "WWWWWWWTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTBTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTWWWWWWW",
                    "WWWWWWWWWWWSWWWWWWWWWWW"
                ],
                floorLinks: [
                    {
                        "x": 11,
                        "y": 22,
                        "to": "EXIT",
                        "label": "外へ出る"
                    },
                    {
                        "x": 11,
                        "y": 5,
                        "toFloor": 2,
                        "targetX": 11,
                        "targetY": 19,
                        "label": "水門へ"
                    }
                ],
                bosses: [
                    {
                        "x": 11,
                        "y": 19,
                        "monsterId": [
                            301022,
                            301021,
                            301021
                        ],
                        "keyRewardColors": ["red", "blue"],
                        "startEventId": "sea_temple_gate_encounter",
                        "storyEventId": "sea_temple_gate_clear",
                        "actionLabel": "兵士に話しかける"
                    }
                ],
                entryPoint: {
                    "x": 11,
                    "y": 20
                }
            },
            {
                label: "水門",
                encounterRank: 37,
                monsters: [100034,100035,301022],
                width: 23,
                height: 23,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WTTTTTWWWWWWWWWWWWWWWWW",
                    "WTDTTTWWWWWWWWWWWWWWWWW",
                    "WTTTTTTTTTTTWWWWWWWWWWW",
                    "WTTTTTWWWWWTWWWWWWWWWWW",
                    "WTTTTTWWWWWTWWWWWWWWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
                    "WWWWWWWWWWWXWWWWWWWWWWW",
                    "WWWWWWWWTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTWWWWWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
                    "WWWWWWWWTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTUTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    {
                        "x": 11,
                        "y": 19,
                        "toFloor": 1,
                        "targetX": 11,
                        "targetY": 5,
                        "label": "沈水回廊へ戻る"
                    },
                    {
                        "x": 2,
                        "y": 2,
                        "toFloor": 3,
                        "targetX": 11,
                        "targetY": 19,
                        "label": "祈祷の間へ"
                    }
                ],
                entryPoint: {
                    "x": 11,
                    "y": 19
                }
            },
            {
                label: "祈祷の間",
                encounterRank: 39,
                monsters: [100036,100037,301022],
                width: 23,
                height: 23,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTBTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTWWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
                    "WWWWWWWTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTUTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    {
                        "x": 11,
                        "y": 19,
                        "toFloor": 2,
                        "targetX": 2,
                        "targetY": 2,
                        "label": "赤水門へ戻る"
                    }
                ],
                bosses: [
                    {
                        "x": 11,
                        "y": 8,
                        "monsterId": [
                            301030,
                            301022,
                            301022
                        ],
                        "startEventId": "water_temple_syris_encounter",
                        "storyEventId": "water_temple_clear",
                        "actionLabel": "氷の祭壇へ進む"
                    }
                ],
                entryPoint: {
                    "x": 11,
                    "y": 19
                }
            }
        ]
    },
    "BIG_TOWER": {
        "name": "大灯台",
        "themeKey": "BIG_TOWER",
        "rank": 30,
        "encounterRank": 30,
        "battleBg": "battle_bg_dungeon",
        "entryPoint": {
            "x": 10,
            "y": 19
        },
        "floors": [
            {
                "label": "1階・潮風の塔道",
                "encounterRank": 30,
                "monsters": [
                    100026,
                    100027,
                    100028
                ],
                "width": 21,
                "height": 21,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WTTTTTTWWWWWWWTTTTTTW",
                    "WTCTTTTWWWWWWWTTTTDTW",
                    "WTTTTTTTTTTTTTTTTTTTW",
                    "WTTTTTTWWWWWWWTTTTTTW",
                    "WTTTTTTWWWWWWWTTTTTTW",
                    "WWWWWWWWWWWWWWWWWWTWW",
                    "WWWWWWWWWWTWWWWWWWTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTWTWTTTTTTTWW",
                    "WWWWWWWWWWTWWWWWWWWWW",
                    "WWWWWWWWWWTWWWWWWWWWW",
                    "WTTTTTTTWWTWWTTTTTTTW",
                    "WTTTTTTTWWTWWTTTTTTTW",
                    "WTTTTTTTTTTTTTTTTTCTW",
                    "WTTTTTTTWWTWWTTTTTTTW",
                    "WWWWWWWWWWSWWWWWWWWWW"
                ],
                "floorLinks": [
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
                        "label": "2階へ"
                    }
                ],
                "chests": [
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
                "entryPoint": {
                    "x": 10,
                    "y": 19
                }
            },
            {
                "label": "2階・螺旋階段",
                "encounterRank": 31,
                "monsters": [
                    100027,
                    100028,
                    100029
                ],
                "width": 21,
                "height": 21,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWUTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTWWWWWWWWWWWTTTWW",
                    "WWTTTWWWWWWWWWWWTTTWW",
                    "WWTTTWWTTTTTTTWWTTTWW",
                    "WWTTTWWTTTTTTTWWTTTWW",
                    "WWTTTWWTTWWWTTWWTTTWW",
                    "WWTTTTTTTTTWTTWWTTTWW",
                    "WWTTTWTTTWTWTTWWTTTWW",
                    "WWTTTWWTTTTTTTWWTTTWW",
                    "WWTTTWWTTTTTTTWWTTTWW",
                    "WWTTTWWWWWTWWWWWTTTWW",
                    "WWTTTWWWWWTWWWWWTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTDWW",
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 18,
                        "y": 18,
                        "toFloor": 1,
                        "targetX": 18,
                        "targetY": 2,
                        "label": "1階へ戻る"
                    },
                    {
                        "x": 2,
                        "y": 2,
                        "toFloor": 3,
                        "targetX": 2,
                        "targetY": 18,
                        "label": "3階へ"
                    }
                ],
                "entryPoint": {
                    "x": 18,
                    "y": 18
                }
            },
            {
                "label": "3階・灯火回廊",
                "encounterRank": 32,
                "monsters": [
                    100028,
                    100029,
                    100030
                ],
                "width": 21,
                "height": 21,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WTTTTTTTTWWWTTTTTTTTW",
                    "WTCTTTTTTWWWTTTTTTDTW",
                    "WTTTTTTTTTGTTTTTTTTTW",
                    "WTTTTTTTTWWWTTTTTTTTW",
                    "WTTTTTTTTWWWTTTTTTTTW",
                    "WTTTTTTTTWWWTTTTTTTTW",
                    "WWWWWWWWWWGWTTTTTTTTW",
                    "WWWWWWWWTTTTTTTTTTTTW",
                    "WWWWWWWWTTTTTWWWWWTWW",
                    "WWWWGWWWGTTTGTTTGTTWW",
                    "WWWWWWWWTTGTTWWWWWWWW",
                    "WTTTTTTTTTTTTWWWWWWWW",
                    "WTTTTTTTTTTWWTTTTTTTW",
                    "WTTTTTTTTTTWWTTTTTTTW",
                    "WTTTTTTTTTGWWTTTTTTTW",
                    "WTTTTTTTTTTWWTTTTTTTW",
                    "WTTTTTTTTTTWWTTTTTTTW",
                    "WTUTTTTTTTTTTTTTTTCTW",
                    "WTTTTTTTTTWWWTTTTTTTW",
                    "WWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 2,
                        "y": 18,
                        "toFloor": 2,
                        "targetX": 2,
                        "targetY": 2,
                        "label": "2階へ戻る"
                    },
                    {
                        "x": 18,
                        "y": 2,
                        "toFloor": 4,
                        "targetX": 2,
                        "targetY": 18,
                        "label": "4階へ"
                    }
                ],
                "chests": [
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
                "entryPoint": {
                    "x": 2,
                    "y": 18
                }
            },
            {
                "label": "4階・結界炉",
                "encounterRank": 34,
                "monsters": [
                    100030,
                    100031,
                    100032
                ],
                "width": 21,
                "height": 21,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWCTTTTTTTTTTTTTTTDWW",
                    "WWTTTTTTTTGTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWWWWWWWWWWWWWWWWWTWW",
                    "WWWWTTTTTTGTTTTTTWTWW",
                    "WWWWTTTTTTTTTTTTTWTWW",
                    "WWWWTTTTTTTTTTTTTWTWW",
                    "WWWWGWWWGTBTGTTTGTTWW",
                    "WTTTTTTTWTGTWTTTTTTTW",
                    "WTTTTTTTWTTTWTTTTTTTW",
                    "WTTTTTTTWTTTWTTTTTTTW",
                    "WTTTTTTTWTTTWTTTTTTTW",
                    "WTTTTTTTWTGTWTTTTTTTW",
                    "WWWWWWWWWTTTWWWWWWWWW",
                    "WWWTTTTTTTTTTTTTTTWWW",
                    "WWUTTTTTTTTTTTTTTTCWW",
                    "WWWTTTTTTTTTTTTTTTWWW",
                    "WWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 2,
                        "y": 18,
                        "toFloor": 3,
                        "targetX": 18,
                        "targetY": 2,
                        "label": "3階へ戻る"
                    },
                    {
                        "x": 18,
                        "y": 2,
                        "toFloor": 5,
                        "targetX": 18,
                        "targetY": 18,
                        "label": "5階へ"
                    }
                ],
                "chests": [
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
                "bosses": [
                    {
                        "x": 10,
                        "y": 10,
                        "monsterId": [
                            301060,
                            301062
                        ],
                        "requiredFlag": "thunderFortCleared",
                        "inactiveTile": "G",
                        "keyRewardColor": "gold",
                        "startEventId": "big_tower_midboss_encounter",
                        "storyEventId": "big_tower_midboss_clear",
                        "actionLabel": "結界炉へ踏み込む"
                    }
                ],
                "entryPoint": {
                    "x": 2,
                    "y": 18
                },
                "healSprings": [
                    {
                        "x": 10,
                        "y": 12
                    }
                ]
            },
            {
                "label": "5階・風鳴りの壁",
                "encounterRank": 35,
                "monsters": [
                    100031,
                    100032,
                    100033
                ],
                "width": 21,
                "height": 21,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WTTTTTTWWWWWWWTTTTTTW",
                    "WTUTTTTWWWWWWWTTTTTTW",
                    "WTTTTTTTTTTTTTTTTTTTW",
                    "WTTTTTTWWWWWWWTTTTTTW",
                    "WTTTTTTWWWWWWWTTTTTTW",
                    "WWTWWWWWWWWWWWWWWWWWW",
                    "WWTWWWWWWWTWWWWWWWWWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTWTWTTTTTTTWW",
                    "WWWWWWWWWWZWWWWWWWWWW",
                    "WWWWWWWWWWTWWWWWWWWWW",
                    "WTTTTTTTWWTWWTTTTTTTW",
                    "WTTTTTTTWWTWWTTTTTTTW",
                    "WTTTTTTTTTTTTTTTTTDTW",
                    "WTTTTTTTWWWWWTTTTTTTW",
                    "WWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 18,
                        "y": 18,
                        "toFloor": 4,
                        "targetX": 18,
                        "targetY": 2,
                        "label": "4階へ戻る"
                    },
                    {
                        "x": 2,
                        "y": 2,
                        "toFloor": 6,
                        "targetX": 2,
                        "targetY": 18,
                        "label": "6階へ"
                    }
                ],
                "entryPoint": {
                    "x": 18,
                    "y": 18
                }
            },
            {
                "label": "6階・古い守衛室",
                "encounterRank": 36,
                "monsters": [
                    100032,
                    100033,
                    100034
                ],
                "width": 21,
                "height": 21,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWCTTTTTTTTTTTTTTTDWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTWWWWWWWWWWWTTTWW",
                    "WWTTTWWWWWWWWWWWTTTWW",
                    "WWTTTWTTTTTTTTWWTTTWW",
                    "WWTTTWWTTTTTTTWWTTTWW",
                    "WWTTTWWTTWWWTTWWTTTWW",
                    "WWTTTWWTTWTTTTTTTTTWW",
                    "WWTTTWWTTWTWTTWWTTTWW",
                    "WWTTTWWTTTTTTTWWTTTWW",
                    "WWTTTWWTTTTTTTWWTTTWW",
                    "WWTTTWWWWWTWWWWWTTTWW",
                    "WWTTTWWWWWTWWWWWTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWUTTTTTTTTTTTTTTTCWW",
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 2,
                        "y": 18,
                        "toFloor": 5,
                        "targetX": 2,
                        "targetY": 2,
                        "label": "5階へ戻る"
                    },
                    {
                        "x": 18,
                        "y": 2,
                        "toFloor": 7,
                        "targetX": 18,
                        "targetY": 18,
                        "label": "7階へ"
                    }
                ],
                "chests": [
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
                "entryPoint": {
                    "x": 2,
                    "y": 18
                }
            },
            {
                "label": "7階・灯台頂上",
                "encounterRank": 40,
                "monsters": [
                    100035,
                    100036,
                    100037
                ],
                "width": 21,
                "height": 21,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWCTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTTBTTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTWW",
                    "WWWWWWWWWWTWWWWWWWWWW",
                    "WWWWTTTTTTTTTTTTTWWWW",
                    "WWWWTTTTTTTTTTTTTWWWW",
                    "WWWWTTTTTTTTTTTTTWWWW",
                    "WWWWTWWWTTTTTWWWTWWWW",
                    "WTTTTTTTWTTTWTTTTTTTW",
                    "WTTTTTTTWTTTWTTTTTTTW",
                    "WTTTTTTTWTTTWTTTTTTTW",
                    "WTTTTTTTWTTTWTTTTTTTW",
                    "WTTTTTTTWTTTWTTTTTTTW",
                    "WWWWWWWWWTTTWWWWWWWWW",
                    "WWWTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTDWW",
                    "WWWTTTTTTTTTTTTTTTWWW",
                    "WWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 18,
                        "y": 18,
                        "toFloor": 6,
                        "targetX": 18,
                        "targetY": 2,
                        "label": "6階へ戻る"
                    }
                ],
                "chests": [
                    {
                        "x": 2,
                        "y": 2,
                        "itemId": 1,
                        "type": "item"
                    }
                ],
                "bosses": [
                    {
                        "x": 10,
                        "y": 4,
                        "monsterId": 301061,
                        "requiredFlag": "thunderFortCleared",
                        "inactiveTile": "G",
                        "startEventId": "big_tower_lilith_encounter",
                        "storyEventId": "big_tower_clear",
                        "actionLabel": "リリスと対峙する"
                    }
                ],
                "entryPoint": {
                    "x": 18,
                    "y": 18
                }
            }
        ]
    },
    "THUNDER_FORT": {
        "name": "雷の要塞",
        "themeKey": "THUNDER_FORT",
        "rank": 40,
        "encounterRank": 40,
        "battleBg": "battle_bg_dungeon",
        "entryPoint": {
            "x": 1,
            "y": 12
        },
        "entryPoints": {
            "west": {
                "x": 1,
                "y": 12
            },
            "east": {
                "x": 29,
                "y": 12
            }
        },
        "floors": [
            {
                "label": "1階・双門外郭",
                "encounterRank": 42,
                "monsters": [
                    100040,
                    100041,
                    100042
                ],
                "width": 31,
                "height": 25,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWTTTTTTTWWWWWWWWWWWTTTTTTTWWW",
                    "WWWTTTCTTTTTTTTTTTTTTTTTTDTTWWW",
                    "WWWTTTTTTTWWWWTTTWWWWTTTTTTTWWW",
                    "WWWTTTTTTTWWWWTTTWWWWTTTTTTTWWW",
                    "WWWWWWWWWWWWWWWTWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWTTTTTTTTTTTWWWWWWWWWW",
                    "WWWWWWWWWWTTTTTTTTTTTWWWWWWWWWW",
                    "WTTTTTTTWWTTTTTTTTTTTWWTTTTTTTW",
                    "WTTTTTTTWWTTTTTTTTTTTWWTTTTTTTW",
                    "STTTTTTTTTTTTTTBTTTTTTTTTTTTTTS",
                    "WTTTTTTTWWTTTTTTTTTTTWWTTTTTTTW",
                    "WTTTTTTTWWTTTTTTTTTTTWWTTTTTTTW",
                    "WWWWWWWWWWTTTTTTTTTTTWWWWWWWWWW",
                    "WWWWWWWWWWTTTTTTTTTTTWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWZWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWTWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTTTTTWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTTTTTWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTCTTTTTWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTTTTTWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 0,
                        "y": 12,
                        "to": "EXIT",
                        "label": "西門から外に出る",
                        "log": "西門の向こうに、川沿いの岸辺が見える。",
                        "exitPoint": {
                            "areaKey": "WORLD",
                            "x": 45,
                            "y": 36
                        }
                    },
                    {
                        "x": 30,
                        "y": 12,
                        "to": "EXIT",
                        "label": "東門から外に出る",
                        "log": "門の向こうに、うっすらと光の神殿が見える。",
                        "requiredFlag": "thunderFortCleared",
                        "lockedLabel": "東門を調べる",
                        "lockedLog": "東門は雷の結界で閉ざされている…",
                        "exitPoint": {
                            "areaKey": "WORLD",
                            "x": 47,
                            "y": 36
                        }
                    },
                    {
                        "x": 25,
                        "y": 4,
                        "toFloor": 2,
                        "targetX": 4,
                        "targetY": 21,
                        "label": "地下1階へ"
                    }
                ],
                "chests": [
                    {
                        "x": 13,
                        "y": 21,
                        "itemId": 3,
                        "type": "item"
                    },
                    {
                        "x": 6,
                        "y": 4,
                        "itemId": 1,
                        "type": "item"
                    }
                ],
                "entryPoint": {
                    "x": 1,
                    "y": 12
                },
                "bosses": [
                    {
                        "x": 15,
                        "y": 12,
                        "monsterId": 100081,
                        "keyRewardColor": "gold",
                        "actionLabel": "機械兵士と戦う",
                        "inspectLog": "一際危険なオーラを纏う機械兵士が佇んでいる…"
                    }
                ],
                "healSprings": [
                    {
                        "x": 17,
                        "y": 21
                    }
                ]
            },
            {
                "label": "地下1階・暴走機関室",
                "encounterRank": 44,
                "monsters": [
                    100042,
                    100043,
                    100044
                ],
                "width": 31,
                "height": 25,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWTTTTTTTWWWTTTTTWWWWTTWTTTTWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTXTTRTWW",
                    "WWWTTTTTTTWWWTTTTTWWWWTTWTTDTWW",
                    "WWWTTTTTTTWWWTTTTTWWWWTTWTTTTWW",
                    "WWWWWWWWWWWWWWWTWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWTWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWTWWWWWWWWWWWWWWW",
                    "WWTTTTTTTWWWWWWTWWWWWWWWWWWWWWW",
                    "WWTTTTTTTWWTTTTTTTTTWWWWWWWWWWW",
                    "WWTTTCTTTWWTTTTTTTTTWWTTTTTTTWW",
                    "WWTTTTTTTTTTTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTWWTTTTBTTTTWWTTTTTTTWW",
                    "WWWWWWWWWWWTTTTTTTTTWWTTTTTTTWW",
                    "WWWWWWWWWWWTTTTTTTTTWWTTTTTTTWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWTWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWTWWWWW",
                    "WWWWWWWWWWTTTTTTTTTTTWTTTTTTTWW",
                    "WWTTTTTTTWTTTTTTTTTTTWTTTTTTTWW",
                    "WWTTTTTTTWTTTTTTTTTTTTTTTTTTTWW",
                    "WWTTUTTTTTTTTTTTTTTTTWTTTTTTTWW",
                    "WWTTTTTTTWTTTTTTTTTTTWTTTTTTTWW",
                    "WWTTTTTTTWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 4,
                        "y": 21,
                        "toFloor": 1,
                        "targetX": 25,
                        "targetY": 4,
                        "label": "1階へ戻る"
                    },
                    {
                        "x": 27,
                        "y": 4,
                        "toFloor": 3,
                        "targetX": 4,
                        "targetY": 21,
                        "label": "地下2階へ"
                    }
                ],
                "chests": [
                    {
                        "x": 27,
                        "y": 3,
                        "itemId": 102,
                        "type": "item",
                        "rare": true
                    },
                    {
                        "x": 5,
                        "y": 11,
                        "itemId": 1,
                        "type": "item"
                    }
                ],
                "entryPoint": {
                    "x": 4,
                    "y": 21
                },
                "bosses": [
                    {
                        "x": 15,
                        "y": 13,
                        "monsterId": 301031,
                        "keyRewardColor": "red",
                        "startEventId": "thunder_machine_gate_encounter",
                        "storyEventId": "thunder_machine_gate_clear",
                        "actionLabel": "制御盤に近づく"
                    }
                ]
            },
            {
                "label": "地下2階・雷鎧の防衛線",
                "encounterRank": 46,
                "monsters": [
                    100044,
                    100045,
                    100046
                ],
                "width": 31,
                "height": 25,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWTTTTTTTWWWTTTTTWWWWTTTTTTTWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTTWW",
                    "WWWTTTCTTTWWWTTTTTWWWWTTTDTTTWW",
                    "WWWTTTTTTTWWWTTTTTWWWWTTTTTTTWW",
                    "WWWWWTWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWTWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWTTTTTTTWWWWWWWWWWWWWWWWWWWWW",
                    "WWTTTTTTTWTTTTTTTTTTTWWWWWWWWWW",
                    "WWTTTTTTTWTTTTTTTTTTTWTTTTTTTWW",
                    "WWTTTTTTTYTTTTTTTTTTTWTTTTTTTWW",
                    "WWTTTTTTTWTTTTTBTTTTTTTTTTTTTWW",
                    "WWTTTTTTTWTTTTTTTTTTTWTTTTTTTWW",
                    "WWWWWWWWWWTTTTTTTTTTTWTTTTTTTWW",
                    "WWWWWWWWWWTTTTTTTTTTTWTTTTTTTWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWTWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWTWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTWWTTTTTTTWW",
                    "WWTTTTTTTWWTTTTTTTTTWWTTTTTTTWW",
                    "WWTTTTTTTWWTTTTTTTTTTTTCTTTTTWW",
                    "WWTTUTTTTTTTTTTTTTTTWWTTTTTTTWW",
                    "WWTTTTTTTWWTTTTTTTTTWWTTTTTTTWW",
                    "WWTTTTTTTWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 4,
                        "y": 21,
                        "toFloor": 2,
                        "targetX": 25,
                        "targetY": 4,
                        "label": "地下1階へ戻る"
                    },
                    {
                        "x": 25,
                        "y": 4,
                        "toFloor": 4,
                        "targetX": 15,
                        "targetY": 21,
                        "label": "地下3階へ"
                    }
                ],
                "chests": [
                    {
                        "x": 23,
                        "y": 20,
                        "itemId": 3,
                        "type": "item"
                    },
                    {
                        "x": 6,
                        "y": 4,
                        "itemId": 100,
                        "type": "item"
                    }
                ],
                "entryPoint": {
                    "x": 4,
                    "y": 21
                },
                "bosses": [
                    {
                        "x": 15,
                        "y": 12,
                        "monsterId": 301032,
                        "keyRewardColor": "blue",
                        "startEventId": "thunder_armor_gate_encounter",
                        "storyEventId": "thunder_armor_gate_clear",
                        "actionLabel": "雷鎧を停止する"
                    }
                ]
            },
            {
                "label": "地下3階・雷の中枢",
                "encounterRank": 48,
                "monsters": [
                    100046,
                    100047,
                    100048
                ],
                "width": 31,
                "height": 25,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWTTTTTTTTTTTWWWWWWWWWW",
                    "WWWWWWWWWWTTTTTBTTTTTWWWWWWWWWW",
                    "WWWWWWWWWWTTTTTTTTTTTWWWWWWWWWW",
                    "WWWWWWWWWWTTTTTTTTTTTWWWWWWWWWW",
                    "WWWWWWWWWWWWWWTTTWWWWWWWWWWWWWW",
                    "WWWWTTTTTTTTTTTTTTTTTTTTTTTWWWW",
                    "WWWWTTTTTTTTTTTTTTTTTTTTTTTWWWW",
                    "WWWWTTTTTTTTTTTTTTTTTTTTTTTWWWW",
                    "WWWWTTTTTTTTTTTTTTTTTTTTTTTWWWW",
                    "WWWWTTTTTTTTTTTTTTTTTTTTTTTWWWW",
                    "WWWWTTTTTTTTTTTTTTTTTTTTTTTWWWW",
                    "WWWWTTTTTTTTTTTTTTTTTTTTTTTWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WTTTWTTTTTTTTTTTTTTTTTTTTTWTTTW",
                    "WTCTTTTTTTTTTTTTTTTTTTTTTTTTRTW",
                    "WTTTWTTTTTTTTTTTTTTTTTTTTTWTTTW",
                    "WTTTWTTTTTTTTTTTTTTTTTTTTTWTTTW",
                    "WWWWWWWWWWWWWWTTTWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTTTTTWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTUTTTWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTTTTTWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTTTTTWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 15,
                        "y": 21,
                        "toFloor": 3,
                        "targetX": 25,
                        "targetY": 4,
                        "label": "地下2階へ戻る"
                    }
                ],
                "chests": [
                    {
                        "x": 2,
                        "y": 16,
                        "itemId": 3,
                        "type": "item"
                    },
                    {
                        "x": 28,
                        "y": 16,
                        "itemId": 106,
                        "type": "item",
                        "rare": true
                    }
                ],
                "entryPoint": {
                    "x": 15,
                    "y": 21
                },
                "bosses": [
                    {
                        "x": 15,
                        "y": 3,
                        "monsterId": 301040,
                        "startEventId": "thunder_leonard_encounter",
                        "storyEventId": "thunder_fort_clear",
                        "actionLabel": "レナードと対峙する"
                    }
                ]
            }
        ]
    },
    "LIGHT_PALACE": {
        "name": "光の宮殿",
        "themeKey": "LIGHT_PALACE",
        "rank": 50,
        "encounterRank": 50,
        "battleBg": "battle_bg_dungeon",
        "entryPoint": {
            "x": 16,
            "y": 24
        },
        "floors": [
            {
                "label": "1階・白光の回廊",
                "encounterRank": 62,
                "monsters": [
                    100060,
                    100061,
                    100062
                ],
                "width": 33,
                "height": 27,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWTTTTTTTWWWWWWWWWWWWW",
                    "WWWWTTTTTTTWWTTTDTTTWWWTTTTTTTWWW",
                    "WWWWTTTCTTTTTTTTTTTTTTTTTTBTTTWWW",
                    "WWWWTTTTTTTWWTTTTTTTWWWTTTTTTTWWW",
                    "WWWWTTTTTTTWWTTTTTTTWWWTTTTTTTWWW",
                    "WWWWWWWTWWWWWWWWWWWWWWWWWWTWWWWWW",
                    "WWWWWWWTWWWWWWWWWWWWWWWWWWTWWWWWW",
                    "WWWWWWWTWWWWTTTTTTTTTWWWWWTWWWWWW",
                    "WWWTTTTTTTWWTTTTTTTTTWWTTTTTTTWWW",
                    "WWWTTTTTTTWWTTTTTTTTTWWTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTWWTTTTTTTTTWWTTTTTTTWWW",
                    "WWWTTTTTTTWWTTTTTTTTTWWTTTTTTTWWW",
                    "WWWTTTTTTTWWTTTTTTTTTWWTTTTTTTWWW",
                    "WWWWWWWWWWWWWWWTTTWWWWWWWWWWWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTCTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWWWWWWWWWTTTTTTTWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWTTTTTTTWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWTTTTTTTWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWTTTSTTTWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 16,
                        "y": 25,
                        "to": "EXIT",
                        "label": "外に出る"
                    },
                    {
                        "x": 16,
                        "y": 3,
                        "toFloor": 2,
                        "targetX": 4,
                        "targetY": 23,
                        "label": "地下1階へ"
                    }
                ],
                "chests": [
                    {
                        "x": 16,
                        "y": 20,
                        "itemId": 1,
                        "type": "item"
                    },
                    {
                        "x": 7,
                        "y": 4,
                        "itemId": 3,
                        "type": "item"
                    }
                ],
                "entryPoint": {
                    "x": 16,
                    "y": 24
                },
                "bosses": [
                    {
                        "x": 26,
                        "y": 4,
                        "monsterId": 100089,
                        "keyRewardColor": "gold",
                        "actionLabel": "白光の番兵と戦う",
                        "inspectLog": "金の鍵を携えた番兵が白い回廊を守っている。"
                    }
                ],
                "healSprings": [
                    {
                        "x": 16,
                        "y": 16
                    }
                ]
            },
            {
                "label": "地下1階・祝福の水盤",
                "encounterRank": 64,
                "monsters": [
                    100062,
                    100063,
                    100064
                ],
                "width": 33,
                "height": 27,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWTTTTTTTWWWWWWWWWWWWW",
                    "WWWTTTTTTTTWWTTTTTTTWWWTTTTTTTTWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTTTTWW",
                    "WWWTTTTTTTTWWTTTTTTTWWWTTTTDTTTWW",
                    "WWWTTTTTTTTWWTTTTTTTWWWTTTTTTTTWW",
                    "WWWTTTTTTTTWWWWWTWWWWWWTTTTTTTTWW",
                    "WWWWWWWWWWWWWWWWTWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWTWWWWWWWWWWWWWWWW",
                    "WWTTTTWTTWWWWWWWTWWWWWWWWWWWWWWWW",
                    "WWTTTTWTTWWWTTTTTTTTTWWWWWWWWWWWW",
                    "WWTTTTWTTWWWTTTTTTTTTWWWTTTTTTTWW",
                    "WWTTRCZTTTTTTTTTTTTTTWWWTTTTTTTWW",
                    "WWTTTTWTTWWWTTTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTWTTWWWTTTTTTTTTWWWTTTTTTTWW",
                    "WWWWWWWWWWWWTTTTTTTTTWWWTTTTTTTWW",
                    "WWWWWWWWWWWWTTTTTTTTTWWWTTTTTTTWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWTWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWTWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTTTWWTTTTTTTWW",
                    "WWTTTTTTTWWTTTTTTTTTTTWWTTTTTTTWW",
                    "WWTTTTTTTWWTTTTTTTTTTTTTTTTTTTTWW",
                    "WWTTUTTTTTTTTTTTTTTTTTWWTTTTTTTWW",
                    "WWTTTTTTTWWTTTTTTTTTTTWWTTTTTTTWW",
                    "WWTTTTTTTWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 4,
                        "y": 23,
                        "toFloor": 1,
                        "targetX": 26,
                        "targetY": 4,
                        "label": "1階へ戻る"
                    },
                    {
                        "x": 27,
                        "y": 5,
                        "toFloor": 3,
                        "targetX": 4,
                        "targetY": 23,
                        "label": "地下2階へ"
                    }
                ],
                "chests": [
                    {
                        "x": 4,
                        "y": 13,
                        "itemId": 103,
                        "type": "item",
                        "rare": true
                    },
                    {
                        "x": 5,
                        "y": 13,
                        "itemId": 1,
                        "type": "item"
                    }
                ],
                "entryPoint": {
                    "x": 4,
                    "y": 23
                }
            },
            {
                "label": "地下2階・結界の聖廊",
                "encounterRank": 66,
                "monsters": [
                    100064,
                    100065,
                    100066
                ],
                "width": 33,
                "height": 27,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWTTTTTTTTWWTTTTTTTWWWTTTTTTTTWW",
                    "WWWTTTTTTTTWWTTTTTTTWWWTTTTTTTTWW",
                    "WWWTTTCTTTTTTTTTTTTTTTTTTTTDTTTWW",
                    "WWWTTTTTTTTWWTTTTTTTWWWTTTTTTTTWW",
                    "WWWTTTTTTTTWWTTTTTTTWWWTTTTTTTTWW",
                    "WWWWWWTWWWWWWWWWTWWWWWWWWWWWWWWWW",
                    "WWWWWWTWWWWWWWWWTWWWWWWWWWWWWWWWW",
                    "WWTTTTTTTWWWWWWWTWWWWWWWWWWWWWWWW",
                    "WWTTTTTTTWWWTTTTTTTTTWWWWWWWWWWWW",
                    "WWTTTTTTTWWWTTTTTTTTTWWWWWWWWWWWW",
                    "WWTTTTTTTTTTTTTTCTTTTWWWTTTTTTTWW",
                    "WWTTTTTTTWWWTTTTTTTTTWWWTTTTTTTWW",
                    "WWTTTTTTTWWWTTTTTTTTTTTTTTTTTTTWW",
                    "WWTTTTTTTWWWTTTTTTTTTWWWTTTTTTTWW",
                    "WWWWWWWWWWWWTTTTTTTTTWWWTTTTTTTWW",
                    "WWWWWWWWWWWWTTTTTTTTTWWWTTTTTTTWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWTWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWTWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTTTWWTTTTTTTWW",
                    "WWTTTTTTTWWTTTTTTTTTTTWWTTTTTTTWW",
                    "WWTTTTTTTWWTTTTTTTTTTTTTTTTTTTTWW",
                    "WWTTUTTTTTTTTTTTTTTTTTWWTTTTTTTWW",
                    "WWTTTTTTTWWTTTTTTTTTTTWWTTTTTTTWW",
                    "WWTTTTTTTWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 4,
                        "y": 23,
                        "toFloor": 2,
                        "targetX": 27,
                        "targetY": 5,
                        "label": "地下1階へ戻る"
                    },
                    {
                        "x": 27,
                        "y": 4,
                        "toFloor": 4,
                        "targetX": 16,
                        "targetY": 23,
                        "label": "地下3階へ"
                    }
                ],
                "chests": [
                    {
                        "x": 6,
                        "y": 4,
                        "itemId": 2,
                        "type": "item"
                    },
                    {
                        "x": 16,
                        "y": 12,
                        "itemId": 105,
                        "type": "item"
                    }
                ],
                "entryPoint": {
                    "x": 4,
                    "y": 23
                }
            },
            {
                "label": "地下3階・光の祭壇",
                "encounterRank": 68,
                "monsters": [
                    100066,
                    100067,
                    100068
                ],
                "width": 33,
                "height": 27,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTTTWWWWWWWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTTTWWWWWWWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTTTWWWWWWWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTTTWWWWWWWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTTTWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWTWWWWWWWWWWWWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTBTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWWTTTTTTTTTTTTTTTTTTTTTWWWWWW",
                    "WWTTTWTTTTTTTTTTTTTTTTTTTTTWTTTWW",
                    "WWTCTTTTTTTTTTTTTTTTTTTTTTTTTRTWW",
                    "WWTTTWTTTTTTTTTTTTTTTTTTTTTWTTTWW",
                    "WWTTTWTTTTTTTTTTTTTTTTTTTTTWTTTWW",
                    "WWWWWWWWWWWWWTTTTTTTWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWTTTTTTTWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWTTTUTTTWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWTTTTTTTWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWTTTTTTTWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                "floorLinks": [
                    {
                        "x": 16,
                        "y": 23,
                        "toFloor": 3,
                        "targetX": 27,
                        "targetY": 4,
                        "label": "地下2階へ戻る"
                    }
                ],
                "chests": [
                    {
                        "x": 3,
                        "y": 18,
                        "itemId": 2,
                        "type": "item"
                    },
                    {
                        "x": 29,
                        "y": 18,
                        "itemId": 106,
                        "type": "item",
                        "rare": true
                    }
                ],
                "entryPoint": {
                    "x": 16,
                    "y": 23
                },
                "bosses": [
                    {
                        "x": 16,
                        "y": 9,
                        "monsterId": [
                            301070,
                            301050
                        ],
                        "startEventId": "light_palace_final_encounter",
                        "storyEventId": "light_palace_clear",
                        "actionLabel": "祭壇へ進む"
                    }
                ]
            }
        ]
    },
    DARK_CASTLE: {
        name: "魔王城",
        themeKey: "DARK_CASTLE",
        rank: 60,
        encounterRank: 60,
        battleBg: "battle_bg_lastboss",
        entryPoint: { x: 15, y: 25 },
        floors: [
            {
                label: "本館1階・中央広間",
                encounterRank: 60,
                monsters: [100056, 100057, 100058],
                width: 31,
                height: 27,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTTTTTWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTDTTTWWWWWWWWWWWW",
                    "WWWWWWWWTTTTTTTTTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTTTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTCTTTTTTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTTTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTTTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTTTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTTTTTTTTTWWWWWWWW",
                    "WWTTTTWWTTTTTTTTTTTTTTTWWTTTTWW",
                    "WWTTTTWWTTTTTTTTTTTTTTTWWTTTTWW",
                    "WWTDTTTTTTTTTTTTTTTTTTTTTTTDTWW",
                    "WWTTTTWWTTTTTTTTTTTTTTTWWTTTTWW",
                    "WWTTTTWWTTTTTTTTTTTTTTTWWTTTTWW",
                    "WWWWWWWWTTTTTTTTTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTTTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTTTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTTTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTGTTTTCTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTTTTTTTTTWWWWWWWW",
                    "WWWWWWWWTTTTTTTTTTTTTTTWWWWWWWW",
                    "WWWWWWWWWWWWWTTTTTWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWTTTTTWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWTTTTTWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWSWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    { "x": 15, "y": 26, "to": "EXIT", "label": "外に出る" },
                    { "x": 3, "y": 13, "toFloor": 2, "targetX": 27, "targetY": 13, "label": "西館へ" },
                    { "x": 27, "y": 13, "toFloor": 4, "targetX": 3, "targetY": 13, "label": "東館へ" },
                    { "x": 15, "y": 3, "toFloor": 6, "targetX": 15, "targetY": 24, "label": "本館2階へ" }
                ],
                chests: [
                    { "x": 10, "y": 6, "itemId": 1, "type": "item" },
                    { "x": 20, "y": 20, "itemId": 3, "type": "item" }
                ],
                bosses: [],
                healSprings: [{ "x": 15, "y": 20 }],
                entryPoint: { "x": 15, "y": 25 }
            },
            {
                label: "西館1階・黒影廊",
                encounterRank: 62,
                monsters: [100058, 100059, 100060],
                width: 31,
                height: 27,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTTTTTWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTDTTTWWWWWWWWWWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTCTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTUWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTRTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    { "x": 27, "y": 13, "toFloor": 1, "targetX": 3, "targetY": 13, "label": "本館1階へ戻る" },
                    { "x": 15, "y": 3, "toFloor": 3, "targetX": 15, "targetY": 24, "label": "西館2階へ" }
                ],
                chests: [
                    { "x": 6, "y": 6, "itemId": 2, "type": "item" },
                    { "x": 6, "y": 20, "itemId": 105, "type": "item", "rare": true }
                ],
                bosses: [],
                entryPoint: { "x": 27, "y": 13 }
            },
            {
                label: "西館2階・結界の間",
                encounterRank: 64,
                monsters: [100059, 100060, 100061],
                width: 31,
                height: 27,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWTTTTTTTTBTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTCTTTTTTTTTTTCTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTWWWWWWWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTWWWWWWWWWWW",
                    "WWWWWWWWWWWTTTTUTTTTWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    { "x": 15, "y": 24, "toFloor": 2, "targetX": 15, "targetY": 3, "label": "西館1階へ戻る" }
                ],
                chests: [
                    { "x": 9, "y": 13, "itemId": 4, "type": "item" },
                    { "x": 21, "y": 13, "itemId": 102, "type": "item", "rare": true }
                ],
                bosses: [
                    { "x": 15, "y": 5, "monsterId": 301080, "keyRewardColor": "blue", "startEventId": "dark_castle_zeldras_encounter", "storyEventId": "dark_castle_zeldras_clear", "actionLabel": "西の結界へ進む" }
                ],
                entryPoint: { "x": 15, "y": 24 }
            },
            {
                label: "東館1階・風哭廊",
                encounterRank: 62,
                monsters: [100058, 100061, 100062],
                width: 31,
                height: 27,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTTTTTWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTDTTTWWWWWWWWWWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTCTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTTWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTTWW",
                    "WWWUTTTTTTTTTTTTTTTTTTTTTTTTTWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTTWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTTWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTRTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWTTTTTTTTTTTTTTTTTTTTTTTTTWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    { "x": 3, "y": 13, "toFloor": 1, "targetX": 27, "targetY": 13, "label": "本館1階へ戻る" },
                    { "x": 15, "y": 3, "toFloor": 5, "targetX": 15, "targetY": 24, "label": "東館2階へ" }
                ],
                chests: [
                    { "x": 24, "y": 6, "itemId": 2, "type": "item" },
                    { "x": 24, "y": 20, "itemId": 105, "type": "item", "rare": true }
                ],
                bosses: [],
                entryPoint: { "x": 3, "y": 13 }
            },
            {
                label: "東館2階・結界の間",
                encounterRank: 64,
                monsters: [100061, 100062, 100063],
                width: 31,
                height: 27,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWTTTTTTTTBTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTCTTTTTTTTTTTCTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTWWWWWWWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTWWWWWWWWWWW",
                    "WWWWWWWWWWWTTTTUTTTTWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    { "x": 15, "y": 24, "toFloor": 4, "targetX": 15, "targetY": 3, "label": "東館1階へ戻る" }
                ],
                chests: [
                    { "x": 9, "y": 13, "itemId": 5, "type": "item" },
                    { "x": 21, "y": 13, "itemId": 103, "type": "item", "rare": true }
                ],
                bosses: [
                    { "x": 15, "y": 5, "monsterId": 301082, "keyRewardColor": "red", "startEventId": "dark_castle_elmenas_encounter", "storyEventId": "dark_castle_elmenas_clear", "actionLabel": "東の結界へ進む" }
                ],
                entryPoint: { "x": 15, "y": 24 }
            },
            {
                label: "本館2階・夢幻回廊",
                encounterRank: 68,
                monsters: [100063, 100064, 100065],
                width: 31,
                height: 27,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTTTTTWWWWWWWWWWWW",
                    "WWWWWWWWWWWWTTTDTTTWWWWWWWWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTBTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTCTTTTTTTTTTTTTTTTTRTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWTTTTTTTTTTTTTTTTTTTTTWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTWWWWWWWWWWW",
                    "WWWWWWWWWWWTTTTUTTTTWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    { "x": 15, "y": 24, "toFloor": 1, "targetX": 15, "targetY": 3, "label": "本館1階へ戻る" },
                    { "x": 15, "y": 3, "toFloor": 7, "targetX": 15, "targetY": 24, "label": "本館3階へ" }
                ],
                chests: [
                    { "x": 6, "y": 17, "itemId": 6, "type": "item" },
                    { "x": 24, "y": 17, "itemId": 104, "type": "item", "rare": true }
                ],
                bosses: [
                    { "x": 15, "y": 11, "monsterId": 301081, "keyRewardColor": "gold", "startEventId": "dark_castle_belet_elm_encounter", "storyEventId": "dark_castle_belet_elm_clear", "actionLabel": "夢幻回廊の奥へ進む" }
                ],
                entryPoint: { "x": 15, "y": 24 }
            },
            {
                label: "本館3階・謁見の間",
                encounterRank: 72,
                monsters: [100066, 100067, 100068],
                width: 31,
                height: 27,
                tiles: [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWTTTTTTTTTWWWWWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTBTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTZTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTXTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTYTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTCTTTTTTTTTTTRTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWWWWWWWWWUWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
                ],
                floorLinks: [
                    { "x": 15, "y": 24, "toFloor": 6, "targetX": 15, "targetY": 3, "label": "本館2階へ戻る" }
                ],
                chests: [
                    { "x": 9, "y": 20, "itemId": 7, "type": "item" },
                    { "x": 21, "y": 20, "itemId": 105, "type": "item", "rare": true }
                ],
                bosses: [
                    { "x": 15, "y": 5, "monsterId": 301100, "startEventId": "dark_castle_zenon_encounter", "storyEventId": "dark_castle_clear", "actionLabel": "謁見の間へ進む" }
                ],
                entryPoint: { "x": 15, "y": 24 }
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
        const wx = Number(x);
        const wy = Number(y);
        for (const [key, area] of Object.entries(STORY_DATA.areas)) {
            if (Array.isArray(area.entrances)) {
                const entrance = area.entrances.find(pos => Number(pos.x) === wx && Number(pos.y) === wy);
                if (entrance) return [key, { ...area, centerX: wx, centerY: wy, _entryKey: entrance.entryKey || null, _entryLabel: entrance.label || null }];
            }
            if (Number(area.centerX) === wx && Number(area.centerY) === wy) {
                return [key, { ...area, _entryKey: area.defaultEntryKey || null }];
            }
        }
        return null;
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
        if (link?.to === 'EXIT') return link?.label || '外に出る';
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
    window.FIELD_ENCOUNTER_ZONES = FIELD_ENCOUNTER_ZONES;
}
