const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const iconKeys = ['vehicle', 'travel', 'heal', 'revive', 'growth', 'key'];
for (const key of iconKeys) {
    const relative = `assets/ui/menu-icons/item-${key}-v001.png`;
    const file = path.join(root, relative);
    assert(fs.existsSync(file), `Missing item category icon: ${relative}`);
    const png = fs.readFileSync(file);
    assert(png.subarray(1, 4).toString('ascii') === 'PNG', `${relative} is not PNG`);
    assert(png.readUInt32BE(16) === 64 && png.readUInt32BE(20) === 64, `${relative} must be 64x64`);
    assert(png[25] === 6, `${relative} must be RGBA`);
}

const context = vm.createContext({ window: {}, console });
vm.runInContext(read('items.js'), context, { filename: 'items.js' });
const catalog = context.window.PRISMA_ITEM_CATALOG;
assert(catalog, 'PRISMA_ITEM_CATALOG is missing');
assert(JSON.stringify(Array.from(catalog.toolTypeOrder)) === JSON.stringify([
    '乗り物', '移動', 'HP回復', 'MP回復', '状態異常回復', '蘇生', '育成', '攻撃道具', '強化道具', '弱体道具'
]), 'Tool type order differs from the requested order');
const fixtures = catalog.toolTypeOrder.map((type, index) => ({ id: 100 - index, type }));
fixtures.reverse().sort(catalog.compareToolsByTypeAndId);
assert(fixtures.every((item, index) => item.type === catalog.toolTypeOrder[index]), 'Tool comparator does not preserve category order');

const menuItems = read('menus_items.js');
const menus = read('menus.js');
const battle = read('battle.js');
const fieldSkills = read('menus_skills.js');
const iconBuilder = read('tools/assets/build-item-menu-category-icons.py');
assert(menuItems.includes('compareToolsByTypeAndId(a.def, b.def)'), 'Field item menu does not use the shared comparator');
assert(battle.includes('compareToolsByTypeAndId(a.def, b.def)'), 'Battle item menu does not use the shared comparator');
for (const key of iconKeys) {
    assert(menus.includes(`item-${key}-v001.png`), `Menu icon mapping is missing ${key}`);
}
assert(fieldSkills.includes('PRISMA_SKILL_ORDER?.compareById'), 'Field skill menu is not sorted by ID');
assert(battle.includes('PRISMA_SKILL_ORDER?.compareById'), 'Battle skill menu is not sorted by ID');
assert(iconBuilder.includes('keep_largest_alpha_component'), 'Icon normalization does not remove isolated matte fragments');
assert(iconBuilder.includes('(64 - size[0]) // 2') && iconBuilder.includes('(64 - size[1]) // 2'), 'Icon normalization does not center the visible object');

console.log('Item category icons, item type ordering, and skill ID ordering validated.');
