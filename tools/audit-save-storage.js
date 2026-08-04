#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const rootFiles = fs.readdirSync(root)
    .filter(name => /\.(?:js|html)$/.test(name))
    .map(name => path.join(root, name));

const read = file => fs.readFileSync(file, 'utf8');
const locations = (pattern) => {
    const found = [];
    for (const file of rootFiles) {
        const lines = read(file).split(/\r?\n/);
        lines.forEach((line, index) => {
            if (pattern.test(line)) found.push(`${path.basename(file)}:${index + 1}: ${line.trim()}`);
            pattern.lastIndex = 0;
        });
    }
    return found;
};

const appSaveCalls = locations(/\bApp\.save\s*\(/);
const directWrites = locations(/localStorage\.setItem\(CONST\.SAVE_KEY/);
const directReads = locations(/localStorage\.getItem\(CONST\.SAVE_KEY/);
const directDeletes = locations(/localStorage\.removeItem\(CONST\.SAVE_KEY/);

let initialBytes = null;
let saveKey = null;
try {
    const databasePath = path.join(root, 'database.js');
    const code = `${read(databasePath)}\n;globalThis.__INITIAL__=INITIAL_DATA_TEMPLATE;globalThis.__CONST__=CONST;`;
    const sandbox = { console, Date, Math, JSON };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(code, sandbox, { filename: databasePath });
    const json = JSON.stringify(sandbox.__INITIAL__);
    initialBytes = Buffer.byteLength(json, 'utf8');
    saveKey = sandbox.__CONST__.SAVE_KEY;
} catch (error) {
    console.warn(`Initial template measurement failed: ${error.message}`);
}

console.log('PRISMA ABYSS save storage audit');
console.log(`SAVE_KEY: ${saveKey || '(unknown)'}`);
console.log(`Initial template JSON size: ${initialBytes ?? '(unknown)'} bytes`);
console.log(`App.save() call sites in root JS/HTML: ${appSaveCalls.length}`);
console.log(`Direct SAVE_KEY reads: ${directReads.length}`);
console.log(`Direct SAVE_KEY writes: ${directWrites.length}`);
console.log(`Direct SAVE_KEY deletes: ${directDeletes.length}`);

for (const [label, entries] of [
    ['Direct reads', directReads],
    ['Direct writes', directWrites],
    ['Direct deletes', directDeletes]
]) {
    console.log(`\n${label}:`);
    if (!entries.length) console.log('  (none)');
    entries.forEach(entry => console.log(`  ${entry}`));
}
