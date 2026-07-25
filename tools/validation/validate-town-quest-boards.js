/*
 * Compatibility filename retained for existing npm/docs references.
 * The current design has no town quest boards: all rotating requests are
 * mastered in guild_quests.js and accessed from the Raizark guild board.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const context = { console };
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const file of ['items.js', 'monsters.js', 'quests.js', 'guild_quests.js', 'guild_master.js', 'map.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const normalQuests = context.QUEST_DATA || {};
const guildQuests = context.GUILD_QUEST_DATA || {};
const guildMaster = context.GUILD_MASTER_DATA || {};
const monsters = context.MonsterData?.allBases || context.MONSTERS_DATA || [];
const items = context.ITEMS_DATA || [];
const monsterIds = new Set(monsters.map(monster => Number(monster.id)));
const itemIds = new Set(items.map(item => Number(item.id)));

if (Object.keys(guildQuests).length !== 21) {
    throw new Error(`Guild request master must contain 21 requests, found ${Object.keys(guildQuests).length}.`);
}
if (Object.keys(normalQuests).some(id => guildQuests[id])) {
    throw new Error('Normal quest and guild request masters must not share IDs.');
}

const visitMaps = (definitions) => {
    Object.entries(definitions || {}).forEach(([areaKey, map]) => {
        const floors = Array.isArray(map.floors) ? map.floors : [map];
        floors.forEach((floor, floorIndex) => {
            const legacyBoards = (floor.mapActions || []).filter(action => action?.type === 'questBoard');
            if (legacyBoards.length) {
                throw new Error(`${areaKey} floor ${floorIndex + 1} still contains a legacy town questBoard action.`);
            }
        });
    });
};
visitMaps(context.FIXED_MAPS);
visitMaps(context.FIXED_DUNGEON_MAPS);

const guildFloor = context.FIXED_DUNGEON_MAPS?.THUNDER_FORT?.floors?.[0];
if (!guildFloor) throw new Error('THUNDER_FORT floor 1 is unavailable.');
const guildBoardActions = (guildFloor.mapActions || []).filter(action => action?.type === 'guildBoard');
const guildReceptionActions = (guildFloor.mapActions || []).filter(action => action?.type === 'guild');
if (guildBoardActions.length !== 1) throw new Error(`Raizark must have one guildBoard action, found ${guildBoardActions.length}.`);
if (guildReceptionActions.length !== 1) throw new Error(`Raizark must have one guild reception action, found ${guildReceptionActions.length}.`);
if (Number(guildBoardActions[0].drawOffsetX) !== 12) throw new Error('Guild board drawOffsetX must be 12px.');

const board = guildBoardActions[0];
const reception = guildReceptionActions[0];
const assertArea = (label, actual, expected) => {
    for (const key of ['x', 'y', 'width', 'height']) {
        if (Number(actual?.[key]) !== Number(expected[key])) {
            throw new Error(`${label}.${key} must be ${expected[key]}, found ${actual?.[key]}.`);
        }
    }
};
assertArea('guildBoard.interactionArea', board.interactionArea, { x: 8, y: 20, width: 2, height: 1 });
assertArea('guildBoard.minimapArea', board.minimapArea, { x: 8, y: 20, width: 2, height: 1 });
assertArea('guildReception.interactionArea', reception.interactionArea, { x: 5, y: 21, width: 1, height: 1 });
assertArea('guildReception.minimapArea', reception.minimapArea, { x: 3, y: 21, width: 5, height: 1 });

const blockerAt = (x, y) => (guildFloor.blockingObjects || []).some(object => Number(object.x) === x && Number(object.y) === y);
for (const [x, y] of [[8, 19], [9, 19], [8, 20], [9, 20]]) {
    const occupiedByBoardAction = Number(board.x) === x && Number(board.y) === y && board.blocksMovement === true;
    if (!occupiedByBoardAction && !blockerAt(x, y)) throw new Error(`Guild board collision is missing at ${x},${y}.`);
}
// Counter collision master: top row ○○○○× / bottom row ×××××.
for (const [x, y] of [[7, 20], [3, 21], [4, 21], [5, 21], [6, 21], [7, 21]]) {
    if (!blockerAt(x, y)) throw new Error(`Guild counter collision is missing at ${x},${y}.`);
}
for (const [x, y] of [[3, 20], [4, 20], [6, 20]]) {
    if (blockerAt(x, y)) throw new Error(`Guild counter must remain passable at ${x},${y}.`);
}
if (!(Number(reception.x) === 5 && Number(reception.y) === 20 && reception.blocksMovement === true)) {
    throw new Error('Guild receptionist must occupy and block 5,20.');
}

const dungeonHuntIds = [
    'guild_ignis_patrol',
    'guild_kazaria_patrol',
    'guild_rivaria_patrol',
    'guild_lighthouse_patrol',
    'guild_raizark_patrol'
];
for (const id of dungeonHuntIds) {
    const quest = guildQuests[id];
    if (quest?.kind !== 'hunt' || quest?.requestType !== 'dungeonHunt' || quest?.huntScope?.mode !== 'dungeon') {
        throw new Error(`${id} must be mastered as a dungeon-wide hunt.`);
    }
    if (!Array.isArray(quest.huntScope.areaKeys) || quest.huntScope.areaKeys.length !== 1) {
        throw new Error(`${id} must declare exactly one canonical dungeon area.`);
    }
    if (Array.isArray(quest.targetMonsterIds) && quest.targetMonsterIds.length) {
        throw new Error(`${id} must not require monster-name knowledge at low rank.`);
    }
}

const monsterHuntIds = ['guild_prisma_patrol', 'guild_galvania_patrol', 'guild_abyss_suppression'];
for (const id of monsterHuntIds) {
    const quest = guildQuests[id];
    if (quest?.huntScope?.mode !== 'monster' || !String(quest.spawnAreaLabel || '').trim()) {
        throw new Error(`${id} must declare a player-visible spawn area label.`);
    }
}

const abyssFloorRequests = [
    ['guild_abyss_patrol_051_060', 51, 60, 'D'],
    ['guild_abyss_patrol_081_090', 81, 90, 'C'],
    ['guild_abyss_patrol_111_120', 111, 120, 'B'],
    ['guild_abyss_patrol_151_160', 151, 160, 'A'],
    ['guild_abyss_patrol_191_200', 191, 200, 'S']
];
for (const [id, floorMin, floorMax, rank] of abyssFloorRequests) {
    const quest = guildQuests[id];
    if (quest?.huntScope?.mode !== 'floorRange') throw new Error(`${id} must be a floor-range hunt.`);
    if (Number(quest.huntScope.floorMin) !== floorMin || Number(quest.huntScope.floorMax) !== floorMax) {
        throw new Error(`${id} has an invalid floor range.`);
    }
    if (quest.huntScope.normalBattlesOnly !== true) throw new Error(`${id} must exclude boss battles.`);
    if (Number(quest.requiredMaxAbyssFloor) !== floorMax) throw new Error(`${id} must unlock only after floor ${floorMax} is reached.`);
    if (quest.requiredRank !== rank) throw new Error(`${id} must require rank ${rank}.`);
}

const traitBookExchange = (guildMaster.exchangeEntries || []).filter(entry => Number(entry.itemId) >= 112 && Number(entry.itemId) <= 122);
if (traitBookExchange.length !== 11) throw new Error(`Guild exchange must contain 11 trait books, found ${traitBookExchange.length}.`);
for (const entry of traitBookExchange) {
    const expectedCost = Number(entry.itemId) <= 117 ? 5000 : 10000;
    if (Number(entry.cost) !== expectedCost) throw new Error(`Trait book ${entry.itemId} must cost ${expectedCost} GP.`);
    if (!itemIds.has(Number(entry.itemId))) throw new Error(`Trait book exchange references missing item ${entry.itemId}.`);
}

for (const [id, quest] of Object.entries(guildQuests)) {
    if (quest.id !== id) throw new Error(`${id} must declare the same canonical id in its master record.`);
    if (quest.guildQuest !== true || quest.repeatable !== true) throw new Error(`${id} must be a repeatable guild request.`);
    if (quest.reportAt !== 'guildReception') throw new Error(`${id} must be reported at the guild reception.`);
    if (!guildMaster.ranks?.some(rank => rank.id === quest.requiredRank)) throw new Error(`${id} references invalid rank ${quest.requiredRank}.`);
    for (const monsterId of quest.targetMonsterIds || []) {
        if (!monsterIds.has(Number(monsterId))) throw new Error(`${id} references missing monster ${monsterId}.`);
    }
    for (const entry of [...(quest.itemRequirements || []), ...(quest.rewardItems || [])]) {
        const itemId = Number(entry.id ?? entry.itemId);
        if (!itemIds.has(itemId)) throw new Error(`${id} references missing item ${itemId}.`);
    }
}

const expectedTrialRanks = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
for (const rank of expectedTrialRanks) {
    const trial = guildMaster.promotionTrials?.[rank];
    if (!trial) throw new Error(`Promotion trial ${rank} is missing.`);
    const boss = monsters.find(monster => Number(monster.id) === Number(trial.monsterId));
    if (!boss?.isGuildPromotionBoss || boss.promotionRank !== rank) {
        throw new Error(`Promotion trial ${rank} does not reference its dedicated monster master.`);
    }
}
const leonard = monsters.find(monster => Number(monster.id) === 301040);
const firstTrial = monsters.find(monster => Number(monster.id) === Number(guildMaster.promotionTrials?.F?.monsterId));
for (const stat of ['hp', 'mp', 'atk', 'def', 'spd', 'mag', 'mdef']) {
    if (Number(firstTrial?.[stat] || 0) < Number(leonard?.[stat] || 0)) {
        throw new Error(`F promotion boss ${stat} must not be below Leonard.`);
    }
}

console.log('Guild master validation passed.');
console.log('No town boards, 21 canonical requests, reached-floor Abyss hunts, exact counter geometry, trait-book exchange entries, and seven dedicated promotion boss masters are present.');
