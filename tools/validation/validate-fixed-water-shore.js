'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const { context } = loadMapRuntime(root);
const sharedContext = { window: {}, console };
sharedContext.globalThis = sharedContext;
vm.createContext(sharedContext);
vm.runInContext(read('map_render_shared.js'), sharedContext, { filename: 'map_render_shared.js' });

const themes = context.TILE_THEMES;
const enabledThemes = Object.entries(themes)
    .filter(([, theme]) => theme?.W?.shoreFoam === true)
    .map(([key]) => key)
    .sort();
assert(JSON.stringify(enabledThemes) === JSON.stringify(['CRENA_CAVE', 'SEABED_TEMPLE', 'WATER_CITY']),
    `Water shore foam must be limited to the three requested themes: ${enabledThemes.join(', ')}`);
enabledThemes.forEach(key => {
    assert(themes[key].W.animatedWater === true, `${key}: shore foam requires animated water`);
    assert(themes[key].W.lowerLayer === true, `${key}: shore foam water must remain a lower layer`);
});

const tiles = ['TTT', 'TWT', 'WWW'];
const tileAt = (x, y) => String(tiles[y] || '')[x] || '';
const plan = sharedContext.window.MapRenderShared.waterShorePlan({
    x: 1,
    y: 1,
    tileSign: 'W',
    enabled: true,
    tileAtFn: tileAt
});
assert(plan?.key === 'overlay_world_shore_foam', 'Shared shore resolver must reuse the world-map foam asset');
assert(plan.edges.map(edge => edge.id).sort().join(',') === 'e,n,w', 'Foam must be emitted only where water touches non-water');
assert(sharedContext.window.MapRenderShared.waterShorePlan({ x: 1, y: 1, tileSign: 'W', enabled: false, tileAtFn: tileAt }) === null,
    'Disabled water themes must not emit foam');
assert(sharedContext.window.MapRenderShared.waterShorePlan({ x: 0, y: 0, tileSign: 'T', enabled: true, tileAtFn: tileAt }) === null,
    'Non-water tiles must not emit foam');

const phaser = read('phaser-field.js');
const canvas = read('main.js');
assert(phaser.includes('renderShared.waterShorePlan({') && phaser.includes('objectConfig.shoreFoam === true'),
    'Phaser fixed-map renderer is not using the opt-in shared shoreline resolver');
assert(canvas.includes('window.MapRenderShared?.waterShorePlan?.({') && canvas.includes('config?.shoreFoam === true'),
    'Canvas recovery renderer is not using the opt-in shared shoreline resolver');

const foamPath = path.join(root, 'assets', 'map', 'overlays', 'overlay_world_shore_foam.png');
assert(fs.existsSync(foamPath) && fs.statSync(foamPath).size > 0, 'World shoreline foam asset is missing');

console.log(`PASS: fixed-map shoreline foam is limited to ${enabledThemes.join(', ')}`);
