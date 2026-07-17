const fs = require('fs');
const vm = require('vm');

const root = process.cwd();
const source = fs.readFileSync(`${root}/dungeon.js`, 'utf8');
const context = { console, setTimeout, clearTimeout };
vm.createContext(context);
vm.runInContext(`${source}\nthis.__DUNGEON__ = Dungeon;`, context, { filename: 'dungeon.js' });
const Dungeon = context.__DUNGEON__;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

// 直線上を壁で塞ぎ、下側の迂回路だけを歩けるようにする。
const grid = [
    ['T', 'W', 'W', 'W', 'T'],
    ['T', 'T', 'T', 'T', 'T'],
    ['W', 'W', 'W', 'W', 'W']
];
const path = Dungeon.findShortestGridPath(
    0, 0, 4, 0,
    (x, y) => grid[y]?.[x] !== 'W',
    5, 3
);
assert(Array.isArray(path), 'hunter pathfinder did not find the detour');
assert(path.length === 6, `hunter pathfinder did not choose the shortest detour (${path.length})`);
assert(path.every(cell => grid[cell.y][cell.x] !== 'W'), 'hunter pathfinder crossed a wall');
assert(path.at(-1).x === 4 && path.at(-1).y === 0, 'hunter pathfinder did not reach the player tile');
assert(Dungeon.findShortestGridPath(0, 0, 4, 0, (x, y) => grid[y]?.[x] !== 'W', 5, 3, 5) === null, 'hunter pathfinder ignored its pursuit range limit');

const blocked = Dungeon.findShortestGridPath(0, 0, 4, 0, (x, y) => y === 0 && x === 0, 5, 3);
assert(blocked === null, 'hunter pathfinder returned a route for an unreachable target');
assert(Dungeon.findShortestGridPath(2, 1, 2, 1, () => true, 5, 3).length === 0, 'same-cell hunter path should be empty');

const hunterDef = { type: 'hunter', id: 'audit_hunter', x: 0, y: 0, speed: 1, range: 99, monsterId: 100001 };
context.Field = {
    x: 4,
    y: 0,
    currentMapData: { isFixed: true, width: 5, height: 3, tiles: grid, tileEffects: [hunterDef] },
    getCurrentAreaKey: () => 'AUDIT_MAP',
    getCurrentMapChangeKey: key => key,
    getCurrentProgressMapKey: () => 'AUDIT_MAP:F1',
    isFixedBossDefeatedAt: () => false,
    isFixedBossAvailable: () => false,
    isBlockingMapActor: () => false,
    getBlockingObjectAt: () => null,
    isBuildingMovementBlocked: () => false
};
context.App = {
    data: {
        location: { area: 'AUDIT_MAP' },
        progress: {
            floor: 1,
            mapChanges: {},
            fixedHunters: { 'AUDIT_MAP:F1': { audit_hunter: { x: 0, y: 0, active: true, moveProgress: 0 } } }
        },
        dungeon: { defeatedFixedHunters: {} }
    },
    save: () => {},
    log: () => {}
};
let caught = false;
Dungeon.triggerFixedEffectBattle = () => { caught = true; return true; };
Dungeon.stepFixedHunters();
const runtimePos = context.App.data.progress.fixedHunters['AUDIT_MAP:F1'].audit_hunter;
assert(runtimePos.x === 0 && runtimePos.y === 1, `runtime hunter did not take the walkable detour (${runtimePos.x},${runtimePos.y})`);
for (let i = 0; i < 5 && !caught; i++) Dungeon.stepFixedHunters();
assert(caught, 'runtime hunter did not reach the player through the shortest detour');

const hunterSource = source.slice(source.indexOf('stepFixedHunters:'), source.indexOf('startAngelTrial:'));
assert(hunterSource.includes('findShortestGridPath'), 'fixed hunters are not connected to shortest-path search');
assert(!hunterSource.includes('horizontalFirst'), 'legacy greedy hunter movement remains active');
assert(hunterSource.includes('path.length > range'), 'hunter range is not based on actual route length');

console.log('Fixed hunter pathfinding validation passed: shortest walkable detour, unreachable wait, same-cell handling, and runtime pursuit are connected.');
