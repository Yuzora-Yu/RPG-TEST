const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const context = { window: {}, console };
context.Math = Object.create(Math);
context.Math.random = () => 0.5;
vm.createContext(context);
for (const file of ['items.js', 'monsters.js', 'chest-mimics.js', 'monster-drop-policy.js', 'item_runtime.js']) {
    vm.runInContext(read(file), context, { filename: file });
}

const items = context.window.ITEMS_DATA;
const monsters = context.window.MONSTERS_DATA;
const catalog = context.window.PRISMA_ITEM_CATALOG;
const runtime = context.window.ItemRuntime;
const dropPolicy = context.window.PRISMA_MONSTER_DROP_POLICY;
const byId = id => items.find(item => Number(item.id) === Number(id));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const expanded = items.filter(item => item.id >= 1000 && item.id < 2000);
const materials = items.filter(item => item.id >= 2000 && item.id < 2100);
assert(expanded.length === 64, `expected 64 expanded consumables, got ${expanded.length}`);
assert(materials.length === 64, `expected 64 materials, got ${materials.length}`);
assert(new Set(items.map(item => item.id)).size === items.length, 'item IDs are not unique');

const damage = expanded.filter(item => item.effectKind === 'damage');
assert(damage.length === 35, `expected 35 elemental damage items, got ${damage.length}`);
for (const element of ['火', '水', '雷', '風', '光', '闇', '混沌']) {
    const set = damage.filter(item => item.element === element);
    assert(set.length === 5, `${element} damage item set is incomplete`);
    assert(new Set(set.map(item => item.target)).size === 3, `${element} target forms are incomplete`);
}
assert(expanded.filter(item => item.type === '強化道具').length === 12, 'buff item count mismatch');
assert(expanded.filter(item => item.type === '弱体道具').length === 10, 'debuff item count mismatch');
assert(expanded.filter(item => item.fieldGroup).length === 7, 'field party recovery/camp item count mismatch');
assert(materials.every(item => item.icon === 'assets/ui/menu-icons/item-material.png'), 'materials do not share the material icon');

const categoryPairs = new Set(materials.map(item => `${item.materialType}:${item.materialRank}`));
assert(categoryPairs.size === 64, 'material category/rank matrix is incomplete');
for (const rank of ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G']) {
    assert(materials.filter(item => item.materialRank === rank).length === 8, `material Rank ${rank} is incomplete`);
}

const battleLog = [];
const enemyA = { name: 'A', hp: 1200, baseMaxHp: 1200, mp: 0, baseMaxMp: 0, elmRes: {}, battleStatus: { buffs: {}, debuffs: {}, ailments: {} } };
const enemyB = { name: 'B', hp: 1200, baseMaxHp: 1200, mp: 0, baseMaxMp: 0, elmRes: {}, battleStatus: { buffs: {}, debuffs: {}, ailments: {} } };
const ally = { name: 'Hero', hp: 500, baseMaxHp: 500, mp: 80, baseMaxMp: 80, cri: 10, eva: 10, battleStatus: { buffs: {}, debuffs: {}, ailments: {} } };
const Battle = {
    enemies: [enemyA, enemyB], party: [ally], statNames: { atk: '攻撃力', cri: '会心率' },
    isBattleAlive: target => !!target && !target.isDead && target.hp > 0,
    getBattleStat: (target, key) => key === 'maxHp' ? target.baseMaxHp : (key === 'maxMp' ? target.baseMaxMp : target[key]),
    log: line => battleLog.push(line),
    markDefeated: target => { target.isDead = true; },
    tryGutsSurvive: () => false
};
const App = { data: { items: {} } };
const use = (id, target) => {
    const item = byId(id);
    App.data.items[id] = 1;
    return runtime.applyBattleItem({ Battle, App, item, command: { actor: ally, target } });
};
assert(use(1000, enemyA).effected === 1 && enemyA.hp < 1200, 'single damage item runtime failed');
assert(use(1002, 'all_enemy').effected === 2 && enemyB.hp < 1200, 'all-enemy damage item runtime failed');
assert(use(1050, ally).effected === 1 && ally.battleStatus.buffs.atk.val === 1.5 && ally.battleStatus.buffs.atk.turns === 4, 'single buff runtime failed');
assert(use(1061, ally).effected === 1 && ally.battleStatus.buffs.cri.val === 1.3 && ally.battleStatus.buffs.cri.turns === 2, 'critical-rate buff runtime failed');
assert(use(1070, enemyA).effected === 1 && enemyA.battleStatus.debuffs.atk.val === 0.5 && enemyA.battleStatus.debuffs.atk.turns === 4, 'single debuff runtime failed');
assert(!App.data.items[1070], 'battle item was not consumed');

const fieldParty = [
    { currentHp: 20, currentMp: 0, maxHp: 100, maxMp: 50 },
    { currentHp: 0, currentMp: 0, maxHp: 200, maxMp: 80 }
];
const FieldApp = { calcStats: target => ({ maxHp: target.maxHp, maxMp: target.maxMp }) };
let fieldResult = runtime.applyFieldGroupItem({ App: FieldApp, item: byId(1040), party: fieldParty });
assert(fieldResult.success && fieldParty[0].currentMp === 30 && fieldParty[1].currentMp === 0, 'party MP recovery field runtime failed');
fieldResult = runtime.applyFieldGroupItem({ App: FieldApp, item: byId(1060), party: fieldParty });
assert(fieldResult.success && fieldParty.every(member => member.currentHp === member.maxHp && member.currentMp === member.maxMp), 'camp revive/full recovery runtime failed');

const materialPick = catalog.pickAbyssChestItem(200, (() => { const values = [0.1, 0.2]; return () => values.shift() ?? 0; })());
const usablePick = catalog.pickAbyssChestItem(200, (() => { const values = [0.9, 0.2]; return () => values.shift() ?? 0; })());
assert(materialPick?.type === '素材', 'Abyss chest material branch failed');
assert(usablePick && usablePick.type !== '素材' && !usablePick.medalOnly, 'Abyss chest usable-item branch failed');

const itemIds = new Set(items.map(item => Number(item.id)));
const rareTrash = monsters.filter(monster => monster.isRare && !monster.isBoss && !monster.isSpecialBoss && !monster.isEstark);
const normalTrash = monsters.filter(monster => !monster.isChestTrap && !monster.isRare && !monster.isBoss && !monster.isSpecialBoss && !monster.isEstark);
assert(rareTrash.length === 4 && rareTrash.every(monster => monster.drops?.normal?.id === 99), 'rare monsters do not always drop small medals');
assert(normalTrash.length === 196, `normal trash drop coverage mismatch: ${normalTrash.length}`);
assert(normalTrash.every(monster => Number(monster.drops?.normal?.rate) >= 12 && Number(monster.drops?.normal?.rate) <= 15), 'normal trash normal-drop rates must be 12-15%');
assert(normalTrash.every(monster => Number(monster.drops?.rare?.rate) >= 2 && Number(monster.drops?.rare?.rate) <= 5), 'normal trash rare-drop rates must be 2-5%');
for (const monster of [...rareTrash, ...normalTrash]) {
    assert(itemIds.has(Number(monster.drops?.normal?.id)), `${monster.name} normal drop does not resolve`);
    assert(itemIds.has(Number(monster.drops?.rare?.id)), `${monster.name} rare drop does not resolve`);
}

const dropType = id => byId(id)?.type;
const normalMaterialCount = normalTrash.filter(monster => dropType(monster.drops.normal.id) === '素材').length;
assert(normalMaterialCount >= 88 && normalMaterialCount <= 102, `normal material drops are not about half: ${normalMaterialCount}/196`);
const earlyTrash = normalTrash.filter(monster => Number(monster.rank || monster.minF || 1) <= 25);
const earlyMaterialCount = earlyTrash.filter(monster => dropType(monster.drops.normal.id) === '素材').length;
assert(earlyMaterialCount / earlyTrash.length <= 0.4, `early material drop share is too high: ${earlyMaterialCount}/${earlyTrash.length}`);
assert(earlyTrash.every(monster => {
    const type = dropType(monster.drops.normal.id);
    return type === '素材' || type === 'HP回復' || type === 'MP回復';
}), 'early normal drops must favor herbs/MP recovery instead of utility cures');

const elites = normalTrash.filter(monster => Number(monster.actCount || 1) >= 2);
assert(elites.length === 20 && dropPolicy.eliteCount === 20, `two-action elite coverage mismatch: ${elites.length}`);
assert(elites.every(monster => monster.drops.rare.id >= 100 && monster.drops.rare.id <= 106), 'elite rare drops must be growth items 100-106');
assert(elites.every(monster => monster.drops.rare.id !== 107), 'reincarnation item 107 must never be an elite rare drop');

for (const monster of normalTrash.filter(monster => Number(monster.actCount || 1) < 2)) {
    const normalIsMaterial = dropType(monster.drops.normal.id) === '素材';
    const rareIsMaterial = dropType(monster.drops.rare.id) === '素材';
    assert(normalIsMaterial !== rareIsMaterial, `${monster.name} normal/rare slots are not complementary`);
}
for (const type of ['攻撃道具', '強化道具', '弱体道具']) {
    const assigned = normalTrash.filter(monster =>
        dropType(monster.drops.normal.id) === type || dropType(monster.drops.rare.id) === type
    ).length;
    assert(assigned >= 10, `${type} is assigned to too few normal monsters: ${assigned}`);
}

const iconPaths = ['attack', 'buff', 'debuff', 'material'].map(key => `assets/ui/menu-icons/item-${key}.png`);
for (const relative of iconPaths) {
    const data = fs.readFileSync(path.join(root, relative));
    assert(data.toString('ascii', 1, 4) === 'PNG', `${relative} is not PNG`);
    assert(data.readUInt32BE(16) === 64 && data.readUInt32BE(20) === 64, `${relative} is not 64x64`);
    assert([4, 6].includes(data[25]), `${relative} has no alpha channel`);
    assert(read('assets.js').includes(relative), `${relative} is not registered for full caching`);
}

const index = read('index.html');
assert(!index.includes('item-expansion.js'), 'retired item-expansion.js must not be loaded');
for (const script of ['chest-mimics.js', 'monster-drop-policy.js', 'item_runtime.js']) {
    assert(index.includes(`<script src="${script}"></script>`), `${script} is not loaded by index.html`);
    assert(read('sw.js').includes(`"${script}"`), `${script} is not precached`);
}
const facilities = read('facilities.js');
assert(facilities.includes("const excludedEffectKinds = new Set(['damage', 'buff', 'debuff'])"), 'Ordinary shops do not exclude attack/buff/debuff consumables');
assert(facilities.includes("!excludedEffectKinds.has(String(item.effectKind || '').toLowerCase())"), 'Item-shop filtering is not connected to the combat-item exclusion policy');
const shopContext = { console, DB: { ITEMS: items }, App: { data: {} } };
shopContext.window = shopContext;
shopContext.globalThis = shopContext;
vm.createContext(shopContext);
vm.runInContext(`${facilities}\nglobalThis.__Facilities = Facilities;`, shopContext, { filename: 'facilities.js' });
const highRankShop = shopContext.__Facilities.getItemShopLineup(999);
assert(!highRankShop.some(item => ['damage', 'buff', 'debuff'].includes(item.effectKind)), 'Ordinary item shop still sells attack/buff/debuff consumables');
for (const type of ['攻撃道具', '強化道具', '弱体道具', 'キャンプ']) assert(facilities.includes(`'${type}'`), `${type} is absent from item shops`);
const medalSource = read('database.js');
for (const id of [1004, 1009, 1014, 1019, 1024, 1029, 1034, 1043, 1061, 1062]) assert(medalSource.includes(`id: ${id}`), `medal reward ${id} is missing`);

console.log(`Item expansion validation passed: 64 consumables, 64 materials, ${normalMaterialCount}/196 normal material drops, ${earlyMaterialCount}/${earlyTrash.length} early material drops, ${elites.length} elite growth drops, and all combat-item categories are connected.`);
