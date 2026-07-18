const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assetsSource = read('assets.js');
const mainSource = read('main.js');
const battleSource = read('battle.js');
const phaserSource = read('phaser-field.js');
const storyLogicSource = read('story_logic.js');
const swSource = read('sw.js');
const facilitiesSource = read('facilities.js');
const dungeonSource = read('dungeon.js');

const context = { console };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${assetsSource}\nglobalThis.__ASSETS = PRISMA_ASSETS;`, context, { filename: 'assets.js' });

const warmup = context.__ASSETS.cacheWarmup;
const errors = [];
const requiredKeys = [
  'sea', 'mountain', 'Low_mountain', 'overlay_field_village',
  'overlay_field_forest', 'overlay_field_house_1', 'overlay_field_house_2', 'overlay_field_cave',
  'overlay_world_bridge_wood',
  'overlay_dungeon_chest', 'overlay_dungeon_chest_rare',
  'overlay_dungeon_stairs',
  'wall', 'dungeon_floor', 'overlay_npc_villager', 'overlay_boss_301000',
  'battle_bg_field', 'battle_bg_dungeon', 'battle_bg_flooded',
  'hero_wing_down_1', 'hero_wing_down_2', 'hero_wing_up_1', 'hero_wing_up_2',
  'hero_wing_left_1', 'hero_wing_left_2', 'hero_wing_right_1', 'hero_wing_right_2'
];
const adventurerFrameKeys = ['down_1', 'down_2', 'left_1', 'left_2', 'right_1', 'right_2', 'up_1', 'up_2']
  .map(suffix => `overlay_dungeon_adventurer_${suffix}`);
const requiredFiles = [
  'assets/generated/battle-field-ai.png',
  'assets/generated/battle-dungeon-ai.png',
  'assets/generated/battle-flooded-v001.png',
  'assets/map/terrain/terrain_sea_v001.png',
  'assets/map/objects/object_field_mountain_v002.png',
  'assets/map/objects/object_field_low_mountain_v002.png',
  'assets/map/overlays/overlay_field_village_v002.png',
  'assets/map/overlays/overlay_dungeon_chest_v002.png',
  'assets/map/overlays/overlay_dungeon_chest_rare_v002.png',
  'assets/map/overlays/overlay_dungeon_stairs_v002.png',
  'assets/monsters/monster_100001.png',
  'assets/monsters/monster_100002.png',
  'assets/monsters/monster_100003.png',
  'assets/monsters/monster_100004.png',
  'assets/monsters/monster_301000.png',
  'assets/effect/fx_phys_slash_arc_v002.png'
];

for (const key of requiredKeys) {
  if (!warmup.initialGraphicKeys.includes(key)) errors.push(`startup graphic key missing: ${key}`);
}
for (const key of adventurerFrameKeys) {
  const file = context.__ASSETS.graphics[key];
  if (!file || !fs.existsSync(path.join(root, file))) errors.push(`adventurer animation frame missing: ${key}`);
}
for (const file of requiredFiles) {
  if (!warmup.criticalImages.includes(file)) errors.push(`critical cached image missing: ${file}`);
  if (!fs.existsSync(path.join(root, file))) errors.push(`critical image file missing: ${file}`);
}

if (!mainSource.includes('refreshVisualState: () =>')) errors.push('Field.refreshVisualState is missing');
if (!mainSource.includes("typeof PhaserFieldRenderer.refresh === 'function'")) errors.push('Field refresh does not invalidate Phaser');
if (!assetsSource.includes('PhaserFieldRenderer.refresh();')) errors.push('lazy image completion does not rebuild the static layer');
if (!phaserSource.includes('state.lastStaticSignature = null;\n            sync(state.pendingField);')) errors.push('Phaser refresh does not clear the static signature');
if (!phaserSource.includes('const RENDER_BUCKET_SIZE = 4;')) errors.push('static map rendering is not bucketed');
if (!phaserSource.includes('const VIEW_PADDING = RENDER_BUCKET_SIZE;')) errors.push('bucketed map rendering lacks matching offscreen padding');
if (!mainSource.includes("isPlayerOnFloodedWater: () => Field.isFloodedWaterAt(Field.x, Field.y)")) errors.push('flooded-floor boat rendering is not tied to the current water tile');
if (!mainSource.includes('const isFloodedBoat = Field.isPlayerOnFloodedWater();')) errors.push('canvas renderer still shows the boat on flooded-floor platforms');
if (!phaserSource.includes("typeof field.isPlayerOnFloodedWater === 'function' && field.isPlayerOnFloodedWater()")) errors.push('Phaser renderer still shows the boat on flooded-floor platforms');
const signatureStart = phaserSource.indexOf('const getStaticSignature = (field) =>');
const signatureEnd = phaserSource.indexOf('const drawPlayer =', signatureStart);
const signatureBlock = phaserSource.slice(signatureStart, signatureEnd);
if (signatureBlock.includes('\n            field.x,') || signatureBlock.includes('\n            field.y,')) errors.push('exact player coordinates still rebuild the entire static map every step');
if (!signatureBlock.includes("field.currentMapData?.themeKey || 'DEFAULT'") || !signatureBlock.includes("dungeon.visualThemeId || ''")) {
  errors.push('random dungeon theme changes do not invalidate the static Phaser tile layer');
}
const stableBranch = phaserSource.slice(phaserSource.indexOf('if (state.lastStaticSignature === staticSignature)'), phaserSource.indexOf('destroyObjects(state.worldObjects)'));
if (!stableBranch.includes("field.drawHudMinimap()")) errors.push('bucket reuse does not refresh the HUD minimap');
const atmosphereStart = phaserSource.indexOf('const drawAtmosphere =');
const atmosphereEnd = phaserSource.indexOf('const getStaticSignature =', atmosphereStart);
const atmosphereBlock = phaserSource.slice(atmosphereStart, atmosphereEnd);
if (!atmosphereBlock.includes('if ((!dungeon && !isSummitTemple)')) errors.push('town/village atmosphere darkness is not disabled outside the authored Summit cloud-shadow exception');
if (atmosphereBlock.includes('edgeAlpha') || atmosphereBlock.includes('scene.scale.height - 26')) errors.push('dungeon black edge rectangles are still rendered');
if (!atmosphereBlock.includes('atmosphereMargin = TILE_SIZE') || !atmosphereBlock.includes('logicalWidth + atmosphereMargin * 2')) errors.push('dungeon darkness does not cover the one-tile camera margin');
if (!atmosphereBlock.includes('duration: 3000') || !atmosphereBlock.includes("stableHash(areaKey, floor, index)")) errors.push('dungeon motes are not persistent three-second animations');
if (atmosphereBlock.includes('stableHash(areaKey, field.x, field.y')) errors.push('dungeon motes still jump with player movement');
if (!atmosphereBlock.includes('playerLightX = Number(field.x)') || !atmosphereBlock.includes('light.setScrollFactor(1)')) errors.push('dungeon center light is not anchored to the hero world position');
const playerStart = phaserSource.indexOf('const drawPlayer =');
const playerEnd = phaserSource.indexOf('const sync =', playerStart);
const playerBlock = phaserSource.slice(playerStart, playerEnd);
if (playerBlock.includes('scene.add.circle(px, py - TILE_SIZE / 2, 10, 0xffffff)')) errors.push('missing wing frame still falls back to a white circle');
if (!playerBlock.includes("fallbackKeys.find")) errors.push('player texture fallback chain is missing');
if (!playerBlock.includes('state.atmosphereLight.setPosition(px, py - TILE_SIZE / 2)')) errors.push('dungeon center light is not updated with the hero every frame');
if (!playerBlock.includes('addShadow(scene, px, py - 2, 16, 0.34')) errors.push('player foot shadow is not confined to a visible contact shadow beneath the feet');
if (!phaserSource.includes('!parts.worldOverlay && !wallOverlay && !building')) errors.push('world map point tiles can still receive synthetic object shadows');
const changeSceneStart = mainSource.indexOf('changeScene: (sceneId) =>');
const fieldObjectStart = mainSource.indexOf('const Field =', changeSceneStart);
const changeSceneBlock = mainSource.slice(changeSceneStart, fieldObjectStart);
const hideIndex = changeSceneBlock.indexOf("target.style.visibility = 'hidden'");
const initIndex = changeSceneBlock.indexOf('Field.init();');
const refreshIndex = changeSceneBlock.indexOf('Field.refreshVisualState()');
const revealIndex = changeSceneBlock.indexOf("target.style.visibility = ''", hideIndex + 1);
if (!(hideIndex >= 0 && initIndex > hideIndex && refreshIndex > initIndex && revealIndex > refreshIndex)) {
  errors.push('field scene must be hidden, constructed, refreshed, and only then revealed');
}

const refreshHelperStart = storyLogicSource.indexOf('refreshFieldAfterStoryStateChange: function()');
const refreshHelperEnd = storyLogicSource.indexOf('getPostBattleBossVisualContext:', refreshHelperStart);
const refreshHelper = storyLogicSource.slice(refreshHelperStart, refreshHelperEnd);
const actionIndex = refreshHelper.indexOf('Field.refreshCurrentAction');
const visualIndex = refreshHelper.indexOf('Field.refreshVisualState');
if (!(actionIndex >= 0 && visualIndex > actionIndex)) errors.push('story refresh must update action state before rebuilding visuals');
const questActionStart = mainSource.indexOf("if (action.type === 'quest' && action.questId");
const questActionEnd = mainSource.indexOf("if (action.type === 'shop'", questActionStart);
const questActionBlock = mainSource.slice(questActionStart, questActionEnd);
if (!questActionBlock.includes("typeof Field.refreshVisualState === 'function'") || !questActionBlock.includes('Field.refreshCurrentAction')) {
  errors.push('quest acceptance does not immediately rebuild static NPC visuals and action state after conversation');
}

const eventRefreshCount = (storyLogicSource.match(/this\.refreshFieldAfterStoryStateChange\(\);/g) || []).length;
if (eventRefreshCount < 4) errors.push(`story state refresh coverage is incomplete: ${eventRefreshCount}`);
const installStart = swSource.indexOf('self.addEventListener("install"');
const activateStart = swSource.indexOf('self.addEventListener("activate"');
const installBlock = swSource.slice(installStart, activateStart);
if (installBlock.includes('Promise.allSettled')) errors.push('Service Worker update can activate with an incomplete critical cache');
if (!swSource.includes('const uniqueFiles = Array.from(new Set(files || []))') || !installBlock.includes('precacheRequiredList(cache, INSTALL_IMAGE_PRECACHE')) {
  errors.push('Service Worker install does not require the deduplicated critical image set');
}
if (!swSource.includes('key.startsWith("prisma-abyss-")')) errors.push('Service Worker cache cleanup is not scoped to this game');
if (!facilitiesSource.includes("? App.hasEnteredAbyss()")) errors.push('inn teleport visibility is not gated by first Abyss entry');
if (!facilitiesSource.includes(": '';")) errors.push('locked inn teleport door is not fully hidden');
if (!dungeonSource.includes('App.data.progress.flags.abyssFirstEntered = true')) errors.push('first Abyss entry flag is not recorded');
if (!mainSource.includes('teleport: false')) errors.push('inn teleport still defaults unlocked');
const moveStart = mainSource.indexOf('move: (dx, dy) =>');
const renderStart = mainSource.indexOf('render: () =>', moveStart);
const moveBlock = mainSource.slice(moveStart, renderStart);
if (moveBlock.includes("document.getElementById('msg-text')") || moveBlock.includes("logEl.innerHTML = ''")) errors.push('field movement still clears the latest log text after one step');
if (!mainSource.includes('getAdjacentDungeonAdventurer: () =>') || !mainSource.includes('prepareAdjacentDungeonAdventurerAction')) errors.push('random dungeon adventurer lacks adjacent talk handling');
if (!moveBlock.includes('Dungeon.isAdventurerAt(nx, ny)')) errors.push('player can still step onto the random dungeon adventurer');
const dungeonMoveStart = dungeonSource.indexOf('handleMove: (x, y) =>');
const dungeonMoveEnd = dungeonSource.indexOf('openChest:', dungeonMoveStart);
if (dungeonSource.slice(dungeonMoveStart, dungeonMoveEnd).includes('Dungeon.encounterAdventurer({ auto: true })')) errors.push('adventurer conversation still triggers by stepping onto the NPC');
if (!dungeonSource.includes('if (playerDistance <= 1) return;')) errors.push('walking adventurer can leave while adjacent talk is available');
if (!dungeonSource.includes('getAdventurerGraphicKey:') || !dungeonSource.includes("adv.direction = d.dy > 0 ? 'down'")) errors.push('walking adventurer lacks directional two-step animation state');
const choiceStart = storyLogicSource.indexOf('showChoice: function');
const choiceEnd = storyLogicSource.indexOf('showConversation: async', choiceStart);
if (!storyLogicSource.slice(choiceStart, choiceEnd).includes('this.clearStoryPortrait();')) errors.push('choice UI can retain a portrait from the previous conversation');
const adventurerConversationStart = dungeonSource.indexOf('encounterAdventurer: async');
const adventurerConversationEnd = dungeonSource.indexOf('encounterAbyssRift:', adventurerConversationStart);
const adventurerConversation = dungeonSource.slice(adventurerConversationStart, adventurerConversationEnd);
if ((adventurerConversation.match(/hidePortrait:\s*true/g) || []).length < 2) errors.push('adventurer prompt/reward conversation does not explicitly suppress portraits');
const rewardConversationIndex = adventurerConversation.indexOf('await StoryManager.showConversation(key, 0)');
const removeAdventurerIndex = adventurerConversation.indexOf('App.data.dungeon.adventurer = null');
if (!(rewardConversationIndex >= 0 && removeAdventurerIndex > rewardConversationIndex)) errors.push('adventurer is removed before the reward conversation finishes');
const startupDungeonRestore = mainSource.slice(mainSource.indexOf('if (App.data.dungeon && App.data.dungeon.map)'), mainSource.indexOf('if (App.data.battle && App.data.battle.active)'));
if (!startupDungeonRestore.includes('Dungeon.createRandomFieldMapData()')) errors.push('startup restore still drops the random dungeon visual theme');
const fieldObjectIndex = mainSource.indexOf('const Field =');
const fieldInitStart = mainSource.indexOf('init: () =>', fieldObjectIndex);
const fieldInitEnd = mainSource.indexOf('getCurrentAreaKey:', fieldInitStart);
const fieldInitBlock = mainSource.slice(fieldInitStart, fieldInitEnd);
if (!fieldInitBlock.includes('Field.currentMapData = Dungeon.createRandomFieldMapData();')) errors.push('Field.init still overwrites restored random dungeon metadata with a legacy abyss map');
if (fieldInitBlock.includes("name: STORY_DATA.areas['ABYSS'].name")) errors.push('Field.init retains the legacy theme-less random dungeon reconstruction');
if (!dungeonSource.includes('createRandomFieldMapData: () =>')) errors.push('random dungeon field metadata lacks a single reconstruction path');
if (!dungeonSource.includes('randomVisualThemeTestOverrideId: null')) errors.push('temporary forest QA override is still enabled in the normal build');
const mapPartsStart = mainSource.indexOf('getMapDrawParts:');
const mapPartsEnd = mainSource.indexOf('getCurrentMapChangeKey:', mapPartsStart);
const mapPartsBlock = mainSource.slice(mapPartsStart, mapPartsEnd);
if (!mapPartsBlock.includes("img: upper === 'R' ? 'overlay_dungeon_chest_rare' : 'overlay_dungeon_chest'")) errors.push('random dungeon chests are not transparent overlays');
if (!mapPartsBlock.includes("randomDungeonChestOverlay || randomDungeonStairsOverlay\n                ? 'T'")) errors.push('random dungeon chest/stair overlays are not drawn over the selected theme floor');
if (!mapPartsBlock.includes("upper === 'S'\n            ? { img: 'overlay_dungeon_stairs'")) errors.push('random dungeon stairs are not guaranteed transparent overlays');
if (!mainSource.includes('if (useDepthRendering && !parts.worldOverlay && !wallOverlay')) errors.push('legacy renderer can still add shadows to world map point tiles');
const wallGraphicStart = mainSource.indexOf('getDungeonWallGraphicForDraw:');
const wallGraphicEnd = mainSource.indexOf('getBattleBg:', wallGraphicStart);
const wallGraphicBlock = mainSource.slice(wallGraphicStart, wallGraphicEnd);
if (!wallGraphicBlock.includes('window.MapRenderShared.wallFacePlan({')) errors.push('dungeon wall faces do not use the game/editor shared resolver');
if (!wallGraphicBlock.includes('theme: { W: sharedWallTile }')) errors.push('water-surface W tile metadata is not passed to the shared wall resolver');
if (!wallGraphicBlock.includes('wallFaceTheme: sharedWallFaceTheme')) errors.push('theme-specific wall accents are not passed to the shared wall resolver');
if (!wallGraphicBlock.includes('tileAtFn: (x, y) => Field.getRenderedTileForDraw(x, y, mapW, mapH, areaKey)')) errors.push('wall faces no longer evaluate exposed rows through runtime map mutations');
const wallThemeMapSource = read('map.js');
const wallThemeContext = { console, window: {} };
wallThemeContext.globalThis = wallThemeContext;
vm.createContext(wallThemeContext);
vm.runInContext(`${wallThemeMapSource}\nglobalThis.__WALL_THEMES = DUNGEON_WALL_FACE_THEMES;`, wallThemeContext, { filename: 'map.js' });
const wallThemeRegistry = wallThemeContext.__WALL_THEMES || {};
for (const themeKey of ['START_CAVE', 'FIRE_VILLAGE', 'WIND_VILLAGE', 'WIND_HOLE', 'BIG_TOWER', 'THUNDER_FORT', 'LIGHT_PALACE', 'DARK_CASTLE', 'GALVANIA_CAVE', 'DARK_SHRINE_RUINS', 'GREZELIA_CAVE']) {
  if (!wallThemeRegistry[themeKey]?.img) errors.push(`wall-face registry is missing ${themeKey}`);
}
if (wallThemeRegistry.FORBIDDEN_FOREST?.disabled !== true || wallThemeRegistry.FORBIDDEN_FOREST?.reason !== 'theme-wall-variants') errors.push('Forbidden Forest no longer preserves its authored wall variants');
for (const waterThemeKey of ['CRENA_CAVE', 'SEABED_TEMPLE']) {
  if (wallThemeRegistry[waterThemeKey]?.disabled !== true || wallThemeRegistry[waterThemeKey]?.reason !== 'water-surface-W') errors.push(`water-surface theme is not explicitly excluded: ${waterThemeKey}`);
}
if (phaserSource.includes('overlay_decor_stone_cracks') || !phaserSource.includes("LIGHT_PALACE: { key: 'overlay_decor_light_palace_prism'")) {
  errors.push('Light Palace still receives generic gray floor debris instead of its prism inlay');
}
for (const assetKey of ['tile_fire_wall_face', 'tile_wind_temple_wall_face', 'tile_wind_hole_wall_face', 'tile_tower_wall_face', 'tile_thunder_wall_face', 'tile_light_wall_face', 'tile_light_wall_face_prism', 'tile_dark_castle_wall_face', 'tile_galvania_wall_face', 'tile_grezelia_wall_face']) {
  if (!assetsSource.includes(`${assetKey}: "assets/map/terrain/`)) errors.push(`generated wall-face asset is not registered: ${assetKey}`);
}
if (assetsSource.includes('tile_forbidden_forest_wall_face:')) errors.push('unused single-image Forbidden Forest wall face is still in the full image cache');
if (!mainSource.includes("Field.getDungeonWallFaceModeForDraw?.() === 'overlay'")) errors.push('legacy renderer does not honor registry wall-face overlay mode');
if (!phaserSource.includes("field.getDungeonWallFaceModeForDraw?.() === 'overlay'")) errors.push('Phaser renderer does not honor registry wall-face overlay mode');
const graphicsLoadStart = mainSource.indexOf("const loadGraphicsAndStart = async () =>");
const graphicsLoadEnd = mainSource.indexOf("loadGraphicsAndStart().catch", graphicsLoadStart);
const graphicsLoadBlock = mainSource.slice(graphicsLoadStart, graphicsLoadEnd);
if (!graphicsLoadBlock.includes('GRAPHICS.load(() =>') || graphicsLoadBlock.includes('{ keys }')) errors.push('gameplay does not wait for the complete GRAPHICS registry like the stable backup implementation');
if (!battleSource.includes("const fallbackKeys = ['battle_bg_dungeon', 'battle_bg_field']")) errors.push('battle background has no synchronous decoded fallback chain');
if (battleSource.includes("enemyArea.style.backgroundImage = 'none'")) errors.push('battle background can still be deliberately cleared to a blank frame');
const battleBgStart = mainSource.indexOf('getBattleBg: () =>');
const battleBgEnd = mainSource.indexOf('drawDungeonAtmosphere:', battleBgStart);
const battleBgBlock = mainSource.slice(battleBgStart, battleBgEnd);
if (!battleBgBlock.includes("isLavaFloor &&") || !battleBgBlock.includes("return 'battle_bg_fire'")) errors.push('lava floor does not resolve its dedicated battle background outside the temporary forest QA override');
if (!battleBgBlock.includes('Dungeon.isRandomVisualThemeTestOverrideActive?.(Dungeon.floor)')) errors.push('temporary forest QA override cannot supersede a saved lava battle background');
if (!battleBgBlock.includes("if (Field.currentMapData.battleBg) return Field.currentMapData.battleBg")) errors.push('random visual theme battle background is not preferred');
const fullMapStart = mainSource.indexOf('getFullMapLayout:');
const fullMapEnd = mainSource.indexOf('drawFullMap:', fullMapStart);
const fullMapLayout = mainSource.slice(fullMapStart, fullMapEnd);
if (!fullMapLayout.includes('availableWidth / mapW') || !fullMapLayout.includes('availableHeight / mapH')) {
  errors.push('full map does not fit both horizontal and vertical dimensions');
}
const drawFullMapStart = mainSource.indexOf('drawFullMap:');
const drawFullMapEnd = mainSource.indexOf('getCurrentTileTheme:', drawFullMapStart);
const drawFullMapBlock = mainSource.slice(drawFullMapStart, drawFullMapEnd);
if (!drawFullMapBlock.includes('actualMapHeight') || !drawFullMapBlock.includes('actualMapWidth') || !drawFullMapBlock.includes('Field.getFullMapLayout')) {
  errors.push('full map does not reconcile saved dimensions with actual tile rows');
}

if (errors.length) throw new Error(`Field render lifecycle validation failed:\n${errors.join('\n')}`);
console.log(`Field render lifecycle validation passed. Startup keys: ${requiredKeys.length}. Critical battle images: ${requiredFiles.length}. Story refresh call sites: ${eventRefreshCount}.`);
