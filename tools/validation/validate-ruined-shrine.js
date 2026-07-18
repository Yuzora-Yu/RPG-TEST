const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const assetContext = { console };
assetContext.window = assetContext;
assetContext.globalThis = assetContext;
vm.createContext(assetContext);
vm.runInContext(`${read('assets.js')}\nglobalThis.__ASSETS = PRISMA_ASSETS;`, assetContext, { filename: 'assets.js' });

const mapContext = { window: {}, console };
vm.createContext(mapContext);
vm.runInContext(read('map.js'), mapContext, { filename: 'map.js' });
vm.runInContext(read('maps_logic.js'), mapContext, { filename: 'maps_logic.js' });

const renderContext = { window: {} };
renderContext.globalThis = renderContext.window;
vm.createContext(renderContext);
vm.runInContext(read('map_render_shared.js'), renderContext, { filename: 'map_render_shared.js' });

const graphics = assetContext.__ASSETS.graphics;
const map = mapContext.window.FIXED_MAPS.RUINED_SHRINE;
const theme = mapContext.window.TILE_THEMES.RUINED_SHRINE;
const wallFace = mapContext.window.DUNGEON_WALL_FACE_THEMES.RUINED_SHRINE;
const decor = mapContext.window.MAP_FLOOR_DECOR_THEMES.RUINED_SHRINE;
const action = map.mapActions.find(entry => Number(entry.monsterId) === 902000);

assert(map.width === 19 && map.height === 19 && map.tiles.length === 19, 'Ruined Shrine v002 dimensions must be 19x19');
assert(map.tiles.every(row => row.length === map.width), 'Ruined Shrine has a malformed tile row');
assert(map.isDungeon === true, 'Ruined Shrine must explicitly opt into dungeon wall-face rendering');
assert(map.battleBg === 'battle_bg_dark_shrine', 'Ruined Shrine battle background is not assigned');

assert(map.tiles[0] === 'S'.repeat(map.width) && map.tiles[18] === 'S'.repeat(map.width), 'Outer north/south rows must be automatic exit grass');
for (let y = 1; y < map.height - 1; y += 1) {
    assert(map.tiles[y][0] === 'S' && map.tiles[y][1] === 'G', `West exit/grass boundary is wrong at row ${y}`);
    assert(map.tiles[y][17] === 'G' && map.tiles[y][18] === 'S', `East grass/exit boundary is wrong at row ${y}`);
}
assert(map.tiles[1] === `S${'G'.repeat(17)}S` && map.tiles[17] === `S${'G'.repeat(17)}S`, 'North/south walkable grass rows are missing');
for (const y of [2, 3]) {
    for (let x = 2; x <= 16; x += 1) assert(map.tiles[y][x] === 'W', `North double wall missing at ${x},${y}`);
}
for (const y of [15, 16]) {
    for (let x = 2; x <= 16; x += 1) {
        const expected = x === 9 ? 'T' : 'W';
        assert(map.tiles[y][x] === expected, `South double wall/entrance mismatch at ${x},${y}`);
    }
}
for (let y = 4; y <= 14; y += 1) {
    const expectedWest = y === 12 ? 'T' : 'W';
    const expectedEast = y === 8 ? 'T' : 'W';
    assert(map.tiles[y][2] === expectedWest && map.tiles[y][16] === expectedEast, `Authored side-wall shape changed at row ${y}`);
    for (let x = 3; x <= 15; x += 1) assert(map.tiles[y][x] === 'T', `Interior wall must be removed at ${x},${y}`);
}
assert(map.tiles[8][16] === 'T' && map.tiles[12][2] === 'T', 'Intentional ruined side-wall gaps are missing');

for (const tileKey of ['W', 'T', 'G', 'S']) {
    const keys = theme[tileKey].variants || [theme[tileKey].img];
    assert(keys.length === 4, `${tileKey} must use four deterministic ruined-shrine variants`);
    for (const key of keys) assert(graphics[key], `Unregistered Ruined Shrine tile graphic: ${key}`);
}
assert(theme.G.img === 'tile_ruined_shrine_withered_grass', 'Exterior G tile must use withered grass');
assert(theme.S.img === 'tile_ruined_shrine_withered_grass', 'Automatic exit S tile must look like withered grass');
assert(wallFace.img === 'tile_ruined_shrine_wall_face', 'Ruined Shrine wall-face base is missing');
assert(wallFace.accentImg === 'tile_ruined_shrine_wall_face_rooted', 'Ruined Shrine wall-face accent is missing');
assert(graphics[wallFace.img] && graphics[wallFace.accentImg], 'Ruined Shrine wall-face image is not registered');
const facePlan = renderContext.window.MapRenderShared.wallFacePlan({
    map,
    theme,
    x: 4,
    y: 3,
    upper: 'W',
    entityType: 'dungeon'
});
assert(facePlan?.key, 'Exposed north wall does not resolve a wall face');

assert(decor.disabled === true, 'Nonblocking random floor decoration must be disabled on the Ruined Shrine');

const stage = map.floorDecorations || [];
assert(stage.length === 6, 'Raised tablet stage must contain exactly six authored cells');
const stageCells = new Set(stage.map(entry => `${entry.x},${entry.y}`));
for (const id of ['8,4', '9,4', '10,4', '8,5', '9,5', '10,5']) assert(stageCells.has(id), `Raised stage cell missing at ${id}`);
stage.forEach(entry => assert(graphics[entry.imageKey], `Unregistered raised-stage graphic: ${entry.imageKey}`));

assert(action, 'Gilgamesh tablet action is missing');
assert(action.x === 9 && action.y === 4, 'Stone tablet must be centered on the raised stage');
assert(action.imageKey === 'maplib_ruins_ancient_tablet', 'The authored stone-tablet image is not placed');
assert(action.renderAsBlockingObject === true && action.interactFromAdjacent === true, 'Stone tablet must block movement and use adjacent interaction');
assert(action.requiredItemId === 98, 'Gilgamesh challenge must require item ID 98');
assert(action.type === 'boss' && action.special === true, 'Stone tablet no longer starts the special boss battle');
assert(graphics[action.imageKey], 'Stone tablet image is not registered');

const pillars = map.blockingObjects.filter(object => object.imageKey === 'overlay_ruined_shrine_pillar');
assert(pillars.length === 4, `Expected four corner pillars, got ${pillars.length}`);
const pillarCells = new Set(pillars.map(object => `${object.x},${object.y}`));
for (const id of ['4,5', '14,5', '4,13', '14,13']) assert(pillarCells.has(id), `Corner pillar missing at ${id}`);
assert(graphics.overlay_ruined_shrine_pillar, 'Ruined Shrine pillar image is not registered');

const expectedRitualKeys = [
    'maplib_dark_gargoyle_statue',
    'maplib_dark_sealed_obelisk',
    'maplib_ruins_ritual_brazier',
    'maplib_ruins_weathered_rune',
    'overlay_ruined_shrine_ritual_astrolabe'
];
for (const key of expectedRitualKeys) {
    assert(map.blockingObjects.some(object => object.imageKey === key), `Ritual object is not placed: ${key}`);
    assert(graphics[key], `Ritual object graphic is not registered: ${key}`);
}

const weaponKeys = [
    'overlay_ruined_shrine_rusted_sword',
    'overlay_ruined_shrine_rusted_spear',
    'overlay_ruined_shrine_rusted_axe'
];
const weapons = map.blockingObjects.filter(object => weaponKeys.includes(object.imageKey));
assert(weapons.length === 9, `Expected nine blocking rusted weapons, got ${weapons.length}`);
for (const key of weaponKeys) {
    assert(weapons.some(object => object.imageKey === key), `Rusted weapon type is not placed: ${key}`);
    assert(graphics[key], `Rusted weapon graphic is not registered: ${key}`);
}
assert(weapons.every(object => object.y >= 6 && object.y <= 12), 'Rusted weapons must stay away from the entrance rows');

assert(Array.isArray(map.chests) && map.chests.length === 2, 'Ruined Shrine must contain two authored pots');
const potItems = new Map(map.chests.map(chest => [`${chest.x},${chest.y}`, chest]));
assert(potItems.get('3,14')?.itemId === 4, 'Left pot must sit at the lower-left interior edge and contain Magic Holy Water (item 4)');
assert(potItems.get('15,14')?.itemId === 99, 'Right pot must sit at the lower-right interior edge and contain a Small Medal (item 99)');
for (const pot of map.chests) assert(pot.imageKey === 'overlay_field_pot', 'Authored pot must use the pot image override');
for (const pot of map.chests) assert(pot.containerKind === 'pot', 'Authored pot must declare containerKind=pot for object-specific interaction text');

const stageBlockers = new Set(map.blockingObjects.filter(object => !object.imageKey).map(object => `${object.x},${object.y}`));
for (const id of ['8,4', '10,4', '8,5', '10,5']) assert(stageBlockers.has(id), `Raised-stage side blocker missing at ${id}`);
assert(!stageBlockers.has('9,5'), 'Raised stage center stair must remain passable');

const blocked = new Set([
    ...map.blockingObjects.map(object => `${object.x},${object.y}`),
    ...map.chests.map(chest => `${chest.x},${chest.y}`),
    `${action.x},${action.y}`,
]);
const passable = new Set(['T', 'G', 'S']);
const queue = [[map.entryPoint.x, map.entryPoint.y]];
const visited = new Set([`${map.entryPoint.x},${map.entryPoint.y}`]);
while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;
        const id = `${nx},${ny}`;
        if (visited.has(id) || blocked.has(id) || nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        if (!passable.has(map.tiles[ny][nx])) continue;
        visited.add(id);
        queue.push([nx, ny]);
    }
}
assert(visited.has('9,16') && visited.has('9,15'), 'Shrine entrance route is blocked');
assert(visited.has('9,17') && visited.has('9,18'), 'Walkable grass margin or automatic-exit perimeter is unreachable');
assert(visited.has('9,5'), 'The center stair does not reach the tablet interaction cell');
assert(!visited.has('8,5') && !visited.has('10,5'), 'Raised stage can be entered from a side cell');

const facilities = read('facilities.js');
assert(!facilities.includes('challengeSpecialBoss'), 'Gilgamesh challenge still exists in the medal exchange facility');
assert(!facilities.includes('fixedBossId: 902000'), 'Medal exchange still starts Gilgamesh directly');
const main = read('main.js');
assert(main.includes("isDungeon: FIXED_MAPS[areaKey].isDungeon === true"), 'Fixed-map loading still discards explicit dungeon rendering');
assert(main.includes("isDungeon: areaDef.isDungeon === true"), 'Direct fixed-map entry still discards explicit dungeon rendering');
assert(main.includes('action.requiredItemId !== undefined'), 'Map action item requirement handling is missing');
assert(main.includes('const sourceX = Math.max(0, Math.min(mapW - 1'), 'Out-of-bounds drawing must extend the nearest edge tile');
assert(main.includes('variantX = Math.max(0, Math.min(mapW - 1, variantX))'), 'Out-of-bounds terrain must select the same variant as the nearest edge cell');
assert(main.includes("upper === 'S' && Field.currentMapData?.autoExitOnPerimeter === true"), 'Automatic perimeter exits must render through the ordinary grass terrain layer');
assert(main.includes("upper: 'G',\n                baseTile: 'G'"), 'Automatic perimeter exits still render as raised S objects');
assert(map.hideFloorLabel === true, 'Ruined Shrine must suppress the meaningless floor-zero label');
assert(map.disableRandomEncounters === true, 'Ruined Shrine must not spawn random enemies');
assert(map.autoExitOnPerimeter === true, 'Ruined Shrine outer ring must auto-exit on contact');
assert(map.perimeterExitMiniMapColor === '#766746', 'Perimeter exit tile must use the authored withered-grass minimap color');
assert(main.includes("upper === 'S' && Field.currentMapData?.autoExitOnPerimeter === true) return null"), 'Perimeter exits must not draw repeated minimap markers');
assert(main.includes("return Field.currentMapData.perimeterExitMiniMapColor || '#766746'"), 'Perimeter exits must override the minimap base-tile color');
const dungeon = read('dungeon.js');
assert(dungeon.includes('Dungeon.isFixedExitStepTile(upper, link)'), 'Perimeter auto-exit runtime is missing');
assert(dungeon.includes('Field.currentMapData?.disableRandomEncounters === true'), 'No-encounter runtime guard is missing');

console.log(`Ruined Shrine v002 validation passed: ${visited.size} reachable cells, walkable grass margins, double walls, extended edge terrain, subdued auto-exit ring, no encounters, raised stage, ritual props, blocking weapons and two item pots.`);
