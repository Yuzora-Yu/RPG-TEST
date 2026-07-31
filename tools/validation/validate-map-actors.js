const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const mapSource = fs.readFileSync(path.join(root, 'map.js'), 'utf8');
const storySource = fs.readFileSync(path.join(root, 'story.js'), 'utf8')
    + '\n' + fs.readFileSync(path.join(root, 'abyss_story.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const context = { console, window: {} };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(
    `${mapSource}\nglobalThis.MAPS = { FIXED_MAPS, FIXED_DUNGEON_MAPS };`,
    context,
    { filename: 'map.js' }
);

let actors = 0;
let mapActorMasters = 0;
const errors = [];
const personImagePatterns = [
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

const waterCity = context.MAPS.FIXED_MAPS.WATER_CITY;
if (!waterCity) {
    errors.push('WATER_CITY map is unavailable');
} else {
    waterCity.tiles.forEach((row, y) => {
        [...row].forEach((tile, x) => {
            if (tile === 'C' || tile === 'R') {
                errors.push(`WATER_CITY: legacy chest/soldier tile remains at ${x},${y}: ${tile}`);
            }
        });
    });
    for (const guard of (waterCity.mapActions || []).filter(action => action.eventId === 'water_city_blockade_guard')) {
        if (waterCity.tiles?.[guard.y]?.[guard.x] !== 'T') {
            errors.push(`WATER_CITY: blockade guard must stand on a normal T tile at ${guard.x},${guard.y}`);
        }
    }
}

for (const marker of [
    'isBlockingMapActor',
    'getAdjacentMapActor',
    'prepareAdjacentMapActorAction'
]) {
    if (!mainSource.includes(marker)) errors.push(`missing adjacent actor interaction marker: ${marker}`);
}
for (const marker of ['getAdjacentChest', 'prepareAdjacentChestAction', "tile === 'C' || tile === 'R'"]) {
    if (!mainSource.includes(marker)) errors.push(`missing adjacent chest interaction marker: ${marker}`);
}
function inspectMap(key, mapDef, label) {
    const occupied = new Map();
    const requiredFlags = action => new Set([
        ...(Array.isArray(action?.requiredFlags) ? action.requiredFlags : []),
        ...(action?.requiredFlag ? [action.requiredFlag] : [])
    ]);
    const missingFlags = action => new Set([
        ...(Array.isArray(action?.missingFlags) ? action.missingFlags : []),
        ...(action?.missingFlag ? [action.missingFlag] : [])
    ]);
    const canCoexist = (left, right) => {
        const leftRequired = requiredFlags(left);
        const rightRequired = requiredFlags(right);
        const leftMissing = missingFlags(left);
        const rightMissing = missingFlags(right);
        if ([...leftRequired].some(flag => rightMissing.has(flag))) return false;
        if ([...rightRequired].some(flag => leftMissing.has(flag))) return false;
        return true;
    };
    const validatePlacement = (action, actorLabel) => {
        actors++;
        const x = Number(action.x);
        const y = Number(action.y);
        const coord = `${x},${y}`;
        const priorPlacements = occupied.get(coord) || [];
        if (priorPlacements.some(prior => canCoexist(prior, action))) {
            errors.push(`${label}: duplicate simultaneously-visible actor coordinate ${coord}`);
        }
        priorPlacements.push(action);
        occupied.set(coord, priorPlacements);
        const tile = String(mapDef.tiles?.[y]?.[x] || 'W').toUpperCase();
        if (tile === 'W') errors.push(`${label}: actor placed on wall at ${coord}`);
        const isVisibleEntranceActor = tile === 'D' && action.type === 'fixedDungeon';
        const isPostBossActor = tile === 'B' && (mapDef.bosses || []).some(boss => Number(boss.x) === x && Number(boss.y) === y);
        if (!['T', 'G', 'L', 'M'].includes(tile) && !isVisibleEntranceActor && !isPostBossActor) {
            errors.push(`${label}: actor tile was not normalized at ${coord}: ${tile}`);
        }
        if (action.blocksMovement !== false && !actorLabel) {
            errors.push(`${label}: blocking actor has no interaction label at ${coord}`);
        }
    };
    for (const action of mapDef.mapActions || []) {
        if (personImagePatterns.some(pattern => pattern.test(String(action?.imageKey || '')))) {
            errors.push(`${label}: person image remains in mapActions at ${action.x},${action.y}: ${action.imageKey}`);
        }
        if (!action.imageKey) continue;
        // A position-specific facility image is a building anchor, not an NPC.
        // Its entrance behavior is validated by the facility-specific validator.
        if (String(action.imageKey).startsWith('overlay_building_')) continue;
        validatePlacement(action, action.label);
        if (action.eventId && !storySource.includes(action.eventId)) {
            errors.push(`${label}: missing story event ${action.eventId}`);
        }
        for (const eventId of action.cycleEventIds || []) {
            if (eventId && !storySource.includes(eventId)) {
                errors.push(`${label}: missing cycled story event ${eventId}`);
            }
        }
        for (const event of action.events || []) {
            if (event.eventId && !storySource.includes(event.eventId)) {
                errors.push(`${label}: missing progress story event ${event.eventId}`);
            }
        }
    }

    const placementIds = new Set();
    const actorIds = new Set();
    for (const actor of mapDef.mapActors || []) {
        mapActorMasters++;
        const placementId = Number(actor?.placementId);
        const actorId = String(actor?.actorId || '');
        if (!Number.isInteger(placementId) || placementId < 1 || placementId > 1000) {
            errors.push(`${label}: invalid placementId ${actor?.placementId}`);
        } else if (placementIds.has(placementId)) {
            errors.push(`${label}: duplicate placementId ${placementId}`);
        }
        placementIds.add(placementId);
        if (!/^[a-z][a-z0-9_]*$/.test(actorId)) {
            errors.push(`${label}: invalid actorId ${actorId || '(empty)'}`);
        } else if (actorIds.has(actorId)) {
            errors.push(`${label}: duplicate actorId ${actorId}`);
        }
        actorIds.add(actorId);

        const positions = new Map();
        positions.set(`${Number(actor.x)},${Number(actor.y)}`, actor);
        const stateIds = new Set();
        const priorities = new Set();
        for (const state of actor.states || []) {
            const stateId = String(state?.stateId || '');
            const priority = Number(state?.priority);
            if (!stateId || stateIds.has(stateId)) errors.push(`${label}:${actorId}: invalid or duplicate stateId ${stateId || '(empty)'}`);
            stateIds.add(stateId);
            if (!Number.isFinite(priority) || priorities.has(priority)) errors.push(`${label}:${actorId}: invalid or duplicate priority ${state?.priority}`);
            priorities.add(priority);
            const action = state?.action || {};
            if (!action.type) errors.push(`${label}:${actorId}:${stateId}: action.type is missing`);
            if (!action.label) errors.push(`${label}:${actorId}:${stateId}: action.label is missing`);
            if (action.eventId && !storySource.includes(action.eventId)) errors.push(`${label}:${actorId}:${stateId}: missing story event ${action.eventId}`);
            const placement = { ...actor, ...(state?.when || {}), ...(state?.placement || {}) };
            positions.set(`${Number(placement.x)},${Number(placement.y)}`, placement);
        }
        if (!(actor.states || []).length) errors.push(`${label}:${actorId}: states are missing`);
        positions.forEach(placement => validatePlacement(placement, actor.name || actorId));
    }
    if ((mapDef.mapActors || []).length) {
        const nextId = Number(mapDef.nextActorPlacementId);
        const highestId = Math.max(...placementIds);
        if (!Number.isInteger(nextId) || nextId < 1 || nextId > 1001) {
            errors.push(`${label}: invalid nextActorPlacementId ${mapDef.nextActorPlacementId}`);
        } else if (nextId <= highestId) {
            errors.push(`${label}: nextActorPlacementId ${nextId} would reuse an issued ID`);
        }
    }
}

for (const [key, mapDef] of Object.entries(context.MAPS.FIXED_MAPS)) {
    inspectMap(key, mapDef, key);
}
for (const [key, dungeon] of Object.entries(context.MAPS.FIXED_DUNGEON_MAPS)) {
    for (const [index, floor] of (dungeon.floors || []).entries()) {
        inspectMap(key, floor, `${key}:F${index + 1}`);
    }
}

if (errors.length) throw new Error(`Map actor validation failed:\n${errors.join('\n')}`);
if (mapActorMasters < 84) throw new Error(`Existing NPC migration is incomplete: only ${mapActorMasters} mapActors were validated.`);
const waterGuards = (context.MAPS.FIXED_MAPS.WATER_CITY?.mapActors || [])
    .flatMap(actor => (actor.states || []).map(state => ({ actor, state })))
    .filter(entry => entry.state?.action?.eventId === 'water_city_blockade_guard');
if (waterGuards.length !== 3 || waterGuards.some(entry => entry.state?.when?.missingFlag !== 'waterCityCleared')) {
    throw new Error('All three Water City blockade guards must disappear after the Seabed Temple clear flag.');
}
const forbiddenForestSign = context.MAPS.FIXED_DUNGEON_MAPS.FORBIDDEN_FOREST?.floors?.[0]?.mapActions
    ?.find(action => Number(action.x) === 42 && Number(action.y) === 15);
if (!forbiddenForestSign || forbiddenForestSign.imageKey !== 'maplib_forest_decayed_roadside_sign' ||
    forbiddenForestSign.blocksMovement !== true || forbiddenForestSign.interactFromAdjacent !== true ||
    forbiddenForestSign.type !== 'log') {
    throw new Error('FORBIDDEN_FOREST F1 sign at (42,15) must use the authored sign image and adjacent interaction.');
}
console.log(`Map actor validation passed. Coordinate-based actors checked: ${actors}.`);
console.log(`Stable mapActors masters checked: ${mapActorMasters}; no person sprites remain in mapActions.`);
console.log('Actor positions are walkable, unique, blocking, adjacent-interactable, and linked to existing story events.');
