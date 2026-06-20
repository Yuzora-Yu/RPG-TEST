const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assetsSource = read('assets.js');
const mapSource = read('map.js');
const dungeonSource = read('dungeon.js');

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
for (const line of mapSource.split(/\r?\n/)) {
    if (!line.includes('"hunter"') || !line.includes('imageKey')) continue;
    const imageKey = line.match(/imageKey"?\s*:\s*"([^"]+)"/);
    if (imageKey) hunterKeys.add(imageKey[1]);
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
for (const key of requiredBackgrounds) {
    if (!graphics.has(key)) throw new Error(`Required battle background is missing: ${key}`);
}

if (!/FORBIDDEN_FOREST:\s*\{[\s\S]*?tileOverrides:\s*\{[\s\S]*?W:\s*tileEntry\("tile_forest_wall"/.test(mapSource)) {
    throw new Error('Forbidden Forest wall must use the generated dense forest wall tile.');
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
