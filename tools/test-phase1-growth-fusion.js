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
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    setAttribute() {}, getAttribute() { return null; },
    getContext() { return {}; },
    children: [], innerHTML: '', textContent: ''
  });
  const document = {
    getElementById() { return dummyElement(); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return dummyElement(); },
    body: dummyElement(), documentElement: dummyElement(), addEventListener() {}
  };
  const window = {
    JOB_SKILLS: {}, CHARACTERS_DATA: [], ITEMS_DATA: [],
    addEventListener() {}, requestAnimationFrame(callback) { return callback?.(); },
    setTimeout, clearTimeout, document, innerWidth: 320, innerHeight: 640
  };
  const context = {
    window, document, console, setTimeout, clearTimeout, Math, Date, JSON, Number,
    String, Array, Object, Map, Set, WeakMap, Promise, Intl,
    structuredClone: global.structuredClone,
    DB: { CHARACTERS: [], SKILLS: [], ITEMS: [], EQUIPS: [], SYNERGIES: [] },
    CONST: { SKILL_TREES: {}, EXP_BASE: 100, RARITY_EXP_MULT: {} },
    navigator: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    Image: function Image() { return dummyElement(); },
    Audio: function Audio() { return dummyElement(); },
    globalThis: null
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
load(context, 'main.js', 'globalThis.__APP=App;globalThis.__FIELD=Field;');

context.Facilities = {
  escapeAttr(value) { return String(value); },
  setupBaseLayout() {}, showModal() {}, closeModal() {}
};
context.Menu = { msg() {}, confirm(_message, callback) { callback?.(); } };
Object.assign(context.window, { Facilities: context.Facilities, Menu: context.Menu });
load(context, 'monster_nursery.js', 'globalThis.__NURSERY=MonsterNursery;');

const App = context.__APP;
const PassiveSkill = context.__PASSIVE;
const Nursery = context.__NURSERY;
const growthMaster = context.MONSTER_ALLY_GROWTH_TYPE_MASTER;
const monsters = context.MONSTERS_DATA;

// Master completeness and explicit assignment.
assert.strictEqual(Object.keys(growthMaster.types).length, 24, 'Growth type master must contain 24 profiles.');
assert.strictEqual(monsters.length, 348, 'Unexpected monster master count.');
assert(monsters.every(monster => growthMaster.types[monster.allyGrowthType]), 'Every monster must have a valid explicit allyGrowthType.');

// HP/MP references and combat profile shape.
const refs = Object.fromEntries(context.window.CHARACTERS_DATA.map(character => [character.id, character]));
const balance = App.buildMonsterAllyGrowthProfile('BALANCE_A').growthBase;
const physical = App.buildMonsterAllyGrowthProfile('ATK_A').growthBase;
const magical = App.buildMonsterAllyGrowthProfile('MAG_A').growthBase;
assert.strictEqual(balance.hp, refs[301].growthBase.hp);
assert.strictEqual(balance.mp, refs[301].growthBase.mp);
assert.strictEqual(physical.hp, refs[109].growthBase.hp);
assert.strictEqual(physical.mp, refs[109].growthBase.mp);
assert.strictEqual(magical.hp, refs[110].growthBase.hp);
assert.strictEqual(magical.mp, refs[110].growthBase.mp);
assert.strictEqual(Math.max(balance.atk, balance.def, balance.mag, balance.mdef, balance.spd), Math.min(balance.atk, balance.def, balance.mag, balance.mdef, balance.spd), 'BALANCE_A combat growth must be equal.');

function approximateRatio(type, specialKeys, expected) {
  const g = App.buildMonsterAllyGrowthProfile(type).growthBase;
  const all = ['atk', 'def', 'mag', 'mdef', 'spd'];
  const special = specialKeys.reduce((sum, key) => sum + g[key], 0) / specialKeys.length;
  const ordinaryKeys = all.filter(key => !specialKeys.includes(key));
  const ordinary = ordinaryKeys.reduce((sum, key) => sum + g[key], 0) / ordinaryKeys.length;
  assert(Math.abs(special / ordinary - expected) <= 0.12, `${type} ratio was ${special / ordinary}, expected about ${expected}.`);
}
approximateRatio('ATK_A', ['atk'], 1.5);
approximateRatio('MAG_B', ['mag'], 2.0);
approximateRatio('DEF_C', ['def'], 5.0);
approximateRatio('ATK_MAG_C', ['atk', 'mag'], 5.0);
const balanceB = App.buildMonsterAllyGrowthProfile('BALANCE_B').growthBase;
const balanceC = App.buildMonsterAllyGrowthProfile('BALANCE_C').growthBase;
assert(balanceB.atk + balanceB.def > balanceB.mag + balanceB.mdef, 'BALANCE_B must lean physical.');
assert(balanceC.mag + balanceC.mdef > balanceC.atk + balanceC.def, 'BALANCE_C must lean magical.');

// Reincarnation/fusion shared growth multiplier.
assert.strictEqual(App.getReincarnationGrowthMultiplier({ reincarnationCount: 0 }), 1.0);
assert.strictEqual(App.getReincarnationGrowthMultiplier({ reincarnationCount: 1 }), 1.1);
assert.strictEqual(App.getReincarnationGrowthMultiplier({ reincarnationCount: 5 }), 1.5);
assert.strictEqual(App.getReincarnationGrowthMultiplier({ reincarnationCount: 99 }), 1.5);
assert.strictEqual(App.getReincarnationGrowthMultiplier({ isMonsterAlly: true, monsterFusionCount: 3 }), 1.3);

// The real level-up path must use the shared multiplier once and apply MDEF once.
const originalCalcStats = App.calcStats;
const originalApplyLevelUpTraits = PassiveSkill.applyLevelUpTraits;
const originalRandom = context.Math.random;
App.calcStats = character => ({ maxHp: character.hp, maxMp: character.mp });
PassiveSkill.applyLevelUpTraits = () => null;
context.Math.random = () => 0.5; // 6% growth, no inspiration, deterministic flat bonuses.
const makeGrowthCharacter = overrides => ({
  uid: 'growth-test', charId: 999999, name: '成長試験', level: 1, exp: 0, sp: 0,
  hp: 100, mp: 100, atk: 100, def: 100, mag: 100, mdef: 100, spd: 100,
  currentHp: 100, currentMp: 100,
  growthBase: { hp: 1000, mp: 1000, atk: 1000, def: 1000, mag: 1000, mdef: 1000, spd: 1000 },
  traits: [], disabledTraits: [], equips: {},
  reincarnationCount: 0,
  ...overrides
});
const normalGrowth = makeGrowthCharacter({});
App.applyLevelUpGrowth(normalGrowth, { silent: true });
assert.deepStrictEqual(
  { hp: normalGrowth.hp - 100, mp: normalGrowth.mp - 100, atk: normalGrowth.atk - 100, def: normalGrowth.def - 100, mag: normalGrowth.mag - 100, mdef: normalGrowth.mdef - 100, spd: normalGrowth.spd - 100 },
  { hp: 123, mp: 123, atk: 61, def: 61, mag: 61, mdef: 61, spd: 61 }
);
const fusedGrowth = makeGrowthCharacter({ isMonsterAlly: true, monsterFusionCount: 3 });
App.applyLevelUpGrowth(fusedGrowth, { silent: true });
assert.deepStrictEqual(
  { hp: fusedGrowth.hp - 100, mp: fusedGrowth.mp - 100, atk: fusedGrowth.atk - 100, def: fusedGrowth.def - 100, mag: fusedGrowth.mag - 100, mdef: fusedGrowth.mdef - 100, spd: fusedGrowth.spd - 100 },
  { hp: 159, mp: 159, atk: 79, def: 79, mag: 79, mdef: 79, spd: 79 }
);
App.calcStats = originalCalcStats;
PassiveSkill.applyLevelUpTraits = originalApplyLevelUpTraits;
context.Math.random = originalRandom;

// Permanent growth traits must ignore equipment traits.
const lateBloomerId = Number(PassiveSkill.LATE_BLOOMER_TRAIT_ID || 58);
const ownOnly = {
  traits: [{ id: lateBloomerId, level: 1 }],
  equips: { '武器': { traits: [{ id: lateBloomerId, level: 9 }] } },
  disabledTraits: []
};
assert.strictEqual(PassiveSkill.getOwnSumValue(ownOnly, 'stat_bonus_mult'), Number(PassiveSkill.MASTER[lateBloomerId].params.stat_bonus_mult), 'Equipment traits must not affect permanent growth.');

// Trait books add a seventh slot but never an eighth.
const bookTraitId = PassiveSkill.TRAIT_BOOK_TRAIT_IDS.find(id => id > 6 && PassiveSkill.MASTER[id]);
const fiveTraitCharacter = { name: '未完成者', traits: [1, 2, 3, 4, 5].map(id => ({ id, level: 1 })), disabledTraits: [] };
assert.strictEqual(PassiveSkill.canAddTraitWithBook(fiveTraitCharacter, bookTraitId).ok, false, 'Trait books may add only the seventh slot.');
const traitCharacter = { name: '試験者', traits: [1, 2, 3, 4, 5, 6].map(id => ({ id, level: 1 })), disabledTraits: [] };
assert(PassiveSkill.canAddTraitWithBook(traitCharacter, bookTraitId).ok);
assert(PassiveSkill.addTraitWithBook(traitCharacter, bookTraitId).success);
assert.strictEqual(traitCharacter.traits.length, 7);
const anotherTraitId = PassiveSkill.TRAIT_BOOK_TRAIT_IDS.find(id => id !== bookTraitId && PassiveSkill.MASTER[id]);
assert.strictEqual(PassiveSkill.canAddTraitWithBook(traitCharacter, anotherTraitId).ok, false);

// Fusion: main + floor(material * 10%), selection, equipment return, party removal and pot consumption.
const equipmentA = { uid: 'eq-a', name: '主武器' };
const equipmentB = { uid: 'eq-b', name: '素材盾' };
const primary = {
  uid: 'm-main', isMonsterAlly: true, monsterId: monsters[0].id,
  name: 'メイン', img: 'main.png', level: 88, exp: 1234,
  hp: 101, mp: 51, atk: 80, def: 70, mag: 60, mdef: 50, spd: 40,
  currentHp: 12, currentMp: 3,
  skills: [101, 102, 103, 104, 105, 106, 107, 108, 109],
  traits: [1, 2, 3, 4, 5, 6].map((id, index) => ({ id, level: index === 1 ? 2 : 1, battleCount: index })),
  disabledTraits: [6],
  equips: { '武器': equipmentA, '盾': null, '頭': null, '体': null, '足': null },
  config: { hiddenSkills: [101, 999], autoDisabledSkills: [102, 999] },
  growthBase: { hp: 42, mp: 12, atk: 50, def: 20, mag: 10, mdef: 15, spd: 25 },
  monsterFusionCount: 2, reincarnationCount: 0, sp: 9, tree: { ATK: 2 }, limitBreak: 33
};
const material = {
  uid: 'm-material', isMonsterAlly: true, monsterId: monsters[1].id,
  name: '素材', level: 77,
  hp: 99, mp: 29, atk: 59, def: 49, mag: 39, mdef: 29, spd: 19,
  skills: [105, 106, 110, 111, 112],
  traits: [{ id: 2, level: 5, battleCount: 1 }, { id: 7, level: 2 }, { id: 8, level: 1 }],
  disabledTraits: [],
  equips: { '武器': null, '盾': equipmentB, '頭': null, '体': null, '足': null },
  growthBase: { hp: 35, mp: 22, atk: 10, def: 10, mag: 50, mdef: 40, spd: 15 },
  monsterFusionCount: 0, reincarnationCount: 0
};
App.data = {
  characters: [primary, material], party: ['m-main', 'm-material', null, null],
  items: { 599999: 1 }, inventory: [], progress: { flags: {} }
};
App.save = () => true;
App.ensureCharacterBattleConfig = () => primary.config;
const preview = App.getMonsterFusionPreview(primary.uid, material.uid, [101, 102, 103, 104, 105, 106, 107, 108], [1, 2, 3, 4, 5, 7]);
assert(preview.ok);
assert.deepStrictEqual(JSON.parse(JSON.stringify(preview.stats)), { hp: 110, mp: 53, atk: 85, def: 74, mag: 63, mdef: 52, spd: 41 });
assert.strictEqual(preview.allTraits.find(trait => trait.id === 2).level, 5, 'Duplicate trait must retain higher level.');
const originalFusionCalcStats = App.calcStats;
App.calcStats = character => ({ maxHp: character.hp, maxMp: character.mp });
const result = App.fuseMonsterAllies(primary.uid, material.uid, [101, 102, 103, 104, 105, 106, 107, 108], [1, 2, 3, 4, 5, 7]);
App.calcStats = originalFusionCalcStats;
assert(result.ok, result.message);
assert.strictEqual(primary.level, 1);
assert.strictEqual(primary.currentHp, 110);
assert.strictEqual(primary.currentMp, 53);
assert.strictEqual(primary.monsterFusionCount, 3);
assert.strictEqual(primary.name, 'メイン');
assert.strictEqual(primary.img, 'main.png');
assert.strictEqual(primary.sp, 9);
assert.strictEqual(primary.limitBreak, 33);
assert.deepStrictEqual(JSON.parse(JSON.stringify(primary.growthBase)), { hp: 42, mp: 12, atk: 50, def: 20, mag: 10, mdef: 15, spd: 25 });
assert.strictEqual(App.data.characters.length, 1);
assert.strictEqual(App.data.party[1], null);
assert.strictEqual(App.data.inventory.length, 2);
assert.strictEqual(App.data.items[599999], undefined);
assert(Object.values(primary.equips).every(value => value == null));
assert.strictEqual(primary.traits.find(trait => trait.id === 2).level, 5);
assert.strictEqual(primary.skills.length, 8);

// First visit gift is exactly once per save.
App.data.items = {};
App.data.progress = { flags: {} };
let saveCount = 0;
App.save = () => { saveCount += 1; };
assert.strictEqual(Nursery.grantFirstVisitPot(), true);
assert.strictEqual(Nursery.grantFirstVisitPot(), false);
assert.strictEqual(App.data.items[599999], 1);
assert.strictEqual(saveCount, 1);

// Static integration checks for the urgent fixes included in this phase.
const alchemySource = read('alchemy.js');
for (const itemId of [1001, 1006, 1011, 1016, 1021, 1026, 1031]) {
  assert(new RegExp(`R\\([^\\n]+,\\s*${itemId},\\s*'攻撃'`).test(alchemySource), `Missing Rank50 alchemy recipe for item ${itemId}.`);
}
assert(alchemySource.includes('alchemy-recipe-list') && alchemySource.includes('previousScrollTop'), 'Alchemy scroll restoration is not connected.');
const storySource = read('story.js');
assert(/"quest_luna_hidden_clear"\s*:\s*\{\s*"postBattleBossSprite"\s*:\s*false/.test(storySource), 'Luna clear event must suppress the post-battle boss sprite.');
const storyLogicSource = read('story_logic.js');
assert(storyLogicSource.includes('if (!spriteConfig.enabled) return null;'), 'Disabled post-battle sprites must not be returned to map rendering.');
const itemsMenuSource = read('menus_items.js');
assert(itemsMenuSource.includes("Field.refreshCurrentAction({ silent:true })"), 'Sky Prism arrival must refresh the action after menus close.');
const mainSource = read('main.js');
assert.strictEqual((mainSource.match(/charData\.mdef\s*=\s*\(charData\.mdef\s*\|\|\s*0\)\s*\+\s*incMdef/g) || []).length, 1, 'MDEF must be applied exactly once per level-up.');
assert(mainSource.includes("sceneId === 'monster-nursery'"), 'Monster nursery scene initialization is missing.');
assert(mainSource.includes("fullDataCacheName: 'prisma-abyss-v28.20260803-runtime'"), 'Runtime cache version must match the service worker.');
const mapSource = read('map.js');
assert(/"x": 15,\s*"y": 25,\s*"type": "monsterNursery"/.test(mapSource), 'Legacion nursery map action is missing.');
const indexSource = read('index.html');
assert(indexSource.includes('id="monster-nursery-scene"') && indexSource.includes('<script src="monster_nursery.js"></script>'), 'Nursery scene or script is missing from index.html.');
const swSource = read('sw.js');
assert(swSource.includes('"monster_nursery.js"') && swSource.includes('prisma-abyss-v28.20260803-runtime'), 'Nursery cache registration is incomplete.');
assert(storyLogicSource.includes('resolvePostBattleBossSpriteConfig(event).enabled'), 'Disabled Luna visual must be rejected before capture.');

console.log('PHASE1_TESTS_OK');
console.log(JSON.stringify({ monsters: monsters.length, growthTypes: Object.keys(growthMaster.types).length, fusionStats: preview.stats }, null, 2));
