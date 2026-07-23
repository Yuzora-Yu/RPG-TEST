const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'story_logic.js'), 'utf8');
const logs = [];
const context = {
    console,
    window: {},
    DB: { ITEMS: [{ id: 5, name: '世界樹の葉' }] },
    App: {
        data: { progress: { flags: {} }, items: {} },
        log: value => logs.push(value),
        save: () => true
    }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source}\nthis.__STORY_MANAGER = StoryManager;`, context, { filename: 'story_logic.js' });

(async () => {
    const manager = context.__STORY_MANAGER;
    await manager.processAction({
        type: 'IF_ITEM',
        id: 5,
        then: [{ type: 'LOG', value: 'owned' }],
        else: [{ type: 'LOG', value: 'missing' }]
    }, 'validation');
    if (logs.at(-1) !== 'missing') throw new Error('IF_ITEM did not select the missing-item branch');

    context.App.data.items[5] = 2;
    await manager.processAction({
        type: 'IF_ITEM',
        id: 5,
        count: 2,
        then: [{ type: 'LOG', value: 'owned' }],
        else: [{ type: 'LOG', value: 'missing' }]
    }, 'validation');
    if (logs.at(-1) !== 'owned') throw new Error('IF_ITEM did not select the owned-item branch');

    await manager.processAction({ type: 'CONSUME_ITEM', id: 5, count: 1 }, 'validation');
    if (context.App.data.items[5] !== 1) throw new Error('CONSUME_ITEM did not decrement inventory');
    await manager.processAction({ type: 'CONSUME_ITEM', id: 5, count: 1 }, 'validation');
    if (Object.prototype.hasOwnProperty.call(context.App.data.items, 5)) throw new Error('CONSUME_ITEM left a zero-count inventory entry');
    if (!logs.some(value => value === '世界樹の葉を渡した。')) throw new Error('CONSUME_ITEM did not produce the transfer log');

    console.log('Story item-condition validation passed: missing/owned branches and item consumption are deterministic.');
})().catch(error => {
    console.error(error.stack || error);
    process.exit(1);
});
