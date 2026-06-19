const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'generated');
const outFile = path.join(outDir, 'random-key-door-preview.html');

const context = {
  console,
  Math,
  setTimeout,
  clearTimeout,
  window: {},
  DB: { ITEMS: [{ id: 1, name: 'item', rank: 1, type: 'item' }] },
  PassiveSkill: { getSumValue: () => 0 },
  Field: {
    x: 1,
    y: 1,
    currentMapData: null,
    getCurrentAreaKey: () => context.App.data.location.area || 'ABYSS',
    getCurrentProgressMapKey: () => context.App.data.location.area || 'ABYSS',
  },
  App: {
    data: {
      location: { area: 'ABYSS', x: 1, y: 1 },
      progress: { floor: 1, mapChanges: {}, fixedDungeonKeys: {} },
      dungeon: {},
      battle: {},
      items: {},
      inventory: [],
      party: [],
      gold: 0,
      book: { monsters: [], killCounts: {} },
    },
    log: () => {},
    save: () => {},
    changeScene: () => {},
    clearAction: () => {},
    setAction: () => {},
    getChar: () => null,
    createEquipByFloor: () => ({ name: 'equip', opts: [], data: {}, plus: 1 }),
  },
};
context.globalThis = context;
vm.createContext(context);

function runFile(file, suffix = '') {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(`${code}\n${suffix}`, context, { filename: file });
}

runFile('map.js', 'globalThis.__MAPS__ = { TILE_THEMES, STORY_DATA, MAP_DATA, FIXED_MAPS, FIXED_DUNGEON_MAPS, MapRegistry };');
Object.assign(context, context.__MAPS__);
runFile('assets.js', 'globalThis.PRISMA_ASSETS = PRISMA_ASSETS;');
runFile('dungeon.js', 'globalThis.Dungeon = Dungeon;');

const { Dungeon, Field, App, TILE_THEMES } = context;
const doorTiles = new Set(['X', 'Y', 'Z']);
const keyTiles = new Set(['Q', 'N', 'O']);

function reset(floor) {
  App.data.location.area = 'ABYSS';
  App.data.progress.floor = floor;
  App.data.progress.mapChanges = {};
  App.data.progress.fixedDungeonKeys = {};
  App.data.dungeon = {};
  Dungeon.floor = floor;
  Dungeon.map = [];
  Field.x = 1;
  Field.y = 1;
}

function tileConfig(tile) {
  return TILE_THEMES.DEFAULT[tile] || TILE_THEMES.DEFAULT.T;
}

function rel(src) {
  return path.relative(outDir, path.join(root, src)).replaceAll(path.sep, '/');
}

function renderSample(sample) {
  const rows = sample.map.map((row, y) => {
    const cells = row.map((raw, x) => {
      const tile = String(raw || 'W').toUpperCase();
      const cfg = tileConfig(tile);
      const image = cfg.img ? `background-image:url('${rel(context.PRISMA_ASSETS?.graphics?.[cfg.img] || '')}')` : '';
      const classes = [
        'cell',
        doorTiles.has(tile) ? 'door' : '',
        keyTiles.has(tile) ? 'key' : '',
        x === sample.start.x && y === sample.start.y ? 'start' : '',
        tile === 'S' ? 'stairs' : '',
      ].filter(Boolean).join(' ');
      return `<span class="${classes}" style="background-color:${cfg.color || '#222'};${image}"></span>`;
    }).join('');
    return `<div class="row">${cells}</div>`;
  }).join('');
  const keys = (sample.floorKeys || []).map(k => `${k.color}: ${k.x},${k.y}`).join(' / ') || 'none';
  const hudIcons = (sample.floorKeys || []).map(k => {
    const img = k.color === 'blue' ? 'item_key_blue_v001.png' : (k.color === 'gold' ? 'item_key_gold_v001.png' : 'item_key_red_v001.png');
    return `<img src="${rel(`assets/map/objects/${img}`)}" alt="">`;
  }).join('');
  return `<section class="card">
    <h2>ABYSS F${sample.floor}</h2>
    <div class="map">${rows}</div>
    <p>start ${sample.start.x},${sample.start.y} / ${keys}</p>
    <div class="hud">${hudIcons}</div>
  </section>`;
}

const samples = [];
for (let floor = 3; floor <= 160 && samples.length < 4; floor++) {
  for (let attempt = 0; attempt < 20 && samples.length < 4; attempt++) {
    reset(floor);
    Dungeon.generateFloor();
    const hasDoor = Dungeon.map.some(row => row.some(tile => doorTiles.has(String(tile || '').toUpperCase())));
    const hasKey = Dungeon.map.some(row => row.some(tile => keyTiles.has(String(tile || '').toUpperCase())));
    if (!hasDoor || !hasKey) continue;
    samples.push({
      floor,
      map: Dungeon.map.map(row => row.slice()),
      floorKeys: JSON.parse(JSON.stringify(App.data.dungeon.floorKeys || [])),
      start: { x: Field.x, y: Field.y },
    });
  }
}

if (!samples.length) throw new Error('No random key-door samples generated');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, `<!doctype html>
<meta charset="utf-8">
<title>Random Key Door Preview</title>
<style>
body{margin:0;background:#10151d;color:#e8f1ff;font-family:system-ui,sans-serif;padding:24px}
h1{font-size:24px;margin:0 0 22px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(620px,1fr));gap:18px}
.card{background:#182232;border:1px solid #33445c;border-radius:8px;padding:14px}
h2{font-size:15px;margin:0 0 10px}
.map{display:inline-block;max-width:100%;overflow:auto;background:#070a10;padding:10px}
.row{height:18px;white-space:nowrap}
.cell{position:relative;display:inline-block;width:18px;height:18px;background-size:contain;background-repeat:no-repeat;background-position:center;vertical-align:top}
.door{outline:1px solid rgba(255,255,255,.5);z-index:1}
.key{filter:drop-shadow(0 0 4px rgba(255,220,120,.8));z-index:2}
.start::after{content:"";position:absolute;inset:5px;background:white;border-radius:50%}
.stairs::after{content:"";position:absolute;inset:4px;border:2px solid #b8ff8a}
p{font-size:12px;color:#b8c7da}
.hud{display:flex;gap:6px;align-items:center;justify-content:flex-end;width:110px;margin-top:8px}
.hud img{width:24px;height:24px;object-fit:contain}
</style>
<h1>Random Key Door Preview</h1>
<div class="grid">${samples.map(renderSample).join('')}</div>
`);

console.log(outFile);
