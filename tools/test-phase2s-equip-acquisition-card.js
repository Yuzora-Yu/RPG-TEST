'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'equip_acquisition_card.js'), 'utf8');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const scheduled = [];
const context = {
    console,
    Date,
    Math,
    Set,
    Map,
    JSON,
    Number,
    String,
    Object,
    Array,
    setTimeout(fn) { scheduled.push(fn); return scheduled.length; },
    clearTimeout() {},
    setInterval() { return 1; },
    clearInterval() {},
    requestAnimationFrame(fn) { fn(); },
    matchMedia() { return { matches:false }; },
    document: {
        readyState: 'loading',
        addEventListener() {},
        body: null,
        head: { appendChild() {} },
        getElementById() { return null; },
        querySelectorAll() { return []; },
        createElement() { throw new Error('DOM should not be required by data-format tests'); }
    },
    CONST: { ELEMENTS:['火','水','風','雷','光','闇','混沌'] },
    DB: {
        OPT_RULES: [
            { key:'elmAtk', elm:'光', name:'光攻', unit:'%' },
            { key:'resists_Poison', name:'毒ガード', unit:'%' },
            { key:'atk', name:'攻撃', unit:'val' }
        ],
        SKILLS: [
            { id:168, name:'カラミティエンド' },
            { id:242, name:'カラミティウォール' }
        ]
    },
    PassiveSkill: {
        MASTER: {
            1:{ name:'剣の心得' },
            11:{ name:'会心の極意' },
            12:{ name:'光輝の祝福' }
        }
    },
    EQUIP_MASTER: [{
        eid:101, name:'試験の剣', type:'武器', baseName:'剣', rank:10,
        traits:[{ id:1, level:1 }]
    }],
    App: {
        data: {
            system: {}, inventory: [], characters: [], gold:100,
            stats:{ playTimeMs:0 }
        },
        checkSynergy() {
            return [{ name:'光の極意', desc:'光属性攻撃 +25%', color:'#fff' }];
        },
        save() { return true; },
        serializeSaveData(data) { return JSON.stringify(data); },
        restoreSaveDataSnapshot(snapshot) {
            const restored = JSON.parse(snapshot);
            Object.keys(this.data).forEach(key => delete this.data[key]);
            Object.assign(this.data, restored);
        },
        runAtomicSaveMutation(mutator) {
            const snapshot = JSON.stringify(this.data);
            const result = mutator();
            if (result && result.ok === false) {
                this.restoreSaveDataSnapshot(snapshot);
                return result;
            }
            return { ok:true, result };
        },
        updateHUD() {}
    }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename:'equip_acquisition_card.js' });
const Card = context.EquipAcquisitionCard;
assert(Card, 'manager was not exposed');

const plus2 = { id:'plus2', eid:101, name:'試験の剣+2', type:'武器', baseName:'剣', rank:10, plus:2 };
context.App.data.inventory.push(plus2);
assert.strictEqual(Card.enqueue(plus2), false, '+2 equipment must not be queued');

const shopPlus3 = { id:'shop-plus3', eid:101, name:'試験の剣+3', type:'武器', baseName:'剣', rank:10, plus:3 };
context.App.data.inventory.push(shopPlus3);
assert.strictEqual(Card.enqueue(shopPlus3, { source:'shop' }), false, 'shop equipment must not be queued');

const plus3 = {
    id:'plus3', name:'試験の剣+3', type:'武器', baseName:'剣', rank:10, plus:3, rarity:'UR',
    data:{
        atk:30, hit:8,
        elmAtk:{ 光:22 },
        elmRes:{ 闇:35 },
        resists_Poison:40,
        attack_Shock:18,
        grantSkills:[168,242]
    },
    opts:[
        { key:'elmAtk', elm:'光', val:22, rarity:'UR' },
        { key:'resists_Poison', val:40, rarity:'SSR' },
        { key:'atk', val:18, rarity:'SR', unit:'val' }
    ],
    traits:[
        { id:1, level:1 },
        { id:11, level:3 },
        { id:12, level:2 }
    ]
};
context.App.data.inventory.push(plus3);
assert.strictEqual(Card.enqueue(plus3, { source:'test', delayMs:0 }), true, '+3 equipment should be queued');
assert.strictEqual(plus3.eid, 101, 'formal eid should be resolved');
assert.strictEqual(plus3.masterEid, 101, 'formal masterEid should be resolved');
assert.strictEqual(context.App.data.system.equipAcquisitionCardsV1.pending.length, 1, 'pending queue missing');
assert.strictEqual(Card.enqueue(plus3), false, 'same UID must not be queued twice');

const baseStats = Card.getBaseStats(plus3);
assert(baseStats.includes('攻撃 +30'), 'basic attack was omitted');
assert(baseStats.includes('命中 +8%'), 'hit rate was omitted');
assert(baseStats.includes('光攻 +22%'), 'element attack correction was omitted');
assert(baseStats.includes('闇耐 +35%'), 'element resistance correction was omitted');
assert(baseStats.includes('毒耐 +40%'), 'status resistance correction was omitted');
assert(baseStats.includes('攻撃時18%で感電'), 'status infliction correction was omitted');
assert(baseStats.includes('[習得:カラミティエンド、カラミティウォール]'), 'granted skills were omitted');

assert.strictEqual(Card.getOptionText(plus3.opts[0]), '光攻 +22% [UR]', 'element option text mismatch');
assert.strictEqual(Card.getOptionText(plus3.opts[1]), '毒ガード +40% [SSR]', 'status option text mismatch');
assert.strictEqual(Card.getOptionText(plus3.opts[2]), '攻撃 +18 [SR]', 'val unit must not leak into display');

const rows = Card.buildRows(plus3);
assert.deepStrictEqual(Array.from(rows, row => row.kind), ['option','option','option','trait','trait','synergy'], 'reveal order must be options -> individual traits -> synergy');
assert(rows[3].html.includes('equip-acquisition-trait-name'), 'trait name span missing');
assert(rows[3].html.includes('equip-acquisition-trait-level'), 'trait level span missing');
assert(!rows[3].html.includes('特性：') && !rows[3].html.includes('特性:'), 'trait prefix must not be restored');
assert(rows[3].html.includes('会心の極意') && rows[3].html.includes('Lv3'), 'first additional trait mismatch');
assert(rows[4].html.includes('光輝の祝福') && rows[4].html.includes('Lv2'), 'second additional trait mismatch');


// Battle-event recovery remains guarded against event-loop re-entry.
let deadUpdated = 0;
context.Battle = {
    active:true,
    phase:'battle_event',
    turnExecutionActive:true,
    phaseTransitionRunnerActive:false,
    hasPendingPhaseTransition() { return false; },
    updateDeadState() { deadUpdated += 1; },
    checkFinish() { return false; },
    scheduleInputRecovery() {}
};
assert.strictEqual(Card.recoverBattleAfterEvent(), true, 'battle-event recovery should run');
assert.strictEqual(context.Battle.phase, 'execution', 'active turn must resume execution after event dialogue');
assert.strictEqual(deadUpdated, 1, 'dead state should be refreshed exactly once in direct recovery');
context.Battle.phase = 'battle_event';
context.Battle.phaseTransitionRunnerActive = true;
assert.strictEqual(Card.recoverBattleAfterEvent(), false, 'phase transition runner must block recovery interruption');

assert(source.includes('@keyframes equipAcquisitionOptionLine'), 'rarity-color line animation missing');
assert(source.includes('@keyframes equipAcquisitionOptionPop'), 'option pop/fade animation missing');
assert(source.includes('@keyframes equipAcquisitionTraitLevel'), 'trait level slam animation missing');
assert(source.includes('equipAcquisitionAuraDrift'), 'aurora synergy aura missing');
assert(source.includes('Manager.skipReveal(current)'), 'tap-to-skip flow missing');
assert(source.includes("Manager.startRevealSequence(Manager.active)"), 'reveal sequence does not start on show');
assert(source.includes('assets/equips/${eid}.png'), 'eid image path missing');
assert(source.includes('equip-acquisition-image-fallback'), 'image fallback missing');
assert(!source.includes('data-action="sell"'), 'sell button must not return');
assert(!source.includes('data-action="keep"'), 'keep button must not return');

const routes = {
    'battle.js': ['specialBoss', 'battleDrop'],
    'dungeon.js': ['rareChest', 'fieldChest', 'adventurer', 'abyssRift', 'memoryChest'],
    'facilities.js': ['coinMilestone', 'coinExchange', 'casinoExchange'],
    'guild.js': ['guildQuest']
};
for (const [file, markers] of Object.entries(routes)) {
    const text = read(file);
    for (const marker of markers) assert(text.includes(`source:'${marker}'`), `${file} missing ${marker} route`);
}
assert(!read('facilities.js').includes("source:'shop'"), 'shop route must remain excluded');
assert(source.includes("source:'achievement'"), 'achievement reward hook missing');
assert(read('index.html').includes('<script src="equip_acquisition_card.js"></script>'), 'index script registration missing');
assert(read('sw.js').includes('"equip_acquisition_card.js"'), 'service worker precache missing');

console.log('Phase2S +3 equipment acquisition card sequencing/display: PASS');
