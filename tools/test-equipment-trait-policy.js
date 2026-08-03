#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'passiveSkill.js'), 'utf8');
const context = {
  console,
  Math: Object.create(Math),
  Number, String, Array, Object, Set, Map, WeakSet,
  window: {},
  globalThis: null
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source}\nglobalThis.__PASSIVE = PassiveSkill;`, context, { filename:'passiveSkill.js' });
const PassiveSkill = context.__PASSIVE;

const common = [19, 22, 46, 47, 33, 34, 35, 36, 23, 24, 25, 26, 27, 28, 29];
const specific = {
  '剣': [1, 10, 12, 49, 8],
  '槍': [2, 10, 12, 48, 9],
  '斧': [3, 10, 12, 49, 9],
  '短剣': [4, 10, 11, 12, 48, 49, 61, 8],
  '弓': [5, 6, 10, 11, 12, 9],
  '杖': [7, 11, 12, 50]
};

for (const [baseName, ids] of Object.entries(specific)) {
  const actual = PassiveSkill.getEquipmentTraitCandidateIds({ type:'武器', baseName });
  const expected = [...new Set([...common, ...ids])];
  assert.deepStrictEqual([...actual].sort((a,b)=>a-b), expected.sort((a,b)=>a-b), `${baseName} trait pool mismatch`);
}

for (const id of [58, 59, 60]) {
  assert(!PassiveSkill.getEquipmentTraitCandidateIds({ type:'武器', baseName:'剣' }).includes(id));
  assert(!PassiveSkill.getEquipmentTraitCandidateIds({ type:'防具', baseName:'鎧' }).includes(id));
}

const sword = { type:'武器', baseName:'剣', traits:[{ id:19, level:1 }] };
context.Math.random = () => 0;
const rolled = PassiveSkill.generateEquipmentTraits({ equipment:sword, countMin:4, countMax:4, lvMin:1, lvMax:1 });
assert.strictEqual(rolled.length, 4);
assert(!rolled.some(trait => trait.id === 19), 'Fixed/current traits must not be duplicated by a random roll.');
assert(rolled.every(trait => PassiveSkill.getEquipmentTraitCandidateIds(sword).includes(trait.id)));
assert.strictEqual(new Set(rolled.map(trait => trait.id)).size, rolled.length);

console.log('PASS: equipment random trait policy');
