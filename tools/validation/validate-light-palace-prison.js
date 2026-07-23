const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

const context = { window: {}, console, App: { data: { progress: { flags: {} } } } };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${read('map.js')}\nthis.__MAPS = FIXED_DUNGEON_MAPS;`, context, { filename: 'map.js' });
vm.runInContext(`${read('maps_logic.js')}\nthis.__REGISTRY = MapRegistry;`, context, { filename: 'maps_logic.js' });
vm.runInContext(`${read('story.js')}\nthis.__STORY = STORY_MANAGER_DATA;`, context, { filename: 'story.js' });

const palace = context.__MAPS.LIGHT_PALACE;
const prison = palace?.floors?.[4];
assert(palace?.floors?.length === 5, 'Light Palace must contain four upper floors and one basement prison');
assert(prison?.width === 27 && prison?.height === 19, 'Basement prison must use the compact 27x19 authored layout');
assert(prison?.tiles?.length === 19 && prison.tiles.every(row => row.length === 27), 'Basement prison tile matrix is malformed');
assert((prison?.monsters || []).length === 0, 'Basement prison must not have random encounters');

const upper = palace?.floors?.[0];
const down = upper?.floorLinks?.find(link => Number(link.toFloor) === 5);
const up = prison?.floorLinks?.find(link => Number(link.toFloor) === 1);
assert(down?.x === 7 && down?.y === 4 && upper?.tiles?.[4]?.[7] === 'D', 'F1 basement stair must terminate the extended upper-left passage at (7,4)');
assert(up?.x === 13 && up?.y === 16 && prison?.tiles?.[16]?.[13] === 'U', 'Basement return stair must be visible at (13,16)');
assert(down?.targetX === up?.x && down?.targetY === up?.y && up?.targetX === down?.x && up?.targetY === down?.y,
    'Light Palace basement stairs are not reciprocal');

const gates = (prison?.blockingObjects || []).filter(entry => entry.imageKey === 'overlay_light_prison_gate_horizontal');
assert(gates.length === 8, `Expected eight front-facing prison gates, found ${gates.length}`);
assert(gates.every(entry => entry.missingFlag === 'lightPalacePrisonOpened'), 'Every prison gate must open from the shared guard-clear flag');
assert(gates.every(entry => prison.tiles?.[entry.y]?.[entry.x] === 'T'), 'A prison gate is not placed over a walkable doorway tile');
assert(!(prison?.blockingObjects || []).some(entry => String(entry.imageKey || '').includes('vertical')),
    'A side-facing prison gate is still referenced');

context.App.data.progress.flags = {};
assert(gates.every(entry => context.__REGISTRY.findBlockingObject(prison, entry.x, entry.y) === entry),
    'Closed prison gates do not participate in collision lookup');
context.App.data.progress.flags.lightPalacePrisonOpened = true;
assert(gates.every(entry => context.__REGISTRY.findBlockingObject(prison, entry.x, entry.y) === null),
    'Opened prison gates still participate in collision lookup');

const actions = prison?.mapActions || [];
for (const eventId of [
    'light_palace_prison_king',
    'light_palace_prison_priest_a',
    'light_palace_prison_priest_b',
    'light_palace_prison_leila'
]) {
    const action = actions.find(entry => entry.eventId === eventId);
    assert(action, `Missing basement prisoner action: ${eventId}`);
    assert(action && prison.tiles?.[action.y]?.[action.x] === 'T', `Prisoner action is not on floor: ${eventId}`);
}
const leila = actions.find(entry => entry.eventId === 'light_palace_prison_leila');
assert(leila?.x === 24 && leila?.y === 10, 'Leila must occupy the upper-center cell of the lower-right room');
assert(leila?.imageKey === 'overlay_light_captive_leila_bed' && leila?.drawWidth === 64 && leila?.drawHeight === 32,
    'Leila must use the dedicated 64x32 bed sprite');
assert(leila?.missingFlag === 'leilaJoined', 'Leila bed must disappear only after recruitment');
assert((prison?.blockingObjects || []).some(entry => entry.x === 23 && entry.y === 10 && entry.missingFlag === 'leilaJoined'),
    'Leila bed footprint is missing its conditional second collision cell');

const chests = prison?.chests || [];
assert(chests.some(entry => entry.x === 3 && entry.y === 3 && entry.trapMonsterId === 120302 && entry.trapFloor === 140),
    'Upper-left cell must contain the second-tier rank-140 mimic');
for (const [x, y, itemId] of [[19, 3, 1072], [24, 3, 1076], [20, 11, 99]]) {
    const pot = chests.find(entry => entry.x === x && entry.y === y);
    assert(pot?.itemId === itemId && pot?.containerKind === 'pot' && pot?.imageKey === 'overlay_field_pot',
        `Authored prison pot is missing or malformed at ${x},${y}`);
}
assert(!actions.some(entry => entry.eventId === 'light_palace_prison_princess'),
    'The upper-left mimic room is still occupied by the removed princess action');

const guard = prison?.bosses?.[0];
assert(guard?.x === 13 && guard?.y === 3 && prison?.tiles?.[3]?.[13] === 'B', 'Prison guard is not one step above its old upper-hall position');
assert(guard?.startEventId === 'light_palace_prison_guard_encounter'
    && guard?.storyEventId === 'light_palace_prison_guard_clear'
    && Number(guard?.bossStatMultiplier) === 2,
    'Prison guard battle/event routing is malformed');

const story = context.__STORY;
const events = story.events || {};
const conversations = story.scripts || {};
assert(events.light_palace_prison_guard_encounter && events.light_palace_prison_guard_clear,
    'Prison guard encounter/clear events are missing');
assert(events.light_palace_prison_guard_clear?.actions?.some(action => action.type === 'FLAG'
    && action.key === 'lightPalacePrisonOpened' && action.refreshField === true),
    'Guard clear does not open cells and refresh the field immediately');

const leilaEvent = events.light_palace_prison_leila;
const leilaJson = JSON.stringify(leilaEvent || {});
assert(leilaJson.includes('"key":"lightPalaceCleared"'), 'Leila event does not branch on palace boss completion');
assert(leilaJson.includes('"type":"IF_ITEM"') && leilaJson.includes('"id":5'), 'Leila event does not require the World Tree Leaf');
assert(leilaJson.includes('"type":"CONSUME_ITEM"'), 'Leila event does not consume the World Tree Leaf');
assert(leilaJson.includes('"type":"ALLY","value":204') && leilaJson.includes('"key":"leilaJoined"'),
    'Leila recruitment and persistent joined flag are not paired');
for (const clearId of ['light_palace_clear', 'light_palace_overpower_clear']) {
    assert(!(events[clearId]?.actions || []).some(action => action.type === 'ALLY' && Number(action.value) === 204),
        `${clearId} still recruits Leila before the prison recovery event`);
}
for (const conversationId of [
    'LIGHT_PALACE_LEILA_CURSED',
    'LIGHT_PALACE_LEILA_STABILIZED',
    'LIGHT_PALACE_LEILA_NEEDS_LEAF',
    'LIGHT_PALACE_LEILA_RECOVERY_JOIN'
]) assert(conversations[conversationId]?.length, `Missing Leila conversation: ${conversationId}`);

for (const areaKey of ['GALVANIA_CAVE', 'DARK_CASTLE', 'DARK_SHRINE_RUINS']) {
    assert(context.__MAPS[areaKey]?.entryRequiredAllyId === 204, `${areaKey} is not gated by recruited Leila`);
}
const northBarrier = conversations.GALVANIA_CAVE_NORTH_BLOCKED || [];
assert(northBarrier[0]?.name === 'ケイト' && northBarrier[0]?.text === 'すさまじい結界でふさがれています。',
    'Galvania north barrier does not begin with Kate’s specified line');
assert(northBarrier[1]?.name === 'ジョセフ' && northBarrier[1]?.text === 'これは……王宮聖騎士の紋章に見えるな。',
    'Galvania north barrier does not continue with Joseph’s specified explanation');

const assetSource = read('assets.js');
for (const [key, file, width, height] of [
    ['overlay_light_prison_gate_horizontal', 'assets/map/overlays/overlay_light_prison_gate_horizontal.png', 32, 32],
    ['overlay_light_captive_leila_bed', 'assets/map/overlays/overlay_light_captive_leila_bed.png', 64, 32]
]) {
    assert(assetSource.includes(`${key}: "${file}"`), `Asset registry is missing ${key}`);
    const data = fs.readFileSync(path.join(root, file));
    assert(data.readUInt32BE(16) === width && data.readUInt32BE(20) === height, `${key} has the wrong dimensions`);
    assert([4, 6].includes(data[25]), `${key} has no alpha channel`);
}

const main = read('main.js');
const phaser = read('phaser-field.js');
assert(main.includes("const bossOverlay = /^(overlay_boss_|monster_)/")
    && main.includes('? Math.round(ts * 2)'),
    'Canvas fallback does not preserve the shared two-times boss sprite scale');
assert(phaser.includes('const overlayScale = bossOverlay ? 2 : 1;'),
    'Phaser renderer does not preserve the shared two-times boss sprite scale');
assert(main.includes('getMinimapExitCells:') && main.includes("return '#246f96'"),
    'Shared minimap exit-component/world-sea policy is missing');
assert(phaser.includes("field.getMiniMapTileColor(tile, x, y)"),
    'Phaser minimap bypasses the shared minimap color policy');

if (errors.length) {
    console.error(errors.map(error => `- ${error}`).join('\n'));
    process.exit(1);
}
console.log('Light Palace prison validation passed: compact layout, reciprocal stair, guard-opened front gates, staged Leila recovery/recruitment, holy-knight barriers, assets, and minimap policies.');
