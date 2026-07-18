const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const assetContext = { console };
assetContext.window = assetContext;
assetContext.globalThis = assetContext;
vm.createContext(assetContext);
vm.runInContext(`${read('assets.js')}\nglobalThis.__ASSETS = PRISMA_ASSETS;`, assetContext, { filename: 'assets.js' });

const mapContext = { window: {}, console };
vm.createContext(mapContext);
vm.runInContext(read('map.js'), mapContext, { filename: 'map.js' });
vm.runInContext(read('maps_logic.js'), mapContext, { filename: 'maps_logic.js' });

const graphics = assetContext.__ASSETS.graphics;
const map = mapContext.window.FIXED_MAPS.ABYSS_FIELD;
const theme = mapContext.window.TILE_THEMES.ABYSS_FIELD;
const decor = mapContext.window.MAP_FLOOR_DECOR_THEMES.ABYSS_FIELD;
const action = map.mapActions.find(entry => entry.type === 'abyssDungeon');
const registry = mapContext.window.MapRegistry;

assert(action, 'Abyss entrance action is missing');
assert(action.interactFromAdjacent === true, 'Abyss entrance must be activated from an adjacent tile');
assert(action.baseTile === 'T', 'The chasm overlay must own its floor base');
assert(!action.imageKey, 'The nine-cell chasm must not return to the actor-depth overlay layer');
assert(action.interactionArea?.x === 7 && action.interactionArea?.y === 6
    && action.interactionArea?.width === 3 && action.interactionArea?.height === 3,
    'Abyss interaction area must match the exact 3x3 chasm footprint');
for (let y = 6; y <= 8; y++) for (let x = 7; x <= 9; x++) {
    assert(registry.findMapActionInteractionCell(map, x, y) === action, `Interaction footprint lookup failed at ${x},${y}`);
}
assert(registry.findMapActionInteractionCell(map, 8, 5) === null, 'Interaction footprint leaked outside the 3x3 chasm');
assert(decor.disabled === true && decor.key === null, 'Random floor decoration must stay disabled on the authored ritual ruin');

for (const tileKey of ['W', 'T', 'G']) {
    const keys = theme[tileKey].variants || [theme[tileKey].img];
    assert(keys.length >= 4, `${tileKey} must have at least four deterministic visual variants`);
    for (const key of keys) assert(graphics[key], `Unregistered Abyss Outer Rim terrain graphic: ${key}`);
}
assert(
    theme.T.variants[0] !== theme.G.variants[0]
        && theme.T.variants.every(key => key.startsWith('tile_abyss_outer_floor'))
        && theme.G.variants.every(key => key.startsWith('tile_abyss_outer_prism_paving')),
    'Abyss Outer Rim must keep two semantically distinct ruin-floor families',
);
for (const object of map.blockingObjects || []) {
    if (object.imageKey) assert(graphics[object.imageKey], `Unregistered authored prop: ${object.imageKey}`);
}

const chasmDecorations = (map.floorDecorations || []).filter(definition => String(definition.imageKey || '').startsWith('overlay_abyss_outer_chasm_'));
assert(chasmDecorations.length === 9, `Chasm must be composed of nine floor-layer pieces: ${chasmDecorations.length}`);
const expectedChasmCells = new Set();
for (let y = 6; y <= 8; y++) for (let x = 7; x <= 9; x++) expectedChasmCells.add(`${x},${y}`);
for (const definition of chasmDecorations) {
    assert(definition.type === 'image' && definition.blocking === false, `Chasm floor piece has invalid render metadata: ${definition.imageKey}`);
    assert(graphics[definition.imageKey], `Unregistered chasm floor piece: ${definition.imageKey}`);
    expectedChasmCells.delete(`${definition.x},${definition.y}`);
}
assert(expectedChasmCells.size === 0, `Missing chasm floor cells: ${[...expectedChasmCells].join(', ')}`);

const visiblePropKeys = new Set((map.blockingObjects || []).map(object => object.imageKey).filter(Boolean));
assert(visiblePropKeys.size >= 6, `Temple ruin composition lacks unique silhouettes: ${[...visiblePropKeys].join(', ')}`);
assert(!visiblePropKeys.has('overlay_abyss_outer_ruined_arch'), 'The unwanted broken arch behind the altar is still placed');
assert(![...visiblePropKeys].some(key => key.includes('collapsed_pillar_b')), 'Mirrored duplicate pillar must not return to the authored map');
const prismPedestals = (map.blockingObjects || []).filter(object => String(object.imageKey || '').startsWith('overlay_abyss_outer_prism_pedestal_'));
assert(prismPedestals.length === 6, `Exactly six former prism pedestals must surround the chasm: ${prismPedestals.length}`);
assert(new Set(prismPedestals.map(object => object.imageKey)).size >= 2, 'The six prism pedestals must use at least two distinct damage states');
for (const pedestal of prismPedestals) {
    const distance = Math.abs(pedestal.x - action.x) + Math.abs(pedestal.y - action.y);
    assert(distance >= 3, `Prism pedestal is too close to an interaction cell: ${pedestal.x},${pedestal.y}`);
}

const fallenPillar = (map.blockingObjects || []).find(object => object.imageKey === 'overlay_abyss_outer_fallen_pillar');
assert(fallenPillar?.x === 12 && fallenPillar?.y === 10, 'Fallen pillar base moved from its authored location');
assert(fallenPillar.drawWidth === 64 && fallenPillar.drawHeight === 64, 'Fallen pillar must render across a 2x2 tile region');
assert(!(map.blockingObjects || []).some(object => object.x === 11 && object.y === 9),
    'Fallen pillar north-west tip should remain passable');
for (const [x, y] of [[12, 9], [11, 10], [12, 10]]) {
    assert((map.blockingObjects || []).some(object => object.x === x && object.y === y),
        `Fallen pillar 2x2 visual footprint must block movement at ${x},${y}`);
}

const blocked = new Set((map.blockingObjects || []).map(object => `${object.x},${object.y}`));
for (let y = 6; y <= 8; y++) for (let x = 7; x <= 9; x++) {
    assert(blocked.has(`${x},${y}`), `Chasm cell is not blocked: ${x},${y}`);
}
const passable = new Set(['T', 'G', 'S', 'D']);
const start = map.entryPoint;
const queue = [[start.x, start.y]];
const visited = new Set([`${start.x},${start.y}`]);
while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;
        const id = `${nx},${ny}`;
        if (visited.has(id) || blocked.has(id) || ny < 0 || ny >= map.height || nx < 0 || nx >= map.width) continue;
        if (!passable.has(map.tiles[ny][nx])) continue;
        visited.add(id);
        queue.push([nx, ny]);
    }
}
const interactionApproachIds = ['8,5', '6,7', '10,7', '8,9'];
assert(interactionApproachIds.every(id => visited.has(id) && !blocked.has(id)), 'Each cardinal side of the 3x3 chasm needs an open interaction approach');

const main = read('main.js');
assert(main.includes('action.interactFromAdjacent === true || Field.isBlockingMapActor(action)'), 'Adjacent map-action routing no longer honors interactFromAdjacent');
assert(main.includes('MapRegistry.findMapActionInteractionCell(Field.currentMapData, x, y)'), 'Adjacent action search does not inspect the 3x3 interaction area');
console.log(`Abyss Outer Rim validation passed: ${visited.size} reachable tiles; chasm is blocked and adjacent-interactable.`);
