const fs = require('fs');
const vm = require('vm');

const root = process.cwd();

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function loadMaps() {
    const context = { console, window: {}, tileEntry: (img, color) => ({ img, color }) };
    context.globalThis = context;
    vm.createContext(context);
    const source = fs.readFileSync(`${root}/map.js`, 'utf8');
    vm.runInContext(`${source}\nglobalThis.__MAPS__ = FIXED_DUNGEON_MAPS;\nglobalThis.__AREAS__ = STORY_DATA.areas;`, context, { filename: 'map.js' });
    return { maps: context.__MAPS__, areas: context.__AREAS__ };
}

function loadMonsters() {
    const context = { console, window: {} };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(`${root}/monsters.js`, 'utf8'), context, { filename: 'monsters.js' });
    return new Map(context.window.MONSTERS_DATA.map(monster => [Number(monster.id), monster]));
}

const { maps, areas } = loadMaps();
const monstersById = loadMonsters();
let floorRosterCount = 0;
let hunterRosterCount = 0;

for (const [areaKey, base] of Object.entries(maps)) {
    const boostDefs = [base, ...(base.floors || [])].filter(def => def?.enemyBoost);
    for (const def of boostDefs) {
        assert(!def.enemyBoost.nameSuffix, `${areaKey}: enemyBoost must not append a depth suffix to monster names`);
    }

    for (const [floorIndex, floor] of (base.floors || []).entries()) {
        const label = `${areaKey}:F${floorIndex + 1}`;
        const roster = (floor.monsters || []).map(id => monstersById.get(Number(id)));
        for (const [index, monster] of roster.entries()) {
            const id = Number(floor.monsters[index]);
            assert(monster, `${label}: unknown encounter monster ${id}`);
            assert(!monster.isBoss && !monster.isSpecialBoss && !monster.isChestTrap, `${label}: boss/trap ${id} is mixed into ordinary encounters`);
            floorRosterCount++;
        }

        const hunters = (floor.tileEffects || []).filter(effect => effect?.type === 'hunter');
        if (!hunters.length) continue;
        assert(roster.length > 0, `${label}: hunter rank cannot be checked without a floor roster`);
        const floorMaxRank = Math.max(...roster.map(monster => Number(monster.rank || 0)));
        for (const hunter of hunters) {
            assert(Array.isArray(hunter.monsterIds) && hunter.monsterIds.length > 0, `${label}/${hunter.id}: empty hunter roster`);
            assert(Number(hunter.statMultiplier) >= 1 && Number(hunter.statMultiplier) <= 1.5, `${label}/${hunter.id}: hunter multiplier must remain in the audited 1.00-1.50 range`);
            for (const id of hunter.monsterIds) {
                const monster = monstersById.get(Number(id));
                assert(monster, `${label}/${hunter.id}: unknown hunter monster ${id}`);
                assert(!monster.isBoss && !monster.isSpecialBoss && !monster.isChestTrap && !monster.isRare, `${label}/${hunter.id}: boss/special/rare ${id} cannot be selected as a hunter`);
                const offset = Number(monster.rank || 0) - floorMaxRank;
                assert(offset === 5 || offset === 10, `${label}/${hunter.id}: ${monster.name} is ${offset} ranks above the floor; expected one or two rank bands (+5/+10)`);
                hunterRosterCount++;
            }
        }
    }
}

const finalFloorRanks = areaKey => {
    const floors = maps[areaKey]?.floors || [];
    const floor = floors[floors.length - 1];
    return (floor?.monsters || []).map(id => Number(monstersById.get(Number(id))?.rank || 0));
};
const maxRank = values => Math.max(...values);
const minRank = values => Math.min(...values);
const galvaniaFinal = finalFloorRanks('GALVANIA_CAVE');
const castleFinal = finalFloorRanks('DARK_CASTLE');
const grezeliaOuter = maps.GREZELIA_FORBIDDEN.floors[0].monsters.map(id => monstersById.get(Number(id)).rank);
const grezeliaDeep = maps.GREZELIA_FORBIDDEN.floors[2].monsters.map(id => monstersById.get(Number(id)).rank);
assert(maxRank(galvaniaFinal) + 5 === minRank(castleFinal), 'DARK_CASTLE final roster must be one rank band above GALVANIA_CAVE final roster');
assert(maxRank(castleFinal) + 5 === minRank(grezeliaOuter), 'GREZELIA_FORBIDDEN must be one rank band above the new DARK_CASTLE roster');
assert(maxRank(grezeliaOuter) + 5 === minRank(grezeliaDeep), 'GREZELIA_FORBIDDEN deep roster must be one rank band above its outer roster');

const expectedDepthGates = [
    ['IGNIS_VOLCANO', 2, 4, 'windVillageCleared'],
    ['FORBIDDEN_FOREST', 1, 3, 'waterCityCleared'],
    ['SEABED_TEMPLE', 2, 4, 'thunderFortCleared'],
    ['THUNDER_FORT', 3, 5, 'lightPalaceCleared'],
    ['CRENA_LIMESTONE_CAVE', 1, 3, 'darkCastleCleared']
];
for (const [areaKey, fromIndex, toFloor, flag] of expectedDepthGates) {
    const links = maps[areaKey].floors[fromIndex].floorLinks || [];
    assert(links.some(link => Number(link.toFloor) === toFloor && link.requiredFlag === flag), `${areaKey}: depth access must remain tied to ${flag}`);
}

const crenaArea = areas.CRENA_LIMESTONE_CAVE;
assert(!crenaArea.entryRequiredFlag, 'CRENA_LIMESTONE_CAVE must allow pre-request exploration up to the investigation cordon');
const crenaFloor = maps.CRENA_LIMESTONE_CAVE.floors[0];
const soldier = (crenaFloor.mapActions || []).find(action => Number(action.x) === 19 && Number(action.y) === 17);
assert(soldier?.imageKey === 'overlay_npc_dark_soldier', 'CRENA F1 investigation soldier is missing at (19,17)');
assert(soldier?.missingFlag === 'crenaRouteKnown', 'CRENA F1 investigation soldier must disappear when Leila gives the crystal objective');
assert(soldier?.interactFromAdjacent === true, 'CRENA F1 investigation soldier must be spoken to from an adjacent tile');

console.log(`Fixed encounter roster validation passed: ${floorRosterCount} floor entries, ${hunterRosterCount} hunter entries, depth gates, tier hierarchy, and the Crena investigation cordon are consistent.`);
