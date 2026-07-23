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
const map = mapContext.window.FIXED_MAPS.SUMMIT_TEMPLE;
const theme = mapContext.window.TILE_THEMES.SUMMIT_TEMPLE;
const wallFace = mapContext.window.DUNGEON_WALL_FACE_THEMES.SUMMIT_TEMPLE;
const decor = mapContext.window.MAP_FLOOR_DECOR_THEMES.SUMMIT_TEMPLE;
const graphics = assetContext.__ASSETS.graphics;
const cached = new Set(assetContext.__ASSETS.cacheWarmup.installImages || []);
const renderContext = { window: {}, globalThis: {}, console };
renderContext.window = renderContext;
renderContext.globalThis = renderContext;
vm.createContext(renderContext);
vm.runInContext(read('map_render_shared.js'), renderContext, { filename: 'map_render_shared.js' });
const renderShared = renderContext.MapRenderShared;

assert(map.width === 25 && map.height === 21, 'Summit Temple must use the expanded 25x21 sanctuary layout');
assert(map.tiles.length === map.height && map.tiles.every(row => row.length === map.width), 'Summit Temple has a malformed tile row');
assert(map.isDungeon === false && map.useDungeonWallFace === true,
    'Summit Temple must remain a normal facility while explicitly enabling wall faces');
assert(map.disableRandomEncounters === true, 'Summit Temple must remain encounter-free');
assert(map.autoExitOnPerimeter === true, 'Summit Temple perimeter must exit on contact');
for (let x = 0; x < map.width; x += 1) {
    assert(map.tiles[0][x] === '^', `Summit cliff edge is not sky at x=${x}`);
    assert(map.tiles[map.height - 1][x] === 'S', `Summit bottom perimeter is not an exit at x=${x}`);
}
for (let y = 0; y < map.height; y += 1) {
    const expected = y <= 8 ? '^' : 'S';
    assert(map.tiles[y][0] === expected && map.tiles[y][map.width - 1] === expected,
        `Summit side perimeter is not ${expected === '^' ? 'cliff sky' : 'an exit'} at y=${y}`);
}

assert(map.themeKey === 'SUMMIT_TEMPLE', 'Summit Temple is not using its dedicated theme');
assert(theme.G.img === 'tile_summit_temple_mountain_trail' && theme.S.img === 'tile_summit_temple_mountain_trail',
    'Summit exterior must use its dedicated mountain-trail terrain');
assert(theme.G.variants?.length === 2 && theme.S.variants?.length === 2,
    'Summit mountain trail must expose two authored variants');
assert(theme['^']?.img === 'tile_summit_temple_sky' && !theme['^'].variants,
    'Summit cliff sky must use one quiet seamless base instead of repeating detailed variants');
assert(theme['^']?.terrain === true,
    'Summit sky must be rendered as base terrain, never as a shadow-casting tile object');
assert(map.impassableTiles?.includes('^'), 'Summit cliff sky is not declared impassable');
for (let y = 0; y <= 8; y += 1) {
    assert(!map.tiles[y].includes('G'), `Summit Y${y} still contains gravel instead of cliff sky`);
}
assert(theme.T.variants?.length === 2, 'Summit floor must expose two authored variants');
const edgeKeys = ['n', 'e', 's', 'w'].map(direction => map.elevatedEdges?.keys?.[direction]);
assert(JSON.stringify(map.elevatedEdges?.terrainTiles) === JSON.stringify(['T'])
    && JSON.stringify(map.elevatedEdges?.voidTiles) === JSON.stringify(['^'])
    && Number(map.elevatedEdges?.thickness) === 6
    && Number(map.elevatedEdges?.joinOverlap) === 1
    && Number(map.elevatedEdges?.cornerOverhang) === 6
    && edgeKeys.every(Boolean),
    'Summit elevated-floor edge routing is missing or malformed');
const summitTileAt = (x, y) => String(map.tiles?.[y] || '')[x] || '';
const topLeftEdgePlan = renderShared.elevatedEdgeCellPlan({
    map,
    definition: map.elevatedEdges,
    x: 10,
    y: 3,
    tileSign: summitTileAt(10, 3),
    tileAtFn: summitTileAt
});
const nextTopEdgePlan = renderShared.elevatedEdgeCellPlan({
    map,
    definition: map.elevatedEdges,
    x: 11,
    y: 3,
    tileSign: summitTileAt(11, 3),
    tileAtFn: summitTileAt
});
const topLeftNorth = topLeftEdgePlan?.edges?.find(edge => edge.id === 'n');
const topLeftWest = topLeftEdgePlan?.edges?.find(edge => edge.id === 'w');
const nextNorth = nextTopEdgePlan?.edges?.find(edge => edge.id === 'n');
assert(topLeftNorth?.x === -6 && topLeftWest?.y === -6,
    'Summit upper-left ledge does not extend both rails through the convex corner');
assert(10 * 32 + topLeftNorth.x + topLeftNorth.width >= 11 * 32 + nextNorth.x,
    'Summit neighboring handrail segments leave a horizontal seam');
for (const key of [theme.W.img, ...theme.T.variants, ...theme.G.variants, theme['^'].img, wallFace.img, ...edgeKeys, map.battleBg]) {
    const assetKey = key === map.battleBg ? 'battle_bg_summit_temple' : key;
    assert(graphics[assetKey], `Missing registered Summit graphic: ${assetKey}`);
    assert(fs.existsSync(path.join(root, graphics[assetKey])), `Missing Summit asset file: ${graphics[assetKey]}`);
    assert(cached.has(graphics[assetKey]), `Summit asset is absent from full cache: ${graphics[assetKey]}`);
}
assert(decor.disabled === true, 'Summit Temple must not receive random generic floor decorations');

const decorations = map.floorDecorations || [];
const clouds = map.skyOverlays || [];
assert(clouds.length === 3, 'Summit sky must use three unsliced transparent cloud banks');
assert(clouds.some(entry => entry.imageKey === 'overlay_summit_temple_cloud_bank' && entry.x === 2 && entry.y === 1),
    'The cleaned original cloud bank is not anchored on the left sky');
assert(clouds.some(entry => entry.imageKey === 'overlay_summit_temple_cloud_wispy' && entry.x === 16),
    'The wispy cloud variant is not placed on the right sky');
assert(clouds.some(entry => entry.imageKey === 'overlay_summit_temple_cloud_compact' && entry.x === 17),
    'The compact cloud variant is not placed on the right sky');
clouds.forEach(entry => {
    assert(graphics[entry.imageKey], `Unregistered Summit cloud overlay: ${entry.imageKey}`);
    assert(cached.has(graphics[entry.imageKey]), `Summit cloud overlay is absent from full cache: ${entry.imageKey}`);
});
assert(!decorations.some(entry => String(entry.imageKey || '').startsWith('overlay_summit_temple_cloud_')),
    'Summit clouds must not be split across floor-decoration tiles');
const stage = decorations.filter(entry => entry.type === 'image' && String(entry.imageKey).startsWith('overlay_summit_temple_stage_'));
assert(stage.length === 15, 'Summit 5x3 raised stage must contain exactly 15 rendered cells');
for (let y = 3; y <= 5; y += 1) {
    for (let x = 10; x <= 14; x += 1) {
        const cell = stage.find(entry => entry.x === x && entry.y === y);
        assert(cell, `Summit stage cell missing at ${x},${y}`);
        assert(graphics[cell.imageKey], `Unregistered Summit stage graphic: ${cell.imageKey}`);
    }
}
const carpet = decorations.find(entry => entry.type === 'castle_carpet_blue_silver');
assert(carpet?.x === 12 && carpet?.y === 6 && carpet?.width === 1 && carpet?.height === 12,
    'Blue-silver carpet does not connect the entrance corridor to the stage');

const blockers = map.blockingObjects || [];
const movementRegion = map.movementRegions?.find(entry => entry.id === 'raised-stage');
assert(movementRegion?.x === 10 && movementRegion?.y === 3 && movementRegion?.width === 5 && movementRegion?.height === 3,
    'Summit raised-stage movement region is missing or malformed');
assert(JSON.stringify(movementRegion.gateways) === JSON.stringify([{ inside: { x: 12, y: 5 }, outside: { x: 12, y: 6 } }]),
    'Summit stage must only connect through its lower-center gateway');
for (let y = 3; y <= 5; y += 1) for (let x = 10; x <= 14; x += 1) {
    assert(!blockers.some(entry => entry.x === x && entry.y === y), `Summit stage walkable cell is blocked at ${x},${y}`);
}
const angel = blockers.find(entry => entry.imageKey === 'overlay_summit_temple_statue_angel');
const dragon = blockers.find(entry => entry.imageKey === 'overlay_summit_temple_statue_divine_dragon');
assert(angel?.x === 10 && angel?.y === 6, 'Angel statue is not guarding the left approach');
assert(dragon?.x === 14 && dragon?.y === 6, 'Divine-dragon statue is not guarding the right approach');
assert(graphics[angel.imageKey] && graphics[dragon.imageKey], 'Summit guardian statue assets are not registered');

const action = map.mapActions?.find(entry => entry.type === 'limitBreakTrial' && entry.trialType === 'final');
assert(action?.x === 12 && action?.y === 3, 'Final limit-break trial must sit at the upper edge of the stage');
const healingSpring = map.healSprings?.find(entry => entry.x === 6 && entry.y === 13);
assert(healingSpring?.imageKey === 'overlay_shrine_healing_spring' && healingSpring?.shimmer === true,
    'Summit left room has no animated authored recovery spring');
assert(graphics[healingSpring.imageKey] && cached.has(graphics[healingSpring.imageKey]),
    'Summit recovery spring is not registered in the full cache');

const chests = map.chests || [];
const pot = chests.find(entry => entry.containerKind === 'pot');
assert(pot?.x === 22 && pot?.y === 9 && pot?.itemId === 99 && pot?.baseTile === 'G',
    'Summit exterior pot must be on the upper-right grass and contain a Small Medal');
assert(chests.some(entry => entry.x === 19 && entry.y === 11 && entry.trapMonsterId === 120303 && entry.trapFloor === 190),
    'Upper treasure-room chest must contain the strongest mimic');
assert(chests.some(entry => entry.x === 19 && entry.y === 13 && entry.itemId === 1034),
    'Middle treasure-room chest must contain 神喰の緋月石');
assert(chests.some(entry => entry.x === 19 && entry.y === 15 && entry.itemId === 1043),
    'Lower treasure-room chest must contain 神霊の雫');

const blocked = new Set([...blockers, ...chests].map(entry => `${entry.x},${entry.y}`));
const passable = new Set(['T', 'G', 'S']);
const boundaryBlocked = (fromX, fromY, toX, toY) => {
    const inside = (x, y) => x >= 10 && x <= 14 && y >= 3 && y <= 5;
    if (inside(fromX, fromY) === inside(toX, toY)) return false;
    return !((fromX === 12 && fromY === 5 && toX === 12 && toY === 6)
        || (fromX === 12 && fromY === 6 && toX === 12 && toY === 5));
};
const queue = [[map.entryPoint.x, map.entryPoint.y]];
const visited = new Set([`${map.entryPoint.x},${map.entryPoint.y}`]);
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
    ['recovery spring', [6, 13]],
    ['stage trial', [12, 3]],
    ['treasure approach', [18, 11]],
    ['exit', [12, 20]],
    ['exterior pot approach', [22, 10]],
]) assert(visited.has(`${point[0]},${point[1]}`), `Unreachable ${label} at ${point.join(',')}`);

const mainSource = read('main.js');
const editorSource = read('map_story_editor.html');
assert(mainSource.includes("Field.currentMapData?.useDungeonWallFace === true"),
    'Game renderer cannot opt a normal facility into wall faces');
assert(mainSource.includes('isMovementRegionCrossingBlocked: (fromX, fromY, toX, toY) =>'),
    'Field movement does not enforce Summit stage boundaries');
assert(editorSource.includes("map?.useDungeonWallFace === true"),
    'Map editor cannot preview wall faces for a normal facility');
const phaserSource = read('phaser-field.js');
assert(phaserSource.includes("objectConfig?.terrain === true")
    && phaserSource.includes("!isBaseTerrainTile && !overlay")
    && phaserSource.includes('drawElevatedTerrainEdges(scene, field, mapSize, areaKey')
    && phaserSource.includes('renderShared.elevatedEdgeCellPlan')
    && phaserSource.includes('drawMapSkyOverlays(scene, field)'),
    'Phaser does not render authored terrain and elevated edges through the shared base-layer path');
assert(mainSource.includes("config?.terrain === true")
    && mainSource.includes('elevatedEdgePlans.forEach')
    && mainSource.includes('MapRenderShared?.elevatedEdgeCellPlan')
    && mainSource.includes("Field.currentMapData?.skyOverlays"),
    'Canvas fallback does not mirror authored terrain and elevated-edge routing');
assert(editorSource.includes("cfg?.terrain===true")
    && editorSource.includes('drawEditorElevatedEdges(ctx,map,tile,w,h)')
    && editorSource.includes('renderShared.elevatedEdgeCellPlan')
    && editorSource.includes('drawEditorSkyOverlays(ctx,map,tile)'),
    'Map editor does not mirror the game terrain and elevated-edge routing');
assert(phaserSource.includes("object.shimmer === true") && phaserSource.includes("duration: 760"),
    'Phaser recovery-spring shimmer tween is missing');
assert(phaserSource.includes('水面そのものは固定する')
    && !phaserSource.includes('baseScaleX * 0.97')
    && !phaserSource.includes('baseScaleY * 0.97'),
    'Healing spring body still scales together with its light');
assert(phaserSource.includes("object.auraKey || 'heal-blossom'")
    && phaserSource.includes("y: { from: py + 8, to: py - 10 }")
    && phaserSource.includes("alpha: { from: 0.20, to: 0.78 }")
    && phaserSource.includes('const upperAura = addImage')
    && phaserSource.includes('[-12, -5, 5, 12].forEach'),
    'Healing spring does not have strong layered rising light and motes');
assert(!phaserSource.includes('const cloudShadow = scene.add.container')
    && !phaserSource.includes('cloudBlobs.forEach'),
    'The rejected procedural cloud-shadow effect is still active');
assert(mainSource.includes('isTileImpassableForCurrentMap: (tileSign) =>')
    && mainSource.includes('Field.isTileImpassableForCurrentMap(tile)'),
    'Summit sky does not use the shared authored impassable-terrain rule');

console.log('Summit Temple seamless sky, elevated ledges, cloud bank, spring aura, navigation, treasure, and battle background validated.');
