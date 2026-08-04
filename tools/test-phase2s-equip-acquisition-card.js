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
    document: {
        readyState: 'loading',
        addEventListener() {},
        body: null,
        head: { appendChild() {} },
        getElementById() { return null; },
        querySelectorAll() { return []; },
        createElement() { throw new Error('DOM should not be required by enqueue test'); }
    },
    EQUIP_MASTER: [{ eid:101, name:'試験の剣', type:'武器', baseName:'剣', rank:10, traits:[] }],
    App: {
        data: {
            system: {}, inventory: [], characters: [], gold:100,
            stats:{ playTimeMs:0 }
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

const plus2 = { id:'plus2', eid:101, name:'試験の剣+2', type:'武器', baseName:'剣', rank:10, plus:2, val:200 };
context.App.data.inventory.push(plus2);
assert.strictEqual(Card.enqueue(plus2), false, '+2 equipment must not be queued');

const plus3 = { id:'plus3', name:'試験の剣+3', type:'武器', baseName:'剣', rank:10, plus:3, val:200, data:{atk:30}, opts:[], traits:[] };
context.App.data.inventory.push(plus3);
assert.strictEqual(Card.enqueue(plus3, { source:'test', delayMs:0 }), true, '+3 equipment should be queued');
assert.strictEqual(plus3.eid, 101, 'formal eid should be resolved');
assert.strictEqual(plus3.masterEid, 101, 'formal masterEid should be resolved');
assert.strictEqual(context.App.data.system.equipAcquisitionCardsV1.pending.length, 1, 'pending queue missing');
assert.strictEqual(Card.enqueue(plus3), false, 'same UID must not be queued twice');

Card.active = {
    entry: context.App.data.system.equipAcquisitionCardsV1.pending[0],
    equip: plus3,
    overlay: { remove() {} },
    revealedAll:true
};
Card.sellActive();
assert.strictEqual(context.App.data.inventory.some(eq => eq.id === 'plus3'), false, 'sold equipment remained in inventory');
assert.strictEqual(context.App.data.gold, 200, 'sell gold was not added');
assert.strictEqual(context.App.data.system.equipAcquisitionCardsV1.pending.length, 0, 'sold queue entry remained');
assert.strictEqual(context.App.data.system.equipAcquisitionCardsV1.handled.plus3.status, 'sold', 'handled status missing');

const routes = {
    'battle.js': ['specialBoss', 'battleDrop'],
    'dungeon.js': ['rareChest', 'fieldChest', 'adventurer', 'abyssRift', 'memoryChest'],
    'facilities.js': ['coinMilestone', 'coinExchange', 'shop', 'casinoExchange'],
    'guild.js': ['guildQuest']
};
for (const [file, markers] of Object.entries(routes)) {
    const text = read(file);
    for (const marker of markers) assert(text.includes(`source:'${marker}'`), `${file} missing ${marker} route`);
}
assert(source.includes("source:'achievement'"), 'achievement reward hook missing');
assert(read('index.html').includes('<script src="equip_acquisition_card.js"></script>'), 'index script registration missing');
assert(read('sw.js').includes('"equip_acquisition_card.js"'), 'service worker precache missing');
assert(read('main.js').includes('masterEid: Number(base.eid)'), 'generated equipment master identity missing');
assert(source.includes('assets/equips/${eid}.png'), 'eid image path missing');
assert(source.includes('equip-acquisition-image-fallback'), 'image fallback missing');
assert(source.includes('画面タップで演出をスキップ'), 'tap skip guidance missing');
assert(source.includes("data-action=\"sell\""), 'sell action missing');

console.log('Phase2S +3 equipment acquisition card: PASS');
