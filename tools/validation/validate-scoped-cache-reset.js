const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'main.html'), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
const source = inlineScripts.find(script => script.includes('function clearAppCacheAndReload'));
if (!source) throw new Error('clearAppCacheAndReload was not found in main.html');

const appWorkerUrl = 'https://example.invalid/game/sw.js';
const deletedCaches = [];
const unregistered = [];
const registrations = [
    { active: { scriptURL: appWorkerUrl }, unregister: async () => unregistered.push('app') },
    { active: { scriptURL: 'https://example.invalid/other/sw.js' }, unregister: async () => unregistered.push('other') },
    { active: null, waiting: null, installing: null, unregister: async () => unregistered.push('empty') }
];
const context = {
    URL,
    location: { href: 'https://example.invalid/game/main.html', reload: () => {} },
    localStorage: { removeItem: () => {} },
    navigator: { serviceWorker: {
        controller: null,
        register: async () => ({ installing: null, onupdatefound: null }),
        getRegistrations: async () => registrations
    } },
    caches: {
        keys: async () => ['prisma-abyss-v3.shell', 'prisma-abyss-v3.runtime', 'other-app-cache'],
        delete: async key => { deletedCaches.push(key); return true; }
    },
    window: {},
    document: { body: null, addEventListener: () => {}, getElementById: () => null },
    Promise,
    setTimeout,
    console
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'main.html:inline-cache-reset' });

(async () => {
    context.clearAppCacheAndReload();
    await new Promise(resolve => setTimeout(resolve, 0));
    if (JSON.stringify(unregistered) !== JSON.stringify(['app'])) {
        throw new Error(`Scoped SW reset failed: ${JSON.stringify(unregistered)}`);
    }
    if (deletedCaches.includes('other-app-cache') || deletedCaches.length !== 2) {
        throw new Error(`Scoped Cache Storage reset failed: ${JSON.stringify(deletedCaches)}`);
    }
    if (/Promise\.all\(regs\.map\(reg\s*=>\s*reg\.unregister\(\)\)\)/.test(source)) {
        throw new Error('Unscoped service-worker unregister logic remains.');
    }
    if (/Promise\.all\(keys\.map\(key\s*=>\s*caches\.delete\(key\)\)\)/.test(source)) {
        throw new Error('Unscoped Cache Storage deletion logic remains.');
    }
    console.log('PASS: cache reset only removes this app service worker and prisma-abyss caches.');
})().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
