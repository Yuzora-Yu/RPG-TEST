#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

function createContext() {
  const dummyElement = () => ({
    style: {}, dataset: {}, classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    setAttribute() {}, getAttribute() { return null; }, getContext() { return {}; },
    children: [], innerHTML: '', textContent: ''
  });
  const document = {
    getElementById() { return dummyElement(); }, querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return dummyElement(); }, body: dummyElement(), documentElement: dummyElement(), addEventListener() {}
  };
  const window = {
    JOB_SKILLS: {}, CHARACTERS_DATA: [], ITEMS_DATA: [], addEventListener() {},
    requestAnimationFrame(callback) { return callback?.(); }, setTimeout, clearTimeout, document,
    innerWidth: 320, innerHeight: 640
  };
  const context = {
    window, document, console, setTimeout, clearTimeout, Math, Date, JSON, Number, String, Array, Object,
    Map, Set, WeakMap, Promise, Intl, structuredClone: global.structuredClone,
    DB: { CHARACTERS: [], SKILLS: [], ITEMS: [], EQUIPS: [], SYNERGIES: [] },
    CONST: { SKILL_TREES: {}, EXP_BASE: 100, RARITY_EXP_MULT: {} }, navigator: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    Image: function Image() { return dummyElement(); }, Audio: function Audio() { return dummyElement(); }, globalThis: null
  };
  context.globalThis = context;
  Object.assign(window, context);
  vm.createContext(context);
  return context;
}

function load(context, file, expose = '') {
  vm.runInContext(`${read(file)}\n${expose}`, context, { filename: file });
}

const context = createContext();
load(context, 'characters.js');
context.DB.CHARACTERS = context.window.CHARACTERS_DATA;
load(context, 'monsters.js');
load(context, 'passiveSkill.js', 'globalThis.__PASSIVE=PassiveSkill;');
load(context, 'main.js', 'globalThis.__APP=App;');
const App = context.__APP;

const deletedIds = context.MONSTERS_DATA.map(m => Number(m.id)).filter(id => id >= 401010 && id <= 401100);
assert.strictEqual(deletedIds.length, 0, '401010～401100の旧深淵ボスがマスターに残っています。');

const recovery = {
  system: {}, progress: { flags: {}, defeatedBosses: {} },
  book: { monsters: [], killCounts: { 302101: 2, 302000: 4 } },
  battle: { active: false }, dungeon: {}, guild: {}
};
assert.strictEqual(App.migrateAbyssBossKillCountsV1(recovery), true);
assert.strictEqual(recovery.book.killCounts[302000], 4, '既存討伐数を減らしてはいけません。');
assert.strictEqual(recovery.book.killCounts[302001], 1);
assert.strictEqual(recovery.book.killCounts[302100], 1);
assert.strictEqual(recovery.system.abyssBossKillCountRecoveryV1Completed, true);
assert.strictEqual(App.migrateAbyssBossKillCountsV1(recovery), false, '互換処理は一度だけです。');

const badCarmena = {
  progress: { flags: { abyssCarmenaGateCleared: true }, defeatedBosses: { CARMENA: ['18,2', '20,2', '5,5'] } },
  book: { killCounts: {} }
};
assert.strictEqual(App.reconcileCarmenaGateProgress(badCarmena), true);
assert.strictEqual(badCarmena.progress.flags.abyssCarmenaGateCleared, false, '根拠のないカルメナクリアフラグを解除できません。');
assert.deepStrictEqual(Array.from(badCarmena.progress.defeatedBosses.CARMENA), ['5,5']);

const progressedCarmena = {
  progress: { flags: { abyssCarmenaGateCleared: true, abyssLeonardDefeated: true }, defeatedBosses: {} },
  book: { killCounts: {} }
};
App.reconcileCarmenaGateProgress(progressedCarmena);
assert.strictEqual(progressedCarmena.progress.flags.abyssCarmenaGateCleared, true);
assert.strictEqual(progressedCarmena.book.killCounts[302000], 1);
assert.strictEqual(progressedCarmena.book.killCounts[302001], 1);


const missingFlagWithLaterProgress = {
  progress: { flags: { abyssCarmenaGateCleared: false, abyssSyrisDefeated: true }, defeatedBosses: {} },
  book: { killCounts: {} },
};
App.reconcileCarmenaGateProgress(missingFlagWithLaterProgress);
assert.strictEqual(missingFlagWithLaterProgress.progress.flags.abyssCarmenaGateCleared, true, '後続進行済みセーブのカルメナフラグを復元できません。');
assert.strictEqual(missingFlagWithLaterProgress.book.killCounts[302000], 1);
assert.strictEqual(missingFlagWithLaterProgress.book.killCounts[302001], 1);

const purge = {
  book: { monsters: [401010, 401100, 401110], killCounts: { 401020: 3, 401110: 2 } },
  progress: { flags: {}, defeatedBosses: {} },
  battle: { active: true, fixedBossId: [401010], fixedEnemyIds: [401090], enemies: [{ id: 401100, baseId: 401100 }] },
  dungeon: { abyssBossEncounter: { monsterIds: [401010, 401100] } },
  guild: { availableQuests: [{ bossMonsterIds: [401100, 401110] }] }
};
assert.strictEqual(App.purgeRemovedLegacyAbyssBossReferences(purge), true);
assert.deepStrictEqual(Array.from(purge.book.monsters), [401110]);
assert.strictEqual(purge.book.killCounts[401020], undefined);
assert.strictEqual(purge.battle.active, false);
assert.strictEqual(purge.dungeon.abyssBossEncounter, null);
assert.deepStrictEqual(Array.from(purge.guild.availableQuests[0].bossMonsterIds), [401110]);

const dungeonSource = read('dungeon.js');
const trapFunctionStart = dungeonSource.indexOf('startChestTrapBattle: async');
const trapFunctionEnd = dungeonSource.indexOf('// 固定マップの擬態箱だけ', trapFunctionStart);
const trapFunction = dungeonSource.slice(trapFunctionStart, trapFunctionEnd);
assert(trapFunction.indexOf('App.log(`宝箱を開けた！') < trapFunction.indexOf('await Dungeon.waitForChestTrapReveal'),
  'トラップモンスターのウェイトがログ表示前に残っています。');
assert(!dungeonSource.includes('await Dungeon.waitForChestTrapReveal();\n                    Dungeon.startChestTrapBattle'),
  '固定宝箱側にログ前ウェイトが残っています。');
assert(read('story.js').includes("type:'IF_KILL_COUNTS', ids:[302001,302000]"),
  'カルメナクリアイベントが二将討伐数で保護されていません。');

console.log('Phase2D互換・旧深淵削除・宝箱トラップ検証: OK');
