const fs = require('fs');
const path = require('path');
const { loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const { context } = loadMapRuntime(root);
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

const expected = [
    ['START_CAVE', 'START_VILLAGE', 11, 1],
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

const abyssWorld = context.WORLD_MAPS?.ABYSS_WORLD;
if (!abyssWorld?.skyPrismEligible || !Number.isFinite(Number(abyssWorld?.skyPrismDestination?.x)) || !Number.isFinite(Number(abyssWorld?.skyPrismDestination?.y))) {
    throw new Error('ABYSS_WORLD must be a direct Sky Prism destination.');
}
for (const areaKey of ['CARMENA', 'VISTA', 'LEGACION']) {
    const mapDef = context.FIXED_MAPS?.[areaKey];
    if (!mapDef?.skyPrismEntryPoint || !Number.isFinite(Number(mapDef.skyPrismEntryPoint.x)) || !Number.isFinite(Number(mapDef.skyPrismEntryPoint.y))) {
        throw new Error(`${areaKey} must define an interior Sky Prism arrival point.`);
    }
}

for (const marker of [
    'getFixedMapLocalEntranceDestination:',
    'const authoredEntry = info.kind === \'field\' && info.def?.skyPrismEntryPoint',
    ': (App.getFixedMapLocalEntranceDestination?.(areaKey) || null);',
    'App.data.location.area = localDest.parentAreaKey;',
    'isFixed: true,',
    "? { areaKey: targetWorldKey, worldKey: targetWorldKey, x: localDest.worldX, y: localDest.worldY }"
]) {
    if (!mainSource.includes(marker)) throw new Error(`Sky Prism local-entrance routing marker is missing: ${marker}`);
}

console.log(`Sky Prism destination validation passed: ${expected.length} nested entrances, Abyss world, and 3 Abyss settlements.`);
