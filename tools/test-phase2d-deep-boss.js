const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
function seededRandom(seed = 0x2d202608) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const math = Object.create(Math);
math.random = seededRandom();
const context = {
  console,
  Math: math,
  window: {},
  document: undefined,
  DB: { SKILLS: [] },
  CONST: { ELEMENTS: ['火','水','風','雷','光','闇','混沌'] },
  App: { data:{}, getChar:()=>null },
  Field: {},
  Dungeon: {},
  setTimeout,
  clearTimeout,
};
context.globalThis = context;
context.window = context;
context.Monster = class Monster {
  constructor(base) {
    Object.assign(this, JSON.parse(JSON.stringify(base || {})));
    this.hp = Number(base?.hp || 1);
    this.mp = Number(base?.mp || 0);
    this.mdef = Number(base?.mdef || base?.mag || 1);
    this.baseStats = {
      atk:Number(base?.atk || 1), def:Number(base?.def || 1),
      spd:Number(base?.spd || 1), mag:Number(base?.mag || 1),
    };
    this.traits = JSON.parse(JSON.stringify(base?.traits || []));
    this.resists = JSON.parse(JSON.stringify(base?.resists || {}));
    this.elmRes = JSON.parse(JSON.stringify(base?.elmRes || {}));
  }
};
vm.createContext(context);
function run(file, suffix = '') {
  vm.runInContext(`${fs.readFileSync(path.join(root, file), 'utf8')}\n${suffix}`, context, { filename:file });
}
run('skills.js');
context.DB.SKILLS = context.SKILLS_DATA;
run('monsters.js', 'globalThis.MonsterData = MonsterData;');
run('abyss_content.js');
run('passiveSkill.js', 'globalThis.PassiveSkill = PassiveSkill;');
run('battle.js', 'globalThis.Battle = Battle;');
context.Battle.initBattleStatus = () => {};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const familyBySkill = new Map();
for (const family of context.ABYSS_REGION_CONTENT.deepBossSkillFamilies) {
  for (const id of family.skillIds) {
    if (!familyBySkill.has(Number(id))) familyBySkill.set(Number(id), family.id);
  }
}
assert(context.ABYSS_REGION_CONTENT.deepBossSkillFamilies.length >= 50, 'スキル系統マスターが不足しています。');
for (const id of [58,59,60]) {
  for (const pool of Object.values(context.ABYSS_REGION_CONTENT.deepBossRoleTraitPools)) {
    assert(!pool.includes(id), `永続成長特性${id}が深層ボス追加プールに含まれています。`);
  }
}

const base = {
  id:502001, name:'火の大精霊', rank:112, hp:39000, mp:1000,
  atk:480, def:500, spd:370, mag:590, mdef:510,
  hit:100, eva:5, cri:5, exp:5000, gold:2000, isBoss:true,
  acts:[
    {id:1,rate:20,condition:0}, {id:224,rate:20,condition:0},
    {id:233,rate:25,condition:0}, {id:310,rate:20,condition:0},
    {id:503,rate:15,condition:0}
  ],
  traits:[{id:19,level:5},{id:52,level:3}],
  resists:{Poison:100,Fear:200,InstantDeath:200},
  elmRes:{火:70,水:-20}
};
const enhanced = context.Battle.createDeepFloorMonster(base, 201, true);
assert(enhanced.deepEnhancementVersion === 2, '新しい深層ボス強化版が付与されていません。');
for (const act of base.acts) {
  assert(enhanced.acts.some(current => Number(current.id) === Number(act.id)), `元スキル${act.id}が失われました。`);
}
const additions = enhanced.acts.filter(act => act.deepUpgradeOf !== undefined);
assert(additions.length >= 1 && additions.length <= 3, `強化技追加数が不正です: ${additions.length}`);
for (const act of additions) {
  assert(familyBySkill.get(Number(act.id)) === familyBySkill.get(Number(act.deepUpgradeOf)),
    `元技${act.deepUpgradeOf}と追加技${act.id}が別系統です。`);
}
assert(enhanced.elmRes['火'] === 85, `火耐性が元値を基準に強化されていません: ${enhanced.elmRes['火']}`);
assert(enhanced.elmRes['水'] === -5, `弱点耐性が元値を維持して加算されていません: ${enhanced.elmRes['水']}`);
assert(enhanced.elmRes['風'] === 15, `未設定属性の基礎0からの加算が不正です: ${enhanced.elmRes['風']}`);
assert(enhanced.resists.Poison === 115, `状態耐性の追加強化が不正です: ${enhanced.resists.Poison}`);
assert(enhanced.traits.find(t => t.id === 19)?.level > 5, '既存特性レベルが強化されていません。');
assert(enhanced.traits.some(t => t.deepAdded), '役割特性が追加されていません。');
assert(!enhanced.traits.some(t => t.deepAdded && [1,2,3,4,5,7,8,9,58,59,60].includes(Number(t.id))),
  '武器・永続成長特性がランダム追加されています。');

const weakFireBase = {
  ...base, id:999001, name:'火術試験体', rank:100,
  acts:[{id:200,rate:100,condition:0}], traits:[], resists:{}, elmRes:{火:20}
};
const floor101 = context.Battle.createDeepFloorMonster(weakFireBase, 101, true);
assert(floor101.acts.some(act => Number(act.id) === 207 && Number(act.deepUpgradeOf) === 200),
  '初級火術から同系統の中級火術が追加されていません。');
assert(!floor101.acts.some(act => act.deepUpgradeOf !== undefined && familyBySkill.get(Number(act.id)) !== 'magic_fire_single'),
  '無関係な高位技が追加されています。');

const reportRows = [];
const sampleCases = [
  [302010,151], [302040,201], [502001,201], [401200,301]
];
for (const [monsterId, floor] of sampleCases) {
  const source = context.MonsterData.getMonsterById(monsterId);
  assert(source, `差分確認用ボス${monsterId}が見つかりません。`);
  const generated = context.Battle.createDeepFloorMonster(source, floor, true);
  const sourceIds = (source.acts || []).map(act => Number(act.id));
  for (const sourceId of sourceIds) assert(generated.acts.some(act => Number(act.id) === sourceId), `${monsterId}: 元技${sourceId}が失われました。`);
  const added = generated.acts.filter(act => act.deepUpgradeOf !== undefined);
  for (const act of added) {
    assert(familyBySkill.get(Number(act.id)) === familyBySkill.get(Number(act.deepUpgradeOf)), `${monsterId}: 異系統技${act.id}が追加されました。`);
  }
  const skillName = id => context.DB.SKILLS.find(skill => Number(skill.id) === Number(id))?.name || String(id);
  reportRows.push({
    monsterId,
    name:source.name,
    floor,
    originalSkills:sourceIds.map(skillName).join(' / '),
    addedSkills:added.map(act => `${skillName(act.id)}←${skillName(act.deepUpgradeOf)}`).join(' / ') || 'なし',
    originalTraits:(source.traits || []).map(trait => `${trait.id}:Lv${trait.level || trait.lv || 1}`).join(' / ') || 'なし',
    enhancedTraits:(generated.traits || []).map(trait => `${trait.id}:Lv${trait.level || trait.lv || 1}${trait.deepAdded ? '(追加)' : ''}`).join(' / ') || 'なし',
    statusBonus:generated.deepStatusResistBonus,
    elementBonus:generated.deepElementResistBonus,
  });
}

if (process.env.WRITE_DEEP_BOSS_REPORT === '1') {
  const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const headers = Object.keys(reportRows[0]);
  const csv = [headers.join(','), ...reportRows.map(row => headers.map(key => quote(row[key])).join(','))].join('\n') + '\n';
  fs.writeFileSync(path.join(root, 'docs', 'DEEP_BOSS_ENHANCEMENT_SAMPLES_20260803.csv'), csv, 'utf8');
}

console.log(`Phase2D深層ボス強化検証: OK（系統 ${context.ABYSS_REGION_CONTENT.deepBossSkillFamilies.length} / 合成例 ${reportRows.length} / 役割 ${enhanced.deepBossRoles.join(',')}）`);
