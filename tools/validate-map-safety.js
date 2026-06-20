const fs = require('fs');
const vm = require('vm');

const root = process.cwd();
const mapSource = fs.readFileSync(`${root}/map.js`, 'utf8');
const storySource = fs.readFileSync(`${root}/story.js`, 'utf8');

const context = {
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
};
context.globalThis = context;
vm.createContext(context);

function runFile(file, suffix = '') {
  const code = fs.readFileSync(`${root}/${file}`, 'utf8');
  vm.runInContext(`${code}\n${suffix}`, context, { filename: file });
}

runFile('map.js', 'globalThis.__MAPS__ = { TILE_THEMES, STORY_DATA, MAP_DATA, FIXED_MAPS, FIXED_DUNGEON_MAPS, MapRegistry };');
context.TILE_THEMES = context.__MAPS__.TILE_THEMES;
context.STORY_DATA = context.__MAPS__.STORY_DATA;
context.MAP_DATA = context.__MAPS__.MAP_DATA;
runFile('dungeon.js', 'globalThis.Dungeon = Dungeon;');
runFile('story.js', 'globalThis.__STORY__ = { StoryManager };');

const { FIXED_MAPS, FIXED_DUNGEON_MAPS, MapRegistry } = context.__MAPS__;
const Dungeon = context.Dungeon;
const StoryManager = context.__STORY__.StoryManager;

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
    assert(['S', 'D', 'U'].includes(tile), `${name}: floor link ${link.x},${link.y} is on ${tile}`);
    if (link.toFloor) {
      assert(Number(link.toFloor) >= 1, `${name}: invalid toFloor at ${link.x},${link.y}`);
    }
  });

  (def.chests || []).forEach((chest) => {
    const tile = at(Number(chest.x), Number(chest.y));
    assert(['C', 'R'].includes(tile), `${name}: chest ${chest.x},${chest.y} is on ${tile}`);
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

assert(!Object.prototype.hasOwnProperty.call(StoryManager, 'triggers'), 'story.js must not own map coordinates through triggers.');
assert(!/"type"\s*:\s*"TILE"/.test(storySource), 'story.js must use named map.js mutations instead of coordinate TILE actions.');
assert(mapSource.includes('START_CAVE_GATE_OPEN') && mapSource.includes('applyStoryMapMutation'), 'Named story map mutations must be owned by map.js.');
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

console.log(`Map safety validation passed. Random floors checked: ${randomFloorsChecked}. Maze floors: ${randomMazeFloors}. Locked-door floors: ${randomLockedDoorFloors}. Floor keys: ${randomFloorKeys}. Story map actions checked: ${storyMapActionsChecked}.`);
