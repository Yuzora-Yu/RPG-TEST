const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const targetPath = path.join(root, 'monsters.js');
const source = fs.readFileSync(targetPath, 'utf8');
const balanceMarker = 'direct-master-balance: ground-rank26-85-v1';
if (source.includes(balanceMarker)) {
    console.log('monsters.js already contains the Rank26-85 direct-master balance marker; no changes made.');
    process.exit(0);
}
const lines = source.split(/\r?\n/);
const changedBands = new Map();
let changedMonsters = 0;

function tuneMonster(monster) {
    if (monster.isBoss || monster.isRare || monster.rank < 26 || monster.rank > 85 || monster.id < 251 || monster.id > 850) return false;
    const immutable = JSON.stringify({
        id: monster.id,
        rank: monster.rank,
        hp: monster.hp,
        mp: monster.mp,
        exp: monster.exp,
        gold: monster.gold,
        habitats: monster.habitats,
        abyssFloors: monster.abyssFloors,
        acts: monster.acts,
        drops: monster.drops
    });
    const progress = (Number(monster.rank) - 26) / (85 - 26);
    const eliteFactor = Number(monster.actCount || 1) > 1 ? 0.65 : 1;
    const offenseFactor = 1.10 + (0.10 * progress * eliteFactor);
    const defenseFactor = 1.10 + (0.10 * progress);
    const speedFactor = 1.06 + (0.08 * progress);
    const rankStep = Math.floor((Number(monster.rank) - 26) / 10) + 1;
    const primary = Math.max(Number(monster.atk || 0), Number(monster.mag || 0));
    for (const stat of ['atk', 'mag']) {
        const value = Number(monster[stat] || 0);
        const isRelevant = value >= primary * 0.6;
        const factor = isRelevant ? offenseFactor : 1.04 + (0.04 * progress);
        monster[stat] = Math.max(1, Math.round(value * factor + (isRelevant ? rankStep * eliteFactor : 0)));
    }
    monster.def = Math.max(1, Math.round(Number(monster.def || 0) * defenseFactor + Math.ceil(rankStep / 2)));
    monster.mdef = Math.max(1, Math.round(Number(monster.mdef || 0) * defenseFactor + Math.ceil(rankStep / 2)));
    monster.spd = Math.max(1, Math.round(Number(monster.spd || 0) * speedFactor + Math.floor(rankStep / 2)));
    const afterImmutable = JSON.stringify({
        id: monster.id,
        rank: monster.rank,
        hp: monster.hp,
        mp: monster.mp,
        exp: monster.exp,
        gold: monster.gold,
        habitats: monster.habitats,
        abyssFloors: monster.abyssFloors,
        acts: monster.acts,
        drops: monster.drops
    });
    if (immutable !== afterImmutable) throw new Error(`Non-stat master data changed for monster ${monster.id}`);
    return true;
}

for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^(\s*)(\{.*\})(,?)$/);
    if (!match || !match[2].includes('"isBoss"') || !match[2].includes('"habitats"')) continue;
    let monster;
    try {
        monster = JSON.parse(match[2]);
    } catch {
        continue;
    }
    const before = { atk: monster.atk, def: monster.def, spd: monster.spd, mag: monster.mag, mdef: monster.mdef };
    if (!tuneMonster(monster)) continue;
    lines[index] = `${match[1]}${JSON.stringify(monster)}${match[3]}`;
    changedMonsters++;
    const band = `${Math.floor((monster.rank - 1) / 5) * 5 + 1}-${Math.floor((monster.rank - 1) / 5) * 5 + 5}`;
    const row = changedBands.get(band) || { count: 0, before: 0, after: 0 };
    row.count++;
    row.before += Math.max(before.atk, before.mag);
    row.after += Math.max(monster.atk, monster.mag);
    changedBands.set(band, row);
}

if (!changedMonsters) throw new Error('No Rank26-85 normal monsters were found.');
for (const [band, row] of changedBands) {
    console.log(`Rank ${band}: primary offense average ${Math.round(row.before / row.count)} -> ${Math.round(row.after / row.count)} (${row.count} monsters)`);
}
if (!process.argv.includes('--write')) {
    console.log(`Dry run: ${changedMonsters} normal-monster master entries would change.`);
    process.exit(0);
}
const output = lines.join('\n').replace(/^(\/\* monsters\.js[^\n]*\*\/)/, `$1\n/* ${balanceMarker} (HP/MP/EXP/gold/habitats/actions/drops unchanged) */`);
fs.writeFileSync(targetPath, output, 'utf8');
console.log(`Updated monsters.js directly: ${changedMonsters} Rank26-85 normal monsters changed; HP/MP/EXP/gold/habitats/actions/drops preserved.`);
