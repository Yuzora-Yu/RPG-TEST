const { loadMapRuntime } = require('./validation/validation-helpers');

const root = process.cwd();
const sampleCount = Math.max(1, Number(process.env.RANDOM_DUNGEON_STRESS_SAMPLES || 5000));
const seed = Number(process.env.RANDOM_DUNGEON_STRESS_SEED || 0x5a17c0de) >>> 0;

function createSeededRandom(seed = 0x5a17c0de) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const seededMath = Object.create(Math);
seededMath.random = createSeededRandom(seed);
let context;
const runtime = loadMapRuntime(root, { context: {
  console,
  Math: seededMath,
  setTimeout,
  clearTimeout,
  window: {},
  DB: { ITEMS: [{ id: 1, name: 'item', rank: 1, type: 'item' }], MONSTERS: [] },
  PassiveSkill: { getSumValue: () => 0 },
  Field: {
    x: 1,
    y: 1,
    currentMapData: null,
    getCurrentAreaKey: () => context.App.data.location.area || 'ABYSS',
    getCurrentProgressMapKey: () => context.App.data.location.area || 'ABYSS',
    refreshCurrentAction: () => {},
    render: () => {},
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
    createEquipByFloor: (_source, floor, plus) => ({ id: `rift-${floor}-${plus}`, name: `亀裂装備R${floor}+${plus}`, opts: [], data: {}, plus }),
  },
} });
context = runtime.context;
runtime.runFile('dungeon.js', 'globalThis.Dungeon = Dungeon;');
const Dungeon = context.Dungeon;
Dungeon.randomVisualThemeTestOverrideId = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let lockedDoorFloors = 0;
let fallbackFloors = 0;
let maxUnreachable = 0;
const planCounts = new Map();

for (let sample = 0; sample < sampleCount; sample++) {
  const floor = 1 + (sample % 220);
  if (floor % 10 === 0) continue;
  context.App.data.location.area = 'ABYSS';
  context.App.data.progress.floor = floor;
  context.App.data.progress.mapChanges = {};
  context.App.data.progress.fixedDungeonKeys = {};
  context.App.data.dungeon = { abyssMode: 'random' };
  context.App.data.battle = {};
  Dungeon.floor = floor;
  Dungeon.generateFloor();

  const result = Dungeon.validateGeneratedFloor();
  assert(result.ok, `sample ${sample} F${floor}: ${result.reason}`);
  const stairs = Dungeon.collectTiles(Dungeon.map, ['S']);
  assert(stairs.length === 1, `sample ${sample} F${floor}: stairs=${stairs.length}`);

  const reachable = Dungeon.getProgressionReachableCells();
  const unreachable = Dungeon.getUnreachableTraversableFloorTiles(reachable);
  maxUnreachable = Math.max(maxUnreachable, unreachable.length);
  assert(unreachable.length === 0, `sample ${sample} F${floor}: unreachable=${unreachable.length}`);

  const { doors, keys } = Dungeon.collectGeneratedKeyDoorPairs();
  assert(doors.length === keys.length, `sample ${sample} F${floor}: door/key=${doors.length}/${keys.length}`);
  if (doors.length) lockedDoorFloors++;
  for (const door of doors) {
    const blocked = new Set([`${door.x},${door.y}`]);
    const dist = Dungeon.distanceMapWithBlocked(Dungeon.map, { x: context.Field.x, y: context.Field.y }, blocked);
    assert(dist[stairs[0].y][stairs[0].x] < 0, `sample ${sample} F${floor}: door ${door.x},${door.y} is optional`);
  }

  const variant = String(context.App.data.dungeon.genVariant || '');
  if (variant.startsWith('fallback-safe-')) fallbackFloors++;
  const plan = context.App.data.dungeon.floorPlanType || 'unknown';
  planCounts.set(plan, (planCounts.get(plan) || 0) + 1);
}

// eventId が失われても isRiftBattle が残っていれば、報酬を一度だけ確定する。
context.App.data.location.area = 'ABYSS';
context.App.data.inventory = [];
context.App.data.dungeon = {
  abyssMode: 'random',
  abyssRift: { active: true, floor: 17, x: 4, y: 6, targetFloor: 27, targetBalanceFloor: 127, rewardId: 'rift-test-001' },
};
context.App.data.battle = {
  active: false,
  isBossBattle: true,
  isRiftBattle: true,
  eventId: null,
  riftFloor: 127,
  riftDisplayFloor: 27,
  riftRewardId: 'rift-test-001',
};
Dungeon.floor = 17;
context.Field.currentMapData = { isFixed: false };
Dungeon.onBossDefeated();
assert(context.App.data.inventory.length === 1, 'rift reward was not granted when eventId was missing');
assert(context.App.data.dungeon.pendingRiftReward?.rewardId === 'rift-test-001', 'rift pending reward journal was not created');
assert(context.App.data.dungeon.completedRiftRewardIds?.includes('rift-test-001'), 'rift reward id was not committed');
context.App.data.battle.isRiftBattle = true;
context.App.data.battle.riftRewardId = 'rift-test-001';
Dungeon.onBossDefeated();
assert(context.App.data.inventory.length === 1, 'rift reward was granted twice');

console.log(`Phase2C random dungeon stress: OK (seed ${seed} / ${sampleCount} floors / locked-door floors ${lockedDoorFloors} / fallback floors ${fallbackFloors} / max unreachable ${maxUnreachable} / plans ${JSON.stringify(Object.fromEntries(planCounts))})`);
