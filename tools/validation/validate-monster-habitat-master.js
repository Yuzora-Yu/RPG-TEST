const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const context = { window: {}, console, Math, tileEntry: (img, color) => ({ img, color }) };
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const file of ['map.js', 'maps_logic.js', 'monsters.js']) {
    vm.runInContext(read(file), context, { filename: file });
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const mapSource = read('map.js');
const mapsLogicSource = read('maps_logic.js');
const battleSource = read('battle.js');
assert(!/(?:^|[,\s])["']?monsters["']?\s*:\s*\[/m.test(mapSource),
    'map.js still contains a normal encounter roster. monsters.js habitats must be the only master.');
assert(!/(?:^|[,\s])["']?rareMonsters["']?\s*:\s*\[/m.test(mapSource),
    'map.js still contains a rare encounter roster. Rank bands must be the only master.');
assert(!mapsLogicSource.includes('base.rareMonsters') && !mapsLogicSource.includes('def.rareMonsters'),
    'MapRegistry still propagates map-local rare encounter rosters.');
assert(!battleSource.includes('battleData.rareMonsters') && !battleSource.includes('currentMapData.rareMonsters'),
    'Battle still gives map-local rare encounter rosters priority.');
assert((battleSource.match(/tryGenerateRareMonster\(/g) || []).length === 1,
    'Rare selection must be rolled exactly once per encounter in battle.js.');
assert(battleSource.includes('allowRare: false'),
    'Normal enemy slots can still reroll a rare monster after the encounter-level roll.');

const { MonsterData, MapRegistry, FIXED_DUNGEON_MAPS, FIELD_ENCOUNTER_ZONES, MAP_IDS } = context;
let floorsChecked = 0;
for (const [areaKey, dungeon] of Object.entries(FIXED_DUNGEON_MAPS)) {
    const floors = dungeon.floors || [dungeon];
    floors.forEach((unused, index) => {
        const floor = MapRegistry.getFixedDungeonFloor(areaKey, index + 1);
        if (floor.disableRandomEncounters || floor.isGuildQuestDungeon || floor.useHabitatEncounters === false) return;
        const abyssFloor = floor.mapId === MAP_IDS.ABYSS ? floor.floor : 0;
        const candidates = MonsterData.getEncounterCandidates({ mapId: floor.mapId, floor: floor.floor, abyssFloor });
        assert(candidates.length > 0, `${areaKey}:F${index + 1} has no monsters.js habitat candidates.`);
        assert(!Array.isArray(floor.monsters), `${areaKey}:F${index + 1} restored a map-local monster roster.`);
        assert(!Array.isArray(floor.rareMonsters), `${areaKey}:F${index + 1} restored a map-local rare roster.`);
        floorsChecked += 1;
    });
}

for (const zone of FIELD_ENCOUNTER_ZONES) {
    const candidates = MonsterData.getEncounterCandidates({ mapId: zone.mapId, floor: 0 });
    assert(candidates.length > 0, `${zone.id} has no monsters.js field-habitat candidates.`);
    assert(!Array.isArray(zone.monsters) && !Array.isArray(zone.rareMonsters),
        `${zone.id} contains a map-local encounter override.`);
}
assert(MonsterData.getEncounterCandidates({ mapId: MAP_IDS.SEA, floor: 0 }).length > 0,
    'Sea encounters have no monsters.js habitat candidates.');

const monster51 = MonsterData.getMonsterById(51);
assert(JSON.stringify(monster51.habitats) === JSON.stringify([
    { mapId: 'MAP000004', floors: [{ from: 1, to: 2 }] },
    { mapId: 'MAP000005', floors: [{ from: 0, to: 0 }] }
]), 'Monster 51 habitat master was changed.');
for (const [mapId, floor, expected] of [
    ['MAP000004', 1, true], ['MAP000004', 2, true], ['MAP000004', 3, false],
    ['MAP000005', 0, true], ['MAP000005', 1, false]
]) {
    const found = MonsterData.getEncounterCandidates({ mapId, floor }).some(monster => monster.id === 51);
    assert(found === expected, `Monster 51 habitat resolution mismatch: ${mapId} floor ${floor}.`);
}

for (const [rank, expectedId, expectedRate] of [
    [30, null, 0], [31, 200201, 0.02], [70, 200201, 0.02],
    [71, 200202, 0.02], [105, 200202, 0.02],
    [106, 200203, 0.02], [150, 200203, 0.02],
    [151, 200204, 0.02], [999, 200204, 0.02]
]) {
    assert(MonsterData.getRareMonsterIdForRank(rank) === expectedId,
        `Rare monster band mismatch at Rank ${rank}.`);
    assert(MonsterData.getRareEncounterRateForRank(rank) === expectedRate,
        `Rare encounter rate mismatch at Rank ${rank}.`);
    const candidates = MonsterData.getRareCandidatesForRank(rank);
    assert((candidates[0]?.id || null) === expectedId && candidates.length === (expectedId ? 1 : 0),
        `Rare candidate mismatch at Rank ${rank}.`);
}

console.log(`Monster habitat master validation passed: ${floorsChecked} fixed floors, ${FIELD_ENCOUNTER_ZONES.length} field zones, sea habitats, and four rare Rank bands at one 2% encounter roll.`);
