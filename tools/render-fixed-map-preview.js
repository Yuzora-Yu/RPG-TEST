const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.cwd();
const context = { console, window: {} };
context.globalThis = context;
vm.createContext(context);

const mapCode = fs.readFileSync(path.join(root, 'map.js'), 'utf8');
vm.runInContext(`${mapCode}\nglobalThis.__MAPS__ = { FIXED_MAPS, FIXED_TILE_OVERLAYS, FIXED_OVERLAY_BASE_TILES };`, context, { filename: 'map.js' });

const { FIXED_MAPS, FIXED_TILE_OVERLAYS, FIXED_OVERLAY_BASE_TILES } = context.__MAPS__;

const colors = {
  W: '#172118',
  T: '#6b6f61',
  G: '#4f7c4c',
  L: '#b49358',
  M: '#e4511e',
  H: '#d6ae72',
  V: '#b978d6',
  I: '#68a0d8',
  K: '#8e54b0',
  E: '#f6ca62',
  D: '#40334f',
  P: '#8f7dff',
  S: '#d7b45a',
  C: '#9c6332',
  R: '#d64b63',
  B: '#db3b4d',
};
const labels = { H: '家', V: '施', I: '宿', K: '賭', E: 'メ', D: '入', P: '調', S: '出', C: '宝', R: 'レ', B: '敵', A: '長', J: '人' };

function overlayLabel(entry, raw) {
  const img = entry?.img || '';
  if (img.includes('elder')) return '長';
  if (img.includes('child')) return '子';
  if (img.includes('dark_soldier') || img.includes('bronze_knight')) return '兵';
  if (img.includes('villager')) return '人';
  if (img.includes('forge') || img.includes('house') || img.includes('hut') || img.includes('shop')) return labels[raw] || '家';
  return labels[raw] || '●';
}

function previewParts(def, raw) {
  const t = raw.toUpperCase();
  const themeKey = def.themeKey || def.areaKey || def.baseName;
  const defaults = def.isDungeon ? (FIXED_TILE_OVERLAYS.DEFAULT_DUNGEON || {}) : (FIXED_TILE_OVERLAYS.DEFAULT_FIELD || {});
  const themed = (themeKey && FIXED_TILE_OVERLAYS[themeKey]) ? FIXED_TILE_OVERLAYS[themeKey] : {};
  const local = def.fixedTileOverlays || def.overlayOverrides || {};
  const overlays = { ...defaults, ...themed, ...local };
  const baseDefaults = def.isDungeon ? (FIXED_OVERLAY_BASE_TILES.DEFAULT_DUNGEON || {}) : (FIXED_OVERLAY_BASE_TILES.DEFAULT_FIELD || {});
  const baseThemed = (themeKey && FIXED_OVERLAY_BASE_TILES[themeKey]) ? FIXED_OVERLAY_BASE_TILES[themeKey] : {};
  const baseLocal = def.fixedOverlayBaseTiles || {};
  const bases = { ...baseDefaults, ...baseThemed, ...baseLocal };
  const overlay = Object.prototype.hasOwnProperty.call(overlays, t) ? overlays[t] : null;
  return {
    base: overlay ? (bases[t] || 'T') : t,
    overlay,
    label: overlay ? overlayLabel(overlay, t) : labels[t]
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function svgFor(def) {
  const tile = 10;
  const rects = [];
  def.tiles.forEach((row, y) => {
    String(row).split('').forEach((raw, x) => {
      const parts = previewParts(def, raw);
      rects.push(`<rect x="${x * tile}" y="${y * tile}" width="${tile}" height="${tile}" fill="${colors[parts.base] || '#6b7280'}"/>`);
      if (parts.overlay) {
        rects.push(`<circle cx="${x * tile + tile / 2}" cy="${y * tile + tile / 2}" r="${tile * 0.38}" fill="${parts.overlay.color || '#ffffff'}"/>`);
      }
      if (parts.label) rects.push(`<text x="${x * tile + tile / 2}" y="${y * tile + tile * 0.7}" text-anchor="middle" font-size="6" fill="#fff">${parts.label}</text>`);
    });
  });
  return `<svg viewBox="0 0 ${def.width * tile} ${def.height * tile}" width="${def.width * tile}" height="${def.height * tile}">${rects.join('')}</svg>`;
}

const cards = Object.entries(FIXED_MAPS).map(([key, def]) => `
  <article class="card">
    <h2>${escapeHtml(def.name)} <span>${escapeHtml(key)}</span></h2>
    ${svgFor(def)}
    <p>${escapeHtml((def.mapActions || []).map(a => `${a.x},${a.y}: ${a.label || a.type}`).join(' / ') || 'no actions')}</p>
  </article>
`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>Fixed Map Preview</title>
<style>
body { margin: 24px; background: #10151d; color: #edf2f7; font-family: system-ui, sans-serif; }
h1 { font-size: 24px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; align-items: start; }
.card { background: #1a2230; border: 1px solid #334155; border-radius: 8px; padding: 12px; }
.card h2 { margin: 0 0 8px; font-size: 16px; }
.card h2 span { color: #94a3b8; font-size: 12px; font-weight: 500; }
.card p { margin: 8px 0 0; color: #cbd5e1; font-size: 11px; line-height: 1.4; }
svg { image-rendering: pixelated; max-width: 100%; height: auto; border: 1px solid #0f172a; background: #0f172a; }
</style>
</head>
<body>
<h1>Fixed Map Preview</h1>
<div class="grid">${cards}</div>
</body>
</html>`;

const outDir = path.join(root, 'docs', 'generated');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'fixed-map-preview.html'), html, 'utf8');
console.log(path.join(outDir, 'fixed-map-preview.html'));
