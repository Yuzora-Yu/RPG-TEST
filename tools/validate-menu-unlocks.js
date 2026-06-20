const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const menuSource = fs.readFileSync(path.join(root, 'menus.js'), 'utf8');
const dungeonSource = fs.readFileSync(path.join(root, 'dungeon.js'), 'utf8');

function extractObjectSection(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    if (start < 0 || end < 0) {
        throw new Error(`Unable to extract section: ${startMarker}`);
    }
    return source.slice(start, end);
}

const unlockSection = extractObjectSection(
    mainSource,
    '    unlockDefaults:',
    '    ensureCharacterBattleConfig:'
);

const context = {
    App: {
        data: null
    }
};
vm.createContext(context);
vm.runInContext(`App = { ...App,\n${unlockSection}\n};`, context);

function migrate(data) {
    context.App.data = JSON.parse(JSON.stringify(data));
    const result = context.App.ensureUnlockState();
    return {
        unlocked: JSON.parse(JSON.stringify(result)),
        flags: JSON.parse(JSON.stringify(context.App.data.progress.flags))
    };
}

const fresh = migrate({
    progress: {},
    dungeon: { tryCount: 0, maxFloor: 0 },
    location: { area: 'WORLD' }
});
if (fresh.unlocked.smith !== false) throw new Error('Fresh save must keep smith locked.');
if (fresh.unlocked.dungeonMenu !== false) throw new Error('Fresh save must keep dungeon menu locked.');
if (fresh.unlocked.gacha !== false) throw new Error('Fresh save must keep gacha locked.');
if (fresh.flags.menuUnlockMigrationV1 !== true) throw new Error('Migration marker was not stored.');
if (fresh.flags.menuUnlockMigrationV2 !== true) throw new Error('Gacha lock migration marker was not stored.');

const fireCleared = migrate({
    progress: { flags: { fireVillageCleared: true } },
    dungeon: { tryCount: 0, maxFloor: 0 },
    location: { area: 'WORLD' }
});
if (fireCleared.unlocked.smith !== true) throw new Error('Fire Village clear must unlock smith.');

const dungeonEntered = migrate({
    progress: { flags: {} },
    dungeon: { tryCount: 1, maxFloor: 1 },
    location: { area: 'WORLD' }
});
if (dungeonEntered.unlocked.dungeonMenu !== true) {
    throw new Error('First dungeon entry must unlock the dungeon menu.');
}

const previouslyUnlockedGacha = migrate({
    progress: {
        flags: { menuUnlockMigrationV1: true },
        unlocked: { smith: false, dungeonMenu: false, gacha: true }
    },
    dungeon: { tryCount: 0, maxFloor: 0 },
    location: { area: 'WORLD' }
});
if (previouslyUnlockedGacha.unlocked.gacha !== false) {
    throw new Error('Existing saves from the always-unlocked version must have gacha relocked.');
}

const lockedMarkupChecks = [
    "blacksmith: 'smith'",
    "dungeon: 'dungeonMenu'",
    "gacha: 'gacha'",
    '？？？？',
    '未開放',
    'is-feature-locked'
];
for (const marker of lockedMarkupChecks) {
    if (!menuSource.includes(marker)) throw new Error(`Missing locked menu marker: ${marker}`);
}

const dungeonUnlockCalls = dungeonSource.match(/unlockFeature\('dungeonMenu'\)/g) || [];
if (dungeonUnlockCalls.length < 2) {
    throw new Error('Dungeon menu unlock must be applied to both dungeon entry routes.');
}

console.log('Menu unlock validation passed.');
console.log('Fresh: smith, dungeon, and gacha locked.');
console.log('Migration: Fire Village and dungeon progress restored; previously open gacha relocked.');
