const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

let currentLink = null;
let followed = null;
let exited = null;
let action = null;
const logs = [];
const context = {
    console,
    window: {},
    StoryManager: null,
    MapRegistry: { findFloorLink: () => currentLink },
    Field: {
        currentMapData: { isFixed: true, isDungeon: true, exitPoint: { area: 'WORLD', x: 58, y: 56 } },
        getCurrentAreaKey: () => 'TEST'
    },
    App: {
        data: { progress: { flags: {} } },
        clearAction: () => { action = null; },
        setAction: (label, handler) => { action = { label, handler }; },
        log: message => logs.push(message)
    }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${read('dungeon.js')}\nglobalThis.__Dungeon = Dungeon;`, context, { filename: 'dungeon.js' });
const Dungeon = context.__Dungeon;
Dungeon.followFixedFloorLink = link => { followed = link; return true; };
Dungeon.exit = (fromBattle, forced) => { exited = { fromBattle, forced }; };

currentLink = { to: 'EXIT' };
assert(Dungeon.tryFixedAutoFloorLink('S', 1, 1) === true && followed === currentLink, 'Explicit EXIT link did not trigger on contact');

currentLink = null;
followed = null;
assert(Dungeon.tryFixedAutoFloorLink('S', 1, 1) === true, 'Unlinked fixed-dungeon S exit did not trigger on contact');
assert(exited?.forced?.x === 58 && exited?.forced?.y === 56, 'Unlinked S exit did not preserve the authored exit point');

currentLink = { to: 'EXIT', requiredFlag: 'opened', lockedLog: 'locked' };
followed = null;
context.App.data.progress.flags = {};
assert(Dungeon.tryFixedAutoFloorLink('S', 1, 1) === true && followed === null && logs.at(-1) === 'locked', 'Locked exit did not stop automatic departure');

currentLink = { toFloor: 2 };
assert(Dungeon.tryFixedAutoFloorLink('S', 1, 1) === false, 'Manual inter-floor S link was incorrectly treated as a dungeon exit');

currentLink = { to: 'EXIT' };
action = { label: 'stale' };
assert(Dungeon.prepareFixedTileAction('S', 1, 1, { silent: true }) === false && action === null, 'Fixed exit still exposes an action button');

console.log('Fixed dungeon exit validation passed: EXIT and unlinked S cells activate on contact; locked and inter-floor links remain safe.');
