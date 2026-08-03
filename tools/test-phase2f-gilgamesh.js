#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const context = {
  console,
  Math: Object.create(Math),
  Date, JSON, Number, String, Array, Object, Map, Set, WeakMap, Promise, Intl,
  setTimeout, clearTimeout,
  window: null,
  globalThis: null,
  document: undefined,
  DB: {
    MONSTERS: [], SKILLS: [], EQUIPS: [], CHARACTERS: [], SYNERGIES: [], OPT_RULES: [],
    ITEMS: [
      { id: 98, name: '災厄の楔' },
      { id: 106, name: 'スキルのたね' },
      { id: 107, name: '転生の実' },
      { id: 599999, name: '合成の壺' }
    ]
  },
  CONST: { ELEMENTS:['火','水','風','雷','光','闇','混沌'] },
  Field: { currentMapData: null },
  Dungeon: {},
  App: {
    data: {
      progress:{floor:300,flags:{}}, location:{area:'ABYSS'}, dungeon:{},
      battle:{active:true,battleId:'gil-test-1',isBossBattle:true,isSpecialBoss:true,fixedBossId:902000},
      book:{killCounts:{}}, items:{98:1}, inventory:[], characters:[], party:[], gems:0
    },
    addOrLimitBreakMonsterAlly(){ return { ok:true, existing:false, message:'ギルガメッシュが仲間に加わった！' }; }
  },
  PassiveSkill: { getSumValue(){ return 0; } }
};
context.window = context;
context.globalThis = context;
context.Monster = class Monster {
  constructor(base, scale = 1) {
    this.id = base.id;
    this.baseId = base.id;
    this.name = base.name;
    this.hp = Math.floor(Number(base.hp || 1) * scale);
    this.baseMaxHp = this.hp;
    this.mp = Math.floor(Number(base.mp || 0) * scale);
    this.baseMaxMp = this.mp;
    this.baseStats = {
      atk:Math.floor(Number(base.atk || 0) * scale),
      def:Math.floor(Number(base.def || 0) * scale),
      spd:Math.floor(Number(base.spd || 0) * scale),
      mag:Math.floor(Number(base.mag || 0) * scale),
      mdef:Math.floor(Number(base.mdef || 0) * scale)
    };
    this.atk=this.baseStats.atk; this.def=this.baseStats.def; this.spd=this.baseStats.spd;
    this.mag=this.baseStats.mag; this.mdef=this.baseStats.mdef;
    this.acts=JSON.parse(JSON.stringify(base.acts || []));
    this.actCount=Number(base.actCount || 1);
    this.traits=JSON.parse(JSON.stringify(base.traits || []));
    this.resists=JSON.parse(JSON.stringify(base.resists || {}));
    this.elmRes=JSON.parse(JSON.stringify(base.elmRes || {}));
    this.isBoss=!!base.isBoss; this.isRare=!!base.isRare;
    this.isEstark=!!base.isEstark; this.isSpecialBoss=!!(base.isSpecialBoss || base.isEstark);
  }
};
vm.createContext(context);
vm.runInContext(`${read('monsters.js')}\nglobalThis.MonsterData=MonsterData;`, context, {filename:'monsters.js'});
context.DB.MONSTERS = context.MONSTERS_DATA;
vm.runInContext(`${read('battle.js')}\nglobalThis.Battle=Battle;`, context, {filename:'battle.js'});
context.Battle.initBattleStatus = () => {};
context.Battle.log = () => {};

const gil = context.MonsterData.getMonsterById(902000);
assert(gil, 'ギルガメッシュのマスターがありません。');
assert.strictEqual(gil.allyGrowthType, 'ALL_SPECIAL');
assert.strictEqual(gil.exp, 999999);
assert.strictEqual(gil.gold, 999999);
assert.strictEqual(gil.specialBossRules.statScalePerDefeat, 0.2);
assert.strictEqual(gil.specialBossRules.recruitBaseRate, 0.05);
assert.strictEqual(gil.specialBossRules.recruitRatePerDefeat, 0.05);

assert.strictEqual(context.Battle.getSpecialBossScale(gil, 0), 1);
assert.strictEqual(context.Battle.getSpecialBossScale(gil, 1), 1.2);
assert.strictEqual(context.Battle.getSpecialBossScale(gil, 2), 1.4);
assert.strictEqual(context.Battle.getSpecialBossRecruitChance(gil, 1), 0.05);
assert.strictEqual(context.Battle.getSpecialBossRecruitChance(gil, 2), 0.10);
assert.strictEqual(context.Battle.getSpecialBossRecruitChance(gil, 10), 0.50);
assert.strictEqual(context.Battle.getSpecialBossRecruitChance(gil, 20), 1);
assert.strictEqual(context.Battle.getSpecialBossRecruitChance(gil, 30), 1);

context.App.data.book.killCounts[902000] = 2;
const generated = context.Battle.generateNewEnemies(true, 902000);
assert.strictEqual(generated.length, 1);
assert.strictEqual(generated[0].specialBossDefeatsAtStart, 2);
assert.strictEqual(generated[0].specialBossScale, 1.4);
assert.strictEqual(generated[0].baseMaxHp, Math.floor(gil.hp * 1.4));
assert.strictEqual(generated[0].atk, Math.floor(gil.atk * 1.4));
assert.strictEqual(generated[0].storyBossStatMultiplier ?? 1, 1, '深層・物語ボス倍率が重複しています。');
const snapshot = context.Battle.serializeEnemyState(generated[0]);
const restoredBase = new context.Monster(gil, 1);
const restored = context.Battle.restoreEnemyState(restoredBase, snapshot, gil);
assert.strictEqual(restored.specialBossScale, 1.4);
assert.strictEqual(restored.specialBossDefeatsAtStart, 2);
assert.strictEqual(restored.baseMaxHp, generated[0].baseMaxHp);

let recruitCalls = 0;
context.App.addOrLimitBreakMonsterAlly = () => {
  recruitCalls += 1;
  return { ok:true, existing:false, message:'加入成功' };
};
const sequence = [0.05, 0.99, 0.05, 0.01];
context.Math.random = () => sequence.shift() ?? 0.99;
context.App.data.battle = { active:false, battleId:'gil-outcome-1' };
context.App.data.items = {98:1};
context.App.data.inventory = [];
context.App.data.gems = 0;
const drops = [];
const outcome = context.Battle.applySpecialBossVictoryOutcome(generated[0], {
  completedDefeats:1,
  drops,
  bonusRare:0,
  bonusNormal:0,
  createEquipment(){ return {name:'試験用EX装備',val:100,opts:[]}; }
});
assert.strictEqual(context.App.data.items[98], 0, '勝利時に災厄の楔が消費されていません。');
assert.strictEqual(context.App.data.gems, 10000);
assert.strictEqual(context.App.data.inventory.length, 1);
assert.strictEqual(context.App.data.inventory[0].val, 300);
assert(context.App.data.inventory[0].name.startsWith('【EX】'));
assert.strictEqual(context.App.data.items[107], 1, '転生の実の独立抽選が反映されていません。');
assert.strictEqual(context.App.data.items[599999], 1, '合成の壺が転生の実と同率で独立抽選されていません。');
assert.strictEqual(context.App.data.items[106] || 0, 0);
assert.strictEqual(outcome.recruitChance, 0.05);
assert.strictEqual(outcome.recruitSucceeded, true);
assert.strictEqual(recruitCalls, 1);
assert(drops.some(drop => drop.name.includes('EX装備')));
assert(drops.some(drop => drop.name === '転生の実'));
assert(drops.some(drop => drop.name === '合成の壺'));

const duplicate = context.Battle.applySpecialBossVictoryOutcome(generated[0], {
  completedDefeats:1, drops, createEquipment(){ throw new Error('二重生成'); }
});
assert.strictEqual(duplicate.reused, true);
assert.strictEqual(context.App.data.gems, 10000, '同一戦闘でGEMが二重付与されました。');
assert.strictEqual(context.App.data.inventory.length, 1, '同一戦闘で装備が二重付与されました。');
assert.strictEqual(recruitCalls, 1, '同一戦闘で加入・LB判定が二重実行されました。');

context.App.data.battle = { active:false, battleId:'gil-outcome-lb' };
context.App.data.items = {98:1};
context.App.data.inventory = [];
context.App.data.gems = 0;
context.Math.random = (() => { const values=[0.99,0.99,0.99,0.01]; return () => values.shift() ?? 0.99; })();
context.App.addOrLimitBreakMonsterAlly = () => ({ok:true,existing:true,lbChanged:true,message:'LBが上がった！'});
const lbOutcome = context.Battle.applySpecialBossVictoryOutcome(generated[0], {
  completedDefeats:2, drops:[], createEquipment(){return {name:'LB試験装備',val:1,opts:[]};}
});
assert.strictEqual(lbOutcome.recruitChance, 0.10);
assert.strictEqual(lbOutcome.recruitExisting, true);
assert.strictEqual(lbOutcome.limitBreakChanged, true);

context.App.data.battle = { active:false, battleId:'gil-missing-wedge' };
context.App.data.items = {98:0};
assert.throws(() => context.Battle.applySpecialBossVictoryOutcome(generated[0], {
  completedDefeats:1, drops:[], createEquipment(){return {name:'不正',val:1,opts:[]};}
}), /勝利時消費アイテム/);

const battleSource = read('battle.js');
assert(battleSource.includes('specialBossOutcome: specialBossOutcome ?'), '戦闘結果ジャーナルに裏ボス結果が記録されていません。');
assert(battleSource.includes('requiredItemConsumed'), '災厄の楔消費結果が記録されていません。');
assert.strictEqual((battleSource.match(/Battle\.applySpecialBossVictoryOutcome\(specialEnemy/g) || []).length, 1,
  '裏ボス勝利結果の適用箇所が複数あります。');

console.log('Phase2Fギルガメッシュ検証: OK（加入 5%×討伐数 / 全能力20%×過去討伐数 / 勝利結果一括確定）');
