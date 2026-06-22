/* map.js */
// ==========================================
// マップデータ正本
// - ワールド座標、固定マップ、固定ダンジョン、地域別タイル設定をこのファイルに集約。
// - タイル画像キーは assets.js の PRISMA_ASSETS.graphics を参照。
// ==========================================

const tileEntry = (img, color, options = {}) => ({ img, color, ...options });

// ストーリーによる地形変更の座標もmap.jsを正本とする。
// story.jsはこのキーだけを参照し、個別座標を保持しない。
const STORY_MAP_MUTATIONS = {
    START_CAVE_GATE_OPEN: {
        area: "START_CAVE",
        changes: [
            { x: 15, y: 17, tile: "G" },
            { x: 15, y: 16, tile: "G" }
        ]
    }
};

// 追加ダンジョン用の決定論的な手描きレイアウト補助。
// roomsで広間、pathsで折れ曲がる通路を構成し、最後に階段やボス記号を配置する。
const buildAuthoredLayout = (width, height, { rooms = [], paths = [], marks = [] } = {}) => {
    const grid = Array.from({ length: height }, () => Array(width).fill("W"));
    const carve = (x, y, radius = 0) => {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const tx = Number(x) + dx;
                const ty = Number(y) + dy;
                if (tx > 0 && ty > 0 && tx < width - 1 && ty < height - 1) grid[ty][tx] = "T";
            }
        }
    };
    rooms.forEach(([x, y, roomWidth, roomHeight]) => {
        for (let ty = y; ty < y + roomHeight; ty++) {
            for (let tx = x; tx < x + roomWidth; tx++) carve(tx, ty);
        }
    });
    paths.forEach(path => {
        const points = Array.isArray(path.points) ? path.points : path;
        const radius = Math.max(0, Math.floor(Number(path.width || 1) / 2));
        for (let i = 1; i < points.length; i++) {
            let [x, y] = points[i - 1].map(Number);
            const [targetX, targetY] = points[i].map(Number);
            const horizontalFirst = path.horizontalFirst !== false;
            const walkAxis = (axis, target) => {
                while ((axis === "x" ? x : y) !== target) {
                    if (axis === "x") x += Math.sign(target - x);
                    else y += Math.sign(target - y);
                    carve(x, y, radius);
                }
            };
            carve(x, y, radius);
            if (horizontalFirst) {
                walkAxis("x", targetX);
                walkAxis("y", targetY);
            } else {
                walkAxis("y", targetY);
                walkAxis("x", targetX);
            }
        }
    });
    marks.forEach(([x, y, symbol]) => {
        if (x >= 0 && y >= 0 && x < width && y < height) grid[y][x] = symbol;
    });
    return grid.map(row => row.join(""));
};

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
        W: tileEntry("sea", "#155d7a", { animatedWater: true }),
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
    WIND_HOLE: {
        W: tileEntry("tile_wind_hole_wall", "#243f38", { variants: ["tile_wind_hole_wall", "tile_wind_hole_wall_2", "tile_wind_hole_wall_3", "tile_wind_hole_wall_4"] }),
        T: tileEntry("tile_wind_hole_floor", "#536b62", { variants: ["tile_wind_hole_floor", "tile_wind_hole_floor_2", "tile_wind_hole_floor_3", "tile_wind_hole_floor_4"] }),
        G: tileEntry("tile_wind_hole_floor", "#60796d", { variants: ["tile_wind_hole_floor", "tile_wind_hole_floor_2", "tile_wind_hole_floor_3", "tile_wind_hole_floor_4"] }),
        S: tileEntry("tile_wind_hole_floor", "#d7b45a")
    },
    FORBIDDEN_FOREST: {
        W: tileEntry("tile_forbidden_forest_wall", "#172a20", { variants: ["tile_forbidden_forest_wall", "tile_forbidden_forest_wall_2", "tile_forbidden_forest_wall_3", "tile_forbidden_forest_wall_4"] }),
        T: tileEntry("tile_forbidden_forest_floor", "#3d4d2d", { variants: ["tile_forbidden_forest_floor", "tile_forbidden_forest_floor_2", "tile_forbidden_forest_floor_3", "tile_forbidden_forest_floor_4"] }),
        G: tileEntry("tile_forbidden_forest_floor", "#485b34", { variants: ["tile_forbidden_forest_floor", "tile_forbidden_forest_floor_2", "tile_forbidden_forest_floor_3", "tile_forbidden_forest_floor_4"] }),
        S: tileEntry("tile_forbidden_forest_floor", "#d7b45a")
    },
    WATER_CITY: {
        W: tileEntry("tile_water_canal", "#155d7a", { lowerLayer: true, animatedWater: true }),
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
        W: tileEntry("tile_thunder_wall", "#52616c", { variants: ["tile_thunder_wall", "tile_thunder_wall_2", "tile_thunder_wall_3", "tile_thunder_wall_4"] }),
        T: tileEntry("tile_thunder_floor", "#52616c", { variants: ["tile_thunder_floor", "tile_thunder_floor_2", "tile_thunder_floor_3", "tile_thunder_floor_4"] }),
        G: tileEntry("tile_thunder_floor", "#52616c", { variants: ["tile_thunder_floor", "tile_thunder_floor_2", "tile_thunder_floor_3", "tile_thunder_floor_4"] }),
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
        W: tileEntry("tile_dark_wall", "#242a32", { variants: ["tile_dark_wall", "tile_dark_wall_2", "tile_dark_wall_3", "tile_dark_wall_4"] }),
        T: tileEntry("tile_dark_floor", "#252b36", { variants: ["tile_dark_floor", "tile_dark_floor_2", "tile_dark_floor_3", "tile_dark_floor_4"] }),
        G: tileEntry("tile_dark_floor", "#252b36", { variants: ["tile_dark_floor", "tile_dark_floor_2", "tile_dark_floor_3", "tile_dark_floor_4"] }),
        S: tileEntry("tile_dark_floor", "#d7b45a"),
        D: tileEntry("stairs_dungeon", "#d7b45a"),
        U: tileEntry("stairs_dungeon", "#d7b45a"),
        C: tileEntry("chest_dungeon", "#9c6332"),
        R: tileEntry("chest_rare_dungeon", "#b6324b"),
        B: tileEntry("boss_dungeon", "#db3b4d")
    },
    CRENA_CAVE: {
        W: tileEntry("tile_crena_water", "#155d7a", { lowerLayer: true, animatedWater: true }),
        T: tileEntry("tile_crena_floor", "#466f7a"),
        G: tileEntry("tile_crena_floor", "#527f89"),
        S: tileEntry("tile_crena_floor", "#d7b45a")
    },
    SEABED_TEMPLE: {
        W: tileEntry("tile_water_canal", "#155d7a", { lowerLayer: true, animatedWater: true }),
        T: tileEntry("tile_seabed_floor", "#347b82", { variants: ["tile_seabed_floor", "tile_seabed_floor_2", "tile_seabed_floor_3", "tile_seabed_floor_4"] }),
        G: tileEntry("tile_seabed_floor", "#3f8e91", { variants: ["tile_seabed_floor", "tile_seabed_floor_2", "tile_seabed_floor_3", "tile_seabed_floor_4"] }),
        S: tileEntry("tile_seabed_floor", "#d7b45a")
    },
    DARK_SHRINE_RUINS: {
        W: tileEntry("tile_dark_shrine_wall", "#34303f", { variants: ["tile_dark_shrine_wall", "tile_dark_shrine_wall_2", "tile_dark_shrine_wall_3", "tile_dark_shrine_wall_4"] }),
        T: tileEntry("tile_dark_shrine_floor", "#665f68", { variants: ["tile_dark_shrine_floor", "tile_dark_shrine_floor_2", "tile_dark_shrine_floor_3", "tile_dark_shrine_floor_4"] }),
        G: tileEntry("tile_dark_shrine_floor", "#736b72", { variants: ["tile_dark_shrine_floor", "tile_dark_shrine_floor_2", "tile_dark_shrine_floor_3", "tile_dark_shrine_floor_4"] }),
        S: tileEntry("tile_dark_shrine_floor", "#d7b45a")
    },
    GREZELIA_CAVE: {
        W: tileEntry("tile_grezelia_wall", "#211d25", { variants: ["tile_grezelia_wall", "tile_grezelia_wall_2", "tile_grezelia_wall_3", "tile_grezelia_wall_4"] }),
        T: tileEntry("tile_grezelia_floor", "#39303a", { variants: ["tile_grezelia_floor", "tile_grezelia_floor_2", "tile_grezelia_floor_3", "tile_grezelia_floor_4"] }),
        G: tileEntry("tile_grezelia_floor", "#443643", { variants: ["tile_grezelia_floor", "tile_grezelia_floor_2", "tile_grezelia_floor_3", "tile_grezelia_floor_4"] }),
        S: tileEntry("tile_grezelia_floor", "#d7b45a")
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
        SEABED_TEMPLE: { name: "海底神殿", rank: 35, centerX: 68, centerY: 15, fieldTile: tileEntry("overlay_field_temple", "#5bd6ff"), entryRequiredFlag: "seabedTempleRouteOpened", entryBypassFlags: ["waterCityCleared"], entryLockedText: "海底神殿へ続く水路は、重い水圧に閉ざされている。青の結晶が必要だ。" },
        BIG_TOWER: { name: "大灯台", rank: 30, centerX: 21, centerY: 79, fieldTile: tileEntry("overlay_field_lighthouse", "#f2e7aa") },
        THUNDER_FORT: { name: "雷の要塞", rank: 40, centerX: 45, centerY: 36, fieldTile: tileEntry("overlay_field_fortress", "#f4d84a"), entrances: [
            { x: 45, y: 36, entryKey: "west", label: "西門" },
            { x: 47, y: 36, entryKey: "east", label: "東門" }
        ] },
        LIGHT_PALACE: { name: "光の宮殿", rank: 50, centerX: 67, centerY: 48, fieldTile: tileEntry("overlay_field_temple", "#eef0e8") },
        DARK_CASTLE: { name: "魔王城", rank: 60, centerX: 8, centerY: 50, fieldTile: tileEntry("overlay_field_darkcastle", "#db3b4d") },
        ABYSS: { name: "深淵の魔窟", rank: 70, centerX: 51, centerY: 55, fieldTile: tileEntry("overlay_field_lost", "#303541") },
        ABYSS_FIELD: { name: "深淵の魔窟 外縁", rank: 70, centerX: 51, centerY: 55, fieldTile: tileEntry("overlay_field_lost", "#303541") },
        FOREST_WIND_HOLE: { name: "森の風穴", rank: 8, centerX: 79, centerY: 44, fieldTile: tileEntry("overlay_field_cave", "#7fbf7a"), entryRequiredFlag: "windHoleRouteKnown", entryBypassFlags: ["firePrismRestored", "fireVillageCleared"], entryEventId: "forest_wind_hole_entry", entryEventStoryStep: 2, entryLockedText: "森の奥から冷たい風が流れてくる。だが、今は風穴へ向かう理由がない。" },
        CRENA_LIMESTONE_CAVE: { name: "クレナ鍾乳洞", rank: 23, centerX: 74, centerY: 16, fieldTile: tileEntry("overlay_field_cave", "#72c7dd"), entryRequiredFlag: "crenaRouteKnown", entryBypassFlags: ["blueCrystalObtained", "waterCityCleared"], entryEventId: "crena_cave_entry", entryEventStoryStep: 4, entryLockedText: "青い光が洞口の奥で揺れている。今はまだ、鍾乳洞へ入る理由がない。" },
        DARK_SHRINE_RUINS: { name: "闇の神殿跡地", rank: 75, centerX: 37, centerY: 47, fieldTile: tileEntry("overlay_field_ruins", "#6a4e9f") },
        GREZELIA_FORBIDDEN: { name: "禁則地グレゼリア", rank: 85, centerX: 38, centerY: 59, fieldTile: tileEntry("overlay_field_darkcastle", "#6d2534") },
        RUINED_SHRINE: { name: "朽ちた祠", rank: 300, centerX: 58, centerY: 56, fieldTile: tileEntry("overlay_field_ruins", "#8f7dff") },
        MEDAL: { name: "メダル王", rank: 1, centerX: 32, centerY: 18, fieldTile: tileEntry("overlay_field_medal", "#f6ca62") },
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
    { id: "ABYSS_EDGE", name: "深淵外縁", rank: 70, centerX: 51, centerY: 55, radius: 20, priority: 1, monsters: [100064, 100065, 100066, 100067] },
    { id: "TRIAL_ISLAND_FIELD", name: "最果ての祠周辺", rank: 100, centerX: 2, centerY: 2, radius: 10, priority: 2, rareMonsters: [{ id: 200203, rate: 0.05 }] },
    { id: "SUMMIT_TEMPLE_FIELD", name: "頂の神殿周辺", rank: 150, centerX: 89, centerY: 77, radius: 12, priority: 2, rareMonsters: [{ id: 200203, rate: 0.05 }] }
];

const MAP_DATA = ["WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WMMMLWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WMGTTWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
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
"WWWWWWWMMMMGGGGGGGGGGGlllllMMMMMMGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGMMMMWWWWWGGGGGFFFFFFFFGGGGMMMMMMMMMWWWWWW",
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
"WWWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGFFFFFFGGGGGGFFGGGGGGGWGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWGGGGGGGGGGGGGFFFFGGGGGWWGGGGGGGGGGWWGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWGGGGGGGGGGGFFFFGGGGGWWWWWGGGGGGGGGWGGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMGMMWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWGGGGGGGGGGGGFFGGGGWWWWWWWWWWGGGGGGGWGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMGGGMWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWGGGGGGGGGGGGGGGGWWWWWWWWWWWWWWWWGGGGWGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMWWWWWWWWWWWWWWWWWWW",
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
    WATER_CITY: { H: "T", V: "T", I: "T", K: "T", E: "T", A: "T", J: "T", P: "G" },
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
            "WWWWWWWWWWWDWWW",
            "WHGHGWWWGGGGWWW",
            "WGGGGWWWWGGGGWW",
            "WGGWWWVWWWWGGGW",
            "WGGWGGGGHGHGGGW",
            "WGGIGGGGGGGGGGS",
            "WGGGGGGGGGGGGGS",
            "WGGGGGGGGWWGGGW",
            "WGHGGGGGGGGGHGW",
            "WGGGGGGGGGGGGGW",
            "WWWWWWSSWWWWWWW",
            "WWWWWWWWWWWWWWW"
        ],
        mapActions: [
            { x: 2, y: 8, label: "道具を買う", log: "道具屋の看板が出ている。", type: "shop", shopType: "item", title: "始まりの村 道具屋", shopRank: 5 },
            { x: 8, y: 4, label: "武器を見る", log: "簡素な武器が並んでいる。", type: "shop", shopType: "weapon", title: "始まりの村 武器屋", shopRank: 5 },
            { x: 10, y: 4, label: "防具を見る", log: "旅支度用の防具が並んでいる。", type: "shop", shopType: "armor", title: "始まりの村 防具屋", shopRank: 5 },
            { x: 11, y: 8, label: "村人と話す", log: "村人が、北東の穴を見つめている。", type: "storyEvent", eventId: "town_start_villager_1", imageKey: "overlay_npc_villager", baseTile: "G" },
            { x: 13, y: 2, label: "村の若者と話す", log: "若者が木剣を握りしめている。", type: "storyEvent", eventId: "town_start_villager_2", imageKey: "overlay_npc_bronze_knight", baseTile: "G" },
            { x: 2, y: 1, label: "薬草摘みと話す", log: "籠を抱えた女性が、葉についた泥を払っている。", type: "storyEvent", eventId: "town_start_villager_3", imageKey: "overlay_npc_villager", baseTile: "G" },
            {
                x: 6, y: 3, label: "長老と話す", log: "長老が旅人を待っている。",
                type: "log", imageKey: "overlay_npc_elder",
                events: [
                    { stepMin: 0, stepMax: 0, eventId: "start_adventure" },
                    { stepMin: 1, stepMax: 1, eventId: "start_adventure2" },
                    { stepMin: 2, stepMax: 2, subMin: 0, subMax: 0, eventId: "start_adventure3" },
                    { default: true, eventId: "start_village_elder_after" }
                ]
            },
            { x: 11, y: 0, label: "洞窟に入る", log: "洞窟の入口だ。", type: "fixedDungeon", target: "START_CAVE" }
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
            "WMMMMMMMMMMMMMDMMMMMMMMMMMMMW",
            "WMMMMMMMMMTTTTTTTTTMMMMMMMMMW",
            "WMMMMTTTTTTTTTTTTTTTTTTTMMMMW",
            "WMMMMTTVTTTTTTTTTTTJTTTTMMMMW",
            "WMMMMTTTTTTTTTTTTTTTTTTTMMMMW",
            "WMMMMTTGGGGGMMMMMGGGGGTTMMMMW",
            "WMMMMTTGGGGGMMMMMGGGGGTTMMMMW",
            "WMMMMTTGGGGGGGGGGGGGGGTTMMMMW",
            "WMMMMTTTTTTTTTTTTTJTTTTTMMMMW",
            "WMMMMTTTGGGGGGGGGGGGGTTTMMMMW",
            "WMMMMTTTGGGGGGGGGGGGGTTTMMMMW",
            "WMMMMTTTGGGGGGGGGGGGGTTTMMMMW",
            "WMMMMTTTTTTTTTTTTTTTTTTTMMMMW",
            "WMMMMTTVTTTTTGGGTTTTTITTMMMMW",
            "WMMMMTTTTTTGGGAGGGTTTTTTMMMMW",
            "WMMMMTTTTTTGGGGGGGTTTTTTMMMMW",
            "WMMMMTTVTTTGGGGGGGTTTVTTMMMMW",
            "WMMMMTTTTTTGGGGGGGTTTTTTMMMMW",
            "WMMMMTTTTTTTTTTTTTTTTTTTMMMMW",
            "WWWWWWWWWWWWWWSSWWWWWWWWWWWWW"
        ],
        mapActions: [
            { x: 21, y: 14, label: "泊まる", log: "熱気をしのげる宿屋がある。", type: "inn" },
            { x: 21, y: 17, label: "道具を買う", log: "火山探索向けの道具屋だ。", type: "shop", shopType: "item", title: "炎の里 道具屋", shopRank: 12 },
            { x: 7, y: 14, label: "武器を見る", log: "鍛冶火が赤く揺れる武器屋だ。", type: "shop", shopType: "weapon", title: "炎の里 武器屋", shopRank: 12 },
            { x: 7, y: 17, label: "防具を見る", log: "火山の熱に耐える防具を扱っている。", type: "shop", shopType: "armor", title: "炎の里 防具屋", shopRank: 12 },
            {
                x: 8, y: 4, label: "鍛冶師と話す", log: "鍛冶師が炉の縁に手を置いている。",
                type: "log", imageKey: "overlay_npc_dark_soldier",
                events: [
                    { requiredFlag: "fireVillageCleared", eventId: "town_fire_villager_1" },
                    { default: true, eventId: "town_fire_villager_1_before" }
                ]
            },
            { x: 18, y: 9, label: "里の人と話す", log: "里の西を気にしているようだ。", type: "storyEvent", eventId: "town_fire_villager_2", imageKey: "overlay_npc_villager" },
            {
                x: 10, y: 13, label: "炭運びと話す", log: "煤だらけの男が、背負い籠を下ろした。",
                type: "log", imageKey: "overlay_npc_dark_soldier",
                events: [
                    { requiredFlag: "fireVillageCleared", eventId: "town_fire_villager_3_after" },
                    { default: true, eventId: "town_fire_villager_3" }
                ]
            },
            { x: 19, y: 4, label: "カリンと話す", log: "女侍が佇んでいる", type: "quest", questId: "karin_volcano_depths", imageKey: "overlay_npc_bronze_knight", lockedText: "カリンはまだ、火山ガスが晴れる時を待っている。" },
            {
                x: 14,
                y: 15,
                label: "里の長に話す",
                log: "里の長が弱まった炎を見つめている。",
                type: "log",
                imageKey: "overlay_npc_elder",
                events: [
                    { stepMin: 2, stepMax: 2, subMin: 1, subMax: 1, eventId: "fire_village_consult" },
                    { stepMin: 0, stepMax: 1, eventId: "fire_village_elder_before_story" },
                    { stepMin: 2, stepMax: 2, subMin: 2, subMax: 2, eventId: "fire_village_elder_during_volcano" },
                    { stepMin: 2, stepMax: 2, subMin: 3, subMax: 3, eventId: "fire_village_holy_water_briefing" },
                    { stepMin: 2, stepMax: 2, subMin: 4, subMax: 6, eventId: "fire_village_elder_during_volcano" },
                    { stepMin: 2, stepMax: 2, subMin: 7, subMax: 7, eventId: "fire_village_report" },
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
                    { stepMin: 2, stepMax: 2, subMin: 2, subMax: 2, eventId: "fire_volcano_entrance" },
                    { stepMin: 2, stepMax: 2, subMin: 3, subMax: 4, eventId: "fire_volcano_waiting_for_holy_water" },
                    { stepMin: 2, stepMax: 2, subMin: 5, subMax: 5, missingFlag: "volcanoCursedFlamesPurified", eventId: "fire_volcano_holy_water_used" }
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
            "WGGGGGGGGGGGGGHGGGGGGGGGGGGGW",
            "WGGTTTTTTTTTTLLLTTTTTTTTTTGGW",
            "WGGTTTTTTTTTTLLLTTTTTTTTTTGGW",
            "WGGTTTTTTTTTTLLLTTTTTTTTTTGGW",
            "WGGJTTVTTVTTTLLLTTTVTTITTTGGW",
            "GLLLLLLLLLLLLLLLLLLLLLLLLLLLS",
            "GLLLLLLLLLLLLLLLLLLLLLLLLLLLS",
            "GLLLLLLLLLLLLLLLLLLLLLLLLLLLS",
            "WGGTTTTTTTTTTLLLTTTTTTTTTTGGW",
            "WGGTTJTTTTTTTLLLTTTTTTJTTTGGW",
            "WGGTTTTTTTTTTLLLTTTTTTTTTTGGW",
            "WGGTTTTTTTTTTLLLTTTTTTTTTTGGW",
            "WGGTTTTTTTTTTLLLTTTATTTTTTGGW",
            "WGGGGGGGGGGGGLLLGGGGGGGGGGGGW",
            "WGGGGGGGGGGGGLLLGGGGGGGGGGGGW",
            "WGGGGGGGGGGGGLLLGGGGGGGGGGGGW",
            "WGGGGGGGGGGGGLLLGGGGGGGGGGGGW",
            "WWWWWWWWWWWWWSSSWWWWWWWWWWWWW"
        ],
        mapActions: [
            { x: 22, y: 7, label: "泊まる", log: "風よけの宿屋がある。", type: "inn" },
            { x: 19, y: 7, label: "道具を買う", log: "森歩きに備えた道具屋だ。", type: "shop", shopType: "item", title: "風の集落 道具屋", shopRank: 22 },
            { x: 6, y: 7, label: "武器を見る", log: "軽く扱いやすい武器が並んでいる。", type: "shop", shopType: "weapon", title: "風の集落 武器屋", shopRank: 22 },
            { x: 9, y: 7, label: "防具を見る", log: "森の魔物に備えた防具屋だ。", type: "shop", shopType: "armor", title: "風の集落 防具屋", shopRank: 22 },
            {
                x: 3, y: 7, label: "見張りと話す", log: "見張りが枝の揺れを追っている。",
                type: "log", imageKey: "overlay_npc_bronze_knight",
                events: [
                    { requiredFlag: "windVillageCleared", eventId: "town_wind_villager_1" },
                    { default: true, eventId: "town_wind_villager_1_before" }
                ]
            },
            {
                x: 22, y: 12, label: "集落の子と話す", log: "子どもが小さな風鈴を握っている。",
                type: "log", imageKey: "overlay_npc_child",
                events: [
                    { requiredFlag: "windVillageCleared", eventId: "town_wind_villager_2_after" },
                    { default: true, eventId: "town_wind_villager_2" }
                ]
            },
            { x: 10, y: 12, label: "風織り職人と話す", log: "職人が、風を含んだ薄布を指で弾いている。", type: "storyEvent", eventId: "town_wind_villager_3", imageKey: "overlay_npc_villager" },
            { x: 5, y: 12, label: "村人から話を聞く", log: "村人が禁忌の森の方を見つめている。", type: "quest", questId: "arisa_haine_forest_depths", imageKey: "overlay_npc_villager", lockedText: "今はまだ、禁忌の森の奥へ進むには危険が大きい。" },
            {
                x: 19,
                y: 15,
                label: "エリーゼに話す",
                log: "子どもたちが不安そうに身を寄せ合っている。",
                type: "log",
                imageKey: "overlay_npc_child",
                events: [
                    { stepMin: 3, stepMax: 3, subMin: 0, subMax: 0, eventId: "wind_village_intro" },
                    { stepMin: 0, stepMax: 2, eventId: "wind_village_before_story" },
                    { stepMin: 3, stepMax: 3, subMin: 1, subMax: 2, eventId: "wind_village_elise_during" },
                    { stepMin: 4, stepMax: 99, eventId: "wind_village_after_clear" },
                    { default: true, eventId: "wind_village_before_story" }
                ]
            },
            {
                x: 0,
                y: 8,
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
            },
            {
                x: 0,
                y: 9,
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
            },
            {
                x: 0,
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
            "WWWWTTTTTTTTWWWTTTTTTTTTWWWTTTTTTTWWWWW",
            "WWWTTHTTTHTTWWTTTTTHTTTTTWWTTTTHTTTTWWW",
            "WWWTTTTTTTTTWWTTTTTTTTTTTWWTTTTTTTTTWWW",
            "WWWTTTTTTTTTLLTTTTTTTTTTTLLTTTTTTJTTWWW",
            "WWWTTJTTTTTTWWTTTTTTTTTTTWWTTTTTTTTTWWW",
            "WWWTTTTTTTTWWWTTTTTTTTTTTWWTTHTTTTTTWWW",
            "WWWWWWWWWWWWWWTTTJTTTTTTTWWWTTTTTTTTWWW",
            "WWWWWWWWWWWWWWTTTTWWWTTTTWWWWTTTTHTTWWW",
            "WWWTHTTHTTHTTITTTWWWWWTTTTTWWWTJTTTTWWW",
            "WWWTTTTTTTTTTTTTTWWWWWTTTTTWWWWWWWWWWWW",
            "WWWTTTTTTTTTTTTTTTWWWTTTTTTWWWWWWWWWWWW",
            "WWWTTTTTTTTTTTTTTTTTTTTTTTTWWTTTTTTTWWW",
            "SLLTTTTTTTTTTJTTTTTTTTTTTTTWWTTTTTTTWWW",
            "SLLTTTTTTTTTTTTTTTTTTTTTTTTLLTTTJTTTWWW",
            "WWWTTTTTTTTTTTTTTTTTTTTTTTTWWTTTTTTTWWW",
            "WWWTTTTTTTTTTTTTTTTTTTTTTTTWWTTTTTTTWWW",
            "WWWWWWWWWWWWWWWWWWLLLWWWWWWWWTTTTTTTWWW",
            "WWWWWWWWWWWWWWWWWWLLLWWWWWWWWTTTTTTTWWW",
            "WWWWWWWTJTTTTTTTTTTTTTTTTTTWWTTTTTTTWWW",
            "WWWWLLLTTTTTTTTTTTTTTTTTTTTWWJTTTTHTWWW",
            "WWWWWWWTTTTTTTTTTTTTTTTTTTTWWTTTTTTTWWW",
            "WWWWWWWWWWWWWWWWWWWLWWWWWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWWWWWLWWWWWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWWWWWLWWWWWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWWWWWSWWWWWWWWWWWWWWWWWWW"
        ],
        mapActions: [
            { x: 4, y:10, label: "道具を買う", log: "水路沿いの道具屋だ。", type: "shop", shopType: "item", title: "水上都市 道具屋", shopRank: 35 },
            { x: 7, y: 10, label: "武器を見る", log: "海底神殿に備えた武器を扱っている。", type: "shop", shopType: "weapon", title: "水上都市 武器屋", shopRank: 35 },
            { x: 10, y: 10, label: "防具を見る", log: "水と闇に強い防具を扱っている。", type: "shop", shopType: "armor", title: "水上都市 防具屋", shopRank: 35 },
            {
                x: 14, y: 5, label: "兵士と話す", log: "黒鎧の兵士が橋を塞いでいる。",
                type: "storyEvent", eventId: "water_city_blockade_guard", imageKey: "overlay_npc_dark_soldier",
                missingFlag: "waterCityCleared", baseTile: "T"
            },
            {
                x: 24, y: 5, label: "兵士と話す", log: "黒鎧の兵士が橋を塞いでいる。",
                type: "storyEvent", eventId: "water_city_blockade_guard", imageKey: "overlay_npc_dark_soldier",
                missingFlag: "waterCityCleared", baseTile: "T"
            },
            {
                x: 26, y: 15, label: "兵士と話す", log: "黒鎧の兵士が橋を塞いでいる。",
                type: "storyEvent", eventId: "water_city_blockade_guard", imageKey: "overlay_npc_dark_soldier",
                missingFlag: "waterCityCleared", baseTile: "T"
            },
            {
                x: 17, y: 8, label: "老人と話す", log: "老人が雷の要塞の方角を眺めている。",
                type: "log", imageKey: "overlay_npc_elder",
                events: [
                    { requiredFlag: "thunderFortCleared", eventId: "town_water_villager_1" },
                    { default: true, eventId: "town_water_villager_1_before" }
                ]
            },
            {
                x: 32, y: 13, label: "船大工と話す", log: "船大工が水路の流れを測っている。",
                type: "log", imageKey: "overlay_npc_villager",
                events: [
                    { requiredFlag: "waterCityCleared", eventId: "town_water_villager_2_after" },
                    { default: true, eventId: "town_water_villager_2" }
                ]
            },
            { x: 13, y: 14, label: "元兵士と話す", log: "元兵士が古い盾の傷を磨いている。", type: "storyEvent", eventId: "town_water_villager_3", imageKey: "overlay_npc_bronze_knight" },
            {
                x: 24, y: 20, label: "渡し守と話す", log: "渡し守が、濡れた綱の結び目を確かめている。",
                type: "log", imageKey: "overlay_npc_villager",
                events: [
                    { requiredFlag: "waterCityCleared", eventId: "town_water_villager_4_after" },
                    { default: true, eventId: "town_water_villager_4" }
                ]
            },
            {
                x: 19,
                y: 13,
                label: "広場を調べる",
                log: "濁った水路の音が、街の沈黙に混じっている。",
                type: "log",
                imageKey: "overlay_npc_dark_soldier",
                imageMissingFlag: "waterCityCleared",
                baseTile: "T",
                events: [
                    { stepMin: 4, stepMax: 4, subMin: 0, subMax: 0, eventId: "water_city_intro" },
                    { stepMin: 0, stepMax: 3, eventId: "water_city_before_story" },
                    { stepMin: 4, stepMax: 4, subMin: 1, subMax: 1, eventId: "water_city_cave_reminder" },
                    { stepMin: 4, stepMax: 4, subMin: 2, subMax: 2, eventId: "water_city_blue_crystal_report" },
                    { stepMin: 4, stepMax: 4, subMin: 3, subMax: 99, eventId: "water_city_sophia_after_meeting" },
                    { stepMin: 5, stepMax: 99, eventId: "water_city_after_clear" },
                    { default: true, eventId: "water_city_before_story" }
                ]
            },
            { x: 8, y: 20, label: "マリーと話す", log: "白いローブの女性が、避難民の無事を祈っている。", type: "quest", questId: "marie_water_city", imageKey: "overlay_npc_villager", lockedText: "マリーはまだ街の混乱を鎮めることで手一杯のようだ。" },
            { x: 29, y: 21, label: "ハヤテと話す", log: "水路のそばに、落ち着きなく周囲を見渡す若者がいる。", type: "quest", questId: "hayate_water_city", imageKey: "overlay_npc_bronze_knight", lockedText: "ハヤテはまだ、信頼できる案内人を待っているようだ。" },
            { x: 31, y: 10, label: "シルビアと話す", log: "優雅な身なりの貴人が、護衛を探している。", type: "quest", questId: "sylvia_water_city", imageKey: "overlay_npc_villager", lockedText: "シルビアはまだ、声をかける相手を見定めている。" },
            { x: 32, y: 15, label: "ソフィア達と話す", log: "ソフィアとアランが、神殿奥の水流について話し込んでいる。", type: "quest", questId: "sophia_alan_seabed_depths", imageKey: "overlay_npc_bronze_knight", lockedText: "今はまだ、海底神殿の奥へ進む手段がない。" }
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
            {
                x: 8, y: 7, label: "魔窟に入る", log: "闇がどこまでも続いているような穴がある。",
                type: "abyssDungeon",
                events: [
                    { stepMin: 9, stepMax: 9, missingFlag: "abyssOuterReached", eventId: "abyss_unsealed" }
                ]
            }
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

const normalizeCoordinateActorTiles = (mapDefs) => {
    Object.values(mapDefs || {}).forEach(mapDef => {
        const targets = Array.isArray(mapDef.floors) ? mapDef.floors : [mapDef];
        targets.forEach(target => {
            if (!Array.isArray(target?.tiles) || !Array.isArray(target?.mapActions)) return;
            const rows = target.tiles.map(row => String(row).split(""));
            target.mapActions.forEach(action => {
                if (!action?.imageKey) return;
                const x = Number(action.x);
                const y = Number(action.y);
                if (!Number.isInteger(x) || !Number.isInteger(y) || !rows[y]?.[x]) return;
                rows[y][x] = action.baseTile || (rows[y][x] === "G" ? "G" : "T");
            });
            target.tiles = rows.map(row => row.join(""));
        });
    });
};

// 住人やクエスト人物はmapActionsの座標・画像を正本とし、地形文字へNPC記号を残さない。
normalizeCoordinateActorTiles(FIXED_MAPS);

const FIXED_DUNGEON_MAPS = {
    START_CAVE: {
        name: "北東の洞穴",
        themeKey: "START_CAVE",
        rank: 5,
        encounterRank: 5, // monsters未指定時はこの階層相当で自動抽選
        tileOverrides: {
            // 固定ダンジョンのC/R/B/D/U/Sは床にオーバーレイ描画されます。
            // T: tileEntry("dungeon_floor", "#3c4151"), // 細い洞窟道
            // G: tileEntry("dungeon_floor", "#3c4151"), // 洞窟の広間
            // W: tileEntry("wall", "#303541"), // 岩壁
        },
        width: 31,
        height: 23,
        entryPoint: { x: 15, y: 21 },
        battleBg: "battle_bg_dungeon",
        tiles: [
            "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
            "WWWWWTWWWWWWWWWWWTTTTTTWWWWWWWW",
            "WWWTTBTTWWWWWWWTTTTTTTTTTWWWWWW",
            "WWTTTTTWWTTTTTTTTWWWWWWTTWWCTWW",
            "WWWTTTTWWWTTTTTTWWWWWTTTWWTTTWW",
            "WWWWTTTTTTTTTTTWWWWWTTWWWTTTTWW",
            "WWWWWTTTWWWTTTTWWWWWTTTTWWTTWWW",
            "WWWWWTTTTTWWTTWWWWWWWTTWWWTTWWW",
            "WWWWWWTTCWWWWWWWWWWWTTWWTTTTWWW",
            "WWWWWWWWWWWWWWWWWWWTTTTTTTTTTWW",
            "WWWWWWWWWWTTTTTWWWWTTTTTTWWTTWW",
            "WWWWWWWWWWWTTTTTTWWWTTTWWWWWTWW",
            "WWWWWTWWTTTTWWTTTTWWTTTWWTWWTWW",
            "WWWTTTWTTTTTWWTTTTTTTTWWWTTTTWW",
            "WWTCTTTTTTWWWTTTTTTTTWWWTCTTTTW",
            "WWWTTTTTTWWWTTTTTTTTWWWWTTTTTWW",
            "WWWWWTWWWWWWWWWWWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWVWWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWTTTTTTTWWWWWWWWWWWW",
            "WWWWWWWWWWWTTTTTTTTTWWWWWWWWWWW",
            "WWWWWWWWWWWWTTTTTTTWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWSSSWWWWWWWWWWWWWW",
            "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
        ],
        chests: [
            { x: 27, y: 3, itemId: 106, type: "item" },
            { x: 3, y: 14, itemId: 1, type: "item" },
            { x: 25, y: 14, itemId: 3, type: "item" },
            { x: 8, y: 8, itemId: 99, type: "item" }
        ],
        monsters: [100001, 100002, 100003, 100004],
        mapActions: [
            {
                x: 15, y: 17, label: "見張りと話す", log: "見張りが洞穴の封鎖を守っている。",
                type: "log", imageKey: "overlay_npc_bronze_knight", hideWhenNoEvent: true,
                events: [
                    { stepMin: 0, stepMax: 0, eventId: "start_cave1" },
                    { stepMin: 1, stepMax: 1, subMin: 1, subMax: 1, eventId: "start_cave2" }
                ]
            }
        ],
        bosses: [{
            x: 5,
            y: 2,
            monsterId: 301000,
            storyStepMin: 1,
            storyStepMax: 1,
            storyEventId: "start_boss_clear",
            actionLabel: "巨大な化け物に挑む",
            challengeText: "巨大な化け物が洞穴の奥を塞いでいる。\n覚悟を決めて挑みますか？"
        }]
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
                    "WWWWWWWWWWDWWWWWWWWWW",
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
                    },
                    {
                        "x": 10,
                        "y": 3,
                        "toFloor": 4,
                        "targetX": 14,
                        "targetY": 22,
                        "label": "火山深部へ",
                        "requiredFlag": "windVillageCleared",
                        "lockedLabel": "淀んだ空気を調べる",
                        "lockedLog": "火山ガスが淀み、今は進めない。"
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
                        "clearedFlag": "firePrismRestored",
                        "actionLabel": "兵士に声をかける"
                    }
                ],
                entryPoint: {
                    "x": 10,
                    "y": 17
                }
            },
            {
                label: "火山深部・風穴熱脈",
                encounterRank: 40,
                monsters: [100010, 100011, 100012, 100013],
                enemyBoost: { nameSuffix: "強", statMultiplier: 1.5, elmRes: { "火": 100, "風": 50, "水": -50 }, elmAtk: { "火": 20 } },
                width: 29,
                height: 25,
                tiles: buildAuthoredLayout(29, 25, {
                    rooms: [[11, 20, 7, 4], [2, 16, 7, 6], [20, 16, 7, 6], [3, 8, 8, 6], [18, 8, 8, 6], [10, 2, 9, 7], [12, 10, 5, 4], [2, 2, 6, 5], [21, 2, 6, 5]],
                    paths: [
                        [[14, 22], [6, 19], [6, 11], [14, 5]],
                        [[14, 22], [23, 19], [22, 11], [14, 5]],
                        [[6, 11], [14, 12], [22, 11]],
                        [[6, 11], [5, 4], [14, 5]],
                        [[22, 11], [24, 4], [14, 5]]
                    ],
                    marks: [[14, 22, "U"], [14, 4, "B"], [5, 4, "C"], [24, 4, "R"], [4, 18, "C"], [24, 18, "R"], [14, 12, "P"]]
                }),
                floorLinks: [
                    { x: 14, y: 22, toFloor: 3, targetX: 10, targetY: 4, label: "火の祭壇へ戻る" }
                ],
                tileEffects: [
                    { x: 6, y: 11, type: "poison", damageRate: 0.08, message: "濃い火山ガスを吸った！" },
                    { x: 22, y: 11, type: "poison", damageRate: 0.06, message: "黒曜石の裂け目から熱風が噴いた！" },
                    { x: 22, y: 11, type: "warp", toX: 6, toY: 19, message: "熱脈の噴気で下層へ飛ばされた。" },
                    { x: 6, y: 19, type: "warp", toX: 22, toY: 11, message: "上昇気流が岩棚へ運んだ。" },
                    { x: 23, y: 19, type: "hunter", id: "volcano_deep_flame", imageKey: "overlay_dungeon_hunter_fire", monsterIds: [301010, 100013, 100014], speed: 0.5, range: 24, statMultiplier: 1.9, message: "炎を纏う強敵が迫る！" }
                ],
                bosses: [
                    { x: 14, y: 4, monsterId: 301010, questId: "karin_volcano_depths", storyEventId: "quest_karin_volcano_clear", actionLabel: "火山深部の試練に挑む", inspectLog: "守る剣を試す炎が揺れている。" }
                ],
                chests: [
                    { x: 5, y: 4, itemId: 3, type: "item" },
                    { x: 24, y: 4, itemId: 105, type: "item", rare: true },
                    { x: 4, y: 18, itemId: 5, type: "item" },
                    { x: 24, y: 18, itemId: 106, type: "item", rare: true }
                ],
                mapActions: [
                    { x: 14, y: 12, label: "熱脈を確かめる", log: "足元の黒曜石に、鍛冶場の炉より深い赤が脈打っている。", type: "log", imageKey: "overlay_dungeon_event" }
                ],
                healSprings: [{ x: 14, y: 12 }],
                entryPoint: { x: 14, y: 22 }
            }
        ]
    },
    FORBIDDEN_FOREST: {
        name: "禁忌の森",
        themeKey: "FORBIDDEN_FOREST",
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
                tileEffects: [
                    { x: 36, y: 20, type: "poison", damageRate: 0.04, message: "毒霧が足元を這った。" },
                    { x: 5, y: 9, type: "warp", toX: 45, toY: 21, message: "黒い風に道を逸らされた。" }
                ],
                mapActions: [
                    { x: 42, y: 16, label: "古い結界跡を見る", log: "苔むした杭に、風除けの古い印が残っている。", type: "log", imageKey: "overlay_dungeon_event" }
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
                    "WWWWWWWWWWWWWWGGTTTTTTTTTGGDWWWWWWWWWWWWW",
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
                    },
                    {
                        x: 27,
                        y: 6,
                        toFloor: 3,
                        targetX: 14,
                        targetY: 22,
                        label: "森の深部へ",
                        requiredFlag: "waterCityCleared",
                        lockedLabel: "汚染された森を調べる",
                        lockedLog: "毒と呪いが濃く、今は進めない。"
                    }
                ],
                chests: [
                    { x: 5, y: 15, itemId: 106, type: "item", rare: true },
                    { x: 34, y: 20, itemId: 4, type: "item" }
                ],
                tileEffects: [
                    { x: 20, y: 10, type: "poison", damageRate: 0.05, message: "祈りの広場に残る瘴気が肌を刺す。" }
                ],
                mapActions: [
                    { x: 23, y: 6, label: "朽ちた石碑を読む", log: "石碑には、森の風を鎮めた名もなき守人の印が刻まれている。", type: "log", imageKey: "overlay_dungeon_event" }
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
            },
            {
                label: "禁忌の森深部・呪風の根",
                encounterRank: 55,
                monsters: [100020, 100021, 100022, 100023, 100024],
                enemyBoost: { nameSuffix: "強", statMultiplier: 1.5, elmRes: { "風": 100, "雷": 50, "火": -50 }, elmAtk: { "風": 20 } },
                width: 31,
                height: 25,
                tiles: buildAuthoredLayout(31, 25, {
                    rooms: [[12, 20, 7, 4], [2, 16, 8, 6], [21, 16, 8, 6], [3, 8, 8, 6], [20, 7, 8, 7], [11, 2, 9, 7], [12, 11, 7, 4], [2, 2, 6, 5], [23, 2, 6, 5]],
                    paths: [
                        [[15, 22], [6, 19], [6, 11], [15, 5]],
                        [[15, 22], [25, 19], [24, 10], [15, 5]],
                        [[6, 11], [15, 13], [24, 10]],
                        [[6, 11], [5, 4], [15, 5]],
                        [[24, 10], [26, 4], [15, 5]]
                    ],
                    marks: [[15, 22, "U"], [15, 4, "B"], [5, 4, "C"], [26, 4, "R"], [4, 18, "C"], [26, 18, "R"], [15, 13, "P"]]
                }),
                floorLinks: [
                    { x: 15, y: 22, toFloor: 2, targetX: 20, targetY: 9, label: "祈りの広場へ戻る" }
                ],
                tileEffects: [
                    { x: 6, y: 11, type: "poison", damageRate: 0.07, message: "呪毒の霧に触れた！" },
                    { x: 24, y: 10, type: "ice", maxSlide: 24, message: "濡れた根を滑った。" },
                    { x: 5, y: 4, type: "poison", damageRate: 0.05, message: "古い結界跡から黒い風が漏れた。" },
                    { x: 6, y: 19, type: "warp", toX: 25, toY: 19, message: "絡み合う根が道を反転させた。" },
                    { x: 25, y: 19, type: "hunter", id: "forest_deep_curse", imageKey: "overlay_dungeon_hunter_forest", monsterIds: [301012, 100023, 100024], speed: 0.5, range: 26, statMultiplier: 1.9, message: "呪風の魔物が迫る！" }
                ],
                bosses: [
                    { x: 15, y: 4, monsterId: [301011, 301012], questId: "arisa_haine_forest_depths", startEventId: "quest_arisa_haine_encounter", storyEventId: "quest_arisa_haine_clear", actionLabel: "アリサとハイネに加勢する", inspectLog: "森の奥で、刀の音と叫び声が聞こえる。" }
                ],
                chests: [
                    { x: 5, y: 4, itemId: 4, type: "item" },
                    { x: 26, y: 4, itemId: 105, type: "item", rare: true },
                    { x: 4, y: 18, itemId: 4, type: "item" },
                    { x: 26, y: 18, itemId: 106, type: "item", rare: true }
                ],
                mapActions: [
                    { x: 15, y: 13, label: "風の途切れを調べる", log: "巨大樹の根元だけ、風の音が不自然に途切れている。", type: "log", imageKey: "overlay_dungeon_event" }
                ],
                healSprings: [{ x: 15, y: 13 }],
                entryPoint: { x: 15, y: 22 }
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
        themeKey: "SEABED_TEMPLE",
        rank: 35,
        encounterRank: 35,
        rareMonsters: [{ id: 200201, rate: 0.05 }],
        battleBg: "battle_bg_seabed",
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
                    "WWWWWWWWWWWDWWWWWWWWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
                    "WWWWWWWWWWWTWWWWWWWWWWW",
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
                    },
                    {
                        "x": 11,
                        "y": 2,
                        "toFloor": 4,
                        "targetX": 14,
                        "targetY": 22,
                        "label": "水流の奥へ",
                        "requiredFlag": "thunderFortCleared",
                        "lockedLabel": "激流を調べる",
                        "lockedLog": "激しい水流で進めない。"
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
            },
            {
                label: "海底神殿深部・逆潮路",
                encounterRank: 65,
                monsters: [100033, 100034, 301021],
                enemyBoost: { nameSuffix: "強", statMultiplier: 1.3, elmRes: { "水": 100, "火": 50, "雷": -50 }, elmAtk: { "水": 20 } },
                rareMonsters: [{ id: 200201, rate: 0.05 }],
                width: 29,
                height: 25,
                tiles: buildAuthoredLayout(29, 25, {
                    rooms: [[11, 20, 7, 4], [2, 16, 7, 6], [20, 16, 7, 6], [2, 8, 8, 6], [19, 8, 8, 6], [10, 2, 9, 7], [11, 11, 7, 4], [2, 2, 6, 5], [21, 2, 6, 5]],
                    paths: [
                        [[14, 22], [6, 19], [6, 11], [14, 5]],
                        [[14, 22], [23, 19], [23, 11], [14, 5]],
                        [[6, 11], [14, 13], [23, 11]],
                        [[6, 11], [5, 4], [14, 5]],
                        [[23, 11], [24, 4], [14, 5]]
                    ],
                    marks: [[14, 22, "U"], [14, 4, "B"], [5, 4, "C"], [24, 4, "R"], [4, 18, "C"], [24, 18, "R"], [14, 13, "P"]]
                }),
                floorLinks: [
                    { x: 14, y: 22, toFloor: 3, targetX: 11, targetY: 5, label: "祈祷の間へ戻る" }
                ],
                tileEffects: [
                    { x: 6, y: 11, type: "ice", maxSlide: 24, message: "逆潮に押し流された。" },
                    { x: 23, y: 11, type: "warp", toX: 6, toY: 19, message: "渦潮に巻かれた。" },
                    { x: 6, y: 19, type: "warp", toX: 23, toY: 11, message: "水鏡が反対岸へつながった。" },
                    { x: 23, y: 19, type: "hunter", id: "seabed_current", imageKey: "overlay_dungeon_hunter_sea", monsterIds: [301021, 301022, 100034], speed: 0.5, range: 24, statMultiplier: 1.8, message: "逆潮の番人が迫る！" }
                ],
                bosses: [
                    { x: 14, y: 4, monsterId: [301022, 301021], questId: "sophia_alan_seabed_depths", storyEventId: "quest_sophia_alan_clear", actionLabel: "神殿深部を鎮める", inspectLog: "ソフィアとアランが逆潮の核を睨んでいる。" }
                ],
                chests: [
                    { x: 5, y: 4, itemId: 4, type: "item" },
                    { x: 24, y: 4, itemId: 105, type: "item", rare: true },
                    { x: 4, y: 18, itemId: 5, type: "item" },
                    { x: 24, y: 18, itemId: 106, type: "item", rare: true }
                ],
                mapActions: [
                    { x: 14, y: 13, label: "水圧の揺らぎを見る", log: "青い泡が柱の影をゆっくり歪ませている。", type: "log", imageKey: "overlay_dungeon_event" }
                ],
                healSprings: [{ x: 14, y: 13 }],
                entryPoint: { x: 14, y: 22 }
            }
        ]
    },
    "BIG_TOWER": {
        "name": "大灯台",
        "themeKey": "BIG_TOWER",
        "rank": 30,
        "encounterRank": 30,
        "battleBg": "battle_bg_big_tower",
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
                "rareMonsters": [{ "id": 200201, "rate": 0.05 }],
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
                "mapActions": [
                    { "x": 4, "y": 18, "label": "ゼリードと話す", "log": "ゼリードが、頂上に残る歪みを見上げている。", "type": "quest", "questId": "zelied_big_tower", "imageKey": "npc_mage", "lockedText": "ゼリードはまだ、灯台の異変を見極めているようだ。" }
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
                "rareMonsters": [{ "id": 200201, "rate": 0.05 }],
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
                "rareMonsters": [{ "id": 200201, "rate": 0.05 }],
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
                "rareMonsters": [{ "id": 200201, "rate": 0.05 }],
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
                "rareMonsters": [{ "id": 200202, "rate": 0.05 }],
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
                "rareMonsters": [{ "id": 200202, "rate": 0.05 }],
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
                "rareMonsters": [{ "id": 200202, "rate": 0.05 }],
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
                    "WWWWTTTTTTBTTTTTTWWWW",
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
                    },
                    {
                        "x": 10,
                        "y": 8,
                        "monsterId": [
                            301060,
                            301062
                        ],
                        "questId": "zelied_big_tower",
                        "inactiveTile": "G",
                        "bossStatMultiplier": 1.25,
                        "actionLabel": "灯火の残響に挑む",
                        "challengeText": "砕けた結界から、二つの影が滲み出す。\n灯火の残響に挑みますか？"
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
        "battleBg": "battle_bg_thunder_fort",
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
                "rareMonsters": [{ "id": 200201, "rate": 0.05 }],
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
                    "WWWWWWWWWWTTTTTDTTTTTWWWWWWWWWW",
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
                "mapActions": [
                    { "x": 14, "y": 21, "label": "リンと話す", "log": "リンが、雷鳴の奥に残る魔物の気配を追っている。", "type": "quest", "questId": "rin_thunder_fort", "complete": true, "lockedText": "リンはまだ、光を導く者の到着を待っている。" },
                    { "x": 18, "y": 21, "label": "フリーダ達と話す", "log": "フリーダとバロンが、高圧電流の先を見据えている。", "type": "quest", "questId": "frieda_baron_thunder_depths", "lockedText": "今はまだ、要塞深部の電流を越える加護が足りない。" },
                    { "x": 12, "y": 21, "label": "補給品を買う", "log": "解放された要塞に補給隊が入っている。", "type": "shop", "shopType": "item", "title": "雷の要塞 補給所", "shopRank": 45, "requiredFlag": "thunderFortCleared", "lockedText": "まだ補給隊は入れないようだ。" },
                    { "x": 16, "y": 21, "label": "武器を見る", "log": "押収された武器が整備されている。", "type": "shop", "shopType": "weapon", "title": "雷の要塞 武器庫", "shopRank": 45, "requiredFlag": "thunderFortCleared", "lockedText": "武器庫は封鎖されている。" },
                    { "x": 17, "y": 21, "label": "防具を見る", "log": "雷対策の防具が並び始めている。", "type": "shop", "shopType": "armor", "title": "雷の要塞 防具庫", "shopRank": 45, "requiredFlag": "thunderFortCleared", "lockedText": "防具庫は封鎖されている。" },
                    { "x": 15, "y": 20, "label": "休む", "log": "兵舎の一角が休憩所になっている。", "type": "inn", "requiredFlag": "thunderFortCleared", "lockedText": "まだ休める状況ではない。" },
                    { "x": 15, "y": 18, "label": "解放兵と話す", "log": "解放された兵が深く息を吐いている。", "type": "storyEvent", "eventId": "post_thunder_fort_base_1", "requiredFlag": "thunderFortCleared", "lockedText": "雷の轟きで声が届かない。" }
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
                "rareMonsters": [{ "id": 200201, "rate": 0.05 }],
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
                "rareMonsters": [{ "id": 200201, "rate": 0.05 }],
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
                    "WWTTTTTTTWWWWWWWWWWWWWWWWWWWWWW",
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
                "rareMonsters": [{ "id": 200201, "rate": 0.05 }],
                "width": 31,
                "height": 25,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWDWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWTTTTTTTTTTTWWWWWWWWWW",
                    "WWWWWWWWWWTTTTTTTTTTTWWWWWWWWWW",
                    "WWWWWWWWWWTTTTTTTTTTTWWWWWWWWWW",
                    "WWWWWWWWWWTTTTTTTTTTTWWWWWWWWWW",
                    "WWWWWWWWWWWWWWTBTWWWWWWWWWWWWWW",
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
                    },
                    {
                        "x": 15,
                        "y": 1,
                        "toFloor": 5,
                        "targetX": 15,
                        "targetY": 22,
                        "label": "高圧区画へ",
                        "requiredFlag": "lightPalaceCleared",
                        "lockedLabel": "高圧電流を調べる",
                        "lockedLog": "高圧電流が迸り、今は進めない。"
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
                        "y": 6,
                        "monsterId": 301040,
                        "startEventId": "thunder_leonard_encounter",
                        "storyEventId": "thunder_fort_clear",
                        "actionLabel": "レナードと対峙する"
                    }
                ]
            },
            {
                "label": "雷の要塞深部・高圧区画",
                "encounterRank": 70,
                "monsters": [100040, 100041, 100042, 100043],
                "enemyBoost": { "nameSuffix": "強", "statMultiplier": 1.3, "elmRes": { "雷": 100, "水": 50, "風": -50 }, "elmAtk": { "雷": 20 } },
                "rareMonsters": [{ "id": 200201, "rate": 0.05 }],
                "width": 31,
                "height": 25,
                "tiles": buildAuthoredLayout(31, 25, {
                    rooms: [[12, 20, 7, 4], [2, 16, 8, 6], [21, 16, 8, 6], [3, 8, 8, 6], [20, 8, 8, 6], [11, 2, 9, 7], [12, 11, 7, 4], [2, 2, 6, 5], [23, 2, 6, 5]],
                    paths: [
                        [[15, 22], [6, 19], [6, 11], [15, 5]],
                        [[15, 22], [25, 19], [24, 11], [15, 5]],
                        [[6, 11], [15, 13], [24, 11]],
                        [[6, 11], [5, 4], [15, 5]],
                        [[24, 11], [26, 4], [15, 5]]
                    ],
                    marks: [[15, 22, "U"], [15, 4, "B"], [5, 4, "C"], [26, 4, "R"], [4, 18, "C"], [26, 18, "R"], [15, 13, "P"]]
                }),
                "floorLinks": [
                    { "x": 15, "y": 22, "toFloor": 4, "targetX": 15, "targetY": 5, "label": "雷の中枢へ戻る" }
                ],
                "tileEffects": [
                    { "x": 6, "y": 11, "type": "warp", "toX": 24, "toY": 11, "message": "雷流に弾かれた。" },
                    { "x": 24, "y": 11, "type": "warp", "toX": 6, "toY": 11, "message": "雷流が反転した。" },
                    { "x": 5, "y": 4, "type": "ice", "maxSlide": 26, "message": "導電床が火花を散らした。" },
                    { "x": 6, "y": 19, "type": "ice", "maxSlide": 26, "message": "帯電した床を滑った。" },
                    { "x": 25, "y": 19, "type": "hunter", "id": "thunder_deep_guard", "imageKey": "overlay_dungeon_hunter_thunder", "monsterIds": [100081, 100043, 100043], "speed": 2, "range": 28, "statMultiplier": 1.9, "message": "雷鎧の強敵が迫る！" }
                ],
                "bosses": [
                    { "x": 15, "y": 4, "monsterId": [100081, 100082], "questId": "frieda_baron_thunder_depths", "storyEventId": "quest_frieda_baron_clear", "actionLabel": "制御核を止める", "inspectLog": "フリーダとバロンが雷の核へ迫っている。" }
                ],
                "chests": [
                    { "x": 5, "y": 4, "itemId": 4, "type": "item" },
                    { "x": 26, "y": 4, "itemId": 105, "type": "item", "rare": true },
                    { "x": 4, "y": 18, "itemId": 6, "type": "item" },
                    { "x": 26, "y": 18, "itemId": 107, "type": "item", "rare": true }
                ],
                "mapActions": [
                    { "x": 15, "y": 13, "label": "制御装置を調べる", "log": "壊れた導電装置が、まだ淡い雷光を吐いている。", "type": "log", "imageKey": "overlay_dungeon_event" }
                ],
                "healSprings": [{ "x": 15, "y": 13 }],
                "entryPoint": { "x": 15, "y": 22 }
            }
        ]
    },
    "LIGHT_PALACE": {
        "name": "光の宮殿",
        "themeKey": "LIGHT_PALACE",
        "rank": 50,
        "encounterRank": 50,
        "battleBg": "battle_bg_light_palace",
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
                "rareMonsters": [{ "id": 200202, "rate": 0.05 }],
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
                ],
                "mapActions": [
                    { "x": 13, "y": 21, "label": "聖薬を買う", "log": "巡礼者の補給所が開かれている。", "type": "shop", "shopType": "item", "title": "光の宮殿 聖薬所", "shopRank": 55, "requiredFlag": "lightPalaceCleared", "lockedText": "まだ巡礼者は戻っていない。" },
                    { "x": 16, "y": 21, "label": "武器を見る", "log": "白光を帯びた武器が整えられている。", "type": "shop", "shopType": "weapon", "title": "光の宮殿 武器庫", "shopRank": 55, "requiredFlag": "lightPalaceCleared", "lockedText": "武器庫は沈黙している。" },
                    { "x": 19, "y": 21, "label": "防具を見る", "log": "浄化された防具が並んでいる。", "type": "shop", "shopType": "armor", "title": "光の宮殿 防具庫", "shopRank": 55, "requiredFlag": "lightPalaceCleared", "lockedText": "防具庫は閉ざされている。" },
                    { "x": 16, "y": 18, "label": "休む", "log": "白光の回廊に休息所が設けられた。", "type": "inn", "requiredFlag": "lightPalaceCleared", "lockedText": "まだ安全に休める場所ではない。" },
                    { "x": 15, "y": 20, "label": "巡礼者と話す", "log": "巡礼者が割れたステンドグラスを集めている。", "type": "storyEvent", "eventId": "post_light_palace_base_1", "requiredFlag": "lightPalaceCleared", "lockedText": "光の宮殿はまだ緊張に包まれている。" }
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
                "rareMonsters": [{ "id": 200202, "rate": 0.05 }],
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
                "rareMonsters": [{ "id": 200202, "rate": 0.05 }],
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
                "rareMonsters": [{ "id": 200202, "rate": 0.05 }],
                "width": 33,
                "height": 27,
                "tiles": [
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
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
        rareMonsters: [{ id: 200202, rate: 0.05 }],
        battleBg: "battle_bg_dark_castle",
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
                mapActions: [
                    { x: 9, y: 20, label: "闇市を見る", log: "魔族の商人が静かに品を広げている。", type: "shop", shopType: "item", title: "魔王城 闇市", shopRank: 65, requiredFlag: "darkCastleCleared", lockedText: "城内はまだ戦闘態勢だ。" },
                    { x: 12, y: 20, label: "武器を見る", log: "魔族の鍛冶場から低い槌音が響く。", type: "shop", shopType: "weapon", title: "魔王城 武器庫", shopRank: 65, requiredFlag: "darkCastleCleared", lockedText: "武器庫には近づけない。" },
                    { x: 18, y: 20, label: "防具を見る", log: "闇に耐える防具が並んでいる。", type: "shop", shopType: "armor", title: "魔王城 防具庫", shopRank: 65, requiredFlag: "darkCastleCleared", lockedText: "防具庫には近づけない。" },
                    { x: 15, y: 21, label: "休む", log: "中央広間の一角が仮眠所になっている。", type: "inn", requiredFlag: "darkCastleCleared", lockedText: "まだ休む余裕はない。" },
                    { x: 15, y: 18, label: "魔族兵と話す", log: "魔族兵が城門の修復計画を見ている。", type: "storyEvent", eventId: "post_dark_castle_base_1", requiredFlag: "darkCastleCleared", lockedText: "魔族兵は警戒している。" }
                ],
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
                tileEffects: [
                    { x: 10, y: 13, type: "warp", toX: 22, toY: 13, message: "黒鏡の回廊が左右を入れ替えた。" },
                    { x: 22, y: 13, type: "warp", toX: 10, toY: 13, message: "黒鏡が元の廊下へ返した。" },
                    { x: 24, y: 20, type: "hunter", id: "dark_castle_west_patrol", imageKey: "overlay_dungeon_hunter_shadow", monsterIds: [100058, 100059, 100060], speed: 1, range: 24, statMultiplier: 1.7, message: "西館の巡察兵が迫る！" }
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
                    "WWWWWWWTTTCTTTTTTTTTTTTTWWWWWWW",
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
                tileEffects: [
                    { x: 9, y: 13, type: "warp", toX: 21, toY: 13, message: "風哭の門が東西を反転した。" },
                    { x: 21, y: 13, type: "warp", toX: 9, toY: 13, message: "風哭の門が閉じた。" },
                    { x: 6, y: 20, type: "hunter", id: "dark_castle_east_patrol", imageKey: "overlay_dungeon_hunter_shadow", monsterIds: [100060, 100061, 100062], speed: 1, range: 24, statMultiplier: 1.7, message: "東館の追跡者が迫る！" }
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
                tileEffects: [
                    { x: 8, y: 8, type: "warp", toX: 22, toY: 18, message: "夢幻回廊が景色を裏返した。" },
                    { x: 22, y: 18, type: "warp", toX: 8, toY: 8, message: "夢の継ぎ目から戻った。" },
                    { x: 8, y: 17, type: "poison", damageRate: 0.08, message: "悪夢の霧が意識を蝕む！" },
                    { x: 24, y: 20, type: "hunter", id: "dark_castle_dream_guard", imageKey: "overlay_dungeon_hunter_shadow", monsterIds: [301081, 100064, 100065], speed: 0.5, range: 26, statMultiplier: 1.9, message: "夢幻の番人が迫る！" }
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
                    "WWWWWWWWWWWWWWWZWWWWWWWWWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTCTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWWWWWWWWWXWWWWWWWWWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWTTTTTTTTTTTTTTTTTWWWWWWW",
                    "WWWWWWWWWWWWWWWYWWWWWWWWWWWWWWW",
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
                    { "x": 10, "y": 12, "itemId": 100, "type": "item", "rare": true },
                    { "x": 21, "y": 20, "itemId": 105, "type": "item", "rare": true }
                ],
                bosses: [
                    { "x": 15, "y": 5, "monsterId": 301100, "startEventId": "dark_castle_zenon_encounter", "storyEventId": "dark_castle_clear", "actionLabel": "謁見の間へ進む" }
                ],
                mapActions: [
                    { "x": 20, "y": 12, "label": "玉座の間を見渡す", "log": "滅びた玉座の前で、赤い空だけが静かに揺れている。", "type": "log", "imageKey": "overlay_dungeon_event" }
                ],
                healSprings: [{ "x": 20, "y": 12 }],
                entryPoint: { "x": 15, "y": 24 }
            }
        ]
    },
    FOREST_WIND_HOLE: {
        name: "森の風穴",
        themeKey: "WIND_HOLE",
        rank: 8,
        encounterRank: 8,
        battleBg: "battle_bg_wind_hole",
        entryPoint: { x: 12, y: 19 },
        floors: [
            {
                label: "風鳴りの洞",
                encounterRank: 8,
                monsters: [100006, 100007, 100008, 100009],
                width: 25,
                height: 21,
                tiles: buildAuthoredLayout(25, 21, {
                    rooms: [[10, 16, 5, 4], [2, 14, 7, 5], [3, 8, 8, 4], [13, 11, 9, 5], [16, 2, 7, 6], [2, 2, 7, 4]],
                    paths: [
                        [[12, 18], [6, 18], [6, 15]],
                        [[6, 15], [6, 10], [16, 13]],
                        [[6, 10], [5, 4], [19, 4]],
                        [[17, 13], [19, 5]]
                    ],
                    marks: [[12, 19, "S"], [19, 3, "D"], [3, 3, "C"], [21, 6, "C"]]
                }),
                floorLinks: [
                    { x: 12, y: 19, to: "EXIT", label: "外へ出る" },
                    { x: 19, y: 3, toFloor: 2, targetX: 12, targetY: 18, label: "泉の奥へ" }
                ],
                tileEffects: [
                    { x: 5, y: 9, type: "warp", toX: 18, toY: 14, message: "風穴の渦に運ばれた。" },
                    { x: 18, y: 14, type: "warp", toX: 5, toY: 9, message: "風穴の渦が巻き戻った。" },
                    { x: 4, y: 4, type: "hunter", id: "wind_hole_stalker", imageKey: "overlay_dungeon_hunter_forest", monsterIds: [100010, 100013, 100010], speed: 0.5, range: 18, statMultiplier: 1.7, message: "黒風の魔物が迫る！" }
                ],
                chests: [
                    { x: 3, y: 3, itemId: 4, type: "item" },
                    { x: 21, y: 6, itemId: 100, type: "item", rare: true }
                ],
                mapActions: [
                    { x: 12, y: 9, label: "風の通り道を聞く", log: "洞の奥へ、低く澄んだ風の音が吸い込まれていく。", type: "log", imageKey: "overlay_dungeon_event" }
                ],
                entryPoint: { x: 12, y: 18 }
            },
            {
                label: "妖精の泉",
                encounterRank: 10,
                monsters: [100008, 100009, 100010],
                width: 25,
                height: 21,
                tiles: buildAuthoredLayout(25, 21, {
                    rooms: [[8, 2, 9, 6], [9, 15, 7, 5], [2, 10, 6, 6], [17, 10, 6, 6], [2, 2, 5, 5], [18, 2, 5, 5]],
                    paths: [
                        [[12, 18], [12, 12], [5, 12], [4, 4]],
                        [[12, 12], [20, 12], [20, 4]],
                        [[5, 12], [12, 5]],
                        [[20, 12], [12, 5]]
                    ],
                    marks: [[12, 18, "U"], [12, 5, "B"], [3, 4, "C"], [21, 4, "C"]]
                }),
                floorLinks: [
                    { x: 12, y: 18, toFloor: 1, targetX: 19, targetY: 4, label: "入口へ戻る" }
                ],
                tileEffects: [
                    { x: 5, y: 12, type: "poison", damageRate: 0.05, message: "瘴気を吸い込んだ！" },
                    { x: 20, y: 12, type: "poison", damageRate: 0.05, message: "瘴気が肌を焼く！" },
                    { x: 4, y: 4, type: "warp", toX: 20, toY: 4, message: "妖精風が泉の反対岸へ運んだ。" },
                    { x: 20, y: 4, type: "warp", toX: 4, toY: 4, message: "妖精風が泉を巡った。" }
                ],
                bosses: [
                    { x: 12, y: 5, monsterId: 301011, storyEventId: "quest_fire_holy_water_clear", actionLabel: "妖精を守る", inspectLog: "妖精の泉で、闇をまとった魔物が小さな光を追い詰めている。" }
                ],
                chests: [
                    { x: 3, y: 4, itemId: 4, type: "item" },
                    { x: 21, y: 4, itemId: 101, type: "item", rare: true }
                ],
                healSprings: [{ x: 12, y: 2 }],
                entryPoint: { x: 12, y: 18 }
            }
        ]
    },
    CRENA_LIMESTONE_CAVE: {
        name: "クレナ鍾乳洞",
        themeKey: "CRENA_CAVE",
        rank: 23,
        encounterRank: 23,
        battleBg: "battle_bg_crena",
        entryPoint: { x: 13, y: 21 },
        floors: [
            {
                label: "蒼滴の道",
                encounterRank: 23,
                monsters: [100020, 100021, 100022, 100023],
                width: 27,
                height: 23,
                tiles: buildAuthoredLayout(27, 23, {
                    rooms: [[11, 18, 5, 4], [2, 15, 7, 5], [18, 14, 7, 6], [5, 8, 7, 5], [15, 7, 8, 5], [2, 2, 7, 5], [19, 2, 6, 5]],
                    paths: [
                        [[13, 20], [6, 18], [8, 10]],
                        [[13, 20], [21, 17], [19, 9]],
                        [[8, 10], [5, 4], [21, 4]],
                        [[19, 9], [22, 4]]
                    ],
                    marks: [[13, 21, "S"], [22, 3, "D"], [3, 4, "C"], [23, 16, "C"]]
                }),
                floorLinks: [
                    { x: 13, y: 21, to: "EXIT", label: "外へ出る" },
                    { x: 22, y: 3, toFloor: 2, targetX: 4, targetY: 20, label: "結晶の間へ" }
                ],
                tileEffects: [
                    { x: 8, y: 10, type: "ice", maxSlide: 18, message: "濡れた石床を滑った。" },
                    { x: 19, y: 9, type: "ice", maxSlide: 18, message: "氷の膜に足を取られた。" },
                    { x: 6, y: 18, type: "hunter", id: "crena_claw", imageKey: "overlay_dungeon_hunter_sea", monsterIds: [100024, 100030, 100024], speed: 0.5, range: 22, statMultiplier: 1.8, message: "爪痕の主が襲いかかる！" }
                ],
                chests: [
                    { x: 3, y: 4, itemId: 4, type: "item" },
                    { x: 23, y: 16, itemId: 101, type: "item", rare: true }
                ],
                entryPoint: { x: 13, y: 20 }
            },
            {
                label: "青の結晶の間",
                encounterRank: 25,
                monsters: [100022, 100023, 100024, 100025],
                width: 27,
                height: 23,
                tiles: buildAuthoredLayout(27, 23, {
                    rooms: [[9, 2, 9, 7], [2, 8, 7, 7], [18, 8, 7, 7], [2, 18, 6, 4], [10, 16, 7, 5], [20, 17, 5, 4]],
                    paths: [
                        [[4, 20], [5, 11], [13, 6]],
                        [[5, 11], [13, 18], [22, 18]],
                        [[13, 6], [21, 11], [23, 10]]
                    ],
                    marks: [[4, 20, "U"], [13, 5, "B"], [23, 10, "D"], [3, 10, "C"], [22, 18, "C"]]
                }),
                floorLinks: [
                    { x: 4, y: 20, toFloor: 1, targetX: 22, targetY: 4, label: "入口へ戻る" },
                    { x: 23, y: 10, toFloor: 3, targetX: 2, targetY: 22, label: "結界の奥へ", requiredFlag: "darkCastleCleared", lockedLabel: "結界を調べる", lockedLog: "巧妙な結界に阻まれている。" }
                ],
                tileEffects: [
                    { x: 5, y: 11, type: "warp", toX: 21, toY: 11, message: "結晶光が空間を曲げた。" },
                    { x: 21, y: 11, type: "warp", toX: 5, toY: 11, message: "結晶光が戻り道を開いた。" },
                ],
                mapActions: [
                    { x: 21, y: 11, label: "リーシアの気配を追う", log: "結晶の影に、結界の奥へ続くかすかな気配が残っている。", type: "quest", questId: "licia_crena_depths", lockedText: "闇の加護がなければ、この結界の奥は見えない。" }
                ],
                bosses: [
                    { x: 13, y: 5, monsterId: 301021, storyEventId: "quest_water_blue_crystal_clear", actionLabel: "結晶を守る魔物に挑む", inspectLog: "青い結晶の前に、鋭い爪痕を残した魔物が佇んでいる。" }
                ],
                chests: [
                    { x: 3, y: 10, itemId: 4, type: "item" },
                    { x: 22, y: 18, itemId: 102, type: "item", rare: true }
                ],
                healSprings: [{ x: 13, y: 10 }],
                entryPoint: { x: 4, y: 20 }
            },
            {
                label: "クレナ鍾乳洞深部・結界裏層",
                encounterRank: 90,
                monsters: [100056, 100057, 100058, 100059],
                enemyBoost: { nameSuffix: "強", statMultiplier: 1.3, elmRes: { "火": 30, "水": 30, "風": 30, "雷": 30, "光": 30, "闇": 30 }, resists: { Poison: 50, Shock: 50, Fear: 50, InstantDeath: 50, Debuff: 50, Seal: 50 } },
                width: 29,
                height: 25,
                tiles: buildAuthoredLayout(29, 25, {
                    rooms: [[10, 2, 9, 6], [2, 9, 7, 7], [20, 8, 7, 7], [2, 20, 6, 4], [10, 17, 9, 6], [21, 19, 6, 4]],
                    paths: [
                        [[2, 22], [5, 12], [14, 5]],
                        [[5, 12], [14, 20], [24, 21]],
                        [[14, 5], [23, 11], [24, 21]]
                    ],
                    marks: [[2, 22, "U"], [14, 4, "B"], [4, 11, "C"], [24, 21, "C"]]
                }),
                floorLinks: [
                    { x: 2, y: 22, toFloor: 2, targetX: 23, targetY: 11, label: "結晶の間へ戻る" }
                ],
                tileEffects: [
                    { x: 5, y: 12, type: "poison", damageRate: 0.09, message: "結界毒が体を蝕む！" },
                    { x: 23, y: 11, type: "ice", maxSlide: 24, message: "結界の膜を滑った。" },
                    { x: 24, y: 21, type: "hunter", id: "crena_barrier_guard", imageKey: "overlay_dungeon_hunter_shadow", monsterIds: [100057, 100058, 100059], speed: 0.5, range: 26, statMultiplier: 2.1, message: "結界守が迫る！" },
                ],
                bosses: [
                    { x: 14, y: 4, monsterId: [100078, 100082, 100078], questId: "licia_crena_depths", storyEventId: "quest_licia_clear", actionLabel: "結界核を砕く", inspectLog: "リーシアの魔力が結界核の奥で揺れている。" }
                ],
                chests: [
                    { x: 4, y: 11, itemId: 103, type: "item", rare: true },
                    { x: 24, y: 21, itemId: 105, type: "item", rare: true }
                ],
                entryPoint: { x: 2, y: 22 }
            }
        ]
    },
    DARK_SHRINE_RUINS: {
        name: "闇の神殿跡地",
        themeKey: "DARK_SHRINE_RUINS",
        rank: 75,
        encounterRank: 75,
        battleBg: "battle_bg_dark_shrine",
        entryPoint: { x: 14, y: 21 },
        floors: [
            {
                label: "影残る拝廊",
                encounterRank: 75,
                monsters: [100064, 100065, 100066, 100067],
                width: 29,
                height: 23,
                tiles: buildAuthoredLayout(29, 23, {
                    rooms: [[11, 2, 7, 7], [2, 3, 6, 6], [21, 3, 6, 6], [3, 11, 8, 7], [18, 11, 8, 7], [11, 18, 7, 4]],
                    paths: [
                        [[14, 21], [14, 14], [6, 14], [5, 6]],
                        [[14, 14], [22, 14], [24, 6]],
                        [[5, 6], [14, 5], [24, 6]]
                    ],
                    marks: [[14, 21, "S"], [14, 19, "P"], [14, 5, "B"], [24, 4, "D"], [4, 5, "C"], [24, 16, "C"]]
                }),
                floorLinks: [
                    { x: 14, y: 21, to: "EXIT", label: "外へ出る" },
                    { x: 24, y: 4, toFloor: 2, targetX: 2, targetY: 22, label: "隠し祭壇へ" }
                ],
                tileEffects: [
                    { x: 6, y: 14, type: "poison", damageRate: 0.08, message: "闇の霧が命を削る！" },
                    { x: 5, y: 6, type: "warp", toX: 24, toY: 6, message: "影の門に呑まれた。" },
                    { x: 24, y: 6, type: "warp", toX: 5, toY: 6, message: "影の門が開いた。" },
                    { x: 22, y: 14, type: "hunter", id: "shrine_shadow", imageKey: "overlay_dungeon_hunter_shadow", monsterIds: [301080, 100066, 100067], speed: 0.5, range: 26, statMultiplier: 2.0, message: "神殿の影が追ってくる！" }
                ],
                mapActions: [
                    { x: 14, y: 19, label: "二人に声をかける", log: "二人の剣士が、奥から漏れる闇を警戒している。", type: "quest", questId: "claude_leon_dark_shrine", imageKey: "overlay_npc_bronze_knight" }
                ],
                bosses: [
                    { x: 14, y: 5, monsterId: 301080, questId: "claude_leon_dark_shrine", storyEventId: "quest_claude_leon_clear", requiredFlag: "lightPalaceCleared", actionLabel: "クロードとレオンに加勢する", inspectLog: "二つの剣閃が、闇の残滓を食い止めている。" }
                ],
                chests: [
                    { x: 4, y: 5, itemId: 103, type: "item", rare: true },
                    { x: 24, y: 16, itemId: 105, type: "item", rare: true }
                ],
                entryPoint: { x: 14, y: 21 }
            },
            {
                label: "月影の祭壇",
                encounterRank: 95,
                monsters: [100066, 100067, 100068],
                width: 31,
                height: 25,
                tiles: buildAuthoredLayout(31, 25, {
                    rooms: [[11, 2, 9, 6], [2, 5, 7, 7], [22, 5, 7, 7], [3, 15, 8, 7], [20, 15, 8, 7], [12, 17, 7, 6]],
                    paths: [
                        [[2, 22], [6, 18], [6, 8], [15, 5]],
                        [[6, 18], [15, 20], [24, 18], [25, 8]],
                        [[25, 8], [15, 5]]
                    ],
                    marks: [[2, 22, "U"], [15, 19, "P"], [15, 4, "B"], [4, 8, "C"], [26, 18, "C"]]
                }),
                floorLinks: [
                    { x: 2, y: 22, toFloor: 1, targetX: 24, targetY: 5, label: "拝廊へ戻る" }
                ],
                tileEffects: [
                    { x: 6, y: 8, type: "ice", maxSlide: 26, message: "月光の床を滑った。" },
                    { x: 25, y: 8, type: "poison", damageRate: 0.08, message: "月影の闇が染み込む！" },
                    { x: 6, y: 18, type: "warp", toX: 24, toY: 18, message: "月影が左右を反転させた。" },
                    { x: 24, y: 18, type: "warp", toX: 6, toY: 18, message: "月影が元の祭廊へ返した。" }
                ],
                mapActions: [
                    { x: 15, y: 19, label: "月影の声を聞く", log: "月光の向こうから、静かな呼び声が届く。", type: "quest", questId: "luna_hidden_dark_shrine", imageKey: "overlay_npc_villager" }
                ],
                bosses: [
                    { x: 15, y: 4, monsterId: 902000, questId: "luna_hidden_dark_shrine", storyEventId: "quest_luna_hidden_clear", requiredFlag: "lightPalaceCleared", actionLabel: "月影の試練に挑む", inspectLog: "月光を飲む影が、祭壇の中央で脈打っている。" }
                ],
                chests: [
                    { x: 4, y: 8, itemId: 106, type: "item", rare: true },
                    { x: 26, y: 18, itemId: 107, type: "item", rare: true }
                ],
                mapActions: [
                    { x: 15, y: 20, label: "祭壇の残光に触れる", log: "崩れた祭壇に、月明かりのような冷たい闇が残っている。", type: "log", imageKey: "overlay_dungeon_event" }
                ],
                healSprings: [{ x: 15, y: 20 }],
                entryPoint: { x: 2, y: 22 }
            }
        ]
    },
    GREZELIA_FORBIDDEN: {
        name: "禁則地グレゼリア",
        themeKey: "GREZELIA_CAVE",
        rank: 85,
        encounterRank: 85,
        battleBg: "battle_bg_grezelia",
        entryPoint: { x: 15, y: 23 },
        floors: [
            {
                label: "禁則回廊",
                encounterRank: 85,
                monsters: [100064, 100065, 100066, 100067],
                width: 31,
                height: 25,
                tiles: buildAuthoredLayout(31, 25, {
                    rooms: [[12, 2, 7, 7], [2, 3, 7, 6], [22, 3, 7, 6], [3, 11, 7, 7], [21, 11, 7, 7], [3, 19, 7, 4], [12, 19, 7, 5], [21, 19, 7, 4]],
                    paths: [
                        [[15, 23], [15, 15], [6, 15], [6, 6], [15, 5]],
                        [[15, 15], [24, 15], [25, 6], [15, 5]],
                        [[6, 21], [15, 21], [24, 21]],
                        [[6, 15], [6, 21]],
                        [[24, 15], [24, 21]]
                    ],
                    marks: [[15, 23, "S"], [15, 21, "P"], [27, 3, "D"], [4, 5, "C"], [26, 20, "C"]]
                }),
                floorLinks: [
                    { x: 15, y: 23, to: "EXIT", label: "外へ出る" },
                    { x: 27, y: 3, toFloor: 2, targetX: 2, targetY: 24, label: "禁奥へ" }
                ],
                tileEffects: [
                    { x: 6, y: 15, type: "poison", damageRate: 0.09, message: "禁則の毒が体を蝕む！" },
                    { x: 6, y: 6, type: "warp", toX: 25, toY: 6, message: "禁則式が座標を奪った。" },
                    { x: 25, y: 6, type: "warp", toX: 6, toY: 6, message: "禁則式が反転した。" },
                    { x: 24, y: 21, type: "hunter", id: "grezelia_rule", imageKey: "overlay_dungeon_hunter_shadow", monsterIds: [301100, 100067, 100068], speed: 0.5, range: 28, statMultiplier: 2.2, message: "禁則の番人が迫る！" }
                ],
                mapActions: [
                    { x: 15, y: 21, label: "二人の作戦を聞く", log: "リュウとミネルバが、禁則術式の崩し方を探っている。", type: "quest", questId: "ryu_minerva_grezelia", imageKey: "overlay_npc_dark_soldier" }
                ],
                bosses: [],
                chests: [
                    { x: 4, y: 5, itemId: 105, type: "item", rare: true },
                    { x: 26, y: 20, itemId: 106, type: "item", rare: true }
                ],
                entryPoint: { x: 15, y: 23 }
            },
            {
                label: "禁奥の核",
                encounterRank: 110,
                monsters: [100066, 100067, 100068],
                width: 33,
                height: 27,
                tiles: buildAuthoredLayout(33, 27, {
                    rooms: [[12, 2, 9, 6], [2, 4, 7, 7], [24, 4, 7, 7], [3, 14, 8, 7], [22, 14, 8, 7], [2, 23, 6, 3], [13, 20, 7, 6], [25, 22, 6, 4]],
                    paths: [
                        [[2, 24], [6, 17], [6, 7], [16, 4]],
                        [[6, 17], [16, 23], [27, 24]],
                        [[27, 24], [26, 17], [27, 7], [16, 4]],
                        [[6, 17], [26, 17]]
                    ],
                    marks: [[2, 24, "U"], [16, 4, "B"], [28, 23, "D"], [4, 7, "C"], [28, 24, "C"]]
                }),
                floorLinks: [
                    { x: 2, y: 24, toFloor: 1, targetX: 27, targetY: 4, label: "回廊へ戻る" },
                    { x: 28, y: 23, toFloor: 3, targetX: 17, targetY: 26, label: "零式禁則層へ", requiredFlag: "grezeliaOuterSealBroken", lockedLabel: "封印式を調べる", lockedLog: "二重の禁則封印が道を閉ざしている。" }
                ],
                tileEffects: [
                    { x: 6, y: 7, type: "ice", maxSlide: 28, message: "術式の床を滑った。" },
                    { x: 27, y: 7, type: "poison", damageRate: 0.1, message: "禁則の残響が響く！" },
                    { x: 6, y: 17, type: "warp", toX: 26, toY: 17, message: "術式が進行方向を反転した。" },
                    { x: 26, y: 17, type: "warp", toX: 6, toY: 17, message: "術式が再び反転した。" },
                    { x: 16, y: 23, type: "hunter", id: "grezelia_core_guard", imageKey: "overlay_dungeon_hunter_shadow", monsterIds: [301100, 100067, 100068], speed: 1, range: 30, statMultiplier: 2.4, message: "禁奥の執行者が迫る！" }
                ],
                bosses: [
                    { x: 16, y: 4, monsterId: 301100, questId: "ryu_minerva_grezelia", storyEventId: "quest_ryu_minerva_clear", requiredFlag: "darkCastleCleared", actionLabel: "外殻術式を破る", inspectLog: "リュウとミネルバが、幾重にも絡む禁則術式を押さえている。" }
                ],
                chests: [
                    { x: 4, y: 7, itemId: 106, type: "item", rare: true },
                    { x: 28, y: 24, itemId: 107, type: "item", rare: true }
                ],
                mapActions: [
                    { x: 16, y: 23, label: "禁奥の脈動を読む", log: "床下で、研究棟の心臓のような魔力が脈打っている。", type: "log", imageKey: "overlay_dungeon_event" }
                ],
                healSprings: [{ x: 16, y: 23 }],
                entryPoint: { x: 2, y: 24 }
            },
            {
                label: "零式禁則層",
                encounterRank: 125,
                monsters: [100066, 100067, 100068],
                width: 35,
                height: 29,
                tiles: buildAuthoredLayout(35, 29, {
                    rooms: [[13, 2, 9, 7], [2, 4, 8, 8], [25, 4, 8, 8], [3, 16, 9, 8], [23, 16, 9, 8], [13, 22, 9, 6]],
                    paths: [
                        [[17, 26], [7, 20], [6, 8], [17, 5]],
                        [[17, 26], [28, 20], [29, 8], [17, 5]],
                        [[7, 20], [17, 15], [28, 20]],
                        [[6, 8], [17, 15], [29, 8]]
                    ],
                    marks: [[17, 26, "U"], [17, 24, "P"], [17, 4, "B"], [4, 8, "C"], [30, 8, "R"]]
                }),
                floorLinks: [
                    { x: 17, y: 26, toFloor: 2, targetX: 28, targetY: 22, label: "禁奥の核へ戻る" }
                ],
                tileEffects: [
                    { x: 6, y: 8, type: "warp", toX: 29, toY: 8, message: "零式術式が左右を入れ替えた。" },
                    { x: 29, y: 8, type: "warp", toX: 6, toY: 8, message: "零式術式が再反転した。" },
                    { x: 7, y: 20, type: "poison", damageRate: 0.12, message: "存在を拒む禁則が命を削る！" },
                    { x: 28, y: 20, type: "ice", maxSlide: 30, message: "空間そのものが滑り落ちた。" },
                    { x: 17, y: 15, type: "hunter", id: "grezelia_zero_executor", imageKey: "overlay_dungeon_hunter_shadow", monsterIds: [301100, 100067, 100068], speed: 2, range: 34, statMultiplier: 2.7, message: "零式執行者が二歩ずつ迫る！" }
                ],
                mapActions: [
                    { x: 17, y: 24, label: "禁則の声に応える", log: "最深部から、ゼノンの声が低く響いている。", type: "quest", questId: "zenon_hidden_grezelia", imageKey: "overlay_npc_dark_soldier" }
                ],
                bosses: [
                    { x: 17, y: 4, monsterId: 902000, questId: "zenon_hidden_grezelia", storyEventId: "quest_zenon_hidden_clear", requiredFlag: "grezeliaOuterSealBroken", actionLabel: "零式禁則試練に挑む", inspectLog: "禁則の底で、意志を持つ闇がこちらを見返している。" }
                ],
                chests: [
                    { x: 4, y: 8, itemId: 107, type: "item", rare: true },
                    { x: 30, y: 8, itemId: 108, type: "item", rare: true }
                ],
                healSprings: [{ x: 17, y: 25 }],
                entryPoint: { x: 17, y: 26 }
            }
        ]
    }
};

normalizeCoordinateActorTiles(FIXED_DUNGEON_MAPS);

const MapRegistry = {
    applyStoryMapMutation(mutationKey) {
        const mutation = STORY_MAP_MUTATIONS[mutationKey];
        if (!mutation || typeof App === "undefined" || !App.data?.progress) return false;
        if (!App.data.progress.mapChanges) App.data.progress.mapChanges = {};
        if (!App.data.progress.mapChanges[mutation.area]) App.data.progress.mapChanges[mutation.area] = {};
        mutation.changes.forEach(change => {
            App.data.progress.mapChanges[mutation.area][`${change.x},${change.y}`] = change.tile;
        });
        if (typeof App.save === "function") App.save();
        if (typeof Field !== "undefined" && Field.ready) Field.render();
        return true;
    },

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
            rareMonsters: Array.isArray(base.rareMonsters) ? base.rareMonsters : undefined,
            enemyBoost: base.enemyBoost,
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
            rareMonsters: Array.isArray(def.rareMonsters) ? def.rareMonsters : base.rareMonsters,
            enemyBoost: def.enemyBoost || base.enemyBoost,
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

    findTileEffect(mapDef, x, y) {
        if (!mapDef || !Array.isArray(mapDef.tileEffects)) return null;
        return mapDef.tileEffects.find(effect => Number(effect.x) === Number(x) && Number(effect.y) === Number(y)) || null;
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
