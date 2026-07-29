const fs = require('fs');
const path = require('path');
const { loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const { context } = loadMapRuntime(root);
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

const expectedAreaOrder = [
    'START_VILLAGE',
    'START_CAVE',
    'FOREST_WIND_HOLE',
    'FIRE_VILLAGE',
    'IGNIS_VOLCANO',
    'WIND_VILLAGE',
    'FORBIDDEN_FOREST',
    'WIND_TEMPLE',
    'WATER_CITY',
    'CRENA_LIMESTONE_CAVE',
    'SEABED_TEMPLE',
    'THUNDER_FORT',
    'BIG_TOWER',
    'LIGHT_PALACE',
    'DARK_SHRINE_RUINS',
    'GALVANIA_CAVE',
    'DARK_CASTLE',
    'GREZELIA_FORBIDDEN',
    'ABYSS_FIELD',
    'TRIAL_ISLAND',
    'CARMENA',
    'THUNDER_DUNES',
    'BLACK_ROPE_PYRAMID',
    'SCREAMING_CEMETERY',
    'MAGIC_WIND_MAUSOLEUM',
    'VISTA',
    'FROZEN_FOREST',
    'ICE_PENANCE_ROAD',
    'PURGATORY_MOUNTAINS',
    'SCORCHING_OLD_CASTLE',
    'LEGACION',
    'RIDPALM_DREAM_CORRIDOR',
    'JAGOREA_ROOT',
    'CHRONO_ABYSS',
    'FINAL_ALTAR',
    'SUMMIT_TEMPLE',
    'RUINED_SHRINE'
];
const orderMatch = mainSource.match(/const skyPrismAreaOrder = Object\.freeze\(\[([\s\S]*?)\]\);/);
if (!orderMatch) throw new Error('Sky Prism destination allowlist was not found.');
const actualAreaOrder = Array.from(orderMatch[1].matchAll(/'([^']+)'/g), match => match[1]);
if (JSON.stringify(actualAreaOrder) !== JSON.stringify(expectedAreaOrder)) {
    throw new Error(`Wrong Sky Prism destination order:\n${actualAreaOrder.join('\n')}`);
}
for (const areaKey of actualAreaOrder) {
    if (!context.FIXED_MAPS?.[areaKey] && !context.FIXED_DUNGEON_MAPS?.[areaKey]) {
        throw new Error(`Sky Prism destination has no authored entrance map: ${areaKey}`);
    }
}
if (!mainSource.includes('skyPrismAreaOrder.forEach(push);')) {
    throw new Error('Sky Prism destinations must be collected only from the explicit allowlist.');
}
for (const internalAreaKey of [
    'VISTA_UNDERPASS',
    'LEGACION_UPPER_GALLERY',
    'LEGACION_WEST_TOWER',
    'LEGACION_EAST_TOWER',
    'LEGACION_PRISON',
    'LEGACION_TEMPLE',
    'LEGACION_THRONE'
]) {
    if (actualAreaOrder.includes(internalAreaKey)) {
        throw new Error(`Internal fixed-map area must not be a Sky Prism destination: ${internalAreaKey}`);
    }
}

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
if (abyssWorld?.skyPrismEligible !== false || abyssWorld?.skyPrismDestination) {
    throw new Error('ABYSS_WORLD is a world map and must not be a direct Sky Prism destination.');
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

if (!mainSource.includes("info.kind === 'world' && info.def?.skyPrismEligible === false")) {
    throw new Error('Only the world-map record must be filtered; discovered Abyss settlements must remain eligible.');
}
if (!mainSource.includes("info.kind === 'world' && targetWorld?.skyPrismEligible === false")) {
    throw new Error('Sky Prism travel must reject the Abyss world record without rejecting Abyss settlements.');
}
console.log(`Sky Prism destination validation passed: ${expectedAreaOrder.length} ordered entrances, ${expected.length} nested routes, and internal maps excluded.`);
