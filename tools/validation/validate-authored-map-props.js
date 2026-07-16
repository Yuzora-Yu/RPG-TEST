const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const mapSource = fs.readFileSync(path.join(root, 'map.js'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(
    `${mapSource}\n;globalThis.__AUTHORED_MAPS__ = { FIXED_MAPS, FIXED_DUNGEON_MAPS, AUTHORED_MAP_PROP_PLACEMENTS };`,
    context,
    { filename: 'map.js' }
);

const { FIXED_MAPS, FIXED_DUNGEON_MAPS, AUTHORED_MAP_PROP_PLACEMENTS } = context.__AUTHORED_MAPS__;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'map', 'library', 'manifest.json'), 'utf8'));
const libraryAssets = manifest.assets || [];
const errors = [];
const fail = message => errors.push(message);
const keyOf = (x, y) => `${Number(x)},${Number(y)}`;
const getBase = areaKey => FIXED_MAPS[areaKey] || FIXED_DUNGEON_MAPS[areaKey] || null;
const getFloor = placement => {
    const base = getBase(placement.areaKey);
    if (!base) return null;
    return Array.isArray(base.floors) ? base.floors[Number(placement.floor || 1) - 1] : base;
};

if (!Array.isArray(AUTHORED_MAP_PROP_PLACEMENTS)) fail('AUTHORED_MAP_PROP_PLACEMENTS is not an array.');
const placements = Array.isArray(AUTHORED_MAP_PROP_PLACEMENTS) ? AUTHORED_MAP_PROP_PLACEMENTS : [];
const imagePlacements = placements.filter(entry => entry.imageKey);
const carpetPlacements = placements.filter(entry => entry.type === 'castle_carpet');
const gozaPlacements = placements.filter(entry => entry.type === 'village_goza');

if (imagePlacements.length !== 0) fail(`All optional library props must be unplaced, found ${imagePlacements.length}.`);
if (carpetPlacements.length !== 3) fail(`Expected 3 final-floor carpets, found ${carpetPlacements.length}.`);
if (gozaPlacements.length !== 0) fail(`Goza placements must remain empty until the user places them individually, found ${gozaPlacements.length}.`);

const ids = new Set();
const imageKeys = new Set();
placements.forEach(placement => {
    if (!placement.id) fail(`Placement without id at ${placement.areaKey}:${placement.floor}:${placement.x},${placement.y}.`);
    if (ids.has(placement.id)) fail(`Duplicate placement id: ${placement.id}`);
    ids.add(placement.id);
    if (placement.imageKey) {
        if (imageKeys.has(placement.imageKey)) fail(`Library image placed more than once: ${placement.imageKey}`);
        imageKeys.add(placement.imageKey);
    }

    const floor = getFloor(placement);
    if (!floor) {
        fail(`Unknown map/floor for ${placement.id}: ${placement.areaKey} F${placement.floor}.`);
        return;
    }
    const x = Number(placement.x);
    const y = Number(placement.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
        fail(`Non-integer coordinate for ${placement.id}.`);
        return;
    }
    const tile = String(floor.tiles?.[y]?.[x] || 'W').toUpperCase();
    if (tile === 'W') fail(`${placement.id} is placed on a wall at ${placement.areaKey} F${placement.floor} (${x},${y}).`);
    if (placement.baseTile && tile !== String(placement.baseTile).toUpperCase()) {
        fail(`${placement.id} base tile mismatch: data=${placement.baseTile}, map=${tile}.`);
    }

    if (['castle_carpet', 'castle_carpet_blue_silver', 'village_goza'].includes(placement.type)) {
        const width = Number(placement.width || 1);
        const height = Number(placement.height || 1);
        const allowedTiles = new Set((placement.allowedBaseTiles || [placement.baseTile || 'T']).map(tile => String(tile).toUpperCase()));
        for (let dy = 0; dy < height; dy += 1) {
            for (let dx = 0; dx < width; dx += 1) {
                const covered = String(floor.tiles?.[y + dy]?.[x + dx] || 'W').toUpperCase();
                if (!allowedTiles.has(covered) && !(placement.type.startsWith('castle_carpet') && covered === 'B')) {
                    fail(`${placement.id} covers non-floor tile ${covered} at (${x + dx},${y + dy}).`);
                }
            }
        }
    }

    const reservedLists = ['floorLinks', 'chests', 'bosses', 'healSprings', 'mapActions'];
    if (placement.imageKey && reservedLists.some(name =>
        Array.isArray(floor[name]) && floor[name].some(entry => Number(entry.x) === x && Number(entry.y) === y)
    )) {
        fail(`${placement.id} overlaps an interactive/reserved cell.`);
    }

    if (placement.role === 'blocking') {
        const applied = (floor.blockingObjects || []).filter(entry => entry.authoredPlacementId === placement.id);
        if (applied.length !== 1) fail(`${placement.id} was not applied exactly once to blockingObjects.`);
    } else {
        const applied = (floor.floorDecorations || []).filter(entry => entry.authoredPlacementId === placement.id);
        if (applied.length !== 1) fail(`${placement.id} was not applied exactly once to floorDecorations.`);
        if (applied[0]?.blocking !== false) fail(`${placement.id} must remain walkable.`);
    }
});

if (imageKeys.size !== 0) fail('Optional map-library assets remain connected to authored placement data.');

const expectedCarpets = new Map([
    ['THUNDER_FORT', 6],
    ['LIGHT_PALACE', 4],
    ['DARK_CASTLE', 7]
]);
carpetPlacements.forEach(carpet => {
    if (expectedCarpets.get(carpet.areaKey) !== Number(carpet.floor)) {
        fail(`Carpet is not on the requested final floor: ${carpet.areaKey} F${carpet.floor}.`);
    }
});
expectedCarpets.forEach((floor, areaKey) => {
    if (!carpetPlacements.some(entry => entry.areaKey === areaKey && Number(entry.floor) === floor)) {
        fail(`Missing final-floor carpet: ${areaKey} F${floor}.`);
    }
});

const componentMap = (floor, includeAuthored) => {
    const existingBlocked = new Set((floor.blockingObjects || [])
        .filter(entry => includeAuthored || !entry.authoredPlacementId)
        .map(entry => keyOf(entry.x, entry.y)));
    const components = new Map();
    let componentId = 0;
    const height = floor.tiles?.length || 0;
    const width = floor.tiles?.[0]?.length || 0;
    const passable = (x, y) => x >= 0 && y >= 0 && x < width && y < height
        && String(floor.tiles[y]?.[x] || 'W').toUpperCase() !== 'W'
        && !existingBlocked.has(keyOf(x, y));
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const startKey = keyOf(x, y);
            if (!passable(x, y) || components.has(startKey)) continue;
            componentId += 1;
            const queue = [[x, y]];
            components.set(startKey, componentId);
            for (let index = 0; index < queue.length; index += 1) {
                const [cx, cy] = queue[index];
                [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    const nextKey = keyOf(nx, ny);
                    if (!passable(nx, ny) || components.has(nextKey)) return;
                    components.set(nextKey, componentId);
                    queue.push([nx, ny]);
                });
            }
        }
    }
    return components;
};

const touchedFloors = new Map();
placements.forEach(placement => touchedFloors.set(`${placement.areaKey}:F${placement.floor}`, {
    areaKey: placement.areaKey,
    floorNo: Number(placement.floor),
    floor: getFloor(placement)
}));

touchedFloors.forEach(({ areaKey, floorNo, floor }) => {
    const before = componentMap(floor, false);
    const after = componentMap(floor, true);
    const afterIdsByBeforeId = new Map();
    before.forEach((beforeId, coordinate) => {
        if (!after.has(coordinate)) return;
        if (!afterIdsByBeforeId.has(beforeId)) afterIdsByBeforeId.set(beforeId, new Set());
        afterIdsByBeforeId.get(beforeId).add(after.get(coordinate));
    });
    afterIdsByBeforeId.forEach((afterIds, beforeId) => {
        if (afterIds.size > 1) fail(`${areaKey} F${floorNo}: authored blocking props split baseline component ${beforeId}.`);
    });
});

const seabedF4 = FIXED_DUNGEON_MAPS.SEABED_TEMPLE?.floors?.[3];
if (!seabedF4) {
    fail('SEABED_TEMPLE F4 not found.');
} else {
    for (let x = 18; x <= 21; x += 1) {
        if (seabedF4.tiles?.[21]?.[x] !== 'T') fail(`SEABED_TEMPLE F4 connection cell (${x},21) must be T.`);
    }
    const connected = componentMap(seabedF4, true);
    if (!connected.has(keyOf(15, 3)) || connected.get(keyOf(15, 3)) !== connected.get(keyOf(14, 22))) {
        fail('SEABED_TEMPLE F4 upper/lower stair routes remain disconnected.');
    }
}

if (errors.length) {
    console.error(`Authored map prop validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Authored map props validated: optional library images and goza placements removed; ${carpetPlacements.length} final-floor carpets retained.`);
console.log('Navigation: no baseline walkable component was split; SEABED_TEMPLE F4 stair route is connected.');
