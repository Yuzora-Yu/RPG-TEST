#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monsters.js'), 'utf8');
const context = vm.createContext({ window: {} });
vm.runInContext(`${source}\nthis.__monsters = MONSTERS_DATA;`, context, { filename: 'monsters.js' });
const monsters = context.__monsters;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const byId = new Map(monsters.map(monster => [Number(monster.id), monster]));

assert(source.includes('direct-master-balance: rank120-plus-stats-exp-v1 / story-spirit-boss-v1'),
    'Rank120以降の直接マスター調整識別子がありません。');

const lateNormals = monsters.filter(monster => {
    const rank = Number(monster.rank || 0);
    return !monster.isBoss && rank >= 120 && rank <= 200 && Number(monster.id) !== 200204;
});
assert(lateNormals.length === 75, `Rank120以降の調整対象通常敵が75体ではありません: ${lateNormals.length}`);
assert(lateNormals.every(monster => Number(monster.hp) >= 2300), 'Rank120以降の通常敵HP強化が不足しています。');
assert(lateNormals.every(monster => Number(monster.exp) <= 22000), 'Rank120以降の通常敵EXPに過大値が残っています。');

const snapshots = {
    1160: { hp: 4844, atk: 556, def: 419, mag: 562, mdef: 422, spd: 323, exp: 3750 },
    1201: { hp: 2830, atk: 520, def: 350, mag: 315, mdef: 325, spd: 261, exp: 2300 },
    1454: { hp: 4328, atk: 660, def: 459, mag: 670, mdef: 486, spd: 363, exp: 7500 },
    1753: { hp: 9326, atk: 880, def: 725, mag: 880, mdef: 699, spd: 493, exp: 14600 },
    1955: { hp: 12932, atk: 1562, def: 1013, mag: 1506, mdef: 966, spd: 526, exp: 12800 },
    120303: { hp: 17550, atk: 1416, def: 1507, mag: 1531, mdef: 1565, spd: 724, exp: 19550 }
};
for (const [idText, expected] of Object.entries(snapshots)) {
    const monster = byId.get(Number(idText));
    assert(monster, `調整対象モンスター ${idText} がありません。`);
    for (const [key, value] of Object.entries(expected)) {
        assert(Number(monster[key]) === value, `${monster.name} ${key} が期待値 ${value} ではありません。`);
    }
}

const bossTargets = {
    302070: { hp: 48000, exp: 35000 },
    302080: { hp: 22000, exp: 8000 },
    302081: { hp: 21500, exp: 8000 },
    302082: { hp: 23000, exp: 8000 },
    302083: { hp: 23000, exp: 8000 },
    302084: { hp: 27000, exp: 8000 },
    302100: { hp: 62000, exp: 30000 },
    302101: { hp: 92000, exp: 45000 },
    502001: { hp: 39000, exp: 30000 },
    502002: { hp: 39000, exp: 30000 },
    502003: { hp: 38000, exp: 30000 },
    502004: { hp: 39000, exp: 30000 },
    502005: { hp: 40000, exp: 30000 },
    502006: { hp: 40000, exp: 30000 }
};
for (const [idText, expected] of Object.entries(bossTargets)) {
    const monster = byId.get(Number(idText));
    assert(monster?.isBoss, `対象ボス ${idText} が見つかりません。`);
    assert(Number(monster.hp) === expected.hp, `${monster.name} のHPが期待値と一致しません。`);
    assert(Number(monster.exp) === expected.exp, `${monster.name} のEXPが期待値と一致しません。`);
    assert(Array.isArray(monster.acts) && monster.acts.length > 0, `${monster.name} の使用技が失われています。`);
}

const fivePillars = [302080, 302081, 302082, 302083, 302084].map(id => byId.get(id));
assert(fivePillars.reduce((sum, monster) => sum + Number(monster.exp), 0) === 40000,
    '五柱戦の合計EXPが40000ではありません。');
assert(Number(byId.get(200204)?.exp) === 416000, 'プリズムキングの特殊EXPを変更しています。');
assert(Number(byId.get(902000)?.exp) === 9999999, 'ギルガメッシュは今回の調整対象外です。');

console.log(`Phase2B Rank120バランス検証: OK（通常敵 ${lateNormals.length}体 / ボス ${Object.keys(bossTargets).length}体）`);
