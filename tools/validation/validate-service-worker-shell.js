'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const scriptFiles = [...indexSource.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)]
    .map(match => match[1])
    .filter(src => !/^(?:https?:)?\/\//i.test(src));
const precacheBlock = swSource.match(/const\s+PRECACHE_FILES\s*=\s*\[([\s\S]*?)\];/);
assert(precacheBlock, 'Unable to locate PRECACHE_FILES in sw.js');
const precached = new Set([...precacheBlock[1].matchAll(/["']([^"']+)["']/g)].map(match => match[1].replace(/^\.\//, '')));
const missing = scriptFiles.filter(src => !precached.has(src.replace(/^\.\//, '')));
assert(!missing.length, `index.html scripts missing from Service Worker precache: ${missing.join(', ')}`);

for (const required of ['maps_logic.js', 'story_logic.js', 'quests.js', 'alchemy.js']) {
    assert(precached.has(required), `Required offline game logic is not precached: ${required}`);
}
assert(/CACHE_NAME\s*=\s*"prisma-abyss-v3\.123-offline-shell"/.test(swSource),
    'Service Worker cache version was not advanced for the corrected app shell');

console.log(`PASS: all ${scriptFiles.length} index.html scripts are present in the Service Worker precache.`);
