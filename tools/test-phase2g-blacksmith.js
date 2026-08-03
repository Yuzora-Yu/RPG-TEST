#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

function dummyElement() {
  return {
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, insertBefore() {}, remove() {},
    setAttribute() {}, getAttribute() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    getContext() { return {}; }, children: [], innerHTML: '', innerText: '', textContent: '', disabled: false
  };
}

function createContext() {
  const document = {
    getElementById() { return dummyElement(); }, querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return dummyElement(); }, body: dummyElement(), documentElement: dummyElement(), addEventListener() {}
  };
  const window = {
    JOB_SKILLS: {}, CHARACTERS_DATA: [], ITEMS_DATA: [], EQUIP_MASTER: [], addEventListener() {},
    requestAnimationFrame(callback) { return callback?.(); }, setTimeout, clearTimeout, document, innerWidth: 320, innerHeight: 640
  };
  const context = {
    window, document, console, setTimeout, clearTimeout, Math, Date, JSON, Number, String, Array, Object,
    Map, Set, WeakMap, Promise, Intl, structuredClone: global.structuredClone,
    DB: { CHARACTERS: [], SKILLS: [], ITEMS: [], EQUIPS: [], SYNERGIES: [], OPT_RULES: [] },
    CONST: { SKILL_TREES: {}, EXP_BASE: 100, RARITY_EXP_MULT: {}, PARTS: ['武器','盾','頭','体','足'] },
    navigator: { userAgent:'' }, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    Image: function Image() { return dummyElement(); }, Audio: function Audio() { return dummyElement(); }, globalThis: null,
    Facilities: { setupBaseLayout() {} }, AudioManager: { playSe() {}, async playSeAndWait() {} },
    PassiveSkill: { MASTER: {} }, MutationObserver: class { observe() {} disconnect() {} }
  };
  context.globalThis = context;
  Object.assign(window, context);
  vm.createContext(context);
  return context;
}

function load(context, file, expose = '') {
  vm.runInContext(`${read(file)}\n${expose}`, context, { filename: file });
}

(async () => {
  const context = createContext();
  load(context, 'characters.js');
  context.DB.CHARACTERS = context.window.CHARACTERS_DATA;
  load(context, 'items.js');
  context.DB.ITEMS = context.window.ITEMS_DATA;
  load(context, 'equips.js');
  context.window.EQUIP_MASTER = context.EQUIP_MASTER || context.window.EQUIP_MASTER;
  load(context, 'blacksmith_master.js');
  load(context, 'main.js', 'globalThis.__APP=App;');
  load(context, 'menus.js', 'globalThis.__MENU=Menu;');

  context.Menu = context.__MENU;
  context.window.Menu = context.__MENU;
  context.Menu.msg = () => {};
  context.Menu.confirm = (_message, callback) => { context.__lastConfirmPromise = Promise.resolve(callback()); };
  context.Menu.listChoice = () => {};
  context.Menu.renderPartyBar = () => {};
  context.Menu.changeScreen = () => {};
  context.Menu.getEquipDetailHTML = () => '';
  context.Menu.getRarityColor = () => '#fff';
  context.App = context.__APP;
  context.window.App = context.__APP;

  load(context, 'blacksmith.js', 'globalThis.__SMITH=MenuBlacksmith;');
  context.MenuBlacksmith = context.__SMITH;
  context.window.MenuBlacksmith = context.__SMITH;
  load(context, 'menus_items.js', 'globalThis.__ITEM_MENU=MenuItems;');

  const App = context.__APP;
  const Smith = context.__SMITH;
  const ItemMenu = context.__ITEM_MENU;
  const master = context.window.PRISMA_BLACKSMITH_MASTER;

  assert(master, 'Blacksmith master was not registered.');
  assert.strictEqual(master.materialUpgradeRecipes.length, 40, 'Expected 5 parts x 8 rank bands.');
  assert.deepStrictEqual([...new Set(master.materialUpgradeRecipes.map(r => r.part))].sort(), ['体','武器','盾','足','頭'].sort());
  for (const recipe of master.materialUpgradeRecipes) {
    assert(recipe.id && recipe.grade && recipe.minRank <= recipe.maxRank);
    for (const targetPlus of ['2', '3']) {
      const requirements = recipe.requirementsByTargetPlus[targetPlus];
      assert(Array.isArray(requirements) && requirements.length >= 2, `${recipe.id} +${targetPlus} requirements missing.`);
      for (const req of requirements) {
        assert(req.itemId >= 2000 && req.itemId <= 2063, `Non-material ID ${req.itemId} in ${recipe.id}.`);
        assert(context.DB.ITEMS.some(item => Number(item.id) === Number(req.itemId) && item.type === '素材'), `Missing formal material ${req.itemId}.`);
      }
    }
  }
  assert.deepStrictEqual([...new Set(master.materialUpgradeRecipes.flatMap(r => Object.values(r.requirementsByTargetPlus).flat().map(req => Math.floor((req.itemId - 2000) / 8))))].sort(), [0,1,2,3,4,5,6,7]);

  const recipe = master.materialUpgradeRecipes.find(r => r.part === '武器' && r.grade === 'G');

  const originalEquipMasters = context.window.EQUIP_MASTER;
  context.window.EQUIP_MASTER = [{
    eid:9901, name:'端数試験剣', type:'武器', baseName:'剣', rank:5, data:{ atk:9, hit:7 }
  }];
  const formalPreview = Smith.buildMaterialUpgradePreview({
    id:'rounding-uid', eid:9901, name:'端数試験剣+1', type:'武器', baseName:'剣', rank:5, plus:1,
    data:{ atk:9, hit:7 }, val:1125
  });
  assert.strictEqual(formalPreview.ok, true);
  assert.strictEqual(formalPreview.nextData.atk, 11, 'Material upgrade must recalculate scalable stats from the formal equipment master, not from rounded current values.');
  assert.strictEqual(formalPreview.nextData.hit, 7, 'Non-scalable equipment data must be preserved.');
  assert.strictEqual(formalPreview.nextVal, 1500, 'Material upgrade value must follow the formal Rank/plus formula.');
  context.window.EQUIP_MASTER = originalEquipMasters;

  const target = {
    id:'equip-uid', eid:1001, name:'試験剣+1', type:'武器', baseName:'剣', rank:5, plus:1, rarity:'SSR',
    data:{ atk:110, hit:7 }, val:1000, opts:[{ key:'atk', val:5 }], traits:[{ id:1, level:2 }], locked:true,
    customMetadata:{ retained:true }
  };
  const inventory = [target];
  const itemCounts = {};
  for (const req of recipe.requirementsByTargetPlus['2']) itemCounts[req.itemId] = req.count;
  App.data = { inventory, characters:[], items:itemCounts, blacksmith:{ level:1, exp:0 }, stats:{}, system:{} };
  App.save = () => true;
  Smith.state.target = target;
  Smith.confirmMaterialUpgrade();
  await context.__lastConfirmPromise;
  assert.strictEqual(App.data.inventory[0].plus, 2);
  assert.strictEqual(App.data.inventory[0].name, '試験剣+2');
  assert.strictEqual(App.data.inventory[0].id, 'equip-uid');
  assert.deepStrictEqual(App.data.inventory[0].opts, [{ key:'atk', val:5 }]);
  assert.deepStrictEqual(App.data.inventory[0].traits, [{ id:1, level:2 }]);
  assert.strictEqual(App.data.inventory[0].locked, true);
  assert.deepStrictEqual(App.data.inventory[0].customMetadata, { retained:true });
  assert.strictEqual(App.data.stats.blacksmithMaterialUpgradeCount, 1, 'Material upgrades must be tracked in lifetime stats.');
  assert.strictEqual(App.data.stats.totalBlacksmithActions, 1, 'Material upgrades must count as blacksmith actions.');
  for (const req of recipe.requirementsByTargetPlus['2']) assert.strictEqual(Number(App.data.items[req.itemId] || 0), 0);

  const rollbackTarget = { ...target, id:'rollback-uid', name:'試験剣+1', plus:1, data:{ atk:110 }, opts:[{ key:'atk', val:9 }], traits:[{ id:2, level:1 }], locked:false };
  const rollbackCounts = {};
  for (const req of recipe.requirementsByTargetPlus['2']) rollbackCounts[req.itemId] = req.count;
  App.data = { inventory:[rollbackTarget], characters:[], items:rollbackCounts, blacksmith:{ level:1, exp:0 }, stats:{}, system:{} };
  App.save = () => false;
  Smith.state.target = rollbackTarget;
  Smith.confirmMaterialUpgrade();
  await context.__lastConfirmPromise;
  assert.strictEqual(App.data.inventory[0].name, '試験剣+1', 'Equipment was not rolled back after save failure.');
  assert.strictEqual(App.data.inventory[0].plus, 1);
  for (const req of recipe.requirementsByTargetPlus['2']) assert.strictEqual(App.data.items[req.itemId], req.count, 'Material was not rolled back.');

  const equipMasters = [
    { eid:9101, name:'鉄の剣', type:'武器', baseName:'剣', rank:10, data:{ atk:100 }, grantSkills:[11] },
    { eid:9102, name:'鋼の剣', type:'武器', baseName:'剣', rank:20, data:{ atk:180 }, grantSkills:[22] },
    { eid:9199, name:'特殊剣', type:'武器', baseName:'剣', rank:21, data:{ atk:999 }, specialEquip:true }
  ];
  context.window.EQUIP_MASTER = equipMasters;
  context.EQUIP_MASTER = equipMasters;
  const anvilItem = { id:master.divineAnvilItemId, name:'神鉄の鍛冶台' };
  const anvilEquip = {
    id:'anvil-uid', eid:9101, masterEid:9101, name:'鉄の剣+2', type:'武器', baseName:'剣', rank:10, plus:2,
    data:{ atk:130 }, val:2000, opts:[{ key:'cri', val:3 }], traits:[{ id:7, level:3 }], locked:true,
    grantSkills:[11], fixedTraitIds:[99], customMetadata:{ retained:true }
  };
  App.data = { inventory:[anvilEquip], characters:[], items:{ [anvilItem.id]:1 }, stats:{}, system:{} };
  App.save = () => true;
  ItemMenu.confirmDivineAnvilUse(anvilItem, anvilEquip);
  await context.__lastConfirmPromise;
  const transformed = App.data.inventory[0];
  assert.strictEqual(transformed.id, 'anvil-uid');
  assert.strictEqual(transformed.eid, 9102);
  assert.strictEqual(transformed.rank, 20);
  assert.strictEqual(transformed.name, '鋼の剣+2');
  assert.deepStrictEqual(transformed.opts, [{ key:'cri', val:3 }]);
  assert.deepStrictEqual(transformed.traits, [{ id:7, level:3 }]);
  assert.strictEqual(transformed.locked, true);
  assert.deepStrictEqual(transformed.fixedTraitIds, [99]);
  assert.deepStrictEqual(transformed.customMetadata, { retained:true });
  assert.deepStrictEqual(transformed.grantSkills, [22], 'Formal target fixed skill was not applied cleanly.');
  assert.strictEqual(Number(App.data.items[anvilItem.id] || 0), 0);

  const specialPreview = ItemMenu.buildDivineAnvilPreview({ ...anvilEquip, eid:9199, masterEid:9199, name:'特殊剣', rank:21 });
  assert.strictEqual(specialPreview.ok, false, 'Special equipment should not be eligible.');

  console.log('Phase2G blacksmith regression tests passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
