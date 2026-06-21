const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mapSource = fs.readFileSync(path.join(root, 'map.js'), 'utf8');
const storySource = fs.readFileSync(path.join(root, 'story.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const context = { console, window: {} };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(
    `${mapSource}\nglobalThis.MAPS = { FIXED_MAPS, FIXED_DUNGEON_MAPS };`,
    context,
    { filename: 'map.js' }
);

let actors = 0;
const errors = [];

const waterCity = context.MAPS.FIXED_MAPS.WATER_CITY;
if (!waterCity) {
    errors.push('WATER_CITY map is unavailable');
} else {
    waterCity.tiles.forEach((row, y) => {
        [...row].forEach((tile, x) => {
            if (tile === 'C' || tile === 'R') {
                errors.push(`WATER_CITY: legacy chest/soldier tile remains at ${x},${y}: ${tile}`);
            }
        });
    });
    for (const guard of (waterCity.mapActions || []).filter(action => action.eventId === 'water_city_blockade_guard')) {
        if (waterCity.tiles?.[guard.y]?.[guard.x] !== 'T') {
            errors.push(`WATER_CITY: blockade guard must stand on a normal T tile at ${guard.x},${guard.y}`);
        }
    }
}

for (const marker of [
    'isBlockingMapActor',
    'getAdjacentMapActor',
    'prepareAdjacentMapActorAction',
    "targetMapAction.log || '人が立っている。'"
]) {
    if (!mainSource.includes(marker)) errors.push(`missing adjacent actor interaction marker: ${marker}`);
}
for (const marker of ['getAdjacentChest', 'prepareAdjacentChestAction', "tile === 'C' || tile === 'R'"]) {
    if (!mainSource.includes(marker)) errors.push(`missing adjacent chest interaction marker: ${marker}`);
}

function inspectMap(key, mapDef, label) {
    const occupied = new Set();
    for (const action of mapDef.mapActions || []) {
        if (!action.imageKey) continue;
        actors++;
        const x = Number(action.x);
        const y = Number(action.y);
        const coord = `${x},${y}`;
        if (occupied.has(coord)) errors.push(`${label}: duplicate actor coordinate ${coord}`);
        occupied.add(coord);
        const tile = String(mapDef.tiles?.[y]?.[x] || 'W').toUpperCase();
        if (tile === 'W') errors.push(`${label}: actor placed on wall at ${coord}`);
        if (!['T', 'G', 'L', 'M'].includes(tile)) {
            errors.push(`${label}: actor tile was not normalized at ${coord}: ${tile}`);
        }
        if (action.blocksMovement !== false && !action.label) {
            errors.push(`${label}: blocking actor has no interaction label at ${coord}`);
        }
        if (action.eventId && !storySource.includes(`"${action.eventId}"`)) {
            errors.push(`${label}: missing story event ${action.eventId}`);
        }
        for (const event of action.events || []) {
            if (event.eventId && !storySource.includes(`"${event.eventId}"`)) {
                errors.push(`${label}: missing progress story event ${event.eventId}`);
            }
        }
    }
}

for (const [key, mapDef] of Object.entries(context.MAPS.FIXED_MAPS)) {
    inspectMap(key, mapDef, key);
}
for (const [key, dungeon] of Object.entries(context.MAPS.FIXED_DUNGEON_MAPS)) {
    for (const [index, floor] of (dungeon.floors || []).entries()) {
        inspectMap(key, floor, `${key}:F${index + 1}`);
    }
}

if (errors.length) throw new Error(`Map actor validation failed:\n${errors.join('\n')}`);
const waterGuards = (context.MAPS.FIXED_MAPS.WATER_CITY?.mapActions || [])
    .filter(action => action.eventId === 'water_city_blockade_guard');
if (waterGuards.length !== 3 || waterGuards.some(action => action.missingFlag !== 'waterCityCleared')) {
    throw new Error('All three Water City blockade guards must disappear after the Seabed Temple clear flag.');
}
console.log(`Map actor validation passed. Coordinate-based actors checked: ${actors}.`);
console.log('Actor positions are walkable, unique, blocking, adjacent-interactable, and linked to existing story events.');
