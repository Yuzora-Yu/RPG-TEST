const fs = require('fs');
const path = require('path');
const { loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assetsSource = read('assets.js');
const mapSource = read('map.js');
const dungeonSource = read('dungeon.js');
const phaserFieldSource = read('phaser-field.js');
const mainSource = read('main.js');
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

const graphicsStart = assetsSource.indexOf('  graphics: {');
const graphicsEnd = assetsSource.indexOf('\n  },\n\n  // polish.js', graphicsStart);
if (graphicsStart < 0 || graphicsEnd < 0) {
    throw new Error('Unable to locate PRISMA_ASSETS.graphics.');
}

const graphicsSection = assetsSource.slice(graphicsStart, graphicsEnd);
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
    'battle_bg_forest',
    'battle_bg_big_tower',
    'battle_bg_thunder_fort',
    'battle_bg_light_palace',
    'battle_bg_dark_castle',
    'battle_bg_crena',
    'battle_bg_seabed',
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
    graphics.get('tile_forbidden_forest_wall') !== 'assets/map/terrain/tile_forbidden_forest_wall_v001.png' ||
    graphics.get('tile_forbidden_forest_floor') !== 'assets/map/terrain/tile_forbidden_forest_floor_v001.png') {
    throw new Error('Forbidden Forest must use its generated floor and dense forest wall tiles.');
}
if (context.TILE_THEMES?.WIND_HOLE?.W?.img !== 'tile_wind_hole_wall' ||
    context.TILE_THEMES?.WIND_HOLE?.T?.img !== 'tile_wind_hole_floor' ||
    graphics.get('tile_wind_hole_wall') !== 'assets/map/terrain/tile_wind_hole_wall_v001.png' ||
    graphics.get('tile_wind_hole_floor') !== 'assets/map/terrain/tile_wind_hole_floor_v001.png') {
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
if (!mainSource.includes('base?.variants') || !mainSource.includes('Math.imul(x, 374761393)')) {
    throw new Error('Coordinate-stable terrain variation selection is missing.');
}
if (graphics.get('battle_bg_wind_hole') !== 'assets/generated/battle-forest-wind-hole-v001.png' ||
    !/FOREST_WIND_HOLE:\s*\{[\s\S]*?battleBg:\s*"battle_bg_wind_hole"/.test(mapSource)) {
    throw new Error('Forest Wind Hole must use its generated battle background.');
}
if (graphics.get('battle_bg_forest') !== 'assets/generated/battle-forbidden-forest-v001.png') {
    throw new Error('Forbidden Forest must use its generated battle background.');
}

const randomThemeBackgrounds = collectValues(dungeonSource, /\bbattleBg:\s*'(battle_bg_[^']+)'/g);
for (const key of requiredBackgrounds) {
    if (!randomThemeBackgrounds.has(key)) {
        throw new Error(`Random dungeon theme does not include background: ${key}`);
    }
}

console.log(`Visual asset validation passed. Graphics checked: ${graphics.size}.`);
console.log(`Dungeon hunter variants assigned: ${hunterKeys.size}.`);
console.log(`Random dungeon battle themes checked: ${randomThemeBackgrounds.size}.`);
console.log(`Fixed boss map sprites checked: ${fixedBossIds.size}.`);
