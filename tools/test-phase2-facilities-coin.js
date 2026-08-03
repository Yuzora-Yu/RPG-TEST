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
const expectedPostgameSkillBookIds = [
    600300, 600301, 600302, 600303, 600401,
    600407, 600414, 600501, 600503, 600602
];
assert(Array.isArray(skillShop.itemIds) && skillShop.itemIds.length === 10, '技法書店の品揃えが10種ではありません。');
assert(JSON.stringify(skillShop.itemIds) === JSON.stringify(expectedPostgameSkillBookIds),
    '技法書店が蘇生・ブレス・中級支援中心の指定品揃えではありません。');
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
assert(mainSource.includes('totalCoinsSpent: 0'), '累計消費枚数の初期値がありません。');
assert(mainSource.includes('ensureCoinSpendingRewardProgress'), '累計報酬のセーブ補完処理がありません。');
assert(mainSource.includes('estimatedLegacySpent'), '旧セーブの過去消費枚数を復元する処理がありません。');

const rewards = db.MEDAL_REWARDS;
const spendingRewards = db.COIN_SPENDING_REWARDS;
assert(Array.isArray(spendingRewards), '累計消費報酬マスターを読み込めません。');
assert(JSON.stringify(spendingRewards.map(entry => Number(entry.coins))) === JSON.stringify([10, 30, 50, 100, 150, 200, 300, 500]),
    '累計消費報酬の達成枚数が指定値と一致しません。');
assert(spendingRewards.every(entry => Array.isArray(entry.rewards) && entry.rewards.length > 0),
    '累計消費報酬に報酬内容がない項目があります。');
const rewardByCoins = new Map(spendingRewards.map(entry => [Number(entry.coins), entry.rewards]));
assert(JSON.stringify(rewardByCoins.get(100)?.map(reward => Number(reward.eid))) === JSON.stringify([901, 902, 903, 904, 905]),
    '100枚累計報酬がレプリカ5種一式ではありません。');
assert(JSON.stringify(rewardByCoins.get(300)) === JSON.stringify([
    { type: 'ITEM', id: 107, val: 1 },
    { type: 'ITEM', id: 599999, val: 1 },
    { type: 'ITEM', id: 98, val: 1 }
]), '300枚累計報酬が指定内容ではありません。');
assert(JSON.stringify(rewardByCoins.get(500)) === JSON.stringify([
    { type: 'ITEM', id: 107, val: 2 },
    { type: 'ITEM', id: 599999, val: 2 },
    { type: 'ITEM', id: 98, val: 5 }
]), '500枚累計報酬が指定内容ではありません。');
assert(spendingRewards.filter(entry => Number(entry.coins) < 100)
    .every(entry => entry.rewards.reduce((sum, reward) => sum + Math.max(1, Number(reward.val) || 1), 0) >= 4),
    '100枚未満の累計報酬が豪華化されていません。');
assert(spendingRewards.flatMap(entry => entry.rewards).every(reward => reward.type !== 'ITEM' || itemById.has(Number(reward.id))),
    '累計消費報酬に存在しないアイテムIDがあります。');
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

const facilityContext = vm.createContext({
    window: { EQUIP_MASTER: equips },
    console,
    Date,
    Math,
    setTimeout,
    clearTimeout,
    DB: db,
    App: {
        data: {
            items: { 99: 100 },
            inventory: [],
            stats: { totalCoinsSpent: 0 },
            progress: { coinSpendingRewards: { claimedMilestones: [] } },
            gold: 0,
            gems: 0
        },
        saveCount: 0,
        save() { this.saveCount += 1; return true; },
        ensureLifetimeStats() { return this.data.stats; },
        incrementLifetimeStat(key, amount) {
            this.data.stats[key] = Number(this.data.stats[key] || 0) + Number(amount || 0);
            return this.data.stats[key];
        },
        ensureCoinSpendingRewardProgress() { return this.data.progress.coinSpendingRewards; },
        createEquipById(eid) {
            const base = equips.find(equip => Number(equip.eid) === Number(eid));
            return base ? { ...base, uid: `test-${eid}`, plus: 0 } : null;
        }
    },
    Menu: { messages: [], msg(text) { this.messages.push(text); } },
    document: {}
});
load('facilities.js', facilityContext);
const Facilities = vm.runInContext('Facilities', facilityContext);
Facilities.closeModal = () => {};
Facilities.openCoinSpendingRewards = () => {};
Facilities.initMedal = () => {};
Facilities.execMedal({ medals: 3, name: '業火の壺 x1', type: 'item', id: 1001, count: 1 });
assert(facilityContext.App.data.items[99] === 97, '交換時にコインが正しく消費されません。');
assert(facilityContext.App.data.stats.totalCoinsSpent === 3, '交換成功時に累計消費枚数が加算されません。');
assert(facilityContext.App.data.items[1001] === 1, '交換景品が付与されません。');

facilityContext.App.data.stats.totalCoinsSpent = 10;
Facilities.claimCoinSpendingReward(10);
assert(facilityContext.App.data.progress.coinSpendingRewards.claimedMilestones.includes(10), '達成済み累計報酬が受取済みになりません。');
assert(facilityContext.App.data.items[2] === 10, '10枚累計報酬が付与されません。');
Facilities.claimCoinSpendingReward(10);
assert(facilityContext.App.data.items[2] === 10, '累計報酬を二重受領できてしまいます。');

facilityContext.App.data.stats.totalCoinsSpent = 100;
Facilities.claimCoinSpendingReward(100);
assert(facilityContext.App.data.inventory.length === 5, '100枚累計報酬のレプリカ一式が付与されません。');
assert(JSON.stringify(facilityContext.App.data.inventory.map(equip => Number(equip.eid))) === JSON.stringify([901, 902, 903, 904, 905]),
    '100枚累計報酬で付与されるレプリカ装備が不正です。');

console.log(`Phase2施設・ふるびたコイン検証: OK（技法書 ${skillShop.itemIds.length}種 / 景品 ${rewards.length}種 / 累計報酬 ${spendingRewards.length}段階）`);
