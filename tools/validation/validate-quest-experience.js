const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
    collectReachableCells,
    loadMapRuntime,
} = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
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
if (!dungeonSource.includes('isFixedBossTriggerAllowed')) {
    throw new Error('Fixed quest bosses do not have a shared final trigger gate.');
}
for (const marker of ['isFixedBossDefeatedAt:', "questState === 'accepted' && !objectiveComplete", '.filter(entry => entry !== posKey)']) {
    if (!mainSource.includes(marker)) throw new Error(`Stale fixed quest-boss defeat repair is missing: ${marker}`);
}
if ((dungeonSource.match(/Dungeon\.isFixedBossTriggerAllowed\(/g) || []).length < 5) {
    throw new Error('Fixed boss gate must be rechecked for action preparation, event callback, confirmation, and battle start.');
}
if (!dungeonSource.includes('汎用ボス処理へフォールスルーさせてはならない')) {
    throw new Error('Fixed boss tile handling can regress into the generic boss fallback.');
}

// 実際の Dungeon オブジェクトを最小ランタイムで起動し、未受注・完了済み・
// 討伐済みのクエストボスがアクションにも戦闘にも到達しないことを確認する。
{
    let questState = 'available';
    let pendingAction = null;
    let eventStarts = 0;
    let battleStarts = 0;
    let questBossDefeated = false;
    const bossDef = { x: 4, y: 5, monsterId: 999001, questId: 'validation_quest', startEventId: 'VALIDATION_BOSS_EVENT' };
    const mapDef = { isFixed: true, isDungeon: true, areaKey: 'VALIDATION', width: 10, height: 10 };
    const sandbox = {
        console,
        setTimeout,
        clearTimeout,
        window: { MonsterData: { getMonsterById: () => ({}) } },
        App: {
            data: {
                location: { area: 'VALIDATION' },
                progress: { flags: {}, defeatedBosses: {}, storyStep: 99, subStep: 99 },
                battle: {},
            },
            isQuestUnlocked: () => true,
            getQuestState: () => ({ state: questState }),
            isQuestObjectiveComplete: () => questBossDefeated,
            clearAction: () => { pendingAction = null; },
            setAction: (_label, action) => { pendingAction = action; },
            save: () => {},
            changeScene: scene => { if (scene === 'battle') battleStarts += 1; },
            log: () => {},
        },
        Field: {
            currentMapData: mapDef,
            getCurrentAreaKey: () => 'VALIDATION',
            isFixedBossAvailable: boss => !!boss && (!boss.questId || questState === 'accepted'),
            isFixedBossDefeatedAt: (boss, x, y, key) => {
                const posKey = `${Number(x)},${Number(y)}`;
                const entries = sandbox.App.data.progress.defeatedBosses?.[key] || [];
                if (!entries.includes(posKey)) return false;
                if (boss?.questId && questState === 'accepted' && !questBossDefeated) {
                    sandbox.App.data.progress.defeatedBosses[key] = entries.filter(entry => entry !== posKey);
                    return false;
                }
                return true;
            },
            refreshCurrentAction: () => false,
        },
        MapRegistry: { findFixedBoss: () => bossDef },
        StoryManager: {
            executeEvent: () => { eventStarts += 1; },
            prepareBattleTransitionUI: () => {},
        },
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(dungeonSource.replace('const Dungeon = {', 'globalThis.Dungeon = {'), sandbox, { filename: 'dungeon.js' });
    sandbox.Dungeon.getFixedProgressKey = () => 'VALIDATION';

    for (const blockedState of ['available', 'completed']) {
        questState = blockedState;
        pendingAction = null;
        if (sandbox.Dungeon.prepareFixedTileAction('B', 4, 5, { silent: true }) !== false || pendingAction) {
            throw new Error(`Quest boss action is exposed while quest state is ${blockedState}.`);
        }
        if (sandbox.Dungeon.startFixedBoss(4, 5) !== false || battleStarts !== 0) {
            throw new Error(`Quest boss battle starts while quest state is ${blockedState}.`);
        }
    }

    questState = 'accepted';
    if (!sandbox.Dungeon.prepareFixedTileAction('B', 4, 5, { silent: true }) || typeof pendingAction !== 'function') {
        throw new Error('Accepted quest boss did not expose its action.');
    }
    questState = 'available';
    pendingAction();
    if (eventStarts !== 0 || battleStarts !== 0) {
        throw new Error('Quest boss action did not recheck acceptance immediately before its event.');
    }

    questState = 'accepted';
    sandbox.App.data.progress.defeatedBosses.VALIDATION = ['4,5'];
    questBossDefeated = false;
    if (!sandbox.Dungeon.prepareFixedTileAction('B', 4, 5, { silent: true }) ||
        sandbox.App.data.progress.defeatedBosses.VALIDATION.includes('4,5')) {
        throw new Error('Accepted unfinished quest did not restore a boss hidden by a stale fixed defeat flag.');
    }
    sandbox.App.data.progress.defeatedBosses.VALIDATION = ['4,5'];
    questBossDefeated = true;
    if (sandbox.Dungeon.startFixedBoss(4, 5) !== false || battleStarts !== 0) {
        throw new Error('Quest boss with legitimate objective progress can be started again.');
    }
    questBossDefeated = false;
    sandbox.App.data.progress.defeatedBosses.VALIDATION = [];
    if (sandbox.Dungeon.startFixedBoss(4, 5) !== true || battleStarts !== 1) {
        throw new Error('Accepted, undefeated quest boss cannot start normally.');
    }
}

const { context, runFile } = loadMapRuntime(root);
runFile('quests.js');
runFile('story.js', 'globalThis.STORY_MANAGER_DATA = STORY_MANAGER_DATA;');

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
    if (!context.window.QUEST_DATA?.[boss.questId]) {
        throw new Error(`Quest boss references an unknown questId: ${areaKey} ${floor.label} ${boss.questId}`);
    }
    if (!boss.startEventId) {
        throw new Error(`Quest boss has no pre-battle conversation event: ${areaKey} ${floor.label} ${boss.questId}`);
    }
    const encounterEvent = context.STORY_MANAGER_DATA?.events?.[boss.startEventId];
    if (!encounterEvent) {
        throw new Error(`Quest boss references a missing encounter event: ${areaKey} ${boss.startEventId}`);
    }
    const encounterActions = Array.isArray(encounterEvent.actions) ? encounterEvent.actions : [];
    const conversationIndex = encounterActions.findIndex(action => action?.type === 'CONV');
    const battleIndex = encounterActions.findIndex(action => action?.type === 'BOSS');
    if (conversationIndex < 0 || battleIndex <= conversationIndex) {
        throw new Error(`Quest boss encounter must run CONV before BOSS: ${areaKey} ${boss.startEventId}`);
    }
    const conversationKey = encounterActions[conversationIndex]?.value;
    if (!conversationKey || !Array.isArray(context.STORY_MANAGER_DATA?.scripts?.[conversationKey]) ||
        context.STORY_MANAGER_DATA.scripts[conversationKey].length === 0) {
        throw new Error(`Quest boss encounter has no dialogue script: ${areaKey} ${boss.startEventId}`);
    }
    const battleAction = encounterActions[battleIndex];
    const expectedMonsters = Array.isArray(boss.monsterId) ? boss.monsterId.map(Number) : [Number(boss.monsterId)];
    const actualMonsters = Array.isArray(battleAction.value) ? battleAction.value.map(Number) : [Number(battleAction.value)];
    if (JSON.stringify(actualMonsters) !== JSON.stringify(expectedMonsters)) {
        throw new Error(`Quest boss encounter composition differs from map data: ${areaKey} ${boss.startEventId}`);
    }
    if (battleAction.winEventId !== boss.storyEventId || !context.STORY_MANAGER_DATA.events?.[battleAction.winEventId]) {
        throw new Error(`Quest boss encounter is not connected to its existing victory event: ${areaKey} ${boss.startEventId}`);
    }
    const actions = floor.mapActions || [];
    const hasQuestGiver = actions.some(action => action.questId === boss.questId) ||
        mapSource.includes(`questId: "${boss.questId}"`) ||
        mapSource.includes(`"questId": "${boss.questId}"`);
    if (!hasQuestGiver) throw new Error(`Quest boss has no visible quest acceptance route: ${areaKey} ${boss.questId}`);
}

const crenaFloors = context.FIXED_DUNGEON_MAPS?.CRENA_LIMESTONE_CAVE?.floors || [];
const crenaGateFloor = crenaFloors[1];
const liciaGate = crenaGateFloor?.mapActions?.find(action => action.questId === 'licia_crena_depths');
if (!liciaGate || Number(liciaGate.x) !== 20 || Number(liciaGate.y) !== 9 ||
    liciaGate.imageKey !== 'overlay_companion_licia' || liciaGate.hideWhenQuestAccepted !== true) {
    throw new Error('Licia must block the crystal-room corridor at (20,9) and disappear immediately after quest acceptance.');
}
if (String(crenaGateFloor.tiles?.[9]?.[20] || '').toUpperCase() !== 'T') {
    throw new Error('Licia quest gate must stand on a normal walkable floor tile.');
}
const crenaEntry = crenaGateFloor.entryPoint;
const crenaDepthLink = crenaGateFloor.floorLinks?.find(link => Number(link.toFloor) === 3);
const openCrenaReachable = collectReachableCells(crenaGateFloor, crenaEntry);
if (!crenaDepthLink || !openCrenaReachable.has(`${crenaDepthLink.x},${crenaDepthLink.y}`)) {
    throw new Error('Crena depth entrance must be reachable after Licia leaves.');
}
const blockedCrenaFloor = {
    ...crenaGateFloor,
    tiles: crenaGateFloor.tiles.map(row => Array.isArray(row) ? [...row] : String(row).split('')),
};
blockedCrenaFloor.tiles[Number(liciaGate.y)][Number(liciaGate.x)] = 'W';
if (collectReachableCells(blockedCrenaFloor, crenaEntry).has(`${crenaDepthLink.x},${crenaDepthLink.y}`)) {
    throw new Error('Licia does not actually seal the only route to the crystal-room depth entrance.');
}
const liciaQuest = context.window.QUEST_DATA?.licia_crena_depths;
if (liciaQuest?.startEventId !== 'quest_licia_start' ||
    !storyRuntimeSource.includes('"value": "QUEST_LICIA_START"') ||
    !storyRuntimeSource.includes('私が結界を解く')) {
    throw new Error('Licia quest acceptance dialogue does not explain that she will break the barrier and lead the party onward.');
}

// リーシアだけは受注時に結界前から離れる。ほかの同行者は討伐後も
// 依頼地点に残り、本人への報告で完了・加入した時点ではじめて消える。
const reportRequiredCompanionQuests = [
    'arisa_haine_forest_depths',
    'sophia_alan_seabed_depths',
    'frieda_baron_thunder_depths',
    'claude_leon_dark_shrine',
    'ryu_minerva_grezelia',
];
const authoredQuestActions = [
    ...Object.values(context.FIXED_MAPS || {}).flatMap(map => map.mapActions || []),
    ...Object.values(context.FIXED_DUNGEON_MAPS || {}).flatMap(dungeon =>
        (dungeon.floors || []).flatMap(floor => floor.mapActions || [])),
];
for (const questId of reportRequiredCompanionQuests) {
    const giverActions = authoredQuestActions.filter(action => action.questId === questId);
    if (!giverActions.length) throw new Error(`Companion quest has no report NPC action: ${questId}`);
    if (giverActions.some(action => action.hideWhenQuestAccepted === true)) {
        throw new Error(`Companion report NPC disappears on acceptance: ${questId}`);
    }
    const bossEntry = questBosses.find(entry => entry.boss.questId === questId);
    const victoryEvent = context.STORY_MANAGER_DATA?.events?.[bossEntry?.boss?.storyEventId];
    if (!victoryEvent) throw new Error(`Companion quest has no victory event: ${questId}`);
    if ((victoryEvent.actions || []).some(action => action?.type === 'QUEST_COMPLETE')) {
        throw new Error(`Companion quest completes before reporting to its NPC: ${questId}`);
    }
}
if (!mainSource.includes("if (questState === 'completed') return false") ||
    !mainSource.includes("questState === 'accepted'")) {
    throw new Error('Quest NPC visibility does not distinguish accepted quests from reported/completed quests.');
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
