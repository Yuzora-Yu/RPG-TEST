const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { collectReachableCells } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const context = { console };
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const file of ['items.js', 'monsters.js', 'quests.js', 'map.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const expected = {
    FIRE_VILLAGE: ['fire_board_hunt', 'fire_board_exchange'],
    WIND_VILLAGE: ['wind_board_hunt', 'wind_board_exchange'],
    WATER_CITY: ['water_board_hunt', 'water_board_exchange'],
    BIG_TOWER: ['tower_board_hunt', 'tower_board_exchange'],
    THUNDER_FORT: ['thunder_board_hunt', 'thunder_board_exchange'],
    LIGHT_PALACE: ['light_board_hunt', 'light_board_exchange'],
    DARK_CASTLE: ['dark_board_hunt', 'dark_board_exchange'],
    ABYSS_FIELD: ['abyss_board_hunt', 'abyss_board_exchange']
};
const items = context.ITEMS_DATA || context.window.ITEMS_DATA || [];
const monsters = context.MonsterData?.allBases || context.MONSTERS_DATA || context.window.MONSTERS_DATA || [];
const itemIds = new Set(items.map(item => Number(item.id)));
const itemById = new Map(items.map(item => [Number(item.id), item]));
const monsterIds = new Set(monsters.map(monster => Number(monster.id)));
const quests = context.QUEST_DATA || context.window.QUEST_DATA;
if (!quests) throw new Error('QUEST_DATA is unavailable.');

for (const [areaKey, questIds] of Object.entries(expected)) {
    const base = context.FIXED_MAPS?.[areaKey] || context.FIXED_DUNGEON_MAPS?.[areaKey];
    if (!base) throw new Error(`Map not found: ${areaKey}`);
    const floor = Array.isArray(base.floors) ? base.floors[0] : base;
    const boards = (floor.mapActions || []).filter(action => action.type === 'questBoard');
    if (boards.length !== 1) throw new Error(`${areaKey} must have exactly one quest board, found ${boards.length}.`);
    const board = boards[0];
    if (String(floor.tiles?.[board.y]?.[board.x] || '').toUpperCase() === 'W') {
        throw new Error(`${areaKey} quest board is on a wall tile.`);
    }
    if (JSON.stringify(board.questIds) !== JSON.stringify(questIds)) {
        throw new Error(`${areaKey} quest board IDs differ from the specification.`);
    }
    const start = floor.entryPoint || base.entryPoint;
    const reachable = collectReachableCells(floor, start);
    const hasReachableInteractionCell = [[0, -1], [1, 0], [0, 1], [-1, 0]]
        .some(([dx, dy]) => reachable.has(`${Number(board.x) + dx},${Number(board.y) + dy}`));
    if (!hasReachableInteractionCell) {
        throw new Error(`${areaKey} quest board has no reachable adjacent interaction cell.`);
    }
    for (const questId of questIds) {
        const quest = quests[questId];
        if (!quest) throw new Error(`Quest not found: ${questId}`);
        if (!Array.isArray(quest.unlockFlags) || !quest.unlockFlags.includes(board.requiredFlag)) {
            throw new Error(`${questId} does not share the quest board unlock flag ${board.requiredFlag}.`);
        }
        if (!Array.isArray(quest.rewardItems) || !quest.rewardItems.length) {
            throw new Error(`${questId} must grant at least one item reward.`);
        }
        for (const id of quest.targetMonsterIds || []) {
            if (!monsterIds.has(Number(id))) throw new Error(`${questId} references missing monster ${id}.`);
        }
        for (const entry of [...(quest.itemRequirements || []), ...(quest.rewardItems || [])]) {
            const id = Number(entry.id ?? entry.itemId);
            if (!itemIds.has(id)) throw new Error(`${questId} references missing item ${id}.`);
        }
        if (quest.kind === 'collection') {
            if (quest.consumeItemsOnComplete !== true) {
                throw new Error(`${questId} must consume its submitted materials.`);
            }
            const requirementRanks = (quest.itemRequirements || []).map(entry => Number(itemById.get(Number(entry.id ?? entry.itemId))?.rank || 0));
            const rewardRanks = (quest.rewardItems || []).map(entry => Number(itemById.get(Number(entry.id ?? entry.itemId))?.rank || 0));
            if (!requirementRanks.length || !rewardRanks.length || Math.max(...rewardRanks) <= Math.max(...requirementRanks)) {
                throw new Error(`${questId} must exchange submitted materials for a higher-rank item.`);
            }
        }
    }
}

if (Object.keys(expected).flatMap(key => expected[key]).length !== 16) throw new Error('Expected 16 board quests.');
console.log('Town quest board validation passed.');
console.log('8 boards, 16 quests, reachable interaction cells, unlock flags, monster targets, item references, and higher-rank exchanges are valid.');
