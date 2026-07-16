const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const errors = [];

const context = { window: {}, console };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${read('assets.js')}\nthis.__assets = PRISMA_ASSETS;`, context, { filename: 'assets.js' });
vm.runInContext(read('map.js'), context, { filename: 'map.js' });
vm.runInContext(read('maps_logic.js'), context, { filename: 'maps_logic.js' });

const required = {
    object_blocking_castle_candelabrum: ['assets/map/objects/object_blocking_castle_candelabrum_v001.png', 32, 48],
    object_blocking_forest_stump: ['assets/map/objects/object_blocking_forest_stump_v001.png', 32, 32],
    object_blocking_thunder_terminal: ['assets/map/objects/object_blocking_thunder_terminal_v001.png', 32, 40],
    object_blocking_cave_stalagmite: ['assets/map/objects/object_blocking_cave_stalagmite_v001.png', 32, 48],
    object_blocking_seabed_coral_pillar: ['assets/map/objects/object_blocking_seabed_coral_pillar_v001.png', 32, 48],
    object_blocking_light_crystal_pedestal: ['assets/map/objects/object_blocking_light_crystal_pedestal_v001.png', 32, 48],
    object_blocking_fire_brazier: ['assets/map/objects/object_blocking_fire_brazier_v001.png', 32, 40],
    object_blocking_lighthouse_gear_pedestal: ['assets/map/objects/object_blocking_lighthouse_gear_pedestal_v001.png', 32, 48],
    object_blocking_dark_shrine_obelisk: ['assets/map/objects/object_blocking_dark_shrine_obelisk_v001.png', 32, 48]
};
const graphics = context.__assets.graphics || {};
const installImages = new Set(context.__assets.cacheWarmup?.installImages || []);
for (const [key, [relative, width, height]] of Object.entries(required)) {
    if (graphics[key] !== relative) errors.push(`blocking object is not registered: ${key}`);
    if (!installImages.has(relative)) errors.push(`blocking object is missing from full cache: ${key}`);
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) {
        errors.push(`blocking object file is missing: ${relative}`);
        continue;
    }
    const data = fs.readFileSync(file);
    if (data.toString('ascii', 1, 4) !== 'PNG') {
        errors.push(`blocking object is not PNG: ${relative}`);
        continue;
    }
    if (data.readUInt32BE(16) !== width || data.readUInt32BE(20) !== height) errors.push(`blocking object size is wrong: ${relative}`);
    if (![4, 6].includes(data[25])) errors.push(`blocking object has no alpha channel: ${relative}`);
}

const floor = context.MapRegistry.getFixedDungeonFloor('DARK_CASTLE', 1);
const objects = floor?.blockingObjects || [];
const expected = new Set(['14,3', '16,3']);
if (objects.length !== 2) errors.push(`Demon Castle 1F must have two sample candelabra: ${objects.length}`);
for (const object of objects) {
    const point = `${object.x},${object.y}`;
    if (!expected.has(point)) errors.push(`unexpected Demon Castle blocking object: ${point}`);
    if (object.imageKey !== 'object_blocking_castle_candelabrum') errors.push(`sample object is not a candelabrum: ${point}`);
    if (!['T', 'G'].includes(floor.tiles?.[object.y]?.[object.x])) errors.push(`blocking object base is not walkable floor: ${point}`);
    if (context.MapRegistry.findBlockingObject(floor, object.x, object.y) !== object) errors.push(`blocking object registry lookup failed: ${point}`);
}
if (floor.tiles?.[3]?.[15] !== 'D') errors.push('Demon Castle upper stair is no longer centered between the candelabra');

const blocked = new Set(objects.map(object => `${object.x},${object.y}`));
const start = floor.entryPoint || { x: 15, y: 25 };
const queue = [start];
const seen = new Set([`${start.x},${start.y}`]);
const walkable = new Set(['T', 'G', 'D', 'U', 'S', 'L', 'P']);
while (queue.length) {
    const point = queue.shift();
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const x = point.x + dx;
        const y = point.y + dy;
        const key = `${x},${y}`;
        if (seen.has(key) || blocked.has(key) || !walkable.has(String(floor.tiles?.[y]?.[x] || '').toUpperCase())) continue;
        seen.add(key);
        queue.push({ x, y });
    }
}
if (!seen.has('15,3')) errors.push('candelabra placement blocks access to the Demon Castle upper stair');

const main = read('main.js');
const phaser = read('phaser-field.js');
for (const marker of ['getBlockingObjectAt:', 'MapRegistry.findBlockingObject', 'targetBlockingObject.log', 'blockingObjectOverlayConfig']) {
    if (!main.includes(marker)) errors.push(`blocking movement/render marker is missing: ${marker}`);
}
for (const marker of ['overlay.blockingObject === true', 'overlay.drawWidth', 'overlay.drawHeight']) {
    if (!phaser.includes(marker)) errors.push(`Phaser blocking-object marker is missing: ${marker}`);
}

if (errors.length) {
    console.error(errors.map(error => `- ${error}`).join('\n'));
    process.exit(1);
}
console.log(`Blocking map object validation passed. Assets: ${Object.keys(required).length}. Demon Castle samples: ${objects.length}. Stair access preserved.`);
