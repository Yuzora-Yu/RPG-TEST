const fs = require('fs');
const path = require('path');
const vm = require('vm');

function readRoot(root, file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function createRuntimeContext(root, options = {}) {
  const context = {
    console,
    Math,
    setTimeout,
    clearTimeout,
    window: {},
    tileEntry: (img, color) => ({ img, color }),
    ...(options.context || {}),
  };
  context.globalThis = context;
  vm.createContext(context);

  const runFile = (file, suffix = '') => {
    const code = readRoot(root, file);
    vm.runInContext(`${code}\n${suffix}`, context, { filename: file });
  };

  return { context, runFile, read: file => readRoot(root, file) };
}

function loadMapRuntime(root, options = {}) {
  const runtime = createRuntimeContext(root, options);
  runtime.runFile('map.js', `
globalThis.STORY_MAP_MUTATIONS = STORY_MAP_MUTATIONS;
globalThis.TILE_THEMES = TILE_THEMES;
globalThis.STORY_DATA = STORY_DATA;
globalThis.MAP_DATA = MAP_DATA;
globalThis.FIXED_MAPS = FIXED_MAPS;
globalThis.FIXED_DUNGEON_MAPS = FIXED_DUNGEON_MAPS;
globalThis.FIELD_ENCOUNTER_ZONES = FIELD_ENCOUNTER_ZONES;
globalThis.SEA_ENCOUNTER_MONSTERS = SEA_ENCOUNTER_MONSTERS;
`);
  runtime.runFile('maps_logic.js', `
globalThis.MapRegistry = MapRegistry;
globalThis.FIXED_TILE_OVERLAYS = FIXED_TILE_OVERLAYS;
globalThis.FIXED_OVERLAY_BASE_TILES = FIXED_OVERLAY_BASE_TILES;
`);
  return runtime;
}

function loadStoryRuntime(root, options = {}) {
  const runtime = createRuntimeContext(root, options);
  runtime.runFile('story.js', 'globalThis.STORY_MANAGER_DATA = STORY_MANAGER_DATA;');
  runtime.runFile('story_logic.js', 'globalThis.StoryManager = StoryManager;');
  return runtime;
}

function loadMapStoryRuntime(root, options = {}) {
  const runtime = loadMapRuntime(root, options);
  runtime.runFile('story.js', 'globalThis.STORY_MANAGER_DATA = STORY_MANAGER_DATA;');
  runtime.runFile('story_logic.js', 'globalThis.StoryManager = StoryManager;');
  return runtime;
}

function isEffectAt(effect, x, y) {
  if (!effect) return false;
  const tx = Number(x);
  const ty = Number(y);
  if (Number.isFinite(Number(effect.x)) && Number.isFinite(Number(effect.y)) && Number(effect.x) === tx && Number(effect.y) === ty) return true;
  const inRect = (rect) => {
    if (!rect) return false;
    const x1 = Math.min(Number(rect.x1 ?? rect.x ?? 0), Number(rect.x2 ?? rect.x ?? 0));
    const x2 = Math.max(Number(rect.x1 ?? rect.x ?? 0), Number(rect.x2 ?? rect.x ?? 0));
    const y1 = Math.min(Number(rect.y1 ?? rect.y ?? 0), Number(rect.y2 ?? rect.y ?? 0));
    const y2 = Math.max(Number(rect.y1 ?? rect.y ?? 0), Number(rect.y2 ?? rect.y ?? 0));
    return tx >= x1 && tx <= x2 && ty >= y1 && ty <= y2;
  };
  if (inRect(effect.rect)) return true;
  if (Array.isArray(effect.rects) && effect.rects.some(inRect)) return true;
  if (Array.isArray(effect.points) && effect.points.some(p => Number(p?.x) === tx && Number(p?.y) === ty)) return true;
  return false;
}

function findTileEffect(mapDef, x, y) {
  return (mapDef.tileEffects || []).find(effect => isEffectAt(effect, x, y)) || null;
}

function isWalkableTile(tile, options = {}) {
  const upper = String(tile || 'W').toUpperCase();
  if (upper === 'W') return false;
  if (upper === 'B' && options.blockBosses !== false) return false;
  const lockedDoors = options.lockedDoors || new Set();
  if (lockedDoors.has(upper)) return false;
  return true;
}

function getTile(mapDef, x, y) {
  return String(mapDef.tiles?.[Number(y)]?.[Number(x)] || 'W').toUpperCase();
}

function resolveTileEffectMove(mapDef, x, y, dx, dy, options = {}) {
  const effect = findTileEffect(mapDef, x, y);
  if (!effect) return { x, y };

  if (effect.type === 'warp') {
    const wx = Number(effect.toX);
    const wy = Number(effect.toY);
    if (Number.isFinite(wx) && Number.isFinite(wy) && isWalkableTile(getTile(mapDef, wx, wy), options)) {
      return { x: wx, y: wy };
    }
    return { x, y };
  }

  if (effect.type === 'ice') {
    let sx = x;
    let sy = y;
    const maxSlide = Math.max(1, Number(effect.maxSlide || 20));
    for (let i = 0; i < maxSlide; i++) {
      const nx = sx + dx;
      const ny = sy + dy;
      if (nx < 0 || ny < 0 || nx >= Number(mapDef.width) || ny >= Number(mapDef.height)) break;
      if (!isWalkableTile(getTile(mapDef, nx, ny), options)) break;
      sx = nx;
      sy = ny;
      const nextEffect = findTileEffect(mapDef, sx, sy);
      if (nextEffect && nextEffect.type !== 'ice') break;
    }
    return { x: sx, y: sy };
  }

  return { x, y };
}

function collectReachableCells(mapDef, start, options = {}) {
  const width = Number(mapDef.width || String(mapDef.tiles?.[0] || '').length);
  const height = Number(mapDef.height || mapDef.tiles?.length || 0);
  const sx = Number(start?.x);
  const sy = Number(start?.y);
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return new Set();
  if (!isWalkableTile(getTile(mapDef, sx, sy), options)) return new Set();

  const queue = [{ x: sx, y: sy }];
  const visited = new Set([`${sx},${sy}`]);
  for (let qi = 0; qi < queue.length; qi++) {
    const p = queue[qi];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!isWalkableTile(getTile(mapDef, nx, ny), options)) continue;
      const moved = resolveTileEffectMove(mapDef, nx, ny, dx, dy, options);
      const key = `${moved.x},${moved.y}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(moved);
    }
  }
  return visited;
}

module.exports = {
  collectReachableCells,
  createRuntimeContext,
  findTileEffect,
  getTile,
  isWalkableTile,
  loadMapRuntime,
  loadMapStoryRuntime,
  loadStoryRuntime,
  readRoot,
  resolveTileEffectMove,
};
