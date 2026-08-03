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
load(context, 'story.js');
load(context, 'passiveSkill.js', 'globalThis.__PASSIVE=PassiveSkill;');
load(context, 'main.js', 'globalThis.__APP=App;');

const App = context.__APP;
const statKeys = ['hp', 'mp', 'atk', 'def', 'spd', 'mag', 'mdef'];

// Old V1 completion must not block the corrected boss-kill fallback.
const killData = {
  system: { abyssBossKillCountRecoveryV1Completed: true },
  book: { monsters: [], killCounts: { 302101: 2, 302100: 0, 302000: 0, 302001: 0 } }
};
const killResult = App.migrateAbyssBossKillCountsV2(killData);
assert.strictEqual(killResult.changed, true);
for (const id of [302100, 302000, 302001]) assert.strictEqual(killData.book.killCounts[id], 1, `${id} was not recovered.`);
assert(killData.system.oneTimeMigrations['20260803_abyssBossKillCountsV2']);
killData.book.killCounts[302100] = 0;
assert.strictEqual(App.migrateAbyssBossKillCountsV2(killData).applied, false, 'One-time migration ran twice.');
assert.strictEqual(killData.book.killCounts[302100], 0, 'One-time migration unexpectedly reapplied.');

// Reincarnation growth is rescaled once, while tracked permanent consumable bonuses remain intact.
const zenonMaster = context.window.CHARACTERS_DATA.find(entry => Number(entry.id) === 402);
const reincChar = {
  uid: 'zenon-reinc', charId: 402, name: 'ゼノン', level: 100, reincarnationCount: 2,
  hp: zenonMaster.hp + 10000 + 30, mp: zenonMaster.mp + 4000 + 20,
  atk: zenonMaster.atk + 3000 + 10, def: zenonMaster.def + 3000 + 10,
  spd: zenonMaster.spd + 3000 + 10, mag: zenonMaster.mag + 3000 + 10, mdef: zenonMaster.mdef + 3000 + 10,
  currentHp: zenonMaster.hp + 10000 + 30, currentMp: zenonMaster.mp + 4000 + 20,
  permanentStatBonuses: { hp: 30, mp: 20, atk: 10, def: 10, spd: 10, mag: 10, mdef: 10 }
};
const beforeReinc = Object.fromEntries(statKeys.map(key => [key, reincChar[key]]));
const reincData = { system: {}, characters: [reincChar] };
const reincResult = App.migrateReincarnationGrowthFormulaV1(reincData);
assert.strictEqual(reincResult.changed, true);
for (const key of statKeys) {
  const minimum = Number(zenonMaster[key]) + Number(reincChar.permanentStatBonuses[key] || 0);
  assert(reincChar[key] >= minimum, `${key} lost its permanent bonus.`);
  assert(reincChar[key] < beforeReinc[key], `${key} was not rebuilt with the reduced formula.`);
}
const afterReinc = Object.fromEntries(statKeys.map(key => [key, reincChar[key]]));
App.migrateReincarnationGrowthFormulaV1(reincData);
assert.deepStrictEqual(Object.fromEntries(statKeys.map(key => [key, reincChar[key]])), afterReinc, 'Reincarnation rebuild ran twice.');

// Existing Gilgamesh must use ALL_SPECIAL and beat same-level Zenon in every base stat.
const gilgameshMaster = context.MONSTERS_DATA.find(entry => Number(entry.id) === 902000);
const savedZenon = {
  uid: 'zenon-saved', charId: 402, name: 'ゼノン', level: 100,
  hp: 12000, mp: 3500, atk: 2500, def: 2200, spd: 2100, mag: 2600, mdef: 2300
};
const gilgamesh = {
  uid: 'gil-saved', charId: 902000, monsterId: 902000, sourceMonsterId: 902000,
  isMonsterAlly: true, name: 'ギルガメッシュ', level: 100,
  hp: 100, mp: 10, atk: 10, def: 10, spd: 10, mag: 10, mdef: 10,
  currentHp: 100, currentMp: 10, monsterAllyMeta: {}, growthBase: {}
};
const gilData = { system: {}, characters: [savedZenon, gilgamesh] };
const gilResult = App.migrateGilgameshAllyDominanceV1(gilData);
assert.strictEqual(gilResult.changed, true);
assert.strictEqual(gilgamesh.monsterAllyMeta.growthType, 'ALL_SPECIAL');
for (const key of statKeys) {
  assert(gilgamesh[key] > savedZenon[key], `Gilgamesh ${key} does not exceed same-level Zenon.`);
  assert(gilgamesh[key] >= Math.ceil(savedZenon[key] * 1.1), `Gilgamesh ${key} missed the 110% floor.`);
}
assert.strictEqual(gilgamesh.currentHp, gilgamesh.hp, 'Full HP was not preserved after stat migration.');
assert.strictEqual(gilgamesh.currentMp, gilgamesh.mp, 'Full MP was not preserved after stat migration.');
assert.strictEqual(gilgameshMaster.specialBossRules.allyStatFloorCharacterId, 402);

// Completed Luna/Zenon quests clear only their stale persistent boss visuals.
const visualData = {
  system: {},
  progress: {
    quests: { luna_hidden_dark_shrine: { state: 'completed' }, zenon_hidden_grezelia: { state: 'completed' } },
    pendingPostBattleBossVisual: { eventId: 'quest_luna_hidden_clear', monsterIds: [401170] },
    lastFixedBossEvent: { storyWinEventId: 'quest_zenon_hidden_clear', fixedBossId: 401180 },
    activeFixedBossContext: { eventId: 'unrelated_event', monsterId: 123 }
  },
  battle: { active: false, fixedBossId: 401180, fixedStoryEventId: 'quest_zenon_hidden_clear' }
};
const visualResult = App.migrateLunaZenonBossVisualCleanupV1(visualData);
assert.strictEqual(visualResult.changed, true);
assert.strictEqual(visualData.progress.pendingPostBattleBossVisual, undefined);
assert.strictEqual(visualData.progress.lastFixedBossEvent, undefined);
assert(visualData.progress.activeFixedBossContext, 'Unrelated visual context was removed.');
assert.strictEqual(visualData.battle.fixedBossId, undefined);
assert.strictEqual(context.window.STORY_MANAGER_DATA.events.quest_luna_hidden_clear.postBattleBossSprite, false);
assert.strictEqual(context.window.STORY_MANAGER_DATA.events.quest_zenon_hidden_clear.postBattleBossSprite, false);

assert.strictEqual(App.compatibilityMigrationRemovalDate, '2026-08-15');
console.log('Phase2G save compatibility regression tests passed.');
