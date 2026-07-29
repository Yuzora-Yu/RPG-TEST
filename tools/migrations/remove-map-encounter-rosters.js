const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const mapPath = path.join(root, 'map.js');
const write = process.argv.includes('--write');

function findClosingBracket(source, openIndex) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    for (let i = openIndex; i < source.length; i += 1) {
        const char = source[i];
        const next = source[i + 1];
        if (lineComment) { if (char === '\n') lineComment = false; continue; }
        if (blockComment) { if (char === '*' && next === '/') { blockComment = false; i += 1; } continue; }
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === '/' && next === '/') { lineComment = true; i += 1; continue; }
        if (char === '/' && next === '*') { blockComment = true; i += 1; continue; }
        if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
        if (char === '[') depth += 1;
        else if (char === ']' && --depth === 0) return i;
    }
    throw new Error(`Unclosed array at ${openIndex}`);
}

let source = fs.readFileSync(mapPath, 'utf8');
const matches = [...source.matchAll(/^(\s*)["']?(monsters|rareMonsters)["']?\s*:\s*\[/gm)];
const edits = [];
const counts = { monsters: 0, rareMonsters: 0 };

for (const match of matches) {
    const start = match.index;
    const open = source.indexOf('[', start);
    const close = findClosingBracket(source, open);
    let end = close + 1;
    while (source[end] === ' ' || source[end] === '\t') end += 1;
    if (source[end] === ',') end += 1;
    if (source[end] === '\r') end += 1;
    if (source[end] === '\n') end += 1;
    edits.push({ start, end });
    counts[match[2]] += 1;
}

for (const edit of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, edit.start) + source.slice(edit.end);
}

console.log(`Map encounter roster cleanup: monsters=${counts.monsters}, rareMonsters=${counts.rareMonsters}.`);
if (write) {
    fs.writeFileSync(mapPath, source, 'utf8');
    console.log(`Updated ${mapPath}`);
} else {
    console.log('Dry run only. Pass --write to apply the mechanical source cleanup.');
}
