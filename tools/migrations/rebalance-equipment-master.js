const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const targetPath = path.join(root, 'equips.js');
const source = fs.readFileSync(targetPath, 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'equips.js' });
const master = context.window.EQUIP_MASTER;

const ranks = [1, 50, 100, 150, 200];
const curves = {
    '剣': { atk: [3, 18, 40, 66, 96] },
    '斧': { atk: [4, 24, 52, 85, 126] },
    '短剣': { atk: [1, 12, 30, 50, 74], mag: [1, 12, 30, 50, 74] },
    '杖': { mag: [4, 22, 50, 82, 122] },
    '槍': { atk: [4, 21, 45, 73, 106] },
    '弓': { atk: [4, 21, 45, 73, 106] },
    '盾': { def: [3, 17, 35, 53, 70], mdef: [1, 13, 27, 40, 52] },
    '腕輪': { atk: [1, 10, 22, 34, 48], def: [1, 12, 26, 40, 56], mag: [1, 10, 22, 34, 48], mdef: [1, 14, 30, 45, 62] },
    '兜': { def: [2, 12, 25, 38, 52], mdef: [1, 8, 17, 26, 36], hp: [5, 24, 48, 75, 105], mp: [4, 26, 52, 80, 112] },
    '帽子': { def: [1, 8, 17, 26, 36], mdef: [2, 12, 25, 38, 52], hp: [4, 26, 52, 80, 112], mp: [5, 24, 48, 75, 105] },
    '鎧': { def: [2, 14, 29, 44, 60], mdef: [1, 10, 21, 32, 44] },
    'ローブ': { def: [1, 10, 21, 32, 44], mag: [1, 12, 26, 40, 56], mdef: [1, 12, 27, 42, 58] },
    'ブーツ': { def: [1, 10, 22, 34, 48], mdef: [1, 9, 19, 29, 40], spd: [1, 10, 22, 34, 48] },
    'くつ': { spd: [2, 14, 30, 46, 64] }
};

function interpolate(rank, values) {
    if (rank <= ranks[0]) return values[0];
    for (let index = 1; index < ranks.length; index++) {
        if (rank > ranks[index]) continue;
        const ratio = (rank - ranks[index - 1]) / (ranks[index] - ranks[index - 1]);
        return Math.round(values[index - 1] + (values[index] - values[index - 1]) * ratio);
    }
    return values[values.length - 1];
}

let changed = 0;
for (const equip of master) {
    if (equip.noRandom || equip.rank < 1 || equip.rank > 200) continue;
    const curve = curves[equip.baseName];
    if (!curve) throw new Error(`Missing equipment curve: ${equip.baseName}`);
    for (const [stat, values] of Object.entries(curve)) {
        if (!Object.prototype.hasOwnProperty.call(equip.data, stat)) continue;
        const next = interpolate(Number(equip.rank), values);
        if (equip.data[stat] !== next) {
            equip.data[stat] = next;
            changed++;
        }
    }
}

if (!process.argv.includes('--write')) {
    console.log(`Dry run: ${changed} direct master stat values would change.`);
    process.exit(0);
}

const output = `/* equips.js - direct source equipment balance generated 2026-07-29 */\nconst EQUIP_MASTER = ${JSON.stringify(master, null, 4)};\n\nwindow.EQUIP_MASTER = EQUIP_MASTER;\n`;
fs.writeFileSync(targetPath, output, 'utf8');
console.log(`Updated equips.js directly: ${changed} base stat values changed.`);
