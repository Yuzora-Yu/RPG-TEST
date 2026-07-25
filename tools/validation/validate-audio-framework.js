const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

for (const dir of ['assets/audio/bgm', 'assets/audio/se']) {
    assert(fs.existsSync(path.join(root, dir)), `Audio asset directory is missing: ${dir}`);
}

class FakeAudio {
    constructor(src) {
        this.src = src;
        this.preload = '';
        this.loop = false;
        this.volume = 1;
        this.currentTime = 0;
        this.duration = 120;
        this.readyState = 1;
        this.paused = true;
        this.ended = false;
        this.listeners = {};
    }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    removeEventListener(type) { delete this.listeners[type]; }
}

const context = { console, document: undefined, Audio: FakeAudio, performance: { now: () => Date.now() } };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(read('audio_manifest.js'), context, { filename: 'audio_manifest.js' });
vm.runInContext(read('audio.js'), context, { filename: 'audio.js' });

const manifest = context.AUDIO_MANIFEST;
assert(manifest && context.AudioManager, 'Audio manifest/runtime did not initialize.');
assert(Object.keys(manifest.BGM).length === 42, `Unexpected BGM slot count: ${Object.keys(manifest.BGM).length}`);
assert(Object.keys(manifest.SE).length === 34, `Unexpected SE slot count: ${Object.keys(manifest.SE).length}`);

const requiredBgm = [
    'field_world', 'field_ship', 'field_wing', 'field_abyss_outer',
    'battle_normal', 'battle_midboss', 'battle_bigboss', 'battle_finalboss', 'battle_secretboss', 'battle_wipeout',
    'facility_inn', 'facility_shop', 'facility_blacksmith', 'facility_alchemy', 'facility_casino', 'facility_medal'
];
const requiredSe = [
    'event_effect', 'heal', 'heal_spring', 'chest_open', 'floor_move', 'stairs', 'warp', 'damage_floor', 'switch', 'ice_slide', 'wall_bump',
    'menu_confirm', 'menu_cancel', 'dialogue', 'ui_item_heal', 'ui_item_move', 'ui_item_growth', 'ui_skill_heal_revive',
    'ui_blacksmith_start', 'ui_alchemy_start', 'ui_shop_buy', 'ui_shop_sell',
    'encounter_start', 'battle_attack', 'battle_skill_magic', 'battle_skill_breath', 'battle_skill_physical', 'battle_skill_other',
    'battle_item', 'battle_damage', 'battle_heal', 'battle_critical', 'battle_victory', 'battle_level_up'
];
for (const key of requiredBgm) assert(manifest.BGM[key], `Missing BGM slot: ${key}`);
for (const key of requiredSe) assert(manifest.SE[key], `Missing SE slot: ${key}`);
assert(!manifest.SE.battle_skill, 'Legacy battle_skill slot should be replaced by battle_skill_magic.');

for (const [key, entry] of Object.entries(manifest.BGM)) {
    assert(entry.src && entry.loop === true && entry.enabled === true, `BGM slot is not enabled/loop-ready: ${key}`);
    assert(path.basename(entry.src).startsWith('bgm_'), `BGM filename lacks bgm_ prefix: ${entry.src}`);
    const asset = path.join(root, entry.src);
    assert(fs.existsSync(asset), `BGM placeholder is missing: ${entry.src}`);
    assert(fs.readFileSync(asset).subarray(0, 4).toString('ascii') === 'OggS', `BGM placeholder is not OGG: ${entry.src}`);
}
for (const [key, entry] of Object.entries(manifest.SE)) {
    assert(entry.src && entry.enabled === true, `SE slot is not enabled: ${key}`);
    assert(path.basename(entry.src).startsWith('se_'), `SE filename lacks se_ prefix: ${entry.src}`);
    assert(['ui', 'battle', 'field', 'event'].includes(entry.group), `Unknown SE group ${entry.group}: ${key}`);
    const asset = path.join(root, entry.src);
    assert(fs.existsSync(asset), `SE placeholder is missing: ${entry.src}`);
    assert(fs.readFileSync(asset).subarray(0, 4).toString('ascii') === 'OggS', `SE placeholder is not OGG: ${entry.src}`);
}
for (const [areaKey, bgmKey] of Object.entries(manifest.AREA_BGM || {})) {
    assert(manifest.BGM[bgmKey], `AREA_BGM ${areaKey} references missing BGM slot ${bgmKey}.`);
}
for (const [areaKey, bgmKey] of Object.entries(manifest.BASE_FLOOR_BGM || {})) {
    assert(manifest.BGM[bgmKey], `BASE_FLOOR_BGM ${areaKey} references missing BGM slot ${bgmKey}.`);
}

const sourceChecks = {
    'main.js': ['fieldBgmVolume: 30', 'battleBgmVolume: 30', 'uiSeVolume: 5', 'battleSeVolume: 5', 'fieldSeVolume: 5'],
    'menus_config.js': ['フィールドBGM', '戦闘BGM', 'UI・メニューSE', '戦闘SE', 'フィールド・イベントSE'],
    'menus_items.js': ["'ui_item_heal'", "'ui_item_move'", "'ui_item_growth'"],
    'menus_skills.js': ["playSe?.('ui_skill_heal_revive')"],
    'blacksmith.js': ["playSeAndWait('ui_blacksmith_start')", 'await MenuBlacksmith.playStartSeAndWait()'],
    'alchemy.js': ["playSeAndWait('ui_alchemy_start')", 'await Alchemy.playStartSeAndWait()'],
    'facilities.js': ["playSe?.('ui_shop_buy')", "playSe?.('ui_shop_sell')"],
    'battle.js': [
        "return 'battle_skill_magic'", "return 'battle_skill_breath'", "return 'battle_skill_physical'", "return 'battle_skill_other'",
        "options.critical ? 'battle_critical' : 'battle_damage'", "playSe?.('battle_heal')", "playResultSeAndWait('battle_victory')", "playResultSeAndWait('battle_level_up')",
        "playBgm?.('battle_wipeout'", 'waitForResultAdvance', 'Battle.endBattle(Battle.resultEndIsGameOver === true)'
    ],
    'dungeon.js': ['waitForChestTrapReveal', 'await Dungeon.waitForChestTrapReveal()'],
    'audio.js': ["transportMode === 'flying'", "transportMode === 'boat'", 'getBgmCategoryForKey', 'getSeCategoryForKey'],
    'sw.js': ['prisma-abyss-v3.132-offline-shell', 'audio_manifest.js', 'audio.js']
};
for (const [file, markers] of Object.entries(sourceChecks)) {
    const source = read(file);
    for (const marker of markers) assert(source.includes(marker), `${file} is missing marker: ${marker}`);
}

context.App = {
    data: { settings: { fieldBgmVolume: 31, battleBgmVolume: 22, uiSeVolume: 7, battleSeVolume: 8, fieldSeVolume: 9 }, transportMode: null },
    save() {}, ensureSettings() { return this.data.settings; }
};
context.AudioManager.unlock();
assert(context.AudioManager.getBgmVolume('field_world') === 31, 'Field BGM category volume is invalid.');
assert(context.AudioManager.getBgmVolume('battle_normal') === 22, 'Battle BGM category volume is invalid.');
assert(context.AudioManager.getSeVolume('menu_confirm') === 7, 'UI SE category volume is invalid.');
assert(context.AudioManager.getSeVolume('battle_attack') === 8, 'Battle SE category volume is invalid.');
assert(context.AudioManager.getSeVolume('chest_open') === 9, 'Field/event SE category volume is invalid.');

context.Field = { currentMapData: null, getCurrentAreaKey: () => 'WORLD' };
assert(context.AudioManager.resolveFieldBgmKey() === 'field_world', 'World field BGM routing is invalid.');
context.App.data.transportMode = 'boat';
assert(context.AudioManager.resolveFieldBgmKey() === 'field_ship', 'Ship BGM routing is invalid.');
context.App.data.transportMode = 'flying';
assert(context.AudioManager.resolveFieldBgmKey() === 'field_wing', 'Wing BGM routing is invalid.');
context.App.data.transportMode = null;
context.Field = { currentMapData: { floor: 1 }, getCurrentAreaKey: () => 'BIG_TOWER' };
assert(context.AudioManager.resolveFieldBgmKey() === 'base_big_tower', 'Base first-floor BGM routing is invalid.');
context.Field.currentMapData.floor = 2;
assert(context.AudioManager.resolveFieldBgmKey() === 'dungeon_big_tower', 'Dungeon upper-floor BGM routing is invalid.');

assert(context.AudioManager.playBgm('field_world', { resume: true }), 'Field BGM did not start.');
context.AudioManager.bgm.currentTime = 47;
assert(context.AudioManager.playBgm('battle_normal', { resume: true }), 'Battle BGM did not start.');
context.AudioManager.bgm.currentTime = 18;
assert(context.AudioManager.playBgm('field_world', { resume: true }), 'Field BGM did not resume.');
assert(Math.abs(context.AudioManager.bgm.currentTime - 47) < 0.001, 'Field BGM resume position was not restored.');
assert(Math.abs(Number(context.AudioManager.positions.battle_normal) - 18) < 0.001, 'Battle BGM position was not preserved.');

console.log('Audio framework validation passed.');
console.log('42 BGM slots, 34 SE slots, five volume categories, transport/wipeout BGM, silent OGG placeholders, result sequencing hooks, and BGM resume behavior are valid.');
