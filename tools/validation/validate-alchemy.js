'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const context = {
    console,
    document: { getElementById: () => null },
    Menu: { confirm: (_text, yes) => yes(), msg: () => {} },
    Facilities: { setupBaseLayout: () => {}, escapeAttr: value => String(value) }
};
context.window = context;
context.App = {
    data: { items: {} },
    saveCalls: 0,
    save() { this.saveCalls += 1; },
    changeScene() {}
};
vm.createContext(context);
vm.runInContext(read('items.js'), context, { filename: 'items.js' });
context.DB = { ITEMS: context.ITEMS_DATA };
vm.runInContext(read('alchemy.js'), context, { filename: 'alchemy.js' });
vm.runInContext(`${read('map.js')}\nglobalThis.__FIXED_MAPS = FIXED_MAPS;`, context, { filename: 'map.js' });

const items = context.ITEMS_DATA;
const itemById = new Map(items.map(item => [Number(item.id), item]));
const recipes = context.ALCHEMY_RECIPES;
assert(Array.isArray(recipes) && recipes.length >= 20, '錬金レシピが十分に登録されていません');

const outputCategories = new Set();
for (const recipe of recipes) {
    const output = itemById.get(Number(recipe.outputItemId));
    assert(output, `${recipe.id}: 出力アイテム ${recipe.outputItemId} が存在しません`);
    assert(!output.materialType, `${recipe.id}: 素材そのものを出力しています`);
    assert(Array.isArray(recipe.variants) && recipe.variants.length >= 2, `${recipe.id}: 代替素材構成が2種類未満です`);
    outputCategories.add(recipe.category);
    const variantIds = new Set();
    for (const variant of recipe.variants) {
        assert(!variantIds.has(variant.id), `${recipe.id}: 構成ID ${variant.id} が重複しています`);
        variantIds.add(variant.id);
        assert(Array.isArray(variant.ingredients) && variant.ingredients.length >= 2 && variant.ingredients.length <= 5,
            `${recipe.id}/${variant.id}: 素材種類数が2～5ではありません`);
        const ingredientIds = new Set();
        for (const part of variant.ingredients) {
            assert(!ingredientIds.has(Number(part.itemId)), `${recipe.id}/${variant.id}: 同じ素材が重複しています`);
            ingredientIds.add(Number(part.itemId));
            const material = itemById.get(Number(part.itemId));
            assert(material?.materialType, `${recipe.id}/${variant.id}: ${part.itemId} は素材アイテムではありません`);
            assert(Number.isInteger(part.count) && part.count >= 1 && part.count <= 10,
                `${recipe.id}/${variant.id}: ${part.itemId} の必要数が1～10ではありません`);
        }
    }
}
['回復', '攻撃', '強化', '弱体', '育成'].forEach(category => assert(outputCategories.has(category), `${category}カテゴリがありません`));

const waterCity = context.__FIXED_MAPS.WATER_CITY;
const action = waterCity.mapActions.find(entry => entry.type === 'alchemy');
assert(action && action.x === 31 && action.y === 3, '水上都市右上の民家に錬金所入口がありません');
assert(waterCity.tiles[action.y][action.x] === 'H', '錬金所入口が既存の民家タイル上にありません');

assert(action.imageKey === 'overlay_building_water_alchemy' && action.blocksMovement === false,
    'Alchemy entrance must use its dedicated building while retaining the same walk-on entrance behavior as shops and inns.');
assert(Number(action.buildingScale) === 3, 'Only the alchemy exterior must request the dedicated 3x building scale.');

const first = recipes[0];
const variant = first.variants[0];
variant.ingredients.forEach(part => { context.App.data.items[part.itemId] = part.count * 2; });
assert(context.Alchemy.canCraft(first, variant, 2), '必要素材を満たしても2回分を生成できません');
assert(context.Alchemy.getCraftableEntries().some(entry => entry.recipe.id === first.id), '作成可能一覧に錬成可能品が表示されません');
assert(context.Alchemy.craftConfirmed(first.id, variant.id, 2), '錬成実行が失敗しました');
assert(context.App.data.items[first.outputItemId] === first.outputCount * 2, '生成数が正しくありません');
assert(variant.ingredients.every(part => !context.App.data.items[part.itemId]), '使用素材が正しく消費されません');
assert(context.App.saveCalls === 1, '錬成後に保存されません');
assert(!context.Alchemy.craftConfirmed(first.id, variant.id, 1), '素材不足でも錬成できてしまいます');

context.App.data.items[2000] = 1;
context.App.data.items[2008] = 1;
context.Alchemy.randomSelection = { 2000: 1, 2008: 1 };
const lowEntries = context.Alchemy.getRandomSelectionEntries();
const lowValidation = context.Alchemy.validateRandomSelection(lowEntries);
assert(lowValidation.ok && lowValidation.quality.maxRank === 5, '低級素材2種の品質計算が正しくありません');
assert(lowValidation.candidates.length > 0 && lowValidation.candidates.every(entry => entry.rank <= 5), '低級素材から高ランク品が候補になっています');
const randomResult = context.Alchemy.randomCraftConfirmed(() => 0);
assert(randomResult && ['HP回復', 'MP回復', '状態異常回復'].includes(randomResult.type), '低級素材から低級回復品を生成できません');
assert(!context.App.data.items[2000] && !context.App.data.items[2008], 'ランダム錬成の投入素材が消費されません');
assert(context.App.saveCalls === 2, 'ランダム錬成後に保存されません');

context.App.data.items[2062] = 10;
context.App.data.items[2054] = 10;
context.Alchemy.randomSelection = { 2062: 10, 2054: 10 };
const highValidation = context.Alchemy.validateRandomSelection();
assert(highValidation.ok && highValidation.quality.maxRank >= 100, '高ランク素材と投入数が品質へ反映されません');
assert(highValidation.candidates.some(entry => entry.item.id === 106), '高品質候補に育成アイテムが含まれません');
context.Alchemy.randomSelection = { 2062: 11, 2054: 1 };
assert(!context.Alchemy.validateRandomSelection().ok, '素材を11個以上指定できてしまいます');

const index = read('index.html');
const main = read('main.js');
const phaser = read('phaser-field.js');
const alchemySource = read('alchemy.js');
const assetsSource = read('assets.js');
assert(main.includes('Field.getMapActionOverlayConfig?.(x, y)') && main.includes('overlayConfig.buildingScale || 2.4'),
    'Dedicated facility images must share normal building anchors and Canvas scale handling.');
assert(phaser.includes('overlay.buildingScale || 2.4'), 'Phaser renderer must honor the per-building scale.');
assert(assetsSource.includes('assets/map/overlays/overlay_building_water_alchemy.png'),
    'The differentiated Water City alchemy exterior is not registered.');
assert(!alchemySource.includes('素材からランダム錬成') && alchemySource.includes("title.textContent = 'ランダム錬成'"),
    'Random alchemy labels must use the concise requested wording.');
assert(!/init:\s*\(\)\s*=>\s*\{[\s\S]{0,1600}Alchemy\.openRecipeList\(\);/.test(alchemySource),
    'Entering the alchemy facility must leave the top page visible instead of auto-opening recipes.');
assert(index.includes('id="alchemy-scene"') && index.includes('<script src="alchemy.js"></script>'), '錬金所シーンまたはスクリプト読込がありません');
assert(main.includes("sceneId === 'alchemy'") && main.includes("action.type === 'alchemy'"), 'シーン遷移またはフィールド入口処理がありません');

console.log(`PASS: 錬金所 ${recipes.length}品 / ${recipes.reduce((sum, recipe) => sum + recipe.variants.length, 0)}素材構成を検証しました`);
