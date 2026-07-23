const path = require('path');
const { loadMapStoryRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const { context } = loadMapStoryRuntime(root);
context.globalThis.window = context.window;
context.globalThis.window.QUEST_DATA = undefined;
context.globalThis.window = context;
const questsRuntime = require('vm');
const fs = require('fs');
questsRuntime.runInContext(fs.readFileSync(path.join(root, 'quests.js'), 'utf8'), context, { filename: 'quests.js' });

const data = context.STORY_MANAGER_DATA;
const scripts = data?.scripts || {};
const events = data?.events || {};
const errors = [];
const warnings = [];
const referencedScripts = new Set();
const referencedEvents = new Set();

function fail(message) { errors.push(message); }
function visitActions(actions, owner) {
    if (!Array.isArray(actions)) return;
    for (const action of actions) {
        if (!action || typeof action !== 'object') {
            fail(`${owner}: action must be an object`);
            continue;
        }
        if (action.type === 'CONV') {
            referencedScripts.add(action.value);
            if (!Array.isArray(scripts[action.value])) fail(`${owner}: missing conversation script ${action.value}`);
        }
        if (action.type === 'EVENT') {
            referencedEvents.add(action.value);
            if (!events[action.value]) fail(`${owner}: missing nested event ${action.value}`);
        }
        for (const branch of ['then', 'else', 'otherwise', 'yes', 'no']) {
            visitActions(action[branch], `${owner}.${branch}`);
        }
    }
}

for (const [scriptId, lines] of Object.entries(scripts)) {
    if (!Array.isArray(lines) || lines.length === 0) {
        fail(`${scriptId}: conversation must contain at least one line`);
        continue;
    }
    lines.forEach((line, index) => {
        const owner = `${scriptId}[${index}]`;
        if (!line || typeof line !== 'object') return fail(`${owner}: line must be an object`);
        // 現行 story.js では会話列の途中にフィールド演出命令を置ける。
        // これは台詞ではないため name/text を要求しない。
        if (line.type === 'FIELD_CUTSCENE' || line.type === 'MAP_VISUAL') {
            if (!Array.isArray(line.commands)) fail(`${owner}: inline visual command requires commands[]`);
            return;
        }
        if (typeof line.name !== 'string') fail(`${owner}: name must be a string`);
        if (typeof line.text !== 'string' || !line.text.trim()) fail(`${owner}: text must be a non-empty string`);
        if (line.charId !== undefined && (!Number.isInteger(line.charId) || line.charId <= 0)) {
            fail(`${owner}: charId must be a positive integer`);
        }
    });
}

for (const [eventId, event] of Object.entries(events)) {
    visitActions(event?.actions, `${eventId}.actions`);
    visitActions(event?.winActions, `${eventId}.winActions`);
    visitActions(event?.loseActions, `${eventId}.loseActions`);
}

function collectMapEventRefs(mapDef, owner) {
    for (const action of mapDef?.mapActions || []) {
        if (action.eventId) referencedEvents.add(action.eventId);
        for (const variant of action.events || []) if (variant?.eventId) referencedEvents.add(variant.eventId);
        for (const eventId of action.cycleEventIds || []) referencedEvents.add(eventId);
    }
    for (const boss of mapDef?.bosses || []) {
        if (boss.startEventId) referencedEvents.add(boss.startEventId);
        if (boss.storyEventId) referencedEvents.add(boss.storyEventId);
    }
    for (const eventId of referencedEvents) if (!events[eventId]) fail(`${owner}: missing story event ${eventId}`);
}

for (const [mapId, mapDef] of Object.entries(context.FIXED_MAPS || {})) collectMapEventRefs(mapDef, `FIXED_MAPS.${mapId}`);
for (const [dungeonId, dungeon] of Object.entries(context.FIXED_DUNGEON_MAPS || {})) {
    (dungeon.floors || []).forEach((floor, index) => collectMapEventRefs(floor, `FIXED_DUNGEON_MAPS.${dungeonId}.floors[${index}]`));
}

for (const [questId, quest] of Object.entries(context.QUEST_DATA || {})) {
    for (const key of ['startEventId', 'reportEventId']) {
        if (quest[key] && !events[quest[key]]) fail(`QUEST_DATA.${questId}.${key}: missing event ${quest[key]}`);
    }
}

for (const scriptId of Object.keys(scripts)) {
    if (!referencedScripts.has(scriptId)) warnings.push(`unreferenced script: ${scriptId}`);
}

if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
}
console.log(`Story validation passed: ${Object.keys(scripts).length} scripts, ${Object.keys(events).length} events.`);
console.log(`Warnings: ${warnings.length} unreferenced scripts (review separately; not auto-deleted).`);
if (warnings.length) console.log(warnings.join('\n'));
