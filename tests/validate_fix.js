'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const cardSource = fs.readFileSync(path.join(root, 'equip_acquisition_card.js'), 'utf8');
const newsSource = fs.readFileSync(path.join(root, 'news.js'), 'utf8');

function makeContext(Battle) {
    const context = {
        console,
        Promise,
        Set,
        Map,
        WeakSet,
        Date,
        Math,
        JSON,
        Number,
        String,
        Object,
        Array,
        Boolean,
        RegExp,
        Error,
        setTimeout,
        clearTimeout,
        queueMicrotask,
        // init()内の常駐監視はテストでは起動させない。
        setInterval: () => 0,
        clearInterval: () => {},
        document: {
            readyState: 'loading',
            addEventListener: () => {},
            getElementById: () => null,
            querySelectorAll: () => [],
            body: null,
            head: null
        },
        App: {
            data: {
                inventory: [],
                characters: [],
                system: {},
                battle: { active: true }
            },
            save: () => true,
            updateHUD: () => {},
            checkSynergy: () => []
        },
        AchievementManager: undefined,
        Battle
    };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(cardSource, context, { filename: 'equip_acquisition_card.js' });
    return context;
}

async function testBattleDropFlow() {
    const timeline = [];
    let popupResolve;
    let resultTapAdvances = 0;
    const equip = {
        id: 'equip-test-1',
        eid: 1001,
        name: '天罰の巨斧+3',
        baseName: '斧',
        type: '武器',
        plus: 3,
        rank: 100,
        rarity: 'UR',
        data: { atk: 78, spd: -14, hit: -10 },
        opts: [{ key:'damage', label:'与ダメ', val:14, unit:'%', rarity:'UR' }],
        traits: [{ id:1, level:1 }]
    };
    const Battle = {
        active: true,
        phase: 'execution',
        resultProcessing: false,
        resultInputLocked: false,
        resultReadyToEnd: false,
        resultAdvanceResolver: null,
        win: async function() {
            this.phase = 'result';
            this.active = false; // 現行battle.jsと同じ
            this.resultProcessing = true;
            this.resultInputLocked = false;
            context.App.data.inventory.push(equip);
            context.EquipAcquisitionCard.enqueue(equip, { source:'battleDrop' });
            this.log(`なんと <span>${equip.name}</span> を手に入れた！`);
            await this.resultWait(150);
            timeline.push('log-resumed');
            this.resultProcessing = false;
            this.resultReadyToEnd = true;
            return true;
        },
        log: function(message) {
            timeline.push(`log:${String(message).replace(/<[^>]+>/g, '')}`);
        },
        resultWait: function(ms) {
            timeline.push(`wait:${ms}`);
            return Promise.resolve();
        },
        handleResultTap: function() {
            if (this.phase !== 'result' || this.resultInputLocked) return;
            resultTapAdvances += 1;
        },
        hasPendingPhaseTransition: () => false,
        queueBattleConversation: () => Promise.resolve(false),
        awaitPendingBattleEvent: async () => false
    };
    const context = makeContext(Battle);
    const manager = context.EquipAcquisitionCard;
    manager.installBattleHooks();
    manager.showAndWait = async function(receivedEquip, options) {
        assert.strictEqual(receivedEquip.id, equip.id);
        assert.strictEqual(options.battleResult, true);
        assert.strictEqual(Battle.phase, 'result');
        assert.strictEqual(Battle.active, false, '勝利リザルトはactive=falseでも表示対象');
        assert.strictEqual(Battle.resultInputLocked, true, 'カード表示前から結果入力がロックされる');
        timeline.push('popup-open');
        await new Promise(resolve => { popupResolve = resolve; });
        timeline.push('popup-close');
        return true;
    };

    const winPromise = Battle.win();
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.deepStrictEqual(timeline.slice(0, 3), [
        `log:なんと ${equip.name} を手に入れた！`,
        'wait:150',
        'popup-open'
    ]);
    assert.strictEqual(Battle.resultInputLocked, true);
    assert.strictEqual(timeline.includes('log-resumed'), false, 'ポップアップ中はログを再開しない');

    Battle.handleResultTap();
    assert.strictEqual(resultTapAdvances, 0, 'ポップアップ中のタップは結果送りに使われない');

    popupResolve();
    await winPromise;
    assert.deepStrictEqual(timeline.slice(-2), ['popup-close', 'log-resumed']);
    assert.strictEqual(Battle.resultInputLocked, false, '閉じた後に入力ロックを元へ戻す');
    assert.strictEqual(manager.battleReadyCards.length, 0);
    assert.strictEqual(manager.battleCandidates.length, 0);
}

async function testMultipleBattleDropCards() {
    const shown = [];
    const equips = [
        { id:'equip-multi-1', eid:2001, name:'炎斧+3', baseName:'斧', type:'武器', plus:3, rank:10, data:{ atk:10 } },
        { id:'equip-multi-2', eid:2002, name:'氷鎧+3', baseName:'鎧', type:'防具', plus:3, rank:10, data:{ def:10 } },
        { id:'equip-multi-3', eid:2003, name:'風剣+2', baseName:'剣', type:'武器', plus:2, rank:10, data:{ atk:8 } }
    ];
    const Battle = {
        active: true,
        phase: 'execution',
        resultProcessing: false,
        resultInputLocked: false,
        win: async function() {
            this.phase = 'result';
            this.active = false;
            this.resultProcessing = true;
            for (const equip of equips) {
                context.App.data.inventory.push(equip);
                context.EquipAcquisitionCard.enqueue(equip, { source:'battleDrop' });
                this.log(`${equip.name} を手に入れた！`);
                await this.resultWait(150);
            }
            this.resultProcessing = false;
        },
        log: () => {},
        resultWait: () => Promise.resolve(),
        hasPendingPhaseTransition: () => false,
        queueBattleConversation: () => Promise.resolve(false),
        awaitPendingBattleEvent: async () => false
    };
    const context = makeContext(Battle);
    const manager = context.EquipAcquisitionCard;
    manager.installBattleHooks();
    manager.showAndWait = async equip => { shown.push(equip.name); return true; };

    await Battle.win();
    assert.deepStrictEqual(shown, ['炎斧+3', '氷鎧+3'], '+3装備だけをドロップログ順に1枚ずつ表示');
}

async function testBattleEventFinishRecovery() {
    let resolveConversation;
    let updateDeadStateCount = 0;
    let checkFinishCount = 0;
    let inputRecoveryCount = 0;
    const Battle = {
        active: true,
        phase: 'execution',
        turnExecutionActive: false,
        phaseTransitionRunnerActive: false,
        pendingBattleEvent: null,
        resultInputLocked: false,
        win: async () => true,
        log: () => {},
        resultWait: () => Promise.resolve(),
        hasPendingPhaseTransition: () => false,
        updateDeadState: () => { updateDeadStateCount += 1; },
        checkFinish: () => { checkFinishCount += 1; return true; },
        scheduleInputRecovery: () => { inputRecoveryCount += 1; return true; },
        queueBattleConversation: function() {
            this.phase = 'battle_event';
            this.pendingBattleEvent = new Promise(resolve => { resolveConversation = resolve; });
            return this.pendingBattleEvent;
        },
        awaitPendingBattleEvent: async function() {
            if (!this.pendingBattleEvent) return false;
            const result = await this.pendingBattleEvent;
            this.pendingBattleEvent = null;
            return result;
        }
    };
    const context = makeContext(Battle);
    context.EquipAcquisitionCard.installBattleHooks();

    Battle.queueBattleConversation('event-test', { resumePhase:'input' });
    const waitPromise = Battle.awaitPendingBattleEvent();
    resolveConversation(true);
    assert.strictEqual(await waitPromise, true);
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.strictEqual(updateDeadStateCount, 1, '会話後に死亡状態を再評価');
    assert.strictEqual(checkFinishCount, 1, '会話後に勝敗判定を再実行');
    assert.strictEqual(inputRecoveryCount, 0, '勝敗が確定した場合は入力復帰しない');
}

async function testBattleEventTurnContinuation() {
    let resolveConversation;
    let checkFinishCount = 0;
    const Battle = {
        active: true,
        phase: 'execution',
        turnExecutionActive: true,
        phaseTransitionRunnerActive: false,
        pendingBattleEvent: null,
        resultInputLocked: false,
        win: async () => true,
        log: () => {},
        resultWait: () => Promise.resolve(),
        hasPendingPhaseTransition: () => false,
        updateDeadState: () => {},
        checkFinish: () => { checkFinishCount += 1; return false; },
        scheduleInputRecovery: () => { throw new Error('実行中ターンでは入力復帰へ飛ばさない'); },
        queueBattleConversation: function() {
            this.phase = 'battle_event';
            this.pendingBattleEvent = new Promise(resolve => { resolveConversation = resolve; });
            return this.pendingBattleEvent;
        },
        awaitPendingBattleEvent: async function() {
            const result = await this.pendingBattleEvent;
            this.pendingBattleEvent = null;
            return result;
        }
    };
    const context = makeContext(Battle);
    context.EquipAcquisitionCard.installBattleHooks();

    Battle.queueBattleConversation('event-test', { resumePhase:'execution' });
    const waitPromise = Battle.awaitPendingBattleEvent();
    resolveConversation(false);
    assert.strictEqual(await waitPromise, false);

    assert.ok(checkFinishCount >= 1, '会話結果がfalseでも勝敗判定を再実行');
    assert.strictEqual(Battle.phase, 'execution', '実行中ターンはbattle_eventから同期復帰');
}

async function testBattleEventInputRecovery() {
    let resolveConversation;
    let checkFinishCount = 0;
    let inputRecoveryCount = 0;
    const Battle = {
        active: true,
        phase: 'execution',
        turnExecutionActive: false,
        phaseTransitionRunnerActive: false,
        pendingBattleEvent: null,
        resultInputLocked: false,
        win: async () => true,
        log: () => {},
        resultWait: () => Promise.resolve(),
        hasPendingPhaseTransition: () => false,
        updateDeadState: () => {},
        checkFinish: () => { checkFinishCount += 1; return false; },
        scheduleInputRecovery: () => { inputRecoveryCount += 1; Battle.phase = 'input'; return true; },
        queueBattleConversation: function() {
            this.phase = 'battle_event';
            this.pendingBattleEvent = new Promise(resolve => { resolveConversation = resolve; });
            return this.pendingBattleEvent;
        },
        awaitPendingBattleEvent: async function() {
            const result = await this.pendingBattleEvent;
            this.pendingBattleEvent = null;
            return result;
        }
    };
    const context = makeContext(Battle);
    context.EquipAcquisitionCard.installBattleHooks();

    Battle.queueBattleConversation('event-test', { resumePhase:'input' });
    const waitPromise = Battle.awaitPendingBattleEvent();
    resolveConversation(true);
    await waitPromise;
    await new Promise(resolve => setTimeout(resolve, 15));

    assert.ok(checkFinishCount >= 1);
    assert.strictEqual(inputRecoveryCount, 1, '未決着なら入力フェーズを復旧');
    assert.strictEqual(Battle.phase, 'input');
}

function testStaticRequirements() {
    assert.strictEqual(/<button\b/i.test(cardSource), false, '取得カードのボタンを削除');
    assert.strictEqual(/data-action=(?:"|')?(?:keep|sell)/i.test(cardSource), false, '保管・売却アクションを削除');
    assert.ok(cardSource.includes('画面タップで閉じる'));
    assert.ok(cardSource.includes("stopImmediatePropagation"), '入力をcaptureで消費する');
    assert.ok(cardSource.includes('INPUT_RELEASE_DELAY_MS'), '閉じタップ由来の合成clickを吸収する猶予を持つ');

    const summaryBlock = cardSource.match(/<div class="equip-acquisition-summary">([\s\S]*?)<div class="equip-acquisition-tap-hint">/);
    assert.ok(summaryBlock, 'summary内の表示構造を取得できる');
    assert.ok(summaryBlock[1].includes('equip-acquisition-name-line'));
    assert.ok(summaryBlock[1].includes('equip-acquisition-base-stats'));
    assert.ok(summaryBlock[1].includes('equip-acquisition-reveal-list'));
    assert.ok(summaryBlock[1].includes('equip-acquisition-base-traits'));

    assert.strictEqual((newsSource.match(/date:\s*"2026\/08\/04"/g) || []).length, 1, '同日NEWSは1件へ統合');
    assert.ok(newsSource.includes('+3装備の取得カード'));
    assert.ok(newsSource.includes('戦闘イベント後に勝敗判定が止まり'));
}

(async () => {
    testStaticRequirements();
    await testBattleDropFlow();
    await testMultipleBattleDropCards();
    await testBattleEventFinishRecovery();
    await testBattleEventTurnContinuation();
    await testBattleEventInputRecovery();
    console.log('PASS: +3装備カード / 戦闘結果入力ロック / イベント戦闘復旧');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
