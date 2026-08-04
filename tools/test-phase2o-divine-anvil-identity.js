#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(process.argv[2] || process.env.PRISMA_ROOT || path.join(__dirname, '..'));
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const context = {
  console,
  Math,
  Date,
  JSON,
  Number,
  String,
  Array,
  Object,
  Map,
  Set,
  WeakMap,
  Promise,
  window: { ITEMS_DATA: [], EQUIP_MASTER: [] },
  document: { getElementById() { return null; }, createElement() { return {}; } },
  DB: { ITEMS: [] },
  App: null,
  Menu: null,
  MenuBlacksmith: null,
  globalThis: null
};
context.globalThis = context;
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(read('equips.js'), context, { filename:'equips.js' });
context.window.EQUIP_MASTER = vm.runInContext('EQUIP_MASTER', context);
vm.runInContext(read('blacksmith_master.js'), context, { filename:'blacksmith_master.js' });

context.MenuBlacksmith = {
  findEquipmentMaster(equip) {
    const masters = context.window.EQUIP_MASTER;
    const eid = Number(equip?.eid ?? equip?.masterEid);
    return masters.find(entry => Number(entry.eid) === eid) || null;
  },
  getBaseStatSummary() { return ''; }
};
context.window.MenuBlacksmith = context.MenuBlacksmith;

let confirmMessage = '';
let resultMessage = '';
context.Menu = {
  confirm(message, callback) {
    confirmMessage = message;
    callback();
  },
  msg(message, callback) {
    resultMessage = message;
    callback?.();
  },
  renderPartyBar() {},
  compareEquipmentByRank() { return 0; }
};
context.window.Menu = context.Menu;

const app = {
  data: null,
  runAtomicSaveMutation(mutator) {
    const snapshot = JSON.parse(JSON.stringify(this.data));
    try {
      const result = mutator();
      if (result?.ok === false) {
        this.data = snapshot;
        return { ok:false, result, reason:result.reason };
      }
      return { ok:true, result };
    } catch (error) {
      this.data = snapshot;
      return { ok:false, error };
    }
  },
  refreshAllSynergies() {},
  incrementLifetimeStat(key, value) {
    this.data.stats ||= {};
    this.data.stats[key] = Number(this.data.stats[key] || 0) + Number(value || 0);
  }
};
context.App = app;
context.window.App = app;
vm.runInContext(`${read('menus_items.js')}\nglobalThis.MenuItems = MenuItems;`, context, { filename:'menus_items.js' });
const MenuItems = context.MenuItems;
MenuItems.playUseSe = () => {};
MenuItems.changeScreen = () => {};

const source = read('menus_items.js');
const confirmStart = source.indexOf('confirmDivineAnvilUse:');
const confirmEnd = source.indexOf('\n    getSkillBookOwnedCharacters:', confirmStart);
assert(confirmStart >= 0 && confirmEnd > confirmStart, '神鉄確定処理を抽出できません。');
const confirmSource = source.slice(confirmStart, confirmEnd);
for (const forbidden of ['equip.eid =', 'equip.masterEid =', 'equip.name =', 'equip.type =', 'equip.baseName =', 'equip.possibleOpts =', 'equip.grantSkills =', 'equip.opts =', 'equip.traits =']) {
  assert(!confirmSource.includes(forbidden), `神鉄処理が保持対象を書き換えています: ${forbidden}`);
}
assert(confirmSource.includes('equip.rank = Number(live.target.rank)'), '神鉄処理がRankを更新していません。');
assert(confirmSource.includes('equip.data = live.nextData'), '神鉄処理が基礎能力を更新していません。');

const dragonMaster = context.window.EQUIP_MASTER.find(entry => Number(entry.eid) === 101);
assert(dragonMaster?.name === 'ドラゴンキラー', '正式ドラゴンキラーマスターが見つかりません。');
assert.deepStrictEqual(JSON.parse(JSON.stringify(dragonMaster.traits)), [{ id:36, level:5 }], 'ドラゴンキラー固有特性が想定外です。');

const anvilId = context.window.PRISMA_BLACKSMITH_MASTER.divineAnvilItemId;
const dragon = {
  id:'dragon-favorite-001',
  eid:101,
  masterEid:101,
  rank:50,
  name:'ドラゴンキラー+3',
  type:'武器',
  baseName:'剣',
  plus:3,
  val:37500,
  data:{ atk:27, hit:10, elmAtk:{ 炎:8 } },
  opts:[{ key:'cri', label:'会心率', val:9, unit:'%', rarity:'UR' }],
  traits:[{ id:36, level:5 }, { id:88, level:2 }],
  possibleOpts:['atk','cri'],
  grantSkills:[777],
  locked:true,
  source:'favorite',
  customMetadata:{ note:'keep-all' }
};
app.data = { inventory:[dragon], characters:[], items:{ [anvilId]:2 }, stats:{}, system:{} };

const firstPreview = MenuItems.buildDivineAnvilPreview(dragon);
assert.strictEqual(firstPreview.ok, true);
assert.strictEqual(firstPreview.currentRank, 50);
assert.strictEqual(firstPreview.target.rank, 60);
assert.strictEqual(firstPreview.newName, 'ドラゴンキラー+3');
assert.strictEqual(firstPreview.nextData.atk, 33, 'Rank50→60の攻撃力が同系統基準で伸びていません。');
assert.strictEqual(firstPreview.nextData.hit, 10, '命中補正を変更しています。');
assert.deepStrictEqual(JSON.parse(JSON.stringify(firstPreview.nextData.elmAtk)), { 炎:8 }, '属性補正を変更しています。');

MenuItems.confirmDivineAnvilUse({ id:anvilId, name:'神鉄の鍛冶台' }, dragon);
assert(confirmMessage.includes('名称・固有特性・固有スキル・ランダムオプション・特性'), '確認画面に保持内容が明記されていません。');
assert.strictEqual(dragon.rank, 60);
assert.strictEqual(dragon.eid, 101);
assert.strictEqual(dragon.masterEid, 101);
assert.strictEqual(dragon.name, 'ドラゴンキラー+3');
assert.deepStrictEqual(JSON.parse(JSON.stringify(dragon.opts)), [{ key:'cri', label:'会心率', val:9, unit:'%', rarity:'UR' }]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(dragon.traits)), [{ id:36, level:5 }, { id:88, level:2 }]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(dragon.possibleOpts)), ['atk','cri']);
assert.deepStrictEqual(JSON.parse(JSON.stringify(dragon.grantSkills)), [777]);
assert.strictEqual(dragon.locked, true);
assert.strictEqual(dragon.source, 'favorite');
assert.deepStrictEqual(JSON.parse(JSON.stringify(dragon.customMetadata)), { note:'keep-all' });
assert.strictEqual(dragon.data.atk, 33);
assert.strictEqual(dragon.data.hit, 10);
assert.deepStrictEqual(JSON.parse(JSON.stringify(dragon.data.elmAtk)), { 炎:8 });
assert.strictEqual(Number(app.data.items[anvilId] || 0), 1);
assert(resultMessage.includes('Rankが 60 に上がりました'), '完了メッセージがRank強化を示していません。');

const secondPreview = MenuItems.buildDivineAnvilPreview(dragon);
assert.strictEqual(secondPreview.currentRank, 60, '再使用時に元マスターRankへ戻っています。');
assert.strictEqual(secondPreview.target.rank, 70);
assert.strictEqual(secondPreview.nextData.atk, 41, 'Rank60→70の継続成長が正しくありません。');
MenuItems.confirmDivineAnvilUse({ id:anvilId, name:'神鉄の鍛冶台' }, dragon);
assert.strictEqual(dragon.rank, 70);
assert.strictEqual(dragon.data.atk, 41);
assert.strictEqual(dragon.name, 'ドラゴンキラー+3');
assert.deepStrictEqual(JSON.parse(JSON.stringify(dragon.traits)), [{ id:36, level:5 }, { id:88, level:2 }]);
assert.strictEqual(Number(app.data.items[anvilId] || 0), 0);
assert.strictEqual(app.data.stats.divineAnvilUses, 2);

const itemSource = read('items.js');
assert(itemSource.includes('名称・固有特性・固有スキル・ランダムオプションと特性を保ったまま'), '神鉄アイテム説明が新仕様へ更新されていません。');
assert.strictEqual(context.window.PRISMA_BLACKSMITH_MASTER.divineAnvilPreserveEquipmentIdentity, true);
assert.strictEqual(context.window.PRISMA_BLACKSMITH_MASTER.divineAnvilPreserveNonScalableStats, true);

// 正式通常装備を横断し、強化可能な全個体で「同じデータキーのまま、成長対象だけが上がる」ことを確認する。
const scalableKeys = new Set(context.window.PRISMA_BLACKSMITH_MASTER.scalableStatKeys);
let auditedEquipmentCount = 0;
for (const master of context.window.EQUIP_MASTER) {
  if (!master || master.specialEquip === true || master.noRandom === true || /^真・/.test(String(master.name || ''))) continue;
  const hasHigherFamilyMaster = context.window.EQUIP_MASTER.some(candidate =>
    candidate && candidate.specialEquip !== true && candidate.noRandom !== true
    && String(candidate.type || '') === String(master.type || '')
    && String(candidate.baseName || '') === String(master.baseName || '')
    && Number(candidate.rank || 0) > Number(master.rank || 0)
  );
  if (!hasHigherFamilyMaster) continue;
  const equip = {
    id:`audit-${master.eid}`,
    eid:master.eid,
    masterEid:master.eid,
    rank:master.rank,
    name:master.name,
    type:master.type,
    baseName:master.baseName,
    plus:0,
    data:JSON.parse(JSON.stringify(master.data || {})),
    opts:[{ key:'audit', val:1 }],
    traits:[...(JSON.parse(JSON.stringify(master.traits || []))), { id:999999, level:1 }],
    possibleOpts:JSON.parse(JSON.stringify(master.possibleOpts || [])),
    grantSkills:JSON.parse(JSON.stringify(master.grantSkills || []))
  };
  const preview = MenuItems.buildDivineAnvilPreview(equip);
  assert.strictEqual(preview.ok, true, `${master.name}の神鉄プレビューを作成できません。`);
  assert(Number(preview.target.rank) > Number(master.rank), `${master.name}のRankが上昇していません。`);
  assert.deepStrictEqual(Object.keys(preview.nextData).sort(), Object.keys(equip.data).sort(), `${master.name}の固有ステータス構造が変化しました。`);
  let grew = false;
  for (const [key, value] of Object.entries(equip.data)) {
    if (scalableKeys.has(key) && typeof value === 'number' && value > 0) {
      assert(preview.nextData[key] > value, `${master.name}の${key}が向上していません。`);
      grew = true;
    } else {
      assert.deepStrictEqual(JSON.parse(JSON.stringify(preview.nextData[key])), JSON.parse(JSON.stringify(value)), `${master.name}の固有値${key}が変化しました。`);
    }
  }
  assert(grew, `${master.name}に成長対象の固有ステータスがありません。`);
  auditedEquipmentCount++;
}
assert(auditedEquipmentCount >= 200, `神鉄横断監査対象が少なすぎます: ${auditedEquipmentCount}`);

console.log(`[Phase2O] divine anvil identity-preserving Rank growth: PASS (${auditedEquipmentCount} formal equipment transitions audited)`);
