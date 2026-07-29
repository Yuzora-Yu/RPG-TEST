const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const mapPath = path.join(root, 'map.js');
const write = process.argv.includes('--write');

const PERSON_IMAGE_PATTERNS = [
    /^overlay_npc_/,
    /^overlay_companion_/,
    /^overlay_light_captive_/,
    /^overlay_dungeon_adventurer$/,
    /^overlay_town_water_(?:guard|boatman)$/,
    /^overlay_town_fire_(?:resident|coal_carrier)$/,
    /^overlay_town_wind_(?:watch|weaver)$/,
    /^overlay_town_light_pilgrim$/,
    /^overlay_town_demon_guard$/,
    /^guild_girl$/
];

const PLACEMENT_FIELDS = new Set([
    'x', 'y', 'imageKey', 'imageColor', 'minimapColor', 'drawWidth', 'drawHeight',
    'drawOffsetX', 'drawOffsetY', 'drawScale', 'baseTile', 'blocksMovement',
    'interactFromAdjacent', 'interactionArea', 'minimapArea', 'minimapConnect',
    'hideFromMinimap', 'active'
]);
const CONDITION_FIELDS = new Set([
    'requiredFlag', 'requiredFlags', 'missingFlag', 'missingFlags',
    'requiredItems', 'missingItems', 'requiredStoryStep', 'requiredSubStep'
]);

function findClosingBracket(source, openIndex) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    for (let i = openIndex; i < source.length; i += 1) {
        const char = source[i];
        const next = source[i + 1];
        if (lineComment) {
            if (char === '\n') lineComment = false;
            continue;
        }
        if (blockComment) {
            if (char === '*' && next === '/') { blockComment = false; i += 1; }
            continue;
        }
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === '/' && next === '/') { lineComment = true; i += 1; continue; }
        if (char === '/' && next === '*') { blockComment = true; i += 1; continue; }
        if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
        if (char === '[') depth += 1;
        else if (char === ']') {
            depth -= 1;
            if (depth === 0) return i;
        }
    }
    throw new Error(`Unclosed array at ${openIndex}`);
}

function isPersonAction(action) {
    const imageKey = String(action?.imageKey || '');
    return PERSON_IMAGE_PATTERNS.some(pattern => pattern.test(imageKey));
}

function stableSlug(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/^[^a-z]+/, '');
}

function actorName(label, actorId) {
    const cleaned = String(label || '')
        .replace(/(?:と話す|に話す|から話を聞く|に声をかける|を診る|を見る|を聞く|へ声をかける)$/u, '')
        .trim();
    return cleaned || actorId;
}

function splitAction(action) {
    const placement = {};
    const when = {};
    const runtimeAction = {};
    Object.entries(action || {}).forEach(([key, value]) => {
        if (PLACEMENT_FIELDS.has(key)) placement[key] = value;
        else if (CONDITION_FIELDS.has(key)) when[key] = value;
        else runtimeAction[key] = value;
    });
    return { placement, when, action: runtimeAction };
}

function stateIdFor(action, index, used) {
    const base = stableSlug(action.eventId || action.questId || action.type || `state_${index + 1}`) || `state_${index + 1}`;
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}_${suffix++}`;
    used.add(id);
    return id;
}

function buildActors(personActions) {
    const groups = new Map();
    personActions.forEach((action, sourceIndex) => {
        const key = `${Number(action.x)},${Number(action.y)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ action, sourceIndex });
    });
    const actorIdCounts = new Map();
    const actors = [];
    for (const entries of groups.values()) {
        const first = entries[0].action;
        const preferred = stableSlug(first.eventId || first.questId)
            || stableSlug(String(first.imageKey || '').replace(/^overlay_/, ''))
            || `npc_${Number(first.x)}_${Number(first.y)}`;
        const count = (actorIdCounts.get(preferred) || 0) + 1;
        actorIdCounts.set(preferred, count);
        const actorId = count === 1 ? preferred : `${preferred}_${count}`;
        const firstParts = splitAction(first);
        const actor = {
            placementId: actors.length + 1,
            actorId,
            name: actorName(first.label, actorId),
            ...firstParts.placement,
            states: []
        };
        const stateIds = new Set();
        entries.forEach(({ action }, index) => {
            const parts = splitAction(action);
            const placement = {};
            Object.entries(parts.placement).forEach(([key, value]) => {
                if (JSON.stringify(value) !== JSON.stringify(actor[key])) placement[key] = value;
            });
            const state = {
                stateId: stateIdFor(parts.action, index, stateIds),
                priority: entries.length === 1 ? 0 : (entries.length - index) * 100,
                when: parts.when,
                ...(Object.keys(placement).length ? { placement } : {}),
                action: parts.action
            };
            actor.states.push(state);
        });
        actors.push(actor);
    }
    return actors;
}

function indentJson(value, indent) {
    return JSON.stringify(value, null, 4).split('\n').map((line, index) => index === 0 ? line : indent + line).join('\n');
}

let source = fs.readFileSync(mapPath, 'utf8');
const matches = [...source.matchAll(/^(\s*)["']?mapActions["']?\s*:\s*\[/gm)];
const edits = [];
let migratedActions = 0;
let createdActors = 0;

for (const match of matches) {
    const indent = match[1];
    const propertyStart = match.index + indent.length;
    const openIndex = source.indexOf('[', propertyStart);
    const closeIndex = findClosingBracket(source, openIndex);
    const content = source.slice(openIndex + 1, closeIndex);
    let actions;
    try {
        actions = vm.runInNewContext(`[${content}]`, Object.create(null), { timeout: 1000 });
    } catch (error) {
        if (!PERSON_IMAGE_PATTERNS.some(pattern => pattern.test(content))) continue;
        throw new Error(`Cannot parse mapActions at line ${source.slice(0, propertyStart).split('\n').length}: ${error.message}`);
    }
    const people = actions.filter(isPersonAction);
    if (!people.length) continue;
    const remaining = actions.filter(action => !isPersonAction(action));
    let actors = buildActors(people);
    const innerIndent = `${indent}    `;
    const previousActorProperty = source.lastIndexOf('mapActors:', propertyStart);
    let mergedExistingActors = false;
    if (previousActorProperty >= 0) {
        const actorOpen = source.indexOf('[', previousActorProperty);
        const actorClose = findClosingBracket(source, actorOpen);
        if (/^\s*,\s*$/.test(source.slice(actorClose + 1, propertyStart))) {
            const existingActors = vm.runInNewContext(source.slice(actorOpen, actorClose + 1), Object.create(null), { timeout: 1000 });
            const highestId = Math.max(0, ...existingActors.map(actor => Number(actor.placementId) || 0));
            const usedActorIds = new Set(existingActors.map(actor => String(actor.actorId || '')));
            actors = actors.map((actor, index) => {
                const baseId = actor.actorId;
                let actorId = baseId;
                let suffix = 2;
                while (usedActorIds.has(actorId)) actorId = `${baseId}_${suffix++}`;
                usedActorIds.add(actorId);
                return { ...actor, placementId: highestId + index + 1, actorId };
            });
            const combined = [...existingActors, ...actors];
            edits.push({ start: actorOpen, end: actorClose + 1, replacement: indentJson(combined, indent) });
            const prefix = source.slice(0, previousActorProperty);
            const cursorMatch = /nextActorPlacementId\s*:\s*(\d+)\s*,\s*$/.exec(prefix);
            if (cursorMatch) {
                const numberStart = prefix.length - cursorMatch[0].length + cursorMatch[0].indexOf(cursorMatch[1]);
                edits.push({ start: numberStart, end: numberStart + cursorMatch[1].length, replacement: String(combined.length + 1) });
            }
            edits.push({
                start: propertyStart,
                end: closeIndex + 1,
                replacement: `mapActions: ${indentJson(remaining, indent)}`
            });
            mergedExistingActors = true;
        }
    }
    if (!mergedExistingActors) {
        const replacement = [
            `nextActorPlacementId: ${actors.length + 1},`,
            `${indent}mapActors: ${indentJson(actors, indent)},`,
            `${indent}mapActions: ${indentJson(remaining, indent)}`
        ].join('\n');
        edits.push({ start: propertyStart, end: closeIndex + 1, replacement });
    }
    migratedActions += people.length;
    createdActors += actors.length;
}

for (const edit of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, edit.start) + edit.replacement + source.slice(edit.end);
}

console.log(`NPC migration: ${migratedActions} mapActions -> ${createdActors} mapActors across ${edits.length} map/floor definitions.`);
if (write) {
    fs.writeFileSync(mapPath, source, 'utf8');
    console.log(`Updated ${mapPath}`);
} else {
    console.log('Dry run only. Pass --write to apply the mechanical source migration.');
}
