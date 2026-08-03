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
const load = (file, context) => vm.runInContext(read(file), context, { filename: file });

const context = vm.createContext({
    console,
    Date,
    Math,
    JSON,
    setTimeout,
    clearTimeout
});
context.globalThis = context;
context.window = context;
context.DB = { ITEMS: [], MONSTERS: [], SKILLS: [] };
context.App = {
    data: {
        progress: {
            storyStep: 0,
            flags: {},
            guild: {
                rank: 'C', exp: 0, points: 0, offers: [], questStates: {}, completionCounts: {},
                generatedQuests: {}, generatorSchemaVersion: 7, generatorSerial: 0, generatedCompletionTotal: 0
            }
        },
        dungeon: { maxFloor: 0, storyMaxFloor: 0 }
    },
    escapeHtml(value) { return String(value ?? ''); },
    getAbyssLegacyProgressFloor() {
        const dungeon = this.data.dungeon || {};
        return Math.max(Number(dungeon.storyMaxFloor || 0), Number(dungeon.maxFloor || 0) > 0 ? Number(dungeon.maxFloor) + 100 : 0);
    },
    getQuestKindLabel(kind) { return String(kind || ''); },
    save() { return true; }
};

load('guild_master.js', context);
load('guild_quests.js', context);
load('guild.js', context);

const master = context.GUILD_MASTER_DATA;
const generator = context.GUILD_QUEST_GENERATOR_MASTER;
const Guild = context.Guild;
assert(master && Guild && generator, 'ギルドマスターを読み込めません。');

const expectedThresholds = [0, 300, 1000, 2500, 6000, 13000, 26000, 50000];
assert(JSON.stringify(master.ranks.map(rank => Number(rank.requiredTotalExp))) === JSON.stringify(expectedThresholds),
    'ギルド昇格必要EXPが指定の大幅増加値ではありません。');
assert(master.ranks.every((rank, index, list) => index === 0 || Number(rank.requiredTotalExp) > Number(list[index - 1].requiredTotalExp)),
    'ギルド昇格必要EXPが単調増加していません。');

assert(generator.schemaVersion >= 7, 'ギルド依頼生成マスターのスキーマが更新されていません。');
assert(Number(generator.challengeDungeons.maxReferenceRank) === 220, '依頼迷宮の参考Rank上限が220ではありません。');
assert(Number(generator.challengeDungeons.bossStatMultiplier.EX) <= 1.5,
    'EX依頼ボス倍率が過剰です。');
assert(Number(generator.challengeDungeons.normalStatMultiplier.EX) <= 1.2,
    'EX依頼の通常敵倍率が過剰です。');

context.App.data.progress.storyStep = 0;
context.App.data.dungeon.maxFloor = 0;
context.App.data.dungeon.storyMaxFloor = 0;
const lowPower = Guild.getChallengePower({ rank: 'C', exp: 0 }, 'SSR');
assert(lowPower === 90, `Cランク初期の参考Rankが90ではありません: ${lowPower}`);

context.App.data.progress.storyStep = 10;
context.App.data.dungeon.maxFloor = 100; // 旧互換進行値ではRank200相当。
const noExpPower = Guild.getChallengePower({ rank: 'S', exp: 0 }, 'EX');
const hugeExpPower = Guild.getChallengePower({ rank: 'S', exp: 999999999 }, 'EX');
assert(noExpPower === hugeExpPower, '累積ギルドEXPが参考Rankへ再び加算されています。');
assert(noExpPower === 220, `参考Rankが上限220で止まりません: ${noExpPower}`);

const ssrScaling = Guild.getChallengeScaling('SSR', []);
const exScaling = Guild.getChallengeScaling('EX', []);
const eliteScaling = Guild.getChallengeScaling('EX', ['rare50_elite']);
assert(ssrScaling.normalStatMultiplier === 1.05 && ssrScaling.bossStatMultiplier === 1.15,
    'SSR依頼の倍率が不正です。');
assert(exScaling.normalStatMultiplier === 1.2 && exScaling.bossStatMultiplier === 1.5,
    'EX依頼の倍率が不正です。');
assert(eliteScaling.normalStatMultiplier === 1.62,
    'EX超強敵ギミックの倍率が指定上限内で計算されません。');
const bossBoost = Guild.createChallengeBossEnemyBoost({ statMultiplier: 4, rareStatMultiplier: 4, traits: [{ id: 52, level: 10 }] });
assert(bossBoost.statMultiplier === 1 && bossBoost.rareStatMultiplier === 1 && bossBoost.traits.length === 1,
    'ボス用追加効果から能力倍率だけを分離できていません。');

const exRewards = Guild.getChallengeGuildRewards(200, 'EX', false);
assert(exRewards.guildExp === 1000, `Rank200 EX依頼のギルドEXPが1000ではありません: ${exRewards.guildExp}`);
assert(exRewards.guildPoints === 2200, `Rank200 EX依頼のGPが2200ではありません: ${exRewards.guildPoints}`);
assert(exRewards.guildExp < expectedThresholds.at(-1) / 20,
    '単一のEX依頼だけで最高ランク必要EXPを大きく消化できてしまいます。');

const oldDef = {
    id: 'generated:legacy-challenge', generatedQuest: true, generatorKind: 'challenge', kind: 'guildDungeon',
    rarity: 'EX', guildExp: 99999, guildPoints: 99999,
    rewardEquipment: [{ floor: 999, plus: 3, type: '武器', label: 'RANK999 武器+3' }],
    challenge: {
        version: 1, rarity: 'EX', power: 200, encounterRank: 200, bossOnly: false,
        bossStatMultiplier: 12, enemyBoost: { statMultiplier: 8, rareStatMultiplier: 8, traits: [{ id: 52, level: 10 }] },
        gimmicks: []
    }
};
Guild.migrateGeneratedChallengeQuestDefinition(oldDef, 6);
assert(oldDef.challenge.version === 2, '旧依頼迷宮が新スキーマへ移行されません。');
assert(oldDef.challenge.bossStatMultiplier === 1.5, '旧依頼ボス倍率が適正値へ移行されません。');
assert(oldDef.challenge.enemyBoost.statMultiplier === 1.2, '旧依頼通常敵倍率が適正値へ移行されません。');
assert(oldDef.challenge.bossEnemyBoost.statMultiplier === 1, '旧依頼にボス用追加効果が生成されません。');
assert(oldDef.guildExp === 1000, '旧依頼のギルドEXPが適正値へ移行されません。');
assert(oldDef.rewardEquipment[0].floor === 200, '旧依頼装備報酬のRankが参考Rankへ接続されません。');

const guildSource = read('guild.js');
const dungeonSource = read('dungeon.js');
const battleSource = read('battle.js');
assert(guildSource.includes('参考Rank ${Guild.getQuestReferenceRank(def)}'), '受注画面に参考Rank表示がありません。');
assert(dungeonSource.includes('getCurrentRewardRank'), '依頼迷宮宝箱を参考Rankへ接続する関数がありません。');
assert(dungeonSource.includes('guildChallengeBossBoost'), '依頼ボス専用の追加効果が戦闘データへ保存されません。');
assert(battleSource.includes('battleData.guildChallengeBossBoost'), '依頼ボス戦で通常敵倍率を分離していません。');
assert(!guildSource.includes('Number(guildState.exp || 0) / 850'), '旧無制限ボス倍率が残っています。');
assert(!guildSource.includes('Math.sqrt(Math.max(0, Number(guildState?.exp || 0)))'), '累積ギルドEXPによる参考Rank上昇が残っています。');

console.log(`Phase2Cギルド検証: OK（昇格EXP最大 ${expectedThresholds.at(-1)} / 参考Rank ${lowPower}-${noExpPower} / EXボス倍率 ${exScaling.bossStatMultiplier}）`);
