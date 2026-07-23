const fs = require('fs');
const path = require('path');
const { loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assetsSource = read('assets.js');
const mapSource = read('map.js');
const dungeonSource = read('dungeon.js');
const phaserFieldSource = read('phaser-field.js');
const mainSource = read('main.js');
const sharedRenderSource = read('map_render_shared.js');
const { context } = loadMapRuntime(root);

if (/water\.y\s*=|waterBaseY/.test(phaserFieldSource)) {
    throw new Error('Water animation must not move the tile image or expose the terrain below it.');
}
for (const marker of ['isAnimatedWaterTile', 'waveA.x', 'water.image.setAlpha(1)']) {
    if (!phaserFieldSource.includes(marker)) {
        throw new Error(`Fixed-tile water ripple marker is missing: ${marker}`);
    }
}
if (!phaserFieldSource.includes("!field.currentMapData?.isDungeon || characterOverlay")) {
    throw new Error('Dungeon prop overlays must not receive artificial ellipse shadows.');
}

function findObjectSection(source, propertyMarker) {
    const markerStart = source.indexOf(propertyMarker);
    if (markerStart < 0) return null;
    const openingBrace = source.indexOf('{', markerStart + propertyMarker.length);
    if (openingBrace < 0) return null;

    let depth = 0;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    for (let index = openingBrace; index < source.length; index += 1) {
        const char = source[index];
        const next = source[index + 1];

        if (lineComment) {
            if (char === '\n') lineComment = false;
            continue;
        }
        if (blockComment) {
            if (char === '*' && next === '/') {
                blockComment = false;
                index += 1;
            }
            continue;
        }
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === '/' && next === '/') {
            lineComment = true;
            index += 1;
            continue;
        }
        if (char === '/' && next === '*') {
            blockComment = true;
            index += 1;
            continue;
        }
        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(markerStart, index + 1);
        }
    }
    return null;
}

const graphicsSection = findObjectSection(assetsSource, '  graphics:');
if (!graphicsSection) {
    throw new Error('Unable to locate PRISMA_ASSETS.graphics.');
}
const graphics = new Map();
const graphicPattern = /^\s*([A-Za-z0-9_]+):\s*"([^"]+)"/gm;
let match;
while ((match = graphicPattern.exec(graphicsSection))) {
    graphics.set(match[1], match[2]);
}
const missingFiles = [];
for (const [key, relativePath] of graphics) {
    if (!relativePath.startsWith('assets/')) continue;
    if (!fs.existsSync(path.join(root, relativePath))) {
        missingFiles.push(`${key} -> ${relativePath}`);
    }
}
if (missingFiles.length) {
    throw new Error(`Missing graphic files:\n${missingFiles.join('\n')}`);
}
if (assetsSource.includes('assets/monsters/library') || assetsSource.includes('monsterlib_')) {
    throw new Error('Obsolete runtime monster library reference remains in assets.js.');
}

function collectValues(source, pattern) {
    const values = new Set();
    let found;
    while ((found = pattern.exec(source))) values.add(found[1]);
    return values;
}

const referencedKeys = new Set([
    ...collectValues(mapSource, /\b(?:img|imageKey|battleBg):\s*"([^"]+)"/g),
    ...collectValues(dungeonSource, /\b(?:themeKey|battleBg):\s*'([^']+)'/g)
]);

const missingKeys = [...referencedKeys]
    .filter(key => (
        key.startsWith('battle_bg_') ||
        key.startsWith('overlay_') ||
        key.startsWith('tile_')
    ))
    .filter(key => !graphics.has(key));
if (missingKeys.length) {
    throw new Error(`Visual keys missing from assets.js:\n${missingKeys.join('\n')}`);
}

const hunterKeys = new Set();
for (const dungeon of Object.values(context.FIXED_DUNGEON_MAPS || {})) {
    const floors = Array.isArray(dungeon.floors) && dungeon.floors.length ? dungeon.floors : [dungeon];
    for (const floor of floors) {
        for (const effect of floor.tileEffects || []) {
            if (effect?.type === 'hunter' && effect.imageKey) hunterKeys.add(effect.imageKey);
        }
    }
}
const requiredHunterKeys = [
    'overlay_dungeon_hunter_fire',
    'overlay_dungeon_hunter_forest',
    'overlay_dungeon_hunter_sea',
    'overlay_dungeon_hunter_thunder',
    'overlay_dungeon_hunter_shadow'
];
for (const key of requiredHunterKeys) {
    if (!hunterKeys.has(key)) throw new Error(`Hunter graphic is not assigned in map.js: ${key}`);
}

const requiredBackgrounds = [
    'battle_bg_dungeon',
    'battle_bg_forest',
    'battle_bg_fire',
    'battle_bg_big_tower',
    'battle_bg_thunder_fort',
    'battle_bg_light_palace',
    'battle_bg_dark_castle',
    'battle_bg_crena',
    'battle_bg_seabed',
    'battle_bg_flooded',
    'battle_bg_dark_shrine',
    'battle_bg_galvania_cave',
    'battle_bg_grezelia'
];
const requiredRandomBackgrounds = [
    'battle_bg_dungeon',
    'battle_bg_forest',
    'battle_bg_fire',
    'battle_bg_thunder_fort',
    'battle_bg_seabed',
    'battle_bg_big_tower',
    'battle_bg_light_palace',
    'battle_bg_dark_castle',
    'battle_bg_galvania_cave',
    'battle_bg_wind_hole',
    'battle_bg_crena',
    'battle_bg_dark_shrine',
    'battle_bg_grezelia'
];
for (const key of ['overlay_dungeon_chest_empty', 'overlay_dungeon_chest_rare_empty']) {
    if (!graphics.has(key)) throw new Error(`Opened fixed chest graphic is missing: ${key}`);
}
for (const key of requiredBackgrounds) {
    if (!graphics.has(key)) throw new Error(`Required battle background is missing: ${key}`);
}

const fixedBossIds = collectValues(mapSource, /\bmonsterId"?\s*:\s*(?:\[\s*)?(\d+)/g);
const missingBossSprites = [...fixedBossIds]
    .map(Number)
    .filter(id => id >= 100000)
    .filter(id => !graphics.has(`monster_${id}`) && !graphics.has(`overlay_boss_${id}`) && !fs.existsSync(path.join(root, `assets/monsters/monster_${id}.png`)));
if (missingBossSprites.length) {
    throw new Error(`Fixed bosses missing map sprites:\n${missingBossSprites.join('\n')}`);
}

if (context.TILE_THEMES?.FORBIDDEN_FOREST?.W?.img !== 'tile_forbidden_forest_wall' ||
    context.TILE_THEMES?.FORBIDDEN_FOREST?.T?.img !== 'tile_forbidden_forest_floor' ||
    graphics.get('tile_forbidden_forest_wall') !== 'assets/map/terrain/tile_forbidden_forest_wall.png' ||
    graphics.get('tile_forbidden_forest_floor') !== 'assets/map/terrain/tile_forbidden_forest_floor.png') {
    throw new Error('Forbidden Forest must use its generated floor and dense forest wall tiles.');
}
if (context.TILE_THEMES?.WIND_HOLE?.W?.img !== 'tile_wind_hole_wall' ||
    context.TILE_THEMES?.WIND_HOLE?.T?.img !== 'tile_wind_hole_floor' ||
    graphics.get('tile_wind_hole_wall') !== 'assets/map/terrain/tile_wind_hole_wall.png' ||
    graphics.get('tile_wind_hole_floor') !== 'assets/map/terrain/tile_wind_hole_floor.png') {
    throw new Error('Forest Wind Hole must use its generated floor and wall tiles.');
}
for (const stem of [
    'tile_wind_hole_wall', 'tile_wind_hole_floor',
    'tile_forbidden_forest_wall', 'tile_forbidden_forest_floor',
    'tile_thunder_wall', 'tile_thunder_floor',
    'tile_dark_wall', 'tile_dark_floor',
    'tile_seabed_floor',
    'tile_dark_shrine_wall', 'tile_dark_shrine_floor',
    'tile_grezelia_wall', 'tile_grezelia_floor'
]) {
    for (let index = 2; index <= 4; index++) {
        if (!graphics.has(`${stem}_${index}`)) throw new Error(`Terrain variation is missing: ${stem}_${index}`);
    }
}
if (!mainSource.includes('window.MapRenderShared.resolveTileVariant(base, variantX, variantY)') || !sharedRenderSource.includes('Math.imul(x, 374761393)')) {
    throw new Error('Coordinate-stable terrain variation selection is missing.');
}
if (graphics.get('battle_bg_wind_hole') !== 'assets/generated/battle-forest-wind-hole.png' ||
    !/FOREST_WIND_HOLE:\s*\{[\s\S]*?battleBg:\s*"battle_bg_wind_hole"/.test(mapSource)) {
    throw new Error('Forest Wind Hole must use its generated battle background.');
}
if (graphics.get('battle_bg_forest') !== 'assets/generated/battle-forbidden-forest.png') {
    throw new Error('Forbidden Forest must use its generated battle background.');
}

const randomThemeBackgrounds = collectValues(dungeonSource, /\bbattleBg:\s*'(battle_bg_[^']+)'/g);
for (const key of requiredRandomBackgrounds) {
    if (!randomThemeBackgrounds.has(key)) {
        throw new Error(`Random dungeon theme does not include background: ${key}`);
    }
}

const expectedThemeThresholds = new Map([
    ['abyss', 1],
    ['forbidden-forest', 11],
    ['thunder-fort', 21],
    ['seabed-temple', 41],
    ['ignis-volcano', 51],
    ['great-lighthouse', 61],
    ['light-palace', 71],
    ['dark-castle', 81],
    ['galvania-cave', 81],
    ['forest-wind-hole', 81],
    ['crena-cave', 81],
    ['dark-shrine', 81],
    ['grezelia', 81]
]);
for (const [id, minFloor] of expectedThemeThresholds) {
    const pattern = new RegExp(`id:\\s*'${id}'[\\s\\S]*?minFloor:\\s*${minFloor}\\b`);
    if (!pattern.test(dungeonSource)) throw new Error(`Random dungeon theme threshold is missing or incorrect: ${id} -> ${minFloor}`);
}
if (!dungeonSource.includes('ensureRandomVisualTheme:') || !dungeonSource.includes('visualBattleBg = theme.battleBg')) {
    throw new Error('Random dungeon saved themes are not repaired as a map/background pair.');
}

const expectedThemeKeys = [
    'ABYSS', 'FORBIDDEN_FOREST', 'THUNDER_FORT', 'SEABED_TEMPLE', 'FIRE_VILLAGE',
    'BIG_TOWER', 'LIGHT_PALACE', 'DARK_CASTLE', 'GALVANIA_CAVE', 'WIND_HOLE',
    'CRENA_CAVE', 'DARK_SHRINE_RUINS', 'GREZELIA_CAVE'
];
for (const themeKey of expectedThemeKeys) {
    const theme = context.TILE_THEMES?.[themeKey];
    if (!theme?.W?.img || !theme?.T?.img) throw new Error(`Random dungeon map-chip theme is incomplete: ${themeKey}`);
    if (themeKey !== 'ABYSS' && theme.W.img === context.TILE_THEMES.DEFAULT.W.img && theme.T.img === context.TILE_THEMES.DEFAULT.T.img) {
        throw new Error(`Random dungeon theme is visually identical to the default: ${themeKey}`);
    }
}
const wallRegistry = context.DUNGEON_WALL_FACE_THEMES || {};
const fixedDungeonThemeKeys = new Set();
for (const [areaKey, dungeon] of Object.entries(context.FIXED_DUNGEON_MAPS || {})) {
    const floorCount = Math.max(1, dungeon.floors?.length || 1);
    for (let floor = 1; floor <= floorCount; floor += 1) {
        const def = context.MapRegistry.getFixedDungeonFloor(areaKey, floor);
        fixedDungeonThemeKeys.add(def.themeKey || areaKey);
    }
}
for (const themeKey of new Set([...expectedThemeKeys, ...fixedDungeonThemeKeys])) {
    const tileTheme = context.TILE_THEMES?.[themeKey] || context.TILE_THEMES?.DEFAULT;
    const wallDef = wallRegistry[themeKey];
    if (!wallDef) throw new Error(`Dungeon wall-face registry is missing theme: ${themeKey}`);
    const waterSurface = tileTheme?.W?.lowerLayer === true || tileTheme?.W?.animatedWater === true;
    if (waterSurface) {
        if (wallDef.disabled !== true) throw new Error(`Water-surface W theme must disable wall faces: ${themeKey}`);
        continue;
    }
    if (wallDef.disabled === true) {
        if (wallDef.reason !== 'theme-wall-variants' || !Array.isArray(tileTheme?.W?.variants) || tileTheme.W.variants.length < 2) {
            throw new Error(`Solid dungeon theme disables wall faces without preserved W variants: ${themeKey}`);
        }
        continue;
    }
    if (!wallDef.img || !graphics.has(wallDef.img)) throw new Error(`Solid dungeon theme has no registered wall-face asset: ${themeKey}`);
    if (wallDef.accentImg && !graphics.has(wallDef.accentImg)) throw new Error(`Dungeon wall-face accent is not registered: ${themeKey} -> ${wallDef.accentImg}`);
}
for (let floor = 1; floor <= context.FIXED_DUNGEON_MAPS.GALVANIA_CAVE.floors.length; floor += 1) {
    if (context.MapRegistry.getFixedDungeonFloor('GALVANIA_CAVE', floor).themeKey !== 'GALVANIA_CAVE') {
        throw new Error(`Galvania fixed floor ${floor} overrides its dedicated tile and wall theme.`);
    }
}
if (context.TILE_THEMES?.DEFAULT?.['~']?.animatedWater !== true || context.TILE_THEMES?.DEFAULT?.['~']?.lowerLayer !== true) {
    throw new Error('Flooded random-dungeon water tile must be animated and rendered as a lower layer.');
}
for (const marker of [
    'lava: 0.10', 'flooded: 0.10', 'maze: 0.03', 'treasure: 0.02', 'abyss: 0.25', 'random: 0.50',
    "floodedTile: '~'", 'rollRandomFloorPlan:', 'applyFloodedFloorIfNeeded:',
    'Dungeon.applyRandomFloorPlan(floorPlan);\n                Dungeon.generateFallbackRandomFloor(floorPlan);'
]) {
    if (!dungeonSource.includes(marker)) throw new Error(`Random dungeon flooded/fallback integrity marker is missing: ${marker}`);
}

console.log(`Visual asset validation passed. Graphics checked: ${graphics.size}.`);
console.log(`Dungeon hunter variants assigned: ${hunterKeys.size}.`);
console.log(`Random dungeon battle themes checked: ${randomThemeBackgrounds.size}.`);
console.log(`Fixed boss map sprites checked: ${fixedBossIds.size}.`);
