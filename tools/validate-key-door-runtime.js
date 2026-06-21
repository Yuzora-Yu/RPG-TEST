const fs = require('fs');
const vm = require('vm');

const root = process.cwd();

const context = {
  console,
  Math,
  setTimeout,
  clearTimeout,
  window: {},
  DB: {
    ITEMS: [
      { id: 1, name: 'item', rank: 1, type: 'item' },
      { id: 3, name: 'rare item', rank: 3, type: 'item' },
      { id: 99, name: 'reward item', rank: 5, type: 'item' },
    ],
  },
  PassiveSkill: { getSumValue: () => 0 },
  Field: {
    x: 1,
    y: 1,
    currentMapData: null,
    render: () => {},
    getCurrentAreaKey: () => context.App.data.location.area || 'ABYSS',
    getCurrentProgressMapKey: () => {
      const area = context.App.data.location.area || 'ABYSS';
      const floor = context.App.data.progress.floor || 1;
      if (context.MapRegistry?.getFixedDungeonProgressKey && context.FIXED_DUNGEON_MAPS?.[area]) {
        return context.MapRegistry.getFixedDungeonProgressKey(area, floor);
      }
      return area;
    },
    getCurrentMapChangeKey: (areaKey = null) => {
      if (context.Field.currentMapData?.isFixed) return context.Field.getCurrentProgressMapKey();
      return areaKey || context.Field.getCurrentAreaKey();
    },
  },
  App: {
    data: {},
    logs: [],
    scenes: [],
    pendingAction: null,
    log(message) { this.logs.push(String(message)); },
    save() {},
    changeScene(scene) { this.scenes.push(scene); },
    clearAction() { this.pendingAction = null; },
    setAction(label, fn) { this.pendingAction = { label, fn }; },
    getChar: () => null,
    createEquipByFloor: () => ({ name: 'equip', opts: [], data: {}, plus: 1 }),
    tryRandomEncounter: () => false,
    discoverFixedMap: () => {},
  },
};
context.globalThis = context;
vm.createContext(context);

function runFile(file, suffix = '') {
  const code = fs.readFileSync(`${root}/${file}`, 'utf8');
  vm.runInContext(`${code}\n${suffix}`, context, { filename: file });
}

runFile('map.js', 'globalThis.__MAPS__ = { TILE_THEMES, STORY_DATA, MAP_DATA, FIXED_MAPS, FIXED_DUNGEON_MAPS, MapRegistry };');
Object.assign(context, context.__MAPS__);
runFile('dungeon.js', 'globalThis.Dungeon = Dungeon;');

const { FIXED_DUNGEON_MAPS, MapRegistry, Dungeon, Field, App } = context;
const doorColors = { X: 'red', Y: 'blue', Z: 'gold' };
const keyItemTiles = { Q: 'red', N: 'blue', O: 'gold' };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function resetData() {
  App.logs = [];
  App.scenes = [];
  App.pendingAction = null;
  App.data = {
    location: { area: 'ABYSS', x: 1, y: 1 },
    progress: {
      floor: 1,
      mapChanges: {},
      fixedDungeonKeys: {},
      openedChests: {},
      defeatedBosses: {},
    },
    dungeon: { maxFloor: 1 },
    battle: {},
    items: {},
    inventory: [],
    party: [],
    gold: 0,
    book: { monsters: [], killCounts: {} },
  };
  Field.x = 1;
  Field.y = 1;
  Field.currentMapData = null;
  Dungeon.map = [];
  Dungeon.width = 0;
  Dungeon.height = 0;
  Dungeon.floor = 1;
}

function setFixedFloor(areaKey, floorNo) {
  const def = MapRegistry.getFixedDungeonFloor(areaKey, floorNo);
  assert(def, `${areaKey} F${floorNo}: missing floor definition`);
  App.data.location.area = areaKey;
  App.data.progress.floor = floorNo;
  Dungeon.floor = floorNo;
  Field.currentMapData = def;
  Field.x = Number(def.entryPoint?.x || 1);
  Field.y = Number(def.entryPoint?.y || 1);
  App.data.location.x = Field.x;
  App.data.location.y = Field.y;
  return def;
}

function tileAt(def, x, y) {
  const areaKey = Field.getCurrentAreaKey();
  const changeKey = Field.getCurrentMapChangeKey(areaKey);
  return String(
    App.data.progress.mapChanges?.[changeKey]?.[`${x},${y}`] ||
    App.data.progress.mapChanges?.[areaKey]?.[`${x},${y}`] ||
    def.tiles[y]?.[x] ||
    'W'
  ).toUpperCase();
}

function passable(def, x, y, keys = {}) {
  if (x < 0 || y < 0 || x >= Number(def.width) || y >= Number(def.height)) return false;
  const tile = tileAt(def, x, y);
  if (tile === 'W') return false;
  const color = doorColors[tile];
  return !color || !!keys[color];
}

function findPath(def, start, goal, keys = {}) {
  const queue = [{ x: start.x, y: start.y }];
  const prev = new Map([[`${start.x},${start.y}`, null]]);

  for (let qi = 0; qi < queue.length; qi++) {
    const p = queue[qi];
    if (p.x === goal.x && p.y === goal.y) {
      const path = [];
      let key = `${p.x},${p.y}`;
      while (key) {
        const [x, y] = key.split(',').map(Number);
        path.push({ x, y });
        key = prev.get(key);
      }
      return path.reverse();
    }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      const key = `${nx},${ny}`;
      if (prev.has(key) || !passable(def, nx, ny, keys)) continue;
      prev.set(key, `${p.x},${p.y}`);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

function reachableCells(def, start, keys = {}) {
  const queue = [{ x: start.x, y: start.y }];
  const seen = new Set([`${start.x},${start.y}`]);

  for (let qi = 0; qi < queue.length; qi++) {
    const p = queue[qi];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || !passable(def, nx, ny, keys)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

function stepTo(def, x, y) {
  const before = { x: Field.x, y: Field.y };
  let tile = tileAt(def, x, y);
  if (tile === 'W') return false;

  if (Dungeon.isLockedDoorTile(tile)) {
    if (!Dungeon.unlockDoorAt(x, y, tile)) {
      assert(Field.x === before.x && Field.y === before.y, 'blocked door move changed player position');
      return false;
    }
    tile = 'T';
  }

  Field.x = x;
  Field.y = y;
  App.data.location.x = x;
  App.data.location.y = y;
  if (Field.currentMapData?.isDungeon) Dungeon.handleMove(x, y);
  return true;
}

function walkPath(def, path) {
  assert(path && path.length > 0, 'missing path');
  for (const p of path.slice(1)) {
    assert(stepTo(def, p.x, p.y), `could not step to ${p.x},${p.y}`);
  }
}

function findDoors(def) {
  const doors = [];
  for (let y = 0; y < def.tiles.length; y++) {
    for (let x = 0; x < def.tiles[y].length; x++) {
      const tile = String(def.tiles[y][x] || 'W').toUpperCase();
      if (doorColors[tile]) doors.push({ x, y, tile, color: doorColors[tile] });
    }
  }
  return doors;
}

function findDoorNeighbor(def, door) {
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const p = { x: door.x + dx, y: door.y + dy };
    if (p.x < 0 || p.y < 0 || p.x >= Number(def.width) || p.y >= Number(def.height)) continue;
    const tile = tileAt(def, p.x, p.y);
    if (tile !== 'W' && !Dungeon.isLockedDoorTile(tile)) return p;
  }
  return null;
}

function findFixedKeySources(areaKey, color) {
  const base = FIXED_DUNGEON_MAPS[areaKey];
  const floors = Array.isArray(base?.floors) && base.floors.length ? base.floors : [base];
  const sources = [];
  floors.forEach((floor, index) => {
    (floor.tiles || []).forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (keyItemTiles[String(row[x] || '').toUpperCase()] === color) {
          sources.push({ floorNo: index + 1, type: 'tile', x, y });
        }
      }
    });
    (floor.chests || []).forEach(chest => {
      if (chest.keyColor === color) sources.push({ floorNo: index + 1, type: 'chest', x: chest.x, y: chest.y });
    });
    (floor.bosses || []).forEach(boss => {
      const keyColors = Array.isArray(boss.keyRewardColors)
        ? boss.keyRewardColors
        : (boss.keyRewardColor || boss.keyColor)
          ? [boss.keyRewardColor || boss.keyColor]
          : [];
      if (keyColors.includes(color)) sources.push({ floorNo: index + 1, type: 'boss', x: boss.x, y: boss.y });
    });
  });
  return sources;
}

function validateFixedDoor(areaKey, floorNo, door) {
  resetData();
  let def = setFixedFloor(areaKey, floorNo);
  const progressKey = Field.getCurrentProgressMapKey();
  const neighbor = findDoorNeighbor(def, door);
  assert(neighbor, `${areaKey} F${floorNo}: no passable pre-door neighbor for ${door.x},${door.y}`);

  Field.x = neighbor.x;
  Field.y = neighbor.y;
  assert(stepTo(def, door.x, door.y) === false, `${areaKey} F${floorNo}: door opened without ${door.color} key`);
  assert(!App.data.progress.mapChanges?.[progressKey]?.[`${door.x},${door.y}`], `${areaKey} F${floorNo}: blocked door wrote mapChanges`);

  resetData();
  def = setFixedFloor(areaKey, floorNo);
  const keySources = findFixedKeySources(areaKey, door.color);
  assert(keySources.length > 0, `${areaKey} F${floorNo}: no ${door.color} key source for door ${door.x},${door.y}`);
  Dungeon.grantDungeonKey(door.color, 'fixedSource');
  assert(Dungeon.hasDungeonKey(door.color), `${areaKey} F${floorNo}: fixed key source did not grant ${door.color} key`);

  const keyedNeighbor = findDoorNeighbor(def, door);
  assert(keyedNeighbor, `${areaKey} F${floorNo}: no keyed pre-door neighbor for ${door.x},${door.y}`);
  Field.x = keyedNeighbor.x;
  Field.y = keyedNeighbor.y;
  assert(stepTo(def, door.x, door.y), `${areaKey} F${floorNo}: keyed door move failed`);
  assert(App.data.progress.mapChanges?.[progressKey]?.[`${door.x},${door.y}`] === 'T', `${areaKey} F${floorNo}: unlocked door not saved as T`);
  assert(tileAt(def, door.x, door.y) === 'T', `${areaKey} F${floorNo}: unlocked door still resolves as locked`);
}

function validateFixedDungeons() {
  let doorChecks = 0;
  let linkChecks = 0;

  for (const [areaKey, base] of Object.entries(FIXED_DUNGEON_MAPS)) {
    const floorCount = Array.isArray(base.floors) && base.floors.length ? base.floors.length : 1;
    for (let floorNo = 1; floorNo <= floorCount; floorNo++) {
      resetData();
      const def = setFixedFloor(areaKey, floorNo);
      findDoors(def).forEach((door) => {
        validateFixedDoor(areaKey, floorNo, door);
        doorChecks++;
      });

      (def.floorLinks || []).forEach((link) => {
        if (!link.toFloor) return;
        resetData();
        setFixedFloor(areaKey, floorNo);
        Dungeon.changeFixedFloor(link.toFloor, link.targetX, link.targetY);
        assert(Number(App.data.progress.floor) === Number(link.toFloor), `${areaKey} F${floorNo}: link did not set target floor`);
        assert(Number(Field.x) === Number(link.targetX) && Number(Field.y) === Number(link.targetY), `${areaKey} F${floorNo}: link target position mismatch`);
        const targetDef = Field.currentMapData;
        assert(targetDef && targetDef.isFixed && targetDef.isDungeon, `${areaKey} F${floorNo}: link target did not load fixed dungeon`);
        assert(tileAt(targetDef, Field.x, Field.y) !== 'W', `${areaKey} F${floorNo}: link target is blocked`);
        linkChecks++;
      });
    }
  }

  return { doorChecks, linkChecks };
}

function validateRandomFloorKeyDoorRuntime() {
  resetData();
  App.data.location.area = 'ABYSS';
  App.data.progress.floor = 11;
  Dungeon.floor = 11;
  Dungeon.width = 11;
  Dungeon.height = 5;
  Dungeon.map = [
    'WWWWWWWWWWW'.split(''),
    'WTTTTTTTTSW'.split(''),
    'WTQTTXTTTTW'.split(''),
    'WTTTTTTTTTW'.split(''),
    'WWWWWWWWWWW'.split(''),
  ];
  Field.currentMapData = { name: 'ABYSS', width: Dungeon.width, height: Dungeon.height, tiles: Dungeon.map, isDungeon: true };
  Field.x = 1;
  Field.y = 2;
  App.data.location.x = 1;
  App.data.location.y = 2;
  App.data.dungeon.floorKeys = [{ active: true, floor: 11, x: 2, y: 2, color: 'red' }];

  Dungeon.handleMove(2, 2);
  assert(Dungeon.hasDungeonKey('red'), 'random floor key did not grant red key');
  assert(App.data.dungeon.randomKeys?.['ABYSS:F11']?.red === true, 'random key was not stored in dungeon.randomKeys');
  assert(!App.data.progress.fixedDungeonKeys?.['ABYSS:F11']?.red, 'random key leaked into fixedDungeonKeys');
  assert(App.data.dungeon.floorKeys[0].active === false, 'random floor key remained active');
  assert(Dungeon.map[2][2] === 'T', 'random floor key tile was not cleared');

  Field.x = 4;
  Field.y = 2;
  assert(Dungeon.unlockDoorAt(5, 2, 'X'), 'random red door did not unlock with key');
  assert(Dungeon.map[2][5] === 'T', 'random door tile was not cleared in live map');
  assert(App.data.dungeon.map[2][5] === 'T', 'random door tile was not saved');
  assert(!Dungeon.hasDungeonKey('red'), 'random red key was not consumed after unlocking door');
  assert(Dungeon.getHeldKeyOrder().length === 0, 'consumed random key remained in held key order');

  Dungeon.exit(false);
  assert(!App.data.dungeon.randomKeys, 'random keys were not cleared on random dungeon exit');
}

function validateGuardianRuntime() {
  resetData();
  App.data.location.area = 'ABYSS';
  App.data.progress.floor = 12;
  Dungeon.floor = 12;
  Dungeon.width = 5;
  Dungeon.height = 5;
  Dungeon.map = [
    'WWWWW'.split(''),
    'WTTTW'.split(''),
    'WTTTW'.split(''),
    'WTTTW'.split(''),
    'WWWWW'.split(''),
  ];
  Field.currentMapData = { name: 'ABYSS', width: 5, height: 5, tiles: Dungeon.map, isDungeon: true };
  App.data.dungeon.keyGuardian = { active: true, floor: 12, x: 2, y: 2, color: 'blue', monsterId: 100010 };

  assert(Dungeon.isKeyGuardianAt(2, 2), 'guardian position was not detected');
  assert(Dungeon.startKeyGuardianBattle(), 'guardian battle did not start');
  assert(App.data.battle.keyReward?.color === 'blue', 'guardian battle did not carry keyReward');

  Dungeon.completeKeyGuardianReward(App.data.battle.keyReward);
  assert(Dungeon.hasDungeonKey('blue'), 'guardian reward did not grant blue key');
  assert(App.data.dungeon.randomKeys?.['ABYSS:F12']?.blue === true, 'guardian key was not stored in random key scope');
  assert(App.data.dungeon.keyGuardian.active === false, 'guardian remained active after reward');
  assert(Dungeon.map[2][2] === 'T', 'guardian tile was not cleared');
}

function validateFixedKeyScopeRuntime() {
  resetData();
  const areaKey = Object.keys(FIXED_DUNGEON_MAPS)[0];
  assert(areaKey, 'missing fixed dungeon for fixed key scope validation');
  const def = setFixedFloor(areaKey, 1);
  const scopeKey = Dungeon.getKeyScopeKey();

  Dungeon.grantDungeonKey('gold', 'fixedBoss');
  assert(App.data.progress.fixedDungeonKeys?.[scopeKey]?.gold === true, 'fixed key was not stored in fixedDungeonKeys');
  assert(!App.data.dungeon.randomKeys, 'fixed key leaked into randomKeys');
  assert(Dungeon.getHeldKeyOrder().join(',') === 'gold', 'fixed held key order was not preserved');

  App.data.dungeon.randomKeys = { 'ABYSS:F99': { red: true, _order: ['red'] } };
  Dungeon.changeFixedFloor(1, def.entryPoint?.x || 1, def.entryPoint?.y || 1);
  assert(App.data.progress.fixedDungeonKeys?.[scopeKey]?.gold === true, 'fixed key was lost during fixed floor transition');
  assert(!App.data.dungeon.randomKeys, 'random keys were not cleared when entering fixed context');
}

function validateMultiColorFixedBossRewardRuntime() {
  const target = Object.entries(FIXED_DUNGEON_MAPS).flatMap(([areaKey, base]) => {
    const floors = Array.isArray(base?.floors) && base.floors.length ? base.floors : [base];
    return floors.flatMap((floor, index) => (floor.bosses || [])
      .filter(boss => Array.isArray(boss.keyRewardColors) && boss.keyRewardColors.length > 1)
      .map(boss => ({ areaKey, floorNo: index + 1, boss })));
  })[0];

  assert(target, 'missing fixed boss with multiple keyRewardColors for runtime validation');
  resetData();
  setFixedFloor(target.areaKey, target.floorNo);
  Field.x = Number(target.boss.x);
  Field.y = Number(target.boss.y);
  App.data.location.x = Field.x;
  App.data.location.y = Field.y;

  Dungeon.startFixedBoss(Field.x, Field.y);
  const reward = App.data.battle?.fixedKeyReward;
  assert(Array.isArray(reward?.colors), 'multi-color fixed boss did not store fixedKeyReward.colors');
  target.boss.keyRewardColors.forEach(color => {
    assert(reward.colors.includes(color), `multi-color fixed boss reward omitted ${color}`);
  });

  Dungeon.onBossDefeated();
  const scopeKey = Dungeon.getKeyScopeKey(target.areaKey);
  target.boss.keyRewardColors.forEach(color => {
    assert(App.data.progress.fixedDungeonKeys?.[scopeKey]?.[color] === true, `multi-color fixed boss did not grant ${color} key`);
  });
}

function validateSourceHooks() {
  const main = fs.readFileSync(`${root}/main.js`, 'utf8');
  const story = fs.readFileSync(`${root}/story.js`, 'utf8');
  const battle = fs.readFileSync(`${root}/battle.js`, 'utf8');
  assert(/Dungeon\.isLockedDoorTile\(tile\)[\s\S]{0,800}Dungeon\.unlockDoorAt\(nx,\s*ny,\s*tile\)/.test(main), 'Field.move is not wired to Dungeon.unlockDoorAt');
  assert(/Dungeon\.handleMove\(nx,\s*ny\)/.test(main), 'Field.move is not wired to Dungeon.handleMove');
  assert(/item_key_red/.test(main) && /item_key_blue/.test(main) && /item_key_gold/.test(main), 'Field.render does not show held key icons');
  assert(/Array\.isArray\(keyReward\.colors\)[\s\S]{0,260}keyReward\.colors\.filter\(Boolean\)\.map\(color/.test(battle), 'Battle victory does not expand multi-color key rewards');
  assert(/keyRewards\.forEach\(reward\s*=>\s*{[\s\S]{0,160}Dungeon\.completeKeyGuardianReward\(reward\)/.test(battle), 'Battle victory is not wired to complete each key reward');
  assert(/App\.data\.battle\.keyReward\s*=\s*null[\s\S]{0,120}App\.data\.battle\.fixedKeyReward\s*=\s*null/.test(battle), 'Battle victory does not clear consumed key reward state');
  assert(/Array\.isArray\(action\.keyRewardColors\)/.test(story), 'Story BOSS action does not read keyRewardColors');
  assert(/const\s+keyRewardColors\s*=\s*rawKeyRewardColors\.filter\(Boolean\)/.test(story), 'Story BOSS action does not normalize key reward colors');
  assert(/const\s+fixedKeyReward\s*=\s*keyRewardColors\.length\s*>\s*0\s*\?/.test(story) &&
    /colors:\s*keyRewardColors/.test(story) &&
    /fixedKeyReward:\s*fixedKeyReward/.test(story),
  'Story BOSS action is not wired to multi-color fixedKeyReward');
}

validateSourceHooks();
const fixed = validateFixedDungeons();
validateRandomFloorKeyDoorRuntime();
validateGuardianRuntime();
validateFixedKeyScopeRuntime();
validateMultiColorFixedBossRewardRuntime();

console.log(`Key-door runtime validation passed. Fixed doors: ${fixed.doorChecks}. Fixed floor links: ${fixed.linkChecks}. Random floor-key/door, guardian reward, and multi-color fixed boss reward checks passed.`);
