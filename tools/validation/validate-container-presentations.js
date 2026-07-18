const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'dungeon.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const context = { console, window: {} };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source}\nglobalThis.__Dungeon = Dungeon;`, context, { filename: 'dungeon.js' });

const { getContainerPresentation } = context.__Dungeon;
const pot = getContainerPresentation({ containerKind: 'pot', imageKey: 'overlay_field_pot' });
const barrel = getContainerPresentation({ containerKind: 'barrel', imageKey: 'overlay_field_barrel' });
const inferredPot = getContainerPresentation({ imageKey: 'overlay_field_pot' });
const chest = getContainerPresentation({});

assert(pot.inspect === 'ツボを覗いた。' && pot.empty === 'ツボの中は空だった。', 'Pot interaction text is not object-specific');
assert(pot.action === 'ツボを覗く' && pot.opened === '空のツボだ。', 'Pot action/opened text is not object-specific');
assert(inferredPot.kind === 'pot', 'Legacy pot image must infer pot behavior');
assert(barrel.inspect === 'タルの中を調べた。' && barrel.empty === 'タルの中は空だった。', 'Barrel interaction text is not ready');
assert(barrel.action === 'タルを調べる' && barrel.blocked === 'タルが置かれている。', 'Barrel action/blocking text is not ready');
assert(chest.kind === 'chest' && chest.inspect === '宝箱を開けた！', 'Default chest behavior regressed');
assert(mainSource.includes('const isContainerOverlay =') && mainSource.includes('suppressShadow: true'),
    'Chest, pot, and barrel overlays still receive the generic actor foot shadow');

console.log('Container presentation validation passed: chest, pot and barrel text paths are distinct.');
