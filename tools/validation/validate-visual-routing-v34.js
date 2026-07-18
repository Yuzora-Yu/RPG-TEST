const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadMapRuntime, loadStoryRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const { context: map } = loadMapRuntime(root);
const { context: story } = loadStoryRuntime(root);

const assetsContext = { console };
assetsContext.window = assetsContext;
assetsContext.globalThis = assetsContext;
vm.createContext(assetsContext);
vm.runInContext(read('assets.js'), assetsContext, { filename: 'assets.js' });
const graphics = assetsContext.PRISMA_ASSETS.graphics;
const cached = new Set(assetsContext.PRISMA_ASSETS.cacheWarmup.installImages || []);

const expectedGraphics = new Map([
    ['tile_wind_temple_wall', 'assets/map/terrain/tile_wind_temple_wall_v001.png'],
    ['tile_wind_temple_floor', 'assets/map/terrain/tile_wind_temple_floor_v001.png'],
    ['battle_bg_wind_temple', 'assets/generated/battle-wind-temple-v001.png'],
    ['battle_bg_mountain_wind_ruins', 'assets/generated/battle-mountain-wind-ruins-v001.png'],
    ['battle_bg_trial_shrine', 'assets/generated/battle-trial-shrine-v001.png'],
    ['battle_bg_summit_temple', 'assets/generated/battle-summit-temple-v001.png'],
    ['battle_bg_sea', 'assets/generated/battle-sea-v002.png'],
    ['battle_bg_field_forest', 'assets/generated/battle-forest-ai.png'],
    ['battle_bg_abyss_boss', 'assets/generated/battle-abyss-boss-v001.png'],
    ['battle_bg_abyss_floor_200', 'assets/generated/battle-abyss-floor-200-v001.png'],
    ['battle_bg_first', 'assets/generated/first-battle.png']
]);
for (const [key, relative] of expectedGraphics) {
    if (graphics[key] !== relative) throw new Error(`Visual registration mismatch: ${key} -> ${graphics[key]}`);
    if (!fs.existsSync(path.join(root, relative))) throw new Error(`Visual asset is missing: ${relative}`);
    if (!cached.has(relative)) throw new Error(`Visual asset is missing from the full cache: ${relative}`);
}

const windTemple = map.FIXED_DUNGEON_MAPS.WIND_TEMPLE;
if (windTemple.themeKey !== 'WIND_TEMPLE' || windTemple.battleBg !== 'battle_bg_wind_temple') {
    throw new Error('Wind Temple does not use its dedicated indoor visual set.');
}
for (const [index, floor] of windTemple.floors.entries()) {
    if (floor.themeKey !== 'WIND_TEMPLE') throw new Error(`Wind Temple F${index + 1} overrides its dedicated theme.`);
}
if (map.TILE_THEMES.WIND_TEMPLE.W.img !== 'tile_wind_temple_wall' ||
    map.TILE_THEMES.WIND_TEMPLE.T.img !== 'tile_wind_temple_floor') {
    throw new Error('Wind Temple floor/wall theme is incomplete.');
}
if (map.FIXED_MAPS.TRIAL_ISLAND.battleBg !== 'battle_bg_trial_shrine' ||
    map.FIXED_MAPS.SUMMIT_TEMPLE.battleBg !== 'battle_bg_summit_temple') {
    throw new Error('The two trial facilities do not use their dedicated battle backgrounds.');
}
if (map.FIXED_MAPS.START_VILLAGE.battleBg !== 'battle_bg_field' ||
    map.FIXED_MAPS.WIND_VILLAGE.battleBg !== 'battle_bg_field') {
    throw new Error('A town background was accidentally overwritten while assigning the ruin background.');
}

const volcanoF3 = map.FIXED_DUNGEON_MAPS.IGNIS_VOLCANO.floors[2];
const deepLink = volcanoF3.floorLinks.find(link => Number(link.x) === 10 && Number(link.y) === 1 && Number(link.toFloor) === 4);
if (!deepLink || volcanoF3.tiles[1][10] !== 'S') {
    throw new Error('Ignis Volcano F3 deep-floor stairs are absent from the authored tile and floor-link data.');
}

for (const eventId of ['game_start', 'game_start_retry']) {
    const boss = story.STORY_MANAGER_DATA.events[eventId].actions.find(action => action.type === 'BOSS');
    if (boss?.battleBg !== 'battle_bg_first') throw new Error(`${eventId} does not explicitly select first-battle.png.`);
}
const mainSource = read('main.js');
for (const marker of [
    'if (battleData.battleBg) return battleData.battleBg;',
    "if (isAbyssBoss && currentFloor === 200) return 'battle_bg_abyss_floor_200';",
    "if (isAbyssBoss) return 'battle_bg_abyss_boss';",
    "if (battleData.encounterType === 'sea') return 'battle_bg_sea';",
    "if (tile === 'F') return 'battle_bg_field_forest';"
]) {
    if (!mainSource.includes(marker)) throw new Error(`Battle background routing marker is missing: ${marker}`);
}

console.log('Visual routing v35 validation passed: Wind Temple, ruins, ship, world forest, Abyss bosses, first battle, and Volcano F3.');
