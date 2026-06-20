const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.cwd();
const context = { console, window: {} };
context.globalThis = context;
vm.createContext(context);

const mapCode = fs.readFileSync(path.join(root, 'map.js'), 'utf8');
vm.runInContext(`${mapCode}\nglobalThis.__MAPS__ = { FIXED_DUNGEON_MAPS, MapRegistry };`, context, { filename: 'map.js' });

const { FIXED_DUNGEON_MAPS, MapRegistry } = context.__MAPS__;

const colors = {
  W: '#171922',
  T: '#4d5363',
  G: '#606a78',
  S: '#d7b45a',
  D: '#75d2ff',
  U: '#b9e985',
  C: '#9c6332',
  R: '#d64b63',
  B: '#db3b4d',
  P: '#8f7dff',
  V: '#4ab9d8',
  M: '#e4511e',
  X: '#c84949',
  Y: '#3f8ec6',
  Z: '#d8a834',
};

const labels = {
  S: '出',
  D: '下',
  U: '上',
  C: '宝',
  R: 'レ',
  B: '敵',
  X: '赤',
  Y: '青',
  Z: '金',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function svgFor(def) {
  const tile = 10;
  const width = Number(def.width);
  const height = Number(def.height);
  const rects = [];
  def.tiles.forEach((row, y) => {
    String(row).split('').forEach((raw, x) => {
      const t = raw.toUpperCase();
      const fill = colors[t] || '#6b7280';
      rects.push(`<rect x="${x * tile}" y="${y * tile}" width="${tile}" height="${tile}" fill="${fill}"/>`);
      if (labels[t]) {
        rects.push(`<text x="${x * tile + tile / 2}" y="${y * tile + tile * 0.7}" text-anchor="middle" font-size="6" fill="#fff">${labels[t]}</text>`);
      }
    });
  });
  return `<svg viewBox="0 0 ${width * tile} ${height * tile}" width="${width * tile}" height="${height * tile}" role="img">${rects.join('')}</svg>`;
}

const requestedKeys = String(process.env.MAP_KEYS || '')
  .split(',')
  .map(key => key.trim())
  .filter(Boolean);
const dungeonEntries = Object.entries(FIXED_DUNGEON_MAPS)
  .filter(([key]) => requestedKeys.length === 0 || requestedKeys.includes(key));

const sections = dungeonEntries.map(([key, base]) => {
  const floors = Array.isArray(base.floors) && base.floors.length
    ? base.floors.map((_, i) => MapRegistry.getFixedDungeonFloor(key, i + 1))
    : [MapRegistry.getFixedDungeonFloor(key, 1)];
  const cards = floors.map((floor) => `
    <article class="card">
      <h3>${escapeHtml(floor.displayName || floor.label || floor.name)}</h3>
      ${svgFor(floor)}
      <p>${escapeHtml((floor.chests || []).map(c => c.keyColor ? `${c.x},${c.y}: ${c.keyColor} key` : `${c.x},${c.y}: item ${c.itemId}`).join(' / ') || 'no chests')}</p>
    </article>
  `).join('');
  return `<section><h2>${escapeHtml(base.name)} <span>${escapeHtml(key)}</span></h2><div class="grid">${cards}</div></section>`;
}).join('\n');

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>Fixed Dungeon Preview</title>
<style>
body { margin: 24px; background: #11151d; color: #edf2f7; font-family: system-ui, sans-serif; }
h1 { font-size: 24px; }
h2 { margin-top: 32px; font-size: 20px; border-bottom: 1px solid #334155; padding-bottom: 8px; }
h2 span { color: #94a3b8; font-size: 13px; font-weight: 500; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; align-items: start; }
.card { background: #1a2230; border: 1px solid #334155; border-radius: 8px; padding: 12px; }
.card h3 { margin: 0 0 8px; font-size: 14px; }
.card p { margin: 8px 0 0; color: #cbd5e1; font-size: 11px; line-height: 1.4; }
svg { image-rendering: pixelated; max-width: 100%; height: auto; border: 1px solid #0f172a; background: #0f172a; }
</style>
</head>
<body>
<h1>Fixed Dungeon Preview</h1>
${sections}
</body>
</html>`;

const outDir = path.join(root, 'docs', 'generated');
fs.mkdirSync(outDir, { recursive: true });
const outputName = requestedKeys.length ? 'fixed-dungeon-preview-focused.html' : 'fixed-dungeon-preview.html';
fs.writeFileSync(path.join(outDir, outputName), html, 'utf8');
console.log(path.join(outDir, outputName));
