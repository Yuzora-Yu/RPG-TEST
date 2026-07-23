const { createRuntimeContext } = require('./validation-helpers');

const root = require('path').resolve(__dirname, '..', '..');
const runtime = createRuntimeContext(root);
runtime.runFile('map.js', 'globalThis.__FIXED_DUNGEONS__ = FIXED_DUNGEON_MAPS;');

const targets = [
    'WIND_TEMPLE',
    'THUNDER_FORT',
    'LIGHT_PALACE',
    'DARK_SHRINE_RUINS',
    'DARK_CASTLE',
    'SEABED_TEMPLE',
    'CRENA_LIMESTONE_CAVE'
];

for (const areaKey of targets) {
    const area = runtime.context.__FIXED_DUNGEONS__[areaKey];
    console.log(`\n${areaKey} (${area.floors.length} floors)`);
    area.floors.forEach((floor, floorIndex) => {
        console.log(`  ${floorIndex + 1}: ${floor.label}`);
        for (const link of floor.floorLinks || []) {
            const tile = floor.tiles?.[link.y]?.[link.x] || '?';
            const destination = link.toFloor ? `F${link.toFloor}` : link.to;
            console.log(`    (${link.x},${link.y}) ${tile} -> ${destination} (${link.targetX ?? '-'},${link.targetY ?? '-'}) ${link.label || ''}`);
            console.log(`      ${JSON.stringify(floor.tiles?.[link.y] || '')}`);
        }
    });
}
