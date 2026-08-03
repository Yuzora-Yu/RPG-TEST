#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};
const load = (file, context) => vm.runInContext(read(file), context, { filename:file });

const context = vm.createContext({
    window: {},
    console,
    Date,
    Math,
    setTimeout,
    clearTimeout
});
load('items.js', context);
load('equips.js', context);
load('database.js', context);
load('map.js', context);

const items = context.window.ITEMS_DATA;
const equips = context.window.EQUIP_MASTER;
const db = context.window.DB;
const legacion = context.window.FIXED_MAPS?.LEGACION;
assert(Array.isArray(items), 'ITEMS_DATAを読み込めません。');
assert(Array.isArray(equips), 'EQUIP_MASTERを読み込めません。');
assert(Array.isArray(db?.MEDAL_REWARDS), 'MEDAL_REWARDSを読み込めません。');
assert(legacion && Array.isArray(legacion.mapActions), 'レガシオンの施設定義を読み込めません。');

const casino = legacion.mapActions.find(action => action.type === 'casino');
const skillShop = legacion.mapActions.find(action => action.type === 'shop' && action.title === 'レガシオン 技法書店');
assert(casino?.requiredFlag === 'abyssEpilogueSeen', 'カジノのクリア後条件が不正です。');
assert(skillShop?.requiredFlag === 'abyssEpilogueSeen', '技法書店のクリア後条件が不正です。');
for (const action of [casino, skillShop]) {
    const tile = typeof legacion.tiles?.[action.y] === 'string'
        ? legacion.tiles[action.y].charAt(action.x)
        : legacion.tiles?.[action.y]?.[action.x];
    assert(tile === 'H', `${action.type} の配置先が施設床ではありません。`);
    assert(legacion.mapActions.filter(other => other.x === action.x && other.y === action.y).length === 1,
        `${action.type} の座標が別アクションと競合しています。`);
}
assert(Array.isArray(skillShop.itemIds) && skillShop.itemIds.length >= 80, '技法書店の品揃えが十分に拡張されていません。');
assert(new Set(skillShop.itemIds).size === skillShop.itemIds.length, '技法書店のitemIdsに重複があります。');

const itemById = new Map(items.map(item => [Number(item.id), item]));
for (const itemId of skillShop.itemIds) {
    const item = itemById.get(Number(itemId));
    assert(item, `技法書店のアイテムID ${itemId} がITEMS_DATAにありません。`);
    assert(Number(item.price) > 0, `技法書店の「${item.name}」に購入価格がありません。`);
}

const forbiddenShopIds = new Set([
    600165, 600166, 600167, 600168, 600169,
    600233, 600234, 600235, 600236, 600237, 600238, 600239,
    600242, 600243, 600244, 600245, 600246, 600247, 600248
]);
assert(!skillShop.itemIds.some(id => forbiddenShopIds.has(Number(id))), '終盤・専用技法書が販売対象に含まれています。');

const mainSource = read('main.js');
assert(/action\.type === ['"]casino['"]/.test(mainSource), 'フィールドからカジノへ入る正式なアクション導線がありません。');

const rewards = db.MEDAL_REWARDS;
assert(!rewards.some(reward => Number(reward.id) === 108), '魔法の小舟が交換景品に残っています。');
assert(rewards.find(reward => Number(reward.id) === 98)?.medals === 50, '災厄の楔が50枚ではありません。');

for (const id of [1001, 1006, 1011, 1016, 1021, 1026, 1031]) {
    assert(rewards.find(reward => Number(reward.id) === id)?.medals === 3, `Rank50攻撃道具 ${id} が3枚ではありません。`);
}
for (const id of [1004, 1009, 1014, 1019, 1024, 1029, 1034]) {
    assert(rewards.find(reward => Number(reward.id) === id)?.medals === 5, `Rank90攻撃道具 ${id} が5枚ではありません。`);
}

const replicaRewards = rewards.filter(reward => reward.type === 'equip');
assert(replicaRewards.length === 5, 'レプリカ景品が5種類ではありません。');
assert(replicaRewards.every(reward => reward.medals === 20), 'レプリカ景品が20枚で統一されていません。');
assert(replicaRewards.every(reward => !Object.prototype.hasOwnProperty.call(reward, 'base')), '交換所内にインライン装備マスターが残っています。');

const equipById = new Map(equips.map(equip => [Number(equip.eid), equip]));
for (const reward of replicaRewards) {
    const equip = equipById.get(Number(reward.equipId));
    assert(equip, `レプリカ装備 ${reward.equipId} の正式マスターがありません。`);
    assert(equip.rank === 70, `${equip.name} がRank70ではありません。`);
    assert(equip.noRandom === true && equip.specialEquip === true, `${equip.name} が特殊装備として固定されていません。`);
    assert(/^メタルロードの.+・レプリカ$/.test(equip.name), `${equip.name} の名称形式が不正です。`);
}

assert(itemById.get(99)?.name === 'ふるびたコイン', 'アイテム名が「ふるびたコイン」ではありません。');
const runtimeFiles = [
    'achievements.js', 'audio_manifest.js', 'database.js', 'equips.js', 'facilities.js',
    'index.html', 'items.js', 'main.js', 'map.js', 'menus_status.js', 'news.js', 'story_logic.js'
];
const runtimeText = runtimeFiles.map(read).join('\n');
for (const oldName of ['ちいさなメダル', 'はぐれメタル', 'メタルキング']) {
    assert(!runtimeText.includes(oldName), `旧名称「${oldName}」がランタイム表示データに残っています。`);
}

console.log(`Phase2施設・ふるびたコイン検証: OK（技法書 ${skillShop.itemIds.length}種 / 景品 ${rewards.length}種）`);
