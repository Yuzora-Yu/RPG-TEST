const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const context = { window: {}, console };
context.globalThis = context;
vm.createContext(context);
for (const file of ['equips.js', 'monsters.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const equips = context.window.EQUIP_MASTER;
const monsters = context.MONSTERS_DATA;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const expectedRank200 = {
    '剣': { atk: 96 },
    '斧': { atk: 126 },
    '短剣': { atk: 74, mag: 74 },
    '杖': { mag: 122 },
    '槍': { atk: 106 },
    '弓': { atk: 106 },
    '盾': { def: 70, mdef: 52 },
    '鎧': { def: 60, mdef: 44 }
};
for (const [baseName, stats] of Object.entries(expectedRank200)) {
    const equip = equips.find(entry => !entry.noRandom && entry.rank === 200 && entry.baseName === baseName);
    assert(equip, `Rank200 equipment is missing: ${baseName}`);
    for (const [stat, value] of Object.entries(stats)) {
        assert(equip.data?.[stat] === value, `Rank200 ${baseName} ${stat} must be ${value}, got ${equip.data?.[stat]}`);
    }
}

for (const baseName of new Set(equips.filter(entry => !entry.noRandom && entry.rank <= 200).map(entry => entry.baseName))) {
    const rows = equips.filter(entry => !entry.noRandom && entry.rank <= 200 && entry.baseName === baseName).sort((a, b) => a.rank - b.rank);
    for (const stat of ['atk', 'def', 'mag', 'mdef', 'spd', 'hp', 'mp']) {
        const values = rows.filter(row => Number.isFinite(Number(row.data?.[stat])) && Number(row.data[stat]) >= 0).map(row => Number(row.data[stat]));
        assert(values.every((value, index) => index === 0 || value >= values[index - 1]), `${baseName} ${stat} regresses at a higher Rank`);
    }
}

const ground = monsters.filter(monster => !monster.isBoss && !monster.isRare && monster.id >= 251 && monster.id <= 850 && monster.rank >= 26 && monster.rank <= 85);
assert(ground.length === 68, `Expected 68 tuned Rank26-85 normal monsters, got ${ground.length}`);
const bandAverages = [];
for (let start = 26; start <= 81; start += 5) {
    const band = ground.filter(monster => monster.rank >= start && monster.rank <= start + 4);
    assert(band.length > 0, `Normal-monster Rank band is empty: ${start}-${start + 4}`);
    const average = band.reduce((sum, monster) => sum + Math.max(monster.atk, monster.mag), 0) / band.length;
    bandAverages.push({ start, average });
}
assert(bandAverages.every((entry, index) => index === 0 || entry.average > bandAverages[index - 1].average),
    `Rank26-85 primary-offense averages must rise by band: ${bandAverages.map(entry => `${entry.start}:${Math.round(entry.average)}`).join(', ')}`);

const rankAverage = (rank, selector) => {
    const rows = monsters.filter(monster => !monster.isBoss && !monster.isRare && Number(monster.rank) === Number(rank));
    assert(rows.length > 0, `Normal-monster Rank is empty: ${rank}`);
    return rows.reduce((sum, monster) => sum + selector(monster), 0) / rows.length;
};
assert(rankAverage(31, monster => monster.exp) > rankAverage(26, monster => monster.exp), 'Rank31 EXP must exceed Rank26 EXP');
assert(rankAverage(71, monster => monster.hp) > rankAverage(66, monster => monster.hp), 'Rank71 HP must exceed Rank66 HP');
assert(rankAverage(71, monster => monster.exp) > rankAverage(66, monster => monster.exp), 'Rank71 EXP must exceed Rank66 EXP');
assert(rankAverage(81, monster => monster.exp) > rankAverage(76, monster => monster.exp), 'Rank81 EXP must exceed Rank76 EXP');
assert(rankAverage(86, monster => Math.max(monster.atk, monster.mag)) > rankAverage(81, monster => Math.max(monster.atk, monster.mag)), 'Rank86 primary offense must exceed Rank81 primary offense');

const abyssMapIds = new Set(['MAP000038','MAP000039','MAP000040','MAP000041','MAP000043','MAP000044','MAP000045','MAP000046','MAP000048','MAP000049','MAP000050']);
const isAbyssNormal = monster => !monster.isBoss && !monster.isRare && (
    Number(monster.id) >= 1 && Number(monster.id) <= 2000
    && (
    (monster.abyssFloors || []).length > 0
    || (monster.habitats || []).some(habitat => abyssMapIds.has(String(habitat.mapId)))
    )
);
assert(monsters.filter(isAbyssNormal).every(monster => Number(monster.actCount) === 1), 'All Abyss normal monsters must act once per turn');

const nonAbyssTwoAction = monsters.filter(monster => !monster.isBoss && !monster.isRare
    && Number(monster.id) >= 1 && Number(monster.id) <= 2000
    && Number(monster.actCount) > 1 && !isAbyssNormal(monster));
for (const monster of nonAbyssTwoAction) {
    const bandStart = Math.floor((Number(monster.rank) - 1) / 5) * 5 + 1;
    const peers = monsters.filter(peer => !peer.isBoss && !peer.isRare && Number(peer.rank) >= bandStart && Number(peer.rank) <= bandStart + 4);
    const average = selector => peers.reduce((sum, peer) => sum + selector(peer), 0) / peers.length;
    assert(Number(monster.hp) >= average(peer => Number(peer.hp)), `${monster.name}: two-action HP must meet its Rank-band average`);
    assert(Math.max(Number(monster.atk), Number(monster.mag)) >= average(peer => Math.max(Number(peer.atk), Number(peer.mag))), `${monster.name}: two-action offense must meet its Rank-band average`);
    assert((Number(monster.def) + Number(monster.mdef)) / 2 >= average(peer => (Number(peer.def) + Number(peer.mdef)) / 2), `${monster.name}: two-action bulk must meet its Rank-band average`);
}

console.log(`Balance master validation passed: equipment curves and requested monster Rank gaps are monotonic; Rank26-85 primary offense averages ${bandAverages.map(entry => Math.round(entry.average)).join(' < ')}.`);
