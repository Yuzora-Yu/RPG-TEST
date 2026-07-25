'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const ordered = (source, markers, label) => {
    let cursor = -1;
    for (const marker of markers) {
        const next = source.indexOf(marker, cursor + 1);
        assert(next >= 0, `${label}: missing marker ${marker}`);
        assert(next > cursor, `${label}: invalid order at ${marker}`);
        cursor = next;
    }
};

const battle = read('battle.js');
const winStart = battle.indexOf('win: async () =>');
const loseStart = battle.indexOf('lose: () =>');
const endStart = battle.indexOf('endBattle: (isGameOver = false) =>');
assert(winStart >= 0 && loseStart > winStart && endStart > loseStart, 'Battle result blocks were not found.');
const win = battle.slice(winStart, loseStart);
const lose = battle.slice(loseStart, endStart);

ordered(win, [
    '戦闘に勝利した！',
    "playResultSeAndWait('battle_victory')",
    'Goldを獲得！'
], 'Victory sequence');
ordered(win, [
    'Battle.log(event.notification)',
    "playResultSeAndWait('battle_level_up')",
    'for (const detail of event.details) Battle.log(detail)',
    'await Battle.waitForResultAdvance()'
], 'Level-up sequence');
assert(win.includes('Battle.resultInputLocked = true;'), 'Result input is not locked while mandatory SE plays.');
assert(lose.includes("playBgm?.('battle_wipeout'"), 'Wipeout BGM is not started.');
assert(lose.includes('Battle.resultReadyToEnd = true;'), 'Wipeout does not enter explicit input-ready state.');
assert(!lose.includes('Battle.endBattle('), 'Wipeout still transitions automatically.');
assert(battle.includes('Battle.endBattle(Battle.resultEndIsGameOver === true)'), 'Result tap does not preserve wipeout/game-over routing.');
assert(battle.includes("options.critical ? 'battle_critical' : 'battle_damage'"), 'Critical damage SE does not replace the normal hit SE.');

const blacksmith = read('blacksmith.js');
for (const marker of ['confirmSynthesis:', 'confirmRefine:', 'confirmEnhance:']) {
    const start = blacksmith.indexOf(marker);
    assert(start >= 0, `Blacksmith block missing: ${marker}`);
    const block = blacksmith.slice(start, blacksmith.indexOf('\n    },', start) + 7);
    assert(block.includes('await MenuBlacksmith.playStartSeAndWait()'), `Blacksmith result does not wait for start SE: ${marker}`);
}

const alchemy = read('alchemy.js');
ordered(alchemy, ['confirmRandomCraft:', 'await Alchemy.playStartSeAndWait()', 'Alchemy.randomCraftConfirmed()'], 'Random alchemy sequence');
ordered(alchemy, ['confirmCraft:', 'await Alchemy.playStartSeAndWait()', 'Alchemy.craftConfirmed('], 'Recipe alchemy sequence');

const dungeon = read('dungeon.js');
const chestStart = dungeon.indexOf('openChest: async');
const chestBlock = dungeon.slice(chestStart, dungeon.indexOf('// ★追加: 特性「57:目利き」', chestStart));
assert((chestBlock.match(/await Dungeon\.waitForChestTrapReveal\(\)/g) || []).length === 2,
    'Both fixed and random chest traps must wait before battle.');

const config = read('menus_config.js');
for (const label of ['フィールドBGM', '戦闘BGM', 'UI・メニューSE', '戦闘SE', 'フィールド・イベントSE']) {
    assert(config.includes(label), `Missing volume control: ${label}`);
}

console.log('PASS: audio categories and requested result-flow sequencing are wired correctly.');
