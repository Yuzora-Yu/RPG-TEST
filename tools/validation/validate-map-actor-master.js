const path = require('path');
const { loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const { context } = loadMapRuntime(root, {
    context: { App: { data: { progress: { flags: {}, storyStep: 0, subStep: 0 }, items: {} } } }
});
const { FIXED_DUNGEON_MAPS, MapRegistry, App } = context;
const prison = FIXED_DUNGEON_MAPS.LIGHT_PALACE?.floors?.[4];

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(prison, 'LIGHT_PALACE floor 5 is unavailable.');
assert((prison.mapActors || []).length === 4, 'LIGHT_PALACE floor 5 must have four authored prisoners.');
const king = prison.mapActors.find(actor => actor.actorId === 'captive_king');
assert(king.placementId === 1, 'The captive king placementId must remain 1.');
assert(prison.nextActorPlacementId === 5, 'The next actor placement ID must reserve the four issued prisoner IDs.');
assert(king.actorId === 'captive_king', 'The captive king actorId must remain stable.');
assert(Number(king.x) === 7 && Number(king.y) === 3, 'The captive king base placement moved unexpectedly.');
assert(!(prison.mapActions || []).some(action => Number(action.x) === 7 && Number(action.y) === 3),
    'Legacy mapActions still overlap the captive king.');

const candidates = MapRegistry.getMapActorActionCandidates(prison).filter(candidate => candidate.actorId === 'captive_king');
assert(candidates.length === 3, `Expected three captive-king state candidates, found ${candidates.length}.`);
assert(candidates.map(candidate => candidate.actorStatePriority).join(',') === '300,200,100',
    'Actor states are not resolved in deterministic descending priority order.');
assert(new Set(candidates.map(candidate => candidate.actorKey)).size === 1,
    'One actor produces multiple persistent actor keys.');
assert(new Set(candidates.map(candidate => candidate.conversationKey)).size === 1,
    'One actor produces multiple conversation-history keys.');
assert(candidates.every(candidate => candidate.x === 7 && candidate.y === 3
    && candidate.imageKey === 'overlay_light_captive_king' && candidate.isMapActorState === true),
    'Actor state candidates do not inherit the base placement and image.');

const selectKing = () => MapRegistry.findMapAction(prison, 7, 3);
App.data.progress.flags = {};
App.data.items = {};
let selected = selectKing();
assert(selected?.actorStateId === 'before_palace_clear'
    && selected?.eventId === 'light_palace_prison_king',
    'Pre-clear state does not select the original king event.');

App.data.progress.flags = { lightPalaceCleared: true };
App.data.items = {};
selected = selectKing();
assert(selected?.actorStateId === 'catalyst_quest'
    && selected?.questId === 'royal_star_catalyst',
    'Post-clear state without the catalyst does not select the quest.');

App.data.items = { 111: 1 };
selected = selectKing();
assert(selected?.actorStateId === 'after_catalyst'
    && selected?.eventId === 'light_palace_prison_king_after_catalyst',
    'Post-catalyst state does not select the follow-up event.');

const movedMap = {
    ...prison,
    mapActors: [{ ...king, x: 9, y: 8 }]
};
const movedCandidate = MapRegistry.getMapActorActionCandidates(movedMap)[0];
assert(movedCandidate.actorKey === candidates[0].actorKey,
    'Moving a character changed its persistent actor key; identity must not depend on coordinates.');

const actions = MapRegistry.getMapActions(prison);
const allActorCandidates = MapRegistry.getMapActorActionCandidates(prison);
assert(actions.length === (prison.mapActions || []).length + allActorCandidates.length,
    'The unified map-action view omitted legacy actions or actor states.');

console.log('Map actor master validation passed: stable ID, deterministic state priority, flag/item transitions, coordinate-independent identity, and legacy-action compatibility.');
