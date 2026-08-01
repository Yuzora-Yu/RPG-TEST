const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

async function validateNestedEventResume() {
    const storyDataContext = { console };
    storyDataContext.window = storyDataContext;
    storyDataContext.globalThis = storyDataContext;
    vm.createContext(storyDataContext);
    vm.runInContext(`${read('story.js')}\nglobalThis.__storyData = STORY_MANAGER_DATA;`, storyDataContext, { filename: 'story.js' });
    const events = storyDataContext.__storyData.events;
    events.noop = { actions: [{ type: 'LOG', value: 'ok' }] };

    // 実データのレイラ加入イベントで、世界樹の葉消費直後から再開する。
    const active = {
        token: 'evt-test', eventId: 'light_palace_prison_leila', phase: 'actions', status: 'running',
        currentPath: [0, 'then', 1, 'then', 0, 'yes', 0],
        completedActions: { '0/then/1/then/0/yes/0': true },
        selectedBranches: {
            '0': 'then',
            '0/then/1': 'then',
            '0/then/1/then/0': 'yes'
        },
        effectStates: {}, meta: {}
    };
    const App = {
        data: {
            progress: {
                flags: { lightPalaceCleared: true },
                eventJournal: { version: 2, queue: [], active },
                activeEvent: active
            },
            items: {}, characters: [], party: [], stats: {}
        },
        saveCount: 0,
        save() { this.saveCount += 1; return true; },
        log() {},
        addStoryAlly(charId) { this.data.characters.push({ charId: Number(charId), uid: `c${charId}` }); },
        reconcileDerivedProgressFlags() {}
    };
    const context = {
        console, setTimeout, clearTimeout, Promise,
        App,
        DB: { ITEMS: [{ id: 5, name: '世界樹の葉' }], CHARACTERS: [] },
        STORY_MANAGER_DATA: { scripts: storyDataContext.__storyData.scripts, events },
        Field: { refreshCurrentAction() {}, render() {}, getCurrentAreaKey() { return 'TEST'; } },
        document: {
            getElementById() { return null; },
            createElement() { return { style: {}, dataset: {}, remove() {}, appendChild() {}, setAttribute() {}, getAttribute() { return ''; } }; },
            body: { appendChild() {} }, head: { appendChild() {} }
        }
    };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(`${read('story_logic.js')}\nglobalThis.StoryManager = StoryManager;`, context, { filename: 'story_logic.js' });
    const StoryManager = context.StoryManager;
    StoryManager.refreshFieldAfterStoryStateChange = () => {};
    StoryManager.showConversation = async () => true;
    StoryManager.endConversation = () => {};

    const resumed = await StoryManager.executeEvent('light_palace_prison_leila', false, 0, 0, { token: 'evt-test', resume: true });
    assert(resumed === true, 'Leila event did not resume');
    assert(App.data.characters.some(character => Number(character.charId) === 204), 'Leila join action after consumed item was not reached');
    assert(App.data.progress.flags.leilaJoined === true, 'Leila join flag was not committed');
    assert(Number(App.data.items[5] || 0) === 0, 'World Tree Leaf was consumed twice');
    assert(!App.data.progress.eventJournal.active, 'completed Leila event journal was not cleared');

    // 旧形式セーブ（回復会話中）も分岐・消費済み位置へ移行できること。
    App.data.characters = [];
    App.data.items = {};
    App.data.progress = {
        flags: { lightPalaceCleared: true },
        activeEvent: { eventId: 'light_palace_prison_leila', actionIndex: 0, phase: 'actions' },
        activeConversation: { key: 'LIGHT_PALACE_LEILA_RECOVERY_JOIN', index: 0 }
    };
    const migrated = StoryManager.ensureEventJournal().active;
    assert(migrated.selectedBranches['0/then/1/then/0'] === 'yes', 'legacy Leila choice was not migrated');
    assert(migrated.completedActions['0/then/1/then/0/yes/0'] === true, 'legacy consumed leaf was not migrated');
    await StoryManager.executeEvent('light_palace_prison_leila', false, 0, 0, { token: migrated.token, resume: true });
    assert(App.data.characters.some(character => Number(character.charId) === 204), 'legacy Leila save did not recover to join');

    const first = StoryManager.queueEvent('noop', 'actions', { save: false });
    const second = StoryManager.queueEvent('noop', 'actions', { save: false });
    assert(first.token !== second.token && App.data.progress.eventJournal.queue.length === 2,
        'event queue still behaves as a single slot');
    const dedupeA = StoryManager.queueEvent('noop', 'actions', { save: false, dedupeKey: 'same-battle' });
    const dedupeB = StoryManager.queueEvent('noop', 'actions', { save: false, dedupeKey: 'same-battle' });
    assert(dedupeA.token === dedupeB.token, 'explicit battle-scoped event dedupe failed');

    StoryManager.events.transfer_failure = { actions: [{ type: 'START_FIXED_MAP', value: 'MISSING_MAP' }] };
    context.Field.enterFixedMap = () => false;
    const originalConsoleError = console.error;
    console.error = () => {};
    let transferResult;
    try {
        transferResult = await StoryManager.executeEvent('transfer_failure');
    } finally {
        console.error = originalConsoleError;
    }
    assert(transferResult === false, 'failed map transfer was treated as completed');
    assert(App.data.progress.eventJournal.active?.eventId === 'transfer_failure', 'failed map transfer deleted its source event');
    assert(App.data.progress.pendingMapTransfer?.status === 'error', 'failed map transfer was not journaled');
}

function validateSourceOrdering() {
    const battle = read('battle.js');
    const story = read('story_logic.js');
    const dungeon = read('dungeon.js');
    const main = read('main.js');
    const mapsLogic = read('maps_logic.js');

    const winStart = battle.indexOf('win: async () =>');
    const loseStart = battle.indexOf('lose: () =>');
    const win = battle.slice(winStart, loseStart);
    const lose = battle.slice(loseStart, battle.indexOf('endBattle:', loseStart));
    const ordered = (source, needles, label) => {
        let cursor = -1;
        for (const needle of needles) {
            const next = source.indexOf(needle, cursor + 1);
            assert(next > cursor, `${label}: order marker missing or reversed: ${needle}`);
            cursor = next;
        }
    };

    ordered(win, [
        'beginSaveTransaction',
        'App.gainExp',
        'Dungeon.onBossDefeated',
        'resultJournal =',
        'commitSaveTransaction',
        "playResultSeAndWait('battle_victory')"
    ], 'victory transaction');
    ordered(lose, [
        'beginSaveTransaction',
        'Dungeon.exit(true',
        'resultJournal =',
        'commitSaveTransaction',
        "playBgm?.('battle_wipeout'"
    ], 'loss transaction');

    assert(/id === 302101 \|\| baseId === 302101/.test(battle), 'Azelgarag form 2 is not in showcase-boss sizing');
    assert(battle.includes('getPhaseTransitionConfig') && battle.includes('recordDefeatedPhase') &&
        battle.includes('persistId: `${config.conversation}:') && battle.includes('restartInputAfterPhaseTransition'),
        'Generic monster phase transition is not persisted, recorded, and restarted through a fresh input phase');
    assert(battle.includes('cutsceneQueue') && battle.includes('awaitPendingBattleEvent'),
        'battle cutscene wait state is not persisted');
    assert(story.includes('effectStates') && story.includes('selectedBranches') && story.includes('completedActions'),
        'event journal lacks branch/effect/action state');
    assert(story.includes("status: 'queued'") && story.includes("status: 'running'") && story.includes('completeEventExecution'),
        'queued-running-completed event lifecycle is missing');
    assert(story.includes('pendingMapTransfer') && story.includes("status = 'error'"),
        'map transfer journal/error recovery is missing');
    assert(story.includes('failEventExecution') && story.includes("active.status = 'error'"),
        'event exception recovery state is missing');
    assert(story.includes('restartOnResume === true'), 'restartOnResume is still ignored');
    assert(story.includes("legacyRecovery = 'leila-consumed-leaf'") && story.includes("legacyRecovery = 'leila-restored-leaf'"),
        'legacy Leila hard-lock migration is missing');
    assert(mapsLogic.includes('applyStoryMapMutation(mutationKey, options = {})') && mapsLogic.includes('options.save !== false'),
        'MAP_CHANGE cannot defer its side-effect save to the event cursor commit');
    const bossActionStart = story.indexOf("if (action.type === 'BOSS')");
    assert(story.indexOf('const missingIds', bossActionStart) < story.indexOf('App.data.battle = {', bossActionStart),
        'BOSS action clears/creates state before monster ID validation');
    assert(dungeon.includes('activeFixedBossContext = fixedBossContext') &&
        story.includes('fixedBossContextNonce') && story.includes('battleChainId'),
        'fixed boss context is not bound to a battle chain');
    assert(main.indexOf('recoverCommittedBattleResult') < main.indexOf('Field.init();'),
        'committed battle result is not recovered before field initialization');
    assert(main.includes('resumePendingStoryEvent'), 'ordered event queue is not used by field resume');
}

(async () => {
    await validateNestedEventResume();
    validateSourceOrdering();
    console.log('Progression integrity validation passed.');
    console.log('Nested event resume, ordered queues, battle result commits, loss recovery, fixed-boss binding, and Azelgarag transition hooks are present.');
})().catch(error => {
    console.error(error);
    process.exit(1);
});
