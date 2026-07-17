const fs = require('fs');
const path = require('path');
const { loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const { context } = loadMapRuntime(root);
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

const expected = [
    ['START_CAVE', 'START_VILLAGE', 11, 0],
    ['IGNIS_VOLCANO', 'FIRE_VILLAGE', 14, 1],
    ['FORBIDDEN_FOREST', 'WIND_VILLAGE', 0, 9]
];
for (const [areaKey, parentAreaKey, x, y] of expected) {
    const entrance = context.MapRegistry.findFixedMapEntranceForDungeon(areaKey);
    if (!entrance) throw new Error(`Nested fixed-dungeon entrance was not resolved: ${areaKey}`);
    if (entrance.parentAreaKey !== parentAreaKey || entrance.x !== x || entrance.y !== y) {
        throw new Error(`Wrong nested entrance for ${areaKey}: ${entrance.parentAreaKey} (${entrance.x},${entrance.y})`);
    }
}

for (const marker of [
    'getFixedMapLocalEntranceDestination:',
    'const localDest = App.getFixedMapLocalEntranceDestination?.(areaKey) || null;',
    'App.data.location.area = localDest.parentAreaKey;',
    'isFixed: true,',
    "? { areaKey: 'WORLD', x: localDest.worldX, y: localDest.worldY }"
]) {
    if (!mainSource.includes(marker)) throw new Error(`Sky Prism local-entrance routing marker is missing: ${marker}`);
}

console.log(`Sky Prism nested destination validation passed: ${expected.length} fixed-map entrances.`);
