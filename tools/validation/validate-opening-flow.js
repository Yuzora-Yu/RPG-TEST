const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assetsSource = read('assets.js');
const storySource = read('story.js');
const openingSource = read('opening.js');
const mapSource = read('map.js');
const mainSource = read('main.js');
const indexSource = read('index.html');
const swSource = read('sw.js');

const assetContext = { console };
assetContext.window = assetContext;
assetContext.globalThis = assetContext;
vm.createContext(assetContext);
vm.runInContext(`${assetsSource}\nglobalThis.__ASSETS = PRISMA_ASSETS;`, assetContext, { filename: 'assets.js' });
const warmup = assetContext.__ASSETS?.cacheWarmup || {};

const errors = [];
const critical = Array.isArray(warmup.criticalImages) ? warmup.criticalImages : [];
const requiredPreOpImages = [
    'assets/monsters/monster_100001.png',
    'assets/monsters/monster_100002.png',
    'assets/monsters/monster_100003.png',
    'assets/monsters/monster_100004.png',
    'assets/monsters/monster_301000.png',
    'assets/generated/battle-field-ai.png',
    'assets/generated/battle-dungeon-ai.png',
    'assets/generated/battle-flooded-v001.png',
];
for (const src of requiredPreOpImages) {
    if (!critical.includes(src)) errors.push(`pre-OP battle image is not in the critical cache: ${src}`);
}
// ランダムダンジョン宝箱2種も床と同時に表示するため、起動時安全セットへ含める。
if (critical.length > 54) errors.push(`critical cache is no longer limited to the startup-safe set: ${critical.length} images`);
if (!Array.isArray(warmup.initialGraphicKeys) || !warmup.initialGraphicKeys.includes('battle_bg_field')) {
    errors.push('initial graphics do not include the opening battle background');
}
if (!warmup.initialGraphicKeys.includes('battle_bg_dungeon')) errors.push('initial graphics do not include the first-cave battle background');
if (!warmup.initialGraphicKeys.includes('battle_bg_flooded')) errors.push('initial graphics do not include the flooded-floor battle background');
if (!warmup.initialGraphicKeys.includes('overlay_boss_301000')) errors.push('initial graphics do not include the first-cave boss image');
for (const key of [
    'overlay_field_forest', 'overlay_field_house_1', 'overlay_field_house_2', 'overlay_field_cave',
    'overlay_named_dungeon_chest', 'overlay_named_dungeon_chest_rare',
    'overlay_dungeon_chest_empty', 'overlay_dungeon_chest_rare_empty',
]) {
    if (!warmup.initialGraphicKeys.includes(key)) errors.push(`pre-OP map graphic is not loaded at startup: ${key}`);
}
if (!warmup.initialGraphicKeys.includes('inn')) errors.push('Lumina village inn tile is missing from initial graphics');
if (!Array.isArray(warmup.openingImages) || !warmup.openingImages.includes('assets/generated/opening-prism-collapse-v002.png')) {
    errors.push('paper-theater opening image set is incomplete');
}
if (!warmup.openingImages.includes('assets/background/PRISMA ABYSS.png')) errors.push('title-screen logo is missing from the opening cache');
for (const src of [...critical, ...(warmup.openingImages || [])]) {
    if (!fs.existsSync(path.join(root, src))) errors.push(`opening/cache image is missing: ${src}`);
}

const startEvent = storySource.slice(storySource.indexOf('"start_adventure"'), storySource.indexOf('"start_adventure2"'));
if (startEvent.includes('OPENING_KAMISHIBAI') || startEvent.includes('FULL_DATA_PROMPT')) {
    errors.push('start_adventure must not play the opening or show the full-data prompt');
}
const reportEvent = storySource.slice(storySource.indexOf('"start_adventure3"'), storySource.indexOf('"start_village_elder_after"'));
const reportConversationIndex = reportEvent.indexOf('"value": "PROLOGUE3"');
const reportSubIndex = reportEvent.indexOf('"type": "SUB"');
const openingIndex = reportEvent.indexOf('"type": "OPENING_KAMISHIBAI"');
const promptIndex = reportEvent.indexOf('"type": "FULL_DATA_PROMPT"');
if (!(reportConversationIndex >= 0 && reportSubIndex > reportConversationIndex && openingIndex > reportSubIndex)) {
    errors.push('start_adventure3 must finish PROLOGUE3, advance subStep, then play the opening');
}
if (promptIndex >= 0) errors.push('start_adventure3 must not repeat the startup full-data prompt after the opening');
if (!openingSource.includes("const PRISMA_OPENING_IMAGE = 'assets/generated/opening-prism-collapse-v002.png'")) errors.push('opening does not use the generated collapse illustration');
if (!openingSource.includes('autoTimer = setTimeout(advance')) errors.push('opening does not auto-advance');
const openingSceneCount = (openingSource.match(/\{ (?:logo: true, )?text: /g) || []).length;
if (openingSceneCount !== 10) errors.push(`opening must contain 9 concise story lines plus the title logo: ${openingSceneCount}`);
if (!openingSource.includes("const PRISMA_OPENING_LOGO = 'assets/background/PRISMA ABYSS.png'")) errors.push('opening does not reuse the title-screen logo');
if (!openingSource.includes('prisma-opening__entry-curtain')) errors.push('opening does not insert a blackout transition');
for (const spoiler of ['アルス', 'リュミナ村', '風の集落', '水上都市', '雷の要塞', '光の宮殿', '闇の城']) {
    if (openingSource.includes(spoiler)) errors.push(`opening reveals a later-region detail: ${spoiler}`);
}

for (const marker of [
    'openingPrologue3Viewed',
    'handleInitialFullDataDownload',
    'resolveCycledMapActionEventId',
    'cycleEventIds'
]) {
    if (!storySource.includes(marker) && !mainSource.includes(marker) && !mapSource.includes(marker)) {
        errors.push(`opening/village runtime marker is missing: ${marker}`);
    }
}

const initHub = mainSource.slice(mainSource.indexOf('initGameHub:'), mainSource.indexOf('startGameLogic:'));
if (!initHub.includes('await App.handleInitialFullDataDownload()')) errors.push('game startup does not ask whether to wait for the full cache');
if (!initHub.includes('App.warmImageCache();')) errors.push('game startup does not always start the full background cache after loading');
const initialCacheHandler = mainSource.slice(
    mainSource.indexOf('handleInitialFullDataDownload:'),
    mainSource.indexOf('handlePostPrologueFullDataDownload:')
);
if (!initialCacheHandler.includes('バックグラウンドで全データのキャッシュを進めます')) {
    errors.push('startup prompt does not explain that No still performs the full background cache');
}
if (!initialCacheHandler.includes('App.setDeclinedInitialFullDataPrompt(true)')) errors.push('startup prompt choice is not remembered');
if (initialCacheHandler.includes('裏側で全量取得しない')) errors.push('obsolete no-background-cache policy remains in the startup handler');
if (mainSource.includes("fullDataCacheName: 'prisma-abyss-v3.89-forest-sign-runtime-assets'") === false) {
    errors.push('main.js full cache version is not the current full-cache version');
}
if (!swSource.includes('const RUNTIME_CACHE_NAME = "prisma-abyss-v3.89-forest-sign-runtime-assets"')) {
    errors.push('main.js and sw.js runtime cache versions are not aligned');
}
const allRegisteredImages = [
    ...Object.values(assetContext.__ASSETS?.graphics || {}),
    ...Object.values(assetContext.__ASSETS?.battleFx || {})
].filter(Boolean);
const installImages = Array.isArray(warmup.installImages) ? warmup.installImages : [];
for (const src of allRegisteredImages) {
    if (!installImages.includes(src)) errors.push(`registered image is missing from the full cache: ${src}`);
}
if (!mainSource.includes('refreshVisualState: () =>')) errors.push('Field static-layer refresh entry point is missing');
if (!assetsSource.includes('PhaserFieldRenderer.refresh();')) errors.push('lazy graphic completion does not invalidate the Phaser static layer');
const storyLogicSource = read('story_logic.js');
if (!storyLogicSource.includes('this.refreshFieldAfterStoryStateChange();')) errors.push('story completion does not refresh the field visual state');

const mapContext = { console, window: {} };
mapContext.globalThis = mapContext;
vm.createContext(mapContext);
vm.runInContext(`${mapSource}\nglobalThis.__MAPS = FIXED_MAPS; globalThis.__DUNGEONS = FIXED_DUNGEON_MAPS;`, mapContext, { filename: 'map.js' });
const startVillage = mapContext.__MAPS?.START_VILLAGE;
const villageCaveEntrance = (startVillage?.mapActions || []).find(action => action.target === 'START_CAVE');
if (!villageCaveEntrance) errors.push('START_CAVE entrance action is missing from Lumina village');
if (villageCaveEntrance?.imageKey) errors.push('unwanted villager image remains on the village cave entrance');
const caveGuard = (mapContext.__DUNGEONS?.START_CAVE?.mapActions || []).find(action => action.x === 15 && action.y === 17);
if (caveGuard?.imageKey !== 'overlay_npc_villager') errors.push('existing START_CAVE lookout does not use the villager image');
if (!Array.isArray(caveGuard?.events) || caveGuard.events.length < 2) errors.push('existing START_CAVE lookout events are incomplete');
const cyclingResidents = (startVillage?.mapActions || []).filter(action => Array.isArray(action.cycleEventIds));
if (cyclingResidents.length !== 3) errors.push(`expected 3 cycling Lumina residents, found ${cyclingResidents.length}`);
for (const resident of cyclingResidents) {
    for (const eventId of resident.cycleEventIds) {
        if (!storySource.includes(`"${eventId}"`)) errors.push(`cycling resident event is missing: ${eventId}`);
    }
}

for (const file of ['opening.css', 'opening.js']) {
    if (!indexSource.includes(file)) errors.push(`index.html does not load ${file}`);
    if (!swSource.includes(file)) errors.push(`Service Worker app shell does not include ${file}`);
}

if (errors.length) throw new Error(`Opening flow validation failed:\n${errors.join('\n')}`);
console.log(`Opening flow validation passed. Critical images: ${critical.length}. Opening scenes: ${openingSceneCount}.`);
console.log(`Lumina cycling residents: ${cyclingResidents.length}. Existing cave lookout: adjacent villager actor.`);
