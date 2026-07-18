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
const map = mapContext.window.FIXED_MAPS.TRIAL_ISLAND;
const theme = mapContext.window.TILE_THEMES.TRIAL_SHRINE;
const wallFace = mapContext.window.DUNGEON_WALL_FACE_THEMES.TRIAL_SHRINE;
const decor = mapContext.window.MAP_FLOOR_DECOR_THEMES.TRIAL_SHRINE;
const graphics = assetContext.__ASSETS.graphics;

assert(map.width === 25 && map.height === 21, 'Trial Island must use the expanded 25x21 shrine layout');
assert(map.tiles.length === map.height && map.tiles.every(row => row.length === map.width), 'Trial Island has a malformed tile row');
assert(map.isDungeon === false && map.useDungeonWallFace === true && map.hideFloorLabel === true,
    'Trial Island must be a normal facility that explicitly opts into wall-face rendering');
assert(map.disableRandomEncounters === true, 'Trial Island must remain encounter-free');
assert(map.battleBg === 'battle_bg_trial_shrine', 'Trial Island does not use its dedicated battle background');
assert(map.autoExitOnPerimeter === true, 'Trial Island perimeter must exit on contact');
for (let x = 0; x < map.width; x += 1) {
    assert(map.tiles[0][x] === 'S' && map.tiles[map.height - 1][x] === 'S', `Trial Island top/bottom perimeter is not an exit at x=${x}`);
}
for (let y = 0; y < map.height; y += 1) {
    assert(map.tiles[y][0] === 'S' && map.tiles[y][map.width - 1] === 'S', `Trial Island side perimeter is not an exit at y=${y}`);
}
assert(map.themeKey === 'TRIAL_SHRINE', 'Trial Island is not using its authored visual theme');
assert(theme.G.img === 'floor' && theme.S.img === 'floor', 'Exterior must use ordinary grassland terrain');
assert(theme.T.variants?.length === 2, 'Shrine floor must expose exactly two authored variants');
for (const key of [theme.W.img, ...theme.T.variants, wallFace.img]) {
    assert(graphics[key], `Missing registered shrine graphic: ${key}`);
    assert(fs.existsSync(path.join(root, graphics[key])), `Missing shrine asset file: ${graphics[key]}`);
}
assert(decor.disabled === true, 'Trial Island must not receive random generic floor decorations');

const stage = map.floorDecorations || [];
assert(stage.length === 15, 'The 5x3 raised stage must contain exactly 15 rendered cells');
for (let y = 3; y <= 5; y += 1) {
    for (let x = 10; x <= 14; x += 1) {
        const cell = stage.find(entry => entry.x === x && entry.y === y);
        assert(cell, `Raised stage cell missing at ${x},${y}`);
        assert(graphics[cell.imageKey], `Unregistered raised-stage graphic: ${cell.imageKey}`);
    }
}
for (const [x, y] of [[9, 3], [15, 3], [9, 4], [15, 4], [9, 5], [15, 5], [12, 2]]) {
    assert(map.tiles[y][x] === 'W', `Stage side/top is not sealed at ${x},${y}`);
}
for (let x = 10; x <= 14; x += 1) assert(map.tiles[6][x] === 'T', `A wall remains behind the A-Un approach at ${x},6`);

const action = map.mapActions?.find(entry => entry.type === 'limitBreakTrial' && entry.trialType === 'mid');
assert(action?.x === 12 && action?.y === 3, 'The middle limit-break trial event must sit at the upper edge of the stage');

const statues = map.blockingObjects || [];
const movementRegion = map.movementRegions?.find(entry => entry.id === 'raised-stage');
assert(movementRegion?.x === 10 && movementRegion?.y === 3 && movementRegion?.width === 5 && movementRegion?.height === 3,
    'Raised stage movement region is missing or malformed');
assert(JSON.stringify(movementRegion.gateways) === JSON.stringify([{ inside: { x: 12, y: 5 }, outside: { x: 12, y: 6 } }]),
    'Raised stage must only connect through its lower-center gateway');
for (let y = 3; y <= 5; y += 1) for (let x = 10; x <= 14; x += 1) {
    assert(!statues.some(entry => entry.x === x && entry.y === y), `Stage walkable cell is blocked at ${x},${y}`);
}
const statueA = statues.find(entry => entry.imageKey === 'overlay_trial_shrine_statue_a');
const statueUn = statues.find(entry => entry.imageKey === 'overlay_trial_shrine_statue_un');
assert(statueA?.x === 10 && statueA?.y === 7, 'A guardian statue is missing from the left approach');
assert(statueUn?.x === 14 && statueUn?.y === 7, 'Un guardian statue is missing from the right approach');
assert(graphics[statueA.imageKey] && graphics[statueUn.imageKey], 'A-Un statue assets are not registered');

assert(map.healSprings?.some(entry => entry.x === 6 && entry.y === 13
    && entry.imageKey === 'overlay_shrine_healing_spring' && entry.shimmer === true),
    'Left recovery room has no animated authored healing spring');
const chests = map.chests || [];
const pot = chests.find(entry => entry.containerKind === 'pot');
assert(pot?.x === 2 && pot?.y === 1 && pot?.itemId === 99 && pot?.baseTile === 'G', 'Upper-left exterior pot must contain a Small Medal on grass');
assert(chests.some(entry => entry.x === 19 && entry.y === 11 && entry.itemId === 1051), 'Treasure room is missing 剛力の戦香');
assert(chests.some(entry => entry.x === 19 && entry.y === 13 && entry.itemId === 1004), 'Treasure room is missing 鳳凰の火筒');
assert(chests.some(entry => entry.x === 19 && entry.y === 15 && entry.trapMonsterId === 120301 && entry.trapFloor === 70), 'Treasure room is missing the rank-70 mimic trap');

const blocked = new Set([
    ...statues.map(entry => `${entry.x},${entry.y}`),
    ...chests.map(entry => `${entry.x},${entry.y}`),
]);
const passable = new Set(['T', 'G', 'S']);
const boundaryBlocked = (fromX, fromY, toX, toY) => {
    const inside = (x, y) => x >= 10 && x <= 14 && y >= 3 && y <= 5;
    if (inside(fromX, fromY) === inside(toX, toY)) return false;
    return !((fromX === 12 && fromY === 5 && toX === 12 && toY === 6)
        || (fromX === 12 && fromY === 6 && toX === 12 && toY === 5));
};
const start = map.entryPoint;
const queue = [[start.x, start.y]];
const visited = new Set([`${start.x},${start.y}`]);
while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;
        const id = `${nx},${ny}`;
        if (visited.has(id) || blocked.has(id) || boundaryBlocked(x, y, nx, ny) || nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        if (!passable.has(map.tiles[ny][nx])) continue;
        visited.add(id);
        queue.push([nx, ny]);
    }
}
for (const [label, point] of [
    ['healing spring', [6, 13]],
    ['stage event', [12, 3]],
    ['treasure-room chest approach', [18, 15]],
    ['exit', [12, 20]],
    ['exterior pot approach', [2, 2]],
]) assert(visited.has(`${point[0]},${point[1]}`), `Unreachable ${label} at ${point.join(',')}`);
assert(read('main.js').includes('isMovementRegionCrossingBlocked: (fromX, fromY, toX, toY) =>'),
    'Field movement does not enforce authored stage boundaries');

const monsterContext = { console };
monsterContext.window = monsterContext;
vm.createContext(monsterContext);
vm.runInContext(read('monsters.js'), monsterContext, { filename: 'monsters.js' });
for (const id of [120301, 120302, 120303]) {
    const monster = monsterContext.MONSTERS_DATA.find(entry => entry.id === id);
    assert(monster?.isChestTrap === true, `Mimic ${id} is not explicitly registered in monsters.js`);
    assert(monster.image === `assets/monsters/monster_${id}.png`, `Mimic ${id} uses a split image path`);
    assert(fs.existsSync(path.join(root, monster.image)), `Mimic image is missing: ${monster.image}`);
}
assert(!read('chest-mimics.js').includes('target.push'), 'chest-mimics.js must not inject monster records at runtime');
assert(read('main.js').includes('fixedContainerDef?.baseTile'), 'Per-container base terrain support is missing');

console.log('Trial Island shrine visual, navigation, treasure, and mimic-source validation passed.');
