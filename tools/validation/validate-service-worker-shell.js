'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
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

for (const required of ['maps_logic.js', 'story_logic.js', 'quests.js', 'guild_quests.js', 'guild_master.js', 'guild.js', 'alchemy.js']) {
    assert(precached.has(required), `Required offline game logic is not precached: ${required}`);
}
const cacheName = swSource.match(/const\s+CACHE_NAME\s*=\s*["']([^"']+)["']/)?.[1];
const runtimeCacheName = swSource.match(/const\s+RUNTIME_CACHE_NAME\s*=\s*["']([^"']+)["']/)?.[1];
const mainRuntimeCacheName = mainSource.match(/fullDataCacheName:\s*["']([^"']+)["']/)?.[1];
assert(cacheName && /^prisma-abyss-v\d+\./.test(cacheName), 'Service Worker CACHE_NAME is missing or invalid.');
assert(runtimeCacheName && runtimeCacheName.endsWith('-runtime'), 'Service Worker RUNTIME_CACHE_NAME is missing or invalid.');
assert(cacheName !== runtimeCacheName, 'App shell and runtime caches must use distinct names.');
assert(mainRuntimeCacheName === runtimeCacheName,
    `main.js runtime cache (${mainRuntimeCacheName}) does not match sw.js (${runtimeCacheName}).`);

console.log(`PASS: all ${scriptFiles.length} index.html scripts are present in the Service Worker precache.`);
console.log(`Cache names are valid and the runtime cache is synchronized: ${runtimeCacheName}`);
