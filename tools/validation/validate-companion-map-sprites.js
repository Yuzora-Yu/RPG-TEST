const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file));
const assetsSource = read('assets.js').toString('utf8');
const phaserSource = read('phaser-field.js').toString('utf8');
const manifestPath = 'assets/map/overlays/source/companion-highres-v003/manifest.json';
const manifest = JSON.parse(read(manifestPath).toString('utf8'));

if (!Array.isArray(manifest.assets) || manifest.assets.length !== 9) {
    throw new Error('High-resolution companion manifest must contain exactly nine regenerated characters.');
}
if (!String(manifest.format || '').includes('source-resolution')) {
    throw new Error('Companion manifest no longer states the source-resolution runtime policy.');
}

for (const asset of manifest.assets) {
    for (const key of ['name', 'characterId', 'portrait', 'source', 'runtime']) {
        if (!asset[key]) throw new Error(`Companion manifest entry lacks ${key}: ${asset.name || 'unknown'}`);
    }
    const portraitPath = path.join(root, asset.portrait);
    const sourcePath = path.join(root, path.dirname(manifestPath), asset.source);
    const runtimePath = path.join(root, asset.runtime);
    for (const file of [portraitPath, sourcePath, runtimePath]) {
        if (!fs.existsSync(file)) throw new Error(`Companion sprite input/output is missing: ${file}`);
    }

    const png = fs.readFileSync(runtimePath);
    if (png.toString('ascii', 1, 4) !== 'PNG') throw new Error(`Runtime companion art is not PNG: ${asset.runtime}`);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const colorType = png.readUInt8(25);
    if (width !== height || width < 1000 || colorType !== 6) {
        throw new Error(`Runtime companion art must preserve a >=1000px square RGBA source canvas: ${asset.runtime} (${width}x${height}, type ${colorType})`);
    }
    const expectedReference = path.posix.basename(asset.runtime);
    if (!assetsSource.includes(expectedReference)) {
        throw new Error(`assets.js does not reference high-resolution companion art: ${expectedReference}`);
    }
    if (/[-_]v\d{3,}\.png/i.test(expectedReference)) {
        throw new Error(`Companion runtime art still has a version suffix: ${expectedReference}`);
    }
}

for (const marker of [
    "String(key).startsWith('overlay_companion_')",
    'Phaser.Textures.FilterMode.LINEAR',
    '/^(overlay_npc_|overlay_companion_)/'
]) {
    if (!phaserSource.includes(marker)) throw new Error(`High-resolution companion render marker is missing: ${marker}`);
}

console.log(`Companion map art validation passed. Source-resolution regenerated characters: ${manifest.assets.length}.`);
