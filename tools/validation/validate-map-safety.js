const fs = require('fs');
const vm = require('vm');
const { loadMapRuntime } = require('./validation-helpers');
const { createFixedNavigationGraph } = require('./fixed-navigation-model');

const root = process.cwd();
const mapSource = fs.readFileSync(`${root}/map.js`, 'utf8');
const mapsLogicSource = fs.readFileSync(`${root}/maps_logic.js`, 'utf8');
const storySource = fs.readFileSync(`${root}/story.js`, 'utf8');

const { context, runFile } = loadMapRuntime(root, { context: {
  console,
  Math,
  setTimeout,
  clearTimeout,
  window: {},
  DB: { ITEMS: [{ id: 1, name: 'item', rank: 1, type: 'item' }] },
  PassiveSkill: { getSumValue: () => 0 },
  Field: {
    x: 1,
    y: 1,
    currentMapData: null,
    getCurrentAreaKey: () => context.App.data.location.area || 'ABYSS',
    getCurrentProgressMapKey: () => context.App.data.location.area === 'ABYSS'
      ? 'ABYSS'
      : context.App.data.location.area,
  },
  App: {
    data: {
      location: { area: 'ABYSS', x: 1, y: 1 },
      progress: { floor: 1, mapChanges: {}, fixedDungeonKeys: {} },
      dungeon: {},
      battle: {},
      items: {},
      inventory: [],
      party: [],
      gold: 0,
      book: { monsters: [], killCounts: {} },
    },
    log: () => {},
    save: () => {},
    changeScene: () => {},
    clearAction: () => {},
    setAction: () => {},
    getChar: () => null,
    createEquipByFloor: () => ({ name: 'equip', opts: [], data: {}, plus: 1 }),
  },
} });

runFile('dungeon.js', 'globalThis.Dungeon = Dungeon;');
runFile('story.js', 'globalThis.STORY_MANAGER_DATA = STORY_MANAGER_DATA;');
runFile('story_logic.js', 'globalThis.StoryManager = StoryManager;');

const { FIXED_MAPS, FIXED_DUNGEON_MAPS, MapRegistry } = context;
const Dungeon = context.Dungeon;
const StoryManager = context.StoryManager;
const runtimeVisualThemeTestOverride = Dungeon.randomVisualThemeTestOverrideId;
// 通常確率の回帰試験中は暫定100%森モードを外し、後段で暫定版自体を別途検証する。
Dungeon.randomVisualThemeTestOverrideId = null;

const doorColors = { X: 'red', Y: 'blue', Z: 'gold' };
const keyItemColors = { Q: 'red', N: 'blue', O: 'gold' };
const colorBits = { red: 1, blue: 2, gold: 4 };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function checkRows(name, def) {
  assert(Array.isArray(def.tiles), `${name}: tiles missing`);
  assert(def.tiles.length === Number(def.height), `${name}: height mismatch`);
  def.tiles.forEach((row, y) => {
    assert(String(row).length === Number(def.width), `${name}: row ${y} width mismatch`);
  });
}

function reachableWithKeys(def, start) {
  const h = def.tiles.length;
  const w = def.tiles[0].length;
  const keyAt = new Map();
  (def.chests || []).forEach((chest) => {
    if (chest.keyColor) keyAt.set(`${chest.x},${chest.y}`, chest.keyColor);
  });

  const queue = [{ x: start.x, y: start.y, mask: 0 }];
  const seen = new Set([`${start.x},${start.y},0`]);
  const reachedCells = new Set();

  for (let qi = 0; qi < queue.length; qi++) {
    const p = queue[qi];
    reachedCells.add(`${p.x},${p.y}`);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const tile = String(def.tiles[ny][nx] || 'W').toUpperCase();
      if (tile === 'W') continue;
      const color = doorColors[tile];
      if (color && !(p.mask & colorBits[color])) continue;
      let mask = p.mask;
      const tilePickup = keyItemColors[tile];
      if (tilePickup) mask |= colorBits[tilePickup] || 0;
      const pickup = keyAt.get(`${nx},${ny}`);
      if (pickup) mask |= colorBits[pickup] || 0;
      const key = `${nx},${ny},${mask}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny, mask });
    }
  }

  return reachedCells;
}

function validateFixedDef(name, def) {
  checkRows(name, def);
  const start = def.entryPoint || { x: 1, y: 1 };
  const at = (x, y) => String(def.tiles[y]?.[x] || 'W').toUpperCase();
  assert(at(start.x, start.y) !== 'W', `${name}: entry point is blocked ${start.x},${start.y}`);

  (def.floorLinks || []).forEach((link) => {
    const tile = at(Number(link.x), Number(link.y));
    assert(tile !== 'W', `${name}: floor link ${link.x},${link.y} is blocked`);
    if (link.toFloor) {
      assert(Number(link.toFloor) >= 1, `${name}: invalid toFloor at ${link.x},${link.y}`);
    }
  });

  (def.chests || []).forEach((chest) => {
    const tile = at(Number(chest.x), Number(chest.y));
    assert(tile !== 'W', `${name}: chest ${chest.x},${chest.y} is blocked`);
    if (chest.keyColor) assert(['red', 'blue', 'gold'].includes(chest.keyColor), `${name}: invalid keyColor ${chest.keyColor}`);
    else assert(chest.itemId !== undefined, `${name}: chest ${chest.x},${chest.y} has no itemId/keyColor`);
  });

  (def.bosses || []).forEach((boss) => {
    const tile = at(Number(boss.x), Number(boss.y));
    assert(tile === 'B', `${name}: boss ${boss.x},${boss.y} is on ${tile}`);
  });

  (def.mapActions || []).forEach((action) => {
    const tile = at(Number(action.x), Number(action.y));
    assert(tile !== 'W', `${name}: map action ${action.label || action.type} ${action.x},${action.y} is blocked`);
    if (action.type === 'fixedDungeon') {
      assert(FIXED_DUNGEON_MAPS[action.target], `${name}: missing fixed dungeon target ${action.target}`);
    }
  });

  // Fixed maps may contain isolated scripted/event cells from the original data.
  // Validate coordinate integrity above, and reserve strict route validation for generated key-door floors.
}

Object.entries(FIXED_MAPS).forEach(([key, def]) => validateFixedDef(`FIXED_MAPS.${key}`, def));
Object.entries(FIXED_DUNGEON_MAPS).forEach(([key, base]) => {
  if (Array.isArray(base.floors) && base.floors.length) {
    base.floors.forEach((_, i) => validateFixedDef(`FIXED_DUNGEON_MAPS.${key}.F${i + 1}`, MapRegistry.getFixedDungeonFloor(key, i + 1)));
    base.floors.forEach((_, i) => {
      const def = MapRegistry.getFixedDungeonFloor(key, i + 1);
      (def.floorLinks || []).forEach((link) => {
        if (!link.toFloor) return;
        const target = MapRegistry.getFixedDungeonFloor(key, link.toFloor);
        assert(target, `FIXED_DUNGEON_MAPS.${key}.F${i + 1}: missing target floor ${link.toFloor}`);
        const tile = String(target.tiles[Number(link.targetY)]?.[Number(link.targetX)] || 'W').toUpperCase();
        assert(tile !== 'W', `FIXED_DUNGEON_MAPS.${key}.F${i + 1}: link target ${link.toFloor}:${link.targetX},${link.targetY} is blocked`);
      });
    });
  } else {
    validateFixedDef(`FIXED_DUNGEON_MAPS.${key}`, MapRegistry.getFixedDungeonFloor(key, 1));
  }
});

const windHoleFirstFloor = MapRegistry.getFixedDungeonFloor('FOREST_WIND_HOLE', 1);
const windRouteAction = (windHoleFirstFloor.mapActions || []).find(action => Number(action.x) === 12 && Number(action.y) === 9);
assert(windRouteAction?.blocksMovement === false, 'FOREST_WIND_HOLE F1: the wind-route event blocks the only progression corridor');
const windRouteGraph = createFixedNavigationGraph(windHoleFirstFloor, windHoleFirstFloor.entryPoint, MapRegistry);
const windRouteExit = (windHoleFirstFloor.floorLinks || []).find(link => Number(link.toFloor) === 2);
assert(windRouteExit && windRouteGraph.hasPosition(state => Number(state.x) === Number(windRouteExit.x) && Number(state.y) === Number(windRouteExit.y)), 'FOREST_WIND_HOLE F1: second-floor stairs are unreachable from the entrance');

assert(!Object.prototype.hasOwnProperty.call(StoryManager, 'triggers'), 'story.js must not own map coordinates through triggers.');
assert(!/"type"\s*:\s*"TILE"/.test(storySource), 'story.js must use named map.js mutations instead of coordinate TILE actions.');
assert(mapSource.includes('STORY_MAP_MUTATIONS') && mapSource.includes('START_CAVE_GATE_OPEN'), 'Named story map mutations must be defined by map.js.');
assert(mapsLogicSource.includes('applyStoryMapMutation') && mapsLogicSource.includes('STORY_MAP_MUTATIONS'), 'Story map mutations must be applied by maps_logic.js.');
let storyMapActionsChecked = 0;
const validateStoryMapActions = (area, def) => {
  (def.mapActions || []).forEach(action => {
    const eventIds = [
      action.eventId,
      ...(action.events || []).map(entry => entry?.eventId)
    ].filter(Boolean);
    if (!eventIds.length) return;
    const x = Number(action.x);
    const y = Number(action.y);
    const tile = String(def.tiles[y]?.[x] || 'W').toUpperCase();
    assert(tile !== 'W', `story map action ${area} ${x},${y}: blocked coordinate`);
    eventIds.forEach(eventId => {
      assert(StoryManager.events[eventId], `story map action ${area} ${x},${y}: missing event ${eventId}`);
      storyMapActionsChecked++;
    });
  });
};
Object.entries(FIXED_MAPS).forEach(([area, def]) => validateStoryMapActions(area, def));
Object.entries(FIXED_DUNGEON_MAPS).forEach(([area, base]) => {
  const floors = Array.isArray(base.floors) && base.floors.length
    ? base.floors.map((_, index) => MapRegistry.getFixedDungeonFloor(area, index + 1))
    : [MapRegistry.getFixedDungeonFloor(area, 1)];
  floors.forEach(def => validateStoryMapActions(area, def));
});

const randomSamples = Math.max(1, Number(process.env.RANDOM_FLOOR_SAMPLES || 4));
let randomFloorsChecked = 0;
let randomLockedDoorFloors = 0;
let randomFloorKeys = 0;
let randomMazeFloors = 0;
let randomFloodedFloors = 0;
const randomPlanCounts = new Map();
const randomThemeCounts = new Map();

for (let sample = 0; sample < randomSamples; sample++) {
  for (let floor = 1; floor <= 120; floor++) {
    context.App.data.location.area = 'ABYSS';
    context.App.data.progress.floor = floor;
    context.App.data.progress.mapChanges = {};
    context.App.data.progress.fixedDungeonKeys = {};
    context.App.data.dungeon = {};
    Dungeon.floor = floor;
    Dungeon.generateFloor();
    randomFloorsChecked++;
    const generatedCheck = Dungeon.validateGeneratedFloor();
    assert(generatedCheck.ok, `ABYSS sample ${sample + 1} F${floor}: generated floor invalid (${generatedCheck.reason})`);
    assert(
      typeof Dungeon.countIsolatedWallTiles === 'function' && Dungeon.countIsolatedWallTiles() === 0,
      `ABYSS sample ${sample + 1} F${floor}: isolated one-tile wall remains`
    );
    const doors = [];
    Dungeon.map.forEach((row, y) => row.forEach((tile, x) => {
      if (doorColors[String(tile || '').toUpperCase()]) doors.push({ x, y });
      if (keyItemColors[String(tile || '').toUpperCase()]) randomFloorKeys++;
    }));
    if (Number(context.App.data.dungeon.genType) === 2) randomMazeFloors++;
    const planType = context.App.data.dungeon.floorPlanType || (floor % 10 === 0 ? 'boss' : 'unknown');
    randomPlanCounts.set(planType, (randomPlanCounts.get(planType) || 0) + 1);
    const themeId = context.App.data.dungeon.visualThemeId || 'missing';
    randomThemeCounts.set(themeId, (randomThemeCounts.get(themeId) || 0) + 1);
    assert(context.Field.currentMapData?.themeKey === context.App.data.dungeon.visualThemeKey, `ABYSS sample ${sample + 1} F${floor}: Field theme was overwritten`);
    if (context.App.data.dungeon.isFloodedFloor) {
      randomFloodedFloors++;
      assert(Dungeon.map.some(row => row.includes(Dungeon.floodedTile)), `ABYSS sample ${sample + 1} F${floor}: flooded flag has no water cells`);
      assert(context.Field.currentMapData?.battleBg === Dungeon.floodedBattleBgKey, `ABYSS sample ${sample + 1} F${floor}: flooded battle background mismatch`);
    }
    if (doors.length) randomLockedDoorFloors++;
    const stairs = Dungeon.collectTiles(Dungeon.map, ['S'])[0];
    if (floor % 10 !== 0) {
      assert(stairs, `ABYSS sample ${sample + 1} F${floor}: stairs missing`);
      const distToStairs = Dungeon.distanceMap(Dungeon.map, { x: context.Field.x, y: context.Field.y });
      assert(distToStairs[stairs.y][stairs.x] >= 0, `ABYSS sample ${sample + 1} F${floor}: stairs unreachable`);
    }
    doors.forEach((door) => {
      const blocked = new Set([`${door.x},${door.y}`]);
      const dist = Dungeon.distanceMapWithBlocked(Dungeon.map, { x: context.Field.x, y: context.Field.y }, blocked);
      assert(stairs && dist[stairs.y][stairs.x] < 0, `ABYSS sample ${sample + 1} F${floor}: locked door ${door.x},${door.y} does not block the route`);
    });
    assert(Dungeon.validateKeyDoorPuzzle(), `ABYSS sample ${sample + 1} F${floor}: key-door validation failed`);
  }
}

// 確率に依存せず、浸水変換そのものと到達性を必ず1回検証する。
context.App.data.dungeon = { genType: 0, isTreasureRoom: false };
context.App.data.progress.floor = 41;
Dungeon.floor = 41;
Dungeon.width = 9;
Dungeon.height = 9;
Dungeon.map = Array.from({ length: 9 }, (_, y) => Array.from({ length: 9 }, (_, x) => (x === 0 || y === 0 || x === 8 || y === 8) ? 'W' : 'T'));
Dungeon.map[1][1] = 'S';
context.Field.x = 7;
context.Field.y = 7;
const originalFloodRate = Dungeon.floodedFloorSpawnRate;
Dungeon.floodedFloorSpawnRate = 1;
assert(Dungeon.applyFloodedFloorIfNeeded(), 'forced flooded floor did not activate');
Dungeon.floodedFloorSpawnRate = originalFloodRate;
assert(Dungeon.map[7][7] === Dungeon.floodedTile, 'flooded floor did not convert the player cell');
const floodedStairs = Dungeon.collectTiles(Dungeon.map, ['S'])[0];
const floodedDistance = Dungeon.distanceMap(Dungeon.map, { x: context.Field.x, y: context.Field.y });
assert(floodedStairs && floodedDistance[floodedStairs.y][floodedStairs.x] >= 0, 'flooded stairs are unreachable');

const expectedCandidateCounts = new Map([[1, 1], [11, 2], [21, 3], [41, 4], [51, 5], [61, 6], [71, 7], [81, 13]]);
for (const [floor, count] of expectedCandidateCounts) {
  assert(Dungeon.getRandomVisualThemeCandidates(floor).length === count, `ABYSS F${floor}: visual theme candidate count mismatch`);
}

const expectedPlanBoundaries = [
  [0.05, 'lava'],
  [0.15, 'flooded'],
  [0.215, 'maze'],
  [0.24, 'treasure'],
  [0.35, 'abyss'],
  [0.75, 'random']
];
for (const [roll, category] of expectedPlanBoundaries) {
  assert(Dungeon.rollRandomFloorPlan(53, roll).category === category, `F53 plan roll ${roll}: expected ${category}`);
}
assert(Dungeon.rollRandomFloorPlan(53, 0.15).themeId === 'abyss', 'flooded floor map tiles must remain abyss-themed');
assert(Dungeon.rollRandomFloorPlan(53, 0.24).themeId === 'abyss', 'treasure floor map tiles must remain abyss-themed');
const deterministicPlanCounts = new Map();
for (let i = 0; i < 10000; i++) {
  const category = Dungeon.rollRandomFloorPlan(53, (i + 0.5) / 10000).category;
  deterministicPlanCounts.set(category, (deterministicPlanCounts.get(category) || 0) + 1);
}
for (const [category, expectedCount] of Object.entries({
  lava: 1000,
  flooded: 1000,
  maze: 300,
  treasure: 200,
  abyss: 2500,
  random: 5000
})) {
  assert(deterministicPlanCounts.get(category) === expectedCount, `F53 plan distribution mismatch for ${category}`);
}
assert(Dungeon.rollRandomFloorPlan(40, 0.05).category === 'abyss', 'lava bucket must fold into abyss before floor 50');
assert(Dungeon.rollRandomFloorPlan(40, 0.15).category === 'abyss', 'flooded bucket must fold into abyss before floor 41');
for (const requiredTheme of ['abyss', 'forbidden-forest', 'thunder-fort', 'seabed-temple', 'ignis-volcano']) {
  assert(randomThemeCounts.has(requiredTheme), `random generation never applied eligible theme: ${requiredTheme}`);
}

// 全テーマについて「抽選結果→保存値→Field.currentMapData」を強制的に通し、
// 再開途中で深淵値が混入してもfloorPlanThemeIdから復元できることを確認する。
for (const theme of Dungeon.randomVisualThemes) {
  const floor = Math.max(1, Number(theme.minFloor || 1));
  Dungeon.floor = floor;
  context.App.data.progress.floor = floor;
  context.App.data.dungeon = {
    floorPlanType: 'random',
    floorPlanThemeId: theme.id,
    visualThemeId: 'abyss',
    visualThemeKey: 'ABYSS',
    visualBattleBg: 'battle_bg_dungeon',
    isFloodedFloor: false
  };
  Dungeon.width = 3;
  Dungeon.height = 3;
  Dungeon.map = [
    ['W', 'W', 'W'],
    ['W', 'T', 'W'],
    ['W', 'S', 'W']
  ];
  const fieldMap = Dungeon.createRandomFieldMapData();
  assert(context.App.data.dungeon.visualThemeId === theme.id, `${theme.id}: planned theme was not restored from an abyss overwrite`);
  assert(fieldMap.visualThemeId === theme.id, `${theme.id}: Field visualThemeId mismatch`);
  assert(fieldMap.themeKey === theme.themeKey, `${theme.id}: Field themeKey mismatch`);
  assert(fieldMap.battleBg === theme.battleBg, `${theme.id}: Field battle background mismatch`);
  if (theme.id === 'light-palace') {
    assert(fieldMap.wallFaceImg === 'tile_light_wall_face', 'light-palace: dedicated wall face was not restored');
    assert(fieldMap.wallFaceTorchImg === 'tile_light_wall_face_prism', 'light-palace: prism wall accent was not restored');
  }
  assert(context.App.data.dungeon.visualThemeAudit?.appliedThemeId === theme.id, `${theme.id}: visual audit lost the applied theme`);
  assert(context.App.data.dungeon.visualThemeAudit?.plannedThemeId === theme.id, `${theme.id}: visual audit lost the planned theme`);
  const tileTheme = context.TILE_THEMES?.[fieldMap.themeKey];
  assert(tileTheme?.W?.img && tileTheme?.T?.img, `${theme.id}: rendered W/T tile definitions are missing`);
  if (theme.id !== 'abyss') {
    const abyssTheme = context.TILE_THEMES?.ABYSS;
    assert(tileTheme.W.img !== abyssTheme.W.img || tileTheme.T.img !== abyssTheme.T.img, `${theme.id}: rendered tiles collapse to abyss graphics`);
  }
}

for (const planType of ['flooded', 'treasure', 'boss']) {
  Dungeon.floor = planType === 'boss' ? 80 : 77;
  context.App.data.progress.floor = Dungeon.floor;
  context.App.data.dungeon = {
    floorPlanType: planType,
    floorPlanThemeId: 'light-palace',
    visualThemeId: 'light-palace',
    visualThemeKey: 'LIGHT_PALACE',
    visualBattleBg: 'battle_bg_light_palace',
    isFloodedFloor: planType === 'flooded'
  };
  const forcedMap = Dungeon.createRandomFieldMapData();
  assert(forcedMap.themeKey === 'ABYSS' && forcedMap.visualThemeId === 'abyss', `${planType}: special floor did not force abyss map tiles`);
  assert(context.App.data.dungeon.floorPlanThemeId === 'abyss', `${planType}: saved theme plan was not repaired to abyss`);
  if (planType === 'flooded') assert(forcedMap.battleBg === Dungeon.floodedBattleBgKey, 'flooded: dedicated battle background was lost');
}

for (const category of ['maze', 'treasure']) {
  context.App.data.dungeon = {};
  context.App.data.progress.floor = 53;
  Dungeon.floor = 53;
  const fallbackPlan = { floor: 53, category, themeId: 'abyss' };
  Dungeon.resetRandomFloorAttemptState(false);
  Dungeon.applyRandomFloorPlan(fallbackPlan);
  Dungeon.generateFallbackRandomFloor(fallbackPlan);
  const fallbackCheck = Dungeon.validateGeneratedFloor();
  assert(fallbackCheck.ok, `${category}: deterministic fallback is invalid (${fallbackCheck.reason})`);
}

Dungeon.randomVisualThemeTestOverrideId = 'forbidden-forest';
context.App.data.dungeon = {};
context.App.data.progress.floor = 62;
Dungeon.floor = 62;
Dungeon.width = 3;
Dungeon.height = 3;
Dungeon.map = [['W','W','W'], ['W','T','W'], ['W','S','W']];
const forestTestPlan = Dungeon.rollRandomFloorPlan(62, 0.01);
assert(forestTestPlan.category === 'random' && forestTestPlan.themeId === 'forbidden-forest', 'temporary forest QA build is not 100% forced');
Dungeon.applyRandomFloorPlan(forestTestPlan);
const forestTestMap = Dungeon.createRandomFieldMapData();
assert(forestTestMap.themeKey === 'FORBIDDEN_FOREST', 'temporary forest QA map does not use forest tiles');
assert(forestTestMap.battleBg === 'battle_bg_forest', 'temporary forest QA map does not use the forest battle background');
assert(forestTestMap.visualTestOverride === true && forestTestMap.name.includes('森固定検証'), 'temporary forest QA build is not visibly identified');
assert(context.App.data.dungeon.visualThemeAudit?.testOverrideId === 'forbidden-forest', 'temporary forest QA override is missing from the visual audit');
assert(Dungeon.getRandomVisualThemeTestOverride(60) === null, 'boss floors must remain abyss floors during the forest QA build');
Dungeon.randomVisualThemeTestOverrideId = runtimeVisualThemeTestOverride;

console.log(`Map safety validation passed. Random floors checked: ${randomFloorsChecked}. Maze floors: ${randomMazeFloors}. Flooded floors: ${randomFloodedFloors}. Locked-door floors: ${randomLockedDoorFloors}. Floor keys: ${randomFloorKeys}. Story map actions checked: ${storyMapActionsChecked}. Plans: ${JSON.stringify(Object.fromEntries(randomPlanCounts))}. Themes: ${JSON.stringify(Object.fromEntries(randomThemeCounts))}.`);
