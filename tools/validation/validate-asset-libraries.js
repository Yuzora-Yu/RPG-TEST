const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const errors = [];

function readPngHeader(relative) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) {
        errors.push(`missing file: ${relative}`);
        return null;
    }
    const data = fs.readFileSync(absolute);
    if (data.length < 26 || data.toString('ascii', 1, 4) !== 'PNG') {
        errors.push(`not a PNG: ${relative}`);
        return null;
    }
    return {
        width: data.readUInt32BE(16),
        height: data.readUInt32BE(20),
        colorType: data[25]
    };
}

function expectPng(relative, width, height) {
    const header = readPngHeader(relative);
    if (!header) return;
    if (header.width !== width || header.height !== height) {
        errors.push(`wrong PNG size (${header.width}x${header.height}): ${relative}`);
    }
    if (![4, 6].includes(header.colorType)) {
        errors.push(`PNG has no alpha channel: ${relative}`);
    }
}

const context = { console };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(read('assets.js'), context, { filename: 'assets.js' });

const assets = context.PRISMA_ASSETS;
if (!assets) throw new Error('PRISMA_ASSETS was not exported.');
const graphics = assets.graphics || {};
const installImages = new Set(assets.cacheWarmup?.installImages || []);
const startupImages = new Set(assets.cacheWarmup?.startupImages || []);

const mapManifest = JSON.parse(read('assets/map/library/manifest.json'));
const monsterManifest = JSON.parse(read('assets/monsters/library/manifest.json'));
const mapAssets = mapManifest.assets || [];
const monsterAssets = monsterManifest.assets || [];

if (mapAssets.length !== 91) errors.push(`map library count is ${mapAssets.length}, expected 91`);
if (new Set(mapAssets.map(asset => asset.theme)).size !== 10) errors.push('map library must contain 10 themes');
if (monsterAssets.length !== 24) errors.push(`monster library count is ${monsterAssets.length}, expected 24`);
if (monsterAssets.filter(asset => asset.role === 'midboss').length !== 8) errors.push('midboss library must contain 8 candidates');
if (monsterAssets.filter(asset => asset.role === 'normal').length !== 16) errors.push('normal monster library must contain 16 candidates');
if (new Set(monsterAssets.map(asset => asset.element)).size !== 8) errors.push('monster library must contain 8 elements');
if (monsterManifest.runtimeFormat?.logicalCanvas?.join('x') !== '192x192' || monsterManifest.runtimeFormat?.nearestScale !== 4) {
    errors.push('monster library must preserve the 192px logical canvas and 4x nearest scaling contract');
}
if (monsterManifest.status !== 'adopted-runtime-v001') errors.push('monster library manifest must be marked adopted-runtime-v001');
if (new Set(monsterAssets.map(asset => asset.monsterId)).size !== 24) errors.push('adopted monster IDs must be unique');

const keys = new Set();
const paths = new Set();
for (const asset of mapAssets) {
    if (keys.has(asset.key)) errors.push(`duplicate key: ${asset.key}`);
    if (paths.has(asset.path)) errors.push(`duplicate path: ${asset.path}`);
    keys.add(asset.key);
    paths.add(asset.path);
    if (graphics[asset.key] !== asset.path) errors.push(`map asset registration mismatch: ${asset.key}`);
    if (!installImages.has(asset.path)) errors.push(`map asset missing from full cache: ${asset.path}`);
    if (startupImages.has(asset.path)) errors.push(`reusable map asset must not delay startup: ${asset.path}`);
    if (!['decoration', 'blocking'].includes(asset.role)) errors.push(`invalid map role: ${asset.key}`);
    if (asset.defaultCollision !== (asset.role === 'blocking')) errors.push(`collision/role mismatch: ${asset.key}`);
    expectPng(asset.path, 32, 32);
    expectPng(asset.master, 256, 256);
}

for (const asset of monsterAssets) {
    if (keys.has(asset.key)) errors.push(`duplicate key: ${asset.key}`);
    if (paths.has(asset.path)) errors.push(`duplicate path: ${asset.path}`);
    keys.add(asset.key);
    paths.add(asset.path);
    if (graphics[asset.key] !== asset.path) errors.push(`monster asset registration mismatch: ${asset.key}`);
    if (!installImages.has(asset.path)) errors.push(`monster asset missing from full cache: ${asset.path}`);
    if (startupImages.has(asset.path)) errors.push(`library monster must not delay startup: ${asset.path}`);
    if (!Number.isInteger(asset.monsterId) || !asset.storyAssignment) errors.push(`adopted monster is missing ID/assignment: ${asset.key}`);
    if (graphics[`monster_${asset.monsterId}`] !== asset.path) errors.push(`numeric monster alias mismatch: ${asset.monsterId}`);
    if (!['midboss', 'normal'].includes(asset.role)) errors.push(`invalid monster role: ${asset.key}`);
    expectPng(asset.path, 768, 768);
    const sourceHeader = readPngHeader(asset.source);
    if (sourceHeader && ![4, 6].includes(sourceHeader.colorType)) errors.push(`monster source has no alpha: ${asset.source}`);
}

if (assets.cacheWarmup?.version !== '2026-07-16-forest-sign-v31') {
    errors.push('assets.js cache warmup version is stale');
}
if (!read('main.js').includes("fullDataCacheName: 'prisma-abyss-v3.89-forest-sign-runtime-assets'")) {
    errors.push('main.js full-data cache version is stale');
}
if (!read('sw.js').includes('const RUNTIME_CACHE_NAME = "prisma-abyss-v3.89-forest-sign-runtime-assets"')) {
    errors.push('sw.js runtime cache version is stale');
}

if (errors.length) {
    console.error(`Asset library validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Asset library validation passed: ${mapAssets.length} map chips, ${monsterAssets.length} adopted monsters, all fully cached.`);
