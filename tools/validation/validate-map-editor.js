const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const editorSource = fs.readFileSync(path.join(root, 'map_story_editor.html'), 'utf8');
const mapSource = fs.readFileSync(path.join(root, 'map.js'), 'utf8');
const storySource = fs.readFileSync(path.join(root, 'story.js'), 'utf8');
const assetsSource = fs.readFileSync(path.join(root, 'assets.js'), 'utf8');
const phaserFieldSource = fs.readFileSync(path.join(root, 'phaser-field.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const sharedRenderSource = fs.readFileSync(path.join(root, 'map_render_shared.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const inlineScripts = [...editorSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(Boolean);
inlineScripts.forEach((source, index) => {
    try {
        new Function(source);
    } catch (error) {
        throw new Error(`map_story_editor inline script ${index} has a syntax error: ${error.message}`);
    }
});
new Function(sharedRenderSource);

for (const requiredScript of ['assets.js', 'map.js', 'maps_logic.js', 'map_render_shared.js']) {
    assert(editorSource.includes(`<script src="${requiredScript}"></script>`), `Editor does not load runtime source ${requiredScript}.`);
}
assert(indexSource.includes('<script src="map_render_shared.js"></script>'), 'The game does not load the shared map render resolver.');

for (const marker of [
    "editorTool:'tile'",
    'placementToolsHtml(map, ent)',
    'mapChipLibraryAssets()',
    'placeTextileRect(',
    'placePropAt(',
    'editHazardAt(',
    'removePlacementAt(',
    'wallFaceKeyForEditor(',
    'drawEditorFixedDecorations(',
    'drawEditorWorldDecoration(',
    'MAP_FLOOR_DECOR_THEMES',
    'DUNGEON_WALL_FACE_THEMES',
    'WORLD_BRIDGES',
    'effectiveMapForRender(',
    'renderShared.resolveTileVariant(',
    'renderShared.textileCellPlan(',
    'renderShared.floorDecorationPlan(',
    'renderShared.wallFacePlan(',
]) {
    assert(editorSource.includes(marker), `Editor runtime feature is missing: ${marker}`);
}

assert(editorSource.includes("['ice','poison'].includes(type) && isCellReserved(map,x,y)"), 'Editor preview does not prioritize walls and protected cells over ice/poison.');
assert(editorSource.includes("editorManaged:true,points:[]"), 'Editor hazard brush does not keep its additions isolated from authored ranges.');
assert(editorSource.includes("effect.excludePoints.push({x,y})"), 'Editor hazard eraser does not preserve authored rectangles through excludePoints.');
assert(editorSource.includes("meta.role==='blocking'"), 'Editor does not separate passable and blocking map props.');
assert(editorSource.includes("type:'image',imageKey:meta.key"), 'Editor does not emit passable image decorations.');

assert(mapSource.includes('const MAP_FLOOR_DECOR_THEMES = Object.freeze({'), 'Shared floor decoration registry is missing from map.js.');
assert(mapSource.includes('window.MAP_FLOOR_DECOR_THEMES = MAP_FLOOR_DECOR_THEMES'), 'Shared floor decoration registry is not exported.');
assert(phaserFieldSource.includes('window.MAP_FLOOR_DECOR_THEMES || Object.freeze({'), 'Game renderer does not consume the shared floor decoration registry.');
assert(phaserFieldSource.includes("definition?.type !== 'image' || !definition.imageKey"), 'Game renderer cannot draw editor-placed passable image decorations.');
assert(phaserFieldSource.includes('getFixedFloorDecorationsAt'), 'Game renderer still resolves only one fixed decoration per cell.');
assert(phaserFieldSource.includes('renderShared.textileCellPlan('), 'Game renderer does not share textile edge resolution with the editor.');
assert(phaserFieldSource.includes('renderShared.floorDecorationPlan('), 'Game renderer does not share floor decoration selection with the editor.');
assert(mainSource.includes('window.MapRenderShared.resolveTileVariant('), 'Game renderer does not share tile variant selection with the editor.');
assert(mainSource.includes('window.MapRenderShared.wallFacePlan('), 'Game renderer does not share dungeon wall-face selection with the editor.');

const context = { console };
context.window = context;
vm.createContext(context);
vm.runInContext(
    `${sharedRenderSource}\n${assetsSource}\n${mapSource}\n${storySource}\n;globalThis.__EDITOR_VALIDATION__ = { PRISMA_ASSETS, PRISMA_MAP_CHIP_LIBRARY_GROUPS, PRISMA_MAP_CHIP_DECORATION_SLUGS, MAP_FLOOR_DECOR_THEMES, DUNGEON_WALL_FACE_THEMES, WORLD_BRIDGES, FIXED_MAPS, FIXED_DUNGEON_MAPS, STORY_MANAGER_DATA, MapRenderShared };`,
    context,
    { filename: 'editor-runtime-data.js' }
);
const data = context.__EDITOR_VALIDATION__;
const shared = data.MapRenderShared;
assert(shared.resolveTileVariant({ img: 'base', variants: ['a', 'b', 'c'] }, 7, 11).img === shared.resolveTileVariant({ img: 'base', variants: ['a', 'b', 'c'] }, 7, 11).img, 'Shared tile variants are not deterministic.');
const textilePlan = shared.textileCellPlan({ type: 'castle_carpet', x: 3, y: 4, width: 2, height: 3 }, 3, 4);
assert(textilePlan?.open?.n && textilePlan?.open?.w && !textilePlan?.open?.s, 'Shared textile edge plan is invalid.');
const wallPlan = shared.wallFacePlan({ map: { tiles: ['WWW', 'WTW'], wallFaceTheme: { img: 'wall_face' } }, theme: { W: {} }, x: 1, y: 0, upper: 'W', entityType: 'dungeon' });
assert(wallPlan?.key === 'wall_face', 'Shared wall-face resolver cannot identify an exposed wall.');
const libraryKeys = [];
Object.entries(data.PRISMA_MAP_CHIP_LIBRARY_GROUPS).forEach(([theme, slugs]) => {
    slugs.forEach(slug => libraryKeys.push(`maplib_${theme}_${slug}`));
});
assert(libraryKeys.length >= 90, `Editor map prop library unexpectedly small: ${libraryKeys.length}.`);
libraryKeys.forEach(key => assert(data.PRISMA_ASSETS.graphics[key], `Editor library key is not registered: ${key}`));
assert(Object.keys(data.MAP_FLOOR_DECOR_THEMES).length >= 15, 'Shared floor decoration registry is incomplete.');
assert(Object.keys(data.DUNGEON_WALL_FACE_THEMES).length >= 15, 'Shared wall-face registry is incomplete.');
assert(data.WORLD_BRIDGES.length === 3, `Editor world bridge registry differs from the game: ${data.WORLD_BRIDGES.length}.`);

const storyEventIds = new Set(Object.keys(data.STORY_MANAGER_DATA?.events || {}));
const validateEventReferences = (mapDef, label) => {
    for (const [index, boss] of (mapDef.bosses || []).entries()) {
        for (const field of ['startEventId', 'storyEventId']) {
            if (boss?.[field]) assert(storyEventIds.has(boss[field]), `${label} bosses#${index}.${field} is missing: ${boss[field]}`);
        }
    }
    for (const [index, action] of (mapDef.mapActions || []).entries()) {
        if (action.eventId) assert(storyEventIds.has(action.eventId), `${label} mapActions#${index}.eventId is missing: ${action.eventId}`);
        for (const eventId of action.cycleEventIds || []) {
            assert(storyEventIds.has(eventId), `${label} mapActions#${index}.cycleEventIds is missing: ${eventId}`);
        }
        for (const event of action.events || []) {
            if (event?.eventId) assert(storyEventIds.has(event.eventId), `${label} mapActions#${index}.events is missing: ${event.eventId}`);
        }
    }
};
Object.entries(data.FIXED_MAPS).forEach(([key, mapDef]) => validateEventReferences(mapDef, key));
Object.entries(data.FIXED_DUNGEON_MAPS).forEach(([key, dungeon]) => {
    (dungeon.floors || [dungeon]).forEach((floor, index) => validateEventReferences(floor, `${key}:F${index + 1}`));
});

const gozaPlacements = [];
for (const map of Object.values(data.FIXED_MAPS)) {
    gozaPlacements.push(...(map.floorDecorations || []).filter(entry => entry?.type === 'village_goza'));
}
for (const dungeon of Object.values(data.FIXED_DUNGEON_MAPS)) {
    for (const floor of dungeon.floors || [dungeon]) {
        gozaPlacements.push(...(floor.floorDecorations || []).filter(entry => entry?.type === 'village_goza'));
    }
}
assert(gozaPlacements.length === 0, `Goza must remain unplaced until manual editor work: ${gozaPlacements.length}.`);

console.log(`Map editor validation passed. Inline scripts: ${inlineScripts.length}. Placeable library props: ${libraryKeys.length}. Shared floor themes: ${Object.keys(data.MAP_FLOOR_DECOR_THEMES).length}.`);
