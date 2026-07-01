const fs = require('fs');
const path = require('path');
const {
    collectReachableCells,
    loadMapRuntime,
} = require('./validation-helpers');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const mapSource = read('map.js');
const mainSource = read('main.js');
const questSource = read('quests.js');
const menuSource = read('menus_status.js');
const monsterSource = read('monsters.js');
const storySource = read('story.js');
const storyLogicSource = read('story_logic.js');
const storyRuntimeSource = `${storySource}\n${storyLogicSource}`;
const dungeonSource = read('dungeon.js');

if (menuSource.includes("available: '未受注'") || menuSource.includes('rewardNames') || menuSource.includes('加入:')) {
    throw new Error('Quest record still exposes unavailable quests or ally rewards.');
}
if (!menuSource.includes("state === 'accepted' || state === 'completed'")) {
    throw new Error('Quest record must only show accepted and completed quests.');
}
if (!menuSource.includes('openQuestDetail') || !menuSource.includes('クエスト名を選ぶと詳細を確認できます')) {
    throw new Error('Quest record must list quest names first and open details from a modal.');
}
if (!mainSource.includes('showQuestModal') || !mainSource.includes('offer: true') || !mainSource.includes('受ける') || !mainSource.includes('やめる')) {
    throw new Error('Quest offers must use an accept/decline modal.');
}
if (!mainSource.includes('討伐対象') || !mainSource.includes('getQuestMonsterName')) {
    throw new Error('Quest detail modal must show hunt target monster names.');
}
if (!mainSource.includes("action.log && action.type !== 'quest'")) {
    throw new Error('Quest map actions must not write NPC flavor text to the log area.');
}

function getMonsterName(id) {
    const match = monsterSource.match(new RegExp(`"id":${Number(id)},"name":"([^"]+)"`));
    if (!match) throw new Error(`Monster name not found: ${id}`);
    return match[1];
}

for (const marker of [
    'getAdjacentFixedBoss',
    "tile === 'B'",
    '強敵が行く手を塞いでいる',
    'Field.isFixedBossAvailable(bossDef)'
]) {
    if (!mainSource.includes(marker)) throw new Error(`Boss contact flow marker is missing: ${marker}`);
}

const { context, runFile } = loadMapRuntime(root);
runFile('quests.js');

const questBosses = [];
const unreachableBosses = [];
for (const [areaKey, dungeon] of Object.entries(context.FIXED_DUNGEON_MAPS)) {
    const floors = dungeon.floors || [];
    for (const [floorIndex, floor] of floors.entries()) {
        const floorNo = floorIndex + 1;
        const starts = [floor.entryPoint || dungeon.entryPoint].filter(Boolean);
        for (const otherFloor of floors) {
            for (const link of otherFloor.floorLinks || []) {
                if (Number(link.toFloor) === floorNo && Number.isFinite(Number(link.targetX)) && Number.isFinite(Number(link.targetY))) {
                    starts.push({ x: Number(link.targetX), y: Number(link.targetY) });
                }
            }
        }
        const reachableSets = starts.map(start => collectReachableCells(floor, start, { blockBosses: true }));
        for (const boss of floor.bosses || []) {
            if (boss.questId) questBosses.push({ areaKey, floor, boss });
            const adjacentReachable = [[0, -1], [1, 0], [0, 1], [-1, 0]]
                .some(([dx, dy]) => reachableSets.some(visited => visited.has(`${Number(boss.x) + dx},${Number(boss.y) + dy}`)));
            if (!adjacentReachable) unreachableBosses.push(`${areaKey} ${floor.label} (${boss.x},${boss.y})`);
        }
    }
}
if (unreachableBosses.length) {
    throw new Error(`Bosses cannot be approached while their tile is blocked:\n${unreachableBosses.join('\n')}`);
}
if (questBosses.length < 9) throw new Error(`Expected at least 9 quest-gated bosses, found ${questBosses.length}.`);
for (const { areaKey, floor, boss } of questBosses) {
    const actions = floor.mapActions || [];
    const hasQuestGiver = actions.some(action => action.questId === boss.questId) ||
        mapSource.includes(`questId: "${boss.questId}"`) ||
        mapSource.includes(`"questId": "${boss.questId}"`);
    if (!hasQuestGiver) throw new Error(`Quest boss has no visible quest acceptance route: ${areaKey} ${boss.questId}`);
}

for (const questId of ['marie_water_city', 'hayate_water_city', 'sylvia_water_city', 'rin_thunder_fort']) {
    const quest = context.window.QUEST_DATA?.[questId];
    if (!Array.isArray(quest?.targetMonsterIds) || quest.targetMonsterIds.length === 0 || Number(quest.targetCount) <= 0) {
        throw new Error(`Hunt quest lacks a real kill objective: ${questId}`);
    }
    const questText = `${quest.objective || ''}\n${quest.startText || ''}\n${quest.progressText || ''}`;
    for (const monsterId of quest.targetMonsterIds) {
        const monsterName = getMonsterName(monsterId);
        if (!questText.includes(monsterName)) {
            throw new Error(`Hunt quest text does not name target monster ${monsterName}: ${questId}`);
        }
    }
    if (quest.initialComplete === true) {
        throw new Error(`Hunt quest still completes instantly: ${questId}`);
    }
    for (const eventKey of ['startEventId', 'reportEventId']) {
        const eventId = quest[eventKey];
        if (!eventId || !storyRuntimeSource.includes(`"${eventId}"`)) {
            throw new Error(`Quest dialogue event is missing: ${questId}.${eventKey}`);
        }
    }
}

const zeliedQuest = context.window.QUEST_DATA?.zelied_big_tower;
if (zeliedQuest?.kind !== 'boss' || !zeliedQuest.startEventId || !zeliedQuest.reportEventId) {
    throw new Error('Zelied quest must use a boss objective with start/report dialogue.');
}
for (const mainStoryQuestId of ['fire_holy_water', 'water_blue_crystal']) {
    if (context.window.QUEST_DATA?.[mainStoryQuestId]) {
        throw new Error(`${mainStoryQuestId} must remain main-story progression, not a quest entry.`);
    }
}
const attunement = context.window.QUEST_DATA?.fire_water_attunement;
if (!attunement?.unlockFlags?.includes('forestHolyWaterObtained') ||
    !attunement?.unlockFlags?.includes('blueCrystalObtained') ||
    Array.isArray(attunement?.requiredQuests)) {
    throw new Error('Fire/water attunement must unlock from main-story flags, not removed quest IDs.');
}
if (!mainSource.includes('markQuestBossDefeated') || !mainSource.includes("quest.kind === 'boss'")) {
    throw new Error('Boss quest progress is not connected to fixed-boss victory.');
}
if (!read('dungeon.js').includes('fixedBossPosition')) {
    throw new Error('Adjacent boss battles must preserve the actual boss tile position.');
}
for (const marker of ['dismissChoiceUI', 'prepareBattleTransitionUI']) {
    if (!storyRuntimeSource.includes(marker)) throw new Error(`Battle transition dialogue cleanup is missing: ${marker}`);
}
if (!mainSource.includes("sceneId === 'battle'") || !mainSource.includes('prepareBattleTransitionUI')) {
    throw new Error('Every battle scene transition must close transient story UI.');
}
if (!dungeonSource.includes('StoryManager.prepareBattleTransitionUI()')) {
    throw new Error('Fixed boss confirmation must close the choice UI before battle transition.');
}
if (dungeonSource.includes('StoryManager?.dismissChoiceUI') ||
    dungeonSource.includes('StoryManager?.prepareBattleTransitionUI')) {
    throw new Error('Fixed boss confirmation uses unsafe optional chaining on a possibly undeclared StoryManager.');
}

for (const marker of [
    '"value": "カリンは刃を収めた。"',
    '"value": "ソフィアは微笑んだ。"',
    '"value": "リーシアの瞳が開いた。"'
]) {
    if (storyRuntimeSource.includes(marker)) throw new Error(`Placeholder quest narration remains: ${marker}`);
}
for (const conversationId of [
    'QUEST_KARIN_CLEAR',
    'QUEST_ARISA_HAINE_CLEAR',
    'QUEST_SOPHIA_ALAN_CLEAR',
    'QUEST_FRIEDA_BARON_CLEAR',
    'QUEST_LICIA_CLEAR',
    'QUEST_CLAUDE_LEON_CLEAR',
    'QUEST_LUNA_CLEAR',
    'QUEST_RYU_MINERVA_CLEAR',
    'QUEST_ZENON_CLEAR'
]) {
    if (!storyRuntimeSource.includes(`"value": "${conversationId}"`)) {
        throw new Error(`Recruitment victory lacks a real conversation: ${conversationId}`);
    }
}

console.log(`Quest experience validation passed. Quest-gated bosses: ${questBosses.length}.`);
console.log('Quest record hides unavailable quests and ally reward spoilers.');
console.log('Hunt quests use battle-counted objectives and report completion.');
console.log('Every fixed boss can be approached without stepping onto its tile.');
