const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const errors = [];
const versionPattern = /(?:[-_]v\d{3,})(?:[-_][a-z0-9]+)*(?=\.[^.]+$)/i;
const imagePattern = /assets\/[A-Za-z0-9_./ ()#\-\u3000\u3040-\u30ff\u3400-\u9fff]+?\.(?:png|gif|jpe?g|webp|svg)/gi;

const assetsSource = fs.readFileSync(path.join(root, 'assets.js'), 'utf8');
const assetContext = { console };
assetContext.window = assetContext;
assetContext.globalThis = assetContext;
vm.createContext(assetContext);
vm.runInContext(`${assetsSource}\nglobalThis.__ASSETS = PRISMA_ASSETS;`, assetContext, { filename: 'assets.js' });

const characterContext = { window: {} };
vm.createContext(characterContext);
vm.runInContext(fs.readFileSync(path.join(root, 'characters.js'), 'utf8'), characterContext, { filename: 'characters.js' });

const registered = new Set([
    ...(assetContext.__ASSETS?.cacheWarmup?.installImages || []),
    ...(characterContext.window.CHARACTERS_DATA || []).flatMap(character => [character?.img, character?.image])
].filter(value => typeof value === 'string' && value.startsWith('assets/')));

const runtimeFiles = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && ['.js', '.html', '.css'].includes(path.extname(entry.name).toLowerCase()))
    .map(entry => entry.name);
for (const file of runtimeFiles) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of source.matchAll(imagePattern)) {
        if (versionPattern.test(match[0])) errors.push(`version suffix remains in ${file}: ${match[0]}`);
    }
}

for (const relative of [...registered].sort()) {
    if (versionPattern.test(relative)) errors.push(`version suffix remains in runtime registry: ${relative}`);
    if (!fs.existsSync(path.join(root, relative))) errors.push(`registered image is missing: ${relative}`);
}

if (errors.length) {
    throw new Error(`Fixed-name asset validation failed:\n${errors.join('\n')}`);
}
console.log(`Fixed-name asset validation passed: ${registered.size} runtime image paths, no version suffixes or missing files.`);
