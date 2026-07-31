const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '..', '..', 'monsters.js');
const source = fs.readFileSync(targetPath, 'utf8');
const marker = 'direct-master-balance: ground-rank26-85-band-progression-v2';
if (source.includes(marker)) {
    console.log('monsters.js already contains the Rank-band progression marker; no changes made.');
    process.exit(0);
}

const targetPrimaryAverages = new Map([
    [36, 136],
    [46, 154],
    [66, 267]
]);
const lines = source.split(/\r?\n/);
const entries = [];
for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^(\s*)(\{.*\})(,?)$/);
    if (!match || !match[2].includes('"isBoss"') || !match[2].includes('"habitats"')) continue;
    let monster;
    try { monster = JSON.parse(match[2]); } catch { continue; }
    if (monster.isBoss || monster.isRare || monster.rank < 26 || monster.rank > 85 || monster.id < 251 || monster.id > 850) continue;
    const bandStart = Math.floor((Number(monster.rank) - 1) / 5) * 5 + 1;
    entries.push({ index, match, monster, bandStart });
}

for (const [bandStart, targetAverage] of targetPrimaryAverages) {
    const band = entries.filter(entry => entry.bandStart === bandStart);
    if (!band.length) throw new Error(`No monsters found for Rank ${bandStart}-${bandStart + 4}`);
    const beforeAverage = band.reduce((sum, entry) => sum + Math.max(entry.monster.atk, entry.monster.mag), 0) / band.length;
    if (beforeAverage >= targetAverage) continue;
    const factor = targetAverage / beforeAverage;
    for (const entry of band) {
        const primary = Math.max(entry.monster.atk, entry.monster.mag);
        if (entry.monster.atk >= primary * 0.8) entry.monster.atk = Math.round(entry.monster.atk * factor);
        if (entry.monster.mag >= primary * 0.8) entry.monster.mag = Math.round(entry.monster.mag * factor);
        lines[entry.index] = `${entry.match[1]}${JSON.stringify(entry.monster)}${entry.match[3]}`;
    }
    const afterAverage = band.reduce((sum, entry) => sum + Math.max(entry.monster.atk, entry.monster.mag), 0) / band.length;
    console.log(`Rank ${bandStart}-${bandStart + 4}: primary offense average ${Math.round(beforeAverage)} -> ${Math.round(afterAverage)}`);
}

if (!process.argv.includes('--write')) {
    console.log('Dry run only; pass --write to update monsters.js directly.');
    process.exit(0);
}
const output = lines.join('\n').replace(/^(\/\* monsters\.js[^\n]*\*\/)/, `$1\n/* ${marker} */`);
fs.writeFileSync(targetPath, output, 'utf8');
console.log('Updated monsters.js directly so adjacent Rank-band combat pressure no longer regresses.');
