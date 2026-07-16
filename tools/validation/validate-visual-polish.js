const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const errors = [];

const assetContext = { console };
assetContext.window = assetContext;
assetContext.globalThis = assetContext;
vm.createContext(assetContext);
vm.runInContext(`${read('assets.js')}\nglobalThis.__ASSETS = PRISMA_ASSETS;`, assetContext, { filename: 'assets.js' });

const skillContext = { window: {} };
vm.createContext(skillContext);
vm.runInContext(read('skills.js'), skillContext, { filename: 'skills.js' });

const mapContext = { window: {}, console };
vm.createContext(mapContext);
vm.runInContext(read('map.js'), mapContext, { filename: 'map.js' });
vm.runInContext(read('maps_logic.js'), mapContext, { filename: 'maps_logic.js' });

const assets = assetContext.__ASSETS || {};
const graphics = assets.graphics || {};
const battleFx = assets.battleFx || {};
const skills = skillContext.window.SKILLS_DATA || [];
const polish = read('polish.js');
const phaser = read('phaser-field.js');
const main = read('main.js');
const css = read('modern-polish.css');

const requiredThemeGraphics = {
    overlay_decor_default_cave_dust: 'assets/map/overlays/overlay_decor_default_cave_dust_v001.png',
    overlay_decor_start_village_herbs: 'assets/map/overlays/overlay_decor_start_village_herbs_v001.png',
    overlay_decor_start_cave_damp: 'assets/map/overlays/overlay_decor_start_cave_damp_v001.png',
    overlay_decor_fire_ember_fissure: 'assets/map/overlays/overlay_decor_fire_ember_fissure_v001.png',
    overlay_decor_wind_village_feather: 'assets/map/overlays/overlay_decor_wind_village_feather_v001.png',
    overlay_decor_wind_hole_root: 'assets/map/overlays/overlay_decor_wind_hole_root_v001.png',
    overlay_decor_forbidden_forest_moss: 'assets/map/overlays/overlay_decor_forbidden_forest_moss_v001.png',
    overlay_decor_water_city_puddle: 'assets/map/overlays/overlay_decor_water_city_puddle_v001.png',
    overlay_decor_big_tower_gear_oil: 'assets/map/overlays/overlay_decor_big_tower_gear_oil_v001.png',
    overlay_decor_thunder_fort_wiring: 'assets/map/overlays/overlay_decor_thunder_fort_wiring_v001.png',
    overlay_decor_light_palace_prism: 'assets/map/overlays/overlay_decor_light_palace_prism_v001.png',
    overlay_decor_galvania_crystal: 'assets/map/overlays/overlay_decor_galvania_crystal_v001.png',
    overlay_decor_dark_castle_chain: 'assets/map/overlays/overlay_decor_dark_castle_chain_v001.png',
    overlay_decor_crena_limestone_pool: 'assets/map/overlays/overlay_decor_crena_limestone_pool_v001.png',
    overlay_decor_seabed_temple_ripple: 'assets/map/overlays/overlay_decor_seabed_temple_ripple_v001.png',
    overlay_decor_dark_shrine_sigil: 'assets/map/overlays/overlay_decor_dark_shrine_sigil_v001.png',
    overlay_decor_grezelia_fossil: 'assets/map/overlays/overlay_decor_grezelia_fossil_v001.png',
    overlay_decor_abyss_void_dust: 'assets/map/overlays/overlay_decor_abyss_void_dust_v001.png',
    overlay_decor_abyss_field_flora: 'assets/map/overlays/overlay_decor_abyss_field_flora_v001.png',
    overlay_decor_ruined_shrine_glyph: 'assets/map/overlays/overlay_decor_ruined_shrine_glyph_v001.png'
};
const requiredCarpetGraphics = {
    overlay_castle_carpet_fill: 'assets/map/overlays/overlay_castle_carpet_fill_v001.png',
    overlay_castle_carpet_edge_n: 'assets/map/overlays/overlay_castle_carpet_edge_n_v001.png',
    overlay_castle_carpet_edge_s: 'assets/map/overlays/overlay_castle_carpet_edge_s_v001.png',
    overlay_castle_carpet_edge_w: 'assets/map/overlays/overlay_castle_carpet_edge_w_v001.png',
    overlay_castle_carpet_edge_e: 'assets/map/overlays/overlay_castle_carpet_edge_e_v001.png',
    overlay_castle_carpet_corner_nw: 'assets/map/overlays/overlay_castle_carpet_corner_nw_v001.png',
    overlay_castle_carpet_corner_ne: 'assets/map/overlays/overlay_castle_carpet_corner_ne_v001.png',
    overlay_castle_carpet_corner_sw: 'assets/map/overlays/overlay_castle_carpet_corner_sw_v001.png',
    overlay_castle_carpet_corner_se: 'assets/map/overlays/overlay_castle_carpet_corner_se_v001.png'
};
const requiredConnectedTextileGraphics = Object.fromEntries([
    ['overlay_castle_carpet_blue_silver', 'assets/map/overlays/overlay_castle_carpet_blue_silver'],
    ['overlay_village_goza', 'assets/map/overlays/overlay_village_goza']
].flatMap(([keyPrefix, pathPrefix]) => [
    'fill', 'edge_n', 'edge_s', 'edge_w', 'edge_e',
    'corner_nw', 'corner_ne', 'corner_sw', 'corner_se'
].map(suffix => [`${keyPrefix}_${suffix}`, `${pathPrefix}_${suffix}_v001.png`])));
const requiredDoorGraphics = {
    door_key_red: 'assets/map/objects/door_key_red_v003.png',
    door_key_blue: 'assets/map/objects/door_key_blue_v003.png',
    door_key_gold: 'assets/map/objects/door_key_gold_v003.png'
};
const requiredGraphics = {
    ...requiredThemeGraphics,
    ...requiredCarpetGraphics,
    ...requiredConnectedTextileGraphics,
    ...requiredDoorGraphics,
    overlay_world_grass_detail: 'assets/map/overlays/overlay_world_grass_detail_v001.png',
    overlay_world_grass_weeds: 'assets/map/overlays/overlay_world_grass_weeds_v001.png',
    overlay_world_grass_earth: 'assets/map/overlays/overlay_world_grass_earth_v001.png',
    overlay_world_forest_understory: 'assets/map/overlays/overlay_world_forest_understory_v001.png',
    overlay_world_forest_roots: 'assets/map/overlays/overlay_world_forest_roots_v001.png',
    overlay_world_foothill_rocks: 'assets/map/overlays/overlay_world_foothill_rocks_v001.png',
    overlay_world_shore_foam: 'assets/map/overlays/overlay_world_shore_foam_v001.png',
    overlay_world_bridge_wood: 'assets/map/overlays/overlay_world_bridge_wood_v001.png'
};
for (const [key, expected] of Object.entries(requiredGraphics)) {
    if (graphics[key] !== expected) errors.push(`map decoration key is missing or wrong: ${key}`);
}
const themeDecorByTheme = {
    DEFAULT: 'overlay_decor_default_cave_dust',
    START_VILLAGE: 'overlay_decor_start_village_herbs',
    START_CAVE: 'overlay_decor_start_cave_damp',
    FIRE_VILLAGE: 'overlay_decor_fire_ember_fissure',
    WIND_VILLAGE: 'overlay_decor_wind_village_feather',
    WIND_HOLE: 'overlay_decor_wind_hole_root',
    FORBIDDEN_FOREST: 'overlay_decor_forbidden_forest_moss',
    BIG_TOWER: 'overlay_decor_big_tower_gear_oil',
    THUNDER_FORT: 'overlay_decor_thunder_fort_wiring',
    LIGHT_PALACE: 'overlay_decor_light_palace_prism',
    GALVANIA_CAVE: 'overlay_decor_galvania_crystal',
    DARK_CASTLE: 'overlay_decor_dark_castle_chain',
    SEABED_TEMPLE: 'overlay_decor_seabed_temple_ripple',
    DARK_SHRINE_RUINS: 'overlay_decor_dark_shrine_sigil',
    GREZELIA_CAVE: 'overlay_decor_grezelia_fossil',
    ABYSS: 'overlay_decor_abyss_void_dust',
    ABYSS_FIELD: 'overlay_decor_abyss_field_flora',
    RUINED_SHRINE: 'overlay_decor_ruined_shrine_glyph'
};
const disabledThemeDecor = new Set(['WATER_CITY', 'CRENA_CAVE']);
for (const [theme, key] of Object.entries(themeDecorByTheme)) {
    if (!phaser.includes(`${theme}: { key: '${key}'`)) errors.push(`theme-specific floor decoration route is missing: ${theme}`);
}
const tileThemeKeys = Object.keys(mapContext.window.TILE_THEMES || {}).filter(key => key !== 'WORLD');
for (const theme of tileThemeKeys) {
    if (!themeDecorByTheme[theme] && !disabledThemeDecor.has(theme)) errors.push(`tile theme has no unique floor decoration: ${theme}`);
}
if (!phaser.includes("CRENA_CAVE: { key: null, disabled: true")) errors.push('Crena Cave random floor puddles are not disabled');
if (!phaser.includes("WATER_CITY: { key: null, disabled: true")) errors.push('Water City random floor puddles are not disabled');
if (battleFx['phys-elemental'] !== 'assets/effect/fx_phys_elemental_arc_v001.png') {
    errors.push('generated elemental physical effect is not registered');
}
const requiredBattleFx = {
    'neutral-slash': 'assets/effect/fx_phys_slash_arc_v002.png',
    'neutral-pierce': 'assets/effect/fx_phys_pierce_lance_v002.png',
    'neutral-smash': 'assets/effect/fx_phys_smash_impact_v002.png',
    'ranged-volley': 'assets/effect/fx_phys_ranged_volley_v001.png',
    'arcane-burst': 'assets/effect/fx_magic_arcane_burst_v001.png',
    'heal-blossom': 'assets/effect/fx_support_heal_radiance_v002.png',
    'debuff': 'assets/effect/fx_support_debuff_hex_v002.png',
    'breath': 'assets/effect/fx_breath_cone_master_v001.png',
    'ultimate-ragnarok': 'assets/effect/fx_ultimate_166_ragnarok_v001.png',
    'ultimate-prisma-end': 'assets/effect/fx_ultimate_168_prisma_end_v001.png',
    'ultimate-big-bang': 'assets/effect/fx_ultimate_238_big_bang_v001.png',
    'ultimate-abyss-wall': 'assets/effect/fx_ultimate_242_abyss_wall_v001.png',
    'ultimate-phoenix-flare': 'assets/effect/fx_ultimate_243_phoenix_flare_v001.png',
    'ultimate-genesis-magic': 'assets/effect/fx_ultimate_244_genesis_magic_v001.png',
    'ultimate-chaos-shock': 'assets/effect/fx_ultimate_245_chaos_shock_v001.png',
    'ultimate-illuminati-break': 'assets/effect/fx_ultimate_246_illuminati_break_v001.png',
    'ultimate-the-end': 'assets/effect/fx_ultimate_247_the_end_v001.png',
    'ultimate-lost-prisma': 'assets/effect/fx_ultimate_248_lost_prisma_v001.png'
};
for (const [key, expected] of Object.entries(requiredBattleFx)) {
    if (battleFx[key] !== expected) errors.push(`battle effect key is missing or wrong: ${key}`);
}

const pngInfo = relative => {
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) {
        errors.push(`generated visual asset is missing: ${relative}`);
        return null;
    }
    const data = fs.readFileSync(file);
    if (data.toString('ascii', 1, 4) !== 'PNG') {
        errors.push(`generated visual asset is not PNG: ${relative}`);
        return null;
    }
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), colorType: data[25] };
};

for (const [relative, expectedWidth, expectedHeight] of [
    ...Object.values(requiredThemeGraphics).map(relative => [relative, 32, 32]),
    ...Object.values(requiredDoorGraphics).map(relative => [relative, 32, 32]),
    ['assets/map/overlays/overlay_castle_carpet_fill_v001.png', 32, 32],
    ['assets/map/overlays/overlay_castle_carpet_edge_n_v001.png', 32, 4],
    ['assets/map/overlays/overlay_castle_carpet_edge_s_v001.png', 32, 4],
    ['assets/map/overlays/overlay_castle_carpet_edge_w_v001.png', 4, 32],
    ['assets/map/overlays/overlay_castle_carpet_edge_e_v001.png', 4, 32],
    ['assets/map/overlays/overlay_castle_carpet_corner_nw_v001.png', 4, 4],
    ['assets/map/overlays/overlay_castle_carpet_corner_ne_v001.png', 4, 4],
    ['assets/map/overlays/overlay_castle_carpet_corner_sw_v001.png', 4, 4],
    ['assets/map/overlays/overlay_castle_carpet_corner_se_v001.png', 4, 4],
    ['assets/map/overlays/overlay_castle_carpet_blue_silver_fill_v001.png', 32, 32],
    ['assets/map/overlays/overlay_castle_carpet_blue_silver_edge_n_v001.png', 32, 4],
    ['assets/map/overlays/overlay_castle_carpet_blue_silver_edge_s_v001.png', 32, 4],
    ['assets/map/overlays/overlay_castle_carpet_blue_silver_edge_w_v001.png', 4, 32],
    ['assets/map/overlays/overlay_castle_carpet_blue_silver_edge_e_v001.png', 4, 32],
    ['assets/map/overlays/overlay_castle_carpet_blue_silver_corner_nw_v001.png', 4, 4],
    ['assets/map/overlays/overlay_castle_carpet_blue_silver_corner_ne_v001.png', 4, 4],
    ['assets/map/overlays/overlay_castle_carpet_blue_silver_corner_sw_v001.png', 4, 4],
    ['assets/map/overlays/overlay_castle_carpet_blue_silver_corner_se_v001.png', 4, 4],
    ['assets/map/overlays/overlay_village_goza_fill_v001.png', 32, 32],
    ['assets/map/overlays/overlay_village_goza_edge_n_v001.png', 32, 3],
    ['assets/map/overlays/overlay_village_goza_edge_s_v001.png', 32, 3],
    ['assets/map/overlays/overlay_village_goza_edge_w_v001.png', 3, 32],
    ['assets/map/overlays/overlay_village_goza_edge_e_v001.png', 3, 32],
    ['assets/map/overlays/overlay_village_goza_corner_nw_v001.png', 3, 3],
    ['assets/map/overlays/overlay_village_goza_corner_ne_v001.png', 3, 3],
    ['assets/map/overlays/overlay_village_goza_corner_sw_v001.png', 3, 3],
    ['assets/map/overlays/overlay_village_goza_corner_se_v001.png', 3, 3],
    ['assets/map/overlays/overlay_world_grass_detail_v001.png', 64, 64],
    ['assets/map/overlays/overlay_world_grass_weeds_v001.png', 64, 64],
    ['assets/map/overlays/overlay_world_grass_earth_v001.png', 64, 64],
    ['assets/map/overlays/overlay_world_forest_understory_v001.png', 64, 64],
    ['assets/map/overlays/overlay_world_forest_roots_v001.png', 64, 64],
    ['assets/map/overlays/overlay_world_foothill_rocks_v001.png', 64, 64],
    ['assets/map/overlays/overlay_world_shore_foam_v001.png', 64, 32],
    ['assets/map/overlays/overlay_world_bridge_wood_v001.png', 64, 16],
    ['assets/effect/fx_phys_elemental_arc_v001.png', 384, 384],
    ...Object.values(requiredBattleFx).map(relative => [relative, 384, 384])
]) {
    const info = pngInfo(relative);
    if (!info) continue;
    if (info.width !== expectedWidth || info.height !== expectedHeight) errors.push(`unexpected generated asset size: ${relative}`);
    if (info.colorType !== 4 && info.colorType !== 6) errors.push(`generated asset has no alpha channel: ${relative}`);
}

for (const marker of [
    'drawGroundDecoration', 'stableHash', 'FLOOR_DECOR_THEME_CONFIG',
    'overlay_decor_thunder_fort_wiring', 'overlay_decor_seabed_temple_ripple',
    'drawConnectedFloorTextile', 'CONNECTED_TEXTILE_STYLES', "keyPrefix: 'overlay_castle_carpet'",
    'Connected carpets/mats are ground layers',
    'castle_carpet_blue_silver', 'village_goza', 'bleed: 2', 'height: TILE_SIZE + 2', 'tileY === startY', 'tileY === endY',
    'overlay_world_shore_foam', 'overlay_world_bridge_wood',
    "field.getCurrentAreaKey?.() === 'WORLD'", 'field.getTileEffectGraphicKey?.(tileX, tileY)'
]) {
    if (!phaser.includes(marker)) errors.push(`map decoration runtime marker is missing: ${marker}`);
}
if (phaser.includes('if (tileX !== Number(definition.x) || tileY !== Number(definition.y)) return true;')) {
    errors.push('connected textile is still rendered only at the top-left row depth');
}
for (const marker of [
    'powerTier(cmd)', 'effectProfile(cmd)', 'battle-fx-tier-', 'phys-elemental',
    'ranged-volley', 'appendEffectAccent', 'arcane-burst',
    'this.applyEffectProfile(node, profile)'
]) {
    if (!polish.includes(marker)) errors.push(`battle effect routing marker is missing: ${marker}`);
}
for (const marker of ['battle-fx-tier-1', 'battle-fx-tier-4', 'fx-profile-ring', 'fx-profile-flash', 'fx-pierce-lunge', 'fx-smash-impact', 'fx-breath-cone', 'fx-arcane-accent', 'fx-ultimate-ragnarok', 'fx-ultimate-prisma-end', 'fx-ultimate-big-bang', 'fx-ultimate-abyss-wall', 'fx-ultimate-phoenix-flare', 'fx-ultimate-genesis-magic', 'fx-ultimate-chaos-shock', 'fx-ultimate-illuminati-break', 'fx-ultimate-the-end', 'fx-ultimate-lost-prisma']) {
    if (!css.includes(marker)) errors.push(`battle effect tier CSS is missing: ${marker}`);
}

const expectedUltimateRoutes = {
    166: 'ultimate-ragnarok', 168: 'ultimate-prisma-end', 238: 'ultimate-big-bang',
    242: 'ultimate-abyss-wall', 243: 'ultimate-phoenix-flare', 244: 'ultimate-genesis-magic',
    245: 'ultimate-chaos-shock', 246: 'ultimate-illuminati-break', 247: 'ultimate-the-end',
    248: 'ultimate-lost-prisma'
};
for (const [id, key] of Object.entries(expectedUltimateRoutes)) {
    if (!polish.includes(`${id}: "${key}"`)) errors.push(`ultimate skill ${id} lacks its unique effect route`);
}

const worldMap = mapContext.window.MAP_DATA;
const bridges = mapContext.window.WORLD_BRIDGES || [];
const expectedBridges = new Set(['53,69', '78,58', '79,58']);
if (bridges.length !== expectedBridges.size) errors.push(`world bridge count must be exactly ${expectedBridges.size}: ${bridges.length}`);
for (const bridge of bridges) {
    const key = `${bridge.x},${bridge.y}`;
    if (!expectedBridges.has(key)) errors.push(`unexpected inferred world bridge remains: ${key}`);
    if (worldMap?.[bridge.y]?.[bridge.x] !== 'W') errors.push(`world bridge base tile is not water: ${key}`);
    const surface = mapContext.window.MapRegistry.getWorldSurfaceAt(bridge.x, bridge.y);
    if (!surface?.isBridge || surface?.isSea) errors.push(`world bridge is not classified as land surface: ${key}`);
}
const ordinarySea = worldMap.flatMap((row, y) => Array.from(row).map((tile, x) => ({ tile, x, y })))
    .find(cell => cell.tile === 'W' && !expectedBridges.has(`${cell.x},${cell.y}`));
if (!ordinarySea || !mapContext.window.MapRegistry.getWorldSurfaceAt(ordinarySea.x, ordinarySea.y)?.isSea) {
    errors.push('ordinary world water is not classified as sea surface');
}
if (!main.includes('worldSurface.isSea') || !main.includes("surface.isSea ? 0.04 : null")) {
    errors.push('world encounters do not share the bridge-aware surface classification');
}
if (!phaser.includes('getWorldBridgeAt?.(point.x, point.y)') || phaser.includes('waterNorthSouth') || phaser.includes('waterEastWest')) {
    errors.push('world bridges are not rendered from the explicit registry only');
}
if (!phaser.includes('], 23, 0.78, 24);')) errors.push('world grass decoration density must remain below half of the old 10% rate');
if (!phaser.includes('frequency: 40')) errors.push('map-theme floor decoration density must remain at or below 2.5%');
if (!mapContext.window.MapRegistry.getWorldTileConfig(2, 92)) errors.push('wrapped world point (2,2) does not resolve when drawn across the north seam');

const darkCastleFloor = mapContext.window.MapRegistry.getFixedDungeonFloor('DARK_CASTLE', 1);
const carpet = darkCastleFloor?.floorDecorations?.find(item => item?.type === 'castle_carpet');
if (!carpet || carpet.x !== 14 || carpet.y !== 19 || carpet.width !== 3 || carpet.height !== 7) {
    errors.push('Demon Castle 1F entrance carpet placement is missing or changed');
} else {
    for (let y = carpet.y; y < carpet.y + carpet.height; y += 1) {
        for (let x = carpet.x; x < carpet.x + carpet.width; x += 1) {
            if (!['T', 'G'].includes(darkCastleFloor.tiles?.[y]?.[x])) {
                errors.push(`Demon Castle carpet overlaps a blocked tile: ${x},${y}`);
            }
        }
    }
}

const supportedTypes = new Set(['通常攻撃', '物理', '魔法', 'ブレス', '回復', '蘇生', 'MP回復', '強化', '弱体', '特殊']);
for (const skill of skills) {
    if (!supportedTypes.has(String(skill.type || ''))) {
        errors.push(`skill ${skill.id} has an unrouted type: ${skill.type}`);
    }
    if (!skill.target) errors.push(`skill ${skill.id} has no target scope for visual routing`);
}

const startupKeys = assets.cacheWarmup?.initialGraphicKeys || [];
const critical = assets.cacheWarmup?.criticalImages || [];
for (const key of Object.keys(requiredGraphics)) {
    if (!startupKeys.includes(key)) errors.push(`pre-OP map decoration is not a startup graphic: ${key}`);
}
const criticalVisuals = [
    requiredThemeGraphics.overlay_decor_start_village_herbs,
    requiredThemeGraphics.overlay_decor_start_cave_damp,
    requiredGraphics.overlay_world_grass_detail,
    requiredGraphics.overlay_world_grass_weeds,
    requiredGraphics.overlay_world_grass_earth,
    requiredGraphics.overlay_world_forest_understory,
    requiredGraphics.overlay_world_forest_roots,
    requiredGraphics.overlay_world_foothill_rocks,
    requiredGraphics.overlay_world_shore_foam,
    battleFx['phys-elemental'],
    battleFx['neutral-slash']
];
for (const relative of criticalVisuals) {
    if (!critical.includes(relative)) errors.push(`generated pre-OP visual is not in critical cache: ${relative}`);
}

if (errors.length) {
    console.error(errors.map(error => `- ${error}`).join('\n'));
    process.exit(1);
}

const typeCount = new Set(skills.map(skill => skill.type)).size;
console.log(`Visual polish validation passed. Skills: ${skills.length}. Routed types: ${typeCount}. Registered generated assets: ${Object.keys(requiredGraphics).length + Object.keys(requiredBattleFx).length}. Explicit bridges: ${bridges.length}.`);
