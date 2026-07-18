const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'assets.js'), 'utf8');
const context = { console };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source}\nglobalThis.__ASSETS = PRISMA_ASSETS;`, context, { filename: 'assets.js' });

const warmup = context.__ASSETS.cacheWarmup;
const characterContext = { window: {} };
vm.createContext(characterContext);
vm.runInContext(fs.readFileSync(path.join(root, 'characters.js'), 'utf8'), characterContext, { filename: 'characters.js' });
const characterImages = (characterContext.window.CHARACTERS_DATA || [])
    .flatMap(character => [character?.img, character?.image])
    .filter(Boolean);
// Mirrors App.getFullDataCacheUrls(): centralized image registry + character
// portraits + the directly registered title background.
const rawUrls = [
    ...(warmup.installImages || []),
    ...characterImages,
    'assets/background/PRISMA ABYSS.png',
];
const urls = [...new Set(rawUrls)];
const failures = [];
const registeredUrls = warmup.installImages || [];
const duplicates = registeredUrls.filter((url, index) => registeredUrls.indexOf(url) !== index);
if (duplicates.length) failures.push(`duplicate cache entries: ${[...new Set(duplicates)].join(', ')}`);
for (const url of urls) {
    if (/^(?:https?:|data:|blob:)/i.test(url)) continue;
    const clean = url.split(/[?#]/, 1)[0];
    const file = path.resolve(root, clean.replaceAll('/', path.sep));
    if (!file.startsWith(root + path.sep)) failures.push(`path escapes project root: ${url}`);
    else if (!fs.existsSync(file)) failures.push(`missing file: ${url}`);
    else if (fs.statSync(file).size === 0) failures.push(`empty file: ${url}`);
}

const cacheNames = {
    main: /fullDataCacheName:\s*'([^']+)'/.exec(fs.readFileSync(path.join(root, 'main.js'), 'utf8'))?.[1],
    sw: /const RUNTIME_CACHE_NAME = "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'))?.[1],
};
if (!cacheNames.main || cacheNames.main !== cacheNames.sw) failures.push(`runtime cache name mismatch: ${JSON.stringify(cacheNames)}`);
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
if (!mainSource.includes('fetchAndCacheFullDataAsset') || !mainSource.includes('{ maxAttempts: 3 }')) {
    failures.push('foreground full-cache download has no three-attempt retry policy');
}
if (!swSource.includes('fetchAndCacheWithRetry') || !swSource.includes('if (failedUrls.length)')) {
    failures.push('background warm cache can mark an incomplete download as complete');
}

async function validateHttp(baseUrl) {
    let cursor = 0;
    const httpFailures = [];
    const workers = Array.from({ length: 6 }, async () => {
        while (cursor < urls.length) {
            const url = urls[cursor++];
            if (/^(?:data:|blob:)/i.test(url)) continue;
            const target = new URL(url, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
            let lastError = null;
            let ok = false;
            for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
                try {
                    const response = await fetch(target, { method: 'HEAD', cache: 'no-store' });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    ok = true;
                } catch (error) {
                    lastError = error;
                    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 100 * attempt));
                }
            }
            if (!ok) httpFailures.push(`${url}: ${lastError?.message || 'unknown error'}`);
        }
    });
    await Promise.all(workers);
    failures.push(...httpFailures.map(value => `HTTP ${value}`));
}

(async () => {
    const baseUrlArg = process.argv.find(arg => arg.startsWith('--base-url='));
    if (baseUrlArg) await validateHttp(baseUrlArg.slice('--base-url='.length));
    if (failures.length) {
        console.error(failures.join('\n'));
        process.exit(1);
    }
    console.log(`Full-cache asset validation passed: ${urls.length} unique, non-empty files; cache=${cacheNames.main}${baseUrlArg ? '; HTTP 200 verified' : ''}.`);
})();
