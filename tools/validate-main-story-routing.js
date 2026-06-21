const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const storySource = fs.readFileSync(path.join(root, 'story.js'), 'utf8');
const mapSource = fs.readFileSync(path.join(root, 'map.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const context = { console, window: {} };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${storySource}\nglobalThis.storyManager = StoryManager;`, context, { filename: 'story.js' });
vm.runInContext(`${mapSource}\nglobalThis.maps = { STORY_DATA, FIXED_DUNGEON_MAPS };`, context, { filename: 'map.js' });

const story = context.storyManager;
const events = story.events || {};
const areas = context.maps.STORY_DATA.areas;
const dungeons = context.maps.FIXED_DUNGEON_MAPS;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

for (const key of ['2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '4-1', '4-2', '4-3']) {
    assert(story.storyObjectives[key], `Main-story objective is missing: ${key}`);
}

function action(eventId, type, predicate = () => true) {
    return (events[eventId]?.actions || []).find(entry => entry.type === type && predicate(entry));
}

assert(action('fire_volcano_entrance', 'CONV', entry => entry.value === 'FIRE_VOLCANO_SHAO_JOIN'), 'Shao meeting is not connected at the volcano entrance.');
assert(!action('fire_volcano_entrance', 'START_FIXED_DUNGEON'), 'Volcano must not start before the holy-water detour.');
assert(action('fire_village_holy_water_briefing', 'QUEST_ACCEPT', entry => entry.value === 'fire_holy_water'), 'Holy-water quest is not accepted after reporting the cursed flames.');
assert(action('forest_wind_hole_entry', 'START_FIXED_DUNGEON', entry => entry.value === 'FOREST_WIND_HOLE'), 'Forest Wind Hole entry event is not connected.');
assert(action('quest_fire_holy_water_clear', 'SUB', entry => entry.value === 5), 'Holy-water victory does not advance the main story.');
assert(action('fire_volcano_holy_water_used', 'START_FIXED_DUNGEON', entry => entry.value === 'IGNIS_VOLCANO'), 'Holy water does not open Ignis Volcano.');

assert(action('water_city_sophia', 'QUEST_ACCEPT', entry => entry.value === 'water_blue_crystal'), 'Sophia does not start the blue-crystal quest.');
assert(!action('water_city_sophia', 'START_FIXED_DUNGEON'), 'Water City must not send the party directly to the Seabed Temple.');
assert(action('crena_cave_entry', 'START_FIXED_DUNGEON', entry => entry.value === 'CRENA_LIMESTONE_CAVE'), 'Crena Limestone Cave entry event is not connected.');
assert(action('quest_water_blue_crystal_clear', 'SUB', entry => entry.value === 2), 'Blue-crystal victory does not return the objective to Sophia.');
assert(action('water_city_blue_crystal_report', 'FLAG', entry => entry.key === 'seabedTempleRouteOpened'), 'Sophia report does not open the Seabed Temple route.');

assert(areas.FOREST_WIND_HOLE.entryRequiredFlag === 'windHoleRouteKnown', 'Forest Wind Hole can be entered before its story reveal.');
assert(areas.CRENA_LIMESTONE_CAVE.entryRequiredFlag === 'crenaRouteKnown', 'Crena Cave can be entered before Sophia reveals it.');
assert(areas.SEABED_TEMPLE.entryRequiredFlag === 'seabedTempleRouteOpened', 'Seabed Temple can be entered before the blue crystal is delivered.');
assert(areas.FOREST_WIND_HOLE.entryEventStoryStep === 2 && areas.CRENA_LIMESTONE_CAVE.entryEventStoryStep === 4, 'New-dungeon entrance scenes are not limited to their main-story chapters.');
assert(mainSource.includes('areaDef.entryRequiredFlag') && mainSource.includes('areaDef.entryEventId') &&
    mainSource.includes('entryEventStageMatches'), 'World-area entry gates are not enforced by Field.');

for (const scriptId of [
    'FIRE_VOLCANO_CURSED_FLAMES',
    'FIRE_VILLAGE_HOLY_WATER_BRIEFING',
    'FOREST_WIND_HOLE_ENTRY',
    'FOREST_HOLY_WATER_CLEAR',
    'FIRE_VOLCANO_HOLY_WATER_USED',
    'CRENA_CAVE_ENTRY',
    'CRENA_BLUE_CRYSTAL_CLEAR',
    'WATER_CITY_BLUE_CRYSTAL_REPORT'
]) {
    for (const line of story.scripts?.[scriptId] || []) {
        const longest = Math.max(...String(line.text || '').split('\n').map(part => [...part].length));
        assert(longest <= 34, `New main-story dialogue exceeds the mobile line target: ${scriptId} (${longest})`);
    }
}

const deepFloors = [
    ['IGNIS_VOLCANO', 4, 29, 25],
    ['FORBIDDEN_FOREST', 3, 31, 25],
    ['SEABED_TEMPLE', 4, 29, 25],
    ['THUNDER_FORT', 5, 31, 25]
];
for (const [key, floorNumber, minWidth, minHeight] of deepFloors) {
    const floor = dungeons[key]?.floors?.[floorNumber - 1];
    assert(floor, `Deep floor is missing: ${key} F${floorNumber}`);
    assert(floor.width >= minWidth && floor.height >= minHeight, `Deep floor is still a placeholder: ${key} F${floorNumber}`);
    assert((floor.tileEffects || []).length >= 4, `Deep floor lacks interactive hazards: ${key} F${floorNumber}`);
    assert((floor.chests || []).length >= 2, `Deep floor lacks exploration rewards: ${key} F${floorNumber}`);
}

for (const [dungeonKey, dungeon] of Object.entries(dungeons)) {
    for (const [index, floor] of (dungeon.floors || []).entries()) {
        const tileAt = (x, y) => String(floor.tiles?.[Number(y)]?.[Number(x)] || 'W').toUpperCase();
        for (const effect of floor.tileEffects || []) {
            assert(tileAt(effect.x, effect.y) !== 'W', `Tile effect is placed in a wall: ${dungeonKey} F${index + 1} ${effect.x},${effect.y}`);
            if (effect.type === 'warp') {
                assert(tileAt(effect.toX, effect.toY) !== 'W', `Warp destination is a wall: ${dungeonKey} F${index + 1} ${effect.toX},${effect.toY}`);
            }
        }
    }
}

const grezelia = dungeons.GREZELIA_FORBIDDEN;
assert(grezelia?.floors?.length >= 3, 'Grezelia must have a true third, highest-difficulty layer.');
assert(grezelia.floors[1].floorLinks?.some(link => link.toFloor === 3 && link.requiredFlag === 'grezeliaOuterSealBroken'), 'Grezelia zero layer is not sealed behind the outer boss.');
assert(grezelia.floors[2].bosses?.some(boss => boss.questId === 'zenon_hidden_grezelia'), 'Zenon hidden trial is not placed at the true deepest layer.');

console.log('Main-story routing validation passed.');
console.log('Fire Village -> Wind Hole -> Ignis Volcano and Water City -> Crena Cave -> Seabed Temple are mandatory routes.');
console.log('Four blessing-gated deep floors use expanded authored layouts with hazards and rewards.');
console.log('Grezelia has a sealed third layer, and all fixed tile effects use walkable coordinates.');
