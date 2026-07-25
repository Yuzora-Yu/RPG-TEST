const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
for (const dir of ['assets/audio/bgm', 'assets/audio/se']) {
    if (!fs.existsSync(path.join(root, dir))) throw new Error(`Audio asset directory is missing: ${dir}`);
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
}
const context = { console, document: undefined, Audio: FakeAudio, performance: { now: () => Date.now() } };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(read('audio_manifest.js'), context, { filename: 'audio_manifest.js' });
vm.runInContext(read('audio.js'), context, { filename: 'audio.js' });

const manifest = context.AUDIO_MANIFEST;
if (!manifest || !context.AudioManager) throw new Error('Audio manifest/runtime did not initialize.');
const requiredBgm = [
    'field_world', 'town_fire_village', 'town_wind_village', 'town_water_city',
    'base_big_tower', 'base_thunder_fort', 'base_light_palace', 'base_dark_castle',
    'battle_normal', 'battle_midboss', 'battle_bigboss', 'battle_finalboss', 'battle_secretboss',
    'facility_inn', 'facility_shop', 'facility_blacksmith', 'facility_alchemy', 'facility_casino', 'facility_medal'
];
const requiredSe = [
    'event_effect', 'heal', 'heal_spring', 'chest_open', 'encounter_start', 'menu_confirm', 'menu_cancel', 'dialogue',
    'battle_attack', 'battle_skill', 'battle_damage', 'floor_move', 'stairs', 'warp',
    'damage_floor', 'switch', 'ice_slide', 'wall_bump', 'battle_item'
];
for (const key of requiredBgm) if (!manifest.BGM[key]) throw new Error(`Missing BGM slot: ${key}`);
for (const key of requiredSe) if (!manifest.SE[key]) throw new Error(`Missing SE slot: ${key}`);
for (const [key, entry] of Object.entries(manifest.BGM)) {
    if (!entry.src || entry.loop !== true) throw new Error(`BGM slot is not loop-ready: ${key}`);
    if (entry.enabled !== true) throw new Error(`BGM placeholder is not enabled: ${key}`);
    if (!path.basename(entry.src).startsWith('bgm_')) throw new Error(`BGM filename lacks bgm_ prefix: ${entry.src}`);
    const asset = path.join(root, entry.src);
    if (!fs.existsSync(asset)) throw new Error(`BGM placeholder is missing: ${entry.src}`);
    if (fs.readFileSync(asset).subarray(0, 4).toString('ascii') !== 'OggS') throw new Error(`BGM placeholder is not OGG: ${entry.src}`);
}
for (const [key, entry] of Object.entries(manifest.SE)) {
    if (!entry.src || entry.enabled !== true) throw new Error(`SE placeholder is not enabled: ${key}`);
    if (!path.basename(entry.src).startsWith('se_')) throw new Error(`SE filename lacks se_ prefix: ${entry.src}`);
    const asset = path.join(root, entry.src);
    if (!fs.existsSync(asset)) throw new Error(`SE placeholder is missing: ${entry.src}`);
    if (fs.readFileSync(asset).subarray(0, 4).toString('ascii') !== 'OggS') throw new Error(`SE placeholder is not OGG: ${entry.src}`);
}
for (const [areaKey, bgmKey] of Object.entries(manifest.AREA_BGM || {})) {
    if (!manifest.BGM[bgmKey]) throw new Error(`AREA_BGM ${areaKey} references missing BGM slot ${bgmKey}.`);
}
for (const [areaKey, bgmKey] of Object.entries(manifest.BASE_FLOOR_BGM || {})) {
    if (!manifest.BGM[bgmKey]) throw new Error(`BASE_FLOOR_BGM ${areaKey} references missing BGM slot ${bgmKey}.`);
}

const sourceChecks = {
    'main.js': ['syncForScene(sceneId)', "playSe?.('encounter_start')", "playSe?.('wall_bump')", "playSe?.('switch')", 'showQuestBoardModal'],
    'dungeon.js': ["playSe?.('chest_open')", "playSe?.('heal_spring')", "playSe?.('stairs')", "playSe?.('warp')", "playSe?.('damage_floor')", "playSe?.('ice_slide')"],
    'story_logic.js': ["playSe?.('dialogue')", "playSe?.('event_effect')", "playSe?.('heal')"],
    'battle.js': ["'battle_skill' : 'battle_attack'", "playSe?.('battle_item')", "playSe?.('battle_damage')", "syncForScene?.('battle')"],
    'menus_config.js': ['BGM音量', 'SE音量', 'setAudioVolume'],
    'audio.js': ['installMenuSeHooks', "AudioManager.playSe('menu_cancel')", "return isCancelAction ? 'menu_cancel' : 'menu_confirm'"],
    'index.html': ['audio_manifest.js', 'audio.js'],
    'sw.js': ['audio_manifest.js', 'audio.js']
};
for (const [file, markers] of Object.entries(sourceChecks)) {
    const source = read(file);
    for (const marker of markers) if (!source.includes(marker)) throw new Error(`${file} is missing audio marker: ${marker}`);
}

const moveSource = read('main.js');
const moveStart = moveSource.indexOf('move: (dx, dy) =>');
const moveEnd = moveSource.indexOf('render: () =>', moveStart);
const moveBlock = moveSource.slice(moveStart, moveEnd);
const directionIndex = moveBlock.indexOf("if (dy > 0) Field.dir = 0");
const collisionIndex = moveBlock.indexOf('if (Field.currentMapData)');
if (directionIndex < 0 || collisionIndex < 0 || directionIndex > collisionIndex) {
    throw new Error('Field direction is not updated before collision checks.');
}
if (!moveBlock.includes("keepCurrentTileAction({ bump: true }); Field.render(); return;")) {
    throw new Error('Blocked movement does not immediately render the new facing direction with wall-bump SE.');
}

context.App = { data: { settings: { bgmVolume: 250, seVolume: -4 } }, save() {}, ensureSettings() { return this.data.settings; } };
if (context.AudioManager.getBgmVolume() !== 100 || context.AudioManager.getSeVolume() !== 0) {
    throw new Error('Audio volume clamping is invalid.');
}

context.App.data.settings = { bgmVolume: 70, seVolume: 80 };
context.Field = { currentMapData: { floor: 1 }, getCurrentAreaKey: () => 'BIG_TOWER' };
if (context.AudioManager.resolveFieldBgmKey() !== 'base_big_tower') throw new Error('Base first-floor BGM routing is invalid.');
context.Field.currentMapData.floor = 2;
if (context.AudioManager.resolveFieldBgmKey() !== 'dungeon_big_tower') throw new Error('Dungeon upper-floor BGM routing is invalid.');
context.Field = { currentMapData: null, getCurrentAreaKey: () => 'WORLD' };
if (context.AudioManager.resolveFieldBgmKey() !== 'field_world') throw new Error('World field BGM routing is invalid.');

if (Object.keys(manifest.BGM).length !== 39) throw new Error(`Unexpected BGM placeholder count: ${Object.keys(manifest.BGM).length}`);
if (Object.keys(manifest.SE).length !== 19) throw new Error(`Unexpected SE placeholder count: ${Object.keys(manifest.SE).length}`);
context.AudioManager.unlock();
if (!context.AudioManager.playSe('menu_confirm')) throw new Error('Menu confirm SE did not start in the fake audio runtime.');
if (!context.AudioManager.playSe('menu_cancel')) throw new Error('Menu cancel SE did not start in the fake audio runtime.');
if (!context.AudioManager.playBgm('field_world', { resume: true })) throw new Error('Field BGM did not start in the fake audio runtime.');
context.AudioManager.bgm.currentTime = 47;
context.AudioManager.playBgm('battle_normal', { resume: true });
context.AudioManager.bgm.currentTime = 18;
context.AudioManager.playBgm('field_world', { resume: true });
if (Math.abs(context.AudioManager.bgm.currentTime - 47) > 0.001) {
    throw new Error(`Field BGM resume position was not restored: ${context.AudioManager.bgm.currentTime}`);
}
if (Math.abs(Number(context.AudioManager.positions.battle_normal) - 18) > 0.001) {
    throw new Error('Battle BGM position was not preserved when returning to the field.');
}

console.log('Audio framework validation passed.');
console.log('BGM/SE slots, silent OGG placeholders, filename prefixes, menu confirm/cancel hooks, loop settings, scene hooks, settings controls, collision facing, and BGM resume positions are valid.');
