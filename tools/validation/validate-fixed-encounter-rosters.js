const fs = require('fs');
const vm = require('vm');

const root = process.cwd();

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function loadMaps() {
    const context = { console, window: {}, tileEntry: (img, color) => ({ img, color }) };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    for (const file of ['map.js', 'maps_logic.js', 'monsters.js']) {
        vm.runInContext(fs.readFileSync(`${root}/${file}`, 'utf8'), context, { filename: file });
    }
    return { maps: context.FIXED_DUNGEON_MAPS, areas: context.STORY_DATA.areas, registry: context.MapRegistry, monsterData: context.MonsterData };
}

const { maps, areas, registry, monsterData } = loadMaps();
const monstersById = new Map(monsterData.allBases.map(monster => [Number(monster.id), monster]));
let floorRosterCount = 0;
let hunterRosterCount = 0;

for (const [areaKey, base] of Object.entries(maps)) {
    const boostDefs = [base, ...(base.floors || [])].filter(def => def?.enemyBoost);
    for (const def of boostDefs) {
        assert(!def.enemyBoost.nameSuffix, `${areaKey}: enemyBoost must not append a depth suffix to monster names`);
    }

    for (const [floorIndex, floor] of (base.floors || []).entries()) {
        const label = `${areaKey}:F${floorIndex + 1}`;
        assert(!Array.isArray(floor.monsters), `${label}: map-local encounter roster must not override monsters.js habitats`);
        const mapId = floor.mapId || base.mapId;
        const roster = monsterData.getEncounterCandidates({ mapId, floor: floorIndex + 1 });
        for (const monster of roster) {
            const id = Number(monster.id);
            assert(monstersById.has(id), `${label}: unknown habitat monster ${id}`);
            assert(!monster.isBoss && !monster.isSpecialBoss && !monster.isChestTrap, `${label}: boss/trap ${id} is mixed into ordinary encounters`);
            floorRosterCount++;
        }

        const hunters = (floor.tileEffects || []).filter(effect => effect?.type === 'hunter');
        if (!hunters.length) continue;
        assert(roster.length > 0, `${label}: hunter floor has no monsters.js habitat candidates`);
        for (const hunter of hunters) {
            assert(Array.isArray(hunter.monsterIds) && hunter.monsterIds.length > 0, `${label}/${hunter.id}: empty hunter roster`);
            assert(Number(hunter.statMultiplier) >= 1 && Number(hunter.statMultiplier) <= 1.5, `${label}/${hunter.id}: hunter multiplier must remain in the audited 1.00-1.50 range`);
            for (const id of hunter.monsterIds) {
                const monster = monstersById.get(Number(id));
                assert(monster, `${label}/${hunter.id}: unknown hunter monster ${id}`);
                assert(!monster.isBoss && !monster.isSpecialBoss && !monster.isChestTrap && !monster.isRare, `${label}/${hunter.id}: boss/special/rare ${id} cannot be selected as a hunter`);
                hunterRosterCount++;
            }
        }
    }
}

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
const soldier = (crenaFloor.mapActors || []).find(actor => Number(actor.x) === 19 && Number(actor.y) === 17);
const soldierState = soldier?.states?.[0];
assert(soldier?.imageKey === 'overlay_npc_dark_soldier', 'CRENA F1 investigation soldier is missing at (19,17)');
assert(soldierState?.when?.missingFlag === 'crenaRouteKnown', 'CRENA F1 investigation soldier must disappear when Leila gives the crystal objective');
assert(soldier?.interactFromAdjacent === true, 'CRENA F1 investigation soldier must be spoken to from an adjacent tile');

console.log(`Fixed encounter roster validation passed: ${floorRosterCount} monsters.js habitat entries, ${hunterRosterCount} authored hunter entries, depth gates, and the Crena investigation cordon are consistent.`);
