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
const mapAssets = mapManifest.assets || [];
const adoptedMonsterIds = [
    200001, 200002, 200003, 200004, 200005, 200006, 200007, 200008,
    200009, 200010, 200011, 200012, 200013, 200014, 200015, 200016,
    302201, 302202, 302203, 302204, 302205, 302206, 302207, 302208,
];

if (mapAssets.length !== 91) errors.push(`map library count is ${mapAssets.length}, expected 91`);
if (new Set(mapAssets.map(asset => asset.theme)).size !== 10) errors.push('map library must contain 10 themes');

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

for (const id of adoptedMonsterIds) {
    const relative = `assets/monsters/monster_${id}.png`;
    expectPng(relative, 768, 768);
    if (!installImages.has(relative)) errors.push(`adopted monster missing from full cache: ${relative}`);
    if (startupImages.has(relative)) errors.push(`adopted monster must not delay startup: ${relative}`);
    if (id >= 302201 && id <= 302208 && graphics[`monster_${id}`] !== relative) {
        errors.push(`quest boss numeric graphics alias mismatch: ${id}`);
    }
}

if (fs.existsSync(path.join(root, 'assets/monsters/library'))) {
    errors.push('obsolete runtime monster library directory still exists');
}
for (const source of [read('assets.js'), read('monster-images.js'), read('monsters.js')]) {
    if (source.includes('assets/monsters/library') || source.includes('monsterlib_')) {
        errors.push('obsolete runtime monster library reference remains');
        break;
    }
}

if (assets.cacheWarmup?.version !== '2026-07-17-battle-logic-ui-v40') {
    errors.push('assets.js cache warmup version is stale');
}
if (!read('main.js').includes("fullDataCacheName: 'prisma-abyss-v3.100-battle-logic-ui-runtime'")) {
    errors.push('main.js full-data cache version is stale');
}
if (!read('sw.js').includes('const RUNTIME_CACHE_NAME = "prisma-abyss-v3.100-battle-logic-ui-runtime"')) {
    errors.push('sw.js runtime cache version is stale');
}

if (errors.length) {
    console.error(`Asset library validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Asset library validation passed: ${mapAssets.length} map chips and ${adoptedMonsterIds.length} canonical adopted monsters are fully cached.`);
