const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const context = {
    console,
    App: { data: { party: [], characters: [] } },
    Monster: function Monster() {}
};
vm.createContext(context);
vm.runInContext(`${fs.readFileSync(path.join(ROOT, 'passiveSkill.js'), 'utf8')}\nthis.__PS__ = PassiveSkill;`, context, {
    filename: 'passiveSkill.js'
});

const PS = context.__PS__;
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

const legacy = {
    traits: [{ id: '38', level: 2 }],
    disabledTraits: ['38', '38', 'invalid'],
    equips: {},
    weaponTypes: []
};
PS.normalizeDisabledTraits(legacy);
check(JSON.stringify(legacy.disabledTraits) === '[38]', `旧セーブの無効特性IDを数値へ正規化できません: ${JSON.stringify(legacy.disabledTraits)}`);
check(PS.getSumValue(legacy, 'aura_front_atk_pct') === 0, '文字列で保存された無効特性が発動しています');

context.App.data.party = ['legacy-party-member'];
context.App.data.characters = [{ uid: 'legacy-party-member', traits: [{ id: '38', level: 2 }], disabledTraits: ['38'], equips: {} }];
check(PS.getPartySumValue('aura_front_atk_pct') === 0, 'パーティ集計で文字列IDの無効特性が発動しています');

const lateBloomer = {
    traits: [{ id: 58, level: 1 }],
    disabledTraits: ['58'],
    equips: {},
    weaponTypes: []
};
PS.normalizeDisabledTraits(lateBloomer);
check(lateBloomer.disabledTraits.length === 0, '固定ONの大器晩成が旧セーブ値で無効化されています');

const formulaCases = [
    { id: 18, level: 2, canonical: 'guts_rate', alias: 'guts_mult', expected: 26 },
    { id: 31, level: 2, canonical: 'proc_curse_add', alias: 'proc_curse_bonus', expected: 16 },
    { id: 32, level: 2, canonical: 'proc_body_add', alias: 'proc_body_bonus', expected: 14 },
    { id: 61, level: 2, canonical: 'proc_instantdeath_add', alias: 'proc_instantdeath_bonus', expected: 12 }
];
formulaCases.forEach(test => {
    const entity = { traits: [{ id: test.id, level: test.level }], disabledTraits: [], equips: {}, weaponTypes: [] };
    const canonical = PS.getSumValue(entity, test.canonical);
    const alias = PS.getSumValue(entity, test.alias);
    check(canonical === test.expected && alias === test.expected,
        `特性${test.id}の正規キー／互換キーが不一致です (${canonical}/${alias}, expected ${test.expected})`);
});

const sharedTraitEquip = { type: '武器', traits: [{ id: 56, level: 3 }] };
const aliasedEquipEntity = {
    traits: [], disabledTraits: [], weaponTypes: [],
    equips: { 武器: sharedTraitEquip, weapon: sharedTraitEquip }
};
check(PS.getUniqueEquips(aliasedEquipEntity).length === 1,
    '同一装備オブジェクトの互換キー参照を一意化できません');
check(PS.getSumValue(aliasedEquipEntity, 'drop_normal_pct') === 3,
    '同一装備の特性が個人集計へ二重加算されます');
context.App.data.party = ['aliased-equip-member'];
context.App.data.characters = [{ uid: 'aliased-equip-member', ...aliasedEquipEntity }];
check(PS.getPartySumValue('drop_normal_pct') === 3,
    '同一装備の特性がパーティ集計へ二重加算されます');

if (errors.length) {
    console.error(`FAIL: 特性互換監査 ${errors.length}件`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}
console.log('PASS: 特性互換監査（無効ID正規化・固定ON）');
